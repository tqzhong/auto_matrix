import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import * as THREE from 'three';
import { makeModel, worldPoints } from '../morpheus-ambush-doff-2026-10-17/grip-fixture.mjs';
import { FrontExitBody } from './FrontExitBody.mjs';
import { FrontExitCuffs } from './FrontExitCuffs.mjs';

const base = new URL('./', import.meta.url);
const data = JSON.parse(await readFile(new URL('corrected-body-input/manifest.json', base), 'utf8'));
const verified = JSON.parse(await readFile(new URL('front-cuff-passage-verification.json', base), 'utf8'));
const h = await makeModel();
try {
  const body = new FrontExitBody(h.rig, 'front-exit');
  const path = new FrontExitCuffs(h.rig, body); body.pose(verified.worst.time);
  const skin = h.rig.root.getObjectByName('Anatomical_head_and_hands') as THREE.SkinnedMesh;
  const points = worldPoints(skin), ids = Array.from(skin.geometry.index!.array);
  const matrix = path.matrix(verified.worst.side, verified.worst.time);
  const cuff = verified.cuffs.find((value: { side: string }) => value.side === verified.worst.side);
  const ring: THREE.Vector3[] = cuff.ring.map((id: number) => new THREE.Vector3().fromArray(data.points[id]).applyMatrix4(matrix));
  const center = ring.reduce((sum, p) => sum.add(p), new THREE.Vector3()).divideScalar(ring.length);
  const normal = ring.reduce((sum, p, i) => sum.add(p.clone().sub(center).cross(ring[(i + 1) % ring.length].clone().sub(center))), new THREE.Vector3()).normalize();
  const x = ring[0].clone().sub(center).addScaledVector(normal, -ring[0].clone().sub(center).dot(normal)).normalize(), y = normal.clone().cross(x);
  const project = (p: THREE.Vector3) => [p.clone().sub(center).dot(x), p.clone().sub(center).dot(y)];
  const distances = points.map(p => p.clone().sub(center).dot(normal)), section = [];
  for (let i = 0; i < ids.length; i += 3) for (let j = 0; j < 3; j++) {
    const a = ids[i + j], b = ids[i + (j + 1) % 3];
    if (distances[a] * distances[b] >= 0) continue;
    const p = points[a].clone().lerp(points[b], -distances[a] / (distances[b] - distances[a]));
    if (p.distanceTo(center) < .375) section.push(project(p));
  }
  const sourceHashes: Record<string, string> = {};
  for (const file of ['diagnose-front-cuff.mts', 'front-cuff-passage-verification.json', 'FrontExitCuffs.mts', 'FrontExitBody.mts', 'corrected-body-input/manifest.json'])
    sourceHashes[file] = createHash('sha256').update(await readFile(new URL(file, base))).digest('hex');
  const result = { time: verified.worst.time, side: cuff.side, modelUnitsToMetres: .4,
    ring: ring.map(project), section, center: center.toArray(), normal: normal.toArray(),
    x: x.toArray(), y: y.toArray(), nonPlanarity: verified.worst.nonPlanarity, sourceHashes };
  await writeFile(new URL('front-cuff-section.json', base), JSON.stringify(result, null, 2));
  const bounds = (points: number[][]) => [0, 1].map(axis => [Math.min(...points.map(p => p[axis])), Math.max(...points.map(p => p[axis]))]);
  console.log(JSON.stringify({ time: result.time, side: result.side, ringBounds: bounds(result.ring), handSectionBounds: bounds(section), points: section.length }));
} finally { h.models.dispose(); }
