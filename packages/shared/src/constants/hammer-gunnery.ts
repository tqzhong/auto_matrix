import type { Vector3 } from '../types/index.js';
import { HAMMER_BEAMS, HAMMER_ROUTE, hammerCenter, hammerProjectPoint, hammerRoutePoint, hammerShipPoint, hammerTunnelSection, type HammerFlight } from './hammer-flight.js';

export const HAMMER_GUNNERY = {
  ammo: 220, interval: .11, radius: 1.25,
  seat: { x: 0, z: 11.4 }, grip: { x: .48, y: 2.08, z: .93 },
  muzzle: { x: 0, y: .35, z: 15.15 },
  waves: [0, 1.5, 4, 6, 8, 10, 12],
} as const;

export interface HammerGunnery {
  ammo: number; shots: number; kills: number; yaw: number; pitch: number; nextShot: number;
  targets: { spawn: number; health: number; struck: boolean; downAt?: number; downFrom?: Vector3 }[];
  lastShot?: { from: Vector3; to: Vector3; at: number; target?: number };
}

export function newHammerGunnery(): HammerGunnery {
  return { ammo: HAMMER_GUNNERY.ammo, shots: 0, kills: 0, yaw: 0, pitch: 0, nextShot: 0,
    targets: HAMMER_GUNNERY.waves.map(spawn => ({ spawn, health: 4, struck: false })) };
}

export function hammerGunneryAngles(yaw: number, pitch: number) {
  return { yaw: Math.max(-1.05, Math.min(1.05, yaw)), pitch: Math.max(-.65, Math.min(.65, pitch)) };
}

/** Gun angles are relative to the rolling ship, independent of the operator's head. */
export function hammerGunneryView(flight: HammerFlight, yaw = flight.gunnery?.yaw ?? 0, pitch = flight.gunnery?.pitch ?? 0) {
  const aim = hammerGunneryAngles(yaw, pitch), eye = hammerShipPoint(flight, HAMMER_GUNNERY.muzzle);
  const vector = (point: Vector3) => {
    const tip = hammerShipPoint(flight, { x: HAMMER_GUNNERY.muzzle.x + point.x, y: HAMMER_GUNNERY.muzzle.y + point.y, z: HAMMER_GUNNERY.muzzle.z + point.z });
    return { x: tip.x - eye.x, y: tip.y - eye.y, z: tip.z - eye.z };
  };
  return { eye,
    direction: vector({ x: Math.sin(aim.yaw) * Math.cos(aim.pitch), y: -Math.sin(aim.pitch), z: Math.cos(aim.yaw) * Math.cos(aim.pitch) }),
    right: vector({ x: -Math.cos(aim.yaw), y: 0, z: Math.sin(aim.yaw) }),
    up: vector({ x: Math.sin(aim.yaw) * Math.sin(aim.pitch), y: Math.cos(aim.pitch), z: Math.cos(aim.yaw) * Math.sin(aim.pitch) }) };
}

export function hammerGunneryTarget(flight: HammerFlight, index: number): Vector3 {
  const target = flight.gunnery!.targets[index], age = Math.max(0, flight.elapsed - target.spawn);
  if (target.downFrom && target.downAt !== undefined) {
    const fall = Math.min(2, flight.elapsed - target.downAt);
    return { ...target.downFrom, y: target.downFrom.y - 4.9 * fall * fall };
  }
  // Attack the stern from the same pipe as the ship, never straight through a bend.
  const distance = 175 - flight.z - Math.max(18, 33 - age * 3);
  const x = Math.sin(index * 2.3) * 2.8 + Math.sin(age * 1.7 + index) * .65;
  const y = Math.cos(index * 2.2) * 1.8 + Math.sin(age * 2.1) * .45;
  return flight.maneuver ? hammerRoutePoint(distance, { x, y, z: 0 })
    : { x: hammerCenter(175 - distance) + x, y: 10 + y, z: 175 - distance };
}

function blocked(flight: HammerFlight, point: Vector3): boolean {
  if (!flight.maneuver) return false;
  const station = hammerProjectPoint(point, 175 - flight.z), section = hammerTunnelSection(station.distance);
  const x = station.x / section.width, y = station.y / section.height;
  const angle = (Math.floor(Math.atan2(y, x) / (Math.PI / 12)) + .5) * Math.PI / 12;
  return x * Math.cos(angle) + y * Math.sin(angle) > Math.cos(Math.PI / 24)
    || HAMMER_BEAMS.some(beam => Math.abs(station.distance - beam.distance) < beam.depth / 2
      && Math.abs(station.x) < beam.width / 2 && Math.abs(station.y - beam.y) < beam.height / 2);
}

