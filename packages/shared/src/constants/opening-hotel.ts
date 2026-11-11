import type { AgentState, Vector3 } from '../types/agent.js';

export const OPENING_HOTEL = {
  computer: { x: -8, z: 12 },
  phone: { x: -11, z: 18 },
  doorZ: 1,
  window: { x: 0, z: -23, paneZ: -25.61 },
  ladderZ: -30,
  ladderHeight: 7,
  lowerDeck: { z: -30.8, y: -.35, width: 11, depth: 9, thickness: .4 },
  ladderRungs: { bottom: .35, spacing: .65, offsetZ: -.4, width: 1.75, height: .12, depth: .16 },
  ladderRails: { x: .8, top: 9.65, endOffsetZ: -2.24 },
  landing: { offsetZ: -3.5, stepOffsetZ: -2.12, width: 5.4, depth: 4.3, thickness: .24 },
  climbSpeed: 2.4,
  breachSeconds: 1.5,
  diveSeconds: 1.6,
  roomDive: { launch: .33, glass: .344, land: 1.6, reach: 1.81, ready: 2.24 },
  pursuit: { triggerZ: -4, startZ: 6.8, stopZ: -23.9, spacing: 6.2, speed: 6.2 },
  officers: [{ id: 'citizen_4', x: -1.6, behind: 3.2 }, { id: 'citizen_14', x: 1.65, behind: 6.3 }],
  alley: { y: -8, x: 3.6, z: -38.8, front: -26, back: -42, width: 27 },
  magazine: 8,
  police: [[0, -1.5], [-5, -5], [5, -6], [0, -10]] as [number, number][],
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
  phase: 'trace' | 'breach' | 'combat' | 'phone' | 'corridor' | 'dive' | 'ladder_ready' | 'climbing' | 'done' | 'failed';
  elapsed: number; lastTick: number; attempts: number;
  disarmed: boolean; ammo: number; shots: number; fallen?: Vector3;
  reloadAt?: number; climbed?: number;
  diveFrom?: { position: Vector3; yaw: number };
  pursuit?: OpeningPursuitCast;
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
