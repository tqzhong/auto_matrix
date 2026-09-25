import type { DriveInput } from './freeway.js';

export const LOGOS_DEFENSE = {
  start: 58,
  finish: -58,
  limit: 18,
  halfWidth: 32,
  minAltitude: 6,
  maxAltitude: 48,
  cloudFloor: 34,
  shipRadius: 3.8,
  pulseCost: 23,
  pulseRange: 22,
  threats: [
    { id: 0, x: -6, altitude: 18, z: 42, radius: 3.4 },
    { id: 1, x: 13, altitude: 31, z: 29, radius: 3.8 },
    { id: 2, x: -18, altitude: 39, z: 16, radius: 3.5 },
    { id: 3, x: 4, altitude: 26, z: 3, radius: 4 },
    { id: 4, x: 20, altitude: 14, z: -10, radius: 3.6 },
    { id: 5, x: -12, altitude: 33, z: -23, radius: 3.8 },
    { id: 6, x: 7, altitude: 43, z: -36, radius: 3.5 },
    { id: 7, x: -20, altitude: 27, z: -48, radius: 3.7 },
  ],
} as const;

export type LogosFlightMode = 'defense' | 'sun';
export type LogosFlightStage = 'defense' | 'clouds' | 'sun' | 'stall';

export interface LogosFlight {
  mode: LogosFlightMode;
  stage: LogosFlightStage;
  phase: 'riding' | 'arrived' | 'wrecked';
  x: number;
  altitude: number;
  z: number;
  speed: number;
  lateral: number;
  vertical: number;
  elapsed: number;
  stageElapsed: number;
  hull: number;
  neo: number;
  cooldown: number;
  pulse: number;
  hits: number;
  destroyed: number;
  resolved: number;
}

export function newLogosFlight(mode: LogosFlightMode): LogosFlight {
  return mode === 'defense'
    ? { mode, stage: 'defense', phase: 'riding', x: 0, altitude: 22, z: LOGOS_DEFENSE.start, speed: 13,
      lateral: 0, vertical: 0, elapsed: 0, stageElapsed: 0, hull: 100, neo: 100, cooldown: 0, pulse: 0,
      hits: 0, destroyed: 0, resolved: 0 }
    : { mode, stage: 'clouds', phase: 'riding', x: 0, altitude: 5, z: 36, speed: 10,
      lateral: 0, vertical: 0, elapsed: 0, stageElapsed: 0, hull: 55, neo: 18, cooldown: 0, pulse: 0,
      hits: 0, destroyed: 0, resolved: 0 };
}

function steerFlight(next: LogosFlight, input: DriveInput, dt: number): void {
  const steer = Math.max(-1, Math.min(1, input.steer));
  const climb = input.brake ? -1 : Math.max(0, Math.min(1, input.throttle));
  next.lateral += (steer * 17 - next.lateral) * (1 - Math.exp(-5.5 * dt));
  next.vertical += (climb * 15 - next.vertical) * (1 - Math.exp(-5 * dt));
  next.x += next.lateral * dt;
  next.altitude += next.vertical * dt;
  next.x = Math.max(-LOGOS_DEFENSE.halfWidth, Math.min(LOGOS_DEFENSE.halfWidth, next.x));
  next.altitude = Math.max(LOGOS_DEFENSE.minAltitude, Math.min(LOGOS_DEFENSE.maxAltitude, next.altitude));
}

