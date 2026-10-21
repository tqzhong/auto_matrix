import { writeFile } from 'node:fs/promises';
import * as THREE from 'three';
import { model, faces, crossings } from './release/output/characters/morpheus-upper-coat-2026-10-18/mesh-fixture.mjs';
import { advanceMotion, newMotion } from './release/packages/client/src/agents/CharacterMotion.js';
const h = await model(), wardrobe = (h.models as any).ambushWardrobes.get(h.rig), fitter = wardrobe.hipClearance;
wardrobe.poseTails = () => true;
const state = newMotion(), input = { speed: 0, grounded: true, verticalVelocity: 0, turn: 0, attack: 1, combo: 2, ambushWardrobe: 'coat' as const };
const coat = wardrobe.coat, pants = h.rig.root.getObjectByName('Tailored_trousers') as any, result: unknown[] = [];
for (let frame = 0; frame < 54; frame++) {
  h.models.animate(h.rig, advanceMotion(state, input, 1 / 60), state, input, 1 / 60);
  if (![15, 20, 25, 32, 40].includes(frame)) continue;
  h.rig.root.updateMatrixWorld(true); const trousers = faces(pants), saved = coat.geometry.attributes.position.array.slice(), checks = [];
  for (const gain of [1.5, 1.65, 1.8, 2, 2.25, 2.5]) {
    const shifts = fitter.shifts.slice(), a = coat.geometry.attributes, influences = coat.morphTargetInfluences;
    for (const id of fitter.vertices) for (let axis = 0; axis < 3; axis++) {
      for (const target of fitter.targets.slice(0, 2)) shifts[id * 3 + axis] += coat.geometry.morphAttributes.position[target].getComponent(id, axis) * influences[target] * (gain - 1.5);
    }
    for (const attachment of fitter.attachments) {
      const a = new THREE.Vector3().fromArray(fitter.base, attachment.a * 3), b = new THREE.Vector3().fromArray(fitter.base, attachment.b * 3), c = new THREE.Vector3().fromArray(fitter.base, attachment.c * 3);
      const u = b.clone().sub(a), v = c.clone().sub(a), normal = u.clone().cross(v).normalize();
      const matrix = new THREE.Matrix3().set(u.x, v.x, normal.x, u.y, v.y, normal.y, u.z, v.z, normal.z).invert();
      const point = new THREE.Vector3().fromArray(fitter.base, attachment.vertex * 3), local = point.clone().sub(a).applyMatrix3(matrix);
      local.z = Math.min(local.z, -attachment.inset);
      a.add(new THREE.Vector3().fromArray(shifts, attachment.a * 3)); b.add(new THREE.Vector3().fromArray(shifts, attachment.b * 3)); c.add(new THREE.Vector3().fromArray(shifts, attachment.c * 3));
      u.copy(b).sub(a); v.copy(c).sub(a); normal.copy(u).cross(v).normalize();
      a.addScaledVector(u, local.x).addScaledVector(v, local.y).addScaledVector(normal, local.z).sub(point).toArray(shifts, attachment.vertex * 3);
    }
    fitter.vertices.forEach((id: number, slot: number) => {
      const delta = new THREE.Vector3().fromArray(shifts, id * 3).applyMatrix3(new THREE.Matrix3().fromArray(fitter.inverses, slot * 9));
      a.position.setXYZ(id, fitter.original[id * 3] + delta.x, fitter.original[id * 3 + 1] + delta.y, fitter.original[id * 3 + 2] + delta.z);
    });
    const surface = faces(coat);
    checks.push({ gain, trouserContacts: crossings(surface, trousers, false).count, selfContacts: crossings(surface, surface, true).count });
  }
  coat.geometry.attributes.position.array.set(saved);
  result.push({ frame, rightHip: h.rig.bones.get('hip_R')!.rotation.x, leftHip: h.rig.bones.get('hip_L')!.rotation.x, checks });
}
await writeFile('kick-clearance-frozen-probe.json', JSON.stringify(result, null, 2)); console.log(JSON.stringify(result, null, 2)); h.models.dispose();
