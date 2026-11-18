import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { bridgeArrivalPose, filmEntry, filmPosition, FILM_SCENE_BY_ID, meetingCarPose, meetingRollRoadTime, LAFAYETTE, MEETING_ROAD_WIDTH, MEETING_CAR, type FilmJourney } from '@auto_matrix/shared';
import { AgentRenderer } from '../packages/client/src/agents/AgentRenderer.js';
import { FilmSetRenderer } from '../packages/client/src/engine/FilmSetRenderer.js';
import { LightCulling } from '../packages/client/src/engine/LightCulling.js';
import { MeetingSetRenderer } from '../packages/client/src/engine/MeetingSetRenderer.js';
import { AgentManager } from '../packages/server/src/agents/AgentManager.js';
import { WorldState } from '../packages/server/src/world/WorldState.js';

test('Lafayette prepares the existing drive textures before the sedan moves', async t => {
  const document = globalThis.document;
  globalThis.document = { createElement: () => ({ getContext: () => ({ fillRect() {}, fillText() {} }) }) } as unknown as Document;
  const loads: (() => void)[] = [];
  t.mock.method(THREE.TextureLoader.prototype, 'load', (url, onLoad) => {
    const texture = new THREE.Texture();
    loads.push(() => { texture.image = { width: 1024, height: 1024, url }; texture.needsUpdate = true; onLoad?.(texture); });
    return texture;
  });
  const scene = new THREE.Scene(), camera = new THREE.PerspectiveCamera(), lights = new LightCulling(scene);
  const film = new FilmSetRenderer(scene); t.after(() => { film.dispose(); lights.dispose(); globalThis.document = document; });
  const street = new MeetingSetRenderer(film.root); film['meeting'] = street;
  const hotel = street['hotel']!;
  const uploads: THREE.Texture[] = [], uploaded = new WeakMap<THREE.Texture, number>();
  const renderer = {
    properties: { get: (texture: THREE.Texture) => ({ __version: uploaded.get(texture) }) },
    initTexture(texture: THREE.Texture) { uploads.push(texture); uploaded.set(texture, texture.version); },
  } as unknown as THREE.WebGLRenderer;
  const journey = { scene: 'm1_bug', actor: 'neo', meeting: { phase: 'done', elapsed: 0, bugged: false, roadTime: 10.4 } } as FilmJourney;
  const prepare = () => film.prepareLafayette(renderer, camera, lights, journey);
  prepare(); assert.equal(uploads.length, 0, 'undecoded textures stay queued');
  loads.forEach(finish => finish());
  const maps = new Set<THREE.Texture>();
  hotel.root.traverse(object => {
    if (!(object instanceof THREE.Mesh) || !(object.material instanceof THREE.MeshStandardMaterial)) return;
    for (const texture of [object.material.map, object.material.normalMap, object.material.roughnessMap])
      if (texture?.image?.width >= 1024) maps.add(texture);
  });
  assert.ok(maps.size > 0);
  await t.test('the two plaster samplers share each decoded image and retain their tiling', () => {
    for (const kind of ['color', 'normal', 'roughness']) {
      const variants = [...maps].filter(texture => texture.image.url.endsWith(`damaged_plaster-${kind}.jpg`));
      assert.deepEqual(variants.map(texture => texture.repeat.x).sort(), [3, 8]);
      assert.ok(variants[0].source === variants[1].source, `share the decoded ${kind} image`);
      assert.equal(variants[0].source.version, 1, 'alias creation keeps the shared image version');
    }
  });
  await t.test('one original texture per frame becomes resident while the car waits', () => {
    const clock = JSON.stringify(journey);
    for (let frame = 0; frame < 40; frame++) {
      const before = uploads.length; prepare(); assert.ok(uploads.length - before <= 1);
    }
    assert.equal(uploads.length, maps.size, 'prepare the textures owned by the hotel');
    assert.deepEqual(new Set(uploads), maps); assert.equal(film['meeting'], street);
    assert.equal(JSON.stringify(journey), clock);
  });
});

