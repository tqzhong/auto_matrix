import assert from 'node:assert/strict';
import test, { type TestContext } from 'node:test';
import * as THREE from 'three';
import { FILM_SETS, type FilmJourney, type SandboxState } from '@auto_matrix/shared';
import { FilmSetRenderer } from '../packages/client/src/engine/FilmSetRenderer.js';
import { WorldState } from '../packages/server/src/world/WorldState.js';
import { AgentManager } from '../packages/server/src/agents/AgentManager.js';

function fixture(t: TestContext) {
  t.mock.method(THREE.TextureLoader.prototype, 'load', () => new THREE.Texture({ width: 1, complete: true }));
  const previousDocument = globalThis.document;
  globalThis.document = { createElement: () => ({ getContext: () => ({ fillRect() {}, strokeRect() {}, fillText() {},
    createImageData: (w: number, h: number) => ({ data: new Uint8ClampedArray(w * h * 4) }), putImageData() {},
    beginPath() {}, moveTo() {}, lineTo() {}, closePath() {}, stroke() {}, fill() {}, ellipse() {} }) }) } as unknown as Document;
  const scene = new THREE.Scene(), film = new FilmSetRenderer(scene), camera = new THREE.PerspectiveCamera();
  scene.environment = new THREE.Texture(); scene.fog = new THREE.FogExp2();
  const sun = new THREE.DirectionalLight(); sun.castShadow = true; scene.add(sun, new THREE.DirectionalLight(), new THREE.HemisphereLight());
  Object.assign(film, { current: FILM_SETS.film_oracle_home, currentScene: 'm1_oracle' });
  const journey = { scene: 'm1_oracle', actor: 'neo', step: 2, completed: [], oracle: { departure: { phase: 'bite_ready', elapsed: 0, rise: 3.8 } } } as FilmJourney;
  const parent = new THREE.Group(), actor = new THREE.Group(), geometry = new THREE.BoxGeometry(); parent.visible = false; parent.add(actor); scene.add(parent);
  const texture = new THREE.Texture({ width: 2048, height: 2048 }); texture.needsUpdate = true;
  const material = new THREE.MeshStandardMaterial({ map: texture }), skin = new THREE.SkinnedMesh(geometry, material); actor.add(skin); const matrixClothes = new THREE.SkinnedMesh(geometry, material); matrixClothes.visible = false; actor.add(matrixClothes);
  const shipClothes = new THREE.Mesh(geometry, material); shipClothes.userData.reloadedHidden = true; shipClothes.visible = false; actor.add(shipClothes);
  const actors = new Map([['neo', actor]]), work: string[] = [], batches: THREE.Object3D[][] = [], rooms = new Set<THREE.Object3D>();
  const uploads: THREE.Texture[] = [];
  const programs: { program: object; isReady(): boolean; getUniforms(): void }[] = [];
  let ready = false, target: THREE.WebGLRenderTarget | null = null, uploaded = new WeakMap<THREE.Texture, number>();
  const properties = () => ({ get: (map: THREE.Texture) => ({ __version: uploaded.get(map) }) });
  const gpu = { properties: properties(), info: { programs }, debug: { checkShaderErrors: true }, extensions: { has: () => true },
    getContext: () => ({ LINK_STATUS: 0x8b82, getProgramParameter: () => true }),
    getRenderTarget: () => target, setRenderTarget: (value: typeof target) => { target = value; },
    compile(subject: THREE.Object3D, eye: THREE.Camera, lights: THREE.Scene) {
      assert.notEqual(lights, scene); assert.equal(lights.environment, scene.environment); assert.equal(lights.fog, scene.fog); assert.equal(eye, camera); assert.equal(target?.width, 1);
      let slots = 0; lights.traverseVisible(object => { if (object instanceof THREE.PointLight) slots++; }); assert.equal(slots, 17);
      let spots = 0; lights.traverseVisible(object => { if (object instanceof THREE.SpotLight) spots++; }); assert.equal(spots, 1);
      let room: THREE.Object3D | undefined;
      lights.traverseVisible(object => { if (object instanceof THREE.Group && object.parent instanceof THREE.Scene && object.getObjectByName('mouse-room-door')) room = object; });
      assert.ok(room); rooms.add(room);
      assert.ok(!scene.children.includes(room), 'the future old building must stay offstage');
      let shadows=0; lights.traverseVisible(object=>{if(object instanceof THREE.DirectionalLight&&object.castShadow)shadows++;}); assert.equal(shadows,1);
      const batch: THREE.Object3D[] = []; subject.traverse(object => batch.push(object)); assert.ok(batch.length > 0 && batch.length <= 4);
      if (batch.includes(skin)) assert.match(material.customProgramCacheKey(), /actor-local-skin-v1$/);
      batches.push(batch); work.push('compile'); programs.push({ program: {}, isReady: () => ready, getUniforms: () => {
        assert.equal(gpu.debug.checkShaderErrors, false); work.push('bindings');
      } });
    },
    initTexture(map: THREE.Texture) { work.push('texture'); uploads.push(map); uploaded.set(map, map.version); },
  } as unknown as THREE.WebGLRenderer;
  const prepare = () => {
    const count = work.length; film.prepareAmbush(gpu, camera, journey, id => actors.get(id), id => actors.get(id));
    assert.ok(work.length - count <= 1, 'prepare one batch, completed binding or texture per frame');
    assert.equal(target, null); assert.equal(parent.visible, false); assert.equal(actor.parent, parent); assert.equal(skin.parent, actor); assert.equal(matrixClothes.visible,false); assert.equal(sun.castShadow,true); assert.equal(gpu.debug.checkShaderErrors, true);
  };
  const drain = () => { for (let i = 0; i < 1000; i++) prepare(); };
  t.after(() => { film.dispose(); geometry.dispose(); material.dispose(); texture.dispose(); scene.environment!.dispose(); globalThis.document = previousDocument; });
  return { film, gpu, scene, journey, actor, actors, geometry, material, skin, matrixClothes, shipClothes, texture, uploads, work, batches, rooms, prepare, drain,
    ready: () => { ready = true; }, replaceGpu: () => { uploaded = new WeakMap(); gpu.properties = properties() as THREE.WebGLRenderer['properties']; } };
}

