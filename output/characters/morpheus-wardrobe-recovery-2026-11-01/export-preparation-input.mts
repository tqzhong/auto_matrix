import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import * as THREE from 'three';
import { makeModel, meshSurface, worldPoints } from '../morpheus-ambush-doff-2026-10-17/grip-fixture.mjs';
import { auditCage } from '../morpheus-ambush-doff-2026-10-17/cloth-rebuild/cage-contact.mjs';
import { FrontExitBody } from './FrontExitBody.mjs';

const base = new URL('./', import.meta.url), folder = new URL('preparation-input/', base);
const data = JSON.parse(await readFile(new URL('front-standing-work/current-input/manifest.json', base), 'utf8'));
const h = await makeModel(), body = new FrontExitBody(h.rig, 'front-exit');
try {
  body.pose(0);
  const shirt = h.rig.root.getObjectByName('morpheus-ambush-shirt') as THREE.Mesh;
  const outer = [h.rig.root.getObjectByName('morpheus-ambush-coat'), h.rig.root.getObjectByName('morpheus-ambush-lapels'), ...h.rig.panels.map(panel => panel.mesh)];
  const inner: THREE.Mesh[] = [];
  h.rig.root.traverseVisible(object => { if (object instanceof THREE.Mesh && !outer.includes(object)) inner.push(object); });
  assert.equal(inner.length, 13);
  for (const [i, mesh] of inner.entries()) {
    assert.equal(mesh.name, data.bodies[i].name);
    assert.equal(mesh.geometry.attributes.position.count, data.bodies[i].count);
    assert.deepEqual(Array.from(mesh.geometry.index!.array), data.bodies[i].indices);
  }
  const bones = ['chest', 'wrist_R', 'wrist_L'];
  const inverse = bones.map(name => h.rig.bones.get(name)!.matrixWorld.clone().invert());
  await mkdir(folder);
  const frames = [];
  for (let frame = 1; frame <= 49; frame++) {
    const time = (frame - 1) / 60; body.pose(time);
    assert.ok(body.errors.every(error => error.distance < 1e-6));
    const audit = auditCage(meshSurface(shirt), inner.filter(mesh => mesh !== shirt).map(mesh => meshSurface(mesh)));
    assert.equal(audit.selfCount, 0, `shirt self-contact at ${time}`);
    assert.equal(audit.bodyCount, 0, `shirt/inner contact at ${time}`);
    const values = new Float32Array(inner.flatMap(mesh => worldPoints(mesh).flatMap(p => [.4 * p.x, -.4 * p.z, .4 * p.y])));
    await writeFile(new URL(`body-${frame}.bin`, folder), Buffer.from(values.buffer));
    frames.push({ frame, time, supports: bones.map((name, i) => h.rig.bones.get(name)!.matrixWorld.clone().multiply(inverse[i]).toArray()) });
  }
  const sourceHashes: Record<string, string> = {};
  for (const name of ['export-preparation-input.mts', 'FrontExitBody.mts', 'front-standing-work/current-input/manifest.json',
    '../../../packages/client/public/assets/characters/morpheus.glb', '../../../packages/client/src/agents/HeroModel.ts'])
    sourceHashes[name] = createHash('sha256').update(await readFile(new URL(name, base))).digest('hex');
  await writeFile(new URL('manifest.json', folder), JSON.stringify({ ...data, frames, sourceHashes,
    acceptedForProduction: false, scope: 'Only the verified 0–0.8 second worn-coat preparation; not the full eight-second removal.' }));
  console.log(JSON.stringify({ frames: frames.length, completeInnerLayers: inner.length, shirtChecks: frames.length, sourceHashes }));
} finally { h.models.dispose(); }
