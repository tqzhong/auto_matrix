import * as THREE from 'three';
import type { HeroRig } from './HeroModel.js';
import type { MotionInput } from './CharacterMotion.js';
import { HandCurve } from './HandCurve.js';
import { applyNailSurface } from './NailSurface.js';

type Attributes = Record<'position' | 'normal' | 'skinIndex' | 'skinWeight', THREE.BufferAttribute>;
interface MaterialPoint { id: number; amount: number; interval: number; u: number; n: number; b: number; t: number }
interface Finger { joints: number[]; radius: number[]; rest: HandCurve; vertices: MaterialPoint[]; metacarpal?: THREE.Vector3 }
interface Hand {
  side: string; wrist: number; cacheable: boolean; pistolCacheable: boolean; bones: number[][]; caps: number[][]; axes: THREE.Vector3[][];
  vertices: number[]; faces: number[][]; offsets: Map<number, number>; triangles: Uint32Array; fingers: Finger[]; palm: number[];
  opposition?: { nail: THREE.Vector3; pad: THREE.Vector3; radial: THREE.Vector3; clearance: number };
  thumbPose?: number[][];
  fistPose?: number[][][];
  thumbAbduction?: number;
  thumbLift?: number;
  fistCorrection?: { vertices: number[]; offsets: number[]; startGrip: number };
  fistTissueCurve?: { vertices: number[]; grips: number[]; offsets: number[][]; slopes: number[][] };
  thumbCorrection?: { vertices: number[]; offsets: number[]; startGrip: number };
}
interface Binding { attributes: Attributes; hands: Hand[]; groups: number[]; groupCount: number }
const bindings = new WeakMap<THREE.BufferGeometry, Binding>();
const attributes = ['position', 'normal', 'skinIndex', 'skinWeight'] as const;
// Ordinary locomotion and unarmed combat use the fist articulation. Story
// gestures opt in separately and retain their authored joints and contact IK.
const ordinaryInputs = new Set<keyof MotionInput>([
  'speed', 'grounded', 'verticalVelocity', 'turn', 'attack', 'combo', 'hit', 'impact', 'windingUp', 'cast', 'skill',
  'armed', 'shot', 'crouching', 'seated', 'floorSeated', 'riding', 'climbing', 'firstPerson', 'weaponStyle', 'aimPitch',
  'ambushWardrobe', 'homeClothes', 'clubClothes', 'officeShirt', 'dojoOutfit', 'dojoSparring', 'glasses', 'inspecting',
  'realWorld', 'constructSuit', 'parkOutfit', 'nebCrew', 'nebCrewEarly', 'farewellOutfit', 'mobilStation',
]);

function basis(tangent: THREE.Vector3) {
  const n = new THREE.Vector3(0, 0, 1); n.addScaledVector(tangent, -n.dot(tangent)).normalize();
  return { n, b: new THREE.Vector3().crossVectors(tangent, n) };
}
function frame(direction: THREE.Vector3) {
  const y = direction.clone().normalize(), { n, b } = basis(y);
  return new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(b, y, n));
}

/** A continuous weight field follows the phalanges and the upper palm. The
 * thumb retains its original articulation; palm influence fades around it. */
