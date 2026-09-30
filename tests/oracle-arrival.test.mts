import assert from 'node:assert/strict';
import test from 'node:test';
import { FILM_SETS, FILM_SCENE_BY_ID, filmPosition, playerBlocked, type WorldEvent } from '@auto_matrix/shared';
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
  const players = new PlayerController(world, conversations, { execute() {} } as unknown as ActionExecutor, dynamics, sandbox);
  players.possess('arrival-player', 'neo', 0); const actor = world.agents.get('neo')!;
  sandbox.life.begin(actor, 0); sandbox.state.neoLife!.chapter = 1;
  let tick = 0, sequence = 0;
  const command = (target: string) => players.sandboxAction('arrival-player', { kind: 'life', target: `film:${target}` }, ++tick);
  command('continue');
  Object.assign(sandbox.life.film.state!, { scene: 'm1_meal', actor: 'neo', step: FILM_SCENE_BY_ID.m1_meal.steps.length });
  command('next');
  const frame = (count = 1, running = true) => { for (let i = 0; i < count; i++) players.step(.1, running, ++tick); };
  const state = () => sandbox.life.film.state!;
  const move = (x: number, z: number) => {
    players.receiveInput('arrival-player', { x, z, yaw: Math.atan2(x, z), jump: false, sprint: false, sequence: ++sequence }); frame();
  };
  frame();
  return { world, sandbox, players, actor, state, command, frame, move, tick: () => tick };
}

test('first arrival starts outside the Oracle apartment and cannot skip her welcome into the spoon lesson', () => {
  const h = setup(), center = FILM_SETS.film_oracle_home.center;
  assert.equal(h.state().scene, 'm1_spoon');
  assert.ok(h.actor.position.z > center.z + 30, 'Neo must enter through the actual hallway, not appear inside the waiting room');
  assert.ok(h.world.agents.get('morpheus')!.position.z > center.z + 30, 'Morpheus accompanies Neo to the door before taking the sofa');
  assert.equal(playerBlocked(filmPosition('film_oracle_home', 0, 44), true), false, 'the arrival hallway must be walkable');
  h.actor.position = filmPosition('film_oracle_home', -7.4, 9.6); h.command('act');
  assert.equal(h.state().oracle!.spoonLesson!.phase, 'waiting', 'the old G target cannot bypass the welcome');
});

test('the Oracle entrance opens a real aperture with solid wall wings and a closed-door collision', () => {
  const h = setup();
  assert.equal(playerBlocked(filmPosition('film_oracle_home', 0, 29.8), true, 1.1, h.sandbox.state.structures), true, 'the closed leaf blocks entry');
  for (const x of [-8, 8]) assert.equal(playerBlocked(filmPosition('film_oracle_home', x, 29.8), true), true, 'players cannot walk through the wall beside the doorway');
});

function walk(h: ReturnType<typeof setup>, x: number, z: number) {
  const target = filmPosition('film_oracle_home', x, z);
  for (let i = 0; i < 400; i++) {
    const dx = target.x - h.actor.position.x, dz = target.z - h.actor.position.z, gap = Math.hypot(dx, dz);
    if (gap < .7) { h.move(0, 0); return; }
    const before = { ...h.actor.position }; h.move(dx / gap, dz / gap);
    assert.ok(Math.hypot(h.actor.position.x - before.x, h.actor.position.z - before.z) < .9, 'walking cannot teleport through the door or furniture');
  }
  assert.fail(`the ordinary controller cannot reach ${x}, ${z}: ${JSON.stringify(h.actor.position)}`);
}
function arriveAtDoor(h: ReturnType<typeof setup>) {
  for (let i = 0; i < 300 && h.state().oracle!.arrival!.phase === 'hallway'; i++) {
    const guide = h.world.agents.get('morpheus')!, dx = guide.position.x - h.actor.position.x, dz = guide.position.z - h.actor.position.z, gap = Math.hypot(dx, dz);
    h.move(gap > 1.2 ? dx / gap : 0, gap > 1.2 ? dz / gap : 0);
  }
  assert.equal(h.state().oracle!.arrival!.phase, 'waiting'); walk(h, .5, 32.3);
}

