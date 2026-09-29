import * as THREE from 'three';
import type { HeroRig } from './HeroModel.js';

const contacts = new WeakMap<HeroRig, { mesh: THREE.SkinnedMesh; vertices: number[] }[]>();

/** Bare toes and bent knees meet the closed receiving deck, not a shoe-height proxy. */
export function placePodBody(rig: HeroRig, weight: number): void {
  if (weight <= 0) return;
  let parts = contacts.get(rig);
  if (!parts) {
    parts = [];
    for (const { mesh } of rig.wardrobe) {
      if (!(mesh instanceof THREE.SkinnedMesh) || !mesh.userData.patientBody) continue;
      const { position, skinIndex, skinWeight } = mesh.geometry.attributes;
      const vertices: number[] = [];
      for (let i = 0; i < position.count; i++) {
        if ([0, 1, 2, 3].some(j => skinWeight.getComponent(i, j) > .2
          && /^(hip_|knee_|ankle_|toe)/.test(mesh.skeleton.bones[skinIndex.getComponent(i, j)]?.name ?? ''))) vertices.push(i);
      }
      parts.push({ mesh, vertices });
    }
    contacts.set(rig, parts);
  }
  const point = new THREE.Vector3(); let lowest = Infinity;
  rig.root.updateWorldMatrix(true, true);
  for (const { mesh, vertices } of parts) {
    // SkinnedMesh refreshes its attached bind inverse in updateMatrixWorld.
    // Using the previous root transform here would add the winch travel twice.
    mesh.updateMatrixWorld(true); mesh.skeleton.update();
    const toRig = new THREE.Matrix4().copy(rig.root.matrixWorld).invert().multiply(mesh.matrixWorld);
    for (const index of vertices) {
      mesh.getVertexPosition(index, point).applyMatrix4(toRig);
      lowest = Math.min(lowest, point.y);
    }
  }
  if (Number.isFinite(lowest)) rig.bones.get('pelvis')!.position.y -= lowest * weight;
}
