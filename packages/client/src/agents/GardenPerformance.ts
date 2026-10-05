import * as THREE from 'three';
import { gardenPose, SUNRISE_GARDEN, type TrilogyEpilogueGesture } from '@auto_matrix/shared';
import type { CharacterRig } from './CharacterModel.js';
import { reach } from './SpoonPerformance.js';
import { poseStreetWake } from './StreetWakePerformance.js';

const wakeSupports = new WeakMap<CharacterRig, { rising: number; surfaceVersion: number; height: number }>();

function drapeSatiSkirt(rig: CharacterRig, street = false): void {
  const skirt = rig.root.getObjectByName('sati-skirt') as THREE.Mesh | undefined; if (!skirt) return;
  const vertices = skirt.geometry.attributes.position, hip = rig.torso.position.y;
  const { radialSegments: columns, heightSegments: rows } = (skirt.geometry as THREE.CylinderGeometry).parameters;
  rig.root.updateWorldMatrix(true, true);
  const inverse = rig.detail.matrixWorld.clone().invert();
  const bodice = inverse.clone().multiply(rig.torso.matrixWorld), seam = new THREE.Vector3();
  const capsules: { point: THREE.Vector3; radius: number }[] = [];
  for (let leg = 0; leg < 2; leg++) {
    const joints = [rig.hips[leg], rig.knees[leg], rig.ankles[leg]].map(joint => joint.getWorldPosition(new THREE.Vector3()).applyMatrix4(inverse));
    for (let part = 0; part < 2; part++) for (let sample = 0; sample <= 12; sample++) {
      if (street && part === 1) continue;
      const t = sample / 12;
      capsules.push({ point: joints[part].clone().lerp(joints[part + 1], t), radius: part ? .21 - .045 * t : .29 - .065 * t });
    }
  }
  const seamY = street ? .30 : .12, seamRadius = street ? .44 + (.38 - .44) * (.30 - .18) / (.35 - .18) : .43 + .01 * .12 / .18;
  const top = new THREE.Vector3(0, seamY, 0).applyMatrix4(bodice);
  const knee = rig.knees[0].getWorldPosition(new THREE.Vector3()).lerp(rig.knees[1].getWorldPosition(new THREE.Vector3()), .5).applyMatrix4(inverse);
  const curve = new THREE.CubicBezierCurve3(top, top.clone().lerp(knee, .25), top.clone().lerp(knee, .75), knee);
  const right = new THREE.Vector3(), up = new THREE.Vector3(), forward = new THREE.Vector3(), point = new THREE.Vector3();
  for (let row = 0; row <= rows; row++) {
    const t = row / rows, y = hip + .12 - t * 1.07;
    const center = street ? curve.getPoint(t) : new THREE.Vector3(0, y, 0);
    up.copy(street ? curve.getTangent(t).negate() : new THREE.Vector3(0, 1, 0));
    if (street) up.lerp(new THREE.Vector3(0, 1, 0).applyQuaternion(rig.torso.quaternion),
      1 - THREE.MathUtils.smoothstep(t, 0, .65)).normalize();
    right.set(1, 0, 0); if (street) right.applyQuaternion(rig.torso.quaternion);
    right.addScaledVector(up, -right.dot(up)).normalize(); forward.crossVectors(right, up).normalize();
    const sections = capsules.flatMap(({ point, radius }) => {
      const offset = point.clone().sub(center), squared = radius * radius - offset.dot(up) ** 2;
      return squared > 0 ? [{ x: offset.dot(right), z: offset.dot(forward), squared }] : [];
    });
    const width = Math.max(.48 + t * .18, ...sections.map(section => Math.abs(section.x) + Math.sqrt(section.squared) + (street ? .05 : .025)));
    for (let column = 0; column <= columns; column++) {
      const angle = column / columns * Math.PI * 2, side = Math.cos(angle) >= 0 ? 1 : -1;
      const pleat = Math.cos(angle * 12) * .013 * t, x = Math.sin(angle) * (width + pleat);
      let z = Math.cos(angle) * (.30 + t * .13 + pleat);
      for (const section of sections) {
        const depth = section.squared - (x - section.x) ** 2;
        if (depth > 0) z = side * Math.max(side * z, side * section.z + Math.sqrt(depth) + (street ? .10 : .06));
      }
      // The upper ring shares the bodice's actual cross-section and rotation.
      // Only the fabric below it is displaced around the walking legs.
      const pin = 1 - THREE.MathUtils.smoothstep(t, 0, .08);
      seam.set(Math.sin(angle) * seamRadius, seamY - t * 1.07,
        Math.cos(angle) * seamRadius * .59).applyMatrix4(bodice);
      point.copy(center).addScaledVector(right, x).addScaledVector(forward, z).lerp(seam, pin);
      // Cloth can spread across the pavement as the knees gather, rather than
      // pushing the character upward to accommodate a rigid standing hem.
      if (street) point.y = Math.max(.008, point.y);
      vertices.setXYZ(row * (columns + 1) + column, point.x, point.y, point.z);
    }
  }
  vertices.needsUpdate = true; skirt.geometry.computeVertexNormals(); skirt.geometry.computeBoundingSphere();
}

