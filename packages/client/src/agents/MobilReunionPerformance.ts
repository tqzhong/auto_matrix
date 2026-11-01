import * as THREE from 'three';
import { mobilReunionPose, type MobilReunionGesture } from '@auto_matrix/shared';
import type { CharacterRig } from './CharacterModel.js';
import { reunionBackContact } from './DockReunionPerformance.js';
import { reach } from './SpoonPerformance.js';

function reachArm(upper: THREE.Object3D, lower: THREE.Object3D, end: THREE.Vector3, target: THREE.Vector3, pole: THREE.Vector3): void {
  const start = upper.getWorldPosition(new THREE.Vector3()), direction = target.clone().sub(start);
  const scale = upper.getWorldScale(new THREE.Vector3()).x, a = lower.position.length() * scale, b = end.length() * scale;
  const length = THREE.MathUtils.clamp(direction.length(), .01, a + b - .001); direction.normalize();
  target = start.clone().addScaledVector(direction, length);
  const along = (a * a - b * b + length * length) / (2 * length);
  pole.addScaledVector(direction, -pole.dot(direction)).normalize();
  const hinge = start.clone().addScaledVector(direction, along).addScaledVector(pole, Math.sqrt(Math.max(0, a * a - along * along)));
  const originalUpper = lower.position.clone().normalize(), originalLower = end.clone().normalize();
  const desiredUpper = upper.parent!.worldToLocal(hinge.clone()).sub(upper.position).normalize();
  const desiredLower = upper.parent!.worldToLocal(target.clone()).sub(upper.parent!.worldToLocal(hinge.clone())).normalize();
  const constant = originalUpper.x * originalLower.x;
  const cosine = originalUpper.y * originalLower.y + originalUpper.z * originalLower.z;
  const sine = originalUpper.z * originalLower.y - originalUpper.y * originalLower.z;
  const angle = Math.atan2(sine, cosine) - Math.acos(THREE.MathUtils.clamp(
    (desiredUpper.dot(desiredLower) - constant) / Math.hypot(cosine, sine), -1, 1));
  const flexion = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), angle);
  const frame = (axis: THREE.Vector3, next: THREE.Vector3) => {
    const across = next.clone().addScaledVector(axis, -axis.dot(next)).normalize();
    return new THREE.Matrix4().makeBasis(axis, across, axis.clone().cross(across));
  };
  // Aim the complete flexion plane at the shoulder while retaining the
  // delivered elbow's local X hinge, including the sleeve's reference roll.
  const original = frame(originalUpper, originalLower.applyQuaternion(flexion));
  upper.quaternion.setFromRotationMatrix(frame(desiredUpper, desiredLower).multiply(original.transpose()));
  upper.updateWorldMatrix(false, true); lower.quaternion.copy(flexion); lower.updateWorldMatrix(false, true);
}

