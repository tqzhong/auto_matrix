import * as THREE from 'three';

export interface UplinkContact { point: THREE.Vector3; normal: THREE.Vector3 }
interface SurfaceAnchor { mesh: THREE.SkinnedMesh; ids: number[]; weights: THREE.Vector3; outward: number }
interface UplinkSurfaces { seat: UplinkContact[]; back: UplinkContact[]; ports: UplinkContact[] }

/** Contacts on the delivered costume; no assumed head or chest heights. */
export class MachineUplinkContacts {
  private anchors = new WeakMap<THREE.Object3D, { upper: THREE.SkinnedMesh; trousers: THREE.SkinnedMesh; geometry: THREE.BufferGeometry; trouserGeometry: THREE.BufferGeometry; back: SurfaceAnchor[]; ports: SurfaceAnchor[]; bones: THREE.Bone[] }>();
  private frames = new WeakMap<THREE.Object3D, { upperMesh: THREE.SkinnedMesh; trousersMesh: THREE.SkinnedMesh; upper: THREE.BufferGeometry; trousers: THREE.BufferGeometry; matrices: number[]; result: UplinkSurfaces }>();
  private underside = new WeakMap<THREE.SkinnedMesh, { geometry: THREE.BufferGeometry; ids: number[] }>();
  private vertices: THREE.Vector3[] = [];

  private anchor(mesh: THREE.SkinnedMesh, bone: THREE.Bone, offset: THREE.Vector3): SurfaceAnchor | undefined {
    // Select the same rest-pose triangle on warm and cold loads. Choosing a
    // nearest triangle on the first animated frame would make saves differ.
    const index = mesh.skeleton.bones.indexOf(bone);
    const bind = mesh.bindMatrix.clone().invert().multiply(mesh.skeleton.boneInverses[index].clone().invert());
    const material = new THREE.MeshBasicMaterial({ side: THREE.DoubleSide });
    const reference = new THREE.Mesh(mesh.geometry, material); reference.updateMatrixWorld(true);
    const direction = new THREE.Vector3(0, 0, 1).transformDirection(bind);
    const origin = offset.clone().applyMatrix4(bind);
    const hit = new THREE.Raycaster(origin, direction).intersectObject(reference)[0];
    material.dispose();
    if (!hit?.face) return;
    const ids = [hit.face.a, hit.face.b, hit.face.c], points = ids.map(id => new THREE.Vector3().fromBufferAttribute(mesh.geometry.attributes.position, id));
    const weights = new THREE.Triangle(...points as [THREE.Vector3, THREE.Vector3, THREE.Vector3]).getBarycoord(hit.point, new THREE.Vector3());
    if (!weights) return;
    const outward = new THREE.Triangle(...points as [THREE.Vector3, THREE.Vector3, THREE.Vector3]).getNormal(new THREE.Vector3()).dot(direction) < 0 ? 1 : -1;
    return { mesh, ids, weights, outward };
  }

  private surface(anchor: SurfaceAnchor): UplinkContact {
    const points = anchor.ids.map(id => anchor.mesh.localToWorld(anchor.mesh.getVertexPosition(id, new THREE.Vector3())));
    return {
      point: points[0].clone().multiplyScalar(anchor.weights.x).addScaledVector(points[1], anchor.weights.y).addScaledVector(points[2], anchor.weights.z),
      normal: new THREE.Triangle(...points as [THREE.Vector3, THREE.Vector3, THREE.Vector3]).getNormal(new THREE.Vector3()).multiplyScalar(anchor.outward),
    };
  }

  private undersideVertices(mesh: THREE.SkinnedMesh, upper: boolean): number[] {
    const cached = this.underside.get(mesh); if (cached?.geometry === mesh.geometry) return cached.ids;
    const pelvis = mesh.skeleton.bones.findIndex(bone => bone.name === 'pelvis');
    const bind = mesh.bindMatrix.clone().invert().multiply(mesh.skeleton.boneInverses[pelvis].clone().invert());
    const waist = new THREE.Vector3().setFromMatrixPosition(bind), position = mesh.geometry.attributes.position, ids: number[] = [];
    // Only the rear waist/hem can enter the two saddles. Arms and trouser legs
    // are outside their horizontal footprint throughout this saved sitting pose.
    // Full visible-mesh collision regressions cover the complete transition.
    for (let i = 0; i < position.count; i++) if (Math.abs(position.getX(i) - waist.x) < .5 && position.getZ(i) < waist.z + .16
      && (upper ? position.getY(i) < waist.y + .25 : position.getY(i) > waist.y - .5)) ids.push(i);
    this.underside.set(mesh, { geometry: mesh.geometry, ids }); return ids;
  }

