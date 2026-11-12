import assert from 'node:assert/strict';
import test, { type TestContext } from 'node:test';
import * as THREE from 'three';
import { FILM_SCENE_BY_ID, FILM_SETS, OPENING_HOTEL, filmEntry, type FilmJourney, type OpeningPhoneEncounter, type SandboxState } from '@auto_matrix/shared';
import { AgentRenderer } from '../packages/client/src/agents/AgentRenderer.js';
import { FilmSetRenderer } from '../packages/client/src/engine/FilmSetRenderer.js';
import { LightCulling } from '../packages/client/src/engine/LightCulling.js';
import { AgentManager } from '../packages/server/src/agents/AgentManager.js';
import { WorldState } from '../packages/server/src/world/WorldState.js';

function fixture(t: TestContext, destination: 'm1_roofs' | 'm1_phone_escape', deferRoofMaps = false, visiting = false) {
  const roofs = destination === 'm1_roofs', next = FILM_SCENE_BY_ID[destination];
  const landmark = roofs ? 'opening-roof-window-glass' : 'wells-asphalt';
  const previous = globalThis.document;
  globalThis.document = { createElement: () => ({ getContext: () => ({ fillRect() {}, strokeRect() {}, fillText() {} }) }) } as unknown as Document;
  let defer = false;
  const pendingImages: (() => void)[] = [];
  t.mock.method(THREE.TextureLoader.prototype, 'load', (_url: string, load?: (texture: THREE.Texture) => void) => {
    const texture = new THREE.Texture();
    const ready = () => { texture.image = { width: 256, height: 256, complete: true }; texture.needsUpdate = true; load?.(texture); };
    if (defer) pendingImages.push(ready);
    else ready();
    return texture;
  });
  const scene = new THREE.Scene(), film = new FilmSetRenderer(scene), camera = new THREE.PerspectiveCamera();
  scene.environment = new THREE.Texture(); scene.fog = new THREE.FogExp2();
  const sun = new THREE.DirectionalLight(); sun.castShadow = true;
  scene.add(sun, new THREE.DirectionalLight(), new THREE.HemisphereLight());
  const world = new WorldState(); new AgentManager(world).initializeAllAgents();
  const player = world.agents.get('trinity')!, from = FILM_SCENE_BY_ID[visiting ? 'm1_wake_up' : roofs ? 'm1_room303' : 'm1_roofs'];
  Object.assign(player, { position: filmEntry(from), currentLocation: from.set, isInMatrix: true });
  const journey: FilmJourney = { version: 1, scene: from.id, actor: 'trinity', step: visiting ? 0 : roofs ? 6 : 2, completed: visiting ? [destination] : [], enteredAt: 0,
    reflections: {}, lastText: '', checkpoint: filmEntry(from),
    ...(roofs ? { openingHotel: { phase: 'climbing', elapsed: 0, lastTick: 0, attempts: 0, disarmed: true, ammo: 0, shots: 0, climbed: 2 } }
      : { openingRoof: { phase: 'running', lastTick: 0, attempts: 0, crossed: true } }),
  };
  const sandbox = { neoLife: { journey }, structures: [] } as unknown as SandboxState;
  film.update(player, sandbox, 0);
  defer = deferRoofMaps;
  const hero = new THREE.Group(), texture = new THREE.Texture({ width: 2048, height: 2048, complete: true });
  texture.needsUpdate = true; hero.visible = false; scene.add(hero);
  const material = new THREE.MeshStandardMaterial({ map: texture }), geometry = new THREE.BoxGeometry();
  const skin = new THREE.SkinnedMesh(geometry, material); skin.visible = false; skin.castShadow = true; hero.add(skin);
  const actors = new Map([[roofs ? 'agent_brown' : 'trinity', hero]]);
  const shadowMaterial = new THREE.MeshBasicMaterial({ transparent: true }), shadow = new THREE.Mesh(geometry, shadowMaterial);
  shadow.visible = false; scene.add(shadow);
  const lighting = new LightCulling(scene);
  lighting.minimumPointSlots = film.minimumPointSlots;
  lighting.stablePointSlots = film.stablePointSlots;
  const programs: { program: object; isReady(): boolean; getUniforms(): void }[] = [];
  const work: string[] = [], meshes = new Set<THREE.Object3D>(), roots = new Set<THREE.Object3D>();
  const depths = new Map<number, THREE.Mesh[]>(), mapped = new Set<THREE.Mesh>();
  const roofRetry = () => film.active?.id === 'film_hotel_roofs' && journey.scene === 'm1_roofs'
    && !journey.visiting && journey.openingRoof?.phase === 'failed';
  let target: THREE.WebGLRenderTarget | null = null, uploaded = new WeakMap<THREE.Texture, number>();
  const properties = () => ({ get: (map: THREE.Texture) => ({ __version: uploaded.get(map) }) });
  const gpu = { properties: properties(), info: { programs }, debug: { checkShaderErrors: true }, extensions: { has: () => true },
    shadowMap: { enabled: roofs, type: THREE.PCFSoftShadowMap },
    getContext: () => ({ LINK_STATUS: 0x8b82, getProgramParameter: () => true }), getRenderTarget: () => target,
    setRenderTarget: (value: typeof target) => { target = value; },
    compile(subject: THREE.Object3D, eye: THREE.Camera, colors: THREE.Scene) {
      assert.notEqual(colors, scene);
      const batch: THREE.Object3D[] = []; subject.traverse(object => batch.push(object));
      assert.ok(batch.length > 0 && batch.length <= 4); assert.equal(target?.width, 1);
      const lights: THREE.Light[] = []; colors.traverseVisible(object => { if (object instanceof THREE.Light) lights.push(object); });
      const points = lights.filter(light => light instanceof THREE.PointLight).length;
      programs.push({ program: {}, isReady: () => true, getUniforms: () => { work.push('bindings'); } }); work.push('compile');
      if (batch.every(mesh => mesh instanceof THREE.Mesh && mesh.material instanceof THREE.MeshDepthMaterial)) {
        assert.equal(colors.environment, null); assert.equal(colors.fog, null);
        depths.set(points, [...(depths.get(points) ?? []), ...batch as THREE.Mesh[]]);
        return;
      }
      assert.equal(colors.environment, scene.environment); assert.equal(colors.fog, scene.fog);
      if (roofRetry()) {
        assert.equal(eye, camera);
        assert.equal(scene.getObjectByName('opening-roof-window-glass')?.parent, film.root);
      } else {
        assert.ok(eye.position.distanceTo(new THREE.Vector3().copy(filmEntry(next))) < 20);
        let root: THREE.Object3D | undefined;
        colors.traverseVisible(object => { if (object instanceof THREE.Group && object.parent instanceof THREE.Scene && object.getObjectByName(landmark)) root = object; });
        assert.ok(root); roots.add(root);
      }
      assert.equal(scene.getObjectByName(landmark), undefined, 'the next scene stays detached');
      assert.equal(points, roofs || roofRetry() ? 4 : 7);
      assert.equal(lights.filter(light => light instanceof THREE.SpotLight).length, roofs || roofRetry() ? 0 : 3);
      assert.equal(lights.filter(light => light instanceof THREE.DirectionalLight && light.castShadow).length, 1);
      for (const object of batch) {
        meshes.add(object);
        if (object instanceof THREE.Mesh && object.material instanceof THREE.MeshStandardMaterial
          && object.material.normalMap?.image && object.material.roughnessMap?.image) mapped.add(object);
      }
    },
    initTexture(map: THREE.Texture) { uploaded.set(map, map.version); work.push('texture'); },
  } as unknown as THREE.WebGLRenderer;
  const prepare = (resumeRoof = false) => {
    const before = work.length, live = film.root.children.slice();
    film.prepareOpening(gpu, camera, journey, id => actors.get(id), shadow, lighting, undefined, resumeRoof);
    assert.ok(work.length - before <= (roofRetry() || resumeRoof ? 2 : 1), 'preparation budgets GPU work per frame');
    assert.deepEqual(film.root.children, live); assert.equal(target, null); assert.equal(gpu.debug.checkShaderErrors, true);
    assert.equal(hero.parent, scene); assert.equal(skin.visible || hero.visible || shadow.visible, false);
  };
  const drain = () => { for (let frame = 0; frame < 250; frame++) prepare(); };
  const enter = () => {
    Object.assign(player, { position: filmEntry(next), currentLocation: next.set });
    if (visiting) journey.visiting = next.id;
    else Object.assign(journey, { scene: next.id, step: 0 });
    film.update(player, sandbox, 0);
  };
  const livePointSlots = () => {
    film.update(player, sandbox, 0);
    const culling = new LightCulling(scene);
    culling.minimumPointSlots = film.minimumPointSlots; culling.stablePointSlots = film.stablePointSlots;
    const entry = filmEntry(from);
    camera.position.set(entry.x, entry.y + 6, entry.z + 11); camera.lookAt(entry.x, entry.y + 2, entry.z - 2);
    scene.updateMatrixWorld(); camera.updateMatrixWorld();
    try {
      scene.onBeforeRender(gpu, scene, camera, null);
      let count = 0; scene.traverseVisible(object => { if (object instanceof THREE.PointLight) count++; });
      return count;
    } finally { culling.dispose(); }
  };
  const nextMesh = () => {
    const root = [...roots][0], node = root?.getObjectByName(landmark);
    return (roofs ? node?.children[0] : node) as THREE.Mesh | undefined;
  };
  t.after(() => { film.dispose(); lighting.dispose(); material.dispose(); geometry.dispose(); shadowMaterial.dispose(); texture.dispose(); scene.environment!.dispose(); globalThis.document = previous; });
  return { film, journey, gpu, skin, shadow, material, actors, work, meshes, roots, depths, mapped, programs, prepare, drain, enter, nextMesh, livePointSlots,
    requestVisit: () => {
      hero.visible = skin.visible = true;
      return film.beginOpeningVisit(gpu, camera, destination, player.id, [hero], lighting, sun);
    },
    decodeRoofMaps: () => { defer = false; pendingImages.splice(0).forEach(ready => ready()); },
    replaceGpu: () => { uploaded = new WeakMap(); gpu.properties = properties() as THREE.WebGLRenderer['properties']; } };
}

