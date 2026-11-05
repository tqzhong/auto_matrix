import { combatDisplace, distance, type SandboxThreat, type Vector3, type WorldStructure } from '@auto_matrix/shared';

const spacing = 1.8;
const approachTurns = [0, -Math.PI / 4, Math.PI / 4, -Math.PI / 2, Math.PI / 2];

export function burlyCopyOccupied(position: Vector3, threats: SandboxThreat[], copy?: SandboxThreat): boolean {
  return threats.some(other => other.scene === 'm2_burly' && other !== copy && distance(position, other.position) < spacing);
}

export function displaceBurlyCopy(copy: SandboxThreat, direction: Vector3, amount: number, threats: SandboxThreat[], structures: WorldStructure[]): Vector3 {
  return combatDisplace(copy.position, direction, amount, copy.matrix, structures,
    point => burlyCopyOccupied(point, threats, copy));
}

export function approachBurlyCopy(copy: SandboxThreat, target: Vector3, stride: number, threats: SandboxThreat[], structures: WorldStructure[]): Vector3 {
  const angle = Math.atan2(target.x - copy.position.x, target.z - copy.position.z);
  let best = copy.position, closest = Infinity;
  for (const turn of approachTurns) {
    const heading = angle + turn;
    const next = displaceBurlyCopy(copy, { x: Math.sin(heading), y: 0, z: Math.cos(heading) }, stride, threats, structures);
    const traveled = distance(next, copy.position);
    if (turn === 0 && traveled >= stride - .0001) return next;
    const gap = distance(next, target);
    if (traveled > .001 && gap < closest) { best = next; closest = gap; }
  }
  return best;
}

export function restoreBurlyCopyPositions(threats: SandboxThreat[], structures: WorldStructure[], neo: Vector3): void {
  const copies = threats.filter(copy => copy.scene === 'm2_burly');
  for (const [index, copy] of copies.entries()) {
    const overlap = copies.slice(0, index).find(other => distance(copy.position, other.position) < spacing);
    if (!overlap) continue;
    const away = Math.atan2(copy.position.x - overlap.position.x, copy.position.z - overlap.position.z);
    // Older saves can put multiple bodies in one spot. Keep the first copy in place.
    for (let ring = 1; ring <= copies.length; ring++) {
      const radius = spacing * ring + .01;
      const found = [0, -1, 1, -2, 2, -3, 3, 4].some(turn => {
        const angle = away + turn * Math.PI / 4;
        const next = combatDisplace(copy.position, { x: Math.sin(angle), y: 0, z: Math.cos(angle) }, radius, copy.matrix, structures);
        if (distance(neo, next) < spacing || burlyCopyOccupied(next, copies, copy)) return false;
        copy.position = next;
        return true;
      });
      if (found) break;
    }
  }
}
