import { LOCATIONS } from './locations.js';
import { LIFE_ROOMS, lifeRoomCenter } from './life-world.js';
import { FILM_SETS, filmSetAt, filmBlocked, filmGroundHeight } from './film-sets.js';
import type { Vector3 } from '../types/agent.js';
import type { WorldStructure } from '../types/sandbox.js';

export const STREET_SPACING = 80;
export const CITY_CENTER = { x: 1120, y: 1, z: 920 };
export const PLAYER_GRAVITY = 30;
export const PLAYER_JUMP_SPEED = 10;
export const PLAYER_WALK_SPEED = 3.4;
export const PLAYER_RUN_SPEED = 8.4;

// A location's public entrance is also its meeting point. Render and simulation
// share this position so residents never spawn inside a solid building.
export function locationEntrance(id: string): Vector3 {
  if (FILM_SETS[id]) return { ...FILM_SETS[id].center, x: FILM_SETS[id].center.x + (id === 'film_freeway_101' ? 14 : 0), z: FILM_SETS[id].center.z + FILM_SETS[id].depth * .32 };
  const location = LOCATIONS[id] ?? LOCATIONS.times_square;
  if (id === 'downtown') return { ...CITY_CENTER };
  const { min, max } = location.bounds;
  return {
    x: (min.x + max.x) / 2,
    y: location.world === 'real' ? min.y + 1 : id === 'rooftop_A' ? min.y + 1 : 1,
    z: max.z + 9,
  };
}

export function streetPath(from: Vector3, to: Vector3): Vector3[] {
  if (from.y < 0 || to.y < 0 || from.y > 10 || to.y > 10) return [{ ...to }];
  const roadZ = Math.round(from.z / STREET_SPACING) * STREET_SPACING;
  const roadX = Math.round(to.x / STREET_SPACING) * STREET_SPACING;
  return [
    { x: from.x, y: 1, z: roadZ },
    { x: roadX, y: 1, z: roadZ },
    { x: roadX, y: 1, z: to.z },
    { ...to },
  ].filter((point, i, path) => {
    const previous = i ? path[i - 1] : from;
    return Math.hypot(point.x - previous.x, point.z - previous.z) > 0.1;
  });
}

export interface CityBuilding {
  x: number;
  z: number;
  width: number;
  depth: number;
  height: number;
  variant: number;
  location?: string;
}

export function cityNoise(x: number, z: number): number {
  const n = Math.sin(x * 127.1 + z * 311.7) * 43758.5453;
  return n - Math.floor(n);
}

// The renderer and player collision use the same building footprints.
export function cityBuildings(): CityBuilding[] {
  const buildings: CityBuilding[] = [];
  const locations = Object.values(LOCATIONS).filter(l => l.world === 'matrix' && l.id !== 'downtown' && !FILM_SETS[l.id]);
  for (let x = 280; x < 2000; x += STREET_SPACING) for (let z = 280; z < 1840; z += STREET_SPACING) {
    if (locations.some(l => x > l.bounds.min.x - 55 && x < l.bounds.max.x + 55 && z > l.bounds.min.z - 55 && z < l.bounds.max.z + 70)) continue;
    const n = cityNoise(x, z);
    const core = 1 - Math.min(1, Math.hypot(x - 1160, z - 1000) / 900);
    buildings.push({ x, z, height: 24 + n * 90 + core * 90, width: 40 + n * 14, depth: (40 + n * 14) * 0.82, variant: Math.floor(n * 4) });
  }
  for (const location of locations) {
    if (!location.isInterior || location.id === 'subway_station') continue;
    const { min, max } = location.bounds;
    buildings.push({ x: (min.x + max.x) / 2, z: (min.z + max.z) / 2,
      height: location.id === 'metacortex_office' ? 110 : location.id === 'architects_chamber' ? 160 : Math.max(12, max.y - min.y),
      width: max.x - min.x, depth: max.z - min.z, variant: 0, location: location.id });
  }
  buildings.push({ x: locationEntrance('rooftop_A').x, z: locationEntrance('rooftop_A').z - 12, width: 44, depth: 55, height: 50, variant: 0, location: 'rooftop_A' });
  return buildings;
}

export const CITY_BUILDINGS = cityBuildings();

export interface PlayerInput {
  x: number;
  z: number;
  yaw: number;
  sprint: boolean;
  jump: boolean;
  crouch?: boolean;
  drive?: import('./freeway.js').DriveInput;
  climb?: number;
  focus?: boolean;
  sequence: number;
}

