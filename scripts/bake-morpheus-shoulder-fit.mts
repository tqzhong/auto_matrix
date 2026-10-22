// Pack a validated bind-space position/normal cut without changing the original GLB binary.
import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { createHash } from 'node:crypto';

const [sourcePath, fitPath, outputPath] = process.argv.slice(2);
assert.ok(sourcePath && fitPath && outputPath, 'Usage: node --import tsx scripts/bake-morpheus-shoulder-fit.mts ORIGINAL.glb VALIDATED_FIT.json OUTPUT.glb');
assert.notEqual(resolve(sourcePath), resolve(outputPath), 'Preserve the original asset.');
const source = await readFile(sourcePath), length = source.readUInt32LE(12), binary = source.subarray(20 + length);
const document = JSON.parse(source.subarray(20, 20 + length).toString()), fit = JSON.parse(await readFile(fitPath, 'utf8'));
const node = document.nodes.find((node: {name?: string}) => node.name === 'morpheus-hammer-sweater');
assert.ok(node?.extras.ambushCoatFit && !node.extras.ambushShoulderFit, 'Use the preserved sewn-neck outer cut before shoulder fitting.');
const parts = Object.fromEntries(['shirt', 'coat'].map(name => {
  const part = fit.parts.find((part: {name: string}) => part.name === `morpheus-ambush-${name}`);
  const expected = name === 'shirt' ? 11977 : 11138;
  assert.equal(part.delta.length, expected * 3); assert.equal(part.normals.length, expected * 3);
  const data = Buffer.alloc(expected * 48);
  for (let id = 0; id < expected; id++) for (let axis = 0; axis < 3; axis++) {
    const position = part.delta[id * 3 + axis], normal = part.normals[id * 3 + axis];
    assert.ok(Number.isFinite(position) && Number.isFinite(normal));
    data.writeDoubleLE(position, (id * 6 + axis) * 8); data.writeDoubleLE(normal, (id * 6 + axis + 3) * 8);
  }
  return [name, {vertexCount: expected, data: data.toString('base64')}];
}));
node.extras.ambushShoulderFit = {version: 1, generator: 'scripts/bake-morpheus-shoulder-fit.mts', sourceSHA256: createHash('sha256').update(source).digest('hex'), correctiveSHA256: createHash('sha256').update(await readFile(fitPath)).digest('hex'), encoding: 'interleaved float64 LE: position delta xyz, normal delta xyz', ...parts};
const json = Buffer.from(JSON.stringify(document)), padded = Buffer.alloc(Math.ceil(json.length / 4) * 4, 32); json.copy(padded);
const result = Buffer.alloc(20 + padded.length + binary.length);
result.writeUInt32LE(0x46546c67); result.writeUInt32LE(2, 4); result.writeUInt32LE(result.length, 8);
result.writeUInt32LE(padded.length, 12); result.writeUInt32LE(0x4e4f534a, 16); padded.copy(result, 20); binary.copy(result, 20 + padded.length);
assert.ok(result.subarray(20 + padded.length).equals(binary));
await writeFile(outputPath, result, {flag: 'wx'});
const report = {sourceSHA256: node.extras.ambushShoulderFit.sourceSHA256, outputSHA256: createHash('sha256').update(result).digest('hex'), sourceBytes: source.length, outputBytes: result.length, addedBytes: result.length - source.length, originalBinaryUnchanged: true, originalAttributesAndTopologyUnchanged: true};
await writeFile(`${outputPath}.json`, JSON.stringify(report, null, 2) + '\n', {flag: 'wx'}); console.log(JSON.stringify(report));
