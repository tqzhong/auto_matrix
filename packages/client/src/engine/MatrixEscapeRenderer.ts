import * as THREE from 'three';
import { MATRIX_ESCAPE, matrixEscapeRoot, type FilmJourney } from '@auto_matrix/shared';

/** Physical sets for the subway duel and Tank's three-part city escape.
 * Every moving prop is derived from the saved encounter instead of wall time. */
export class MatrixEscapeRenderer {
  private group = new THREE.Group();
  private geometries = new Set<THREE.BufferGeometry>();
  private materials = new Set<THREE.Material>();
  private lights = new Set<THREE.Light>();
  private phoneDebris?: THREE.Group;
  private wallBreak?: THREE.Group;
  private train?: THREE.Group;
  private trainLight?: THREE.PointLight;
  private subwayTransform?: THREE.Group;
  private phoneSparks?: THREE.Group;
  private phones: THREE.Group[] = [];
  private truck?: THREE.Group;
  private cityTransform?: THREE.Group;
  private roomDoor?: THREE.Mesh;

  private tile = this.material(0x91a79f, .48, .05);
  private tileDark = this.material(0x435b54, .62, .08);
  private steel = this.material(0x687571, .36, .72);
  private black = this.material(0x101715, .42, .5);
  private concrete = this.material(0x747a73, .88, .03);
  private plaster = this.material(0xa29e8d, .92, .02);
  private brick = this.material(0x79594a, .9, .02);
  private asphalt = this.material(0x2e3634, .96, .05);
  private wood = this.material(0x604735, .82, .03);
  private green = this.material(0x5ba27b, .34, .22, 0x234d39, .35);
  private red = this.material(0xb43e31, .44, .16, 0x6f160f, .25);
  private amber = this.material(0xffc363, .22, .08, 0xffa232, 3.2);
  private code = this.material(0x55f1a1, .18, .18, 0x28d87c, 4.2);
  private glass = this.physical(0x9fc3bf, .16, .32);

  constructor(private root: THREE.Group, readonly setId: 'film_subway_platform' | 'film_escape_streets') {
    this.group.name = 'matrix-escape-set'; this.root.add(this.group);
    if (setId === 'film_subway_platform') this.buildSubway(); else this.buildCity();
  }

