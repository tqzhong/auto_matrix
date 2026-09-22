import type { FilmJourney } from './film-story.js';

export interface MeetingEncounter {
  phase: 'boarding' | 'choice' | 'leaving' | 'ready' | 'scanning' | 'located' | 'removing' | 'discarding' | 'done' | 'driving' | 'parked' | 'exiting' | 'outside';
  elapsed: number;
  bugged: boolean;
  approach: { x: number; z: number; yaw: number };
}
export type MeetingRole = 'neo' | 'trinity' | 'switch' | 'apoc';
export type MeetingGesture = Pick<MeetingEncounter, 'phase' | 'elapsed' | 'bugged'> & { role: MeetingRole };
export const MEETING_CAST = ['trinity', 'switch', 'apoc'] as const;
export const MEETING_CAR = { x: 0, z: -14, width: 5.4, depth: 13.6, height: 4.35, seat: 1.28, rear: 1.65, front: -1.6,
  approach: { x: 4, z: -12.35 } } as const;
export const MEETING_DESTINATION = { x: 640, z: 29 } as const;
export const MEETING_ROAD_WIDTH = 28;
const arcTime = Math.PI * 12 / 10;
const road = [
  { x: 0, z: -14, dx: 0, dz: -76, length: 76, seconds: 6, startSpeed: 0, endSpeed: 10 },
  { x: 24, z: -90, angle: Math.PI, length: Math.PI * 12, seconds: arcTime, startSpeed: 10, endSpeed: 10 },
  { x: 24, z: -114, dx: 656, dz: 0, length: 656, seconds: 30, startSpeed: 10, endSpeed: 10 },
  { x: 680, z: -90, angle: -Math.PI / 2, length: Math.PI * 12, seconds: arcTime, startSpeed: 10, endSpeed: 10 },
  { x: 704, z: -90, dx: 0, dz: 104, length: 104, seconds: 6, startSpeed: 10, endSpeed: 10 },
  { x: 680, z: 14, angle: 0, length: Math.PI * 12, seconds: arcTime, startSpeed: 10, endSpeed: 10 },
  { x: 680, z: 38, dx: -25, dz: 0, length: 25, seconds: 4, startSpeed: 10, endSpeed: 0 },
];
export const MEETING_DRIVE_SECONDS = road.reduce((sum, span) => sum + span.seconds, 0);
export const MEETING_TIMING = { boarding: 8, leaving: 8, scanning: 8, removing: 6, discarding: 5, driving: MEETING_DRIVE_SECONDS, exiting: 8 } as const;
const ease = (time: number, from: number, to: number) => { const t = Math.max(0, Math.min(1, (time - from) / (to - from))); return t * t * (3 - 2 * t); };
const mix = (a: number, b: number, t: number) => a + (b - a) * t;
// Shared world-space route, with matching tangents and speeds at every join.
// Neo is a passenger; Apoc drives. This is a compressed game route, not a map
// claiming to reproduce the film's off-screen journey through the city.
export function meetingDrive(seconds: number) {
  let remaining = Math.max(0, Math.min(MEETING_DRIVE_SECONDS, seconds)); let travelled = 0;
  for (let i = 0; i < road.length; i++) {
    const span = road[i];
    if (remaining > span.seconds && i < road.length - 1) { remaining -= span.seconds; travelled += span.length; continue; }
    const t = Math.min(1, remaining / span.seconds); const t2 = t * t; const t3 = t2 * t;
    const distance = (-2 * t3 + 3 * t2) * span.length + (t3 - 2 * t2 + t) * span.startSpeed * span.seconds + (t3 - t2) * span.endSpeed * span.seconds;
    const speed = ((-6 * t2 + 6 * t) * span.length + (3 * t2 - 4 * t + 1) * span.startSpeed * span.seconds + (3 * t2 - 2 * t) * span.endSpeed * span.seconds) / span.seconds;
    if (span.angle !== undefined) {
      const angle = span.angle + distance / 24;
      return { x: span.x + Math.cos(angle) * 24, z: span.z + Math.sin(angle) * 24, yaw: Math.atan2(Math.sin(angle), -Math.cos(angle)), speed, steering: -.31, distance: travelled + distance };
    }
    return { x: span.x + span.dx! * distance / span.length, z: span.z + span.dz! * distance / span.length,
      yaw: Math.atan2(-span.dx!, -span.dz!), speed, steering: 0, distance: travelled + distance };
  }
  throw new Error('The meeting route must contain at least one span');
}
export const MEETING_ROAD_SAMPLES = [
  { x: 0, z: 55, yaw: 0 },
  ...Array.from({ length: 201 }, (_, i) => meetingDrive(i / 200 * MEETING_DRIVE_SECONDS)),
  { x: 560, z: 38, yaw: Math.PI / 2 },
];
export function meetingRoadContains(x: number, z: number, radius = 0): boolean {
  if (x < -24 || x > 729 || z < -138 || z > 80) return false;
  const width = 22 - radius;
  for (let i = 1; i < MEETING_ROAD_SAMPLES.length; i++) {
    const a = MEETING_ROAD_SAMPLES[i - 1]; const b = MEETING_ROAD_SAMPLES[i];
    const dx = b.x - a.x; const dz = b.z - a.z;
    const t = Math.max(0, Math.min(1, ((x - a.x) * dx + (z - a.z) * dz) / (dx * dx + dz * dz)));
    if ((x - a.x - dx * t) ** 2 + (z - a.z - dz * t) ** 2 < width * width) return true;
  }
  return false;
}
export function meetingCarPose(gesture?: Pick<MeetingGesture, 'phase' | 'elapsed'>) {
  return meetingDrive(gesture?.phase === 'driving' ? gesture.elapsed : gesture && ['parked', 'exiting', 'outside'].includes(gesture.phase) ? MEETING_DRIVE_SECONDS : 0);
}
export function meetingCarPoint(car: { x: number; z: number; yaw: number }, x: number, z: number) {
  return { x: car.x + Math.cos(car.yaw) * x + Math.sin(car.yaw) * z, z: car.z - Math.sin(car.yaw) * x + Math.cos(car.yaw) * z };
}
export function meetingLocked(journey: FilmJourney): boolean {
  return !journey.visiting && (journey.scene === 'm1_bridge' && !!journey.meeting || journey.scene === 'm1_bug' && journey.meeting?.phase !== 'outside');
}
export function meetingPose(gesture: MeetingGesture) {
  const phase = gesture.phase; const t = gesture.elapsed;
  const boarding = phase === 'boarding' || phase === 'leaving' || phase === 'exiting' || phase === 'outside';
  const gettingOut = gesture.role === 'trinity' && (phase === 'exiting' || phase === 'outside');
  const enter = phase === 'outside' ? 0 : phase === 'leaving' || phase === 'exiting' ? MEETING_TIMING.leaving - t : t;
  const scanning = phase === 'scanning' ? ease(t, 0, 3) : ['located', 'removing'].includes(phase) ? 1 : phase === 'discarding' ? 1 - ease(t, 0, 3) : 0;
  return {
    seat: boarding && (gesture.role === 'neo' || gettingOut) ? ease(enter, 2.4, 5.5) : 1,
    duck: boarding && (gesture.role === 'neo' || gettingOut) ? ease(enter, 1.4, 2.6) * (1 - ease(enter, 4.5, 6)) : 0,
    door: boarding ? ease(enter, .2, 1.7) * (1 - ease(enter, 6.2, 7.8)) : 0,
    recline: scanning,
    probe: phase === 'scanning' ? ease(t, 2.5, 5.8) : ['located', 'removing'].includes(phase) ? 1 : phase === 'discarding' ? 1 - ease(t, 0, 1.5) : 0,
    pump: phase === 'removing' ? Math.sin(t * Math.PI * 2) * .5 + .5 : 0,
    extraction: phase === 'removing' ? ease(t, 2.8, 6) : phase === 'discarding' || phase === 'done' ? 1 : 0,
    discard: phase === 'discarding' ? ease(t, 1, 3.2) : 0,
    ejected: phase === 'discarding' && t >= 3.2,
    alert: phase === 'choice' ? 1 : phase === 'scanning' ? 1 - ease(t, 0, 2) : 0,
  };
}
export function meetingRoot(encounter: MeetingEncounter, role: MeetingRole) {
  const seat = MEETING_CAR.seat;
  const rear = MEETING_CAR.z + MEETING_CAR.rear;
  const car = meetingCarPose(encounter);
  const world = (x: number, z: number, yaw: number) => ({ ...meetingCarPoint(car, x, z - MEETING_CAR.z), yaw: yaw + car.yaw });
  if (role === 'trinity' && (encounter.phase === 'exiting' || encounter.phase === 'outside')) {
    const t = encounter.phase === 'outside' ? 0 : MEETING_TIMING.exiting - encounter.elapsed;
    const blend = ease(t, 2, 5.5); const turn = ease(t, 1.2, 5.5);
    return world(mix(-4, -seat, blend), rear, -Math.PI * turn);
  }
  if (role !== 'neo') return world(role === 'switch' ? seat : -seat, role === 'trinity' ? rear : MEETING_CAR.z + MEETING_CAR.front, Math.PI);
  if (['boarding', 'leaving', 'exiting', 'outside'].includes(encounter.phase)) {
    const t = encounter.phase === 'outside' ? 0 : encounter.phase === 'leaving' || encounter.phase === 'exiting' ? MEETING_TIMING.leaving - encounter.elapsed : encounter.elapsed;
    const arrived = encounter.phase === 'exiting' || encounter.phase === 'outside';
    const approach = arrived ? { ...MEETING_CAR.approach, yaw: 0 } : encounter.approach;
    if (arrived) {
      const curb = meetingCarPoint(car, approach.x, approach.z - MEETING_CAR.z);
      approach.yaw = Math.atan2(MEETING_DESTINATION.x - curb.x, MEETING_DESTINATION.z - curb.z) - car.yaw;
    }
    const blend = ease(t, 2, 5.5); const turn = ease(t, 1.2, 5.5);
    const angle = Math.atan2(Math.sin(Math.PI - approach.yaw), Math.cos(Math.PI - approach.yaw));
    const align = ease(t, 0, 1.8);
    return world(mix(mix(approach.x, 3.6, align), seat, blend), mix(approach.z, rear, align), approach.yaw + angle * turn);
  }
  return world(seat, rear, Math.PI);
}
