import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from 'three';
import { lifeRoomCenter, type FilmJourney } from '@auto_matrix/shared';
import { ApartmentSetRenderer, closedApartmentFar } from '../packages/client/src/engine/ApartmentSetRenderer.js';
import { LightCulling } from '../packages/client/src/engine/LightCulling.js';
import { prepareOpaqueShadowDepth } from '../packages/client/src/engine/OpaqueShadowDepth.js';

test('the workroom clips the distant street only while the camera and its near plane are enclosed', () => {
  const camera = new THREE.PerspectiveCamera(57, 16 / 9, .5, 5000);
  camera.position.set(1204.2, 3.95, 680.75);
  camera.lookAt(1200.95, 2.95, 679.7);
  const journey = { scene: 'm1_wake_up', contact: { phase: 'arrival', elapsed: 1.9, chairMotion: 'seated' } } as FilmJourney;
  assert.equal(closedApartmentFar(camera, journey), 56);
  assert.equal(camera.far, 5000);
  journey.contact!.phase = 'door';
  assert.equal(closedApartmentFar(camera, journey), 56);
  journey.contact!.phase = 'opening';
  assert.equal(closedApartmentFar(camera, journey), 5000);
  journey.contact!.phase = 'arrival';
  journey.visiting = 'm1_room303';
  assert.equal(closedApartmentFar(camera, journey), 5000);
  delete journey.visiting;
  camera.position.set(1226.6, 3.95, 680.75);
  camera.lookAt(1227.6, 3.95, 680.75);
  assert.equal(closedApartmentFar(camera, journey), 5000, 'the near plane must not clip through the wall');
});

