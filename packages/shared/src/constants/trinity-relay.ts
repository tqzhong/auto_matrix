import type { FilmJourney } from './film-story.js';

export const TRINITY_RELAY = {
  entry: { x: 0, z: 20 }, monitor: { x: 6.4, z: 12 },
  chair: { x: -6.5, z: 6, yaw: Math.PI / 2 }, approach: { x: -3.2, z: 6 },
  link: { x: 6.5, z: 6, yaw: Math.PI / 2 },
  connector: { x: -8.4, z: 6.45, yaw: Math.PI / 2 },
  route: [{ x: 7.75, z: 6 }, { x: 7.75, z: 11 }, { x: -9.2, z: 11 }, { x: -8.4, z: 6.45 }],
  hearingSeconds: 7, connectSeconds: 16.5,
} as const;
export interface TrinityRelay {
  phase: 'review' | 'hearing' | 'decision' | 'walking' | 'connecting' | 'connected';
  elapsed: number; paused?: string; unavailable?: string;
}
export type TrinityRelayGesture = TrinityRelay & { role: 'trinity' | 'link' };
const smooth = (value: number) => { const t = Math.max(0, Math.min(1, value)); return t * t * (3 - 2 * t); };
export function trinityRelayActive(journey?: FilmJourney): boolean { return journey?.scene === 'm2_relay' && !journey.visiting; }
export function trinityRelayLocked(state?: TrinityRelay): boolean { return Boolean(state && (state.paused || state.unavailable || state.phase === 'hearing' || state.phase === 'connecting')); }
export function trinityRelayTarget(state?: TrinityRelay) { return state && ['walking', 'connecting', 'connected'].includes(state.phase) ? TRINITY_RELAY.approach : TRINITY_RELAY.monitor; }
export function trinityRelaySeat(state: TrinityRelayGesture): number {
  return state.role === 'link' ? state.phase === 'connecting' || state.phase === 'connected' ? 1 - smooth(state.elapsed / 1.6) : 1
    : state.phase === 'connecting' || state.phase === 'connected' ? smooth((state.elapsed - .9) / 1.2) : 0;
}
export function trinityRelayRoot(state: TrinityRelayGesture) {
  if (state.role === 'trinity') {
    const amount = smooth(state.elapsed / .9);
    return { x: TRINITY_RELAY.approach.x + (TRINITY_RELAY.chair.x - TRINITY_RELAY.approach.x) * amount,
      z: TRINITY_RELAY.chair.z, yaw: TRINITY_RELAY.chair.yaw };
  }
  if (state.phase !== 'connecting' && state.phase !== 'connected') return { ...TRINITY_RELAY.link };
  if (state.elapsed < 1.6) return { ...TRINITY_RELAY.link, x: TRINITY_RELAY.link.x + 1.25 * smooth(state.elapsed / 1.6) };
  let remaining = Math.max(0, state.elapsed - 1.6) * 2.3;
  const points = TRINITY_RELAY.route;
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1], b = points[i], length = Math.hypot(b.x - a.x, b.z - a.z);
    if (remaining > length && i < points.length - 1) { remaining -= length; continue; }
    const amount = Math.min(1, remaining / length);
    return { x: a.x + (b.x - a.x) * amount, z: a.z + (b.z - a.z) * amount,
      yaw: amount === 1 && i === points.length - 1 ? TRINITY_RELAY.connector.yaw : Math.atan2(b.x - a.x, b.z - a.z) };
  }
  return { ...TRINITY_RELAY.connector };
}
export function trinityRelayText(state?: TrinityRelay): string {
  if (state?.paused) return `${state.paused} 正由另一位玩家控制，接入进度已暂停。`;
  if (state?.unavailable) return `${state.unavailable} 无法协助接入；不能用重试抹去队友伤亡。`;
  if (state?.phase === 'hearing') return state.elapsed < 3.5 ? 'Link 确认主网已断，但应急线路正在恢复供电。Soren 的队伍没有回应。'
    : 'Trinity 记得 Neo 要她留在矩阵外。Link 认为时间不足；继续等待也会让白门前的队伍陷入危险。';
  if (state?.phase === 'decision') return '按 G 明确接替失联的队伍，再亲自走向连接椅。她承担这个选择的风险，主网成功并没有替她作出决定。';
  if (state?.phase === 'walking') return '沿中央通道走到 Trinity 连接椅前，按 G 坐下，让 Link 接入。应急系统仍在线，314 秒窗口尚未开始。';
  if (state?.phase === 'connecting') return 'Trinity 坐下等待，Link 从操作台绕过椅子来到身后接线。暂停或释放角色会保留当前接入时刻。';
  if (state?.phase === 'connected') return '神经连接完成。G 进入矩阵改线中心；应急线路仍需亲自关闭。';
  return '先走到 Link 的操作台前按 G 核对供电与队伍信号，再决定是否接替 Vigilant。';
}
