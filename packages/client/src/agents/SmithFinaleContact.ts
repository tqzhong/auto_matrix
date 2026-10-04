import * as THREE from 'three';
import { smithFinalePose, smithEndingPose, type SmithFinaleEncounter } from '@auto_matrix/shared';
import type { HeroRig } from './HeroModel.js';
import { reach } from './SpoonPerformance.js';
import { poseSmithCraterBody } from './SmithCraterPerformance.js';

export function poseSmithFinaleContact(neo: HeroRig, smith: HeroRig, encounter: SmithFinaleEncounter): void {
  poseSmithCraterBody(neo, encounter, true); poseSmithCraterBody(smith, encounter, false);
  const ending = smithEndingPose(encounter);
  if (ending.contact > 0) poseChestContact(smith, neo, ending.contact);
  if (ending.shield > 0) poseLightShield(smith, ending.shield);
  if (encounter.phase !== 'ground_counter' && encounter.phase !== 'shockwave') return;
  const blend = smithFinalePose(encounter).strike;
  if (blend < .00001) return;
  const side = encounter.hits % 2 ? 'R' : 'L', sign = side === 'R' ? 1 : -1;
  neo.root.updateWorldMatrix(true, true); smith.root.updateWorldMatrix(true, true);
  const chest = smith.bones.get('chest')!;
  // The delivered suit front is z=.46212/.46136 here; leave .01 outside its surface.
  const contact = chest.localToWorld(new THREE.Vector3(sign * .2, .15, side === 'R' ? .4722 : .4714));
  const shoulder = neo.bones.get(`shoulder_${side}`)!, elbow = neo.bones.get(`elbow_${side}`)!, wrist = neo.bones.get(`wrist_${side}`)!;
  const shoulderBase = shoulder.quaternion.clone(), elbowBase = elbow.quaternion.clone();
  const rotation = neo.root.getWorldQuaternion(new THREE.Quaternion());
  const orientation = wrist.getWorldQuaternion(new THREE.Quaternion()).slerp(rotation.clone()
    .multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), -Math.PI / 2)), blend);
  // Skin samples of the closed knuckles extend .32452 from the wrist along -Y.
  const knuckles = new THREE.Vector3(sign * .08182, -.326, 0);
  const target = wrist.localToWorld(knuckles.clone()).lerp(contact, blend).sub(knuckles.applyQuaternion(orientation));
  reach(shoulder, elbow, wrist.position, target, new THREE.Vector3(-sign, -.4, .2).applyQuaternion(rotation));
  shoulder.quaternion.copy(shoulderBase.slerp(shoulder.quaternion, blend));
  elbow.quaternion.copy(elbowBase.slerp(elbow.quaternion, blend));
  shoulder.updateWorldMatrix(false, true);
  wrist.quaternion.copy(elbow.getWorldQuaternion(new THREE.Quaternion()).invert().multiply(orientation));
  wrist.updateWorldMatrix(false, true);
}

const chestSurfaces = new WeakMap<HeroRig, THREE.Vector3>();

/** Use the delivered coat front, not an invisible helper sphere. */
function chestSurface(rig: HeroRig): THREE.Vector3 {
  const saved = chestSurfaces.get(rig); if (saved) return saved;
  const bone = rig.bones.get('chest')!, mesh = rig.root.getObjectByName('Tailored_coat_upper') as THREE.SkinnedMesh;
  mesh.skeleton.update();
  const index = mesh.geometry.index!, positions = mesh.geometry.attributes.position, points: THREE.Vector3[] = [];
  for (let i = 0; i < positions.count; i++) points.push(bone.worldToLocal(mesh.localToWorld(mesh.getVertexPosition(i, new THREE.Vector3()))));
  const ray = new THREE.Ray(new THREE.Vector3(-.18, .12, 2), new THREE.Vector3(0, 0, -1));
  const hit = new THREE.Vector3(), surface = new THREE.Vector3(-.18, .12, .4);
  for (let i = 0; i < index.count; i += 3) if (ray.intersectTriangle(points[index.getX(i)], points[index.getX(i + 1)], points[index.getX(i + 2)], false, hit)
    && hit.z > surface.z) surface.copy(hit);
  surface.z += .012; chestSurfaces.set(rig, surface); return surface;
}

