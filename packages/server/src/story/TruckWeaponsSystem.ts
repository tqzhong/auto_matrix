import { FILM_SETS, TRUCK_WEAPONS, newTruckWeapons, truckWeaponPairRoot, truckWeaponGrip, truckWeaponsText,
  type AgentState, type CombatImpact, type SandboxState, type TruckRoot, type TruckWeaponPhase } from '@auto_matrix/shared';
import type { WorldState } from '../world/WorldState.js';

export class TruckWeaponsSystem {
  onUnarmed?: (actor: AgentState, tick: number) => void;
  onImpact?: (impact: CombatImpact, tick: number) => void;
  constructor(private world: WorldState, private sandbox: () => SandboxState) {}
  private get journey() { return this.sandbox().neoLife?.journey; }
  active(actor: AgentState): boolean {
    const j = this.journey;
    return j?.scene === 'm2_trucks' && !j.visiting && j.actor === actor.id && j.step === 0 && j.trucks?.phase === 'duel' && !j.trucks.hood && Boolean(j.trucks.road && j.trucks.weapons);
  }
  root(actor: AgentState): TruckRoot {
    const center = FILM_SETS.film_freeway_101.center, road = this.journey!.trucks!.road!;
    return { x: actor.position.x - center.x - road.truck.x, y: actor.position.y - center.y, z: actor.position.z - center.z - road.truck.z, yaw: actor.rotation };
  }
  private place(actor: AgentState, root: TruckRoot): void {
    const center = FILM_SETS.film_freeway_101.center, road = this.journey!.trucks!.road!;
    actor.position = { x: center.x + road.truck.x + root.x, y: center.y + root.y, z: center.z + road.truck.z + root.z };
    actor.rotation = root.yaw; actor.velocity = { x: 0, y: 0, z: 0 };
  }
  start(actor: AgentState, tick: number): string {
    const j = this.journey!;
    if (!j.trucks!.weapons) j.trucks!.weapons = { ...newTruckWeapons(), johnson: this.root(this.world.agents.get('agent_johnson')!) };
    j.fighting = true;
    this.action(actor, tick); this.action(this.world.agents.get('agent_johnson')!, tick);
    return j.lastText = truckWeaponsText(j.trucks!.weapons!);
  }
  private phase(actor: AgentState, phase: TruckWeaponPhase): void {
    const w = this.journey!.trucks!.weapons!, johnson = this.world.agents.get('agent_johnson')!;
    const a = this.root(actor), b = this.root(johnson), yaw = Math.atan2(b.x - a.x, b.z - a.z);
    actor.rotation = yaw; johnson.rotation = yaw + Math.PI;
    w.phase = phase; w.elapsed = 0; delete w.guarded; delete w.contact;
    w.pair = { morpheus: { ...a, yaw }, agent_johnson: { ...b, yaw: yaw + Math.PI } };
    w.johnson = { ...b, yaw: yaw + Math.PI };
  }
  frame(actor: AgentState, dt: number, tick: number): void {
    if (!this.active(actor)) return;
    const j = this.journey!, w = j.trucks!.weapons!, johnson = this.world.agents.get('agent_johnson')!;
    w.total += dt; w.elapsed += dt;
    if (w.phase === 'gun' && dt && (w.aimed >= 2 || w.elapsed >= 4 || w.rounds === 0)) this.phase(actor, 'gun_rush');
    const a = truckWeaponPairRoot(w, 'morpheus'), b = truckWeaponPairRoot(w, 'agent_johnson');
    if (!['gun', 'blade', 'unarmed'].includes(w.phase) && a && b) { this.place(actor, a); this.place(johnson, b); }
    if (w.phase === 'gun_rush' && w.elapsed >= TRUCK_WEAPONS.gunRush) this.phase(actor, 'gun_disarm');
    if (w.phase === 'gun_disarm') {
      if (!w.gun && w.elapsed >= TRUCK_WEAPONS.release) {
        const grip = truckWeaponGrip(w, this.root(actor), 'gun'); w.gun = { at: w.total, root: grip, pitch: grip.pitch };
        if (!w.guarded) this.damage(actor, 8, tick);
      }
      if (w.elapsed >= TRUCK_WEAPONS.gunDisarm) { w.johnson = this.root(johnson); w.phase = 'blade'; w.elapsed = 0; delete w.pair; }
    }
    if (w.phase === 'blade' && dt && w.elapsed >= 2.6) this.phase(actor, 'counter');
    if (w.phase === 'slash' && w.elapsed >= TRUCK_WEAPONS.slash) this.phase(actor, 'counter');
    if (w.phase === 'counter') {
      if (!w.contact && w.elapsed >= TRUCK_WEAPONS.counterContact) {
        w.contact = true;
        if (!w.guarded) this.damage(actor, 12, tick);
        else this.impact(actor, johnson, 0, tick);
      }
      if (w.elapsed >= TRUCK_WEAPONS.counter) {
        if (w.parries >= 2 && w.slashes >= 2) this.phase(actor, 'sword_disarm');
        else { w.johnson = this.root(johnson); w.phase = 'blade'; w.elapsed = 0; delete w.pair; }
      }
    }
    if (w.phase === 'sword_disarm') {
      if (!w.sword && w.elapsed >= TRUCK_WEAPONS.release) {
        const grip = truckWeaponGrip(w, this.root(actor), 'sword'); w.sword = { at: w.total, root: grip, pitch: grip.pitch };
        this.impact(actor, johnson, 0, tick);
      }
      if (w.elapsed >= TRUCK_WEAPONS.swordDisarm) {
        w.phase = 'unarmed'; w.elapsed = 0; delete w.pair; this.onUnarmed?.(actor, tick);
      }
    }
    if (actor.status === 'alive') j.lastText = truckWeaponsText(w);
    this.action(actor, tick); this.action(johnson, tick);
  }
  johnsonRoot(): TruckRoot | undefined {
    const w = this.journey?.trucks?.weapons;
    if (!w || w.phase === 'unarmed') return;
    return truckWeaponPairRoot(w, 'agent_johnson') ?? w.johnson;
  }
  handle(actor: AgentState, kind: string, yaw: number, pitch: number, tick: number): string | undefined {
    if (!this.active(actor)) return;
    const j = this.journey!, w = j.trucks!.weapons!, road = j.trucks!.road!;
    if (w.phase === 'unarmed' || !['attack', 'shoot', 'ability', 'ability2', 'dodge', 'travel'].includes(kind)) return;
    if (road.paused || road.unavailable || actor.status !== 'alive') return j.lastText;
    const johnson = this.world.agents.get('agent_johnson')!;
    if (kind === 'shoot' && w.phase === 'gun' && w.rounds > 0 && (w.shotAt === undefined || w.total - w.shotAt >= TRUCK_WEAPONS.fireInterval)) {
      actor.rotation = yaw; w.rounds--; w.shots++; w.shotAt = w.total; w.shotYaw = yaw; w.shotPitch = pitch;
      const grip = truckWeaponGrip(w, this.root(actor), 'gun'), center = FILM_SETS.film_freeway_101.center;
      const from = { x: center.x + road.truck.x + grip.x + Math.sin(yaw) * .6, y: center.y - 1 + grip.y + .18,
        z: center.z + road.truck.z + grip.z + Math.cos(yaw) * .6 };
      const dx = johnson.position.x - actor.position.x, dz = johnson.position.z - actor.position.z, length = Math.hypot(dx, dz);
      const heading = Math.atan2(dx, dz), elevation = Math.atan2(actor.position.y + 2.1 - (johnson.position.y + 1.7), length);
      const aimed = Math.abs(Math.atan2(Math.sin(heading - yaw), Math.cos(heading - yaw))) < .22 && Math.abs(elevation - pitch) < .25;
      if (aimed) w.aimed++;
      const range = aimed ? length : 18, direction = { x: Math.sin(yaw) * Math.cos(pitch), y: -Math.sin(pitch), z: Math.cos(yaw) * Math.cos(pitch) };
      this.onImpact?.({ source: actor.id, target: aimed ? johnson.id : 'truck-road', position: { x: from.x + direction.x * range, y: from.y + direction.y * range, z: from.z + direction.z * range },
        direction, damage: 0, combo: 0, matrix: true, downed: false, shot: { from, surface: 'stone' } }, tick);
    } else if (kind === 'attack' && (w.phase === 'blade' || w.phase === 'gun')) {
      const dx = johnson.position.x - actor.position.x, dz = johnson.position.z - actor.position.z, distance = Math.hypot(dx, dz);
      const facing = (Math.sin(yaw) * dx + Math.cos(yaw) * dz) / Math.max(.01, distance);
      if (w.phase === 'gun') return '先瞄准射击。Johnson 还在刀锋触及范围之外。';
      if (distance > 3.7 || facing < .5 || actor.position.y > johnson.position.y + .2) return '靠近并面对 Johnson，在车顶站稳后再挥刀。';
      w.slashes++; this.phase(actor, 'slash');
    } else if (kind === 'dodge' && !w.guarded && (w.phase === 'counter' || w.phase === 'gun_disarm')
      && w.elapsed >= TRUCK_WEAPONS.guardStart && w.elapsed <= TRUCK_WEAPONS.guardEnd) {
      w.guarded = true; if (w.phase === 'counter') w.parries++;
    }
    this.action(actor, tick); this.action(johnson, tick);
    return j.lastText = truckWeaponsText(w);
  }
  action(actor: AgentState, tick: number): void {
    const j = this.journey;
    if (!['morpheus', 'agent_johnson'].includes(actor.id)) return;
    if (!j?.trucks?.weapons || !j.trucks.road) { if (actor.currentAction) delete actor.currentAction.parameters.truckWeapons; return; }
    if (j.trucks.phase !== 'duel') { if (actor.currentAction) delete actor.currentAction.parameters.truckWeapons; return; }
    actor.currentAction ??= { type: 'idle', parameters: { resolved: true }, startedAt: tick, duration: 1e9, progress: 0 };
    actor.currentAction.parameters.truckWeapons = { ...j.trucks.weapons, role: actor.id, truck: { ...j.trucks.road.truck },
      bodies: { morpheus: this.root(this.world.agents.get('morpheus')!), agent_johnson: this.root(this.world.agents.get('agent_johnson')!) } };
  }
  private damage(actor: AgentState, amount: number, tick: number): void {
    actor.health = Math.max(0, actor.health - amount); this.impact(this.world.agents.get('agent_johnson')!, actor, amount, tick);
    if (!actor.health) { actor.status = 'dead'; this.journey!.trucks!.phase = 'failed'; this.journey!.lastText = '你没能挡住车顶的攻势。按 J 重试当前车顶检查点，乘客旧伤保留。'; }
  }
  private impact(source: AgentState, target: AgentState, damage: number, tick: number): void {
    const dx = target.position.x - source.position.x, dz = target.position.z - source.position.z, length = Math.max(.01, Math.hypot(dx, dz));
    this.onImpact?.({ source: source.id, target: target.id, position: { ...target.position, y: target.position.y + 1.7 },
      direction: { x: dx / length, y: 0, z: dz / length }, damage, combo: 0, matrix: true, downed: !target.health }, tick);
  }
}