for (const checkpoint of ['arrival', 'departure'] as const) test(`cold bridge ${checkpoint} stages the street and late cast textures`, t => {
  const document = globalThis.document;
  globalThis.document = { createElement: () => ({ getContext: () => ({ fillRect() {}, fillText() {} }) }) } as unknown as Document;
  t.after(() => { globalThis.document = document; });
  t.mock.method(THREE.TextureLoader.prototype, 'load', () => {
    const map = new THREE.Texture({ width: 1024, height: 1024 }); map.needsUpdate = true; return map;
  });
  const scene = new THREE.Scene(), camera = new THREE.PerspectiveCamera(), sun = new THREE.DirectionalLight(); scene.add(sun);
  const film = new FilmSetRenderer(scene); t.after(() => film.dispose());
  const encounter = checkpoint === 'arrival' ? { bridgeArrival: { phase: 'approaching', elapsed: 1 } } :
    { meeting: { phase: 'leaving', elapsed: 2.1, roadTime: 3, bugged: true, approach: { x: 4, z: -12.35, yaw: Math.PI } } };
  const journey = { scene: 'm1_bridge', actor: 'neo',
    office: { outcome: checkpoint === 'arrival' ? 'escaped' : 'captured' }, ...encounter } as FilmJourney;
  const tail = new THREE.Group(), geometry = new THREE.BoxGeometry(), map = new THREE.Texture({ width: 1024, height: 1024 }); map.needsUpdate = true;
  const hair = new THREE.MeshStandardMaterial({ map });
  const tailHead = new THREE.Mesh(geometry, hair); tailHead.name = 'Anatomical_head_and_hands'; tail.add(tailHead);
  const player = new THREE.Group(), torsoMap = new THREE.Texture({ width: 2048, height: 2048 }); torsoMap.needsUpdate = true;
  const skin = new THREE.MeshStandardMaterial({ map: torsoMap });
  const torso = new THREE.SkinnedMesh(geometry, skin); torso.name = 'Office_torso'; torso.visible = false;
  torso.bind(new THREE.Skeleton(), new THREE.Matrix4()); player.add(torso);
  t.after(() => { geometry.dispose(); hair.dispose(); map.dispose(); skin.dispose(); torsoMap.dispose(); });
  const uploaded = new WeakMap<THREE.Texture, number>(), uploads: THREE.Texture[] = [];
  let target: THREE.WebGLRenderTarget | null = null;
  const renderer = { properties: { get: (texture: THREE.Texture) => ({ __version: uploaded.get(texture) }) },
    info: { programs: [] }, debug: { checkShaderErrors: true }, extensions: { has: () => true }, shadowMap: { enabled: false },
    getRenderTarget: () => target, getActiveCubeFace: () => 0, getActiveMipmapLevel: () => 0,
    setRenderTarget: (value: typeof target) => { target = value; }, render() {}, compile() {},
    initTexture(texture: THREE.Texture) { uploads.push(texture); uploaded.set(texture, texture.version); },
  } as unknown as THREE.WebGLRenderer;
  const prepare = (neo?: THREE.Group, pursuer?: THREE.Group) => film.prepareBridge(renderer, camera, journey,
    id => id === 'neo' ? neo : undefined, sun, undefined, undefined, pursuer, true);
  if (checkpoint === 'arrival') {
    const tracked = { ...journey, office: { ...journey.office!, outcome: 'captured' as const },
      bridgeTail: { phase: 'tracking' as const, alert: 0, lastTick: 0, attempts: 0, spawned: true } };
    const saved = JSON.stringify(tracked);
    for (let frame = 0; frame < 4; frame++) film.prepareBridge(renderer, camera, tracked,
      id => id === 'neo' ? player : undefined, sun, undefined, undefined, tail, true);
    assert.ok(!film['preparedBridge'], 'the tracked approach prepares the cast without the full street');
    assert.equal(uploads.length, 2, 'prepare the pursuer and the hidden boarding torso before the first draw');
    assert.deepEqual(new Set(uploads), new Set([map, torsoMap]));
    assert.equal(tail.parent, null); assert.equal(torso.visible, false); assert.equal(JSON.stringify(tracked), saved);
    uploads.length = 0; uploaded.delete(torsoMap);
  }
  assert.equal(film['meeting'], undefined, 'a cold landing has not built its active street yet');
  const before = JSON.stringify(journey);
  prepare();
  assert.ok(film['preparedBridge']?.renderer.root.getObjectByName('meeting-bridge-runoff'), 'finish the hidden saved street before possession can adopt it');
  for (let frame = 0; frame < 400; frame++) prepare();
  assert.ok(film['preparedBridge'], 'build the saved street before possession creates its active set');
  const prepared = film['preparedBridge']!.renderer, root = prepared.root, expected = new Set<THREE.Texture>();
  root.traverseVisible(object => {
    if (!(object instanceof THREE.Mesh) || Array.isArray(object.material)) return;
    const material = object.material as THREE.MeshStandardMaterial;
    for (const texture of [material.map, material.normalMap, material.bumpMap, material.roughnessMap, material.alphaMap])
      if (texture?.image?.width >= 1024 && texture.version > 0) expected.add(texture);
  });
  assert.ok(expected.size > 0);
  assert.deepEqual(new Set(uploads), expected, 'prepare every decoded map used by the actual bridge and hotel');
  const count = uploads.length;
  for (let frame = 0; frame < 40; frame++) prepare(player, checkpoint === 'departure' ? tail : undefined);
  assert.deepEqual(new Set(uploads.slice(count)), new Set(checkpoint === 'departure' ? [map, torsoMap] : [torsoMap]),
    'prepare the late player torso before the first boarding pose reveals it');
  assert.equal(torso.visible, false); assert.equal(torso.parent, player);
  assert.equal(film['preparedBridge']!.renderer, prepared); assert.equal(tail.parent, null);
  assert.equal(JSON.stringify(journey), before, 'preparation retains the saved car position and action clock');
  assert.equal(root.parent !== scene, true, 'offstage preparation keeps the live scene separate');
  film.prepareBridge(renderer, camera, undefined, () => undefined, sun);
  assert.equal(root.parent, null, 'leaving the saved bridge releases the staged scenery');
});

test('bridge preparation builds the street over several steps and adopts the same scenery on entry', t => {
  t.mock.method(THREE.TextureLoader.prototype, 'load', () => new THREE.Texture());
  const parent = new THREE.Group(), prepared = new MeetingSetRenderer(undefined, false);
  t.after(() => prepared.dispose());
  assert.equal(prepared.root.parent, null);
  assert.equal(prepared.prepareStep(), false);
  const lamps = (prepared as unknown as { streetLamps: THREE.Vector3[] }).streetLamps;
  const first = lamps.length;
  assert.equal(prepared.prepareStep(), false);
  assert.ok(lamps.length > first, 'street construction continues on the second frame');
  let ready = false;
  for (let i = 0; i < 200 && !ready; i++) ready = prepared.prepareStep();
  assert.equal(ready, true, 'all scenery is constructed before the camera cuts to the bridge');
  const mesh = prepared.root.getObjectByProperty('isMesh', true) as THREE.Mesh;
  assert.ok(mesh);
  const large: THREE.BufferGeometry[] = [];
  prepared.root.traverse(object => {
    if (object instanceof THREE.Mesh && object.geometry.attributes.position.count > 20000) large.push(object.geometry);
  });
  assert.ok(large.length > 0, 'include the actual dense bridge batches');
  for (const geometry of large) {
    const reference = geometry.clone(); reference.computeBoundingSphere();
    try { assert.deepEqual(geometry.boundingSphere, reference.boundingSphere, 'prepare the exact culling bound before the first visible draw'); }
    finally { reference.dispose(); }
  }
  let disposed = 0;
  mesh.geometry.addEventListener('dispose', () => disposed++);
  prepared.attach(parent);
  assert.deepEqual(parent.children, [prepared.root]);
  assert.ok(parent.getObjectById(mesh.id), 'the real geometry is adopted when the bridge appears');
  assert.equal(disposed, 0);

  const cancelled = new MeetingSetRenderer(undefined, false);
  assert.equal(cancelled.prepareStep(), false);
  const source = cancelled.root.getObjectByProperty('isMesh', true) as THREE.Mesh;
  let released = false;
  source.geometry.addEventListener('dispose', () => { released = true; });
  cancelled.dispose();
  assert.equal(released, true, 'leaving the apartment releases unfinished bridge geometry');
});

