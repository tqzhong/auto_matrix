import assert from 'node:assert/strict';
import { test, type TestContext } from 'node:test';
import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { CheckpointStore } from '../packages/server/src/world/CheckpointStore.js';
import { SupabaseCheckpointStore } from '../packages/server/src/world/SupabaseCheckpointStore.js';
import { PersistentMemoryManager } from '../packages/server/src/memory/PersistentMemoryManager.js';
import { WorldState } from '../packages/server/src/world/WorldState.js';
import { AgentManager } from '../packages/server/src/agents/AgentManager.js';
import { gunzipSync } from 'node:zlib';

function database(t: TestContext) {
  let row: { id: string; revision: number; payload: string; updated_at: string; lease_until: string | null } | null = null;
  let now = Date.now();
  t.mock.method(Date, 'now', () => now);
  let failure = 0;
  let loseReply = false;
  const requests: string[] = [];
  t.mock.method(globalThis, 'fetch', async (input: string, options: RequestInit) => {
    const url = new URL(input);
    assert.equal(url.origin, 'https://test.supabase.co');
    assert.equal(new Headers(options.headers).get('apikey'), 'sb_secret_test');
    assert.equal(options.redirect, 'error');
    requests.push(options.method ?? 'GET');
    if (failure) return new Response('provider response must never appear in logs', { status: failure });
    if (options.method === 'GET') return Response.json(row ? [row] : []);
    const next = JSON.parse(options.body as string);
    if (options.method === 'POST' && row) return new Response('', { status: 409 });
    if (options.method === 'PATCH' && url.searchParams.get('revision') !== `eq.${row?.revision}`) return Response.json([]);
    if (options.method === 'PATCH' && url.searchParams.has('lease_until') && url.searchParams.get('lease_until') !== (row?.lease_until === null ? 'is.null' : `eq.${row?.lease_until}`)) return Response.json([]);
    row = { ...row, ...next };
    if (loseReply) { loseReply = false; throw new Error('response lost after commit'); }
    return Response.json([row]);
  });
  return { cloud: () => new SupabaseCheckpointStore('https://test.supabase.co', 'sb_secret_test'),
    row: () => row, requests, fail: (status: number) => { failure = status; }, loseReply: () => { loseReply = true; },
    advance: (ms: number) => { now += ms; } };
}

test('a replacement waits for the final save and acquires that exact checkpoint', async t => {
  const db = database(t), old = db.cloud(), fresh = db.cloud();
  await old.load(); assert.equal(await old.acquire(), true); await old.save('before deploy');
  assert.equal(await fresh.load(), 'before deploy');
  assert.equal(await fresh.acquire(), false, 'the new process must not run a second world');
  await old.save('last actions before shutdown'); await old.release();
  assert.equal(await fresh.acquire(), true);
  assert.equal(await fresh.load(), 'last actions before shutdown');
  await fresh.save('first resumed action');
  await assert.rejects(old.save('stale shutdown'), /lease|another instance/);
  assert.equal(await db.cloud().load(), 'first resumed action');
});

test('an expired writer cannot resume after another instance acquires its revision', async t => {
  const db = database(t), old = db.cloud();
  await old.load(); await old.acquire(); await old.save('recoverable progress');
  db.advance(46000);
  const first = db.cloud(), second = db.cloud(); await first.load(); await second.load();
  assert.deepEqual((await Promise.all([first.acquire(), second.acquire()])).sort(), [false, true]);
  await assert.rejects(old.save('late stale progress'), /lease|another instance/);
  assert.equal(await db.cloud().load(), 'recoverable progress');
});

test('paused checkpoints renew their lease without rewriting the compressed world', async t => {
  const db = database(t), old = db.cloud();
  await old.load(); await old.acquire(); await old.save('paused world');
  const payload = db.row()!.payload, revision = db.row()!.revision;
  db.advance(30000); await old.save('paused world');
  assert.equal(db.row()!.revision, revision);
  assert.equal(db.row()!.payload, payload);
  db.advance(20000);
  const fresh = db.cloud(); await fresh.load(); assert.equal(await fresh.acquire(), false);
  db.advance(26000); assert.equal(await fresh.acquire(), true);
});

test('the first migration waits for a legacy server to finish saving', async t => {
  const db = database(t), seed = db.cloud(); await seed.load(); await seed.acquire(); await seed.save('legacy world');
  db.row()!.lease_until = null;
  const fresh = db.cloud(); await fresh.load(); assert.equal(await fresh.acquire(), false);
  db.advance(30000); db.row()!.revision++; db.row()!.updated_at = new Date(Date.now()).toISOString();
  db.advance(30000); assert.equal(await fresh.acquire(), false);
  db.advance(16000); assert.equal(await fresh.acquire(), true);
  assert.equal(await fresh.load(), 'legacy world');
});

test('a lost save response is reconciled before saving newer progress', async t => {
  const db = database(t), cloud = db.cloud();
  await cloud.load(); await cloud.acquire(); await cloud.save('before timeout');
  db.advance(30000);
  db.loseReply(); await assert.rejects(cloud.save('committed but response lost'), /response lost/);
  db.advance(30000);
  await cloud.save('later progress');
  assert.equal(await db.cloud().load(), 'later progress');
  assert.equal(db.row()!.revision, 3);
});

test('reconciling a lost response still refuses another instance’s newer save', async t => {
  const db = database(t), old = db.cloud(); await old.load(); await old.acquire();
  db.loseReply(); await assert.rejects(old.save('first progress'), /response lost/);
  db.advance(46000);
  const fresh = db.cloud(); await fresh.load(); await fresh.acquire(); await fresh.save('other instance');
  await assert.rejects(old.save('stale progress'), /changed in another instance/);
  assert.equal(await db.cloud().load(), 'other instance');
});

