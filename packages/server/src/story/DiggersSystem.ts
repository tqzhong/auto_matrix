import { DIGGERS, FILM_SETS, diggersActive, diggersLocked, diggersText, diggerLoaderPose, filmPosition, fireDigger, newDiggers,
  stepDiggers, playerBlocked, type AgentState, type SandboxState } from '@auto_matrix/shared';
import type { WorldState } from '../world/WorldState.js';

export class DiggersSystem {
  onAdvance?: (text: string, actor: AgentState, tick: number) => void;
  constructor(private world: WorldState, private sandbox: () => SandboxState) {}
  private get journey() { return this.sandbox().neoLife?.journey; }
  active(actor: AgentState): boolean { return diggersActive(this.journey) && this.journey!.actor === actor.id; }
  private occupied(): boolean { return Boolean(this.world.agents.get('zee')?.controller); }
  private unavailable(): string | undefined {
    if (this.occupied()) return 'Zee 正由另一位玩家控制，当前射击口的进度保持不变。';
    const zee = this.world.agents.get('zee');
    if (!zee || zee.status !== 'alive' || zee.health <= 0) return 'Zee 无法继续装弹，当前射击口的进度保持不变。';
  }
  stage(tick: number, dt = 0): void {
    const journey = this.journey, prefix = 'film:diggers:';
    const body = 'film:digger-body';
    if (journey?.diggers && (journey.diggers.phase === 'done' || !journey.visiting && ['m3_diggers', 'm3_upper_digger', 'm3_dock_battle', 'm3_gate'].includes(journey.scene))) {
      const { x, z, ...size } = DIGGERS.footprint;
      const wreck = this.sandbox().structures.find(s => s.id === body);
      if (wreck) { wreck.position = filmPosition('film_zion_hangar', x, z); wreck.film = { scene: 'm3_diggers', ...size }; }
      else {
        this.sandbox().structures.push({ id: body, kind: 'barricade', owner: 'zion', matrix: false, health: 999,
          position: filmPosition('film_zion_hangar', x, z), film: { scene: 'm3_diggers', ...size } });
      }
    } else this.sandbox().structures = this.sandbox().structures.filter(s => s.id !== body);
    if (!journey || journey.visiting || journey.scene !== 'm3_diggers') {
      this.sandbox().structures = this.sandbox().structures.filter(s => !s.id.startsWith(prefix)); return;
    }
    const state = journey.diggers ??= newDiggers();
    DIGGERS.walls.forEach((wall, i) => {
      const id = `${prefix}${i}`;
      if (!this.sandbox().structures.some(s => s.id === id)) this.sandbox().structures.push({ id, kind: 'barricade', owner: 'zion',
        matrix: false, health: 999, position: filmPosition('film_zion_hangar', wall.x, wall.z),
        film: { scene: 'm3_diggers', width: wall.width, depth: wall.depth, height: wall.height } });
    });
    const charra = this.world.agents.get('charra')!, zee = this.world.agents.get('zee')!;
    if (diggersLocked(state)) {
      const station = DIGGERS.stations[state.station];
      charra.position = filmPosition('film_zion_hangar', station.x, station.z); charra.rotation = state.yaw;
      charra.velocity = { x: 0, y: 0, z: 0 }; charra.targetPosition = null; charra.currentPath = [];
    }
    const following = !diggersLocked(state);
    if (following && charra.currentAction) charra.currentAction.parameters.diggers = { ...state, role: 'charra' };
    else charra.currentAction = { type: 'idle', parameters: { resolved: true, diggers: { ...state, role: 'charra' } }, startedAt: tick, duration: 1e9, progress: 0 };
    if (this.unavailable()) return;
    const loader = diggerLoaderPose(state);
    const target = following ? { x: charra.position.x + Math.cos(charra.rotation) * 2.3 - Math.sin(charra.rotation) * 1.4, y: charra.position.y,
      z: charra.position.z - Math.sin(charra.rotation) * 2.3 - Math.cos(charra.rotation) * 1.4 }
      : { x: charra.position.x + Math.cos(state.yaw) * loader.x + Math.sin(state.yaw) * loader.z, y: charra.position.y,
        z: charra.position.z - Math.sin(state.yaw) * loader.x + Math.cos(state.yaw) * loader.z };
    if (following) { target.x = Math.max(FILM_SETS.film_zion_hangar.center.x - 46.6, Math.min(FILM_SETS.film_zion_hangar.center.x - 38, target.x)); }
    target.y = FILM_SETS.film_zion_hangar.center.y;
    if (!following || zee.currentLocation !== 'film_zion_hangar' || !zee.currentAction?.parameters.diggers) zee.position = target;
    else if (dt > 0) {
      const previous = { ...zee.position };
      const dx = target.x - zee.position.x, dz = target.z - zee.position.z, gap = Math.hypot(dx, dz), step = Math.min(gap, dt * 7);
      if (gap) { zee.position.x += dx / gap * step; zee.position.z += dz / gap * step; }
      if (Math.hypot(zee.position.x - charra.position.x, zee.position.z - charra.position.z) < 1.7) {
        const bearing = Math.atan2(previous.x - charra.position.x, previous.z - charra.position.z);
        for (const angle of [bearing, bearing - Math.PI / 2, bearing + Math.PI / 2, bearing + Math.PI]) {
          const point = { x: charra.position.x + Math.sin(angle) * 1.7, y: target.y, z: charra.position.z + Math.cos(angle) * 1.7 };
          if (!playerBlocked(point, false, .7, this.sandbox().structures)) { zee.position = point; break; }
        }
      }
      zee.velocity = { x: (zee.position.x - previous.x) / dt, y: 0, z: (zee.position.z - previous.z) / dt };
    }
    if (!following) zee.velocity = { x: 0, y: 0, z: 0 };
    zee.currentLocation = charra.currentLocation = 'film_zion_hangar'; zee.isInMatrix = charra.isInMatrix = false;
    zee.rotation = following && Math.hypot(zee.velocity.x, zee.velocity.z) > .05 ? Math.atan2(zee.velocity.x, zee.velocity.z) : charra.rotation + (following ? 0 : loader.yaw);
    zee.targetPosition = null; zee.currentPath = [];
    zee.currentAction = { type: following && Math.hypot(zee.velocity.x, zee.velocity.z) > .05 ? 'move_to' : 'idle', parameters: { resolved: true, diggers: { ...state, role: 'zee' } }, startedAt: tick, duration: 1e9, progress: 0 };
  }
  frame(actor: AgentState, dt: number, tick: number, input: { focus?: boolean; yaw?: number; pitch?: number } = {}): boolean {
    if (!this.active(actor)) {
      if (dt === 0 && this.journey?.scene === 'm3_diggers' && !this.journey.visiting && this.journey.actor === actor.id) this.stage(tick);
      return false;
    }
    const journey = this.journey!, state = journey.diggers ??= newDiggers(); delete journey.started;
    const unavailable = this.unavailable();
    if (unavailable) { journey.lastText = unavailable; return true; }
    if (actor.controller && actor.status === 'alive') {
      if (state.phase === 'aiming' && Number.isFinite(input.yaw) && Number.isFinite(input.pitch)) {
        state.yaw = input.yaw!; state.pitch = Math.max(-.65, Math.min(.5, input.pitch!));
      }
      stepDiggers(state, dt, input.focus);
    }
    if (diggersLocked(state) || dt === 0) this.stage(tick);
    journey.lastText = diggersText(state);
    if (diggersLocked(state)) journey.checkpoint = { ...actor.position };
    if (state.phase === 'done') this.onAdvance?.(diggersText(state), actor, tick);
    return diggersLocked(state);
  }
  handle(actor: AgentState, kind: string, tick: number, yaw: number, pitch: number): string | undefined {
    if (!this.active(actor) || !['attack', 'shoot', 'dodge', 'ability', 'ability2', 'travel'].includes(kind)) return;
    const unavailable = this.unavailable(); if (unavailable) return unavailable;
    const state = this.journey!.diggers ??= newDiggers();
    if (kind === 'shoot') { fireDigger(state, yaw, pitch); this.stage(tick); }
    return this.journey!.lastText = diggersText(state);
  }
  command(actor: AgentState, target: string, tick: number): string {
    const journey = this.journey!, state = journey.diggers ??= newDiggers();
    const unavailable = this.unavailable(); if (unavailable) return unavailable;
    if (target === 'retry' && (state.phase === 'failed' || actor.status !== 'alive')) {
      const retry = newDiggers(state.station, state.attempts + 1);
      if (state.station === 0 && state.damage === 1) { retry.phase = 'relocate'; retry.damage = 1; }
      journey.diggers = retry; actor.status = 'alive'; actor.health = actor.maxHealth; actor.activeEffects = [];
      const station = DIGGERS.stations[state.station]; actor.position = filmPosition('film_zion_hangar', station.x, station.z);
      actor.velocity = { x: 0, y: 0, z: 0 }; actor.rotation = retry.yaw; journey.checkpoint = { ...actor.position };
    } else if (target === 'act' && ['approach', 'relocate'].includes(state.phase)) {
      const station = state.phase === 'relocate' ? 1 : state.station, point = DIGGERS.stations[station], center = FILM_SETS.film_zion_hangar.center;
      if (Math.hypot(actor.position.x - center.x - point.x, actor.position.z - center.z - point.z) > 1.6 || Math.abs(actor.position.y - center.y) > .3)
        return '先沿防御通道走到标记的射击口，再按 G 架起发射器。';
      if (station !== state.station) journey.diggers = { ...newDiggers(station, state.attempts), total: state.total };
      journey.diggers!.phase = 'loading'; journey.diggers!.elapsed = 0;
      const zee = this.world.agents.get('zee')!, yaw = journey.diggers!.yaw;
      const dx = zee.position.x - center.x - point.x, dz = zee.position.z - center.z - point.z;
      journey.diggers!.loader = { x: Math.cos(yaw) * dx - Math.sin(yaw) * dz, z: Math.sin(yaw) * dx + Math.cos(yaw) * dz,
        yaw: zee.rotation - yaw, elapsed: 0 };
    }
    delete journey.started; this.stage(tick); return journey.lastText = diggersText(journey.diggers);
  }
}
