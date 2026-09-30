import assert from 'node:assert/strict';
import test, { type TestContext } from 'node:test';
import { execFileSync, spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFile, writeFile, rm } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { PersistentMemoryManager } from '../packages/server/src/memory/PersistentMemoryManager.js';

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
    cwd: root, env: { ...process.env, MATRIX_DATA_DIR: directory, HOST: '127.0.0.1', PORT: '0', TICK_RATE_MS: '10000', LLM_API_KEY: '' },
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
