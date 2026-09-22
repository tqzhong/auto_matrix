import assert from 'node:assert/strict';
import test from 'node:test';
import { FILM_SCENE_BY_ID, filmPosition, filmStepPosition, clubRoute, playerBlocked, type WorldEvent } from '@auto_matrix/shared';
import { WorldState } from '../packages/server/src/world/WorldState.js';
import { AgentManager } from '../packages/server/src/agents/AgentManager.js';
import { SandboxSystem } from '../packages/server/src/player/SandboxSystem.js';
import { PlayerController } from '../packages/server/src/player/PlayerController.js';
import type { WorldDynamics } from '../packages/server/src/story/WorldDynamics.js';
import type { ConversationEngine } from '../packages/server/src/agents/ConversationEngine.js';
import type { ActionExecutor } from '../packages/server/src/agents/ActionExecutor.js';

function setup() {
  const world = new WorldState(); new AgentManager(world).initializeAllAgents();
  const dynamics = { record: (event: Omit<WorldEvent, 'id'>) => world.addWorldEvent(event) } as WorldDynamics;
  const sandbox = new SandboxSystem(world, dynamics, 42);
  const players = new PlayerController(world, { interrupt() {}, isAgentInConversation: () => false } as unknown as ConversationEngine,
    { execute() {} } as unknown as ActionExecutor, dynamics, sandbox);
  players.possess('club-player', 'neo', 0); const neo = players.getAgent('club-player')!;
  sandbox.life.begin(neo, 0); sandbox.life.state!.chapter = 1;
  let tick = 0;
  const command = (target: string) => players.sandboxAction('club-player', { kind: 'life', target: `film:${target}` }, ++tick);
  command('continue'); const state = sandbox.life.film.state!;
  state.step = FILM_SCENE_BY_ID.m1_wake_up.steps.length; state.completed.push('m1_wake_up'); command('next');
  const frames = (seconds: number, running = true) => { for (let i = 0; i < seconds * 10; i++) { players.step(.1, running, ++tick); if (running) sandbox.tick(tick); } };
  const near = () => { const state = sandbox.life.film.state!; neo.position = filmStepPosition(FILM_SCENE_BY_ID.m1_club, FILM_SCENE_BY_ID.m1_club.steps[state.step]); };
  return { world, sandbox, players, neo, command, near, frames, state: () => sandbox.life.film.state! };
}

function ready(h: ReturnType<typeof setup>) { h.near(); h.frames(10); assert.equal(h.state().club?.phase, 'ready'); }
function question(h: ReturnType<typeof setup>) { ready(h); h.command('act'); h.frames(7); h.command('act'); h.frames(15); assert.equal(h.state().club?.phase, 'question'); }

test('Trinity’s entire approach and departure clear the solid club columns and furniture', () => {
  for (let i = 0; i <= 200; i++) {
    const point = clubRoute(i / 200);
    assert.equal(playerBlocked(filmPosition('film_white_rabbit_club', point.x, point.z), true, .7), false, `blocked at ${point.x}, ${point.z}`);
  }
});

test('Neo can walk from the entrance to the meeting and back to the exit using controller inputs', () => {
  const h = setup(); let sequence = 0;
  const walk = (x: number, z: number) => {
    const target = filmPosition('film_white_rabbit_club', x, z);
    for (let i = 0; i < 800; i++) {
      const dx = target.x - h.neo.position.x; const dz = target.z - h.neo.position.z; const distance = Math.hypot(dx, dz);
      if (distance < .3) {
        h.players.receiveInput('club-player', { x: 0, z: 0, yaw: h.neo.rotation, jump: false, sprint: false, sequence: ++sequence }); return;
      }
      h.players.receiveInput('club-player', { x: dx / distance, z: dz / distance, yaw: Math.atan2(dx, dz), jump: false, sprint: false, sequence: ++sequence }); h.frames(.1);
    }
    assert.fail(`could not walk to ${x}, ${z}`);
  };
  walk(7, -4); h.frames(10); assert.equal(h.state().club?.phase, 'ready');
  h.command('act'); h.frames(7); h.command('act'); h.frames(15); h.command('reflect:trust'); h.frames(15);
  walk(0, 22); h.frames(.1); assert.ok(h.state().completed.includes('m1_club'));
});

