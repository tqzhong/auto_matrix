import { SOURCE_BRIEFING, FILM_SCENE_BY_ID, filmEntry, filmPosition, distance,
  sourceBriefingActive, sourceBriefingLocked, sourceBriefingTarget, sourceBriefingText, type AgentState, type SandboxState } from '@auto_matrix/shared';
import type { WorldState } from '../world/WorldState.js';

export class SourceBriefingSystem {
  onAdvance?: (text: string, actor: AgentState, tick: number) => void;
  constructor(private world: WorldState, private sandbox: () => SandboxState) {}
  private get journey() { return this.sandbox().neoLife?.journey; }
  active(actor: AgentState): boolean { return sourceBriefingActive(this.journey) && actor.id === this.journey!.actor; }
  clear(): void {
    for (const actor of this.world.agents.values())
      if (!actor.controller && actor.currentAction?.parameters.sourceBriefing) actor.currentAction = null;
  }
  frame(actor: AgentState, dt: number, tick: number): boolean {
    if (!this.active(actor)) return false;
    const journey = this.journey!, scene = FILM_SCENE_BY_ID.m2_plan;
    const state = journey.sourceBriefing ??= { phase: journey.step >= 2 ? 'done' : journey.step === 1 ? 'reflection' : 'review',
      elapsed: 0, reviewed: journey.step > 0 ? SOURCE_BRIEFING.routes.map(route => route.id) : [] };
    // Correct an old ship checkpoint once; never move somebody else's character.
    if (actor.currentLocation === 'film_neb_deck') {
      actor.position = filmEntry(scene); actor.currentLocation = scene.set; actor.isInMatrix = true;
      actor.velocity = { x: 0, y: 0, z: 0 }; journey.checkpoint = { ...actor.position };
    }
    delete journey.started;
    const occupied = SOURCE_BRIEFING.cast.find(id => id !== actor.id && this.world.agents.get(id)?.controller);
    const unavailable = SOURCE_BRIEFING.cast.find(id => this.world.agents.get(id)?.status !== 'alive');
    state.paused = occupied ? this.world.agents.get(occupied)!.name : undefined;
    state.unavailable = unavailable ? this.world.agents.get(unavailable)?.name ?? unavailable : undefined;
    const elapsed = !occupied && !unavailable && actor.controller ? Math.max(0, Math.min(.1, dt)) : 0;
    if (state.phase === 'hearing' || state.phase === 'captains') {
      const duration = state.phase === 'hearing' ? SOURCE_BRIEFING.hearingSeconds : SOURCE_BRIEFING.captainsSeconds;
      state.elapsed = Math.min(duration, state.elapsed + elapsed);
      if (state.elapsed >= duration) {
        if (state.phase === 'hearing') {
          if (state.selected && !state.reviewed.includes(state.selected)) state.reviewed.push(state.selected);
          delete state.selected; state.phase = state.reviewed.length === 3 ? 'question' : 'review';
        } else {
          state.phase = 'reflection'; this.onAdvance?.(sourceBriefingText(state), actor, tick);
        }
        state.elapsed = 0;
      }
    }
    if (journey.step >= 2) state.phase = 'done';
    for (const role of SOURCE_BRIEFING.cast) {
      const member = this.world.agents.get(role);
      if (!member || member.status !== 'alive' || member.controller && role !== actor.id || role === 'neo') continue;
      const root = SOURCE_BRIEFING.roots[role];
      member.position = filmPosition(scene.set, root.x, root.z); member.position.y += root.y; member.rotation = root.yaw;
      member.currentLocation = scene.set; member.isInMatrix = true; member.targetPosition = null; member.currentPath = [];
      member.velocity = { x: 0, y: 0, z: 0 };
      member.currentAction = { type: 'idle', parameters: { resolved: true, sourceBriefing: { ...state, reviewed: [...state.reviewed], role }, seated: role === 'keymaker' },
        startedAt: journey.enteredAt, duration: 1e9, progress: 0 };
    }
    journey.lastText = sourceBriefingText(state);
    return sourceBriefingLocked(state);
  }
  command(actor: AgentState, target: string, tick: number): string | undefined {
    if (!this.active(actor)) return;
    this.frame(actor, 0, tick);
    const journey = this.journey!, state = journey.sourceBriefing!;
    if (target === 'retry') {
      if (actor.status !== 'alive') { actor.status = 'alive'; actor.health = actor.maxHealth; }
      actor.position = { ...journey.checkpoint }; actor.velocity = { x: 0, y: 0, z: 0 };
      this.frame(actor, 0, tick); return '已接回会议检查点，已核对的路线、钥匙匠伤势与哲学选择保留。';
    }
    if (state.paused || state.unavailable || sourceBriefingLocked(state)) return sourceBriefingText(state);
    if (target !== 'act' || journey.step > 0) return;
    const point = sourceBriefingTarget(state), position = filmPosition(FILM_SCENE_BY_ID.m2_plan.set, point.x, point.z);
    if (!actor.isInMatrix || actor.currentLocation !== FILM_SCENE_BY_ID.m2_plan.set || distance(actor.position, position) > 1.6)
      return state.phase === 'question' ? '先走到钥匙匠面前，再听船长们的质疑。' : '先走近当前纸质计划，再核对这条路线。';
    if (state.phase === 'question') state.phase = 'captains';
    else if ('id' in point) { state.selected = point.id; state.phase = 'hearing'; }
    state.elapsed = 0; journey.checkpoint = { ...actor.position };
    this.frame(actor, 0, tick); return journey.lastText;
  }
}
