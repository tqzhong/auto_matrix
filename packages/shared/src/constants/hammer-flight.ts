import type { DriveInput } from './freeway.js';

export const HAMMER_ROUTE = {
  start: 175, finish: -175, limit: 29, shipRadius: 6.25,
  debris: [
    { x: 7.7, z: 102, radius: 1.5 },
    { x: -16.5, z: -38, radius: 1.5 },
    { x: 16, z: -116, radius: 1.7 },
  ],
} as const;

export const HAMMER_COCKPIT = {
  floor: -2.35, seat: 1.16,
  roots: { niobe: { x: -1.65, z: -4.1 }, morpheus: { x: 1.65, z: -4.1 }, roland: { x: 0, z: 2.1 } },
  grip: { x: .48, y: 2.08, z: .93 },
  walk: { left: -4.1, right: 4.1, front: 166.1, back: 184.9, radius: .55 },
} as const;
export type HammerPilotRole = keyof typeof HAMMER_COCKPIT.roots;
export interface HammerPilotGesture { role: HammerPilotRole; flight: HammerFlight }

export function hammerShipPose(flight: Pick<HammerFlight, 'x' | 'z' | 'speed' | 'lateral' | 'maneuver'>) {
  if (flight.maneuver) {
    const frame = hammerRouteFrame(HAMMER_ROUTE.start - flight.z);
    const offset = hammerRotate(frame, { x: flight.x, y: flight.maneuver.lift, z: 0 });
    return { x: frame.x + offset.x, y: frame.y + offset.y, z: frame.z + offset.z,
      yaw: frame.yaw, pitch: frame.pitch, roll: flight.maneuver.bank };
  }
  return { x: flight.x, y: hammerHeight(flight.z), z: flight.z,
    yaw: -Math.atan2(flight.lateral, Math.max(1, flight.speed)) * .7, pitch: 0,
    roll: Math.max(-.18, Math.min(.18, -flight.lateral * .012)) };
}

/** Ship-local furniture, people and cameras use the same yaw and bank. */
export function hammerShipPoint(flight: Pick<HammerFlight, 'x' | 'z' | 'speed' | 'lateral' | 'maneuver'>, point: { x: number; y: number; z: number }) {
  const pose = hammerShipPose(flight), offset = hammerRotate(pose, point);
  return { x: pose.x + offset.x, y: pose.y + offset.y, z: pose.z + offset.z };
}

export function hammerCrewRoot(flight: HammerFlight, role: HammerPilotRole) {
  return { ...hammerShipPoint(flight, { ...HAMMER_COCKPIT.roots[role], y: HAMMER_COCKPIT.floor + 1 }), yaw: hammerShipPose(flight).yaw + Math.PI };
}

export function hammerControlTurn(flight: HammerFlight): number {
  return Math.max(-1, Math.min(1, flight.maneuver ? flight.lateral / 8 - flight.maneuver.bankVelocity / 1.25 : flight.lateral / 13)) * .22;
}

export function hammerControlGrip(flight: HammerFlight, side: number) {
  const angle = hammerControlTurn(flight);
  const x = side * HAMMER_COCKPIT.grip.x, y = HAMMER_COCKPIT.grip.y - 1.86;
  return { x: x * Math.cos(angle) - y * Math.sin(angle), y: 1.86 + x * Math.sin(angle) + y * Math.cos(angle), z: HAMMER_COCKPIT.grip.z };
}

export interface HammerFlight {
  x: number; z: number; speed: number; lateral: number; elapsed: number;
  hull: number; pursuit: number; cooldown: number; hits: number; debris: number;
  antennaLost: boolean; phase: 'riding' | 'arrived' | 'wrecked';
  // Absent in existing saves: they retain the original planar route until retry.
  // x and start-z are offsets/progress along the guided pipe, not world coordinates.
  maneuver?: { lift: number; vertical: number; bank: number; bankVelocity: number };
}

