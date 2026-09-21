import assert from 'node:assert/strict';
import { test, type TestContext } from 'node:test';
import { createServer } from 'node:http';
import { Server, type Socket } from 'socket.io';
import { SocketClient, type SocketCallbacks } from '../packages/client/src/network/SocketClient.js';

async function waitFor(check: () => boolean) {
  const deadline = Date.now() + 4000;
  while (!check() && Date.now() < deadline) await new Promise(resolve => setTimeout(resolve, 10));
  assert.ok(check(), 'expected socket event before timeout');
}

async function setup(t: TestContext) {
  const http = createServer(); const server = new Server(http);
  await new Promise<void>(resolve => http.listen(0, '127.0.0.1', resolve));
  const address = http.address() as { port: number };
  const previousLocation = Object.getOwnPropertyDescriptor(globalThis, 'location');
  Object.assign(globalThis, { location: new URL(`http://127.0.0.1:${address.port}`) });
  const messages: { type: string; data: { agentId?: string; takeover?: boolean } }[] = [];
  const states: { agentId?: string | null; message?: string }[] = [];
  const wires: Socket[] = []; let snapshots = 0;
  const callbacks: SocketCallbacks = {
    onPlayerState: data => states.push(data), onWorldStateFull: () => { snapshots++; },
    onWorldStateDelta() {}, onAgentUpdate() {}, onConversationStart() {}, onConversationMessage() {},
    onConversationEnd() {}, onConversationSummary() {}, onStoryEvent() {}, onPhaseChange() {},
    onEffect() {}, onChatBubble() {}, onNotification() {}, onEvolutionUpdate() {}, onEvolutionNarration() {},
  };
  server.on('connection', socket => {
    wires.push(socket);
    socket.on('message', message => {
      messages.push(message);
      if (message.type === 'play_as') socket.emit('message', { type: 'player_state', data: { agentId: message.data.agentId }, tick: 1 });
      if (message.type === 'leave_character') socket.emit('message', { type: 'player_state', data: { agentId: null }, tick: 1 });
    });
    socket.emit('message', { type: 'world_state_full', data: { agents: {}, chunks: {}, locations: {}, phase: 'phase1_normal', timeOfDay: 7500 }, tick: 1 });
  });
  const client = new SocketClient(callbacks);
  t.after(async () => {
    client.dispose();
    await new Promise<void>(resolve => server.close(() => resolve()));
    if (previousLocation) Object.defineProperty(globalThis, 'location', previousLocation);
    else Reflect.deleteProperty(globalThis, 'location');
  });
  client.connect(); await waitFor(() => snapshots === 1);
  return { client, messages, states, wires, snapshots: () => snapshots };
}

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
