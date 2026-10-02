import * as THREE from 'three';
import type { OfficeCustody } from '@auto_matrix/shared';
import type { HeroRig } from './HeroModel.js';

/** Uses the displayed skeletons for cuff placement and upper-arm contact. */
export class OfficeCustodyPerformance {
  private neo?: HeroRig;
  private cuffs: THREE.Mesh[] = [];
  private chain?: THREE.Group;
  private geometries = new Set<THREE.BufferGeometry>();
  private material = new THREE.MeshStandardMaterial({ color: 0x87918d, metalness: .86, roughness: .26 });
  private geometry(geometry: THREE.BufferGeometry) { this.geometries.add(geometry); return geometry; }
  private bind(neo: HeroRig): void {
    this.release(); this.neo = neo;
    const ring = this.geometry(new THREE.TorusGeometry(.105, .012, 8, 28));
    for (const side of ['R', 'L']) {
      const cuff = new THREE.Mesh(ring, this.material); cuff.name = `office-cuff-${side}`;
      cuff.rotation.x = Math.PI / 2; cuff.position.y = -.065; cuff.castShadow = true;
      neo.bones.get(`wrist_${side}`)!.add(cuff); this.cuffs.push(cuff);
    }
    this.chain = new THREE.Group(); this.chain.name = 'office-cuff-chain'; neo.root.add(this.chain);
    const link = this.geometry(new THREE.TorusGeometry(.032, .008, 6, 14));
    for (let i = 0; i < 6; i++) { const mesh = new THREE.Mesh(link, this.material); mesh.castShadow = true; this.chain.add(mesh); }
  }
  private hand(rig: HeroRig, side: 'R' | 'L', contact: THREE.Vector3, orientation: THREE.Quaternion, blend: number, curl: number): void {
    const upper = rig.bones.get(`shoulder_${side}`)!, lower = rig.bones.get(`elbow_${side}`)!, end = rig.bones.get(`wrist_${side}`)!;
    rig.root.updateWorldMatrix(true, true);
    const palm = new THREE.Vector3(side === 'R' ? .065 : -.065, -.17, .01);
    const rotation = end.getWorldQuaternion(new THREE.Quaternion()).slerp(orientation, blend);
    const target = end.localToWorld(palm.clone()).lerp(contact, blend).sub(palm.clone().applyQuaternion(rotation));
    const start = upper.getWorldPosition(new THREE.Vector3()), direction = target.clone().sub(start);
    const a = lower.position.length(), b = end.position.length();
    const reach = THREE.MathUtils.clamp(direction.length(), .02, a + b - .001); direction.normalize();
    const along = (a * a - b * b + reach * reach) / (2 * reach);
    const pole = new THREE.Vector3(side === 'L' ? .7 : -.7, -.6, -1).applyQuaternion(rig.root.getWorldQuaternion(new THREE.Quaternion()));
    pole.addScaledVector(direction, -pole.dot(direction)).normalize();
    const hinge = start.clone().addScaledVector(direction, along).addScaledVector(pole, Math.sqrt(Math.max(0, a * a - along * along)));
    const aim = (joint: THREE.Bone, child: THREE.Bone, point: THREE.Vector3) => {
      joint.quaternion.setFromUnitVectors(child.position.clone().normalize(), joint.parent!.worldToLocal(point.clone()).sub(joint.position).normalize());
      joint.updateWorldMatrix(false, true);
    };
    aim(upper, lower, hinge); aim(lower, end, start.addScaledVector(direction, reach));
    end.quaternion.copy(lower.getWorldQuaternion(new THREE.Quaternion()).invert().multiply(rotation));
    for (let finger = 1; finger <= 5; finger++) for (let segment = 1; segment <= 3; segment++) {
      const joint = rig.bones.get(`finger${finger}-${segment}_${side}`)!;
      joint.rotation.x = finger === 1 ? .22 * blend : 0;
      joint.rotation.z = THREE.MathUtils.lerp(joint.rotation.z, (side === 'R' ? 1 : -1) * (finger === 1 ? .13 : curl), blend);
    }
    rig.root.updateWorldMatrix(true, true);
  }
  update(neo: HeroRig | undefined, catcher: HeroRig | undefined, custody?: OfficeCustody): void {
    if (neo && this.neo !== neo && custody) this.bind(neo);
    this.cuffs.forEach(cuff => { cuff.visible = Boolean(neo && custody && custody.elapsed >= 2.4); });
    if (this.chain) this.chain.visible = Boolean(neo && custody && custody.elapsed >= 2.4);
    if (!neo || !custody) return;
    const blend = THREE.MathUtils.smoothstep(custody.elapsed, .25, 2.7);
    const pelvis = neo.bones.get('pelvis')!;
    for (const side of ['R', 'L'] as const) {
      const point = pelvis.localToWorld(new THREE.Vector3(side === 'R' ? -.15 : .15, -.04, -.42));
      const orientation = neo.root.getWorldQuaternion(new THREE.Quaternion()).multiply(new THREE.Quaternion().setFromEuler(new THREE.Euler(.15, 0, side === 'R' ? -Math.PI / 2 : Math.PI / 2)));
      this.hand(neo, side, point, orientation, blend, .32);
    }
    if (this.chain) {
      const points = ['R', 'L'].map(side => neo.root.worldToLocal(neo.bones.get(`wrist_${side}`)!.localToWorld(new THREE.Vector3(0, -.065, 0))));
      const direction = points[1].clone().sub(points[0]), length = direction.length(); direction.normalize();
      this.chain.visible &&= length < .52;
      this.chain.children.forEach((link, i) => {
        link.position.copy(points[0]).lerp(points[1], (i + .5) / 6);
        link.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction);
        if (i % 2) link.rotateY(Math.PI / 2);
      });
    }
    if (!catcher) return;
    const side = ['R', 'L'].sort((a, b) => neo.bones.get(`elbow_${a}`)!.getWorldPosition(new THREE.Vector3()).distanceToSquared(catcher.root.getWorldPosition(new THREE.Vector3()))
      - neo.bones.get(`elbow_${b}`)!.getWorldPosition(new THREE.Vector3()).distanceToSquared(catcher.root.getWorldPosition(new THREE.Vector3())))[0];
    const upper = neo.bones.get(`shoulder_${side}`)!.getWorldPosition(new THREE.Vector3()), elbow = neo.bones.get(`elbow_${side}`)!.getWorldPosition(new THREE.Vector3());
    const center = upper.lerp(elbow, .65), axis = elbow.clone().sub(neo.bones.get(`shoulder_${side}`)!.getWorldPosition(new THREE.Vector3())).normalize();
    const normal = catcher.root.getWorldPosition(new THREE.Vector3()).sub(center); normal.addScaledVector(axis, -normal.dot(axis)).normalize();
    const contact = center.clone().addScaledVector(normal, .14);
    const handSide = ['R', 'L'].sort((a, b) => catcher.bones.get(`shoulder_${a}`)!.getWorldPosition(new THREE.Vector3()).distanceToSquared(contact)
      - catcher.bones.get(`shoulder_${b}`)!.getWorldPosition(new THREE.Vector3()).distanceToSquared(contact))[0] as 'R' | 'L';
    const x = normal.clone().multiplyScalar(handSide === 'R' ? 1 : -1), y = axis.clone().negate();
    const rotation = new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(x, y, x.clone().cross(y)));
    const shoulder = catcher.bones.get(`shoulder_${handSide}`)!, lower = catcher.bones.get(`elbow_${handSide}`)!, wrist = catcher.bones.get(`wrist_${handSide}`)!;
    const reach = shoulder.getWorldPosition(new THREE.Vector3()).distanceTo(contact);
    const grip = THREE.MathUtils.smoothstep(custody.elapsed, .1, .7) * THREE.MathUtils.clamp((lower.position.length() + wrist.position.length() + .08 - reach) / .22, 0, 1);
    if (grip) this.hand(catcher, handSide, contact, rotation, grip, .38);
  }
  private release(): void {
    this.cuffs.forEach(cuff => cuff.removeFromParent()); this.cuffs = [];
    this.chain?.removeFromParent(); this.chain = undefined;
    this.geometries.forEach(geometry => geometry.dispose()); this.geometries.clear(); this.neo = undefined;
  }
  dispose(): void { this.release(); this.material.dispose(); }
}
