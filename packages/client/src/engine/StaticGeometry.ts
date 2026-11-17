import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

/** Batch fixed siblings, keeping their animated parent and material unchanged. */
export function batchStaticGeometry(root: THREE.Object3D, movable: ReadonlySet<THREE.Mesh>, recursive = true): THREE.BufferGeometry[] {
  const geometries: THREE.BufferGeometry[] = [];
  const visit = (parent: THREE.Object3D) => {
    for (const geometry of batchSiblings(parent, movable, !recursive)) if (geometry) geometries.push(geometry);
  };
  if (recursive) root.traverse(visit); else visit(root);
  return geometries;
}

export function* batchStaticGeometryInFrames(root: THREE.Object3D, movable: ReadonlySet<THREE.Mesh>): Generator<THREE.BufferGeometry | undefined> {
  const parents: THREE.Object3D[] = [];
  root.traverse(parent => { if (parent.children.length) parents.push(parent); });
  for (const parent of parents) yield* batchSiblings(parent, movable, false, true);
}

function* batchSiblings(parent: THREE.Object3D, movable: ReadonlySet<THREE.Mesh>, retainSiblings: boolean,
  staged = false): Generator<THREE.BufferGeometry | undefined> {
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
    const parts: THREE.BufferGeometry[] = [];
    let geometry: THREE.BufferGeometry;
    try {
      for (const mesh of batch) {
        const part = mesh.geometry.clone().applyMatrix4(mesh.matrix); part.clearGroups(); parts.push(part);
        if (staged && parts.length % 64 === 0) yield;
      }
      geometry = mergeGeometries(parts)!;
    } finally { parts.forEach(part => part.dispose()); }
    const first = batch[0], mesh = new THREE.Mesh(geometry, first.material);
    mesh.castShadow = first.castShadow; mesh.receiveShadow = first.receiveShadow; mesh.renderOrder = first.renderOrder; mesh.layers.mask = first.layers.mask;
    if (retainSiblings && import.meta.env?.DEV) mesh.userData.unbatchedSiblings = batch;
    parent.remove(...batch); parent.add(mesh);
    yield geometry;
  }
}
