import assert from 'node:assert/strict';
import test, { type TestContext } from 'node:test';
import * as THREE from 'three';
import { FILM_SETS, type FilmJourney, type SandboxState } from '@auto_matrix/shared';
import { FilmSetRenderer } from '../packages/client/src/engine/FilmSetRenderer.js';
import { LightCulling } from '../packages/client/src/engine/LightCulling.js';
import { SentinelSetRenderer } from '../packages/client/src/engine/SentinelSetRenderer.js';
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
  const sun = new THREE.DirectionalLight(); sun.castShadow = false; scene.add(sun, new THREE.DirectionalLight(), new THREE.HemisphereLight());
  Object.assign(film, { current: FILM_SETS.film_red_dress_plaza, currentScene: 'm1_red_dress' });
  const journey = { scene: 'm1_red_dress', training: { kind: 'red_dress', elapsed: 6.4, started: true, attention: {phase:'frozen'} } } as FilmJourney;
  const parent = new THREE.Group(), actor = new THREE.Group(), geometry = new THREE.BoxGeometry(); parent.visible = false; parent.add(actor); scene.add(parent);
  const texture = new THREE.Texture({ width: 2048, height: 2048 }); texture.needsUpdate = true;
  const material = new THREE.MeshStandardMaterial({ map: texture }), skin = new THREE.SkinnedMesh(geometry, material); actor.add(skin); const sweater = new THREE.SkinnedMesh(geometry, material); sweater.userData.logosCostume = true; sweater.visible = false; actor.add(sweater);
  skin.name = 'Anatomical_head_and_hands';
  const actors = new Map([['neo', actor]]), work: string[] = [], batches: THREE.Object3D[][] = [], decks = new Set<THREE.Object3D>();
  const buffers = new Set<THREE.Object3D>();
  const programs: { program: object; isReady(): boolean; getUniforms(): void }[] = [];
  let ready = false, target: THREE.WebGLRenderTarget | null = null, uploaded = new WeakMap<THREE.Texture, number>();
  const properties = () => ({ get: (map: THREE.Texture) => ({ __version: uploaded.get(map) }) });
  const gpu = { properties: properties(), info: { programs }, debug: { checkShaderErrors: true }, extensions: { has: () => true },
    getContext: () => ({ LINK_STATUS: 0x8b82, getProgramParameter: () => true }),
    getRenderTarget: () => target, getActiveCubeFace: () => 0, getActiveMipmapLevel: () => 0,
    setRenderTarget: (value: typeof target) => { target = value; },
    render(view: THREE.Scene) {
      assert.ok(target?.width === 1 && view.children.length <= 4 && view.children.length > 0);
      view.children.forEach(object => {
        assert.ok(object instanceof THREE.Mesh && !Array.isArray(object.material) && !object.material.visible);
        buffers.add(object);
      });
      work.push('buffer');
    },
    compile(subject: THREE.Object3D, eye: THREE.Camera, lights: THREE.Scene) {
      assert.notEqual(lights, scene); assert.equal(lights.environment, scene.environment); assert.equal(lights.fog, scene.fog); assert.equal(eye, camera); assert.equal(target?.width, 1);
      let slots = 0; lights.traverseVisible(object => { if (object instanceof THREE.PointLight) slots++; }); assert.equal(slots, 6);
      let deck: THREE.Object3D | undefined;
      lights.traverseVisible(object => { if (object instanceof THREE.Group && object.parent instanceof THREE.Scene && object.getObjectByName('sentinel-cockpit')) deck = object; });
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
  const prepare = (resume = false) => {
    const count = work.length; film.prepareSentinel(gpu, camera, journey, id => ({ model: actors.get(id) }), sun, undefined, resume);
    const frame = work.slice(count);
    assert.ok(frame.filter(kind => kind === 'compile' || kind === 'bindings').length <= 1, 'prepare at most one shader batch or completed binding per frame');
    assert.ok(frame.filter(kind => kind === 'texture' || kind === 'buffer').length <= 1, 'upload one texture or small set of buffers per frame');
    assert.equal(target, null); assert.equal(parent.visible, false); assert.equal(actor.parent, parent); assert.equal(skin.parent, actor); assert.equal(sweater.visible,false); assert.equal(sun.castShadow,false); assert.equal(gpu.debug.checkShaderErrors, true);
  };
  const drain = () => { for (let i = 0; i < 450; i++) prepare(); };
  t.after(() => { film.dispose(); geometry.dispose(); material.dispose(); texture.dispose(); scene.environment!.dispose(); globalThis.document = previousDocument; });
  return { film, gpu, scene, journey, actor, actors, geometry, material, skin, sweater, work, batches, decks, buffers, prepare, drain,
    ready: () => { ready = true; }, replaceGpu: () => { uploaded = new WeakMap(); gpu.properties = properties() as THREE.WebGLRenderer['properties']; } };
}

test('the frozen explanation prepares the existing cockpit, future ship clothes and late actors in bounded batches', t => {
  const h = fixture(t); for (let i = 0; i < 4; i++) h.prepare(); assert.ok(h.batches.length); assert.ok(!h.work.includes('bindings'));
  h.ready(); h.drain(); assert.ok(h.batches.flat().includes(h.skin)); assert.ok(h.batches.flat().includes(h.sweater)); assert.equal(h.work.filter(v => v === 'texture').length, 1);
  const late = new THREE.Group(), face = new THREE.Mesh(h.geometry, h.material); late.add(face); h.actors.set('morpheus', late);
  const before = h.batches.length; h.drain(); assert.ok(h.batches.slice(before).flat().includes(face)); assert.equal(h.decks.size, 1);
  const count = h.work.length; h.drain(); assert.equal(h.work.length, count, 'completed preparation stops compiling and uploading');
});

test('cockpit preparation follows the frozen lesson, rebuilds bindings for a new GPU and releases cancellation resources', t => {
  const h = fixture(t); h.journey.visiting = 'm1_red_dress'; h.prepare(); assert.equal(h.work.length, 0); delete h.journey.visiting;
  h.ready(); h.drain(); const count = h.batches.length; h.replaceGpu(); h.drain(); assert.equal(h.batches.length, count * 2); assert.equal(h.decks.size, 1);
  const deck = [...h.decks][0], mesh = deck.getObjectByName('sentinel-cockpit')!.getObjectByProperty('isMesh', true) as THREE.Mesh;
  let disposed = 0; mesh.geometry.addEventListener('dispose', () => disposed++);
  h.journey.scene = 'm1_construct'; h.prepare(); assert.equal(disposed, 1); assert.equal(deck.parent, null);
});

test('entering the service tunnel takes the prepared cockpit with the same world transform and releases it once', t => {
  const h = fixture(t); h.ready(); h.drain(); const deck = [...h.decks][0], chair = deck.getObjectByName('sentinel-cockpit')!;
  const mesh = chair.getObjectByProperty('isMesh', true) as THREE.Mesh; let disposed = 0; mesh.geometry.addEventListener('dispose', () => disposed++);
  const world = new WorldState(); new AgentManager(world).initializeAllAgents(); const neo = world.agents.get('neo')!, center = FILM_SETS.film_service_tunnels.center;
  neo.position = { ...center }; neo.currentLocation = 'film_service_tunnels'; neo.isInMatrix = false;
  const journey = { ...h.journey, scene: 'm1_sentinels', actor: 'neo', training: undefined, sentinel: {phase:'ready',elapsed:0,noise:0,attempt:0} } as FilmJourney;
  h.film.update(neo, { structures: [], neoLife: { journey } } as unknown as SandboxState, 0); h.film.root.updateMatrixWorld(true);
  assert.equal(h.film.root.getObjectByName('sentinel-cockpit'), chair); assert.equal(deck.parent, h.film.root);
  assert.deepEqual(deck.getWorldPosition(new THREE.Vector3()).toArray(), [center.x, center.y - 1, center.z]); assert.equal(disposed, 0);
  h.film.update(undefined, undefined, 0); assert.equal(disposed, 1); assert.equal(deck.parent, null);
});


test('preparation cannot begin before Neo discovers the gunman and the explanation freezes',t=>{const h=fixture(t);h.journey.training!.attention!.phase='turning';h.prepare();assert.equal(h.work.length,0);assert.equal(h.scene.getObjectByName('sentinel-cockpit'),undefined);});

test('a paused red dress save prepares the same cockpit before and after taking control', t => {
  const h = fixture(t); Object.assign(h.film, { current: undefined, currentScene: undefined });
  h.ready(); for (let i = 0; i < 12; i++) h.prepare(true);
  assert.equal(h.decks.size, 1);
  const world = new WorldState(); new AgentManager(world).initializeAllAgents(); const neo = world.agents.get('neo')!;
  Object.assign(neo, { position: { ...FILM_SETS.film_red_dress_plaza.center }, isInMatrix: true, currentLocation: 'film_red_dress_plaza' });
  h.film.update(neo, { structures: [], neoLife: { journey: h.journey } } as unknown as SandboxState, 0);
  h.drain();
  assert.equal(h.decks.size, 1, 'taking control does not discard pending cockpit work');
  assert.equal(h.film.root.getObjectByName('sentinel-cockpit'), undefined);
});

test('a failed Sentinel save prepares the retry cast and reuses the cockpit when Neo takes control', t => {
  const h = fixture(t);
  Object.assign(h.film, { current: undefined, currentScene: undefined });
  Object.assign(h.journey, { scene: 'm1_sentinels', actor: 'neo', training: undefined,
    sentinel: { phase: 'failed', elapsed: 0, noise: 1, attempt: 0 } });
  const tank = new THREE.Group(), face = new THREE.Mesh(h.geometry, h.material);
  face.name = 'Tank_face'; tank.add(face);
  h.actors.set('tank', tank);
  for (let i = 0; i < 16; i++) h.prepare(true);
  assert.equal(h.decks.size, 1);
  assert(h.batches.flat().includes(h.skin));
  assert(h.batches.flat().includes(face));
  assert(h.work.includes('texture'));

  const deck = [...h.decks][0];
  const world = new WorldState(); new AgentManager(world).initializeAllAgents(); const neo = world.agents.get('neo')!;
  Object.assign(neo, { currentLocation: 'film_service_tunnels', isInMatrix: false, position: { ...FILM_SETS.film_service_tunnels.center } });
  h.film.update(neo, { structures: [], neoLife: { journey: h.journey } } as unknown as SandboxState, 0);
  assert.equal(deck.parent, h.film.root);
  assert.equal(deck.getObjectByName('sentinel-scan-beam')?.visible, true);

  const skinMap = new THREE.Texture({ width: 2048, height: 2048 });
  skinMap.needsUpdate = true;
  const material = new THREE.MeshStandardMaterial({ map: skinMap });
  const skin = new THREE.SkinnedMesh(h.geometry, material);
  skin.name = 'Anatomical_head_and_hands'; tank.add(skin);
  const lighting = new LightCulling(h.scene);
  lighting.stablePointSlots = true;
  t.after(() => { lighting.dispose(); skinMap.dispose(); material.dispose(); });
  const compiled: THREE.Object3D[] = [];
  t.mock.method(h.gpu, 'compile', (subject: THREE.Object3D, _camera: THREE.Camera, layout: THREE.Scene) => {
    let slots = 0;
    layout.traverseVisible(object => { if (object instanceof THREE.PointLight) slots++; });
    assert.equal(slots, 6);
    subject.traverse(object => compiled.push(object));
  });
  const prepareRetry = () => h.film.prepareSentinelControls(h.gpu, new THREE.PerspectiveCamera(), h.journey, id => h.actors.get(id), lighting);
  const before = h.work.length;
  h.ready();
  assert(prepareRetry());
  assert.deepEqual(h.work.slice(before), ['texture']);
  for (let i = 0; i < 40; i++) prepareRetry();
  assert(compiled.includes(skin));
  assert(h.work.slice(before).includes('bindings'), 'the same programs finish preparing after the cockpit attaches');
  assert.equal(skin.parent, tank);
  const normals = h.film.sentinelControlNormalMeshes;
  assert.deepEqual(normals?.map(mesh => mesh.id), [h.skin.id]);
  prepareRetry();
  assert.equal(h.film.sentinelControlNormalMeshes, normals);
  h.journey.sentinel!.phase = 'shutdown';
  assert.equal(prepareRetry(), false);
  assert.equal(h.film.sentinelControlNormalMeshes, undefined);
});

test('large skin textures from an offstage crew member upload while cockpit shaders are still linking', t => {
  const h = fixture(t); h.actor.visible = false;
  for (let i = 0; i < 5; i++) h.prepare();
  assert.ok(h.work.includes('texture'));
  assert.ok(h.batches.length > 0 && !h.work.includes('bindings'));
  h.ready(); h.drain();
  assert.ok(h.batches.flat().includes(h.skin));
  assert.equal(h.actor.visible, false);
});

test('crew entry vertex buffers use the same mesh before its first cockpit draw', t => {
  const h = fixture(t); h.actor.visible = false; h.ready(); h.drain();
  assert.ok(h.buffers.has(h.skin)); assert.equal(h.skin.material, h.material);
  assert.equal(h.actor.visible, false);
  assert.equal(h.skin.parent, h.actor);
});

test('the Sentinel viewport prepares the actual crew with the live lights before returning control', t => {
  const scene = new THREE.Scene(), film = new FilmSetRenderer(scene), lighting = new LightCulling(scene);
  const camera = new THREE.PerspectiveCamera(), geometry = new THREE.BoxGeometry();
  const lamps = Array.from({ length: 5 }, (_, i) => new THREE.PointLight(0xffffff, i));
  scene.add(...lamps); lighting.stablePointSlots = true;
  Object.assign(film, { current: FILM_SETS.film_service_tunnels, currentScene: 'm1_sentinels' });
  const journey = { scene: 'm1_sentinels', actor: 'neo', sentinel: { phase: 'sweep', elapsed: 2, noise: 0, attempt: 0 } } as FilmJourney;
  const liveProgram = {}, bindings = new Map<THREE.Material, { currentProgram: object; uniforms: { gain: { value: number } } }>();
  function crew(names: string[]) {
    const group = new THREE.Group();
    for (const name of names) {
      const material = new THREE.MeshStandardMaterial(), mesh = new THREE.Mesh(geometry, material);
      mesh.name = name; group.add(mesh);
      bindings.set(material, { currentProgram: liveProgram, uniforms: { gain: { value: .7 } } });
    }
    scene.add(group);
    return group;
  }
  const morpheus = crew(['high-poly', 'morpheus-hammer-collar', 'offstage-prop']);
  const trinity = crew(['short04', 'shoes01']);
  const neo = crew(['Anatomical_head_and_hands', 'neo-teeth-upper']);
  const tank = crew(['Tank_face', 'Tailored_trousers', 'shoes01']);
  const actors = new Map([['morpheus', morpheus]]);
  const compiled: THREE.Object3D[] = [], reflected: object[] = [];
  const programs: { program: object; isReady: () => boolean; getUniforms: () => void }[] = [];
  let target: THREE.WebGLRenderTarget | null = null, batches = 0;
  const gpu = { properties: { get: (material: THREE.Material) => bindings.get(material) }, info: { programs },
    debug: { checkShaderErrors: true }, extensions: { has: () => true },
    getRenderTarget: () => target, setRenderTarget: (value: typeof target) => { target = value; },
    getContext: () => ({ LINK_STATUS: 0x8b82, getProgramParameter: () => true }),
    compile(subject: THREE.Object3D, _camera: THREE.Camera, layout: THREE.Scene) {
      assert.notEqual(layout, scene); assert.equal(target?.width, 1);
      let slots = 0;
      layout.traverseVisible(object => { if (object instanceof THREE.PointLight) slots++; });
      assert.equal(slots, 6);
      batches++;
      subject.traverse(object => {
        if (!(object instanceof THREE.Mesh) || Array.isArray(object.material)) return;
        compiled.push(object);
        const state = bindings.get(object.material)!, program = {};
        state.currentProgram = program; state.uniforms = { gain: { value: .2 } };
        programs.push({ program, isReady: () => true, getUniforms: () => { reflected.push(program); } });
      });
    },
  } as unknown as THREE.WebGLRenderer;
  t.after(() => { film.dispose(); lighting.dispose(); geometry.dispose(); bindings.forEach((_state, material) => material.dispose()); });
  const prepare = () => {
    const work = batches + reflected.length;
    const busy = film.prepareSentinelControls?.(gpu, camera, journey, id => actors.get(id), lighting);
    assert(batches + reflected.length - work <= 1);
    assert.equal(target, null);
    for (const state of bindings.values()) {
      assert.equal(state.currentProgram, liveProgram);
      assert.equal(state.uniforms.gain.value, .7);
    }
    assert.deepEqual(lamps.map(light => light.intensity), [0, 1, 2, 3, 4]);
    return busy;
  };
  prepare(); assert.equal(compiled.length, 0);
  journey.sentinel!.phase = 'clear'; prepare();
  assert.deepEqual(compiled.map(mesh => mesh.id), morpheus.children.slice(0, 2).map(mesh => mesh.id));
  assert.equal(reflected.length, 0);
  actors.set('neo', neo); actors.set('tank', tank);
  for (let i = 0; i < 32; i++) prepare();
  assert.deepEqual(new Set(compiled), new Set([...morpheus.children.slice(0, 2), ...neo.children, ...tank.children]));
  assert.deepEqual(film.sentinelControlNormalMeshes, [neo.children[0]]);
  assert.equal(reflected.length, 7);
  journey.sentinel!.phase = 'verify'; assert.equal(prepare(), false);
  journey.sentinel!.phase = 'confirming'; actors.set('trinity', trinity);
  for (let i = 0; i < 12; i++) prepare();
  assert.deepEqual(new Set(compiled), new Set([...morpheus.children.slice(0, 2), ...neo.children, ...tank.children, ...trinity.children]));
  assert.equal(reflected.length, 9); assert.equal(prepare(), false);
  journey.sentinel!.phase = 'done'; assert.equal(prepare(), false);
});

test('cockpit metal shares decoded images between distinct hull and grate UV repeats', t => {
  const textures = new Map<string, { texture: THREE.Texture; onLoad: (texture: THREE.Texture) => void }>();
  t.mock.method(THREE.TextureLoader.prototype, 'load', (url: string, onLoad: (texture: THREE.Texture) => void) => {
    assert.ok(!textures.has(url)); const texture = new THREE.Texture();
    textures.set(url, { texture, onLoad }); return texture;
  });
  const original = globalThis.document; globalThis.document = {} as Document;
  t.after(() => { globalThis.document = original; });
  const root = new THREE.Group(), cockpit = new SentinelSetRenderer(root); t.after(() => cockpit.dispose());
  const deck = root.getObjectByName('sentinel-cockpit-deck') as THREE.Mesh<THREE.BufferGeometry, THREE.MeshStandardMaterial>;
  const grate = root.getObjectByName('sentinel-floor-grate') as typeof deck;
  for (const [suffix, field] of [['color','map'], ['normal','normalMap'], ['roughness','roughnessMap']] as const) {
    const { texture, onLoad } = textures.get(`/assets/film-materials/metal_plate-${suffix}.jpg`)!;
    const first = deck.material[field]!, second = grate.material[field]!;
    assert.notEqual(first, second); assert.equal(first.source, second.source);
    assert.deepEqual(first.repeat.toArray(), [5, 5]); assert.deepEqual(second.repeat.toArray(), [4, 4]);
    assert.equal(second.version, 0);
    const image = { width: 1024, height: 1024 };
    texture.image = image; texture.needsUpdate = true; onLoad(texture);
    assert.equal(first.image, image); assert.equal(second.image, image); assert.equal(second.version, 1);
  }
});
