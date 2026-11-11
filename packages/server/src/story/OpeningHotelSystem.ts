import { FILM_SETS, OPENING_ESCAPE, OPENING_HOTEL, distance, filmPosition, openingHotelAlleyGuard, openingHotelBreachOfficer, openingHotelClimbPose, openingHotelClimbed, openingHotelDivePose, openingHotelDoorHit, openingHotelGlassBroken, openingHotelLanded, openingHotelPhoneLine, openingHotelPhonePose, playerBlocked, rayBox,
  type AgentState, type CombatImpact, type OpeningHotelEncounter, type OpeningPursuer, type OpeningPursuitCast, type OpeningPursuitGesture, type SandboxState, type SandboxThreat, type Vector3 } from '@auto_matrix/shared';
import type { WorldState } from '../world/WorldState.js';

const SET = FILM_SETS.film_heart_hotel;
const muzzle = (position: Vector3): Vector3 => ({ ...position, y: position.y + 2.35 });
const directionTo = (from: Vector3, to: Vector3): Vector3 => {
  const length = Math.max(.01, distance(from, to));
  return { x: (to.x - from.x) / length, y: (to.y - from.y) / length, z: (to.z - from.z) / length };
};

export class OpeningHotelSystem {
  onAdvance?: (text: string, actor: AgentState, tick: number) => void;
  onImpact?: (impact: CombatImpact, tick: number) => void;
  onHit?: (actor: AgentState, target: SandboxThreat, damage: number, tick: number) => void;
  constructor(private world: WorldState, private sandbox: () => SandboxState) {}
  get journey() { return this.sandbox().neoLife?.journey; }
  get state(): OpeningHotelEncounter | undefined { return this.journey?.openingHotel; }
  get enemies(): SandboxThreat[] { return this.sandbox().threats.filter(threat => threat.scene === 'm1_room303'); }
  reset(tick: number, attempts = 0): void {
    this.restorePursuers(this.state?.pursuit);
    this.journey!.openingHotel = { phase: 'trace', elapsed: 0, lastTick: tick, attempts, disarmed: false, ammo: 0, shots: 0 };
    this.sync();
  }
  clear(): void {
    this.restorePursuers(this.state?.pursuit ?? this.journey?.openingRoof?.pursuit);
    this.sandbox().structures = this.sandbox().structures.filter(structure => !structure.id.startsWith('film:hotel303:'));
  }
  private restorePursuers(cast?: OpeningPursuitCast): void {
    if (!cast) return;
    for (const [id, saved] of Object.entries(cast)) {
      const actor = this.world.agents.get(id);
      if (!actor || actor.controller || !saved) continue;
      const action = actor.currentAction?.parameters;
      if (action?.hotelPursuit || id === 'agent_brown' && actor.currentLocation === 'film_hotel_roofs' && action?.filmPursuit)
        Object.assign(actor, saved);
    }
  }
  private corridorPursuer(id: OpeningPursuer, cast: OpeningPursuitCast): AgentState | undefined {
    const actor = this.world.agents.get(id);
    if (!actor || actor.controller || actor.status !== 'alive') return;
    if (cast[id]) return actor.currentLocation === SET.id && actor.currentAction?.parameters.hotelPursuit ? actor : undefined;
    const { position, rotation, velocity, currentLocation, isInMatrix, targetPosition, currentPath, currentAction } = actor;
    cast[id] = structuredClone({ position, rotation, velocity, currentLocation, isInMatrix, targetPosition, currentPath, currentAction });
    return actor;
  }
  private placePursuer(actor: AgentState, set: string, position: Vector3, yaw: number, dt: number, tick: number, lookPitch?: number): void {
    const previous = actor.currentLocation === set ? actor.currentAction?.parameters.hotelPursuit as OpeningPursuitGesture | undefined : undefined;
    const velocity = previous && dt > 0 ? { x: (position.x - actor.position.x) / dt, y: 0, z: (position.z - actor.position.z) / dt } : { x: 0, y: 0, z: 0 };
    const speed = Math.hypot(velocity.x, velocity.z);
    if (previous && speed === 0 && previous.speed === 0 && actor.rotation === yaw && distance(actor.position, position) < .001 && previous.lookPitch === lookPitch) return;
    const gesture: OpeningPursuitGesture = { travel: (previous?.travel ?? 0) + speed * dt, speed, ...(lookPitch === undefined ? {} : { lookPitch }) };
    actor.position = position; actor.rotation = yaw; actor.velocity = velocity; actor.currentLocation = set; actor.isInMatrix = true;
    actor.targetPosition = null; actor.currentPath = [];
    actor.currentAction = { type: speed > .05 ? 'move_to' : 'idle', parameters: { resolved: true, hotelPursuit: gesture }, startedAt: tick, duration: 1e9, progress: 0 };
  }
  pursuitFrame(actor: AgentState, dt: number, tick: number): void {
    const journey = this.journey, state = this.state;
    if (dt <= 0 || journey?.scene !== 'm1_room303' || journey.visiting || journey.actor !== actor.id || !state) return;
    const { pursuit, officers, alley, ladderZ } = OPENING_HOTEL, localZ = actor.position.z - SET.center.z;
    if (state.phase === 'corridor' ? !state.pursuit && localZ > pursuit.triggerZ : !['dive', 'ladder_ready', 'climbing', 'done'].includes(state.phase)) return;
    const cast = state.pursuit ??= {};
    const brown = this.corridorPursuer('agent_brown', cast);
    if (brown) {
      const z = brown.currentAction?.parameters.hotelPursuit ? brown.position.z - SET.center.z : pursuit.startZ;
      const end = state.phase === 'corridor' ? Math.max(pursuit.stopZ, localZ + pursuit.spacing) : pursuit.stopZ;
      const next = z - Math.min(Math.max(0, z - end), pursuit.speed * dt);
      this.placePursuer(brown, SET.id, filmPosition(SET.id, 0, next), Math.PI, dt, tick);
      for (const officer of officers) {
        const member = this.corridorPursuer(officer.id, cast);
        if (member) this.placePursuer(member, SET.id, filmPosition(SET.id, officer.x, next + officer.behind), Math.PI, dt, tick);
      }
    }
    if (openingHotelLanded(state) && !cast.smith) {
      const smith = this.corridorPursuer('smith', cast);
      if (smith) {
        const position = filmPosition(SET.id, alley.x, alley.z); position.y += alley.y;
        this.placePursuer(smith, SET.id, position, Math.atan2(-alley.x, ladderZ - alley.z), 0, tick, -.54);
      }
    }
  }
  roofPursuers(dt: number, tick: number, entering = false): void {
    const cast = this.journey?.openingRoof?.pursuit, roof = FILM_SETS.film_hotel_roofs;
    const brown = this.world.agents.get('agent_brown');
    if (!cast || brown?.currentLocation !== roof.id) return;
    if (entering && cast.agent_brown && !brown.controller)
      brown.currentAction = { type: 'idle', parameters: { resolved: true, filmPursuit: true }, startedAt: tick, duration: 1, progress: 0 };
    for (const officer of OPENING_HOTEL.officers) {
      const member = this.world.agents.get(officer.id);
      if (!cast[officer.id] || !member || member.controller || member.status !== 'alive'
        || !entering && (member.currentLocation !== roof.id || !member.currentAction?.parameters.hotelPursuit)) continue;
      const x = Math.max(-roof.width / 2 + 1, Math.min(roof.width / 2 - 1, brown.position.x - roof.center.x + officer.x));
      const z = Math.min(roof.depth / 2 - 1.3, Math.max(OPENING_ESCAPE.roofGapNear + 1.5, brown.position.z - roof.center.z + officer.behind));
      const target = filmPosition(roof.id, x, z);
      const dx = target.x - member.position.x, dz = target.z - member.position.z;
      const length = Math.hypot(dx, dz), step = entering ? 1 : Math.min(1, OPENING_HOTEL.pursuit.speed * dt / Math.max(.001, length));
      const next = entering ? target : { x: member.position.x + dx * step, y: target.y, z: member.position.z + dz * step };
      const yaw = entering ? Math.PI : length > .01 ? Math.atan2(dx, dz) : member.rotation;
      const blocked = !entering && playerBlocked(next, true, .6, this.sandbox().structures);
      this.placePursuer(member, roof.id, blocked ? member.position : next, yaw, dt, tick);
    }
  }
  sync(): void {
    if (this.journey?.scene !== 'm1_room303' || this.journey.visiting) { this.clear(); return; }
    const barriers: { barrier: { x: number; z: number; width: number; depth: number; height: number }; index: number }[] =
      OPENING_HOTEL.walls.map((barrier, index) => ({ barrier, index }));
    if (!openingHotelDoorHit(this.state)) barriers.push({ barrier: { x: 0, z: OPENING_HOTEL.doorZ, width: 6.7, depth: .65, height: 8 }, index: 3 });
    if (!openingHotelGlassBroken(this.state))
      barriers.push({ barrier: { x: 0, z: OPENING_HOTEL.window.paneZ, width: 7.6, depth: .45, height: 8 }, index: 4 });
    const phone = OPENING_HOTEL.phone, actor = this.world.agents.get(this.journey.actor);
    // Saves made before the table was solid can walk out of its footprint.
    if (!actor || Math.abs(actor.position.x - SET.center.x - phone.x) >= phone.width / 2 + 1.1
      || Math.abs(actor.position.z - SET.center.z - phone.z) >= phone.depth / 2 + 1.1) barriers.push({ barrier: phone, index: 5 });
    const active = new Set(barriers.map(({ index }) => `film:hotel303:${index}`));
    this.sandbox().structures = this.sandbox().structures.filter(structure => !structure.id.startsWith('film:hotel303:') || active.has(structure.id));
    barriers.forEach(({ barrier, index }) => {
      const id = `film:hotel303:${index}`;
      if (this.sandbox().structures.some(structure => structure.id === id)) return;
      this.sandbox().structures.push({ id, kind: 'barricade', owner: 'matrix', position: filmPosition(SET.id, barrier.x, barrier.z),
        matrix: true, health: 999, film: { scene: 'm1_room303', width: barrier.width, depth: barrier.depth, height: barrier.height } });
    });
  }
  ensure(tick: number): void {
    if (this.state || this.journey?.scene !== 'm1_room303') return;
    this.reset(tick);
    if (this.journey.step === 1) {
      this.state!.phase = 'combat'; this.journey.fighting = true;
      this.sandbox().threats = this.sandbox().threats.filter(threat => threat.scene !== 'm1_room303');
      this.spawn(this.journey.actor, tick);
    } else if (this.journey.step >= 2) this.state!.phase = this.journey.step === 2 ? 'phone' : this.journey.step >= 5 ? 'ladder_ready' : 'corridor';
    this.sync();
  }
  begin(actor: AgentState, tick: number): string {
    this.ensure(tick);
    if (this.state?.phase !== 'trace') return this.journey!.lastText;
    this.state.phase = 'breach'; this.state.elapsed = 0; this.state.lastTick = tick;
    this.state.breachYaw = actor.rotation;
    this.spawn(actor.id, tick, 0);
    this.frame(actor);
    this.sync();
    this.onAdvance?.('Trinity 挂断被追踪的线路。门外的脚步停住了。', actor, tick);
    return this.journey!.lastText;
  }
  private spawn(actorId: string, tick: number, elapsed: number = OPENING_HOTEL.breachSeconds): void {
    OPENING_HOTEL.combatOfficers.forEach((character, index) => {
      const { x, z } = openingHotelBreachOfficer(index, elapsed);
      this.sandbox().threats.push({ id: `film:${++this.sandbox().serial}`,
      scene: 'm1_room303', kind: 'soldier', character, position: filmPosition(SET.id, x, z), matrix: true,
      health: index === 0 ? 42 : 44, maxHealth: index === 0 ? 42 : 44, target: actorId,
      stunUntil: tick + (index === 0 ? 1 : 3), lastStrike: tick + index });
    });
  }
  copDown(position: Vector3): void {
    const state = this.state;
    if (!state || state.phase !== 'combat' || state.fallen) return;
    state.fallen = { ...position };
    this.journey!.lastText = '第一名警员倒下，手枪滑到地上。靠近落枪位置按 G 夺枪，或继续用 F 还击。';
  }
  disarm(actor: AgentState): string {
    const state = this.state;
    if (!state || state.phase !== 'combat' || !state.fallen || state.disarmed) return this.journey!.lastText;
    if (distance(actor.position, state.fallen) > 4) return '靠近倒下的警员，按 G 夺过手枪。';
    state.disarmed = true; state.ammo = OPENING_HOTEL.magazine;
    this.journey!.lastText = 'Trinity 夺过手枪。左键 / T 开火，F 近身反击，X 避开警员枪线；R 换弹。';
    return this.journey!.lastText;
  }
  active(actor: AgentState): boolean {
    const journey = this.journey;
    return Boolean(journey?.scene === 'm1_room303' && !journey.visiting && journey.actor === actor.id && journey.step === 1
      && this.state?.phase === 'combat' && this.state.disarmed && actor.controller && actor.status === 'alive' && actor.currentLocation === SET.id);
  }
  private visible(from: Vector3, to: Vector3): boolean {
    const direction = directionTo(from, to); const length = distance(from, to);
    return !OPENING_HOTEL.walls.some(wall => {
      const hit = rayBox(from, direction, { x: SET.center.x + wall.x - wall.width / 2, y: SET.center.y, z: SET.center.z + wall.z - wall.depth / 2 },
        { x: SET.center.x + wall.x + wall.width / 2, y: SET.center.y + wall.height, z: SET.center.z + wall.z + wall.depth / 2 });
      return hit !== undefined && hit < length - .1;
    });
  }
  shoot(actor: AgentState, yaw: number, pitch: number, tick: number): string {
    if (!this.active(actor) || !Number.isFinite(yaw) || !Number.isFinite(pitch)) return '';
    const state = this.state!;
    if (state.reloadAt !== undefined) return '';
    if (state.ammo <= 0) return this.reload(actor, tick);
    state.ammo--; state.shots++; actor.rotation = yaw;
    const from = muzzle(actor.position); const elevation = Math.max(-1.3, Math.min(1.3, pitch));
    const forward = { x: Math.sin(yaw) * Math.cos(elevation), y: -Math.sin(elevation), z: Math.cos(yaw) * Math.cos(elevation) };
    const target = this.enemies.map(enemy => ({ enemy, aim: directionTo(from, muzzle(enemy.position)) }))
      .filter(({ enemy, aim }) => aim.x * forward.x + aim.y * forward.y + aim.z * forward.z > .982 && this.visible(from, muzzle(enemy.position)))
      .sort((a, b) => distance(a.enemy.position, from) - distance(b.enemy.position, from))[0];
    const direction = target?.aim ?? forward; const end = target ? muzzle(target.enemy.position) : { x: from.x + direction.x * 38, y: from.y + direction.y * 38, z: from.z + direction.z * 38 };
    const health = target?.enemy.health ?? 0;
    if (target) {
      this.onHit?.(actor, target.enemy, 28, tick);
      target.enemy.stunUntil = tick + 2; delete target.enemy.aim; delete target.enemy.attackAt;
      if (target.enemy.health <= 0) this.copDown(target.enemy.position);
    }
    this.onImpact?.({ source: actor.id, target: target?.enemy.id ?? 'hotel-wall', position: end, direction, damage: health - (target?.enemy.health ?? 0),
      combo: 0, matrix: true, downed: Boolean(target && target.enemy.health <= 0), shot: { from, surface: target ? 'body' : 'stone' } }, tick);
    return target ? '枪声在 303 的烧焦墙壁间回响。' : '';
  }
  reload(actor: AgentState, tick: number): string {
    if (!this.active(actor) || this.state!.reloadAt !== undefined || this.state!.ammo === OPENING_HOTEL.magazine) return '';
    this.state!.reloadAt = tick + 3;
    return 'Trinity 更换弹匣。躲开已经亮起的射线。';
  }
  retry(actor: AgentState, tick: number): string {
    const attempts = (this.state?.attempts ?? 0) + 1;
    this.sandbox().threats = this.sandbox().threats.filter(threat => threat.scene !== 'm1_room303');
    this.reset(tick, attempts); this.state!.phase = 'combat';
    this.sync();
    this.journey!.step = 1; this.journey!.fighting = true; delete this.journey!.started;
    actor.status = 'alive'; actor.health = actor.maxHealth; actor.activeEffects = [];
    actor.position = filmPosition(SET.id, -8, 12); actor.rotation = Math.PI;
    actor.velocity = { x: 0, y: 0, z: 0 }; actor.currentAction = null;
    this.journey!.checkpoint = { ...actor.position };
    this.spawn(actor.id, tick);
    return this.journey!.lastText = '回到 303 房间破门后的瞬间。先用 F 击倒近身警员，再按 G 夺枪。';
  }
  dive(actor: AgentState, tick: number): string {
    if (this.state?.phase !== 'corridor') return this.journey!.lastText;
    this.state.phase = 'dive'; this.state.elapsed = 0; this.state.lastTick = tick;
    const { x, y, z } = actor.position, center = SET.center;
    this.state.diveFrom = { position: { x: x - center.x, y: y - center.y, z: z - center.z }, yaw: actor.rotation };
    this.sync();
    this.journey!.lastText = 'Trinity 护住头部，冲过走廊尽头的破窗。玻璃碎片落向消防梯。';
    this.frame(actor);
    return this.journey!.lastText;
  }
  answer(actor: AgentState, tick: number): string {
    const state = this.state!;
    if (state.phase !== 'phone') return this.journey!.lastText;
    const { x, y, z } = actor.position, center = SET.center;
    state.phase = 'answering'; state.elapsed = 0; state.lastTick = tick;
    state.callFrom = { position: { x: x - center.x, y: y - center.y, z: z - center.z }, yaw: actor.rotation };
    this.frame(actor);
    return this.journey!.lastText;
  }
  beginClimb(actor: AgentState): string {
    if (this.state?.phase !== 'ladder_ready') return this.journey!.lastText;
    this.state.phase = 'climbing'; this.state.climbed = 0;
    this.frame(actor);
    return this.journey!.lastText = 'Trinity 抓住消防梯。按 W 往上攀，S 可退回；爬到屋顶才算脱离 303。';
  }
  climbFrame(actor: AgentState, direction: number, dt: number, tick: number): boolean {
    const state = this.state;
    if (this.journey?.scene !== 'm1_room303' || this.journey.visiting || this.journey.actor !== actor.id || !state) return false;
    if (state.phase === 'done') { this.frame(actor); return true; }
    if (state.phase !== 'climbing') return false;
    const seconds = Math.min(.1, dt), previous = actor.position;
    state.climbed = Math.max(0, Math.min(OPENING_HOTEL.ladderHeight, (state.climbed ?? 0) + direction * seconds * OPENING_HOTEL.climbSpeed));
    this.frame(actor);
    if (seconds > 0) actor.velocity = { x: 0, y: (actor.position.y - previous.y) / seconds, z: (actor.position.z - previous.z) / seconds };
    actor.currentAction = { type: 'move_to', parameters: { player: true, resolved: true, climbing: true, climbDirection: direction }, startedAt: tick, duration: 1, progress: 0 };
    if (state.climbed >= OPENING_HOTEL.ladderHeight) {
      state.phase = 'done'; this.frame(actor);
      this.onAdvance?.('Trinity 爬上屋顶。Brown 和特工紧追而来，必须继续奔跑。', actor, tick);
    }
    return true;
  }
  restoreFrame(actor: AgentState): boolean {
    const journey = this.journey, state = this.state;
    if (journey?.scene !== 'm1_room303' || journey.visiting || journey.actor !== actor.id
      || !state || !['breach', 'answering', 'dive', 'ladder_ready', 'climbing', 'done'].includes(state.phase)) return false;
    const action = actor.currentAction, gesture = action?.parameters.hotel303 as { phase: string; elapsed: number } | undefined;
    const saved = state.phase === 'breach' || state.phase === 'dive' || state.phase === 'answering'
      ? gesture?.phase === (state.phase === 'breach' ? 'surrender' : state.phase === 'answering' ? 'answer' : 'dive') && gesture.elapsed === state.elapsed
      : state.phase !== 'done' && action?.parameters.climbing === true;
    if (!saved) this.frame(actor);
    else if (state.phase === 'ladder_ready' || state.phase === 'climbing') this.placeClimber(actor, state.climbed ?? 0);
    return true;
  }
  private placeClimber(actor: AgentState, climbed: number): void {
    const pose = openingHotelClimbPose(climbed);
    actor.position = { x: SET.center.x, y: SET.center.y + pose.y, z: SET.center.z + pose.z };
  }
  frame(actor: AgentState, dt = 0, tick = this.state?.lastTick ?? 0): void {
    const state = this.state; if (!state) return;
    if (state.phase === 'breach') {
      if (dt > 0 && state.breachYaw === undefined) {
        // A paused save from before staging can resume from its existing clock.
        state.breachYaw = actor.rotation;
        if (!this.enemies.length) this.spawn(actor.id, tick, state.elapsed);
      }
      if (state.breachYaw !== undefined) {
        const doorHit = openingHotelDoorHit(state);
        state.elapsed = Math.min(OPENING_HOTEL.breachSeconds, state.elapsed + Math.max(0, Math.min(.1, dt)));
        const look = Math.atan2(SET.center.x - actor.position.x, SET.center.z + OPENING_HOTEL.doorZ - actor.position.z);
        const turn = Math.atan2(Math.sin(look - state.breachYaw), Math.cos(look - state.breachYaw));
        const weight = Math.max(0, Math.min(1, (state.elapsed - .14) / .61));
        actor.rotation = state.breachYaw + turn * weight * weight * (3 - 2 * weight);
        const finished = state.elapsed >= OPENING_HOTEL.breachSeconds - 1e-6 && dt > 0;
        this.enemies.forEach((enemy, index) => {
          const { x, z } = openingHotelBreachOfficer(index, finished ? OPENING_HOTEL.breachSeconds : state.elapsed);
          enemy.position = filmPosition(SET.id, x, z);
          if (finished) { enemy.stunUntil = tick + (index === 0 ? 1 : 3); enemy.lastStrike = tick + index; }
        });
        if (!doorHit && openingHotelDoorHit(state)) {
          this.sync();
          this.journey!.lastText = '警员撞开房门。Trinity 转过身，慢慢举起双手。';
        }
        if (finished) {
          state.phase = 'combat'; state.elapsed = 0; delete state.breachYaw;
          this.journey!.fighting = true; actor.currentAction = null;
          this.journey!.lastText = '领头警员走近。F 反击、X 躲开瞄准，击倒一人后按 G 夺枪。';
          return;
        }
      }
      actor.velocity = { x: 0, y: 0, z: 0 };
      actor.currentAction = { type: 'idle', parameters: { resolved: true, hotel303: { phase: 'surrender', elapsed: state.elapsed } }, startedAt: state.lastTick, duration: 1, progress: 0 };
    } else if (state.phase === 'answering') {
      const phone = OPENING_HOTEL.phone;
      state.elapsed = Math.min(phone.end, state.elapsed + Math.max(0, Math.min(.1, dt)));
      const pose = openingHotelPhonePose(state.elapsed, state.callFrom);
      actor.position = { x: SET.center.x + pose.x, y: SET.center.y + pose.y, z: SET.center.z + pose.z };
      actor.rotation = pose.yaw; actor.velocity = { x: 0, y: 0, z: 0 };
      if (state.elapsed >= phone.end && dt > 0) {
        state.phase = 'corridor'; state.elapsed = 0; delete state.callFrom; actor.currentAction = null;
        this.onAdvance?.('Wells 与 Lake 的电话还通着。Trinity 放下听筒，穿过走廊找出口。', actor, tick);
        return;
      }
      actor.currentAction = { type: 'idle', parameters: { resolved: true, hotel303: { phase: 'answer', elapsed: state.elapsed, from: state.callFrom } },
        startedAt: state.lastTick, duration: 1, progress: 0 };
      this.journey!.lastText = openingHotelPhoneLine(state.elapsed)?.text
        ?? (state.elapsed >= phone.lower ? 'Trinity 放下听筒，转向走廊。' : 'Trinity 伸手接起电话。');
    } else if (state.phase === 'dive') {
      const broken = openingHotelGlassBroken(state), { ready } = OPENING_HOTEL.roomDive;
      state.elapsed = Math.min(ready, state.elapsed + Math.max(0, Math.min(.1, dt)));
      if (state.elapsed >= ready && dt > 0) {
        state.phase = 'ladder_ready'; state.climbed = 0; delete state.diveFrom;
        this.frame(actor);
        const alleyBlocked = openingHotelAlleyGuard(this.world.agents.get('smith'));
        this.onAdvance?.(alleyBlocked ? 'Smith 已经封住梯下的巷口。按 G 抓稳梯子，再往屋顶爬。' : 'Trinity 落到消防平台，伸手抓住横档。按 G 抓稳梯子，再往上爬。', actor, tick);
        return;
      }
      const pose = openingHotelDivePose(state.elapsed, state.diveFrom);
      const next = openingHotelDivePose(state.elapsed + .001, state.diveFrom);
      actor.position = { x: SET.center.x + pose.x, y: SET.center.y + pose.y, z: SET.center.z + pose.z };
      actor.rotation = pose.yaw;
      actor.velocity = { x: (next.x - pose.x) * 1000, y: (next.y - pose.y) * 1000, z: (next.z - pose.z) * 1000 };
      actor.currentAction = { type: 'idle', parameters: { resolved: true, hotel303: { phase: 'dive', elapsed: state.elapsed } }, startedAt: state.lastTick, duration: 1, progress: 0 };
      if (!broken && openingHotelGlassBroken(state)) this.sync();
    } else {
      const climbed = openingHotelClimbed(state);
      if (climbed === undefined) return;
      this.placeClimber(actor, climbed);
      actor.rotation = Math.PI;
      actor.velocity = { x: 0, y: 0, z: 0 };
      actor.currentAction = state.phase === 'done' ? null
        : { type: 'move_to', parameters: { player: true, resolved: true, climbing: true, climbDirection: 0 }, startedAt: state.lastTick, duration: 1, progress: 0 };
    }
  }
  tick(actor: AgentState, tick: number): boolean {
    if (this.journey?.scene !== 'm1_room303' || this.journey.visiting) return false;
    this.ensure(tick);
    this.sync();
    const state = this.state!;
    state.lastTick = tick;
    if (state.phase === 'breach' || state.phase === 'dive' || state.phase === 'answering') return true;
    if (state.phase === 'ladder_ready' || state.phase === 'climbing' || state.phase === 'done') { this.frame(actor); return true; }
    if (state.phase === 'failed') return true;
    if (state.phase !== 'combat') return false;
    if (actor.status !== 'alive' || actor.health <= 0) {
      state.phase = 'failed'; this.journey.lastText = '警员的枪线封死 303。J 打开手记，从破门检查点重试。'; return true;
    }
    if (state.reloadAt !== undefined && tick >= state.reloadAt) { state.ammo = OPENING_HOTEL.magazine; delete state.reloadAt; }
    if (!this.enemies.length) {
      if (state.disarmed) { state.phase = 'phone'; this.onAdvance?.('警员倒下。走到电话桌前，按 G 联络 Morpheus。', actor, tick); }
      else this.journey.lastText = '枪声停了。靠近倒下的警员按 G，拿起掉落的手枪。';
      return true;
    }
    for (const enemy of this.enemies) {
      const lead = enemy.character === 'citizen_4';
      if (tick < enemy.stunUntil) continue;
      const from = muzzle(enemy.position); const to = muzzle(actor.position);
      if (enemy.attackAt !== undefined && enemy.aim) {
        if (tick < enemy.attackAt) continue;
        const direction = directionTo(from, enemy.aim);
        const dodging = actor.activeEffects.some(effect => ['dodge', 'agent_dodge', 'phase_shift'].includes(effect.visualEffect));
        const hit = !dodging && distance(to, enemy.aim) < 1.9 && this.visible(from, to);
        const damage = hit ? lead ? 5 : 7 : 0;
        actor.health = Math.max(0, actor.health - damage);
        this.onImpact?.({ source: enemy.id, target: hit ? actor.id : 'hotel-wall', position: hit ? to : enemy.aim,
          direction, damage, combo: 0, matrix: true, downed: actor.health <= 0,
          shot: { from, surface: hit ? 'body' : 'stone' } }, tick);
        enemy.lastStrike = tick; delete enemy.attackAt; delete enemy.aim;
        if (actor.health <= 0) { actor.status = 'dead'; state.phase = 'failed'; this.journey.lastText = 'Trinity 被警员击倒。J 打开手记，从破门检查点重试。'; return true; }
      } else if (lead && !state.disarmed && distance(enemy.position, actor.position) > 3.1) {
        const direction = directionTo(enemy.position, actor.position);
        const next = { ...enemy.position, x: enemy.position.x + direction.x * 1.8, z: enemy.position.z + direction.z * 1.8 };
        if (!playerBlocked(next, true, 1, this.sandbox().structures)) enemy.position = next;
      } else if (tick - enemy.lastStrike >= (lead ? 4 : 6) && this.visible(from, to) && distance(from, to) < 28) {
        enemy.aim = { ...to }; enemy.attackAt = tick + 2;
      } else if (!this.visible(from, to) && distance(from, to) > 4) {
        const direction = directionTo(enemy.position, actor.position);
        const next = { ...enemy.position, x: enemy.position.x + direction.x * 1.3, z: enemy.position.z + direction.z * 1.3 };
        if (!playerBlocked(next, true, 1, this.sandbox().structures)) enemy.position = next;
      }
    }
    return true;
  }
}
