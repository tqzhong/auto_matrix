import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { FILM_SETS, ZION_CAST, ZION_MESSAGE, ZION_MESSAGE_ROLES, newZionMessage, zionMessageTrinity, filmPosition, type FilmJourney, type ZionMessageEncounter, type ZionMessageGesture } from '@auto_matrix/shared';
import { AgentRenderer } from '../packages/client/src/agents/AgentRenderer.js';
import { ZionHomecomingRenderer } from '../packages/client/src/engine/ZionHomecomingRenderer.js';
import { PlayerControls } from '../packages/client/src/player/PlayerControls.js';
import { WorldState } from '../packages/server/src/world/WorldState.js';
import { AgentManager } from '../packages/server/src/agents/AgentManager.js';

async function geometry(id: string) {
  const bytes = await readFile(new URL(`../packages/client/public/assets/characters/${id}.glb`, import.meta.url)), length = bytes.readUInt32LE(12), document = JSON.parse(bytes.subarray(20, 20 + length).toString());
  for (const material of document.materials) { delete material.pbrMetallicRoughness?.baseColorTexture; delete material.normalTexture; }
  document.images = []; document.textures = [];
  const json = Buffer.from(JSON.stringify(document)), padded = Buffer.alloc(Math.ceil(json.length / 4) * 4, 32); json.copy(padded);
  const binary = bytes.subarray(20 + length), buffer = Buffer.alloc(20 + padded.length + binary.length);
  buffer.writeUInt32LE(0x46546c67, 0); buffer.writeUInt32LE(2, 4); buffer.writeUInt32LE(buffer.length, 8); buffer.writeUInt32LE(padded.length, 12); buffer.writeUInt32LE(0x4e4f534a, 16); padded.copy(buffer, 20); binary.copy(buffer, 20 + padded.length);
  return new GLTFLoader().parseAsync(buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength), '');
}
async function setup(t: test.TestContext, extraAssets: string[] = []) {
  const assets = new Map(await Promise.all(['neo', 'neo-office', 'neo-tracking', 'trinity', 'trinity-club', 'morpheus', ...extraAssets].map(async id => [id, await geometry(id)] as const)));
  t.mock.method(GLTFLoader.prototype, 'loadAsync', (url: string) => assets.has(url.split('/').at(-1)!.slice(0, -4)) ? Promise.resolve(assets.get(url.split('/').at(-1)!.slice(0, -4))) : new Promise(() => {}));
  t.mock.method(THREE.TextureLoader.prototype, 'load', () => new THREE.Texture());
  const old = ['window', 'document'].map(key => Object.getOwnPropertyDescriptor(globalThis, key));
  const ctx = { createRadialGradient: () => ({ addColorStop() {} }), fillRect() {}, strokeRect() {}, fillText() {}, beginPath() {}, closePath() {}, moveTo() {}, lineTo() {}, stroke() {}, ellipse() {}, fill() {}, createImageData: (w: number, h: number) => ({ data: new Uint8ClampedArray(w * h * 4) }), putImageData() {} };
  Object.assign(globalThis, { window: new EventTarget(), document: { createElement: () => ({ getContext: () => ctx }) } });
  const scene = new THREE.Scene(), center = FILM_SETS.film_zion_bedroom.center, root = new THREE.Group(); root.position.set(center.x, center.y - 1, center.z); scene.add(root);
  const room = new ZionHomecomingRenderer(root, 'film_zion_bedroom'), renderer = new AgentRenderer(scene), world = new WorldState(); new AgentManager(world).initializeAllAgents(); renderer.setWorld(false);
  const pose = (state: ZionMessageEncounter, first = false, elapsed = 0) => {
    for (const role of ZION_MESSAGE_ROLES) {
      const actor = structuredClone(world.agents.get(role)!), point = state.bodies[role], gesture: ZionMessageGesture = { ...state, role };
      Object.assign(actor, { currentLocation: 'film_zion_bedroom', isInMatrix: false, position: filmPosition('film_zion_bedroom', point.x, point.z), rotation: point.yaw, velocity: { x: 0, y: 0, z: 0 },
        currentAction: { type: 'idle', parameters: { resolved: true, player: role === 'neo', zionMessage: gesture }, startedAt: 9400, duration: 1e9, progress: 0 } }); renderer.updateAgent(role, actor);
    }
    renderer.setPlayer('neo', first); const neo = renderer.getAgentState('neo')!; renderer.getAgent('neo')!.position.set(neo.position.x, neo.position.y, neo.position.z); renderer.getAgentBody('neo')!.rotation.y = neo.rotation;
    renderer.setPlayerMotion({ speed: 0, turn: 0, grounded: true, verticalVelocity: 0, realWorld: true, firstPerson: first, zionMessage: { ...state, role: 'neo' } });
    renderer.update(0); room.update({ scene: 'm2_oracle_message', step: state.phase === 'done' ? 2 : state.door === 1 ? 1 : 0, completed: [], zionMessage: state } as never, elapsed); scene.updateMatrixWorld(true);
  };
  pose(newZionMessage()); for (let frame = 0; frame < 12; frame++) { await new Promise(resolve => setImmediate(resolve)); renderer.update(0); }
  for (const id of ['neo', 'trinity', 'ballard']) assert.ok(renderer.getAgentHero(id), id + ': retain the delivered full character');
  t.after(() => { renderer.dispose(); room.dispose(); ['window', 'document'].forEach((key, i) => { if (old[i]) Object.defineProperty(globalThis, key, old[i]!); else Reflect.deleteProperty(globalThis, key); }); });
  const palm = (id: string) => renderer.getAgentHero(id)!.getObjectByName('wrist_R')!.localToWorld(new THREE.Vector3(0, -.19, .035));
  return { scene, root, room, renderer, pose, palm };
}

