import { FILM_SETS, TRUCKS, TRUCK_ROAD, truckRoadRoot, truckRoadPoint, truckApproachPose, newTruckRoad,
  truckWeaponsLocked, truckHoodRoot, type AgentState, type SandboxState, type TruckRoot } from '@auto_matrix/shared';
import type { WorldState } from '../world/WorldState.js';
import { TruckWeaponsSystem } from './TruckWeaponsSystem.js';
import { TruckHoodSystem } from './TruckHoodSystem.js';

export class TruckRoadSystem {
  readonly weapons: TruckWeaponsSystem;
  readonly hood: TruckHoodSystem;
  constructor(private world: WorldState, private sandbox: () => SandboxState) { this.weapons = new TruckWeaponsSystem(world, sandbox); this.hood = new TruckHoodSystem(world, sandbox); }
  private get journey() { return this.sandbox().neoLife?.journey; }
  active(actor: AgentState): boolean { const j = this.journey; return j?.scene === 'm2_trucks' && !j.visiting && j.actor === actor.id && Boolean(j.trucks?.road) && j.trucks?.phase !== 'rescued'; }
  locked(actor: AgentState): boolean {
    return this.active(actor) && Boolean(this.journey!.trucks!.road!.phase !== 'ready' || this.journey!.trucks!.road!.paused || this.journey!.trucks!.road!.unavailable
      || this.hood.active(actor) || truckWeaponsLocked(this.journey!.trucks!.weapons));
  }
  frame(actor: AgentState, dt: number, tick: number, input: Partial<import('@auto_matrix/shared').PlayerInput> = {}): boolean {
    if (this.journey?.scene === 'm2_trucks' && this.journey.trucks?.phase === 'rescued') {
      if (actor.currentAction?.parameters.truckRoad) actor.currentAction = null;
      return false;
    }
    if (!this.active(actor)) {
      const j = this.journey;
      if (j?.scene === 'm2_trucks' && !j.visiting && j.trucks?.road && j.trucks.hood && ['niobe', 'ghost'].includes(actor.id) && actor.status === 'alive') {
        this.action(actor, tick); return true;
      }
      return false;
    }
    const journey = this.journey!, encounter = journey.trucks!, road = encounter.road!, center = FILM_SETS.film_freeway_101.center;
    const cast = encounter.hood && encounter.hood.phase !== 'done' ? ['keymaker', 'agent_johnson', 'niobe', 'ghost'] : encounter.phase === 'duel' ? ['keymaker', 'agent_johnson'] : ['keymaker', 'neo'];
    road.paused = cast.map(id => this.world.agents.get(id)).find(member => member?.controller)?.name;
    road.unavailable = cast.map(id => this.world.agents.get(id)).find(member => member?.status !== 'alive')?.name;
    if (road.paused || road.unavailable) {
      journey.lastText = road.paused ? `${road.paused} 正由其他玩家控制，卡车和动作已暂停。` : `${road.unavailable} 的信号中断，保留位置与伤势。`;
      this.action(actor, tick); return true;
    }
    const delta = actor.controller && actor.status === 'alive' && ['duel', 'collision'].includes(encounter.phase) ? Math.max(0, Math.min(.1, dt)) : 0;
    if (delta) {
      const before = road.truck.z;
      road.truck.z = Math.min(FILM_SETS.film_freeway_101.depth / 2 - 35, before + TRUCK_ROAD.speed * delta);
      const travel = road.truck.z - before;
      road.elapsed += delta;
      road.phase = road.elapsed < TRUCK_ROAD.approach ? 'approach' : road.elapsed < TRUCK_ROAD.approach + TRUCK_ROAD.drop ? 'dropping'
        : road.elapsed < TRUCK_ROAD.approach + TRUCK_ROAD.drop + TRUCK_ROAD.landing ? 'landing' : 'ready';
      actor.position = { ...actor.position, z: actor.position.z + travel };
      for (const threat of this.sandbox().threats) if (threat.scene === 'm2_trucks') threat.position.z += travel;
    }
    if (encounter.phase === 'duel' && road.phase !== 'ready') {
      actor.rotation = road.checkpoint.morpheus.yaw + (Math.PI - road.checkpoint.morpheus.yaw) * Math.min(1, road.elapsed / 3);
      actor.velocity = { x: 0, y: 0, z: 0 };
      journey.lastText = road.phase === 'approach' ? '钥匙匠退到车顶后端。高架上，一名特工盯住了这辆卡车。'
        : road.phase === 'dropping' ? 'Johnson 从高架跃下。转动视角观察，他正落向你身后的车顶。' : 'Johnson 落地屈膝；保持距离，准备迎战。';
    } else if (encounter.phase === 'duel' && !journey.fighting) journey.lastText = 'Johnson 已落到车顶。按 G 持枪与刀迎战；鼠标瞄准，左键 / T 射击，F 挥刀，X 格挡。';
    if (encounter.phase === 'duel' || encounter.phase === 'collision') {
      for (const role of ['keymaker', 'agent_johnson', 'niobe', 'neo', 'ghost'] as const) {
        const member = this.world.agents.get(role); if (!member || member.controller || member.status !== 'alive') continue;
        if (role === 'ghost' && !encounter.hood) continue;
        const threat = role === 'agent_johnson' && this.sandbox().threats.find(item => item.scene === 'm2_trucks' && item.character === role);
        if (threat) { member.position = { ...threat.position }; this.action(member, tick); continue; }
        if (encounter.phase === 'collision' && role === 'agent_johnson') continue;
        const armedRoot = role === 'agent_johnson' && this.weapons.johnsonRoot();
        const driverRoot = encounter.hood && (role === 'niobe' || role === 'ghost') ? truckHoodRoot(encounter.hood, role) : undefined;
        const root = driverRoot ? { ...driverRoot, x: road.truck.x + driverRoot.x, z: road.truck.z + driverRoot.z }
          : armedRoot ? { ...armedRoot, x: road.truck.x + armedRoot.x, z: road.truck.z + armedRoot.z }
          : role === 'keymaker' || role === 'agent_johnson' ? truckRoadRoot(road, role)
          : role === 'neo' ? truckApproachPose(encounter.elapsed, road) : truckRoadPoint(road, { ...TRUCKS.niobe, y: .5, yaw: 0 });
        member.position = { x: center.x + root.x, y: center.y + root.y, z: center.z + root.z };
        member.rotation = root.yaw; member.currentLocation = 'film_freeway_101'; member.isInMatrix = true;
        member.velocity = { x: 0, y: 0, z: 0 }; member.targetPosition = null; member.currentPath = [];
        this.action(member, tick);
      }
    }
    if (this.hood.active(actor) && encounter.weapons) encounter.weapons.total += delta;
    this.weapons.frame(actor, delta, tick);
    this.hood.frame(actor, input, delta, tick);
    const roof = this.sandbox().structures.find(item => item.id === 'film:truck-road:roof');
    const position = { x: center.x + road.truck.x, y: center.y + TRUCKS.roof.height, z: center.z + road.truck.z - 3.5 };
    if (roof) roof.position = position;
    else this.sandbox().structures.push({ id: 'film:truck-road:roof', kind: 'barricade', owner: 'morpheus', position, matrix: true, health: 1e6,
      film: { scene: 'm2_trucks', width: TRUCKS.roof.width, depth: TRUCKS.roof.depth, height: 0 } });
    if (delta && encounter.phase === 'duel' && !this.hood.active(actor) && actor.position.y < center.y + 3.5) {
      encounter.phase = 'failed'; actor.health = 0; actor.status = 'dead'; journey.lastText = '你掉下了行驶中的卡车。按 J 重试这个车顶检查点。';
    }
    this.action(actor, tick);
    return this.locked(actor) || encounter.phase === 'failed';
  }
  action(actor: AgentState, tick: number): void {
    if (this.journey?.scene !== 'm2_trucks' || !this.journey.trucks?.road || this.journey.trucks.phase === 'rescued' || this.journey.visiting) return;
    const road = this.journey.trucks.road;
    if (!actor.currentAction || actor.currentAction.parameters.freewayHandoff) actor.currentAction = { type: 'idle', parameters: { resolved: true }, startedAt: tick, duration: 1e9, progress: 0 };
    actor.currentAction.parameters.truckRoad = { ...road, truck: { ...road.truck }, role: actor.id };
    actor.currentAction.parameters.player = actor.id === this.journey.actor && Boolean(actor.controller);
    if (actor.id === 'niobe') actor.currentAction.parameters.seated = true;
    if (actor.id === 'neo') actor.currentAction.parameters.truckFlight = true;
    this.weapons.action(actor, tick);
    this.hood.action(actor, tick);
  }
  command(actor: AgentState, target: string, tick: number): string | undefined {
    if (!this.active(actor)) return;
    const journey = this.journey!, encounter = journey.trucks!;
    this.frame(actor, 0, tick);
    if (encounter.road!.paused || encounter.road!.unavailable || target !== 'retry' && this.locked(actor)) return journey.lastText;
    if (target === 'retry' && encounter.hood && encounter.hood.phase !== 'done') return this.hood.retry(actor, tick);
    if (target === 'act' && journey.step === 0 && encounter.phase === 'duel') {
      if (encounter.weapons?.phase === 'unarmed') return journey.lastText;
      return this.weapons.start(actor, tick);
    }
    if (target !== 'retry') return;
    if (encounter.phase === 'rescue' && actor.status === 'alive') return '已保留空中接应位置与进度。';
    const road = encounter.road!, center = FILM_SETS.film_freeway_101.center;
    actor.status = 'alive'; actor.health = road.checkpoint.health; actor.activeEffects = [];
    actor.position = { x: center.x + road.truck.x + road.checkpoint.morpheus.x, y: center.y + TRUCKS.roof.height, z: center.z + road.truck.z + road.checkpoint.morpheus.z };
    actor.rotation = road.checkpoint.morpheus.yaw;
    this.sandbox().threats = this.sandbox().threats.filter(item => item.scene !== 'm2_trucks');
    delete journey.started; delete journey.fighting;
    encounter.attempt++; encounter.elapsed = 0; encounter.lastTick = tick; delete encounter.starts; delete encounter.startElapsed; delete encounter.rescueElapsed;
    delete encounter.weapons;
    if (journey.step === 0) {
      const johnson = this.world.agents.get('agent_johnson')!;
      johnson.status = 'alive'; johnson.health = johnson.maxHealth;
      const keymaker = this.world.agents.get('keymaker')!;
      const key: TruckRoot = { x: keymaker.position.x - center.x - road.truck.x, y: keymaker.position.y - center.y, z: keymaker.position.z - center.z - road.truck.z, yaw: keymaker.rotation };
      encounter.road = newTruckRoad(road.truck, road.checkpoint.morpheus, key, road.checkpoint.health); encounter.phase = 'duel';
    } else { journey.step = 1; encounter.phase = 'collision'; }
    journey.checkpoint = { ...actor.position }; this.frame(actor, 0, tick);
    return '已恢复当前车顶检查点；钥匙匠与 Neo 的伤势保留。';
  }
}