function fixture() {
  const scene = new THREE.Scene(), city = new THREE.Group(), home = new THREE.Group(), root = new THREE.Group(), actor = new THREE.Group();
  const center = lifeRoomCenter('neo_apartment')!;
  home.position.set(center.x, 0, center.z); home.add(root); city.add(home); city.visible = false; scene.add(city, actor);
  scene.environment = new THREE.Texture(); scene.fog = new THREE.FogExp2(0x18231e, .01);
  const sun = new THREE.DirectionalLight(); sun.castShadow = true; scene.add(sun, new THREE.DirectionalLight(), new THREE.HemisphereLight());
  const geometry = new THREE.BoxGeometry(), texture = new THREE.Texture({ width: 2048, height: 2048 }); texture.needsUpdate = true;
  const material = new THREE.MeshStandardMaterial({ map: texture }), basic = new THREE.MeshBasicMaterial();
  for (let i = 0; i < 5; i++) root.add(new THREE.Mesh(geometry, material));
  actor.add(new THREE.Mesh(geometry, material));
  const arms = new THREE.Mesh(geometry, material); arms.name = 'Tracking_arms'; arms.visible = false; actor.add(arms);
  const shirt = new THREE.Mesh(geometry, material); shirt.name = 'Tracking_shirt'; shirt.visible = false; actor.add(shirt);
  const hidden = new THREE.Mesh(geometry, material); hidden.visible = false; actor.add(hidden);
  const street = new THREE.InstancedMesh(geometry, basic, 1); street.position.copy(home.position); city.add(street);
  const roomLights = Array.from({ length: 8 }, (_, i) => new THREE.PointLight(0xffffff, i < 5 ? 80 : 0, 30));
  for (const light of roomLights) { light.position.set(0, 5, 0); light.visible = false; root.add(light); }
  const outside = new THREE.PointLight(0xffffff, 80, 24); outside.position.set(1650, 6, 786); city.add(outside);
  const landingLight = new THREE.SpotLight(0xffffff, 0, 30); landingLight.castShadow = true; landingLight.visible = false; landingLight.position.copy(home.position); city.add(landingLight);
  const apartment = Object.assign(Object.create(ApartmentSetRenderer.prototype), { root, cityLights: city, roomLights, landingLight }) as ApartmentSetRenderer;
  const work: string[] = [], batches: THREE.Object3D[][] = [], slots: number[] = [], views: number[] = [];
  const programs: { program: object; isReady(): boolean; getUniforms(): void }[] = [];
  const camera = new THREE.PerspectiveCamera(58, 16 / 9, .5, 5000); camera.position.set(4737, 88, 4410); camera.updateMatrixWorld();
  const originalCamera = camera.matrixWorld.toArray();
  let ready = false, target: THREE.WebGLRenderTarget | null = null, disposals = 0, uploaded = new WeakMap<THREE.Texture, number>();
  const properties = () => ({ get: (map: THREE.Texture) => ({ __version: uploaded.get(map) }) });
  const renderer = {
    properties: properties(), info: { programs }, debug: { checkShaderErrors: true }, extensions: { has: () => true },
    autoClear: true, sortObjects: true, render() { work.push('buffers'); },
    getContext: () => ({ LINK_STATUS: 0x8b82, getProgramParameter: () => true }),
    getRenderTarget: () => target, setRenderTarget: (value: typeof target) => { target = value; },
    getActiveCubeFace: () => 0, getActiveMipmapLevel: () => 0,
    compile(subject: THREE.Object3D, eye: THREE.Camera, lights: THREE.Scene) {
      assert.ok(lights !== scene); assert.equal(lights.environment, scene.environment); assert.equal(lights.fog, scene.fog);
      assert.ok(eye !== camera && eye.position.distanceTo(home.position) < 20); assert.equal(target?.width, 1);
      views.push(eye.getWorldDirection(new THREE.Vector3()).z);
      const batch: THREE.Object3D[] = []; subject.traverse(o => batch.push(o));
      assert.ok(batch.length > 0 && batch.length <= 4); assert.ok(!batch.includes(hidden)); batches.push(batch);
      const selected: THREE.Light[] = []; lights.traverseVisible(o => { if (o instanceof THREE.Light) selected.push(o); });
      slots.push(selected.filter(o => o instanceof THREE.PointLight).length);
      assert.equal(selected.filter(o => o instanceof THREE.SpotLight && o.castShadow).length, 1);
      work.push('compile'); programs.push({ program: {}, isReady: () => ready, getUniforms: () => {
        assert.equal(renderer.debug.checkShaderErrors, false); work.push('bindings');
      } });
      target!.addEventListener('dispose', () => disposals++);
    },
    initTexture(map: THREE.Texture) { assert.equal(map, texture); work.push('texture'); uploaded.set(map, map.version); },
  } as unknown as THREE.WebGLRenderer;
  const journey = { scene: 'm1_pills', pills: { phase: 'taking', elapsed: 6, choice: 'blue' } } as FilmJourney;
  const prepare = (objects?: readonly (THREE.Group | THREE.Mesh | undefined)[], openingLights?: LightCulling) => {
    const before = work.length, pending = apartment.prepareReturn(renderer, camera, scene, journey, actor, objects, openingLights);
    assert.ok(work.length - before <= 1, 'one compile, binding completion or texture upload per frame');
    assert.equal(renderer.getRenderTarget(), null); assert.equal(renderer.debug.checkShaderErrors, true);
    assert.equal(city.visible, false); assert.ok(roomLights.every(light => !light.visible));
    assert.equal(landingLight.visible, false); assert.equal(landingLight.intensity, 0);
    assert.equal(arms.visible, false); assert.equal(shirt.visible, false); assert.equal(arms.parent, actor);
    assert.deepEqual(camera.matrixWorld.toArray(), originalCamera);
    return pending;
  };
  const drain = () => { for (let i = 0; i < 80; i++) prepare(); };
  const cancel = () => { journey.scene = 'm1_mirror'; prepare(); };
  return { apartment, scene, city, root, actor, roomLights, journey, renderer, texture, work, batches, slots, views, arms, shirt, street, prepare, drain, cancel,
    ready: () => { ready = true; }, disposals: () => disposals,
    replaceGpu: () => { uploaded = new WeakMap(); renderer.properties = properties() as THREE.WebGLRenderer['properties']; },
    dispose: () => { cancel(); geometry.dispose(); material.dispose(); basic.dispose(); texture.dispose(); scene.environment!.dispose(); },
  };
}

