import type { FilmJourney } from './film-story.js';
import { PILL_ROOM } from './pills.js';
import { CABIN, cabinBodyPose, cabinSeat } from './cabin.js';

export type AwakeningKind = 'mirror' | 'connect' | 'disconnect' | 'rescue' | 'recovery' | 'cabin' | 'core' | 'construct' | 'desert';
export interface AwakeningBeat { kind: AwakeningKind; elapsed: number; started?: boolean; approach?: { x: number; z: number } }
export interface AwakeningReveal { kind: 'construct' | 'desert'; elapsed: number; role: 'neo' | 'morpheus' }
export type RecoveryCrewRole = 'morpheus' | 'trinity';
export interface RecoveryCrewGesture { elapsed: number; role: RecoveryCrewRole; boarding?: boolean; target?: { x: number; y: number; z: number } }
export const AWAKENING_SECONDS = { mirror: 8, connect: 4, disconnect: 9, rescue: 14, recovery: 12, cabin: 12, core: 8, construct: 11, desert: 13 } as const;
export const MIRROR_TOUCH = { x: -7.1, z: -14.6, radius: 1.25 } as const;
export const MIRROR_SEAT = { x: -9.5, z: -16.05 } as const;
export const MIRROR_FACE = { y: 2.8, radiusX: 1.85, radiusY: 2.65 } as const;
export const MIRROR_FRAME = { x: PILL_ROOM.mirror.x, y: MIRROR_FACE.y + 1, z: PILL_ROOM.mirror.z - .22, width: 4.7, height: 6.25, depth: .3 } as const;
export const MIRROR_TRINITY = { x: -11.35, z: -16.65, yaw: 1.7 } as const;
export const MIRROR_TIMING = { sit: 1.35, wired: 2.75, touch: 3.45, fade: 7.2 } as const;
export interface MirrorGuide { progress: number; lastTick: number; done: boolean; rise?: number }
export const MIRROR_GUIDE_ROUTE = [
  { x: -PILL_ROOM.seat, z: PILL_ROOM.z }, { x: -2.8, z: -3.1 }, { x: -5.8, z: -3.1 },
  { x: -6, z: -9.8 }, { x: -6, z: -12.7 }, { x: -3, z: -17 },
] as const;
const mirrorGuideSegments = MIRROR_GUIDE_ROUTE.slice(1).map((point, i) =>
  Math.hypot(point.x - MIRROR_GUIDE_ROUTE[i].x, point.z - MIRROR_GUIDE_ROUTE[i].z));
export const MIRROR_GUIDE_LENGTH = mirrorGuideSegments.reduce((sum, length) => sum + length, 0);
export function mirrorGuidePose(progress: number): { x: number; z: number; yaw: number } {
  let remaining = Math.max(0, Math.min(MIRROR_GUIDE_LENGTH, progress));
  for (let i = 0; i < mirrorGuideSegments.length; i++) {
    const length = mirrorGuideSegments[i];
    if (remaining > length && i < mirrorGuideSegments.length - 1) { remaining -= length; continue; }
    const a = MIRROR_GUIDE_ROUTE[i], b = MIRROR_GUIDE_ROUTE[i + 1], t = Math.min(1, remaining / length);
    return { x: a.x + (b.x - a.x) * t, z: a.z + (b.z - a.z) * t,
      yaw: Math.atan2(b.x - a.x, b.z - a.z) };
  }
  return { ...MIRROR_GUIDE_ROUTE[MIRROR_GUIDE_ROUTE.length - 1], yaw: Math.PI };
}
export function mirrorGuideProgress(point: { x: number; z: number }): number {
  let nearest = Infinity, progress = 0, passed = 0;
  for (let i = 0; i < mirrorGuideSegments.length; i++) {
    const a = MIRROR_GUIDE_ROUTE[i], b = MIRROR_GUIDE_ROUTE[i + 1], length = mirrorGuideSegments[i];
    const dx = b.x - a.x, dz = b.z - a.z;
    const t = Math.max(0, Math.min(1, ((point.x - a.x) * dx + (point.z - a.z) * dz) / length ** 2));
    const gap = (point.x - a.x - dx * t) ** 2 + (point.z - a.z - dz * t) ** 2;
    if (gap < nearest) { nearest = gap; progress = passed + length * t; }
    passed += length;
  }
  return progress;
}
export const POD_WATER_DROP = 18;
export const POD_RESCUE = { immersion: 1.8, descend: 1, secured: 1.65, hoisted: 5, cleared: 7, closed: 7.8, lowered: 8.6, release: 9.4, fade: 13,
  hatch: { x: 0, y: 0, z: 12, half: 2.8 } } as const;
