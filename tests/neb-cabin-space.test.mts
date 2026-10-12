import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from 'three';
import { CABIN, CABIN_WALLS, CABIN_ROUTE_LENGTH, cabinGuidePose, filmPosition, playerBlocked, type FilmJourney } from '@auto_matrix/shared';
import { NebDeckRenderer } from '../packages/client/src/engine/NebDeckRenderer.js';

test('the cabin grate is the visible walking surface rather than being buried underneath the older hull plates', () => {
  const root = new THREE.Group(), renderer = new NebDeckRenderer(root);
  try {
    root.updateMatrixWorld(true);
    const hits = new THREE.Raycaster(new THREE.Vector3(CABIN.bed.x + .175, 3, CABIN.bed.z - .5), new THREE.Vector3(0, -1, 0))
      .intersectObject(root, true).filter(hit => hit.point.y < .2 && hit.point.y > -1);
    assert.ok(hits.length);
    assert.equal(hits[0].object.name, 'neb-cabin-grating', 'a hidden grate cannot improve the playable floor');
    assert.ok(Math.abs(hits[0].point.y) < .002, 'the steel support surface must coincide with the grounded player soles');
  } finally { renderer.dispose(); }
});

test('the worn cabin bulkheads retain real relief inside their shared collision envelope and leave the escort doorway open', () => {
  const root = new THREE.Group(), renderer = new NebDeckRenderer(root);
  try {
    root.updateMatrixWorld(true);
    for (const [i, wall] of CABIN_WALLS.entries()) {
      const group = root.getObjectByName(`neb-cabin-bulkhead-${i}`);
      assert.ok(group, 'flat unbroken wall boxes cannot replace the plated ship bulkheads');
      const box = new THREE.Box3().setFromObject(group), minimum = new THREE.Vector3(wall.x - wall.width / 2, 0, wall.z - wall.depth / 2), maximum = new THREE.Vector3(wall.x + wall.width / 2, wall.height, wall.z + wall.depth / 2);
      assert.ok(box.min.toArray().every((value, axis) => value >= minimum.getComponent(axis) - .025));
      assert.ok(box.max.toArray().every((value, axis) => value <= maximum.getComponent(axis) + .025), `bulkhead ${i} extends outside its player collider`);
    }
    const frame = root.getObjectByName('neb-cabin-hatch-frame')!, door = root.getObjectByName('neb-cabin-door')!;
    assert.ok(frame, 'the curved pressure hatch needs a solid surrounding frame');
    const ray = new THREE.Raycaster(new THREE.Vector3(CABIN.door.x + 3, 3, CABIN.door.z), new THREE.Vector3(-1, 0, 0), 0, 4);
    const journey = { scene: 'm1_cabin', step: 0, awakening: { kind: 'cabin', elapsed: 0, started: false } } as FilmJourney;
    renderer.update(journey, 0); root.updateMatrixWorld(true);
    assert.ok(ray.intersectObject(door, true).length, 'the saved closed hatch must visibly seal the route');
    journey.awakening!.elapsed = 12; renderer.update(journey, 99); root.updateMatrixWorld(true);
    assert.equal(ray.intersectObject(door, true).length, 0, 'the door fittings must leave with the sliding hatch');
    assert.equal(ray.intersectObject(frame, true).length, 0, 'the decorative frame cannot cut through the opening');
    for (let progress = 0; progress < CABIN_ROUTE_LENGTH; progress += .15) {
      const pose = cabinGuidePose(progress);
      assert.equal(playerBlocked(filmPosition('film_neb_deck', pose.x, pose.z), false, .55), false, `the shared wall blocks the guide at ${progress}`);
    }
  } finally { renderer.dispose(); }
});

test('cabin surfaces keep usable fallback colors until loaded, reject late images, and release shared image resources once', t => {
  const callbacks = new Map<string, (texture: THREE.Texture) => void>(), textures: THREE.Texture[] = [], returned = new Map<string, THREE.Texture>();
  t.mock.method(THREE.TextureLoader.prototype, 'load', (url: string, onLoad?: (texture: THREE.Texture) => void) => {
    const texture = new THREE.Texture(); returned.set(url, texture); if (url.includes('neb-cabin-')) textures.push(texture); if (onLoad) callbacks.set(url, onLoad); return texture;
  });
  const previousDocument = globalThis.document; globalThis.document = {} as Document;
  const root = new THREE.Group(), renderer = new NebDeckRenderer(root);
  t.after(() => { renderer.dispose(); globalThis.document = previousDocument; });
  const materials = new Set<THREE.MeshStandardMaterial>();
  root.traverse(object => { if (object instanceof THREE.Mesh && !Array.isArray(object.material) && object.material instanceof THREE.MeshStandardMaterial) materials.add(object.material); });
  const paint = [...materials].find(material => material.name === 'neb-cabin-painted-steel')!, cloth = [...materials].find(material => material.name === 'neb-cabin-cotton')!;
  assert.ok(paint && cloth, 'the cabin needs its own steel and cotton surfaces, preserving medical materials');
  assert.equal(paint.map, null); assert.equal(cloth.map, null);
  const paintPath = '/assets/film-materials/neb-cabin-painted-steel-v1.png', clothPath = '/assets/film-materials/neb-cabin-cotton-v1.png';
  const paintTexture = returned.get(paintPath)!; callbacks.get(paintPath)!(paintTexture);
  assert.equal(paint.map, paintTexture); assert.equal(paint.bumpMap, paintTexture); assert.equal(cloth.map, null);
  const version = paint.version;
  renderer.update({ scene: 'm1_cabin', step: 0 } as FilmJourney, 100);
  renderer.update({ scene: 'm1_cabin', step: 0 } as FilmJourney, 101);
  assert.equal(paint.version, version, 'paused frames cannot recompile the loaded surface');
  let disposals = 0; textures.forEach(texture => texture.addEventListener('dispose', () => disposals++));
  renderer.dispose(); renderer.dispose(); assert.equal(disposals, textures.length, 'each owned texture is released once');
  callbacks.get(clothPath)!(returned.get(clothPath)!); assert.equal(cloth.map, null, 'an image arriving after disposal cannot attach to the old cabin');
});