/** The same ray feeds damage, the physical tracer and the CRT reticle. Pipe walls stop rounds. */
export function hammerGunneryAim(flight: HammerFlight, yaw = flight.gunnery?.yaw ?? 0, pitch = flight.gunnery?.pitch ?? 0) {
  const { eye, direction } = hammerGunneryView(flight, yaw, pitch);
  let distance = 80, target: number | undefined;
  for (let d = .25; d < distance; d += .5) {
    if (blocked(flight, { x: eye.x + direction.x * d, y: eye.y + direction.y * d, z: eye.z + direction.z * d })) { distance = d; break; }
  }
  flight.gunnery?.targets.forEach((enemy, i) => {
    if (enemy.health <= 0 || enemy.struck || enemy.spawn > flight.elapsed) return;
    const point = hammerGunneryTarget(flight, i), x = point.x - eye.x, y = point.y - eye.y, z = point.z - eye.z;
    const projection = x * direction.x + y * direction.y + z * direction.z;
    const discriminant = HAMMER_GUNNERY.radius ** 2 - (x * x + y * y + z * z - projection * projection);
    const entry = discriminant >= 0 ? projection - Math.sqrt(discriminant) : -1;
    if (entry > 0 && entry < distance) { distance = entry; target = i; }
  });
  return { from: eye, to: { x: eye.x + direction.x * distance, y: eye.y + direction.y * distance, z: eye.z + direction.z * distance }, target };
}

export function fireHammerGunnery(flight: HammerFlight, yaw: number, pitch: number): boolean {
  const gun = flight.gunnery;
  if (!gun || flight.phase !== 'riding' || !gun.ammo || flight.elapsed + 1e-6 < gun.nextShot || !Number.isFinite(yaw) || !Number.isFinite(pitch)) return false;
  Object.assign(gun, hammerGunneryAngles(yaw, pitch));
  const aim = hammerGunneryAim(flight); gun.ammo--; gun.shots++; gun.nextShot = flight.elapsed + HAMMER_GUNNERY.interval;
  gun.lastShot = { ...aim, at: flight.elapsed };
  if (aim.target !== undefined && --gun.targets[aim.target].health === 0) {
    const target = gun.targets[aim.target]; target.downFrom = hammerGunneryTarget(flight, aim.target); target.downAt = flight.elapsed; gun.kills++;
    flight.pursuit = Math.max(0, flight.pursuit - 5);
  }
  return true;
}

/** Bounded thruster commands, not a teleport or invulnerable rail, for the unowned Niobe. */
export function hammerNiobeInput(flight: HammerFlight) {
  const clamp = (n: number) => Math.max(-1, Math.min(1, n));
  const maneuver = flight.maneuver, distance = HAMMER_ROUTE.start - flight.z;
  if (!maneuver) return { throttle: flight.speed < 28 ? 1 : 0, brake: false, steer: clamp((hammerCenter(flight.z - 12) - flight.x) * .35 - flight.lateral * .12) };
  const narrow = distance > 162 && distance < 280;
  const lift = distance < 112 ? 2 : distance > 290 ? -2.5 : 0;
  return { throttle: flight.speed < 23 ? 1 : 0, brake: false,
    steer: clamp(((narrow ? -1.5 : 0) - flight.x) * .6 - flight.lateral * .22),
    lift: clamp((lift - maneuver.lift) * .6 - maneuver.vertical * .22),
    roll: clamp(((narrow ? Math.PI / 2 : 0) - maneuver.bank) * 2 - maneuver.bankVelocity * .6) };
}

export function hammerGunneryTrack(flight: HammerFlight, index: number) {
  const point = hammerGunneryTarget(flight, index), view = hammerGunneryView(flight, 0, 0);
  const delta = { x: point.x - view.eye.x, y: point.y - view.eye.y, z: point.z - view.eye.z };
  const dot = (v: Vector3) => delta.x * v.x + delta.y * v.y + delta.z * v.z;
  const x = -dot(view.right), y = dot(view.up), z = dot(view.direction);
  return hammerGunneryAngles(Math.atan2(x, z), -Math.atan2(y, Math.hypot(x, z)));
}

export function stepHammerGunnery(flight: HammerFlight, automatic: boolean, dt: number): void {
  const gun = flight.gunnery; if (!gun || flight.phase !== 'riding' || dt <= 0) return;
  if (automatic) {
    const index = gun.targets.findIndex(target => target.health > 0 && !target.struck && target.spawn <= flight.elapsed);
    if (index >= 0) {
      const aim = hammerGunneryTrack(flight, index), turn = Math.min(1, dt * 9);
      gun.yaw += (aim.yaw - gun.yaw) * turn; gun.pitch += (aim.pitch - gun.pitch) * turn;
      fireHammerGunnery(flight, gun.yaw, gun.pitch);
    }
  }
  for (const target of gun.targets) if (target.health > 0 && !target.struck && flight.elapsed - target.spawn >= 5.5) {
    target.struck = true; flight.hull = Math.max(0, flight.hull - 28); flight.pursuit = Math.min(100, flight.pursuit + 12);
  }
  if (flight.hull <= 0 || flight.pursuit >= 100) flight.phase = 'wrecked';
}
