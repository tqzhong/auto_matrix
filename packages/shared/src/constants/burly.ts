import type { FilmJourney } from './film-story.js';

export type BurlyPhase = 'ready' | 'approaching' | 'grapple' | 'swarm' | 'staff_ready' | 'staff' | 'flight_ready' | 'flight' | 'done' | 'failed';
export interface BurlyEncounter {
  phase: BurlyPhase;
  elapsed: number;
  attempt: number;
  repelled: number;
  staffSwings: number;
  assimilation: number;
  nextCopyAt: number;
  flightFrom?: { x: number; y: number; z: number };
}

export const BURLY = {
  approach: 2.1,
  grapple: 6.5,
  flight: 2.4,
  staff: { x: 12, z: -13 },
  initialCopies: 4,
  maxCopies: 7,
  copyInterval: 5,
  staffAfterRepels: 2,
  escapeAfterSwings: 3,
} as const;

export function burlyLocked(journey: FilmJourney): boolean {
  return !journey.visiting && ['approaching', 'grapple', 'flight', 'done'].includes(journey.burly?.phase ?? '');
}

export function burlyText(encounter: BurlyEncounter): string {
  switch (encounter.phase) {
    case 'ready': return '乌鸦从长椅旁惊起。旧特工 Smith 独自走入庭院；靠近他，决定是否停下来听。';
    case 'approaching': return 'Smith 说他已脱离旧职责。庭院另一端出现了与他一模一样的人。';
    case 'grapple': return 'Smith 的手按入 Neo 胸口，黑色代码沿手臂蔓延。现在按 X 挣脱同化。';
    case 'swarm': return `Smith 在行人中复制，空出的地方又被新面孔填上。击退 ${encounter.repelled}/${BURLY.staffAfterRepels}，寻找可借力的栏杆。`;
    case 'staff_ready': return '人群再次合拢。冲到庭院右侧松动的金属栏杆旁，按 G 抽出长杆。';
    case 'staff': return `用 F 挥动长杆扫开包围。有效挥击 ${encounter.staffSwings}/${BURLY.escapeAfterSwings}；复制仍在继续。`;
    case 'flight_ready': return '围攻没有尽头。冲到庭院北侧空地，按 G 从人群上方脱离。';
    case 'flight': return 'Neo 向上冲破包围；地面上的 Smith 仍不断涌来。';
    case 'done': return 'Neo 飞离庭院。复制没有终止；先知留下的线索仍要继续追查。';
    case 'failed': return '同化几乎吞没 Neo。接线将他拉回庭院入口；按 G 从对峙前重试。';
  }
}
