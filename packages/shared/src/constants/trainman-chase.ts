import type { FilmJourney } from './film-story.js';
import type { Vector3 } from '../types/agent.js';

// The film's carriage, stairs, ticket gates and second platform share one space.
// Distances, pursuit deadline, a manual gate vault and retries are game rules.
export const TRAINMAN_CHASE = {
  set: 'film_trainman_subway', cast: ['seraph', 'trinity', 'morpheus', 'trainman'] as const,
  entry: { x: -30, z: 38 }, question: { x: -30, z: 18.8 },
  car: { x: -30, z: 28, width: 8.4, length: 36, height: 6.7, doorZ: 20, doorWidth: 4.4 },
  upper: 5.2, stairLength: 12, stairCount: 24, vaultSeconds: 1.1, brakingSeconds: 3.2,
  lever: { x: -25.97, y: 3.5, z: 20 },
  gate: { x: 0, z: -21.5, approachX: -3.2, finishX: 3.2, height: 1.75 },
  cover: { x: 21.1, z: -35.5 }, exit: { x: 17, z: -31 }, escape: { x: 20, z: -48, runZ: -68 },
  pursuitSeconds: 46, coverSeconds: 10.8,
  route: [
    [-30, 25, 0], [-26.6, 20, 0], [-20.5, 20, 0], [-17, 12, 0], [-17, -4, 0], [-17, -16, 5.2],
    [-17, -21.5, 5.2], [-3.2, -21.5, 5.2], [3.2, -21.5, 5.2], [17, -21.5, 5.2],
    [17, -16, 5.2], [17, -4, 0], [23, -4, 0], [23, -48, 0], [20, -48, 0],
  ] as const,
} as const;

