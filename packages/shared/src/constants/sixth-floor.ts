import type { Vector3 } from '../types/agent.js';
import type { FilmJourney } from './film-story.js';
import { SIXTH_ROOM, WETWALL_SHAFT } from './ambush.js';
import { WETWALL_ROLES } from './wetwall.js';

export const SIXTH_ROLES = [...WETWALL_ROLES, 'citizen_4', 'citizen_14', 'smith'] as const;
export type SixthRole = typeof SIXTH_ROLES[number];
export type SixthPhase = 'ready' | 'searching' | 'firing' | 'cover' | 'replacing' | 'rushing' | 'grapple' | 'breach' | 'done' | 'failed';
export interface SixthEncounter {
  phase: SixthPhase; elapsed: number; attempts: number; shots: number; ammo: number; cooldown: number;
  nextShot: number; covered: boolean; cover: number; aim: number; failure?: 'ammo'; paused?: boolean; starts: Record<SixthRole, Vector3 & { yaw: number }>;
}
export interface SixthGesture {
  role: SixthRole; phase: SixthPhase; elapsed: number; start: Vector3 & { yaw: number }; covered: boolean; cover: number; aim: number;
  paused?: boolean; contact?: Vector3;
}
export const SIXTH = { searchSeconds: 5.8, coverSeconds: 1.8, replacementSeconds: 2.4, rushSeconds: 1.4,
  grappleSeconds: 1.8, breachSeconds: 2.8, fireInterval: .22, incomingInterval: 1.2 } as const;
const smooth = (value: number): number => { const t = Math.max(0, Math.min(1, value)); return t * t * (3 - 2 * t); };
const approach = (a: Vector3, b: Vector3, t: number) => ({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t, z: a.z + (b.z - a.z) * t });
export function sixthPose(gesture: SixthGesture) {
  const { role, phase, elapsed, start } = gesture, y = WETWALL_SHAFT.sixth;
  let position = { x: start.x, y: start.y, z: start.z }, yaw = start.yaw;
  const afterCover = ['replacing', 'rushing', 'grapple', 'breach', 'done'].includes(phase);
  const afterReplacement = ['rushing', 'grapple', 'breach', 'done'].includes(phase);
  const hidden = role === 'citizen_4' && (afterReplacement || phase === 'replacing' && elapsed >= 1.2)
    || role === 'smith' && !(afterReplacement || phase === 'replacing' && elapsed >= 1.2);
  if (role === 'citizen_4' || role === 'smith') {
    const listening = { x: -15.5, y, z: -27.7 }, corner = { x: -17.5, y, z: -25.1 }, cover = { x: -17.5, y, z: -20.6 };
    if (phase === 'searching') position = approach(start, listening, smooth(elapsed / 4.5));
    else if (phase === 'cover') position = elapsed < .8 ? approach(listening, corner, smooth(elapsed / .8)) : approach(corner, cover, smooth((elapsed - .8) / 1));
    else if (afterCover) position = cover;
    else if (phase !== 'ready') position = listening;
    if (role === 'smith' && afterReplacement) {
      const t = phase === 'rushing' ? Math.min(1, elapsed / SIXTH.rushSeconds) : 1;
      position = t < .45 ? approach(cover, corner, smooth(t / .45)) : approach(corner, { x: -15.5, y, z: WETWALL_SHAFT.front }, smooth((t - .45) / .55));
      if (phase === 'breach' || phase === 'done') position.z = WETWALL_SHAFT.front + 6 * (phase === 'done' ? 1 : smooth(elapsed / 1.8));
    }
    yaw = Math.PI;
  } else if (role === 'morpheus') {
    if (afterReplacement) position.y = phase === 'rushing' ? start.y + (y + 1 - start.y) * smooth(elapsed / SIXTH.rushSeconds) : y + 1;
    if (phase === 'breach' || phase === 'done') {
      position = approach({ x: start.x, y: y + 1, z: start.z }, { x: SIXTH_ROOM.morpheus.x, y, z: SIXTH_ROOM.morpheus.z }, phase === 'done' ? 1 : smooth(elapsed / 1.8));
      yaw = 0;
    }
  } else if (role === 'citizen_14') {
    const scan = phase === 'searching' ? Math.sin(elapsed * .7) : 0; yaw = Math.PI + scan * .35;
  }
  if (role === 'neo' && phase === 'firing') { position.x -= gesture.cover; yaw = gesture.aim; }
  const hanging = WETWALL_ROLES.includes(role as typeof WETWALL_ROLES[number]) && !(role === 'morpheus' && ['breach', 'done'].includes(phase));
  const armed = role === 'neo' && phase === 'firing' || role === 'citizen_4' && ['searching', 'firing'].includes(phase) || role === 'citizen_14';
  return { ...position, yaw, hidden, hanging, armed };
}
export function sixthLocked(journey: FilmJourney | undefined): boolean { return Boolean(journey?.scene === 'm1_wall_exposed' && !journey.visiting); }
export function sixthText(encounter: SixthEncounter): string {
  if (encounter.paused) return '参与这段逃生的角色正由另一位玩家控制。搜查、枪声和掩护停在当前进度。';
  if (encounter.phase === 'ready') return '六楼 608 室外传来脚步。G 留意薄墙外的搜查；Neo 仍抓着管道，Morpheus 在上方。';
  if (encounter.phase === 'searching') return '警察沿浴室搜索，手电扫过墙面。他听见解救时的动静，贴近灰泥。';
  if (encounter.phase === 'firing') return `他们发现了墙内的人！按住 Z 缩到木柱后掩护，转向破口，用鼠标左键或 T 还击。弹药 ${encounter.ammo}/12。`;
  if (encounter.phase === 'cover') return 'Neo 的子弹逼得警察退到浴室门外。枪声暂时停止。';
  if (encounter.phase === 'replacing') return '门外的警察突然僵住，步枪掉落。他的身体被系统替换。';
  if (encounter.phase === 'rushing') return '脚步迅速逼近。Morpheus 沿立管赶到 Neo 上方。';
  if (encounter.phase === 'grapple') return 'Smith 的双手穿过碎裂的薄墙，压住 Neo 的脖颈。Morpheus 松开管道扑向他。';
  if (encounter.phase === 'breach') return 'Morpheus 撞开灰泥和木条，把 Smith 从 Neo 身边带入六楼浴室。Trinity 叫 Neo 继续撤退。';
  if (encounter.phase === 'failed') return encounter.failure === 'ammo' ? '手枪弹药耗尽，仍未逼退搜查者。J 从六楼夹层重试，已经完成的下行仍保留。' : '枪火击中了 Neo。J 从六楼夹层重试；已经完成的下行和 Mouse 的死亡保留。';
  return 'Morpheus 已在六楼浴室挡住 Smith。G 或 J 接管他的视角，为同伴争取撤离时间。';
}
