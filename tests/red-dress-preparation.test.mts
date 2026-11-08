import assert from 'node:assert/strict';
import test, { type TestContext } from 'node:test';
import * as THREE from 'three';
import { FILM_SETS, type FilmJourney, type SandboxState } from '@auto_matrix/shared';
import { FilmSetRenderer } from '../packages/client/src/engine/FilmSetRenderer.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { LightCulling } from '../packages/client/src/engine/LightCulling.js';
import { WorldState } from '../packages/server/src/world/WorldState.js';
import { AgentManager } from '../packages/server/src/agents/AgentManager.js';

function fixture(t: TestContext) {
  let finishAssets!: ()=>void; const loaded = new Promise<void>(resolve=>{finishAssets=resolve;});
  t.mock.method(GLTFLoader.prototype, 'loadAsync', async () => { await loaded; const scene=new THREE.Group(), geometry=new THREE.BoxGeometry(); geometry.morphAttributes.position=[geometry.attributes.position.clone()]; geometry.morphAttributes.normal=[geometry.attributes.normal.clone()]; const mesh=new THREE.Mesh(geometry,new THREE.MeshStandardMaterial()); mesh.name='future-crowd'; scene.add(mesh); return {scene,parser:{json:{extras:{phases:[0],cycleDistance:2.8}}}} as never; });
  t.mock.method(THREE.TextureLoader.prototype, 'load', () => new THREE.Texture());
  const previousDocument = globalThis.document;
  globalThis.document = { createElement: () => ({ getContext: () => ({ fillRect() {}, strokeRect() {}, fillText() {},
    createImageData: (w: number, h: number) => ({ data: new Uint8ClampedArray(w * h * 4) }), putImageData() {},
    beginPath() {}, moveTo() {}, lineTo() {}, stroke() {} }) }) } as unknown as Document;
  const scene = new THREE.Scene(), film = new FilmSetRenderer(scene), camera = new THREE.PerspectiveCamera();
  scene.environment = new THREE.Texture(); scene.fog = new THREE.FogExp2();
  const sun = new THREE.DirectionalLight(); sun.castShadow = false; scene.add(sun, new THREE.DirectionalLight(), new THREE.HemisphereLight());
  Object.assign(film, { current: FILM_SETS.film_neb_deck, currentScene: 'm1_jump_return' });
  const journey = { scene: 'm1_jump_return', step: 0, training: { kind: 'jump_return', elapsed: 2, started: true } } as FilmJourney;
  const parent = new THREE.Group(), actor = new THREE.Group(), geometry = new THREE.BoxGeometry(); parent.visible = false; parent.add(actor); scene.add(parent);
  const texture = new THREE.Texture({ width: 2048, height: 2048 }); texture.needsUpdate = true;
  const material = new THREE.MeshStandardMaterial({ map: texture }), skin = new THREE.SkinnedMesh(geometry, material); actor.add(skin);
  const coat = new THREE.SkinnedMesh(geometry, material); coat.visible = false; actor.add(coat); const costume = new THREE.SkinnedMesh(geometry, material); costume.userData.reloadedHidden = true; costume.visible = false; actor.add(costume);
  const actors = new Map([['neo', actor]]), work: string[] = [], batches: THREE.Object3D[][] = [], decks = new Set<THREE.Object3D>();
  const programs: { program: object; isReady(): boolean; getUniforms(): void }[] = [];
  let ready = false, target: THREE.WebGLRenderTarget | null = null, uploaded = new WeakMap<THREE.Texture, number>();
  const properties = () => ({ get: (map: THREE.Texture) => ({ __version: uploaded.get(map) }) });
  const gpu = { properties: properties(), info: { programs }, debug: { checkShaderErrors: true }, extensions: { has: () => true },
    getContext: () => ({ LINK_STATUS: 0x8b82, getProgramParameter: () => true }),
    getRenderTarget: () => target, setRenderTarget: (value: typeof target) => { target = value; },
    compile(subject: THREE.Object3D, eye: THREE.Camera, lights: THREE.Scene) {
      assert.notEqual(lights, scene); assert.equal(lights.environment, scene.environment); assert.equal(lights.fog, scene.fog); assert.equal(eye, camera); assert.equal(target?.width, 1);
      let slots = 0; lights.traverseVisible(object => { if (object instanceof THREE.PointLight) slots++; }); assert.equal(slots, 1);
      let suns = 0; lights.traverseVisible(object => { if (object instanceof THREE.DirectionalLight && object.castShadow) suns++; }); assert.equal(suns, 1, 'only the plaza sun casts future shadows');
      let deck: THREE.Object3D | undefined;
      lights.traverseVisible(object => { if (object instanceof THREE.Group && object.parent instanceof THREE.Scene && object.getObjectByName('training-red-dress-set')) deck = object; });
      assert.ok(deck); decks.add(deck);
      assert.ok(!scene.children.includes(deck), 'the future plaza must stay offstage');
      const batch: THREE.Object3D[] = []; subject.traverse(object => batch.push(object)); assert.ok(batch.length > 0 && batch.length <= 4);
      if (batch.includes(skin)) assert.match(material.customProgramCacheKey(), /actor-local-skin-v1$/);
      batches.push(batch); work.push('compile'); programs.push({ program: {}, isReady: () => ready, getUniforms: () => {
        assert.equal(gpu.debug.checkShaderErrors, false); work.push('bindings');
      } });
    },
    initTexture(map: THREE.Texture) { work.push('texture'); uploaded.set(map, map.version); },
  } as unknown as THREE.WebGLRenderer;
  const prepare = () => {
    const count = work.length; film.prepareRedDress(gpu, camera, journey, id => actors.get(id));
    assert.ok(work.length - count <= 1, 'prepare one batch, completed binding or texture per frame');
    assert.equal(target, null); assert.equal(parent.visible, false); assert.equal(actor.parent, parent); assert.equal(skin.parent, actor); assert.equal(coat.visible, false); assert.equal(sun.castShadow, false); assert.equal(gpu.debug.checkShaderErrors, true);
  };
  const drain = () => { for (let i = 0; i < 450; i++) prepare(); };
  t.after(() => { film.dispose(); geometry.dispose(); material.dispose(); texture.dispose(); scene.environment!.dispose(); globalThis.document = previousDocument; });
  return { film, gpu, scene, journey, actor, actors, geometry, material, skin, coat, costume, work, batches, decks, prepare, drain,
    assets: async () => { finishAssets(); await new Promise(resolve=>setImmediate(resolve)); }, ready: () => { ready = true; }, replaceGpu: () => { uploaded = new WeakMap(); gpu.properties = properties() as THREE.WebGLRenderer['properties']; } };
}

