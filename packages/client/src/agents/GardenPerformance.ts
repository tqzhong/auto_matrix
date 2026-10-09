import * as THREE from 'three';
import { gardenPose, gardenGroundHeight, FILM_SETS, SUNRISE_GARDEN, type TrilogyEpilogueGesture } from '@auto_matrix/shared';
import type { CharacterRig } from './CharacterModel.js';
import { reach } from './SpoonPerformance.js';
import { poseStreetWake } from './StreetWakePerformance.js';

const wakeSupports = new WeakMap<CharacterRig, { rising: number; surfaceVersion: number; height: number }>();

function supportGardenFeet(rig: CharacterRig, bend: boolean): void {
  rig.root.updateWorldMatrix(true, true);
  const orientation = rig.root.getWorldQuaternion(new THREE.Quaternion()), floor = rig.root.localToWorld(new THREE.Vector3(0, .156, 0)).y;
  const center = FILM_SETS.film_sunrise_garden.center, origin = rig.root.getWorldPosition(new THREE.Vector3());
  const bodyHeight = gardenGroundHeight(origin.x - center.x, origin.z - center.z);
  if (bend) {
    const downhill = Math.max(0, ...rig.ankles.map(ankle => {
      const foot = ankle.getWorldPosition(new THREE.Vector3()); return bodyHeight - gardenGroundHeight(foot.x - center.x, foot.z - center.z);
    }));
    // Give the knees room to bend: a fully extended leg cannot reach a lower slope by IK alone.
    rig.detail.position.y -= .06 + downhill / rig.root.scale.x; rig.root.updateWorldMatrix(true, true);
  }
  for (let i = 0; i < 2; i++) {
    const foot = rig.ankles[i].getWorldPosition(new THREE.Vector3()), x = foot.x - center.x, z = foot.z - center.z;
    foot.y = Math.max(foot.y, floor) + gardenGroundHeight(x, z) - bodyHeight;
    const normal = new THREE.Vector3((gardenGroundHeight(x - .05, z) - gardenGroundHeight(x + .05, z)) / .1, 1,
      (gardenGroundHeight(x, z - .05) - gardenGroundHeight(x, z + .05)) / .1).normalize();
    const planted = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), normal).multiply(orientation);
    reach(rig.hips[i], rig.knees[i], rig.ankles[i].position, foot, new THREE.Vector3(0, 0, 1).applyQuaternion(orientation));
    rig.ankles[i].quaternion.copy(rig.knees[i].getWorldQuaternion(new THREE.Quaternion()).invert().multiply(planted));
  }
}