function poseChestContact(smith: HeroRig, neo: HeroRig, blend: number): void {
  smith.bones.get('spine')!.rotation.x += .5 * blend;
  smith.bones.get('chest')!.rotation.x += .2 * blend;
  smith.bones.get('head')!.rotation.x -= .35 * blend;
  smith.root.updateWorldMatrix(true, true);
  const shoulder = smith.bones.get('shoulder_R')!, elbow = smith.bones.get('elbow_R')!, wrist = smith.bones.get('wrist_R')!;
  const rotation = smith.root.getWorldQuaternion(new THREE.Quaternion());
  const orientation = wrist.getWorldQuaternion(new THREE.Quaternion()).slerp(rotation.clone()
    .multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), -Math.PI / 2)), blend);
  const knuckles = new THREE.Vector3(.08182, -.326, 0);
  const contact = neo.bones.get('chest')!.localToWorld(chestSurface(neo).clone());
  const target = wrist.localToWorld(knuckles.clone()).lerp(contact, blend).sub(knuckles.applyQuaternion(orientation));
  reach(shoulder, elbow, wrist.position, target, new THREE.Vector3(-1, -.4, .2).applyQuaternion(rotation));
  wrist.quaternion.copy(elbow.getWorldQuaternion(new THREE.Quaternion()).invert().multiply(orientation));
  for (let finger = 1; finger <= 5; finger++) for (let segment = 1; segment <= 3; segment++) {
    const bone = smith.bones.get(`finger${finger}-${segment}_R`)!;
    bone.rotation.x = THREE.MathUtils.lerp(bone.rotation.x, finger === 1 ? 1.05 * (segment === 1 ? .8 : .65) : 0, blend);
    bone.rotation.z = THREE.MathUtils.lerp(bone.rotation.z, 1.05 * (finger === 1 ? .2 : segment === 1 ? .85 : 1.1), blend);
  }
  wrist.updateWorldMatrix(false, true);
}

function poseLightShield(smith: HeroRig, blend: number): void {
  const head = smith.bones.get('head')!;
  head.rotation.y -= .28 * blend; head.rotation.x += .14 * blend;
  smith.root.updateWorldMatrix(true, true);
  const shoulder = smith.bones.get('shoulder_R')!, elbow = smith.bones.get('elbow_R')!, wrist = smith.bones.get('wrist_R')!;
  const rotation = smith.root.getWorldQuaternion(new THREE.Quaternion());
  const orientation = wrist.getWorldQuaternion(new THREE.Quaternion()).slerp(rotation.clone()
    .multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), Math.PI)), blend);
  const palm = new THREE.Vector3(.08, -.14, 0);
  const target = wrist.localToWorld(palm.clone()).lerp(head.localToWorld(new THREE.Vector3(-.42, .06, .67)), blend)
    .sub(palm.applyQuaternion(orientation));
  reach(shoulder, elbow, wrist.position, target, new THREE.Vector3(-.8, -.6, .1).applyQuaternion(rotation));
  wrist.quaternion.copy(elbow.getWorldQuaternion(new THREE.Quaternion()).invert().multiply(orientation));
  for (let finger = 1; finger <= 5; finger++) for (let segment = 1; segment <= 3; segment++) {
    const bone = smith.bones.get(`finger${finger}-${segment}_R`)!;
    bone.rotation.x = THREE.MathUtils.lerp(bone.rotation.x, finger === 1 ? .15 : 0, blend);
    bone.rotation.z = THREE.MathUtils.lerp(bone.rotation.z, finger === 1 ? .12 : 0, blend);
  }
  wrist.updateWorldMatrix(false, true);
}
