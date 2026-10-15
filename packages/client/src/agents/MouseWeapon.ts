import * as THREE from 'three';

// Visual prop based on the film firing still and John Bowring's archived
// production interview: the hand sits inside a broad cylinder, with the barrel
// above it. These are game-space silhouette proportions, not a working design.
export function createMouseWeapon(material: THREE.Material): THREE.Group {
  const gun = new THREE.Group(); gun.userData.mouseFilmWeapon = true;
  const add = (name: string, geometry: THREE.BufferGeometry, x: number, y: number, z: number) => {
    const mesh = new THREE.Mesh(geometry, material); mesh.name = name; mesh.position.set(x, y, z);
    mesh.castShadow = mesh.receiveShadow = true; gun.add(mesh); return mesh;
  };
  const box = (name: string, x: number, y: number, z: number, w: number, h: number, d: number) => {
    const mesh = add(name, new THREE.BoxGeometry(1, 1, 1), x, y, z); mesh.scale.set(w, h, d); return mesh;
  };
  const tube = (outer: number, inner: number, length: number) => new THREE.LatheGeometry([
    new THREE.Vector2(inner, -length / 2), new THREE.Vector2(outer, -length / 2),
    new THREE.Vector2(outer, length / 2), new THREE.Vector2(inner, length / 2),
    new THREE.Vector2(inner, -length / 2),
  ], 40);
  box('mouse-weapon-receiver', 0, -.24, -.18, .16, .60, .12);
  add('mouse-weapon-barrel', tube(.047, .027, 1.16), 0, -1.12, -.18);
  // Preserve the delivered anatomical hand contact frame and the shared grip
  // fixture's first four parts. The cylinder is hollow around these fingers.
  box('mouse-weapon-grip', 0, -.09, .13, .105, .18, .27);
  box('mouse-weapon-trigger', 0, -.25, .08, .08, .1, .06);
  add('mouse-weapon-drum', tube(.325, .205, .34), 0, -.09, .13);
  for (const y of [-.26, -.215, .035, .08])
    add('mouse-weapon-drum-rim', tube(.336, .205, .018), 0, y, .13);
  add('mouse-weapon-barrel-sleeve', tube(.077, .047, .25), 0, -.55, -.18);
  for (const y of [-.70, -1.59]) add('mouse-weapon-barrel-band', tube(.057, .047, .035), 0, y, -.18);
  for (const y of [-.39, -1.52]) box('mouse-weapon-sight', 0, y, -.244, .025, .05, .035);
  const muzzle = new THREE.Object3D(); muzzle.name = 'mouse-weapon-muzzle';
  muzzle.position.set(0, -1.70, -.18); gun.add(muzzle);
  return gun;
}
