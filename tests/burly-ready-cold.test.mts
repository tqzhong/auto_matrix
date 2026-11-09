import assert from 'node:assert/strict';
import test from 'node:test';
import { execFileSync, spawn } from 'node:child_process';
import { readFile, writeFile, rm } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { io } from 'socket.io-client';
import { FILM_SCENE_BY_ID, filmStepPosition, type ServerMessage, type WorldStateFull, type WorldEvent } from '@auto_matrix/shared';
import { WorldState } from '../packages/server/src/world/WorldState.js';
import { AgentManager } from '../packages/server/src/agents/AgentManager.js';
import { SandboxSystem } from '../packages/server/src/player/SandboxSystem.js';
import { PlayerController } from '../packages/server/src/player/PlayerController.js';
import type { ConversationEngine } from '../packages/server/src/agents/ConversationEngine.js';
import type { ActionExecutor } from '../packages/server/src/agents/ActionExecutor.js';
import type { WorldDynamics } from '../packages/server/src/story/WorldDynamics.js';

async function server(t: test.TestContext, variant: 'paused' | 'stale' | 'running') {
  const root = fileURLToPath(new URL('../', import.meta.url));
  const directory = execFileSync(process.execPath, ['--import', 'tsx', 'scripts/film-review-fixture.mts', 'm2_burly'], { cwd: root, encoding: 'utf8' }).trim(), file = path.join(directory, 'world.json');
  const checkpoint = JSON.parse(await readFile(file, 'utf8')), journey = checkpoint.sandbox.neoLife.journey;
  const state = { phase: 'ready', elapsed: 0, attempt: 0, repelled: 0, staffSwings: 0, assimilation: 0, nextCopyAt: checkpoint.tick };
  journey.burly = state; journey.step = 0; checkpoint.simulation = { running: variant === 'running', speed: 1 };
  const neo = checkpoint.agents.neo;
  Object.assign(neo, { position: filmStepPosition(FILM_SCENE_BY_ID.m2_burly, FILM_SCENE_BY_ID.m2_burly.steps[0]), health: 73, velocity: { x: 0, y: 0, z: 0 }, targetPosition: null, currentPath: [] });
  neo.currentAction = { type: 'idle', parameters: { player: true, resolved: true, crouching: false, burly: { ...state, elapsed: variant === 'stale' ? .5 : state.elapsed, role: 'neo' } }, startedAt: checkpoint.tick, duration: 1, progress: 0 };
  await writeFile(file, JSON.stringify(checkpoint));
  const expected = structuredClone(neo), child = spawn(process.execPath, ['--import', 'tsx', 'tests/fixtures/server-startup.mts', 'normal'], {
    cwd: root, env: { ...process.env, MATRIX_DATA_DIR: directory, MATRIX_CLOUD_SAVE: '', HOST: '127.0.0.1', PORT: '0', TICK_RATE_MS: '10000', STATE_SYNC_INTERVAL: '1', LLM_API_KEY: '' }, stdio: ['ignore', 'pipe', 'pipe'],
  });
  let output = '', socket: ReturnType<typeof io> | undefined; child.stdout.on('data', data => { output += data; }); child.stderr.on('data', data => { output += data; }); const finished = new Promise(resolve => child.once('close', resolve));
  t.after(async () => { socket?.disconnect(); if (child.exitCode === null && child.signalCode === null) child.kill('SIGTERM'); const timer = setTimeout(() => { if (child.exitCode === null && child.signalCode === null) child.kill('SIGKILL'); }, 5000); try { await finished; } finally { clearTimeout(timer); await rm(directory, { recursive: true, force: true }); } });
  const wait = async (ready: () => boolean, label: string) => { const end = Date.now() + 15000; while (!ready()) { assert(child.exitCode === null && child.signalCode === null && Date.now() < end, label + ': ' + output.slice(-1200)); await new Promise(resolve => setTimeout(resolve, 20)); } };
  await wait(() => output.includes('STARTUP_LISTENING'), 'startup'); const address = JSON.parse(output.match(/STARTUP_LISTENING (\{[^\n]+\})/)![1]), url = `http://127.0.0.1:${address.port}`;
  const world = async () => await (await fetch(url + '/api/world')).json() as WorldStateFull;
  const connect = async () => { socket = io(url, { autoConnect: false, transports: ['websocket'] }); const messages: ServerMessage[] = []; socket.on('message', message => messages.push(message)); socket.connect(); await wait(() => messages.some(message => message.type === 'world_state_full'), 'initial world'); socket.emit('message', { type: 'play_as', data: { agentId: 'neo' } }); await wait(() => messages.some(message => message.type === 'player_state'), 'possession'); return socket; };
  return { expected, world, connect };
}

