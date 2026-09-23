import type { FilmJourney } from './film-story.js';

export type MatrixEscapeKind = 'subway' | 'city';
export type MatrixEscapePhase = 'ready' | 'phone_shot' | 'stance' | 'duel' | 'wall_break' | 'tracks' | 'train_window'
  | 'train_escape' | 'body_swap' | 'briefing' | 'running' | 'phone_failure' | 'truck_warning' | 'truck_window'
  | 'possession' | 'door_ready' | 'door' | 'failed' | 'done';
export type MatrixEscapeRole = 'neo' | 'smith' | 'citizen_13' | 'citizen_14';

export interface MatrixEscapeEncounter {
  kind: MatrixEscapeKind;
  phase: MatrixEscapePhase;
  elapsed: number;
  attempt: number;
  checkpoint: 'duel' | 'tracks' | 'street';
  hits: number;
  dodges: number;
  pursuit: number;
  segment: number;
  possessions: number;
  resolved: number[];
  host?: 'citizen_13' | 'citizen_14';
  phoneBroken?: boolean;
  wallBroken?: boolean;
  trainHit?: boolean;
  truckHit?: boolean;
}

export type MatrixEscapeGesture = MatrixEscapeEncounter & { role: MatrixEscapeRole };

export const MATRIX_ESCAPE = {
  subway: {
    phoneShot: 1.8,
    stance: 1.8,
    requiredHits: 4,
    requiredDodges: 1,
    wallBreak: 2.4,
    tracks: 1.5,
    trainDuration: 4.1,
    trainBeat: 2.7,
    trainWindow: .7,
    escape: 2.6,
    bodySwap: 2.8,
  },
  city: {
    briefing: 2.2,
    phoneFailure: 2.6,
    truckWarning: 1.4,
    truckDuration: 3.5,
    truckBeat: 2.15,
    truckWindow: .62,
    possession: 2.3,
    door: 2.1,
    pursuitIdle: .13,
    pursuitMoving: .045,
    pursuitSprint: .14,
  },
} as const;

const clamp = (value: number): number => Math.max(0, Math.min(1, value));
const smooth = (value: number): number => { const t = clamp(value); return t * t * (3 - 2 * t); };
const pulse = (time: number, center: number, radius: number): number => smooth(1 - Math.abs(time - center) / radius);

export function matrixEscapePhaseLocked(encounter?: MatrixEscapeEncounter): boolean {
  if (!encounter) return false;
  return ['phone_shot', 'stance', 'wall_break', 'tracks', 'train_window', 'train_escape', 'body_swap', 'briefing',
    'phone_failure', 'truck_warning', 'truck_window', 'possession', 'door'].includes(encounter.phase);
}

export function matrixEscapeLocked(journey: FilmJourney): boolean {
  const encounter = journey.matrixEscape;
  if (!encounter || journey.visiting) return false;
  return matrixEscapePhaseLocked(encounter);
}

export function matrixEscapeDuration(encounter: MatrixEscapeEncounter): number {
  if (encounter.kind === 'subway') return ({
    phone_shot: MATRIX_ESCAPE.subway.phoneShot,
    stance: MATRIX_ESCAPE.subway.stance,
    wall_break: MATRIX_ESCAPE.subway.wallBreak,
    tracks: MATRIX_ESCAPE.subway.tracks,
    train_window: MATRIX_ESCAPE.subway.trainDuration,
    train_escape: MATRIX_ESCAPE.subway.escape,
    body_swap: MATRIX_ESCAPE.subway.bodySwap,
  } as Partial<Record<MatrixEscapePhase, number>>)[encounter.phase] ?? 0;
  return ({
    briefing: MATRIX_ESCAPE.city.briefing,
    phone_failure: MATRIX_ESCAPE.city.phoneFailure,
    truck_warning: MATRIX_ESCAPE.city.truckWarning,
    truck_window: MATRIX_ESCAPE.city.truckDuration,
    possession: MATRIX_ESCAPE.city.possession,
    door: MATRIX_ESCAPE.city.door,
  } as Partial<Record<MatrixEscapePhase, number>>)[encounter.phase] ?? 0;
}

