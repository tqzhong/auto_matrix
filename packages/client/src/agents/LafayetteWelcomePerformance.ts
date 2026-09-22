import * as THREE from 'three';
import { FILM_SETS, lafayetteWelcomePose, type LafayetteWelcomeGesture } from '@auto_matrix/shared';
import type { HeroRig } from './HeroModel.js';

// Both rigs solve toward one saved world-space contact, so the palms stay
// together even when a network snapshot is restored in the middle of the shot.
export class LafayetteWelcomePerformance {
  constructor(private rig: HeroRig) {}
  private bone(name: string): THREE.Bone { return this.rig.bones.get(name)!; }
  private contact(): THREE.Vector3 {
    const center = FILM_SETS.film_lafayette.center;
    return this.rig.root.worldToLocal(new THREE.Vector3(center.x + 1.5, center.y + 2.15, center.z));
  }
  private orientation(): THREE.Quaternion {
    const normal = new THREE.Vector3(0, 0, 1); const fingers = new THREE.Vector3(0, -1, 0);
    return new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(normal, fingers.clone().negate(), normal.clone().cross(fingers.clone().negate())));
  }
  private solve(contact: THREE.Vector3, rotation: THREE.Quaternion, blend: number): void {
    const root = this.rig.root; root.updateWorldMatrix(true, true);
    const upper = this.bone('shoulder_R'); const lower = this.bone('elbow_R'); const wrist = this.bone('wrist_R');
    const offset = new THREE.Vector3(.09, -.18, .02);
    const rootRotation = root.getWorldQuaternion(new THREE.Quaternion());
    const orientation = rootRotation.clone().invert().multiply(wrist.getWorldQuaternion(new THREE.Quaternion())).slerp(rotation, blend);
    const target = root.worldToLocal(wrist.localToWorld(offset.clone())).lerp(contact, blend).sub(offset.clone().applyQuaternion(orientation)); root.localToWorld(target);
    const start = upper.getWorldPosition(new THREE.Vector3()); const direction = target.clone().sub(start);
    const a = lower.position.length(); const b = wrist.position.length(); const reach = THREE.MathUtils.clamp(direction.length(), .02, a + b - .001); direction.normalize();
    target.copy(start).addScaledVector(direction, reach);
    const along = (a * a - b * b + reach * reach) / (2 * reach);
    const pole = new THREE.Vector3(-.35, -1, .18).applyQuaternion(rootRotation); pole.addScaledVector(direction, -pole.dot(direction)).normalize();
    const hinge = start.clone().addScaledVector(direction, along).addScaledVector(pole, Math.sqrt(Math.max(0, a * a - along * along)));
    const aim = (joint: THREE.Bone, child: THREE.Bone, point: THREE.Vector3) => {
      joint.quaternion.setFromUnitVectors(child.position.clone().normalize(), joint.parent!.worldToLocal(point.clone()).sub(joint.position).normalize()); joint.updateWorldMatrix(false, true);
    };
    aim(upper, lower, hinge); aim(lower, wrist, target);
    wrist.quaternion.copy(lower.getWorldQuaternion(new THREE.Quaternion()).invert().multiply(rootRotation).multiply(orientation));
    for (let finger = 1; finger <= 5; finger++) for (let segment = 1; segment <= 3; segment++) {
      this.bone(`finger${finger}-${segment}_R`).rotation.set(finger === 1 ? .28 * blend : 0, 0, blend * (finger === 1 ? .12 : segment === 1 ? .48 : .68));
    }
  }
  update(gesture?: LafayetteWelcomeGesture): void {
    if (!gesture) return;
    const blend = lafayetteWelcomePose(gesture).handshake;
    if (blend > .001) this.solve(this.contact(), this.orientation(), blend);
  }
  dispose(): void {}
}
