import type { FilmJourney } from './film-story.js';
import { ORACLE_LAST } from './oracle-last.js';

// A playable Oracle viewpoint. The capture of Seraph/Sati is off screen in
// the released film; this does not invent a successful escape or a new fight.
export const ORACLE_ABSORPTION = {
  cast: ['oracle', 'sati', 'seraph', 'smith'] as const,
  start: { x: -3.5, z: -24, yaw: 0 }, child: { x: -3.5, z: -22.3, yaw: Math.PI },
  guard: { x: 1, z: -12, yaw: Math.PI }, seat: ORACLE_LAST.oracle,
  smith: { x: -4.9, z: -22.25, yaw: -Math.PI / 2 },
  farewellSeconds: 16, escapeSeconds: 32, approachSeconds: 14, lineSeconds: 5,
  consentSeconds: 1.8, contactSeconds: 2.2, coatingSeconds: 5, laughSeconds: 3,
  farewell: [
    '先知：饼干烤好了。Sati，带几块跟 Seraph 走吧。',
    'Sati：我还能回来吗？我想再来这里。',
    '先知：我也希望你回来。现在先跟他走。',
    'Sati：那就明天见。先知：但愿如此，孩子。',
  ],
  confrontation: [
    'Smith：终于见面了。你知道我会来，却仍然坐在这里。',
    'Smith：如果你能预见这一切，留下饼干和留下自己，都是有意的？',
    '先知：Sati 怎么了？',
    'Smith 的复制体模仿 Sati：做饼干也需要爱。',
    '先知：你连她也不肯放过。Smith：你应该知道我的来处。',
    '先知：做你来这里要做的事吧。',
  ],
} as const;
export interface OracleAbsorption {
  phase: 'ready' | 'farewell' | 'watching' | 'escaping' | 'reflection' | 'waiting' | 'confrontation' | 'consent' | 'contact' | 'coating' | 'laughing' | 'done';
  elapsed: number; farewell: number; escape: number; invasion: number; held: number; coating: number;
  checkpointHealth: number; paused?: string; unavailable?: string;
}
export type OracleAbsorptionGesture = OracleAbsorption & { role: typeof ORACLE_ABSORPTION.cast[number] };
export function oracleAbsorptionActive(journey?: FilmJourney): boolean { return journey?.scene === 'm3_oracle_absorbed' && !journey.visiting; }
export function oracleAbsorptionLocked(state?: OracleAbsorption): boolean {
  return Boolean(state && (state.paused || state.unavailable || !['ready', 'watching', 'done'].includes(state.phase)));
}
export function newOracleAbsorption(step: number, health: number): OracleAbsorption {
  return { phase: step >= 4 ? 'done' : step === 3 ? 'waiting' : step === 2 ? 'reflection' : step === 1 ? 'watching' : 'ready',
    elapsed: 0, farewell: step ? ORACLE_ABSORPTION.farewellSeconds : 0,
    escape: step >= 2 ? ORACLE_ABSORPTION.escapeSeconds : 0, invasion: step >= 4 ? 44 : 0,
    held: step >= 4 ? ORACLE_ABSORPTION.consentSeconds : 0, coating: step >= 4 ? 1 : 0, checkpointHealth: health };
}
export const absorptionSmooth = (value: number, from: number, to: number) => { const t = Math.max(0, Math.min(1, (value - from) / (to - from))); return t * t * (3 - 2 * t); };
function pathRoot(path: readonly { x: number; z: number }[], progress: number, initialYaw: number) {
  const lengths = path.slice(1).map((point, i) => Math.hypot(point.x - path[i].x, point.z - path[i].z));
  let along = Math.max(0, Math.min(1, progress)) * lengths.reduce((sum, length) => sum + length, 0);
  for (let i = 0; i < lengths.length; i++) {
    if (along <= lengths[i] || i === lengths.length - 1) {
      const heading = (j: number) => Math.atan2(path[j + 1].x - path[j].x, path[j + 1].z - path[j].z);
      const turn = (a: number, b: number, weight: number) => a + Math.atan2(Math.sin(b - a), Math.cos(b - a)) * weight;
      let yaw = heading(i);
      if (along < 1.2) yaw = turn(i ? heading(i - 1) : initialYaw, yaw, i ? .5 + .5 * absorptionSmooth(along, 0, 1.2) : absorptionSmooth(along, 0, 1.2));
      if (i < lengths.length - 1 && along > lengths[i] - 1.2) yaw = turn(yaw, heading(i + 1), .5 * absorptionSmooth(along, lengths[i] - 1.2, lengths[i]));
      return { x: path[i].x + (path[i + 1].x - path[i].x) * along / lengths[i], z: path[i].z + (path[i + 1].z - path[i].z) * along / lengths[i], yaw };
    }
    along -= lengths[i];
  }
  return { ...path[0], yaw: initialYaw };
}
export function oracleAbsorptionRoot(state: OracleAbsorption, role: OracleAbsorptionGesture['role']) {
  if (role === 'oracle') {
    const seat = absorptionSmooth(state.escape, 27, 31);
    const approach = pathRoot([ORACLE_ABSORPTION.start, { x: -4.5, z: -24 }, { x: -4.5, z: -22.9 }], absorptionSmooth(state.escape, 24, 27), 0);
    return { x: approach.x + (ORACLE_ABSORPTION.seat.x - approach.x) * seat,
      z: approach.z + (ORACLE_ABSORPTION.seat.z - approach.z) * seat, yaw: 0 };
  }
  if (role === 'smith') {
    if (!state.invasion) return { x: 0, z: 44, yaw: Math.PI };
    const root = pathRoot([{ x: 0, z: 44 }, { x: 0, z: -10 }, { x: 1, z: -22.9 }, ORACLE_ABSORPTION.smith], state.invasion / ORACLE_ABSORPTION.approachSeconds, Math.PI);
    if (state.invasion >= ORACLE_ABSORPTION.approachSeconds) root.yaw = ORACLE_ABSORPTION.smith.yaw;
    if (state.invasion >= 18.2 && state.invasion < 25.4) {
      const plate = absorptionSmooth(state.invasion, 18.2, 20.7) * (1 - absorptionSmooth(state.invasion, 22.4, 25.4));
      root.x += (-4.3 - root.x) * plate; root.z += (-21.65 - root.z) * plate;
      root.yaw *= 1 - plate;
    }
    return root;
  }
  if (state.escape === 0) return role === 'sati' ? ORACLE_ABSORPTION.child : ORACLE_ABSORPTION.guard;
  const start = role === 'sati' ? ORACLE_ABSORPTION.child : ORACLE_ABSORPTION.guard;
  const clearChair = role === 'sati' ? [{ x: 0, z: -22.3 }] : [];
  return pathRoot([start, ...clearChair, { x: 0, z: -10 }, { x: role === 'sati' ? -.6 : .8, z: 18 }, { x: role === 'sati' ? -.6 : .8, z: 47 }], state.escape / 23, start.yaw);
}
export function oracleAbsorptionCookie(state: OracleAbsorption) {
  const child = oracleAbsorptionRoot(state, 'sati'), take = absorptionSmooth(state.farewell, 3, 5);
  return { x: -3.5 + (child.x + Math.sin(child.yaw) * .43 + 3.5) * take,
    y: 2.08 - .50 * take, z: -23.15 + (child.z + Math.cos(child.yaw) * .43 + 23.15) * take };
}
export function oracleAbsorptionPlate(state: OracleAbsorption) {
  const time = Math.max(0, state.invasion - 21.2), flying = time > 0;
  return { x: -4.8 - Math.min(2.1, time) * 2.9, y: flying ? Math.max(.07, 2.12 + time * .7 - 4.9 * time * time) : 2.12,
    z: -20.15 + Math.min(2.1, time) * .75, spin: Math.min(2.1, time) * 5.4, broken: time >= .73 };
}
export function oracleAbsorptionText(state?: OracleAbsorption): string {
  if (state?.paused) return `${state.paused} 正由另一位玩家控制。保留撤离、桌面与同化进度。`;
  if (state?.unavailable) return `${state.unavailable} 无法参与；没有复活或恢复这个角色的生命。`;
  if (!state || state.phase === 'ready') return '先知的另一视角。走近 Sati，G 请她带几块饼干跟 Seraph 离开。Neo 已不在这里。';
  if (state.phase === 'farewell') return ORACLE_ABSORPTION.farewell[Math.min(3, Math.floor(state.farewell / 4))];
  if (state.phase === 'watching') return 'G 让 Seraph 带 Sati 出门，先知留在厨房等候。';
  if (state.phase === 'escaping') return state.escape < 16 ? 'Seraph 带 Sati 穿过公寓；先知留在厨房。'
    : state.escape < 24 ? '电梯失去响应。走廊灯逐盏熄灭，Sati 害怕地靠近 Seraph。' : '楼外传来 Smith 的脚步。两人的信号沉默；先知还不知道两人的去向。';
  if (state.phase === 'reflection') return 'J 记录先知自己的判断。她没有结果的保证；这段经历并非 Neo 此时知道的事。';
  if (state.phase === 'waiting') return 'G 留在厨房，面对正在逼近的 Smith。';
  if (state.phase === 'confrontation') return state.invasion < 14 ? 'Smith 穿过候诊室，沿桌边走向留下来的先知。'
    : ORACLE_ABSORPTION.confrontation[Math.min(5, Math.floor((state.invasion - 14) / 5))];
  if (state.phase === 'consent') return `按住 G 决定留下（${Math.round(state.held / ORACLE_ABSORPTION.consentSeconds * 100)}%）。松手保留进度；先知不知道自己的选择是否能换来和平。`;
  if (state.phase === 'contact') return 'Smith 伸手触及先知。她没有把留下说成必然获胜。';
  if (state.phase === 'coating') return '黑色覆层从接触处扩散；先知的外形逐渐被 Smith 替换。';
  if (state.phase === 'laughing') return '夺得预见的复制体仰头大笑。它获得了能力，却尚未理解先知的选择。';
  return '先知、Sati 与 Seraph 的信号已被同化。这是另一视角记录，Neo 仍不知道厨房里发生的事。G 返回 Hammer。';
}
