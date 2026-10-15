import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import type { CharacterRig } from './CharacterModel.js';
import { reach } from './SpoonPerformance.js';
import { enableSkinnedCulling } from './SkinnedBounds.js';

export interface OracleParkHand {
  root: THREE.Object3D;
  wrist: THREE.Object3D;
  skin: THREE.SkinnedMesh;
  bones: THREE.Bone[][];
  pads: THREE.Vector3[];
  connection: { mesh: THREE.Mesh; edge: number[]; signature?: string; forearm?: { skin: THREE.SkinnedMesh; edge: number[] } };
}

interface Entry { fallback: THREE.Object3D[]; skin: THREE.Material; active: boolean; loading: boolean; }

/** Kitchen and park performances share the same five-finger anatomy. */
export class OracleParkHands {
  private entries = new Map<CharacterRig, Entry>();
  private geometries = new Set<THREE.BufferGeometry>();
  private materials = new Set<THREE.Material>();
  private skeletons = new Set<THREE.Skeleton>();
  private disposed = false;

  track(rig: CharacterRig, skin: THREE.Material): void {
    const fallback: THREE.Object3D[] = [];
    for (const side of ['R', 'L']) {
      const wrist = rig.root.getObjectByName(`oracle-hand-${side}`)!;
      for (const object of wrist.children) if (!object.name.startsWith('oracle-last-')) fallback.push(object);
    }
    this.entries.set(rig, { fallback, skin, active: false, loading: false });
  }

  update(rig: CharacterRig, active: boolean): void {
    const entry = this.entries.get(rig); if (!entry) return;
    entry.active = active;
    if (active && !entry.loading) {
      entry.loading = true;
      this.load(rig, entry).catch(error => console.warn('Oracle park hand anatomy could not load; retaining the existing hands.', error));
    }
    const visible = active && Boolean(rig.parkHands);
    entry.fallback.forEach(object => { object.visible = !visible; });
    rig.parkHands?.forEach(hand => {
      hand.root.visible = visible;
      hand.connection.mesh.visible = visible;
      hand.bones.flat().forEach(bone => bone.quaternion.identity());
    });
  }

  private async load(rig: CharacterRig, entry: Entry): Promise<void> {
    const asset = await new GLTFLoader().loadAsync('/assets/characters/oracle-park-hands.glb');
    const hands = ['R', 'L'].map(side => {
      const root = asset.scene.getObjectByName(`oracle-anatomical-hand-${side}`)!;
      const skin = root.getObjectByName(`oracle-hand-skin-${side}`) as THREE.SkinnedMesh;
      this.materials.add(skin.material as THREE.Material);
      const hand = createAnatomicalHand(root, rig.root.getObjectByName(`oracle-hand-${side}`)!, entry.skin, side);
      this.geometries.add(skin.geometry); this.geometries.add(hand.connection.mesh.geometry); this.skeletons.add(skin.skeleton);
      return hand;
    });
    if (this.disposed) { this.release(); return; }
    rig.parkHands = hands;
    hands.forEach((hand, i) => { hand.wrist.add(hand.root); rig.elbows[i].add(hand.connection.mesh); enableSkinnedCulling(hand.root); });
    this.update(rig, entry.active);
    connectGardenWrists(rig);
  }

  private release(): void {
    this.geometries.forEach(value => value.dispose()); this.geometries.clear();
    this.materials.forEach(value => value.dispose()); this.materials.clear();
    this.skeletons.forEach(value => value.dispose()); this.skeletons.clear();
  }
  dispose(): void { this.disposed = true; this.entries.clear(); this.release(); }
}