test('cloud checkpoints survive removal of the instance filesystem', async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'matrix-cloud-'));
  let saved: string | null = null;
  const cloud = { load: async () => saved, save: async (data: string) => { saved = data; } };
  const checkpoint = { version: 1 as const, tick: 180, phase: 'phase2_awakening' as const,
    agents: {}, events: [], relationships: [], memories: {}, simulation: { running: false, speed: 2 } };
  try {
    const store = new CheckpointStore(path.join(directory, 'world.json'), cloud);
    assert.equal(await store.load(), null);
    await store.save(checkpoint);
    await rm(directory, { recursive: true, force: true });
    const restarted = new CheckpointStore(path.join(directory, 'world.json'), cloud);
    assert.deepEqual(await restarted.load(), checkpoint);
  } finally { await rm(directory, { recursive: true, force: true }); }
});

test('a new cloud instance restores Neo, paused time and memories from one compressed save', async t => {
  const db = database(t), world = new WorldState();
  new AgentManager(world).initializeAllAgents();
  world.agents.get('neo')!.health = 63;
  const memory = new PersistentMemoryManager('/unused');
  const recorded = memory.record('neo', 'discovery', '红色药丸是一次自己的选择', { importance: 9 });
  const checkpoint = { version: 1 as const, tick: 420, day: 4, timeOfDay: 8000, phase: 'phase2_awakening' as const,
    agents: Object.fromEntries(world.agents), events: [], relationships: [],
    memories: memory.getCheckpoint(world.agents.keys()), simulation: { running: false, speed: 2 } };
  const cloud = db.cloud(), first = new CheckpointStore('/unused/world.json', cloud);
  assert.equal(await first.load(), null);
  await cloud.acquire();
  const saving = first.save(checkpoint);
  world.agents.get('neo')!.health = 1;
  await saving;
  const restarted = new CheckpointStore('/unused/world.json', db.cloud());
  const restored = (await restarted.load())!;
  const restoredMemory = new PersistentMemoryManager('/unused');
  restoredMemory.restoreCheckpoint(restored.memories!);
  assert.equal(restored.agents.neo.health, 63, 'serialize before another tick mutates the world');
  assert.deepEqual(restored.simulation, { running: false, speed: 2 });
  assert.equal(restored.tick, 420); assert.equal(restored.day, 4);
  assert.deepEqual(restoredMemory.getAllMemories('neo'), [recorded]);
  assert.equal(restoredMemory.isLoaded(), true);
  const raw = gunzipSync(Buffer.from(db.row()!.payload, 'base64')).toString('utf8');
  assert.equal(JSON.parse(raw).tick, 420);
  assert.ok(db.row()!.payload.length < raw.length / 2, 'avoid spending the free bandwidth on repeated JSON');
});

test('database errors cannot become a fresh world or overwrite a recoverable save', async t => {
  const db = database(t), cloud = db.cloud();
  await cloud.load(); await cloud.acquire(); await cloud.save('saved progress');
  const original = structuredClone(db.row());
  db.fail(503);
  const next = db.cloud();
  await assert.rejects(next.load(), /Cloud checkpoint GET failed \(HTTP 503\)/);
  await assert.rejects(next.save('empty world'), /Load the cloud checkpoint/);
  assert.deepEqual(db.row(), original);
  db.fail(0);
  assert.equal(await next.load(), 'saved progress');
});

test('an older process cannot overwrite the new instance and unchanged shutdown saves are skipped', async t => {
  const db = database(t), old = db.cloud();
  await old.load(); await old.acquire(); await old.save('before deploy');
  const fresh = db.cloud(); await fresh.load();
  const count = db.requests.length;
  await old.save('before deploy'); assert.equal(db.requests.length, count);
  db.advance(46000); await fresh.acquire(); await fresh.save('new progress');
  await assert.rejects(old.save('stale progress'), /changed in another instance/);
  assert.equal(await db.cloud().load(), 'new progress');
});

test('queued saves keep the latest snapshot after a failed request', async t => {
  const db = database(t), cloud = db.cloud(), store = new CheckpointStore('/unused/world.json', cloud);
  await store.load();
  await cloud.acquire();
  const snapshot = (tick: number) => ({ version: 1 as const, tick, phase: 'phase1_normal_life' as const, agents: {}, events: [], relationships: [], memories: {} });
  db.fail(503); await assert.rejects(store.save(snapshot(1)), /HTTP 503/);
  db.fail(0); await Promise.all([store.save(snapshot(2)), store.save(snapshot(3))]);
  assert.equal((await store.load())!.tick, 3);
});

test('incomplete cloud saves fail closed and explicit cloud configuration cannot fall back to disk', async t => {
  const db = database(t), cloud = db.cloud();
  await cloud.load();
  await cloud.acquire();
  await cloud.save(JSON.stringify({ version: 1, tick: 1, agents: {}, events: [], relationships: [] }));
  await assert.rejects(new CheckpointStore('/unused/world.json', db.cloud()).load(), /missing character memories/);
  assert.throws(() => SupabaseCheckpointStore.fromEnvironment({ MATRIX_CLOUD_SAVE: 'supabase' }), /require/);
  assert.throws(() => SupabaseCheckpointStore.fromEnvironment({ MATRIX_CLOUD_SAVE: 'other' }), /Unsupported/);
  assert.equal(SupabaseCheckpointStore.fromEnvironment({}), undefined);
  assert.throws(() => new SupabaseCheckpointStore('http://test.supabase.co', 'sb_secret_test'), /HTTPS/);
  assert.throws(() => new SupabaseCheckpointStore('https://test.supabase.co', 'sb_publishable_test'), /server secret/);
});
