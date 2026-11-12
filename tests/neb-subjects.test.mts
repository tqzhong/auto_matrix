import assert from 'node:assert/strict';
import test, { type TestContext } from 'node:test';
import * as THREE from 'three';
import { FILM_SETS, type FilmJourney, type SandboxState } from '@auto_matrix/shared';
import { FilmSetRenderer } from '../packages/client/src/engine/FilmSetRenderer.js';
import { LightCulling } from '../packages/client/src/engine/LightCulling.js';
import { WorldState } from '../packages/server/src/world/WorldState.js';
import { AgentManager } from '../packages/server/src/agents/AgentManager.js';

function fixture(t: TestContext) {
  t.mock.method(THREE.TextureLoader.prototype, 'load', () => new THREE.Texture());
  const previous = globalThis.document;
  globalThis.document = { createElement: () => ({ getContext: () => ({ fillRect() {}, strokeRect() {}, fillText() {},
    createImageData: (w: number, h: number) => ({ data: new Uint8ClampedArray(w * h * 4) }), putImageData() {},
    beginPath() {}, moveTo() {}, lineTo() {}, stroke() {} }) }) } as unknown as Document;
  const world = new WorldState(); new AgentManager(world).initializeAllAgents();
  const renderer = new FilmSetRenderer(new THREE.Scene()), center = FILM_SETS.film_neb_deck.center;
  const avatars = new Map<string, THREE.Group>(), physical = new Map<string, THREE.Group>();
  const liveCalls: string[] = [], physicalCalls: string[] = [];
  for (const [index, role] of ['neo', 'trinity', 'apoc', 'switch', 'cypher', 'link'].entries()) {
    for (const [bodies, x] of [[avatars, 4], [physical, -4]] as const) {
      const body = new THREE.Group(); body.name = `${x > 0 ? 'avatar' : 'body'}:${role}`;
      body.position.set(center.x + x, center.y - 1, center.z + index);
      const socket = new THREE.Object3D(); socket.name = 'cervical-interface'; socket.position.y = 3; body.add(socket); bodies.set(role, body);
    }
  }
  renderer.setRecoverySubject(avatars.get('neo'));
  renderer.setCrosscutSubjects(id => { physicalCalls.push(id); return physical.get(id); }, id => { liveCalls.push(id); return avatars.get(id); });
  t.after(() => { renderer.dispose(); globalThis.document = previous; });
  const draw = (scene: string, detail: Partial<FilmJourney> = {}, actor = 'neo') => {
    const player = world.agents.get(actor)!;
    player.position = { ...center }; player.isInMatrix = false; player.currentLocation = 'film_neb_deck';
    const journey: FilmJourney = { version: 1, scene, actor, step: 0, completed: [], enteredAt: 0, checkpoint: player.position,
      reflections: {}, lastText: '', ...detail };
    liveCalls.length = physicalCalls.length = 0;
    renderer.update(player, { structures: [], neoLife: { journey } } as unknown as SandboxState, 0);
    renderer.root.updateMatrixWorld(true);
  };
  return { renderer, avatars, physical, liveCalls, physicalCalls, draw };
}

test('revisiting the meal uses Neo’s live prop owner even when an old connected body remains cached', t => {
  const h = fixture(t), neo = h.avatars.get('neo')!; h.physical.get('neo')!.visible = false;
  for (const name of ['meal-held-bowl', 'meal-held-spoon']) { const held = new THREE.Group(); held.name = name; neo.add(held); }
  h.draw('m1_meal', { interlude: { kind: 'meal', phase: 'accepting', elapsed: 3, physicalMeal: true } });
  assert.equal(h.renderer.root.getObjectByName('neb-neo-protein-bowl')!.visible, false, 'the live held bowl must suppress the table copy');
  assert.equal(h.renderer.root.getObjectByName('neb-neo-spoon')!.visible, false, 'a stale crosscut body cannot create a second spoon');
  assert.ok(h.liveCalls.includes('neo')); assert.equal(h.physicalCalls.length, 0);
});