test('the bridge prepares cast buffers, both shadow layouts and the rain programs before entry', t => {
  const document = globalThis.document, previousBitmap = globalThis.ImageBitmap;
  class Bitmap { width = 2048; height = 2048; }
  globalThis.ImageBitmap = Bitmap as unknown as typeof ImageBitmap;
  globalThis.document = { createElement: () => ({ getContext: () => ({ fillRect() {}, fillText() {} }) }) } as unknown as Document;
  t.after(() => {
    globalThis.document = document;
    if (previousBitmap) globalThis.ImageBitmap = previousBitmap;
    else Reflect.deleteProperty(globalThis, 'ImageBitmap');
  });
  t.mock.method(THREE.TextureLoader.prototype, 'load', () => new THREE.Texture());
  const scene = new THREE.Scene(), camera = new THREE.PerspectiveCamera(), sun = new THREE.DirectionalLight(), roomLamp = new THREE.SpotLight();
  sun.castShadow = roomLamp.castShadow = true; scene.add(sun, roomLamp);
  const fill = new THREE.DirectionalLight(); fill.visible = false; scene.add(fill);
  scene.fog = new THREE.FogExp2(0x18231e, .01);
  const lighting = new LightCulling(scene); lighting.minimumPointSlots = 4;
  const film = new FilmSetRenderer(scene);
  t.after(() => { film.dispose(); lighting.dispose(); });
  const actor = new THREE.Group(), geometry = new THREE.BoxGeometry(), surface = new THREE.MeshStandardMaterial();
  t.after(() => { geometry.dispose(); surface.dispose(); });
  const jacket = new THREE.SkinnedMesh(geometry, surface); jacket.name = 'Tailored_coat_upper'; jacket.visible = false; jacket.castShadow = true; actor.add(jacket);
  jacket.bind(new THREE.Skeleton(), new THREE.Matrix4());
  const [hair, bump] = [new Bitmap(), new Bitmap()].map(image => {
    const texture = new THREE.Texture(image); texture.flipY = false; texture.needsUpdate = true; return texture;
  });
  const tail = new THREE.Group(), tailGeometry = new THREE.BoxGeometry(), tailSurface = new THREE.MeshStandardMaterial({ map: hair, bumpMap: bump });
  const tailMesh = new THREE.Mesh(tailGeometry, tailSurface); tailMesh.name = 'short04'; tail.add(tailMesh);
  t.after(() => { tailGeometry.dispose(); tailSurface.dispose(); hair.dispose(); bump.dispose(); });
  const journey = { scene: 'm1_wake_again', actor: 'neo', wakeCall: { phase: 'pickup' } } as FilmJourney;
  let target: THREE.WebGLRenderTarget | null = null, onLanding = true;
  const depth = new Map<THREE.MeshDepthMaterial, Set<string>>(), effects = new Map<string, THREE.Object3D>();
  const uploaded = new Map<THREE.BufferGeometry, number>();
  const textures = new WeakMap<THREE.Texture, { __version: number; __webglTexture: object }>();
  const rowsByImage = new Map<Bitmap, number>();
  let frameRows = 0, frameSubmissions = 0;
  const programs: { program: object; isReady(): boolean; getUniforms(): void }[] = [];
  const gl = { LINK_STATUS: 0x8b82, TEXTURE_2D: 0x0de1, UNPACK_SKIP_ROWS: 0x0cf3, RGBA: 0x1908, UNSIGNED_BYTE: 0x1401,
    getProgramParameter: () => true, pixelStorei() {}, generateMipmap() {},
    texSubImage2D(_target: number, _level: number, _x: number, y: number, width: number, height: number,
      _format: number, _type: number, image: Bitmap) {
      assert.deepEqual([width, y, height], [2048, rowsByImage.get(image) ?? 0, 256]);
      frameRows++; rowsByImage.set(image, y + height);
    },
  };
  const renderer = {
    properties: { get: (texture: THREE.Texture) => textures.get(texture) ?? {} },
    info: { programs }, debug: { checkShaderErrors: true }, extensions: { has: () => true }, capabilities: { maxTextureSize: 4096 },
    shadowMap: { enabled: true, type: THREE.PCFSoftShadowMap },
    state: { bindTexture() {}, unbindTexture() {} },
    initTexture(texture: THREE.Texture) { textures.set(texture, { __version: texture.version, __webglTexture: {} }); },
    getRenderTarget: () => target, getActiveCubeFace: () => 0, getActiveMipmapLevel: () => 0,
    setRenderTarget: (value: typeof target) => { target = value; },
    render(bufferScene: THREE.Scene) {
      frameSubmissions++;
      assert.ok(bufferScene.children.length <= 4);
      for (const object of bufferScene.children) if (object instanceof THREE.Mesh || object instanceof THREE.Line) {
        assert.equal((object.material as THREE.Material).visible, false);
        if (object.constructor === THREE.Mesh && object.geometry.attributes.position.count > 20000)
          assert.ok(object.geometry.boundingSphere, 'dense bridge and hotel geometry must be bounded before upload');
        uploaded.set(object.geometry, (uploaded.get(object.geometry) ?? 0) + 1);
      }
    },
    getContext: () => gl,
    compile(subject: THREE.Object3D, _eye: THREE.Camera, view: THREE.Scene) {
      frameSubmissions++;
      let points = 0, spots = 0, directional = 0;
      view.traverseVisible(object => { if (object instanceof THREE.PointLight) points++; if (object instanceof THREE.SpotLight) spots++; if (object instanceof THREE.DirectionalLight) directional++; });
      if (view.fog) assert.equal(directional, 2, 'the landing prepares both player light slots before possession');
      let entersProgram = false;
      subject.traverse(object => {
        if (object instanceof THREE.Mesh && object.material instanceof THREE.MeshDepthMaterial) {
          assert.equal(view.fog, null);
          if (points === 4) assert.equal(onLanding, false, 'wait for possession before preparing the apartment shadow layout');
          const layouts = depth.get(object.material) ?? new Set();
          layouts.add(`${points}/${spots}`); depth.set(object.material, layouts);
          entersProgram = true;
        } else if (object instanceof THREE.Line || object instanceof THREE.Mesh && object.material instanceof THREE.ShaderMaterial) {
          assert.equal(view.fog, scene.fog);
          assert.deepEqual([points, spots], [12, 7]);
          effects.set(object.name || 'rain', object); entersProgram = true;
        }
      });
      if (entersProgram) programs.push({ program: {}, isReady: () => true, getUniforms() { reflected++; frameSubmissions++; } });
    },
  } as unknown as THREE.WebGLRenderer;
  let reflected = 0;
  for (let frame = 0; frame < 144; frame++) {
    onLanding = frame < 60; fill.visible = !onLanding;
    frameRows = frameSubmissions = 0;
    film.prepareBridge(renderer, camera, journey, id => id === 'neo' ? actor : undefined, sun, undefined, lighting,
      frame >= 92 ? tail : undefined, onLanding);
    if (frameRows > 0) {
      assert.equal(frameRows, 1, 'submit one strip on a live handset frame');
      assert.equal(frameSubmissions, 0, 'do not stack detached shader or buffer work with a live handset upload');
    }
  }
  for (const texture of [hair, bump]) {
    assert.equal(rowsByImage.get(texture.image), 2048, 'finish the original texture before entry');
    assert.equal(textures.get(texture)?.__version, texture.version);
  }
  assert(depth.size >= 3);
  assert([...depth.values()].every(layouts => layouts.has('4/1') && layouts.has('12/7')));
  assert.deepEqual([...effects.keys()].sort(), ['meeting-bridge-runoff', 'meeting-bridge-spray', 'meeting-road-puddles', 'rain']);
  assert.equal(uploaded.get(geometry), 1, 'prepare the coat while it is still hidden in the apartment');
  assert.equal(uploaded.get(tailGeometry), 1, 'a late pursuer reopens the finished buffer queue');
  assert.equal(reflected, programs.length);
  assert.equal(target, null); assert.equal(jacket.visible, false); assert.deepEqual(actor.children, [jacket]);
  let released = 0;
  for (const material of depth.keys()) material.addEventListener('dispose', () => released++);
  film.prepareBridge(renderer, camera, undefined, () => undefined, sun, undefined, lighting);
  assert.equal(released, depth.size);
});

