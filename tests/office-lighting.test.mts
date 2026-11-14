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
import { SandboxRenderer } from '../packages/client/src/engine/SandboxRenderer.js';
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

test('office batches fill depth with the walls and solid furniture ahead of the exterior', () => {
  const office = new OfficeSetRenderer(undefined, FILM_SETS.film_metacortex_floor);
  const walls = new THREE.MeshStandardMaterial(), floor = new THREE.MeshStandardMaterial(), ceiling = new THREE.MeshStandardMaterial();
  const furniture = new THREE.MeshStandardMaterial();
  const materials = [walls, floor, ceiling, furniture, new THREE.MeshStandardMaterial({ transparent: true, opacity: .3 }),
    new THREE.MeshStandardMaterial({ depthWrite: false }), new THREE.MeshStandardMaterial({ depthTest: false }),
    new THREE.MeshStandardMaterial({ alphaTest: .5 }), new THREE.MeshPhysicalMaterial({ transmission: .8 })];
  try {
    office.root.add(...materials.map(material => new THREE.Mesh(new THREE.BoxGeometry(), material)));
    office['batch'](walls, [floor, ceiling]);
    assert.deepEqual(office.root.children.map(mesh => mesh.renderOrder), [-1, 0, 0, -.5, 0, 0, 0, 0, 0]);
  } finally {
    office.dispose(); materials.forEach(material => material.dispose());
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
    const keys = office.root.getObjectByName('office-keyboard-keys');
    assert.ok(keys instanceof THREE.InstancedMesh, 'every workstation draws the same key geometry');
    assert.equal(officeKeys.length, 0, 'the material batch does not duplicate key vertices');
    assert.equal(keys.count, OFFICE_DESKS.length * 52);
    assert.equal(keys.castShadow && keys.receiveShadow, true);
    assert.equal(keys.geometry.index?.count, officeKey.attributes.position.count, 'the complete beveled surface uses shared vertices');
    assert.ok(keys.geometry.attributes.position.count < officeKey.attributes.position.count / 3);
    const expanded = keys.geometry.toNonIndexed();
    try {
      for (const name of ['position', 'normal', 'uv']) assert.deepEqual(expanded.getAttribute(name).array, officeKey.getAttribute(name).array);
    } finally { expanded.dispose(); }
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

test('the occupied lift prepares the hidden office, city, cleaners and manager with the arrival lights', async t => {
  t.mock.method(THREE.TextureLoader.prototype, 'load', () => new THREE.Texture());
  let resolveCleaners!: (asset: { scene: THREE.Group }) => void;
  const cleanerLoad = t.mock.method(GLTFLoader.prototype, 'loadAsync', () => new Promise(resolve => { resolveCleaners = resolve; }));
  const document = globalThis.document;
  globalThis.document = { createElement: () => ({ getContext: () => ({ fillRect() {}, fillText() {}, strokeRect() {} }) }) } as unknown as Document;
  const scene = new THREE.Scene(), film = new FilmSetRenderer(scene), culling = new LightCulling(scene);
  const environment = new THREE.Texture(); scene.environment = environment; scene.fog = new THREE.FogExp2(0x071410, .00125);
  t.after(() => environment.dispose());
  t.after(() => { film.dispose(); culling.dispose(); globalThis.document = document; });
  culling.minimumPointSlots = 4;
  const lamp = new THREE.PointLight(0xffffff, 8, 10);
  const landing = new THREE.SpotLight(0xffffff, 0); landing.castShadow = true;
  const city = new THREE.Group(), street = new THREE.InstancedMesh(new THREE.BoxGeometry(), [new THREE.MeshPhysicalMaterial()], 1);
  street.castShadow = true;
  const sign = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.Texture(), transparent: true, depthWrite: false, opacity: .9 }));
  const otherSign = new THREE.Sprite(sign.material.clone());
  sign.visible = false;
  const marker = scene.children.find(object => object instanceof THREE.Mesh && object.geometry instanceof THREE.TorusGeometry);
  assert.ok(marker instanceof THREE.Mesh && marker.material instanceof THREE.MeshBasicMaterial);
  const streetCast = new THREE.Group(), distant = new THREE.Mesh(new THREE.BoxGeometry(), new THREE.MeshStandardMaterial({ vertexColors: true }));
  distant.visible = false; streetCast.add(distant); scene.add(streetCast);
  const limb = new THREE.SkinnedMesh(new THREE.BufferGeometry(), new THREE.MeshPhysicalMaterial({ side: THREE.DoubleSide }));
  limb.castShadow = true; streetCast.add(limb);
  t.after(() => { limb.geometry.dispose(); limb.material.dispose(); });
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
  const unlit = new THREE.MeshBasicMaterial(), lit = new THREE.MeshStandardMaterial();
  const mixed = new THREE.Mesh(new THREE.BoxGeometry(), [unlit, lit]); neo.add(mixed);
  t.after(() => { mixed.geometry.dispose(); unlit.dispose(); lit.dispose(); });
  const headGeometry = new THREE.BoxGeometry(), trousersGeometry = new THREE.BoxGeometry(), skinSurface = new THREE.MeshStandardMaterial();
  headGeometry.morphAttributes.position = [headGeometry.attributes.position.clone()];
  const head = new THREE.SkinnedMesh(headGeometry, skinSurface), trousers = new THREE.SkinnedMesh(trousersGeometry, skinSurface);
  head.castShadow = trousers.castShadow = true;
  const hiddenSkin = new THREE.SkinnedMesh(trousersGeometry, skinSurface); hiddenSkin.castShadow = true; hiddenSkin.visible = false;
  neo.add(head, trousers, hiddenSkin);
  t.after(() => { headGeometry.dispose(); trousersGeometry.dispose(); skinSurface.dispose(); });
  const versionsBefore = [unlit.version, lit.version, marker.material.version, sign.material.version];
  const manager = new THREE.Group(), managerParent = new THREE.Group();
  managerParent.visible = false; managerParent.add(manager); scene.add(managerParent);
  let managerLoaded = false;
  let neoCompiles = 0, cityCompiles = 0, cleanerCompiles = 0, managerCompiles = 0;
  const shadowCompiles: { points: number; spots: number }[] = [];
  const depthPrograms = new Set<string>();
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
    info: { programs }, debug, shadowMap: { enabled: true },
    getContext: () => ({ LINK_STATUS: 0x8b82, getProgramParameter: (handle: { linked: boolean }, parameter: number) => {
      assert.equal(parameter, 0x8b82); return handle.linked;
    } }),
    extensions: { has: () => true },
    properties: { get: (texture: THREE.Texture) => ({ __version: versions.get(texture) }) },
    initTexture: (texture: THREE.Texture) => { uploads.push(texture); versions.set(texture, texture.version); },
    getRenderTarget: () => target,
    setRenderTarget: (next: typeof target) => { target = next; },
    compile: (root: THREE.Object3D, eye: THREE.Camera, litScene: THREE.Scene) => {
      assert.ok(target);
      assert.equal(eye.position.y, eye === camera ? position.y + 4 : 70);
      let points = 0, spots = 0, casters = 0;
      for (const group of root === neo ? [litScene] : [root, litScene]) group.traverseVisible(object => {
        if (object instanceof THREE.PointLight) points++;
        if (object instanceof THREE.SpotLight) spots++;
        if (object instanceof THREE.Light && object.castShadow) casters++;
      });
      const depths: THREE.Mesh<THREE.BufferGeometry, THREE.MeshDepthMaterial>[] = [];
      root.traverse(object => { if (object instanceof THREE.Mesh && object.material instanceof THREE.MeshDepthMaterial) depths.push(object); });
      if (depths.length) {
        assert.equal(root.parent, null);
        assert.equal(depths.length, 6, 'prepare the tower, rigid office, actual skinned actor and both street depth variants');
        const [tower, fixed, face, pants, skinned, rigid] = depths;
        assert.ok(tower instanceof THREE.InstancedMesh);
        assert.equal(tower.geometry, street.geometry);
        assert.equal(tower.count, 0, 'preparation must not draw a second city');
        assert.equal(tower.material.side, THREE.BackSide);
        assert.ok(!(fixed instanceof THREE.InstancedMesh) && !(fixed instanceof THREE.SkinnedMesh));
        assert.equal(fixed.geometry, street.geometry);
        assert.equal(fixed.material, tower.material);
        assert.ok(face instanceof THREE.SkinnedMesh && pants instanceof THREE.SkinnedMesh);
        assert.equal(face.geometry, headGeometry); assert.equal(pants.geometry, trousersGeometry);
        assert.deepEqual(face.morphTargetInfluences, head.morphTargetInfluences, 'prepare the authored head morph layout');
        assert.equal(face.material, tower.material); assert.equal(pants.material, tower.material);
        assert.equal(head.parent, neo); assert.equal(trousers.parent, neo);
        assert.ok(skinned instanceof THREE.SkinnedMesh);
        assert.ok(!(rigid instanceof THREE.SkinnedMesh));
        assert.equal(skinned.geometry, limb.geometry);
        assert.equal(rigid.geometry, limb.geometry);
        assert.equal(skinned.material, rigid.material);
        assert.equal(skinned.material.side, THREE.DoubleSide);
        assert.match(skinned.material.customProgramCacheKey(), /actor-local-skin-v1$/);
        assert.ok(depths.every(mesh => mesh.material.depthPacking === THREE.RGBADepthPacking && !mesh.material.map));
        assert.equal(limb.parent, streetCast);
        assert.equal(litScene.fog, null);
        assert.ok(casters > 0, 'both variants are used while shadows are enabled');
        shadowCompiles.push({ points, spots });
        const light = points === 0 ? 'zero-light' : points === 4 ? 'street' : 'office';
        for (const key of ['depth', 'fixed depth', 'face depth', 'pants depth', 'street skin', 'street depth']) {
          const name = `${light} ${key}`;
          if (!depthPrograms.has(name)) { programs.push(program(name)); depthPrograms.add(name); }
        }
        return;
      }
      assert.notEqual(litScene, scene, 'office preparation must leave the live street light state for the next shadow pass');
      assert.equal(litScene.environment, environment); assert.equal(litScene.fog, scene.fog);
      if (root !== manager && root.children.length === 0 && root.traverse === THREE.Object3D.prototype.traverse) return;
      const objects: THREE.Object3D[] = [];
      litScene.traverseVisible(object => objects.push(object));
      const officeWindow = objects.find(object => object.name === 'office-window-glass');
      assert.deepEqual({ points, spots }, { points: 6, spots: 5 });
      if (root === neo) {
        assert.ok(officeWindow);
        neoCompiles++;
        return;
      }
      if (root === manager) {
        assert.ok(officeWindow);
        assert.equal(manager.parent, managerParent);
        assert.equal(managerParent.visible, false);
        managerCompiles++;
        programs.push(program('manager'));
        return;
      }
      if (root.name === 'office-window-cleaners') {
        assert.ok(objects.includes(root), 'the cleaners compile against the actual detached floor lights');
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
        assert.ok(officeWindow);
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
  const prepare = () => film.prepareOffice(renderer, camera, culling, player, sandbox, neo, city, distant, managerLoaded ? manager : undefined, streetCast);
  assert.equal(prepare(), true, 'building the detached floor uses this frame');
  assert.deepEqual(cleanerLoad.mock.calls.map(call => call.arguments), [['/assets/characters/club-male.glb']],
    'request the window cleaners during the lift before the floor attaches');
  for (let i = 1; i < 9; i++) prepare();
  assert.equal(windows.length, 1);
  assert.equal(neoCompiles, 1);
  assert.equal(cityCompiles, 1);
  assert.deepEqual(shadowCompiles, [{ points: 0, spots: 0 }, { points: 6, spots: 5 }, { points: 0, spots: 0 }, { points: 4, spots: 1 }]);
  assert.ok(unlit.version > versionsBefore[0], 'unlit actor materials must reselect the live program after arrival preparation');
  assert.equal(lit.version, versionsBefore[1], 'lit materials already reselect on light-state changes');
  assert.ok(marker.material.version > versionsBefore[2], 'the live marker must reselect its street program');
  assert.ok(sign.material.version > versionsBefore[3], 'the city sprite must reselect its street program');
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
  for (const light of ['zero-light', 'office', 'street']) for (const key of ['depth', 'fixed depth', 'face depth', 'pants depth', 'street skin', 'street depth']) {
    assert.equal(prepare(), true);
    assert.equal(uniformQueries.at(-1), `${light} ${key}`, 'cache the locations of one ready shadow program per frame');
  }
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
  managerLoaded = true;
  assert.equal(prepare(), true, 'link the manager when the hero becomes available inside the lift');
  assert.equal(managerCompiles, 1);
  assert.equal(prepare(), true, 'prepare the linked locations in a subsequent lift frame');
  assert.equal(uniformQueries.at(-1), 'manager');
  assert.equal(prepare(), false);
  assert.equal(managerCompiles, 1);
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

test('window cleaner maps upload one strip per lift frame and finish normally after an early arrival', async t => {
  class Bitmap { width = 2048; height = 2048; }
  const originalBitmap = globalThis.ImageBitmap, document = globalThis.document;
  globalThis.ImageBitmap = Bitmap as unknown as typeof ImageBitmap;
  globalThis.document = { createElement: () => ({ getContext: () => ({ fillRect() {}, fillText() {}, strokeRect() {} }) }) } as unknown as Document;
  t.mock.method(THREE.TextureLoader.prototype, 'load', () => new THREE.Texture());
  const skinImage = new Bitmap(), hairImage = new Bitmap();
  const skin = new THREE.Texture(skinImage), hair = new THREE.Texture(hairImage);
  const scene = new THREE.Group();
  for (const map of [skin, hair]) {
    map.flipY = false; map.needsUpdate = true;
    scene.add(new THREE.Mesh(new THREE.BoxGeometry(), new THREE.MeshStandardMaterial({ map })));
  }
  t.mock.method(GLTFLoader.prototype, 'loadAsync', async () => ({ scene }));
  const set = FILM_SETS.film_metacortex_floor, office = new OfficeSetRenderer(undefined, set);
  t.after(() => {
    office.dispose(); globalThis.document = document;
    if (originalBitmap) globalThis.ImageBitmap = originalBitmap;
    else Reflect.deleteProperty(globalThis, 'ImageBitmap');
  });
  const versions = new Map<THREE.Texture, number>();
  const allocations: { texture: THREE.Texture; dataReady: boolean }[] = [];
  const copies: { texture: THREE.Texture; start: number; end: number; mipmaps: boolean }[] = [];
  let unpackRow = 0, boundTexture: THREE.Texture | undefined;
  const gl = {
    TEXTURE_2D: 0x0de1, UNPACK_SKIP_ROWS: 0x0cf3, RGBA: 0x1908, UNSIGNED_BYTE: 0x1401,
    pixelStorei(parameter: number, row: number) {
      assert.equal(parameter, this.UNPACK_SKIP_ROWS);
      unpackRow = row;
    },
    texSubImage2D(target: number, level: number, x: number, row: number, width: number, height: number,
      format: number, type: number, image: Bitmap) {
      assert.deepEqual([target, level, x, width, format, type], [this.TEXTURE_2D, 0, 0, 2048, this.RGBA, this.UNSIGNED_BYTE]);
      assert.equal(unpackRow, row);
      assert.ok(boundTexture);
      assert.equal(image, boundTexture.image, 'reuse the original image as the upload source');
      copies.push({ texture: boundTexture, start: row, end: row + height, mipmaps: false });
    },
    generateMipmap(target: number) {
      assert.equal(target, this.TEXTURE_2D);
      copies.at(-1)!.mipmaps = true;
    },
  };
  const renderer = {
    capabilities: { maxTextureSize: 4096 },
    getContext: () => gl,
    properties: { get: (texture: THREE.Texture) => ({ __version: versions.get(texture), __webglTexture: versions.has(texture) ? texture : undefined }) },
    state: {
      bindTexture: (target: number, texture: THREE.Texture) => { assert.equal(target, gl.TEXTURE_2D); boundTexture = texture; },
      unbindTexture: () => { boundTexture = undefined; },
    },
    initTexture: (texture: THREE.Texture) => {
      allocations.push({ texture, dataReady: texture.source.dataReady });
      versions.set(texture, texture.version);
    },
    copyTextureToTexture: () => assert.fail('upload rows without the synchronous unpack-state reads'),
  } as unknown as THREE.WebGLRenderer;
  office.requestWindowCleaners();
  await Promise.resolve();
  for (let row = 0; row < 2048; row += 256) {
    assert.equal(office.prepareWindowCleanerTexture(renderer), true);
    assert.deepEqual(allocations, [{ texture: skin, dataReady: false }], 'allocate without uploading the full image');
    assert.equal(copies.length, row / 256 + 1);
    assert.deepEqual(copies.at(-1), { texture: skin, start: row, end: row + 256, mipmaps: row + 256 === 2048 });
    assert.equal(unpackRow, 0); assert.equal(boundTexture, undefined);
    assert.equal(skin.generateMipmaps, true);
    assert.equal(skin.source.dataReady, true);
  }
  assert.equal(office.prepareWindowCleanerTexture(renderer), true);
  assert.deepEqual(copies.at(-1), { texture: hair, start: 0, end: 256, mipmaps: false });
  const stagedVersion = hair.version;
  office.attach(new THREE.Group(), set);
  assert.ok(hair.version > stagedVersion, 'an interrupted texture must be uploaded again before drawing');
  assert.equal(office.prepareWindowCleanerTexture(renderer), true);
  assert.deepEqual(allocations.slice(1), [{ texture: hair, dataReady: false }, { texture: hair, dataReady: true }]);
  assert.equal(office.prepareWindowCleanerTexture(renderer), false);
  assert.equal(copies.length, 9);
  assert.equal(skin.image, skinImage); assert.equal(hair.image, hairImage);
});

for (const street of [true, false]) test(`a cold ${street ? 'commute street' : 'office floor'} prepares the existing park color program before turning toward it`, t => {
  t.mock.method(THREE.TextureLoader.prototype, 'load', () => new THREE.Texture());
  t.mock.method(GLTFLoader.prototype, 'loadAsync', () => new Promise(() => {}));
  const document = globalThis.document;
  globalThis.document = { createElement: () => ({ getContext: () => ({ fillRect() {}, fillText() {}, strokeRect() {} }) }) } as unknown as Document;
  const scene = new THREE.Scene(), film = new FilmSetRenderer(scene), culling = new LightCulling(scene);
  const environment = new THREE.Texture(); scene.environment = environment; scene.fog = new THREE.FogExp2(0x071410, .00125);
  t.after(() => { film.dispose(); culling.dispose(); environment.dispose(); globalThis.document = document; });
  const city = new THREE.Group(), canopy = new THREE.InstancedMesh(new THREE.SphereGeometry(), new THREE.MeshStandardMaterial(), 1);
  canopy.name = 'central-park-canopy'; canopy.setColorAt(0, new THREE.Color(0x52694a));
  city.add(canopy, new THREE.Mesh()); scene.add(city);
  const position = street ? { x: 1200, y: 1, z: 820 } : metacortexPosition(0, -23, 1);
  const player = { id: 'neo', position, isInMatrix: true } as AgentState;
  const journey: FilmJourney = { version: 1, scene: street ? 'm1_commute' : 'm1_boss', actor: 'neo', step: 0, completed: [], enteredAt: 0,
    reflections: {}, checkpoint: position, lastText: '' };
  const sandbox = { threats: [], neoLife: { journey } } as unknown as SandboxState;
  const camera = new THREE.PerspectiveCamera();
  camera.position.set(position.x, position.y + 4, position.z);
  culling.minimumPointSlots = street ? 4 : 6;
  film.update(player, sandbox, 0);
  assert.equal(film.active?.id, street ? undefined : 'film_metacortex_floor');
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
      assert.notEqual(litScene, scene, 'preparation must not change the live render state used by the next shadow pass');
      assert.equal(litScene.environment, environment); assert.equal(litScene.fog, scene.fog);
      const visible: THREE.Object3D[] = [], actualLights: THREE.PointLight[] = [];
      litScene.traverseVisible(object => visible.push(object));
      scene.traverseVisible(object => { if (object instanceof THREE.PointLight) actualLights.push(object); });
      assert.equal(visible.some(object => object.name === 'office-window-glass'), !street);
      assert.deepEqual(visible.filter(object => object instanceof THREE.PointLight), actualLights);
      assert.ok(actualLights.length >= culling.minimumPointSlots);
      assert.equal(target?.width, 1);
      compiles++;
    },
  };
  const renderer = gpu as unknown as THREE.WebGLRenderer;
  const prepare = (save = sandbox) => film.prepareOffice(renderer, camera, culling, player, save, undefined, city);
  assert.equal(prepare({ ...sandbox, neoLife: { ...sandbox.neoLife, journey: { ...journey, visiting: 'm1_boss' } } }), false);
  assert.equal(compiles, 0);
  assert.equal(prepare(), true, 'prepare the existing park before the street turn or a direct office load');
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

test('the office prepares the city sign and masked Smith shadow before answering', t => {
  const scene = new THREE.Scene(), film = new FilmSetRenderer(scene), lighting = new LightCulling(scene);
  const camera = new THREE.PerspectiveCamera(), city = new THREE.Group(), smith = new THREE.Group();
  const sign = new THREE.Sprite(); city.add(sign); scene.add(city);
  const map = new THREE.Texture(); map.name = 'smith-eyes.png';
  const eyes = new THREE.SkinnedMesh(undefined, new THREE.MeshPhysicalMaterial({ map, alphaTest: .42, side: THREE.DoubleSide }));
  eyes.castShadow = true; smith.add(eyes);
  t.after(() => { film.dispose(); lighting.dispose(); sign.material.dispose(); eyes.geometry.dispose(); eyes.material.dispose(); map.dispose(); });

  const tasks: string[] = [], debug = { checkShaderErrors: true };
  const programs: { program: object; isReady(): boolean; getUniforms(): void }[] = [];
  let ready = false, target: THREE.WebGLRenderTarget | null = null, depth: THREE.MeshDepthMaterial | undefined;
  const program = (name: string) => ({ program: {}, isReady: () => ready, getUniforms: () => {
    assert.equal(debug.checkShaderErrors, false); tasks.push(name);
  } });
  const gpu = {
    properties: {}, info: { programs }, debug, shadowMap: { enabled: true }, extensions: { has: () => true },
    getRenderTarget: () => target, setRenderTarget: (next: typeof target) => { target = next; },
    getContext: () => ({ LINK_STATUS: 0x8b82, getProgramParameter: () => true }),
    compile: (subject: THREE.Object3D, eye: THREE.Camera, litScene: THREE.Scene) => {
      assert.equal(eye, camera); assert.equal(target?.width, 1);
      if (subject instanceof THREE.SkinnedMesh) {
        assert.notEqual(litScene, scene); assert.equal(subject.geometry, eyes.geometry);
        const material = subject.material;
        assert(material instanceof THREE.MeshDepthMaterial);
        assert.equal(material.map, map); assert.equal(material.alphaTest, .42);
        assert.equal(material.side, THREE.DoubleSide); assert.equal(material.depthPacking, THREE.RGBADepthPacking);
        assert.match(material.customProgramCacheKey(), /actor-local-skin-v1$/);
        if (!depth) { depth = material; programs.push(program('shadow locations')); }
        tasks.push('shadow');
      } else {
        const batch: THREE.Object3D[] = []; subject.traverse(object => batch.push(object));
        assert.deepEqual(batch, [sign]); assert.equal(litScene, scene);
        tasks.push('sign'); programs.push(program('sign locations'));
      }
    },
  } as unknown as THREE.WebGLRenderer;
  const prepare = () => film.prepareOfficePhone?.(gpu, camera, lighting, city, smith);
  assert.equal(prepare(), true);
  assert.deepEqual(tasks, ['sign', 'shadow', 'shadow']);
  assert.equal(prepare(), false);
  ready = true;
  assert.equal(prepare(), true); assert.deepEqual(tasks.slice(3), ['sign locations']);
  assert.equal(prepare(), true); assert.deepEqual(tasks.slice(3), ['sign locations', 'shadow locations']);
  assert.equal(prepare(), false);
  assert.equal(eyes.material.map, map); assert.equal(eyes.customDepthMaterial, undefined); assert.equal(sign.parent, city);
  assert.equal(target, null); assert.equal(debug.checkShaderErrors, true);
});

test('the commute prepares Neo’s hidden office clothes before the first commute draw', t => {
  const scene = new THREE.Scene(), film = new FilmSetRenderer(scene), lighting = new LightCulling(scene);
  const camera = new THREE.PerspectiveCamera(), actor = new THREE.Group();
  const map = new THREE.Texture({ width: 2048, height: 2048 }); map.needsUpdate = true;
  const torso = new THREE.SkinnedMesh(new THREE.BufferGeometry(), new THREE.MeshStandardMaterial({ map }));
  torso.name = 'Office_torso'; torso.userData.office = true; torso.visible = false;
  const shirt = new THREE.SkinnedMesh(new THREE.BufferGeometry(), new THREE.MeshStandardMaterial());
  shirt.name = 'Office_shirt'; shirt.userData.office = true; shirt.visible = false;
  const wrist = new THREE.SkinnedMesh(new THREE.BufferGeometry(), new THREE.MeshPhysicalMaterial());
  wrist.name = 'Anatomical_wrist_skin'; wrist.visible = false;
  const coat = new THREE.SkinnedMesh(); actor.add(torso, shirt, wrist, coat);
  t.after(() => {
    film.dispose(); lighting.dispose(); map.dispose();
    for (const mesh of [torso, shirt, wrist, coat]) { mesh.geometry.dispose(); mesh.material.dispose(); }
  });
  const tasks: string[] = [], debug = { checkShaderErrors: true };
  const programs: { program: object; isReady(): boolean; getUniforms(): void }[] = [];
  let renderTarget: THREE.WebGLRenderTarget | null = null, uploaded = false;
  const gpu = {
    properties: { get: (object: object) => object === map && uploaded ? { __version: map.version } : {} },
    info: { programs }, debug, extensions: { has: () => true },
    getRenderTarget: () => renderTarget,
    setRenderTarget: (target: typeof renderTarget) => { renderTarget = target; },
    getContext: () => ({ LINK_STATUS: 0x8b82, getProgramParameter: () => true }),
    initTexture(texture: THREE.Texture) { assert.equal(texture, map); uploaded = true; tasks.push('upload'); },
    compile(subject: THREE.Group, eye: THREE.PerspectiveCamera, lights: THREE.Scene) {
      assert.equal(eye, camera); assert.notEqual(lights, scene); assert.equal(renderTarget?.width, 1);
      const meshes: THREE.Object3D[] = []; subject.traverse(mesh => meshes.push(mesh));
      assert.deepEqual(meshes, [film.goalMarker, torso, wrist]);
      assert.ok(meshes.every(mesh => !mesh.visible));
      assert.equal(torso.parent, actor); assert.equal(wrist.parent, actor);
      tasks.push('link');
      programs.push({ program: {}, isReady: () => true, getUniforms() { tasks.push('locations'); } });
    },
  } as unknown as THREE.WebGLRenderer;
  const journey = { scene: 'm1_morning', actor: 'neo', morning: { phase: 'ready', elapsed: 0 } } as FilmJourney;
  const prepare = (state: FilmJourney) => film.prepareCommuteOutfit?.(gpu, camera, lighting, state, actor);
  prepare({ ...journey, visiting: 'm1_club' }); assert.deepEqual(tasks, []);
  film['current'] = FILM_SETS.film_anderson_flat;
  prepare(journey); prepare(journey); assert.deepEqual(tasks, ['upload']);
  film['current'] = undefined;
  prepare(journey); assert.deepEqual(tasks, ['upload', 'link']);
  prepare(journey); assert.deepEqual(tasks, ['upload', 'link'], 'wait one frame after the driver reports completion');
  prepare(journey); prepare(journey); assert.deepEqual(tasks, ['upload', 'link', 'locations']);
  assert.equal(renderTarget, null); assert.equal(debug.checkShaderErrors, true);
});

test('the commute prepares the three first-draw street programs with the live lights', t => {
  const scene = new THREE.Scene(), film = new FilmSetRenderer(scene), lighting = new LightCulling(scene);
  const camera = new THREE.PerspectiveCamera(), detail = new THREE.Group(), actor = new THREE.Group();
  const environment = new THREE.Texture(); scene.environment = environment; scene.fog = new THREE.FogExp2(0x071410, .00125);
  detail.visible = false; detail.add(actor); scene.add(detail);
  const meshes = ['Red_dress_satin', 'Red_dress_hair', 'Red_dress_eyes', 'Red_dress_anatomy'].map(name => {
    const mesh = new THREE.Mesh(undefined, new THREE.MeshStandardMaterial()); mesh.name = name; actor.add(mesh); return mesh;
  });
  t.after(() => {
    film.dispose(); lighting.dispose(); environment.dispose();
    for (const mesh of meshes) { mesh.geometry.dispose(); mesh.material.dispose(); }
  });
  const debug = { checkShaderErrors: true }, target = new THREE.WebGLRenderTarget(2, 2);
  t.after(() => target.dispose());
  let renderTarget: THREE.WebGLRenderTarget | null = target, ready = false, parallel = false;
  const tasks: string[] = [];
  const newProgram = (name: string) => ({ program: {}, isReady: () => ready, getUniforms() {
    assert.equal(debug.checkShaderErrors, false); tasks.push(name);
  } });
  const cached = newProgram('existing skirt');
  const programs = [cached], byMaterial = new Map([[meshes[0].material, cached]]);
  const gpu = {
    info: { programs }, debug,
    extensions: { has: () => parallel },
    properties: { get: (material: THREE.MeshStandardMaterial) => ({ currentProgram: byMaterial.get(material) }) },
    getRenderTarget: () => renderTarget,
    setRenderTarget: (value: typeof renderTarget) => { renderTarget = value; },
    getContext: () => ({ LINK_STATUS: 0x8b82, getProgramParameter: () => true }),
    compile: (subject: THREE.Group, eye: THREE.Camera, litScene: THREE.Scene) => {
      assert.equal(eye, camera); assert.equal(renderTarget?.width, 1);
      assert.notEqual(litScene, scene, 'color preparation must leave the live shadow render state alone');
      assert.equal(litScene.environment, scene.environment); assert.equal(litScene.fog, scene.fog);
      const subjects: THREE.Object3D[] = []; subject.traverse(mesh => subjects.push(mesh));
      assert.equal(subjects.length, 1);
      const mesh = meshes.slice(0, 3).find(candidate => candidate === subjects[0]);
      assert.ok(mesh);
      let lights = 0; litScene.traverseVisible(object => { if (object instanceof THREE.PointLight) lights++; });
      assert.equal(lights, 4);
      if (!byMaterial.has(mesh.material)) {
        const program = newProgram(mesh.name); programs.push(program); byMaterial.set(mesh.material, program);
      }
      tasks.push('compile ' + mesh.name);
    },
  };
  lighting.minimumPointSlots = 4;
  const prepare = (root = actor) => film.prepareOfficeStreetColors?.(gpu as unknown as THREE.WebGLRenderer, camera, lighting, root);
  prepare(); assert.deepEqual(tasks, [], 'leave unsupported contexts on the ordinary draw path');
  parallel = true;
  prepare(new THREE.Group()); assert.deepEqual(tasks, [], 'wait for the actual meshes');
  for (const { name } of meshes.slice(0, 3)) {
    const before = tasks.length; prepare(); assert.deepEqual(tasks.slice(before), ['compile ' + name]);
  }
  prepare(); assert.equal(tasks.length, 3, 'wait for the submitted programs to link');
  ready = true;
  for (const name of ['existing skirt', 'Red_dress_hair', 'Red_dress_eyes']) {
    const before = tasks.length; prepare(); assert.deepEqual(tasks.slice(before), [name]);
  }
  prepare(); assert.equal(tasks.length, 6);
  assert.equal(renderTarget, target); assert.equal(debug.checkShaderErrors, true);
  assert.equal(detail.visible, false); assert(meshes.every(mesh => mesh.parent === actor));
  gpu.properties = { ...gpu.properties };
  prepare(); assert.equal(tasks.at(-1), 'compile Red_dress_satin', 'rebuild the queue after the graphics context changes');
});

test('street preparation includes the driver LOD and both shared-material skinning variants', t => {
  const scene = new THREE.Scene(), film = new FilmSetRenderer(scene), lighting = new LightCulling(scene);
  const camera = new THREE.PerspectiveCamera(), driver = new THREE.Group(), actor = new THREE.Group();
  const environment = new THREE.Texture(); scene.environment = environment; scene.fog = new THREE.FogExp2(0x071410, .00125);
  driver.visible = false; scene.add(driver, actor);
  const skin = new THREE.Mesh(undefined, new THREE.MeshStandardMaterial()); skin.name = 'driver skin';
  const shared = new THREE.MeshPhysicalMaterial(), rigid = new THREE.Mesh(undefined, shared), skinned = new THREE.SkinnedMesh(undefined, shared);
  rigid.name = 'rigid cloth'; skinned.name = 'skinned cloth';
  const duplicate = new THREE.Mesh(undefined, shared); duplicate.name = 'second rigid cloth';
  const hidden = new THREE.Group(), hiddenMesh = new THREE.Mesh(undefined, new THREE.MeshStandardMaterial());
  hidden.visible = false; hidden.add(hiddenMesh); driver.add(skin, rigid, skinned, duplicate, hidden);
  const red = ['Red_dress_satin', 'Red_dress_hair', 'Red_dress_eyes'].map(name => {
    const mesh = new THREE.Mesh(undefined, new THREE.MeshStandardMaterial()); mesh.name = name; return mesh;
  });
  t.after(() => {
    film.dispose(); lighting.dispose(); environment.dispose();
    for (const mesh of [skin, rigid, skinned, duplicate, hiddenMesh, ...red]) mesh.geometry.dispose();
    for (const material of new Set([skin.material, shared, hiddenMesh.material, ...red.map(mesh => mesh.material)])) material.dispose();
  });
  const tasks: string[] = [], debug = { checkShaderErrors: true };
  let ready = false, target: THREE.WebGLRenderTarget | null = null;
  const newProgram = (name: string) => ({ program: {}, isReady: () => ready, getUniforms() {
    assert.equal(debug.checkShaderErrors, false); tasks.push('locations ' + name);
  } });
  const existing = newProgram(skin.name), programs = [existing], variants = new Map([[skin.material.id + ':false', existing]]);
  const current = new Map<THREE.Material, typeof existing>();
  const gpu = {
    info: { programs }, debug, extensions: { has: () => true },
    properties: { get: (material: THREE.Material) => ({ currentProgram: current.get(material) }) },
    getRenderTarget: () => target, setRenderTarget: (next: typeof target) => { target = next; },
    getContext: () => ({ LINK_STATUS: 0x8b82, getProgramParameter: () => true }),
    compile: (subject: THREE.Group, eye: THREE.Camera, litScene: THREE.Scene) => {
      assert.equal(eye, camera); assert.equal(target?.width, 1); assert.notEqual(litScene, scene);
      assert.equal(litScene.environment, environment); assert.equal(litScene.fog, scene.fog);
      let lights = 0; litScene.traverseVisible(object => { if (object instanceof THREE.PointLight) lights++; });
      assert.equal(lights, 4);
      const objects: THREE.Object3D[] = []; subject.traverse(object => objects.push(object));
      assert.equal(objects.length, 1);
      const mesh = objects[0]; assert(mesh instanceof THREE.Mesh && !Array.isArray(mesh.material));
      assert.notEqual(mesh, hiddenMesh);
      assert.match(shared.customProgramCacheKey(), /actor-local-skin-v1$/, 'initialize the shared material before its rigid variant links');
      const key = mesh.material.id + ':' + (mesh instanceof THREE.SkinnedMesh);
      let program = variants.get(key);
      if (!program) { program = newProgram(mesh.name); variants.set(key, program); programs.push(program); }
      current.set(mesh.material, program); tasks.push('compile ' + mesh.name);
    },
  };
  lighting.minimumPointSlots = 4;
  const prepare = () => film.prepareOfficeStreetColors(gpu as unknown as THREE.WebGLRenderer, camera, lighting, actor, driver);
  prepare(); assert.deepEqual(tasks, ['compile driver skin'], 'the procedural driver need not wait for the red dress asset');
  actor.add(...red);
  for (const mesh of [...red, rigid, skinned]) {
    const before = tasks.length; prepare(); assert.deepEqual(tasks.slice(before), ['compile ' + mesh.name]);
  }
  assert.equal(tasks.length, 6, 'link at most one mesh per frame, retaining both skinning variants');
  ready = true;
  for (const name of [skin.name, ...red.map(mesh => mesh.name), rigid.name, skinned.name]) {
    const before = tasks.length; prepare(); assert.deepEqual(tasks.slice(before), ['locations ' + name]);
  }
  prepare(); assert.equal(tasks.at(-1), 'compile second rigid cloth');
  prepare(); assert.equal(tasks.length, 13, 'a repeated rigid variant must not repeat the uniform-location work');
  assert.equal(variants.size, 6); assert.equal(driver.visible, false); assert.equal(hidden.visible, false);
  assert([skin, rigid, skinned, duplicate, hidden].every(object => object.parent === driver));
  assert.equal(hiddenMesh.parent, hidden); assert(red.every(mesh => mesh.parent === actor));
  assert.equal(target, null); assert.equal(debug.checkShaderErrors, true);
  gpu.properties = { ...gpu.properties };
  ready = false; prepare(); assert.equal(tasks.at(-1), 'compile Red_dress_satin', 'a new context prepares both actors again');
});

test('street preparation caches the existing Matrix phone accent before the lift reveals it', t => {
  t.mock.method(THREE.TextureLoader.prototype, 'load', () => new THREE.Texture());
  const original = globalThis.document;
  const context = { fillRect() {}, fillText() {}, putImageData() {},
    createImageData: (width: number, height: number) => ({ data: new Uint8ClampedArray(width * height * 4) }) };
  globalThis.document = { createElement: () => ({ getContext: () => context }) } as unknown as Document;
  const scene = new THREE.Scene(), film = new FilmSetRenderer(scene), sandbox = new SandboxRenderer(scene), lighting = new LightCulling(scene);
  t.after(() => { film.dispose(); sandbox.dispose(); lighting.dispose(); globalThis.document = original; });
  sandbox.sync({ nodes: [
    { id: 'real-phone', kind: 'phone', name: 'Real phone', position: { x: 0, y: -100, z: 0 } },
    { id: 'matrix-phone', kind: 'phone', name: 'Matrix phone', position: { x: 1228, y: 1, z: 727 } },
  ], structures: [], incidents: [], threats: [], missions: {} } as unknown as SandboxState, {});
  const phone = sandbox['props'].get('matrix-phone')!.accent, parent = phone.parent;
  const camera = new THREE.PerspectiveCamera(), tasks: string[] = [], debug = { checkShaderErrors: true };
  let target: THREE.WebGLRenderTarget | null = null;
  const program = { program: {}, isReady: () => true, getUniforms() { assert.equal(debug.checkShaderErrors, false); tasks.push('locations'); } };
  const gpu = {
    info: { programs: [program] }, debug, extensions: { has: () => true },
    properties: { get: (material: THREE.Material) => { assert.equal(material, phone.material); return { currentProgram: program }; } },
    getRenderTarget: () => target, setRenderTarget: (value: typeof target) => { target = value; },
    getContext: () => ({ LINK_STATUS: 0x8b82, getProgramParameter: () => true }),
    compile: (subject: THREE.Group, eye: THREE.Camera, litScene: THREE.Scene) => {
      assert.equal(eye, camera); assert.notEqual(litScene, scene); assert.equal(target?.width, 1);
      const meshes: THREE.Object3D[] = []; subject.traverse(object => meshes.push(object));
      assert.deepEqual(meshes, [phone]); tasks.push('compile');
    },
  };
  const prepare = () => film.prepareOfficeStreetPhone(gpu as unknown as THREE.WebGLRenderer, camera, lighting, phone);
  prepare(); assert.deepEqual(tasks, ['compile'], 'a hidden phone accent must not wait for nearby character assets');
  prepare(); assert.deepEqual(tasks, ['compile', 'locations']);
  prepare(); assert.equal(tasks.length, 2);
  assert.equal(sandbox.getPhoneColorMesh(), phone, 'prepare the existing Matrix accent rather than the real-world phone');
  assert.equal(phone.parent, parent); assert.equal(phone.visible, true); assert.equal(target, null);
});

test('office exits prepare the existing materials in separate frames', t => {
  const grain = new THREE.Texture({ width: 1024, height: 1024, complete: true }); grain.needsUpdate = true;
  t.mock.method(THREE.TextureLoader.prototype, 'load', (url: string) => url.includes('old_wood_floor') ? grain : new THREE.Texture());
  t.mock.method(GLTFLoader.prototype, 'loadAsync', () => new Promise(() => {}));
  const document = globalThis.document;
  globalThis.document = { createElement: () => ({ getContext: () => ({ fillRect() {}, fillText() {}, strokeRect() {} }) }) } as unknown as Document;
  const scene = new THREE.Scene(), film = new FilmSetRenderer(scene), culling = new LightCulling(scene);
  const position = metacortexPosition(-25, -27, 1), camera = new THREE.PerspectiveCamera();
  const city = new THREE.Group(), lobby = new THREE.Group(), courier = new THREE.Group(), patrol = new THREE.Group();
  const lobbyMeshes = Array.from({ length: 5 }, () => new THREE.Mesh(undefined, new THREE.MeshStandardMaterial()));
  const hair = new THREE.Mesh(undefined, new THREE.MeshStandardMaterial()); hair.name = 'short04';
  const courierMeshes = [new THREE.Mesh(undefined, new THREE.MeshStandardMaterial()), new THREE.Mesh(undefined, new THREE.MeshBasicMaterial())];
  lobby.name = 'metacortex-city-lobby'; lobby.add(...lobbyMeshes); city.add(lobby);
  courier.add(...courierMeshes); patrol.add(hair); scene.add(city, courier, patrol);
  t.after(() => {
    film.dispose(); culling.dispose(); grain.dispose(); globalThis.document = document;
    for (const mesh of [...lobbyMeshes, ...courierMeshes, hair]) { mesh.geometry.dispose(); mesh.material.dispose(); }
  });
  const player = { id: 'neo', position, isInMatrix: true } as AgentState;
  const journey: FilmJourney = { version: 1, scene: 'm1_office_escape', actor: 'neo', step: 2, completed: [], enteredAt: 0,
    reflections: {}, checkpoint: position, lastText: '', office: { alert: 0, waypoints: [], suspicion: [], lastTick: 0, guide: '', window: .9 } };
  const sandbox = { threats: [], neoLife: { journey } } as unknown as SandboxState;
  film.update(player, sandbox, 0);
  culling.minimumPointSlots = 6;
  const batches: THREE.Object3D[][] = [], tasks: string[] = [], debug = { checkShaderErrors: true };
  let ready = false, target: THREE.WebGLRenderTarget | null = null;
  const properties = { get: () => ({}) };
  const programs: { program: object; isReady(): boolean; getUniforms(): void }[] = [];
  const gpu = {
    properties, info: { programs }, debug,
    getContext: () => ({ LINK_STATUS: 0x8b82, getProgramParameter: () => true }),
    extensions: { has: () => true }, getRenderTarget: () => target,
    setRenderTarget: (next: typeof target) => { target = next; },
    initTexture: (texture: THREE.Texture) => { assert.equal(texture, grain); tasks.push('upload'); },
    compile: (subject: THREE.Group, eye: THREE.Camera, litScene: THREE.Scene) => {
      assert.equal(eye, camera); assert.equal(litScene, scene); assert.equal(target?.width, 1);
      const meshes: THREE.Object3D[] = []; subject.traverse(mesh => meshes.push(mesh));
      batches.push(meshes); tasks.push('compile');
      programs.push({ program: {}, isReady: () => ready, getUniforms: () => {
        assert.equal(debug.checkShaderErrors, false); tasks.push('locations');
      } });
    },
  };
  const renderer = gpu as unknown as THREE.WebGLRenderer;
  const prepare = (stage = journey) => film.prepareOfficeWindow?.(renderer, camera, culling, stage, city, courier, patrol);
  prepare({ ...journey, step: 1 });
  assert.deepEqual(tasks, []);
  prepare();
  assert.deepEqual(tasks, ['compile']);
  assert.deepEqual(batches[0], lobbyMeshes.slice(0, 4));
  ready = true;
  for (let i = 0; i < 8; i++) prepare();
  assert.deepEqual(tasks, ['compile', 'locations', 'compile', 'locations', 'compile', 'locations', 'upload']);
  assert.deepEqual(batches[1], [lobbyMeshes[4], hair, ...courierMeshes]);
  assert.equal((batches[2][0] as THREE.Mesh<THREE.BufferGeometry, THREE.MeshStandardMaterial>).material.map, grain);
  assert.equal(batches[2][1], film['marker']);
  assert.deepEqual(batches[2].slice(2).map(mesh => (mesh as THREE.Mesh<THREE.BufferGeometry, THREE.Material>).material.name),
    ['metacortex-floor-sign', 'metacortex-manager-sign']);
  assert.equal(lobbyMeshes[0].parent, lobby); assert.equal(hair.parent, patrol); assert.equal(courierMeshes[0].parent, courier);
  assert.equal(target, null); assert.equal(debug.checkShaderErrors, true);

  gpu.properties = { ...properties };
  prepare();
  assert.equal(batches.length, 4);
  prepare({ ...journey, step: 3, office: { ...journey.office!, crossing: 0 } });
  assert.equal(tasks.at(-1), 'compile');
  assert.equal(film['preparedOfficeWindow'], undefined);

  const street = new THREE.Group();
  const visibleClimb = ['Red_dress_satin', 'Red_dress_hair', 'Red_dress_eyes'].map(name => {
    const mesh = new THREE.Mesh(undefined, new THREE.MeshStandardMaterial()); mesh.name = name; return mesh;
  });
  const body = new THREE.Mesh(undefined, new THREE.MeshStandardMaterial()); body.name = 'Red_dress_anatomy';
  street.add(body, ...visibleClimb); scene.add(street);
  const sign = new THREE.Mesh(undefined, new THREE.MeshStandardMaterial({ map: grain, emissiveMap: grain }));
  lobby.add(sign);
  const jackson = new THREE.Group(), officer = new THREE.Group(), driver = new THREE.Group();
  const glasses = new THREE.Mesh(undefined, new THREE.MeshPhysicalMaterial()); glasses.name = 'smith-glasses-lens--1';
  const streetHair = hair.clone();
  const cap = new THREE.Mesh(undefined, new THREE.MeshStandardMaterial()); cap.name = 'office-uniform-cap';
  const skin = new THREE.SkinnedMesh(undefined, new THREE.MeshStandardMaterial()); skin.name = 'Anatomical_head_and_hands';
  const cloth = new THREE.MeshPhysicalMaterial({ bumpMap: grain });
  const sleeve = new THREE.SkinnedMesh(undefined, cloth), torso = new THREE.Mesh(undefined, cloth);
  const face = new THREE.MeshStandardMaterial({ bumpMap: grain }), scalp = face.clone();
  const driverHead = new THREE.Mesh(undefined, [face, scalp]); driverHead.name = 'office-driver-head';
  jackson.add(glasses, streetHair); officer.add(cap, skin); driver.add(driverHead, sleeve, torso); driver.visible = false;
  scene.add(jackson, officer, driver);
  t.after(() => {
    for (const mesh of [body, ...visibleClimb, sign, glasses, cap, skin, sleeve]) { mesh.geometry.dispose(); mesh.material.dispose(); }
    torso.geometry.dispose(); driverHead.geometry.dispose(); face.dispose(); scalp.dispose();
  });
  const cast = new Map([['citizen_2', street], ['agent_jackson', jackson], ['citizen_4', officer]]);
  const prepareDescent = () => film.prepareOfficeDescent(renderer, camera, culling, city, id => cast.get(id));
  const beforeDescent = tasks.length;
  for (let i = 0; i < 5; i++) prepareDescent();
  assert.deepEqual(tasks.slice(beforeDescent), ['compile', 'locations', 'compile', 'locations']);
  assert.deepEqual(batches.at(-2), [sign, ...visibleClimb]);
  assert.deepEqual(batches.at(-1), [glasses, streetHair, cap, skin]);
  cast.set('citizen_11', driver);
  for (let i = 0; i < 3; i++) prepareDescent();
  assert.deepEqual(tasks.slice(beforeDescent + 4), ['compile', 'locations']);
  assert.deepEqual(batches.at(-1), [driverHead, sleeve, torso], 'prepare both head materials before the driver switches to the near model');
  assert.equal(driver.visible, false);
  assert.equal(driverHead.parent, driver);
  assert(visibleClimb.every(mesh => mesh.parent === street));
  assert.equal(sleeve.parent, driver); assert.equal(sign.parent, lobby); assert.equal(target, null);

  const connectionMeshes = ['Anatomical_head_and_hands', 'shoes01', 'office-uniform-cap'].map(name => {
    const mesh = new THREE.Mesh(undefined, new THREE.MeshStandardMaterial()); mesh.name = name; return mesh;
  });
  courier.add(...connectionMeshes);
  t.after(() => { for (const mesh of connectionMeshes) { mesh.geometry.dispose(); mesh.material.dispose(); } });
  const signature = film['office']!.root.getObjectByName('delivery-signature-stroke');
  assert(signature instanceof THREE.Line);
  const call: FilmJourney = { ...journey, scene: 'm1_boss', step: 1, phone: { phase: 'answering', elapsed: 2 } };
  const prepareConnection = (stage = call) => film.prepareOfficeConnection?.(renderer, camera, culling, stage, courier, patrol);
  const beforeConnection = tasks.length;
  prepareConnection({ ...call, phone: { phase: 'ready', elapsed: 0 } });
  film.prepareOfficeConnection?.(renderer, camera, culling, call, courier);
  assert.equal(tasks.length, beforeConnection);
  for (let i = 0; i < 5; i++) prepareConnection();
  assert.deepEqual(tasks.slice(beforeConnection), ['compile', 'locations', 'compile', 'locations']);
  assert.deepEqual(batches.at(-2), [...connectionMeshes, hair]);
  assert.deepEqual(batches.at(-1), [signature]);
  prepareConnection({ ...call, step: 2, phone: { phase: 'connected', elapsed: 11 } });
  assert.equal(tasks.length, beforeConnection + 4);
  assert.equal(film['preparedOfficeConnection'], undefined);
  assert(connectionMeshes.every(mesh => mesh.parent === courier));
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

  for (const id of ['courier', 'rhineheart', 'smith', 'agent_jones', 'agent_brown', 'agent_johnson', 'agent_jackson', 'agent_thompson']) {
    const state = { ...world.agents.get(id)!, currentLocation: 'downtown', position: { ...citizen.position } };
    agents.updateAgent(id, state);
    const actor = agents.getAgent(id)!, shadows: THREE.Mesh[] = [];
    actor.traverseVisible(object => { if (object instanceof THREE.Mesh && object.castShadow) shadows.push(object); });
    assert.ok(shadows.length, `${id} has street shadow casters`);
    cull();
    assert.ok(shadows.every(mesh => !mesh.castShadow && mesh.visible), `${id}'s shadow cannot reach the office view`);
    assert.equal(actor.visible, true, `${id}'s body remains visible`);
    agents.restoreOfficeStreetShadows();
    assert.ok(shadows.every(mesh => mesh.castShadow), `${id}'s original shadows return`);
    actor.position.y = metacortexPosition(0, 0, 1).y;
    cull();
    assert.ok(shadows.every(mesh => mesh.castShadow), `${id} still casts shadows upstairs`);
    agents.restoreOfficeStreetShadows();
    actor.position.set(state.position.x, state.position.y, state.position.z);
    agents.updateAgent(id, { ...state, controller: 'shadow-review' });
    cull();
    assert.ok(shadows.every(mesh => mesh.castShadow), `${id} retains shadows while player-controlled`);
    agents.restoreOfficeStreetShadows();
    agents.removeAgent(id);
  }

  agents.updateAgent(citizen.id, { ...citizen, currentLocation: 'metacortex_office' });
  cull();
  assert.ok(casters.every(object => !object.castShadow && object.visible), 'a street-level pedestrian can carry the office location');
  agents.restoreOfficeStreetShadows();
  group.position.y = metacortexPosition(0, 0, 1).y;
  cull();
  assert.ok(casting(), 'the street optimization preserves upper-floor casters');
  group.position.y = citizen.position.y;

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

  const [courier, manager] = ['courier', 'rhineheart'].map((id, i) => {
    agents.updateAgent(id, { ...world.agents.get(id)!, currentLocation: 'metacortex_office', position: { x: 0, y: 1, z: 30 + i * 10 } });
    const actor = agents.getAgent(id)!, shadows: THREE.Mesh[] = [];
    actor.traverseVisible(object => { if (object instanceof THREE.Mesh && object.castShadow) shadows.push(object); });
    assert.ok(shadows.length);
    return { actor, shadows };
  });
  const liftCasters = [...casters, ...courier.shadows, ...manager.shadows];
  const cullBelowCar = (floor = 32.5) => agents.cullOfficeStreetShadows(camera, sun, floor);
  cullBelowCar(11);
  assert.ok(liftCasters.every(mesh => mesh.castShadow), 'keep any caster whose bounds reach the lift floor');
  cullBelowCar();
  assert.ok(liftCasters.every(mesh => !mesh.castShadow && mesh.visible), 'street cast below the closed car cannot shadow its interior');
  agents.restoreOfficeStreetShadows();
  assert.ok(liftCasters.every(mesh => mesh.castShadow));

  manager.actor.position.y = metacortexPosition(0, 0, 1).y;
  landing.position.set(0, 12, 30); landing.target.position.copy(courier.actor.position);
  cullBelowCar();
  assert.ok(manager.shadows.every(mesh => mesh.castShadow), 'keep upper-floor cast');
  assert.ok(courier.shadows.every(mesh => mesh.castShadow), 'keep casters needed by the second shadow light');
  agents.restoreOfficeStreetShadows();
  sun.position.y = -34;
  cullBelowCar();
  assert.ok(liftCasters.every(mesh => mesh.castShadow), 'do not reject low casters for upward light rays');
});

test('the office stages the manager and nearby street cast textures one at a time', t => {
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
  const streetSkin = new THREE.Texture({ width: 2048, height: 2048 }); streetSkin.needsUpdate = true;
  const streetBody = new THREE.SkinnedMesh(undefined, new THREE.MeshStandardMaterial({ map: streetSkin }));
  streetBody.name = 'Red_dress_anatomy';
  streetHero.add(streetHair, streetBody);
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
  assert.equal(prepare(), false, 'the street approach must leave unsupported full uploads to the normal draw');
  prepare(false);
  assert.equal(calls.at(-1), cutout, 'the first cutout upload takes an empty lift frame even if the manager is absent');
  prepare(false);
  assert.deepEqual(calls, [skin, hair, coat, 'compile', cutout], 'resident hair and opaque street textures add no uploads');
  assert.equal(streetHair.material.map, cutout);
  assert.equal(streetHair.castShadow, true);

  manager.visible = true;
  lighting.minimumPointSlots = 6;
  streetHero.visible = false;
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

  const beforeLedge = calls.length;
  streetHero.visible = true;
  uploaded.delete(cutout);
  const ledge = () => agents.prepareOfficeCast(renderer, camera, lighting, 'ledge');
  assert.equal(ledge(), true);
  assert.deepEqual(calls.slice(beforeLedge), [streetSkin]);
  assert.equal(ledge(), true);
  assert.equal(ledge(), false);
  assert.deepEqual(calls.slice(beforeLedge), [streetSkin, cutout]);
});

test('the office publishes shared cast textures only after the last strip and releases interrupted uploads', t => {
  class Bitmap { width = 2048; height = 2048; }
  const originalBitmap = globalThis.ImageBitmap, document = globalThis.document;
  globalThis.ImageBitmap = Bitmap as unknown as typeof ImageBitmap;
  globalThis.document = { createElement: () => ({ getContext: () => ({
    createRadialGradient: () => ({ addColorStop() {} }),
    createImageData: (w: number, h: number) => ({ data: new Uint8ClampedArray(w * h * 4) }), fillRect() {}, putImageData() {},
  }) }) } as unknown as Document;
  t.mock.method(THREE.TextureLoader.prototype, 'load', () => new THREE.Texture());
  const scene = new THREE.Scene(), agents = new AgentRenderer(scene), lighting = new LightCulling(scene);
  t.after(() => {
    agents.dispose(); lighting.dispose(); globalThis.document = document;
    if (originalBitmap) globalThis.ImageBitmap = originalBitmap;
    else Reflect.deleteProperty(globalThis, 'ImageBitmap');
  });
  const camera = new THREE.PerspectiveCamera(), manager = new THREE.Group(), hero = new THREE.Group();
  scene.add(manager); manager.add(hero);
  const [skin, coat, hair] = Array.from({ length: 3 }, () => {
    const texture = new THREE.Texture(new Bitmap());
    texture.flipY = false; texture.colorSpace = THREE.SRGBColorSpace; texture.anisotropy = 8; texture.needsUpdate = true;
    hero.add(new THREE.Mesh(undefined, new THREE.MeshStandardMaterial({ map: texture })));
    return texture;
  });
  const pedestrian = new THREE.Group(), streetDetail = new THREE.Group(), streetHero = new THREE.Group();
  scene.add(pedestrian); pedestrian.add(streetDetail); streetDetail.add(streetHero);
  streetDetail.visible = false;
  const streetMaps = ['Red_dress_anatomy', 'Red_dress_hair'].map(name => {
    const texture = new THREE.Texture(new Bitmap()); texture.flipY = false; texture.needsUpdate = true;
    const mesh = new THREE.SkinnedMesh(undefined, new THREE.MeshStandardMaterial({ map: texture })); mesh.name = name;
    streetHero.add(mesh);
    return texture;
  });
  t.mock.method(agents, 'getAgent', (id: string) => id === 'rhineheart' ? manager : id === 'citizen_2' ? pedestrian : null);
  t.mock.method(agents, 'getAgentHero', (id: string) => id === 'rhineheart' ? hero : id === 'citizen_2' ? streetHero : undefined);

  type Backing = { image: Bitmap; rows: number; mipmaps: boolean };
  const bySource = new Map<THREE.Source, Backing>();
  const gpu = new Map<THREE.Texture, { __version: number; __webglTexture: Backing }>();
  const allocations: { texture: THREE.Texture; backing: Backing }[] = [], released: THREE.Texture[] = [];
  let bound: Backing | undefined, unpackRow = 0;
  const gl = {
    TEXTURE_2D: 0x0de1, UNPACK_SKIP_ROWS: 0x0cf3, RGBA: 0x1908, UNSIGNED_BYTE: 0x1401,
    pixelStorei(_parameter: number, row: number) { unpackRow = row; },
    texSubImage2D(_target: number, _level: number, _x: number, row: number, width: number, height: number,
      _format: number, _type: number, image: Bitmap) {
      assert.ok(bound);
      assert.equal(image, bound.image); assert.equal(width, 2048); assert.equal(height, 256);
      assert.equal(row, unpackRow); assert.equal(row, bound.rows);
      bound.rows += height;
    },
    generateMipmap() { assert.ok(bound); assert.equal(bound.rows, 2048); bound.mipmaps = true; },
  };
  const renderer = {
    info: { programs: [] }, capabilities: { maxTextureSize: 4096 },
    properties: { get: (texture: THREE.Texture) => gpu.get(texture) ?? {} }, getContext: () => gl,
    state: { bindTexture: (_target: number, backing: Backing) => { bound = backing; }, unbindTexture: () => { bound = undefined; } },
    initTexture(texture: THREE.Texture) {
      let backing = bySource.get(texture.source);
      if (!backing) {
        backing = { image: texture.image, rows: texture.source.dataReady ? 2048 : 0, mipmaps: texture.source.dataReady };
        bySource.set(texture.source, backing); allocations.push({ texture, backing });
      }
      gpu.set(texture, { __version: texture.version, __webglTexture: backing });
      texture.addEventListener('dispose', () => { released.push(texture); gpu.delete(texture); });
    },
  } as unknown as THREE.WebGLRenderer;
  const prepare = () => agents.prepareOfficeCast(renderer, camera, lighting, 'lift');
  const skinSource = skin.source, coatSource = coat.source;
  assert.equal(prepare(), true);
  assert.equal(gpu.has(skin), false, 'the original texture must stay available for an ordinary first draw');
  const stagedSkin = allocations[0];
  assert.equal(stagedSkin.texture.anisotropy, skin.anisotropy);
  assert.equal(stagedSkin.texture.colorSpace, skin.colorSpace);
  for (let rows = 256; rows < 2048; rows += 256) {
    assert.equal(skin.source, skinSource);
    assert.equal(stagedSkin.backing.rows, rows);
    assert.equal(stagedSkin.backing.mipmaps, false);
    assert.equal(prepare(), true);
  }
  assert.equal(gpu.get(skin)?.__webglTexture, stagedSkin.backing);
  assert.equal(stagedSkin.backing.mipmaps, true);
  assert.deepEqual(released, [stagedSkin.texture]);
  assert.equal(allocations.length, 1, 'publication adopts the populated allocation');

  assert.equal(prepare(), true);
  const stagedCoat = allocations.at(-1)!;
  assert.equal(coat.source, coatSource);
  renderer.initTexture(coat); // A normal color or shadow draw reaches this material first.
  const drawnCoat = gpu.get(coat)?.__webglTexture;
  assert.equal(drawnCoat?.rows, 2048);
  assert.equal(prepare(), true);
  assert.equal(released.at(-1), stagedCoat.texture);
  assert.equal(gpu.get(coat)?.__webglTexture, drawnCoat);
  assert.equal(coat.source, coatSource);

  const stagedHair = allocations.at(-1)!;
  assert.equal(stagedHair.backing.image, hair.image);
  agents.cancelOfficeCastTexture();
  assert.equal(released.at(-1), stagedHair.texture);
  assert.equal(gpu.has(hair), false);
  assert.equal(prepare(), true, 'a return to the office can prepare the cancelled texture again');
  assert.equal(allocations.at(-1)?.backing.rows, 256);
  assert.equal(bound, undefined); assert.equal(unpackRow, 0);

  agents.cancelOfficeCastTexture();
  manager.visible = false;
  pedestrian.position.z = 131;
  const approach = () => agents.prepareOfficeCast(renderer, camera, lighting, 'approach');
  assert.equal(approach(), false, 'the preload range must stay bounded');
  pedestrian.position.z = 120;
  manager.visible = true;
  for (const texture of streetMaps) {
    const firstAllocation = allocations.length, source = texture.source;
    for (let rows = 256; rows <= 2048; rows += 256) {
      assert.equal(approach(), true, 'prepare the street actor while it still draws the distant model');
      assert.equal(allocations.length, firstAllocation + 1);
      const backing = allocations[firstAllocation].backing;
      assert.equal(backing.image, texture.image, 'street color maps take priority before the first approach draw');
      assert.equal(backing.rows, rows, 'submit exactly one strip per frame');
      if (rows < 2048) { assert.equal(texture.source, source); assert.equal(gpu.has(texture), false); }
      else assert.equal(gpu.get(texture)?.__webglTexture, backing);
    }
  }
  assert.equal(streetDetail.visible, false);
  assert.equal(approach(), true, 'continue the existing manager preparation after the street maps');
  assert.equal(allocations.at(-1)?.backing.image, hair.image);
});
