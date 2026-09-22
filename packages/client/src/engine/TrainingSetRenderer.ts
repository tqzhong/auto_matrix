import * as THREE from 'three';
import type { FilmJourney } from '@auto_matrix/shared';

/** Film-one training programs share a clean simulation language, but each
 * space has its own physical set and lighting rather than the generic atlas. */
export class TrainingSetRenderer {
  private geometries = new Set<THREE.BufferGeometry>();
  private materials = new Set<THREE.Material>();
  private lights = new Set<THREE.Light>();
  private crowd: THREE.Group[] = [];
  private skylineLights: THREE.Mesh[] = [];
  private programLight?: THREE.PointLight;
  private revealLight?: THREE.PointLight;
  private wind?: THREE.Group;
  private wood = this.material(new THREE.MeshStandardMaterial({ color: 0x4c3425, roughness: .72 }));
  private darkWood = this.material(new THREE.MeshStandardMaterial({ color: 0x211b17, roughness: .8 }));
  private paper = this.material(new THREE.MeshPhysicalMaterial({ color: 0xe5dfc9, roughness: .68, transmission: .04 }));
  private stone = this.material(new THREE.MeshStandardMaterial({ color: 0x8a908a, roughness: .88 }));
  private dark = this.material(new THREE.MeshStandardMaterial({ color: 0x252c2d, roughness: .75, metalness: .16 }));
  private metal = this.material(new THREE.MeshStandardMaterial({ color: 0x596463, roughness: .35, metalness: .78 }));
  private glass = this.material(new THREE.MeshPhysicalMaterial({ color: 0x839b9b, roughness: .16, metalness: .28, transparent: true, opacity: .5, depthWrite: false }));
  private water = this.material(new THREE.MeshPhysicalMaterial({ color: 0x609394, roughness: .08, metalness: .28, clearcoat: 1, transparent: true, opacity: .82 }));
  private glow = this.material(new THREE.MeshBasicMaterial({ color: 0xc9e7d5, toneMapped: false }));

  constructor(private root: THREE.Group, readonly sceneId: string) {
    if (sceneId === 'm1_dojo') this.dojo();
    else if (sceneId === 'm1_jump') this.rooftops();
    else this.plaza();
  }

  private material<T extends THREE.Material>(value: T): T { this.materials.add(value); return value; }
  private geometry<T extends THREE.BufferGeometry>(value: T): T { this.geometries.add(value); return value; }
  private mesh(parent: THREE.Object3D, geometry: THREE.BufferGeometry, material: THREE.Material, name?: string): THREE.Mesh {
    const mesh = new THREE.Mesh(this.geometry(geometry), material); mesh.castShadow = mesh.receiveShadow = true;
    if (name) mesh.name = name; parent.add(mesh); return mesh;
  }
  private box(parent: THREE.Object3D, material: THREE.Material, x: number, y: number, z: number, width: number, height: number, depth: number, name?: string): THREE.Mesh {
    const mesh = this.mesh(parent, new THREE.BoxGeometry(width, height, depth), material, name); mesh.position.set(x, y, z); return mesh;
  }
  private cylinder(parent: THREE.Object3D, material: THREE.Material, x: number, y: number, z: number, radius: number, height: number, radial = 20, name?: string): THREE.Mesh {
    const mesh = this.mesh(parent, new THREE.CylinderGeometry(radius, radius, height, radial), material, name); mesh.position.set(x, y, z); return mesh;
  }
  private light(light: THREE.Light, name: string): void { light.name = name; this.root.add(light); this.lights.add(light); }

