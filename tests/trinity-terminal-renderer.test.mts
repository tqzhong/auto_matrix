import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { WorldState } from '../packages/server/src/world/WorldState.js';
import { AgentManager } from '../packages/server/src/agents/AgentManager.js';
import { FILM_SETS, TRINITY_TERMINAL, filmPosition, filmObstacles, playerBlocked, type TrinityTerminal } from '@auto_matrix/shared';
import { TrinityTerminalRenderer } from '../packages/client/src/engine/TrinityTerminalRenderer.js';
import { CharacterModels } from '../packages/client/src/agents/CharacterModel.js';
import { PlayerControls } from '../packages/client/src/player/PlayerControls.js';
async function models(t: test.TestContext) {
  const assets = new Map();
  for (const name of ['neo', 'trinity', 'smith', 'morpheus', 'neo-office', 'neo-tracking', 'trinity-club', 'choi', 'dujour']) {
    const glb = await readFile(new URL(`../packages/client/public/assets/characters/${name}.glb`, import.meta.url));
    const length = glb.readUInt32LE(12), source = JSON.parse(glb.subarray(20, 20 + length).toString());
    for (const material of source.materials) { delete material.pbrMetallicRoughness.baseColorTexture; delete material.normalTexture; }
    source.images = []; source.textures = [];
    const json = Buffer.from(JSON.stringify(source)), padded = Buffer.alloc(Math.ceil(json.length / 4) * 4, 32); json.copy(padded);
    const bin = glb.subarray(20 + length), buffer = Buffer.alloc(20 + padded.length + bin.length);
    buffer.writeUInt32LE(0x46546c67, 0); buffer.writeUInt32LE(2, 4); buffer.writeUInt32LE(buffer.length, 8);
    buffer.writeUInt32LE(padded.length, 12); buffer.writeUInt32LE(0x4e4f534a, 16); padded.copy(buffer, 20); bin.copy(buffer, 20 + padded.length);
    assets.set(name, await new GLTFLoader().parseAsync(buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength), ''));
  }
  t.mock.method(GLTFLoader.prototype, 'loadAsync', async (url: string) => assets.get(url.split('/').pop()!.replace('.glb', '')));
  t.mock.method(THREE.TextureLoader.prototype, 'load', () => new THREE.Texture());
  class InputTarget extends EventTarget { matches() { return false; } }
  const previousDocument = globalThis.document, previousWindow = globalThis.window;
  globalThis.window = new InputTarget() as unknown as Window & typeof globalThis;
  globalThis.document = Object.assign(new InputTarget(), { pointerLockElement: null, hidden: false, exitPointerLock() {},
    createElement: () => ({ getContext: () => ({ createRadialGradient: () => ({ addColorStop() {} }), fillRect() {}, strokeRect() {}, fillText() {},
      createImageData: (w: number, h: number) => ({ data: new Uint8ClampedArray(w * h * 4) }), putImageData() {} }) }) }) as unknown as Document;
  const world = new WorldState(); new AgentManager(world).initializeAllAgents(); const characters = new CharacterModels();
  const cleanups: (() => void)[] = [];
  t.after(() => { cleanups.forEach(cleanup => cleanup()); characters.dispose(); globalThis.document = previousDocument; globalThis.window = previousWindow; });
  return { world, characters, cleanups, canvas: new InputTarget() as unknown as HTMLCanvasElement };
}


async function consolePose(t: test.TestContext, elapsed = 2) {
  const h = await models(t), rig = h.characters.create(h.world.agents.get('trinity')!);
  await new Promise(resolve => setImmediate(resolve)); assert.ok(rig.hero);
  const center = FILM_SETS.film_backup_station.center, root = TRINITY_TERMINAL.root;
  const room = new THREE.Group(); room.position.set(center.x, center.y - 1, center.z);
  const renderer = new TrinityTerminalRenderer(room); t.after(() => renderer.dispose());
  rig.root.position.set(center.x + root.x, center.y - 1, center.z + root.z); rig.root.rotation.y = root.yaw;
  const state: TrinityTerminal = { phase: 'typing', elapsed, attempts: 0, selected: 'ssh' };
  const pose = () => {
    h.characters.animate(rig, 0, { speed: 0, grounded: true, verticalVelocity: 0, turn: 0, trinityTerminal: state, armed: true }, 0);
    rig.root.updateMatrixWorld(true); rig.root.traverse(o => { if (o instanceof THREE.SkinnedMesh) o.skeleton.update(); });
  };
  pose(); room.updateMatrixWorld(true); return { ...h, rig, room, renderer, state, pose };
}