test('Trinity reaches the physical door handle throughout its real swing in either camera view', async t => {
  const h = await setup(t), misses: unknown[] = [];
  for (const first of [false, true]) for (const door of [0, .2, .4, .6, .8, 1]) {
    const state = newZionMessage(); Object.assign(state, { phase: door ? 'opening' : 'unlatching', door, elapsed: door ? door * ZION_MESSAGE.opening : ZION_MESSAGE.unlatch }); state.bodies.trinity = zionMessageTrinity(door); h.pose(state, first);
    const handle = h.root.getObjectByName('zion-message-door-handle')!, target = handle.localToWorld(new THREE.Vector3(0, 0, -ZION_MESSAGE.handle.radius)), gap = h.palm('trinity').distanceTo(target);
    if (gap >= .08) misses.push({ first, door, gap });
  }
  assert.equal(misses.length, 0, JSON.stringify(misses));
});

test('moving and paused Trinity retain the saved door-facing pose instead of facing her walking velocity', async t => {
  const h = await setup(t), misses: unknown[] = [];
  for (const first of [false, true]) for (const door of [.205, .6]) for (const speed of [1, 0]) {
    const state = newZionMessage(); Object.assign(state, { phase: 'opening', door, elapsed: door * ZION_MESSAGE.opening }); state.bodies.trinity = zionMessageTrinity(door); h.pose(state, first);
    const before = zionMessageTrinity(door - .01), point = state.bodies.trinity;
    h.renderer.getAgentState('trinity')!.velocity = { x: (point.x - before.x) / .03, y: 0, z: (point.z - before.z) / .03 };
    for (let frame = 0; frame < 4; frame++) h.renderer.update(.03, undefined, speed);
    const handle = h.root.getObjectByName('zion-message-door-handle')!, gap = h.palm('trinity').distanceTo(handle.localToWorld(new THREE.Vector3(0, 0, -ZION_MESSAGE.handle.radius)));
    const yaw = h.renderer.getAgentBody('trinity')!.rotation.y, difference = Math.atan2(Math.sin(yaw - point.yaw), Math.cos(yaw - point.yaw));
    if (Math.abs(difference) > .001 || gap >= .08) misses.push({ first, door, speed, difference, gap });
  }
  assert.equal(misses.length, 0, JSON.stringify(misses));
});

