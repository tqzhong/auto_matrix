import type { Vector3 } from '../types/agent.js';
import type { WorldStructure } from '../types/sandbox.js';

export const CITY_CAR = { width: 4, depth: 8, height: 2.8, acceleration: 2.5, braking: 5, routeLength: 1550 };
export interface CityTrafficState {
  elapsed: number;
  cars: { distance: number; speed: number; waiting?: boolean }[];
}
export const CITY_TRAFFIC_ROUTES = Array.from({ length: 64 }, (_, i) => {
  const axis = i % 2, direction = i % 4 < 2 ? 1 : -1;
  return { axis, direction, lane: 640 + (Math.floor(i / 4) % 8) * 80 + (axis ? direction : -direction) * 4, speed: 10 + i % 7 };
});
export function cityTrafficPose(index: number, car: CityTrafficState['cars'][number]): { position: Vector3; yaw: number; width: number; depth: number } {
  const route = CITY_TRAFFIC_ROUTES[index], coordinate = route.direction > 0 ? 300 + car.distance : 1850 - car.distance;
  return { position: { x: route.axis ? route.lane : coordinate, y: 1, z: route.axis ? coordinate : route.lane },
    yaw: (route.axis ? 0 : Math.PI / 2) + (route.direction > 0 ? 0 : Math.PI),
    width: route.axis ? CITY_CAR.width : CITY_CAR.depth, depth: route.axis ? CITY_CAR.depth : CITY_CAR.width };
}
export function cityTrafficStructures(state?: CityTrafficState): WorldStructure[] {
  return state?.cars.map((car, index) => {
    const pose = cityTrafficPose(index, car);
    return { id: `traffic:${index}`, kind: 'barricade', owner: 'matrix', matrix: true, health: car.waiting ? 0 : 99999,
      position: pose.position, film: { scene: 'city', width: pose.width, depth: pose.depth, height: CITY_CAR.height } };
  }) ?? [];
}
export function cityTrafficSignal(axis: number, elapsed: number): 'green' | 'amber' | 'red' {
  const age = (elapsed + (axis ? 12 : 0)) % 24;
  return age < 9 ? 'green' : age < 11 ? 'amber' : 'red';
}
/** Swept ground movement, including saved city vehicles and the arrest sedan. */
export function cityVehicleBlocked(from: Vector3, to: Vector3, matrix: boolean, structures: WorldStructure[]): boolean {
  if (!matrix) return false;
  const vehicles = structures.filter(item => item.id.startsWith('traffic:') || item.id === 'film:office:arrest-car');
  const steps = Math.max(1, Math.ceil(Math.hypot(to.x - from.x, to.z - from.z) / .4));
  for (let i = 1; i <= steps; i++) {
    const x = from.x + (to.x - from.x) * i / steps, y = from.y + (to.y - from.y) * i / steps, z = from.z + (to.z - from.z) * i / steps;
    if (vehicles.some(car => car.health > 0 && y < car.position.y + car.film!.height && y > car.position.y - 3
      && Math.abs(x - car.position.x) < car.film!.width / 2 + .9 && Math.abs(z - car.position.z) < car.film!.depth / 2 + .9)) return true;
  }
  return false;
}
