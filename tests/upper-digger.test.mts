import assert from 'node:assert/strict';
import test from 'node:test';
import { FILM_SCENE_BY_ID, FILM_SETS, UPPER_DIGGER, filmCharacterFates, filmPosition, newDiggers, newUpperDigger,
  stepUpperDigger, upperDiggerRoot, type PlayerInput, type WorldEvent } from '@auto_matrix/shared';
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
  const sandbox = new SandboxSystem(world, dynamics, 42);
  const players = new PlayerController(world, { interrupt() {}, isAgentInConversation: () => false } as unknown as ConversationEngine,
    { execute() {} } as unknown as ActionExecutor, dynamics, sandbox);
  players.possess('p', 'neo', 0); sandbox.life.begin(world.agents.get('neo')!, 0); sandbox.state.neoLife!.chapter = 1;
  players.sandboxAction('p', { kind: 'life', target: 'film:start' }, 1);
  Object.assign(sandbox.life.film.state!, { scene: 'm3_diggers', actor: 'charra', step: 1, completed: ['m3_diggers'],
    diggers: { ...newDiggers(1), phase: 'done', damage: 3 } });
  players.possess('p', 'charra', 2);
  let tick = 3, sequence = 0;
  const command = (target: string) => players.sandboxAction('p', { kind: 'life', target: `film:${target}` }, ++tick);
  command('next');
  const frame = (seconds: number, input: Partial<PlayerInput> = {}, running = true) => {
    for (let i = 0; i < Math.ceil(seconds / .05); i++) {
      players.receiveInput('p', { x: 0, z: 0, yaw: 0, pitch: 0, jump: false, sprint: false, climb: 0, crouch: false, focus: false, ...input, sequence: ++sequence });
      players.step(.05, running, ++tick);
    }
  };
  const walk = (x: number, z: number) => {
    const target = filmPosition('film_zion_hangar', x, z);
    for (let i = 0; i < 500; i++) {
      const actor = players.getAgent('p')!, dx = target.x - actor.position.x, dz = target.z - actor.position.z, gap = Math.hypot(dx, dz);
      if (gap < .3) return;
      frame(.05, { x: dx / gap, z: dz / gap, yaw: Math.atan2(dx, dz) });
    }
    assert.fail('the actual maintenance ladder must be reachable');
  };
  const ready = () => { walk(-43, 28); command('act'); frame(30, { climb: 1 }); frame(9, { climb: 1, crouch: true }); };
  return { world, sandbox, players, frame, command, walk, ready, state: () => sandbox.life.film.state!, actor: () => players.getAgent('p')!, tick: () => tick };
}

test('first drill hands off to Zee; climbing and crouched movement are required before belt support', () => {
  const h = game(); assert.equal(h.state().scene, 'm3_upper_digger'); assert.equal(h.actor().id, 'zee');
  h.command('act'); assert.equal(h.state().upperDigger?.phase, 'approach');
  h.walk(-43, 28); h.command('act'); h.frame(2); assert.equal(h.state().upperDigger?.climb, 0);
  h.frame(5, { climb: 1 }); assert.ok(h.state().upperDigger!.climb > 8 && h.state().upperDigger!.climb < 8.5);
  h.frame(25, { climb: 1 }); assert.equal(h.state().upperDigger?.phase, 'crawl');
  h.frame(3, { climb: 1 }); assert.equal(h.state().upperDigger?.crawl, 0, 'standing cannot pass beneath the actual overhead pipe braces');
  h.frame(9, { climb: 1, crouch: true }); assert.equal(h.state().upperDigger?.phase, 'ready');
  assert.equal(h.actor().position.y, FILM_SETS.film_zion_hangar.center.y + UPPER_DIGGER.height);
  h.command('act'); h.frame(3, { focus: true }); assert.equal(h.state().upperDigger?.phase, 'shot');
  assert.equal(h.world.agents.get('charra')?.status, 'alive');
  h.frame(3); assert.equal(h.state().upperDigger?.phase, 'retreat');
  h.frame(2.5, { climb: 1, crouch: true }); assert.equal(h.state().upperDigger?.phase, 'attack');
  h.frame(3.5); assert.equal(h.state().upperDigger?.phase, 'escape'); assert.equal(h.world.agents.get('charra')?.status, 'dead');
  h.frame(7, { climb: 1, crouch: true }); assert.equal(h.state().upperDigger?.phase, 'hatch');
  h.command('act'); h.frame(30, { climb: 1 }); assert.equal(h.state().upperDigger?.phase, 'done');
  assert.ok(h.state().completed.includes('m3_upper_digger')); assert.equal(h.actor().position.y, FILM_SETS.film_zion_hangar.center.y);
  h.command('next'); assert.equal(h.state().scene, 'm3_dock_battle'); assert.equal(h.actor().id, 'mifune');
  assert.equal(h.state().dockGunnery?.phase, 'ready'); assert.equal(h.world.agents.get('charra')?.status, 'dead');
  assert.equal(h.state().diggers?.damage, 3); assert.equal(h.world.agents.get('mifune')?.status, 'alive');
});

