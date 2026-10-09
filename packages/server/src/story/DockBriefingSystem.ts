import { DOCK_BRIEFING, FILM_SETS, FILM_SCENE_BY_ID, dockBriefingActive, dockBriefingLocked, dockBriefingRoot,
  dockBriefingGate, dockBriefingLift, dockBriefingText, filmPosition, filmStepNear, type AgentState, type DockBriefing, type SandboxState } from '@auto_matrix/shared';
import type { WorldState } from '../world/WorldState.js';

export class DockBriefingSystem {
  onAdvance?: (text: string, actor: AgentState, tick: number) => void;
  constructor(private world: WorldState, private sandbox: () => SandboxState) {}
  private get journey() { return this.sandbox().neoLife?.journey; }
  active(actor: AgentState): boolean { return dockBriefingActive(this.journey) && this.journey!.actor === actor.id; }
  clear(): void {
    this.sandbox().structures = this.sandbox().structures.filter(s => !s.id.startsWith('film:briefing:'));
    for (const actor of this.world.agents.values()) if (!actor.controller && actor.currentAction?.parameters.dockBriefing) actor.currentAction = null;
  }
  private lift(state: DockBriefing): void {
    this.sandbox().structures = this.sandbox().structures.filter(s => !s.id.startsWith('film:briefing:'));
    const position = filmPosition('film_zion_personnel', DOCK_BRIEFING.lift.x, DOCK_BRIEFING.lift.z); position.y += dockBriefingLift(state);
    this.sandbox().structures.push({ id: 'film:briefing:floor', kind: 'barricade', owner: 'zion', position, matrix: false, health: 999,
      film: { scene: 'm3_dock_briefing', width: DOCK_BRIEFING.lift.width, depth: DOCK_BRIEFING.lift.depth, height: 0 } });
    if (dockBriefingGate(state) < .99) this.sandbox().structures.push({ id: 'film:briefing:gate', kind: 'barricade', owner: 'zion',
      position: { ...position, z: FILM_SETS.film_zion_personnel.center.z + DOCK_BRIEFING.lift.gateZ }, matrix: false, health: 999,
      film: { scene: 'm3_dock_briefing', width: DOCK_BRIEFING.lift.width, depth: .3, height: DOCK_BRIEFING.lift.height } });
  }
  frame(actor: AgentState, dt: number, tick: number): boolean {
    if (!this.active(actor)) return false;
    const journey = this.journey!, state = journey.dockBriefing ??= { phase: journey.step >= 5 ? 'done' : 'ready', elapsed: 0, escort: 0 };
    delete journey.started;
    const occupied = DOCK_BRIEFING.cast.find(id => id !== actor.id && this.world.agents.get(id)?.status === 'alive' && this.world.agents.get(id)?.controller);
    state.paused = occupied ? this.world.agents.get(occupied)!.name : undefined;
    const unavailable = DOCK_BRIEFING.cast.find(id => id !== actor.id && this.world.agents.get(id)?.status !== 'alive');
    state.unavailable = unavailable ? this.world.agents.get(unavailable)?.name ?? unavailable : undefined;
    if (occupied || unavailable) {
      this.lift(state);
      actor.currentAction = { type: 'idle', parameters: { resolved: true, player: true, dockBriefing: { ...state, role: actor.id } }, startedAt: tick, duration: 1e9, progress: 0 };
      journey.lastText = dockBriefingText(state); return true;
    }
    const elapsed = actor.controller && actor.status === 'alive' ? Math.max(0, Math.min(.1, dt)) : 0;
    if (journey.step >= 4 && state.phase === 'reflection') state.phase = 'return';
    const duration = ({ lowering: DOCK_BRIEFING.lift.seconds, gate: DOCK_BRIEFING.lift.opening,
      greeting: 4.8, answer: 2.4, roland: 3.4, warning: 7 } as Partial<Record<typeof state.phase, number>>)[state.phase];
    if (duration) {
      state.elapsed = Math.min(duration, state.elapsed + elapsed);
      if (state.elapsed >= duration) {
        const previous = state.phase;
        state.phase = ({ lowering: 'gate', gate: 'walking', greeting: 'reply', answer: 'roland', roland: 'warning', warning: 'reflection' } as const)[previous as 'lowering' | 'gate' | 'greeting' | 'answer' | 'roland' | 'warning'];
        state.elapsed = 0;
        if (previous === 'gate' || previous === 'warning') this.onAdvance?.(dockBriefingText(state), actor, tick);
      }
    }
    const center = FILM_SETS.film_zion_personnel.center;
    if (state.phase === 'walking' && actor.position.z < center.z + DOCK_BRIEFING.lift.gateZ - 1.3)
      state.escort = Math.min(DOCK_BRIEFING.escortSeconds, state.escort + elapsed);
    const locked = dockBriefingLocked(state);
    for (const role of DOCK_BRIEFING.cast) {
      const member = this.world.agents.get(role);
      if (!member || member.status !== 'alive' || member.controller && role !== actor.id) continue;
      if (role !== actor.id || locked) {
        const pose = dockBriefingRoot(state, role);
        member.position = filmPosition('film_zion_personnel', pose.x, pose.z); member.position.y += pose.y; member.rotation = pose.yaw;
        member.currentLocation = 'film_zion_personnel'; member.isInMatrix = false;
        const escorting = role !== 'lock' && role !== actor.id && state.phase === 'walking' && state.escort > 0 && state.escort < DOCK_BRIEFING.escortSeconds;
        member.velocity = escorting ? { x: (role === 'morpheus' ? -1 : 1) * 1.1 / DOCK_BRIEFING.escortSeconds, y: 0, z: -13.4 / DOCK_BRIEFING.escortSeconds } : { x: 0, y: 0, z: 0 };
        member.targetPosition = null; member.currentPath = [];
      }
      member.currentAction = { type: 'idle', parameters: { resolved: true, player: role === actor.id, dockBriefing: { ...state, role } }, startedAt: tick, duration: 1e9, progress: 0 };
    }
    this.lift(state);
    if (locked) journey.checkpoint = { ...actor.position };
    const scene = FILM_SCENE_BY_ID.m3_dock_briefing, step = scene.steps[journey.step];
    if (elapsed && step?.kind === 'reach' && filmStepNear(scene, step, actor.position, actor.isInMatrix, journey)
      && (journey.step !== 1 || state.escort >= DOCK_BRIEFING.escortSeconds)) {
      if (journey.step === 4) state.phase = 'done';
      this.onAdvance?.(dockBriefingText(state), actor, tick);
    }
    journey.lastText = dockBriefingText(state);
    return locked;
  }
  command(actor: AgentState, target: string, tick: number): string | undefined {
    if (!this.active(actor)) return;
    this.frame(actor, 0, tick);
    const journey = this.journey!, state = journey.dockBriefing!;
    if (target === 'retry') {
      if (actor.status !== 'alive') { actor.status = 'alive'; actor.health = actor.maxHealth; }
      actor.position = { ...journey.checkpoint }; actor.velocity = { x: 0, y: 0, z: 0 };
      this.frame(actor, 0, tick); return state.paused || state.unavailable ? dockBriefingText(state) : '已接回保存的简报位置。EMP、船长伤势与船坞牺牲者保持不变。';
    }
    if (state.paused || state.unavailable) return dockBriefingText(state);
    if (target !== 'act') return dockBriefingLocked(state) ? dockBriefingText(state) : undefined;
    if (state.phase === 'ready') { state.phase = 'lowering'; state.elapsed = 0; }
    else if (journey.step === 2 && (state.phase === 'walking' || state.phase === 'reply')) {
      const center = FILM_SETS.film_zion_personnel.center;
      if (!filmStepNear(FILM_SCENE_BY_ID.m3_dock_briefing, FILM_SCENE_BY_ID.m3_dock_briefing.steps[2], actor.position, actor.isInMatrix, journey))
        return '先走近 Lock，再回应他的质问。';
      state.approach = { x: actor.position.x - center.x, z: actor.position.z - center.z, yaw: Math.atan2(center.x - actor.position.x, center.z - 4 - actor.position.z) };
      state.phase = state.phase === 'reply' ? 'answer' : 'greeting'; state.elapsed = 0;
    }
    this.frame(actor, 0, tick); return journey.lastText;
  }
}
