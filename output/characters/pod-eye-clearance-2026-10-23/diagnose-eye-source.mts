import { writeFile } from 'node:fs/promises';
import test from 'node:test';
import * as THREE from 'three';
import { podPatient } from './baseline-release/tests/helpers/pod-patient.mjs';

test('inspect the delivered eye meshes against the stored head-local markers', async t => {
  const h = await podPatient(t), body = h.at(2.648, 100, false, { kind: 'breather', elapsed: 2.648, emerged: true });
  const head = body.getObjectByName('head')!, rows: unknown[] = [];
  body.traverse(object => {
    if (!(object instanceof THREE.Mesh) || !/eye|iris|sclera/i.test(object.name + ' ' + (object.material as THREE.Material).name)) return;
    if (object instanceof THREE.SkinnedMesh) object.skeleton.update();
    const boxes = [new THREE.Box3(), new THREE.Box3()];
    for (let i = 0; i < object.geometry.attributes.position.count; i++) {
      const point = head.worldToLocal(object.localToWorld(object.getVertexPosition(i, new THREE.Vector3())));
      boxes[point.x < 0 ? 0 : 1].expandByPoint(point);
    }
    rows.push({ name: object.name, material: (object.material as THREE.Material).name, visible: object.visible,
      sides: boxes.map(box => ({ min: box.min.toArray(), max: box.max.toArray(), centre: box.getCenter(new THREE.Vector3()).toArray() })) });
  });
  const report = { cameraEye: (head.userData.cameraEye as THREE.Vector3).toArray(), patientEye: (head.userData.patientEye as THREE.Vector3).toArray(), meshes: rows };
  await writeFile(new URL('./eye-source-mesh.json', import.meta.url), JSON.stringify(report, null, 2)); t.diagnostic(JSON.stringify(report));
});
