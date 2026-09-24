import assert from 'node:assert/strict';
import test from 'node:test';
import { FILM_SCENES, FILM_SCENE_BY_ID, filmEntry, filmStepPosition, type AgentState, type WorldEvent } from '@auto_matrix/shared';
import { WorldState } from '../packages/server/src/world/WorldState.js';
import { AgentManager } from '../packages/server/src/agents/AgentManager.js';
import { SandboxSystem } from '../packages/server/src/player/SandboxSystem.js';
import { PlayerController } from '../packages/server/src/player/PlayerController.js';
import type { ConversationEngine } from '../packages/server/src/agents/ConversationEngine.js';
import type { ActionExecutor } from '../packages/server/src/agents/ActionExecutor.js';
import type { WorldDynamics } from '../packages/server/src/story/WorldDynamics.js';

function setup() {
  const world = new WorldState(); new AgentManager(world).initializeAllAgents();
  const dynamics = { record: (event: Omit<WorldEvent, 'id'>) => world.addWorldEvent(event) } as WorldDynamics;
  const sandbox = new SandboxSystem(world, dynamics, 42);
  const conversations = { interrupt() {}, isAgentInConversation: () => false, startConversation: () => false } as unknown as ConversationEngine;
  const actions = { execute() {} } as unknown as ActionExecutor;
  const players = new PlayerController(world, conversations, actions, dynamics, sandbox);
  let tick = 0;
  players.possess('film-player', 'neo', tick); sandbox.life.begin(world.agents.get('neo')!, tick);
  sandbox.state.neoLife!.chapter = 1;
  const command = (target: string) => players.sandboxAction('film-player', { kind: 'life', target: `film:${target}` }, ++tick);
  const advance = (count = 1) => { for (let i = 0; i < count; i++) sandbox.tick(++tick); };
  command('continue');
  const state = sandbox.life.film.state!;
  const actor = () => players.getAgent('film-player')!;
  const at = (sceneId: string) => {
    const scene = FILM_SCENE_BY_ID[sceneId];
    players.possess('film-player', scene.actor, tick);
    Object.assign(state, { scene: scene.id, actor: scene.actor, step: 0, checkpoint: filmEntry(scene), lastText: scene.context });
    actor().currentLocation = scene.set; actor().isInMatrix = scene.set === 'film_oracle_home'; actor().position = filmEntry(scene);
    return scene;
  };
  const finish = (sceneId: string) => {
    const state = sandbox.life.film.state!;
    const scene = FILM_SCENE_BY_ID[sceneId];
    for (const step of scene.steps) {
      actor().position = filmStepPosition(scene, step);
      if (step.kind === 'reflect') command('reflect:agency');
      else if (step.kind === 'interact') { command('act'); advance(Math.max(6, Math.ceil(step.seconds ?? 3) + 2)); }
      else advance();
    }
    assert.ok(state.completed.includes(sceneId), `${sceneId} should complete: step ${state.step}/${scene.steps.length}, ${state.lastText}`);
  };
  return { world, sandbox, players, get state() { return sandbox.life.film.state!; }, actor, command, advance, at, finish, tick: () => tick };
}

test('Oracle farewell and assimilation precede Bane questioning and the two-ship decision', () => {
  const ids = FILM_SCENES.map(scene => scene.id);
  assert.ok(ids.indexOf('m3_oracle_last') < ids.indexOf('m3_oracle_absorbed'));
  assert.ok(ids.indexOf('m3_oracle_absorbed') < ids.indexOf('m3_bane_questions'));
  assert.ok(ids.indexOf('m3_bane_questions') < ids.indexOf('m3_logos_plan'));
  assert.ok(ids.indexOf('m3_logos_plan') < ids.indexOf('m3_maggie_discovery'));
  assert.ok(ids.indexOf('m3_maggie_discovery') < ids.indexOf('m3_bane'));
});

