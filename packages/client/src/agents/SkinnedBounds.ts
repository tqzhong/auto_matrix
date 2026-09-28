import * as THREE from 'three';

/** Bound each bone's influenced vertices once, then move only those bounds.
 * Nonnegative, normalized skin weights keep the posed vertices in the combined box.
 * Updating after world matrices includes later weapon gestures and works for
 * the player, reflection and shadow cameras without changing mesh visibility. */
export function enableSkinnedCulling(root: THREE.Object3D): void {
  const targets: { mesh: THREE.SkinnedMesh; parts: { bone: THREE.Bone; box: THREE.Box3 }[] }[] = [];
  const point = new THREE.Vector3();
  root.traverse(object => {
    if (!(object instanceof THREE.SkinnedMesh)) return;
    const mesh = object; const { position, skinIndex, skinWeight } = mesh.geometry.attributes;
    const boxes = mesh.skeleton.bones.map(() => new THREE.Box3());
    const transforms = mesh.skeleton.boneInverses.map(inverse => inverse.clone().multiply(mesh.bindMatrix));
    for (let i = 0; i < position.count; i++) for (let joint = 0; joint < 4; joint++) {
      if (skinWeight.getComponent(i, joint) === 0) continue;
      const index = skinIndex.getComponent(i, joint);
      boxes[index].expandByPoint(point.fromBufferAttribute(position, i).applyMatrix4(transforms[index]));
    }
    // These existing shaders move vertices before skinning: the scanned shirt
    // hem, opened office shirt and sealed lips. Carry their full displacement
    // through the bind transform, including any rotation or scale.
    const material = mesh.material as THREE.Material;
    const padding = /Black.crew.neck/i.test(mesh.name) ? .4 : material.name === 'Office cotton' ? .3 : material.name === 'Skin' ? .1 : 0;
    if (padding) for (let i = 0; i < boxes.length; i++) if (!boxes[i].isEmpty()) {
      const offset = new THREE.Box3(new THREE.Vector3(-padding, -padding, -padding), new THREE.Vector3(padding, padding, padding));
      offset.applyMatrix4(transforms[i]).getSize(point).multiplyScalar(.5); boxes[i].expandByVector(point);
    }
    const parts = boxes.flatMap((box, i) => box.isEmpty() ? [] : [{ bone: mesh.skeleton.bones[i], box }]);
    mesh.boundingBox = new THREE.Box3(); mesh.boundingSphere = new THREE.Sphere(); mesh.frustumCulled = true;
    targets.push({ mesh, parts });
  });
  const transformed = new THREE.Box3(); const matrix = new THREE.Matrix4();
  const update = root.updateMatrixWorld.bind(root);
  root.updateMatrixWorld = force => {
    update(force);
    for (const { mesh, parts } of targets) {
      if (!mesh.visible) continue;
      const box = mesh.boundingBox!; box.makeEmpty();
      for (const part of parts) {
        matrix.multiplyMatrices(mesh.bindMatrixInverse, part.bone.matrixWorld);
        box.union(transformed.copy(part.box).applyMatrix4(matrix));
      }
      // Neo's silver front displaces vertices by at most .043 in mesh space.
      box.expandByScalar(.05); box.getBoundingSphere(mesh.boundingSphere!);
    }
  };
  root.updateMatrixWorld(true);
}
