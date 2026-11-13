import * as THREE from 'three';
import { FILM_SETS, OPENING_HOTEL, type Vector3 } from '@auto_matrix/shared';

export const PISTOL_MAGAZINE_Y = -.24;
export const openingHotelPistolRotation = new THREE.Quaternion().setFromEuler(new THREE.Euler(0, 2.35, -Math.PI / 2, 'YXZ'));

export function openingHotelPistolRest(fallen: Vector3): THREE.Vector3 {
  const { center, width } = FILM_SETS.film_heart_hotel, x = fallen.x - center.x, z = fallen.z - center.z;
  const { roomCarpet, hallCarpet, woodFloor } = OPENING_HOTEL;
  const floors = [roomCarpet, hallCarpet, { ...woodFloor, width: width - woodFloor.wallInset }];
  const top = floors.reduce((height, floor) => Math.abs(x) <= floor.width / 2 && Math.abs(z - floor.z) <= floor.depth / 2
    ? Math.max(height, floor.bottom + floor.height) : height, 0);
  // The pistol lies on its slide side, .075 above the surface it touches.
  return new THREE.Vector3(fallen.x, center.y - 1 + top + .076, fallen.z);
}

export function openingHotelPistolLowering(progress: number): number {
  const smooth = THREE.MathUtils.smoothstep;
  return smooth(progress, 0, .23) * (1 - smooth(progress, .78, 1));
}

export function createHelPistol(material: THREE.Material): THREE.Group {
  const gun = new THREE.Group(); gun.userData.helPistol = true;
  const box = (name: string, x: number, y: number, z: number, w: number, h: number, d: number) => {
    const part = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), material);
    part.name = name; part.position.set(x, y, z); part.scale.set(w, h, d); gun.add(part); return part;
  };
  box('hel-pistol-slide', 0, .065, .16, .15, .14, .5);
  const barrel = new THREE.Mesh(new THREE.CylinderGeometry(.042, .042, .08, 16), material);
  barrel.position.set(0, .065, .435); barrel.rotation.x = Math.PI / 2; gun.add(barrel);
  box('hel-pistol-grip', 0, -.1, -.025, .08, .27, .13).rotation.x = .12;
  box('hel-pistol-magazine', 0, PISTOL_MAGAZINE_Y, -.04, .09, .025, .135);
  const guard = new THREE.Mesh(new THREE.TorusGeometry(.075, .012, 8, 20), material);
  guard.position.set(0, -.035, .09); guard.rotation.y = Math.PI / 2; guard.scale.y = .56; gun.add(guard);
  box('hel-pistol-trigger', 0, -.045, .055, .025, .07, .026).rotation.x = -.2;
  for (const z of [-.045, .35]) box('hel-pistol-sight', 0, .145, z, .035, .025, .04);
  return gun;
}
