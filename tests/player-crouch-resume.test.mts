import assert from 'node:assert/strict';
import test from 'node:test';
import { execFileSync, spawn } from 'node:child_process';
import { readFile, writeFile, rm } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { io } from 'socket.io-client';
import { filmPosition, type WorldEvent, type WorldStateFull } from '@auto_matrix/shared';
import { WorldState } from '../packages/server/src/world/WorldState.js';
import { AgentManager } from '../packages/server/src/agents/AgentManager.js';
import { SandboxSystem } from '../packages/server/src/player/SandboxSystem.js';
import { PlayerController } from '../packages/server/src/player/PlayerController.js';
import type { ConversationEngine } from '../packages/server/src/agents/ConversationEngine.js';
import type { ActionExecutor } from '../packages/server/src/agents/ActionExecutor.js';
import type { WorldDynamics } from '../packages/server/src/story/WorldDynamics.js';

const root = fileURLToPath(new URL('../', import.meta.url));
function setup(moving: boolean) {
  const world = new WorldState(); new AgentManager(world).initializeAllAgents();
  const dynamics = { record: (event: Omit<WorldEvent, 'id'>) => world.addWorldEvent(event) } as WorldDynamics;
  const sandbox = new SandboxSystem(world, dynamics, 42);
  const conversations = { interrupt() {}, isAgentInConversation: () => false } as unknown as ConversationEngine;
  const players = new PlayerController(world, conversations, {} as ActionExecutor, dynamics, sandbox);
  players.possess('player', 'neo', 0); const neo = world.agents.get('neo')!; sandbox.life.begin(neo, 0);
  neo.position = filmPosition('film_metacortex_floor', -25.05, -27.54); neo.currentLocation = 'film_metacortex_floor';
  sandbox.state.neoLife!.journey = { version: 1, scene: 'm1_office_escape', step: 2, actor: 'neo', completed: ['m1_boss'], enteredAt: 0,
    checkpoint: { ...neo.position }, reflections: {}, lastText: '', phone: { phase: 'connected', elapsed: 11 },
    office: { alert: 0, suspicion: [0, 0, 0], waypoints: [1, 0, 0], lastTick: 0, guide: '' } };
  players.receiveInput('player', { x: moving ? 1 : 0, z: 0, yaw: Math.PI / 2, crouch: true, sprint: false, jump: false, sequence: 1 });
  players.step(.05, true, 1); assert.equal(neo.currentAction?.parameters.crouching, true);
  return { world, sandbox, players, neo, conversations, dynamics };
}

for (const moving of [false, true]) {
  test(`paused ${moving ? 'moving' : 'idle'} crouch preserves its full phone action through disconnect and re-entry`, () => {
    const h = setup(moving); h.players.step(.05, false, 1);
    const snapshot = () => structuredClone({ action: h.neo.currentAction, position: h.neo.position, rotation: h.neo.rotation, velocity: h.neo.velocity });
    const expected = snapshot(); h.players.release('player', 1); assert.deepEqual(snapshot(), expected);
    const returned = new PlayerController(h.world, h.conversations, {} as ActionExecutor, h.dynamics, h.sandbox);
    returned.setRunning(false); assert.equal(returned.possess('returned', 'neo', 1).agentId, 'neo'); assert.deepEqual(snapshot(), expected);
    returned.step(.05, true, 2); assert.equal(h.neo.currentAction?.type, 'idle'); assert.equal(h.neo.currentAction?.parameters.crouching, false);
    assert.deepEqual(h.neo.position, expected.position, 'the saved movement must wait for fresh input');
  });
}

test('disconnecting a running crouched player stops its old movement', () => {
  const h = setup(true), position = { ...h.neo.position };
  h.players.release('player', 1); h.players.step(.1, true, 2);
  assert.notEqual(h.neo.currentAction?.type, 'move_to'); assert.notEqual(h.neo.currentAction?.parameters.crouching, true);
  assert.deepEqual(h.neo.velocity, { x: 0, y: 0, z: 0 }); assert.deepEqual(h.neo.position, position);
});