function stepDefense(flight: LogosFlight, input: DriveInput, dt: number, focus: boolean): LogosFlight {
  const next = { ...flight, elapsed: flight.elapsed + dt, stageElapsed: flight.stageElapsed + dt,
    cooldown: Math.max(0, flight.cooldown - dt), pulse: Math.max(0, flight.pulse - dt),
    neo: Math.min(100, flight.neo + dt * .8) };
  steerFlight(next, input, dt);
  next.speed += (14.5 - next.speed) * (1 - Math.exp(-2.5 * dt));

  if (focus && !next.cooldown && next.neo >= LOGOS_DEFENSE.pulseCost) {
    const targetIndex = LOGOS_DEFENSE.threats.findIndex((threat, index) => !(next.resolved & 1 << index)
      && threat.z <= flight.z + 1 && threat.z >= flight.z - LOGOS_DEFENSE.pulseRange);
    if (targetIndex >= 0) {
      next.resolved |= 1 << targetIndex; next.destroyed++; next.neo -= LOGOS_DEFENSE.pulseCost;
      next.cooldown = .7; next.pulse = .5;
    }
  }

  next.z -= next.speed * dt;
  for (const [index, threat] of LOGOS_DEFENSE.threats.entries()) {
    const bit = 1 << index;
    if (next.resolved & bit || flight.z < threat.z - 3 || next.z > threat.z + 3) continue;
    const crossed = flight.z >= threat.z - 3 && next.z <= threat.z + 3;
    if (!crossed) continue;
    const distance = Math.hypot(next.x - threat.x, next.altitude - threat.altitude);
    if (distance < LOGOS_DEFENSE.shipRadius + threat.radius && !next.cooldown) {
      next.hull = Math.max(0, next.hull - 28); next.speed *= .58; next.lateral *= -.3; next.vertical *= -.2;
      next.hits++; next.cooldown = .65;
    }
    if (next.z <= threat.z - 3) next.resolved |= bit;
  }
  if (next.z < -30) next.stage = 'clouds';
  if (next.hull <= 0 || next.elapsed >= LOGOS_DEFENSE.limit) {
    next.phase = 'wrecked'; next.speed = 0; next.lateral = 0; next.vertical = 0;
  } else if (next.z <= LOGOS_DEFENSE.finish) {
    next.z = LOGOS_DEFENSE.finish; next.speed = 0; next.lateral = 0; next.vertical = 0;
    next.phase = next.altitude >= LOGOS_DEFENSE.cloudFloor ? 'arrived' : 'wrecked';
  }
  return next;
}

function stepSun(flight: LogosFlight, input: DriveInput, dt: number): LogosFlight {
  const next = { ...flight, elapsed: flight.elapsed + dt, stageElapsed: flight.stageElapsed + dt,
    cooldown: 0, pulse: 0 };
  if (flight.stage === 'clouds') {
    steerFlight(next, input, dt); next.z -= next.speed * dt;
    if (next.altitude >= 29) {
      next.stage = 'sun'; next.stageElapsed = 0; next.altitude = 30; next.vertical = 0; next.speed = 8;
    } else if (next.elapsed >= 14) {
      next.phase = 'wrecked'; next.speed = 0; next.lateral = 0; next.vertical = 0;
    }
  } else if (flight.stage === 'sun') {
    next.x += next.lateral * dt; next.z -= next.speed * dt;
    next.lateral *= Math.exp(-2 * dt); next.speed = Math.max(3, next.speed - dt * 1.1);
    next.altitude = 30 + Math.sin(next.stageElapsed * .65) * .35;
    if (next.stageElapsed >= 4.2) {
      next.stage = 'stall'; next.stageElapsed = 0; next.vertical = -1; next.speed = 3.5;
    }
  } else {
    next.vertical -= 9.8 * dt; next.altitude += next.vertical * dt;
    next.z -= next.speed * dt; next.speed = Math.max(1.5, next.speed - dt * .35);
    next.lateral += (-next.x * .24 - next.lateral) * (1 - Math.exp(-2 * dt)); next.x += next.lateral * dt;
    if (next.altitude <= LOGOS_DEFENSE.cloudFloor - 29) {
      next.altitude = LOGOS_DEFENSE.cloudFloor - 29; next.phase = 'arrived'; next.speed = 0;
      next.lateral = 0; next.vertical = 0;
    }
  }
  return next;
}

export function stepLogosFlight(flight: LogosFlight, input: DriveInput, delta: number, focus = false): LogosFlight {
  if (flight.phase !== 'riding') return flight;
  const dt = Math.max(0, Math.min(.1, delta));
  return flight.mode === 'defense' ? stepDefense(flight, input, dt, focus) : stepSun(flight, input, dt);
}
