import assert from 'node:assert/strict';
import test from 'node:test';
import { execFileSync, spawn } from 'node:child_process';
import { readFile, writeFile, rm } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { io } from 'socket.io-client';
import { MOUSE_ROOM_SHOTS, MOUSE_ROOM_RETURN, filmPosition, newAmbushEscape, type ServerMessage, type WorldStateFull, type WorldStateDelta, type CombatImpact } from '@auto_matrix/shared';

const root = fileURLToPath(new URL('../', import.meta.url));
const waitFor = async (ready: () => boolean, label: string) => {
  const end = Date.now() + 15000;
  while (!ready()) { assert.ok(Date.now() < end, label); await new Promise(resolve => setTimeout(resolve, 20)); }
};

test('actual ambush packets publish crew and room clocks before effects, freeze on pause and survive a process restart', { timeout: 30000 }, async t => {
  const directory = execFileSync(process.execPath, ['--import', 'tsx', 'scripts/film-review-fixture.mts', 'm1_dejavu'], { cwd: root, encoding: 'utf8' }).trim();
  const file = path.join(directory, 'world.json'), saved = JSON.parse(await readFile(file, 'utf8'));
  saved.simulation = { running: false, speed: 1 };
  Object.assign(saved.sandbox.neoLife.journey, { step: 1, ambushEscape: { ...newAmbushEscape(), elapsed: 1.05 } });
  saved.agents.neo.position = filmPosition('film_ambush_house', 11, 31.8);
  const crew = ['neo', 'morpheus', 'switch', 'apoc', 'trinity', 'cypher', 'mouse'];
  await writeFile(file, JSON.stringify(saved));
  const stops: (() => Promise<void>)[] = [];
  t.after(async () => { for (const stop of stops) await stop(); await rm(directory, { recursive: true, force: true }); });
  const launch = async () => {
    const child = spawn(process.execPath, ['--import', 'tsx', 'tests/fixtures/server-startup.mts', 'normal'], {
      cwd: root, env: { ...process.env, MATRIX_DATA_DIR: directory, DATABASE_PATH: path.join(directory, 'test.db'), HOST: '127.0.0.1', PORT: '0', TICK_RATE_MS: '10000', STATE_SYNC_INTERVAL: '1', LLM_API_KEY: '' },
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let output = ''; child.stdout.on('data', data => { output += data; }); child.stderr.on('data', data => { output += data; });
    const finished = new Promise<number | null>(resolve => child.once('close', resolve));
    let socket: ReturnType<typeof io> | undefined;
    const stop = async () => {
      socket?.disconnect();
      if (child.exitCode === null && child.signalCode === null) child.kill('SIGTERM');
      const result = await Promise.race([finished, new Promise(resolve => setTimeout(() => resolve('timeout'), 5000).unref())]);
      if (result === 'timeout') { child.kill('SIGKILL'); await finished; }
      assert.equal(result, 0, output);
    };
    stops.push(stop);
    await waitFor(() => output.includes('STARTUP_LISTENING'), 'isolated server did not start');
    const address = JSON.parse(output.match(/STARTUP_LISTENING (\{[^\n]+\})/)![1]), base = `http://127.0.0.1:${address.port}`;
    const packets: { at: number; data: WorldStateDelta }[] = [], effects: { hit: CombatImpact; clock: number; mouse: string; previousType: string }[] = [];
    let state: WorldStateFull | undefined, previousType = '';
    socket = io(base, { autoConnect: false, transports: ['websocket'] });
    socket.on('message', (message: ServerMessage) => {
      if (message.type === 'world_state_full') state = structuredClone(message.data as WorldStateFull);
      else if (message.type === 'world_state_delta' && state) {
        const data = message.data as WorldStateDelta; packets.push({ at: Date.now(), data });
        for (const [id, agent] of Object.entries(data.agents)) state.agents[id] = { ...state.agents[id], ...agent };
        if (data.sandbox) state.sandbox = data.sandbox;
        if (data.simulation) state.simulation = data.simulation;
      } else if (message.type === 'effect') {
        const hit = (message.data as { impact?: CombatImpact }).impact;
        if (hit?.shot && (hit.source === 'mouse' || hit.source.startsWith('film:ambush:room:'))) effects.push({ hit,
          clock: state!.sandbox!.neoLife!.journey!.ambushEscape!.elapsed, mouse: state!.agents.mouse.status, previousType });
      }
      previousType = message.type;
    });
    socket.connect(); await waitFor(() => Boolean(state), 'missing initial snapshot');
    const send = (type: string, data: unknown = {}) => socket!.emit('message', { type, data });
    const world = async () => (await (await fetch(base + '/api/world')).json()) as WorldStateFull;
    return { state: () => state!, packets, effects, send, world, stop, pid: child.pid };
  };
  const h = await launch(); h.send('play_as', { agentId: 'neo' });
  await waitFor(() => Boolean(h.state().agents.neo.controller), 'Neo was not acquired');
  h.send('resume'); await waitFor(() => h.effects.length >= 3, 'saved alarm did not reach its second Mouse shot');
  h.send('pause'); await waitFor(() => h.state().simulation!.running === false, 'alarm did not pause');
  const moving = h.packets.filter(({data}) => {
    const time = data.sandbox?.neoLife?.journey?.ambushEscape?.elapsed; return time !== undefined && time > 1.5 && time < 2.6;
  });
  const times = moving.map(packet => packet.data.sandbox!.neoLife!.journey!.ambushEscape!.elapsed);
  const gaps = moving.slice(1).map((packet, index) => {
    const previous = moving[index], a = previous.data.sandbox!.threats.find(threat => threat.id === 'film:ambush:room:0')!.position;
    const b = packet.data.sandbox!.threats.find(threat => threat.id === 'film:ambush:room:0')!.position;
    return { clock: times[index + 1] - times[index], wall: packet.at - previous.at, distance: Math.hypot(b.x - a.x, b.z - a.z) };
  });
  const shotClocks = (effects: typeof h.effects) => {
    let shots = 0, returns = 0;
    return effects.map(event => ({...event, beat: event.hit.source === 'mouse' ? MOUSE_ROOM_SHOTS[shots++] : MOUSE_ROOM_RETURN[returns++]}));
  };
  t.diagnostic(JSON.stringify({ movingPackets: moving.length, gaps, effects: shotClocks(h.effects).map(event => ({source:event.hit.source,clock:event.clock,beat:event.beat,previousType:event.previousType})) }));
  assert.ok(moving.length >= 8, 'room movement cannot wait for slow world snapshots');
  assert.ok(gaps.every(gap => gap.clock <= .10001 && gap.distance <= .77), 'one packet may not skip more than a bounded 100ms movement step');
  for (const { data } of moving) for (const id of crew) assert.ok(data.agents[id], `${id} must share the exact room-clock packet`);
  for (const event of shotClocks(h.effects)) {
    assert.equal(event.previousType, 'world_state_delta');
    assert.ok(event.clock >= event.beat && event.clock < event.beat + .10001, `effect arrived before its saved pose: ${event.clock} < ${event.beat}`);
  }
  const paused = structuredClone(h.state().sandbox), poses = Object.fromEntries(crew.map(id => [id, structuredClone(h.state().agents[id])])), effectCount = h.effects.length;
  await new Promise(resolve => setTimeout(resolve, 250));
  assert.deepEqual(h.state().sandbox, paused); assert.equal(h.effects.length, effectCount);
  for (const id of crew) assert.deepEqual(h.state().agents[id], poses[id]);
  h.send('leave_character'); await waitFor(() => !h.state().agents.neo.controller, 'Neo was not released');
  const before = await h.world(); await h.stop();
  const cold = await launch(); assert.notEqual(cold.pid, h.pid);
  assert.deepEqual(cold.state().sandbox, before.sandbox); assert.deepEqual(cold.state().agents, before.agents);
  await new Promise(resolve => setTimeout(resolve, 150)); assert.equal(cold.effects.length, 0);
  cold.send('play_as', { agentId: 'neo' }); await waitFor(() => Boolean(cold.state().agents.neo.controller), 'Neo did not reconnect');
  cold.send('resume'); await waitFor(() => cold.state().sandbox!.neoLife!.journey!.ambushEscape!.phase === 'descending', 'alarm did not resume');
  cold.send('pause'); await waitFor(() => cold.state().simulation!.running === false, 'resumed alarm did not pause');
  const all = shotClocks([...h.effects, ...cold.effects]);
  assert.equal(all.length, 9); assert.equal(all.filter(event => event.hit.downed).length, 1);
  for (const event of all) { assert.equal(event.previousType, 'world_state_delta'); assert.ok(event.clock >= event.beat && event.clock < event.beat + .10001); }
  assert.equal(all.find(event => event.hit.downed)!.mouse, 'dead', 'the fatal effect must see the saved death state');
  assert.equal(cold.state().agents.mouse.status, 'dead'); await cold.stop();
});
