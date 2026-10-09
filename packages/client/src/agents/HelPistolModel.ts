import * as THREE from 'three';

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
  box('hel-pistol-magazine', 0, -.24, -.04, .09, .025, .135);
  const guard = new THREE.Mesh(new THREE.TorusGeometry(.075, .012, 8, 20), material);
  guard.position.set(0, -.055, .09); guard.rotation.y = Math.PI / 2; gun.add(guard);
  box('hel-pistol-trigger', 0, -.045, .055, .025, .07, .026).rotation.x = -.2;
  for (const z of [-.045, .35]) box('hel-pistol-sight', 0, .145, z, .035, .025, .04);
  return gun;
}
