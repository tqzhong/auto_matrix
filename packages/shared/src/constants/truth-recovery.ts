import type { FilmJourney } from './film-story.js';
import { CABIN, cabinBodyPose } from './cabin.js';
import { CONSTRUCT } from './construct.js';

export interface TruthRecovery { phase: 'ready' | 'exit' | 'unplug' | 'rest' | 'question'; elapsed: number }
export type TruthRole = 'neo' | 'morpheus' | 'trinity' | 'dozer';
export interface TruthGesture extends TruthRecovery { role: TruthRole; target?: { x: number; y: number; z: number } }
export const TRUTH_SECONDS = { exit: 6, unplug: 14, rest: 18 } as const;
export const TRUTH_BEDSIDE = { x: 15.6, z: -30.5, yaw: -2.3 } as const;
const smooth = (value: number) => { const t = Math.max(0, Math.min(1, value)); return t * t * (3 - 2 * t); };
export const truthScene = (scene: string) => scene === 'm1_truth_exit' || scene === 'm1_truth_return';
export const truthLocked = (journey: FilmJourney) => !journey.visiting && truthScene(journey.scene) && !!journey.truthRecovery;
export const truthUnplug = (elapsed: number) => smooth((elapsed - 1.5) / 1.7);
export const truthSeat = (elapsed: number) => 1 - smooth((elapsed - 4) / 1.5);
export const truthKneel = (elapsed: number) => smooth((elapsed - 8) / 2.8);
export const truthRest = (state: TruthRecovery) => state.phase === 'rest' || state.phase === 'question';
export const truthFade = (state: TruthRecovery) => state.phase === 'exit' ? smooth((state.elapsed - 5.3) / .7)
  : state.phase === 'unplug' ? Math.max(1 - smooth(state.elapsed / .7), smooth((state.elapsed - 12.5) / 1.5))
    : state.phase === 'rest' ? 1 - smooth(state.elapsed / 1.3) : 0;

export function truthRoot(state: TruthRecovery, role: TruthRole) {
  const t = state.elapsed;
  if (state.phase === 'ready' || state.phase === 'exit') {
    const retreat = state.phase === 'exit' ? smooth(t / 3.4) : 0;
    return role === 'neo' ? { ...CONSTRUCT.neo, x: CONSTRUCT.neo.x + retreat * 1.15, y: 0, seated: 0 }
      : { x: CONSTRUCT.chairX.morpheus, y: 0, z: CONSTRUCT.chair.z, yaw: Math.PI, seated: 1 };
  }
  if (truthRest(state)) {
    if (role === 'neo') { const body = cabinBodyPose(0); return { ...body, seated: 0 }; }
    return role === 'morpheus' ? { ...TRUTH_BEDSIDE, y: 0, seated: 1 }
      : { x: role === 'trinity' ? 2.5 : -3, y: 0, z: -24, yaw: 0, seated: 0 };
  }
  if (role === 'neo') {
    const leaving = smooth((t - 5.5) / 2.5), rise = 1 - truthSeat(t);
    return { x: CABIN.chair.x - rise * 1.85 - leaving * 2.35, y: .22 * rise * (1 - smooth((t - 5.5) / .5)), z: CABIN.chair.z + leaving * .5,
      yaw: CABIN.chair.yaw + smooth((t - 7.5) / 1.2) * .45, seated: truthSeat(t) };
  }
  if (role === 'trinity') return { ...CABIN.connector, x: 8.2, y: 0, seated: 0 };
  if (role === 'dozer') return { x: 5.9 - smooth((t - 6.1) / 2.5) * 2.1, y: 0, z: -6.8, yaw: 1.1, seated: 0 };
  return { x: -1.8, y: 0, z: -7.7, yaw: .85, seated: 0 };
}

export function truthText(state: TruthRecovery): string {
  const t = state.elapsed;
  if (state.phase === 'ready') return '画面退回白色空间。你刚才看到的也是加载出来的解释。按 G 明确要求退出程序。';
  if (state.phase === 'exit') return t < 2 ? 'Neo：停一下。我需要离开这里。' : t < 4.4
    ? 'Morpheus 放下手中的电池，示意船员断开连接。' : '白色空间逐渐失去声音。现实中的身体仍在连接椅上。';
  if (state.phase === 'unplug') return t < 1.5 ? 'Trinity：先别动，接口还锁着。Dozer 扶住 Neo，避免他扯断接线。'
    : t < 4 ? 'Trinity 解开接口锁，将插头沿颈后方向抽出。'
      : t < 8 ? 'Neo 离开连接椅，摆手让船员保持距离。'
        : t < 12.5 ? '眩晕让 Neo 跪倒，双手撑住甲板，身体干呕。Morpheus 让他慢慢呼吸。' : '视野收窄。船员靠近时，Neo 失去了意识。';
  if (state.phase === 'question') return '旧生活无法像读档一样恢复。你如何理解自己接下来作出的选择？';
  return t < 3 ? '休息后，Neo 在自己的舱室醒来。Morpheus 坐在床旁，没有催促。'
    : t < 6.5 ? 'Neo 想知道能否回去。Morpheus 承认，即使回到矩阵，也无法抹去现在知道的事。'
      : t < 10.5 ? 'Morpheus 为过早揭开真相道歉。习惯的世界崩塌，意识需要时间适应。'
        : t < 14.5 ? '他讲起第一个挣脱系统的人，以及先知关于归来的预言。这是他的信念，还不是 Neo 已经证明的事实。'
          : 'Morpheus：先休息。训练能让你亲自判断自己的能力，而不只是相信我的话。';
}