const bends = [
  { z: 175, x: 0 }, { z: 105, x: 0 }, { z: 42, x: -10 },
  { z: -18, x: -10 }, { z: -91, x: 9 }, { z: -145, x: 9 }, { z: -175, x: 4 },
];

export function hammerCenter(z: number): number {
  for (let i = 1; i < bends.length; i++) {
    if (z > bends[i].z) {
      const t = Math.max(0, Math.min(1, (bends[i - 1].z - z) / (bends[i - 1].z - bends[i].z)));
      const smooth = t * t * (3 - 2 * t);
      return bends[i - 1].x + (bends[i].x - bends[i - 1].x) * smooth;
    }
  }
  return bends[bends.length - 1].x;
}

export function hammerHalfWidth(z: number): number {
  const narrowing = Math.max(0, Math.min(1, (70 - z) / 12, (z - 18) / 12), Math.min(1, (-75 - z) / 12, (z + 135) / 12));
  return 13.2 - 3 * narrowing * narrowing * (3 - 2 * narrowing);
}

export function hammerHeight(z: number): number {
  return 10 + Math.sin((175 - z) / 52) * 1.7;
}

export function newHammerFlight(): HammerFlight {
  return { x: 0, z: HAMMER_ROUTE.start, speed: 0, lateral: 0, elapsed: 0,
    hull: 100, pursuit: 0, cooldown: 0, hits: 0, debris: 0, antennaLost: false, phase: 'riding',
    maneuver: { lift: 0, vertical: 0, bank: 0, bankVelocity: 0 } };
}

type HammerPoint = { x: number; y: number; z: number };

/** Yaw, pitch, then bank: the renderer uses the matching YXZ Euler order. */
function hammerRotate(pose: { yaw: number; pitch: number; roll: number }, point: HammerPoint): HammerPoint {
  const x = point.x * Math.cos(pose.roll) - point.y * Math.sin(pose.roll);
  const bankY = point.x * Math.sin(pose.roll) + point.y * Math.cos(pose.roll);
  const y = bankY * Math.cos(pose.pitch) - point.z * Math.sin(pose.pitch);
  const z = bankY * Math.sin(pose.pitch) + point.z * Math.cos(pose.pitch);
  return { x: x * Math.cos(pose.yaw) + z * Math.sin(pose.yaw), y, z: -x * Math.sin(pose.yaw) + z * Math.cos(pose.yaw) };
}

/** Game-adapted mechanical line: a real right-angle elbow followed by a climbing S bend. */
export function hammerRouteFrame(distance: number) {
  const elbowEnd = 70 + 40 * Math.PI;
  if (distance <= 70) return { x: 0, y: 10, z: 175 - distance, yaw: 0, pitch: 0, roll: 0 };
  if (distance <= elbowEnd) {
    const angle = (distance - 70) / 80;
    return { x: 80 * (1 - Math.cos(angle)), y: 10, z: 105 - 80 * Math.sin(angle), yaw: -angle, pitch: 0, roll: 0 };
  }
  const s = distance - elbowEnd;
  if (s <= 60) return { x: 80 + 100 * Math.sin(s / 100), y: 10 + 100 * (1 - Math.cos(s / 100)), z: 25, yaw: -Math.PI / 2, pitch: s / 100, roll: 0 };
  if (s <= 120) {
    const angle = (120 - s) / 100;
    return { x: 80 + 100 * (2 * Math.sin(.6) - Math.sin(angle)), y: 10 + 100 * (1 + Math.cos(angle) - 2 * Math.cos(.6)), z: 25, yaw: -Math.PI / 2, pitch: angle, roll: 0 };
  }
  return { x: 80 + 200 * Math.sin(.6) + s - 120, y: 10 + 200 * (1 - Math.cos(.6)), z: 25, yaw: -Math.PI / 2, pitch: 0, roll: 0 };
}

export function hammerTunnelSection(distance: number) {
  const narrow = Math.max(0, Math.min(1, (distance - 205) / 35, (302 - distance) / 35));
  const smooth = narrow * narrow * (3 - 2 * narrow);
  return { width: 13.2 - 7.1 * smooth, height: 11.88 + 2.12 * smooth };
}

