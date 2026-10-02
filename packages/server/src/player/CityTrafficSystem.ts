import { CITY_BUILDINGS, CITY_CAR, CITY_TRAFFIC_ROUTES, cityTrafficPose, cityTrafficSignal, cityTrafficStructures, type SandboxState, type WorldStructure } from '@auto_matrix/shared';
import type { WorldState } from '../world/WorldState.js';

const buildings: WorldStructure[][] = CITY_TRAFFIC_ROUTES.map(route => CITY_BUILDINGS.filter(building =>
  Math.abs((route.axis ? building.x : building.z) - route.lane) < CITY_CAR.width / 2 + (route.axis ? building.width : building.depth) / 2,
).map((building, index) => ({ id: `building:${index}`, kind: 'barricade', owner: 'matrix', matrix: true, health: 1,
  position: { x: building.x, y: 1, z: building.z }, film: { scene: 'city', width: building.width, depth: building.depth, height: building.height } })));

export class CityTrafficSystem {
  constructor(private world: WorldState, private sandbox: () => SandboxState) {}
  private obstacles(): WorldStructure[] {
    return [...this.sandbox().structures.filter(item => !item.id.startsWith('traffic:') && item.kind === 'barricade' && item.matrix && item.health > 0),
      ...[...this.world.agents.values()].filter(actor => actor.status === 'alive' && actor.isInMatrix && Math.abs(actor.position.y - 1) < 3).map(actor => ({
        id: `body:${actor.id}`, kind: 'barricade' as const, owner: actor.id, matrix: true, health: 1, position: actor.position,
        film: { scene: 'city', width: 2.2, depth: 2.2, height: 4 },
      }))];
  }
  private clear(index: number, distance: number, obstacles: WorldStructure[], previous?: number): boolean {
    const pose = cityTrafficPose(index, { distance, speed: 0 });
    const before = previous === undefined ? undefined : cityTrafficPose(index, { distance: previous, speed: 0 });
    if ([...obstacles, ...buildings[index]].some(other => {
      if (other.health <= 0) return false;
      const width = pose.width / 2 + (other.film?.width ?? 8) / 2, depth = pose.depth / 2 + (other.film?.depth ?? 2.4) / 2;
      if (Math.abs(pose.position.x - other.position.x) >= width + .3 || Math.abs(pose.position.z - other.position.z) >= depth + .3) return false;
      if (before && (Math.abs(before.position.x - other.position.x) >= width || Math.abs(before.position.z - other.position.z) >= depth)
        && (Math.abs(pose.position.x - other.position.x) >= width || Math.abs(pose.position.z - other.position.z) >= depth)
        && Math.hypot(pose.position.x - other.position.x, pose.position.z - other.position.z) > Math.hypot(before.position.x - other.position.x, before.position.z - other.position.z)) return false;
      return true;
    })) return false;
    return true;
  }
  restore(): void {
    const state = this.sandbox();
    if (!state.traffic) {
      state.traffic = { elapsed: 0, cars: [] };
      const occupied = this.obstacles();
      for (let i = 0; i < CITY_TRAFFIC_ROUTES.length; i++) {
        let distance = (Math.floor(i / 32) * 780 + Math.floor(i / 4) % 8 * 79 + i % 4 * 31) % CITY_CAR.routeLength;
        let waiting = true;
        for (let attempt = 0; attempt < 155; attempt++) {
          const pose = cityTrafficPose(i, { distance, speed: 0 }), coordinate = CITY_TRAFFIC_ROUTES[i].axis ? pose.position.z : pose.position.x;
          const junctionDistance = Math.abs(coordinate - Math.round(coordinate / 80) * 80);
          if (junctionDistance >= 20 && this.clear(i, distance, occupied)) { waiting = false; break; }
          distance = (distance + 10) % CITY_CAR.routeLength;
        }
        state.traffic.cars.push({ distance, speed: 0, ...(waiting ? { waiting: true } : {}) });
        occupied.push(cityTrafficStructures(state.traffic)[i]);
      }
    }
    this.publish();
  }
  private publish(): void {
    const state = this.sandbox();
    state.structures = [...state.structures.filter(item => !item.id.startsWith('traffic:')), ...cityTrafficStructures(state.traffic)];
  }
  frame(dt: number): void {
    if (!this.sandbox().traffic) this.restore();
    const state = this.sandbox().traffic!;
    if (dt <= 0) return;
    dt = Math.min(dt, .1); state.elapsed += dt;
    const obstacles = this.obstacles(), cars = cityTrafficStructures(state);
    for (let index = 0; index < state.cars.length; index++) {
      const car = state.cars[index], route = CITY_TRAFFIC_ROUTES[index], pose = cityTrafficPose(index, car);
      if (car.waiting) {
        const coordinate = route.axis ? pose.position.z : pose.position.x;
        const junctionDistance = Math.abs(coordinate - Math.round(coordinate / 80) * 80);
        if (junctionDistance >= 20 && this.clear(index, car.distance, [...obstacles, ...cars.filter((_, i) => i !== index)])) {
          delete car.waiting; cars[index].health = 99999;
        } else car.distance = (car.distance + 1) % CITY_CAR.routeLength;
        continue;
      }
      const coordinate = route.axis ? pose.position.z : pose.position.x;
      let gap = Infinity;
      for (const other of [...obstacles, ...cars.filter((_, i) => i !== index), ...buildings[index]]) {
        if (other.health <= 0) continue;
        const longitudinal = route.direction * ((route.axis ? other.position.z : other.position.x) - coordinate);
        const lateral = Math.abs((route.axis ? other.position.x : other.position.z) - route.lane);
        const along = (route.axis ? other.film?.depth ?? 2.4 : other.film?.width ?? 8) / 2;
        const across = (route.axis ? other.film?.width ?? 8 : other.film?.depth ?? 2.4) / 2;
        if (longitudinal < 0 && (lateral >= CITY_CAR.width / 2 + across || -longitudinal >= CITY_CAR.depth / 2 + along)) continue;
        if (longitudinal > -along && lateral < CITY_CAR.width / 2 + across + .3) gap = Math.min(gap, longitudinal - along - CITY_CAR.depth / 2 - .3);
      }
      if (cityTrafficSignal(route.axis, state.elapsed) !== 'green') for (let junction = 320; junction <= 1840; junction += 80) {
        const ahead = route.direction * (junction - coordinate);
        // Once past the stop line, clear the junction even when the lights change.
        if (ahead >= 13) gap = Math.min(gap, ahead - 13);
      }
      const desired = Math.min(route.speed, Math.sqrt(2 * CITY_CAR.braking * Math.max(0, gap - 1)));
      const speed = car.speed + Math.max(-CITY_CAR.braking * dt, Math.min(CITY_CAR.acceleration * dt, desired - car.speed));
      const travel = Math.min(Math.max(0, gap - .02), (car.speed + speed) / 2 * dt);
      const next = car.distance + travel;
      const candidate = next >= CITY_CAR.routeLength ? 0 : next;
      if (this.clear(index, candidate, [...obstacles, ...cars.filter((_, i) => i !== index)], next >= CITY_CAR.routeLength ? undefined : car.distance)) {
        car.distance = candidate; car.speed = travel > .001 ? speed : 0;
        cars[index].position = cityTrafficPose(index, car).position;
      } else car.speed = 0;
    }
    this.publish();
  }
}
