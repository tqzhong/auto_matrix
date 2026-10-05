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
}

export interface TrilogyEpilogueGesture extends TrilogyEpilogueEncounter {
  role: 'kid' | 'morpheus' | 'niobe' | 'zee' | 'link' | 'neo' | 'oracle' | 'architect' | 'sati' | 'seraph';
}

const running = new Set<TrilogyEpiloguePhase>([
  'retreat', 'running', 'announcement', 'embrace', 'disconnecting', 'lowering', 'transfer', 'departing',
  'waking', 'cat', 'sitting', 'architect', 'leaving', 'sati', 'sunrise', 'belief',
]);

export function newTrilogyEpilogue(kind: TrilogyEpilogueKind): TrilogyEpilogueEncounter {
  return { kind, phase: 'ready', elapsed: 0, total: 0, ...(kind === 'reset' ? { resetVersion: 2 as const } : {}) };
}

function epilogueSeconds(encounter: TrilogyEpilogueEncounter): number | undefined {
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
  if (!running.has(encounter.phase)) return encounter;
  const dt = Math.max(0, Math.min(.1, delta));
  const next = { ...encounter, elapsed: encounter.elapsed + dt, total: encounter.total + dt };
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
