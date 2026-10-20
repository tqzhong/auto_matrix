import assert from 'node:assert/strict';
import { test, type TestContext } from 'node:test';
import { createServer } from 'node:http';
import { gzipSync } from 'node:zlib';
import { Server, type Socket } from 'socket.io';
import { SocketClient, type SocketCallbacks } from '../packages/client/src/network/SocketClient.js';
import { SocketServer } from '../packages/server/src/network/SocketServer.js';

async function waitFor(check: () => boolean) {
  const deadline = Date.now() + 4000;
  while (!check() && Date.now() < deadline) await new Promise(resolve => setTimeout(resolve, 10));
  assert.ok(check(), 'expected socket event before timeout');
}

async function setup(t: TestContext, replyToPing = true, deferSnapshot = false, compressed = false) {
  const http = createServer(), transport = compressed ? new SocketServer(http) : undefined;
  const server = transport?.getIO() ?? new Server(http);
  await new Promise<void>(resolve => http.listen(0, '127.0.0.1', resolve));
  const address = http.address() as { port: number };
  const previousLocation = Object.getOwnPropertyDescriptor(globalThis, 'location');
  Object.assign(globalThis, { location: new URL(`http://127.0.0.1:${address.port}`) });
  const messages: { type: string; data: { agentId?: string; takeover?: boolean } }[] = [];
  const states: { agentId?: string | null; message?: string }[] = [];
  const health: string[] = [];
  const wires: Socket[] = [], applied: string[] = []; let snapshots = 0;
  const callbacks: SocketCallbacks = {
    onHealth: status => health.push(status),
    onPlayerState: data => { states.push(data); applied.push(`player:${data.agentId}`); },
    onWorldStateFull: (_data, tick) => { snapshots++; applied.push(`full:${tick}`); },
    onWorldStateDelta: (_data, tick) => { applied.push(`delta:${tick}`); }, onAgentUpdate() {}, onConversationStart() {}, onConversationMessage() {},
    onConversationEnd() {}, onConversationSummary() {}, onStoryEvent() {}, onPhaseChange() {},
    onEffect() {}, onChatBubble() {}, onNotification: data => { applied.push(`notification:${data.message}`); }, onEvolutionUpdate() {}, onEvolutionNarration() {},
  };
  server.on('connection', socket => {
    wires.push(socket);
    socket.on('session_ping', reply => { if (replyToPing) reply(); });
    socket.on('message', message => {
      messages.push(message);
      if (message.type === 'play_as') socket.emit('message', { type: 'player_state', data: { agentId: message.data.agentId }, tick: 1 });
      if (message.type === 'leave_character') socket.emit('message', { type: 'player_state', data: { agentId: null }, tick: 1 });
    });
    if (!deferSnapshot) {
      if (transport) transport.sendFullState(socket.id, { agents: {}, chunks: {}, locations: {}, phase: 'phase1_normal', timeOfDay: 7500 }, 1);
      else socket.emit('message', { type: 'world_state_full', data: { agents: {}, chunks: {}, locations: {}, phase: 'phase1_normal', timeOfDay: 7500 }, tick: 1 });
    }
  });
  const client = new SocketClient(callbacks);
  t.after(async () => {
    client.dispose();
    await new Promise<void>(resolve => server.close(() => resolve()));
    if (previousLocation) Object.defineProperty(globalThis, 'location', previousLocation);
    else Reflect.deleteProperty(globalThis, 'location');
  });
  client.connect(); await waitFor(() => deferSnapshot ? wires.length === 1 : snapshots === 1);
  return { client, messages, states, wires, health, applied, transport, snapshots: () => snapshots };
}

test('a standby connection stays connecting until the handed-over world arrives', async t => {
  const game = await setup(t, true, true);
  await waitFor(() => game.health.length >= 3);
  assert.equal(game.health.at(-1), 'connecting');
  assert.equal(game.health.includes('ready'), false);
  game.wires[0].emit('message', { type: 'world_state_full', data: { agents: {}, chunks: {}, locations: {}, phase: 'phase1_normal', timeOfDay: 7500 }, tick: 42 });
  await waitFor(() => game.health.at(-1) === 'ready');
});

test('connected transport is not reported ready until a server round trip succeeds', async t => {
  const game = await setup(t);
  await waitFor(() => game.health.includes('ready'));
  assert.equal(game.health[0], 'connecting');
  game.client.reconnect();
  await waitFor(() => game.snapshots() === 2);
  await waitFor(() => game.health.at(-1) === 'ready');
  assert.ok(game.health.includes('offline'));
});

