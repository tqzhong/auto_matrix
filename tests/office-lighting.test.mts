import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { FILM_SETS, OFFICE_DESKS, OFFICE_LADDER, metacortexPosition, type AgentState, type FilmJourney, type SandboxState } from '@auto_matrix/shared';
import { FilmSetRenderer } from '../packages/client/src/engine/FilmSetRenderer.js';
import { LightCulling } from '../packages/client/src/engine/LightCulling.js';
import { OfficeSetRenderer } from '../packages/client/src/engine/OfficeSetRenderer.js';
import { OfficeWorkdayRenderer } from '../packages/client/src/engine/OfficeWorkdayRenderer.js';
import { AgentRenderer } from '../packages/client/src/agents/AgentRenderer.js';

test('office luminaires illuminate desks without scorching the ceiling above them', t => {
  t.mock.method(THREE.TextureLoader.prototype, 'load', () => new THREE.Texture());
  t.mock.method(GLTFLoader.prototype, 'loadAsync', () => new Promise(() => {}));
  const original = globalThis.document;
  globalThis.document = { createElement: () => ({ getContext: () => ({ fillRect() {}, fillText() {}, strokeRect() {} }) }) } as unknown as Document;
  const root = new THREE.Group();
  const renderer = new OfficeSetRenderer(root, FILM_SETS.film_metacortex_floor);
  const irradiance = (point: THREE.Vector3, normal: THREE.Vector3) => {
    let total = 0;
    root.updateMatrixWorld(true);
    root.traverse(object => {
      if (!(object instanceof THREE.PointLight || object instanceof THREE.SpotLight)) return;
      const position = object.getWorldPosition(new THREE.Vector3());
      const delta = point.clone().sub(position), distance = delta.length();
      const direction = delta.normalize();
      let cone = 1;
      if (object instanceof THREE.SpotLight) {
        const axis = object.target.getWorldPosition(new THREE.Vector3()).sub(position).normalize();
        cone = THREE.MathUtils.smoothstep(axis.dot(direction), Math.cos(object.angle), Math.cos(object.angle * (1 - object.penumbra)));
      }
      const cutoff = object.distance ? Math.pow(Math.max(0, 1 - Math.pow(distance / object.distance, 4)), 2) : 1;
      total += object.intensity * cone * cutoff * Math.max(0, -normal.dot(direction)) / Math.max(distance ** object.decay, .01);
    });
    return total;
  };
  try {
    const desk = irradiance(new THREE.Vector3(0, 2.5, 5), new THREE.Vector3(0, 1, 0));
    const ceiling = irradiance(new THREE.Vector3(0, 9.095, 5), new THREE.Vector3(0, -1, 0));
    assert.ok(desk > .2, 'the working plane must still receive local light');
    assert.ok(ceiling < desk * .2, `ceiling receives ${ceiling.toFixed(2)} versus desk ${desk.toFixed(2)}; nearby downlights must not emit upwards`);
    renderer.update(undefined, undefined, undefined, undefined, 0, 18000);
    const night = irradiance(new THREE.Vector3(-18, 2.5, 2), new THREE.Vector3(0, 1, 0));
    assert.ok(irradiance(new THREE.Vector3(0, 2.5, 5), new THREE.Vector3(0, 1, 0)) > .2, 'fluorescent fixtures remain usable after sunset');
    renderer.update(undefined, undefined, undefined, undefined, 0, 12000);
    const day = irradiance(new THREE.Vector3(-18, 2.5, 2), new THREE.Vector3(0, 1, 0));
    assert.ok(day > night * 1.5, 'window daylight follows the world clock');
  } finally { renderer.dispose(); globalThis.document = original; }
});

test('static office batching copies existing rounded solids without generating another solid', t => {
  t.mock.method(THREE.TextureLoader.prototype, 'load', () => new THREE.Texture());
  t.mock.method(GLTFLoader.prototype, 'loadAsync', () => new Promise(() => {}));
  const original = globalThis.document, descriptor = Object.getOwnPropertyDescriptor(RoundedBoxGeometry.prototype, 'constructor')!;
  let regenerated = 0;
  Object.defineProperty(RoundedBoxGeometry.prototype, 'constructor', { ...descriptor, value: new Proxy(RoundedBoxGeometry, {
    construct(target, args, newTarget) { regenerated++; return Reflect.construct(target, args, newTarget); },
  }) });
  globalThis.document = { createElement: () => ({ getContext: () => ({ fillRect() {}, fillText() {}, strokeRect() {} }) }) } as unknown as Document;
  try {
    const manager = new OfficeWorkdayRenderer(new THREE.Group());
    const managerCopies = regenerated; manager.dispose();
    const office = new OfficeSetRenderer(new THREE.Group(), FILM_SETS.film_metacortex_floor);
    const officeCopies = regenerated - managerCopies; office.dispose();
    assert.deepEqual({ managerCopies, officeCopies }, { managerCopies: 0, officeCopies: 0 }, 'copying generated vertices must not run the solid constructor again');
  } finally {
    Object.defineProperty(RoundedBoxGeometry.prototype, 'constructor', descriptor); globalThis.document = original;
  }
});