test('failed grip can retry, but waiting does not count as supporting the shooter', () => {
  const h = game(); h.ready(); h.command('act'); h.frame(3.1);
  assert.equal(h.state().upperDigger?.phase, 'failed'); assert.equal(h.state().step, 0);
  h.command('retry'); assert.equal(h.state().upperDigger?.phase, 'ready'); assert.equal(h.state().upperDigger?.attempts, 1);
  assert.equal(h.state().diggers?.damage, 3); assert.equal(h.world.agents.get('charra')?.status, 'alive');
});

test('retreat failure and retry preserve Charra’s death, corpse pose and destroyed first drill', () => {
  const h = game(); h.ready(); h.command('act'); h.frame(3, { focus: true }); h.frame(3);
  h.frame(2.5, { climb: 1, crouch: true }); h.frame(3.5);
  const corpse = structuredClone(h.world.agents.get('charra')!.position);
  h.frame(19); assert.equal(h.state().upperDigger?.phase, 'failed'); h.command('retry');
  assert.equal(h.state().upperDigger?.phase, 'escape'); assert.equal(h.state().upperDigger?.charraDead, true);
  assert.deepEqual(h.world.agents.get('charra')!.position, corpse); assert.equal(filmCharacterFates(h.state()).charra, 'dead');
  h.sandbox.restore(structuredClone(h.sandbox.state));
  assert.equal(h.world.agents.get('charra')!.status, 'dead'); assert.deepEqual(h.world.agents.get('charra')!.position, corpse);
});

test('pause, disconnect, restoration and another player preserve the actual ladder height', () => {
  const h = game(); h.walk(-43, 28); h.command('act'); h.frame(3, { climb: 1 });
  const saved = structuredClone(h.sandbox.state), position = structuredClone(h.actor().position);
  h.frame(3, { climb: 1 }, false); assert.deepEqual(h.state().upperDigger, saved.neoLife?.journey?.upperDigger);
  h.players.release('p', h.tick()); h.sandbox.restore(saved); h.sandbox.tick(h.tick() + 1);
  assert.deepEqual(h.state().upperDigger, saved.neoLife?.journey?.upperDigger);
  h.players.possess('p', 'zee', h.tick() + 2); assert.deepEqual(h.actor().position, position);
  assert.match(h.players.possess('other', 'charra', h.tick() + 3).error!, /不能接管/, 'taking over a climber must not drop her from the ladder');
  // A retained owner from before scene entry is still respected rather than stolen.
  h.world.agents.get('charra')!.controller = 'other'; const charra = structuredClone(h.world.agents.get('charra')!);
  h.frame(2, { climb: 1 }); assert.deepEqual(h.state().upperDigger, saved.neoLife?.journey?.upperDigger);
  assert.deepEqual(h.world.agents.get('charra')!.position, charra.position);
  assert.match(h.command('retry'), /玩家/);
});

test('ladder top, crawl and retreat keep continuous roots without overlapping the two climbers', () => {
  const state = newUpperDigger(); state.phase = 'climbing'; let previous = upperDiggerRoot(state, 'zee');
  for (let i = 0; i < 800; i++) {
    stepUpperDigger(state, .05, { climb: 1, crouch: true }); const next = upperDiggerRoot(state, 'zee'), charra = upperDiggerRoot(state, 'charra');
    assert.ok(Math.hypot(next.x - previous.x, next.y - previous.y, next.z - previous.z) < .25, 'crossing the hatch cannot teleport the player');
    assert.ok(Math.hypot(next.x - charra.x, next.y - charra.y, next.z - charra.z) > 2.2, 'Charra must clear the hatch before Zee arrives'); previous = next;
    if (state.phase === 'ready') break;
  }
  assert.equal(state.phase, 'ready');
});