test('the console stream follows Cypher’s live jug rather than the connected-body provider', t => {
  const h = fixture(t), cypher = h.avatars.get('cypher')!, jug = new THREE.Group(), spout = new THREE.Object3D();
  jug.name = 'cypher-held-jug'; spout.name = 'console-jug-spout'; spout.position.set(.2, 3, .1); jug.add(spout); cypher.add(jug);
  h.draw('m1_cypher_console', { interlude: { kind: 'console', phase: 'performing', elapsed: 6, physicalConsole: true, physicalPour: true } });
  const stream = h.renderer.root.getObjectByName('neb-cypher-pouring-stream')!;
  assert.equal(stream.visible, true, 'the pouring stream needs the spout attached to the visible Cypher');
  const cup = h.renderer.root.getObjectByName('neb-neo-metal-mug')!.getObjectByName('console-mug-liquid')!;
  const midpoint = spout.getWorldPosition(new THREE.Vector3()).add(cup.getWorldPosition(new THREE.Vector3())).multiplyScalar(.5);
  assert.ok(stream.getWorldPosition(new THREE.Vector3()).distanceTo(midpoint) < 1e-6);
  assert.ok(h.liveCalls.includes('cypher')); assert.equal(h.physicalCalls.length, 0);
});

for (const scene of ['m1_tv_exit', 'm1_unplugged']) test(`${scene} keeps cervical jacks attached to the connected ship bodies`, t => {
  const h = fixture(t);
  h.draw(scene, { tvExit: { phase: 'ready', elapsed: 0, crosscut: { phase: 'call', elapsed: 6, view: 'ship', attempts: 0, tankHealth: 100,
    tankHit: false, dozerDead: false, apocDead: false, switchDead: false, cypherDead: false, trinityOut: false, neoOut: false } } });
  for (const role of ['neo', 'trinity', 'apoc', 'switch']) {
    const jack = h.renderer.root.getObjectByName(`neb-betrayal-jack-${role}`)!;
    const socket = h.physical.get(role)!.getObjectByName('cervical-interface')!;
    assert.equal(jack.visible, true);
    assert.ok(jack.getWorldPosition(new THREE.Vector3()).distanceTo(socket.getWorldPosition(new THREE.Vector3())) < 1e-6,
      `${role}'s cable must stay on the real-world body during the crosscut`);
  }
  assert.ok(h.physicalCalls.includes('neo')); assert.equal(h.liveCalls.length, 0);
});

test('the later Trinity relay still uses her live socket and Link’s live hand provider', t => {
  const h = fixture(t); h.draw('m2_relay', { trinityRelay: { phase: 'connecting', elapsed: 15.8 } }, 'trinity');
  const plug = h.renderer.root.getObjectByName('neb-first-core-connector')!;
  const socket = h.avatars.get('trinity')!.getObjectByName('cervical-interface')!.getWorldPosition(new THREE.Vector3()); socket.x -= .25;
  assert.equal(plug.visible, true); assert.ok(plug.getWorldPosition(new THREE.Vector3()).distanceTo(socket) < 1e-6);
  assert.ok(h.liveCalls.includes('trinity') && h.liveCalls.includes('link')); assert.equal(h.physicalCalls.length, 0);
});

test('the bedside answer reuses the physical deck and resets its props for training', t => {
  const h = fixture(t); h.draw('m1_truth_return', { truthRecovery: { phase: 'rest', elapsed: 6.6 } });
  const names = ['neb-cabin-door', 'neb-core-chair-neo', 'neb-training-disk', 'neb-truth-bedside-stool'];
  const before = names.map(name => h.renderer.root.getObjectByName(name)!);
  assert.equal(before[3].visible, true);
  h.draw('m1_download', { training: { kind: 'download', elapsed: 0, started: false } });
  assert.ok(names.every((name, index) => h.renderer.root.getObjectByName(name) === before[index]), 'answering must not destroy and rebuild the same ship');
  assert.equal(before[3].visible, false, 'the bedside stool leaves with the conversation');
  assert.equal(before[2].parent!.visible, true, 'the existing download rig becomes available');
  h.draw('m1_meal'); assert.notEqual(h.renderer.root.getObjectByName(names[0]), before[0], 'unrelated scene lifecycles stay unchanged');
});