export function hammerRoutePoint(distance: number, offset: HammerPoint): HammerPoint {
  const frame = hammerRouteFrame(distance), delta = hammerRotate(frame, offset);
  return { x: frame.x + delta.x, y: frame.y + delta.y, z: frame.z + delta.z };
}

/** Closest station on this non-intersecting pipe; also used to keep the orbit camera inside it. */
export function hammerProjectPoint(point: HammerPoint, station: number) {
  let distance = station;
  for (let i = 0; i < 5; i++) {
    const frame = hammerRouteFrame(distance), forward = hammerRotate(frame, { x: 0, y: 0, z: -1 });
    const along = (point.x - frame.x) * forward.x + (point.y - frame.y) * forward.y + (point.z - frame.z) * forward.z;
    distance = Math.max(-24, Math.min(374, distance + along));
    if (Math.abs(along) < .00001) break;
  }
  const frame = hammerRouteFrame(distance), right = hammerRotate(frame, { x: 1, y: 0, z: 0 }), up = hammerRotate(frame, { x: 0, y: 1, z: 0 });
  const x = point.x - frame.x, y = point.y - frame.y, z = point.z - frame.z;
  return { distance, x: x * right.x + y * right.y + z * right.z, y: x * up.x + y * up.y + z * up.z };
}

export const HAMMER_BEAMS = [
  { distance: 85, y: -8.3, width: 24, height: 7, depth: 3.8 },
  { distance: 330, y: 5.8, width: 24, height: 7.6, depth: 3.8 },
] as const;

export function hammerFlightHint(flight: HammerFlight): string {
  if (!flight.maneuver) return '沿机械管线转弯，避开横梁 · 低速会让哨兵追上';
  const distance = 175 - flight.z;
  if (distance < 105) return '前方下横梁：抬升船体 · 航向辅助沿管线右转';
  if (distance < 162) return '右转弯：回到管线中部 · 提前准备侧滚';
  if (distance < 280) return '狭管爬升：Q 向左侧滚约 90°，稍向左平移 · 松键保持姿态';
  return '前方上横梁：恢复水平并降低船体 · 保持速度驶向出口';
}

// Padded surfaces of the cabin, keel, nose, hover pods and outer vanes.
// Project each surface at its own depth: a center-radius check misses banks and bends.
const hull = [
  ...[
    { x: 4.42, y: [-2.45, 2.65], z: [-8.95, 9.95] },
    { x: 3.2, y: [-4.76, -2.64], z: [-7.85, 10.3] },
    { x: 2.6, y: [-3.92, -2.49], z: [5.55, 10.65] },
    { x: 3.11, y: [-5, -2.5], z: [-6.35] },
    { x: 1.2, y: [2.65, 5.12], z: [5.5, 5.7] },
  ].flatMap(box => [-box.x, box.x].flatMap(x => box.y.flatMap(y => box.z.map(z => ({ x, y, z }))))),
  { x: 0, y: -3.75, z: -14.35 },
  ...[-1, 1].flatMap(side => [
    ...[-3.65, -1.6, -1.2, 1.2, 1.6, 4, 4.4, 8.65].flatMap(z => Array.from({ length: 24 }, (_, i) => ({ x: side * 4.1 + Math.cos(i * Math.PI / 12) * 1.8, y: -4.2 + Math.sin(i * Math.PI / 12) * 1.8, z }))),
    ...[-3.55, 8.55].flatMap(z => [-4.34, -4.06].flatMap(y => [side * 5, side * HAMMER_ROUTE.shipRadius].map(x => ({ x, y, z })))),
    ...Array.from({ length: 16 }, (_, i) => ({ x: side * 4.1 + Math.cos(i * Math.PI / 8) * 1.25, y: -4.2 + Math.sin(i * Math.PI / 8) * 1.25, z: 11.5 })),
  ]),
];

