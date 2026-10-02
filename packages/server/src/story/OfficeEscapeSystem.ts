import { OFFICE_PATROLS, OFFICE_AGENT_ROLES, METACORTEX, FILM_SETS, filmPosition, officeArrivalPose, officeOccluded, officeCustodyStep, playerBlocked, type AgentState, type SandboxState, type OfficeEncounter, type Vector3 } from '@auto_matrix/shared';
import { officeNextPoint } from './OfficeNavigation.js';

export class OfficeEscapeSystem {
  constructor(private sandbox: () => SandboxState) {}
  constrain(actor: AgentState, previous: Vector3, candidate: Vector3): Vector3 {
    const state = this.sandbox(), journey = state.neoLife?.journey;
    if (journey?.actor !== actor.id || journey.visiting || journey.scene !== 'm1_office_escape' || journey.office?.outcome) return candidate;
    return officeCustodyStep(previous, candidate, state.threats.filter(threat => threat.patrol).map(threat => threat.position));
  }
  phoneFrame(tick: number, actors: Map<string, AgentState>): boolean {
    const state = this.sandbox(), journey = state.neoLife?.journey;
    if (!journey || journey.visiting || journey.scene !== 'm1_boss') return true;
    const phone = journey.phone;
    if (!phone || !['answering', 'connected'].includes(phone.phase)) {
      if (journey.office?.arrival !== undefined) {
        state.threats = state.threats.filter(threat => !threat.id.startsWith('office:'));
        delete journey.office;
      }
      return true;
    }
    if (OFFICE_AGENT_ROLES.some(id => actors.get(id)?.controller)) {
      journey.lastText = '另一位玩家正在控制到场的特工。通话和进场停在当前一拍，释放角色后继续。';
      return false;
    }
    if (!journey.office || journey.office.arrival === undefined || OFFICE_PATROLS.some((_, i) => !state.threats.some(threat => threat.id === `office:${i}`))) this.start(tick);
    journey.office!.arrival = phone.elapsed;
    state.neoLife!.lift = { floor: 1, target: 1, phase: phone.elapsed < METACORTEX.doorSeconds ? 'opening' : 'idle', elapsed: phone.elapsed < METACORTEX.doorSeconds ? phone.elapsed : 0 };
    OFFICE_PATROLS.forEach((_, i) => {
      const guard = state.threats.find(threat => threat.id === `office:${i}`)!;
      const pose = officeArrivalPose(i, phone.elapsed);
      guard.position = filmPosition('film_metacortex_floor', pose.x, pose.z); guard.yaw = pose.yaw;
    });
    return true;
  }
  start(tick: number): void {
    const state = this.sandbox(); const journey = state.neoLife!.journey!;
    const arrival = journey.office?.arrival;
    journey.office = { alert: 0, waypoints: [1, 1, 1], suspicion: [0, 0, 0], searches: [null, null, null], patrolWait: [16, 12, 24], lastTick: tick, arrival, searchAt: tick + 8, guide: 'MORPHEUS · 他们正在门口问你的工位。放低身体，趁现在换到对面的空隔间。' };
    state.threats = state.threats.filter(threat => !threat.id.startsWith('office:'));
    OFFICE_PATROLS.forEach((route, i) => {
      const pose = arrival === undefined ? { ...route[0], yaw: Math.atan2(route[1].x - route[0].x, route[1].z - route[0].z) } : officeArrivalPose(i, arrival);
      state.threats.push({
        id: `office:${i}`, scene: journey.scene, character: OFFICE_AGENT_ROLES[i], kind: 'agent', patrol: true, yaw: pose.yaw,
        position: filmPosition('film_metacortex_floor', pose.x, pose.z), matrix: true,
        health: 100, maxHealth: 100, target: 'neo', stunUntil: tick, lastStrike: tick - 10,
      });
    });
  }
  tick(actor: AgentState, tick: number): boolean {
    const journey = this.sandbox().neoLife!.journey!;
    if (!journey.office) this.start(tick);
    const state = journey.office!;
    if (state.outcome || state.lastTick === tick) return false;
    // Simulation ticks represent half a second; reconnecting must not accumulate unseen detection.
    state.lastTick = tick;
    state.searches ??= [null, null, null];
    state.patrolWait ??= [0, 0, 0];
    state.spotted = false;
    let captured = false;
    const searching = tick >= (state.searchAt ?? tick);
    const crouched = actor.currentAction?.parameters.crouching === true;
    const speed = Math.hypot(actor.velocity.x, actor.velocity.z);
    const center = FILM_SETS.film_metacortex_floor.center;
    for (let i = 0; i < OFFICE_PATROLS.length; i++) {
      const guard = this.sandbox().threats.find(t => t.id === `office:${i}`);
      if (!guard) continue;
      const dx = actor.position.x - guard.position.x; const dz = actor.position.z - guard.position.z;
      const range = Math.hypot(dx, dz);
      const facing = (Math.sin(guard.yaw ?? 0) * dx + Math.cos(guard.yaw ?? 0) * dz) / Math.max(.01, range);
      const seen = searching && range < (crouched ? 17 : 22) && (facing > .55 || range < 2) && !officeOccluded(
        { ...guard.position, y: guard.position.y + 2.9 }, { ...actor.position, y: actor.position.y + (crouched ? 1.3 : 2.9) }, center);
      const heard = searching && !crouched && speed > 5 && range < 9;
      state.suspicion[i] = Math.max(0, Math.min(100, state.suspicion[i] + (seen ? crouched ? 15 : 25 : heard ? 12 : -12)));
      if (seen || heard) state.searches[i] = { position: { ...actor.position }, remaining: 24, source: seen ? 'sight' : 'sound' };
      else if (state.searches[i] && --state.searches[i]!.remaining <= 0) state.searches[i] = null;
      if (seen && state.suspicion[i] >= 35) state.spotted = true;
      if (seen && state.suspicion[i] >= 65 && range < 2.2) captured = true;
      const search = state.searches[i];
      if (search) state.patrolWait[i] = 0;
      // They first establish Anderson's desk, then inspect it and the adjoining row.
      // These pauses do not suppress sight or sound; a clue interrupts them immediately.
      else if (state.patrolWait[i] > 0) { state.patrolWait[i]--; continue; }
      const route = OFFICE_PATROLS[i];
      const destination = search?.position ?? filmPosition('film_metacortex_floor', route[state.waypoints[i]].x, route[state.waypoints[i]].z);
      if (Math.hypot(destination.x - guard.position.x, destination.z - guard.position.z) < .6) {
        if (search) {
          search.facing ??= guard.yaw ?? 0;
          guard.yaw = search.facing + Math.sin((24 - search.remaining) * .45) * 1.2;
        } else { state.waypoints[i] = 1 - state.waypoints[i]; state.patrolWait[i] = 16; }
        continue;
      }
      const bodies = this.sandbox().threats.filter(other => other.patrol && other.id !== guard.id).map(other => other.position);
      const point = officeNextPoint(guard.position, destination, .71, bodies);
      if (!point) continue;
      const px = point.x - guard.position.x; const pz = point.z - guard.position.z; const length = Math.hypot(px, pz);
      if (length > .01) {
        const angle = Math.atan2(px, pz) - (guard.yaw ?? 0);
        guard.yaw = (guard.yaw ?? 0) + Math.max(-.75, Math.min(.75, Math.atan2(Math.sin(angle), Math.cos(angle))));
        const stride = Math.min(length, search ? search.source === 'sight' ? 1.7 : 1.2 : 1.05, seen ? Math.max(0, range - 1.85) : Infinity);
        const next = { ...guard.position, x: guard.position.x + px / length * stride, z: guard.position.z + pz / length * stride };
        if (officeCustodyStep(guard.position, next, bodies) === next && !playerBlocked(next, true, .7)) guard.position = next;
      }
    }
    state.alert = Math.max(...state.suspicion);
    state.guide = searching ? officeGuide(state, journey.step, actor.position.x - center.x, actor.position.z - center.z) : 'MORPHEUS · 他们正在门口问你的工位。放低身体，趁现在换到对面的空隔间。';
    return captured;
  }
}

