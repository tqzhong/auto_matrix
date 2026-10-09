import assert from 'node:assert/strict';
import test from 'node:test';
import { build } from 'esbuild';
import * as THREE from 'three';
import { DEUS_PACT, deusPactPose, newDeusPact, stepDeusPact, type DeusPactEncounter, type SandboxState } from '@auto_matrix/shared';
import { MachineCoreRenderer } from '../packages/client/src/engine/MachineCoreRenderer.js';

test('the collective challenges Neo and asks what he wants before allowing a peace choice', () => {
  let beat: DeusPactEncounter = { ...newDeusPact(), phase: 'swarm' };
  const phases = new Set([beat.phase]);
  for (let i = 0; i < 400 && beat.phase !== 'terms'; i++) { beat = stepDeusPact(beat, true, .1); phases.add(beat.phase); }
  assert.deepEqual([...phases], ['swarm', 'forming', 'warning', 'challenge', 'question', 'terms']);
  assert.equal(beat.phase, 'terms');
  for (let i = 0; i < 50; i++) beat = stepDeusPact(beat, true, .1);
  assert.equal(beat.phase, 'terms', 'waiting and holding G cannot choose peace');
});

test('the failure-risk exchange happens after the body cables and before explicit neck consent', () => {
  let beat: DeusPactEncounter = { ...newDeusPact(), phase: 'seating', resolve: 3 };
  const phases = new Set([beat.phase]);
  for (let i = 0; i < 200 && beat.phase !== 'consent'; i++) { beat = stepDeusPact(beat, true, .1); phases.add(beat.phase); }
  assert.deepEqual([...phases], ['seating', 'cabling', 'assurance', 'consent']);
  assert.equal(beat.consent, 0, 'holding during dialogue is not yet consent');
  const pose = deusPactPose({ ...beat, phase: 'assurance', elapsed: DEUS_PACT.seconds.assurance / 2 });
  assert.equal(pose.seated, 1); assert.equal(pose.cables, 1); assert.ok(pose.probe > 0 && pose.probe < 1);
});

test('new spoken beats freeze on a stopped clock and recover from their exact saved phase', () => {
  for (const phase of ['challenge', 'question', 'assurance'] as DeusPactEncounter['phase'][]) {
    const saved = { ...newDeusPact(), phase, elapsed: .8, total: 12.1 };
    assert.deepEqual(stepDeusPact(saved, true, 0), saved);
    let warm = saved, cold = structuredClone(saved);
    for (let i = 0; i < 100; i++) { warm = stepDeusPact(warm, false, .05); cold = stepDeusPact(cold, false, .05); }
    assert.deepEqual(warm, cold);
  }
});

test('the actual machine mouth opens for its challenge and closes while Neo is speaking', () => {
  const root = new THREE.Group(), renderer = new MachineCoreRenderer(root);
  try {
    const plates = root.getObjectByName('machine-core-face-plates') as THREE.InstancedMesh;
    const beat = { ...newDeusPact(), phase: 'terms' as const, total: 8, elapsed: .8 };
    renderer.update(beat, 0, false, { x: 0, z: -25 });
    const closed = Array.from(plates.instanceMatrix.array), indices: number[] = [];
    for (let i = 0; i < plates.count; i++) if (Math.abs(closed[i * 16 + 12]) < 2 && closed[i * 16 + 13] > 16.7 && closed[i * 16 + 13] < 18.7) indices.push(i);
    assert.ok(indices.length > 25, 'sample the actual lower lip and jaw');
    renderer.update({ ...beat, phase: 'challenge' as DeusPactEncounter['phase'] }, 0, false, { x: 0, z: -25 });
    const spoken = Array.from(plates.instanceMatrix.array);
    const lower = indices.reduce((sum, i) => sum + closed[i * 16 + 13] - spoken[i * 16 + 13], 0) / indices.length;
    assert.ok(lower > .25, `machine challenge left the actual jaw closed: ${lower}`);
    renderer.update({ ...beat, phase: 'warning' }, 0, false, { x: 0, z: -25 });
    assert.deepEqual(Array.from(plates.instanceMatrix.array), closed, 'the machine cannot keep mouthing Neo’s warning');
  } finally { renderer.dispose(); }
});

test('visible surrounding machines use a bounded number of draw batches and retain full-size articulated silhouettes', () => {
  const root = new THREE.Group(), renderer = new MachineCoreRenderer(root);
  try {
    renderer.update({ ...newDeusPact(), phase: 'swarm', elapsed: 2, total: 2 }, 0, false, { x: 0, z: -25 });
    const swarm = root.getObjectByName('machine-core-swarm')!, batches: THREE.Mesh[] = [];
    swarm.traverseVisible(object => { if (object instanceof THREE.Mesh) batches.push(object); });
    assert.ok(batches.length <= 4, `96 little machines submit ${batches.length} independent meshes`);
    assert.ok(batches.every(mesh => mesh instanceof THREE.InstancedMesh));
    const hull = batches[0] as THREE.InstancedMesh, legs = batches[1] as THREE.InstancedMesh;
    hull.geometry.computeBoundingBox(); legs.geometry.computeBoundingBox();
    assert.ok(legs.geometry.boundingBox!.getSize(new THREE.Vector3()).x > hull.geometry.boundingBox!.getSize(new THREE.Vector3()).x * 1.5, 'limbs must extend beyond the hull');
    const saved = batches.map(mesh => Array.from((mesh as THREE.InstancedMesh).instanceMatrix.array));
    renderer.update({ ...newDeusPact(), phase: 'swarm', elapsed: 2, total: 2 }, 99, false, { x: 0, z: -25 });
    assert.deepEqual(batches.map(mesh => Array.from((mesh as THREE.InstancedMesh).instanceMatrix.array)), saved);
  } finally { renderer.dispose(); }
});

test('automatic negotiation lines do not ask players to keep holding or expose premature choices', async () => {
  const output = await build({ entryPoints: ['packages/client/src/player/FilmJourneyPanel.ts'], bundle: true,
    platform: 'node', format: 'esm', write: false, loader: { '.css': 'empty' }, logLevel: 'silent' });
  const { renderFilmJourney } = await import(`data:text/javascript;base64,${Buffer.from(output.outputFiles[0].contents).toString('base64')}`);
  const player = { id: 'neo', status: 'alive', position: { x: 0, y: 1, z: 0 }, isInMatrix: false };
  for (const phase of ['forming', 'challenge', 'warning', 'question', 'assurance']) {
    const state = { neoLife: { journey: { scene: 'm3_deus', actor: 'neo', step: phase === 'assurance' ? 3 : 1,
      reflections: {}, completed: [], lastText: '', deus: { ...newDeusPact(), phase, elapsed: .8, total: 10 } } } } as unknown as SandboxState;
    const html = renderFilmJourney(player, state);
    const action = html.match(/<div class="film-controls">([\s\S]*?)<small>/)![1];
    assert.doesNotMatch(action, /按住 G 站稳|data-target="film:(act|next|reflect:)/, phase);
    assert.match(action, /观看|聆听/, phase);
    if (phase === 'assurance') assert.doesNotMatch(action, /尚未允许接线/, 'the body is already supported and cabled');
  }
});
