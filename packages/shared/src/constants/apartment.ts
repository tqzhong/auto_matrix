import type { FilmJourney } from './film-story.js';

export type ApartmentPhase = 'idle' | 'signal' | 'reply' | 'knocking' | 'door' | 'opening' | 'book' | 'retrieving' | 'disk' | 'handover' | 'invitation' | 'inspecting' | 'noticed' | 'accepted';
export interface ApartmentContact { phase: ApartmentPhase; elapsed: number; paid?: boolean }
export interface ApartmentGesture extends ApartmentContact { role: 'neo' | 'choi' | 'dujour' }
export type WakeCallPhase = 'waking' | 'ringing' | 'pickup' | 'listening' | 'decision' | 'reply' | 'done' | 'leaving';
export interface WakeCall { phase: WakeCallPhase; elapsed: number; nightmare: boolean }
export interface MorningRoutine {
  phase: 'home' | 'lying' | 'sleeping' | 'alarm' | 'stopping' | 'rising' | 'ready' | 'done';
  elapsed: number; wakeAt?: number;
}
export const MORNING = { lying: 3.2, sleeping: 1.8, stopping: 1.1, bedX: 8.05,
  alarm: { x: 6.45, y: 1.85, z: -10.75 }, exit: { x: 0, z: 23 } } as const;
