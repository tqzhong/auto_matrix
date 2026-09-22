import { FILM_SETS, LOBBY_COLUMNS, LOBBY_ENTRY, RESCUE_LOADOUTS, rescueLoadout, filmPosition, lobbyCover, rayBox, combatDisplace, distance,
  type AgentState, type SandboxState, type SandboxThreat, type CombatImpact, type Vector3, type RescueLoadoutSpec, type LobbyEncounter, type LobbyRole } from '@auto_matrix/shared';
import type { WorldState } from '../world/WorldState.js';

const SET = FILM_SETS.film_government_lobby;
const muzzle = (p: Vector3): Vector3 => ({ ...p, y: p.y + 2.3 });
const directionTo = (a: Vector3, b: Vector3): Vector3 => {
  const length = Math.max(.001, distance(a, b)); return { x: (b.x - a.x) / length, y: (b.y - a.y) / length, z: (b.z - a.z) / length };
};

/** One authored encounter. All damage, line of sight, waves and ammunition live on the server. */
export class LobbyCombatSystem {
  onImpact?: (impact: CombatImpact, tick: number) => void;
  onHit?: (owner: AgentState, target: SandboxThreat, damage: number, tick: number) => void;
  constructor(private world: WorldState, private sandbox: () => SandboxState) {}
  get state() { return this.sandbox().neoLife?.journey?.lobby; }
  private spec(): RescueLoadoutSpec {
    const journey = this.sandbox().neoLife?.journey; const selected = this.state?.loadout ?? journey?.rescue?.loadout;
    return selected ? RESCUE_LOADOUTS[selected] : rescueLoadout(journey);
  }
  private normalize(state = this.state): LobbyEncounter | undefined {
    if (!state) return;
    state.phase ??= state.wave > 0 ? 'combat' : 'ready';
    state.elapsed ??= 0;
    return state;
  }
  reset(): void {
    const loadout = rescueLoadout(this.sandbox().neoLife!.journey!);
    this.sandbox().neoLife!.journey!.lobby = { phase: 'ready', elapsed: 0, loadout: loadout.id, ammo: loadout.magazine, wave: 0, columns: LOBBY_COLUMNS.map(() => 0), allyShotAt: -10, shots: 0, kills: 0 };
  }
  active(actor: AgentState): boolean {
    const journey = this.sandbox().neoLife?.journey;
    return Boolean(journey?.scene === 'm1_lobby' && !journey.visiting && journey.actor === actor.id && journey.step === 1 && journey.fighting
      && actor.controller && actor.status === 'alive' && actor.isInMatrix && actor.currentLocation === SET.id);
  }
  start(actor: AgentState, tick: number): void {
    this.reset(); this.state!.phase = 'checkpoint'; this.stageEntry(actor, 0, tick);
    this.sandbox().neoLife!.journey!.lastText = 'Neo 与 Trinity 走进安检区。警卫的目光移向装满武器的行李。';
  }
  occupied(): AgentState | undefined {
    return ['trinity', 'citizen_12'].map(id => this.world.agents.get(id)).find(actor => actor?.controller);
  }
  private entryActor(role: LobbyRole): AgentState | undefined {
    return this.world.agents.get(role === 'guard' ? 'citizen_12' : role);
  }
  private stageEntry(actor: AgentState, dt: number, tick: number): void {
    const state = this.normalize()!; const elapsed = state.elapsed ?? 0;
    for (const role of ['neo', 'trinity', 'guard'] as const) {
      const performer = this.entryActor(role); if (!performer || performer.controller && performer !== actor) continue;
      const root = LOBBY_ENTRY.roots[role]; const before = performer.position;
      performer.position = filmPosition(SET.id, root.x, root.z); performer.rotation = root.yaw;
      performer.velocity = dt > 0 ? { x: (performer.position.x - before.x) / dt, y: 0, z: (performer.position.z - before.z) / dt } : { x: 0, y: 0, z: 0 };
      performer.currentLocation = SET.id; performer.isInMatrix = true;
      const armed = role !== 'guard' && elapsed >= LOBBY_ENTRY.drawAt;
      performer.currentAction = { type: 'idle', parameters: { player: performer === actor, resolved: true, armed, weaponStyle: armed ? this.spec().id : undefined,
        lobbyEntry: { phase: 'checkpoint', elapsed, role } }, startedAt: tick, duration: 1, progress: 0 };
    }
  }
  private finishEntry(actor: AgentState, tick: number): void {
    const state = this.normalize()!; state.phase = 'combat'; state.elapsed = LOBBY_ENTRY.duration;
    for (const role of ['neo', 'trinity'] as const) {
      const performer = this.world.agents.get(role); if (!performer || performer.controller && performer !== actor) continue;
      performer.currentAction = { type: 'idle', parameters: { player: performer === actor, resolved: true, armed: true, weaponStyle: this.spec().id }, startedAt: tick, duration: 1, progress: 0 };
      performer.velocity = { x: 0, y: 0, z: 0 };
    }
    const guard = this.world.agents.get('citizen_12');
    if (guard && !guard.controller) {
      const root = LOBBY_ENTRY.roots.guard; guard.position = filmPosition(SET.id, root.x, root.z); guard.rotation = root.yaw; guard.velocity = { x: 0, y: 0, z: 0 };
      guard.currentLocation = SET.id; guard.isInMatrix = true;
      guard.currentAction = { type: 'idle', parameters: { resolved: true, lobbyEntry: { phase: 'down', elapsed: LOBBY_ENTRY.duration, role: 'guard' } }, startedAt: tick, duration: 100000, progress: 0 };
    }
    this.wave(actor, tick);
  }
  frame(actor: AgentState, dt: number, tick: number): boolean {
    const journey = this.sandbox().neoLife?.journey; const state = this.normalize();
    if (!journey || journey.scene !== 'm1_lobby' || journey.visiting || journey.actor !== actor.id || !journey.fighting || !state || state.phase !== 'checkpoint') return false;
    const occupied = this.occupied();
    if (occupied) { journey.lastText = `${occupied.name} 正由另一位玩家控制；安检动作停在保存的位置。`; return true; }
    state.elapsed = Math.min(LOBBY_ENTRY.duration, (state.elapsed ?? 0) + Math.max(0, Math.min(.1, dt)));
    this.stageEntry(actor, dt, tick); journey.checkpoint = { ...actor.position };
    journey.lastText = state.elapsed < LOBBY_ENTRY.alarmAt ? 'Neo 与 Trinity 走进安检区。警卫的目光移向装满武器的行李。'
      : state.elapsed < LOBBY_ENTRY.drawAt ? '金属探测器发出警报。警卫伸手摸向报警按钮。'
      : state.elapsed < LOBBY_ENTRY.duration ? 'Neo 与 Trinity 同时拔枪。入口警卫倒下，整座大厅进入警戒。'
      : journey.lastText;
    if (state.elapsed >= LOBBY_ENTRY.duration - .0001) { state.elapsed = LOBBY_ENTRY.duration; this.finishEntry(actor, tick); }
    return state.phase === 'checkpoint';
  }
  private wave(actor: AgentState, tick: number): void {
    const state = this.state!; state.wave++; delete state.nextWaveAt;
    const positions = state.wave === 1 ? [[-5, 9], [5, 5]] : state.wave === 2 ? [[-14, -7], [5, -18], [14, -21]] : [[-5, -31], [14, -32], [-14, -35]];
    for (const [i, [x, z]] of positions.entries()) {
      const health = state.wave === 1 ? 48 : 72;
      this.sandbox().threats.push({ id: `film:${++this.sandbox().serial}`, scene: 'm1_lobby', kind: 'soldier', position: filmPosition(SET.id, x, z), matrix: true,
        health, maxHealth: health, target: actor.id, stunUntil: tick + 2, lastStrike: tick + i });
    }
    this.sandbox().neoLife!.journey!.lastText = state.wave === 1 ? '警戒启动。左键 / T 射击 · R 换弹 · F 近战 · X 闪避。Trinity 在侧翼掩护。'
      : state.wave === 2 ? '增援从侧廊进入。利用柱列切断射线，再探身还击。' : '最后一组警卫守住电梯。Trinity：我掩护你，继续向前。';
  }
  reload(actor: AgentState, tick: number): string {
    if (!this.active(actor) || !this.state) return '';
    const spec = this.spec();
    if (this.state.reloadAt !== undefined || this.state.ammo === spec.magazine) return '';
    this.state.reloadAt = tick + spec.reloadTicks; return `更换${spec.name}弹药，先退到石柱后。`;
  }
  shoot(actor: AgentState, yaw: number, pitch: number, tick: number): string {
    const phase = this.normalize()?.phase;
    if (!this.active(actor) || !this.state || phase !== 'combat' || !Number.isFinite(yaw) || !Number.isFinite(pitch)) return '';
    const state = this.state; const spec = this.spec();
    if (state.reloadAt !== undefined) return '';
    if (state.ammo <= 0) return this.reload(actor, tick);
    state.ammo--; state.shots++; actor.rotation = yaw;
    const from = muzzle(actor.position); const elevation = Math.max(-1.35, Math.min(1.35, pitch)); const cosine = Math.cos(elevation);
    let direction = { x: Math.sin(yaw) * cosine, y: -Math.sin(elevation), z: Math.cos(yaw) * cosine };
    // Modest three-dimensional aim assist, never through cover.
    const target = this.enemies().map(enemy => ({ enemy, dir: directionTo(from, muzzle(enemy.position)) }))
      .filter(({ enemy, dir }) => dir.x * direction.x + dir.y * direction.y + dir.z * direction.z > spec.aimDot && this.visible(from, muzzle(enemy.position)))
      .sort((a, b) => distance(a.enemy.position, actor.position) - distance(b.enemy.position, actor.position))[0];
    if (target) direction = target.dir;
    this.fire(actor.id, from, direction, actor, spec.damage, tick);
    return '';
  }
  private enemies(): SandboxThreat[] { return this.sandbox().threats.filter(t => t.scene === 'm1_lobby'); }
  private visible(from: Vector3, to: Vector3): boolean { return lobbyCover(from, directionTo(from, to), SET.center).distance + .05 >= distance(from, to); }
  private fire(source: string, from: Vector3, direction: Vector3, owner: AgentState, damage: number, tick: number): void {
    const cover = lobbyCover(from, direction, SET.center); let hitDistance = cover.distance; let target: SandboxThreat | undefined;
    for (const enemy of this.enemies()) {
      const p = enemy.position;
      const hit = rayBox(from, direction, { x: p.x - .8, y: p.y - .8, z: p.z - .8 }, { x: p.x + .8, y: p.y + 3.4, z: p.z + .8 });
      if (hit !== undefined && hit < hitDistance) { target = enemy; hitDistance = hit; }
    }
    let dealt = 0;
    if (target) {
      const health = target.health;
      this.onHit?.(owner, target, damage, tick); dealt = health - target.health;
      target.stunUntil = tick + 1; delete target.attackAt; delete target.aim;
      if (target.health <= 0) this.state!.kills++;
    } else if (cover.column !== undefined) this.state!.columns[cover.column] = Math.min(100, this.state!.columns[cover.column] + 25);
    this.onImpact?.({ source, target: target?.id ?? 'lobby-stone', position: { x: from.x + direction.x * hitDistance, y: from.y + direction.y * hitDistance, z: from.z + direction.z * hitDistance },
      direction, damage: dealt, combo: 0, matrix: true, downed: Boolean(target && target.health <= 0), shot: { from, column: target ? undefined : cover.column, surface: target ? 'body' : 'stone' } }, tick);
  }
  tick(actor: AgentState, tick: number): boolean {
    if (!this.active(actor)) return false;
    // Saves from the older melee-only lobby resume at the encounter entrance.
    if (!this.state) { this.sandbox().threats = this.sandbox().threats.filter(t => t.scene !== 'm1_lobby'); this.start(actor, tick); }
    const state = this.normalize()!;
    if (state.phase === 'cleared') return true;
    if (state.phase !== 'combat') return false;
    if (state.reloadAt !== undefined && tick >= state.reloadAt) { state.ammo = this.spec().magazine; delete state.reloadAt; }
    const enemies = this.enemies();
    if (!enemies.length) {
      if (state.wave >= 3) { state.phase = 'cleared'; return true; }
      state.nextWaveAt ??= tick + 3;
      if (tick >= state.nextWaveAt) this.wave(actor, tick);
    }
    for (const enemy of enemies) {
      if (tick < enemy.stunUntil) continue;
      const from = muzzle(enemy.position); const to = muzzle(actor.position);
      if (enemy.attackAt !== undefined && enemy.aim) {
        if (tick < enemy.attackAt) continue;
        const aim = enemy.aim; const direction = directionTo(from, aim); const cover = lobbyCover(from, direction, SET.center);
        const dodging = actor.activeEffects.some(e => ['dodge', 'agent_dodge', 'phase_shift'].includes(e.visualEffect));
        const hit = !dodging && distance(to, aim) < 1.65 && this.visible(from, to);
        const damage = hit ? actor.activeEffects.some(e => e.visualEffect === 'slow_motion') ? 2 : 7 : 0;
        actor.health = Math.max(0, actor.health - damage);
        const length = hit ? distance(from, to) : cover.distance;
        if (!hit && cover.column !== undefined) state.columns[cover.column] = Math.min(100, state.columns[cover.column] + 18);
        this.onImpact?.({ source: enemy.id, target: hit ? actor.id : 'lobby-stone', position: { x: from.x + direction.x * length, y: from.y + direction.y * length, z: from.z + direction.z * length },
          direction, damage, combo: 0, matrix: true, downed: actor.health <= 0, shot: { from, column: hit ? undefined : cover.column, surface: hit ? 'body' : 'stone' } }, tick);
        enemy.lastStrike = tick; delete enemy.attackAt; delete enemy.aim;
        if (!actor.health) { actor.status = 'dead'; actor.velocity = { x: 0, y: 0, z: 0 }; actor.currentAction = null; return false; }
      } else if (distance(from, to) < 65 && this.visible(from, to) && tick - enemy.lastStrike >= 5) {
        enemy.aim = { ...to }; enemy.attackAt = tick + 2;
      } else if (distance(from, to) > 16 || !this.visible(from, to)) {
        const toward = directionTo(enemy.position, actor.position);
        const next = combatDisplace(enemy.position, { ...toward, y: 0 }, 1.2, true);
        enemy.position = distance(next, enemy.position) < .1 ? combatDisplace(enemy.position, { x: -Math.sign(enemy.position.x - SET.center.x), y: 0, z: 0 }, 1.2, true) : next;
      }
    }
    const ally = this.world.agents.get('trinity');
    if (ally && !ally.controller && ally.status === 'alive') {
      const weaponStyle = this.spec().id;
      if (!ally.currentAction?.parameters.armed || ally.currentAction.parameters.weaponStyle !== weaponStyle) ally.currentAction = { type: 'idle', parameters: { resolved: true, armed: true, weaponStyle }, startedAt: tick, duration: 1, progress: 0 };
      const target = { ...actor.position, x: Math.max(SET.center.x - 16, actor.position.x - 4.5), z: Math.min(SET.center.z + 34, actor.position.z + 1.5) };
      const before = ally.position;
      ally.position = combatDisplace(before, directionTo(before, target), Math.min(2.4, distance(before, target)), true);
      ally.velocity = { x: (ally.position.x - before.x) * 2, y: 0, z: (ally.position.z - before.z) * 2 };
      const targetEnemy = this.enemies().filter(e => this.visible(muzzle(ally.position), muzzle(e.position))).sort((a, b) => distance(a.position, ally.position) - distance(b.position, ally.position))[0];
      if (targetEnemy) {
        const direction = directionTo(muzzle(ally.position), muzzle(targetEnemy.position)); ally.rotation = Math.atan2(direction.x, direction.z);
        if (tick - state.allyShotAt >= 6) { this.fire(ally.id, muzzle(ally.position), direction, actor, 12, tick); state.allyShotAt = tick; }
      }
    }
    return false;
  }
}
