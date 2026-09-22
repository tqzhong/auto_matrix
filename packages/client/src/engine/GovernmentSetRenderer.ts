import * as THREE from 'three';
import { GOVERNMENT_RESCUE, type FilmJourney } from '@auto_matrix/shared';

/** Dedicated physical sets for Morpheus' executive-office interrogation and
 * the rooftop gun line. All coordinates match the server-authored encounter. */
export class GovernmentSetRenderer {
  private group = new THREE.Group();
  private geometries = new Set<THREE.BufferGeometry>();
  private materials = new Set<THREE.Material>();
  private lights = new Set<THREE.Light>();
  private sprinklers?: THREE.Group;
  private alarm?: THREE.PointLight;
  private serum?: THREE.Object3D;
  private rotor?: THREE.Group;
  private tailRotor?: THREE.Group;
  private cockpitGlow?: THREE.PointLight;
  private bulletLines?: THREE.Group;
  private bullets: THREE.Object3D[] = [];
  private helicopterDoor?: THREE.Object3D;

  private concrete = this.material(0x9b9e98, .88, .04);
  private darkConcrete = this.material(0x555d5b, .92, .03);
  private metal = this.material(0x78817e, .46, .72);
  private black = this.material(0x111716, .32, .48);
  private helicopterPaint = this.material(0x354941, .42, .56);
  private carpet = this.material(0x4d5b54, .96, 0);
  private wood = this.material(0x5a3c2b, .7, .02);
  private leather = this.material(0x202725, .6, .1);
  private white = this.material(0xb8c0ba, .62, .03);
  private red = this.material(0xc32219, .25, .22, 0xb01812, 1.8);
  private green = this.material(0x7ad6aa, .18, .25, 0x3ca879, 1.6);
  private glass = this.physical(0x9cb8b8, .12, .24);
  private water = this.physical(0xb5d8db, .06, .42);

  constructor(private root: THREE.Group, readonly setId: 'film_government_office' | 'film_government_roof') {
    this.group.name = 'government-rescue-set'; this.root.add(this.group);
    if (setId === 'film_government_office') this.buildOffice(); else this.buildRoof();
  }

