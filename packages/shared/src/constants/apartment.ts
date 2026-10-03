import type { FilmJourney } from './film-story.js';

export type ApartmentPhase = 'idle' | 'signal' | 'reply' | 'knocking' | 'door' | 'opening' | 'book' | 'retrieving' | 'disk' | 'handover' | 'invitation' | 'inspecting' | 'noticed' | 'accepted';
export interface ApartmentContact { phase: ApartmentPhase; elapsed: number; paid?: boolean; chairMotion?: 'stepping'; propMotion?: 'minidisc' }
export interface ApartmentGesture extends ApartmentContact { role: 'neo' | 'choi' | 'dujour' }
export interface ComputerInvestigation { phase: 'reading' | 'unplugging' | 'offline' | 'evidence' | 'saved' | 'replugging'; elapsed: number }
export const APARTMENT_NETWORK = { screen: { x: -9, y: 3.33, z: -11.595 }, screenApproach: { x: -11.6, z: -8.8 }, approach: { x: -6.65, z: -9.15, yaw: Math.PI }, plug: { x: -6.9, y: 2.65, z: -10.09 }, gripHeight: .17, seconds: 1.8, echoSeconds: 4.2 } as const;
export function computerCheckLocked(check?: ComputerInvestigation): boolean { return check?.phase === 'unplugging' || check?.phase === 'replugging'; }
export function computerNetworkPull(check?: ComputerInvestigation): number {
  if (!check || check.phase === 'reading') return 0;
  const t = smooth(Math.max(0, Math.min(1, (check.elapsed - .6) / .4)));
  return check.phase === 'unplugging' ? t : check.phase === 'replugging' ? 1 - t : 1;
}
export type WakeCallPhase = 'waking' | 'ringing' | 'pickup' | 'listening' | 'decision' | 'reply' | 'done' | 'leaving';
export interface WakeCall { phase: WakeCallPhase; elapsed: number; nightmare: boolean }
export interface MorningRoutine {
  phase: 'home' | 'lying' | 'sleeping' | 'alarm' | 'stopping' | 'rising' | 'ready' | 'done';
  elapsed: number; wakeAt?: number;
  approach?: { x: number; z: number; yaw: number };
}
export const MORNING = { lying: 3.2, sleeping: 1.8, stopping: 1.1, bedX: 8.05,
  mattressY: 1.385, pelvisY: 1.7, edgeX: 7.6, floorFootX: 6.67,
  alarm: { x: 6.45, y: 1.85, z: -10.75 }, exit: { x: 0, z: 23 } } as const;
