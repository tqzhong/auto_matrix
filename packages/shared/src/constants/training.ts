import type { FilmJourney } from './film-story.js';
import { CABIN, CABIN_ROUTE_LENGTH, cabinBodyPose, cabinGuidePose } from './cabin.js';
import { awakeningPose } from './awakening.js';
import { jumpImpactPose, type JumpImpact } from './jump-impact.js';

export type TrainingKind = 'download' | 'jump' | 'jump_fall' | 'jump_return' | 'red_dress';
export interface TrainingPerformance { kind: TrainingKind; elapsed: number; started: boolean; jumpVersion?: 2; fall?: JumpImpact }
export interface DojoLesson { dodged: boolean; combo: number; hits: number; counterUntil?: number; resets?: number; complete?: boolean }
export type TrainingRole = 'neo' | 'tank' | 'morpheus' | 'citizen_1' | 'citizen_2' | 'smith';
export interface TrainingGesture { kind: TrainingKind; elapsed: number; role: TrainingRole; fall?: JumpImpact }
export interface DownloadSetup { phase: 'greeting' | 'waking' | 'walk' | 'connecting' | 'ready'; elapsed: number; progress: number; approach?: { x: number; z: number } }
export interface DownloadGesture extends DownloadSetup { role: 'neo' | 'tank'; target?: { x: number; y: number; z: number } }
export const DOWNLOAD_SETUP_SECONDS = { waking: 12, connecting: 10 } as const;
export const DOWNLOAD_OPERATOR = { x: 11.8, z: -8, yaw: Math.PI,
  keyboard: { x: 11.8, y: 2.4, z: -9.05 }, drive: { x: 12.5, y: 2.65, z: -9.4 },
  desk: { x: 11.8, z: -9.75, width: 3.4, depth: 1.7, height: 2.4 } } as const;
export const DOWNLOAD_INVITATION = { from: { x: -1.8, z: -8.8 }, to: { x: 2.3, z: -5.1 }, start: 5.8, duration: 3.6 } as const;