function support(skin: THREE.SkinnedMesh, boundary: number[]): Attributes {
  const a = Object.fromEntries(attributes.map(name => [name, skin.geometry.attributes[name].clone()])) as Attributes;
  const points = Array.from({ length: a.position.count }, (_, id) => new THREE.Vector3().fromBufferAttribute(a.position, id));
  const names = skin.skeleton.bones.map(b => b.name), positions = skin.skeleton.boneInverses.map(m => new THREE.Vector3().setFromMatrixPosition(m.clone().invert()));
  for (const side of ['R', 'L']) {
    const wrist = names.indexOf(`wrist_${side}`), digits = Array.from({ length: 5 }, (_, d) => [1, 2, 3].map(j => names.indexOf(`finger${d + 1}-${j}_${side}`)));
    const sideBones = new Set([wrist, ...digits.flat()]);
    const rim = boundary.filter(id => [0, 1, 2, 3].some(k => sideBones.has(a.skinIndex.getComponent(id, k)) && a.skinWeight.getComponent(id, k) > 0)).map(id => points[id]);
    const feather = positions[wrist].distanceTo(positions[digits[2][0]]) * .25;
    const chains = digits.map(joints => {
      const caps = points.filter((_, id) => [0, 1, 2, 3].some(k => a.skinIndex.getComponent(id, k) === joints[2] && a.skinWeight.getComponent(id, k) > .95));
      const end = caps.reduce((sum, p) => sum.add(p), new THREE.Vector3()).divideScalar(caps.length), axis = end.clone().sub(positions[joints[2]]).normalize();
      const length = Math.max(...caps.map(p => p.clone().sub(positions[joints[2]]).dot(axis)));
      const p = [...joints.map(j => positions[j].clone()), positions[joints[2]].clone().addScaledVector(axis, length)];
      const lengths = [0, 1, 2].map(i => p[i].distanceTo(p[i + 1])), first = p[1].clone().sub(p[0]).normalize(), palm = p[0].distanceTo(positions[wrist]) / 2;
      const extended = [p[0].clone().addScaledVector(first, -palm), ...p];
      const lines = extended.slice(0, -1).map((point, i) => new THREE.Line3(point, extended[i + 1]));
      const radii = points.filter((_, id) => [0, 1, 2, 3].some(k => joints.includes(a.skinIndex.getComponent(id, k)) && a.skinWeight.getComponent(id, k) > .95))
        .map(p => Math.min(...lines.map(line => line.closestPointToPoint(p, true, new THREE.Vector3()).distanceTo(p)))).sort((a, b) => a - b);
      return { lines, radius: radii[Math.floor(radii.length / 2)], segments: [-palm, 0, lengths[0], lengths[0] + lengths[1]],
        knots: [-palm, lengths[0] / 2, lengths[0] + lengths[1] / 2, lengths[0] + lengths[1] + lengths[2] / 2] };
    });
    for (let id = 0; id < points.length; id++) {
      const original = new Map<number, number>(); let total = 0;
      for (let k = 0; k < 4; k++) {
        const joint = a.skinIndex.getComponent(id, k), weight = a.skinWeight.getComponent(id, k);
        original.set(joint, (original.get(joint) ?? 0) + weight); if (sideBones.has(joint)) total += weight;
      }
      // A near-pure wrist vertex still belongs to the palm. Skipping it
      // while reshaping its fully weighted neighbour creates a hard spike.
      // Fade the hand field through the mixed forearm band and retain the
      // original contribution from bones outside this hand.
      if (total <= .75) continue;
      const distance = Math.sqrt(rim.reduce((nearest, point) => Math.min(nearest, point.distanceToSquared(points[id])), Infinity));
      // An authored thumb heat field already includes its metacarpal. Fade
      // the generic repartition there so it does not bind that joint twice.
      const strength = THREE.MathUtils.smoothstep(total, .75, 1) * THREE.MathUtils.smoothstep(distance, 0, feather)
        * (1 - (skin.geometry.getAttribute('_thumb_volume')?.getX(id) ?? 0));
      if (!strength) continue;
      const retained = new Map(original);
      for (const joint of sideBones) original.set(joint, (original.get(joint) ?? 0) / total);
      const member = digits.map(joints => joints.reduce((sum, j) => sum + (original.get(j) ?? 0), 0));
      const fields = chains.map(chain => {
        const closest = chain.lines.map((line, i) => {
          const t = line.closestPointToPointParameter(points[id], true), at = line.at(t, new THREE.Vector3());
          return { distance: at.distanceTo(points[id]), s: chain.segments[i] + t * line.distance() };
        }).sort((a, b) => a.distance - b.distance)[0];
        const weights = [0, 0, 0, 0], end = chain.knots.findIndex(k => k >= closest.s);
        if (end === 0) weights[0] = 1;
        else if (end < 0) weights[3] = 1;
        else { const t = (closest.s - chain.knots[end - 1]) / (chain.knots[end] - chain.knots[end - 1]); weights[end - 1] = 1 - t; weights[end] = t; }
        return { weights, probability: Math.exp(-(closest.distance ** 2) / (2 * chain.radius ** 2)) };
      });
      const nonThumb = member.slice(1).reduce((a, b) => a + b, 0), sum = fields.slice(1).reduce((s, f) => s + f.probability, 0);
      const blend = THREE.MathUtils.smoothstep(nonThumb, 0, .25), retain = 1 - THREE.MathUtils.smoothstep(member[0], 0, .25), result = new Map<number, number>();
      for (const joint of digits[0]) result.set(joint, original.get(joint) ?? 0);
      result.set(wrist, (1 - member[0]) * (1 - retain));
      fields.forEach((field, d) => {
        if (d === 0) return;
        const weight = (1 - member[0]) * retain * THREE.MathUtils.lerp(field.probability / sum, nonThumb ? member[d] / nonThumb : 0, blend);
        for (let j = 0; j < 4; j++) { const joint = j === 0 ? wrist : digits[d][j - 1]; result.set(joint, (result.get(joint) ?? 0) + weight * field.weights[j]); }
      });
      // The donor blends the thumb's second phalanx directly with the wrist,
      // almost skipping its metacarpal. Mediate that pair through the missing
      // joint with a quadratic partition; both end weights stay nonnegative.
      const palm = original.get(wrist) ?? 0, phalanx = original.get(digits[0][1]) ?? 0;
      if (palm > 0 && phalanx > 0) {
        const middle = Math.min(palm, result.get(wrist) ?? 0) * phalanx / (palm + phalanx);
        result.set(wrist, (result.get(wrist) ?? 0) - middle);
        result.set(digits[0][1], (result.get(digits[0][1]) ?? 0) - middle);
        result.set(digits[0][0], (result.get(digits[0][0]) ?? 0) + 2 * middle);
      }
      for (const [joint, weight] of result) result.set(joint, weight * total * strength);
      for (const [joint, weight] of retained) result.set(joint, (result.get(joint) ?? 0) + weight * (sideBones.has(joint) ? 1 - strength : 1));
      const top = [...result].sort((a, b) => b[1] - a[1]).slice(0, 4), normal = top.reduce((s, p) => s + p[1], 0);
      while (top.length < 4) top.push([0, 0]);
      top.forEach(([joint, w], k) => { a.skinIndex.setComponent(id, k, joint); a.skinWeight.setComponent(id, k, w / normal); });
    }
  }
  return a;
}

