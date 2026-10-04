import assert from 'node:assert/strict';
import test, { type TestContext } from 'node:test';
import { execFileSync, spawn } from 'node:child_process';
import { readFile, writeFile, rm } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { io } from 'socket.io-client';
import { FILM_SCENE_BY_ID, FILM_SETS, TRUCKS, truckApproachPose, truckRescuePose, type DeusPactEncounter, type FarewellEncounter, type TruckEncounter, type ServerMessage, type WorldStateFull, type WorldStateDelta } from '@auto_matrix/shared';

const root = fileURLToPath(new URL('../', import.meta.url));
const waitFor = async (ready: () => boolean, description: string, timeout = 5000) => {
  const end = Date.now() + timeout;
  while (!ready()) {
    assert.ok(Date.now() < end, description);
    await new Promise(resolve => setTimeout(resolve, 20));
  }
};

async function server(t: TestContext, elapsed: number, scene = 'm1_mirror') {
  const directory = execFileSync(process.execPath, ['--import', 'tsx', 'scripts/film-review-fixture.mts', scene,
    scene === 'm3_deus' ? 'deus-cabling' : scene === 'm3_farewell' ? 'farewell-goodbye' : 'mirror-thread'], { cwd: root, encoding: 'utf8' }).trim();
  const file = path.join(directory, 'world.json');
  const checkpoint = JSON.parse(await readFile(file, 'utf8'));
  if (scene === 'm2_trucks') {
    const encounter: TruckEncounter = { phase: 'rescue', elapsed: 8, rescueElapsed: elapsed, lastTick: 0, attempt: 0,
      starts: { morpheus: { ...TRUCKS.rescueApproach, y: TRUCKS.roof.height, yaw: 0 },
        keymaker: { ...TRUCKS.keymaker, y: TRUCKS.roof.height, yaw: 0 }, neo: truckApproachPose(8) } };
    Object.assign(checkpoint.sandbox.neoLife.journey, { step: 2, trucks: encounter });
    for (const role of ['morpheus', 'keymaker', 'neo'] as const) {
      const pose = truckRescuePose(encounter, role), base = FILM_SETS.film_freeway_trucks.center;
      Object.assign(checkpoint.agents[role], { position: { x: base.x + pose.x, y: base.y + pose.y, z: base.z + pose.z },
        rotation: pose.yaw, currentLocation: 'film_freeway_trucks', isInMatrix: true });
    }
  } else if (scene === 'm3_farewell') {
    Object.assign(checkpoint.sandbox.neoLife.journey.farewell, { elapsed, total: 10.4 + elapsed });
    Object.assign(checkpoint.sandbox.neoLife, { day: 7, money: 1320, energy: 47, doubt: 63, philosophy: { agency: 6, care: 8, trust: 5 },
      evidence: ['black-cat', 'office-loop'], choices: { neo_eyes: 'burned', architect_door: 'matrix', oracle_first: 'care' },
      journal: [{ day: 6, time: 15000, title: '冷重启前的生活记录', text: '已经作出的选择不能被片段重建覆盖。' }] });
  } else if (scene === 'm3_deus') {
    Object.assign(checkpoint.sandbox.neoLife.journey.deus, { elapsed, total: 9.4 + elapsed });
  } else {
    checkpoint.sandbox.neoLife.journey.awakening.elapsed = elapsed;
    delete checkpoint.sandbox.neoLife.journey.awakening.started;
  }
  await writeFile(file, JSON.stringify(checkpoint));
  const stops: (() => Promise<void>)[] = [];
  t.after(async () => {
    for (const stop of stops) await stop();
    await rm(directory, { recursive: true, force: true });
  });
  const launch = async () => {
    const child = spawn(process.execPath, ['--import', 'tsx', 'tests/fixtures/server-startup.mts', 'normal'], {
      cwd: root, env: { ...process.env, MATRIX_DATA_DIR: directory, HOST: '127.0.0.1', PORT: '0', TICK_RATE_MS: '10000', STATE_SYNC_INTERVAL: '1', LLM_API_KEY: '' },
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let output = '';
    child.stdout.on('data', data => { output += data; }); child.stderr.on('data', data => { output += data; });
    const finished = new Promise(resolve => child.once('close', resolve));
    const sockets: ReturnType<typeof io>[] = [];
    const stop = async () => {
      for (const socket of sockets) socket.disconnect();
      if (child.exitCode === null && child.signalCode === null) child.kill('SIGTERM');
      if (await Promise.race([finished.then(() => true), new Promise(resolve => setTimeout(() => resolve(false), 5000).unref())]) === false) {
        child.kill('SIGKILL'); await finished;
      }
    };
    stops.push(stop);
    await waitFor(() => output.includes('STARTUP_LISTENING'), `server did not start: ${output}`, 15000);
    const address = JSON.parse(output.match(/STARTUP_LISTENING (\{[^\n]+\})/)![1]);
    const base = `http://127.0.0.1:${address.port}`;
    const connect = async () => {
      const socket = io(base, { autoConnect: false, transports: ['websocket'] }); sockets.push(socket);
      const messages: ServerMessage[] = [];
      let state: WorldStateFull | undefined;
      socket.on('message', (message: ServerMessage) => {
        messages.push(message);
        if (message.type === 'world_state_full') state = structuredClone(message.data as WorldStateFull);
        else if (message.type === 'world_state_delta' && state) {
          const delta = message.data as WorldStateDelta;
          for (const [id, agent] of Object.entries(delta.agents)) state.agents[id] = { ...state.agents[id], ...agent };
          if (delta.sandbox) state.sandbox = delta.sandbox;
          if (delta.simulation) state.simulation = delta.simulation;
          if (delta.timeOfDay !== undefined) state.timeOfDay = delta.timeOfDay;
        }
      });
      socket.connect(); await waitFor(() => Boolean(state), 'client did not receive its world snapshot');
      return { socket, messages, state: () => state! };
    };
    return { base, connect, stop };
  };
  const initial = await launch();
  return { ...initial, restart: async () => { await initial.stop(); return launch(); } };
}

test('a paused performance publishes its exact story clock together with the stopped world and restores it on reconnect', { timeout: 30000 }, async t => {
  const h = await server(t, 3.04), client = await h.connect();
  client.socket.emit('message', { type: 'play_as', data: { agentId: 'neo' } });
  await waitFor(() => client.messages.some(message => message.type === 'player_state' && (message.data as { agentId?: string }).agentId === 'neo'), 'Neo was not connected');
  const initial = client.state().sandbox!.neoLife!.journey!.awakening!.elapsed;
  await waitFor(() => client.messages.filter(message => message.type === 'world_state_delta' && (message.data as WorldStateDelta).agents.neo).length >= 5, 'the live player did not advance');
  const before = await (await fetch(`${h.base}/api/sandbox`)).json();
  assert.ok(before.neoLife.journey.awakening.elapsed > initial + .1);
  client.socket.emit('message', { type: 'pause', data: {} });
  await waitFor(() => client.state().simulation?.running === false, 'pause was not acknowledged');
  const pausedMessage = client.messages.findLast(message => message.type === 'world_state_delta' && (message.data as WorldStateDelta).simulation?.running === false)!;
  const pausedDelta = pausedMessage.data as WorldStateDelta;
  assert.ok(pausedDelta.sandbox, 'the pause boundary must deliver the latest cinematic clock, not only the player pose');
  const authoritative = await (await fetch(`${h.base}/api/world`)).json() as WorldStateFull;
  assert.deepEqual(client.state().sandbox, authoritative.sandbox);
  assert.deepEqual(client.state().agents.neo, authoritative.agents.neo);
  assert.equal(client.state().timeOfDay, authoritative.timeOfDay);
  const clock = authoritative.sandbox!.neoLife!.journey!.awakening!.elapsed;
  client.socket.disconnect();
  const restored = await h.connect();
  restored.socket.emit('message', { type: 'play_as', data: { agentId: 'neo' } });
  await waitFor(() => restored.messages.some(message => message.type === 'player_state' && (message.data as { agentId?: string }).agentId === 'neo'), 'Neo was not restored');
  assert.equal(restored.state().simulation?.running, false);
  assert.equal(restored.state().sandbox!.neoLife!.journey!.awakening!.elapsed, clock);
  const marker = restored.messages.length;
  restored.socket.emit('message', { type: 'resume', data: {} });
  await waitFor(() => restored.messages.slice(marker).some(message => message.type === 'world_state_delta' && (message.data as WorldStateDelta).simulation?.running === true), 'resume was not acknowledged');
  const resumed = restored.messages.slice(marker).find(message => message.type === 'world_state_delta' && (message.data as WorldStateDelta).simulation?.running === true)!.data as WorldStateDelta;
  assert.equal(resumed.sandbox!.neoLife!.journey!.awakening!.elapsed, clock, 'resume starts from the same authoritative beat');
});

test('a real machine-core restart preserves the paused connection before possession and settles only after renewed consent', { timeout: 30000 }, async t => {
  const h = await server(t, 1.1, 'm3_deus'), client = await h.connect();
  client.socket.emit('message', { type: 'play_as', data: { agentId: 'neo' } });
  await waitFor(() => ((client.state().agents.neo.currentAction?.parameters.deusPact as DeusPactEncounter | undefined)?.elapsed ?? 0) > 1.4, 'Neo did not reach the middle of body cabling');
  client.socket.emit('message', { type: 'pause', data: {} });
  await waitFor(() => client.state().simulation?.running === false, 'the physical connection did not pause');
  const before = await (await fetch(`${h.base}/api/world`)).json() as WorldStateFull;
  assert.equal(before.sandbox!.neoLife!.journey!.deus!.phase, 'cabling');
  const body = (world: WorldStateFull, id: string) => {
    const agent = world.agents[id];
    return { position: agent.position, rotation: agent.rotation, velocity: agent.velocity, currentAction: agent.currentAction,
      currentLocation: agent.currentLocation, isInMatrix: agent.isInMatrix, status: agent.status, health: agent.health };
  };
  const takeover = await h.connect();
  takeover.socket.emit('message', { type: 'play_as', data: { agentId: 'neo', takeover: true } });
  await waitFor(() => takeover.messages.some(message => message.type === 'player_state' && (message.data as { agentId?: string }).agentId === 'neo'), 'the paused connection was not handed over');
  assert.deepEqual(takeover.state().sandbox!.neoLife, before.sandbox!.neoLife);
  assert.deepEqual(body(takeover.state(), 'neo'), body(before, 'neo'));
  takeover.socket.emit('message', { type: 'leave_character', data: {} });
  await waitFor(() => takeover.messages.some(message => message.type === 'player_state' && (message.data as { agentId?: string | null }).agentId === null), 'Neo was not released');
  const observer = await (await fetch(`${h.base}/api/world`)).json() as WorldStateFull;
  assert.deepEqual(body(observer, 'neo'), body(before, 'neo'), 'releasing the stopped connection cannot remove its pose');
  const restored = await h.restart();
  const cold = await (await fetch(`${restored.base}/api/world`)).json() as WorldStateFull;
  assert.equal(cold.simulation!.running, false); assert.equal(cold.simulation!.tick, before.simulation!.tick);
  assert.deepEqual(cold.sandbox!.neoLife, before.sandbox!.neoLife, 'life history, pact choice and exact connection clock survive SIGTERM and a new process');
  for (const id of ['neo', 'deus_ex_machina']) {
    assert.equal(cold.agents[id].controller, undefined);
    assert.deepEqual(body(cold, id), body(before, id), `${id} lost its saved pose before any client reconnected`);
  }
  const next = await restored.connect();
  next.socket.emit('message', { type: 'play_as', data: { agentId: 'neo' } });
  await waitFor(() => next.messages.some(message => message.type === 'player_state' && (message.data as { agentId?: string }).agentId === 'neo'), 'Neo did not reconnect');
  const pausedMarker = next.messages.length;
  await waitFor(() => next.messages.length > pausedMarker + 4, 'paused connection snapshots did not arrive');
  assert.deepEqual(next.state().sandbox!.neoLife, before.sandbox!.neoLife);
  assert.deepEqual(body(next.state(), 'neo'), body(before, 'neo'));
  next.socket.emit('message', { type: 'resume', data: {} });
  await waitFor(() => (next.state().agents.neo.currentAction?.parameters.deusPact as DeusPactEncounter | undefined)?.phase === 'consent', 'the probe did not resume to the consent boundary');
  const consentMarker = next.messages.length;
  await waitFor(() => next.messages.length > consentMarker + 8, 'waiting probe snapshots did not arrive');
  assert.equal((next.state().agents.neo.currentAction!.parameters.deusPact as DeusPactEncounter).phase, 'consent');
  assert.equal(next.state().sandbox!.neoLife!.choices.machine_connection, undefined, 'a reload is not consent to connect');
  let sequence = 0;
  const input = setInterval(() => next.socket.emit('message', { type: 'player_input', data:
    { x: 0, z: 0, yaw: Math.PI, sprint: false, jump: false, focus: true, sequence: ++sequence } }), 50);
  t.after(() => clearInterval(input));
  await waitFor(() => next.state().sandbox!.neoLife!.journey!.deus!.phase === 'connected', 'explicit renewed consent did not finish connecting', 6000);
  clearInterval(input);
  const settled = structuredClone(next.state());
  assert.equal(settled.sandbox!.neoLife!.choices.machine_pact, 'peace');
  assert.equal(settled.sandbox!.neoLife!.choices.machine_connection, 'active');
  assert.equal(settled.sandbox!.neoLife!.journey!.step, FILM_SCENE_BY_ID.m3_deus.steps.length);
  assert.equal(settled.sandbox!.neoLife!.journey!.completed.filter(id => id === 'm3_deus').length, 1);
  assert.equal(settled.sandbox!.neoLife!.journal.filter(entry => entry.title === FILM_SCENE_BY_ID.m3_deus.title).length, 1);
  const settledMarker = next.messages.length;
  await waitFor(() => next.messages.length > settledMarker + 6, 'settled connection snapshots did not arrive');
  assert.deepEqual(next.state().sandbox!.neoLife, settled.sandbox!.neoLife, 'connected cannot settle or award the scene again');
  assert.equal(next.state().sandbox!.profiles.neo.xp, settled.sandbox!.profiles.neo.xp);
  next.socket.emit('message', { type: 'sandbox_action', data: { kind: 'life', target: 'film:next' } });
  await waitFor(() => next.state().sandbox!.neoLife!.journey!.scene === 'm3_rain', 'the restored connection did not allow entering the final duel');
  assert.equal(next.state().agents.trinity.status, 'dead');
});

test('the first packet moving Neo into the real-world pod also switches the story, objective and fade state', { timeout: 30000 }, async t => {
  const h = await server(t, 7.96), client = await h.connect();
  client.socket.emit('message', { type: 'play_as', data: { agentId: 'neo' } });
  await waitFor(() => client.messages.some(message => message.type === 'world_state_delta' && (message.data as WorldStateDelta).agents.neo?.currentLocation === 'film_power_plant_pods'), 'the mirror did not reach the pod');
  const boundary = client.messages.find(message => message.type === 'world_state_delta' && (message.data as WorldStateDelta).agents.neo?.currentLocation === 'film_power_plant_pods')!.data as WorldStateDelta;
  assert.equal(boundary.sandbox?.neoLife?.journey?.scene, 'm1_pod', 'one packet cannot place the body in the pod while leaving the UI in the mirror');
  assert.equal(boundary.sandbox!.neoLife!.journey!.awakening, undefined, 'the old mirror fade must not cross into the pod');
  assert.equal(boundary.simulation?.chapter, FILM_SCENE_BY_ID.m1_pod.title);
  assert.ok(boundary.sandbox!.neoLife!.journey!.completed.includes('m1_mirror'));
  assert.equal(boundary.agents.neo.isInMatrix, false); assert.equal(boundary.agents.neo.isAwakened, true);
  assert.equal(boundary.timeOfDay, client.state().timeOfDay);
  client.socket.emit('message', { type: 'pause', data: {} });
  await waitFor(() => client.state().simulation?.running === false, 'the new scene did not pause');
  const world = await (await fetch(`${h.base}/api/world`)).json() as WorldStateFull;
  assert.deepEqual(client.state().sandbox!.neoLife!.journey, world.sandbox!.neoLife!.journey);
  assert.equal(client.state().agents.neo.currentLocation, 'film_power_plant_pods');
});

test('every fast truck-rescue packet carries all three bodies at the same saved clock before the next world tick', { timeout: 30000 }, async t => {
  const h = await server(t, .2, 'm2_trucks'), client = await h.connect();
  client.socket.emit('message', { type: 'play_as', data: { agentId: 'neo' } });
  await waitFor(() => client.messages.some(message => message.type === 'player_state' && (message.data as { agentId?: string }).agentId === 'morpheus'), 'Morpheus was not connected');
  const connected = client.messages.length;
  const fastPackets = () => client.messages.slice(connected).filter(message => message.type === 'world_state_delta'
    && !(message.data as WorldStateDelta).sandbox && (message.data as WorldStateDelta).agents.morpheus);
  await waitFor(() => fastPackets().length >= 5, 'the 50ms player packets did not arrive');
  let previous = .2;
  for (const message of fastPackets()) {
    const delta = message.data as WorldStateDelta;
    assert.equal(message.tick, 0, 'this verifies the fast loop before the deliberately slow world tick');
    const clock = (delta.agents.morpheus.currentAction!.parameters.truckRescue as TruckEncounter).rescueElapsed!;
    assert.ok(clock > previous, 'the three-body performance must advance between fast packets'); previous = clock;
    for (const role of ['morpheus', 'keymaker', 'neo'] as const) {
      assert.ok(delta.agents[role], `${role} is missing from a rescue packet; the client would animate the crew at different times`);
      const encounter = delta.agents[role].currentAction!.parameters.truckRescue as TruckEncounter;
      assert.equal(encounter.rescueElapsed, clock);
      const pose = truckRescuePose(encounter, role), base = FILM_SETS.film_freeway_trucks.center;
      assert.deepEqual(delta.agents[role].position, { x: base.x + pose.x, y: base.y + pose.y, z: base.z + pose.z });
    }
    assert.equal(delta.agents.niobe, undefined, 'unrelated NPCs do not need to join the fast rescue stream');
  }
  client.socket.emit('message', { type: 'pause', data: {} });
  await waitFor(() => client.state().simulation?.running === false, 'the rescue did not pause');
  const paused = client.state().sandbox!.neoLife!.journey!.trucks!.rescueElapsed;
  const count = client.messages.length;
  await waitFor(() => client.messages.length >= count + 3, 'paused body snapshots did not arrive');
  for (const role of ['morpheus', 'keymaker', 'neo']) assert.equal((client.state().agents[role].currentAction!.parameters.truckRescue as TruckEncounter).rescueElapsed, paused);
});

test('a real server restart restores the paused airborne crew before possession and continues the rescue exactly once', { timeout: 30000 }, async t => {
  const h = await server(t, .8, 'm2_trucks'), client = await h.connect();
  client.socket.emit('message', { type: 'play_as', data: { agentId: 'neo' } });
  await waitFor(() => ((client.state().agents.morpheus.currentAction?.parameters.truckRescue as TruckEncounter | undefined)?.rescueElapsed ?? 0) > 1.3, 'the owned crew did not reach the airborne carrying phase');
  client.socket.emit('message', { type: 'pause', data: {} });
  await waitFor(() => client.state().simulation?.running === false, 'the airborne scene did not pause');
  const before = await (await fetch(`${h.base}/api/world`)).json() as WorldStateFull;
  const rescue = before.sandbox!.neoLife!.journey!.trucks!;
  assert.equal(rescue.phase, 'rescue'); assert.ok(rescue.rescueElapsed! > 1.3 && rescue.rescueElapsed! < 3);
  client.socket.emit('message', { type: 'leave_character', data: {} });
  await waitFor(() => client.messages.some(message => message.type === 'player_state' && (message.data as { agentId?: string | null }).agentId === null), 'Morpheus was not released');
  const observer = await (await fetch(`${h.base}/api/world`)).json() as WorldStateFull;
  assert.deepEqual(observer.agents.morpheus.currentAction?.parameters.truckRescue, before.agents.morpheus.currentAction!.parameters.truckRescue,
    'releasing the paused character must preserve his carried pose for the observer');
  const restored = await h.restart();
  const after = await (await fetch(`${restored.base}/api/world`)).json() as WorldStateFull;
  assert.equal(after.simulation!.running, false); assert.equal(after.simulation!.tick, before.simulation!.tick);
  assert.deepEqual(after.sandbox!.neoLife!.journey!.trucks, rescue);
  for (const role of ['morpheus', 'keymaker', 'neo']) {
    assert.equal(after.agents[role].controller, undefined, 'no former page may own a restored role');
    assert.deepEqual(after.agents[role].position, before.agents[role].position, `${role} moved during the stopped server restart`);
    assert.equal(after.agents[role].rotation, before.agents[role].rotation);
    assert.deepEqual(after.agents[role].currentAction!.parameters.truckRescue, before.agents[role].currentAction!.parameters.truckRescue,
      `${role} lost its saved body animation before a player reconnected`);
  }
  const next = await restored.connect();
  next.socket.emit('message', { type: 'play_as', data: { agentId: 'neo' } });
  await waitFor(() => next.messages.some(message => message.type === 'player_state' && (message.data as { agentId?: string }).agentId === 'morpheus'), 'the same role was not restored');
  assert.equal(next.state().sandbox!.neoLife!.journey!.trucks!.rescueElapsed, rescue.rescueElapsed);
  assert.deepEqual(next.state().agents.morpheus.currentAction?.parameters.truckRescue, before.agents.morpheus.currentAction!.parameters.truckRescue,
    'possessing the paused save must not clear the body pose while time remains stopped');
  next.socket.emit('message', { type: 'resume', data: {} });
  await waitFor(() => next.state().sandbox!.neoLife!.journey!.trucks!.phase === 'rescued', 'the loaded rescue did not reach its landing');
  const final = next.state().sandbox!.neoLife!.journey!;
  assert.equal(final.step, FILM_SCENE_BY_ID.m2_trucks.steps.length);
  assert.equal(final.completed.filter(id => id === 'm2_trucks').length, 1);
  const landing = next.messages.findIndex(message => message.type === 'world_state_delta'
    && (message.data as WorldStateDelta).sandbox?.neoLife?.journey?.trucks?.phase === 'rescued');
  await waitFor(() => next.messages.length > landing + 4, 'the post-landing snapshots did not arrive');
  const complete = await (await fetch(`${restored.base}/api/world`)).json() as WorldStateFull;
  assert.equal(complete.sandbox!.neoLife!.journey!.completed.filter(id => id === 'm2_trucks').length, 1);
  for (const role of ['morpheus', 'keymaker', 'neo']) assert.equal(complete.agents[role].status, 'alive');
});

test('a real farewell restart preserves both paused bodies and Neo life, then settles Trinity once before the machine pact', { timeout: 30000 }, async t => {
  const h = await server(t, 3.8, 'm3_farewell'), client = await h.connect();
  client.socket.emit('message', { type: 'play_as', data: { agentId: 'neo' } });
  await waitFor(() => ((client.state().agents.neo.currentAction?.parameters.farewell as FarewellEncounter | undefined)?.elapsed ?? 0) > 4.1, 'Neo did not reach the middle of the goodbye');
  client.socket.emit('message', { type: 'pause', data: {} });
  await waitFor(() => client.state().simulation?.running === false, 'the farewell did not pause');
  const before = await (await fetch(`${h.base}/api/world`)).json() as WorldStateFull;
  assert.equal(before.sandbox!.neoLife!.journey!.farewell!.phase, 'goodbye');
  assert.ok(before.sandbox!.neoLife!.journey!.farewell!.elapsed < 5.2);
  assert.equal(before.agents.trinity.status, 'alive');
  const body = (state: WorldStateFull, id: string) => {
    const agent = state.agents[id];
    return { position: agent.position, rotation: agent.rotation, status: agent.status, health: agent.health,
      currentLocation: agent.currentLocation, isInMatrix: agent.isInMatrix, action: agent.currentAction };
  };
  const takeover = await h.connect();
  takeover.socket.emit('message', { type: 'play_as', data: { agentId: 'neo', takeover: true } });
  await waitFor(() => takeover.messages.some(message => message.type === 'player_state' && (message.data as { agentId?: string }).agentId === 'neo'), 'the paused role was not handed to the new page');
  await waitFor(() => client.messages.some(message => message.type === 'player_state' && (message.data as { agentId?: string | null }).agentId === null), 'the former page was not released');
  assert.deepEqual(takeover.state().sandbox!.neoLife, before.sandbox!.neoLife);
  for (const id of ['neo', 'trinity']) assert.deepEqual(body(takeover.state(), id), body(before, id));
  takeover.socket.emit('message', { type: 'leave_character', data: {} });
  await waitFor(() => takeover.messages.some(message => message.type === 'player_state' && (message.data as { agentId?: string | null }).agentId === null), 'the paused character was not released');
  const observer = await (await fetch(`${h.base}/api/world`)).json() as WorldStateFull;
  assert.deepEqual(observer.sandbox!.neoLife, before.sandbox!.neoLife);
  for (const id of ['neo', 'trinity']) assert.deepEqual(body(observer, id), body(before, id), 'leaving the character cannot change the stopped goodbye');
  const restored = await h.restart();
  const cold = await (await fetch(`${restored.base}/api/world`)).json() as WorldStateFull;
  assert.equal(cold.simulation!.running, false); assert.equal(cold.simulation!.tick, before.simulation!.tick);
  assert.deepEqual(cold.sandbox!.neoLife, before.sandbox!.neoLife, 'all life history, resources, choices and the exact farewell beat survive the real process restart');
  for (const id of ['neo', 'trinity']) {
    assert.equal(cold.agents[id].controller, undefined);
    assert.deepEqual(body(cold, id), body(before, id), `${id} lost its paused body before any player reconnected`);
  }
  const next = await restored.connect();
  next.socket.emit('message', { type: 'play_as', data: { agentId: 'neo' } });
  await waitFor(() => next.messages.some(message => message.type === 'player_state' && (message.data as { agentId?: string }).agentId === 'neo'), 'Neo did not reconnect');
  const marker = next.messages.length;
  await waitFor(() => next.messages.length >= marker + 4, 'paused snapshots did not arrive');
  assert.deepEqual(next.state().sandbox!.neoLife, before.sandbox!.neoLife);
  for (const id of ['neo', 'trinity']) assert.deepEqual(body(next.state(), id), body(before, id));
  next.socket.emit('message', { type: 'resume', data: {} });
  await waitFor(() => next.state().sandbox!.neoLife!.journey!.farewell!.phase === 'still', 'the resumed farewell did not finish', 7000);
  const still = structuredClone(next.state());
  assert.equal(still.sandbox!.neoLife!.journey!.step, 2); assert.equal(still.agents.trinity.status, 'dead'); assert.equal(still.agents.trinity.health, 0);
  assert.equal(still.sandbox!.neoLife!.journey!.completed.includes('m3_farewell'), false, 'the player still has to make the final reflection');
  const afterDeath = next.messages.length;
  await waitFor(() => next.messages.length >= afterDeath + 4, 'post-farewell snapshots did not arrive');
  assert.deepEqual(next.state().sandbox!.neoLife, still.sandbox!.neoLife, 'stillness cannot repeat the death beat or award a scene every frame');
  next.socket.emit('message', { type: 'sandbox_action', data: { kind: 'life', target: 'film:reflect:care' } });
  await waitFor(() => next.state().sandbox!.neoLife!.journey!.completed.includes('m3_farewell'), 'the farewell reflection was not settled');
  const settled = structuredClone(next.state());
  assert.equal(settled.sandbox!.neoLife!.journey!.completed.filter(id => id === 'm3_farewell').length, 1);
  assert.equal(settled.sandbox!.neoLife!.journal.filter(entry => entry.title === FILM_SCENE_BY_ID.m3_farewell.title).length, 1);
  assert.equal(settled.sandbox!.profiles.neo.xp, still.sandbox!.profiles.neo.xp + 15);
  next.socket.emit('message', { type: 'sandbox_action', data: { kind: 'life', target: 'film:reflect:care' } });
  next.socket.emit('message', { type: 'request_full_state', data: {} });
  await waitFor(() => next.messages.some(message => message.type === 'world_state_full' && (message.data as WorldStateFull).sandbox?.neoLife?.journey?.completed.includes('m3_farewell')), 'the repeated reflection was not observed');
  assert.deepEqual(next.state().sandbox!.neoLife, settled.sandbox!.neoLife);
  assert.equal(next.state().sandbox!.profiles.neo.xp, settled.sandbox!.profiles.neo.xp);
  next.socket.emit('message', { type: 'sandbox_action', data: { kind: 'life', target: 'film:next' } });
  await waitFor(() => next.state().sandbox!.neoLife!.journey!.scene === 'm3_deus', 'Neo did not proceed to the machine pact');
  assert.equal(next.state().agents.trinity.status, 'dead'); assert.equal(next.state().agents.trinity.health, 0);
  next.socket.emit('message', { type: 'play_as', data: { agentId: 'trinity' } });
  await waitFor(() => next.messages.some(message => message.type === 'player_state' && Boolean((message.data as { error?: string }).error)), 'the deceased role was not rejected');
  const final = await (await fetch(`${restored.base}/api/world`)).json() as WorldStateFull;
  assert.equal(final.agents.trinity.status, 'dead'); assert.equal(final.agents.trinity.health, 0);
  assert.equal(final.sandbox!.neoLife!.journey!.completed.filter(id => id === 'm3_farewell').length, 1);
  assert.equal(final.sandbox!.neoLife!.journal.filter(entry => entry.title === FILM_SCENE_BY_ID.m3_farewell.title).length, 1);
  assert.equal(final.sandbox!.profiles.neo.xp, settled.sandbox!.profiles.neo.xp);
  let status = cold.agents.trinity.status, deaths = 0;
  for (const message of next.messages) {
    if (message.type !== 'world_state_delta' && message.type !== 'world_state_full') continue;
    const trinity = (message.data as WorldStateDelta).agents.trinity;
    if (!trinity?.status || trinity.status === status) continue;
    assert.equal(status, 'alive'); assert.equal(trinity.status, 'dead', 'Trinity cannot revive during stillness or the next scene');
    status = trinity.status; deaths++;
  }
  assert.equal(deaths, 1, 'the real client observes exactly one death transition');
});
