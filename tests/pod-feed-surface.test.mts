import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from 'three';
import type { AwakeningBeat } from '@auto_matrix/shared';
import { podPatient } from './helpers/pod-patient.mjs';
import { patientSurface, segmentHitsSkin, skinIntersection } from './helpers/skin-surface.mjs';

test('the complete chest feed surfaces clear the actual patient throughout both saved oral-removal paths', async t => {
  const h = await podPatient(t), hoses = Array.from({ length: 4 }, (_, i) => h.root.getObjectByName(`pod-body-feed-${i}`) as THREE.Mesh<THREE.TubeGeometry>);
  const geometry = hoses.map(hose => hose.geometry);
  const beats: AwakeningBeat[] = [1.8, 1.85, 1.9, 4, 4.05, 4.1, 4.15, 4.5, 4.8].flatMap(elapsed => [{ kind: 'breather' as const, elapsed }, { kind: 'breather' as const, elapsed, emerged: true }]);
  beats.push(...[0, .4, .7, 1.1, 1.6, 2.4, 3.4, 4.2, 5.2].map(elapsed => ({ kind: 'emerge' as const, elapsed })));
  for (const emerged of [undefined, true]) for (let frame = 0; frame <= 110; frame++) beats.push({ kind: 'breather', elapsed: frame / 20, emerged });
  beats.push(...[0, 1.8, 3.5].map(elapsed => ({ kind: 'disconnect' as const, elapsed, breatherRemoved: true })));
  let rayComparisons = 0, checkedTriangles = 0;
  for (const beat of beats) {
    const body = h.at(beat.elapsed, 100, false, beat), skin = patientSurface(body, h.root);
    assert.ok(skin.triangles > 10000, 'the check must include the displayed skin, rather than an empty or proxy body');
    try {
      for (const [feed, hose] of hoses.entries()) {
        assert.equal(hose.geometry, geometry[feed], 'moving a hose cannot allocate a replacement mesh');
        const position = hose.geometry.attributes.position;
        assert.ok(Array.from(position.array).every(Number.isFinite));
        if (beat.kind === 'breather' && beat.elapsed === 2.4) for (const radial of [0, 2, 4, 6]) for (let segment = 0; segment < 24; segment++) {
          const a = new THREE.Vector3().fromBufferAttribute(position, segment * 9 + radial), b = new THREE.Vector3().fromBufferAttribute(position, (segment + 1) * 9 + radial);
          const from = h.root.localToWorld(a.clone()), delta = h.root.localToWorld(b.clone()).sub(from);
          const naive = new THREE.Raycaster(from, delta.clone().normalize(), .002, delta.length() - .002).intersectObjects(skin.meshes).length > 0;
          assert.equal(segmentHitsSkin(skin.tree, a, b), naive, 'the acceleration structure must agree with the existing ray check'); rayComparisons++;
        }
        const hit = skinIntersection(skin.tree, hose, h.root); checkedTriangles += hose.geometry.index!.count / 3;
        assert.ok(!hit, `hose crosses actual skin: ${JSON.stringify({ beat, feed, hit })}`);
      }
    } finally { skin.dispose(); }
  }
  t.diagnostic(JSON.stringify({ poses: beats.length, rayComparisons, checkedTriangles }));
});

test('Neo reaches for and lowers the pipe without crossing the implanted chest hardware', async t => {
  const h = await podPatient(t);
  const beats: AwakeningBeat[] = [...Array.from({ length: 20 }, (_, i) => 1.05 + i / 20), 2.4, 3.2, 3.6, ...Array.from({ length: 31 }, (_, i) => 4 + i / 20)]
    .map(elapsed => ({ kind: 'breather', elapsed, emerged: true }));
  beats.push(...Array.from({ length: 7 }, (_, i) => ({ kind: 'breather' as const, elapsed: 1.05 + i / 20 })));
  for (const beat of beats) {
    const body = h.at(beat.elapsed, 100, false, beat);
    const hands = body.getObjectByName('Anatomical_head_and_hands')!;
    const skin = patientSurface(hands, h.root), ports = body.getObjectByName('thoracic-interfaces')!;
    try {
      assert.ok(skin.triangles > 10000);
      const hardware = [...ports.children, ...Array.from({ length: 4 }, (_, i) => h.root.getObjectByName(`pod-body-plug-${i}`)!)];
      for (const [port, mesh] of hardware.entries()) {
        const hit = skinIntersection(skin.tree, mesh as THREE.Mesh, h.root);
        assert.ok(!hit, `hand crosses chest hardware: ${JSON.stringify({ beat, port, hit })}`);
      }
    } finally { skin.dispose(); }
  }
  t.diagnostic(JSON.stringify({ poses: beats.length, hardwareMeshes: 12 }));
});
