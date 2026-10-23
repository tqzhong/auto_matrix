import * as THREE from 'three';
import { CONSTRUCT, FILM_SETS } from '@auto_matrix/shared';
import type { HeroRig } from './HeroModel.js';
import type { MotionInput } from './CharacterMotion.js';
import { inspectConstructImage } from './ConstructSelfImage.js';

/** The first loading-space lesson: self inspection, leather contact and a held remote. */
export class ConstructPerformance {
  private remote = new THREE.Group();
  constructor(private rig: HeroRig) {
    this.remote.name = 'construct-held-remote'; rig.bones.get('wrist_R')!.add(this.remote);
    this.remote.position.set(.08, -.18, .025);
    const casing = new THREE.Mesh(new THREE.BoxGeometry(.19, .45, .09), new THREE.MeshStandardMaterial({ color: 0x25221c, roughness: .55 }));
    casing.castShadow = true; this.remote.add(casing);
    const buttonMaterial = new THREE.MeshStandardMaterial({ color: 0xafa18a, roughness: .6 });
    for (let i = 0; i < 3; i++) {
      const button = new THREE.Mesh(new THREE.CylinderGeometry(.025, .025, .013, 10), buttonMaterial);
      button.position.set(0, -.12 + i * .09, .053); button.rotation.x = Math.PI / 2; this.remote.add(button);
    }
    this.remote.visible = false;
  }

  update(input: MotionInput): void {
    const arrival = input.construct, lesson = input.reveal;
    this.remote.visible = arrival?.role === 'morpheus' || lesson?.role === 'morpheus';
    if (this.remote.visible) {
      for (let finger = 1; finger <= 5; finger++) for (let segment = 1; segment <= 3; segment++) {
        this.rig.bones.get(`finger${finger}-${segment}_R`)!.rotation.set(finger === 1 ? .35 : 0, 0, finger === 1 ? .2 : segment === 1 ? .4 : .7);
      }
      if (lesson) {
        if (lesson.kind === 'desert') {
          this.seatedFeet();
          this.palm('L', this.rig.root.localToWorld(new THREE.Vector3(1.6, 2.88, 1.2).multiplyScalar(CONSTRUCT.chair.scale)), 1, 'leather');
        }
        const pointing = THREE.MathUtils.smoothstep(lesson.elapsed, .2, 1) * (1 - THREE.MathUtils.smoothstep(lesson.elapsed, 7.5, 9));
        this.palm('R', this.rig.root.localToWorld(new THREE.Vector3(-.4, 2.05, 1.05)), pointing, 'remote');
      }
    }
    if (arrival?.role === 'neo' && arrival.phase === 'image') {
      inspectConstructImage(this.rig, arrival.elapsed);
    }
    if (lesson?.kind !== 'construct' || lesson.role !== 'neo') return;
    const blend = THREE.MathUtils.smoothstep(lesson.elapsed, .65, 1.65) * (1 - THREE.MathUtils.smoothstep(lesson.elapsed, 6.5, 8));
    const center = FILM_SETS.film_white_construct.center;
    for (const [side, u] of [['L', .4], ['R', .96]] as const) {
      // Same domed crown as the shared Lafayette chair, rotated toward the CRT.
      const scale = CONSTRUCT.chair.scale;
      const x = CONSTRUCT.chairX.neo + u * (1.56 + .22 * Math.sin(Math.PI * .85)) * scale;
      const y = (1.45 + 3.5 + .4 * (1 - u * u)) * scale;
      const z = CONSTRUCT.chair.z + (.94 + .55 - .62 * u ** 4 * Math.sin(Math.PI * .9)) * scale;
      this.palm(side, new THREE.Vector3(center.x + x, center.y - 1 + y + .025, center.z + z), blend, 'leather');
    }
  }

