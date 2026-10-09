import { TEMPLE_DEFENSE, FILM_SCENE_BY_ID, FILM_SETS, newTempleDefense, templeDefenseActive, templeDefenseLocked,
  templeDefenseText, templeCastRoot, filmEntry, filmPosition, filmStepNear, filmStepPosition,
  type AgentState, type SandboxState, type TempleDefenseGesture } from '@auto_matrix/shared';
import type { WorldState } from '../world/WorldState.js';

export class TempleDefenseSystem {
  onAdvance?: (text: string, actor: AgentState, tick: number) => void;
  constructor(private world: WorldState, private sandbox: () => SandboxState) {}
  private get journey() { return this.sandbox().neoLife?.journey; }
  active(actor: AgentState): boolean { return this.journey?.actor === actor.id && templeDefenseActive(this.journey); }
  clear(): void {
    this.sandbox().structures = this.sandbox().structures.filter(s => !s.id.startsWith('film:temple:'));
    for (const actor of this.world.agents.values()) if (!actor.controller && actor.currentAction?.parameters.templeDefense) actor.currentAction = null;
  }
  frame(actor: AgentState, dt: number, tick: number, held = false): boolean {
    const saved = this.journey;
    if (saved && !saved.visiting && ['m3_temple_defense', 'm3_temple_breach', 'm3_ceasefire'].includes(saved.scene)) {
      TEMPLE_DEFENSE.obstacles.forEach((obstacle, index) => {
        const id = `film:temple:artillery:${index}`;
        if (!this.sandbox().structures.some(s => s.id === id)) this.sandbox().structures.push({ id, kind: 'barricade', owner: 'zion',
          position: filmPosition('film_zion_temple', obstacle.x, obstacle.z), matrix: false, health: 999,
          film: { scene: saved.scene, width: obstacle.width, depth: obstacle.depth, height: obstacle.height } });
      });
    }
    if (!this.active(actor)) return false;
    const journey = this.journey!, preparing = journey.scene === 'm3_temple_defense';
    const seal = journey.templeSeal ??= newTempleDefense(tick);
    if (!seal.turns) {
      // Preserve both completed legacy work and a partially tightened first side.
      const done = journey.completed.includes('m3_temple_defense');
      seal.turns = [done || journey.step >= 2 ? 1 : 0, done || journey.step >= 3 ? 1 : 0];
      seal.elapsed = 0; seal.waiting = 0;
      if (done && preparing) journey.step = FILM_SCENE_BY_ID.m3_temple_defense.steps.length;
      else if (preparing && journey.step > 0) {
        actor.position = filmStepPosition(FILM_SCENE_BY_ID.m3_temple_defense, FILM_SCENE_BY_ID.m3_temple_defense.steps[journey.step]);
        journey.checkpoint = { ...actor.position };
      }
      if (seal.turns.every(turn => turn === 1)) seal.phase = 'sealed';
    }
    const breach = !preparing ? journey.templeBreach ??= { phase: 'ready', elapsed: 0 } : undefined;
    const state = breach ?? seal;
    const occupied = TEMPLE_DEFENSE.cast.find(id => id !== actor.id && this.world.agents.get(id)?.status === 'alive' && this.world.agents.get(id)?.controller);
    const missing = TEMPLE_DEFENSE.cast.find(id => id !== actor.id && this.world.agents.get(id)?.status !== 'alive');
    state.paused = occupied ? this.world.agents.get(occupied)!.name : undefined;
    state.unavailable = missing ? this.world.agents.get(missing)?.name ?? missing : undefined;
    const elapsed = actor.controller && actor.status === 'alive' && !state.paused && !state.unavailable ? Math.max(0, Math.min(.1, dt)) : 0;
    delete journey.started; seal.lastTick = tick;
    if (preparing) {
      if (seal.phase === 'running' && elapsed) {
        seal.remaining = Math.max(0, seal.remaining - elapsed);
        seal.elapsed = (seal.elapsed ?? 0) + elapsed;
        if (seal.remaining === 0) { seal.phase = 'failed'; delete seal.mount; actor.status = 'dead'; actor.health = 0; }
      }
      if (seal.phase === 'running' && seal.mount !== undefined) {
        const index = seal.mount;
        actor.position = filmPosition('film_zion_temple', TEMPLE_DEFENSE.mounts[index].x, TEMPLE_DEFENSE.operatorZ); actor.rotation = Math.PI;
        actor.velocity = { x: 0, y: 0, z: 0 };
        seal.gripAge = Math.min(TEMPLE_DEFENSE.reach, (seal.gripAge ?? 0) + elapsed);
        if (held && seal.gripAge >= TEMPLE_DEFENSE.reach) seal.turns[index] = Math.min(1, seal.turns[index] + elapsed / TEMPLE_DEFENSE.mounting);
        if (seal.turns[index] === 1) {
          delete seal.mount; seal.gripAge = 0;
          if (index === 1) seal.phase = 'sealed';
          this.onAdvance?.(templeDefenseText(seal), actor, tick);
        }
      }
      const scene = FILM_SCENE_BY_ID.m3_temple_defense;
      if (elapsed && journey.step === 0 && filmStepNear(scene, scene.steps[0], actor.position, false, journey)) this.onAdvance?.(templeDefenseText(seal), actor, tick);
      if (elapsed && journey.step === 3 && seal.phase === 'sealed') {
        seal.waiting = filmStepNear(scene, scene.steps[3], actor.position, false, journey) ? (seal.waiting ?? 0) + elapsed : 0;
        if (seal.waiting >= TEMPLE_DEFENSE.returnSeconds) this.onAdvance?.('Zee 回到避难人群旁。炮架固定并不等于战争结束，士兵仍守着敞开的入口。', actor, tick);
      }
    } else if (breach) {
      const scene = FILM_SCENE_BY_ID.m3_temple_breach;
      if (elapsed && journey.step === 0 && filmStepNear(scene, scene.steps[0], actor.position, false, journey)) this.onAdvance?.(templeDefenseText(seal, breach), actor, tick);
      if (!['ready', 'done'].includes(breach.phase)) {
        actor.position = filmPosition(scene.set, TEMPLE_DEFENSE.breach.actor.x, TEMPLE_DEFENSE.breach.actor.z); actor.rotation = TEMPLE_DEFENSE.breach.actor.yaw;
        actor.velocity = { x: 0, y: 0, z: 0 };
        const duration = ({ orders: TEMPLE_DEFENSE.breach.orders, breach: TEMPLE_DEFENSE.breach.drilling, waiting: TEMPLE_DEFENSE.breach.waiting } as const)[breach.phase as 'orders' | 'breach' | 'waiting'];
        breach.elapsed = Math.min(duration, breach.elapsed + elapsed);
        if (breach.elapsed >= duration) {
          breach.phase = ({ orders: 'breach', breach: 'waiting', waiting: 'done' } as const)[breach.phase as 'orders' | 'breach' | 'waiting']; breach.elapsed = 0;
          if (breach.phase === 'done') this.onAdvance?.(templeDefenseText(seal, breach), actor, tick);
        }
      }
    }
    for (const role of TEMPLE_DEFENSE.cast) {
      const member = this.world.agents.get(role);
      if (!member || member.status !== 'alive' || role !== actor.id && member.controller) continue;
      if (role !== actor.id) {
        const point = templeCastRoot(role);
        member.position = filmPosition('film_zion_temple', point.x, point.z); member.rotation = point.yaw;
        member.currentLocation = 'film_zion_temple'; member.isInMatrix = false; member.velocity = { x: 0, y: 0, z: 0 }; member.targetPosition = null; member.currentPath = [];
      }
      const gesture: TempleDefenseGesture = { role, phase: breach?.phase === 'ready' ? 'standing' : breach?.phase ?? (role === actor.id && seal.mount !== undefined ? 'mounting' : 'standing'),
        elapsed: breach?.elapsed ?? seal.elapsed ?? 0, mount: role === actor.id ? seal.mount : undefined, turn: seal.mount === undefined ? 0 : seal.turns[seal.mount],
        grip: Math.min(1, (seal.gripAge ?? 0) / TEMPLE_DEFENSE.reach) };
      member.currentAction = { type: 'idle', parameters: { resolved: true, player: role === actor.id, templeDefense: gesture }, startedAt: tick, duration: 1e9, progress: 0 };
    }
    if (templeDefenseLocked(seal, breach)) journey.checkpoint = { ...actor.position };
    journey.lastText = templeDefenseText(seal, breach);
    return templeDefenseLocked(seal, breach);
  }
  command(actor: AgentState, target: string, tick: number): string | undefined {
    if (!this.active(actor)) return;
    this.frame(actor, 0, tick);
    const journey = this.journey!, seal = journey.templeSeal!, breach = journey.scene === 'm3_temple_breach' ? journey.templeBreach : undefined;
    if (target === 'retry') {
      if (seal.phase === 'failed' && !breach) {
        journey.templeSeal = newTempleDefense(tick, seal.attempts + 1); journey.step = 0;
        actor.status = 'alive'; actor.health = actor.maxHealth; actor.activeEffects = [];
        actor.position = filmEntry(FILM_SCENE_BY_ID.m3_temple_defense); journey.checkpoint = { ...actor.position };
      } else if (actor.status !== 'alive') { actor.status = 'alive'; actor.health = actor.maxHealth; actor.position = { ...journey.checkpoint }; }
      this.frame(actor, 0, tick); return '已恢复入口检查点。封井、EMP、完成的情节与既有牺牲者保留。';
    }
    if (seal.paused || seal.unavailable || breach?.paused || breach?.unavailable || actor.status !== 'alive') return journey.lastText;
    const scene = FILM_SCENE_BY_ID[journey.scene], step = scene.steps[journey.step];
    if (!step) return undefined;
    if (target !== 'act') return target === 'next' || templeDefenseLocked(seal, breach) ? journey.lastText : undefined;
    if (!filmStepNear(scene, step, actor.position, false, journey)) return '先走到当前炮位或指挥位置，再按 G。';
    if (breach && journey.step === 1 && breach.phase === 'ready') { breach.phase = 'orders'; breach.elapsed = 0; }
    else if (!breach && [1, 2].includes(journey.step) && seal.phase === 'running' && seal.mount === undefined) { seal.mount = journey.step - 1 as 0 | 1; seal.gripAge = 0; }
    this.frame(actor, 0, tick); return journey.lastText;
  }
}
