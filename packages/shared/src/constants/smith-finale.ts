export const SMITH_FINALE = {
  avenue: { neoZ: -15, smithZ: -8 },
  ground: { warning: .85, dodge: 1.1, counter: 4.5, hits: 2, strikeGap: .32 },
  shockwave: 1.6,
  air: { warning: .8, dodge: 1.2, counter: 3.4 },
  building: 1.5,
  descent: { seconds: 3.4, impact: 2.85, braceSeconds: 1.4 },
  crater: { x: 0, z: -38, depth: 12, radius: 17, floorRadius: 9, settleSeconds: .7, riseSeconds: 1.8 },
  assault: 3.5,
  surrender: { consentSeconds: 1.6, assimilationSeconds: 8.4, restoreAt: 8, purgeSeconds: 12 },
  oracle: { x: 0, z: -33.2, yaw: Math.PI / 2 },
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
  impactAt?: number;
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

export function smithCraterRim(angle: number): number {
  return SMITH_FINALE.crater.radius + Math.sin(angle * 3 + .7) * .7 + Math.sin(angle * 7 - .4) * .4;
}

/** Avenue-local surface shared by the broken mesh, movement and camera. */
export function smithCraterFloor(x: number, z: number): number {
  const dx = x - SMITH_FINALE.crater.x, dz = z - SMITH_FINALE.crater.z;
  const radius = Math.hypot(dx, dz), rim = smithCraterRim(Math.atan2(dz, dx));
  const slope = clamp((radius - SMITH_FINALE.crater.floorRadius) / (rim - SMITH_FINALE.crater.floorRadius));
  const base = -SMITH_FINALE.crater.depth * (1 - smooth(slope));
  const fracture = Math.sin(x * 1.8 + Math.sin(z * .7)) * .28 + Math.sin(x * 4.6 - z * 3.2) * .12
    + Math.sin(base * 3.3 + Math.sin(x * .7 + z * .3)) * .2;
  return base + fracture * 4 * slope * (1 - slope);
}

export function smithCraterAmount(encounter: SmithFinaleEncounter): number {
  if (encounter.phase === 'descent') return smooth((encounter.elapsed - SMITH_FINALE.descent.impact)
    / (SMITH_FINALE.descent.seconds - SMITH_FINALE.descent.impact));
  return encounter.impactAt !== undefined || ['crater', 'choice', 'rain_done', 'assault_ready', 'assault', 'vision',
    'understanding', 'surrender', 'assimilating', 'purging', 'done'].includes(encounter.phase) ? 1 : 0;
}

export function newSmithFinale(): SmithFinaleEncounter {
  return { phase: 'approach', elapsed: 0, total: 0, focus: 0, hits: 0, lastStrike: -1, lane: 0, checkpoint: 'ground', attempts: 0 };
}

export function smithOracleRestored(encounter?: SmithFinaleEncounter): boolean {
  return Boolean(encounter && (encounter.phase === 'done'
    || encounter.phase === 'purging' && encounter.elapsed >= SMITH_FINALE.surrender.restoreAt));
}

/** All surfaces and bodies use the saved scene clock, including a cold load. */
export function smithEndingPose(encounter: SmithFinaleEncounter) {
  const assimilating = encounter.phase === 'assimilating';
  const after = encounter.phase === 'purging' || encounter.phase === 'done';
  const t = assimilating ? encounter.elapsed : after ? SMITH_FINALE.surrender.assimilationSeconds : 0;
  const purge = encounter.phase === 'purging' ? encounter.elapsed : encounter.phase === 'done' ? SMITH_FINALE.surrender.purgeSeconds : 0;
  return {
    contact: (assimilating || after ? smooth(t / .55) : 0) * (1 - smooth((t - 5.4) / 1.1)),
    coating: smooth((t - .45) / 3.4),
    replacement: smooth((t - 3.9) / 1.6),
    retreat: smooth((t - 6.5) / 1.2),
    shield: smooth((purge - .35) / .65) * (1 - smooth((purge - 3.3) / .6)),
    neoPulse: smooth(purge / 1.2) * (1 - smooth((purge - 2.2) / .8)),
    neoErase: smooth((purge - 1.6) / 1.4),
    smithPulse: smooth((purge - 2.5) / 1.1) * (1 - smooth((purge - 4.1) / .9)),
    smithErase: smooth((purge - 3.8) / 1.2),
    crowd: smooth((purge - 4.2) / 2.1),
    rain: 1 - smooth((purge - 5.6) / 2.4),
  };
}

export function smithFinaleLocked(encounter?: SmithFinaleEncounter): boolean {
  return Boolean(encounter && (encounter.phase === 'failed' && encounter.impactAt !== undefined
    || !['approach', 'ready', 'assault_ready', 'rain_done', 'failed'].includes(encounter.phase)));
}

function failed(encounter: SmithFinaleEncounter, checkpoint: SmithFinaleCheckpoint): SmithFinaleEncounter {
  return { ...encounter, phase: 'failed', elapsed: 0, focus: 0, checkpoint };
}

export function retrySmithFinale(encounter: SmithFinaleEncounter): SmithFinaleEncounter {
  const air = encounter.checkpoint === 'air';
  return { ...encounter, phase: air ? 'air_warning' : 'ready', elapsed: 0, focus: 0, hits: 0,
    lastStrike: -1, lane: 0, attempts: encounter.attempts + 1, impactAt: undefined };
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
  if (encounter.phase === 'failed') return encounter;
  if (!smithFinaleLocked(encounter)) return ['approach', 'ready', 'rain_done', 'assault_ready'].includes(encounter.phase)
    ? { ...encounter, total: encounter.total + Math.max(0, delta) } : encounter;
  if (['choice', 'vision', 'understanding', 'done'].includes(encounter.phase)) return { ...encounter, total: encounter.total + Math.max(0, delta) };
  const dt = Math.max(0, delta); const next = { ...encounter, elapsed: encounter.elapsed + dt, total: encounter.total + dt };
  if (['air_warning', 'air_dodge', 'air_counter'].includes(next.phase))
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
    if (next.elapsed >= SMITH_FINALE.descent.impact && next.impactAt === undefined)
      next.impactAt = next.total - (next.elapsed - SMITH_FINALE.descent.impact);
    if (next.elapsed + 1e-6 >= SMITH_FINALE.descent.seconds) {
      if (next.focus + 1e-6 < SMITH_FINALE.descent.braceSeconds) return failed(next, 'air');
      next.phase = 'crater'; next.elapsed = 0; next.focus = 0;
    }
  } else if (next.phase === 'crater') {
    const active = Math.max(0, next.elapsed - Math.max(encounter.elapsed, SMITH_FINALE.crater.settleSeconds));
    next.focus = clamp(next.focus + (input.focus ? active : -active * .18), 0, SMITH_FINALE.crater.riseSeconds);
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
  const phase = encounter.phase === 'failed' && encounter.impactAt !== undefined ? 'crater' : encounter.phase;
  const t = encounter.elapsed;
  const punchAge = phase === 'ground_counter' && encounter.lastStrike >= 0 ? t - encounter.lastStrike : phase === 'shockwave' ? t : -1;
  const punch = punchAge < 0 ? 0 : Math.sin(clamp(punchAge / .34) * Math.PI);
  const airNeoY = 22 + Math.sin(encounter.total * 1.8) * 1.2;
  const airSmithY = 23.5 + Math.sin(encounter.total * 1.8 + 1) * 1.1;
  const neo: SmithFinalePose['neo'] = { x: encounter.lane * 4, y: 0, z: SMITH_FINALE.avenue.neoZ, yaw: 0 };
  const smith: SmithFinalePose['smith'] = { x: 0, y: 0, z: SMITH_FINALE.avenue.smithZ, yaw: Math.PI };
  if (phase === 'ground_dodge') neo.x -= Math.sin(clamp(t / SMITH_FINALE.ground.dodge) * Math.PI) * 2.8;
  if (phase === 'ground_counter') { neo.z = -12.5 + punch * 1.9; smith.z = -8.8; }
  if (phase === 'shockwave') {
    const p = smooth((t - .34) / (SMITH_FINALE.shockwave - .34));
    // The blast separates them before they curve upward into the saved air
    // checkpoint. Its endpoint must use the same clock, height and lane.
    const rise = smooth((p - .28) / .72), recoil = Math.sin(p * Math.PI);
    neo.x = encounter.lane * (4 + p * 3); smith.x = (encounter.lane * 2 + 2) * p;
    neo.z = -12.5 + punch * 1.9 - p * 12.5; smith.z = -8.8 + recoil * 12 - p * 3.2;
    neo.y = recoil * 4 + airNeoY * rise; smith.y = recoil * 4 + airSmithY * rise;
  }
  if (['air_warning', 'air_dodge', 'air_counter'].includes(phase)) {
    const drift = phase === 'air_dodge' ? Math.sin(clamp(t / SMITH_FINALE.air.dodge) * Math.PI) * 4 : 0;
    neo.x = encounter.lane * 7 - drift; neo.y = airNeoY; neo.z = -25;
    smith.x = encounter.lane * 2 + 2; smith.y = airSmithY; smith.z = -12;
  }
  if (phase === 'building') {
    const p = smooth(t / SMITH_FINALE.building);
    const start = encounter.total - t;
    neo.x = encounter.lane * (7 - 3 * p) - p * 26; neo.y = (22 + Math.sin(start * 1.8) * 1.2) * (1 - p) + 15 * p;
    neo.z = -25 - p * 3; neo.yaw = -Math.PI / 2 * p;
    smith.x = encounter.lane * 2 + 2 - p * 20; smith.y = (23.5 + Math.sin(start * 1.8 + 1) * 1.1) * (1 - p) + 17 * p;
    smith.z = -12 - p * 12; smith.yaw = Math.PI + Math.PI / 2 * p;
  }
  const collapse = smithCraterAmount(encounter);
  if (phase === 'descent') {
    const p = clamp(t / SMITH_FINALE.descent.impact), turn = smooth(p);
    // Leave the same broken facade, arc back over the avenue, then accelerate
    // downward. The final .55 seconds collapse the road and bodies together.
    neo.x = (encounter.lane * 4 - 26) * (1 - turn); neo.z = -28 - turn * 10;
    neo.y = 15 * (1 - p * p) + 17 * Math.sin(p * Math.PI) + (-SMITH_FINALE.crater.depth + .025) * collapse;
    neo.yaw = -Math.PI / 2 * (1 - turn);
    smith.x = (encounter.lane * 2 - 18) * (1 - turn); smith.z = -24 - turn * 10 + collapse * 2.5;
    smith.y = 17 * (1 - p * p) + 19 * Math.sin(p * Math.PI) + 3 * turn * (1 - collapse) + (-SMITH_FINALE.crater.depth + .025) * collapse;
    smith.yaw = -Math.PI / 2 - Math.PI / 2 * turn;
  }
  if (['crater', 'choice', 'rain_done', 'assault_ready', 'assault', 'vision', 'understanding', 'surrender', 'assimilating', 'purging', 'done'].includes(phase)) {
    neo.x = 0; neo.y = -SMITH_FINALE.crater.depth + .025; neo.z = -38; neo.yaw = 0;
    smith.x = 0; smith.y = neo.y; smith.z = -31.5; smith.yaw = Math.PI;
  }
  if (phase === 'assault') {
    smith.z = -31.5 - smooth(t / .9) * 4.3 + smooth((t - 2.9) / .6);
  }
  if (['vision', 'understanding', 'surrender', 'assimilating', 'purging', 'done'].includes(phase)) smith.z = -34.8;
  if (phase === 'surrender') neo.z += smooth(encounter.focus / SMITH_FINALE.surrender.consentSeconds);
  if (['assimilating', 'purging', 'done'].includes(phase)) {
    neo.z = -37; smith.z += smithEndingPose(encounter).retreat * 1.6;
  }
  const lastAttack = phase === 'assault' ? Math.max(0, Math.sin(clamp((t - .9) / 2) * Math.PI * 3)) : 0;
  const groundWindow = phase === 'ground_warning' || phase === 'ground_dodge' || phase === 'ground_counter';
  return {
    neo, smith,
    guard: groundWindow ? .8 : phase === 'shockwave' ? .8 * (1 - smooth((t - .17) / .17)) + .55 * smooth((t - .6) / (SMITH_FINALE.shockwave - .6))
      : phase === 'air_warning' || phase === 'air_dodge' || phase === 'air_counter' ? .55 : 0,
    dodge: phase === 'ground_dodge' ? Math.sin(clamp(t / SMITH_FINALE.ground.dodge) * Math.PI)
      : phase === 'air_dodge' ? Math.sin(clamp(t / SMITH_FINALE.air.dodge) * Math.PI) : 0,
    strike: phase === 'ground_counter' || phase === 'shockwave' ? punch
      : phase === 'air_counter' ? Math.sin(clamp(t / .5) * Math.PI) : lastAttack,
    flight: phase === 'shockwave' ? smooth((t - .34) / .18) : phase === 'descent' ? 1 - collapse : ['air_warning', 'air_dodge', 'air_counter', 'building'].includes(phase) ? 1 : 0,
    impact: phase === 'descent' ? collapse : phase === 'crater' ? 1 - smooth(t / SMITH_FINALE.crater.settleSeconds) : 0,
    rise: phase === 'crater' ? smooth(encounter.focus / SMITH_FINALE.crater.riseSeconds) : ['choice', 'rain_done', 'assault_ready', 'assault', 'vision', 'understanding', 'surrender', 'assimilating', 'purging', 'done'].includes(phase) ? 1 : 0,
    fallen: phase === 'descent' ? collapse : phase === 'crater' ? 1 - smooth(encounter.focus / SMITH_FINALE.crater.riseSeconds) : lastAttack * .18,
    surrender: phase === 'surrender' ? smooth(encounter.focus / SMITH_FINALE.surrender.consentSeconds) : ['assimilating', 'purging', 'done'].includes(phase) ? 1 : 0,
    assimilation: phase === 'assimilating' ? smooth(t / SMITH_FINALE.surrender.assimilationSeconds) : ['purging', 'done'].includes(phase) ? 1 : 0,
    purge: phase === 'purging' ? smooth(t / SMITH_FINALE.surrender.purgeSeconds) : phase === 'done' ? 1 : 0,
  };
}
