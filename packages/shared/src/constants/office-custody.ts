import type { Vector3 } from '../types/agent.js';
import type { FilmJourney } from './film-story.js';
import type { OFFICE_AGENT_ROLES } from './office.js';

export const OFFICE_CUSTODY = { securing: 3.2, speed: 2.1, spacing: 1.75, exit: { x: 0, z: -25.2 }, range: 2 };
export type OfficeCustodyRole = typeof OFFICE_AGENT_ROLES[number];
export interface OfficeCustody {
  phase: 'securing' | 'escorting' | 'ready';
  elapsed: number;
  catcher: OfficeCustodyRole;
  leader: OfficeCustodyRole;
  bodies: Record<OfficeCustodyRole, { position: Vector3; yaw: number; velocity?: Vector3 }>;
  paused?: boolean;
}
export interface OfficeCustodyGesture { role: OfficeCustodyRole | 'neo'; phase: OfficeCustody['phase']; elapsed: number; paused?: boolean }
export function officeCustodyStep(previous: Vector3, candidate: Vector3, bodies: Vector3[]): Vector3 {
  const planar = (a: Vector3, b: Vector3) => Math.hypot(a.x - b.x, a.z - b.z);
  return bodies.some(body => planar(candidate, body) < OFFICE_CUSTODY.spacing && planar(candidate, body) < planar(previous, body)) ? previous : candidate;
}
export function officeCustodyActive(journey?: FilmJourney): boolean {
  return Boolean(journey && !journey.visiting && journey.scene === 'm1_office_escape' && journey.office?.custody);
}
export function officeCustodyLocked(journey?: FilmJourney): boolean {
  return officeCustodyActive(journey) && (journey!.office!.custody!.phase === 'securing' || Boolean(journey!.office!.custody!.paused));
}
export function officeCustodyText(custody: OfficeCustody): string {
  if (custody.paused) return '一名到场特工正在由另一位玩家控制。拘捕和押送停在当前一拍，释放角色后继续。';
  return custody.phase === 'securing' ? '特工制住了你的上臂，手机通话中断。双手被扣在身后，先稳住身体。'
    : custody.phase === 'ready' ? '你已被押到电梯旁。生活记录和调查线索仍然保留；按 G 继续审讯。'
      : '跟随前面的特工走到电梯。WASD 慢步移动，身后的特工会跟进；停下时队伍会等你。';
}
