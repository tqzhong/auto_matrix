import type { FilmJourney } from './film-story.js';

export type ApartmentPhase = 'idle' | 'signal' | 'reply' | 'knocking' | 'door' | 'opening' | 'book' | 'retrieving' | 'disk' | 'handover' | 'invitation' | 'inspecting' | 'noticed' | 'accepted';
export interface ApartmentContact { phase: ApartmentPhase; elapsed: number; paid?: boolean }
export interface ApartmentGesture extends ApartmentContact { role: 'neo' | 'choi' | 'dujour' }
export const APARTMENT = {
  computer: { x: -9, z: -8.8, yaw: Math.PI },
  door: { x: 0, z: 10.2, yaw: 0 },
  book: { x: 6, z: 3.4, yaw: 0 },
  choi: { x: 0, z: 13, yaw: Math.PI },
  dujour: { x: -1.1, z: 14.5, yaw: Math.PI - .4 },
  doorZ: 12, doorWidth: 3.8,
  signal: 8, knocking: 4, opening: 2.4, retrieving: 3.2, handover: 4.5,
} as const;
export const APARTMENT_FURNITURE = [
  { x: -9, z: -12, width: 8, depth: 3.4, height: 2.4 },
  { x: 10.2, z: -9, width: 6.2, depth: 10, height: 1.5 },
  { x: 6, z: 6.2, width: 2.8, depth: 1.8, height: 1.8 },
  { x: -15.7, z: -4, width: 1.6, depth: 8, height: 5.3 },
  { x: -9.5, z: 12, width: 15, depth: .4, height: 8.8 },
  { x: 9.5, z: 12, width: 15, depth: .4, height: 8.8 },
];
const phases: ApartmentPhase[] = ['idle', 'signal', 'reply', 'knocking', 'door', 'opening', 'book', 'retrieving', 'disk', 'handover', 'invitation', 'inspecting', 'noticed', 'accepted'];
export function apartmentAfter(contact: ApartmentContact, phase: ApartmentPhase): boolean { return phases.indexOf(contact.phase) >= phases.indexOf(phase); }
export function apartmentDoor(contact?: ApartmentContact): number {
  if (!contact || !apartmentAfter(contact, 'opening')) return 0;
  return contact.phase === 'opening' ? Math.min(1, contact.elapsed / APARTMENT.opening) : 1;
}
export function apartmentLocked(journey: FilmJourney): boolean {
  return journey.scene === 'm1_wake_up' && !journey.visiting && ['signal', 'reply', 'knocking', 'opening', 'retrieving', 'handover', 'inspecting'].includes(journey.contact?.phase ?? '');
}
export function apartmentText(contact: ApartmentContact): string {
  switch (contact.phase) {
    case 'idle': return '电脑还开着，电缆缠绕在桌脚。走到显示器旁，按 G 查看刚才的异常。';
    case 'signal': return contact.elapsed < 3 ? 'CRT 上的工作窗口消失了。光标自行输入你的另一个名字。' : contact.elapsed < 5.8 ? '没有发送者，没有聊天程序。有人声称你正生活在一个被安排好的系统中。' : '屏幕只留下一条陌生的指示：寻找白兔。';
    case 'reply': return '光标还在闪烁。按 G 尝试用键盘退出这个窗口。';
    case 'knocking': return contact.elapsed < 1.4 ? '键盘没有回应。屏幕先出现了一句敲门提示，门外随即传来声响。' : 'CHOI · 是我。东西准备好了吗？';
    case 'door': return '有人站在 101 门外。走到门前按 G 开门。';
    case 'opening': return '你转动把手。Choi 和同行的 Dujour 站在楼道灯下。';
    case 'book': return 'CHOI · 带来了报酬。Neo 把备用磁盘藏在一本挖空的书里，去床边取出来。';
    case 'retrieving': return '你翻开书，空心书页里藏着一张磁盘。';
    case 'disk': return '磁盘已取出。回到门口，亲手交给 Choi。';
    case 'handover': return contact.elapsed < 2.5 ? 'Choi 接过磁盘，把事先约定的报酬交给你。' : 'CHOI · 我们准备去一趟夜店。要一起吗？';
    case 'invitation': return 'Dujour 转身时，左肩露出一只白兔。靠近门口按 G 核对它与屏幕上的线索。';
    case 'inspecting': return '你望向 Dujour 左肩的白兔，再回想刚才电脑里的字。两件事对上了，但原因仍然未知。';
    case 'noticed': return '屏幕上的白兔与肩上的纹身对应上了。巧合并不等于证明；你要亲自去核对，还是先回到生活中？J 作出决定。';
    case 'accepted': return '你决定随他们去夜店。Choi 收好磁盘；门外的夜晚第一次有了不同的意义。G 出发。';
  }
}