test('both palms reach the visible keyboard without putting the forearms through the desktop', async t => {
  for (const elapsed of [0, .5, 1, 2, 3.5]) {
    const h = await consolePose(t, elapsed), keyboard = h.room.getObjectByName('terminal-keyboard')!;
    const bounds = new THREE.Box3().setFromObject(keyboard), table = h.room.getObjectByName('terminal-desk-0')!;
    for (const side of ['R', 'L']) {
      const palm = h.rig.hero!.bones.get(`wrist_${side}`)!.localToWorld(new THREE.Vector3(0, -.19, .035));
      assert.ok(palm.x >= bounds.min.x && palm.x <= bounds.max.x && palm.z >= bounds.min.z && palm.z <= bounds.max.z, `palm outside keyboard: ${palm.toArray()}`);
      assert.ok(palm.y - bounds.max.y >= .02 && palm.y - bounds.max.y < .1, `palm/keys gap ${palm.y - bounds.max.y}`);
      const elbow = h.rig.hero!.bones.get(`elbow_${side}`)!.getWorldPosition(new THREE.Vector3()), direction = palm.clone().sub(elbow);
      assert.equal(new THREE.Raycaster(elbow, direction.clone().normalize(), .02, direction.length() - .02).intersectObject(table).length, 0, `forearm crosses desk at ${elapsed}`);
    }
    assert.equal(h.rig.hero!.glasses.visible, false, 'Trinity removes her glasses at the film terminal');
    assert.equal(h.rig.weapons?.some(gun => gun.visible) ?? false, false, 'typing cannot leave a pistol inside the keyboard');
    const before = h.rig.hero!.bones.get('wrist_R')!.getWorldPosition(new THREE.Vector3()); h.pose();
    assert.ok(before.distanceTo(h.rig.hero!.bones.get('wrist_R')!.getWorldPosition(new THREE.Vector3())) < 1e-7, 'paused and restored poses are reconstructed by the saved typing clock');
  }
});

test('the approach is reachable, and the same visible desks and walls block movement', async t => {
  const h = await consolePose(t), set = FILM_SETS.film_backup_station;
  const point = TRINITY_TERMINAL.root;
  assert.equal(playerBlocked(filmPosition(set.id, point.x, point.z), true, 1.1), false);
  const desk = TRINITY_TERMINAL.desk;
  assert.equal(playerBlocked(filmPosition(set.id, desk.x, desk.z), true, 1.1), true);
  assert.ok(filmObstacles(set).some(o => o === desk));
  const head = h.rig.hero!.bones.get('head')!.getWorldPosition(new THREE.Vector3());
  const casing = h.room.getObjectByName('terminal-crt-casing')!;
  assert.equal(new THREE.Box3().setFromObject(casing).expandByScalar(.08).containsPoint(head), false, 'leaning cannot bury the head in the CRT');
});

test('both player cameras can see the computer and first person follows mouse turning at the console', async t => {
  const h = await consolePose(t), camera = new THREE.PerspectiveCamera(60, 16 / 9, .06, 2000);
  const actor = h.world.agents.get('trinity')!, center = FILM_SETS.film_backup_station.center;
  actor.position = filmPosition('film_backup_station', TRINITY_TERMINAL.root.x, TRINITY_TERMINAL.root.z); actor.rotation = Math.PI;
  actor.currentAction = { type: 'idle', parameters: { player: true, resolved: true, trinityTerminal: h.state }, startedAt: 0, duration: 1e9, progress: 0 };
  const controls = new PlayerControls(h.canvas, camera, () => {}, () => {}); h.cleanups.push(() => controls.dispose()); controls.possess(actor);
  // AgentRenderer passes the carrier at actor.y, with the actual body one unit below it.
  const carrier = new THREE.Group(); carrier.position.set(actor.position.x, actor.position.y, actor.position.z);
  carrier.add(h.rig.root); h.rig.root.position.set(0, -1, 0); h.pose();
  for (const aspect of [16 / 9, .65]) for (const first of [false, true]) {
    camera.aspect = aspect; controls.firstPerson = first; controls.update(0, actor, carrier, true); camera.updateMatrixWorld(true);
    const screen = new THREE.Vector3(center.x, center.y - 1 + TRINITY_TERMINAL.screen.y, center.z + TRINITY_TERMINAL.screen.z);
    const projection = screen.clone().project(camera);
    assert.ok(Math.abs(projection.x) < .97 && Math.abs(projection.y) < .97 && projection.z < 1, `console offscreen ${aspect}/${first}: ${projection.toArray()}`);
    if (aspect > 1) for (const x of [-1, 1]) for (const y of [-1, 1]) {
      const corner = screen.clone().add(new THREE.Vector3(x * TRINITY_TERMINAL.screen.width / 2, y * TRINITY_TERMINAL.screen.height / 2, 0)).project(camera);
      assert.ok(Math.abs(corner.x) < .98 && Math.abs(corner.y) < .98, `CRT corner cropped in ${first ? 'first' : 'third'} person: ${corner.toArray()}`);
    }
    const heading = camera.getWorldDirection(new THREE.Vector3());
    if (first) {
      (controls as any).yaw += .3; controls.update(0, actor, carrier, true);
      assert.ok(heading.distanceTo(camera.getWorldDirection(new THREE.Vector3())) > .2, 'V view must not remain fixed forward');
      (controls as any).yaw = Math.PI;
    }
  }
});
