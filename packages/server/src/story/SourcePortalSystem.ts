import { SOURCE_PORTAL, FILM_SCENE_BY_ID, filmPosition, distance, sourcePortalActive, sourcePortalLocked,
  sourcePortalRoot, sourcePortalText, type AgentState, type SandboxState, type SourcePortalRole } from '@auto_matrix/shared';
import type { WorldState } from '../world/WorldState.js';

export class SourcePortalSystem {
  onAdvance?: (text: string, actor: AgentState, tick: number) => void;
  constructor(private world: WorldState, private sandbox: () => SandboxState) {}
  private get journey() { return this.sandbox().neoLife?.journey; }
  active(actor: AgentState): boolean { return sourcePortalActive(this.journey) && actor.id === this.journey!.actor; }
  clear(): void { for (const actor of this.world.agents.values()) if (!actor.controller && actor.currentAction?.parameters.sourcePortal) actor.currentAction = null; }
  frame(actor: AgentState, dt: number, tick: number): boolean {
    if (!this.active(actor)) return false;
    const journey = this.journey!, door = journey.keyDoor ??= { portalOpened: journey.step >= 4, keyTaken: journey.step >= 5 };
    const state = door.performance ??= { phase: journey.step >= 6 ? 'done' : journey.step >= 5 ? 'key_taken' : journey.step >= 4 ? 'wounded' : 'idle', elapsed: 0, attempts: 0 };
    delete journey.started;
    const keymaker = this.world.agents.get('keymaker')!, morpheus = this.world.agents.get('morpheus')!;
    state.paused = keymaker.controller ? keymaker.name : morpheus.controller ? morpheus.name : undefined;
    state.unavailable = morpheus.status !== 'alive' ? morpheus.name : !door.keyTaken && keymaker.status !== 'alive' ? keymaker.name : undefined;
    const elapsed = actor.controller && actor.status === 'alive' && actor.isInMatrix && actor.currentLocation === FILM_SCENE_BY_ID.m2_key_door.set
      && !state.paused && !state.unavailable ? Math.max(0, Math.min(.1, dt)) : 0;
    const durations = { opening: SOURCE_PORTAL.openingSeconds, cover: SOURCE_PORTAL.coverSeconds, escaping: SOURCE_PORTAL.escapeSeconds,
      sealing: SOURCE_PORTAL.sealSeconds, listening: SOURCE_PORTAL.listeningSeconds, offering: SOURCE_PORTAL.offeringSeconds,
      taking: SOURCE_PORTAL.takingSeconds, entering: SOURCE_PORTAL.enteringSeconds };
    const duration = durations[state.phase as keyof typeof durations];
    if (duration) {
      state.elapsed = Math.min(duration, state.elapsed + elapsed);
      if (state.phase === 'escaping' && state.elapsed >= .9 && !state.wounded) {
        keymaker.health = Math.min(keymaker.health, Math.max(1, Math.round(keymaker.maxHealth * .18))); state.wounded = true;
      }
      if (state.elapsed >= duration - 1e-8) {
        const prior = state.phase;
        state.phase = ({ opening: 'cover', cover: 'failed', escaping: 'sealing', sealing: 'wounded', listening: 'offering', offering: 'key_ready', taking: 'key_taken', entering: 'done' } as const)[prior as keyof typeof durations];
        state.elapsed = 0;
        if (prior === 'opening') {
          if (journey.grid?.phase === 'window') door.portalOpened = true;
          else { state.phase = 'failed'; state.failure = 'window'; }
        }
        if (prior === 'cover') state.failure = 'cover';
        if (prior === 'sealing') this.onAdvance?.(sourcePortalText(state), actor, tick);
        if (prior === 'taking') { door.keyTaken = true; keymaker.status = 'dead'; keymaker.health = 0; this.onAdvance?.(sourcePortalText(state), actor, tick); }
        if (prior === 'entering') this.onAdvance?.(sourcePortalText(state), actor, tick);
      }
    }
    if (!state.paused && !state.unavailable && state.phase !== 'idle') for (const role of ['neo', 'morpheus', 'keymaker'] as const) {
      const cast = this.world.agents.get(role)!;
      if (cast.controller && cast.id !== actor.id) continue;
      if (role === 'neo' && !sourcePortalLocked(state)) { if (cast.currentAction?.parameters.sourcePortal) cast.currentAction = null; continue; }
      const root = sourcePortalRoot(state, role);
      cast.position = filmPosition(FILM_SCENE_BY_ID.m2_key_door.set, root.x, root.z); cast.rotation = root.yaw;
      cast.currentLocation = FILM_SCENE_BY_ID.m2_key_door.set; cast.isInMatrix = true;
      cast.velocity = { x: 0, y: 0, z: 0 }; cast.targetPosition = null;
      cast.currentAction = { type: 'idle', parameters: { player: role === 'neo', resolved: true, sourcePortal: { ...state, role: role satisfies SourcePortalRole } }, startedAt: journey.enteredAt, duration: 1e9, progress: 0 };
    }
    journey.lastText = sourcePortalText(state); return sourcePortalLocked(state);
  }
  handle(actor: AgentState, kind: string, tick: number): string | undefined {
    if (!this.active(actor)) return;
    this.frame(actor, 0, tick); const state = this.journey!.keyDoor!.performance!;
    if (state.phase !== 'cover') return;
    if (state.paused || state.unavailable || kind !== 'attack') return sourcePortalText(state);
    state.phase = 'escaping'; state.elapsed = 0; this.frame(actor, 0, tick); return sourcePortalText(state);
  }
  command(actor: AgentState, target: string, tick: number): string | undefined {
    if (!this.active(actor)) return;
    this.frame(actor, 0, tick); const journey = this.journey!, door = journey.keyDoor!, state = door.performance!;
    if (target === 'retry') {
      if (state.phase !== 'failed') return sourcePortalText(state);
      state.phase = journey.step >= 5 ? 'key_taken' : 'idle'; state.elapsed = 0; state.attempts++; delete state.failure; if (journey.step < 5) door.portalOpened = false;
      actor.position = filmPosition(FILM_SCENE_BY_ID.m2_key_door.set, 1.65, -37.25); actor.velocity = { x: 0, y: 0, z: 0 }; actor.currentAction = null;
      return '回到开门检查点；队友伤亡、既有伤势、爆破与先前选择保持。';
    }
    if (state.paused || state.unavailable) return sourcePortalText(state);
    if (target === 'next' && state.phase !== 'done') return sourcePortalText(state);
    if (target !== 'act' || state.phase === 'done') return;
    if (state.phase === 'idle' || state.phase === 'key_taken') {
      if (journey.grid?.phase !== 'window') return; // Existing grid commands own expiry and rerouting.
      const point = state.phase === 'idle' ? { x: 0, z: -38 } : { x: 0, z: -52 };
      if (distance(actor.position, filmPosition(FILM_SCENE_BY_ID.m2_key_door.set, point.x, point.z)) > 4) return '先走到门前，再按 G。';
      state.phase = state.phase === 'idle' ? 'opening' : 'entering'; state.elapsed = 0;
      if (state.phase === 'entering') journey.grid!.phase = 'opened';
      journey.checkpoint = { ...actor.position };
    } else if (state.phase === 'wounded') {
      if (distance(actor.position, keymakerPosition()) > 4) return '先走到负伤的钥匙匠身旁。';
      state.phase = 'listening'; state.elapsed = 0;
    } else if (state.phase === 'key_ready') { state.phase = 'taking'; state.elapsed = 0; }
    this.frame(actor, 0, tick); return journey.lastText;
    function keymakerPosition() { return filmPosition(FILM_SCENE_BY_ID.m2_key_door.set, 1.15, -45.7); }
  }
}