test('Neo receives a callback to his earlier Oracle meetings, but her assimilation is marked as another perspective', () => {
  const h = setup();
  h.sandbox.state.neoLife!.choices.oracle_first = 'rescue';
  h.sandbox.state.neoLife!.choices['m2_bench:2'] = 'agency';
  h.at('m3_mobil_release'); h.state.step = FILM_SCENE_BY_ID.m3_mobil_release.steps.length;
  h.command('next');
  assert.equal(h.state.scene, 'm3_oracle_last');
  assert.equal(h.world.agents.get('oracle')!.rotation, 0, 'the Oracle should face Neo as he enters the kitchen');
  assert.match(h.state.lastText, /Morpheus|先知/);
  assert.match(h.state.lastText, /身份|判断/);
  h.finish('m3_oracle_last'); h.command('next');
  assert.equal(h.state.scene, 'm3_oracle_absorbed');
  assert.equal(h.actor().id, 'oracle');
  assert.ok(h.world.agents.get('smith')!.position.z > h.actor().position.z + 15, 'Smith should begin beyond the hallway, not beside the Oracle');
  h.finish('m3_oracle_absorbed');
  assert.ok(h.world.agents.get('smith')!.position.z < filmEntry(FILM_SCENE_BY_ID.m3_oracle_absorbed).z - 25, 'Smith should enter the kitchen only after the farewell');
  assert.match(h.sandbox.state.neoLife!.journal[0].title, /旁观片段/);
  assert.match(h.sandbox.state.neoLife!.journal[0].text, /不是 Neo 此时/);
  h.command('next');
  assert.equal(h.world.agents.get('oracle')?.status, 'disconnected');
  assert.equal(h.state.scene, 'm3_bane_questions');
});

test('Roland saves Bane evidence without prematurely killing Maggie or revealing the Logos stowaway to Neo', () => {
  const h = setup(); h.at('m3_oracle_absorbed'); h.state.step = FILM_SCENE_BY_ID.m3_oracle_absorbed.steps.length;
  h.state.completed.push('m3_oracle_absorbed');
  h.command('next'); assert.equal(h.state.scene, 'm3_bane_questions');
  h.finish('m3_bane_questions');
  let choices = h.sandbox.state.neoLife!.choices;
  assert.equal(choices.bane_wounds, 'self_inflicted');
  assert.equal(choices.bane_emp_record, 'unexplained');
  assert.equal(choices.bane_neural_scan, 'abnormal');
  assert.equal(h.world.agents.get('maggie')?.status, 'alive');
  h.sandbox.restore(JSON.parse(JSON.stringify(h.sandbox.state)));
  choices = h.sandbox.state.neoLife!.choices;
  assert.equal(h.sandbox.state.neoLife!.choices.bane_neural_scan, 'abnormal');
  h.command('next'); assert.equal(h.state.scene, 'm3_logos_plan');
  assert.equal(h.actor().id, 'neo');
  assert.match(h.state.lastText, /疑点|证据/);
  h.finish('m3_logos_plan');
  assert.equal(choices.logos_assignment, 'neo_trinity');
  assert.equal(choices.hammer_assignment, 'niobe_zion');
  assert.equal(h.world.agents.get('maggie')?.status, 'alive');
  h.command('next'); assert.equal(h.state.scene, 'm3_zion_prepare');
  h.finish('m3_zion_prepare'); h.command('next');
  assert.equal(h.state.scene, 'm3_maggie_discovery');
  h.finish('m3_maggie_discovery');
  assert.equal(h.world.agents.get('maggie')?.status, 'dead');
  assert.equal(choices.bane_escape_route, 'logos_suspected');
  assert.match(h.sandbox.state.neoLife!.journal[0].title, /旁观片段/);
  h.command('next'); assert.equal(h.state.scene, 'm3_bane');
});

test('a save from the older ship decision still sees Oracle assimilation before returning to Zion', () => {
  const h = setup();
  h.at('m3_logos_plan');
  h.state.step = FILM_SCENE_BY_ID.m3_logos_plan.steps.length;
  h.state.completed.push('m3_bane_questions', 'm3_logos_plan');
  h.sandbox.restore(JSON.parse(JSON.stringify(h.sandbox.state)));
  h.command('next');
  assert.equal(h.state.scene, 'm3_oracle_absorbed');
  h.finish('m3_oracle_absorbed');
  h.command('next');
  assert.equal(h.state.scene, 'm3_zion_prepare');
  assert.equal(h.state.completed.filter(id => id === 'm3_logos_plan').length, 1);
});
