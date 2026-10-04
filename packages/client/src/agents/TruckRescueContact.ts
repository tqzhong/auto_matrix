import * as THREE from 'three';
import { truckRescuePose, type TruckEncounter } from '@auto_matrix/shared';
import type { CharacterRig } from './CharacterModel.js';
import type { HeroRig } from './HeroModel.js';

/** Movieclips Truck Stop 01:24: Neo catches each upper back, then carries both bodies. */
export function poseTruckRescue(neo: HeroRig, morpheus: CharacterRig, keymaker: CharacterRig, encounter: TruckEncounter): void {
  if (encounter.phase !== 'rescue') return;
  const blend = truckRescuePose(encounter, 'neo').hold;
  if (!blend) return;
  neo.root.updateWorldMatrix(true, true);
  for (const [passenger, side, inside] of [[morpheus, 'L', -1], [keymaker, 'R', 1]] as const) {
    passenger.root.updateWorldMatrix(true, true);
    const chest = passenger.hero?.bones.get('chest') ?? passenger.torso;
    // Calibrated against the shipped leather coat and the procedural Keymaker's jacket.
    const contact = chest.localToWorld(new THREE.Vector3(inside * .32, passenger.hero ? .3 : 1.45, passenger.hero ? -.025 : -.2215));
    const shoulder = neo.bones.get(`shoulder_${side}`)!, elbow = neo.bones.get(`elbow_${side}`)!, wrist = neo.bones.get(`wrist_${side}`)!;
    const shoulderBase = shoulder.quaternion.clone(), elbowBase = elbow.quaternion.clone();
    const palm = new THREE.Vector3(side === 'R' ? .09 : -.09, -.18, .02);
    const grip = chest.getWorldQuaternion(new THREE.Quaternion()).multiply(new THREE.Quaternion().setFromEuler(new THREE.Euler(0, side === 'R' ? -Math.PI / 2 : Math.PI / 2, 0)));
    const orientation = wrist.getWorldQuaternion(new THREE.Quaternion()).slerp(grip, blend);
    const target = wrist.localToWorld(palm.clone()).lerp(contact, blend).sub(palm.applyQuaternion(orientation));
    const start = shoulder.getWorldPosition(new THREE.Vector3()), direction = target.clone().sub(start);
    const scale = shoulder.getWorldScale(new THREE.Vector3()).x;
    const upper = elbow.position.length() * scale, lower = wrist.position.length() * scale;
    const reach = THREE.MathUtils.clamp(direction.length(), Math.abs(upper - lower) + .001, upper + lower - .001);
    direction.normalize(); target.copy(start).addScaledVector(direction, reach);
    const along = (upper * upper - lower * lower + reach * reach) / (2 * reach);
    const pole = new THREE.Vector3(side === 'R' ? -1 : 1, -.4, -.7).transformDirection(neo.root.matrixWorld);
    pole.addScaledVector(direction, -pole.dot(direction)).normalize();
    const hinge = start.clone().addScaledVector(direction, along).addScaledVector(pole, Math.sqrt(Math.max(0, upper * upper - along * along)));
    const aim = (joint: THREE.Bone, child: THREE.Bone, point: THREE.Vector3) => {
      joint.quaternion.setFromUnitVectors(child.position.clone().normalize(), joint.parent!.worldToLocal(point.clone()).sub(joint.position).normalize());
      joint.updateWorldMatrix(false, true);
    };
    aim(shoulder, elbow, hinge); aim(elbow, wrist, target);
    // Fade the elbow's bend plane too; switching to the IK pole at tiny weights pops the arm.
    shoulder.quaternion.copy(shoulderBase.slerp(shoulder.quaternion, blend));
    elbow.quaternion.copy(elbowBase.slerp(elbow.quaternion, blend));
    shoulder.updateWorldMatrix(false, true);
    wrist.quaternion.copy(elbow.getWorldQuaternion(new THREE.Quaternion()).invert().multiply(orientation));
    for (let finger = 1; finger <= 5; finger++) for (let segment = 1; segment <= 3; segment++) {
      const joint = neo.bones.get(`finger${finger}-${segment}_${side}`)!;
      joint.rotation.z = THREE.MathUtils.lerp(joint.rotation.z, (side === 'R' ? 1 : -1) * (finger === 1 ? .12 : .2), blend);
    }
  }
}
