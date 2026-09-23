import type { FilmJourney } from './film-story.js';

export type TheOneKind = 'death' | 'return' | 'flight';
export type TheOnePhase = 'ready' | 'ambush' | 'gunfire' | 'flatline' | 'listening' | 'kiss' | 'revive'
  | 'code_reveal' | 'bullet_window' | 'bullet_stop' | 'counter' | 'dive' | 'burst' | 'exit_run' | 'exit_ready'
  | 'exit_phone' | 'emp' | 'call_ready' | 'call' | 'takeoff_ready' | 'takeoff' | 'failed' | 'done';
export type TheOneCheckpoint = 'door' | 'bullets' | 'exit' | 'phone';
export type TheOneRole = 'neo' | 'smith' | 'agent_brown' | 'agent_jones' | 'trinity' | 'morpheus' | 'tank';

export interface TheOneEncounter {
  kind: TheOneKind;
  phase: TheOnePhase;
  elapsed: number;
  attempt: number;
  checkpoint: TheOneCheckpoint;
  signal: number;
  hits: number;
  blocks: number;
  deadline: number;
  altitude: number;
  flightX: number;
  flightZ: number;
  resolved: number[];
  bulletStopped?: boolean;
  smithBurst?: boolean;
  empFired?: boolean;
}

export type TheOneGesture = TheOneEncounter & { role: TheOneRole };
export interface TheOneRoot { set: 'film_heart_hotel' | 'film_neb_deck' | 'film_final_phone'; x: number; y: number; z: number; yaw: number }

export const THE_ONE = {
  death: { ambush: 1.6, gunfire: 2.1, flatline: 1.3, listen: 3.2, kiss: 2.35, revive: 2.8 },
  return: {
    reveal: 2.2, bulletDuration: 3.1, bulletBeat: 1.7, bulletWindow: .62, bulletStop: 2.7,
    requiredHits: 3, requiredBlocks: 1, dive: 2.15, burst: 2.45, exitDeadline: 12, exitPhone: 1.5, emp: 2.9,
  },
  flight: { call: 5.4, takeoff: 7.2, maxAltitude: 34, speed: 8 },
} as const;

const clamp = (value: number): number => Math.max(0, Math.min(1, value));
const smooth = (value: number): number => { const t = clamp(value); return t * t * (3 - 2 * t); };
const pulse = (time: number, center: number, radius: number): number => smooth(1 - Math.abs(time - center) / radius);

export function theOnePhaseLocked(encounter?: TheOneEncounter): boolean {
  if (!encounter) return false;
  return ['ambush', 'gunfire', 'flatline', 'listening', 'kiss', 'revive', 'code_reveal', 'bullet_window', 'bullet_stop',
    'dive', 'burst', 'exit_phone', 'emp', 'call', 'takeoff_ready', 'takeoff'].includes(encounter.phase);
}

export function theOneLocked(journey: FilmJourney): boolean {
  return !journey.visiting && theOnePhaseLocked(journey.theOne);
}

export function theOneDuration(encounter: TheOneEncounter): number {
  if (encounter.kind === 'death') return ({ ambush: THE_ONE.death.ambush, gunfire: THE_ONE.death.gunfire,
    flatline: THE_ONE.death.flatline, kiss: THE_ONE.death.kiss, revive: THE_ONE.death.revive } as Partial<Record<TheOnePhase, number>>)[encounter.phase] ?? 0;
  if (encounter.kind === 'return') return ({ code_reveal: THE_ONE.return.reveal, bullet_window: THE_ONE.return.bulletDuration,
    bullet_stop: THE_ONE.return.bulletStop, dive: THE_ONE.return.dive, burst: THE_ONE.return.burst,
    exit_phone: THE_ONE.return.exitPhone, emp: THE_ONE.return.emp } as Partial<Record<TheOnePhase, number>>)[encounter.phase] ?? 0;
  return ({ call: THE_ONE.flight.call, takeoff: THE_ONE.flight.takeoff } as Partial<Record<TheOnePhase, number>>)[encounter.phase] ?? 0;
}

