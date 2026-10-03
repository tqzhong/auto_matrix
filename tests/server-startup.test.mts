import assert from 'node:assert/strict';
import test, { type TestContext } from 'node:test';
import { execFileSync, spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFile, writeFile, rm } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { io } from 'socket.io-client';
import type { ConversationRecord, ServerMessage, WorldStateFull } from '@auto_matrix/shared';
import { PersistentMemoryManager } from '../packages/server/src/memory/PersistentMemoryManager.js';
import { CheckpointStore } from '../packages/server/src/world/CheckpointStore.js';

const root = fileURLToPath(new URL('../', import.meta.url));
const fingerprint = (data: string) => createHash('sha256').update(data).digest('hex');

async function fixture(t: TestContext) {
  const directory = execFileSync(process.execPath, ['--import', 'tsx', 'scripts/film-review-fixture.mts', 'm1_dejavu'], { cwd: root, encoding: 'utf8' }).trim();
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
  const stop = async (signal: NodeJS.Signals = 'SIGTERM') => {
    child.kill(signal);
    assert.equal(await Promise.race([finished, new Promise(resolve => setTimeout(() => resolve('shutdown timeout'), 5000).unref())]), 0, output);
  };
  return { waitFor, stop, output: () => output };
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
  const world = async () => await (await fetch(`${base}/api/world`)).json() as WorldStateFull;
  const conversations = async () => (await (await fetch(`${base}/api/conversations`)).json()).active as ConversationRecord[];
  const command = async (type: string, data: unknown, ready: (state: WorldStateFull) => boolean) => {
    socket.emit('message', { type, data }); const end = Date.now() + 5000;
    for (;;) {
      const state = await world(); if (ready(state)) return state;
      assert.ok(Date.now() < end, `${type} was not acknowledged`);
      await new Promise(resolve => setTimeout(resolve, 20));
    }
  };
  return { socket, messages, world, conversations, command };
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
  const server = start(t, f.directory, 'normal'); await server.waitFor('Unsupported world checkpoint'); await server.stop();
  assert.equal(await readFile(f.file, 'utf8'), damaged, 'a failed load must not silently replace the original with a new world');
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
  const starts = next.messages.filter(message => message.type === 'conversation_start');
  assert.deepEqual(starts.map(message => (message.data as { id: string }).id).sort(), active.map(record => record.id).sort());
  const spoken = next.messages.filter(message => message.type === 'conversation_message');
  assert.deepEqual(spoken.map(message => ({ ...(message.data as object), tick: message.tick })), active.flatMap(record => record.messages.map(line => ({ conversationId: record.id, speaker: line.speaker, content: line.content, tone: line.tone, tick: line.tick }))));
  const observer = await controls(t, restored);
  next.socket.emit('message', { type: 'request_full_state', data: {} });
  await new Promise(resolve => setTimeout(resolve, 100));
  assert.equal(next.messages.filter(message => message.type.startsWith('conversation_')).length, starts.length + spoken.length, 'routine world snapshots must not duplicate dialogue');
  assert.equal(observer.messages.filter(message => message.type.startsWith('conversation_')).length, starts.length + spoken.length, 'a new page must receive the existing exchange without rebroadcasting it to other pages');
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
