import { FILM_SETS, freewayHandoffActive, freewayHandoffReady, freewayHandoffRoot, freewayHandoffText, newFreewayHandoff, stepFreewayHandoff,
  type AgentState, type PlayerInput, type SandboxState } from '@auto_matrix/shared';
import type { WorldState } from '../world/WorldState.js';

export class FreewayHandoffSystem {
  onAdvance?: (text: string, actor: AgentState, tick: number) => void;
  constructor(private world: WorldState, private sandbox: () => SandboxState) {}
  private get journey() { return this.sandbox().neoLife?.journey; }
  active(actor: AgentState): boolean { return freewayHandoffActive(this.journey) && this.journey!.actor === actor.id; }
  frame(actor: AgentState, input: Partial<PlayerInput>, dt: number, tick: number): boolean {
    if (!this.active(actor)) return false;
    const journey = this.journey!, state = journey.freewayHandoff!;
    const companions = ['keymaker', 'morpheus'].map(id => this.world.agents.get(id));
    state.paused = companions.find(member => member?.controller)?.name;
    state.unavailable = companions.find(member => member?.status !== 'alive')?.name;
    if (companions.some(member => !member)) state.unavailable = '接应同伴';
    const elapsed = actor.controller && actor.status === 'alive' ? dt : 0;
    const next = journey.freewayHandoff = stepFreewayHandoff(state, input.drive ?? { throttle: 0, steer: 0, brake: false }, elapsed);
    next.startedAt ??= tick; delete journey.started;
    journey.ride = { ...next.bike, phase: 'arrived' };
    const center = FILM_SETS.film_freeway_101.center;
    for (const role of ['trinity', 'keymaker', 'morpheus'] as const) {
      const member = this.world.agents.get(role);
      if (!member || member.status !== 'alive' || member !== actor && member.controller) continue;
      const root = freewayHandoffRoot(next, role), previous = member.position;
      member.position = { x: center.x + root.x, y: center.y + root.y, z: center.z + root.z };
      member.rotation = root.yaw; member.currentLocation = 'film_freeway_101'; member.isInMatrix = true;
      member.velocity = elapsed > 0 ? { x: (member.position.x - previous.x) / elapsed, y: (member.position.y - previous.y) / elapsed, z: (member.position.z - previous.z) / elapsed } : { x: 0, y: 0, z: 0 };
      member.targetPosition = null; member.currentPath = [];
      const seated = role === 'trinity' || role === 'keymaker' && next.phase === 'approach';
      member.currentAction = { type: 'idle', parameters: { resolved: true, player: member === actor && Boolean(member.controller), riding: seated, seated,
        freewayHandoff: { ...next, role }, ...(seated ? { freewayRide: { ...next.bike, role } } : {}) }, startedAt: next.startedAt, duration: 1e9, progress: 0 };
    }
    journey.lastText = freewayHandoffText(next);
    return true;
  }
  command(actor: AgentState, target: string, tick: number): string | undefined {
    const journey = this.journey;
    if (!journey || journey.scene !== 'm2_freeway' || journey.step !== 2 || journey.visiting || journey.actor !== actor.id) return;
    // Existing parked checkpoints keep their completed escort and damage. G opts into the new transfer.
    if (!journey.freewayHandoff) {
      if (target !== 'act' || !journey.ride) return;
      journey.freewayHandoff = newFreewayHandoff(journey.ride);
    }
    this.frame(actor, {}, 0, tick);
    const state = journey.freewayHandoff!;
    if (state.paused || state.unavailable) return journey.lastText;
    if (target === 'retry' || target === 'act' && state.phase === 'failed') {
      journey.freewayHandoff = newFreewayHandoff(state.checkpoint, state.attempt + 1);
      this.frame(actor, {}, 0, tick);
    } else if (target === 'act' && freewayHandoffReady(state)) {
      state.phase = 'reaching'; state.elapsed = 0;
      this.frame(actor, {}, 0, tick);
    } else if (target === 'act' && state.phase === 'done') {
      this.onAdvance?.(journey.lastText, actor, tick);
    }
    return journey.lastText;
  }
}
