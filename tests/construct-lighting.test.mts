import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from 'three';
import { FILM_SETS, filmPosition, type FilmJourney, type SandboxState } from '@auto_matrix/shared';
import { FilmSetRenderer } from '../packages/client/src/engine/FilmSetRenderer.js';
import { LightCulling } from '../packages/client/src/engine/LightCulling.js';
import { preserveProgramBindings } from '../packages/client/src/engine/PrepareShaderProgram.js';
import { WorldState } from '../packages/server/src/world/WorldState.js';
import { AgentManager } from '../packages/server/src/agents/AgentManager.js';

test('the first Construct keeps the screen and objective slots through locked and walkable views', t => {
  const sets = Object.assign(Object.create(FilmSetRenderer.prototype), { current: FILM_SETS.film_white_construct, currentScene: 'm1_construct' }) as FilmSetRenderer;
  const scene = new THREE.Scene(), camera = new THREE.PerspectiveCamera(65, 16 / 9, .1, 100), subject = new THREE.Group();
  camera.position.set(7, 3, 5); camera.lookAt(0, 2, -13); camera.updateMatrixWorld();
  const screen = new THREE.PointLight(0xffffff, 18, 20), marker = new THREE.PointLight(0xffcc66, 0, 20); screen.position.set(0, 2, -12); marker.position.set(5, 2, -4); scene.add(screen, marker);
  const lighting = new LightCulling(scene), counts: number[] = []; t.after(() => lighting.dispose());
  const renderer = { compile: (_subject: THREE.Object3D, _camera: THREE.Camera, view: THREE.Scene) => {
    let count = 0; view.traverseVisible(object => { if (object instanceof THREE.PointLight) count++; }); counts.push(count);
  } } as unknown as THREE.WebGLRenderer;
  for (const sceneId of ['m1_construct', 'm1_truth_exit']) {
    Object.assign(sets, { currentScene: sceneId });
    for (const shown of [false, true, false]) {
      lighting.stablePointSlots = sets.stablePointSlots; marker.visible = shown || sets.stablePointSlots; marker.intensity = shown ? 5 : 0;
      lighting.compileSubject(renderer, camera, subject); assert.equal(marker.intensity, shown ? 5 : 0); assert.equal(screen.intensity, 18);
    }
  }
  assert.deepEqual(counts, [2, 2, 2, 2, 2, 2], 'opening the objective cue must not change every colour program');
});

test('detached program preparation restores the live shadow uniforms and lets a cold material bind on first draw', () => {
  const geometry = new THREE.BoxGeometry(), material = new THREE.MeshStandardMaterial(), cold = new THREE.MeshStandardMaterial();
  const actor = new THREE.Mesh(geometry, material), prop = new THREE.Mesh(geometry, cold);
  const currentProgram = {}, spotLights = [{}], detachedLights: object[] = [], programs = new Map();
  const live = { currentProgram, uniforms: { spotLightShadows: { value: spotLights } }, programs };
  const unused: { currentProgram?: object; __version?: number; programs: Map<string, object> } = { programs: new Map() };
  const renderer = { properties: { get: (value: THREE.Material) => value === material ? live : unused } } as unknown as THREE.WebGLRenderer;
  try {
    const restore = preserveProgramBindings(renderer, [actor, prop]);
    live.uniforms.spotLightShadows.value = detachedLights;
    live.currentProgram = {}; programs.set('next', live.currentProgram);
    unused.currentProgram = {}; unused.__version = 0; unused.programs.set('next', unused.currentProgram);
    restore();
    assert.equal(live.currentProgram, currentProgram);
    assert.equal(live.uniforms.spotLightShadows.value, spotLights);
    assert.ok(programs.has('next') && unused.programs.has('next'));
    assert.equal(unused.currentProgram, undefined); assert.equal(unused.__version, undefined);
  } finally { geometry.dispose(); material.dispose(); cold.dispose(); }
});

