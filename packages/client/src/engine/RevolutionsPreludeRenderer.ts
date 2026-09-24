import * as THREE from 'three';
import type { FilmJourney } from '@auto_matrix/shared';

type PreludeScene = 'm3_oracle_absorbed' | 'm3_bane_questions' | 'm3_logos_plan' | 'm3_maggie_discovery';

/** Small, state-driven set pieces layered over the existing Oracle apartment and Hammer interiors. */
export class RevolutionsPreludeRenderer {
  private group = new THREE.Group();
  private geometries = new Set<THREE.BufferGeometry>();
  private materials = new Set<THREE.Material>();
  private lamps: THREE.PointLight[] = [];
  private code?: THREE.Group;
  private codeLight?: THREE.PointLight;
  private evidence: THREE.Mesh[] = [];
  private routes?: [THREE.Mesh, THREE.Mesh];
  private warning?: THREE.PointLight;
  consumed = false;

  constructor(root: THREE.Group, private scene: PreludeScene) {
    this.group.name = `revolutions-prelude-${scene}`; root.add(this.group);
    if (scene === 'm3_oracle_absorbed') this.oracle();
    else {
      this.hammerLighting();
      if (scene === 'm3_bane_questions') this.baneInquiry();
      else if (scene === 'm3_logos_plan') this.routesAtHammer();
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
    const lightFace = this.material(new THREE.MeshBasicMaterial({ color: 0xe7e8cb, toneMapped: false }));
    for (let i = 0; i < 4; i++) {
      const z = 2 + i * 4.7;
      this.box(fixture, 0, 8.35, z, 6, .2, .75);
      this.box(lightFace, 0, 8.19, z, 5.5, .04, .56);
      const lamp = new THREE.PointLight(0xebedd2, 105, 13, 2); lamp.name = `oracle-corridor-light-${i}`;
      lamp.position.set(0, 7.7, z); this.group.add(lamp); this.lamps.push(lamp);
    }
    this.code = new THREE.Group(); this.code.name = 'oracle-code-intrusion'; this.group.add(this.code);
    const symbol = this.material(new THREE.MeshBasicMaterial({ color: 0x86edb3, transparent: true, opacity: .5, depthWrite: false, toneMapped: false }));
    const shard = new THREE.BoxGeometry(.04, .28, .035); this.geometries.add(shard);
    for (let i = 0; i < 96; i++) {
      const mesh = new THREE.Mesh(shard, symbol);
      const angle = i * 2.39996323;
      const radius = 1.1 + Math.sqrt(i / 96) * 8.5;
      mesh.position.set(-5 + Math.sin(angle) * radius, .45 + (i * 37 % 83) / 83 * 7.2, -22 + Math.cos(angle) * radius);
      mesh.rotation.z = Math.sin(i * 1.7) * .4; mesh.scale.y = .35 + (i % 6) * .32;
      this.code.add(mesh);
    }
    this.codeLight = new THREE.PointLight(0x7af7a9, 0, 16, 2); this.codeLight.position.set(-5, 4, -22); this.group.add(this.codeLight);
    this.code.visible = false;
  }
  private hammerLighting(): void {
    const diffuser = this.material(new THREE.MeshBasicMaterial({ color: 0xcbdfe0, toneMapped: false }));
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
  update(journey: FilmJourney | undefined, elapsed: number): void {
    const step = journey?.scene === this.scene && !journey.visiting ? journey.step : 0;
    if (this.scene === 'm3_oracle_absorbed') {
      this.lamps.forEach((lamp, i) => lamp.intensity = i < step ? 0 : 105);
      this.consumed = step >= 3;
      if (this.code) { this.code.visible = this.consumed; this.code.rotation.y = elapsed * .06; }
      if (this.codeLight) this.codeLight.intensity = this.consumed ? 170 + Math.sin(elapsed * 7) * 45 : 0;
    } else if (this.scene === 'm3_bane_questions') this.evidence.forEach((indicator, i) => indicator.visible = step > i + 1);
    else if (this.scene === 'm3_logos_plan' && this.routes) this.routes.forEach((route, i) => {
      const material = route.material as THREE.MeshBasicMaterial; material.opacity = step >= 2 ? .82 : .28 + Math.sin(elapsed * 2 + i) * .08;
    });
    else if (this.scene === 'm3_maggie_discovery' && this.warning) this.warning.intensity = step ? 90 + Math.sin(elapsed * 5) * 45 : 45;
  }
  dispose(): void {
    this.group.removeFromParent(); this.group.clear();
    this.geometries.forEach(geometry => geometry.dispose()); this.materials.forEach(material => material.dispose());
    this.lamps.forEach(light => light.dispose()); this.codeLight?.dispose();
  }
}
