export interface HammerHandover {
  phase: 'waiting' | 'moving' | 'ready';
  elapsed: number;
  blocked?: string;
}

export const HAMMER_HANDOVER_SECONDS = 12.5;
export const HAMMER_HANDOVER_CAST = ['ghost', 'morpheus', 'roland'] as const;

const clamp = (value: number) => Math.max(0, Math.min(1, value));
const smooth = (value: number) => { const t = clamp(value); return t * t * (3 - 2 * t); };

// Bridge-local routes: leave the seat from its open front, then use the aisle.
// The route and timing adapt the film's cut; they are not a reconstructed floor plan.
const ghostRoute = [[0, 1.65, -4.1, Math.PI], [1, 1.65, -4.1, Math.PI], [2, 1.65, -5.2, Math.PI],
  [3.4, 0, -5.2, -Math.PI / 2], [5.4, 0, -1.2, 0], [6.2, 2.15, -.4, .9],
  [8.4, 2.15, 4.8, 0], [9.4, 0, 6.5, -.8], [12.5, 0, 12.5, 0]];
const morpheusRoute = [[0, -2.7, -.6, Math.PI], [6.2, -2.7, -.6, Math.PI], [7.6, 0, -.6, Math.PI / 2],
  [9.6, 0, -5.65, Math.PI], [10.6, 1.65, -5.65, Math.PI / 2], [11.1, 1.65, -5.65, Math.PI], [12.5, 1.65, -4.1, Math.PI]];

export function hammerHandoverPose(state: HammerHandover, role: string) {
  const t = state.phase === 'ready' ? HAMMER_HANDOVER_SECONDS : state.elapsed;
  const route = role === 'ghost' ? ghostRoute : morpheusRoute;
  let i = route.findIndex(point => point[0] >= t); if (i < 1) i = t === 0 ? 1 : route.length - 1;
  const a = route[i - 1], b = route[i], ratio = smooth((t - a[0]) / (b[0] - a[0]));
  const angle = Math.atan2(Math.sin(b[3] - a[3]), Math.cos(b[3] - a[3]));
  const sitting = role === 'ghost' ? 1 - smooth(t - 1) : smooth((t - 11.1) / 1.4);
  return { x: a[1] + (b[1] - a[1]) * ratio, z: a[2] + (b[2] - a[2]) * ratio, yaw: a[3] + angle * ratio,
    sitting, grip: role === 'ghost' ? 1 - smooth(t / .7) : smooth((t - 12) / .5),
    walk: role === 'ghost' ? t > 2 && t < 12.5 : t > 6.2 && t < 11.1,
    gone: role === 'ghost' && state.phase === 'ready' };
}

export function hammerHandoverText(state: HammerHandover): string {
  if (state.blocked) return state.blocked;
  if (state.phase === 'waiting') return 'Ghost 正在副驾驶位。走到驾驶椅旁按 G，让他前往炮位，并请 Morpheus 接替。';
  if (state.phase === 'ready') return 'Ghost 已离开舰桥，Morpheus 握住副驾驶操纵杆。回到主驾驶位，按 G 接管 Hammer。';
  if (state.elapsed < 2) return 'Niobe 安排 Ghost 前往炮位。Ghost 松开操纵杆，起身离座。';
  if (state.elapsed < 6.2) return 'Ghost 正沿通道离开。请留出中央过道，Morpheus 在椅旁等待。';
  if (state.elapsed < 11.1) return 'Ghost 走向后舱，Morpheus 绕到副驾驶椅前。';
  return 'Morpheus 正坐下接过侧向推进器。等待双手握稳操纵杆。';
}