test('office keycaps share one draw geometry at the authored desk positions', t => {
  t.mock.method(THREE.TextureLoader.prototype, 'load', () => new THREE.Texture());
  t.mock.method(GLTFLoader.prototype, 'loadAsync', () => new Promise(() => {}));
  const original = globalThis.document, copy = THREE.BufferGeometry.prototype.copy;
  const positions = (geometry: THREE.BufferGeometry) => {
    const array = geometry.getAttribute('position').array; return Buffer.from(array.buffer, array.byteOffset, array.byteLength);
  };
  const managerKey = new RoundedBoxGeometry(.09, .025, .084, 2, .008), officeKey = new RoundedBoxGeometry(.145, .05, .132, 2, .01);
  const managerKeys: THREE.BufferGeometry[][] = [[], []], officeKeys: THREE.BufferGeometry[] = []; let build = 0;
  t.mock.method(THREE.BufferGeometry.prototype, 'copy', function(this: THREE.BufferGeometry, source: THREE.BufferGeometry) {
    if (source instanceof RoundedBoxGeometry) {
      if (positions(source).equals(positions(managerKey))) managerKeys[build].push(source);
      if (positions(source).equals(positions(officeKey))) officeKeys.push(source);
    }
    return copy.call(this, source);
  });
  globalThis.document = { createElement: () => ({ getContext: () => ({ fillRect() {}, fillText() {}, strokeRect() {} }) }) } as unknown as Document;
  let office: OfficeSetRenderer | undefined;
  let released = false;
  try {
    const manager = new OfficeWorkdayRenderer(new THREE.Group()); manager.dispose(); build++;
    office = new OfficeSetRenderer(new THREE.Group(), FILM_SETS.film_metacortex_floor);
    assert.deepEqual(managerKeys.map(keys => keys.length), [52, 52], 'both full keyboards remain in the scene builds');
    assert.deepEqual(managerKeys.map(keys => new Set(keys).size), [1, 1]);
    assert.notEqual(managerKeys[0][0], managerKeys[1][0], 'disposed scene templates must not be retained for the next scene');
    const keys = office.root.children.find(object => object instanceof THREE.InstancedMesh && positions(object.geometry).equals(positions(officeKey)));
    assert.ok(keys instanceof THREE.InstancedMesh, 'every workstation draws the same key geometry');
    assert.equal(officeKeys.length, 0, 'the material batch does not duplicate key vertices');
    assert.equal(keys.count, OFFICE_DESKS.length * 52);
    assert.equal(keys.castShadow && keys.receiveShadow, true);
    for (const attribute of ['normal', 'uv']) assert.deepEqual(keys.geometry.getAttribute(attribute).array, officeKey.getAttribute(attribute).array);
    const matrix = new THREE.Matrix4(), position = new THREE.Vector3();
    let index = 0;
    for (const { x, z } of OFFICE_DESKS) for (let row = 0; row < 4; row++) for (let col = 0; col < 13; col++) {
      keys.getMatrixAt(index++, matrix);
      position.setFromMatrixPosition(matrix);
      assert.ok(position.distanceToSquared(new THREE.Vector3(x + .4 - 1.11 + col * .183, 2.686, z - 1.24 + row * .17)) < 1e-10);
    }
    keys.addEventListener('dispose', () => { released = true; });
  } finally { office?.dispose(); managerKey.dispose(); officeKey.dispose(); globalThis.document = original; }
  assert.equal(released, true, 'leaving the office releases the instance buffer');
});

