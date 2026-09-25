import * as THREE from 'three';
import { farewellPose, newFarewell, type FarewellEncounter } from '@auto_matrix/shared';

/** The crushed Logos cockpit after it has bored into the Machine City tower. */
export class LogosWreckRenderer {
  private group = new THREE.Group();
  private foreground = new THREE.Group();
  private fire = new THREE.Group();
  private golden = new THREE.Group();
  private sparks: THREE.Mesh[] = [];
  private flames: THREE.Mesh[] = [];
  private fireLights: THREE.PointLight[] = [];
  private geometries = new Set<THREE.BufferGeometry>();
  private materials = new Set<THREE.Material>();
  private lights: THREE.Light[] = [];

  constructor(root: THREE.Group) {
    root.add(this.group); this.group.add(this.foreground, this.fire, this.golden);
    this.buildWreck(); this.buildMachineSight();
    this.update(undefined, 0, false);
  }

  private material(color: number, metalness: number, roughness: number, emissive = 0, intensity = 0,
    transparent = false, opacity = 1): THREE.MeshStandardMaterial {
    const material = new THREE.MeshStandardMaterial({ color, metalness, roughness, emissive, emissiveIntensity: intensity,
      transparent, opacity, depthWrite: !transparent, side: THREE.DoubleSide });
    this.materials.add(material); return material;
  }

  private mesh(geometry: THREE.BufferGeometry, material: THREE.Material, parent: THREE.Object3D = this.group,
    name?: string): THREE.Mesh {
    this.geometries.add(geometry);
    const mesh = new THREE.Mesh(geometry, material); if (name) mesh.name = name;
    mesh.castShadow = true; mesh.receiveShadow = true; parent.add(mesh); return mesh;
  }

  private buildWreck(): void {
    const hull = this.material(0x222d30, .9, .38);
    const torn = this.material(0x596164, .82, .46);
    const black = this.material(0x0d1517, .62, .68);
    const glass = this.material(0x55737a, .7, .18, 0x172f33, .5, true, .34);
    const deadScreen = this.material(0x263438, .28, .3, 0x102b2b, .28);
    const ember = this.material(0xff7a22, .1, .42, 0xff5b16, 5.2, true, .82);

    const shell = this.mesh(new THREE.CylinderGeometry(8.6, 7.2, 35, 14, 1, true, -.82, 1.64), hull,
      this.group, 'logos-wreck-hull');
    shell.rotation.x = Math.PI / 2; shell.rotation.z = -.06; shell.position.set(0, 5.2, -1);
    const deck = this.mesh(new THREE.BoxGeometry(14.5, .7, 37), black); deck.position.set(0, -.35, -1); deck.rotation.z = -.035;

    for (let i = 0; i < 12; i++) {
      const rib = this.mesh(new THREE.TorusGeometry(7.65, .19, 7, 24, Math.PI * 1.08), i % 3 ? hull : torn);
      rib.position.set((i % 2 ? -.22 : .18) * (i / 12), 5.25 + Math.sin(i * 1.8) * .12, -16 + i * 2.85);
      rib.rotation.set(Math.PI / 2, 0, Math.PI / 2 + (i % 4 - 1.5) * .025);
    }
    for (let i = 0; i < 16; i++) {
      const panel = this.mesh(new THREE.BoxGeometry(2.2 + i % 4 * .7, .18 + i % 3 * .08, 3.8 + i % 5 * .65), i % 3 ? hull : torn,
        i < 5 ? this.foreground : this.group);
      const side = i % 2 ? -1 : 1;
      panel.position.set(side * (5.2 + i % 3 * .8), 1.15 + i % 4 * 1.25, -15 + i * 2.05);
      panel.rotation.set((i % 5 - 2) * .11, side * (.12 + i % 4 * .08), side * (.08 + i % 3 * .06));
    }

    const console = this.mesh(new THREE.BoxGeometry(10.8, 2.1, 3.8), hull); console.position.set(0, 1.05, -18.2); console.rotation.x = -.2;
    for (let i = -3; i <= 3; i++) {
      const screen = this.mesh(new THREE.BoxGeometry(1.15, .08, .78), deadScreen);
      screen.position.set(i * 1.45, 2.18 + Math.abs(i) * .05, -17.45); screen.rotation.x = -.88;
      if (i === -2 || i === 1) screen.rotation.z = i * .08;
    }
    for (const side of [-1, 1]) {
      const chair = this.mesh(new THREE.BoxGeometry(2.25, .42, 3.2), black); chair.position.set(side * 2.65, .55, -12.8); chair.rotation.x = -.18;
      const back = this.mesh(new THREE.BoxGeometry(2.25, 3.2, .42), black); back.position.set(side * 2.65, 2.05, -11.55); back.rotation.x = -.28;
    }

    const windshield = this.mesh(new THREE.TorusGeometry(6.1, .26, 8, 30, Math.PI * 1.1), torn, this.group, 'logos-wreck-windshield');
    windshield.position.set(0, 6.2, -21); windshield.rotation.set(Math.PI / 2, 0, -.05);
    for (let i = 0; i < 13; i++) {
      const shard = this.mesh(new THREE.ConeGeometry(.4 + i % 3 * .18, 2.2 + i % 4 * .45, 3), glass,
        i < 4 ? this.foreground : this.group);
      shard.position.set(-5.3 + i * .86, 3.1 + i % 5 * 1.05, -20.5 + Math.sin(i * 2.3) * .8);
      shard.rotation.set(i * .41, i * .27, i * .63);
    }

    const rebar = new THREE.Group(); rebar.name = 'logos-wreck-rebar'; this.group.add(rebar);
    for (let i = 0; i < 7; i++) {
      const shaft = this.mesh(new THREE.CylinderGeometry(.075 + i % 2 * .025, .11, 12 + i % 3 * 2.1, 8), torn, rebar);
      shaft.position.set(-3.4 + i * 1.12, 4.4 + i % 3 * .6, -16 + Math.sin(i * 1.9) * 1.4);
      shaft.rotation.set(.62 + i % 2 * .18, -.32 + i * .12, -.65 + i * .2);
    }

    this.fire.name = 'logos-wreck-fire';
    for (let i = 0; i < 7; i++) {
      const flame = this.mesh(new THREE.ConeGeometry(.28 + i % 3 * .16, 1.2 + i % 4 * .4, 7), ember, this.fire);
      flame.position.set(-6 + i * 2, .55, -6 + (i * 11 % 17)); flame.rotation.z = (i % 3 - 1) * .18;
      this.flames.push(flame);
      if (i % 3 === 0) {
        const light = new THREE.PointLight(0xff6b24, 18, 12, 2); light.position.copy(flame.position); light.position.y += 1;
        this.fire.add(light); this.fireLights.push(light); this.lights.push(light);
      }
    }
    for (let i = 0; i < 22; i++) {
      const spark = this.mesh(new THREE.SphereGeometry(.035 + i % 3 * .018, 5, 4), ember, this.fire);
      spark.position.set(-7 + i % 8 * 2, .7 + i % 5 * .45, -18 + Math.floor(i / 8) * 14 + i % 3);
      this.sparks.push(spark);
    }

    const cold = new THREE.HemisphereLight(0x78969a, 0x090d0e, .6); this.group.add(cold); this.lights.push(cold);
    const slit = new THREE.DirectionalLight(0xd4a05c, 1.5); slit.position.set(-8, 18, -24); this.group.add(slit); this.lights.push(slit);
  }

