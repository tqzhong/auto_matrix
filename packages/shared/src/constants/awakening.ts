import type { FilmJourney } from './film-story.js';

export interface AwakeningBeat { kind: 'mirror' | 'connect' | 'disconnect' | 'rescue' | 'recovery'; elapsed: number; started?: boolean }
export const AWAKENING_SECONDS = { mirror: 8, connect: 4, disconnect: 9, rescue: 5, recovery: 12 } as const;
export const POD_WATER_DROP = 18;
export const RECOVERY_BED = { x: -7, z: -22, standingX: -3.6 } as const;
export type AwakeningPose = 'touch' | 'connect' | 'pod' | 'fall' | 'float' | 'lift' | 'recover';
const clamp = (value: number) => Math.max(0, Math.min(1, value));
const smooth = (value: number) => { const t = clamp(value); return t * t * (3 - 2 * t); };

export function awakeningLocked(journey: FilmJourney): boolean {
  return !journey.visiting && (journey.scene === 'm1_pod' || ['m1_mirror', 'm1_recovery'].includes(journey.scene)
    && !!journey.awakening && journey.awakening.elapsed < AWAKENING_SECONDS[journey.awakening.kind]);
}

export function recoveryWaiting(journey: FilmJourney): boolean {
  return !journey.visiting && journey.scene === 'm1_recovery' && journey.awakening?.kind === 'recovery' && journey.awakening.started === false;
}

// Local coordinates are also used by the pod, drainage channel and rescue claw.
export function awakeningPose(beat?: AwakeningBeat): { x: number; y: number; z: number; pose: AwakeningPose; text: string } {
  if (beat?.kind === 'mirror') return { x: -9.5, y: 0, z: -16.1, pose: 'touch', text: beat.elapsed < 2 ? '镜面的裂纹正在合拢。' : beat.elapsed < 5 ? '冰冷的银色表面附着在手上，沿手臂蔓延。' : '房间的声音变得遥远。接线组正在定位你的真实身体。' };
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
  const fall = clamp(((beat?.elapsed ?? 0) - 4) / 3);
  return { x: 0, y: -POD_WATER_DROP * fall * fall, z: -12 + 24 * fall, pose: fall === 1 ? 'float' : fall > 0 ? 'fall' : 'pod',
    text: !beat ? '转动视角观察培养塔。G 检查仍连接在身上的管线。' : beat.elapsed < 2 ? '维护机器锁定了异常信号，正在靠近培养舱。' : beat.elapsed < 4 ? '固定臂扶住后颈，连接管线逐一脱开。' : fall < 1 ? '舱底打开。水流把你冲入排放管道。' : '上方出现了探照灯。G 抓住下降的救援装置。' };
}
