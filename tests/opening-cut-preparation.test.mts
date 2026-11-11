import assert from 'node:assert/strict';
import test, { type TestContext } from 'node:test';
import * as THREE from 'three';
import { FILM_SCENE_BY_ID, FILM_SETS, filmEntry, type FilmJourney, type OpeningPhoneEncounter, type SandboxState } from '@auto_matrix/shared';
import { AgentRenderer } from '../packages/client/src/agents/AgentRenderer.js';
import { FilmSetRenderer } from '../packages/client/src/engine/FilmSetRenderer.js';
import { LightCulling } from '../packages/client/src/engine/LightCulling.js';
import { AgentManager } from '../packages/server/src/agents/AgentManager.js';
import { WorldState } from '../packages/server/src/world/WorldState.js';

function fixture(t: TestContext, destination: 'm1_roofs' | 'm1_phone_escape', deferRoofMaps = false) {
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
  const player = world.agents.get('trinity')!, from = FILM_SCENE_BY_ID[roofs ? 'm1_room303' : 'm1_roofs'];
  Object.assign(player, { position: filmEntry(from), currentLocation: from.set, isInMatrix: true });
  const journey: FilmJourney = { version: 1, scene: from.id, actor: 'trinity', step: roofs ? 6 : 2, completed: [], enteredAt: 0,
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
  const shadowMaterial = new THREE.MeshBasicMaterial({ transparent: true }), shadow = new THREE.Mesh(geometry, shadowMaterial);
  shadow.visible = false; scene.add(shadow);
  const lighting = new LightCulling(scene);
  lighting.minimumPointSlots = film.minimumPointSlots;
  lighting.stablePointSlots = film.stablePointSlots;
  const programs: { program: object; isReady(): boolean; getUniforms(): void }[] = [];
  const work: string[] = [], meshes = new Set<THREE.Object3D>(), roots = new Set<THREE.Object3D>();
  const depths = new Map<number, THREE.Mesh[]>(), mapped = new Set<THREE.Mesh>();
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
      assert.ok(eye.position.distanceTo(new THREE.Vector3().copy(filmEntry(next))) < 20);
      let root: THREE.Object3D | undefined;
      colors.traverseVisible(object => { if (object instanceof THREE.Group && object.parent instanceof THREE.Scene && object.getObjectByName(landmark)) root = object; });
      assert.ok(root); roots.add(root);
      assert.equal(scene.getObjectByName(landmark), undefined, 'the next scene stays detached');
      assert.equal(points, roofs ? 4 : 7);
      assert.equal(lights.filter(light => light instanceof THREE.SpotLight).length, roofs ? 0 : 3);
      assert.equal(lights.filter(light => light instanceof THREE.DirectionalLight && light.castShadow).length, 1);
      for (const object of batch) {
        meshes.add(object);
        if (object instanceof THREE.Mesh && object.material instanceof THREE.MeshStandardMaterial
          && object.material.normalMap?.image && object.material.roughnessMap?.image) mapped.add(object);
      }
    },
    initTexture(map: THREE.Texture) { uploaded.set(map, map.version); work.push('texture'); },
  } as unknown as THREE.WebGLRenderer;
  const prepare = () => {
    const before = work.length, live = film.root.children.slice();
    film.prepareOpening(gpu, camera, journey, id => id === (roofs ? 'agent_brown' : 'trinity') ? hero : undefined, shadow, lighting);
    assert.ok(work.length - before <= 1, 'preparation has one GPU task per frame');
    assert.deepEqual(film.root.children, live); assert.equal(target, null); assert.equal(gpu.debug.checkShaderErrors, true);
    assert.equal(hero.parent, scene); assert.equal(skin.visible || hero.visible || shadow.visible, false);
  };
  const drain = () => { for (let frame = 0; frame < 250; frame++) prepare(); };
  const enter = () => {
    Object.assign(player, { position: filmEntry(next), currentLocation: next.set });
    Object.assign(journey, { scene: next.id, step: 0 }); film.update(player, sandbox, 0);
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
  return { film, journey, gpu, skin, shadow, material, work, meshes, roots, depths, mapped, prepare, drain, enter, nextMesh, livePointSlots,
    decodeRoofMaps: () => { defer = false; pendingImages.splice(0).forEach(ready => ready()); },
    replaceGpu: () => { uploaded = new WeakMap(); gpu.properties = properties() as THREE.WebGLRenderer['properties']; } };
}

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

