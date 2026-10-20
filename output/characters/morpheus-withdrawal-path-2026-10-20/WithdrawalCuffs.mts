import * as THREE from 'three';
import type { HeroRig } from '../../../packages/client/src/agents/HeroModel.js';
import type { WithdrawalBody } from './WithdrawalBody.mjs';

/** Offline authoring only; construct at the .8 second sleeve-release pose. */
export class WithdrawalCuffs {
  private initial = new Map<string, THREE.Matrix4>();
  private local = new Map<string, THREE.Matrix4>();
  private released = new Map<string, THREE.Matrix4>();
  private velocity = new Map<string, THREE.Vector3>();
  constructor(private rig: HeroRig, body: WithdrawalBody) {
    for (const side of ['R', 'L']) {
      const wrist = rig.bones.get(`wrist_${side}`)!.matrixWorld.clone();
      this.initial.set(side, wrist);
      this.local.set(side, rig.root.matrixWorld.clone().invert().multiply(wrist));
    }
    body.pose(1.699);
    for (const side of ['R', 'L']) this.velocity.set(side, rig.bones.get(`wrist_${side}`)!.getWorldPosition(new THREE.Vector3()));
    body.pose(1.701);
    for (const side of ['R', 'L']) this.velocity.set(side, rig.bones.get(`wrist_${side}`)!.getWorldPosition(new THREE.Vector3()).sub(this.velocity.get(side)!).multiplyScalar(500));
    body.pose(1.7);
    for (const side of ['R', 'L']) this.released.set(side, rig.bones.get(`wrist_${side}`)!.matrixWorld.clone());
    body.pose(.8);
  }
  matrix(side: string, time: number): THREE.Matrix4 {
    const start = this.initial.get(side)!;
    const amount = THREE.MathUtils.smootherstep(time, .8, 1.7);
    const sign = side === 'R' ? 1 : -1;
    const roll = THREE.MathUtils.smootherstep(amount, .37, .5) * (1 - THREE.MathUtils.smootherstep(amount, .8, 1));
    const contour = .02 * Math.sin(Math.PI * amount) * (1 - THREE.MathUtils.smootherstep(amount, .37, .5)
      + THREE.MathUtils.smootherstep(amount, .5, .62));
    const across = -.045 * amount + .0075 * amount * (1 - THREE.MathUtils.smootherstep(amount, .43, .5));
    // The measured palm contour clears the thumb first, then rolls the same
    // complete rim around the fingers. No ring scaling or deleted triangles.
    const wrist = time < 1.7 ? this.rig.bones.get(`wrist_${side}`)!.matrixWorld.clone() : this.released.get(side)!.clone();
    if (time >= 1.7) wrist.setPosition(new THREE.Vector3().setFromMatrixPosition(wrist).addScaledVector(this.velocity.get(side)!, time - 1.7));
    const matrix = wrist
      .multiply(new THREE.Matrix4().makeTranslation(sign * (.09 * amount + contour), -.52 * amount, across))
      .multiply(new THREE.Matrix4().makeTranslation(sign * .03, -.082, .015))
      .multiply(new THREE.Matrix4().makeRotationY(-sign * .28 * roll))
      .multiply(new THREE.Matrix4().makeTranslation(-sign * .03, .082, -.015));
    // After release, retain the exit velocity but never read the moving hand.
    const release = THREE.MathUtils.smootherstep(time, 1.7, 2.3);
    if (release) {
      const lowered = this.local.get(side)!.clone(), amount = THREE.MathUtils.smootherstep(time, .8, 3);
      lowered.elements[13] -= 1.65 * amount; lowered.elements[14] -= .8 * amount;
      lowered.premultiply(this.rig.root.matrixWorld);
      const p = new THREE.Vector3(), q = new THREE.Quaternion(), scale = new THREE.Vector3();
      const goal = new THREE.Vector3(), rotation = new THREE.Quaternion();
      matrix.decompose(p,q,scale); lowered.decompose(goal,rotation,new THREE.Vector3());
      matrix.compose(p.lerp(goal,release),q.slerp(rotation,release),scale);
    }
    return matrix.multiply(start.clone().invert());
  }
}
