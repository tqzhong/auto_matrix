import type { AgentState, Vector3 } from '../types/agent.js';

export const OPENING_HOTEL = {
  trace: { ring: .28, pickup: 1.35, located: 11.85, room: 13.1, end: 15.3 },
  computer: { x: -8, z: 12 },
  phone: { x: -11, z: 18, width: 2.4, depth: 1.55, height: 2.85,
    stand: { x: -8.6, z: 18 }, receiver: { x: -10.07, y: 3.17, z: 18.15 }, radius: 1.4,
    align: .56, grasp: .96, lift: 1.62, lower: 6.22, release: 6.9, end: 7.24 },
  doorZ: 1,
  window: { x: 0, z: -23, paneZ: -25.61 },
  ladderZ: -30,
  ladderHeight: 7,
  lowerDeck: { z: -30.8, y: -.35, width: 11, depth: 9, thickness: .4 },
  ladderRungs: { bottom: .35, spacing: .65, offsetZ: -.4, width: 1.75, height: .12, depth: .16 },
  ladderRails: { x: .8, top: 9.65, endOffsetZ: -2.24 },
  landing: { offsetZ: -3.5, stepOffsetZ: -2.12, width: 5.4, depth: 4.3, thickness: .24 },
  climbSpeed: 2.4,
  breachSeconds: 2.5,
  breachImpact: .42,
  diveSeconds: 1.6,
  roomDive: { launch: .33, glass: .344, land: 1.6, reach: 1.81, ready: 2.24 },
  pursuit: { triggerZ: -4, startZ: 6.8, stopZ: -23.9, spacing: 6.2, speed: 6.2 },
  officers: [{ id: 'citizen_4', x: -1.6, behind: 3.2 }, { id: 'citizen_14', x: 1.65, behind: 6.3 }],
  alley: { y: -8, x: 3.6, z: -38.8, front: -26, back: -42, width: 27 },
  magazine: 8,
  combatOfficers: ['citizen_4', 'citizen_14', 'citizen_10', 'citizen_13'],
  walls: [
    { x: -10.25, z: 1, width: 13.5, depth: .65, height: 12 },
    { x: 10.25, z: 1, width: 13.5, depth: .65, height: 12 },
    { x: -11, z: 12, width: 3, depth: 2.2, height: 2.9 },
  ],
} as const;

export type OpeningPursuer = 'agent_brown' | 'smith' | typeof OPENING_HOTEL.officers[number]['id'];
export type OpeningPursuitCast = Partial<Record<OpeningPursuer, Pick<AgentState,
  'position' | 'rotation' | 'velocity' | 'currentLocation' | 'isInMatrix' | 'targetPosition' | 'currentPath' | 'currentAction'>>>;
export interface OpeningPursuitGesture { travel: number; speed: number; lookPitch?: number }

export function openingHotelAlleyGuard(actor?: AgentState | null): actor is AgentState {
  return actor?.id === 'smith' && actor.currentLocation === 'film_heart_hotel' && actor.status === 'alive' && !actor.controller
    && (actor.currentAction?.parameters.hotelPursuit as OpeningPursuitGesture | undefined)?.lookPitch !== undefined;
}

export interface OpeningHotelEncounter {
  phase: 'trace' | 'breach' | 'combat' | 'phone' | 'answering' | 'corridor' | 'dive' | 'ladder_ready' | 'climbing' | 'done' | 'failed';
  elapsed: number; lastTick: number; attempts: number;
  disarmed: boolean; ammo: number; shots: number; fallen?: Vector3;
  reloadAt?: number; climbed?: number; breachYaw?: number; traceElapsed?: number;
  callFrom?: { position: Vector3; yaw: number };
  diveFrom?: { position: Vector3; yaw: number };
  pursuit?: OpeningPursuitCast;
}

export function openingHotelTraceTime(hotel?: OpeningHotelEncounter, actor?: AgentState): number | undefined {
  if (hotel?.phase !== 'trace' || hotel.traceElapsed === undefined) return;
  const elapsed = actor?.currentAction?.parameters.openingTrace;
  return typeof elapsed === 'number' ? elapsed : hotel.traceElapsed;
}

const traceLines = [
  { from: OPENING_HOTEL.trace.pickup, speaker: 'Trinity', text: '该准备的都就绪了吗？' },
  { from: 3.15, speaker: 'Cypher', text: '今晚原本轮不到你盯他。' },
  { from: 5.05, speaker: 'Cypher', text: '你在意他。你也相信他就是那个人？' },
  { from: 7.65, speaker: 'Trinity', text: 'Morpheus 信。你有疑问就去问他。' },
  { from: 9.6, speaker: 'Trinity', text: '等等。你确定这条线没被监听？' },
  { from: OPENING_HOTEL.trace.located, speaker: 'Cypher', text: '我确定。' },
] as const;

