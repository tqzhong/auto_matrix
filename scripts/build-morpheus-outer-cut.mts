// Author the leather layer from the real fitted shirt and relaxed body pose.
// The runtime consumes a baked cut; it does not repeat pose-space fitting.
import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { createHash } from 'node:crypto';
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { HeroModels } from '../packages/client/src/agents/HeroModel.js';
import { advanceMotion, newMotion, type MotionInput } from '../packages/client/src/agents/CharacterMotion.js';
import { PLAYER_WALK_SPEED, PLAYER_RUN_SPEED } from '@auto_matrix/shared';

const [sourcePath, outputPath] = process.argv.slice(2);
assert.ok(sourcePath && outputPath, 'Usage: node --import tsx scripts/build-morpheus-outer-cut.mts PRE_COAT.glb OUTPUT.glb');
assert.notEqual(resolve(sourcePath), resolve(outputPath), 'Keep the source intact and inspect staging before installing.');
const source = await readFile(sourcePath), jsonLength = source.readUInt32LE(12);
const document = JSON.parse(source.subarray(20, 20 + jsonLength).toString());
const node = document.nodes.find((node: { name?: string }) => node.name === 'morpheus-hammer-sweater');
assert.ok(node?.extras.ambushNeckStand && !node.extras.ambushCoatFit, 'Use the preserved fitted, sewn-neck Morpheus without an outer cut.');
const stripped = structuredClone(document);
for (const material of stripped.materials) { delete material.pbrMetallicRoughness.baseColorTexture; delete material.normalTexture; }
stripped.images = []; stripped.textures = [];
function pack(doc: object, binaryChunk: Buffer): Buffer {
  const json = Buffer.from(JSON.stringify(doc)), padded = Buffer.alloc(Math.ceil(json.length / 4) * 4, 32); json.copy(padded);
  const result = Buffer.alloc(20 + padded.length + binaryChunk.length);
  result.writeUInt32LE(0x46546c67); result.writeUInt32LE(2, 4); result.writeUInt32LE(result.length, 8);
  result.writeUInt32LE(padded.length, 12); result.writeUInt32LE(0x4e4f534a, 16); padded.copy(result, 20); binaryChunk.copy(result, 20 + padded.length); return result;
}
const input = pack(stripped, source.subarray(20 + jsonLength));
const asset = await new GLTFLoader().parseAsync(input.buffer.slice(input.byteOffset, input.byteOffset + input.byteLength), '');
const models = new HeroModels(new THREE.Texture(), new THREE.Texture());
(models as unknown as { load: () => Promise<typeof asset> }).load = async () => asset;
const rig = (await models.create('morpheus'))!, state = newMotion();
const motion: MotionInput = { speed: 0, turn: 0, grounded: true, verticalVelocity: 0, ambushWardrobe: 'shirt' };
models.animate(rig, advanceMotion(state, motion, 0), state, motion, 0); rig.root.updateMatrixWorld(true);
const shirt = rig.root.getObjectByName('morpheus-ambush-shirt') as THREE.SkinnedMesh;
const donor = rig.root.getObjectByName('morpheus-hammer-sweater') as THREE.SkinnedMesh;
const a = shirt.geometry.attributes, original = donor.geometry.attributes, index = donor.geometry.index!, count = original.position.count;
const fit = shirt.morphTargetDictionary!.ambushShirtFit;
const bindPoints = Array.from({ length: a.position.count }, (_, i) => new THREE.Vector3().fromBufferAttribute(a.position, i)
  .add(new THREE.Vector3().fromBufferAttribute(shirt.geometry.morphAttributes.position[fit], i)));
