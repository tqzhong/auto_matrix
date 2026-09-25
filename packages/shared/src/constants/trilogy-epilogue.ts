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
    cat: 2.4,
    architect: 5.4,
    sati: 2.2,
    sunrise: 6.2,
    belief: 3.6,
  },
} as const;

export type TrilogyEpilogueKind = 'ceasefire' | 'neo_carried' | 'dawn';
export type TrilogyEpiloguePhase = 'ready' | 'retreat' | 'message_ready' | 'running' | 'announcement' | 'embrace'
  | 'disconnecting' | 'lowering' | 'transfer' | 'departing'
  | 'cat' | 'architect' | 'choice' | 'promise' | 'sati' | 'sunrise' | 'belief' | 'done';

export interface TrilogyEpilogueEncounter {
  kind: TrilogyEpilogueKind;
  phase: TrilogyEpiloguePhase;
  elapsed: number;
  total: number;
}

export interface TrilogyEpilogueGesture extends TrilogyEpilogueEncounter {
  role: 'kid' | 'morpheus' | 'niobe' | 'zee' | 'link' | 'neo' | 'oracle' | 'architect' | 'sati' | 'seraph';
}

const running = new Set<TrilogyEpiloguePhase>([
  'retreat', 'running', 'announcement', 'embrace', 'disconnecting', 'lowering', 'transfer', 'departing',
  'cat', 'architect', 'sati', 'sunrise', 'belief',
]);

export function newTrilogyEpilogue(kind: TrilogyEpilogueKind): TrilogyEpilogueEncounter {
  return { kind, phase: 'ready', elapsed: 0, total: 0 };
}

export function trilogyEpilogueLocked(encounter?: TrilogyEpilogueEncounter): boolean {
  return Boolean(encounter && running.has(encounter.phase));
}

export function trilogyEpilogueProgress(encounter: TrilogyEpilogueEncounter): number {
  const seconds = TRILOGY_EPILOGUE.seconds[encounter.phase as keyof typeof TRILOGY_EPILOGUE.seconds];
  return seconds ? Math.max(0, Math.min(1, encounter.elapsed / seconds)) : 0;
}

export function stepTrilogyEpilogue(encounter: TrilogyEpilogueEncounter, delta: number): TrilogyEpilogueEncounter {
  if (!trilogyEpilogueLocked(encounter)) return encounter;
  const dt = Math.max(0, Math.min(.1, delta));
  const next = { ...encounter, elapsed: encounter.elapsed + dt, total: encounter.total + dt };
  const seconds = TRILOGY_EPILOGUE.seconds[next.phase as keyof typeof TRILOGY_EPILOGUE.seconds];
  if (seconds === undefined || next.elapsed + 1e-6 < seconds) return next;
  const after: Partial<Record<TrilogyEpiloguePhase, TrilogyEpiloguePhase>> = next.kind === 'ceasefire'
    ? { retreat: 'message_ready', running: 'announcement', announcement: 'embrace', embrace: 'done' }
    : next.kind === 'neo_carried'
      ? { disconnecting: 'lowering', lowering: 'transfer', transfer: 'departing', departing: 'done' }
      : { cat: 'architect', architect: 'choice', sati: 'sunrise', sunrise: 'belief', belief: 'done' };
  next.phase = after[next.phase] ?? next.phase;
  next.elapsed = 0;
  return next;
}