for (const [source, destination, set, kind] of [
  ['m1_cabin', 'm1_construct', 'film_neb_deck', 'core'],
  ['m1_desert', 'm1_truth_exit', 'film_real_desert', 'desert'],
  ['m1_rescue_decision', 'm1_guns', 'film_neb_deck', 'briefing'],
] as const) test(`${destination} prepares its actual props and cast while still in ${source}`, t => {
  const armoury = destination === 'm1_guns', propName = armoury ? 'construct-rack-row-0' : 'construct-chair-neo';
  const document = globalThis.document;
  globalThis.document = { createElement: () => ({ getContext: () => ({ fillRect() {}, fillText() {},
    beginPath() {}, moveTo() {}, lineTo() {}, arc() {}, stroke() {}, fill() {},
    createLinearGradient: () => ({ addColorStop() {} }) }) }) } as unknown as Document;
  t.after(() => { globalThis.document = document; });
  const scene = new THREE.Scene(), film = new FilmSetRenderer(scene), camera = new THREE.PerspectiveCamera();
  const sun = new THREE.DirectionalLight(); const fill = new THREE.DirectionalLight(); const ambient = new THREE.HemisphereLight();
  scene.add(sun, fill, ambient);
  Object.assign(film, { current: FILM_SETS[set], currentScene: source });
  const journey = { scene: source, actor: 'neo', ...(armoury ? { rescue: { phase: 'briefing', elapsed: 4 } }
    : { awakening: { kind, elapsed: 4, started: true } }) } as FilmJourney;
  const neoHero = new THREE.Group(), actorParent = new THREE.Group(), surfaces = new THREE.Group();
  const geometry = new THREE.BoxGeometry(), material = new THREE.MeshStandardMaterial({ name: 'Skin' });
  geometry.setAttribute('skinWeightResidual', new THREE.Float32BufferAttribute(new Float32Array(geometry.attributes.position.count), 1));
  const skin = new THREE.SkinnedMesh(geometry, material); skin.name = 'Anatomical_head_and_hands'; surfaces.add(skin); neoHero.add(surfaces);
  actorParent.visible = false; actorParent.add(neoHero); scene.add(actorParent);
  const trinity = new THREE.Group(), boots = new THREE.Mesh(geometry, material); boots.visible = false; trinity.add(boots); actorParent.add(trinity);
  const shadowMaterial = new THREE.MeshBasicMaterial({ transparent: true, depthWrite: false });
  const trinityShadow = new THREE.Mesh(geometry, shadowMaterial); trinity.add(trinityShadow);
  const properties = new WeakMap<THREE.Material, object>(), liveBinding = {}, compiled = new Set<THREE.Object3D>();
  properties.set(material, { currentProgram: liveBinding });
  let target: THREE.WebGLRenderTarget | null = null, props: THREE.Group | undefined, castsSun = false;
  const gpu = { properties: { get: (material: THREE.Material) => properties.get(material) ?? {} },
    extensions: { has: () => true }, info: { programs: [] }, shadowMap: { enabled: true, type: THREE.PCFSoftShadowMap },
    getActiveCubeFace: () => 0, getActiveMipmapLevel: () => 0, render() {},
    getRenderTarget: () => target, setRenderTarget: (next: typeof target) => { target = next; },
    compile(subject: THREE.Group, _camera: THREE.Camera, lights: THREE.Scene) {
      let points = 0;
      lights.traverseVisible(object => {
        if (object instanceof THREE.PointLight) points++;
        if (object instanceof THREE.DirectionalLight && object.castShadow) castsSun = true;
        if (object.name === propName) props = object as THREE.Group;
      });
      assert.equal(points, armoury ? 5 : 2);
      subject.traverse(object => { compiled.add(object); if (object === skin) Object.assign(properties.get(material)!, { currentProgram: {} }); });
    },
  } as unknown as THREE.WebGLRenderer;
  t.after(() => { film.dispose(); geometry.dispose(); material.dispose(); shadowMaterial.dispose(); });
  assert.equal(typeof film.prepareAwakeningHandoff, 'function', 'the first Construct needs preparation before the ship cut');
  const prepare = () => film.prepareAwakeningHandoff(gpu, camera, journey, id => id === 'neo' ? neoHero : id === 'trinity' ? trinity : undefined,
    sun, undefined, armoury ? { armouryShadow: trinityShadow } : undefined);
  if (armoury) {
    journey.rescue!.phase = 'briefing_ready'; prepare(); assert.equal(compiled.size, 0);
    journey.rescue!.phase = 'briefing';
  }
  for (let frame = 0; frame < 190; frame++) prepare();
  assert(compiled.has(skin) && castsSun && props);
  if (armoury) {
    assert.ok(compiled.has(boots), 'Trinity’s hidden gear prepares for the white room');
    assert.ok(compiled.has(trinityShadow), 'the first view draws Trinity’s existing contact shadow');
  }
  assert.equal((properties.get(material) as { currentProgram: object }).currentProgram, liveBinding);
  assert.equal(sun.castShadow, false); assert.equal(actorParent.visible, false); assert.equal(target, null);
  assert.equal(film.root.getObjectByName(propName), undefined);
  const world = new WorldState(); new AgentManager(world).initializeAllAgents();
  const neo = world.agents.get('neo')!; neo.position = filmPosition('film_white_construct', 0, 0); neo.isInMatrix = true;
  Object.assign(journey, { scene: destination, step: 0, awakening: undefined });
  if (armoury) journey.rescue = { phase: 'racks_ready', elapsed: 0 };
  film.update(neo, { structures: [], neoLife: { journey } } as unknown as SandboxState, 0);
  assert.ok(film.root.getObjectByName(propName) === props, 'the construct must attach its prepared props');
  if (armoury) assert.equal(props.visible, false, 'the prepared weapon rows wait for the actual request');
});