for (const [type, running] of [['idle', false], ['move_to', false], ['move_to', true], ['attack', false]] as const) {
  const preserve = !running && type !== 'attack';
  test(`cold crouch startup ${preserve ? 'preserves' : 'clears'} ${type} with running=${running}`, { timeout: 25000 }, async t => {
    const directory = execFileSync(process.execPath, ['--import', 'tsx', 'scripts/film-review-fixture.mts', 'm1_office_escape'], { cwd: root, encoding: 'utf8' }).trim();
    const file = path.join(directory, 'world.json'), checkpoint = JSON.parse(await readFile(file, 'utf8'));
    const actor = checkpoint.agents.neo, journey = checkpoint.sandbox.neoLife.journey;
    actor.position = filmPosition('film_metacortex_floor', -25.05, -27.54); actor.currentLocation = 'film_metacortex_floor';
    actor.velocity = { x: 0, y: 0, z: 0 }; actor.targetPosition = null; actor.currentPath = []; checkpoint.simulation = { running, speed: 1 };
    journey.step = 2; journey.checkpoint = { ...actor.position }; journey.phone = { phase: 'connected', elapsed: 11 };
    journey.office = { alert: 0, suspicion: [0, 0, 0], waypoints: [1, 0, 0], lastTick: checkpoint.tick, guide: '' };
    actor.currentAction = { type, parameters: { player: true, resolved: true, crouching: true, phone: { ...journey.phone } }, startedAt: checkpoint.tick, duration: 1, progress: .27 };
    checkpoint.agents.citizen_5.currentAction = { type: 'attack', parameters: { player: true, resolved: true, crouching: true }, startedAt: checkpoint.tick, duration: 1, progress: .2 };
    const expected = structuredClone(actor.currentAction); await writeFile(file, JSON.stringify(checkpoint));
    const child = spawn(process.execPath, ['--import', 'tsx', 'tests/fixtures/server-startup.mts', 'normal'], { cwd: root,
      env: { ...process.env, MATRIX_DATA_DIR: directory, MATRIX_CLOUD_SAVE: '', HOST: '127.0.0.1', PORT: '0', TICK_RATE_MS: '10000', LLM_API_KEY: '' }, stdio: ['ignore', 'pipe', 'pipe'] });
    let output = ''; child.stdout.on('data', data => { output += data; }); child.stderr.on('data', data => { output += data; });
    const finished = new Promise(resolve => child.once('close', resolve)); let socket: ReturnType<typeof io> | undefined;
    t.after(async () => {
      socket?.disconnect(); if (child.exitCode === null && child.signalCode === null) child.kill('SIGTERM');
      const timer = setTimeout(() => { if (child.exitCode === null && child.signalCode === null) child.kill('SIGKILL'); }, 5000);
      try { await finished; } finally { clearTimeout(timer); await rm(directory, { recursive: true, force: true }); }
    });
    const deadline = Date.now() + 15000;
    while (!output.includes('STARTUP_LISTENING')) { assert(child.exitCode === null && child.signalCode === null && Date.now() < deadline, output.slice(-1800)); await new Promise(resolve => setTimeout(resolve, 20)); }
    const address = JSON.parse(output.match(/STARTUP_LISTENING (\{[^\n]+\})/)![1]), url = `http://127.0.0.1:${address.port}`;
    const world = async () => await (await fetch(url + '/api/world')).json() as WorldStateFull;
    const check = (state: WorldStateFull) => {
      assert.equal(state.simulation!.running, running);
      if (preserve) assert.deepEqual(state.agents.neo.currentAction, expected);
      else { assert.equal(state.agents.neo.currentAction?.type, 'idle'); assert.notEqual(state.agents.neo.currentAction?.parameters.crouching, true); }
      assert.deepEqual(state.agents.neo.position, actor.position); assert.deepEqual(state.agents.neo.velocity, { x: 0, y: 0, z: 0 });
      assert.equal(state.agents.citizen_5.currentAction, null, 'expired crouch-like attacks must still be cleared');
      assert.deepEqual(state.sandbox!.neoLife!.journey!.office, journey.office); assert.equal(state.sandbox!.neoLife!.money, checkpoint.sandbox.neoLife.money);
    };
    check(await world()); socket = io(url, { autoConnect: false, transports: ['websocket'] });
    const connected = new Promise<void>((resolve, reject) => { socket!.once('connect', resolve); socket!.once('connect_error', reject); });
    socket.connect(); await connected; socket.emit('message', { type: 'play_as', data: { agentId: 'neo' } });
    const joined = Date.now() + 5000;
    while (!(await world()).agents.neo.controller) { assert(Date.now() < joined, 'crouch re-entry timed out'); await new Promise(resolve => setTimeout(resolve, 20)); }
    check(await world()); socket.disconnect(); const left = Date.now() + 5000;
    while ((await world()).agents.neo.controller) { assert(Date.now() < left, 'crouch disconnect timed out'); await new Promise(resolve => setTimeout(resolve, 20)); }
    check(await world());
  });
}
