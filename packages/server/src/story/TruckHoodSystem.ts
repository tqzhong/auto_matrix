import { FILM_SETS, TRUCK_HOOD, newTruckHood, truckHoodCar, truckHoodRoot, truckHoodFallSeconds, truckHoodText,
  truckHoodHeight, type AgentState, type SandboxState, type PlayerInput, type TruckRoot, type TruckHoodPhase, type TruckHoodRole, type CombatImpact } from '@auto_matrix/shared';
import type { WorldState } from '../world/WorldState.js';

export class TruckHoodSystem {
  onAdvance?: (text: string, actor: AgentState, tick: number) => void;
  onImpact?: (impact: CombatImpact, tick: number) => void;
  constructor(private world: WorldState, private sandbox: () => SandboxState) {}
  private get journey() { return this.sandbox().neoLife?.journey; }
  active(actor: AgentState): boolean { const j = this.journey; return j?.scene === 'm2_trucks' && !j.visiting && j.actor === actor.id && j.trucks?.phase === 'duel' && Boolean(j.trucks.hood && j.trucks.hood.phase !== 'done'); }
  private root(actor: AgentState): TruckRoot {
    const c = FILM_SETS.film_freeway_101.center, r = this.journey!.trucks!.road!;
    return { x: actor.position.x - c.x - r.truck.x, y: actor.position.y - c.y, z: actor.position.z - c.z - r.truck.z, yaw: actor.rotation };
  }
  start(actor: AgentState, tick: number): void {
    const j = this.journey!, e = j.trucks!; if (e.hood || !e.road || e.weapons?.phase !== 'unarmed') return;
    e.hood = newTruckHood(this.root(actor), this.root(this.world.agents.get('agent_johnson')!), actor.health, e.attempt);
    delete j.fighting; delete j.started; this.frame(actor, {}, 0, tick);
  }
  private phase(phase: TruckHoodPhase): void { const h = this.journey!.trucks!.hood!; h.phase = phase; h.elapsed = 0; }
  private fail(actor: AgentState, reason: string): void {
    const j = this.journey!, h = j.trucks!.hood!, p = truckHoodRoot(h, 'morpheus'), c = FILM_SETS.film_freeway_101.center, truck = j.trucks!.road!.truck;
    actor.position = { x: c.x + truck.x + p.x, y: c.y + p.y, z: c.z + truck.z + p.z };
    h.failure = reason; h.phase = 'failed'; j.trucks!.phase = 'failed';
    actor.status = 'dead'; actor.health = 0; actor.velocity = { x: 0, y: 0, z: 0 }; j.lastText = truckHoodText(h);
  }
  frame(actor: AgentState, input: Partial<PlayerInput>, dt: number, tick: number): void {
    if (!this.active(actor)) return;
    const j = this.journey!, e = j.trucks!, h = e.hood!, road = e.road!;
    const delta = actor.status === 'alive' && actor.controller && !road.paused && !road.unavailable ? dt : 0;
    h.total += delta; h.elapsed += delta;
    if (h.glassAge !== undefined) h.glassAge = Math.min(TRUCK_HOOD.glassSeconds, h.glassAge + delta);
    h.car = truckHoodCar(h);
    if (delta && h.phase === 'flight' && h.kickQueued && h.kicked === undefined && h.elapsed >= TRUCK_HOOD.contactEnd) {
      h.kicked = h.total;
      const johnson = this.world.agents.get('agent_johnson')!;
      this.onImpact?.({ source: actor.id, target: johnson.id, position: { ...johnson.position, y: johnson.position.y + 2.8 },
        direction: { x: -1, y: .2, z: 0 }, damage: 0, combo: 3, matrix: true, downed: false }, tick);
    }
    if (h.phase === 'kick' && h.elapsed >= TRUCK_HOOD.kick) this.phase('falling');
    else if (h.phase === 'falling' && h.elapsed >= truckHoodFallSeconds()) { h.glassAge = 0; h.contactCar = { ...h.car }; this.phase('impact'); }
    else if (h.phase === 'impact' && h.elapsed >= TRUCK_HOOD.impact) this.phase('hood');
    else if (h.phase === 'hood' && delta) {
      const wind = .55 + .32 * Math.sin(h.total * 2.7);
      h.balance += ((input.drive?.steer ?? input.x ?? 0) * 1.7 + wind * (input.focus ? .12 : 1)) * delta;
      h.grip = input.focus && Math.abs(h.balance) < .8 ? h.grip + delta : Math.max(0, h.grip - delta);
      if (Math.abs(h.balance) > 1.5) { h.failure = 'balance'; this.phase('slipping'); }
      else if (h.grip >= TRUCK_HOOD.grip) this.phase('passing');
    } else if (h.phase === 'slipping' && h.elapsed >= Math.sqrt(2 * truckHoodHeight(TRUCK_HOOD.car.hood) / TRUCK_HOOD.gravity)) this.fail(actor, 'balance');
    else if (h.phase === 'passing' && h.elapsed >= TRUCK_HOOD.passing) { h.car = truckHoodCar(h); this.phase('ready'); }
    else if (h.phase === 'ready' && input.jump && delta) this.phase('running');
    else if (h.phase === 'running' && h.elapsed >= TRUCK_HOOD.run) this.phase('flight');
    else if (h.phase === 'flight' && h.elapsed >= TRUCK_HOOD.flight) this.phase(h.kicked === undefined ? 'miss' : 'landing');
    else if (h.phase === 'miss' && h.elapsed >= 1.4) this.fail(actor, 'miss');
    else if (h.phase === 'landing' && h.elapsed >= TRUCK_HOOD.landing) {
      h.phase = 'done'; this.onAdvance?.('Niobe 的接应让 Morpheus 重返车顶，飞踢把 Johnson 打入车流。', actor, tick);
    }
    if (h.phase !== 'failed') {
      h.car = truckHoodCar(h);
      for (const role of ['morpheus', 'agent_johnson', 'niobe', 'ghost'] as TruckHoodRole[]) {
        const member = this.world.agents.get(role); if (!member || member.status !== 'alive' || member.controller && member !== actor) continue;
        const p = truckHoodRoot(h, role), c = FILM_SETS.film_freeway_101.center;
        member.position = { x: c.x + road.truck.x + p.x, y: c.y + p.y, z: c.z + road.truck.z + p.z };
        member.rotation = p.yaw; member.velocity = { x: 0, y: 0, z: 0 }; member.currentLocation = 'film_freeway_101'; member.isInMatrix = true;
        member.targetPosition = null; member.currentPath = []; this.action(member, tick);
      }
      if (e.phase === 'duel') j.lastText = road.paused || road.unavailable ? j.lastText : truckHoodText(h);
    }
  }
  handle(actor: AgentState, kind: string, tick: number): string | undefined {
    if (!this.active(actor) || !['attack', 'shoot', 'ability', 'ability2', 'dodge', 'travel'].includes(kind)) return;
    const j = this.journey!, h = j.trucks!.hood!, road = j.trucks!.road!;
    if (!road.paused && !road.unavailable && h.phase === 'flight' && h.kicked === undefined && h.elapsed >= TRUCK_HOOD.contactStart && h.elapsed <= TRUCK_HOOD.contactEnd && kind === 'attack') {
      h.kickQueued = true; this.action(actor, tick);
    }
    return j.lastText = truckHoodText(h);
  }
  action(actor: AgentState, tick: number): void {
    if (!['morpheus', 'agent_johnson', 'niobe', 'ghost'].includes(actor.id)) return;
    const j = this.journey!, h = j.trucks?.hood;
    const driver = actor.id === 'niobe' || actor.id === 'ghost';
    if (!h || !driver && (h.phase === 'failed' || h.phase === 'done' || j.trucks?.phase !== 'duel')) { if (actor.currentAction) delete actor.currentAction.parameters.truckHood; return; }
    actor.currentAction ??= { type: 'idle', parameters: { resolved: true }, startedAt: tick, duration: 1e9, progress: 0 };
    actor.currentAction.parameters.truckHood = { ...h, car: { ...h.car }, truck: { ...j.trucks!.road!.truck }, role: actor.id };
    if (actor.id === 'niobe' || actor.id === 'ghost') actor.currentAction.parameters.seated = true;
  }
  retry(actor: AgentState, tick: number): string | undefined {
    const j = this.journey!, e = j.trucks!, old = e.hood; if (!old || !e.road) return;
    e.attempt++; e.phase = 'duel'; delete j.fighting; delete j.started;
    e.hood = newTruckHood(old.starts.morpheus, old.starts.agent_johnson, old.health, e.attempt);
    e.hood.phase = 'hood'; e.hood.car = { ...old.contactCar ?? { x: 5.3, z: old.starts.morpheus.z - TRUCK_HOOD.car.hood, yaw: 0 } };
    if (old.contactCar) e.hood.contactCar = { ...old.contactCar };
    if (old.glassAge !== undefined) e.hood.glassAge = old.glassAge;
    actor.status = 'alive'; actor.health = old.health; actor.activeEffects = [];
    this.frame(actor, {}, 0, tick); j.checkpoint = { ...actor.position };
    return j.lastText = '已恢复当前车盖检查点；钥匙匠和其他同行者的旧伤保留。';
  }
}
