import assert from 'node:assert/strict';
import test from 'node:test';
import { execFileSync, spawn } from 'node:child_process';
import { readFile, writeFile, rm } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { io } from 'socket.io-client';
import { dockEvacuationLift, type DockEvacuationGesture, type ServerMessage, type WorldStateDelta } from '@auto_matrix/shared';

test('evacuation packets keep the two actors, lift deck and crew on one saved clock between slow world ticks', { timeout: 30000 }, async t => {
  const root = fileURLToPath(new URL('../', import.meta.url));
  const directory = execFileSync(process.execPath, ['--import', 'tsx', 'scripts/film-review-fixture.mts', 'm3_dock_evacuation'], { cwd: root, encoding: 'utf8' }).trim();
  const file = path.join(directory, 'world.json'), checkpoint = JSON.parse(await readFile(file, 'utf8'));
  checkpoint.simulation = { running: false, speed: 1 };
  Object.assign(checkpoint.sandbox.neoLife.journey, { step: 3, dockEvacuation: { phase: 'lowering', crewAge: 11, remaining: 12, attempts: 0, delivered: true, elapsed: .6 } });
  await writeFile(file, JSON.stringify(checkpoint));
  const child = spawn(process.execPath, ['--import', 'tsx', 'tests/fixtures/server-startup.mts', 'normal'], {
    cwd: root, env: { ...process.env, MATRIX_DATA_DIR: directory, HOST: '127.0.0.1', PORT: '0', TICK_RATE_MS: '10000', STATE_SYNC_INTERVAL: '1', LLM_API_KEY: '' }, stdio: ['ignore', 'pipe', 'pipe'],
  });
  let output = ''; child.stdout.on('data', data => { output += data; }); child.stderr.on('data', data => { output += data; });
  const finished = new Promise(resolve => child.once('close', resolve));
  let socket: ReturnType<typeof io> | undefined;
  t.after(async () => {
    socket?.disconnect(); if (child.exitCode === null && child.signalCode === null) child.kill('SIGTERM');
    if (!await Promise.race([finished.then(() => true), new Promise(resolve => setTimeout(() => resolve(false), 5000).unref())])) { child.kill('SIGKILL'); await finished; }
    await rm(directory, { recursive: true, force: true });
  });
  const waitFor = async (ready: () => boolean, label: string) => {
    const end = Date.now() + 15000;
    while (!ready()) { assert.ok(Date.now() < end, `${label}: ${output}`); await new Promise(resolve => setTimeout(resolve, 20)); }
  };
  await waitFor(() => output.includes('STARTUP_LISTENING'), 'server did not start');
  const address = JSON.parse(output.match(/STARTUP_LISTENING (\{[^\n]+\})/)![1]);
  socket = io(`http://127.0.0.1:${address.port}`, { transports: ['websocket'], autoConnect: false });
  const messages: ServerMessage[] = []; socket.on('message', message => messages.push(message)); socket.connect();
  await waitFor(() => messages.some(message => message.type === 'world_state_full'), 'initial snapshot missing');
  socket.emit('message', { type: 'play_as', data: { agentId: 'kid' } });
  await waitFor(() => messages.some(message => message.type === 'player_state' && (message.data as { agentId?: string }).agentId === 'kid'), 'Kid unavailable');
  messages.length = 0; socket.emit('message', { type: 'resume' });
  await waitFor(() => messages.filter(message => message.type === 'world_state_delta').length >= 6, 'fast packets missing');
  const moving = messages.filter(message => message.type === 'world_state_delta').map(message => message.data as WorldStateDelta)
    .filter(packet => (packet.sandbox?.neoLife?.journey?.dockEvacuation?.elapsed ?? 0) > .6);
  assert.ok(moving.length >= 3, 'the unowned Colt, descending deck and crew wait for the slow world snapshot');
  for (const packet of moving) for (const id of ['kid', 'colt']) {
    const gesture = packet.agents[id]?.currentAction?.parameters.dockEvacuation as DockEvacuationGesture | undefined;
    const state = packet.sandbox!.neoLife!.journey!.dockEvacuation!;
    assert.equal(gesture?.elapsed, state.elapsed);
    const floor = packet.sandbox!.structures.find(item => item.id === 'film:evacuation:floor')!;
    assert.equal(packet.agents[id].position!.y, floor.position.y);
    assert.equal(gesture?.crewAge, state.crewAge);
    assert.ok(dockEvacuationLift(state) < 0);
  }
});