  sample(subject: THREE.Object3D): UplinkSurfaces | undefined {
    const upper = subject.getObjectByName('Tailored_coat_upper'), trousers = subject.getObjectByName('Tailored_trousers');
    const chest = subject.getObjectByName('chest'), pelvis = subject.getObjectByName('pelvis');
    if (!(upper instanceof THREE.SkinnedMesh) || !(trousers instanceof THREE.SkinnedMesh) || !(chest instanceof THREE.Bone) || !pelvis) return;
    // updateWorldMatrix alone bypasses SkinnedMesh's bind-inverse override.
    // The film set runs before the first WebGL draw on a cold saved frame.
    subject.updateWorldMatrix(true, false); subject.updateMatrixWorld(true);
    upper.skeleton.update(); trousers.skeleton.update();
    let anchors = this.anchors.get(subject);
    if (!anchors || anchors.upper !== upper || anchors.trousers !== trousers || anchors.geometry !== upper.geometry || anchors.trouserGeometry !== trousers.geometry) {
      const back: SurfaceAnchor[] = [], ports: SurfaceAnchor[] = [];
      for (const y of [-.3, .24]) {
        const support = this.anchor(upper, chest, new THREE.Vector3(0, y, -2));
        if (support) back.push(support);
      }
      for (const side of [-1, 1]) {
        for (const y of [-.38, -.05, .24]) {
          const port = this.anchor(upper, chest, new THREE.Vector3(side * .34, y, -2));
          if (port) ports.push(port);
        }
      }
      const bones = new Set<THREE.Bone>();
      for (const mesh of [upper, trousers]) {
        const ids = [...this.undersideVertices(mesh, mesh === upper), ...(mesh === upper ? [...back, ...ports].flatMap(anchor => anchor.ids) : [])];
        const indices = mesh.geometry.attributes.skinIndex, weights = mesh.geometry.attributes.skinWeight;
        for (const id of ids) for (let i = 0; i < 4; i++) if (weights.getComponent(id, i) > 0) bones.add(mesh.skeleton.bones[indices.getComponent(id, i)]);
      }
      anchors = { upper, trousers, geometry: upper.geometry, trouserGeometry: trousers.geometry, back, ports, bones: [...bones] }; this.anchors.set(subject, anchors);
    }
    const matrices = [...upper.matrixWorld.elements, ...trousers.matrixWorld.elements, ...anchors.bones.flatMap(bone => bone.matrixWorld.elements)];
    const previous = this.frames.get(subject);
    if (previous && previous.upperMesh === upper && previous.trousersMesh === trousers && previous.upper === upper.geometry && previous.trousers === trousers.geometry
      && previous.matrices.length === matrices.length && matrices.every((value, i) => Math.abs(value - previous.matrices[i]) < 1e-9)) return previous.result;
    // Fit each saddle below the outer trouser/knit surface across its whole
    // footprint. A ray through the trousers alone would cut the lower hem.
    const origin = pelvis.getWorldPosition(new THREE.Vector3()), seat: UplinkContact[] = [];
    const rear = new THREE.Vector3(0, 0, -.14).transformDirection(subject.matrixWorld).multiplyScalar(.14);
    let count = 0;
    for (const mesh of [trousers, upper]) for (const i of this.undersideVertices(mesh, mesh === upper)) {
      const point = this.vertices[count] ??= new THREE.Vector3(); count++;
      mesh.localToWorld(mesh.getVertexPosition(i, point));
    }
    for (const side of [-1, 1]) {
      const center = origin.clone().add(rear); center.x += side * .22;
      let height = Infinity;
      for (let i = 0; i < count; i++) {
        const point = this.vertices[i];
        const radial = ((point.x - center.x) / .22) ** 2 + ((point.z - center.z) / .2) ** 2;
        if (radial < 1) height = Math.min(height, point.y - .075 * Math.sqrt(1 - radial) - .005);
      }
      if (Number.isFinite(height)) { center.y = height + .08; seat.push({ point: center, normal: new THREE.Vector3(0, -1, 0) }); }
    }
    const result = { seat, back: anchors.back.map(anchor => this.surface(anchor)), ports: anchors.ports.map(anchor => this.surface(anchor)) };
    this.frames.set(subject, { upperMesh: upper, trousersMesh: trousers, upper: upper.geometry, trousers: trousers.geometry, matrices, result }); return result;
  }
}