export const RECOVERY_BED = { x: -7, z: -22, standingX: -3.6, surface: 1.11 } as const;
export const RECOVERY_CABINET = { x: -15.6, y: 3.4, z: -22, width: 6.2, height: 6.5, depth: 10.5 } as const;
export const RECOVERY_FRAME = { halfWidth: 2.45, halfLength: 3.35, height: 12.6, post: .14 } as const;
export const RECOVERY_CREW = {
  morpheus: { start: { x: -2.4, z: -18.5, yaw: -2.45 }, side: 1.32 },
  trinity: { start: { x: -10.5, z: -15.5, yaw: 2.7 }, side: -1.32 },
  approach: 6.8, contact: 10.35, release: 11.7,
} as const;
export const CONSTRUCT_REVEAL = { neo: { x: 4.4, z: -6.2, yaw: Math.PI }, morpheus: { x: -4.4, z: -6.2, yaw: Math.PI }, television: { x: 0, z: -16 } } as const;
export const DESERT_REVEAL = { neo: { x: 1.8, z: -28, yaw: Math.PI }, morpheus: { x: -3.2, z: -26.8, yaw: Math.PI }, towersZ: -70 } as const;
export type AwakeningPose = 'touch' | 'connect' | 'pod' | 'fall' | 'float' | 'lift' | 'recover' | 'cabin' | 'core' | 'construct' | 'desert';
const clamp = (value: number) => Math.max(0, Math.min(1, value));
const smooth = (value: number) => { const t = clamp(value); return t * t * (3 - 2 * t); };
export const mirrorSilver = (elapsed: number): number => clamp((elapsed - MIRROR_TIMING.touch) / (AWAKENING_SECONDS.mirror - MIRROR_TIMING.touch));

export function podRescuePose(elapsed: number): { descend: number; grip: number; lift: number; board: number; hatch: number; lower: number; release: number; settle: number; fade: number } {
  return { descend: smooth(elapsed / POD_RESCUE.descend),
    grip: smooth((elapsed - POD_RESCUE.descend) / (POD_RESCUE.secured - POD_RESCUE.descend)),
    lift: smooth((elapsed - POD_RESCUE.secured) / (POD_RESCUE.hoisted - POD_RESCUE.secured)),
    board: smooth((elapsed - POD_RESCUE.hoisted) / (POD_RESCUE.cleared - POD_RESCUE.hoisted)),
    hatch: smooth((elapsed - POD_RESCUE.cleared) / (POD_RESCUE.closed - POD_RESCUE.cleared)),
    lower: smooth((elapsed - POD_RESCUE.closed) / (POD_RESCUE.lowered - POD_RESCUE.closed)),
    release: smooth((elapsed - POD_RESCUE.release) / .7), settle: smooth((elapsed - 10.1) / 1.3),
    fade: smooth((elapsed - POD_RESCUE.fade) / (AWAKENING_SECONDS.rescue - POD_RESCUE.fade)) };
}

export function recoveryBodyPose(elapsed: number) {
  const sit = smooth((elapsed - 7) / 1.4), turn = smooth((elapsed - 8.4) / .8);
  const scoot = smooth((elapsed - 9.2) / .65), lower = smooth((elapsed - 9.85) / .65), rise = smooth((elapsed - 10.5) / 1.2);
  return { sit, turn, lower, rise, x: RECOVERY_BED.x + scoot + (RECOVERY_BED.standingX - RECOVERY_BED.x - 1) * rise, y: rise - 1,
    yaw: Math.PI - Math.PI / 2 * turn };
}

