export interface ConstructArrival { phase: 'ready' | 'image' | 'approach'; elapsed: number }
export interface ConstructGesture extends ConstructArrival { role: 'neo' | 'morpheus' }

export const CONSTRUCT = {
  arrival: { x: 6.95, z: 5, yaw: Math.PI },
  approach: { x: 6.95, z: -4.75 },
  neo: { x: 6.35, z: -4.75, yaw: -2.22 },
  chair: { z: -6.2, width: 2.5, depth: 2.35, height: 3.48, scale: .65 },
  chairX: { neo: 4.4, morpheus: -4.4 },
  television: { x: 0, z: -13, width: 3.4, depth: 2.25, height: 2.8, screenY: 1.8, faceZ: 1.15 },
  imageSeconds: 6,
  guideSeconds: 11,
} as const;
export const CONSTRUCT_FURNITURE = [
  ...Object.values(CONSTRUCT.chairX).map(x => ({ x, z: CONSTRUCT.chair.z, width: CONSTRUCT.chair.width, depth: CONSTRUCT.chair.depth, height: CONSTRUCT.chair.height })),
  { ...CONSTRUCT.television },
];
const smooth = (value: number) => { const t = Math.max(0, Math.min(1, value)); return t * t * (3 - 2 * t); };
const route = [{ x: -2, z: 4 }, { x: -6.6, z: 1 }, { x: -6.6, z: -8.1 }, { x: -4.4, z: -8.1 }];
const lengths = route.slice(1).map((point, i) => Math.hypot(point.x - route[i].x, point.z - route[i].z));
const length = lengths.reduce((sum, value) => sum + value, 0);

/** Morpheus walks outside the armchair, turns, and sits from its open front. */
export function constructGuidePose(elapsed: number) {
  let remaining = Math.min(1, Math.max(0, (elapsed - 2) / 7)) * length;
  const seat = smooth((elapsed - 9.4) / 1.6);
  if (elapsed >= 9) return { x: -4.4, z: -8.1 + 1.9 * seat, yaw: Math.PI, seated: seat, speed: 0 };
  for (let i = 0; i < lengths.length; i++) {
    if (remaining > lengths[i] && i < lengths.length - 1) { remaining -= lengths[i]; continue; }
    const a = route[i], b = route[i + 1], t = remaining / lengths[i];
    return { x: a.x + (b.x - a.x) * t, z: a.z + (b.z - a.z) * t,
      yaw: elapsed <= 2 ? Math.PI / 2 : Math.atan2(b.x - a.x, b.z - a.z), seated: 0, speed: elapsed > 2 ? length / 7 : 0 };
  }
  return { x: -4.4, z: -6.2, yaw: Math.PI, seated: 1, speed: 0 };
}

export function constructArrivalText(arrival: ConstructArrival): string {
  return arrival.phase === 'ready' ? '脚下只有白色。头发和衣服恢复了，身体上的插口却不见了。按 G 检查这副熟悉的形象。'
    : arrival.phase === 'image' ? arrival.elapsed < 3 ? 'Neo 检查手臂，又摸向后颈。这里没有现实身体的金属接口。'
      : 'Morpheus 解释：程序中的样子来自你对自己的认识。感到熟悉，并不能证明它存在于外部世界。'
      : '走到右侧皮椅的外侧椅背旁，按 G 触摸皮革。它的触感能证明什么？';
}