function bind(skin: THREE.SkinnedMesh, rig: HeroRig): Binding {
  const source = skin.geometry.attributes as Attributes, index = skin.geometry.index!, keys = new Map<string, number>(), groups: number[] = [], normalKeys = new Map<string, number>(), normalGroups: number[] = [];
  for (let id = 0; id < source.position.count; id++) {
    const point = new THREE.Vector3().fromBufferAttribute(source.position, id), key = point.toArray().map(n => n.toFixed(6)).join(',');
    if (!keys.has(key)) keys.set(key, keys.size); groups[id] = keys.get(key)!;
    const normal = [key, ...[0, 1, 2].map(k => source.normal.getComponent(id, k).toFixed(6))].join(',');
    if (!normalKeys.has(normal)) normalKeys.set(normal, normalKeys.size); normalGroups[id] = normalKeys.get(normal)!;
  }
  const neighbours = Array.from({ length: keys.size }, () => new Set<number>());
  const edges = new Map<number, { count: number; vertices: number[] }>();
  for (let f = 0; f < index.count; f += 3) {
    const ids = [0, 1, 2].map(k => groups[index.getX(f + k)]); for (const x of ids) for (const y of ids) neighbours[x].add(y);
    for (let k = 0; k < 3; k++) {
      const x = ids[k], y = ids[(k + 1) % 3]; if (x === y) continue;
      const key = Math.min(x, y) * keys.size + Math.max(x, y), edge = edges.get(key);
      if (edge) edge.count++; else edges.set(key, { count: 1, vertices: [index.getX(f + k), index.getX(f + (k + 1) % 3)] });
    }
  }
  // Weld UV duplicates before finding the physical open hand rims. Keeping
  // their original binding also keeps the separate forearm skin attached.
  const boundary = [...new Set([...edges.values()].filter(edge => edge.count === 1).flatMap(edge => edge.vertices))];
  const a = support(skin, boundary);
  const names = skin.skeleton.bones.map(b => b.name);
  const hands = ['R', 'L'].map(side => {
    const wrist = names.indexOf(`wrist_${side}`), inverse = skin.skeleton.boneInverses[wrist];
    const bones = Array.from({ length: 5 }, (_, d) => [1, 2, 3].map(j => names.indexOf(`finger${d + 1}-${j}_${side}`)));
    const caps = bones.map(joints => Array.from({ length: a.position.count }, (_, id) => id)
      .filter(id => [0, 1, 2, 3].some(k => a.skinIndex.getComponent(id, k) === joints[2] && a.skinWeight.getComponent(id, k) > .95)));
    const axes = bones.map((joints, d) => {
      const tip = new THREE.Vector3(); let count = 0;
      for (let id = 0; id < a.position.count; id++) for (let k = 0; k < 4; k++) if (a.skinIndex.getComponent(id, k) === joints[2] && a.skinWeight.getComponent(id, k) > .9) {
        tip.add(new THREE.Vector3().fromBufferAttribute(a.position, id).applyMatrix4(skin.bindMatrix).applyMatrix4(skin.skeleton.boneInverses[joints[2]])); count++;
      }
      return [rig.rest.get(`finger${d + 1}-2_${side}`)!.clone(), rig.rest.get(`finger${d + 1}-3_${side}`)!.clone(), tip.divideScalar(count)];
    });
    const connected = new Set<number>(), todo = [groups[caps[2][0]]];
    while (todo.length) { const id = todo.pop()!; if (connected.has(id)) continue; connected.add(id); for (const next of neighbours[id]) if (!connected.has(next)) todo.push(next); }
    const faces: number[][] = [];
    for (let f = 0; f < index.count; f += 3) { const ids = [0, 1, 2].map(k => index.getX(f + k)); if (ids.every(id => connected.has(groups[id]))) faces.push(ids); }
    const vertices = [...new Set(faces.flat())], point = (id: number) => new THREE.Vector3().fromBufferAttribute(a.position, id).applyMatrix4(skin.bindMatrix).applyMatrix4(inverse);
    const fingers = [1, 2, 3, 4, 5].map(digit => {
      const joints = bones[digit - 1], tip = caps[digit - 1].reduce((sum, id) => sum.add(point(id)), new THREE.Vector3()).divideScalar(caps[digit - 1].length);
      const points = [...joints.map(j => new THREE.Vector3().setFromMatrixPosition(skin.skeleton.boneInverses[j].clone().invert()).applyMatrix4(inverse)), tip];
      const amount = (id: number) => [0, 1, 2, 3].reduce((sum, k) => sum + (joints.includes(a.skinIndex.getComponent(id, k)) ? a.skinWeight.getComponent(id, k) : 0), 0);
      const owned = vertices.filter(id => amount(id) > .95).map(point);
      const radius = [1, 2].map(j => {
        const tangent = points[j + 1].clone().sub(points[j - 1]).normalize(), { b } = basis(tangent), width = Math.min(points[j].distanceTo(points[j - 1]), points[j].distanceTo(points[j + 1])) * .35;
        return 1.2 * Math.max(...owned.map(p => p.clone().sub(points[j])).filter(p => Math.abs(p.dot(tangent)) < width).map(p => Math.abs(p.dot(b))));
      });
      // Refined hands include the palm-to-finger transition in their curve.
      // Keep that proximal anchor attached to the wrist as the MCP curls.
      const metacarpal = digit > 1 && skin.userData.articulatedMcp ? points[0].clone().multiplyScalar(.78) : undefined;
      if (metacarpal) radius.unshift(radius[0] * 1.05);
      const rest = new HandCurve(metacarpal ? [metacarpal, ...points] : points, radius), mapped: MaterialPoint[] = [];
      for (const id of vertices) {
        const influence = amount(id); if (!influence) continue;
        const p = point(id), s = rest.closest(p), sample = rest.sample(s), { n, b } = basis(sample.t), delta = p.sub(sample.p);
        // The donor skin already follows the curved rest finger. Undo the
        // inner-radius compression before storing material coordinates, so
        // applying it in shapeFingers does not dent an unchanged joint twice.
        const inner = delta.dot(sample.n);
        if (inner > 0 && sample.k > 1e-8) delta.addScaledVector(sample.n, -Math.log1p(-sample.k * inner) / sample.k - inner);
        const proximal = points[0].distanceTo(points[1]);
        const blend = influence * (digit === 1 ? THREE.MathUtils.smoothstep(influence, .5, .95) : 1) * THREE.MathUtils.smoothstep(s, digit === 1 ? proximal * .65 : 0, proximal * (digit === 1 ? 1.05 : .25));
        if (blend) {
          let interval = rest.anchors.findIndex(at => at >= s); if (interval <= 0) interval = 1;
          const start = rest.anchors[interval - 1], end = rest.anchors[interval], u = (s - start) / (end - start);
          mapped.push({ id, amount: blend, interval, u, n: delta.dot(n), b: delta.dot(b), t: delta.dot(sample.t) });
        }
      }
      return { joints, radius, rest, vertices: mapped, metacarpal };
    });
    let opposition: Hand['opposition'];
    if (skin.userData.thumbOpposition?.version === 1) {
      const detail = skin.geometry.getAttribute('_nail_detail'), nail = new THREE.Vector3(), indexNail = new THREE.Vector3();
      const normalSpace = new THREE.Matrix3().getNormalMatrix(inverse.clone().multiply(skin.bindMatrix));
      for (const id of caps[0]) if (detail.getX(id) > .7) nail.add(new THREE.Vector3().fromBufferAttribute(a.normal, id));
      for (const id of caps[1]) if (detail.getX(id) > .7) indexNail.add(new THREE.Vector3().fromBufferAttribute(a.normal, id));
      nail.applyMatrix3(normalSpace).normalize(); indexNail.applyMatrix3(normalSpace).normalize();
      const center = caps[0].reduce((sum, id) => sum.add(point(id)), new THREE.Vector3()).divideScalar(caps[0].length);
      const tip = new THREE.Vector3().setFromMatrixPosition(skin.skeleton.boneInverses[bones[0][2]].clone().invert()).applyMatrix4(inverse);
      const indexAxis = axes[1][2].clone().normalize(), radial = new THREE.Vector3().crossVectors(indexNail, indexAxis).normalize();
      if (radial.dot(rig.rest.get(`finger2-1_${side}`)!.clone().sub(rig.rest.get(`finger5-1_${side}`)!)) < 0) radial.negate();
      const indexTip = new THREE.Vector3().setFromMatrixPosition(skin.skeleton.boneInverses[bones[1][2]].clone().invert()).applyMatrix4(inverse);
      const section = vertices.filter(id => [0, 1, 2, 3].reduce((sum, k) => sum + (bones[1].includes(a.skinIndex.getComponent(id, k)) ? a.skinWeight.getComponent(id, k) : 0), 0) > .9
        && Math.abs(point(id).sub(indexTip).dot(indexAxis)) < axes[1][1].length() * .4);
      const indexRadius = Math.max(...section.map(id => point(id).sub(indexTip).dot(radial)));
      const radius = Math.max(...caps[0].map(id => Math.abs(point(id).sub(center).dot(nail))));
      opposition = { nail, pad: center.sub(tip), radial, clearance: indexRadius + radius + .002 };
    }
    const offsets = new Map(vertices.map((id, i) => [id, i]));
    const roots = bones.slice(1).map(joints => {
      const points = joints.slice(0, 2).map(j => new THREE.Vector3().setFromMatrixPosition(skin.skeleton.boneInverses[j].clone().invert()).applyMatrix4(inverse));
      return { start: points[0], axis: points[1].clone().sub(points[0]), length: points[0].distanceToSquared(points[1]) };
    });
    const palm = vertices.map(id => {
      const p = point(id), member = bones.map(joints => [0, 1, 2, 3].reduce((sum, k) => sum + (joints.includes(a.skinIndex.getComponent(id, k)) ? a.skinWeight.getComponent(id, k) : 0), 0));
      const total = member.slice(1).reduce((sum, value) => sum + value, 0);
      const thumb = skin.geometry.getAttribute('_thumb_volume')?.getX(id) ?? 0;
      if (!total) return thumb;
      return Math.max(thumb, roots.reduce((sum, root, d) => sum + member[d + 1] * (1 - THREE.MathUtils.smoothstep(p.clone().sub(root.start).dot(root.axis) / root.length, .25, .75)), 0) / total
        * (1 - THREE.MathUtils.smoothstep(member[0], .05, .3)));
    });
    const family = new Set([wrist, ...bones.flat()]);
    const shaped = new Set([...caps.flat(), ...fingers.slice(1).flatMap(finger => finger.vertices.map(v => v.id))]);
    const local = (ids: Iterable<number>, weights: Attributes) => [...ids].every(id => [0, 1, 2, 3].every(k => !weights.skinWeight.getComponent(id, k) || family.has(weights.skinIndex.getComponent(id, k))));
    const cacheable = local(shaped, a);
    const pistolCacheable = local(new Set([...shaped, ...fingers[0].vertices.map(v => v.id)]), skin.geometry.attributes as Attributes);
    // Each corner keeps its posed-position offset and welded normal offset.
    // Topology is fixed; retain the original face/corner accumulation order.
    const triangles = new Uint32Array(faces.length * 6);
    for (let face = 0; face < faces.length; face++) for (let corner = 0; corner < 3; corner++) {
      const id = faces[face][corner], at = face * 6 + corner * 2;
      triangles[at] = offsets.get(id)! * 15 + 3; triangles[at + 1] = normalGroups[id] * 3;
    }
    const fistPose = skin.userData.ordinaryFistPose?.version === 1 ? skin.userData.ordinaryFistPose.closed[side] as number[][][] : undefined;
    const thumbAbduction = fistPose ? skin.userData.ordinaryFistPose.thumbAbductionRadians as number | undefined : undefined;
    const thumbLift = fistPose ? skin.userData.ordinaryFistPose.thumbLiftRadians as number | undefined : undefined;
    const thumbPose = fistPose?.[0] ?? (skin.userData.combatThumbPose?.version === 1 ? skin.userData.combatThumbPose.closed[side] as number[][] : undefined);
    const thumbCorrection = thumbPose && (!fistPose || skin.userData.ordinaryFistPose.retainThumbCorrection) ? skin.userData.combatThumbPose.corrective?.[side] as Hand['thumbCorrection'] : undefined;
    const fistCorrection = fistPose ? skin.userData.ordinaryFistPose.corrective?.[side] as Hand['fistCorrection'] : undefined;
    const curve = fistPose ? skin.userData.ordinaryFistPose.tissueCurve?.[side] : undefined;
    const fistTissueCurve = curve ? { ...curve, slopes: curve.offsets.map((values: number[], at: number) => values.map((value, coordinate) => {
      if (!at || at === curve.grips.length - 1) return 0;
      const left = curve.grips[at] - curve.grips[at - 1], right = curve.grips[at + 1] - curve.grips[at];
      const a = (value - curve.offsets[at - 1][coordinate]) / left, b = (curve.offsets[at + 1][coordinate] - value) / right;
      return a * b <= 0 ? 0 : 3 * (left + right) / ((2 * right + left) / a + (right + 2 * left) / b);
    })) } as Hand['fistTissueCurve'] : undefined;
    return { side, wrist, cacheable, pistolCacheable, bones, caps, axes, vertices, faces, offsets, triangles, fingers, palm, opposition, thumbPose, fistPose, thumbAbduction, thumbLift, thumbCorrection, fistCorrection, fistTissueCurve };
  });
  return { attributes: a, hands, groups: normalGroups, groupCount: normalKeys.size };
}

