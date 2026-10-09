import type { FilmJourney } from './film-story.js';

export const SOURCE_PORTAL = {
  door: { x: 0, z: -39, width: 6.8, height: 7.7 },
  source: { x: 0, z: -54.5, width: 5.4, height: 7.7 },
  openingSeconds: 1.7, coverSeconds: 6, escapeSeconds: 3.2, sealSeconds: 1.4,
  listeningSeconds: 4, offeringSeconds: 1.7, takingSeconds: 1.4, enteringSeconds: 3,
  walls: [
    ...[-1, 1].map(side => ({ x: side * 5.1, z: 8.5, width: .4, depth: 95, height: 8 })),
    ...[-1, 1].map(side => ({ x: side * 14, z: -47.5, width: .4, depth: 17, height: 8 })),
    ...[-1, 1].map(side => ({ x: side * 8.8, z: -56, width: 10.4, depth: .4, height: 8 })),
    ...[-1, 1].map(side => ({ x: side * 3.7, z: -59, width: .3, depth: 6, height: 8 })),
    { x: 0, z: -62, width: 7.7, depth: .4, height: 8 },
  ],
} as const;
export interface SourcePortalPerformance {
  phase: 'idle' | 'opening' | 'cover' | 'escaping' | 'sealing' | 'wounded' | 'listening' | 'offering' | 'key_ready' | 'taking' | 'key_taken' | 'entering' | 'done' | 'failed';
  elapsed: number; attempts: number; wounded?: boolean; paused?: string; unavailable?: string; failure?: 'window' | 'cover';
}
export interface SourcePortalState { portalOpened: boolean; keyTaken: boolean; performance?: SourcePortalPerformance }
export type SourcePortalRole = 'neo' | 'morpheus' | 'keymaker';
export interface SourcePortalGesture extends SourcePortalPerformance { role: SourcePortalRole }
export function sourcePortalActive(journey?: FilmJourney): boolean {
  return Boolean(journey && !journey.visiting && !journey.finished && journey.scene === 'm2_key_door' && journey.step >= 3);
}
export function sourcePortalLocked(state?: SourcePortalPerformance): boolean {
  return Boolean(state && !['idle', 'wounded', 'key_taken', 'done'].includes(state.phase));
}
export function sourcePortalAngle(state?: SourcePortalState): number {
  const performance = state?.performance, p = performance?.phase;
  if (!performance) return state?.portalOpened ? Math.PI / 2 : 0;
  if (p === 'opening') return Math.PI / 2 * Math.min(1, performance.elapsed / SOURCE_PORTAL.openingSeconds);
  if (p === 'cover' || p === 'escaping') return Math.PI / 2;
  if (p === 'sealing') return Math.PI / 2 * (1 - Math.min(1, performance.elapsed / SOURCE_PORTAL.sealSeconds));
  return 0;
}
export function sourcePortalSourceAngle(state?: SourcePortalState): number {
  const p = state?.performance;
  if (!p) return 0;
  return p.phase === 'entering' ? Math.PI / 2 * Math.max(0, Math.min(1, (p.elapsed - .45) / 1.3)) : p.phase === 'done' ? Math.PI / 2 : 0;
}
export function sourcePortalRoot(state: SourcePortalPerformance, role: SourcePortalRole): { x: number; z: number; yaw: number } {
  const p = state.phase, t = Math.min(1, state.elapsed / SOURCE_PORTAL.escapeSeconds);
  const start = role === 'neo' ? { x: 1.65, z: -37.25 } : role === 'morpheus' ? { x: -1.65, z: -37 } : { x: .2, z: -37.35 };
  const end = role === 'neo' ? { x: 0, z: -43.15 } : role === 'morpheus' ? { x: -2.3, z: -45.9 } : { x: 1.15, z: -45.7 };
  if (['idle', 'opening', 'cover', 'failed'].includes(p)) return { ...start, yaw: role === 'neo' && p === 'cover' ? 0 : Math.PI };
  if (p === 'escaping') return { x: start.x + (end.x - start.x) * t, z: start.z + (end.z - start.z) * t, yaw: Math.PI };
  if (p === 'sealing' && role === 'neo') return { x: -1.2, z: -41.1, yaw: 0 };
  if (role === 'neo') {
    if (p === 'entering') { const t = Math.max(0, Math.min(1, (state.elapsed - 1.3) / (SOURCE_PORTAL.enteringSeconds - 1.3))); return { x: 1.2 * (1 - t), z: -52.9 - 2.5 * t, yaw: Math.PI }; }
    return { x: -.55, z: -44.1, yaw: Math.atan2(.9, .65) };
  }
  return { ...end, yaw: role === 'keymaker' ? Math.PI : 0 };
}
export function sourcePortalText(state?: SourcePortalPerformance): string {
  if (state?.paused) return `${state.paused} 正由另一位玩家控制；本段动作等待配合。`;
  if (state?.unavailable) return `${state.unavailable} 已失联；重试不会恢复队友。`;
  if (state?.phase === 'failed' && state.failure === 'window') return '电网保护已恢复，门没有解锁。J 重试本段，再 G 联系改线。';
  const text = {
    idle: 'G 配合钥匙匠开门。留意身后，开门后还需要掩护撤离。',
    opening: '钥匙转动，门向内打开。Smith 在走廊另一端举枪。',
    cover: 'F 护送两位同伴穿过门口，赶在枪击前撤离。',
    escaping: 'Neo 护送同伴进入门后的施工层；枪声从白色走廊追来。',
    sealing: 'Neo 抵住门板，将追兵关在另一侧。',
    wounded: '钥匙匠没能站起来。靠近他，G 听完最后的交代。',
    listening: '这条道路需要分别走完：Morpheus 走回程门，Neo 独自前往源头。',
    offering: '钥匙匠从颈前取下最后的钥匙，伸向 Neo。',
    key_ready: 'G 接住他手中的钥匙；等待不会替你接走。',
    taking: 'Neo 接住钥匙；钥匙匠的使命在这里结束。',
    key_taken: '前往施工层尽头的普通白门，G 用钥匙打开。',
    entering: '白光从门缝涌出。Neo 独自进入源代码房间。',
    done: '源头的门已经打开。G 继续建筑师的会面。',
    failed: '错过了撤离机会。J 手记重试开门本段；先前爆破、伤亡和选择保留。',
  };
  return text[state?.phase ?? 'idle'];
}
