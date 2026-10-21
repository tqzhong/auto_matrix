import { writeFile } from 'node:fs/promises';
import * as THREE from 'three';
import { model, faces, crossings } from './baseline-fixture.mjs';
import { advanceMotion, newMotion } from './release/packages/client/src/agents/CharacterMotion.js';

const h = await model(), state = newMotion(), input = { speed: 0, grounded: true, verticalVelocity: 0, turn: 0, attack: 1, combo: 2, ambushWardrobe: 'coat' as const };
for (let frame = 0; frame <= 15; frame++) h.models.animate(h.rig, advanceMotion(state, input, 1 / 60), state, input, 1 / 60);
h.rig.root.updateMatrixWorld(true);
const meshes = ['morpheus-ambush-coat', 'morpheus-ambush-shirt'].map(name => h.rig.root.getObjectByName(name) as THREE.SkinnedMesh);
const saved = meshes.map(mesh => (mesh.geometry.attributes.position.array as Float32Array).slice());
const result = [];
for (const strength of [0, .5, 1]) {
  const affected = [], scales = []; let error = 0;
  for (const [part, mesh] of meshes.entries()) {
    const a = mesh.geometry.attributes; (a.position.array as Float32Array).set(saved[part]);
    const frames = mesh.skeleton.bones.map((bone, i) => {
      const matrix = mesh.bindMatrixInverse.clone().multiply(bone.matrixWorld).multiply(mesh.skeleton.boneInverses[i]).multiply(mesh.bindMatrix);
      const position = new THREE.Vector3(), rotation = new THREE.Quaternion(), scale = new THREE.Vector3(); matrix.decompose(position, rotation, scale);
      const dual = new THREE.Quaternion(position.x, position.y, position.z, 0).multiply(rotation);
      dual.set(dual.x * .5, dual.y * .5, dual.z * .5, dual.w * .5); return { matrix, rotation, dual, scale };
    });
    let count = 0;
    for (let id = 0; id < a.position.count; id++) {
      const arm = ['R', 'L'].map(side => {
        let upper = 0, lower = 0;
        for (let k = 0; k < 4; k++) {
          const name = mesh.skeleton.bones[a.skinIndex.getComponent(id, k)].name, weight = a.skinWeight.getComponent(id, k);
          if (name === `shoulder_${side}`) upper += weight;
          if (name === `elbow_${side}` || name === `wrist_${side}` || name.startsWith(`forearm_twist_${side}_`)) lower += weight;
        }
        return { upper, lower };
      }).find(arm => arm.upper > 1e-6 && arm.lower > 1e-6 && arm.upper + arm.lower > .8);
      if (!arm || strength === 0) continue;
      count++;
      const point = new THREE.Vector3().fromBufferAttribute(a.position, id), morph = new THREE.Vector3();
      for (const [target, delta] of (mesh.geometry.morphAttributes.position ?? []).entries()) morph.addScaledVector(new THREE.Vector3().fromBufferAttribute(delta, id), mesh.morphTargetInfluences![target]);
      point.add(morph);
      const original = mesh.getVertexPosition(id, new THREE.Vector3()), real = new THREE.Vector4(0, 0, 0, 0), dual = new THREE.Vector4(0, 0, 0, 0), scale = new THREE.Vector3();
      const skin = new THREE.Matrix4(); skin.elements.fill(0); let reference: THREE.Quaternion | undefined;
      for (let k = 0; k < 4; k++) {
        const weight = a.skinWeight.getComponent(id, k); if (!weight) continue;
        const frame = frames[a.skinIndex.getComponent(id, k)]; reference ??= frame.rotation;
        const sign = reference.dot(frame.rotation) < 0 ? -1 : 1;
        real.addScaledVector(new THREE.Vector4(frame.rotation.x, frame.rotation.y, frame.rotation.z, frame.rotation.w), weight * sign);
        dual.addScaledVector(new THREE.Vector4(frame.dual.x, frame.dual.y, frame.dual.z, frame.dual.w), weight * sign);
        scale.addScaledVector(frame.scale, weight);
        for (let n = 0; n < 16; n++) skin.elements[n] += frame.matrix.elements[n] * weight;
      }
      const length = real.length(); real.multiplyScalar(1 / length); dual.multiplyScalar(1 / length);
      const rotation = new THREE.Quaternion(real.x, real.y, real.z, real.w), translation = new THREE.Quaternion(dual.x, dual.y, dual.z, dual.w).multiply(rotation.clone().conjugate());
      const desired = point.multiply(scale).applyQuaternion(rotation).add(new THREE.Vector3(translation.x, translation.y, translation.z).multiplyScalar(2));
      desired.lerp(original, 1 - strength * THREE.MathUtils.smoothstep(arm.upper + arm.lower, .8, .99));
      skin.elements[15] = 1;
      const corrected = desired.clone().applyMatrix4(skin.invert()).sub(morph); a.position.setXYZ(id, corrected.x, corrected.y, corrected.z);
      error = Math.max(error, mesh.getVertexPosition(id, new THREE.Vector3()).distanceTo(desired)); scales.push(...scale.toArray());
    }
    affected.push(count);
  }
  const coat = faces(meshes[0]), shirt = faces(meshes[1]);
  result.push({ strength, affected, skinRoundTripMaximum: error, scaleMinimum: scales.length ? Math.min(...scales) : null,
    scaleMaximum: scales.length ? Math.max(...scales) : null, coatSelf: crossings(coat, coat, true), shirtSelf: crossings(shirt, shirt, true), layers: crossings(coat, shirt, false) });
}
await writeFile('dual-skin-probe.json', JSON.stringify(result, null, 2)); console.log(JSON.stringify(result, null, 2)); h.models.dispose();