test('the occupied lift prepares the hidden office and city materials with the arrival lights', t => {
  t.mock.method(THREE.TextureLoader.prototype, 'load', () => new THREE.Texture());
  t.mock.method(GLTFLoader.prototype, 'loadAsync', () => new Promise(() => {}));
  const document = globalThis.document;
  globalThis.document = { createElement: () => ({ getContext: () => ({ fillRect() {}, fillText() {}, strokeRect() {} }) }) } as unknown as Document;
  const scene = new THREE.Scene(), film = new FilmSetRenderer(scene), culling = new LightCulling(scene);
  t.after(() => { film.dispose(); culling.dispose(); globalThis.document = document; });
  culling.minimumPointSlots = 4;
  const lamp = new THREE.PointLight(0xffffff, 8, 10);
  const landing = new THREE.SpotLight(0xffffff, 0); landing.castShadow = true;
  const city = new THREE.Group(), street = new THREE.InstancedMesh(new THREE.BoxGeometry(), new THREE.MeshPhysicalMaterial(), 1);
  const streetCast = new THREE.Group(), distant = new THREE.Mesh(new THREE.BoxGeometry(), new THREE.MeshStandardMaterial({ vertexColors: true }));
  distant.visible = false; streetCast.add(distant); scene.add(streetCast);
  const hidden = new THREE.Mesh(); hidden.visible = false;
  city.add(lamp, street, hidden); scene.add(city, landing);
  const position = { ...metacortexPosition(0, -29), y: 21 };
  const player = { id: 'neo', position, isInMatrix: true } as AgentState;
  const sandbox = { threats: [], neoLife: {
    journey: { scene: 'm1_commute', actor: 'neo', step: 1, completed: [] },
    lift: { phase: 'travel', floor: 0, target: 1, elapsed: 3, passenger: position },
  } } as unknown as SandboxState;
  const before = structuredClone(sandbox), camera = new THREE.PerspectiveCamera();
  camera.position.set(position.x, position.y + 4, position.z - 2);
  let target: THREE.WebGLRenderTarget | null = null;
  const windows: THREE.Mesh[] = [];
  const neo = new THREE.Group(); scene.add(neo);
  let neoCompiles = 0, cityCompiles = 0;
  let ready = false;
  const uniformQueries: string[] = [];
  const programs: { isReady(): boolean; getUniforms(): void }[] = [];
  const renderer = {
    info: { programs },
    extensions: { has: () => true },
    getRenderTarget: () => target,
    setRenderTarget: (next: typeof target) => { target = next; },
    compile: (root: THREE.Group, eye: THREE.Camera, litScene: THREE.Scene) => {
      assert.ok(target);
      assert.equal(eye.position.y, 70);
      let points = 0, spots = 0;
      for (const group of root === neo ? [litScene] : [root, litScene]) group.traverseVisible(object => {
        if (object instanceof THREE.PointLight) points++;
        if (object instanceof THREE.SpotLight) spots++;
      });
      assert.deepEqual({ points, spots }, { points: 6, spots: 5 });
      if (root === neo) {
        assert.ok(litScene.getObjectByName('office-window-glass'));
        neoCompiles++;
        return;
      }
      const materials: THREE.Object3D[] = [];
      root.traverse(object => { if (object instanceof THREE.Mesh) materials.push(object); });
      if (materials.includes(street)) {
        assert.deepEqual(materials.map(object => object.id), [street.id, distant.id], 'the city batch includes the shared distant-character color program');
        assert.equal(street.parent, city);
        assert.equal(distant.parent, streetCast);
        assert.equal(distant.visible, false);
        assert.equal(lamp.parent, city);
        assert.ok(litScene.getObjectByName('office-window-glass'));
        cityCompiles++;
        return;
      }
      assert.equal(root.parent, null);
      windows.push(root.getObjectByName('office-window-glass') as THREE.Mesh);
      for (const material of ['glass', 'fluorescent shade', 'carpet'])
        programs.push({ isReady: () => ready, getUniforms: () => { uniformQueries.push(material); } });
    },
  } as unknown as THREE.WebGLRenderer;
  film.update(player, sandbox, 0);
  const prepare = () => film.prepareOffice(renderer, camera, culling, player, sandbox, neo, city, distant);
  assert.equal(prepare(), true, 'building the detached floor uses this frame');
  for (let i = 1; i < 9; i++) prepare();
  assert.equal(windows.length, 1);
  assert.equal(neoCompiles, 1);
  assert.equal(cityCompiles, 1);
  assert.deepEqual(uniformQueries, [], 'an unfinished program must not stall the lift');
  programs.splice(1, 1);
  ready = true;
  assert.equal(prepare(), true);
  assert.deepEqual(uniformQueries, ['glass'], 'one ready program is prepared per frame');
  assert.equal(prepare(), true);
  assert.deepEqual(uniformQueries, ['glass', 'carpet'], 'a released program is skipped');
  assert.equal(prepare(), false, 'the idle preparation slot can upload one actor texture');
  assert.equal(scene.getObjectByName('office-window-glass'), undefined);
  assert.equal(lamp.intensity, 8);
  assert.equal(culling.minimumPointSlots, 4, 'the elevator keeps its own light layout while the office is prepared');
  assert.equal(target, null);
  assert.deepEqual(sandbox, before);
  let released = false;
  windows[0].geometry.addEventListener('dispose', () => { released = true; });
  film.prepareOffice(renderer, camera, culling, undefined, sandbox);
  assert.equal(released, true, 'leaving the lift releases the detached office');
  for (let i = 0; i < 6; i++) film.prepareOffice(renderer, camera, culling, player, sandbox);
  player.position = metacortexPosition(0, -29, 1);
  film.update(player, sandbox, 0);
  assert.equal(film.active?.id, 'film_metacortex_floor');
  assert.ok(scene.getObjectByName('office-window-glass') === windows[1]);
});

