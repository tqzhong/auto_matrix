import { HEL_GARAGE, FILM_SETS, FILM_SCENE_BY_ID, filmPosition, distance, newHelGarage, helGarageActive, helGarageLocked,
  helGarageRoot, helGarageText, type HelGarageEncounter, type AgentState, type SandboxState, type CombatImpact } from '@auto_matrix/shared';
import type { WorldState } from '../world/WorldState.js';

/** The entrance is a saved, non-lethal group encounter, separate from gunfire downstairs. */
export class HelGarageSystem {
  onAdvance?: (text: string, actor: AgentState, tick: number) => void;
  onImpact?: (impact: CombatImpact, tick: number) => void;
  constructor(private world: WorldState, private sandbox: () => SandboxState) {}
  private get journey() { return this.sandbox().neoLife?.journey; }
  active(actor: AgentState): boolean { return helGarageActive(this.journey) && this.journey!.actor === actor.id; }
  clear(): void {
    this.sandbox().structures = this.sandbox().structures.filter(item => !item.id.startsWith('film:hel-garage:'));
    for (const member of this.world.agents.values()) if (!member.controller && member.currentAction?.parameters.helGarage) member.currentAction = null;
  }
  private ensure(actor: AgentState): HelGarageEncounter {
    const journey = this.journey!;
    if (!journey.helGarage) {
      journey.helGarage = newHelGarage();
      if (journey.step >= FILM_SCENE_BY_ID.m3_hel_garage.steps.length) journey.helGarage.phase = 'done';
      else if (journey.step > 0) journey.helGarage.phase = 'cleared';
      // Retire only this old generic group, keeping completed scenes and named fates.
      this.sandbox().threats = this.sandbox().threats.filter(item => item.scene !== journey.scene);
      delete journey.started; delete journey.fighting;
    }
    return journey.helGarage;
  }
  private barrier(state: HelGarageEncounter): void {
    const id = 'film:hel-garage:door', door = HEL_GARAGE.door;
    const structures = this.sandbox().structures;
    const horizontal = state.door * Math.PI / 2;
    const width = Math.abs(Math.cos(horizontal)) * door.width + Math.sin(horizontal) * door.thickness;
    const depth = Math.sin(horizontal) * door.width + Math.abs(Math.cos(horizontal)) * door.thickness;
    const position = filmPosition(HEL_GARAGE.set, -door.width / 2 + Math.cos(horizontal) * door.width / 2, door.z - Math.sin(horizontal) * door.width / 2);
    const existing = structures.find(item => item.id === id);
    const data = { id, kind: 'barricade' as const, owner: 'film', health: 1e9, matrix: true, position,
      film: { scene: 'm3_hel_garage', width, depth, height: door.height } };
    if (existing) Object.assign(existing, data); else structures.push(data);
  }
  private cast(actor: AgentState, state: HelGarageEncounter, dt: number, tick: number): void {
    for (const [pair, spot] of HEL_GARAGE.pairs.entries()) {
      const member = this.world.agents.get(spot.role); if (!member || member.status !== 'alive' || member.controller && member !== actor) continue;
      const root = helGarageRoot(state, spot.role, pair);
      if (root && (member !== actor || helGarageLocked(state))) {
        const before = member.position;
        member.position = filmPosition(HEL_GARAGE.set, root.x, root.z); member.rotation = root.yaw;
        member.currentLocation = HEL_GARAGE.set; member.isInMatrix = true; member.targetPosition = null; member.currentPath = [];
        member.velocity = dt ? { x: (member.position.x - before.x) / dt, y: 0, z: (member.position.z - before.z) / dt } : { ...member.velocity };
      } else if (member !== actor && ['cleared', 'exit', 'done'].includes(state.phase) && dt) {
        const destination = state.phase === 'cleared' ? { x: spot.role === 'seraph' ? -2 : -4, z: -26.4 }
          : spot.role === 'seraph' ? { x: -2, z: -34.2 } : { x: -.7, z: -32.3 };
        const to = filmPosition(HEL_GARAGE.set, destination.x, destination.z), before = member.position;
        const gap = Math.hypot(to.x - before.x, to.z - before.z), scale = Math.min(1, dt * 4.8 / Math.max(.001, gap));
        member.position = { x: before.x + (to.x - before.x) * scale, y: before.y, z: before.z + (to.z - before.z) * scale };
        member.velocity = { x: (member.position.x - before.x) / dt, y: 0, z: (member.position.z - before.z) / dt };
        if (gap > .2) member.rotation = Math.atan2(to.x - before.x, to.z - before.z);
      }
      member.currentAction = { type: 'idle', parameters: { resolved: true, player: member === actor,
        helGarage: { phase: state.phase, elapsed: state.elapsed, age: state.age, hits: state.hits, door: state.door, role: spot.role, pair,
          paused: state.paused, unavailable: state.unavailable } }, startedAt: this.journey!.enteredAt, duration: 1e9, progress: 0 };
    }
  }
  frame(actor: AgentState, dt: number, tick: number): boolean {
    if (!this.active(actor)) return false;
    const state = this.ensure(actor);
    state.paused = HEL_GARAGE.cast.filter(id => id !== actor.id).map(id => this.world.agents.get(id)).find(member => member?.controller)?.name;
    state.unavailable = HEL_GARAGE.cast.map(id => this.world.agents.get(id)).find(member => !member || member.status !== 'alive')?.name;
    const elapsed = actor.controller && actor.status === 'alive' && !state.paused && !state.unavailable ? Math.max(0, Math.min(.1, dt)) : 0;
    if (elapsed) {
      state.age += elapsed;
      if (!['ready', 'cleared', 'exit', 'done', 'failed'].includes(state.phase)) state.elapsed += elapsed;
      const next = (phase: HelGarageEncounter['phase']) => { state.phase = phase; state.elapsed = 0; };
      if (state.phase === 'talking' && state.elapsed >= HEL_GARAGE.talking) next('drawing');
      else if (state.phase === 'drawing' && state.elapsed >= HEL_GARAGE.drawing) next('evade');
      else if (state.phase === 'evade' && state.elapsed > HEL_GARAGE.evadeWindow
        || state.phase === 'counter' && state.elapsed > HEL_GARAGE.counterWindow
        || state.phase === 'combo' && state.elapsed > HEL_GARAGE.counterWindow) {
        actor.health = Math.max(1, actor.health - 9); next('failed');
      } else if (state.phase === 'disarming' && state.elapsed >= HEL_GARAGE.disarming) next('combo');
      else if (state.phase === 'striking' && state.elapsed >= HEL_GARAGE.strike) {
        state.hits++; next(state.hits >= 3 ? 'falling' : 'combo');
      } else if (state.phase === 'falling' && state.elapsed >= HEL_GARAGE.falling) {
        next('cleared'); this.onAdvance?.('三名入口守卫倒地，武器留在地上。亲自走到红色拱门的门把。', actor, tick);
      } else if (state.phase === 'opening') {
        state.door = Math.min(1, state.elapsed / HEL_GARAGE.doorSeconds);
        if (state.door >= 1) next('exit');
      }
      if (state.phase === 'exit' && HEL_GARAGE.cast.every(id => {
        const member = this.world.agents.get(id)!;
        return member.position.z < FILM_SETS[HEL_GARAGE.set].center.z - 32 && Math.abs(member.position.x - FILM_SETS[HEL_GARAGE.set].center.x) < 2.5;
      })) {
        next('done'); this.onAdvance?.('Trinity 跨过门槛，三人进入铁笼电梯。', actor, tick);
      }
    }
    this.barrier(state);
    if (!state.paused && !state.unavailable) this.cast(actor, state, elapsed, tick);
    else actor.currentAction = { type: 'idle', parameters: { player: true, resolved: true,
      helGarage: { phase: state.phase, elapsed: state.elapsed, age: state.age, hits: state.hits, door: state.door, role: 'trinity', pair: 2,
        paused: state.paused, unavailable: state.unavailable } }, startedAt: this.journey!.enteredAt, duration: 1e9, progress: 0 };
    this.journey!.lastText = helGarageText(state);
    return helGarageLocked(state);
  }
  command(actor: AgentState, target: string, tick: number): string | undefined {
    if (!this.active(actor)) return;
    this.frame(actor, 0, tick); const state = this.journey!.helGarage!;
    if (state.paused || state.unavailable) return helGarageText(state);
    if (target === 'retry' && state.phase === 'failed') {
      const attempts = state.attempts + 1, approach = state.approach;
      this.journey!.helGarage = { ...newHelGarage(attempts), phase: 'drawing', approach };
      actor.velocity = { x: 0, y: 0, z: 0 }; this.frame(actor, 0, tick); return helGarageText(this.journey!.helGarage);
    }
    if (target !== 'act') return;
    if (state.phase === 'ready') {
      const point = filmPosition(HEL_GARAGE.set, HEL_GARAGE.question.x, HEL_GARAGE.question.z);
      if (distance(actor.position, point) > 1.6) return '走到 Seraph 右后方的标记，按 G 回应守卫。';
      state.approach = { x: actor.position.x - FILM_SETS[HEL_GARAGE.set].center.x, z: actor.position.z - FILM_SETS[HEL_GARAGE.set].center.z, yaw: actor.rotation };
      state.phase = 'talking'; state.elapsed = 0;
    } else if (state.phase === 'cleared') {
      if (distance(actor.position, filmPosition(HEL_GARAGE.set, 2.7, -28.55)) > 1.05) return '靠近拱门右侧的门把，再按 G。';
      state.phase = 'opening'; state.elapsed = 0;
    }
    this.frame(actor, 0, tick); return helGarageText(state);
  }
  action(actor: AgentState, kind: string, tick: number): string | undefined {
    if (!this.active(actor) || kind === 'interact') return;
    this.frame(actor, 0, tick); const state = this.journey!.helGarage!;
    if (state.paused || state.unavailable) return helGarageText(state);
    if (kind === 'dodge' && state.phase === 'evade') { state.phase = 'counter'; state.elapsed = 0; }
    else if (kind === 'attack' && state.phase === 'counter') { state.phase = 'disarming'; state.elapsed = 0; }
    else if (kind === 'attack' && state.phase === 'combo') {
      state.phase = 'striking'; state.elapsed = 0;
      const spot = HEL_GARAGE.pairs[2];
      this.onImpact?.({ source: actor.id, target: 'hel-garage-guard-2', position: { ...filmPosition(HEL_GARAGE.set, spot.x, spot.z), y: FILM_SETS[HEL_GARAGE.set].center.y + 2.6 },
        direction: { x: 0, y: 0, z: -1 }, damage: 0, combo: state.hits + 1, matrix: true, downed: state.hits === 2 }, tick);
    }
    this.frame(actor, 0, tick); return helGarageText(state);
  }
}
