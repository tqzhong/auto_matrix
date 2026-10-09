import type { FilmJourney } from './film-story.js';

export const TRINITY_TERMINAL = {
  entry: { x: 0, z: 16 }, root: { x: 0, z: -11.9, yaw: Math.PI },
  desk: { x: 0, z: -14, width: 6.6, depth: 1.8, height: 2.18 },
  keyboard: { x: 0, y: 2.29, z: -13.26, width: 1.9, depth: .65 },
  screen: { x: 0, y: 3.01, z: -14.06, width: 1.6, height: 1.16 },
  scanSeconds: 3, typingSeconds: 4,
  nodes: [
    { id: 'web', address: '10.2.2.1', port: 80, service: 'HTTP / STATUS', label: '状态页面' },
    { id: 'ssh', address: '10.2.2.2', port: 22, service: 'SSH / ROUTE CONTROL', label: '路由控制' },
    { id: 'telemetry', address: '10.2.2.3', port: 161, service: 'SNMP / METERS', label: '仪表遥测' },
  ],
  walls: [
    { x: -14, z: 0, width: .5, depth: 42, height: 8 },
    { x: 14, z: 0, width: .5, depth: 42, height: 8 },
    { x: 0, z: -21, width: 28, depth: .5, height: 8 },
    ...[-1, 1].map(side => ({ x: side * 8.5, z: 21, width: 11, depth: .5, height: 8 })),
  ],
  desks: [-9, 9].flatMap(x => [-13, 0, 12].map(z => ({ x, z, width: 5.2, depth: 2.5, height: 2.18 }))),
} as const;

export interface TrinityTerminal {
  phase: 'ready' | 'scanning' | 'selecting' | 'typing' | 'armed' | 'deployed' | 'failed';
  elapsed: number; attempts: number; selected?: string; paused?: string; unavailable?: string; blocked?: string;
}
export function trinityTerminalActive(journey?: FilmJourney): boolean {
  return Boolean(journey && !journey.visiting && !journey.finished && journey.scene === 'm2_backup'
    && (journey.step === 1 || journey.step > 1 && journey.trinityTerminal));
}
export function trinityTerminalLocked(state?: TrinityTerminal): boolean { return Boolean(state && state.phase !== 'ready'); }
export function trinityTerminalText(state?: TrinityTerminal): string {
  if (state?.paused) return `${state.paused} 正由另一玩家控制；等待接线员的通信，不强占角色。`;
  if (state?.unavailable) return `${state.unavailable} 已失联；重试不能抹去队友的伤亡。`;
  if (state?.blocked) return state.blocked;
  const text = {
    ready: '走到电脑前，按 G 检查应急网络；城市仍在供电。',
    scanning: '终端正在列出网络服务。先找控制改线的接入点。',
    selecting: '选择提供 SSH 路由控制的节点；状态页和仪表不控制供电。',
    typing: '按住 G 输入覆盖程序；松开暂停，程序不会自动写完。',
    armed: '程序已经输入。按 G 明确提交，再交接 Neo 的走廊行动。',
    deployed: '覆盖程序已提交。G 接回 Neo；Trinity 的程序会与走廊行动并行执行。',
    failed: '该服务没有改线权限，终端拒绝接入。J 手记重试本段，先前伤亡和爆破保持。',
  };
  return text[state?.phase ?? 'ready'];
}