test('bridge preparation links each shared scenery material once without skipping geometry uploads', t => {
  const document = globalThis.document;
  globalThis.document = { createElement: () => ({ getContext: () => ({ fillRect() {}, fillText() {} }) }) } as unknown as Document;
  t.after(() => { globalThis.document = document; });
  t.mock.method(THREE.TextureLoader.prototype, 'load', () => new THREE.Texture());
  const scene = new THREE.Scene(), camera = new THREE.PerspectiveCamera(), sun = new THREE.DirectionalLight();
  scene.add(sun, new THREE.DirectionalLight());
  const film = new FilmSetRenderer(scene);
  t.after(() => film.dispose());
  const journey = { scene: 'm1_wake_again', actor: 'neo', wakeCall: { phase: 'leaving' } } as FilmJourney;
  const links = new Map<THREE.Material, number>(), reflected = new Set<THREE.Material>();
  const geometries = new Set<THREE.BufferGeometry>(), uploaded = new Set<THREE.BufferGeometry>();
  const programs: { program: object; isReady(): boolean; getUniforms(): void }[] = [];
  let target: THREE.WebGLRenderTarget | null = null, complete = false;
  const renderer = {
    properties: { get: () => ({}) }, info: { programs }, debug: { checkShaderErrors: true }, extensions: { has: () => true },
    shadowMap: { enabled: false },
    getRenderTarget: () => target, getActiveCubeFace: () => 0, getActiveMipmapLevel: () => 0,
    setRenderTarget: (value: typeof target) => { target = value; },
    getContext: () => ({ LINK_STATUS: 0x8b82, getProgramParameter: () => true }),
    render(bufferScene: THREE.Scene) {
      for (const object of bufferScene.children) if (object instanceof THREE.Mesh || object instanceof THREE.Line) uploaded.add(object.geometry);
    },
    compile(subject: THREE.Object3D) {
      subject.traverse(object => {
        if (!(object instanceof THREE.Mesh) || object.constructor !== THREE.Mesh || Array.isArray(object.material)) return;
        const material = object.material;
        if (!(material instanceof THREE.MeshStandardMaterial || material instanceof THREE.MeshBasicMaterial)) return;
        if (material.vertexColors || object.geometry.hasAttribute('tangent') || Object.keys(object.geometry.morphAttributes).length) return;
        links.set(material, (links.get(material) ?? 0) + 1);
        if (links.get(material) === 1) programs.push({ program: {}, isReady: () => complete, getUniforms() { reflected.add(material); } });
      });
    },
  } as unknown as THREE.WebGLRenderer;
  for (let frame = 0; frame < 400; frame++) film.prepareBridge(renderer, camera, journey, () => undefined, sun, undefined, undefined, undefined, true);
  assert.ok(links.size > 20, 'prepare the actual street, bridge, hotel and vehicle materials');
  for (const [material, count] of links) assert.equal(count, 1, `shared material ${material.name || material.type} should not delay other programs`);
  assert.equal(reflected.size, 0, 'never query uniforms before parallel compilation completes');
  complete = true;
  film.prepareBridge(renderer, camera, journey, () => undefined, sun, undefined, undefined, undefined, true);
  assert.equal(reflected.size, 0, 'leave a frame after compilation reports completion');
  for (let count = 1; count <= programs.length; count++) {
    film.prepareBridge(renderer, camera, journey, () => undefined, sun, undefined, undefined, undefined, true);
    assert.equal(reflected.size, count, 'query one previously completed program each frame without idle gaps');
  }
  assert.equal(reflected.size, links.size);
  const prepared = film as unknown as { preparedBridge: { renderer: MeetingSetRenderer } };
  prepared.preparedBridge.renderer.root.traverse(object => {
    if (object instanceof THREE.Mesh || object instanceof THREE.Line) geometries.add(object.geometry);
  });
  assert.deepEqual(uploaded, geometries, 'all original scenery geometry still uploads even when a material is shared');
  assert.equal(target, null);
});