  private dojo(): void {
    const set = new THREE.Group(); set.name = 'training-dojo-set'; this.root.add(set);
    const tatami = this.material(new THREE.MeshStandardMaterial({ color: 0xa7a47c, roughness: .96 }));
    const border = this.material(new THREE.MeshStandardMaterial({ color: 0x30372d, roughness: .86 }));
    for (let x = -20; x <= 20; x += 8) for (let z = -25; z <= 25; z += 10) {
      this.box(set, tatami, x, .02, z, 7.72, .09, 9.72, `dojo-tatami-${x}-${z}`);
      this.box(set, border, x - 3.82, .075, z, .12, .04, 9.75);
    }
    for (const side of [-1, 1]) {
      this.box(set, this.darkWood, side * 24.55, 7.5, 0, .9, 15, 61);
      for (let z = -26; z <= 26; z += 10.4) {
        this.box(set, this.paper, side * 24.05, 6.4, z, .16, 10.2, 9.5);
        for (let y = 1.8; y < 11; y += 2.05) this.box(set, this.wood, side * 23.92, y, z, .24, .09, 9.55);
        for (let offset = -4.5; offset <= 4.5; offset += 2.25) this.box(set, this.wood, side * 23.92, 6.4, z + offset, .24, 10.3, .09);
      }
    }
    for (let x = -24; x <= 24; x += 6) {
      this.box(set, this.darkWood, x, 7.5, -30.55, .48, 15, .7);
      this.box(set, this.wood, x, 7.5, 30.55, .42, 15, .6);
    }
    for (const z of [-30.55, 30.55]) for (let y = 1.7; y < 14; y += 2) this.box(set, this.wood, 0, y, z, 49, .1, .18);
    for (const x of [-20, -10, 0, 10, 20]) {
      const beam = this.box(set, this.darkWood, x, 15.1, 0, .5, .55, 62); beam.rotation.z = x * .0008;
    }
    const courtyard = this.box(set, this.stone, 0, -.06, 37, 50, .12, 12, 'dojo-courtyard'); courtyard.receiveShadow = true;
    for (const x of [-19, 19]) {
      this.cylinder(set, this.darkWood, x, 4.2, 34, .45, 8.4, 18);
      const crown = this.mesh(set, new THREE.ConeGeometry(4.5, 3.4, 4), this.darkWood); crown.position.set(x, 9.2, 34); crown.rotation.y = Math.PI / 4;
    }
    this.programLight = new THREE.PointLight(0xf0d9aa, 210, 38, 2); this.programLight.position.set(0, 11.5, -2); this.light(this.programLight, 'dojo-training-light');
    const fill = new THREE.HemisphereLight(0xf6ead0, 0x485349, 1.55); this.light(fill, 'dojo-daylight');
  }

  private rooftopUnit(parent: THREE.Object3D, x: number, z: number, index: number): void {
    const unit = new THREE.Group(); unit.position.set(x, 0, z); parent.add(unit);
    this.box(unit, this.dark, 0, 1.2, 0, 5.5, 2.4, 4.2, `jump-hvac-${index}`);
    for (let i = -2; i <= 2; i++) this.box(unit, this.metal, i * .9, 1.25, 2.13, .55, 1.35, .08);
    const fan = this.mesh(unit, new THREE.TorusGeometry(1.05, .12, 8, 30), this.metal); fan.position.y = 2.48; fan.rotation.x = Math.PI / 2;
  }

