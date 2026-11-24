import assert from 'node:assert/strict';
import test, { type TestContext } from 'node:test';
import * as THREE from 'three';
import { FILM_SETS, type FilmJourney, type SandboxState } from '@auto_matrix/shared';
import { FilmSetRenderer } from '../packages/client/src/engine/FilmSetRenderer.js';
import { LightCulling } from '../packages/client/src/engine/LightCulling.js';
import { AgentManager } from '../packages/server/src/agents/AgentManager.js';
import { WorldState } from '../packages/server/src/world/WorldState.js';

function fixture(t: TestContext) {
  t.mock.method(THREE.TextureLoader.prototype, 'load', () => new THREE.Texture());
  const scene = new THREE.Scene(), film = new FilmSetRenderer(scene), lighting = new LightCulling(scene), camera = new THREE.PerspectiveCamera();
  const world = new WorldState(); new AgentManager(world).initializeAllAgents();
  const neo = world.agents.get('neo')!, center = FILM_SETS.film_ambush_house.center;
  neo.position = { x: center.x - 15.5, y: center.y - 61.2, z: center.z - 32.2 }; neo.isInMatrix = true;
  const journey = { scene: 'm1_basement', actor: 'neo', step: 0, completed: [], basement: { phase: 'ready', gas: 0, hatch: 0 } } as unknown as FilmJourney;
  film.update(neo, { neoLife: { journey } } as SandboxState, 0, neo.position);
  lighting.stablePointSlots = film.stablePointSlots;
  camera.position.copy(new THREE.Vector3(neo.position.x, neo.position.y + 2, neo.position.z));
  const parent = new THREE.Group(), actor = new THREE.Group(), geometry = new THREE.BoxGeometry(); parent.visible = false; parent.add(actor); scene.add(parent);
  const texture = new THREE.Texture({ width: 2048, complete: true }); texture.needsUpdate = true;
  const material = new THREE.MeshStandardMaterial({ map: texture }), coat = new THREE.SkinnedMesh(geometry, material); coat.visible = false; actor.add(coat);
  const ship = new THREE.Mesh(geometry, material); ship.visible = false; ship.userData.reloadedHidden = true; actor.add(ship);
  const heroes = new Map([['smith', actor]]), work: string[] = [], batches: THREE.Object3D[][] = [];
  const programs: { program: object; isReady(): boolean; getUniforms(): void }[] = [];
  let ready = false, target: THREE.WebGLRenderTarget | null = null, uploaded = new WeakMap<THREE.Texture, number>();
  const gpu = { properties: { get: (map: THREE.Texture) => ({ __version: uploaded.get(map) }) }, info: { programs }, debug: { checkShaderErrors: true }, extensions: { has: () => true },
    getContext: () => ({ LINK_STATUS: 0x8b82, getProgramParameter: () => true }), getRenderTarget: () => target, setRenderTarget: (value: typeof target) => { target = value; },
    compile(subject: THREE.Object3D, eye: THREE.Camera, colors: THREE.Scene) {
      assert.notEqual(colors, scene); assert.equal(eye, camera); assert.equal(target?.width, 1);
      let points = 0; colors.traverseVisible(object => { if (object instanceof THREE.PointLight) points++; }); assert.equal(points, 7);
      const meshes: THREE.Object3D[] = []; subject.traverse(object => meshes.push(object)); assert.ok(meshes.length && meshes.length <= 4);
      if (meshes.includes(coat)) assert.match(material.customProgramCacheKey(), /actor-local-skin-v1$/);
      batches.push(meshes); work.push('compile'); programs.push({ program: {}, isReady: () => ready, getUniforms: () => { assert.equal(gpu.debug.checkShaderErrors, false); work.push('bindings'); } });
    },
    initTexture(map: THREE.Texture) { uploaded.set(map, map.version); work.push('texture'); },
  } as unknown as THREE.WebGLRenderer;
  const prepare = () => {
    const before = work.length; film.prepareBasement(gpu, camera, lighting, journey, () => undefined, id => heroes.get(id));
    assert.ok(work.length - before <= 1, 'prepare one small batch, completed program or large texture per frame');
    assert.equal(target, null); assert.equal(parent.visible, false); assert.equal(actor.parent, parent); assert.equal(coat.parent, actor); assert.equal(coat.visible, false); assert.equal(ship.visible, false);
  };
  const drain = () => { for (let i = 0; i < 1000; i++) prepare(); };
  t.after(() => { film.dispose(); lighting.dispose(); geometry.dispose(); material.dispose(); texture.dispose(); });
  return { scene, film, lighting, camera, journey, gpu, geometry, material, heroes, coat, ship, work, batches, prepare, drain,
    ready: () => { ready = true; }, newGpu: () => { uploaded = new WeakMap(); gpu.properties = { get: (map: THREE.Texture) => ({ __version: uploaded.get(map) }) } as THREE.WebGLRenderer['properties']; } };
}

