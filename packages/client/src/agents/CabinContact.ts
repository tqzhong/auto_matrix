import * as THREE from 'three';
import { FILM_SETS, MEDICAL_OPERATOR, cabinBodyPose, medicalControlBlend, downloadHandPoint } from '@auto_matrix/shared';
import type { HeroRig } from './HeroModel.js';
import type { MotionInput } from './CharacterMotion.js';
import type { FightingHands } from './FightingHands.js';
import { coreConnectorContact } from './CoreConnectorContact.js';

const chinContacts = new WeakMap<HeroRig, THREE.Vector3>();
function chinContact(rig: HeroRig): THREE.Vector3 {
  const cached = chinContacts.get(rig); if (cached) return cached;
  const head = rig.bones.get('head')!, skin = rig.root.getObjectByName('Anatomical_head_and_hands') as THREE.SkinnedMesh;
  const a = skin.geometry.attributes, index = skin.geometry.index!, headIndex = skin.skeleton.bones.indexOf(head);
  const headJoints = new Set(skin.skeleton.bones.flatMap((bone, i) => bone === head || bone.name === 'MorpheusJaw' ? [i] : []));
  const space = skin.skeleton.boneInverses[headIndex].clone().multiply(skin.bindMatrix);
  const eye = head.userData.cameraEye as THREE.Vector3;
  const ray = new THREE.Ray(new THREE.Vector3(0, -.6, eye.z), new THREE.Vector3(0, 1, 0));
  const contact = new THREE.Vector3(0, Infinity, eye.z), hit = new THREE.Vector3();
  for (let face = 0; face < index.count; face += 3) {
    const ids = [0, 1, 2].map(k => index.getX(face + k));
    if (!ids.every(id => [0, 1, 2, 3].reduce((sum, k) => sum + (headJoints.has(a.skinIndex.getComponent(id, k)) ? a.skinWeight.getComponent(id, k) : 0), 0) > .5)) continue;
    const points = ids.map(id => new THREE.Vector3().fromBufferAttribute(a.position, id).applyMatrix4(space));
    if (ray.intersectTriangle(points[0], points[1], points[2], false, hit) && hit.y < contact.y) contact.copy(hit);
  }
  chinContacts.set(rig, contact); return contact;
}

