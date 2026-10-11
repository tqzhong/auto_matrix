import type { FilmJourney } from './film-story.js';

export interface PillEncounter {
  phase: 'seating' | 'talking' | 'offering' | 'choice' | 'taking' | 'done';
  elapsed: number;
  choice?: 'red' | 'blue';
  conversation?: { beat: number; belief?: 'agency' | 'trust' };
  approach: { x: number; z: number; yaw: number };
}
export type PillGesture = Pick<PillEncounter, 'phase' | 'elapsed' | 'choice' | 'conversation'> & { role: 'neo' | 'morpheus' };
export const PILL_ROOM = { seat: 1.75, z: -6, tableZ: -7.35, tableY: 1.75, tableRadius: .64, cup: { x: .42, y: 2.03, z: -7.2 },
  fireplace: { x: 0, z: -10.8, width: 6.8, depth: 1.15, height: 4.55 },
  exit: { x: -3, z: -3.1 }, trackingDoor: { x: -6, z: -11.5 }, mirror: { x: -10, z: -17.62 } } as const;
export const PILL_TIMING = { seat: 2.2, offer: 5, take: 17, transfer: 1.8, swallow: 3.65, liftCup: 5.3, replaceCup: 8.6,
  stand: 11, walk: 13, exit: 15.7 } as const;
export const PILL_TALK_SECONDS = [6, 7, 8, 10] as const;
export const PILL_BELIEFS = [
  { id: 'agency', label: '我希望自己决定人生', reply: '如果一切早被安排，我的决定还有什么意义？我想自己选择。' },
  { id: 'trust', label: '我还不确定，想先听你解释', reply: '我现在还无法判断。我愿意听你说下去，但这不意味着我已经相信了一切。' },
] as const;

export function pillTalkReady(pills: Pick<PillEncounter, 'phase' | 'elapsed' | 'conversation'>): boolean {
  return pills.phase === 'talking' && pills.elapsed >= PILL_TALK_SECONDS[pills.conversation!.beat];
}

export function pillTalkCue(pills: Pick<PillEncounter, 'phase' | 'elapsed' | 'conversation'>) {
  const beat = pills.conversation?.beat ?? 0; const t = pills.elapsed;
  const change = beat === 1 ? 3.3 : beat === 2 ? 2.4 : beat === 3 ? 3 : 0;
  const line = (speaker: 'neo' | 'morpheus', text: string) => ({ speaker, text: `${speaker === 'neo' ? 'NEO' : 'MORPHEUS'} · ${text}`,
    from: speaker === 'neo' ? 0 : change, until: speaker === 'neo' ? change : PILL_TALK_SECONDS[beat] });
  if (beat === 0) return line('morpheus', t < 2.8 ? '熟悉的生活忽然变得陌生了。你仍想知道这背后藏着什么。' : '你觉得我们的人生早已被安排好了吗？');
  if (beat === 1) return t < 3.3 ? line('neo', PILL_BELIEFS.find(answer => answer.id === pills.conversation?.belief)!.reply)
    : line('morpheus', pills.conversation?.belief === 'agency' ? '那么，把这个决定留在你自己手里。你今天来到这里，不必由我替你解释。' : '那就先听我的解释，再用你自己的经历判断。你不必现在就相信我。');
  if (beat === 2) return t < 2.4 ? line('neo', '我遇到的那些异常，和矩阵有什么关系？')
    : line('morpheus', '办公室、街道、家中的屏幕——你一直生活在它里面。它把一套安排呈现成了理所当然的现实。');
  return t < 3 ? line('neo', '如果我身在其中，为什么一直没有看见边界？')
    : line('morpheus', '因为束缚着你的是认知，而不只是墙壁。我的解释还不够；你需要亲自面对那个答案。');
}

export function pillTalkPrompt(pills: Pick<PillEncounter, 'conversation'>): string {
  return pills.conversation?.beat === 1 ? '追问矩阵与日常异常' : pills.conversation?.beat === 2 ? '追问看不见的边界' : '听他解释两种选择';
}
export const pillEase = (time: number, from: number, to: number): number => {
  const t = Math.max(0, Math.min(1, (time - from) / (to - from))); return t * t * (3 - 2 * t);
};

export function pillLocked(journey: FilmJourney): boolean {
  return journey.scene === 'm1_pills' && !journey.visiting && !!journey.pills && journey.pills.phase !== 'done';
}