test('the lower pipe prepares hidden basement cast colors before the falling camera without moving the live scene', t => {
  const h = fixture(t); h.ready(); h.drain();
  assert.ok(h.batches.flat().includes(h.coat), 'the first exposed Smith coat must be prepared while Neo still holds the pipe');
  assert.equal(h.batches.flat().includes(h.ship), false); assert.ok(h.work.includes('texture'));
  const count = h.work.length; h.drain(); assert.equal(h.work.length, count, 'finished work must not repeat every frame');
  h.journey.basement!.phase = 'landing'; h.prepare(); assert.equal(h.work.length, count, 'the fall gets the frame budget');
  h.journey.visiting = 'm1_basement'; h.prepare(); assert.equal(h.work.length, count);
});

test('basement preparation accepts late delivered cast and rebuilds its cache for a new GPU', t => {
  const h = fixture(t); h.ready(); h.drain();
  const late = new THREE.Group(), mesh = new THREE.Mesh(h.geometry, h.material); mesh.visible = false; late.add(mesh); h.heroes.set('mouse', late);
  const before = h.batches.length; h.journey.basement!.phase = 'descending'; h.drain(); assert.ok(h.batches.slice(before).flat().includes(mesh));
  const count = h.work.length; h.newGpu(); h.drain(); assert.ok(h.work.length > count);
  h.film.update(undefined, undefined, 0); const after = h.work.length; h.prepare(); assert.equal(h.work.length, after);
});

