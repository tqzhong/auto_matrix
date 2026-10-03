import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from 'three';
import { build } from 'esbuild';
import { APARTMENT_NETWORK, APARTMENT_ROOM, filmPosition, playerBlocked, type WorldEvent } from '@auto_matrix/shared';
import { WorldState } from '../packages/server/src/world/WorldState.js';
import { AgentManager } from '../packages/server/src/agents/AgentManager.js';
import { SandboxSystem } from '../packages/server/src/player/SandboxSystem.js';
import { PlayerController } from '../packages/server/src/player/PlayerController.js';
import { LifeInteriors } from '../packages/client/src/engine/LifeInteriors.js';
import { PlayerControls } from '../packages/client/src/player/PlayerControls.js';
import { AgentRenderer } from '../packages/client/src/agents/AgentRenderer.js';
import { CharacterModels, type CharacterRig } from '../packages/client/src/agents/CharacterModel.js';
import type { WorldDynamics } from '../packages/server/src/story/WorldDynamics.js';
import type { ConversationEngine } from '../packages/server/src/agents/ConversationEngine.js';
import type { ActionExecutor } from '../packages/server/src/agents/ActionExecutor.js';

const network = APARTMENT_NETWORK.approach;
function setup() {
  const world = new WorldState(); new AgentManager(world).initializeAllAgents();
  const dynamics = { record: (event: Omit<WorldEvent, 'id'>) => world.addWorldEvent(event) } as WorldDynamics;
  const sandbox = new SandboxSystem(world, dynamics, 42);
  const players = new PlayerController(world, { interrupt() {}, isAgentInConversation: () => false } as unknown as ConversationEngine,
    { execute() {} } as unknown as ActionExecutor, dynamics, sandbox);
  players.possess('computer-player', 'neo', 0); const neo = players.getAgent('computer-player')!;
  sandbox.life.begin(neo, 0); neo.health = 63;
  sandbox.life.state!.anomaly = { id: 'screen', location: 'neo_apartment', position: { ...neo.position } };
  let tick = 0;
  const command = (target: string) => players.sandboxAction('computer-player', { kind: 'life', target }, ++tick);
  const near = (point: { x: number; z: number } = APARTMENT_NETWORK.screenApproach) => { neo.position = filmPosition('film_anderson_flat', point.x, point.z); neo.rotation = Math.PI; };
  const frames = (seconds: number, running = true) => { for (let i = 0; i < Math.ceil(seconds * 10); i++) players.step(.1, running, ++tick); };
  return { world, sandbox, neo, players, command, near, frames, life: () => sandbox.life.state! };
}

test('a home screen clue requires inspecting the real desk, disconnecting the cable and deliberately saving the offline echo', () => {
  const h = setup(), clock = h.world.timeOfDay;
  assert.match(h.command('anomaly:test'), /电脑|书桌/);
  assert.deepEqual(h.life().evidence, [], 'a journal command in the middle of the room cannot manufacture an investigation');
  h.near(); const position = { ...h.neo.position }; h.command('anomaly:test');
  assert.equal(h.life().computerCheck?.phase, 'reading'); assert.deepEqual(h.neo.position, position);
  h.frames(12); assert.equal(h.life().computerCheck?.phase, 'reading', 'waiting cannot unplug a cable');
  assert.deepEqual(h.life().clues, []); assert.equal(h.world.timeOfDay, clock);
  assert.match(h.command('computer:capture'), /断开|核对/);
  assert.match(h.command('computer:disconnect'), /网线|桌边/);
  h.near(network); h.command('computer:disconnect'); h.frames(1.8);
  assert.equal(h.life().computerCheck?.phase, 'offline'); assert.deepEqual(h.life().evidence, []);
  h.frames(4.2); assert.equal(h.life().computerCheck?.phase, 'evidence');
  assert.match(h.command('computer:capture'), /显示器|电脑/);
  h.near(); h.command('computer:capture');
  assert.deepEqual(h.life().evidence, ['screen']); assert.deepEqual(h.life().clues, ['screen']);
  assert.equal(h.life().doubt, 20); assert.equal(h.life().philosophy.agency, 1);
  assert.equal(h.world.timeOfDay, clock + 25 / .06); assert.equal(h.life().money, 140);
  assert.equal(h.life().computerCheck?.phase, 'saved', 'capturing evidence must not reconnect the cable by magic');
  const life = structuredClone(h.life()); h.command('computer:capture'); assert.deepEqual(h.life(), life);
  h.near(network); h.command('computer:reconnect'); h.frames(1.8);
  assert.equal(h.life().computerCheck, undefined); assert.equal(h.neo.health, 63);
});

