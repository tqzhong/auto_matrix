import * as THREE from 'three';
import { smithCraterAmount, smithFinalePose, type SmithFinaleEncounter } from '@auto_matrix/shared';
import type { HeroRig } from './HeroModel.js';
import { reach } from './SpoonPerformance.js';

const surfaces = new WeakMap<HeroRig, { mesh: THREE.Mesh; vertices: number[] }[]>();
const directions = [-1, 0, 1].flatMap(x => [-1, 0, 1].flatMap(y => [-1, 0, 1].map(z => new THREE.Vector3(x, y, z))))
  .filter(v => v.lengthSq() > 0);
const smooth = (n: number) => THREE.MathUtils.smoothstep(n, 0, 1);

function supportSurface(rig: HeroRig) {
  const saved = surfaces.get(rig); if (saved) return saved;
  const parts: { mesh: THREE.Mesh; vertices: number[] }[] = [];
  rig.root.traverse(object => {
    if (!(object instanceof THREE.Mesh) || !object.geometry.attributes.position) return;
    const position = object.geometry.attributes.position;
    if (!(object instanceof THREE.SkinnedMesh)) {
      parts.push({ mesh: object, vertices: Array.from({ length: position.count }, (_, i) => i) }); return;
    }
    // Keep the directional extremities of each deforming body region. The
    // delivered mesh is sampled once; each saved pose then skins this boundary.
    const groups = new Map<string, { values: number[]; indices: number[] }>();
    const { skinIndex, skinWeight } = object.geometry.attributes;
    for (let i = 0; i < position.count; i++) {
      let dominant = 0;
      for (let k = 1; k < 4; k++) if (skinWeight.getComponent(i, k) > skinWeight.getComponent(i, dominant)) dominant = k;
      let name = object.skeleton.bones[skinIndex.getComponent(i, dominant)].name;
      if (name.startsWith('finger')) name = `wrist_${name.endsWith('_R') ? 'R' : 'L'}`;
      let group = groups.get(name);
      if (!group) { group = { values: directions.map(() => -Infinity), indices: directions.map(() => i) }; groups.set(name, group); }
      for (let k = 0; k < directions.length; k++) {
        const d = directions[k], value = position.getX(i) * d.x + position.getY(i) * d.y + position.getZ(i) * d.z;
        if (value > group.values[k]) { group.values[k] = value; group.indices[k] = i; }
      }
    }
    parts.push({ mesh: object, vertices: [...new Set([...groups.values()].flatMap(group => group.indices))] });
  });
  surfaces.set(rig, parts); return parts;
}