test('a requested opening revisit adopts its prepared room and releases a cancelled visit', t => {
  const h = fixture(t, 'm1_phone_escape', false, true), saved = structuredClone(h.journey);
  const finish = () => {
    const request = h.requestVisit();
    for (let frame = 0; frame < 350; frame++) {
      const before = h.work.length, ready = request.step();
      assert.ok(h.work.length - before <= 1);
      assert.deepEqual(h.journey, saved);
      if (ready) return request;
    }
    assert.fail('the requested scene should finish preparation');
  };
  const cancelled = finish(), abandoned = h.nextMesh()!;
  let disposals = 0; abandoned.geometry.addEventListener('dispose', () => disposals++);
  cancelled.cancel(); cancelled.cancel(); assert.equal(disposals, 1);
  assert.equal(h.film.currentScene, 'm1_wake_up');
  h.roots.clear(); finish(); const staged = h.nextMesh()!;
  assert.notEqual(staged, abandoned);
  let releases = 0; staged.geometry.addEventListener('dispose', () => releases++);
  h.enter();
  assert.equal(h.film.root.getObjectByName('wells-asphalt'), staged);
  assert.equal(h.journey.scene, saved.scene); assert.deepEqual(h.journey.completed, saved.completed);
  assert.equal(releases, 0);
  h.film.update(undefined, undefined, 0); assert.equal(releases, 1);
});