test('the client acknowledges world state only after applying it', async t => {
  const game = await setup(t, true, true);
  assert.equal(game.wires[0].handshake.auth.stateAcknowledgements, true);
  const receipt = new Promise<void>((resolve, reject) => game.wires[0].timeout(2000).emit('message', {
    type: 'world_state_full', data: { agents: {}, chunks: {}, locations: {}, phase: 'phase1_normal', timeOfDay: 7500 }, tick: 42,
  }, (error: Error | null) => { if (error) { reject(error); return; } assert.equal(game.snapshots(), 1); resolve(); }));
  await receipt;
  await new Promise<void>((resolve, reject) => game.wires[0].timeout(2000).emit('message', {
    type: 'world_state_delta', data: { agents: {}, dirtyChunks: {}, events: [] }, tick: 43,
  }, (error: Error | null) => error ? reject(error) : resolve()));
});

test('a one-way connection is shown as slow instead of ready', async t => {
  const game = await setup(t, false);
  await new Promise(resolve => setTimeout(resolve, 4200));
  assert.equal(game.client.isConnected, true);
  assert.equal(game.health.at(-1), 'slow');
  assert.equal(game.health.includes('ready'), false);
});

test('a temporary disconnect resumes the last confirmed character after the new world snapshot', async t => {
  const game = await setup(t);
  game.client.send('play_as', { agentId: 'neo', takeover: true });
  await waitFor(() => game.states.length === 1);
  game.wires[0].conn.close();
  await waitFor(() => game.snapshots() === 2);
  await waitFor(() => game.states.length === 2);
  assert.deepEqual(game.messages.filter(message => message.type === 'play_as'), [
    { type: 'play_as', data: { agentId: 'neo', takeover: true } },
    { type: 'play_as', data: { agentId: 'neo' } },
  ], 'automatic reconnect must not take a character back from another page');
});

test('a replaced page stops resuming its old character, including after a reconnect', async t => {
  const game = await setup(t);
  game.client.send('play_as', { agentId: 'neo', takeover: true });
  await waitFor(() => game.states.length === 1);
  game.wires[0].emit('message', { type: 'player_state', data: { agentId: null, message: '已在另一页面继续。' }, tick: 2 });
  await waitFor(() => game.states.length === 2);
  game.wires[0].conn.close();
  await waitFor(() => game.snapshots() === 2);
  game.client.requestFullState();
  await waitFor(() => game.messages.some(message => message.type === 'request_full_state'));
  assert.equal(game.messages.filter(message => message.type === 'play_as').length, 1);
});

test('explicitly leaving while offline cancels automatic character restoration', async t => {
  const game = await setup(t);
  game.client.send('play_as', { agentId: 'neo', takeover: true });
  await waitFor(() => game.states.length === 1);
  game.wires[0].conn.close(); await waitFor(() => !game.client.isConnected);
  game.client.send('leave_character');
  await waitFor(() => game.snapshots() === 2);
  game.client.requestFullState();
  await waitFor(() => game.messages.some(message => message.type === 'request_full_state'));
  assert.equal(game.messages.filter(message => message.type === 'play_as').length, 1);
});

test('gzip state, role assignment and ordinary messages are applied in wire order before acknowledging', async t => {
  const game = await setup(t, true, true);
  // Match the browser transport; Node otherwise delivers Buffer objects.
  game.client['socket']!.io.engine.binaryType = 'arraybuffer';
  assert.equal(game.wires[0].handshake.auth.stateCompression, 'gzip');
  const full = { type: 'world_state_full', data: { agents: {}, chunks: {}, locations: {}, phase: 'phase1_normal', timeOfDay: 7500 }, tick: 42 };
  const delta = { type: 'world_state_delta', data: { agents: {}, dirtyChunks: {}, events: [] }, tick: 43 };
  const receipt = new Promise<void>((resolve, reject) => game.wires[0].timeout(2000).emit('message', gzipSync(JSON.stringify(full)),
    (error: Error | null) => { if (error) { reject(error); return; } assert.equal(game.applied[0], 'full:42'); resolve(); }));
  game.wires[0].emit('message', { type: 'player_state', data: { agentId: 'neo' }, tick: 42 });
  game.wires[0].emit('message', gzipSync(JSON.stringify(delta)));
  game.wires[0].emit('message', { type: 'notification', data: { message: '已到达出口' }, tick: 43 });
  await receipt; await waitFor(() => game.applied.length === 4);
  assert.deepEqual(game.applied, ['full:42', 'player:neo', 'delta:43', 'notification:已到达出口']);
});