test('returning into the hatch does not reverse Zee or change her saved position', () => {
  const state: import('@auto_matrix/shared').UpperDigger = { ...newUpperDigger(), phase: 'hatch', climb: 44, crawl: 26, retreat: 26, charraDead: true };
  let previous = upperDiggerRoot(state, 'zee'); state.phase = 'dismounting';
  for (let i = 0; i <= UPPER_DIGGER.mount / .05 + 1; i++) {
    const next = upperDiggerRoot(state, 'zee');
    const turn = Math.atan2(Math.sin(next.yaw - previous.yaw), Math.cos(next.yaw - previous.yaw));
    assert.ok(Math.abs(turn) < .01, 'entering the hatch cannot flip the player through 180 degrees');
    assert.ok(Math.hypot(next.x - previous.x, next.y - previous.y) < .15);
    assert.deepEqual(upperDiggerRoot(structuredClone(state), 'zee'), next);
    previous = next; stepUpperDigger(state, .05, {});
  }
  assert.equal(state.phase, 'descending');
});

test('leaving the dock removes the second drill collision together with its scene', () => {
  const h = game();
  assert.ok(h.sandbox.state.structures.some(s => s.id === 'film:upper-digger:body'));
  h.state().scene = 'm3_emp'; h.sandbox.life.film.upperDigger.stage(h.tick());
  assert.ok(!h.sandbox.state.structures.some(s => s.id === 'film:upper-digger:body'), 'an invisible drill cannot block a later visit');
});

test('the two shooters turn back into the service channel instead of snapping through a half turn', () => {
  const state = { ...newUpperDigger(), phase: 'shot' as const, elapsed: UPPER_DIGGER.shot - .02, climb: 44, crawl: 26 } as import('@auto_matrix/shared').UpperDigger;
  let yaw = upperDiggerRoot(state, 'zee').yaw;
  for (let i = 0; i < 20; i++) {
    stepUpperDigger(state, .05, { climb: 1, crouch: true });
    const next = upperDiggerRoot(state, 'zee').yaw, turn = Math.atan2(Math.sin(next - yaw), Math.cos(next - yaw));
    assert.ok(Math.abs(turn) < .4, `retreat turn jumps by ${turn}`); yaw = next;
  }
  assert.ok(Math.abs(Math.sin(yaw) + 1) < .001);
});

test('Charra and the damaged dock persist after boarding Hammer and on a later visit', () => {
  const h = game();
  Object.assign(h.state(), { scene: 'm3_gate', actor: 'kid', step: FILM_SCENE_BY_ID.m3_gate.steps.length,
    completed: ['m3_diggers', 'm3_upper_digger', 'm3_dock_battle', 'm3_gate'],
    upperDigger: { ...newUpperDigger(), phase: 'done', climb: 0, crawl: 26, retreat: 26, charraDead: true } });
  h.players.possess('p', 'kid', h.tick()); h.sandbox.life.film.reconcileCast();
  const charra = h.world.agents.get('charra')!, corpse = structuredClone({ position: charra.position, action: charra.currentAction });
  h.command('next'); assert.equal(h.state().scene, 'm3_emp');
  assert.equal(h.state().upperDigger?.charraDead, true, 'boarding Hammer must not erase the cause of the body pose');
  assert.equal(h.state().diggers?.phase, 'done'); assert.deepEqual(charra.position, corpse.position);
  assert.deepEqual(charra.currentAction, corpse.action, 'Charra must not reset to a generic corpse above a missing floor');
  h.command('visit:m3_upper_digger'); assert.equal(h.state().visiting, 'm3_upper_digger');
  h.sandbox.restore(structuredClone(h.sandbox.state));
  assert.equal(charra.status, 'dead'); assert.deepEqual(charra.position, corpse.position); assert.deepEqual(charra.currentAction, corpse.action);
  assert.ok(h.sandbox.state.structures.some(s => s.id === 'film:upper-digger:body'));
  h.command('return'); assert.equal(h.state().scene, 'm3_emp');
  assert.deepEqual(charra.currentAction, corpse.action);
});
