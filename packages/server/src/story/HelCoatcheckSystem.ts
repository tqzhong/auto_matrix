import { FILM_SETS, HEL_COATCHECK, filmPosition, helCoatcheckCover, rayBox, distance, playerBlocked,
  type AgentState, type SandboxState, type SandboxThreat, type CombatImpact, type Vector3, type HelCoatcheckEncounter } from '@auto_matrix/shared';
import type { WorldState } from '../world/WorldState.js';

const SET = FILM_SETS.film_club_hel;
const muzzle = (position: Vector3): Vector3 => ({ ...position, y: position.y + 2.3 });
const directionTo = (from: Vector3, to: Vector3): Vector3 => {
  const length = Math.max(.001, distance(from, to));
  return { x: (to.x - from.x) / length, y: (to.y - from.y) / length, z: (to.z - from.z) / length };
};

/** The five guards, counters, gunfire and two companions are one saved encounter. */
export class HelCoatcheckSystem {
  onImpact?: (impact: CombatImpact, tick: number) => void;
  onHit?: (owner: AgentState, target: SandboxThreat, damage: number, tick: number) => void;
  constructor(private world: WorldState, private sandbox: () => SandboxState) {}
  get state(): HelCoatcheckEncounter | undefined { return this.sandbox().neoLife?.journey?.helCoatcheck; }
  reset(): void {
    this.sandbox().neoLife!.journey!.helCoatcheck = { phase: 'ready', ammo: HEL_COATCHECK.magazine, wave: 0,
      shots: 0, kills: 0, allyShotAt: [-10, -10], coverHits: [0, 0, 0] };
  }
  active(actor: AgentState): boolean {
    const journey = this.sandbox().neoLife?.journey;
    return Boolean(journey?.scene === 'm3_hel_entry' && !journey.visiting && journey.actor === actor.id && journey.step === 1 && journey.fighting
      && actor.controller && actor.status === 'alive' && actor.isInMatrix && actor.currentLocation === SET.id);
  }
  start(actor: AgentState, tick: number): void {
    this.sandbox().threats = this.sandbox().threats.filter(threat => threat.scene !== 'm3_hel_entry');
    this.reset(); this.state!.phase = 'combat'; this.wave(actor, tick);
    this.sandbox().neoLife!.journey!.lastText = 'Seraph 把衣帽间女服务生拉到柜台后。五名守卫拔枪，Trinity 与 Morpheus 冲入交火。左键 / T 射击，R 换弹，柜台能挡住子弹。';
    this.stageAllies(tick);
  }
  private enemies(): SandboxThreat[] { return this.sandbox().threats.filter(threat => threat.scene === 'm3_hel_entry'); }
  private wave(actor: AgentState, tick: number): void {
    const state = this.state!; const points = HEL_COATCHECK.waves[state.wave];
    if (!points) return;
    state.wave++; delete state.nextWaveAt;
    for (const [index, [x, z]] of points.entries()) this.sandbox().threats.push({ id: `film:${++this.sandbox().serial}`, scene: 'm3_hel_entry',
      kind: 'soldier', position: filmPosition(SET.id, x, z), matrix: true, health: 48, maxHealth: 48,
      target: actor.id, stunUntil: tick + 2, lastStrike: tick + index });
    if (state.wave === 2) this.sandbox().neoLife!.journey!.lastText = '后排两名守卫从武器墙边探身开火。穿过柜台间的空隙，清出通往舞池的路。';
  }
  private visible(from: Vector3, to: Vector3): boolean {
    return helCoatcheckCover(from, directionTo(from, to)).distance + .05 >= distance(from, to);
  }
  private fire(source: string, from: Vector3, direction: Vector3, owner: AgentState, damage: number, tick: number): void {
    const cover = helCoatcheckCover(from, direction); let hitDistance = cover.distance; let target: SandboxThreat | undefined;
    for (const enemy of this.enemies()) {
      const p = enemy.position;
      const hit = rayBox(from, direction, { x: p.x - .8, y: p.y - .8, z: p.z - .8 }, { x: p.x + .8, y: p.y + 3.4, z: p.z + .8 });
      if (hit !== undefined && hit < hitDistance) { target = enemy; hitDistance = hit; }
    }
    let dealt = 0;
    if (target) {
      const before = target.health;
      this.onHit?.(owner, target, damage, tick); dealt = before - target.health;
      target.stunUntil = tick + 1; delete target.attackAt; delete target.aim;
      if (target.health <= 0) this.state!.kills++;
    } else if (cover.counter !== undefined) this.state!.coverHits[cover.counter] = Math.min(100, this.state!.coverHits[cover.counter] + 20);
    const length = Math.min(55, hitDistance);
    this.onImpact?.({ source, target: target?.id ?? 'hel-counter', position: { x: from.x + direction.x * length, y: from.y + direction.y * length, z: from.z + direction.z * length },
      direction, damage: dealt, combo: 0, matrix: true, downed: Boolean(target && target.health <= 0),
      shot: { from, column: target ? undefined : cover.counter, surface: target ? 'body' : 'stone' } }, tick);
  }
  shoot(actor: AgentState, yaw: number, pitch: number, tick: number): string {
    if (!this.active(actor) || this.state?.phase !== 'combat' || !Number.isFinite(yaw) || !Number.isFinite(pitch)) return '';
    if (this.state.reloadAt !== undefined) return '';
    if (this.state.ammo <= 0) return this.reload(actor, tick);
    this.state.ammo--; this.state.shots++; actor.rotation = yaw;
    const from = muzzle(actor.position); const elevation = Math.max(-1.35, Math.min(1.35, pitch)); const cosine = Math.cos(elevation);
    let direction = { x: Math.sin(yaw) * cosine, y: -Math.sin(elevation), z: Math.cos(yaw) * cosine };
    const assisted = this.enemies().map(enemy => ({ enemy, aim: directionTo(from, muzzle(enemy.position)) }))
      .filter(({ enemy, aim }) => aim.x * direction.x + aim.y * direction.y + aim.z * direction.z > .985 && this.visible(from, muzzle(enemy.position)))
      .sort((a, b) => distance(a.enemy.position, actor.position) - distance(b.enemy.position, actor.position))[0];
    if (assisted) direction = assisted.aim;
    this.fire(actor.id, from, direction, actor, HEL_COATCHECK.damage, tick);
    return '';
  }
  reload(actor: AgentState, tick: number): string {
    if (!this.active(actor) || !this.state || this.state.reloadAt !== undefined || this.state.ammo === HEL_COATCHECK.magazine) return '';
    this.state.reloadAt = tick + HEL_COATCHECK.reloadTicks;
    return 'Trinity 更换弹匣。趁守卫瞄准前退到衣帽柜台侧面。';
  }
  private stageAllies(tick: number): void {
    for (const [index, id] of (['morpheus', 'seraph'] as const).entries()) {
      const ally = this.world.agents.get(id); if (!ally || ally.controller) continue;
      const root = HEL_COATCHECK.allies[id];
      if (this.state?.phase === 'combat' && ally.currentLocation === SET.id) {
        ally.position = filmPosition(SET.id, root.x, root.z); ally.rotation = Math.PI; ally.velocity = { x: 0, y: 0, z: 0 };
        ally.currentAction = { type: 'idle', parameters: { resolved: true, armed: true, weaponStyle: 'hel_pistol' }, startedAt: tick, duration: 1, progress: 0 };
        if (tick - this.state.allyShotAt[index] >= 6) {
          const from = muzzle(ally.position);
          const enemy = this.enemies().find(threat => threat.health > 12 && this.visible(from, muzzle(threat.position)));
          if (enemy) { this.state.allyShotAt[index] = tick; this.fire(id, from, directionTo(from, muzzle(enemy.position)), ally, 12, tick); }
        }
      } else if (ally.currentAction?.parameters.weaponStyle === 'hel_pistol') ally.currentAction = null;
    }
  }
  tick(actor: AgentState, tick: number): boolean {
    if (!this.active(actor)) return false;
    if (!this.state) { this.start(actor, tick); return false; } // Older saves had a generic melee group.
    const state = this.state;
    if (state.phase === 'cleared') return true;
    if (state.phase !== 'combat') return false;
    if (state.reloadAt !== undefined && tick >= state.reloadAt) { state.ammo = HEL_COATCHECK.magazine; delete state.reloadAt; }
    this.stageAllies(tick);
    const enemies = this.enemies();
    state.kills = HEL_COATCHECK.waves.slice(0, state.wave).reduce((count, wave) => count + wave.length, 0) - enemies.length;
    if (!enemies.length) {
      if (state.wave >= HEL_COATCHECK.waves.length) { state.phase = 'cleared'; return true; }
      state.nextWaveAt ??= tick + 3;
      if (tick >= state.nextWaveAt) this.wave(actor, tick);
      return false;
    }
    for (const enemy of enemies) {
      if (tick < enemy.stunUntil) continue;
      const from = muzzle(enemy.position); const to = muzzle(actor.position);
      if (enemy.attackAt !== undefined && enemy.aim) {
        if (tick < enemy.attackAt) continue;
        const direction = directionTo(from, enemy.aim); const cover = helCoatcheckCover(from, direction);
        const dodging = actor.activeEffects.some(effect => ['dodge', 'agent_dodge', 'phase_shift'].includes(effect.visualEffect));
        const hit = !dodging && distance(to, enemy.aim) < 1.65 && this.visible(from, to);
        const damage = hit ? actor.activeEffects.some(effect => effect.visualEffect === 'slow_motion') ? 2 : 7 : 0;
        actor.health = Math.max(0, actor.health - damage);
        if (!hit && cover.counter !== undefined) state.coverHits[cover.counter] = Math.min(100, state.coverHits[cover.counter] + 16);
        const length = hit ? distance(from, to) : Math.min(55, cover.distance);
        this.onImpact?.({ source: enemy.id, target: hit ? actor.id : 'hel-counter', position: { x: from.x + direction.x * length, y: from.y + direction.y * length, z: from.z + direction.z * length },
          direction, damage, combo: 0, matrix: true, downed: actor.health <= 0,
          shot: { from, column: hit ? undefined : cover.counter, surface: hit ? 'body' : 'stone' } }, tick);
        enemy.lastStrike = tick; delete enemy.attackAt; delete enemy.aim;
        if (!actor.health) { actor.status = 'dead'; actor.velocity = { x: 0, y: 0, z: 0 }; actor.currentAction = null; return false; }
      } else if (distance(from, to) < 50 && this.visible(from, to) && tick - enemy.lastStrike >= 5) {
        enemy.aim = { ...to }; enemy.attackAt = tick + 2;
      } else if (!this.visible(from, to) && distance(from, to) > 8) {
        const side = enemy.position.x < SET.center.x ? 1 : -1;
        const next = { ...enemy.position, x: enemy.position.x + side * 1.4 };
        if (!playerBlocked(next, true, 1.1, this.sandbox().structures)) enemy.position = next;
      }
    }
    return false;
  }
}
