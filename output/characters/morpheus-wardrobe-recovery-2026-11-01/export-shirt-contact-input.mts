import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import * as THREE from 'three';
import { AMBUSH_DOFF } from '@auto_matrix/shared';
import { makeModel, meshSurface, worldPoints } from '../morpheus-ambush-doff-2026-10-17/grip-fixture.mjs';
import { auditCage } from '../morpheus-ambush-doff-2026-10-17/cloth-rebuild/cage-contact.mjs';
import { FrontExitBody } from './FrontExitBody.mjs';

const base = new URL('./', import.meta.url), directory = new URL(process.argv[2] ?? './shirt-contact-input/', base);
const h = await makeModel(), body = new FrontExitBody(h.rig, 'front-exit');
body.pose(0);
const shirt = h.rig.root.getObjectByName('morpheus-ambush-shirt') as THREE.SkinnedMesh;
const outer = [h.rig.root.getObjectByName('morpheus-ambush-coat'), h.rig.root.getObjectByName('morpheus-ambush-lapels'), ...h.rig.panels.map(panel => panel.mesh)];
const others: THREE.Mesh[] = [];
h.rig.root.traverseVisible(object => { if (object instanceof THREE.Mesh && object !== shirt && !outer.includes(object)) others.push(object); });
assert.equal(others.length, 12);
const first = meshSurface(shirt), otherFirst = others.map(mesh => meshSurface(mesh));
const initial = auditCage(first, otherFirst);
assert.equal(initial.selfCount, 0);
assert.equal(initial.bodyCount, 0);
const { skinIndex, skinWeight } = shirt.geometry.attributes;
const torso = Array.from({ length: skinIndex.count }, (_, i) => [0, 1, 2, 3].reduce((sum, k) => sum
  + (/^(pelvis|spine|chest|hip_)/.test(shirt.skeleton.bones[skinIndex.getComponent(i, k)].name) ? skinWeight.getComponent(i, k) : 0), 0));
const sourceHashes: Record<string, string> = {};
for (const file of ['FrontExitBody.mts', 'export-shirt-contact-input.mts', '../../../packages/client/public/assets/characters/morpheus.glb', '../../../packages/client/src/agents/HeroModel.ts'])
  sourceHashes[file] = createHash('sha256').update(await readFile(new URL(file, base))).digest('hex');
await mkdir(directory);
const frames = [];
const coordinates = (meshes: THREE.Mesh[]) => new Float64Array(meshes.flatMap(mesh => worldPoints(mesh).flatMap(point => [.4 * point.x, -.4 * point.z, .4 * point.y])));
for (let frame = 1; frame <= Math.round(AMBUSH_DOFF.duration * 60) + 1; frame++) {
  const time = (frame - 1) / 60; body.pose(time);
  assert.ok(body.errors.every(error => error.distance < 1e-6));
  const cloth = coordinates([shirt]), inner = coordinates(others);
  assert.ok(cloth.every(Number.isFinite) && inner.every(Number.isFinite));
  await writeFile(new URL(`shirt-${frame}.bin`, directory), Buffer.from(cloth.buffer));
  await writeFile(new URL(`body-${frame}.bin`, directory), Buffer.from(inner.buffer));
  frames.push({ frame, time });
  if (frame % 60 === 1) console.log(JSON.stringify({ frame, time }));
}
await writeFile(new URL('manifest.json', directory), JSON.stringify({
  frames, shirt: { name: first.name, count: first.vertices.length, indices: first.indices, torso },
  bodies: otherFirst.map(surface => ({ name: surface.name, count: surface.vertices.length, indices: surface.indices })),
  sourceHashes, acceptedForProduction: false,
  scope: 'Actual anatomical body and complete raw shirt targets at 60 Hz. The outer coat and corrected shirt remain unaccepted.',
}));
console.log(JSON.stringify({ frames: frames.length, shirtVertices: first.vertices.length, shirtFaces: first.indices.length / 3, otherLayers: others.length }));
h.models.dispose();
