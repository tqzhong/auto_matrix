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
  Object.assign(film, { current: FILM_SETS.film_neb_deck, currentScene: 'm1_cypher_console' });
  const journey = { scene: 'm1_cypher_console', interlude: { kind: 'console', phase: 'responding', elapsed: 4.5, physicalConsole: true, physicalPour: true } } as FilmJourney;
  const parent = new THREE.Group(), actor = new THREE.Group(), geometry = new THREE.BoxGeometry(); parent.visible = false; parent.add(actor); scene.add(parent);
  const texture = new THREE.Texture({ width: 2048, height: 2048 }); texture.needsUpdate = true;
  const material = new THREE.MeshStandardMaterial({ map: texture }), skin = new THREE.SkinnedMesh(geometry, material); actor.add(skin); const matrixClothes = new THREE.SkinnedMesh(geometry, material); matrixClothes.visible = false; actor.add(matrixClothes);
  const shipClothes = new THREE.Mesh(geometry, material); shipClothes.userData.reloadedHidden = true; shipClothes.visible = false; actor.add(shipClothes);
  const actors = new Map([['smith', actor]]), work: string[] = [], batches: THREE.Object3D[][] = [], rooms = new Set<THREE.Object3D>();
  const programs: { program: object; isReady(): boolean; getUniforms(): void }[] = [];
  let ready = false, target: THREE.WebGLRenderTarget | null = null, uploaded = new WeakMap<THREE.Texture, number>();
  const properties = () => ({ get: (map: THREE.Texture) => ({ __version: uploaded.get(map) }) });
  const gpu = { properties: properties(), info: { programs }, debug: { checkShaderErrors: true }, extensions: { has: () => true },
    getContext: () => ({ LINK_STATUS: 0x8b82, getProgramParameter: () => true }),
    getRenderTarget: () => target, setRenderTarget: (value: typeof target) => { target = value; },
    compile(subject: THREE.Object3D, eye: THREE.Camera, lights: THREE.Scene) {
      assert.notEqual(lights, scene); assert.equal(lights.environment, scene.environment); assert.equal(lights.fog, scene.fog); assert.equal(eye, camera); assert.equal(target?.width, 1);
      let slots = 0; lights.traverseVisible(object => { if (object instanceof THREE.PointLight) slots++; }); assert.equal(slots, 7);
      let spots = 0; lights.traverseVisible(object => { if (object instanceof THREE.SpotLight) spots++; }); assert.equal(spots, 1);
      let room: THREE.Object3D | undefined;
      lights.traverseVisible(object => { if (object instanceof THREE.Group && object.parent instanceof THREE.Scene && object.getObjectByName('cypher-window-table')) room = object; });
      assert.ok(room); rooms.add(room);
      assert.ok(!scene.children.includes(room), 'the future restaurant must stay offstage');
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
    const count = work.length; film.prepareRestaurant(gpu, camera, journey, id => actors.get(id), sun);
    const frame = work.slice(count);
    assert.ok(frame.filter(item => item === 'compile' || item === 'bindings').length <= 1);
    assert.ok(frame.filter(item => item === 'texture').length <= 1 && frame.filter(item => item === 'strip').length <= 4);
    assert.equal(target, null); assert.equal(parent.visible, false); assert.equal(actor.parent, parent); assert.equal(skin.parent, actor); assert.equal(matrixClothes.visible,false); assert.equal(sun.castShadow,true); assert.equal(gpu.debug.checkShaderErrors, true);
  };
  const drain = () => { for (let i = 0; i < 450; i++) prepare(); };
  t.after(() => { film.dispose(); geometry.dispose(); material.dispose(); texture.dispose(); scene.environment!.dispose(); globalThis.document = previousDocument; });
  return { film, gpu, scene, journey, actor, actors, geometry, material, skin, matrixClothes, shipClothes, texture, work, batches, rooms, prepare, drain,
    ready: () => { ready = true; }, replaceGpu: () => { uploaded = new WeakMap(); gpu.properties = properties() as THREE.WebGLRenderer['properties']; } };
}

test('the actual response prepares the existing restaurant, hidden Matrix clothes and late actors in bounded batches', t => {
  const h = fixture(t); for (let i = 0; i < 4; i++) h.prepare(); assert.ok(h.batches.length); assert.ok(!h.work.includes('bindings'));
  h.ready(); h.drain(); assert.ok(h.batches.flat().includes(h.skin)); assert.ok(h.batches.flat().includes(h.matrixClothes)); assert.equal(h.work.filter(v => v === 'texture').length, 1); assert.equal(h.batches.flat().includes(h.shipClothes), false);
  const late = new THREE.Group(), face = new THREE.Mesh(h.geometry, h.material); late.add(face); face.visible = false; h.actors.set('cypher', late);
  const before = h.batches.length; h.drain(); assert.ok(h.batches.slice(before).flat().includes(face)); assert.equal(h.rooms.size, 1);
  const count = h.work.length; h.drain(); assert.equal(h.work.length, count, 'completed preparation stops compiling and uploading');
});

