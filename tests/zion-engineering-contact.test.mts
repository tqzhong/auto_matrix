import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { FILM_SETS, ZION_ENGINEERING, filmPosition, type EngineeringEncounter } from '@auto_matrix/shared';
import { AgentRenderer } from '../packages/client/src/agents/AgentRenderer.js';
import { ZionHomecomingRenderer } from '../packages/client/src/engine/ZionHomecomingRenderer.js';
import { WorldState } from '../packages/server/src/world/WorldState.js';
import { AgentManager } from '../packages/server/src/agents/AgentManager.js';

async function geometry(id: string) {
  const bytes = await readFile(new URL(`../packages/client/public/assets/characters/${id}.glb`, import.meta.url)), length = bytes.readUInt32LE(12);
  const document = JSON.parse(bytes.subarray(20, 20 + length).toString());
  for (const material of document.materials) { delete material.pbrMetallicRoughness?.baseColorTexture; delete material.normalTexture; }
  document.images = []; document.textures = [];
  const json = Buffer.from(JSON.stringify(document)), padded = Buffer.alloc(Math.ceil(json.length / 4) * 4, 32); json.copy(padded);
  const binary = bytes.subarray(20 + length), buffer = Buffer.alloc(20 + padded.length + binary.length);
  buffer.writeUInt32LE(0x46546c67, 0); buffer.writeUInt32LE(2, 4); buffer.writeUInt32LE(buffer.length, 8);
  buffer.writeUInt32LE(padded.length, 12); buffer.writeUInt32LE(0x4e4f534a, 16); padded.copy(buffer, 20); binary.copy(buffer, 20 + padded.length);
  return new GLTFLoader().parseAsync(buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength), '');
}

function documentFixture(t: test.TestContext) {
  t.mock.method(THREE.TextureLoader.prototype, 'load', () => new THREE.Texture());
  const previous = ['window', 'document'].map(key => Object.getOwnPropertyDescriptor(globalThis, key)), written: string[] = [];
  const ctx = { createRadialGradient: () => ({ addColorStop() {} }), fillRect() {}, strokeRect() {}, fillText(text: string) { written.push(text); }, beginPath() {}, closePath() {}, moveTo() {}, lineTo() {}, stroke() {}, ellipse() {}, fill() {}, createImageData: (w: number, h: number) => ({ data: new Uint8ClampedArray(w * h * 4) }), putImageData() {} };
  Object.assign(globalThis, { window: new EventTarget(), document: { createElement: () => ({ getContext: () => ctx }) } });
  t.after(() => ['window', 'document'].forEach((key, i) => { if (previous[i]) Object.defineProperty(globalThis, key, previous[i]!); else Reflect.deleteProperty(globalThis, key); }));
  return written;
}

test('the delivered Neo palms reach the physical console button and both rotating handwheel grips in either view', async t => {
  const assets = new Map(await Promise.all(['neo', 'neo-office', 'neo-tracking'].map(async id => [id, await geometry(id)] as const)));
  t.mock.method(GLTFLoader.prototype, 'loadAsync', (url: string) => assets.has(url.split('/').at(-1)!.slice(0, -4)) ? Promise.resolve(assets.get(url.split('/').at(-1)!.slice(0, -4))) : new Promise(() => {}));
  t.mock.method(THREE.TextureLoader.prototype, 'load', () => new THREE.Texture()); documentFixture(t);
  const scene = new THREE.Scene(), set = 'film_zion_engineering', center = FILM_SETS[set].center, root = new THREE.Group(); root.position.set(center.x, center.y - 1, center.z); scene.add(root);
  const room = new ZionHomecomingRenderer(root, set), renderer = new AgentRenderer(scene), world = new WorldState(); new AgentManager(world).initializeAllAgents();
  const neo = structuredClone(world.agents.get('neo')!); Object.assign(neo, { currentLocation: set, isInMatrix: false, velocity: { x: 0, y: 0, z: 0 }, currentAction: null }); renderer.setWorld(false); renderer.updateAgent('neo', neo);
  t.after(() => { renderer.dispose(); room.dispose(); });
  for (let frame = 0; frame < 8; frame++) { await new Promise(resolve => setImmediate(resolve)); renderer.update(0); }
  const hero = renderer.getAgentHero('neo'); assert.ok(hero, 'retain the full delivered character');
  const misses: unknown[] = [];
  for (const first of [false, true]) for (const operation of ['readings', 'valve'] as const) for (const valve of operation === 'readings' ? [0] : [0, .2, .4, .6, .8, 1]) {
    const point = ZION_ENGINEERING[operation], encounter: EngineeringEncounter = { readings: operation === 'valve' ? 1 : .5, valve, operation, elapsed: 2, approach: { x: point.x, z: point.z, yaw: point.yaw } };
    neo.position = filmPosition(set, point.x, point.z); neo.rotation = point.yaw;
    neo.currentAction = { type: 'idle', parameters: { player: true, resolved: true, engineering: encounter }, startedAt: 9000, duration: 1e9, progress: 0 };
    renderer.updateAgent('neo', neo); renderer.setPlayer('neo', first); renderer.getAgent('neo')!.position.set(neo.position.x, neo.position.y, neo.position.z); renderer.getAgentBody('neo')!.rotation.y = neo.rotation;
    renderer.setPlayerMotion({ speed: 0, turn: 0, grounded: true, verticalVelocity: 0, realWorld: true, firstPerson: first, engineering: encounter });
    renderer.update(0); room.update({ scene: 'm2_hamann', step: operation === 'valve' ? 2 : 1, completed: [], engineering: encounter } as never, 0); scene.updateMatrixWorld(true);
    assert.equal(renderer.getAgentBody('neo')!.visible, true, 'the actual working hands remain visible in first person');
    if (first) {
      const skin = hero.getObjectByName('Anatomical_head_and_hands') as THREE.SkinnedMesh;
      const { skinIndex, skinWeight } = skin.geometry.attributes, index = skin.geometry.index!; let headVisible = false;
      for (let i = 0; i < index.count; i++) for (let part = 0; part < 4; part++) {
        const vertex = index.getX(i);
        if (skinWeight.getComponent(vertex, part) > .05 && /^(head|neck|MorpheusJaw)$/.test(skin.skeleton.bones[skinIndex.getComponent(vertex, part)].name)) headVisible = true;
      }
      assert.equal(headVisible, false, 'first-person controls must not render the player face around the camera');
      hero.traverse(part => { if (part.userData.oralSurface || part.name.startsWith('neo-teeth') || part.name === 'neo-tongue') assert.equal(part.visible, false, 'mouth surfaces must not float over the readout'); });
    }
    const wheel = root.getObjectByName('zion-backup-handwheel')!, control = root.getObjectByName('zion-air-water-console')!;
    for (const side of ['R', 'L'] as const) {
      const wrist = hero.getObjectByName(`wrist_${side}`)!; const palm = wrist.localToWorld(new THREE.Vector3(0, -.19, .035));
      const target = operation === 'valve' ? wheel.getObjectByName(`zion-handwheel-grip-${side}`)!.getWorldPosition(new THREE.Vector3()).add(new THREE.Vector3(-.075, 0, 0))
        : side === 'R' ? control.getObjectByName('zion-engineering-button')!.getWorldPosition(new THREE.Vector3()).add(new THREE.Vector3(.07, 0, 0))
        : control.localToWorld(new THREE.Vector3(.1, -.4, .4));
      if (palm.distanceTo(target) >= .08) {
        const shoulder = hero.getObjectByName(`shoulder_${side}`)!, elbow = hero.getObjectByName(`elbow_${side}`)!;
        misses.push({ operation, valve, side, first, gap: palm.distanceTo(target), palm: palm.toArray(), target: target.toArray(), shoulder: shoulder.getWorldPosition(new THREE.Vector3()).toArray(), arm: (elbow.position.length() + wrist.position.length()) * shoulder.getWorldScale(new THREE.Vector3()).x });
      }
    }
  }
  assert.equal(misses.length, 0, JSON.stringify(misses.slice(0, 4)));
});

