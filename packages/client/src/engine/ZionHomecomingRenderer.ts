import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { ZION_OBSTACLES, type FilmJourney } from '@auto_matrix/shared';

/** Six authored Zion interiors share rock, metal and service-light materials, not a generic cave layout. */
export class ZionHomecomingRenderer {
  readonly group = new THREE.Group();
  private static = new THREE.Group();
  private geometries = new Set<THREE.BufferGeometry>();
  private materials = new Set<THREE.Material>();
  private textures = new Set<THREE.Texture>();
  private lights = new Set<THREE.Light>();
  private moving = new THREE.Group();
  private signals: THREE.MeshStandardMaterial[] = [];
  private messageDisk?: THREE.Group;
  private messageDoor?: THREE.Group;
  private departureGifts?: { charm: THREE.Group; spoon: THREE.Group; engines: THREE.MeshStandardMaterial };
  private crowd?: { bodies: THREE.InstancedMesh; heads: THREE.InstancedMesh; arms: THREE.InstancedMesh; poses: [number, number, number][] };
  private disposed = false;
  constructor(root: THREE.Group, readonly set: string) {
    this.group.name = 'zion-homecoming-set'; root.add(this.group); this.group.add(this.static, this.moving);
    if (set === 'film_zion_hangar') this.dock();
    if (set === 'film_zion_council') this.council();
    if (set === 'film_zion_residences') this.residences();
    if (set === 'film_zion_temple') this.temple();
    if (set === 'film_zion_bedroom') this.room();
    if (set === 'film_zion_engineering') this.engineering();
    this.batch();
  }
  private material(color: number, roughness = .85, metalness = .04, emissive = 0, power = 0): THREE.MeshStandardMaterial {
    const mat = new THREE.MeshStandardMaterial({ color, roughness, metalness, emissive, emissiveIntensity: power });
    this.materials.add(mat); return mat;
  }
  private surface(name: string, color: number, repeat = 3): THREE.MeshStandardMaterial {
    const mat = this.material(color, name === 'metal_plate' ? .54 : .98, name === 'metal_plate' ? .62 : .02);
    if (typeof document === 'undefined') return mat;
    for (const [suffix, slot] of [['color', 'map'], ['normal', 'normalMap'], ['roughness', 'roughnessMap']] as const) {
      const texture = new THREE.TextureLoader().load(`/assets/film-materials/${name}-${suffix}.jpg`, loaded => { if (this.disposed) loaded.dispose(); });
      texture.wrapS = texture.wrapT = THREE.RepeatWrapping; texture.repeat.set(repeat, repeat); texture.anisotropy = 4;
      if (slot === 'map') texture.colorSpace = THREE.SRGBColorSpace;
      mat[slot] = texture; this.textures.add(texture);
    }
    mat.normalScale.set(.45, .45); return mat;
  }
  private mesh(geometry: THREE.BufferGeometry, material: THREE.Material, parent: THREE.Object3D = this.static, name?: string): THREE.Mesh {
    const mesh = new THREE.Mesh(geometry, material); mesh.castShadow = true; mesh.receiveShadow = true;
    if (name) mesh.name = name; parent.add(mesh); this.geometries.add(geometry); return mesh;
  }
  private box(mat: THREE.Material, x: number, y: number, z: number, w: number, h: number, d: number, parent: THREE.Object3D = this.static, name?: string): THREE.Mesh {
    const mesh = this.mesh(new THREE.BoxGeometry(w, h, d), mat, parent, name); mesh.position.set(x, y, z); return mesh;
  }
  private cylinder(mat: THREE.Material, x: number, y: number, z: number, r: number, h: number, sides = 16, parent: THREE.Object3D = this.static, name?: string): THREE.Mesh {
    const mesh = this.mesh(new THREE.CylinderGeometry(r, r, h, sides), mat, parent, name); mesh.position.set(x, y, z); return mesh;
  }
  private pipe(mat: THREE.Material, a: [number, number, number], b: [number, number, number], radius: number, parent: THREE.Object3D = this.static): THREE.Mesh {
    const start = new THREE.Vector3(...a), end = new THREE.Vector3(...b), delta = end.clone().sub(start);
    const mesh = this.mesh(new THREE.CylinderGeometry(radius, radius, delta.length(), 10), mat, parent);
    mesh.position.copy(start).addScaledVector(delta, .5); mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), delta.normalize()); return mesh;
  }
  private glow(color: number, power: number, radius: number, x: number, y: number, z: number): void {
    const light = new THREE.PointLight(color, power, radius, 2); light.position.set(x, y, z); this.group.add(light); this.lights.add(light);
  }
  private sign(text: string, x: number, y: number, z: number, w: number, h = 1.7, rotate = 0): void {
    const material = this.material(0xd5d0af, .8);
    if (typeof document !== 'undefined') {
      const canvas = document.createElement('canvas'); canvas.width = 1024; canvas.height = 256;
      const ctx = canvas.getContext('2d')!; ctx.fillStyle = '#18201e'; ctx.fillRect(0, 0, 1024, 256);
      ctx.strokeStyle = '#837d60'; ctx.lineWidth = 10; ctx.strokeRect(6, 6, 1012, 244);
      ctx.fillStyle = '#d4d0b4'; ctx.font = 'bold 68px monospace'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(text, 512, 130, 960);
      const texture = new THREE.CanvasTexture(canvas); texture.colorSpace = THREE.SRGBColorSpace; this.textures.add(texture); material.map = texture;
    }
    const panel = this.mesh(new THREE.PlaneGeometry(w, h), material); panel.position.set(x, y, z); panel.rotation.y = rotate;
  }
  private rockShell(width: number, depth: number, height: number, stone: THREE.Material): void {
    const dark = this.material(0x251f1b, 1); this.box(dark, 0, -.5, 0, width, 1, depth);
    for (let side of [-1, 1]) for (let i = 0; i < 28; i++) {
      const z = -depth / 2 + 2 + i * (depth - 4) / 27;
      const uneven = Math.sin(i * 2.7 + side) * 2.1;
      const wall = this.mesh(new THREE.DodecahedronGeometry(4 + i % 4, 0), stone);
      wall.position.set(side * (width / 2 - 2), 4 + i % 5 * 2, z + uneven); wall.scale.set(.85, 1.8 + i % 3 * .25, 1.4); wall.rotation.set(i * .27, i * .49, i * .13);
      if (height >= 20 && i % 2 === 0) { const high = this.mesh(new THREE.DodecahedronGeometry(5 + i % 3, 0), stone);
        high.position.set(side * (width / 2 - 7 - i % 3), height - 8 + Math.sin(i) * 2, z); high.scale.set(1.5, .8, 1.6); high.rotation.z = i * .39; }
    }
    for (let i = 0; i < 13; i++) {
      const z = -depth / 2 + i * depth / 12;
      const crown = this.mesh(new THREE.DodecahedronGeometry(5 + i % 3, 0), stone);
      crown.position.set(Math.sin(i * 4) * 5, height < 20 ? height + 3 : height - 2, z);
      crown.scale.set(3.1, height < 20 ? .35 : .8, 1.3); crown.rotation.set(.2, i * .6, .1);
    }
  }
  private lamp(x: number, z: number, y = 7, strength = 110): void {
    const rim = this.material(0x36332c, .45, .7); const ember = this.material(0xffc278, .4, .05, 0xff934a, 2.5);
    this.pipe(rim, [x, y + 2, z], [x, y, z], .12); this.cylinder(rim, x, y, z, .9, .4);
    this.box(ember, x, y - .28, z, 1.15, .08, 1.15); this.glow(0xffbd83, strength, 23, x, y - .45, z);
  }
  private grating(width: number, depth: number, steel: THREE.Material, zCenter = 0): void {
    const black = this.material(0x171c1c, .7, .55); this.box(black, 0, -.28, zCenter, width, .18, depth);
    for (let z = zCenter - depth / 2; z <= zCenter + depth / 2; z += 2) this.box(steel, 0, -.12, z, width, .11, .12);
    for (let x = -width / 2; x <= width / 2; x += 1.4) this.box(steel, x, -.1, zCenter, .06, .06, depth);
  }
  private obstacles(mat: THREE.Material): void {
    for (const o of ZION_OBSTACLES[this.set] ?? []) this.box(mat, o.x, o.height / 2, o.z, o.width, o.height, o.depth);
  }
  private dock(): void {
    const stone = this.surface('damaged_plaster', 0x706252, 6), metal = this.surface('metal_plate', 0x6d7770, 3);
    const iron = this.material(0x252e2d, .48, .68), lit = this.material(0xcebda0, .4, .25, 0xeaba72, 2);
    const engine = this.material(0x96c1a6, .28, .34, 0x7dc2aa, 1.2);
    this.rockShell(108, 138, 65, stone); this.grating(15, 108, metal, 3);
    for (const side of [-1, 1]) {
      this.box(iron, side * 7.5, 1.2, 3, .6, 2.4, 108);
      for (let z = -50; z < 59; z += 9) { this.pipe(metal, [side * 8, 1, z], [side * 8, 7, z], .15); this.lamp(side * 12, z, 9, 80); }
    }
    // Ship is anchored beyond the walkway, with actual thruster housings and a landing truss.
    const ship = new THREE.Group(); ship.name = 'zion-docked-nebuchadnezzar'; ship.position.set(20, 11, 17); ship.userData.dynamic = true; this.moving.add(ship);
    const hull = this.mesh(new THREE.CylinderGeometry(5.5, 3.5, 31, 16), iron, ship); hull.rotation.x = Math.PI / 2;
    this.box(metal, 0, 2.7, -3, 8, 1.2, 19, ship); this.box(metal, 0, -.5, 10, 12, 1.4, 6, ship);
    for (const side of [-1, 1]) {
      this.box(iron, side * 5.4, -.7, 9, 4.3, 2.5, 8, ship);
      const thruster = this.mesh(new THREE.TorusGeometry(1.7, .5, 10, 30), metal, ship); thruster.position.set(side * 5.4, -.5, 13); thruster.rotation.x = Math.PI / 2;
      this.box(engine, side * 5.4, -.5, 13.3, 2.6, .18, .1, ship);
      this.box(iron, side * 7.5, 2.8, -4, 10, .7, 5, ship);
    }
    for (let i = 0; i < 8; i++) { const z = -48 + i * 12; this.pipe(metal, [-43, 34, z], [43, 34, z], .28); this.pipe(iron, [-43, 34, z], [-12, 2, z], .18); this.pipe(iron, [43, 34, z], [12, 2, z], .18); }
    const gate = this.mesh(new THREE.TorusGeometry(27, 2.5, 12, 48), metal); gate.position.set(0, 28, -61);
    this.box(iron, 0, 29, -64, 48, 53, 1.1, this.static, 'zion-gate-three');
    for (let a = 0; a < 16; a++) { const angle = a / 16 * Math.PI * 2; const x = Math.sin(angle) * 26, y = 28 + Math.cos(angle) * 26;
      const spoke = this.box(lit, x, y, -62.5, .85, 3.4, .35); spoke.rotation.z = -angle; }
    this.sign('DOCK 03 / BAY 07', 0, 10, -57, 12); this.sign('NEBUCHADNEZZAR', 18, 5, -11, 10, 1.5, -Math.PI / 2);
    this.obstacles(iron); for (const x of [-24, 18]) for (let i = 0; i < 3; i++) this.box(metal, x, 2 + i * 1.5, -18 + i * 3, 7, .2, 4);
    this.box(metal, 11.5, -.04, 17, 8, .18, 3.2, this.static, 'zion-ship-gangway');
    const charm = new THREE.Group(); charm.name = 'zee-farewell-charm'; charm.position.set(0, 2.4, 32); this.moving.add(charm);
    this.mesh(new THREE.TorusGeometry(.24, .055, 8, 20), this.material(0xbca77b, .42, .6), charm);
    this.mesh(new THREE.CylinderGeometry(.08, .09, .5, 8), metal, charm).position.y = -.18;
    const spoon = new THREE.Group(); spoon.name = 'kid-spoon-gift'; spoon.position.set(-4.2, 2.3, 10); this.moving.add(spoon);
    this.mesh(new THREE.SphereGeometry(.18, 12, 8), metal, spoon).scale.set(.7, .15, 1.7);
    this.box(metal, 0, -.42, -.2, .055, .06, .75, spoon);
    this.departureGifts = { charm, spoon, engines: engine };
    this.glow(0xffd0a0, 560, 68, 21, 18, 18); this.glow(0xeeb573, 330, 75, 18, 23, -28); this.glow(0x9cbaab, 180, 65, -29, 35, 18);
  }
  private council(): void {
    const steel = this.surface('metal_plate', 0x737b72, 3), stone = this.surface('damaged_plaster', 0x6e675b, 3);
    const dark = this.material(0x202b2b, .5, .55), screen = this.material(0x91b3a0, .34, .2, 0x42866c, 1.5);
    this.box(stone, 0, -.5, 0, 52, 1, 74); this.box(dark, 0, 18, 0, 53, .7, 76);
    for (const side of [-1, 1]) {
      this.box(steel, side * 26, 9, 0, .8, 18, 75);
      for (let z = -35; z <= 35; z += 6) { this.box(dark, side * 25.3, 9, z, .2, 17, .24); this.box(dark, side * 25.2, 15.5, z, .2, .15, 5.8); }
    }
    this.box(steel, 0, 9, -37, 52, 18, 1); this.box(steel, 0, 9, 37, 52, 18, 1);
    for (const x of [-14, 14]) { this.box(dark, x, 8, -36.35, 15, 11, .2); for (let i = 0; i < 7; i++) this.box(screen, x - 5 + i * 1.6, 8 + Math.sin(i * 2) * .8, -36.1, .85, .12, .06); }
    this.obstacles(steel); this.box(dark, 0, 3.12, -27, 13.6, .24, 3.5);
    const map = this.material(0x33473d, .4, .5, 0x6e9f79, 1.1); this.box(map, 0, 3.28, -27, 11.4, .07, 2.9);
    for (let i = 0; i < 22; i++) { const x = -5 + i % 11, z = -28 + Math.floor(i / 11); this.box(screen, x, 3.38, z, .12, .1, .12); }
    this.sign('ZION DEFENSE / 72 H', 0, 12, -36.1, 12); this.sign('COMMANDER LOCK', -19, 6, -35.9, 8);
    for (const z of [-27, -10, 8, 26]) { this.box(screen, 0, 17.5, z, 13, .14, 1.1); this.glow(0xc5b597, 80, 23, 0, 17, z); }
  }
  private residences(): void {
    const stone = this.surface('damaged_plaster', 0x8e7158, 5), metal = this.surface('metal_plate', 0x6d7169, 4);
    const cloth = this.material(0xa48d70, 1), dark = this.material(0x302a24, .9), paper = this.material(0xc0af91, .98);
    this.rockShell(64, 82, 36, stone); this.box(stone, 0, -.2, 0, 62, .4, 80);
    for (const side of [-1, 1]) for (let z = -34; z <= 31; z += 13) {
      const x = side * 23; this.box(dark, x, 5, z, 7, 9, 7); this.box(metal, x - side * 3.7, 4.5, z, .24, 8, 6.7);
      this.box(cloth, x - side * 3.83, 6.7, z, .12, 3.1, 2.8);
      this.box(metal, x - side * 4.5, 8.8, z, 2.1, .5, 8);
      this.box(stone, x - side * 3.8, 11, z, 6, .8, 9);
      if (z % 2) this.box(cloth, x - side * 5.1, 7.4, z + 1, .08, 2.7, 1.5);
    }
    for (let z = -33; z < 38; z += 11) for (const side of [-1, 1]) this.lamp(side * 16, z, 9, 65);
    this.obstacles(stone); this.box(dark, 0, 3, -34, 7.4, .25, 3.4);
    for (let i = 0; i < 8; i++) { const sheet = this.box(paper, -2.6 + i % 4 * 1.7, 3.16 + Math.floor(i / 4) * .015, -34 + Math.floor(i / 4) * .8, 1.25, .03, .6); sheet.rotation.y = (i % 3 - 1) * .1; }
    this.sign('RESIDENTS / LEVEL 08', 0, 11.5, -38, 11);
    for (let side of [-1, 1]) for (let i = 0; i < 4; i++) this.pipe(metal, [side * (25 - i * .8), 17, -37], [side * (25 - i * .8), 17, 39], .12);
  }
  private temple(): void {
    const stone = this.surface('damaged_plaster', 0xb39473, 7), iron = this.material(0x342a25, .55, .45);
    const amber = this.material(0xfcc08a, .4, .08, 0xf79d4d, 2), cloth = this.material(0x5b493d, .96);
    this.rockShell(96, 116, 55, stone); this.box(stone, 0, -.25, 0, 94, .5, 114);
    for (const o of ZION_OBSTACLES[this.set] ?? []) this.box(stone, o.x, o.height / 2, o.z, o.width, o.height, o.depth);
    for (const x of [-31, 31]) for (const z of [-28, -4, 20]) { this.mesh(new THREE.CylinderGeometry(2.5, 3.4, 35, 9), stone).position.set(x, 18, z); this.glow(0xf1a75d, 100, 22, x, 6, z); }
    for (let z = -38; z <= 36; z += 13) for (const x of [-25, 25]) {
      this.cylinder(iron, x, 1.2, z, 1.2, 1.9); this.cylinder(amber, x, 2.2, z, .7, .35); this.glow(0xff9d57, 70, 13, x, 3, z);
    }
    this.box(cloth, 0, .12, -17, 10, .06, 55);
    this.box(iron, 0, 3.1, -41, 10.3, .35, 4.5, this.static, 'zion-assembly-rostrum');
    for (const x of [-17, 17]) { this.cylinder(iron, x, 1.4, -23, 2.1, 2.8); this.cylinder(cloth, x, 2.85, -23, 2.15, .16); }
    // Background residents dance only after the speech. Instancing keeps the crowd inexpensive.
    const poses: [number, number, number][] = [];
    for (let row = 0; row < 6; row++) for (let col = 0; col < 16; col++) {
      const x = -39 + col * 5.1 + Math.sin(row * 11 + col) * .9, z = 13 + row * 6 + Math.cos(col * 4) * .8;
      if (Math.abs(x) >= 5) poses.push([x, z, 3.2 + (row * 17 + col * 13) % 6 * .13]);
    }
    const bodies = new THREE.InstancedMesh(new THREE.CylinderGeometry(.43, .72, 1, 7), this.material(0xb6aaa0, 1), poses.length);
    const heads = new THREE.InstancedMesh(new THREE.SphereGeometry(.36, 8, 7), this.material(0xffffff, 1), poses.length);
    const arms = new THREE.InstancedMesh(new THREE.CylinderGeometry(.12, .15, 1, 6), this.material(0xb8a98f, 1), poses.length * 2);
    for (const [mesh, count] of [[bodies, poses.length], [heads, poses.length], [arms, poses.length * 2]] as const) {
      mesh.userData.dynamic = true; mesh.castShadow = true; mesh.receiveShadow = true; this.moving.add(mesh);
      this.geometries.add(mesh.geometry);
      for (let i = 0; i < count; i++) {
        const palette = mesh === heads ? [0xa87e65, 0x634c3d, 0xd2a687] : [0x635347, 0x8c755d, 0x3d423c];
        mesh.setColorAt(i, new THREE.Color(palette[(i * 7 + Math.floor(i / 16)) % 3]));
      }
    }
    this.crowd = { bodies, heads, arms, poses }; this.update(undefined, 0);
    this.sign('TEMPLE / ZION', 0, 9, -52, 13);
    this.glow(0xf4b369, 1500, 90, 0, 34, -30); this.glow(0xe6a476, 1100, 75, 0, 22, 34);
  }
  private room(): void {
    const stone = this.surface('damaged_plaster', 0x977b68, 2), metal = this.surface('metal_plate', 0x6d6760, 2);
    const fabric = this.material(0x90816e, 1), warm = this.material(0xffca87, .48, .04, 0xf3a353, 2);
    this.rockShell(32, 42, 12, stone); this.box(stone, 0, -.2, 0, 30, .4, 40);
    this.obstacles(stone); this.box(fabric, -7, 2.15, -10, 9.1, .35, 7.1);
    for (let i = 0; i < 9; i++) this.box(fabric, -7, 2.4 + Math.sin(i * 3) * .04, -13 + i * .7, 8.7, .08, .11);
    this.box(this.material(0xbdb09a, 1), -9.4, 2.45, -12.3, 2.8, .38, 1.5);
    this.box(metal, 9, 2.1, -11, 3, 3.8, 4); this.box(fabric, 9, 4.3, -11, 3.2, .2, 4.2);
    this.box(warm, 11, 7, -17, 1.5, 2.3, .2); this.glow(0xf2b889, 120, 18, 10, 6, -14);
    this.box(warm, -12, 7, 5, 1.5, 2.3, .2); this.glow(0xf2b889, 70, 15, -10, 6, 4);
    for (const x of [-14, 14]) this.pipe(metal, [x, 8, -18], [x, 8, 18], .1);
    for (const x of [-2.5, 2.5]) this.box(metal, x, 5.1, 18.1, .45, 10.2, .65);
    this.box(metal, 0, 10, 18.1, 5.4, .55, .7, this.static, 'zion-bedroom-door-frame');
    this.messageDoor = new THREE.Group(); this.messageDoor.position.set(-2.2, 0, 17.6); this.moving.add(this.messageDoor);
    this.box(this.material(0x302d29, .55, .58), 2.2, 4.8, 0, 4.2, 8.8, .35, this.messageDoor, 'zion-bedroom-door');
    const disk = new THREE.Group(); disk.name = 'oracle-message-disk'; disk.position.set(2.5, 2.3, 10.8); this.moving.add(disk);
    this.mesh(new THREE.CylinderGeometry(.38, .38, .035, 24), metal, disk);
    this.mesh(new THREE.CylinderGeometry(.09, .09, .045, 16), warm, disk).position.y = .04;
    this.messageDisk = disk;
  }
  private engineering(): void {
    const stone = this.surface('damaged_plaster', 0x6b6558, 4), steel = this.surface('metal_plate', 0x717974, 3);
    const iron = this.material(0x252f2e, .45, .7), water = this.material(0x42645e, .3, .42, 0x2c5f59, .5);
    const ready = this.material(0xb6dda6, .28, .15, 0x75d89b, 1.5); this.signals.push(ready);
    this.rockShell(56, 90, 24, stone); this.grating(17, 82, steel);
    for (const side of [-1, 1]) {
      this.box(iron, side * 9, 1.2, 0, .5, 2.4, 83);
      for (const x of [side * 14, side * 23]) for (const y of [4, 12, 19]) this.pipe(steel, [x, y, -43], [x, y, 43], .32 + y * .009);
      for (let z = -38; z <= 38; z += 13) { this.pipe(steel, [side * 14, 4, z], [side * 23, 4, z], .2); this.pipe(iron, [side * 10, 1, z], [side * 10, 21, z], .16); }
    }
    this.obstacles(iron);
    for (const side of [-1, 1]) {
      const x = side * 17; this.cylinder(steel, x, 6, 15, 4.8, 11, 22); this.cylinder(iron, x, 12, 15, 4.2, 1, 22);
      for (let i = 0; i < 7; i++) this.box(water, x - 2.5 + i * .75, 7, side * 15 + 3, .24, 5, .12);
    }
    const wheel = new THREE.Group(); wheel.name = 'zion-recycler-flywheel'; wheel.position.set(0, 14, -39); wheel.userData.dynamic = true; this.moving.add(wheel);
    const rim = this.mesh(new THREE.TorusGeometry(7.5, .85, 12, 36), steel, wheel); rim.rotation.y = Math.PI / 2;
    for (let i = 0; i < 8; i++) { const a = i / 8 * Math.PI * 2; this.pipe(iron, [0, 0, 0], [0, Math.sin(a) * 7, Math.cos(a) * 7], .27, wheel); }
    this.cylinder(steel, 0, 14, -39, 1.1, 2.2);
    this.box(iron, -17, 5.2, -25, 8.4, .4, 5.4); this.box(water, -17, 5.43, -25, 7.8, .12, 4.7);
    const valve = this.mesh(new THREE.TorusGeometry(2.3, .23, 10, 28), steel); valve.position.set(17, 4.4, -25); valve.rotation.x = Math.PI / 2;
    for (let i = 0; i < 6; i++) { const a = i / 6 * Math.PI * 2; this.pipe(iron, [17, 4.4, -25], [17 + Math.cos(a) * 2.2, 4.4 + Math.sin(a) * 2.2, -25], .1); }
    this.box(ready, 17, 5.7, -28.3, 2.4, .4, .12, this.static, 'zion-backup-status');
    this.sign('AIR / WATER / HEAT', 0, 8, -43, 15); this.lamp(-8, -23, 12, 90); this.lamp(8, -23, 12, 90);
    this.glow(0x8ca9a0, 200, 49, 0, 18, -34);
  }
  private batch(): void {
    this.group.updateMatrixWorld(true); const inverse = this.static.matrixWorld.clone().invert();
    const batches = new Map<THREE.Material, THREE.BufferGeometry[]>(); const remove: THREE.Mesh[] = [];
    this.static.traverse(object => {
      if (!(object instanceof THREE.Mesh) || Array.isArray(object.material) || object.name) return;
      const geometry = object.geometry.clone().applyMatrix4(inverse.clone().multiply(object.matrixWorld));
      const flattened = geometry.index ? geometry.toNonIndexed() : geometry; if (flattened !== geometry) geometry.dispose();
      for (const key of Object.keys(flattened.attributes)) if (!['position', 'normal', 'uv'].includes(key)) flattened.deleteAttribute(key);
      (batches.get(object.material) ?? (batches.set(object.material, []), batches.get(object.material)!)).push(flattened); remove.push(object);
    });
    for (const object of remove) object.removeFromParent();
    for (const [material, shapes] of batches) { const merged = mergeGeometries(shapes); shapes.forEach(shape => shape.dispose()); if (!merged) continue;
      this.mesh(merged, material, this.static); }
    const live = new Set<THREE.BufferGeometry>(); this.group.traverse(object => { if (object instanceof THREE.Mesh) live.add(object.geometry); });
    for (const geometry of this.geometries) if (!live.has(geometry)) { geometry.dispose(); this.geometries.delete(geometry); }
  }
  update(journey: FilmJourney | undefined, elapsed: number): void {
    const ship = this.moving.getObjectByName('zion-docked-nebuchadnezzar'); if (ship) ship.position.y = 11 + Math.sin(elapsed * .45) * .24;
    const wheel = this.moving.getObjectByName('zion-recycler-flywheel'); if (wheel) wheel.rotation.x = elapsed * .3;
    if (this.messageDoor) this.messageDoor.rotation.y = journey?.scene === 'm2_oracle_message' && journey.step >= 1 ? -.85 : 0;
    if (this.messageDisk) this.messageDisk.visible = journey?.scene === 'm2_oracle_message' && journey.step < 2;
    if (this.departureGifts) {
      const departure = journey?.scene === 'm2_departure' && !journey.visiting;
      this.departureGifts.charm.visible = departure && journey.step < 1;
      this.departureGifts.spoon.visible = departure && journey.step >= 2 && journey.step < 3;
      this.departureGifts.engines.emissiveIntensity = departure && journey.step >= 4 ? 4 : 1.2;
    }
    if (this.signals.length) for (const signal of this.signals) signal.emissiveIntensity = journey?.scene === 'm2_hamann' && journey.step >= 3 ? 3 : .55 + Math.sin(elapsed * 2) * .25;
    if (this.crowd) {
      const { bodies, heads, arms, poses } = this.crowd;
      const dancing = journey?.scene === 'm2_temple' && journey.step >= 2 && !journey.visiting;
      const matrix = new THREE.Matrix4(), position = new THREE.Vector3(), scale = new THREE.Vector3(), rotation = new THREE.Quaternion();
      for (let i = 0; i < poses.length; i++) {
        const [x, z, h] = poses[i]; const wave = dancing ? Math.sin(elapsed * 4.6 + i * .53) : Math.sin(elapsed * .7 + i) * .12;
        const rise = dancing ? Math.max(0, wave) * .32 : 0; rotation.setFromEuler(new THREE.Euler(0, Math.sin(elapsed * .35 + i) * .1, dancing ? wave * .13 : 0));
        position.set(x, h * .4 + rise, z); scale.set(1, h * .75, 1); matrix.compose(position, rotation, scale); bodies.setMatrixAt(i, matrix);
        position.set(x, h - .25 + rise, z); scale.setScalar(1); matrix.compose(position, rotation, scale); heads.setMatrixAt(i, matrix);
        for (const side of [-1, 1]) {
          const angle = dancing ? side * (.2 + (wave + 1) * .35) : side * .18;
          position.set(x + side * .55, h * .64 + rise + Math.abs(Math.sin(angle)) * .18, z);
          rotation.setFromEuler(new THREE.Euler(0, 0, angle)); scale.set(1, h * .44, 1); matrix.compose(position, rotation, scale);
          arms.setMatrixAt(i * 2 + (side + 1) / 2, matrix);
        }
      }
      bodies.instanceMatrix.needsUpdate = heads.instanceMatrix.needsUpdate = arms.instanceMatrix.needsUpdate = true;
    }
  }
  dispose(): void {
    this.disposed = true; this.group.removeFromParent(); this.group.clear();
    this.geometries.forEach(g => g.dispose()); this.materials.forEach(m => m.dispose()); this.textures.forEach(t => t.dispose()); this.lights.forEach(l => l.dispose());
    this.geometries.clear(); this.materials.clear(); this.textures.clear(); this.lights.clear();
  }
}
