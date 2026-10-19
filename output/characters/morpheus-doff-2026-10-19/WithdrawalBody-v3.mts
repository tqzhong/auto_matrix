import * as THREE from 'three';
import type { HeroRig } from '../../../packages/client/src/agents/HeroModel.js';
import { reach } from '../../../packages/client/src/agents/SpoonPerformance.js';

// Keep each delivered joint's reference roll while aiming the elbow and wrist.
// Rebuilding orientation from an unrotated axis discards that reference frame.
function reachArm(upper: THREE.Object3D, lower: THREE.Object3D, end: THREE.Vector3, target: THREE.Vector3, pole: THREE.Vector3, reference: THREE.Quaternion[]): void {
  const start = upper.getWorldPosition(new THREE.Vector3()), direction = target.clone().sub(start);
  const scale = upper.getWorldScale(new THREE.Vector3()).x;
  const a = lower.position.length() * scale, b = end.length() * scale;
  const length = THREE.MathUtils.clamp(direction.length(), .01, a + b - .001);
  direction.normalize(); target = start.clone().addScaledVector(direction, length);
  const along = (a * a - b * b + length * length) / (2 * length);
  pole.addScaledVector(direction, -pole.dot(direction)).normalize();
  const hinge = start.clone().addScaledVector(direction, along).addScaledVector(pole, Math.sqrt(Math.max(0, a * a - along * along)));
  for (const [index, joint, child, goal] of [[0, upper, lower.position, hinge], [1, lower, end, target]] as const) {
    const desired = joint.parent!.worldToLocal(goal.clone()).sub(joint.position).normalize();
    const original = child.clone().applyQuaternion(reference[index]).normalize();
    joint.quaternion.setFromUnitVectors(original, desired).multiply(reference[index]);
    joint.updateWorldMatrix(false, true);
  }
}

/** Authoring input only. The actual fitted wardrobe remains untouched. */
export class WithdrawalBody {
  private initial = new Map<string, { p: THREE.Vector3; q: THREE.Quaternion }>();
  private rest = new Map<string, THREE.Vector3>();
  private feet = new Map<string, { point: THREE.Vector3; rotation: THREE.Quaternion }>();
  private passage = new Map<string, THREE.Vector3[]>();
  private aligned = new Map<string, THREE.Quaternion>();
  private elbowPoles = new Map<string, THREE.Vector3>();
  readonly errors: { side: string; distance: number }[] = [];
  constructor(private rig: HeroRig) {
    for (const [name, bone] of rig.bones) this.initial.set(name, { p: bone.position.clone(), q: bone.quaternion.clone() });
    for (const side of ['R', 'L']) {
      this.rest.set(side, rig.root.worldToLocal(rig.bones.get(`wrist_${side}`)!.getWorldPosition(new THREE.Vector3())));
      const shoulder = rig.root.worldToLocal(rig.bones.get(`shoulder_${side}`)!.getWorldPosition(new THREE.Vector3()));
      const direction = this.rest.get(side)!.clone().sub(shoulder).normalize();
      const elbow = rig.root.worldToLocal(rig.bones.get(`elbow_${side}`)!.getWorldPosition(new THREE.Vector3())).sub(shoulder);
      this.elbowPoles.set(side, elbow.addScaledVector(direction, -elbow.dot(direction)).normalize());
      const ankle = rig.bones.get(`ankle_${side}`)!;
      this.feet.set(side, { point: rig.root.worldToLocal(ankle.getWorldPosition(new THREE.Vector3())),
        rotation: rig.root.getWorldQuaternion(new THREE.Quaternion()).invert().multiply(ankle.getWorldQuaternion(new THREE.Quaternion())) });
    }
    this.pose(.8);
    for (const side of ['R', 'L']) {
      this.passage.set(side, ['shoulder', 'elbow', 'wrist'].map(name => rig.root.worldToLocal(rig.bones.get(`${name}_${side}`)!.getWorldPosition(new THREE.Vector3()))));
      this.aligned.set(side, rig.root.getWorldQuaternion(new THREE.Quaternion()).invert().multiply(rig.bones.get(`wrist_${side}`)!.getWorldQuaternion(new THREE.Quaternion())));
    }
    this.pose(0);
  }
  pose(time: number): void {
    const smooth = THREE.MathUtils.smootherstep;
    for (const [name, bone] of this.rig.bones) {
      const rest = this.initial.get(name)!; bone.position.copy(rest.p); bone.quaternion.copy(rest.q);
    }
    this.rig.root.updateMatrixWorld(true); this.errors.length = 0;
    if (time === 0) return;
    const rotation = this.rig.root.getWorldQuaternion(new THREE.Quaternion());
    const lower = .18 * smooth(time, .8, 1.8) * (1 - smooth(time, 2.7, 3.2));
    this.rig.bones.get('pelvis')!.position.y -= lower;
    this.rig.root.updateMatrixWorld(true);
    if (lower) for (const side of ['R', 'L']) {
      const hip = this.rig.bones.get(`hip_${side}`)!, knee = this.rig.bones.get(`knee_${side}`)!, ankle = this.rig.bones.get(`ankle_${side}`)!;
      const foot = this.feet.get(side)!;
      reach(hip, knee, ankle.position, this.rig.root.localToWorld(foot.point.clone()), new THREE.Vector3(0, 0, 1).applyQuaternion(rotation));
      ankle.quaternion.copy(knee.getWorldQuaternion(new THREE.Quaternion()).invert().multiply(rotation).multiply(foot.rotation));
      this.rig.root.updateMatrixWorld(true);
    }
    for (const side of ['R', 'L']) {
      const sign = side === 'R' ? -1 : 1;
      const shoulder = this.rig.bones.get(`shoulder_${side}`)!, elbow = this.rig.bones.get(`elbow_${side}`)!, wrist = this.rig.bones.get(`wrist_${side}`)!;
      const target = this.rest.get(side)!.clone().lerp(new THREE.Vector3(sign * .76, 2.45, -.55), smooth(time, 0, .8));
      const passage = this.passage.get(side), amount = smooth(time, .8, 3);
      if (passage && amount) {
        const [start, middle, end] = passage, upper = start.distanceTo(middle), lower = middle.distanceTo(end);
        const remaining = upper + lower - 1.85 * amount;
        const inside = remaining >= upper ? middle.clone().lerp(end, (remaining - upper) / lower)
          : remaining >= 0 ? start.clone().lerp(middle, remaining / upper)
          : start.clone().lerp(new THREE.Vector3(sign * .16, start.y + .65, -.02), smooth(-remaining, 0, 1.85 - upper - lower));
        target.copy(inside).add(new THREE.Vector3(0, -1.65 * amount, -.8 * amount));
      }
      const goal = this.rig.root.localToWorld(target);
      const pole = this.elbowPoles.get(side)!.clone().lerp(new THREE.Vector3(sign, -.3, -.55).normalize(), smooth(time, 0, .8));
      reachArm(shoulder, elbow, wrist.position, goal, pole.applyQuaternion(rotation), [this.initial.get(shoulder.name)!.q, this.initial.get(elbow.name)!.q]);
      wrist.quaternion.copy(this.initial.get(wrist.name)!.q);
      if (this.aligned.has(side)) {
        const aligned = elbow.getWorldQuaternion(new THREE.Quaternion()).invert().multiply(rotation).multiply(this.aligned.get(side)!);
        wrist.quaternion.slerp(aligned, smooth(time, .6, .8));
      }
      this.rig.root.updateMatrixWorld(true);
      this.errors.push({ side, distance: goal.distanceTo(wrist.getWorldPosition(new THREE.Vector3())) });
    }
  }
}
