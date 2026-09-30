import * as THREE from 'three';
import { FILM_SETS, MEDICAL_OPERATOR, cabinBodyPose, medicalControlBlend } from '@auto_matrix/shared';
import type { HeroRig } from './HeroModel.js';
import type { MotionInput } from './CharacterMotion.js';

/** Palm contact with the medical control, Neo's neck socket, or the core plug. */
export function cabinContact(rig: HeroRig, input: MotionInput): void {
  const cabin = input.cabin;
  const blend = input.medical !== undefined ? medicalControlBlend(input.medical)
    : cabin?.kind === 'wake' && cabin.role === 'neo' ? cabinBodyPose(cabin.elapsed).inspect
      : cabin?.kind === 'core' && cabin.role === 'morpheus' ? THREE.MathUtils.smoothstep(cabin.elapsed, 2.2, 3)
        * (1 - THREE.MathUtils.smoothstep(cabin.elapsed, 5.8, 6.8)) : 0;
  if (!blend) return;
  rig.root.updateWorldMatrix(true, true);
  const socket = rig.root.getObjectByName('cervical-interface');
  const center = FILM_SETS.film_neb_deck.center;
  const contact = input.medical !== undefined
    ? new THREE.Vector3(center.x + MEDICAL_OPERATOR.control.x, center.y - 1 + MEDICAL_OPERATOR.control.y + .12, center.z + MEDICAL_OPERATOR.control.z)
    : cabin?.role === 'neo' ? socket?.getWorldPosition(new THREE.Vector3())
      : cabin?.target ? new THREE.Vector3(cabin.target.x, cabin.target.y, cabin.target.z) : undefined;
  if (!contact) return;
  const shoulder = rig.bones.get('shoulder_R')!, elbow = rig.bones.get('elbow_R')!, wrist = rig.bones.get('wrist_R')!;
  const rootRotation = rig.root.getWorldQuaternion(new THREE.Quaternion());
  const neck = cabin?.role === 'neo';
  const rotation = rootRotation.clone().multiply(new THREE.Quaternion().setFromEuler(new THREE.Euler(neck ? Math.PI / 2 : 0, 0, -Math.PI / 2)));
  const orientation = wrist.getWorldQuaternion(new THREE.Quaternion()).slerp(rotation, blend);
  const palm = new THREE.Vector3(.09, -.18, .02);
  const target = wrist.localToWorld(palm.clone()).lerp(contact, blend).sub(palm.applyQuaternion(orientation));
  const start = shoulder.getWorldPosition(new THREE.Vector3()), direction = target.clone().sub(start);
  const a = elbow.position.length(), b = wrist.position.length();
  const reach = THREE.MathUtils.clamp(direction.length(), .02, a + b - .001); direction.normalize();
  target.copy(start).addScaledVector(direction, reach);
  const along = (a * a - b * b + reach * reach) / (2 * reach);
  const pole = new THREE.Vector3(neck ? -1 : -.4, neck ? .6 : -1, -.3).applyQuaternion(rootRotation);
  pole.addScaledVector(direction, -pole.dot(direction)).normalize();
  const hinge = start.clone().addScaledVector(direction, along).addScaledVector(pole, Math.sqrt(Math.max(0, a * a - along * along)));
  const aim = (joint: THREE.Bone, child: THREE.Bone, point: THREE.Vector3) => {
    joint.quaternion.setFromUnitVectors(child.position.clone().normalize(), joint.parent!.worldToLocal(point.clone()).sub(joint.position).normalize());
    joint.updateWorldMatrix(false, true);
  };
  aim(shoulder, elbow, hinge); aim(elbow, wrist, target);
  wrist.quaternion.copy(elbow.getWorldQuaternion(new THREE.Quaternion()).invert().multiply(orientation));
  for (let finger = 1; finger <= 5; finger++) for (let segment = 1; segment <= 3; segment++) {
    const joint = rig.bones.get(`finger${finger}-${segment}_R`)!;
    joint.rotation.z = THREE.MathUtils.lerp(joint.rotation.z, neck ? .1 : .35, blend);
  }
}
