import { writeFile } from 'node:fs/promises';
import * as THREE from 'three';
import { model, faces, crossings } from './baseline-fixture.mjs';
import { advanceMotion, newMotion } from './release/packages/client/src/agents/CharacterMotion.js';

function path(points: THREE.Vector3[], radius: number, span: number) {
  const [shoulder, elbow, wrist] = points, before = elbow.clone().sub(shoulder).normalize(), after = wrist.clone().sub(elbow).normalize();
  const angle = before.angleTo(after), axis = before.clone().cross(after).normalize();
  radius = Math.min(radius, span * .98 / Math.max(1e-8, Math.tan(angle / 2)));
  const cut = radius * Math.tan(angle / 2), straight = span - cut, arc = radius * angle, length = straight * 2 + arc;
  const start = elbow.clone().addScaledVector(before, -span), a = elbow.clone().addScaledVector(before, -cut), b = elbow.clone().addScaledVector(after, cut);
  const inward = after.clone().addScaledVector(before, -Math.cos(angle)).normalize(), centre = a.clone().addScaledVector(inward, radius), radial = a.clone().sub(centre);
  const sample = (distance: number) => {
    if (distance <= straight) return { centre: start.clone().addScaledVector(before, distance), tangent: before.clone() };
    if (distance >= straight + arc) return { centre: b.clone().addScaledVector(after, distance - straight - arc), tangent: after.clone() };
    const turn = (distance - straight) / radius;
    return { centre: centre.clone().add(radial.clone().applyAxisAngle(axis, turn)), tangent: before.clone().applyAxisAngle(axis, turn) };
  };
  const closest = (point: THREE.Vector3) => {
    const first = new THREE.Line3(start, a), last = new THREE.Line3(b, elbow.clone().addScaledVector(after, span));
    const left = first.closestPointToPointParameter(point, true), right = last.closestPointToPointParameter(point, true);
    const relative = point.clone().sub(centre).addScaledVector(axis, -point.clone().sub(centre).dot(axis));
    const turn = THREE.MathUtils.clamp(Math.atan2(axis.dot(radial.clone().cross(relative)), radial.dot(relative)), 0, angle);
    const candidates = [left * straight, straight + turn * radius, straight + arc + right * straight];
    return candidates.reduce((best, distance) => sample(distance).centre.distanceToSquared(point) < sample(best).centre.distanceToSquared(point) ? distance : best, candidates[0]);
  };
  return { sample, closest, length, radius, angle, before, after };
}
const basis = (tangent: THREE.Vector3, reference: THREE.Vector3) => {
  const normal = reference.clone().addScaledVector(tangent, -reference.dot(tangent)).normalize(); return { normal, binormal: tangent.clone().cross(normal).normalize() };
};
const h = await model(), state = newMotion(), input = { speed: 0, grounded: true, verticalVelocity: 0, turn: 0, attack: 1, combo: 2, ambushWardrobe: 'coat' as const };
for (let frame = 0; frame <= 15; frame++) h.models.animate(h.rig, advanceMotion(state, input, 1 / 60), state, input, 1 / 60);
h.rig.root.updateMatrixWorld(true);
const meshes = ['morpheus-ambush-coat', 'morpheus-ambush-shirt'].map(name => h.rig.root.getObjectByName(name) as THREE.SkinnedMesh), saved = meshes.map(mesh => (mesh.geometry.attributes.position.array as Float32Array).slice());
const results = [];
for (const radius of [0, .20, .22, .25]) {
  const counts = []; let maximumShift = 0;
  for (const [part, mesh] of meshes.entries()) {
    const a = mesh.geometry.attributes; (a.position.array as Float32Array).set(saved[part]);
    const index = (name: string) => mesh.skeleton.bones.findIndex(bone => bone.name === name), inverse = mesh.matrixWorld.clone().invert();
    const bind = (name: string) => new THREE.Vector3().setFromMatrixPosition(mesh.skeleton.boneInverses[index(name)].clone().invert()).applyMatrix4(mesh.bindMatrixInverse);
    const posed = (name: string) => new THREE.Vector3().setFromMatrixPosition(h.rig.bones.get(name)!.matrixWorld).applyMatrix4(inverse);
    const arms = ['R', 'L'].map(side => {
      const names = ['shoulder', 'elbow', 'wrist'].map(name => name + '_' + side), rest = names.map(bind), actual = names.map(posed), span = .5;
      const restMatrix = mesh.bindMatrixInverse.clone().multiply(mesh.skeleton.boneInverses[index('elbow_' + side)].clone().invert());
      const reference = new THREE.Vector3(1, 0, 0).transformDirection(restMatrix);
      return { side, span, elbow: rest[1], rest: path(rest, radius || .22, span), posed: path(actual, radius || .22, span), reference,
        axis: rest[1].clone().sub(rest[0]).normalize().add(rest[2].clone().sub(rest[1]).normalize()).normalize() };
    });
    const frames = mesh.skeleton.bones.map((bone, id) => {
      const matrix = mesh.bindMatrixInverse.clone().multiply(bone.matrixWorld).multiply(mesh.skeleton.boneInverses[id]).multiply(mesh.bindMatrix), rotation = new THREE.Quaternion();
      matrix.decompose(new THREE.Vector3(), rotation, new THREE.Vector3()); return { matrix, rotation };
    });
    let count = 0;
    for (let id = 0; id < a.position.count && radius; id++) {
      const weights = arms.map(arm => {
        let weight = 0;
        for (let k = 0; k < 4; k++) if (new RegExp(`^(shoulder|elbow|wrist|forearm_twist)_${arm.side}`).test(mesh.skeleton.bones[a.skinIndex.getComponent(id, k)].name)) weight += a.skinWeight.getComponent(id, k);
        return weight;
      });
      const side = weights[0] > weights[1] ? 0 : 1, arm = arms[side]; if (weights[side] < .99) continue;
      const morph = new THREE.Vector3(), point = new THREE.Vector3().fromBufferAttribute(a.position, id);
      for (const [target, delta] of (mesh.geometry.morphAttributes.position ?? []).entries()) morph.addScaledVector(new THREE.Vector3().fromBufferAttribute(delta, id), mesh.morphTargetInfluences![target]);
      point.add(morph); if (Math.abs(point.clone().sub(arm.elbow).dot(arm.axis)) >= arm.span) continue;
      const distance = arm.rest.closest(point), u = distance / arm.rest.length;
      const first = arm.rest.sample(distance), second = arm.posed.sample(distance - (arm.rest.length - arm.posed.length) * THREE.MathUtils.smoothstep(u, 0, 1));
      const rotation = new THREE.Vector4(0, 0, 0, 0), skin = new THREE.Matrix4(); skin.elements.fill(0); let reference: THREE.Quaternion | undefined;
      for (let k = 0; k < 4; k++) {
        const weight = a.skinWeight.getComponent(id, k); if (!weight) continue;
        const frame = frames[a.skinIndex.getComponent(id, k)]; reference ??= frame.rotation;
        rotation.addScaledVector(new THREE.Vector4(frame.rotation.x, frame.rotation.y, frame.rotation.z, frame.rotation.w), weight * (reference.dot(frame.rotation) < 0 ? -1 : 1));
        for (let n = 0; n < 16; n++) skin.elements[n] += frame.matrix.elements[n] * weight;
      }
      rotation.normalize(); const orientation = new THREE.Quaternion(rotation.x, rotation.y, rotation.z, rotation.w);
      const before = basis(first.tangent, arm.reference), after = basis(second.tangent, arm.reference.clone().applyQuaternion(orientation)), offset = point.clone().sub(first.centre);
      const desired = second.centre.clone().addScaledVector(after.normal, offset.dot(before.normal)).addScaledVector(after.binormal, offset.dot(before.binormal)).addScaledVector(second.tangent, offset.dot(first.tangent));
      maximumShift = Math.max(maximumShift, desired.distanceTo(mesh.getVertexPosition(id, new THREE.Vector3())));
      skin.elements[15] = 1; const corrected = desired.applyMatrix4(skin.invert()).sub(morph); a.position.setXYZ(id, corrected.x, corrected.y, corrected.z); count++;
    }
    counts.push(count);
  }
  const coat = faces(meshes[0]), shirt = faces(meshes[1]);
  results.push({ radius, counts, maximumShift, coatSelf: crossings(coat, coat, true), shirtSelf: crossings(shirt, shirt, true), layers: crossings(coat, shirt, false) });
}
await writeFile('rounded-elbow-probe.json', JSON.stringify(results, null, 2)); console.log(JSON.stringify(results, null, 2)); h.models.dispose();