test('blue pill return prepares the real home light layout and hidden return clothing without changing the live scene', t => {
  const h = fixture(); t.after(h.dispose);
  for (let i = 0; i < 5; i++) h.prepare(); assert.ok(h.batches.length > 0); assert.ok(!h.work.includes('bindings'));
  h.ready(); h.drain();
  const meshes = h.batches.flat(); for (const mesh of [h.arms, h.shirt, h.street]) assert.ok(meshes.includes(mesh), mesh.name || mesh.type);
  assert.ok(h.slots.every(slots => slots === 6)); assert.equal(h.work.filter(v => v === 'texture').length, 1);
  const count = h.work.length; h.drain(); assert.equal(h.work.length, count, 'completed preparation remains bounded');
});

test('return preparation follows the chosen branch, late maps, GPU replacement and cancellation', t => {
  const h = fixture(); t.after(h.dispose);
  h.journey.pills!.choice = 'red'; h.drain(); assert.deepEqual(h.work, []);
  h.journey.pills!.choice = 'blue'; h.journey.visiting = 'm1_pills'; h.drain(); assert.deepEqual(h.work, []); delete h.journey.visiting;
  h.texture.image = null; h.ready(); h.drain(); assert.equal(h.work.filter(v => v === 'texture').length, 0);
  h.texture.image = { width: 2048, height: 2048 }; h.drain(); assert.equal(h.work.filter(v => v === 'texture').length, 1);
  const first = h.batches.length; h.replaceGpu(); h.drain(); assert.equal(h.batches.length, first * 2); assert.equal(h.work.filter(v => v === 'texture').length, 2);
  const before = h.disposals(); h.cancel(); assert.ok(h.disposals() >= before);
  h.journey.scene = 'm1_pills'; h.prepare(); h.cancel(); assert.ok(h.disposals() > before, 'cancelling a pending preparation releases its scratch target');
});

test('daylight changing during the drink prepares the new home light layout', t => {
  const h = fixture(); t.after(h.dispose); h.ready(); h.drain();
  const night = h.batches.length; h.roomLights.slice(5).forEach(light => { light.intensity = 80; }); h.drain();
  assert.ok(h.batches.length > night); assert.ok(h.slots.slice(night).every(slots => slots === 8));
  const day = h.batches.length; h.roomLights.slice(5).forEach(light => { light.intensity = 0; }); h.drain();
  assert.ok(h.batches.length > day); assert.ok(h.slots.slice(day).every(slots => slots === 6));
});

test('a successful Wells connection prepares the apartment and the guests before Neo takes over', t => {
  const h = fixture(); t.after(h.dispose);
  const choi = new THREE.Group(), dujour = new THREE.Group();
  const material = new THREE.MeshStandardMaterial({ map: h.texture }); t.after(() => material.dispose());
  const model = new THREE.SkinnedMesh(h.arms.geometry, material), otherModel = h.shirt.clone();
  otherModel.visible = true; choi.add(model); dujour.add(otherModel);
  const goal = h.arms.clone(), shadow = h.shirt.clone();
  const subjects = [choi, dujour, goal, shadow];
  h.journey.scene = 'm1_phone_escape';
  delete h.journey.pills;
  h.journey.openingPhone = { phase: 'running', remaining: 8, lastTick: 0, attempts: 0 };
  h.prepare(subjects); assert.deepEqual(h.work, []);
  h.journey.openingPhone.phase = 'failed';
  h.prepare(subjects); assert.deepEqual(h.work, []);
  h.journey.openingPhone.phase = 'connected';
  h.journey.visiting = 'm1_phone_escape';
  h.prepare(subjects); assert.deepEqual(h.work, []);
  delete h.journey.visiting;
  assert.equal(h.prepare([choi, undefined, goal, shadow]), true, 'the normals queue must wait while the apartment still has work');
  assert.equal(h.apartment.returnNormalMeshes, undefined);
  assert.ok(h.work.includes('compile'), 'the actual connected call starts preparation before the cut');
  h.ready(); h.journey.openingPhone.phase = 'done';
  for (let i = 0; i < 80; i++) h.prepare(subjects);
  const meshes = h.batches.flat();
  for (const mesh of [model, otherModel, h.arms, h.shirt, h.street]) assert.ok(meshes.includes(mesh), 'all three actors and the home need prepared materials');
  assert.ok(meshes.includes(goal) && meshes.includes(shadow), 'prepare the goal ring and contact shadow while they are still hidden');
  assert.ok(h.slots.every(slots => slots === 10), 'prepare the same point-light slots used through the CRT cut and the knock');
  assert.equal(goal.visible || shadow.visible, false);
  assert.deepEqual({ facesTheDesk: h.views.every(z => z < 0), actorLocalSkin: material.customProgramCacheKey().endsWith(':actor-local-skin-v1') },
    { facesTheDesk: true, actorLocalSkin: true }, 'the queued programs need the arriving view and the draw-time skin variant');
  const count = h.work.length;
  assert.equal(h.prepare(subjects), false); assert.equal(h.work.length, count);
  const normals = h.apartment.returnNormalMeshes;
  assert.ok(normals?.includes(h.street) && normals.includes(model) && normals.includes(h.shirt) && normals.includes(h.root.children[0] as THREE.Mesh));
  h.journey.scene = 'm1_wake_up';
  h.prepare(subjects); assert.equal(h.work.length, count); assert.equal(h.apartment.returnNormalMeshes, undefined);
});

