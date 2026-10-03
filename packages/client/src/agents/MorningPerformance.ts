import * as THREE from 'three';
import { APARTMENT_ROOM, MORNING, morningBedPose, type MorningRoutine } from '@auto_matrix/shared';
import type { HeroRig } from './HeroModel.js';
import { reach } from './SpoonPerformance.js';

/** Mattress support, swinging legs and planted steps share the saved performance clock. */
export function poseMorningBody(rig: HeroRig, morning?: MorningRoutine): void {
  if (!morning || !['lying', 'sleeping', 'alarm', 'stopping', 'rising'].includes(morning.phase)) return;
  const pose = morningBedPose(morning), bone = (name: string) => rig.bones.get(name)!;
  const pelvis = bone('pelvis'), seated = (1 - pose.recline) * (1 - pose.rise);
  pelvis.position.copy(rig.rest.get('pelvis')!);
  pelvis.position.y = THREE.MathUtils.lerp(MORNING.pelvisY, rig.rest.get('pelvis')!.y - .02, pose.rise) + .23 * seated - Math.max(...pose.feet.map(foot => foot.lift)) * .38;
  pelvis.rotation.set(-Math.PI / 2 * pose.recline, 0, 0);
  bone('spine').rotation.set(.18 * seated, 0, 0); bone('chest').rotation.set(.2 * seated, 0, 0);
  bone('head').rotation.set(.08 * pose.recline - .16 * seated, 0, 0);
  for (const [i, side] of ['R', 'L'].entries()) {
    bone(`shoulder_${side}`).rotation.set(.12 * pose.recline - .12 * pose.rise - .37 * seated, 0, (i ? 1 : -1) * (.12 + .1 * pose.recline));
    bone(`elbow_${side}`).rotation.set(-.22 * pose.rise - .97 * seated, 0, 0);
  }
  rig.root.updateWorldMatrix(true, true);
  const rotation = rig.root.getWorldQuaternion(new THREE.Quaternion());
  for (const [i, side] of ['R', 'L'].entries()) {
    const foot = pose.feet[i], upper = bone(`hip_${side}`), lower = bone(`knee_${side}`), ankle = bone(`ankle_${side}`);
    const target = new THREE.Vector3(APARTMENT_ROOM.center.x + foot.x, foot.y, APARTMENT_ROOM.center.z + foot.z);
    reach(upper, lower, ankle.position, target, new THREE.Vector3(i ? .12 : -.12, .75, 1).applyQuaternion(rotation));
    const orientation = new THREE.Quaternion().setFromEuler(new THREE.Euler(-Math.PI / 2 * foot.recline, foot.yaw, 0, 'YXZ'));
    ankle.quaternion.copy(lower.getWorldQuaternion(new THREE.Quaternion()).invert().multiply(orientation)); ankle.updateWorldMatrix(false, true);
  }
}
