import * as THREE from 'three';

/** Give the ship knit its own drape without changing the donor used by the other costumes. */
export function fitShipKnit(mesh: THREE.SkinnedMesh): THREE.BufferGeometry {
  const geometry = mesh.geometry.clone(), a = geometry.attributes;
  const changed: number[] = [];
  for (let i = 0; i < a.position.count; i++) {
    const x = a.position.getX(i), y = a.position.getY(i), z = a.position.getZ(i);
    const torso = [0, 1, 2, 3].reduce((sum, k) => sum + (/^(pelvis|spine|chest)$/.test(mesh.skeleton.bones[a.skinIndex.getComponent(i, k)].name) ? a.skinWeight.getComponent(i, k) : 0), 0);
    const drape = THREE.MathUtils.smoothstep(torso, .65, .98) * THREE.MathUtils.smoothstep(y, 2.95, 3.1)
      * (1 - THREE.MathUtils.smoothstep(y, 3.48, 3.73)) * THREE.MathUtils.smoothstep(z, .28, .36)
      * (1 - THREE.MathUtils.smoothstep(Math.abs(x), .34, .42));
    // A loose front bridges the sternum and the underside of the pectorals.
    // A smooth maximum avoids a hard lighting ridge where it meets the source.
    const fold = .006 * Math.sin(y * 24 + x * 9) * Math.exp(-(((y - 3.14) / .25) ** 2));
    const chest = (.475 - .5 * (y - 3.2) ** 2 + fold) * Math.sqrt(Math.max(0, 1 - (x / .76) ** 2));
    const difference = chest - z, rounded = Math.max(.025 - Math.abs(difference), 0) ** 2 / .1;
    const offset = (Math.max(0, difference) + rounded) * drape;
    if (offset <= 0) continue;
    a.position.setZ(i, z + offset); changed.push(i);
  }
  // Preserve authored sleeve, neck and hem normals; only redrape the torso.
  const originalNormals = a.normal.clone(); geometry.computeVertexNormals();
  const fittedNormals = a.normal.clone(); (a.normal as THREE.BufferAttribute).copy(originalNormals as THREE.BufferAttribute);
  const groups = new Map<string, number[]>();
  for (const i of changed) {
    const key = [a.position.getX(i), a.position.getY(i), a.position.getZ(i)].map(n => n.toFixed(6)).join(',');
    let list = groups.get(key); if (!list) groups.set(key, list = []); list.push(i);
  }
  for (const ids of groups.values()) {
    const normal = new THREE.Vector3();
    for (const i of ids) normal.add(new THREE.Vector3().fromBufferAttribute(fittedNormals, i));
    normal.normalize(); for (const i of ids) a.normal.setXYZ(i, normal.x, normal.y, normal.z);
  }
  geometry.computeBoundingBox(); geometry.computeBoundingSphere();
  return geometry;
}
