import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from 'three';
import { CABIN, CABIN_WALLS, CABIN_ROUTE_LENGTH, FILM_SETS, cabinGuidePose, filmPosition, playerBlocked, type FilmJourney } from '@auto_matrix/shared';
import { FilmSetRenderer } from '../packages/client/src/engine/FilmSetRenderer.js';
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

test('medical recovery prepares the existing cabin maps, first-view cast and new shadow casters ahead of the cut', t => {
  const scene = new THREE.Scene(), film = new FilmSetRenderer(scene), deck = new NebDeckRenderer(film.root);
  const camera = new THREE.PerspectiveCamera();
  const journey = { scene: 'm1_recovery', actor: 'neo', step: 0, awakening: { kind: 'recovery', elapsed: 8, started: true } } as FilmJourney;
  Object.assign(film, { neb: deck, current: FILM_SETS.film_neb_deck, currentScene: journey.scene });
  deck.update(journey, 0);
  const cabin = film.root.getObjectByName('neb-waking-cabin')!;
  const steel = cabin.getObjectByName('neb-cabin-bulkhead-4-neb-cabin-painted-steel') as THREE.Mesh<THREE.BufferGeometry, THREE.MeshStandardMaterial>;
  const cotton = cabin.getObjectByName('neb-cabin-bed-neb-cabin-cotton') as typeof steel;
  const map = new THREE.Texture({ width: 1254, height: 1254 }); map.needsUpdate = true;
  const model = new THREE.Group(), geometry = new THREE.BoxGeometry(), skin = new THREE.MeshStandardMaterial();
  const boots = new THREE.SkinnedMesh(geometry, skin); boots.name = 'shoes01'; boots.visible = false; boots.castShadow = true; model.add(boots);
  const sweater = new THREE.SkinnedMesh(geometry, new THREE.MeshStandardMaterial()); sweater.castShadow = true;
  const effects: string[] = [], color = new Set<THREE.Material>(), depth = new Set<THREE.Material>(), uploaded = new Map<THREE.Texture, { __version: number }>();
  const programs: { program: object; isReady(): boolean; getUniforms(): void }[] = [];
  let target: THREE.WebGLRenderTarget | null = null, copies = 0, disposed = 0;
  sweater.material.addEventListener('dispose', () => disposed++);
  const renderer = {
    properties: { get: (value: THREE.Texture) => uploaded.get(value) ?? {} }, info: { programs }, extensions: { has: () => true },
    debug: { checkShaderErrors: true }, getContext: () => ({ LINK_STATUS: 0x8b82, getProgramParameter: () => true }),
    shadowMap: { enabled: true, type: THREE.PCFSoftShadowMap },
    getRenderTarget: () => target, setRenderTarget: (value: typeof target) => { target = value; },
    initTexture: (texture: THREE.Texture) => { effects.push('upload'); uploaded.set(texture, { __version: texture.version }); },
    compile: (subject: THREE.Object3D, eye: THREE.Camera, view: THREE.Scene) => {
      assert.notEqual(view, scene); assert.equal(eye, camera);
      let spots = 0, slots = 0;
      view.traverseVisible(object => {
        if (object instanceof THREE.PointLight) slots++;
        if (object instanceof THREE.SpotLight && object.castShadow) spots++;
      });
      assert.equal(slots, 8); assert.equal(spots, 1);
      subject.traverse(object => {
        assert.ok(object instanceof THREE.Mesh && !Array.isArray(object.material));
        (object.material instanceof THREE.MeshDepthMaterial ? depth : color).add(object.material);
      });
      effects.push('compile'); programs.push({ program: {}, isReady: () => true, getUniforms: () => effects.push('bindings') });
    },
  } as unknown as THREE.WebGLRenderer;
  t.after(() => { film.dispose(); geometry.dispose(); skin.dispose(); map.dispose(); });
  const cast = (id: string) => id === 'neo' ? { model, garments: () => { copies++; return [sweater]; } } : {};
  const prepare = () => {
    const before = effects.length;
    film.prepareCabinArrival?.(renderer, camera, journey, cast);
    assert.ok(effects.length - before <= 1, 'only one batch, binding or texture per frame');
    assert.equal(target, null); assert.equal(boots.visible, false); assert.equal(sweater.parent, null);
    assert.equal(film.root.getObjectByName('neb-waking-cabin'), cabin);
  };
  for (let frame = 0; frame < 40; frame++) prepare();
  assert.ok(!color.has(steel.material) && !color.has(cotton.material), 'wait for the actual mapped variants');
  steel.material.map = steel.material.bumpMap = map;
  cotton.material.map = cotton.material.bumpMap = map;
  for (let frame = 0; frame < 80; frame++) prepare();
  assert.ok(uploaded.has(map), 'upload the original cabin texture before the player moves into the room');
  assert.ok([steel.material, cotton.material, boots.material, sweater.material].every(material => color.has(material)));
  assert.ok([...depth].some(material => (material as THREE.MeshDepthMaterial).map === map));
  assert.equal(copies, 1); assert.equal(disposed, 0);
  journey.scene = 'm1_cabin'; prepare(); assert.equal(disposed, 0, 'the cut must keep the warmed garment programs for their first draw');
  film.update(undefined, undefined, 0); assert.equal(disposed, 1, 'leaving the deck releases the temporary garment material');
});
