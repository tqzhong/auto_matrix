import * as THREE from 'three';
import type { CharacterRig } from './CharacterModel.js';
import { groundCharacter } from './GroundContact.js';
import { HAMMER_MEDICAL } from '@auto_matrix/shared';

const patients = new WeakSet<CharacterRig>();

/** A coma is already established in the save; reconnecting must not perform another fall. */
export function poseHammerPatient(rig: CharacterRig, role?: 'neo' | 'bane' | 'maggie'): void {
  if (!role) {
    if (patients.delete(rig)) { rig.detail.rotation.set(0, 0, 0); rig.detail.position.set(0, .04, 0); }
    return;
  }
  patients.add(rig);
  rig.root.rotation.set(0, role === 'bane' ? Math.PI : 0, 0);
  rig.root.position.y = HAMMER_MEDICAL.mattressTop - 1 - .07;
  if (rig.hero) {
    rig.detail.rotation.set(0, 0, 0); rig.detail.position.set(0, .04, 0);
    const hero = rig.hero;
    for (const [name, bone] of hero.bones) { bone.rotation.set(0, 0, 0); bone.position.copy(hero.rest.get(name)!); }
    hero.bones.get('pelvis')!.rotation.x = -Math.PI / 2;
    hero.bones.get('head')!.rotation.x = .06;
    for (const side of ['R', 'L']) {
      hero.bones.get(`shoulder_${side}`)!.rotation.z = side === 'R' ? -.06 : .06;
      hero.bones.get(`elbow_${side}`)!.rotation.x = .04;
    }
    groundCharacter(rig, 1);
  } else {
    // The fallback body has separate hip roots, so rotate its whole detail group.
    rig.torso.rotation.set(0, 0, 0); rig.torso.position.set(0, 1.82, 0); rig.head.rotation.set(0, 0, 0);
    rig.hips.forEach(hip => { hip.position.y = 1.82; hip.rotation.set(0, 0, 0); });
    rig.knees.forEach(knee => knee.rotation.set(0, 0, 0)); rig.ankles.forEach(ankle => ankle.rotation.set(0, 0, 0));
    rig.shoulders.forEach((shoulder, index) => shoulder.rotation.set(0, 0, index ? .08 : -.08));
    rig.elbows.forEach(elbow => elbow.rotation.set(.04, 0, 0));
    rig.detail.rotation.set(-Math.PI / 2, 0, 0); rig.detail.position.set(0, .04, 2.15);
    rig.root.updateWorldMatrix(true, true);
    rig.root.updateMatrixWorld(true);
    const floor = rig.root.getWorldPosition(new THREE.Vector3()).y + .07;
    const lowest = new THREE.Box3().setFromObject(rig.detail, true).min.y;
    rig.detail.position.y += floor - lowest;
  }
  rig.root.updateWorldMatrix(true, true);
  rig.root.updateMatrixWorld(true);
}