for (const next of ['m1_roofs', 'm1_phone_escape'] as const) {
  test(`${next} builds and prepares the real room and entering cast before adopting them`, t => {
    const h = fixture(t, next), saved = structuredClone(h.journey);
    h.drain(); assert.deepEqual(h.journey, saved);
    assert.equal(h.roots.size, 1, 'the next room must be built offstage');
    assert.ok(h.meshes.has(h.skin) && h.meshes.has(h.shadow) && h.meshes.has(h.film.goalMarker));
    if (next === 'm1_phone_escape') assert.ok([...h.meshes].some(mesh => mesh.name === 'opening-phone-cord'));
    assert.match(h.material.customProgramCacheKey(), /actor-local-skin-v1$/);
    assert.equal(h.work.filter(task => task === 'texture').length, 1);
    const before = h.work.length; h.drain(); assert.equal(h.work.length, before);
    h.replaceGpu(); h.drain(); assert.ok(h.work.length > before); assert.equal(h.roots.size, 1);
    const mesh = h.nextMesh()!; let disposed = 0; mesh.geometry.addEventListener('dispose', () => disposed++);
    h.enter();
    assert.equal(h.film.root.getObjectById(mesh.id), mesh); assert.equal(disposed, 0);
    h.film.update(undefined, undefined, 0); assert.equal(disposed, 1);
  });
}

