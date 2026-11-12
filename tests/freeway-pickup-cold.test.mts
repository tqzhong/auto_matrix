import assert from 'node:assert/strict';
import test from 'node:test';
import { execFileSync, spawn } from 'node:child_process';
import { readFile, writeFile, rm } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { io } from 'socket.io-client';
import { FILM_SETS, freewayPickupRoot, freewayDriverRoot, freewayRideRoot, newFreewayPickup, newFreewayRide, stepFreewayPickup,
  type FreewayPickup, type ServerMessage, type WorldStateFull } from '@auto_matrix/shared';

async function server(t: test.TestContext, phase: FreewayPickup['phase'] | 'riding', stale = false) {
  const root = fileURLToPath(new URL('../', import.meta.url));
  const directory = execFileSync(process.execPath, ['--import', 'tsx', 'scripts/film-review-fixture.mts', 'm2_freeway'], { cwd: root, encoding: 'utf8' }).trim();
  const file = path.join(directory, 'world.json'), checkpoint = JSON.parse(await readFile(file, 'utf8'));
  let pickup: FreewayPickup = { ...newFreewayPickup(), phase: phase === 'riding' ? 'done' : phase, startedAt: 8, elapsed: .4, total: 7, z: -4, walking: 3, stride: 4 };
  const ride = phase === 'riding' ? { ...newFreewayRide(), x: 10, z: 620, speed: 24.5, lateral: 7.2, elapsed: 21, startedAt: 19, bank: -.1, braking: .2 } : undefined;
  if (phase === 'failed') {
    pickup = stepFreewayPickup({ ...newFreewayPickup(), phase: 'bridge', z: 407, total: 1, startedAt: 8 }, { jump: true }, .05);
    while (pickup.phase !== 'failed') pickup = stepFreewayPickup(pickup, {}, .05);
  } else if (phase === 'jumping') {
    pickup.start = { x: 14, z: 407, yaw: 0 }; pickup.z = 407;
  } else if (phase === 'keyhandoff') pickup.z = 5.8;
  else if (phase === 'launching') { pickup.elapsed = .8; pickup.key = true; pickup.chain = false; }
  else if (phase === 'merging') {
    Object.assign(pickup, { x: 10, z: 600, heading: -.2, speed: 28, key: true, chain: false });
    pickup.chase = { phase: 'ramming', elapsed: .7, truck: { x: 12, z: 640, speed: 28, yaw: -.1 }, shield: { x: 6, z: 680, speed: 12 } };
  }
  const journey = checkpoint.sandbox.neoLife.journey;
  Object.assign(journey, { scene: 'm2_freeway', actor: 'trinity', step: ride ? 1 : 0, freewayPickup: pickup, ...(ride ? { ride } : {}) }); delete journey.started;
  const center = FILM_SETS.film_freeway_101.center;
  for (const role of ['trinity', 'keymaker', ...(pickup.chase ? ['agent_jackson'] : [])]) {
    const driver = role === 'agent_jackson', actor = checkpoint.agents[role];
    const pose = driver ? freewayDriverRoot(pickup) : ride ? freewayRideRoot(ride, role as 'trinity' | 'keymaker') : freewayPickupRoot(pickup, role as 'trinity' | 'keymaker');
    Object.assign(actor, { position: { x: center.x + pose.x, y: center.y + pose.y, z: center.z + pose.z }, rotation: pose.yaw,
      currentLocation: 'film_freeway_101', isInMatrix: true, status: 'alive', health: role === 'trinity' ? 73 : 55,
      velocity: role === 'trinity' && phase !== 'failed' ? { x: 0, y: 0, z: 0 }
        : { x: role === 'trinity' ? 0 : .3, y: phase === 'failed' ? -24.2 : 0, z: 14 }, targetPosition: null, currentPath: [],
      currentAction: { type: 'idle', parameters: driver
        ? { resolved: true, seated: true, riding: true, freewayDriver: { ...pickup, role } }
        : ride ? { resolved: true, player: false, riding: true, seated: true, passenger: role !== 'trinity', freewayRide: { ...ride, role } }
        : { resolved: true, player: role === 'trinity', freewayPickup: { ...pickup, role, walking: pickup.walking } }, startedAt: ride?.startedAt ?? pickup.startedAt, duration: 1e9, progress: 0 } });
    if (stale && role === 'keymaker') actor.currentAction.parameters.freewayPickup.total -= .1;
  }
  journey.checkpoint = { ...checkpoint.agents.trinity.position }; checkpoint.tick = 20; checkpoint.simulation = { running: false, speed: 1 }; checkpoint.sandbox.threats = [];
  await writeFile(file, JSON.stringify(checkpoint)); const expected = structuredClone(checkpoint);
  const child = spawn(process.execPath, ['--import', 'tsx', 'tests/fixtures/server-startup.mts', 'normal'], { cwd: root,
    env: { ...process.env, MATRIX_DATA_DIR: directory, MATRIX_CLOUD_SAVE: '', HOST: '127.0.0.1', PORT: '0', TICK_RATE_MS: '10000', STATE_SYNC_INTERVAL: '1', LLM_API_KEY: '' }, stdio: ['ignore', 'pipe', 'pipe'] });
  let output = ''; const sockets: ReturnType<typeof io>[] = [];
  child.stdout.on('data', data => { output += data; }); child.stderr.on('data', data => { output += data; });
  const finished = new Promise(resolve => child.once('close', resolve));
  t.after(async () => {
    for (const socket of sockets) socket.disconnect();
    if (child.exitCode === null && child.signalCode === null) child.kill('SIGTERM');
    const timer = setTimeout(() => { if (child.exitCode === null && child.signalCode === null) child.kill('SIGKILL'); }, 5000);
    try { await finished; } finally { clearTimeout(timer); await rm(directory, { recursive: true, force: true }); }
  });
  const wait = async (ready: () => boolean, label: string) => {
    const end = Date.now() + 15000;
    while (!ready()) { assert(child.exitCode === null && child.signalCode === null && Date.now() < end, label + ': ' + output.slice(-1200)); await new Promise(resolve => setTimeout(resolve, 20)); }
  };
  await wait(() => output.includes('STARTUP_LISTENING'), 'startup');
  const address = JSON.parse(output.match(/STARTUP_LISTENING (\{[^\n]+\})/)![1]), url = `http://127.0.0.1:${address.port}`;
  const world = async () => await (await fetch(url + '/api/world')).json() as WorldStateFull;
  const connect = async () => {
    const socket = io(url, { autoConnect: false, transports: ['websocket'] }), messages: ServerMessage[] = []; sockets.push(socket);
    socket.on('message', message => messages.push(message)); socket.connect(); await wait(() => messages.some(m => m.type === 'world_state_full'), 'initial state');
    socket.emit('message', { type: 'play_as', data: { agentId: 'trinity' } });
    await wait(() => messages.some(m => m.type === 'player_state' && (m.data as { agentId?: string }).agentId === 'trinity'), 'possession');
    if (phase === 'riding') await new Promise(resolve => setTimeout(resolve, 150));
    return socket;
  };
  return { world, connect, expected };
}