/** Rest on the delivered back/coat, then roll up through folded legs to standing. */
export function poseSmithCraterBody(rig: HeroRig, encounter: SmithFinaleEncounter, neo: boolean): void {
  const amount = smithCraterAmount(encounter);
  if (amount <= 0) return;
  const pose = smithFinalePose(encounter), pelvis = rig.bones.get('pelvis')!;
  if (neo && (encounter.phase === 'descent' || encounter.phase === 'crater' || encounter.phase === 'failed')) {
    const rise = pose.rise, fold = Math.sin(rise * Math.PI), blend = (encounter.phase === 'descent' ? amount : 1) * (1 - smooth((rise - .8) / .2));
    const turn = smooth(rise / .65), target = new THREE.Quaternion();
    const rotate = (name: string, x: number, y = 0, z = 0) => {
      const joint = rig.bones.get(name)!;
      target.setFromEuler(new THREE.Euler(x, y, z)); joint.quaternion.slerp(target, blend);
    };
    pelvis.position.lerp(rig.rest.get('pelvis')!, blend);
    rotate('pelvis', -Math.PI / 2 * (1 - turn));
    rotate('spine', fold * .28); rotate('chest', fold * .24); rotate('head', -.25 * fold);
    for (const [i, side] of ['R', 'L'].entries()) {
      rotate(`hip_${side}`, -(i ? 1.8 : 1.3) * fold);
      rotate(`knee_${side}`, (i ? 2.3 : 1.9) * fold + .08 * (1 - rise));
      rotate(`ankle_${side}`, -.55 * fold);
      rotate(`shoulder_${side}`, -.12 - fold * (i ? .9 : .45), 0, (i ? 1 : -1) * .88 * (1 - rise));
      rotate(`elbow_${side}`, -.12 - .55 * fold); rotate(`wrist_${side}`, 0);
    }
  }
  rig.root.updateWorldMatrix(true, true);
  const inverse = rig.root.matrixWorld.clone().invert(), point = new THREE.Vector3(); let lowest = Infinity;
  for (const { mesh, vertices } of supportSurface(rig)) {
    if (!mesh.visible) continue;
    mesh.updateMatrixWorld(true);
    if (mesh instanceof THREE.SkinnedMesh) mesh.skeleton.update();
    const transform = inverse.clone().multiply(mesh.matrixWorld);
    for (const index of vertices) lowest = Math.min(lowest, mesh.getVertexPosition(index, point).applyMatrix4(transform).y);
  }
  if (Number.isFinite(lowest)) pelvis.position.y += .008 - lowest;
  rig.root.updateWorldMatrix(true, true);
  if (neo && ['descent', 'crater', 'failed'].includes(encounter.phase)) {
    const rotation = rig.root.getWorldQuaternion(new THREE.Quaternion());
    // The coat supporting the seated pelvis is not a planted foot. Bring each
    // boot down in turn before the arms release and the legs straighten.
    for (const [i, side] of ['R', 'L'].entries()) {
      const plant = smooth((pose.rise - (i ? .18 : .04)) / (i ? .4 : .26)) * (1 - smooth((pose.rise - .9) / .1));
      if (plant <= 0) continue;
      const hip = rig.bones.get(`hip_${side}`)!, knee = rig.bones.get(`knee_${side}`)!, ankle = rig.bones.get(`ankle_${side}`)!;
      const target = rig.root.worldToLocal(ankle.getWorldPosition(new THREE.Vector3()));
      target.y = THREE.MathUtils.lerp(target.y, rig.footHeight + .013, plant);
      const orientation = ankle.getWorldQuaternion(new THREE.Quaternion()).slerp(rotation, plant);
      reach(hip, knee, ankle.position, rig.root.localToWorld(target), new THREE.Vector3(i ? .15 : -.15, .1, 1).applyQuaternion(rotation));
      ankle.quaternion.copy(knee.getWorldQuaternion(new THREE.Quaternion()).invert().multiply(orientation));
      ankle.updateWorldMatrix(false, true);
    }
    const contact = amount * (1 - smooth((pose.rise - .15) / .4));
    if (contact <= 0) return;
    const rootRotation = rig.root.getWorldQuaternion(new THREE.Quaternion());
    for (const [i, side] of ['R', 'L'].entries()) {
      const sign = i ? 1 : -1, shoulder = rig.bones.get(`shoulder_${side}`)!, elbow = rig.bones.get(`elbow_${side}`)!, wrist = rig.bones.get(`wrist_${side}`)!;
      const palm = new THREE.Vector3(i ? -.09 : .09, -.18, .02);
      const orientation = wrist.getWorldQuaternion(new THREE.Quaternion()).slerp(rootRotation.clone()
        .multiply(new THREE.Quaternion().setFromEuler(new THREE.Euler(-Math.PI / 2, 0, sign * 1.1))), contact);
      const target = wrist.localToWorld(palm.clone()).lerp(rig.root.localToWorld(new THREE.Vector3(sign * 1.3, .16, -.5)), contact)
        .sub(palm.applyQuaternion(orientation));
      const shoulderBase = shoulder.quaternion.clone(), elbowBase = elbow.quaternion.clone();
      reach(shoulder, elbow, wrist.position, target, new THREE.Vector3(sign, -.3, -.2).applyQuaternion(rootRotation));
      shoulder.quaternion.copy(shoulderBase.slerp(shoulder.quaternion, contact));
      elbow.quaternion.copy(elbowBase.slerp(elbow.quaternion, contact)); shoulder.updateWorldMatrix(false, true);
      wrist.quaternion.copy(elbow.getWorldQuaternion(new THREE.Quaternion()).invert().multiply(orientation));
      for (let finger = 1; finger <= 5; finger++) for (let segment = 1; segment <= 3; segment++) {
        const joint = rig.bones.get(`finger${finger}-${segment}_${side}`)!;
        joint.rotation.z = THREE.MathUtils.lerp(joint.rotation.z, .06, contact);
      }
      wrist.updateWorldMatrix(false, true);
    }
  }
}
