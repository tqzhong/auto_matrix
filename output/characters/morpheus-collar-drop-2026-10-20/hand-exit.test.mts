import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { gunzipSync } from 'node:zlib';
import * as THREE from 'three';
import { makeModel, meshSurface } from '../morpheus-ambush-doff-2026-10-17/grip-fixture.mjs';
import { auditCage } from '../morpheus-ambush-doff-2026-10-17/cloth-rebuild/cage-contact.mjs';
import { WithdrawalBody } from '../morpheus-withdrawal-path-2026-10-20/WithdrawalBody.mjs';

// A fixed full-garment fixture isolates the hand route. A fresh coupled
// simulation and the whole-body/cloth tests are still required afterwards.
const input = JSON.parse(gunzipSync(await readFile(new URL('hand-exit-fixture.json.gz', import.meta.url))).toString());
assert.equal(input.source.positionEncoding, 'float32-le-base64');
for (const frame of input.frames) test(`the freed hands pass outside the complete garment at ${frame.time} seconds`, async t => {
  const h = await makeModel(); t.after(() => h.models.dispose());
  const body = new WithdrawalBody(h.rig); body.pose(frame.time);
  const bytes = process.env.MORPHEUS_CLOTH_RESULT
    ? await readFile(new URL(`${process.env.MORPHEUS_CLOTH_RESULT}cloth-${frame.frame}.bin`, import.meta.url))
    : Buffer.from(frame.positions, 'base64');
  assert.equal(bytes.length, 13386*3*4);
  const a = new Float32Array(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset+bytes.byteLength));
  const vertices = Array.from({ length: a.length/3 }, (_, i) => [a[3*i]/.4, a[3*i+2]/.4, -a[3*i+1]/.4]);
  assert.equal(input.indices.length/3, 25796);
  const skin = h.rig.root.getObjectByName('Anatomical_head_and_hands') as THREE.Mesh;
  const contact = auditCage({ vertices, indices: input.indices }, [meshSurface(skin)]);
  console.log(JSON.stringify({ time: frame.time, skinCrossings: contact.bodyCount }));
  assert.equal(contact.bodyCount, 0, 'the hand returns through the back of the coat');
  assert.ok(body.errors.every(row => row.distance < 1e-6), 'the arm must reach without stretching');
});
