import * as THREE from 'three';
import { dockLastStandPose, type DockLastStandGesture } from '@auto_matrix/shared';
import type { CharacterRig } from './CharacterModel.js';
import { reach } from './SpoonPerformance.js';

const support = new WeakMap<CharacterRig, { key: string; height: number }>();

/** A saved pose owns the complete body, so neither idle motion nor dead-body tilt can drift it. */
export function poseDockLastStand(rig: CharacterRig, gesture?: DockLastStandGesture): void {
  if (!gesture || rig.hero) {
    if (rig.detail.userData.lastStand) {
      delete rig.detail.userData.lastStand; rig.detail.position.set(0, 0, 0); rig.detail.rotation.set(0, 0, 0);
      rig.hips.forEach((hip, i) => hip.position.set((i ? 1 : -1) * .225, rig.torso.position.y, 0));
    }
    return;
  }
  rig.detail.userData.lastStand = true;
  const pose = dockLastStandPose(gesture), captain = gesture.role === 'mifune';
  if (captain) rig.head.traverse(child => {
    if (child.name === 'mifune-open-eye') child.visible = pose.dead < .75;
    if (child.name === 'mifune-closed-eye') child.visible = pose.dead >= .75;
  });
  const fall = captain ? pose.fallen : 0, kneel = captain ? 0 : pose.kneel;
  const recoil = captain && gesture.phase === 'attack' && gesture.elapsed < 2.4 ? Math.sin(gesture.elapsed * 18) * .06 : 0;
  const breath = captain && fall === 1 ? (1 - pose.dead) * Math.sin(gesture.total * 2.4) * .012 : 0;
  rig.detail.position.set(0, 0, 0); rig.detail.rotation.set(-Math.PI / 2 * fall, 0, 0);
  rig.torso.position.set(0, captain ? 1.38 + .48 * fall : 1.98 - .88 * kneel, 0);
  rig.torso.rotation.set(captain ? recoil : .48 * kneel, 0, 0);
  rig.head.rotation.set(captain ? -.11 + .11 * pose.dead + breath : -.14 * kneel, captain ? -.15 * fall * (1 - pose.dead) : 0, 0);
  for (let i = 0; i < 2; i++) {
    const side = i ? 1 : -1;
    rig.hips[i].position.set(side * .225, rig.torso.position.y, 0);
    rig.hips[i].rotation.set(captain ? -1.36 * (1 - fall) : 0, 0, captain ? side * .04 * fall : 0);
    rig.knees[i].rotation.set(captain ? 1.46 * (1 - fall) : 0, 0, 0);
    rig.ankles[i].rotation.set(captain ? -.1 * (1 - fall) : 0, 0, captain ? side * .08 * fall : 0);
    rig.shoulders[i].rotation.set(captain ? -.9 * (1 - fall) : -.15, 0, side * (captain ? .12 + .15 * fall : .15));
    rig.elbows[i].rotation.set(captain ? -.65 * (1 - fall) - .13 * fall : -.12, 0, 0);
    rig.fingers[i].forEach(finger => { finger.rotation.x = captain ? -.12 - .6 * (1 - fall) : -.12; });
  }
  if (captain && !fall) {
    rig.root.updateWorldMatrix(true, true);
    const rotation = rig.detail.getWorldQuaternion(new THREE.Quaternion());
    for (let i = 0; i < 2; i++) {
      const side = i ? 1 : -1;
      reach(rig.shoulders[i], rig.elbows[i], new THREE.Vector3(0, -.79, .055),
        rig.detail.localToWorld(new THREE.Vector3(side * .62, 2.3, 1)), new THREE.Vector3(side * .7, -.5, -.2).applyQuaternion(rotation));
    }
  }
  if (captain && fall) {
    // Find contact against actual visible vertices, and reuse it for paused frames.
    const key = `${fall.toFixed(5)}:${pose.dead.toFixed(5)}`;
    let cached = support.get(rig);
    if (cached?.key !== key) {
      rig.root.updateWorldMatrix(true, true);
      const inverse = rig.root.matrixWorld.clone().invert(), vertex = new THREE.Vector3(); let min = Infinity;
      rig.detail.traverseVisible(object => {
        if (!(object instanceof THREE.Mesh)) return;
        object.updateMatrixWorld(true);
        if (object instanceof THREE.SkinnedMesh) object.skeleton.update();
        const transform = inverse.clone().multiply(object.matrixWorld);
        for (let i = 0; i < object.geometry.attributes.position.count; i++) min = Math.min(min, object.getVertexPosition(i, vertex).applyMatrix4(transform).y);
      });
      cached = { key, height: -min + .012 }; support.set(rig, cached);
    }
    rig.detail.position.y = cached.height * fall;
  }
  if (!captain && kneel) {
    const rotation = rig.root.getWorldQuaternion(new THREE.Quaternion());
    for (let i = 0; i < 2; i++) {
      const side = i ? 1 : -1;
      const foot = new THREE.Vector3(side * .28, .155, (i ? .85 : -.66) * kneel);
      rig.root.updateWorldMatrix(true, true);
      reach(rig.hips[i], rig.knees[i], rig.ankles[i].position, rig.root.localToWorld(foot), new THREE.Vector3(side * .08, .15, 1).applyQuaternion(rotation));
      rig.ankles[i].quaternion.copy(rig.knees[i].getWorldQuaternion(new THREE.Quaternion()).invert().multiply(rotation));
      const hand = new THREE.Vector3(side * .42, 3 - 1.9 * kneel, .2 + .78 * kneel);
      rig.root.updateWorldMatrix(true, true);
      reach(rig.shoulders[i], rig.elbows[i], new THREE.Vector3(0, -.79, .055), rig.root.localToWorld(hand), new THREE.Vector3(side * .55, -.1, -.4).applyQuaternion(rotation));
    }
  }
  rig.root.updateWorldMatrix(true, true);
}
