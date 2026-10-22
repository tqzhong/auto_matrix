import * as THREE from 'three';
import { intersection } from './hand-self-contact.mjs';

interface Face { points: THREE.Vector3[]; box: THREE.Box3; center: THREE.Vector3; side: THREE.Side; mesh: THREE.SkinnedMesh; ids: number[] }
interface Tree { box: THREE.Box3; faces?: Face[]; children?: Tree[] }

function branch(faces: Face[]): Tree {
  const box = faces.reduce((box, face) => box.union(face.box), new THREE.Box3());
  if (faces.length <= 12) return { box, faces };
  const size = box.getSize(new THREE.Vector3()), axis = size.x > size.y && size.x > size.z ? 'x' : size.y > size.z ? 'y' : 'z';
  faces.sort((a, b) => a.center[axis] - b.center[axis]); const middle = Math.floor(faces.length / 2);
  return { box, children: [branch(faces.slice(0, middle)), branch(faces.slice(middle))] };
}

/** Bake the displayed patient and hands, including the Float32 precision used by rendering. */
export function patientSurface(body: THREE.Object3D, space: THREE.Object3D) {
  const faces: Face[] = [], meshes: THREE.Mesh[] = [], inverse = space.matrixWorld.clone().invert();
  body.traverseVisible(object => {
    if (!(object instanceof THREE.SkinnedMesh) || !object.userData.patientBody && (object.material as THREE.Material).name !== 'Skin') return;
    const geometry = new THREE.BufferGeometry(), source = object.geometry.attributes.position, data = new THREE.Float32BufferAttribute(new Float32Array(source.count * 3), 3);
    for (let i = 0; i < source.count; i++) {
      const point = object.getVertexPosition(i, new THREE.Vector3());
      if (!Number.isFinite(point.x) || !Number.isFinite(point.y) || !Number.isFinite(point.z)) throw new Error(`${object.name} has invalid skin at vertex ${i}`);
      data.setXYZ(i, point.x, point.y, point.z);
    }
    geometry.setAttribute('position', data); geometry.setIndex(object.geometry.index); geometry.computeBoundingBox(); geometry.computeBoundingSphere();
    const mesh = new THREE.Mesh(geometry, object.material); mesh.matrixWorld.copy(object.matrixWorld); meshes.push(mesh);
    const matrix = inverse.clone().multiply(object.matrixWorld), points = Array.from({ length: data.count }, (_, i) => new THREE.Vector3().fromBufferAttribute(data, i).applyMatrix4(matrix));
    const index = geometry.index!;
    for (let i = 0; i < index.count; i += 3) {
      const ids = [0, 1, 2].map(k => index.getX(i + k)), triangle = ids.map(i => points[i]), box = new THREE.Box3().setFromPoints(triangle);
      faces.push({ points: triangle, box, center: box.getCenter(new THREE.Vector3()), side: (object.material as THREE.Material).side, mesh: object, ids });
    }
  });
  return { tree: branch(faces), meshes, triangles: faces.length, dispose: () => meshes.forEach(mesh => mesh.geometry.dispose()) };
}

export function segmentHitsSkin(root: Tree, from: THREE.Vector3, to: THREE.Vector3, epsilon = .002): boolean {
  const delta = to.clone().sub(from), length = delta.length(), ray = new THREE.Ray(from, delta.divideScalar(length));
  const box = new THREE.Box3().setFromPoints([from, to]), point = new THREE.Vector3();
  const visit = (node: Tree): boolean => {
    if (!box.intersectsBox(node.box) || !ray.intersectsBox(node.box)) return false;
    if (node.children) return node.children.some(visit);
    return node.faces!.some(face => {
      if (!box.intersectsBox(face.box)) return false;
      const p = face.side === THREE.BackSide ? face.points.slice().reverse() : face.points;
      const hit = ray.intersectTriangle(p[0], p[1], p[2], face.side !== THREE.DoubleSide, point);
      return Boolean(hit && hit.distanceTo(from) > epsilon && hit.distanceTo(from) < length - epsilon);
    });
  };
  return visit(root);
}

/** Check every mesh triangle against the displayed skin. */
export function skinIntersection(root: Tree, tube: THREE.Mesh, space: THREE.Object3D) {
  const matrix = space.matrixWorld.clone().invert().multiply(tube.matrixWorld), p = tube.geometry.attributes.position, index = tube.geometry.index!;
  for (let i = 0; i < index.count; i += 3) {
    const points = [0, 1, 2].map(k => new THREE.Vector3().fromBufferAttribute(p, index.getX(i + k)).applyMatrix4(matrix)), box = new THREE.Box3().setFromPoints(points);
    let contacted: Face | undefined;
    const visit = (node: Tree): number => {
      if (!box.intersectsBox(node.box)) return 0;
      if (node.children) { for (const child of node.children) { const line = visit(child); if (line > 1e-5) return line; } return 0; }
      for (const face of node.faces!) if (box.intersectsBox(face.box)) { const line = intersection(points, face.points); if (line > 1e-5) { contacted = face; return line; } }
      return 0;
    };
    const line = visit(root);
    if (line > 1e-5) {
      const face = contacted!, weights = face.mesh.geometry.attributes.skinWeight, joints = face.mesh.geometry.attributes.skinIndex;
      const bones = [...new Set(face.ids.flatMap(vertex => [0, 1, 2, 3].filter(k => weights.getComponent(vertex, k) > .2).map(k => face.mesh.skeleton.bones[joints.getComponent(vertex, k)].name)))];
      return { triangle: i / 3, line, points: points.map(point => point.toArray()), skin: { mesh: face.mesh.name, bones, points: face.points.map(point => point.toArray()) } };
    }
  }
  return undefined;
}
