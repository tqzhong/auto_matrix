import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from 'three';
import { newMotion } from '../packages/client/src/agents/CharacterMotion.js';
import { shipKnit } from './helpers/ship-knit.mjs';

test('Morpheus ship knit bridges the chest instead of preserving two anatomical pectoral lobes', async t => {
  const h = await shipKnit(t); h.pose();
  const material = new THREE.MeshBasicMaterial({ side: THREE.DoubleSide }); t.after(() => material.dispose());
  const shell = new THREE.Mesh(h.sweater.geometry, material); shell.updateMatrixWorld(true);
  const front = (x: number, y: number) => {
    const hit = new THREE.Raycaster(new THREE.Vector3(x, y, 2), new THREE.Vector3(0, 0, -1), 0, 3).intersectObject(shell)[0];
    assert.ok(hit, `the original closed chest must remain at ${x},${y}`); return hit.point.z;
  };
  const rows = [3.2, 3.3, 3.4, 3.45].map(y => ({ y, valley: (front(-.18, y) + front(.18, y)) / 2 - front(0, y) }));
  t.diagnostic(JSON.stringify(rows));
  assert.ok(rows.every(row => row.valley < .006), 'the knitted torso still traces the anatomical chest cleft');
});

test('ship fitting leaves all original faces, UVs and weights intact and restores the donor used by other costumes', async t => {
  const h = await shipKnit(t), original = h.original;
  const source = Object.fromEntries(Object.entries(original.attributes).map(([key, a]) => [key, Array.from(a.array)]));
  const others = h.rig.wardrobe.filter(p => /ambush|construct|Tailored.coat.upper|Black.crew.neck/.test(p.mesh.name)).map(p => ({ mesh: p.mesh, geometry: p.mesh.geometry, data: Array.from(p.mesh.geometry.attributes.position.array) }));
  h.pose();
  assert.deepEqual(Array.from(h.sweater.geometry.index!.array), Array.from(original.index!.array));
  for (const key of ['uv', 'skinIndex', 'skinWeight']) assert.deepEqual(Array.from(h.sweater.geometry.attributes[key].array), source[key]);
  h.pose({ realWorld: false, nebCrew: undefined, nebCrewEarly: false });
  assert.equal(h.sweater.geometry, original);
  assert.deepEqual(Object.fromEntries(Object.entries(original.attributes).map(([key, a]) => [key, Array.from(a.array)])), source);
  for (const other of others) { assert.equal(other.mesh.geometry, other.geometry); assert.deepEqual(Array.from(other.mesh.geometry.attributes.position.array), other.data); }
});

test('redraping introduces no new surface intersections through seated and standing dialogue, while reporting existing donor defects', async t => {
  const h = await shipKnit(t);
  for (const elapsed of [0, 6, 8, 12, 17, undefined]) {
    h.pose(elapsed === undefined ? {} : { seated: true, truth: { role: 'morpheus', phase: 'rest', elapsed } });
    const fitted = h.sweater.geometry, actual = h.contacts();
    h.sweater.geometry = h.original; const before = h.contacts(); h.sweater.geometry = fitted;
    t.diagnostic(JSON.stringify({ elapsed: elapsed ?? 'standing', before: { self: before.self.count, bodies: before.bodies.map(({ mesh, count }) => ({ mesh, count })) }, after: { self: actual.self.count, bodies: actual.bodies.map(({ mesh, count }) => ({ mesh, count })) } }));
    const check = (pairs: typeof actual.self.pairs, original: typeof actual.self.pairs, name: string) => {
      const prior = new Map(original.map(p => [`${p.first}/${p.second}`, p.line]));
      for (const p of pairs) {
        const previous = prior.get(`${p.first}/${p.second}`);
        assert.ok(previous !== undefined && p.line <= previous + 1e-7, `${elapsed}/${name}: new or deeper intersection at ${p.first}/${p.second}`);
      }
    };
    check(actual.self.pairs, before.self.pairs, 'self');
    for (const body of actual.bodies) check(body.pairs, before.bodies.find(other => other.mesh === body.mesh)?.pairs ?? [], body.mesh);
  }
});

test('cold and paused ship costumes retain the same complete surface as continuous dialogue animation', async t => {
  const warm = await shipKnit(t), cold = await shipKnit(t), motion = newMotion();
  for (let frame = 0; frame <= 1080; frame++) {
    const input = { seated: true, truth: { role: 'morpheus' as const, phase: 'rest' as const, elapsed: frame / 60 } };
    warm.pose(input, motion, 1 / 60);
    if (![0, 180, 360, 540, 720, 1080].includes(frame)) continue;
    cold.pose(input);
    const a = warm.faceSurface(warm.sweater).points, b = cold.faceSurface(cold.sweater).points;
    assert.ok(a.every((p, i) => p.distanceTo(b[i]) < 1e-7), `${frame}: cold surface differs`);
    const geometry = cold.sweater.geometry, version = geometry.attributes.position.version;
    cold.pose(input, newMotion(), .5);
    assert.equal(cold.sweater.geometry, geometry); assert.equal(geometry.attributes.position.version, version);
    assert.ok(cold.faceSurface(cold.sweater).points.every((p, i) => p.distanceTo(b[i]) < 1e-7), `${frame}: paused surface drift`);
  }
});

test('the knit has a mipmapped yarn surface and releases its additional resources once without recompiling paused materials', async t => {
  const h = await shipKnit(t); h.pose();
  const material = h.sweater.material as THREE.MeshStandardMaterial, geometry = h.sweater.geometry, yarn = material.map;
  assert.ok(yarn instanceof THREE.DataTexture, 'a flat body color with bump alone does not read as mottled yarn');
  assert.equal(yarn.generateMipmaps, true); assert.equal(yarn.minFilter, THREE.LinearMipmapLinearFilter);
  const version = material.version;
  for (let i = 0; i < 20; i++) { h.pose(); assert.equal(material.version, version); assert.equal(h.sweater.geometry, geometry); }
  const disposed = { geometry: 0, yarn: 0 };
  geometry.addEventListener('dispose', () => disposed.geometry++); yarn.addEventListener('dispose', () => disposed.yarn++);
  h.dispose(); h.dispose(); assert.deepEqual(disposed, { geometry: 1, yarn: 1 });
});
