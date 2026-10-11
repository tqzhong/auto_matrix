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
export const LOGOS_CLOUD_TOP = 62;
export const LOGOS_IGNITION = { ready: 1.1, overload: 2.1, grip: { x: -.58, y: 3.25, z: .48 }, stroke: .44 } as const;

export const LOGOS_COCKPIT = {
  floor: -1.1, seat: 1.16,
  roots: { trinity: { x: -1.35, z: -5.1 }, neo: { x: 1.35, z: -5.1 } },
  grip: { x: .48, y: 2.08, z: .93 },
} as const;
export interface LogosPilotGesture { role: 'trinity' | 'neo'; flight: LogosFlight; waiting: boolean }

export function logosShipPose(flight: LogosFlight) {
  if (flight.crash) {
    const c = flight.crash, u = Math.min(1, c.elapsed / c.approach), hit = Math.max(0, c.elapsed - c.approach);
    const shake = hit > 0 ? Math.sin(hit * 26) * Math.exp(-hit * 4) : 0;
    return { x: flight.x, y: 1 + flight.altitude, z: flight.z, yaw: c.yaw * (1 - u),
      pitch: c.pitch * (1 - u) - .12 * u + shake * .1,
      roll: c.roll * (1 - u) - .065 * (1 - Math.exp(-hit * 3)) + shake * .045 };
  }
  return { x: flight.x, y: 1 + flight.altitude, z: flight.z,
    yaw: -Math.atan2(flight.lateral, Math.max(1, flight.speed)) * .72,
    pitch: flight.ignition ? Math.max(flight.ignition.phase === 'powered' ? -.32 : -.72, Math.min(.32, flight.vertical * .024))
      : flight.stage === 'stall' ? Math.max(-.72, -.18 + flight.vertical * .025) : Math.max(-.32, Math.min(.32, flight.vertical * .024)),
    roll: Math.max(-.34, Math.min(.34, -flight.lateral * .022)) };
}

/** Furniture, crew and cameras all use the renderer's YXZ rotation order. */
export function logosShipPoint(flight: LogosFlight, point: { x: number; y: number; z: number }) {
  const pose = logosShipPose(flight);
  const x = point.x * Math.cos(pose.roll) - point.y * Math.sin(pose.roll);
  const bankY = point.x * Math.sin(pose.roll) + point.y * Math.cos(pose.roll);
  const y = bankY * Math.cos(pose.pitch) - point.z * Math.sin(pose.pitch);
  const z = bankY * Math.sin(pose.pitch) + point.z * Math.cos(pose.pitch);
  return { x: pose.x + x * Math.cos(pose.yaw) + z * Math.sin(pose.yaw), y: pose.y + y,
    z: pose.z - x * Math.sin(pose.yaw) + z * Math.cos(pose.yaw) };
}

export function logosCrewRoot(flight: LogosFlight, role: LogosPilotGesture['role']) {
  const point = logosShipPoint(flight, { ...LOGOS_COCKPIT.roots[role], y: LOGOS_COCKPIT.floor + 1 });
  // Film sets sit one world unit below actor coordinates; the remaining actor
  // offset is rotated with the ship by AgentRenderer.
  return { ...point, y: point.y - 1, yaw: logosShipPose(flight).yaw + Math.PI };
}

export function logosControlGrip(flight: LogosFlight, role: LogosPilotGesture['role'], side: number) {
  if (role === 'neo') return { x: side * .64, y: 1.78, z: .48 };
  const angle = Math.max(-1, Math.min(1, flight.lateral / 17)) * .22;
  const x = side * LOGOS_COCKPIT.grip.x, y = LOGOS_COCKPIT.grip.y - 1.86;
  return { x: x * Math.cos(angle) - y * Math.sin(angle), y: 1.86 + x * Math.sin(angle) + y * Math.cos(angle),
    z: LOGOS_COCKPIT.grip.z - Math.max(-1, Math.min(1, flight.vertical / 15)) * .12 };
}

export function logosIgniterGrip(flight: LogosFlight) {
  return { ...LOGOS_IGNITION.grip, y: LOGOS_IGNITION.grip.y - (flight.ignition?.stroke ?? 0) * LOGOS_IGNITION.stroke };
}

