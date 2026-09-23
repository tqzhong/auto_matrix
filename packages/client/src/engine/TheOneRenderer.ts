import * as THREE from 'three';
import { THE_ONE, type FilmJourney } from '@auto_matrix/shared';

type TheOneSet = 'film_heart_hotel' | 'film_neb_deck' | 'film_final_phone';

/** Story-owned scenery and effects for Neo's first resurrection.
 * Animated props only read the saved encounter clock, so pause and restore
 * cannot move a bullet, EMP flash, or flight trail behind the server state. */
export class TheOneRenderer {
  private group = new THREE.Group();
  private geometries = new Set<THREE.BufferGeometry>();
  private materials = new Set<THREE.Material>();
  private lights = new Set<THREE.Light>();
  private door?: THREE.Mesh;
  private phoneGlow?: THREE.MeshStandardMaterial;
  private gunfire?: THREE.Group;
  private bulletField?: THREE.Group;
  private bulletOrigins: THREE.Vector3[] = [];
  private codeShell?: THREE.Group;
  private burst?: THREE.Group;
  private flatline?: THREE.Group;
  private heartbeat?: THREE.Group;
  private cutters?: THREE.Group;
  private empSwitch?: THREE.Group;
  private empFlash?: THREE.Mesh;
  private commuters?: THREE.Group;
  private flightRings?: THREE.Group;
  private flightTrail?: THREE.Group;

  private plaster = this.material(0x8f907b, .92, .02);
  private wallpaper = this.material(0x69715c, .88, .02);
  private wood = this.material(0x493628, .78, .06);
  private brass = this.material(0x8b7443, .4, .68);
  private black = this.material(0x0c1110, .42, .55);
  private steel = this.material(0x53605d, .42, .7);
  private carpet = this.material(0x314f55, .98, .01);
  private code = this.material(0x45ef91, .2, .12, 0x21e77f, 3.6);
  private red = this.material(0xe55740, .24, .08, 0xc52318, 3.8);
  private white = this.material(0xf4f7df, .2, .06, 0xdfeec8, 1.5);
  private glass = this.physical(0x94b7b1, .2, .28);

  constructor(private root: THREE.Group, readonly setId: TheOneSet) {
    this.group.name = 'the-one-set'; this.root.add(this.group);
    if (setId === 'film_heart_hotel') this.buildHotel();
    else if (setId === 'film_neb_deck') this.buildShipOverlay();
    else this.buildFinalStreet();
  }

