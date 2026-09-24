import type { FilmJourney } from './film-story.js';

export type AwakeningKind = 'mirror' | 'connect' | 'disconnect' | 'rescue' | 'recovery' | 'construct' | 'desert';
export interface AwakeningBeat { kind: AwakeningKind; elapsed: number; started?: boolean; approach?: { x: number; z: number } }
export interface AwakeningReveal { kind: 'construct' | 'desert'; elapsed: number; role: 'neo' | 'morpheus' }
export const AWAKENING_SECONDS = { mirror: 8, connect: 4, disconnect: 9, rescue: 5, recovery: 12, construct: 11, desert: 13 } as const;
export const MIRROR_TOUCH = { x: -7.1, z: -14.6, radius: 1.25 } as const;
export const MIRROR_SEAT = { x: -9.5, z: -16.1 } as const;
export const MIRROR_TIMING = { sit: 1.35, wired: 2.75, touch: 3.45, fade: 7.2 } as const;
export const POD_WATER_DROP = 18;
export const RECOVERY_BED = { x: -7, z: -22, standingX: -3.6 } as const;
export const CONSTRUCT_REVEAL = { neo: { x: 4.4, z: -6.2, yaw: Math.PI }, morpheus: { x: -4.4, z: -6.2, yaw: Math.PI }, television: { x: 0, z: -16 } } as const;
export const DESERT_REVEAL = { neo: { x: 1.8, z: -28, yaw: Math.PI }, morpheus: { x: -3.2, z: -26.8, yaw: Math.PI }, towersZ: -70 } as const;
export type AwakeningPose = 'touch' | 'connect' | 'pod' | 'fall' | 'float' | 'lift' | 'recover' | 'construct' | 'desert';
const clamp = (value: number) => Math.max(0, Math.min(1, value));
const smooth = (value: number) => { const t = clamp(value); return t * t * (3 - 2 * t); };
export const mirrorSilver = (elapsed: number): number => clamp((elapsed - MIRROR_TIMING.touch) / (AWAKENING_SECONDS.mirror - MIRROR_TIMING.touch));

export function awakeningLocked(journey: FilmJourney): boolean {
  return !journey.visiting && (journey.scene === 'm1_pod' || ['m1_mirror', 'm1_recovery', 'm1_construct', 'm1_desert'].includes(journey.scene)
    && !!journey.awakening && journey.awakening.elapsed < AWAKENING_SECONDS[journey.awakening.kind]);
}

export function recoveryWaiting(journey: FilmJourney): boolean {
  return !journey.visiting && journey.scene === 'm1_recovery' && journey.awakening?.kind === 'recovery' && journey.awakening.started === false;
}

export function awakeningWaiting(journey: FilmJourney): boolean {
  return awakeningLocked(journey) && journey.awakening?.started === false;
}

