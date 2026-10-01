import * as THREE from 'three';
import type { CharacterRig } from './CharacterModel.js';

const floorSamples = new WeakMap<CharacterRig, { mesh: THREE.Mesh; indices: number[] }[]>();
const directions = [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1],
  [0, 1, 1], [0, 1, -1], [0, -1, 1], [0, -1, -1], [1, -1, 1], [-1, -1, 1], [1, -1, -1], [-1, -1, -1]];
function supports(rig: CharacterRig) {
  let samples = floorSamples.get(rig); if (samples) return samples;
  samples = rig.hero!.wardrobe.map(({ mesh }) => {
    const position = mesh.geometry.attributes.position, skinIndex = mesh.geometry.attributes.skinIndex, skinWeight = mesh.geometry.attributes.skinWeight;
    const groups = new Map<number, { scores: number[]; indices: number[] }>();
    for (let i = 0; i < position.count; i++) {
      let joint = 0;
      if (skinIndex && skinWeight) { let weight = -1; for (let j = 0; j < 4; j++) if (skinWeight.getComponent(i, j) > weight) { weight = skinWeight.getComponent(i, j); joint = skinIndex.getComponent(i, j); } }
      let group = groups.get(joint);
      if (!group) { group = { scores: directions.map(() => Infinity), indices: [] }; groups.set(joint, group); }
      for (const [index, direction] of directions.entries()) {
        const score = position.getX(i) * direction[0] + position.getY(i) * direction[1] + position.getZ(i) * direction[2];
        if (score < group.scores[index]) { group.scores[index] = score; group.indices[index] = i; }
      }
    }
    return { mesh, indices: [...new Set([...groups.values()].flatMap(group => group.indices))] };
  });
  floorSamples.set(rig, samples); return samples;
}

/** Cached extrema of the delivered wardrobe keep lowered poses on their actual floor. */
export function groundCharacter(rig: CharacterRig, settle = 0): void {
  if (!rig.hero) return;
  let lowest = Infinity; const vertex = new THREE.Vector3(), floor = rig.root.getWorldPosition(new THREE.Vector3()).y;
  rig.root.updateWorldMatrix(true, true); rig.root.updateMatrixWorld(true);
  for (const { mesh, indices } of supports(rig)) if (mesh.visible) for (const i of indices) {
    mesh.getVertexPosition(i, vertex); mesh.localToWorld(vertex); lowest = Math.min(lowest, vertex.y);
  }
  if (lowest < floor + .07 || settle > 0) {
    const correction = floor + .07 - lowest;
    rig.hero.bones.get('pelvis')!.position.y += correction * (correction < 0 ? settle : 1);
    rig.root.updateWorldMatrix(true, true);
  }
}
