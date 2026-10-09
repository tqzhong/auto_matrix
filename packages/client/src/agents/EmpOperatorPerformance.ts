import * as THREE from 'three';
import { FILM_SETS, empCrankPoint, empOperatorPose, empOperatorFoot, type EmpOperator } from '@auto_matrix/shared';
import type { CharacterRig } from './CharacterModel.js';
import { reach } from './SpoonPerformance.js';

/** Chair, crank and actor all follow the saved operator clock, including cold loading. */
export function poseEmpOperator(rig: CharacterRig, state?: EmpOperator): void {
  if (rig.empCharm) rig.empCharm.visible = Boolean(state);
  if (!state || state.phase === 'done') return;
  const pose = empOperatorPose(state), hero = rig.hero;
  const rotation = rig.root.getWorldQuaternion(new THREE.Quaternion());
  const center = FILM_SETS.film_hammer_deck.center;
  const crank = empCrankPoint(state), crankPoint = new THREE.Vector3(center.x + crank.x, center.y - 1 + crank.y, center.z + crank.z);
  rig.detail.position.set(0, 0, 0); rig.detail.rotation.set(0, 0, 0);
  if (hero) {
    const bone = (name: string) => hero.bones.get(name)!;
    const pelvis = bone('pelvis'); pelvis.position.copy(hero.rest.get('pelvis')!);
    const stepping = state.phase === 'seating' ? THREE.MathUtils.smoothstep(state.elapsed, 0, .25)
      : state.phase === 'rising' ? 1 - THREE.MathUtils.smoothstep(state.elapsed, 3, 3.2) : 0;
    pelvis.position.y -= .34 * stepping;
    pelvis.position.y = THREE.MathUtils.lerp(pelvis.position.y, 1.83, pose.seat); pelvis.rotation.set(0, 0, 0);
    bone('spine').rotation.set(pose.lean, 0, 0); bone('chest').rotation.set(0, 0, 0);
    bone('head').rotation.set(.12 * pose.seat, -.13 * pose.engaged, 0);
    rig.root.updateWorldMatrix(true, true);
    for (const [index, side] of ['R', 'L'].entries()) {
      const sign = index ? 1 : -1, hip = bone(`hip_${side}`), knee = bone(`knee_${side}`), ankle = bone(`ankle_${side}`);
      const foot = empOperatorFoot(state, side === 'L');
      const target = new THREE.Vector3(center.x + foot.x, center.y - 1 + hero.footHeight + .025 + foot.lift, center.z + foot.z);
      reach(hip, knee, ankle.position, target, new THREE.Vector3(sign * .1, 0, 1).applyQuaternion(rotation));
      ankle.quaternion.copy(knee.getWorldQuaternion(new THREE.Quaternion()).invert().multiply(rotation));
      const wrist = bone(`wrist_${side}`), lower = bone(`elbow_${side}`), upper = bone(`shoulder_${side}`);
      const rest = rig.root.localToWorld(new THREE.Vector3(sign * .94, 2.29, .03));
      const charm = rig.root.localToWorld(new THREE.Vector3(.32, 2.88, .51));
      const contact = index ? rest.lerp(charm, pose.seat) : rest.lerp(crankPoint, pose.engaged);
      const orientation = rotation.clone();
      // The palm is offset from the wrist; target the grip axis, not the wrist joint.
      const offset = new THREE.Vector3(index ? -.13 : .13, -.18, .02);
      const current = wrist.localToWorld(offset.clone()); current.lerp(contact, pose.seat);
      reach(upper, lower, wrist.position, current.sub(offset.applyQuaternion(orientation)),
        new THREE.Vector3(sign * .8, -.4, -.35).applyQuaternion(rotation));
      wrist.quaternion.copy(lower.getWorldQuaternion(new THREE.Quaternion()).invert().multiply(orientation));
      for (let finger = 1; finger <= 5; finger++) for (let segment = 1; segment <= 3; segment++)
        bone(`finger${finger}-${segment}_${side}`).rotation.set(finger === 1 ? .24 : 0, 0,
          (index ? -1 : 1) * (finger === 1 ? .2 : .75) * pose.seat);
    }
    if (rig.empCharm) {
      const wrist = bone('wrist_L'); if (rig.empCharm.parent !== wrist) wrist.add(rig.empCharm);
      rig.empCharm.position.set(-.13, -.21, .02); rig.empCharm.rotation.set(0, 0, 0);
    }
  } else {
    // Preserve the same station while the detailed GLB is loading.
    rig.torso.position.y = THREE.MathUtils.lerp(1.98, 1.72, pose.seat); rig.torso.rotation.x = pose.lean;
    for (let i = 0; i < 2; i++) {
      rig.hips[i].position.y = rig.torso.position.y; rig.hips[i].rotation.x = -1.35 * pose.seat;
      rig.knees[i].rotation.x = 1.4 * pose.seat; rig.ankles[i].rotation.x = -.05 * pose.seat;
      rig.shoulders[i].rotation.x = -.65 * pose.seat; rig.elbows[i].rotation.x = -.9 * pose.seat;
    }
  }
  rig.root.updateWorldMatrix(true, true);
}
