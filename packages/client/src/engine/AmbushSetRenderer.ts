import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { AMBUSH_WALLS, AMBUSH_SEALS, ambushCat, type FilmJourney, type WorldStructure } from '@auto_matrix/shared';

/** The changed masonry uses the same footprints as the saved, authoritative barriers. */
export class AmbushSetRenderer {
  private root = new THREE.Group();
  private seals = new THREE.Group();
  private cat = new THREE.Group();
  private body = new THREE.Group();
  private legs: THREE.Group[] = [];
  private tail = new THREE.Group();
  private daylight: THREE.SpotLight;
  private window: THREE.Mesh;
  private materials: THREE.Material[] = [];
  private textures: THREE.Texture[] = [];
  private clock = 0;
  private previousTime = 0;
  constructor(parent: THREE.Group) {
    parent.add(this.root);
    const plaster = this.pbr('damaged_plaster', 0x989d86, 4);
    const floor = this.pbr('old_wood_floor', 0x81745c, 6);
    const wood = this.pbr('old_wood_floor', 0x4e5140, 2);
    const trim = this.mat(0xaaa892, .8); const iron = this.mat(0x353d37, .45, .6);
    this.box(floor, 0, -.2, 0, 44, .4, 68);
    this.box(plaster, 0, 9.2, 0, 44, .4, 68);
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
    // A deep, open doorway frames both passes of the cat in the same place.
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
    this.batch();
    this.root.add(this.seals, this.cat);
    this.brickwork(); this.makeCat();
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
  private brickwork(): void {
    const mortar = this.mat(0x6f7264, 1); const brick = this.mat(0x645e49, .95);
    for (const wall of AMBUSH_SEALS) {
      this.box(mortar, wall.x, wall.height / 2, wall.z, wall.width, wall.height, wall.depth, this.seals);
      const side = wall.width < wall.depth; const length = side ? wall.depth : wall.width;
      const rows = 18; const columns = Math.ceil(length / .9) + 1;
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
      mesh.count = index; mesh.castShadow = mesh.receiveShadow = true; this.seals.add(mesh);
    }
  }
  private makeCat(): void {
    const fur = this.mat(0x141814, .84); const eye = this.mat(0xb2aa65, .25); const nose = this.mat(0x302b2b, .7);
    const oval = (parent: THREE.Object3D, material: THREE.Material, x: number, y: number, z: number, sx: number, sy: number, sz: number) => {
      const mesh = new THREE.Mesh(new THREE.SphereGeometry(1, 20, 14), material); mesh.position.set(x, y, z); mesh.scale.set(sx, sy, sz); mesh.castShadow = mesh.receiveShadow = true; parent.add(mesh); return mesh;
    };
    this.cat.add(this.body); this.body.position.y = .8;
    oval(this.body, fur, 0, .05, 0, .8, .32, .29); oval(this.body, fur, .59, .18, 0, .33, .39, .3);
    oval(this.body, fur, .89, .45, 0, .3, .28, .28); oval(this.body, fur, 1.08, .32, 0, .17, .12, .18);
    oval(this.body, nose, 1.23, .37, 0, .05, .04, .05);
    for (const side of [-1, 1]) {
      const ear = new THREE.Mesh(new THREE.ConeGeometry(.15, .31, 4), fur); ear.position.set(.88, .77, side * .18); ear.rotation.x = side * .2; this.body.add(ear);
      oval(this.body, eye, 1.08, .49, side * .2, .045, .035, .02);
      for (const rear of [false, true]) {
        const limb = new THREE.Group(); limb.position.set(rear ? -.58 : .54, .67, side * .2); this.cat.add(limb); this.legs.push(limb);
        oval(limb, fur, 0, -.2, 0, rear ? .16 : .095, .29, .1);
        oval(limb, fur, rear ? -.09 : .01, -.47, 0, .065, .23, .072);
        oval(limb, fur, .065, -.62, 0, .18, .075, .095);
      }
    }
    const curve = new THREE.CatmullRomCurve3([new THREE.Vector3(0, 0, 0), new THREE.Vector3(-.4, .12, .08), new THREE.Vector3(-.8, .65, .12), new THREE.Vector3(-.84, 1.1, .1), new THREE.Vector3(-.63, 1.3, .06)]);
    const tail = new THREE.Mesh(new THREE.TubeGeometry(curve, 24, .065, 8, false), fur); tail.castShadow = true; this.tail.add(tail); this.tail.position.set(-.72, .85, 0); this.cat.add(this.tail);
  }
  update(journey: FilmJourney | undefined, structures: WorldStructure[], elapsed: number): void {
    const sealed = structures.some(s => s.film?.scene === 'm1_dejavu');
    this.seals.visible = sealed; this.window.visible = !sealed; this.daylight.intensity = sealed ? 0 : 1250;
    const observing = journey?.scene === 'm1_dejavu' && journey.step === 0 && !journey.visiting && journey.ambush;
    const target = observing ? journey.ambush!.elapsed : 0;
    const dt = Math.min(.1, Math.max(0, elapsed - this.previousTime)); this.previousTime = elapsed;
    if (Math.abs(this.clock - target) > 1) this.clock = target;
    else this.clock += (target - this.clock) * (1 - Math.exp(-dt * 18));
    const cat = ambushCat(this.clock); this.cat.visible = Boolean(observing && cat.visible);
    this.cat.position.set(cat.x, 0, cat.z);
    const stretching = cat.phase > 1.1 && cat.phase < 2.1;
    const stretch = stretching ? Math.sin((cat.phase - 1.1) * Math.PI) : 0;
    this.body.position.y = .8 - stretch * .18; this.body.rotation.z = -stretch * .16; this.body.scale.x = 1 + stretch * .1;
    for (const [i, leg] of this.legs.entries()) leg.rotation.z = stretching ? (i % 2 ? -.1 : .7) * stretch : Math.sin(cat.phase * 15 + (i === 0 || i === 3 ? 0 : Math.PI)) * .42;
    this.tail.rotation.x = Math.sin(cat.phase * 3) * .18; this.tail.rotation.z = -stretch * .2;
  }
  private batch(): void {
    const batches = new Map<THREE.Material, THREE.BufferGeometry[]>();
    for (const child of [...this.root.children]) {
      if (!(child instanceof THREE.Mesh) || child === this.window || Array.isArray(child.material)) continue;
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
    this.root.traverse(object => { if (object instanceof THREE.Mesh) object.geometry.dispose(); if (object instanceof THREE.InstancedMesh || object instanceof THREE.PointLight || object instanceof THREE.SpotLight) object.dispose(); });
    this.materials.forEach(m => m.dispose()); this.textures.forEach(t => t.dispose()); this.root.removeFromParent();
  }
}
