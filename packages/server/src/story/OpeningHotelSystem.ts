import { FILM_SETS, OPENING_HOTEL, distance, filmPosition, playerBlocked, rayBox,
  type AgentState, type CombatImpact, type OpeningHotelEncounter, type SandboxState, type SandboxThreat, type Vector3 } from '@auto_matrix/shared';

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
  constructor(private sandbox: () => SandboxState) {}
  get journey() { return this.sandbox().neoLife?.journey; }
  get state(): OpeningHotelEncounter | undefined { return this.journey?.openingHotel; }
  get enemies(): SandboxThreat[] { return this.sandbox().threats.filter(threat => threat.scene === 'm1_room303'); }
  reset(tick: number, attempts = 0): void {
    this.journey!.openingHotel = { phase: 'trace', elapsed: 0, lastTick: tick, attempts, disarmed: false, ammo: 0, shots: 0 };
    this.sync();
  }
  clear(): void { this.sandbox().structures = this.sandbox().structures.filter(structure => !structure.id.startsWith('film:hotel303:')); }
  sync(): void {
    if (this.journey?.scene !== 'm1_room303' || this.journey.visiting) { this.clear(); return; }
    const barriers: { x: number; z: number; width: number; depth: number; height: number }[] = [...OPENING_HOTEL.walls];
    if (this.state?.phase === 'trace') barriers.push({ x: 0, z: OPENING_HOTEL.doorZ, width: 6.7, depth: .65, height: 8 });
    this.sandbox().structures = this.sandbox().structures.filter(structure => !structure.id.startsWith('film:hotel303:') || Number(structure.id.slice('film:hotel303:'.length)) < barriers.length);
    barriers.forEach((barrier, index) => {
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
    } else if (this.journey.step >= 2) this.state!.phase = this.journey.step === 2 ? 'phone' : 'corridor';
    this.sync();
  }
  begin(actor: AgentState, tick: number): string {
    this.ensure(tick);
    if (this.state?.phase !== 'trace') return this.journey!.lastText;
    this.state.phase = 'breach'; this.state.elapsed = 0; this.state.lastTick = tick;
    this.sync();
    this.onAdvance?.('屏幕上的追踪完成。门外脚步停住，Trinity 挂断线路、举起双手；警员撞开 303 的门。', actor, tick);
    return this.journey!.lastText;
  }
  private spawn(actorId: string, tick: number): void {
    const characters = ['citizen_4', 'citizen_14', 'citizen_10', 'citizen_13'];
    OPENING_HOTEL.police.forEach(([x, z], index) => this.sandbox().threats.push({ id: `film:${++this.sandbox().serial}`,
      scene: 'm1_room303', kind: 'soldier', character: characters[index], position: filmPosition(SET.id, x, z), matrix: true,
      health: index === 0 ? 42 : 44, maxHealth: index === 0 ? 42 : 44, target: actorId,
      stunUntil: tick + (index === 0 ? 1 : 3), lastStrike: tick + index }));
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
    this.journey!.lastText = 'Trinity 护住头部，冲过走廊尽头的破窗。玻璃碎片落向消防梯。';
    actor.rotation = Math.PI;
    return this.journey!.lastText;
  }
  frame(actor: AgentState): void {
    const state = this.state; if (!state) return;
    if (state.phase === 'breach') {
      actor.velocity = { x: 0, y: 0, z: 0 };
      actor.currentAction = { type: 'idle', parameters: { resolved: true, hotel303: { phase: 'surrender', elapsed: state.elapsed } }, startedAt: state.lastTick, duration: 1, progress: 0 };
    } else if (state.phase === 'dive') {
      const progress = Math.min(1, state.elapsed / OPENING_HOTEL.diveSeconds);
      actor.position = filmPosition(SET.id, OPENING_HOTEL.window.x, OPENING_HOTEL.window.z - progress * 6);
      actor.position.y = SET.center.y + Math.sin(progress * Math.PI) * 1.1 - progress * 2.2;
      actor.velocity = { x: 0, y: -2.2 / OPENING_HOTEL.diveSeconds, z: -6 / OPENING_HOTEL.diveSeconds };
      actor.currentAction = { type: 'idle', parameters: { resolved: true, hotel303: { phase: 'dive', elapsed: state.elapsed } }, startedAt: state.lastTick, duration: 1, progress: 0 };
    }
  }
  tick(actor: AgentState, tick: number): boolean {
    if (this.journey?.scene !== 'm1_room303' || this.journey.visiting) return false;
    this.ensure(tick);
    this.sync();
    const state = this.state!;
    const dt = Math.min(.5, Math.max(0, tick - state.lastTick) * .5);
    state.lastTick = tick;
    if (state.phase === 'breach' || state.phase === 'dive') {
      state.elapsed += dt; this.frame(actor);
      if (state.phase === 'breach' && state.elapsed >= OPENING_HOTEL.breachSeconds) {
        state.phase = 'combat'; state.elapsed = 0; this.journey.fighting = true;
        actor.currentAction = null; this.spawn(actor.id, tick);
        this.journey.lastText = '四名警员冲进 303。领头警员伸手铐人：F 反击、X 躲开瞄准，击倒一人后按 G 夺枪。';
      } else if (state.phase === 'dive' && state.elapsed >= OPENING_HOTEL.diveSeconds) {
        state.phase = 'done'; this.onAdvance?.('Trinity 撞开玻璃，落在消防梯上，随后沿梯子向屋顶攀去。', actor, tick);
      }
      return true;
    }
    if (state.phase === 'failed') return true;
    if (state.phase !== 'combat') return false;
    if (actor.status !== 'alive' || actor.health <= 0) {
      state.phase = 'failed'; this.journey.lastText = '警员的枪线封死 303。J 打开手记，从破门检查点重试。'; return true;
    }
    if (state.reloadAt !== undefined && tick >= state.reloadAt) { state.ammo = OPENING_HOTEL.magazine; delete state.reloadAt; }
    if (!this.enemies.length) {
      if (state.disarmed) { state.phase = 'phone'; this.onAdvance?.('警员倒下。Trinity 拿起房间电话，向 Morpheus 询问新的安全出口。', actor, tick); }
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
