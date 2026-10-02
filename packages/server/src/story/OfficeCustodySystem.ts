import { OFFICE_AGENT_ROLES, OFFICE_PATROLS, OFFICE_CUSTODY, OFFICE_CUSTODY_CAR, METACORTEX, metacortexPosition, metacortexLiftPose, officeCustodyActive, officeCustodyLocked, officeCustodyStep, officeCustodyText, filmPosition, playerBlocked, type AgentState, type SandboxState, type Vector3, type OfficeCustody, type OfficeCustodyBody, type OfficeCustodyRole } from '@auto_matrix/shared';
import type { WorldState } from '../world/WorldState.js';
import { officeNextPoint } from './OfficeNavigation.js';
import { updateMetacortexDoors } from './MetacortexDoors.js';

const planar = (a: Vector3, b: Vector3) => Math.hypot(a.x - b.x, a.z - b.z);

export class OfficeCustodySystem {
  constructor(private world: WorldState, private sandbox: () => SandboxState) {}
  active(agent: AgentState): boolean { return agent.id === this.sandbox().neoLife?.journey?.actor && officeCustodyActive(this.sandbox().neoLife?.journey); }
  reserved(id: string): boolean { return officeCustodyActive(this.sandbox().neoLife?.journey) && (OFFICE_AGENT_ROLES.includes(id as OfficeCustodyRole) || id === 'courier' && Boolean(this.sandbox().neoLife?.journey?.office?.custody?.courier)); }
  begin(agent: AgentState, tick: number): void {
    const state = this.sandbox(), journey = state.neoLife!.journey!;
    const bodies = Object.fromEntries(OFFICE_AGENT_ROLES.map((role, i) => {
      const threat = state.threats.find(threat => threat.character === role || threat.id === `office:${i}`);
      return [role, { position: { ...(threat?.position ?? filmPosition('film_metacortex_floor', OFFICE_PATROLS[i][0].x, OFFICE_PATROLS[i][0].z)) }, yaw: threat?.yaw ?? 0, velocity: { x: 0, y: 0, z: 0 } }];
    })) as OfficeCustody['bodies'];
    const catcher = [...OFFICE_AGENT_ROLES].sort((a, b) => planar(bodies[a].position, agent.position) - planar(bodies[b].position, agent.position))[0];
    journey.office!.custody = { phase: 'securing', elapsed: 0, catcher, leader: OFFICE_AGENT_ROLES.find(role => role !== catcher)!, bodies };
    this.frame(agent, 0, tick);
  }
  board(agent: AgentState, tick: number): void {
    const custody = this.sandbox().neoLife!.journey!.office!.custody!;
    custody.phase = 'clearing'; custody.boarded = 0;
    custody.lift = { floor: 1, target: 1, phase: 'idle', elapsed: 0 };
    const courier = this.world.agents.get('courier')!;
    if (Math.abs(courier.position.y - agent.position.y) < 3 && Math.abs(courier.position.x - METACORTEX.center.x) < 3 && Math.abs(courier.position.z - METACORTEX.center.z - METACORTEX.liftZ) < 3.5)
      custody.courier = { position: { ...courier.position }, yaw: courier.rotation, velocity: { x: 0, y: 0, z: 0 } };
    this.frame(agent, 0, tick);
  }
  private blockers(agent: AgentState, custody: OfficeCustody, role: string): Vector3[] {
    return [agent.position, ...OFFICE_AGENT_ROLES.filter(other => other !== role).map(other => custody.bodies[other].position),
      ...['courier', 'rhineheart'].flatMap(id => {
        const other = this.world.agents.get(id);
        return other && id !== role && Math.abs(other.position.y - agent.position.y) < 3 ? [other.position] : [];
      })];
  }
  private move(agent: AgentState, custody: OfficeCustody, role: string, body: OfficeCustodyBody, destination: Vector3, delta: number): void {
    if (!delta) return;
    const before = { ...body.position }, blockers = this.blockers(agent, custody, role);
    const point = officeNextPoint(before, destination, .71, blockers);
    if (point) {
      const length = planar(before, point), stride = Math.min(length, OFFICE_CUSTODY.speed * delta);
      const candidate = length > .001 ? { ...before, x: before.x + (point.x - before.x) / length * stride, z: before.z + (point.z - before.z) / length * stride } : before;
      if (!playerBlocked(candidate, true, .7, this.sandbox().structures) && blockers.every(other => Math.abs(candidate.y - other.y) >= 3 || planar(candidate, other) >= OFFICE_CUSTODY.spacing)) body.position = candidate;
    }
    body.velocity = { x: (body.position.x - before.x) / delta, y: 0, z: (body.position.z - before.z) / delta };
    if (planar(body.position, before) > .0001) {
      const heading = Math.atan2(body.velocity.x, body.velocity.z), angle = Math.atan2(Math.sin(heading - body.yaw), Math.cos(heading - body.yaw));
      body.yaw += Math.max(-3 * delta, Math.min(3 * delta, angle));
    }
  }
  private publish(role: OfficeCustodyRole | 'courier', body: OfficeCustodyBody, custody: OfficeCustody, tick: number): void {
    const guard = this.world.agents.get(role)!;
    if (guard.controller) return;
    guard.position = { ...body.position }; guard.rotation = body.yaw; guard.isInMatrix = true;
    guard.currentLocation = body.position.y > 63 ? 'film_metacortex_floor' : 'metacortex_office';
    guard.velocity = { ...(body.velocity ?? { x: 0, y: 0, z: 0 }) };
    guard.currentAction = { type: Math.hypot(guard.velocity.x, guard.velocity.z) > .01 ? 'move_to' : 'idle', parameters: { resolved: true,
      ...(custody.phase === 'riding' && role !== 'courier' ? { metacortexLift: true } : {}),
      officeCustody: { role, phase: custody.phase, elapsed: custody.elapsed } }, startedAt: tick, duration: 1, progress: 0 };
  }
  private transport(agent: AgentState, custody: OfficeCustody, delta: number, tick: number): void {
    const lift = custody.lift!;
    this.sandbox().neoLife!.lift = lift;
    const order = [custody.leader, ...OFFICE_AGENT_ROLES.filter(role => role !== custody.leader && role !== custody.catcher), custody.catcher];
    const slot = (role: OfficeCustodyRole) => role === custody.leader ? OFFICE_CUSTODY_CAR.leader : role === custody.catcher ? OFFICE_CUSTODY_CAR.catcher : OFFICE_CUSTODY_CAR.rear;
    if (delta) for (const role of OFFICE_AGENT_ROLES) custody.bodies[role].velocity = { x: 0, y: 0, z: 0 };
    if (delta && custody.courier) custody.courier.velocity = { x: 0, y: 0, z: 0 };
    if (custody.phase === 'clearing') {
      for (const role of order) {
        const waiting = OFFICE_CUSTODY_CAR.staging[role === custody.leader ? 'leader' : role === custody.catcher ? 'catcher' : 'rear'];
        this.move(agent, custody, role, custody.bodies[role], metacortexPosition(waiting.x, waiting.z, 1), delta);
      }
      const waiting = OFFICE_CUSTODY_CAR.waiting;
      if (planar(agent.position, metacortexPosition(waiting.x, waiting.z, 1)) < .5 && order.every(role => {
        const target = OFFICE_CUSTODY_CAR.staging[role === custody.leader ? 'leader' : role === custody.catcher ? 'catcher' : 'rear'];
        return planar(custody.bodies[role].position, metacortexPosition(target.x, target.z, 1)) < .2;
      })) custody.phase = 'boarding';
    } else if (custody.phase === 'boarding') {
      if (custody.courier && !custody.courier.clear) {
        const target = metacortexPosition(6, -23, 1);
        this.move(agent, custody, 'courier', custody.courier, target, delta);
        custody.courier.clear = planar(custody.courier.position, target) < .15;
      } else if ((custody.boarded ?? 0) < 3) {
        const role = order[custody.boarded ?? 0], body = custody.bodies[role], target = slot(role);
        this.move(agent, custody, role, body, metacortexPosition(target.x, target.z, 1), delta);
        if (planar(body.position, metacortexPosition(target.x, target.z, 1)) < .12) custody.boarded = (custody.boarded ?? 0) + 1;
      } else if (planar(agent.position, metacortexPosition(OFFICE_CUSTODY_CAR.neo.x, OFFICE_CUSTODY_CAR.neo.z, 1)) < .3) {
        custody.phase = 'selecting'; custody.transportElapsed = 0;
        lift.passenger = { x: agent.position.x, z: agent.position.z };
      }
    } else if (custody.phase === 'selecting') {
      custody.transportElapsed = Math.min(OFFICE_CUSTODY_CAR.selecting, (custody.transportElapsed ?? 0) + delta);
      const body = custody.bodies[custody.leader], angle = Math.atan2(Math.sin(Math.PI / 2 - body.yaw), Math.cos(Math.PI / 2 - body.yaw));
      body.yaw += Math.max(-3 * delta, Math.min(3 * delta, angle));
      if (custody.transportElapsed >= OFFICE_CUSTODY_CAR.selecting) { custody.phase = 'riding'; lift.target = 0; lift.phase = 'closing'; lift.elapsed = 0; }
    } else if (custody.phase === 'riding') {
      const seconds = lift.phase === 'travel' ? METACORTEX.travelSeconds : METACORTEX.doorSeconds;
      lift.elapsed = Math.min(seconds, lift.elapsed + delta);
      if (lift.elapsed >= seconds) {
        lift.phase = lift.phase === 'closing' ? 'travel' : lift.phase === 'travel' ? 'opening' : 'idle'; lift.elapsed = 0;
        if (lift.phase === 'opening' || lift.phase === 'idle') lift.floor = lift.target;
      }
      const height = 1 + metacortexLiftPose(lift).height;
      agent.position = { x: lift.passenger!.x, y: height, z: lift.passenger!.z };
      for (const role of OFFICE_AGENT_ROLES) custody.bodies[role].position.y = height;
      if (lift.phase === 'idle') { custody.phase = 'lobby'; delete lift.passenger; }
    } else {
      const exit = metacortexPosition(OFFICE_CUSTODY_CAR.outside.x, OFFICE_CUSTODY_CAR.outside.z);
      for (const role of order) {
        const body = custody.bodies[role];
        // Leave the narrow doorway in order, then use the same escort spacing as upstairs.
        const exiting = body.position.z < METACORTEX.center.z - 23;
        const ahead = role === custody.leader || exiting;
        const besideExit = metacortexPosition(2.6, OFFICE_CUSTODY_CAR.outside.z);
        const desired = ahead ? planar(agent.position, exit) < 5 ? besideExit : exit : { ...agent.position, x: agent.position.x + (role === custody.catcher ? 1.9 : -3.8), z: agent.position.z - 1.9 };
        if (!ahead || planar(body.position, agent.position) < 8 || planar(body.position, exit) > planar(agent.position, exit)) this.move(agent, custody, role, body, desired, delta);
      }
      custody.phase = planar(agent.position, exit) < 2 && OFFICE_AGENT_ROLES.every(role => planar(custody.bodies[role].position, exit) < 8) ? 'outside' : 'lobby';
    }
    if (custody.courier) this.publish('courier', custody.courier, custody, tick);
    updateMetacortexDoors(this.sandbox(), lift);
  }
  frame(agent: AgentState, dt: number, tick: number): boolean {
    if (!this.active(agent)) return false;
    const state = this.sandbox(), journey = state.neoLife!.journey!, custody = journey.office!.custody!;
    custody.paused = OFFICE_AGENT_ROLES.some(role => this.world.agents.get(role)?.controller) || Boolean(custody.courier && this.world.agents.get('courier')?.controller);
    const delta = custody.paused || !agent.controller || agent.status !== 'alive' ? 0 : Math.max(0, Math.min(.1, dt));
    const exit = filmPosition('film_metacortex_floor', OFFICE_CUSTODY.exit.x, OFFICE_CUSTODY.exit.z);
    if (custody.phase === 'securing') {
      custody.elapsed = Math.min(OFFICE_CUSTODY.securing, custody.elapsed + delta);
      if (custody.elapsed >= OFFICE_CUSTODY.securing) custody.phase = 'escorting';
    }
    const blocked = (point: Vector3, role: OfficeCustodyRole) => playerBlocked(point, true, .7, state.structures)
      || planar(point, agent.position) < OFFICE_CUSTODY.spacing
      || OFFICE_AGENT_ROLES.some(other => other !== role && planar(point, custody.bodies[other].position) < OFFICE_CUSTODY.spacing)
      || ['courier', 'rhineheart'].some(id => { const other = this.world.agents.get(id); return other?.currentLocation === 'film_metacortex_floor' && Math.abs(other.position.y - point.y) < 3 && planar(point, other.position) < OFFICE_CUSTODY.spacing; });
    const nearby = (role: OfficeCustodyRole, radius: number): Vector3 => {
      const body = custody.bodies[role];
      const points = Array.from({ length: 24 }, (_, i) => ({ ...agent.position, x: agent.position.x + Math.sin(i * Math.PI / 12) * radius, z: agent.position.z + Math.cos(i * Math.PI / 12) * radius }));
      const dx = Math.sin(agent.rotation), dz = Math.cos(agent.rotation);
      return points.filter(point => !blocked(point, role) && (custody.phase === 'securing' && role !== custody.catcher || role === custody.leader || (point.x - agent.position.x) * dx + (point.z - agent.position.z) * dz <= .1))
        .sort((a, b) => planar(a, body.position) - planar(b, body.position))[0] ?? body.position;
    };
    const transporting = ['clearing', 'boarding', 'selecting', 'riding', 'lobby', 'outside'].includes(custody.phase);
    if (transporting) this.transport(agent, custody, delta, tick);
    else for (const role of [custody.leader, custody.catcher, ...OFFICE_AGENT_ROLES.filter(role => role !== custody.leader && role !== custody.catcher)]) {
      const body = custody.bodies[role], before = { ...body.position };
      const leading = role === custody.leader;
      const destination = leading ? custody.phase === 'securing' ? nearby(role, 3.8)
        : planar(agent.position, exit) < 5 ? nearby(role, 3.8) : exit : nearby(role, role === custody.catcher ? 1.9 : 4.2);
      if (delta > 0 && (!leading || planar(body.position, agent.position) < 8)) {
        const blockers = [agent.position, ...OFFICE_AGENT_ROLES.filter(other => other !== role).map(other => custody.bodies[other].position),
          ...['courier', 'rhineheart'].flatMap(id => { const other = this.world.agents.get(id); return other?.currentLocation === 'film_metacortex_floor' ? [other.position] : []; })];
        let point = officeNextPoint(body.position, destination, .71, blockers);
        // In the narrow window aisle, move ahead until there is room to get behind Neo.
        if (!point && !leading) point = officeNextPoint(body.position, exit, .71, blockers);
        if (point) {
          const length = planar(body.position, point), stride = Math.min(length, OFFICE_CUSTODY.speed * delta);
          const candidate = length > .001 ? { ...body.position, x: body.position.x + (point.x - body.position.x) / length * stride, z: body.position.z + (point.z - body.position.z) / length * stride } : body.position;
          if (!blocked(candidate, role)) body.position = candidate;
        }
      }
      const moving = planar(body.position, before) > .0001;
      const heading = moving ? Math.atan2(body.position.x - before.x, body.position.z - before.z) : role === custody.catcher ? agent.rotation : Math.atan2(agent.position.x - body.position.x, agent.position.z - body.position.z);
      const angle = Math.atan2(Math.sin(heading - body.yaw), Math.cos(heading - body.yaw));
      body.yaw += Math.max(-3 * delta, Math.min(3 * delta, angle));
      if (delta) body.velocity = { x: (body.position.x - before.x) / delta, y: 0, z: (body.position.z - before.z) / delta };
    }
    if (!transporting && custody.phase !== 'securing') custody.phase = planar(agent.position, exit) <= OFFICE_CUSTODY.range && OFFICE_AGENT_ROLES.every(role => planar(custody.bodies[role].position, exit) < 8) ? 'ready' : 'escorting';
    for (const role of OFFICE_AGENT_ROLES) this.publish(role, custody.bodies[role], custody, tick);
    if (officeCustodyLocked(journey)) { agent.velocity = { x: 0, y: 0, z: 0 }; agent.currentAction = { type: 'idle', parameters: { player: true, resolved: true }, startedAt: tick, duration: 1, progress: 0 }; }
    agent.currentAction ??= { type: 'idle', parameters: { player: true }, startedAt: tick, duration: 1, progress: 0 };
    if (custody.phase === 'riding') agent.currentAction.parameters.metacortexLift = true;
    else delete agent.currentAction.parameters.metacortexLift;
    agent.currentAction.parameters.officeCustody = { role: 'neo', phase: custody.phase, elapsed: custody.elapsed, paused: custody.paused, locked: officeCustodyLocked(journey) };
    journey.checkpoint = { ...agent.position }; journey.lastText = journey.office!.guide = officeCustodyText(custody);
    return officeCustodyLocked(journey);
  }
  constrain(agent: AgentState, previous: Vector3, candidate: Vector3): Vector3 {
    if (!this.active(agent)) return candidate;
    const bodies = this.sandbox().neoLife!.journey!.office!.custody!.bodies;
    const courier = this.sandbox().neoLife!.journey!.office!.custody!.courier;
    return officeCustodyStep(previous, candidate, [...OFFICE_AGENT_ROLES.map(role => bodies[role].position), ...(courier ? [courier.position] : [])]);
  }
}
