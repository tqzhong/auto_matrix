import * as THREE from 'three';
import { jumpImpactPose, jumpStreetDisplacement, type TrainingGesture } from '@auto_matrix/shared';
import type { HeroRig } from './HeroModel.js';
import type { FightingHands } from './FightingHands.js';

export class JumpPerformance {
  private material = new THREE.MeshStandardMaterial({ color: 0x781b16, roughness: .35 });
  private mouth = new THREE.Mesh(new THREE.SphereGeometry(.014, 12, 8), this.material);
  private thumb = new THREE.Mesh(new THREE.SphereGeometry(.009, 12, 8), this.material);
  private contacts: { mesh: THREE.SkinnedMesh; indices: number[] }[] = [];
  private lip = new THREE.Vector3();
  private lipNormal = new THREE.Vector3();
  private thumbPad = new THREE.Vector3();
  private thumbNormal = new THREE.Vector3();
  constructor(private rig: HeroRig, private hands?: FightingHands) {
    this.mouth.name = 'jump-mouth-blood'; this.mouth.scale.set(.75, .3, .12);
    const skin = rig.root.getObjectByName('Anatomical_head_and_hands') as THREE.SkinnedMesh, a = skin.geometry.attributes, index = skin.geometry.index!;
    const head = skin.skeleton.bones.indexOf(rig.bones.get('head')!), thumb = skin.skeleton.bones.indexOf(rig.bones.get('finger1-3_R')!);
    const headSpace = skin.skeleton.boneInverses[head].clone().multiply(skin.bindMatrix);
    // Locate the lower right lip on the delivered face, not the older head's joint-space estimate.
    const ray = new THREE.Ray(new THREE.Vector3(-.065, 3.94, 2), new THREE.Vector3(0, 0, -1)), point = new THREE.Vector3(); let front = -Infinity;
    for (let f = 0; f < index.count; f += 3) {
      const ids = [0, 1, 2].map(k => index.getX(f + k));
      if (!ids.every(i => [0, 1, 2, 3].some(k => a.skinIndex.getComponent(i, k) === head && a.skinWeight.getComponent(i, k) > .5))) continue;
      const triangle = new THREE.Triangle(...ids.map(i => new THREE.Vector3().fromBufferAttribute(a.position, i)) as [THREE.Vector3, THREE.Vector3, THREE.Vector3]);
      if (ray.intersectTriangle(triangle.a, triangle.b, triangle.c, false, point) && point.z > front) {
        front = point.z; this.lip.copy(point).applyMatrix4(headSpace); triangle.getNormal(this.lipNormal).transformDirection(headSpace);
      }
    }
    this.mouth.position.copy(this.lip).addScaledVector(this.lipNormal, .002);
    this.mouth.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), this.lipNormal);
    const thumbSpace = skin.skeleton.boneInverses[thumb].clone().multiply(skin.bindMatrix), normalMatrix = new THREE.Matrix3().getNormalMatrix(thumbSpace);
    const padHint = new THREE.Vector3(.059, -.045, .004); let closest = Infinity;
    for (let i = 0; i < a.position.count; i++) if ([0, 1, 2, 3].some(k => a.skinIndex.getComponent(i, k) === thumb && a.skinWeight.getComponent(i, k) > .999)) {
      const point = new THREE.Vector3().fromBufferAttribute(a.position, i).applyMatrix4(thumbSpace), distance = point.distanceToSquared(padHint);
      if (distance < closest) { closest = distance; this.thumbPad.copy(point); this.thumbNormal.fromBufferAttribute(a.normal, i).applyNormalMatrix(normalMatrix); }
    }
    // A stain attaches to a material point, even if a save loads after contact.
    this.thumb.name = 'jump-thumb-blood'; this.thumb.position.copy(this.thumbPad).addScaledVector(this.thumbNormal, .0012);
    this.thumb.scale.set(.7, .45, .12); this.thumb.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), this.thumbNormal);
    rig.bones.get('head')!.add(this.mouth); rig.bones.get('finger1-3_R')!.add(this.thumb);
    this.mouth.visible = this.thumb.visible = false;
    rig.root.traverse(object => {
      if (!(object instanceof THREE.SkinnedMesh)) return;
      const positions = object.geometry.attributes.position, indices: number[] = [];
      for (let i = 0; i < positions.count; i += Math.max(1, Math.floor(positions.count / 160))) indices.push(i);
      for (const axis of ['getX', 'getY', 'getZ'] as const) {
        let low = 0, high = 0;
        for (let i = 1; i < positions.count; i++) { if (positions[axis](i) < positions[axis](low)) low = i; if (positions[axis](i) > positions[axis](high)) high = i; }
        indices.push(low, high);
      }
      const joints = object.geometry.attributes.skinIndex, weights = object.geometry.attributes.skinWeight;
      this.contacts.push({ mesh: object, indices: [...new Set(indices)].filter(i => ![0, 1, 2, 3].some(n => weights.getComponent(i, n) > .2
        && /^(shoulder|elbow|forearm_twist|wrist|finger)/.test(object.skeleton.bones[joints.getComponent(i, n)].name))) });
    });
  }
  pose(gesture: TrainingGesture | undefined): void {
    this.mouth.visible = gesture?.kind === 'jump_return' && gesture.elapsed >= 3.2;
    this.thumb.visible = gesture?.kind === 'jump_return' && gesture.elapsed >= 4.3;
    if (!gesture || gesture.role !== 'neo') return;
    const bone = (name: string) => this.rig.bones.get(name)!;
    if (gesture.kind === 'jump_fall') {
      const fall = jumpImpactPose(gesture.fall!, gesture.elapsed), p = fall.prone;
      bone('pelvis').rotation.set(Math.PI / 2 * p, 0, 0);
      bone('pelvis').position.y = THREE.MathUtils.lerp(this.rig.rest.get('pelvis')!.y, .5, p);
      bone('spine').rotation.set(0, 0, 0); bone('chest').rotation.set(0, 0, 0);
      bone('head').rotation.set(Math.sin(gesture.elapsed * 7) * .12 * (1 - p), .25 * p, .45 * p);
      for (const [i, side] of ['R', 'L'].entries()) {
        const wave = gesture.elapsed * 10 + i * Math.PI;
        bone('shoulder_' + side).rotation.set((-.95 - Math.sin(wave) * .65) * (1 - p) - .25 * p, 0, (i ? 1 : -1) * (.75 + Math.cos(wave) * .2 * (1 - p)));
        bone('elbow_' + side).rotation.x = (-.7 - Math.cos(wave) * .4) * (1 - p) - .25 * p;
        bone('hip_' + side).rotation.x += Math.sin(wave * .7) * .3 * (1 - p);
        bone('knee_' + side).rotation.x += (.3 + Math.cos(wave * .7) * .2) * (1 - p);
        bone('hip_' + side).rotation.x *= 1 - p; bone('knee_' + side).rotation.x *= 1 - p; bone('ankle_' + side).rotation.x *= 1 - p;
        for (let f = 1; f <= 5; f++) for (let s = 1; s <= 3; s++) bone(`finger${f}-${s}_${side}`).rotation.set(0, 0, 0);
      }
      for (const panel of this.rig.panels) panel.mesh.visible = false;
      if (p > .98) {
        this.rig.root.updateWorldMatrix(true, true); let lowest = Infinity;
        for (const { mesh, indices } of this.contacts) {
          if (!mesh.visible) continue; mesh.skeleton.update();
          for (const i of indices) {
            const point = this.rig.root.worldToLocal(mesh.localToWorld(mesh.getVertexPosition(i, new THREE.Vector3())));
            const offset = new THREE.Vector3(point.x, 0, point.z).applyQuaternion(this.rig.root.getWorldQuaternion(new THREE.Quaternion()));
            const surface = jumpStreetDisplacement(offset.x, offset.z, fall.depression) - fall.depression;
            lowest = Math.min(lowest, point.y - surface);
          }
        }
        bone('pelvis').position.y -= lowest; this.rig.root.updateWorldMatrix(true, true);
        this.placePalm('R', fall.depression); this.placePalm('L', fall.depression);
      }
    } else if (gesture.kind === 'jump_return') {
      const t = gesture.elapsed, wipe = THREE.MathUtils.smoothstep(t, 2.9, 4.1) * (1 - THREE.MathUtils.smoothstep(t, 7.2, 8.4));
      const inspect = THREE.MathUtils.smoothstep(t, 5.1, 5.8);
      bone('head').rotation.x += (.08 + .14 * inspect) * wipe;
      this.hands?.pose('R', .55 * wipe, true);
      for (let s = 1; s <= 3; s++) bone(`finger1-${s}_R`).quaternion.slerp(new THREE.Quaternion(), wipe);
      if (wipe > 0) this.touchMouth(wipe, inspect);
    }
  }
  private placePalm(side: 'R' | 'L', depth: number): void {
    const root = this.rig.root, bone = (name: string) => this.rig.bones.get(name)!;
    root.updateWorldMatrix(true, true);
    const rootRotation = root.getWorldQuaternion(new THREE.Quaternion()), sign = side === 'R' ? -1 : 1;
    const x = sign * .95, z = 1.15, y = .155 + jumpStreetDisplacement(x, z, depth) - depth;
    const contact = root.localToWorld(new THREE.Vector3(x, y, z));
    const normal = new THREE.Vector3(0, side === 'R' ? -1 : 1, 0), fingers = new THREE.Vector3(0, 0, -1);
    const orientation = rootRotation.clone().multiply(new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(normal, fingers, normal.clone().cross(fingers))));
    const offset = new THREE.Vector3(side === 'R' ? .082 : -.082, -.18, .015).applyQuaternion(orientation);
    const target = contact.sub(offset), shoulder = bone('shoulder_' + side), elbow = bone('elbow_' + side), wrist = bone('wrist_' + side);
    const start = shoulder.getWorldPosition(new THREE.Vector3()), direction = target.clone().sub(start);
    const a = elbow.position.length(), b = wrist.position.length(), reach = Math.min(direction.length(), a + b - .001); direction.normalize();
    target.copy(start).addScaledVector(direction, reach);
    const along = (a * a - b * b + reach * reach) / (2 * reach), pole = new THREE.Vector3(sign, 1.5, 0).applyQuaternion(rootRotation);
    pole.addScaledVector(direction, -pole.dot(direction)).normalize();
    const hinge = start.clone().addScaledVector(direction, along).addScaledVector(pole, Math.sqrt(Math.max(0, a * a - along * along)));
    const aim = (joint: THREE.Bone, child: THREE.Bone, point: THREE.Vector3) => {
      joint.quaternion.setFromUnitVectors(child.position.clone().normalize(), joint.parent!.worldToLocal(point.clone()).sub(joint.position).normalize()); joint.updateWorldMatrix(false, true);
    };
    aim(shoulder, elbow, hinge); aim(elbow, wrist, target);
    wrist.quaternion.copy(elbow.getWorldQuaternion(new THREE.Quaternion()).invert().multiply(orientation)); wrist.updateWorldMatrix(false, true);
  }
  private touchMouth(blend: number, inspect: number): void {
    const root = this.rig.root, bone = (name: string) => this.rig.bones.get(name)!;
    root.updateWorldMatrix(true, true);
    const shoulder = bone('shoulder_R'), elbow = bone('elbow_R'), wrist = bone('wrist_R'), finger = bone('finger1-3_R');
    const headRotation = bone('head').getWorldQuaternion(new THREE.Quaternion());
    const orientation = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0).applyQuaternion(headRotation), 1.1 * blend)
      .multiply(wrist.getWorldQuaternion(new THREE.Quaternion()));
    wrist.quaternion.copy(elbow.getWorldQuaternion(new THREE.Quaternion()).invert().multiply(orientation)); wrist.updateWorldMatrix(false, true);
    const normal = this.lipNormal.clone().applyQuaternion(headRotation);
    const pad = this.thumbPad, initial = finger.localToWorld(pad.clone());
    const mouth = bone('head').localToWorld(this.lip.clone()).addScaledVector(normal, .003);
    const inspectPoint = bone('head').localToWorld(new THREE.Vector3(-.12, -.3, .78));
    initial.lerp(mouth.lerp(inspectPoint, inspect), blend);
    for (let i = 0; i < 3; i++) {
      const target = initial.clone().add(wrist.getWorldPosition(new THREE.Vector3())).sub(finger.localToWorld(pad.clone()));
      const start = shoulder.getWorldPosition(new THREE.Vector3()), direction = target.clone().sub(start);
      const a = elbow.position.length(), b = wrist.position.length(), reach = Math.min(direction.length(), a + b - .001); direction.normalize();
      target.copy(start).addScaledVector(direction, reach);
      const along = (a * a - b * b + reach * reach) / (2 * reach);
      const pole = new THREE.Vector3(-.2, -1, .3).applyQuaternion(root.getWorldQuaternion(new THREE.Quaternion()));
      pole.addScaledVector(direction, -pole.dot(direction)).normalize();
      const hinge = start.clone().addScaledVector(direction, along).addScaledVector(pole, Math.sqrt(Math.max(0, a * a - along * along)));
      const aim = (joint: THREE.Bone, child: THREE.Bone, point: THREE.Vector3) => {
        joint.quaternion.setFromUnitVectors(child.position.clone().normalize(), joint.parent!.worldToLocal(point.clone()).sub(joint.position).normalize()); joint.updateWorldMatrix(false, true);
      };
      aim(shoulder, elbow, hinge); aim(elbow, wrist, target);
      wrist.quaternion.copy(elbow.getWorldQuaternion(new THREE.Quaternion()).invert().multiply(orientation)); wrist.updateWorldMatrix(false, true);
    }
  }
  dispose(): void { this.mouth.removeFromParent(); this.thumb.removeFromParent(); this.mouth.geometry.dispose(); this.thumb.geometry.dispose(); this.material.dispose(); }
}