/** Rounded material coordinates preserve finger volume through a bend.
 * Neo's pill, mirror and pod grips retain their authored joints and targets. */
export class FightingHands {
  private skin: THREE.SkinnedMesh;
  private base: Attributes;
  private output: Attributes;
  private binding: Binding;
  private geometries: THREE.BufferGeometry[];
  private closed: THREE.Quaternion[][][];
  private storyClosed: THREE.Quaternion[][][];
  private storyGrips = [false, false];
  private snapshots: number[][] = [[], []];
  private enabled = false;
  private authored = false;
  private connector = false;
  private mouthCheck = false;
  private chinSupport = false;
  private guide = false;
  private tracker = false;
  private pistol = false;
  private amounts = [0, 0];
  private previous: (string | undefined)[] = [];
  private scratch: Float64Array;
  private normals: Float64Array;
  private shapes = new Map<Hand, { key: string; delta: Float64Array }>();

  constructor(private rig: HeroRig) {
    this.skin = rig.root.getObjectByName('Anatomical_head_and_hands') as THREE.SkinnedMesh;
    if (this.skin.geometry.hasAttribute('_nail_detail')) applyNailSurface(this.skin.material as THREE.MeshStandardMaterial, this.skin.geometry.hasAttribute('_hand_surface') && this.skin.geometry.hasAttribute('_hand_fold'));
    const source = this.skin.geometry;
    this.base = Object.fromEntries(attributes.map(name => [name, source.attributes[name]])) as Attributes;
    let binding = bindings.get(source); if (!binding) { binding = bind(this.skin, rig); bindings.set(source, binding); } this.binding = binding;
    this.scratch = new Float64Array(Math.max(...binding.hands.map(hand => hand.vertices.length)) * 15);
    this.normals = new Float64Array(binding.groupCount * 3);
    const geometry = source.clone(); this.skin.geometry = geometry; this.geometries = [geometry];
    this.output = Object.fromEntries(attributes.map(name => [name, geometry.attributes[name]])) as Attributes;
    // Outfit and first-person changes select these geometries later in animate.
    // Their attributes must belong to this actor, never the shared loaded asset.
    const views = rig.trackingSkin;
    if (views?.mesh === this.skin) {
      views.original = geometry;
      for (const name of ['covered', 'firstPerson', 'patientFirstPerson'] as const) {
        const owned = views[name].clone(); owned.attributes = geometry.attributes;
        views[name] = owned; this.geometries.push(owned);
      }
    }
    const closed = (ordinary: boolean) => binding.hands.map(hand => hand.axes.map((axes, d) => {
      if (ordinary && hand.fistPose) return hand.fistPose[d].map(q => new THREE.Quaternion().fromArray(q));
      if (ordinary && d === 0 && hand.thumbPose) return hand.thumbPose.map(q => new THREE.Quaternion().fromArray(q));
      const sign = hand.side === 'R' ? 1 : -1, parent = new THREE.Quaternion(), rotations: THREE.Quaternion[] = [];
      let directions = [[.83, -.5, .23], [.65, -.73, -.21], [-.1, -.45, -.88]].map(p => new THREE.Vector3(sign * p[0], p[1], p[2]).normalize());
      if (d > 0 && (!ordinary || d === 1)) {
        const [a, b, c] = axes.map(p => p.length()), old = [[.985, -.173], [.5, .866], [-.9, .436]].map(p => new THREE.Vector2(...p as [number, number]).normalize());
        const end = old[0].clone().multiplyScalar(a).addScaledVector(old[1], b).addScaledVector(old[2], c), dip = 70 * Math.PI / 180;
        const length = Math.sqrt(b * b + c * c + 2 * b * c * Math.cos(dip)), angle = Math.atan2(c * Math.sin(dip), b + c * Math.cos(dip));
        const bend = Math.acos(THREE.MathUtils.clamp((end.lengthSq() - a * a - length * length) / (2 * a * length), -1, 1)), pip = bend - angle;
        const start = end.angle() - Math.atan2(length * Math.sin(bend), a + length * Math.cos(bend));
        directions = [start, start + pip, start + pip + dip].map((t, j) => new THREE.Vector3(sign * Math.cos(t), Math.sin(t), j === 0 ? axes[0].z / a * .5 : 0).normalize());
      } else if (d > 1) {
        // Close the proximal phalanx across the palm, then curl the two
        // remaining joints. Preserving the old fingertip target left an air
        // gap between the distal pads and palm even at a full fighting grip.
        const pip = [95, 93, 86][d - 2];
        directions = [-10, -10 + pip, 60 + pip].map((angle, j) => {
          const t = angle * Math.PI / 180;
          return new THREE.Vector3(sign * Math.cos(t), Math.sin(t), j === 0 ? axes[0].z / axes[0].length() * .5 : 0).normalize();
        });
      }
      directions.forEach((target, j) => {
        const world = d === 0 ? new THREE.Quaternion().setFromUnitVectors(axes[j].clone().normalize(), target) : frame(target).multiply(frame(axes[j]).invert());
        rotations.push(parent.clone().invert().multiply(world)); parent.copy(world);
      });
      return rotations;
    }));
    this.closed = closed(true); this.storyClosed = closed(false);
  }

