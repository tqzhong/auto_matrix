import type * as THREE from 'three';

const parts = ['cypher-anatomical-head', 'cypher-teeth-lower', 'cypher-tongue'];

/** Set before hand/prop contact is solved, including on a restored paused frame. */
export function setCypherMouth(root: THREE.Object3D, opening: number): void {
  for (const name of parts) {
    const mesh = root.getObjectByName(name) as THREE.Mesh | undefined;
    const index = mesh?.morphTargetDictionary?.jawOpen;
    if (index !== undefined && mesh?.morphTargetInfluences) mesh.morphTargetInfluences[index] = opening;
  }
}
