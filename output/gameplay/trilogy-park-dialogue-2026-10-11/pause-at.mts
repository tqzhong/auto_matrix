import { io } from 'socket.io-client';
import { writeFile } from 'node:fs/promises';
const base = 'http://127.0.0.1:3158', phase = process.argv[2], at = Number(process.argv[3]);
const socket = io(base, { transports: ['websocket'] });
await new Promise<void>(resolve => socket.once('connect', resolve));
try {
  const deadline = Date.now() + 55000;
  let found = false;
  while (Date.now() < deadline) {
    const world = await (await fetch(base + '/api/world')).json(), beat = world.sandbox.neoLife.journey.epilogue;
    if (beat.phase === phase && beat.elapsed >= at) {
      socket.emit('message', { type: 'pause', data: {} });
      await new Promise(resolve => setTimeout(resolve, 250));
      const saved = await (await fetch(base + '/api/world')).json();
      if (saved.simulation.running) throw Error('pause failed');
      await writeFile(new URL(`native-${phase}.json`, import.meta.url), JSON.stringify(saved, null, 2));
      console.log(JSON.stringify({ tick: saved.simulation.tick, scene: saved.sandbox.neoLife.journey.scene, epilogue: saved.sandbox.neoLife.journey.epilogue }));
      found = true; break;
    }
    await new Promise(resolve => setTimeout(resolve, 40));
  }
  if (!found) throw Error('phase was not reached before timeout');
} finally { socket.disconnect(); }