function wallBounds(flight: HammerFlight) {
  let left = -Infinity, right = Infinity; const frame = { ...flight, x: 0 };
  for (const vertex of hull) {
    const point = hammerShipPoint(frame, vertex), radius = hammerHalfWidth(point.z) * .987;
    const vertical = (point.y - hammerHeight(point.z)) / (radius * .9);
    const width = radius * Math.sqrt(Math.max(0, 1 - vertical * vertical)), center = hammerCenter(point.z);
    left = Math.max(left, center - width - point.x); right = Math.min(right, center + width - point.x);
  }
  return { left, right };
}

function maneuverBlocked(flight: HammerFlight): boolean {
  const distance = HAMMER_ROUTE.start - flight.z;
  const points = hull.filter(vertex => !flight.antennaLost || vertex.y <= 2.66).map(vertex => hammerShipPoint(flight, vertex));
  for (const point of points) {
    const station = hammerProjectPoint(point, distance), section = hammerTunnelSection(station.distance);
    const x = station.x / section.width, y = station.y / section.height;
    // The visible wall is a 24-sided polygon, not an analytic ellipse.
    const angle = (Math.floor(Math.atan2(y, x) / (Math.PI / 12)) + .5) * Math.PI / 12;
    if (x * Math.cos(angle) + y * Math.sin(angle) > Math.cos(Math.PI / 24) * .992) return true;
  }
  for (const beam of HAMMER_BEAMS) {
    if (Math.abs(distance - beam.distance) > 19) continue;
    const frame = hammerRouteFrame(beam.distance), right = hammerRotate(frame, { x: 1, y: 0, z: 0 });
    const up = hammerRotate(frame, { x: 0, y: 1, z: 0 }), back = hammerRotate(frame, { x: 0, y: 0, z: 1 });
    let low = Infinity, high = -Infinity, front = Infinity, rear = -Infinity;
    for (const point of points) {
      const x = point.x - frame.x, y = point.y - frame.y, z = point.z - frame.z;
      if (Math.abs(x * right.x + y * right.y + z * right.z) > beam.width / 2 + .1) continue;
      const height = x * up.x + y * up.y + z * up.z, depth = x * back.x + y * back.y + z * back.z;
      low = Math.min(low, height); high = Math.max(high, height); front = Math.min(front, depth); rear = Math.max(rear, depth);
    }
    if (front < beam.depth / 2 + .1 && rear > -beam.depth / 2 - .1 && low < beam.y + beam.height / 2 + .1 && high > beam.y - beam.height / 2 - .1) return true;
  }
  return false;
}

function stepHammerManeuver(flight: HammerFlight, input: DriveInput, dt: number): HammerFlight {
  const next = { ...flight, maneuver: { ...flight.maneuver! }, elapsed: flight.elapsed + dt, cooldown: Math.max(0, flight.cooldown - dt) };
  next.speed = Math.max(0, Math.min(38, flight.speed + (input.brake ? -32 : input.throttle > 0 ? 19 : -7) * dt));
  const clamp = (value: number) => Math.max(-1, Math.min(1, value));
  next.lateral += (clamp(input.steer) * 8 - next.lateral) * (1 - Math.exp(-6 * dt));
  next.maneuver.vertical += (clamp(input.lift ?? 0) * 7 - next.maneuver.vertical) * (1 - Math.exp(-6 * dt));
  next.maneuver.bankVelocity += (clamp(input.roll ?? 0) * 1.25 - next.maneuver.bankVelocity) * (1 - Math.exp(-8 * dt));
  next.x += next.lateral * dt; next.z = Math.max(HAMMER_ROUTE.finish, next.z - next.speed * dt);
  next.maneuver.lift += next.maneuver.vertical * dt; next.maneuver.bank += next.maneuver.bankVelocity * dt;
  if (next.z <= 25) next.antennaLost = true;
  if (maneuverBlocked(next)) {
    // Stop forward motion, but allow safe corrective thrust at the last station.
    next.z = flight.z;
    next.antennaLost = flight.antennaLost;
    if (maneuverBlocked(next)) {
      next.x = flight.x; next.maneuver = { ...flight.maneuver!, vertical: 0, bankVelocity: 0 }; next.lateral = 0;
    }
    if (!next.cooldown && next.speed > 1) {
      next.hull = Math.max(0, next.hull - 26); next.speed *= .54; next.hits++; next.cooldown = .75;
    }
  }
  next.pursuit = Math.max(0, Math.min(100, next.pursuit + (next.speed < 18 ? 2.6 + (18 - next.speed) * .075 : -5.5) * dt));
  if (next.pursuit >= 70 && flight.pursuit < 70) next.hull = Math.max(0, next.hull - 12);
  if (next.hull <= 0 || next.pursuit >= 100 || next.elapsed >= HAMMER_ROUTE.limit && next.z > HAMMER_ROUTE.finish) next.phase = 'wrecked';
  else if (next.z <= HAMMER_ROUTE.finish) next.phase = 'arrived';
  if (next.phase !== 'riding') { next.speed = 0; next.lateral = 0; next.maneuver.vertical = 0; next.maneuver.bankVelocity = 0; }
  return next;
}

