import * as THREE from 'three';
import type { HeroRig } from './HeroModel.js';
import { CONSOLE_DRINK, CONSOLE_SERVICE } from '@auto_matrix/shared';

/** Anatomical finger pads wrap a mug body or the jug's handle bar. */
export class ConsoleGrip {
  private pads?: THREE.Vector3[];
  constructor(private rig: HeroRig, private side: 'R' | 'L' = 'R') {}

  update(skin: THREE.SkinnedMesh, amount: number, prop: 'mug' | 'jug' = 'mug', blend = amount, frame?: THREE.Matrix4): void {
    if (!this.pads) {
      this.pads = Array.from({ length: 5 }, () => new THREE.Vector3()); const counts = [0, 0, 0, 0, 0];
      const { position, skinIndex, skinWeight } = skin.geometry.attributes;
      const digits = skin.skeleton.bones.map(bone => new RegExp(`^finger([1-5])-3_${this.side}$`).exec(bone.name));
      for (let v = 0; v < position.count; v++) for (let part = 0; part < 4; part++) {
        const index = skinIndex.getComponent(v, part), digit = digits[index];
        if (!digit || skinWeight.getComponent(v, part) < .95) continue;
        this.pads[Number(digit[1]) - 1].add(new THREE.Vector3().fromBufferAttribute(position, v).applyMatrix4(skin.bindMatrix).applyMatrix4(skin.skeleton.boneInverses[index]));
        counts[Number(digit[1]) - 1]++;
      }
      this.pads.forEach((pad, i) => pad.divideScalar(counts[i]));
    }
    const contact = frame ? this.rig.bones.get(`wrist_${this.side}`)!.matrixWorld.clone().invert().multiply(frame) : undefined;
    for (let digit = 1; digit <= 5; digit++) {
      const base = this.rig.rest.get(`finger${digit}-1_${this.side}`)!, first = this.rig.rest.get(`finger${digit}-2_${this.side}`)!, second = this.rig.rest.get(`finger${digit}-3_${this.side}`)!;
      const angles = [120, -130, -130, -140, -165].map(angle => angle * Math.PI / 180);
      const radius = CONSOLE_DRINK.radius + (digit === 1 ? .045 : .034), angle = angles[digit - 1];
      const sign = this.side === 'R' ? 1 : -1;
      const target = new THREE.Vector3(sign * (.31 + Math.cos(angle) * radius), -.24 + Math.sin(angle) * radius, digit === 1 ? .145 : base.z);
      const direction = new THREE.Vector3(sign * (digit === 5 ? .866 : .9), digit === 5 ? -.5 : -.436, 0).normalize();
      let contactBend: THREE.Vector3 | undefined;
      if (contact) {
        const axis = new THREE.Vector3(0, 1, 0).transformDirection(contact);
        const center = (prop === 'jug' ? new THREE.Vector3(CONSOLE_SERVICE.handle.x, CONSOLE_SERVICE.handle.y, 0) : new THREE.Vector3()).applyMatrix4(contact);
        const along = THREE.MathUtils.clamp(base.clone().sub(center).dot(axis), prop === 'jug' ? -.18 : -CONSOLE_DRINK.height / 2 + .04, prop === 'jug' ? .22 : CONSOLE_DRINK.height / 2 - .04);
        center.addScaledVector(axis, along); const outward = base.clone().sub(center).normalize();
        const clearance = (prop === 'jug' ? .1 : .08) * (1 - amount);
        target.copy(center).addScaledVector(outward, (prop === 'jug' ? .035 : CONSOLE_DRINK.radius) + .034 + clearance);
        direction.copy(outward).negate();
        // A tangent pole bows the finger around the cylinder; a radial pole
        // degenerates when its base and contact share the same radius.
        contactBend = outward.clone().cross(axis).multiplyScalar(sign * (digit === 1 ? 1 : -1));
      }
      const pad = this.pads[digit - 1], end = target.addScaledVector(direction, -pad.length());
      const axis = end.clone().sub(base), a = first.length(), b = second.length();
      const length = THREE.MathUtils.clamp(axis.length(), Math.abs(a - b) + .001, a + b - .001); axis.normalize(); end.copy(base).addScaledVector(axis, length);
      const along = (a * a - b * b + length * length) / (2 * length), bend = contactBend ?? new THREE.Vector3(sign, digit === 1 ? 1 : -1, 0);
      bend.addScaledVector(axis, -bend.dot(axis)).normalize();
      const hinge = base.clone().addScaledVector(axis, along).addScaledVector(bend, Math.sqrt(Math.max(0, a * a - along * along))), parent = new THREE.Quaternion();
      [hinge.clone().sub(base), end.clone().sub(hinge), direction].forEach((desired, part) => {
        const world = new THREE.Quaternion().setFromUnitVectors([first, second, pad][part].clone().normalize(), desired.normalize());
        this.rig.bones.get(`finger${digit}-${part + 1}_${this.side}`)!.quaternion.slerp(parent.clone().invert().multiply(world), blend); parent.copy(world);
      });
    }
  }
}
