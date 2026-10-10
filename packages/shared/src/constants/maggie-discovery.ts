import type { FilmJourney } from './film-story.js';
import type { Philosophy } from '../types/neo-life.js';

/** Film dialogue is paraphrased; the player's bedside inspections are game additions. */
export const MAGGIE_DISCOVERY = {
  entry: { x: 0, z: 11 }, approach: { x: 0, z: -14 },
  corpse: { x: -10, z: -23, yaw: 0 }, berth: { x: 10, z: -23, yaw: Math.PI },
  inspection: { x: -7, z: -22.7 }, emptyBed: { x: 7, z: -22.7 },
  report: { x: 0, z: -18 }, exit: { x: 0, z: 15 },
  roots: { ak: { x: 6, z: 16, yaw: Math.PI }, morpheus: { x: -3.8, z: -16, yaw: 2.2 }, link: { x: 3.8, z: -16, yaw: -2.2 }, colt: { x: 3.3, z: -12, yaw: Math.PI } },
  monitor: { z: -4.4, width: 2.15, depth: .7, height: 4.45 },
  door: { x: 0, z: 9, width: 7.4, depth: .3, height: 7.7, seconds: 1.2 },
  cast: ['ak', 'colt', 'morpheus', 'link'] as const,
  lineSeconds: 4.2, coverSeconds: 3.6, arrivalSeconds: 2.8,
  call: [
    { role: 'roland', text: 'Roland 接起舰内呼叫：AK，发生了什么？' },
    { role: 'ak', text: 'AK 报告医疗舱的紧急情况：Maggie 遇害，他怀疑是 Bane。Roland 结束呼叫，赶去查看。' },
  ],
  bedside: [
    { role: 'roland', text: 'Roland 查看 Maggie，确认她已经死亡。先前的异常扫描和 EMP 疑点，没有换来及时的保护。' },
    { role: 'roland', text: 'Roland 记下 Maggie 的身份，缓缓覆上床单。她曾试图找出异常；现在他必须面对没能及时保护她的后果。' },
  ],
  berthLines: [
    { role: 'roland', text: 'Bane 的床位空着，监测线已解开。这里没有他，仍不足以证明他不在船上。' },
    { role: 'roland', text: 'Roland 请船员汇报全船搜查。确认空床与搜遍整艘船，是两项不同的证据。' },
  ],
  search: [
    { role: 'colt', text: 'Colt 赶来报告：船员已经搜遍整艘 Hammer，没有找到 Bane。' },
    { role: 'roland', text: 'Roland 想到了另一艘刚离开的船。两队已经分航，不能把他的失踪当作无事发生。' },
    { role: 'morpheus', text: 'Morpheus 判断：他可能在 Logos 上。此时船员还不知道 Bane 的真实身份。' },
  ],
  returnLines: [
    { role: 'link', text: 'Link 要求返航：如果 Neo 和 Trinity 需要帮助，不能就这样丢下他们。' },
    { role: 'roland', text: 'Roland 拒绝转向。Link 追问，为什么连尝试援救都这么危险？' },
    { role: 'morpheus', text: 'Morpheus 解释：如果 Bane 杀死了他们，就会掌握另一艘船的 EMP。贸然靠近可能连 Hammer 也失去。' },
    { role: 'roland', text: 'Roland 决定继续返回锡安。两艘船只能各自应对眼前的威胁；这不是已经知道 Neo 会安全获胜。' },
  ],
  walls: [
    { x: -13.5, z: -12, width: .4, depth: 42, height: 8 }, { x: 13.5, z: -12, width: .4, depth: 42, height: 8 },
    { x: 0, z: -33, width: 27, depth: .4, height: 8 },
    { x: -8.6, z: 9, width: 9.8, depth: .4, height: 8 }, { x: 8.6, z: 9, width: 9.8, depth: .4, height: 8 },
  ],
} as const;
export type MaggieDiscoveryRole = 'roland' | 'maggie' | typeof MAGGIE_DISCOVERY.cast[number];
export interface MaggieDiscovery {
  version: 1;
  phase: 'call' | 'calling' | 'approach' | 'ready' | 'covering' | 'empty' | 'checking' | 'report' | 'searching' | 'return' | 'hearing' | 'reflection' | 'responding' | 'leaving' | 'done';
  elapsed: number; cover: number; arrival: number; checkpointHealth: number; incident: boolean;
  departed?: boolean;
  evidence: ('maggie' | 'berth' | 'ship')[];
  reply?: Philosophy; paused?: string; unavailable?: string; legacy?: boolean;
}
export type MaggieDiscoveryGesture = MaggieDiscovery & { role: MaggieDiscoveryRole };
export function maggieDiscoveryActive(journey?: FilmJourney): boolean { return journey?.scene === 'm3_maggie_discovery' && !journey.visiting; }
export function maggieDiscoveryLocked(state?: MaggieDiscovery): boolean {
  return Boolean(state && (state.paused || state.unavailable || ['calling', 'covering', 'checking', 'searching', 'hearing', 'reflection', 'responding'].includes(state.phase)));
}
export function maggieDiscoveryDoor(state?: MaggieDiscovery): number {
  const t = !state || state.phase === 'call' ? 0 : state.phase === 'calling' ? Math.min(1, state.elapsed / MAGGIE_DISCOVERY.door.seconds) : 1;
  return t * t * (3 - 2 * t);
}
export function newMaggieDiscovery(step: number, health: number): MaggieDiscovery {
  return { version: 1, phase: step >= 7 ? 'done' : step === 6 ? 'leaving' : step === 5 ? 'reflection' : step === 4 ? 'report' : step === 3 ? 'empty' : step === 2 ? 'ready' : step === 1 ? 'approach' : 'call',
    elapsed: 0, cover: step >= 3 ? MAGGIE_DISCOVERY.coverSeconds : 0, arrival: step >= 5 ? MAGGIE_DISCOVERY.arrivalSeconds : 0,
    checkpointHealth: health, incident: step > 0, departed: false, evidence: step >= 5 ? ['maggie', 'berth', 'ship'] : step >= 4 ? ['maggie', 'berth'] : step >= 3 ? ['maggie'] : [] };
}
export function maggieDiscoveryTarget(state?: MaggieDiscovery) {
  if (state?.phase === 'covering') {
    const t = Math.min(1, state.cover / MAGGIE_DISCOVERY.coverSeconds), f = t * t * (3 - 2 * t);
    return { x: MAGGIE_DISCOVERY.inspection.x, z: MAGGIE_DISCOVERY.inspection.z - 2.5 * f };
  }
  return !state || ['call', 'calling'].includes(state.phase) ? MAGGIE_DISCOVERY.entry
    : state.phase === 'approach' ? MAGGIE_DISCOVERY.approach
      : ['ready', 'covering'].includes(state.phase) ? MAGGIE_DISCOVERY.inspection
        : ['empty', 'checking'].includes(state.phase) ? MAGGIE_DISCOVERY.emptyBed
          : ['leaving', 'done'].includes(state.phase) ? MAGGIE_DISCOVERY.exit : MAGGIE_DISCOVERY.report;
}
export function maggieDiscoveryLines(state: MaggieDiscovery) {
  return state.phase === 'calling' ? MAGGIE_DISCOVERY.call : state.phase === 'covering' ? MAGGIE_DISCOVERY.bedside
    : state.phase === 'checking' ? MAGGIE_DISCOVERY.berthLines : state.phase === 'searching' ? MAGGIE_DISCOVERY.search
      : state.phase === 'hearing' ? MAGGIE_DISCOVERY.returnLines : undefined;
}
export function maggieDiscoverySpeaker(state: MaggieDiscovery): MaggieDiscoveryRole | undefined {
  const lines = maggieDiscoveryLines(state); return lines?.[Math.min(lines.length - 1, Math.floor(state.elapsed / MAGGIE_DISCOVERY.lineSeconds))].role;
}
export function maggieDiscoveryRoot(state: MaggieDiscovery, role: keyof typeof MAGGIE_DISCOVERY.roots) {
  const root = MAGGIE_DISCOVERY.roots[role];
  if (role !== 'colt') return root;
  const t = Math.min(1, state.arrival / MAGGIE_DISCOVERY.arrivalSeconds);
  return { ...root, z: 5 + (root.z - 5) * t };
}
export function maggieDiscoveryText(state?: MaggieDiscovery): string {
  if (state?.paused) return `${state.paused} 正由另一位玩家控制。医疗舱调查停在保存的进度。`;
  if (state?.unavailable) return `${state.unavailable} 无法参加这段调查。伤势、物品与已发生的事件保留。`;
  const lines = state && maggieDiscoveryLines(state);
  if (lines) return lines[Math.min(lines.length - 1, Math.floor(state!.elapsed / MAGGIE_DISCOVERY.lineSeconds))].text;
  if (state?.phase === 'approach') return 'WASD 进入医疗舱。先走到两张病床前，再分别查看 Maggie 和 Bane 的空床。';
  if (state?.phase === 'ready') return '走到 Maggie 床边，G 确认身份并覆上床单。她的命运已经发生，查看不会让她再次死亡。';
  if (state?.phase === 'empty') return 'WASD 绕到另一张床旁，G 核对 Bane 的空床与已断开的监测线。';
  if (state?.phase === 'report') return 'WASD 回到中间，G 听取 Colt 的全船搜查结果。空床不能替代全船搜查。';
  if (state?.phase === 'return') return 'Link 要求回头救人。G 听完返航争论，判断另一艘船的 EMP 为什么会威胁 Hammer。';
  if (state?.phase === 'reflection') return 'J 记录 Roland 对援救、风险与指挥责任的判断。这是游戏中的反思，不改变原片此时继续返航锡安的决定。';
  if (state?.phase === 'responding') return state.reply === 'care' ? 'Roland 保留 Maggie 的记录，也承认 Link 对同伴的牵挂。保护 Hammer 上的人，并不抹去未能及时保护她的责任。'
    : state.reply === 'trust' ? 'Roland 让 Hammer 继续前进，把面对 Logos 威胁的决定交还 Neo 与 Trinity；信任不等于保证他们会获胜。'
      : 'Roland 承担没有及时处理疑点的责任。现有证据支持评估 EMP 风险，却不能证明船上每个人的未来。';
  if (state?.phase === 'leaving') return 'WASD 离开医疗舱。遗体、搜查记录和你的判断已经保存。';
  if (state?.phase === 'done') return '调查已保存。G 转到 Logos 上 Neo 的视角；Hammer 的船员尚不知道 Bane 的真实身份。';
  return 'Hammer 已在返航。舰内呼叫响起，G 接听 AK 的紧急报告。此时尚未查看医疗舱。';
}
