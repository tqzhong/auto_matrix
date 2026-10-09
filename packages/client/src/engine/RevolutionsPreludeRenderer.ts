import * as THREE from 'three';
import { EMP_OPERATOR, empOperatorPose, dockEmpFlash, dockPowerOffline, type FilmJourney } from '@auto_matrix/shared';

type PreludeScene = 'm3_oracle_absorbed' | 'm3_bane_questions' | 'm3_logos_plan' | 'm3_maggie_discovery' | 'm3_emp';

/** Small, state-driven set pieces layered over the existing Oracle apartment and Hammer interiors. */
export class RevolutionsPreludeRenderer {
  private group = new THREE.Group();
  private geometries = new Set<THREE.BufferGeometry>();
  private materials = new Set<THREE.Material>();
  private lamps: THREE.PointLight[] = [];
  private oracleDiffusers: THREE.MeshBasicMaterial[] = [];
  private evidence: THREE.Mesh[] = [];
  private routes?: [THREE.Mesh, THREE.Mesh];
  private warning?: THREE.PointLight;
  private hammerDiffuser?: THREE.MeshBasicMaterial;
  private empDisplay?: THREE.MeshBasicMaterial;
  private empFlash?: THREE.PointLight;
  private empCrank?: THREE.Group;
  consumed = false;
  blackout = false;

