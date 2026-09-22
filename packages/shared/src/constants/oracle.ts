import type { Philosophy } from '../types/neo-life.js';
import type { FilmJourney } from './film-story.js';

export type OracleVisitPhase = 'waiting' | 'examining' | 'question' | 'responding' | 'done';
export interface OracleVisitEncounter {
  phase: OracleVisitPhase;
  elapsed: number;
  answer?: Philosophy;
  approach?: { x: number; z: number; yaw: number };
}
export type OracleVisitRole = 'neo' | 'oracle';
export type OracleVisitGesture = OracleVisitEncounter & { role: OracleVisitRole };

export const ORACLE_VISIT = {
  neo: { x: -4.35, z: -22, yaw: -Math.PI / 2 },
  oracle: { x: -7.1, z: -22, yaw: Math.PI / 2 },
  examination: 10.8,
  response: 4.2,
} as const;

const smooth = (value: number): number => {
  const t = Math.max(0, Math.min(1, value)); return t * t * (3 - 2 * t);
};

export function oracleVisitLocked(journey: FilmJourney): boolean {
  const phase = journey.oracle?.consultation?.phase;
  return journey.scene === 'm1_oracle' && !journey.visiting && Boolean(phase && !['waiting', 'done'].includes(phase));
}

export function oracleVisitDuration(encounter: OracleVisitEncounter): number {
  return encounter.phase === 'responding' ? ORACLE_VISIT.response : ORACLE_VISIT.examination;
}

export function oracleVisitRoot(encounter: OracleVisitEncounter, role: OracleVisitRole) {
  const target = ORACLE_VISIT[role];
  if (role === 'oracle' || encounter.phase === 'waiting') return target;
  const origin = encounter.approach ?? target;
  const blend = encounter.phase === 'examining' ? smooth(encounter.elapsed / 1.4) : 1;
  const turn = Math.atan2(Math.sin(target.yaw - origin.yaw), Math.cos(target.yaw - origin.yaw));
  return { x: origin.x + (target.x - origin.x) * blend, z: origin.z + (target.z - origin.z) * blend, yaw: origin.yaw + turn * blend };
}

export function oracleVisitPose(gesture: OracleVisitGesture) {
  const t = gesture.elapsed;
  const inspect = gesture.phase === 'examining' ? smooth((t - 1.5) / 1.2) * (1 - smooth((t - 4.6) / .8)) : 0;
  const listen = gesture.phase === 'examining' ? smooth((t - 4.2) / 1.1) : gesture.phase === 'question' || gesture.phase === 'responding' ? 1 : 0;
  const offer = gesture.phase === 'examining' ? smooth((t - 7.2) / 1.1) : gesture.phase === 'question' || gesture.phase === 'responding' ? 1 : 0;
  const receive = gesture.phase === 'examining' ? smooth((t - 8.25) / .9) : gesture.phase === 'question' || gesture.phase === 'responding' ? 1 : 0;
  return { inspect, listen, offer, receive };
}

export function oracleVisitText(encounter: OracleVisitEncounter): string {
  if (encounter.phase === 'waiting') return '花瓶碎片留在地上。走到厨房操作台旁，亲自接受先知的检查与谈话。';
  if (encounter.phase === 'question') return '先知没有用称号替你作决定。打开手记，回答你会怎样面对 Morpheus、预言与接下来的选择。';
  if (encounter.phase === 'responding') {
    if (encounter.answer === 'care') return '先知把关心从抽象的救世主拉回到一个具体的人：如果 Morpheus 陷入危险，你仍要自己决定是否去救他。';
    if (encounter.answer === 'agency') return '先知接受你的怀疑。预言不会替你判断；你需要在行动里检验信息，并承担自己的决定。';
    return '先知让你保留疑问和有限的信任。不能预先知道结局，并不等于无法与别人共同准备。';
  }
  if (encounter.phase === 'done') return '检查与谈话已经记下。饼干仍有余温，关于 Morpheus 的选择会在之后重新出现。';
  if (encounter.elapsed < 1.5) return '先知关上烤箱，擦净双手，示意你走近一些。';
  if (encounter.elapsed < 4.5) return '她检查你的眼睛、呼吸和掌心，又让你抬头看清门楣上“认识你自己”的字样。';
  if (encounter.elapsed < 7.2) return '她问你是否已经相信自己是救世主。你的迟疑比一个预先准备的答案更诚实。';
  if (encounter.elapsed < 9.2) return '先知没有颁发称号。她提醒你：Morpheus 的信念会把他带进真实的危险。';
  return '她从烤盘拿起一块饼干递给你，并把选择留在你手里。';
}

export function oracleLegacyChoice(answer: Philosophy): 'doubt' | 'rescue' | 'observe' {
  return answer === 'agency' ? 'doubt' : answer === 'care' ? 'rescue' : 'observe';
}