test('the single disk stays under the actual holder palm while offered, received and stowed, independent of browser time', async t => {
  const h = await setup(t), misses: unknown[] = [];
  const cases = [['entering', .4, 'ballard'], ['presenting', .45, 'ballard'], ['offer', 0, 'ballard'], ['taking', .9, 'ballard'], ['transfer', .1, 'ballard'], ['transfer', .4, 'neo'], ['stowing', .3, 'neo'], ['stowing', .8, 'neo']] as const;
  for (const first of [false, true]) for (const [phase, elapsed, owner] of cases) {
    const state = newZionMessage(1); Object.assign(state, { phase, elapsed, owner }); state.bodies.neo.yaw = Math.atan2(state.bodies.ballard.x - state.bodies.neo.x, state.bodies.ballard.z - state.bodies.neo.z); h.pose(state, first);
    const disk = h.root.getObjectByName('oracle-message-disk')!; assert.equal(disk.visible, true); assert.equal(h.root.getObjectsByProperty('name', 'oracle-message-disk').length, 1);
    for (const role of phase === 'taking' || phase === 'transfer' && owner === 'ballard' ? ['ballard', 'neo'] : [owner]) {
      const point = disk.worldToLocal(h.palm(role)), horizontal = Math.hypot(point.x, point.z), vertical = Math.abs(point.y + .035);
      if (horizontal > ZION_MESSAGE.diskRadius + .05 || vertical >= .08) misses.push({ first, phase, elapsed, role, horizontal, vertical });
    }
    const before = disk.getWorldPosition(new THREE.Vector3()).toArray(); h.pose(structuredClone(state), first, 300); assert.deepEqual(disk.getWorldPosition(new THREE.Vector3()).toArray(), before);
  }
  const done = newZionMessage(2); h.pose(done); assert.equal(h.root.getObjectByName('oracle-message-disk')!.visible, false);
  assert.equal(misses.length, 0, JSON.stringify(misses.slice(0, 8)));
});

test('Ballard’s short hair follows his actual scalp while he delivers the disk', async t => {
  const h = await setup(t), state = newZionMessage(1);
  const hero = h.renderer.getAgentHero('ballard')!, head = hero.getObjectByName('head')!;
  const skin = hero.getObjectByName('Anatomical_head_and_hands') as THREE.SkinnedMesh;
  const hair = head.children.find(part => part instanceof THREE.Mesh && part.material instanceof THREE.MeshStandardMaterial
    && part.material.color.getHex() === 0x151813) as THREE.Mesh;
  assert.ok(hair && skin instanceof THREE.SkinnedMesh);
  for (const phase of ['offer', 'taking', 'stowing'] as const) {
    state.phase = phase; state.elapsed = .36; state.owner = phase === 'stowing' ? 'neo' : 'ballard';
    h.pose(state);
    const fromWorld = head.matrixWorld.clone().invert(), fromSkin = fromWorld.clone().multiply(skin.matrixWorld);
    const fromHair = fromWorld.clone().multiply(hair.matrixWorld), scalp: THREE.Vector3[] = [];
    for (let i = 0; i < skin.geometry.attributes.position.count; i++) {
      const point = skin.getVertexPosition(i, new THREE.Vector3()).applyMatrix4(fromSkin);
      // Include the back hairline below the head bone while excluding the hands.
      if (point.lengthSq() < .6 ** 2) scalp.push(point);
    }
    assert(scalp.length > 100);
    const vertices = hair.geometry.attributes.position, point = new THREE.Vector3();
    const sampleEvery = Math.max(1, Math.floor(vertices.count / 100));
    let furthest = 0, top = -Infinity;
    for (let i = 0; i < vertices.count; i++) {
      point.fromBufferAttribute(vertices, i).applyMatrix4(fromHair);
      top = Math.max(top, point.y);
      if (i % sampleEvery) continue;
      const closest = scalp.reduce((best, skinPoint) => Math.min(best, point.distanceToSquared(skinPoint)), Infinity);
      furthest = Math.max(furthest, Math.sqrt(closest));
    }
    assert(furthest < .04, `${phase}: the hair crosses or lifts off the actual scalp by ${furthest}`);
    const crown = scalp.reduce((upper, skinPoint) => Math.max(upper, skinPoint.y), -Infinity);
    assert(top >= crown && top - crown < .04, `${phase}: the short hair must cover the crown without gapping`);
  }
});

