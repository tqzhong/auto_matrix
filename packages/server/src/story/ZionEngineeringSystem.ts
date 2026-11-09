import { ZION_ENGINEERING, ZION_CAST, FILM_SETS, FILM_SCENE_BY_ID, engineeringActive, engineeringText, newEngineering, filmPosition, distance,
  type AgentState, type SandboxState, type EngineeringEncounter, type FilmJourney } from '@auto_matrix/shared';
import type { WorldState } from '../world/WorldState.js';

export function savedEngineeringAction(journey: FilmJourney | undefined, actor: AgentState): boolean {
  const action = actor.currentAction, state = journey?.engineering, gesture = action?.parameters.engineering as EngineeringEncounter | undefined;
  return Boolean(journey && engineeringActive(journey) && journey.actor === actor.id && [1, 2].includes(journey.step)
    && (action?.type === 'idle' || action?.type === 'move_to') && action.parameters.player === true && action.parameters.resolved === true
    && state && gesture && state.operation === (journey.step === 1 ? 'readings' : 'valve') && gesture.operation === state.operation
    && gesture.elapsed === state.elapsed && gesture.readings === state.readings && gesture.valve === state.valve
    && gesture.approach?.x === state.approach?.x && gesture.approach?.z === state.approach?.z && gesture.approach?.yaw === state.approach?.yaw);
}

