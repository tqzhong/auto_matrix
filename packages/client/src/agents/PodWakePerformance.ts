import * as THREE from 'three';
import { FILM_SETS } from '@auto_matrix/shared';
import type { HeroRig } from './HeroModel.js';
import { reach } from './SpoonPerformance.js';

/** The saved disconnection clock drives the supported body, including paused loads. */
export function posePodWake(rig: HeroRig, elapsed: number | undefined): void {
  if (elapsed === undefined) return;
  const smooth = THREE.MathUtils.smoothstep, t = elapsed;
  const sitting = smooth(t, .1, 1.35) * (1 - smooth(t, 3.8, 5.2));
  const support = smooth(t, .08, .45) * (1 - smooth(t, 3.6, 4.05));
  const inspect = smooth(t, 1.3, 1.75) * (1 - smooth(t, 2.25, 2.6));
  const scan = smooth(t, 2.35, 2.8) * (1 - smooth(t, 3.4, 3.8));
  const bone = (name: string) => rig.bones.get(name)!;
  const pelvis = bone('pelvis'); pelvis.position.copy(rig.rest.get('pelvis')!);
  pelvis.rotation.set(1.2 * sitting, 0, 0);
  bone('spine').rotation.set((.04 + Math.sin(t * 7) * .012) * sitting, 0, 0);
  bone('chest').rotation.set(.05 * sitting, 0, 0);
  bone('head').rotation.set((.15 + .18 * inspect) * sitting, -.3 * scan, 0);
  for (const [i, side] of ['R', 'L'].entries()) {
    const sign = i ? 1 : -1;
    // Counter-rotate the hips so sitting up cannot lift the legs out of the basin.
    bone(`hip_${side}`).rotation.set(-.2 - pelvis.rotation.x, 0, 0);
    bone(`knee_${side}`).rotation.set(.45 + Math.sin(t * 8 + i) * .025 * sitting, 0, 0);
    bone(`ankle_${side}`).rotation.set(-.1, 0, 0);
    bone(`shoulder_${side}`).rotation.set(-.5, 0, sign * .25);
    bone(`elbow_${side}`).rotation.set(-.7, 0, 0);
    bone(`wrist_${side}`).rotation.set(0, 0, 0);
    for (let finger = 1; finger <= 5; finger++) for (let segment = 1; segment <= 3; segment++)
      bone(`finger${finger}-${segment}_${side}`).rotation.set(0, 0, -sign * (finger === 1 ? .15 : .25));
  }
  rig.root.updateWorldMatrix(true, true);
  if (!support) return;
  const center = FILM_SETS.film_power_plant_pods.center;
  const z = -.6 / 3.4, rimX = 1.8 * Math.sqrt(1 - z * z) * (.84 - .16 * z);
  for (const [i, side] of ['R', 'L'].entries()) {
    const sign = i ? 1 : -1;
    const shoulder = bone(`shoulder_${side}`), elbow = bone(`elbow_${side}`), wrist = bone(`wrist_${side}`);
    const contact = new THREE.Vector3(center.x + sign * rimX, center.y - 1 + 2.16, center.z - 13.4);
    const orientation = wrist.getWorldQuaternion(new THREE.Quaternion()).slerp(new THREE.Quaternion().setFromEuler(new THREE.Euler(-Math.PI / 2, Math.PI, 0)), support);
    // Calibrated to the shipped wrist/finger skin surface, rather than the bone center.
    const palm = new THREE.Vector3(-sign * .09, -.18, .15);
    const target = wrist.localToWorld(palm.clone()).lerp(contact, support).sub(palm.applyQuaternion(orientation));
    reach(shoulder, elbow, wrist.position, target, new THREE.Vector3(sign, .2, -.45));
    wrist.quaternion.copy(elbow.getWorldQuaternion(new THREE.Quaternion()).invert().multiply(orientation));
    wrist.updateWorldMatrix(false, true);
  }
}
