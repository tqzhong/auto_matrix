import * as THREE from 'three';
import { mobilRefusalPose } from '@auto_matrix/shared';
import type { CharacterRig } from './CharacterModel.js';
import type { MotionInput } from './CharacterMotion.js';
import { groundCharacter } from './GroundContact.js';
import { reach } from './SpoonPerformance.js';

/** The real skeleton follows the stored strike, wall impact, floor contact and recovery. */
export function poseMobilRefusal(rig: CharacterRig, gesture?: MotionInput['mobilRefusal']): void {
  if (!gesture) return;
  const pose = mobilRefusalPose(gesture.elapsed);
  if (gesture.role === 'trainman') {
    rig.torso.rotation.set(0, -.12 * pose.punch, 0);
    rig.head.rotation.set(0, .12 * pose.punch, 0);
    rig.shoulders[0].rotation.set(-1.45 * pose.punch, 0, -.14);
    rig.elbows[0].rotation.set(-.65 * (1 - pose.punch), 0, 0);
    for (const finger of rig.fingers[0]) finger.rotation.x = -1.15;
    return;
  }
  if (!rig.hero) return;
  const hero = rig.hero, bone = (name: string) => hero.bones.get(name)!;
  for (const [name, joint] of hero.bones) { joint.position.copy(hero.rest.get(name)!); joint.rotation.set(0, 0, 0); }
  bone('pelvis').rotation.x = pose.tilt;
  bone('head').rotation.x = .12 * pose.fall * (1 - pose.rise);
  const airborne = pose.flight * (1 - pose.fall);
  for (const side of ['R', 'L']) {
    bone(`hip_${side}`).rotation.x = -1.15 * airborne - .3 * pose.down;
    bone(`knee_${side}`).rotation.x = .28 * airborne + .45 * pose.down;
    bone(`ankle_${side}`).rotation.x = -.18 * airborne - .15 * pose.down;
    bone(`shoulder_${side}`).rotation.set(-.55 * airborne + .16 * pose.down, 0,
      (side === 'R' ? -1 : 1) * (.14 + .35 * airborne + .18 * pose.down));
    bone(`elbow_${side}`).rotation.x = -.55 * airborne + .12 * pose.down;
  }
  groundCharacter(rig, pose.fall === 1 ? 1 : 0);
  rig.root.updateWorldMatrix(true, true);
}

export function contactMobilStrike(trainman: CharacterRig, neo: CharacterRig, elapsed: number): void {
  const punch = mobilRefusalPose(elapsed).punch;
  if (punch <= 0 || elapsed > .7) return;
  const chest = neo.hero?.bones.get('chest') ?? neo.torso;
  neo.root.updateWorldMatrix(true, true); trainman.root.updateWorldMatrix(true, true);
  const target = chest.localToWorld(new THREE.Vector3(0, .05, .24));
  const palm = new THREE.Vector3(0, -.79, .055), elbow = trainman.elbows[0];
  reach(trainman.shoulders[0], elbow, palm, elbow.localToWorld(palm.clone()).lerp(target, punch),
    new THREE.Vector3(0, -.7, -.7));
}
