import type { FilmJourney } from './film-story.js';
import type { Philosophy } from '../types/neo-life.js';

// Game staging of Neo's final kitchen visit. The third-film appearance and
// questions are distinct from the earlier living-room rescue consultation.
export const ORACLE_LAST = {
  cast: ['neo', 'oracle', 'sati', 'seraph'] as const,
  entrance: { x: 0, z: -10 }, question: { x: -6, z: -15.4 }, exit: { x: 0, z: 18 },
  table: { x: -6, z: -19, width: 5, depth: 3, height: 2.1 },
  chairs: [{ x: -6, z: -22.9, yaw: 0 }, { x: -2.4, z: -19, yaw: -Math.PI / 2 }],
  bake: { x: -6, z: -21.5, yaw: 0 }, wash: { x: -1.5, z: -25.2, yaw: Math.PI },
  oracle: { x: -6, z: -22.9, yaw: 0, seat: 1.224 },
  sati: { x: -9.05, z: -19, yaw: Math.PI / 2 }, seraph: { x: 1.25, z: 7, yaw: Math.PI },
  bowl: { x: -8.25, y: 2.08, z: -19 },
  satiPath: [{ x: -9.9, z: -19 }, { x: -9.9, z: -10.4 }, { x: -2.4, z: -10.4 }, { x: -2.4, z: 5 }],
  welcomeSeconds: 28, lineSeconds: 4.6,
  identity: [
    '先知：脸换了，习惯还在。要一颗糖吗？',
    'Neo：谢谢，不用了。我有些问题必须弄清楚。',
    'Neo：你为什么没有告诉我建筑师、锡安的循环，还有那些先行者？',
    '先知：你会得到一个答案，却未必理解自己为什么作出选择。看看门上那句话。',
    'Neo：认识自己。现在，我准备继续问下去了。',
  ],
  source: [
    'Neo：我没有接入，为什么还能停止现实里的哨兵？',
    '先知：那次接触让你连到了源头。你的能力跨过了矩阵的边界，也让你陷入险境。',
    'Neo：建筑师要维持循环，你想要什么？',
    '先知：他寻找平衡；我愿意让选择改变它。我们都希望战争结束，但我不能保证锡安安全。',
    'Neo：Smith 呢？我到底是在与什么作战？',
    '先知：他是与你相反的一端，增长已经威胁两个世界。找到出路，需要你继续面对源头。',
  ],
  replies: {
    agency: '先知：把判断握在自己手里，也要承担判断带来的后果。去问你还没得到答案的问题。',
    care: '先知：既然你想保护的是两个世界，就别把任何一边的人当成可以省略的代价。',
    trust: '先知：没有保证的合作，也可以从一个共同目标开始。带着疑问继续走。',
  },
} as const;

export interface OracleLast {
  phase: 'waiting' | 'greeting' | 'ready' | 'answering' | 'reflection' | 'responding' | 'leaving' | 'done';
  arrival: number; elapsed: number; checkpointHealth: number;
  first?: string; second?: Philosophy; reply?: Philosophy;
  paused?: string; unavailable?: string;
}
export type OracleLastGesture = OracleLast & { role: typeof ORACLE_LAST.cast[number]; step: number };
export function oracleLastActive(journey?: FilmJourney): boolean { return journey?.scene === 'm3_oracle_last' && !journey.visiting; }
export function oracleLastLocked(state?: OracleLast): boolean { return Boolean(state && (state.paused || state.unavailable || state.phase === 'answering' || state.phase === 'responding')); }
export function newOracleLast(step: number, health: number, first?: string, second?: Philosophy): OracleLast {
  return { phase: step >= 5 ? 'done' : step === 4 ? 'leaving' : step === 3 ? 'reflection' : step ? 'ready' : 'waiting',
    arrival: step ? ORACLE_LAST.welcomeSeconds : 0, elapsed: 0, checkpointHealth: health, first, second };
}
export function oracleLastLines(state: OracleLast, step: number): readonly string[] {
  if (step === 2) return ORACLE_LAST.source;
  const memory = state.first === 'rescue' ? '先知：你曾担心 Morpheus 的命运，后来亲自救了他。那是你的行动。'
    : state.first === 'doubt' ? '先知：你以前怀疑预言会改变决定。如今，你可以根据经历重新判断。'
      : state.first ? '先知：你以前带着疑问观察。这里发生过的事，仍需要你亲自理解。'
        : '先知：你可以依据自己的经历判断，不必先接受某种预言。';
  const relationship = state.second === 'care' ? '先知：你在意过程序为了保护别人作出的选择。我的选择也有代价。'
    : state.second === 'trust' ? '先知：你曾接受有边界的合作。我仍不能替你决定是否相信。'
      : state.second ? '先知：你曾根据行动判断我，而不是只看程序的身份。继续这样问下去。'
        : '先知：判断是否相信我，需要看我做过什么。接着问下去。';
  return [...ORACLE_LAST.identity.slice(0, 2), memory, ...ORACLE_LAST.identity.slice(2), relationship];
}
export function oracleLastLine(state: OracleLast, step: number): string {
  const lines = oracleLastLines(state, step);
  return lines[Math.min(lines.length - 1, Math.floor(state.elapsed / ORACLE_LAST.lineSeconds))];
}
export function oracleLastText(state?: OracleLast, step = 0): string {
  if (state?.unavailable) return `${state.unavailable} 无法参与会面。进度保留，没有恢复这个角色的生命。`;
  if (state?.paused) return `${state.paused} 正由另一位玩家控制。厨房动作与回应停在保存的位置。`;
  if (state?.phase === 'answering') return oracleLastLine(state, step);
  if (state?.phase === 'responding') return ORACLE_LAST.replies[state.reply ?? 'agency'];
  if (state?.phase === 'greeting') return state.arrival < 5 ? 'Sati：Neo，你出来了！我先把这碗带给 Seraph。'
    : state.arrival < 13 ? '先知走到水槽洗去手上的面粉；Sati 正把碗带出厨房。'
      : state.arrival < 20 ? '先知回到桌边。等她落座，再亲自开口。' : '先知：坐下来谈之前，先看清你要问的是什么。';
  if (step >= 5) return '会面与反思已保存。Neo 已离开；G 继续另一视角，观察先知留下后的事。';
  if (step === 4) return 'WASD 离开厨房，亲自走回候诊室。你仍不知道先知留下后会发生什么。';
  if (step === 3) return 'J 记录自己的判断。你没有得到结果的保证，也没有失去作出选择的责任。';
  if (step === 2) return 'G 追问源头、现实中的能力，以及 Smith 对两个世界的威胁。';
  if (step === 1) return '走到桌子另一侧，G 询问先知的身份，以及她以前没有说出的真相。';
  return 'WASD 穿过候诊室，进入左侧厨房。Sati 和先知正在准备饼干。';
}