// Local coordinates are also used by the pod, drainage channel and rescue claw.
export function awakeningPose(beat?: AwakeningBeat): { x: number; y: number; z: number; pose: AwakeningPose; text: string } {
  if (beat?.kind === 'mirror') {
    const from = beat.approach ?? MIRROR_TOUCH;
    const sit = smooth(beat.elapsed / MIRROR_TIMING.sit);
    return { x: from.x + (MIRROR_SEAT.x - from.x) * sit, y: 0, z: from.z + (MIRROR_SEAT.z - from.z) * sit, pose: 'touch',
      text: beat.elapsed < MIRROR_TIMING.sit ? '走到追踪椅旁坐下。' : beat.elapsed < MIRROR_TIMING.wired ? 'Trinity 接上电极与耳机；屏幕开始追踪信号。'
        : beat.elapsed < MIRROR_TIMING.touch ? '裂镜里的倒影正在复原。Neo 从椅上伸出手。'
        : beat.elapsed < 5.8 ? '冰冷的银色镜面粘住指尖，沿手臂与颈部蔓延。' : 'Neo 惊恐地仰头；房间的声音和光线正在消失。' };
  }
  if (beat?.kind === 'connect') return { x: 8, y: 0, z: 5, pose: 'connect', text: '坐稳。接线组已经找到你，连接正在从模拟世界转向真实身体。' };
  if (beat?.kind === 'rescue') return { x: 0, y: -POD_WATER_DROP + clamp(beat.elapsed / 5) * 14, z: 12, pose: 'lift', text: '救援机械爪托住身体，尼布甲尼撒号正在将你吊出废水。' };
  if (beat?.kind === 'recovery') {
    const standing = smooth((beat.elapsed - 9) / 3);
    const text = beat.started === false ? '陌生的空气进入肺部。转动视角看清医疗舱，按 G 示意船员开始恢复肌肉。'
      : beat.elapsed < 2.2 ? '眼睛第一次适应真实世界的光。Morpheus 和 Trinity 就在床边。'
      : beat.elapsed < 7 ? '针疗臂依次刺激从未真正使用过的肌肉。旧插口仍留在皮肤与颈后。'
      : beat.elapsed < 9 ? 'Neo 抬起手，确认眼前的身体属于自己。'
      : beat.elapsed < 11.4 ? '船员扶稳医疗床。Neo 坐起，把双脚放到冰冷的甲板上。'
      : 'Neo 在床边站稳。前方通道通向核心连接区。';
    return { x: RECOVERY_BED.x + (RECOVERY_BED.standingX - RECOVERY_BED.x) * standing, y: 0, z: RECOVERY_BED.z, pose: 'recover', text };
  }
  if (beat?.kind === 'construct') {
    const text = beat.started === false ? '白色没有边界。两把旧皮椅与一台电视像被直接写进空间。按 G 请 Morpheus 开始说明。'
      : beat.elapsed < 2.4 ? '老式电视从雪花中亮起。屏幕里是 Thomas Anderson 熟悉的城市。'
      : beat.elapsed < 6.8 ? 'Morpheus 指向屏幕：眼睛、气味和触感都可以被系统转换成信号。'
      : beat.elapsed < 9.2 ? '画面在街道、代码与培养塔之间切换。熟悉并不能单独证明真实。'
      : '电视的白光吞没城市影像。构造体准备加载真相之后的世界。';
    return { x: CONSTRUCT_REVEAL.neo.x, y: 0, z: CONSTRUCT_REVEAL.neo.z, pose: 'construct', text };
  }
  if (beat?.kind === 'desert') {
    const text = beat.started === false ? '焦黑城市延伸到灰色天幕。按 G 请 Morpheus 继续这段揭示。'
      : beat.elapsed < 3 ? '风卷起灰烬。Morpheus 指向被摧毁的天际线。'
      : beat.elapsed < 7 ? '战争留下断裂的道路、空楼与再也照不到地面的天空。'
      : beat.elapsed < 10.2 ? '远处的收割塔仍在运作。你刚刚醒来的培养舱只是其中一个。'
      : '眼前的尺度压垮了旧有解释。Neo 的身体开始拒绝加载程序。';
    return { x: DESERT_REVEAL.neo.x, y: 0, z: DESERT_REVEAL.neo.z, pose: 'desert', text };
  }
  const fall = clamp(((beat?.elapsed ?? 0) - 4) / 3);
  return { x: 0, y: -POD_WATER_DROP * fall * fall, z: -12 + 24 * fall, pose: fall === 1 ? 'float' : fall > 0 ? 'fall' : 'pod',
    text: !beat ? '转动视角观察培养塔。G 检查仍连接在身上的管线。' : beat.elapsed < 2 ? '维护机器锁定了异常信号，正在靠近培养舱。' : beat.elapsed < 4 ? '固定臂扶住后颈，连接管线逐一脱开。' : fall < 1 ? '舱底打开。水流把你冲入排放管道。' : '上方出现了探照灯。G 抓住下降的救援装置。' };
}
