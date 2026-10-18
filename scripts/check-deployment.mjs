import assert from 'node:assert/strict';
import { readdir, readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { io } from 'socket.io-client';

const origin = new URL(process.argv[2] ?? 'https://matrixai.online');
assert.equal(origin.protocol, 'https:', 'Verify the published HTTPS site.');
assert.equal(origin.pathname, '/');
assert.ok(!origin.username && !origin.password && !origin.search && !origin.hash);
const publicDirectory = fileURLToPath(new URL('../packages/client/public/', import.meta.url));
const request = (url, options = {}) => fetch(new URL(url, origin), { ...options, signal: AbortSignal.timeout(15000) });

const page = await request('/');
assert.equal(page.status, 200, 'game page');
const html = await page.text();
assert.match(html, /<div id="app"><\/div>/);
const entry = html.match(/<script[^>]+src="([^"]+)"/);
assert.ok(entry && entry[1].startsWith('/assets/'), 'serve the production client');
assert.equal((await request(entry[1])).status, 200, 'client bundle');
const statusResponse = await request('/api/status');
assert.equal(statusResponse.status, 200, 'server status');
const status = await statusResponse.json();
assert.ok(status.agentCount > 0 && Number.isFinite(status.tick), 'initialized world');

const socket = io(origin.origin, { autoConnect: false, transports: ['websocket'], reconnection: false, timeout: 15000 });
try {
  const world = await new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error('No live world snapshot within 15 seconds')), 15000);
    socket.once('connect_error', error => { clearTimeout(timeout); reject(error); });
    socket.on('message', message => {
      if (message.type !== 'world_state_full') return;
      clearTimeout(timeout); resolve(message.data);
    });
    socket.connect();
  });
  assert.ok(world.agents?.neo && world.agents?.trinity, 'Socket.IO sends playable characters');
  console.log(`HTTPS and WebSocket ready: ${status.agentCount} characters, tick ${status.tick}, mode ${status.mode}`);
} finally { socket.disconnect(); }

async function assets(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const file = path.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...await assets(file));
    else if (entry.isFile()) files.push(file);
  }
  return files;
}

const files = await assets(publicDirectory);
for (let offset = 0; offset < files.length; offset += 6) {
  await Promise.all(files.slice(offset, offset + 6).map(async file => {
    const asset = `/${path.relative(publicDirectory, file).split(path.sep).map(encodeURIComponent).join('/')}`;
    const response = await request(asset, { method: 'HEAD', headers: { 'Accept-Encoding': 'identity' } });
    assert.equal(response.status, 200, asset);
    assert.equal(Number(response.headers.get('content-length')), (await stat(file)).size, `asset size: ${asset}`);
  }));
}
for (const extension of ['.glb', '.mp3']) {
  const file = files.find(file => file.endsWith(extension));
  assert.ok(file, `missing local ${extension} asset`);
  const asset = `/${path.relative(publicDirectory, file).split(path.sep).map(encodeURIComponent).join('/')}`;
  const response = await request(asset, { headers: { Range: 'bytes=0-63', 'Accept-Encoding': 'identity' } });
  assert.equal(response.status, 206, `range download: ${asset}`);
  assert.deepEqual(Buffer.from(await response.arrayBuffer()), (await readFile(file)).subarray(0, 64), `asset content: ${asset}`);
}
console.log(`Verified ${files.length} static assets, model and music range downloads.`);
