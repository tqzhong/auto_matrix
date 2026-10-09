import assert from 'node:assert/strict';
import test, { type TestContext } from 'node:test';
import * as THREE from 'three';
import { FILM_SETS, TRUCKS, type FilmJourney } from '@auto_matrix/shared';
import { FreewaySetRenderer } from '../packages/client/src/engine/FreewaySetRenderer.js';

function setup(t: TestContext) {
  const original = globalThis.document;
  globalThis.document = { createElement: () => ({ width: 0, height: 0, getContext: () => ({
    createImageData: (w: number, h: number) => ({ data: new Uint8ClampedArray(w * h * 4) }),
    putImageData() {}, fillRect() {}, strokeRect() {}, fillText() {},
    createRadialGradient: () => ({ addColorStop() {} }),
    createLinearGradient: () => ({ addColorStop() {} }),
  }) }) } as unknown as Document;
  const loaded: THREE.Texture[] = [];
  t.mock.method(THREE.TextureLoader.prototype, 'load', (url: string) => {
    const texture = new THREE.Texture(); texture.name = url; loaded.push(texture); return texture;
  });
  const root = new THREE.Group(), renderer = new FreewaySetRenderer(root, FILM_SETS.film_freeway_trucks);
  const journey: FilmJourney = { version: 1, scene: 'm2_trucks', actor: 'morpheus', step: 1,
    enteredAt: 0, completed: [], reflections: {}, lastText: '', checkpoint: { x: 0, y: 0, z: 0 },
    trucks: { phase: 'collision', elapsed: 0, lastTick: 0, attempt: 0 } };
  renderer.update(journey, 0); root.updateMatrixWorld(true);
  t.after(() => { renderer.dispose(); globalThis.document = original; });
  return { root, renderer, loaded, journey };
}

test('the truck windshield exposes a real cabin instead of transparent glass over an opaque block', t => {
  const { root } = setup(t), rig = root.getObjectByName('matrix-freeway-hero-truck')!;
  const eye = rig.localToWorld(new THREE.Vector3(1.1, 5.1, -16));
  const direction = new THREE.Vector3(0, 0, 1).transformDirection(rig.matrixWorld);
  const hits = new THREE.Raycaster(eye, direction).intersectObject(rig, true);
  const first = hits[0];
  assert.ok(first, 'the visible front needs a windshield at driver eye height');
  const material = (first.object as THREE.Mesh).material as THREE.MeshStandardMaterial;
  assert.ok(material.transparent && material.opacity < .6, 'driver-height glazing must transmit the cabin');
  const opaque = hits.find(hit => !((hit.object as THREE.Mesh).material as THREE.Material).transparent);
  assert.ok(opaque && opaque.distance - first.distance > 1.3, 'the space behind the windshield must be hollow');
});

test('freeway asphalt uses all three real surface maps at an undistorted world scale and releases them', t => {
  const { root, renderer, loaded } = setup(t);
  const road: THREE.Mesh[] = [];
  root.traverse(object => {
    if (object instanceof THREE.Mesh && (object.material as THREE.MeshStandardMaterial).map?.name.endsWith('asphalt_02-color.jpg')) road.push(object);
  });
  assert.ok(road.length, 'the driving surface must use the existing real asphalt asset');
  for (const z of [-780, 0, 780]) {
    const hit = new THREE.Raycaster(new THREE.Vector3(10, 10, z), new THREE.Vector3(0, -1, 0)).intersectObjects(road)[0];
    assert.ok(hit && Math.abs(hit.point.y) < 1e-6, 'texturing must keep the shared physical road at zero');
  }
  const surface = road[0].material as THREE.MeshStandardMaterial;
  for (const map of [surface.map, surface.normalMap, surface.roughnessMap]) {
    assert.ok(map && Math.abs(map.repeat.x / 60 - map.repeat.y / Math.max(1600, FILM_SETS.film_freeway_trucks.depth)) < 1e-10,
      'aggregate and cracks must not stretch along the highway');
  }
  const disposed = new Set<THREE.Texture>();
  loaded.forEach(texture => texture.addEventListener('dispose', () => disposed.add(texture)));
  renderer.dispose();
  assert.ok(loaded.every(texture => disposed.has(texture)), 'changing film locations must release the downloaded surface textures');
});

test('cab windows, mirrors and door hardware deform on the saved crash without falling through the road', t => {
  const { root, renderer, journey } = setup(t), rig = root.getObjectByName('matrix-freeway-hero-truck')!;
  const cab = rig.getObjectByName('matrix-freeway-hero-truck-cab');
  assert.ok(cab, 'sample the complete visible cabin, including glazing and mirrors');
  const vertices = () => {
    root.updateMatrixWorld(true); const points: THREE.Vector3[] = [];
    cab.traverse(object => {
      if (!(object instanceof THREE.Mesh)) return;
      for (let i = 0; i < object.geometry.attributes.position.count; i++)
        points.push(object.getVertexPosition(i, new THREE.Vector3()).applyMatrix4(object.matrixWorld));
    });
    return points;
  };
  const intact = vertices();
  journey.trucks = { ...journey.trucks!, phase: 'rescue', elapsed: TRUCKS.collisionSeconds, rescueElapsed: 0 };
  for (const clock of [.15, .5, 1.15, 2, 3]) {
    journey.trucks.rescueElapsed = clock; renderer.update(journey, 1000);
    const damaged = vertices();
    assert.ok(damaged.every(point => Number.isFinite(point.x + point.y + point.z) && point.y >= -.01), 'new cab parts cannot enter the asphalt during the saved impact');
    if (clock >= 1.15) assert.ok(damaged.some((point, index) => point.distanceTo(intact[index]) > 1), 'the detailed cab must fold with the collision');
    const paused = damaged.map(point => point.toArray()); renderer.update(journey, 9000);
    assert.deepEqual(vertices().map(point => point.toArray()), paused, 'a paused crash cannot animate on browser time');
  }
});