test('paused courtyard entry keeps the exact ready action through real startup, possession and disconnect', { timeout: 25000 }, async t => {
  const h = await server(t, 'paused'), check = (w: WorldStateFull) => {
    assert.equal(w.simulation!.running, false); assert.equal(Object.keys(w.agents).length, 85);
    for (const key of ['position', 'rotation', 'velocity', 'health', 'currentAction', 'targetPosition', 'currentPath'] as const) assert.deepEqual(w.agents.neo[key], h.expected[key], key);
  };
  check(await h.world()); const socket = await h.connect(), attached = await h.world(); check(attached); socket.disconnect();
  const end = Date.now() + 5000; while ((await h.world()).agents.neo.controller) { assert(Date.now() < end); await new Promise(resolve => setTimeout(resolve, 20)); }
  check(await h.world()); await h.connect(); const reconnected = await h.world(); check(reconnected);
  assert.ok(JSON.stringify(reconnected) === JSON.stringify(attached), 'the complete paused world in the same possession state remains identical without removing fields');
});

for (const variant of ['stale', 'running'] as const) test(`courtyard ${variant} input is cleared instead of being mistaken for a paused saved pose`, { timeout: 25000 }, async t => {
  const h = await server(t, variant), w = await h.world(); assert.equal(w.agents.neo.currentAction, null); assert.equal(w.agents.neo.health, 73); assert.equal(w.sandbox!.neoLife!.journey!.burly!.phase, 'ready');
});

test('ready pose reconnect preserves action metadata while keeping movement and the deliberate Smith start available', () => {
  const world = new WorldState(); new AgentManager(world).initializeAllAgents();
  const dynamics = { record: (event: Omit<WorldEvent, 'id'>) => world.addWorldEvent(event) } as WorldDynamics;
  const sandbox = new SandboxSystem(world, dynamics, 42), conversations = { interrupt() {}, isAgentInConversation: () => false } as unknown as ConversationEngine;
  const players = new PlayerController(world, conversations, { execute() {} } as unknown as ActionExecutor, dynamics, sandbox);
  players.possess('p', 'neo', 0); sandbox.life.begin(world.agents.get('neo')!, 0); sandbox.state.neoLife!.chapter = 1;
  players.sandboxAction('p', { kind: 'life', target: 'film:start' }, 1); players.possess('p', 'neo', 2);
  const state = sandbox.life.film.state!, scene = FILM_SCENE_BY_ID.m2_burly, neo = world.agents.get('neo')!;
  Object.assign(state, { scene: scene.id, actor: 'neo', step: 0, burly: { phase: 'ready', elapsed: 0, attempt: 0, repelled: 0, staffSwings: 0, assimilation: 0, nextCopyAt: 2 } });
  Object.assign(neo, { isInMatrix: true, currentLocation: scene.set, position: filmStepPosition(scene, scene.steps[0]), velocity: { x: 0, y: 0, z: 0 }, currentAction: { type: 'idle', parameters: { player: true, resolved: true, crouching: false, burly: { ...state.burly, role: 'neo' } }, startedAt: 2, duration: 1, progress: 0 } });
  const saved = structuredClone(neo.currentAction); players.release('p', 9); assert.deepEqual(neo.currentAction, saved); players.possess('p', 'neo', 11); assert.deepEqual(neo.currentAction, saved); assert.equal(sandbox.life.film.performing(neo), false);
  const before = { ...neo.position }; players.receiveInput('p', { x: 1, z: 0, yaw: 0, jump: false, sprint: false, sequence: 1 }); players.step(.1, true, 11); assert.ok(Math.hypot(neo.position.x - before.x, neo.position.z - before.z) > .01);
  players.sandboxAction('p', { kind: 'life', target: 'film:act' }, 12); assert.equal(state.burly!.phase, 'approaching');
});
