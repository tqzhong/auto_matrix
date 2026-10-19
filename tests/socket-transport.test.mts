import assert from 'node:assert/strict';
import test, { type TestContext } from 'node:test';
import { createServer } from 'node:http';
import { io } from 'socket.io-client';
import { SocketServer } from '../packages/server/src/network/SocketServer.js';
import { WorldState } from '../packages/server/src/world/WorldState.js';
import { AgentManager } from '../packages/server/src/agents/AgentManager.js';
import type { AgentState, SandboxState, ServerMessage, WorldStateDelta, WorldStateFull } from '@auto_matrix/shared';

test('world updates use compressed wire bytes and a command can complete a round trip', async t => {
  const http = createServer(), server = new SocketServer(http);
  await new Promise<void>(resolve => http.listen(0, '127.0.0.1', resolve));
  const client = io(`http://127.0.0.1:${(http.address() as { port: number }).port}`, { transports: ['websocket'], autoConnect: false });
  t.after(async () => { client.disconnect(); await new Promise<void>(resolve => server.getIO().close(() => resolve())); });
  await new Promise<void>((resolve, reject) => { client.once('connect', resolve); client.once('connect_error', reject); client.connect(); });
  const wire = (client.io.engine.transport as unknown as { ws: { _socket: { bytesRead: number } } }).ws._socket;
  const before = wire.bytesRead;
  const world = new WorldState(); new AgentManager(world).initializeAllAgents();
  const data = { agents: Object.fromEntries(world.agents), dirtyChunks: {}, events: [] };
  const received = new Promise<unknown>(resolve => client.once('message', resolve));
  server.broadcastDelta(data, 1);
  assert.deepEqual((await received as { data: unknown }).data, JSON.parse(JSON.stringify(data)));
  const bytes = wire.bytesRead - before, raw = Buffer.byteLength(JSON.stringify(data));
  assert.ok(bytes < raw / 4, `a ${raw}-byte world update used ${bytes} wire bytes`);
  await new Promise<void>((resolve, reject) => client.timeout(2000).emit('session_ping', (error: Error | null) => error ? reject(error) : resolve()));
});

async function stream(t: TestContext) {
  const http = createServer(), server = new SocketServer(http);
  await new Promise<void>(resolve => http.listen(0, '127.0.0.1', resolve));
  const address = `http://127.0.0.1:${(http.address() as { port: number }).port}`;
  const clients: ReturnType<typeof io>[] = [];
  t.after(async () => { for (const client of clients) client.disconnect(); await new Promise<void>(resolve => server.getIO().close(() => resolve())); });
  const connect = async () => {
    const client = io(address, { transports: ['websocket'], autoConnect: false }), messages: ServerMessage[] = [];
    clients.push(client); client.on('message', message => messages.push(message));
    await new Promise<void>((resolve, reject) => { client.once('connect', resolve); client.once('connect_error', reject); client.connect(); });
    const flush = () => new Promise<void>((resolve, reject) => client.timeout(2000).emit('session_ping', (error: Error | null) => error ? reject(error) : resolve()));
    return { client, messages, flush };
  };
  return { server, connect, ...await connect() };
}

function sandbox(): SandboxState {
  return { version: 1, seed: 1, serial: 0, weather: 'clear', weatherUntil: 0, nextIncidentAt: 0,
    security: 0, corruption: 0, zion: 100, ending: 'open', profiles: {}, nodes: [], structures: [], threats: [], incidents: [], missions: {},
    traffic: { elapsed: 12, cars: [{ distance: 130, speed: 7 }] } };
}

test('a paused world does not repeatedly transmit unchanged characters, traffic or sandbox state', async t => {
  const game = await stream(t), world = new WorldState(); new AgentManager(world).initializeAllAgents();
  const state = sandbox(), delta: WorldStateDelta = { agents: Object.fromEntries(world.agents), dirtyChunks: {}, events: [], sandbox: state };
  game.server.broadcastDelta(delta, 70);
  await game.flush();
  const initial = game.messages[0];
  for (let i = 0; i < 20; i++) game.server.broadcastDelta({ ...delta, traffic: structuredClone(state.traffic) }, 70);
  await game.flush();
  assert.equal(game.messages.length, 1, 'paused 20 Hz updates must not queue duplicate world state');
  assert.deepEqual(initial.data, JSON.parse(JSON.stringify(delta)));
  assert.equal(delta.agents.neo.controller, undefined, 'filtering cannot mutate the authoritative state');
  game.server.broadcastDelta(delta, 71); await game.flush();
  assert.equal(game.messages.length, 2, 'advancing world time is still a meaningful update while characters stand still');
  assert.equal(game.messages.at(-1)!.tick, 71);
});

