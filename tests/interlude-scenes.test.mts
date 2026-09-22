import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from 'three';
import { FILM_SCENE_BY_ID, INTERLUDE_CAST, INTERLUDE_TIMING, filmEntry, filmPosition, filmStepPosition, playerBlocked, type FilmJourney, type WorldEvent } from '@auto_matrix/shared';
import { WorldState } from '../packages/server/src/world/WorldState.js';
import { AgentManager } from '../packages/server/src/agents/AgentManager.js';
import { SandboxSystem } from '../packages/server/src/player/SandboxSystem.js';
import { PlayerController } from '../packages/server/src/player/PlayerController.js';
import type { ConversationEngine } from '../packages/server/src/agents/ConversationEngine.js';
import type { ActionExecutor } from '../packages/server/src/agents/ActionExecutor.js';
import type { WorldDynamics } from '../packages/server/src/story/WorldDynamics.js';
import { NebDeckRenderer } from '../packages/client/src/engine/NebDeckRenderer.js';
import { CypherRestaurantRenderer } from '../packages/client/src/engine/CypherRestaurantRenderer.js';

function setup(id: 'm1_cypher_console' | 'm1_steak' | 'm1_meal') {
  const world = new WorldState(); new AgentManager(world).initializeAllAgents();
  const dynamics = { record: (event: Omit<WorldEvent, 'id'>) => world.addWorldEvent(event) } as WorldDynamics;
  const sandbox = new SandboxSystem(world, dynamics, 42);
  const players = new PlayerController(world, { interrupt() {}, isAgentInConversation: () => false } as unknown as ConversationEngine,
    {} as ActionExecutor, dynamics, sandbox);
  players.possess('player', 'neo', 0); const neo = world.agents.get('neo')!; sandbox.life.begin(neo, 0);
  const scene = FILM_SCENE_BY_ID[id]; const checkpoint = filmStepPosition(scene, scene.steps[0]);
  sandbox.state.neoLife!.journey = { version: 1, scene: scene.id, actor: scene.actor, step: 0, completed: [], enteredAt: 0,
    reflections: {}, lastText: scene.context, checkpoint, interlude: { kind: id === 'm1_cypher_console' ? 'console' : id === 'm1_steak' ? 'steak' : 'meal', phase: 'ready', elapsed: 0 } };
  if (scene.actor !== 'neo') players.possess('player', scene.actor, 0);
  const actor = players.getAgent('player')!; actor.position = { ...checkpoint }; actor.currentLocation = scene.set; actor.isInMatrix = id === 'm1_steak';
  let tick = 0; let sequence = 0;
  sandbox.life.film.interludeFrame(actor, 0, tick);
  const command = (target: string) => players.sandboxAction('player', { kind: 'life', target: `film:${target}` }, ++tick);
  const frames = (seconds: number, running = true) => {
    for (let i = 0; i < Math.round(seconds / .05); i++) {
      players.receiveInput('player', { x: 0, z: 0, yaw: actor.rotation, jump: false, sprint: false, sequence: ++sequence });
      players.step(.05, running, tick); if (running && i % 10 === 0) sandbox.tick(++tick);
    }
  };
  return { world, sandbox, players, actor, scene, command, frames, state: () => sandbox.life.film.state!, tick: () => tick };
}

test('Cypher waits at the console, saves the clock and lets Neo answer exactly once', () => {
  const h = setup('m1_cypher_console'); h.frames(10); assert.equal(h.state().interlude?.phase, 'ready'); assert.equal(h.state().step, 0);
  h.command('act'); assert.equal(h.state().interlude?.phase, 'performing'); h.frames(2.35);
  const elapsed = h.state().interlude!.elapsed; const poses = INTERLUDE_CAST.console.map(id => structuredClone(h.world.agents.get(id)!.currentAction?.parameters.interlude));
  h.frames(3, false); assert.equal(h.state().interlude!.elapsed, elapsed); assert.deepEqual(INTERLUDE_CAST.console.map(id => h.world.agents.get(id)!.currentAction?.parameters.interlude), poses);
  const saved = JSON.parse(JSON.stringify(h.sandbox.state)); h.players.release('player', h.tick()); h.sandbox.restore(saved); h.players.possess('player', 'neo', h.tick());
  assert.equal(h.state().interlude!.elapsed, elapsed); h.frames(INTERLUDE_TIMING.console - elapsed + .2);
  assert.equal(h.state().interlude?.phase, 'choice'); assert.equal(h.state().step, 1);
  const before = h.sandbox.state.neoLife!.philosophy.agency; h.command('reflect:agency'); assert.equal(h.state().interlude?.phase, 'responding');
  h.command('reflect:agency'); assert.equal(h.sandbox.state.neoLife!.philosophy.agency, before + 1);
  h.frames(INTERLUDE_TIMING.consoleResponse + .2); assert.equal(h.state().interlude?.phase, 'done');
  assert.equal(h.state().interlude?.elapsed, INTERLUDE_TIMING.consoleResponse); assert.ok(h.state().completed.includes('m1_cypher_console'));
});

test('an occupied cast member blocks the scene and every active role stays reserved', () => {
  const h = setup('m1_cypher_console'); h.players.possess('other', 'cypher', h.tick());
  assert.match(h.command('act'), /另一位玩家/); assert.equal(h.state().interlude?.phase, 'ready');
  h.players.release('other', h.tick()); h.command('act');
  assert.match(h.players.possess('other', 'cypher', h.tick()).error!, /电影片段/);
  assert.match(h.players.act('player', 'attack', h.tick()), /演出|片段/);
});