/** Reuse the shipped hand topology, digit pads and open wrist rim for a second actor. */
export function createAnatomicalHand(root: THREE.Object3D, wrist: THREE.Object3D, material: THREE.Material, side: string): OracleParkHand {
  const skin = root.getObjectByName(`oracle-hand-skin-${side}`) as THREE.SkinnedMesh;
  skin.material = material; skin.castShadow = skin.receiveShadow = true;
  const bones = Array.from({ length: 5 }, (_, digit) => Array.from({ length: 3 }, (_, segment) =>
    root.getObjectByName(`finger${digit + 1}-${segment + 1}_${side}`) as THREE.Bone));
  const pads = bones.map(chain => {
    const index = skin.skeleton.bones.indexOf(chain[2]), pad = new THREE.Vector3(); let count = 0;
    const { position, skinIndex, skinWeight } = skin.geometry.attributes;
    for (let i = 0; i < position.count; i++) for (let j = 0; j < 4; j++) {
      if (skinIndex.getComponent(i, j) !== index || skinWeight.getComponent(i, j) < .95) continue;
      pad.add(new THREE.Vector3().fromBufferAttribute(position, i).applyMatrix4(skin.bindMatrix).applyMatrix4(skin.skeleton.boneInverses[index])); count++;
    }
    return pad.divideScalar(count);
  });
  // Weld UV splits before finding the anatomical wrist's single open rim.
  const position = skin.geometry.attributes.position, index = skin.geometry.index!;
  const welded = new Map<string, number>(), unique: number[] = [], edges = new Map<string, { a: number; b: number; count: number }>();
  for (let i = 0; i < position.count; i++) {
    const key = [position.getX(i), position.getY(i), position.getZ(i)].map(value => Math.round(value * 1e5)).join(':');
    if (!welded.has(key)) welded.set(key, i); unique.push(welded.get(key)!);
  }
  for (let i = 0; i < index.count; i += 3) for (let part = 0; part < 3; part++) {
    const a = unique[index.getX(i + part)], b = unique[index.getX(i + (part + 1) % 3)], key = [Math.min(a, b), Math.max(a, b)].join(':');
    const existing = edges.get(key); if (existing) existing.count++; else edges.set(key, { a, b, count: 1 });
  }
  const rim = new Map<number, number[]>();
  for (const { a, b, count } of edges.values()) if (count === 1) {
    rim.set(a, [...rim.get(a) ?? [], b]); rim.set(b, [...rim.get(b) ?? [], a]);
  }
  const edge = [rim.keys().next().value!];
  while (edge.length < rim.size) edge.push(rim.get(edge.at(-1)!)!.find(next => !edge.includes(next))!);
  const area = edge.reduce((sum, vertex, i) => sum + position.getX(vertex) * position.getZ(edge[(i + 1) % edge.length])
    - position.getZ(vertex) * position.getX(edge[(i + 1) % edge.length]), 0);
  if (area > 0) edge.reverse();
  const geometry = new THREE.BufferGeometry(), indices: number[] = [], uv: number[] = [], columns = edge.length + 1;
  for (let row = 0; row <= 6; row++) for (let column = 0; column < columns; column++) {
    uv.push(column / edge.length, row / 6);
    if (row < 6 && column < edge.length) { const i = row * columns + column; indices.push(i, i + 1, i + columns, i + 1, i + columns + 1, i + columns); }
  }
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(new Float32Array(columns * 7 * 3), 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); geometry.setIndex(indices);
  const mesh = new THREE.Mesh(geometry, material); mesh.name = `oracle-wrist-connection-${side}`;
  mesh.castShadow = mesh.receiveShadow = true;
  return { root, skin, wrist, bones, pads, connection: { mesh, edge } };
}

