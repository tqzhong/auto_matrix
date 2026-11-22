import assert from 'node:assert/strict';
import { test } from 'node:test';
import * as THREE from 'three';
import { FILM_SETS, podRunoffHeight } from '@auto_matrix/shared';
import { podPatient } from './helpers/pod-patient.mts';

test('runoff contact bounds per-pose skin sampling without letting the full body pass below the pipe', async t => {
  const h = await podPatient(t), center = FILM_SETS.film_power_plant_pods.center;
  const meshes = h.rig.wardrobe.map(part => part.mesh).filter((mesh): mesh is THREE.SkinnedMesh =>
    mesh instanceof THREE.SkinnedMesh && ((mesh.material as THREE.Material).name === 'Skin' || mesh.userData.patientBody));
  const totalVertices = meshes.reduce((count, mesh) => count + mesh.geometry.attributes.position.count, 0);
  assert.ok(totalVertices > 10000, `the full-body fixture should exercise a meaningful surface (${totalVertices} vertices)`);
  const samples = [4.6, 4.8, 5, 5.2, 5.35, 5.65, 6.35, 6.6, 6.85, 7.1, 7.35];
  for (const elapsed of samples) {
    let calls = 0;
    const originals = meshes.map(mesh => mesh.getVertexPosition);
    meshes.forEach((mesh, i) => {
      mesh.getVertexPosition = function (index, target) { calls++; return originals[i].call(this, index, target); };
    });
    h.at(elapsed, 100, false, { kind: 'disconnect', elapsed, emerged: true, breatherRemoved: true });
    meshes.forEach((mesh, i) => { mesh.getVertexPosition = originals[i]; });
    assert.ok(calls > 0 && calls * 4 < totalVertices, `${elapsed}s evaluated ${calls} of ${totalVertices} vertices for one pose`);

    let minimum = Infinity;
    for (const mesh of meshes) {
      mesh.updateMatrixWorld(true); mesh.skeleton.update();
      const positions = mesh.geometry.attributes.position;
      for (let i = 0; i < positions.count; i++) {
        const point = mesh.getVertexPosition(i, new THREE.Vector3()).applyMatrix4(mesh.matrixWorld);
        const height = podRunoffHeight(point.x - center.x, point.z - center.z);
        if (height !== undefined) minimum = Math.min(minimum, point.y - (center.y - 1 + height));
      }
    }
    if (elapsed < 7) assert.ok(Number.isFinite(minimum), `${elapsed}s should still cross the pool surface`);
    if (Number.isFinite(minimum)) assert.ok(minimum >= .005, `${elapsed}s full-surface clearance fell to ${minimum}`);
    else assert.ok(elapsed >= 7, `${elapsed}s lost pool contact before the body reached the outlet`);
  }
});
