import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { SIGNAL_OBSTACLES, signalSentinelPose, HAMMER_MEDICAL, HAMMER_MEDICAL_BEDS, HAMMER_MEDICAL_SUPPLIES, FILM_SETS, filmObstacles, type FilmJourney } from '@auto_matrix/shared';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';

/** Scene props for the lost ship's tunnel pursuit and Hammer's adjacent medical beds. */
export class ReloadedFinaleRenderer {
  private group = new THREE.Group();
  private geometries = new Set<THREE.BufferGeometry>();
  private materials = new Set<THREE.Material>();
  private lights = new Set<THREE.Light>();
  private sentinels: THREE.Group[] = [];
  private cores: THREE.MeshBasicMaterial[] = [];
  private sentinelLights: THREE.PointLight[] = [];
  private wreck?: THREE.PointLight;
  private rescue?: THREE.SpotLight;
  private rescueRig?: THREE.Group;
  private textures = new Set<THREE.Texture>();

  constructor(root: THREE.Group, private scene: 'm2_stop_sentinels' | 'm2_medical') {
    this.group.name = `reloaded-finale-${scene}`; root.add(this.group);
    if (scene === 'm2_stop_sentinels') this.tunnel(); else this.medical();
  }
  private material<T extends THREE.Material>(material: T): T { this.materials.add(material); return material; }
  private mesh(parent: THREE.Object3D, geometry: THREE.BufferGeometry, material: THREE.Material, name: string): THREE.Mesh {
    const mesh = new THREE.Mesh(geometry, material); mesh.name = name; mesh.castShadow = mesh.receiveShadow = true;
    parent.add(mesh); this.geometries.add(geometry); return mesh;
  }
  private box(parent: THREE.Object3D, material: THREE.Material, x: number, y: number, z: number, w: number, h: number, d: number, name: string): THREE.Mesh {
    const mesh = this.mesh(parent, new THREE.BoxGeometry(w, h, d), material, name); mesh.position.set(x, y, z); return mesh;
  }
  private tube(parent: THREE.Object3D, points: THREE.Vector3[], radius: number, material: THREE.Material, name: string): void {
    this.mesh(parent, new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points), 16, radius, 6), material, name);
  }
  private tunnel(): void {
    const iron = this.material(new THREE.MeshStandardMaterial({ color: 0x283338, roughness: .55, metalness: .72 }));
    const edge = this.material(new THREE.MeshStandardMaterial({ color: 0x59676a, roughness: .48, metalness: .76 }));
    const masonry = this.material(new THREE.MeshStandardMaterial({ color: 0x566166, roughness: .86 }));
    const wet = this.material(new THREE.MeshStandardMaterial({ color: 0x313c42, roughness: .26, metalness: .25 }));
    const pale = this.material(new THREE.MeshBasicMaterial({ color: 0xc3d6df }));
    this.box(this.group, wet, 0, -.3, 0, 28, .6, 146, 'signal-wet-floor');
    this.box(this.group, masonry, 0, 12.2, 0, 28.8, .4, 146, 'signal-ceiling');
    for (const [index, obstacle] of SIGNAL_OBSTACLES.entries()) {
      if (index < 4 && index % 2 === 0) this.box(this.group, masonry, obstacle.x, obstacle.height / 2, obstacle.z,
        obstacle.width, obstacle.height, obstacle.depth, `signal-wall-${index}`);
      else if (index < 4) {
        const pipe = this.mesh(this.group, new THREE.CylinderGeometry(1.2, 1.2, obstacle.depth, 20), iron, `signal-pipe-${index}`);
        pipe.rotation.x = Math.PI / 2; pipe.position.set(obstacle.x, 2.8, 0);
        for (let z = -68; z <= 68; z += 8) {
          const clamp = this.mesh(this.group, new THREE.TorusGeometry(1.25, .08, 8, 20), edge, 'signal-pipe-collar'); clamp.position.set(obstacle.x, 2.8, z);
        }
      }
    }
    // Masonry relief is instanced; the continuous backing and pipes share server footprints.
    const brickGeometry = new THREE.BoxGeometry(.1, .43, 2.34), rows = 25, columns = 61;
    this.geometries.add(brickGeometry);
    const bricks = new THREE.InstancedMesh(brickGeometry, masonry, rows * columns * 2); bricks.name = 'signal-brick-relief'; bricks.receiveShadow = true;
    const matrix = new THREE.Matrix4(), color = new THREE.Color(); let brick = 0;
    for (const side of [-1, 1]) for (let row = 0; row < rows; row++) for (let column = 0; column < columns; column++) {
      matrix.makeTranslation(side * 13.98, .25 + row * .47, -71.8 + column * 2.35 + row % 2 * .2); bricks.setMatrixAt(brick, matrix);
      bricks.setColorAt(brick++, color.setScalar(.62 + ((row * 31 + column * 17) % 11) * .023));
    }
    this.group.add(bricks);
    for (let z = -62; z <= 48; z += 22) {
      this.box(this.group, edge, 0, 11.6, z, 28, .18, .28, 'signal-overhead-girder');
      for (const x of [-9, 9]) {
        this.box(this.group, iron, x, 10.8, z, 2.4, .3, .6, 'signal-caged-fixture');
        this.box(this.group, pale, x, 10.62, z, 1.8, .05, .32, 'signal-cold-lens');
      }
      const lamp = new THREE.PointLight(0x98bacb, 380, 35, 2); lamp.position.set(0, 9.4, z); this.group.add(lamp); this.lights.add(lamp);
    }
    const wreck = SIGNAL_OBSTACLES[4];
    this.box(this.group, iron, 0, 1.2, wreck.z, 24, 2.4, 20, 'neb-burning-hull');
    for (let i = 0; i < 16; i++) {
      const shard = this.box(this.group, edge, -10 + i % 8 * 2.8, 2.1 + i % 3 * .12, 51 + Math.floor(i / 8) * 9,
        2.2, .3, 3.5, 'neb-grounded-debris'); shard.rotation.set(.1 + i % 3 * .12, i * .7, .13);
      this.box(this.group, this.material(new THREE.MeshStandardMaterial({ color: 0x5b3221, emissive: 0xdb4d13, emissiveIntensity: .9, roughness: .9 })),
        -9 + i % 7 * 2.7, 2.5, 53 + i % 4 * 3, .22, .12, .35, 'neb-small-embers');
    }
    this.wreck = new THREE.PointLight(0xe97436, 130, 45, 2); this.wreck.name = 'signal-wreck-light'; this.wreck.position.set(0, 4, 50); this.group.add(this.wreck); this.lights.add(this.wreck);
    const combine = (parts: THREE.BufferGeometry[]) => {
      const result = mergeGeometries(parts)!; parts.forEach(part => part.dispose()); return result;
    };
    const shell = combine([new THREE.SphereGeometry(1, 24, 16).scale(1.32, .7, 1.7),
      new THREE.CylinderGeometry(.55, .7, 1.35, 16).rotateX(Math.PI / 2).translate(0, -.05, .95)]);
    const ribs: THREE.BufferGeometry[] = [];
    for (let i = 0; i < 7; i++) ribs.push(new THREE.TorusGeometry(1.02, .045, 6, 24).scale(1.25, .7, 1).translate(0, 0, -.9 + i * .32));
    const armor = combine(ribs);
    const eyes: THREE.BufferGeometry[] = [];
    for (let i = 0; i < 11; i++) {
      const x = (i % 4 - 1.5) * .39, y = .33 - Math.floor(i / 4) * .3;
      eyes.push(new THREE.SphereGeometry(i < 4 ? .14 : .12, 12, 8).scale(1, 1, .65).translate(x, y, -1.45));
    }
    const optics = combine(eyes);
    const tentacles: THREE.BufferGeometry[] = [];
    for (let arm = 0; arm < 8; arm++) {
      const angle = arm * Math.PI / 4, sin = Math.sin(angle), cos = Math.cos(angle);
      const curve = new THREE.CatmullRomCurve3([new THREE.Vector3(sin * .8, cos * .35, .8), new THREE.Vector3(sin * 1.3, cos * .5, 2.5),
        new THREE.Vector3(sin * 2, cos * .8, 4.5), new THREE.Vector3(sin * 2.7, cos * .9 - .2, 6.8)]);
      const parts: THREE.BufferGeometry[] = [new THREE.TubeGeometry(curve, 32, .07, 8)];
      for (let joint = 0; joint < 17; joint++) {
        const t = joint / 17, point = curve.getPoint(t), tangent = curve.getTangent(t);
        const ring = new THREE.TorusGeometry(.11, .025, 5, 10); ring.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), tangent)); ring.translate(point.x, point.y, point.z); parts.push(ring);
      }
      const tip = curve.getPoint(1);
      for (const side of [-1, 1]) parts.push(new THREE.ConeGeometry(.075, .45, 6).rotateX(Math.PI / 2).rotateZ(side * .25).translate(tip.x + side * .08, tip.y, tip.z + .15));
      tentacles.push(combine(parts));
    }
    for (let index = 0; index < 3; index++) {
      const unit = new THREE.Group(); unit.name = `real-sentinel-${index + 1}`; this.group.add(unit); this.sentinels.push(unit);
      this.mesh(unit, shell, iron, 'sentinel-head'); this.mesh(unit, armor, edge, 'sentinel-armor-ribs');
      const core = this.material(new THREE.MeshBasicMaterial({ color: 0xf06554, toneMapped: false })); this.cores.push(core);
      this.mesh(unit, optics, core, 'sentinel-eye');
      for (const [arm, geometry] of tentacles.entries()) this.mesh(unit, geometry, edge, `sentinel-tentacle-${arm}`);
      const lamp = new THREE.PointLight(0xf16b5d, 28, 8, 2); lamp.name = 'sentinel-optical-light'; lamp.position.set(0, 0, -1.6); unit.add(lamp); this.lights.add(lamp); this.sentinelLights.push(lamp);
    }
    this.rescueRig = new THREE.Group(); this.rescueRig.name = 'hammer-rescue-arrival'; this.rescueRig.visible = false; this.group.add(this.rescueRig);
    this.box(this.rescueRig, iron, 0, 5.8, -66, 24, 11, 11, 'hammer-rescue-nose');
    for (const x of [-7, 7]) this.box(this.rescueRig, pale, x, 5.5, -60.35, 4.8, 1.8, .12, 'hammer-searchlight-lens');
    this.rescue = new THREE.SpotLight(0xd8eff5, 0, 105, Math.PI / 7, .55, 1.5); this.rescue.name = 'hammer-rescue-beam'; this.rescue.position.set(0, 7, -60); this.rescue.target.position.set(0, 1, -25);
    this.rescueRig.add(this.rescue, this.rescue.target); this.lights.add(this.rescue);
  }
  private medical(): void {
    const dark = this.material(new THREE.MeshStandardMaterial({ color: 0x252e35, metalness: .62, roughness: .48 }));
    const rail = this.material(new THREE.MeshStandardMaterial({ color: 0x77858a, metalness: .82, roughness: .35 }));
    const rubber = this.material(new THREE.MeshStandardMaterial({ color: 0x111c22, roughness: .86 }));
    const sheet = this.material(new THREE.MeshStandardMaterial({ color: 0x6e7979, roughness: .97 }));
    const hull = this.material(new THREE.MeshStandardMaterial({ color: 0x37454d, metalness: .58, roughness: .76 }));
    if (typeof document !== 'undefined') {
      const load = (kind: string, color = false) => {
        const texture = new THREE.TextureLoader().load(`/assets/film-materials/metal_plate-${kind}.jpg`);
        texture.wrapS = texture.wrapT = THREE.RepeatWrapping; texture.repeat.set(8, 16);
        if (color) texture.colorSpace = THREE.SRGBColorSpace;
        this.textures.add(texture); return texture;
      };
      hull.map = load('color', true); hull.normalMap = load('normal'); hull.roughnessMap = load('roughness'); hull.normalScale.set(.22, .22);
    }
    this.box(this.group, hull, 0, -.18, 0, 48, .36, 104, 'hammer-medical-floor');
    for (const side of [-1, 1]) {
      this.box(this.group, hull, side * 23.6, 5.5, 0, .4, 11, 104, 'hammer-medical-side-wall');
      for (let y = 1; y <= 8; y += 1.5) this.tube(this.group, [new THREE.Vector3(side * 23.15, y, -51), new THREE.Vector3(side * 23.15, y, 51)], .11, rail, 'hammer-medical-hull-pipe');
    }
    for (const z of [-51.6, 51.6]) this.box(this.group, hull, 0, 5.5, z, 48, 11, .4, 'hammer-medical-end-wall');
    this.box(this.group, dark, 0, 11.15, 0, 48, .3, 104, 'hammer-medical-ceiling');
    for (const column of filmObstacles(FILM_SETS.film_hammer_deck)) this.box(this.group, dark, column.x, 5.5, column.z, column.width, 11, column.depth, 'hammer-medical-column');
    const lens = this.material(new THREE.MeshBasicMaterial({ color: 0xc9dae2, toneMapped: false }));
    for (let z = -40; z <= 40; z += 16) {
      this.box(this.group, rail, 0, 10.7, z, 46, .15, .22, 'hammer-medical-overhead-rail');
      this.box(this.group, dark, 0, 10.35, z, 8, .25, .5, 'hammer-medical-ceiling-fixture');
      this.box(this.group, lens, 0, 10.19, z, 7.2, .04, .34, 'hammer-medical-ceiling-lens');
      const light = new THREE.PointLight(0xb8ccd6, 145, 24, 2); light.position.set(0, 8, z); this.group.add(light); this.lights.add(light);
    }
    const pixels = new Uint8Array(256 * 128 * 4);
    for (let y = 0; y < 128; y++) for (let x = 0; x < 256; x++) {
      const cell = Math.floor(x / 128), dx = (x % 128 - 64) / 45, dy = (y - 66) / 52, radius = dx * dx + dy * dy;
      const tissue = radius < 1 && radius > .04 ? .2 + .4 * Math.abs(Math.sin(dx * 18 + Math.sin(dy * 14 + cell) * 2) * Math.cos(dy * 21)) : .04;
      const grid = x % 16 === 0 || y % 16 === 0 ? .05 : 0, strength = tissue + grid, offset = (y * 256 + x) * 4;
      pixels.set([strength * 90, strength * 190, strength * 255, 255], offset);
    }
    const scan = new THREE.DataTexture(pixels, 256, 128); scan.colorSpace = THREE.SRGBColorSpace; scan.needsUpdate = true; this.textures.add(scan);
    const screen = this.material(new THREE.MeshBasicMaterial({ color: 0xb3ddeb, map: scan, toneMapped: false }));
    for (const { role, x, z, yaw } of HAMMER_MEDICAL_BEDS) {
      const bed = new THREE.Group(); bed.name = `hammer-medical-${role}`; bed.position.set(x, 0, z); bed.rotation.y = yaw; this.group.add(bed);
      this.box(bed, rail, 0, 1.52, 0, HAMMER_MEDICAL.width, .45, HAMMER_MEDICAL.length, 'medical-gurney-frame');
      const mattress = this.mesh(bed, new RoundedBoxGeometry(2.8, .15, 5.45, 3, .06), sheet, 'medical-mattress'); mattress.position.y = HAMMER_MEDICAL.mattressTop - .075;
      const pillow = this.mesh(bed, new RoundedBoxGeometry(1.2, .04, .75, 3, .018), sheet, 'medical-pillow'); pillow.position.set(0, HAMMER_MEDICAL.mattressTop + .02, -1.65);
      for (const side of [-1, 1]) {
        for (const end of [-1, 1]) {
          this.box(bed, rail, side * 1.05, .65, end * 1.7, .12, 1.4, .12, 'medical-gurney-leg');
          const wheel = this.mesh(bed, new THREE.CylinderGeometry(.2, .2, .15, 16), rubber, 'medical-gurney-wheel'); wheel.rotation.z = Math.PI / 2; wheel.position.set(side * 1.05, .25, end * 1.7);
        }
        this.box(bed, rail, side * 1.5, HAMMER_MEDICAL.mattressTop - .08, 0, .08, .07, 5.3, 'medical-bed-rail');
        this.box(bed, rubber, side * 1.607, 1.5, 0, .018, .31, 4.95, 'medical-side-panel');
        this.box(bed, rail, side * 1.67, 1.25, -.3, .33, .08, 1.25, 'medical-instrument-tray');
      }
      this.box(bed, rubber, 0, .7, 0, 1.65, .22, 3.4, 'medical-gurney-hydraulics');
      for (const offset of [-1.7, 1.7]) {
        this.box(bed, dark, offset, 3.75, -3.8, 2.35, 1.65, .8, 'medical-telemetry-case');
        this.box(bed, screen, offset, 3.75, -3.35, 2.05, 1.35, .035, 'medical-telemetry-screen');
        this.box(bed, rail, offset, 2.48, -3.8, .13, 1.65, .13, 'medical-monitor-stand');
        for (let key = 0; key < 5; key++) this.box(bed, rubber, offset - .65 + key * .32, 2.97, -3.34, .1, .06, .025, 'medical-monitor-key');
        this.tube(bed, [new THREE.Vector3(offset, 3, -3.8), new THREE.Vector3(offset * .7, 1.2, -3.1), new THREE.Vector3(offset * .35, 1.8, -2.3)], .016, rubber, 'medical-monitor-cable');
      }
      const lamp = new THREE.SpotLight(0xe0e8e5, 260, 20, Math.PI / 4, .8, 1.5); lamp.position.set(0, 8, -1); lamp.target.position.set(0, 1.9, -1);
      bed.add(lamp, lamp.target); this.lights.add(lamp);
      this.box(bed, rail, 0, 8.35, -.5, 5.7, .13, .4, 'medical-task-lamp-housing');
      this.box(bed, lens, 0, 8.26, -.5, 5.3, .025, .24, 'medical-task-lamp-lens');
    }
    for (const cabinet of HAMMER_MEDICAL_SUPPLIES) {
      this.box(this.group, rail, cabinet.x, cabinet.height / 2, cabinet.z, cabinet.width, cabinet.height, cabinet.depth, 'medical-supply-cabinet');
      for (let row = 0; row < 4; row++) this.box(this.group, rubber, cabinet.x, .7 + row * .8, cabinet.z + cabinet.depth / 2 + .02, 5.65, .026, .025, 'medical-cabinet-drawer-seam');
    }
  }
  update(journey: FilmJourney | undefined, _elapsed: number): void {
    if (this.scene === 'm2_stop_sentinels') {
      const tunnel = journey?.scene === this.scene && !journey.visiting ? journey.tunnel : undefined;
      if (!tunnel) return;
      const clock = tunnel.age ?? Math.max(0, 14 - tunnel.remaining);
      this.sentinels.forEach((unit, index) => {
        const pose = signalSentinelPose(tunnel, index);
        unit.position.set(pose.x, pose.y, pose.z); unit.rotation.set(0, 0, pose.roll);
        for (let arm = 0; arm < 8; arm++) {
          const tentacle = unit.getObjectByName(`sentinel-tentacle-${arm}`)!;
          tentacle.scale.y = pose.disabled ? THREE.MathUtils.lerp(1, .12, THREE.MathUtils.smoothstep(pose.falling, .25, 1.15)) : 1;
          tentacle.rotation.z = pose.disabled ? 0 : Math.sin(clock * 2 + arm) * .035;
        }
        unit.updateWorldMatrix(true, true);
        const bounds = new THREE.Box3().setFromObject(unit), floor = this.group.getWorldPosition(new THREE.Vector3()).y;
        if (bounds.min.y < floor + .07) unit.position.y += floor + .07 - bounds.min.y;
        this.cores[index].color.setHex(pose.disabled ? 0x283b3b : 0xf06554); this.sentinelLights[index].intensity = pose.disabled ? 0 : 28;
      });
      if (this.wreck) this.wreck.intensity = 110 + Math.sin(clock * 5) * 20;
      if (this.rescueRig) this.rescueRig.visible = tunnel.phase === 'collapsed';
      if (this.rescue) this.rescue.intensity = tunnel.phase === 'collapsed' ? 450 : 0;
    }
  }
  dispose(): void {
    this.group.removeFromParent(); this.group.clear();
    this.geometries.forEach(geometry => geometry.dispose()); this.materials.forEach(material => material.dispose()); this.lights.forEach(light => light.dispose());
    this.textures.forEach(texture => texture.dispose());
  }
}
