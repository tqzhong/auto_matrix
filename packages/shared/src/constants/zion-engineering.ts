import type { FilmJourney } from './film-story.js';

export const ZION_ENGINEERING = {
  radius: 1.1, approachSeconds: .55,
  readings: { x: -5.9, z: -24, yaw: -Math.PI / 2, seconds: 3, control: { x: -7.2, y: 3.05, z: -24, depth: 1.8 }, buttonZ: -.78 },
  valve: { x: 5.9, z: -24, yaw: Math.PI / 2, seconds: 5, control: { x: 7.2, y: 3.05, z: -24, depth: 1.4 }, radius: .42, turn: Math.PI / 2 },
};

export interface EngineeringEncounter {
  readings: number;
  valve: number;
  elapsed: number;
  operation?: 'readings' | 'valve';
  approach?: { x: number; z: number; yaw: number };
}

export function newEngineering(step = 0): EngineeringEncounter {
  return { readings: step > 1 ? 1 : 0, valve: step > 2 ? 1 : 0, elapsed: 0 };
}

export function engineeringActive(journey?: FilmJourney): boolean {
  return journey?.scene === 'm2_hamann' && !journey.visiting;
}

export function engineeringProgress(journey?: FilmJourney): EngineeringEncounter {
  if (engineeringActive(journey) && journey?.engineering) return journey.engineering;
  return newEngineering(journey?.completed.includes('m2_hamann') ? 4 : journey?.scene === 'm2_hamann' ? journey.step : 0);
}

export function engineeringReadings(valve: number) {
  return { air: 96, water: Math.round(68 + 28 * valve), heat: Math.round(74 + 20 * valve) };
}

export function engineeringPalm(state: EngineeringEncounter, side: 'R' | 'L') {
  if (state.operation === 'readings') {
    const control = ZION_ENGINEERING.readings.control;
    return { x: control.x + (side === 'R' ? .22 : .1), y: control.y - (side === 'R' ? 0 : .4), z: control.z + (side === 'R' ? ZION_ENGINEERING.readings.buttonZ : .4) };
  }
  const wheel = ZION_ENGINEERING.valve, sign = side === 'R' ? 1 : -1, angle = state.valve * wheel.turn;
  return { x: wheel.control.x - .175, y: wheel.control.y - sign * Math.sin(angle) * wheel.radius, z: wheel.control.z + sign * Math.cos(angle) * wheel.radius };
}

export function engineeringText(state: EngineeringEncounter, step: number): string {
  if (step === 1) return state.operation === 'readings'
    ? `正在控制台核对空气、回收水和供热读数：${Math.round(state.readings * 100)}%。移动可以中断检查。`
    : '走到栈桥左侧控制台旁，按 G 检查空气、回收水和供热读数。';
  if (step === 2) return `备用循环阀：${Math.round(state.valve * 100)}%。在右侧手轮旁按住 G 转动，松手或移动会停下，当前角度保留。`;
  return '备用循环已恢复平衡。回到 Hamann 身旁，想一想控制机器也意味着承担什么。';
}