export function logosIgniterReach(flight: LogosFlight): number {
  if (!flight.ignition || flight.ignition.phase === 'powered' || flight.stage !== 'stall') return 0;
  const t = flight.ignition.phase === 'running' ? 1 - Math.max(0, flight.ignition.elapsed - .3) / .5 : flight.stageElapsed / .45;
  const u = Math.max(0, Math.min(1, t)); return u * u * (3 - 2 * u);
}

export function logosPowered(flight: LogosFlight): boolean {
  if (flight.crash && flight.crash.elapsed >= flight.crash.approach) return false;
  return flight.phase !== 'wrecked' && (flight.ignition
    ? flight.ignition.phase === 'powered' || flight.ignition.phase === 'running' && flight.phase === 'riding'
    : flight.stage !== 'stall');
}

export function logosIgnitionText(flight: LogosFlight): string {
  if (flight.crash) return flight.crash.elapsed < flight.crash.approach ? 'Neo：抓紧！机器塔就在前方'
    : flight.phase === 'arrived' ? 'Logos 停在塔体残骸中 · 继续寻找 Trinity' : '船首撞入塔体 · 风挡破裂';
  const ignition = flight.ignition;
  if (!ignition) return '动力失效 · Logos 坠回机器城';
  if (ignition.phase === 'powered') return 'W 爬升穿云 · A / D 修正姿态';
  if (flight.stage !== 'stall') return flight.stage === 'sun' ? '动力已断 · 飞船依惯性掠过阳光' : '云层放电 · 引擎失效，保持姿态';
  if (ignition.phase === 'running') return '引擎重新点燃 · A / D 修正航向 · 准备撞击';
  if (ignition.phase === 'ready') return 'Neo：现在！松开 G 点火';
  if (ignition.phase === 'pumping') return '保持 G 缓慢蓄压 · 等待 Neo 提示再松开';
  if (ignition.held) return '点火器过载 · 先松开 G，再重新蓄压';
  return ignition.attempts ? 'Neo：再来，慢一点。按住 G 重新蓄压' : 'Neo：用点火器！按住 G 缓慢蓄压';
}

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
  /** Absolute route height. Missing on saves from the former, separate sun stage. */
  cloudTop?: number;
  /** Absent on active saves of the former automatic descent. */
  ignition?: { phase: 'powered' | 'offline' | 'pumping' | 'ready' | 'running'; elapsed: number;
    held: boolean; pump: number; stroke: number; attempts: number };
  /** Saved origin and clock keep collision geometry and both crew in the same shot. */
  crash?: { elapsed: number; approach: number; x: number; altitude: number; z: number; speed: number;
    lateral: number; vertical: number; pitch: number; yaw: number; roll: number };
}

export function logosCrashTarget(flight: LogosFlight) {
  const c = flight.crash!;
  return { x: c.x + c.lateral * c.approach * .5, y: 1 + Math.max(5, c.altitude + c.vertical * c.approach),
    z: c.z - c.speed * c.approach - 10.6 };
}

export function logosCrashBrace(flight: LogosFlight): number {
  if (!flight.crash) return 0;
  const t = flight.crash.elapsed - flight.crash.approach;
  return t < 0 ? Math.max(0, 1 + t / .8) * .12 : .1 + Math.sin(Math.min(1, t / .4) * Math.PI) * .22;
}

function stepCrash(flight: LogosFlight, dt: number): LogosFlight {
  if (!dt) return flight;
  const c = { ...flight.crash!, elapsed: Math.min(flight.crash!.approach + 2.6, flight.crash!.elapsed + dt) };
  const next = { ...flight, crash: c, ignition: { ...flight.ignition!, elapsed: flight.ignition!.elapsed + dt,
    stroke: flight.ignition!.stroke * Math.exp(-9 * dt) }, elapsed: flight.elapsed + dt, stageElapsed: flight.stageElapsed + dt };
  const t = Math.min(c.approach, c.elapsed), u = t / c.approach, hit = Math.max(0, c.elapsed - c.approach);
  next.x = c.x + c.lateral * (t - t * u * .5);
  next.z = c.z - c.speed * t - c.speed / 8 * (1 - Math.exp(-hit * 8));
  const contactHeight = Math.max(5, c.altitude + c.vertical * c.approach);
  next.altitude = hit ? 5 + (contactHeight - 5) * Math.exp(-hit * 4) : Math.max(5, c.altitude + c.vertical * t);
  next.speed = c.speed * Math.exp(-hit * 8); next.lateral = c.lateral * (1 - u);
  next.vertical = hit ? -(contactHeight - 5) * 4 * Math.exp(-hit * 4) : c.vertical;
  if (c.elapsed >= c.approach + 2.6) { next.phase = 'arrived'; next.speed = 0; next.lateral = 0; next.vertical = 0; }
  return next;
}

