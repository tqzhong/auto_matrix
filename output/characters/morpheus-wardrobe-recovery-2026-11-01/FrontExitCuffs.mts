import * as THREE from 'three';
import type { HeroRig } from '../../../packages/client/src/agents/HeroModel.js';
import { WithdrawalCuffs } from '../morpheus-withdrawal-path-2026-10-20/WithdrawalCuffs.mjs';
import type { FrontExitBody } from './FrontExitBody.mjs';

/** Apply the measured passage to the complete standing garment's reference. */
export class FrontExitCuffs {
  private preparation = new Map<string, THREE.Matrix4>();
  private path: WithdrawalCuffs;

  constructor(rig: HeroRig, body: Pick<FrontExitBody, 'pose'>) {
    body.pose(0);
    const inverse = new Map(['R', 'L'].map(side => [side, rig.bones.get(`wrist_${side}`)!.matrixWorld.clone().invert()]));
    body.pose(.8);
    for (const side of ['R', 'L'])
      this.preparation.set(side, rig.bones.get(`wrist_${side}`)!.matrixWorld.clone().multiply(inverse.get(side)!));
    this.path = new WithdrawalCuffs(rig, body);
  }

  matrix(side: string, time: number): THREE.Matrix4 {
    return this.path.matrix(side, time).multiply(this.preparation.get(side)!);
  }
}