test('the real terrain prepares its CRT and playable programs and uploads its maps before showing the CRT', async t => {
  const savedDocument = globalThis.document;
  globalThis.document = { createElement: () => ({ getContext: () => ({ fillRect() {}, fillText() {},
    beginPath() {}, moveTo() {}, lineTo() {}, arc() {}, stroke() {}, fill() {}, ellipse() {},
    createLinearGradient: () => ({ addColorStop() {} }) }) }) } as unknown as Document;
  t.mock.method(THREE.TextureLoader.prototype, 'load', (url, onLoad) => {
    const texture = new THREE.Texture({ width: 2048, height: 2048 }); texture.name = url; texture.needsUpdate = true;
    queueMicrotask(() => onLoad?.(texture)); return texture;
  });
  const scene = new THREE.Scene(), film = new FilmSetRenderer(scene), eye = new THREE.PerspectiveCamera();
  const sun = new THREE.DirectionalLight(); sun.castShadow = true;
  scene.add(sun, new THREE.DirectionalLight(), new THREE.HemisphereLight()); scene.fog = new THREE.FogExp2();
  const world = new WorldState(); new AgentManager(world).initializeAllAgents();
  const neo = world.agents.get('neo')!; neo.position = filmPosition('film_white_construct'); neo.isInMatrix = true;
  const journey = { scene: 'm1_construct', actor: 'neo', step: 0, awakening: { kind: 'construct', elapsed: 4, started: true } } as FilmJourney;
  const sandbox = { structures: [], neoLife: { journey } } as unknown as SandboxState;
  const compiled = new Map<number, THREE.Mesh>(), ashSlots = new Set<number>(), uploaded = new WeakMap<THREE.Texture, { __version: number }>();
  let markerPrepared = false;
  let target: THREE.WebGLRenderTarget | null = null, draws = 0, terrain: THREE.Mesh | undefined;
  const gpu = { info: { programs: [] }, extensions: { has: () => true }, shadowMap: { enabled: true },
    properties: { get: (value: THREE.Texture) => uploaded.get(value) ?? {} },
    getRenderTarget: () => target, setRenderTarget: (value: typeof target) => { target = value; },
    initTexture: (texture: THREE.Texture) => uploaded.set(texture, { __version: texture.version }),
    readRenderTargetPixelsAsync: async () => null,
    render: (view: THREE.Scene) => { draws++; terrain = view.getObjectByName('desert-cracked-ground') as THREE.Mesh; },
    compile(subject: THREE.Object3D, _camera: THREE.Camera, lights: THREE.Scene) {
      let points = 0; lights.traverseVisible(object => { if (object instanceof THREE.PointLight) points++; });
      subject.traverse(object => {
        if (object instanceof THREE.Mesh && object.name === 'desert-cracked-ground') compiled.set(points, object);
        if (object instanceof THREE.Points && object.name === 'desert-falling-ash') ashSlots.add(points);
        if (object === film.goalMarker && points === 2) markerPrepared = true;
      });
    },
  } as unknown as THREE.WebGLRenderer;
  const renderPreview = () => film.renderTelevisionPreview(gpu, eye, () => [], sun);
  t.after(() => { film.dispose(); globalThis.document = savedDocument; });
  film.update(neo, sandbox, 0);
  for (let frame = 0; frame < 260; frame++) { renderPreview(); await Promise.resolve(); }
  assert.equal(draws, 0, 'preparation must leave the CRT on its authored lead-in');
  const ground = compiled.get(1)!;
  assert.ok(ground && compiled.get(2) === ground, 'the same actual ground must link under both light layouts before drawing');
  assert.ok(uploaded.has((ground.material as THREE.MeshStandardMaterial).map!), 'the original large ground map is already on the GPU');
  assert.deepEqual(ashSlots, new Set([1, 2]), 'the CRT and the live scene must each prepare the ash program');
  assert.ok(markerPrepared, 'the first walk objective must prepare under the desert layout');
  journey.awakening!.elapsed = 8; film.update(neo, sandbox, 0); renderPreview();
  assert.equal(draws, 1); assert.equal(terrain, ground); assert.equal(target, null);
  neo.isInMatrix = false; neo.position = filmPosition('film_real_desert'); journey.scene = 'm1_desert';
  film.update(neo, sandbox, 0);
  assert.equal(film.root.getObjectByName('desert-cracked-ground'), ground);
});