  begin(input?: MotionInput): void {
    // PlayerControls also sends zero outside the mirror sequence. A timed
    // story gesture at zero still opts out; only this inactive tint is neutral.
    const tracking = input?.performance === 'touch', pod = input?.podBreather !== undefined;
    this.pistol = false;
    this.storyGrips.fill(false);
    this.connector = input?.cabin?.kind === 'core' && input.cabin.role === 'morpheus' && input.cabin.elapsed > 2 && input.cabin.elapsed < 6.8;
    this.mouthCheck = input?.training?.kind === 'jump_return' && input.training.role === 'neo';
    this.chinSupport = input?.training?.kind === 'download' && input.training.role === 'morpheus';
    this.guide = input?.training?.kind === 'red_dress' && input.training.role === 'morpheus' && Boolean(input.training.attention);
    this.tracker = input?.interrogation?.role === 'smith' && (input.interrogation.phase === 'done'
      || input.interrogation.phase === 'coercion' && input.interrogation.elapsed > 13.8);
    this.authored = input?.pills?.role === 'neo' || tracking || pod || this.connector || this.mouthCheck || this.chinSupport || this.guide || this.tracker;
    this.enabled = Boolean(input && !input.armed && (!input.seated || this.authored) && !input.floorSeated && !input.riding
      && Object.entries(input).every(([key, value]) => value === undefined || value === false || (key === 'mirror' && value === 0)
        || (key === 'pills' && this.authored) || tracking && ['performance', 'mirror', 'mirrorBeat', 'mirrorEntry'].includes(key)
        || pod && ['performance', 'podWake', 'podBreather'].includes(key) || this.connector && key === 'cabin' || (this.mouthCheck || this.chinSupport || this.guide) && key === 'training'
        || this.tracker && key === 'interrogation' || ordinaryInputs.has(key as keyof MotionInput)));
    for (const name of attributes) this.skin.geometry.setAttribute(name, this.base[name]);
  }