test('the 303 cut waits a frame before reflecting the linked roof program', t => {
  const h = fixture(t, 'm1_roofs');
  for (let frame = 0; !h.programs.length && frame < 250; frame++) h.prepare();
  const program = h.programs[0];
  assert.ok(program);
  let frame = 0, readyAt = -1, reflectedAt = -1;
  t.mock.method(program, 'isReady', () => { readyAt = frame; return true; });
  t.mock.method(program, 'getUniforms', () => { reflectedAt = frame; });

  for (; reflectedAt < 0 && frame < 250; frame++) h.prepare();
  assert.ok(readyAt >= 0 && reflectedAt > readyAt, 'read bindings on a later frame than the completion check');
});

test('the 303 cut prepares both shadow layouts while the roof images decode', t => {
  const h = fixture(t, 'm1_roofs', true); h.drain();
  assert.deepEqual([...h.depths.keys()].sort((a, b) => a - b), [4, 13]);
  const cast = new Set<THREE.Material>();
  for (const proxies of h.depths.values()) {
    assert.ok(proxies.some(mesh => mesh.geometry === h.nextMesh()!.geometry));
    const skin = proxies.find(mesh => mesh instanceof THREE.SkinnedMesh && mesh.geometry === h.skin.geometry);
    assert.ok(skin?.material instanceof THREE.MeshDepthMaterial);
    assert.equal(skin.material.depthPacking, THREE.RGBADepthPacking); cast.add(skin.material);
  }
  assert.equal(h.mapped.size, 0);
  h.decodeRoofMaps(); h.drain();
  assert.ok(h.mapped.size > 0, 'prepare the actual roof surfaces after their maps attach');
  let released = 0;
  for (const material of cast) material.addEventListener('dispose', () => released++);
  h.enter(); assert.equal(released, 0, 'keep the linked variants through the cut');
  h.film.update(undefined, undefined, 0); assert.equal(released, cast.size);
});

test('the roof prepares the actual materials of both officers following Brown', t => {
  const h = fixture(t, 'm1_roofs');
  const officers = OPENING_HOTEL.officers.map(({ id }) => {
    const hero = new THREE.Group(), material = new THREE.MeshPhysicalMaterial(), mesh = new THREE.SkinnedMesh(h.skin.geometry, material);
    t.after(() => material.dispose());
    hero.visible = false; hero.add(mesh); h.actors.set(id, hero);
    return { hero, mesh };
  });
  h.drain();
  for (const { hero, mesh } of officers) {
    assert.ok(h.meshes.has(mesh), 'the live officer material must be linked before the cut');
    assert.equal(mesh.parent, hero); assert.equal(hero.visible, false);
    assert.match(mesh.material.customProgramCacheKey(), /actor-local-skin-v1$/);
  }
});