  private material(color: number, roughness: number, metalness: number, emissive = 0, emissiveIntensity = 0): THREE.MeshStandardMaterial {
    const material = new THREE.MeshStandardMaterial({ color, roughness, metalness, emissive, emissiveIntensity });
    this.materials.add(material); return material;
  }
  private basic(color: number, opacity = 1): THREE.MeshBasicMaterial {
    const material = new THREE.MeshBasicMaterial({ color, transparent: opacity < 1, opacity, depthWrite: opacity >= 1, side: THREE.DoubleSide, toneMapped: false });
    this.materials.add(material); return material;
  }
  private physical(color: number, roughness: number, opacity: number): THREE.MeshPhysicalMaterial {
    const material = new THREE.MeshPhysicalMaterial({ color, roughness, metalness: .08, transparent: true, opacity,
      transmission: Math.max(0, .82 - opacity), thickness: .12, clearcoat: .72, side: THREE.DoubleSide, depthWrite: opacity > .4 });
    this.materials.add(material); return material;
  }
  private mesh(geometry: THREE.BufferGeometry, material: THREE.Material, parent: THREE.Object3D = this.group, name?: string): THREE.Mesh {
    this.geometries.add(geometry); const mesh = new THREE.Mesh(geometry, material); mesh.castShadow = true; mesh.receiveShadow = true;
    if (name) mesh.name = name; parent.add(mesh); return mesh;
  }
  private box(parent: THREE.Object3D, material: THREE.Material, x: number, y: number, z: number, w: number, h: number, d: number, name?: string): THREE.Mesh {
    const mesh = this.mesh(new THREE.BoxGeometry(w, h, d), material, parent, name); mesh.position.set(x, y, z); return mesh;
  }
  private cylinder(parent: THREE.Object3D, material: THREE.Material, x: number, y: number, z: number, radius: number, height: number, name?: string): THREE.Mesh {
    const mesh = this.mesh(new THREE.CylinderGeometry(radius, radius, height, 14), material, parent, name); mesh.position.set(x, y, z); return mesh;
  }
  private sphere(parent: THREE.Object3D, material: THREE.Material, x: number, y: number, z: number, radius: number, name?: string): THREE.Mesh {
    const mesh = this.mesh(new THREE.SphereGeometry(radius, 18, 12), material, parent, name); mesh.position.set(x, y, z); return mesh;
  }
  private line(parent: THREE.Object3D, material: THREE.Material, from: THREE.Vector3, to: THREE.Vector3, radius: number): THREE.Mesh {
    const delta = to.clone().sub(from); const mesh = this.mesh(new THREE.CylinderGeometry(radius, radius, delta.length(), 7), material, parent);
    mesh.position.copy(from).add(to).multiplyScalar(.5); mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), delta.normalize()); return mesh;
  }
  private light(light: THREE.Light, parent: THREE.Object3D = this.group): void { this.lights.add(light); parent.add(light); }

  private buildHotel(): void {
    const hotel = new THREE.Group(); hotel.name = 'one-hotel-corridor'; this.group.add(hotel);
    this.box(hotel, this.carpet, 0, -.16, 0, 14, .32, 50);
    this.box(hotel, this.plaster, 0, 10.8, 0, 14, .42, 50);
    for (const side of [-1, 1]) {
      this.box(hotel, this.wallpaper, side * 7, 5.3, 0, .35, 10.6, 50);
      this.box(hotel, this.wood, side * 6.72, 1.05, 0, .12, 2.1, 50);
      for (let z = -23; z <= 22; z += 8) {
        this.box(hotel, this.wood, side * 6.78, 4.7, z, .28, 7.7, 4.7);
        const panel = this.box(hotel, this.black, side * 6.58, 4.65, z, .08, 6.65, 3.9);
        panel.material = this.material(0x3d3027, .76, .06);
        this.sphere(hotel, this.brass, side * 6.48, 4.4, z + 1.2, .1);
      }
    }
    for (let z = -21; z <= 21; z += 8) {
      this.box(hotel, this.black, 0, 10.48, z, 4.4, .18, 1.05);
      const lampMaterial = this.material(0xe6dec0, .24, .05, 0xd9e2b8, 2.1);
      this.box(hotel, lampMaterial, 0, 10.34, z, 3.8, .05, .62);
      const lamp = new THREE.PointLight(0xdde2b8, 14, 15, 2); lamp.position.set(0, 9.9, z); this.light(lamp, hotel);
    }
    const doorFrame = new THREE.Group(); doorFrame.position.set(0, 0, -16); hotel.add(doorFrame);
    this.box(doorFrame, this.wood, 0, 5.1, -.22, 5.8, 10.2, .45);
    const door = this.box(doorFrame, this.material(0x42342b, .74, .08), 0, 4.65, .05, 4.45, 8.7, .28, 'one-room-303-door');
    door.geometry.translate(-2.18, 0, 0); door.position.x = 2.18; this.door = door;
    this.box(door, this.brass, -2.1, 1.4, .18, .62, .3, .05);
    for (const x of [-1.2, 0, 1.2]) this.box(doorFrame, this.brass, x, 8.35, .24, .64, .09, .04);

    const phone = new THREE.Group(); phone.name = 'one-exit-phone'; phone.position.set(0, 0, -23.5); hotel.add(phone);
    this.box(phone, this.wood, 0, 3.35, .4, 2.6, 6.7, .5); this.box(phone, this.black, 0, 3.7, .08, 1.65, 2.2, .42);
    this.phoneGlow = this.material(0x56846b, .28, .15, 0x2bd37b, .25); this.box(phone, this.phoneGlow, 0, 5.05, -.16, 1.35, .5, .08);
    this.box(phone, this.black, -.62, 3.6, -.26, .3, 1.45, .22); this.line(phone, this.black, new THREE.Vector3(-.62, 2.9, -.2), new THREE.Vector3(-.28, 2.15, .08), .035);

    const flashes = new THREE.Group(); flashes.name = 'one-gunfire-flashes'; flashes.visible = false; flashes.position.set(0, 3.2, -19.4); hotel.add(flashes); this.gunfire = flashes;
    for (let i = 0; i < 3; i++) {
      const flash = this.mesh(new THREE.OctahedronGeometry(.24 + i * .04), this.basic(0xfff2b3, .92), flashes); flash.position.set((i - 1) * .18, i * .13, i * .12);
      const beam = this.mesh(new THREE.CylinderGeometry(.018, .095, 5.5, 7, 1, true), this.basic(0xffd27a, .32), flashes); beam.rotation.x = Math.PI / 2; beam.position.z = 2.75;
    }

    const bullets = new THREE.Group(); bullets.name = 'one-bullet-field'; bullets.visible = false; hotel.add(bullets); this.bulletField = bullets;
    for (let i = 0; i < 24; i++) {
      const x = (i % 6 - 2.5) * .58 + Math.sin(i * 2.1) * .12; const y = 1.65 + Math.floor(i / 6) * .48 + Math.cos(i) * .1; const z = -19 + (i % 4) * .16;
      const bullet = this.mesh(new THREE.CapsuleGeometry(.055, .25, 4, 8), this.brass, bullets); bullet.rotation.x = Math.PI / 2; bullet.position.set(x, y, z); this.bulletOrigins.push(bullet.position.clone());
    }

    const codeShell = new THREE.Group(); codeShell.name = 'one-code-shell'; codeShell.visible = false; hotel.add(codeShell); this.codeShell = codeShell;
    for (let side = -1; side <= 1; side += 2) for (let z = -24; z <= 8; z += 2.7) {
      const strip = this.box(codeShell, this.code, side * 6.62, 4.8, z, .025, 8.8, .035);
      strip.scale.y = .35 + ((Math.abs(Math.round(z * 11)) % 7) / 9);
    }
    for (let z = -23; z <= 7; z += 2.2) this.box(codeShell, this.code, 0, .035, z, 12.8, .025, .035);

    const burst = new THREE.Group(); burst.name = 'one-smith-burst'; burst.visible = false; burst.position.set(0, 2.6, -20.7); hotel.add(burst); this.burst = burst;
    for (let i = 0; i < 42; i++) {
      const shard = this.mesh(new THREE.TetrahedronGeometry(.07 + i % 4 * .035), i % 5 ? this.code : this.black, burst);
      const theta = i * 2.399; const radius = .35 + (i % 7) * .17;
      shard.userData.origin = new THREE.Vector3(Math.cos(theta) * radius, (i % 9 - 4) * .19, Math.sin(theta) * radius);
      shard.position.copy(shard.userData.origin); shard.rotation.set(i * .4, i * .7, i * .2);
    }
  }

  private monitorLine(parent: THREE.Object3D, name: string, pulse: boolean): THREE.Group {
    const group = new THREE.Group(); group.name = name; parent.add(group);
    const material = this.basic(pulse ? 0x65f29a : 0x92a598, .92);
    const points: THREE.Vector3[] = [];
    for (let i = 0; i <= 30; i++) {
      const x = -2.6 + i / 30 * 5.2; const spike = pulse && i % 10 === 5 ? .82 : pulse && i % 10 === 6 ? -.35 : 0;
      points.push(new THREE.Vector3(x, spike, 0));
    }
    const geometry = new THREE.BufferGeometry().setFromPoints(points); this.geometries.add(geometry);
    const line = new THREE.Line(geometry, material); group.add(line); return group;
  }

  private buildShipOverlay(): void {
    const monitor = new THREE.Group(); monitor.name = 'one-life-monitor'; monitor.position.set(10.4, 4.4, -5); monitor.rotation.y = -Math.PI / 2; this.group.add(monitor);
    this.box(monitor, this.black, 0, 0, .18, 6.3, 2.6, .45); this.box(monitor, this.material(0x16251f, .3, .08, 0x163c29, .35), 0, 0, -.08, 5.65, 2.05, .06);
    this.flatline = this.monitorLine(monitor, 'one-flatline-line', false); this.heartbeat = this.monitorLine(monitor, 'one-heart-pulse', true); this.heartbeat.visible = false;

    const cutters = new THREE.Group(); cutters.name = 'one-sentinel-cutters'; cutters.visible = false; this.group.add(cutters); this.cutters = cutters;
    for (const side of [-1, 1]) {
      const claw = new THREE.Group(); claw.position.set(side * 15, 9, -2); claw.rotation.z = side * -.45; cutters.add(claw);
      this.sphere(claw, this.black, 0, 0, 0, 1.2); for (let arm = 0; arm < 4; arm++) {
        const theta = arm * Math.PI / 2; this.line(claw, this.steel, new THREE.Vector3(), new THREE.Vector3(Math.cos(theta) * 4.8, -2.2, Math.sin(theta) * 4.8), .18);
      }
      const beam = this.mesh(new THREE.CylinderGeometry(.035, .12, 13, 9), this.red, claw); beam.position.set(0, -6.5, 0);
    }
    const control = new THREE.Group(); control.name = 'one-emp-switch'; control.position.set(-2.5, 1.1, -1.8); this.group.add(control); this.empSwitch = control;
    this.box(control, this.black, 0, .8, 0, 2.8, 1.6, 1.8); const handle = this.box(control, this.brass, 0, 1.8, 0, .24, 2.1, .24, 'one-emp-handle'); handle.geometry.translate(0, -1, 0); handle.position.y = 2.8;
    const flash = this.mesh(new THREE.SphereGeometry(34, 28, 18), this.basic(0xe9fff2, 0), this.group, 'one-emp-flash'); flash.visible = false; flash.scale.set(.05, .05, .05); this.empFlash = flash;
  }

  private buildFinalStreet(): void {
    const street = new THREE.Group(); street.name = 'one-final-street'; this.group.add(street);
    this.box(street, this.material(0x343a3b, .94, .04), 0, -.18, 0, 22, .35, 84);
    for (const side of [-1, 1]) {
      this.box(street, this.material(0x8f9690, .9, .03), side * 18, -.08, 0, 14, .2, 84);
      this.box(street, this.material(side < 0 ? 0x887c6c : 0x777f7b, .88, .06), side * 24.5, 13, 0, 2.8, 26, 84);
      for (let z = -38; z <= 38; z += 7) for (let y = 4; y <= 22; y += 4.5) {
        const window = this.box(street, this.material(0x77989d, .22, .28, 0x8fb8b8, .32), side * 22.95, y, z, .06, 2.5, 4.2);
        window.rotation.y = 0;
      }
      for (let z = -35; z <= 35; z += 14) {
        const pole = this.cylinder(street, this.steel, side * 11.8, 4.3, z, .1, 8.6); const lamp = this.sphere(street, this.white, side * 11.8, 8.5, z, .42);
        pole.castShadow = lamp.castShadow = false;
      }
    }
    const skyline = new THREE.Group(); skyline.name = 'one-final-skyline'; skyline.position.z = -54; street.add(skyline);
    for (let i = 0; i < 15; i++) {
      const x = (i - 7) * 7.2; const height = 17 + (i * 13) % 33;
      this.box(skyline, this.material(i % 2 ? 0x66736f : 0x596965, .82, .1), x, height / 2, -4 - i % 3 * 4, 6.2, height, 7.5);
    }
    const booth = new THREE.Group(); booth.name = 'one-final-phone-booth'; booth.position.set(0, 0, -25); street.add(booth);
    for (const x of [-1.55, 1.55]) for (const z of [-1.3, 1.3]) this.box(booth, this.steel, x, 3.35, z, .16, 6.7, .16);
    this.box(booth, this.steel, 0, 6.75, 0, 3.45, .22, 3); this.box(booth, this.glass, 0, 3.45, -1.38, 2.9, 6.1, .05);
    this.box(booth, this.glass, -1.64, 3.45, 0, .05, 6.1, 2.45); this.box(booth, this.glass, 1.64, 3.45, 0, .05, 6.1, 2.45);
    this.box(booth, this.black, -.65, 3.5, .95, 1.15, 2.15, .38); this.box(booth, this.brass, -.65, 4.6, .72, .9, .22, .08);

    const commuters = new THREE.Group(); commuters.name = 'one-final-commuters'; street.add(commuters); this.commuters = commuters;
    for (let i = 0; i < 18; i++) {
      const person = new THREE.Group(); person.userData.base = { x: (i % 2 ? 1 : -1) * (12.5 + i % 3 * 2), z: -36 + i * 4.6, pace: .55 + i % 4 * .12 }; commuters.add(person);
      this.cylinder(person, this.material(i % 3 ? 0x283331 : 0x4a4e48, .8, .06), 0, 1.65, 0, .38, 2.8); this.sphere(person, this.material(0xa57e64, .8, .02), 0, 3.35, 0, .38);
    }

    const rings = new THREE.Group(); rings.name = 'one-flight-rings'; rings.visible = false; street.add(rings); this.flightRings = rings;
    for (let i = 0; i < 10; i++) {
      const ring = this.mesh(new THREE.TorusGeometry(2.2 + i * .34, .035, 6, 48), this.basic(0xa9d8bd, .35), rings); ring.position.set(0, 2 + i * 3.3, -25 - i * 4.2); ring.rotation.x = Math.PI / 2;
    }
    const trail = new THREE.Group(); trail.name = 'one-flight-trail'; trail.visible = false; street.add(trail); this.flightTrail = trail;
    for (let i = 0; i < 12; i++) {
      const ribbon = this.mesh(new THREE.CylinderGeometry(.02 + i * .012, .11 + i * .018, 4.4 + i * .48, 7, 1, true), this.basic(0xc7ead5, .28), trail);
      ribbon.rotation.x = Math.PI / 2; ribbon.position.z = i * 1.7; ribbon.scale.x = .7 + (i % 3) * .2;
    }
  }

  update(journey: FilmJourney | undefined, _elapsed: number): void {
    const encounter = journey?.theOne;
    if (!encounter || journey?.visiting) { this.group.visible = false; return; }
    this.group.visible = true;
    if (this.setId === 'film_heart_hotel') {
      const death = encounter.kind === 'death'; const open = encounter.kind === 'return' ? 1 : death && encounter.phase !== 'ready' ? THREE.MathUtils.smoothstep(encounter.elapsed, 0, .8) : 0;
      if (this.door) this.door.rotation.y = -open * 1.18;
      if (this.phoneGlow) this.phoneGlow.emissiveIntensity = encounter.kind === 'return' && ['exit_run', 'exit_ready', 'exit_phone'].includes(encounter.phase)
        ? 1.8 + Math.sin(encounter.deadline * 7) * .7 : .25;
      if (this.gunfire) {
        this.gunfire.visible = death && encounter.phase === 'gunfire';
        this.gunfire.children.forEach((child, index) => { child.visible = this.gunfire!.visible && Math.sin(encounter.elapsed * 37 + index * 2.3) > .1; });
      }
      const bulletsVisible = encounter.kind === 'return' && ['code_reveal', 'bullet_window', 'bullet_stop'].includes(encounter.phase);
      if (this.bulletField) {
        this.bulletField.visible = bulletsVisible;
        const approach = encounter.phase === 'code_reveal' ? 0 : encounter.phase === 'bullet_window' ? Math.min(1, encounter.elapsed / THE_ONE.return.bulletBeat) : 1;
        const fall = encounter.phase === 'bullet_stop' ? THREE.MathUtils.smoothstep(encounter.elapsed, 1.55, THE_ONE.return.bulletStop) : 0;
        this.bulletField.children.forEach((child, index) => {
          const origin = this.bulletOrigins[index]; child.position.set(origin.x, origin.y - fall * (1.2 + index % 4 * .17), origin.z + approach * 5.1);
          child.rotation.z = fall * (index % 2 ? 1 : -1) * 1.3;
        });
      }
      if (this.codeShell) {
        this.codeShell.visible = encounter.kind === 'return' && ['code_reveal', 'bullet_window', 'bullet_stop', 'dive', 'burst'].includes(encounter.phase);
        const pulse = .88 + Math.sin(encounter.elapsed * 9) * .12; this.codeShell.scale.set(pulse, 1, pulse);
      }
      if (this.burst) {
        this.burst.visible = encounter.kind === 'return' && encounter.phase === 'burst';
        const spread = THREE.MathUtils.smoothstep(encounter.elapsed, .65, THE_ONE.return.burst);
        this.burst.children.forEach((child, index) => { const origin = child.userData.origin as THREE.Vector3; child.position.copy(origin).multiplyScalar(1 + spread * 3.8); child.rotation.y = index + spread * 9; });
      }
      return;
    }
    if (this.setId === 'film_neb_deck') {
      const deadSignal = encounter.kind === 'death' && ['flatline', 'listening'].includes(encounter.phase);
      if (this.flatline) this.flatline.visible = deadSignal;
      if (this.heartbeat) { this.heartbeat.visible = encounter.kind === 'death' && ['kiss', 'revive'].includes(encounter.phase); this.heartbeat.scale.x = .94 + Math.sin(encounter.elapsed * 8) * .06; }
      if (this.cutters) {
        this.cutters.visible = encounter.kind === 'return' && encounter.phase === 'emp';
        this.cutters.rotation.y = Math.sin(encounter.elapsed * 2.4) * .08;
      }
      if (this.empSwitch) {
        this.empSwitch.visible = encounter.kind === 'return' && encounter.phase === 'emp';
        const handle = this.empSwitch.getObjectByName('one-emp-handle'); if (handle) handle.rotation.z = encounter.empFired ? -1.05 : -.16;
      }
      if (this.empFlash) {
        const flash = encounter.kind === 'return' && encounter.phase === 'emp' && encounter.empFired;
        this.empFlash.visible = Boolean(flash); const amount = flash ? THREE.MathUtils.smoothstep(encounter.elapsed, 1.1, 1.75) * (1 - THREE.MathUtils.smoothstep(encounter.elapsed, 2.15, THE_ONE.return.emp)) : 0;
        this.empFlash.scale.setScalar(.05 + amount); (this.empFlash.material as THREE.MeshBasicMaterial).opacity = amount * .78;
      }
      return;
    }
    const time = encounter.phase === 'call' ? encounter.elapsed : encounter.phase === 'takeoff' || encounter.phase === 'done' ? THE_ONE.flight.call + encounter.elapsed : 0;
    this.commuters?.children.forEach((person, index) => {
      const base = person.userData.base as { x: number; z: number; pace: number };
      person.position.set(base.x, 0, ((base.z + time * base.pace * (index % 2 ? 1 : -1) + 43) % 86 + 86) % 86 - 43);
    });
    const flying = encounter.kind === 'flight' && (encounter.phase === 'takeoff' || encounter.phase === 'done');
    if (this.flightRings) { this.flightRings.visible = flying; this.flightRings.scale.setScalar(.9 + encounter.altitude / THE_ONE.flight.maxAltitude * .35); }
    if (this.flightTrail) {
      this.flightTrail.visible = flying; this.flightTrail.position.set(encounter.flightX, encounter.altitude + 1.3, -25 - encounter.flightZ - encounter.altitude * 1.23);
      this.flightTrail.rotation.z = -encounter.flightX * .012;
    }
  }

  dispose(): void {
    this.group.removeFromParent(); this.group.clear(); this.geometries.forEach(geometry => geometry.dispose()); this.materials.forEach(material => material.dispose());
    this.lights.forEach(light => light.dispose()); this.geometries.clear(); this.materials.clear(); this.lights.clear();
  }
}
