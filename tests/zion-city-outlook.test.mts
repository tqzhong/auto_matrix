import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from 'three';
import { TempleDefenseRenderer } from '../packages/client/src/engine/TempleDefenseRenderer.js';

test('the rock vault stays solid around the bore and the residential balconies meet every doorway', t => {
  const root = new THREE.Group(), renderer = new TempleDefenseRenderer(root);
  t.after(() => renderer.dispose()); root.updateMatrixWorld(true);
  const roof = root.getObjectByName('temple-city-roof')!, city = root.getObjectByName('temple-city-outlook')!;
  for (const x of [-104, -71, -34, 1, 37, 69, 103]) for (const z of [-239, -207, -168, -135, -96, -64]) {
    if (Math.hypot(x, z + 105) < 10) continue;
    const hits = new THREE.Raycaster(new THREE.Vector3(x, 80, z), new THREE.Vector3(0, -1, 0), 0, 80).intersectObject(roof);
    const heights = [...new Set(hits.map(hit => Math.round(hit.point.y * 1000) / 1000))].sort((a, b) => b - a);
    assert.equal(heights.length, 2, `${x},${z}: an opaque vault needs both surfaces, without cracks or overlapping layers`);
    assert.ok(Math.abs(heights[0] - heights[1] - 1.1) < .003, 'rock thickness must survive the deformed vault');
  }
  for (let bay = 0; bay < 13; bay++) for (const floor of [-63, -50, -37, -24, -11, 2, 15]) {
    const angle = (bay - 6) * .26, radius = 77 + Math.sin(bay * 2.1) * 1.5 - 1.6;
    const eye = new THREE.Vector3(Math.sin(angle) * radius, floor + .7, -125 - Math.cos(angle) * radius);
    const hits = new THREE.Raycaster(eye, new THREE.Vector3(0, -1, 0), 0, .6).intersectObject(city, true);
    assert.ok(hits.some(hit => Math.abs(hit.point.y - (floor + .25)) < .002), `${bay}/${floor}: the doorway must open onto a supported balcony`);
  }
  // The new scenery must not enter the existing playable entrance or the ascending swarm's approach.
  for (const y of [9, 15, 22]) for (const x of [-8, 0, 8]) {
    const hits = new THREE.Raycaster(new THREE.Vector3(x, y, -60), new THREE.Vector3(0, 0, -1), 0, 53).intersectObject(city, true);
    assert.equal(hits.length, 0, `${x}/${y}: architecture cuts through the existing machine approach`);
  }
});

test('the deep city shares draw batches, rebuilds deterministically and releases its render resources once', t => {
  const root = new THREE.Group(), renderer = new TempleDefenseRenderer(root);
  const coldRoot = new THREE.Group(), cold = new TempleDefenseRenderer(coldRoot);
  t.after(() => { renderer.dispose(); cold.dispose(); });
  const city = root.getObjectByName('temple-city-outlook')!, rebuilt = coldRoot.getObjectByName('temple-city-outlook')!;
  const meshes: THREE.Mesh[] = [], resources = new Set<THREE.BufferGeometry | THREE.Material>();
  city.traverse(object => {
    if (!(object instanceof THREE.Mesh)) return;
    meshes.push(object); resources.add(object.geometry);
    for (const material of Array.isArray(object.material) ? object.material : [object.material]) resources.add(material);
  });
  assert.ok(meshes.length <= 16, `repeated homes, rails and pipes require ${meshes.length} draws instead of shared batches`);
  const triangles = meshes.reduce((sum, mesh) => sum + (mesh.geometry.index?.count ?? mesh.geometry.attributes.position.count) / 3, 0);
  assert.ok(triangles < 300000, `background scenery exceeds its triangle budget: ${triangles}`);
  assert.equal(city.children.length, rebuilt.children.length);
  meshes.forEach((mesh, i) => {
    const other = rebuilt.children[i] as THREE.Mesh;
    assert.deepEqual(mesh.geometry.attributes.position.array, other.geometry.attributes.position.array, 'cold loading must not randomly rebuild the city');
  });
  const disposed = new Map([...resources].map(resource => [resource, 0]));
  for (const resource of resources) resource.addEventListener('dispose', () => disposed.set(resource, disposed.get(resource)! + 1));
  renderer.dispose(); renderer.dispose();
  assert.equal(root.children.length, 0);
  assert.ok([...disposed.values()].every(count => count === 1), 'leaving and repeated cleanup must release every rendered geometry and material exactly once');
});
