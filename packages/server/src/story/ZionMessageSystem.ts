import { FILM_SETS, ZION_BEDROOM_DOOR, ZION_MESSAGE, ZION_MESSAGE_ROLES, distance, filmPosition, newZionMessage, zionMessageActive, zionMessageAngle, zionMessageLocked, zionMessageText, zionMessageTrinity,
  type AgentState, type FilmJourney, type SandboxState, type ZionMessageBody, type ZionMessageEncounter, type ZionMessageGesture } from '@auto_matrix/shared';
import type { WorldState } from '../world/WorldState.js';

export function savedZionMessageAction(journey: FilmJourney | undefined, actor: AgentState): boolean {
  const state = journey?.zionMessage, action = actor.currentAction, gesture = action?.parameters.zionMessage as ZionMessageGesture | undefined;
  return Boolean(zionMessageActive(journey) && state && gesture && gesture.role === actor.id && zionMessageLocked(state)
    && (action?.type === 'idle' || action?.type === 'move_to') && action.parameters.resolved === true && gesture.phase === state.phase
    && gesture.elapsed === state.elapsed && gesture.door === state.door && gesture.owner === state.owner);
}
export class ZionMessageSystem {
  onAdvance?: (text: string, actor: AgentState, tick: number) => void;
  constructor(private world: WorldState, private sandbox: () => SandboxState) {}
  private get journey() { return this.sandbox().neoLife?.journey; }
  active(actor: AgentState): boolean { return zionMessageActive(this.journey) && actor.id === this.journey!.actor; }
  private body(actor: AgentState): ZionMessageBody { const c = FILM_SETS.film_zion_bedroom.center; return { x: actor.position.x - c.x, z: actor.position.z - c.z, yaw: actor.rotation }; }
  reset(): void {
    const j = this.journey!; j.zionMessage = newZionMessage(j.step);
    for (const role of ZION_MESSAGE_ROLES) j.zionMessage.bodies[role] = this.body(this.world.agents.get(role)!);
    this.seal();
  }
  clear(): void { for (const actor of this.world.agents.values()) if (!actor.controller && actor.currentAction?.parameters.zionMessage) actor.currentAction = null; }
  stage(): void { if (zionMessageActive(this.journey)) { this.actors(this.ensure(), 0); this.seal(); } }
  private ensure(): ZionMessageEncounter {
    const j = this.journey!;
    if (!j.zionMessage) { const started = j.started; this.reset(); if (started !== undefined && j.step < 2) j.zionMessage!.phase = j.step === 0 ? 'approaching' : 'receiveApproach'; }
    delete j.started; return j.zionMessage!;
  }
  seal(): void {
    const j = this.journey, id = 'film:zion:oracle-door';
    if (!j || j.visiting || !['m2_room', 'm2_oracle_message'].includes(j.scene)) { this.sandbox().structures = this.sandbox().structures.filter(s => s.id !== id); return; }
    const door = ZION_BEDROOM_DOOR, angle = zionMessageAngle(j.scene === 'm2_room' ? 1 : j.zionMessage?.door ?? (j.step > 0 ? 1 : 0)), c = Math.cos(angle), s = Math.sin(angle);
    const leaf = { id, kind: 'barricade' as const, owner: 'zion', position: filmPosition('film_zion_bedroom', door.hingeX - door.hingeX * c, door.z + door.hingeX * s), matrix: false, health: 1,
      film: { scene: j.scene, width: Math.abs(c) * door.width + Math.abs(s) * door.depth, depth: Math.abs(s) * door.width + Math.abs(c) * door.depth, height: door.height } };
    const index = this.sandbox().structures.findIndex(s => s.id === id); if (index < 0) this.sandbox().structures.push(leaf); else this.sandbox().structures[index] = leaf;
  }
  private move(body: ZionMessageBody, target: { x: number; z: number }, speed: number, dt: number): boolean {
    const x = target.x - body.x, z = target.z - body.z, gap = Math.hypot(x, z), scale = Math.min(1, speed * dt / Math.max(gap, .001));
    body.x += x * scale; body.z += z * scale;
    if (gap > .01) this.face(body, Math.atan2(x, z), dt);
    return gap <= speed * dt;
  }
  private face(body: ZionMessageBody, yaw: number, dt: number): boolean {
    const angle = Math.atan2(Math.sin(yaw - body.yaw), Math.cos(yaw - body.yaw)); body.yaw += Math.max(-3.2 * dt, Math.min(3.2 * dt, angle)); return Math.abs(angle) < .02;
  }
  private phase(state: ZionMessageEncounter, phase: ZionMessageEncounter['phase']): void { state.phase = phase; state.elapsed = 0; }
  private actors(state: ZionMessageEncounter, dt: number): void {
    for (const role of ZION_MESSAGE_ROLES) {
      const actor = this.world.agents.get(role)!; if (actor.controller && role !== 'neo' || actor.status !== 'alive') continue;
      if (role === 'neo' && !zionMessageLocked(state)) { state.bodies.neo = this.body(actor); continue; }
      const point = state.bodies[role], before = actor.position;
      actor.position = filmPosition('film_zion_bedroom', point.x, point.z); actor.rotation = point.yaw;
      actor.currentLocation = 'film_zion_bedroom'; actor.isInMatrix = false;
      if (dt) actor.velocity = { x: (actor.position.x - before.x) / dt, y: 0, z: (actor.position.z - before.z) / dt };
      const bodies = Object.fromEntries(ZION_MESSAGE_ROLES.map(id => [id, { ...state.bodies[id] }])) as ZionMessageEncounter['bodies'];
      actor.currentAction = { type: Math.hypot(actor.velocity.x, actor.velocity.z) > .01 ? 'move_to' : 'idle', parameters: { resolved: true, player: role === 'neo',
        zionMessage: { phase: state.phase, elapsed: state.elapsed, door: state.door, owner: state.owner, bodies, role } }, startedAt: this.journey!.enteredAt, duration: 1e9, progress: 0 };
    }
  }
  frame(actor: AgentState, dt: number, tick: number): boolean {
    if (!this.active(actor)) return false;
    const j = this.journey!, state = this.ensure(); if (dt === 0) return zionMessageLocked(state);
    if (state.phase === 'done') return false;
    const occupied = ZION_MESSAGE_ROLES.find(role => { const a = this.world.agents.get(role)!; return role !== 'neo' && (a.controller || a.status !== 'alive' || a.currentLocation !== 'film_zion_bedroom' || a.isInMatrix); });
    if (occupied) { j.lastText = `${this.world.agents.get(occupied)!.name} 目前无法参与；门、磁盘归属和当前进度保留。`; return zionMessageLocked(state); }
    dt = Math.max(0, Math.min(.1, dt)); if (!dt) return zionMessageLocked(state);
    if (zionMessageLocked(state)) state.elapsed += dt;
    const neo = state.bodies.neo, trinity = state.bodies.trinity;
    if (state.phase === 'approaching') {
      const a = this.move(neo, ZION_MESSAGE.neo, 4.2, dt), b = this.move(trinity, zionMessageTrinity(0), ZION_MESSAGE.trinitySpeed, dt);
      if (a) this.face(neo, 0, dt); if (b && this.face(trinity, 0, dt) && a) this.phase(state, 'unlatching');
    } else if (state.phase === 'unlatching' && state.elapsed >= ZION_MESSAGE.unlatch) this.phase(state, 'opening');
    else if (state.phase === 'opening') {
      state.door = Math.min(1, state.elapsed / ZION_MESSAGE.opening); state.bodies.trinity = zionMessageTrinity(state.door);
      if (state.door === 1) this.phase(state, 'entering');
    } else if (state.phase === 'entering') {
      for (const role of ['ballard', 'malachi'] as const) {
        const route = role === 'ballard' ? ZION_MESSAGE.ballardRoute : ZION_MESSAGE.malachiRoute, index = state.cursors[role];
        if (index < route.length && this.move(state.bodies[role], route[index], role === 'ballard' ? ZION_MESSAGE.guestSpeed : ZION_MESSAGE.injuredSpeed, dt)) state.cursors[role]++;
      }
      if (state.cursors.ballard >= ZION_MESSAGE.ballardRoute.length && state.cursors.malachi >= ZION_MESSAGE.malachiRoute.length) this.phase(state, 'presenting');
    } else if (state.phase === 'presenting') {
      for (const role of ['ballard', 'malachi'] as const) this.face(state.bodies[role], Math.atan2(ZION_MESSAGE.neo.x - state.bodies[role].x, ZION_MESSAGE.neo.z - state.bodies[role].z), dt);
      if (state.elapsed >= ZION_MESSAGE.presenting) { this.phase(state, 'offer'); this.onAdvance?.('Trinity 已拉开铁门，Ballard 和受伤的 Malachi 走进门内。Ballard 托住先知的磁盘，等待 Neo 接过。', actor, tick); }
    } else if (state.phase === 'receiveApproach') {
      const arrived = this.move(neo, ZION_MESSAGE.neo, 4.2, dt), yaw = Math.atan2(state.bodies.ballard.x - neo.x, state.bodies.ballard.z - neo.z);
      if (arrived && this.face(neo, yaw, dt) && state.elapsed >= ZION_MESSAGE.approach) this.phase(state, 'taking');
    } else if (state.phase === 'taking' && state.elapsed >= ZION_MESSAGE.taking) this.phase(state, 'transfer');
    else if (state.phase === 'transfer') {
      if (state.elapsed >= ZION_MESSAGE.release) state.owner = 'neo';
      if (state.elapsed >= ZION_MESSAGE.transfer) this.phase(state, 'stowing');
    } else if (state.phase === 'stowing' && state.elapsed >= ZION_MESSAGE.stowing) {
      state.owner = 'stowed'; this.phase(state, 'done'); this.onAdvance?.('Neo 已接稳并收好磁盘。先知的讯息交接完成，现在可以前往船坞。', actor, tick);
    }
    this.actors(state, dt); this.seal(); j.lastText = zionMessageText(state);
    if (!zionMessageLocked(state) && actor.currentAction?.parameters.zionMessage) { actor.currentAction = null; actor.velocity = { x: 0, y: 0, z: 0 }; }
    return zionMessageLocked(state);
  }
  command(actor: AgentState, target: string, tick: number): string | undefined {
    if (!this.active(actor) || this.journey!.step >= 2) return;
    const j = this.journey!, state = this.ensure();
    if (target === 'retry') {
      actor.status = 'alive'; actor.health = actor.maxHealth; actor.position = { ...j.checkpoint }; actor.velocity = { x: 0, y: 0, z: 0 }; state.bodies.neo = this.body(actor);
      actor.currentAction = null;
      if (state.owner === 'neo') { if (state.phase !== 'stowing') this.phase(state, 'stowing'); }
      else if (j.step === 1) this.phase(state, 'offer');
      this.actors(state, 0);
      return j.lastText = '已接回当前检查点；门的位置、来客的伤势和磁盘归属保留，尚未交出的磁盘仍由 Ballard 托住。';
    }
    if (target !== 'act') return;
    if (zionMessageLocked(state)) return j.lastText = zionMessageText(state);
    if (actor.isInMatrix || actor.currentLocation !== 'film_zion_bedroom' || distance(actor.position, filmPosition('film_zion_bedroom', ZION_MESSAGE.neo.x, ZION_MESSAGE.neo.z)) > ZION_MESSAGE.radius) return '先走到当前金色标记旁，再按 G 继续。';
    state.bodies.neo = this.body(actor); j.checkpoint = { ...actor.position }; this.phase(state, j.step === 0 ? 'approaching' : 'receiveApproach');
    return j.lastText = zionMessageText(state);
  }
}