function backSurface(rig: CharacterRig, left: boolean, height: number): { point: THREE.Vector3; normal: THREE.Vector3 } | undefined {
  type Patch = { mesh: THREE.SkinnedMesh; geometry: THREE.BufferGeometry; ids: number[]; weights: THREE.Vector3; height: number };
  const cache = (rig.root.userData.mobilBack ??= []) as (Patch | undefined)[];
  const side = left ? 1 : 0;
  let patch = cache[side];
  if (!patch || !patch.mesh.visible || patch.mesh.geometry !== patch.geometry || patch.height !== height) {
    patch = cache[side] = undefined;
    const meshes: THREE.SkinnedMesh[] = [];
    rig.detail.traverseVisible(object => {
      if (object instanceof THREE.SkinnedMesh && ['Tailored_coat_upper', 'Fitted_leather_jacket'].includes(object.name)) meshes.push(object);
    });
    // Select the patch on the delivered bind surface. Selecting it from the
    // first animated frame would change a recovered embrace's contact point.
    const inverse = rig.root.matrixWorld.clone().invert();
    const ray = new THREE.Raycaster(new THREE.Vector3(left ? -.28 : .28, height, -1.5), new THREE.Vector3(0, 0, 1), 0, 2.7);
    for (const mesh of meshes) {
      const surface = new THREE.Mesh(mesh.geometry, mesh.material);
      surface.matrixWorld.multiplyMatrices(inverse, mesh.matrixWorld);
      const { position, skinIndex, skinWeight } = mesh.geometry.attributes;
      const hit = ray.intersectObject(surface, false).find(hit => hit.face && [hit.face.a, hit.face.b, hit.face.c].every(id =>
        [0, 1, 2, 3].reduce((sum, k) => sum + (/^(pelvis|spine|chest)/.test(mesh.skeleton.bones[skinIndex.getComponent(id, k)].name)
          ? skinWeight.getComponent(id, k) : 0), 0) > .75));
      if (!hit?.face) continue;
      const ids = [hit.face.a, hit.face.b, hit.face.c];
      const vertices = ids.map(id => new THREE.Vector3().fromBufferAttribute(position, id));
      const point = hit.point.clone().applyMatrix4(surface.matrixWorld.clone().invert());
      const weights = new THREE.Triangle(...vertices as [THREE.Vector3, THREE.Vector3, THREE.Vector3]).getBarycoord(point, new THREE.Vector3())!;
      patch = cache[side] = { mesh, geometry: mesh.geometry, ids, weights, height };
      break;
    }
  }
  if (!patch) return;
  patch.mesh.skeleton.update();
  const vertices = patch.ids.map(id => patch!.mesh.getVertexPosition(id, new THREE.Vector3()).applyMatrix4(patch!.mesh.matrixWorld));
  const normal = new THREE.Triangle(...vertices as [THREE.Vector3, THREE.Vector3, THREE.Vector3]).getNormal(new THREE.Vector3());
  const point = vertices.reduce((sum, vertex, i) => sum.addScaledVector(vertex, patch!.weights.getComponent(i)), new THREE.Vector3());
  return { point: point.addScaledVector(normal, .04), normal };
}

function palmSurface(rig: CharacterRig, side: string): { point: THREE.Vector3; normal: THREE.Vector3 } {
  const hero = rig.hero!, wrist = hero.bones.get('wrist_' + side)!;
  const skin = hero.root.getObjectByName('Anatomical_head_and_hands') as THREE.SkinnedMesh;
  const cached = wrist.userData.mobilPalm as { source: THREE.BufferGeometry; point: THREE.Vector3; normal: THREE.Vector3 } | undefined;
  if (cached?.source === skin.geometry) return cached;
  const joint = skin.skeleton.bones.indexOf(wrist), { position, skinIndex, skinWeight } = skin.geometry.attributes;
  const vertices = new Map<number, THREE.Vector3>(), sign = side === 'R' ? 1 : -1;
  for (let id = 0; id < position.count; id++) {
    let weight = 0;
    for (let k = 0; k < 4; k++) if (skinIndex.getComponent(id, k) === joint) weight += skinWeight.getComponent(id, k);
    if (weight > .999) vertices.set(id, new THREE.Vector3().fromBufferAttribute(position, id)
      .applyMatrix4(skin.bindMatrix).applyMatrix4(skin.skeleton.boneInverses[joint]));
  }
  const index = skin.geometry.index!; let support = -Infinity, point = new THREE.Vector3(), normal = new THREE.Vector3();
  for (let face = 0; face < index.count; face += 3) {
    const ids = [0, 1, 2].map(k => index.getX(face + k));
    if (!ids.every(id => vertices.has(id))) continue;
    const triangle = ids.map(id => vertices.get(id)!);
    const center = triangle.reduce((sum, vertex) => sum.add(vertex), new THREE.Vector3()).divideScalar(3);
    const faceNormal = new THREE.Triangle(...triangle as [THREE.Vector3, THREE.Vector3, THREE.Vector3]).getNormal(new THREE.Vector3());
    // Use the outward central palm pad, not a thumb-side triangle whose
    // normal leaves the rest of the palm inside the partner's garment.
    if (center.y < -.25 || center.y > -.08 || faceNormal.x * sign < .9 || center.x * sign <= support) continue;
    support = center.x * sign; point = center; normal = faceNormal;
  }
  const result = { source: skin.geometry, point, normal }; wrist.userData.mobilPalm = result; return result;
}

