import { UPPER_DIGGER, FILM_SETS, filmPosition, newUpperDigger, upperDiggerActive, upperDiggerLocked, upperDiggerRoot,
  upperDiggerText, stepUpperDigger, type AgentState, type SandboxState, type PlayerInput } from '@auto_matrix/shared';
import type { WorldState } from '../world/WorldState.js';

export class UpperDiggerSystem {
  onAdvance?: (text: string, actor: AgentState, tick: number) => void;
  constructor(private world: WorldState, private sandbox: () => SandboxState) {}
  private get journey() { return this.sandbox().neoLife?.journey; }
  active(actor: AgentState): boolean { return upperDiggerActive(this.journey) && this.journey!.actor === actor.id; }
  private occupied(): boolean { return Boolean(this.world.agents.get('charra')?.controller); }
  stage(tick: number): void {
    const journey = this.journey, state = journey?.upperDigger;
    const body = 'film:upper-digger:body';
    if (!journey || !state || !state.charraDead && (journey.visiting || !['m3_upper_digger', 'm3_dock_battle', 'm3_gate'].includes(journey.scene))) {
      this.sandbox().structures = this.sandbox().structures.filter(s => s.id !== body); return;
    }
    if (!this.sandbox().structures.some(s => s.id === body)) this.sandbox().structures.push({ id: body, kind: 'barricade', owner: 'zion', matrix: false, health: 999,
      position: filmPosition('film_zion_hangar', UPPER_DIGGER.machine.x, UPPER_DIGGER.machine.z), film: { scene: 'm3_upper_digger', width: 38, depth: 38, height: 41 } });
    for (const role of ['zee', 'charra'] as const) {
      const actor = this.world.agents.get(role)!;
      if (role === 'charra' && actor.controller || role === 'zee' && (journey.visiting || journey.scene !== 'm3_upper_digger' || journey.actor !== role || !upperDiggerLocked(state))) continue;
      const point = upperDiggerRoot(state, role);
      actor.position = filmPosition('film_zion_hangar', point.x, point.z); actor.position.y += point.y; actor.rotation = point.yaw;
      actor.currentLocation = 'film_zion_hangar'; actor.isInMatrix = false;
      actor.velocity = { x: 0, y: 0, z: 0 }; actor.targetPosition = null; actor.currentPath = [];
      if (role === 'charra' && state.charraDead) { actor.status = 'dead'; actor.health = 0; }
      const previous = actor.currentAction;
      actor.currentAction = { type: 'idle', parameters: { resolved: true, upperDigger: { ...state, role } },
        startedAt: role === 'charra' && state.charraDead && previous?.parameters.upperDigger ? previous.startedAt : tick, duration: 1e9, progress: 0 };
    }
  }
  frame(actor: AgentState, dt: number, tick: number, input: Partial<PlayerInput> = {}): boolean {
    if (!this.active(actor)) { if (dt === 0) this.stage(tick); return false; }
    const journey = this.journey!, state = journey.upperDigger ??= newUpperDigger(); delete journey.started;
    if (this.occupied()) { journey.lastText = 'Charra 正由另一位玩家控制，上层通道的进度保持不变。'; return true; }
    if (actor.controller && actor.status === 'alive') stepUpperDigger(state, dt, input);
    this.stage(tick); journey.lastText = upperDiggerText(state);
    if (upperDiggerLocked(state)) journey.checkpoint = { ...actor.position };
    if (state.phase === 'done') {
      actor.position = filmPosition('film_zion_hangar', UPPER_DIGGER.ladder.x, UPPER_DIGGER.ladder.z);
      actor.currentAction = null; journey.checkpoint = { ...actor.position };
      this.onAdvance?.(upperDiggerText(state), actor, tick);
    }
    return upperDiggerLocked(state);
  }
  handle(actor: AgentState, kind: string): string | undefined {
    if (this.active(actor) && ['attack', 'shoot', 'dodge', 'ability', 'ability2', 'travel'].includes(kind)) return upperDiggerText(this.journey!.upperDigger);
  }
  command(actor: AgentState, target: string, tick: number): string {
    const journey = this.journey!, state = journey.upperDigger ??= newUpperDigger();
    if (this.occupied()) return 'Charra 正由另一位玩家控制，上层通道的进度保持不变。';
    if (target === 'retry' && (state.phase === 'failed' || actor.status !== 'alive')) {
      Object.assign(state, { phase: state.charraDead ? 'escape' : 'ready', climb: UPPER_DIGGER.height, crawl: UPPER_DIGGER.crawlLength,
        retreat: state.charraDead ? 7 : 0, grip: 0, slip: 0, elapsed: 0, remaining: UPPER_DIGGER.escapeLimit, attempts: state.attempts + 1 });
      actor.status = 'alive'; actor.health = actor.maxHealth; actor.activeEffects = [];
    } else if (target === 'act') {
      if (state.phase === 'approach') {
        const center = FILM_SETS.film_zion_hangar.center, ladder = UPPER_DIGGER.ladder;
        if (Math.hypot(actor.position.x - center.x - ladder.x, actor.position.z - center.z - ladder.z) > 1.5 || Math.abs(actor.position.y - center.y) > .3)
          return '先走到侧壁维修梯旁，再按 G。';
        state.phase = 'climbing';
      } else if (state.phase === 'ready') state.phase = 'bracing';
      else if (state.phase === 'hatch') state.phase = 'dismounting';
      state.elapsed = 0;
    }
    delete journey.started; this.stage(tick); journey.checkpoint = { ...actor.position };
    return journey.lastText = upperDiggerText(state);
  }
}
