import assert from 'node:assert/strict';
import test from 'node:test';
import { EXILES, FILM_SCENE_BY_ID, filmPosition, filmStepPosition, playerBlocked, type WorldEvent } from '@auto_matrix/shared';
import { WorldState } from '../packages/server/src/world/WorldState.js';
import { AgentManager } from '../packages/server/src/agents/AgentManager.js';
import { SandboxSystem } from '../packages/server/src/player/SandboxSystem.js';
import { PlayerController } from '../packages/server/src/player/PlayerController.js';
import type { ConversationEngine } from '../packages/server/src/agents/ConversationEngine.js';
import type { ActionExecutor } from '../packages/server/src/agents/ActionExecutor.js';
import type { WorldDynamics } from '../packages/server/src/story/WorldDynamics.js';

function setup() {
  const world = new WorldState(); new AgentManager(world).initializeAllAgents();
  const dynamics = { record: (_event: Omit<WorldEvent, 'id'>) => undefined } as WorldDynamics;
  const sandbox = new SandboxSystem(world, dynamics, 42);
  const conversations = { interrupt() {}, isAgentInConversation: () => false } as unknown as ConversationEngine;
  const actions = { execute() {} } as unknown as ActionExecutor;
  const players = new PlayerController(world, conversations, actions, dynamics, sandbox);
  players.possess('player', 'neo', 0); sandbox.life.begin(world.agents.get('neo')!, 0);
  sandbox.state.neoLife!.chapter = 1;
  let tick = 0;
  const command = (target: string) => players.sandboxAction('player', { kind: 'life', target: `film:${target}` }, ++tick);
  command('continue');
  const neo = world.agents.get('neo')!; const journey = sandbox.life.film.state!;
  const ticks = (count = 1) => { for (let i = 0; i < count; i++) sandbox.tick(++tick); };
  const frames = (count: number) => { for (let i = 0; i < count; i++) players.step(.1, true, ++tick); };
  const at = (sceneId: string, step: number) => { const scene = FILM_SCENE_BY_ID[sceneId]; neo.position = filmStepPosition(scene, scene.steps[step]); neo.currentLocation = scene.set; };
  return { world, sandbox, players, neo, journey, command, ticks, frames, at };
}

test('Le Vrai response can win an autonomous alliance, and its washroom is reached without a scene teleport', () => {
  const h = setup(); const merovingian = FILM_SCENE_BY_ID.m2_merovingian;
  Object.assign(h.journey, { scene: 'm2_burly', step: FILM_SCENE_BY_ID.m2_burly.steps.length, actor: 'neo' });
  h.command('next'); assert.equal(h.journey.scene, merovingian.id);
  h.at(merovingian.id, 0); h.ticks();
  h.at(merovingian.id, 1); h.command('act'); h.ticks(7);
  h.at(merovingian.id, 2); h.command('reflect:care');
  h.at(merovingian.id, 3); h.command('act'); h.ticks(7);
  h.at(merovingian.id, 4); h.ticks();
  const position = { ...h.neo.position }; h.command('next');
  assert.equal(h.journey.scene, 'm2_persephone'); assert.deepEqual(h.neo.position, position);
  h.at('m2_persephone', 0); h.ticks();
  h.at('m2_persephone', 1); h.command('act'); h.ticks(7);
  assert.equal(h.journey.step, 2);
  assert.match(h.command('persephone:appeal'), /自己|选择/);
  h.frames(30);
  assert.equal(h.journey.step, 3); assert.equal(h.sandbox.state.neoLife!.choices.persephone_route, 'appeal');
  assert.equal(h.journey.persephone?.phase, 'agreed');
});

test('Persephone rejects an unearned appeal and a perfunctory first response; the second action resumes after loading', () => {
  const h = setup(); Object.assign(h.journey, { scene: 'm2_persephone', step: 2, actor: 'neo', persephone: { phase: 'offered', elapsed: 0, attempts: 0 } });
  h.at('m2_persephone', 2);
  assert.match(h.command('persephone:appeal'), /不接受/); assert.equal(h.journey.step, 2);
  h.command('persephone:memory'); h.frames(29);
  assert.equal(h.journey.persephone?.phase, 'reconsider'); assert.equal(h.journey.step, 2);
  h.command('persephone:memory'); h.frames(11);
  const before = h.journey.persephone!.elapsed; const saved = JSON.parse(JSON.stringify(h.sandbox.state)); h.sandbox.restore(saved);
  assert.ok(h.sandbox.life.film.state!.persephone!.elapsed >= before);
  h.frames(19);
  assert.equal(h.sandbox.life.film.state!.step, 3);
  assert.equal(h.sandbox.state.neoLife!.choices.persephone_route, 'memory');
});

test('the bookcase is solid until revealed; abandoning the Keymaker fails and a saved escort can finish', () => {
  const h = setup(); const scene = FILM_SCENE_BY_ID.m2_library;
  Object.assign(h.journey, { scene: 'm2_persephone', step: FILM_SCENE_BY_ID.m2_persephone.steps.length, actor: 'neo' });
  h.command('next'); assert.equal(h.journey.scene, scene.id);
  const door = filmPosition(scene.set, EXILES.bookshelf.x, EXILES.bookshelf.z);
  assert.equal(playerBlocked(door, true, 1.1, h.sandbox.state.structures), true);
  h.at(scene.id, 0); h.ticks();
  h.at(scene.id, 1); h.command('act'); h.ticks(7);
  h.at(scene.id, 2); h.command('act'); h.ticks(7);
  assert.equal(playerBlocked(door, true, 1.1, h.sandbox.state.structures), false);
  h.at(scene.id, 3); h.command('act'); h.ticks(7);
  assert.equal(h.journey.keymaker?.phase, 'following');
  h.at(scene.id, 4); h.frames(75);
  assert.equal(h.journey.step, 3); assert.equal(h.journey.keymaker?.setbacks, 1);
  h.command('retry'); h.at(scene.id, 3); h.command('act'); h.ticks(7);
  for (const [x, z] of [[-8, -17], [-8, -10], [-5, -3], [0, 4]]) {
    h.neo.position = filmPosition(scene.set, x, z);
    for (let frame = 0; frame < 28; frame++) {
      h.frames(1);
      assert.equal(playerBlocked(h.world.agents.get('keymaker')!.position, true, .8, h.sandbox.state.structures), false, 'Keymaker must pass through the opened bookcase');
    }
  }
  const saved = JSON.parse(JSON.stringify(h.sandbox.state)); const before = { ...h.journey.keymaker! };
  h.sandbox.restore(saved);
  assert.equal(h.sandbox.life.film.state!.keymaker!.z, before.z);
  assert.equal(h.world.agents.get('keymaker')!.position.z, filmPosition(scene.set, before.x, before.z).z);
  for (const z of [11, 18, 23]) { h.neo.position = filmPosition(scene.set, 0, z); h.frames(28); }
  h.ticks();
  assert.equal(h.sandbox.life.film.state!.keymaker?.phase, 'escaped');
  assert.equal(h.sandbox.state.neoLife!.choices.keymaker_rescued, 'yes');
  assert.equal(h.sandbox.life.film.state!.step, scene.steps.length);
});
