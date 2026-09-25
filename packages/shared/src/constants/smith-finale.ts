export const SMITH_FINALE = {
  avenue: { neoZ: -15, smithZ: -8 },
  ground: { warning: .85, dodge: 1.1, counter: 4.5, hits: 2, strikeGap: .32 },
  shockwave: 1.6,
  air: { warning: .8, dodge: 1.2, counter: 3.4 },
  building: 1.5,
  descent: { seconds: 3.4, braceSeconds: 1.4 },
  crater: { riseSeconds: 1.8 },
  assault: 3.5,
  surrender: { consentSeconds: 1.6, assimilationSeconds: 3.6, purgeSeconds: 2.8 },
} as const;

export type SmithFinaleCheckpoint = 'ground' | 'air';
export type SmithFinalePhase = 'approach' | 'ready' | 'ground_warning' | 'ground_dodge' | 'ground_counter'
  | 'shockwave' | 'air_warning' | 'air_dodge' | 'air_counter' | 'building' | 'descent' | 'crater'
  | 'choice' | 'rain_done' | 'assault_ready' | 'assault' | 'vision' | 'understanding' | 'surrender'
  | 'assimilating' | 'purging' | 'done' | 'failed';

export interface SmithFinaleEncounter {
  phase: SmithFinalePhase;
  elapsed: number;
  total: number;
  focus: number;
  hits: number;
  lastStrike: number;
  lane: number;
  checkpoint: SmithFinaleCheckpoint;
  attempts: number;
}

export interface SmithFinaleGesture extends SmithFinaleEncounter { role: 'neo' | 'smith' }

export interface SmithFinalePose {
  neo: { x: number; y: number; z: number; yaw: number };
  smith: { x: number; y: number; z: number; yaw: number };
  guard: number;
  dodge: number;
  strike: number;
  flight: number;
  impact: number;
  rise: number;
  fallen: number;
  surrender: number;
  assimilation: number;
  purge: number;
}

export type SmithFinaleInput = { focus: boolean; x: number; z: number };
export type SmithFinaleAction = 'attack' | 'dodge';

const clamp = (value: number, low = 0, high = 1): number => Math.max(low, Math.min(high, value));
const smooth = (value: number): number => { const t = clamp(value); return t * t * (3 - 2 * t); };

export function newSmithFinale(): SmithFinaleEncounter {
  return { phase: 'approach', elapsed: 0, total: 0, focus: 0, hits: 0, lastStrike: -1, lane: 0, checkpoint: 'ground', attempts: 0 };
}

export function smithFinaleLocked(encounter?: SmithFinaleEncounter): boolean {
  return Boolean(encounter && !['approach', 'ready', 'assault_ready', 'rain_done', 'done', 'failed'].includes(encounter.phase));
}

function failed(encounter: SmithFinaleEncounter, checkpoint: SmithFinaleCheckpoint): SmithFinaleEncounter {
  return { ...encounter, phase: 'failed', elapsed: 0, focus: 0, checkpoint };
}

export function retrySmithFinale(encounter: SmithFinaleEncounter): SmithFinaleEncounter {
  const air = encounter.checkpoint === 'air';
  return { ...encounter, phase: air ? 'air_warning' : 'ready', elapsed: 0, focus: 0, hits: 0,
    lastStrike: -1, lane: 0, attempts: encounter.attempts + 1 };
}

export function smithFinaleAction(encounter: SmithFinaleEncounter, action: SmithFinaleAction): SmithFinaleEncounter {
  const next = { ...encounter };
  if (next.phase === 'ground_dodge' && action === 'dodge') {
    next.phase = 'ground_counter'; next.elapsed = 0; next.hits = 0; next.lastStrike = -1;
  } else if (next.phase === 'ground_counter' && action === 'attack' && next.elapsed - next.lastStrike >= SMITH_FINALE.ground.strikeGap) {
    next.lastStrike = next.elapsed; next.hits++;
    if (next.hits >= SMITH_FINALE.ground.hits) { next.phase = 'shockwave'; next.elapsed = 0; next.checkpoint = 'air'; }
  } else if (next.phase === 'air_dodge' && action === 'dodge') {
    next.phase = 'air_counter'; next.elapsed = 0; next.lastStrike = -1;
  } else if (next.phase === 'air_counter' && action === 'attack') {
    next.phase = 'building'; next.elapsed = 0;
  }
  return next;
}