test('Trinity approaches through the club, waits for acknowledgment, and does not speak the warning from a timer alone', () => {
  const h = setup(); const trinity = h.world.agents.get('trinity')!; const start = { ...trinity.position };
  h.frames(15); assert.equal(h.state().step, 0); assert.deepEqual(trinity.position, start);
  ready(h); assert.notDeepEqual(trinity.position, start);
  h.frames(30); assert.equal(h.state().club?.phase, 'ready');
  h.command('reflect:trust'); assert.equal(h.state().step, 1);
  h.command('act'); h.frames(7); assert.equal(h.state().club?.phase, 'listen');
  h.frames(30); assert.equal(h.state().club?.phase, 'listen');
  h.command('act'); h.frames(15); assert.equal(h.state().club?.phase, 'question'); assert.equal(h.state().step, 2);
});

test('each night-club answer is recorded once, receives its own response and requires physically leaving', () => {
  for (const answer of ['agency', 'care', 'trust']) {
    const h = setup(); question(h); const score = h.sandbox.life.state!.philosophy[answer as 'agency'];
    h.command(`reflect:${answer}`); const chosen = h.sandbox.life.state!.journal[0];
    assert.equal(h.state().club?.phase, 'reply'); assert.equal(h.state().step, 2);
    h.command('reflect:care'); h.frames(7);
    assert.equal(h.sandbox.life.state!.philosophy[answer as 'agency'], score + 1);
    assert.equal(h.sandbox.life.state!.journal.filter(entry => entry.title === chosen.title).length, 1);
    assert.equal(h.state().club?.phase, 'departing'); assert.equal(h.state().step, 3);
    assert.match(h.command('next'), /先完成/);
    h.frames(15); assert.equal(h.state().step, 3);
    h.near(); h.frames(1); assert.ok(h.state().completed.includes('m1_club'));
    h.command('next'); assert.equal(h.state().scene, 'm1_boss'); assert.equal(h.state().club, undefined);
    assert.equal(h.sandbox.life.state!.choices['m1_club:2'], answer);
    assert.equal(h.neo.isAwakened, false);
  }
});

test('close conversation retains its exact two-person pose across pause, disconnect, save and retry', () => {
  const h = setup(); ready(h); h.command('act'); h.frames(7); h.command('act'); h.frames(4);
  const encounter = structuredClone(h.state().club); const neo = { ...h.neo.position };
  const trinity = { ...h.world.agents.get('trinity')!.position };
  h.frames(6, false); assert.deepEqual(h.state().club, encounter);
  h.players.release('club-player', 1); h.frames(8); assert.deepEqual(h.state().club, encounter);
  h.sandbox.restore(JSON.parse(JSON.stringify(h.sandbox.state))); h.players.possess('club-player', 'neo', 1);
  assert.deepEqual(h.state().club, encounter); assert.deepEqual(h.neo.position, neo); assert.deepEqual(h.world.agents.get('trinity')!.position, trinity);
  h.neo.status = 'dead'; h.command('retry'); assert.deepEqual(h.state().club, encounter);
  h.players.receiveInput('club-player', { x: 1, z: 1, yaw: 0, jump: true, sprint: true, sequence: 50 }); h.frames(.1);
  assert.ok(Math.hypot(h.neo.position.x - neo.x, h.neo.position.z - neo.z) < .01);
  h.frames(15); assert.equal(h.state().club?.phase, 'question');
});

test('another player owning Trinity freezes the encounter without moving or stealing her', () => {
  const h = setup(); ready(h); h.command('act'); h.frames(2);
  h.players.possess('other-player', 'trinity', 1); const trinity = h.world.agents.get('trinity')!;
  const position = { ...trinity.position }; const encounter = structuredClone(h.state().club);
  h.frames(20); assert.deepEqual(h.state().club, encounter); assert.deepEqual(trinity.position, position);
  assert.match(h.command('act'), /另一位玩家/);
  h.players.release('other-player', 1); h.frames(7); assert.equal(h.state().club?.phase, 'listen');
});

test('legacy completed club saves retain their choice and do not replay the first meeting', () => {
  const h = setup(); const saved = structuredClone(h.sandbox.state); const state = saved.neoLife!.journey!;
  delete state.club; state.completed.push('m1_club'); state.step = 2; state.reflections['m1_club:1'] = 'care';
  h.sandbox.restore(saved); assert.equal(h.state().step, FILM_SCENE_BY_ID.m1_club.steps.length);
  h.command('next'); assert.equal(h.state().scene, 'm1_boss'); assert.equal(h.state().reflections['m1_club:1'], 'care');
});
