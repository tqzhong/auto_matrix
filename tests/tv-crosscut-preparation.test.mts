import assert from 'node:assert/strict';
import test, { type TestContext } from 'node:test';
import * as THREE from 'three';
import { FILM_SETS, filmPosition, type FilmJourney, type SandboxState } from '@auto_matrix/shared';
import { FilmSetRenderer } from '../packages/client/src/engine/FilmSetRenderer.js';
import { LightCulling } from '../packages/client/src/engine/LightCulling.js';
import { AgentManager } from '../packages/server/src/agents/AgentManager.js';
import { WorldState } from '../packages/server/src/world/WorldState.js';

function fixture(t: TestContext) {
  t.mock.method(THREE.TextureLoader.prototype, 'load', () => new THREE.Texture());
  const scene = new THREE.Scene(), film = new FilmSetRenderer(scene), lighting = new LightCulling(scene);
  const world = new WorldState(); new AgentManager(world).initializeAllAgents();
  const neo = world.agents.get('neo')!; neo.position = filmPosition('film_tv_repair', -4.6, 46.8); neo.isInMatrix = true;
  const journey = { scene: 'm1_tv_exit', actor: 'neo', step: 0, completed: [], tvExit: { phase: 'emerging', elapsed: 0,
    emerge: { neo: 1, trinity: 1, apoc: 1, switch: .4 }, street: { trinity: 0, apoc: 0, switch: 0 },
    crosscut: { phase: 'phone', elapsed: 0, view: 'matrix', attempts: 0, tankHealth: 100, tankHit: false,
      dozerDead: false, apocDead: false, switchDead: false, cypherDead: false, trinityOut: false, neoOut: false } } } as FilmJourney;
  const camera = new THREE.PerspectiveCamera(60, 16 / 9, .1, 300), gpu = {} as THREE.WebGLRenderer;
  const view = (x: number, z: number, yaw: number, stable?: boolean) => {
    film.update(neo, { neoLife: { journey } } as SandboxState, 0, neo.position);
    lighting.stablePointSlots = stable ?? film.stablePointSlots;
    camera.position.copy(new THREE.Vector3(neo.position.x + x, neo.position.y + 4, neo.position.z + z)); camera.rotation.set(0, yaw, 0);
    scene.updateMatrixWorld(); camera.updateMatrixWorld(); scene.onBeforeRender(gpu, scene, camera, null);
    const lights: { id: number; energy: number }[] = [];
    scene.traverseVisible(object => { if (object instanceof THREE.PointLight) lights.push({ id: object.id, energy: object.intensity }); });
    scene.onAfterRender(gpu, scene, camera); return lights;
  };
  t.after(() => { film.dispose(); lighting.dispose(); });
  return { scene, film, neo, journey, view };
}

test('the last survivor and the storefront objective keep all seven shop light slots across camera turns', t => {
  const h = fixture(t);
  const before = h.view(3.6, -.8, 0).map(light => light.id);
  assert.equal(before.length, 7, 'the dark objective must retain its slot before the final survivor leaves the shaft');
  for (const phase of ['emerging', 'ready'] as const) {
    h.journey.tvExit!.phase = phase; h.journey.tvExit!.emerge!.switch = phase === 'ready' ? 1 : .7;
    for (const [x, z] of [[0, 0], [0, -25], [0, -55]]) for (const yaw of [0, .7, -1.4, Math.PI]) {
      assert.deepEqual(h.view(x, z, yaw).map(light => light.id), before, `${phase} camera changes must reuse the same programs`);
    }
  }
});

test('stable shop slots preserve the original contributing energy, restore the rig and release on departure', t => {
  const h = fixture(t);
  for (const phase of ['emerging', 'ready'] as const) {
    h.journey.tvExit!.phase = phase;
    for (const [x, z, yaw] of [[0, 0, 0], [0, -25, 1], [0, -55, Math.PI]]) {
      const energy = (stable: boolean) => h.view(x, z, yaw, stable).filter(light => light.energy > 0);
      assert.deepEqual(energy(true), energy(false), 'padding cannot add energy or discard a possible contributor');
    }
  }
  const rig: number[] = [];
  h.film.root.traverseVisible(object => { if (object instanceof THREE.PointLight) rig.push(object.intensity); });
  assert.deepEqual(rig.sort((a, b) => a - b), [18, 35, 35, 80, 80, 80]);
  h.film.update(undefined, undefined, 0); assert.equal(h.film.stablePointSlots, false);
});

