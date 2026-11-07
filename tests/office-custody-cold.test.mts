import assert from 'node:assert/strict';
import test from 'node:test';
import { execFileSync, spawn } from 'node:child_process';
import { readFile, writeFile, rm } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { io } from 'socket.io-client';
import { FILM_SCENE_BY_ID, OFFICE_CUSTODY, filmPosition, type WorldStateFull } from '@auto_matrix/shared';

const root = fileURLToPath(new URL('../', import.meta.url));
for (const [actionType, running] of [['idle', false], ['move_to', false], ['move_to', true], ['attack', false]] as const) {
  const preserve = !running && actionType !== 'attack';
  test(`cold custody startup ${preserve ? 'preserves' : 'clears'} ${actionType} with running=${running}`, { timeout: 25000 }, async t => {
    const directory = execFileSync(process.execPath, ['--import', 'tsx', 'scripts/film-review-fixture.mts', 'm1_office_escape'], { cwd: root, encoding: 'utf8' }).trim();
    const file = path.join(directory, 'world.json'), checkpoint = JSON.parse(await readFile(file, 'utf8'));
    const actor = checkpoint.agents.neo, journey = checkpoint.sandbox.neoLife.journey;
    actor.position = filmPosition('film_metacortex_floor', 0, -12); actor.currentLocation = 'film_metacortex_floor';
    actor.rotation = Math.PI / 2; actor.velocity = { x: running ? OFFICE_CUSTODY.speed : 0, y: 0, z: 0 }; actor.targetPosition = null; actor.currentPath = [];
    checkpoint.simulation = { running, speed: 1 };
    const body = (x: number, z: number) => ({ position: { ...actor.position, x: actor.position.x + x, z: actor.position.z + z }, yaw: 0, velocity: { x: 0, y: 0, z: 0 } });
    journey.step = FILM_SCENE_BY_ID.m1_office_escape.steps.length; journey.checkpoint = { ...actor.position };
    journey.office = { alert: 100, suspicion: [100, 0, 0], waypoints: [1, 1, 1], lastTick: checkpoint.tick, guide: '', outcome: 'captured',
      custody: { phase: 'escorting', elapsed: OFFICE_CUSTODY.securing, paused: false, catcher: 'smith', leader: 'agent_brown',
        bodies: { smith: body(1.9, -1.9), agent_brown: body(3.8, -3.8), agent_jones: body(-4.2, -1.9) } } };
    const gesture = { role: 'neo', phase: 'escorting', elapsed: OFFICE_CUSTODY.securing, paused: false, locked: false };
    actor.currentAction = { type: actionType, parameters: { player: true, resolved: true, crouching: false, officeCustody: gesture }, startedAt: checkpoint.tick, duration: 1, progress: .27 };
    checkpoint.agents.citizen_5.currentAction = { type: 'attack', parameters: { player: true, officeCustody: gesture }, startedAt: checkpoint.tick, duration: 1, progress: .2 };
    await writeFile(file, JSON.stringify(checkpoint));
    const expected = structuredClone(actor.currentAction);
    const child = spawn(process.execPath, ['--import', 'tsx', 'tests/fixtures/server-startup.mts', 'normal'], {
      cwd: root, env: { ...process.env, MATRIX_DATA_DIR: directory, MATRIX_CLOUD_SAVE: '', HOST: '127.0.0.1', PORT: '0', TICK_RATE_MS: '10000', LLM_API_KEY: '' }, stdio: ['ignore', 'pipe', 'pipe'],
    });
    let output = ''; child.stdout.on('data', data => { output += data; }); child.stderr.on('data', data => { output += data; });
    const finished = new Promise(resolve => child.once('close', resolve));
    let socket: ReturnType<typeof io> | undefined;
    t.after(async () => {
      socket?.disconnect();
      if (child.exitCode === null && child.signalCode === null) child.kill('SIGTERM');
      const timer = setTimeout(() => { if (child.exitCode === null && child.signalCode === null) child.kill('SIGKILL'); }, 5000);
      try { await finished; } finally { clearTimeout(timer); await rm(directory, { recursive: true, force: true }); }
    });
    const deadline = Date.now() + 15000;
    while (!output.includes('STARTUP_LISTENING')) {
      assert(child.exitCode === null && child.signalCode === null && Date.now() < deadline, output.slice(-1800));
      await new Promise(resolve => setTimeout(resolve, 20));
    }
    const address = JSON.parse(output.match(/STARTUP_LISTENING (\{[^\n]+\})/)![1]), url = `http://127.0.0.1:${address.port}`;
    const world = async () => await (await fetch(url + '/api/world')).json() as WorldStateFull;
    const check = (state: WorldStateFull) => {
      assert.equal(state.simulation!.running, running); assert.equal(state.simulation!.tick, checkpoint.tick);
      if (preserve) assert.deepEqual(state.agents.neo.currentAction, expected);
      else assert.equal(state.agents.neo.currentAction?.type, 'idle', 'old movement and attacks must stop');
      assert.deepEqual(state.agents.neo.position, actor.position); assert.deepEqual(state.agents.neo.velocity, { x: 0, y: 0, z: 0 });
      assert.equal(state.agents.citizen_5.currentAction, null, 'another player action must still be cleared');
      assert.deepEqual(state.sandbox!.neoLife!.journey!.completed, journey.completed);
      assert.equal(state.sandbox!.neoLife!.money, checkpoint.sandbox.neoLife.money);
    };
    check(await world());
    socket = io(url, { autoConnect: false, transports: ['websocket'] });
    const connected = new Promise<void>((resolve, reject) => { socket!.once('connect', resolve); socket!.once('connect_error', reject); });
    socket.connect(); await connected; socket.emit('message', { type: 'play_as', data: { agentId: 'neo' } });
    const joined = Date.now() + 5000;
    while (!(await world()).agents.neo.controller) { assert(Date.now() < joined, 're-entry timed out'); await new Promise(resolve => setTimeout(resolve, 20)); }
    check(await world());
    if (running) {
      socket.emit('message', { type: 'player_input', data: { x: 1, z: 0, yaw: actor.rotation, sprint: false, jump: false, sequence: 1 } });
      const walking = Date.now() + 5000;
      let moving = await world();
      while (moving.agents.neo.currentAction?.type !== 'move_to' || moving.agents.neo.velocity.x <= 0) {
        assert(Date.now() < walking, 'fresh movement did not start'); await new Promise(resolve => setTimeout(resolve, 20)); moving = await world();
      }
      const action = structuredClone(moving.agents.neo.currentAction);
      socket.emit('message', { type: 'pause', data: {} });
      socket.emit('message', { type: 'leave_character', data: {} });
      const left = Date.now() + 5000;
      let paused = await world();
      while (paused.simulation!.running || paused.agents.neo.controller) {
        assert(Date.now() < left, 'pause and immediate leave timed out'); await new Promise(resolve => setTimeout(resolve, 20)); paused = await world();
      }
      assert.deepEqual(paused.agents.neo.currentAction, action, 'pausing and leaving before the next player frame must preserve the action');
      assert.deepEqual(paused.agents.neo.velocity, { x: 0, y: 0, z: 0 });
    } else {
      socket.disconnect(); const left = Date.now() + 5000;
      while ((await world()).agents.neo.controller) { assert(Date.now() < left, 'disconnect timed out'); await new Promise(resolve => setTimeout(resolve, 20)); }
      check(await world());
    }
  });
}