  private material(color: number, roughness: number, metalness: number, emissive = 0, emissiveIntensity = 0): THREE.MeshStandardMaterial {
    const value = new THREE.MeshStandardMaterial({ color, roughness, metalness, emissive, emissiveIntensity });
    this.materials.add(value); return value;
  }
  private physical(color: number, roughness: number, opacity: number): THREE.MeshPhysicalMaterial {
    const value = new THREE.MeshPhysicalMaterial({ color, roughness, metalness: .08, transparent: true, opacity,
      transmission: Math.max(0, .82 - opacity), thickness: .18, clearcoat: .8, side: THREE.DoubleSide, depthWrite: opacity > .35 });
    this.materials.add(value); return value;
  }
  private mesh(geometry: THREE.BufferGeometry, material: THREE.Material, parent = this.group, name?: string): THREE.Mesh {
    this.geometries.add(geometry); const mesh = new THREE.Mesh(geometry, material); mesh.castShadow = true; mesh.receiveShadow = true;
    if (name) mesh.name = name; parent.add(mesh); return mesh;
  }
  private box(parent: THREE.Object3D, material: THREE.Material, x: number, y: number, z: number, w: number, h: number, d: number, name?: string): THREE.Mesh {
    const mesh = this.mesh(new THREE.BoxGeometry(w, h, d), material, parent as THREE.Group, name); mesh.position.set(x, y, z); return mesh;
  }
  private sphere(parent: THREE.Object3D, material: THREE.Material, x: number, y: number, z: number, radius: number, name?: string): THREE.Mesh {
    const mesh = this.mesh(new THREE.SphereGeometry(radius, 20, 12), material, parent as THREE.Group, name); mesh.position.set(x, y, z); return mesh;
  }
  private cylinder(parent: THREE.Object3D, material: THREE.Material, x: number, y: number, z: number, radius: number, height: number, name?: string): THREE.Mesh {
    const mesh = this.mesh(new THREE.CylinderGeometry(radius, radius, height, 20), material, parent as THREE.Group, name); mesh.position.set(x, y, z); return mesh;
  }
  private line(parent: THREE.Object3D, material: THREE.Material, from: THREE.Vector3, to: THREE.Vector3, radius: number, name?: string): THREE.Mesh {
    const delta = to.clone().sub(from); const mesh = this.mesh(new THREE.CylinderGeometry(radius, radius, delta.length(), 10), material, parent as THREE.Group, name);
    mesh.position.copy(from).add(to).multiplyScalar(.5); mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), delta.normalize()); return mesh;
  }
  private light(light: THREE.Light, parent = this.group): THREE.Light { this.lights.add(light); parent.add(light); return light; }

  private buildOffice(): void {
    this.box(this.group, this.carpet, 0, -.18, 0, 48, .36, 54, 'government-office-floor');
    this.box(this.group, this.white, 0, 13.7, 0, 48, .45, 54, 'government-office-ceiling');
    for (const x of [-23.7, 23.7]) this.box(this.group, this.darkConcrete, x, 6.8, 0, .6, 13.6, 54);
    this.box(this.group, this.darkConcrete, 0, 6.8, 26.7, 48, 13.6, .6);

    const glassWall = new THREE.Group(); glassWall.name = 'government-glass-wall'; glassWall.position.z = -26.45; this.group.add(glassWall);
    for (let col = -4; col <= 4; col++) {
      this.box(glassWall, this.glass, col * 5.25, 7, 0, 4.95, 12.7, .12);
      this.box(glassWall, this.metal, col * 5.25 - 2.62, 7, .08, .18, 13.4, .3);
    }
    this.box(glassWall, this.metal, 0, .45, .08, 47, .3, .45); this.box(glassWall, this.metal, 0, 13.45, .08, 47, .3, .45);
    for (let i = 0; i < 13; i++) {
      const tower = new THREE.Group(); tower.name = 'government-city-tower'; tower.position.set(-42 + i * 7.2, -1, -39 - (i % 3) * 9); this.group.add(tower);
      const height = 18 + i % 5 * 5; this.box(tower, this.darkConcrete, 0, height / 2, 0, 5.8, height, 6.4);
      for (let y = 3; y < height - 2; y += 3.2) for (const x of [-1.7, 0, 1.7]) this.box(tower, this.green, x, y, 3.22, 1.1, 1.6, .04);
    }

    const chair = new THREE.Group(); chair.name = 'government-restraint-chair'; chair.position.set(0, 0, -2.2); this.group.add(chair);
    this.box(chair, this.metal, 0, 1.4, 0, 2.15, .28, 2.1); this.box(chair, this.leather, 0, 1.66, -.05, 1.85, .25, 1.8);
    const back = this.box(chair, this.leather, 0, 3.2, .75, 1.95, 3.2, .32, 'government-chair-back'); back.rotation.x = -.12;
    for (const side of [-1, 1]) {
      this.box(chair, this.metal, side * 1.18, 2.1, .05, .18, 1.45, 1.9);
      this.box(chair, this.leather, side * 1.18, 2.78, -.1, .52, .16, 1.25);
      this.box(chair, this.black, side * 1.18, 2.84, -.22, .7, .12, .36, `government-wrist-restraint-${side}`);
      this.line(chair, this.metal, new THREE.Vector3(side * .82, .1, .62), new THREE.Vector3(side * 1.12, 1.55, .25), .07);
    }
    for (const side of [-.62, .62]) this.box(chair, this.black, side, .65, -.18, .48, .18, .38, `government-ankle-restraint-${side}`);

    const serumRig = new THREE.Group(); serumRig.name = 'government-serum-rig'; serumRig.position.set(3.25, 0, -3.5); this.group.add(serumRig);
    this.cylinder(serumRig, this.metal, 0, 3.4, 0, .09, 6.8); this.box(serumRig, this.metal, -.52, 6.65, 0, 1.2, .1, .1);
    const bag = this.sphere(serumRig, this.water, -.9, 5.75, 0, .45, 'government-serum-bag'); bag.scale.set(.7, 1.45, .42); this.serum = bag;
    this.line(serumRig, this.water, new THREE.Vector3(-.9, 5.25, 0), new THREE.Vector3(-3.95, 2.7, 1.15), .035, 'government-serum-line');
    this.sphere(serumRig, this.red, -.9, 5.45, .32, .07);

    const desk = new THREE.Group(); desk.position.set(-10.5, 0, -10); desk.rotation.y = .18; this.group.add(desk);
    this.box(desk, this.wood, 0, 2.7, 0, 7.5, .32, 3.1); for (const x of [-3.3, 3.3]) this.box(desk, this.wood, x, 1.3, 0, .35, 2.6, 2.8);
    this.box(desk, this.black, 1.6, 3.05, -.35, 1.7, .16, 1.1, 'government-earpiece-case');
    this.box(desk, this.black, -1.4, 3.2, -.1, 2.4, .18, 1.65); this.box(desk, this.green, -1.4, 3.31, -.1, 1.95, .035, 1.25);
    for (let x = -18; x <= 18; x += 9) this.box(this.group, this.white, x, 13.38, -6, 5.8, .16, 2.2, `government-ceiling-panel-${x}`);

    const sprinklerGroup = new THREE.Group(); sprinklerGroup.name = 'government-sprinklers'; sprinklerGroup.visible = false; this.group.add(sprinklerGroup); this.sprinklers = sprinklerGroup;
    for (let i = 0; i < 72; i++) {
      const x = -21 + (i * 7.91) % 42; const z = -22 + (i * 13.37) % 44; const drop = this.sphere(sprinklerGroup, this.water, x, 4 + (i % 9), z, .045);
      drop.castShadow = false; drop.userData.origin = 2.5 + i % 11 * .9;
    }
    for (const x of [-13, 0, 13]) {
      const head = this.cylinder(this.group, this.metal, x, 13.15, -6, .12, .45); head.rotation.z = Math.PI / 2;
      this.mesh(new THREE.TorusGeometry(.3, .04, 8, 18), this.metal, this.group).position.set(x, 12.85, -6);
    }
    const alarm = new THREE.PointLight(0xff2418, 0, 34, 2); alarm.name = 'government-fire-alarm'; alarm.position.set(0, 12.5, 8); this.light(alarm); this.alarm = alarm;
    this.sphere(this.group, this.red, 0, 12.5, 8, .28, 'government-alarm-lens');
    const fill = new THREE.RectAreaLight(0xdde9e2, 34, 26, 11); fill.position.set(0, 7, -25.7); fill.lookAt(0, 5, 0); this.light(fill);
  }

  private buildRoof(): void {
    this.box(this.group, this.concrete, 0, -.25, 0, 62, .5, 90, 'government-roof-deck');
    for (const x of [-30.6, 30.6]) this.box(this.group, this.darkConcrete, x, 1.25, 0, .8, 2.5, 90);
    for (const z of [-44.6, 44.6]) this.box(this.group, this.darkConcrete, 0, 1.25, z, 62, 2.5, .8);
    for (let i = 0; i < 18; i++) {
      const seam = this.box(this.group, this.darkConcrete, -27 + i % 6 * 11, .015, -38 + Math.floor(i / 6) * 38, .06, .02, 34);
      seam.rotation.y = i % 2 ? Math.PI / 2 : 0;
    }
    const helipad = new THREE.Group(); helipad.name = 'government-helipad'; helipad.position.set(7, .05, -20); this.group.add(helipad);
    const ring = this.mesh(new THREE.RingGeometry(10.5, 10.9, 96), this.white, helipad); ring.rotation.x = -Math.PI / 2;
    this.box(helipad, this.white, 0, .02, 0, 1.1, .05, 9); this.box(helipad, this.white, 0, .02, 0, 7.2, .05, 1.1);
    for (const z of [-4, 4]) this.box(helipad, this.white, 0, .02, z, 6.8, .05, .8);

    const access = new THREE.Group(); access.position.set(-19, 0, 24); this.group.add(access);
    this.box(access, this.darkConcrete, 0, 4, 0, 13, 8, 12, 'government-roof-access');
    this.box(access, this.black, 0, 3.2, -6.05, 4.4, 6.2, .25); this.box(access, this.metal, 1.55, 3.2, -6.25, .12, 5.8, .12);
    for (const x of [-4.6, 4.6]) this.cylinder(access, this.metal, x, 9.1, 1, 1.1, 2.2);
    for (const [x, z] of [[-17, -9], [22, 13], [-22, -18], [20, 31]] as const) {
      const hvac = new THREE.Group(); hvac.position.set(x, 0, z); this.group.add(hvac);
      this.box(hvac, this.metal, 0, 1.7, 0, 6, 3.4, 7);
      for (let slit = -2.3; slit <= 2.3; slit += .75) this.box(hvac, this.black, slit, 1.9, -3.53, .38, 2.2, .05);
    }
    this.buildHelicopter(); this.buildBulletLines();
    const sun = new THREE.DirectionalLight(0xe7eee5, .62); sun.position.set(-25, 48, 18); sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048); this.light(sun);
    const sky = new THREE.HemisphereLight(0xb9c9ca, 0x424845, .34); this.light(sky);
  }

  private buildHelicopter(): void {
    const helicopter = new THREE.Group(); helicopter.name = 'government-helicopter'; helicopter.position.set(7, 0, -20); helicopter.rotation.y = Math.PI; this.group.add(helicopter);
    const hull = this.sphere(helicopter, this.helicopterPaint, 0, 4.4, 0, 3.6, 'government-helicopter-hull'); hull.scale.set(1.2, .85, 1.7);
    const belly = this.sphere(helicopter, this.metal, 0, 3.35, .3, 2.9); belly.scale.set(1.15, .52, 1.55);
    const cockpit = this.sphere(helicopter, this.glass, 0, 4.75, -3.25, 2.7, 'government-cockpit'); cockpit.scale.set(1.2, .82, .76);
    for (const x of [-1.28, 1.28]) this.box(helicopter, this.metal, x, 4.6, -4.15, .14, 3.4, 3.2);
    this.box(helicopter, this.metal, 0, 6.45, -.3, 2.4, .45, 5.8);
    const door = this.box(helicopter, this.metal, 3.48, 4.2, .35, .12, 3.8, 4.5, 'government-helicopter-door'); this.helicopterDoor = door;
    const tail = this.line(helicopter, this.helicopterPaint, new THREE.Vector3(0, 4.4, 2.8), new THREE.Vector3(0, 5.2, 13.8), .72, 'government-tail-boom');
    tail.scale.x = .75; tail.scale.z = .75;
    this.box(helicopter, this.helicopterPaint, 0, 5.8, 13.4, .24, 3.2, 3.8); this.box(helicopter, this.helicopterPaint, 0, 7.05, 12.7, 3.4, .18, 2.6);
    const rotor = new THREE.Group(); rotor.name = 'government-main-rotor'; rotor.position.set(0, 7.25, -.2); helicopter.add(rotor); this.rotor = rotor;
    this.cylinder(rotor, this.metal, 0, 0, 0, .23, 1.3);
    for (let i = 0; i < 4; i++) {
      const blade = this.box(rotor, this.black, 0, .15, -6.7, .36, .12, 13.4); blade.rotation.y = i * Math.PI / 2;
    }
    const tailRotor = new THREE.Group(); tailRotor.name = 'government-tail-rotor'; tailRotor.position.set(.18, 5.4, 14.4); tailRotor.rotation.z = Math.PI / 2; helicopter.add(tailRotor); this.tailRotor = tailRotor;
    for (let i = 0; i < 5; i++) { const blade = this.box(tailRotor, this.black, 0, 0, 1.35, .22, .12, 2.7); blade.rotation.y = i * Math.PI * 2 / 5; }
    const skids = new THREE.Group(); skids.name = 'government-skids'; helicopter.add(skids);
    for (const x of [-2.6, 2.6]) {
      this.line(skids, this.metal, new THREE.Vector3(x, .8, -4.5), new THREE.Vector3(x, .8, 4), .14);
      for (const z of [-2.6, 2.4]) this.line(skids, this.metal, new THREE.Vector3(x, .8, z), new THREE.Vector3(x * .72, 2.5, z), .11);
    }
    for (const x of [-1.25, 1.25]) {
      this.box(helicopter, this.leather, x, 3.35, -2.4, 1.25, .32, 1.35); this.box(helicopter, this.leather, x, 4.25, -1.82, 1.25, 1.55, .24);
      this.line(helicopter, this.black, new THREE.Vector3(x, 3.6, -2.1), new THREE.Vector3(x * .62, 2.65, -3), .055);
    }
    const panel = this.box(helicopter, this.black, 0, 3.7, -4.1, 3.3, 1.05, .3, 'government-flight-panel'); panel.rotation.x = -.3;
    for (let i = 0; i < 10; i++) this.sphere(helicopter, i % 3 ? this.green : this.red, -1.3 + i % 5 * .65, 3.85 + Math.floor(i / 5) * .34, -4.3, .08);
    const glow = new THREE.PointLight(0x61d49f, 0, 10, 2); glow.name = 'government-cockpit-glow'; glow.position.set(0, 4.1, -3.6); this.light(glow, helicopter); this.cockpitGlow = glow;
  }

  private buildBulletLines(): void {
    const lines = new THREE.Group(); lines.name = 'government-bullet-lines'; lines.visible = false; this.group.add(lines); this.bulletLines = lines;
    const tracer = this.material(0xffe6aa, .12, .35, 0xffbd55, 4.2);
    const start = new THREE.Vector3(0, 3.15, -8.8);
    const ends = [new THREE.Vector3(-.75, 3.45, 2.5), new THREE.Vector3(.25, 2.75, 2.65), new THREE.Vector3(.8, 2.25, 2.35)];
    for (let index = 0; index < 3; index++) {
      const group = new THREE.Group(); group.name = `government-bullet-line-${index}`; group.visible = false; lines.add(group);
      const end = ends[index]; const trace = this.line(group, tracer, start, end, .024); trace.castShadow = false;
      const bullet = this.sphere(group, tracer, start.x, start.y, start.z, .09, `government-bullet-${index}`); bullet.castShadow = false; bullet.userData.from = start.clone(); bullet.userData.to = end.clone();
      this.bullets.push(bullet);
      const flash = this.sphere(group, tracer, start.x, start.y, start.z, .25); flash.scale.z = 2.8; flash.castShadow = false;
    }
  }

  update(journey: FilmJourney | undefined, elapsed: number): void {
    const encounter = journey?.government;
    if (this.setId === 'film_government_office') {
      const alarming = encounter?.kind === 'questioning' && encounter.phase === 'alarm';
      if (this.sprinklers) {
        this.sprinklers.visible = alarming;
        if (alarming) for (const drop of this.sprinklers.children) drop.position.y = .5 + ((Number(drop.userData.origin) - elapsed * 9) % 12 + 12) % 12;
      }
      if (this.alarm) this.alarm.intensity = alarming ? 95 + Math.sin(elapsed * 13) * 55 : 0;
      if (this.serum) {
        const pressure = encounter?.kind === 'questioning' && encounter.phase === 'monologue' ? 1 - (encounter.resolve ?? 1) : 0;
        this.serum.scale.y = 1 + Math.sin(elapsed * 3.4) * .035 + pressure * .12;
      }
      return;
    }
    const rooftop = encounter?.kind === 'rooftop' ? encounter : undefined;
    if (this.bulletLines) {
      this.bulletLines.visible = rooftop?.phase === 'bullet_time';
      this.bulletLines.children.forEach((line, index) => {
        const beat = GOVERNMENT_RESCUE.rooftop.beats[index]; const age = rooftop ? rooftop.elapsed - beat : 99;
        line.visible = Boolean(rooftop?.phase === 'bullet_time' && age > -.62 && age < .72);
        const bullet = this.bullets[index]; if (line.visible && bullet) {
          const progress = Math.max(0, Math.min(1, (age + .62) / 1.34));
          bullet.position.lerpVectors(bullet.userData.from as THREE.Vector3, bullet.userData.to as THREE.Vector3, progress);
        }
      });
    }
    const spin = rooftop?.phase === 'downloading' ? Math.min(1, rooftop.elapsed / GOVERNMENT_RESCUE.rooftop.download) : rooftop?.phase === 'done' ? 1 : 0;
    if (this.rotor) this.rotor.rotation.y = elapsed * (.4 + spin * 13);
    if (this.tailRotor) this.tailRotor.rotation.y = elapsed * (.7 + spin * 19);
    if (this.cockpitGlow) this.cockpitGlow.intensity = spin * (38 + Math.sin(elapsed * 8) * 9);
    if (this.helicopterDoor) this.helicopterDoor.rotation.z = -Math.PI * .48 * Math.max(0, Math.min(1, (rooftop?.elapsed ?? 0) / 2.8)) * (rooftop?.phase === 'downloading' ? 1 : 0);
  }

  dispose(): void {
    this.group.removeFromParent(); this.geometries.forEach(geometry => geometry.dispose()); this.materials.forEach(material => material.dispose());
    this.lights.forEach(light => light.dispose()); this.geometries.clear(); this.materials.clear(); this.lights.clear(); this.bullets = [];
  }
}
