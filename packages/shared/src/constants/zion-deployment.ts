import type { FilmJourney } from './film-story.js';
import type { Philosophy } from '../types/neo-life.js';

/** Early Revolutions council: destroy the diggers in the dock; the temple is a fallback. */
export const ZION_DEPLOYMENT = {
  entry: { x: 0, z: 10 }, report: { x: 0, z: -4 }, exit: { x: 0, z: 14 },
  inspection: { x: 3.2, z: 2 },
  map: { x: 7.6, z: 2, width: 1.2, depth: 4, top: 2.3 },
  screen: { x: 6.97, y: 3.45, z: 2, width: 3.4, height: 2.1 },
  seat: { width: 2.4, depth: 2, top: 1.36 },
  roots: { hamann: { x: 0, z: -12.4, yaw: 0 }, west: { x: -6, z: -10.8, yaw: .32 }, dillard: { x: 6, z: -10.8, yaw: -.32 } },
  cast: ['hamann', 'west', 'dillard'] as const,
  lineSeconds: 4.2,
  // Chinese paraphrases. The portable plan stand and verification are game additions.
  reportLines: [
    { role: 'lock', text: 'Lock 报告：照目前的掘进速度，机器不到十二小时就会打穿船坞。' },
    { role: 'lock', text: '必须先在船坞击毁钻机，阻止机器进入城市。不能把主要防线直接放在神庙。' },
    { role: 'lock', text: '如果船坞无法守住，再利用神庙入口的狭窄通道拖住机器。那是备用防线。' },
    { role: 'dillard', text: 'Dillard 询问是否需要志愿人员。Lock 说明防守与补给都需要人手。' },
    { role: 'west', text: 'West 要求说明船坞将投入多少兵力。玩家必须主动回应这项质询。' },
  ],
  forceLines: [
    { role: 'lock', text: 'Lock：全部 APU 部队和半数步兵，投入船坞阻止钻机。' },
    { role: 'west', text: 'West 对只调动半数步兵提出疑问；Lock 希望动员更多居民。' },
    { role: 'dillard', text: 'Dillard 提醒：指挥官无权自行把所有居民征召为士兵。志愿动员仍须尊重议会的决定。' },
  ],
  hopeLines: [
    { role: 'hamann', text: 'Hamann 询问是否收到尼布甲尼撒号的消息。' },
    { role: 'lock', text: 'Lock 尚未收到消息。他认为剩余的时间必须用于部署，不能依赖尚无保证的希望。' },
    { role: 'hamann', text: '守城的计划与对同伴的希望并存。议会并不知道 Hammer 上的分航决定。' },
  ],
  allocations: [
    { id: 'dock', label: '船坞主防线', correct: 'apu_half', answer: '全部 APU ＋ 半数步兵 → 阻止钻机', wrong: '全部兵力 → 神庙入口', reason: '钻机仍在掘进。必须先守船坞，阻止机器进入城市。' },
    { id: 'temple', label: '神庙入口', correct: 'fallback', answer: '保留狭窄入口作为备用防线', wrong: '现在就放弃船坞、全面撤入神庙', reason: '全面退守神庙发生在后面的船坞失守之后。此时它只是备用防线。' },
    { id: 'people', label: '居民动员', correct: 'volunteers', answer: '招募志愿人员，保留议会决定权', wrong: '指挥官直接征召所有居民', reason: 'Dillard 已提醒指挥官：全民征召不能由他独自决定。' },
  ],
  walls: [
    { x: -13, z: 0, width: .35, depth: 32, height: 11 }, { x: 13, z: 0, width: .35, depth: 32, height: 11 },
    { x: 0, z: -16, width: 26, depth: .35, height: 11 },
    { x: -7.7, z: 16, width: 10.6, depth: .35, height: 11 }, { x: 7.7, z: 16, width: 10.6, depth: .35, height: 11 },
  ],
} as const;
export type ZionDeploymentRole = 'lock' | keyof typeof ZION_DEPLOYMENT.roots;
export type ZionAllocation = typeof ZION_DEPLOYMENT.allocations[number]['id'];
export interface ZionDeployment {
  phase: 'approach' | 'ready' | 'reporting' | 'question' | 'answering' | 'review' | 'allocating' | 'hope' | 'hearing' | 'reflection' | 'responding' | 'leaving' | 'done';
  elapsed: number; checkpointHealth: number; confirmed: ZionAllocation[]; mistakes: number;
  reply?: Philosophy; paused?: string; unavailable?: string; legacy?: boolean; feedback?: string;
}
export type ZionDeploymentGesture = ZionDeployment & { role: ZionDeploymentRole };
export function zionDeploymentActive(journey?: FilmJourney): boolean { return journey?.scene === 'm3_zion_prepare' && !journey.visiting; }
export function zionDeploymentLocked(state?: ZionDeployment): boolean {
  return Boolean(state && (state.paused || state.unavailable || ['reporting', 'answering', 'allocating', 'hearing', 'reflection', 'responding'].includes(state.phase)));
}
export function newZionDeployment(step: number, health: number): ZionDeployment {
  return { phase: step >= 5 ? 'done' : step === 4 ? 'leaving' : step === 3 ? 'hope' : step === 2 ? 'review' : step === 1 ? 'ready' : 'approach',
    elapsed: 0, checkpointHealth: health, confirmed: step >= 3 ? ['dock', 'temple', 'people'] : [], mistakes: 0 };
}
export function zionDeploymentTarget(state?: ZionDeployment) {
  return state?.phase === 'leaving' || state?.phase === 'done' ? ZION_DEPLOYMENT.exit
    : state?.phase === 'review' || state?.phase === 'allocating' ? ZION_DEPLOYMENT.inspection : ZION_DEPLOYMENT.report;
}
export function zionDeploymentLines(state: ZionDeployment) {
  return state.phase === 'reporting' ? ZION_DEPLOYMENT.reportLines : state.phase === 'answering' ? ZION_DEPLOYMENT.forceLines
    : state.phase === 'hearing' ? ZION_DEPLOYMENT.hopeLines : undefined;
}
export function zionDeploymentSpeaker(state: ZionDeployment): ZionDeploymentRole | undefined {
  const lines = zionDeploymentLines(state); return lines?.[Math.min(lines.length - 1, Math.floor(state.elapsed / ZION_DEPLOYMENT.lineSeconds))].role;
}
export function zionDeploymentText(state?: ZionDeployment): string {
  if (state?.paused) return `${state.paused} 正由另一位玩家控制。议会停在保存的进度。`;
  if (state?.unavailable) return `${state.unavailable} 无法参加议会。部署、物品和人物伤势保留。`;
  const lines = state && zionDeploymentLines(state);
  if (lines) return lines[Math.min(lines.length - 1, Math.floor(state!.elapsed / ZION_DEPLOYMENT.lineSeconds))].text;
  if (state?.phase === 'question') return 'West 在等兵力答复。G 主动说明 APU 与步兵的安排，再听议会对居民动员的限制。';
  if (state?.phase === 'review') return 'WASD 走到右侧部署图，G 打开核对。神庙仍是备用防线，船坞尚未失守。';
  if (state?.phase === 'allocating') return `${state.feedback ? state.feedback + ' ' : ''}J 核对三项部署，已确认 ${state.confirmed.length} / 3。错误会留下记录，可重新核对。`;
  if (state?.phase === 'hope') return 'WASD 回到议会前，G 回应 Hamann 对尼布甲尼撒号的询问。';
  if (state?.phase === 'reflection') return 'J 记录 Lock 对计划、希望与居民自主权的判断。这是 Lock 的视角，尚无船员返航消息。';
  if (state?.phase === 'responding') return state.reply === 'care' ? 'Lock 记录志愿动员与保护居民的责任；兵力计划不替居民决定他们的一生。'
    : state.reply === 'trust' ? 'Lock 让部署继续执行，也为失去联系的同伴保留希望；没有把希望当成已经收到的消息。'
      : 'Lock 以眼前证据承担部署责任，承认议会有权限制指挥官的决定。';
  if (state?.phase === 'leaving') return 'WASD 离开议会，去执行已经核对的防守安排。';
  if (state?.phase === 'done') return '部署已保存。G 转到 Hammer 航行中的另一视角；船坞战斗将在后续任务发生。';
  if (state?.phase === 'ready') return 'G 向议会报告机器的掘进风险、船坞主防线与神庙备用防线。';
  return '另一视角：Lock 进入锡安议会。机器预计不到十二小时打穿船坞，WASD 走到议员面前报告。';
}
