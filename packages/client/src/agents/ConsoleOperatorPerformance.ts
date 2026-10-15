import * as THREE from 'three';
import { CONSOLE_OPERATOR, FILM_SETS, consoleOperatorPose, type InterludeGesture } from '@auto_matrix/shared';
import type { HeroRig } from './HeroModel.js';
import { reach } from './SpoonPerformance.js';

/** Rebuild chair support and keyboard contact from the saved scene clock. */
export function poseConsoleOperator(rig: HeroRig, gesture?: InterludeGesture): void {
  if (gesture?.kind !== 'console' || gesture.role !== 'cypher') return;
  const pose = consoleOperatorPose(gesture), bone = (name: string) => rig.bones.get(name)!;
  const root = rig.root, pelvis = bone('pelvis'); pelvis.position.y = 1.56; pelvis.position.z = -.23;
  bone('spine').rotation.x = -.22 + .4 * pose.typing;
  bone('chest').rotation.x = -.12 + .26 * pose.typing;
  bone('head').rotation.x = .12 - .16 * pose.typing;
  bone('head').rotation.y += -.45 * pose.glance;
  root.updateWorldMatrix(true, true); root.updateMatrixWorld(true);
  const rotation = root.getWorldQuaternion(new THREE.Quaternion());
  const skin = root.getObjectByName('Anatomical_head_and_hands') as THREE.SkinnedMesh;
  let vertices = skin.userData.consoleKeyPads as Record<string, number[]> | undefined;
  if (!vertices) {
    vertices = { R: [], L: [] }; const attrs = skin.geometry.attributes;
    for (let v = 0; v < attrs.position.count; v++) for (let part = 0; part < 4; part++) {
      const match = /^finger[2-5]-3_([RL])$/.exec(skin.skeleton.bones[attrs.skinIndex.getComponent(v, part)].name);
      if (match && attrs.skinWeight.getComponent(v, part) > .95) vertices[match[1]].push(v);
    }
    skin.userData.consoleKeyPads = vertices;
  }
  for (const side of ['R', 'L'] as const) {
    const sign = side === 'R' ? 1 : -1, hip = bone(`hip_${side}`), knee = bone(`knee_${side}`), ankle = bone(`ankle_${side}`);
    reach(hip, knee, ankle.position, root.localToWorld(new THREE.Vector3(-sign * .45, .25 + rig.footHeight, 1.45)), new THREE.Vector3(-sign * .3, -.2, 1).applyQuaternion(rotation));
    ankle.quaternion.copy(knee.getWorldQuaternion(new THREE.Quaternion()).invert().multiply(rotation)); ankle.updateWorldMatrix(false, true);
    const shoulder = bone(`shoulder_${side}`), elbow = bone(`elbow_${side}`), wrist = bone(`wrist_${side}`);
    for (let digit = 1; digit <= 5; digit++) for (let joint = 1; joint <= 3; joint++)
      bone(`finger${digit}-${joint}_${side}`).rotation.z = sign * (digit === 1 ? joint === 1 ? -.65 : 0
        : [.02, .08, .22, .4][digit - 2] + Math.sin(gesture.elapsed * 12 + digit * 2 + sign) * .015 * pose.typing);
    wrist.updateWorldMatrix(true, true);
    const orientation = rotation.clone().multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), -Math.PI / 2))
      .multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), sign * Math.PI / 2));
    const average = new THREE.Vector3(); let low = Infinity;
    for (const vertex of vertices[side]) {
      const point = wrist.worldToLocal(skin.localToWorld(skin.getVertexPosition(vertex, new THREE.Vector3()))).applyQuaternion(orientation);
      average.add(point); low = Math.min(low, point.y);
    }
    average.divideScalar(vertices[side].length);
    const k = CONSOLE_OPERATOR.keyboard, center = FILM_SETS.film_neb_deck.center;
    const typing = new THREE.Vector3(center.x + k.x - average.x, center.y - 1 + k.y + .038 - low,
      center.z + k.z + sign * .5 - average.z);
    const rest = root.localToWorld(new THREE.Vector3(-sign * .95, 2.35, .22));
    const target = rest.lerp(typing, pose.typing); target.y += Math.sin(Math.PI * pose.typing) * .18;
    reach(shoulder, elbow, wrist.position, target, new THREE.Vector3(-sign * .8, -.7, -.1).applyQuaternion(rotation));
    const forearm = wrist.getWorldPosition(new THREE.Vector3()).sub(elbow.getWorldPosition(new THREE.Vector3())).normalize();
    const straight = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, -1, 0).applyQuaternion(orientation), forearm).multiply(orientation);
    orientation.slerp(straight, 1 - pose.typing);
    wrist.quaternion.copy(elbow.getWorldQuaternion(new THREE.Quaternion()).invert().multiply(orientation)); wrist.updateWorldMatrix(false, true);
  }
}
