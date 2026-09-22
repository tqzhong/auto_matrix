import type { FilmJourney } from './film-story.js';
import { OFFICE_CONTACT } from './office.js';
import type { Vector3 } from '../types/agent.js';

export type OfficeWorkdayPhase = 'waiting' | 'briefing' | 'answer' | 'released' | 'delivery' | 'signature' | 'signing' | 'delivered';
export interface OfficeWorkday { phase: OfficeWorkdayPhase; elapsed: number }
export interface OfficeWorkdayGesture extends OfficeWorkday { role: 'neo' | 'rhineheart' | 'courier' }
export const OFFICE_WORKDAY = {
  briefing: 9, signing: 4,
  neo: { x: -17, z: 27.4, yaw: -Math.PI / 2 },
  manager: { x: -23.3, z: 27.4, yaw: Math.PI / 2 },
  desk: { x: -21, z: 27.4, width: 2.8, depth: 7.2, height: 2.5 },
  signature: { x: 13.45, y: 3.05, z: 7.2 },
  recipient: { x: 14, z: 6.7, yaw: -Math.PI / 2 },
} as const;
export const OFFICE_MANAGER_WALLS = [
  { x: -6.1, z: 27.5, width: .2, depth: 10.7, height: 8.9 },
  { x: -20, z: 22.15, width: 13.5, depth: .2, height: 8.9 },
  { x: -7.7, z: 22.15, width: 3, depth: .2, height: 8.9 },
];
export const OFFICE_MANAGER_FURNITURE = [OFFICE_WORKDAY.desk, { x: -25.3, z: 31, width: 2.6, depth: 2.8, height: 3 }];
const route = [{ x: 0, z: -29 }, { x: 0, z: 8.5 }, { x: 10, z: 8.5 }, { x: 12.3, z: 7.7 }];
const lengths = route.slice(1).map((p, i) => Math.hypot(p.x - route[i].x, p.z - route[i].z));
const total = lengths.reduce((sum, n) => sum + n, 0);
export const OFFICE_DELIVERY_SECONDS = total / 5;
const smooth = (value: number) => { const t = Math.max(0, Math.min(1, value)); return t * t * (3 - 2 * t); };
const mix = (a: Vector3, b: Vector3, t: number): Vector3 => ({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t, z: a.z + (b.z - a.z) * t });
export function officeCourierRoot(workday: OfficeWorkday): { x: number; z: number; yaw: number } {
  const leaving = workday.phase === 'delivered';
  let distance = workday.phase === 'delivery' ? Math.min(total, workday.elapsed * 5)
    : leaving ? Math.max(0, total - workday.elapsed * 5) : ['signature', 'signing'].includes(workday.phase) ? total : 0;
  for (let i = 0; i < lengths.length; i++) {
    if (distance > lengths[i] && i < lengths.length - 1) { distance -= lengths[i]; continue; }
    const a = route[i]; const b = route[i + 1]; const t = Math.min(1, distance / lengths[i]);
    return { x: a.x + (b.x - a.x) * t, z: a.z + (b.z - a.z) * t, yaw: Math.atan2(b.x - a.x, b.z - a.z) + (leaving ? Math.PI : 0) };
  }
  return { ...route[0], yaw: 0 };
}
export function officeRecipientRoot(workday: OfficeWorkday) {
  return { ...OFFICE_WORKDAY.recipient, yaw: -Math.PI / 2 - Math.PI / 2 * smooth((workday.elapsed - 2.9) / .7) };
}
export function officeClipboardPoint(workday: OfficeWorkday): Vector3 {
  const root = officeCourierRoot(workday);
  const carried = { x: root.x + .7 * Math.sin(root.yaw) + .35 * Math.cos(root.yaw), y: 2.85, z: root.z + .7 * Math.cos(root.yaw) - .35 * Math.sin(root.yaw) };
  if (workday.phase === 'signature' || workday.phase === 'signing') return mix(OFFICE_WORKDAY.signature, carried, workday.phase === 'signing' ? smooth((workday.elapsed - 2.65) / 1.1) : 0);
  return carried;
}
export function officeParcelPoint(workday: OfficeWorkday): Vector3 {
  const root = officeCourierRoot(workday);
  const carried = { x: root.x + .65 * Math.sin(root.yaw) - .4 * Math.cos(root.yaw), y: 2.6, z: root.z + .65 * Math.cos(root.yaw) + .4 * Math.sin(root.yaw) };
  const desk = { x: OFFICE_CONTACT.parcelX, y: 2.51, z: OFFICE_CONTACT.parcelZ };
  if (workday.phase === 'delivered') return desk;
  if (workday.phase !== 'signing') return carried;
  const handover = { x: 13.4, y: 2.8, z: 7.15 };
  return workday.elapsed < 3 ? mix(carried, handover, smooth((workday.elapsed - 2.35) / .65)) : mix(handover, desk, smooth((workday.elapsed - 3) / .8));
}
export function officePenPoint(workday: OfficeWorkday): Vector3 {
  const board = officeClipboardPoint(workday); const t = Math.max(0, Math.min(1, (workday.elapsed - 1) / 1.55));
  return { x: board.x - .17 + t * .34, y: board.y + .04, z: board.z + Math.sin(t * 38) * .055 };
}
export function workdayLocked(journey: FilmJourney): boolean {
  return !journey.visiting && journey.scene === 'm1_boss' && ['briefing', 'answer', 'signing'].includes(journey.workday?.phase ?? '');
}
export function workdayText(workday: OfficeWorkday): string {
  if (workday.phase === 'waiting') return 'Rhineheart 正在办公室处理邮件。穿过玻璃门，走到桌前按 G 与他交谈。';
  if (workday.phase === 'briefing') return workday.elapsed < 3 ? 'RHINEHEART · Anderson，你的迟到已经影响了团队。'
    : workday.elapsed < 6 ? '日光穿过百叶窗。Rhineheart 继续敲着键盘，等待你听完。'
    : 'RHINEHEART · 明天准时到工位。你准备继续这份工作，就要承担这份责任。';
  if (workday.phase === 'answer') return 'Rhineheart 停下打字，抬头等你回应。按 G 表示明白，再回自己的隔间。';
  if (workday.phase === 'released') return '回到自己的工位。写着 Thomas Anderson 的快递正送往这一层。';
  if (workday.phase === 'delivery') return '快递员从电梯走向你的隔间，手里拿着一个薄包裹。';
  if (workday.phase === 'signature') return '快递员确认收件人并递出签收板。靠近自己的工位，按 G 签收。';
  if (workday.phase === 'signing') return workday.elapsed < 2.5 ? '你接过笔，在签收单上留下姓名。' : '快递员把包裹放在桌边，收回签收板。里面传来手机铃声。';
  return '包裹已交到你桌上。按 G 打开，再决定是否接听。';
}
export function officeClothing(id: string, location: string): boolean {
  return id === 'neo' && ['film_metacortex_floor', 'film_office_ledge', 'film_agent_interrogation', 'metacortex_office'].includes(location);
}
