import * as THREE from 'three';
import { CONSTRUCT } from '@auto_matrix/shared';
import type { HeroRig } from './HeroModel.js';
import type { MotionInput } from './CharacterMotion.js';
import { inspectConstructImage } from './ConstructSelfImage.js';
import { supportedHand, touchConstructChair } from './ConstructChairContact.js';
import type { FightingHands } from './FightingHands.js';
import { ConstructRemoteGrip } from './ConstructRemoteGrip.js';
import { reach } from './SpoonPerformance.js';

/** The first loading-space lesson: self inspection, leather contact and a held remote. */
export class ConstructPerformance {
  private remote = new THREE.Group();
  private remoteGrip: ConstructRemoteGrip;
  constructor(private rig: HeroRig, hands?: FightingHands) {
    this.remoteGrip = new ConstructRemoteGrip(rig, hands);
    this.remote.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(new THREE.Vector3(0,-1,0),new THREE.Vector3(0,0,-1),new THREE.Vector3(1,0,0))).premultiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0,0,1),85*Math.PI/180));
    this.remote.name = 'construct-held-remote'; rig.bones.get('wrist_R')!.add(this.remote);
    this.remote.position.set(.244, -.31, 0);
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
      this.remoteGrip.update();
      if (lesson) {
        if (lesson.kind === 'desert') {
          this.seatedFeet();
          supportedHand(this.rig, 'L', this.rig.root.localToWorld(new THREE.Vector3(1.6, 3.04, 1).multiplyScalar(CONSTRUCT.chair.scale)), new THREE.Vector3(0, -1, 0), 1, new THREE.Vector3(-1.2, -1, 1));
        }
        const desert = lesson.kind === 'desert';
        const pointing = THREE.MathUtils.smoothstep(lesson.elapsed, desert ? 1.3 : .2, desert ? 2.8 : 1)
          * (1 - THREE.MathUtils.smoothstep(lesson.elapsed, desert ? 9.5 : 7.5, desert ? 11.2 : 9));
        this.raiseRemote(pointing, desert);
      }
    }
    if (arrival?.role === 'neo' && arrival.phase === 'image') {
      inspectConstructImage(this.rig, arrival.elapsed);
    }
    if (lesson?.kind !== 'construct' || lesson.role !== 'neo') return;
    touchConstructChair(this.rig, lesson.elapsed);
  }

  private raiseRemote(amount: number, desert = false): void {
    if (!amount && !desert) return;
    const bones = this.rig.bones, shoulder = bones.get('shoulder_R')!, elbow = bones.get('elbow_R')!, wrist = bones.get('wrist_R')!;
    const before = [shoulder.quaternion.clone(), elbow.quaternion.clone(), wrist.quaternion.clone()];
    this.rig.root.updateWorldMatrix(true, true);
    const root = this.rig.root.getWorldQuaternion(new THREE.Quaternion());
    if (desert) {
      // A free prop follows the neutral forearm. Independently rotating the hand
      // twists it into the cuff; forcing that twist into the elbow folds the sleeve.
      const point = this.rig.root.localToWorld(new THREE.Vector3(-1.05, 2.25 + .1 * amount, .9 + .1 * amount));
      reach(shoulder, elbow, wrist.position, point, new THREE.Vector3(-1, -1, -1).applyQuaternion(root));
      wrist.quaternion.identity();
    } else {
      const orientation = root.clone().multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), Math.PI / 2));
      const point = this.rig.root.localToWorld(new THREE.Vector3(-.65, 2.05, .7));
      reach(shoulder, elbow, wrist.position, point, new THREE.Vector3(-1, -.15, .8).applyQuaternion(root));
      wrist.quaternion.copy(elbow.getWorldQuaternion(new THREE.Quaternion()).invert().multiply(orientation));
    }
    const target = [shoulder.quaternion.clone(), elbow.quaternion.clone(), wrist.quaternion.clone()];
    for (const [i, joint] of [shoulder, elbow, wrist].entries()) joint.quaternion.copy(before[i]).slerp(target[i], desert ? 1 : amount);
    shoulder.updateWorldMatrix(true, true);
  }

  private seatedFeet(): void {
    const bones = this.rig.bones; this.rig.root.updateWorldMatrix(true, true);
    for (const side of ['L', 'R']) {
      const hip = bones.get(`hip_${side}`)!, knee = bones.get(`knee_${side}`)!, ankle = bones.get(`ankle_${side}`)!;
      const target = this.rig.root.worldToLocal(ankle.getWorldPosition(new THREE.Vector3()));
      // The calf rests above the opposite thigh; the planted boot clears the apron.
      if (side === 'R') target.set(.65, 2, .85);
      else { target.y = this.rig.footHeight + .025; target.z = 1.35; }
      this.rig.root.localToWorld(target);
      const orientation = ankle.getWorldQuaternion(new THREE.Quaternion());
      const start = hip.getWorldPosition(new THREE.Vector3()), direction = target.clone().sub(start);
      const a = knee.position.length(), b = ankle.position.length(), reach = THREE.MathUtils.clamp(direction.length(), .02, a + b - .001);
      direction.normalize(); target.copy(start).addScaledVector(direction, reach);
      const along = (a * a - b * b + reach * reach) / (2 * reach);
      const pole = new THREE.Vector3(side === 'R' ? -1 : 0, 0, 1).applyQuaternion(this.rig.root.getWorldQuaternion(new THREE.Quaternion()));
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

  dispose(): void {
    const materials = new Set<THREE.Material>();
    this.remote.traverse(object => { if (object instanceof THREE.Mesh) { object.geometry.dispose(); materials.add(object.material); } });
    materials.forEach(material => material.dispose()); this.remote.removeFromParent();
  }
}
