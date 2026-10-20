import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { createServer as tcpServer, connect } from 'node:net';
import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { gzipSync } from 'node:zlib';
import { io } from 'socket.io-client';
import { SocketServer } from '../../../packages/server/src/network/SocketServer.js';

const source = new URL('../matrixai-input-2026-10-20/running-samples.json', import.meta.url);
const capturedBytes = await readFile(source), captured = JSON.parse(capturedBytes.toString('utf8'))[0].data;
const messages: object[] = [];
const world = structuredClone(captured);
for (let i = 1; i <= 200; i++) {
  world.agents.neo.position.x += .03; world.sandbox.traffic.elapsed += .05;
  messages.push(JSON.parse(JSON.stringify({ type: 'world_state_delta', tick: i, timestamp: 1792500000000 + i * 50,
    data: { agents: { neo: world.agents.neo }, dirtyChunks: {}, events: [], traffic: world.sandbox.traffic,
      ...(i % 10 === 0 ? { sandbox: world.sandbox } : {}) } })));
}
const encodeMs: number[] = [], decodeMs: number[] = [];
let rawBytes = 0, gzipBytes = 0;
for (const message of messages) {
  const started = performance.now(), text = JSON.stringify(message), packed = gzipSync(text, { level: 1 });
  encodeMs.push(performance.now() - started);
  const decodeStarted = performance.now();
  const stream = new Blob([packed]).stream().pipeThrough(new DecompressionStream('gzip'));
  const decoded = await new Response(stream).json();
  decodeMs.push(performance.now() - decodeStarted);
  assert.deepEqual(decoded, message);
  rawBytes += Buffer.byteLength(text); gzipBytes += packed.byteLength;
}
const percentile = (values: number[], q: number) => [...values].sort((a, b) => a - b)[Math.min(values.length - 1, Math.floor(values.length * q))];
async function measure(compressed: boolean) {
  const http = createServer(), server = new SocketServer(http);
  await new Promise<void>(resolve => http.listen(0, '127.0.0.1', resolve));
  const peers = new Set<import('node:net').Socket>();
  let peakQueued = 0, transmitted = 0, generated = 0, tick = 0;
  const proxy = tcpServer(down => {
    const up = connect((http.address() as { port: number }).port, '127.0.0.1');
    peers.add(down); peers.add(up); down.pipe(up); let queue = Buffer.alloc(0);
    up.on('data', data => { generated += data.length; queue = Buffer.concat([queue, data]); peakQueued = Math.max(peakQueued, queue.length); });
    const timer = setInterval(() => {
      if (!queue.length || down.destroyed) return;
      const chunk = queue.subarray(0, 1600); down.write(chunk); transmitted += chunk.length; queue = queue.subarray(chunk.length);
    }, 50);
    down.on('close', () => { clearInterval(timer); up.destroy(); });
    up.on('error', () => down.destroy()); down.on('error', () => up.destroy());
  });
  await new Promise<void>(resolve => proxy.listen(0, '127.0.0.1', resolve));
  const client = io(`http://127.0.0.1:${(proxy.address() as { port: number }).port}`, {
    transports: ['websocket'], perMessageDeflate: false, reconnection: false, autoConnect: false,
    auth: { stateAcknowledgements: true, stateCompression: compressed ? 'gzip' : undefined },
  });
  const ages: number[] = [], ticks: number[] = [];
  let incoming = Promise.resolve();
  client.on('message', (message, receipt) => {
    incoming = incoming.then(async () => {
      if (Buffer.isBuffer(message)) message = await new Response(new Blob([message]).stream().pipeThrough(new DecompressionStream('gzip'))).json();
      ages.push(Date.now() - message.timestamp); ticks.push(message.tick); receipt?.();
    });
  });
  let timer: ReturnType<typeof setInterval> | undefined;
  try {
    await new Promise<void>((resolve, reject) => { client.once('connect', resolve); client.once('connect_error', reject); client.connect(); });
    const value = structuredClone(captured);
    timer = setInterval(() => {
      tick++; value.agents.neo.position.x += .03; value.sandbox.traffic.elapsed += .05;
      server.broadcastDelta({ agents: { neo: value.agents.neo }, dirtyChunks: {}, events: [], traffic: value.sandbox.traffic,
        ...(tick % 10 === 0 ? { sandbox: value.sandbox } : {}) }, tick);
    }, 50);
    await new Promise(resolve => setTimeout(resolve, 5000));
    const started = performance.now();
    const roundTripMs = await new Promise<number | null>(resolve => client.timeout(4000).emit('session_ping', error => resolve(error ? null : performance.now() - started)));
    await incoming;
    return { compressed, bandwidthBytesPerSecond: 32000, producedStates: tick, receivedStates: ticks.length,
      lastReceivedTick: ticks.at(-1), latestStateAgeMs: ages.at(-1), medianStateAgeMs: percentile(ages, .5),
      peakQueuedBytes: peakQueued, generatedWireBytes: generated, transmittedWireBytes: transmitted, roundTripMs };
  } finally {
    clearInterval(timer); client.disconnect(); for (const peer of peers) peer.destroy();
    await new Promise<void>(resolve => server.getIO().close(() => resolve()));
    await new Promise<void>(resolve => proxy.close(() => resolve()));
  }
}
const result = { sourceSha256: createHash('sha256').update(capturedBytes).digest('hex'), statesCompared: messages.length,
  fixedSequence: { rawBytes, gzipBytes, ratio: gzipBytes / rawBytes,
    encodeMilliseconds: { median: percentile(encodeMs, .5), p95: percentile(encodeMs, .95), max: Math.max(...encodeMs) },
    decodeMilliseconds: { median: percentile(decodeMs, .5), p95: percentile(decodeMs, .95), max: Math.max(...decodeMs) } },
  limitedConnection: [await measure(false), await measure(true)],
  scope: 'Same captured world, 20 Hz moving Neo and traffic, full sandbox every tenth frame. Node Web Streams decoding, not a browser FPS measurement. No production requests.' };
await writeFile(new URL('./compression-measurement.json', import.meta.url), JSON.stringify(result, null, 2) + '\n');
console.log(JSON.stringify(result, null, 2));
