import type { FilmJourney } from './film-story.js';

export type TrainingKind = 'download' | 'jump' | 'red_dress';
export interface TrainingPerformance { kind: TrainingKind; elapsed: number; started: boolean }
export interface DojoLesson { dodged: boolean; combo: number; hits: number; complete?: boolean }
export type TrainingRole = 'neo' | 'tank' | 'morpheus' | 'citizen_1' | 'citizen_2' | 'smith';
export interface TrainingGesture { kind: TrainingKind; elapsed: number; role: TrainingRole }

export const TRAINING_SECONDS = { download: 10, jump: 4, red_dress: 12 } as const;
export const DOJO_COMBO_WINDOW = 3;
export const DOWNLOAD_CHAIR = {
  neo: { x: 6.5, z: -5, yaw: -Math.PI / 2 },
  tank: { x: 10.2, z: -5, yaw: -Math.PI / 2 },
} as const;
export const JUMP_PROGRAM = {
  neo: { x: 0, z: -10, yaw: Math.PI },
  start: { x: -3, z: -10, yaw: Math.PI },
  finish: { x: -3, z: -36, yaw: Math.PI },
} as const;
export const RED_DRESS_PROGRAM = {
  neo: { x: 7, z: -12, yaw: Math.PI },
  morpheus: { x: 2.5, z: -9, yaw: 0 },
  womanStart: { x: 7, z: -29, yaw: 0 },
  womanFinish: { x: 7, z: 8, yaw: 0 },
  civilian: { x: 7, z: 7, yaw: Math.PI },
} as const;

const clamp = (value: number) => Math.max(0, Math.min(1, value));
const smooth = (value: number) => { const t = clamp(value); return t * t * (3 - 2 * t); };

export function trainingLocked(journey: FilmJourney): boolean {
  const training = journey.training;
  return Boolean(!journey.visiting && training && training.elapsed < TRAINING_SECONDS[training.kind]);
}

export function trainingWaiting(journey: FilmJourney): boolean {
  return trainingLocked(journey) && journey.training?.started === false;
}

export function trainingText(training: TrainingPerformance): string {
  if (training.kind === 'download') {
    if (!training.started) return '连接椅已经就位。按 G 请 Tank 开始上传训练程序。';
    return training.elapsed < 2.2 ? '颈后接口接通，Tank 正在校验神经信号。'
      : training.elapsed < 6.8 ? '动作、呼吸与重心变化以不属于记忆的速度进入意识。'
      : training.elapsed < 9 ? '手指与眼球出现细小反应；身体正在把程序知识变成可调用的动作。'
      : '上传完成。知识已经存在，接下来必须在道场里证明身体能跟上。';
  }
  if (training.kind === 'jump') {
    if (!training.started) return 'Morpheus 站在起跳线旁。按 G 观察他如何放下对距离的恐惧。';
    return training.elapsed < 1.15 ? 'Morpheus 向后压低重心，开始助跑。'
      : training.elapsed < 3.25 ? '他越过街谷，落点远超普通身体的极限。'
      : 'Morpheus 在对面屋顶站稳。现在轮到你亲自助跑、起跳并承担失败。';
  }
  if (!training.started) return '人群仍在流动。按 G 开始注意力测试，亲自判断刚才忽略了什么。';
  return training.elapsed < 3.8 ? '迎面的人群不断换位。红裙女子逆着行人向你走来。'
    : training.elapsed < 5.8 ? '你的视线跟随红色。Morpheus 让训练程序在这一刻停住。'
    : training.elapsed < 8.8 ? '你转回身。刚才的普通行人已经成为举枪的 Smith。'
    : '冻结解除。任何尚未醒来的人，都可能成为系统进入现场的通道。';
}

export function trainingRoot(training: TrainingPerformance, role: TrainingRole): { x: number; y: number; z: number; yaw: number } {
  if (training.kind === 'download') {
    const root = role === 'tank' ? DOWNLOAD_CHAIR.tank : DOWNLOAD_CHAIR.neo;
    return { ...root, y: 0 };
  }
  if (training.kind === 'jump') {
    if (role === 'neo') return { ...JUMP_PROGRAM.neo, y: 0 };
    const run = smooth(training.elapsed / 1.15);
    const flight = smooth((training.elapsed - 1.15) / 2.05);
    const landed = training.elapsed >= 3.2;
    const z = landed ? JUMP_PROGRAM.finish.z : JUMP_PROGRAM.start.z + (JUMP_PROGRAM.finish.z - JUMP_PROGRAM.start.z) * flight;
    const y = landed ? 0 : Math.sin(flight * Math.PI) * 9.5;
    return { x: JUMP_PROGRAM.start.x * (1 - run * .12), y, z, yaw: Math.PI };
  }
  if (role === 'neo') {
    const turn = smooth((training.elapsed - 5.4) / 1.25);
    return { ...RED_DRESS_PROGRAM.neo, y: 0, yaw: Math.PI * (1 - turn) };
  }
  if (role === 'morpheus') return { ...RED_DRESS_PROGRAM.morpheus, y: 0 };
  if (role === 'citizen_2') {
    const walk = smooth(training.elapsed / 5.3);
    return { x: RED_DRESS_PROGRAM.womanStart.x, y: 0, z: RED_DRESS_PROGRAM.womanStart.z + (RED_DRESS_PROGRAM.womanFinish.z - RED_DRESS_PROGRAM.womanStart.z) * walk, yaw: 0 };
  }
  return { ...RED_DRESS_PROGRAM.civilian, y: 0 };
}
