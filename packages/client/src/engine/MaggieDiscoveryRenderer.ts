import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { MAGGIE_DISCOVERY, HAMMER_MEDICAL, maggieDiscoveryDoor, type MaggieDiscovery } from '@auto_matrix/shared';

/** A compact Hammer infirmary. Maggie is the real world actor, never a prop body. */
export class MaggieDiscoveryRenderer {
  private group = new THREE.Group();
  private geometries = new Set<THREE.BufferGeometry>();
  private materials = new Set<THREE.Material>();
  private textures = new Set<THREE.Texture>();
  private lights = new Set<THREE.Light>();
  private sheet: THREE.Mesh;
  private medicalScreens: THREE.MeshBasicMaterial[] = [];
  private intercom: THREE.MeshBasicMaterial;
  private doors: THREE.Mesh[] = [];
  constructor(root: THREE.Group) {
    this.group.name = 'hammer-discovery-infirmary'; root.add(this.group);
    const hull = this.material(new THREE.MeshStandardMaterial({ color: 0x3c474c, roughness: .74, metalness: .5 }));
    const steel = this.material(new THREE.MeshStandardMaterial({ color: 0x76818a, roughness: .45, metalness: .78 }));
    const dark = this.material(new THREE.MeshStandardMaterial({ color: 0x1b2429, roughness: .86 }));
    const linen = this.material(new THREE.MeshStandardMaterial({ color: 0x8b9392, roughness: .99, side: THREE.DoubleSide }));
    const lens = this.material(new THREE.MeshBasicMaterial({ color: 0xc0d0d6, toneMapped: false }));
    if (typeof document !== 'undefined') {
      for (const [kind, channel] of [['color', 'map'], ['normal', 'normalMap'], ['roughness', 'roughnessMap']] as const) {
        const texture = new THREE.TextureLoader().load(`/assets/film-materials/metal_plate-${kind}.jpg`);
        texture.wrapS = texture.wrapT = THREE.RepeatWrapping; texture.repeat.set(3, 5);
        if (kind === 'color') texture.colorSpace = THREE.SRGBColorSpace;
        hull[channel] = texture; this.textures.add(texture);
      }
      hull.normalScale.set(.18, .18);
    }
    this.box(hull, 0, -.16, -7, 27.4, .32, 56, 'discovery-floor');
    for (const wall of MAGGIE_DISCOVERY.walls) this.box(hull, wall.x, wall.height / 2, wall.z, wall.width, wall.height, wall.depth, 'discovery-wall');
    const door = MAGGIE_DISCOVERY.door;
    for (const side of [-1, 1]) this.doors.push(this.box(hull, side * door.width / 4, door.height / 2, door.z,
      door.width / 2, door.height, door.depth, 'discovery-medical-door'));
    this.box(dark, 0, 8.08, -12, 27, .2, 42, 'discovery-ceiling');
    for (const z of [-31, -24, -17, -10, -3, 4]) {
      const points = Array.from({ length: 33 }, (_, i) => {
        const theta = i / 32 * Math.PI; return new THREE.Vector3(Math.cos(theta) * 13.1, 1.1 + Math.sin(theta) * 6.6, z);
      });
      this.tube(points, .13, steel, 'infirmary-hull-rib');
      for (const side of [-1, 1]) {
        this.box(dark, side * 11.9, 3.2, z, 2.3, 3.4, .16, 'infirmary-equipment-panel');
        for (let cable = 0; cable < 4; cable++) this.tube([new THREE.Vector3(side * (12.8 - cable * .13), 1.1, z + 2.9),
          new THREE.Vector3(side * (12.9 - cable * .13), 3.5, z), new THREE.Vector3(side * (12.6 - cable * .13), 6, z - 3)], .028, dark, 'infirmary-cable');
      }
      this.box(steel, 0, 7.5, z, 5.1, .16, .55, 'infirmary-light-housing');
      this.box(lens, 0, 7.4, z, 4.6, .04, .35, 'infirmary-light-lens');
    }
    for (const z of [-25, -12, 3]) {
      const light = new THREE.PointLight(0xb8cddc, 155, 24, 2); light.position.set(0, 6.5, z); this.group.add(light); this.lights.add(light);
    }
    for (const [index, bed] of [MAGGIE_DISCOVERY.corpse, MAGGIE_DISCOVERY.berth].entries()) {
      const root = new THREE.Group(); root.name = index ? 'bane-empty-medical-berth' : 'maggie-medical-bed'; root.position.set(bed.x, 0, bed.z); root.rotation.y = bed.yaw; this.group.add(root);
      this.box(steel, 0, 1.52, 0, HAMMER_MEDICAL.width, .45, HAMMER_MEDICAL.length, 'discovery-gurney-frame', root);
      const mattress = this.mesh(new RoundedBoxGeometry(2.8, .15, 5.45, 3, .06), linen, root); mattress.position.y = HAMMER_MEDICAL.mattressTop - .075; mattress.name = 'discovery-mattress';
      const pillow = this.mesh(new RoundedBoxGeometry(1.25, .05, .77, 3, .018), linen, root); pillow.position.set(0, HAMMER_MEDICAL.mattressTop + .025, -1.72); pillow.name = 'discovery-pillow';
      for (const side of [-1, 1]) {
        for (const end of [-1, 1]) {
          this.box(steel, side * 1.05, .65, end * 1.7, .12, 1.4, .12, 'gurney-leg', root);
          const wheel = this.mesh(new THREE.CylinderGeometry(.2, .2, .15, 16), dark, root); wheel.rotation.z = Math.PI / 2; wheel.position.set(side * 1.05, .25, end * 1.7);
        }
        this.box(steel, side * 1.5, 1.75, 0, .08, .07, 5.3, 'gurney-rail', root);
        this.box(dark, side * 1.607, 1.5, 0, .018, .31, 4.95, 'gurney-panel', root);
      }
      this.box(dark, 0, .7, 0, 1.65, .22, 3.4, 'gurney-hydraulics', root);
      const monitor = this.material(new THREE.MeshBasicMaterial({ color: 0x7ca4b8, map: this.monitorTexture(), toneMapped: false })); this.medicalScreens.push(monitor);
      this.box(dark, 0, 3.65, MAGGIE_DISCOVERY.monitor.z, MAGGIE_DISCOVERY.monitor.width, 1.6, MAGGIE_DISCOVERY.monitor.depth, 'discovery-monitor-case', root);
      this.box(monitor, 0, 3.65, -4.03, 1.94, 1.33, .025, 'discovery-monitor-screen', root);
      this.box(steel, 0, 2.3, -4.4, .12, 1.5, .12, 'discovery-monitor-stand', root);
      this.tube([new THREE.Vector3(0, 3, -4.4), new THREE.Vector3(1.2, 1.1, -3.7), new THREE.Vector3(1.2, 1.3, -1)], .022, dark, 'disconnected-monitor-lead', root);
      const lamp = new THREE.PointLight(0xbdcfda, 75, 12, 2); lamp.position.set(0, 5.7, -1); root.add(lamp); this.lights.add(lamp);
    }
    this.box(dark, -3.55, 2.6, 10, .3, 1.3, .8, 'discovery-intercom-case');
    this.intercom = this.material(new THREE.MeshBasicMaterial({ color: 0xc59147, toneMapped: false }));
    this.box(this.intercom, -3.36, 2.9, 10, .03, .1, .18, 'discovery-intercom-signal');
    const geometry = new THREE.PlaneGeometry(3.6, 5.5, 48, 64); geometry.rotateX(-Math.PI / 2);
    this.sheet = this.mesh(geometry, linen); this.sheet.name = 'maggie-body-sheet'; this.sheet.position.set(MAGGIE_DISCOVERY.corpse.x, 0, MAGGIE_DISCOVERY.corpse.z);
    this.update();
  }
  private material<T extends THREE.Material>(material: T): T { this.materials.add(material); return material; }
  private mesh(geometry: THREE.BufferGeometry, material: THREE.Material, parent = this.group) {
    this.geometries.add(geometry); const mesh = new THREE.Mesh(geometry, material); mesh.castShadow = mesh.receiveShadow = true; parent.add(mesh); return mesh;
  }
  private box(material: THREE.Material, x: number, y: number, z: number, w: number, h: number, d: number, name: string, parent = this.group) {
    const mesh = this.mesh(new THREE.BoxGeometry(w, h, d), material, parent); mesh.position.set(x, y, z); mesh.name = name; return mesh;
  }
  private tube(points: THREE.Vector3[], radius: number, material: THREE.Material, name: string, parent = this.group) {
    const mesh = this.mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points), 24, radius, 6), material, parent); mesh.name = name; return mesh;
  }
  private monitorTexture() {
    const pixels = new Uint8Array(256 * 128 * 4);
    for (let y = 0; y < 128; y++) for (let x = 0; x < 256; x++) {
      const line = y === 64 && x > 20 && x < 236, grid = x % 24 === 0 || y % 20 === 0;
      pixels.set(line ? [108, 145, 155, 255] : grid ? [20, 32, 42, 255] : [8, 15, 22, 255], (y * 256 + x) * 4);
    }
    const texture = new THREE.DataTexture(pixels, 256, 128); texture.needsUpdate = true; texture.colorSpace = THREE.SRGBColorSpace; this.textures.add(texture); return texture;
  }
  update(state?: MaggieDiscovery): void {
    const door = MAGGIE_DISCOVERY.door, opening = maggieDiscoveryDoor(state);
    this.doors.forEach((panel, i) => { panel.position.x = (i ? 1 : -1) * (door.width / 4 + opening * door.width / 2); });
    this.sheet.visible = Boolean(state?.incident);
    const f = THREE.MathUtils.smoothstep(state?.cover ?? 0, 0, MAGGIE_DISCOVERY.coverSeconds), front = THREE.MathUtils.lerp(-.25, -2.75, f);
    const positions = this.sheet.geometry.attributes.position;
    for (let i = 0; i < positions.count; i++) {
      const column = i % 49, row = Math.floor(i / 49), x = (column / 48 - .5) * 3.6, z = front + row / 64 * (2.75 - front);
      const center = Math.max(0, 1 - (x / 1.35) ** 2), head = Math.exp(-(((z + 1.65) / .72) ** 2));
      const body = Math.max(.84 * Math.exp(-(((z + .65) / 1.2) ** 2)), .80 * Math.exp(-(((z - .55) / 1.4) ** 2)), .86 * Math.exp(-(((z - 2.2) / .65) ** 2)));
      const y = HAMMER_MEDICAL.mattressTop + .06 + center * Math.max(body, .75 * head) - Math.max(0, Math.abs(x) - 1.35) * 1.22 - Math.max(0, z - 2.45) * 1.2
        + .012 * Math.sin(x * 21 + z * 8) + .008 * Math.sin(x * 33 - z * 17);
      positions.setXYZ(i, x, y, z);
    }
    positions.needsUpdate = true; this.sheet.geometry.computeVertexNormals(); this.sheet.geometry.computeBoundingSphere();
    this.intercom.color.setHex(state?.phase === 'call' ? 0xd69f4a : 0x40505a);
    this.medicalScreens[0].color.setHex(state?.incident ? 0x53636b : 0x879cab); this.medicalScreens[1].color.setHex(0x586873);
  }
  dispose(): void {
    this.group.removeFromParent(); this.group.clear(); this.lights.forEach(light => light.dispose());
    this.geometries.forEach(item => item.dispose()); this.materials.forEach(item => item.dispose()); this.textures.forEach(item => item.dispose());
  }
}