test('Smith observes the complete steak bargain without leaking it into Neo knowledge', () => {
  const h = setup('m1_steak'); const choices = structuredClone(h.sandbox.state.neoLife!.choices);
  assert.equal(h.actor.id, 'smith'); h.command('act'); assert.equal(h.state().step, 1); assert.equal(h.state().interlude?.phase, 'ready');
  h.actor.position = filmStepPosition(h.scene, h.scene.steps[1]); h.command('act'); assert.equal(h.state().interlude?.phase, 'performing');
  h.frames(INTERLUDE_TIMING.steak + .2); assert.equal(h.state().interlude?.phase, 'done'); assert.ok(h.state().completed.includes('m1_steak'));
  assert.deepEqual(h.sandbox.state.neoLife!.choices, choices);
  assert.match(h.sandbox.state.neoLife!.journal[0].title, /旁观片段/); assert.match(h.sandbox.state.neoLife!.journal[0].text, /不是 Neo/);
});

test('the crew meal is player-started and still requires walking back to the core', () => {
  const h = setup('m1_meal'); h.frames(8); assert.equal(h.state().interlude?.phase, 'ready');
  h.command('act');
  for (const id of INTERLUDE_CAST.meal) assert.equal(h.world.agents.get(id)!.currentAction?.parameters.interlude?.role, id);
  h.frames(INTERLUDE_TIMING.meal + .2);
  assert.equal(h.state().interlude?.phase, 'done'); assert.equal(h.state().step, 1); assert.equal(h.state().completed.includes('m1_meal'), false);
  h.actor.position = filmStepPosition(h.scene, h.scene.steps[1]); h.sandbox.tick(h.tick() + 1);
  assert.ok(h.state().completed.includes('m1_meal'));
});

test('the console, crew meal and restaurant own visible, animated physical props', () => {
  const nebRoot = new THREE.Group(); const neb = new NebDeckRenderer(nebRoot);
  const consoleJourney: FilmJourney = { version: 1, scene: 'm1_cypher_console', actor: 'neo', step: 0, completed: [], enteredAt: 0,
    reflections: {}, lastText: '', checkpoint: filmPosition('film_neb_deck'), interlude: { kind: 'console', phase: 'ready', elapsed: 0 } };
  try {
    for (const name of ['neb-cypher-console-scene', 'neb-cypher-liquor-bottle', 'neb-cypher-shot-glass', 'neb-crew-meal-scene', 'neb-neo-protein-bowl', 'neb-neo-spoon']) assert.ok(nebRoot.getObjectByName(name), name);
    neb.update(consoleJourney, 0); const cup = nebRoot.getObjectByName('neb-cypher-shot-glass')!; const resting = cup.position.y;
    consoleJourney.interlude = { kind: 'console', phase: 'performing', elapsed: 5.5 }; neb.update(consoleJourney, 5.5); assert.ok(cup.position.y > resting + .2);
    const mealJourney: FilmJourney = { ...consoleJourney, scene: 'm1_meal', interlude: { kind: 'meal', phase: 'performing', elapsed: 2.2 } };
    neb.update(mealJourney, 7); const bowl = nebRoot.getObjectByName('neb-neo-protein-bowl')!; assert.ok(bowl.position.x > -4);
    assert.equal(nebRoot.getObjectByName('neb-meal-steam-0')!.visible, true);
  } finally { neb.dispose(); }

  const restaurantRoot = new THREE.Group(); const restaurant = new CypherRestaurantRenderer(restaurantRoot);
  const steakJourney: FilmJourney = { version: 1, scene: 'm1_steak', actor: 'smith', step: 1, completed: [], enteredAt: 0,
    reflections: {}, lastText: '', checkpoint: filmPosition('film_cypher_restaurant'), interlude: { kind: 'steak', phase: 'performing', elapsed: 0 } };
  try {
    for (const name of ['cypher-window-table', 'cypher-chair-smith', 'cypher-chair-cypher', 'cypher-steak', 'cypher-steak-cut-piece', 'cypher-steak-knife', 'cypher-steak-fork', 'cypher-wine-glass', 'cypher-restaurant-window']) assert.ok(restaurantRoot.getObjectByName(name), name);
    restaurant.update(steakJourney, 0); const bite = restaurantRoot.getObjectByName('cypher-steak-cut-piece')!; const resting = bite.position.y;
    steakJourney.interlude!.elapsed = 3.45; restaurant.update(steakJourney, 3.45); assert.ok(bite.position.y > resting + 1);
  } finally { restaurant.dispose(); }
});

test('all three interludes have an unobstructed playable approach', () => {
  for (const id of ['m1_cypher_console', 'm1_steak', 'm1_meal'] as const) {
    const scene = FILM_SCENE_BY_ID[id]; const from = filmEntry(scene); const to = filmStepPosition(scene, scene.steps[0]);
    for (let i = 0; i <= 100; i++) {
      const point = { x: from.x + (to.x - from.x) * i / 100, y: from.y, z: from.z + (to.z - from.z) * i / 100 };
      assert.equal(playerBlocked(point, id !== 'm1_meal' && id !== 'm1_cypher_console'), false, `${id} route blocked at sample ${i}`);
    }
  }
});
