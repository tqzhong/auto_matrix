import type { FilmJourney } from './film-story.js';

export const DOCK_GATE = {
  z: -64, centerY: 28, radius: 25, travel: 27,
  cable: { x: 31, z: -61, bottom: 26, top: 38, radius: .62 },
  weight: { x: 31, y: 20, z: -61, travel: 14 },
  seconds: 120, ammo: 80, hits: 8, opening: 5, entering: 6,
} as const;
export interface DockGate {
  phase: 'ready' | 'aiming' | 'opening' | 'entering' | 'done' | 'failed';
  elapsed: number; total: number; remaining: number; ammo: number; hits: number; shots: number;
  x: number; z: number; yaw: number; pitch: number;
  lastShot?: { at: number; x: number; y: number; z: number; hit: boolean };
}
export function newDockGate(x: number, z: number): DockGate {
  const eye = dockGateEye({ x, z }), dx = DOCK_GATE.cable.x - 3 - eye.x, dz = DOCK_GATE.cable.z - eye.z;
  return { phase: 'ready', elapsed: 0, total: 0, remaining: DOCK_GATE.seconds, ammo: DOCK_GATE.ammo,
    hits: 0, shots: 0, x, z, yaw: Math.atan2(dx, dz), pitch: -Math.atan2(24 - eye.y, Math.hypot(dx, dz)) };
}
export function dockGateActive(journey?: FilmJourney): boolean {
  return Boolean(journey && journey.scene === 'm3_gate' && !journey.visiting && (journey.step === 2 && !journey.completed.includes(journey.scene) || journey.step === 3 && journey.dockGate?.phase === 'done'));
}
// Local set coordinates: the rendered dock floor is one unit below its world anchor.
export function dockGateEye(gate: Pick<DockGate, 'x' | 'z'>) { return { x: gate.x, y: 6.91, z: gate.z - .35 }; }
export function dockGateAim(gate: Pick<DockGate, 'x' | 'z' | 'yaw' | 'pitch'>) {
  const eye = dockGateEye(gate), direction = { x: Math.sin(gate.yaw) * Math.cos(gate.pitch), y: -Math.sin(gate.pitch), z: Math.cos(gate.yaw) * Math.cos(gate.pitch) };
  const distance = direction.z < -.01 ? Math.max(8, Math.min(200, (DOCK_GATE.cable.z - eye.z) / direction.z)) : 80;
  return { x: eye.x + direction.x * distance, y: eye.y + direction.y * distance, z: eye.z + direction.z * distance };
}
export function dockGateOpen(gate?: DockGate): number {
  if (!gate || !['opening', 'entering', 'done'].includes(gate.phase)) return 0;
  return gate.phase === 'opening' ? Math.min(1, 2 * Math.max(0, gate.elapsed - .25) ** 2 / DOCK_GATE.travel) : 1;
}
export function dockGateShip(gate?: DockGate) {
  const progress = gate?.phase === 'entering' ? Math.min(1, gate.elapsed / DOCK_GATE.entering) : gate?.phase === 'done' ? 1 : 0;
  return { x: 12, y: 26 - 6 * progress, z: -114 + 128 * progress, roll: .65 * Math.sin(Math.PI * progress) };
}
export function fireDockGate(gate: DockGate, yaw: number, pitch: number): boolean {
  if (gate.phase !== 'aiming' || !Number.isFinite(yaw) || !Number.isFinite(pitch) || gate.ammo <= 0
    || gate.lastShot && gate.total - gate.lastShot.at < .1 - 1e-6) return false;
  gate.yaw = yaw; gate.pitch = Math.max(-1.35, Math.min(1.35, pitch)); gate.ammo--; gate.shots++;
  const eye = dockGateEye(gate), dx = Math.sin(yaw) * Math.cos(gate.pitch), dy = -Math.sin(gate.pitch), dz = Math.cos(yaw) * Math.cos(gate.pitch);
  const cable = DOCK_GATE.cable, ox = eye.x - cable.x, oz = eye.z - cable.z;
  const a = dx * dx + dz * dz, b = 2 * (ox * dx + oz * dz), c = ox * ox + oz * oz - cable.radius ** 2;
  const discriminant = b * b - 4 * a * c;
  const distance = discriminant >= 0 && a > 1e-8 ? (-b - Math.sqrt(discriminant)) / (2 * a) : -1;
  const hit = distance > 0 && eye.y + dy * distance >= cable.bottom && eye.y + dy * distance <= cable.top;
  const t = hit ? distance : 85;
  gate.lastShot = { at: gate.total, x: eye.x + dx * t, y: eye.y + dy * t, z: eye.z + dz * t, hit };
  if (hit && ++gate.hits >= DOCK_GATE.hits) { gate.phase = 'opening'; gate.elapsed = 0; }
  else if (!gate.ammo) { gate.phase = 'failed'; gate.elapsed = 0; }
  return hit;
}
export function stepDockGate(gate: DockGate, seconds: number): void {
  if (['ready', 'done', 'failed'].includes(gate.phase)) return;
  const dt = Math.max(0, Math.min(.1, seconds)); gate.elapsed += dt; gate.total += dt;
  if (gate.phase === 'aiming') {
    gate.remaining = Math.max(0, gate.remaining - dt);
    if (!gate.remaining) { gate.phase = 'failed'; gate.elapsed = 0; }
  } else if (gate.phase === 'opening' && gate.elapsed >= DOCK_GATE.opening) { gate.phase = 'entering'; gate.elapsed = 0; }
  else if (gate.phase === 'entering' && gate.elapsed >= DOCK_GATE.entering) { gate.phase = 'done'; gate.elapsed = 0; }
}
export function dockGateText(gate: DockGate): string {
  return gate.phase === 'ready' ? '门控已经失效。留在 APU 内，按 G 接管机炮，瞄准闸门右上方的承重缆索。'
    : gate.phase === 'aiming' ? '鼠标上下左右瞄准 · 左键或 T 开炮。击断承重缆索，让配重牵开闸门。'
      : gate.phase === 'opening' ? '承重缆索断裂，配重沿导轨下落，厚重门叶正在横向滑开。'
        : gate.phase === 'entering' ? 'Hammer 侧倾穿过门口。等船体完全进入，再把视角交给 Link。'
          : gate.phase === 'failed' ? gate.ammo ? 'Hammer 未能及时获得通路。打开 J，从闸门炮位重试。' : '机炮弹箱耗尽，承重缆索仍未断开。打开 J，从闸门炮位重试。'
            : 'Hammer 已进入船坞。按 G 交接 Link，准备启动 EMP。';
}
