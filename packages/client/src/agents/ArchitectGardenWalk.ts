import * as THREE from 'three';
import { gardenPose, gardenDeparturePose, type TrilogyEpilogueGesture } from '@auto_matrix/shared';
import type { CharacterRig } from './CharacterModel.js';
import { architectWalkPose, ARCHITECT_WALK_CYCLE } from './CharacterMotion.js';

type Waypoint = { time: number; distance: number; x: number; z: number; yaw: number };
const tracks = new WeakMap<CharacterRig, { key: string; points: Waypoint[]; landings: number[] }>();
const eased = (value: number) => { const t = THREE.MathUtils.clamp(value, 0, 1); return t * t * (3 - 2 * t); };
const angle = (from: number, to: number) => Math.atan2(Math.sin(to - from), Math.cos(to - from));

/** Saved route distance determines footsteps, including in-place turns and the final stop. */
export function poseArchitectGardenWalk(rig: CharacterRig, gesture: TrilogyEpilogueGesture): void {
  const departure = gesture.parkDeparture, leaving = !departure && ['leaving', 'promise', 'sati', 'sunrise', 'belief', 'done'].includes(gesture.phase);
  const key = departure ? JSON.stringify(departure.origin) : leaving ? 'legacy-departure' : 'arrival';
  let track = tracks.get(rig);
  if (!track || track.key !== key) {
    const seconds = departure ? gardenDeparturePose(departure).seconds : leaving ? 4.8 : 3.8;
    const points: Waypoint[] = [];
    for (let frame = 0; frame <= Math.ceil(seconds * 60); frame++) {
      const time = Math.min(seconds, frame / 60);
      const p = gardenPose(departure ? { ...gesture, parkDeparture: { ...departure, elapsed: time } }
        : { ...gesture, phase: leaving ? 'leaving' : 'architect', elapsed: time }, 'architect');
      const previous = points.at(-1);
      points.push({ time, x: p.x, z: p.z, yaw: p.yaw, distance: previous ? previous.distance
        + Math.hypot(p.x - previous.x, p.z - previous.z) + 1.2 * Math.abs(angle(previous.yaw, p.yaw)) : 0 });
    }
    const end = points.at(-1)!, before = points.at(-2)!, total = end.distance;
    let count = Math.max(2, Math.ceil(total / 1.2));
    const lateral = Math.cos(end.yaw) * (end.x - before.x) - Math.sin(end.yaw) * (end.z - before.z);
    // Finish a sideways approach with the trailing foot, so the leading
    // foot can plant beyond the body before the other closes the stance.
    if (Math.abs(lateral) > Math.hypot(end.x - before.x, end.z - before.z) * 1e-6
      && (count - 1) % 2 !== (lateral > 0 ? 0 : 1)) count++;
    const landings = Array.from({ length: count }, (_, step) => step === count - 1 ? total
      : (total - Math.min(.55, total / 2)) * (.65 + step * 1.2) / (.65 + (count - 2) * 1.2));
    track = { key, points, landings }; tracks.set(rig, track);
  }
  const { points, landings } = track, total = points.at(-1)!.distance;
  const seconds = points.at(-1)!.time;
  const clock = departure ? departure.elapsed : gesture.phase === (leaving ? 'leaving' : 'architect') ? gesture.elapsed
    : !leaving && ['ready', 'sitting', 'cat'].includes(gesture.phase) ? 0 : seconds;
  const time = THREE.MathUtils.clamp(clock, 0, seconds), index = Math.min(Math.floor(time * 60), points.length - 2);
  const first = points[index], second = points[index + 1], ratio = (time - first.time) / (second.time - first.time);
  const distance = THREE.MathUtils.lerp(first.distance, second.distance, ratio);
  const at = (travel: number) => {
    const target = THREE.MathUtils.clamp(travel, 0, total);
    let low = 0, high = points.length - 1;
    while (high - low > 1) { const middle = (low + high) >> 1; if (points[middle].distance < target) low = middle; else high = middle; }
    const a = points[low], b = points[high], t = b.distance > a.distance ? (target - a.distance) / (b.distance - a.distance) : 0;
    return { x: THREE.MathUtils.lerp(a.x, b.x, t), z: THREE.MathUtils.lerp(a.z, b.z, t), yaw: a.yaw + angle(a.yaw, b.yaw) * t };
  };
  const pose = gardenPose(gesture, 'architect'), cosine = Math.cos(pose.yaw), sine = Math.sin(pose.yaw);
  const feet = [0, 1].map(side => {
    const anchor = (travel: number, leg = side) => {
      const p = at(travel), lateral = leg ? .36 : -.36;
      return { x: p.x + Math.cos(p.yaw) * lateral, z: p.z - Math.sin(p.yaw) * lateral, yaw: p.yaw };
    };
    let next = landings.findIndex((landing, step) => step % 2 === side && landing > distance);
    if (next < 0) next = landings.length + ((landings.length % 2 === side) ? 0 : 1);
    const previous = next - 2, from = anchor(previous < 0 ? 0 : landings[previous] + .55);
    const to = anchor(next < landings.length ? landings[next] + .55 : total);
    const landing = next < landings.length ? landings[next] : total;
    const lastLanding = next > 0 && next <= landings.length ? landings[next - 1] : 0;
    const lift = next === 0 ? 0 : lastLanding + (landing - lastLanding) * .1;
    const progress = next >= landings.length || distance <= lift ? 0 : (distance - lift) / (landing - lift);
    const amount = eased(progress);
    let x = THREE.MathUtils.lerp(from.x, to.x, amount) - pose.x, z = THREE.MathUtils.lerp(from.z, to.z, amount) - pose.z;
    const dx = to.x - from.x, dz = to.z - from.z, length = Math.hypot(dx, dz);
    if (progress > 0 && length > 1e-6 && Math.abs(angle(from.yaw, to.yaw)) > .2) {
      const support = anchor(next ? landings[next - 1] + .55 : 0, 1 - side);
      const along = THREE.MathUtils.clamp(((support.x - from.x) * dx + (support.z - from.z) * dz) / length ** 2, 0, 1);
      const separationX = from.x + along * dx - support.x, separationZ = from.z + along * dz - support.z;
      const sign = (-dz * separationX + dx * separationZ) >= 0 ? 1 : -1;
      // A straight chord can carry the swinging shoe through the planted
      // shoe during a turn. Step around that support, retaining both anchors.
      const clearance = Math.max(0, .65 - Math.hypot(separationX, separationZ)) * Math.sin(progress * Math.PI);
      x += -dz / length * sign * clearance; z += dx / length * sign * clearance;
    }
    return { point: new THREE.Vector3(cosine * x - sine * z, .156 + Math.sin(progress * Math.PI) * .06, sine * x + cosine * z),
      yaw: from.yaw + angle(from.yaw, to.yaw) * amount - pose.yaw };
  });
  const hip = Math.min(1.98, ...feet.map((foot, side) => foot.point.y + Math.sqrt(Math.max(.01,
    1.838 ** 2 - (foot.point.x - (side ? .225 : -.225)) ** 2 - foot.point.z ** 2))));
  const speed = Math.hypot(second.x - first.x, second.z - first.z) / (second.time - first.time);
  const upper = architectWalkPose(distance / ARCHITECT_WALK_CYCLE, THREE.MathUtils.smoothstep(speed, 0, 2.2));
  rig.torso.position.y = hip; rig.torso.rotation.set(upper.lean, upper.twist, 0);
  rig.head.rotation.set(-upper.lean * .6, upper.headTurn, 0);
  for (let side = 0; side < 2; side++) {
    rig.hips[side].position.y = hip;
    rig.shoulders[side].rotation.set(upper.arms[side].shoulder, 0, upper.arms[side].outward); rig.elbows[side].rotation.set(upper.arms[side].elbow, 0, 0);
  }
  for (let side = 0; side < 2; side++) {
    const upper = rig.hips[side], lower = rig.knees[side], ankle = rig.ankles[side];
    // Solve in the actor frame: subtracting large world positions before
    // normalizing made identical saved poses depend on the map translation.
    const direction = feet[side].point.clone().sub(upper.position), a = lower.position.length(), b = ankle.position.length();
    const length = THREE.MathUtils.clamp(direction.length(), .01, a + b - .001); direction.normalize();
    const along = (a * a - b * b + length * length) / (2 * length);
    const pole = new THREE.Vector3(0, 0, 1).addScaledVector(direction, -direction.z).normalize();
    const hinge = direction.clone().multiplyScalar(along).addScaledVector(pole, Math.sqrt(Math.max(0, a * a - along * along)));
    upper.quaternion.setFromUnitVectors(lower.position.clone().normalize(), hinge.clone().normalize());
    const inverse = upper.quaternion.clone().invert();
    lower.quaternion.setFromUnitVectors(ankle.position.clone().normalize(), direction.multiplyScalar(length).sub(hinge).applyQuaternion(inverse).normalize());
    ankle.quaternion.copy(lower.quaternion).invert().multiply(inverse)
      .multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), feet[side].yaw));
  }
}