test('the roof uploads a large cast texture in strips and releases the partial texture on entry', t => {
  class Bitmap { width = 2048; height = 2048; }
  const previous = globalThis.ImageBitmap;
  globalThis.ImageBitmap = Bitmap as unknown as typeof ImageBitmap;
  t.after(() => {
    if (previous) globalThis.ImageBitmap = previous;
    else Reflect.deleteProperty(globalThis, 'ImageBitmap');
  });
  const h = fixture(t, 'm1_roofs'), texture = h.material.map!, image = new Bitmap();
  texture.image = image; texture.flipY = false;
  const source = texture.source, allocations: THREE.Texture[] = [], releases: THREE.Texture[] = [];
  const residency = new WeakMap<THREE.Texture, { __webglTexture: object; __version: number }>();
  const strips: number[] = [];
  Object.assign(h.gpu, {
    capabilities: { maxTextureSize: 4096 }, properties: { get: (map: THREE.Texture) => residency.get(map) ?? {} },
    state: { bindTexture() {}, unbindTexture() {} },
    getContext: () => ({ LINK_STATUS: 0x8b82, getProgramParameter: () => true, pixelStorei() {},
      texSubImage2D(_target: number, _level: number, _x: number, row: number, width: number, height: number,
        _format: number, _type: number, bitmap: Bitmap) {
        assert.equal(bitmap, image); assert.deepEqual([row, width, height], [0, 2048, 256]);
        strips.push(height); h.work.push('strip');
      },
    }),
    initTexture(map: THREE.Texture) {
      residency.set(map, { __webglTexture: {}, __version: map.version });
      allocations.push(map); map.addEventListener('dispose', () => releases.push(map));
      if (map.source.dataReady) h.work.push('texture');
    },
  });
  for (let frame = 0; frame < 250 && !allocations.length; frame++) h.prepare();
  assert.deepEqual(strips, [256]);
  assert.equal(allocations.length, 1); assert.notEqual(allocations[0], texture);
  assert.equal(texture.source, source); assert.equal(residency.has(texture), false);
  h.enter();
  assert.deepEqual(releases, allocations); assert.equal(texture.source, source);
  assert.ok(h.film.root.getObjectByName('opening-roof-window-glass'));
});

test('a failed roof attempt or visit releases the detached Wells assets exactly once', t => {
  const h = fixture(t, 'm1_phone_escape');
  h.journey.visiting = 'm1_roofs'; h.drain(); assert.deepEqual(h.work, []); delete h.journey.visiting;
  h.drain(); const mesh = h.nextMesh()!; assert.ok(mesh);
  let disposed = 0; mesh.geometry.addEventListener('dispose', () => disposed++);
  h.journey.openingRoof!.phase = 'failed'; h.prepare(); h.prepare(); assert.equal(disposed, 1);
  h.enter(); assert.notEqual(h.film.root.getObjectByName('wells-asphalt'), mesh);
});

test('a cold roof failure prepares the live rooftop and Brown before the retry', t => {
  const h = fixture(t, 'm1_phone_escape');
  const brown = new THREE.Group(), jacket = new THREE.SkinnedMesh(h.skin.geometry, h.material);
  brown.visible = false; brown.add(jacket); h.actors.set('agent_brown', brown);
  h.journey.openingRoof!.phase = 'failed';
  const saved = structuredClone(h.journey), pane = h.film.root.getObjectByName('opening-roof-window-glass')!.children[0];
  h.prepare();
  assert.equal(h.work.length, 0, 'the first failure frame draws before preparing the retry');
  h.drain();
  assert.ok(h.meshes.has(jacket), 'Brown uses his existing material after the camera returns to the roof');
  assert.ok(h.meshes.has(pane) && h.meshes.has(h.film.goalMarker));
  const normalMeshes = h.film.openingRoofRetryNormalMeshes;
  assert.ok(normalMeshes?.includes(jacket), 'the same skinned mesh prepares the occlusion pass');
  h.prepare(); assert.equal(h.film.openingRoofRetryNormalMeshes, normalMeshes);
  assert.equal(h.work.filter(task => task === 'texture').length, 1);
  assert.equal(jacket.parent, brown); assert.equal(brown.visible, false);
  assert.equal(h.film.root.getObjectById(pane.id), pane);
  assert.deepEqual(h.journey, saved);
  const tasks = h.work.length;
  h.journey.openingRoof!.phase = 'running'; h.journey.step = 0;
  h.drain(); assert.equal(h.work.length, tasks);
  assert.equal(h.film.openingRoofRetryNormalMeshes, undefined);
});

test('the roof keeps its shader light count when the exit removes the objective', t => {
  const h = fixture(t, 'm1_phone_escape');
  assert.equal(h.livePointSlots(), 4);
  h.journey.step = 3; h.journey.openingRoof!.phase = 'escaped';
  assert.equal(h.livePointSlots(), 4, 'the three real floods must keep the same layout after the goal light goes out');
});

