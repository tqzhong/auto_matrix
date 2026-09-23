import type { FilmJourney } from './film-story.js';

export type AirRescueKind = 'office' | 'roof';
export type AirRescuePhase = 'ready' | 'approach' | 'firing' | 'leap_window' | 'catching'
  | 'impact' | 'bracing' | 'pulling' | 'failed' | 'done';
export type AirRescueRole = 'neo' | 'trinity' | 'morpheus' | 'smith' | 'agent_brown' | 'agent_jones';

export interface AirRescueEncounter {
  kind: AirRescueKind;
  phase: AirRescuePhase;
  elapsed: number;
  attempt: number;
  suppression?: number;
  grip?: number;
  braces?: number;
  misses?: number;
  resolved?: number[];
  ropeCut?: boolean;
  crash?: boolean;
  bursts?: number;
}

export type AirRescueGesture = AirRescueEncounter & { role: AirRescueRole };

export const AIR_RESCUE = {
  office: {
    approach: 2.6,
    fire: 3.6,
    leapAt: .8,
    leapWindow: 2.4,
    catching: 4.6,
  },
  roof: {
    impact: 3.2,
    duration: 7.2,
    beats: [1.25, 3.35, 5.55] as readonly number[],
    window: .58,
    pulling: 5.6,
  },
} as const;

const clamp = (value: number): number => Math.max(0, Math.min(1, value));
const smooth = (value: number): number => { const t = clamp(value); return t * t * (3 - 2 * t); };
const pulse = (time: number, center: number, radius: number): number => smooth(1 - Math.abs(time - center) / radius);

export function airRescueLocked(journey: FilmJourney): boolean {
  const encounter = journey.airRescue;
  return Boolean(encounter && !journey.visiting && encounter.phase !== 'failed');
}

export function airRescueRoot(encounter: AirRescueEncounter, role: AirRescueRole) {
  if (encounter.kind === 'office') {
    const approach = encounter.phase === 'ready' ? 0 : encounter.phase === 'approach'
      ? smooth(encounter.elapsed / AIR_RESCUE.office.approach) : 1;
    const catchProgress = encounter.phase === 'catching' || encounter.phase === 'done'
      ? smooth(encounter.elapsed / AIR_RESCUE.office.catching) : 0;
    const helicopter = { x: 19 - approach * 15 + catchProgress * 4.5, y: 1 + approach * .35 + catchProgress * 2.8, z: -36 - catchProgress * 2.2 };
    const gunner = { x: helicopter.x - 4.9, y: helicopter.y + 1.15, z: helicopter.z + .4 };
    if (role === 'neo') {
      if (encounter.phase !== 'catching' && encounter.phase !== 'done') return { ...gunner, yaw: 0 };
      const connect = smooth(encounter.elapsed / 1.4); const lift = smooth((encounter.elapsed - 1.1) / (AIR_RESCUE.office.catching - 1.1));
      return { x: gunner.x + (2.6 - gunner.x) * connect, y: gunner.y + (.4 - gunner.y) * connect + lift * 3.3,
        z: gunner.z + (-30 - gunner.z) * connect + lift * .2, yaw: 0 };
    }
    if (role === 'trinity') return { x: helicopter.x + 1.25, y: helicopter.y + 1.1, z: helicopter.z + 2.4, yaw: 0 };
    if (role === 'morpheus') {
      const free = encounter.phase === 'firing' ? smooth(((encounter.suppression ?? 0) - .35) / .65)
        : ['leap_window', 'catching', 'done'].includes(encounter.phase) ? 1 : 0;
      if (encounter.phase !== 'catching' && encounter.phase !== 'done') return { x: 0, y: 0, z: -2.2 - free * 20.2, yaw: Math.PI };
      const connect = smooth(encounter.elapsed / 1.4); const lift = smooth((encounter.elapsed - 1.1) / (AIR_RESCUE.office.catching - 1.1));
      return { x: 2.6 * lift, y: -1.3 * connect + lift * 5, z: -22.4 - connect * 7.6 + lift * .2, yaw: Math.PI };
    }
    const roots = {
      smith: { x: -5.5, y: 0, z: -8.5, yaw: .45 },
      agent_brown: { x: 0, y: 0, z: -10, yaw: 0 },
      agent_jones: { x: 5.4, y: 0, z: -8.3, yaw: -.5 },
    } as const;
    return roots[role as keyof typeof roots] ?? roots.smith;
  }

  if (role === 'neo') return { x: -28.5, y: 0, z: -22, yaw: -Math.PI / 2 };
  if (role === 'morpheus') return { x: -23, y: 0, z: -18.5, yaw: -2.4 };
  if (role === 'trinity') {
    const rising = encounter.phase === 'pulling' || encounter.phase === 'done' ? smooth(encounter.elapsed / 4.2) : 0;
    const crossing = encounter.phase === 'pulling' || encounter.phase === 'done' ? smooth((encounter.elapsed - 3.8) / 1.8) : 0;
    return { x: -35.2 + crossing * 6.7, y: -8.5 + rising * 8.5, z: -31 + rising * 5.8 + crossing * 2.4, yaw: .2 };
  }
  return { x: 14, y: 0, z: -18, yaw: -Math.PI / 2 };
}

