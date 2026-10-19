import * as THREE from 'three';
import { wakeCallHandsetHeld, type WakeCall } from '@auto_matrix/shared';
import type { HeroRig } from './HeroModel.js';
import { apartmentHandset, apartmentHandsetPose } from './ApartmentHandset.js';
import { ConsoleGrip } from './ConsoleGrip.js';
import { reach } from './SpoonPerformance.js';

/** The apartment landline handset stays in Neo's actual hand while the set keeps the base and cord. */
export class WakeCallPerformance {
  private root = apartmentHandset('neo-landline-handset');
  private offset = new THREE.Vector3(-.17, -.21, .015);
  private fingers: ConsoleGrip;
  private wrist: THREE.Bone;
  constructor(private rig: HeroRig) {
    this.wrist = rig.bones.get('wrist_L')!; this.wrist.add(this.root);
    this.root.rotation.set(0, -Math.PI / 2, -Math.PI / 2);
    this.root.rotateZ(-.5);
    this.fingers = new ConsoleGrip(rig, 'L');
    this.root.visible = false;
  }
  update(call?: WakeCall): void {
    this.root.visible = wakeCallHandsetHeld(call);
    const pose = apartmentHandsetPose(call); if (!pose.reach) return;
    const root = this.rig.root;
    root.updateWorldMatrix(true, true);
    const rotation = root.getWorldQuaternion(new THREE.Quaternion()), phoneRotation = rotation.clone().multiply(pose.rotation);
    const shoulder = this.rig.bones.get('shoulder_L')!, elbow = this.rig.bones.get('elbow_L')!;
    const resting = this.wrist.getWorldQuaternion(new THREE.Quaternion());
    const orientation = phoneRotation.clone().multiply(this.root.quaternion.clone().invert());
    const scale = this.wrist.getWorldScale(new THREE.Vector3());
    const contact = root.localToWorld(pose.position), frame = new THREE.Matrix4().compose(contact, phoneRotation, scale);
    const target = contact.clone().sub(this.offset.clone().multiply(scale).applyQuaternion(orientation));
    target.add(new THREE.Vector3(.42 * (1 - pose.grip), 0, 0).applyQuaternion(orientation));
    const start = this.wrist.getWorldPosition(new THREE.Vector3()).lerp(target, pose.reach);
    // Turn the palm while it is still behind the receiver, then approach from above.
    start.add(new THREE.Vector3(0, 0, -.4 * Math.sin(Math.PI * pose.reach)).applyQuaternion(rotation));
    const hand = resting.slerp(orientation, THREE.MathUtils.smoothstep(pose.reach, 0, .7));
    const pole = elbow.getWorldPosition(new THREE.Vector3()).sub(shoulder.getWorldPosition(new THREE.Vector3())).normalize()
      .lerp(new THREE.Vector3(.1, -1, -1).applyQuaternion(rotation).normalize(), pose.reach);
    reach(shoulder, elbow, this.wrist.position, start, pole);
    this.wrist.quaternion.copy(elbow.getWorldQuaternion(new THREE.Quaternion()).invert().multiply(hand));
    this.root.position.copy(this.offset);
    this.wrist.updateWorldMatrix(false, true);
    const skin = root.getObjectByName('Anatomical_head_and_hands') as THREE.SkinnedMesh;
    this.fingers.update(skin, pose.grip, 'handset', pose.grip, frame);
    this.wrist.updateWorldMatrix(false, true);
  }
  dispose(): void {
    const materials = new Set<THREE.Material>();
    this.root.traverse(object => { if (object instanceof THREE.Mesh) { object.geometry.dispose(); materials.add(object.material as THREE.Material); } });
    materials.forEach(material => material.dispose()); this.root.removeFromParent();
  }
}
