import assert from 'node:assert/strict';
import test from 'node:test';
import { execFileSync, spawn } from 'node:child_process';
import { readFile, writeFile, rm } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { io } from 'socket.io-client';
import { ZION_MESSAGE, ZION_MESSAGE_ROLES, newZionMessage, zionMessageTrinity, filmPosition, type ServerMessage, type WorldStateFull, type WorldStateDelta, type ZionMessageGesture } from '@auto_matrix/shared';

async function server(t: test.TestContext, phase: 'opening' | 'entering' | 'transfer') {
  const root = fileURLToPath(new URL('../', import.meta.url)), directory = execFileSync(process.execPath, ['--import', 'tsx', 'scripts/film-review-fixture.mts', 'm2_oracle_message'], { cwd: root, encoding: 'utf8' }).trim();
  const file = path.join(directory, 'world.json'), checkpoint = JSON.parse(await readFile(file, 'utf8')), state = newZionMessage(phase === 'transfer' ? 1 : 0), j = checkpoint.sandbox.neoLife.journey;
  Object.assign(state, { phase, elapsed: phase === 'opening' ? 1.2 : phase === 'entering' ? .7 : .4, door: phase === 'opening' ? .4 : 1, owner: phase === 'transfer' ? 'neo' : 'ballard' });
  state.bodies.neo = { ...ZION_MESSAGE.neo }; state.bodies.trinity = zionMessageTrinity(state.door);
  if (phase === 'entering') { state.bodies.ballard = { x: 1.1, z: 17.5, yaw: Math.PI }; state.bodies.malachi = { x: -1.1, z: 18.5, yaw: Math.PI }; state.cursors = { ballard: 1, malachi: 1 }; }
  if (phase === 'transfer') state.bodies.neo.yaw = Math.atan2(state.bodies.ballard.x - state.bodies.neo.x, state.bodies.ballard.z - state.bodies.neo.z);
  j.step = phase === 'transfer' ? 1 : 0; j.zionMessage = state; checkpoint.simulation = { running: false, speed: 1 };
  for (const [index, role] of ZION_MESSAGE_ROLES.entries()) {
    const actor = checkpoint.agents[role], point = state.bodies[role];
    Object.assign(actor, { position: filmPosition('film_zion_bedroom', point.x, point.z), rotation: point.yaw, currentLocation: 'film_zion_bedroom', isInMatrix: false, health: 77 - index * 11,
      velocity: phase === 'opening' && role === 'trinity' ? { x: -1.8, y: 0, z: -.9 } : phase === 'entering' && ['ballard', 'malachi'].includes(role) ? { x: 0, y: 0, z: role === 'ballard' ? -2.8 : -1.8 } : { x: 0, y: 0, z: 0 }, targetPosition: null, currentPath: [] });
    actor.currentAction = { type: Math.hypot(actor.velocity.x, actor.velocity.z) > .01 ? 'move_to' : 'idle', parameters: { player: role === 'neo', resolved: true, zionMessage: { ...structuredClone(state), role } }, startedAt: j.enteredAt, duration: 1e9, progress: 0 };
  }
  j.checkpoint = { ...checkpoint.agents.neo.position }; await writeFile(file, JSON.stringify(checkpoint));
  const expected = structuredClone(checkpoint), child = spawn(process.execPath, ['--import', 'tsx', 'tests/fixtures/server-startup.mts', 'normal'], {
    cwd: root, env: { ...process.env, MATRIX_DATA_DIR: directory, MATRIX_CLOUD_SAVE: '', HOST: '127.0.0.1', PORT: '0', TICK_RATE_MS: '10000', STATE_SYNC_INTERVAL: '1', LLM_API_KEY: '' }, stdio: ['ignore', 'pipe', 'pipe'],
  });
  let output = '', socket: ReturnType<typeof io> | undefined; child.stdout.on('data', data => { output += data; }); child.stderr.on('data', data => { output += data; }); const finished = new Promise(resolve => child.once('close', resolve));
  t.after(async () => { socket?.disconnect(); if (child.exitCode === null && child.signalCode === null) child.kill('SIGTERM');
    const timer = setTimeout(() => { if (child.exitCode === null && child.signalCode === null) child.kill('SIGKILL'); }, 5000);
    try { await finished; } finally { clearTimeout(timer); await rm(directory, { recursive: true, force: true }); }
  });
  const wait = async (ready: () => boolean, label: string) => { const end = Date.now() + 15000; while (!ready()) { assert(child.exitCode === null && child.signalCode === null && Date.now() < end, label + ': ' + output.slice(-1500)); await new Promise(resolve => setTimeout(resolve, 20)); } };
  await wait(() => output.includes('STARTUP_LISTENING'), 'startup'); const address = JSON.parse(output.match(/STARTUP_LISTENING (\{[^\n]+\})/)![1]), url = `http://127.0.0.1:${address.port}`;
  const world = async () => await (await fetch(url + '/api/world')).json() as WorldStateFull;
  const connect = async () => { socket = io(url, { autoConnect: false, transports: ['websocket'] }); const messages: ServerMessage[] = []; socket.on('message', message => messages.push(message)); socket.connect(); await wait(() => messages.some(message => message.type === 'world_state_full'), 'initial state'); socket.emit('message', { type: 'play_as', data: { agentId: 'neo' } }); await wait(() => messages.some(message => message.type === 'player_state' && (message.data as { agentId?: string }).agentId === 'neo'), 'possession'); return { socket, messages }; };
  return { world, connect, expected, wait };
}

