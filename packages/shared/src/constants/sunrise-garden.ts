import type { TrilogyEpilogueEncounter, TrilogyEpilogueGesture } from './trilogy-epilogue.js';

/** Local metres shared by the waterfront, its collision and the four performers. */
export const SUNRISE_GARDEN = {
  bench: { x: -7, z: -20, width: 7.4, depth: 1.65, surface: .86, height: 2.44 },
  approach: { x: -7, z: -23.1 },
  shore: -36,
  promenadeWidth: 320,
  departure: { x: -140, z: -31, speed: 4.4, turnSeconds: .65, rampSeconds: .7 },
  trees: [[-19, -15, 1.2], [24, -8, 1.4], [-31, 14, 1.5], [30, 21, 1.6], [-17, 38, 1.3], [10, 46, 1.5],
    [-70, 38, 1.4], [-51, 32, 1.5], [-36, 42, 1.3], [-10, 36, 1.6], [12, 38, 1.5], [42, 39, 1.5], [56, 34, 1.3], [73, 40, 1.5],
    [-80, 65, 1.5], [-60, 60, 1.4], [-40, 63, 1.6], [-20, 57, 1.3], [0, 49, 1.6], [20, 58, 1.4], [40, 62, 1.6], [60, 59, 1.3], [80, 64, 1.4],
    [-42, 29, .70], [-31, 32, .75], [-20, 29, .80], [-10, 29, .70], [8, 30, .72], [20, 30, .78], [34, 29, .68], [48, 33, .74],
    [-48, 48, .78], [-27, 47, .75], [-12, 47, .80], [8, 48, .76], [28, 46, .72], [48, 46, .80]],
  bankTrees: 86,
} as const;

const smooth = (value: number) => { const t = Math.max(0, Math.min(1, value)); return t * t * (3 - 2 * t); };
const mix = (a: number, b: number, t: number) => a + (b - a) * t;

/** The promenade, bench and legacy ready spawn stay level; the arrivals cross a low grassy rise. */
export function gardenGroundHeight(x: number, z: number): number {
  const rise = 2.6 * smooth((z + 4) / 23) * (1 - smooth((z - 20) / 12));
  const back = 5.4 * smooth((z - 40) / 48);
  return (rise + back) * (.85 + .15 * Math.cos(x * .045));
}

/** The asset is in metres; these transforms are shared by drawing and stem collision. */
export function gardenTreePlacement(index: number) {
  const [x, z, scale] = SUNRISE_GARDEN.trees[index];
  return { x, y: gardenGroundHeight(x, z), z, scale: scale * 2.8, yaw: index * 2.399963229728653 };
}

/** Coarse, instanced trees on the inaccessible opposite bank. */
export function gardenBankTreePlacement(index: number) {
  return { x: -310 + index * 7.3, y: -.2, z: -153 + Math.sin(index * 2.1) * 5,
    scale: 1.8 + (Math.sin(index * 1.3) + 1) * .325, yaw: index * 2.399963229728653 };
}

export function gardenTreeObstacle(index: number) {
  const tree = gardenTreePlacement(index), c = Math.cos(tree.yaw), s = Math.sin(tree.yaw);
  // Mature trees use the low stem; shorter grove trees need the entire visible trunk and bough bounds.
  const short = tree.scale < 2.7;
  const centerX = short ? .085 : .25, centerZ = short ? .765 : -.215, halfX = short ? .85 : .34, halfZ = short ? 1.16 : .835;
  return { x: tree.x + (c * centerX + s * centerZ) * tree.scale, z: tree.z + (-s * centerX + c * centerZ) * tree.scale,
    width: (Math.abs(c) * halfX + Math.abs(s) * halfZ) * tree.scale * 2,
    depth: (Math.abs(s) * halfX + Math.abs(c) * halfZ) * tree.scale * 2, height: tree.y + (short ? 3.7 * tree.scale : 12) };
}

/** Turn away from the bench, reach the promenade, then continue beyond the conversation. */
export function gardenDeparturePose(departure: NonNullable<TrilogyEpilogueEncounter['parkDeparture']>) {
  const { origin, elapsed } = departure, route = SUNRISE_GARDEN.departure;
  const shoreLength = Math.abs(route.z - origin.z), shoreSeconds = shoreLength / route.speed + Math.min(route.rampSeconds, shoreLength / route.speed);
  const westLength = Math.max(0, origin.x - route.x), westSeconds = westLength / route.speed + Math.min(route.rampSeconds, westLength / route.speed);
  const shoreYaw = route.z < origin.z ? Math.PI : 0, westYaw = -Math.PI / 2;
  const turn = (from: number, to: number, t: number) => from + Math.atan2(Math.sin(to - from), Math.cos(to - from)) * smooth(t / route.turnSeconds);
  const walk = (age: number, length: number, seconds: number) => {
    if (!length) return { distance: 0, weight: 0 };
    const t = Math.max(0, Math.min(seconds, age)), ramp = Math.min(route.rampSeconds, length / route.speed);
    const integrated = (u: number) => ramp * (u ** 3 - .5 * u ** 4);
    const distance = route.speed * (t < ramp ? integrated(t / ramp)
      : t > seconds - ramp ? length / route.speed - integrated((seconds - t) / ramp) : t - ramp / 2);
    return { distance: Math.max(0, Math.min(length, distance)), weight: smooth(t / ramp) * smooth((seconds - t) / ramp) };
  };
  const seconds = route.turnSeconds * 2 + shoreSeconds + westSeconds;
  if (elapsed < route.turnSeconds) return { x: origin.x, z: origin.z, yaw: turn(origin.yaw, shoreYaw, elapsed), seated: 0, walk: 0, seconds };
  const shoreAge = elapsed - route.turnSeconds;
  if (shoreAge < shoreSeconds) {
    const stride = walk(shoreAge, shoreLength, shoreSeconds);
    return { x: origin.x, z: mix(origin.z, route.z, shoreLength ? stride.distance / shoreLength : 1),
      yaw: shoreYaw, seated: 0, walk: stride.weight, seconds };
  }
  const westAge = shoreAge - shoreSeconds;
  if (westAge < route.turnSeconds) return { x: origin.x, z: route.z, yaw: turn(shoreYaw, westYaw, westAge), seated: 0, walk: 0, seconds };
  const stride = walk(westAge - route.turnSeconds, westLength, westSeconds);
  return { x: origin.x - stride.distance, z: route.z, yaw: westYaw, seated: 0, walk: stride.weight, seconds };
}