export function matrixEscapeText(encounter: MatrixEscapeEncounter): string {
  if (encounter.kind === 'subway') {
    if (encounter.phase === 'ready') return '出口电话就在身后。按 G 接听线路；Smith 已经走上站台。';
    if (encounter.phase === 'phone_shot') return 'Smith 开枪击碎出口电话。线路中断，站台只剩列车风和脚步声。';
    if (encounter.phase === 'stance') return 'Neo 停住脚步，转身面对 Smith。这一次不再逃跑。';
    if (encounter.phase === 'duel') return `观察红色起手，按 X 闪避后用 F 反击。有效命中 ${encounter.hits}/${MATRIX_ESCAPE.subway.requiredHits}，闪避 ${encounter.dodges}/${MATRIX_ESCAPE.subway.requiredDodges}。`;
    if (encounter.phase === 'wall_break') return '最后一记重击把两人撞穿站台墙面。Smith 仍然起身，把战斗拖向轨道。';
    if (encounter.phase === 'tracks') return 'Smith 把 Neo 压在铁轨上。隧道里亮起列车头灯。';
    if (encounter.phase === 'train_window') return '列车逼近。头灯越过第三根立柱时按 X 翻回站台。';
    if (encounter.phase === 'train_escape') return 'Neo 蹬开 Smith，翻上站台。列车沿轨道吞没仍站在原地的特工。';
    if (encounter.phase === 'body_swap') return '人群中的身体被矩阵代码覆盖，Smith 再次抬头。击中一具身体并不能删除程序。';
    if (encounter.phase === 'failed') return encounter.checkpoint === 'tracks'
      ? 'Neo 没能脱离铁轨。按 G 从列车接近前的检查点重试。'
      : 'Smith 在站台上压倒了 Neo。按 G 从出口电话前重试。';
    return 'Neo 冲出站台；Smith 已经通过新的身体继续追踪。';
  }
  if (encounter.phase === 'ready') return 'Tank 已接通耳机。按 G 接收市场、后巷与旅馆 303 房间的撤离路线。';
  if (encounter.phase === 'briefing') return 'Tank 逐段报出路线：穿过市场，绕开封锁，再从旧旅馆的楼梯回到 303 房间。';
  if (encounter.phase === 'running') return `保持移动并用 Shift 奔跑。追捕压力 ${Math.round(encounter.pursuit * 100)}%；当前路线 ${encounter.segment + 1}/3。`;
  if (encounter.phase === 'phone_failure') return '电话刚响起就被子弹打断。附近行人的动作突然停住，代码开始改写他的身体。';
  if (encounter.phase === 'truck_warning') return 'Tank 警告前方路口被封。垃圾车冲进窄巷，驾驶座上的人已经不是原来的司机。';
  if (encounter.phase === 'truck_window') return '垃圾车封住整条巷道。靠近撞击线时按 X 侧翻穿过缺口。';
  if (encounter.phase === 'possession') return '追兵的身体失去作用；另一名路人立刻被绿色代码覆盖，Smith 从新的方向继续追来。';
  if (encounter.phase === 'door_ready') return 'Heart O’ the City 旅馆就在前方。走到 303 楼梯门前按 G，完成最后一段撤离。';
  if (encounter.phase === 'door') return 'Neo 冲进旧旅馆，沿熟悉的楼梯跑向 303 房间。身后的门框被追兵撞得震动。';
  if (encounter.phase === 'failed') return 'Smith 截断了这段撤离路线。按 G 从最近的街巷检查点重试。';
  return 'Neo 已进入旅馆；Tank 把最后一部出口电话的位置送入耳机。';
}

