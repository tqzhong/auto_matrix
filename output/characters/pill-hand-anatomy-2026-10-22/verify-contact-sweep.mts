import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';
import { performance } from 'node:perf_hooks';
import * as THREE from 'three';
import { FILM_SETS, PILL_ROOM, pillRoot } from '@auto_matrix/shared';
import { crossings as original } from './all-hand-crossings.mjs';
import { selfIntersections as fine } from './hand-self-sweep.mjs';
import { advanceMotion, newMotion } from './candidate-release/packages/client/src/agents/CharacterMotion.js';
const reports: unknown[] = [];
for (const version of ['baseline', 'candidate']) {
  const { actor } = await import(`./${version}-release/tests/helpers/fighting-hand-fixture.mjs`);
  const { handSurface } = await import(`./${version}-release/tests/helpers/hand-surface.mjs`);
  const h = await actor('neo');
  try {
    const surfaces = Object.fromEntries(['R', 'L'].map(side => [side, handSurface(h.rig, side)]));
    for (const choice of ['red', 'blue'] as const) for (const elapsed of [1.1, 1.8, 7.3]) {
      const pills = { role: 'neo' as const, phase: 'taking' as const, elapsed, choice }, center = FILM_SETS.film_lafayette.center;
      const at = pillRoot({ ...pills, approach: { x: PILL_ROOM.seat, z: PILL_ROOM.z, yaw: -Math.PI / 2 } });
      h.rig.root.position.set(center.x + at.x, center.y - 1, center.z + at.z); h.rig.root.rotation.y = at.yaw;
      const input = { speed: 0, grounded: true, verticalVelocity: 0, turn: 0, pills }, state = newMotion();
      h.models.animate(h.rig, advanceMotion(state, input, 0), state, input, 0); h.rig.root.updateMatrixWorld(true);
      const surface = surfaces[elapsed > 4.1 || choice === 'blue' ? 'R' : 'L'], points = surface.posePoints();
      const faces = surface.triangles.map(t => {
        const vertices = t.ids.map(id => points.get(id)!);
        return { face: t.face, ids: t.ids.map(id => surface.weld[id]), points: vertices, box: new THREE.Box3().setFromPoints(vertices) };
      });
      const start = performance.now(), a = original(faces, faces), middle = performance.now(), b = fine(faces), end = performance.now();
      const pairs = (r: typeof a) => r.examples.map(c => [c.first, c.second, c.line]).sort((a, b) => a[0] - b[0] || a[1] - b[1]);
      assert.deepEqual(pairs(b), pairs(a));
      const row = { version, choice, elapsed, triangles: faces.length, contacts: a.count, allPairsAndLengthsEqual: true,
        originalPairCandidates: a.pairCandidates, finePairCandidates: b.pairCandidates, originalMs: middle - start, fineMs: end - middle };
      reports.push(row); console.log(JSON.stringify(row));
    }
  } finally { h.models.dispose(); }
}
await writeFile(new URL(`contact-grid-${process.argv[2] ?? 'parity'}.json`, import.meta.url), JSON.stringify(reports, null, 2) + '\n');
