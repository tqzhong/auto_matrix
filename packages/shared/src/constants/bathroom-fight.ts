import type { Vector3 } from '../types/agent.js';

export type BathroomPhase = 'ready' | 'pinning' | 'breakout' | 'faceoff' | 'windup' | 'opening' | 'counter' | 'capture_ready' | 'capturing' | 'done' | 'failed';
export interface BathroomFight {
  phase: BathroomPhase; elapsed: number; held: number; grip: number; counters: number; evaded: boolean; headbutt: boolean; cooldown: number; paused?: boolean;
}
export type BathroomGesture = BathroomFight & { role: 'morpheus' | 'smith'; contact?: Vector3 };
export const BATHROOM_FIGHT = { pin: 4, breakout: 2.6, faceoff: 2.4, windup: .95, evadeFrom: .5, opening: .9, counter: .65, counters: 4, capture: 5.4,
  pinned: { morpheus: { x: -17.7, z: -25.8, yaw: Math.PI }, smith: { x: -17.7, z: -25.5, yaw: 0 } },
  standing: { morpheus: { x: -17.7, z: -28.25, yaw: 0 }, smith: { x: -17.7, z: -25.6, yaw: Math.PI } } } as const;
const smooth = (value: number): number => { const t = Math.max(0, Math.min(1, value)); return t * t * (3 - 2 * t); };
export function newBathroomFight(): BathroomFight { return { phase: 'ready', elapsed: 0, held: 0, grip: 1, counters: 0, evaded: false, headbutt: false, cooldown: 0 }; }

