import * as THREE from 'three';
import { FILM_SETS, WETWALL_SHAFT, type SixthGesture } from '@auto_matrix/shared';
import type { CharacterRig } from './CharacterModel.js';
import { reach } from './SpoonPerformance.js';

/** Contacts are solved after the hanging pose, so a drawn pistol is not still gripping the pipe. */
export function poseSixthFloor(rig: CharacterRig, gesture?: SixthGesture): void {
  if (!gesture || !rig.hero) return;
  const { role, phase, elapsed } = gesture, bones = rig.hero.bones, bone = (name: string) => bones.get(name)!;
  rig.root.updateWorldMatrix(true, true);
  const root = rig.root.getWorldPosition(new THREE.Vector3()), rotation = rig.root.getWorldQuaternion(new THREE.Quaternion());
  const hand = (side: 'R' | 'L', target: THREE.Vector3, orientation: THREE.Quaternion, grip = .7) => {
    const wrist = bone(`wrist_${side}`), elbow = bone(`elbow_${side}`), shoulder = bone(`shoulder_${side}`), sign = side === 'R' ? 1 : -1;
    const palm = new THREE.Vector3(0, -.19, .035).multiply(wrist.getWorldScale(new THREE.Vector3())).applyQuaternion(orientation);
    reach(shoulder, elbow, wrist.position, target.sub(palm), new THREE.Vector3(sign, -.4, .2).applyQuaternion(rotation));
    wrist.quaternion.copy(elbow.getWorldQuaternion(new THREE.Quaternion()).invert().multiply(orientation));
    for (let finger = 1; finger <= 5; finger++) for (let segment = 1; segment <= 3; segment++)
      bone(`finger${finger}-${segment}_${side}`).rotation.z = sign * (finger === 1 ? .25 : segment === 1 ? .65 : .8) * grip;
    wrist.updateWorldMatrix(false, true);
  };
  const forwardHand = rotation.clone().multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), -Math.PI / 2));
  if (role === 'neo' && phase === 'firing') {
    const direction = new THREE.Vector3(Math.sin(gesture.aim), 0, Math.cos(gesture.aim));
    hand('R', root.clone().add(new THREE.Vector3(.28, 3.2, 0).applyQuaternion(rotation)).addScaledVector(direction, .85), forwardHand);
    const center = FILM_SETS.film_ambush_house.center;
    hand('L', new THREE.Vector3(center.x + gesture.start.x - .26, root.y + 3.3, center.z + WETWALL_SHAFT.pipeZ + .27),
      new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), Math.PI / 2));
  } else if (role === 'smith' && phase === 'grapple' && gesture.contact) {
    const contact = new THREE.Vector3(gesture.contact.x, gesture.contact.y, gesture.contact.z);
    for (const side of ['R', 'L'] as const) hand(side, contact.clone().add(new THREE.Vector3(side === 'R' ? -.16 : .16, 0, .12)), forwardHand, .35);
  } else if (role === 'citizen_4' || role === 'citizen_14') {
    if (phase === 'replacing' && role === 'citizen_4') {
      bone('chest').rotation.z = Math.sin(elapsed * 28) * .12; bone('head').rotation.x = -.28 + Math.sin(elapsed * 21) * .08;
      bone('shoulder_R').rotation.x = -.12; bone('shoulder_L').rotation.x = .15; return;
    }
    hand('R', rig.root.localToWorld(new THREE.Vector3(.25, 3.05, .68)), forwardHand);
    hand('L', rig.root.localToWorld(new THREE.Vector3(.14, 3.05, 1.2)), forwardHand);
  }
}
