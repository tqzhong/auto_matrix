import assert from 'node:assert/strict';
import test from 'node:test';
import { execFileSync, spawn } from 'node:child_process';
import { readFile, writeFile, rm } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { io } from 'socket.io-client';
import { ZION_ENGINEERING, filmPosition, type EngineeringEncounter, type WorldStateFull } from '@auto_matrix/shared';

const root = fileURLToPath(new URL('../', import.meta.url));
for (const operation of ['readings', 'valve'] as const) test(`a cold paused ${operation} keeps the saved approach/grip action, velocity and device progress through re-entry`, { timeout: 25000 }, async t => {
  const directory = execFileSync(process.execPath, ['--import', 'tsx', 'scripts/film-review-fixture.mts', 'm2_hamann'], { cwd: root, encoding: 'utf8' }).trim();
  const file = path.join(directory, 'world.json'), checkpoint = JSON.parse(await readFile(file, 'utf8'));
  const actor = checkpoint.agents.neo, journey = checkpoint.sandbox.neoLife.journey, point = ZION_ENGINEERING[operation];
  const state: EngineeringEncounter = { readings: operation === 'readings' ? 0 : 1, valve: operation === 'valve' ? .23 : 0,
    elapsed: operation === 'readings' ? .2 : 1.7, operation, approach: { x: point.x + .7, z: point.z + .3, yaw: point.yaw + .4 } };
  journey.step = operation === 'readings' ? 1 : 2; journey.engineering = state;
  actor.position = filmPosition('film_zion_engineering', point.x + (operation === 'readings' ? .4 : 0), point.z);
  actor.velocity = operation === 'readings' ? { x: -.33, y: 0, z: -.19 } : { x: 0, y: 0, z: 0 }; actor.rotation = point.yaw;
  actor.currentAction = { type: operation === 'readings' ? 'move_to' : 'idle', parameters: { player: true, resolved: true, engineering: structuredClone(state) }, startedAt: journey.enteredAt, duration: 1e9, progress: 0 };
  actor.targetPosition = null; actor.currentPath = []; journey.checkpoint = { ...actor.position }; checkpoint.simulation = { running: false, speed: 1 };
  checkpoint.agents.citizen_5.currentAction = { ...actor.currentAction, type: 'attack' };
  await writeFile(file, JSON.stringify(checkpoint)); const expected = structuredClone(actor);
  const child = spawn(process.execPath, ['--import', 'tsx', 'tests/fixtures/server-startup.mts', 'normal'], {
    cwd: root, env: { ...process.env, MATRIX_DATA_DIR: directory, MATRIX_CLOUD_SAVE: '', HOST: '127.0.0.1', PORT: '0', TICK_RATE_MS: '10000', LLM_API_KEY: '' }, stdio: ['ignore', 'pipe', 'pipe'],
  });
  let output = ''; child.stdout.on('data', data => { output += data; }); child.stderr.on('data', data => { output += data; });
  const finished = new Promise(resolve => child.once('close', resolve)); let socket: ReturnType<typeof io> | undefined;
  t.after(async () => {
    socket?.disconnect(); if (child.exitCode === null && child.signalCode === null) child.kill('SIGTERM');
    const timer = setTimeout(() => { if (child.exitCode === null && child.signalCode === null) child.kill('SIGKILL'); }, 5000);
    try { await finished; } finally { clearTimeout(timer); await rm(directory, { recursive: true, force: true }); }
  });
  const end = Date.now() + 15000;
  while (!output.includes('STARTUP_LISTENING')) {
    assert(child.exitCode === null && child.signalCode === null && Date.now() < end, output.slice(-1500)); await new Promise(resolve => setTimeout(resolve, 20));
  }
  const address = JSON.parse(output.match(/STARTUP_LISTENING (\{[^\n]+\})/)![1]), url = `http://127.0.0.1:${address.port}`;
  const world = async () => await (await fetch(url + '/api/world')).json() as WorldStateFull;
  const check = (w: WorldStateFull) => {
    assert.equal(w.simulation!.running, false); assert.equal(w.simulation!.tick, checkpoint.tick);
    assert.deepEqual(w.agents.neo.currentAction, expected.currentAction); assert.deepEqual(w.agents.neo.position, expected.position);
    assert.deepEqual(w.agents.neo.velocity, expected.velocity); assert.equal(w.agents.neo.rotation, expected.rotation);
    assert.deepEqual(w.sandbox!.neoLife!.journey!.engineering, state); assert.deepEqual(w.sandbox!.neoLife!.journey!.completed, journey.completed);
    assert.equal(w.sandbox!.neoLife!.money, checkpoint.sandbox.neoLife.money); assert.equal(w.agents.citizen_5.currentAction, null, 'another player action must still be cleared');
  };
  check(await world()); socket = io(url, { autoConnect: false, transports: ['websocket'] });
  const connected = new Promise<void>((resolve, reject) => { socket!.once('connect', resolve); socket!.once('connect_error', reject); }); socket.connect(); await connected;
  socket.emit('message', { type: 'play_as', data: { agentId: 'neo' } }); const joined = Date.now() + 5000;
  while (!(await world()).agents.neo.controller) { assert(Date.now() < joined, 're-entry timed out'); await new Promise(resolve => setTimeout(resolve, 20)); }
  check(await world()); socket.disconnect(); const left = Date.now() + 5000;
  while ((await world()).agents.neo.controller) { assert(Date.now() < left, 'disconnect timed out'); await new Promise(resolve => setTimeout(resolve, 20)); }
  check(await world());
});
