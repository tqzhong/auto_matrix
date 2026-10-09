import * as THREE from 'three';
import { dockGatePose, dockGateAttacker, FILM_SETS, type DockGate } from '@auto_matrix/shared';
import type { CharacterRig } from './CharacterModel.js';
import { reach } from './SpoonPerformance.js';

/** The pilot and his hand contacts use the same saved transform as the damaged APU. */
export function poseDockGate(rig: CharacterRig, gate?: DockGate, cover?: DockGate, gunnery?: { yaw: number; pitch: number }, driving = false): void {
  if (gunnery || driving) gate = { x: 0, z: 12, phase: 'ready', elapsed: 0 } as DockGate;
  if (rig.gateBolt) rig.gateBolt.visible = false;
  if (rig.hero) return;
  if (!gate && !cover) {
    if (rig.detail.userData.dockGate) {
      delete rig.detail.userData.dockGate; rig.detail.rotation.set(0, 0, 0);
      rig.weapons?.forEach(gun => { gun.rotation.set(0, 0, 0); gun.position.set(0, -.77, .03); });
    }
    return;
  }
  rig.detail.userData.dockGate = true;
  rig.detail.position.set(0, 0, 0); rig.detail.rotation.set(0, 0, 0);
  rig.torso.position.set(0, gate ? 1.38 : 1.98, 0); rig.torso.rotation.set(0, 0, 0); rig.head.rotation.set(0, 0, 0);
  for (let i = 0; i < 2; i++) {
    const side = i ? 1 : -1;
    rig.hips[i].position.set(side * .225, rig.torso.position.y, 0);
    rig.hips[i].rotation.set(gate ? -1.36 : 0, 0, 0);
    rig.knees[i].rotation.set(gate ? 1.46 : 0, 0, 0);
    rig.ankles[i].rotation.set(gate ? -.1 : 0, 0, 0);
    rig.shoulders[i].rotation.set(-.8, 0, side * .1); rig.elbows[i].rotation.set(-.5, 0, 0);
    rig.fingers[i].forEach(finger => { finger.rotation.x = -.75; });
  }
  if (gate) {
    const pose = dockGatePose(gate);
    // The pilot faces -Z; conjugate the APU rotation by his half turn.
    rig.detail.rotation.set(-pose.pitch, 0, -pose.roll);
    if (gunnery) rig.head.rotation.set(gunnery.pitch * .4, Math.atan2(Math.sin(Math.PI - gunnery.yaw), Math.cos(Math.PI - gunnery.yaw)) * .55, 0);
    rig.root.updateWorldMatrix(true, true);
    const rotation = rig.detail.getWorldQuaternion(new THREE.Quaternion());
    for (let i = 0; i < 2; i++) {
      const side = i ? 1 : -1;
      reach(rig.shoulders[i], rig.elbows[i], new THREE.Vector3(0, -.79, .055),
        rig.detail.localToWorld(new THREE.Vector3(side * .62, 2.3, 1)), new THREE.Vector3(side * .7, -.5, -.2).applyQuaternion(rotation));
    }
  } else if (cover && rig.weapons?.[0]) {
    const gun = rig.weapons[0], center = FILM_SETS.film_zion_hangar.center, attacker = dockGateAttacker(cover);
    const target = new THREE.Vector3(center.x + attacker.x, center.y - 1 + attacker.y, center.z + attacker.z);
    rig.root.updateWorldMatrix(true, true);
    const rotation = rig.root.getWorldQuaternion(new THREE.Quaternion());
    reach(rig.shoulders[0], rig.elbows[0], new THREE.Vector3(0, -.79, .055),
      rig.root.localToWorld(new THREE.Vector3(-.26, 3.2, .64)), new THREE.Vector3(-.7, -.4, .1).applyQuaternion(rotation));
    const hand = rig.elbows[0].localToWorld(new THREE.Vector3(0, -.79, .055));
    gun.quaternion.copy(rig.elbows[0].getWorldQuaternion(new THREE.Quaternion()).invert()
      .multiply(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, -1, 0), target.clone().sub(hand).normalize())));
    gun.position.copy(new THREE.Vector3(0, -.79, .055).sub(new THREE.Vector3(0, -.09, .13).applyQuaternion(gun.quaternion)));
    gun.updateWorldMatrix(true, true);
    reach(rig.shoulders[1], rig.elbows[1], new THREE.Vector3(0, -.79, .055),
      gun.localToWorld(new THREE.Vector3(0, -.65, .10)), new THREE.Vector3(.8, -.5, .1).applyQuaternion(rotation));
    const firing = cover.phase === 'rescue' && [.75, 1.55].some(at => cover.elapsed >= at && cover.elapsed < at + .12);
    if (rig.gateBolt && firing) {
      const start = rig.root.worldToLocal(gun.localToWorld(new THREE.Vector3(0, -1.315, 0)));
      const end = rig.root.worldToLocal(target), delta = end.clone().sub(start);
      rig.gateBolt.visible = true; rig.gateBolt.position.copy(start).add(end).multiplyScalar(.5);
      rig.gateBolt.scale.y = delta.length(); rig.gateBolt.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), delta.normalize());
    }
  }
  rig.root.updateWorldMatrix(true, true);
}
