import * as THREE from 'three';
import { UPPER_DIGGER, upperDiggerRoot, upperDiggerHatch, upperDiggerFall, type UpperDiggerGesture } from '@auto_matrix/shared';
import type { CharacterRig } from './CharacterModel.js';
import { reach } from './SpoonPerformance.js';

// Four staggered strokes leave three contacts planted; reversing or loading uses the same saved height.
function rungPoint(height: number, hand: boolean, i: number): THREE.Vector3 {
  const rungs = UPPER_DIGGER.rungs;
  const step = height / (rungs.spacing * 2) + (hand ? i ? .75 : .25 : i ? .5 : 0);
  const fraction = step - Math.floor(step), stroke = THREE.MathUtils.smoothstep(fraction, .78, 1);
  const lift = fraction <= .78 ? 0 : Math.sin((fraction - .78) / .22 * Math.PI);
  const index = Math.floor(step) * 2 + (hand ? i ? 5 : 6 : i ? 0 : 1) + stroke * 2;
  const y = rungs.first + Math.min(rungs.count - 1, index) * rungs.spacing;
  return new THREE.Vector3(rungs.x + (hand ? .075 : .13) + lift * .26,
    y + (hand ? 0 : rungs.radius + .155 + lift * .1), UPPER_DIGGER.ladder.z + (i ? 1 : -1) * (hand ? .48 : .32));
}
function localPoint(rig: CharacterRig, gesture: UpperDiggerGesture, point: THREE.Vector3): THREE.Vector3 {
  const root = upperDiggerRoot(gesture, gesture.role);
  point.add(rig.root.getWorldPosition(new THREE.Vector3()).sub(new THREE.Vector3(root.x, root.y, root.z)));
  return rig.root.worldToLocal(point);
}

function posture(gesture: UpperDiggerGesture) {
  const charra = gesture.role === 'charra', hatch = upperDiggerHatch(gesture, gesture.role);
  let ladder = ['approach', 'climbing', 'descending'].includes(gesture.phase) && !(charra && gesture.charraDead) ? 1 : 0;
  if (hatch !== undefined) ladder = 1 - THREE.MathUtils.smoothstep(hatch, gesture.phase === 'dismounting' ? .45 : .1, gesture.phase === 'dismounting' ? 1 : .46);
  const bracing = ['ready', 'bracing', 'shot'].includes(gesture.phase) || gesture.phase === 'failed' && !gesture.charraDead;
  const dead = charra && gesture.charraDead;
  const collapse = charra ? upperDiggerFall(gesture) : 0;
  const lookBack = upperDiggerLookBack(gesture);
  const height = THREE.MathUtils.lerp(THREE.MathUtils.lerp(bracing ? charra ? 1.12 : .9 : .83, 1.72, ladder), .47, collapse) + lookBack * .12;
  const pitch = THREE.MathUtils.lerp(THREE.MathUtils.lerp(bracing ? charra ? 1.12 : .95 : 1.18, .16, ladder), 1.48, collapse) - lookBack * .4;
  const headPitch = THREE.MathUtils.lerp(THREE.MathUtils.lerp(-.58, -.12, ladder), -.05, collapse) + lookBack * .25;
  return { ladder, hatch, bracing, dead, collapse, lookBack, height, pitch, headPitch };
}

export function upperDiggerLookBack(gesture: UpperDiggerGesture): number {
  return gesture.role === 'zee' && gesture.phase === 'attack'
    ? THREE.MathUtils.smoothstep(gesture.elapsed, .45, 1.35) * (1 - THREE.MathUtils.smoothstep(gesture.elapsed, 2.35, UPPER_DIGGER.attack)) : 0;
}

// The camera and body use the same saved posture, including turning on the hatch and looking back.
export function upperDiggerEye(gesture: UpperDiggerGesture): THREE.Vector3 {
  const pose = posture(gesture), root = upperDiggerRoot(gesture, gesture.role);
  return new THREE.Vector3(0, -.012, .24)
    .applyEuler(new THREE.Euler(pose.headPitch, .35 * pose.collapse + 1.45 * pose.lookBack, -.2 * pose.collapse))
    .add(new THREE.Vector3(0, 2.13, 0))
    .applyEuler(new THREE.Euler(pose.pitch, .85 * pose.lookBack, 0, 'YXZ'))
    .add(new THREE.Vector3(0, pose.height, 0)).applyAxisAngle(new THREE.Vector3(0, 1, 0), root.yaw)
    .add(new THREE.Vector3(root.x, root.y, root.z));
}

function hatchContact(rig: CharacterRig, gesture: UpperDiggerGesture, hand: boolean, i: number, t: number): THREE.Vector3 {
  const down = gesture.phase === 'dismounting', side = i ? 1 : -1;
  const point = rungPoint(UPPER_DIGGER.height, hand, i), smooth = THREE.MathUtils.smoothstep;
  if (hand) {
    if (down) {
      point.lerp(new THREE.Vector3(-42.25, 44.18, 28 + side * .48), smooth(t, i ? .8 : .55, i ? 1 : .8));
      return localPoint(rig, gesture, point);
    }
    const rim = new THREE.Vector3(i ? -41.1 : -41.9, 44.18, i ? 27.52 : 28.48);
    point.lerp(rim, smooth(t, i ? .30 : .16, i ? .52 : .42));
    const front = new THREE.Vector3(down ? -42.25 : -39.75, 44.18, 28 + side * (down ? .48 : -.48));
    point.lerp(front, smooth(t, i ? .7 : .5, i ? 1 : .8));
  } else {
    const swing = smooth(t, i ? .48 : .16, i ? .8 : .45), lift = Math.sin(swing * Math.PI) * .32;
    const foot = new THREE.Vector3(down ? -39.95 : -42.05, 44.155, 28 + side * (down ? .32 : -.32));
    if (down) foot.x = THREE.MathUtils.lerp(-41.15, -39.95, smooth(t, .65, 1));
    point.lerp(foot, swing); point.y += lift;
  }
  return localPoint(rig, gesture, point);
}

