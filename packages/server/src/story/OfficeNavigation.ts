import { FILM_SETS, OFFICE_OBSTACLES, filmPosition, playerBlocked, rayBox, type Vector3 } from '@auto_matrix/shared';

const center = FILM_SETS.film_metacortex_floor.center;
const distance = (a: Vector3, b: Vector3) => Math.hypot(a.x - b.x, a.z - b.z);

// The same furniture footprints as player collision, expanded for a guard's body.
// Corner links are static; only the observed destination changes during a search.
function clear(from: Vector3, to: Vector3): boolean {
  const length = distance(from, to);
  if (length < .001) return true;
  const direction = { x: (to.x - from.x) / length, y: 0, z: (to.z - from.z) / length };
  return !OFFICE_OBSTACLES.some(o => {
    const hit = rayBox({ x: from.x - center.x, y: .5, z: from.z - center.z }, direction,
      { x: o.x - o.width / 2 - .71, y: 0, z: o.z - o.depth / 2 - .71 },
      { x: o.x + o.width / 2 + .71, y: 1, z: o.z + o.depth / 2 + .71 });
    return hit !== undefined && hit <= length;
  });
}
const corners = OFFICE_OBSTACLES.flatMap(o => [-1, 1].flatMap(x => [-1, 1].map(z =>
  filmPosition('film_metacortex_floor', o.x + x * (o.width / 2 + .75), o.z + z * (o.depth / 2 + .75)),
))).filter(point => !playerBlocked(point, true, .72));
const links = corners.map((from, i) => corners.flatMap((to, j) => i !== j && clear(from, to) ? [{ index: j, length: distance(from, to) }] : []));

/** Next unobstructed corner on the shortest route to a position the guard knows. */
export function officeNextPoint(from: Vector3, to: Vector3): Vector3 | undefined {
  if (clear(from, to)) return to;
  const start = corners.length; const end = start + 1; const points = [...corners, from, to];
  const costs = points.map(() => Infinity); costs[start] = 0;
  const previous = points.map(() => -1); const visited = new Set<number>();
  const toEnd = corners.map(point => clear(point, to));
  const fromStart = corners.flatMap((point, index) => clear(from, point) ? [{ index, length: distance(from, point) }] : []);
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
