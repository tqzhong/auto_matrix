import * as THREE from 'three';
import { FILM_SETS, MOBIL_LUGGAGE, mobilLuggagePose } from '@auto_matrix/shared';
import type { CharacterRig } from './CharacterModel.js';
import type { MotionInput } from './CharacterMotion.js';
import { crosscutPalm } from './CrosscutPerformance.js';
import { reach } from './SpoonPerformance.js';
import { solveLeg } from './CharacterMotion.js';

/** One saved grasp drives the hand, the visible suitcase and its later fall. */
export function poseMobilLuggage(rig: CharacterRig, gesture?: MotionInput['mobilLuggage']): void {
  if (!gesture) return;
  const { luggage, role } = gesture, parent = role === 'rama_kandra';
  const time = luggage.elapsed - (parent ? luggage.walk ?? MOBIL_LUGGAGE.walk : 0);
  if (parent && luggage.phase === 'retrieving' && time < 0) return;
  const lifting = luggage.phase === 'lifting' || luggage.phase === 'retrieving';
  const bend = lifting ? THREE.MathUtils.smoothstep(time, 0, .35) * (1 - THREE.MathUtils.smoothstep(time, MOBIL_LUGGAGE.grasp, MOBIL_LUGGAGE.lift)) : 0;
  if (rig.hero && lifting) {
    const hero = rig.hero, b = hero.bones;
    b.get('pelvis')!.position.y = hero.rest.get('pelvis')!.y - 1.0 * bend;
    b.get('spine')!.rotation.x = .38 * bend; b.get('head')!.rotation.x = .12 * bend;
    rig.root.updateWorldMatrix(true, true);
    const rotation = rig.root.getWorldQuaternion(new THREE.Quaternion());
    for (const side of ['R', 'L'] as const) {
      const hip = b.get(`hip_${side}`)!, knee = b.get(`knee_${side}`)!, ankle = b.get(`ankle_${side}`)!;
      const foot = hero.root.localToWorld(new THREE.Vector3(side === 'R' ? .27 : -.27, hero.footHeight + .18, .08));
      reach(hip, knee, ankle.position, foot, new THREE.Vector3(side === 'R' ? .4 : -.4, -.2, 1).applyQuaternion(rotation));
      ankle.quaternion.copy(knee.getWorldQuaternion(new THREE.Quaternion()).invert().multiply(rotation));
    }
  } else if (parent && lifting) {
    const hipHeight = 1.98 - .85 * bend, leg = solveLeg(.08, hipHeight - .16);
    rig.torso.position.y = hipHeight; rig.torso.rotation.x = .25 * bend; rig.head.rotation.x = .12 * bend;
    for (const side of [0, 1]) {
      rig.hips[side].position.y = hipHeight; rig.hips[side].rotation.set(leg.hip, 0, 0);
      rig.knees[side].rotation.set(leg.knee, 0, 0); rig.ankles[side].rotation.set(leg.ankle, 0, 0);
    }
  }
  rig.root.updateWorldMatrix(true, true);
  const center = FILM_SETS.film_mobil_station.center, root = rig.root.getWorldPosition(new THREE.Vector3());
  const rotation = rig.root.getWorldQuaternion(new THREE.Quaternion()), forward = new THREE.Vector3(0, 0, 1).applyQuaternion(rotation);
  const pose = mobilLuggagePose(luggage, { x: root.x - center.x, y: root.y - center.y + 1, z: root.z - center.z, yaw: Math.atan2(forward.x, forward.z) });
  const target = new THREE.Vector3(center.x + pose.grip.x, center.y - 1 + pose.grip.y, center.z + pose.grip.z);
  const weight = lifting ? THREE.MathUtils.smoothstep(time, 0, MOBIL_LUGGAGE.grasp) : 1;
  if (rig.hero) {
    const wrist = rig.hero.bones.get('wrist_R')!, rest = wrist.localToWorld(new THREE.Vector3(0, -.19, .035));
    crosscutPalm(rig, 'R', rest.lerp(target, weight));
    // Coat tails fold onto the platform during the crouch, as in the source-door performance.
    rig.root.updateWorldMatrix(true, true);
    if (lifting) for (const panel of rig.hero.panels) {
      const points = panel.mesh.geometry.attributes.position, vertex = new THREE.Vector3(); let changed = false;
      for (let i = 0; i < points.count; i++) {
        vertex.fromBufferAttribute(points, i); panel.mesh.localToWorld(vertex);
        if (vertex.y >= root.y + .05) continue;
        vertex.y = root.y + .05; panel.mesh.worldToLocal(vertex); points.setXYZ(i, vertex.x, vertex.y, vertex.z); changed = true;
      }
      if (changed) { points.needsUpdate = true; panel.mesh.geometry.computeVertexNormals(); panel.mesh.geometry.computeBoundingSphere(); }
    }
  } else if (parent) {
    const wrist = rig.mobilWrists![0], palm = new THREE.Vector3(0, -.14, -.05);
    const orientation = rotation.clone()
      .multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), pose.yaw - Math.atan2(forward.x, forward.z)))
      .multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), -Math.PI / 2));
    const contact = wrist.localToWorld(palm.clone()).lerp(target, weight);
    reach(rig.shoulders[0], rig.elbows[0], wrist.position, contact.sub(palm.applyQuaternion(orientation)), new THREE.Vector3(-.7, -.3, .5).applyQuaternion(rotation));
    wrist.quaternion.copy(rig.elbows[0].getWorldQuaternion(new THREE.Quaternion()).invert().multiply(orientation));
    rig.fingers[0].forEach(finger => { finger.rotation.x = -.6; });
  }
  rig.root.updateWorldMatrix(true, true);
}