export class ZionEngineeringSystem {
  onAdvance?: (text: string, actor: AgentState, tick: number) => void;
  constructor(private world: WorldState, private sandbox: () => SandboxState) {}
  private get journey() { return this.sandbox().neoLife?.journey; }
  active(actor: AgentState): boolean { return engineeringActive(this.journey) && actor.id === this.journey!.actor; }
  clear(): void {
    for (const actor of this.world.agents.values()) if (!actor.controller && actor.currentAction?.parameters.engineering) actor.currentAction = null;
  }
  private ensure(actor: AgentState, tick: number): EngineeringEncounter {
    const journey = this.journey!;
    if (!journey.engineering) {
      const state = journey.engineering = newEngineering(journey.step);
      const guide = this.world.agents.get('hamann'), stage = ZION_CAST.m2_hamann.hamann;
      // Migrate only the former idle staging; preserve other saved performances and control.
      if (guide && !guide.controller && guide.status === 'alive' && guide.health > 0 && guide.currentAction === null
        && guide.currentLocation === 'film_zion_engineering' && distance(guide.position, filmPosition('film_zion_engineering', -7, -23)) < .01) {
        guide.position = filmPosition('film_zion_engineering', stage.x, stage.z); guide.rotation = stage.yaw;
      }
      if (journey.started !== undefined && (journey.step === 1 || journey.step === 2)) {
        const kind = journey.step === 1 ? 'readings' : 'valve';
        state[kind] = Math.max(0, Math.min(1, (tick - journey.started) / (ZION_ENGINEERING[kind].seconds * 2)));
      }
      // The former markers sat inside the guard rail, outside the control stance.
      const center = FILM_SETS.film_zion_engineering.center;
      if (!actor.controller && actor.currentLocation === 'film_zion_engineering' && Math.abs(actor.position.x - center.x) >= 7.8) {
        actor.position.x = center.x + Math.sign(actor.position.x - center.x) * ZION_ENGINEERING.valve.x;
        journey.checkpoint = { ...actor.position };
      }
    }
    delete journey.started;
    return journey.engineering;
  }
  private begin(actor: AgentState, kind: 'readings' | 'valve'): void {
    const journey = this.journey!, state = journey.engineering!, center = FILM_SETS.film_zion_engineering.center;
    state.operation = kind; state.elapsed = 0;
    state.approach = { x: actor.position.x - center.x, z: actor.position.z - center.z, yaw: actor.rotation };
    journey.checkpoint = { ...actor.position };
  }
  frame(actor: AgentState, dt: number, tick: number, held = false, moving = false): boolean {
    if (!this.active(actor)) return false;
    const journey = this.journey!, state = this.ensure(actor, tick);
    if (dt === 0) return Boolean(state.operation);
    if (![1, 2].includes(journey.step)) return false;
    const kind = journey.step === 1 ? 'readings' : 'valve', point = ZION_ENGINEERING[kind];
    const near = !actor.isInMatrix && actor.currentLocation === FILM_SCENE_BY_ID.m2_hamann.set
      && distance(actor.position, filmPosition('film_zion_engineering', point.x, point.z)) <= ZION_ENGINEERING.radius;
    if (!state.operation && kind === 'valve' && held && !moving && near) this.begin(actor, kind);
    if (state.operation && (moving || !near || actor.status !== 'alive' || !actor.controller || kind === 'valve' && !held)) {
      if (state.operation === 'readings') state.readings = 0;
      delete state.operation; delete state.approach; state.elapsed = 0;
      if (actor.currentAction?.parameters.engineering) actor.currentAction = null;
      journey.lastText = engineeringText(state, journey.step); return false;
    }
    if (!state.operation) { journey.lastText = engineeringText(state, journey.step); return false; }
    const elapsed = Math.max(0, Math.min(.1, dt)), before = state.elapsed;
    state.elapsed += elapsed;
    const work = Math.max(0, state.elapsed - ZION_ENGINEERING.approachSeconds) - Math.max(0, before - ZION_ENGINEERING.approachSeconds);
    state[kind] = Math.min(1, state[kind] + work / point.seconds);
    const amount = Math.min(1, state.elapsed / ZION_ENGINEERING.approachSeconds), blend = amount * amount * (3 - 2 * amount), start = state.approach!;
    const previous = actor.position;
    actor.position = filmPosition('film_zion_engineering', start.x + (point.x - start.x) * blend, start.z + (point.z - start.z) * blend);
    actor.rotation = start.yaw + Math.atan2(Math.sin(point.yaw - start.yaw), Math.cos(point.yaw - start.yaw)) * blend;
    actor.velocity = { x: (actor.position.x - previous.x) / elapsed, y: 0, z: (actor.position.z - previous.z) / elapsed };
    actor.currentAction = { type: amount < 1 ? 'move_to' : 'idle', parameters: { player: true, resolved: true, engineering: { ...state, approach: { ...start } } },
      startedAt: journey.enteredAt, duration: 1e9, progress: 0 };
    journey.lastText = engineeringText(state, journey.step);
    if (state[kind] >= 1) {
      delete state.operation; delete state.approach; state.elapsed = 0; actor.currentAction = null; actor.velocity = { x: 0, y: 0, z: 0 };
      this.onAdvance?.(kind === 'readings' ? '控制台显示空气流量 96%、回收水 68%、供热 74%；备用循环尚未平衡。'
        : '手轮带动备用阀，回收水恢复到 96%，供热恢复到 94%。维护回路已恢复平衡。', actor, tick);
      return false;
    }
    return true;
  }
  command(actor: AgentState, target: string, tick: number): string | undefined {
    if (!this.active(actor) || ![1, 2].includes(this.journey!.step)) return;
    const journey = this.journey!, state = this.ensure(actor, tick), kind = journey.step === 1 ? 'readings' : 'valve', point = ZION_ENGINEERING[kind];
    if (target === 'retry') {
      actor.status = 'alive'; actor.health = actor.maxHealth; actor.position = { ...journey.checkpoint }; actor.velocity = { x: 0, y: 0, z: 0 }; actor.currentAction = null;
      if (state.operation === 'readings') state.readings = 0;
      delete state.operation; delete state.approach; state.elapsed = 0;
      return journey.lastText = '已接回栈桥控制位；已确认的读数、阀门角度和之前的选择保留。';
    }
    if (target !== 'act') return;
    if (actor.isInMatrix || actor.currentLocation !== 'film_zion_engineering'
      || distance(actor.position, filmPosition('film_zion_engineering', point.x, point.z)) > ZION_ENGINEERING.radius)
      return kind === 'readings' ? '先走到左侧控制台的读数台前，再按 G。' : '先走到栈桥右侧控制手轮前，再按住 G。';
    if (!state.operation) this.begin(actor, kind);
    return journey.lastText = engineeringText(state, journey.step);
  }
}