export const APARTMENT_ROOM = { width: 34, depth: 40, exitWidth: 10, center: { x: 1210, y: 1, z: 690 } } as const;
export const APARTMENT = {
  computer: { x: -9, z: -8.8, yaw: Math.PI },
  bed: { x: 10.2, z: -9, yaw: 0 },
  bedside: { x: 5.5, z: -9, yaw: -Math.PI / 2 },
  breakfast: { x: -7, z: 3.7 },
  phone: { x: -5.78, y: 2.62, z: -10.45, approachX: -5.8, approachZ: -9.15, yaw: Math.PI },
  door: { x: 0, z: 10.2, yaw: 0 },
  book: { x: 6, z: 3.4, yaw: 0 },
  choi: { x: 0, z: 13, yaw: Math.PI },
  dujour: { x: -1.1, z: 14.5, yaw: Math.PI - .4 },
  doorZ: 12, doorWidth: 3.8,
  signal: 8, knocking: 4, opening: 2.4, retrieving: 3.2, handover: 4.5,
} as const;
export const WAKE_CALL = { waking: 5.6, pickup: 2.2, listening: 8.6, reply: 4.2, leaving: 4.4 } as const;
export const APARTMENT_FURNITURE = [
  { x: -9, z: -12, width: 8, depth: 3.4, height: 2.4 },
  { x: 10.2, z: -9, width: 6.2, depth: 10, height: 1.5 },
  { x: 6.35, z: -10.75, width: 1.45, depth: 1.1, height: 1.62 },
  { x: 6, z: 6.2, width: 2.8, depth: 1.8, height: 1.8 },
  { x: -15.7, z: -4, width: 1.6, depth: 8, height: 5.3 },
  { x: -10, z: 6.8, width: 8, depth: 2.8, height: 2.9 },
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
export function wakeCallLocked(journey: FilmJourney): boolean {
  return journey.scene === 'm1_wake_again' && !journey.visiting && ['waking', 'pickup', 'listening', 'decision', 'reply', 'leaving'].includes(journey.wakeCall?.phase ?? '');
}
export function morningLocked(journey: FilmJourney): boolean {
  return journey.scene === 'm1_morning' && !journey.visiting && ['lying', 'sleeping', 'alarm', 'stopping', 'rising'].includes(journey.morning?.phase ?? '');
}
export function morningWakePose(morning: MorningRoutine): WakeCall {
  return { phase: 'waking', nightmare: false, elapsed: morning.phase === 'lying'
    ? WAKE_CALL.waking * (1 - Math.min(1, morning.elapsed / MORNING.lying))
    : morning.phase === 'rising' ? morning.elapsed : 0 };
}
export function morningRoot(morning: MorningRoutine): { x: number; z: number; yaw: number } {
  const call = morningWakePose(morning); const root = wakeCallRoot(call);
  const bedside = smooth(Math.max(0, Math.min(1, (call.elapsed - 2.7) / (WAKE_CALL.waking - 2.7))));
  root.x += (MORNING.bedX - APARTMENT.bed.x) * (1 - bedside);
  return root;
}
export function morningText(morning: MorningRoutine): string {
  switch (morning.phase) {
    case 'home': return '回到熟悉的 101。你可以再看看房间，或走到床边按 G 休息；选择睡下才会推进到早晨。';
    case 'lying': return 'Neo 坐到床沿，慢慢躺下。夜店的音乐与陌生人的警告仍留在脑海里。';
    case 'sleeping': return '夜晚过去了。窗外逐渐亮起，闹钟已经错过了原定的起床时间。';
    case 'alarm': return '09:15。闹钟还在响——已经迟到了。按 G 伸手关掉闹钟，起床去公司。';
    case 'stopping': return 'Neo 伸手按下床头闹钟。';
    case 'rising': return '他坐起身，双脚落地，离开床边。今天仍然要去上班。';
    case 'ready': return '走出 101，穿过楼道来到街边，按 G 选择出发。公共交通需要 20 分钟和 $2；零钱不足则步行 40 分钟。';
    case 'done': return '你已来到街边。G 前往公司：公共交通 20 分钟 / $2，零钱不足则步行 40 分钟。';
  }
}
export function wakeCallRoot(call: WakeCall): { x: number; z: number; yaw: number } {
  if (call.phase === 'leaving') {
    const crossing = smooth(Math.max(0, Math.min(1, (call.elapsed - 1.15) / 1.9)));
    const turnBack = smooth(Math.max(0, Math.min(1, (call.elapsed - 3.02) / .5)));
    return { x: 1.22 + (0 - 1.22) * crossing, z: 10.15 + (14.35 - 10.15) * crossing, yaw: Math.PI * turnBack };
  }
  if (call.phase !== 'waking') return { x: APARTMENT.phone.approachX, z: APARTMENT.phone.approachZ, yaw: APARTMENT.phone.yaw };
  const t = smooth(Math.max(0, Math.min(1, (call.elapsed - 2.7) / (WAKE_CALL.waking - 2.7))));
  return {
    x: APARTMENT.bed.x + (APARTMENT.bedside.x - APARTMENT.bed.x) * t,
    z: APARTMENT.bed.z + (APARTMENT.bedside.z - APARTMENT.bed.z) * t,
    yaw: APARTMENT.bed.yaw + (APARTMENT.bedside.yaw - APARTMENT.bed.yaw) * t,
  };
}
const smooth = (t: number) => t * t * (3 - 2 * t);
export function wakeCallDoor(call?: WakeCall): number {
  if (call?.phase !== 'leaving') return 0;
  const opened = smooth(Math.max(0, Math.min(1, (call.elapsed - .25) / 1.15)));
  const closing = smooth(Math.max(0, Math.min(1, (call.elapsed - 3.25) / .9)));
  return opened * (1 - closing);
}
export function wakeCallHandsetHeld(call?: WakeCall): boolean {
  if (!call) return false;
  return call.phase === 'pickup' ? call.elapsed >= .65 : ['listening', 'decision'].includes(call.phase) || call.phase === 'reply' && call.elapsed < 3.15;
}
export function wakeCallText(call: WakeCall): string {
  switch (call.phase) {
    case 'waking':
      if (!call.nightmare) return call.elapsed < 2.7 ? 'Neo 回到公寓，在床边短暂睡去。办公室的高空与追捕仍留在意识里。' : '远处的座机开始响。Neo 起身，重新站稳。';
      return call.elapsed < 1.35 ? 'Neo 在床上猛然惊醒。' : call.elapsed < 3 ? '他先摸向嘴，再检查腹部；审讯室留下的触感并没有随着梦境消失。' : '座机铃声迫使他离开床铺。';
    case 'ringing': return '公寓里的有线座机持续响着。走到工作台旁，按 G 拿起听筒。';
    case 'pickup': return call.elapsed < .8 ? 'Neo 伸手从底座上拿起听筒。' : '他没有先开口。线路另一端传来 Morpheus 的声音。';
    case 'listening': return call.elapsed < 2.8 ? 'MORPHEUS · 这条线路正在被监听，不能谈太久。' : call.elapsed < 5.8 ? (call.nightmare ? 'MORPHEUS · 特工抢先找到了你，但他们低估了你的选择。' : 'MORPHEUS · 你避开了他们的追捕，但这条线路仍不安全。') : 'MORPHEUS · 你仍然想和我见面吗？';
    case 'decision': return '电话另一端安静下来，等待你的回答。按 G 明确答应；等待不会替你作出选择。';
    case 'reply': return call.elapsed < 1.5 ? 'NEO · 是。' : call.elapsed < 3.15 ? 'MORPHEUS · 去 Adams Street 桥下。接应车辆会找到你。' : '听筒回到底座。接头地点已经记下。';
    case 'done': return '前往 101 房门。站到门内侧，按 G 转动把手，去 Adams Street 桥下。';
    case 'leaving': return call.elapsed < 1.4 ? 'Neo 转动 101 的门把，推开房门。' : call.elapsed < 3.25 ? '他亲自迈过门槛，走入公寓楼道。' : '房门在身后合拢；Adams Street 的雨夜接入视野。';
  }
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