test('Adams Street renders the local cast while the separate city is hidden', t => {
  t.mock.method(GLTFLoader.prototype, 'loadAsync', () => new Promise(() => {}));
  t.mock.method(THREE.TextureLoader.prototype, 'load', () => new THREE.Texture());
  const document = globalThis.document;
  const context = { fillRect() {}, fillText() {}, strokeRect() {}, putImageData() {}, createRadialGradient: () => ({ addColorStop() {} }),
    createImageData: (width: number, height: number) => ({ data: new Uint8ClampedArray(width * height * 4) }) };
  globalThis.document = { createElement: () => ({ getContext: () => context }) } as unknown as Document;
  const renderer = new AgentRenderer(new THREE.Scene()), camera = new THREE.PerspectiveCamera();
  t.after(() => { renderer.dispose(); globalThis.document = document; });
  const world = new WorldState(); new AgentManager(world).initializeAllAgents();
  const entry = filmEntry(FILM_SCENE_BY_ID.m1_bridge);
  camera.position.set(entry.x, entry.y + 5, entry.z + 8);
  const neo = world.agents.get('neo')!, trinity = world.agents.get('trinity')!, guest = world.agents.get('citizen_1')!;
  const guide = world.agents.get('morpheus')!, remote = world.agents.get('agent_jones')!;
  Object.assign(neo, { currentLocation: 'film_adams_bridge', position: entry });
  Object.assign(trinity, { currentLocation: 'film_adams_bridge', position: filmPosition('film_adams_bridge', -1, 32), isInMatrix: true });
  Object.assign(guest, { currentLocation: 'downtown', controller: 'other', position: filmPosition('film_extraction_car', 95, -110) });
  Object.assign(guide, { currentLocation: 'film_lafayette', position: filmPosition('film_lafayette'), isInMatrix: true });
  for (const agent of [neo, trinity, guest, guide, remote]) renderer.updateAgent(agent.id, agent);
  renderer.setPlayer('neo');
  const journey = { scene: 'm1_bridge', actor: 'neo', step: 0 } as FilmJourney;
  const visible = (id: string) => renderer.getAgent(id)!.visible;
  renderer.update(0, camera, 1, 0, journey);
  assert.equal(visible(remote.id), false, 'actors from the hidden city should not enter draw lists');
  for (const agent of [neo, trinity, guest, guide]) assert.equal(visible(agent.id), true, agent.id);

  neo.currentLocation = 'film_extraction_car'; renderer.updateAgent('neo', neo);
  journey.scene = 'm1_bug'; renderer.update(0, camera, 1, 0, journey);
  assert.equal(visible(remote.id), false);
  assert.equal(visible(guest.id), true, 'a second player on the road remains visible');
  neo.position = filmPosition('film_lafayette', 0, 29); neo.position.y -= LAFAYETTE.upper;
  renderer.updateAgent('neo', neo); renderer.update(0, camera, 1, 0, journey);
  assert.equal(visible(remote.id), false, 'Lafayette curb keeps the same city boundary');
  assert.equal(visible(guest.id), true); assert.equal(visible(guide.id), true);
  neo.currentLocation = 'film_lafayette'; renderer.updateAgent('neo', neo);
  for (const scene of ['m1_pills', 'm1_mirror']) {
    journey.scene = scene; renderer.update(0, camera, 1, 0, journey);
    assert.equal(visible(remote.id), false);
    assert.equal(visible(guide.id), true);
  }
  renderer.setPlayer(null); renderer.update(0, camera, 1, 0, journey);
  assert.equal(visible(remote.id), true, 'returning to the overview restores normal visibility');
});

test('the cultivation pod draws its own actors and keeps the boarding crew when they arrive', t => {
  t.mock.method(GLTFLoader.prototype, 'loadAsync', () => new Promise(() => {}));
  t.mock.method(THREE.TextureLoader.prototype, 'load', () => new THREE.Texture());
  const document = globalThis.document;
  const context = { fillRect() {}, fillText() {}, strokeRect() {}, putImageData() {}, createRadialGradient: () => ({ addColorStop() {} }),
    createImageData: (width: number, height: number) => ({ data: new Uint8ClampedArray(width * height * 4) }) };
  globalThis.document = { createElement: () => ({ getContext: () => context }) } as unknown as Document;
  const renderer = new AgentRenderer(new THREE.Scene()), camera = new THREE.PerspectiveCamera();
  t.after(() => { renderer.dispose(); globalThis.document = document; });
  const world = new WorldState(); new AgentManager(world).initializeAllAgents();
  const neo = world.agents.get('neo')!, trinity = world.agents.get('trinity')!, tank = world.agents.get('tank')!;
  const position = filmEntry(FILM_SCENE_BY_ID.m1_pod);
  Object.assign(neo, { isInMatrix: false, currentLocation: 'film_power_plant_pods', position });
  Object.assign(trinity, { isInMatrix: false, currentLocation: 'film_power_plant_pods', position: filmPosition('film_power_plant_pods', 3, 17) });
  for (const agent of [neo, trinity, tank]) renderer.updateAgent(agent.id, agent);
  renderer.setWorld(false); renderer.setPlayer(neo.id); camera.position.set(position.x + 4, position.y + 5, position.z + 7);
  const journey = { scene: 'm1_pod', actor: 'neo', step: 1, awakening: { kind: 'rescue', elapsed: 8.8 } } as FilmJourney;
  renderer.update(0, camera, 0, 0, journey);
  const visible = (id: string) => renderer.getAgent(id)?.visible;
  assert.equal(visible(tank.id), false);
  assert.equal(visible(trinity.id), true);
  assert.equal(visible(neo.id), true);
  renderer.setPlayer(null); renderer.update(0, camera, 0, 0, journey);
  assert.equal(visible(tank.id), true);
});