test('the Zion message follow camera keeps the door handle and the disk clear of Neo', async t => {
  const h = await setup(t);
  const canvas = Object.assign(new EventTarget(), { matches: () => false });
  const document = Object.assign(new EventTarget(), globalThis.document, { pointerLockElement: canvas, hidden: false, exitPointerLock() {} });
  globalThis.document = document;
  const keyboard = Object.assign(window, { matches: () => false });
  const camera = new THREE.PerspectiveCamera(57, 16 / 9, .5, 5000);
  const controls = new PlayerControls(canvas as unknown as HTMLCanvasElement, camera, () => {}, () => {});
  const opening = [.26, .55, .88].map(door => {
    const state = newZionMessage();
    Object.assign(state, { phase: 'opening', door, elapsed: door * ZION_MESSAGE.opening });
    state.bodies.trinity = zionMessageTrinity(door);
    return state;
  });
  const receiving = (['taking', 'transfer', 'stowing'] as const).map(phase => {
    const state = newZionMessage(1);
    Object.assign(state, { phase, elapsed: .36, owner: phase === 'taking' ? 'ballard' : 'neo' });
    state.bodies.neo.yaw = Math.atan2(state.bodies.ballard.x - state.bodies.neo.x, state.bodies.ballard.z - state.bodies.neo.z);
    return state;
  });
  try {
    for (const aspect of [16 / 9, 720 / 1024]) for (const state of [...opening, ...receiving]) {
      h.pose(state);
      const neo = h.renderer.getAgentState('neo')!, group = h.renderer.getAgent('neo')!;
      camera.aspect = aspect; camera.updateProjectionMatrix(); controls.release(); controls.possess(neo);
      const frame = () => {
        controls.update(1 / 60, neo, group, false);
        controls.syncTrainmanChaseCamera(group, h.root);
        h.scene.updateMatrixWorld(true); camera.updateMatrixWorld(true);
      };
      frame();
      const name = state.phase === 'opening' ? 'zion-message-door-handle' : 'oracle-message-disk';
      const subject = h.root.getObjectByName(name)!;
      const center = subject.getWorldPosition(new THREE.Vector3()), vector = center.clone().sub(camera.position);
      const ray = new THREE.Raycaster(camera.position, vector.clone().normalize(), .08, vector.length() - .16);
      const blocked = ray.intersectObjects([h.renderer.getAgentBody('neo')!, h.root], true).filter(hit => {
        for (let object: THREE.Object3D | null = hit.object; object; object = object.parent) if (object === subject || !object.visible) return false;
        return true;
      });
      const screen = center.project(camera), label = `${aspect} ${state.phase} ${state.door}`;
      assert.ok(Math.abs(screen.x) < .9 && Math.abs(screen.y) < .9 && screen.z > -1 && screen.z < 1, label);
      assert.deepEqual(blocked.map(hit => hit.object.name), [], label + ': the actual interaction is hidden in the follow view');
      if (state.phase === 'taking') {
        const defaultView = camera.position.clone();
        document.dispatchEvent(Object.assign(new Event('mousemove'), { movementX: 150, movementY: 20 }));
        frame();
        assert.ok(camera.position.distanceTo(defaultView) > 1, 'mouse look takes over the automatic framing');
        keyboard.dispatchEvent(Object.assign(new Event('keydown'), { code: 'KeyV', repeat: false }));
        frame();
        assert.equal(controls.firstPerson, true);
        assert.ok(Math.hypot(camera.position.x - neo.position.x, camera.position.z - neo.position.z) < 1);
      }
    }
  } finally { controls.dispose(); }
});

