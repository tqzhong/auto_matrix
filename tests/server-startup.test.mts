import assert from 'node:assert/strict';
import test, { type TestContext } from 'node:test';
import { execFileSync, spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFile, writeFile, rm } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { io } from 'socket.io-client';
import type { ConversationRecord, ServerMessage, WorldStateFull } from '@auto_matrix/shared';
import { filmPosition, filmStepPosition, FILM_SCENE_BY_ID, FILM_SCENES, farewellPose, CABIN_ROUTE_LENGTH, cabinGuidePose, AWAKENING_SECONDS, awakeningPose, type AwakeningBeat, newSmithFinale, SMITH_FINALE, smithFinalePose, stepSmithFinale, PILL_ROOM, lafayetteKnockRoot, lafayetteWelcomeRoot, OPENING_ESCAPE, OPENING_HOTEL, OFFICE_WINDOW } from '@auto_matrix/shared';
import { PersistentMemoryManager } from '../packages/server/src/memory/PersistentMemoryManager.js';
import { interrogationRoot, type InterrogationEncounter } from '@auto_matrix/shared';
import { CONSTRUCT, constructGuidePose, truthRoot, truthText, type TruthRecovery } from '@auto_matrix/shared';
import { metacortexLiftPose, metacortexPosition, type MetacortexLift } from '@auto_matrix/shared';
import { MIRROR_TRINITY, MIRROR_TIMING, mirrorTime, mirrorSilver } from '@auto_matrix/shared';
import { CheckpointStore } from '../packages/server/src/world/CheckpointStore.js';
import { openingPhoneContact, openingHitPose } from '@auto_matrix/shared';

const root = fileURLToPath(new URL('../', import.meta.url));
const fingerprint = (data: string) => createHash('sha256').update(data).digest('hex');

test('303 publishes the handset release with Trinity’s pose before finishing the call', { timeout: 30000 }, async t => {
  const f = await fixture(t, 'm1_room303'), journey = f.checkpoint.sandbox.neoLife.journey, actor = f.checkpoint.agents.trinity;
  const { stand, release } = OPENING_HOTEL.phone, elapsed = release - .08;
  const from = { position: { ...stand, y: 0 }, yaw: -Math.PI / 2 };
  journey.step = 2; Object.assign(journey.openingHotel, { phase: 'answering', elapsed, callFrom: from, lastTick: f.checkpoint.tick });
  journey.lastText = 'Trinity 放下听筒，转向走廊。';
  actor.position = filmPosition('film_heart_hotel', stand.x, stand.z); actor.rotation = from.yaw;
  actor.currentAction = { type: 'idle', parameters: { resolved: true, hotel303: { phase: 'answer', elapsed, from } },
    startedAt: f.checkpoint.tick, duration: 1, progress: 0 };
  f.checkpoint.simulation = { running: false, speed: 1 }; await writeFile(f.file, JSON.stringify(f.checkpoint));
  const server = start(t, f.directory, 'normal'); await server.waitFor('STARTUP_LISTENING'); const client = await controls(t, server);
  await client.command('play_as', { agentId: 'trinity' }, state => Boolean(state.agents.trinity.controller));
  const marker = client.messages.length;
  await client.command('resume', {}, state => state.simulation!.running);
  await new Promise(resolve => setTimeout(resolve, 220));
  const packets = client.messages.slice(marker).filter(message => message.type === 'world_state_delta');
  const released = packets.map(message => message.data as Partial<WorldStateFull>).find(delta => {
    const hotel = delta.sandbox?.neoLife?.journey?.openingHotel;
    return hotel?.phase === 'answering' && hotel.elapsed >= release;
  });
  assert.ok(released, 'the release must arrive before the next half-second world tick');
  assert.equal(released.agents?.trinity.currentAction?.parameters.hotel303 &&
    (released.agents.trinity.currentAction.parameters.hotel303 as { elapsed: number }).elapsed, released.sandbox!.neoLife!.journey!.openingHotel!.elapsed);
  await server.stop();
});

test('opening hit: fast snapshots continue the falling caller after the truck stops, including a paused real restart', { timeout: 30000 }, async t => {
  const f = await fixture(t, 'm1_phone_escape'), journey = f.checkpoint.sandbox.neoLife.journey, actor = f.checkpoint.agents.trinity;
  journey.step = 1; journey.completed = ['m1_room303', 'm1_roofs'];
  journey.openingPhone = { phase: 'failed', remaining: 0, lastTick: f.checkpoint.tick, attempts: 1, impactElapsed: 1.35, impactFrom: 0,
    answer: { elapsed: 1.1, origin: { x: -.55, y: 0, z: -28.85 }, yaw: Math.PI } };
  const hit = openingPhoneContact(journey.openingPhone)!; assert.ok(hit); journey.openingPhone.hit = hit;
  const pose = openingHitPose(hit); actor.position = filmPosition('film_wells_phone', pose.x, pose.z); actor.position.y += pose.y; actor.rotation = pose.yaw; actor.velocity = pose.velocity;
  actor.currentAction = { type: 'idle', parameters: { resolved: true, openingAnswer: structuredClone(journey.openingPhone.answer), openingHit: structuredClone(hit) }, startedAt: journey.enteredAt, duration: 1e9, progress: 0 };
  f.checkpoint.simulation = { running: false, speed: 1 }; await writeFile(f.file, JSON.stringify(f.checkpoint));
  const server = start(t, f.directory, 'normal'); await server.waitFor('STARTUP_LISTENING'); const client = await controls(t, server);
  await client.command('play_as', { agentId: 'trinity' }, state => Boolean(state.agents.trinity.controller));
  const marker = client.messages.length;
  await client.command('resume', {}, state => state.simulation!.running); await new Promise(resolve => setTimeout(resolve, 250));
  await client.command('pause', {}, state => !state.simulation!.running);
  const delivered = client.messages.slice(marker).filter(message => message.type === 'world_state_delta')
    .map(message => (message.data as { sandbox?: WorldStateFull['sandbox'] }).sandbox?.neoLife?.journey?.openingPhone).filter(Boolean);
  assert.ok(new Set(delivered.map(phone => phone!.hit?.elapsed)).size >= 3); assert.ok(delivered.every(phone => phone!.impactElapsed === 1.35));
  const saved = await client.world(); assert.notDeepEqual(saved.agents.trinity.position, actor.position);
  client.socket.disconnect(); await server.stop();
  const restored = start(t, f.directory, 'normal'); await restored.waitFor('STARTUP_LISTENING'); const next = await controls(t, restored);
  for (const state of [await next.world(), await next.command('play_as', { agentId: 'trinity' }, state => Boolean(state.agents.trinity.controller))]) {
    assert.deepEqual(state.sandbox!.neoLife!.journey!.openingPhone, saved.sandbox!.neoLife!.journey!.openingPhone);
    for (const key of ['currentAction','position','rotation','velocity'] as const) assert.deepEqual(state.agents.trinity[key], saved.agents.trinity[key]);
  }
  await restored.stop();
});

test('opening pickup: fast snapshots and real paused restarts retain the actor and the saved handoff clock', { timeout: 30000 }, async t => {
  const f = await fixture(t, 'm1_phone_escape'), journey = f.checkpoint.sandbox.neoLife.journey, actor = f.checkpoint.agents.trinity;
  journey.step = 1; journey.completed = ['m1_room303', 'm1_roofs'];
  journey.openingPhone = { phase: 'answering', remaining: 8, lastTick: f.checkpoint.tick, attempts: 1,
    answer: { elapsed: .4, origin: { x: -.4, y: 0, z: -28.3 }, yaw: Math.PI - .4 } };
  actor.position = filmPosition('film_wells_phone', -.55, -28.85); actor.rotation = Math.PI; actor.velocity = { x: 0, y: 0, z: 0 };
  actor.currentAction = { type: 'idle', parameters: { resolved: true, openingAnswer: structuredClone(journey.openingPhone.answer) }, startedAt: journey.enteredAt, duration: 1e9, progress: 0 };
  f.checkpoint.simulation = { running: false, speed: 1 }; await writeFile(f.file, JSON.stringify(f.checkpoint));
  const server = start(t, f.directory, 'normal'); await server.waitFor('STARTUP_LISTENING'); const client = await controls(t, server);
  await client.command('play_as', { agentId: 'trinity' }, state => Boolean(state.agents.trinity.controller));
  const marker = client.messages.length;
  await client.command('resume', {}, state => state.simulation!.running); await new Promise(resolve => setTimeout(resolve, 250));
  await client.command('pause', {}, state => !state.simulation!.running);
  const delivered = client.messages.slice(marker).filter(message => message.type === 'world_state_delta')
    .map(message => (message.data as { sandbox?: WorldStateFull['sandbox'] }).sandbox?.neoLife?.journey?.openingPhone?.answer?.elapsed).filter(value => typeof value === 'number');
  assert.ok(new Set(delivered).size >= 3, 'the pickup must reach clients between story ticks');
  const saved = await client.world(), phone = structuredClone(saved.sandbox!.neoLife!.journey!.openingPhone), pose = structuredClone(saved.agents.trinity.currentAction);
  assert.equal(phone!.phase, 'answering'); assert.deepEqual(pose!.parameters.openingAnswer, phone!.answer);
  client.socket.disconnect(); await server.stop();
  const restored = start(t, f.directory, 'normal'); await restored.waitFor('STARTUP_LISTENING'); const next = await controls(t, restored);
  for (const state of [await next.world(), await next.command('play_as', { agentId: 'trinity' }, state => Boolean(state.agents.trinity.controller))]) {
    assert.deepEqual(state.sandbox!.neoLife!.journey!.openingPhone, phone); assert.deepEqual(state.agents.trinity.currentAction, pose);
    assert.deepEqual(state.agents.trinity.position, saved.agents.trinity.position); assert.equal(state.agents.trinity.rotation, saved.agents.trinity.rotation);
  }
  await restored.stop();
});

test('opening impact: fast snapshots deliver the saved moving crash and preserve it through a paused restart', { timeout: 30000 }, async t => {
  const f = await fixture(t, 'm1_phone_escape'), journey = f.checkpoint.sandbox.neoLife.journey, actor = f.checkpoint.agents.trinity;
  journey.step = 2; journey.completed = ['m1_room303', 'm1_roofs', 'm1_phone_escape'];
  journey.openingPhone = { phase: 'connected', remaining: 8, lastTick: f.checkpoint.tick, attempts: 1, impactElapsed: .2, impactFrom: 8 };
  actor.position = filmPosition('film_wells_phone', 0, -28); actor.currentAction = null; actor.velocity = { x: 0, y: 0, z: 0 };
  f.checkpoint.simulation = { running: false, speed: 1 }; await writeFile(f.file, JSON.stringify(f.checkpoint));
  const server = start(t, f.directory, 'normal'); await server.waitFor('STARTUP_LISTENING'); const client = await controls(t, server);
  await client.command('play_as', { agentId: 'trinity' }, state => Boolean(state.agents.trinity.controller));
  const marker = client.messages.length;
  await client.command('resume', {}, state => state.simulation!.running); await new Promise(resolve => setTimeout(resolve, 250));
  await client.command('pause', {}, state => !state.simulation!.running);
  const delivered = client.messages.slice(marker).filter(message => message.type === 'world_state_delta')
    .map(message => (message.data as { sandbox?: WorldStateFull['sandbox'] }).sandbox?.neoLife?.journey?.openingPhone?.impactElapsed).filter(value => typeof value === 'number');
  assert.ok(new Set(delivered).size >= 3, 'clients need multiple distinct impact poses inside one half-second story tick');
  const saved = structuredClone((await client.world()).sandbox!.neoLife!.journey!.openingPhone);
  await new Promise(resolve => setTimeout(resolve, 150)); assert.deepEqual((await client.world()).sandbox!.neoLife!.journey!.openingPhone, saved);
  client.socket.disconnect(); await server.stop();
  const restored = start(t, f.directory, 'normal'); await restored.waitFor('STARTUP_LISTENING'); const next = await controls(t, restored);
  assert.deepEqual((await next.world()).sandbox!.neoLife!.journey!.openingPhone, saved);
  await next.command('play_as', { agentId: 'trinity' }, state => Boolean(state.agents.trinity.controller));
  assert.deepEqual((await next.world()).sandbox!.neoLife!.journey!.openingPhone, saved); await restored.stop();
});

