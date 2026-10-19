import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { APARTMENT, WAKE_CALL, type WakeCall } from '@auto_matrix/shared';

/** One receiver geometry for the cradle and the hand, including the cord socket. */
export function apartmentHandset(name: string): THREE.Group {
  const root = new THREE.Group(); root.name = name; root.userData.dynamic = true;
  const shell = new THREE.MeshStandardMaterial({ color: 0x173c2d, roughness: .35, metalness: .05 });
  const grille = new THREE.MeshStandardMaterial({ color: 0x081710, roughness: .7 });
  const mesh = (geometry: THREE.BufferGeometry, material: THREE.Material) => {
    const part = new THREE.Mesh(geometry, material); part.castShadow = part.receiveShadow = true; root.add(part); return part;
  };
  mesh(new THREE.CapsuleGeometry(.07, .30, 6, 20), shell);
  for (const y of [-.23, .23]) {
    const cup = mesh(new THREE.SphereGeometry(.12, 24, 16), shell); cup.position.set(0, y, .025); cup.scale.set(1, 1.05, .75);
    const face = mesh(new THREE.CylinderGeometry(.093, .095, .016, 24), shell); face.rotation.x = Math.PI / 2; face.position.set(0, y, .115);
    for (let row = -2; row <= 2; row++) for (let column = -2; column <= 2; column++) {
      if (row * row + column * column > 5) continue;
      const hole = mesh(new THREE.CircleGeometry(.007, 6), grille); hole.position.set(column * .032, y + row * .032, .124);
    }
  }
  const socket = mesh(new THREE.CylinderGeometry(.025, .025, .07, 12), grille); socket.position.set(0, -.37, .02);
  const batches = new Map<THREE.Material, THREE.BufferGeometry[]>();
  for (const part of root.children as THREE.Mesh[]) {
    part.updateMatrix(); part.geometry.applyMatrix4(part.matrix);
    const material = part.material as THREE.Material, parts = batches.get(material) ?? [];
    parts.push(part.geometry); batches.set(material, parts);
  }
  root.clear();
  for (const [material, parts] of batches) { mesh(mergeGeometries(parts)!, material); parts.forEach(part => part.dispose()); }
  return root;
}

/** Saved-time trajectory in the actor's local frame; the set uses the same pose for the cord. */
export function apartmentHandsetPose(call?: WakeCall) {
  const inverseYaw = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), -APARTMENT.phone.yaw);
  const position = new THREE.Vector3(APARTMENT.phone.x - APARTMENT.phone.approachX, APARTMENT.phone.y + .48,
    APARTMENT.phone.z + .22 - APARTMENT.phone.approachZ).applyQuaternion(inverseYaw);
  const rotation = new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(
    new THREE.Vector3(0, 0, -1), new THREE.Vector3(1, 0, 0), new THREE.Vector3(0, -1, 0))).premultiply(inverseYaw);
  let carry = 0, reach = 0, grip = 0;
  if (call?.phase === 'pickup') {
    carry = THREE.MathUtils.smoothstep(call.elapsed, WAKE_CALL.grasp + .1, WAKE_CALL.pickup);
    reach = THREE.MathUtils.smoothstep(call.elapsed, 0, WAKE_CALL.grasp);
    grip = THREE.MathUtils.smoothstep(call.elapsed, WAKE_CALL.grasp - .2, WAKE_CALL.grasp);
  } else if (call?.phase === 'listening' || call?.phase === 'decision') carry = reach = grip = 1;
  else if (call?.phase === 'reply') {
    carry = 1 - THREE.MathUtils.smoothstep(call.elapsed, 1.75, 3.15);
    reach = 1 - THREE.MathUtils.smoothstep(call.elapsed, 3.35, WAKE_CALL.reply);
    grip = 1 - THREE.MathUtils.smoothstep(call.elapsed, 3.15, 3.35);
  }
  position.lerp(new THREE.Vector3(.35, 3.9, .15), carry);
  // Lift outside the chest so the forearm has room to turn toward the ear.
  position.x += .35 * Math.sin(Math.PI * carry);
  const calling = new THREE.Quaternion().setFromEuler(new THREE.Euler(-.25, -Math.PI / 2, 0));
  rotation.slerp(calling, carry);
  return { position, rotation, carry, reach, grip };
}
