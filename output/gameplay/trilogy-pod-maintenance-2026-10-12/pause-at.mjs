import assert from 'node:assert/strict';
import { io } from 'socket.io-client';
const [kind, targetText] = process.argv.slice(2), target = Number(targetText);
assert.ok(['disconnect', 'breather', 'rescue'].includes(kind) && Number.isFinite(target));
const endpoint = 'http://127.0.0.1:3159';
const socket = io(endpoint, { transports: ['websocket'], reconnection: false, autoConnect: false });
await new Promise((resolve, reject) => { socket.once('connect', resolve); socket.once('connect_error', reject); socket.connect(); });
const started = Date.now(); let matched = false;
try {
  while (Date.now() - started < 45000) {
    const world = await (await fetch(endpoint + '/api/world')).json();
    const beat = world.sandbox.neoLife.journey?.awakening;
    if (beat?.kind === kind && beat.elapsed >= target && world.simulation.running) {
      socket.emit('message', { type: 'pause' });
      await new Promise(resolve => setTimeout(resolve, 350));
      const paused = await (await fetch(endpoint + '/api/world')).json();
      assert.equal(paused.simulation.running, false);
      console.log(JSON.stringify({ tick: paused.simulation.tick, beat: paused.sandbox.neoLife.journey.awakening }));
      matched = true; break;
    }
    await new Promise(resolve => setTimeout(resolve, 70));
  }
  assert.ok(matched, 'the requested live checkpoint was not reached');
} finally { socket.disconnect(); }
