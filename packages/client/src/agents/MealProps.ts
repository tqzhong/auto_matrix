import * as THREE from 'three';

export const MEAL_BOWL_PROFILE = [[0, 0], [.18, 0], [.235, .027], [.285, .142], [.32, .272], [.319, .282], [.306, .282], [.271, .147], [.22, .042], [0, .022]];

/** Stamped metal tableware, with actual cavities instead of solid cylinders. */
export function createMealBowl(name: string): THREE.Group {
  const root = new THREE.Group(); root.name = name;
  const metal = new THREE.MeshStandardMaterial({ color: 0x747e7b, metalness: .82, roughness: .53, side: THREE.DoubleSide });
  const shell = new THREE.Mesh(new THREE.LatheGeometry(MEAL_BOWL_PROFILE.map(p => new THREE.Vector2(p[0], p[1])), 48), metal); shell.name = 'meal-bowl-shell'; root.add(shell);
  const food = new THREE.Mesh(new THREE.CylinderGeometry(.279, .279, .026, 48), new THREE.MeshStandardMaterial({ color: 0xb5b5a6, roughness: .98 }));
  food.name = 'meal-protein-surface'; food.position.y = .212; root.add(food);
  const lumps = new THREE.InstancedMesh(new THREE.SphereGeometry(.015, 6, 4), food.material, 53); lumps.name = 'meal-protein-grain';
  const matrix = new THREE.Matrix4();
  for (let i = 0; i < lumps.count; i++) {
    const angle = i * 2.39996323, radius = Math.sqrt((i + .5) / lumps.count) * .25;
    matrix.compose(new THREE.Vector3(Math.cos(angle) * radius, .227, Math.sin(angle) * radius), new THREE.Quaternion(), new THREE.Vector3(1, .35 + (i % 4) * .12, .7));
    lumps.setMatrixAt(i, matrix);
  }
  root.add(lumps); root.traverse(object => { if (object instanceof THREE.Mesh) object.castShadow = object.receiveShadow = true; });
  return root;
}

export const MEAL_SPOON_TIP = new THREE.Vector3(0, .29, 0);

export function createMealSpoon(name: string): THREE.Group {
  const root = new THREE.Group(); root.name = name;
  const metal = new THREE.MeshStandardMaterial({ color: 0xa7b3b1, metalness: .92, roughness: .25, side: THREE.DoubleSide });
  const handle = new THREE.Mesh(new THREE.CapsuleGeometry(.013, .22, 6, 12), metal); handle.name = 'meal-spoon-handle'; root.add(handle);
  const neck = new THREE.Mesh(new THREE.CylinderGeometry(.012, .013, .11, 12), metal); neck.position.y = .175; root.add(neck);
  const bowl = new THREE.Mesh(new THREE.SphereGeometry(.04, 24, 12, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2), metal);
  bowl.name = 'meal-spoon-bowl'; bowl.scale.set(1, .38, 1.55); bowl.rotation.x = Math.PI / 2; bowl.position.copy(MEAL_SPOON_TIP); root.add(bowl);
  const bite = new THREE.Mesh(new THREE.SphereGeometry(.035, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2), new THREE.MeshStandardMaterial({ color: 0xb5b5a6, roughness: .98 }));
  bite.name = 'meal-spoon-food'; bite.scale.set(1, .36, 1.35); bite.rotation.x = Math.PI / 2; bite.position.copy(MEAL_SPOON_TIP).z += .005; bite.visible = false; root.add(bite);
  root.traverse(object => { if (object instanceof THREE.Mesh) object.castShadow = object.receiveShadow = true; });
  return root;
}