function newIgnition(): NonNullable<LogosFlight['ignition']> {
  return { phase: 'powered', elapsed: 0, held: false, pump: 0, stroke: 0, attempts: 0 };
}

export function logosCloudTop(flight: LogosFlight): number {
  return flight.cloudTop ?? (flight.mode === 'sun' ? 29 : LOGOS_CLOUD_TOP);
}

export function logosFlightSet(flight: LogosFlight): string {
  return flight.mode === 'sun' && flight.cloudTop === undefined ? 'film_above_clouds' : 'film_machine_defense';
}

export function continueLogosFlight(flight: LogosFlight): LogosFlight {
  return { ...flight, mode: 'sun', stage: 'clouds', phase: 'riding', stageElapsed: 0,
    speed: flight.speed || 10, cooldown: 0, pulse: 0, cloudTop: LOGOS_CLOUD_TOP, ignition: newIgnition() };
}

export function newLogosFlight(mode: LogosFlightMode): LogosFlight {
  return mode === 'defense'
    ? { mode, stage: 'defense', phase: 'riding', x: 0, altitude: 22, z: LOGOS_DEFENSE.start, speed: 13,
      lateral: 0, vertical: 0, elapsed: 0, stageElapsed: 0, hull: 100, neo: 100, cooldown: 0, pulse: 0,
      hits: 0, destroyed: 0, resolved: 0, cloudTop: LOGOS_CLOUD_TOP }
    : { mode, stage: 'clouds', phase: 'riding', x: 0, altitude: LOGOS_DEFENSE.cloudFloor, z: LOGOS_DEFENSE.finish, speed: 10,
      lateral: 0, vertical: 0, elapsed: 0, stageElapsed: 0, hull: 55, neo: 18, cooldown: 0, pulse: 0,
      hits: 0, destroyed: 0, resolved: 0, cloudTop: LOGOS_CLOUD_TOP, ignition: newIgnition() };
}

function steerFlight(next: LogosFlight, input: DriveInput, dt: number): void {
  const steer = Math.max(-1, Math.min(1, input.steer));
  const climb = input.brake ? -1 : Math.max(0, Math.min(1, input.throttle));
  next.lateral += (steer * 17 - next.lateral) * (1 - Math.exp(-5.5 * dt));
  const climbSpeed = next.mode === 'sun' && next.ignition ? 32 : 15;
  next.vertical += (climb * climbSpeed - next.vertical) * (1 - Math.exp(-5 * dt));
  next.x += next.lateral * dt;
  next.altitude += next.vertical * dt;
  next.x = Math.max(-LOGOS_DEFENSE.halfWidth, Math.min(LOGOS_DEFENSE.halfWidth, next.x));
  next.altitude = Math.max(LOGOS_DEFENSE.minAltitude, Math.min(next.mode === 'sun' ? logosCloudTop(next) + 8 : LOGOS_DEFENSE.maxAltitude, next.altitude));
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
    next.z = LOGOS_DEFENSE.finish;
    next.phase = next.altitude >= LOGOS_DEFENSE.cloudFloor ? 'arrived' : 'wrecked';
    if (next.phase === 'wrecked') { next.speed = 0; next.lateral = 0; next.vertical = 0; }
  }
  return next;
}

