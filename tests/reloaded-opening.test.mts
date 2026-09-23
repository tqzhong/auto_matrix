import assert from 'node:assert/strict';
import test from 'node:test';
import { FILM_SCENE_BY_ID, RELOADED, filmEntry, filmPosition, playerBlocked, reloadedLocked, type WorldEvent } from '@auto_matrix/shared';
import { WorldState } from '../packages/server/src/world/WorldState.js';
import { AgentManager } from '../packages/server/src/agents/AgentManager.js';
import { SandboxSystem } from '../packages/server/src/player/SandboxSystem.js';
import { PlayerController } from '../packages/server/src/player/PlayerController.js';
import type { ConversationEngine } from '../packages/server/src/agents/ConversationEngine.js';
import type { ActionExecutor } from '../packages/server/src/agents/ActionExecutor.js';
import type { WorldDynamics } from '../packages/server/src/story/WorldDynamics.js';

function setup(id: 'm2_dream' | 'm2_meeting') {
  const world = new WorldState(); new AgentManager(world).initializeAllAgents();
  const dynamics = { record: (event: Omit<WorldEvent, 'id'>) => world.addWorldEvent(event) } as WorldDynamics;
  const sandbox = new SandboxSystem(world, dynamics, 81);
  const players = new PlayerController(world, { interrupt() {}, isAgentInConversation: () => false } as unknown as ConversationEngine, { execute() {} } as unknown as ActionExecutor, dynamics, sandbox);
  const scene = FILM_SCENE_BY_ID[id]; const neo = world.agents.get('neo')!; sandbox.life.begin(neo, 0);
  const actor = world.agents.get(scene.actor)!; players.possess('reload-player', actor.id, 0);
  sandbox.state.neoLife!.journey = { version: 1, scene: id, step: 0, actor: actor.id, completed: [], enteredAt: 0, reflections: {}, lastText: scene.context, checkpoint: filmEntry(scene) };
  actor.position = filmEntry(scene); actor.currentLocation = scene.set; actor.isInMatrix = true;
  let tick = 0; let sequence = 0;
  const command = (target = 'act') => players.sandboxAction('reload-player', { kind: 'life', target: `film:${target}` }, ++tick);
  const action = (kind: string) => players.act('reload-player', kind, ++tick);
  const frames = (seconds: number, focus = false, running = true) => {
    for (let i = 0; i < Math.ceil(seconds * 20); i++) {
      players.receiveInput('reload-player', { x: 0, z: 0, yaw: actor.rotation, jump: false, sprint: false, focus, sequence: ++sequence });
      players.step(.05, running, ++tick);
    }
  };
  frames(.05);
  const journey = () => sandbox.life.film.state!;
  const state = () => journey().reloaded!;
  return { world, sandbox, players, scene, actor, command, action, frames, journey, state };
}

function reachMeeting(h: ReturnType<typeof setup>) {
  h.frames(RELOADED.wake + .1); h.command(); h.frames(RELOADED.conversation + .1); h.command(); h.frames(RELOADED.connect + .1);
  assert.equal(h.state().phase, 'report_ready'); assert.equal(h.actor.currentLocation, 'film_captains_meeting');
  h.actor.position = filmPosition(h.scene.set, 0, 13); h.command(); h.frames(RELOADED.report + .1);
  assert.equal(h.state().phase, 'earpiece_ready');
  h.actor.position = filmPosition(h.scene.set, 0, -14); h.command(); h.frames(RELOADED.earpiece + .1);
  assert.equal(h.state().phase, 'evacuate_ready');
}

function combat(h: ReturnType<typeof setup>) {
  reachMeeting(h); h.command('exit:east'); h.frames(RELOADED.breach + .1);
  assert.equal(h.state().phase, 'combat');
}

test('dream gunfire, slow motion and memory remain a vision, never Trinity death', () => {
  const h = setup('m2_dream'); h.actor.position = filmPosition(h.scene.set, 0, -15); h.frames(.1); h.command(); h.frames(RELOADED.breakGlass + .1);
  assert.equal(h.state().phase, 'falling'); assert.equal(reloadedLocked(h.journey()), true);
  for (const beat of RELOADED.dreamShots) {
    h.frames(Math.max(0, beat - h.state().elapsed)); h.action('attack');
  }
  h.frames(RELOADED.fall + RELOADED.impact + .2);
  assert.equal(h.state().phase, 'done'); assert.equal(h.actor.status, 'alive'); assert.equal(h.actor.health, h.actor.maxHealth);
  assert.equal(h.sandbox.state.neoLife!.choices.trinity_dream, 'clear'); assert.ok(h.journey().completed.includes('m2_dream'));
  h.command('next'); assert.equal(h.journey().actor, 'neo'); assert.equal(h.journey().scene, 'm2_meeting');
  assert.equal(h.world.agents.get('neo')!.currentLocation, 'film_neb_deck');
});