test('Wells leaves a frame between shader completion and reading its bindings', t => {
  const h = fixture(); t.after(h.dispose);
  h.journey.scene = 'm1_phone_escape';
  h.journey.openingPhone = { phase: 'connected', remaining: 7, lastTick: 0, attempts: 0 };
  assert.equal(h.prepare(), true);
  assert.deepEqual(h.work, ['compile']);
  h.ready();
  assert.equal(h.prepare(), true);
  assert.deepEqual(h.work, ['compile'], 'the completion check must yield before it reads bindings');
  assert.equal(h.prepare(), true);
  assert.deepEqual(h.work, ['compile', 'bindings']);
});

test('Wells stages the original room, outfit and street buffers without drawing or changing the live scene', t => {
  const h = fixture(), { renderer, root, street, shirt, journey } = h;
  const shirtGeometry = shirt.geometry.clone(), shirtMaterial = shirt.material;
  const room = root.children[0] as THREE.Mesh, roomMaterial = room.material, streetMaterial = street.material;
  const decoration = new THREE.Object3D(); shirt.add(decoration); shirt.geometry = shirtGeometry;
  t.after(() => { h.dispose(); shirtGeometry.dispose(); });
  const buffers = new Set<THREE.BufferGeometry>(), instances = new Set<THREE.InstancedMesh>();
  Object.assign(renderer, {
    render(view: THREE.Scene) {
      assert.notEqual(view, h.scene);
      assert.equal(renderer.getRenderTarget()?.width, 1);
      assert.equal(renderer.autoClear, false); assert.equal(renderer.sortObjects, false);
      assert.ok(view.children.length > 0 && view.children.length <= 4);
      for (const object of view.children) {
        assert.ok(object instanceof THREE.Mesh);
        assert.equal(object.frustumCulled, false); assert.equal(object.visible, true);
        assert.equal((object.material as THREE.Material).visible, false);
        assert.deepEqual(object.children, []);
        buffers.add(object.geometry);
        if (object instanceof THREE.InstancedMesh) instances.add(object);
      }
      h.work.push('buffers');
    },
  });
  h.ready(); h.drain(); assert.equal(buffers.size, 0, 'blue-pill return keeps its existing preparation');
  journey.scene = 'm1_phone_escape'; journey.openingPhone = { phase: 'connected', remaining: 7, lastTick: 0, attempts: 0 };
  h.drain();
  assert.ok(buffers.has(room.geometry) && buffers.has(shirtGeometry), 'the actual room and arriving outfit need resident buffers');
  assert.ok(instances.has(street), 'the original street batch owns the instance data');
  assert.equal(room.material, roomMaterial); assert.equal(street.material, streetMaterial); assert.equal(shirt.material, shirtMaterial);
  assert.equal(room.frustumCulled, true); assert.equal(street.frustumCulled, true); assert.equal(shirt.frustumCulled, true);
  assert.equal(room.parent, root); assert.equal(street.parent, h.city); assert.equal(shirt.children[0], decoration);
  assert.equal(renderer.autoClear, true); assert.equal(renderer.sortObjects, true);
  const count = h.work.length;
  journey.scene = 'm1_wake_up'; assert.equal(h.prepare(), false); assert.equal(h.work.length, count);
});

