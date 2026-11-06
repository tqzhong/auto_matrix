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
import { WorldState } from '../packages/server/src/world/WorldState.js';
import { AgentManager } from '../packages/server/src/agents/AgentManager.js';

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

test('the occupied lift prepares the hidden office, city and window cleaners with the arrival lights', async t => {
  t.mock.method(THREE.TextureLoader.prototype, 'load', () => new THREE.Texture());
  let resolveCleaners!: (asset: { scene: THREE.Group }) => void;
  const cleanerLoad = t.mock.method(GLTFLoader.prototype, 'loadAsync', () => new Promise(resolve => { resolveCleaners = resolve; }));
  const document = globalThis.document;
  globalThis.document = { createElement: () => ({ getContext: () => ({ fillRect() {}, fillText() {}, strokeRect() {} }) }) } as unknown as Document;
  const scene = new THREE.Scene(), film = new FilmSetRenderer(scene), culling = new LightCulling(scene);
  t.after(() => { film.dispose(); culling.dispose(); globalThis.document = document; });
  culling.minimumPointSlots = 4;
  const lamp = new THREE.PointLight(0xffffff, 8, 10);
  const landing = new THREE.SpotLight(0xffffff, 0); landing.castShadow = true;
  const city = new THREE.Group(), street = new THREE.InstancedMesh(new THREE.BoxGeometry(), new THREE.MeshPhysicalMaterial(), 1);
  const sign = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.Texture(), transparent: true, depthWrite: false, opacity: .9 }));
  const otherSign = new THREE.Sprite(sign.material.clone());
  sign.visible = false;
  const marker = scene.children.find(object => object instanceof THREE.Mesh && object.geometry instanceof THREE.TorusGeometry);
  assert.ok(marker);
  const streetCast = new THREE.Group(), distant = new THREE.Mesh(new THREE.BoxGeometry(), new THREE.MeshStandardMaterial({ vertexColors: true }));
  distant.visible = false; streetCast.add(distant); scene.add(streetCast);
  const hidden = new THREE.Mesh(); hidden.visible = false;
  city.add(lamp, street, hidden, sign, otherSign); scene.add(city, landing);
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
  let neoCompiles = 0, cityCompiles = 0, cleanerCompiles = 0;
  let ready = false;
  const uniformQueries: string[] = [];
  const uniformChecks: boolean[] = [];
  const debug = { checkShaderErrors: true };
  const program = (name: string, linked = true) => ({
    program: { linked }, isReady: () => ready,
    getUniforms: () => { uniformQueries.push(name); uniformChecks.push(debug.checkShaderErrors); },
  });
  const programs: ReturnType<typeof program>[] = [];
  const versions = new Map<THREE.Texture, number>(), uploads: THREE.Texture[] = [];
  const renderer = {
    info: { programs }, debug,
    getContext: () => ({ LINK_STATUS: 0x8b82, getProgramParameter: (handle: { linked: boolean }, parameter: number) => {
      assert.equal(parameter, 0x8b82); return handle.linked;
    } }),
    extensions: { has: () => true },
    properties: { get: (texture: THREE.Texture) => ({ __version: versions.get(texture) }) },
    initTexture: (texture: THREE.Texture) => { uploads.push(texture); versions.set(texture, texture.version); },
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
      if (root.name === 'office-window-cleaners') {
        assert.equal(litScene.getObjectByName(root.name), root, 'the cleaners compile against the actual detached floor lights');
        assert.equal(root.children.length, 6, 'prepare the two complete actors and their tools');
        cleanerCompiles++;
        programs.push(program('cleaners'));
        return;
      }
      const materials: THREE.Object3D[] = [];
      root.traverse(object => { if (object instanceof THREE.Mesh || object instanceof THREE.Sprite) materials.push(object); });
      if (materials.includes(street)) {
        assert.deepEqual(materials.map(object => object.id), [street.id, sign.id, marker.id, distant.id],
          'the city batch includes one sign, the exit marker, and the shared distant-character color program');
        assert.equal(street.parent, city);
        assert.equal(sign.parent, city);
        assert.equal(sign.visible, false);
        assert.equal(marker.parent, scene);
        assert.equal(marker.visible, false);
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
        programs.push(program(material, material !== 'carpet'));
    },
  } as unknown as THREE.WebGLRenderer;
  film.update(player, sandbox, 0);
  const prepare = () => film.prepareOffice(renderer, camera, culling, player, sandbox, neo, city, distant);
  assert.equal(prepare(), true, 'building the detached floor uses this frame');
  assert.deepEqual(cleanerLoad.mock.calls.map(call => call.arguments), [['/assets/characters/club-male.glb']],
    'request the window cleaners during the lift before the floor attaches');
  for (let i = 1; i < 9; i++) prepare();
  assert.equal(windows.length, 1);
  assert.equal(neoCompiles, 1);
  assert.equal(cityCompiles, 1);
  assert.deepEqual(uniformQueries, [], 'an unfinished program must not stall the lift');
  programs.splice(1, 1);
  ready = true;
  assert.equal(prepare(), true);
  assert.deepEqual(uniformQueries, ['glass'], 'one ready program is prepared per frame');
  assert.deepEqual(uniformChecks, [false], 'successful links cache their locations without querying diagnostics');
  assert.equal(debug.checkShaderErrors, true);
  assert.equal(prepare(), true);
  assert.deepEqual(uniformQueries, ['glass', 'carpet'], 'a released program is skipped');
  assert.deepEqual(uniformChecks, [false, true], 'failed links keep the normal error reporting');
  assert.equal(prepare(), false, 'the idle preparation slot can upload one actor texture');
  const skin = new THREE.Texture({ width: 2048, height: 2048 }); skin.needsUpdate = true;
  const hair = new THREE.Texture({ width: 2048, height: 2048 }); hair.needsUpdate = true;
  const cleaner = new THREE.Group();
  cleaner.add(new THREE.Mesh(new THREE.BoxGeometry(), new THREE.MeshStandardMaterial({ map: skin })),
    new THREE.Mesh(new THREE.BoxGeometry(), new THREE.MeshStandardMaterial({ map: hair })));
  resolveCleaners({ scene: cleaner });
  await Promise.resolve();
  assert.equal(prepare(), true);
  assert.equal(cleanerCompiles, 1);
  assert.deepEqual(uploads, []);
  assert.equal(prepare(), true);
  assert.equal(uniformQueries.at(-1), 'cleaners');
  assert.equal(prepare(), true);
  assert.deepEqual(uploads, [skin]);
  assert.equal(prepare(), true);
  assert.deepEqual(uploads, [skin, hair], 'one existing shared map is uploaded per frame');
  assert.equal(prepare(), false);
  assert.equal(scene.getObjectByName('office-window-cleaners'), undefined);
  assert.equal(scene.getObjectByName('office-window-glass'), undefined);
  assert.equal(lamp.intensity, 8);
  assert.equal(culling.minimumPointSlots, 4, 'the elevator keeps its own light layout while the office is prepared');
  assert.equal(target, null);
  assert.deepEqual(sandbox, before);
  let released = false;
  const releasedMaps: THREE.Texture[] = [];
  for (const map of [skin, hair]) map.addEventListener('dispose', () => { releasedMaps.push(map); });
  windows[0].geometry.addEventListener('dispose', () => { released = true; });
  film.prepareOffice(renderer, camera, culling, undefined, sandbox);
  assert.equal(released, true, 'leaving the lift releases the detached office');
  assert.deepEqual(releasedMaps, [skin, hair], 'leaving the lift releases both prepared shared maps');
  for (let i = 0; i < 6; i++) film.prepareOffice(renderer, camera, culling, player, sandbox);
  player.position = metacortexPosition(0, -29, 1);
  film.update(player, sandbox, 0);
  assert.equal(film.active?.id, 'film_metacortex_floor');
  assert.ok(scene.getObjectByName('office-window-glass') === windows[1]);
});

