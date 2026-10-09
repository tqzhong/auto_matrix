import type { FilmJourney } from './film-story.js';

// Reloaded's synchronized demolition; three installation points are a playable extension.
export const PRIMARY_DEMOLITION = {
  entry: { x: 0, z: 18 },
  installSeconds: 2.2, syncCycle: 3.2, syncStart: 1.1, syncEnd: 2.2, retreatSeconds: 35,
  sites: [
    { id: 'west', name: '西侧变压器', x: -14.45, z: -11, yaw: -Math.PI / 2, contact: { x: -15.46, y: 3, z: -11 } },
    { id: 'east', name: '东侧母线', x: 14.45, z: 1, yaw: Math.PI / 2, contact: { x: 15.46, y: 3, z: 1 } },
    { id: 'clock', name: '同步控制器', x: 0, z: -29.4, yaw: Math.PI, contact: { x: 0, y: 3, z: -30.6 } },
  ] as const,
  observation: { x: 0, z: 41 },
  countdownSeconds: 6, blastSeconds: 8, emergencyReturnSeconds: 2.5,
  roof: { x: 0, y: 17.8, z: -10, width: 64, depth: 69, height: .4 },
  ramp: { width: 8.4, start: 30, end: 38, top: 3.2, finish: 44 },
  terminal: { x: 0, z: -32.3, width: 8, depth: 3, height: 6 },
  banks: [-19.2, 19.2].flatMap(x => [-35, -23, -11, 1, 13].map(z => ({ x, z, width: 7, depth: 5, height: 9 }))),
  walls: [
    { x: -31.7, z: -10, width: .6, depth: 69, height: 18 },
    { x: 31.7, z: -10, width: .6, depth: 69, height: 18 },
    { x: 0, z: -44.7, width: 64, depth: .6, height: 18 },
    ...[-20, 20].map(x => ({ x, z: 24.7, width: 24, depth: .6, height: 18 })),
  ],
  rails: [-4.5, 4.5].flatMap(x => [31, 33, 35, 37, 39, 41, 43].map(z => ({ x, z, width: .18, depth: 2,
    height: Math.min(3.2, Math.max(0, (z + 1 - 30) / 8 * 3.2)) + 2.2 }))),
} as const;
export interface PrimaryDemolition {
  phase: 'install' | 'mounting' | 'sync' | 'retreat' | 'failed' | 'done';
  installed: string[]; selected?: number; elapsed: number; remaining: number; attempts: number;
  paused?: string; unavailable?: string;
  blast?: { phase: 'ready' | 'countdown' | 'blast' | 'done'; elapsed: number };
}
export function primaryActive(journey?: FilmJourney): boolean { return Boolean(journey && !journey.visiting && (journey.scene === 'm2_power' && journey.step > 0 || journey.scene === 'm2_blackout')); }
export function primaryLocked(state?: PrimaryDemolition): boolean { return Boolean(state && (state.paused || state.unavailable || state.phase === 'mounting' || state.phase === 'failed' || state.blast && ['countdown', 'blast'].includes(state.blast.phase))); }
export function primaryCameraBlocked(x: number, y: number, z: number, radius: number): boolean {
  // Camera collision follows physical surfaces, not the captain's walkable perimeter.
  const p = PRIMARY_DEMOLITION;
  if (y - radius < primaryFloor(x, z)) return true;
  if ([...p.banks, ...p.walls, ...p.rails, p.terminal].some(box => y - radius < box.height && y + radius > 0
    && Math.abs(x - box.x) < box.width / 2 + radius && Math.abs(z - box.z) < box.depth / 2 + radius)) return true;
  return Math.abs(y - p.roof.y) < p.roof.height / 2 + radius
    && Math.abs(x) < p.roof.width / 2 + radius && Math.abs(z - p.roof.z) < p.roof.depth / 2 + radius;
}
export function primaryFloor(x: number, z: number): number {
  const r = PRIMARY_DEMOLITION.ramp;
  return Math.abs(x) <= r.width / 2 && z >= r.start && z <= r.finish ? Math.min(r.top, (z - r.start) / (r.end - r.start) * r.top) : 0;
}
export function primaryTarget(state?: PrimaryDemolition) {
  if (state?.phase === 'retreat' || state?.phase === 'done' || state?.phase === 'failed') return PRIMARY_DEMOLITION.observation;
  return PRIMARY_DEMOLITION.sites[state?.phase === 'sync' ? 2 : state?.selected ?? Math.max(0, PRIMARY_DEMOLITION.sites.findIndex(site => !state?.installed.includes(site.id)))];
}
export function primaryMountPoint(state: PrimaryDemolition) {
  const site = PRIMARY_DEMOLITION.sites[state.selected!], amount = Math.min(1, state.elapsed / .7), blend = amount * amount * (3 - 2 * amount);
  const x = site.x + Math.sin(site.yaw) * .38, z = site.z + Math.cos(site.yaw) * .38;
  return { x: x + (site.contact.x - x) * blend, y: 2.1 + (site.contact.y - 2.1) * blend, z: z + (site.contact.z - z) * blend };
}
export function primaryWatchAmount(state: PrimaryDemolition): number {
  if (state.blast?.phase !== 'countdown') return 0;
  const up = Math.min(1, state.blast.elapsed / .65), down = Math.max(0, Math.min(1, (4.8 - state.blast.elapsed) / 1.2));
  return up * up * (3 - 2 * up) * down * down * (3 - 2 * down);
}
export function primaryText(state?: PrimaryDemolition): string {
  if (state?.paused) return `${state.paused} 正由其他玩家控制，装置和撤离时钟已暂停。`;
  if (state?.unavailable) return `${state.unavailable} 已无法参加行动，不能用重新布景抹去伤亡。`;
  if (state?.blast?.phase === 'ready') return '回到观察桥，等 Ghost 安全撤到桥上，按 G 检查同步时刻。装置会在午夜起爆，并非远程手动起爆。';
  if (state?.blast?.phase === 'countdown') return `午夜同步倒数 ${Math.ceil(PRIMARY_DEMOLITION.countdownSeconds - state.blast.elapsed)} 秒。主网仍通电；暂停或离开会保留同步进度。`;
  if (state?.blast?.phase === 'blast') return state.blast.elapsed < PRIMARY_DEMOLITION.emergencyReturnSeconds
    ? '同步装置起爆，主网熄灭。观察桥在爆破范围外；应急线路还没有关闭。'
    : '主网已毁，但城市灯光开始恢复：应急系统正在重新供电。Trinity 必须补上缺口，白门尚未解除保护。';
  if (state?.blast?.phase === 'done') return '午夜爆破结束，主网已毁，应急系统仍在线。继续接回现实飞船上的 Trinity，核对信号并决定是否接入。';
  if (!state || state.phase === 'install') return `亲自检查并安装三个同步装置（游戏扩展）：${state?.installed.length ?? 0}/3。走到标记旁按 G 开始，按住 G 固定。`;
  if (state.phase === 'mounting') return `按住 G 将装置固定在 ${PRIMARY_DEMOLITION.sites[state.selected!].name}；松手保留 ${Math.round(state.elapsed / PRIMARY_DEMOLITION.installSeconds * 100)}% 进度。`;
  if (state.phase === 'sync') return '三个装置已接入。等同步盘指针进入绿色区，再按 G 校准换班时刻；主网与应急系统各有独立保护。';
  if (state.phase === 'retreat') return `同步装置已武装，${Math.ceil(state.remaining)} 秒内带 Ghost 撤到厂房外的观察桥，再按 G 确认安全。`;
  if (state.phase === 'failed') return '未及时撤离，换班安保锁住了同步线路。按 J 重试当前撤离检查点；已安装装置和其他人物伤势保留。这是游戏中的失败路线。';
  return 'Logos 队伍已撤到观察桥，同步装置已武装。主网尚未爆破，应急系统仍在线；继续接回 Trinity 核对 Vigilant 的信号。';
}