test('the real ship explanation prepares the plaza only after its crowd loads and keeps future clothes hidden', async t => {
  const h = fixture(t); h.prepare(); assert.equal(h.batches.length,0); await h.assets(); for (let i = 0; i < 4; i++) h.prepare(); assert.ok(h.batches.length); assert.ok(!h.work.includes('bindings'));
  h.ready(); h.drain(); assert.ok(h.batches.flat().includes(h.skin)); assert.ok(h.batches.flat().some(object=>object instanceof THREE.InstancedMesh && object.name.includes('future-crowd')), 'prepare the loaded crowd, not only its temporary mannequins'); assert.ok(h.batches.flat().includes(h.coat), 'ordinary clothes hidden by the ship outfit must prepare without becoming visible'); assert.equal(h.work.filter(v => v === 'texture').length, 1); assert.ok(!h.batches.flat().includes(h.costume), 'unrelated hidden costumes stay out of the preparation');
  const late = new THREE.Group(), face = new THREE.Mesh(h.geometry, h.material); late.add(face); h.actors.set('morpheus', late);
  const before = h.batches.length; h.drain(); assert.ok(h.batches.slice(before).flat().includes(face)); assert.equal(h.decks.size, 1);
  const count = h.work.length; h.drain(); assert.equal(h.work.length, count, 'completed preparation stops compiling and uploading');
});