test('decoded restaurant actor maps start during shader linking and release partial work on cancellation', t => {
  const h = fixture(t);
  class Bitmap { width = 2048; height = 2048; }
  const previous = globalThis.ImageBitmap, bitmap = new Bitmap();
  globalThis.ImageBitmap = Bitmap as unknown as typeof ImageBitmap;
  t.after(() => { if (previous) globalThis.ImageBitmap = previous; else Reflect.deleteProperty(globalThis, 'ImageBitmap'); });
  h.texture.image = bitmap; h.texture.flipY = false;
  const source = h.texture.source, rows: number[] = [], released: THREE.Texture[] = [];
  const residency = new WeakMap<THREE.Texture, { __webglTexture: object; __version: number }>();
  Object.assign(h.gpu, {
    capabilities: { maxTextureSize: 4096 }, properties: { get: (map: THREE.Texture) => residency.get(map) ?? {} },
    state: { bindTexture() {}, unbindTexture() {} },
    getContext: () => ({ LINK_STATUS: 0x8b82, getProgramParameter: () => true, pixelStorei() {},
      texSubImage2D(_target: number, _level: number, _x: number, row: number, width: number, height: number,
        _format: number, _type: number, image: Bitmap) {
        assert.equal(image, bitmap); assert.deepEqual([width, height], [2048, 256]); rows.push(row); h.work.push('strip');
      } }),
    initTexture(map: THREE.Texture) {
      residency.set(map, { __webglTexture: {}, __version: map.version });
      map.addEventListener('dispose', () => released.push(map));
      if (map.source.dataReady) h.work.push('texture');
    },
  });
  h.prepare();
  assert.deepEqual(h.work, ['compile', 'strip', 'strip', 'strip', 'strip'], 'stage the restaurant map while the first program is still linking');
  assert.deepEqual(rows, [0, 256, 512, 768]);
  assert.equal(residency.has(h.texture), false);
  h.journey.interlude!.phase = 'choice'; h.prepare();
  assert.equal(released.length, 1); assert.notEqual(released[0], h.texture); assert.equal(h.texture.source, source);
});

test('restaurant preparation rebuilds GPU bindings and releases cancellation resources', t => {
  const h = fixture(t); h.journey.visiting = 'm1_cypher_console'; h.prepare(); assert.equal(h.work.length, 0); delete h.journey.visiting;
  h.ready(); h.drain(); const count = h.batches.length; h.replaceGpu(); h.drain(); assert.equal(h.batches.length, count * 2); assert.equal(h.rooms.size, 1);
  const room = [...h.rooms][0], mesh = room.getObjectByName('cypher-window-table')!.getObjectByProperty('isMesh', true) as THREE.Mesh;
  let disposed = 0; mesh.geometry.addEventListener('dispose', () => disposed++);
  h.journey.scene = 'm1_construct'; h.prepare(); assert.equal(disposed, 1); assert.equal(room.parent, null);
});

test('entering the restaurant adopts the same room and leaving releases it once', t => {
  const h = fixture(t); h.ready(); h.drain(); const room = [...h.rooms][0], chair = room.getObjectByName('cypher-window-table')!;
  for (const name of ['cypher-restaurant-city-matte', 'cypher-steak', 'cypher-steak-fork', 'cypher-wine-glass']) assert.ok(room.getObjectByName(name));
  const mesh = chair.getObjectByProperty('isMesh', true) as THREE.Mesh; let disposed = 0; mesh.geometry.addEventListener('dispose', () => disposed++);
  const world = new WorldState(); new AgentManager(world).initializeAllAgents(); const smith = world.agents.get('smith')!, center = FILM_SETS.film_cypher_restaurant.center;
  smith.position = { ...center }; smith.currentLocation = 'film_cypher_restaurant'; smith.isInMatrix = true;
  const journey = { ...h.journey, scene: 'm1_steak', actor: 'smith', interlude: { kind: 'steak', phase: 'ready', elapsed: 0 } } as FilmJourney;
  h.film.update(smith, { structures: [], neoLife: { journey } } as unknown as SandboxState, 0); h.film.root.updateMatrixWorld(true);
  assert.equal(h.film.root.getObjectByName('cypher-window-table'), chair); assert.equal(room.parent, h.film.root);
  assert.deepEqual(room.getWorldPosition(new THREE.Vector3()).toArray(), [center.x, center.y - 1, center.z]); assert.equal(disposed, 0);
  h.film.update(undefined, undefined, 0); assert.equal(disposed, 1); assert.equal(room.parent, null);
});


test('restaurant preparation waits for an explicit response and cancels when the player returns to the choice', t => {
  const h = fixture(t);
  for (const phase of ['ready', 'performing', 'accept_ready', 'accepting', 'sip_ready', 'sipping', 'returning', 'choice'] as const) {
    h.journey.interlude!.phase = phase; h.prepare(); assert.equal(h.work.length, 0);
  }
  h.journey.interlude!.phase = 'responding'; h.ready(); h.drain(); const room = [...h.rooms][0]; assert.ok(room);
  h.journey.interlude!.phase = 'choice'; h.prepare(); assert.equal(room.parent, null);
  h.journey.interlude!.phase = 'done'; h.prepare(); assert.ok(h.rooms.size > 1);
});
