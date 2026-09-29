import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

/** Batch fixed siblings, keeping their animated parent and material unchanged. */
export function batchStaticGeometry(root: THREE.Object3D, movable: ReadonlySet<THREE.Mesh>): THREE.BufferGeometry[] {
  const geometries: THREE.BufferGeometry[] = [];
  root.traverse(parent => {
    const batches = new Map<string, THREE.Mesh[]>();
    for (const child of parent.children) {
      if (!(child instanceof THREE.Mesh) || child instanceof THREE.SkinnedMesh || child instanceof THREE.InstancedMesh
        || !child.visible || !child.frustumCulled || child.name || child.children.length || movable.has(child)
        || Array.isArray(child.material) || child.material.transparent || Object.keys(child.geometry.morphAttributes).length) continue;
      child.updateMatrix();
      if (child.matrix.determinant() <= 0) continue;
      const geometry: THREE.BufferGeometry = child.geometry;
      const attributes = Object.entries(geometry.attributes).map(([name, value]) => `${name}:${value.itemSize}:${value.normalized}:${value.array.constructor.name}`).sort().join(',');
      const key = `${child.material.uuid}:${Boolean(geometry.index)}:${attributes}:${child.castShadow}:${child.receiveShadow}:${child.renderOrder}:${child.layers.mask}`;
      const batch = batches.get(key) ?? []; batch.push(child); batches.set(key, batch);
    }
    for (const batch of batches.values()) {
      if (batch.length < 2) continue;
      const parts = batch.map(mesh => { const part = mesh.geometry.clone().applyMatrix4(mesh.matrix); part.clearGroups(); return part; });
      const geometry = mergeGeometries(parts)!; parts.forEach(part => part.dispose()); geometries.push(geometry);
      const first = batch[0]; const mesh = new THREE.Mesh(geometry, first.material);
      mesh.castShadow = first.castShadow; mesh.receiveShadow = first.receiveShadow; mesh.renderOrder = first.renderOrder; mesh.layers.mask = first.layers.mask;
      parent.remove(...batch); parent.add(mesh);
    }
  });
  return geometries;
}