test('truth return and the download keep seventeen light slots across the core and cabin views', t => {
  const h = fixture(t), scene = h.renderer.root.parent as THREE.Scene, lighting = new LightCulling(scene);
  t.after(() => lighting.dispose()); const camera = new THREE.PerspectiveCamera(65, 16 / 9, .1, 200), counts: number[] = [];
  const gpu = { compile: (_root: THREE.Object3D, _camera: THREE.Camera, view: THREE.Scene) => {
    let count = 0; view.traverseVisible(object => { if (object instanceof THREE.PointLight) count++; }); counts.push(count);
  } } as unknown as THREE.WebGLRenderer;
  for (const phase of ['unplug', 'rest', 'question', 'walk', 'download']) {
    h.draw(phase === 'download' || phase === 'walk' ? 'm1_download' : 'm1_truth_return', phase === 'download' || phase === 'walk'
      ? { training: { kind: 'download', elapsed: phase === 'walk' ? 0 : 3, started: phase !== 'walk' },
        downloadSetup: { phase: phase === 'walk' ? 'walk' : 'ready', elapsed: 0, progress: 0 } }
      : { truthRecovery: { phase: phase as 'unplug' | 'rest' | 'question', elapsed: 6.6 } });
    assert.equal(h.renderer.minimumPointSlots, 17);
    lighting.minimumPointSlots = h.renderer.minimumPointSlots;
    for (const z of [-5, -34]) {
      const center = FILM_SETS.film_neb_deck.center;
      camera.position.set(center.x + 8, center.y + 7, center.z + z + 7); camera.lookAt(center.x + 6, center.y + 2, center.z + z);
      lighting.compileSubject(gpu, camera, h.renderer.root);
    }
  }
  assert.deepEqual(counts, Array(10).fill(17), 'moving between rooms must reuse the colour layout');
  h.draw('m1_meal'); assert.equal(h.renderer.minimumPointSlots, 0, 'other ship chapters keep their existing light policies');
});

