import * as THREE from 'three';
import { DEUS_PACT, FILM_SETS, deusPactPose, type DeusPactGesture } from '@auto_matrix/shared';
import type { HeroRig } from './HeroModel.js';

const soles = new WeakMap<HeroRig, { bone: THREE.Bone; points: THREE.Vector3[] }[]>();

/** The machines lower and recline Neo; the saved beat restores the whole body. */
export function poseDeusRecline(rig: HeroRig, gesture: DeusPactGesture | undefined): void {
  if (!gesture) return;
  const amount = deusPactPose(gesture).seated; if (!amount) return;
  const bone = (name: string) => rig.bones.get(name)!;
  const mix = (start: number, end: number) => THREE.MathUtils.lerp(start, end, amount);
  const pelvis = bone('pelvis');
  pelvis.position.y = mix(pelvis.position.y, .65);
  pelvis.position.z = mix(pelvis.position.z, -.1);
  pelvis.rotation.x = -DEUS_PACT.reclineAngle * amount;
  bone('spine').rotation.x = mix(bone('spine').rotation.x, .025);
  bone('chest').rotation.x = mix(bone('chest').rotation.x, .035);
  bone('head').rotation.x = mix(bone('head').rotation.x, .14);
  for (const [i, side] of ['R', 'L'].entries()) {
    bone(`hip_${side}`).rotation.x = mix(bone(`hip_${side}`).rotation.x, -.06);
    bone(`knee_${side}`).rotation.x = mix(bone(`knee_${side}`).rotation.x, .12);
    bone(`ankle_${side}`).rotation.x = mix(bone(`ankle_${side}`).rotation.x, -.04);
    bone(`shoulder_${side}`).rotation.x = mix(bone(`shoulder_${side}`).rotation.x, -.12);
    bone(`shoulder_${side}`).rotation.z = mix(bone(`shoulder_${side}`).rotation.z, (i ? 1 : -1) * .17);
    bone(`elbow_${side}`).rotation.x = mix(bone(`elbow_${side}`).rotation.x, -.22);
    for (let finger = 1; finger <= 5; finger++) for (let segment = 1; segment <= 3; segment++) {
      const joint = bone(`finger${finger}-${segment}_${side}`);
      joint.rotation.x *= 1 - amount;
      joint.rotation.z = mix(joint.rotation.z, (i ? -1 : 1) * .12);
    }
  }
  rig.root.updateWorldMatrix(true, true);
  // Keep the real soles above the deck while knees unfold and the hips lower.
  // Bind-space samples restore equally on a cold frame and a running frame.
  let feet = soles.get(rig);
  if (!feet) {
    const shoes = rig.root.getObjectByName('shoes01') as THREE.SkinnedMesh;
    const { position, skinIndex, skinWeight } = shoes.geometry.attributes;
    feet = ['R', 'L'].map(side => {
      const ankle = bone(`ankle_${side}`), index = shoes.skeleton.bones.indexOf(ankle), points: THREE.Vector3[] = [];
      for (let i = 0; i < position.count; i++) {
        if (![0, 1, 2, 3].some(part => skinIndex.getComponent(i, part) === index && skinWeight.getComponent(i, part) > .5)) continue;
        points.push(new THREE.Vector3().fromBufferAttribute(position, i).applyMatrix4(shoes.bindMatrix).applyMatrix4(shoes.skeleton.boneInverses[index]));
      }
      return { bone: ankle, points };
    });
    soles.set(rig, feet);
  }
  const inverse = rig.root.matrixWorld.clone().invert(), point = new THREE.Vector3(); let lowest = Infinity;
  for (const foot of feet) {
    const matrix = inverse.clone().multiply(foot.bone.matrixWorld);
    for (const vertex of foot.points) lowest = Math.min(lowest, point.copy(vertex).applyMatrix4(matrix).y);
  }
  const origin = rig.root.getWorldPosition(point);
  const floor = rig.root.worldToLocal(origin.setY(FILM_SETS.film_machine_core.center.y - 1 + .025)).y;
  pelvis.position.y += Math.max(0, floor - lowest);
  rig.root.updateWorldMatrix(true, true);
}