test('Wells prepares large apartment textures in strips and releases a partial upload on early entry', t => {
  class Bitmap { width = 2048; height = 2048; }
  const previous = globalThis.ImageBitmap;
  globalThis.ImageBitmap = Bitmap as unknown as typeof ImageBitmap;
  const h = fixture(), { renderer, texture } = h;
  t.after(() => {
    h.dispose(); texture.dispose();
    if (previous) globalThis.ImageBitmap = previous;
    else Reflect.deleteProperty(globalThis, 'ImageBitmap');
  });
  const image = new Bitmap();
  texture.image = image; texture.flipY = false; texture.colorSpace = THREE.SRGBColorSpace; texture.anisotropy = 8;
  const source = texture.source, version = texture.version;
  type Backing = { rows: number; mipmaps: boolean };
  const allocations: { texture: THREE.Texture; backing: Backing }[] = [], releases: THREE.Texture[] = [];
  const bySource = new Map<THREE.Source, Backing>(), gpu = new Map<THREE.Texture, { __webglTexture: Backing; __version: number }>();
  let unpackRow = 0, bound: Backing | undefined;
  const gl = {
    LINK_STATUS: 0x8b82, TEXTURE_2D: 0x0de1, UNPACK_SKIP_ROWS: 0x0cf3, RGBA: 0x1908, UNSIGNED_BYTE: 0x1401,
    getProgramParameter: () => true,
    pixelStorei: (_parameter: number, row: number) => { unpackRow = row; },
    texSubImage2D(_target: number, _level: number, _x: number, row: number, width: number, height: number,
      _format: number, _type: number, bitmap: Bitmap) {
      assert.ok(bound); assert.equal(bitmap, image);
      assert.deepEqual([row, width, height], [unpackRow, 2048, 256]);
      assert.equal(bound.rows, row);
      bound.rows += height; h.work.push('strip');
    },
    generateMipmap() { assert.ok(bound); assert.equal(bound.rows, 2048); bound.mipmaps = true; },
  };
  Object.assign(renderer, {
    capabilities: { maxTextureSize: 4096 },
    getContext: () => gl,
    properties: { get: (map: THREE.Texture) => gpu.get(map) ?? {} },
    state: { bindTexture: (_target: number, backing: Backing) => { bound = backing; }, unbindTexture: () => { bound = undefined; } },
    initTexture(map: THREE.Texture) {
      let backing = bySource.get(map.source);
      if (!backing) {
        backing = { rows: map.source.dataReady ? 2048 : 0, mipmaps: map.source.dataReady };
        bySource.set(map.source, backing); allocations.push({ texture: map, backing });
        if (map.source.dataReady) h.work.push('texture');
      }
      gpu.set(map, { __webglTexture: backing, __version: map.version });
      map.addEventListener('dispose', () => { gpu.delete(map); releases.push(map); });
    },
  });
  delete h.journey.pills;
  const start = () => {
    h.journey.scene = 'm1_phone_escape';
    h.journey.openingPhone = { phase: 'done', remaining: 7, lastTick: 0, attempts: 0 };
    const count = allocations.length;
    for (let frame = 0; frame < 40 && allocations.length === count; frame++) h.prepare();
    assert.equal(allocations.length, count + 1);
    const staged = allocations.at(-1)!;
    assert.equal(staged.backing.rows, 256, 'the first preparation frame must only upload the first strip');
    assert.equal(staged.texture.colorSpace, texture.colorSpace); assert.equal(staged.texture.anisotropy, texture.anisotropy);
    assert.equal(texture.source, source); assert.equal(texture.version, version); assert.equal(gpu.has(texture), false);
    return staged;
  };
  h.ready();
  const interrupted = start();
  h.journey.scene = 'm1_wake_up'; assert.equal(h.prepare(), false);
  assert.deepEqual(releases, [interrupted.texture]);
  assert.equal(gpu.has(interrupted.texture), false); assert.equal(gpu.has(texture), false); assert.equal(texture.source, source);

  const finished = start();
  for (let rows = 256; rows < image.height; rows += 256) {
    assert.equal(finished.backing.rows, rows); assert.equal(finished.backing.mipmaps, false);
    assert.equal(texture.source, source); assert.equal(h.apartment.returnNormalMeshes, undefined);
    assert.equal(h.prepare(), true);
  }
  assert.equal(finished.backing.mipmaps, true);
  assert.deepEqual(releases, [interrupted.texture, finished.texture]);
  assert.equal(gpu.get(texture)?.__webglTexture, finished.backing, 'the live material adopts the single populated GPU allocation');
  assert.equal(allocations.length, 2); assert.equal(texture.image, image);
  assert.equal(bound, undefined); assert.equal(unpackRow, 0);
  assert.equal(h.prepare(), false); assert.ok(h.apartment.returnNormalMeshes);
});

