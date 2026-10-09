import type { FilmJourney } from './film-story.js';

// The rescue party speaks to the new Oracle in her living room. Neo's later
// kitchen visit is a separate scene. Questions and following are game controls.
export const ORACLE_REQUEST = {
  cast: ['trinity', 'oracle', 'morpheus', 'seraph'] as const,
  question: { x: -4.6, z: 12 },
  exit: { x: 0, z: 32 },
  table: { x: -7.1, z: 14, width: 2.4, depth: 5, height: 1.45 },
  oracle: { x: -10.95, z: 14, yaw: Math.PI / 2, seat: 1.1 },
  morpheus: { x: -4.2, z: 18, yaw: -2.1 },
  seraph: { x: -1.25, z: 23, yaw: Math.PI },
  identity: [
    'Trinity：外貌变了。我们凭什么确定你还是同一个人？',
    '先知：我曾作出一个帮助 Neo 的选择，也为它付出了代价。你们仍然得自己判断我是谁。',
  ],
  route: [
    'Trinity：Neo 还在 Hammer 上昏迷。我们该去哪里找他？',
    '先知：他的意识被困在两个世界之间。Trainman 看守这条线路，受命于 Merovingian。',
    'Morpheus：如果连预言也需要重新判断，我们还能相信什么？',
    '先知：信任由你们自己决定。眼下，你们的朋友需要帮助。Seraph 会带路。',
  ],
  lineSeconds: 4.5,
  guideLength: 14,
  guideSpeed: 1.25,
} as const;

export interface OracleRequest {
  phase: 'ready' | 'answering' | 'reflection' | 'guiding' | 'done';
  elapsed: number; guide: number;
  paused?: string; unavailable?: string;
}
export type OracleRequestGesture = OracleRequest & { role: typeof ORACLE_REQUEST.cast[number]; step: number };
export function oracleRequestActive(journey?: FilmJourney): boolean { return journey?.scene === 'm3_oracle_request' && !journey.visiting; }
export function oracleRequestLocked(state?: OracleRequest): boolean { return Boolean(state && (state.paused || state.unavailable || state.phase === 'answering')); }
export function oracleRequestLine(state: OracleRequest, step: number): string {
  const lines = step === 0 ? ORACLE_REQUEST.identity : ORACLE_REQUEST.route;
  return lines[Math.min(lines.length - 1, Math.floor(state.elapsed / ORACLE_REQUEST.lineSeconds))];
}
export function oracleRequestText(state?: OracleRequest, step = 0): string {
  if (state?.unavailable) return `${state.unavailable} 无法参与求援。会面进度已保留，没有重置这个角色的伤势。`;
  if (state?.paused) return `${state.paused} 正由另一位玩家控制。交谈与带路停在保存的进度。`;
  if (state?.phase === 'answering') return oracleRequestLine(state, step);
  if (state?.phase === 'done') return '求援与反思已保存。G 跟随 Seraph 接入寻找 Trainman 的路线。';
  if (step === 2) return 'J 记录你如何看待这次信任。救回朋友与相信预言，可以是两件分别作出的决定。';
  if (step >= 3) return 'WASD 跟着 Seraph 走向公寓出口。他会等落后的同伴；跨过门槛才完成离开。';
  return step === 0 ? '走到客厅茶几右侧，按 G 向坐在沙发上的先知确认身份。' : '按 G 询问 Neo 的下落，听完 Morpheus 的疑问与先知的回应。';
}
export function oracleRequestRoot(state: OracleRequest, role: 'seraph' | 'morpheus') {
  if (state.phase !== 'guiding' && state.phase !== 'done') return ORACLE_REQUEST[role];
  const t = Math.max(0, Math.min(ORACLE_REQUEST.guideLength, state.guide));
  if (role === 'seraph') return { x: -1.25, z: 23 + t, yaw: 0 };
  // A clear route around the table, behind the guide and on the visitor's right.
  if (t < 3) return ORACLE_REQUEST.morpheus;
  if (t < 6) return { x: -4.2 + (t - 3) * 1.8, z: 18, yaw: Math.PI / 2 };
  return { x: 1.2, z: 18 + (t - 6) * 2.1, yaw: 0 };
}
