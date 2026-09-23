import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from 'three';
import { FILM_SCENE_BY_ID, FILM_SETS, ZION_CAST, ZION_HOMECOMING, ZION_OBSTACLES, filmEntry, filmPosition, filmStepPosition, playerBlocked, type AgentState, type WorldEvent } from '@auto_matrix/shared';
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
  const sandbox = new SandboxSystem(world, dynamics, 81);
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

test('homecoming routes, named cast and visible prop footprints agree with collision', () => {
  for (const id of ZION_HOMECOMING) {
    const scene = FILM_SCENE_BY_ID[id]; const set = FILM_SETS[scene.set];
    assert.equal(playerBlocked(filmEntry(scene), false), false, `${id} entry`);
    for (const step of scene.steps) assert.equal(playerBlocked(filmStepPosition(scene, step), false), false, `${id}: ${step.label}`);
    for (const [role, pose] of Object.entries(ZION_CAST[id])) {
      assert.ok(scene.cast.includes(role));
      assert.equal(playerBlocked(filmPosition(scene.set, pose.x, pose.z), false), false, `${role} staging`);
    }
    for (const prop of ZION_OBSTACLES[set.id]) assert.equal(playerBlocked(filmPosition(set.id, prop.x, prop.z), false), true, `${id} tangible prop`);
  }
});

test('dock and resident actions save concrete supplies and both requests through reload', () => {
  const h = game(); const state = h.state();
  assert.equal(h.players.possess('p', 'neo', 2).agentId, 'neo');
  state.scene = 'm2_meeting'; state.actor = 'neo'; state.step = FILM_SCENE_BY_ID.m2_meeting.steps.length;
  const transition = h.command('next'); assert.equal(state.scene, 'm2_dock', transition);
  const kid = h.world.agents.get('kid')!; const pose = ZION_CAST.m2_dock.kid;
  assert.deepEqual(kid.position, filmPosition('film_zion_hangar', pose.x, pose.z));
  state.step = 2; h.actor().position = filmStepPosition(FILM_SCENE_BY_ID.m2_dock, FILM_SCENE_BY_ID.m2_dock.steps[2]);
  h.command('act'); h.advance(11); assert.equal(state.step, 3);
  assert.equal(h.sandbox.state.neoLife!.choices.zion_ship_charged, 'yes');
  h.command('next'); h.state().step = FILM_SCENE_BY_ID.m2_lock.steps.length;
  h.command('next'); assert.equal(state.scene, 'm2_residents');
  for (const index of [1, 2, 3]) {
    state.step = index; h.actor().position = filmStepPosition(FILM_SCENE_BY_ID.m2_residents, FILM_SCENE_BY_ID.m2_residents.steps[index]);
    h.command('act'); h.advance(index === 3 ? 9 : 7);
  }
  assert.equal(h.sandbox.state.neoLife!.choices.zion_jacob_request, 'Gnosis');
  assert.equal(h.sandbox.state.neoLife!.choices.zion_icarus_request, 'Icarus');
  assert.equal(h.sandbox.state.neoLife!.choices.zion_residents_contacted, 'both');
  const saved = structuredClone(h.sandbox.state); h.sandbox.restore(saved);
  assert.equal(h.sandbox.state.neoLife!.choices.zion_residents_contacted, 'both');
});

test('Zion supplies reach Mifune at the later dock defense only once', () => {
  const h = game(); assert.equal(h.players.possess('p', 'niobe', 2).agentId, 'niobe');
  const state = h.state(); state.scene = 'm3_hammer_tunnels'; state.actor = 'niobe'; state.step = FILM_SCENE_BY_ID.m3_hammer_tunnels.steps.length;
  h.sandbox.state.neoLife!.choices.zion_ship_charged = 'yes'; h.sandbox.state.neoLife!.choices.zion_lock_reported = '72h';
  assert.match(h.command('next'), /船坞的弹药与钢铁/);
  assert.equal(state.scene, 'm3_dock_battle'); assert.equal(h.actor().id, 'mifune');
  assert.equal(h.sandbox.state.profiles.mifune.inventory.medkit, 4);
  assert.equal(h.sandbox.state.neoLife!.choices.zion_dock_supplies_used, '2');
  const saved = structuredClone(h.sandbox.state); h.sandbox.restore(saved);
  assert.equal(h.sandbox.state.profiles.mifune.inventory.medkit, 4);
});

test('all six authored Zion sets have their own geometry and release it after leaving', () => {
  const names: Record<string, string> = {
    film_zion_hangar: 'zion-docked-nebuchadnezzar', film_zion_council: 'zion-homecoming-set',
    film_zion_residences: 'zion-homecoming-set', film_zion_temple: 'zion-assembly-rostrum',
    film_zion_bedroom: 'zion-homecoming-set', film_zion_engineering: 'zion-recycler-flywheel',
  };
  for (const [set, name] of Object.entries(names)) {
    const root = new THREE.Group(); root.position.set(5000, -100, 5000);
    const renderer = new ZionHomecomingRenderer(root, set); renderer.update(undefined, 2.5);
    assert.ok(renderer.group.getObjectByName(name), `${set} missing signature feature`);
    const bounds = new THREE.Box3().setFromObject(root);
    assert.ok(bounds.min.x > 4900 && bounds.max.x < 5100, `${set} geometry escaped origin`);
    const disposed: string[] = []; renderer.group.traverse(object => { if (object instanceof THREE.Mesh) object.geometry.addEventListener('dispose', () => disposed.push(object.uuid)); });
    renderer.dispose(); assert.equal(root.children.length, 0); assert.ok(disposed.length > 0);
  }
});
