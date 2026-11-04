import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { FILM_SETS, OFFICE_DESKS } from '@auto_matrix/shared';
import { OfficeSetRenderer } from '../packages/client/src/engine/OfficeSetRenderer.js';
import { OfficeWorkdayRenderer } from '../packages/client/src/engine/OfficeWorkdayRenderer.js';

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
