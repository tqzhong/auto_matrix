import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { copyFile, mkdir, readFile, writeFile } from 'node:fs/promises';
import * as THREE from 'three';
import { makeModel, meshSurface, worldPoints } from '../morpheus-ambush-doff-2026-10-17/grip-fixture.mjs';
import { auditCage } from '../morpheus-ambush-doff-2026-10-17/cloth-rebuild/cage-contact.mjs';
import { FrontExitBody } from './FrontExitBody.mjs';

const base = new URL('./', import.meta.url), work = new URL('front-standing-work/', base), input = new URL('current-input/', work);
const data = JSON.parse(await readFile(new URL('current-input/manifest.json', base), 'utf8'));
const h = await makeModel(), body = new FrontExitBody(h.rig, 'front-exit');
try {
  body.pose(0);
  const clothes = ['morpheus-ambush-coat', 'morpheus-ambush-lapels'].map(name => h.rig.root.getObjectByName(name) as THREE.Mesh);
  clothes.push(...h.rig.panels.map(panel => panel.mesh));
  const inner: THREE.Mesh[] = [];
  h.rig.root.traverseVisible(object => { if (object instanceof THREE.Mesh && !clothes.includes(object)) inner.push(object); });
  assert.equal(inner.length, 13);
  const surfaces = clothes.map(mesh => meshSurface(mesh)), bodyInitial = inner.map(mesh => meshSurface(mesh));
  const sum = data.points.map(() => [0, 0, 0]), counts = new Uint32Array(sum.length);
  for (const [part, surface] of surfaces.entries()) {
    assert.equal(surface.name, data.surfaces[part].name);
    assert.deepEqual(surface.indices, data.surfaces[part].indices);
    assert.equal(surface.vertices.length, data.parts[part].vertices.length);
    surface.vertices.forEach((point, vertex) => {
      const id = data.parts[part].vertices[vertex];
      counts[id]++; for (let axis = 0; axis < 3; axis++) sum[id][axis] += point[axis];
    });
  }
  const points = sum.map((point, id) => { assert.ok(counts[id]); return point.map(value => value / counts[id]); });
  let maximumWeldError = 0;
  for (const [part, surface] of surfaces.entries()) surface.vertices.forEach((point, vertex) => {
    const welded = points[data.parts[part].vertices[vertex]];
    maximumWeldError = Math.max(maximumWeldError, Math.hypot(...point.map((value, axis) => value - welded[axis])));
  });
  assert.ok(maximumWeldError < 1e-7, 'The old source IDs no longer represent coincident source vertices.');
  assert.equal(data.indices.length / 3, 26916);
  const audit = auditCage({ vertices: points, indices: data.indices }, bodyInitial);
  assert.equal(audit.selfCount, 0); assert.equal(audit.bodyCount, 0);
  const sourceHashes: Record<string, string> = {};
  for (const name of ['export-front-standing.mts', 'FrontExitBody.mts', 'current-input/manifest.json',
    'boundary-controls.json', '../../../packages/client/public/assets/characters/morpheus.glb', '../../../packages/client/src/agents/HeroModel.ts'])
    sourceHashes[name] = createHash('sha256').update(await readFile(new URL(name, base))).digest('hex');
  const wristBase = Object.fromEntries(['R', 'L'].map(side => [side, h.rig.bones.get(`wrist_${side}`)!.matrixWorld.toArray()]));
  const manifest = { ...data, points, surfaces, bodyInitial,
    bodies: bodyInitial.map(surface => ({ name: surface.name, count: surface.vertices.length, indices: surface.indices })),
    wristBase, frames: [{ frame: 1, time: 0, cuffs: Object.entries(wristBase).map(([side, matrix]) => ({ side, matrix })), reachErrors: [] }],
    sourceHashes, maximumWeldError, acceptedForProduction: false,
    scope: 'Actual standing start of the front-exit body; all displayed garment faces and thirteen inner layers retained. This is an initial cage-authoring control, not a completed removal.' };
  await mkdir(work); await mkdir(input);
  await writeFile(new URL('manifest.json', input), JSON.stringify(manifest));
  const flat = new Float32Array(inner.flatMap(mesh => worldPoints(mesh).flatMap(p => [.4 * p.x, -.4 * p.z, .4 * p.y])));
  await writeFile(new URL('body-1.bin', input), Buffer.from(flat.buffer));
  for (const name of ['build-boundary-cage.py', 'boundary-controls.json', 'fit-boundary-cage.py']) await copyFile(new URL(name, base), new URL(name, work));
  const receipt = { sourceHashes, vertices: points.length, faces: data.indices.length / 3, visibleInnerLayers: inner.length,
    maximumWeldError, self: audit.selfCount, body: audit.bodyCount, acceptedForProduction: false };
  await writeFile(new URL('front-standing-input-verification.json', base), JSON.stringify(receipt, null, 2));
  console.log(JSON.stringify(receipt));
} finally { h.models.dispose(); }
