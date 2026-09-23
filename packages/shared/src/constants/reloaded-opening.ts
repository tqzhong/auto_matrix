import type { FilmJourney } from './film-story.js';

export type ReloadedPhase = 'approach' | 'window_ready' | 'breaking' | 'falling' | 'dream_hit'
  | 'waking' | 'talk_ready' | 'talking' | 'connect_ready' | 'connecting' | 'report_ready' | 'report'
  | 'earpiece_ready' | 'earpiece' | 'evacuate_ready' | 'breach' | 'combat' | 'departure_ready' | 'departing' | 'failed' | 'done';
export interface ReloadedOpening {
  kind: 'dream' | 'meeting'; phase: ReloadedPhase; elapsed: number; attempt: number;
  shots: number[]; missed: number[]; drift: number; shotAge: number;
  exit?: 'east' | 'west'; evacuated: boolean; evacuation: number;
  hits: number[]; opponent: number; cycle: number; round: number; evaded: boolean; countered: boolean;
  dodgeCooldown: number; dodgeAge: number; punchAge: number; punchResolved: boolean;
}
export type ReloadedGesture = ReloadedOpening & { role: string };
export const RELOADED = {
  breakGlass: 1.15, fall: 7.4, impact: 1.1, dreamShots: [1.3, 3.2, 5.1], shotWindow: .65,
  wake: 2.8, conversation: 5.5, connect: 2.2, report: 8.6, earpiece: 3.2, breach: 3.6, evacuation: 9,
  strike: 1.65, recovery: 1.25, dodgeWindow: .48, departure: 4.5,
  agents: ['agent_thompson', 'agent_jackson', 'agent_johnson'],
  cast: ['neo', 'trinity', 'morpheus', 'link', 'niobe', 'ballard', 'ghost', 'soren', 'smith', 'agent_thompson', 'agent_jackson', 'agent_johnson'],
} as const;
// Shared with collision; the hall and alley connect through a real opening.
export const RELOADED_WALLS = [
  ...[-1, 1].flatMap(side => [
    { x: side * 13, z: -4, width: .7, depth: 48, height: 13 },
    { x: side * 13, z: 33, width: .7, depth: 4, height: 13 },
    { x: side * 8.5, z: -20, width: 9, depth: .7, height: 13 },
  ]),
  { x: 0, z: 36, width: 26, depth: .7, height: 13 },
];
export const RELOADED_TABLE = { x: 0, z: 20, width: 10, depth: 3.2, height: 2.6 };
export const DREAM_CABINETS = [-1, 1].flatMap(side => [-5, 9, 23].map(z => ({ x: side * 10, z, width: 4, depth: 6, height: 5.8 })));
export function newReloaded(kind: ReloadedOpening['kind']): ReloadedOpening {
  return { kind, phase: kind === 'dream' ? 'approach' : 'waking', elapsed: 0, attempt: 0, shots: [], missed: [], drift: 0, shotAge: 10,
    evacuated: false, evacuation: 0, hits: [0, 0, 0], opponent: 0, cycle: 0, round: 0, evaded: false, countered: false,
    dodgeCooldown: 0, dodgeAge: 10, punchAge: 10, punchResolved: true };
}
export function reloadedPhaseLocked(state?: ReloadedOpening): boolean {
  return Boolean(state && (state.kind === 'dream' && ['breaking', 'falling', 'dream_hit', 'done'].includes(state.phase)
    || ['waking', 'talk_ready', 'talking', 'connect_ready', 'connecting', 'report', 'earpiece', 'breach', 'departing', 'done'].includes(state.phase)));
}
export function reloadedLocked(journey: FilmJourney): boolean { return !journey.visiting && reloadedPhaseLocked(journey.reloaded); }
export function reloadedText(state: ReloadedOpening): string {
  switch (state.phase) {
    case 'approach': return 'Trinity 的预感视角。穿过电网维护层，寻找尽头的玻璃窗。';
    case 'window_ready': return '楼梯已被特工封住。G 破窗跃出；这是 Neo 反复看见的梦。';
    case 'breaking': return '玻璃向夜空裂开。Trinity 转身，对准追出窗口的特工。';
    case 'falling': return `F 在准星收拢时还击 · A / D 调整坠落姿态 · 按住 G 延长观察。已记住 ${state.shots.length}/3 个细节。`;
    case 'dream_hit': return '最后一发子弹穿过梦境。预感中的结局，还不是现实中已经发生的事。';
    case 'waking': return 'Neo 从噩梦中惊醒。飞船里没有枪声，只有通风管道的低鸣。';
    case 'talk_ready': return 'Trinity 来到餐桌旁。G 回应她，把心里的不安说出来。';
    case 'talking': return 'Neo 担心自己看见了未来。Trinity 提醒他：在先知来电以前，仍要继续做自己的选择。';
    case 'connect_ready': return 'Link 已接好广播线路。G 接入船长们的秘密会议。';
    case 'connecting': return 'Link 开启广播。正在接入 Matrix 的地下交通通道。';
    case 'report_ready': return '走到长桌近侧，G 核对 Niobe 带来的地热图与撤回命令。';
    case 'report': return state.elapsed < 3 ? 'Niobe：地热与震动记录相符，机器正在向锡安钻进。预计约 72 小时。'
      : state.elapsed < 6 ? 'Morpheus：舰队回城补给，但需要一艘船留下等先知的消息。' : 'Ballard 接下值守任务，期限 36 小时。Neo 察觉到入口外的异常。';
    case 'earpiece_ready': return 'Smith 在入口留下了信封。到铁门内侧，G 查看那份“礼物”。';
    case 'earpiece': return '信封里是一枚断开的特工耳机。离开的程序没有消失，门外还有新的追兵。';
    case 'evacuate_ready': return '先通知船员撤离。G 选择西侧出口；J 可改选东侧。Neo 留在入口掩护。';
    case 'breach': return '铁门连续凹陷。船员撤向你指定的出口，三名新型号特工破门进入。';
    case 'combat': return state.cycle < .75 && state.round % 2 === 1 ? '特工先做佯攻。别急着闪避，等他真正跨步。'
      : state.cycle < RELOADED.strike - RELOADED.dodgeWindow ? '观察特工肩膀与脚步。普通正面攻击会被抓住；等到冲拳时按 X。'
      : state.cycle < RELOADED.strike ? '现在按 X 避开冲拳！随后贴近，用 F 反击。'
      : state.evaded && !state.countered ? '防线露出空隙。面向特工并靠近，F 反击！' : '保持距离，等待下一次真实起手。';
    case 'departure_ready': return state.evacuated ? '三名特工已被击退，船员已到出口。G 飞离现场，让 Link 接应回航。' : '特工已被击退，守住入口，等待最后的船员到达出口。';
    case 'departing': return 'Neo 飞入夜空。Link 确认船员撤离，尼布甲尼撒号准备返回锡安。';
    case 'failed': return '掩护失败。G 从铁门破开后的检查点重试；会议情报与出口选择保留。';
    default: return state.kind === 'dream' ? '梦境停在枪声里。G 回到醒着的 Neo。' : '船员安全撤离。耳机、值守约定与这场异常已经写入手记。';
  }
}
const smooth = (value: number) => { const t = Math.max(0, Math.min(1, value)); return t * t * (3 - 2 * t); };
export function reloadedRoot(state: ReloadedOpening, role: string) {
  const dream = (x: number, y: number, z: number, yaw: number) => ({ set: 'film_trinity_roof', x, y, z, yaw });
  const hall = (x: number, y: number, z: number, yaw: number) => ({ set: 'film_captains_meeting', x, y, z, yaw });
  const ship = (x: number, y: number, z: number, yaw: number) => ({ set: 'film_neb_deck', x, y, z, yaw });
  if (state.kind === 'dream') {
    const t = state.phase === 'falling' ? state.elapsed : ['dream_hit', 'done'].includes(state.phase) ? RELOADED.fall : 0;
    if (role === 'trinity') return state.phase === 'breaking' ? dream(0, Math.sin(state.elapsed / RELOADED.breakGlass * Math.PI) * 1.1, -15 - 9 * smooth(state.elapsed / RELOADED.breakGlass), Math.PI * (1 - smooth(state.elapsed / RELOADED.breakGlass)))
      : dream(state.drift, -1.15 * t * t, -24 - t * .55, 0);
    return dream(1.5, 3 - 1.15 * Math.max(0, t - .8) ** 2, -21 - t * .55, Math.PI);
  }
  if (['waking', 'talk_ready', 'talking', 'connect_ready', 'connecting'].includes(state.phase)) {
    if (role === 'neo') return state.phase === 'waking' ? ship(11.3, -.05, 32, -Math.PI / 2) : ship(-7, -.05, 25.7, Math.PI);
    if (role === 'trinity') return ship(-11, -.05, 25.7, Math.PI / 2);
    return ship(1.8, 0, 18, -1.1);
  }
  if (role === 'neo') {
    if (state.phase === 'report') return hall(0, 0, 14.5, 0);
    if (state.phase === 'earpiece') return hall(0, 0, -14, Math.PI);
    if (state.phase === 'departing' || state.phase === 'done') { const p = state.phase === 'done' ? 1 : smooth(state.elapsed / RELOADED.departure); return hall(0, p * 25, -24 - p * 10, Math.PI); }
    return hall(0, 0, -9, Math.PI);
  }
  const index = RELOADED.agents.indexOf(role as typeof RELOADED.agents[number]);
  if (index >= 0) {
    const entry = state.phase === 'breach' ? smooth((state.elapsed - 2.3) / (RELOADED.breach - 2.3)) : 1;
    const spread = 2 + 2.7 * smooth((entry - .9) / .1);
    return hall((index - 1) * spread, 0, -24 + 7 * entry - Math.abs(index - 1), 0);
  }
  if (role === 'smith') return hall(0, 0, -28, 0);
  const cast = ['trinity', 'morpheus', 'niobe', 'ballard', 'ghost', 'soren']; const i = Math.max(0, cast.indexOf(role));
  const x = i < 2 ? i ? -7 : 7 : (i % 2 ? -1 : 1) * (3.7 + Math.floor(i / 2) * 2.4); const z = i < 2 ? 15 : 24 + (i % 2) * 3;
  const evacuation = state.exit ? smooth(state.evacuation / RELOADED.evacuation) : 0;
  // Clear the end of the table before crossing to the selected side exit.
  const runZ = z + (29 - z) * Math.min(1, evacuation * 2);
  const runX = x + ((state.exit === 'east' ? 18.5 + i * .4 : -18.5 - i * .4) - x) * Math.max(0, evacuation * 2 - 1);
  return hall(runX, 0, runZ + evacuation * (i - 2.5) * .8, evacuation > .5 ? state.exit === 'east' ? Math.PI / 2 : -Math.PI / 2 : state.exit ? 0 : Math.atan2(-x, 20 - z));
}
export function reloadedPose(gesture: ReloadedGesture) {
  const falling = gesture.kind === 'dream' && ['falling', 'dream_hit', 'done'].includes(gesture.phase);
  const enemy = RELOADED.agents.includes(gesture.role as typeof RELOADED.agents[number]);
  const active = gesture.role === RELOADED.agents[gesture.opponent];
  const windup = gesture.phase === 'combat' && enemy && active ? smooth((gesture.cycle - .8) / .7) * (1 - smooth((gesture.cycle - RELOADED.strike) / .3)) : 0;
  return { falling: falling ? 1 : 0, dreamAgent: falling && enemy ? 1 : 0, aim: falling ? 1 : 0,
    seated: ['waking', 'talk_ready', 'talking', 'connect_ready'].includes(gesture.phase) && gesture.role !== 'link' ? 1 : 0,
    windup, strike: gesture.phase === 'combat' && enemy && active ? Math.sin(Math.min(1, Math.max(0, (gesture.cycle - RELOADED.strike + .1) / .5)) * Math.PI) : 0, punch: gesture.phase === 'combat' && gesture.role === 'neo' ? Math.sin(Math.min(1, gesture.punchAge / .5) * Math.PI) : 0,
    dodge: gesture.role === 'neo' ? 1 - smooth(gesture.dodgeAge / .55) : 0,
    inspect: gesture.role === 'neo' && gesture.phase === 'earpiece' ? 1 : 0,
    flight: gesture.role === 'neo' && ['departing', 'done'].includes(gesture.phase) ? gesture.phase === 'done' ? 1 : smooth(gesture.elapsed / 1.5) : 0,
    down: enemy && gesture.hits[RELOADED.agents.indexOf(gesture.role as typeof RELOADED.agents[number])] >= 2 ? 1 : 0 };
}