test('a cold office floor prepares the existing park color program before turning toward it', t => {
  t.mock.method(THREE.TextureLoader.prototype, 'load', () => new THREE.Texture());
  t.mock.method(GLTFLoader.prototype, 'loadAsync', () => new Promise(() => {}));
  const document = globalThis.document;
  globalThis.document = { createElement: () => ({ getContext: () => ({ fillRect() {}, fillText() {}, strokeRect() {} }) }) } as unknown as Document;
  const scene = new THREE.Scene(), film = new FilmSetRenderer(scene), culling = new LightCulling(scene);
  t.after(() => { film.dispose(); culling.dispose(); globalThis.document = document; });
  const city = new THREE.Group(), canopy = new THREE.InstancedMesh(new THREE.SphereGeometry(), new THREE.MeshStandardMaterial(), 1);
  canopy.name = 'central-park-canopy'; canopy.setColorAt(0, new THREE.Color(0x52694a));
  city.add(canopy, new THREE.Mesh()); scene.add(city);
  const position = metacortexPosition(0, -23, 1);
  const player = { id: 'neo', position, isInMatrix: true } as AgentState;
  const journey: FilmJourney = { version: 1, scene: 'm1_boss', actor: 'neo', step: 0, completed: [], enteredAt: 0,
    reflections: {}, checkpoint: position, lastText: '' };
  const sandbox = { threats: [], neoLife: { journey } } as unknown as SandboxState;
  const camera = new THREE.PerspectiveCamera();
  camera.position.set(position.x, position.y + 4, position.z);
  culling.minimumPointSlots = 6;
  film.update(player, sandbox, 0);
  assert.equal(film.active?.id, 'film_metacortex_floor');
  let ready = false, compiles = 0, queries = 0;
  const debug = { checkShaderErrors: true };
  const program = { program: {}, isReady: () => ready, getUniforms: () => {
    assert.equal(debug.checkShaderErrors, false, 'the linked canopy program skips the diagnostics query');
    queries++;
  } };
  const properties = { get: (material: THREE.Material) => {
    assert.equal(material, canopy.material);
    return { currentProgram: program };
  } };
  let target: THREE.WebGLRenderTarget | null = null;
  const gpu = {
    properties, info: { programs: [program] }, debug,
    getContext: () => ({ LINK_STATUS: 0x8b82, getProgramParameter: () => true }),
    extensions: { has: () => true },
    getRenderTarget: () => target,
    setRenderTarget: (next: typeof target) => { target = next; },
    compile: (subject: THREE.Group, eye: THREE.Camera, litScene: THREE.Scene) => {
      const objects: THREE.Object3D[] = [];
      subject.traverse(object => objects.push(object));
      assert.deepEqual(objects, [canopy]);
      assert.equal(canopy.parent, city);
      assert.equal(eye, camera);
      assert.ok(litScene.getObjectByName('office-window-glass'));
      assert.equal(target?.width, 1);
      compiles++;
    },
  };
  const renderer = gpu as unknown as THREE.WebGLRenderer;
  const prepare = (save = sandbox) => film.prepareOffice(renderer, camera, culling, player, save, undefined, city);
  assert.equal(prepare({ ...sandbox, neoLife: { ...sandbox.neoLife, journey: { ...journey, visiting: 'm1_boss' } } }), false);
  assert.equal(compiles, 0);
  assert.equal(prepare(), true, 'a loaded floor still needs the city program without an elevator ride');
  assert.equal(prepare(), false, 'an unfinished shader leaves the frame free');
  assert.equal(queries, 0);
  ready = true;
  assert.equal(prepare(), true);
  assert.equal(queries, 1, 'finish the matching program even when another mesh has already linked it');
  assert.equal(debug.checkShaderErrors, true);
  assert.equal(prepare(), false);
  assert.equal(compiles, 1);
  assert.equal(target, null);
  gpu.properties = { ...properties };
  assert.equal(prepare(), true, 'a recreated GPU context prepares its own color program');
  assert.equal(compiles, 2);
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

test('the office drops street shadow rays outside the view and retains the other lights', t => {
  t.mock.method(GLTFLoader.prototype, 'loadAsync', () => new Promise(() => {}));
  t.mock.method(THREE.TextureLoader.prototype, 'load', () => new THREE.Texture());
  const document = globalThis.document;
  const gradient = { addColorStop() {} };
  globalThis.document = { createElement: () => ({ getContext: () => ({
    createRadialGradient: () => gradient, createImageData: (w: number, h: number) => ({ data: new Uint8ClampedArray(w * h * 4) }),
    fillRect() {}, fillText() {}, strokeRect() {}, putImageData() {},
  }) }) } as unknown as Document;
  const scene = new THREE.Scene(), agents = new AgentRenderer(scene);
  t.after(() => { agents.dispose(); globalThis.document = document; });
  const world = new WorldState(); new AgentManager(world).initializeAllAgents();
  const citizen = { ...world.agents.get('citizen_2')!, currentLocation: 'downtown', position: { x: 1113, y: 1, z: 916 } };
  agents.updateAgent(citizen.id, citizen);
  const group = agents.getAgent(citizen.id)!, casters: THREE.Mesh[] = [];
  group.traverseVisible(object => { if (object instanceof THREE.Mesh && object.castShadow) casters.push(object); });
  assert.ok(casters.length > 0);
  const sun = new THREE.DirectionalLight(), camera = new THREE.PerspectiveCamera(57, 16/9, .1, 600);
  sun.castShadow = true; sun.position.set(1097, 194, 901); sun.target.position.set(1125, 65, 856);
  scene.add(sun, sun.target);
  camera.position.set(1125.4, 69.6, 858);
  camera.lookAt(1116, 67, 852.3);
  const cull = () => agents.cullOfficeStreetShadows(camera, sun);
  const casting = () => casters.every(object => object.castShadow);
  cull();
  assert.ok(casters.every(object => !object.castShadow && object.visible), 'the invisible street shadow leaves its visible body state intact');
  agents.restoreOfficeStreetShadows();
  assert.ok(casting(), 'the next pass starts with the original shadows');

  const landing = new THREE.SpotLight(0xffffff, 1, 20, .8);
  landing.castShadow = true; landing.position.set(1113, 12, 916); landing.target.position.copy(group.position);
  scene.add(landing, landing.target);
  cull();
  assert.ok(casting(), 'another active shadow camera still needs this caster');
  landing.position.set(1210, 8.3, 706); landing.target.position.set(1210, 0, 700);
  camera.lookAt(1113, 3, 916);
  cull();
  assert.ok(casting(), 'looking down at the street preserves the shadow');

  group.position.set(0, 1, 15);
  camera.position.set(0, 4, 0); camera.lookAt(0, 4, -20);
  sun.position.set(0, 34, 40); sun.target.position.set(0, 0, -40);
  cull();
  assert.ok(casting(), 'an off-camera caster can still project a shadow into the view');
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
  const debug = { checkShaderErrors: true };
  const floorPrograms = ['floor-uniforms-1', 'floor-uniforms-2'].map(name => ({
    program: {}, isReady: () => floorProgramsReady, getUniforms: () => {
      assert.equal(debug.checkShaderErrors, false, 'the linked manager program skips the diagnostics query');
      calls.push(name);
    },
  }));
  const programs: typeof floorPrograms = [];
  lighting.minimumPointSlots = 4;
  const renderer = {
    info: { programs }, debug,
    getContext: () => ({ LINK_STATUS: 0x8b82, getProgramParameter: () => true }),
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
  assert.equal(debug.checkShaderErrors, true);
  assert.equal(target, renderTarget);
  assert.equal(hero.parent, detail);
  assert.equal(detail.visible, false);
});
