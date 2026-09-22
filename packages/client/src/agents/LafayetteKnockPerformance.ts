import * as THREE from 'three';
import { FILM_SETS, lafayetteKnockPose } from '@auto_matrix/shared';
import type { HeroRig } from './HeroModel.js';

export class LafayetteKnockPerformance {
  constructor(private rig: HeroRig) {}
  private bone(name: string): THREE.Bone { return this.rig.bones.get(name)!; }

  update(elapsed?: number): void {
    if (elapsed === undefined) return;
    const pose = lafayetteKnockPose(elapsed); if (pose.raised < .001) return;
    const root = this.rig.root; root.updateWorldMatrix(true, true);
    const upper = this.bone('shoulder_R'); const lower = this.bone('elbow_R'); const wrist = this.bone('wrist_R');
    const center = FILM_SETS.film_lafayette.center;
    const target = wrist.getWorldPosition(new THREE.Vector3()).lerp(
      new THREE.Vector3(center.x + 21.58 - pose.strike * .22, center.y + 2.95, center.z - .12), pose.raised);
    const start = upper.getWorldPosition(new THREE.Vector3()); const direction = target.clone().sub(start);
    const a = lower.position.length(); const b = wrist.position.length(); const reach = THREE.MathUtils.clamp(direction.length(), .02, a + b - .001); direction.normalize();
    target.copy(start).addScaledVector(direction, reach);
    const along = (a * a - b * b + reach * reach) / (2 * reach);
    const rootRotation = root.getWorldQuaternion(new THREE.Quaternion());
    const pole = new THREE.Vector3(.65, -.8, -.15).applyQuaternion(rootRotation); pole.addScaledVector(direction, -pole.dot(direction)).normalize();
    const hinge = start.clone().addScaledVector(direction, along).addScaledVector(pole, Math.sqrt(Math.max(0, a * a - along * along)));
    const aim = (joint: THREE.Bone, child: THREE.Bone, point: THREE.Vector3) => {
      joint.quaternion.setFromUnitVectors(child.position.clone().normalize(), joint.parent!.worldToLocal(point.clone()).sub(joint.position).normalize());
      joint.updateWorldMatrix(false, true);
    };
    aim(upper, lower, hinge); aim(lower, wrist, target);
    wrist.rotation.y = -Math.PI / 2 * pose.raised;
    for (let finger = 1; finger <= 5; finger++) for (let segment = 1; segment <= 3; segment++) {
      const joint = this.bone(`finger${finger}-${segment}_R`);
      joint.rotation.set(finger === 1 ? .15 * pose.raised : 0, 0, pose.raised * (finger === 1 ? segment === 1 ? .95 : 1.2 : segment === 1 ? 1.34 : 1.58));
    }
  }

  dispose(): void {}
}
