import { writeFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { model, crossings, meshSurface } from './release/output/characters/morpheus-upper-coat-2026-10-18/mesh-fixture.mjs';
import { advanceMotion, newMotion } from './release/packages/client/src/agents/CharacterMotion.js';

function faces(mesh: THREE.Mesh) {
  if (mesh instanceof THREE.SkinnedMesh) mesh.skeleton.update();
  const a = mesh.geometry.attributes, index = mesh.geometry.index!;
  const points = Array.from({ length: a.position.count }, (_, i) => mesh.getVertexPosition(i, new THREE.Vector3()).applyMatrix4(mesh.matrixWorld));
  return Array.from({ length: index.count / 3 }, (_, face) => {
    const ids = [0, 1, 2].map(n => index.getX(face * 3 + n)), vertices = ids.map(id => points[id]);
    return { face, ids, points: vertices, box: new THREE.Box3().setFromPoints(vertices) };
  });
}
const target = Number(process.argv[2] ?? 72), start = process.argv[3] === 'start' ? 0 : -59;
const h = await model(), state = newMotion(), input = { speed: 8.4, grounded: true, verticalVelocity: 0, turn: 0, ambushWardrobe: 'coat' as const };
const contacts: unknown[] = []; let stopped: number | undefined, failure: unknown;
try {
  for (let frame = start; frame <= target; frame++) {
    stopped = frame; h.models.animate(h.rig, advanceMotion(state, input, 1 / 60), state, input, 1 / 60);
  }
  h.rig.root.updateMatrixWorld(true);
  const tails = h.rig.panels.map(panel => panel.mesh), surfaces = tails.map(faces);
  h.rig.root.traverseVisible(object => {
    if (!(object instanceof THREE.Mesh) || tails.includes(object)) return;
    const body = faces(object);
    surfaces.forEach((surface, side) => {
      const result = crossings(surface, body, false); if (result.count) contacts.push({ side, name: object.name, ...result });
    });
  });
  surfaces.forEach((surface, side) => { const result = crossings(surface, surface, true); if (result.count) contacts.push({ side, name: 'self', ...result }); });
  const between = crossings(surfaces[0], surfaces[1], false); if (between.count) contacts.push({ name: 'between', ...between });
} catch (error) {
  failure = { message: (error as Error).message, stack: (error as Error).stack, fixture: (error as any).fixture }; process.exitCode = 1;
}
const garments: ReturnType<typeof meshSurface>[] = [];
h.rig.root.updateMatrixWorld(true); h.rig.root.traverseVisible(object => { if (object instanceof THREE.Mesh) garments.push(meshSurface(object)); });
assert.ok(garments.length >= 15, 'the diagnostic must include the actual body and costume, not only the tails');
const result = { target, start, stopped, state, failure, contacts, meshes: garments };
const filename = `sewn-pose-${start}-${target}.json`; await writeFile(filename, JSON.stringify(result));
console.log(JSON.stringify({ filename, target, stopped, failure: failure ? (failure as any).message : undefined, contacts }, null, 2)); h.models.dispose();
