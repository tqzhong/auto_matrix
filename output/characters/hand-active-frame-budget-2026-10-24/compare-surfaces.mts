import assert from 'node:assert/strict';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { gzipSync, gunzipSync } from 'node:zlib';
import { serialize, deserialize } from 'node:v8';
import * as THREE from 'three';
import { actor } from './candidate-release/tests/helpers/fighting-hand-fixture.mjs';
import { coreConnector } from './candidate-release/tests/helpers/core-connector.mjs';
import { advanceMotion, newMotion, type MotionInput } from './candidate-release/packages/client/src/agents/CharacterMotion.js';
import { redDressAttention, trainingRoot, pillRoot, PILL_ROOM, FILM_SETS, MIRROR_SEAT } from '@auto_matrix/shared';
const mode = process.argv[2]; assert.ok(mode === 'before' || mode === 'after');
const directory = new URL('./pose-reference/', import.meta.url); if (mode === 'before') mkdirSync(directory, { recursive: true });
let sequence = 0, failures = 0;
const normalRange = { calls: 0, zero: 0, minSquared: Infinity, maxSquared: 0, maxRelativeLengthError: 0 };
function observeNormals(h: Awaited<ReturnType<typeof actor>>) {
  if (mode !== 'before') return;
  const hands = h.models['fightingHands'].get(h.rig)!, deform = hands['deform'].bind(hands);
  hands['deform'] = hand => {
    const hypot = Math.hypot;
    Math.hypot = (x: number, y: number, z: number) => {
      const length = hypot(x, y, z), squared = x * x + y * y + z * z; normalRange.calls++;
      assert.ok(Number.isFinite(squared), 'normal length squared remains finite');
      if (length) {
        assert.ok(squared > 0, 'normal length squared does not underflow');
        normalRange.minSquared = Math.min(normalRange.minSquared, squared); normalRange.maxSquared = Math.max(normalRange.maxSquared, squared);
        normalRange.maxRelativeLengthError = Math.max(normalRange.maxRelativeLengthError, Math.abs(Math.sqrt(squared) - length) / length);
      } else normalRange.zero++;
      return length;
    };
    try { deform(hand); } finally { Math.hypot = hypot; }
  };
}
function snapshot(name: string, h: Awaited<ReturnType<typeof actor>>) {
  const skin = h.rig.root.getObjectByName('Anatomical_head_and_hands') as THREE.SkinnedMesh;
  h.rig.root.updateMatrixWorld(true); skin.skeleton.update();
  const fields: Record<string, ArrayLike<number>> = Object.fromEntries(['position', 'normal', 'skinIndex', 'skinWeight'].map(key => [key, skin.geometry.attributes[key].array]));
  fields.bones = skin.skeleton.boneMatrices; fields.world = new Float64Array(skin.matrixWorld.elements);
  const hands = h.models['fightingHands'].get(h.rig)!['binding'].hands;
  const points = new Float64Array(hands.reduce((sum, hand) => sum + hand.vertices.length, 0) * 3), point = new THREE.Vector3(); let at = 0;
  for (const hand of hands) for (const id of hand.vertices) { skin.getVertexPosition(id, point).applyMatrix4(skin.matrixWorld).toArray(points, at); at += 3; }
  fields.points = points;
  const file = new URL(String(sequence++).padStart(4, '0') + '.bin.gz', directory);
  if (mode === 'before') { writeFileSync(file, gzipSync(serialize({ name, fields }), { level: 1 })); console.log(JSON.stringify({ name, fields: Object.keys(fields) })); return; }
  const reference = deserialize(gunzipSync(readFileSync(file))); assert.equal(reference.name, name);
  const differences: Record<string, { max: number; index: number; tolerance: number }> = {};
  for (const [key, values] of Object.entries(fields)) {
    const expected = reference.fields[key]; assert.equal(values.length, expected.length);
    const tolerance = key === 'normal' ? 1e-5 : key === 'position' ? 1e-6 : key === 'points' ? 2e-6 : 0;
    let max = 0, index = -1;
    for (let i = 0; i < values.length; i++) { assert.ok(Number.isFinite(values[i])); const difference = Math.abs(values[i] - expected[i]); if (difference > max) { max = difference; index = i; } }
    differences[key] = { max, index, tolerance }; if (max > tolerance) failures++;
  }
  console.log(JSON.stringify({ name, differences }));
}
function animate(h: Awaited<ReturnType<typeof actor>>, context: Partial<MotionInput>) {
  const input = { speed: 0, grounded: true, verticalVelocity: 0, turn: 0, ...context }, motion = newMotion();
  h.models.animate(h.rig, advanceMotion(motion, input, 0), motion, input, 0);
}
for (const id of ['neo', 'trinity', 'smith', 'morpheus'] as const) {
  const h = await actor(id);
  observeNormals(h);
  for (const grip of [0, .05, .25, .5, .65, .85, 1, .5, 0]) { h.draw(grip); snapshot(`${id}/grip/${grip}`, h); }
  for (const shot of [0, .4, 1, 0]) { animate(h, { armed: true, weaponStyle: 'hel_pistol', shot }); snapshot(`${id}/pistol/${shot}`, h); }
  h.draw(.65); h.rig.bones.get('wrist_R')!.rotation.set(.2, .7, -.4); h.rig.bones.get('wrist_L')!.rotation.set(-.3, -.6, .25);
  h.models['fightingHands'].get(h.rig)!.update(); snapshot(`${id}/turned`, h);
  if (id === 'morpheus') for (let frame = 0; frame <= 159; frame++) {
    const elapsed = frame / 30, training = { kind: 'red_dress' as const, elapsed, started: true, attention: redDressAttention(elapsed) }, root = trainingRoot(training, 'morpheus');
    h.rig.root.position.set(root.x, root.y, root.z); h.rig.root.rotation.y = root.yaw;
    animate(h, { training: { ...training, role: 'morpheus' } }); snapshot(`guide/${elapsed}`, h);
  }
  if (id === 'neo') {
    for (const choice of ['red', 'blue'] as const) for (const elapsed of [0, 1.1, 1.8, 2.5, 3.95, 4.35, 5.3, 8.9, 1.8]) {
      const pills = { role: 'neo' as const, choice, phase: 'taking' as const, elapsed }, center = FILM_SETS.film_lafayette.center;
      const p = pillRoot({ ...pills, approach: { x: PILL_ROOM.seat, z: PILL_ROOM.z, yaw: -Math.PI / 2 } });
      h.rig.root.position.set(center.x + p.x, center.y - 1, center.z + p.z); h.rig.root.rotation.y = p.yaw;
      animate(h, { pills, mirror: 0 }); snapshot(`pill/${choice}/${elapsed}`, h);
    }
    h.rig.root.position.set(MIRROR_SEAT.x, -1, MIRROR_SEAT.z); h.rig.root.rotation.y = Math.PI;
    for (const mirrorBeat of [0, .65, 1.35, 2.203, 3.1, 3.8, 4.2, 5.8, 6.3, 7.2]) {
      animate(h, { seated: true, performance: 'touch', mirrorBeat }); snapshot(`mirror/${mirrorBeat}`, h);
    }
  }
  h.models.dispose();
}
const connector = await coreConnector();
observeNormals(connector.morpheus);
for (const elapsed of [2.2, 2.35, 2.5, 2.8, 3, 4, 5.8, 5.9, 6.2, 6.6, 6.8, 4]) { connector.at(elapsed); snapshot(`core/${elapsed}`, connector.morpheus); }
connector.dispose();

if (failures) process.exitCode = 1;
if (mode === 'before') writeFileSync(new URL('./normal-range.json', import.meta.url), JSON.stringify(normalRange, null, 2) + '\n');