export function matrixEscapeRoot(encounter: MatrixEscapeEncounter, role: MatrixEscapeRole) {
  if (encounter.kind === 'subway') {
    if (encounter.phase === 'phone_shot') {
      const shot = smooth(encounter.elapsed / MATRIX_ESCAPE.subway.phoneShot);
      return role === 'neo' ? { x: -7, y: 0, z: 31.5 - shot * 2, yaw: Math.PI }
        : role === 'smith' ? { x: 1.5, y: 0, z: 22 + shot * 2, yaw: 0 }
          : { x: -8, y: 0, z: -27, yaw: 0 };
    }
    if (encounter.phase === 'stance') {
      const turn = smooth(encounter.elapsed / MATRIX_ESCAPE.subway.stance);
      return role === 'neo' ? { x: -3 + turn * 3, y: 0, z: 27 - turn * 17, yaw: Math.PI * (1 - turn) }
        : role === 'smith' ? { x: 0, y: 0, z: 2, yaw: 0 }
          : { x: -8, y: 0, z: -27, yaw: 0 };
    }
    if (encounter.phase === 'wall_break') {
      const crash = smooth(encounter.elapsed / MATRIX_ESCAPE.subway.wallBreak);
      return role === 'neo' ? { x: -9 - crash * 8.7, y: crash * .25, z: 1.4, yaw: -Math.PI / 2 }
        : role === 'smith' ? { x: -5.6 - crash * 11.5, y: crash * .2, z: .3, yaw: -Math.PI / 2 }
          : { x: -8, y: 0, z: -27, yaw: 0 };
    }
    if (encounter.phase === 'tracks' || encounter.phase === 'train_window') {
      const drop = encounter.phase === 'tracks' ? smooth(encounter.elapsed / MATRIX_ESCAPE.subway.tracks) : 1;
      return role === 'neo' ? { x: 16.4, y: -.45 * drop, z: -7, yaw: Math.PI / 2 }
        : role === 'smith' ? { x: 16.1, y: 0, z: -4.5 - drop * 1.2, yaw: Math.PI }
          : { x: -8, y: 0, z: -27, yaw: 0 };
    }
    if (encounter.phase === 'train_escape') {
      const leap = smooth(encounter.elapsed / MATRIX_ESCAPE.subway.escape);
      return role === 'neo' ? { x: 16.2 - leap * 7.4, y: Math.sin(leap * Math.PI) * 1.3, z: -7 - leap * 1.8, yaw: -Math.PI / 2 }
        : role === 'smith' ? { x: 16.2, y: 0, z: -5.7, yaw: Math.PI }
          : { x: -8, y: 0, z: -27, yaw: 0 };
    }
    if (encounter.phase === 'body_swap' || encounter.phase === 'done') {
      const host = role === 'citizen_13';
      return host ? { x: -8, y: 0, z: -27, yaw: 0 }
        : role === 'neo' ? { x: 8.5, y: 0, z: -12, yaw: Math.PI }
          : { x: 16.2, y: 0, z: -5.7, yaw: Math.PI };
    }
    return role === 'neo' ? { x: 0, y: 0, z: 10, yaw: Math.PI }
      : role === 'smith' ? { x: 0, y: 0, z: 2, yaw: 0 } : { x: -8, y: 0, z: -27, yaw: 0 };
  }

  if (encounter.phase === 'briefing') return role === 'neo' ? { x: 0, y: 0, z: 35, yaw: Math.PI } : { x: -12, y: 0, z: 23, yaw: 0 };
  if (encounter.phase === 'phone_failure') return role === 'neo' ? { x: -7, y: 0, z: 18, yaw: Math.PI }
    : role === 'citizen_13' ? { x: 3.5, y: 0, z: 15, yaw: -.7 } : { x: 7, y: 0, z: 10, yaw: 0 };
  if (encounter.phase === 'truck_warning' || encounter.phase === 'truck_window') return role === 'neo'
    ? { x: 7, y: 0, z: -12, yaw: Math.PI } : { x: -5, y: 0, z: -22, yaw: 0 };
  if (encounter.phase === 'possession') return role === 'neo' ? { x: 7, y: 0, z: -18, yaw: Math.PI }
    : role === 'citizen_14' ? { x: -8, y: 0, z: -28, yaw: -.5 } : { x: 5, y: 0, z: -24, yaw: 0 };
  if (encounter.phase === 'door' || encounter.phase === 'done') {
    const entry = encounter.phase === 'door' ? smooth(encounter.elapsed / MATRIX_ESCAPE.city.door) : 1;
    return role === 'neo' ? { x: 0, y: entry * 2.2, z: -42 - entry * 6, yaw: Math.PI }
      : { x: 4, y: 0, z: -35, yaw: Math.PI };
  }
  return role === 'neo' ? { x: 0, y: 0, z: 35, yaw: Math.PI } : { x: -10, y: 0, z: 24, yaw: 0 };
}

export function matrixEscapePose(gesture: MatrixEscapeGesture) {
  const phone = gesture.phase === 'phone_shot' && gesture.role === 'neo' ? 1 - smooth(gesture.elapsed / MATRIX_ESCAPE.subway.phoneShot) : 0;
  const aim = gesture.phase === 'phone_shot' && gesture.role === 'smith' ? smooth(gesture.elapsed / .35) : 0;
  const stance = gesture.phase === 'stance' ? smooth(gesture.elapsed / MATRIX_ESCAPE.subway.stance) : 0;
  const strike = gesture.phase === 'wall_break' && gesture.role === 'neo' ? pulse(gesture.elapsed, 1.15, .9) : 0;
  const wall = gesture.phase === 'wall_break' ? smooth(gesture.elapsed / MATRIX_ESCAPE.subway.wallBreak) : 0;
  const grapple = !['tracks', 'train_window'].includes(gesture.phase) ? 0 : gesture.role === 'smith' ? .9 : gesture.role === 'neo' ? .72 : 0;
  const leap = gesture.phase === 'train_escape' && gesture.role === 'neo' ? smooth(gesture.elapsed / MATRIX_ESCAPE.subway.escape) : 0;
  const transform = ['body_swap', 'possession'].includes(gesture.phase) && gesture.role === gesture.host
    ? pulse(gesture.elapsed, gesture.kind === 'subway' ? 1.35 : 1.05, 1.2) : 0;
  const brace = gesture.phase === 'truck_window' && gesture.role === 'neo'
    ? pulse(gesture.elapsed, MATRIX_ESCAPE.city.truckBeat, MATRIX_ESCAPE.city.truckWindow * 1.5) : 0;
  const door = gesture.phase === 'door' && gesture.role === 'neo' ? smooth(gesture.elapsed / MATRIX_ESCAPE.city.door) : 0;
  return { phone, aim, stance, strike, wall, grapple, leap, transform, brace, door };
}
