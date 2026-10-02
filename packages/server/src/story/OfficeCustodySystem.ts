import { OFFICE_AGENT_ROLES, OFFICE_PATROLS, OFFICE_CUSTODY, officeCustodyActive, officeCustodyLocked, officeCustodyStep, officeCustodyText, filmPosition, playerBlocked, type AgentState, type SandboxState, type Vector3, type OfficeCustody, type OfficeCustodyRole } from '@auto_matrix/shared';
import type { WorldState } from '../world/WorldState.js';
import { officeNextPoint } from './OfficeNavigation.js';

const planar = (a: Vector3, b: Vector3) => Math.hypot(a.x - b.x, a.z - b.z);

export class OfficeCustodySystem {
  constructor(private world: WorldState, private sandbox: () => SandboxState) {}
  active(agent: AgentState): boolean { return agent.id === this.sandbox().neoLife?.journey?.actor && officeCustodyActive(this.sandbox().neoLife?.journey); }
  reserved(id: string): boolean { return officeCustodyActive(this.sandbox().neoLife?.journey) && OFFICE_AGENT_ROLES.includes(id as OfficeCustodyRole); }
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
  frame(agent: AgentState, dt: number, tick: number): boolean {
    if (!this.active(agent)) return false;
    const state = this.sandbox(), journey = state.neoLife!.journey!, custody = journey.office!.custody!;
    custody.paused = OFFICE_AGENT_ROLES.some(role => this.world.agents.get(role)?.controller);
    const delta = custody.paused || !agent.controller || agent.status !== 'alive' ? 0 : Math.max(0, Math.min(.1, dt));
    const exit = filmPosition('film_metacortex_floor', OFFICE_CUSTODY.exit.x, OFFICE_CUSTODY.exit.z);
    if (custody.phase === 'securing') {
      custody.elapsed = Math.min(OFFICE_CUSTODY.securing, custody.elapsed + delta);
      if (custody.elapsed >= OFFICE_CUSTODY.securing) custody.phase = 'escorting';
    }
    const blocked = (point: Vector3, role: OfficeCustodyRole) => playerBlocked(point, true, .7, state.structures)
      || planar(point, agent.position) < OFFICE_CUSTODY.spacing
      || OFFICE_AGENT_ROLES.some(other => other !== role && planar(point, custody.bodies[other].position) < OFFICE_CUSTODY.spacing)
      || ['courier', 'rhineheart'].some(id => { const other = this.world.agents.get(id); return other?.currentLocation === 'film_metacortex_floor' && planar(point, other.position) < OFFICE_CUSTODY.spacing; });
    const nearby = (role: OfficeCustodyRole, radius: number): Vector3 => {
      const body = custody.bodies[role];
      const points = Array.from({ length: 24 }, (_, i) => ({ ...agent.position, x: agent.position.x + Math.sin(i * Math.PI / 12) * radius, z: agent.position.z + Math.cos(i * Math.PI / 12) * radius }));
      const dx = Math.sin(agent.rotation), dz = Math.cos(agent.rotation);
      return points.filter(point => !blocked(point, role) && (custody.phase === 'securing' && role !== custody.catcher || role === custody.leader || (point.x - agent.position.x) * dx + (point.z - agent.position.z) * dz <= .1))
        .sort((a, b) => planar(a, body.position) - planar(b, body.position))[0] ?? body.position;
    };
    for (const role of [custody.leader, custody.catcher, ...OFFICE_AGENT_ROLES.filter(role => role !== custody.leader && role !== custody.catcher)]) {
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
      const guard = this.world.agents.get(role)!;
      if (guard.controller) continue;
      guard.position = { ...body.position }; guard.rotation = body.yaw; guard.isInMatrix = true; guard.currentLocation = 'film_metacortex_floor';
      if (delta) body.velocity = { x: (body.position.x - before.x) / delta, y: 0, z: (body.position.z - before.z) / delta };
      guard.velocity = { ...(body.velocity ?? { x: 0, y: 0, z: 0 }) };
      guard.currentAction = { type: Math.hypot(guard.velocity.x, guard.velocity.z) > .01 ? 'move_to' : 'idle', parameters: { resolved: true, officeCustody: { role, phase: custody.phase, elapsed: custody.elapsed } }, startedAt: tick, duration: 1, progress: 0 };
    }
    if (custody.phase !== 'securing') custody.phase = planar(agent.position, exit) <= OFFICE_CUSTODY.range && OFFICE_AGENT_ROLES.every(role => planar(custody.bodies[role].position, exit) < 8) ? 'ready' : 'escorting';
    if (officeCustodyLocked(journey)) { agent.velocity = { x: 0, y: 0, z: 0 }; agent.currentAction = { type: 'idle', parameters: { player: true, resolved: true }, startedAt: tick, duration: 1, progress: 0 }; }
    agent.currentAction ??= { type: 'idle', parameters: { player: true }, startedAt: tick, duration: 1, progress: 0 };
    agent.currentAction.parameters.officeCustody = { role: 'neo', phase: custody.phase, elapsed: custody.elapsed, paused: custody.paused };
    journey.checkpoint = { ...agent.position }; journey.lastText = journey.office!.guide = officeCustodyText(custody);
    return officeCustodyLocked(journey);
  }
  constrain(agent: AgentState, previous: Vector3, candidate: Vector3): Vector3 {
    if (!this.active(agent)) return candidate;
    const bodies = this.sandbox().neoLife!.journey!.office!.custody!.bodies;
    return officeCustodyStep(previous, candidate, OFFICE_AGENT_ROLES.map(role => bodies[role].position));
  }
}