function drapeOracleClothes(rig: CharacterRig, gesture: TrilogyEpilogueGesture, seated: number): void {
  const pose = gardenPose(gesture, 'oracle'), hip = rig.torso.position.y, b = SUNRISE_GARDEN.bench;
  const cosine = Math.cos(pose.yaw), sine = Math.sin(pose.yaw), point = new THREE.Vector3();
  rig.root.updateWorldMatrix(true, true); rig.torso.updateMatrix();
  const inverse = rig.detail.matrixWorld.clone().invert(), capsules: { point: THREE.Vector3; radius: number }[] = [];
  for (let leg = 0; leg < 2; leg++) {
    const joints = [rig.hips[leg], rig.knees[leg], rig.ankles[leg]].map(joint => joint.getWorldPosition(new THREE.Vector3()).applyMatrix4(inverse));
    for (let part = 0; part < 2; part++) for (let sample = 0; sample <= 12; sample++) {
      const t = sample / 12;
      capsules.push({ point: joints[part].clone().lerp(joints[part + 1], t), radius: part ? .235 - .04 * t : .29 - .065 * t });
    }
  }
  for (const name of ['oracle-park-skirt', 'oracle-park-coat']) {
    const skirt = rig.root.getObjectByName(name) as THREE.Mesh, coat = name === 'oracle-park-coat';
    const { radialSegments: columns, heightSegments: rows, thetaStart, thetaLength } = (skirt.geometry as THREE.CylinderGeometry).parameters;
    const vertices = skirt.geometry.attributes.position, length = coat ? 1.92 : 1.58;
    for (let row = 0; row <= rows; row++) {
      const t = row / rows, drapedY = t <= .5 ? hip + .12 - t * .3 : hip - .03 - (t - .5) * (coat ? 1.86 : 1.54);
      const y = THREE.MathUtils.lerp(hip + .12 - t * length, drapedY, seated);
      const sections = capsules.flatMap(capsule => {
        const squared = capsule.radius ** 2 - (capsule.point.y - y) ** 2;
        return squared > 0 ? [{ x: capsule.point.x, z: capsule.point.z, squared }] : [];
      });
      const width = Math.max((coat ? .57 : .51) + t * (coat ? .24 : .19), ...sections.map(section => Math.abs(section.x) + Math.sqrt(section.squared) + (coat ? .065 : .035)));
      for (let column = 0; column <= columns; column++) {
        const angle = thetaStart + column / columns * thetaLength, wave = Math.cos(angle * 9) * .018 * t, radius = width + wave;
        const lap = Math.min(1, t * 2), depth = THREE.MathUtils.lerp(coat ? .37 : .33, coat ? .18 : .13, lap);
        point.set(Math.sin(angle) * radius, y,
          THREE.MathUtils.lerp(Math.cos(angle) * (coat ? .37 + t * .18 : .33 + t * .16), lap * 1.02 + Math.cos(angle) * depth, seated));
        const side = Math.cos(angle) >= 0 ? 1 : -1;
        for (const section of sections) {
          const squared = section.squared - (point.x - section.x) ** 2;
          if (squared > 0) point.z = side * Math.max(side * point.z, side * section.z + Math.sqrt(squared) + (coat ? .065 : .04));
        }
        if (!row) point.set(Math.sin(angle) * (coat ? .582 : .527), .12,
          Math.cos(angle) * (coat ? .582 * .65 : .527 * .59)).applyMatrix4(rig.torso.matrix);
        // Fabric below the seat wraps over its front edge throughout lowering,
        // not only once the pelvis has reached the final sitting height.
        const x = (point.x + rig.detail.position.x) * cosine + (point.z + rig.detail.position.z) * sine + pose.x;
        const z = (point.z + rig.detail.position.z) * cosine - (point.x + rig.detail.position.x) * sine + pose.z;
        if (Math.abs(x - b.x) < b.width / 2 + .08 && z > b.z - .91 && z < b.z + .93 && point.y < b.surface + length / rows + .045) {
          const front = b.z - .91 - Math.max(0, b.surface - point.y) * .10;
          point.x = (x - pose.x) * cosine - (front - pose.z) * sine - rig.detail.position.x;
          point.z = (front - pose.z) * cosine + (x - pose.x) * sine - rig.detail.position.z;
        }
        vertices.setXYZ(row * (columns + 1) + column, point.x, Math.max(.01, point.y), point.z);
      }
    }
    vertices.needsUpdate = true; skirt.geometry.computeVertexNormals(); skirt.geometry.computeBoundingSphere();
  }
}

