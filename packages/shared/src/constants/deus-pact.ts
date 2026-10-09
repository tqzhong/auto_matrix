export const DEUS_PACT = {
  platform: { x: 0, z: -25, yaw: Math.PI },
  resolveSeconds: 3,
  consentSeconds: 1.8,
  reclineAngle: 1.28,
  seconds: { swarm: 7.5, forming: 2.1, challenge: 5, warning: 6.8, question: 2.2, assurance: 4.6, seating: 2.4, cabling: 2.8, connecting: 1.6 },
} as const;

export type DeusPactPhase = 'approach' | 'ready' | 'swarm' | 'forming' | 'challenge' | 'warning' | 'question' | 'terms' | 'assurance' | 'pact'
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
  if (!deusPactLocked(encounter)) return encounter;
  const dt = Math.max(0, Math.min(.1, delta));
  if (['terms', 'pact', 'connected'].includes(encounter.phase)) return { ...encounter, total: encounter.total + dt };
  const next = { ...encounter, elapsed: encounter.elapsed + dt, total: encounter.total + dt };
  if (next.phase === 'swarm') {
    next.resolve = Math.max(0, Math.min(DEUS_PACT.resolveSeconds, next.resolve + (focus ? dt : -dt * .42)));
    if (next.resolve + 1e-6 >= DEUS_PACT.resolveSeconds) { next.phase = 'forming'; next.elapsed = 0; }
    else if (next.elapsed + 1e-6 >= DEUS_PACT.seconds.swarm) { next.phase = 'failed'; next.elapsed = 0; }
  } else if (next.phase === 'forming' && next.elapsed + 1e-6 >= DEUS_PACT.seconds.forming) {
    next.phase = 'warning'; next.elapsed = 0;
  } else if (next.phase === 'warning' && next.elapsed + 1e-6 >= DEUS_PACT.seconds.warning) {
    next.phase = 'challenge'; next.elapsed = 0;
  } else if (next.phase === 'challenge' && next.elapsed + 1e-6 >= DEUS_PACT.seconds.challenge) {
    next.phase = 'question'; next.elapsed = 0;
  } else if (next.phase === 'question' && next.elapsed + 1e-6 >= DEUS_PACT.seconds.question) {
    next.phase = 'terms'; next.elapsed = 0;
  } else if (next.phase === 'assurance' && next.elapsed + 1e-6 >= DEUS_PACT.seconds.assurance) {
    next.phase = 'consent'; next.elapsed = 0;
  } else if (next.phase === 'seating' && next.elapsed + 1e-6 >= DEUS_PACT.seconds.seating) {
    next.phase = 'cabling'; next.elapsed = 0;
  } else if (next.phase === 'cabling' && next.elapsed + 1e-6 >= DEUS_PACT.seconds.cabling) {
    next.phase = 'assurance'; next.elapsed = 0;
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
    : ['challenge', 'warning', 'question', 'terms', 'assurance', 'pact', 'seating', 'cabling', 'consent', 'connecting', 'connected'].includes(phase) ? 1 : 0;
  const swarm = phase === 'swarm' ? .55 + .45 * clamp(encounter.elapsed / DEUS_PACT.seconds.swarm)
    : phase === 'forming' ? 1 - .45 * smooth(encounter.elapsed / DEUS_PACT.seconds.forming)
      : phase === 'challenge' ? .9 : ['warning', 'question', 'terms'].includes(phase) ? .42 : 0;
  const brace = phase === 'swarm' ? .35 + .65 * clamp(encounter.resolve / DEUS_PACT.resolveSeconds)
    : ['forming', 'challenge', 'warning'].includes(phase) ? 1 : ['question', 'terms', 'pact'].includes(phase) ? .32 : 0;
  const seated = phase === 'seating' ? smooth(encounter.elapsed / DEUS_PACT.seconds.seating)
    : ['cabling', 'assurance', 'consent', 'connecting', 'connected'].includes(phase) ? 1 : 0;
  const cables = phase === 'cabling' ? smooth(encounter.elapsed / DEUS_PACT.seconds.cabling)
    : ['assurance', 'consent', 'connecting', 'connected'].includes(phase) ? 1 : 0;
  const probe = phase === 'consent' ? .2 + .8 * clamp(encounter.consent / DEUS_PACT.consentSeconds)
    : phase === 'assurance' ? .2 : ['connecting', 'connected'].includes(phase) ? 1 : 0;
  const pulse = phase === 'connecting' ? smooth(encounter.elapsed / DEUS_PACT.seconds.connecting) : phase === 'connected' ? 1 : 0;
  return { face, swarm, brace, seated, cables, probe, pulse };
}

/** Condensed dialogue cues, driven by the saved beat rather than audio/page age. */
export function deusPactSpeech(encounter: DeusPactEncounter): { mouth: number; brow: number; anger: number } {
  const { phase, elapsed } = encounter;
  const duration = phase === 'challenge' ? 2.6 : phase === 'question' ? DEUS_PACT.seconds.question
    : phase === 'assurance' ? 2.3 : 0;
  if (!duration) return { mouth: 0, brow: 0, anger: 0 };
  const envelope = smooth(elapsed / .22) * (1 - smooth((elapsed - duration + .3) / .3));
  const mouth = envelope * (.38 + .62 * Math.abs(Math.sin(elapsed * 9.7)));
  return { mouth, brow: envelope * (phase === 'challenge' ? .72 : .22), anger: phase === 'challenge' ? envelope : 0 };
}

export function deusPactDialogue(encounter: DeusPactEncounter): string | undefined {
  switch (encounter.phase) {
    case 'challenge': return encounter.elapsed < 2.6 ? '机器集体否认自己需要 Neo 的帮助。' : 'Neo 表示：若机器真能独自解决危机，它们可以现在就结束他的生命。';
    case 'warning': return 'Neo：Smith 已经脱离控制，会把感染带到机器城。我可以尝试阻止他。';
    case 'question': return '机器集体追问：你希望用这件事换取什么？';
    case 'assurance': return encounter.elapsed < 2.3 ? '身体接线已完成。机器集体追问：如果你失败呢？' : 'Neo 再次确认自己会阻止 Smith，承担这项承诺的风险。';
    case 'consent': return 'Neo 已确认承担风险。颈后探针等待玩家明确同意接入。';
    default: return undefined;
  }
}