for (const phase of ['opening', 'entering', 'transfer'] as const) test(`cold ${phase} retains all participant actions, velocities, wounds and exact prop ownership`, { timeout: 25000 }, async t => {
  const h = await server(t, phase);
  const check = (w: WorldStateFull) => {
    assert.equal(w.simulation!.running, false); assert.equal(w.simulation!.tick, h.expected.tick);
    assert.deepEqual(w.sandbox!.neoLife!.journey!.zionMessage, h.expected.sandbox.neoLife.journey.zionMessage);
    for (const role of ZION_MESSAGE_ROLES) for (const key of ['position', 'rotation', 'velocity', 'health', 'currentAction'] as const) assert.deepEqual(w.agents[role][key], h.expected.agents[role][key], role + '/' + key);
    assert.equal(w.sandbox!.neoLife!.choices.oracle_disk_received, undefined);
  };
  check(await h.world()); const { socket } = await h.connect(); check(await h.world()); socket.disconnect();
  const end = Date.now() + 5000; while ((await h.world()).agents.neo.controller) { assert(Date.now() < end); await new Promise(resolve => setTimeout(resolve, 20)); } check(await h.world());
});

test('fast message packets carry the same door clock and all four actors between slow world ticks', { timeout: 25000 }, async t => {
  const h = await server(t, 'opening'), { socket, messages } = await h.connect(); messages.length = 0; socket.emit('message', { type: 'resume' });
  await h.wait(() => messages.filter(message => message.type === 'world_state_delta' && ((message.data as WorldStateDelta).sandbox?.neoLife?.journey?.zionMessage?.elapsed ?? 0) > 1.2).length >= 6, 'fast message packets');
  const moving = messages.filter(message => message.type === 'world_state_delta').map(message => message.data as WorldStateDelta).filter(packet => (packet.sandbox?.neoLife?.journey?.zionMessage?.elapsed ?? 0) > 1.2);
  assert.ok(moving.length >= 6);
  for (const packet of moving) for (const role of ZION_MESSAGE_ROLES) {
    const gesture = packet.agents[role]?.currentAction?.parameters.zionMessage as ZionMessageGesture | undefined;
    assert.equal(gesture?.elapsed, packet.sandbox!.neoLife!.journey!.zionMessage!.elapsed, role + ': action and room must share one clock');
  }
});
