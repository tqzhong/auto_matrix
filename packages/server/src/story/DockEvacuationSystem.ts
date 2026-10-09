import { DOCK_EVACUATION, SHAFT_SEAL, FILM_SETS, FILM_SCENE_BY_ID, dockEvacuationActive, shaftSealActive,
  dockEvacuationLocked, shaftSealLocked, dockEvacuationLift, dockEvacuationRoot, dockEvacuationText, shaftSealText,
  filmPosition, filmStepNear, type AgentState, type DockEvacuation, type SandboxState } from '@auto_matrix/shared';
import type { WorldState } from '../world/WorldState.js';

export class DockEvacuationSystem {
  onAdvance?: (text: string, actor: AgentState, tick: number) => void;
  constructor(private world: WorldState, private sandbox: () => SandboxState) {}
  private get journey() { return this.sandbox().neoLife?.journey; }
  active(actor: AgentState): boolean { return this.journey?.actor === actor.id && (dockEvacuationActive(this.journey) || shaftSealActive(this.journey)); }
  clear(): void {
    this.sandbox().structures = this.sandbox().structures.filter(s => !s.id.startsWith('film:evacuation:'));
    for (const actor of this.world.agents.values()) if (!actor.controller && (actor.currentAction?.parameters.dockEvacuation || actor.currentAction?.parameters.shaftSeal)) actor.currentAction = null;
  }
  private lift(state: DockEvacuation): void {
    this.sandbox().structures = this.sandbox().structures.filter(s => !s.id.startsWith('film:evacuation:'));
    const position = filmPosition('film_zion_dock_exit', DOCK_EVACUATION.lift.x, DOCK_EVACUATION.lift.z);
    position.y += dockEvacuationLift(state);
    this.sandbox().structures.push({ id: 'film:evacuation:floor', kind: 'barricade', owner: 'zion', position, matrix: false, health: 999,
      film: { scene: 'm3_dock_evacuation', width: DOCK_EVACUATION.lift.width, depth: DOCK_EVACUATION.lift.depth, height: 0 } });
    if (['closing', 'lowering', 'clear'].includes(state.phase)) this.sandbox().structures.push({ id: 'film:evacuation:gate', kind: 'barricade', owner: 'zion',
      position: { ...position, z: position.z + DOCK_EVACUATION.lift.depth / 2 }, matrix: false, health: 999,
      film: { scene: 'm3_dock_evacuation', width: DOCK_EVACUATION.lift.width, depth: .18, height: DOCK_EVACUATION.lift.height } });
  }
  frame(actor: AgentState, dt: number, tick: number, held = false): boolean {
    if (!this.active(actor)) return false;
    const journey = this.journey!, evacuation = dockEvacuationActive(journey);
    const state = evacuation ? journey.dockEvacuation ??= { phase: 'supplies', elapsed: 0, crewAge: 0, remaining: DOCK_EVACUATION.retreatSeconds, attempts: 0, delivered: false }
      : journey.shaftSeal ??= { phase: 'ready', elapsed: 0, turn: 0 };
    delete journey.started;
    const cast = evacuation ? DOCK_EVACUATION.cast : SHAFT_SEAL.cast;
    const occupied = cast.find(id => id !== actor.id && this.world.agents.get(id)?.status === 'alive' && this.world.agents.get(id)?.controller);
    const unavailable = cast.find(id => id !== actor.id && this.world.agents.get(id)?.status !== 'alive');
    state.paused = occupied ? this.world.agents.get(occupied)!.name : undefined;
    state.unavailable = unavailable ? this.world.agents.get(unavailable)?.name ?? unavailable : !evacuation && journey.dockEvacuation?.phase !== 'clear' ? '最后一班升降梯' : undefined;
    const elapsed = !state.paused && !state.unavailable && actor.controller && actor.status === 'alive' ? Math.max(0, Math.min(.1, dt)) : 0;
    if (evacuation) this.evacuate(actor, elapsed, tick);
    else this.seal(actor, elapsed, tick, held);
    journey.lastText = evacuation ? dockEvacuationText(journey.dockEvacuation) : shaftSealText(journey.shaftSeal);
    return evacuation ? dockEvacuationLocked(journey.dockEvacuation) : shaftSealLocked(journey.shaftSeal);
  }
  private evacuate(actor: AgentState, dt: number, tick: number): void {
    const journey = this.journey!, state = journey.dockEvacuation!, center = FILM_SETS.film_zion_dock_exit.center;
    const locked = dockEvacuationLocked(state);
    if (!locked) state.approach = { x: actor.position.x - center.x, z: actor.position.z - center.z, yaw: actor.rotation };
    const durations = { lifting: DOCK_EVACUATION.cargoSeconds, depositing: DOCK_EVACUATION.cargoSeconds, wind: 3.6, order: 3.4,
      closing: DOCK_EVACUATION.lift.closing, lowering: DOCK_EVACUATION.lift.seconds };
    const duration = durations[state.phase as keyof typeof durations];
    if (duration) {
      state.elapsed = Math.min(duration, state.elapsed + dt);
      if (state.elapsed >= duration) {
        const previous = state.phase;
        state.phase = ({ lifting: 'carrying', depositing: 'wind', wind: 'order', order: 'running', closing: 'lowering', lowering: 'clear' } as const)[previous as keyof typeof durations];
        state.elapsed = 0;
        if (previous === 'depositing') state.delivered = true;
        if (previous === 'lifting' || previous === 'depositing' || previous === 'lowering') this.onAdvance?.(dockEvacuationText(state), actor, tick);
      }
    }
    if (state.phase === 'running' || state.phase === 'waiting') {
      state.crewAge = Math.min(DOCK_EVACUATION.crewSeconds, state.crewAge + dt);
      if (state.phase === 'running') {
        state.remaining = Math.max(0, state.remaining - dt);
        if (filmStepNear(FILM_SCENE_BY_ID.m3_dock_evacuation, FILM_SCENE_BY_ID.m3_dock_evacuation.steps[2], actor.position, false, journey)) {
          state.phase = 'waiting'; this.onAdvance?.(dockEvacuationText(state), actor, tick);
        } else if (state.remaining === 0) state.phase = 'failed';
      }
    }
    for (const role of DOCK_EVACUATION.cast) {
      const member = this.world.agents.get(role);
      if (!member || member.status !== 'alive' || member.controller && role !== actor.id) continue;
      if (role !== actor.id || dockEvacuationLocked(state)) {
        const pose = dockEvacuationRoot(state, role);
        member.position = filmPosition('film_zion_dock_exit', pose.x, pose.z); member.position.y += pose.y; member.rotation = pose.yaw;
        member.currentLocation = 'film_zion_dock_exit'; member.isInMatrix = false; member.targetPosition = null; member.currentPath = [];
      }
      const moving = role === 'colt' && state.crewAge > 0 && state.crewAge < DOCK_EVACUATION.crewSeconds;
      if (role !== actor.id || dockEvacuationLocked(state)) member.velocity = { x: moving ? -.83 : 0, y: 0, z: moving ? -1.8 : 0 };
      member.currentAction = { type: 'idle', parameters: { resolved: true, player: role === actor.id, dockEvacuation: { ...state, role } }, startedAt: tick, duration: 1e9, progress: 0 };
    }
    this.lift(state);
    if (dockEvacuationLocked(state) && state.phase !== 'failed') journey.checkpoint = { ...actor.position };
  }
  private seal(actor: AgentState, dt: number, tick: number, held: boolean): void {
    const journey = this.journey!, state = journey.shaftSeal!;
    if (state.phase === 'reaching') {
      state.elapsed = Math.min(SHAFT_SEAL.reach, state.elapsed + dt);
      if (state.elapsed >= SHAFT_SEAL.reach) { state.phase = 'armed'; state.elapsed = 0; }
    } else if ((state.phase === 'armed' || state.phase === 'throwing') && held && dt) {
      state.phase = 'throwing'; state.turn = Math.min(1, state.turn + dt / SHAFT_SEAL.throwing);
      if (state.turn >= 1) { state.phase = 'detonating'; state.firedAt = tick; state.elapsed = 0; }
    } else if (state.phase === 'detonating') {
      state.elapsed = Math.min(SHAFT_SEAL.blast, state.elapsed + dt);
      if (state.elapsed >= SHAFT_SEAL.blast) { state.phase = 'done'; this.onAdvance?.(shaftSealText(state), actor, tick); }
    }
    for (const role of SHAFT_SEAL.cast) {
      const member = this.world.agents.get(role);
      if (!member || member.status !== 'alive' || member.controller && role !== actor.id) continue;
      if (role !== actor.id || shaftSealLocked(state)) {
        const point = role === 'citizen_15' ? { ...SHAFT_SEAL.operator, yaw: Math.PI } : { x: role === 'lock' ? -7 : -11, z: 0, yaw: Math.PI };
        member.position = filmPosition('film_zion_command_bunker', point.x, point.z); member.rotation = point.yaw;
        member.currentLocation = 'film_zion_command_bunker'; member.isInMatrix = false; member.targetPosition = null; member.currentPath = []; member.velocity = { x: 0, y: 0, z: 0 };
      }
      member.currentAction = { type: 'idle', parameters: { resolved: true, player: role === actor.id, shaftSeal: { ...state, role } }, startedAt: tick, duration: 1e9, progress: 0 };
    }
    if (shaftSealLocked(state)) journey.checkpoint = { ...actor.position };
    if (dt && journey.step === 0 && filmStepNear(FILM_SCENE_BY_ID.m3_shaft_seal, FILM_SCENE_BY_ID.m3_shaft_seal.steps[0], actor.position, false, journey)) this.onAdvance?.(shaftSealText(state), actor, tick);
  }
  command(actor: AgentState, target: string, tick: number): string | undefined {
    if (!this.active(actor)) return;
    this.frame(actor, 0, tick);
    const journey = this.journey!, evacuation = dockEvacuationActive(journey), state = evacuation ? journey.dockEvacuation! : journey.shaftSeal!;
    if (target === 'retry') {
      if (actor.status !== 'alive') { actor.status = 'alive'; actor.health = actor.maxHealth; }
      if (evacuation && journey.dockEvacuation!.phase === 'failed') {
        const saved = journey.dockEvacuation!;
        saved.phase = 'running'; saved.remaining = DOCK_EVACUATION.retreatSeconds; saved.crewAge = 0; saved.elapsed = 0; saved.attempts++;
        journey.step = 2; actor.position = filmPosition('film_zion_dock_exit', DOCK_EVACUATION.delivery.x, DOCK_EVACUATION.delivery.z);
        saved.approach = { ...DOCK_EVACUATION.delivery, yaw: Math.PI };
      } else actor.position = { ...journey.checkpoint };
      actor.velocity = { x: 0, y: 0, z: 0 }; this.frame(actor, 0, tick);
      return '已接回保存的操作位置。已搬下的补给、EMP、起爆进度与既有牺牲者保留。';
    }
    if (state.paused || state.unavailable || actor.status !== 'alive') return journey.lastText;
    if (evacuation && state.phase === 'clear' && (target === 'next' || target === 'act')) return undefined;
    if (target !== 'act') return (evacuation ? dockEvacuationLocked(journey.dockEvacuation) : shaftSealLocked(journey.shaftSeal)) ? journey.lastText : undefined;
    const scene = FILM_SCENE_BY_ID[journey.scene], step = scene.steps[journey.step];
    if (!step || step.kind === 'reflect') return undefined;
    if (!filmStepNear(scene, step, actor.position, false, journey)) return '先走到当前操作点，再按 G。';
    if (evacuation) {
      const saved = journey.dockEvacuation!, center = FILM_SETS[scene.set].center;
      if (saved.phase === 'supplies' || saved.phase === 'carrying') {
        saved.approach = { x: actor.position.x - center.x, z: actor.position.z - center.z, yaw: Math.PI };
        saved.phase = saved.phase === 'supplies' ? 'lifting' : 'depositing'; saved.elapsed = 0;
      } else if (saved.phase === 'waiting' && saved.crewAge >= DOCK_EVACUATION.crewSeconds) { saved.phase = 'closing'; saved.elapsed = 0; }
    } else if (journey.step === 1 && journey.shaftSeal!.phase === 'ready') { journey.shaftSeal!.phase = 'reaching'; journey.shaftSeal!.elapsed = 0; }
    this.frame(actor, 0, tick); return journey.lastText;
  }
}
