import assert from 'node:assert/strict';
import test, { type TestContext } from 'node:test';
import * as THREE from 'three';
import { FILM_SETS, filmPosition, type FilmJourney, type SandboxState } from '@auto_matrix/shared';
import { FilmSetRenderer } from '../packages/client/src/engine/FilmSetRenderer.js';
import { AgentManager } from '../packages/server/src/agents/AgentManager.js';
import { WorldState } from '../packages/server/src/world/WorldState.js';

function fixture(t: TestContext) {
  const previous = globalThis.document;
  globalThis.document = { createElement: () => ({ getContext: () => ({
    createImageData: (w: number, h: number) => ({ data: new Uint8ClampedArray(w * h * 4) }), putImageData() {},
  }) }) } as unknown as Document;
  t.mock.method(THREE.TextureLoader.prototype, 'load', () => new THREE.Texture());
  const scene = new THREE.Scene(), film = new FilmSetRenderer(scene), camera = new THREE.PerspectiveCamera();
  scene.environment = new THREE.Texture(); scene.fog = new THREE.FogExp2();
  const sun = new THREE.DirectionalLight(); sun.castShadow = true; scene.add(sun, new THREE.DirectionalLight(), new THREE.HemisphereLight());
  Object.assign(film, { current: FILM_SETS.film_white_construct, currentScene: 'm1_guns' });
  const journey = { scene: 'm1_guns', actor: 'neo', step: 0, rescue: { phase: 'racks_ready', elapsed: 0 } } as FilmJourney;
  const parent = new THREE.Group(), hero = new THREE.Group(), body = new THREE.Group(), geometry = new THREE.BoxGeometry();
  parent.visible = false; parent.add(hero, body); scene.add(parent);
  const texture = new THREE.Texture({ width: 2048, height: 2048, complete: true }); texture.needsUpdate = true;
  const material = new THREE.MeshStandardMaterial({ map: texture }), skin = new THREE.SkinnedMesh(geometry, material); skin.visible = false; hero.add(skin);
  const later = new THREE.Mesh(geometry, material); later.userData.reloadedHidden = true; later.visible = false; hero.add(later);
  const coarse = new THREE.Mesh(geometry, new THREE.MeshStandardMaterial({ vertexColors: true })); body.add(coarse);
  const heroes = new Map([['neo', hero]]), bodies = new Map([['agent_jones', body]]), roots = new Set<THREE.Object3D>();
  const work: string[] = [], batches: THREE.Object3D[][] = [], programs: { program: object; isReady(): boolean; getUniforms(): void }[] = [];
  let ready = false, target: THREE.WebGLRenderTarget | null = null, uploaded = new WeakMap<THREE.Texture, number>();
  const properties = () => ({ get: (map: THREE.Texture) => ({ __version: uploaded.get(map) }) });
  const gpu = { properties: properties(), info: { programs }, debug: { checkShaderErrors: true }, extensions: { has: () => true },
    getContext: () => ({ LINK_STATUS: 0x8b82, getProgramParameter: () => true }), getRenderTarget: () => target, setRenderTarget: (value: typeof target) => { target = value; },
    compile(subject: THREE.Object3D, eye: THREE.Camera, colors: THREE.Scene) {
      assert.notEqual(colors, scene); assert.equal(colors.environment, scene.environment); assert.equal(colors.fog, scene.fog); assert.equal(eye, camera); assert.equal(target?.width, 1);
      let points = 0, shadows = 0; let root: THREE.Object3D | undefined;
      colors.traverseVisible(object => {
        if (object instanceof THREE.PointLight) points++;
        if (object instanceof THREE.DirectionalLight && object.castShadow) shadows++;
        if (object instanceof THREE.Group && object.parent instanceof THREE.Scene && object.getObjectByName('lobby-security-checkpoint')) root = object;
      });
      assert.equal(points, 9); assert.equal(shadows, 1); assert.ok(root); roots.add(root);
      assert.equal(scene.children.includes(root), false, 'the future lobby must stay offstage');
      const meshes: THREE.Object3D[] = []; subject.traverse(object => meshes.push(object)); assert.ok(meshes.length && meshes.length <= 4);
      if (meshes.includes(skin)) assert.match(material.customProgramCacheKey(), /actor-local-skin-v1$/);
      batches.push(meshes); work.push('compile'); programs.push({ program: {}, isReady: () => ready, getUniforms: () => { assert.equal(gpu.debug.checkShaderErrors, false); work.push('bindings'); } });
    },
    initTexture(map: THREE.Texture) { uploaded.set(map, map.version); work.push('texture'); },
  } as unknown as THREE.WebGLRenderer;
  const prepare = () => {
    const count = work.length; film.prepareLobby(gpu, camera, journey, id => bodies.get(id), id => heroes.get(id), sun);
    assert.ok(work.length - count <= 1, 'prepare one small batch, ready binding or large texture per frame');
    assert.equal(parent.visible, false); assert.equal(hero.parent, parent); assert.equal(skin.parent, hero); assert.equal(skin.visible, false); assert.equal(later.visible, false); assert.equal(target, null);
  };
  const drain = () => { for (let i = 0; i < 1000; i++) prepare(); };
  t.after(() => { film.dispose(); geometry.dispose(); material.dispose(); (coarse.material as THREE.Material).dispose(); texture.dispose(); scene.environment!.dispose(); globalThis.document = previous; });
  return { film, journey, gpu, heroes, bodies, geometry, material, skin, coarse, later, work, batches, roots, prepare, drain,
    ready: () => { ready = true; }, newGpu: () => { uploaded = new WeakMap(); gpu.properties = properties() as THREE.WebGLRenderer['properties']; } };
}

