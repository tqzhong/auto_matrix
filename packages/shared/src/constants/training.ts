import type { FilmJourney } from './film-story.js';
import { CABIN, CABIN_ROUTE_LENGTH, cabinBodyPose, cabinGuidePose } from './cabin.js';
import { awakeningPose } from './awakening.js';

export type TrainingKind = 'download' | 'jump' | 'red_dress';
export interface TrainingPerformance { kind: TrainingKind; elapsed: number; started: boolean }
export interface DojoLesson { dodged: boolean; combo: number; hits: number; counterUntil?: number; resets?: number; complete?: boolean }
export type TrainingRole = 'neo' | 'tank' | 'morpheus' | 'citizen_1' | 'citizen_2' | 'smith';
export interface TrainingGesture { kind: TrainingKind; elapsed: number; role: TrainingRole }
export interface DownloadSetup { phase: 'greeting' | 'waking' | 'walk' | 'connecting' | 'ready'; elapsed: number; progress: number; approach?: { x: number; z: number } }
export interface DownloadGesture extends DownloadSetup { role: 'neo' | 'tank'; target?: { x: number; y: number; z: number } }
export const DOWNLOAD_SETUP_SECONDS = { waking: 12, connecting: 10 } as const;
export const DOWNLOAD_OPERATOR = { x: 11.8, z: -8, yaw: Math.PI,
  keyboard: { x: 11.8, y: 2.4, z: -9.05 }, drive: { x: 12.5, y: 2.65, z: -9.4 },
  desk: { x: 11.8, z: -9.75, width: 3.4, depth: 1.7, height: 2.4 } } as const;

export const TRAINING_SECONDS = { download: 10, jump: 4, red_dress: 12 } as const;
export const DOJO_COMBO_WINDOW = 3;
export const DOWNLOAD_CHAIR = {
  neo: { x: 6.5, z: -5, yaw: -Math.PI / 2 },
  tank: DOWNLOAD_OPERATOR,
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

export function downloadDiskPose(elapsed: number) {
  const lift = smooth((elapsed - .35) / .65), insert = smooth((elapsed - 1.15) / .9);
  return { x: 12.5, y: 2.46 + lift * .64 - insert * .45, z: -9.05 + lift * .3 - insert * .66 };
}

export function downloadHandPoint(elapsed: number, side: 'R' | 'L') {
  const key = DOWNLOAD_OPERATOR.keyboard, typing = smooth((elapsed - 2.1) / .55);
  const disk = downloadDiskPose(elapsed);
  const tap = elapsed > 2.6 && elapsed < 8.7 ? Math.sin(elapsed * 10 + (side === 'L' ? 2 : 0)) * .025 : 0;
  return side === 'L' ? { x: key.x - .35, y: key.y + .23 + tap, z: key.z + .08 }
    : { x: disk.x + (key.x + .35 - disk.x) * typing, y: disk.y + .22 + (key.y + .23 - disk.y - .22) * typing + tap,
      z: disk.z + .12 + (key.z + .08 - disk.z - .12) * typing };
}

export function trainingLocked(journey: FilmJourney): boolean {
  const training = journey.training;
  if (!journey.visiting && journey.downloadSetup && journey.downloadSetup.phase !== 'ready') return journey.downloadSetup.phase !== 'walk';
  return Boolean(!journey.visiting && training && training.elapsed < TRAINING_SECONDS[training.kind]);
}

export function trainingWaiting(journey: FilmJourney): boolean {
  if (journey.downloadSetup && journey.downloadSetup.phase !== 'ready') return !journey.visiting && journey.downloadSetup.phase === 'greeting';
  return trainingLocked(journey) && journey.training?.started === false;
}

export function downloadRoot(setup: DownloadSetup, role: 'neo' | 'tank') {
  if (role === 'tank') {
    if (setup.phase === 'greeting' || setup.phase === 'waking') {
      const turn = setup.phase === 'waking' ? smooth((setup.elapsed - 4) / .7) * (1 - smooth((setup.elapsed - 6.5) / .7)) : 0;
      return { ...CABIN.morpheus, y: 0, yaw: CABIN.morpheus.yaw + turn * Math.PI };
    }
    if (setup.phase === 'walk') {
      const guide = cabinGuidePose(setup.progress);
      return { ...guide, x: guide.x - .5 * smooth((setup.progress - CABIN_ROUTE_LENGTH + 3) / 3), y: 0 };
    }
    const move = setup.phase === 'ready' ? 1 : smooth((setup.elapsed - 6) / 3);
    return { x: 8.2 + (DOWNLOAD_OPERATOR.x - 8.2) * move, y: 0, z: CABIN.connector.z + (DOWNLOAD_OPERATOR.z - CABIN.connector.z) * move,
      yaw: CABIN.connector.yaw + (DOWNLOAD_OPERATOR.yaw - CABIN.connector.yaw) * move };
  }
  if (setup.phase === 'greeting' || setup.phase === 'waking') {
    const body = cabinBodyPose(setup.phase === 'greeting' ? 0 : setup.elapsed);
    const exitYaw = Math.atan2(CABIN.door.x - body.x, CABIN.door.z - body.z);
    return { ...body, yaw: body.yaw + (exitYaw - body.yaw) * smooth((setup.elapsed - 10.5) / 1.2) };
  }
  if (setup.phase === 'connecting') return { ...awakeningPose({ kind: 'core', elapsed: setup.elapsed, started: true, approach: setup.approach }), yaw: CABIN.chair.yaw };
  return { ...CABIN.chair, y: 0 };
}

export function downloadSetupText(setup: DownloadSetup): string {
  if (setup.phase === 'greeting') return '又一个早晨，Tank 来到舱室：准备好认识训练程序了吗？按 G 起身。';
  if (setup.phase === 'waking') return setup.elapsed < 4 ? 'Tank 自我介绍。他负责操作台，也会带你完成今天的训练。'
    : setup.elapsed < 7 ? 'Neo 注意到他没有颈后接口。Tank 转过身：他和哥哥 Dozer 都出生在现实世界。'
      : setup.elapsed < 10 ? 'Tank 提到锡安，那是幸存的人类城市。他希望有一天能带 Neo 回去看看。' : '舱门外是同一条甲板通道。Tank 在前面等你。';
  if (setup.phase === 'walk') return '跟随 Tank 穿过舱门和中央通道。走到连接椅前，按 G 坐下；落后时他会等你。';
  if (setup.phase === 'connecting') return setup.elapsed < 2.2 ? 'Neo 转身坐稳。Tank 从椅后拿起连接线。'
    : setup.elapsed < 5.8 ? 'Tank 对准颈后的接口，将插头推入并检查锁定。' : 'Tank 回到操作台，准备好格斗程序。连接保持，等待你的确认。';
  return '接口已连接。按 G 请 Tank 装入格斗程序，开始上传。';
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
