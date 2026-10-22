import * as THREE from 'three';
import type { HeroRig } from '../../packages/client/src/agents/HeroModel.js';

export function patientSkin(rig: HeroRig) {
  const hand = rig.root.getObjectByName('Anatomical_head_and_hands') as THREE.SkinnedMesh;
  const body = rig.root.getObjectByName('Patient_body') as THREE.SkinnedMesh;
  return skinJoins(hand, body);
}

export function skinJoins(hand: THREE.SkinnedMesh, body: THREE.SkinnedMesh) {
  const key = (a: THREE.BufferAttribute | THREE.InterleavedBufferAttribute, i: number) => [a.getX(i), a.getY(i), a.getZ(i)].map(v => v.toFixed(5)).join(',');
  const hp = hand.geometry.attributes.position, bp = body.geometry.attributes.position, points = new Map<string, number[]>();
  for (let i = 0; i < bp.count; i++) { const k = key(bp, i), list = points.get(k) ?? []; list.push(i); points.set(k, list); }
  const pairs: [number, number][] = [];
  for (let i = 0; i < hp.count; i++) for (const j of points.get(key(hp, i)) ?? []) pairs.push([i, j]);
  return { hand, body, pairs };
}

export function patientNormal(mesh: THREE.SkinnedMesh, i: number) {
  const a = mesh.geometry.attributes, sum = new THREE.Matrix4(); sum.elements.fill(0);
  for (let k = 0; k < 4; k++) {
    const bone = new THREE.Matrix4().fromArray(mesh.skeleton.boneMatrices, a.skinIndex.getComponent(i, k) * 16), w = a.skinWeight.getComponent(i, k);
    bone.elements.forEach((v, j) => { sum.elements[j] += v * w; });
  }
  sum.premultiply(mesh.bindMatrixInverse).multiply(mesh.bindMatrix);
  return new THREE.Vector3().fromBufferAttribute(a.normal, i).applyMatrix3(new THREE.Matrix3().setFromMatrix4(sum))
    .applyMatrix3(new THREE.Matrix3().getNormalMatrix(mesh.matrixWorld)).normalize();
}
