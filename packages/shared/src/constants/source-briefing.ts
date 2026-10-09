import type { FilmJourney } from './film-story.js';

// Reloaded's operation is planned inside the Matrix, in an abandoned apartment.
// The three paper plans and their inspection points are playable additions.
export const SOURCE_BRIEFING = {
  cast: ['neo', 'keymaker', 'morpheus', 'niobe', 'soren'] as const,
  entry: { x: -4.5, z: 10 },
  table: { x: 0, z: -2, width: 6.6, depth: 2.8, height: 2.5 },
  question: { x: 0, z: -5.8 },
  routes: [
    { id: 'primary', name: 'Logos · 主电网', paperX: -2.2, x: -4.5, z: -2,
      text: '钥匙匠说明主电站的保护回路。Niobe 与 Ghost 负责安放同步装置，主网断电后仍会启动应急供电。' },
    { id: 'emergency', name: 'Vigilant · 应急改线', paperX: 0, x: 0, z: 1.5,
      text: 'Soren 的队伍必须关闭应急改线。只切主电源，白门仍会触发防御；两支队伍缺一不可。' },
    { id: 'source', name: 'Nebuchadnezzar · 源头之门', paperX: 2.2, x: 4.5, z: -2,
      text: 'Neo 与 Morpheus 护送钥匙匠抵达隐藏楼层。两路供电关闭后，连接只保留 314 秒，Neo 必须在窗口内进入。' },
  ] as const,
  hearingSeconds: 5.5,
  captainsSeconds: 12,
  roots: {
    keymaker: { x: 0, y: 0, z: -9.4, yaw: 0 },
    morpheus: { x: -6.4, y: 0, z: -7.8, yaw: .95 },
    niobe: { x: 6.3, y: 0, z: -6.8, yaw: -1.05 },
    soren: { x: 7.4, y: 0, z: 4.8, yaw: -2.62 },
  },
  walls: [
    { x: -15.7, z: 0, width: .6, depth: 32, height: 7.5 },
    { x: 15.7, z: 0, width: .6, depth: 32, height: 7.5 },
    { x: 0, z: -15.7, width: 32, depth: .6, height: 7.5 },
    { x: 0, z: 15.7, width: 32, depth: .6, height: 7.5 },
  ],
} as const;
export type SourceRoute = typeof SOURCE_BRIEFING.routes[number]['id'];
export interface SourceBriefing {
  phase: 'review' | 'hearing' | 'question' | 'captains' | 'reflection' | 'done';
  reviewed: SourceRoute[]; selected?: SourceRoute; elapsed: number;
  paused?: string; unavailable?: string;
}
export type SourceBriefingGesture = SourceBriefing & { role: typeof SOURCE_BRIEFING.cast[number] };
export function sourceBriefingActive(journey?: FilmJourney): boolean { return journey?.scene === 'm2_plan' && !journey.visiting; }
export function sourceBriefingLocked(state?: SourceBriefing): boolean {
  return Boolean(state && (state.paused || state.unavailable || state.phase === 'hearing' || state.phase === 'captains'));
}
export function sourceBriefingTarget(state?: SourceBriefing) {
  if (state && ['question', 'captains', 'reflection', 'done'].includes(state.phase)) return SOURCE_BRIEFING.question;
  return SOURCE_BRIEFING.routes.find(route => route.id === state?.selected && state.phase === 'hearing')
    ?? SOURCE_BRIEFING.routes.find(route => !state?.reviewed.includes(route.id)) ?? SOURCE_BRIEFING.question;
}
export function sourceBriefingText(state?: SourceBriefing): string {
  if (state?.unavailable) return `${state.unavailable} 无法参与会议，进度已保留。先恢复这个角色的信号。`;
  if (state?.paused) return `${state.paused} 正由另一位玩家控制，会议停在保存的进度。`;
  if (state?.phase === 'hearing') return SOURCE_BRIEFING.routes.find(route => route.id === state.selected)!.text;
  if (state?.phase === 'question') return '三条路线已经核对。走到钥匙匠面前按 G，听 Niobe 对程序知识与预言的质疑。';
  if (state?.phase === 'captains') return state.elapsed < 4
    ? 'Niobe 追问钥匙匠为何知道这套保护系统。他把这些知识理解为自己被赋予的用途。'
    : state.elapsed < 8 ? 'Morpheus 把三位船长的合作视作实现预言的机会，认为风险仍值得承担。'
      : 'Niobe 仍保留怀疑：如果预言本身有误，他们就必须为这次决定的后果负责。';
  if (state?.phase === 'reflection') return 'J 记录你如何理解合作、程序用途与预言。Niobe 的怀疑不会被一次任务成功抹去。';
  if (state?.phase === 'done') return '三条行动路线与本次反思已保存。G 接入 Niobe 的发电厂路线。';
  const route = sourceBriefingTarget(state);
  return `WASD 绕过桌子，走近「${'name' in route ? route.name : '行动路线'}」的纸质计划，按 G 核对。等待不会替你完成检查。`;
}