test('Wells prepares both packed shadow layouts and retains their programs for the first two apartment frames', t => {
  const h = fixture(), { renderer, scene, root, actor, texture, street, journey } = h;
  const openingLights = new LightCulling(scene), material = new THREE.MeshStandardMaterial({ map: texture, alphaTest: .3, side: THREE.DoubleSide });
  t.after(() => { h.dispose(); openingLights.dispose(); material.dispose(); texture.dispose(); });
  const room = root.children[0] as THREE.Mesh;
  room.castShadow = street.castShadow = true;
  prepareOpaqueShadowDepth(room);
  const cutout = new THREE.SkinnedMesh(room.geometry, material);
  cutout.castShadow = true; prepareOpaqueShadowDepth(cutout); actor.add(cutout);
  for (let i = 0; i < 3; i++) { const light = new THREE.SpotLight(); light.castShadow = true; scene.add(light); }
  Object.assign(renderer, { shadowMap: { enabled: true, type: THREE.PCFSoftShadowMap } });
  const compile = renderer.compile, kinds = new Map<number, Set<string>>(), prepared = new Set<THREE.MeshDepthMaterial>(), disposed: THREE.MeshDepthMaterial[] = [];
  t.mock.method(renderer, 'compile', (subject: THREE.Object3D, eye: THREE.PerspectiveCamera, lights: THREE.Scene) => {
    const batch: THREE.Mesh<THREE.BufferGeometry, THREE.MeshDepthMaterial>[] = [];
    subject.traverse(mesh => { if (mesh instanceof THREE.Mesh && mesh.material instanceof THREE.MeshDepthMaterial) batch.push(mesh); });
    if (!batch.length) return compile.call(renderer, subject, eye, lights);
    assert.equal(lights.fog, null); assert.equal(lights.environment, null); assert.notEqual(lights, scene);
    let spots = 0; lights.traverseVisible(light => { if (light instanceof THREE.SpotLight && light.castShadow) spots++; });
    const seen = kinds.get(spots) ?? new Set(); kinds.set(spots, seen);
    assert.ok(batch.length <= 4);
    for (const mesh of batch) {
      const depth = mesh.material;
      assert.equal(depth.depthPacking, THREE.RGBADepthPacking);
      assert.match(depth.customProgramCacheKey(), /:actor-local-skin-v1$/);
      if (mesh instanceof THREE.SkinnedMesh) {
        assert.equal(depth.map, texture); assert.equal(depth.alphaTest, .3); assert.equal(depth.side, THREE.DoubleSide);
        seen.add('cutout');
      } else {
        assert.equal(depth.map, null); assert.equal(depth.side, THREE.BackSide);
        seen.add(mesh instanceof THREE.InstancedMesh ? 'instanced' : 'room');
      }
      if (!prepared.has(depth)) { prepared.add(depth); depth.addEventListener('dispose', () => { disposed.push(depth); }); }
    }
    h.work.push('depth');
  });
  delete journey.pills;
  journey.scene = 'm1_phone_escape'; journey.openingPhone = { phase: 'done', remaining: 7, lastTick: 0, attempts: 0 };
  h.ready();
  const prepare = () => h.prepare(undefined, openingLights);
  for (let frame = 0; frame < 80 && prepare(); frame++) { /* One GPU job per frame. */ }
  assert.deepEqual(kinds, new Map([1, 3].map(spots => [spots, new Set(['cutout', 'instanced', 'room'])])));
  assert.equal(cutout.material, material); assert.equal(room.castShadow && street.castShadow, true);
  assert.equal(disposed.length, 0);
  journey.scene = 'm1_wake_up';
  assert.equal(prepare(), false); assert.equal(prepare(), false); assert.equal(disposed.length, 0);
  assert.equal(prepare(), false); assert.deepEqual(new Set(disposed), prepared); assert.equal(disposed.length, prepared.size);
});
