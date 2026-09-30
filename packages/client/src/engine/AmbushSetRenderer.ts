import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { FILM_SETS, AMBUSH_WALLS, AMBUSH_SEALS, AMBUSH_FLOORS, AMBUSH_RAILS, AMBUSH_STAIRS, AMBUSH_STOREYS, AMBUSH_ESCAPE, ambushCat, ambushFloor, type FilmJourney, type WorldStructure } from '@auto_matrix/shared';
import { reach } from '../agents/SpoonPerformance.js';
import { WetwallRenderer } from './WetwallRenderer.js';

/** The changed masonry uses the same footprints as the saved, authoritative barriers. */
export class AmbushSetRenderer {
  private root = new THREE.Group();
  private seals = new THREE.Group();
  private eighthSeals = new THREE.Group();
  private lowerWindows: THREE.Mesh[] = [];
  private gunfire = new THREE.PointLight(0xffcb80, 0, 22, 2);
  private cat = new THREE.Group();
  private body = new THREE.Group();
  private legs: THREE.Group[] = [];
  private knees: THREE.Group[] = [];
  private ankles: THREE.Group[] = [];
  private pawSoles: THREE.Vector3[] = [];
  private tail = new THREE.Group();
  private bathroom = new THREE.Group();
  private bathroomIntact = new THREE.Group();
  private bathroomDebris = new THREE.Group();
  private bathroomDust = new THREE.Group();
  private bathroomLight!: THREE.PointLight;
  private daylight: THREE.SpotLight;
  private window: THREE.Mesh;
  private materials: THREE.Material[] = [];
  private textures: THREE.Texture[] = [];
  private clock = 0;
  private previousTime = 0;
  private catReportedTime = -1;
  private catReportedAt = 0;
  private wetwall: WetwallRenderer;
  constructor(parent: THREE.Group) {
    parent.add(this.root);
    const plaster = this.pbr('damaged_plaster', 0x989d86, 4);
    const floor = this.pbr('old_wood_floor', 0x81745c, 6);
    const wood = this.pbr('old_wood_floor', 0x4e5140, 2);
    const trim = this.mat(0xaaa892, .8); const iron = this.mat(0x353d37, .45, .6);
    for (const surface of AMBUSH_FLOORS) this.box(floor, surface.x, surface.y - .18, surface.z, surface.width, .36, surface.depth);
    // The upper floor and ceiling both have a real aperture above the lift and
    // stairs. A continuous slab here would cut through every climbing body.
    for (const surface of AMBUSH_FLOORS.slice(0, 4)) this.box(plaster, surface.x, 9.2, surface.z, surface.width, .4, surface.depth);
    this.makeStairwell(wood, iron);
    for (const z of [-34, 34]) this.box(plaster, 0, 4.5, z, 44, 9, .7);
    this.box(plaster, 22, 4.5, 0, .7, 9, 68);
    // The side window is a genuine opening, so its light can disappear with the brickwork.
    this.box(plaster, -22, 4.5, 11.75, .7, 9, 44.5);
    this.box(plaster, -22, 4.5, -26.75, .7, 9, 14.5);
    this.box(plaster, -22, 1, -15, .7, 2, 9);
    for (const wall of AMBUSH_WALLS) {
      this.box(plaster, wall.x, wall.height / 2, wall.z, wall.width, wall.height, wall.depth);
      for (const y of [.24, 3.15, 8.65]) this.box(wood, wall.x, y, wall.z, wall.width + .13, y === .24 ? .48 : .15, wall.depth + .13);
    }
    // Keep the original doorway for corridor saves and the subsequent blockade.
    for (const x of [-3.15, 3.15]) {
      this.box(wood, x, 4.1, -20.6, .35, 8.2, 1);
      this.box(trim, x, 4.1, -20.04, .5, 8.2, .14);
    }
    this.box(wood, 0, 8.3, -20.6, 6.7, .5, 1);
    this.box(plaster, 0, 8.85, -21, 6, .3, .6);
    this.box(wood, 0, .04, -21, 6, .08, 1);
    // Exposed studs and laths distinguish the escape opening from the blocked door.
    for (const z of [-20, -12]) {
      this.box(wood, -13, 4.4, z, .7, 8.8, .3);
      for (let i = 0; i < 17; i++) this.box(floor, -12.62, .4 + i * .49, z + (z === -20 ? .42 : -.42), .1, .12, .9 + i % 3 * .15).rotation.x = (i % 3 - 1) * .08;
    }
    for (let z = -31; z < -20; z += 2) this.box(wood, -21.55, 4.5, z, .25, 9, .16);
    for (const z of [4, 18]) for (const side of [-1, 1]) {
      const x = side * 12.6;
      this.box(wood, x, 3.5, z, .14, 7, 4.7);
      for (const y of [1.85, 4.8]) this.box(trim, x - side * .09, y, z, .05, 2.3, 3.7);
      this.box(iron, x - side * .2, 3.4, z + 1.5, .18, .24, .15);
      for (const dz of [-2.6, 2.6]) this.box(trim, x - side * .16, 3.7, z + dz, .25, 7.4, .22);
    }
    for (const z of [-27, -7, 14, 30]) {
      this.box(wood, 0, 8.85, z, 26, .28, .36);
      this.box(iron, 0, 8.2, z, .035, 1.1, .035);
      const shade = new THREE.Mesh(new THREE.SphereGeometry(.38, 16, 10), this.mat(0xcec3a0, .4));
      shade.position.set(0, 7.6, z); shade.scale.y = .6; this.root.add(shade);
      const bulb = new THREE.PointLight(0xe0cc9c, 35, 25, 2); bulb.position.set(0, 7.1, z); this.root.add(bulb);
    }
    const windowMaterial = new THREE.MeshBasicMaterial({ color: 0x9cac9b }); this.materials.push(windowMaterial);
    this.window = this.box(windowMaterial, -22.1, 5.3, -15, .1, 6.6, 9);
    for (const z of [-19.5, -17.25, -15, -12.75, -10.5]) this.box(wood, -21.8, 5.3, z, .3, 6.9, .15);
    for (const y of [2, 5.3, 8.6]) this.box(wood, -21.8, y, -15, .3, .18, 9.3);
    this.box(trim, -21.5, 1.95, -15, 1.1, .2, 9.6);
    const glass = this.mat(0x8c9b8c, .38); glass.emissive.setHex(0x37433a);
    this.box(glass, 0, 5, -33.55, 6, 6, .08);
    for (const x of [-3, 0, 3]) this.box(wood, x, 5, -33.4, .17, 6.3, .3);
    this.box(wood, 0, 5, -33.4, 6.3, .17, .3);
    // Small fragments and worn floorboards stay out of the walking corridor.
    for (let i = 0; i < 55; i++) {
      const side = i % 2 ? 1 : -1; const x = side * (10.9 + i % 5 * .23); const z = -31 + i * 11 % 62;
      const chip = this.box(trim, x, .065, z, .2 + i % 3 * .14, .1, .12 + i % 4 * .11); chip.rotation.y = i * 2.4;
    }
    this.makeLowerFloors(plaster, wood, trim, iron, windowMaterial);
    this.batch();
    this.wetwall = new WetwallRenderer(this.root, { plaster, wood, iron, trim });
    this.root.add(this.seals, this.eighthSeals, this.cat, this.gunfire);
    this.gunfire.position.set(-17, 3, -15);
    this.eighthSeals.position.y = AMBUSH_ESCAPE.window.y;
    this.brickwork(this.seals, 9); this.brickwork(this.eighthSeals, 7.4); this.makeCat(); this.makeBathroom();
    this.daylight = new THREE.SpotLight(0xdce5c8, 1250, 58, .72, .35, 2);
    this.daylight.position.set(-24, 8, -17); this.daylight.target.position.set(3, .5, -10);
    this.daylight.castShadow = true; this.daylight.shadow.mapSize.set(1024, 1024); this.daylight.shadow.normalBias = .05;
    this.root.add(this.daylight, this.daylight.target);
    const doorLight = new THREE.PointLight(0xc5d0b8, 65, 22, 2); doorLight.position.set(0, 5, -27); this.root.add(doorLight);
  }
  private mat(color: number, roughness = .7, metalness = 0): THREE.MeshStandardMaterial {
    const material = new THREE.MeshStandardMaterial({ color, roughness, metalness }); this.materials.push(material); return material;
  }
  private pbr(id: string, color: number, repeat: number): THREE.MeshStandardMaterial {
    const texture = (kind: string) => {
      const map = new THREE.TextureLoader().load(`/assets/film-materials/${id}-${kind}.jpg`);
      map.wrapS = map.wrapT = THREE.RepeatWrapping; map.repeat.set(repeat, repeat); map.anisotropy = 8;
      if (kind === 'color') map.colorSpace = THREE.SRGBColorSpace; this.textures.push(map); return map;
    };
    const material = this.mat(color, .88); material.map = texture('color'); material.normalMap = texture('normal'); material.roughnessMap = texture('roughness'); material.normalScale.set(.35, .35); return material;
  }
  private box(material: THREE.Material, x: number, y: number, z: number, w: number, h: number, d: number, parent = this.root): THREE.Mesh {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material); mesh.position.set(x, y, z); mesh.castShadow = mesh.receiveShadow = true; parent.add(mesh); return mesh;
  }
  private makeStairwell(wood: THREE.Material, iron: THREE.Material): void {
    for (const rail of AMBUSH_RAILS) {
      const alongX = rail.width > rail.depth, length = Math.max(rail.width, rail.depth);
      this.box(wood, rail.x, rail.y + rail.height - .1, rail.z, alongX ? length : .24, .2, alongX ? .24 : length);
      for (let offset = -length / 2 + .12; offset < length / 2; offset += .85) {
        this.box(iron, rail.x + (alongX ? offset : 0), rail.y + 1.45, rail.z + (alongX ? 0 : offset), .1, 2.9, .1);
      }
    }
    // Closed cage bars are closer together than a player's collision diameter.
    // The lift is scenery, not an unlocked shortcut through the stair flights.
    const low = -AMBUSH_STAIRS.rise * AMBUSH_STOREYS, high = 9.4;
    for (const side of [-1, 1]) {
      for (let z = 18; z <= 28; z += .5) this.box(iron, side * 2.5, (low + high) / 2, z, .09, high - low, .09);
      for (let x = -2.5; x <= 2.5; x += .5) this.box(iron, x, (low + high) / 2, 23 + side * 5, .09, high - low, .09);
      for (const y of [...Array.from({ length: AMBUSH_STOREYS * 2 + 1 }, (_, floor) => low + floor * 3.7 + .2), 4.5, 9.2]) {
        this.box(iron, side * 2.5, y, 23, .18, .18, 10);
        this.box(iron, 0, y, 23 + side * 5, 5.2, .18, .18);
      }
    }
    this.box(iron, 0, low - .35, 23, 5, .7, 10);
    for (const x of [-1.25, 1.25]) this.cylinder(iron, x, (low + high) / 2, 23, .035, high - low);
    for (let floor = 0; floor < AMBUSH_STOREYS; floor++) for (const [x, base, direction] of [[AMBUSH_STAIRS.left, -7.4, -1], [AMBUSH_STAIRS.right, -3.7, 1]]) for (const side of [-1, 1]) {
      const y = base - floor * AMBUSH_STAIRS.rise;
      const beam = this.box(iron, x + side * 2.1, y + 1.65, 23, .22, .35, Math.hypot(12, 3.7));
      beam.rotation.x = -direction * Math.atan2(3.7, 12);
    }
    const glass = this.mat(0xcbd2ba, .5); glass.emissive.setHex(0x55604a);
    this.box(glass, 0, 9.6, 20.5, 18, .12, 17);
    for (let x = -9; x <= 9; x += 3) this.box(iron, x, 9.45, 20.5, .18, .3, 17);
    for (let z = 12; z <= 29; z += 3.4) this.box(iron, 0, 9.45, z, 18, .3, .18);
    const light = new THREE.PointLight(0xdbe2ca, 240, 32, 2); light.position.set(0, 7.6, 20.5); this.root.add(light);
    const lower = new THREE.PointLight(0xd4c99d, 100, 20, 2); lower.position.set(-5.5, -2, 31.5); this.root.add(lower);
  }
  private makeLowerFloors(plaster: THREE.Material, wood: THREE.Material, trim: THREE.Material, iron: THREE.Material, glass: THREE.Material): void {
    const lamp = this.mat(0xc8b587, .5); lamp.emissive.setHex(0x8e7846); lamp.emissiveIntensity = .65;
    for (let floor = 1; floor <= AMBUSH_STOREYS; floor++) {
      const y = -floor * AMBUSH_STAIRS.rise, height = AMBUSH_STAIRS.rise;
      for (const z of [-34, 34]) this.box(plaster, 0, y + height / 2, z, 44, height, .7);
      this.box(plaster, 22, y + height / 2, 0, .7, height, 68);
      for (const [z, depth] of [[11.75, 44.5], [-26.75, 14.5]]) this.box(plaster, -22, y + height / 2, z, .7, height, depth);
      this.box(plaster, -22, y + .8, -15, .7, 1.6, 9);
      const window = this.box(glass, -22.1, y + 4.4, -15, .1, 5.6, 9); this.lowerWindows.push(window);
      for (const z of [-19.5, -17.25, -15, -12.75, -10.5]) this.box(wood, -21.8, y + 4.4, z, .3, 5.8, .15);
      for (const level of [1.6, 4.4, 7.2]) this.box(wood, -21.8, y + level, -15, .3, .18, 9.3);
      for (const wall of AMBUSH_WALLS) {
        this.box(plaster, wall.x, y + height / 2, wall.z, wall.width, height, wall.depth);
        for (const level of [.24, 3.15, 7.05]) this.box(wood, wall.x, y + level, wall.z, wall.width + .13, level === .24 ? .48 : .15, wall.depth + .13);
      }
      for (const x of [-3.15, 3.15]) this.box(wood, x, y + 3.2, -20.6, .35, 6.4, 1);
      this.box(wood, 0, y + 6.5, -20.6, 6.7, .4, 1); this.box(plaster, 0, y + 7.05, -21, 6, .7, .6);
      for (const z of [-20, -12]) this.box(wood, -13, y + 3.5, z, .7, 7, .3);
      for (const side of [-1, 1]) for (const z of [4, 18]) {
        this.box(wood, side * 12.6, y + 3.3, z, .14, 6.6, 4.7);
        this.box(iron, side * 12.4, y + 3.3, z + 1.5, .18, .24, .15);
      }
      for (const z of [8, 31.5]) this.box(lamp, -11, y + 6, z, .45, .3, .45);
      this.box(trim, 0, y + .08, 31.5, 1.3, .15, .3);
      this.sign(`${13 - floor}`, 17, y + 4.3, 33.58, Math.PI, 2.4, 2);
    }
    this.sign('13 / 1313', -12.6, 5.7, -17.5, Math.PI / 2, 2.8, 1.2);
    this.sign('8 / 808', -12.6, AMBUSH_ESCAPE.window.y + 5.1, -17.5, Math.PI / 2, 2.8, 1.2);
    const y = AMBUSH_ESCAPE.wetwall.y;
    const light = new THREE.PointLight(0xcfbd94, 145, 35, 2); light.position.set(-5, y + 6, -14); this.root.add(light);
  }
  private sign(text: string, x: number, y: number, z: number, yaw: number, width: number, height: number): void {
    if (typeof document === 'undefined') return;
    const canvas = document.createElement('canvas'); canvas.width = 256; canvas.height = 128;
    const context = canvas.getContext('2d')!; context.fillStyle = '#302f28'; context.fillRect(0, 0, 256, 128);
    context.strokeStyle = '#a29b81'; context.lineWidth = 3; context.strokeRect(5, 5, 246, 118);
    context.fillStyle = '#d9d1b4'; context.font = '52px serif'; context.textAlign = 'center'; context.textBaseline = 'middle'; context.fillText(text, 128, 64);
    const map = new THREE.CanvasTexture(canvas); map.colorSpace = THREE.SRGBColorSpace; this.textures.push(map);
    const material = new THREE.MeshBasicMaterial({ map }); this.materials.push(material);
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(width, height), material); mesh.position.set(x, y, z); mesh.rotation.y = yaw; mesh.userData.sign = true; this.root.add(mesh);
  }
  private brickwork(parent: THREE.Group, height: number): void {
    const mortar = this.mat(0x6f7264, 1); const brick = this.mat(0x645e49, .95);
    for (const wall of AMBUSH_SEALS) {
      this.box(mortar, wall.x, height / 2, wall.z, wall.width, height, wall.depth, parent);
      const side = wall.width < wall.depth; const length = side ? wall.depth : wall.width;
      const rows = Math.floor(height / .5); const columns = Math.ceil(length / .9) + 1;
      const mesh = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), brick, rows * columns);
      const object = new THREE.Object3D(); const color = new THREE.Color(); let index = 0;
      for (let row = 0; row < rows; row++) for (let col = 0; col < columns; col++) {
        const start = Math.max(-length / 2, -length / 2 + col * .9 - (row % 2) * .45);
        const end = Math.min(length / 2, -length / 2 + (col + 1) * .9 - (row % 2) * .45);
        if (end - start < .08) continue;
        const span = end - start - .045; const along = (start + end) / 2;
        object.position.set(wall.x + (side ? 0 : along), .24 + row * .5, wall.z + (side ? along : 0));
        object.scale.set(side ? .71 : span, .445, side ? span : .71); object.rotation.set(0, 0, 0); object.updateMatrix();
        mesh.setMatrixAt(index, object.matrix); mesh.setColorAt(index++, color.setScalar(.68 + (row * 7 + col * 3) % 9 * .037));
      }
      mesh.count = index; mesh.castShadow = mesh.receiveShadow = true; parent.add(mesh);
    }
  }
  private makeCat(): void {
    const fur = this.mat(0x141814, .84); const eye = this.mat(0xb2aa65, .25); const nose = this.mat(0x302b2b, .7);
    const oval = (parent: THREE.Object3D, material: THREE.Material, x: number, y: number, z: number, sx: number, sy: number, sz: number) => {
      const mesh = new THREE.Mesh(new THREE.SphereGeometry(1, 20, 14), material); mesh.position.set(x, y, z); mesh.scale.set(sx, sy, sz); mesh.castShadow = mesh.receiveShadow = true; parent.add(mesh); return mesh;
    };
    this.cat.add(this.body); this.body.position.y = .8;
    this.cat.name = 'ambush-black-cat';
    oval(this.body, fur, 0, .05, 0, .8, .32, .29); oval(this.body, fur, .59, .18, 0, .33, .39, .3);
    oval(this.body, fur, .89, .45, 0, .3, .28, .28); oval(this.body, fur, 1.08, .32, 0, .17, .12, .18);
    oval(this.body, nose, 1.23, .37, 0, .05, .04, .05);
    for (const side of [-1, 1]) {
      const ear = new THREE.Mesh(new THREE.ConeGeometry(.15, .31, 8), fur); ear.position.set(.88, .77, side * .18); ear.rotation.x = side * .2; this.body.add(ear);
      oval(this.body, eye, 1.08, .49, side * .2, .045, .035, .02);
      oval(this.body, fur, 1.09, .49, side * .218, .013, .03, .006);
      for (const rear of [false, true]) {
        const limb = new THREE.Group(); limb.position.set(rear ? -.58 : .54, .67, side * .2); this.cat.add(limb); this.legs.push(limb);
        oval(limb, fur, 0, -.18, 0, rear ? .15 : .095, .2, .1);
        const knee = new THREE.Group(); knee.position.y = -.38; limb.add(knee); this.knees.push(knee);
        oval(knee, fur, 0, -.16, 0, .065, .19, .072);
        const ankle = new THREE.Group(); ankle.position.y = -.36; knee.add(ankle); this.ankles.push(ankle);
        const paw = oval(ankle, fur, 0, 0, 0, .18, .075, .095); paw.name = 'ambush-cat-paw';
        if (!this.pawSoles.length) for (let i = 0; i < paw.geometry.attributes.position.count; i++) {
          const point = paw.getVertexPosition(i, new THREE.Vector3()).multiply(paw.scale);
          if (point.y <= .000001) this.pawSoles.push(point);
        }
      }
    }
    const curve = new THREE.CatmullRomCurve3([new THREE.Vector3(0, 0, 0), new THREE.Vector3(-.4, .12, .08), new THREE.Vector3(-.8, .65, .12), new THREE.Vector3(-.84, 1.1, .1), new THREE.Vector3(-.63, 1.3, .06)]);
    const tail = new THREE.Mesh(new THREE.TubeGeometry(curve, 24, .065, 8, false), fur); tail.castShadow = true; this.tail.add(tail); this.tail.position.set(-.72, .85, 0); this.cat.add(this.tail);
  }
  private makeBathroom(): void {
    this.bathroom.name = 'ambush-bathroom-holdout'; this.root.add(this.bathroom);
    const tile = this.mat(0xb6b7aa, .74); const grout = this.mat(0x666b61, .96); const porcelain = this.mat(0xd5d4c5, .42);
    const enamel = this.mat(0xaaa99d, .32, .08); const pipe = this.mat(0x59605b, .38, .72); const plaster = this.mat(0x77796c, .94);
    // A tiled strip and exposed plumbing establish the bathroom without narrowing the playable door line.
    this.box(grout, 12.58, 4.15, -4, .12, 7.8, 18, this.bathroom);
    for (let row = 0; row < 8; row++) for (let column = 0; column < 18; column++) {
      const slab = this.box(tile, 12.5, .68 + row * .91, -12.05 + column * .91, .075, .82, .82, this.bathroom);
      slab.name = row === 0 && column === 0 ? 'ambush-bathroom-wall-tiles' : '';
    }
    const tub = new THREE.Group(); tub.name = 'ambush-bathroom-tub'; tub.position.set(8.8, 0, 2.4); this.bathroom.add(tub);
    this.box(enamel, 0, .74, 0, 5.5, 1.45, 2.8, tub);
    this.box(grout, 0, 1.3, 0, 4.75, .82, 2.18, tub);
    this.box(tile, 0, 1.42, 0, 4.35, .8, 1.78, tub);
    for (const x of [-2.2, 2.2]) this.box(pipe, x, .27, 0, .15, .52, 2.3, tub);
    const sink = new THREE.Group(); sink.name = 'ambush-bathroom-sink'; sink.position.set(10.65, 0, -10.4); this.bathroom.add(sink);
    this.box(porcelain, 0, 2.25, 0, 2.8, .46, 1.45, sink); this.box(grout, 0, 2.37, -.02, 2.15, .32, .92, sink);
    this.cylinder(pipe, 0, 1.12, .18, .08, 1.95, sink); this.cylinder(pipe, 0, 2.72, .18, .12, .45, sink);
    for (const side of [-1, 1]) this.cylinder(pipe, side * .55, 2.64, 0, .1, .28, sink);
    const mirror = new THREE.Mesh(new THREE.PlaneGeometry(2.65, 2.5), this.mat(0x8f9b93, .08, .25)); mirror.name = 'ambush-bathroom-mirror';
    mirror.position.set(12.42, 4.25, -10.4); mirror.rotation.y = -Math.PI / 2; this.bathroom.add(mirror);

    this.bathroomIntact.name = 'ambush-bathroom-partition-intact'; this.bathroom.add(this.bathroomIntact);
    this.box(plaster, 3.35, 4.35, -8.25, 7.2, 8.1, .34, this.bathroomIntact);
    for (let row = 0; row < 8; row++) for (let column = 0; column < 7; column++) {
      const slab = this.box(tile, .45 + column * .94, .77 + row * .92, -8.03, .84, .82, .055, this.bathroomIntact);
      slab.rotation.z = (column * 7 + row * 3) % 13 === 0 ? .012 : 0;
    }
    this.bathroomDebris.name = 'ambush-bathroom-breach-debris'; this.bathroom.add(this.bathroomDebris);
    for (let i = 0; i < 42; i++) {
      const material = i % 3 ? plaster : tile; const x = .3 + i * 17 % 68 / 10; const z = -11.7 + i * 23 % 68 / 10;
      const piece = this.box(material, x, .12 + i % 5 * .055, z, .24 + i % 4 * .18, .14 + i % 3 * .09, .3 + i % 5 * .13, this.bathroomDebris);
      piece.rotation.set((i % 5 - 2) * .13, i * .77, (i % 7 - 3) * .11);
    }
    for (const x of [.45, 6.25]) {
      const stud = this.box(pipe, x, 3.7, -8.24, .18, 7.1, .19, this.bathroomDebris); stud.rotation.z = x < 1 ? -.12 : .16;
    }
    this.bathroomDust.name = 'ambush-bathroom-breach-dust'; this.bathroom.add(this.bathroomDust);
    const dust = this.mat(0xbdb7a0, 1); dust.transparent = true; dust.opacity = .18; dust.depthWrite = false;
    for (let i = 0; i < 14; i++) {
      const cloud = new THREE.Mesh(new THREE.SphereGeometry(.55 + i % 4 * .22, 10, 7), dust); cloud.position.set(1 + i * 13 % 55 / 10, 1 + i % 5 * .55, -9.1 + (i % 4 - 1.5) * .65);
      cloud.scale.set(1.35, .72, .8); cloud.userData.baseY = cloud.position.y; this.bathroomDust.add(cloud);
    }
    this.bathroomLight = new THREE.PointLight(0xe5e1c3, 95, 18, 2); this.bathroomLight.name = 'ambush-bathroom-light';
    this.bathroomLight.position.set(6, 7.6, -4.5); this.bathroom.add(this.bathroomLight);
  }
  private cylinder(material: THREE.Material, x: number, y: number, z: number, radius: number, height: number, parent = this.root): THREE.Mesh {
    const mesh = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, height, 14), material); mesh.position.set(x, y, z); mesh.castShadow = mesh.receiveShadow = true; parent.add(mesh); return mesh;
  }
  update(journey: FilmJourney | undefined, structures: WorldStructure[], elapsed: number): void {
    this.wetwall.update(journey);
    const sealed = structures.some(s => s.film?.scene === 'm1_dejavu');
    this.seals.visible = sealed; this.window.visible = !sealed; this.daylight.intensity = sealed ? 0 : 1250;
    this.eighthSeals.visible = structures.some(s => s.film?.scene === 'm1_dejavu' && Math.abs(s.position.y - AMBUSH_ESCAPE.window.y - FILM_SETS.film_ambush_house.center.y) < .1);
    this.lowerWindows.forEach((window, floor) => { window.visible = floor !== AMBUSH_STOREYS - 1 || !this.eighthSeals.visible; });
    const escape = journey?.scene === 'm1_dejavu' && !journey.visiting ? journey.ambushEscape : undefined;
    this.gunfire.intensity = escape?.phase === 'alarm' && escape.elapsed >= AMBUSH_ESCAPE.shots && escape.elapsed < AMBUSH_ESCAPE.mouse
      ? Math.sin(escape.elapsed * 51) > .2 ? 900 : 0 : 0;
    const observing = journey?.scene === 'm1_dejavu' && journey.step === 0 && !journey.visiting && journey.ambush;
    const target = observing ? journey.ambush!.elapsed : 0;
    const dt = Math.min(.1, Math.max(0, elapsed - this.previousTime)); this.previousTime = elapsed;
    const stairs = journey?.ambushApproach?.stairCat;
    if (stairs) {
      if (dt === 0 || this.catReportedTime !== target || journey?.ambush?.paused) { this.catReportedTime = target; this.catReportedAt = elapsed; }
      this.clock = target + Math.min(.5, Math.max(0, elapsed - this.catReportedAt));
    } else if (dt === 0 || Math.abs(this.clock - target) > 1) this.clock = target;
    else this.clock += (target - this.clock) * (1 - Math.exp(-dt * 18));
    const cat = ambushCat(this.clock, stairs); this.cat.visible = Boolean(observing && cat.visible);
    this.cat.position.set(cat.x, cat.y, cat.z); this.cat.rotation.y = cat.yaw;
    if (this.cat.visible) this.poseCat(cat, stairs);
    const betrayal = journey?.betrayal?.kind === 'bathroom' ? journey.betrayal : undefined;
    const breached = Boolean(journey?.completed.includes('m1_bathroom') || betrayal?.phase === 'done'
      || betrayal?.phase === 'sacrifice' && betrayal.elapsed >= 2.1);
    this.bathroomIntact.visible = !breached; this.bathroomDebris.visible = breached;
    const crash = betrayal?.phase === 'sacrifice' && betrayal.elapsed >= 2.1 && betrayal.elapsed < 4.4;
    this.bathroomDust.visible = Boolean(crash);
    if (crash) for (const [i, cloud] of this.bathroomDust.children.entries()) {
      const age = Math.min(1, (betrayal!.elapsed - 2.1) / 2.3); cloud.position.y = Number(cloud.userData.baseY) + age * (1.4 + i % 3 * .2);
      cloud.scale.setScalar(.75 + age * 1.35); cloud.rotation.y = elapsed * (.08 + i * .005);
    }
    const struggle = betrayal?.phase === 'defending' || betrayal?.phase === 'sacrifice';
    this.bathroomLight.intensity = struggle ? 68 + Math.sin(elapsed * 17) * 17 : 95;
  }
  private poseCat(cat: ReturnType<typeof ambushCat>, stairs = false): void {
    const stretching = cat.phase > 1.1 && cat.phase < 2.1;
    const stretch = stretching ? Math.sin((cat.phase - 1.1) * Math.PI) : 0;
    this.body.position.y = .8 - stretch * .18; this.body.rotation.z = -stretch * .16; this.body.scale.x = 1 + stretch * .1;
    this.cat.updateWorldMatrix(true, true);
    const rotation = this.cat.getWorldQuaternion(new THREE.Quaternion()), origin = this.root.getWorldPosition(new THREE.Vector3());
    const feet = this.legs.map((leg, i) => {
      const phase = (cat.phase / .32 + (i === 0 || i === 3 ? 0 : .5)) % 1, swing = Math.max(0, (phase - .65) / .35);
      const stride = stretching ? (i % 2 ? -.16 : .23) * stretch : phase < .65 ? .32 - .64 * phase / .65 : -.32 + .64 * THREE.MathUtils.smoothstep(swing, 0, 1);
      const foot = new THREE.Vector3(leg.position.x + stride, 0, leg.position.z); this.cat.localToWorld(foot);
      let support = stairs ? -Infinity : origin.y;
      if (stairs) for (const sole of this.pawSoles) {
        const point = sole.clone().applyQuaternion(rotation).add(foot), floor = ambushFloor(point.x - origin.x, point.z - origin.z, cat.y + .8);
        if (floor !== undefined) support = Math.max(support, origin.y + floor - point.y + foot.y - .075);
      }
      foot.y = support + .075 + (stretching ? 0 : Math.sin(swing * Math.PI) * .16);
      return { foot, support };
    });
    const floor = feet.reduce((sum, foot) => sum + foot.support, 0) / 4;
    const grade = stairs ? Math.atan2((feet[0].support + feet[2].support - feet[1].support - feet[3].support) / 2, 1.12) : 0;
    this.body.position.y += floor - origin.y - cat.y; this.body.rotation.z += grade;
    for (const leg of this.legs) leg.position.y = .67 + floor - origin.y - cat.y + Math.sin(grade) * leg.position.x - stretch * .1;
    this.cat.updateWorldMatrix(true, true);
    for (const [i, leg] of this.legs.entries()) {
      const knee = this.knees[i], ankle = this.ankles[i];
      reach(leg, knee, ankle.position, feet[i].foot, new THREE.Vector3(i % 2 ? -1 : 1, 0, 0).applyQuaternion(rotation));
      ankle.quaternion.copy(knee.getWorldQuaternion(new THREE.Quaternion()).invert().multiply(rotation)); ankle.updateWorldMatrix(false, true);
    }
    this.tail.rotation.x = Math.sin(cat.phase * 3) * .18; this.tail.rotation.z = -stretch * .2;
  }
  private batch(): void {
    const batches = new Map<THREE.Material, THREE.BufferGeometry[]>();
    for (const child of [...this.root.children]) {
      if (!(child instanceof THREE.Mesh) || child === this.window || this.lowerWindows.includes(child) || child.userData.sign || Array.isArray(child.material)) continue;
      child.updateMatrix(); const source = child.geometry.clone().applyMatrix4(child.matrix); const geometry = source.index ? source.toNonIndexed() : source;
      if (source !== geometry) source.dispose(); const group = batches.get(child.material) ?? []; group.push(geometry); batches.set(child.material, group);
      child.geometry.dispose(); child.removeFromParent();
    }
    for (const [material, geometries] of batches) {
      const geometry = mergeGeometries(geometries); geometries.forEach(g => g.dispose()); if (!geometry) throw new Error('Ambush geometry could not be merged');
      const mesh = new THREE.Mesh(geometry, material); mesh.castShadow = mesh.receiveShadow = true; this.root.add(mesh);
    }
  }
  dispose(): void {
    this.wetwall.dispose();
    this.root.traverse(object => { if (object instanceof THREE.Mesh) object.geometry.dispose(); if (object instanceof THREE.InstancedMesh || object instanceof THREE.PointLight || object instanceof THREE.SpotLight) object.dispose(); });
    this.materials.forEach(m => m.dispose()); this.textures.forEach(t => t.dispose()); this.root.removeFromParent();
  }
}
