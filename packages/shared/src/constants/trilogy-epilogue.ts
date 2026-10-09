import { gardenPose, gardenDeparturePose } from './sunrise-garden.js';

export const STREET_RESET = {
  facade: { x: 0, z: -15, width: 122, depth: 1.2, height: 15 },
  curb: 9.35, roadDrop: .15, entry: { x: 0, z: -7 },
} as const;

export const TRILOGY_EPILOGUE = {
  seconds: {
    retreat: 5.2,
    running: 2.6,
    announcement: 3.2,
    embrace: 4.4,
    disconnecting: 2.8,
    lowering: 3.1,
    transfer: 3.2,
    departing: 5.2,
    waking: 3.2,
    cat: 6,
    sitting: 2.4,
    architect: 5.4,
    leaving: 4.8,
    sati: 9.2,
    sunrise: 6.2,
    belief: 3.6,
  },
} as const;

export type TrilogyEpilogueKind = 'ceasefire' | 'neo_carried' | 'reset' | 'dawn';
export type TrilogyEpiloguePhase = 'ready' | 'retreat' | 'message_ready' | 'running' | 'announcement' | 'embrace'
  | 'disconnecting' | 'lowering' | 'transfer' | 'departing'
  | 'waking' | 'cat' | 'sitting' | 'architect' | 'choice' | 'leaving' | 'promise' | 'sati' | 'sunrise' | 'belief' | 'done';

export interface TrilogyEpilogueEncounter {
  kind: TrilogyEpilogueKind;
  phase: TrilogyEpiloguePhase;
  elapsed: number;
  total: number;
  parkApproach?: { x: number; z: number; yaw: number };
  /** Existing active saves retain the earlier wake-first timing. */
  resetVersion?: 2;
  /** New park arrivals cross the hill; already playing saves retain the waterfront route. */
  parkArrivalVersion?: 2;
  /** Departure keeps moving during the welcome prompt; legacy saves start at their current pose. */
  parkDeparture?: { elapsed: number; origin: { x: number; z: number; yaw: number } };
}

export interface TrilogyEpilogueGesture extends TrilogyEpilogueEncounter {
  role: 'kid' | 'morpheus' | 'niobe' | 'zee' | 'link' | 'neo' | 'oracle' | 'architect' | 'sati' | 'seraph';
}

export type CeasefireReunionRole = 'morpheus' | 'niobe' | 'link' | 'zee';

/** Both the world and the visible bodies follow the saved approach, without a phase-boundary jump. */
export function ceasefireReunionPose(encounter: TrilogyEpilogueEncounter, role: CeasefireReunionRole) {
  const firstPair = role === 'morpheus' || role === 'niobe', left = role === 'morpheus' || role === 'link';
  const t = encounter.phase === 'done' ? TRILOGY_EPILOGUE.seconds.embrace : encounter.phase === 'embrace' ? encounter.elapsed : 0;
  const delay = firstPair ? .35 : 0;
  const smooth = (start: number, end: number) => {
    const p = Math.max(0, Math.min(1, (t - start) / (end - start))); return p * p * (3 - 2 * p);
  };
  const approach = smooth(delay + .1, delay + 1.75), embrace = smooth(delay + 1.35, delay + 2.35);
  const startX = firstPair ? left ? -6 : -2.2 : left ? 3 : 6.5;
  const center = firstPair ? -4.1 : 4.75, endX = center + (left ? -.52 : .52);
  const stride = Math.sin(approach * Math.PI * 4) * Math.sin(approach * Math.PI);
  return { x: startX + (endX - startX) * approach, z: (firstPair ? 17 : 19) + (left ? -.3 : .3) * approach,
    yaw: left ? Math.PI / 2 : -Math.PI / 2, approach, embrace, stride, t };
}

const running = new Set<TrilogyEpiloguePhase>([
  'retreat', 'running', 'announcement', 'embrace', 'disconnecting', 'lowering', 'transfer', 'departing',
  'waking', 'cat', 'sitting', 'architect', 'leaving', 'sati', 'sunrise', 'belief',
]);

export function newTrilogyEpilogue(kind: TrilogyEpilogueKind): TrilogyEpilogueEncounter {
  return { kind, phase: 'ready', elapsed: 0, total: 0, ...(kind === 'reset' ? { resetVersion: 2 as const } : {}),
    ...(kind === 'dawn' ? { parkArrivalVersion: 2 as const } : {}) };
}

/** The withdrawal stays outside the temple lintel and uses the saved performance clock. */
export function ceasefireSentinelPose(encounter: TrilogyEpilogueEncounter, index: number) {
  const progress = encounter.phase === 'retreat' ? trilogyEpilogueProgress(encounter)
    : ['message_ready', 'running', 'announcement', 'embrace', 'done'].includes(encounter.phase) ? 1 : 0;
  const eased = progress * progress * (3 - 2 * progress), row = Math.floor(index / 6);
  const turn = Math.min(1, progress * 3), clock = encounter.total;
  return { x: (index % 6 - 2.5) * 5.4 + row % 2 * 1.8, y: 9 + row * 4 + eased * 62,
    z: -63 - row * 8 - eased * (32 + row * 4), pitch: eased * .52,
    yaw: Math.PI * turn * turn * (3 - 2 * turn), roll: Math.sin(clock * 1.6 + index) * .025,
    visible: progress < .999, clock };
}