test('the bridge and car retain only drawn geometry and keep the indexed wheel batches', t => {
  t.mock.method(THREE.TextureLoader.prototype, 'load', () => new THREE.Texture());
  const parent = new THREE.Group(), renderer = new MeetingSetRenderer(parent, false);
  t.after(() => renderer.dispose());
  const { geometries, wheels } = renderer as unknown as {
    geometries: Set<THREE.BufferGeometry>; wheels: { spin: THREE.Group }[];
  };
  const live = new Set<THREE.BufferGeometry>();
  parent.traverse(object => { if (object instanceof THREE.Mesh || object instanceof THREE.Line) live.add(object.geometry); });
  assert.equal([...geometries].filter(geometry => !live.has(geometry)).length, 0,
    'source buffers replaced by static batches must be released while the set is active');
  for (const wheel of wheels) {
    const meshes = wheel.spin.children.filter(object => object instanceof THREE.Mesh);
    assert.ok(meshes.length > 0);
    assert.ok(meshes.every(mesh => mesh.geometry.index !== null), 'each wheel keeps its existing triangle indices');
  }
});

test('the actual car body uses the same fast pose as its occupants between journey snapshots', t => {
  const document = globalThis.document;
  globalThis.document = { createElement: () => ({ getContext: () => ({ fillRect() {}, fillText() {} }) }) } as unknown as Document;
  t.mock.method(THREE.TextureLoader.prototype, 'load', () => new THREE.Texture());
  const parent = new THREE.Group(); const renderer = new MeetingSetRenderer(parent);
  const journey: FilmJourney = { version: 1, scene: 'm1_bug', step: 2, actor: 'neo', completed: [], reflections: {}, enteredAt: 0, checkpoint: { x: 0, y: 1, z: 0 }, lastText: '',
    meeting: { phase: 'driving', elapsed: 20, bugged: false, approach: { x: 4, z: -12.35, yaw: Math.PI } } };
  try {
    const vehicle = (renderer as unknown as { vehicle: THREE.Group }).vehicle;
    const tailLights = vehicle.children.filter(child => child.name.startsWith('meeting-tail-light-')) as THREE.SpotLight[];
    assert.equal(tailLights.length, 2, 'the parked car needs two visible rear lamps against the bridge darkness');
    for (const light of tailLights) {
      assert.ok(light.position.z > 6.5 && light.position.y > 1, 'the rear lamps must sit on the car tail');
      assert.ok(light.color.r > light.color.g * 2 && light.intensity >= 40, 'the wet road needs a readable red spill');
      assert.ok(light instanceof THREE.SpotLight && light.target.position.z > light.position.z,
        'tail lamps must light the road behind the car without washing the passenger cabin red');
    }
    for (const elapsed of [20, 20.45, 40.5, 42]) {
      const gesture = { phase: 'driving' as const, elapsed, role: 'neo' as const, bugged: false };
      renderer.update(journey, elapsed, gesture);
      const car = meetingCarPose(gesture);
      assert.ok(vehicle.position.distanceTo(new THREE.Vector3(car.x, 0, car.z)) < .001, 'a slow journey snapshot cannot leave the car behind its occupants');
      assert.ok(Math.abs(vehicle.rotation.y - car.yaw) < .001);
    }
    journey.scene = 'm1_bridge'; delete journey.meeting;
    journey.bridgeArrival = { phase: 'approaching', elapsed: 2.35 };
    renderer.update(journey, 2.35);
    const inbound = bridgeArrivalPose(2.35);
    assert.ok(vehicle.position.distanceTo(new THREE.Vector3(inbound.x, 0, inbound.z)) < .001);
    assert.ok(Math.abs(vehicle.rotation.y - inbound.yaw) < .001);
    journey.meeting = { phase: 'rolling', elapsed: 3, roadTime: meetingRollRoadTime(3), bugged: true, approach: { x: 4, z: -12.35, yaw: Math.PI } };
    renderer.update(journey, 3);
    const rolling = meetingCarPose(journey.meeting);
    assert.ok(vehicle.position.distanceTo(new THREE.Vector3(rolling.x, 0, rolling.z)) < .001, 'the rolling car body follows the passenger pose');
    delete journey.meeting; journey.bridgeArrival = { phase: 'parked', elapsed: 7, parkedRoadTime: 3 };
    renderer.update(journey, 15);
    const stopped = meetingCarPose({ phase: 'ready', elapsed: 0, roadTime: 3 });
    assert.ok(vehicle.position.distanceTo(new THREE.Vector3(stopped.x, 0, stopped.z)) < .001, 'the car remains at the new curb after Neo leaves');
    const door = (renderer as unknown as { door: THREE.Group }).door;
    journey.meeting = { phase: 'hesitating', elapsed: 2, roadTime: 3, bugged: true, approach: { x: 4, z: -12.35, yaw: Math.PI } };
    renderer.update(journey, 2); assert.ok(door.rotation.y < -.95, 'the right rear door remains open during Trinity’s appeal');
    journey.meeting.phase = 'reconsidering'; journey.meeting.elapsed = 0;
    renderer.update(journey, 2); assert.ok(door.rotation.y < -.95, 'trust begins with the same open door pose');
    journey.meeting.elapsed = 2;
    renderer.update(journey, 4); assert.ok(Math.abs(door.rotation.y) < .01, 'Neo shuts the door before examination');
  } finally { renderer.dispose(); globalThis.document = document; }
});

test('bridge puddles stay on the road as the car arrives and leaves, without covering the pavement', t => {
  t.mock.method(THREE.TextureLoader.prototype, 'load', () => new THREE.Texture());
  const renderer = new MeetingSetRenderer(new THREE.Group(), false);
  try {
    const reflection = (renderer as unknown as { reflection: THREE.Mesh<THREE.PlaneGeometry, THREE.ShaderMaterial> }).reflection;
    renderer.update(undefined, 0);
    const origin = reflection.position.clone();
    for (const elapsed of [0, 1.5, 4, 7]) {
      renderer.update({ scene: 'm1_bridge', bridgeArrival: { phase: 'approaching', elapsed } } as FilmJourney, elapsed);
      assert.ok(reflection.position.distanceTo(origin) < .001, 'standing water must not slide with the arriving vehicle');
    }
    renderer.update(undefined, 20, { phase: 'driving', elapsed: 20, role: 'neo', bugged: false });
    assert.ok(reflection.position.distanceTo(origin) < .001, 'driving away must not drag the reflection plane across the street');
    assert.ok(reflection.geometry.parameters.width <= MEETING_ROAD_WIDTH, 'the raised pavement must remain stone, not a rectangular mirror');
    assert.equal(reflection.material.transparent, true, 'asphalt must remain visible between shallow puddles');
    assert.equal(reflection.material.depthWrite, false, 'the water film must not occlude the road markings');
  } finally { renderer.dispose(); }
});

