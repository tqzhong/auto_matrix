import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mkdtemp, rm } from 'node:fs/promises';
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