test('the Oracle farewell prepares hidden old-building clothing and late companions without changing their current view', t => {
  const h = fixture(t); for (let i = 0; i < 120; i++) h.prepare(); assert.ok(h.batches.length); assert.ok(!h.work.includes('bindings'));
  h.ready(); h.drain(); assert.ok(h.batches.flat().includes(h.skin)); assert.ok(h.batches.flat().includes(h.matrixClothes)); assert.equal(h.uploads.filter(map => map === h.texture).length, 1); assert.equal(h.batches.flat().includes(h.shipClothes), false);
  const late = new THREE.Group(), coat = new THREE.Mesh(h.geometry, h.material); late.add(coat); coat.visible = false; h.actors.set('morpheus', late);
  const before = h.batches.length; h.drain(); assert.ok(h.batches.slice(before).flat().includes(coat)); assert.equal(h.rooms.size, 1);
  const count = h.work.length; h.drain(); assert.equal(h.work.length, count, 'finished preparation stops compiling and uploading');
});

test('old-building preparation rebinds a new GPU and releases canceled geometry once', t => {
  const h = fixture(t); h.ready(); h.drain(); const count = h.batches.length; h.replaceGpu(); h.drain(); assert.equal(h.batches.length, count * 2); assert.equal(h.rooms.size, 1);
  const room = [...h.rooms][0], mesh = room.getObjectByName('mouse-room-door')!.getObjectByProperty('isMesh', true) as THREE.Mesh;
  let disposed = 0; mesh.geometry.addEventListener('dispose', () => disposed++);
  h.journey.visiting = 'm1_oracle'; h.prepare(); assert.equal(disposed, 1); assert.equal(room.parent, null);
});

test('a decoded companion texture uploads before the long old-building mesh queue', t => {
  const h = fixture(t); h.ready();
  for (let i = 0; i < 1000 && !h.work.length; i++) h.prepare();
  assert.equal(h.work[0], 'texture', 'an immediate departure must not wait for all hidden meshes before preparing its decoded actor map');
  assert.equal(h.uploads[0], h.texture); h.drain(); assert.equal(h.uploads.filter(map => map === h.texture).length, 1);
});

test('the actual old-building handoff keeps the prepared door and releases its geometry once', t => {
  const h = fixture(t); h.ready(); h.drain(); const room = [...h.rooms][0], door = room.getObjectByName('mouse-room-door')!;
  const mesh = door.getObjectByProperty('isMesh', true) as THREE.Mesh; let disposed = 0; mesh.geometry.addEventListener('dispose', () => disposed++);
  const world = new WorldState(); new AgentManager(world).initializeAllAgents(); const neo = world.agents.get('neo')!, center = FILM_SETS.film_ambush_house.center;
  neo.position = { x: center.x - 5.5, y: center.y - 7.4, z: center.z + 32 }; neo.currentLocation = 'film_ambush_house'; neo.isInMatrix = true;
  const journey = { ...h.journey, scene: 'm1_dejavu', actor: 'neo', step: 0, completed: [] } as FilmJourney;
  h.film.update(neo, { structures: [], neoLife: { journey } } as unknown as SandboxState, 0); h.film.root.updateMatrixWorld(true);
  assert.equal(h.film.root.getObjectByName('mouse-room-door'), door); assert.equal(room.parent, h.film.root); assert.equal(disposed, 0);
  assert.deepEqual(h.film.root.getWorldPosition(new THREE.Vector3()).toArray(), [center.x, center.y - 1, center.z]);
  h.film.update(undefined, undefined, 0); assert.equal(disposed, 1); assert.equal(room.parent, null);
});

test('old-building preparation waits for the actual farewell and cancels when its scene is left', t => {
  const h = fixture(t);
  for (const phase of ['waiting', 'guiding', 'ready'] as const) { h.journey.oracle!.departure!.phase = phase; h.prepare(); assert.equal(h.batches.length, 0); }
  h.journey.oracle!.departure!.phase = 'talking'; h.ready(); h.drain(); const room = [...h.rooms][0]; assert.ok(room);
  h.journey.scene = 'm1_dejavu'; h.journey.visiting = 'm1_dejavu'; h.prepare(); assert.equal(room.parent, null);
});