test('Zee and Link hand over one visible charm using their delivered wrists', async t => {
  const h = await setup(t, ['zee-body']);
  const set = 'film_zion_hangar', center = FILM_SETS[set].center, root = new THREE.Group();
  root.position.set(center.x, center.y - 1, center.z); h.scene.add(root);
  const hangar = new ZionHomecomingRenderer(root, set, 'm2_departure');
  t.after(() => hangar.dispose());
  const world = new WorldState(); new AgentManager(world).initializeAllAgents();
  const journey = { scene: 'm2_departure', step: 0, actor: 'neo', completed: [] } as unknown as FilmJourney;
  for (const id of ['neo', 'link', 'zee'] as const) {
    const agent = world.agents.get(id)!, mark = id === 'neo' ? { x: 0, z: 32, yaw: Math.PI } : ZION_CAST.m2_departure[id];
    Object.assign(agent, { currentLocation: set, isInMatrix: false, position: filmPosition(set, mark.x, mark.z), rotation: mark.yaw });
    h.renderer.updateAgent(id, agent, journey);
    h.renderer.getAgent(id)!.position.copy(agent.position);
    h.renderer.getAgentBody(id)!.rotation.y = agent.rotation;
  }
  for (let frame = 0; frame < 12; frame++) {
    h.renderer.update(.05, undefined, 0, 100, journey);
    await new Promise(resolve => setImmediate(resolve));
  }
  const charm = root.getObjectByName('zee-farewell-charm')!;
  assert.equal(root.getObjectsByProperty('name', charm.name).length, 1);
  const palm = (id: string) => {
    const hero = h.renderer.getAgentHero(id);
    const body = hero ?? h.renderer.getAgentDetail(id)!.getObjectByName(id + '-detailed-body');
    assert.ok(body?.visible, `${id} uses their delivered body`);
    return body.getObjectByName('wrist_R')!.localToWorld(hero ? new THREE.Vector3(0, -.19, .035) : new THREE.Vector3(0, -.14, .05));
  };
  const render = (tick: number) => {
    h.renderer.update(.05, undefined, 0, tick, journey);
    hangar.update(journey, 300, undefined, undefined, h.renderer.departureGift);
    h.scene.updateMatrixWorld(true);
    return charm.localToWorld(new THREE.Vector3(0, .21, 0));
  };
  let loop = render(100);
  assert.equal(charm.visible, true);
  assert(loop.distanceTo(palm('zee')) < .11, 'the waiting charm hangs from Zee’s hand');
  journey.started = 100;
  loop = render(104);
  assert(loop.distanceTo(palm('zee')) < .18 && loop.distanceTo(palm('link')) < .18, 'both hands meet at the same charm');
  loop = render(107);
  assert(loop.distanceTo(palm('link')) < .11, 'Link takes the charm before the farewell ends');
  assert(loop.distanceTo(palm('zee')) > .35);
  journey.step = 1; delete journey.started; render(108);
  assert.equal(charm.visible, false);
});