export function stepSmithFinale(encounter: SmithFinaleEncounter, input: SmithFinaleInput, delta: number): SmithFinaleEncounter {
  if (!smithFinaleLocked(encounter) || ['choice', 'vision', 'understanding'].includes(encounter.phase)) return encounter;
  const dt = Math.max(0, delta); const next = { ...encounter, elapsed: encounter.elapsed + dt, total: encounter.total + dt };
  if (['air_warning', 'air_dodge', 'air_counter', 'building', 'descent'].includes(next.phase))
    next.lane = clamp(next.lane + input.x * dt * .75, -1, 1);
  if (next.phase === 'ground_warning' && next.elapsed + 1e-6 >= SMITH_FINALE.ground.warning) {
    next.phase = 'ground_dodge'; next.elapsed = 0;
  } else if (next.phase === 'ground_dodge' && next.elapsed + 1e-6 >= SMITH_FINALE.ground.dodge) return failed(next, 'ground');
  else if (next.phase === 'ground_counter' && next.elapsed + 1e-6 >= SMITH_FINALE.ground.counter) return failed(next, 'ground');
  else if (next.phase === 'shockwave' && next.elapsed + 1e-6 >= SMITH_FINALE.shockwave) {
    next.phase = 'air_warning'; next.elapsed = 0; next.checkpoint = 'air';
  } else if (next.phase === 'air_warning' && next.elapsed + 1e-6 >= SMITH_FINALE.air.warning) {
    next.phase = 'air_dodge'; next.elapsed = 0;
  } else if (next.phase === 'air_dodge' && next.elapsed + 1e-6 >= SMITH_FINALE.air.dodge) return failed(next, 'air');
  else if (next.phase === 'air_counter' && next.elapsed + 1e-6 >= SMITH_FINALE.air.counter) return failed(next, 'air');
  else if (next.phase === 'building' && next.elapsed + 1e-6 >= SMITH_FINALE.building) {
    next.phase = 'descent'; next.elapsed = 0; next.focus = 0;
  } else if (next.phase === 'descent') {
    next.focus = clamp(next.focus + (input.focus ? dt : -dt * .42), 0, SMITH_FINALE.descent.braceSeconds);
    if (next.focus + 1e-6 >= SMITH_FINALE.descent.braceSeconds) {
      next.phase = 'crater'; next.elapsed = 0; next.focus = 0;
    } else if (next.elapsed + 1e-6 >= SMITH_FINALE.descent.seconds) return failed(next, 'air');
  } else if (next.phase === 'crater') {
    next.focus = clamp(next.focus + (input.focus ? dt : -dt * .18), 0, SMITH_FINALE.crater.riseSeconds);
    if (next.focus + 1e-6 >= SMITH_FINALE.crater.riseSeconds) { next.phase = 'choice'; next.elapsed = 0; }
  } else if (next.phase === 'assault' && next.elapsed + 1e-6 >= SMITH_FINALE.assault) {
    next.phase = 'vision'; next.elapsed = 0;
  } else if (next.phase === 'surrender') {
    next.focus = clamp(next.focus + (input.focus ? dt : -dt * .28), 0, SMITH_FINALE.surrender.consentSeconds);
    if (next.focus + 1e-6 >= SMITH_FINALE.surrender.consentSeconds) { next.phase = 'assimilating'; next.elapsed = 0; }
  } else if (next.phase === 'assimilating' && next.elapsed + 1e-6 >= SMITH_FINALE.surrender.assimilationSeconds) {
    next.phase = 'purging'; next.elapsed = 0;
  } else if (next.phase === 'purging' && next.elapsed + 1e-6 >= SMITH_FINALE.surrender.purgeSeconds) {
    next.phase = 'done'; next.elapsed = 0;
  }
  return next;
}

