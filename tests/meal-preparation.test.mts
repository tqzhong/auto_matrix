import assert from 'node:assert/strict';
import test, { type TestContext } from 'node:test';
import * as THREE from 'three';
import { FILM_SETS, type FilmJourney, type SandboxState } from '@auto_matrix/shared';
import { FilmSetRenderer } from '../packages/client/src/engine/FilmSetRenderer.js';
import { WorldState } from '../packages/server/src/world/WorldState.js';
import { AgentManager } from '../packages/server/src/agents/AgentManager.js';

function fixture(t: TestContext) {
  t.mock.method(THREE.TextureLoader.prototype, 'load', () => new THREE.Texture());
  const previousDocument = globalThis.document;
  globalThis.document = { createElement: () => ({ getContext: () => ({ fillRect() {}, strokeRect() {}, fillText() {},
    createImageData: (w: number, h: number) => ({ data: new Uint8ClampedArray(w * h * 4) }), putImageData() {},
    beginPath() {}, moveTo() {}, lineTo() {}, stroke() {} }) }) } as unknown as Document;
  const scene = new THREE.Scene(), film = new FilmSetRenderer(scene), camera = new THREE.PerspectiveCamera();
  scene.environment = new THREE.Texture(); scene.fog = new THREE.FogExp2();
  const sun = new THREE.DirectionalLight(); sun.castShadow = true; scene.add(sun, new THREE.DirectionalLight(), new THREE.HemisphereLight());
  Object.assign(film, { current: FILM_SETS.film_cypher_restaurant, currentScene: 'm1_steak' });
  const journey = { scene: 'm1_steak', interlude: { kind: 'steak', phase: 'performing', elapsed: 15.7, physicalSteak: true } } as FilmJourney;
  const parent = new THREE.Group(), actor = new THREE.Group(), geometry = new THREE.BoxGeometry(); parent.visible = false; parent.add(actor); scene.add(parent);
  const texture = new THREE.Texture({ width: 2048, height: 2048 }); texture.needsUpdate = true;
  const material = new THREE.MeshStandardMaterial({ map: texture }), skin = new THREE.SkinnedMesh(geometry, material); actor.add(skin); const sweater = new THREE.SkinnedMesh(geometry, material); sweater.userData.logosCostume = true; sweater.visible = false; actor.add(sweater);
  const actors = new Map([['neo', actor]]), work: string[] = [], batches: THREE.Object3D[][] = [], decks = new Set<THREE.Object3D>();
  const programs: { program: object; isReady(): boolean; getUniforms(): void }[] = [];
  let ready = false, target: THREE.WebGLRenderTarget | null = null, uploaded = new WeakMap<THREE.Texture, number>();
  const properties = () => ({ get: (map: THREE.Texture) => ({ __version: uploaded.get(map) }) });
  const gpu = { properties: properties(), info: { programs }, debug: { checkShaderErrors: true }, extensions: { has: () => true },
    getContext: () => ({ LINK_STATUS: 0x8b82, getProgramParameter: () => true }),
    getRenderTarget: () => target, setRenderTarget: (value: typeof target) => { target = value; },
    compile(subject: THREE.Object3D, eye: THREE.Camera, lights: THREE.Scene) {
      assert.notEqual(lights, scene); assert.equal(lights.environment, scene.environment); assert.equal(lights.fog, scene.fog); assert.equal(eye, camera); assert.equal(target?.width, 1);
      let slots = 0; lights.traverseVisible(object => { if (object instanceof THREE.PointLight) slots++; }); assert.equal(slots, 17);
      let deck: THREE.Object3D | undefined;
      lights.traverseVisible(object => { if (object instanceof THREE.Group && object.parent instanceof THREE.Scene && object.getObjectByName('neb-crew-meal-scene')) deck = object; });
      assert.ok(deck); decks.add(deck);
      assert.ok(!scene.children.includes(deck), 'the future ship must stay offstage');
      let shadows=0; lights.traverseVisible(object=>{if(object instanceof THREE.DirectionalLight&&object.castShadow)shadows++;}); assert.equal(shadows,1);
      const batch: THREE.Object3D[] = []; subject.traverse(object => batch.push(object)); assert.ok(batch.length > 0 && batch.length <= 4);
      if (batch.includes(skin)) assert.match(material.customProgramCacheKey(), /actor-local-skin-v1$/);
      batches.push(batch); work.push('compile'); programs.push({ program: {}, isReady: () => ready, getUniforms: () => {
        assert.equal(gpu.debug.checkShaderErrors, false); work.push('bindings');
      } });
    },
    initTexture(map: THREE.Texture) { work.push('texture'); uploaded.set(map, map.version); },
  } as unknown as THREE.WebGLRenderer;
  const prepare = () => {
    const count = work.length; film.prepareMeal(gpu, camera, journey, id => actors.get(id), sun);
    assert.ok(work.length - count <= 1, 'prepare one batch, completed binding or texture per frame');
    assert.equal(target, null); assert.equal(parent.visible, false); assert.equal(actor.parent, parent); assert.equal(skin.parent, actor); assert.equal(sweater.visible,false); assert.equal(sun.castShadow,true); assert.equal(gpu.debug.checkShaderErrors, true);
  };
  const drain = () => { for (let i = 0; i < 450; i++) prepare(); };
  t.after(() => { film.dispose(); geometry.dispose(); material.dispose(); texture.dispose(); scene.environment!.dispose(); globalThis.document = previousDocument; });
  return { film, gpu, scene, journey, actor, actors, geometry, material, skin, sweater, work, batches, decks, prepare, drain,
    ready: () => { ready = true; }, replaceGpu: () => { uploaded = new WeakMap(); gpu.properties = properties() as THREE.WebGLRenderer['properties']; } };
}

