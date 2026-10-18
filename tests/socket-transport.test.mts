import assert from 'node:assert/strict';
import test from 'node:test';
import { createServer } from 'node:http';
import { io } from 'socket.io-client';
import { SocketServer } from '../packages/server/src/network/SocketServer.js';
import { WorldState } from '../packages/server/src/world/WorldState.js';
import { AgentManager } from '../packages/server/src/agents/AgentManager.js';

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
