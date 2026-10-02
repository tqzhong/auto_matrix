import type { Vector3 } from '../types/agent.js';
import type { FilmJourney } from './film-story.js';
import type { OFFICE_AGENT_ROLES } from './office.js';
import { metacortexPosition, type MetacortexLift } from './metacortex.js';

export const OFFICE_CUSTODY = { securing: 3.2, speed: 2.1, spacing: 1.75, exit: { x: 0, z: -25.2 }, range: 2 };
export type OfficeCustodyRole = typeof OFFICE_AGENT_ROLES[number];
export const OFFICE_CUSTODY_CAR = {
  neo: { x: -1.3, z: -27.8 }, leader: { x: 1.8, z: -30.4 },
  catcher: { x: 1.3, z: -27.8 }, rear: { x: -1.3, z: -30.4 },
  outside: { x: 0, z: 36 }, button: { x: 2.78, y: 3.1, z: -30.4 }, selecting: 1.6,
  waiting: { x: 0, z: -20 }, staging: { leader: { x: 6, z: -20 }, rear: { x: -6, z: -20 }, catcher: { x: 0, z: -16 } },
} as const;
export interface OfficeCustodyBody { position: Vector3; yaw: number; velocity?: Vector3 }
export interface OfficeCustody {
  phase: 'securing' | 'escorting' | 'ready' | 'clearing' | 'boarding' | 'selecting' | 'riding' | 'lobby' | 'outside';
  elapsed: number;
  catcher: OfficeCustodyRole;
  leader: OfficeCustodyRole;
  bodies: Record<OfficeCustodyRole, OfficeCustodyBody>;
  paused?: boolean;
  boarded?: number;
  transportElapsed?: number;
  courier?: OfficeCustodyBody & { clear?: boolean };
  lift?: MetacortexLift;
}
export interface OfficeCustodyGesture { role: OfficeCustodyRole | 'neo' | 'courier'; phase: OfficeCustody['phase']; elapsed: number; paused?: boolean; locked?: boolean }
export function officeCustodyStep(previous: Vector3, candidate: Vector3, bodies: Vector3[]): Vector3 {
  const planar = (a: Vector3, b: Vector3) => Math.hypot(a.x - b.x, a.z - b.z);
  return bodies.some(body => Math.abs(body.y - candidate.y) < 3 && planar(candidate, body) < OFFICE_CUSTODY.spacing && planar(candidate, body) < planar(previous, body)) ? previous : candidate;
}
export function officeCustodyActive(journey?: FilmJourney): boolean {
  return Boolean(journey && !journey.visiting && journey.scene === 'm1_office_escape' && journey.office?.custody);
}
export function officeCustodyLocked(journey?: FilmJourney): boolean {
  return officeCustodyActive(journey) && officeCustodyHeld(journey!.office!.custody!);
}
export function officeCustodyHeld(custody: OfficeCustody): boolean {
  return Boolean(custody.paused) || ['securing', 'selecting', 'riding'].includes(custody.phase) || custody.phase === 'boarding' && (custody.boarded ?? 0) < 3;
}
export function officeCustodyTarget(custody: OfficeCustody): Vector3 | undefined {
  if (custody.phase === 'clearing') return metacortexPosition(OFFICE_CUSTODY_CAR.waiting.x, OFFICE_CUSTODY_CAR.waiting.z, 1);
  if (custody.phase === 'lobby' || custody.phase === 'outside') return metacortexPosition(OFFICE_CUSTODY_CAR.outside.x, OFFICE_CUSTODY_CAR.outside.z);
  if (custody.phase === 'boarding' && custody.boarded === 3) return metacortexPosition(OFFICE_CUSTODY_CAR.neo.x, OFFICE_CUSTODY_CAR.neo.z, 1);
  if (custody.phase === 'escorting' || custody.phase === 'ready') return metacortexPosition(OFFICE_CUSTODY.exit.x, OFFICE_CUSTODY.exit.z, 1);
}
export function officeCustodyText(custody: OfficeCustody): string {
  if (custody.paused) return '一名押送参与者正在由另一位玩家控制。队伍和电梯停在当前一拍，释放角色后继续。';
  if (custody.phase === 'clearing') return 'WASD 后退到电梯前的等候区。特工会移到两侧，让快递员先走出轿厢。';
  if (custody.phase === 'boarding') return custody.courier && !custody.courier.clear ? '快递员正从轿厢让路。等他走出，特工会依次入梯。'
    : custody.boarded === 3 ? '特工已在轿厢中等候。WASD 走进电梯左前方，双手仍被扣在身后。' : '特工正依次进入轿厢。先在门外等候，不要挤入队伍。';
  if (custody.phase === 'selecting') return '队伍已全部入梯。特工按下一层按钮，随后关门下楼。';
  if (custody.phase === 'riding') return custody.lift?.phase === 'opening' ? '一层大堂到了。门正在打开，等队伍出梯。' : '电梯向一层下降。可以环顾轿厢，队伍与生活记录会保留。';
  if (custody.phase === 'lobby') return '跟随特工穿过公司大堂，走向日光下的正门。WASD 慢步移动，队伍会等你。';
  if (custody.phase === 'outside') return '你已随队伍走出公司，双手仍被扣住。按 G 继续审讯，生活记录和调查线索保留。';
  return custody.phase === 'securing' ? '特工制住了你的上臂，手机通话中断。双手被扣在身后，先稳住身体。'
    : custody.phase === 'ready' ? '你已被押到电梯旁。按 G 随队下楼，进梯前先让其他人进入。'
      : '跟随前面的特工走到电梯。WASD 慢步移动，身后的特工会跟进；停下时队伍会等你。';
}