test('weapon preparation queues the future lobby, hidden cast and large maps in bounded batches', t => {
  const h = fixture(t); h.ready(); h.drain();
  assert.ok(h.batches.flat().includes(h.skin)); assert.ok(h.batches.flat().includes(h.coarse)); assert.equal(h.batches.flat().includes(h.later), false);
  assert.equal(h.work.filter(value => value === 'texture').length, 1); assert.equal(h.roots.size, 1);
  const count = h.work.length; h.drain(); assert.equal(h.work.length, count, 'finished preparation must stop producing GPU work');
  const late = new THREE.Group(), guard = new THREE.Mesh(h.geometry, h.material); guard.visible = false; late.add(guard); h.heroes.set('citizen_12', late);
  const before = h.batches.length; h.drain(); assert.ok(h.batches.slice(before).flat().includes(guard), 'late delivered security cast must be accepted');
  const after = h.batches.length; h.newGpu(); h.drain(); assert.ok(h.batches.length > after); assert.equal(h.roots.size, 1, 'a new GPU reuses the same authored lobby');
});

test('cancelling or visiting releases the offstage lobby once without changing the live scene', t => {
  const h = fixture(t); h.journey.visiting = 'm1_guns'; h.prepare(); assert.equal(h.work.length, 0); delete h.journey.visiting;
  h.ready(); h.drain(); const root = [...h.roots][0], mesh = root.getObjectByName('lobby-security-console') as THREE.Mesh;
  let disposed = 0; mesh.geometry.addEventListener('dispose', () => disposed++);
  h.journey.scene = 'm1_rescue_decision'; h.prepare(); assert.equal(root.parent, null); assert.equal(disposed, 1);
  h.prepare(); assert.equal(disposed, 1);
});

test('entering the lobby adopts the prepared fixtures and releases them once on departure', t => {
  const h = fixture(t); h.ready(); h.drain(); const root = [...h.roots][0], console = root.getObjectByName('lobby-security-console') as THREE.Mesh;
  let disposed = 0; console.geometry.addEventListener('dispose', () => disposed++);
  const world = new WorldState(); new AgentManager(world).initializeAllAgents(); const neo = world.agents.get('neo')!, center = FILM_SETS.film_government_lobby.center;
  neo.position = filmPosition('film_government_lobby', 0, 35); neo.currentLocation = 'film_government_lobby'; neo.isInMatrix = true;
  const journey = { ...h.journey, scene: 'm1_lobby', step: 0, completed: [], lobby: { phase: 'ready', columns: Array(10).fill(0) } } as FilmJourney;
  h.film.update(neo, { neoLife: { journey } } as SandboxState, 0); h.film.root.updateMatrixWorld(true);
  assert.equal(h.film.root.getObjectByName(console.name), console); assert.equal(root.parent, h.film.root); assert.equal(disposed, 0);
  assert.deepEqual(root.getWorldPosition(new THREE.Vector3()).toArray(), [center.x, center.y - 1, center.z]);
  h.film.update(undefined, undefined, 0); assert.equal(disposed, 1); h.film.dispose(); assert.equal(disposed, 1);
});