export function recoveryCrewPose(gesture: RecoveryCrewGesture): { x: number; z: number; yaw: number; support: number } {
  if (gesture.boarding) {
    const side = gesture.role === 'morpheus' ? 1 : -1;
    const approach = smooth((gesture.elapsed - POD_RESCUE.closed) / 1.6);
    const x = side * (3.8 - approach * 2.48), z = 8.7 + approach * 2.35;
    return { x, z, yaw: Math.atan2(-x, POD_RESCUE.hatch.z - z), support: smooth((gesture.elapsed - 9) / .4) };
  }
  const config = RECOVERY_CREW[gesture.role];
  const approach = smooth((gesture.elapsed - RECOVERY_CREW.approach) / (RECOVERY_CREW.contact - RECOVERY_CREW.approach));
  const neoX = recoveryBodyPose(gesture.elapsed).x;
  const targetX = Math.max(RECOVERY_BED.x + 2.25, neoX + .65), targetZ = RECOVERY_BED.z + config.side * .75;
  // Reach the open aisle before approaching the patient; neither helper may walk through the bed.
  const first = Math.min(1, approach / .45), second = clamp((approach - .45) / .4), third = clamp((approach - .85) / .15);
  const x = gesture.role === 'morpheus' ? config.start.x + (targetX - config.start.x) * approach
    : config.start.x + (-2.1 - config.start.x) * first + (targetX + 2.1) * third;
  const z = gesture.role === 'morpheus' ? config.start.z + (targetZ - config.start.z) * approach
    : config.start.z + (-17.4 - config.start.z) * first - 6.8 * second + (targetZ + 24.2) * third;
  const support = smooth((gesture.elapsed - 10.35) / .6) * (1 - smooth((gesture.elapsed - RECOVERY_CREW.release) / .3));
  return { x, z, yaw: config.start.yaw + (Math.atan2(neoX - x, RECOVERY_BED.z - z) - config.start.yaw) * approach, support };
}

