import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { Reflector } from 'three/addons/objects/Reflector.js';
import { MOBIL_STATION, MOBIL_LUGGAGE, mobilLuggagePose, mobilTrainPose, type MobilEncounter } from '@auto_matrix/shared';
import { batchStaticGeometry } from './StaticGeometry.js';

/** Mobil's glazed station and one-car train; coordinates also drive physical support. */
export class MobilStationRenderer {
  readonly group = new THREE.Group();
  readonly train = new THREE.Group();
  readonly luggage = new THREE.Group();
  readonly reflection: Reflector;
  readonly doors: [THREE.Mesh, THREE.Mesh];
  private fixed = new THREE.Group();
  private geometries = new Set<THREE.BufferGeometry>();
  private materials = new Set<THREE.Material>();
  private textures = new Set<THREE.Texture>();
  private disposed = false;
  constructor(root: THREE.Group) {
    const station = MOBIL_STATION, train = station.train;
    this.group.name = 'mobil-white-tiled-station'; this.train.name = 'mobil-train';
    this.train.userData.dynamic = true; this.luggage.name = 'mobil-carried-suitcase';
    this.group.add(this.fixed, this.train, this.luggage); root.add(this.group);
    const porcelain = this.surface(0xe6ece6, .19), grout = this.surface(0x9daaa1, .83);
    const stone = this.surface(0x82938a, .28), steel = this.surface(0x939e96, .29, .7);
    const dark = this.surface(0x26322c, .66), enamel = this.surface(0xb7c6bd, .24, .32);
    const seat = this.surface(0x59634e, .74), rail = this.surface(0x8e9992, .3, .87);
    const glow = this.material(new THREE.MeshBasicMaterial({ color: 0xeaffef, toneMapped: false }));
    const tileCanvas = document.createElement('canvas'); tileCanvas.width = 1024; tileCanvas.height = 512;
    const tileContext = tileCanvas.getContext('2d')!;
    tileContext.fillStyle = '#e6ece6'; tileContext.fillRect(0, 0, 1024, 512);
    tileContext.strokeStyle = '#b8c4b9'; tileContext.lineWidth = 4; tileContext.strokeRect(0, 0, 1024, 512);
    const tiles = new THREE.CanvasTexture(tileCanvas); tiles.colorSpace = THREE.SRGBColorSpace;
    tiles.wrapS = tiles.wrapT = THREE.RepeatWrapping; tiles.repeat.set(station.depth / 2.3, station.height / 1.15);
    tiles.anisotropy = 8; this.textures.add(tiles);
    const tiledPorcelain = this.surface(0xffffff, .23); tiledPorcelain.map = tiles;
    const left = -station.width / 2, edge = station.edge, width = edge - left;
    this.box(this.fixed, stone, (left + edge) / 2, -.16, 0, width, .28, station.depth).name = 'mobil-platform-support';
    this.reflection = new Reflector(this.own(new THREE.PlaneGeometry(width, station.depth)),
      { color: 0x748b7d, textureWidth: 768, textureHeight: 512, clipBias: .004, multisample: 0 });
    this.reflection.name = 'mobil-polished-platform'; this.reflection.rotation.x = -Math.PI / 2;
    this.reflection.position.set((left + edge) / 2, 0, 0); this.fixed.add(this.reflection);
    const shader = this.reflection.material as THREE.ShaderMaterial;
    shader.fragmentShader = shader.fragmentShader.replace('vec4( blendOverlay( base.rgb, color ), 1.0 )', 'vec4( mix(color, base.rgb, .22), 1.0 )');
    const shadow = this.material(new THREE.MeshStandardMaterial({ color: 0x82938a, roughness: .38, transparent: true, opacity: .42, depthWrite: false }));
    const floor = this.mesh(this.fixed, this.own(new THREE.PlaneGeometry(width, station.depth)), shadow, (left + edge) / 2, .003, 0);
    floor.rotation.x = -Math.PI / 2; floor.castShadow = false;
    for (let z = -station.depth / 2; z < station.depth / 2; z += 4.6)
      this.box(this.fixed, grout, (left + edge) / 2, .008, z, width, .006, .028);
    for (let x = left + 4.4; x < edge; x += 4.4) this.box(this.fixed, grout, x, .008, 0, .028, .006, station.depth);
    this.box(this.fixed, porcelain, edge, -.63, 0, .38, 1.25, station.depth);
    this.box(this.fixed, stone, edge - .17, -.012, 0, .68, .05, station.depth);
    this.box(this.fixed, dark, (edge + station.width / 2) / 2, station.trackFloor - .12, 0,
      station.width / 2 - edge, .24, station.depth + 40);
    for (let z = -station.depth / 2 - 20; z < station.depth / 2 + 20; z += 1.8) {
      this.box(this.fixed, dark, train.x, -1.12, z, 6.2, .24, .32);
      for (const side of [-1, 1]) this.box(this.fixed, rail, train.x + side * 1.6, -.84, z, .16, .2, 1.85);
    }
    for (const side of [-1, 1]) {
      const x = side * station.width / 2;
      // Mipmapped grout avoids distant subpixel strips fighting the glazed wall.
      this.box(this.fixed, tiledPorcelain, x, station.height / 2, 0, .45, station.height, station.depth);
      for (const z of [-37, -15, 7, 29, 48]) this.box(this.fixed, porcelain, x - side * .25, station.height / 2, z, .8, station.height, 1.35, .035);
      for (const z of [-26, 17]) this.lettering(this.fixed, 'M O B I L  A V E', x - side * .3, 4.65, z, 10.8, 1.05, -side * Math.PI / 2);
    }
    const ceiling = this.surface(0xdce5da, .87); ceiling.emissive.setHex(0xb8c9b5); ceiling.emissiveIntensity = .23;
    this.box(this.fixed, ceiling, 0, station.height + .1, 0, station.width, .24, station.depth);
    for (const side of [-1, 1]) {
      const z = side * (station.depth / 2 - .3);
      // A recessed aperture keeps the looping route visibly open, rather than a painted black wall.
      for (const x of [-12.5, 12.5]) this.box(this.fixed, porcelain, x, station.height / 2, z, 9, station.height, .65);
      this.box(this.fixed, porcelain, 0, 8.2, z, 16, 2.1, .65);
      this.box(this.fixed, dark, 0, 3.6, z + side * 14, 16, 7.2, .25);
      for (const x of [-8.1, 8.1]) this.box(this.fixed, porcelain, x, 3.6, z + side * 6, .3, 7.2, 12);
      this.box(this.fixed, stone, 0, -.11, z + side * 6, 16, .2, 12);
    }
    for (const z of [-39, -20, 0, 20, 39]) {
      this.box(this.fixed, steel, -4.5, station.height - .3, z, 18.2, .2, 1.6, .06);
      this.box(this.fixed, glow, -4.5, station.height - .42, z, 17.5, .04, 1.28);
      const lamp = new THREE.PointLight(0xedfff0, 65, 28, 2); lamp.position.set(-4.5, station.height - .7, z); this.group.add(lamp);
    }
    const key = new THREE.SpotLight(0xe5f4e5, 100, 36, .9, .65, 1.8);
    key.position.set(-1, station.height - .7, 8); key.target.position.set(-3, 0, 13); key.castShadow = true;
    key.shadow.mapSize.set(1024, 1024); key.shadow.bias = -.0005; key.shadow.normalBias = .07; this.group.add(key, key.target);
    const bench = station.bench;
    const seating = new THREE.Group(); seating.name = 'mobil-family-bench'; seating.position.set(bench.x, 0, bench.z);
    seating.rotation.y = Math.PI / 2; this.fixed.add(seating);
    for (let i = 0; i < 5; i++) this.box(seating, seat, 0, bench.seat - .11, -.64 + i * .32, bench.depth, .18, .28, .035);
    for (let i = 0; i < 4; i++) this.box(seating, seat, 0, 1.85 + i * .28, -.79, bench.depth, .23, .14, .035);
    for (const x of [-2.5, 2.5]) {
      this.box(seating, steel, x, .65, 0, .18, 1.3, 1.44, .04);
      this.box(seating, steel, x, 1.61, -.77, .16, 2.64, .17, .04);
    }
    for (const [x, z, scale] of [[-14.2, -10, 1.15]] as const) {
      this.box(this.fixed, seat, x, scale * .65, z, scale * 1.5, scale * 1.3, scale * .55, .08);
      for (const dx of [-.55, .55]) this.box(this.fixed, dark, x + dx * scale, scale * .65, z, .08, scale * 1.3, scale * .58);
      this.box(this.fixed, steel, x, scale * 1.37, z, scale * .55, .17, .12, .045);
    }
    const bag = MOBIL_LUGGAGE, leather = this.surface(0x574f34, .84), trim = this.surface(0x302d24, .75);
    this.box(this.luggage, leather, 0, bag.height / 2, 0, bag.width, bag.height, bag.depth, .08).name = 'mobil-suitcase-shell';
    for (const x of [-.43, .43]) {
      this.box(this.luggage, trim, x, bag.height / 2, 0, .075, bag.height + .025, bag.depth + .025, .015);
      this.box(this.luggage, steel, x, .87, bag.depth / 2 + .016, .14, .12, .025, .012);
    }
    for (const side of [-1, 1]) this.box(this.luggage, trim, 0, bag.height / 2, side * (bag.depth / 2 + .004),
      bag.width - .15, bag.height - .15, .009, .035);
    for (const x of [-.18, .18]) this.box(this.luggage, steel, x, bag.height + .1, 0, .06, .2, .08, .025);
    this.box(this.luggage, trim, 0, bag.grip, 0, .42, .07, .09, .03).name = 'mobil-suitcase-grip';
    this.box(this.train, enamel, 0, -.1, 0, train.width, .2, train.length).name = 'mobil-train-floor';
    this.box(this.train, enamel, 0, train.height, 0, train.width, .34, train.length, .14);
    for (const side of [-1, 1]) {
      const x = side * 3.25, spans = side < 0 ? [-8.1, 8.1] : [0];
      for (const z of spans) {
        this.box(this.train, enamel, x, 1.2, z, .18, 2.4, side < 0 ? 11.8 : train.length);
        this.box(this.train, enamel, x, 5.85, z, .18, 1, side < 0 ? 11.8 : train.length);
      }
      for (const z of [-10.8, -6, 6, 10.8]) {
        const window = this.material(new THREE.MeshPhysicalMaterial({ color: 0xa0b4a9, roughness: .15, metalness: .05,
          transparent: true, opacity: .32, side: THREE.DoubleSide, depthWrite: false }));
        this.box(this.train, window, x, 4.05, z, .075, 2.4, 2.2, .05);
        for (const dz of [-1.22, 1.22]) this.box(this.train, dark, x, 4.05, z + dz, .2, 2.66, .15, .035);
        for (const y of [2.77, 5.33]) this.box(this.train, dark, x, y, z, .2, .15, 2.56, .035);
      }
      for (const z of [-13.6, -8.4, -3.4, 3.4, 8.4, 13.6]) this.box(this.train, enamel, x, 4, z, .18, 3.2, .74);
      for (const z of [-8, 8]) {
        this.box(this.train, seat, side * 2.25, 1.31, z, 1.35, .22, 8.8, .08);
        this.box(this.train, seat, side * 2.95, 2.25, z, .19, 1.8, 8.8, .08);
      }
      for (const z of [-8, 8]) {
        const wheel = this.mesh(this.train, this.own(new THREE.CylinderGeometry(.44, .44, .26, 24)), dark, side * 1.6, -.4, z);
        wheel.rotation.z = Math.PI / 2;
      }
    }
    for (const z of [-13.9, 13.9]) {
      this.box(this.train, enamel, 0, 3.14, z, train.width, 6.28, .22);
      for (const x of [-1.7, 1.7]) {
        this.box(this.train, dark, x, 4.25, z + Math.sign(z) * .13, 2.2, 1.95, .08, .16);
        this.box(this.train, glow, x, 1.4, z + Math.sign(z) * .17, .4, .38, .075, .08);
      }
      this.lettering(this.train, 'LOOP', 0, 5.93, z + Math.sign(z) * .14, 2.7, .35, z < 0 ? Math.PI : 0);
    }
    this.box(this.train, dark, 0, 5.85, 0, 1.3, .15, 25);
    for (const z of [-9, 0, 9]) this.box(this.train, glow, 0, 5.75, z, 1.1, .045, 5.8);
    const leftDoor = this.box(this.train, enamel, train.doorX, train.doorHeight / 2, -train.doorHalf, .18, train.doorHeight, train.doorWidth, .035);
    const rightDoor = this.box(this.train, enamel, train.doorX, train.doorHeight / 2, train.doorHalf, .18, train.doorHeight, train.doorWidth, .035);
    leftDoor.name = 'mobil-train-door-left'; rightDoor.name = 'mobil-train-door-right'; this.doors = [leftDoor, rightDoor];
    for (const door of this.doors) {
      this.box(door, dark, -.12, .82, 0, .06, 1.7, 1.32, .06);
      this.box(door, steel, -.12, -.72, 0, .055, .65, .07, .025);
    }
    for (const group of [this.fixed, this.train]) batchStaticGeometry(group, new Set(this.doors)).forEach(g => this.geometries.add(g));
    this.update();
  }
  update(encounter?: MobilEncounter, neo?: THREE.Object3D, rama?: THREE.Object3D): void {
    const pose = mobilTrainPose(encounter), train = MOBIL_STATION.train;
    this.train.visible = pose.visible; this.train.position.set(pose.x, pose.y, pose.z);
    this.doors.forEach((door, i) => { door.position.z = (i ? 1 : -1) * (train.doorHalf + train.doorSlide * pose.doors); });
    const state = encounter?.luggage, parent = state?.phase === 'retrieving' || state?.phase === 'returned';
    const carrier = parent ? rama : neo;
    const bag = mobilLuggagePose(state);
    this.luggage.position.set(bag.x, bag.y, bag.z); this.luggage.rotation.set(0, bag.yaw, 0);
    const held = state && (state.phase === 'carried' || state.phase === 'returned'
      || state.phase === 'lifting' && state.elapsed >= MOBIL_LUGGAGE.grasp
      || state.phase === 'retrieving' && state.elapsed >= (state.walk ?? MOBIL_LUGGAGE.walk) + MOBIL_LUGGAGE.grasp);
    if (held && carrier) {
      const wrist = carrier.getObjectByName(parent ? 'mobil-palm-R' : 'wrist_R');
      if (wrist) {
        wrist.updateWorldMatrix(true, false); this.group.updateWorldMatrix(true, false);
        const contact = wrist.localToWorld(new THREE.Vector3(0, parent ? -.14 : -.19, parent ? -.05 : .035));
        this.luggage.position.copy(this.group.worldToLocal(contact)).y -= MOBIL_LUGGAGE.grip;
        const heading = new THREE.Vector3(0, 0, 1).transformDirection(carrier.matrixWorld);
        this.luggage.rotation.y = mobilLuggagePose(state, { x: 0, z: 0, yaw: Math.atan2(heading.x, heading.z) }).yaw;
      }
    }
    this.luggage.visible = encounter?.phase !== 'gone';
  }
  private lettering(parent: THREE.Object3D, text: string, x: number, y: number, z: number, width: number, height: number, yaw = 0): void {
    const canvas = document.createElement('canvas'); canvas.width = 1024; canvas.height = 128;
    const context = canvas.getContext('2d')!; context.fillStyle = '#4e6256'; context.font = '52px Arial'; context.textAlign = 'center'; context.textBaseline = 'middle'; context.fillText(text, 512, 64);
    const map = new THREE.CanvasTexture(canvas); map.colorSpace = THREE.SRGBColorSpace; this.textures.add(map);
    const label = this.mesh(parent, this.own(new THREE.PlaneGeometry(width, height)), this.material(new THREE.MeshBasicMaterial({ map, transparent: true, depthWrite: false })), x, y, z);
    label.name = text === 'M O B I L  A V E' ? 'mobil-station-name' : 'mobil-train-destination';
    label.rotation.y = yaw; label.castShadow = false;
  }
  private material<T extends THREE.Material>(material: T): T { this.materials.add(material); return material; }
  private surface(color: number, roughness: number, metalness = 0): THREE.MeshStandardMaterial { return this.material(new THREE.MeshStandardMaterial({ color, roughness, metalness })); }
  private own<T extends THREE.BufferGeometry>(geometry: T): T { this.geometries.add(geometry); return geometry; }
  private mesh(parent: THREE.Object3D, geometry: THREE.BufferGeometry, material: THREE.Material, x: number, y: number, z: number): THREE.Mesh {
    const mesh = new THREE.Mesh(geometry, material); mesh.position.set(x, y, z); mesh.castShadow = true; mesh.receiveShadow = true; parent.add(mesh); return mesh;
  }
  private box(parent: THREE.Object3D, material: THREE.Material, x: number, y: number, z: number, w: number, h: number, d: number, radius = 0): THREE.Mesh {
    return this.mesh(parent, this.own(radius ? new RoundedBoxGeometry(w, h, d, 2, radius) : new THREE.BoxGeometry(w, h, d)), material, x, y, z);
  }
  dispose(): void {
    if (this.disposed) return; this.disposed = true;
    this.reflection.dispose(); this.group.traverse(object => { if (object instanceof THREE.Light) object.dispose(); }); this.group.removeFromParent();
    this.geometries.forEach(g => g.dispose()); this.materials.forEach(m => m.dispose()); this.textures.forEach(t => t.dispose());
  }
}