export interface TrainmanChase {
  phase: 'ready' | 'confronting' | 'braking' | 'running' | 'vaulting' | 'cover' | 'crossing' | 'escaped' | 'failed';
  elapsed: number; age: number; route: number; remaining: number; attempts: number;
  passedGate: boolean; routeStage: number; crew: { trinity: number; morpheus: number };
  paused?: string; unavailable?: string; dodgeUntil?: number;
  aim?: Vector3; shot?: { from: Vector3; to: Vector3; age: number; blocked: boolean };
  impacts: { x: number; y: number; z: number }[]; playerRoute?: number;
  vaultStart?: { x: number; z: number; yaw: number };
}
export type TrainmanChaseGesture = Pick<TrainmanChase, 'phase' | 'elapsed' | 'age' | 'paused' | 'unavailable'> & {
  role: typeof TRAINMAN_CHASE.cast[number]; bracing?: boolean; vault?: number; recoil?: number; stride?: number; dodging?: number;
};
export function newTrainmanChase(): TrainmanChase {
  return { phase: 'ready', elapsed: 0, age: 0, route: 0, remaining: TRAINMAN_CHASE.pursuitSeconds,
    attempts: 0, passedGate: false, routeStage: 0, crew: { trinity: -16, morpheus: -20 }, impacts: [] };
}
export function trainmanChaseActive(journey?: FilmJourney): boolean { return journey?.scene === 'm3_trainman_chase' && !journey.visiting; }
export function trainmanChaseLocked(state?: Pick<TrainmanChase, 'phase' | 'paused' | 'unavailable'>): boolean {
  return Boolean(state && (state.paused || state.unavailable || ['confronting', 'braking', 'vaulting', 'failed'].includes(state.phase)));
}
export function trainmanRouteLength(): number {
  return TRAINMAN_CHASE.route.slice(1).reduce((sum, node, i) => sum + Math.hypot(node[0] - TRAINMAN_CHASE.route[i][0], node[1] - TRAINMAN_CHASE.route[i][1], node[2] - TRAINMAN_CHASE.route[i][2]), 0);
}
export function trainmanVaultLift(t: number): number {
  return Math.sin(Math.PI * Math.max(0, Math.min(1, (t - .22) / .64))) * 2.3;
}
export function trainmanVaultProgress(t: number, fromX: number = TRAINMAN_CHASE.gate.approachX): number {
  // Rise beside the barrier before moving the folded legs across it.
  const gate = TRAINMAN_CHASE.gate, plantX = gate.approachX + (gate.finishX - gate.approachX) * .30;
  const plant = (plantX - fromX) / (gate.finishX - fromX);
  return t < .22 ? t / .22 * plant : t < .36 ? plant : plant + (t - .36) / .64 * (1 - plant);
}
export function trainmanRoutePose(distance: number) {
  if (distance < 0) return { x: -30, y: 0, z: 25 - distance, yaw: Math.PI, vault: undefined };
  const nodes = TRAINMAN_CHASE.route; let remaining = Math.max(0, distance);
  for (let i = 1; i < nodes.length; i++) {
    const a = nodes[i - 1], b = nodes[i], length = Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]);
    if (remaining <= length || i === nodes.length - 1) {
      const t = Math.min(1, remaining / length);
      const vault = i === 8 ? t : undefined;
      const travel = vault === undefined ? t : trainmanVaultProgress(t);
      return { x: a[0] + (b[0] - a[0]) * travel, z: a[1] + (b[1] - a[1]) * travel,
        y: vault === undefined ? trainmanFloor(a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t) : TRAINMAN_CHASE.upper + trainmanVaultLift(t),
        yaw: Math.atan2(b[0] - a[0], b[1] - a[1]), vault };
    }
    remaining -= length;
  }
  return { x: TRAINMAN_CHASE.escape.x, y: 0, z: TRAINMAN_CHASE.escape.z, yaw: 0, vault: undefined };
}
export function trainmanRouteProgress(x: number, y: number, z: number): number {
  if (x < -27 && z > 25) return 25 - z;
  let travelled = 0, best = 0, nearest = Infinity;
  const nodes = TRAINMAN_CHASE.route;
  for (let i = 1; i < nodes.length; i++) {
    const a = nodes[i - 1], b = nodes[i], dx = b[0] - a[0], dz = b[1] - a[1], dy = b[2] - a[2], squared = dx * dx + dz * dz + dy * dy;
    const t = Math.max(0, Math.min(1, ((x - a[0]) * dx + (z - a[1]) * dz + (y - a[2]) * dy) / squared));
    const gap = Math.hypot(x - a[0] - dx * t, z - a[1] - dz * t, y - a[2] - dy * t);
    if (gap < nearest) { nearest = gap; best = travelled + Math.sqrt(squared) * t; }
    travelled += Math.sqrt(squared);
  }
  return best;
}
export function trainmanFloor(x: number, z: number, y?: number): number {
  if (Math.abs(x) <= 22 && z <= -16 && z >= -27 && (y === undefined || y >= TRAINMAN_CHASE.upper - .5)) return TRAINMAN_CHASE.upper;
  if (Math.abs(Math.abs(x) - 17) <= 3.6 && z <= -4 && z >= -16)
    return Math.ceil((-z - 4) / TRAINMAN_CHASE.stairLength * TRAINMAN_CHASE.stairCount) / TRAINMAN_CHASE.stairCount * TRAINMAN_CHASE.upper;
  if (x >= 24 && x < 32 && z <= 0) return -1.3;
  return 0;
}
const contains = (x: number, z: number, left: number, right: number, back: number, front: number, radius: number) => x >= left + radius && x <= right - radius && z >= back + radius && z <= front - radius;
export function trainmanContains(x: number, z: number, radius: number): boolean {
  // Slightly overlapping floors allow a capsule to pass the stair landings.
  return contains(x, z, -34.2, -25.65, 10, 46, radius) || contains(x, z, -31, -12.6, 17.6, 22.4, radius)
    || contains(x, z, -25.6, -12.6, -5.5, 49, radius)
    || contains(x, z, -20.6, -13.4, -18, -2, radius)
    || contains(x, z, -22, 22, -27, -16, radius)
    || contains(x, z, 13.4, 20.6, -18, -2, radius)
    || contains(x, z, 10.8, 42, -55, -2, radius)
    || contains(x, z, 32, 42, -71, -53, radius);
}
export interface TrainmanObstacle { x: number; y: number; z: number; width: number; depth: number; height: number; kind: 'wall' | 'seat' | 'column' | 'gate'; }
export const TRAINMAN_OBSTACLES: TrainmanObstacle[] = [
  { x: -34.2, y: 0, z: 28, width: .25, depth: 36, height: 6.7, kind: 'wall' },
  { x: -25.8, y: 0, z: 14, width: .25, depth: 7.6, height: 6.7, kind: 'wall' },
  { x: -25.8, y: 0, z: 34.2, width: .25, depth: 24, height: 6.7, kind: 'wall' },
  { x: -30, y: 0, z: 10, width: 8.4, depth: .3, height: 6.7, kind: 'wall' },
  { x: -30, y: 0, z: 46, width: 8.4, depth: .3, height: 6.7, kind: 'wall' },
  { x: 32.25, y: 0, z: -63, width: .45, depth: 16, height: 8.8, kind: 'wall' },
  { x: 42.25, y: 0, z: -63, width: .45, depth: 16, height: 8.8, kind: 'wall' },
  { x: 37.25, y: 0, z: -71, width: 10, depth: .45, height: 8.8, kind: 'wall' },
  ...[-1, 1].flatMap(side => [14, 26, 32, 38].map(z => ({ x: -30 + side * 3, y: 0, z, width: 2.1, depth: 2.6, height: 2.7, kind: 'seat' as const }))),
  ...[-20.9, 21.1].flatMap(x => [-2, 12, 26, 40].map(z => ({ x, y: 0, z: x > 0 ? -z - 12 : z, width: 1.5, depth: 1.5, height: 8, kind: 'column' as const }))),
  ...[-18.3, -21.5, -24.7].map(z => ({ x: 0, y: 5.2, z, width: 1.2, depth: 2.8, height: 1.75, kind: 'gate' as const })),
];
export function trainmanBlocked(x: number, y: number, z: number, radius: number): boolean {
  return !trainmanContains(x, z, radius) || TRAINMAN_OBSTACLES.some(o => y < o.y + o.height && y + 3.5 > o.y
    && Math.abs(x - o.x) < o.width / 2 + radius && Math.abs(z - o.z) < o.depth / 2 + radius);
}
export function trainmanCarPose(state?: TrainmanChase) {
  const opening = state && !['ready', 'confronting'].includes(state.phase) ? Math.min(1, Math.max(0, state.elapsed - 2.3) / .9) : 0;
  return { doors: state?.phase === 'braking' ? opening : state && !['ready', 'confronting'].includes(state.phase) ? 1 : 0,
    speed: state?.phase === 'braking' ? Math.max(0, 1 - state.elapsed / TRAINMAN_CHASE.brakingSeconds) : state && !['ready', 'confronting'].includes(state.phase) ? 0 : 1 };
}
export function trainmanPassingTrain(state?: TrainmanChase) {
  if (!state || !['cover', 'crossing', 'escaped'].includes(state.phase)) return { visible: false, z: -180, headlight: 0 };
  const age = state.phase === 'cover' ? Math.max(0, state.elapsed - 7.2) : 3.6 + state.elapsed;
  return { visible: age < 10.4, z: TRAINMAN_CHASE.escape.z - 144 + age * 24, headlight: Math.min(1, age / 2.5) };
}
export function trainmanChaseTarget(state?: TrainmanChase) {
  if (!state || state.phase === 'ready' || state.phase === 'confronting' || state.phase === 'braking') return TRAINMAN_CHASE.question;
  if (state.phase === 'escaped') return TRAINMAN_CHASE.exit;
  if (state.phase === 'cover' || state.phase === 'crossing') return TRAINMAN_CHASE.cover;
  if (!state.passedGate && state.routeStage >= 2) return { x: TRAINMAN_CHASE.gate.approachX, z: TRAINMAN_CHASE.gate.z };
  return [{ x: -20, z: 20 }, { x: -17, z: -3 }, { x: -17, z: -19 }, { x: 17, z: -19 }, { x: 17, z: -3 }, { x: 23, z: -3 }, TRAINMAN_CHASE.cover][Math.min(6, state.routeStage)];
}
export function trainmanChaseCanAct(state: TrainmanChase | undefined, position: Vector3, center: Vector3): boolean {
  if (state?.paused || state?.unavailable || trainmanChaseLocked(state)) return false;
  const point = !state || state.phase === 'ready' ? TRAINMAN_CHASE.question : state.phase === 'escaped' ? TRAINMAN_CHASE.exit
    : state.phase === 'running' && !state.passedGate && state.routeStage >= 2 ? { x: TRAINMAN_CHASE.gate.approachX, z: TRAINMAN_CHASE.gate.z } : undefined;
  return Boolean(point && Math.hypot(position.x - center.x - point.x, position.z - center.z - point.z,
    position.y - center.y - trainmanFloor(point.x, point.z)) <= (state?.phase === 'running' ? 1.8 : 2));
}
export function trainmanChaseText(state?: TrainmanChase): string {
  if (state?.unavailable) return `${state.unavailable} 无法参与追逐，伤亡和当前进度保留。`;
  if (state?.paused) return `${state.paused} 正由另一位玩家控制。列车、枪击和同行者停在当前进度。`;
  switch (state?.phase) {
    case 'confronting': return state.elapsed < 3 ? 'Seraph：我们需要找到被困的朋友，请帮我们接通那条线路。' : 'Trainman 拔出左轮，拒绝接近。留出距离，观察他的右手。';
    case 'braking': return 'Trainman 拉下紧急制动。车厢猛烈减速，站台灯掠过窗外；等车门打开再追出去。';
    case 'running': return state.passedGate ? `赶到 Platform 2。沿另一座楼梯下行，利用钢柱接近。剩余 ${Math.ceil(state.remaining)} 秒。`
      : state.routeStage >= 2 ? '穿过站厅。靠近关闭的闸机，在左侧标记按 G 翻越；Trinity 与 Morpheus 随后过闸。'
        : `Shift 奔跑追出车门，沿 Platform 1 上楼。剩余 ${Math.ceil(state.remaining)} 秒。`;
    case 'vaulting': return 'Seraph 撑过闸机。同行者分别翻越，落脚后沿 Platform 2 标识继续。';
    case 'cover': return 'Trainman 在柱后开枪。贴住钢柱或按 X 闪避已锁定的射线，等列车进入站台。';
    case 'crossing': return '列车不会停！Trainman 借车头到来前跃过轨道；留在站台，追赶没有接通那条线路。';
    case 'escaped': return '列车驶过后，对面已经没有 Trainman。走到同行者身旁按 G，决定直接去找 Merovingian。';
    case 'failed': return '队伍失去了 Trainman 的踪迹，或被列车隔开。J 重试当前追逐；已发生的伤亡与反思保留。';
    default: return 'WASD 穿过车厢中央通道。靠近前排的 Trainman，按 G 请他帮忙。';
  }
}
