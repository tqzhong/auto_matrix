export const DEUS_PACT = {
  platform: { x: 0, z: -25, yaw: Math.PI },
  resolveSeconds: 3,
  consentSeconds: 1.8,
  seconds: { swarm: 7.5, forming: 2.1, warning: 3.1, seating: 2.4, cabling: 2.8, connecting: 1.6 },
} as const;

export type DeusPactPhase = 'approach' | 'ready' | 'swarm' | 'forming' | 'warning' | 'terms' | 'pact'
  | 'seating' | 'cabling' | 'consent' | 'connecting' | 'connected' | 'failed';

export interface DeusPactEncounter {
  phase: DeusPactPhase;
  elapsed: number;
  total: number;
  resolve: number;
  consent: number;
  attempts: number;
}

export interface DeusPactGesture extends DeusPactEncounter {
  role: 'neo';
}

export interface DeusPactPose {
  face: number;
  swarm: number;
  brace: number;
  seated: number;
  cables: number;
  probe: number;
  pulse: number;
}

const clamp = (value: number): number => Math.max(0, Math.min(1, value));
const smooth = (value: number): number => { const t = clamp(value); return t * t * (3 - 2 * t); };

export function newDeusPact(attempts = 0): DeusPactEncounter {
  return { phase: 'approach', elapsed: 0, total: 0, resolve: 0, consent: 0, attempts };
}

export function deusPactLocked(encounter?: DeusPactEncounter): boolean {
  return Boolean(encounter && !['approach', 'ready', 'failed'].includes(encounter.phase));
}

export function stepDeusPact(encounter: DeusPactEncounter, focus: boolean, delta: number): DeusPactEncounter {
  if (!deusPactLocked(encounter) || ['terms', 'pact', 'connected'].includes(encounter.phase)) return encounter;
  const dt = Math.max(0, Math.min(.1, delta));
  const next = { ...encounter, elapsed: encounter.elapsed + dt, total: encounter.total + dt };
  if (next.phase === 'swarm') {
    next.resolve = Math.max(0, Math.min(DEUS_PACT.resolveSeconds, next.resolve + (focus ? dt : -dt * .42)));
    if (next.resolve + 1e-6 >= DEUS_PACT.resolveSeconds) { next.phase = 'forming'; next.elapsed = 0; }
    else if (next.elapsed + 1e-6 >= DEUS_PACT.seconds.swarm) { next.phase = 'failed'; next.elapsed = 0; }
  } else if (next.phase === 'forming' && next.elapsed + 1e-6 >= DEUS_PACT.seconds.forming) {
    next.phase = 'warning'; next.elapsed = 0;
  } else if (next.phase === 'warning' && next.elapsed + 1e-6 >= DEUS_PACT.seconds.warning) {
    next.phase = 'terms'; next.elapsed = 0;
  } else if (next.phase === 'seating' && next.elapsed + 1e-6 >= DEUS_PACT.seconds.seating) {
    next.phase = 'cabling'; next.elapsed = 0;
  } else if (next.phase === 'cabling' && next.elapsed + 1e-6 >= DEUS_PACT.seconds.cabling) {
    next.phase = 'consent'; next.elapsed = 0;
  } else if (next.phase === 'consent') {
    next.consent = Math.max(0, Math.min(DEUS_PACT.consentSeconds, next.consent + (focus ? dt : -dt * .3)));
    if (next.consent + 1e-6 >= DEUS_PACT.consentSeconds) { next.phase = 'connecting'; next.elapsed = 0; }
  } else if (next.phase === 'connecting' && next.elapsed + 1e-6 >= DEUS_PACT.seconds.connecting) {
    next.phase = 'connected'; next.elapsed = 0;
  }
  return next;
}

export function deusPactPose(encounter: DeusPactEncounter): DeusPactPose {
  const phase = encounter.phase;
  const face = phase === 'forming' ? smooth(encounter.elapsed / DEUS_PACT.seconds.forming)
    : ['warning', 'terms', 'pact', 'seating', 'cabling', 'consent', 'connecting', 'connected'].includes(phase) ? 1 : 0;
  const swarm = phase === 'swarm' ? .55 + .45 * clamp(encounter.elapsed / DEUS_PACT.seconds.swarm)
    : phase === 'forming' ? 1 - .45 * smooth(encounter.elapsed / DEUS_PACT.seconds.forming)
      : ['warning', 'terms'].includes(phase) ? .42 : 0;
  const brace = phase === 'swarm' ? .35 + .65 * clamp(encounter.resolve / DEUS_PACT.resolveSeconds)
    : ['forming', 'warning'].includes(phase) ? 1 : phase === 'terms' || phase === 'pact' ? .32 : 0;
  const seated = phase === 'seating' ? smooth(encounter.elapsed / DEUS_PACT.seconds.seating)
    : ['cabling', 'consent', 'connecting', 'connected'].includes(phase) ? 1 : 0;
  const cables = phase === 'cabling' ? smooth(encounter.elapsed / DEUS_PACT.seconds.cabling)
    : ['consent', 'connecting', 'connected'].includes(phase) ? 1 : 0;
  const probe = phase === 'consent' ? .2 + .8 * clamp(encounter.consent / DEUS_PACT.consentSeconds)
    : ['connecting', 'connected'].includes(phase) ? 1 : 0;
  const pulse = phase === 'connecting' ? smooth(encounter.elapsed / DEUS_PACT.seconds.connecting) : phase === 'connected' ? 1 : 0;
  return { face, swarm, brace, seated, cables, probe, pulse };
}