/** Authored body poses use the saved story clock, including stationary dialogue. */
export function poseGarden(rig: CharacterRig, gesture?: TrilogyEpilogueGesture, parkOutfit = false): void {
  const park = parkOutfit || gesture?.kind === 'dawn';
  const outfit = rig.root.getObjectByName('oracle-park-outfit'); if (outfit) outfit.visible = park;
  if (rig.oracleClothing && park) {
    rig.root.getObjectByName('oracle-apron-group')!.visible = false;
    rig.oracleClothing.blouse.color.set(0x536765);
  }
  if (!gesture || !['dawn', 'reset'].includes(gesture.kind) || rig.hero) {
    if (rig.detail.userData.epiloguePose) {
      rig.detail.position.y = 0; rig.detail.rotation.set(0, 0, 0); delete rig.detail.userData.epiloguePose;
      rig.hips.forEach((joint, i) => { joint.position.x = (i ? 1 : -1) * .225; joint.position.z = 0; });
      if (rig.head.name === 'sati-head') rig.head.position.set(0, 1.99, 0);
      for (const side of [-1, 1]) rig.root.getObjectByName(`sati-hand-${side}`)?.rotation.set(0, 0, 0);
      for (const name of ['oracle-park-skirt', 'sati-skirt']) {
        const skirt = rig.root.getObjectByName(name) as THREE.Mesh | undefined;
        if (skirt) { skirt.geometry.attributes.position.array.set(skirt.userData.standing); skirt.geometry.attributes.position.needsUpdate = true; skirt.geometry.computeVertexNormals(); }
      }
    }
    const bag = rig.root.getObjectByName('oracle-park-handbag'); if (bag) bag.visible = false;
    drapeSatiSkirt(rig);
    return;
  }
  rig.detail.userData.epiloguePose = true; rig.detail.rotation.set(0, 0, 0); rig.detail.position.y = 0;
  if (rig.head.name === 'sati-head') rig.head.position.set(0, 1.99, 0);
  if (gesture.kind === 'reset' && gesture.resetVersion === 2 && gesture.role === 'sati') {
    poseStreetWake(rig, gesture); drapeSatiSkirt(rig, true);
    return;
  }
  const pose = gardenPose(gesture, gesture.role), time = gesture.total;
  const reset = gesture.kind === 'reset';
  const rising = reset ? gesture.phase === 'ready' ? 0 : gesture.phase === 'waking' ? THREE.MathUtils.smoothstep(gesture.elapsed, 0, 3.2) : 1 : 1;
  const seated = reset ? 0 : pose.seated;
  const scale = rig.root.scale.x, hip = THREE.MathUtils.lerp(1.995, SUNRISE_GARDEN.bench.surface / scale + .22, seated);
  const stride = Math.sin(time * (gesture.role === 'sati' ? 10 : 7));
  rig.torso.position.set(0, hip, 0); rig.torso.rotation.set(.03 * seated, 0, 0);
  rig.head.rotation.set(-.035 * seated, gesture.role === 'oracle' && ['sati', 'sunrise', 'belief', 'done'].includes(gesture.phase) ? -.28 : 0, 0);
  for (let i = 0; i < 2; i++) {
    const side = i ? 1 : -1, gait = pose.walk && !reset ? stride * side * (1 - seated) : 0;
    // Hip joints sit above the supported pelvis so the bent thigh does not cut into the seat.
    rig.hips[i].position.y = hip + .09 * seated; rig.hips[i].rotation.set(gait * .5, 0, 0);
    rig.knees[i].rotation.set(Math.max(0, -gait) * .65, 0, 0); rig.ankles[i].rotation.set(0, 0, 0);
    rig.shoulders[i].rotation.set(-gait * .4, 0, side * .08); rig.elbows[i].rotation.set(-.18, 0, 0);
    rig.fingers[i].forEach(finger => { finger.rotation.x = -.12; });
  }
  if (seated > 0) {
    rig.root.updateWorldMatrix(true, true); const orientation = rig.root.getWorldQuaternion(new THREE.Quaternion());
    for (let i = 0; i < 2; i++) {
      const target = rig.root.localToWorld(new THREE.Vector3(i ? .24 : -.24, gesture.role === 'sati' ? Math.max(.16, hip - .93) : .156, .96));
      const foot = rig.ankles[i].getWorldPosition(new THREE.Vector3()).lerp(target, seated);
      reach(rig.hips[i], rig.knees[i], rig.ankles[i].position, foot, new THREE.Vector3(0, 0, 1).applyQuaternion(orientation));
      rig.ankles[i].quaternion.copy(rig.knees[i].getWorldQuaternion(new THREE.Quaternion()).invert().multiply(orientation));
      const palm = new THREE.Vector3(0, -.79, .055);
      const hand = rig.root.localToWorld(new THREE.Vector3((i ? 1 : -1) * .3, hip + .53, .53));
      reach(rig.shoulders[i], rig.elbows[i], palm, rig.elbows[i].localToWorld(palm.clone()).lerp(hand, seated),
        new THREE.Vector3((i ? 1 : -1) * .6, -.7, -.25).applyQuaternion(orientation));
    }
  }
  if (!reset && seated === 0) {
    rig.root.updateWorldMatrix(true, true);
    const orientation = rig.root.getWorldQuaternion(new THREE.Quaternion()), floor = rig.root.localToWorld(new THREE.Vector3(0, .156, 0)).y;
    for (let i = 0; i < 2; i++) {
      const foot = rig.ankles[i].getWorldPosition(new THREE.Vector3()); foot.y = Math.max(foot.y, floor);
      reach(rig.hips[i], rig.knees[i], rig.ankles[i].position, foot, new THREE.Vector3(0, 0, 1).applyQuaternion(orientation));
      rig.ankles[i].quaternion.copy(rig.knees[i].getWorldQuaternion(new THREE.Quaternion()).invert().multiply(orientation));
    }
  }
  // The coat/dress follows the lap instead of leaving a rigid standing cylinder through the bench.
  const skirt = gesture.role === 'oracle' ? rig.root.getObjectByName('oracle-park-skirt') as THREE.Mesh | undefined : undefined;
  if (skirt) {
    const positions = skirt.geometry.attributes.position;
    for (let row = 0; row <= 10; row++) for (let column = 0; column <= 32; column++) {
      const t = row / 10, angle = column / 32 * Math.PI * 2, wave = Math.cos(angle * 9) * .018 * t;
      const radius = .51 + t * .19 + wave;
      const lap = Math.min(1, t * 2), depth = THREE.MathUtils.lerp(.33, .13, lap);
      const drapedY = t <= .5 ? hip + .12 - t * .3 : hip - .03 - (t - .5) * 1.54;
      const z = THREE.MathUtils.lerp(Math.cos(angle) * (.33 + t * .16), lap * 1.02 + Math.cos(angle) * depth, seated);
      const y = THREE.MathUtils.lerp(hip + .12 - t * 1.58, drapedY, seated);
      positions.setXYZ(row * 33 + column, Math.sin(angle) * radius, y, z);
    }
    positions.needsUpdate = true; skirt.geometry.computeVertexNormals();
  }
  drapeSatiSkirt(rig);
  const bag = rig.root.getObjectByName('oracle-park-handbag');
  if (bag) { bag.visible = seated > .05; bag.position.set(0, hip + .35, .42); bag.scale.setScalar(seated); }
  if (reset) {
    rig.detail.rotation.x = -Math.PI / 2 * (1 - rising);
    rig.torso.rotation.x = Math.sin(rising * Math.PI) * .55;
    rig.knees.forEach(knee => { knee.rotation.x = Math.sin(rising * Math.PI) * .8; });
    const surfaceVersion = Number(rig.head.userData.surfaceVersion ?? 0);
    let support = wakeSupports.get(rig);
    if (!support || support.rising !== rising || support.surfaceVersion !== surfaceVersion) {
      rig.root.updateWorldMatrix(true, true);
      const inverse = rig.root.matrixWorld.clone().invert(), point = new THREE.Vector3(); let lowest = Infinity;
      rig.detail.traverseVisible(object => {
        if (!(object instanceof THREE.Mesh)) return;
        object.updateMatrixWorld(true);
        if (object instanceof THREE.SkinnedMesh) object.skeleton.update();
        const matrix = inverse.clone().multiply(object.matrixWorld);
        for (let i = 0; i < object.geometry.attributes.position.count; i++) lowest = Math.min(lowest, object.getVertexPosition(i, point).applyMatrix4(matrix).y);
      });
      support = { rising, surfaceVersion, height: Number.isFinite(lowest) ? -lowest : 0 }; wakeSupports.set(rig, support);
    }
    rig.detail.position.y = support.height;
  }
}