test('the training wake prepares the crew and curtain before the corridor view in bounded batches', t => {
  const h = fixture(t), scene = h.renderer.root.parent as THREE.Scene;
  const journey = { scene: 'm1_download', downloadSetup: { phase: 'waking', elapsed: 6.2, progress: 0 } } as FilmJourney;
  h.draw(journey.scene, journey);
  const curtain = h.renderer.root.getObjectByName('neb-medical-curtain')!;
  const geometry = new THREE.BoxGeometry(), map = new THREE.Texture({ width: 2048, height: 2048 }); map.needsUpdate = true;
  const material = new THREE.MeshStandardMaterial({ map });
  const crew = new Map<string, THREE.Group>(), morpheus = new THREE.Group(); crew.set('morpheus', morpheus);
  morpheus.visible = false; scene.add(morpheus);
  const surfaces = ['Anatomical_head_and_hands', 'morpheus-hammer-sweater', 'morpheus-hammer-collar', 'high-poly', 'shoes01', 'Tailored_trousers']
    .map(name => { const mesh = new THREE.SkinnedMesh(geometry, material); mesh.name = name; morpheus.add(mesh); return mesh; });
  const unneeded = new THREE.Mesh(geometry, material); morpheus.add(unneeded);
  const lighting = new LightCulling(scene), camera = new THREE.PerspectiveCamera(); lighting.minimumPointSlots = h.renderer.minimumPointSlots;
  t.after(() => { lighting.dispose(); geometry.dispose(); material.dispose(); map.dispose(); });
  const work: string[] = [], linked: THREE.Object3D[] = [];
  const programs: { program: object; isReady(): boolean; getUniforms(): void }[] = [];
  let target: THREE.WebGLRenderTarget | null = null, version: number | undefined;
  const gpu = {
    info: { programs }, extensions: { has: () => true }, properties: { get: () => ({ __version: version }) }, debug: { checkShaderErrors: true },
    getContext: () => ({ LINK_STATUS: 0x8b82, getProgramParameter: () => true }),
    getRenderTarget: () => target, setRenderTarget: (value: typeof target) => { target = value; },
    compile(subject: THREE.Group, eye: THREE.Camera, lights: THREE.Scene) {
      assert.equal(eye, camera); assert.notEqual(lights, scene); assert.equal(lights.environment, scene.environment); assert.equal(lights.fog, scene.fog);
      assert.equal(target?.width, 1);
      let points = 0; lights.traverseVisible(object => { if (object instanceof THREE.PointLight) points++; }); assert.equal(points, 17);
      const batch: THREE.Object3D[] = []; subject.traverse(object => batch.push(object));
      assert.ok(batch.length > 0 && batch.length <= 4); linked.push(...batch); work.push('compile');
      programs.push({ program: {}, isReady: () => true, getUniforms: () => { assert.equal(gpu.debug.checkShaderErrors, false); work.push('bindings'); } });
    },
    initTexture(texture: THREE.Texture) { assert.equal(texture, map); version = texture.version; work.push('texture'); },
  } as unknown as THREE.WebGLRenderer;
  const prepare = () => {
    const count = work.length; h.renderer.prepareDownloadWalk(gpu, camera, lighting, journey, id => crew.get(id));
    assert.ok(work.length - count <= 1); assert.equal(target, null); assert.equal(morpheus.visible, false);
    assert.equal(surfaces[1].parent, morpheus); assert.equal(gpu.debug.checkShaderErrors, true);
  };
  journey.visiting = 'm1_download'; prepare(); assert.deepEqual(work, []); delete journey.visiting;
  for (let i = 0; i < 16; i++) prepare();
  for (const mesh of [curtain, ...surfaces]) assert.ok(linked.includes(mesh), 'prepare the actual surface before it enters the view');
  assert.ok(!linked.includes(unneeded)); assert.equal(work.filter(op => op === 'texture').length, 1);
  const apoc = new THREE.Group(), groom = new THREE.SkinnedMesh(geometry, material); groom.name = 'Swept_individual_hair_strands';
  apoc.add(groom); crew.set('apoc', apoc);
  for (let i = 0; i < 16; i++) prepare(); assert.ok(linked.includes(groom), 'prepare actors that load during the wake');
  const count = work.length; for (let i = 0; i < 16; i++) prepare(); assert.equal(work.length, count);
  const beforeReset = linked.length; version = undefined;
  gpu.properties = { get: () => ({ __version: version }) } as unknown as THREE.WebGLRenderer['properties'];
  for (let i = 0; i < 16; i++) prepare(); assert.ok(linked.slice(beforeReset).includes(curtain));
  assert.equal(work.filter(op => op === 'texture').length, 2);
  const afterReset = work.length; journey.downloadSetup!.phase = 'walk'; prepare(); assert.equal(work.length, afterReset);

  class Bitmap { width = 2048; height = 2048; }
  const previousBitmap = globalThis.ImageBitmap, bitmap = new Bitmap();
  globalThis.ImageBitmap = Bitmap as unknown as typeof ImageBitmap;
  t.after(() => { if (previousBitmap) globalThis.ImageBitmap = previousBitmap; else Reflect.deleteProperty(globalThis, 'ImageBitmap'); });
  map.image = bitmap; map.flipY = false; map.needsUpdate = true;
  const strips: number[] = [], allocations: THREE.Texture[] = [], released: THREE.Texture[] = [];
  const residency = new WeakMap<THREE.Texture, { __webglTexture: object; __version: number }>();
  Object.assign(gpu, {
    properties: { get: (texture: THREE.Texture) => residency.get(texture) ?? {} }, capabilities: { maxTextureSize: 4096 },
    state: { bindTexture() {}, unbindTexture() {} },
    getContext: () => ({ LINK_STATUS: 0x8b82, getProgramParameter: () => true, pixelStorei() {},
      texSubImage2D(_target: number, _level: number, _x: number, row: number, width: number, height: number,
        _format: number, _type: number, image: Bitmap) {
        assert.equal(image, bitmap); assert.deepEqual([row, width, height], [0, 2048, 256]); strips.push(height); work.push('strip');
      } }),
    initTexture(texture: THREE.Texture) {
      residency.set(texture, { __webglTexture: {}, __version: texture.version });
      allocations.push(texture); texture.addEventListener('dispose', () => released.push(texture));
      if (texture.source.dataReady) work.push('texture');
    },
  });
  journey.downloadSetup!.phase = 'waking';
  for (let i = 0; i < 16 && !allocations.length; i++) prepare();
  assert.deepEqual(strips, [256], 'upload one strip of the large crew texture before drawing it');
  assert.equal(allocations.length, 1); assert.notEqual(allocations[0], map); assert.equal(residency.has(map), false);
  journey.downloadSetup!.phase = 'walk'; prepare(); assert.deepEqual(released, allocations);
});