export function stepHammerFlight(flight: HammerFlight, input: DriveInput, delta: number): HammerFlight {
  if (flight.phase !== 'riding') return flight;
  const dt = Math.max(0, Math.min(.1, delta));
  if (!dt) return flight;
  if (flight.maneuver) return stepHammerManeuver(flight, input, dt);
  const next = { ...flight, elapsed: flight.elapsed + dt, cooldown: Math.max(0, flight.cooldown - dt) };
  next.speed = Math.max(0, Math.min(38, flight.speed + (input.brake ? -32 : input.throttle > 0 ? 19 : -7) * dt));
  const steer = Math.max(-1, Math.min(1, input.steer));
  next.lateral += (steer * Math.min(13, next.speed * .48) - next.lateral) * (1 - Math.exp(-6 * dt));
  next.x += next.lateral * dt; next.z -= next.speed * dt;
  let bounds = wallBounds(next);
  const squeezed = bounds.left > bounds.right;
  if (squeezed) { next.lateral = 0; bounds = wallBounds(next); }
  const wall = squeezed || next.x < bounds.left || next.x > bounds.right;
  next.x = Math.max(bounds.left, Math.min(bounds.right, next.x));
  let struck = wall && next.speed > 1;
  HAMMER_ROUTE.debris.forEach((pipe, index) => {
    const bit = 1 << index;
    if (next.debris & bit || flight.z < pipe.z - 3 || next.z > pipe.z + 3) return;
    if (Math.abs(next.x - pipe.x) < HAMMER_ROUTE.shipRadius + pipe.radius) { next.debris |= bit; struck = true; }
  });
  if (struck && !next.cooldown) {
    next.hull = Math.max(0, next.hull - 26); next.speed *= .54;
    next.lateral *= -.25; next.hits++; next.cooldown = .75;
  }
  next.pursuit = Math.max(0, Math.min(100, next.pursuit + (next.speed < 18 ? 2.6 + (18 - next.speed) * .075 : -5.5) * dt));
  if (next.pursuit >= 70 && flight.pursuit < 70) next.hull = Math.max(0, next.hull - 12);
  if (next.z <= 25) next.antennaLost = true;
  if (next.hull <= 0 || next.pursuit >= 100 || next.elapsed >= HAMMER_ROUTE.limit && next.z > HAMMER_ROUTE.finish) {
    next.phase = 'wrecked'; next.speed = 0; next.lateral = 0;
  } else if (next.z <= HAMMER_ROUTE.finish) {
    next.phase = 'arrived'; next.z = HAMMER_ROUTE.finish; next.speed = 0; next.lateral = 0;
  }
  bounds = wallBounds(next);
  next.x = Math.max(bounds.left, Math.min(bounds.right, next.x));
  return next;
}