test('the cable performance preserves its saved pose through pause, disconnection, occupied Neo and restore', () => {
  const h = setup(); h.near(); h.command('anomaly:test'); h.near(network); h.command('computer:disconnect'); h.frames(.7);
  assert.equal(h.life().computerCheck?.phase, 'unplugging');
  const check = structuredClone(h.life().computerCheck), position = { ...h.neo.position };
  h.frames(5, false); assert.deepEqual(h.life().computerCheck, check); assert.deepEqual(h.neo.position, position);
  h.players.release('computer-player', 0); h.frames(5); assert.deepEqual(h.life().computerCheck, check);
  h.sandbox.restore(JSON.parse(JSON.stringify(h.sandbox.state)));
  h.players.possess('other-player', 'neo', 0);
  assert.ok(h.players.possess('computer-player', 'neo', 0).error);
  assert.equal(h.players.getAgent('other-player'), h.neo); assert.equal(h.players.getAgent('computer-player'), undefined);
  assert.deepEqual(h.life().computerCheck, check); assert.deepEqual(h.neo.position, position);
  assert.deepEqual(h.neo.currentAction?.parameters.computerCheck, check);
  h.players.release('other-player', 0); h.players.possess('computer-player', 'neo', 0); h.frames(1.1);
  assert.equal(h.life().computerCheck?.phase, 'offline'); assert.equal(h.neo.health, 63);
});

test('walking away keeps an unfinished check and denies remote capture; ignoring it still leaves the cable disconnected', () => {
  const h = setup(); h.near(); h.command('anomaly:test'); h.near(network); h.command('computer:disconnect'); h.frames(6);
  h.neo.position = filmPosition('film_anderson_flat', 0, 6);
  const before = structuredClone(h.life()); assert.match(h.command('computer:capture'), /显示器|电脑/);
  assert.deepEqual(h.life().computerCheck, before.computerCheck); assert.deepEqual(h.life().clues, []);
  h.command('anomaly:ignore'); assert.equal(h.life().anomaly, undefined);
  assert.equal(h.life().computerCheck?.phase, 'saved'); assert.deepEqual(h.life().evidence, []);
});

test('a screen anomaly noticed from the other side of the apartment can still be investigated at its real computer', () => {
  const h = setup(); h.life().anomaly!.position = filmPosition('film_anderson_flat', 10.2, -9);
  h.near(); h.command('anomaly:test'); assert.equal(h.life().computerCheck?.phase, 'reading');
  h.near(network); h.command('computer:disconnect'); h.frames(6);
  h.near(); h.command('computer:capture'); assert.deepEqual(h.life().clues, ['screen']);
});

test('the third physical clue contacts Neo without starting the film, replacing life history or taking another character', () => {
  const h = setup(); h.world.day = 3; h.life().day = 3; h.life().lastMinute = 3330;
  h.life().evidence = ['receipt', 'commute']; h.life().clues = ['receipt', 'commute']; h.life().doubt = 40;
  const journal = structuredClone(h.life().journal); const trinity = structuredClone(h.world.agents.get('trinity')!);
  h.near(); h.command('anomaly:test'); h.near(network); h.command('computer:disconnect'); h.frames(6);
  assert.equal(h.life().chapter, 0); h.near(); h.command('computer:capture');
  assert.equal(h.life().chapter, 1); assert.equal(h.life().contactSignal, true); assert.equal(h.life().journey, undefined);
  assert.deepEqual(h.life().journal.slice(-journal.length), journal);
  assert.deepEqual(h.world.agents.get('trinity'), trinity); assert.equal(h.neo.isAwakened, false);
  const clock = h.world.timeOfDay; h.command('film:continue');
  assert.equal(h.life().journey?.scene, 'm1_wake_up'); assert.equal(h.world.timeOfDay, clock);
});

