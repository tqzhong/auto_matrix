import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from 'three';
import { WebGLAttributes } from 'three/src/renderers/webgl/WebGLAttributes.js';
import { FILM_SCENE_BY_ID, FILM_SETS, filmEntry, wakeCallRoot } from '@auto_matrix/shared';
import { actor } from './helpers/fighting-hand-fixture.mjs';
import { AgentRenderer } from '../packages/client/src/agents/AgentRenderer.js';
import { CharacterModels } from '../packages/client/src/agents/CharacterModel.js';
import { advanceMotion, newMotion } from '../packages/client/src/agents/CharacterMotion.js';
import { HandCurve } from '../packages/client/src/agents/HandCurve.js';

test('the offstage Neo pose avoids deforming both hands on the first apartment frame', async t => {
  const warm = await actor('neo'), cold = await actor('neo');
  t.after(() => { warm.models.dispose(); cold.models.dispose(); });
  const detail = new THREE.Group(), state = { currentLocation: 'neo_apartment', controller: null as string | null, currentAction: null, status: 'alive', isInMatrix: true };
  detail.add(warm.rig.root);
  for (const h of [warm, cold]) h.rig.root.position.set(1210, 0, 690);
  const renderer = Object.assign(Object.create(AgentRenderer.prototype), {
    agents: new Map([['neo', { state, rig: { detail, hero: warm.rig } }]]),
    models: Object.assign(Object.create(CharacterModels.prototype), { heroes: warm.models }),
    preparedOpeningApartment: new WeakSet(),
  }) as AgentRenderer;
  const hands = warm.models['fightingHands'].get(warm.rig)!, deform = t.mock.method(hands, 'deform');
  assert.equal(renderer.prepareOpeningApartmentActor(), false, 'the visible actor must keep its current pose');
  detail.visible = false;
  state.controller = 'other-player';
  assert.equal(renderer.prepareOpeningApartmentActor(), false);
  state.controller = null;
  const prepared = renderer.prepareOpeningApartmentActor();
  const offstageCalls = deform.mock.callCount();
  const input = { speed: 0, grounded: true, verticalVelocity: 0, turn: 0, homeClothes: true };
  for (const h of [warm, cold]) {
    const motion = newMotion();
    h.models.animate(h.rig, advanceMotion(motion, input, 1 / 60), motion, input, 1 / 60);
  }
  assert.equal(deform.mock.callCount() - offstageCalls, 0, 'the normal first frame can reuse its hand skin');
  assert.equal(prepared, true); assert.equal(offstageCalls, 2); assert.equal(detail.visible, false);
  assert.equal(renderer.prepareOpeningApartmentActor(), false);
  const skin = (h: typeof warm) => h.rig.root.getObjectByName('Anatomical_head_and_hands') as THREE.SkinnedMesh;
  for (const [name, tolerance] of [['position', 1e-6], ['normal', 1e-5], ['skinIndex', 0], ['skinWeight', 0]] as const) {
    const a = skin(warm).geometry.getAttribute(name).array, b = skin(cold).geometry.getAttribute(name).array;
    assert.equal(a.length, b.length);
    for (let i = 0; i < a.length; i++) assert.ok(Math.abs(a[i] - b[i]) <= tolerance, `${name} at ${i}`);
  }
});

test('second-call departure prepares the idle hand shape offstage before the bridge first draws', async t => {
  const warm = await actor('neo'), cold = await actor('neo');
  t.after(() => { warm.models.dispose(); cold.models.dispose(); });
  const call = { phase: 'leaving' as const, elapsed: 2.443, nightmare: true };
  const action = { type: 'idle', parameters: { wakeCall: call }, startedAt: 1300, duration: 1, progress: 0 };
  const state = { currentLocation: 'film_anderson_flat', controller: null as string | null, currentAction: action, status: 'alive', isInMatrix: true };
  const detail = new THREE.Group(), motion = newMotion(); detail.add(warm.rig.root);
  const renderer = Object.assign(Object.create(AgentRenderer.prototype), {
    agents: new Map([['neo', { state, rig: { detail, hero: warm.rig, motion } }]]),
    models: Object.assign(Object.create(CharacterModels.prototype), { heroes: warm.models }),
    preparedOpeningApartment: new WeakSet(),
  }) as AgentRenderer;
  assert.equal(renderer.prepareOpeningApartmentActor(true), false, 'keep the visible actor in the saved door animation');
  detail.visible = false; state.controller = 'other-player';
  assert.equal(renderer.prepareOpeningApartmentActor(true), false, 'another player owns the body');
  state.controller = null;
  assert.equal(renderer.prepareOpeningApartmentActor(), false, 'ordinary apartment preparation still rejects story actions');
  state.currentAction = { ...action, parameters: { wakeCall: { ...call, phase: 'listening' } } } as typeof action;
  assert.equal(renderer.prepareOpeningApartmentActor(true), false, 'only prepare the saved departure');
  state.currentAction = action;
  const before = JSON.stringify({ state, motion });
  assert.equal(renderer.prepareOpeningApartmentActor(true), true, 'prepare the loaded offstage departure before possession');
  assert.equal(JSON.stringify({ state, motion }), before, 'preparation must not advance the saved action or actor clock');
  assert.equal(renderer.prepareOpeningApartmentActor(true), false, 'prepare each loaded model once');
  const center = FILM_SETS.film_anderson_flat.center, at = wakeCallRoot(call), entry = filmEntry(FILM_SCENE_BY_ID.m1_bridge);
  for (const h of [warm, cold]) {
    h.rig.root.position.set(center.x + at.x, center.y - 1, center.z + at.z); h.rig.root.rotation.y = at.yaw;
    const input = { speed: 0, grounded: true, verticalVelocity: 0, turn: 0, homeClothes: true, glasses: false, wakeCall: call }, clock = newMotion();
    h.models.animate(h.rig, advanceMotion(clock, input, 0), clock, input, 0);
    h.rig.root.position.copy(entry); h.rig.root.rotation.y = Math.PI;
  }
  const sample = t.mock.method(HandCurve.prototype, 'sample');
  const input = { speed: 0, grounded: true, verticalVelocity: 0, turn: 0, homeClothes: false, glasses: false };
  for (const h of [warm, cold]) {
    const clock = newMotion(); h.models.animate(h.rig, advanceMotion(clock, input, 0), clock, input, 0);
    if (h === warm) { assert.equal(sample.mock.callCount(), 0, 'the first bridge frame reuses the prepared finger curves'); sample.mock.restore(); }
  }
  for (const [name, tolerance] of [['position', 1e-6], ['normal', 1e-5], ['skinIndex', 0], ['skinWeight', 0]] as const) {
    const skin = (h: typeof warm) => h.rig.root.getObjectByName('Anatomical_head_and_hands') as THREE.SkinnedMesh;
    const a = skin(warm).geometry.getAttribute(name).array, b = skin(cold).geometry.getAttribute(name).array;
    assert.equal(a.length, b.length);
    for (let i = 0; i < a.length; i++) assert.ok(Math.abs(a[i] - b[i]) <= tolerance, `${name} at ${i}`);
  }
});

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
