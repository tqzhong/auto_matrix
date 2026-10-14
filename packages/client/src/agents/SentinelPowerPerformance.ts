import * as THREE from 'three';
import { FILM_SETS, SENTINEL_POWER, sentinelPowerPose, sentinelSwitchPoint, type SentinelGesture } from '@auto_matrix/shared';
import type { CharacterRig } from './CharacterModel.js';
import { reach } from './SpoonPerformance.js';

/** Crew, moving switches and standby guard share the saved encounter clock. */
export function poseSentinelPower(rig: CharacterRig, state?: SentinelGesture): void {
  if (!state || !rig.hero || !['tank', 'morpheus'].includes(state.role)) return;
  const hero = rig.hero, pose = sentinelPowerPose(state), center = FILM_SETS.film_service_tunnels.center;
  const bodyRotation = rig.root.getWorldQuaternion(new THREE.Quaternion());
  const orientation = bodyRotation.clone().multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), -Math.PI / 2));
  const skin = hero.root.getObjectByName('Anatomical_head_and_hands') as THREE.SkinnedMesh;
  for (const [i, side] of ['R', 'L'].entries()) {
    const amount = state.role === 'tank' ? i ? pose.left : pose.right : i ? 0 : pose.guard;
    if (amount <= 0) continue;
    const bone = (name: string) => hero.bones.get(`${name}_${side}`)!;
    const wrist = bone('wrist'), elbow = bone('elbow'), shoulder = bone('shoulder');
    const fingers: { bone: THREE.Bone; original: THREE.Quaternion; target: THREE.Quaternion }[] = [];
    for (let digit = 1; digit <= 5; digit++) for (let segment = 1; segment <= 3; segment++) {
      const finger = bone(`finger${digit}-${segment}`);
      const original = finger.quaternion.clone();
      finger.rotation.set(0, 0, (i ? -1 : 1) * (state.role === 'tank' && digit !== 2 ? .22 : .035));
      fingers.push({ bone: finger, original, target: finger.quaternion.clone() });
    }
    rig.root.updateMatrixWorld(true);
    const key = `sentinel-${state.role === 'tank' ? 'index' : 'palm'}`;
    let pad = wrist.userData[key] as THREE.Vector3 | undefined;
    if (!pad) {
      pad = new THREE.Vector3(); let count = 0, underside = Infinity;
      const { skinIndex, skinWeight } = skin.geometry.attributes;
      for (let vertex = 0; vertex < skinIndex.count; vertex++) for (let part = 0; part < 4; part++) {
        const index = skinIndex.getComponent(vertex, part), joint = skin.skeleton.bones[index];
        const name = joint.name;
        const contact = name === (state.role === 'tank' ? `finger2-3_${side}` : `wrist_${side}`);
        if ((!contact && !(state.role === 'morpheus' && name.startsWith('finger') && name.endsWith(`_${side}`))) || skinWeight.getComponent(vertex, part) < .95) continue;
        const point = new THREE.Vector3().fromBufferAttribute(skin.geometry.attributes.position, vertex)
          .applyMatrix4(skin.bindMatrix).applyMatrix4(skin.skeleton.boneInverses[index]);
        // Build the contact in the authored wrist frame, independently of
        // the shoulder/elbow pose on whichever frame first loaded the model.
        for (let parent = joint; parent !== wrist; parent = parent.parent as THREE.Bone) point.applyMatrix4(parent.matrix);
        if (contact) { pad.add(point); count++; }
        underside = Math.min(underside, point.z);
      }
      pad.divideScalar(count);
      if (state.role === 'morpheus') pad.z = underside;
      wrist.userData[key] = pad;
    }
    const at = state.role === 'tank' ? sentinelSwitchPoint(state, i ? 'arm' : 'main')
      : { x: SENTINEL_POWER.emp.x, y: SENTINEL_POWER.emp.y + .315, z: SENTINEL_POWER.emp.z };
    const target = new THREE.Vector3(center.x + at.x, center.y - 1 + at.y, center.z + at.z);
    if (state.role === 'tank') target.x += .074 + Math.sin(Math.PI * amount) * .22;
    if (state.role === 'tank' && i) target.y += Math.sin(Math.PI * amount) * .25;
    const originalShoulder = shoulder.quaternion.clone(), originalElbow = elbow.quaternion.clone(), originalWrist = wrist.getWorldQuaternion(new THREE.Quaternion());
    const captain = state.role === 'morpheus';
    const direction = originalWrist.clone().slerp(orientation, captain ? THREE.MathUtils.smoothstep(amount, 0, .4) : amount);
    const offset = pad.clone().multiply(wrist.getWorldScale(new THREE.Vector3())).applyQuaternion(direction);
    if (captain) {
      const start = wrist.localToWorld(pad.clone()), across = THREE.MathUtils.smoothstep(amount, .35, 1);
      // Lift and flatten the palm outside the console before reaching across
      // its guard. Reverse the same saved path when withdrawing.
      target.x = THREE.MathUtils.lerp(start.x, target.x, across);
      target.z = THREE.MathUtils.lerp(start.z, target.z, across);
      target.y = THREE.MathUtils.lerp(start.y, target.y, THREE.MathUtils.smoothstep(amount, 0, .6)) + Math.sin(Math.PI * amount) * .35;
    }
    const goal = target.sub(offset);
    reach(shoulder, elbow, wrist.position, goal, new THREE.Vector3(i ? .8 : -.8, -.45, -.3).applyQuaternion(bodyRotation));
    const blend = captain ? THREE.MathUtils.smoothstep(amount, 0, .25) : amount;
    shoulder.quaternion.copy(originalShoulder.slerp(shoulder.quaternion, blend));
    elbow.quaternion.copy(originalElbow.slerp(elbow.quaternion, blend)); shoulder.updateWorldMatrix(false, true);
    wrist.quaternion.copy(elbow.getWorldQuaternion(new THREE.Quaternion()).invert().multiply(direction));
    fingers.forEach(({ bone, original, target }) => bone.quaternion.copy(original).slerp(target, amount));
    wrist.updateWorldMatrix(false, true);
  }
}