test('a saved roof prepares the set before taking control and adopts that same set on entry', t => {
  const h = fixture(t, 'm1_roofs');
  h.skin.name = 'short04';
  h.journey.scene = 'm1_roofs'; h.journey.step = 1;
  h.journey.openingRoof = { phase: 'failed', lastTick: 0, attempts: 1 };
  const sandbox = { neoLife: { journey: h.journey }, structures: [] } as unknown as SandboxState;
  h.film.update(undefined, sandbox, 0);
  h.prepare(true);
  assert.deepEqual(h.work, ['texture'], 'the shared hair map can start uploading as the set is built');
  for (let frame = 0; frame < 250; frame++) h.prepare(true);
  const pane = h.nextMesh();
  assert.ok(pane && h.meshes.has(h.skin), 'prepare the actual roof and pursuit materials before possession');
  assert.equal(h.film.active, undefined);
  h.enter(); assert.equal(h.film.root.getObjectById(pane.id), pane);
  assert.equal(h.journey.openingRoof.phase, 'failed');
});

test('an early cut finishes the Wells booth without waiting for parallel shader support', t => {
  const h = fixture(t, 'm1_phone_escape');
  h.gpu.extensions.has = () => false;
  h.prepare(); h.enter();
  assert.ok(h.film.root.getObjectByName('wells-asphalt'));
  assert.ok(h.film.root.getObjectByName('opening-booth-intact-pane')?.visible);
  assert.deepEqual(h.work, []);
});

