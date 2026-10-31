import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const base = new URL('./', import.meta.url);
const load = async (file: string) => JSON.parse(await readFile(new URL(file, base), 'utf8'));

test('the complete body input retains every adaptive shirt key at its real timestamp', async () => {
  const input = await load('corrected-body-input/manifest.json');
  const shirt = await load('shirt-contact-transport/report.json');
  assert.ok(Array.isArray(input.frames), 'The body frame sequence must survive summary serialization.');
  const expected = [{ time: 0, file: 'cloth-1.bin', sourceFrame: 1, fraction: 0 }];
  for (const record of shirt) for (const key of record.keys) expected.push({
    time: key.fraction === 1 ? record.time : record.time - (1 - key.fraction) / 60,
    file: key.file, sourceFrame: record.frame, fraction: key.fraction,
  });
  assert.equal(input.frameCount, expected.length);
  assert.equal(input.frames.length, expected.length);
  for (const [i, frame] of input.frames.entries()) {
    assert.equal(frame.frame, i + 1);
    assert.equal(frame.time, expected[i].time);
    assert.equal(frame.shirtSourceFile, expected[i].file);
    assert.equal(frame.sourceFrame, expected[i].sourceFrame);
    assert.equal(frame.sourceFraction, expected[i].fraction);
    assert.equal(frame.deltaSeconds, frame.time - (i ? input.frames[i - 1].time : 0));
    if (i) assert.ok(frame.deltaSeconds > 0 && frame.deltaSeconds <= 1 / 60 + 1e-12);
  }
  assert.equal(input.frames[0].time, 0);
  assert.equal(input.frames.at(-1).time, 8);
  assert.ok(input.minimumDeltaSeconds < 1 / 240);
});

test('the thirteen full layers restore exactly and all body files match the recorded geometry', async () => {
  const input = await load('corrected-body-input/manifest.json');
  assert.ok(Array.isArray(input.frames));
  assert.equal(input.bodies.length, 13);
  assert.equal(input.bodies.reduce((n: number, part: { count: number }) => n + part.count, 0), 51490);
  assert.equal(input.indices.length / 3, 26916);
  const first = await readFile(new URL('corrected-body-input/body-1.bin', base));
  const last = await readFile(new URL(`corrected-body-input/body-${input.frameCount}.bin`, base));
  assert.deepEqual(first, last, 'The restored standing body must equal its starting Float32 surface.');
  const digest = createHash('sha256');
  for (const frame of input.frames) {
    const filename = `body-${frame.frame}.bin`;
    const buffer = await readFile(new URL(`corrected-body-input/${filename}`, base));
    assert.equal(buffer.length, 51490 * 3 * 4);
    digest.update(filename + '\0').update(createHash('sha256').update(buffer).digest());
  }
  assert.equal(digest.digest('hex'), input.bodyGeometrySha256);
  for (const [file, hash] of Object.entries(input.sourceHashes))
    assert.equal(createHash('sha256').update(await readFile(new URL(file, base))).digest('hex'), hash, file);
});
