import { FILM_SETS, OFFICE_OBSTACLES, OFFICE_MANAGER_WALLS, OFFICE_MANAGER_FURNITURE, METACORTEX_SHAFT, METACORTEX_LOBBY, OFFICE_CUSTODY, metacortexPosition, playerBlocked, rayBox, type Vector3 } from '@auto_matrix/shared';

const center = FILM_SETS.film_metacortex_floor.center;
const distance = (a: Vector3, b: Vector3) => Math.hypot(a.x - b.x, a.z - b.z);
const obstacles = [...OFFICE_OBSTACLES, ...OFFICE_MANAGER_WALLS, ...OFFICE_MANAGER_FURNITURE, ...METACORTEX_SHAFT];

// The same furniture footprints as player collision, expanded for a guard's body.
// Corner links are static; only the observed destination changes during a search.
function clear(from: Vector3, to: Vector3, radius: number): boolean {
  const length = distance(from, to);
  if (length < .001) return true;
  const direction = { x: (to.x - from.x) / length, y: 0, z: (to.z - from.z) / length };
  return !(from.y < 32 ? METACORTEX_LOBBY : obstacles).some(o => {
    const hit = rayBox({ x: from.x - center.x, y: .5, z: from.z - center.z }, direction,
      { x: o.x - o.width / 2 - radius, y: 0, z: o.z - o.depth / 2 - radius },
      { x: o.x + o.width / 2 + radius, y: 1, z: o.z + o.depth / 2 + radius });
    return hit !== undefined && hit <= length;
  });
}
const routes = new Map<string, { corners: Vector3[]; links: { index: number; length: number }[][] }>();
function navigation(radius: number, floor: number) {
  const key = `${floor}:${radius}`;
  if (routes.has(key)) return routes.get(key)!;
  const corners = (floor ? obstacles : METACORTEX_LOBBY).flatMap(o => [-1, 1].flatMap(x => [-1, 1].map(z =>
    metacortexPosition(o.x + x * (o.width / 2 + radius + .04), o.z + z * (o.depth / 2 + radius + .04), floor),
  ))).filter(point => !playerBlocked(point, true, radius + .01));
  const links = corners.map((from, i) => corners.flatMap((to, j) => i !== j && clear(from, to, radius) ? [{ index: j, length: distance(from, to) }] : []));
  const route = { corners, links }; routes.set(key, route); return route;
}

/** Next unobstructed corner on the shortest route to a position the guard knows. */
export function officeNextPoint(from: Vector3, to: Vector3, radius = .71, bodies: Vector3[] = []): Vector3 | undefined {
  bodies = bodies.filter(body => Math.abs(body.y - from.y) < 3);
  const clearBodies = (a: Vector3, b: Vector3) => !bodies.some(body => {
    const dx = b.x - a.x, dz = b.z - a.z, length = dx * dx + dz * dz;
    const t = length ? Math.max(0, Math.min(1, ((body.x - a.x) * dx + (body.z - a.z) * dz) / length)) : 0;
    return Math.hypot(a.x + dx * t - body.x, a.z + dz * t - body.z) < OFFICE_CUSTODY.spacing;
  });
  const traversable = (a: Vector3, b: Vector3) => clear(a, b, radius) && clearBodies(a, b);
  if (!clearBodies(to, to)) return;
  if (traversable(from, to)) return to;
  const fixed = navigation(radius, from.y < 32 ? 0 : 1);
  const around = bodies.flatMap(body => Array.from({ length: 8 }, (_, i) => ({ ...body,
    x: body.x + Math.sin(i * Math.PI / 4) * (OFFICE_CUSTODY.spacing / Math.cos(Math.PI / 8) + .03),
    z: body.z + Math.cos(i * Math.PI / 4) * (OFFICE_CUSTODY.spacing / Math.cos(Math.PI / 8) + .03) })))
    .filter(point => !playerBlocked(point, true, radius + .01) && clearBodies(point, point));
  const corners = [...fixed.corners, ...around];
  const links = corners.map((from, i) => i < fixed.corners.length
    ? [...fixed.links[i].filter(link => clearBodies(from, corners[link.index])), ...around.flatMap((to, j) => traversable(from, to) ? [{ index: fixed.corners.length + j, length: distance(from, to) }] : [])]
    : corners.flatMap((to, j) => i !== j && traversable(from, to) ? [{ index: j, length: distance(from, to) }] : []));
  const start = corners.length; const end = start + 1; const points = [...corners, from, to];
  const costs = points.map(() => Infinity); costs[start] = 0;
  const previous = points.map(() => -1); const visited = new Set<number>();
  const toEnd = corners.map(point => traversable(point, to));
  const fromStart = corners.flatMap((point, index) => traversable(from, point) ? [{ index, length: distance(from, point) }] : []);
  while (visited.size < points.length) {
    let current = -1; let best = Infinity;
    for (let i = 0; i < points.length; i++) {
      const estimate = costs[i] + distance(points[i], to);
      if (!visited.has(i) && estimate < best) { current = i; best = estimate; }
    }
    if (current < 0) return;
    if (current === end) {
      const route: Vector3[] = [];
      for (let at = end; at !== start; at = previous[at]) route.unshift(points[at]);
      return route.find(point => distance(from, point) > .03) ?? to;
    }
    visited.add(current);
    const neighbors = current === start ? fromStart : toEnd[current] ? [...links[current], { index: end, length: distance(points[current], to) }] : links[current];
    for (const next of neighbors) {
      const cost = costs[current] + next.length;
      if (!visited.has(next.index) && cost < costs[next.index]) { costs[next.index] = cost; previous[next.index] = current; }
    }
  }
}
