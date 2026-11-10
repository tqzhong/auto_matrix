import type { Vector3 } from '../types/agent.js';
import type { WorldStructure } from '../types/sandbox.js';
import { OPENING_ESCAPE, OPENING_PHONE, openingHitPose, openingTruckPose, type OpeningPhoneEncounter, type OpeningPhoneHit } from './opening-escape.js';

type TruckPose = ReturnType<typeof openingTruckPose>;
type Box = Vector3 & { width: number; height: number; depth: number };
type BoothPart = 'post' | 'phone' | 'roof';

export const WELLS_STREET = {
  bodyRadius: .72,
  bodyHeight: 5.7,
  sidewalkOffset: .34,
  sidewalkWidth: .15,
  sidewalkY: .2,
  sidewalkHeight: .45,
  poleRadius: .14,
  poleHeight: 14,
} as const;

export function streetLamps(width: number, depth: number): { x: number; z: number }[] {
  const lamps: { x: number; z: number }[] = [];
  for (const side of [-1, 1]) for (let z = -depth / 2 + 8; z < depth / 2; z += 23)
    lamps.push({ x: side * width * WELLS_STREET.sidewalkOffset, z });
  return lamps;
}

export function wellsSidewalkHeight(width: number, x: number): number {
  return Math.abs(Math.abs(x) - width * WELLS_STREET.sidewalkOffset) <= width * WELLS_STREET.sidewalkWidth / 2
    ? WELLS_STREET.sidewalkY + WELLS_STREET.sidewalkHeight / 2 : 0;
}

export const WELLS_BOOTH = {
  post: { y: 3.8, width: .15, height: 7.6, depth: .15 },
  pane: { y: 3.8, width: .06, height: 7, depth: 2.8 },
  cabinet: { x: 0, y: 3.8, z: 0, width: 1.45, height: 2.4, depth: .8 },
  backboard: { x: 0, y: 3.5, z: -.65, width: 1.6, height: 6.8, depth: .12 },
  roof: { y: 7.7, width: 3.8, height: .5, depth: 3.1 },
  posts: [-1.8, 1.8].flatMap(x => [-1.4, 1.4].map(z => ({ x, z }))),
  panes: [-1.8, 1.8],
} as const;

export const WELLS_TRUCK = {
  chassis: { x: 0, y: 1.9, z: 0, width: 4.2, height: 1.9, depth: 15 },
  windshield: { x: 0, y: 3.3, z: -.4, width: 3.7, height: 1.7, depth: 4 },
  roof: { x: 0, y: 4.2, z: -.5, width: 3.9, height: .18, depth: 4.2 },
  cargo: { x: 0, y: 4.3, z: 7, width: 5.65, height: 7.05, depth: 13.05 },
  wheels: [-2.1, 2.1].flatMap(x => [-2.9, 2.9].map(z => ({ x, y: 1.2, z, width: .6, height: 2, depth: 2 }))),
} as const;

const truckHull: Box[] = [
  WELLS_TRUCK.chassis, WELLS_TRUCK.windshield, WELLS_TRUCK.roof,
  // The ribs and tail fittings extend beyond the cargo shell.
  { ...WELLS_TRUCK.cargo, width: 5.82, z: 7.0975, depth: 13.245 },
  ...WELLS_TRUCK.wheels,
];

const smoothstep = (value: number, min: number, max: number): number => {
  const t = Math.max(0, Math.min(1, (value - min) / (max - min)));
  return t * t * (3 - 2 * t);
};

function boothPenetration(truck: TruckPose, x: number, z: number): number {
  const dx = x - truck.x, dz = OPENING_PHONE.boothZ + z - truck.z, sin = Math.sin(truck.yaw), cos = Math.cos(truck.yaw);
  return Math.abs(cos * dx - sin * dz) <= 2.25 ? Math.max(0, sin * dx + cos * dz + WELLS_TRUCK.chassis.depth / 2) : 0;
}

export function openingBoothCrush(truck: TruckPose): number {
  return Math.max(...WELLS_BOOTH.posts.map(({ x, z }) => boothPenetration(truck, x, z)));
}

export function openingBoothPartPose(kind: BoothPart, x: number, z: number, truck: TruckPose, crush: number) {
  if (kind === 'roof') {
    const fall = smoothstep(crush, .35, 3.5);
    return { x: -1.1 * fall, y: WELLS_BOOTH.roof.y + (.72 - WELLS_BOOTH.roof.y) * fall + Math.sin(Math.PI * fall) * .4,
      z: -(crush + 3) * fall, pitch: -.12 * fall, yaw: .16 * fall, roll: .08 * fall };
  }
  const phone = kind === 'phone', push = boothPenetration(truck, x, z + (phone ? WELLS_BOOTH.backboard.z : 0));
  const fall = smoothstep(push, 0, phone ? 2.1 : 1.7), side = Math.sign(x), travel = push + (phone ? .45 : .28) * fall;
  return { x: x - Math.sin(truck.yaw) * travel + side * .65 * fall, y: (phone ? .78 : .16) * fall, z: z - Math.cos(truck.yaw) * travel,
    pitch: -(phone ? 1.5 : 1.47) * fall, yaw: 0, roll: phone ? .04 * fall : -side * .12 * fall };
}

