export const SMITH_FINALE = {
  entrance: { x: 19.7, z: 18.4, column: 34, neoZ: -42, smithZ: 20, seconds: 6.8, greeting: 4.2, prediction: 5.4, charge: 1.8 },
  avenue: { neoZ: -15, smithZ: -8 },
  ground: { warning: .85, dodge: 1.1, counter: 4.5, hits: 2, strikeGap: .32 },
  shockwave: 1.6,
  air: { warning: .8, dodge: 1.2, counter: 3.4 },
  building: 1.5,
  interior: { x: -32.5, floor: 15, ceiling: 22.8, neoZ: -28, smithZ: -23.6, warning: 1.1, dodge: 1.35, counter: 4, kick: 1.7 },
  relaunch: 3.8,
  grapple: 1.65,
  descent: { seconds: 3.4, impact: 2.85, braceSeconds: 1.4 },
  crater: { x: 0, z: -38, depth: 12, radius: 17, floorRadius: 9, settleSeconds: .7, riseSeconds: 1.8 },
  assault: 3.5,
  pit: { warning: .9, dodge: 1.15, evade: .65, counter: 4, punch: 2.15, retaliation: 3.8 },
  surrender: { consentSeconds: 1.6, assimilationSeconds: 8.4, restoreAt: 8, purgeSeconds: 12 },
  oracle: { x: 0, z: -33.2, yaw: Math.PI / 2 },
} as const;

export type SmithFinaleCheckpoint = 'ground' | 'air' | 'interior' | 'sky' | 'pit';
export type SmithFinalePhase = 'approach' | 'entrance' | 'greeting' | 'reply' | 'prediction' | 'charge_ready' | 'charging' | 'ready' | 'ground_warning' | 'ground_dodge' | 'ground_counter'
  | 'shockwave' | 'air_warning' | 'air_dodge' | 'air_counter' | 'building' | 'interior_warning' | 'interior_dodge' | 'interior_counter' | 'interior_kick'
  | 'relaunch' | 'sky_warning' | 'sky_dodge' | 'sky_counter' | 'sky_grapple' | 'descent' | 'crater'
  | 'choice' | 'rain_done' | 'assault_ready' | 'assault' | 'vision' | 'understanding' | 'surrender'
  | 'pit_warning' | 'pit_dodge' | 'pit_evade' | 'pit_counter' | 'pit_punch' | 'pit_retaliation' | 'pit_recovery'
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
  roomFight?: boolean;
  pitFight?: boolean;
  pitDodgeAt?: number;
  pitApproach?: { x: number; z: number; yaw: number };
  breachedAt?: number;
  failedPhase?: SmithFinalePhase;
  failedElapsed?: number;
}

export interface SmithFinaleGesture extends SmithFinaleEncounter { role: 'neo' | 'smith' }

export interface SmithFinalePose {
  neo: { x: number; y: number; z: number; yaw: number; speed?: number; travel?: number };
  smith: { x: number; y: number; z: number; yaw: number; speed?: number; travel?: number };
  guard: number;
  dodge: number;
  strike: number;
  facePunch: number;
  smithPunch: number;
  stagger: number;
  kick: number;
  grapple: number;
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
  return encounter.impactAt !== undefined || encounter.phase.startsWith('pit_') || ['crater', 'choice', 'rain_done', 'assault_ready', 'assault', 'vision',
    'understanding', 'surrender', 'assimilating', 'purging', 'done'].includes(encounter.phase) ? 1 : 0;
}

export function newSmithFinale(): SmithFinaleEncounter {
  return { phase: 'approach', elapsed: 0, total: 0, focus: 0, hits: 0, lastStrike: -1, lane: 0, checkpoint: 'ground', attempts: 0, roomFight: true };
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
  return Boolean(encounter && (encounter.phase === 'failed' && (encounter.impactAt !== undefined || encounter.failedPhase !== undefined)
    || !['approach', 'ready', 'assault_ready', 'rain_done', 'failed'].includes(encounter.phase)));
}

export function smithFinaleDialogue(encounter: SmithFinaleEncounter): string | undefined {
  return encounter.phase === 'greeting' || encounter.phase === 'reply'
    ? 'Smith：安德森先生，又见面了。看看这座只剩下我的城市。'
    : encounter.phase === 'prediction' ? encounter.elapsed < 1.8 ? 'Neo：今晚结束这一切。'
      : 'Smith：我已经看见结局。其余的我只需旁观，我确信自己会赢。' : undefined;
}

