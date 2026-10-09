import type { FilmJourney } from './film-story.js';
import type { Philosophy } from '../types/neo-life.js';

/** Revolutions: the crew meet standing in the Hammer's narrow, curved hull. */
export const HAMMER_BRIEFING = {
  entry: { x: 0, z: 9.4 }, approach: { x: 0, z: -2.4 }, exit: { x: 0, z: 10.2 },
  console: { x: -7.4, z: 3.2, width: 1.4, depth: 3.6, top: 2.4 },
  inspection: { x: -4.1, z: 3.2 },
  screen: { x: -6.68, y: 3.5, z: 3.2, width: 2.7, height: 1.65 },
  cast: ['niobe', 'morpheus', 'trinity', 'roland'] as const,
  roots: { niobe: { x: -4.4, z: -2, yaw: Math.PI / 2 }, morpheus: { x: 4.1, z: -2, yaw: -Math.PI / 2 },
    trinity: { x: 1.8, z: -6.6, yaw: -.36 }, roland: { x: -4.4, z: -5.6, yaw: .91 },
    link: { x: -4.5, z: -8.5, yaw: .61 }, ghost: { x: 4.7, z: -6.4, yaw: -.84 } },
  lineSeconds: 4.4,
  // Paraphrased exchanges; the route console and its checks are playable additions.
  proposal: [
    { role: 'neo', text: 'Neo：时间不多了。我想借一艘船，去机器城。' },
    { role: 'morpheus', text: 'Morpheus：这是先知告诉你的路吗？' },
    { role: 'neo', text: 'Neo：不是。这是我自己必须作出的决定。' },
    { role: 'roland', text: 'Roland：那条路没人能活着回来。我不能把 Hammer 交给你。' },
  ],
  loan: [
    { role: 'niobe', text: 'Niobe：让他用我的 Logos。' },
    { role: 'roland', text: 'Roland 反对把完好的船送去机器城；他认为这会浪费最后的机会。' },
    { role: 'niobe', text: 'Niobe：我的船由我决定。我驾驶 Hammer 返回锡安。' },
    { role: 'morpheus', text: 'Morpheus 接受两船分航。必须在一小时内离开，才可能赶上机器抵达锡安。' },
  ],
  planning: [
    { role: 'niobe', text: 'Niobe 将驾驶 Hammer 走机械管线返回锡安；Roland 与船员继续负责舰上防守。' },
    { role: 'trinity', text: 'Trinity 选择陪 Neo 驾驶 Logos 前往机器城。同行是她自己的决定。' },
    { role: 'neo', text: 'Neo 没有接受弹药。Logos 的目的不是与机器城交战，而是寻找停战的可能。' },
  ],
  belief: [
    { role: 'morpheus', text: 'Morpheus：你一直不相信救世主预言，为什么还愿意借船？' },
    { role: 'niobe', text: 'Niobe：我仍然不相信那个预言。但我相信作出这个决定的 Neo。' },
    { role: 'morpheus', text: '两艘船将走向不同的方向。预言无法替他们保证结果，信任仍需要承担风险。' },
  ],
  walls: [
    { x: -9.2, z: 0, width: .35, depth: 24, height: 7 }, { x: 9.2, z: 0, width: .35, depth: 24, height: 7 },
    { x: 0, z: -12, width: 18.4, depth: .35, height: 7 },
    { x: -5.65, z: 12, width: 7.1, depth: .35, height: 7 }, { x: 5.65, z: 12, width: 7.1, depth: .35, height: 7 },
    { x: -7.9, z: 0, width: 2.4, depth: 24, height: 2.1 }, { x: 7.9, z: 0, width: 2.4, depth: 24, height: 2.1 },
    { x: -2.3, z: 16, width: .24, depth: 8, height: 7 }, { x: 2.3, z: 16, width: .24, depth: 8, height: 7 },
    { x: 0, z: 20, width: 4.6, depth: .24, height: 7 },
  ],
} as const;
export type HammerBriefingRole = 'neo' | keyof typeof HAMMER_BRIEFING.roots;
export type HammerRoute = 'hammer' | 'logos';
export interface HammerBriefing {
  phase: 'approach' | 'ready' | 'proposal' | 'objection' | 'loan' | 'route' | 'planning' | 'confirmation' | 'faith' | 'belief' | 'reflection' | 'responding' | 'leaving' | 'done';
  elapsed: number; checkpointHealth: number; confirmed: HammerRoute[]; mistakes: number;
  reply?: Philosophy; paused?: string; unavailable?: string;
  escort?: { x: number; z: number };
}
export type HammerBriefingGesture = HammerBriefing & { role: HammerBriefingRole; step: number };
export function hammerBriefingActive(journey?: FilmJourney): boolean { return journey?.scene === 'm3_logos_plan' && !journey.visiting; }
export function hammerBriefingLocked(state?: HammerBriefing): boolean {
  return Boolean(state && (state.paused || state.unavailable || !['approach', 'ready', 'route', 'faith', 'leaving', 'done'].includes(state.phase)));
}
export function newHammerBriefing(step: number, health: number): HammerBriefing {
  return { phase: step >= 5 ? 'done' : step === 4 ? 'leaving' : step === 3 ? 'faith' : step === 2 ? 'route' : step === 1 ? 'ready' : 'approach',
    elapsed: 0, checkpointHealth: health, confirmed: step >= 3 ? ['hammer', 'logos'] : [], mistakes: 0 };
}
export function hammerBriefingTarget(state?: HammerBriefing) {
  return state?.phase === 'leaving' || state?.phase === 'done' ? HAMMER_BRIEFING.exit
    : state && ['route', 'planning', 'confirmation'].includes(state.phase) ? HAMMER_BRIEFING.inspection : HAMMER_BRIEFING.approach;
}
export function hammerBriefingLines(state: HammerBriefing) {
  return state.phase === 'proposal' ? HAMMER_BRIEFING.proposal : state.phase === 'loan' ? HAMMER_BRIEFING.loan
    : state.phase === 'planning' ? HAMMER_BRIEFING.planning : state.phase === 'belief' ? HAMMER_BRIEFING.belief : undefined;
}
export function hammerBriefingSpeaker(state: HammerBriefing): HammerBriefingRole | undefined {
  const lines = hammerBriefingLines(state);
  return lines?.[Math.min(lines.length - 1, Math.floor(state.elapsed / HAMMER_BRIEFING.lineSeconds))].role;
}
export function hammerBriefingText(state?: HammerBriefing): string {
  if (state?.unavailable) return `${state.unavailable} 无法参加会议。伤势和已作出的决定保留。`;
  if (state?.paused) return `${state.paused} 正由另一位玩家控制。分航会议停在保存的进度。`;
  const lines = state && hammerBriefingLines(state);
  if (lines) return lines[Math.min(lines.length - 1, Math.floor(state!.elapsed / HAMMER_BRIEFING.lineSeconds))].text;
  if (state?.phase === 'objection') return 'Roland 已拒绝交出 Hammer。G 坚持说明你要走的路，让其他人回应。等待不会替你作决定。';
  if (state?.phase === 'route') return 'WASD 走到侧壁航路终端，G 核对 Niobe 与 Trinity 的航线安排。';
  if (state?.phase === 'confirmation') return `J 确认两船的不同目的地。已确认 ${state.confirmed.length} / 2 条；Neo 没有带走弹药。`;
  if (state?.phase === 'faith') return 'WASD 回到会议中央，G 听 Morpheus 与 Niobe 对预言和信任的分歧。';
  if (state?.phase === 'reflection') return 'J 作出自己的信任判断。Niobe 借出船，不代表她接受了救世主预言。';
  if (state?.phase === 'responding') return state.reply === 'trust' ? 'Neo 接受这份没有保证的信任。结果仍要由自己的行动承担。'
    : state.reply === 'care' ? 'Neo 将救下仍在锡安的人作为赴机器城的理由。Trinity 自愿和他同行。'
      : 'Neo 把这条航线当作自己的选择。预言和先知都没有替他下这个决定。';
  if (state?.phase === 'leaving') return 'WASD 走向舱门，Trinity 随你离开。Hammer 的船员留下准备返航锡安。';
  if (state?.phase === 'done') return '两船安排与本次判断已保存。G 查看锡安的最后防守部署。';
  if (state?.phase === 'ready') return 'G 向船长们提出赴机器城的请求。V 切换视角，鼠标观察其他人的回应。';
  return 'WASD 走进围站的船员中。Logos 已找到；众人正讨论怎样穿过机械管线返回锡安。Maggie 仍在照看 Bane。';
}
