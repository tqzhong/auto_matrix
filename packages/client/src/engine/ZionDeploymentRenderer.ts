import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { ZION_DEPLOYMENT, type ZionDeployment } from '@auto_matrix/shared';
import { batchStaticGeometry } from './StaticGeometry.js';

/** Council seating and a clear report area; the plan stand is a playable addition. */
export class ZionDeploymentRenderer {
  readonly root = new THREE.Group();
  private geometries = new Set<THREE.BufferGeometry>();
  private materials = new Set<THREE.Material>();
  private textures = new Set<THREE.Texture>();
  private disposed = false;
  private display?: THREE.CanvasTexture;
  private displayKey = '';
  constructor(parent: THREE.Group) {
    this.root.name = 'zion-defense-council'; parent.add(this.root);
    const stone = this.mat(0x777976, .96), pale = this.mat(0x8a8b80, .91), floor = this.mat(0x5b5e5b, .94);
    const bronze = this.mat(0x665b47, .8, .4), iron = this.mat(0x333b3e, .75, .65), cloth = this.mat(0x504435, .94);
    if (typeof document !== 'undefined') {
      for (const [slot, suffix] of [['map', 'color'], ['normalMap', 'normal'], ['roughnessMap', 'roughness']] as const) {
        const texture = new THREE.TextureLoader().load(`/assets/film-materials/white_plaster_02-${suffix}.jpg`, loaded => {
          if (this.disposed) loaded.dispose();
        });
        texture.wrapS = texture.wrapT = THREE.RepeatWrapping; texture.repeat.set(4, 2); texture.anisotropy = 4;
        if (slot === 'map') texture.colorSpace = THREE.SRGBColorSpace;
        stone[slot] = texture; this.textures.add(texture);
      }
      stone.normalScale.set(.15, .15);
    }
    this.box('council-ground', 26, .2, 32, 0, -.1, 0, floor);
    for (let x = -12; x <= 12; x += 2) for (let z = -15; z <= 15; z += 2)
      this.box('', 1.975, .035, 1.975, x, .018, z, (Math.round(x + z) % 6) ? floor : pale);
    for (const [i, wall] of ZION_DEPLOYMENT.walls.entries()) this.box(`council-wall-${i}`, wall.width, wall.height, wall.depth, wall.x, wall.height / 2, wall.z, stone);
    this.box('council-ceiling', 26, .3, 32, 0, 11.2, 0, stone);
    for (const side of [-1, 1]) for (const z of [-12, -5, 2, 9]) {
      this.box('', .6, 10.6, 1, side * 12.45, 5.3, z, pale);
      this.box('', .82, .3, 1.3, side * 12.3, .3, z, pale);
      this.box('', .8, .35, 1.3, side * 12.3, 10.3, z, pale);
      this.box('', .14, 4.1, .12, side * 12.05, 5.25, z, bronze);
    }
    // A segmented stone crown replaces the previous command-room screens.
    for (let i = 0; i < 25; i++) {
      const angle = i / 24 * Math.PI, x = Math.cos(angle) * 11.7, y = 4.7 + Math.sin(angle) * 6.1;
      const voussoir = this.box('', 1.05, .75, 1, x, y, -15.3, pale); voussoir.rotation.z = Math.atan2(6.1 * Math.cos(angle), -11.7 * Math.sin(angle));
    }
    for (const x of [-9, -3, 3, 9]) {
      this.box('', .12, 8.5, .12, x, 5.4, -15.72, bronze);
      this.box('', .27, .25, .2, x, 1.25, -15.61, bronze);
    }
    const ring = this.mesh(new THREE.TorusGeometry(7, .045, 6, 80), bronze);
    ring.rotation.x = Math.PI / 2; ring.position.set(0, .065, -4); ring.name = 'report-area-stone-inlay';
    for (const [role, point] of Object.entries(ZION_DEPLOYMENT.roots)) {
      const chair = new THREE.Group(); chair.name = `council-seat-${role}`; chair.position.set(point.x, 0, point.z); chair.rotation.y = point.yaw; this.root.add(chair);
      const seat = ZION_DEPLOYMENT.seat;
      this.box('seat-cushion', seat.width, .2, seat.depth, 0, seat.top - .1, 0, cloth, .08, chair);
      this.box('seat-back', seat.width, 2.3, .2, 0, seat.top + 1.1, -.97, cloth, .1, chair);
      for (const x of [-1.1, 1.1]) {
        this.box('', .16, 1.4, 1.8, x, .7, 0, bronze, .03, chair);
        this.box('seat-armrest', .22, .12, 1.8, x, 1.85, .08, bronze, .04, chair);
      }
      for (const x of [-1, 1]) for (const z of [-.8, .8]) this.box('', .17, 1.27, .17, x, .635, z, bronze, .02, chair);
    }
    for (const x of [-2.48, 2.48]) this.box('council-entry-jamb', .18, 6.2, .45, x, 3.1, 15.9, bronze);
    this.box('council-entry-lintel', 5.15, .3, .45, 0, 6.35, 15.9, bronze);
    for (const x of [-10.8, 10.8]) for (const z of [-11.5, 4.5]) {
      this.box('', .4, .5, .65, x, 6.4, z, iron, .07);
      const bulb = this.mat(0xd4c8a7, .5); bulb.emissive.setHex(0xd4c8a7); bulb.emissiveIntensity = 1.1;
      this.box('', .32, .15, .5, x, 6.2, z, bulb, .04);
      const light = new THREE.PointLight(0xc4c9c4, 75, 22, 2); light.position.set(x * .82, 5.8, z); this.root.add(light);
    }
    this.root.add(new THREE.HemisphereLight(0xa8b5c0, 0x4b443b, 1.05));
    const key = new THREE.PointLight(0xd7e0dd, 100, 21, 2); key.position.set(0, 8.5, -7); this.root.add(key);
    const map = ZION_DEPLOYMENT.map;
    this.box('portable-plan-stand', map.width, map.top, map.depth, map.x, map.top / 2, map.z, iron, .06);
    this.box('plan-display-backing', .16, 2.4, 3.75, 7.1, 3.45, 2, bronze, .06);
    const paper = this.mat(0xcbc7ad, .94);
    if (typeof document !== 'undefined') {
      const canvas = document.createElement('canvas'); canvas.width = 1024; canvas.height = 640;
      this.display = new THREE.CanvasTexture(canvas); this.display.colorSpace = THREE.SRGBColorSpace; this.textures.add(this.display);
      paper.map = this.display; paper.color.setHex(0xffffff);
    }
    const screen = ZION_DEPLOYMENT.screen;
    const board = this.mesh(new THREE.PlaneGeometry(screen.width, screen.height), paper);
    board.name = 'physical-zion-deployment-plan'; board.rotation.y = -Math.PI / 2; board.position.set(screen.x, screen.y, screen.z);
    for (let i = 0; i < 4; i++) this.box('', .025, .045, .08, 6.95, 4.53, .55 + i * .96, bronze);
    this.geometries = new Set([...this.geometries, ...batchStaticGeometry(this.root, new Set())]); this.update();
  }
  update(state?: ZionDeployment): void {
    const key = state?.confirmed.join(',') ?? ''; if (!this.display || this.displayKey === key && this.display.userData.drawn) return;
    this.displayKey = key; this.display.userData.drawn = true;
    const ctx = (this.display.image as HTMLCanvasElement).getContext('2d'); if (!ctx) return;
    ctx.fillStyle = '#c9c7b2'; ctx.fillRect(0, 0, 1024, 640);
    ctx.fillStyle = '#333e40'; ctx.font = 'bold 31px monospace'; ctx.fillText('ZION / DOCK DEFENCE', 45, 60);
    ctx.font = '24px monospace'; ctx.fillText('EST. BREACH < 12H / DESTROY DIGGERS', 45, 101);
    ctx.strokeStyle = '#56696d'; ctx.lineWidth = 5;
    ctx.strokeRect(70, 161, 410, 208); ctx.strokeRect(685, 210, 255, 122);
    ctx.beginPath(); ctx.moveTo(480, 264); ctx.lineTo(685, 264); ctx.stroke();
    ctx.font = 'bold 28px monospace'; ctx.fillText('DOCK', 220, 209); ctx.fillText('TEMPLE', 756, 257);
    ctx.font = '21px monospace'; ctx.fillText('ALL APU', 145, 271); ctx.fillText('HALF INFANTRY', 145, 307); ctx.fillText('FALLBACK', 746, 302);
    for (const [i, allocation] of ZION_DEPLOYMENT.allocations.entries()) {
      const confirmed = state?.confirmed.includes(allocation.id);
      ctx.fillStyle = confirmed ? '#285543' : '#5c5c4e'; ctx.font = '24px monospace';
      ctx.fillText(`${confirmed ? '[OK]' : '[  ]'} ${['DOCK / DIGGERS', 'TEMPLE / RESERVE', 'CIVILIANS / VOLUNTEERS'][i]}`, 65, 439 + i * 52);
    }
    this.display.needsUpdate = true;
  }
  private mat(color: number, roughness: number, metalness = 0) { const material = new THREE.MeshStandardMaterial({ color, roughness, metalness }); this.materials.add(material); return material; }
  private mesh(geometry: THREE.BufferGeometry, material: THREE.Material, parent: THREE.Object3D = this.root) {
    this.geometries.add(geometry); const mesh = new THREE.Mesh(geometry, material); mesh.castShadow = mesh.receiveShadow = true; parent.add(mesh); return mesh;
  }
  private box(name: string, w: number, h: number, d: number, x: number, y: number, z: number, material: THREE.Material, radius = 0, parent: THREE.Object3D = this.root) {
    const mesh = this.mesh(radius ? new RoundedBoxGeometry(w, h, d, 2, radius) : new THREE.BoxGeometry(w, h, d), material, parent);
    mesh.name = name; mesh.position.set(x, y, z); return mesh;
  }
  dispose(): void {
    this.disposed = true; this.root.removeFromParent(); this.geometries.forEach(item => item.dispose());
    this.materials.forEach(item => item.dispose()); this.textures.forEach(item => item.dispose());
  }
}