/** Join the cut hand to its bare forearm or the skin inside a cuff. */
export function connectGardenWrists(rig: CharacterRig, hands = rig.parkHands): void {
  if (!hands) return;
  rig.root.updateWorldMatrix(true, true);
  for (const [side, hand] of hands.entries()) {
    const { mesh, edge } = hand.connection; if (!mesh.visible) continue;
    hand.skin.updateMatrixWorld(true);
    const inverse = mesh.parent!.matrixWorld.clone().invert(), matrix = inverse.clone().multiply(hand.skin.matrixWorld);
    const anatomicalBody = hands === rig.spoonHands ? 'spoon_boy-anatomical-body' : rig.oracleFirstBody?.visible ? 'oracle-first-anatomical-body' : undefined;
    if (hand.connection.forearm && hand.connection.forearm.skin.name !== anatomicalBody) {
      hand.connection.forearm = undefined; hand.connection.signature = undefined;
    }
    if (anatomicalBody && !hand.connection.forearm) {
      const skin = rig.root.getObjectByName(anatomicalBody) as THREE.SkinnedMesh | undefined;
      if (skin) {
        const p = skin.geometry.attributes.position, index = skin.geometry.index!, welded = new Map<string, number>(), unique: number[] = [];
        const edges = new Map<string, { a: number; b: number; count: number }>();
        for (let i = 0; i < p.count; i++) {
          const key = [p.getX(i), p.getY(i), p.getZ(i)].map(v => Math.round(v * 1e5)).join(':');
          if (!welded.has(key)) welded.set(key, i); unique.push(welded.get(key)!);
        }
        for (let i = 0; i < index.count; i += 3) for (let j = 0; j < 3; j++) {
          const a = unique[index.getX(i + j)], b = unique[index.getX(i + (j + 1) % 3)], key = [Math.min(a, b), Math.max(a, b)].join(':');
          const current = edges.get(key); if (current) current.count++; else edges.set(key, { a, b, count: 1 });
        }
        const rim = new Set<number>();
        for (const e of edges.values()) if (e.count === 1 && [e.a, e.b].every(i => p.getY(i) < 2.1 && (side ? p.getX(i) > .3 : p.getX(i) < -.3))) {
          rim.add(e.a); rim.add(e.b);
        }
        hand.connection.forearm = { skin, edge: [...rim] };
      }
    }
    const forearm = hand.connection.forearm;
    // SkinnedMesh refreshes its attached bind inverse in updateMatrixWorld;
    // updateWorldMatrix alone leaves the previous root position in that inverse.
    forearm?.skin.updateMatrixWorld(true);
    forearm?.skin.skeleton.update();
    const anchors = forearm?.edge.map(i => forearm.skin.localToWorld(forearm.skin.getVertexPosition(i, new THREE.Vector3())).applyMatrix4(inverse));
    const signature = matrix.elements.join(':') + (anchors?.map(p => p.toArray().join(':')).join(':') ?? '');
    if (hand.connection.signature === signature) continue;
    hand.skin.skeleton.update();
    const points = edge.map(index => hand.skin.getVertexPosition(index, new THREE.Vector3()).applyMatrix4(matrix));
    const center = points.reduce((sum, point) => sum.add(point), new THREE.Vector3()).divideScalar(points.length);
    const end = anchors ? anchors.reduce((sum, p) => sum.add(p), new THREE.Vector3()).divideScalar(anchors.length) : new THREE.Vector3(0, -.50, 0);
    const outline = anchors?.map(p => ({ point: p, angle: Math.atan2(p.x - end.x, p.z - end.z) })).sort((a, b) => a.angle - b.angle);
    const up = new THREE.Vector3(0, 1, 0).transformDirection(matrix);
    const curve = new THREE.CubicBezierCurve3(center, center.clone().addScaledVector(up, .065), end.clone().add(new THREE.Vector3(0, -.06, 0)), end);
    const vertices = mesh.geometry.attributes.position, columns = edge.length + 1;
    for (let row = 0; row <= 6; row++) for (let column = 0; column < columns; column++) {
      const t = row / 6, offset = points[column % edge.length].clone().sub(center), angle = Math.atan2(offset.x, offset.z);
      let target = new THREE.Vector3(Math.sin(angle) * .083, 0, Math.cos(angle) * .079);
      if (outline) {
        const at = angle < outline[0].angle ? angle + Math.PI * 2 : angle;
        let i = 0; while (i + 1 < outline.length && outline[i + 1].angle <= at) i++;
        const a = outline[i], b = outline[(i + 1) % outline.length];
        const next = i === outline.length - 1 ? b.angle + Math.PI * 2 : b.angle;
        target = a.point.clone().lerp(b.point, (at - a.angle) / (next - a.angle)).sub(end);
      }
      offset.lerp(target, t);
      const point = curve.getPoint(t).add(offset); vertices.setXYZ(row * columns + column, point.x, point.y, point.z);
    }
    vertices.needsUpdate = true; mesh.geometry.computeVertexNormals();
    const normals = mesh.geometry.attributes.normal, normalMatrix = new THREE.Matrix3().getNormalMatrix(matrix);
    for (let column = 0; column < columns; column++) {
      const normal = new THREE.Vector3().fromBufferAttribute(hand.skin.geometry.attributes.normal, edge[column % edge.length]).applyNormalMatrix(normalMatrix);
      normals.setXYZ(column, normal.x, normal.y, normal.z);
    }
    for (let row = 1; row <= 6; row++) {
      const first = row * columns, last = first + edge.length;
      const normal = new THREE.Vector3().fromBufferAttribute(normals, first).add(new THREE.Vector3().fromBufferAttribute(normals, last)).normalize();
      normals.setXYZ(first, normal.x, normal.y, normal.z); normals.setXYZ(last, normal.x, normal.y, normal.z);
    }
    normals.needsUpdate = true; mesh.geometry.computeBoundingSphere(); hand.connection.signature = signature;
  }
}

