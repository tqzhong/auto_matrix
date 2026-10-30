import * as THREE from 'three';
import { ORACLE_VISIT, oracleVisitPose, oracleVisitRoot, type OracleVisitGesture } from '@auto_matrix/shared';
import type { CharacterRig } from './CharacterModel.js';
import { connectGardenWrists } from './OracleParkHands.js';
import { reach } from './SpoonPerformance.js';

function headSurface(neo: CharacterRig): THREE.Triangle[] | undefined {
  const hero = neo.hero, head = hero?.bones.get('head'); if (!hero || !head) return;
  const cached = head.userData.oracleExaminationSurface as THREE.Triangle[] | undefined;
  if (cached) return cached;
  const mesh = hero.root.getObjectByName('Anatomical_head_and_hands') as THREE.SkinnedMesh;
  const { position, skinIndex, skinWeight } = mesh.geometry.attributes, index = mesh.geometry.index!;
  const bone = mesh.skeleton.bones.indexOf(head), vertices = new Map<number, THREE.Vector3>();
  for (let v = 0; v < position.count; v++) {
    let weight = 0; for (let j = 0; j < 4; j++) if (skinIndex.getComponent(v, j) === bone) weight += skinWeight.getComponent(v, j);
    if (weight > .999) vertices.set(v, new THREE.Vector3().fromBufferAttribute(position, v).applyMatrix4(mesh.bindMatrix).applyMatrix4(mesh.skeleton.boneInverses[bone]));
  }
  const triangles: THREE.Triangle[] = [];
  for (let i = 0; i < index.count; i += 3) {
    const a = vertices.get(index.getX(i)), b = vertices.get(index.getX(i + 1)), c = vertices.get(index.getX(i + 2));
    if (a && b && c) triangles.push(new THREE.Triangle(a, b, c));
  }
  head.userData.oracleExaminationSurface = triangles; return triangles;
}

const surfaceCells = new WeakMap<THREE.Triangle[], Map<string, THREE.Triangle[]>>();

function sideSurface(triangles: THREE.Triangle[], side: number, y: number, z: number): THREE.Vector3 | undefined {
  let cells = surfaceCells.get(triangles);
  if (!cells) {
    cells = new Map();
    for (const triangle of triangles) {
      const lowY = Math.floor(Math.min(triangle.a.y, triangle.b.y, triangle.c.y) / .02), highY = Math.floor(Math.max(triangle.a.y, triangle.b.y, triangle.c.y) / .02);
      const lowZ = Math.floor(Math.min(triangle.a.z, triangle.b.z, triangle.c.z) / .02), highZ = Math.floor(Math.max(triangle.a.z, triangle.b.z, triangle.c.z) / .02);
      for (let row = lowY; row <= highY; row++) for (let column = lowZ; column <= highZ; column++) {
        const key = `${row}:${column}`; if (!cells.has(key)) cells.set(key, []); cells.get(key)!.push(triangle);
      }
    }
    surfaceCells.set(triangles, cells);
  }
  const ray = new THREE.Ray(new THREE.Vector3(side, y, z), new THREE.Vector3(-side, 0, 0));
  let distance = Infinity, point: THREE.Vector3 | undefined;
  for (const triangle of cells.get(`${Math.floor(y / .02)}:${Math.floor(z / .02)}`) ?? []) {
    if (y < Math.min(triangle.a.y, triangle.b.y, triangle.c.y) || y > Math.max(triangle.a.y, triangle.b.y, triangle.c.y)
      || z < Math.min(triangle.a.z, triangle.b.z, triangle.c.z) || z > Math.max(triangle.a.z, triangle.b.z, triangle.c.z)) continue;
    const hit = ray.intersectTriangle(triangle.a, triangle.b, triangle.c, false, new THREE.Vector3());
    if (hit && hit.distanceTo(ray.origin) < distance) { distance = hit.distanceTo(ray.origin); point = hit; }
  }
  return point;
}

/** Saved-time foot placements keep the approach a walk rather than a sliding body. */
function placeFeet(rig: CharacterRig, gesture: OracleVisitGesture): void {
  if (gesture.phase !== 'examining' || gesture.elapsed > 6.9) return;
  const elapsed = gesture.elapsed, returning = elapsed >= 5.4, time = returning ? elapsed - 5.4 : elapsed - .3;
  const travel = oracleVisitRoot(gesture, 'oracle').x - ORACLE_VISIT.oracle.x;
  const rotation = rig.root.getWorldQuaternion(new THREE.Quaternion());
  const targets = rig.ankles.map((ankle, i) => {
    const phase = THREE.MathUtils.clamp((time - i * .75) / .75, 0, 1), step = THREE.MathUtils.smoothstep(phase, 0, 1);
    const forward = 1.3 * (returning ? 1 - step : step) - travel;
    return rig.root.localToWorld(new THREE.Vector3(rig.hips[i].position.x, .16 + Math.sin(phase * Math.PI) * .13, forward));
  });
  const drop = Math.max(0, ...targets.map((point, i) => {
    const hip = rig.hips[i].getWorldPosition(new THREE.Vector3());
    const length = rig.knees[i].position.length() + rig.ankles[i].position.length() - .005;
    return hip.y - point.y - Math.sqrt(Math.max(0, length * length - (hip.x - point.x) ** 2 - (hip.z - point.z) ** 2));
  }));
  rig.torso.position.y -= drop; rig.hips.forEach(hip => { hip.position.y -= drop; });
  rig.root.updateWorldMatrix(true, true);
  for (let i = 0; i < 2; i++) {
    const ankle = rig.ankles[i], knee = rig.knees[i], hip = rig.hips[i];
    reach(hip, knee, ankle.position, targets[i], new THREE.Vector3(0, 0, 1).applyQuaternion(rotation));
    ankle.quaternion.copy(knee.getWorldQuaternion(new THREE.Quaternion()).invert().multiply(rotation));
  }
}