function epilogueSeconds(encounter: TrilogyEpilogueEncounter): number | undefined {
  if (encounter.kind === 'dawn' && encounter.parkArrivalVersion === 2 && encounter.phase === 'sati') return 12;
  if (encounter.kind === 'reset' && encounter.resetVersion === 2) {
    if (encounter.phase === 'cat') return 8.8;
    if (encounter.phase === 'waking') return 7.2;
  }
  return TRILOGY_EPILOGUE.seconds[encounter.phase as keyof typeof TRILOGY_EPILOGUE.seconds];
}

/** One saved clock drives the street, cat, eyelids and body; renderer time cannot advance it. */
export function streetResetPose(encounter: TrilogyEpilogueEncounter) {
  const smooth = (value: number, start: number, end: number) => {
    const t = Math.max(0, Math.min(1, (value - start) / (end - start))); return t * t * (3 - 2 * t);
  };
  const modern = encounter.resetVersion === 2, progress = trilogyEpilogueProgress(encounter);
  const rising = encounter.phase === 'ready' || modern && encounter.phase === 'cat' ? 0
    : encounter.phase === 'waking' ? progress : 1;
  const cat = encounter.phase === 'cat' ? progress : encounter.phase === 'done' || modern && encounter.phase === 'waking' ? 1 : 0;
  const leaving = modern && encounter.phase === 'waking' ? smooth(encounter.elapsed, 1.2, 6.4) : modern && encounter.phase === 'done' ? 1 : 0;
  return { rising, pavement: smooth(cat, 0, .78),
    closedEyes: modern && (encounter.phase === 'ready' || encounter.phase === 'cat') ? 1 - smooth(encounter.elapsed, 7.4, 8.8) : 0,
    catX: -8 + smooth(cat, 0, 1) * 10.4 + leaving * 4.6, catZ: -10.9 - leaving * 1.2,
    catYaw: leaving * .25, catWalk: encounter.phase === 'cat' ? Math.sin(progress * Math.PI) : Math.sin(leaving * Math.PI),
    catClock: encounter.total, visible: encounter.phase !== 'ready' };
}

export function trilogyEpilogueLocked(encounter?: TrilogyEpilogueEncounter): boolean {
  return Boolean(encounter && (encounter.kind === 'neo_carried' || encounter.kind === 'reset'
    || encounter.kind === 'dawn' && encounter.phase !== 'ready' || running.has(encounter.phase)));
}

/** The physical body and its carrier share one saved trajectory, including the final resting frame. */
export function neoCarryPose(encounter: TrilogyEpilogueEncounter) {
  const progress = trilogyEpilogueProgress(encounter), eased = progress * progress * (3 - 2 * progress);
  const lowering = encounter.phase === 'lowering' ? eased : ['transfer', 'departing', 'done'].includes(encounter.phase) ? 1 : 0;
  const transfer = encounter.phase === 'transfer' ? eased : ['departing', 'done'].includes(encounter.phase) ? 1 : 0;
  const depart = encounter.phase === 'departing' ? eased : encounter.phase === 'done' ? 1 : 0;
  return { x: depart * 14, y: 2.4 * (1 - lowering) + depart * 1.2, z: -25 - transfer * 9 - depart * 20,
    bargeY: .05 + depart * 1.2, bargeZ: -34 - depart * 20, transfer, depart,
    connection: encounter.phase === 'ready' ? 1 : encounter.phase === 'disconnecting' ? 1 - eased : 0 };
}

export function trilogyEpilogueProgress(encounter: TrilogyEpilogueEncounter): number {
  const seconds = epilogueSeconds(encounter);
  return seconds ? Math.max(0, Math.min(1, encounter.elapsed / seconds)) : 0;
}

export function stepTrilogyEpilogue(encounter: TrilogyEpilogueEncounter, delta: number): TrilogyEpilogueEncounter {
  const dt = Math.max(0, Math.min(.1, delta));
  if (!dt) return encounter;
  let departure = encounter.parkDeparture;
  if (!departure && encounter.kind === 'dawn' && ['leaving', 'promise', 'sati', 'sunrise', 'belief', 'done'].includes(encounter.phase)) {
    const { x, z, yaw } = gardenPose(encounter, 'architect');
    departure = { elapsed: 0, origin: { x, z, yaw } };
  }
  const departingSeconds = departure ? gardenDeparturePose(departure).seconds : 0;
  const performing = running.has(encounter.phase);
  if (!performing && (!departure || departure.elapsed >= departingSeconds)) return encounter;
  const next = { ...encounter, elapsed: encounter.elapsed + (performing ? dt : 0), total: encounter.total + dt,
    ...(departure ? { parkDeparture: { ...departure, elapsed: Math.min(departingSeconds, departure.elapsed + dt) } } : {}) };
  if (!performing) return next;
  const seconds = epilogueSeconds(next);
  if (seconds === undefined || next.elapsed + 1e-6 < seconds) return next;
  const after: Partial<Record<TrilogyEpiloguePhase, TrilogyEpiloguePhase>> = next.kind === 'ceasefire'
    ? { retreat: 'message_ready', running: 'announcement', announcement: 'embrace', embrace: 'done' }
    : next.kind === 'neo_carried'
      ? { disconnecting: 'lowering', lowering: 'transfer', transfer: 'departing', departing: 'done' }
      : next.kind === 'reset' ? next.resetVersion === 2 ? { cat: 'waking', waking: 'done' } : { waking: 'cat', cat: 'done' }
        : { cat: 'architect', sitting: 'architect', architect: 'choice', leaving: 'promise', sati: 'sunrise', sunrise: 'belief', belief: 'done' };
  next.phase = after[next.phase] ?? next.phase;
  next.elapsed = 0;
  return next;
}
