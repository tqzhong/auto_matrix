import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { writeFile, readFile, readdir, cp } from 'node:fs/promises';
import { io } from 'socket.io-client';

const label = process.argv[2], stateDirectory = process.argv[3] ?? 'runtime-state', base = new URL('./', import.meta.url), endpoint = 'http://127.0.0.1:3161';
assert.match(label, /^[a-z0-9-]+$/);
assert.match(stateDirectory, /^[a-z0-9-]+$/);
const world = async () => (await fetch(endpoint + '/api/world')).json();
const before = await world();
assert.equal(before.simulation.running, false);
assert.ok(Object.values(before.agents).every(actor => !actor.controller), 'release the native character first');
const socket = io(endpoint, { transports: ['websocket'], reconnection: false, autoConnect: false });
await new Promise((resolve, reject) => { socket.once('connect', resolve); socket.once('connect_error', reject); socket.connect(); });
socket.emit('message', { type: 'pause' });
await new Promise(resolve => setTimeout(resolve, 500));
socket.disconnect();
const after = await world();
assert.equal(after.simulation.tick, before.simulation.tick);
await writeFile(new URL(label + '-world.json', base), JSON.stringify(after, null, 2), { flag: 'wx' });
const memories = {};
for (const name of (await readdir(new URL(stateDirectory + '/memories/', base))).sort()) {
  const bytes = await readFile(new URL(stateDirectory + '/memories/' + name, base));
  memories[name] = createHash('sha256').update(bytes).digest('hex');
}
await writeFile(new URL(label + '-memories.json', base), JSON.stringify(memories, null, 2), { flag: 'wx' });
await cp(new URL(stateDirectory, base), new URL(label + '-state', base), { recursive: true, force: false, errorOnExist: true });
console.log(JSON.stringify({ label, tick: after.simulation.tick, scene: after.sandbox.neoLife.journey?.scene, step: after.sandbox.neoLife.journey?.step, pills: after.sandbox.neoLife.journey?.pills, memories: Object.keys(memories).length }));