test('the upper ladder has a clear passage to the ledge between two graspable rails', t => {
  t.mock.method(THREE.TextureLoader.prototype, 'load', () => new THREE.Texture());
  const document = globalThis.document;
  globalThis.document = { createElement: () => ({ getContext: () => ({ fillRect() {}, strokeRect() {}, fillText() {} }) }) } as unknown as Document;
  const parent = new THREE.Group();
  const office = new OfficeSetRenderer(parent, FILM_SETS.film_office_ledge);
  t.after(() => { office.dispose(); globalThis.document = document; });
  parent.updateMatrixWorld(true);
  const x = OFFICE_LADDER.rung.x, z = OFFICE_LADDER.z, direction = new THREE.Vector3(1, 0, 0);
  const hits = (y: number, offset = 0) => new THREE.Raycaster(new THREE.Vector3(x - .16, y, z + offset), direction, 0, .23).intersectObject(parent, true);
  assert.ok(hits(-.1).length, 'there is a real last rung below the landing');
  for (let row = 0; row < 8; row++) {
    const y = .45 + row * .55;
    assert.equal(hits(y).length, 0, `the torso must not pass through a crossbar at height ${y}`);
    for (const side of [-1, 1]) assert.ok(hits(y, side * .82).length, 'both handrails continue above the exit');
  }
});