test('Kid holds one spoon, Neo takes it by the handle, and a cancelled exchange gives it back to Kid', async t => {
  const h = await setup(t, ['kid-body']);
  const set = 'film_zion_hangar', center = FILM_SETS[set].center, root = new THREE.Group();
  root.position.set(center.x, center.y - 1, center.z); h.scene.add(root);
  const hangar = new ZionHomecomingRenderer(root, set, 'm2_departure');
  t.after(() => hangar.dispose());
  const world = new WorldState(); new AgentManager(world).initializeAllAgents();
  const journey = { scene: 'm2_departure', step: 2, actor: 'neo', completed: [] } as unknown as FilmJourney;
  for (const id of ['kid', 'neo'] as const) {
    const actor = world.agents.get(id)!, mark = id === 'kid' ? ZION_CAST.m2_departure.kid : { x: -3, z: 10.2, yaw: Math.PI };
    Object.assign(actor, { currentLocation: set, isInMatrix: false, position: filmPosition(set, mark.x, mark.z), rotation: mark.yaw });
    h.renderer.updateAgent(id, actor, journey);
    h.renderer.getAgent(id)!.position.copy(actor.position);
    h.renderer.getAgentBody(id)!.rotation.y = actor.rotation;
  }
  h.renderer.setPlayerMotion({ speed: 0, turn: 0, grounded: true, verticalVelocity: 0, realWorld: true });
  for (let frame = 0; frame < 12; frame++) {
    h.renderer.update(.05, undefined, 0, 100, journey);
    await new Promise(resolve => setImmediate(resolve));
  }
  const spoon = root.getObjectByName('kid-spoon-gift')!;
  const kidBody = h.renderer.getAgentDetail('kid')!.getObjectByName('kid-detailed-body')!;
  assert.ok(kidBody?.visible);
  const kidPalm = () => kidBody.getObjectByName('wrist_R')!.localToWorld(new THREE.Vector3(0, -.14, .05));
  const neo = h.renderer.getAgentHero('neo')!, garment = neo.getObjectByName('neo-logos-sweater') as THREE.SkinnedMesh;
  const trousers = neo.getObjectByName('Tailored_trousers')!, fullGarment = garment.geometry;
  const render = (tick: number, first: boolean) => {
    h.renderer.setPlayer('neo', first);
    h.renderer.setPlayerMotion({ speed: 0, turn: 0, grounded: true, verticalVelocity: 0, realWorld: true, firstPerson: first });
    h.renderer.update(.05, undefined, 0, tick, journey);
    hangar.update(journey, 300, undefined, undefined, h.renderer.departureGift);
    h.scene.updateMatrixWorld(true);
    return spoon.getWorldPosition(new THREE.Vector3());
  };
  assert.equal(root.getObjectsByProperty('name', spoon.name).length, 1);
  for (const first of [false, true]) {
    journey.step = 2; delete journey.started;
    assert.ok(render(100, first).distanceTo(kidPalm()) < .11, 'Kid holds the waiting spoon');
    assert.ok(spoon.visible);
    journey.started = 100;
    const contact = render(103, first);
    const gaps = [contact.distanceTo(kidPalm()), contact.distanceTo(h.palm('neo'))];
    assert.ok(gaps.every(gap => gap < .24), `both hands meet at the shaft: ${JSON.stringify(gaps)}`);
    assert.ok(h.renderer.getAgentBody('neo')!.visible, 'the receiving hand remains visible in either view');
    if (first) {
      assert.equal(trousers.visible, false, 'Neo’s torso and legs stay out of the camera');
      const sleeveIndices = garment.geometry.index!.count;
      assert.ok(garment.visible && sleeveIndices > 0 && sleeveIndices < fullGarment.index!.count, 'the visible sleeve covers the receiving forearm');
      render(103, false);
      assert.ok(trousers.visible && garment.geometry === fullGarment, 'external view restores the full outfit');
    }
    assert.ok(render(105, first).distanceTo(h.palm('neo')) < .11, 'the spoon follows Neo before stowing');
    delete journey.started;
    assert.ok(render(106, first).distanceTo(kidPalm()) < .11, 'leaving the exchange returns the same spoon to Kid');
    journey.step = 3; render(107, first);
    assert.equal(spoon.visible, false);
  }
});
