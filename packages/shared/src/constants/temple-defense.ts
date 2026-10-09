import type { FilmJourney } from './film-story.js';

export const TEMPLE_DEFENSE = {
  seconds: 42, reach: .8, mounting: 2.8, returnSeconds: 3.2,
  mounts: [{ x: -8, z: -49.1 }, { x: 8, z: -49.1 }],
  wheel: { y: 2.45, z: -46.15, radius: .52, angle: 1.25 },
  operatorZ: -45, refuge: { x: 0, z: -18 },
  obstacles: [{ x: -8, z: -50, width: 4.4, depth: 7.5, height: 4.3 }, { x: 8, z: -50, width: 4.4, depth: 7.5, height: 4.3 },
    { x: -10.8, z: -48.7, width: 1.8, depth: 1.2, height: 2.3 }, { x: 10.8, z: -48.7, width: 1.8, depth: 1.2, height: 2.3 }],
  cast: ['zee', 'link', 'lock', 'hamann', 'kid', 'zion_parent', 'zion_neighbor', 'citizen_15', 'citizen_16'],
  breach: { orders: 4.4, drilling: 8.2, waiting: 4.8, actor: { x: 3.8, z: -37.5, yaw: Math.PI } },
} as const;

/** The serialized name templeSeal is retained for old saves; sealed now means the artillery is secured. */
export interface TempleDefense {
  phase: 'running' | 'failed' | 'sealed'; remaining: number; lastTick: number; attempts: number;
  turns?: [number, number]; elapsed?: number; mount?: 0 | 1; gripAge?: number; waiting?: number;
  paused?: string; unavailable?: string;
}
export interface TempleBreach {
  phase: 'ready' | 'orders' | 'breach' | 'waiting' | 'done'; elapsed: number;
  paused?: string; unavailable?: string;
}
export interface TempleDefenseGesture {
  role: string; phase: 'standing' | 'mounting' | 'orders' | 'breach' | 'waiting' | 'done';
  elapsed: number; mount?: 0 | 1; turn: number; grip: number;
}
export function newTempleDefense(tick: number, attempts = 0): TempleDefense {
  return { phase: 'running', remaining: TEMPLE_DEFENSE.seconds, lastTick: tick, attempts, turns: [0, 0], elapsed: 0, waiting: 0 };
}
export function templeDefenseActive(journey?: FilmJourney): boolean {
  return Boolean(journey && !journey.visiting && ['m3_temple_defense', 'm3_temple_breach'].includes(journey.scene));
}
export function templeDefenseLocked(state?: TempleDefense, breach?: TempleBreach): boolean {
  return state?.mount !== undefined || Boolean(breach && !['ready', 'done'].includes(breach.phase));
}
export function templeDefenseGestureLocked(gesture?: TempleDefenseGesture): boolean {
  return Boolean(gesture && ['mounting', 'orders', 'breach', 'waiting'].includes(gesture.phase));
}
export function templeWheelHands(index: number, turn: number): { x: number; y: number; z: number }[] {
  const wheel = TEMPLE_DEFENSE.wheel, angle = turn * wheel.angle;
  return [-1, 1].map(sign => ({ x: TEMPLE_DEFENSE.mounts[index].x + sign * wheel.radius * Math.cos(angle),
    y: wheel.y + sign * wheel.radius * Math.sin(angle), z: wheel.z + .08 }));
}
export function templeCastRoot(role: string): { x: number; z: number; yaw: number } {
  const positions: Record<string, { x: number; z: number; yaw: number }> = {
    lock: TEMPLE_DEFENSE.breach.actor, link: { x: -2.45, z: -18, yaw: Math.PI / 2 },
    zee: { x: -1.35, z: -18, yaw: -Math.PI / 2 }, hamann: { x: -12, z: 5, yaw: Math.PI },
    kid: { x: 12, z: -26, yaw: Math.PI }, zion_parent: { x: -18, z: 11, yaw: Math.PI },
    zion_neighbor: { x: 16, z: 15, yaw: Math.PI }, citizen_15: { x: -11.5, z: -43, yaw: Math.PI / 2 },
    citizen_16: { x: 11.5, z: -43, yaw: -Math.PI / 2 },
  };
  return positions[role];
}
export function templeDefenseText(state?: TempleDefense, breach?: TempleBreach): string {
  const blocked = breach?.paused ?? state?.paused, missing = breach?.unavailable ?? state?.unavailable;
  if (blocked) return `${blocked} 正由另一位玩家控制；入口准备与演出等待，不会接管他。`;
  if (missing) return `${missing} 无法到场；保留当前进度，等待这位同伴恢复。`;
  if (breach) return ({ ready: '走到入口指挥位置，按 G 让 Lock 确认最后的部署。', orders: 'Lock：把弹药放到炮位旁，固定好炮架。我们只剩这一次机会。',
    breach: '城顶被钻穿，岩屑落向城市。封井并没有阻止机器继续推进。', waiting: 'Link 与 Zee 留在人群边缘。Link：Neo，如果你能改变这一切，就请快一点。',
    done: '神庙里的等待仍在继续。按 G 接回机器城中的 Neo。' })[breach.phase];
  if (state?.phase === 'failed') return '炮位还未固定，入口准备时间已耗尽。按 J 重试；封井、EMP 和既有伤亡保留。';
  if (state?.mount !== undefined) return `按住 G 固定${state.mount ? '右' : '左'}侧炮架 · ${Math.round((state.turns?.[state.mount] ?? 0) * 100)}% · 松手停在当前位置`;
  if (state?.phase === 'sealed') return '两处重炮固定完成。走回 Link 与避难人群身边；入口仍敞开，军队等待下一次来袭。';
  return `赶在准备时间耗尽前固定两处炮架 · 剩余 ${Math.ceil(state?.remaining ?? TEMPLE_DEFENSE.seconds)} 秒。`;
}
