import { TRINITY_RELAY, FILM_SCENE_BY_ID, filmEntry, filmPosition, distance, trinityRelayActive, trinityRelayLocked,
  trinityRelayRoot, trinityRelayText, type AgentState, type SandboxState } from '@auto_matrix/shared';
import type { WorldState } from '../world/WorldState.js';

export class TrinityRelaySystem {
  onAdvance?: (text: string, actor: AgentState, tick: number) => void;
  constructor(private world: WorldState, private sandbox: () => SandboxState) {}
  private get journey() { return this.sandbox().neoLife?.journey; }
  active(actor: AgentState): boolean { return trinityRelayActive(this.journey) && actor.id === this.journey!.actor; }
  clear(): void { for (const actor of this.world.agents.values()) if (!actor.controller && actor.currentAction?.parameters.trinityRelay) actor.currentAction = null; }
  frame(actor: AgentState, dt: number, tick: number): boolean {
    if (!this.active(actor)) return false;
    const journey = this.journey!, scene = FILM_SCENE_BY_ID.m2_relay;
    const state = journey.trinityRelay ??= { phase: journey.step >= 2 ? 'connected' : journey.step === 1 ? 'walking' : 'review', elapsed: journey.step >= 2 ? TRINITY_RELAY.connectSeconds : 0 };
    delete journey.started;
    // A legacy blackout marked her connected before this shipboard decision existed.
    if (journey.grid && state.phase !== 'connected') journey.grid.trinity = 'waiting';
    if (actor.currentLocation !== scene.set || actor.isInMatrix) {
      actor.position = filmEntry(scene); actor.currentLocation = scene.set; actor.isInMatrix = false;
      actor.velocity = { x: 0, y: 0, z: 0 }; journey.checkpoint = { ...actor.position };
    }
    const link = this.world.agents.get('link');
    state.paused = link?.controller ? link.name : undefined;
    state.unavailable = link?.status !== 'alive' ? link?.name ?? 'Link' : undefined;
    const elapsed = actor.controller && actor.status === 'alive' && !state.paused && !state.unavailable ? Math.max(0, Math.min(.1, dt)) : 0;
    if (state.phase === 'hearing') {
      state.elapsed = Math.min(TRINITY_RELAY.hearingSeconds, state.elapsed + elapsed);
      if (state.elapsed >= TRINITY_RELAY.hearingSeconds) { state.phase = 'decision'; state.elapsed = 0; }
    } else if (state.phase === 'connecting') {
      state.elapsed = Math.min(TRINITY_RELAY.connectSeconds, state.elapsed + elapsed);
      if (state.elapsed >= TRINITY_RELAY.connectSeconds) {
        state.phase = 'connected'; if (journey.grid) journey.grid.trinity = 'connected';
        this.onAdvance?.(trinityRelayText(state), actor, tick);
      }
    }
    if (state.phase === 'connecting' || state.phase === 'connected') {
      const root = trinityRelayRoot({ ...state, role: 'trinity' });
      actor.position = filmPosition(scene.set, root.x, root.z); actor.rotation = root.yaw;
      actor.velocity = { x: 0, y: 0, z: 0 };
      actor.currentAction = { type: 'idle', parameters: { player: true, resolved: true, trinityRelay: { ...state, role: 'trinity' } }, startedAt: journey.enteredAt, duration: 1e9, progress: 0 };
    } else if (state.phase === 'hearing') {
      actor.velocity = { x: 0, y: 0, z: 0 };
      actor.currentAction = { type: 'idle', parameters: { player: true, resolved: true, trinityRelay: { ...state, role: 'trinity' } }, startedAt: journey.enteredAt, duration: 1e9, progress: 0 };
    } else if (actor.currentAction?.parameters.trinityRelay) actor.currentAction = null;
    if (link && link.status === 'alive' && !link.controller) {
      const root = trinityRelayRoot({ ...state, role: 'link' }), before = { ...link.position };
      link.position = filmPosition(scene.set, root.x, root.z); link.rotation = root.yaw;
      link.currentLocation = scene.set; link.isInMatrix = false; link.targetPosition = null; link.currentPath = [];
      link.velocity = elapsed > 0 ? { x: (link.position.x - before.x) / elapsed, y: 0, z: (link.position.z - before.z) / elapsed } : { x: 0, y: 0, z: 0 };
      link.currentAction = { type: 'idle', parameters: { resolved: true, trinityRelay: { ...state, role: 'link' } }, startedAt: journey.enteredAt, duration: 1e9, progress: 0 };
    }
    journey.lastText = trinityRelayText(state); return trinityRelayLocked(state) || state.phase === 'connected';
  }
  command(actor: AgentState, target: string, tick: number): string | undefined {
    if (!this.active(actor)) return;
    this.frame(actor, 0, tick); const journey = this.journey!, state = journey.trinityRelay!;
    if (target === 'retry') {
      if (actor.status !== 'alive') { actor.status = 'alive'; actor.health = actor.maxHealth; }
      if (!['connecting', 'connected'].includes(state.phase)) actor.position = { ...journey.checkpoint };
      actor.velocity = { x: 0, y: 0, z: 0 }; this.frame(actor, 0, tick); return '接回本段检查点；队友伤亡、供电状态与先前选择保留。';
    }
    if (state.paused || state.unavailable || trinityRelayLocked(state)) return trinityRelayText(state);
    if (target !== 'act' || state.phase === 'connected') return;
    if (journey.grid?.primary !== 'off' || journey.grid?.emergency !== 'online' || journey.grid?.vigilant !== 'lost') return '主网爆破和 Vigilant 失联尚未发生，不能提前接入。';
    const point = state.phase === 'walking' ? TRINITY_RELAY.approach : TRINITY_RELAY.monitor;
    if (distance(actor.position, filmPosition(FILM_SCENE_BY_ID.m2_relay.set, point.x, point.z)) > 1.6) return state.phase === 'walking' ? '先亲自走到连接椅前。' : '先走到 Link 的操作台旁核对信号。';
    if (state.phase === 'review') { state.phase = 'hearing'; state.elapsed = 0; }
    else if (state.phase === 'decision') { state.phase = 'walking'; state.elapsed = 0; this.onAdvance?.(trinityRelayText(state), actor, tick); }
    else { state.phase = 'connecting'; state.elapsed = 0; }
    journey.checkpoint = { ...actor.position }; this.frame(actor, 0, tick); return journey.lastText;
  }
}