/** Counter windows use saved seconds rather than simulation ticks or client animation clocks. */
export function stepBathroomFight(fight: BathroomFight, gripping: boolean, dt: number): number {
  if (fight.paused || ['ready', 'failed', 'done', 'capture_ready'].includes(fight.phase) || dt <= 0) return 0;
  const delta = Math.min(.1, dt); let damage = 0;
  fight.elapsed += delta; fight.cooldown = Math.max(0, fight.cooldown - delta);
  const next = (phase: BathroomPhase) => { fight.phase = phase; fight.elapsed = 0; };
  if (fight.phase === 'pinning') {
    fight.grip = Math.max(0, Math.min(1, fight.grip + delta * (gripping ? .65 : -.5)));
    if (gripping) fight.held = Math.min(BATHROOM_FIGHT.pin, fight.held + delta);
    if (fight.grip <= .001) next('failed');
    else if (fight.held >= BATHROOM_FIGHT.pin - .001) next('breakout');
  } else if (fight.phase === 'breakout' && fight.elapsed >= BATHROOM_FIGHT.breakout) { damage = fight.headbutt ? 0 : 12; next('faceoff'); }
  else if (fight.phase === 'faceoff' && fight.elapsed >= BATHROOM_FIGHT.faceoff) next('windup');
  else if (fight.phase === 'windup' && fight.elapsed >= BATHROOM_FIGHT.windup) { damage = fight.evaded ? 0 : 24; next('opening'); }
  else if (fight.phase === 'opening' && fight.elapsed >= BATHROOM_FIGHT.opening) { damage = 6; fight.evaded = false; next('windup'); }
  else if (fight.phase === 'counter' && fight.elapsed >= BATHROOM_FIGHT.counter) { fight.evaded = false; next(fight.counters >= BATHROOM_FIGHT.counters ? 'capture_ready' : 'windup'); }
  else if (fight.phase === 'capturing' && fight.elapsed >= BATHROOM_FIGHT.capture) next('done');
  return damage;
}
export function bathroomFightAction(fight: BathroomFight, kind: string): { damage: number; impact?: boolean } {
  if (fight.paused || fight.cooldown > 0) return { damage: 0 };
  if (kind === 'dodge' && fight.phase === 'windup' && fight.elapsed >= BATHROOM_FIGHT.evadeFrom && !fight.evaded) {
    fight.evaded = true; fight.cooldown = .2; return { damage: 0 };
  }
  if (kind !== 'attack') return { damage: 0 };
  fight.cooldown = .3;
  if (fight.phase === 'breakout' && fight.elapsed >= .55 && fight.elapsed <= 1.3) { fight.headbutt = true; return { damage: 0, impact: true }; }
  if (fight.phase === 'opening' && fight.evaded) {
    fight.counters++; fight.phase = 'counter'; fight.elapsed = 0; return { damage: 0, impact: true };
  }
  return { damage: ['windup', 'opening'].includes(fight.phase) ? 6 : 0 };
}
export function bathroomFightRoot(fight: BathroomFight, role: BathroomGesture['role']) {
  const start = BATHROOM_FIGHT.pinned[role], end = BATHROOM_FIGHT.standing[role];
  const standing = ['ready', 'pinning', 'failed'].includes(fight.phase) ? 0 : fight.phase === 'breakout' ? smooth((fight.elapsed - 1.2) / 1.4) : 1;
  const root = { x: start.x + (end.x - start.x) * standing, z: start.z + (end.z - start.z) * standing, yaw: start.yaw + (end.yaw - start.yaw) * standing };
  if (fight.phase === 'counter') root.z += (role === 'morpheus' ? 1.1 : .25) * Math.sin(Math.min(1, fight.elapsed / BATHROOM_FIGHT.counter) * Math.PI);
  if (role === 'smith' && fight.phase === 'windup') root.z -= smooth(fight.elapsed / BATHROOM_FIGHT.windup) * .65;
  if (role === 'smith' && fight.phase === 'opening') root.z -= (1 - smooth(fight.elapsed / .35)) * .65;
  if (role === 'morpheus' && fight.evaded && ['windup', 'opening'].includes(fight.phase)) root.x -= .7 * (fight.phase === 'windup' ? smooth((fight.elapsed - .5) / .45) : 1 - smooth(fight.elapsed / .55));
  if (fight.phase === 'capturing' || fight.phase === 'done') {
    const t = fight.phase === 'done' ? BATHROOM_FIGHT.capture : fight.elapsed;
    if (role === 'morpheus') { root.x -= smooth((t - 1.3) / 1.2) * 1.8; root.z -= smooth((t - 1.3) / 1.2) * .45; }
    else root.z -= smooth(t / 1.3) * 1.2;
  }
  return root;
}
export function bathroomFightText(fight: BathroomFight): string {
  if (fight.paused) return '参与搏斗或撤离的角色正由另一位玩家控制。两人的接触与撤离进度停在当前位置。';
  if (fight.phase === 'ready') return 'Morpheus 压在 Smith 上方，双手扣住他的脖颈。G 接续掩护，让 Trinity 带 Neo 离开。';
  if (fight.phase === 'pinning') return `按住 Z 稳住抓握，为同伴争取下行时间。压制 ${fight.held.toFixed(1)}/${BATHROOM_FIGHT.pin} 秒 · 抓握 ${Math.round(fight.grip * 100)}%。`;
  if (fight.phase === 'breakout') return fight.elapsed < .55 ? 'Smith 正在掰开你的双手。等他的双手抬起，准备头部反击。'
    : fight.elapsed <= 1.3 ? 'Smith 正在掰开你的双手。现在按 F 用头部反击，随后准备退开。' : 'Smith 挣脱压制。Morpheus 退回薄墙前，两人重新站起。';
  if (fight.phase === 'faceoff') return 'Smith 报出自己的身份。Morpheus 挡在破口前，抬起双手准备近身攻防。';
  if (fight.phase === 'windup') return fight.evaded ? '已经避开起手；等 Smith 出拳落空后按 F 反击。' : fight.elapsed < BATHROOM_FIGHT.evadeFrom ? 'Smith 正收肩蓄力。先读起手，过早闪避会被跟上。' : '现在按 X 侧身避开拳路！';
  if (fight.phase === 'opening') return fight.evaded ? 'Smith 出拳落空。现在按 F 反击他的胸口！' : '没有避开这一击。不要迎着拳路连打，观察下一次起手。';
  if (fight.phase === 'counter') return `反击命中，Smith 被带离破口；已争取 ${fight.counters}/${BATHROOM_FIGHT.counters} 次撤离空隙。`;
  if (fight.phase === 'capture_ready') return '五名同伴已经离开六楼视线。G 继续挡住 Smith；Morpheus 的力量仍不足以击败特工。';
  if (fight.phase === 'capturing') return fight.elapsed < 1.3 ? 'Smith 避开最后一击并迅速回击。' : fight.elapsed < 2.8 ? 'Morpheus 被踢回破口旁，双腿失去支撑。' : 'Smith 示意警察控制 Morpheus。撤离争取到了时间，被捕的结果仍然存在。';
  if (fight.phase === 'failed') return '抓握失守或伤势使掩护中断，同伴尚未安全通过。J 从六楼地面压制检查点重试。';
  return 'Morpheus 被捕。Neo 与同伴继续向下撤离，必须找到另一条退出矩阵的线路。';
}
