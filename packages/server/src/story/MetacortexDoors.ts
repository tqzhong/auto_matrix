import { METACORTEX, metacortexPosition, metacortexLiftPose, type SandboxState, type MetacortexLift } from '@auto_matrix/shared';

/** Daily commuting and the escorted ride use the same physical landing doors. */
export function updateMetacortexDoors(state: SandboxState, lift?: MetacortexLift): void {
  const pose = metacortexLiftPose(lift);
  for (const floor of [0, 1] as const) {
    const id = `city:metacortex:door:${floor}`;
    const open = Math.abs(pose.height - floor * METACORTEX.upper) < .01 && pose.door > .97;
    if (open) state.structures = state.structures.filter(s => s.id !== id);
    else if (!state.structures.some(s => s.id === id)) state.structures.push({ id, owner: 'world', kind: 'barricade', position: metacortexPosition(0, METACORTEX.doorZ, floor), matrix: true, health: 99999,
      film: { scene: 'm1_commute', width: 6.4, depth: .3, height: 7 } });
  }
}
