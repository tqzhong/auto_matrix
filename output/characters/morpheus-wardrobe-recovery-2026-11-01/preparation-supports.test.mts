import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const folder = process.env.MORPHEUS_PREPARATION_INPUT ?? 'preparation-input';
const data = JSON.parse(await readFile(new URL(`${folder}/manifest.json`, import.meta.url), 'utf8'));
test('the unchanged reference pose imposes exact identity at every cloth support', () => {
  assert.equal(data.frames[0].time, 0);
  const identity = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
  for (const [support, transform] of data.frames[0].supports.entries())
    assert.deepEqual(transform, identity, `support ${support} perturbs the unchanged native rest pose`);
});
