import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from 'three';
import { BANE_LOFT_OBSTACLES, FILM_SCENES, FILM_SCENE_BY_ID, ZION_CAST, filmEntry, filmPosition, filmStepPosition, playerBlocked, playerSkills, type WorldEvent } from '@auto_matrix/shared';
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
  return { world, sandbox, players, command, advance, actor: () => players.getAgent('p')!, state: () => sandbox.life.film.state! };
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
  for (const [step, ticks] of [[0, 1], [1, 7], [2, 11], [3, 7]] as const) {
    h.actor().position = filmStepPosition(scene, scene.steps[step]);
    if (step > 0) h.command('act');
    h.advance(ticks);
    assert.equal(state.step, step + 1);
  }
  const choices = h.sandbox.state.neoLife!.choices;
  assert.equal(choices.oracle_disk_carrier, 'malachi');
  assert.equal(choices.bane_infected, 'smith'); assert.equal(choices.bane_returned, 'yes');
  assert.equal(h.world.agents.get('bane')!.faction, 'machines');
  assert.deepEqual(playerSkills(h.world.agents.get('bane')!), ['viral_overwrite', 'crushing_palm']);
  assert.ok(h.sandbox.state.neoLife!.journal.some(item => item.title.startsWith('旁观片段') && item.text.includes('不是 Neo')));
  const saved = structuredClone(h.sandbox.state);
  h.world.agents.get('bane')!.faction = 'zion'; h.sandbox.restore(saved);
  assert.equal(h.sandbox.state.neoLife!.choices.bane_infected, 'smith');
  assert.equal(h.world.agents.get('bane')!.faction, 'machines');
  h.command('next'); assert.equal(h.state().scene, 'm2_hamann'); assert.equal(h.actor().id, 'neo');
});

test('Ballard delivers the Oracle disk before Zee, Bane, Kid and the takeoff clearance', () => {
  const h = game(), state = h.state();
  h.players.possess('p', 'neo', 2);
  state.scene = 'm2_hamann'; state.actor = 'neo'; state.step = FILM_SCENE_BY_ID.m2_hamann.steps.length;
  h.command('next'); assert.equal(state.scene, 'm2_oracle_message');
  assert.equal(h.actor().rotation, 0);
  assert.deepEqual(h.world.agents.get('ballard')!.position, filmPosition('film_zion_bedroom', 2, 19));
  const door = filmPosition('film_zion_bedroom', 0, 17.6);
  assert.equal(playerBlocked(door, false, .5, h.sandbox.state.structures), true, 'the closed door blocks Neo');
  for (const [step, ticks] of [[0, 5], [1, 7]] as const) {
    h.actor().position = filmStepPosition(FILM_SCENE_BY_ID.m2_oracle_message, FILM_SCENE_BY_ID.m2_oracle_message.steps[step]);
    h.command('act'); h.advance(ticks); assert.equal(state.step, step + 1);
    if (step === 0) {
      assert.deepEqual(h.world.agents.get('ballard')!.position, filmPosition('film_zion_bedroom', 2, 11));
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
