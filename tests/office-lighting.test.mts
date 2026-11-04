import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { FILM_SETS, OFFICE_DESKS, metacortexPosition, type AgentState, type FilmJourney, type SandboxState } from '@auto_matrix/shared';
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

test('identical office keycaps share construction buffers within each scene build', t => {
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
  try {
    const manager = new OfficeWorkdayRenderer(new THREE.Group()); manager.dispose(); build++;
    const office = new OfficeSetRenderer(new THREE.Group(), FILM_SETS.film_metacortex_floor); office.dispose();
    assert.deepEqual(managerKeys.map(keys => keys.length), [52, 52], 'both full keyboards remain in the scene builds');
    assert.equal(officeKeys.length, OFFICE_DESKS.length * 52, 'every workstation keeps all of its keycaps');
    assert.deepEqual(managerKeys.map(keys => new Set(keys).size), [1, 1]);
    assert.equal(new Set(officeKeys).size, 1, 'identical workstation keys only generate one solid');
    assert.notEqual(managerKeys[0][0], managerKeys[1][0], 'disposed scene templates must not be retained for the next scene');
  } finally { managerKey.dispose(); officeKey.dispose(); globalThis.document = original; }
});

test('the occupied lift prepares the hidden office and city materials with the arrival lights', t => {
  t.mock.method(THREE.TextureLoader.prototype, 'load', () => new THREE.Texture());
  t.mock.method(GLTFLoader.prototype, 'loadAsync', () => new Promise(() => {}));
  const document = globalThis.document;
  globalThis.document = { createElement: () => ({ getContext: () => ({ fillRect() {}, fillText() {}, strokeRect() {} }) }) } as unknown as Document;
  const scene = new THREE.Scene(), film = new FilmSetRenderer(scene), culling = new LightCulling(scene);
  t.after(() => { film.dispose(); culling.dispose(); globalThis.document = document; });
  culling.reservePointSlots = true;
  const lamp = new THREE.PointLight(0xffffff, 8, 10);
  const landing = new THREE.SpotLight(0xffffff, 0); landing.castShadow = true;
  const city = new THREE.Group(), street = new THREE.InstancedMesh(new THREE.BoxGeometry(), new THREE.MeshPhysicalMaterial(), 1);
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
  const renderer = {
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
      assert.deepEqual({ points, spots }, { points: 4, spots: 5 });
      if (root === neo) {
        assert.ok(litScene.getObjectByName('office-window-glass'));
        neoCompiles++;
        return;
      }
      const materials: THREE.Object3D[] = [];
      root.traverse(object => { if (object instanceof THREE.Mesh) materials.push(object); });
      if (materials.includes(street)) {
        assert.deepEqual(materials, [street]);
        assert.equal(street.parent, city);
        assert.equal(lamp.parent, city);
        assert.ok(litScene.getObjectByName('office-window-glass'));
        cityCompiles++;
        return;
      }
      assert.equal(root.parent, null);
      windows.push(root.getObjectByName('office-window-glass') as THREE.Mesh);
    },
  } as unknown as THREE.WebGLRenderer;
  film.update(player, sandbox, 0);
  for (let i = 0; i < 9; i++) film.prepareOffice(renderer, camera, culling, player, sandbox, neo, city);
  assert.equal(windows.length, 1);
  assert.equal(neoCompiles, 1);
  assert.equal(cityCompiles, 1);
  assert.equal(scene.getObjectByName('office-window-glass'), undefined);
  assert.equal(lamp.intensity, 8);
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

test('office visits and cold escapes skip the cleaners while the live workday loads them once', t => {
  t.mock.method(THREE.TextureLoader.prototype, 'load', () => new THREE.Texture());
  const load = t.mock.method(GLTFLoader.prototype, 'loadAsync', () => new Promise(() => {}));
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

  const live = new OfficeSetRenderer(new THREE.Group(), floor);
  t.after(() => live.dispose());
  live.update({ ...workday, scene: 'm1_commute' });
  live.update(workday);
  live.update(workday);
  assert.deepEqual(load.mock.calls.map(call => call.arguments), [['/assets/characters/club-male.glb']]);
  assert.equal(live.root.getObjectByName('office-window-cleaners')?.visible, true);
});

test('the approaching player gets staged manager texture uploads and a single color compile before the detailed body is visible', t => {
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
  t.mock.method(agents, 'getAgent', (id: string) => id === 'rhineheart' ? manager : null);
  t.mock.method(agents, 'getAgentHero', (id: string) => id === 'rhineheart' ? hero : undefined);
  const calls: (THREE.Texture | string)[] = [];
  const renderTarget = new THREE.WebGLRenderTarget(2, 2);
  let target: THREE.WebGLRenderTarget | null = renderTarget;
  lighting.reservePointSlots = true;
  const renderer = {
    properties: {}, extensions: { has: () => true },
    initTexture: (texture: THREE.Texture) => calls.push(texture),
    getRenderTarget: () => target,
    setRenderTarget: (value: typeof target) => { target = value; },
    compile: (subject: THREE.Object3D, eye: THREE.Camera, litScene: THREE.Scene) => {
      assert.equal(subject, hero); assert.equal(eye, camera); assert.equal(litScene, scene);
      assert.ok(target && target !== renderTarget);
      let points = 0; scene.traverseVisible(object => { if (object instanceof THREE.PointLight) points++; });
      assert.equal(points, 4);
      calls.push('compile');
    },
  } as unknown as THREE.WebGLRenderer;
  const prepare = () => agents.prepareOfficeManager(renderer, camera, lighting);
  prepare(); assert.deepEqual(calls, []);
  camera.position.z = 120;
  for (const expected of [skin, hair, coat, 'compile']) {
    prepare(); assert.equal(calls.at(-1), expected);
    assert.equal(detail.visible, false); assert.equal(hidden.visible, false); assert.equal(hero.parent, detail);
    assert.equal(target, renderTarget);
  }
  prepare(); assert.deepEqual(calls, [skin, hair, coat, 'compile']);
});