test('the ongoing bargain prepares the meal deck, hidden ship clothes and late diners in bounded batches', t => {
  const h = fixture(t); for (let i = 0; i < 4; i++) h.prepare(); assert.ok(h.batches.length); assert.ok(!h.work.includes('bindings'));
  h.ready(); h.drain(); assert.ok(h.batches.flat().includes(h.skin)); assert.ok(h.batches.flat().includes(h.sweater)); assert.equal(h.work.filter(v => v === 'texture').length, 1);
  const late = new THREE.Group(), face = new THREE.Mesh(h.geometry, h.material); late.add(face); face.visible = false; face.userData.hammerBriefingCostume = true; h.actors.set('tank', late);
  const before = h.batches.length; h.drain(); assert.ok(h.batches.slice(before).flat().includes(face)); assert.equal(h.decks.size, 1);
  for (const id of ['apoc', 'switch', 'mouse', 'dozer']) {
    const group = new THREE.Group(), crew = new THREE.Mesh(h.geometry, h.material); group.add(crew); h.actors.set(id, group);
    const start = h.batches.length; h.drain(); assert.ok(h.batches.slice(start).flat().includes(crew), `${id} is visible around the meal table`);
  }
  const count = h.work.length; h.drain(); assert.equal(h.work.length, count, 'completed preparation stops compiling and uploading');
});

test('meal preparation rebuilds GPU bindings and releases cancellation resources', t => {
  const h = fixture(t); h.journey.visiting = 'm1_steak'; h.prepare(); assert.equal(h.work.length, 0); delete h.journey.visiting;
  h.ready(); h.drain(); const count = h.batches.length; h.replaceGpu(); h.drain(); assert.equal(h.batches.length, count * 2); assert.equal(h.decks.size, 1);
  const deck = [...h.decks][0], mesh = deck.getObjectByName('neb-crew-meal-scene')!.getObjectByProperty('isMesh', true) as THREE.Mesh;
  let disposed = 0; mesh.geometry.addEventListener('dispose', () => disposed++);
  h.journey.scene = 'm1_construct'; h.prepare(); assert.equal(disposed, 1); assert.equal(deck.parent, null);
});

test('entering the meal adopts the same ready deck and leaving releases it once', t => {
  const h = fixture(t); h.ready(); h.drain(); const deck = [...h.decks][0], chair = deck.getObjectByName('neb-crew-meal-scene')!;
  assert.equal(deck.getObjectByName('neb-crew-meal-scene')!.visible, true);
  for (const name of ['neb-neo-protein-bowl', 'neb-neo-spoon', 'neb-meal-table-runner', 'neb-meal-pendant-light']) assert.ok(deck.getObjectByName(name));
  const mesh = chair.getObjectByProperty('isMesh', true) as THREE.Mesh; let disposed = 0; mesh.geometry.addEventListener('dispose', () => disposed++);
  const world = new WorldState(); new AgentManager(world).initializeAllAgents(); const neo = world.agents.get('neo')!, center = FILM_SETS.film_neb_deck.center;
  neo.position = { ...center }; neo.currentLocation = 'film_neb_deck'; neo.isInMatrix = false;
  const journey = { ...h.journey, scene: 'm1_meal', actor: 'neo', interlude: { kind: 'meal', phase: 'ready', elapsed: 0 } } as FilmJourney;
  h.film.update(neo, { structures: [], neoLife: { journey } } as unknown as SandboxState, 0); h.film.root.updateMatrixWorld(true);
  assert.equal(h.film.root.getObjectByName('neb-crew-meal-scene'), chair); assert.equal(deck.parent, h.film.root);
  assert.deepEqual(deck.getWorldPosition(new THREE.Vector3()).toArray(), [center.x, center.y - 1, center.z]); assert.equal(disposed, 0);
  h.film.update(undefined, undefined, 0); assert.equal(disposed, 1); assert.equal(deck.parent, null);
});


test('meal preparation waits for the wine portion of the real bargain and supports the legacy clock', t => {
  const h = fixture(t); h.journey.interlude!.phase = 'ready'; h.prepare(); assert.equal(h.work.length, 0);
  h.journey.interlude!.phase = 'performing'; h.journey.interlude!.elapsed = 8; h.prepare(); assert.equal(h.work.length, 0);
  h.journey.interlude!.elapsed = 15.7; h.ready(); h.drain(); const deck = [...h.decks][0]; assert.ok(deck);
  h.journey.interlude!.phase = 'ready'; h.prepare(); assert.equal(deck.parent, null);
  h.journey.interlude = { kind: 'steak', phase: 'performing', elapsed: 8 }; h.prepare(); assert.ok(h.decks.size > 1);
  h.journey.interlude!.phase = 'done'; h.prepare();
});
