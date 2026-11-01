import assert from 'node:assert/strict';
import { test } from 'node:test';
import { promises as fs } from 'node:fs';
import { mkdtemp, readFile, writeFile, rm } from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { MemoryManager } from '../packages/server/src/memory/MemoryManager.js';
import { PersistentMemoryManager } from '../packages/server/src/memory/PersistentMemoryManager.js';

test('recent context stays chronological when important memories are retained', () => {
  const memory = new MemoryManager();
  for (let i = 0; i < 60; i++) memory.record('neo', 'observation', `memory-${i}`, { importance: i === 0 ? 10 : 1 });
  assert.equal(memory.getRecentContext('neo', 1)[0].content, 'memory-59');
  assert.ok(memory.getAllMemories('neo').some(m => m.content === 'memory-0'));
  assert.equal(memory.getMemoryCount('neo'), 50);
});

test('persisted memories retain their identity and original timestamps', async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'matrix-memory-'));
  try {
    const original = new PersistentMemoryManager(directory);
    const recorded = original.record('neo', 'discovery', '真实的记忆', { importance: 8 });
    await original.saveAll();
    const restored = new PersistentMemoryManager(directory);
    await restored.loadAll();
    assert.deepEqual(restored.getAllMemories('neo'), [recorded]);
  } finally { await rm(directory, { recursive: true, force: true }); }
});

test('a truncated character memory rejects startup without replacing its recoverable file', async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'matrix-memory-'));
  try {
    const file = path.join(directory, 'neo.json'), damaged = '{"agentId":"neo","memories":[';
    await writeFile(file, damaged);
    const memory = new PersistentMemoryManager(directory);
    await assert.rejects(memory.loadAll(), /neo\.json/);
    assert.equal(memory.isLoaded(), false);
    assert.equal(await readFile(file, 'utf8'), damaged);
  } finally { await rm(directory, { recursive: true, force: true }); }
});

test('invalid character-memory ownership and records cannot silently enter the resumed world', async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'matrix-memory-'));
  try {
    const original = new PersistentMemoryManager(directory);
    const recorded = original.record('neo', 'experience', '记得上一段的选择。');
    const cases = [
      { agentId: 'trinity', memories: [] },
      { agentId: 'neo', memories: 'damaged' },
      { agentId: 'neo', memories: [{ ...recorded, agentId: 'smith' }] },
      { agentId: 'neo', memories: [{ ...recorded, timestamp: 'yesterday' }] },
    ];
    for (const data of cases) {
      const file = path.join(directory, 'neo.json'), contents = JSON.stringify(data);
      await writeFile(file, contents);
      await assert.rejects(new PersistentMemoryManager(directory).loadAll(), /neo\.json/);
      assert.equal(await readFile(file, 'utf8'), contents);
    }
  } finally { await rm(directory, { recursive: true, force: true }); }
});

for (const method of ['saveAll', 'saveAgent'] as const) {
  test(`an interrupted ${method} preserves the last complete memory file and can retry the new memories`, async t => {
    const directory = await mkdtemp(path.join(os.tmpdir(), 'matrix-memory-'));
    try {
      const memory = new PersistentMemoryManager(directory), file = path.join(directory, 'neo.json');
      const first = memory.record('neo', 'discovery', '上一段已保存的发现。');
      await memory.saveAll();
      const before = await readFile(file, 'utf8');
      const second = memory.record('neo', 'experience', '本段新作出的选择。');
      const write = fs.writeFile;
      const interrupted = t.mock.method(fs, 'writeFile', async target => {
        await write(target, '{"agentId":"neo","memories":[');
        throw new Error('simulated interrupted memory write');
      });
      if (method === 'saveAll') assert.equal(await memory.saveAll(), 0);
      else await assert.rejects(memory.saveAgent('neo'), /simulated interrupted memory write/);
      interrupted.mock.restore();
      assert.equal(await readFile(file, 'utf8'), before, 'an incomplete new write must leave the last complete file intact');
      assert.equal(memory.getDirtyCount(), 1);
      assert.equal(await memory.saveAll(), 1);
      const resumed = new PersistentMemoryManager(directory); await resumed.loadAll();
      assert.deepEqual(resumed.getAllMemories('neo'), [first, second]);
    } finally { await rm(directory, { recursive: true, force: true }); }
  });
}