function tunnelFixture(t: TestContext) {
  const h = fixture(t);
  Object.assign(h.film, { current: FILM_SETS.film_ambush_house, currentScene: 'm1_basement' });
  const tunnel = { scene: 'm1_basement', actor: 'neo', step: 4, basement: { phase: 'tunnel' } } as FilmJourney;
  const sun = new THREE.DirectionalLight(), camera = new THREE.PerspectiveCamera();
  h.scene.add(sun, new THREE.DirectionalLight(), new THREE.HemisphereLight());
  h.scene.environment = new THREE.Texture(); h.scene.fog = new THREE.FogExp2();
  const parent = new THREE.Group(), hero = new THREE.Group(), geometry = new THREE.BoxGeometry(), material = new THREE.MeshStandardMaterial();
  const skin = new THREE.SkinnedMesh(geometry, material), hidden = new THREE.Mesh(geometry, material);
  hidden.userData.reloadedHidden = true; hidden.visible = false;
  hero.add(skin, hidden); parent.add(hero); parent.visible = false; h.scene.add(parent);
  const rooms = new Set<THREE.Object3D>(), batches: THREE.Object3D[][] = [];
  const programs: { program: object; isReady(): boolean; getUniforms(): void }[] = [];
  let target: THREE.WebGLRenderTarget | null = null, bindings = 0, uploads = 0;
  const gpu = {
    properties: { get: () => ({}) }, info: { programs }, debug: { checkShaderErrors: true }, extensions: { has: () => true },
    getContext: () => ({ LINK_STATUS: 0x8b82, getProgramParameter: () => true }),
    getRenderTarget: () => target, setRenderTarget: (value: typeof target) => { target = value; },
    compile(subject: THREE.Object3D, eye: THREE.Camera, lights: THREE.Scene) {
      assert.notEqual(lights, h.scene); assert.equal(lights.environment, h.scene.environment); assert.equal(lights.fog, h.scene.fog);
      assert.equal(eye, camera); assert.equal(target?.width, 1);
      const visible: THREE.Object3D[] = []; lights.traverseVisible(object => visible.push(object));
      assert.equal(visible.filter(o => o instanceof THREE.PointLight).length, 7);
      assert.equal(visible.filter(o => o instanceof THREE.DirectionalLight).length, 3);
      assert.equal(visible.filter(o => o instanceof THREE.DirectionalLight && o.castShadow).length, 2);
      assert.equal(visible.filter(o => o instanceof THREE.SpotLight && o.castShadow).length, 1);
      const room = visible.find(object => object.name === 'franklin-erie-tv-repair');
      assert.ok(room); assert.equal(h.scene.getObjectByName(room.name), undefined); rooms.add(room);
      const batch: THREE.Object3D[] = []; subject.traverse(object => batch.push(object));
      assert.ok(batch.length > 0 && batch.length <= 4); batches.push(batch);
      programs.push({ program: {}, isReady: () => true, getUniforms: () => { bindings++; } });
    },
    initTexture() { uploads++; },
  } as unknown as THREE.WebGLRenderer;
  const prepare = () => {
    assert.equal(typeof h.film.prepareTvExit, 'function', 'prepare the exit shop from the actual tunnel');
    const before = batches.length + bindings + uploads;
    h.film.prepareTvExit(gpu, camera, tunnel, id => id === 'neo' ? hero : undefined, sun);
    assert.ok(batches.length + bindings + uploads - before <= 1);
    assert.equal(target, null); assert.equal(parent.visible, false); assert.equal(hero.parent, parent); assert.equal(skin.parent, hero);
    assert.equal(sun.castShadow, false); assert.equal(gpu.debug.checkShaderErrors, true);
  };
  const drain = () => { for (let i = 0; i < 200; i++) prepare(); };
  t.after(() => { geometry.dispose(); material.dispose(); h.scene.environment!.dispose(); });
  return { ...h, tunnel, skin, hidden, rooms, batches, prepare, drain, newGpu: () => {
    gpu.properties = { get: () => ({}) } as THREE.WebGLRenderer['properties'];
  } };
}

test('the tunnel prepares the shop and Neo with the actual exit light slots in bounded batches', t => {
  const h = tunnelFixture(t);
  h.tunnel.basement!.phase = 'draining'; h.prepare(); assert.equal(h.batches.length, 0);
  h.tunnel.basement!.phase = 'tunnel'; h.drain();
  assert.equal(h.rooms.size, 1); assert.ok(h.batches[0].includes(h.skin)); assert.equal(h.batches.flat().includes(h.hidden), false);
  const count = h.batches.length; h.drain(); assert.equal(h.batches.length, count);
  h.newGpu(); h.drain(); assert.equal(h.batches.length, count * 2); assert.equal(h.rooms.size, 1);
});

test('the next real shaft entry adopts the prepared shop and an abandoned tunnel releases it', t => {
  const h = tunnelFixture(t); h.drain();
  const first = [...h.rooms][0], firstRung = first.getObjectByName('tv-street-ladder')!.getObjectByProperty('isMesh', true) as THREE.Mesh;
  let abandoned = 0; firstRung.geometry.addEventListener('dispose', () => abandoned++);
  h.tunnel.visiting = 'm1_basement'; h.prepare(); assert.equal(first.parent, null); assert.equal(abandoned, 1);
  delete h.tunnel.visiting; h.drain();
  const room = [...h.rooms][1], ladder = room.getObjectByName('tv-street-ladder')!;
  const rung = ladder.getObjectByProperty('isMesh', true) as THREE.Mesh;
  let disposed = 0; rung.geometry.addEventListener('dispose', () => disposed++);
  h.journey.tvExit!.emerge = { neo: 0, trinity: 0, apoc: 0, switch: 0 };
  h.neo.currentLocation = 'film_tv_repair';
  h.film.update(h.neo, { neoLife: { journey: h.journey } } as SandboxState, 0);
  assert.equal(h.film.root.getObjectByName(ladder.name), ladder); assert.equal(room.parent, h.film.root);
  assert.equal(room.getObjectByName('tv-street-cutaway-road')!.visible, false);
  assert.equal(disposed, 0);
  h.film.update(undefined, undefined, 0); assert.equal(disposed, 1); h.film.dispose(); assert.equal(disposed, 1);
});