test('the real computer shows the home anomaly, cable separation and offline log, then yields to the film contact', t => {
  const original = globalThis.document, text: string[] = [];
  globalThis.document = { createElement: () => ({ width: 0, height: 0, getContext: () => ({ fillRect() {}, fillText(line: string) { text.push(line); } }) }) } as unknown as Document;
  t.mock.method(THREE.TextureLoader.prototype, 'load', () => new THREE.Texture());
  const root = new THREE.Group(), interiors = new LifeInteriors(root); const h = setup();
  try {
    interiors.update(7500, h.neo.position, h.life());
    assert.ok(text.some(line => line.includes('UNREGISTERED')));
    const plug = root.getObjectByName('apartment-network-plug')!; assert.ok(plug);
    const connected = plug.position.clone();
    h.near(); h.command('anomaly:test'); h.near(network); h.command('computer:disconnect'); h.frames(.9);
    text.length = 0; interiors.update(7500, h.neo.position, h.life()); assert.ok(plug.position.distanceTo(connected) > .03);
    h.frames(5.1); text.length = 0; interiors.update(7500, h.neo.position, h.life());
    assert.ok(text.includes('NETWORK: DISCONNECTED')); assert.ok(text.some(line => line.includes('LOCAL LOG / 101')));
    text.length = 0; interiors.update(7500, h.neo.position, structuredClone(h.life())); assert.equal(text.length, 0);
    h.life().chapter = 1; h.life().contactSignal = true; h.near(); h.command('film:continue');
    text.length = 0; interiors.update(7500, h.neo.position, h.life()); assert.ok(text.some(line => line.includes('MORPHEUS')));
  } finally { interiors.dispose(); globalThis.document = original; }
});

test('the actual workbench and cable approaches remain clear along the daily room route', () => {
  for (const [a, b] of [[[0, 0], [-6.9, 0]], [[-6.9, 0], [network.x, network.z]], [[network.x, -5.8], [APARTMENT_NETWORK.screenApproach.x, -5.8]], [[APARTMENT_NETWORK.screenApproach.x, -5.8], [APARTMENT_NETWORK.screenApproach.x, APARTMENT_NETWORK.screenApproach.z]]])
    for (let i = 0; i <= 100; i++) assert.equal(playerBlocked(filmPosition('film_anderson_flat', a[0] + (b[0] - a[0]) * i / 100, a[1] + (b[1] - a[1]) * i / 100), true), false);
});

test('the cable follows the authoritative hand clock even when the life journal arrives later', t => {
  const original = globalThis.document;
  globalThis.document = { createElement: () => ({ width: 0, height: 0, getContext: () => ({ fillRect() {}, fillText() {} }) }) } as unknown as Document;
  t.mock.method(THREE.TextureLoader.prototype, 'load', () => new THREE.Texture());
  const root = new THREE.Group(), interiors = new LifeInteriors(root), h = setup();
  try {
    h.near(); h.command('anomaly:test'); h.near(network); h.command('computer:disconnect'); h.frames(.5);
    const journal = structuredClone(h.life()); h.frames(.5);
    const check = h.neo.currentAction!.parameters.computerCheck as NonNullable<typeof journal.computerCheck>;
    interiors.update(7500, h.neo.position, journal, undefined, undefined, check);
    const plug = root.getObjectByName('apartment-network-plug')!;
    assert.ok(Math.abs(plug.position.z - APARTMENT_NETWORK.plug.z - .31) < .001, 'the plug must be detached at the current hand pose, not the stale journal pose');
    assert.equal(journal.computerCheck!.elapsed, .5, 'rendering must not rewrite the saved journal');
  } finally { interiors.dispose(); globalThis.document = original; }
});