/** Close around the handle using the original finger lengths and actual distal skin. */
export function holdGardenHandle(rig: CharacterRig, bag: THREE.Object3D, side: number, amount = 1, raised = 1): void {
  const hand = rig.parkHands?.[side]; if (!hand) return;
  const sign = side ? -1 : 1, center = new THREE.Vector3(sign * .115, -.205, 0);
  const handle = bag.getObjectByName('oracle-handbag-handle--0.11') as THREE.Mesh<THREE.TubeGeometry>;
  const path = handle.geometry.parameters.path, t = side ? .64 : .36;
  const tangent = path.getTangent(t).normalize().multiplyScalar(sign);
  const x = new THREE.Vector3(0, -sign, 0).addScaledVector(tangent, sign * tangent.y).normalize();
  const y = new THREE.Vector3().crossVectors(tangent, x).normalize();
  const frame = new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(x, y, tangent));
  const base = bag.getWorldQuaternion(new THREE.Quaternion()).multiply(frame);
  const original = hand.wrist.getWorldPosition(new THREE.Vector3()), scale = hand.wrist.getWorldScale(new THREE.Vector3());
  const body = rig.root.getWorldQuaternion(new THREE.Quaternion());
  const local = new THREE.Quaternion(), orientation = new THREE.Quaternion();
  let roll = sign * Math.PI / 2 * (1 - raised);
  // The grip may rotate around the handle. Align it to the solved forearm
  // instead of locking the palm flat while the elbow lifts underneath it.
  for (let solve = 0; solve < 6; solve++) {
    const twist = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), roll);
    local.copy(frame).multiply(twist); orientation.copy(base).multiply(twist);
    const target = bag.localToWorld(path.getPoint(t)).sub(center.clone().multiply(scale).applyQuaternion(orientation));
    const approach = original.clone().lerp(target, amount).add(new THREE.Vector3(0, 0, Math.sin(Math.PI * amount) * .5).applyQuaternion(body));
    reach(rig.shoulders[side], rig.elbows[side], hand.wrist.position, approach,
      new THREE.Vector3(-sign * .4, -.7, -.2).applyQuaternion(body));
    const arm = hand.wrist.getWorldPosition(new THREE.Vector3()).sub(rig.elbows[side].getWorldPosition(new THREE.Vector3())).applyQuaternion(base.clone().invert());
    const desired = THREE.MathUtils.clamp(sign * Math.atan2(arm.x, -arm.y), -1.45, 1.6) * sign;
    roll = THREE.MathUtils.lerp(roll, desired, .75);
  }
  const rotation = rig.elbows[side].getWorldQuaternion(new THREE.Quaternion()).invert().multiply(orientation);
  hand.wrist.quaternion.identity().slerp(rotation, amount);
  hand.bones.forEach((chain, digit) => {
    const base = chain[0].position, first = chain[1].position, second = chain[2].position, pad = hand.pads[digit];
    // Each finger wraps a different part of the curved leather, not an
    // imaginary straight cylinder through the middle of the palm.
    const inverse = local.clone().invert(), anchor = path.getPoint(t);
    const section = (u: number) => path.getPoint(u).sub(anchor).applyQuaternion(inverse).add(center);
    let u = t;
    for (let sample = 0; sample < 5; sample++) {
      const point = section(u), derivative = (section(u + .001).z - section(u - .001).z) / .002;
      u = THREE.MathUtils.clamp(u + (base.z - point.z) / derivative, .15, .85);
    }
    const grip = section(u);
    // The shorter ring/little fingers contact the lower arc. Forcing all
    // fingertips to the far side exceeds their reach and cuts through it.
    const [dx, dy, tx, ty] = [[-.014, .045, .4, -.92], [.03897, -.0225, .5, .866], [.05196, -.03, .866, .5],
      [.0225, -.039, .866, .5], [-.03464, -.02, .866, -.5]][digit];
    const direction = new THREE.Vector3(sign * tx, ty, 0).normalize();
    const end = new THREE.Vector3(grip.x + sign * dx, grip.y + dy, base.z)
      .addScaledVector(direction, -pad.length());
    const axis = end.clone().sub(base), a = first.length(), b = second.length();
    const length = THREE.MathUtils.clamp(axis.length(), .001, a + b - .001); axis.normalize();
    end.copy(base).addScaledVector(axis, length);
    const along = (a * a - b * b + length * length) / (2 * length);
    const bend = new THREE.Vector3(sign, digit ? -1 : 1, 0); bend.addScaledVector(axis, -bend.dot(axis)).normalize();
    const hinge = base.clone().addScaledVector(axis, along).addScaledVector(bend, Math.sqrt(Math.max(0, a * a - along * along)));
    const parent = new THREE.Quaternion();
    [hinge.clone().sub(base), end.clone().sub(hinge), direction].forEach((desired, index) => {
      const rotation = new THREE.Quaternion().setFromUnitVectors([first, second, pad][index].clone().normalize(), desired.normalize());
      chain[index].quaternion.identity().slerp(parent.clone().invert().multiply(rotation), amount); parent.copy(rotation);
    });
  });
  hand.wrist.updateWorldMatrix(true, true);
}