  private material(color: number, roughness: number, metalness: number, emissive = 0, emissiveIntensity = 0): THREE.MeshStandardMaterial {
    const value = new THREE.MeshStandardMaterial({ color, roughness, metalness, emissive, emissiveIntensity });
    this.materials.add(value); return value;
  }
  private physical(color: number, roughness: number, opacity: number): THREE.MeshPhysicalMaterial {
    const value = new THREE.MeshPhysicalMaterial({ color, roughness, metalness: .08, transparent: true, opacity,
      transmission: Math.max(0, .84 - opacity), thickness: .14, clearcoat: .75, side: THREE.DoubleSide, depthWrite: opacity > .42 });
    this.materials.add(value); return value;
  }
  private mesh(geometry: THREE.BufferGeometry, material: THREE.Material, parent: THREE.Object3D = this.group, name?: string): THREE.Mesh {
    this.geometries.add(geometry); const mesh = new THREE.Mesh(geometry, material); mesh.castShadow = true; mesh.receiveShadow = true;
    if (name) mesh.name = name; parent.add(mesh); return mesh;
  }
  private box(parent: THREE.Object3D, material: THREE.Material, x: number, y: number, z: number, w: number, h: number, d: number, name?: string): THREE.Mesh {
    const mesh = this.mesh(new THREE.BoxGeometry(w, h, d), material, parent, name); mesh.position.set(x, y, z); return mesh;
  }
  private cylinder(parent: THREE.Object3D, material: THREE.Material, x: number, y: number, z: number, radius: number, height: number, name?: string): THREE.Mesh {
    const mesh = this.mesh(new THREE.CylinderGeometry(radius, radius, height, 18), material, parent, name); mesh.position.set(x, y, z); return mesh;
  }
  private sphere(parent: THREE.Object3D, material: THREE.Material, x: number, y: number, z: number, radius: number, name?: string): THREE.Mesh {
    const mesh = this.mesh(new THREE.SphereGeometry(radius, 16, 10), material, parent, name); mesh.position.set(x, y, z); return mesh;
  }
  private line(parent: THREE.Object3D, material: THREE.Material, from: THREE.Vector3, to: THREE.Vector3, radius: number, name?: string): THREE.Mesh {
    const delta = to.clone().sub(from); const mesh = this.mesh(new THREE.CylinderGeometry(radius, radius, delta.length(), 8), material, parent, name);
    mesh.position.copy(from).add(to).multiplyScalar(.5); mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), delta.normalize()); return mesh;
  }
  private light(light: THREE.Light, parent: THREE.Object3D = this.group): void { this.lights.add(light); parent.add(light); }

  private buildSubway(): void {
    const platform = new THREE.Group(); platform.name = 'matrix-subway-platform'; this.group.add(platform);
    this.box(platform, this.concrete, -5, -.28, 0, 36, .56, 104);
    this.box(platform, this.tileDark, -22.7, 6.5, 0, .7, 13, 104);
    this.box(platform, this.black, 17.3, -.72, 0, 10.5, 1.45, 104, 'matrix-subway-track');
    this.box(platform, this.tileDark, 22.65, 6.5, 0, .7, 13, 104);
    this.box(platform, this.amber, 11.65, .04, 0, .55, .08, 103);
    for (let z = -51; z <= 51; z += 2.35) this.box(platform, this.wood, 17.3, -.12, z, 8.4, .22, .34);
    for (const x of [15.15, 19.45]) this.box(platform, this.steel, x, .08, 0, .16, .22, 104);

    for (let z = -50; z <= 50; z += 5) for (let y = .55; y < 12.5; y += 1.05) {
      this.box(platform, (Math.round(y) + Math.round(z)) % 3 ? this.tile : this.tileDark, -22.28, y, z, .06, .92, 4.78);
      this.box(platform, this.tile, 22.28, y, z, .06, .92, 4.78);
    }
    for (let z = -46; z <= 46; z += 13) {
      for (const x of [-15.3, 8.2]) {
        const column = this.cylinder(platform, this.steel, x, 5.7, z, .72, 11.4); column.scale.z = .82;
        for (let y = 1.15; y < 10.8; y += 1.2) this.mesh(new THREE.TorusGeometry(.76, .055, 8, 22), this.black, column).position.y = y - 5.7;
      }
      const rib = new THREE.Shape(); rib.moveTo(-22, 0); rib.absellipse(0, 0, 22, 7.8, Math.PI, 0, true); rib.lineTo(22, .55);
      rib.absellipse(0, .55, 22.55, 8.35, 0, Math.PI, false); rib.closePath();
      this.mesh(new THREE.ExtrudeGeometry(rib, { depth: .34, bevelEnabled: false, curveSegments: 20 }), this.steel, platform).position.set(0, 6.2, z);
    }
    for (const z of [-34, -5, 25]) {
      const sign = new THREE.Group(); sign.position.set(-5, 9.2, z); platform.add(sign);
      this.box(sign, this.black, 0, 0, 0, 11, 2.2, .28); this.box(sign, this.tile, 0, 0, -.17, 9.8, 1.35, .04);
      for (const x of [-3.7, -1.25, 1.25, 3.7]) this.box(sign, this.tileDark, x, 0, -.21, 1.45, .18, .03);
      const bench = new THREE.Group(); bench.position.set(-8, 0, z + 5); platform.add(bench);
      this.box(bench, this.wood, 0, 1.25, 0, 8.5, .28, 1.1); this.box(bench, this.wood, 0, 2.25, .48, 8.5, 1.8, .22);
      for (const x of [-3.4, 3.4]) this.line(bench, this.steel, new THREE.Vector3(x, 0, -.35), new THREE.Vector3(x, 1.3, 0), .09);
    }
    for (let z = -44; z <= 44; z += 11) {
      const fixture = this.box(platform, this.black, -4, 12.5, z, 8, .24, 1.1); fixture.rotation.x = .03;
      const glow = this.box(platform, this.material(0xdde6d5, .18, .05, 0xcbd9ba, 1.35), -4, 12.34, z, 7.5, .05, .72); glow.castShadow = false;
      const light = new THREE.PointLight(0xdcebd7, 13, 19, 2); light.position.set(-4, 11.9, z); this.light(light, platform);
    }

    const phone = new THREE.Group(); phone.name = 'matrix-subway-phone'; phone.position.set(-7, 0, 32); platform.add(phone);
    this.box(phone, this.tileDark, 0, 2.6, .45, 2.3, 5.2, .5); this.box(phone, this.black, 0, 3.25, .08, 1.45, 1.65, .4);
    this.box(phone, this.green, 0, 4.35, .02, 1.3, .55, .06); this.box(phone, this.black, -.52, 3.15, -.28, .28, 1.22, .24);
    this.line(phone, this.black, new THREE.Vector3(-.52, 2.58, -.25), new THREE.Vector3(-.3, 1.75, .08), .035);
    const debris = new THREE.Group(); debris.name = 'matrix-subway-phone-debris'; debris.visible = false; debris.position.set(-7, .1, 31.5); platform.add(debris); this.phoneDebris = debris;
    for (let i = 0; i < 18; i++) {
      const shard = this.mesh(new THREE.TetrahedronGeometry(.08 + i % 4 * .04), i % 3 ? this.black : this.glass, debris);
      shard.position.set(-1.1 + (i * .71) % 2.2, .1 + (i * .37) % 2.8, -.7 + (i * .53) % 1.4); shard.rotation.set(i, i * .43, i * .77);
    }

    const breakGroup = new THREE.Group(); breakGroup.name = 'matrix-subway-wall-break'; breakGroup.position.set(-22.15, 3.3, 1); breakGroup.rotation.y = Math.PI / 2; breakGroup.visible = false; platform.add(breakGroup); this.wallBreak = breakGroup;
    for (let i = 0; i < 13; i++) {
      const angle = i / 13 * Math.PI * 2; const radius = 1.1 + i % 4 * .62;
      this.line(breakGroup, this.black, new THREE.Vector3(0, 0, 0), new THREE.Vector3(Math.cos(angle) * radius, Math.sin(angle) * radius, .03), .035);
      const chunk = this.mesh(new THREE.DodecahedronGeometry(.18 + i % 3 * .09, 0), this.tile, breakGroup);
      chunk.position.set(Math.cos(angle) * radius, Math.sin(angle) * radius, .25 + i % 2 * .2); chunk.rotation.set(i, i * .5, i * .3);
    }

    const train = new THREE.Group(); train.name = 'matrix-subway-train'; train.position.set(17.3, 0, 60); train.visible = false; this.group.add(train); this.train = train;
    this.box(train, this.steel, 0, 3.15, 0, 8.2, 6.3, 30); this.box(train, this.black, 0, 6.25, 0, 7.3, .3, 29);
    this.box(train, this.black, 0, 3.7, -15.08, 7.15, 3.2, .18); this.box(train, this.glass, 0, 3.8, -15.2, 6.5, 2.45, .05);
    for (const side of [-1, 1]) for (let z = -11.5; z <= 11.5; z += 5.7) {
      this.box(train, this.black, side * 4.11, 4, z, .12, 2.45, 3.75); this.box(train, this.glass, side * 4.18, 4, z, .035, 2.15, 3.45);
      this.box(train, this.tileDark, side * 4.12, 1.9, z, .14, 2.8, .16);
    }
    for (const x of [-2.25, 2.25]) {
      const lamp = this.sphere(train, this.amber, x, 2.2, -15.35, .32); lamp.scale.z = .35;
      const beam = new THREE.SpotLight(0xffe6a8, 0, 90, .34, .45, 1.4); beam.position.set(x, 2.2, -15.5); beam.target.position.set(x, 1, -48); train.add(beam.target); this.light(beam, train);
    }
    const headlight = new THREE.PointLight(0xffedbb, 0, 48, 2); headlight.name = 'matrix-subway-train-headlight'; headlight.position.set(0, 2.6, -16); this.light(headlight, train); this.trainLight = headlight;

    const transform = this.codeTransform('matrix-subway-code-transform'); transform.position.set(-8, 0, -27); transform.visible = false; this.group.add(transform); this.subwayTransform = transform;
    const fill = new THREE.HemisphereLight(0xc9ddd5, 0x202c29, .48); this.light(fill);
  }

  private buildCity(): void {
    this.box(this.group, this.asphalt, 0, -.28, -4, 24, .56, 112);
    for (const side of [-1, 1]) {
      this.box(this.group, this.concrete, side * 18, -.08, -4, 12, .38, 112);
      this.box(this.group, this.plaster, side * 23.5, 11, -4, 11, 22, 112);
      for (let z = -50; z <= 48; z += 14) {
        const facade = new THREE.Group(); facade.position.set(side * 18.1, 0, z); facade.rotation.y = side > 0 ? -Math.PI / 2 : Math.PI / 2; this.group.add(facade);
        this.box(facade, (Math.floor(z) / 14) % 2 ? this.brick : this.plaster, 0, 9.5, 0, 13.5, 19, .45);
        for (const x of [-4.2, 0, 4.2]) for (const y of [5.2, 10, 14.8]) {
          this.box(facade, this.black, x, y, -.3, 2.6, 3, .18); this.box(facade, this.glass, x, y, -.42, 2.2, 2.55, .05);
          this.box(facade, this.steel, x, y, -.48, .08, 2.55, .04);
        }
      }
    }
    for (let z = -48; z <= 46; z += 12) {
      this.box(this.group, this.plaster, 0, -.02, z, 22, .08, .16);
      this.box(this.group, this.material(0xdfd9ba, .8, .02), 0, .02, z + 5.7, .18, .06, 4.5);
    }

    const market = new THREE.Group(); market.name = 'matrix-city-market'; market.position.set(-11.8, 0, 22); this.group.add(market);
    for (let i = 0; i < 6; i++) {
      const stall = new THREE.Group(); stall.position.set(i % 2 ? 2.7 : -2.7, 0, -i * 5.1); market.add(stall);
      this.box(stall, this.wood, 0, 1.2, 0, 4.6, .2, 3.4); for (const x of [-2.05, 2.05]) this.cylinder(stall, this.steel, x, 2.6, 0, .055, 5.2);
      const awning = this.box(stall, i % 3 ? this.green : this.red, 0, 5.05, 0, 5.1, .15, 4.1); awning.rotation.x = (i % 2 ? 1 : -1) * .06;
      for (let item = 0; item < 14; item++) this.sphere(stall, item % 3 ? this.material(0x9b7541, .8, .02) : this.red,
        -1.7 + item % 5 * .82, 1.55 + Math.floor(item / 5) * .32, -.9 + item % 3 * .8, .24 + item % 2 * .08);
    }
    for (const [index, [x, z]] of [[-7, 18], [9, -9]] .entries()) {
      const phone = this.buildPhone(`matrix-city-phone-${index}`); phone.position.set(x, 0, z); this.group.add(phone); this.phones.push(phone);
    }
    const sparks = new THREE.Group(); sparks.name = 'matrix-city-phone-sparks'; sparks.position.set(-7, 3.2, 18); sparks.visible = false; this.group.add(sparks); this.phoneSparks = sparks;
    for (let i = 0; i < 20; i++) {
      const spark = this.line(sparks, this.amber, new THREE.Vector3(0, 0, 0), new THREE.Vector3(-1.3 + (i * .71) % 2.6, -1 + (i * .43) % 2, -.6 + (i * .33) % 1.2), .018);
      spark.castShadow = false;
    }

    const fireEscape = new THREE.Group(); fireEscape.name = 'matrix-city-fire-escape'; fireEscape.position.set(17.5, 0, -18); this.group.add(fireEscape);
    for (const y of [5, 10.5, 16]) {
      this.box(fireEscape, this.steel, 0, y, 0, 7, .18, 3.4);
      for (let x = -3.4; x <= 3.4; x += .75) this.line(fireEscape, this.steel, new THREE.Vector3(x, y - .05, -1.6), new THREE.Vector3(x, y - .05, 1.6), .035);
      for (const x of [-3.35, 3.35]) this.line(fireEscape, this.steel, new THREE.Vector3(x, y, -1.65), new THREE.Vector3(x, y + 2.2, -1.65), .055);
    }
    for (let y = 2; y < 15; y += .72) this.box(fireEscape, this.steel, 1.8, y, 1.6 - (y % 5.5) * .48, 3.5, .08, .14);

    const roadblock = new THREE.Group(); roadblock.name = 'matrix-city-roadblock'; roadblock.position.set(-5.5, 0, -8); this.group.add(roadblock);
    for (const z of [-1.5, 1.5]) { const barrier = this.box(roadblock, this.red, 0, .8, z, 8.5, .45, .45); barrier.rotation.y = -.18; }
    for (const x of [-3.6, 3.6]) this.line(roadblock, this.steel, new THREE.Vector3(x, 0, -1.5), new THREE.Vector3(x, 1.5, -1.5), .1);

    const truck = new THREE.Group(); truck.name = 'matrix-city-garbage-truck'; truck.visible = false; truck.position.set(6.8, 0, 30); this.group.add(truck); this.truck = truck;
    this.box(truck, this.material(0x435f50, .72, .32), 0, 2.8, 2.3, 7.8, 5.6, 10.5); this.box(truck, this.steel, 0, 3.2, -4.25, 7.4, 6.4, 4.1);
    this.box(truck, this.black, 0, 4.15, -6.35, 6.5, 2.3, .2); this.box(truck, this.glass, 0, 4.2, -6.48, 5.9, 1.85, .05);
    for (const x of [-3.25, 3.25]) for (const z of [-4.3, 4.8]) { const wheel = this.cylinder(truck, this.black, x, 1.05, z, 1.08, .72); wheel.rotation.z = Math.PI / 2; }
    for (const x of [-2.3, 2.3]) this.sphere(truck, this.amber, x, 2.1, -6.55, .28);

    const hotel = new THREE.Group(); hotel.name = 'matrix-city-room-303'; hotel.position.set(0, 0, -53); this.group.add(hotel);
    this.box(hotel, this.brick, 0, 9, 0, 22, 18, 5); this.box(hotel, this.concrete, 0, .35, 4.7, 13, .7, 9.5);
    for (let step = 0; step < 7; step++) this.box(hotel, this.concrete, 0, .25 + step * .34, 8 - step * .65, 8.5, .5, 1.1);
    const door = this.box(hotel, this.wood, 0, 4.1, 2.58, 4.4, 7.8, .28, 'matrix-city-room-303-door'); this.roomDoor = door;
    this.box(hotel, this.black, 0, 8.6, 2.72, 5.6, 1.25, .22); this.box(hotel, this.amber, 0, 8.6, 2.86, 4.7, .72, .04);
    for (const x of [-7, 7]) for (const y of [5, 11, 15]) { this.box(hotel, this.black, x, y, 2.58, 3.2, 3.6, .22); this.box(hotel, this.glass, x, y, 2.72, 2.75, 3.15, .05); }
    const lamp = new THREE.PointLight(0xffd18c, 18, 18, 2); lamp.position.set(0, 8.5, 7); this.light(lamp, hotel);

    const transform = this.codeTransform('matrix-city-code-transform'); transform.visible = false; this.group.add(transform); this.cityTransform = transform;
    const sun = new THREE.DirectionalLight(0xffe7c5, 1.25); sun.position.set(-30, 48, 20); sun.castShadow = true; sun.shadow.mapSize.set(1024, 1024); this.light(sun);
    const fill = new THREE.HemisphereLight(0xc9dce0, 0x4b5147, .58); this.light(fill);
  }

  private buildPhone(name: string): THREE.Group {
    const phone = new THREE.Group(); phone.name = name;
    this.box(phone, this.steel, 0, 3.4, 0, 3.1, 6.8, 2.7); this.box(phone, this.glass, 0, 3.55, 1.4, 2.65, 5.8, .08);
    this.box(phone, this.black, 0, 3.35, -1.42, 2.3, 2.35, .2); this.box(phone, this.green, 0, 5.15, -1.54, 2.25, .55, .04);
    this.box(phone, this.black, -.72, 3.25, -1.64, .28, 1.45, .2); this.line(phone, this.black, new THREE.Vector3(-.72, 2.5, -1.55), new THREE.Vector3(-.4, 1.65, -1.35), .035);
    return phone;
  }

  private codeTransform(name: string): THREE.Group {
    const group = new THREE.Group(); group.name = name;
    for (let ring = 0; ring < 6; ring++) {
      const radius = .7 + ring * .28; const halo = this.mesh(new THREE.TorusGeometry(radius, .025, 6, 32), this.code, group); halo.rotation.x = Math.PI / 2; halo.position.y = .8 + ring * .78;
    }
    for (let i = 0; i < 24; i++) {
      const angle = i / 24 * Math.PI * 2; const height = .5 + i % 7 * .72;
      const glyph = this.box(group, this.code, Math.cos(angle) * (1 + i % 3 * .25), height, Math.sin(angle) * (1 + i % 3 * .25), .08, .42 + i % 4 * .18, .05);
      glyph.rotation.y = -angle; glyph.castShadow = false;
    }
    return group;
  }

  update(journey: FilmJourney | undefined, _elapsed: number): void {
    const encounter = journey?.matrixEscape;
    if (!encounter) return;
    if (encounter.kind === 'subway') {
      if (this.phoneDebris) this.phoneDebris.visible = Boolean(encounter.phoneBroken) || !['ready', 'phone_shot'].includes(encounter.phase);
      if (this.wallBreak) {
        this.wallBreak.visible = Boolean(encounter.wallBroken) || ['wall_break', 'tracks', 'train_window', 'train_escape', 'body_swap', 'done'].includes(encounter.phase);
        const progress = encounter.phase === 'wall_break' ? Math.min(1, encounter.elapsed / MATRIX_ESCAPE.subway.wallBreak) : this.wallBreak.visible ? 1 : 0;
        this.wallBreak.scale.setScalar(Math.max(.001, progress)); this.wallBreak.rotation.z = progress * .1;
      }
      if (this.train) {
        const visible = ['tracks', 'train_window', 'train_escape'].includes(encounter.phase); this.train.visible = visible;
        const z = encounter.phase === 'tracks' ? 58 - encounter.elapsed * 4
          : encounter.phase === 'train_window' ? 52 - encounter.elapsed * 15.5
            : encounter.phase === 'train_escape' ? 10.15 - encounter.elapsed * 16 : 60;
        this.train.position.set(17.3, 0, z);
        if (this.trainLight) this.trainLight.intensity = visible ? 34 + Math.max(0, 45 - z) * 1.2 : 0;
      }
      if (this.subwayTransform) {
        this.subwayTransform.visible = encounter.phase === 'body_swap';
        if (this.subwayTransform.visible) {
          const root = matrixEscapeRoot(encounter, 'citizen_13'); this.subwayTransform.position.set(root.x, root.y, root.z);
          this.subwayTransform.rotation.y = encounter.elapsed * 1.7; this.subwayTransform.scale.y = .5 + Math.min(1, encounter.elapsed / 1.4) * .7;
        }
      }
      return;
    }
    if (this.phoneSparks) {
      this.phoneSparks.visible = encounter.phase === 'phone_failure';
      if (this.phoneSparks.visible) this.phoneSparks.rotation.y = encounter.elapsed * 3.2;
    }
    if (this.phones[0]) this.phones[0].rotation.z = encounter.phoneBroken ? -.08 : 0;
    if (this.truck) {
      this.truck.visible = ['truck_warning', 'truck_window', 'possession'].includes(encounter.phase);
      const impactZ = matrixEscapeRoot(encounter, 'neo').z + 6.48;
      const z = encounter.phase === 'truck_warning' ? 31 - encounter.elapsed * 10
        : encounter.phase === 'truck_window' ? 13 - encounter.elapsed * (13 - impactZ) / MATRIX_ESCAPE.city.truckBeat
          : encounter.phase === 'possession' ? -18 - encounter.elapsed * 5 : 34;
      this.truck.position.set(6.8, encounter.phase === 'possession' ? -.1 : 0, z); this.truck.rotation.y = encounter.phase === 'possession' ? -.18 : 0;
    }
    if (this.cityTransform) {
      this.cityTransform.visible = encounter.phase === 'phone_failure' && encounter.elapsed > .8 || encounter.phase === 'possession';
      const role = encounter.phase === 'phone_failure' ? 'citizen_13' : 'citizen_14'; const root = matrixEscapeRoot(encounter, role);
      this.cityTransform.position.set(root.x, root.y, root.z); this.cityTransform.rotation.y = encounter.elapsed * 1.9;
      this.cityTransform.scale.y = .55 + Math.min(1, encounter.elapsed / 1.2) * .65;
    }
    if (this.roomDoor) {
      const opening = encounter.phase === 'door' ? Math.min(1, encounter.elapsed / MATRIX_ESCAPE.city.door) : encounter.phase === 'done' ? 1 : 0;
      this.roomDoor.rotation.y = -opening * 1.25; this.roomDoor.position.x = -Math.sin(opening * 1.25) * 2.1;
    }
  }

  dispose(): void {
    this.group.removeFromParent(); this.group.clear(); this.geometries.forEach(geometry => geometry.dispose()); this.materials.forEach(material => material.dispose());
    this.lights.forEach(light => light.dispose()); this.geometries.clear(); this.materials.clear(); this.lights.clear();
  }
}