test('the daily journal offers the physical check and retains other anomalies after a saved offline frame', async () => {
  const output = await build({ entryPoints: ['packages/client/src/player/NeoLifePanel.ts'], bundle: true,
    platform: 'node', format: 'esm', write: false, loader: { '.css': 'empty' }, logLevel: 'silent' });
  const { renderNeoLife } = await import(`data:text/javascript;base64,${Buffer.from(output.outputFiles[0].contents).toString('base64')}`);
  const h = setup(); h.near();
  assert.match(renderNeoLife(h.neo, h.sandbox.state, 7500), /查看显示器里的陌生文字/);
  h.life().computerCheck = { phase: 'saved', elapsed: 0 }; h.life().anomaly = { id: 'clock', location: 'neo_apartment', position: { ...h.neo.position } };
  const html = renderNeoLife(h.neo, h.sandbox.state, 7500);
  assert.match(html, /data-target="anomaly:test"/); assert.match(html, /花 25 分钟核对/);
  assert.doesNotMatch(html, /data-target="computer:reconnect"/);
});

for (const firstPerson of [false, true]) test(`the controlled Neo keeps the actual cable pose through input and pause in ${firstPerson ? 'first' : 'third'} person`, t => {
  class InputTarget extends EventTarget { matches() { return false; } }
  const window = new InputTarget(), canvas = new InputTarget();
  const document = Object.assign(new InputTarget(), { pointerLockElement: canvas, hidden: false, exitPointerLock() {} });
  const previous = ['window', 'document'].map(key => Object.getOwnPropertyDescriptor(globalThis, key));
  Object.assign(globalThis, { window, document });
  const h = setup(); h.near(); h.command('anomaly:test'); h.near(network); h.command('computer:disconnect'); h.frames(.7);
  const group = new THREE.Group(), body = new THREE.Group(); group.add(body);
  const camera = new THREE.PerspectiveCamera(57, 16 / 9, .5, 5000);
  const controls = new PlayerControls(canvas as unknown as HTMLCanvasElement, camera, () => {}, () => {});
  t.after(() => { controls.dispose(); ['window', 'document'].forEach((key, i) => {
    if (previous[i]) Object.defineProperty(globalThis, key, previous[i]!); else Reflect.deleteProperty(globalThis, key);
  }); });
  const event = (code: string) => window.dispatchEvent(Object.assign(new Event('keydown', { cancelable: true }), { code, repeat: false }));
  const state = structuredClone(h.neo); controls.possess(state);
  if (firstPerson) event('KeyV');
  for (const code of ['KeyW', 'KeyA', 'Space', 'KeyF']) event(code);
  for (let i = 0; i < 20; i++) controls.update(.05, state, group, true);
  assert.deepEqual(controls.motion.computerCheck, state.currentAction!.parameters.computerCheck, 'the player uses its local motion input, not the NPC renderer branch');
  assert.deepEqual(group.position.toArray(), [state.position.x, state.position.y, state.position.z]);
  assert.equal(body.rotation.y, state.rotation); assert.equal(controls.motion.speed, 0);
  if (firstPerson) {
    const plug = new THREE.Vector3(APARTMENT_ROOM.center.x + APARTMENT_NETWORK.plug.x, APARTMENT_NETWORK.plug.y, APARTMENT_ROOM.center.z + APARTMENT_NETWORK.plug.z).project(camera);
    assert.ok(Math.abs(plug.x) < .6 && Math.abs(plug.y) < .6, `the cable must fit the player's initial interaction view: ${plug.toArray()}`);
  }
  controls.update(.05, structuredClone(state), group, false);
  assert.deepEqual(group.position.toArray(), [state.position.x, state.position.y, state.position.z]);
  assert.deepEqual(controls.motion.computerCheck, state.currentAction!.parameters.computerCheck);
  for (const code of ['KeyW', 'KeyA', 'Space', 'KeyF']) window.dispatchEvent(Object.assign(new Event('keyup'), { code }));
  const finished = structuredClone(state); finished.currentAction = null;
  controls.update(.05, finished, group, true);
  assert.equal(controls.motion.computerCheck, undefined); assert.equal(controls.performing, false);
  if (firstPerson) assert.ok(camera.getWorldDirection(new THREE.Vector3()).y > -.55, 'ending the cable gesture restores the ordinary view instead of leaving Neo looking at the floor');
  event('KeyS'); for (let i = 0; i < 5; i++) controls.update(.05, finished, group, true);
  assert.ok(group.position.distanceTo(new THREE.Vector3(state.position.x, state.position.y, state.position.z)) > .1, 'normal movement resumes after the cable gesture');
  assert.equal(controls.firstPerson, firstPerson);
});