export function airRescueText(encounter: AirRescueEncounter): string {
  if (encounter.kind === 'office') {
    if (encounter.phase === 'ready') return 'Neo 已挂好救援绳并守在 B-212 侧舱机枪后。按住 G 开始接近审讯层。';
    if (encounter.phase === 'approach') return 'Trinity 把机身贴向幕墙。稳住安全扣，等待射界打开。';
    if (encounter.phase === 'firing') return `按住 G 操作侧舱机枪，压制三名特工并打碎 Morpheus 面前的幕墙；火力 ${Math.round((encounter.suppression ?? 0) * 100)}%。`;
    if (encounter.phase === 'leap_window') return 'Morpheus 冲出破口却够不到机舱。救援绳摆到他上方时按 X 跃出抓住他。';
    if (encounter.phase === 'catching') return encounter.elapsed < 1.5 ? 'Neo 脱离机舱，抓住正在下坠的 Morpheus。'
      : encounter.elapsed < 3.2 ? '救援绳绷紧。Neo 承受冲击，仍抓着 Morpheus 的手臂。'
        : 'Trinity 拉升 B-212，两人被带离审讯层外墙。';
    if (encounter.phase === 'failed') return '救援绳从 Morpheus 身旁掠过。按 G 或在手记中重试直升机接应。';
    return 'Neo 已接住 Morpheus，Trinity 正把受损的 B-212 带向邻近屋顶。';
  }
  if (encounter.phase === 'ready') return 'Smith 的子弹击穿油箱。按住 G 抓紧连接 Trinity 的救援绳。';
  if (encounter.phase === 'impact') return 'Trinity 把 Morpheus 与 Neo 送上屋顶，失去动力的 B-212 开始下坠。';
  if (encounter.phase === 'bracing') return `持续按住 G 抓绳；绳索突然绷紧时按 X 卸力。握力 ${Math.round((encounter.grip ?? 0) * 100)}%，稳住 ${encounter.braces ?? 0}/3，失手 ${encounter.misses ?? 0}/1。`;
  if (encounter.phase === 'pulling') return encounter.elapsed < 1.5 ? 'Trinity 开枪切断机内绳索，摆离失控机体。'
    : encounter.elapsed < 3.4 ? 'B-212 旋翼撞入对面幕墙，整面玻璃像水面一样扩散破裂。'
      : 'Neo 在屋顶边缘稳住身体，把撞上低层窗面的 Trinity 拉回屋顶。';
  if (encounter.phase === 'failed') return '绳索把 Neo 拖过女儿墙，Trinity 没能脱离坠机轨迹。按 G 重试屋顶接应。';
  return 'Trinity 已被拉回屋顶。知道一条路与真正走过它之间，留下了新的差别。';
}

export function airRescuePose(gesture: AirRescueGesture) {
  if (gesture.kind === 'office') {
    const gun = gesture.role === 'neo' && gesture.phase === 'firing' ? smooth(gesture.elapsed / .35) : 0;
    const harness = gesture.role === 'neo' ? ['ready', 'approach', 'firing', 'leap_window', 'catching'].includes(gesture.phase) ? 1 : 0 : 0;
    const catchProgress = gesture.phase === 'catching' ? smooth(gesture.elapsed / 2.2) : gesture.phase === 'done' ? 1 : 0;
    const falling = gesture.role === 'morpheus' ? catchProgress : 0;
    const reaching = ['neo', 'morpheus'].includes(gesture.role) ? catchProgress : 0;
    const pilot = gesture.role === 'trinity' ? 1 : 0;
    const scatter = ['smith', 'agent_brown', 'agent_jones'].includes(gesture.role) && gesture.phase === 'firing'
      ? smooth((gesture.suppression ?? 0) * 1.4) : 0;
    return { gun, harness, fall: falling, reach: reaching, rope: catchProgress, strain: catchProgress * .85, pilot, scatter, cut: 0, land: 0 };
  }
  const shock = gesture.phase === 'bracing'
    ? Math.max(...AIR_RESCUE.roof.beats.map(beat => pulse(gesture.elapsed, beat, AIR_RESCUE.roof.window * 1.5))) : 0;
  const pulling = gesture.phase === 'pulling' ? smooth(gesture.elapsed / AIR_RESCUE.roof.pulling) : gesture.phase === 'done' ? 1 : 0;
  return {
    gun: 0,
    harness: gesture.role === 'neo' || gesture.role === 'trinity' ? 1 : 0,
    fall: gesture.role === 'trinity' ? 1 - pulling : 0,
    reach: ['neo', 'trinity'].includes(gesture.role) ? pulling : 0,
    rope: ['neo', 'trinity'].includes(gesture.role) && ['impact', 'bracing', 'pulling'].includes(gesture.phase) ? 1 : 0,
    strain: gesture.role === 'neo' ? shock * .65 + (1 - (gesture.grip ?? 1)) * .7 + (gesture.phase === 'pulling' ? .5 : 0) : 0,
    pilot: 0,
    scatter: 0,
    cut: gesture.role === 'trinity' && gesture.phase === 'pulling' ? pulse(gesture.elapsed, .9, .7) : 0,
    land: gesture.role === 'trinity' ? pulling : 0,
  };
}
