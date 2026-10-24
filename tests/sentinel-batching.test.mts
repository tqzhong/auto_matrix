import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from 'three';
import type { FilmJourney, SentinelGesture } from '@auto_matrix/shared';
import { SentinelSetRenderer } from '../packages/client/src/engine/SentinelSetRenderer.js';

test('the cockpit and Sentinel share fixed surfaces instead of submitting every rib, console and tentacle joint separately', () => {
  const root = new THREE.Group(), renderer = new SentinelSetRenderer(root);
  try {
    let meshes = 0;
    root.traverse(object => { if (object instanceof THREE.Mesh) meshes++; });
    assert.ok(meshes <= 150, `the unchanged cockpit still needs ${meshes} individual surfaces per pass`);
    for (const name of ['sentinel-cockpit-deck', 'sentinel-frosted-glass', 'sentinel-emp-guard',
      'sentinel-main-power-contact', 'sentinel-arm-power-contact', 'sentinel-scan-beam', 'sentinel-noise-bar-0'])
      assert.ok(root.getObjectByName(name), `preserve independently controlled/contact surface ${name}`);
  } finally { renderer.dispose(); }
});

test('batching preserves every textured triangle, shadow flag and animated control through shutdown, scan and restoration', t => {
  const prototype = SentinelSetRenderer.prototype as unknown as { batch(): void; root: THREE.Group }, batch = prototype.batch;
  let reference!: THREE.Group;
  const copies: { source: THREE.Object3D; target: THREE.Object3D }[] = [];
  const geometries = new Map<THREE.BufferGeometry, number>();
  t.mock.method(prototype, 'batch', function(this: typeof prototype) {
    reference = this.root.clone(true);
    const originals: THREE.Object3D[] = [], cloned: THREE.Object3D[] = [];
    this.root.traverse(object => originals.push(object)); reference.traverse(object => cloned.push(object));
    originals.forEach((source, i) => {
      copies.push({ source, target: cloned[i] });
      if (source instanceof THREE.Mesh && !geometries.has(source.geometry)) {
        const geometry = source.geometry; geometries.set(geometry, 0);
        geometry.addEventListener('dispose', () => geometries.set(geometry, geometries.get(geometry)! + 1));
      }
    });
    batch.call(this);
  });
  const root = new THREE.Group(), renderer = new SentinelSetRenderer(root);
  root.position.set(6000, -100, 5600); root.rotation.y = .19; root.add(reference);
  const actual = root.getObjectByName('sentinel-cockpit')!;
  const surfaces = (group: THREE.Object3D) => {
    const result = new Map<THREE.Material | THREE.Material[], Map<string, number[][]>>();
    group.updateWorldMatrix(true, true);
    group.traverseVisible(object => {
      if (!(object instanceof THREE.Mesh)) return;
      const { position, normal, uv } = object.geometry.attributes, index = object.geometry.index;
      const transform = new THREE.Matrix3().getNormalMatrix(object.matrixWorld);
      const triangles = result.get(object.material) ?? new Map<string, number[][]>(); result.set(object.material, triangles);
      for (let face = 0; face < (index?.count ?? position.count); face += 3) {
        const values: number[] = [];
        for (let k = 0; k < 3; k++) {
          const vertex = index ? index.getX(face + k) : face + k;
          const p = new THREE.Vector3().fromBufferAttribute(position, vertex).applyMatrix4(object.matrixWorld);
          const n = new THREE.Vector3().fromBufferAttribute(normal, vertex).applyMatrix3(transform).normalize();
          values.push(p.x, p.y, p.z, n.x, n.y, n.z, uv.getX(vertex), uv.getY(vertex));
        }
        const key = `${object.castShadow}/${object.receiveShadow}/${object.renderOrder}/${object.layers.mask}/`
          + values.map(value => Math.round(value * 100) / 100).join(',');
        const bucket = triangles.get(key) ?? []; bucket.push(values); triangles.set(key, bucket);
      }
    });
    return result;
  };
  try {
    for (const [phase, elapsed, noise] of [['ready', 0, 0], ['shutdown', 1.4, 0], ['shutdown', 3.35, 0],
      ['sweep', 6, .8], ['detected', 1, 1], ['clear', 2, 0], ['confirming', 1.4, 0], ['done', 0, 0]] as const) {
      const sentinel = { phase: phase as SentinelGesture['phase'], elapsed, noise, attempt: 0 };
      renderer.update({ scene: 'm1_sentinels', sentinel } as FilmJourney, elapsed);
      for (const { source, target } of copies) {
        target.position.copy(source.position); target.quaternion.copy(source.quaternion); target.scale.copy(source.scale); target.visible = source.visible;
      }
      const before = surfaces(reference), after = surfaces(actual);
      assert.equal(after.size, before.size, `${phase}: material assignments must survive`);
      for (const [material, expected] of before) {
        const found = after.get(material)!;
        assert.equal(found.size, expected.size, `${phase}: triangle, shadow or layer changed`);
        for (const [key, triangles] of expected) {
          const candidates = found.get(key); assert.ok(candidates, `${phase}: missing triangle ${key}`);
          assert.equal(candidates.length, triangles.length);
          for (const values of triangles) {
            const at = candidates.findIndex(candidate => values.every((value, i) => Math.abs(value - candidate[i]) < 1e-5));
            assert.ok(at >= 0, `${phase}: triangle position, normal or UV differs`); candidates.splice(at, 1);
          }
        }
      }
    }
    const retained = new Set<THREE.BufferGeometry>(); actual.traverse(object => { if (object instanceof THREE.Mesh) retained.add(object.geometry); });
    for (const [geometry, count] of geometries) assert.equal(count, retained.has(geometry) ? 0 : 1, 'obsolete source buffers are released once');
  } finally { reference.removeFromParent(); renderer.dispose(); }
  for (const count of geometries.values()) assert.equal(count, 1, 'all source buffers are released exactly once after unloading');
  assert.equal(root.children.length, 0);
});
