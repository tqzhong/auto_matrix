import assert from 'node:assert/strict';
import test from 'node:test';
import { WebGLAttributes } from 'three/src/renderers/webgl/WebGLAttributes.js';
import { actor } from './helpers/fighting-hand-fixture.mjs';

test('turning one wrist keeps the other hand intact without deforming it again', async t => {
  const h = await actor('smith'); t.after(() => h.models.dispose()); h.draw(.6);
  const hands = h.models['fightingHands'].get(h.rig)!, deform = hands['deform'], calls: string[] = [];
  t.mock.method(hands, 'deform', function (hand) { calls.push(hand.side); return deform.call(this, hand); });
  const output = hands['output'], left = hands['binding'].hands[1];
  const before = Object.fromEntries(Object.entries(output).map(([key, a]) => [key, left.vertices.flatMap(id => Array.from(a.array.subarray(id * a.itemSize, (id + 1) * a.itemSize)))]));
  h.rig.bones.get('wrist_R')!.rotation.y += .2; hands.update();
  for (const [key, a] of Object.entries(output)) assert.deepEqual(left.vertices.flatMap(id => Array.from(a.array.subarray(id * a.itemSize, (id + 1) * a.itemSize))), before[key]);
  const changed = Object.fromEntries(Object.entries(output).map(([key, a]) => [key, a.array.slice()]));
  hands['previous'] = []; hands.update();
  for (const [key, a] of Object.entries(output)) assert.deepEqual(a.array, changed[key], 'selective updates must equal a complete fresh deformation');
  assert.deepEqual(calls.slice(0, calls.length - 2), ['R'], 'the unchanged left hand must not be recalculated');
});

test('hand copies stay inside the hand vertices and preserve edits made before the next draw', async t => {
  const h = await actor('smith'); t.after(() => h.models.dispose()); h.draw(.4);
  const hands = h.models['fightingHands'].get(h.rig)!, output = hands['output'];
  const allowed = new Set(hands['binding'].hands.flatMap(hand => hand.vertices));
  const buffers = new Map<object, ArrayLike<number> & { set(source: ArrayLike<number>, offset: number): void }>();
  let bound: object, bytes = 0;
  const gl = {
    FLOAT: 5126, UNSIGNED_SHORT: 5123, ARRAY_BUFFER: 34962,
    createBuffer() { return {}; }, bindBuffer(_target: number, buffer: object) { bound = buffer; },
    bufferData(_target: number, data: Float32Array | Uint16Array) { buffers.set(bound, data.slice()); },
    bufferSubData(_target: number, offset: number, data: Float32Array | Uint16Array, start = 0, count = data.length - start) {
      bytes += count * data.BYTES_PER_ELEMENT; buffers.get(bound)!.set(data.subarray(start, start + count), offset / data.BYTES_PER_ELEMENT);
    },
  };
  const gpu = WebGLAttributes(gl as unknown as WebGL2RenderingContext);
  for (const a of Object.values(output)) gpu.update(a, gl.ARRAY_BUFFER);
  let copied = 0;
  for (const a of Object.values(output)) {
    const set = a.array.set;
    t.mock.method(a.array, 'set', function (source: ArrayLike<number>, start = 0) {
      copied += source.length * a.array.BYTES_PER_ELEMENT;
      for (let at = start; at < start + source.length; at++)
        assert.ok(allowed.has(Math.floor(at / a.itemSize)), 'a hand refresh must not recopy the head and neck');
      return set.call(this, source, start);
    });
  }
  for (let frame = 0; frame < 8; frame++) {
    h.rig.bones.get(frame % 2 ? 'wrist_L' : 'wrist_R')!.rotation.y += .03;
    hands.update();
  }
  const maximum = allowed.size * Object.values(output).reduce((sum, a) => sum + a.itemSize * a.array.BYTES_PER_ELEMENT, 0);
  for (const a of Object.values(output)) {
    gpu.update(a, gl.ARRAY_BUFFER);
    assert.deepEqual(buffers.get(gpu.get(a).buffer), a.array, 'the next draw must receive every pending hand edit');
    assert.equal(a.updateRanges.length, 0);
  }
  assert.ok(copied <= maximum * 8, `copied ${copied} bytes for eight updates of ${maximum} bytes of hands`);
  assert.ok(bytes > 0 && bytes <= Object.values(output).reduce((sum, a) => sum + a.array.byteLength, 0), 'pending updates need only one upload per attribute');
});

test('a moving actor keeps the same hand data as a complete fresh deformation', async t => {
  const h = await actor('morpheus'); t.after(() => h.models.dispose()); h.draw(.6);
  const hands = h.models['fightingHands'].get(h.rig)!;
  for (let frame = 1; frame <= 3; frame++) {
    h.rig.root.position.set(1100 + frame, 88 + frame * .1, 800 - frame);
    h.rig.root.rotation.y = frame * .2; h.rig.root.scale.setScalar(.9 + frame * .02);
    h.rig.bones.get('wrist_R')!.rotation.y += .03; hands.update();
    const actual = Object.fromEntries(Object.entries(hands['output']).map(([key, a]) => [key, a.array.slice()]));
    hands['previous'] = []; hands.update();
    for (const [key, a] of Object.entries(hands['output'])) assert.deepEqual(a.array, actual[key], `${key}: root movement must not leave an old hand correction`);
  }
});