const smooth = (value: number, from: number, to: number) => { const t = Math.max(0, Math.min(1, (value - from) / (to - from))); return t * t * (3 - 2 * t); };
function blend(a: { x: number; z: number; yaw: number }, b: { x: number; z: number; yaw: number }, t: number) {
  return { x: a.x + (b.x - a.x) * t, z: a.z + (b.z - a.z) * t,
    yaw: a.yaw + Math.atan2(Math.sin(b.yaw - a.yaw), Math.cos(b.yaw - a.yaw)) * t };
}
export function oracleLastRoot(state: OracleLast, role: 'oracle' | 'sati' | 'seraph') {
  const t = state.arrival;
  if (role === 'seraph') return ORACLE_LAST.seraph;
  if (role === 'oracle') {
    const side = { x: -2.1, z: -21.5, yaw: Math.PI / 2 };
    if (t < 4) return ORACLE_LAST.bake;
    if (t < 6.4) return blend(ORACLE_LAST.bake, side, smooth(t, 4, 6.4));
    if (t < 8.8) return blend(side, ORACLE_LAST.wash, smooth(t, 6.4, 8.8));
    if (t < 12.8) return ORACLE_LAST.wash;
    if (t < 15.2) return blend(ORACLE_LAST.wash, side, smooth(t, 12.8, 15.2));
    if (t < 17.6) return blend(side, ORACLE_LAST.bake, smooth(t, 15.2, 17.6));
    return blend(ORACLE_LAST.bake, ORACLE_LAST.oracle, smooth(t, 17.6, 20));
  }
  if (t < 4) return ORACLE_LAST.sati;
  if (t < 5) return blend(ORACLE_LAST.sati, { ...ORACLE_LAST.satiPath[0], yaw: ORACLE_LAST.sati.yaw }, smooth(t, 4, 5));
  const path = ORACLE_LAST.satiPath, lengths = path.slice(1).map((point, i) => Math.hypot(point.x - path[i].x, point.z - path[i].z));
  let along = Math.min(1, (t - 5) / 23) * lengths.reduce((sum, length) => sum + length, 0);
  for (let i = 0; i < lengths.length; i++) {
    if (along <= lengths[i] || i === lengths.length - 1) {
      const heading = (segment: number) => Math.atan2(path[segment + 1].x - path[segment].x, path[segment + 1].z - path[segment].z);
      const turn = (a: number, b: number, weight: number) => a + Math.atan2(Math.sin(b - a), Math.cos(b - a)) * weight;
      let yaw = heading(i);
      if (along < (i ? .8 : 1.4)) yaw = turn(i ? heading(i - 1) : ORACLE_LAST.sati.yaw, yaw, i ? .5 + .5 * smooth(along, 0, .8) : smooth(along, 0, 1.4));
      if (i < lengths.length - 1 && along > lengths[i] - .8) yaw = turn(yaw, heading(i + 1), .5 * smooth(along, lengths[i] - .8, lengths[i]));
      return { x: path[i].x + (path[i + 1].x - path[i].x) * Math.min(1, along / lengths[i]),
        z: path[i].z + (path[i + 1].z - path[i].z) * Math.min(1, along / lengths[i]), yaw };
    }
    along -= lengths[i];
  }
  return ORACLE_LAST.sati;
}
export function oracleLastBowl(state: OracleLast) {
  const root = oracleLastRoot(state, 'sati'), weight = smooth(state.arrival, 3, 5);
  return { x: ORACLE_LAST.bowl.x + (root.x + Math.sin(root.yaw) * .78 - ORACLE_LAST.bowl.x) * weight,
    y: ORACLE_LAST.bowl.y + .17 * smooth(state.arrival, 3, 4) - .73 * smooth(state.arrival, 5, 7),
    z: ORACLE_LAST.bowl.z + (root.z + Math.cos(root.yaw) * .78 - ORACLE_LAST.bowl.z) * weight,
    yaw: root.yaw, held: state.arrival >= 3 };
}
export function oracleLastSeat(state: OracleLast): number { return smooth(state.arrival, 17.6, 20); }
