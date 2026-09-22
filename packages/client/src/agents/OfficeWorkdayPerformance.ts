import * as THREE from 'three';
import { FILM_SETS, officeClipboardPoint, officeParcelPoint, officePenPoint, type OfficeWorkdayGesture } from '@auto_matrix/shared';
import type { HeroRig } from './HeroModel.js';

const smooth = (t: number, a: number, b: number) => THREE.MathUtils.smoothstep(t, a, b);
export class OfficeWorkdayPerformance {
  private pen = new THREE.Group();
  private geometry = new THREE.CylinderGeometry(.013, .013, .36, 10);
  private material = new THREE.MeshStandardMaterial({ color: 0x18232b, roughness: .35, metalness: .4 });
  constructor(private rig: HeroRig) {
    const pen = new THREE.Mesh(this.geometry, this.material); pen.position.y = .18; this.pen.add(pen);
    this.pen.name = 'delivery-signature-pen'; rig.root.add(this.pen);
  }
  private bone(name: string) { return this.rig.bones.get(name)!; }
  private point(point: { x: number; y: number; z: number }) {
    const center = FILM_SETS.film_metacortex_floor.center;
    return this.rig.root.worldToLocal(new THREE.Vector3(center.x + point.x, center.y - 1 + point.y, center.z + point.z));
  }
  private hand(side: 'R' | 'L', point: THREE.Vector3, blend = 1, writing = false): void {
    const root = this.rig.root; root.updateWorldMatrix(true, true);
    const upper = this.bone('shoulder_' + side); const lower = this.bone('elbow_' + side); const wrist = this.bone('wrist_' + side);
    const rootRotation = root.getWorldQuaternion(new THREE.Quaternion());
    const desired = writing
      ? new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(new THREE.Vector3(0, -1, 0), new THREE.Vector3(0, 0, -1), new THREE.Vector3(1, 0, 0)))
      : new THREE.Quaternion().setFromEuler(new THREE.Euler(-Math.PI / 2, 0, side === 'R' ? Math.PI / 2 : -Math.PI / 2));
    const rotation = rootRotation.clone().invert().multiply(wrist.getWorldQuaternion(new THREE.Quaternion())).slerp(desired, blend);
    const offset = writing ? new THREE.Vector3(.12, -.27, .055) : new THREE.Vector3(side === 'R' ? .065 : -.065, -.17, .01);
    const target = root.worldToLocal(wrist.localToWorld(offset.clone())).lerp(point, blend).sub(offset.clone().applyQuaternion(rotation)); root.localToWorld(target);
    const start = upper.getWorldPosition(new THREE.Vector3()); const direction = target.clone().sub(start);
    const a = lower.position.length(); const b = wrist.position.length(); const length = THREE.MathUtils.clamp(direction.length(), .02, a + b - .001); direction.normalize();
    const along = (a * a - b * b + length * length) / (2 * length);
    const pole = new THREE.Vector3(side === 'R' ? -.45 : .45, -.7, -.15).applyQuaternion(rootRotation); pole.addScaledVector(direction, -pole.dot(direction)).normalize();
    const hinge = start.clone().addScaledVector(direction, along).addScaledVector(pole, Math.sqrt(Math.max(0, a * a - along * along)));
    const aim = (joint: THREE.Bone, child: THREE.Bone, target: THREE.Vector3) => {
      joint.quaternion.setFromUnitVectors(child.position.clone().normalize(), joint.parent!.worldToLocal(target.clone()).sub(joint.position).normalize()); joint.updateWorldMatrix(false, true);
    };
    aim(upper, lower, hinge); aim(lower, wrist, start.addScaledVector(direction, length));
    wrist.quaternion.copy(lower.getWorldQuaternion(new THREE.Quaternion()).invert().multiply(rootRotation).multiply(rotation));
    for (let f = 1; f <= 5; f++) for (let s = 1; s <= 3; s++) this.bone(`finger${f}-${s}_${side}`).rotation.set(f === 1 ? .35 * blend : 0, 0, (side === 'R' ? 1 : -1) * blend * (writing ? f < 3 ? .45 : .9 : .22));
    if (writing) for (const f of [1, 2]) {
      const chain = [1, 2, 3].map(s => this.bone(`finger${f}-${s}_${side}`));
      const tip = chain[2].position.clone().normalize().multiplyScalar(.04);
      root.updateWorldMatrix(true, true);
      const target = wrist.localToWorld(offset.clone().add(new THREE.Vector3(f === 1 ? .018 : -.018, 0, 0)));
      for (let iteration = 0; iteration < 8; iteration++) for (const joint of [...chain].reverse()) {
        root.updateWorldMatrix(true, true);
        joint.quaternion.multiply(new THREE.Quaternion().setFromUnitVectors(joint.worldToLocal(chain[2].localToWorld(tip.clone())).normalize(), joint.worldToLocal(target.clone()).normalize()));
      }
    }
  }
  update(gesture?: OfficeWorkdayGesture): void {
    this.pen.visible = false;
    if (!gesture) return;
    const { role, phase, elapsed: t } = gesture; const root = this.rig.root;
    if (role === 'rhineheart') {
      const pelvis = this.bone('pelvis'); pelvis.position.copy(this.rig.rest.get('pelvis')!); pelvis.position.y = 1.62;
      pelvis.rotation.set(0, 0, 0);
      this.bone('spine').rotation.set(.08, 0, 0); this.bone('chest').rotation.set(.1, 0, 0);
      this.bone('head').rotation.set(phase === 'answer' ? -.09 : .12, 0, 0);
      for (const side of ['R', 'L'] as const) {
        this.bone('hip_' + side).rotation.set(-1.35, 0, 0); this.bone('knee_' + side).rotation.set(1.46, 0, 0); this.bone('ankle_' + side).rotation.set(-.1, 0, 0);
      }
      root.updateWorldMatrix(true, true);
      for (const side of ['R', 'L'] as const) {
        const typing = phase === 'briefing' ? Math.sin(t * 14 + (side === 'R' ? 0 : 2)) * .025 : 0;
        this.hand(side, this.point({ x: -22.3, y: 2.7 + typing, z: 27.4 + (side === 'R' ? .4 : -.4) }));
      }
    } else if (role === 'courier') {
      root.updateWorldMatrix(true, true);
      const board = officeClipboardPoint(gesture); this.hand('L', this.point({ ...board, x: board.x - .3, y: board.y - .045, z: board.z + .05 }));
      const parcel = officeParcelPoint(gesture);
      const hold = phase === 'delivered' ? 0 : phase === 'signing' ? 1 - smooth(t, 2.85, 3.15) : 1;
      if (hold) this.hand('R', this.point({ ...parcel, y: parcel.y - .02 }), hold);
    } else if (phase === 'signing') {
      const lean = smooth(t, .1, .8) * (1 - smooth(t, 3.65, 4));
      this.bone('spine').rotation.x += .12 * lean; this.bone('chest').rotation.x += .16 * lean; this.bone('head').rotation.x += .1 * lean;
      root.updateWorldMatrix(true, true);
      const write = smooth(t, 0, 1) * (1 - smooth(t, 2.55, 2.95));
      if (write) {
        const tip = officePenPoint(gesture); const grip = this.point({ ...tip, y: tip.y + .15 });
        this.hand('R', grip, write, true); root.updateWorldMatrix(true, true);
        const actual = root.worldToLocal(this.bone('wrist_R').localToWorld(new THREE.Vector3(.12, -.27, .055)));
        this.pen.position.copy(actual).sub(this.point({ x: 0, y: .15, z: 0 }).sub(this.point({ x: 0, y: 0, z: 0 })));
        this.pen.quaternion.copy(root.getWorldQuaternion(new THREE.Quaternion()).invert()); this.pen.visible = true;
      }
      const receive = smooth(t, 2.65, 3) * (1 - smooth(t, 3.8, 4));
      if (receive) { const parcel = officeParcelPoint(gesture); this.hand('L', this.point({ ...parcel, y: parcel.y - .015 }), receive); }
    } else if (phase === 'briefing') {
      this.bone('head').rotation.x += .055 * smooth(t, 6, 8.5);
    }
  }
  dispose(): void { this.pen.removeFromParent(); this.geometry.dispose(); this.material.dispose(); }
}
