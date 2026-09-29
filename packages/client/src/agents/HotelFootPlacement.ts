import * as THREE from 'three';
import { FILM_SETS, HOTEL_SURFACES, LAFAYETTE, hotelFloor } from '@auto_matrix/shared';
import type { HeroRig } from './HeroModel.js';

const center = FILM_SETS.film_lafayette.center;
const base = center.y - LAFAYETTE.upper - 1;
const soles = new WeakMap<HeroRig, THREE.Vector3[][]>();

function solePoints(rig: HeroRig): THREE.Vector3[][] {
  const saved = soles.get(rig); if (saved) return saved;
  const shoes = rig.root.getObjectByName('shoes01') as THREE.SkinnedMesh;
  const { position, skinIndex, skinWeight } = shoes.geometry.attributes;
  const points = ['R', 'L'].map(side => {
    const joint = shoes.skeleton.bones.indexOf(rig.bones.get('ankle_' + side)!);
    const result: THREE.Vector3[] = [];
    for (let i = 0; i < position.count; i++) {
      if (![0, 1, 2, 3].some(j => skinIndex.getComponent(i, j) === joint && skinWeight.getComponent(i, j) > .5)) continue;
      const point = new THREE.Vector3().fromBufferAttribute(position, i).applyMatrix4(shoes.bindMatrix).applyMatrix4(shoes.skeleton.boneInverses[joint]);
      // Only the underside and lower rim can meet the next riser. Keep their
      // real outline so a bounding-box corner cannot lift a shoe off the step.
      if (point.y < -rig.footHeight + LAFAYETTE.rise / 2 / LAFAYETTE.steps + .04) result.push(point);
    }
    return result;
  });
  soles.set(rig, points); return points;
}

// The actor's root follows the shared stair collider; each sole needs its own
// tread height. Keep the gait's raised foot above that tread, not at root level.
export function placeHotelFeet(rig: HeroRig): void {
  const origin = rig.root.getWorldPosition(new THREE.Vector3());
  const x = origin.x - center.x, y = origin.y - base, z = origin.z - center.z;
  if (x < 30 || x > 48 || z < -8 || z > 26 || y < -.1 || y > LAFAYETTE.upper + .1) return;
  const rotation = rig.root.getWorldQuaternion(new THREE.Quaternion());
  const points = solePoints(rig), sample = new THREE.Vector3();
  // Sample only nearby treads; do not scan all thirteen storeys per shoe vertex.
  const surfaces = HOTEL_SURFACES.filter(surface => Math.abs(surface.y - y) < 1 && surface.y <= y + .8
    && Math.abs(surface.x - x) < surface.width / 2 + 2.5 && Math.abs(surface.z - z) < surface.depth / 2 + 2.5);
  const legs = ['R', 'L'].map((side, index) => {
    const hip = rig.bones.get('hip_' + side)!, knee = rig.bones.get('knee_' + side)!, ankle = rig.bones.get('ankle_' + side)!;
    const start = hip.getWorldPosition(new THREE.Vector3());
    const hinge = knee.getWorldPosition(new THREE.Vector3());
    const target = ankle.getWorldPosition(new THREE.Vector3());
    const upper = start.distanceTo(hinge), lower = hinge.distanceTo(target);
    const floor = hotelFloor(target.x - center.x, target.z - center.z, y);
    const lift = Math.max(0, target.y - origin.y - rig.footHeight);
    let support = -Infinity;
    for (const point of points[index]) {
      sample.copy(point).applyQuaternion(rotation);
      const sx = target.x + sample.x - center.x, sz = target.z + sample.z - center.z;
      for (const surface of surfaces) if (Math.abs(sx - surface.x) <= surface.width / 2 + .001 && Math.abs(sz - surface.z) <= surface.depth / 2 + .001)
        support = Math.max(support, base + surface.y - sample.y);
    }
    target.y = support + lift;
    return { hip, knee, ankle, start, target, upper, lower, floor };
  });
  // A foot over the stairwell must not reach down to a different storey.
  if (legs.some(leg => leg.floor === undefined || Math.abs(leg.floor - y) > 1)) return;
  let drop = 0;
  for (const { start, target, upper, lower } of legs) {
    const horizontal = (target.x - start.x) ** 2 + (target.z - start.z) ** 2;
    const vertical = Math.sqrt(Math.max(0, (upper + lower - .002) ** 2 - horizontal));
    drop = Math.max(drop, start.y - target.y - vertical);
  }
  const pelvis = rig.bones.get('pelvis')!;
  const position = pelvis.getWorldPosition(new THREE.Vector3()); position.y -= drop;
  pelvis.position.copy(pelvis.parent!.worldToLocal(position));
  rig.root.updateWorldMatrix(true, true);
  for (const { hip, knee, ankle, target, upper, lower } of legs) {
    const start = hip.getWorldPosition(new THREE.Vector3());
    const direction = target.clone().sub(start);
    const reach = THREE.MathUtils.clamp(direction.length(), .02, upper + lower - .001); direction.normalize();
    const along = (upper * upper - lower * lower + reach * reach) / (2 * reach);
    const bend = new THREE.Vector3(0, 0, 1).applyQuaternion(rotation);
    bend.addScaledVector(direction, -bend.dot(direction)).normalize();
    const hinge = start.clone().addScaledVector(direction, along).addScaledVector(bend, Math.sqrt(Math.max(0, upper * upper - along * along)));
    const aim = (joint: THREE.Bone, child: THREE.Bone, point: THREE.Vector3) => {
      joint.quaternion.setFromUnitVectors(child.position.clone().normalize(), joint.parent!.worldToLocal(point.clone()).sub(joint.position).normalize());
      joint.updateWorldMatrix(false, true);
    };
    aim(hip, knee, hinge); aim(knee, ankle, target);
    ankle.quaternion.copy(knee.getWorldQuaternion(new THREE.Quaternion()).invert().multiply(rotation));
  }
  rig.root.updateWorldMatrix(true, true);
}