function stepIgnitionFlight(flight: LogosFlight, input: DriveInput, dt: number, focus: boolean): LogosFlight {
  if (!dt) return flight;
  if (flight.crash) return stepCrash(flight, dt);
  const ignition = { ...flight.ignition! }, next = { ...flight, ignition, elapsed: flight.elapsed + dt,
    stageElapsed: flight.stageElapsed + dt, cooldown: 0, pulse: 0 };
  ignition.elapsed += dt;
  if (ignition.phase === 'powered') {
    steerFlight(next, input, dt);
    if (next.altitude >= logosCloudTop(next) - 4) { ignition.phase = 'offline'; ignition.elapsed = 0; }
    else if (next.stageElapsed >= 14) next.phase = 'wrecked';
  } else {
    if (flight.stage === 'stall' && ignition.phase !== 'running') {
      if (focus && !ignition.held && ignition.phase === 'offline') {
        ignition.phase = 'pumping'; ignition.pump = 0; ignition.elapsed = 0;
      }
      if (ignition.phase === 'pumping' || ignition.phase === 'ready') {
        if (focus) {
          ignition.pump += dt;
          if (ignition.pump >= LOGOS_IGNITION.overload) { ignition.phase = 'offline'; ignition.attempts++; }
          else if (ignition.pump >= LOGOS_IGNITION.ready) ignition.phase = 'ready';
        } else {
          ignition.phase = ignition.phase === 'ready' ? 'running' : 'offline'; ignition.elapsed = 0; ignition.attempts++;
        }
      }
      ignition.held = focus;
    }
    const pumping = ignition.phase === 'pumping' || ignition.phase === 'ready';
    const target = pumping ? Math.min(1, ignition.pump / LOGOS_IGNITION.ready) : 0;
    ignition.stroke += (target - ignition.stroke) * (1 - Math.exp(-9 * dt));
    // Gravity plus drag makes a continuous arc; restored thrust arrests part of the descent.
    const acceleration = ignition.phase === 'running' ? Math.max(0, (-7 - flight.vertical) * 2) : 0;
    next.vertical += (-9.81 - .035 * flight.vertical * Math.abs(flight.vertical) + acceleration) * dt;
    next.altitude += (flight.vertical + next.vertical) * .5 * dt;
    next.lateral += (Math.max(-1, Math.min(1, input.steer)) * 5 - next.lateral) * (1 - Math.exp(-1.5 * dt));
    next.x = Math.max(-LOGOS_DEFENSE.halfWidth, Math.min(LOGOS_DEFENSE.halfWidth, flight.x + next.lateral * dt));
    next.speed += ((ignition.phase === 'running' ? 18 : 4) - next.speed) * (1 - Math.exp(-.6 * dt));
    if (flight.stage === 'clouds' && next.altitude >= logosCloudTop(next)) { next.stage = 'sun'; next.stageElapsed = 0; }
    if (flight.stage === 'clouds' && next.stage !== 'sun' && next.vertical <= 0) next.phase = 'wrecked';
    else if (flight.stage === 'sun' && next.vertical <= 0) {
      next.stage = 'stall'; next.stageElapsed = 0;
    }
    if (next.altitude <= 5) { next.altitude = 5; if (ignition.phase !== 'running') next.phase = 'wrecked'; }
  }
  next.z -= next.speed * dt;
  if (next.phase === 'riding' && next.stage === 'stall' && ignition.phase === 'running' && next.altitude <= 32) {
    const pose = logosShipPose(next);
    next.crash = { elapsed: 0, approach: Math.min(2.2, Math.max(.25, (next.altitude - 5) / Math.max(1, -next.vertical))),
      x: next.x, altitude: next.altitude, z: next.z, speed: next.speed, lateral: next.lateral, vertical: next.vertical,
      pitch: pose.pitch, yaw: pose.yaw || 0, roll: pose.roll || 0 };
  }
  ignition.held = focus;
  if (next.phase !== 'riding') { next.speed = 0; next.vertical = 0; next.lateral = 0; }
  return next;
}

function stepSun(flight: LogosFlight, input: DriveInput, dt: number, focus: boolean): LogosFlight {
  if (flight.ignition) return stepIgnitionFlight(flight, input, dt, focus);
  const next = { ...flight, elapsed: flight.elapsed + dt, stageElapsed: flight.stageElapsed + dt,
    cooldown: 0, pulse: 0 };
  const sunAltitude = flight.cloudTop === undefined ? 30 : logosCloudTop(flight) + 4;
  if (flight.stage === 'clouds') {
    steerFlight(next, input, dt); next.z -= next.speed * dt;
    if (next.altitude >= logosCloudTop(next)) {
      next.stage = 'sun'; next.stageElapsed = 0; next.altitude = sunAltitude; next.vertical = 0; next.speed = 8;
    } else if (next.stageElapsed >= 14) {
      next.phase = 'wrecked'; next.speed = 0; next.lateral = 0; next.vertical = 0;
    }
  } else if (flight.stage === 'sun') {
    next.x += next.lateral * dt; next.z -= next.speed * dt;
    next.lateral *= Math.exp(-2 * dt); next.speed = Math.max(3, next.speed - dt * 1.1);
    next.altitude = sunAltitude + Math.sin(next.stageElapsed * .65) * .35;
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
  return flight.mode === 'defense' ? stepDefense(flight, input, dt, focus) : stepSun(flight, input, dt, focus);
}
