import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from 'three';
import { BANE_LOFT_OBSTACLES, FILM_SCENES, FILM_SCENE_BY_ID, ZION_CAST, ZION_MESSAGE, filmEntry, filmPosition, filmStepPosition, playerBlocked, playerSkills, type WorldEvent } from '@auto_matrix/shared';
import { BaneCopyRenderer } from '../packages/client/src/engine/BaneCopyRenderer.js';
import { ZionHomecomingRenderer } from '../packages/client/src/engine/ZionHomecomingRenderer.js';
import { WorldState } from '../packages/server/src/world/WorldState.js';
import { AgentManager } from '../packages/server/src/agents/AgentManager.js';
import { SandboxSystem } from '../packages/server/src/player/SandboxSystem.js';
import { PlayerController } from '../packages/server/src/player/PlayerController.js';
import type { ConversationEngine } from '../packages/server/src/agents/ConversationEngine.js';
import type { ActionExecutor } from '../packages/server/src/agents/ActionExecutor.js';
import type { WorldDynamics } from '../packages/server/src/story/WorldDynamics.js';

function game() {
  const world = new WorldState(); new AgentManager(world).initializeAllAgents();
  const dynamics = { record: (event: Omit<WorldEvent, 'id'>) => world.addWorldEvent(event) } as WorldDynamics;
  const sandbox = new SandboxSystem(world, dynamics, 82);
  const conversations = { interrupt() {}, isAgentInConversation: () => false } as unknown as ConversationEngine;
  const actions = { execute() {} } as unknown as ActionExecutor;
  const players = new PlayerController(world, conversations, actions, dynamics, sandbox);
  players.possess('p', 'neo', 0); sandbox.life.begin(world.agents.get('neo')!, 0); sandbox.state.neoLife!.chapter = 1;
  players.sandboxAction('p', { kind: 'life', target: 'film:start' }, 1);
  let tick = 1;
  const command = (target: string) => players.sandboxAction('p', { kind: 'life', target: `film:${target}` }, ++tick);
  const advance = (count: number) => { for (let i = 0; i < count; i++) sandbox.tick(++tick); };
  return { world, sandbox, players, command, advance, tick: () => tick, actor: () => players.getAgent('p')!, state: () => sandbox.life.film.state! };
}

function messageFrames(h: ReturnType<typeof game>, step: number) {
  for (let frame = 0; frame < 200 && h.state().step === step; frame++) {
    h.players.step(.1, true, h.tick()); if (frame % 5 === 4) h.advance(1);
  }
}

function escortMalachi(h: ReturnType<typeof game>) {
  const scene = FILM_SCENE_BY_ID.m2_bane_copy, malachi = h.world.agents.get('malachi')!;
  for (let tick = 0; tick < 100 && malachi.position.z > filmPosition(scene.set, -5, -28).z + .01; tick++) {
    h.actor().position = { ...malachi.position, x: malachi.position.x + 5, z: malachi.position.z - 2 }; h.advance(1);
  }
  assert.deepEqual(malachi.position, filmPosition(scene.set, -5, -28));
  h.actor().position = filmStepPosition(scene, scene.steps[0]); h.advance(1); assert.equal(h.state().step, 1);
}

test('Reloaded homecoming preserves the filmed room, infection, engineering and Oracle-message order', () => {
  const order = ['m2_temple', 'm2_room', 'm2_bane_copy', 'm2_hamann', 'm2_oracle_message', 'm2_departure'];
  const indexes = order.map(id => FILM_SCENES.findIndex(scene => scene.id === id));
  assert.ok(indexes.every(index => index >= 0), 'every beat exists');
  assert.ok(indexes.every((index, i) => i === 0 || index > indexes[i - 1]), 'film order');
  assert.equal(FILM_SCENE_BY_ID.m2_bane_copy.set, 'film_industrial_loft');
  assert.equal(FILM_SCENE_BY_ID.m2_oracle_message.set, 'film_zion_bedroom');
  assert.deepEqual(filmEntry(FILM_SCENE_BY_ID.m2_oracle_message), filmPosition('film_zion_bedroom', 0, 0));
  assert.ok(FILM_SCENE_BY_ID.m2_departure.cast.includes('bane'));
});