test('the bathroom prepares and hands off the same basement without adding it to the live room', t => {
  t.mock.method(THREE.TextureLoader.prototype, 'load', () => new THREE.Texture());
  const scene = new THREE.Scene(), film = new FilmSetRenderer(scene), lighting = new LightCulling(scene), camera = new THREE.PerspectiveCamera();
  const world = new WorldState(); new AgentManager(world).initializeAllAgents();
  const player = world.agents.get('morpheus')!, center = FILM_SETS.film_ambush_house.center;
  player.position = { x: center.x - 15.5, y: center.y - 61.2, z: center.z - 32.2 }; player.isInMatrix = true;
  const journey = { scene: 'm1_bathroom', actor: 'morpheus', step: 0, completed: [] } as unknown as FilmJourney;
  film.update(player, { neoLife: { journey } } as SandboxState, 0, player.position);
  const rooms = new Set<THREE.Object3D>(), batches: THREE.Object3D[][] = [], programs: { program: object; isReady(): boolean; getUniforms(): void }[] = [];
  const hero = new THREE.Group(), mesh = new THREE.SkinnedMesh(new THREE.BoxGeometry(), new THREE.MeshStandardMaterial());
  hero.visible = false; hero.add(mesh); scene.add(hero);
  const shadow = new THREE.Mesh(new THREE.PlaneGeometry(), new THREE.MeshBasicMaterial()); shadow.visible = false; scene.add(shadow);
  const late = new THREE.Mesh(new THREE.BoxGeometry(), new THREE.MeshStandardMaterial());
  let target: THREE.WebGLRenderTarget | null = null, bindings = 0;
  const gpu = {
    properties: { get: () => ({}) }, info: { programs }, debug: { checkShaderErrors: true }, extensions: { has: () => true },
    getContext: () => ({ LINK_STATUS: 0x8b82, getProgramParameter: () => true }),
    getRenderTarget: () => target, setRenderTarget: (value: typeof target) => { target = value; },
    compile(subject: THREE.Object3D, eye: THREE.Camera, colors: THREE.Scene) {
      assert.equal(eye, camera); assert.notEqual(colors, scene); assert.equal(target?.width, 1);
      const visible: THREE.Object3D[] = []; colors.traverseVisible(object => visible.push(object));
      assert.equal(visible.filter(object => object instanceof THREE.PointLight).length, 7);
      const room = visible.find(object => object.name === 'basement-mechanical-room');
      assert.ok(room); assert.equal(scene.getObjectByName(room.name), undefined); rooms.add(room);
      const batch: THREE.Object3D[] = []; subject.traverse(object => batch.push(object));
      assert.ok(batch.length && batch.length <= 4); batches.push(batch);
      programs.push({ program: {}, isReady: () => true, getUniforms: () => { bindings++; } });
    },
  } as unknown as THREE.WebGLRenderer;
  const prepare = () => {
    const before = batches.length + bindings;
    film.prepareBasement(gpu, camera, lighting, journey, () => undefined, id => id === 'neo' ? hero : undefined, id => id === 'neo' ? shadow : undefined);
    assert.ok(batches.length + bindings - before <= 1);
    assert.equal(hero.visible, false); assert.equal(mesh.parent, hero); assert.equal(target, null);
  };
  t.after(() => {
    film.dispose(); lighting.dispose();
    for (const object of [mesh, shadow, late]) { object.geometry.dispose(); object.material.dispose(); }
  });
  for (let i = 0; i < 600; i++) prepare();
  assert.equal(rooms.size, 1, 'prepare the destination before the first basement draw');
  assert.ok(batches.flat().includes(mesh), 'Neo must be ready before the viewpoint returns to him');
  hero.add(late);
  for (let i = 0; i < 100; i++) prepare();
  assert.ok(batches.flat().includes(late), 'a detailed head arriving in an already seen character group must still prepare');
  assert.ok(batches.flat().includes(shadow), 'the first exposed ground shadow needs the destination light layout');
  assert.equal(shadow.visible, false);
  const before = batches.length;
  gpu.properties = { get: () => ({}) } as THREE.WebGLRenderer['properties'];
  for (let i = 0; i < 600; i++) prepare();
  assert.ok(batches.length > before); assert.equal(rooms.size, 1, 'a new GPU must reuse the prepared room');
  const first = [...rooms][0], surface = first.getObjectByProperty('isMesh', true) as THREE.Mesh;
  let abandoned = 0; surface.geometry.addEventListener('dispose', () => abandoned++);
  journey.visiting = 'm1_bathroom'; prepare(); assert.equal(abandoned, 1);
  delete journey.visiting;
  for (let i = 0; i < 600; i++) prepare();
  const room = [...rooms][1], next = room.getObjectByProperty('isMesh', true) as THREE.Mesh;
  let disposed = 0; next.geometry.addEventListener('dispose', () => disposed++);
  journey.scene = 'm1_basement'; journey.basement = { phase: 'ready', gas: 0, hatch: 0 } as FilmJourney['basement'];
  film.update(player, { neoLife: { journey } } as SandboxState, 0, player.position);
  assert.equal(film.root.getObjectByName(room.name), room); assert.equal(disposed, 0);
  film.update(undefined, undefined, 0); assert.equal(disposed, 1);
  film.dispose(); assert.equal(disposed, 1);
});