test('office visits skip the cleaners and the live workday culls them after their first color draw', async t => {
  t.mock.method(THREE.TextureLoader.prototype, 'load', () => new THREE.Texture());
  let resolveAsset!: (asset: { scene: THREE.Group }) => void;
  const load = t.mock.method(GLTFLoader.prototype, 'loadAsync', () => new Promise(resolve => { resolveAsset = resolve; }));
  const document = globalThis.document;
  globalThis.document = { createElement: () => ({ getContext: () => ({ fillRect() {}, strokeRect() {}, fillText() {} }) }) } as unknown as Document;
  t.after(() => { globalThis.document = document; });
  const floor = FILM_SETS.film_metacortex_floor;
  const workday: FilmJourney = { version: 1, scene: 'm1_boss', actor: 'neo', step: 0, completed: [], enteredAt: 0,
    reflections: {}, checkpoint: floor.center, lastText: '' };
  const visit = new OfficeSetRenderer(new THREE.Group(), floor);
  t.after(() => visit.dispose());
  visit.update({ ...workday, scene: 'm1_interrogation', visiting: 'm1_boss' });
  assert.equal(load.mock.callCount(), 0, 'a journal visit never shows the window cleaners');
  const escape = new OfficeSetRenderer(new THREE.Group(), FILM_SETS.film_office_ledge);
  t.after(() => escape.dispose());
  escape.update({ ...workday, scene: 'm1_ledge' });
  assert.equal(load.mock.callCount(), 0, 'a cold load on the ledge skips the earlier background performance');

  const parent = new THREE.Group();
  parent.position.set(floor.center.x, floor.center.y - 1, floor.center.z);
  const live = new OfficeSetRenderer(parent, floor);
  t.after(() => live.dispose());
  live.update({ ...workday, scene: 'm1_commute' });
  live.update(workday);
  live.update(workday);
  assert.deepEqual(load.mock.calls.map(call => call.arguments), [['/assets/characters/club-male.glb']]);
  const asset = new THREE.Group();
  const source = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshStandardMaterial());
  source.name = 'cleaner-test-surface'; asset.add(source);
  for (const name of ['shoulder_R', 'elbow_R', 'shoulder_L', 'elbow_L', 'head', 'wrist_R']) {
    const bone = new THREE.Bone(); bone.name = name; asset.add(bone);
  }
  resolveAsset({ scene: asset });
  await Promise.resolve();
  const cleaners = live.root.getObjectByName('office-window-cleaners')!;
  const surface = cleaners.getObjectByName('cleaner-test-surface') as THREE.Mesh<THREE.BufferGeometry, THREE.MeshStandardMaterial>;
  assert.equal(cleaners.children.length, 6);

  const camera = new THREE.PerspectiveCamera(55, 16 / 9, .1, 300);
  const colorScene = new THREE.Scene(), normalScene = new THREE.Scene();
  normalScene.overrideMaterial = new THREE.MeshNormalMaterial();
  const gpu = { properties: {} };
  const renderer = gpu as unknown as THREE.WebGLRenderer;
  const draw = (scene: THREE.Scene) => surface.onAfterRender(renderer, scene, camera, surface.geometry, surface.material, null);
  const update = () => live.update(workday, camera.position, undefined, undefined, 2, 12000, camera);
  camera.position.copy(parent.position).add(new THREE.Vector3(-12, 4.8, 25));
  camera.lookAt(camera.position.x + 10, camera.position.y, camera.position.z);
  update();
  assert.equal(cleaners.visible, true, 'a cold view keeps the initial material and texture draw');
  draw(normalScene); update();
  assert.equal(cleaners.visible, true, 'drawing only the normals does not prepare the color materials');
  draw(colorScene); update();
  assert.equal(cleaners.visible, false);

  camera.lookAt(camera.position.x - 10, camera.position.y, camera.position.z);
  update();
  assert.equal(cleaners.visible, true);
  camera.lookAt(camera.position.x + 10, camera.position.y, camera.position.z);
  gpu.properties = {};
  update();
  assert.equal(cleaners.visible, true, 'a restored GPU context gets its own first draw');
  draw(colorScene); update();
  assert.equal(cleaners.visible, false);
  assert.equal(load.mock.callCount(), 1, 'turning back into view does not reload the cast');
});