test('airborne motion: real paused restarts keep jump velocity while clearing the old player action', { timeout: 30000 }, async t => {
  const f = await fixture(t, 'm1_roofs'), actor = f.checkpoint.agents.trinity, journey = f.checkpoint.sandbox.neoLife.journey;
  journey.step = 1; journey.openingRoof = { phase: 'running', lastTick: 1343, attempts: 2, wideAlley: true };
  const { roofGapNear, roofGapFar, roofJumpForward } = OPENING_ESCAPE;
  actor.position = { ...filmPosition('film_hotel_roofs', 7, (roofGapNear + roofGapFar) / 2), y: 6.2 };
  actor.velocity = { x: 0, y: 6.94, z: -roofJumpForward }; actor.rotation = Math.PI; actor.controller = 'old-page';
  actor.currentAction = { type: 'move_to', parameters: { player: true, resolved: true, crouching: false }, startedAt: 1343, duration: 1, progress: 0 };
  f.checkpoint.simulation = { running: false, speed: 1 }; await writeFile(f.file, JSON.stringify(f.checkpoint));
  for (let restart = 0; restart < 2; restart++) {
    const server = start(t, f.directory, 'normal'); await server.waitFor('STARTUP_LISTENING'); const client = await controls(t, server);
    const check = (state: WorldStateFull) => {
      assert.equal(state.simulation!.running, false); assert.equal(state.agents.trinity.currentAction, null, 'transient input must clear');
      for (const key of ['position', 'velocity', 'rotation'] as const) assert.deepEqual(state.agents.trinity[key], actor[key], key);
    };
    check(await client.world());
    check(await client.command('play_as', { agentId: 'trinity' }, state => Boolean(state.agents.trinity.controller)));
    client.socket.disconnect(); await new Promise(resolve => setTimeout(resolve, 100)); check(await client.world()); await server.stop();
  }
});

async function fixture(t: TestContext, scene = 'm1_dejavu', variant?: string) {
  const directory = execFileSync(process.execPath, ['--import', 'tsx', 'scripts/film-review-fixture.mts', scene, ...(variant ? [variant] : [])], { cwd: root, encoding: 'utf8' }).trim();
  t.after(() => rm(directory, { recursive: true, force: true }));
  const file = path.join(directory, 'world.json');
  const checkpoint = JSON.parse(await readFile(file, 'utf8'));
  checkpoint.tick = 1343; checkpoint.day = 9; checkpoint.timeOfDay = 8500;
  checkpoint.agents.neo.health = 63; checkpoint.agents.neo.controller = 'old-page';
  checkpoint.agents.mouse.status = 'dead';
  checkpoint.sandbox.neoLife.journey.reflections = { 'm1_construct:1': 'agency' };
  checkpoint.relationships = [{ fromAgent: 'neo', toAgent: 'trinity', trust: 77, respect: 66, fear: 0, familiarity: 55, lastInteraction: 1341, notes: '旧楼撤退后仍信任彼此。' }];
  await writeFile(file, JSON.stringify(checkpoint));
  const memories = new PersistentMemoryManager(path.join(directory, 'memories'));
  memories.record('neo', 'experience', '记得管线墙前的撤退。', { importance: 9, relatedAgents: ['trinity'] });
  await memories.saveAll();
  return { directory, file, checkpoint };
}

