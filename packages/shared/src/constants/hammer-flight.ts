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

export function hammerShipPose(flight: Pick<HammerFlight, 'x' | 'z' | 'speed' | 'lateral'>) {
  return { x: flight.x, y: hammerHeight(flight.z), z: flight.z,
    yaw: -Math.atan2(flight.lateral, Math.max(1, flight.speed)) * .7,
    roll: Math.max(-.18, Math.min(.18, -flight.lateral * .012)) };
}

/** Ship-local furniture, people and cameras use the same yaw and bank. */
export function hammerShipPoint(flight: Pick<HammerFlight, 'x' | 'z' | 'speed' | 'lateral'>, point: { x: number; y: number; z: number }) {
  const pose = hammerShipPose(flight), x = point.x * Math.cos(pose.roll) - point.y * Math.sin(pose.roll);
  return { x: pose.x + x * Math.cos(pose.yaw) + point.z * Math.sin(pose.yaw),
    y: pose.y + point.x * Math.sin(pose.roll) + point.y * Math.cos(pose.roll),
    z: pose.z - x * Math.sin(pose.yaw) + point.z * Math.cos(pose.yaw) };
}

export function hammerCrewRoot(flight: HammerFlight, role: HammerPilotRole) {
  return { ...hammerShipPoint(flight, { ...HAMMER_COCKPIT.roots[role], y: HAMMER_COCKPIT.floor + 1 }), yaw: hammerShipPose(flight).yaw + Math.PI };
}

export function hammerControlGrip(flight: HammerFlight, side: number) {
  const angle = Math.max(-1, Math.min(1, flight.lateral / 13)) * .22;
  const x = side * HAMMER_COCKPIT.grip.x, y = HAMMER_COCKPIT.grip.y - 1.86;
  return { x: x * Math.cos(angle) - y * Math.sin(angle), y: 1.86 + x * Math.sin(angle) + y * Math.cos(angle), z: HAMMER_COCKPIT.grip.z };
}

export interface HammerFlight {
  x: number; z: number; speed: number; lateral: number; elapsed: number;
  hull: number; pursuit: number; cooldown: number; hits: number; debris: number;
  antennaLost: boolean; phase: 'riding' | 'arrived' | 'wrecked';
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
    hull: 100, pursuit: 0, cooldown: 0, hits: 0, debris: 0, antennaLost: false, phase: 'riding' };
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

export function stepHammerFlight(flight: HammerFlight, input: DriveInput, delta: number): HammerFlight {
  if (flight.phase !== 'riding') return flight;
  const dt = Math.max(0, Math.min(.1, delta));
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