export function poseUpperDigger(rig: CharacterRig, gesture?: UpperDiggerGesture): void {
  if (!gesture || rig.hero || !rig.diggerProps) return;
  const props = rig.diggerProps, charra = gesture.role === 'charra';
  const { ladder, hatch, bracing, dead, collapse, lookBack, height, pitch, headPitch } = posture(gesture);
  const cycle = (ladder ? gesture.climb : gesture.crawl - gesture.retreat) * Math.PI * 1.5;
  props.group.visible = true; props.gun.visible = charra; props.rounds.visible = false; props.belt.visible = charra;
  rig.detail.position.set(0, 0, 0); rig.detail.rotation.set(0, 0, 0);
  rig.torso.position.set(0, height, 0);
  rig.torso.quaternion.setFromEuler(new THREE.Euler(pitch, .85 * lookBack, 0, 'YXZ'));
  rig.head.rotation.set(headPitch, .35 * collapse + 1.45 * lookBack, -.2 * collapse);
  props.belt.position.set(0, .43, 0).applyEuler(rig.torso.rotation).add(rig.torso.position); props.belt.rotation.copy(rig.torso.rotation);
  props.gun.position.set(-.52, THREE.MathUtils.lerp(bracing ? 1.8 : .72, 2.1, ladder), THREE.MathUtils.lerp(1.1, -.55, ladder));
  props.gun.rotation.set(THREE.MathUtils.lerp(bracing ? .12 : 0, -.8, ladder), 0, .22 * ladder);
  if (dead) { props.gun.position.lerp(new THREE.Vector3(-.6, .45, 1.2), collapse); props.gun.rotation.set(0, -.35 * collapse, Math.PI / 2 * collapse); }
  const rotation = rig.root.getWorldQuaternion(new THREE.Quaternion());
  for (let i = 0; i < 2; i++) {
    const side = i ? 1 : -1, step = Math.sin(cycle + i * Math.PI);
    rig.hips[i].position.set(side * .225, rig.torso.position.y, 0); rig.hips[i].rotation.set(0, 0, 0); rig.knees[i].rotation.set(0, 0, 0);
    const foot = new THREE.Vector3(side * .32, .155, -1.05 + (bracing ? 0 : step * .2 * (1 - collapse)));
    if (ladder) foot.lerp(localPoint(rig, gesture, rungPoint(upperDiggerRoot(gesture, gesture.role).y, false, i)), ladder);
    if (hatch !== undefined && hatch < 1) foot.copy(hatchContact(rig, gesture, false, i, hatch));
    rig.root.updateWorldMatrix(true, true);
    reach(rig.hips[i], rig.knees[i], rig.ankles[i].position, rig.root.localToWorld(foot), new THREE.Vector3(side * .55, .45, .3).applyQuaternion(rotation));
    rig.ankles[i].quaternion.copy(rig.knees[i].getWorldQuaternion(new THREE.Quaternion()).invert().multiply(rotation));
    let hand = new THREE.Vector3(side * .48, .18, 1.25 - step * (bracing ? 0 : .22 * (1 - collapse)));
    if (lookBack) hand.lerp(new THREE.Vector3(side * .6, i ? 1 : .18, i ? -.7 : .6), lookBack);
    if (ladder) hand.lerp(localPoint(rig, gesture, rungPoint(upperDiggerRoot(gesture, gesture.role).y, true, i)), ladder);
    if (hatch !== undefined && hatch < 1) hand.copy(hatchContact(rig, gesture, true, i, hatch));
    rig.root.updateWorldMatrix(true, true);
    if (bracing && !charra) {
      const contact = gesture.contacts?.[i];
      hand = contact ? new THREE.Vector3(contact.x, contact.y, contact.z)
        : rig.root.localToWorld(new THREE.Vector3(side * .23, 1.55, 2.55));
    } else hand = rig.root.localToWorld(hand);
    const grip = charra ? bracing ? 1 : i === 0 && ladder === 0 ? (hatch === undefined ? 1 : THREE.MathUtils.smoothstep(hatch, .8, 1)) * (1 - collapse) : 0 : 0;
    if (grip) hand.lerp(props.gun.localToWorld(new THREE.Vector3(.05, -.31, i ? .85 : -.12)), grip);
    reach(rig.shoulders[i], rig.elbows[i], new THREE.Vector3(0, -.79, .055), hand, new THREE.Vector3(side * .65, -.3, -.25).applyQuaternion(rotation));
    rig.fingers[i].forEach(finger => { finger.rotation.x = ladder || bracing ? -.85 : THREE.MathUtils.lerp(-.28, -.15, collapse); });
  }
  rig.root.updateWorldMatrix(true, true);
}