export function openingHotelTraceLine(elapsed: number) {
  if (elapsed >= OPENING_HOTEL.trace.room - .25) return;
  for (let index = traceLines.length - 1; index >= 0; index--) if (elapsed >= traceLines[index].from) return traceLines[index];
}

export function openingHotelGlassTime(hotel: OpeningHotelEncounter): number {
  return hotel.diveFrom ? OPENING_HOTEL.roomDive.glass : .35;
}

export function openingHotelGlassBroken(hotel?: OpeningHotelEncounter): boolean {
  if (hotel?.phase === 'dive') {
    const contact = openingHotelGlassTime(hotel);
    return hotel.diveFrom ? hotel.elapsed >= contact : hotel.elapsed > contact;
  }
  return openingHotelClimbed(hotel) !== undefined;
}

export function openingHotelLanded(hotel?: OpeningHotelEncounter): boolean {
  return hotel?.phase === 'dive' ? hotel.elapsed >= OPENING_HOTEL.roomDive.land : openingHotelClimbed(hotel) !== undefined;
}

function ease(value: number, start: number, end: number): number {
  const t = Math.max(0, Math.min(1, (value - start) / (end - start)));
  return t * t * (3 - 2 * t);
}

// Each actor clears the jamb before fanning out into the room.
const breachTracks = [
  { x: 1.05, startZ: -1, throughZ: 3.5, endX: -4.5, endZ: 9.55, start: .48, through: 1.13, end: 2.33 },
  { x: 1.65, startZ: -3.3, throughZ: 2.85, endX: 4.4, endZ: 5.6, start: .63, through: 1.57, end: 2.36 },
  { x: -.95, startZ: -5.55, throughZ: 2.8, endX: -.85, endZ: 5.85, start: .88, through: 1.85, end: 2.43 },
  { x: 1.5, startZ: -8, throughZ: 2.6, endX: 2.12, endZ: 3.6, start: 1.05, through: 2.1, end: OPENING_HOTEL.breachSeconds },
] as const;

export function openingHotelBreachOfficer(index: number, elapsed: number) {
  const { x, startZ, throughZ, endX, endZ, start, through, end } = breachTracks[index];
  const approach = ease(elapsed, start, through), fan = ease(elapsed, through, end);
  const entryLength = throughZ - startZ, roomLength = Math.hypot(endX - x, endZ - throughZ);
  const travel = entryLength * approach + roomLength * fan;
  const nextTravel = entryLength * ease(elapsed + .001, start, through) + roomLength * ease(elapsed + .001, through, end);
  const impact = index === 0 ? ease(elapsed, .18, OPENING_HOTEL.breachImpact - .025) * (1 - ease(elapsed, OPENING_HOTEL.breachImpact + .01, .61)) : 0;
  return { x: x + (endX - x) * fan, z: startZ + entryLength * approach + (endZ - throughZ) * fan,
    travel, speed: (nextTravel - travel) * 1000, impact, faceRoom: ease(elapsed, through - .18, through + .36) };
}

export function openingHotelBreachTime(hotel?: OpeningHotelEncounter, actor?: AgentState): number | undefined {
  if (hotel?.phase !== 'breach') return;
  const action = actor?.currentAction?.parameters.hotel303 as { phase: string; elapsed: number } | undefined;
  return action?.phase === 'surrender' ? Math.max(hotel.elapsed, action.elapsed) : hotel.elapsed;
}

export function openingHotelDoorHit(hotel?: OpeningHotelEncounter): boolean {
  return Boolean(hotel && hotel.phase !== 'trace' && (hotel.phase !== 'breach' || hotel.elapsed >= OPENING_HOTEL.breachImpact));
}

export function openingHotelDoorAngle(hotel?: OpeningHotelEncounter, elapsed = hotel?.elapsed ?? 0): number {
  if (hotel?.phase === 'breach') return -1.56 * ease(elapsed, OPENING_HOTEL.breachImpact, .74) - .09 * (ease(elapsed, .67, .79) - ease(elapsed, .79, 1.02));
  return openingHotelDoorHit(hotel) ? -1.56 : 0;
}

const hotelPhoneLines = [
  { from: 1.62, to: 2.65, text: 'Trinity：他们追踪到了这条线路。' },
  { from: 2.65, to: 4.02, text: 'Morpheus：硬线被切断了。特工正在上来。' },
  { from: 4.02, to: 5.88, text: 'Morpheus：去 Wells 与 Lake 路口。那里的电话能带你回来。' },
  { from: 5.88, to: 6.22, text: 'Trinity：明白。' },
] as const;

export function openingHotelPhoneLine(elapsed: number) {
  return hotelPhoneLines.find(line => elapsed >= line.from && elapsed < line.to);
}

