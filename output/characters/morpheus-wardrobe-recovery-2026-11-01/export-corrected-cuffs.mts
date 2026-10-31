import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import * as THREE from 'three';
import { makeModel } from '../morpheus-ambush-doff-2026-10-17/grip-fixture.mjs';
import { FrontExitBody } from './FrontExitBody.mjs';
import { FrontExitCuffs } from './FrontExitCuffs.mjs';

const base = new URL('./', import.meta.url);
const data = JSON.parse(await readFile(new URL('corrected-body-input/manifest.json', base), 'utf8'));
const verified = JSON.parse(await readFile(new URL('front-cuff-passage-verification.json', base), 'utf8'));
assert.ok(verified.geometryPassed && verified.handPassageBeforeRelease);
for (const [file, sha] of Object.entries(verified.sourceHashes))
  assert.equal(createHash('sha256').update(await readFile(new URL(file, base))).digest('hex'), sha, file);
assert.ok(Array.isArray(data.frames) && data.frames.length === data.frameCount && data.frames.at(-1).time === 8);
const h = await makeModel();
try {
  const body = new FrontExitBody(h.rig, 'front-exit'), path = new FrontExitCuffs(h.rig, body);
  const frames = data.frames.map((frame: { frame: number; time: number }) => {
    body.pose(frame.time);
    const cuffs = ['R', 'L'].map(side => {
      const matrix = path.matrix(side, frame.time);
      assert.ok(matrix.elements.every(Number.isFinite));
      assert.ok(Math.abs(matrix.determinant() - 1) < 1e-9);
      if (frame.frame === 1) {
        const identity = new THREE.Matrix4();
        assert.ok(matrix.elements.every((value, i) => Math.abs(value - identity.elements[i]) < 1e-12));
        matrix.identity();
      }
      return { side, matrix: matrix.toArray() };
    });
    return { frame: frame.frame, time: frame.time, cuffs };
  });
  const files = ['export-corrected-cuffs.mts', 'FrontExitCuffs.mts', 'FrontExitBody.mts', 'corrected-body-input/manifest.json',
    'front-cuff-passage-verification.json', '../morpheus-withdrawal-path-2026-10-20/WithdrawalCuffs.mts'];
  const sourceHashes: Record<string, string> = {};
  for (const file of files) sourceHashes[file] = createHash('sha256').update(await readFile(new URL(file, base))).digest('hex');
  const result = { frameCount: frames.length, endTime: frames.at(-1)!.time, cuffReleaseAfterSeconds: 1.7,
    collarReleaseAfterSeconds: .8, sourceHashes, frames, acceptedForProduction: false,
    scope: 'Complete standing-coat cuff reference, retaining every adaptive body timestamp. The finite opening check does not accept whole sleeves, grip, native dynamics or gameplay.' };
  await writeFile(new URL('corrected-cuff-input.json', base), JSON.stringify(result));
  console.log(JSON.stringify({ frameCount: result.frameCount, endTime: result.endTime, sourceHashes }));
} finally { h.models.dispose(); }