for (const phase of ['failed', 'jumping', 'deck', 'keyhandoff', 'launching', 'merging', 'riding'] as const)
  test(`cold ${phase} preserves the saved passenger motion through reconnect`, { timeout: 25000 }, async t => {
    const h = await server(t, phase), check = (w: WorldStateFull) => {
      assert.equal(w.simulation!.running, false); assert.deepEqual(w.sandbox!.neoLife!.journey!.freewayPickup, h.expected.sandbox.neoLife.journey.freewayPickup);
      assert.deepEqual(w.sandbox!.neoLife!.journey!.ride, h.expected.sandbox.neoLife.journey.ride);
      for (const role of phase === 'riding' ? ['keymaker'] : ['trinity', 'keymaker', ...(phase === 'merging' ? ['agent_jackson'] : [])])
        for (const key of ['position', 'rotation', 'velocity', 'health', 'currentAction', 'targetPosition', 'currentPath'] as const)
          assert.deepEqual(w.agents[role][key], h.expected.agents[role][key], role + '/' + key);
    };
    check(await h.world()); const socket = await h.connect(), attached = await h.world(); check(attached); socket.disconnect();
    const end = Date.now() + 5000;
    while ((await h.world()).agents.trinity.controller) { assert(Date.now() < end); await new Promise(resolve => setTimeout(resolve, 20)); }
    check(await h.world()); await h.connect(); const after = await h.world(); check(after);
    assert.ok(JSON.stringify(after) === JSON.stringify(attached), 'retain every field of the complete paused world');
  });

test('a stale passenger tag rebuilds its pose instead of retaining outdated motion', { timeout: 25000 }, async t => {
  const h = await server(t, 'deck', true); await h.connect(); const w = await h.world();
  assert.deepEqual(w.agents.keymaker.velocity, { x: 0, y: 0, z: 0 });
  assert.equal((w.agents.keymaker.currentAction!.parameters.freewayPickup as FreewayPickup).total, w.sandbox!.neoLife!.journey!.freewayPickup!.total);
  assert.equal(w.agents.keymaker.health, 55);
});
