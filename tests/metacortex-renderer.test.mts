import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { FILM_SETS, METACORTEX, OFFICE_CONTACT, OFFICE_WINDOW, type FilmJourney, type MetacortexLift } from '@auto_matrix/shared';
import { VoxelRenderer } from '../packages/client/src/engine/VoxelRenderer.js';
import { OfficeSetRenderer } from '../packages/client/src/engine/OfficeSetRenderer.js';
import { UrbanMaterials } from '../packages/client/src/engine/UrbanMaterials.js';

test('the shared tower has an unobstructed lobby, moving car, open upper floor and a real city beyond the escape window', t => {
  t.mock.method(THREE.TextureLoader.prototype, 'load', () => new THREE.Texture());
  t.mock.method(GLTFLoader.prototype, 'loadAsync', () => new Promise(() => {}));
  t.mock.method(UrbanMaterials.prototype, 'facade', () => new THREE.MeshStandardMaterial());
  const original = globalThis.document;
  globalThis.document = { createElement: () => ({ getContext: () => ({ fillRect() {}, fillText() {}, strokeRect() {} }) }) } as unknown as Document;
  const scene = new THREE.Scene(), city = new VoxelRenderer(scene); city.init();
  const root = new THREE.Group(); const office = FILM_SETS.film_metacortex_floor; root.position.set(office.center.x, office.center.y - 1, office.center.z); scene.add(root);
  const renderer = new OfficeSetRenderer(root, office); city.showOfficeInterior(true);
  const meshes: THREE.Object3D[] = []; scene.traverse(object => { if (object instanceof THREE.Mesh) meshes.push(object); });
  const hits = (from: THREE.Vector3, direction: THREE.Vector3, far: number) => {
    scene.updateMatrixWorld(true); return new THREE.Raycaster(from, direction.normalize(), 0, far).intersectObjects(meshes, false);
  };
  try {
    const car = scene.getObjectByName('metacortex-elevator-car')!; assert.ok(car);
    const floor = hits(new THREE.Vector3(1150.73, 68, 832.19), new THREE.Vector3(0, -1, 0), 4)
      .filter(hit => Math.abs(hit.point.y - METACORTEX.upper) < .001);
    assert.equal(floor.length, 1, 'the occupied floor must not z-fight with a city building cap at the same height');
    const parcel = scene.getObjectByName('parcel-phone')!.parent!;
    const furniture = meshes.filter(mesh => { for (let p: THREE.Object3D | null = mesh; p; p = p.parent) if (p === parcel) return false; return true; });
    for (const dx of [-.37, .37]) for (const dz of [-1.8, -.85, -.3, .48]) {
      const origin = new THREE.Vector3(office.center.x + OFFICE_CONTACT.parcelX + dx, office.center.y + 4, office.center.z + OFFICE_CONTACT.parcelZ + dz);
      const obstruction = new THREE.Raycaster(origin, new THREE.Vector3(0, -1, 0), 0, 2.48).intersectObjects(furniture, false);
      assert.equal(obstruction.length, 0, 'the closed parcel and its open flap need clearance from the keyboard and CRT case');
    }
    assert.equal(hits(new THREE.Vector3(1140, 3, 867), new THREE.Vector3(0, 0, -1), 67).length, 0, 'the street, lobby and open car share one clear walkable approach');
    const frame = hits(new THREE.Vector3(1145.1, 4, 867), new THREE.Vector3(0, 0, -1), 10);
    assert.ok(frame[0].point.z > 860.28, 'metal door trim must stand in front of the glass panel instead of z-fighting on the same plane');
    const lift: MetacortexLift = { floor: 0, target: 1, phase: 'travel', elapsed: 4.5, passenger: { x: 1140, z: 798 } };
    city.interiors.update(9500, { x: 1140, y: 33.5, z: 798 }, { lift } as never);
    assert.equal(car.position.y, 32.5);
    assert.ok(hits(new THREE.Vector3(1140, 35, 798), new THREE.Vector3(0, 0, 1), 6).length, 'closed car doors enclose the moving passenger');
    lift.floor = 1; lift.phase = 'idle'; lift.elapsed = 0;
    city.interiors.update(9500, { x: 1140, y: 66, z: 798 }, { lift } as never);
    assert.equal(car.position.y, METACORTEX.upper);
    assert.equal(hits(new THREE.Vector3(1140, 68, 798), new THREE.Vector3(0, 0, 1), 17).length, 0, 'the arrival car opens into the actual office, with no facade or decorative elevator blocking it');
    assert.equal(hits(new THREE.Vector3(1140, 60, 798), new THREE.Vector3(0, 1, 0), 4).length, 0, 'the shaft is not capped by the building shell');
    const journey = { scene: 'm1_office_escape', completed: [], office: { window: OFFICE_WINDOW.seconds } } as unknown as FilmJourney;
    renderer.update(journey);
    assert.equal(hits(new THREE.Vector3(1116, 69.5, 800), new THREE.Vector3(-1, 0, 0), 3.5).length, 0);
    const outside = hits(new THREE.Vector3(1113.1, 70, 800), new THREE.Vector3(-1, -.3, .6), 180);
    assert.ok(outside.length && outside[0].point.x < 1100, 'the open window looks onto a collidable city tower');
    const canyon = hits(new THREE.Vector3(1110.2, 70, 862), new THREE.Vector3(-110.2, 5, 58), 200);
    assert.ok(canyon.length && canyon[0].point.y > 60 && canyon[0].point.z > 900, 'the scaffold route looks down the real city canyon');
    const street = hits(new THREE.Vector3(1120, 200, 880), new THREE.Vector3(0, -1, 0), 210);
    assert.ok(street.length && street[0].point.y < 1, 'the street below the office remains open');
  } finally { renderer.dispose(); city.dispose(); globalThis.document = original; }
});