test('Bane passes the disk out first; infection survives reload but stays outside Neo knowledge', () => {
  const h = game(), scene = FILM_SCENE_BY_ID.m2_bane_copy, state = h.state();
  assert.equal(h.world.agents.get('bane')!.faction, 'zion');
  assert.deepEqual(playerSkills(h.world.agents.get('bane')!), ['escape', 'dodge']);
  h.world.agents.get('bane')!.faction = 'machines'; // A save from before the infection beat existed.
  h.players.possess('p', 'neo', 2);
  state.scene = 'm2_room'; state.actor = 'neo'; state.step = FILM_SCENE_BY_ID.m2_room.steps.length;
  h.command('next'); assert.equal(state.scene, 'm2_bane_copy'); assert.equal(h.actor().id, 'bane');
  assert.equal(h.actor().faction, 'zion');
  assert.deepEqual(h.world.agents.get('smith')!.position, filmPosition(scene.set, 33, -38));
  escortMalachi(h);
  for (const [step, ticks] of [[1, 7], [2, 11], [3, 7]] as const) {
    h.actor().position = filmStepPosition(scene, scene.steps[step]);
    if (step > 0) h.command('act');
    h.advance(ticks);
    assert.equal(state.step, step + 1);
  }
  const choices = h.sandbox.state.neoLife!.choices;
  assert.equal(choices.oracle_disk_carrier, 'malachi');
  assert.equal(choices.bane_infected, 'smith'); assert.equal(choices.bane_returned, undefined);
  assert.equal(h.actor().isInMatrix, true);
  assert.equal(h.world.agents.get('bane')!.faction, 'machines');
  assert.deepEqual(playerSkills(h.world.agents.get('bane')!), ['viral_overwrite', 'crushing_palm']);
  assert.ok(h.sandbox.state.neoLife!.journal.some(item => item.title.startsWith('旁观片段') && item.text.includes('不是 Neo')));
  const saved = structuredClone(h.sandbox.state);
  h.world.agents.get('bane')!.faction = 'zion'; h.sandbox.restore(saved);
  assert.equal(h.sandbox.state.neoLife!.choices.bane_infected, 'smith');
  assert.equal(h.world.agents.get('bane')!.faction, 'machines');
  h.command('next'); assert.equal(h.state().scene, 'm2_hamann'); assert.equal(h.actor().id, 'neo');
  assert.equal(h.sandbox.state.neoLife!.choices.bane_returned, 'yes');
  assert.equal(h.world.agents.get('bane')!.isInMatrix, false);
});

test('leaving the Smith copy clears only the interrupted effect and permits a clean retry', () => {
  const h = game(), scene = FILM_SCENE_BY_ID.m2_bane_copy, state = h.state();
  h.players.possess('p', 'neo', 2);
  state.scene = 'm2_room'; state.actor = 'neo'; state.step = FILM_SCENE_BY_ID.m2_room.steps.length;
  h.command('next'); assert.equal(h.state().scene, scene.id);
  const bane = h.actor();
  escortMalachi(h);
  bane.position = filmStepPosition(scene, scene.steps[1]); h.command('act'); h.advance(7);
  bane.position = filmStepPosition(scene, scene.steps[2]); h.command('act'); h.advance(3);
  const started = h.state().started;
  assert.equal(h.state().baneCopy?.progress, .3);
  h.sandbox.restore(h.sandbox.state);
  assert.equal(h.state().started, started, 'cold restoration keeps the active timer');
  assert.equal(h.state().baneCopy?.progress, .3);

  bane.position = filmPosition(scene.set, 0, -16); h.advance(1);
  assert.match(h.state().lastText, /已离开互动位置/);
  assert.equal(h.state().step, 2);
  assert.equal(h.state().started, undefined);
  assert.equal(h.state().baneCopy?.progress, 0, 'the overlay should vanish when the timer is cancelled');
  assert.equal(bane.faction, 'zion');
  assert.equal(h.sandbox.state.neoLife!.choices.oracle_disk_carrier, 'malachi');
  assert.equal(h.sandbox.state.neoLife!.choices.bane_infected, undefined);

  const legacy = structuredClone(h.sandbox.state);
  legacy.neoLife!.journey!.baneCopy!.progress = .4;
  h.sandbox.restore(legacy);
  assert.equal(h.state().baneCopy?.progress, 0, 'older cancelled saves may contain a stale overlay');
  bane.position = filmStepPosition(scene, scene.steps[2]); h.command('act'); h.advance(1);
  assert.equal(h.state().baneCopy?.progress, .1);
  h.advance(9);
  assert.equal(h.state().step, 3);
  assert.equal(h.state().baneCopy?.progress, 1);
  assert.equal(bane.faction, 'machines');
});