test('moving snapshots retain their complete cast, including stationary changes, nulls and replaced arrays', async t => {
  const game = await stream(t), world = new WorldState(); new AgentManager(world).initializeAllAgents();
  const neo = world.agents.get('neo')!, smith = world.agents.get('smith')!;
  neo.controller = 'player'; neo.currentPath = [{ x: 10, y: 1, z: 20 }];
  const delta = { agents: { neo, smith }, dirtyChunks: {}, events: [] };
  game.server.broadcastDelta(delta, 1); await game.flush();
  const first = game.messages[0].data as WorldStateDelta, restored = structuredClone(first.agents) as Record<string, AgentState>;
  for (let i = 1; i <= 20; i++) {
    neo.position.x += .25; neo.rotation += .01;
    if (i === 7) { smith.health = 0; smith.status = 'dead'; }
    if (i === 12) { neo.controller = null; neo.currentPath = []; neo.currentAction = null; }
    game.server.broadcastDelta(delta, i + 1); await game.flush();
    const patch = game.messages.at(-1)!.data as WorldStateDelta;
    for (const [id, changed] of Object.entries(patch.agents)) Object.assign(restored[id], changed);
    assert.deepEqual(restored, JSON.parse(JSON.stringify({ neo, smith })), `frame ${i} retains the full character state`);
    assert.deepEqual(patch.agents, JSON.parse(JSON.stringify({ neo, smith })), 'each meaningful update retains the complete cast and its shared poses');
  }
  game.server.broadcastDelta({ agents: { neo: { health: 42 } }, dirtyChunks: {}, events: [] }, 22); await game.flush();
  game.server.broadcastDelta(delta, 23); await game.flush();
  assert.equal((game.messages.at(-1)!.data as WorldStateDelta).agents.neo.health, neo.health, 'a full state must correct an intervening partial patch');
});

test('sandbox and fast traffic updates stay coherent across resets and repeated story events', async t => {
  const game = await stream(t), state = sandbox();
  const base = { agents: {}, dirtyChunks: {}, events: [] };
  game.server.broadcastDelta({ ...base, sandbox: state }, 30); await game.flush();
  const traffic = { elapsed: 13, cars: [{ distance: 138, speed: 8 }] };
  game.server.broadcastDelta({ ...base, traffic }, 30); await game.flush();
  game.server.broadcastDelta({ ...base, sandbox: state }, 30); await game.flush();
  assert.equal((game.messages.at(-1)!.data as WorldStateDelta).sandbox?.traffic?.elapsed, 12, 'a restored world must replace intervening fast traffic');
  game.server.broadcastDelta({ ...base, traffic }, 30); await game.flush();
  assert.deepEqual((game.messages.at(-1)!.data as WorldStateDelta).traffic, traffic, 'the traffic patch must resume from the restored world');
  delete state.traffic;
  game.server.broadcastDelta({ ...base, sandbox: state }, 30); await game.flush();
  const withoutTraffic = game.messages.length;
  game.server.broadcastDelta({ ...base, traffic }, 30); await game.flush();
  assert.equal(game.messages.length, withoutTraffic + 1, 'traffic must be sent again after a snapshot without traffic');
  state.serial++; state.missions.rescue = { status: 'active', stage: 'combat', progress: 1, startedAt: 30 };
  game.server.broadcastDelta({ ...base, sandbox: state }, 30); await game.flush();
  assert.equal((game.messages.at(-1)!.data as WorldStateDelta).sandbox?.missions.rescue.progress, 1, 'same-tick in-place story changes must survive');
  const event = { id: 'same-tick', type: 'anomaly', tick: 30 } as WorldStateDelta['events'][number];
  const count = game.messages.length;
  game.server.broadcastDelta({ ...base, events: [event] }, 30);
  game.server.broadcastDelta({ ...base, events: [event] }, 30); await game.flush();
  assert.equal(game.messages.length, count + 2, 'event deliveries are never treated as cached state');
});

test('joining or resynchronizing a client cannot hide a pending update from another player', async t => {
  const game = await stream(t), world = new WorldState(); new AgentManager(world).initializeAllAgents();
  const neo = world.agents.get('neo')!;
  game.server.broadcastDelta({ agents: { neo }, dirtyChunks: {}, events: [] }, 1); await game.flush();
  const newcomer = await game.connect();
  neo.position.x += 4; neo.health = 73;
  const full: WorldStateFull = { agents: { neo }, chunks: {}, locations: {}, phase: 'phase1_normal', timeOfDay: 7000 };
  game.server.sendFullState(newcomer.client.id!, full, 2); await newcomer.flush();
  assert.deepEqual(newcomer.messages[0].data, JSON.parse(JSON.stringify(full)), 'new connections receive a complete snapshot');
  game.server.broadcastDelta({ agents: { neo }, dirtyChunks: {}, events: [] }, 2); await game.flush(); await newcomer.flush();
  assert.equal((game.messages.at(-1)!.data as WorldStateDelta).agents.neo.health, 73, 'a targeted snapshot must not consume the broadcast changes');
  assert.equal((newcomer.messages.at(-1)!.data as WorldStateDelta).agents.neo.position?.x, neo.position.x);
  game.server.sendFullState(game.client.id!, full, 2); await game.flush();
  assert.deepEqual(game.messages.at(-1)!.data, JSON.parse(JSON.stringify(full)), 'explicit resync remains unconditional');
});