export function openingHotelPhoneHeld(elapsed?: number): boolean {
  return elapsed !== undefined && elapsed >= OPENING_HOTEL.phone.grasp && elapsed < OPENING_HOTEL.phone.release;
}

export function openingHotelPhonePose(elapsed: number, from?: OpeningHotelEncounter['callFrom']) {
  const { stand, align, release, end } = OPENING_HOTEL.phone;
  const start = from?.position ?? { ...stand, y: 0 }, yaw = from?.yaw ?? -Math.PI / 2;
  const alignWeight = ease(elapsed, 0, align);
  const away = ease(elapsed, 2.74, 3.55), back = ease(elapsed, 4.94, 6.12);
  const dx = stand.x - start.x, dz = stand.z - start.z, pace = away - back;
  const turn = Math.atan2(Math.sin(-Math.PI / 2 - yaw), Math.cos(-Math.PI / 2 - yaw));
  return { x: start.x + dx * alignWeight + .18 * pace, y: start.y * (1 - alignWeight), z: start.z + dz * alignWeight - .48 * pace,
    yaw: yaw + turn * alignWeight - .26 * pace - Math.PI / 2 * ease(elapsed, release, end), travel: Math.hypot(dx, dz) * alignWeight + .51 * (away + back) };
}

export function openingHotelDiveMotion(elapsed: number) {
  const { launch, land, reach, ready } = OPENING_HOTEL.roomDive;
  const grab = ease(elapsed, reach, ready);
  const lift = ease(elapsed, launch, launch + .12) * (1 - ease(elapsed, land - .17, land));
  return {
    airborne: elapsed > launch && elapsed < land,
    stride: ease(elapsed, .03, .13) * (1 - ease(elapsed, .17, launch)),
    cover: ease(elapsed, .15, .43) * (1 - ease(elapsed, 1.12, land - .06)),
    brace: ease(elapsed, land - .15, land + .12) * (1 - ease(elapsed, land + .12, ready - .21)),
    grab,
    support: (1 - lift) * (1 - grab),
  };
}

export function openingHotelDivePose(elapsed: number, from?: OpeningHotelEncounter['diveFrom']): Vector3 & { yaw: number } {
  const { window, ladderZ, lowerDeck, roomDive } = OPENING_HOTEL;
  const floor = lowerDeck.y + lowerDeck.thickness / 2, landingZ = ladderZ + 1;
  if (elapsed >= roomDive.land) {
    const grab = ease(elapsed, roomDive.reach, roomDive.ready), rung = openingHotelClimbPose(0);
    return { x: window.x, y: floor + (rung.y - floor) * grab, z: landingZ + (rung.z - landingZ) * grab, yaw: Math.PI };
  }
  if (!from) {
    // Older in-flight checkpoints store the original arc. Keep their path until the landing.
    const progress = elapsed / OPENING_HOTEL.diveSeconds, y = Math.sin(progress * Math.PI) * 1.1 - progress * .35;
    const land = ease(elapsed, roomDive.land - .1, roomDive.land);
    return { x: window.x, y: y + (floor - y) * land, z: window.z + (landingZ - window.z) * progress, yaw: Math.PI };
  }
  const launchZ = window.paneZ + 1.65;
  if (elapsed < roomDive.launch) {
    const weight = ease(elapsed, 0, roomDive.launch), p = from.position;
    const turn = Math.atan2(Math.sin(Math.PI - from.yaw), Math.cos(Math.PI - from.yaw));
    return { x: p.x + (window.x - p.x) * weight, y: p.y * (1 - weight), z: p.z + (launchZ - p.z) * weight, yaw: from.yaw + turn * weight };
  }
  const flight = (elapsed - roomDive.launch) / (roomDive.land - roomDive.launch);
  return { x: window.x, y: 3.2 * flight * (1 - flight) + floor * flight,
    z: launchZ + (landingZ - launchZ) * flight * (2 - flight), yaw: Math.PI };
}

export function openingHotelClimbed(hotel?: OpeningHotelEncounter): number | undefined {
  if (hotel?.phase === 'done') return OPENING_HOTEL.ladderHeight;
  if (hotel?.phase === 'ladder_ready' || hotel?.phase === 'climbing') return hotel.climbed ?? 0;
}

export function openingHotelClimbPose(climbed: number) {
  const { ladderHeight, ladderZ, landing } = OPENING_HOTEL;
  const pullUp = 4, stepOntoDeck = 5.8;
  // Raise the feet above the plate before advancing into its footprint.
  const lift = ease(climbed, pullUp, stepOntoDeck), transfer = ease(climbed, stepOntoDeck, ladderHeight);
  const rung = Math.min(stepOntoDeck, Math.max(0, climbed)) - .35;
  const deck = ladderHeight + landing.thickness + .24 * (1 - transfer);
  return { y: rung * (1 - lift) + deck * lift, z: ladderZ + landing.stepOffsetZ * transfer, transfer };
}