  constructor(root: THREE.Group, private scene: PreludeScene) {
    this.group.name = `revolutions-prelude-${scene}`; root.add(this.group);
    if (scene === 'm3_oracle_absorbed') this.oracle();
    else {
      this.hammerLighting();
      if (scene === 'm3_bane_questions') this.baneInquiry();
      else if (scene === 'm3_logos_plan') this.routesAtHammer();
      else if (scene === 'm3_emp') this.empDetonator();
      else this.maggieDiscovery();
    }
  }
  private material<T extends THREE.Material>(material: T): T { this.materials.add(material); return material; }
  private mesh(geometry: THREE.BufferGeometry, material: THREE.Material, parent = this.group): THREE.Mesh {
    this.geometries.add(geometry);
    const mesh = new THREE.Mesh(geometry, material); mesh.castShadow = mesh.receiveShadow = true; parent.add(mesh); return mesh;
  }
  private box(material: THREE.Material, x: number, y: number, z: number, w: number, h: number, d: number, parent = this.group): THREE.Mesh {
    const mesh = this.mesh(new THREE.BoxGeometry(w, h, d), material, parent); mesh.position.set(x, y, z); return mesh;
  }
  private oracle(): void {
    const fixture = this.material(new THREE.MeshStandardMaterial({ color: 0x888c77, roughness: .5, metalness: .45 }));
    for (let i = 0; i < 4; i++) {
      const z = 47 - i * 4.2;
      this.box(fixture, 0, 7.7, z, 3.7, .2, .6);
      const face = this.material(new THREE.MeshBasicMaterial({ color: 0xe7e8cb, toneMapped: false })); this.oracleDiffusers.push(face);
      this.box(face, 0, 7.57, z, 3.3, .04, .45);
      const lamp = new THREE.PointLight(0xebedd2, 105, 11, 2); lamp.name = `oracle-corridor-light-${i}`;
      lamp.position.set(0, 7.1, z); this.group.add(lamp); this.lamps.push(lamp);
    }
  }
  private hammerLighting(): void {
    const diffuser = this.material(new THREE.MeshBasicMaterial({ color: 0xcbdfe0, toneMapped: false }));
    this.hammerDiffuser = diffuser;
    const frame = this.material(new THREE.MeshStandardMaterial({ color: 0x526467, metalness: .6, roughness: .4 }));
    for (const z of [27, 0, -27]) {
      this.box(frame, 0, 17.2, z, 11.4, .22, 1.25);
      this.box(diffuser, 0, 17.06, z, 10.6, .04, .87);
      const light = new THREE.PointLight(0xc6e1df, 850, 48, 2);
      light.position.set(0, 13, z); this.group.add(light); this.lamps.push(light);
    }
  }
  private baneInquiry(): void {
    const casing = this.material(new THREE.MeshStandardMaterial({ color: 0x293b3e, roughness: .38, metalness: .68 }));
    const blue = this.material(new THREE.MeshBasicMaterial({ color: 0x7fc6cc, toneMapped: false }));
    const amber = this.material(new THREE.MeshBasicMaterial({ color: 0xedb273, toneMapped: false }));
    const screen = new THREE.Group(); screen.name = 'bane-neural-monitor'; this.group.add(screen);
    this.box(casing, -15.1, 4.6, -24, .36, 3.2, 5.8, screen);
    this.box(blue, -14.89, 4.6, -24, .025, 2.7, 5.3, screen);
    for (let i = 0; i < 3; i++) {
      const indicator = this.box(amber, -14.86, 5.45 - i * .82, -25.8 + i * .35, .04, .13, 1.05, screen);
      indicator.name = `bane-evidence-${i}`; this.evidence.push(indicator);
    }
    for (let i = 0; i < 12; i++) this.box(casing, -14.85, 3.55 + Math.sin(i * 1.8) * .26, -26.2 + i * .37, .04, .07, .31, screen);
    const lamp = new THREE.PointLight(0xb1e3e0, 150, 15, 2); lamp.position.set(-12, 6, -25); this.group.add(lamp); this.lamps.push(lamp);
  }
  private routesAtHammer(): void {
    const cyan = this.material(new THREE.MeshBasicMaterial({ color: 0x8bd3db, transparent: true, opacity: .82, depthWrite: false, toneMapped: false }));
    const gold = this.material(new THREE.MeshBasicMaterial({ color: 0xffc27a, transparent: true, opacity: .82, depthWrite: false, toneMapped: false }));
    const map = new THREE.Group(); map.name = 'hammer-two-routes'; this.group.add(map);
    this.box(this.material(new THREE.MeshBasicMaterial({ color: 0x31585d, toneMapped: false })), 0, .04, -12, 18, .025, 24, map).castShadow = false;
    const grid = this.material(new THREE.MeshBasicMaterial({ color: 0x729193, transparent: true, opacity: .45, depthWrite: false, toneMapped: false }));
    for (const x of [-8, -4, 0, 4, 8]) this.box(grid, x, .07, -12, .035, .02, 23, map).castShadow = false;
    for (const z of [-22, -17, -12, -7, -2]) this.box(grid, 0, .07, z, 17, .02, .035, map).castShadow = false;
    const paths = [-1, 1].map((side, i) => {
      const points = [new THREE.Vector3(0, .1, -19), new THREE.Vector3(side * 3, .1, -11), new THREE.Vector3(side * 6, .1, -3), new THREE.Vector3(side * 8, .1, -1)];
      const route = this.mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points), 24, .18, 8), i ? gold : cyan, map);
      route.name = i ? 'logos-machine-city-route' : 'hammer-zion-route'; route.castShadow = false; return route;
    });
    this.routes = [paths[0], paths[1]];
  }
  private maggieDiscovery(): void {
    const iron = this.material(new THREE.MeshStandardMaterial({ color: 0x33464a, roughness: .5, metalness: .6 }));
    const linen = this.material(new THREE.MeshStandardMaterial({ color: 0xaebcb7, roughness: .96, side: THREE.DoubleSide }));
    const sheet = new THREE.Group(); sheet.name = 'maggie-covered-stretcher'; this.group.add(sheet);
    this.box(iron, -10, 1, -25, 4.7, .6, 8.5, sheet);
    this.box(linen, -10, 1.42, -25, 4.25, .28, 8.1, sheet);
    const cover = this.mesh(new THREE.SphereGeometry(1, 20, 12), linen, sheet);
    cover.name = 'maggie-cover'; cover.position.set(-10, 1.75, -25); cover.scale.set(2.05, .48, 3.3);
    const warning = new THREE.PointLight(0xdb735e, 0, 18, 2); warning.name = 'hammer-medical-warning'; warning.position.set(-10, 6, -25);
    this.group.add(warning); this.lamps.push(warning); this.warning = warning;
  }
  private empDetonator(): void {
    const iron = this.material(new THREE.MeshStandardMaterial({ color: 0x354348, roughness: .5, metalness: .7 }));
    const steel = this.material(new THREE.MeshStandardMaterial({ color: 0x8c9697, roughness: .38, metalness: .82 }));
    const rubber = this.material(new THREE.MeshStandardMaterial({ color: 0x151b22, roughness: .87 }));
    const red = this.material(new THREE.MeshStandardMaterial({ color: 0x9c2920, roughness: .57, metalness: .35 }));
    this.empDisplay = this.material(new THREE.MeshBasicMaterial({ color: 0xe3b88b, toneMapped: false }));
    const console = new THREE.Group(); console.name = 'hammer-emp-detonator'; this.group.add(console);
    const tube = (points: number[][], radius: number, material = steel) => this.mesh(new THREE.TubeGeometry(
      new THREE.CatmullRomCurve3(points.map(p => new THREE.Vector3(...p as [number, number, number]))), 20, radius, 8), material, console);
    const seat = EMP_OPERATOR.seat;
    const cushion = this.box(rubber, 0, seat.y - .1, seat.z, seat.width, .2, seat.depth, console); cushion.name = 'link-seat-cushion';
    this.box(iron, 0, seat.y - .25, seat.z, 1.65, .12, 1.4, console);
    this.box(rubber, 0, 2.25, -15.38, 1.5, 1.8, .25, console).rotation.x = -.11;
    this.box(rubber, 0, 3.59, -15.24, 1.1, .48, .24, console).rotation.x = -.11;
    for (const side of [-1, 1]) {
      tube([[side * .7, .12, -16.4], [side * .78, 1.3, -15.5], [side * .78, 3.74, -15.1]], .065);
      tube([[side * .77, 1.48, -16.5], [side * 1.03, 2.18, -16.7], [side * 1.03, 2.18, -15.6], [side * .78, 1.6, -15.5]], .06);
      this.box(iron, side * .67, .08, -16, .32, .16, 1.7, console);
      this.box(rubber, side * .99, 2.23, -16.05, .19, .11, .72, console);
    }
    // An arm-mounted circular crank with a lifted red safety cover, as in the hand close-up.
    const housing = EMP_OPERATOR.console;
    this.box(iron, housing.x, housing.y, housing.z, housing.width, housing.height, housing.depth, console).name = 'emp-control-housing';
    const crank = EMP_OPERATOR.crank;
    const base = this.mesh(new THREE.CylinderGeometry(.4, .44, .24, 32), steel, console);
    base.position.set(crank.x, crank.y - .17, crank.z);
    const cover = this.mesh(new THREE.CylinderGeometry(.39, .39, .05, 32), red, console);
    cover.name = 'emp-red-cover'; cover.position.set(crank.x, crank.y + .29, crank.z - .4); cover.rotation.x = -1.12;
    const strokes = [
      [-.25, -.09, -.25, .09], [-.25, -.09, -.12, -.09], [-.25, 0, -.14, 0], [-.25, .09, -.12, .09],
      [-.06, .09, -.06, -.09], [-.06, -.09, .01, .02], [.01, .02, .08, -.09], [.08, -.09, .08, .09],
      [.15, .09, .15, -.09], [.15, -.09, .26, -.09], [.26, -.09, .28, -.06], [.28, -.06, .28, -.01], [.28, -.01, .15, .01],
    ];
    const letter = new THREE.BoxGeometry(1, .006, .021); this.geometries.add(letter);
    const stencil = new THREE.InstancedMesh(letter, this.material(new THREE.MeshStandardMaterial({ color: 0xd7d3bd, roughness: .9 })), strokes.length * 2);
    stencil.name = 'emp-cover-lettering'; const mark = new THREE.Object3D();
    for (let side = 0; side < 2; side++) strokes.forEach(([x, z, endX, endZ], i) => {
      const sign = side ? -1 : 1;
      mark.position.set((x + endX) / 2 * sign, sign * .028, (z + endZ) / 2);
      mark.scale.set(Math.hypot(endX - x, endZ - z), 1, 1); mark.rotation.y = -Math.atan2(endZ - z, (endX - x) * sign);
      mark.updateMatrix(); stencil.setMatrixAt(side * strokes.length + i, mark.matrix);
    });
    cover.add(stencil);
    for (let i = 0; i < 8; i++) {
      const angle = i / 8 * Math.PI * 2;
      this.box(rubber, crank.x + Math.cos(angle) * .35, crank.y - .01, crank.z + Math.sin(angle) * .35, .045, .04, .045, console);
    }
    this.empCrank = new THREE.Group(); this.empCrank.name = 'emp-crank'; this.empCrank.position.set(crank.x, crank.y, crank.z); console.add(this.empCrank);
    this.box(steel, crank.radius / 2, 0, 0, crank.radius + .12, .1, .12, this.empCrank);
    const grip = this.mesh(new THREE.CylinderGeometry(.075, .075, .29, 20), rubber, this.empCrank);
    grip.name = 'emp-crank-grip'; grip.position.set(crank.radius, .13, 0);
    const screen = this.box(iron, 1.55, 2.3, -17.25, 1.05, .52, .32, console); screen.rotation.x = -.55;
    this.box(this.empDisplay, 1.55, 2.34, -17.08, .82, .32, .025, console).rotation.x = -.55;
    for (let i = 0; i < 6; i++) this.box(rubber, 1.22 + i * .13, 2.11, -16.96, .07, .07, .045, console);
    tube([[1.6, 1, -16.7], [1.9, .3, -17.4], [2.1, .16, -19.5], [2.6, .17, -20.3]], .065, rubber);
    tube([[-1, 1.8, -15.4], [-1.4, .2, -15.1], [-2.6, .15, -14.2], [-4, .13, -15]], .04, rubber);
    this.empFlash = new THREE.PointLight(0xe8f9ff, 0, 95, 2);
    this.empFlash.position.set(0, 8, -16); this.group.add(this.empFlash);
  }
  update(journey: FilmJourney | undefined, elapsed: number): void {
    const step = journey?.scene === this.scene && !journey.visiting ? journey.step : 0;
    if (this.scene === 'm3_oracle_absorbed') {
      const escape = journey?.oracleAbsorption?.escape ?? (step >= 2 ? 32 : 0);
      this.lamps.forEach((lamp, i) => {
        const remaining = 16 + i * 1.8 - escape;
        lamp.intensity = remaining <= 0 ? 0 : remaining < .35 ? 30 + Math.sin(escape * 47) * 24 : 105;
        this.oracleDiffusers[i].color.setHex(lamp.intensity ? 0xe7e8cb : 0x252820);
      });
      this.consumed = escape >= 20;
    } else if (this.scene === 'm3_bane_questions') this.evidence.forEach((indicator, i) => indicator.visible = step > i + 1);
    else if (this.scene === 'm3_logos_plan' && this.routes) this.routes.forEach((route, i) => {
      const material = route.material as THREE.MeshBasicMaterial; material.opacity = step >= 2 ? .82 : .28 + Math.sin(elapsed * 2 + i) * .08;
    });
    else if (this.scene === 'm3_maggie_discovery' && this.warning) this.warning.intensity = step ? 90 + Math.sin(elapsed * 5) * 45 : 45;
    else if (this.scene === 'm3_emp') {
      const fired = dockPowerOffline(journey);
      this.blackout = fired;
      this.lamps.forEach(lamp => lamp.intensity = fired ? 0 : 850);
      this.hammerDiffuser?.color.setHex(fired ? 0x182023 : 0xcbdfe0);
      this.empDisplay?.color.setHex(fired ? 0x30231f : 0xe3b88b);
      if (this.empCrank) this.empCrank.rotation.y = -(journey?.empOperator ? empOperatorPose(journey.empOperator).turn : fired ? 1 : 0) * Math.PI * 1.5;
      if (this.empFlash) this.empFlash.intensity = fired ? dockEmpFlash(journey?.emp) * 4500 : 0;
    }
  }
  dispose(): void {
    this.group.traverse(object => { if (object instanceof THREE.InstancedMesh) object.dispose(); });
    this.group.removeFromParent(); this.group.clear();
    this.geometries.forEach(geometry => geometry.dispose()); this.materials.forEach(material => material.dispose());
    this.lamps.forEach(light => light.dispose());
    this.empFlash?.dispose();
  }
}