test('the meeting road loads asphalt maps together and ignores images finishing after leaving the set', t => {
  const loaded = new Map<string, { texture: THREE.Texture; finish: () => void }>();
  t.mock.method(THREE.TextureLoader.prototype, 'load', (url, onLoad) => {
    const texture = new THREE.Texture(); loaded.set(url, { texture, finish: () => onLoad?.(texture) }); return texture;
  });
  const parent = new THREE.Group(); const renderer = new MeetingSetRenderer(parent, false);
  const road = (): THREE.MeshStandardMaterial => {
    let material: THREE.MeshStandardMaterial | undefined;
    parent.traverse(object => { if (object instanceof THREE.Mesh && object.material.name === 'meeting-asphalt') material = object.material; });
    assert.ok(material, 'the meeting street needs a dedicated asphalt material'); return material;
  };
  try {
    const asphalt = road();
    const images = ['color', 'normal', 'roughness'].map(kind => loaded.get(`/assets/surfaces/asphalt_02-${kind}.jpg`)!);
    assert.ok(images.every(Boolean), 'wet asphalt cannot use an unrelated metal-plate normal map');
    assert.equal(asphalt.map, null);
    images[1].finish(); images[2].finish(); assert.equal(asphalt.normalMap, null, 'keep the fallback until the complete texture set is ready');
    images[0].finish();
    assert.equal(asphalt.map, images[0].texture); assert.equal(asphalt.normalMap, images[1].texture); assert.equal(asphalt.roughnessMap, images[2].texture);
    assert.equal(asphalt.map.colorSpace, THREE.SRGBColorSpace);
  } finally { renderer.dispose(); }
  const lateParent = new THREE.Group(); const late = new MeetingSetRenderer(lateParent, false);
  let lateRoad: THREE.MeshStandardMaterial | undefined;
  lateParent.traverse(object => { if (object instanceof THREE.Mesh && object.material.name === 'meeting-asphalt') lateRoad = object.material; });
  late.dispose(); loaded.forEach(image => image.finish());
  assert.ok(lateRoad); assert.equal(lateRoad.map, null, 'a departed set must not reattach disposed textures');
});

test('bridge runoff falls at both portals without synchronized diagonal bands', t => {
  t.mock.method(THREE.TextureLoader.prototype, 'load', () => new THREE.Texture());
  const renderer = new MeetingSetRenderer(new THREE.Group(), false);
  const rain = (renderer as unknown as { runoff: THREE.InstancedMesh<THREE.PlaneGeometry, THREE.ShaderMaterial> }).runoff;
  let released = 0;
  for (const resource of [rain, rain.geometry, rain.material]) resource.addEventListener('dispose', () => released++);
  try {
    const matrix = new THREE.Matrix4(); const samples: { x: number; phase: number }[] = [];
    const portals = new Set<number>();
    for (let i = 0; i < rain.count; i++) {
      rain.getMatrixAt(i, matrix); const position = new THREE.Vector3().setFromMatrixPosition(matrix);
      assert.ok(position.z <= -25 || position.z >= -3, 'the bridge vault must shelter the waiting player');
      portals.add(position.z < -14 ? 0 : 1);
      samples.push({ x: position.x, phase: rain.geometry.getAttribute('phase').getX(i) });
    }
    assert.equal(portals.size, 2);
    const meanX = samples.reduce((sum, sample) => sum + sample.x, 0) / samples.length;
    const meanPhase = samples.reduce((sum, sample) => sum + sample.phase, 0) / samples.length;
    const covariance = samples.reduce((sum, sample) => sum + (sample.x - meanX) * (sample.phase - meanPhase), 0);
    const varianceX = samples.reduce((sum, sample) => sum + (sample.x - meanX) ** 2, 0);
    const variancePhase = samples.reduce((sum, sample) => sum + (sample.phase - meanPhase) ** 2, 0);
    assert.ok(Math.abs(covariance / Math.sqrt(varianceX * variancePhase)) < .15, 'horizontal placement and falling time must be independent, or rain becomes a solid diagonal ribbon');
    renderer.update(undefined, 10, { phase: 'driving', elapsed: 10, role: 'neo', bugged: false });
    const car = meetingCarPose({ phase: 'driving', elapsed: 10, role: 'neo', bugged: false });
    assert.deepEqual(rain.material.uniforms.car.value.toArray(), [car.x, car.z, car.yaw], 'the passing car must mask rain out of its occupied cabin');
    renderer.update(undefined, 40, { phase: 'driving', elapsed: 40, role: 'neo', bugged: false });
    assert.equal(rain.visible, false, 'distant bridge spray must stop drawing once the car leaves the area');
  } finally { renderer.dispose(); assert.equal(released, 3, 'changing scenes releases the rain instances, geometry and shader'); }
});

test('the meeting sedan has actual wheel openings and its tires fit under the body', t => {
  t.mock.method(THREE.TextureLoader.prototype, 'load', () => new THREE.Texture());
  const renderer = new MeetingSetRenderer(new THREE.Group(), false);
  try {
    const vehicle = (renderer as unknown as { vehicle: THREE.Group }).vehicle;
    vehicle.updateWorldMatrix(true, true);
    const panels: THREE.Mesh[] = [];
    vehicle.traverse(object => { if (object instanceof THREE.Mesh && object.material instanceof THREE.MeshPhysicalMaterial && object.material.clearcoat === 1) panels.push(object); });
    const ray = new THREE.Raycaster();
    for (const side of [-1, 1]) for (const z of [-4.3, 4.6]) {
      ray.set(new THREE.Vector3(side * 4, 1.55, z), new THREE.Vector3(-side, 0, 0));
      const body = ray.intersectObjects(panels, false)[0];
      assert.ok(!body || Math.abs(body.point.x) < 2.32, 'painted box sides must not fill the wheel opening');
      ray.set(new THREE.Vector3(side * 4, 1.55, z < 0 ? -6.25 : 6.35), new THREE.Vector3(-side, 0, 0));
      assert.ok(Math.abs(ray.intersectObjects(panels, false)[0]?.point.x ?? 0) > 2.5, 'the fender remains solid outside the wheel opening');
    }
    const wheels = (renderer as unknown as { wheels: { steering: THREE.Group }[] }).wheels;
    for (const { steering } of wheels) {
      const bounds = new THREE.Box3().setFromObject(steering);
      assert.ok(bounds.min.x >= -MEETING_CAR.width / 2 - .02 && bounds.max.x <= MEETING_CAR.width / 2 + .02,
        'the tires sit inside the collision width, rather than protruding from box sides');
    }
  } finally { renderer.dispose(); }
});