export function awakeningLocked(journey: FilmJourney): boolean {
  return !journey.visiting && (journey.scene === 'm1_pod' || ['m1_mirror', 'm1_recovery', 'm1_cabin', 'm1_construct', 'm1_desert'].includes(journey.scene)
    && !!journey.awakening && (journey.awakening.elapsed < AWAKENING_SECONDS[journey.awakening.kind]
      || journey.scene === 'm1_construct' && journey.step === 1 && journey.awakening.kind === 'construct' && journey.awakening.started !== false));
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
      text: beat.elapsed < MIRROR_TIMING.sit ? '走到追踪椅旁坐下。' : beat.elapsed < MIRROR_TIMING.wired ? 'Trinity 将电极接到手臂；屏幕开始追踪信号。'
        : beat.elapsed < MIRROR_TIMING.touch ? '裂镜里的倒影正在复原。Neo 从椅上伸出手。'
        : beat.elapsed < 5.8 ? '冰冷的银色镜面粘住指尖，沿手臂与颈部蔓延。' : 'Neo 惊恐地仰头；房间的声音和光线正在消失。' };
  }
  if (beat?.kind === 'connect') return { x: 8, y: 0, z: 5, pose: 'connect', text: '坐稳。接线组已经找到你，连接正在从模拟世界转向真实身体。' };
  if (beat?.kind === 'rescue') {
    const rescue = podRescuePose(beat.elapsed);
    return { x: 0, y: -POD_WATER_DROP - POD_RESCUE.immersion + rescue.lift * (14 + POD_RESCUE.immersion) + rescue.board * 5.25 - rescue.lower * 1.25, z: POD_RESCUE.hatch.z, pose: 'lift',
      text: beat.elapsed < POD_RESCUE.descend ? '探照灯照亮水面。救援机械爪张开支臂，正在降到身体两侧。'
        : beat.elapsed < POD_RESCUE.secured ? '支臂收拢到腋下和背部。先让装置托稳身体。'
          : beat.elapsed < POD_RESCUE.hoisted ? '绞盘收紧。尼布甲尼撒号将你托出废水。'
            : beat.elapsed < POD_RESCUE.cleared ? '船底的开口越来越近。船员正在舱口等待。'
              : beat.elapsed < POD_RESCUE.lowered ? '双脚越过舱口，底门在身下合拢。绞盘慢慢将你放到甲板上。'
                : beat.elapsed < 11.4 ? 'Morpheus 和 Trinity 接住虚弱的身体，机械支臂松开。'
                  : beat.elapsed < POD_RESCUE.fade ? 'Morpheus：欢迎来到真实世界，Neo。' : 'Neo 失去意识。船员将他送往医疗舱。' };
  }
  if (beat?.kind === 'recovery') {
    const body = recoveryBodyPose(0);
    const text = beat.started === false ? '陌生的空气进入肺部。转动视角看清医疗舱，按 G 示意船员开始恢复肌肉。'
      : beat.elapsed < 2.2 ? 'Dozer 调整治疗设备：这具身体还需要恢复。Morpheus 在床边等待。'
      : beat.elapsed < 6 ? 'Morpheus 解释，肌肉已经萎缩；这些刺痛来自身体第一次真正使用自己的感官。'
      : beat.elapsed < 9 ? '设备逐渐停下。Morpheus 让 Neo 先休息，等身体恢复后再面对答案。'
      : '疲惫让眼前暗下去。飞船仍在航行。';
    return { x: body.x, y: body.y, z: RECOVERY_BED.z, pose: 'recover', text };
  }
  if (beat?.kind === 'cabin') {
    const body = cabinBodyPose(beat.elapsed);
    return { x: body.x, y: body.y, z: body.z, pose: 'cabin', text: beat.started === false
      ? '一段休息之后。狭窄船舱的灯亮着，身上已有船员留下的衣物。按 G 起身，检查颈后的接口。'
      : beat.elapsed < 4.8 ? 'Neo 慢慢坐起，把双脚放到甲板上。颈后的异物感仍然存在。'
      : beat.elapsed < 8.8 ? '手指摸到金属接口。Morpheus 说明：熟悉的 1999 年来自模拟，现实已过去大约两个世纪，确切年份仍不清楚。'
      : '舱门打开。Morpheus 邀请 Neo 亲眼看看飞船的核心。' };
  }
  if (beat?.kind === 'core') {
    const from = beat.approach ?? CABIN.approach, walk = smooth(beat.elapsed / .9), sit = cabinSeat(beat.elapsed);
    return { x: from.x + (CABIN.chair.x - 1.85 - from.x) * walk + 1.85 * sit,
      y: .22 * smooth((beat.elapsed - .25) / .4) * (1 - sit), z: from.z + (CABIN.chair.z - from.z) * walk, pose: 'core',
      text: beat.started === false ? '这里是飞船的广播核心。按 G 坐入连接椅，允许 Morpheus 接通颈后接口。'
        : beat.elapsed < 2.2 ? 'Neo 坐稳。Morpheus 从椅后拿起连接线。'
        : beat.elapsed < 5 ? '插头靠近颈后的金属接口。现实身体留在飞船，意识将进入加载程序。'
        : '连接完成。舱内的光逐渐被无边的白色取代。' };
  }
  if (beat?.kind === 'construct') {
    const text = beat.started === false ? '白色没有边界。两把旧皮椅与一台电视像被直接写进空间。按 G 请 Morpheus 开始说明。'
      : beat.elapsed < 2.4 ? '老式电视亮起雪花。Morpheus 正准备切换画面。'
      : beat.elapsed < 6.8 ? '屏幕里是 Thomas Anderson 熟悉的城市。眼睛、气味和触感都可以被系统转换成信号。'
      : beat.elapsed < 7.65 ? '熟悉的街道短暂剥落成代码。熟悉并不能单独证明真实。'
      : 'Morpheus 切换频道：屏幕里的城市已成废墟。镜头不断靠近，仿佛要进入那个世界。';
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
  const immersion = POD_RESCUE.immersion * smooth(((beat?.elapsed ?? 0) - 6.8) / 1.2);
  return { x: 0, y: -POD_WATER_DROP * fall * fall - immersion, z: -12 + 24 * fall, pose: fall === 1 ? 'float' : fall > 0 ? 'fall' : 'pod',
    text: !beat ? '转动视角观察培养塔。G 检查仍连接在身上的管线。' : beat.elapsed < 2 ? '维护机器锁定了异常信号，正在靠近培养舱。' : beat.elapsed < 4 ? '固定臂扶住后颈，连接管线逐一脱开。' : fall < 1 ? '舱底打开。水流把你冲入排放管道。' : '上方出现了探照灯。G 抓住下降的救援装置。' };
}