test('switching to first person at the investigation point frames the actual CRT instead of the empty left wall', t => {
  class InputTarget extends EventTarget { matches() { return false; } }
  const window = new InputTarget(), canvas = new InputTarget(), document = Object.assign(new InputTarget(), { pointerLockElement: canvas, hidden: false, exitPointerLock() {} });
  const previous = ['window', 'document'].map(key => Object.getOwnPropertyDescriptor(globalThis, key)); Object.assign(globalThis, { window, document });
  const h = setup(); h.near(); h.neo.currentLocation = 'neo_apartment'; const group = new THREE.Group(); group.add(new THREE.Group());
  const camera = new THREE.PerspectiveCamera(57, 16 / 9, .5, 5000), controls = new PlayerControls(canvas as unknown as HTMLCanvasElement, camera, () => {}, () => {});
  t.after(() => { controls.dispose(); ['window', 'document'].forEach((key, i) => {
    if (previous[i]) Object.defineProperty(globalThis, key, previous[i]!); else Reflect.deleteProperty(globalThis, key);
  }); });
  controls.possess(h.neo); window.dispatchEvent(Object.assign(new Event('keydown', { cancelable: true }), { code: 'KeyV', repeat: false }));
  controls.update(.05, h.neo, group, false);
  camera.updateMatrixWorld(true);
  const screen = new THREE.Vector3(APARTMENT_ROOM.center.x - 9, 3.33, APARTMENT_ROOM.center.z - 11.595).project(camera);
  assert.ok(Math.abs(screen.x) < .15 && Math.abs(screen.y) < .15, `the readable CRT is off-centre at ${screen.toArray()}`);
});

test('Neo can see his own cable hand in first person and the ordinary hidden body returns after the gesture', t => {
  const original = globalThis.document;
  globalThis.document = { createElement: () => ({ width: 0, height: 0, getContext: () => ({
    fillRect() {}, fillText() {}, strokeRect() {}, putImageData() {}, createImageData: (w: number, h: number) => ({ data: new Uint8ClampedArray(w * h * 4) }),
    createRadialGradient: () => ({ addColorStop() {} }),
  }) }) } as unknown as Document;
  t.mock.method(THREE.TextureLoader.prototype, 'load', () => new THREE.Texture());
  t.mock.method(CharacterModels.prototype, 'create', () => ({ root: new THREE.Group() }) as CharacterRig);
  t.mock.method(CharacterModels.prototype, 'animate', () => {});
  const renderer = new AgentRenderer(new THREE.Scene()), h = setup();
  try {
    h.near(); h.command('anomaly:test'); h.near(network); h.command('computer:disconnect'); h.frames(.8);
    renderer.updateAgent('neo', h.neo); renderer.setPlayer('neo', true);
    const motion = { speed: 0, grounded: true, verticalVelocity: 0, turn: 0, computerCheck: h.life().computerCheck };
    renderer.setPlayerMotion(motion); renderer.update(0, undefined, 0);
    assert.equal(renderer.getAgentBody('neo')!.visible, true, 'the active hand performance must be rendered in the player view');
    renderer.setPlayerMotion({ ...motion, computerCheck: undefined }); renderer.update(0, undefined, 0);
    assert.equal(renderer.getAgentBody('neo')!.visible, false);
  } finally { renderer.dispose(); globalThis.document = original; }
});
