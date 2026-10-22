import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from 'three';
import { FILM_SETS, PILL_ROOM, pillRoot } from '@auto_matrix/shared';
import { actor } from './helpers/fighting-hand-fixture.mjs';
import { handSurface } from './helpers/hand-surface.mjs';
import { HandCurve } from '../packages/client/src/agents/HandCurve.js';
import { advanceMotion, newMotion } from '../packages/client/src/agents/CharacterMotion.js';
import type { HeroModels, HeroRig } from '../packages/client/src/agents/HeroModel.js';

function pill(h: { models: HeroModels; rig: HeroRig }, elapsed: number) {
  const pills = { role: 'neo' as const, choice: 'red' as const, phase: 'taking' as const, elapsed };
  const center = FILM_SETS.film_lafayette.center, at = pillRoot({ ...pills, approach: { x: PILL_ROOM.seat, z: PILL_ROOM.z, yaw: -Math.PI / 2 } });
  h.rig.root.position.set(center.x + at.x, center.y - 1, center.z + at.z); h.rig.root.rotation.y = at.yaw;
  const input = { speed: 0, grounded: true, verticalVelocity: 0, turn: 0, mirror: 0, pills }, motion = newMotion();
  h.models.animate(h.rig, advanceMotion(motion, input, 0), motion, input, 0); h.rig.root.updateMatrixWorld(true);
}
function sameHands(actual: HeroRig, expected: HeroRig) {
  for (const side of ['R', 'L']) {
    const a = handSurface(actual, side), b = handSurface(expected, side), points = a.posePoints(), reference = b.posePoints();
    for (const id of a.vertices) {
      assert.ok(points.get(id)!.distanceTo(reference.get(id)!) < 2e-6, `${side}/${id}: cached skin differs from a fresh complete evaluation`);
      for (const name of ['position', 'normal', 'skinIndex', 'skinWeight']) {
        const x = a.group.skin.geometry.attributes[name], y = b.group.skin.geometry.attributes[name], tolerance = name === 'normal' ? 1e-5 : name === 'position' ? 1e-6 : 0;
        for (let k = 0; k < x.itemSize; k++) assert.ok(Math.abs(x.getComponent(id, k) - y.getComponent(id, k)) <= tolerance, `${side}/${id}/${name}/${k}: cached attribute changes`);
      }
    }
  }
}

test('moving a held pill to the mouth reuses the same finger shape while retaining the full hand skin', async t => {
  const warm = await actor('neo'), cold = await actor('neo'); t.after(() => { warm.models.dispose(); cold.models.dispose(); });
  pill(warm, 1.8);
  let samples = 0; const original = HandCurve.prototype.sample;
  try {
    HandCurve.prototype.sample = function (...args) { samples++; return original.apply(this, args); };
    pill(warm, 2.7);
  } finally { HandCurve.prototype.sample = original; }
  pill(cold, 2.7); sameHands(warm.rig, cold.rig);
  assert.equal(samples, 0, 'a wrist-only move repeats the complete finger curve evaluation');
});

test('wrist turns keep the cached fingers and refresh the complete wrist skin and normals', async t => {
  for (const id of ['neo', 'trinity', 'smith', 'morpheus'] as const) {
    const warm = await actor(id), cold = await actor(id); t.after(() => { warm.models.dispose(); cold.models.dispose(); });
    const component = (h: typeof warm) => (h.models as unknown as { fightingHands: Map<HeroRig, { update(): void }> }).fightingHands.get(h.rig)!;
    const turnWrists = (rig: HeroRig) => { rig.bones.get('wrist_R')!.rotation.set(.2, .7, -.4); rig.bones.get('wrist_L')!.rotation.set(-.3, -.6, .25); };
    warm.draw(.65); turnWrists(warm.rig);
    let samples = 0; const original = HandCurve.prototype.sample;
    try {
      HandCurve.prototype.sample = function (...args) { samples++; return original.apply(this, args); };
      component(warm).update(); warm.rig.root.updateMatrixWorld(true);
    } finally { HandCurve.prototype.sample = original; }
    const reference = component(cold), update = reference.update;
    try { reference.update = function () { turnWrists(cold.rig); return update.call(this); }; cold.draw(.65); }
    finally { reference.update = update; }
    sameHands(warm.rig, cold.rig);
    assert.equal(samples, 0, `${id}: an unchanged articulation repeats the complete finger curve evaluation`);
  }
});

test('wrist translation and nonuniform scale update cached skin like a fresh evaluation', async t => {
  const warm = await actor('neo'), cold = await actor('neo'); t.after(() => { warm.models.dispose(); cold.models.dispose(); });
  for (const h of [warm, cold]) { h.rig.root.position.set(-31, 4, 17); h.rig.root.rotation.y = .7; }
  const component = (h: typeof warm) => (h.models as unknown as { fightingHands: Map<HeroRig, { update(): void }> }).fightingHands.get(h.rig)!;
  const moveWrist = (rig: HeroRig) => {
    const wrist = rig.bones.get('wrist_R')!;
    wrist.position.copy(rig.rest.get('wrist_R')!).add(new THREE.Vector3(.015, -.008, .012)); wrist.scale.set(1.03, .97, 1.02);
  };
  warm.draw(.65); moveWrist(warm.rig);
  let samples = 0; const original = HandCurve.prototype.sample;
  try {
    HandCurve.prototype.sample = function (...args) { samples++; return original.apply(this, args); };
    component(warm).update(); warm.rig.root.updateMatrixWorld(true);
  } finally { HandCurve.prototype.sample = original; }
  const reference = component(cold), update = reference.update;
  try { reference.update = function () { moveWrist(cold.rig); return update.call(this); }; cold.draw(.65); }
  finally { reference.update = update; }
  sameHands(warm.rig, cold.rig);
  assert.equal(samples, 0, 'moving or scaling the wrist repeats the unchanged material shape');
});