const posed = Array.from({ length: a.position.count }, (_, i) => shirt.getVertexPosition(i, new THREE.Vector3()));
const key = (p: THREE.Vector3) => p.toArray().map(value => value.toFixed(6)).join(',');
const keys = posed.map(key), sums = new Map(keys.map(key => [key, new THREE.Vector3()]));
for (let face = 0; face < index.count; face += 3) {
  const ids = [0, 1, 2].map(k => index.getX(face + k));
  const reference = ids.reduce((n, id) => n.add(new THREE.Vector3().fromBufferAttribute(a.normal, id))
    .add(new THREE.Vector3().fromBufferAttribute(shirt.geometry.morphAttributes.normal[fit], id)), new THREE.Vector3());
  const sign = new THREE.Triangle(...ids.map(id => bindPoints[id]) as [THREE.Vector3, THREE.Vector3, THREE.Vector3]).getNormal(new THREE.Vector3()).dot(reference) < 0 ? -1 : 1;
  const normal = new THREE.Vector3().subVectors(posed[ids[1]], posed[ids[0]])
    .cross(new THREE.Vector3().subVectors(posed[ids[2]], posed[ids[0]])).multiplyScalar(sign);
  for (const id of ids) sums.get(keys[id])!.add(normal);
}
const outerFor = new Map<number, number>();
for (let face = 0; face < index.count; face += 3) for (let edge = 0; edge < 3; edge++) {
  const first = index.getX(face + edge), second = index.getX(face + (edge + 1) % 3), inner = Math.max(first, second), outer = Math.min(first, second);
  if (Math.hypot(a.uv.getX(first) - a.uv.getX(second), a.uv.getY(first) - a.uv.getY(second)) > 1e-7) continue;
  const distance = bindPoints[first].distanceTo(bindPoints[second]);
  if (distance > .004 && distance < .025) outerFor.set(inner, outer);
}
const pivot = (name: string) => new THREE.Vector3().setFromMatrixPosition(shirt.skeleton.boneInverses[shirt.skeleton.bones.findIndex(bone => bone.name === name)].clone().invert());
const segments = ['R', 'L'].map(side => [new THREE.Line3(pivot('shoulder_' + side), pivot('elbow_' + side)), new THREE.Line3(pivot('elbow_' + side), pivot('wrist_' + side))]);
const bones = shirt.skeleton.bones.map((bone, i) => bone.matrixWorld.clone().multiply(shirt.skeleton.boneInverses[i]));
// A normal fitted only with relaxed arms can face inside the deformed sleeve
// during a strong swing. Intersect outward half-spaces from several real
// reference poses, producing one static bind-space cut for the whole cycle.
const references: THREE.Vector3[][] = [];
for (const [speed, end] of [[0, 0], [PLAYER_WALK_SPEED, 12], [PLAYER_RUN_SPEED, 12], [PLAYER_RUN_SPEED, 36], [PLAYER_RUN_SPEED, 60], [PLAYER_RUN_SPEED, 120]]) {
  const saved = newMotion(), input = { ...motion, speed };
  for (let frame = -59; frame <= end; frame++) models.animate(rig, advanceMotion(saved, input, 1 / 60), saved, input, 1 / 60);
  rig.root.updateMatrixWorld(true);
  const vertices = Array.from({ length: a.position.count }, (_, i) => shirt.getVertexPosition(i, new THREE.Vector3()));
  const keys = vertices.map(key), normals = new Map(keys.map(key => [key, new THREE.Vector3()]));
  for (let face = 0; face < index.count; face += 3) {
    const ids = [0, 1, 2].map(k => index.getX(face + k));
    const outward = ids.reduce((n, id) => n.add(new THREE.Vector3().fromBufferAttribute(a.normal, id))
      .add(new THREE.Vector3().fromBufferAttribute(shirt.geometry.morphAttributes.normal[fit], id)), new THREE.Vector3());
    const sign = new THREE.Triangle(...ids.map(id => bindPoints[id]) as [THREE.Vector3, THREE.Vector3, THREE.Vector3]).getNormal(new THREE.Vector3()).dot(outward) < 0 ? -1 : 1;
    const normal = new THREE.Vector3().subVectors(vertices[ids[1]], vertices[ids[0]])
      .cross(new THREE.Vector3().subVectors(vertices[ids[2]], vertices[ids[0]])).multiplyScalar(sign);
    for (const id of ids) normals.get(keys[id])!.add(normal);
  }
  const transforms = shirt.skeleton.bones.map((bone, i) => bone.matrixWorld.clone().multiply(shirt.skeleton.boneInverses[i]));
  references.push(Array.from({ length: count }, (_, i) => {
    const matrix = new THREE.Matrix4(); matrix.elements.fill(0);
    for (let k = 0; k < 4; k++) for (let component = 0; component < 16; component++)
      matrix.elements[component] += transforms[a.skinIndex.getComponent(i, k)].elements[component] * a.skinWeight.getComponent(i, k);
    matrix.multiply(shirt.bindMatrix).premultiply(shirt.bindMatrixInverse);
    return normals.get(keys[outerFor.get(i) ?? i])!.clone().normalize().applyMatrix3(new THREE.Matrix3().setFromMatrix4(matrix).transpose()).normalize();
  }));
}
let maximumConstraintError = 0, maximumShift = 0;
const points = bindPoints.slice(0, count).map((point, i) => {
  const arms = ['R', 'L'].map(side => [0, 1, 2, 3].reduce((sum, k) => sum +
    (new RegExp(`^(shoulder|elbow|wrist|forearm_twist)_${side}`).test(shirt.skeleton.bones[a.skinIndex.getComponent(i, k)].name) ? a.skinWeight.getComponent(i, k) : 0), 0));
  const neck = THREE.MathUtils.smoothstep(point.y, 3.65, 3.80) * (1 - THREE.MathUtils.smoothstep(Math.hypot(point.x, point.z - .08), .28, .4));
  const direction = new THREE.Vector3(point.x, 0, point.z - .08 * neck).normalize().multiplyScalar(1 - arms[0] - arms[1]);
  for (let side = 0; side < 2; side++) {
    const nearest = segments[side].map(line => line.closestPointToPoint(point, true, new THREE.Vector3())).sort((a, b) => a.distanceToSquared(point) - b.distanceToSquared(point))[0];
    direction.addScaledVector(point.clone().sub(nearest).normalize(), arms[side]);
  }
  // Ease the underarm without inflating both opposing surfaces into the
  // narrow gap. Elsewhere the parallel field preserves folded cuff returns.
  const pit = (1 - THREE.MathUtils.smoothstep(Math.abs(Math.abs(point.x) - .405), .045, .17))
    * (1 - THREE.MathUtils.smoothstep(Math.abs(point.y - 3.30), .09, .28))
    * (1 - THREE.MathUtils.smoothstep(Math.abs(point.z - .015), .13, .28));
  const normal = sums.get(keys[outerFor.get(i) ?? i])!.clone().normalize(), skin = new THREE.Matrix4(); skin.elements.fill(0);
  for (let k = 0; k < 4; k++) for (let component = 0; component < 16; component++)
    skin.elements[component] += bones[a.skinIndex.getComponent(i, k)].elements[component] * a.skinWeight.getComponent(i, k);
  skin.multiply(shirt.bindMatrix).premultiply(shirt.bindMatrixInverse);
  // Leave room for the actual folded dress collar, whose tips extend past
  // the shirt. A shirt-only envelope otherwise cuts through those tips.
  const collar = THREE.MathUtils.smoothstep(point.y, 3.48, 3.66) * (1 - THREE.MathUtils.smoothstep(Math.abs(point.x), .30, .45))
    * THREE.MathUtils.smoothstep(point.z, .08, .18);
  const waist = [0, 1, 2, 3].reduce((sum, k) => sum + (/^(pelvis|spine|chest|hip_[LR])$/.test(shirt.skeleton.bones[a.skinIndex.getComponent(i, k)].name) ? a.skinWeight.getComponent(i, k) : 0), 0);
  const rear = THREE.MathUtils.smoothstep(waist, .8, .99) * (1 - THREE.MathUtils.smoothstep(point.y, 2.45, 2.85))
    * (1 - THREE.MathUtils.smoothstep(point.z, -.18, -.02));
  const elbow = Math.max(...segments.map((arm, side) => arms[side] * THREE.MathUtils.smoothstep(point.z - arm[1].start.z, .03, .10)
    * (1 - THREE.MathUtils.smoothstep(Math.abs(point.y - arm[1].start.y), .12, .32))));
  const sideNeck = neck * THREE.MathUtils.smoothstep(Math.abs(point.x), .12, .22);
  const margin = THREE.MathUtils.lerp(THREE.MathUtils.lerp(.025 + .02 * neck + .012 * sideNeck + .045 * collar + .025 * rear, .001, pit), .004, elbow);
  const radial = point.clone().addScaledVector(direction.normalize(), margin).applyMatrix4(skin);
  const fitted = radial.lerp(posed[i].clone().addScaledVector(normal, margin), pit).applyMatrix4(skin.invert());
  if (pit > 0) {
    const delta = fitted.clone().sub(point), clearance = margin * pit;
    for (let pass = 0; pass < 24; pass++) for (const reference of references) {
      const distance = clearance - delta.dot(reference[i]); if (distance > 0) delta.addScaledVector(reference[i], distance);
    }
    for (const reference of references) maximumConstraintError = Math.max(maximumConstraintError, clearance - delta.dot(reference[i]));
    fitted.copy(point).add(delta);
  }
  maximumShift = Math.max(maximumShift, fitted.distanceTo(point)); return fitted;
});
assert.ok(maximumConstraintError < 1e-7 && maximumShift < .12, `Cannot fit the reference poses: residual ${maximumConstraintError}, shift ${maximumShift}.`);
const normalSums = new Map(points.map(point => [key(point), new THREE.Vector3()]));
for (let face = 0; face < index.count; face += 3) {
  const ids = [0, 1, 2].map(k => index.getX(face + k));
  const reference = ids.reduce((n, id) => n.add(new THREE.Vector3().fromBufferAttribute(a.normal, id))
    .add(new THREE.Vector3().fromBufferAttribute(shirt.geometry.morphAttributes.normal[fit], id)), new THREE.Vector3());
  const sign = new THREE.Triangle(...ids.map(id => bindPoints[id]) as [THREE.Vector3, THREE.Vector3, THREE.Vector3]).getNormal(new THREE.Vector3()).dot(reference) < 0 ? -1 : 1;
  const normal = new THREE.Vector3().subVectors(points[ids[1]], points[ids[0]])
    .cross(new THREE.Vector3().subVectors(points[ids[2]], points[ids[0]])).multiplyScalar(sign);
  for (const id of ids) normalSums.get(key(points[id]))!.add(normal);
}
const positions = new Float32Array(count * 3), normals = new Float32Array(count * 3);
for (let i = 0; i < count; i++) {
  points[i].clone().sub(new THREE.Vector3().fromBufferAttribute(original.position, i)).toArray(positions, i * 3);
  normalSums.get(key(points[i]))!.clone().normalize().sub(new THREE.Vector3().fromBufferAttribute(original.normal, i)).toArray(normals, i * 3);
}
assert.ok([...positions, ...normals].every(Number.isFinite));
const oldBinary = source.subarray(28 + jsonLength, 28 + jsonLength + document.buffers[0].byteLength), chunks = [oldBinary]; let offset = oldBinary.length;
function append(values: Float32Array): number {
  const padding = (4 - offset % 4) % 4; if (padding) { chunks.push(Buffer.alloc(padding)); offset += padding; }
  const bytes = Buffer.from(values.buffer, values.byteOffset, values.byteLength), view = document.bufferViews.length;
  document.bufferViews.push({ buffer: 0, byteOffset: offset, byteLength: bytes.length }); chunks.push(bytes); offset += bytes.length;
  const min = [Infinity, Infinity, Infinity], max = [-Infinity, -Infinity, -Infinity];
  for (let i = 0; i < values.length; i++) { min[i % 3] = Math.min(min[i % 3], values[i]); max[i % 3] = Math.max(max[i % 3], values[i]); }
  const accessor = document.accessors.length; document.accessors.push({ bufferView: view, componentType: 5126, count, type: 'VEC3', min, max }); return accessor;
}
const target = { POSITION: append(positions), NORMAL: append(normals) }, mesh = document.meshes[node.mesh];
assert.equal(mesh.primitives.length, 1); mesh.primitives[0].targets.push(target); mesh.extras.targetNames.push('ambushCoatFit'); mesh.weights.push(0);
if (node.weights) node.weights.push(0);
node.extras.ambushCoatFit = { version: 1, generator: 'scripts/build-morpheus-outer-cut.mts', sourceSHA256: createHash('sha256').update(source).digest('hex'), gap: .025, underarmGap: .001, neckEase: .02, sideNeckEase: .012, collarEase: .045, rearEase: .025, innerElbowGap: .004, referencePoses: references.length };
document.buffers[0].byteLength = offset;
const binary = Buffer.concat(chunks), chunk = Buffer.alloc(8 + binary.length); chunk.writeUInt32LE(binary.length); chunk.writeUInt32LE(0x004e4942, 4); binary.copy(chunk, 8);
const result = pack(document, chunk); await writeFile(outputPath, result);
await writeFile(`${outputPath}.json`, JSON.stringify({ source: resolve(sourcePath), output: resolve(outputPath), sourceSHA256: node.extras.ambushCoatFit.sourceSHA256,
  outputSHA256: createHash('sha256').update(result).digest('hex'), bytes: result.length, addedBytes: result.length - source.length, vertices: count,
  originalBinaryPrefixUnchanged: binary.subarray(0, oldBinary.length).equals(oldBinary), originalAttributesAndIndicesUnchanged: true, maximumConstraintError, maximumShift }, null, 2));
models.dispose(); console.log(`Baked ${count} outer cut vertices into ${outputPath}.`);