/** Palm contact with the medical control, Neo's neck socket, or the core plug. */
export function cabinContact(rig: HeroRig, input: MotionInput, hands?: FightingHands): void {
  const cabin = input.cabin, truth = input.truth, download = input.download;
  const unplug = truth?.phase === 'unplug' && (truth.role === 'trinity' || truth.role === 'dozer');
  const connecting = download?.phase === 'connecting' && download.role === 'tank';
  const upload = input.training?.kind === 'download' && input.training.role === 'tank' ? input.training : undefined;
  const invitation = input.training?.kind === 'download' && input.training.role === 'morpheus' ? input.training : undefined;
  const blend = invitation ? THREE.MathUtils.smoothstep(invitation.elapsed, 9.1, 9.7) : upload ? 1 : connecting ? THREE.MathUtils.smoothstep(download.elapsed, 2.2, 3) * (1 - THREE.MathUtils.smoothstep(download.elapsed, 5.8, 6.8))
    : unplug ? THREE.MathUtils.smoothstep(truth.elapsed, 0, .7) * (1 - THREE.MathUtils.smoothstep(truth.elapsed, 3.2, 4)) : input.medical !== undefined ? medicalControlBlend(input.medical)
    : cabin?.kind === 'wake' && cabin.role === 'neo' ? cabinBodyPose(cabin.elapsed).inspect
      : cabin?.kind === 'core' && cabin.role === 'morpheus' ? THREE.MathUtils.smoothstep(cabin.elapsed, 2, 3)
        * (1 - THREE.MathUtils.smoothstep(cabin.elapsed, 5.8, 6.8)) : 0;
  if (!blend && !invitation) return;
  rig.root.updateWorldMatrix(true, true);
  const socket = rig.root.getObjectByName('cervical-interface');
  const center = FILM_SETS.film_neb_deck.center;
  const contact = invitation ? rig.bones.get('head')!.localToWorld(chinContact(rig).clone()) : connecting && download.target ? new THREE.Vector3(download.target.x, download.target.y, download.target.z)
    : unplug && truth.target ? new THREE.Vector3(truth.target.x, truth.target.y, truth.target.z) : input.medical !== undefined
    ? new THREE.Vector3(center.x + MEDICAL_OPERATOR.control.x, center.y - 1 + MEDICAL_OPERATOR.control.y + .12, center.z + MEDICAL_OPERATOR.control.z)
    : cabin?.role === 'neo' ? socket?.getWorldPosition(new THREE.Vector3())
      : cabin?.target ? new THREE.Vector3(cabin.target.x, cabin.target.y, cabin.target.z) : undefined;
  if (!contact && !upload) return;
  if (cabin?.kind === 'core' && cabin.role === 'morpheus' && contact) { coreConnectorContact(rig, contact, blend); return; }
  for (const side of upload ? ['R', 'L'] : ['R']) {
    const point = upload ? downloadHandPoint(upload.elapsed, side as 'R' | 'L') : undefined;
    const targetPoint = point ? new THREE.Vector3(center.x + point.x, center.y - 1 + point.y, center.z + point.z) : contact!;
    if (invitation) targetPoint.add(new THREE.Vector3(0, -.055, .035).applyQuaternion(rig.bones.get('head')!.getWorldQuaternion(new THREE.Quaternion())));
    const shoulder = rig.bones.get(`shoulder_${side}`)!, elbow = rig.bones.get(`elbow_${side}`)!, wrist = rig.bones.get(`wrist_${side}`)!;
    const rootRotation = rig.root.getWorldQuaternion(new THREE.Quaternion());
    const neck = cabin?.role === 'neo' || Boolean(invitation);
    if (invitation && hands) { hands.pose(side, blend, true); wrist.updateWorldMatrix(false, true); }
    const rotation = invitation ? rig.bones.get('head')!.getWorldQuaternion(new THREE.Quaternion()).multiply(new THREE.Quaternion().setFromEuler(new THREE.Euler(Math.PI - .3 * THREE.MathUtils.smoothstep(invitation.elapsed, 9.6, 9.7), -Math.PI / 2, 0)))
      : rootRotation.clone().multiply(new THREE.Quaternion().setFromEuler(upload ? new THREE.Euler(-Math.PI / 2, 0, 0) : new THREE.Euler(neck ? Math.PI / 2 : 0, 0, -Math.PI / 2)));
    const orientation = wrist.getWorldQuaternion(new THREE.Quaternion()).slerp(rotation, blend);
    // The middle knuckle anchors the loose invitation hand. The film leaves
    // a small gap below the chin rather than pressing the fist into it.
    const palm = invitation ? wrist.worldToLocal(rig.bones.get('finger3-2_R')!.getWorldPosition(new THREE.Vector3())).add(new THREE.Vector3(0, -.004, 0))
      : new THREE.Vector3(side === 'R' ? .09 : -.09, -.18, .02);
    const target = wrist.localToWorld(palm.clone()).lerp(targetPoint, blend).sub(palm.applyQuaternion(orientation));
    const start = shoulder.getWorldPosition(new THREE.Vector3());
    const a = elbow.position.length(), b = wrist.position.length();
    if (invitation) {
      const span = a + b;
      const lowered = start.clone().add(new THREE.Vector3(-.22 * span, -.92 * span, .16 * span).applyQuaternion(rootRotation));
      target.copy(lowered).lerp(targetPoint.clone().sub(palm), blend)
        .add(new THREE.Vector3(0, 0, .3 * span * Math.sin(Math.PI * blend)).applyQuaternion(rootRotation));
    }
    const direction = target.clone().sub(start);
    const reach = THREE.MathUtils.clamp(direction.length(), .02, a + b - .001); direction.normalize();
    target.copy(start).addScaledVector(direction, reach);
    const along = (a * a - b * b + reach * reach) / (2 * reach);
    const pole = (invitation ? new THREE.Vector3(-.25, -1, .4)
      : new THREE.Vector3(side === 'L' ? .4 : neck ? -1 : -.4, neck ? .6 : -1, -.3)).applyQuaternion(rootRotation);
    pole.addScaledVector(direction, -pole.dot(direction)).normalize();
    const hinge = start.clone().addScaledVector(direction, along).addScaledVector(pole, Math.sqrt(Math.max(0, a * a - along * along)));
    const aim = (joint: THREE.Bone, child: THREE.Bone, point: THREE.Vector3) => {
      joint.quaternion.setFromUnitVectors(child.position.clone().normalize(), joint.parent!.worldToLocal(point.clone()).sub(joint.position).normalize());
      joint.updateWorldMatrix(false, true);
    };
    aim(shoulder, elbow, hinge); aim(elbow, wrist, target);
    wrist.quaternion.copy(elbow.getWorldQuaternion(new THREE.Quaternion()).invert().multiply(orientation));
    if (invitation && hands) continue;
    for (let finger = 1; finger <= 5; finger++) for (let segment = 1; segment <= 3; segment++) {
      const joint = rig.bones.get(`finger${finger}-${segment}_${side}`)!;
      joint.rotation.z = THREE.MathUtils.lerp(joint.rotation.z, invitation ? .6 : neck || upload ? .1 : .35, blend);
    }
  }
}