test('a browser without DecompressionStream keeps the ordinary state protocol', async t => {
  const descriptor = Object.getOwnPropertyDescriptor(globalThis, 'DecompressionStream')!;
  Object.defineProperty(globalThis, 'DecompressionStream', { configurable: true, writable: true, value: undefined });
  t.after(() => Object.defineProperty(globalThis, 'DecompressionStream', descriptor));
  const game = await setup(t);
  assert.notEqual(game.wires[0].handshake.auth.stateCompression, 'gzip');
  await waitFor(() => game.health.includes('ready'));
  game.client.send('play_as', { agentId: 'neo' });
  await waitFor(() => game.states.length === 1);
});

test('corrupt compressed state reconnects using ordinary snapshots and restores the confirmed character', async t => {
  const game = await setup(t);
  game.client.send('play_as', { agentId: 'neo' });
  await waitFor(() => game.states.length === 1);
  let acknowledged = false;
  game.wires[0].emit('message', Buffer.from('invalid gzip'), () => { acknowledged = true; });
  await waitFor(() => game.wires.length === 2 && game.snapshots() === 2 && game.states.length === 2);
  assert.equal(acknowledged, false, 'a corrupt frame must never be acknowledged as applied');
  assert.notEqual(game.wires[1].handshake.auth.stateCompression, 'gzip');
  assert.deepEqual(game.messages.filter(message => message.type === 'play_as'), [
    { type: 'play_as', data: { agentId: 'neo' } }, { type: 'play_as', data: { agentId: 'neo' } },
  ]);
});

test('a disconnect discards an in-flight decompression without delaying the new connection', async t => {
  const game = await setup(t), Original = globalThis.DecompressionStream;
  let release!: () => void, decoding = false, finished = false;
  const gate = new Promise<void>(resolve => { release = resolve; });
  t.after(release);
  t.mock.method(globalThis, 'DecompressionStream', function(format: CompressionFormat) {
    const stream = new Original(format);
    return { writable: stream.writable, readable: stream.readable.pipeThrough(new TransformStream({
      async transform(chunk, controller) { decoding = true; await gate; controller.enqueue(chunk); },
      flush() { finished = true; },
    })) };
  });
  let acknowledged = false;
  game.wires[0].emit('message', gzipSync(JSON.stringify({ type: 'world_state_delta', data: { agents: {}, dirtyChunks: {}, events: [] }, tick: 999 })),
    () => { acknowledged = true; });
  await waitFor(() => decoding);
  game.client.reconnect();
  await waitFor(() => game.snapshots() === 2);
  release(); await waitFor(() => finished);
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(acknowledged, false);
  assert.equal(game.applied.includes('delta:999'), false, 'an old decoded pose must not overwrite the reconnected world');
  assert.deepEqual(game.applied, ['full:1', 'full:1']);
});

test('the real compressed client and server resume a role and continue updates after reconnecting', async t => {
  const game = await setup(t, true, false, true);
  game.client.send('play_as', { agentId: 'neo', takeover: true });
  await waitFor(() => game.states.length === 1);
  game.transport!.broadcastDelta({ agents: {}, dirtyChunks: {}, events: [] }, 40);
  await waitFor(() => game.applied.includes('delta:40'));
  game.wires[0].conn.close();
  await waitFor(() => game.snapshots() === 2 && game.states.length === 2);
  assert.equal(game.wires[1].handshake.auth.stateCompression, 'gzip');
  assert.deepEqual(game.messages.filter(message => message.type === 'play_as'), [
    { type: 'play_as', data: { agentId: 'neo', takeover: true } }, { type: 'play_as', data: { agentId: 'neo' } },
  ]);
  game.transport!.broadcastDelta({ agents: {}, dirtyChunks: {}, events: [] }, 41);
  await waitFor(() => game.applied.includes('delta:41'));
  assert.deepEqual(game.applied, ['full:1', 'player:neo', 'delta:40', 'full:1', 'player:neo', 'delta:41']);
});