export function smithFinalePose(encounter: SmithFinaleEncounter): SmithFinalePose {
  const phase = encounter.phase; const t = encounter.elapsed;
  const neo: SmithFinalePose['neo'] = { x: encounter.lane * 4, y: 0, z: SMITH_FINALE.avenue.neoZ, yaw: 0 };
  const smith: SmithFinalePose['smith'] = { x: 0, y: 0, z: SMITH_FINALE.avenue.smithZ, yaw: Math.PI };
  if (phase === 'ground_dodge') neo.x -= Math.sin(clamp(t / SMITH_FINALE.ground.dodge) * Math.PI) * 2.8;
  if (phase === 'ground_counter') { neo.z = -12.5; smith.z = -8.8; }
  if (phase === 'shockwave') {
    const p = smooth(t / SMITH_FINALE.shockwave);
    neo.z = -12.5 - p * 13; smith.z = -8.8 + p * 12; neo.y = smith.y = Math.sin(p * Math.PI) * 4;
  }
  if (['air_warning', 'air_dodge', 'air_counter'].includes(phase)) {
    const drift = phase === 'air_dodge' ? Math.sin(clamp(t / SMITH_FINALE.air.dodge) * Math.PI) * 4 : 0;
    neo.x = encounter.lane * 7 - drift; neo.y = 22 + Math.sin(encounter.total * 1.8) * 1.2; neo.z = -25;
    smith.x = encounter.lane * 2 + 2; smith.y = 23.5 + Math.sin(encounter.total * 1.8 + 1) * 1.1; smith.z = -12;
  }
  if (phase === 'building') {
    const p = smooth(t / SMITH_FINALE.building);
    neo.x = encounter.lane * 4 - p * 26; neo.y = 20 - p * 5; neo.z = -23 - p * 5; neo.yaw = -Math.PI / 2;
    smith.x = encounter.lane * 2 - p * 18; smith.y = 21 - p * 4; smith.z = -17 - p * 7; smith.yaw = -Math.PI / 2;
  }
  if (phase === 'descent') {
    const p = smooth(t / SMITH_FINALE.descent.seconds);
    neo.x = encounter.lane * 6; neo.y = 30 * (1 - p); neo.z = -25 - p * 13; neo.yaw = Math.PI;
    smith.x = encounter.lane * 4; smith.y = 33 * (1 - p); smith.z = -20 - p * 14; smith.yaw = Math.PI;
  }
  if (['crater', 'choice', 'rain_done', 'assault_ready', 'assault', 'vision', 'understanding', 'surrender', 'assimilating', 'purging', 'done'].includes(phase)) {
    neo.x = 0; neo.y = phase === 'crater' ? -1.15 + smooth(encounter.focus / SMITH_FINALE.crater.riseSeconds) * 1.15 : 0; neo.z = -38; neo.yaw = 0;
    smith.x = 0; smith.y = 0; smith.z = -31.5; smith.yaw = Math.PI;
  }
  if (phase === 'assault') {
    const hit = Math.sin(clamp(t / SMITH_FINALE.assault) * Math.PI * 5);
    smith.z = -34.4 - Math.max(0, hit) * 1.2; neo.z = -38.3 - Math.max(0, hit) * .4;
  }
  if (phase === 'surrender') smith.z = -32.2 - smooth(encounter.focus / SMITH_FINALE.surrender.consentSeconds) * 3.2;
  if (['assimilating', 'purging', 'done'].includes(phase)) smith.z = -37.1;
  const groundWindow = phase === 'ground_warning' || phase === 'ground_dodge' || phase === 'ground_counter';
  return {
    neo, smith,
    guard: groundWindow ? .8 : phase === 'air_warning' || phase === 'air_dodge' || phase === 'air_counter' ? .55 : 0,
    dodge: phase === 'ground_dodge' ? Math.sin(clamp(t / SMITH_FINALE.ground.dodge) * Math.PI)
      : phase === 'air_dodge' ? Math.sin(clamp(t / SMITH_FINALE.air.dodge) * Math.PI) : 0,
    strike: phase === 'ground_counter' ? Math.sin(clamp(t / .34) * Math.PI)
      : phase === 'air_counter' ? Math.sin(clamp(t / .5) * Math.PI) : phase === 'assault' ? Math.max(0, Math.sin(t * 4.5)) : 0,
    flight: ['shockwave', 'air_warning', 'air_dodge', 'air_counter', 'building', 'descent'].includes(phase) ? 1 : 0,
    impact: phase === 'descent' ? smooth(t / SMITH_FINALE.descent.seconds) : phase === 'crater' ? 1 : 0,
    rise: phase === 'crater' ? smooth(encounter.focus / SMITH_FINALE.crater.riseSeconds) : ['choice', 'rain_done', 'assault_ready', 'assault', 'vision', 'understanding', 'surrender', 'assimilating', 'purging', 'done'].includes(phase) ? 1 : 0,
    fallen: phase === 'crater' ? 1 - smooth(encounter.focus / SMITH_FINALE.crater.riseSeconds) : phase === 'assault' ? .25 + Math.max(0, Math.sin(t * 4.5)) * .45 : 0,
    surrender: phase === 'surrender' ? smooth(encounter.focus / SMITH_FINALE.surrender.consentSeconds) : ['assimilating', 'purging', 'done'].includes(phase) ? 1 : 0,
    assimilation: phase === 'assimilating' ? smooth(t / SMITH_FINALE.surrender.assimilationSeconds) : ['purging', 'done'].includes(phase) ? 1 : 0,
    purge: phase === 'purging' ? smooth(t / SMITH_FINALE.surrender.purgeSeconds) : phase === 'done' ? 1 : 0,
  };
}