test('Wells prepares the investigating cast maps and buffers during the answer and releases a failed attempt', t => {
  class Bitmap { width = 2048; height = 2048; }
  const previous = globalThis.ImageBitmap;
  globalThis.ImageBitmap = Bitmap as unknown as typeof ImageBitmap;
  const hero = new THREE.Group(), geometry = new THREE.BoxGeometry(), camera = new THREE.PerspectiveCamera();
  const [skin, suit, hair] = ['Anatomical_head_and_hands', 'Tailored_coat_upper', 'short04'].map(name => {
    const texture = new THREE.Texture(new Bitmap()); texture.flipY = false; texture.needsUpdate = true;
    const mesh = new THREE.SkinnedMesh(geometry, new THREE.MeshStandardMaterial({ map: texture }));
    mesh.name = name; hero.add(mesh); return texture;
  });
  hero.visible = false;
  const smith = new THREE.Group(), brown = new THREE.Group();
  const smithMesh = new THREE.Mesh(new THREE.BoxGeometry()), brownMesh = new THREE.Mesh(new THREE.BoxGeometry());
  smith.add(smithMesh); brown.add(brownMesh);
  const actors = new Map([['agent_jones', hero], ['smith', smith], ['agent_brown', brown]]);
  const agents = Object.assign(Object.create(AgentRenderer.prototype), { getAgentHero: (id: string) => actors.get(id) }) as AgentRenderer;
  const phone: OpeningPhoneEncounter = { phase: 'running', remaining: 7, lastTick: 0, attempts: 0 };
  const prepare = () => agents.prepareWellsCast(renderer, camera, phone);
  t.after(() => {
    agents.prepareWellsCast(renderer, camera); geometry.dispose(); skin.dispose(); suit.dispose(); hair.dispose();
    for (const mesh of [smithMesh, brownMesh]) { mesh.geometry.dispose(); mesh.material.dispose(); }
    hero.children.forEach(mesh => (mesh as THREE.Mesh<THREE.BufferGeometry, THREE.Material>).material.dispose());
    if (previous) globalThis.ImageBitmap = previous;
    else Reflect.deleteProperty(globalThis, 'ImageBitmap');
  });
  type Upload = { texture: THREE.Texture; rows: number; mipmaps: boolean };
  const allocations: Upload[] = [], disposed: THREE.Texture[] = [], bySource = new Map<THREE.Source, Upload>();
  const gpu = new Map<THREE.Texture, { __webglTexture: Upload }>();
  const staged = new Set<THREE.BufferGeometry>();
  const target = new THREE.WebGLRenderTarget(32, 32);
  let activeTarget: THREE.WebGLRenderTarget | null = target;
  t.after(() => target.dispose());
  let bound: Upload | undefined, skipRows = 0;
  const gl = {
    TEXTURE_2D: 0x0de1, UNPACK_SKIP_ROWS: 0x0cf3, RGBA: 0x1908, UNSIGNED_BYTE: 0x1401,
    pixelStorei: (_parameter: number, value: number) => { skipRows = value; },
    texSubImage2D(_target: number, _level: number, _x: number, y: number, width: number, height: number,
      _format: number, _type: number, image: Bitmap) {
      assert.ok(bound); assert.equal(bound.texture.image, image);
      assert.deepEqual([y, width, height, bound.rows], [skipRows, 2048, 256, y]);
      bound.rows += height;
    },
    generateMipmap() { assert.ok(bound); assert.equal(bound.rows, 2048); bound.mipmaps = true; },
  };
  const renderer = { capabilities: { maxTextureSize: 4096 }, getContext: () => gl,
    autoClear: true, sortObjects: true, getRenderTarget: () => activeTarget,
    getActiveCubeFace: () => 0, getActiveMipmapLevel: () => 0,
    setRenderTarget: (next: typeof activeTarget) => { activeTarget = next; },
    render(view: THREE.Scene) {
      assert.equal(activeTarget?.width, 1);
      assert.ok(view.children.length <= 4);
      for (const mesh of view.children) {
        assert.ok(mesh instanceof THREE.Mesh && mesh.material.visible === false);
        assert.equal(mesh.frustumCulled, false);
        staged.add(mesh.geometry);
      }
    },
    properties: { get: (texture: THREE.Texture) => gpu.get(texture) ?? {} },
    state: { bindTexture: (_target: number, upload: Upload) => { bound = upload; }, unbindTexture: () => { bound = undefined; } },
    initTexture(texture: THREE.Texture) {
      let upload = bySource.get(texture.source);
      if (!upload) {
        assert.equal(texture.source.dataReady, false, 'the cut must never start a synchronous upload');
        upload = { texture, rows: 0, mipmaps: false }; allocations.push(upload); bySource.set(texture.source, upload);
      }
      gpu.set(texture, { __webglTexture: upload });
      texture.addEventListener('dispose', () => { gpu.delete(texture); disposed.push(texture); });
    },
  } as unknown as THREE.WebGLRenderer;

  const source = skin.source, suitSource = suit.source;
  assert.equal(prepare(), false); assert.equal(allocations.length, 0);
  phone.phase = 'answering'; prepare();
  assert.equal(allocations[0]?.rows, 256, 'begin the first cast map while Trinity lifts the handset');
  assert.equal(skin.source, source); assert.equal(gpu.has(skin), false);
  phone.phase = 'failed'; assert.equal(prepare(), false);
  assert.deepEqual(disposed, [allocations[0].texture]); assert.equal(gpu.has(skin), false);

  phone.attempts++; phone.phase = 'answering';
  for (let i = 0; i < 8; i++) {
    assert.equal(prepare(), true); assert.equal(allocations[1].rows, 256 * (i + 1));
  }
  assert.equal(allocations[1].mipmaps, true); assert.equal(gpu.get(skin)?.__webglTexture, allocations[1]);
  assert.equal(suit.source, suitSource); assert.equal(gpu.has(suit), false);
  phone.phase = 'connected';
  for (let i = 0; i < 8; i++) {
    assert.equal(prepare(), true); assert.equal(allocations[2].rows, 256 * (i + 1));
  }
  assert.equal(allocations[2].mipmaps, true); assert.equal(gpu.get(suit)?.__webglTexture, allocations[2]);
  for (let i = 0; i < 8; i++) {
    assert.equal(prepare(), true); assert.equal(allocations[3].rows, 256 * (i + 1));
  }
  assert.equal(allocations[3].mipmaps, true); assert.equal(gpu.get(hair)?.__webglTexture, allocations[3]);
  const material = smithMesh.material;
  for (let frame = 0; frame < 15 && prepare(); frame++);
  assert.deepEqual(staged, new Set([geometry, smithMesh.geometry, brownMesh.geometry]));
  assert.equal(smithMesh.material, material); assert.equal(smithMesh.parent, smith);
  assert.equal(activeTarget, target); assert.equal(renderer.autoClear, true); assert.equal(renderer.sortObjects, true);
  assert.deepEqual(disposed, allocations.map(upload => upload.texture));
  assert.equal(prepare(), false); assert.equal(allocations.length, 4); assert.equal(hero.visible, false);
  assert.equal(bound, undefined); assert.equal(skipRows, 0);
});
