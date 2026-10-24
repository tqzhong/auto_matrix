import * as THREE from 'three';
import { redDressFrame, type TrainingGesture } from '@auto_matrix/shared';
import type { HeroRig } from './HeroModel.js';
import type { FightingHands } from './FightingHands.js';
import { reach } from './SpoonPerformance.js';

/** The guide indicates the mind with two fingers, then returns to the lesson. */
export class RedDressPerformance {
  private temple = new THREE.Vector3();
  private tip = new THREE.Vector3();
  private fingers: THREE.Quaternion[][];

  constructor(private rig: HeroRig, private hands?: FightingHands) {
    const skin = rig.root.getObjectByName('Anatomical_head_and_hands') as THREE.SkinnedMesh;
    const a = skin.geometry.attributes, index = skin.geometry.index!, head = rig.bones.get('head')!;
    const headIndex = skin.skeleton.bones.indexOf(head), space = skin.skeleton.boneInverses[headIndex].clone().multiply(skin.bindMatrix);
    const eye = head.userData.cameraEye as THREE.Vector3;
    const ray = new THREE.Ray(new THREE.Vector3(-1, eye.y + .065, .055), new THREE.Vector3(1, 0, 0));
    let nearest = Infinity; const hit = new THREE.Vector3();
    for (let face = 0; face < index.count; face += 3) {
      const ids = [0, 1, 2].map(k => index.getX(face + k));
      if (!ids.every(id => [0, 1, 2, 3].some(k => a.skinIndex.getComponent(id, k) === headIndex && a.skinWeight.getComponent(id, k) > .5))) continue;
      const p = ids.map(id => new THREE.Vector3().fromBufferAttribute(a.position, id).applyMatrix4(space));
      if (ray.intersectTriangle(p[0], p[1], p[2], false, hit) && hit.x < nearest) { nearest = hit.x; this.temple.copy(hit); }
    }
    // Distal joints have no end bone. Keep the original segment lengths and
    // infer their direction from the delivered fingertip surface.
    this.fingers = [2, 3, 4, 5].map(digit => {
      const distal = skin.skeleton.bones.indexOf(rig.bones.get(`finger${digit}-3_R`)!);
      const local = skin.skeleton.boneInverses[distal].clone().multiply(skin.bindMatrix), tip = new THREE.Vector3(); let count = 0;
      for (let id = 0; id < a.position.count; id++) if ([0, 1, 2, 3].some(k => a.skinIndex.getComponent(id, k) === distal && a.skinWeight.getComponent(id, k) > .95)) {
        tip.add(new THREE.Vector3().fromBufferAttribute(a.position, id).applyMatrix4(local)); count++;
      }
      tip.divideScalar(count); if (digit === 2) this.tip.copy(tip);
      const parent = new THREE.Quaternion();
      return [rig.rest.get(`finger${digit}-2_R`)!, rig.rest.get(`finger${digit}-3_R`)!, tip].map((axis, joint) => {
        // Keep adjacent knuckles aligned; fold only the ring/little phalanges
        // so the shared web does not buckle between a straight and curled MCP.
        const bend = digit < 4 ? 0 : [0, Math.PI / 2, 2.8][joint];
        const rotation = new THREE.Quaternion().setFromUnitVectors(axis.clone().normalize(), new THREE.Vector3(Math.sin(bend), -Math.cos(bend), 0));
        const result = parent.clone().invert().multiply(rotation); parent.copy(rotation); return result;
      });
    });
  }

  update(gesture?: TrainingGesture): void {
    if (gesture?.kind !== 'red_dress' || gesture.role !== 'morpheus' || !gesture.attention) return;
    const time = redDressFrame(gesture), smooth = THREE.MathUtils.smoothstep;
    const raised = smooth(time, .4, 1.6) * (1 - smooth(time, 2.6, 4.1));
    const bone = (name: string) => this.rig.bones.get(name)!, root = this.rig.root;
    bone('head').rotation.y -= .38 * smooth(time, 4.1, 5.3);
    bone('shoulder_R').rotation.z -= .16;
    if (!raised) return;
    this.hands?.pose('R', .55 * raised, true);
    bone('finger1-1_R').quaternion.slerp(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), -1.2), raised);
    for (const [d, digit] of [2, 3, 4, 5].entries()) for (let joint = 1; joint <= 3; joint++)
      bone(`finger${digit}-${joint}_R`).quaternion.slerp(this.fingers[d][joint - 1], raised);
    root.updateWorldMatrix(true, true);
    const shoulder = bone('shoulder_R'), elbow = bone('elbow_R'), wrist = bone('wrist_R'), finger = bone('finger2-3_R');
    const before = [shoulder.quaternion.clone(), elbow.quaternion.clone(), wrist.quaternion.clone()];
    const orientation = bone('head').getWorldQuaternion(new THREE.Quaternion())
      .multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), Math.PI))
      .multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), -.4));
    wrist.quaternion.copy(elbow.getWorldQuaternion(new THREE.Quaternion()).invert().multiply(orientation)); wrist.updateWorldMatrix(false, true);
    const offset = finger.localToWorld(this.tip.clone()).sub(wrist.getWorldPosition(new THREE.Vector3()));
    const target = bone('head').localToWorld(this.temple.clone().add(new THREE.Vector3(-.09, 0, 0))).sub(offset);
    const pole = new THREE.Vector3(-1, -1, .4).applyQuaternion(root.getWorldQuaternion(new THREE.Quaternion()));
    reach(shoulder, elbow, wrist.position, target, pole);
    wrist.quaternion.copy(elbow.getWorldQuaternion(new THREE.Quaternion()).invert().multiply(orientation));
    for (const [i, joint] of [shoulder, elbow, wrist].entries()) {
      const desired = joint.quaternion.clone(); joint.quaternion.copy(before[i]).slerp(desired, raised);
    }
    shoulder.updateWorldMatrix(true, true);
  }
}