test('a memory recorded during an in-flight save remains dirty and is included in the next save', async t => {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'matrix-memory-'));
  let release!: () => void;
  const held = new Promise<void>(resolve => { release = resolve; });
  try {
    const memory = new PersistentMemoryManager(directory), first = memory.record('neo', 'discovery', '保存前的记忆。');
    let started!: () => void;
    const writing = new Promise<void>(resolve => { started = resolve; });
    const write = fs.writeFile;
    t.mock.method(fs, 'writeFile', async (...args) => { started(); await held; return Reflect.apply(write, fs, args); });
    const saving = memory.saveAgent('neo'); await writing;
    const second = memory.record('neo', 'experience', '保存期间发生的新经历。');
    release(); await saving;
    assert.equal(memory.getDirtyCount(), 1, 'completing the old snapshot cannot clear the new experience');
    assert.equal(await memory.saveAll(), 1);
    const resumed = new PersistentMemoryManager(directory); await resumed.loadAll();
    assert.deepEqual(resumed.getAllMemories('neo'), [first, second]);
  } finally { release(); await rm(directory, { recursive: true, force: true }); }
});

test('overlapping periodic and immediate saves cannot write the same memory file concurrently', async t => {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'matrix-memory-'));
  let release!: () => void;
  const held = new Promise<void>(resolve => { release = resolve; });
  try {
    const memory = new PersistentMemoryManager(directory), first = memory.record('neo', 'discovery', '较早的快照。');
    let started!: () => void;
    const writing = new Promise<void>(resolve => { started = resolve; });
    const write = fs.writeFile;
    let active = 0, maximum = 0, calls = 0;
    t.mock.method(fs, 'mkdir', async () => undefined);
    t.mock.method(fs, 'writeFile', async (...args) => {
      active++; maximum = Math.max(maximum, active);
      try { if (++calls === 1) { started(); await held; } return await Reflect.apply(write, fs, args); }
      finally { active--; }
    });
    const periodic = memory.saveAll(); await writing;
    const second = memory.record('neo', 'experience', '较新的快照。'), immediate = memory.saveAgent('neo');
    await Promise.resolve(); await Promise.resolve();
    release(); await Promise.all([periodic, immediate]);
    assert.equal(maximum, 1, 'a later snapshot must wait for the earlier writer');
    const resumed = new PersistentMemoryManager(directory); await resumed.loadAll();
    assert.deepEqual(resumed.getAllMemories('neo'), [first, second]);
  } finally { release(); await rm(directory, { recursive: true, force: true }); }
});

test('a shutdown flush waits for an earlier save even when no new memories are dirty', async t => {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'matrix-memory-'));
  let release!: () => void, saving: Promise<number> | undefined, flushing: Promise<number> | undefined;
  const held = new Promise<void>(resolve => { release = resolve; });
  try {
    const memory = new PersistentMemoryManager(directory), recorded = memory.record('neo', 'experience', '退出前必须落盘的记忆。');
    let started!: () => void;
    const writing = new Promise<void>(resolve => { started = resolve; });
    const write = fs.writeFile;
    t.mock.method(fs, 'writeFile', async (...args) => { started(); await held; return Reflect.apply(write, fs, args); });
    saving = memory.saveAll(); await writing;
    let finished = false;
    flushing = memory.saveAll().then(count => { finished = true; return count; });
    await Promise.resolve(); await Promise.resolve();
    assert.equal(finished, false, 'normal shutdown cannot finish while an older memory snapshot is still writing');
    release(); assert.equal(await saving, 1); assert.equal(await flushing, 0);
    const resumed = new PersistentMemoryManager(directory); await resumed.loadAll();
    assert.deepEqual(resumed.getAllMemories('neo'), [recorded]);
  } finally { release(); await Promise.allSettled([saving, flushing]); await rm(directory, { recursive: true, force: true }); }
});
