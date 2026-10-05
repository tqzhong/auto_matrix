import * as THREE from 'three';
import { DOCK_RELOAD, dockReloadBox, dockReloadHeight, type DockReloadGesture } from '@auto_matrix/shared';
import type { CharacterRig } from './CharacterModel.js';
import { reach } from './SpoonPerformance.js';

// Work in the visible rig's space. The root already follows the saved ascent;
// hand/sole contacts stay on the loader, rather than on an independent animation.
export function poseDockReload(rig: CharacterRig, gesture?: DockReloadGesture): void {
  if (!gesture || rig.hero || gesture.phase === 'approach' || gesture.phase === 'done') return;
  const climb = gesture.climb, h = dockReloadHeight(climb);
  const kick = gesture.phase === 'kicking', t = gesture.elapsed;
  const push = kick ? THREE.MathUtils.smoothstep(t, .18, DOCK_RELOAD.contact) * (1 - THREE.MathUtils.smoothstep(t, .7, 1.12)) : 0;
  const raised = kick ? THREE.MathUtils.smoothstep(t, 0, .2) * (1 - THREE.MathUtils.smoothstep(t, .8, 1.15)) : 0;
  const brace = gesture.phase === 'jammed' ? gesture.brace / DOCK_RELOAD.braceSeconds : kick ? 1 : 0;
  const orientation = rig.root.getWorldQuaternion(new THREE.Quaternion());
  rig.detail.position.set(0, 0, 0); rig.detail.rotation.set(0, 0, 0);
  rig.torso.position.set(0, 1.82 - brace * .12, -.08 * brace); rig.torso.rotation.set(.06 + brace * .09, 0, 0);
  rig.head.rotation.set(-.15 * (1 - raised) + .12 * raised, 0, 0);
  for (let i = 0; i < 2; i++) {
    const side = i ? 1 : -1;
    rig.hips[i].position.set(side * .225, rig.torso.position.y, 0);
    rig.hips[i].rotation.set(0, 0, 0); rig.knees[i].rotation.set(0, 0, 0); rig.ankles[i].rotation.set(0, 0, 0);
    rig.shoulders[i].rotation.set(0, 0, 0); rig.elbows[i].rotation.set(0, 0, 0);
    const first = THREE.MathUtils.smoothstep(climb, i ? .25 : 0, i ? .5 : .25);
    const second = THREE.MathUtils.smoothstep(climb, i ? .75 : .5, i ? 1 : .75);
    const foot = new THREE.Vector3(side * .24, .155 + (first + second) * .9 - h
      + (Math.sin(first * Math.PI) + Math.sin(second * Math.PI)) * .14, .55 * first);
    const footRotation = orientation.clone();
    if (i === 0 && raised) {
      const box = dockReloadBox(gesture);
      const contact = new THREE.Vector3(-.12, DOCK_RELOAD.box.y - h, DOCK_RELOAD.entry.z - box.z - DOCK_RELOAD.box.depth / 2);
      const q = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), -Math.PI / 2);
      const ankle = contact.sub(new THREE.Vector3(0, -.155, .13).applyQuaternion(q));
      ankle.z -= (1 - push) * .55;
      foot.lerp(ankle, raised); footRotation.multiply(new THREE.Quaternion().slerp(q, raised));
    }
    rig.root.updateWorldMatrix(true, true);
    reach(rig.hips[i], rig.knees[i], rig.ankles[i].position, rig.root.localToWorld(foot), new THREE.Vector3(side * .15, .1, 1).applyQuaternion(orientation));
    rig.ankles[i].quaternion.copy(rig.knees[i].getWorldQuaternion(new THREE.Quaternion()).invert().multiply(footRotation));
    const hand = new THREE.Vector3(side * .53, 3.25 + first * .9 + second - h, .6);
    if (gesture.phase === 'hoisting' && i === 0) hand.set(-.92, 2.42 + Math.sin(gesture.lift * Math.PI * 4) * .09, .6);
    rig.root.updateWorldMatrix(true, true);
    reach(rig.shoulders[i], rig.elbows[i], new THREE.Vector3(0, -.79, .055), rig.root.localToWorld(hand),
      new THREE.Vector3(side * .7, -.2, -.35).applyQuaternion(orientation));
    rig.fingers[i].forEach(finger => { finger.rotation.x = -.9; });
  }
}
