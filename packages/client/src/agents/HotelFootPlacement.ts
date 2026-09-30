import * as THREE from 'three';
import { FILM_SETS, HOTEL_SURFACES, LAFAYETTE, hotelFloor, AMBUSH_FLOORS, AMBUSH_STAIRS, AMBUSH_STOREYS, ambushFloor } from '@auto_matrix/shared';
import type { HeroRig } from './HeroModel.js';
import type { CharacterRig } from './CharacterModel.js';
import { reach } from './SpoonPerformance.js';

const hotelCenter = FILM_SETS.film_lafayette.center;
const hotelBase = hotelCenter.y - LAFAYETTE.upper - 1;
const soles = new WeakMap<HeroRig, THREE.Vector3[][]>();
const proceduralSoles = new WeakMap<CharacterRig, THREE.Vector3[][]>();

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
  const ambushCenter = FILM_SETS.film_ambush_house.center;
  const ambush = Math.abs(origin.x - ambushCenter.x) <= 9 && origin.z >= ambushCenter.z + 12 && origin.z <= ambushCenter.z + 34
    && origin.y >= ambushCenter.y - 1 - AMBUSH_STAIRS.rise * AMBUSH_STOREYS - .1 && origin.y <= ambushCenter.y - 1 + .1;
  const center = ambush ? ambushCenter : hotelCenter, base = ambush ? center.y - 1 : hotelBase;
  const x = origin.x - center.x, y = origin.y - base, z = origin.z - center.z;
  if (!ambush && (x < 30 || x > 48 || z < -8 || z > 26 || y < -.1 || y > LAFAYETTE.upper + .1)) return;
  const rotation = rig.root.getWorldQuaternion(new THREE.Quaternion());
  const points = solePoints(rig), sample = new THREE.Vector3();
  // Sample only nearby treads; do not scan all thirteen storeys per shoe vertex.
  const surfaces = (ambush ? AMBUSH_FLOORS : HOTEL_SURFACES).filter(surface => Math.abs(surface.y - y) < 1 && surface.y <= y + .8
    && Math.abs(surface.x - x) < surface.width / 2 + 2.5 && Math.abs(surface.z - z) < surface.depth / 2 + 2.5);
  const legs = ['R', 'L'].map((side, index) => {
    const hip = rig.bones.get('hip_' + side)!, knee = rig.bones.get('knee_' + side)!, ankle = rig.bones.get('ankle_' + side)!;
    const start = hip.getWorldPosition(new THREE.Vector3());
    const hinge = knee.getWorldPosition(new THREE.Vector3());
    const target = ankle.getWorldPosition(new THREE.Vector3());
    const upper = start.distanceTo(hinge), lower = hinge.distanceTo(target);
    const floor = ambush ? ambushFloor(target.x - center.x, target.z - center.z, y) : hotelFloor(target.x - center.x, target.z - center.z, y);
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

// Cypher uses the existing procedural rig. Sample its actual boot meshes and
// solve each leg independently, including the forward rim beside a riser.
export function placeAmbushFeet(rig: CharacterRig): void {
  const center = FILM_SETS.film_ambush_house.center, base = center.y - 1;
  const origin = rig.root.getWorldPosition(new THREE.Vector3()), y = origin.y - base;
  if (Math.abs(origin.x - center.x) > 9 || origin.z < center.z + 12 || origin.z > center.z + 34 || y < -AMBUSH_STAIRS.rise * AMBUSH_STOREYS - .1 || y > .1) return;
  rig.root.updateWorldMatrix(true, true);
  let points = proceduralSoles.get(rig);
  if (!points) {
    points = rig.ankles.map(ankle => {
      const result: THREE.Vector3[] = [];
      ankle.traverse(object => {
        if (!(object instanceof THREE.Mesh)) return;
        for (let i = 0; i < object.geometry.attributes.position.count; i++) {
          const point = object.getVertexPosition(i, new THREE.Vector3()); object.localToWorld(point); ankle.worldToLocal(point);
          if (point.y < -.05) result.push(point);
        }
      });
      return result;
    });
    proceduralSoles.set(rig, points);
  }
  const rotation = rig.root.getWorldQuaternion(new THREE.Quaternion());
  const legs = rig.ankles.map((ankle, i) => {
    const target = ankle.getWorldPosition(new THREE.Vector3()), lift = Math.max(0, target.y - origin.y - .155);
    let support = -Infinity;
    for (const point of points![i]) {
      const sample = point.clone().applyQuaternion(rotation).add(target);
      const floor = ambushFloor(sample.x - center.x, sample.z - center.z, y);
      if (floor !== undefined && Math.abs(floor - y) < 1) support = Math.max(support, base + floor - sample.y + target.y);
    }
    target.y = support + lift; return { ankle, target, hip: rig.hips[i], knee: rig.knees[i] };
  });
  if (legs.some(leg => !Number.isFinite(leg.target.y))) return;
  let drop = 0;
  for (const { hip, knee, ankle, target } of legs) {
    const start = hip.getWorldPosition(new THREE.Vector3()), length = knee.position.length() + ankle.position.length() - .002;
    drop = Math.max(drop, start.y - target.y - Math.sqrt(Math.max(0, length * length - (start.x - target.x) ** 2 - (start.z - target.z) ** 2)));
  }
  for (const hip of rig.hips) hip.position.y -= drop; rig.torso.position.y -= drop;
  rig.root.updateWorldMatrix(true, true);
  for (const { hip, knee, ankle, target } of legs) {
    reach(hip, knee, ankle.position, target, new THREE.Vector3(0, 0, 1).applyQuaternion(rotation));
    ankle.quaternion.copy(knee.getWorldQuaternion(new THREE.Quaternion()).invert().multiply(rotation));
    ankle.updateWorldMatrix(false, true);
  }
}