/** Fit the sloping wreckage with boxes in street coordinates. The render uses the same XYZ rotations. */
function boothPartBox(box: Box, pose: ReturnType<typeof openingBoothPartPose>): Box {
  const a = Math.cos(pose.pitch), b = Math.sin(pose.pitch), c = Math.cos(pose.yaw), d = Math.sin(pose.yaw);
  const e = Math.cos(pose.roll), f = Math.sin(pose.roll);
  const transform = (i: number, j: number, k: number) => ({
    center: i * box.x + j * box.y + k * box.z,
    size: Math.abs(i) * box.width + Math.abs(j) * box.height + Math.abs(k) * box.depth,
  });
  const x = transform(c * e, -c * f, d);
  const y = transform(a * f + b * d * e, a * e - b * d * f, -b * c);
  const z = transform(b * f - a * d * e, b * e + a * d * f, a * c);
  return { x: pose.x + x.center, y: pose.y + y.center, z: OPENING_PHONE.boothZ + pose.z + z.center,
    width: x.size, height: y.size, depth: z.size };
}

export function wellsStreetStructures(center: Vector3, phone?: OpeningPhoneEncounter): WorldStructure[] {
  const truck = openingTruckPose(phone ?? { phase: 'running', remaining: OPENING_ESCAPE.phoneSeconds, lastTick: 0, attempts: 0 });
  const result: WorldStructure[] = [];
  const add = (id: string, box: Box, yaw = 0) => result.push({ id: `film:wells:${id}`, kind: 'barricade', owner: 'matrix', matrix: true, health: 1,
    position: { x: center.x + box.x, y: center.y - 1 + box.y, z: center.z + box.z },
    film: { scene: 'm1_phone_escape', width: box.width, height: box.height, depth: box.depth, yaw } });
  const sin = Math.sin(truck.yaw), cos = Math.cos(truck.yaw);
  truckHull.forEach((box, i) => add(`truck:${i}`, { ...box, x: truck.x + cos * box.x + sin * box.z, z: truck.z - sin * box.x + cos * box.z }, truck.yaw));
  const crush = openingBoothCrush(truck);
  const phonePart = openingBoothPartPose('phone', 0, 0, truck, crush);
  add('cabinet', boothPartBox(WELLS_BOOTH.cabinet, phonePart));
  add('backboard', boothPartBox(WELLS_BOOTH.backboard, phonePart));
  add('roof', boothPartBox({ ...WELLS_BOOTH.roof, x: 0, y: 0, z: 0 }, openingBoothPartPose('roof', 0, 0, truck, crush)));
  WELLS_BOOTH.posts.forEach(({ x, z }, i) =>
    add(`post:${i}`, boothPartBox({ ...WELLS_BOOTH.post, x: 0, z: 0 }, openingBoothPartPose('post', x, z, truck, crush))));
  if (crush <= .06) WELLS_BOOTH.panes.forEach((x, i) => add(`pane:${i}`, { ...WELLS_BOOTH.pane, x, z: OPENING_PHONE.boothZ }));
  return result;
}

function boxGap(x: number, z: number, width: number, depth: number) {
  return { x: x - Math.max(-width / 2, Math.min(width / 2, x)), z: z - Math.max(-depth / 2, Math.min(depth / 2, z)) };
}

function localXZ(point: Vector3, center: Pick<Vector3, 'x' | 'z'>, yaw: number) {
  const x = point.x - center.x, z = point.z - center.z, c = Math.cos(yaw), s = Math.sin(yaw);
  return { x: x * c - z * s, z: x * s + z * c };
}

function volumeBlocked(point: Vector3, margin: number, bottom: number, top: number, solid: WorldStructure): boolean {
  const box = solid.film!;
  if (bottom >= solid.position.y + box.height / 2 - 1e-8 || top <= solid.position.y - box.height / 2) return false;
  const { x, z } = localXZ(point, solid.position, box.yaw ?? 0), gap = boxGap(x, z, box.width, box.depth);
  return gap.x * gap.x + gap.z * gap.z <= margin * margin;
}

export function wellsColliderBlocked(point: Vector3, radius: number, solid: WorldStructure): boolean {
  const body = radius > .5, margin = Math.min(radius, WELLS_STREET.bodyRadius);
  const bottom = point.y - (body ? 1 : margin), top = point.y + (body ? WELLS_STREET.bodyHeight - 1 : margin);
  return volumeBlocked(point, margin, bottom, top, solid);
}

