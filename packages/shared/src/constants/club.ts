import type { FilmJourney } from './film-story.js';
import type { Philosophy } from '../types/neo-life.js';

export type ClubPhase = 'crowd' | 'approaching' | 'ready' | 'introduction' | 'listen' | 'whisper' | 'question' | 'reply' | 'departing' | 'done';
export interface ClubEncounter {
  phase: ClubPhase; elapsed: number; answer?: Philosophy;
  approach?: { x: number; z: number; yaw: number };
}
export interface ClubGesture extends ClubEncounter { role: 'neo' | 'trinity' }
export const CLUB = {
  neo: { x: 7, z: -4, yaw: Math.PI }, trinity: { x: 7, z: -6.5, yaw: 0 },
  exit: { x: 0, z: 22 }, approach: 8, introduction: 6, whisper: 14, reply: 6, departure: 8,
} as const;
export const CLUB_ROUTE = [{ x: -9, z: -17 }, { x: -4, z: -17 }, { x: 7, z: -12 }, CLUB.trinity];
export const CLUB_OBSTACLES = [
  { x: 17.8, z: -8, width: 3.2, depth: 21, height: 2.65 },
  ...[-12, 12].flatMap(x => [-18, 0, 18].map(z => ({ x, z, width: 1.3, depth: 1.3, height: 11 }))),
  ...[-14, -5, 5, 14].map(x => ({ x, z: -25, width: 2.5, depth: 2.7, height: 5.6 })),
  ...[-16.5, 16.5].map(x => ({ x, z: 12, width: 3.6, depth: 3.6, height: 2.3 })),
];
// Leave the entrance aisle, conversation and Trinity's approach free of dancers.
export const CLUB_DANCERS = [
  [-7, 10], [-3, 8], [4, 9], [8, 12], [-8, 4], [-4, 1], [2, 2], [-8, -5],
  [-3, -8], [1, -6], [-14, -8], [-15, 4], [12, -12], [11, 6], [-3, -22], [2, -20],
].map(([x, z], i) => ({ x, z, yaw: i * 2.31, scale: .88 + i % 4 * .05 }));
const smooth = (value: number) => { const t = Math.max(0, Math.min(1, value)); return t * t * (3 - 2 * t); };

export function clubLocked(journey: FilmJourney): boolean {
  return journey.scene === 'm1_club' && !journey.visiting && ['introduction', 'listen', 'whisper', 'question', 'reply'].includes(journey.club?.phase ?? '');
}
export function clubRoute(progress: number): { x: number; z: number; yaw: number } {
  const segments = CLUB_ROUTE.slice(1).map((p, i) => Math.hypot(p.x - CLUB_ROUTE[i].x, p.z - CLUB_ROUTE[i].z));
  let remaining = Math.max(0, Math.min(1, progress)) * segments.reduce((a, b) => a + b, 0);
  for (let i = 0; i < segments.length; i++) {
    if (remaining <= segments[i] || i === segments.length - 1) {
      const from = CLUB_ROUTE[i]; const to = CLUB_ROUTE[i + 1]; const t = remaining / segments[i];
      return { x: from.x + (to.x - from.x) * t, z: from.z + (to.z - from.z) * t, yaw: Math.atan2(to.x - from.x, to.z - from.z) };
    }
    remaining -= segments[i];
  }
  return { ...CLUB.trinity };
}
export function clubCloseness(encounter: ClubEncounter): number {
  return encounter.phase === 'whisper' ? smooth(encounter.elapsed / 1.8) : encounter.phase === 'question' || encounter.phase === 'reply' ? 1
    : encounter.phase === 'departing' ? 1 - smooth(encounter.elapsed / 1.5) : 0;
}
export function clubRoot(encounter: ClubEncounter, role: 'neo' | 'trinity'): { x: number; z: number; yaw: number } {
  if (role === 'neo') {
    const origin = encounter.approach ?? CLUB.neo; const t = encounter.phase === 'introduction' ? smooth(encounter.elapsed / 1.5) : 1;
    const turn = Math.atan2(Math.sin(CLUB.neo.yaw - origin.yaw), Math.cos(CLUB.neo.yaw - origin.yaw));
    return { x: origin.x + (CLUB.neo.x - origin.x) * t, z: origin.z + (CLUB.neo.z - origin.z) * t, yaw: origin.yaw + turn * t };
  }
  if (encounter.phase === 'crowd') return clubRoute(0);
  if (encounter.phase === 'approaching') return clubRoute(encounter.elapsed / CLUB.approach);
  if (encounter.phase === 'done' || encounter.phase === 'departing' && encounter.elapsed > 1.5) {
    const pose = clubRoute(encounter.phase === 'done' ? 0 : 1 - (encounter.elapsed - 1.5) / (CLUB.departure - 1.5));
    return { ...pose, yaw: pose.yaw + Math.PI };
  }
  const close = clubCloseness(encounter);
  return { x: CLUB.trinity.x - .72 * close, z: CLUB.trinity.z + 1.77 * close, yaw: .64 * close };
}
export function clubText(encounter: ClubEncounter): string {
  switch (encounter.phase) {
    case 'crowd': return '穿过舞池，走到侧面的拱墙旁。白兔把你带到这里，但没有解释原因。';
    case 'approaching': return '人群另一侧，一个短发女人正向你走来。你仍可以走动，也可以留下听她说话。';
    case 'ready': return 'TRINITY · 你好，Neo。\n她知道你的网名。靠近后按 G 回应。';
    case 'introduction': return encounter.elapsed < 2.7 ? 'NEO · 我听过 Trinity 这个名字。电脑上的消息，是你发的吗？' : 'TRINITY · 我需要见你。他们已经在留意你了。';
    case 'listen': return '她靠近一些，避开嘈杂的人声。按 G 追问她为什么来找你。';
    case 'whisper': return encounter.elapsed < 4 ? 'TRINITY · 你一夜又一夜地寻找，不只是为了找到某一个人。'
      : encounter.elapsed < 8 ? 'TRINITY · 你一直觉得熟悉的生活里，有什么地方不对。'
      : encounter.elapsed < 11 ? 'NEO · Matrix 究竟是什么？' : 'TRINITY · 你正在找的答案也在接近你。现在先保持警觉。';
    case 'question': return '她说出了你从未告诉她的疑问。你要追问她的依据、朋友的处境，还是先建立有限的信任？J 回应。';
    case 'reply': return 'Trinity 留在你身旁，认真回答你的问题。';
    case 'departing': return '她退回人群。你可以继续观察夜店，准备好后亲自走到出口，回到第二天的生活。';
    case 'done': return '刚才的交谈已经记入手记。答案还没有出现；明天，你仍然是要去上班的 Anderson。';
  }
}
