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
  for (const shown of [false, true, false]) {
    lighting.stablePointSlots = sets.stablePointSlots; marker.visible = shown || sets.stablePointSlots; marker.intensity = shown ? 5 : 0;
    lighting.compileSubject(renderer, camera, subject); assert.equal(marker.intensity, shown ? 5 : 0); assert.equal(screen.intensity, 18);
  }
  assert.deepEqual(counts, [2, 2, 2], 'opening the objective cue must not change every colour program');
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

test('the first Construct prepares its actual props and actors from the connection chair', t => {
  const document = globalThis.document;
  globalThis.document = { createElement: () => ({ getContext: () => ({ fillRect() {}, fillText() {},
    beginPath() {}, moveTo() {}, lineTo() {}, arc() {}, stroke() {}, fill() {} }) }) } as unknown as Document;
  t.after(() => { globalThis.document = document; });
  const scene = new THREE.Scene(), film = new FilmSetRenderer(scene), camera = new THREE.PerspectiveCamera();
  const sun = new THREE.DirectionalLight(); const fill = new THREE.DirectionalLight(); const ambient = new THREE.HemisphereLight();
  scene.add(sun, fill, ambient);
  Object.assign(film, { current: FILM_SETS.film_neb_deck, currentScene: 'm1_cabin' });
  const journey = { scene: 'm1_cabin', actor: 'neo', awakening: { kind: 'core', elapsed: 4 } } as FilmJourney;
  const neoHero = new THREE.Group(), actorParent = new THREE.Group(), surfaces = new THREE.Group();
  const geometry = new THREE.BoxGeometry(), material = new THREE.MeshStandardMaterial({ name: 'Skin' });
  geometry.setAttribute('skinWeightResidual', new THREE.Float32BufferAttribute(new Float32Array(geometry.attributes.position.count), 1));
  const skin = new THREE.SkinnedMesh(geometry, material); skin.name = 'Anatomical_head_and_hands'; surfaces.add(skin); neoHero.add(surfaces);
  actorParent.visible = false; actorParent.add(neoHero); scene.add(actorParent);
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
        if (object.name === 'construct-chair-neo') props = object as THREE.Group;
      });
      assert.equal(points, 2);
      subject.traverse(object => { compiled.add(object); if (object === skin) Object.assign(properties.get(material)!, { currentProgram: {} }); });
    },
  } as unknown as THREE.WebGLRenderer;
  t.after(() => { film.dispose(); geometry.dispose(); material.dispose(); });
  assert.equal(typeof film.prepareAwakeningHandoff, 'function', 'the first Construct needs preparation before the ship cut');
  for (let frame = 0; frame < 130; frame++) film.prepareAwakeningHandoff(gpu, camera, journey, id => id === 'neo' ? neoHero : undefined, sun);
  assert(compiled.has(skin) && castsSun && props);
  assert.equal((properties.get(material) as { currentProgram: object }).currentProgram, liveBinding);
  assert.equal(sun.castShadow, false); assert.equal(actorParent.visible, false); assert.equal(target, null);
  assert.equal(film.root.getObjectByName('construct-chair-neo'), undefined);
  const world = new WorldState(); new AgentManager(world).initializeAllAgents();
  const neo = world.agents.get('neo')!; neo.position = filmPosition('film_white_construct', 0, 0); neo.isInMatrix = true;
  Object.assign(journey, { scene: 'm1_construct', step: 0, constructArrival: { phase: 'ready', elapsed: 0 }, awakening: undefined });
  film.update(neo, { structures: [], neoLife: { journey } } as unknown as SandboxState, 0);
  assert.ok(film.root.getObjectByName('construct-chair-neo') === props, 'the construct must attach its prepared props');
});
