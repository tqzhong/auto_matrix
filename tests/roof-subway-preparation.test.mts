import assert from 'node:assert/strict';
import test, { type TestContext } from 'node:test';
import * as THREE from 'three';
import { FILM_SETS, filmPosition, type FilmJourney, type SandboxState } from '@auto_matrix/shared';
import { FilmSetRenderer } from '../packages/client/src/engine/FilmSetRenderer.js';
import { AgentManager } from '../packages/server/src/agents/AgentManager.js';
import { WorldState } from '../packages/server/src/world/WorldState.js';

function fixture(t: TestContext, mode: 'roof' | 'subway') {
  const roof = mode === 'roof', targetSet = roof ? 'film_government_roof' : 'film_subway_platform', landmark = roof ? 'government-roof-deck' : 'matrix-subway-track';
  const previous = globalThis.document;
  globalThis.document = { createElement: () => ({ getContext: () => ({
    createImageData: (w: number, h: number) => ({ data: new Uint8ClampedArray(w * h * 4) }), putImageData() {},
  }) }) } as unknown as Document;
  t.mock.method(THREE.TextureLoader.prototype, 'load', () => new THREE.Texture());
  const scene = new THREE.Scene(), film = new FilmSetRenderer(scene), camera = new THREE.PerspectiveCamera();
  scene.environment = new THREE.Texture(); scene.fog = new THREE.FogExp2();
  const sun = new THREE.DirectionalLight(); sun.castShadow = true; scene.add(sun, new THREE.DirectionalLight(), new THREE.HemisphereLight());
  Object.assign(film, { current: FILM_SETS[roof ? 'film_government_office' : 'film_government_roof'], currentScene: roof ? 'm1_helicopter' : 'm1_rooftop_rescue' });
  const journey = { scene: roof ? 'm1_helicopter' : 'm1_rooftop_rescue', actor: 'neo', step: 1, airRescue: { kind: roof ? 'office' : 'roof', phase: roof ? 'catching' : 'pulling', elapsed: 0, attempt: 0 } } as FilmJourney;
  const parent = new THREE.Group(), hero = new THREE.Group(), body = new THREE.Group(), geometry = new THREE.BoxGeometry();
  parent.visible = false; parent.add(hero, body); scene.add(parent);
  const texture = new THREE.Texture({ width: 2048, height: 2048, complete: true }); texture.needsUpdate = true;
  const material = new THREE.MeshStandardMaterial({ map: texture }), skin = new THREE.SkinnedMesh(geometry, material); skin.visible = false; hero.add(skin);
  const later = new THREE.Mesh(geometry, material); later.userData.reloadedHidden = true; later.visible = false; hero.add(later);
  const coarse = new THREE.Mesh(geometry, new THREE.MeshStandardMaterial({ vertexColors: true })); body.add(coarse);
  const heroes = new Map([['neo', hero]]), bodies = new Map([[roof ? 'morpheus' : 'citizen_13', body]]), roots = new Set<THREE.Object3D>();
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
        if (object instanceof THREE.Group && object.parent instanceof THREE.Scene && object.getObjectByName(landmark)) root = object;
      });
      assert.equal(points, roof ? 4 : 12); assert.equal(shadows, roof ? 2 : 1); assert.ok(root); roots.add(root);
      assert.equal(scene.children.includes(root), false, 'the future air rescue office must stay offstage');

      const meshes: THREE.Object3D[] = []; subject.traverse(object => meshes.push(object)); assert.ok(meshes.length && meshes.length <= 4);
      if (meshes.includes(skin)) assert.match(material.customProgramCacheKey(), /actor-local-skin-v1$/);
      batches.push(meshes); work.push('compile'); programs.push({ program: {}, isReady: () => ready, getUniforms: () => { assert.equal(gpu.debug.checkShaderErrors, false); work.push('bindings'); } });
    },
    initTexture(map: THREE.Texture) { uploaded.set(map, map.version); work.push('texture'); },
  } as unknown as THREE.WebGLRenderer;
  const prepare = () => {
    const count = work.length; if (roof) film.prepareGovernment(gpu, camera, journey, id => bodies.get(id), id => heroes.get(id), sun);
    else film.prepareSubway(gpu, camera, journey, id => bodies.get(id), id => heroes.get(id), sun);
    assert.ok(work.length - count <= 1, 'prepare one small batch, ready binding or large texture per frame');
    assert.equal(parent.visible, false); assert.equal(hero.parent, parent); assert.equal(skin.parent, hero); assert.equal(skin.visible, false); assert.equal(later.visible, false); assert.equal(target, null);
  };
  const drain = () => { for (let i = 0; i < 1000; i++) prepare(); };
  t.after(() => { film.dispose(); geometry.dispose(); material.dispose(); (coarse.material as THREE.Material).dispose(); texture.dispose(); scene.environment!.dispose(); globalThis.document = previous; });
  return { target: targetSet, landmark, film, journey, gpu, heroes, bodies, geometry, material, skin, coarse, later, work, batches, roots, prepare, drain,
    ready: () => { ready = true; }, newGpu: () => { uploaded = new WeakMap(); gpu.properties = properties() as THREE.WebGLRenderer['properties']; } };
}