/** Both actors have already received their base poses before these contacts run. */
export function poseOracleExamination(oracle: CharacterRig, neo: CharacterRig, gesture: OracleVisitGesture): void {
  oracle.root.updateWorldMatrix(true, true); neo.root.updateWorldMatrix(true, true);
  placeFeet(oracle, gesture);
  const amount = oracleVisitPose(gesture).inspect, head = neo.hero?.bones.get('head'), surface = headSurface(neo);
  if (amount === 0 || !head || !surface || !oracle.parkHands?.every(hand => hand.root.visible)) return;
  for (const [i, hand] of oracle.parkHands.entries()) {
    const sign = i ? -1 : 1, mesh = hand.skin;
    let palm = hand.wrist.userData.examinationPalm as THREE.Vector3 | undefined;
    if (!palm) {
      const ray = new THREE.Ray(new THREE.Vector3(sign, -.135, .015), new THREE.Vector3(-sign, 0, 0));
      const position = mesh.geometry.attributes.position, index = mesh.geometry.index!;
      let distance = Infinity;
      for (let v = 0; v < index.count; v += 3) {
        const vertices = [0, 1, 2].map(j => new THREE.Vector3().fromBufferAttribute(position, index.getX(v + j)));
        const hit = ray.intersectTriangle(vertices[0], vertices[1], vertices[2], false, new THREE.Vector3());
        if (hit && hit.distanceTo(ray.origin) < distance) { distance = hit.distanceTo(ray.origin); palm = hit; }
      }
      hand.wrist.userData.examinationPalm = palm;
    }
    if (!palm) continue;
    let fit = hand.wrist.userData.oracleExaminationFit as { source: string; cheek: THREE.Vector3; rotation: THREE.Quaternion; fingers: THREE.Quaternion[][]; samples: THREE.Vector3[] } | undefined;
    if (!fit || fit.source !== head.uuid) {
      const samples: THREE.Vector3[] = [];
      const sample = (y: number, z: number) => { const hit = sideSurface(surface, sign, y, z); if (hit) samples.push(hit.clone()); return hit; };
      const cheek = sample(-.09, .11), above = sample(-.04, .11), below = sample(-.14, .11);
      if (!cheek || !above || !below) continue;
      cheek.x += sign * .008;
      const localRotation = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), Math.PI - Math.atan((above.x - below.x) / .1));
      // Fit complete chains around the actual cheek/temple contour once per
      // delivered head. A missing surface cannot become a fictitious origin target.
      const origin = cheek.clone().sub(palm.clone().applyQuaternion(localRotation));
      const fingers: THREE.Quaternion[][] = [];
      const clearance = [0, 0, 0, 0, 0], previous = hand.bones.map(chain => chain.map(bone => bone.quaternion.clone()));
      const digitByBone = mesh.skeleton.bones.map(bone => hand.bones.findIndex(chain => chain.includes(bone)));
      for (let pass = 0; pass < 4; pass++) {
        fingers.length = 0; samples.length = 3;
        for (const [digit, chain] of hand.bones.entries()) {
          const base = chain[0].position, first = chain[1].position, second = chain[2].position, pad = hand.pads[digit];
          const guess = base.clone().add(new THREE.Vector3(0, -(first.length() + second.length() + pad.length()) * .88, 0))
            .applyQuaternion(localRotation).add(origin);
          const contact = sample(guess.y, guess.z), lower = sample(guess.y - .05, guess.z);
          if (!contact || !lower) break;
          const direction = contact.clone().sub(lower).normalize().applyQuaternion(localRotation.clone().invert());
          const end = contact.add(new THREE.Vector3(sign * (.026 + clearance[digit]), 0, 0)).sub(origin).applyQuaternion(localRotation.clone().invert());
          end.addScaledVector(direction, -pad.length());
          const axis = end.clone().sub(base), a = first.length(), b = second.length(), distance = THREE.MathUtils.clamp(axis.length(), .001, a + b - .001);
          axis.normalize(); end.copy(base).addScaledVector(axis, distance);
          const along = (a * a - b * b + distance * distance) / (2 * distance);
          const bend = new THREE.Vector3(-sign, 0, 0); bend.addScaledVector(axis, -bend.dot(axis)).normalize();
          const hinge = base.clone().addScaledVector(axis, along).addScaledVector(bend, Math.sqrt(Math.max(0, a * a - along * along))), parent = new THREE.Quaternion();
          fingers.push([hinge.clone().sub(base), end.clone().sub(hinge), direction].map((desired, joint) => {
            const rotation = new THREE.Quaternion().setFromUnitVectors([first, second, pad][joint].clone().normalize(), desired.normalize());
            const local = parent.clone().invert().multiply(rotation); parent.copy(rotation); return local;
          }));
        }
        if (fingers.length !== 5) break;
        // A pad-centre target alone misses skin on the sloping sides of a
        // refined cheek. Fit the delivered finger surface, once per head.
        hand.bones.forEach((chain, digit) => chain.forEach((bone, joint) => bone.quaternion.copy(fingers[digit][joint])));
        hand.wrist.updateMatrixWorld(true); mesh.skeleton.update();
        // Skin in wrist space. Blending world-space translations with rounded
        // weights otherwise makes this cached fit depend on the first frame.
        const inverse = hand.wrist.matrixWorld.clone().invert(), correction = [0, 0, 0, 0, 0];
        const transforms = mesh.skeleton.bones.map((bone, index) => inverse.clone().multiply(bone.matrixWorld)
          .multiply(mesh.skeleton.boneInverses[index]).multiply(mesh.bindMatrix));
        const { position, skinIndex, skinWeight } = mesh.geometry.attributes;
        for (let v = 0; v < position.count; v++) {
          let digit = -1, weight = 0;
          for (let j = 0; j < 4; j++) if (digitByBone[skinIndex.getComponent(v, j)] >= 0 && skinWeight.getComponent(v, j) > weight) {
            digit = digitByBone[skinIndex.getComponent(v, j)]; weight = skinWeight.getComponent(v, j);
          }
          if (digit < 0 || weight < .2) continue;
          const rest = new THREE.Vector3().fromBufferAttribute(position, v), point = new THREE.Vector3();
          for (let j = 0; j < 4; j++) if (skinWeight.getComponent(v, j) > 0) {
            point.addScaledVector(rest.clone().applyMatrix4(transforms[skinIndex.getComponent(v, j)]), skinWeight.getComponent(v, j));
          }
          point.applyQuaternion(localRotation).add(origin);
          const contact = sideSurface(surface, sign, point.y, point.z);
          if (contact) correction[digit] = Math.max(correction[digit], sign * (contact.x - point.x) + .001);
        }
        if (correction.every(value => value < .0001)) break;
        correction.forEach((value, digit) => { clearance[digit] += value; });
      }
      hand.bones.forEach((chain, digit) => chain.forEach((bone, joint) => bone.quaternion.copy(previous[digit][joint])));
      if (fingers.length !== 5) continue;
      fit = { source: head.uuid, cheek, rotation: localRotation, fingers, samples };
      hand.wrist.userData.oracleExaminationFit = fit;
    }
    const cheek = fit.cheek, localRotation = fit.rotation, target = head.localToWorld(cheek.clone());
    const orientation = head.getWorldQuaternion(new THREE.Quaternion()).multiply(localRotation);
    const current = hand.wrist.getWorldQuaternion(new THREE.Quaternion());
    const wristRotation = current.slerp(orientation, amount);
    const point = hand.wrist.localToWorld(palm.clone()).lerp(target, amount)
      .add(new THREE.Vector3(sign * Math.sin(amount * Math.PI) * .12, 0, 0).applyQuaternion(head.getWorldQuaternion(new THREE.Quaternion())))
      .sub(palm.clone().multiply(hand.wrist.getWorldScale(new THREE.Vector3())).applyQuaternion(wristRotation));
    const shoulder = oracle.shoulders[i].quaternion.clone(), elbow = oracle.elbows[i].quaternion.clone();
    reach(oracle.shoulders[i], oracle.elbows[i], hand.wrist.position, point,
      new THREE.Vector3(i ? .5 : -.5, -.7, .25).applyQuaternion(oracle.root.getWorldQuaternion(new THREE.Quaternion())));
    oracle.shoulders[i].quaternion.slerpQuaternions(shoulder, oracle.shoulders[i].quaternion.clone(), amount);
    oracle.elbows[i].quaternion.slerpQuaternions(elbow, oracle.elbows[i].quaternion.clone(), amount);
    oracle.elbows[i].updateWorldMatrix(true, true);
    hand.wrist.quaternion.copy(oracle.elbows[i].getWorldQuaternion(new THREE.Quaternion()).invert().multiply(wristRotation));
    hand.bones.forEach((chain, digit) => chain.forEach((bone, joint) => bone.quaternion.identity().slerp(fit!.fingers[digit][joint], amount)));
    hand.wrist.updateWorldMatrix(false, true);
  }
  connectGardenWrists(oracle);
}