test('meeting preserves the real-world wake, intelligence and the chosen evacuation route', () => {
  const h = setup('m2_meeting'); assert.equal(h.actor.isInMatrix, false);
  reachMeeting(h);
  const door = filmPosition(h.scene.set, 0, -20);
  assert.equal(playerBlocked(door, true, 1.1, h.sandbox.state.structures), true, 'closed iron door blocks passage');
  h.command('exit:west'); h.frames(RELOADED.breach + .2);
  assert.equal(playerBlocked(door, true, 1.1, h.sandbox.state.structures), false, 'breached doorway admits the agents');
  assert.equal(h.state().exit, 'west'); assert.equal(h.sandbox.state.neoLife!.choices.ballard_watch, '36h');
  assert.equal(h.sandbox.state.neoLife!.choices.smith_earpiece, 'received');
  h.frames(RELOADED.evacuation + .2); assert.equal(h.state().evacuated, true);
  assert.ok(h.world.agents.get('niobe')!.position.x < filmPosition(h.scene.set).x - 14);
  assert.ok(h.journey().step < h.scene.steps.length, 'evacuating cannot defeat the upgraded agents');
});

test('upgraded agents catch spam and feints; only a late dodge followed by a close counter lands', () => {
  const h = setup('m2_meeting'); combat(h);
  const enemy = h.world.agents.get(RELOADED.agents[0])!;
  h.actor.position = { ...enemy.position, z: enemy.position.z + 2.2 }; h.actor.rotation = Math.PI;
  h.action('attack'); h.frames(.3); assert.deepEqual(h.state().hits, [0, 0, 0]);
  h.state().cycle = .2; h.action('dodge'); assert.equal(h.state().evaded, false, 'early feint is not a dodge');
  h.frames(1.3); h.state().cycle = RELOADED.strike - .3; h.state().dodgeCooldown = 0;
  h.action('dodge'); assert.equal(h.state().evaded, true);
  h.frames(.4); h.actor.position = { ...enemy.position, z: enemy.position.z + 2.2 }; h.actor.rotation = Math.PI;
  h.action('attack'); h.frames(.25); assert.equal(h.state().hits[0], 1);
  const hits = [...h.state().hits]; h.action('attack'); h.frames(.3); assert.deepEqual(h.state().hits, hits, 'one opening permits one counter');
});

test('pause, save, occupied cast and retry preserve the authored state without duplicating rewards', () => {
  const h = setup('m2_meeting'); combat(h); h.frames(.4);
  const saved = structuredClone(h.sandbox.state); const cycle = h.state().cycle;
  h.frames(1, true, false); assert.equal(h.state().cycle, cycle); h.sandbox.restore(saved); assert.equal(h.state().cycle, cycle);
  assert.match(h.players.possess('other', 'agent_johnson', 0).error!, /片段|特工|参与/);
  h.world.agents.get('trinity')!.controller = 'other'; h.frames(1); assert.equal(h.state().cycle, cycle);
  delete h.world.agents.get('trinity')!.controller;
  h.actor.health = 0; h.actor.status = 'dead'; h.frames(.1); assert.equal(h.state().phase, 'failed');
  h.command('retry'); assert.equal(h.state().phase, 'combat'); assert.equal(h.state().attempt, 1); assert.equal(h.state().exit, 'east');
  assert.equal(h.actor.status, 'alive'); assert.equal(h.sandbox.state.neoLife!.choices.ballard_watch, '36h');
});

test('ship conversation reserves Link and agent pursuit reports movement to the animation', () => {
  const h = setup('m2_meeting');
  assert.match(h.players.possess('other', 'link', 0).error ?? '', /片段|参与/);
  combat(h);
  const enemy = h.world.agents.get(RELOADED.agents[0])!;
  const before = { ...enemy.position }; h.frames(.05);
  assert.ok(Math.hypot(enemy.position.x - before.x, enemy.position.z - before.z) > 0);
  assert.ok(Math.hypot(enemy.velocity.x, enemy.velocity.z) > 0, 'pursuit must animate feet instead of sliding');
});