function failed(encounter: SmithFinaleEncounter, checkpoint: SmithFinaleCheckpoint): SmithFinaleEncounter {
  return { ...encounter, phase: 'failed', elapsed: 0, focus: 0, checkpoint,
    failedPhase: checkpoint === 'interior' || checkpoint === 'sky' || checkpoint === 'pit' ? encounter.phase : undefined,
    failedElapsed: checkpoint === 'interior' || checkpoint === 'sky' || checkpoint === 'pit' ? encounter.elapsed : undefined };
}

export function retrySmithFinale(encounter: SmithFinaleEncounter): SmithFinaleEncounter {
  const air = encounter.checkpoint === 'air';
  return { ...encounter, phase: encounter.checkpoint === 'pit' ? 'pit_warning' : encounter.checkpoint === 'interior' ? 'interior_warning' : encounter.checkpoint === 'sky' ? 'sky_warning' : air ? 'air_warning' : 'ready', elapsed: 0, focus: 0, hits: 0,
    lastStrike: -1, lane: 0, attempts: encounter.attempts + 1, impactAt: encounter.checkpoint === 'pit' ? encounter.impactAt : undefined,
    pitDodgeAt: undefined, pitApproach: undefined, failedPhase: undefined, failedElapsed: undefined };
}

/** A failed airborne/interior checkpoint holds the actual saved frame. */
export function smithFinaleBeat(encounter: SmithFinaleEncounter): SmithFinaleEncounter {
  return encounter.phase === 'failed' && encounter.failedPhase
    ? { ...encounter, phase: encounter.failedPhase, elapsed: encounter.failedElapsed ?? 0 } : encounter;
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
  } else if (next.phase === 'interior_dodge' && action === 'dodge') {
    next.phase = 'interior_counter'; next.elapsed = 0;
  } else if (next.phase === 'interior_counter' && action === 'attack') {
    next.phase = 'interior_kick'; next.elapsed = 0;
  } else if (next.phase === 'sky_dodge' && action === 'dodge') {
    next.phase = 'sky_counter'; next.elapsed = 0;
  } else if (next.phase === 'sky_counter' && action === 'attack') {
    next.phase = 'sky_grapple'; next.elapsed = 0;
  } else if (next.phase === 'pit_dodge' && action === 'dodge') {
    next.pitDodgeAt = next.elapsed; next.phase = 'pit_evade'; next.elapsed = 0;
  } else if (next.phase === 'pit_counter' && action === 'attack') {
    next.phase = 'pit_punch'; next.elapsed = 0;
  }
  return next;
}