export const APARTMENT_ROOM = { width: 34, depth: 40, exitWidth: 10, center: { x: 1210, y: 1, z: 690 } } as const;
export const APARTMENT_CHAIR = { x: -9, z: -8.4, width: 2, depth: 1.84, height: 2.75, seatY: 1.1, seatDepth: 1.6, backZ: -7.6 } as const;
export const APARTMENT_BOOK = { x: 6, y: .016, z: -5.3, scale: .4, pickup: 1.95, approach: { x: 5.9, z: -6.95, yaw: 0 } } as const;
export const APARTMENT = {
  computer: { ...APARTMENT_NETWORK.screenApproach, yaw: Math.PI },
  bed: { x: 10.2, z: -9, yaw: 0 },
  bedside: { x: 5.5, z: -9, yaw: -Math.PI / 2 },
  breakfast: { x: -7, z: 3.7 },
  phone: { x: -5.78, y: 2.62, z: -10.45, approachX: -5.8, approachZ: -9.15, yaw: Math.PI },
  door: { x: 0, z: 10.2, yaw: 0 },
  book: APARTMENT_BOOK.approach,
  choi: { x: 0, z: 13, yaw: Math.PI },
  dujour: { x: -1.1, z: 14.5, yaw: Math.PI - .4 },
  doorZ: 12, doorWidth: 3.8,
  signal: 8, knocking: 4, opening: 2.4, retrieving: 3.2, handover: 4.5,
} as const;
export const WAKE_CALL = { waking: 5.6, pickup: 2.2, listening: 8.6, reply: 4.2, leaving: 4.4 } as const;
export function computerInvestigationStep(check?: ComputerInvestigation) {
  const cable = check?.phase === 'reading' || check?.phase === 'saved' || computerCheckLocked(check);
  const point = cable ? APARTMENT_NETWORK.approach : APARTMENT_NETWORK.screenApproach;
  const target = !check ? 'anomaly:test' : check.phase === 'reading' ? 'computer:disconnect' : check.phase === 'evidence' ? 'computer:capture' : check.phase === 'saved' ? 'computer:reconnect' : undefined;
  const label = !check ? '查看显示器里的陌生文字' : check.phase === 'reading' ? '到桌边断开网线' : check.phase === 'unplugging' ? 'Neo 正在拔下网线'
    : check.phase === 'offline' ? '网络已断开，回到显示器前观察' : check.phase === 'evidence' ? '保存断网后的画面与本地日志' : check.phase === 'saved' ? '回到桌边重新接好网线' : 'Neo 正在接好网线';
  return { target, label, radius: .75, position: { x: APARTMENT_ROOM.center.x + point.x, y: 1, z: APARTMENT_ROOM.center.z + point.z } };
}
export const APARTMENT_FURNITURE = [
  { x: -9, z: -12, width: 8, depth: 3.4, height: 2.4 },
  APARTMENT_CHAIR,
  { x: 10.2, z: -9, width: 6.2, depth: 10, height: 1.5 },
  { x: 6.35, z: -10.75, width: 1.45, depth: 1.1, height: 1.62 },
  { x: 6, z: 6.2, width: 2.8, depth: 1.8, height: 1.8 },
  { x: APARTMENT_BOOK.x, z: APARTMENT_BOOK.z, width: .66, depth: .82, height: .2 },
  { x: -15.7, z: -4, width: 1.6, depth: 8, height: 5.3 },
  { x: -10, z: 6.8, width: 8, depth: 2.8, height: 2.9 },
  { x: -9.5, z: 12, width: 15, depth: .4, height: 8.8 },
  { x: 9.5, z: 12, width: 15, depth: .4, height: 8.8 },
];
const phases: ApartmentPhase[] = ['idle', 'signal', 'reply', 'knocking', 'door', 'opening', 'book', 'retrieving', 'disk', 'handover', 'invitation', 'inspecting', 'noticed', 'accepted'];
function computerFoot(t: number, side: 'R' | 'L') {
  const sign = side === 'R' ? 1 : -1;
  let x = APARTMENT.computer.x + sign * .276, z = APARTMENT.computer.z, yaw = Math.PI, lift = 0;
  const steps = side === 'R' ? [[.12, .5, APARTMENT.computer.x + 1, APARTMENT.computer.z - .9, Math.PI / 2], [.92, 1.3, APARTMENT_CHAIR.x + .276, APARTMENT.computer.z - 1.2, Math.PI]]
    : [[.52, .9, APARTMENT.computer.x + 1.5, APARTMENT.computer.z - .95, Math.PI / 2], [1.32, 1.72, APARTMENT_CHAIR.x - .276, APARTMENT.computer.z - 1.2, Math.PI]];
  for (const [start, end, tx, tz, heading] of steps) {
    const p = Math.max(0, Math.min(1, (t - start) / (end - start))), blend = smooth(p);
    x += (tx - x) * blend; z += (tz - z) * blend; yaw += (heading - yaw) * blend;
    if (t >= start && t <= end) lift = .2 * Math.sin(Math.PI * p);
  }
  return { x, z, yaw, lift };
}
export function apartmentComputerPose(contact: ApartmentContact) {
  const t = contact.elapsed;
  if (contact.chairMotion === 'stepping') {
    const stepTime = contact.phase === 'signal' ? Math.min(1.72, t) : contact.phase === 'knocking' ? Math.max(0, Math.min(1.72, 3.97 - t)) : 1.72;
    const feet = { R: computerFoot(stepTime, 'R'), L: computerFoot(stepTime, 'L') };
    if (contact.phase === 'knocking') for (const foot of Object.values(feet)) foot.yaw = Math.PI * 2 - foot.yaw;
    const seated = contact.phase === 'signal' ? smooth(Math.max(0, Math.min(1, (t - 1.85) / 1.2)))
      : contact.phase === 'knocking' ? 1 - smooth(Math.max(0, Math.min(1, (t - 1.4) / .8))) : 1;
    const approach = smooth(Math.max(0, Math.min(1, stepTime / 1.72)));
    const turn = smooth(Math.max(0, Math.min(1, stepTime / .32))) * (1 - smooth(Math.max(0, Math.min(1, (stepTime - 1.1) / .5))));
    const walking = smooth(Math.max(0, Math.min(1, stepTime / .12))) * (1 - smooth(Math.max(0, Math.min(1, (stepTime - 1.65) / .2))));
    return { x: (feet.R.x + feet.L.x) / 2, z: (feet.R.z + feet.L.z) / 2 + .35 * approach + .85 * seated,
      yaw: Math.PI + (contact.phase === 'knocking' ? 1 : -1) * Math.PI / 2 * turn, seated, feet, walking };
  }
  // Already saved performances finish with their original choreography.
  const seat = contact.phase === 'signal' ? smooth(Math.max(0, Math.min(1, (t - .2) / 1.2)))
    : contact.phase === 'knocking' ? 1 - smooth(Math.max(0, Math.min(1, (t - 2) / 1.2))) : 1;
  const move = contact.phase === 'signal' ? smooth(Math.max(0, Math.min(1, t / 1.3)))
    : contact.phase === 'knocking' ? 1 - smooth(Math.max(0, Math.min(1, (t - 2) / 1.4))) : 1;
  return { x: APARTMENT.computer.x + (APARTMENT_CHAIR.x - APARTMENT.computer.x) * move, z: APARTMENT.computer.z, yaw: APARTMENT.computer.yaw, seated: seat, feet: undefined, walking: 0 };
}
export function apartmentAfter(contact: ApartmentContact, phase: ApartmentPhase): boolean { return phases.indexOf(contact.phase) >= phases.indexOf(phase); }
export function apartmentBookCrouch(contact: ApartmentContact): number {
  return contact.phase === 'retrieving' ? smooth(Math.max(0, Math.min(1, contact.elapsed / .9))) * (1 - smooth(Math.max(0, Math.min(1, (contact.elapsed - 2.15) / 1.05)))) : 0;
}
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
export function morningBedPose(morning: MorningRoutine) {
  const t = morningWakePose(morning).elapsed;
  const blend = (start: number, end: number) => smooth(Math.max(0, Math.min(1, (t - start) / (end - start))));
  const turn = blend(.75, 2.1), rise = blend(2.65, 3.7), recline = 1 - blend(.25, 1.6);
  const approach = morning.phase === 'lying' ? morning.approach ?? APARTMENT.bedside : APARTMENT.bedside;
  let yaw = -Math.PI / 2 * turn;
  const sourceTurn = blend(5.1, WAKE_CALL.waking);
  yaw += Math.atan2(Math.sin(approach.yaw + Math.PI / 2), Math.cos(approach.yaw + Math.PI / 2)) * sourceTurn;
  const feet = (['R', 'L'] as const).map((side, i) => {
    const lower = blend(i ? 1.95 : 1.75, i ? 2.6 : 2.35), sign = i ? 1 : -1;
    const x = MORNING.bedX + (MORNING.edgeX - MORNING.bedX) * turn;
    const foot = { x: x + sign * .276 * Math.cos(yaw) + 2.13 * Math.sin(yaw),
      y: MORNING.pelvisY + .2 * Math.sin(Math.PI * lower), z: APARTMENT.bed.z - sign * .276 * Math.sin(yaw) + 2.13 * Math.cos(yaw),
      yaw, recline: 1 - lower, lift: 0 };
    foot.x += (MORNING.floorFootX - foot.x) * lower; foot.y += (.206 - foot.y) * lower;
    foot.z += (APARTMENT.bed.z + sign * .276 - foot.z) * lower;
    const step = blend(i ? 4.65 : 3.85, i ? 5.4 : 4.6);
    const targetX = approach.x + sign * .276 * Math.cos(approach.yaw), targetZ = approach.z - sign * .276 * Math.sin(approach.yaw);
    foot.x += (targetX - foot.x) * step; foot.z += (targetZ - foot.z) * step;
    foot.y += .18 * Math.sin(Math.PI * step); foot.lift = .18 * Math.sin(Math.PI * step);
    foot.yaw += Math.atan2(Math.sin(approach.yaw - foot.yaw), Math.cos(approach.yaw - foot.yaw)) * step;
    return foot;
  });
  let x = MORNING.bedX + (MORNING.edgeX - MORNING.bedX) * turn;
  x += (MORNING.floorFootX - x) * rise;
  if (t >= 3.7) x = (feet[0].x + feet[1].x) / 2;
  return { x, z: t >= 3.7 ? (feet[0].z + feet[1].z) / 2 : APARTMENT.bed.z, yaw: Math.atan2(Math.sin(yaw), Math.cos(yaw)), recline, rise, feet };
}
export function morningRoot(morning: MorningRoutine): { x: number; z: number; yaw: number } {
  const { x, z, yaw } = morningBedPose(morning); return { x, z, yaw };
}
export function morningText(morning: MorningRoutine): string {
  switch (morning.phase) {
    case 'home': return '回到熟悉的 101。你可以再看看房间，或走到床边按 G 休息；选择睡下才会推进到早晨。';
    case 'lying': return 'Neo 坐到床沿，慢慢躺下。夜店的音乐与陌生人的警告仍留在脑海里。';
    case 'sleeping': return '夜晚过去了。窗外逐渐亮起，闹钟已经错过了原定的起床时间。';
    case 'alarm': return '09:15。闹钟还在响——已经迟到了。按 G 伸手关掉闹钟，起床去公司。';
    case 'stopping': return 'Neo 伸手按下床头闹钟。';
    case 'rising': return '他坐起身，双脚落地，离开床边。今天仍然要去上班。';
    case 'ready': return '走出 101，穿过楼道来到街边，按 G 选择出发。出发后沿街步行去 Metacortex，再从大堂乘电梯上楼。';
    case 'done': return '你已来到街边。按 G 开始步行通勤，路程由你亲自完成。';
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