function officeGuide(state: OfficeEncounter, step: number, x: number, z: number): string {
  if (state.spotted && state.alert >= 65) return 'MORPHEUS · 他认出你了，正在追过来！绕过隔间，别让他靠近。';
  if (state.spotted) return 'MORPHEUS · 他看见了动静。放低身体，先离开他的视线。';
  if (state.searches?.some(search => search?.source === 'sight')) return 'MORPHEUS · 他正在检查你刚才的位置。贴着隔板换到别的隔间，别留在原地。';
  if (state.searches?.some(search => search?.source === 'sound')) return 'MORPHEUS · 他们听见了脚步。放轻脚步，离开刚才的通道。';
  if (step > 2) return 'MORPHEUS · 窗口已经打开了。别停在里面，回到窗旁，按 G 前往窄台。';
  if (step === 1 && x > -22 && z > -12) return 'MORPHEUS · 从隔间后面的横道去百叶窗，沿窗边走。别回中央通道。';
  if (step === 2 && x > -22) return 'MORPHEUS · 回到百叶窗旁的通道，再沿外墙走到尽头。隔板另一边有窗户。';
  return [
    'MORPHEUS · 趁他们在找你的工位，换到对面那排隔间后面。按住 Z 放低身体。',
    'MORPHEUS · 沿百叶窗向前，经过两排工位；到前面的隔间开口，先躲进去。',
    'MORPHEUS · 沿百叶窗走到尽头。等巡逻转身再过去，靠近窗户后按 G 打开。',
  ][Math.min(step, 2)];
}
