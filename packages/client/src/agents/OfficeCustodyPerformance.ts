import * as THREE from 'three';
import { METACORTEX, OFFICE_CUSTODY_CAR, type OfficeCustody } from '@auto_matrix/shared';
import type { HeroRig } from './HeroModel.js';
import { ARREST_CAR, ARREST_BIKE, arrestCarPoint, arrestBikePoint, arrestPose } from '@auto_matrix/shared';

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
  private hand(rig: HeroRig, side: 'R' | 'L', contact: THREE.Vector3, orientation: THREE.Quaternion, blend: number, curl: number, fingertip?: string): void {
    const upper = rig.bones.get(`shoulder_${side}`)!, lower = rig.bones.get(`elbow_${side}`)!, end = rig.bones.get(`wrist_${side}`)!;
    if (fingertip) for (let finger = 2; finger <= 5; finger++) for (let segment = 1; segment <= 3; segment++) {
      const joint = rig.bones.get(`finger${finger}-${segment}_${side}`)!; joint.rotation.x = 0; joint.rotation.z = 0;
    }
    rig.root.updateWorldMatrix(true, true);
    const palm = fingertip ? end.worldToLocal(rig.bones.get(fingertip)!.getWorldPosition(new THREE.Vector3())) : new THREE.Vector3(side === 'R' ? .065 : -.065, -.17, .01);
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
  private seated(rig: HeroRig, seat: number, duck: number, bike = false): void {
    const bone = (name: string) => rig.bones.get(name)!;
    const pelvis = bone('pelvis'); pelvis.position.copy(rig.rest.get('pelvis')!);
    pelvis.position.y = THREE.MathUtils.lerp(pelvis.position.y, bike ? 2.5 : 1.56, seat) - duck * .4;
    pelvis.rotation.set(0, 0, 0);
    bone('spine').rotation.set(duck * .7 + (bike ? .18 : .02), 0, 0);
    bone('chest').rotation.set(duck * .2 + (bike ? .14 : 0), 0, 0);
    bone('head').rotation.set(-duck * .3 + (bike ? .18 : 0), bike ? -.35 : 0, 0);
    const crouch = Math.acos(1 - .4 * duck / (bone('knee_R').position.length() + bone('ankle_R').position.length())) * (1 - seat);
    for (const side of ['R', 'L']) {
      bone('hip_' + side).rotation.set((bike ? -1.13 : -1.35) * seat - crouch, 0, bike ? (side === 'R' ? -.45 : .45) : 0);
      bone('knee_' + side).rotation.set((bike ? 1.7 : 1.52) * seat + crouch * 2, 0, 0);
      bone('ankle_' + side).rotation.set(-.17 * seat - crouch, 0, 0);
      bone('shoulder_' + side).rotation.set(-.36, 0, side === 'R' ? -.06 : .06); bone('elbow_' + side).rotation.set(-1, 0, 0);
    }
    rig.root.updateWorldMatrix(true, true);
    if (!bike) {
      const car = arrestCarPoint(0, 0); let clearance = Infinity;
      for (const side of ['R', 'L']) {
        const foot = bone('ankle_' + side).getWorldPosition(new THREE.Vector3());
        const dx = foot.x - car.x, dz = foot.z - car.z;
        const x = Math.cos(ARREST_CAR.yaw) * dx - Math.sin(ARREST_CAR.yaw) * dz, z = Math.sin(ARREST_CAR.yaw) * dx + Math.cos(ARREST_CAR.yaw) * dz;
        const floor = Math.abs(x) < 2.75 && Math.abs(z) < 6.8 ? .3 : 0;
        clearance = Math.min(clearance, foot.y - rig.footHeight - floor - .012);
      }
      if (clearance < 0) { pelvis.position.y -= clearance; rig.root.updateWorldMatrix(true, true); }
    }
  }
  update(neo: HeroRig | undefined, catcher: HeroRig | undefined, custody?: OfficeCustody, leader?: HeroRig, front?: HeroRig, trinity?: HeroRig): void {
    if (neo && this.neo !== neo && custody) this.bind(neo);
    this.cuffs.forEach(cuff => { cuff.visible = Boolean(neo && custody && custody.elapsed >= 2.4); });
    if (this.chain) this.chain.visible = Boolean(neo && custody && custody.elapsed >= 2.4);
    if (!neo || !custody) return;
    for (const [role, rig] of [['neo', neo], [custody.catcher, catcher], [custody.leader, leader], [Object.keys(custody.bodies).find(role => role !== custody.leader && role !== custody.catcher)!, front]] as const) {
      const pose = arrestPose(custody, role as 'neo' | OfficeCustody['catcher']);
      if (rig && pose) this.seated(rig, pose.seated, pose.duck);
    }
    if (trinity && custody.watcher) {
      this.seated(trinity, 1, 0, true);
      for (const side of ['R', 'L'] as const) {
        const point = arrestBikePoint(side === 'R' ? .93 : -.93, ARREST_BIKE.handleZ); point.y = 2.94;
        const orientation = trinity.root.getWorldQuaternion(new THREE.Quaternion());
        this.hand(trinity, side, new THREE.Vector3(point.x, point.y, point.z), orientation, 1, .6);
      }
    }
    const blend = THREE.MathUtils.smoothstep(custody.elapsed, .25, 2.7);
    const pelvis = neo.bones.get('pelvis')!;
    for (const side of ['R', 'L'] as const) {
      const point = pelvis.localToWorld(new THREE.Vector3(side === 'R' ? -.25 : .25, -.04, -.42));
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
    if (leader && custody.phase === 'selecting') {
      const age = custody.transportElapsed ?? 0;
      const press = THREE.MathUtils.smoothstep(age, .15, .65) * (1 - THREE.MathUtils.smoothstep(age, 1.1, OFFICE_CUSTODY_CAR.selecting));
      const button = OFFICE_CUSTODY_CAR.button, floor = custody.bodies[custody.leader].position.y - 1;
      const contact = new THREE.Vector3(METACORTEX.center.x + button.x + (age >= .65 && age <= 1.1 ? .015 : 0), floor + button.y, METACORTEX.center.z + button.z);
      const orientation = leader.root.getWorldQuaternion(new THREE.Quaternion());
      this.hand(leader, 'R', contact, orientation, press, 0, 'finger2-3_R');
    }
    if (!catcher) return;
    if (custody.street) {
      if (['opening', 'ready', 'entering'].includes(custody.street.phase)) {
        for (const side of ['R', 'L']) { catcher.bones.get('shoulder_' + side)!.rotation.set(0, 0, 0); catcher.bones.get('elbow_' + side)!.rotation.set(-.15, 0, 0); }
        catcher.root.updateWorldMatrix(true, true);
      }
      if (custody.street.phase === 'entering') {
        const age = custody.street.elapsed;
        const press = THREE.MathUtils.smoothstep(age, .45, 1) * (1 - THREE.MathUtils.smoothstep(age, 1.5, 2.2));
        const contact = neo.bones.get('head')!.localToWorld(new THREE.Vector3(0, .35, -.02));
        const side = ['R', 'L'].sort((a, b) => catcher.bones.get(`shoulder_${a}`)!.getWorldPosition(new THREE.Vector3()).distanceToSquared(contact) - catcher.bones.get(`shoulder_${b}`)!.getWorldPosition(new THREE.Vector3()).distanceToSquared(contact))[0] as 'R' | 'L';
        const x = new THREE.Vector3(side === 'R' ? 1 : -1, 0, 0), y = new THREE.Vector3(0, 0, 1);
        const orientation = new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(x, y, x.clone().cross(y)));
        if (press) this.hand(catcher, side, contact, orientation, press, .12);
      }
      return;
    }
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