function start(t: TestContext, directory: string, mode: string) {
  const child = spawn(process.execPath, ['--import', 'tsx', 'tests/fixtures/server-startup.mts', mode], {
    cwd: root, env: { ...process.env, MATRIX_DATA_DIR: directory, HOST: '127.0.0.1', PORT: '0', TICK_RATE_MS: mode === 'conversations' ? '100' : '10000', LLM_API_KEY: '' },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let output = '';
  child.stdout.on('data', data => { output += data; }); child.stderr.on('data', data => { output += data; });
  const finished = new Promise<number | null>(resolve => child.once('close', resolve));
  t.after(async () => { if (child.exitCode === null && child.signalCode === null) child.kill('SIGKILL'); await finished; });
  const waitFor = async (text: string) => {
    const end = Date.now() + 15000;
    while (!output.includes(text)) {
      assert.ok(child.exitCode === null && child.signalCode === null && Date.now() < end, `startup did not reach ${text}: ${output}`);
      await new Promise(resolve => setTimeout(resolve, 20));
    }
  };
  const exited = async (code: number) => {
    assert.equal(await Promise.race([finished, new Promise(resolve => setTimeout(() => resolve('shutdown timeout'), 5000).unref())]), code, output);
  };
  const stop = async (signal: NodeJS.Signals = 'SIGTERM') => { child.kill(signal); await exited(0); };
  return { waitFor, stop, exited, output: () => output };
}

async function controls(t: TestContext, server: ReturnType<typeof start>) {
  const address = JSON.parse(server.output().match(/STARTUP_LISTENING (\{[^\n]+\})/)![1]);
  const base = `http://127.0.0.1:${address.port}`;
  const socket = io(base, { autoConnect: false, transports: ['websocket'] });
  const messages: ServerMessage[] = [];
  socket.on('message', message => messages.push(message));
  t.after(() => socket.disconnect());
  const connected = new Promise<void>((resolve, reject) => { socket.once('connect', resolve); socket.once('connect_error', reject); });
  socket.connect(); await connected;
  const deadline = Date.now() + 5000;
  while (!messages.some(message => message.type === 'world_state_full')) {
    assert.ok(Date.now() < deadline, 'the initial world snapshot did not arrive');
    await new Promise(resolve => setTimeout(resolve, 20));
  }
  const world = async () => await (await fetch(`${base}/api/world`)).json() as WorldStateFull;
  const conversations = async () => (await (await fetch(`${base}/api/conversations`)).json()).active as ConversationRecord[];
  const command = async (type: string, data: unknown, ready: (state: WorldStateFull) => boolean) => {
    const marker = messages.length;
    socket.emit('message', { type, data });
    socket.emit('message', { type: 'request_full_state', data: {} });
    const end = Date.now() + 5000;
    for (;;) {
      const state = await world();
      if (messages.slice(marker).some(message => message.type === 'world_state_full') && ready(state)) return state;
      assert.ok(Date.now() < end, `${type} was not acknowledged`);
      await new Promise(resolve => setTimeout(resolve, 20));
    }
  };
  return { socket, messages, world, conversations, command };
}

async function replayed(client: Awaited<ReturnType<typeof controls>>, records: ConversationRecord[], copies = 1) {
  const starts = records.length * copies, lines = records.reduce((count, record) => count + record.messages.length, 0) * copies;
  const deadline = Date.now() + 5000;
  while (client.messages.filter(message => message.type === 'conversation_start').length < starts
    || client.messages.filter(message => message.type === 'conversation_message').length < lines) {
    assert.ok(Date.now() < deadline, 'the saved dialogue did not arrive over the reconnecting socket');
    await new Promise(resolve => setTimeout(resolve, 20));
  }
}

test('real restarts retain the completed spoon lesson prop while Neo follows the hostess', { timeout: 30000 }, async t => {
  const f = await fixture(t, 'm1_spoon'), journey = f.checkpoint.sandbox.neoLife.journey, neo = f.checkpoint.agents.neo;
  journey.step = 1; journey.oracle = { spoon: 1, spoonLesson: { phase: 'done', elapsed: 0 },
    arrival: { phase: 'done', elapsed: 0, hostess: 25.5, morpheus: 31.7, seating: 2.2 },
    reception: { phase: 'guiding', progress: 9.529, elapsed: 2.2 }, waitingTime: 68.113 };
  neo.position = filmPosition('film_oracle_home', -2, 10.8); neo.velocity = { x: 0, y: 0, z: 0 };
  neo.currentAction = { type: 'idle', parameters: { player: true, resolved: true, crouching: false, spoon: 1 }, startedAt: 1341, duration: 1, progress: 0 };
  journey.checkpoint = { ...neo.position }; f.checkpoint.simulation = { running: false, speed: 1 };
  await writeFile(f.file, JSON.stringify(f.checkpoint));
  const server = start(t, f.directory, 'normal'); await server.waitFor('STARTUP_LISTENING'); const client = await controls(t, server);
  const check = (state: WorldStateFull) => {
    assert.deepEqual(state.agents.neo.currentAction, neo.currentAction, 'cold startup must preserve the held spoon and original clock');
    assert.deepEqual(state.agents.neo.position, neo.position); assert.deepEqual(state.agents.neo.velocity, neo.velocity);
    assert.deepEqual(state.sandbox!.neoLife!.journey!.oracle, journey.oracle);
  };
  check(await client.world()); check(await client.command('play_as', { agentId: 'neo' }, state => Boolean(state.agents.neo.controller)));
  client.socket.disconnect(); await new Promise(resolve => setTimeout(resolve, 100)); check(await client.world()); await server.stop();
});

test('paused Lock restarts retain Neo’s completed farewell pose without restoring transient attacks', { timeout: 30000 }, async t => {
  const f = await fixture(t, 'm3_temple_breach'), journey = f.checkpoint.sandbox.neoLife.journey;
  const farewell = { phase: 'still' as const, elapsed: 0, total: 18.54, approach: { x: .33, z: -13.07, yaw: 3.8 } };
  journey.completed = FILM_SCENES.slice(0, FILM_SCENES.findIndex(scene => scene.id === 'm3_temple_breach')).map(scene => scene.id);
  delete journey.farewell;
  const neo = f.checkpoint.agents.neo, trinity = f.checkpoint.agents.trinity, pose = farewellPose(farewell);
  Object.assign(neo, { position: filmPosition('film_logos_wreck', pose.neo.x, pose.neo.z), rotation: pose.neo.yaw,
    velocity: { x: 0, y: 0, z: 0 }, currentLocation: 'film_logos_wreck', isInMatrix: false,
    currentAction: { type: 'idle', parameters: { player: true, resolved: true, crouching: true, farewell: { ...farewell, role: 'neo' } },
      startedAt: 1342, duration: 1, progress: 1 } });
  Object.assign(trinity, { position: filmPosition('film_logos_wreck', pose.trinity.x, pose.trinity.z), status: 'dead', health: 0 });
  f.checkpoint.agents.citizen_5.currentAction = { type: 'attack', target: 'neo', parameters: { player: true }, startedAt: 1342, duration: 1, progress: .4 };
  f.checkpoint.simulation = { running: false, speed: 1 };
  await writeFile(f.file, JSON.stringify(f.checkpoint));
  const check = (state: WorldStateFull) => {
    assert.equal(state.simulation.running, false);
    assert.equal(state.sandbox!.neoLife!.journey!.scene, 'm3_temple_breach');
    assert.equal(state.sandbox!.neoLife!.journey!.farewell, undefined);
    assert.deepEqual(state.agents.neo.currentAction, neo.currentAction, 'inactive Neo must keep his saved grief pose and original action clock');
    assert.deepEqual(state.agents.neo.position, neo.position); assert.equal(state.agents.neo.health, 63);
    assert.equal(state.agents.neo.controller, undefined);
    assert.equal(state.agents.trinity.status, 'dead'); assert.equal(state.agents.trinity.health, 0);
    assert.equal(state.agents.citizen_5.currentAction, null, 'unrelated transient player attacks must still clear');
  };
  for (let restart = 0; restart < 2; restart++) {
    const server = start(t, f.directory, 'normal'); await server.waitFor('STARTUP_LISTENING'); const client = await controls(t, server);
    check(await client.world()); check(await client.command('play_as', { agentId: 'lock' }, state => Boolean(state.agents.lock.controller)));
    check(await client.command('leave_character', {}, state => !state.agents.lock.controller));
    client.socket.disconnect(); await server.stop();
  }
});

test('real restarts preserve the complete waiting farewell action after the Oracle answer', { timeout: 30000 }, async t => {
  const f = await fixture(t, 'm1_oracle'), journey = f.checkpoint.sandbox.neoLife.journey, neo = f.checkpoint.agents.neo;
  const departure = { phase: 'waiting', elapsed: 0, rise: 0 };
  journey.step = 2; journey.oracle = { vase: 4.5, consultation: { phase: 'done', elapsed: 4.2, answer: 'agency' },
    reception: { phase: 'ready', progress: 27.894304217630726, elapsed: 0 }, departure, waitingTime: 120.7 };
  neo.position = filmPosition('film_oracle_home', -4.35, -22); neo.velocity = { x: 0, y: 0, z: 0 };
  neo.currentAction = { type: 'idle', parameters: { player: true, resolved: true, crouching: false, oracleDeparture: { ...departure, role: 'neo' } }, startedAt: 1341, duration: 1, progress: 0 };
  journey.checkpoint = { ...neo.position }; f.checkpoint.simulation = { running: false, speed: 1 };
  await writeFile(f.file, JSON.stringify(f.checkpoint));
  const server = start(t, f.directory, 'normal'); await server.waitFor('STARTUP_LISTENING'); const client = await controls(t, server);
  const check = (state: WorldStateFull) => {
    assert.deepEqual(state.agents.neo.currentAction, neo.currentAction);
    assert.deepEqual(state.agents.neo.position, neo.position); assert.deepEqual(state.sandbox!.neoLife!.journey!.oracle, journey.oracle);
  };
  check(await client.world()); check(await client.command('play_as', { agentId: 'neo' }, state => Boolean(state.agents.neo.controller)));
  client.socket.disconnect(); await new Promise(resolve => setTimeout(resolve, 100)); check(await client.world()); await server.stop();
});

for (const [phase, elapsed] of [['file', 1.2], ['response', 0], ['coercion', 9.25], ['done', 24]] as const) {
  test(`real restarts preserve all four paused ${phase} interrogation actions and clocks`, { timeout: 30000 }, async t => {
    const f = await fixture(t, 'm1_interrogation'), journey = f.checkpoint.sandbox.neoLife.journey;
    const encounter: InterrogationEncounter = { phase, elapsed, approach: { x: 5.9, z: 0, yaw: .3 } };
    journey.interrogation = encounter; journey.step = phase === 'file' ? 0 : phase === 'done' ? 2 : 1;
    const roles = ['neo', 'smith', 'agent_jones', 'agent_brown'] as const;
    for (const [index, role] of roles.entries()) {
      const actor = f.checkpoint.agents[role], pose = interrogationRoot(encounter, role);
      actor.position = filmPosition('film_agent_interrogation', pose.x, pose.z); actor.rotation = pose.yaw;
      actor.velocity = { x: 0, y: 0, z: 0 }; actor.currentLocation = 'film_agent_interrogation'; actor.isInMatrix = true;
      actor.currentAction = { type: 'idle', parameters: { player: role === 'neo', resolved: true, interrogation: { phase, elapsed, role } }, startedAt: 1300 + index, duration: 1, progress: role === 'neo' ? .25 : 1 };
    }
    f.checkpoint.agents.citizen_5.currentAction = { type: 'attack', parameters: { player: true, interrogation: { phase, elapsed, role: 'neo' } }, startedAt: 1340, duration: 1, progress: .2 };
    f.checkpoint.simulation = { running: false, speed: 1 }; await writeFile(f.file, JSON.stringify(f.checkpoint));
    const check = (state: WorldStateFull) => {
      assert.equal(state.simulation!.running, false); assert.equal(state.simulation!.tick, 1343);
      assert.deepEqual(state.sandbox!.neoLife!.journey!.interrogation, encounter);
      for (const role of roles) for (const key of ['currentAction', 'position', 'rotation', 'velocity'] as const) assert.deepEqual(state.agents[role][key], f.checkpoint.agents[role][key], `${role}: ${key}`);
      assert.equal(state.agents.neo.health, 63); assert.equal(state.agents.citizen_5.currentAction, null);
    };
    for (let restart = 0; restart < 2; restart++) {
      const server = start(t, f.directory, 'normal'); await server.waitFor('STARTUP_LISTENING'); const client = await controls(t, server);
      check(await client.world()); check(await client.command('play_as', { agentId: 'neo' }, state => Boolean(state.agents.neo.controller)));
      client.socket.disconnect(); await new Promise(resolve => setTimeout(resolve, 100)); check(await client.world()); await server.stop();
    }
  });
}

for (const [scene, phase, variant] of [['m1_subway', 'duel', 'subway-duel'], ['m1_city_chase', 'running', undefined]] as const) {
  test(`a paused ${phase} keeps the saved crouch through a server restart and reconnect`, { timeout: 30000 }, async t => {
    const f = await fixture(t, scene, variant), journey = f.checkpoint.sandbox.neoLife.journey;
    const neo = f.checkpoint.agents.neo, encounter = { ...journey.matrixEscape, phase };
    journey.matrixEscape = encounter;
    if (phase === 'running') neo.position = filmPosition('film_escape_streets', 0, 36);
    const action = { type: 'idle', parameters: { player: true, resolved: true, crouching: true,
      matrixEscape: { ...encounter, role: 'neo' } }, startedAt: f.checkpoint.tick, duration: 1, progress: 0 };
    neo.currentAction = action;
    f.checkpoint.agents.citizen_5.currentAction = action;
    f.checkpoint.simulation = { running: false, speed: 1 }; await writeFile(f.file, JSON.stringify(f.checkpoint));

    const server = start(t, f.directory, 'normal'); await server.waitFor('STARTUP_LISTENING'); const client = await controls(t, server);
    const check = (state: WorldStateFull) => {
      assert.equal(state.simulation!.running, false); assert.equal(state.simulation!.tick, f.checkpoint.tick);
      assert.deepEqual(state.agents.neo.currentAction, action);
      assert.deepEqual(state.agents.neo.position, neo.position);
      assert.deepEqual(state.sandbox!.neoLife!.journey!.matrixEscape, encounter);
      assert.equal(state.agents.citizen_5.currentAction, null, 'discard transient inputs from other players');
    };
    const restored = await client.world(); assert.equal(restored.agents.neo.controller, undefined); check(restored);
    check(await client.command('play_as', { agentId: 'neo' }, state => Boolean(state.agents.neo.controller)));
    client.socket.disconnect(); await new Promise(resolve => setTimeout(resolve, 100)); check(await client.world()); await server.stop();
  });
}

for (const savedAction of [true, false]) {
  test(`a paused bridge capture ${savedAction ? 'keeps its saved action' : 'recovers its missing action'} at startup and reconnect`, { timeout: 30000 }, async t => {
    const f = await fixture(t, 'm1_bridge', 'meeting');
    const journey = f.checkpoint.sandbox.neoLife.journey, neo = f.checkpoint.agents.neo;
    const position = { ...neo.position, z: neo.position.z + 2 };
    const tail = { phase: 'failed', alert: 70, lastTick: 1342, attempts: 1, spawned: true };
    journey.bridgeTail = tail;
    f.checkpoint.sandbox.threats.push({ id: 'bridge:tail', scene: 'm1_bridge', kind: 'agent', patrol: true, yaw: Math.PI,
      position, matrix: true, health: 80, maxHealth: 80, target: 'neo', stunUntil: 1300, lastStrike: 1300 });
    const action = { type: 'idle', parameters: { bridgeCaught: { x: position.x, z: position.z } },
      startedAt: savedAction ? 1320 : f.checkpoint.tick, duration: 1, progress: 0 };
    neo.currentAction = savedAction ? action : null;
    f.checkpoint.simulation = { running: false, speed: 1 }; await writeFile(f.file, JSON.stringify(f.checkpoint));
    const check = (state: WorldStateFull) => {
      assert.equal(state.simulation!.running, false); assert.equal(state.simulation!.tick, f.checkpoint.tick);
      assert.deepEqual(state.sandbox!.neoLife!.journey!.bridgeTail, tail);
      assert.deepEqual(state.sandbox!.threats.find(threat => threat.id === 'bridge:tail')!.position, position);
      assert.deepEqual(state.agents.neo.position, neo.position);
      assert.deepEqual(state.agents.neo.currentAction, action);
    };
    const server = start(t, f.directory, 'normal'); await server.waitFor('STARTUP_LISTENING'); const client = await controls(t, server);
    check(await client.world()); check(await client.command('play_as', { agentId: 'neo' }, state => Boolean(state.agents.neo.controller)));
    client.socket.disconnect(); await new Promise(resolve => setTimeout(resolve, 100)); check(await client.world()); await server.stop();
  });
}

for (const savedAction of [true, false]) {
  test(`a paused tracker extraction ${savedAction ? 'preserves all four actions' : 'rebuilds the missing Neo action'} across a cold start`, { timeout: 30000 }, async t => {
    const f = await fixture(t, 'm1_bridge', 'meeting-scan'), journey = f.checkpoint.sandbox.neoLife.journey;
    assert.equal(journey.scene, 'm1_bug'); assert.equal(journey.meeting.phase, 'removing');
    const roles = ['neo', 'trinity', 'switch', 'apoc'] as const;
    const actions = Object.fromEntries(roles.map((role, index) => {
      const actor = f.checkpoint.agents[role];
      const action = { ...actor.currentAction, startedAt: role === 'neo' && !savedAction ? f.checkpoint.tick : 1300 + index };
      actor.currentAction = role === 'neo' && !savedAction ? null : action;
      return [role, action];
    }));
    f.checkpoint.simulation = { running: false, speed: 1 }; await writeFile(f.file, JSON.stringify(f.checkpoint));
    const check = (state: WorldStateFull) => {
      assert.equal(state.simulation!.running, false); assert.equal(state.simulation!.tick, f.checkpoint.tick);
      const restored = state.sandbox!.neoLife!.journey!;
      assert.deepEqual(restored.meeting, journey.meeting); assert.equal(restored.office!.bugged, true);
      assert.equal(restored.lastText, journey.lastText);
      for (const role of roles) {
        assert.deepEqual(state.agents[role].currentAction, actions[role], role);
        for (const key of ['position', 'rotation', 'velocity'] as const) assert.deepEqual(state.agents[role][key], f.checkpoint.agents[role][key], `${role}: ${key}`);
      }
    };
    const server = start(t, f.directory, 'normal'); await server.waitFor('STARTUP_LISTENING'); const client = await controls(t, server);
    check(await client.world()); check(await client.command('play_as', { agentId: 'neo' }, state => Boolean(state.agents.neo.controller)));
    client.socket.disconnect(); await new Promise(resolve => setTimeout(resolve, 100)); check(await client.world()); await server.stop();
  });
}

for (const [mode, signal] of [['memories', 'SIGTERM'], ['checkpoint', 'SIGINT']] as const) {
  test(`shutdown during ${mode} loading must preserve the last complete world and memories`, { timeout: 30000 }, async t => {
    const f = await fixture(t);
    const worldBefore = await readFile(f.file, 'utf8'), memoryBefore = await readFile(path.join(f.directory, 'memories/neo.json'), 'utf8');
    const server = start(t, f.directory, mode); await server.waitFor('STARTUP_BLOCKED'); await server.stop(signal);
    assert.equal(fingerprint(await readFile(f.file, 'utf8')), fingerprint(worldBefore), 'an uninitialized process must not replace the saved story with tick zero');
    assert.equal(await readFile(path.join(f.directory, 'memories/neo.json'), 'utf8'), memoryBefore);
  });
}

test('shutdown after a rejected checkpoint preserves the original file for recovery', { timeout: 30000 }, async t => {
  const f = await fixture(t); const damaged = '{"version":1,"tick":"damaged","recoverable":"Neo at the old house"}';
  await writeFile(f.file, damaged);
  const server = start(t, f.directory, 'normal'); await server.waitFor('Unsupported world checkpoint'); await server.exited(1);
  assert.doesNotMatch(server.output(), /STARTUP_LISTENING/, 'a rejected checkpoint cannot serve a replacement world');
  assert.equal(await readFile(f.file, 'utf8'), damaged, 'a failed load must not silently replace the original with a new world');
});

test('a damaged character memory blocks startup while preserving the world and damaged file for recovery', { timeout: 30000 }, async t => {
  const f = await fixture(t), memoryFile = path.join(f.directory, 'memories/neo.json');
  const worldBefore = await readFile(f.file, 'utf8'), damaged = '{"agentId":"neo","memories":[';
  await writeFile(memoryFile, damaged);
  const server = start(t, f.directory, 'normal'); await server.exited(1);
  assert.match(server.output(), /Cannot load character memory neo\.json/);
  assert.doesNotMatch(server.output(), /STARTUP_LISTENING/, 'an incomplete set of character memories cannot serve a replacement world');
  assert.equal(await readFile(f.file, 'utf8'), worldBefore);
  assert.equal(await readFile(memoryFile, 'utf8'), damaged);
});

test('a fully loaded server saves and resumes the same story, memories and relationships across restarts', { timeout: 30000 }, async t => {
  const f = await fixture(t);
  for (let restart = 0; restart < 2; restart++) {
    const server = start(t, f.directory, 'normal'); await server.waitFor('STARTUP_LISTENING');
    const address = JSON.parse(server.output().match(/STARTUP_LISTENING (\{[^\n]+\})/)![1]);
    const world = await (await fetch(`http://127.0.0.1:${address.port}/api/world`)).json();
    const context = await (await fetch(`http://127.0.0.1:${address.port}/api/agents/neo/context`)).json();
    assert.equal(world.simulation.tick, 1343); assert.equal(world.simulation.day, 9); assert.equal(world.timeOfDay, 8500);
    assert.equal(world.agents.neo.health, 63); assert.equal(world.agents.neo.controller, undefined); assert.equal(world.agents.mouse.status, 'dead');
    assert.deepEqual(world.sandbox.neoLife.journey, f.checkpoint.sandbox.neoLife.journey);
    assert.equal(context.memories[0].content, '记得管线墙前的撤退。');
    assert.ok(context.relationships.some((r: { toAgent: string; trust: number }) => r.toAgent === 'trinity' && r.trust === 77));
    await server.stop();
    const saved = JSON.parse(await readFile(f.file, 'utf8'));
    assert.equal(saved.tick, 1343); assert.equal(saved.agents.neo.controller, undefined, 'normal shutdown must still write the loaded world');
    assert.deepEqual(saved.sandbox.neoLife.journey, f.checkpoint.sandbox.neoLife.journey);
  }
});

test('a first startup without a world checkpoint still saves a usable new world', { timeout: 30000 }, async t => {
  const f = await fixture(t); await rm(f.file);
  const server = start(t, f.directory, 'normal'); await server.waitFor('STARTUP_LISTENING'); await server.stop();
  const saved = JSON.parse(await readFile(f.file, 'utf8'));
  assert.equal(saved.version, 1); assert.equal(saved.tick, 0);
  assert.ok(saved.agents.neo && saved.agents.trinity);
  assert.ok(Array.isArray(saved.events) && Array.isArray(saved.relationships));
  const restored = start(t, f.directory, 'normal'); await restored.waitFor('Restored world at tick 0');
  await restored.waitFor('STARTUP_LISTENING'); await restored.stop();
});

for (const [mode, phase] of [['commute', 'travel'], ['daily', 'closing'], ['legacy', 'opening']] as const) {
  test(`a cold ${mode} lift save preserves or recovers its passenger action`, { timeout: 30000 }, async t => {
    const f = await fixture(t, 'm1_commute'), life = f.checkpoint.sandbox.neoLife, actor = f.checkpoint.agents.neo;
    const { x, z } = metacortexPosition(.1, -29);
    const lift: MetacortexLift = { floor: phase === 'opening' ? 1 : 0, target: 1, phase, elapsed: phase === 'travel' ? 2.36 : .4, passenger: { x, z } };
    life.lift = lift;
    actor.position = { x, y: 1 + metacortexLiftPose(lift).height, z }; actor.currentLocation = 'metacortex_office';
    if (mode === 'daily') delete life.journey;
    else { life.journey.step = 1; life.journey.checkpoint = { ...actor.position }; }
    const recovered = { type: 'idle', parameters: { player: true, resolved: true, metacortexLift: true },
      startedAt: f.checkpoint.tick, duration: 1, progress: 0 };
    const saved = { ...recovered, startedAt: f.checkpoint.tick - 1 };
    actor.currentAction = mode === 'legacy' ? null : saved;
    f.checkpoint.simulation = { running: false, speed: 1 }; await writeFile(f.file, JSON.stringify(f.checkpoint));
    const check = (state: WorldStateFull) => {
      assert.equal(state.simulation!.running, false); assert.equal(state.simulation!.tick, f.checkpoint.tick);
      assert.deepEqual(state.sandbox!.neoLife!.lift, lift);
      assert.deepEqual(state.agents.neo.position, actor.position);
      assert.deepEqual(state.agents.neo.currentAction, mode === 'legacy' ? recovered : saved);
    };
    const server = start(t, f.directory, 'normal'); await server.waitFor('STARTUP_LISTENING'); const client = await controls(t, server);
    check(await client.world()); check(await client.command('play_as', { agentId: 'neo' }, state => Boolean(state.agents.neo.controller)));
    client.socket.disconnect();
    const deadline = Date.now() + 5000;
    while ((await client.world()).agents.neo.controller) {
      assert.ok(Date.now() < deadline, 'the paused passenger was not released'); await new Promise(resolve => setTimeout(resolve, 20));
    }
    check(await client.world()); await server.stop();
  });
}

for (const savedAction of ['matching', 'missing', 'stale'] as const) {
  test(`a cold office briefing restores a ${savedAction} action before input`, { timeout: 30000 }, async t => {
    const f = await fixture(t, 'm1_boss', 'workday'), journey = f.checkpoint.sandbox.neoLife.journey, actor = f.checkpoint.agents.neo;
    journey.workday = { phase: 'briefing', elapsed: 3.8 };
    const recovered = { type: 'idle', parameters: { player: true, resolved: true, workday: { ...journey.workday, role: 'neo' } },
      startedAt: f.checkpoint.tick, duration: 1, progress: 0 };
    const saved = { ...recovered, startedAt: f.checkpoint.tick - 1 };
    actor.currentAction = savedAction === 'matching' ? saved : null;
    if (savedAction === 'stale') {
      actor.currentAction = { ...saved, parameters: { ...saved.parameters, workday: { ...saved.parameters.workday, elapsed: 2 } } };
      actor.targetPosition = { ...actor.position, z: actor.position.z + 2 };
      actor.currentPath = [actor.targetPosition];
    }
    f.checkpoint.simulation = { running: false, speed: 1 }; await writeFile(f.file, JSON.stringify(f.checkpoint));
    const check = (state: WorldStateFull) => {
      assert.equal(state.simulation!.running, false); assert.equal(state.simulation!.tick, f.checkpoint.tick);
      assert.deepEqual(state.sandbox!.neoLife!.journey!.workday, journey.workday);
      assert.deepEqual(state.agents.neo.currentAction, savedAction === 'matching' ? saved : recovered);
      assert.deepEqual(state.agents.neo.position, actor.position); assert.equal(state.agents.neo.rotation, actor.rotation);
      assert.equal(state.agents.neo.targetPosition, null); assert.deepEqual(state.agents.neo.currentPath, []);
    };
    const server = start(t, f.directory, 'normal'); await server.waitFor('STARTUP_LISTENING'); const client = await controls(t, server);
    check(await client.world()); check(await client.command('play_as', { agentId: 'neo' }, state => Boolean(state.agents.neo.controller)));
    await server.stop();
  });
}

for (const [phase, elapsed] of [['pickup', .8], ['ready', 0], ['answering', 3.3], ['connected', 11]] as const) {
  test(`real restarts retain the paused ${phase} office phone action and clock`, { timeout: 30000 }, async t => {
    const f = await fixture(t, 'm1_boss', 'phone'), journey = f.checkpoint.sandbox.neoLife.journey, actor = f.checkpoint.agents.neo;
    journey.step = phase === 'connected' ? 2 : 1; journey.phone = { phase, elapsed };
    actor.rotation = Math.PI; actor.velocity = { x: 0, y: 0, z: 0 };
    actor.currentAction = { type: 'idle', parameters: { player: true, resolved: true, phone: { phase, elapsed } }, startedAt: 1341, duration: 1, progress: .37 };
    f.checkpoint.agents.citizen_5.currentAction = { type: 'attack', parameters: { player: true }, startedAt: 1340, duration: 1, progress: .2 };
    f.checkpoint.simulation = { running: false, speed: 1 }; await writeFile(f.file, JSON.stringify(f.checkpoint));
    const check = (state: WorldStateFull) => {
      assert.equal(state.simulation!.running, false); assert.equal(state.simulation!.tick, 1343);
      assert.deepEqual(state.sandbox!.neoLife!.journey!.phone, journey.phone);
      for (const key of ['currentAction', 'position', 'rotation', 'velocity'] as const) assert.deepEqual(state.agents.neo[key], actor[key], `${phase}: ${key}`);
      assert.equal(state.agents.citizen_5.currentAction, null, 'unrelated transient attacks must still clear');
    };
    for (let restart = 0; restart < 2; restart++) {
      const server = start(t, f.directory, 'normal'); await server.waitFor('STARTUP_LISTENING'); const client = await controls(t, server);
      check(await client.world()); check(await client.command('play_as', { agentId: 'neo' }, state => Boolean(state.agents.neo.controller)));
      client.socket.disconnect(); await new Promise(resolve => setTimeout(resolve, 100)); check(await client.world());
      await server.stop();
    }
  });
}

for (const [scene, savedType] of [
  ['m1_office_escape', 'idle'],
  ['m1_ledge', 'idle'],
  ['m1_office_escape', 'move_to'],
  ['m1_office_escape', null],
] as const) {
  test(`a paused ${scene} save with ${savedType ?? 'no action'} restores the held phone before input`, { timeout: 30000 }, async t => {
    const f = await fixture(t, scene, scene === 'm1_office_escape' ? 'crossing' : undefined);
    const journey = f.checkpoint.sandbox.neoLife.journey, actor = f.checkpoint.agents.neo;
    journey.phone = { phase: 'connected', elapsed: 11 };
    assert.equal(journey.step, scene === 'm1_office_escape' ? 3 : 0);
    assert.equal(journey.office.crossing, undefined);
    const stopped = { x: 0, y: 0, z: 0 };
    const idle = { type: 'idle', parameters: { player: true, resolved: true, phone: { ...journey.phone } },
      startedAt: f.checkpoint.tick, duration: 1, progress: 0 };
    const saved = { ...idle, type: savedType, parameters: { ...idle.parameters, crouching: scene === 'm1_office_escape' },
      startedAt: 1341, progress: .37 };
    actor.currentAction = savedType ? saved : null;
    actor.velocity = savedType === 'move_to' ? { x: -2, y: 0, z: 0 } : stopped;
    f.checkpoint.agents.citizen_5.currentAction = { ...saved, type: 'idle' };
    f.checkpoint.simulation = { running: false, speed: 1 }; await writeFile(f.file, JSON.stringify(f.checkpoint));
    const check = (state: WorldStateFull) => {
      assert.equal(state.simulation!.running, false); assert.equal(state.simulation!.tick, f.checkpoint.tick);
      assert.deepEqual(state.sandbox!.neoLife!.journey!.office, journey.office);
      assert.deepEqual(state.sandbox!.neoLife!.journey!.phone, journey.phone);
      assert.deepEqual(state.agents.neo.currentAction, savedType === 'idle' || savedType === 'move_to' && scene === 'm1_office_escape' ? saved : idle);
      assert.deepEqual(state.agents.neo.position, actor.position); assert.equal(state.agents.neo.rotation, actor.rotation);
      assert.deepEqual(state.agents.neo.velocity, stopped);
      assert.equal(state.agents.citizen_5.currentAction, null);
    };
    const server = start(t, f.directory, 'normal'); await server.waitFor('STARTUP_LISTENING'); const client = await controls(t, server);
    check(await client.world()); check(await client.command('play_as', { agentId: 'neo' }, state => Boolean(state.agents.neo.controller)));
    client.socket.disconnect(); await new Promise(resolve => setTimeout(resolve, 100));
    const released = await client.world(); assert.equal(released.agents.neo.controller, undefined); check(released);
    await server.stop();
  });
}

test('real restarts retain the paused office window contact and resume its remaining motion', { timeout: 30000 }, async t => {
  const f = await fixture(t, 'm1_office_escape'), journey = f.checkpoint.sandbox.neoLife.journey, actor = f.checkpoint.agents.neo;
  journey.step = 2; journey.phone = { phase: 'connected', elapsed: 11 };
  actor.position = filmPosition('film_metacortex_floor', OFFICE_WINDOW.approachX, OFFICE_WINDOW.approachZ);
  actor.currentAction = null; journey.checkpoint = { ...actor.position };
  f.checkpoint.simulation = { running: false, speed: 1 }; await writeFile(f.file, JSON.stringify(f.checkpoint));
  const server = start(t, f.directory, 'normal'); await server.waitFor('STARTUP_LISTENING'); const client = await controls(t, server);
  await client.command('play_as', { agentId: 'neo' }, state => Boolean(state.agents.neo.controller));
  await client.command('resume', {}, state => state.simulation!.running);
  await client.command('sandbox_action', { kind: 'life', target: 'film:act' }, state => typeof state.agents.neo.currentAction?.parameters.window === 'number');
  const deadline = Date.now() + 5000;
  while (Number((await client.world()).agents.neo.currentAction?.parameters.window ?? 0) < 1.1) {
    assert.ok(Date.now() < deadline, 'the native window action never reached its checkpoint'); await new Promise(resolve => setTimeout(resolve, 20));
  }
  const paused = await client.command('pause', {}, state => !state.simulation!.running);
  client.socket.disconnect(); await server.stop();
  const check = (state: WorldStateFull) => {
    assert.equal(state.simulation!.running, false);
    assert.deepEqual(state.sandbox!.neoLife!.journey!.office, paused.sandbox!.neoLife!.journey!.office);
    for (const key of ['currentAction', 'position', 'rotation', 'velocity'] as const) assert.deepEqual(state.agents.neo[key], paused.agents.neo[key], key);
  };
  for (let restart = 0; restart < 2; restart++) {
    const resumed = start(t, f.directory, 'normal'); await resumed.waitFor('STARTUP_LISTENING'); const next = await controls(t, resumed);
    check(await next.world()); check(await next.command('play_as', { agentId: 'neo' }, state => Boolean(state.agents.neo.controller)));
    next.socket.disconnect(); await new Promise(resolve => setTimeout(resolve, 100)); check(await next.world()); await resumed.stop();
  }
  const resumed = start(t, f.directory, 'normal'); await resumed.waitFor('STARTUP_LISTENING'); const next = await controls(t, resumed);
  await next.command('play_as', { agentId: 'neo' }, state => Boolean(state.agents.neo.controller));
  await next.command('resume', {}, state => state.simulation!.running);
  const finished = Date.now() + 5000;
  while ((await next.world()).sandbox!.neoLife!.journey!.step !== 3) {
    assert.ok(Date.now() < finished, 'the restored window did not complete'); await new Promise(resolve => setTimeout(resolve, 20));
  }
  const complete = await next.command('pause', {}, state => !state.simulation!.running);
  assert.equal(complete.sandbox!.neoLife!.journey!.office!.window, OFFICE_WINDOW.seconds); await resumed.stop();
});

test('real restarts recover legacy ledge retreat into office custody only once', { timeout: 30000 }, async t => {
  const f = await fixture(t, 'm1_ledge'), journey = f.checkpoint.sandbox.neoLife.journey;
  journey.step = FILM_SCENE_BY_ID.m1_ledge.steps.length;
  journey.office.outcome = 'captured'; delete journey.office.custody;
  journey.completed = [...new Set([...journey.completed, 'm1_ledge'])];
  f.checkpoint.sandbox.neoLife.choices.office_escape = 'captured';
  f.checkpoint.simulation = { running: false, speed: 1 }; await writeFile(f.file, JSON.stringify(f.checkpoint));
  let expected;
  for (let restart = 0; restart < 2; restart++) {
    const server = start(t, f.directory, 'normal'); await server.waitFor('STARTUP_LISTENING'); const client = await controls(t, server);
    const check = (state: WorldStateFull) => {
      const restored = state.sandbox!.neoLife!.journey!;
      assert.equal(restored.scene, 'm1_office_escape'); assert.equal(restored.office?.custody?.phase, 'securing');
      assert.equal(restored.completed.filter(id => id === 'm1_ledge').length, 1);
      assert.equal(state.agents.neo.currentLocation, 'film_metacortex_floor');
      assert.deepEqual(state.agents.neo.position, filmPosition('film_metacortex_floor', OFFICE_WINDOW.approachX, OFFICE_WINDOW.approachZ));
      assert.equal(state.agents.neo.health, 63); assert.equal(state.simulation!.running, false);
      assert.equal(state.simulation!.tick, 1343);
      for (const key of ['money', 'evidence', 'choices'] as const) assert.deepEqual(state.sandbox!.neoLife![key], f.checkpoint.sandbox.neoLife[key]);
      expected ??= structuredClone(restored.office!.custody);
      assert.deepEqual(restored.office!.custody, expected);
    };
    check(await client.world()); check(await client.command('play_as', { agentId: 'neo' }, state => Boolean(state.agents.neo.controller)));
    client.socket.disconnect(); await new Promise(resolve => setTimeout(resolve, 100)); check(await client.world()); await server.stop();
  }
});

for (const phase of ['crossing', 'climbing'] as const) {
  test(`real restarts retain the paused office ${phase} performance and clock`, { timeout: 30000 }, async t => {
    const f = await fixture(t, phase === 'crossing' ? 'm1_office_escape' : 'm1_ledge', phase === 'crossing' ? 'crossing' : undefined);
    if (phase === 'climbing') {
      const journey = f.checkpoint.sandbox.neoLife.journey, actor = f.checkpoint.agents.neo;
      journey.step = 1; actor.position = filmStepPosition(FILM_SCENE_BY_ID.m1_ledge, FILM_SCENE_BY_ID.m1_ledge.steps[1]);
      actor.currentAction = null; actor.velocity = { x: 0, y: 0, z: 0 }; journey.checkpoint = { ...actor.position };
    }
    f.checkpoint.agents.citizen_5.currentAction = { type: 'attack', parameters: { player: true, climbing: true }, startedAt: 1340, duration: 1, progress: .2 };
    f.checkpoint.simulation = { running: false, speed: 1 }; await writeFile(f.file, JSON.stringify(f.checkpoint));
    const server = start(t, f.directory, 'normal'); await server.waitFor('STARTUP_LISTENING'); const client = await controls(t, server);
    await client.command('play_as', { agentId: 'neo' }, state => Boolean(state.agents.neo.controller));
    await client.command('resume', {}, state => state.simulation!.running);
    const progress = (state: WorldStateFull) => state.sandbox!.neoLife!.journey!.office![phase === 'crossing' ? 'crossing' : 'climbed'];
    await client.command('sandbox_action', { kind: 'life', target: phase === 'crossing' ? 'film:next' : 'film:escape:climb' }, state => progress(state) !== undefined);
    let sequence = 0;
    const descend = () => client.socket.emit('message', { type: 'player_input', data: { x: 0, z: 0, yaw: Math.PI / 2, sprint: false, jump: false, climb: 1, sequence: ++sequence } });
    const input = phase === 'climbing' ? setInterval(descend, 80) : undefined;
    try {
      if (input) descend();
      const deadline = Date.now() + 5000;
      while ((progress(await client.world()) ?? 0) < (phase === 'crossing' ? 2.2 : 7.2)) {
        assert.ok(Date.now() < deadline, `the actual ${phase} never reached its checkpoint`); await new Promise(resolve => setTimeout(resolve, 20));
      }
    } finally { if (input) clearInterval(input); }
    const paused = await client.command('pause', {}, state => !state.simulation!.running);
    client.socket.disconnect(); await server.stop();
    const check = (state: WorldStateFull) => {
      assert.equal(state.simulation!.running, false);
      assert.deepEqual(state.sandbox!.neoLife!.journey!.office, paused.sandbox!.neoLife!.journey!.office);
      for (const key of ['currentAction', 'position', 'rotation', 'velocity'] as const) assert.deepEqual(state.agents.neo[key], paused.agents.neo[key], `${phase}: ${key}`);
      assert.equal(state.agents.citizen_5.currentAction, null, 'unrelated player attacks must still clear');
    };
    for (let restart = 0; restart < 2; restart++) {
      const resumed = start(t, f.directory, 'normal'); await resumed.waitFor('STARTUP_LISTENING'); const next = await controls(t, resumed);
      check(await next.world()); check(await next.command('play_as', { agentId: 'neo' }, state => Boolean(state.agents.neo.controller)));
      next.socket.disconnect(); await new Promise(resolve => setTimeout(resolve, 100)); check(await next.world()); await resumed.stop();
    }
  });
}

for (const savedAction of [true, false]) {
  test(`a paused 1313 knock ${savedAction ? 'keeps its saved action' : 'recovers its missing action'} at startup and reconnect`, { timeout: 30000 }, async t => {
    const f = await fixture(t, 'm1_pills', 'knock'), journey = f.checkpoint.sandbox.neoLife.journey;
    const hotel = journey.hotel, neo = f.checkpoint.agents.neo, guide = f.checkpoint.agents.trinity;
    hotel.knock = .92; hotel.knockFrom = { x: 24.8, z: -.8, yaw: 0 };
    const pose = lafayetteKnockRoot(hotel);
    neo.position = filmPosition('film_lafayette', pose.x, pose.z); neo.rotation = pose.yaw; journey.checkpoint = { ...neo.position };
    const action = { type: 'idle', parameters: { player: true, resolved: true, knock: hotel.knock },
      startedAt: savedAction ? 1341 : f.checkpoint.tick, duration: 1, progress: savedAction ? .25 : 0 };
    neo.currentAction = savedAction ? action : null;
    guide.currentAction = { ...guide.currentAction, startedAt: 1340, progress: .5 };
    f.checkpoint.simulation = { running: false, speed: 1 }; await writeFile(f.file, JSON.stringify(f.checkpoint));
    const check = (world: WorldStateFull) => {
      assert.equal(world.simulation!.running, false); assert.equal(world.simulation!.tick, f.checkpoint.tick);
      assert.deepEqual(world.sandbox!.neoLife!.journey!.hotel, hotel);
      assert.deepEqual(world.agents.neo.currentAction, action);
      assert.deepEqual(world.agents.neo.position, neo.position);
      assert.deepEqual(world.agents.trinity.currentAction, guide.currentAction);
      assert.deepEqual(world.agents.trinity.position, guide.position);
    };
    const server = start(t, f.directory, 'normal'); await server.waitFor('STARTUP_LISTENING'); const client = await controls(t, server);
    check(await client.world()); check(await client.command('play_as', { agentId: 'neo' }, state => Boolean(state.agents.neo.controller)));
    client.socket.disconnect(); await new Promise(resolve => setTimeout(resolve, 100)); check(await client.world()); await server.stop();
  });
}

for (const [phase, elapsed] of [['approach', 1.2], ['ready', 0], ['handshake', 1.3], ['departing', 2.5]] as const) {
  test(`real restarts and re-entry preserve all three paused ${phase} greeting actions`, { timeout: 30000 }, async t => {
    const f = await fixture(t, 'm1_pills', 'welcome'), journey = f.checkpoint.sandbox.neoLife.journey;
    journey.hotel.welcome = { phase, elapsed };
    for (const role of ['neo', 'morpheus', 'trinity'] as const) {
      const actor = f.checkpoint.agents[role], pose = lafayetteWelcomeRoot(journey.hotel.welcome, role);
      actor.position = filmPosition('film_lafayette', pose.x, pose.z); actor.rotation = pose.yaw;
      actor.velocity = { x: 0, y: 0, z: 0 };
      actor.currentAction = { type: 'idle', parameters: { player: role === 'neo', resolved: true, seated: false, welcome: { phase, elapsed, role } }, startedAt: 1341, duration: 1, progress: .37 };
    }
    f.checkpoint.agents.citizen_5.currentAction = { type: 'attack', parameters: { player: true }, startedAt: 1340, duration: 1, progress: .2 };
    f.checkpoint.simulation = { running: false, speed: 1 }; await writeFile(f.file, JSON.stringify(f.checkpoint));
    for (let restart = 0; restart < 2; restart++) {
      const server = start(t, f.directory, 'normal'); await server.waitFor('STARTUP_LISTENING');
      const client = await controls(t, server), cold = await client.world();
      assert.equal(cold.simulation!.running, false); assert.equal(cold.simulation!.tick, 1343);
      assert.deepEqual(cold.sandbox!.neoLife!.journey!.hotel!.welcome, journey.hotel.welcome);
      assert.equal(cold.agents.citizen_5.currentAction, null, 'transient player attacks still clear');
      const check = (world: WorldStateFull) => {
        for (const role of ['neo', 'morpheus', 'trinity'] as const) {
          assert.deepEqual(world.agents[role].currentAction, f.checkpoint.agents[role].currentAction, `${role}: retain the saved greeting action and clock`);
          assert.deepEqual(world.agents[role].position, f.checkpoint.agents[role].position);
        }
      };
      check(cold);
      check(await client.command('play_as', { agentId: 'neo' }, state => Boolean(state.agents.neo.controller)));
      client.socket.disconnect(); await new Promise(resolve => setTimeout(resolve, 100)); check(await client.world());
      await server.stop();
    }
  });
}

for (const phase of ['breach', 'dive', 'ladder_ready', 'climbing'] as const) {
  test(`real restarts and re-entry retain the paused 303 ${phase} performance`, { timeout: 30000 }, async t => {
    const f = await fixture(t, 'm1_room303'), journey = f.checkpoint.sandbox.neoLife.journey, actor = f.checkpoint.agents.trinity;
    journey.step = phase === 'breach' ? 1 : phase === 'dive' ? 4 : 5;
    Object.assign(journey.openingHotel, { phase, elapsed: .8, climbed: phase === 'climbing' ? 2.4 : 0, lastTick: 1343 });
    const ladder = phase === 'ladder_ready' || phase === 'climbing';
    actor.position = filmPosition('film_heart_hotel', 0, ladder ? OPENING_HOTEL.ladderZ : phase === 'dive' ? -26 : 12);
    if (ladder) actor.position.y += -.35 + journey.openingHotel.climbed;
    if (phase === 'dive') actor.position.y += .925;
    actor.rotation = Math.PI;
    actor.velocity = phase === 'dive' ? { x: 0, y: -.35 / OPENING_HOTEL.diveSeconds, z: -6 / OPENING_HOTEL.diveSeconds } : { x: 0, y: 0, z: 0 };
    actor.currentAction = { type: ladder ? 'move_to' : 'idle', parameters: ladder
      ? { player: true, resolved: true, climbing: true, climbDirection: 0 }
      : { resolved: true, hotel303: { phase: phase === 'breach' ? 'surrender' : 'dive', elapsed: .8 } }, startedAt: 1341, duration: 1, progress: .37 };
    f.checkpoint.agents.citizen_5.currentAction = { type: 'attack', parameters: { player: true }, startedAt: 1340, duration: 1, progress: .2 };
    f.checkpoint.simulation = { running: false, speed: 1 }; await writeFile(f.file, JSON.stringify(f.checkpoint));
    const check = (state: WorldStateFull) => {
      assert.deepEqual(state.sandbox!.neoLife!.journey!.openingHotel, journey.openingHotel);
      for (const key of ['currentAction', 'position', 'rotation', 'velocity'] as const) assert.deepEqual(state.agents.trinity[key], actor[key], `${phase}: ${key}`);
      assert.equal(state.agents.citizen_5.currentAction, null, 'transient attacks must still clear');
    };
    for (let restart = 0; restart < 2; restart++) {
      const server = start(t, f.directory, 'normal'); await server.waitFor('STARTUP_LISTENING');
      const client = await controls(t, server); check(await client.world());
      check(await client.command('play_as', { agentId: 'trinity' }, state => Boolean(state.agents.trinity.controller)));
      client.socket.disconnect(); await new Promise(resolve => setTimeout(resolve, 100)); check(await client.world());
      await server.stop();
    }
  });
}

for (const elapsed of [.7, 2.2, 3]) {
  test(`real restarts preserve the actual rooftop exit at ${elapsed} seconds`, { timeout: 30000 }, async t => {
    const f = await fixture(t, 'm1_roofs'), journey = f.checkpoint.sandbox.neoLife.journey, actor = f.checkpoint.agents.trinity;
    journey.step = 2; journey.openingRoof = { phase: 'running', lastTick: 1343, attempts: 0, crossed: true };
    actor.currentLocation = 'film_hotel_roofs'; actor.position = filmPosition('film_hotel_roofs', 0, -38); actor.currentAction = null;
    f.checkpoint.simulation = { running: false, speed: 1 }; await writeFile(f.file, JSON.stringify(f.checkpoint));
    const server = start(t, f.directory, 'normal'); await server.waitFor('STARTUP_LISTENING'); const client = await controls(t, server);
    await client.command('play_as', { agentId: 'trinity' }, state => Boolean(state.agents.trinity.controller));
    await client.command('resume', {}, state => state.simulation!.running);
    await client.command('sandbox_action', { kind: 'life', target: 'film:act' }, state => Boolean(state.agents.trinity.currentAction?.parameters.roofExit));
    const deadline = Date.now() + 5000;
    while (Number(((await client.world()).agents.trinity.currentAction?.parameters.roofExit as { elapsed: number } | undefined)?.elapsed ?? 0) < elapsed) {
      assert.ok(Date.now() < deadline, 'the actual exit never reached its checkpoint'); await new Promise(resolve => setTimeout(resolve, 20));
    }
    const paused = await client.command('pause', {}, state => !state.simulation!.running);
    client.socket.disconnect(); await server.stop();
    const check = (state: WorldStateFull) => {
      assert.deepEqual(state.sandbox!.neoLife!.journey!.openingRoof, paused.sandbox!.neoLife!.journey!.openingRoof);
      for (const key of ['currentAction', 'position', 'rotation', 'velocity'] as const) assert.deepEqual(state.agents.trinity[key], paused.agents.trinity[key], key);
    };
    for (let restart = 0; restart < 2; restart++) {
      const resumed = start(t, f.directory, 'normal'); await resumed.waitFor('STARTUP_LISTENING'); const next = await controls(t, resumed);
      check(await next.world()); check(await next.command('play_as', { agentId: 'trinity' }, state => Boolean(state.agents.trinity.controller)));
      next.socket.disconnect(); await new Promise(resolve => setTimeout(resolve, 100)); check(await next.world()); await resumed.stop();
    }
  });
}

test('real restarts preserve paused pill action clocks and progress for both performers', { timeout: 30000 }, async t => {
  const f = await fixture(t, 'm1_pills'), journey = f.checkpoint.sandbox.neoLife.journey;
  journey.pills = { phase: 'talking', elapsed: 4.3, conversation: { beat: 1, belief: 'agency' },
    approach: { x: PILL_ROOM.seat, z: PILL_ROOM.z, yaw: -Math.PI / 2 } };
  for (const role of ['neo', 'morpheus'] as const) {
    const actor = f.checkpoint.agents[role];
    actor.position = filmPosition('film_lafayette', role === 'neo' ? PILL_ROOM.seat : -PILL_ROOM.seat, PILL_ROOM.z);
    actor.rotation = role === 'neo' ? -Math.PI / 2 : Math.PI / 2;
    actor.currentAction = { type: 'idle', parameters: { ...(role === 'neo' ? { player: true, resolved: true } : { seated: true }),
      pills: { phase: 'talking', elapsed: 4.3, conversation: journey.pills.conversation, role } }, startedAt: 1341, duration: 1, progress: role === 'neo' ? .5 : 1 };
  }
  f.checkpoint.simulation = { running: false, speed: 1 }; await writeFile(f.file, JSON.stringify(f.checkpoint));
  for (let restart = 0; restart < 2; restart++) {
    const server = start(t, f.directory, 'normal'); await server.waitFor('STARTUP_LISTENING');
    const address = JSON.parse(server.output().match(/STARTUP_LISTENING (\{[^\n]+\})/)![1]);
    const world = await (await fetch(`http://127.0.0.1:${address.port}/api/world`)).json();
    assert.equal(world.simulation.running, false); assert.equal(world.simulation.tick, 1343);
    assert.deepEqual(world.sandbox.neoLife.journey.pills, journey.pills);
    for (const role of ['neo', 'morpheus']) assert.deepEqual(world.agents[role].currentAction, f.checkpoint.agents[role].currentAction,
      `${role}: startup must retain authoritative saved action clocks instead of starting at the current world tick`);
    await server.stop();
  }
});

test('a paused courtyard escape failure keeps the north checkpoint and idle action on server startup', { timeout: 30000 }, async t => {
  const f = await fixture(t, 'm2_burly'), journey = f.checkpoint.sandbox.neoLife.journey;
  const position = filmPosition('film_oracle_courtyard', 0, -28);
  const burly = { phase: 'failed', elapsed: 0, attempt: 3, repelled: 7, staffSwings: 3, assimilation: 100, nextCopyAt: 1345 };
  const idle = { type: 'idle', parameters: { player: true, resolved: true, crouching: false, burly: { ...burly, role: 'neo' } }, startedAt: 1343, duration: 1, progress: 0 };
  Object.assign(journey, { actor: 'neo', step: 1, checkpoint: position, burly });
  Object.assign(f.checkpoint.agents.neo, { position, currentAction: idle });
  f.checkpoint.simulation = { running: false, speed: 1 };
  await writeFile(f.file, JSON.stringify(f.checkpoint));
  const server = start(t, f.directory, 'normal'); await server.waitFor('STARTUP_LISTENING');
  const client = await controls(t, server);
  const world = await client.world();
  assert.equal(world.simulation.running, false);
  assert.deepEqual(world.sandbox?.neoLife?.journey?.burly, burly);
  assert.deepEqual(world.agents.neo.position, position);
  assert.deepEqual(world.agents.neo.currentAction, idle);
  await server.stop();
});

test('paused awakening checkpoints reconstruct their saved performance before any player reconnects', { timeout: 60000 }, async t => {
  const cases: { scene: string; step?: number; beat?: AwakeningBeat }[] = [
    { scene: 'm1_pod' },
    ...[1.63, 5.2].map(elapsed => ({ scene: 'm1_pod', beat: { kind: 'emerge' as const, elapsed, ...(elapsed === 5.2 ? { started: false } : {}) } })),
    ...[2.4, 5.5].map(elapsed => ({ scene: 'm1_pod', beat: { kind: 'breather' as const, elapsed, emerged: true, ...(elapsed === 5.5 ? { started: false } : {}) } })),
    ...[5.861, 9].map(elapsed => ({ scene: 'm1_pod', step: elapsed === 9 ? 1 : 0, beat: { kind: 'disconnect' as const, elapsed, emerged: true, breatherRemoved: true } })),
    { scene: 'm1_pod', step: 1, beat: { kind: 'rescue', elapsed: 3.4 } },
    { scene: 'm1_mirror', beat: { kind: 'mirror', elapsed: 4.8 } },
    { scene: 'm1_recovery', beat: { kind: 'recovery', elapsed: 0, started: false } },
    { scene: 'm1_cabin', beat: { kind: 'cabin', elapsed: 3.4 } },
  ];
  for (const item of cases) await t.test(`${item.scene} ${item.beat?.kind ?? 'entry'} ${item.beat?.elapsed ?? 0}`, async t => {
    const f = await fixture(t, item.scene), journey = f.checkpoint.sandbox.neoLife.journey;
    const pose = awakeningPose(item.beat), neo = f.checkpoint.agents.neo, set = neo.currentLocation;
    f.checkpoint.simulation = { running: false, speed: 2 };
    journey.step = item.step ?? 0;
    if (item.beat) journey.awakening = item.beat; else delete journey.awakening;
    journey.lastText = pose.text;
    neo.position = filmPosition(set, pose.x, pose.z); neo.position.y += pose.y; neo.rotation = pose.yaw ?? Math.PI;
    neo.currentAction = { type: 'idle', parameters: { player: true, resolved: true, filmPose: pose.pose }, startedAt: f.checkpoint.tick, duration: 1, progress: 0 };
    const stale = f.checkpoint.agents.citizen_5;
    stale.currentAction = { type: 'attack', target: 'neo', parameters: { player: true }, startedAt: 1340, duration: 1, progress: .2 };
    await writeFile(f.file, JSON.stringify(f.checkpoint));
    const server = start(t, f.directory, 'normal'); await server.waitFor('STARTUP_LISTENING');
    const client = await controls(t, server), cold = await client.world();
    assert.equal(cold.agents.neo.controller, undefined, 'a saved performance must not reclaim the old browser session');
    assert.equal(cold.agents.neo.currentAction?.parameters.filmPose, pose.pose, 'the first snapshot must render the saved performance without requiring play_as');
    assert.deepEqual(cold.agents.neo.position, neo.position);
    assert.equal(cold.agents.neo.health, 63); assert.equal(cold.agents.mouse.status, 'dead');
    assert.equal(cold.agents.citizen_5.currentAction, null, 'transient player attacks must still be cleared');
    assert.deepEqual(cold.sandbox!.neoLife!.journey, journey, 'reading the pose cannot advance or rewrite the saved story');
    assert.equal(cold.simulation!.running, false); assert.equal(cold.simulation!.tick, f.checkpoint.tick);
    assert.equal(cold.timeOfDay, f.checkpoint.timeOfDay);
    if (item.beat?.kind === 'rescue') assert.equal(cold.agents.neo.currentAction!.parameters.podRescue, item.beat.elapsed);
    client.socket.disconnect(); await server.stop();
  });
});

test('a paused cabin walk does not complete the next objective while restoring the preceding performance', { timeout: 15000 }, async t => {
  const f = await fixture(t, 'm1_cabin'), journey = f.checkpoint.sandbox.neoLife.journey;
  const scene = FILM_SCENE_BY_ID.m1_cabin, neo = f.checkpoint.agents.neo;
  f.checkpoint.simulation = { running: false, speed: 1 };
  journey.step = 1; journey.awakening = { kind: 'cabin', elapsed: AWAKENING_SECONDS.cabin };
  journey.cabinEscort = { progress: CABIN_ROUTE_LENGTH };
  journey.lastText = 'Morpheus 已在连接椅后等候。走到椅子前，亲自决定是否接入。';
  neo.position = filmStepPosition(scene, scene.steps[1], journey); neo.rotation = .62; neo.currentAction = null;
  await writeFile(f.file, JSON.stringify(f.checkpoint));
  const server = start(t, f.directory, 'normal'); await server.waitFor('STARTUP_LISTENING');
  const client = await controls(t, server), cold = await client.world();
  assert.deepEqual(cold.sandbox!.neoLife!.journey, journey, 'a paused load cannot turn reaching the chair into a completed walk');
  assert.deepEqual(cold.agents.neo.position, neo.position); assert.equal(cold.agents.neo.rotation, .62);
  assert.equal(cold.agents.neo.currentAction, null, 'a completed performance cannot replace free movement with a seated pose');
  assert.equal(cold.simulation!.running, false); assert.equal(cold.simulation!.tick, f.checkpoint.tick);
  const joined = await client.command('play_as', { agentId: 'neo' }, state => Boolean(state.agents.neo.controller));
  assert.deepEqual(joined.sandbox!.neoLife!.journey, journey, 'rejoining also cannot complete the walk while paused');
  assert.equal(joined.agents.morpheus.currentAction?.parameters.cabinGuide, true, 'an older save can reconstruct the missing guide');
  client.socket.disconnect(); await server.stop();
});

test('a paused moving cabin guide keeps his saved walk across startup and reconnect', { timeout: 15000 }, async t => {
  const f = await fixture(t, 'm1_cabin'), journey = f.checkpoint.sandbox.neoLife.journey;
  const scene = FILM_SCENE_BY_ID.m1_cabin, { neo, morpheus } = f.checkpoint.agents;
  f.checkpoint.simulation = { running: false, speed: 1 };
  journey.step = 1; journey.awakening = { kind: 'cabin', elapsed: AWAKENING_SECONDS.cabin };
  journey.cabinEscort = { progress: 33.6 };
  journey.lastText = 'Morpheus：这艘飞船是我们在现实中的家。前面的核心区负责广播信号。';
  neo.position = filmPosition(scene.set, .2, -16.4); neo.currentAction = null;
  const root = cabinGuidePose(journey.cabinEscort.progress);
  morpheus.position = filmPosition(scene.set, root.x, root.z); morpheus.rotation = root.yaw;
  morpheus.velocity = { x: 3.1, y: 0, z: 0 };
  morpheus.currentAction = { type: 'move_to', parameters: { resolved: true, cabinGuide: true }, startedAt: f.checkpoint.tick, duration: 1, progress: 0 };
  await writeFile(f.file, JSON.stringify(f.checkpoint));
  const server = start(t, f.directory, 'normal'); await server.waitFor('STARTUP_LISTENING');
  const client = await controls(t, server);
  const check = (state: WorldStateFull) => {
    assert.deepEqual(state.sandbox!.neoLife!.journey, journey);
    const guide = state.agents.morpheus;
    assert.deepEqual(guide.position, morpheus.position);
    assert.deepEqual(guide.velocity, morpheus.velocity);
    assert.deepEqual(guide.currentAction, morpheus.currentAction);
    assert.equal(state.simulation!.tick, f.checkpoint.tick);
  };
  check(await client.world());
  check(await client.command('play_as', { agentId: 'neo' }, state => Boolean(state.agents.neo.controller)));
  check(await client.command('leave_character', {}, state => !state.agents.neo.controller));
  client.socket.disconnect(); await server.stop();
});

test('a paused Construct arrival keeps both performers action clocks across startup and reconnect', { timeout: 15000 }, async t => {
  const f = await fixture(t, 'm1_construct'), journey = f.checkpoint.sandbox.neoLife.journey;
  const set = FILM_SCENE_BY_ID.m1_construct.set, { neo, morpheus } = f.checkpoint.agents;
  const arrival = { phase: 'image' as const, elapsed: 3.4 };
  f.checkpoint.simulation = { running: false, speed: 1 };
  journey.constructArrival = arrival;
  neo.position = filmPosition(set, CONSTRUCT.arrival.x, CONSTRUCT.arrival.z);
  neo.rotation = CONSTRUCT.arrival.yaw; neo.velocity = { x: 0, y: 0, z: 0 };
  neo.currentAction = { type: 'idle', parameters: { player: true, resolved: true, seated: false, construct: { ...arrival, role: 'neo' } },
    startedAt: 1300, duration: 1, progress: .37 };
  const root = constructGuidePose(arrival.elapsed), previous = constructGuidePose(arrival.elapsed - .05);
  morpheus.position = filmPosition(set, root.x, root.z); morpheus.rotation = root.yaw;
  morpheus.velocity = { x: (root.x - previous.x) / .05, y: 0, z: (root.z - previous.z) / .05 };
  morpheus.currentAction = { type: 'move_to', parameters: { resolved: true, construct: { ...arrival, role: 'morpheus' }, seated: false },
    startedAt: 1301, duration: 1, progress: .64 };
  await writeFile(f.file, JSON.stringify(f.checkpoint));
  const server = start(t, f.directory, 'normal'); await server.waitFor('STARTUP_LISTENING');
  const client = await controls(t, server);
  const check = (state: WorldStateFull) => {
    assert.deepEqual(state.sandbox!.neoLife!.journey!.constructArrival, arrival);
    const guide = state.agents.morpheus;
    assert.deepEqual(guide.position, morpheus.position);
    assert.deepEqual(guide.velocity, morpheus.velocity);
    assert.deepEqual(guide.currentAction, morpheus.currentAction);
    assert.deepEqual(state.agents.neo.currentAction, neo.currentAction);
    assert.equal(state.simulation!.tick, f.checkpoint.tick);
  };
  check(await client.world());
  check(await client.command('play_as', { agentId: 'neo' }, state => Boolean(state.agents.neo.controller)));
  check(await client.command('leave_character', {}, state => !state.agents.neo.controller));
  client.socket.disconnect(); await server.stop();
});

for (const [scene, phase, elapsed, roles] of [
  ['m1_truth_exit', 'exit', 2.59, ['neo', 'morpheus']],
  ['m1_truth_return', 'unplug', 7.2, ['neo', 'morpheus', 'trinity', 'dozer']],
] as const) {
  test(`a paused truth ${phase} keeps authored movement across startup and reconnect`, { timeout: 15000 }, async t => {
    const f = await fixture(t, scene), journey = f.checkpoint.sandbox.neoLife.journey;
    const truth: TruthRecovery = { phase, elapsed }, set = FILM_SCENE_BY_ID[scene].set;
    f.checkpoint.simulation = { running: false, speed: 1 };
    journey.truthRecovery = truth; journey.lastText = truthText(truth);
    for (const role of roles) {
      const actor = f.checkpoint.agents[role], root = truthRoot(truth, role);
      const previous = truthRoot({ ...truth, elapsed: elapsed - .05 }, role);
      actor.position = filmPosition(set, root.x, root.z); actor.position.y += root.y;
      actor.rotation = root.yaw;
      actor.velocity = { x: (root.x - previous.x) / .05, y: 0, z: (root.z - previous.z) / .05 };
      actor.currentAction = { type: Math.hypot(actor.velocity.x, actor.velocity.z) > .05 ? 'move_to' : 'idle', parameters: {
        player: role === 'neo', resolved: true, seated: root.seated > 0, truth: { ...truth, role },
      }, startedAt: f.checkpoint.tick, duration: 1, progress: 0 };
    }
    journey.checkpoint = { ...f.checkpoint.agents.neo.position };
    await writeFile(f.file, JSON.stringify(f.checkpoint));
    const server = start(t, f.directory, 'normal'); await server.waitFor('STARTUP_LISTENING');
    const client = await controls(t, server);
    const check = (state: WorldStateFull) => {
      assert.deepEqual(state.sandbox!.neoLife!.journey, journey);
      assert.equal(state.simulation!.tick, f.checkpoint.tick);
      for (const role of roles) for (const key of ['currentAction', 'position', 'rotation', 'velocity'] as const)
        assert.deepEqual(state.agents[role][key], f.checkpoint.agents[role][key], `${role}: ${key}`);
    };
    check(await client.world());
    check(await client.command('play_as', { agentId: 'neo' }, state => Boolean(state.agents.neo.controller)));
    const next = await controls(t, server);
    check(await next.command('play_as', { agentId: 'neo', takeover: true }, state => Boolean(state.agents.neo.controller)));
    check(await next.command('leave_character', {}, state => !state.agents.neo.controller));
    client.socket.disconnect(); next.socket.disconnect(); await server.stop();
  });
}

test('a paused world keeps its clock, selected speed and story across a server restart', { timeout: 30000 }, async t => {
  const f = await fixture(t), server = start(t, f.directory, 'normal'); await server.waitFor('STARTUP_LISTENING');
  const client = await controls(t, server);
  await client.command('set_speed', { speed: 4 }, state => state.simulation!.speed === 4);
  const paused = await client.command('pause', {}, state => !state.simulation!.running);
  client.socket.disconnect(); await server.stop();
  const restored = start(t, f.directory, 'normal'); await restored.waitFor('STARTUP_LISTENING');
  const next = await controls(t, restored), world = await next.world();
  assert.equal(world.simulation!.running, false, 'reading a paused save must not restart time');
  assert.equal(world.simulation!.speed, 4, 'the selected time multiplier belongs to the same save');
  assert.equal(world.simulation!.tick, paused.simulation!.tick); assert.equal(world.timeOfDay, paused.timeOfDay);
  assert.deepEqual(world.sandbox!.neoLife, paused.sandbox!.neoLife);
  assert.equal(world.agents.neo.health, paused.agents.neo.health); assert.equal(world.agents.mouse.status, 'dead');
  assert.deepEqual(world.sandbox!.structures, paused.sandbox!.structures); assert.deepEqual(world.sandbox!.traffic, paused.sandbox!.traffic);
  const resumed = await next.command('resume', {}, state => state.simulation!.running);
  assert.equal(resumed.simulation!.tick, paused.simulation!.tick, 'continuing must start from the saved clock');
  next.socket.disconnect(); await restored.stop();
});

test('a running world restarts running at its selected speed instead of being saved as paused by shutdown', { timeout: 30000 }, async t => {
  const f = await fixture(t), server = start(t, f.directory, 'normal'); await server.waitFor('STARTUP_LISTENING');
  const client = await controls(t, server);
  await client.command('set_speed', { speed: 2 }, state => state.simulation!.speed === 2);
  await client.command('pause', {}, state => !state.simulation!.running);
  await client.command('resume', {}, state => state.simulation!.running);
  client.socket.disconnect(); await server.stop();
  const restored = start(t, f.directory, 'normal'); await restored.waitFor('STARTUP_LISTENING');
  const next = await controls(t, restored), world = await next.world();
  assert.equal(world.simulation!.running, true, 'shutdown must remember whether the player had paused');
  assert.equal(world.simulation!.speed, 2);
  next.socket.disconnect(); await restored.stop();
});

test('an explicit pause reaches the atomic world checkpoint before the process shuts down', { timeout: 30000 }, async t => {
  const f = await fixture(t), server = start(t, f.directory, 'normal'); await server.waitFor('STARTUP_LISTENING');
  const client = await controls(t, server), paused = await client.command('pause', {}, state => !state.simulation!.running);
  const end = Date.now() + 5000;
  let saved = JSON.parse(await readFile(f.file, 'utf8'));
  while (saved.simulation?.running !== false) {
    assert.ok(Date.now() < end, 'pause is only in memory; the world checkpoint was never updated');
    await new Promise(resolve => setTimeout(resolve, 20)); saved = JSON.parse(await readFile(f.file, 'utf8'));
  }
  assert.equal(saved.tick, paused.simulation!.tick); assert.equal(saved.timeOfDay, paused.timeOfDay);
  assert.deepEqual(saved.sandbox.neoLife, paused.sandbox!.neoLife);
  client.socket.disconnect(); await server.stop();
});

for (const checkpoint of ['ground', 'pit'] as const) {
  test(`a paused ${checkpoint} retry restores and saves the checkpoint without restarting time or allowing other actions`, { timeout: 30000 }, async t => {
    const f = await fixture(t, checkpoint === 'pit' ? 'm3_surrender' : 'm3_rain'), journey = f.checkpoint.sandbox.neoLife.journey;
    f.checkpoint.simulation = { running: false, speed: 2 };
    journey.step = checkpoint === 'pit' ? 0 : 1;
    journey.smithFinale = stepSmithFinale({ ...newSmithFinale(), phase: checkpoint === 'pit' ? 'pit_dodge' : 'ground_dodge',
      checkpoint, attempts: 2, total: 70, pitFight: checkpoint === 'pit', impactAt: checkpoint === 'pit' ? 51 : undefined },
      { focus: false, x: 0, z: 0 }, SMITH_FINALE[checkpoint].dodge + .1);
    assert.equal(journey.smithFinale.phase, 'failed');
    const pose = smithFinalePose(journey.smithFinale);
    f.checkpoint.agents.neo.position = filmPosition('film_smith_avenue', pose.neo.x, pose.neo.z);
    f.checkpoint.agents.neo.position.y += pose.neo.y;
    journey.checkpoint = { ...f.checkpoint.agents.neo.position };
    await writeFile(f.file, JSON.stringify(f.checkpoint));
    const server = start(t, f.directory, 'normal'); await server.waitFor('STARTUP_LISTENING');
    const client = await controls(t, server);
    const before = await client.command('play_as', { agentId: 'neo' }, state => Boolean(state.agents.neo.controller));
    const phase = checkpoint === 'pit' ? 'pit_warning' : 'ready';
    const after = await client.command('sandbox_action', { kind: 'life', target: 'film:retry' }, state => state.sandbox!.neoLife!.journey!.smithFinale!.phase === phase);
    assert.equal(after.sandbox!.neoLife!.journey!.smithFinale!.attempts, 3);
    assert.equal(after.simulation!.running, false); assert.equal(after.simulation!.tick, before.simulation!.tick);
    assert.equal(after.simulation!.speed, 2); assert.equal(after.simulation!.day, before.simulation!.day); assert.equal(after.timeOfDay, before.timeOfDay);
    assert.deepEqual(after.sandbox!.neoLife!.journey!.completed, before.sandbox!.neoLife!.journey!.completed);
    assert.deepEqual(after.sandbox!.neoLife!.journey!.reflections, before.sandbox!.neoLife!.journey!.reflections);
    assert.deepEqual(after.sandbox!.neoLife!.choices, before.sandbox!.neoLife!.choices);
    assert.deepEqual(after.sandbox!.profiles.neo.inventory, before.sandbox!.profiles.neo.inventory);
    assert.equal(after.agents.mouse.status, 'dead'); assert.equal(after.agents.neo.health, checkpoint === 'pit' ? 63 : 100);
    assert.ok(client.messages.some(message => message.type === 'notification' && /仍暂停/.test((message.data as { message: string }).message)));

    // The retry must reach disk while paused, before a shutdown or another pause can hide a missing save.
    const deadline = Date.now() + 5000;
    let saved = JSON.parse(await readFile(f.file, 'utf8'));
    while (saved.sandbox.neoLife.journey.smithFinale.phase !== phase) {
      assert.ok(Date.now() < deadline, 'the paused retry never reached the world checkpoint');
      await new Promise(resolve => setTimeout(resolve, 20)); saved = JSON.parse(await readFile(f.file, 'utf8'));
    }
    assert.equal(saved.simulation.running, false); assert.deepEqual(saved.sandbox, after.sandbox);
    const observer = await controls(t, server);
    for (const [sender, type, data] of [[client, 'sandbox_action', { kind: 'life', target: 'film:act' }],
      [client, 'sandbox_action', { kind: 'use', target: 'medkit' }], [client, 'player_action', { kind: 'attack' }],
      [client, 'sandbox_action', { kind: 'interact', target: 'film:retry' }], [observer, 'sandbox_action', { kind: 'life', target: 'film:retry' }]] as const) {
      const marker = sender.messages.length;
      const unchanged = await sender.command(type, data, () => sender.messages.slice(marker).some(message => message.type === 'notification'));
      assert.deepEqual(unchanged.sandbox, after.sandbox, `${type} ${data.kind} cannot bypass pause or ownership`);
      assert.deepEqual(unchanged.agents, after.agents); assert.equal(unchanged.simulation!.tick, after.simulation!.tick);
    }
    observer.socket.disconnect(); client.socket.disconnect(); await server.stop();
    const restored = start(t, f.directory, 'normal'); await restored.waitFor('STARTUP_LISTENING');
    const next = await controls(t, restored), cold = await next.world();
    assert.deepEqual(cold.sandbox, after.sandbox); assert.equal(cold.simulation!.running, false);
    assert.equal(cold.simulation!.tick, after.simulation!.tick); assert.deepEqual(cold.agents.neo.position, after.agents.neo.position);
    assert.equal(cold.agents.neo.health, after.agents.neo.health);
    await next.command('play_as', { agentId: 'neo' }, state => Boolean(state.agents.neo.controller));
    await next.command('resume', {}, state => state.simulation!.running);
    if (checkpoint === 'ground') await next.command('sandbox_action', { kind: 'life', target: 'film:act' }, state => state.sandbox!.neoLife!.journey!.smithFinale!.phase !== 'ready');
    await next.command('request_full_state', {}, state => state.sandbox!.neoLife!.journey!.smithFinale!.elapsed > 0);
    next.socket.disconnect(); await restored.stop();
  });
}

test('invalid saved time controls are rejected without overwriting the recoverable checkpoint', async t => {
  const f = await fixture(t), store = new CheckpointStore(f.file);
  for (const simulation of [{ running: 'false', speed: 1 }, { running: false, speed: 3 }, null]) {
    const data = JSON.stringify({ ...f.checkpoint, simulation }); await writeFile(f.file, data);
    await assert.rejects(store.load(), /Unsupported world checkpoint/);
    assert.equal(await readFile(f.file, 'utf8'), data);
  }
});

test('a real server restart preserves an unfinished NPC conversation and replays it only to the reconnecting page', { timeout: 30000 }, async t => {
  const f = await fixture(t), server = start(t, f.directory, 'conversations'); await server.waitFor('STARTUP_LISTENING');
  const client = await controls(t, server);
  await client.command('resume', {}, state => state.simulation!.running);
  const deadline = Date.now() + 10000;
  let active: ConversationRecord[];
  do {
    active = await client.conversations();
    if (active.some(record => record.messages.length > 0)) break;
    assert.ok(Date.now() < deadline, 'nearby NPCs never began their normal conversation');
    await new Promise(resolve => setTimeout(resolve, 20));
  } while (true);
  const paused = await client.command('pause', {}, state => !state.simulation!.running);
  active = await client.conversations();
  const conversation = active.find(record => record.messages.length > 0)!;
  assert.ok(conversation && conversation.messages.length < 3, 'pause must capture an actual unfinished conversation');
  assert.equal(paused.simulation!.conversations, active.length);
  client.socket.disconnect(); await server.stop();
  const before = JSON.parse(await readFile(f.file, 'utf8'));

  const restored = start(t, f.directory, 'conversations'); await restored.waitFor('STARTUP_LISTENING');
  const next = await controls(t, restored), world = await next.world();
  assert.deepEqual(await next.conversations(), active, 'restarting must not discard the ongoing exchange or its already spoken lines');
  assert.equal(world.simulation!.running, false); assert.equal(world.simulation!.tick, paused.simulation!.tick);
  assert.equal(world.simulation!.conversations, active.length);
  for (const id of active.flatMap(record => record.participants)) {
    assert.deepEqual(world.agents[id].currentAction, paused.agents[id].currentAction, 'participants must remain in their saved talk action');
  }
  await replayed(next, active);
  const starts = next.messages.filter(message => message.type === 'conversation_start');
  assert.deepEqual(starts.map(message => (message.data as { id: string }).id).sort(), active.map(record => record.id).sort());
  const spoken = next.messages.filter(message => message.type === 'conversation_message');
  assert.deepEqual(spoken.map(message => ({ ...(message.data as object), tick: message.tick })), active.flatMap(record => record.messages.map(line => ({ conversationId: record.id, speaker: line.speaker, content: line.content, tone: line.tone, tick: line.tick }))));
  const observer = await controls(t, restored);
  await replayed(observer, active);
  next.socket.emit('message', { type: 'request_full_state', data: {} });
  await new Promise(resolve => setTimeout(resolve, 100));
  assert.equal(next.messages.filter(message => message.type.startsWith('conversation_')).length, starts.length + spoken.length, 'routine world snapshots must not duplicate dialogue');
  assert.equal(observer.messages.filter(message => message.type.startsWith('conversation_')).length, starts.length + spoken.length, 'a new page must receive the existing exchange without rebroadcasting it to other pages');
  observer.socket.disconnect(); observer.socket.connect();
  await replayed(observer, active, 2);
  assert.deepEqual(observer.messages.filter(message => message.type === 'conversation_start').map(message => (message.data as { id: string }).id),
    [...starts, ...starts].map(message => (message.data as { id: string }).id), 'reconnecting the same page replays the same active exchanges once');
  assert.deepEqual(observer.messages.filter(message => message.type === 'conversation_message').map(message => ({ ...message, timestamp: 0 })),
    [...spoken, ...spoken].map(message => ({ ...message, timestamp: 0 })), 'reconnection preserves each line, speaker and saved tick');
  assert.equal(next.messages.filter(message => message.type.startsWith('conversation_')).length, starts.length + spoken.length, 'another page reconnecting must not replay dialogue to an existing page');
  observer.socket.disconnect();

  const receivedAtResume = next.messages.length;
  await next.command('resume', {}, state => state.simulation!.running);
  const end = Date.now() + 10000;
  while (!next.messages.some(message => message.type === 'conversation_end' && (message.data as { conversationId: string }).conversationId === conversation.id)) {
    assert.ok(Date.now() < end, 'the restored exchange never reached its final line');
    await new Promise(resolve => setTimeout(resolve, 20));
  }
  await next.command('pause', {}, state => !state.simulation!.running);
  const remaining = next.messages.slice(receivedAtResume).filter(message => message.type === 'conversation_message' && (message.data as { conversationId: string }).conversationId === conversation.id);
  assert.equal(remaining.length, 3 - conversation.messages.length, 'resuming must emit only the unspoken turns');
  assert.ok(remaining.every(message => message.tick >= conversation.messages.at(-1)!.tick + 4), 'the saved gap between turns must remain intact');
  assert.equal(next.messages.filter(message => message.type === 'conversation_end' && (message.data as { conversationId: string }).conversationId === conversation.id).length, 1);
  next.socket.disconnect(); await restored.stop();
  const after = JSON.parse(await readFile(f.file, 'utf8'));
  for (const [fromAgent, toAgent] of [conversation.participants, [...conversation.participants].reverse()]) {
    const previous = before.relationships.find((r: { fromAgent: string; toAgent: string }) => r.fromAgent === fromAgent && r.toAgent === toAgent);
    const current = after.relationships.find((r: { fromAgent: string; toAgent: string }) => r.fromAgent === fromAgent && r.toAgent === toAgent);
    assert.equal(current.trust, Math.min(100, previous.trust + 6), 'finishing after restoration must apply the relationship reward once');
  }
  const exchange = (event: { type: string; tick: number; involvedAgents: string[] }) => event.type === 'conversation' && event.tick > before.tick && conversation.participants.every(id => event.involvedAgents.includes(id));
  assert.equal(after.events.filter(exchange).length, 1, 'the conversation must produce one persistent world event');
  for (const id of conversation.participants) {
    const memories = JSON.parse(await readFile(path.join(f.directory, 'memories', `${id}.json`), 'utf8'));
    assert.equal(memories.memories.filter((memory: { tags: string[] }) => memory.tags.includes(`event:${after.events.find(exchange).id}`)).length, 1);
  }
});

test('legacy talk actions without a saved conversation are released instead of stranding their participants', { timeout: 30000 }, async t => {
  const f = await fixture(t);
  f.checkpoint.agents.citizen_5.currentAction = { type: 'talk_to', target: 'citizen_7', parameters: { resolved: true }, startedAt: 1340, duration: 14, progress: 0 };
  await writeFile(f.file, JSON.stringify(f.checkpoint));
  const server = start(t, f.directory, 'normal'); await server.waitFor('STARTUP_LISTENING');
  const client = await controls(t, server), world = await client.world();
  assert.equal(world.agents.citizen_5.currentAction, null); assert.deepEqual(await client.conversations(), []);
  client.socket.disconnect(); await server.stop();
});

test('a new conversation checkpoint also preserves NPCs still approaching their conversation partner', { timeout: 30000 }, async t => {
  const f = await fixture(t), agent = f.checkpoint.agents.citizen_5;
  f.checkpoint.conversations = { active: [], cooldowns: [] };
  agent.currentAction = { type: 'talk_to', target: 'citizen_7', parameters: {}, startedAt: 1340, duration: 22, progress: 0.1 };
  agent.targetPosition = { ...f.checkpoint.agents.citizen_7.position };
  agent.currentPath = [{ ...agent.targetPosition }]; agent.velocity = { x: 1, y: 0, z: 1 };
  await writeFile(f.file, JSON.stringify(f.checkpoint));
  const server = start(t, f.directory, 'normal'); await server.waitFor('STARTUP_LISTENING');
  const client = await controls(t, server), world = await client.world();
  for (const field of ['currentAction', 'targetPosition', 'currentPath', 'velocity'] as const) assert.deepEqual(world.agents.citizen_5[field], agent[field], `restoring must keep the saved ${field} of an approaching NPC`);
  assert.deepEqual(await client.conversations(), [], 'approaching a partner must not invent a conversation that has not begun');
  client.socket.disconnect(); await server.stop();
});

test('invalid saved NPC dialogue is rejected without replacing the recoverable world', async t => {
  const f = await fixture(t), store = new CheckpointStore(f.file);
  const record = { id: 'conversation', participants: ['citizen_5', 'citizen_7'], messages: [], location: 'nightclub', startTick: 1340, endTick: 1340 };
  const active = { ordinary: false, awaitingModel: false, record, topic: '晚餐', nextTurn: 1344, lines: ['今晚吃什么？', '去咖啡馆吧。', '一起去。'] };
  const invalid = [null, { active: [active] }, { active: [{ ...active, nextTurn: 'tomorrow' }], cooldowns: [] }, { active: [{ ...active, lines: [] }], cooldowns: [] }, { active: [{ ...active, record: { ...record, participants: ['citizen_5', 'citizen_5'] } }], cooldowns: [] }, { active: [{ ...active, record: { ...record, messages: [{ speaker: 'citizen_7', content: active.lines[0], tone: 'thoughtful', tick: 1341 }] } }], cooldowns: [] }, { active: [], cooldowns: [['citizen_5', 'tomorrow']] }];
  for (const conversations of invalid) {
    const data = JSON.stringify({ ...f.checkpoint, conversations }); await writeFile(f.file, data);
    await assert.rejects(store.load(), /Unsupported world checkpoint/); assert.equal(await readFile(f.file, 'utf8'), data);
  }
});

for (const elapsed of [.879, 12]) {
  test(`real restarts preserve both paused mirror actions at ${elapsed}s through release and re-entry`, { timeout: 30000 }, async t => {
    const f = await fixture(t, 'm1_mirror'), journey = f.checkpoint.sandbox.neoLife.journey;
    const beat: AwakeningBeat = { kind: 'mirror', elapsed, chairMotion: 'stepping', approach: { x: -6.8, z: -14, yaw: -2.68 } };
    journey.awakening = beat; journey.step = 0;
    const clock = mirrorTime(beat), pose = awakeningPose(beat), neo = f.checkpoint.agents.neo, trinity = f.checkpoint.agents.trinity;
    neo.position = filmPosition('film_lafayette', pose.x, pose.z); neo.position.y += pose.y; neo.rotation = pose.yaw ?? Math.PI;
    neo.velocity = { x: 0, y: 0, z: 0 }; neo.currentLocation = 'film_lafayette'; neo.isInMatrix = true;
    neo.currentAction = { type: 'idle', parameters: { player: true, resolved: true, filmPose: pose.pose,
      mirror: mirrorSilver(clock), mirrorBeat: clock, mirrorEntry: { ...beat }, seated: clock >= MIRROR_TIMING.sit },
      startedAt: 1300, duration: 1, progress: .37 };
    trinity.position = filmPosition('film_lafayette', MIRROR_TRINITY.x, MIRROR_TRINITY.z); trinity.rotation = MIRROR_TRINITY.yaw;
    trinity.velocity = { x: 0, y: 0, z: 0 }; trinity.currentLocation = 'film_lafayette'; trinity.isInMatrix = true;
    trinity.currentAction = { type: 'idle', parameters: { mirrorCrew: clock }, startedAt: 1301, duration: 1, progress: 1 };
    f.checkpoint.agents.citizen_5.currentAction = { type: 'attack', parameters: { player: true, mirrorBeat: clock }, startedAt: 1340, duration: 1, progress: .2 };
    f.checkpoint.simulation = { running: false, speed: 1 }; await writeFile(f.file, JSON.stringify(f.checkpoint));
    const check = (state: WorldStateFull) => {
      assert.equal(state.simulation!.running, false); assert.equal(state.simulation!.tick, 1343);
      assert.deepEqual(state.sandbox!.neoLife!.journey!.awakening, beat);
      for (const id of ['neo', 'trinity']) for (const key of ['currentAction', 'position', 'rotation', 'velocity'] as const)
        assert.deepEqual(state.agents[id][key], f.checkpoint.agents[id][key], `${id}: ${key}`);
      assert.equal(state.agents.citizen_5.currentAction, null, 'unrelated player attacks still clear');
    };
    for (let restart = 0; restart < 2; restart++) {
      const server = start(t, f.directory, 'normal'); await server.waitFor('STARTUP_LISTENING'); const client = await controls(t, server);
      check(await client.world()); check(await client.command('play_as', { agentId: 'neo' }, state => Boolean(state.agents.neo.controller)));
      check(await client.command('leave_character', {}, state => !state.agents.neo.controller));
      client.socket.disconnect(); await server.stop();
    }
  });
}