test('the office stages manager textures and the nearby street hair cutout one at a time', t => {
  t.mock.method(THREE.TextureLoader.prototype, 'load', () => new THREE.Texture());
  const document = globalThis.document;
  const gradient = { addColorStop() {} };
  globalThis.document = { createElement: () => ({ getContext: () => ({
    createRadialGradient: () => gradient, createImageData: (w: number, h: number) => ({ data: new Uint8ClampedArray(w * h * 4) }),
    fillRect() {}, putImageData() {},
  }) }) } as unknown as Document;
  const scene = new THREE.Scene(), agents = new AgentRenderer(scene), lighting = new LightCulling(scene);
  t.after(() => { agents.dispose(); lighting.dispose(); globalThis.document = document; });
  const camera = new THREE.PerspectiveCamera(); camera.position.z = 200;
  const manager = new THREE.Group(), detail = new THREE.Group(), hero = new THREE.Group();
  scene.add(manager); manager.add(detail); detail.add(hero); detail.visible = false;
  const skin = new THREE.Texture({ width: 2048, height: 2048 }); skin.needsUpdate = true;
  const hair = new THREE.Texture({ width: 2048, height: 2048 }); hair.needsUpdate = true;
  const coat = new THREE.Texture({ width: 2048, height: 2048 }); coat.needsUpdate = true;
  const hiddenMap = new THREE.Texture({ width: 2048, height: 2048 }); hiddenMap.needsUpdate = true;
  hero.add(new THREE.Mesh(undefined, new THREE.MeshStandardMaterial({ map: skin })));
  hero.add(new THREE.Mesh(undefined, new THREE.MeshStandardMaterial({ map: hair, bumpMap: hair })));
  hero.add(new THREE.Mesh(undefined, new THREE.MeshStandardMaterial({ map: coat })));
  const hidden = new THREE.Mesh(undefined, new THREE.MeshStandardMaterial({ map: hiddenMap })); hidden.visible = false; hero.add(hidden);
  const pedestrian = new THREE.Group(), streetHero = new THREE.Group();
  const image = { width: 2048, height: 2048, complete: false };
  const cutout = new THREE.Texture(image); cutout.needsUpdate = true;
  const streetHair = new THREE.SkinnedMesh(undefined, new THREE.MeshStandardMaterial({ map: cutout, alphaTest: .5 }));
  streetHair.name = 'Red_dress_hair'; streetHair.castShadow = true;
  streetHero.add(streetHair, new THREE.Mesh(undefined, new THREE.MeshStandardMaterial({ map: hiddenMap })));
  pedestrian.add(streetHero); scene.add(pedestrian);
  t.mock.method(agents, 'getAgent', (id: string) => id === 'rhineheart' ? manager : id === 'citizen_2' ? pedestrian : null);
  t.mock.method(agents, 'getAgentHero', (id: string) => id === 'rhineheart' ? hero : id === 'citizen_2' ? streetHero : undefined);
  const calls: (THREE.Texture | string)[] = [];
  const renderTarget = new THREE.WebGLRenderTarget(2, 2);
  let target: THREE.WebGLRenderTarget | null = renderTarget;
  const uploaded = new Map<THREE.Texture, number>();
  let floorProgramsReady = false;
  const floorPrograms = ['floor-uniforms-1', 'floor-uniforms-2'].map(name => ({
    isReady: () => floorProgramsReady, getUniforms: () => calls.push(name),
  }));
  const programs: typeof floorPrograms = [];
  lighting.minimumPointSlots = 4;
  const renderer = {
    info: { programs },
    properties: { get: (texture: THREE.Texture) => ({ __version: uploaded.get(texture) }) }, extensions: { has: () => true },
    initTexture: (texture: THREE.Texture) => { calls.push(texture); uploaded.set(texture, texture.version); },
    getRenderTarget: () => target,
    setRenderTarget: (value: typeof target) => { target = value; },
    compile: (subject: THREE.Object3D, eye: THREE.Camera, litScene: THREE.Scene) => {
      assert.equal(subject, hero); assert.equal(eye, camera); assert.equal(litScene, scene);
      assert.ok(target && target !== renderTarget);
      let points = 0; scene.traverseVisible(object => { if (object instanceof THREE.PointLight) points++; });
      assert.equal(points, lighting.minimumPointSlots);
      if (points === 6) programs.push(...floorPrograms);
      calls.push(points === 6 ? 'compile-floor' : 'compile');
    },
  } as unknown as THREE.WebGLRenderer;
  const prepare = (compileColors = true) => agents.prepareOfficeCast(renderer, camera, lighting, compileColors ? 'approach' : 'lift');
  prepare(); assert.deepEqual(calls, []);
  camera.position.z = 120;
  for (const expected of [skin, hair, coat]) {
    prepare(false); assert.equal(calls.at(-1), expected);
    assert.equal(detail.visible, false); assert.equal(hidden.visible, false); assert.equal(hero.parent, detail);
    assert.equal(target, renderTarget);
  }
  prepare(false); assert.deepEqual(calls, [skin, hair, coat], 'riding only needs the textures, while the destination prepares its own lighting');
  prepare(); assert.equal(calls.at(-1), 'compile');
  prepare(); assert.deepEqual(calls, [skin, hair, coat, 'compile']);
  image.complete = true;
  manager.visible = false;
  prepare(false);
  assert.equal(calls.at(-1), cutout, 'the first cutout upload takes an empty lift frame even if the manager is absent');
  prepare(false);
  assert.deepEqual(calls, [skin, hair, coat, 'compile', cutout], 'resident hair and opaque street textures add no uploads');
  assert.equal(streetHair.material.map, cutout);
  assert.equal(streetHair.castShadow, true);

  manager.visible = true;
  lighting.minimumPointSlots = 6;
  const floor = () => agents.prepareOfficeCast(renderer, camera, lighting, 'floor');
  const beforeFloor = calls.length;
  floor();
  assert.deepEqual(calls.slice(beforeFloor), ['compile-floor'], 'the live floor needs its own lighting variant after the commute');
  floor();
  assert.deepEqual(calls.slice(beforeFloor), ['compile-floor'], 'wait for parallel compilation');
  floorProgramsReady = true;
  floor();
  assert.deepEqual(calls.slice(beforeFloor), ['compile-floor', 'floor-uniforms-1']);
  floor(); floor();
  assert.deepEqual(calls.slice(beforeFloor), ['compile-floor', 'floor-uniforms-1', 'floor-uniforms-2']);
  assert.equal(target, renderTarget);
  assert.equal(hero.parent, detail);
  assert.equal(detail.visible, false);
});