test('a failed roof attempt or visit releases the detached Wells assets exactly once', t => {
  const h = fixture(t, 'm1_phone_escape');
  h.journey.visiting = 'm1_roofs'; h.drain(); assert.deepEqual(h.work, []); delete h.journey.visiting;
  h.drain(); const mesh = h.nextMesh()!; assert.ok(mesh);
  let disposed = 0; mesh.geometry.addEventListener('dispose', () => disposed++);
  h.journey.openingRoof!.phase = 'failed'; h.prepare(); h.prepare(); assert.equal(disposed, 1);
  h.enter(); assert.notEqual(h.film.root.getObjectByName('wells-asphalt'), mesh);
});

test('the roof keeps its shader light count when the exit removes the objective', t => {
  const h = fixture(t, 'm1_phone_escape');
  assert.equal(h.livePointSlots(), 4);
  h.journey.step = 3; h.journey.openingRoof!.phase = 'escaped';
  assert.equal(h.livePointSlots(), 4, 'the three real floods must keep the same layout after the goal light goes out');
});

test('an early cut finishes the Wells booth without waiting for parallel shader support', t => {
  const h = fixture(t, 'm1_phone_escape');
  h.gpu.extensions.has = () => false;
  h.prepare(); h.enter();
  assert.ok(h.film.root.getObjectByName('wells-asphalt'));
  assert.ok(h.film.root.getObjectByName('opening-booth-intact-pane')?.visible);
  assert.deepEqual(h.work, []);
});

test('Wells prepares the investigating cast maps during the answer and releases a failed attempt', t => {
  class Bitmap { width = 2048; height = 2048; }
  const previous = globalThis.ImageBitmap;
  globalThis.ImageBitmap = Bitmap as unknown as typeof ImageBitmap;
  const hero = new THREE.Group(), geometry = new THREE.BoxGeometry();
  const [skin, suit] = ['Anatomical_head_and_hands', 'Tailored_coat_upper'].map(name => {
    const texture = new THREE.Texture(new Bitmap()); texture.flipY = false; texture.needsUpdate = true;
    const mesh = new THREE.SkinnedMesh(geometry, new THREE.MeshStandardMaterial({ map: texture }));
    mesh.name = name; hero.add(mesh); return texture;
  });
  hero.visible = false;
  const agents = Object.assign(Object.create(AgentRenderer.prototype), { getAgentHero: (id: string) => id === 'agent_jones' ? hero : undefined }) as AgentRenderer;
  const phone: OpeningPhoneEncounter = { phase: 'running', remaining: 7, lastTick: 0, attempts: 0 };
  const prepare = () => agents.prepareWellsCastTextures(renderer, phone);
  t.after(() => {
    agents.prepareWellsCastTextures(renderer); geometry.dispose(); skin.dispose(); suit.dispose();
    hero.children.forEach(mesh => (mesh as THREE.Mesh<THREE.BufferGeometry, THREE.Material>).material.dispose());
    if (previous) globalThis.ImageBitmap = previous;
    else Reflect.deleteProperty(globalThis, 'ImageBitmap');
  });
  type Upload = { texture: THREE.Texture; rows: number; mipmaps: boolean };
  const allocations: Upload[] = [], disposed: THREE.Texture[] = [], bySource = new Map<THREE.Source, Upload>();
  const gpu = new Map<THREE.Texture, { __webglTexture: Upload }>();
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
  assert.deepEqual(disposed, allocations.map(upload => upload.texture));
  assert.equal(prepare(), false); assert.equal(allocations.length, 3); assert.equal(hero.visible, false);
  assert.equal(bound, undefined); assert.equal(skipRows, 0);
});