export function wellsColliderFloor(point: Vector3, solid: WorldStructure): number {
  const box = solid.film!, top = solid.position.y + box.height / 2 + 1;
  if (point.y < top - 1e-8) return -Infinity;
  const { x, z } = localXZ(point, solid.position, box.yaw ?? 0);
  return Math.abs(x) <= box.width / 2 && Math.abs(z) <= box.depth / 2 ? top : -Infinity;
}

/** Locate the first truck contact within a player or story step, including its rotating sides. */
export function wellsTruckContact(before: TruckPose, after: TruckPose, origin: Vector3, yaw: number, dt: number): OpeningPhoneHit | undefined {
  const distance = Math.hypot(after.x - before.x, after.z - before.z) + 14 * Math.abs(after.yaw - before.yaw);
  if (distance < 1e-8) return;
  const contact = (t: number) => {
    const angle = before.yaw + (after.yaw - before.yaw) * t;
    const local = localXZ(origin, { x: before.x + (after.x - before.x) * t, z: before.z + (after.z - before.z) * t }, angle);
    for (const box of truckHull) {
      if (origin.y >= box.y + box.height / 2 || origin.y + WELLS_STREET.bodyHeight <= box.y - box.height / 2) continue;
      const gap = boxGap(local.x - box.x, local.z - box.z, box.width, box.depth);
      if (Math.hypot(gap.x, gap.z) <= WELLS_STREET.bodyRadius) return { gap, local, angle };
    }
  };
  const samples = Math.ceil(distance / .2);
  for (let i = 0; i <= samples; i++) {
    let end = i / samples;
    if (!contact(end)) continue;
    let start = Math.max(0, (i - 1) / samples);
    for (let j = 0; j < 16; j++) { const mid = (start + end) / 2; if (contact(mid)) end = mid; else start = mid; }
    const { gap, local, angle } = contact(end)!;
    const sin = Math.sin(angle), cos = Math.cos(angle);
    const x = gap.x + Math.sign(local.x || -1) * .46, z = gap.z - (Math.abs(gap.z) < .01 ? .24 : 0);
    const length = Math.hypot(x, z);
    return { elapsed: dt * (1 - end), at: dt * end, origin, yaw,
      direction: { x: (cos * x + sin * z) / length, z: (-sin * x + cos * z) / length } };
  }
}

/** A deflection must clear the rest of the truck's turn as well as the first contact. */
export function wellsHitRoute(hit: OpeningPhoneHit, width: number, depth: number): OpeningPhoneHit {
  const end = Math.max(OPENING_PHONE.hitSeconds, OPENING_ESCAPE.phoneSeconds + OPENING_ESCAPE.truckImpactSeconds - hit.at);
  const lamps = streetLamps(width, depth), samples = [];
  for (let time = .08; ; time = Math.min(end, time + .12)) {
    const elapsed = Math.min(time, OPENING_PHONE.hitSeconds), approach = OPENING_ESCAPE.phoneSeconds - hit.at - time;
    const solids = wellsStreetStructures({ x: 0, y: 1, z: 0 }, {
      phase: 'failed', remaining: Math.max(0, approach), impactElapsed: Math.max(0, -approach), lastTick: 0, attempts: 0,
    });
    const radius = WELLS_STREET.bodyRadius + 1.23 * smoothstep(elapsed, .24, 1.05);
    const height = WELLS_STREET.bodyHeight - 4.1 * smoothstep(elapsed, .2, 1);
    samples.push({ elapsed, solids, radius, height });
    if (time >= end) break;
  }
  const yaw = Math.atan2(hit.direction.x, hit.direction.z);
  let best = hit, least = Infinity;
  for (const turn of [0, -Math.PI / 6, Math.PI / 6, -Math.PI / 3, Math.PI / 3, -Math.PI / 2, Math.PI / 2]) {
    const candidate = { ...hit, direction: { x: Math.sin(yaw + turn), z: Math.cos(yaw + turn) } };
    const landing = openingHitPose({ ...candidate, elapsed: OPENING_PHONE.hitSeconds });
    const route = { ...candidate, landingY: wellsSidewalkHeight(width, landing.x) };
    let blocked = 0;
    for (const { elapsed, solids, radius, height } of samples) {
      const pose = openingHitPose({ ...route, elapsed });
      const floor = Math.max(pose.y, wellsSidewalkHeight(width, pose.x));
      if (Math.abs(pose.x) + radius > width / 2 - .6 || Math.abs(pose.z) + radius > depth / 2 - .6
        || lamps.some(lamp => Math.hypot(pose.x - lamp.x, pose.z - lamp.z) <= radius + WELLS_STREET.poleRadius)
        || solids.some(s => volumeBlocked(pose, radius, floor, floor + height, s))) blocked++;
    }
    if (!blocked) return route;
    if (blocked < least) { best = route; least = blocked; }
  }
  return best;
}
