import { FILM_SETS, FREEWAY_PICKUP, freewayPickupActive, freewayPickupRoot, freewayPickupText, freewayPursuitVehicles, freewayDriverRoot, freewayRideRoot, newFreewayPickup, newFreewayRide,
  stepFreewayPickup, type AgentState, type PlayerInput, type SandboxState } from '@auto_matrix/shared';
import type { WorldState } from '../world/WorldState.js';

export class FreewayPickupSystem {
  onAdvance?: (text: string, actor: AgentState, tick: number) => void;
  constructor(private world: WorldState, private sandbox: () => SandboxState) {}
  private get journey() { return this.sandbox().neoLife?.journey; }
  active(actor: AgentState): boolean { return freewayPickupActive(this.journey) && this.journey!.actor === actor.id; }
  clear(): void {
    this.sandbox().structures = this.sandbox().structures.filter(s => s.id !== 'film:freeway-pickup:overpass');
    for (const member of this.world.agents.values()) if (!member.controller && (member.currentAction?.parameters.freewayPickup || member.currentAction?.parameters.freewayDriver)) member.currentAction = null;
  }
  frame(actor: AgentState, input: Partial<PlayerInput>, dt: number, tick: number): boolean {
    if (!this.active(actor)) return false;
    const journey = this.journey!, state = journey.freewayPickup!;
    state.startedAt ??= tick;
    const keymaker = this.world.agents.get('keymaker');
    if (keymaker?.controller) state.paused = keymaker.name; else delete state.paused;
    if (keymaker?.status !== 'alive') state.unavailable = keymaker?.name ?? '钥匙匠'; else delete state.unavailable;
    const jackson = this.world.agents.get('agent_jackson');
    const pursuit = state.chase || state.route && state.phase === 'launching';
    if (pursuit && jackson?.controller) state.paused = jackson.name;
    if (pursuit && jackson?.status !== 'alive') state.unavailable = jackson?.name ?? 'Jackson 特工';
    const elapsed = actor.controller && actor.status === 'alive' ? dt : 0;
    const next = journey.freewayPickup = stepFreewayPickup(state, input, elapsed);
    delete journey.started;
    const center = FILM_SETS.film_freeway_101.center;
    if (!this.sandbox().structures.some(s => s.id === 'film:freeway-pickup:overpass')) this.sandbox().structures.push({
      id: 'film:freeway-pickup:overpass', kind: 'barricade', owner: 'zion', matrix: true, health: 999,
      position: { x: center.x, y: center.y + FREEWAY_PICKUP.bridge.height, z: center.z + FREEWAY_PICKUP.bridge.z },
      film: { scene: 'm2_freeway', width: 120, depth: 18, height: 0 } });
    for (const role of ['trinity', 'keymaker'] as const) {
      const member = this.world.agents.get(role);
      if (!member || member.status !== 'alive' || role !== actor.id && member.controller) continue;
      const root = freewayPickupRoot(next, role), previous = member.position;
      member.position = { x: center.x + root.x, y: center.y + root.y, z: center.z + root.z }; member.rotation = root.yaw;
      member.velocity = elapsed > 0 ? { x: (member.position.x - previous.x) / elapsed, y: (member.position.y - previous.y) / elapsed, z: (member.position.z - previous.z) / elapsed } : { x: 0, y: 0, z: 0 };
      member.currentLocation = 'film_freeway_101'; member.isInMatrix = true; member.targetPosition = null; member.currentPath = [];
      member.currentAction = { type: 'idle', parameters: { resolved: true, player: role === actor.id,
        freewayPickup: { ...next, role, walking: next.paused || next.unavailable ? 0 : next.walking } }, startedAt: next.startedAt ?? tick, duration: 1e9, progress: 0 };
    }
    journey.lastText = freewayPickupText(next);
    if (next.chase && jackson && !jackson.controller && jackson.status === 'alive') {
      const root = freewayDriverRoot(next), previous = jackson.position;
      jackson.position = { x: center.x + root.x, y: center.y + root.y, z: center.z + root.z };
      jackson.rotation = root.yaw; jackson.velocity = elapsed > 0 ? { x: (jackson.position.x - previous.x) / elapsed, y: 0, z: (jackson.position.z - previous.z) / elapsed } : { x: 0, y: 0, z: 0 };
      jackson.currentLocation = 'film_freeway_101'; jackson.isInMatrix = true; jackson.targetPosition = null; jackson.currentPath = [];
      jackson.currentAction = { type: 'idle', parameters: { resolved: true, seated: true, riding: true, freewayDriver: { ...next, role: 'agent_jackson' } }, startedAt: next.startedAt ?? tick, duration: 1e9, progress: 0 };
    }
    if (next.phase === 'done') {
      journey.ride = { ...newFreewayRide(), x: next.x, z: next.z, speed: -Math.cos(next.heading) * next.speed,
        lateral: Math.sin(next.heading) * next.speed, elapsed: next.total, startedAt: tick, bank: 0, braking: 0,
        ...(next.chase ? { obstacles: freewayPursuitVehicles(next) } : {}) };
      for (const role of ['trinity', 'keymaker'] as const) {
        const member = this.world.agents.get(role); if (!member || member.controller && member !== actor) continue;
        const root = freewayRideRoot(journey.ride, role);
        member.position = { x: center.x + root.x, y: center.y + root.y, z: center.z + root.z }; member.rotation = root.yaw;
        member.currentAction = { type: 'idle', parameters: { resolved: true, riding: true, seated: true, player: member === actor,
          passenger: member !== actor, freewayRide: { ...journey.ride, role } }, startedAt: tick, duration: 1e9, progress: 0 };
      }
      journey.checkpoint = { ...actor.position };
      this.onAdvance?.(journey.lastText, actor, tick);
    }
    return true;
  }
  command(actor: AgentState, target: string, tick: number): string | undefined {
    if (!this.active(actor)) return;
    this.frame(actor, {}, 0, tick);
    const journey = this.journey!, state = journey.freewayPickup!;
    if (state.paused || state.unavailable) return journey.lastText;
    if (target === 'retry' || target === 'act' && state.phase === 'failed') {
      journey.freewayPickup = newFreewayPickup(state.attempts + 1);
      if (actor.status !== 'alive') { actor.status = 'alive'; actor.health = actor.maxHealth; }
      this.frame(actor, {}, 0, tick); journey.checkpoint = { ...actor.position }; return journey.lastText;
    }
    if (target === 'act') {
      if (state.phase === 'ready') { state.phase = 'bridge'; state.route = 1; }
      else if (state.phase === 'deck') {
        if (Math.hypot(state.x - FREEWAY_PICKUP.carrier.x - FREEWAY_PICKUP.bike.x, state.z - FREEWAY_PICKUP.bike.z) > 2)
          return '先沿载货平台的中间通道走到前排左侧摩托。';
        state.phase = 'key'; state.elapsed = 0;
      } else if (state.phase === 'key') {
        if (state.elapsed < FREEWAY_PICKUP.callSeconds) return journey.lastText;
        state.phase = 'keyhandoff'; state.elapsed = 0;
      }
      this.frame(actor, {}, 0, tick);
    }
    return journey.lastText;
  }
  shoot(actor: AgentState, tick: number): string {
    const state = this.journey!.freewayPickup!;
    if (state.phase === 'mounted' && state.chain && !state.paused && !state.unavailable) { state.phase = 'shooting'; state.elapsed = 0; }
    this.frame(actor, {}, 0, tick); return this.journey!.lastText;
  }
}