export const TRAINING_SECONDS = { download: 10, jump: 6, jump_fall: 6, jump_return: 12, red_dress: 12 } as const;
export const DOJO_COMBO_WINDOW = 3;
export const DOWNLOAD_CHAIR = {
  neo: { x: 6.5, z: -5, yaw: -Math.PI / 2 },
  tank: DOWNLOAD_OPERATOR,
} as const;
export const JUMP_PROGRAM = {
  neo: { x: 0, z: -10, yaw: Math.PI },
  start: { x: -3, z: -2.8, yaw: Math.PI },
  launch: { x: -3, z: -12.35, yaw: Math.PI },
  finish: { x: -3, z: -36, yaw: Math.PI },
  prepare: .8, run: 1.15, flight: 2.05, apex: 9.5,
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

export function jumpDemonstration(elapsed: number) {
  const path = JUMP_PROGRAM, takeoff = path.prepare + path.run, touchdown = takeoff + path.flight;
  const running = elapsed >= path.prepare && elapsed < takeoff, airborne = elapsed >= takeoff && elapsed < touchdown;
  const run = clamp((elapsed - path.prepare) / path.run), air = clamp((elapsed - takeoff) / path.flight);
  const length = path.start.z - path.launch.z, flightSpeed = (path.launch.z - path.finish.z) / path.flight;
  const initial = 2 - flightSpeed * path.run / length;
  const progress = initial * run + (1 - initial) * run * run;
  const z = elapsed < takeoff ? path.start.z - length * progress : path.launch.z + (path.finish.z - path.launch.z) * air;
  const landing = elapsed >= touchdown ? Math.sin(clamp((elapsed - touchdown) / .8) * Math.PI) : 0;
  const turn = smooth((elapsed - touchdown - .85) / .85);
  const facing = Math.atan2(path.neo.x - path.finish.x, path.neo.z - path.finish.z);
  return { x: path.start.x, y: airborne ? 4 * path.apex * air * (1 - air) : 0, z,
    yaw: Math.PI + (facing - Math.PI) * turn, running, airborne, run, air, landing, turn,
    speed: running ? length / path.run * (initial + 2 * (1 - initial) * run) : airborne ? flightSpeed : 0,
    distance: elapsed < takeoff ? length * progress : length + (path.launch.z - path.finish.z) * air };
}

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
  if (training.kind === 'jump_fall') {
    const pose = jumpImpactPose(training.fall!, training.elapsed);
    return !pose.landed ? 'Neo 没有跨过楼间，身体沿着街谷下坠。'
      : pose.impact < .3 ? '街面像柔软的程序表面一样陷下去。'
        : pose.impact < 1.5 ? '路面回弹，将 Neo 抛起后再次落下。'
          : training.elapsed < TRAINING_SECONDS.jump_fall ? 'Neo 趴在街面上，慢慢缓过来。'
            : 'Neo 趴在街面上。第一次失败已经发生；按 G 回到飞船上的身体。';
  }
  if (training.kind === 'jump_return') {
    if (!training.started) return '连接椅上的身体醒来。按 G 检查嘴角的痛感，听 Morpheus 解释训练的后果。';
    return training.elapsed < 3 ? 'Neo 睁开眼睛，呼吸仍然急促。Morpheus 在连接椅前等他。'
      : training.elapsed < 6.5 ? '手指擦过嘴角，留下少量鲜血。程序中的坠落影响了现实身体。'
        : training.elapsed < 9 ? 'Neo 原以为模拟中的伤害不会是真的。Morpheus 提醒他，意识让体验成为身体的现实。'
          : 'Neo 追问矩阵中的死亡。Morpheus 解释：身体无法离开意识继续生存。训练保护不适用于真实矩阵。';
  }
  if (training.kind === 'download') {
    if (!training.started) return '连接椅已经就位。按 G 请 Tank 开始上传训练程序。';
    return training.elapsed < 2.2 ? '颈后接口接通，Tank 正在校验神经信号。'
      : training.elapsed < 6.8 ? '动作、呼吸与重心变化以不属于记忆的速度进入意识。'
      : training.elapsed < 9 ? '手指与眼球出现细小反应；身体正在把程序知识变成可调用的动作。'
      : 'Neo 睁开眼睛，说自己已经学会功夫。Morpheus 走到椅旁，托腮观察：现在到道场里证明身体能跟上。';
  }
  if (training.kind === 'jump') {
    if (!training.started) return 'Morpheus 站在起跳线旁。按 G 观察他如何放下对距离的恐惧。';
    const jump = jumpDemonstration(training.elapsed);
    return training.elapsed < JUMP_PROGRAM.prepare ? 'Morpheus 让 Neo 放下恐惧、怀疑和对规则的依赖，随后转向屋顶边缘。'
      : jump.running ? 'Morpheus 加速助跑，踏向屋顶边缘。'
        : jump.airborne ? '他越过街谷，落点远超普通身体的极限。'
          : 'Morpheus 屈膝落地、站稳并转身看向 Neo。现在轮到你亲自助跑、起跳并承担失败。';
  }
  if (!training.started) return '人群仍在流动。按 G 开始注意力测试，亲自判断刚才忽略了什么。';
  return training.elapsed < 3.8 ? '迎面的人群不断换位。红裙女子逆着行人向你走来。'
    : training.elapsed < 5.8 ? '你的视线跟随红色。Morpheus 让训练程序在这一刻停住。'
    : training.elapsed < 8.8 ? '你转回身。刚才的普通行人已经成为举枪的 Smith。'
    : '冻结解除。任何尚未醒来的人，都可能成为系统进入现场的通道。';
}

export function trainingRoot(training: TrainingPerformance, role: TrainingRole): { x: number; y: number; z: number; yaw: number } {
  if (training.kind === 'jump_fall') return role === 'neo' ? jumpImpactPose(training.fall!, training.elapsed)
    : { ...JUMP_PROGRAM.finish, y: 0, yaw: .115 };
  if (training.kind === 'jump_return') return role === 'neo' ? { ...CABIN.chair, y: 0 }
    : role === 'tank' ? { ...DOWNLOAD_OPERATOR, y: 0 }
      : { x: 1.8, y: 0, z: -8, yaw: Math.atan2(CABIN.chair.x - 1.8, CABIN.chair.z + 8) };
  if (training.kind === 'download') {
    if (role === 'morpheus') {
      const path = DOWNLOAD_INVITATION, walk = smooth((training.elapsed - path.start) / path.duration);
      const x = path.from.x + (path.to.x - path.from.x) * walk, z = path.from.z + (path.to.z - path.from.z) * walk;
      const turn = smooth((training.elapsed - 8.8) / .6), heading = Math.atan2(path.to.x - path.from.x, path.to.z - path.from.z);
      return { x, y: 0, z, yaw: heading + (Math.atan2(CABIN.chair.x - x, CABIN.chair.z - z) - heading) * turn };
    }
    const root = role === 'tank' ? DOWNLOAD_CHAIR.tank : DOWNLOAD_CHAIR.neo;
    return { ...root, y: 0 };
  }
  if (training.kind === 'jump') {
    if (role === 'neo') return { ...JUMP_PROGRAM.neo, y: 0 };
    const jump = jumpDemonstration(training.elapsed);
    return { x: jump.x, y: jump.y, z: jump.z, yaw: jump.yaw };
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