test('plaza preparation follows the real return explanation, rebuilds for a new GPU and releases cancellation resources', async t => {
  const h = fixture(t); h.journey.visiting = 'm1_jump_return'; h.prepare(); assert.equal(h.work.length, 0); delete h.journey.visiting; h.journey.training!.started = false; h.prepare(); assert.equal(h.work.length, 0); h.journey.training!.started = true; h.prepare(); await h.assets();
  h.ready(); h.drain(); const count = h.batches.length; h.replaceGpu(); h.drain(); assert.equal(h.batches.length, count * 2); assert.equal(h.decks.size, 1);
  const deck = [...h.decks][0], mesh = deck.getObjectByName('training-red-dress-set')!.getObjectByProperty('isMesh', true) as THREE.Mesh;
  let disposed = 0; mesh.geometry.addEventListener('dispose', () => disposed++);
  h.journey.scene = 'm1_truth_exit'; h.prepare(); assert.equal(disposed, 1); assert.equal(deck.parent, null);
});

test('entering the red-dress program takes the loaded plaza with the actual world transform and releases it once', async t => {
  const h = fixture(t); h.prepare(); await h.assets(); h.ready(); h.drain(); const deck = [...h.decks][0], room = deck.getObjectByName('training-red-dress-set')!;
  const mesh = room.getObjectByProperty('isMesh', true) as THREE.Mesh; let disposed = 0; mesh.geometry.addEventListener('dispose', () => disposed++);
  const world = new WorldState(); new AgentManager(world).initializeAllAgents(); const neo = world.agents.get('neo')!, center = FILM_SETS.film_red_dress_plaza.center;
  neo.position = { ...center }; neo.currentLocation = 'film_red_dress_plaza'; neo.isInMatrix = true;
  const journey = { ...h.journey, scene: 'm1_red_dress', actor: 'neo', step: 0, training: undefined } as FilmJourney;
  h.film.update(neo, { structures: [], neoLife: { journey } } as unknown as SandboxState, 0); h.film.root.updateMatrixWorld(true);
  assert.equal(h.film.root.getObjectByName('training-red-dress-set'), room); assert.equal(deck.parent, h.film.root);
  assert.deepEqual(deck.getWorldPosition(new THREE.Vector3()).toArray(), [center.x, center.y - 1, center.z]); assert.equal(disposed, 0);
  h.film.update(undefined, undefined, 0); assert.equal(disposed, 1); assert.equal(deck.parent, null);
});

test('the red-dress objective keeps its single light layout when the training freezes', t => {
  const h = fixture(t); Object.assign(h.film, { current: FILM_SETS.film_red_dress_plaza, currentScene: 'm1_red_dress' });
  const lighting = new LightCulling(h.scene); t.after(() => lighting.dispose()); const counts: number[] = [];
  const marker = (h.film as unknown as { markerLight: THREE.PointLight }).markerLight;
  const gpu = { compile: (_subject: THREE.Object3D, _eye: THREE.Camera, view: THREE.Scene) => {
    let slots = 0; view.traverseVisible(object => { if (object instanceof THREE.PointLight) slots++; }); counts.push(slots);
  } } as unknown as THREE.WebGLRenderer;
  assert.equal(h.film.minimumPointSlots, 1); lighting.minimumPointSlots = h.film.minimumPointSlots;
  for (const shown of [true, false, true]) { marker.visible = shown; marker.intensity = shown ? 5 : 0; lighting.compileSubject(gpu, new THREE.PerspectiveCamera(), h.film.root); }
  assert.deepEqual(counts, [1, 1, 1]);
});

test('cancelling a plaza before crowd decoding cannot attach it again when loading finishes', async t=>{
  const h=fixture(t);h.prepare();h.journey.scene='m1_truth_exit';h.prepare();await h.assets();h.drain();assert.equal(h.batches.length,0);assert.equal((h.film as unknown as {preparedRedDress?:unknown}).preparedRedDress,undefined);assert.equal(h.scene.getObjectByName('training-red-dress-set'),undefined);
});
