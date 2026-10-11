import assert from 'node:assert/strict';
import test from 'node:test';
import { execFileSync, spawn } from 'node:child_process';
import { readFile, writeFile, rm } from 'node:fs/promises';
import path from 'node:path';
import { io } from 'socket.io-client';
import { FILM_SCENE_BY_ID, TEMPLE_DEFENSE, filmStepPosition, type ServerMessage, type WorldStateDelta, type TempleDefenseGesture } from '@auto_matrix/shared';

test('fast temple snapshots carry both the falling city and all performed bodies between slow world ticks', { timeout: 30000 }, async t => {
  const directory = execFileSync(process.execPath, ['--import', 'tsx', 'scripts/film-review-fixture.mts', 'm3_temple_breach'], { encoding: 'utf8' }).trim();
  const file = path.join(directory, 'world.json'), checkpoint = JSON.parse(await readFile(file, 'utf8'));
  Object.assign(checkpoint.sandbox.neoLife.journey, { step: 1, templeBreach: { phase: 'breach', elapsed: 1.6 } });
  checkpoint.agents.lock.position = filmStepPosition(FILM_SCENE_BY_ID.m3_temple_breach, FILM_SCENE_BY_ID.m3_temple_breach.steps[1]);
  await writeFile(file, JSON.stringify(checkpoint));
  const child = spawn(process.execPath, ['--import', 'tsx', 'tests/fixtures/server-startup.mts', 'normal'], {
    env: { ...process.env, MATRIX_DATA_DIR: directory, HOST: '127.0.0.1', PORT: '0', TICK_RATE_MS: '10000', STATE_SYNC_INTERVAL: '1', LLM_API_KEY: '' },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let output = ''; child.stdout.on('data', data => { output += data; }); child.stderr.on('data', data => { output += data; });
  const finished = new Promise(resolve => child.once('close', resolve));
  let socket: ReturnType<typeof io> | undefined;
  t.after(async () => {
    socket?.disconnect();
    if (child.exitCode === null && child.signalCode === null) child.kill('SIGTERM');
    if (!await Promise.race([finished.then(() => true), new Promise(resolve => setTimeout(() => resolve(false), 5000).unref())])) {
      child.kill('SIGKILL'); await finished;
    }
    await rm(directory, { recursive: true, force: true });
  });
  const until = async (predicate: () => boolean, message: string, timeout = 5000) => {
    const end = Date.now() + timeout;
    while (!predicate()) { assert.ok(Date.now() < end, message); await new Promise(resolve => setTimeout(resolve, 20)); }
  };
  await until(() => output.includes('STARTUP_LISTENING'), 'isolated server did not start', 15000);
  const address = JSON.parse(output.match(/STARTUP_LISTENING (\{[^\n]+\})/)![1]);
  const messages: ServerMessage[] = [];
  socket = io(`http://127.0.0.1:${address.port}`, { transports: ['websocket'] });
  socket.on('message', message => messages.push(message));
  await until(() => messages.some(m => m.type === 'world_state_full'), 'no initial world snapshot');
  socket.emit('message', { type: 'play_as', data: { agentId: 'lock' } });
  await until(() => messages.some(m => m.type === 'player_state' && (m.data as { agentId?: string }).agentId === 'lock'), 'Lock was not acquired');
  messages.length = 0; socket.emit('message', { type: 'resume' });
  await until(() => messages.filter(m => m.type === 'world_state_delta').length >= 6, 'no fast player packets');
  const moving = messages.filter(m => m.type === 'world_state_delta').map(m => m.data as WorldStateDelta)
    .filter(packet => (packet.sandbox?.neoLife?.journey?.templeBreach?.elapsed ?? 0) > 1.6);
  assert.ok(moving.length >= 3, 'city destruction still waits for the slow world tick');
  for (const packet of moving) for (const role of TEMPLE_DEFENSE.cast) {
    const gesture = packet.agents[role]?.currentAction?.parameters.templeDefense as TempleDefenseGesture | undefined;
    assert.equal(gesture?.elapsed, packet.sandbox!.neoLife!.journey!.templeBreach!.elapsed, `${role}: body is not synchronized with the roof`);
  }
});
