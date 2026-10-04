import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from 'three';
import { SMITH_FINALE, newSmithFinale, smithFinalePose, stepSmithFinale, type SmithFinaleEncounter } from '@auto_matrix/shared';
import { SmithFinaleRenderer } from '../packages/client/src/engine/SmithFinaleRenderer.js';

test('the final approach, consent and assimilation preserve both body roots at phase boundaries', () => {
  const boundaries: [SmithFinaleEncounter, SmithFinaleEncounter][] = [
    [{ ...newSmithFinale(), phase: 'assault_ready' }, { ...newSmithFinale(), phase: 'assault' }],
    [{ ...newSmithFinale(), phase: 'understanding' }, { ...newSmithFinale(), phase: 'surrender' }],
  ];
  for (const phase of ['assault', 'surrender', 'assimilating', 'purging'] as const) {
    const duration = phase === 'assault' ? SMITH_FINALE.assault : phase === 'surrender' ? SMITH_FINALE.surrender.consentSeconds
      : phase === 'assimilating' ? SMITH_FINALE.surrender.assimilationSeconds : SMITH_FINALE.surrender.purgeSeconds;
    const before = { ...newSmithFinale(), phase, elapsed: duration - .00001, total: 50, focus: duration - .00001 };
    boundaries.push([before, stepSmithFinale(before, { focus: true, x: 0, z: 0 }, .00001)]);
  }
  for (const [before, after] of boundaries) for (const role of ['neo', 'smith'] as const) {
    const a = smithFinalePose(before)[role], b = smithFinalePose(after)[role];
    assert.ok(Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z) < .002, `${role} jumps at ${before.phase} → ${after.phase}`);
  }
});

test('the final contact leaves space between the full bodies instead of overlapping both torsos', () => {
  for (const phase of ['surrender', 'assimilating', 'purging'] as const) for (const elapsed of [0, .5, 1.5, 3]) {
    const pose = smithFinalePose({ ...newSmithFinale(), phase, elapsed, focus: SMITH_FINALE.surrender.consentSeconds });
    assert.ok(pose.smith.z - pose.neo.z >= 2, `${phase}/${elapsed}: only ${pose.smith.z - pose.neo.z} between body roots`);
  }
});

test('the purge light stays in the pit between its bodies rather than orbiting the avenue origin', () => {
  const root = new THREE.Group(), renderer = new SmithFinaleRenderer(root);
  try {
    for (const elapsed of [.4, 1.4, 2.4]) {
      const beat: SmithFinaleEncounter = { ...newSmithFinale(), phase: 'purging', elapsed, total: 100 + elapsed };
      renderer.update(beat, false, { x: 0, z: -38 }); root.updateMatrixWorld(true);
      const purge = root.getObjectByName('smith-finale-purge')!;
      const light = purge.children.find(child => child instanceof THREE.PointLight)!;
      const position = light.getWorldPosition(new THREE.Vector3());
      assert.ok(Math.abs(position.x) < 1 && Math.abs(position.z + 38) < 3 && position.y < -5,
        `the connection light leaves the bodies: ${position.toArray()}`);
      purge.traverse(object => {
        if (object instanceof THREE.Mesh) assert.equal((object.material as THREE.MeshBasicMaterial).wireframe, false, 'the internal white burst is not a golden wire sphere');
      });
    }
  } finally { renderer.dispose(); }
});
