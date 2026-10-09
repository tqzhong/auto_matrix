import { TRUCKS, type TruckRoad, type TruckRoot } from './trucks.js';

export const TRUCK_HOOD = { kick: .75, gravity: 9.8, fallingVelocity: 1.2, impact: 2.2, glassSeconds: .25, grip: 1.25, passing: 3.5,
  run: .65, flight: 1.55, contactStart: 1.12, contactEnd: 1.49, landing: .55,
  car: { width: 4.1, depth: 9.3, front: 4.65, roof: 3, windshield: -.55, hood: 3.1 },
  back: { z: 1.4, rootDrop: 1.65, recoil: .14, settle: .55 },
  wheel: { y: 2.01, z: .04 },
  driver: { x: -.78, y: .32, z: -.85 }, passenger: { x: .78, y: .32, z: -.85 } } as const;
export type TruckHoodPhase = 'kick' | 'falling' | 'impact' | 'hood' | 'slipping' | 'passing' | 'ready' | 'running' | 'flight' | 'landing' | 'miss' | 'failed' | 'done';
export type TruckHoodRole = 'morpheus' | 'agent_johnson' | 'niobe' | 'ghost';
export interface TruckHood {
  phase: TruckHoodPhase;
  elapsed: number;
  total: number;
  attempt: number;
  starts: { morpheus: TruckRoot; agent_johnson: TruckRoot };
  health: number;
  car: { x: number; z: number; yaw: number };
  contactCar?: { x: number; z: number; yaw: number };
  balance: number;
  grip: number;
  glassAge?: number;
  kicked?: number;
  kickQueued?: boolean;
  failure?: string;
}
export interface TruckHoodGesture extends TruckHood { role: TruckHoodRole; truck: TruckRoad['truck'] }
const clamp = (x: number) => Math.max(0, Math.min(1, x));
const smooth = (x: number) => { const t = clamp(x); return t * t * (3 - 2 * t); };
const mix = (a: number, b: number, t: number) => a + (b - a) * t;
export function truckHoodHeight(z: number): number {
  return z >= 1.2 ? 1.9 - (z - 1.2) * .085 : z >= -.65 ? 1.9 + (1.2 - z) / 1.85 * 1.1 : 3;
}
export function truckHoodRunZ(elapsed: number): number {
  return mix(TRUCK_HOOD.car.hood, TRUCK_HOOD.car.windshield, smooth(elapsed / TRUCK_HOOD.run));
}
export function newTruckHood(morpheus: TruckRoot, johnson: TruckRoot, health: number, attempt: number): TruckHood {
  return { phase: 'kick', elapsed: 0, total: 0, attempt, starts: { morpheus: { ...morpheus }, agent_johnson: { ...johnson } },
    health, car: { x: 7, z: -9, yaw: 0 }, balance: 0, grip: 0 };
}
export function truckHoodFallSeconds(): number {
  const support = truckHoodHeight(TRUCK_HOOD.back.z) - TRUCK_HOOD.back.rootDrop;
  return (TRUCK_HOOD.fallingVelocity + Math.sqrt(TRUCK_HOOD.fallingVelocity ** 2 + 2 * TRUCK_HOOD.gravity * (TRUCKS.roof.height - support))) / TRUCK_HOOD.gravity;
}
export function truckHoodBack(h: TruckHood): number {
  return h.phase === 'falling' ? smooth(h.elapsed / truckHoodFallSeconds())
    : h.phase === 'impact' ? 1 - smooth((h.elapsed - TRUCK_HOOD.back.settle) / (TRUCK_HOOD.impact - TRUCK_HOOD.back.settle)) : 0;
}
export function truckHoodCar(h: TruckHood): TruckHood['car'] {
  if (h.phase === 'kick' || h.phase === 'falling') {
    const t = smooth((h.phase === 'kick' ? h.elapsed : TRUCK_HOOD.kick + h.elapsed) / (TRUCK_HOOD.kick + truckHoodFallSeconds()));
    return { x: mix(7, 5.3, t), z: mix(-9, h.starts.morpheus.z - TRUCK_HOOD.back.z, t), yaw: -.12 * Math.sin(t * Math.PI) };
  }
  if (h.phase === 'passing') {
    const p = clamp(h.elapsed / TRUCK_HOOD.passing);
    const start = h.contactCar ?? { x: 5.3, z: h.starts.morpheus.z - TRUCK_HOOD.car.hood, yaw: 0 };
    return { x: mix(start.x, .3, smooth((p - .7) / .3)),
      z: mix(start.z, 20.5, smooth(p / .7)), yaw: start.yaw * (1 - smooth(p / .7)) - .25 * Math.sin(Math.PI * clamp((p - .7) / .3)) };
  }
  return { ...h.car };
}
export function truckHoodCarPoint(h: TruckHood, p: { x: number; y: number; z: number }): TruckRoot {
  const c = h.car;
  return { x: c.x + p.x * Math.cos(c.yaw) + p.z * Math.sin(c.yaw), y: p.y,
    z: c.z + p.z * Math.cos(c.yaw) - p.x * Math.sin(c.yaw), yaw: c.yaw };
}
export function truckHoodRoot(h: TruckHood, role: TruckHoodRole): TruckRoot {
  if (role === 'niobe' || role === 'ghost') return truckHoodCarPoint(h, TRUCK_HOOD[role === 'niobe' ? 'driver' : 'passenger']);
  const s = h.starts[role], t = h.elapsed;
  if (role === 'agent_johnson') {
    if (h.phase === 'kick') { const p = smooth(t / TRUCK_HOOD.kick); return { x: mix(s.x, 1.05, p), y: s.y, z: mix(s.z, h.starts.morpheus.z, p), yaw: Math.PI / 2 }; }
    if (h.kicked !== undefined) { const a = Math.max(0, h.total - h.kicked); return { x: .15 - 11 * a, y: 6.6 + 3.5 * a - 4.9 * a * a, z: -8.5, yaw: Math.PI / 2 }; }
    const p = smooth(Math.max(0, h.total - TRUCK_HOOD.kick) / 3);
    return { x: mix(1.05, .15, p), y: 6.6, z: mix(h.starts.morpheus.z, -8.5, p), yaw: h.phase === 'flight' ? Math.PI * (1 - smooth(t / .7)) : Math.PI };
  }
  if (h.phase === 'kick') { const p = smooth(t / TRUCK_HOOD.kick); return { x: mix(s.x, 2.95, p), y: s.y, z: s.z, yaw: Math.PI / 2 }; }
  if (h.phase === 'falling') {
    const p = clamp(t / truckHoodFallSeconds());
    return { x: mix(2.95, 5.3, p), y: s.y + TRUCK_HOOD.fallingVelocity * t - .5 * TRUCK_HOOD.gravity * t * t, z: s.z, yaw: 0 };
  }
  if (h.phase === 'impact') {
    const recovered = 1 - truckHoodBack(h), z = mix(TRUCK_HOOD.back.z, TRUCK_HOOD.car.hood, recovered);
    const bounce = t < TRUCK_HOOD.back.settle ? TRUCK_HOOD.back.recoil * Math.sin(Math.PI * t / TRUCK_HOOD.back.settle) : 0;
    return truckHoodCarPoint(h, { x: 0, y: truckHoodHeight(z) - TRUCK_HOOD.back.rootDrop * (1 - recovered) + bounce, z });
  }
  if (h.phase === 'running') {
    const z = truckHoodRunZ(t), root = truckHoodCarPoint(h, { x: h.balance, y: truckHoodHeight(z), z });
    return { ...root, yaw: root.yaw + Math.PI };
  }
  if (h.phase === 'flight') {
    const start = truckHoodCarPoint(h, { x: h.balance, y: truckHoodHeight(TRUCK_HOOD.car.windshield), z: TRUCK_HOOD.car.windshield });
    const p = clamp(t / TRUCK_HOOD.flight), vy = (6.6 - start.y + .5 * TRUCK_HOOD.gravity * TRUCK_HOOD.flight ** 2) / TRUCK_HOOD.flight;
    return { x: mix(start.x, .15, p), y: start.y + vy * t - .5 * TRUCK_HOOD.gravity * t * t, z: mix(start.z, -7.35, p), yaw: Math.PI };
  }
  if (['landing', 'done'].includes(h.phase)) return { x: .15, y: 6.6, z: -7.35, yaw: Math.PI };
  if (h.phase === 'miss' || h.phase === 'failed' && h.failure === 'miss') return { x: .15 + t * 4.5, y: Math.max(0, 6.6 + t * 1.2 - 4.9 * t * t), z: -7.35, yaw: Math.PI / 2 };
  if (h.phase === 'slipping' || h.phase === 'failed' && h.failure === 'balance') return truckHoodCarPoint(h, { x: h.balance + Math.sign(h.balance) * 2.8 * t,
    y: Math.max(0, truckHoodHeight(TRUCK_HOOD.car.hood) - .5 * TRUCK_HOOD.gravity * t * t), z: TRUCK_HOOD.car.hood });
  const root = truckHoodCarPoint(h, { x: h.balance, y: truckHoodHeight(TRUCK_HOOD.car.hood), z: TRUCK_HOOD.car.hood });
  if (h.phase === 'ready' || h.phase === 'passing') root.yaw += Math.PI * (h.phase === 'ready' ? 1 : smooth((t - .7) / .7));
  return root;
}
export function truckHoodText(h: TruckHood): string {
  return h.phase === 'kick' ? 'Johnson 的重踢把你逼到车顶边缘；Niobe 正赶来接应。'
    : h.phase === 'falling' ? '背部落向 Niobe 的挡风玻璃。'
    : h.phase === 'impact' ? '挡风玻璃承住撞击。缓过冲击，撑到车盖上；准备按住 G 抓稳。'
    : h.phase === 'hood' ? 'A / D 调整重心，按住 G 抓稳车盖；不要踏出两侧。'
    : h.phase === 'slipping' ? '脚下失去支撑，正在滑出车盖。'
    : h.phase === 'passing' ? 'Niobe 加速从侧面超到卡车前方。准备借挡风玻璃起跳。'
    : h.phase === 'ready' ? 'Niobe 已到卡车前方。空格沿挡风玻璃起跑；接近 Johnson 时按 F 飞踢。'
    : h.phase === 'running' ? '踩上挡风玻璃，跃向 Johnson。准备 F 飞踢。'
    : h.phase === 'flight' ? h.kicked === undefined ? '靠近 Johnson 时按 F 飞踢；过早出脚不能命中。' : '飞踢击中 Johnson；准备落回卡车车顶。'
    : h.phase === 'landing' || h.phase === 'done' ? 'Johnson 被踢离卡车；钥匙匠仍在后方。'
    : h.phase === 'miss' ? '没有踢中 Johnson；他的反击把你打向车顶外侧。'
    : '接应失败。按 J 重试车盖检查点，同伴旧伤保留。';
}