test('readout text uses the saved loop values and reuses its texture without uploading unchanged paused readings', t => {
  const written = documentFixture(t), root = new THREE.Group(), room = new ZionHomecomingRenderer(root, 'film_zion_engineering'); t.after(() => room.dispose());
  const state = { scene: 'm2_hamann', step: 2, completed: [], engineering: { readings: 1, valve: .4, elapsed: 2 } };
  room.update(state as never, 0); const screen = root.getObjectByName('zion-engineering-screen') as THREE.Mesh<THREE.BufferGeometry, THREE.MeshStandardMaterial>, map = screen.material.map!;
  assert.ok(written.includes('WATER     79%')); const version = map.version, count = written.length;
  room.update(structuredClone(state) as never, 100); assert.equal(map.version, version); assert.equal(written.length, count);
  room.update({ ...state, engineering: { readings: 1, valve: 1, elapsed: 0 } } as never, 100);
  assert.ok(screen.material.map === map); assert.ok(written.includes('WATER     96%') && written.includes('BACKUP BALANCED'));
});

test('all four saved loop readout lines remain visible in front of the console pedestal', t => {
  documentFixture(t); const root = new THREE.Group(), room = new ZionHomecomingRenderer(root, 'film_zion_engineering'); t.after(() => room.dispose()); root.updateMatrixWorld(true);
  const console = root.getObjectByName('zion-air-water-console')!, screen = root.getObjectByName('zion-engineering-screen')!;
  const hidden: { line: number; column: number }[] = [];
  for (let line = 0; line < 4; line++) for (const column of [-.3, 0, .3]) {
    const target = screen.localToWorld(new THREE.Vector3(column, .45 - (21 + line * 36) / 192 * .9, 0));
    const eye = target.clone().add(new THREE.Vector3(3, .8, 0)), hits = new THREE.Raycaster(eye, target.clone().sub(eye).normalize()).intersectObject(console, true);
    if (hits[0]?.object !== screen) hidden.push({ line: line + 1, column });
  }
  assert.equal(hidden.length, 0, 'Readout rows hidden by the device: ' + JSON.stringify(hidden));
});

test('the full handwheel remains visible from the supported operating side instead of disappearing into its pedestal', t => {
  documentFixture(t); const root = new THREE.Group(), room = new ZionHomecomingRenderer(root, 'film_zion_engineering'); t.after(() => room.dispose());
  room.update({ scene: 'm2_hamann', step: 2, completed: [], engineering: { readings: 1, valve: .4, elapsed: 1 } } as never, 0); root.updateMatrixWorld(true);
  const wheel = root.getObjectByName('zion-backup-handwheel')!, blocked: number[] = [];
  for (let point = 0; point < 8; point++) {
    const angle = point / 8 * Math.PI * 2, target = new THREE.Vector3(7.135, 3.05 + Math.sin(angle) * .42, -24 + Math.cos(angle) * .42);
    const eye = target.clone().add(new THREE.Vector3(-1.235, .65, 0)), hits = new THREE.Raycaster(eye, target.clone().sub(eye).normalize()).intersectObject(root, true);
    if (!hits[0] || hits[0].object.parent !== wheel) blocked.push(point);
  }
  assert.equal(blocked.length, 0, 'Handwheel rim points hidden by the set: ' + JSON.stringify(blocked));
});
