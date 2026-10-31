import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import * as THREE from 'three';
import { makeModel, meshSurface, worldPoints } from '../morpheus-ambush-doff-2026-10-17/grip-fixture.mjs';
import { FrontExitBody } from './FrontExitBody.mjs';

const base = new URL('./', import.meta.url), folder = new URL('corrected-body-input/', base);
const load = async (file: string) => JSON.parse(await readFile(new URL(file, base), 'utf8'));
const verification = await load('shirt-contact-transport-display-verification.json');
assert.equal(verification.passed, true, 'Require the independent full displayed-shirt gate.');
assert.equal(verification.wholeEightSecondsPresent, true);
const reportBytes = await readFile(new URL('shirt-contact-transport/report.json', base));
assert.equal(createHash('sha256').update(reportBytes).digest('hex'), verification.reportSha256);
assert.equal(createHash('sha256').update(await readFile(new URL('verify-shirt-contact.mts', base))).digest('hex'), verification.verifierSha256);
const report = JSON.parse(reportBytes.toString()), input = await load('shirt-contact-input/manifest.json');
const template = await load('front-standing-work/current-input/manifest.json');
const mapping: number[] = await load('shirt-contact-transport/source-to-weld.json');
for (const [file, hash] of Object.entries(input.sourceHashes))
  assert.equal(createHash('sha256').update(await readFile(new URL(file, base))).digest('hex'), hash, file);
const samples = [{ time: 0, sourceFrame: 1, fraction: 0, file: 'cloth-1.bin' }];
for (const record of report) for (const key of record.keys) samples.push({
  time: key.fraction === 1 ? record.time : record.time - (1 - key.fraction) / 60,
  sourceFrame: record.frame, fraction: key.fraction, file: key.file,
});
assert.equal(samples.at(-1)!.time, 8);
const h = await makeModel(), body = new FrontExitBody(h.rig, 'front-exit');
try {
  body.pose(0);
  const coat = ['morpheus-ambush-coat', 'morpheus-ambush-lapels'].map(name => h.rig.root.getObjectByName(name) as THREE.Mesh);
  coat.push(...h.rig.panels.map(panel => panel.mesh));
  for (const [i, mesh] of coat.entries()) {
    const surface = meshSurface(mesh);
    assert.deepEqual(surface.indices, template.surfaces[i].indices);
    for (const [id, point] of surface.vertices.entries())
      assert.ok(Math.hypot(...point.map((value, axis) => value - template.surfaces[i].vertices[id][axis])) < 1e-12);
  }
  const inner: THREE.Mesh[] = [];
  h.rig.root.traverseVisible(object => { if (object instanceof THREE.Mesh && !coat.includes(object)) inner.push(object); });
  assert.equal(inner.length, 13);
  for (const [i, mesh] of inner.entries()) {
    assert.equal(mesh.name, template.bodies[i].name);
    assert.equal(mesh.geometry.attributes.position.count, template.bodies[i].count);
    assert.deepEqual(Array.from(mesh.geometry.index!.array), template.bodies[i].indices);
  }
  const sourceHashes: Record<string, string> = {};
  for (const file of ['export-corrected-body-input.mts', 'FrontExitBody.mts', 'shirt-contact-input/manifest.json',
    'shirt-contact-transport/metadata.json', 'shirt-contact-transport/report.json', 'shirt-contact-transport-display-verification.json',
    'front-standing-work/current-input/manifest.json', '../../../packages/client/public/assets/characters/morpheus.glb', '../../../packages/client/src/agents/HeroModel.ts'])
    sourceHashes[file] = createHash('sha256').update(await readFile(new URL(file, base))).digest('hex');
  await mkdir(folder);
  const frames = [], digest = createHash('sha256');
  let first: Float32Array | undefined, last: Float32Array | undefined, initial: typeof template.bodyInitial;
  for (const [index, sample] of samples.entries()) {
    body.pose(sample.time);
    const bytes = await readFile(new URL(`shirt-contact-transport/${sample.file}`, base));
    const shirt = new Float64Array(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength));
    const values: number[] = [];
    for (const mesh of inner) {
      if (mesh.name === input.shirt.name) for (const id of mapping) values.push(shirt[id * 3], shirt[id * 3 + 1], shirt[id * 3 + 2]);
      else for (const point of worldPoints(mesh)) values.push(.4 * point.x, -.4 * point.z, .4 * point.y);
    }
    const coordinates = new Float32Array(values);
    assert.equal(coordinates.length, 51490 * 3);
    assert.ok(coordinates.every(Number.isFinite));
    const filename = `body-${index + 1}.bin`, buffer = Buffer.from(coordinates.buffer);
    await writeFile(new URL(filename, folder), buffer);
    digest.update(filename + '\0').update(createHash('sha256').update(buffer).digest());
    if (!first) {
      first = coordinates.slice(); let offset = 0;
      initial = template.bodyInitial.map((part: { count: number }) => {
        const vertices = Array.from({ length: part.count }, (_, i) => {
          const k = (offset + i) * 3; return [coordinates[k] / .4, coordinates[k + 2] / .4, -coordinates[k + 1] / .4];
        });
        offset += part.count; return { ...part, vertices };
      });
    }
    last = coordinates;
    const previousTime = index ? samples[index - 1].time : 0;
    assert.ok(index === 0 || sample.time > previousTime);
    frames.push({ frame: index + 1, time: sample.time, deltaSeconds: sample.time - previousTime,
      sourceFrame: sample.sourceFrame, sourceFraction: sample.fraction, shirtSourceFile: sample.file,
      wrists: ['R', 'L'].map(side => h.rig.bones.get(`wrist_${side}`)!.matrixWorld.toArray()) });
    if (index % 100 === 0) console.log(JSON.stringify({ frame: index + 1, time: sample.time }));
  }
  let standingBoundaryErrorMetres = 0;
  for (let i = 0; i < first!.length; i += 3) standingBoundaryErrorMetres = Math.max(standingBoundaryErrorMetres,
    Math.hypot(last![i] - first![i], last![i + 1] - first![i + 1], last![i + 2] - first![i + 2]));
  assert.ok(standingBoundaryErrorMetres < 1e-6);
  const receipt = { frameCount: frames.length, vertices: 51490, innerLayers: 13,
    minimumDeltaSeconds: Math.min(...frames.slice(1).map(frame => frame.deltaSeconds)), endTime: frames.at(-1)!.time,
    standingBoundaryErrorMetres, bodyGeometrySha256: digest.digest('hex'), sourceHashes, acceptedForProduction: false };
  await writeFile(new URL('manifest.json', folder), JSON.stringify({ ...template, bodyInitial: initial!, frames, ...receipt,
    scope: 'All thirteen visible inner layers with the independently checked shirt. Every adaptive shirt key is retained at its actual timestamp. Native sampling/time-step control and full outer-coat dynamics are separate gates.' }));
  await writeFile(new URL('corrected-body-input-verification.json', base), JSON.stringify(receipt, null, 2));
  console.log(JSON.stringify(receipt));
} finally { h.models.dispose(); }