  private buildMachineSight(): void {
    this.golden.name = 'logos-wreck-golden-vision';
    const gold = this.material(0xffbd43, .2, .18, 0xff9d17, 4.8, true, .72);
    const dim = this.material(0xa76519, .38, .3, 0x8d4d0b, 1.8, true, .46);
    for (let i = 0; i < 26; i++) {
      const row = Math.floor(i / 9);
      const ring = this.mesh(new THREE.TorusGeometry(.75 + i % 4 * .32, .025 + i % 2 * .012, 5, 18, Math.PI * (1.25 + i % 3 * .2)), i % 4 ? gold : dim, this.golden);
      ring.position.set(-9 + i % 9 * 2.25, .5 + i % 6 * 1.45, (row === 1 ? -18 : -24 + row * 18) + Math.sin(i * 1.7) * 3);
      ring.rotation.set(Math.PI / 2 + (i % 3 - 1) * .4, i * .27, i * .19);
    }
    for (let i = 0; i < 10; i++) {
      const filament = this.mesh(new THREE.CylinderGeometry(.018, .045, 9 + i % 4 * 3, 5), i % 2 ? gold : dim, this.golden);
      filament.position.set(-10 + i * 2.2, 5 + i % 3 * 2, 8 + Math.sin(i) * 6);
      filament.rotation.set(.45 + i % 3 * .18, 0, -.9 + i * .18);
    }
  }

  update(encounter: FarewellEncounter | undefined, elapsed: number, firstPerson = false): void {
    const state = encounter ?? newFarewell(); const pose = farewellPose(state);
    this.foreground.visible = !firstPerson;
    this.golden.visible = Boolean(encounter);
    this.golden.rotation.y = Math.sin(elapsed * .13) * .025;
    this.golden.children.forEach((child, index) => {
      child.scale.setScalar(.92 + Math.sin(elapsed * 2.2 + index * .7) * .08);
    });
    const quiet = state.phase === 'still' ? .32 : 1;
    this.flames.forEach((flame, index) => {
      flame.scale.set(.8 + Math.sin(elapsed * 9 + index) * .2, quiet * (.72 + Math.sin(elapsed * 12 + index * 2) * .24), .8);
    });
    this.fireLights.forEach((light, index) => { light.intensity = quiet * (15 + Math.sin(elapsed * 11 + index) * 5); });
    this.sparks.forEach((spark, index) => {
      const cycle = (elapsed * (.7 + index % 4 * .12) + index * .37) % 1;
      spark.position.y = .7 + cycle * (3.5 + index % 5); spark.visible = cycle < quiet * .88;
    });
    this.fire.position.y = pose.trinity.breath * .03;
  }

  dispose(): void {
    this.group.removeFromParent(); this.group.clear();
    this.geometries.forEach(geometry => geometry.dispose()); this.materials.forEach(material => material.dispose());
    this.lights.forEach(light => light.dispose());
  }
}