  private seatedFeet(): void {
    const bones = this.rig.bones; this.rig.root.updateWorldMatrix(true, true);
    const left = this.rig.root.worldToLocal(bones.get('ankle_L')!.getWorldPosition(new THREE.Vector3()));
    for (const side of ['L', 'R']) {
      const hip = bones.get(`hip_${side}`)!, knee = bones.get(`knee_${side}`)!, ankle = bones.get(`ankle_${side}`)!;
      const target = this.rig.root.worldToLocal(ankle.getWorldPosition(new THREE.Vector3()));
      if (side === 'R') target.set(left.x + .16, .62, left.z - .15);
      else target.y = this.rig.footHeight + .025;
      this.rig.root.localToWorld(target);
      const orientation = ankle.getWorldQuaternion(new THREE.Quaternion());
      const start = hip.getWorldPosition(new THREE.Vector3()), direction = target.clone().sub(start);
      const a = knee.position.length(), b = ankle.position.length(), reach = THREE.MathUtils.clamp(direction.length(), .02, a + b - .001);
      direction.normalize(); target.copy(start).addScaledVector(direction, reach);
      const along = (a * a - b * b + reach * reach) / (2 * reach);
      const pole = new THREE.Vector3(0, side === 'R' ? .8 : 0, 1).applyQuaternion(this.rig.root.getWorldQuaternion(new THREE.Quaternion()));
      pole.addScaledVector(direction, -pole.dot(direction)).normalize();
      const hinge = start.clone().addScaledVector(direction, along).addScaledVector(pole, Math.sqrt(Math.max(0, a * a - along * along)));
      hip.quaternion.setFromUnitVectors(knee.position.clone().normalize(), hip.parent!.worldToLocal(hinge.clone()).sub(hip.position).normalize());
      hip.updateWorldMatrix(false, true);
      knee.quaternion.setFromUnitVectors(ankle.position.clone().normalize(), knee.parent!.worldToLocal(target.clone()).sub(knee.position).normalize());
      knee.updateWorldMatrix(false, true);
      ankle.quaternion.copy(knee.getWorldQuaternion(new THREE.Quaternion()).invert().multiply(orientation));
      ankle.updateWorldMatrix(false, true);
    }
  }

  private palm(side: 'L' | 'R', point: THREE.Vector3, blend: number, kind: 'leather' | 'remote'): void {
    if (!blend) return;
    const bones = this.rig.bones, shoulder = bones.get(`shoulder_${side}`)!, elbow = bones.get(`elbow_${side}`)!, wrist = bones.get(`wrist_${side}`)!;
    this.rig.root.updateWorldMatrix(true, true);
    const root = this.rig.root.getWorldQuaternion(new THREE.Quaternion());
    const desired = root.clone().multiply(new THREE.Quaternion().setFromEuler(kind === 'remote'
      ? new THREE.Euler(-Math.PI / 2, 0, 0) : new THREE.Euler(-.7, 0, side === 'R' ? -Math.PI / 2 : Math.PI / 2)));
    const orientation = wrist.getWorldQuaternion(new THREE.Quaternion()).slerp(desired, blend);
    const palm = new THREE.Vector3(side === 'R' ? .09 : -.09, -.18, .02);
    const target = wrist.localToWorld(palm.clone()).lerp(point, blend).sub(palm.applyQuaternion(orientation));
    const start = shoulder.getWorldPosition(new THREE.Vector3()), direction = target.clone().sub(start);
    const a = elbow.position.length(), b = wrist.position.length(), reach = THREE.MathUtils.clamp(direction.length(), .02, a + b - .001);
    direction.normalize(); target.copy(start).addScaledVector(direction, reach);
    const along = (a * a - b * b + reach * reach) / (2 * reach);
    const pole = new THREE.Vector3(side === 'R' ? -.5 : .5, -.8, -.4).applyQuaternion(root);
    pole.addScaledVector(direction, -pole.dot(direction)).normalize();
    const hinge = start.clone().addScaledVector(direction, along).addScaledVector(pole, Math.sqrt(Math.max(0, a * a - along * along)));
    const aim = (joint: THREE.Bone, child: THREE.Bone, end: THREE.Vector3) => {
      joint.quaternion.setFromUnitVectors(child.position.clone().normalize(), joint.parent!.worldToLocal(end.clone()).sub(joint.position).normalize());
      joint.updateWorldMatrix(false, true);
    };
    aim(shoulder, elbow, hinge); aim(elbow, wrist, target);
    wrist.quaternion.copy(elbow.getWorldQuaternion(new THREE.Quaternion()).invert().multiply(orientation));
    if (kind !== 'remote') for (let finger = 1; finger <= 5; finger++) for (let segment = 1; segment <= 3; segment++) {
      const joint = bones.get(`finger${finger}-${segment}_${side}`)!;
      joint.rotation.z = THREE.MathUtils.lerp(joint.rotation.z, side === 'R' ? .1 : -.1, blend);
    }
    wrist.updateWorldMatrix(false, true);
  }

  dispose(): void {
    const materials = new Set<THREE.Material>();
    this.remote.traverse(object => { if (object instanceof THREE.Mesh) { object.geometry.dispose(); materials.add(object.material); } });
    materials.forEach(material => material.dispose()); this.remote.removeFromParent();
  }
}
