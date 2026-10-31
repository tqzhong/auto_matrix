import { readFile, writeFile } from 'node:fs/promises';
import * as THREE from 'three';
import { FILM_SETS } from '@auto_matrix/shared';
import { makeModel, meshSurface, worldPoints } from '../morpheus-ambush-doff-2026-10-17/grip-fixture.mjs';
import { auditCage } from '../morpheus-ambush-doff-2026-10-17/cloth-rebuild/cage-contact.mjs';
import { FrontExitBody } from './FrontExitBody.mjs';

const base = new URL('./', import.meta.url), frame = 136, time = (frame - 1) / 60;
const input = JSON.parse(await readFile(new URL('shirt-contact-input/manifest.json', base), 'utf8'));
const mapping: number[] = JSON.parse(await readFile(new URL('shirt-contact-transport/source-to-weld.json', base), 'utf8'));
const bytes = await readFile(new URL(`shirt-contact-transport/cloth-${frame}.bin`, base));
const cache = new Float64Array(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength));
const shirt = { vertices: mapping.map(id => Array.from(new Float32Array([cache[id * 3] / .4, cache[id * 3 + 2] / .4, -cache[id * 3 + 1] / .4]))), indices: input.shirt.indices };
const canonical = await makeModel();
const body = new FrontExitBody(canonical.rig, 'front-exit'); body.pose(time);
const outer = [canonical.rig.root.getObjectByName('morpheus-ambush-coat'), canonical.rig.root.getObjectByName('morpheus-ambush-lapels'), ...canonical.rig.panels.map(panel => panel.mesh)];
const references: ReturnType<typeof meshSurface>[] = [];
canonical.rig.root.traverseVisible(object => {
  if (object instanceof THREE.Mesh && object.name !== input.shirt.name && !outer.includes(object)) references.push(meshSurface(object));
});
const rows = [];
for (const placed of [false, true]) {
  const h = await makeModel();
  try {
    if (placed) {
      const centre = FILM_SETS.film_ambush_house.center;
      h.rig.root.position.set(centre.x, centre.y, centre.z);
      h.rig.root.rotation.y = 1.14; h.rig.root.scale.setScalar(.4);
    }
    h.rig.root.updateMatrixWorld(true);
    new FrontExitBody(h.rig, 'front-exit').pose(time);
    const inverse = h.rig.root.matrixWorld.clone().invert(), inner: ReturnType<typeof meshSurface>[] = [];
    const excluded = [h.rig.root.getObjectByName('morpheus-ambush-coat'), h.rig.root.getObjectByName('morpheus-ambush-lapels'), ...h.rig.panels.map(panel => panel.mesh)];
    h.rig.root.traverseVisible(object => {
      if (object instanceof THREE.Mesh && object.name !== input.shirt.name && !excluded.includes(object))
        inner.push({ ...meshSurface(object), vertices: worldPoints(object).map(point => point.applyMatrix4(inverse).toArray()) });
    });
    let maximumSkinDriftMetres = 0;
    for (const [part, surface] of inner.entries()) for (const [id, point] of surface.vertices.entries())
      maximumSkinDriftMetres = Math.max(maximumSkinDriftMetres, Math.hypot(...point.map((value, axis) => value - references[part].vertices[id][axis])) * .4);
    const audit = auditCage(shirt, inner);
    rows.push({ placedAtActualSet: placed, frame, time, innerLayers: inner.length, maximumSkinDriftMetres,
      self: audit.selfCount, body: audit.bodyCount, bodyPairs: audit.body.slice(0, 8) });
  } finally { h.models.dispose(); }
}
canonical.models.dispose();
const result = { scope: 'CPU skinning at the actual set translation, normalized back to canonical model coordinates with the unchanged contact tolerance. GPU skinning and live gameplay are not measured.', acceptedForProduction: false, rows };
console.log(JSON.stringify(result));
await writeFile(new URL('shirt-world-root-diagnosis.json', base), JSON.stringify(result, null, 2));