test('ordinary input walks the hall, chooses to enter, crosses the open door and reaches the waiting room', () => {
  const h = setup(); arriveAtDoor(h); h.command('next'); assert.equal(h.state().oracle!.arrival!.phase, 'waiting');
  h.command('act'); assert.equal(h.state().oracle!.arrival!.phase, 'opening');
  h.frame(50); assert.equal(h.state().oracle!.arrival!.phase, 'guiding');
  assert.equal(playerBlocked(filmPosition('film_oracle_home', 0, 29.8), true, 1.1, h.sandbox.state.structures), false, 'the actual open doorway admits Neo');
  assert.equal(playerBlocked(filmPosition('film_oracle_home', -2.4, 27.4), true, 1.1, h.sandbox.state.structures), true, 'the opened leaf keeps its own collision');
  walk(h, 0, 23.5); walk(h, 0, 18); h.frame(150);
  assert.equal(h.state().oracle!.arrival!.phase, 'done');
  const morpheus = h.world.agents.get('morpheus')!;
  assert.ok(Math.abs(morpheus.position.x - filmPosition('film_oracle_home', -10.4, 12).x) < .01, 'he reaches the sofa without being staged there on entry');
  walk(h, -4, 16); walk(h, -7.4, 9.6); h.command('act');
  assert.equal(h.state().oracle!.spoonLesson!.phase, 'sitting', 'the original spoon lesson starts only after the welcome');
});

test('companions wait for Neo, and the door performance freezes on pause, disconnect and character occupation', () => {
  const h = setup(); h.actor.position = filmPosition('film_oracle_home', 0, 47); h.frame(100);
  assert.equal(h.state().oracle!.arrival!.phase, 'hallway', 'Morpheus cannot finish the corridor without Neo following');
  arriveAtDoor(h); h.command('act'); h.frame(9);
  const saved = JSON.parse(JSON.stringify(h.sandbox.state)), clock = h.state().oracle!.arrival!.elapsed;
  const door = structuredClone(h.sandbox.state.structures.find(item => item.id === 'film:oracle:door'));
  h.frame(25, false); assert.equal(h.state().oracle!.arrival!.elapsed, clock);
  h.sandbox.restore(saved); h.sandbox.life.film.oracleFrame(h.actor, false, 0, h.tick());
  assert.equal(h.state().oracle!.arrival!.elapsed, clock); assert.deepEqual(h.sandbox.state.structures.find(item => item.id === 'film:oracle:door'), door);
  h.players.release('arrival-player', h.tick()); h.frame(25); assert.equal(h.state().oracle!.arrival!.elapsed, clock);
  h.players.possess('arrival-player', 'neo', h.tick()); h.players.possess('host-player', 'oracle_priestess', h.tick());
  const hostess = h.world.agents.get('oracle_priestess')!, place = { ...hostess.position };
  h.frame(25); assert.equal(h.state().oracle!.arrival!.elapsed, clock); assert.deepEqual(hostess.position, place);
  h.players.release('host-player', h.tick()); h.frame(55); assert.equal(h.state().oracle!.arrival!.phase, 'guiding');
  const progress = h.state().oracle!.arrival!.hostess; h.frame(50); assert.equal(h.state().oracle!.arrival!.hostess, progress, 'the hostess waits on the inside instead of leaving Neo outside');
});

test('retry preserves an ongoing arrival, while a legacy waiting-room save continues without replaying the entrance', () => {
  const h = setup(); arriveAtDoor(h); h.command('act'); h.frame(10);
  const clock = h.state().oracle!.arrival!.elapsed, checkpoint = { ...h.state().checkpoint };
  h.actor.status = 'dead'; h.actor.health = 0; h.command('retry');
  assert.equal(h.state().oracle!.arrival!.elapsed, clock); assert.deepEqual(h.actor.position, checkpoint); assert.equal(h.actor.status, 'alive');
  delete h.state().oracle!.arrival;
  h.actor.position = filmPosition('film_oracle_home', -7.4, 9.6); h.state().checkpoint = { ...h.actor.position };
  h.sandbox.restore(JSON.parse(JSON.stringify(h.sandbox.state))); h.frame(); h.command('act');
  assert.equal(h.state().oracle!.arrival, undefined); assert.equal(h.state().oracle!.spoonLesson!.phase, 'sitting');
  assert.equal(playerBlocked(filmPosition('film_oracle_home', 0, 29.8), true, 1.1, h.sandbox.state.structures), false);
  assert.equal(playerBlocked(filmPosition('film_oracle_home', -2.4, 27.4), true), true, 'legacy and third-film visits retain the opened leaf footprint');
});