test('Ballard delivers the Oracle disk before Zee, Bane, Kid and the takeoff clearance', () => {
  const h = game(), state = h.state();
  h.players.possess('p', 'neo', 2);
  state.scene = 'm2_hamann'; state.actor = 'neo'; state.step = FILM_SCENE_BY_ID.m2_hamann.steps.length;
  h.command('next'); assert.equal(state.scene, 'm2_oracle_message');
  assert.equal(h.actor().rotation, 0);
  assert.deepEqual(h.world.agents.get('ballard')!.position, filmPosition('film_zion_bedroom', ZION_CAST.m2_oracle_message.ballard.x, ZION_CAST.m2_oracle_message.ballard.z));
  const door = filmPosition('film_zion_bedroom', 0, 17.6);
  assert.equal(playerBlocked(door, false, .5, h.sandbox.state.structures), true, 'the closed door blocks Neo');
  for (const step of [0, 1] as const) {
    h.actor().position = filmStepPosition(FILM_SCENE_BY_ID.m2_oracle_message, FILM_SCENE_BY_ID.m2_oracle_message.steps[step]);
    h.command('act'); messageFrames(h, step); assert.equal(state.step, step + 1);
    if (step === 0) {
      const point = ZION_MESSAGE.ballardRoute.at(-1)!;
      assert.deepEqual(h.world.agents.get('ballard')!.position, filmPosition('film_zion_bedroom', point.x, point.z));
      assert.equal(playerBlocked(door, false, .5, h.sandbox.state.structures), false, 'the opened door releases the threshold');
    }
  }
  assert.equal(h.sandbox.state.neoLife!.choices.oracle_disk_received, 'yes');
  h.command('next'); assert.equal(state.scene, 'm2_departure');
  assert.deepEqual(h.world.agents.get('bane')!.position, filmPosition('film_zion_hangar', ZION_CAST.m2_departure.bane.x, ZION_CAST.m2_departure.bane.z));
  for (const [step, ticks] of [[0, 9], [1, 7], [2, 7], [3, 5]] as const) {
    h.actor().position = filmStepPosition(FILM_SCENE_BY_ID.m2_departure, FILM_SCENE_BY_ID.m2_departure.steps[step]);
    h.command('act'); h.advance(ticks); assert.equal(state.step, step + 1);
  }
  const choices = h.sandbox.state.neoLife!.choices;
  assert.equal(choices.zee_charm_given, 'link'); assert.equal(choices.kid_spoon, 'received');
  assert.equal(choices.bane_departure_encounter, 'unexplained'); assert.equal(choices.zion_clearance, 'hamann');
  const saved = structuredClone(h.sandbox.state); h.sandbox.restore(saved);
  assert.equal(h.sandbox.state.neoLife!.choices.oracle_disk_received, 'yes');
  assert.equal(playerBlocked(door, false, .5, h.sandbox.state.structures), false, 'reload keeps the opened door passable');
});

test('the exit loft has a reachable phone, physical table and a disposable copy effect', () => {
  const scene = FILM_SCENE_BY_ID.m2_bane_copy;
  for (const step of scene.steps) assert.equal(playerBlocked(filmStepPosition(scene, step), true), false, step.label);
  assert.equal(playerBlocked(filmPosition(scene.set, BANE_LOFT_OBSTACLES[0].x, BANE_LOFT_OBSTACLES[0].z), true), true);
  const root = new THREE.Group(); const renderer = new BaneCopyRenderer(root);
  assert.ok(renderer.group.getObjectByName('bane-exit-phone'));
  assert.ok(renderer.group.getObjectByName('smith-copy-wave'));
  renderer.update({ scene: scene.id, step: 2, baneCopy: { progress: .6 } } as never, 2, filmPosition(scene.set, 1, -25), filmPosition(scene.set));
  assert.equal(renderer.group.getObjectByName('smith-copy-wave')?.visible, true);
  assert.equal(renderer.group.getObjectByName('smith-copy-wave')?.position.x, 1);
  assert.equal(renderer.group.getObjectByName('smith-copy-wave')?.position.z, -25);
  let meshes = 0; renderer.group.traverse(object => { if (object instanceof THREE.Mesh) meshes++; });
  assert.ok(meshes < 50, `the streamed loft should not cost ${meshes} draw calls`);
  const disposed: string[] = []; renderer.group.traverse(object => { if (object instanceof THREE.Mesh) object.geometry.addEventListener('dispose', () => disposed.push(object.uuid)); });
  renderer.dispose(); assert.equal(root.children.length, 0); assert.ok(disposed.length > 0);
});

