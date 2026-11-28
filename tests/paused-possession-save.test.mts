import assert from 'node:assert/strict';
import test from 'node:test';
import { execFileSync, spawn } from 'node:child_process';
import { readFile, writeFile, rm } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { io } from 'socket.io-client';
import { filmPosition, newAmbushEscape, type WorldStateFull } from '@auto_matrix/shared';
import type { WorldCheckpoint } from '../packages/server/src/world/CheckpointStore.js';

const root = fileURLToPath(new URL('../', import.meta.url));

test('a paused native possession retry is saved before any tick or graceful shutdown', { timeout: 30000 }, async t => {
  const directory = execFileSync(process.execPath, ['--import', 'tsx', 'scripts/film-review-fixture.mts', 'm1_dejavu'], { cwd: root, encoding: 'utf8' }).trim();
  const processes: { child: ReturnType<typeof spawn>; finished: Promise<number | null> }[] = [];
  const sockets: ReturnType<typeof io>[] = [];
  t.after(async () => {
    for (const socket of sockets) socket.disconnect();
    for (const { child, finished } of processes) {
      if (child.exitCode === null && child.signalCode === null) child.kill('SIGKILL');
      await finished;
    }
    await rm(directory, { recursive: true, force: true });
  });
  const file = path.join(directory, 'world.json');
  const checkpoint = JSON.parse(await readFile(file, 'utf8')) as WorldCheckpoint;
  const journey = checkpoint.sandbox!.neoLife!.journey!, neo = checkpoint.agents.neo;
  checkpoint.tick = 1343; checkpoint.simulation = { running: false, speed: 1 };
  journey.step = 1; journey.ambush = { elapsed: 14.8 };
  journey.ambushEscape = { ...newAmbushEscape(), phase: 'failed', mouseDead: true, caught: .838 };
  journey.reflections = { 'm1_oracle:1': 'agency' };
  neo.position = filmPosition('film_ambush_house', 11, 31.8); journey.checkpoint = { ...neo.position };
  neo.health = 0; neo.status = 'dead'; delete neo.controller;
  checkpoint.agents.mouse.health = 0; checkpoint.agents.mouse.status = 'dead';
  await writeFile(file, JSON.stringify(checkpoint));

  const start = async () => {
    const child = spawn(process.execPath, ['--import', 'tsx', 'tests/fixtures/server-startup.mts', 'normal'], {
      cwd: root, env: { ...process.env, MATRIX_DATA_DIR: directory, MATRIX_CLOUD_SAVE: '', HOST: '127.0.0.1', PORT: '0', TICK_RATE_MS: '10000', LLM_API_KEY: '' },
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let output = '';
    child.stdout.on('data', data => { output += data; }); child.stderr.on('data', data => { output += data; });
    const finished = new Promise<number | null>(resolve => child.once('close', resolve));
    processes.push({ child, finished });
    const deadline = Date.now() + 15000;
    while (!output.includes('STARTUP_LISTENING')) {
      assert.ok(child.exitCode === null && child.signalCode === null && Date.now() < deadline, `server did not start: ${output}`);
      await new Promise(resolve => setTimeout(resolve, 20));
    }
    const address = JSON.parse(output.match(/STARTUP_LISTENING (\{[^\n]+\})/)![1]);
    const base = `http://127.0.0.1:${address.port}`;
    const world = async () => await (await fetch(`${base}/api/world`)).json() as WorldStateFull;
    return { child, finished, base, world };
  };
  const server = await start();
  assert.equal((await server.world()).agents.neo.health, 0);
  const socket = io(server.base, { autoConnect: false, transports: ['websocket'] }); sockets.push(socket);
  const connected = new Promise<void>((resolve, reject) => { socket.once('connect', resolve); socket.once('connect_error', reject); });
  socket.connect(); await connected;
  // The native death/landing button uses play_as, rather than sandbox_action film:retry.
  socket.emit('message', { type: 'play_as', data: { agentId: 'neo', takeover: true } });
  let live = await server.world();
  const deadline = Date.now() + 5000;
  while (live.agents.neo.health !== 100) {
    assert.ok(Date.now() < deadline, 'the native retry must revive Neo while paused');
    await new Promise(resolve => setTimeout(resolve, 20)); live = await server.world();
  }
  const recovered = live.sandbox!.neoLife!.journey!;
  assert.equal(live.simulation!.running, false); assert.equal(live.simulation!.tick, checkpoint.tick);
  assert.equal(recovered.ambushEscape!.phase, 'descending'); assert.equal(recovered.ambushEscape!.attempts, 1);
  const savedDeadline = Date.now() + 3000;
  let saved = JSON.parse(await readFile(file, 'utf8')) as WorldCheckpoint;
  while (saved.agents.neo.health !== 100) {
    assert.ok(Date.now() < savedDeadline, 'paused play_as retry must reach disk before a tick or shutdown');
    await new Promise(resolve => setTimeout(resolve, 20)); saved = JSON.parse(await readFile(file, 'utf8')) as WorldCheckpoint;
  }
  assert.deepEqual(saved.sandbox!.neoLife!.journey!.ambushEscape, recovered.ambushEscape);
  assert.equal(saved.simulation!.running, false); assert.equal(saved.tick, checkpoint.tick);

  server.child.kill('SIGKILL'); await server.finished;
  const restored = await (await start()).world();
  assert.equal(restored.simulation!.running, false); assert.equal(restored.simulation!.tick, checkpoint.tick);
  assert.equal(restored.agents.neo.health, 100); assert.equal(restored.agents.neo.status, 'alive');
  assert.equal(restored.agents.mouse.health, 0); assert.equal(restored.agents.mouse.status, 'dead');
  assert.deepEqual(restored.sandbox!.neoLife!.journey!.ambushEscape, recovered.ambushEscape);
  assert.deepEqual(restored.sandbox!.neoLife!.journey!.completed, journey.completed);
  assert.deepEqual(restored.sandbox!.neoLife!.journey!.reflections, journey.reflections);
});