// One timeline drives bodies, hand props, the table glass and the saved outcome.
export function pillPose(gesture: PillGesture) {
  const t = gesture.elapsed; const taking = gesture.phase === 'taking'; const done = gesture.phase === 'done';
  const seating = gesture.phase === 'seating' || gesture.phase === 'offering' && !gesture.conversation;
  const talking = gesture.phase === 'talking';
  const cue = talking ? pillTalkCue(gesture) : undefined;
  const talk = cue?.speaker === gesture.role ? pillEase(t, cue.from, cue.from + .8) * (1 - pillEase(t, cue.until - .8, cue.until)) : 0;
  const rise = done ? 1 : taking ? pillEase(t, 9.6, PILL_TIMING.stand) : 0;
  const seat = gesture.role === 'morpheus' ? 1 : seating ? pillEase(t, .3, 1.8) : 1 - rise;
  const offer = talking || gesture.phase === 'seating' ? 0 : gesture.phase === 'offering' ? pillEase(t, 2, 3.6) : done ? 0 : taking ? 1 - pillEase(t, 2.2, 3.5) : 1;
  const reach = taking ? pillEase(t, .35, PILL_TIMING.transfer) * (1 - pillEase(t, 2.15, 3.45)) : 0;
  const mouth = taking ? pillEase(t, 2.15, 3.45) * (1 - pillEase(t, 3.85, 4.35)) : 0;
  const cupReach = taking ? pillEase(t, 4.1, PILL_TIMING.liftCup) * (1 - pillEase(t, PILL_TIMING.replaceCup, 9.2)) : 0;
  const drink = taking ? pillEase(t, 5.55, 6.6) * (1 - pillEase(t, 7.7, 8.6)) : 0;
  const tilt = taking ? pillEase(t, 6.6, 7.15) * (1 - pillEase(t, 7.7, 8.35)) : 0;
  return { seat, offer, reach, mouth, cupReach, drink, tilt, rise, talk,
    nod: talk * Math.sin(t * 2.1) * .025,
    lean: gesture.role === 'morpheus' ? -seat * .16 + offer * .1 + talk * .075 : seat * .16 + reach * .68 + cupReach * (1 - drink) * .24 + Math.sin(rise * Math.PI) * .42 + talk * .035,
    holdingPill: taking && t >= PILL_TIMING.transfer && t < PILL_TIMING.swallow,
    holdingCup: taking && t >= PILL_TIMING.liftCup && t < PILL_TIMING.replaceCup,
    cupUsed: done || taking && t >= PILL_TIMING.replaceCup,
  };
}

export function pillRoot(encounter: PillEncounter): { x: number; z: number; yaw: number } {
  const { seat, z } = PILL_ROOM;
  if (encounter.phase === 'seating' || encounter.phase === 'offering' && !encounter.conversation) {
    const t = pillEase(encounter.elapsed, 0, 1.8);
    const turn = Math.atan2(Math.sin(-Math.PI / 2 - encounter.approach.yaw), Math.cos(-Math.PI / 2 - encounter.approach.yaw));
    return { x: encounter.approach.x + (seat - encounter.approach.x) * t, z: encounter.approach.z + (z - encounter.approach.z) * t, yaw: encounter.approach.yaw + turn * t };
  }
  if (encounter.phase === 'talking' || encounter.phase === 'offering' || encounter.phase === 'choice') return { x: seat, z, yaw: -Math.PI / 2 };
  const t = encounter.elapsed;
  const rise = encounter.phase === 'done' ? 1 : encounter.phase === 'taking' ? pillEase(t, 9.6, PILL_TIMING.stand) : 0;
  const walk = encounter.phase === 'done' ? 1 : encounter.phase === 'taking' ? pillEase(t, PILL_TIMING.stand, PILL_TIMING.walk) : 0;
  const sidestep = encounter.phase === 'done' ? 1 : encounter.phase === 'taking' ? pillEase(t, PILL_TIMING.walk, PILL_TIMING.exit) : 0;
  const facing = -Math.PI / 2 + Math.PI / 2 * pillEase(rise, .5, 1);
  const walkingYaw = facing + (-Math.PI / 2 - facing) * pillEase(t, PILL_TIMING.walk - .1, PILL_TIMING.walk + .3);
  const doorYaw = Math.atan2(PILL_ROOM.trackingDoor.x - PILL_ROOM.exit.x, PILL_ROOM.trackingDoor.z - PILL_ROOM.exit.z);
  const finalYaw = encounter.choice === 'red' ? doorYaw : 0;
  const turn = Math.atan2(Math.sin(finalYaw + Math.PI / 2), Math.cos(finalYaw + Math.PI / 2));
  return { x: seat + (PILL_ROOM.exit.x - seat) * sidestep, z: z + (PILL_ROOM.exit.z - z) * walk,
    yaw: walkingYaw + turn * pillEase(t, PILL_TIMING.exit, PILL_TIMING.take) };
}

export function pillContact(color: 'red' | 'blue') {
  return { x: -.35, y: 2.35, z: PILL_ROOM.z + (color === 'red' ? .54 : -.54) };
}