export function stepSmithFinale(encounter: SmithFinaleEncounter, input: SmithFinaleInput, delta: number): SmithFinaleEncounter {
  if (encounter.phase === 'failed') return encounter;
  if (!smithFinaleLocked(encounter)) return ['approach', 'ready', 'rain_done', 'assault_ready'].includes(encounter.phase)
    ? { ...encounter, total: encounter.total + Math.max(0, delta) } : encounter;
  if (['reply', 'charge_ready', 'choice', 'vision', 'understanding', 'done'].includes(encounter.phase)) return { ...encounter, total: encounter.total + Math.max(0, delta) };
  const dt = Math.max(0, delta); const next = { ...encounter, elapsed: encounter.elapsed + dt, total: encounter.total + dt };
  if (next.roomFight && next.phase === 'building' && next.elapsed >= .95 && next.breachedAt === undefined)
    next.breachedAt = next.total - next.elapsed + .95;
  if (['air_warning', 'air_dodge', 'air_counter'].includes(next.phase))
    next.lane = clamp(next.lane + input.x * dt * .75, -1, 1);
  if (next.phase === 'entrance' && next.elapsed + 1e-6 >= SMITH_FINALE.entrance.seconds) {
    next.phase = 'greeting'; next.elapsed = 0;
  } else if (next.phase === 'greeting' && next.elapsed + 1e-6 >= SMITH_FINALE.entrance.greeting) {
    next.phase = 'reply'; next.elapsed = 0;
  } else if (next.phase === 'prediction' && next.elapsed + 1e-6 >= SMITH_FINALE.entrance.prediction) {
    next.phase = 'charge_ready'; next.elapsed = 0;
  } else if (next.phase === 'charging' && next.elapsed + 1e-6 >= SMITH_FINALE.entrance.charge) {
    next.phase = 'ground_warning'; next.elapsed = 0;
  } else if (next.phase === 'ground_warning' && next.elapsed + 1e-6 >= SMITH_FINALE.ground.warning) {
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
    next.phase = next.roomFight ? 'interior_warning' : 'descent'; next.elapsed = 0; next.focus = 0;
    if (next.roomFight) next.checkpoint = 'interior';
  } else if (next.phase === 'interior_warning' && next.elapsed + 1e-6 >= SMITH_FINALE.interior.warning) {
    next.phase = 'interior_dodge'; next.elapsed = 0;
  } else if (next.phase === 'interior_dodge' && next.elapsed + 1e-6 >= SMITH_FINALE.interior.dodge) return failed(next, 'interior');
  else if (next.phase === 'interior_counter' && next.elapsed + 1e-6 >= SMITH_FINALE.interior.counter) return failed(next, 'interior');
  else if (next.phase === 'interior_kick' && next.elapsed + 1e-6 >= SMITH_FINALE.interior.kick) {
    next.phase = 'relaunch'; next.elapsed = 0;
  } else if (next.phase === 'relaunch' && next.elapsed + 1e-6 >= SMITH_FINALE.relaunch) {
    next.phase = 'sky_warning'; next.elapsed = 0; next.checkpoint = 'sky';
  } else if (next.phase === 'sky_warning' && next.elapsed + 1e-6 >= SMITH_FINALE.air.warning) {
    next.phase = 'sky_dodge'; next.elapsed = 0;
  } else if (next.phase === 'sky_dodge' && next.elapsed + 1e-6 >= SMITH_FINALE.air.dodge) return failed(next, 'sky');
  else if (next.phase === 'sky_counter' && next.elapsed + 1e-6 >= SMITH_FINALE.air.counter) return failed(next, 'sky');
  else if (next.phase === 'sky_grapple' && next.elapsed + 1e-6 >= SMITH_FINALE.grapple) {
    next.phase = 'descent'; next.elapsed = 0; next.focus = 0;
  } else if (next.phase === 'descent') {
    next.focus = clamp(next.focus + (input.focus ? dt : -dt * .42), 0, SMITH_FINALE.descent.braceSeconds);
    if (next.elapsed >= SMITH_FINALE.descent.impact && next.impactAt === undefined)
      next.impactAt = next.total - (next.elapsed - SMITH_FINALE.descent.impact);
    if (next.elapsed + 1e-6 >= SMITH_FINALE.descent.seconds) {
      if (next.focus + 1e-6 < SMITH_FINALE.descent.braceSeconds) return failed(next, next.checkpoint === 'sky' ? 'sky' : 'air');
      next.phase = 'crater'; next.elapsed = 0; next.focus = 0;
    }
  } else if (next.phase === 'crater') {
    const active = Math.max(0, next.elapsed - Math.max(encounter.elapsed, SMITH_FINALE.crater.settleSeconds));
    next.focus = clamp(next.focus + (input.focus ? active : -active * .18), 0, SMITH_FINALE.crater.riseSeconds);
    if (next.focus + 1e-6 >= SMITH_FINALE.crater.riseSeconds) { next.phase = 'choice'; next.elapsed = 0; }
  } else if (next.phase === 'pit_warning' && next.elapsed + 1e-6 >= SMITH_FINALE.pit.warning) {
    next.phase = 'pit_dodge'; next.elapsed = 0;
  } else if (next.phase === 'pit_dodge' && next.elapsed + 1e-6 >= SMITH_FINALE.pit.dodge) return failed(next, 'pit');
  else if (next.phase === 'pit_evade' && next.elapsed + 1e-6 >= SMITH_FINALE.pit.evade) {
    next.phase = 'pit_counter'; next.elapsed = 0;
  } else if (next.phase === 'pit_counter' && next.elapsed + 1e-6 >= SMITH_FINALE.pit.counter) return failed(next, 'pit');
  else if (next.phase === 'pit_punch' && next.elapsed + 1e-6 >= SMITH_FINALE.pit.punch) {
    next.phase = 'pit_retaliation'; next.elapsed = 0;
  } else if (next.phase === 'pit_retaliation' && next.elapsed + 1e-6 >= SMITH_FINALE.pit.retaliation) {
    next.phase = 'vision'; next.elapsed = 0; next.focus = 0;
  } else if (next.phase === 'pit_recovery') {
    next.focus = clamp(next.focus + (input.focus ? dt : -dt * .18), 0, SMITH_FINALE.crater.riseSeconds);
    if (next.focus + 1e-6 >= SMITH_FINALE.crater.riseSeconds) { next.phase = 'understanding'; next.elapsed = 0; }
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
  encounter = smithFinaleBeat(encounter);
  const phase = encounter.phase === 'failed' && encounter.impactAt !== undefined ? 'crater' : encounter.phase;
  const t = encounter.elapsed;
  const punchAge = phase === 'ground_counter' && encounter.lastStrike >= 0 ? t - encounter.lastStrike : phase === 'shockwave' ? t : -1;
  const punch = punchAge < 0 ? 0 : Math.sin(clamp(punchAge / .34) * Math.PI);
  const airNeoY = 22 + Math.sin(encounter.total * 1.8) * 1.2;
  const airSmithY = 23.5 + Math.sin(encounter.total * 1.8 + 1) * 1.1;
  const neo: SmithFinalePose['neo'] = { x: encounter.lane * 4, y: 0, z: SMITH_FINALE.avenue.neoZ, yaw: 0 };
  const smith: SmithFinalePose['smith'] = { x: 0, y: 0, z: SMITH_FINALE.avenue.smithZ, yaw: Math.PI };
  if (phase === 'approach') { smith.x = SMITH_FINALE.entrance.x; smith.z = SMITH_FINALE.entrance.z; smith.yaw = -Math.PI / 2; }
  if (['entrance', 'greeting', 'reply', 'prediction', 'charge_ready', 'charging'].includes(phase)) {
    const intro = SMITH_FINALE.entrance;
    neo.z = intro.neoZ; smith.z = intro.smithZ;
    if (phase === 'entrance') {
      const p = clamp(t / intro.seconds), ease = smooth(p), distance = Math.hypot(intro.x, intro.smithZ - intro.z);
      smith.x = intro.x * (1 - ease); smith.z = intro.z + (intro.smithZ - intro.z) * ease;
      smith.yaw = Math.atan2(-intro.x, intro.smithZ - intro.z) + (Math.PI - Math.atan2(-intro.x, intro.smithZ - intro.z) - Math.PI * 2) * smooth((p - .82) / .18);
      smith.speed = distance * 6 * p * (1 - p) / intro.seconds; smith.travel = distance * ease;
    }
    if (phase === 'charging') {
      const p = clamp(t / intro.charge), ease = smooth(p);
      neo.z = intro.neoZ + (SMITH_FINALE.avenue.neoZ - intro.neoZ) * ease;
      smith.z = intro.smithZ + (SMITH_FINALE.avenue.smithZ - intro.smithZ) * ease;
      neo.travel = (SMITH_FINALE.avenue.neoZ - intro.neoZ) * ease; smith.travel = (intro.smithZ - SMITH_FINALE.avenue.smithZ) * ease;
      neo.speed = (SMITH_FINALE.avenue.neoZ - intro.neoZ) * 6 * p * (1 - p) / intro.charge;
      smith.speed = (intro.smithZ - SMITH_FINALE.avenue.smithZ) * 6 * p * (1 - p) / intro.charge;
    }
  }
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
    if (encounter.roomFight) {
      neo.x = encounter.lane * 7 * (1 - p) + SMITH_FINALE.interior.x * p; neo.yaw = 0;
      smith.x = (encounter.lane * 2 + 2) * (1 - p) + SMITH_FINALE.interior.x * p;
      smith.y = (23.5 + Math.sin(start * 1.8 + 1) * 1.1) * (1 - p) + SMITH_FINALE.interior.floor * p;
      smith.z = -12 * (1 - p) + SMITH_FINALE.interior.smithZ * p; smith.yaw = Math.PI;
    }
  }
  const room = SMITH_FINALE.interior;
  const kick = phase === 'interior_kick' ? smooth(t / .55) * (1 - smooth((t - .6) / .55)) : 0;
  const grab = phase === 'sky_grapple' ? smooth(t / SMITH_FINALE.grapple) : 0;
  if (['interior_warning', 'interior_dodge', 'interior_counter', 'interior_kick', 'relaunch'].includes(phase)) {
    neo.x = smith.x = room.x; neo.y = smith.y = room.floor;
    neo.z = room.neoZ; smith.z = room.smithZ;
    if (phase === 'interior_dodge') neo.x -= Math.sin(clamp(t / room.dodge) * Math.PI) * 1.3;
    if (phase === 'interior_kick' || phase === 'relaunch') {
      const age = phase === 'relaunch' ? room.kick : t, recoil = smooth((age - .65) / (room.kick - .65));
      neo.z += smooth(age / .55) * 2;
      smith.x += recoil * 17; smith.y += recoil * 3; smith.z -= recoil * 2;
      smith.yaw -= recoil * Math.PI / 2;
    }
    if (phase === 'relaunch') {
      const p = clamp(t / SMITH_FINALE.relaunch), exit = smooth(p / .3), climb = smooth((p - .3) / .7);
      neo.x += exit * 12.5 + climb * 16.5; neo.y += exit * 1.5 + climb * 41.5; neo.z -= climb * 14;
      smith.x += climb * 19; smith.y += climb * 41.5; smith.z -= climb * 2.4;
      neo.yaw = -Math.PI / 2 * exit * (1 - climb); smith.yaw = Math.PI / 2 + climb * Math.PI / 2;
    }
  }
  if (['sky_warning', 'sky_dodge', 'sky_counter', 'sky_grapple'].includes(phase)) {
    const drift = phase === 'sky_dodge' ? Math.sin(clamp(t / SMITH_FINALE.air.dodge) * Math.PI) * 4 : 0;
    neo.x = -3.5 * (1 - grab) - drift; neo.y = 58 + 2 * grab; neo.z = -40 + 2 * grab;
    smith.x = 3.5 * (1 - grab); smith.y = 59.5 + .5 * grab; smith.z = -28 - 8.05 * grab;
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
    if (encounter.roomFight && encounter.checkpoint === 'sky') {
      neo.x = 0; neo.z = -38; neo.y = 60 * (1 - p * p) + (-SMITH_FINALE.crater.depth + .025) * collapse; neo.yaw = 0;
      smith.x = 0; smith.z = -36.05 + collapse * 4.55;
      smith.y = 60 * (1 - p * p) + 3 * turn * (1 - collapse) + (-SMITH_FINALE.crater.depth + .025) * collapse; smith.yaw = Math.PI;
    }
  }
  if (phase.startsWith('pit_') || ['crater', 'choice', 'rain_done', 'assault_ready', 'assault', 'vision', 'understanding', 'surrender', 'assimilating', 'purging', 'done'].includes(phase)) {
    neo.x = 0; neo.y = -SMITH_FINALE.crater.depth + .025; neo.z = -38; neo.yaw = 0;
    smith.x = 0; smith.y = neo.y; smith.z = -31.5; smith.yaw = Math.PI;
  }
  if (phase === 'assault') {
    smith.z = -31.5 - smooth(t / .9) * 4.3 + smooth((t - 2.9) / .6);
  }
  const pit = SMITH_FINALE.pit;
  const facePunch = phase === 'pit_punch' ? smooth(t / .72) * (1 - smooth((t - 1.02) / (pit.punch - 1.02))) : 0;
  const stagger = phase === 'pit_punch' ? smooth((t - .76) / .25) * (1 - smooth((t - 1.5) / (pit.punch - 1.5))) : 0;
  const incoming = phase === 'pit_dodge' ? smooth(t / .48) : phase === 'pit_evade'
    ? smooth(((encounter.pitDodgeAt ?? 0) + t) / .48) * (1 - smooth(t / pit.evade)) : 0;
  const retaliation = phase === 'pit_retaliation' ? Math.max(...[.4, 1.25, 2.1].map(start => Math.sin(clamp((t - start) / .65) * Math.PI))) : 0;
  const collapseBack = phase === 'pit_retaliation' ? smooth((t - 2.65) / (pit.retaliation - 2.65)) : 0;
  const groundedVision = phase === 'vision' && encounter.pitFight;
  if (phase.startsWith('pit_')) {
    smith.z = -34.6;
    if (phase === 'pit_warning') {
      const p = clamp(t / pit.warning), approach = smooth(p);
      smith.z = -31.5 - approach * 3.1; smith.speed = 3.1 * 6 * p * (1 - p) / pit.warning; smith.travel = approach * 3.1;
      if (encounter.pitApproach) {
        const from = encounter.pitApproach;
        neo.x = from.x * (1 - approach); neo.z = from.z + (-38 - from.z) * approach;
        neo.yaw = from.yaw + Math.atan2(Math.sin(-from.yaw), Math.cos(-from.yaw)) * approach;
      }
    }
    if (phase === 'pit_evade') neo.x = -Math.sin(clamp(t / pit.evade) * Math.PI) * 1.05;
    if (phase === 'pit_punch') { neo.z += smooth(t / .65) * 1.5 + stagger * .15; smith.z += smooth((t - 1.05) / .55) * .32; }
    if (phase === 'pit_retaliation') {
      const retreat = smooth((t - 2.4) / (pit.retaliation - 2.4));
      neo.z += 1.5 * (1 - retreat); smith.z += .32 - .45 * (smooth(t / .5) - retreat) - .52 * retreat;
    }
    if (phase === 'pit_recovery') smith.z = -34.8;
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
    guard: ['pit_warning', 'pit_dodge', 'pit_evade', 'pit_counter', 'pit_punch'].includes(phase) ? .8 * (phase === 'pit_warning' ? smooth(t / pit.warning) : 1)
      : phase === 'pit_retaliation' ? .8 * (1 - smooth((t - 2.4) / (pit.retaliation - 2.4)))
      : groundWindow || ['interior_warning', 'interior_dodge', 'interior_counter'].includes(phase) ? .8 : phase === 'interior_kick' ? .8 * (1 - smooth((t - 1.1) / .6)) : phase === 'building' && encounter.roomFight ? .8 * smooth(t / SMITH_FINALE.building) : phase === 'shockwave' ? .8 * (1 - smooth((t - .17) / .17)) + .55 * smooth((t - .6) / (SMITH_FINALE.shockwave - .6))
      : ['air_warning', 'air_dodge', 'air_counter', 'sky_warning', 'sky_dodge', 'sky_counter', 'sky_grapple'].includes(phase) ? .55 : 0,
    dodge: phase === 'ground_dodge' ? Math.sin(clamp(t / SMITH_FINALE.ground.dodge) * Math.PI)
      : phase === 'pit_evade' ? Math.sin(clamp(t / pit.evade) * Math.PI)
        : phase === 'interior_dodge' ? Math.sin(clamp(t / room.dodge) * Math.PI) : phase === 'air_dodge' || phase === 'sky_dodge' ? Math.sin(clamp(t / SMITH_FINALE.air.dodge) * Math.PI) : 0,
    strike: phase === 'ground_counter' || phase === 'shockwave' ? punch
      : phase === 'pit_punch' ? facePunch : phase === 'air_counter' ? Math.sin(clamp(t / .5) * Math.PI) : lastAttack,
    facePunch, smithPunch: Math.max(incoming, retaliation), stagger,
    kick, grapple: phase === 'descent' && encounter.roomFight && encounter.checkpoint === 'sky' ? 1 - smooth(t / .6) : grab,
    flight: phase === 'shockwave' ? smooth((t - .34) / .18) : phase === 'descent' ? 1 - collapse
      : phase === 'building' && encounter.roomFight ? 1 - smooth(t / SMITH_FINALE.building)
        : phase === 'relaunch' ? smooth(t / (SMITH_FINALE.relaunch * .3))
          : ['air_warning', 'air_dodge', 'air_counter', 'building', 'sky_warning', 'sky_dodge', 'sky_counter', 'sky_grapple'].includes(phase) ? 1 : 0,
    impact: phase === 'descent' ? collapse : phase === 'crater' ? 1 - smooth(t / SMITH_FINALE.crater.settleSeconds) : 0,
    rise: groundedVision ? 0 : phase === 'crater' || phase === 'pit_recovery' ? smooth(encounter.focus / SMITH_FINALE.crater.riseSeconds)
      : phase === 'pit_retaliation' ? 1 - collapseBack : phase.startsWith('pit_') || ['choice', 'rain_done', 'assault_ready', 'assault', 'vision', 'understanding', 'surrender', 'assimilating', 'purging', 'done'].includes(phase) ? 1 : 0,
    fallen: groundedVision ? 1 : phase === 'descent' ? collapse : phase === 'pit_retaliation' ? collapseBack
      : phase === 'crater' || phase === 'pit_recovery' ? 1 - smooth(encounter.focus / SMITH_FINALE.crater.riseSeconds) : lastAttack * .18,
    surrender: phase === 'surrender' ? smooth(encounter.focus / SMITH_FINALE.surrender.consentSeconds) : ['assimilating', 'purging', 'done'].includes(phase) ? 1 : 0,
    assimilation: phase === 'assimilating' ? smooth(t / SMITH_FINALE.surrender.assimilationSeconds) : ['purging', 'done'].includes(phase) ? 1 : 0,
    purge: phase === 'purging' ? smooth(t / SMITH_FINALE.surrender.purgeSeconds) : phase === 'done' ? 1 : 0,
  };
}