  private rooftops(): void {
    const set = new THREE.Group(); set.name = 'training-jump-set'; this.root.add(set);
    const tar = this.material(new THREE.MeshStandardMaterial({ color: 0x424846, roughness: .98 }));
    this.box(set, tar, 0, -.12, 17, 50, .24, 60, 'jump-near-roof');
    this.box(set, tar, 0, -.12, -38.5, 50, .24, 17, 'jump-far-roof');
    for (const z of [-13, -30]) {
      this.box(set, this.stone, -20, .75, z, 10, 1.5, .7, `jump-parapet-left-${z}`);
      this.box(set, this.stone, 20, .75, z, 10, 1.5, .7, `jump-parapet-right-${z}`);
    }
    for (const side of [-1, 1]) this.box(set, this.stone, side * 24.65, .65, 7, .7, 1.3, 80);
    this.rooftopUnit(set, -15, 16, 0); this.rooftopUnit(set, 15, 31, 1); this.rooftopUnit(set, 13, -39, 2);
    for (const [x, z, height] of [[-17, 4, 8], [18, 8, 6], [-14, 33, 5]] as const) {
      const tank = this.cylinder(set, this.metal, x, height / 2 + 1, z, 2.4, height, 20, 'jump-water-tank');
      tank.scale.x = 1.18; for (const dx of [-1.7, 1.7]) this.box(set, this.dark, x + dx, 1, z, .22, 2, .22);
    }
    this.wind = new THREE.Group(); this.wind.name = 'jump-wind-lines'; set.add(this.wind);
    for (let i = 0; i < 14; i++) {
      const line = this.box(this.wind, this.glow, -20 + i * 3.1, 3 + i % 4 * 1.4, -21.5, 1.8, .025, .025);
      line.material = this.glow; line.userData.phase = i * .73;
    }
    const city = new THREE.Group(); city.name = 'jump-city-canyon'; set.add(city);
    for (let i = 0; i < 30; i++) {
      const side = i % 2 ? 1 : -1; const x = side * (34 + i % 4 * 12); const z = 48 - Math.floor(i / 2) * 9;
      const height = 35 + (i * 19) % 62; this.box(city, i % 3 ? this.dark : this.stone, x, height / 2 - 20, z, 17 + i % 4 * 3, height, 15);
      for (let y = 3; y < height - 4; y += 6) {
        const pane = this.box(city, this.glass, x - side * (8.6 + i % 4 * 1.5), y - 20, z, .06, 3.2, 8);
        this.skylineLights.push(pane);
      }
    }
    this.programLight = new THREE.PointLight(0xdbe9de, 190, 48, 2); this.programLight.position.set(0, 12, -21); this.light(this.programLight, 'jump-gap-light');
    const sun = new THREE.DirectionalLight(0xffedcc, 2.3); sun.position.set(-22, 44, 30); sun.castShadow = true; this.light(sun, 'jump-program-sun');
  }

  private mannequin(parent: THREE.Object3D, x: number, z: number, color: number, index: number): void {
    const figure = new THREE.Group(); figure.name = `red-dress-crowd-${index}`; figure.position.set(x, 0, z); figure.rotation.y = index % 2 ? 0 : Math.PI; parent.add(figure); this.crowd.push(figure);
    const cloth = this.material(new THREE.MeshStandardMaterial({ color, roughness: .8 }));
    this.cylinder(figure, cloth, 0, 2.3, 0, .42, 2.7, 12); this.mesh(figure, new THREE.SphereGeometry(.4, 14, 10), this.paper).position.y = 4.05;
    for (const side of [-1, 1]) {
      const leg = this.box(figure, this.dark, side * .22, .75, 0, .28, 1.5, .35); leg.rotation.x = (index + side) % 3 * .06;
      const arm = this.box(figure, cloth, side * .58, 2.35, 0, .25, 2.25, .3); arm.rotation.z = side * .12;
    }
    figure.userData.baseZ = z; figure.userData.phase = index * .77;
  }