  // A story prop can reuse the anatomical articulation as a fixed bone pose.
  pose(side: string, grip: number, storyGrip = false): boolean {
    if ((!this.enabled || this.authored) && !storyGrip) return false;
    const which = side === 'R' ? 0 : 1, hand = this.binding.hands[which], amount = THREE.MathUtils.clamp(grip, 0, 1);
    const closed = storyGrip ? this.storyClosed : this.closed;
    const chin = this.chinSupport && storyGrip && side === 'R';
    const closure = chin ? THREE.MathUtils.smoothstep(amount, 0, .8) : amount;
    this.storyGrips[which] = storyGrip;
    if (amount > 0) {
      hand.bones.forEach((joints, d) => joints.forEach((joint, j) => this.skin.skeleton.bones[joint].quaternion.slerp(closed[which][d][j], d === 0 ? closure * closure : closure)));
      const thumb = this.skin.skeleton.bones[hand.bones[0][0]], sign = side === 'R' ? 1 : -1;
      if (!storyGrip && hand.thumbAbduction && closure < 1) {
        thumb.quaternion.premultiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), -sign * hand.thumbAbduction * Math.sin(Math.PI * closure)));
      }
      if (!storyGrip && hand.thumbLift && closure < 1) {
        thumb.quaternion.premultiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), sign * hand.thumbLift * Math.sin(Math.PI * closure)));
      }
      if (!hand.thumbPose || storyGrip) {
        thumb.quaternion.premultiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), -sign * .55 * Math.sin(Math.PI * closure)));
        thumb.quaternion.premultiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), sign * .14 * closure));
      }
      if (chin) {
        const [base, middle, tip] = hand.bones[0].map(joint => this.skin.skeleton.bones[joint]);
        const parent = base.quaternion.clone().multiply(middle.quaternion);
        const direction = new THREE.Vector3(-.4, -1, 0).normalize();
        const opposed = new THREE.Quaternion().setFromUnitVectors(hand.axes[0][2].clone().normalize(), direction);
        tip.quaternion.slerp(parent.invert().multiply(opposed), THREE.MathUtils.smoothstep(amount, .8, 1));
      }
      if (hand.opposition && (!storyGrip || chin)) this.opposeThumb(hand, amount, closed[which][1]);
    }
    this.amounts[which] = amount;
    this.snapshots[which] = hand.bones.flatMap(joints => joints.flatMap(joint => this.skin.skeleton.bones[joint].quaternion.toArray()));
    return true;
  }

  private opposeThumb(hand: Hand, amount: number, indexPose: THREE.Quaternion[]): void {
    const data = hand.opposition!, bones = this.skin.skeleton.bones;
    const index = hand.bones[1].map(joint => bones[joint]);
    const radial = data.radial.clone().applyQuaternion(indexPose[0].clone().multiply(indexPose[1]).multiply(indexPose[2]));
    const target = index[0].position.clone().add(hand.axes[1][0].clone().applyQuaternion(indexPose[0]))
      .add(hand.axes[1][1].clone().applyQuaternion(indexPose[0].clone().multiply(indexPose[1])))
      .addScaledVector(radial, data.clearance);
    const thumb = hand.bones[0].map(joint => bones[joint]), rest = [hand.axes[0][0], hand.axes[0][1], data.pad];
    const lengths = rest.map(axis => axis.length()), along = target.sub(thumb[0].position), distance = along.length(); along.normalize();
    const outward = radial.clone().addScaledVector(along, -radial.dot(along)).normalize();
    const hinge = new THREE.Vector3().crossVectors(along, outward).normalize();
    // Couple MCP/IP flexion in the thumb's opposition plane. The endpoint
    // follows the curled index surface; the nail frame supplies the roll.
    // This avoids treating the thumb as three ordinary finger hinges.
    const end = (bend: number) => new THREE.Vector2(lengths[0] + lengths[1] * Math.cos(bend) + lengths[2] * Math.cos(bend * 1.65),
      lengths[1] * Math.sin(bend) + lengths[2] * Math.sin(bend * 1.65));
    let low = 0, high = THREE.MathUtils.degToRad(70);
    for (let i = 0; i < 24; i++) { const mid = (low + high) / 2; if (end(mid).length() > distance) low = mid; else high = mid; }
    const bend = (low + high) / 2, endpoint = end(bend), offset = endpoint.angle();
    const orientation = (axis: THREE.Vector3, nail: THREE.Vector3) => {
      const y = axis.clone().normalize(), z = nail.clone().addScaledVector(y, -nail.dot(y)).normalize();
      return new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(new THREE.Vector3().crossVectors(y, z), y, z));
    };
    let parent = new THREE.Quaternion();
    for (const [j, angle] of [0, bend, bend * 1.65].entries()) {
      const direction = along.clone().multiplyScalar(Math.cos(angle - offset)).addScaledVector(outward, -Math.sin(angle - offset));
      const nail = new THREE.Vector3().crossVectors(hinge, direction).normalize();
      const world = orientation(direction, nail).multiply(orientation(rest[j], data.nail).invert());
      thumb[j].quaternion.identity().slerp(parent.clone().invert().multiply(world), amount * amount);
      parent = world;
    }
  }

  update(): void {
    if (!this.enabled) return;
    const keys = this.binding.hands.map((hand, which) => {
      if ((this.connector || this.mouthCheck || this.chinSupport || this.guide || this.tracker || this.pistol) && which === 1) return undefined;
      const current = hand.bones.flatMap(joints => joints.flatMap(joint => this.skin.skeleton.bones[joint].quaternion.toArray()));
      const wrist = this.skin.skeleton.bones[hand.wrist];
      const pose = this.authored ? ['authored', this.pistol, this.tracker, ...current] : [this.amounts[which], this.storyGrips[which]];
      return this.authored || current.every((v, i) => v === this.snapshots[which][i])
        ? [...pose, ...wrist.quaternion.toArray(), ...wrist.position.toArray(), ...wrist.scale.toArray()].join(',') : undefined;
    });
    if (keys.some((v, i) => v !== this.previous[i]) || this.previous.length === 0) {
      for (const name of attributes) (this.output[name].array as Float32Array).set(this.base[name].array);
      this.rig.root.updateMatrixWorld(true);
      for (const [which, hand] of this.binding.hands.entries()) if (keys[which] !== undefined) this.deform(hand);
      for (const name of attributes) this.output[name].needsUpdate = true;
      this.previous = keys;
    }
    for (const name of attributes) this.skin.geometry.setAttribute(name, this.output[name]);
  }

  poseWetwall(): void {
    this.enabled = this.authored = true;
    this.update();
  }

  posePistol(): void {
    this.enabled = this.authored = this.pistol = true;
    this.update();
  }

  private shapeFingers(hand: Hand, inverse: THREE.Matrix4, transform: number[]): void {
    const skin = this.skin, data = this.scratch;
    const includeThumb = this.pistol || this.tracker;
    const key = (includeThumb ? hand.pistolCacheable : hand.cacheable) ? [this.pistol, this.tracker, ...hand.bones.flatMap(joints => joints.flatMap(joint => skin.skeleton.bones[joint].quaternion.toArray()))].join(',') : undefined;
    const cached = this.shapes.get(hand);
    // These material offsets live in wrist space. Reuse the articulation,
    // while deform still updates skinning and every face normal this frame.
    if (key !== undefined && cached?.key === key) {
      for (let ordinal = 0; ordinal < hand.vertices.length; ordinal++) {
        const at = ordinal * 15, offset = ordinal * 3;
        data[at + 3] += cached.delta[offset]; data[at + 4] += cached.delta[offset + 1]; data[at + 5] += cached.delta[offset + 2];
      }
      return;
    }
    const delta = key !== undefined ? cached?.delta ?? new Float64Array(hand.vertices.length * 3) : undefined;
    if (delta) {
      const weights = (this.pistol ? this.base : this.binding.attributes).skinWeight.array;
      // LBS adds wrist-space translation once, while its Float32 weights
      // need not sum to exactly one. Remove that pose-dependent rounding
      // term before caching the material shape, then apply it to current LBS.
      for (let ordinal = 0; ordinal < hand.vertices.length; ordinal++) {
        const at = ordinal * 15, offset = ordinal * 3, id = hand.vertices[ordinal] * 4;
        const excess = weights[id] + weights[id + 1] + weights[id + 2] + weights[id + 3] - 1;
        data[at + 3] = delta[offset] = data[at] + transform[12] * excess;
        data[at + 4] = delta[offset + 1] = data[at + 1] + transform[13] * excess;
        data[at + 5] = delta[offset + 2] = data[at + 2] + transform[14] * excess;
      }
    }
    const sample = { p: new THREE.Vector3(), t: new THREE.Vector3(), n: new THREE.Vector3(), k: 0 };
    const normal = new THREE.Vector3(), binormal = new THREE.Vector3(), goal = new THREE.Vector3();
    for (const [digit, finger] of hand.fingers.entries()) {
      if (digit === 0 && !includeThumb) continue;
      const points = finger.joints.map(j => new THREE.Vector3().setFromMatrixPosition(skin.skeleton.bones[j].matrixWorld).applyMatrix4(inverse));
      const caps = hand.caps[digit], tip = new THREE.Vector3();
      for (const id of caps) {
        const ordinal = hand.offsets.get(id)!, at = ordinal * (delta ? 3 : 15), base = delta ?? data;
        tip.x += base[at]; tip.y += base[at + 1]; tip.z += base[at + 2];
      }
      const curve = new HandCurve([...(finger.metacarpal ? [finger.metacarpal] : []), ...points, tip.divideScalar(caps.length)], finger.radius);
      for (const v of finger.vertices) {
        curve.sample(THREE.MathUtils.lerp(curve.anchors[v.interval - 1], curve.anchors[v.interval], v.u), sample);
        normal.set(0, 0, 1).addScaledVector(sample.t, -sample.t.z).normalize(); binormal.crossVectors(sample.t, normal);
        goal.copy(normal).multiplyScalar(v.n).addScaledVector(binormal, v.b).addScaledVector(sample.t, v.t);
        const inner = goal.dot(sample.n); goal.add(sample.p);
        if (inner > 0 && sample.k > 1e-8) goal.addScaledVector(sample.n, -Math.expm1(-sample.k * inner) / sample.k - inner);
        const ordinal = hand.offsets.get(v.id)!, at = ordinal * 15, offset = delta ? ordinal * 3 : at, base = delta ?? data;
        data[at + 3] += (goal.x - base[offset]) * v.amount;
        data[at + 4] += (goal.y - base[offset + 1]) * v.amount;
        data[at + 5] += (goal.z - base[offset + 2]) * v.amount;
      }
    }
    if (delta) {
      for (let ordinal = 0; ordinal < hand.vertices.length; ordinal++) {
        const at = ordinal * 15, offset = ordinal * 3;
        delta[offset] = data[at + 3] - delta[offset]; delta[offset + 1] = data[at + 4] - delta[offset + 1]; delta[offset + 2] = data[at + 5] - delta[offset + 2];
        data[at + 3] = data[at] + delta[offset]; data[at + 4] = data[at + 1] + delta[offset + 1]; data[at + 5] = data[at + 2] + delta[offset + 2];
      }
      this.shapes.set(hand, { key: key!, delta });
    }
  }

  private shapePalm(hand: Hand, frames: number[][], toWrist: THREE.Matrix4): void {
    if ((this.authored || this.storyGrips[hand.side === 'R' ? 0 : 1]) && !hand.fingers[1].metacarpal) return;
    // Linear skinning collapses the webs when the finger roots close across
    // the wrist. Blend rigid transforms there; the curved finger surfaces
    // still own the phalanges. Refined MCP spans also need that volume in
    // authored gestures; the blend fades before the distal prop-contact pads.
    const transforms = frames.map(elements => {
      const matrix = new THREE.Matrix4().multiplyMatrices(toWrist, new THREE.Matrix4().fromArray(elements)), rotation = new THREE.Quaternion().setFromRotationMatrix(matrix);
      const translation = new THREE.Vector3().setFromMatrixPosition(matrix);
      const dual = new THREE.Quaternion(translation.x, translation.y, translation.z, 0).multiply(rotation);
      return { rotation, dual };
    });
    const a = this.binding.attributes, point = new THREE.Vector3(), rotation = new THREE.Quaternion();
    for (const [ordinal, id] of hand.vertices.entries()) {
      const amount = hand.palm[ordinal];
      if (amount < 1e-6) continue;
      let reference = 0, maximum = 0;
      for (let k = 0; k < 4; k++) {
        const bone = a.skinIndex.getComponent(id, k), weight = a.skinWeight.getComponent(id, k);
        if (weight > maximum) { maximum = weight; reference = bone; }
      }
      let x = 0, y = 0, z = 0, w = 0, dx = 0, dy = 0, dz = 0, dw = 0;
      for (let k = 0; k < 4; k++) {
        const transform = transforms[a.skinIndex.getComponent(id, k)], q = transform.rotation, d = transform.dual;
        const weight = a.skinWeight.getComponent(id, k) * (q.dot(transforms[reference].rotation) < 0 ? -1 : 1);
        x += q.x * weight; y += q.y * weight; z += q.z * weight; w += q.w * weight;
        dx += d.x * weight; dy += d.y * weight; dz += d.z * weight; dw += d.w * weight;
      }
      const length = Math.hypot(x, y, z, w);
      x /= length; y /= length; z /= length; w /= length;
      dx /= length; dy /= length; dz /= length; dw /= length;
      rotation.set(x, y, z, w);
      point.fromBufferAttribute(a.position, id).applyQuaternion(rotation);
      point.x += dx * w - dw * x - dy * z + dz * y;
      point.y += dy * w - dw * y + dx * z - dz * x;
      point.z += dz * w - dw * z - dx * y + dy * x;
      const at = ordinal * 15;
      this.scratch[at + 3] += (point.x - this.scratch[at + 3]) * amount;
      this.scratch[at + 4] += (point.y - this.scratch[at + 4]) * amount;
      this.scratch[at + 5] += (point.z - this.scratch[at + 5]) * amount;
    }
  }

  private shapeNails(hand: Hand, frames: number[][], toWrist: THREE.Matrix4): void {
    const which = hand.side === 'R' ? 0 : 1;
    if (!hand.fistPose || this.authored || this.storyGrips[which]) return;
    const detail = this.skin.geometry.getAttribute('_nail_detail'), point = new THREE.Vector3();
    for (const [digit, caps] of hand.caps.entries()) {
      const frame = toWrist.clone().multiply(new THREE.Matrix4().fromArray(frames[hand.bones[digit][2]]));
      for (const id of caps) {
        const amount = THREE.MathUtils.smoothstep(detail.getX(id), .12, .88);
        if (!amount) continue;
        point.fromBufferAttribute(this.base.position, id).applyMatrix4(frame);
        const at = hand.offsets.get(id)! * 15 + 3;
        this.scratch[at] += (point.x - this.scratch[at]) * amount;
        this.scratch[at + 1] += (point.y - this.scratch[at + 1]) * amount;
        this.scratch[at + 2] += (point.z - this.scratch[at + 2]) * amount;
      }
    }
  }

  private deform(hand: Hand): void {
    const skin = this.skin, a = this.pistol ? this.base : this.binding.attributes, data = this.scratch;
    const sourcePosition = a.position.array, indices = a.skinIndex.array, weights = a.skinWeight.array;
    const outputPosition = this.output.position.array, outputNormal = this.output.normal.array;
    const outputIndices = this.output.skinIndex.array, outputWeights = this.output.skinWeight.array;
    const wrist = skin.skeleton.bones[hand.wrist], inverse = wrist.matrixWorld.clone().invert();
    const toWrist = inverse.clone().multiply(skin.matrixWorld), transform = toWrist.elements, back = toWrist.clone().invert().elements;
    const frames = skin.skeleton.bones.map((bone, j) => skin.bindMatrixInverse.clone().multiply(bone.matrixWorld).multiply(skin.skeleton.boneInverses[j]).multiply(skin.bindMatrix).elements);
    for (const [ordinal, id] of hand.vertices.entries()) {
      let aa = 0, b = 0, c = 0, d = 0, e = 0, f = 0, g = 0, h = 0, i = 0, x = 0, y = 0, z = 0;
      for (let k = 0; k < 4; k++) {
        const joint = indices[id * 4 + k], weight = weights[id * 4 + k], frame = frames[joint];
        aa += weight * frame[0]; b += weight * frame[4]; c += weight * frame[8];
        d += weight * frame[1]; e += weight * frame[5]; f += weight * frame[9];
        g += weight * frame[2]; h += weight * frame[6]; i += weight * frame[10];
        x += weight * frame[12]; y += weight * frame[13]; z += weight * frame[14];
        outputIndices[id * 4 + k] = joint; outputWeights[id * 4 + k] = weight;
      }
      const at = ordinal * 15, px = sourcePosition[id * 3], py = sourcePosition[id * 3 + 1], pz = sourcePosition[id * 3 + 2];
      const mx = aa * px + b * py + c * pz + x, my = d * px + e * py + f * pz + y, mz = g * px + h * py + i * pz + z;
      data[at] = data[at + 3] = transform[0] * mx + transform[4] * my + transform[8] * mz + transform[12];
      data[at + 1] = data[at + 4] = transform[1] * mx + transform[5] * my + transform[9] * mz + transform[13];
      data[at + 2] = data[at + 5] = transform[2] * mx + transform[6] * my + transform[10] * mz + transform[14];
      const det = aa * (e * i - f * h) - b * (d * i - f * g) + c * (d * h - e * g);
      data[at + 6] = (e * i - f * h) / det; data[at + 7] = (c * h - b * i) / det; data[at + 8] = (b * f - c * e) / det;
      data[at + 9] = (f * g - d * i) / det; data[at + 10] = (aa * i - c * g) / det; data[at + 11] = (c * d - aa * f) / det;
      data[at + 12] = (d * h - e * g) / det; data[at + 13] = (b * g - aa * h) / det; data[at + 14] = (aa * e - b * d) / det;
    }
    this.shapeFingers(hand, inverse, transform);
    this.shapePalm(hand, frames, toWrist);
    this.shapeNails(hand, frames, toWrist);
    const which = hand.side === 'R' ? 0 : 1;
    for (const correction of [hand.thumbCorrection, hand.fistCorrection]) if (correction && !this.authored && !this.storyGrips[which]) {
      const amount = THREE.MathUtils.smoothstep(this.amounts[which], correction.startGrip, 1);
      for (const [i, id] of correction.vertices.entries()) {
        const at = hand.offsets.get(id)! * 15 + 3;
        data[at] += correction.offsets[i * 3] * amount;
        data[at + 1] += correction.offsets[i * 3 + 1] * amount;
        data[at + 2] += correction.offsets[i * 3 + 2] * amount;
      }
    }
    const curve = hand.fistTissueCurve;
    if (curve && !this.authored && !this.storyGrips[which]) {
      const grip = this.amounts[which];
      let hi = curve.grips.findIndex(value => value >= grip);
      if (hi < 0) hi = curve.grips.length - 1;
      const lo = Math.max(0, hi - 1), span = curve.grips[hi] - curve.grips[lo], t = span ? (grip - curve.grips[lo]) / span : 0;
      const a = 2 * t ** 3 - 3 * t ** 2 + 1, b = (t ** 3 - 2 * t ** 2 + t) * span;
      const c = -2 * t ** 3 + 3 * t ** 2, d = (t ** 3 - t ** 2) * span;
      for (const [i, id] of curve.vertices.entries()) {
        const at = hand.offsets.get(id)! * 15 + 3;
        for (let axis = 0; axis < 3; axis++) {
          const component = i * 3 + axis;
          data[at + axis] += a * curve.offsets[lo][component] + b * curve.slopes[lo][component]
            + c * curve.offsets[hi][component] + d * curve.slopes[hi][component];
        }
      }
    }
    const normals = this.normals; normals.fill(0);
    const triangles = hand.triangles;
    for (let face = 0; face < triangles.length; face += 6) {
      const p = triangles[face], q = triangles[face + 2], r = triangles[face + 4];
      const ux = data[q] - data[p], uy = data[q + 1] - data[p + 1], uz = data[q + 2] - data[p + 2];
      const vx = data[r] - data[p], vy = data[r + 1] - data[p + 1], vz = data[r + 2] - data[p + 2];
      const nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
      for (let corner = face + 1; corner < face + 6; corner += 2) {
        const group = triangles[corner]; normals[group] += nx; normals[group + 1] += ny; normals[group + 2] += nz;
      }
    }
    for (const [ordinal, id] of hand.vertices.entries()) {
      const at = ordinal * 15, dx = data[at + 3] - data[at], dy = data[at + 4] - data[at + 1], dz = data[at + 5] - data[at + 2];
      const mx = back[0] * dx + back[4] * dy + back[8] * dz, my = back[1] * dx + back[5] * dy + back[9] * dz, mz = back[2] * dx + back[6] * dy + back[10] * dz;
      outputPosition[id * 3] = sourcePosition[id * 3] + data[at + 6] * mx + data[at + 7] * my + data[at + 8] * mz;
      outputPosition[id * 3 + 1] = sourcePosition[id * 3 + 1] + data[at + 9] * mx + data[at + 10] * my + data[at + 11] * mz;
      outputPosition[id * 3 + 2] = sourcePosition[id * 3 + 2] + data[at + 12] * mx + data[at + 13] * my + data[at + 14] * mz;
      const group = this.binding.groups[id] * 3, nx = normals[group], ny = normals[group + 1], nz = normals[group + 2];
      const tx = back[0] * nx + back[4] * ny + back[8] * nz, ty = back[1] * nx + back[5] * ny + back[9] * nz, tz = back[2] * nx + back[6] * ny + back[10] * nz;
      const x = data[at + 6] * tx + data[at + 7] * ty + data[at + 8] * tz, y = data[at + 9] * tx + data[at + 10] * ty + data[at + 11] * tz, z = data[at + 12] * tx + data[at + 13] * ty + data[at + 14] * tz;
      const length = Math.sqrt(x * x + y * y + z * z) || 1;
      outputNormal[id * 3] = x / length; outputNormal[id * 3 + 1] = y / length; outputNormal[id * 3 + 2] = z / length;
    }
  }

  dispose(): void { this.begin(); this.shapes.clear(); this.geometries.forEach(geometry => geometry.dispose()); }
}
