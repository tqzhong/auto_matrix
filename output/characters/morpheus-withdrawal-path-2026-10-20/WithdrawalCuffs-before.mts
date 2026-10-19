import * as THREE from 'three';
import type { HeroRig } from '../../../packages/client/src/agents/HeroModel.js';

/** Offline authoring only; construct at the .8 second sleeve-release pose. */
export class WithdrawalCuffs {
  private initial = new Map<string, THREE.Matrix4>();
  constructor(private rig: HeroRig) {
    for (const side of ['R', 'L']) this.initial.set(side, rig.bones.get(`wrist_${side}`)!.matrixWorld.clone());
  }
  matrix(side: string, time: number): THREE.Matrix4 {
    const start = this.initial.get(side)!, matrix = start.clone();
    const amount = THREE.MathUtils.smootherstep(time, .8, 3);
    matrix.elements[13] -= 1.65 * amount; matrix.elements[14] -= .8 * amount;
    return matrix.multiply(start.clone().invert());
  }
}