test('the low Zion bedroom leaves the actual third-person camera clear at the message entry', () => {
  const root = new THREE.Group(), renderer = new ZionHomecomingRenderer(root, 'film_zion_bedroom');
  root.updateMatrixWorld(true);
  // The set root sits one unit below the actor: the follow camera is at local y = 4.2.
  const camera = new THREE.Vector3(-.8, 4.2, -11.5), lookAt = new THREE.Vector3(-.8, 3.05, 2);
  const ray = new THREE.Raycaster(camera, lookAt.clone().sub(camera).normalize(), 0, camera.distanceTo(lookAt));
  assert.deepEqual(ray.intersectObjects(renderer.group.children, true).map(hit => hit.object.name), []);
  renderer.dispose();
});

test('the bedroom has one walking surface under the disk handoff', t => {
  const root = new THREE.Group(), renderer = new ZionHomecomingRenderer(root, 'film_zion_bedroom');
  t.after(() => renderer.dispose());
  root.updateMatrixWorld(true);
  for (const x of [-5, 0, 5]) for (const z of [2, 6, 10, 14]) {
    const ray = new THREE.Raycaster(new THREE.Vector3(x, .07, z), new THREE.Vector3(0, -1, 0), 0, .1);
    const floor = ray.intersectObject(root, true).filter(hit => Math.abs(hit.point.y) < .015);
    assert.equal(new Set(floor.map(hit => hit.object.uuid)).size, 1, `${x}, ${z}`);
    const material = (floor[0].object as THREE.Mesh).material as THREE.MeshStandardMaterial;
    assert.equal(material.color.getHex(), 0x977b68);
  }
});

test('the closed bedroom door blocks its frame and both sides, then clears the center aisle', t => {
  const h = game(), state = h.state(), room = 'film_zion_bedroom';
  state.scene = 'm2_hamann'; state.step = FILM_SCENE_BY_ID.m2_hamann.steps.length;
  h.command('next'); assert.equal(state.scene, 'm2_oracle_message');
  const root = new THREE.Group(), renderer = new ZionHomecomingRenderer(root, room);
  t.after(() => renderer.dispose());
  const blocked = (x: number) => playerBlocked(filmPosition(room, x, 17.6), false, 1.1, h.sandbox.state.structures);
  const ray = (x: number) => {
    root.updateMatrixWorld(true);
    return new THREE.Raycaster(new THREE.Vector3(x, 2.5, 13), new THREE.Vector3(0, 0, 1), 0, 7).intersectObject(root, true);
  };
  renderer.update(state, 0);
  for (const x of [-12, -6.5, 0, 6.5, 12]) {
    assert.equal(blocked(x), true, `closed threshold at ${x}`);
    assert.ok(ray(x).length, `the collision at ${x} has visible stone or iron`);
  }
  h.actor().position = filmStepPosition(FILM_SCENE_BY_ID.m2_oracle_message, FILM_SCENE_BY_ID.m2_oracle_message.steps[0]); h.command('act'); messageFrames(h, 0);
  renderer.update(state, 0);
  assert.equal(state.step, 1);
  assert.equal(blocked(0), false); assert.equal(ray(0).length, 0);
  for (const x of [-6.5, 6.5]) assert.equal(blocked(x), true);
});

test('a legacy save beyond the locked bedroom wall resumes on the room side', () => {
  const h = game(), state = h.state(), room = 'film_zion_bedroom';
  state.scene = 'm2_hamann'; state.step = FILM_SCENE_BY_ID.m2_hamann.steps.length;
  h.command('next'); assert.equal(state.scene, 'm2_oracle_message');
  const neo = h.actor(); neo.position = filmPosition(room, 6.5, 19);
  h.players.release('p', 4);
  h.sandbox.restore(structuredClone(h.sandbox.state));
  assert.equal(h.state().step, 0);
  assert.ok(neo.position.z < filmPosition(room, 0, 16).z);
  assert.equal(playerBlocked(neo.position, false, 1.1, h.sandbox.state.structures), false);
  assert.equal(h.players.possess('p', 'neo', 5).agentId, 'neo');
  h.command('act'); messageFrames(h, 0); assert.equal(h.state().step, 1);
});

