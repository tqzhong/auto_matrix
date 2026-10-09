import type { FilmJourney } from './film-story.js';
import type { Philosophy } from '../types/neo-life.js';

/** The interview takes place at the mess table, after Bane has regained consciousness. */
export const BANE_INQUIRY = {
  entry: { x: 6.1, z: -8 }, approach: { x: 2.8, z: -16.4 }, exit: { x: 6.1, z: -8 },
  table: { x: 0, z: -21.3, width: 3.2, depth: 10.3, top: 2.4, thickness: .14 },
  seat: { top: .88, width: 1.38, depth: 1.42 },
  cast: ['bane', 'maggie', 'morpheus'] as const,
  roots: { roland: { x: 2.8, z: -18.7, yaw: -Math.PI / 2 }, bane: { x: -2.8, z: -18.7, yaw: Math.PI / 2 },
    morpheus: { x: -2.8, z: -21.4, yaw: Math.PI / 2 }, maggie: { x: -2.8, z: -24.1, yaw: Math.PI / 2 } },
  sitSeconds: 2.4, lineSeconds: 4.2, riseSeconds: 2.8,
  wounds: [
    'Roland：你是舰队唯一的幸存者。先说说你记得什么。',
    'Bane：我想帮忙，但那些事我都记不起来。',
    'Roland：把手臂放在桌上。这些割伤已有一段时间，怎么来的？',
    'Bane 查看手臂上的割痕，慢慢翻过手掌。',
    'Bane：看起来像是我自己划的。可我为什么会这么做？',
    'Bane：如果那时的我不是我，那我又是谁？',
  ],
  emp: [
    'Roland：舰队还没到约定位置，EMP 就提前释放了。',
    'Roland：其他船员都没回来。你能说明当时发生了什么吗？',
    'Bane：我记不得。没有什么能补充的。',
    'Roland 把幸存者的说法与舰队记录并列；两者之间仍缺少解释。',
  ],
  medical: [
    'Roland：VDT 检查结果是什么？',
    'Maggie：阴性，但神经活动很不寻常。',
    'Maggie：有交叉突触放电和近期创伤，皮质里出现新的纤维化瘢痕。',
    'Maggie 把两页检查单递向桌边。异常不等于已经查明原因。',
  ],
} as const;
export type BaneInquiryRole = keyof typeof BANE_INQUIRY.roots;
export interface BaneInquiry {
  phase: 'approach' | 'ready' | 'seating' | 'hearing' | 'reviewing' | 'reflection' | 'responding' | 'rising' | 'leaving' | 'done';
  elapsed: number; seated: number; checkpointHealth: number; mistakes: number;
  reviewed: ('vdt' | 'neural')[]; page: 'vdt' | 'neural'; reply?: Philosophy;
  paused?: string; unavailable?: string;
}
export type BaneInquiryGesture = BaneInquiry & { role: BaneInquiryRole; step: number };
export function baneInquiryActive(journey?: FilmJourney): boolean { return journey?.scene === 'm3_bane_questions' && !journey.visiting; }
export function baneInquiryLocked(state?: BaneInquiry): boolean {
  return Boolean(state && (state.paused || state.unavailable || !['approach', 'leaving', 'done'].includes(state.phase)));
}
export function newBaneInquiry(step: number, health: number): BaneInquiry {
  return { phase: step >= 6 ? 'done' : step >= 5 ? 'leaving' : step === 4 ? 'reflection' : step ? 'ready' : 'approach',
    elapsed: 0, seated: step >= 5 ? 0 : step ? 1 : 0, checkpointHealth: health, mistakes: 0,
    reviewed: step >= 4 ? ['vdt', 'neural'] : [], page: 'vdt' };
}
export function baneInquiryLines(step: number): readonly string[] { return step === 1 ? BANE_INQUIRY.wounds : step === 2 ? BANE_INQUIRY.emp : BANE_INQUIRY.medical; }
export function baneInquiryText(state?: BaneInquiry, step = 0): string {
  if (state?.unavailable) return `${state.unavailable} 无法参与询问。现有伤势和进度保留。`;
  if (state?.paused) return `${state.paused} 正由另一位玩家控制。等他结束当前行动，问话才会继续。`;
  if (state?.phase === 'seating') return 'Roland 在长桌另一侧坐下。Bane 与 Maggie 已在桌边；V 切换视角。';
  if (state?.phase === 'hearing') {
    const lines = baneInquiryLines(step); return lines[Math.min(lines.length - 1, Math.floor(state.elapsed / BANE_INQUIRY.lineSeconds))];
  }
  if (state?.phase === 'reviewing') return state.page === 'vdt' ? '检查单 1 / 2：VDT · NEGATIVE（阴性）。J 核对结果，G 翻到神经扫描。'
    : '检查单 2 / 2：跨突触异常放电；近期创伤与新瘢痕。J 核对结果，G 返回 VDT。';
  if (state?.phase === 'responding') return state.reply === 'care' ? 'Roland：继续观察与照护。疑点不能成为任意伤害他的理由。'
    : state.reply === 'trust' ? 'Roland：记录他的说法，也记录无法解释的证据。让 Maggie 继续检查。'
      : 'Roland：核对记录，再问清楚。失忆的说法无法解释所有疑点。';
  if (state?.phase === 'rising') return 'Roland 起身结束询问。Maggie 留下继续观察 Bane。';
  if (step >= 6) return '问话与判断已保存。G 接回 Neo，参加两艘船的航路讨论。';
  if (step === 5) return 'WASD 离开餐桌，走回入口。Bane 的身份仍未查明。';
  if (step === 4) return 'J 记录如何处理这些疑点。你知道检查结果，仍不知道背后的原因。';
  if (step === 3) return 'G 请 Maggie 说明 VDT 与神经扫描，再亲自核对两页检查单。';
  if (step === 2) return 'G 追问提前释放的 EMP。Bane 必须回应舰队损失。';
  if (step === 1) return 'G 坐到 Bane 对面，询问记忆与手臂割伤。';
  return 'WASD 走到餐厅长桌另一侧。Bane 已醒来，Maggie 与 Morpheus 陪同询问。';
}
export function baneInquirySeat(state: BaneInquiry, role: BaneInquiryRole): number {
  return role !== 'roland' ? 1 : state.phase === 'seating' ? smooth(state.elapsed / BANE_INQUIRY.sitSeconds, .5, 1)
    : state.phase === 'rising' ? 1 - smooth(state.elapsed / BANE_INQUIRY.riseSeconds, 0, .5) : smooth(state.seated, 0, 1);
}
const smooth = (value: number, from: number, to: number) => { const t = Math.max(0, Math.min(1, (value - from) / (to - from))); return t * t * (3 - 2 * t); };
export function baneInquiryRoot(state: BaneInquiry, role: BaneInquiryRole) {
  const root = BANE_INQUIRY.roots[role];
  if (role !== 'roland') return { ...root };
  const seat = baneInquirySeat(state, role), forward = root.x - .88;
  // First stand over the planted feet, then clear the chair sideways before returning to the aisle.
  if (seat > 0) return { ...root, x: forward + .88 * seat };
  if (state.phase === 'seating') {
    const t = state.elapsed / BANE_INQUIRY.sitSeconds;
    return { ...root, x: BANE_INQUIRY.approach.x + (forward - BANE_INQUIRY.approach.x) * smooth(t, 0, .2),
      z: BANE_INQUIRY.approach.z + (root.z - BANE_INQUIRY.approach.z) * smooth(t, .2, .5) };
  }
  if (state.phase === 'rising') {
    const t = state.elapsed / BANE_INQUIRY.riseSeconds;
    return { ...root, x: forward + (BANE_INQUIRY.approach.x - forward) * smooth(t, .8, 1),
      z: root.z + (BANE_INQUIRY.approach.z - root.z) * smooth(t, .5, .8) };
  }
  return { ...root, ...BANE_INQUIRY.approach };
}