test('window trim stays on the glass perimeter instead of bowing above the roof', t => {
  t.mock.method(THREE.TextureLoader.prototype, 'load', () => new THREE.Texture());
  const renderer = new MeetingSetRenderer(new THREE.Group(), false); const trim = new THREE.Group();
  try {
    const points = [[2.5, 2.7, -3.32], [2.5, 2.7, -.15], [2.28, 4.13, -.15], [2.23, 4.13, -2.53]];
    (renderer as unknown as { trim: (parent: THREE.Group, material: THREE.Material, points: number[][], radius: number) => void })
      .trim(trim, new THREE.MeshStandardMaterial(), [...points, points[0]], .028);
    const bounds = new THREE.Box3().setFromObject(trim);
    assert.ok(bounds.max.y < 4.17 && bounds.min.y > 2.66, 'a rounded spline must not create floating chrome arches above or below the window');
    assert.ok(bounds.min.z > -3.36 && bounds.max.z < -.11, 'the side rails follow the slanted glass edges');
  } finally { renderer.dispose(); }
});

test('the cabin lamp lights passengers without illuminating its own diffuser and headliner', t => {
  t.mock.method(THREE.TextureLoader.prototype, 'load', () => new THREE.Texture());
  const renderer = new MeetingSetRenderer(new THREE.Group(), false);
  try {
    const vehicle = (renderer as unknown as { vehicle: THREE.Group }).vehicle;
    const light = vehicle.children.find(child => child instanceof THREE.Light && child.position.distanceTo(new THREE.Vector3(0, 3.95, .2)) < .01);
    assert.ok(light instanceof THREE.SpotLight, 'the ceiling light must direct its spill down, rather than burn out the headliner above it');
    assert.ok(light.target.position.y < 2 && light.angle < Math.PI / 2);
    let diffuser: THREE.Material | undefined;
    vehicle.traverse(object => {
      if (!(object instanceof THREE.Mesh)) return;
      object.geometry.computeBoundingBox();
      const center = object.geometry.boundingBox!.getCenter(new THREE.Vector3());
      if (center.distanceTo(new THREE.Vector3(0, 4.005, .1)) < .015) diffuser = object.material as THREE.Material;
    });
    assert.ok(diffuser instanceof THREE.MeshBasicMaterial && diffuser.toneMapped, 'the emitting cover has bounded brightness independent of the adjacent light source');
  } finally { renderer.dispose(); }
});

test('the dashboard stays behind the windshield instead of sitting on the bonnet', t => {
  t.mock.method(THREE.TextureLoader.prototype, 'load', () => new THREE.Texture());
  const renderer = new MeetingSetRenderer(new THREE.Group(), false);
  try {
    const vehicle = (renderer as unknown as { vehicle: THREE.Group }).vehicle;
    vehicle.updateWorldMatrix(true, true);
    const ray = new THREE.Raycaster(new THREE.Vector3(0, 2.63, -6), new THREE.Vector3(0, 0, 1));
    const hit = ray.intersectObject(vehicle, true)[0];
    // The thin rubber seal extends .07 ahead of the pane at z = -3.49.
    assert.ok(!hit || hit.point.z >= -3.57, 'the cowl must stay below the glazing; a cabin dashboard cannot protrude onto the bonnet');
  } finally { renderer.dispose(); }
});

test('the passenger fill light stays clear of the opening rear door', t => {
  t.mock.method(THREE.TextureLoader.prototype, 'load', () => new THREE.Texture());
  const renderer = new MeetingSetRenderer(new THREE.Group(), false);
  try {
    const { vehicle, door } = renderer as unknown as { vehicle: THREE.Group; door: THREE.Group };
    const fill = vehicle.children.find(child => child instanceof THREE.PointLight && child.color.getHex() === 0xb9d2d1);
    assert.ok(fill instanceof THREE.PointLight);
    for (const elapsed of [0, .5, 1, 2]) {
      renderer.update(undefined, elapsed, { phase: 'hesitating', elapsed, role: 'neo', bugged: false });
      vehicle.updateWorldMatrix(true, true);
      const distance = new THREE.Box3().setFromObject(door).distanceToPoint(fill.getWorldPosition(new THREE.Vector3()));
      assert.ok(distance > 2, 'the moving window frame must not pass through its fill light and bloom into a white patch');
    }
  } finally { renderer.dispose(); }
});

test('the reshaped rear window still clears Trinity’s scanner when she discards the tracker', t => {
  t.mock.method(THREE.TextureLoader.prototype, 'load', () => new THREE.Texture());
  const renderer = new MeetingSetRenderer(new THREE.Group(), false);
  try {
    const window = (renderer as unknown as { window: THREE.Mesh }).window;
    renderer.update(undefined, 1, { phase: 'discarding', elapsed: 1, role: 'neo', bugged: true });
    window.updateWorldMatrix(true, true);
    assert.ok(new THREE.Box3().setFromObject(window).max.y < 2.85, 'the lowered glass must be below the scanner passage at y = 3');
    renderer.update(undefined, 2, { phase: 'choice', elapsed: 0, role: 'neo', bugged: true });
    window.updateWorldMatrix(true, true);
    assert.ok(new THREE.Box3().setFromObject(window).max.y > 4.1, 'a restarted encounter restores the closed window');
  } finally { renderer.dispose(); }
});