test('the departure hangar keeps the gangway and gifts without allocating hidden battle props', t => {
  const root = new THREE.Group(), renderer = new ZionHomecomingRenderer(root, 'film_zion_hangar', 'm2_departure');
  t.after(() => renderer.dispose());
  renderer.update({ scene: 'm2_departure', step: 0, completed: [] } as never, 0);
  for (const name of ['zion-docked-nebuchadnezzar', 'zion-boarding-bay-deck', 'zee-farewell-charm', 'kid-spoon-gift'])
    assert.ok(root.getObjectByName(name), name);
  for (const name of ['zion-apu-loader', 'zion-ammo-cart', 'zion-gate-sentinel-1'])
    assert.ok(!root.getObjectByName(name), name);
});

test('departure completes inside the ship bay after crossing the gangway', () => {
  const h = game(), scene = FILM_SCENE_BY_ID.m2_departure, state = h.state();
  h.players.possess('p', 'neo', 2);
  state.scene = 'm2_oracle_message'; state.actor = 'neo'; state.step = FILM_SCENE_BY_ID.m2_oracle_message.steps.length;
  h.command('next'); assert.equal(state.scene, scene.id);
  state.step = 4;
  h.actor().position = filmPosition(scene.set, 11, 17); h.advance(1);
  assert.equal(state.step, 4, 'the former marker is still on the dock side of the boarding bay');
  const structures = h.sandbox.state.structures;
  assert.equal(playerBlocked(filmPosition(scene.set, 12, 8), false, 1.1, structures), true, 'the rail beside the opening remains solid');
  for (let x = 9; x <= 20; x += .5) {
    h.actor().position = filmPosition(scene.set, x, 17); h.advance(1);
    assert.equal(playerBlocked(h.actor().position, false, 1.1, structures), false, `clear gangway at ${x}`);
    if (x < 19) assert.equal(state.step, 4, `boarding cannot finish early at ${x}`);
  }
  assert.equal(state.step, 5);
  assert.equal(playerBlocked(filmPosition(scene.set, 20, 20), false, 1.1, structures), true, 'the bay wall is solid');
  const oldSave = structuredClone(h.sandbox.state);
  oldSave.structures = oldSave.structures.filter(s => !s.id.startsWith('film:zion:boarding:'));
  h.actor().position = filmPosition(scene.set, 11, 17);
  h.sandbox.restore(oldSave);
  assert.equal(h.state().step, 5);
  assert.equal(playerBlocked(filmPosition(scene.set, 12, 8), false, 1.1, h.sandbox.state.structures), true);
  h.command('next'); assert.equal(h.state().scene, 'm2_seraph');
  assert.equal(h.sandbox.state.structures.some(s => s.id.startsWith('film:zion:boarding:')), false);
});

test('the departure gangway has head clearance through the rail and a supported floor inside the hull', () => {
  const root = new THREE.Group(), renderer = new ZionHomecomingRenderer(root, 'film_zion_hangar');
  try {
    renderer.update({ scene: 'm2_departure', step: 4, completed: [] } as never, 3);
    root.updateMatrixWorld(true);
    const visible = (ray: THREE.Raycaster) => ray.intersectObject(root, true).filter(hit => {
      for (let object: THREE.Object3D | null = hit.object; object; object = object.parent) if (!object.visible) return false;
      return true;
    });
    for (const y of [1, 2, 3.9]) {
      assert.deepEqual(visible(new THREE.Raycaster(new THREE.Vector3(9, y, 17), new THREE.Vector3(1, 0, 0), 0, 11)).map(hit => hit.object.name), []);
    }
    const floor = visible(new THREE.Raycaster(new THREE.Vector3(20, .4, 17), new THREE.Vector3(0, -1, 0), 0, .41));
    assert.ok(floor.some(hit => hit.object.name === 'zion-boarding-bay-deck' && Math.abs(hit.point.y) < .04));
    const ship = root.getObjectByName('zion-docked-nebuchadnezzar')!;
    assert.ok(ship.getObjectByName('zion-boarding-bay-deck'), 'the bay belongs to the actual ship');
  } finally { renderer.dispose(); }
});