export function groundHeight(position: Vector3, matrix: boolean): number {
  const set = filmSetAt(position, matrix);
  if (set) return filmGroundHeight(position, set);
  if (matrix) {
    // Rooftops support characters who reach them by jumping or flight.
    let floor = 1;
    for (const building of CITY_BUILDINGS) {
      if (Math.abs(position.x - building.x) <= building.width / 2 && Math.abs(position.z - building.z) <= building.depth / 2 && position.y >= building.height - 1) floor = Math.max(floor, building.height + 1);
    }
    return floor;
  }
  let floor = -100;
  for (const location of Object.values(LOCATIONS).filter(l => l.world === 'real')) {
    const entry = locationEntrance(location.id);
    if (Math.abs(position.x - entry.x) < 32 && Math.abs(position.z - (entry.z - 8)) < 26 && position.y >= entry.y - 3) floor = Math.max(floor, entry.y);
  }
  return floor;
}

export function playerBlocked(position: Vector3, matrix: boolean, radius = 1.1, structures: WorldStructure[] = []): boolean {
  if (structures.some(s => s.kind === 'barricade' && s.matrix === matrix && s.health > 0 && position.y < s.position.y + (s.film?.height ?? 3) && position.y > s.position.y - 3 && Math.abs(position.x - s.position.x) < (s.film ? s.film.width / 2 : 4) + radius && Math.abs(position.z - s.position.z) < (s.film ? s.film.depth / 2 : 1.2) + radius)) return true;
  const set = filmSetAt(position, matrix);
  if (set) return filmBlocked(position, set, radius);
  if (!matrix) return Math.hypot(position.x - 2170, position.z - 2390) > 440;
  if (position.x < 0 || position.x > 2560 || position.z < 0 || position.z > 2560) return true;
  return CITY_BUILDINGS.some(building => {
    if (position.y >= building.height + .8 || Math.abs(position.x - building.x) >= building.width / 2 + radius || Math.abs(position.z - building.z) >= building.depth / 2 + radius) return false;
    const room = building.location ? LIFE_ROOMS[building.location] : undefined;
    if (!room || position.y >= 8) return true;
    const center = lifeRoomCenter(building.location!)!;
    const inside = Math.abs(position.x - center.x) < room.width / 2 - radius - .4 && position.z > center.z - room.depth / 2 + radius + .4;
    const atDoor = Math.abs(position.x - center.x) < 5 - radius;
    return !inside || position.z > center.z + room.depth / 2 - radius - .4 && !atDoor;
  });
}

export function stepPlayer(position: Vector3, verticalVelocity: number, input: PlayerInput, dt: number, matrix: boolean, structures: WorldStructure[] = [], horizontalVelocity?: Pick<Vector3, 'x' | 'z'>, speedScale = 1): { position: Vector3; verticalVelocity: number; horizontalVelocity: Pick<Vector3, 'x' | 'z'> } {
  const next = { ...position };
  const length = Math.hypot(input.x, input.z);
  const speed = (input.crouch ? PLAYER_WALK_SPEED * .48 : input.sprint ? PLAYER_RUN_SPEED : PLAYER_WALK_SPEED) * speedScale;
  const floor = groundHeight(position, matrix);
  let vy = verticalVelocity;
  if (input.jump && !input.crouch && position.y <= floor + 0.1 && verticalVelocity <= 0) vy = PLAYER_JUMP_SPEED;
  const nextY = next.y + vy * dt - .5 * PLAYER_GRAVITY * dt * dt;
  vy -= PLAYER_GRAVITY * dt;
  if (nextY < floor) { next.y = floor; vy = 0; } else next.y = nextY;
  const scale = length > 1 ? 1 / length : 1;
  const blend = 1 - Math.exp(-(length > .01 ? 10 : 18) * dt);
  const targetX = input.x * scale * speed; const targetZ = input.z * scale * speed;
  const velocity = horizontalVelocity ? { x: horizontalVelocity.x + (targetX - horizontalVelocity.x) * blend, z: horizontalVelocity.z + (targetZ - horizontalVelocity.z) * blend } : { x: targetX, z: targetZ };
  const x = { ...next, x: next.x + velocity.x * dt };
  if (!playerBlocked(x, matrix, 1.1, structures)) next.x = x.x; else velocity.x = 0;
  const z = { ...next, z: next.z + velocity.z * dt };
  if (!playerBlocked(z, matrix, 1.1, structures)) next.z = z.z; else velocity.z = 0;
  return { position: next, verticalVelocity: vy, horizontalVelocity: velocity };
}