export function theOneText(encounter: TheOneEncounter): string {
  if (encounter.kind === 'death') {
    if (encounter.phase === 'ready') return '303 房间的出口电话正在响。走到房门前，亲手打开最后一道门。';
    if (encounter.phase === 'ambush') return '房门打开。Smith 已经在 303 内等候，手枪正对着 Neo。';
    if (encounter.phase === 'gunfire') return '枪声穿过走廊。Neo 的 Matrix 身体失去支撑，飞船上的生命监视器归零。';
    if (encounter.phase === 'flatline') return '现实世界只剩平直的监视音。Trinity 抓住连接椅里的 Neo。';
    if (encounter.phase === 'listening') return `按住 G 穿过平直信号，追随 Trinity 的声音。连接 ${Math.round(encounter.signal * 100)}%。`;
    if (encounter.phase === 'kiss') return 'Trinity 完成没有说完的承诺。真实身体的心跳重新出现。';
    if (encounter.phase === 'revive') return '监视器恢复脉冲。Neo 在旅馆走廊睁开眼睛，重新站起。';
    return 'Neo 已从 303 房间的枪击中回来。';
  }
  if (encounter.kind === 'return') {
    if (encounter.phase === 'ready') return '三名特工同时拔枪。按 G 看穿走廊与子弹背后的代码。';
    if (encounter.phase === 'code_reveal') return '墙纸、门框和特工的轮廓退去，只剩不断流动的 Matrix 代码。';
    if (encounter.phase === 'bullet_window') return '弹群正在减速。子弹进入伸手可及的代码层时按 X 停住它们。';
    if (encounter.phase === 'bullet_stop') return '子弹悬在空中。Neo 取下一枚观察，然后让整片弹群落地。';
    if (encounter.phase === 'counter') return `Smith 正面冲来。读懂起手后按 X 格挡，再用 F 反击。格挡 ${encounter.blocks}/${THE_ONE.return.requiredBlocks}，反击 ${encounter.hits}/${THE_ONE.return.requiredHits}。`;
    if (encounter.phase === 'dive') return 'Smith 被击退。Neo 加速冲刺，直接进入这段程序的身体。';
    if (encounter.phase === 'burst') return 'Smith 的外壳被内部代码撕开，碎片被 Matrix 吸收。其余特工转身逃走。';
    if (encounter.phase === 'exit_run') return `飞船外壳正在被切开。前往响铃的出口电话，剩余 ${Math.max(0, Math.ceil(THE_ONE.return.exitDeadline - encounter.deadline))} 秒。`;
    if (encounter.phase === 'exit_ready') return '出口电话就在走廊尽头。按 G 接听，让现实中的 Morpheus 可以启动 EMP。';
    if (encounter.phase === 'exit_phone') return 'Neo 抓住响铃的听筒，Matrix 身体正在退出。';
    if (encounter.phase === 'emp') return '确认 Neo 已离线后，Morpheus 转动钥匙。EMP 白光穿过船体与哨兵群。';
    if (encounter.phase === 'failed') return encounter.checkpoint === 'exit'
      ? '出口倒计时耗尽，哨兵切入核心舱。按 G 从 Smith 消失后的走廊重试。'
      : '弹群穿过了尚未稳定的代码视野。按 G 从看见代码前重试。';
    return 'Neo 已离开 Matrix，EMP 清除了贴在船体上的哨兵。';
  }
  if (encounter.phase === 'ready') return '先在手记中决定：看见规则之后，要用这份力量打开什么？';
  if (encounter.phase === 'call_ready') return '街角电话已经接通。走近听筒，按 G 向系统说出你的选择。';
  if (encounter.phase === 'call') return '追踪程序再次运行。Neo 不再隐藏，并把一个仍可改变的世界交还给其中的人。';
  if (encounter.phase === 'takeoff_ready') return '放下听筒，走出电话亭。按住空格离地，WASD 在上升中调整方向。';
  if (encounter.phase === 'takeoff') return `城市正在脚下缩小。高度 ${Math.round(encounter.altitude)} / ${THE_ONE.flight.maxAltitude} 米。`;
  return 'Neo 飞越城市上空。第一部的选择已经写入这个世界。';
}

