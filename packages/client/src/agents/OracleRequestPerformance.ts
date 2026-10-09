import * as THREE from 'three';
import { ORACLE_REQUEST, type OracleRequestGesture } from '@auto_matrix/shared';
import type { CharacterRig } from './CharacterModel.js';
import { reach } from './SpoonPerformance.js';

/** The Oracle sits on the living-room sofa; visitors remain standing. */
export function poseOracleRequest(rig: CharacterRig, gesture?: OracleRequestGesture): void {
  const skirt = rig.root.getObjectByName('oracle-request-dress') as THREE.Mesh<THREE.CylinderGeometry> | undefined;
  const buttons = rig.root.getObjectByName('oracle-request-bodice');
  const active = gesture?.role === 'oracle';
  if (skirt) skirt.visible = active;
  if (buttons) buttons.visible = active;
  if (!active || !skirt || rig.hero) {
    if (rig.detail.userData.oracleRequestPose) {
      delete rig.detail.userData.oracleRequestPose;
      rig.detail.position.set(0, 0, 0); rig.detail.rotation.set(0, 0, 0);
      rig.hips.forEach((hip, i) => { hip.position.x = (i ? 1 : -1) * .225; hip.position.z = 0; });
      if (rig.oracleClothing) rig.oracleClothing.blouse.color.copy(rig.oracleClothing.dry[0]);
    }
    return;
  }
  rig.detail.userData.oracleRequestPose = true;
  rig.root.getObjectByName('oracle-apron-group')!.visible = false;
  rig.root.getObjectByName('oracle-daily-collar')!.visible = false;
  rig.root.getObjectByName('oracle-daily-tailoring')!.visible = false;
  rig.root.getObjectByName('oracle-daily-hem')!.visible = false;
  rig.oracleClothing!.blouse.color.set(0x526e56);
  rig.detail.position.set(0, 0, 0); rig.detail.rotation.set(0, 0, 0);
  const hip = ORACLE_REQUEST.oracle.seat + .27;
  const speaking = gesture.phase === 'answering' && (gesture.step === 0 ? gesture.elapsed >= ORACLE_REQUEST.lineSeconds
    : gesture.elapsed >= ORACLE_REQUEST.lineSeconds && gesture.elapsed < ORACLE_REQUEST.lineSeconds * 2 || gesture.elapsed >= ORACLE_REQUEST.lineSeconds * 3);
  const gestureAmount = speaking ? Math.sin(gesture.elapsed * 1.3) * .06 : 0;
  rig.torso.position.set(0, hip, -.03); rig.torso.rotation.set(-.035, 0, 0);
  rig.head.rotation.set(.035 + gestureAmount * .22, -.08, 0);
  rig.root.updateWorldMatrix(true, true);
  const orientation = rig.detail.getWorldQuaternion(new THREE.Quaternion());
  for (let i = 0; i < 2; i++) {
    const side = i ? 1 : -1;
    rig.hips[i].position.set(side * .225, hip + .06, -.03); rig.hips[i].updateWorldMatrix(false, true);
    reach(rig.hips[i], rig.knees[i], rig.ankles[i].position,
      rig.detail.localToWorld(new THREE.Vector3(side * .27, .16, 1.23)), new THREE.Vector3(side * .1, .2, 1).applyQuaternion(orientation));
    rig.ankles[i].quaternion.copy(rig.knees[i].getWorldQuaternion(new THREE.Quaternion()).invert().multiply(orientation));
    reach(rig.shoulders[i], rig.elbows[i], new THREE.Vector3(0, -.79, .055),
      rig.detail.localToWorld(new THREE.Vector3(side * (.32 + (i ? gestureAmount : 0)), hip + .25 + Math.abs(gestureAmount), .70)),
      new THREE.Vector3(side * .3, -1, -.2).applyQuaternion(orientation));
    rig.fingers[i].forEach(finger => { finger.rotation.x = -.18; });
  }
  rig.root.updateWorldMatrix(true, true);
  if (skirt.userData.oracleRequestDraped) return;
  rig.torso.updateMatrix();
  const inverse = rig.detail.matrixWorld.clone().invert(), capsules: { point: THREE.Vector3; radius: number }[] = [];
  for (let leg = 0; leg < 2; leg++) {
    const joints = [rig.hips[leg], rig.knees[leg], rig.ankles[leg]].map(joint => joint.getWorldPosition(new THREE.Vector3()).applyMatrix4(inverse));
    for (let part = 0; part < 2; part++) for (let sample = 0; sample <= 12; sample++) {
      const t = sample / 12;
      capsules.push({ point: joints[part].clone().lerp(joints[part + 1], t), radius: part ? .235 - .04 * t : .29 - .065 * t });
    }
  }
  const { radialSegments: columns, heightSegments: rows } = skirt.geometry.parameters;
  const vertices = skirt.geometry.attributes.position, point = new THREE.Vector3();
  for (let row = 0; row <= rows; row++) {
    const t = row / rows, y = t <= .45 ? hip + .12 - t * .4 : hip - .06 - (t - .45) * 2.2;
    const sections = capsules.flatMap(capsule => {
      const squared = capsule.radius ** 2 - (capsule.point.y - y) ** 2;
      return squared > 0 ? [{ x: capsule.point.x, z: capsule.point.z, squared }] : [];
    });
    const width = Math.max(.51 + t * .2, ...sections.map(section => Math.abs(section.x) + Math.sqrt(section.squared) + .035));
    for (let column = 0; column <= columns; column++) {
      const angle = column / columns * Math.PI * 2, side = Math.cos(angle) >= 0 ? 1 : -1;
      const lap = Math.min(1, t / .45), wave = Math.cos(angle * 9) * .012 * t;
      point.set(Math.sin(angle) * (width + wave), Math.max(.045, y), lap * 1.16 + Math.cos(angle) * (.32 - lap * .17));
      for (const section of sections) {
        const squared = section.squared - (point.x - section.x) ** 2;
        if (squared > 0) point.z = side * Math.max(side * point.z, side * section.z + Math.sqrt(squared) + .045);
      }
      if (!row) point.set(Math.sin(angle) * .527, .12, Math.cos(angle) * .527 * .59).applyMatrix4(rig.torso.matrix);
      // Below the cushion the skirt hangs over its front, rather than through
      // the sofa. The root is at -10.95; the cushion's front is at -9.94.
      if (point.y < ORACLE_REQUEST.oracle.seat + .035) point.z = Math.max(1.08, point.z);
      vertices.setXYZ(row * (columns + 1) + column, point.x, point.y, point.z);
    }
  }
  vertices.needsUpdate = true; skirt.geometry.computeVertexNormals(); skirt.geometry.computeBoundingSphere();
  skirt.userData.oracleRequestDraped = true;
  rig.root.updateWorldMatrix(true, true);
}