  private plaza(): void {
    const set = new THREE.Group(); set.name = 'training-red-dress-set'; this.root.add(set);
    const paving = this.material(new THREE.MeshStandardMaterial({ color: 0xa5aaa2, roughness: .9 }));
    this.box(set, paving, 0, -.08, 0, 62, .16, 82, 'red-dress-paving');
    for (let x = -30; x <= 30; x += 3.1) this.box(set, this.stone, x, .015, 0, .035, .03, 81);
    for (let z = -40; z <= 40; z += 3.1) this.box(set, this.stone, 0, .018, z, 61, .035, .035);
    const fountain = new THREE.Group(); fountain.name = 'red-dress-fountain'; fountain.position.set(-15.5, 0, 3); set.add(fountain);
    this.cylinder(fountain, this.stone, 0, .4, 0, 7, .8, 40); this.cylinder(fountain, this.water, 0, .84, 0, 6.45, .08, 40);
    this.cylinder(fountain, this.stone, 0, 1.7, 0, 1.4, 2.6, 24);
    const spray = this.mesh(fountain, new THREE.SphereGeometry(2.25, 24, 14), this.water); spray.position.y = 3.4; spray.scale.y = .14;
    for (const side of [-1, 1]) {
      const arcade = new THREE.Group(); arcade.position.x = side * 28.5; set.add(arcade);
      for (let z = -36; z <= 36; z += 9) {
        this.cylinder(arcade, this.stone, 0, 5.2, z, .62, 10.4, 20);
        this.box(arcade, this.stone, 0, 10.6, z, 4.6, .65, 8.4);
      }
      this.box(arcade, this.dark, side * .35, 14.3, 0, 2, 7, 82);
      for (let z = -34; z < 36; z += 12) {
        const lamp = this.mesh(arcade, new THREE.SphereGeometry(.22, 12, 8), this.glow); lamp.position.set(-side * .85, 7.4, z);
      }
    }
    for (let i = 0; i < 24; i++) {
      const side = i % 2 ? 1 : -1; const lane = i % 4 < 2 ? 3 : 12; const x = side * lane + (i % 3 - 1) * 1.2; const z = -35 + Math.floor(i / 2) * 6.1;
      if (Math.abs(x - 7) < 2.2) continue;
      this.mannequin(set, x, z, [0x364947, 0x585a52, 0x31363b, 0x706757][i % 4], i);
    }
    this.programLight = new THREE.PointLight(0xe4eadb, 135, 34, 2); this.programLight.position.set(7, 9, -10); this.light(this.programLight, 'red-dress-program-light');
    this.revealLight = new THREE.PointLight(0xff5c43, 0, 20, 2); this.revealLight.position.set(7, 4, 7); this.light(this.revealLight, 'red-dress-agent-reveal');
    const sun = new THREE.DirectionalLight(0xffeccb, 2.1); sun.position.set(-20, 38, 26); sun.castShadow = true; this.light(sun, 'red-dress-sun');
  }

  update(journey: FilmJourney | undefined, elapsed: number): void {
    if (this.sceneId === 'm1_dojo') {
      const lesson = journey?.scene === 'm1_dojo' && !journey.visiting ? journey.dojo : undefined;
      if (this.programLight) this.programLight.intensity = lesson?.complete ? 95 : 170 + (lesson?.dodged ? 95 : 0) + Math.sin(elapsed * 2.4) * 8;
      return;
    }
    if (this.sceneId === 'm1_jump') {
      const training = journey?.scene === 'm1_jump' && !journey.visiting ? journey.training : undefined;
      if (this.wind) for (const object of this.wind.children) {
        const phase = Number(object.userData.phase ?? 0); object.position.x = -20 + ((elapsed * 8 + phase * 4) % 40); object.visible = Boolean(training?.started);
      }
      if (this.programLight) this.programLight.intensity = training?.started ? 260 : 120;
      return;
    }
    const training = journey?.scene === 'm1_red_dress' && !journey.visiting ? journey.training : undefined;
    const t = training?.elapsed ?? 0; const frozen = Boolean(training?.started && t >= 4.8 && t < 9.2);
    this.crowd.forEach((figure, index) => {
      const phase = Number(figure.userData.phase); const base = Number(figure.userData.baseZ);
      figure.position.z = base + (training?.started && !frozen ? Math.sin(elapsed * .55 + phase) * 1.4 : 0);
      figure.rotation.z = frozen ? 0 : Math.sin(elapsed * 1.6 + phase) * .018;
      figure.children.forEach((child, childIndex) => { if (childIndex > 1) child.rotation.x = frozen ? 0 : Math.sin(elapsed * 3.2 + phase + childIndex) * .08; });
    });
    if (this.revealLight) this.revealLight.intensity = t >= 6.2 && t < 9.2 ? 420 + Math.sin(elapsed * 12) * 35 : 0;
    if (this.programLight) this.programLight.intensity = frozen ? 70 : 145;
  }

  dispose(): void {
    this.root.clear(); this.geometries.forEach(value => value.dispose()); this.materials.forEach(value => value.dispose()); this.lights.forEach(value => value.dispose());
    this.geometries.clear(); this.materials.clear(); this.lights.clear(); this.crowd = []; this.skylineLights = [];
  }
}
