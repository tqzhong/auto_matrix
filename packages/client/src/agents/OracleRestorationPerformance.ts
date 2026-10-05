import * as THREE from 'three';
import type { CharacterRig } from './CharacterModel.js';
import { newMotion } from './CharacterMotion.js';

const supports = new WeakMap<CharacterRig, { height: number; surfaceVersion: number }>();
const wetBlouse = new THREE.Color('#28312c'), wetTrousers = new THREE.Color('#292621');

/** The cleared host rests face-up; the same rig is released at the park handoff. */
export function poseOracleRestored(rig: CharacterRig, restored = false): boolean {
  if (rig.head.name !== 'oracle-head') return false;
  const apron = rig.root.getObjectByName('oracle-apron-group'); if (!apron) return false;
  apron.visible = !restored;
  const clothing = rig.oracleClothing!;
  clothing.blouse.color.copy(restored ? wetBlouse : clothing.dry[0]);
  clothing.trousers.color.copy(restored ? wetTrousers : clothing.dry[1]);
  rig.head.traverse(child => {
    if (child.name === 'oracle-open-eye') child.visible = !restored;
    if (child.name === 'oracle-closed-eye') child.visible = restored;
  });
  if (!restored) {
    if (supports.has(rig)) {
      rig.detail.rotation.set(0, 0, 0); rig.detail.position.y = 0; rig.head.position.z = 0;
      rig.shoulders.forEach(shoulder => { shoulder.position.z = 0; });
    }
    return false;
  }
  const parkOutfit = rig.root.getObjectByName('oracle-park-outfit'); if (parkOutfit) parkOutfit.visible = false;
  Object.assign(rig.motion, newMotion());
  rig.detail.rotation.set(-Math.PI / 2, 0, 0); rig.detail.position.y = 0;
  rig.torso.position.set(0, 1.86, 0); rig.torso.rotation.set(0, 0, 0);
  rig.head.position.z = -.075; rig.head.rotation.set(0, -.06, 0);
  for (let i = 0; i < 2; i++) {
    rig.hips[i].position.y = 1.86; rig.hips[i].rotation.set(0, 0, (i ? 1 : -1) * .018);
    rig.knees[i].rotation.set(.025, 0, 0); rig.ankles[i].rotation.set(0, 0, (i ? 1 : -1) * .06);
    rig.shoulders[i].position.z = -.09;
    rig.shoulders[i].rotation.set(0, 0, (i ? 1 : -1) * .14);
    rig.elbows[i].rotation.set(-.045, 0, 0);
    rig.fingers[i].forEach(finger => { finger.rotation.x = -.09; });
  }
  let support = supports.get(rig);
  const surfaceVersion = Number(rig.head.userData.surfaceVersion ?? 0);
  if (support === undefined || support.surfaceVersion !== surfaceVersion) {
    rig.root.updateWorldMatrix(true, true);
    const inverse = rig.root.matrixWorld.clone().invert(), point = new THREE.Vector3(); let lowest = Infinity;
    rig.detail.traverseVisible(object => {
      if (!(object instanceof THREE.Mesh)) return;
      object.updateMatrixWorld(true); if (object instanceof THREE.SkinnedMesh) object.skeleton.update();
      const transform = inverse.clone().multiply(object.matrixWorld);
      for (let i = 0; i < object.geometry.attributes.position.count; i++)
        lowest = Math.min(lowest, object.getVertexPosition(i, point).applyMatrix4(transform).y);
    });
    support = { height: -lowest, surfaceVersion }; supports.set(rig, support);
  }
  rig.detail.position.y = support.height;
  rig.root.updateWorldMatrix(true, true);
  return true;
}
