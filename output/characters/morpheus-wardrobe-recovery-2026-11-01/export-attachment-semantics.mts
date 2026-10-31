import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import * as THREE from 'three';
import { makeModel } from '../morpheus-ambush-doff-2026-10-17/grip-fixture.mjs';

const base = new URL('./', import.meta.url);
const data = JSON.parse(await readFile(new URL('full-removal-input/manifest.json', base), 'utf8'));
const h = await makeModel();
const coat = h.rig.root.getObjectByName('morpheus-ambush-coat') as THREE.SkinnedMesh;
const ids = data.parts[0].vertices;
assert.equal(ids.length, coat.geometry.attributes.position.count);
const arm: Record<string, number> = {}, torso: Record<string, number> = {}, joints: Record<string, unknown> = {};
for (const [i, id] of ids.entries()) {
  const weighted = [0, 1, 2, 3].map(k => ({
    name: coat.skeleton.bones[coat.geometry.attributes.skinIndex.getComponent(i, k)].name,
    weight: coat.geometry.attributes.skinWeight.getComponent(i, k),
  }));
  arm[id] = Math.max(arm[id] ?? 0, weighted.reduce((sum, value) => sum + (/^(shoulder|elbow|wrist|finger|forearm_twist)/.test(value.name) ? value.weight : 0), 0));
  torso[id] = Math.max(torso[id] ?? 0, weighted.reduce((sum, value) => sum + (/^(pelvis|spine|chest|hip_)/.test(value.name) ? value.weight : 0), 0));
  joints[id] = weighted;
}
await writeFile(new URL('attachment-semantics.json', base), JSON.stringify({ points: data.points, coatIds: [...new Set(ids)], arm, torso, joints }));
console.log(JSON.stringify({ vertices: Object.keys(arm).length, bones: coat.skeleton.bones.map(bone => bone.name) }));
h.models.dispose();