for (const mode of ['roof', 'subway'] as const) {
  test(`${mode} preparation includes hidden and late cast in bounded batches with the next lighting`, t => {
    const h = fixture(t, mode); h.ready(); h.drain();
    assert.ok(h.batches.flat().includes(h.skin)); assert.ok(h.batches.flat().includes(h.coarse)); assert.equal(h.batches.flat().includes(h.later), false);
    assert.equal(h.work.filter(value => value === 'texture').length, 1); assert.equal(h.roots.size, 1);
    const count = h.work.length; h.drain(); assert.equal(h.work.length, count);
    const late = new THREE.Group(), mesh = new THREE.Mesh(h.geometry, h.material); mesh.visible = false; late.add(mesh); h.heroes.set('trinity', late);
    const before = h.batches.length; h.drain(); assert.ok(h.batches.slice(before).flat().includes(mesh));
    const after = h.batches.length; h.newGpu(); h.drain(); assert.ok(h.batches.length > after); assert.equal(h.roots.size, 1);
  });
  test(`${mode} cancellation and visiting release the future room once`, t => {
    const h = fixture(t, mode); h.journey.visiting = h.journey.scene; h.prepare(); assert.equal(h.work.length, 0); delete h.journey.visiting;
    h.ready(); h.drain(); const root = [...h.roots][0], mesh = root.getObjectByName(h.landmark) as THREE.Mesh;
    let disposed = 0; mesh.geometry.addEventListener('dispose', () => disposed++);
    h.journey.scene = 'm1_guns'; h.prepare(); assert.ok(root.parent === null); assert.equal(disposed, 1); h.prepare(); assert.equal(disposed, 1);
  });
  test(`${mode} entry adopts the same geometry at its authored world position`, t => {
    const h = fixture(t, mode); h.ready(); h.drain(); const root = [...h.roots][0], mesh = root.getObjectByName(h.landmark) as THREE.Mesh;
    root.updateMatrixWorld(true); const local = mesh.getWorldPosition(new THREE.Vector3()), center = FILM_SETS[h.target].center;
    let disposed = 0; mesh.geometry.addEventListener('dispose', () => disposed++);
    const world = new WorldState(); new AgentManager(world).initializeAllAgents(); const neo = world.agents.get('neo')!;
    neo.position = filmPosition(h.target); neo.currentLocation = h.target; neo.isInMatrix = true;
    const journey = { ...h.journey, scene: mode === 'roof' ? 'm1_rooftop_rescue' : 'm1_subway', step: 0, completed: [], airRescue: mode === 'roof' ? { kind: 'roof', phase: 'ready', elapsed: 0, attempt: 0, grip: 1, braces: 0, misses: 0, resolved: [] } : undefined } as FilmJourney;
    h.film.update(neo, { neoLife: { journey } } as SandboxState, 0); h.film.root.updateMatrixWorld(true);
    assert.ok(h.film.root.getObjectByName(h.landmark) === mesh); assert.equal(disposed, 0);
    assert.deepEqual(mesh.getWorldPosition(new THREE.Vector3()).toArray(), [center.x + local.x, center.y - 1 + local.y, center.z + local.z]);
    h.film.update(undefined, undefined, 0); assert.equal(disposed, 1); h.film.dispose(); assert.equal(disposed, 1);
  });
}