export function theOneRoot(encounter: TheOneEncounter, role: TheOneRole): TheOneRoot {
  const hotel = (x: number, y: number, z: number, yaw: number): TheOneRoot => ({ set: 'film_heart_hotel', x, y, z, yaw });
  const ship = (x: number, y: number, z: number, yaw: number): TheOneRoot => ({ set: 'film_neb_deck', x, y, z, yaw });
  const street = (x: number, y: number, z: number, yaw: number): TheOneRoot => ({ set: 'film_final_phone', x, y, z, yaw });
  if (encounter.kind === 'death') {
    const real = ['flatline', 'listening', 'kiss'].includes(encounter.phase) || encounter.phase === 'revive' && encounter.elapsed < THE_ONE.death.revive * .48;
    if (real) {
      if (role === 'neo') return ship(6.5, .45, -5, -Math.PI / 2);
      if (role === 'trinity') return ship(encounter.phase === 'kiss' ? 5 : 2.8, 0, -5, Math.PI / 2);
      if (role === 'morpheus') return ship(-1.2, 0, -8, .65);
      if (role === 'tank') return ship(10.5, 0, 1.5, -2.6);
      return hotel(role === 'smith' ? 0 : 4, 0, role === 'smith' ? -21 : -24, 0);
    }
    if (role === 'neo') {
      const fall = encounter.phase === 'gunfire' ? smooth(encounter.elapsed / THE_ONE.death.gunfire) : 0;
      return hotel(0, fall * .12, -15.5 + fall * 1.2, Math.PI);
    }
    if (role === 'smith') return hotel(0, 0, -20.5, 0);
    if (role === 'agent_brown') return hotel(4, 0, -23.5, -.25);
    if (role === 'agent_jones') return hotel(-4, 0, -24.5, .25);
    if (role === 'trinity') return ship(2.8, 0, -5, Math.PI / 2);
    if (role === 'morpheus') return ship(-1.2, 0, -8, .65);
    return ship(10.5, 0, 1.5, -2.6);
  }
  if (encounter.kind === 'return') {
    if (encounter.phase === 'emp' || encounter.phase === 'done') {
      if (role === 'neo') return ship(6.5, .45, -5, -Math.PI / 2);
      if (role === 'trinity') return ship(2.8, 0, -5, Math.PI / 2);
      if (role === 'morpheus') return ship(-2.5, 0, -1.8, 1.35);
      if (role === 'tank') return ship(10.5, 0, 1.5, -2.6);
    }
    if (role === 'neo') {
      if (encounter.phase === 'dive') { const p = smooth(encounter.elapsed / THE_ONE.return.dive); return hotel(0, Math.sin(p * Math.PI) * .7, -9.5 - p * 11.2, Math.PI); }
      if (encounter.phase === 'burst') return hotel(0, 0, -20.7, Math.PI);
      if (encounter.phase === 'exit_ready' || encounter.phase === 'exit_phone') return hotel(0, 0, -20, Math.PI);
      return hotel(0, 0, -9.5, Math.PI);
    }
    if (role === 'smith') return hotel(0, 0, -20.7, 0);
    if (role === 'agent_brown') return hotel(-5, 0, -23.5, .18);
    if (role === 'agent_jones') return hotel(5, 0, -24.5, -.18);
    if (role === 'trinity') return ship(2.8, 0, -5, Math.PI / 2);
    if (role === 'morpheus') return ship(-2.5, 0, -1.8, 1.35);
    return ship(10.5, 0, 1.5, -2.6);
  }
  if (role !== 'neo') return street(role === 'smith' ? -9 : 9, 0, 4, Math.PI);
  if (encounter.phase === 'takeoff' || encounter.phase === 'done') {
    const p = encounter.phase === 'done' ? 1 : smooth(encounter.elapsed / THE_ONE.flight.takeoff);
    return street(encounter.flightX, encounter.altitude, -25 - p * 42 + encounter.flightZ, Math.PI);
  }
  return street(0, 0, -25, Math.PI);
}

export function theOnePose(gesture: TheOneGesture) {
  const wound = gesture.phase === 'gunfire' && gesture.role === 'neo' ? smooth(gesture.elapsed / THE_ONE.death.gunfire) : 0;
  const fallen = ['flatline', 'listening', 'kiss'].includes(gesture.phase) && gesture.role === 'neo' ? 1 : 0;
  const kiss = gesture.phase === 'kiss' && gesture.role === 'trinity' ? smooth(gesture.elapsed / (THE_ONE.death.kiss * .72)) : 0;
  const revive = gesture.phase === 'revive' && gesture.role === 'neo' ? pulse(gesture.elapsed, THE_ONE.death.revive * .58, THE_ONE.death.revive * .5) : 0;
  const aim = (gesture.phase === 'ambush' || gesture.phase === 'gunfire') && gesture.role === 'smith' ? smooth(gesture.elapsed / .35) : 0;
  const stop = gesture.phase === 'bullet_stop' && gesture.role === 'neo' ? smooth(gesture.elapsed / .7) : 0;
  const block = gesture.phase === 'counter' && gesture.role === 'neo' && gesture.blocks > 0 ? 1 : 0;
  const dive = gesture.phase === 'dive' && gesture.role === 'neo' ? smooth(gesture.elapsed / THE_ONE.return.dive) : 0;
  const burst = gesture.phase === 'burst' && gesture.role === 'smith' ? pulse(gesture.elapsed, 1.15, 1.1) : 0;
  const phone = (gesture.phase === 'exit_phone' || gesture.phase === 'call') && gesture.role === 'neo' ? 1 : 0;
  const flight = gesture.role === 'neo' && (gesture.phase === 'takeoff' || gesture.phase === 'done')
    ? gesture.phase === 'done' ? 1 : smooth(gesture.elapsed / THE_ONE.flight.takeoff) : 0;
  return { wound, fallen, kiss, revive, aim, stop, block, dive, burst, phone, flight };
}
