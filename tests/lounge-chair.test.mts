import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from 'three';
import { CONSTRUCT, CONSTRUCT_FURNITURE, FILM_SETS, PILL_ROOM, filmBlocked, filmPosition } from '@auto_matrix/shared';
import { createLoungeChair } from '../packages/client/src/engine/LoungeChair.js';

test('the wingback upholstery has deep tufted cushions and a closed padded rear', () => {
  const leather = new THREE.MeshStandardMaterial();
  const chair = createLoungeChair(leather); chair.updateMatrixWorld(true);
  const ray = new THREE.Raycaster();
  const surface = (x: number, z: number, direction: number) => {
    ray.set(new THREE.Vector3(x, 1.348, z), new THREE.Vector3(0, 0, direction)); ray.far = 6;
    const hit = ray.intersectObject(chair, true)[0];
    assert.ok(hit, 'both faces of the lower back cushion must be closed'); return hit.point.z;
  };
  try {
    const button = surface(0, 3, -1), cushion = surface(.204, 3, -1);
    assert.ok(cushion - button > .12, `the visible tuft must indent the actual cushion, rather than dot a flat shell: ${cushion - button}`);
    const rear = surface(.204, -3, 1);
    assert.ok(cushion - rear > .33, `side views need a padded shell rather than a thin card: ${cushion - rear}`);
  } finally {
    const geometries = new Set<THREE.BufferGeometry>(), materials = new Set<THREE.Material>([leather]);
    chair.traverse(object => { if (object instanceof THREE.Mesh) { geometries.add(object.geometry); materials.add(object.material); } });
    geometries.forEach(geometry => geometry.dispose()); materials.forEach(material => material.dispose());
  }
});

test('the thick Lafayette chair backs block walking while leaving the post-pill exit open', () => {
  const leather = new THREE.MeshStandardMaterial(); const chair = createLoungeChair(leather);
  try {
    for (const side of [-1, 1]) {
      chair.position.set(side * PILL_ROOM.seat, -1, PILL_ROOM.z); chair.rotation.y = -side * Math.PI / 2; chair.updateMatrixWorld(true);
      const bounds = new THREE.Box3().setFromObject(chair); const rear = side < 0 ? bounds.min.x : bounds.max.x;
      assert.equal(filmBlocked(filmPosition('film_lafayette', rear - side * .025, PILL_ROOM.z), FILM_SETS.film_lafayette, .05), true,
        'the player must not enter the visible padded rear outside the old collision box');
      assert.equal(filmBlocked(filmPosition('film_lafayette', rear + side * .7, PILL_ROOM.z), FILM_SETS.film_lafayette, .56), false,
        'the chair must not block empty space behind its actual padded shell');
    }
    for (let x = PILL_ROOM.exit.x; x <= PILL_ROOM.seat; x += .1) {
      assert.equal(filmBlocked(filmPosition('film_lafayette', x, PILL_ROOM.exit.z), FILM_SETS.film_lafayette, .56), false,
        'the automatic sidestep must still exit into freely walkable space');
    }
  } finally {
    const geometries = new Set<THREE.BufferGeometry>(), materials = new Set<THREE.Material>([leather]);
    chair.traverse(object => { if (object instanceof THREE.Mesh) { geometries.add(object.geometry); materials.add(object.material); } });
    geometries.forEach(geometry => geometry.dispose()); materials.forEach(material => material.dispose());
  }
});

test('the shared Construct chair footprint contains the rebuilt padded rear', () => {
  const leather = new THREE.MeshStandardMaterial(); const chair = createLoungeChair(leather);
  try {
    chair.position.set(CONSTRUCT.chairX.neo, 0, CONSTRUCT.chair.z); chair.rotation.y = Math.PI; chair.updateMatrixWorld(true);
    const bounds = new THREE.Box3().setFromObject(chair); const footprint = CONSTRUCT_FURNITURE[0];
    assert.ok(bounds.min.x >= footprint.x - footprint.width / 2 && bounds.max.x <= footprint.x + footprint.width / 2);
    assert.ok(bounds.min.z >= footprint.z - footprint.depth / 2 && bounds.max.z <= footprint.z + footprint.depth / 2,
      'reusing the model in the Construct must not retain the old thin rear footprint');
  } finally {
    const geometries = new Set<THREE.BufferGeometry>(), materials = new Set<THREE.Material>([leather]);
    chair.traverse(object => { if (object instanceof THREE.Mesh) { geometries.add(object.geometry); materials.add(object.material); } });
    geometries.forEach(geometry => geometry.dispose()); materials.forEach(material => material.dispose());
  }
});