function carryOracleBag(rig: CharacterRig): void {
  const bag = rig.root.getObjectByName('oracle-park-handbag'); if (!bag?.parent?.visible) return;
  rig.shoulders[0].rotation.z = -.30;
  rig.root.updateWorldMatrix(true, true);
  const palm = rig.elbows[0].localToWorld(new THREE.Vector3(0, -.79, .055));
  bag.visible = true; bag.scale.setScalar(1); bag.rotation.set(0, 0, 0);
  bag.position.copy(rig.root.worldToLocal(palm)).sub(new THREE.Vector3(0, .69, .11));
}

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
  const upper = rig.root.getObjectByName('oracle-park-upper'); if (upper) upper.visible = park;
  for (const name of ['oracle-daily-blouse', 'oracle-daily-hem', 'oracle-daily-collar', 'oracle-daily-tailoring']) {
    const daily = rig.root.getObjectByName(name); if (daily) daily.visible = !park;
  }
  if (rig.oracleClothing && park) {
    rig.root.getObjectByName('oracle-apron-group')!.visible = false;
    rig.oracleClothing.blouse.color.set(0x304b59);
  }
  if (!gesture || !['dawn', 'reset'].includes(gesture.kind) || rig.hero) {
    if (rig.detail.userData.epiloguePose) {
      rig.detail.position.set(0, 0, 0); rig.detail.rotation.set(0, 0, 0); delete rig.detail.userData.epiloguePose;
      rig.hips.forEach((joint, i) => { joint.position.x = (i ? 1 : -1) * .225; joint.position.z = 0; });
      if (rig.head.name === 'sati-head') rig.head.position.set(0, 1.99, 0);
      for (const side of [-1, 1]) rig.root.getObjectByName(`sati-hand-${side}`)?.rotation.set(0, 0, 0);
      for (const name of ['oracle-park-skirt', 'oracle-park-coat', 'sati-skirt']) {
        const skirt = rig.root.getObjectByName(name) as THREE.Mesh | undefined;
        if (skirt) { skirt.geometry.attributes.position.array.set(skirt.userData.standing); skirt.geometry.attributes.position.needsUpdate = true; skirt.geometry.computeVertexNormals(); }
      }
    }
    if (park && !rig.hero) {
      rig.detail.userData.epiloguePose = true; supportGardenFeet(rig, true);
      const center = FILM_SETS.film_sunrise_garden.center, point = new THREE.Vector3();
      for (const name of ['oracle-park-skirt', 'oracle-park-coat']) {
        const cloth = rig.root.getObjectByName(name) as THREE.Mesh | undefined; if (!cloth) continue;
        const vertices = cloth.geometry.attributes.position;
        for (let index = 0; index < vertices.count; index++) {
          point.fromBufferAttribute(vertices, index); cloth.localToWorld(point);
          const ground = center.y - 1 + gardenGroundHeight(point.x - center.x, point.z - center.z);
          if (point.y >= ground + .016) continue;
          point.y = ground + .016; cloth.worldToLocal(point); vertices.setXYZ(index, point.x, point.y, point.z);
        }
        vertices.needsUpdate = true; cloth.geometry.computeVertexNormals(); cloth.geometry.computeBoundingSphere();
      }
    }
    const bag = rig.root.getObjectByName('oracle-park-handbag'); if (bag) { bag.visible = false; if (park) carryOracleBag(rig); }
    drapeSatiSkirt(rig);
    return;
  }
  rig.detail.userData.epiloguePose = true; rig.detail.rotation.set(0, 0, 0); rig.detail.position.set(0, 0, 0);
  if (rig.head.name === 'sati-head') rig.head.position.set(0, 1.99, 0);
  if (gesture.kind === 'reset' && gesture.resetVersion === 2 && gesture.role === 'sati') {
    poseStreetWake(rig, gesture); drapeSatiSkirt(rig, true);
    return;
  }
  const pose = gardenPose(gesture, gesture.role), time = gesture.role === 'architect' && gesture.parkDeparture ? gesture.parkDeparture.elapsed : gesture.total;
  const reset = gesture.kind === 'reset';
  const rising = reset ? gesture.phase === 'ready' ? 0 : gesture.phase === 'waking' ? THREE.MathUtils.smoothstep(gesture.elapsed, 0, 3.2) : 1 : 1;
  const seated = reset ? 0 : pose.seated;
  if (gesture.role === 'oracle' && gesture.phase === 'sitting') {
    const origin = gesture.parkApproach ?? SUNRISE_GARDEN.approach, b = SUNRISE_GARDEN.bench;
    const approach = THREE.MathUtils.smoothstep(gesture.elapsed, 0, 1.05);
    // Plant in front of the seat before lowering and sliding the pelvis back.
    // Keep the saved actor path intact; this is the body offset within its pose.
    const bodyZ = THREE.MathUtils.lerp(THREE.MathUtils.lerp(origin.z, b.z - 1.14, approach), b.z - .14, seated);
    const offset = bodyZ - pose.z;
    rig.detail.position.set(-offset * Math.sin(pose.yaw), 0, offset * Math.cos(pose.yaw));
  }
  const scale = rig.root.scale.x, hip = THREE.MathUtils.lerp(1.995, SUNRISE_GARDEN.bench.surface / scale + .22, seated);
  const stride = Math.sin(time * (gesture.role === 'sati' ? 10 : 7));
  rig.torso.position.set(0, hip, 0); rig.torso.rotation.set(.03 * seated, 0, 0);
  rig.head.rotation.set(-.035 * seated, gesture.role === 'oracle' && ['sati', 'sunrise', 'belief', 'done'].includes(gesture.phase) ? -.28 : 0, 0);
  for (let i = 0; i < 2; i++) {
    const settling = gesture.role === 'oracle' && gesture.phase === 'sitting' ? 1 - THREE.MathUtils.smoothstep(gesture.elapsed, .45, 1.05) : 1;
    const side = i ? 1 : -1, gait = !reset ? pose.walk * stride * side * (1 - seated) * settling : 0;
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
      if (gesture.role === 'oracle') {
        const b = SUNRISE_GARDEN.bench;
        const planted = new THREE.Vector3(b.x - pose.x + (i ? -.24 : .24), .156, b.z - 1.10 - pose.z)
          .applyAxisAngle(new THREE.Vector3(0, 1, 0), -pose.yaw);
        foot.copy(rig.root.localToWorld(planted));
      }
      foot.y = Math.max(foot.y, rig.root.localToWorld(new THREE.Vector3(0, .156, 0)).y);
      reach(rig.hips[i], rig.knees[i], rig.ankles[i].position, foot, new THREE.Vector3(0, 0, 1).applyQuaternion(orientation));
      rig.ankles[i].quaternion.copy(rig.knees[i].getWorldQuaternion(new THREE.Quaternion()).invert().multiply(orientation));
      if (gesture.role !== 'oracle') {
        const palm = new THREE.Vector3(0, -.79, .055);
        const hand = rig.root.localToWorld(new THREE.Vector3((i ? 1 : -1) * .3, hip + .53, .53));
        reach(rig.shoulders[i], rig.elbows[i], palm, rig.elbows[i].localToWorld(palm.clone()).lerp(hand, seated),
          new THREE.Vector3((i ? 1 : -1) * .6, -.7, -.25).applyQuaternion(orientation));
      }
    }
  }
  if (!reset && seated === 0) {
    supportGardenFeet(rig, gesture.parkArrivalVersion === 2);
  }
  if (gesture.role === 'oracle') drapeOracleClothes(rig, gesture, seated);
  drapeSatiSkirt(rig);
  const bag = rig.root.getObjectByName('oracle-park-handbag');
  if (bag) {
    const lift = gesture.phase === 'ready' ? 0 : gesture.phase === 'sitting' ? THREE.MathUtils.smoothstep(gesture.elapsed, .15, 1.05) : 1;
    bag.visible = true; bag.scale.setScalar(1); bag.rotation.set(0, 0, 0);
    bag.position.set(THREE.MathUtils.lerp(-.94, 0, lift), hip + THREE.MathUtils.lerp(-.44, .34, lift), THREE.MathUtils.lerp(.21, .50, lift));
    rig.root.updateWorldMatrix(true, true); const orientation = rig.root.getWorldQuaternion(new THREE.Quaternion());
    for (let i = 0; i < 2; i++) {
      const palm = new THREE.Vector3(0, -.79, .055), side = i ? 1 : -1;
      const hand = bag.localToWorld(new THREE.Vector3(side * .19 * lift, .69 - .036 * lift, .14));
      reach(rig.shoulders[i], rig.elbows[i], palm, rig.elbows[i].localToWorld(palm.clone()).lerp(hand, i ? lift : 1),
        new THREE.Vector3(side * .6, -.7, -.25).applyQuaternion(orientation));
      rig.fingers[i].forEach(finger => { finger.rotation.x = -.38 * (i ? lift : 1); });
    }
  }
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
