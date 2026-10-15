import * as THREE from 'three';
import { CREW_MEAL, crewMealPose, type FilmJourney } from '@auto_matrix/shared';
import { createMealBowl, createMealSpoon } from '../agents/MealProps.js';
import { disposeConsoleProp } from '../agents/ConsoleJug.js';

function visibleOwner(object?: THREE.Object3D): boolean {
  if (!object) return false;
  for (let parent: THREE.Object3D | null = object; parent; parent = parent.parent) if (!parent.visible) return false;
  return true;
}

/** The table uses the shared contact layout, including saved prop handoffs. */
export class CrewMealRenderer {
  private root = new THREE.Group();
  private bowl = createMealBowl('neb-neo-protein-bowl');
  private spoon = createMealSpoon('neb-neo-spoon');
  private lamp = new THREE.PointLight(0xd6e1df, 0, 15, 2);

  constructor(parent: THREE.Group) {
    this.root.name = 'neb-crew-meal-scene'; this.root.visible = false; parent.add(this.root);
    const metal = new THREE.MeshStandardMaterial({ color: 0x5a6664, metalness: .65, roughness: .77 });
    const strip = new THREE.Mesh(new THREE.BoxGeometry(2.9, .012, 8.1), metal);
    strip.name = 'neb-meal-table-runner'; strip.position.set(-8, CREW_MEAL.table.height + .006, 22); this.root.add(strip);
    for (const [index, [role, seat]] of Object.entries(CREW_MEAL.seats).entries()) {
      const place = new THREE.Group(); place.name = `neb-meal-place-setting-${index}`;
      place.position.set(seat.x + Math.sin(seat.yaw) * 1.4, CREW_MEAL.table.height + .012, seat.z); this.root.add(place);
      if (role === 'neo') continue;
      place.add(createMealBowl(`neb-${role}-protein-bowl`));
      const spoon = createMealSpoon(`neb-${role}-spoon`); spoon.position.set(0, CREW_MEAL.spoon.y - CREW_MEAL.table.height, -.5);
      spoon.rotation.set(-Math.PI / 2, 0, Math.PI); place.add(spoon);
    }
    this.root.add(this.bowl, this.spoon);
    const pot = createMealBowl('neb-meal-communal-pot'); pot.position.set(-12.2, 1.1, 22); pot.scale.setScalar(1.5); this.root.add(pot);
    const tray = new THREE.Mesh(new THREE.BoxGeometry(1.1, .06, 1.2), metal); tray.name = 'neb-protein-serving-tray'; tray.position.set(-12.2, 1.07, 22); this.root.add(tray);
    for (const [index, [x, z]] of [[-.43, -.48], [.43, -.48], [-.43, .48], [.43, .48]].entries()) {
      const leg = new THREE.Mesh(new THREE.BoxGeometry(.08, 1.04, .08), metal); leg.name = `neb-serving-stand-leg-${index}`;
      leg.position.set(tray.position.x + x, .52, tray.position.z + z); this.root.add(leg);
    }
    for (const [index, z] of [-.48, .48].entries()) {
      const brace = new THREE.Mesh(new THREE.BoxGeometry(.86, .06, .06), metal); brace.name = `neb-serving-stand-brace-${index}`;
      brace.position.set(tray.position.x, .22, tray.position.z + z); this.root.add(brace);
    }
    const box = new THREE.Mesh(new THREE.BoxGeometry(.46, .16, .36), new THREE.MeshStandardMaterial({ color: 0x303936, roughness: .85 }));
    box.name = 'neb-meal-utility-box'; box.position.set(-8, CREW_MEAL.table.height + .092, 22); this.root.add(box);
    const frame = new THREE.Mesh(new THREE.BoxGeometry(1.5, .1, 5), metal); frame.name = 'neb-meal-pendant-fixture'; frame.position.set(-8, 6.4, 22); this.root.add(frame);
    const diffuser = new THREE.Mesh(new THREE.BoxGeometry(1.35, .025, 4.7), new THREE.MeshBasicMaterial({ color: 0xc6d6d3, toneMapped: false }));
    diffuser.position.set(-8, 6.34, 22); this.root.add(diffuser);
    this.lamp.name = 'neb-meal-pendant-light'; this.lamp.position.set(-8, 6.1, 22); this.root.add(this.lamp);
  }

  update(journey?: FilmJourney, bodies?: (id: string) => THREE.Object3D | undefined): void {
    const meal = journey?.scene === 'm1_meal' && !journey.visiting && journey.interlude?.kind === 'meal' ? journey.interlude : undefined;
    this.root.visible = Boolean(meal); this.lamp.intensity = meal ? 175 : 0; if (!meal) return;
    const pose = crewMealPose(meal), { start, end } = CREW_MEAL.bowl;
    this.bowl.position.set(start.x, start.y + .012, start.z).lerp(new THREE.Vector3(end.x, end.y + .012, end.z), pose.slide);
    const neo = bodies?.('neo'), tank = bodies?.('tank');
    const heldBowl = neo?.getObjectByName('meal-held-bowl'), serving = tank?.getObjectByName('meal-serving-bowl');
    this.bowl.visible = !(visibleOwner(heldBowl) || visibleOwner(serving));
    this.spoon.position.set(CREW_MEAL.spoon.x, CREW_MEAL.spoon.y + .012, CREW_MEAL.spoon.z); this.spoon.rotation.set(-Math.PI / 2, 0, Math.PI);
    this.spoon.visible = !visibleOwner(neo?.getObjectByName('meal-held-spoon'));
  }

  dispose(): void { this.lamp.dispose(); disposeConsoleProp(this.root); }
}
