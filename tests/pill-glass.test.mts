import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from 'three';
import { createPillGlass } from '../packages/client/src/agents/PillPerformance.js';

test('a distant pill glass avoids a room-wide transmission pass while close and zoomed views keep refraction', () => {
  const glass = createPillGlass(); const camera = new THREE.PerspectiveCamera(48, 16 / 9);
  glass.position.set(4736.42, 86.03, 4408.8); glass.updateMatrixWorld(true);
  const drawn = () => {
    const materials: THREE.Material[] = [];
    glass.traverseVisible(object => { if (object instanceof THREE.Mesh) materials.push(object.material as THREE.Material); });
    return materials;
  };
  const view = (distance: number, zoom = 1) => {
    camera.zoom = zoom; camera.position.copy(glass.position).add(new THREE.Vector3(0, 0, distance)); camera.updateMatrixWorld(true);
    glass.traverse(object => { if (object instanceof THREE.LOD) object.update(camera); });
  };
  try {
    view(16);
    assert.ok(drawn().every(material => !(material instanceof THREE.MeshPhysicalMaterial) || material.transmission === 0),
      'a tiny distant cup must not request another opaque render of the entire room');
    view(3);
    assert.equal(drawn().filter(material => material instanceof THREE.MeshPhysicalMaterial && material.transmission > .8).length, 2,
      'both the glass and water keep refraction at drinking distance');
    view(30, 10);
    assert.equal(drawn().filter(material => material instanceof THREE.MeshPhysicalMaterial && material.transmission > .8).length, 2,
      'zooming into the cup needs the close-up materials even from farther away');
    for (const material of drawn()) if (material instanceof THREE.MeshStandardMaterial) assert.equal(material.transparent, true);
  } finally {
    const geometries = new Set<THREE.BufferGeometry>(), materials = new Set<THREE.Material>();
    glass.traverse(object => { if (object instanceof THREE.Mesh) { geometries.add(object.geometry); materials.add(object.material as THREE.Material); } });
    geometries.forEach(geometry => geometry.dispose()); materials.forEach(material => material.dispose());
  }
});
