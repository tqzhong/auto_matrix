import type { AgentState } from '../types/agent.js';
import type { OpeningPhoneEncounter } from './opening-escape.js';

export const WELLS_AFTERMATH = {
  roles: ['smith', 'agent_jones', 'agent_brown'],
  seconds: 12.5,
  bootShot: .32,
  firstFoot: .74,
  streetShot: 2.4,
  conversationShot: 5.35,
  receiverShot: 11.25,
  receiver: { x: -3.6, y: .073, z: -36.45 },
  door: { x: -1.94, z: -2.2 },
  upperStep: { x: -2.34, y: 1.69, z: -.65 },
  lowerStep: { x: -2.62, y: .8, z: -.65 },
} as const;

type WellsAgent = typeof WELLS_AFTERMATH.roles[number];
export type WellsAgentPlacement = Pick<AgentState, 'position' | 'rotation' | 'velocity' | 'currentLocation' | 'isInMatrix'
  | 'targetPosition' | 'currentPath' | 'currentAction'>;
export interface WellsAftermath {
  elapsed: number;
  cast: Record<WellsAgent, WellsAgentPlacement>;
}
export interface WellsAftermathGesture { elapsed: number; role: WellsAgent }

const dialogue = [
  { from: 4.8, to: 6.3, role: 'smith', text: 'Smith：亭里没人。' },
  { from: 6.3, to: 7.95, role: 'agent_jones', text: 'Jones：她从电话线逃走了。' },
  { from: 7.95, to: 10.25, role: 'agent_brown', text: 'Brown：线人的消息是真的。下一个目标已经查到了。' },
  { from: 10.25, to: 11.85, role: 'smith', text: 'Smith：Neo。' },
] as const;

const progress = (elapsed: number, from: number, to: number) => Math.max(0, Math.min(1, (elapsed - from) / (to - from)));
const ease = (t: number) => t * t * (3 - 2 * t);
const transition = (elapsed: number, from: number, to: number) => ease(progress(elapsed, from, to));

export function wellsAftermathReady(phone: OpeningPhoneEncounter | undefined): boolean {
  return phone?.phase === 'done' && (phone.aftermath?.elapsed ?? 0) >= WELLS_AFTERMATH.seconds;
}

export function wellsAftermathCaption(elapsed: number): string {
  return dialogue.find(line => elapsed >= line.from && elapsed < line.to)?.text
    ?? (elapsed >= 11.85 ? '特工找到了下一个目标，Neo。' : elapsed >= 2.4 ? 'Smith 走到被撞毁的电话亭旁。' : 'Smith 推开卡车驾驶室的门。');
}

export function wellsAftermathDoor(elapsed: number | undefined): number {
  if (elapsed === undefined) return 0;
  return -1.15 * transition(elapsed, .38, 1.08) * (1 - transition(elapsed, 2.65, 3.45));
}

export function wellsAftermathPose({ elapsed, role }: WellsAftermathGesture) {
  const smith = role === 'smith', jones = role === 'agent_jones';
  const leave = smith ? transition(elapsed, .86, 2.25) : 1;
  const from = smith ? { x: -3.95, z: -26.35 } : { x: jones ? -5.5 : -8.8, z: jones ? -15.4 : -13.9 };
  const to = smith ? { x: -4.65, z: -35.45 } : { x: jones ? -5.7 : -8.3, z: jones ? -31.85 : -37.2 };
  const start = smith ? 2.25 : jones ? 1.15 : 1.7, stop = smith ? 4.8 : jones ? 5.7 : 6.2;
  const step = progress(elapsed, start, stop), walk = ease(step);
  const dx = to.x - from.x, dz = to.z - from.z, length = Math.hypot(dx, dz);
  const x = from.x + dx * walk + (smith ? 1.2 * (1 - leave) : 0);
  const z = from.z + dz * walk - (smith ? .7 * (1 - leave) : 0);
  const heading = Math.atan2(dx, dz);
  const arrive = transition(elapsed, stop - .7, stop + .45);
  const facing = smith ? 2.02 : jones ? 2.84 : 1.22;
  const turn = Math.atan2(Math.sin(facing - heading), Math.cos(facing - heading));
  const line = dialogue.find(beat => elapsed >= beat.from && elapsed < beat.to);
  const attention = line ? transition(elapsed, line.from, line.from + .24) * (1 - transition(elapsed, line.to - .3, line.to)) : 0;
  const listen = line && line.role !== role ? (line.role === 'agent_brown' ? .32 : -.25) * attention : 0;
  const inspect = smith ? transition(elapsed, 4.18, 5.05) * (1 - transition(elapsed, 5.75, 6.53)) : 0;
  return { x, y: smith ? 1.55 * (1 - leave) : 0, z,
    yaw: smith && elapsed < start ? -Math.PI / 2 + (heading + Math.PI / 2) * transition(elapsed, 1.82, start)
      : heading + turn * arrive - (smith ? 2.27 * transition(elapsed, 5.6, 6.75) : 0),
    speed: length * 6 * step * (1 - step) / (stop - start), travel: length * walk, inspect, listen,
    speaking: line?.role === role ? Math.pow(Math.sin((elapsed - line.from) * 15), 2) * attention : 0 };
}