export function gardenPose(encounter: TrilogyEpilogueEncounter, role: TrilogyEpilogueGesture['role']) {
  const phase = encounter.phase, elapsed = encounter.elapsed;
  const bench = SUNRISE_GARDEN.bench;
  if (role === 'oracle') {
    const origin = encounter.parkApproach ?? { ...SUNRISE_GARDEN.approach, yaw: 0 };
    const moving = phase === 'sitting' ? smooth(elapsed / 1.65) : 1;
    const turn = phase === 'sitting' ? smooth(elapsed / .9) : 1;
    const yawDelta = Math.atan2(Math.sin(Math.PI - origin.yaw), Math.cos(Math.PI - origin.yaw));
    return { x: mix(origin.x, bench.x, moving), z: mix(origin.z, bench.z - .14, moving), yaw: origin.yaw + yawDelta * turn,
      seated: phase === 'ready' ? 0 : phase === 'sitting' ? smooth((elapsed - 1.05) / 1.35) : 1, walk: phase === 'sitting' && elapsed < 1.65 ? 1 : 0 };
  }
  if (role === 'architect') {
    if (encounter.parkDeparture) return gardenDeparturePose(encounter.parkDeparture);
    const arriving = phase === 'architect' ? smooth(elapsed / 3.8) : ['ready', 'sitting', 'cat'].includes(phase) ? 0 : 1;
    const leaving = phase === 'leaving' ? smooth(elapsed / 4.8) : ['promise', 'sati', 'sunrise', 'belief', 'done'].includes(phase) ? 1 : 0;
    return { x: mix(mix(-25, -8.3, arriving), -30, leaving), z: mix(mix(-30, -25.5, arriving), -30, leaving),
      yaw: leaving > 0 ? -Math.PI / 2 : mix(1.3, 0, smooth((arriving - .8) / .2)), seated: 0,
      walk: phase === 'architect' && elapsed < 3.8 || phase === 'leaving' ? 1 : 0 };
  }
  const modern = encounter.parkArrivalVersion === 2, seraph = role === 'seraph';
  const seconds = modern ? seraph ? 10.3 : 9.2 : 4.8;
  const present = ['sunrise', 'belief', 'done'].includes(phase), arrival = present ? 1 : phase === 'sati' ? smooth(elapsed / seconds) : 0;
  if (role === 'seraph') {
    const startZ = modern ? 14 : -28, walking = Math.atan2(-1.7 - 14, -18.4 - startZ);
    const listening = Math.atan2(bench.x + 1.7, bench.z - .14 + 18.4);
    return { x: mix(14, -1.7, arrival), z: mix(startZ, -18.4, arrival),
      yaw: mix(walking, listening, smooth((arrival - .8) / .2)), seated: 0,
      walk: phase === 'sati' && elapsed < seconds ? 1 : 0 };
  }
  const towardSky = encounter.phase === 'sunrise' ? smooth(elapsed / 6.2) : ['belief', 'done'].includes(phase) ? 1 : 0;
  const startX = modern ? 11 : 12, startZ = modern ? 9 : -29;
  const t = arrival, a = 1 - t;
  // Pass around the bench's right end before joining the Oracle on its water-facing side.
  const x = modern ? a ** 3 * 11 + 3 * a * a * t * 11 + 3 * a * t * t * 4 - t ** 3 * 4.6 : mix(startX, -4.6, arrival);
  const z = modern ? a ** 3 * 9 - 3 * a * a * t * 4 - 3 * a * t * t * 25 - t ** 3 * 22.4 : mix(startZ, -22, arrival);
  const walking = modern ? Math.atan2(-42 * a * t - 25.8 * t * t, -39 * a * a - 126 * a * t + 7.8 * t * t) : -1.2;
  const listening = modern ? mix(walking, -1.2, smooth((arrival - .8) / .2)) : walking;
  return { x, z,
    yaw: mix(listening, -Math.PI, towardSky), seated: 0,
    walk: phase === 'sati' && elapsed < seconds ? 1 : 0 };
}

export function gardenSunrise(encounter?: TrilogyEpilogueEncounter): number {
  return encounter?.phase === 'sunrise' ? smooth(encounter.elapsed / 6.2)
    : encounter && ['belief', 'done'].includes(encounter.phase) ? 1 : 0;
}