export function poseMobilReunion(rig: CharacterRig, gesture?: MobilReunionGesture, partner?: CharacterRig): void {
  if (!gesture) return;
  const hero = rig.hero, neo = gesture.role === 'neo';
  if (!partner && hero && !neo && ['ready', 'embracing', 'together'].includes(gesture.reunion.phase))
    hero.bones.get('shoulder_R')!.rotation.z -= .015;
  if (gesture.reunion.phase !== 'embracing') return;
  const pose = mobilReunionPose(gesture.reunion);
  const rotation = rig.root.getWorldQuaternion(new THREE.Quaternion());
  if (!partner) {
    rig.detail.position.set(0, 0, 0); rig.detail.rotation.set(0, 0, 0);
    if (hero) {
      const pelvis = hero.bones.get('pelvis')!; pelvis.position.copy(hero.rest.get('pelvis')!); pelvis.rotation.set(0, 0, 0);
      pelvis.position.y -= .025 * pose.embrace;
      hero.bones.get('spine')!.rotation.set((neo ? .1 : .07) * pose.kiss, 0, 0);
      hero.bones.get('chest')!.rotation.set(0, 0, 0);
      hero.bones.get('head')!.rotation.set((neo ? .11 : -.05) * pose.kiss, (neo ? -.15 : .15) * pose.kiss, -.16 * pose.kiss);
    } else {
      rig.torso.position.set(0, 1.955, 0); rig.torso.rotation.set(.08 * pose.kiss, 0, 0);
      rig.head.rotation.set((neo ? .11 : -.05) * pose.kiss, (neo ? -.15 : .15) * pose.kiss, -.16 * pose.kiss);
    }
    rig.root.updateMatrixWorld(true);
    for (const [i, side] of ['R', 'L'].entries()) {
      const sign = i ? 1 : -1, hip = hero?.bones.get('hip_' + side) ?? rig.hips[i];
      const knee = hero?.bones.get('knee_' + side) ?? rig.knees[i], ankle = hero?.bones.get('ankle_' + side) ?? rig.ankles[i];
      const upper = hip.quaternion.clone(), lower = knee.quaternion.clone();
      const orientation = ankle.getWorldQuaternion(new THREE.Quaternion()).slerp(rotation, pose.embrace);
      const foot = rig.root.localToWorld(new THREE.Vector3(sign * .28, hero ? hero.footHeight + .025 : .155, i ? -.12 : .12));
      if (!hero) hip.position.set(sign * .225, 1.955, 0);
      reach(hip, knee, ankle.position, foot, new THREE.Vector3(sign * .1, .1, 1).applyQuaternion(rotation));
      hip.quaternion.slerpQuaternions(upper, hip.quaternion.clone(), pose.embrace);
      knee.quaternion.slerpQuaternions(lower, knee.quaternion.clone(), pose.embrace);
      hip.updateWorldMatrix(false, true);
      ankle.quaternion.copy(knee.getWorldQuaternion(new THREE.Quaternion()).invert().multiply(orientation));
    }
    rig.root.updateMatrixWorld(true);
    return;
  }
  const time = gesture.reunion.elapsed;
  const amount = THREE.MathUtils.smoothstep(time, neo ? .45 : .65, .9)
    * (1 - THREE.MathUtils.smoothstep(time, neo ? 5.45 : 5.2, neo ? 5.9 : 5.55));
  const raised = neo ? 0 : THREE.MathUtils.smoothstep(time, .1, .6)
    * (1 - THREE.MathUtils.smoothstep(time, 5.9, 6.2));
  for (const [i, side] of ['R', 'L'].entries()) {
    const sign = i ? 1 : -1;
    const back = hero && partner.hero ? backSurface(partner, i === 1, neo ? 2.7 : 3.05) : undefined;
    if (hero && partner.hero && !back) continue;
    const shoulder = hero?.bones.get('shoulder_' + side) ?? rig.shoulders[i], elbow = hero?.bones.get('elbow_' + side) ?? rig.elbows[i];
    const wrist = hero?.bones.get('wrist_' + side), surface = wrist ? palmSurface(rig, side) : undefined;
    let orientation = wrist ? wrist.getWorldQuaternion(new THREE.Quaternion()) : rotation;
    if (surface) {
      const normal = back ? back.normal.clone().negate() : new THREE.Vector3(0, 0, 1).transformDirection(partner.root.matrixWorld);
      const fingers = new THREE.Vector3(sign, .15, 0).transformDirection(partner.root.matrixWorld);
      fingers.addScaledVector(normal, -fingers.dot(normal)).normalize();
      const local = new THREE.Vector3(0, -1, 0).addScaledVector(surface.normal, surface.normal.y).normalize();
      const original = new THREE.Matrix4().makeBasis(surface.normal, local, surface.normal.clone().cross(local));
      const desired = new THREE.Matrix4().makeBasis(normal, fingers, normal.clone().cross(fingers));
      orientation.slerp(new THREE.Quaternion().setFromRotationMatrix(desired.multiply(original.transpose())), amount);
    }
    const contact = back?.point ?? reunionBackContact(partner, i === 1);
    const rest = wrist ? wrist.localToWorld(surface!.point.clone()) : rig.root.localToWorld(new THREE.Vector3(sign * .89, 2.32, .08));
    // Trinity first raises her hands beside her own shoulders. Neo can then
    // wrap below her forearms. He releases before she lowers them again.
    rest.lerp(rig.root.localToWorld(new THREE.Vector3(sign * 1.15, 3.25, .1)), raised);
    const target = rest.lerp(contact, amount); target.y += Math.sin(amount * Math.PI) * (neo ? .12 : .1);
    if (back) {
      const around = Math.sin(amount * Math.PI);
      target.addScaledVector(new THREE.Vector3(-sign, 0, 0).transformDirection(partner.root.matrixWorld), (neo ? .35 : .45) * around);
      target.addScaledVector(back.normal, (neo ? .1 : .08) * around);
    }
    if (wrist) target.sub(surface!.point.clone().multiply(wrist.getWorldScale(new THREE.Vector3())).applyQuaternion(orientation));
    const pole = new THREE.Vector3(sign * 1.3, .15, -.12).applyQuaternion(rotation);
    if (wrist) {
      const start = shoulder.getWorldPosition(new THREE.Vector3()), aim = wrist.getWorldPosition(new THREE.Vector3()).sub(start).normalize();
      const next = target.clone().sub(start).normalize();
      const initial = elbow.getWorldPosition(new THREE.Vector3()).sub(start);
      initial.addScaledVector(aim, -initial.dot(aim)).normalize().applyQuaternion(new THREE.Quaternion().setFromUnitVectors(aim, next));
      pole.addScaledVector(next, -pole.dot(next)).normalize();
      const roll = Math.atan2(next.dot(initial.clone().cross(pole)), initial.dot(pole));
      reachArm(shoulder, elbow, wrist.position, target, initial.applyAxisAngle(next, roll * amount));
    }
    else reach(shoulder, elbow, new THREE.Vector3(0, -.79, .055), target, pole);
    if (wrist) {
      wrist.quaternion.copy(elbow.getWorldQuaternion(new THREE.Quaternion()).invert().multiply(orientation));
      // Carry the palm with the forearm during the reach instead of folding
      // it through the cuff. Retain the actual axial roll and held contact.
      const axis = wrist.position.clone().normalize();
      const swing = new THREE.Quaternion().setFromUnitVectors(axis, axis.clone().applyQuaternion(wrist.quaternion));
      const angle = 2 * Math.acos(THREE.MathUtils.clamp(Math.abs(swing.w), 0, 1));
      if (angle > .8) {
        const twist = swing.clone().invert().multiply(wrist.quaternion);
        wrist.quaternion.copy(new THREE.Quaternion().slerp(swing, .8 / angle).multiply(twist));
      }
      for (let finger = 1; finger <= 5; finger++) for (let joint = 1; joint <= 3; joint++)
        hero!.bones.get(`finger${finger}-${joint}_${side}`)!.quaternion.slerp(new THREE.Quaternion(), amount);
      // The delivered thumb is opposed for grasping. Open its base along
      // the palm plane before resting the full hand against the garment.
      const thumb = hero!.bones.get(`finger1-2_${side}`)!.position;
      hero!.bones.get(`finger1-1_${side}`)!.rotation.y = -Math.atan2(thumb.x, thumb.z) * amount;
      hero!.bones.get(`finger5-1_${side}`)!.rotation.z += sign * .08 * amount;
    } else rig.fingers[i].forEach(finger => { finger.rotation.x = -.18 * amount; });
  }
  rig.root.updateMatrixWorld(true);
}

/** CharacterModels prepares both bodies once before querying either partner. */
export function poseMobilReunionPair(neo: CharacterRig, trinity: CharacterRig, gesture: MobilReunionGesture): void {
  poseMobilReunion(neo, { ...gesture, role: 'neo' }, trinity); poseMobilReunion(trinity, { ...gesture, role: 'trinity' }, neo);
}
