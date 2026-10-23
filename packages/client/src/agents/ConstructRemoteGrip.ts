import type { Quaternion } from 'three';
import type { HeroRig } from './HeroModel.js';
import type { FightingHands } from './FightingHands.js';

/** A supported pinch on the existing casing, fitted to these anatomical fingers. */
export class ConstructRemoteGrip {
  private targets?: Quaternion[];
  constructor(private rig: HeroRig, private hands?: FightingHands) {}

  update(): void {
    if (!this.hands) return;
    if (!this.targets) {
      const joints = Array.from({ length: 15 }, (_, i) => this.rig.bones.get(`finger${Math.floor(i / 3) + 1}-${i % 3 + 1}_R`)!);
      const pose = (amount: number) => {
        joints.forEach(joint => joint.quaternion.identity()); this.hands!.pose('R', amount, true);
        return joints.map(joint => joint.quaternion.clone());
      };
      const base = pose(.225), middle = pose(.325), support = pose(.3);
      this.targets = base.map((q, i) => i >= 6 && i < 9 ? middle[i] : i >= 9 ? support[i] : q);
    }
    this.targets.forEach((q, i) => this.rig.bones.get(`finger${Math.floor(i / 3) + 1}-${i % 3 + 1}_R`)!.quaternion.copy(q));
    this.rig.bones.get('wrist_R')!.updateWorldMatrix(false, true);
  }
}
