import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { OFFICE_MANAGER_WALLS, OFFICE_WORKDAY, officeClipboardPoint, type FilmJourney } from '@auto_matrix/shared';

/** The manager's room and the physical delivery share the server's floor plan. */
export class OfficeWorkdayRenderer {
  private root = new THREE.Group();
  private materials = new Set<THREE.Material>();
  private textures = new Set<THREE.Texture>();
  private clipboard = new THREE.Group();
  private signature = new THREE.Line();
  constructor(parent: THREE.Group) {
    parent.add(this.root);
    const metal = this.mat(0x68716c, .28, .72); const dark = this.mat(0x272f2d, .7);
    const beige = this.mat(0xbdbeb0, .64); const paper = this.mat(0xe2dfcd, .93);
    const wood = this.mat(0x776550, .57);
    const grain = new THREE.TextureLoader().load('/assets/film-materials/old_wood_floor-color.jpg');
    grain.colorSpace = THREE.SRGBColorSpace; grain.wrapS = grain.wrapT = THREE.RepeatWrapping; grain.repeat.set(.3, .3); grain.anisotropy = 8; wood.map = grain; this.textures.add(grain);
    const glass = new THREE.MeshStandardMaterial({ color: 0x9eb3ad, transparent: true, opacity: .12, depthWrite: false, roughness: .18, metalness: .3 }); this.materials.add(glass);
    for (const wall of OFFICE_MANAGER_WALLS) {
      this.box(this.root, glass, wall.x, 4.55, wall.z, wall.width, 8.5, wall.depth);
      for (const y of [.18, 8.9]) this.box(this.root, metal, wall.x, y, wall.z, wall.width + .1, .16, wall.depth + .1);
      const alongX = wall.width > wall.depth; const length = alongX ? wall.width : wall.depth;
      for (let n = -length / 2; n <= length / 2 + .01; n += length / Math.ceil(length / 3.6)) {
        this.box(this.root, metal, wall.x + (alongX ? n : 0), 4.5, wall.z + (alongX ? 0 : n), .1, 8.8, .1);
      }
      // Partially raised interior blinds keep the supervisor and his desk visible.
      for (let y = 6.9; y < 8.8; y += .15) this.box(this.root, beige, wall.x, y, wall.z, alongX ? wall.width : .22, .035, alongX ? .22 : wall.depth);
    }
    const door = new THREE.Group(); door.name = 'manager-open-door'; door.position.set(-13.25, 0, 22.15); door.rotation.y = Math.PI / 2; this.root.add(door);
    this.box(door, glass, 1.98, 3.55, 0, 3.96, 7.1, .08);
    for (const x of [0, 3.96]) this.box(door, metal, x, 3.55, 0, .11, 7.1, .13);
    for (const y of [.1, 7.1]) this.box(door, metal, 1.98, y, 0, 4.07, .12, .13);
    this.box(door, metal, 3.55, 3.25, .17, .07, .7, .07);
    this.label('RHINEHEART', 'DEPARTMENT MANAGER', 2.5, .64, this.root, -17.5, 4.9, 22.02, 0);
    const desk = OFFICE_WORKDAY.desk;
    this.box(this.root, wood, desk.x, desk.height - .1, desk.z, desk.width, .2, desk.depth, .06).name = 'manager-desk';
    this.box(this.root, wood, desk.x + .9, 1.25, desk.z, .12, 2.25, desk.depth - .45);
    for (const z of [24.7, 30.1]) {
      this.box(this.root, wood, desk.x - .12, 1.15, z, 2.35, 2.3, 1.35, .035);
      for (const y of [.45, 1.15, 1.85]) this.box(this.root, metal, desk.x - 1.31, y, z, .035, .06, .44);
    }
    const workstation = new THREE.Group(); workstation.position.set(-21.25, 2.51, 27.4); workstation.rotation.y = -Math.PI / 2; this.root.add(workstation);
    this.box(workstation, beige, -1.65, .1, -.5, 1.08, .18, .64, .04);
    this.box(workstation, beige, -1.65, .78, -.58, 1.48, 1.17, 1.3, .1);
    this.box(workstation, dark, -1.65, .8, .1, 1.24, .94, .05, .06);
    this.label('METACORTEX', 'PERSONNEL / 034', 1.08, .74, workstation, -1.65, .8, .131, 0, '#8eafa0', '#19332d');
    this.box(workstation, beige, 0, .06, 1.05, 1.65, .1, .59, .025);
    for (let row = 0; row < 4; row++) for (let col = 0; col < 13; col++) this.box(workstation, paper, -.7 + col * .115, .126, .86 + row * .116, .09, .025, .084, .008);
    this.box(this.root, dark, -21.7, 2.53, 29.6, 1.2, .025, 1.25);
    for (let i = 0; i < 5; i++) this.box(this.root, paper, -21.7 + i * .016, 2.56 + i * .014, 29.6 - i * .013, .8, .012, 1.05);
    this.box(this.root, metal, -21.15, 2.59, 29.8, .03, .025, .38);
    const chair = new THREE.Group(); chair.position.set(OFFICE_WORKDAY.manager.x, 0, OFFICE_WORKDAY.manager.z); chair.rotation.y = Math.PI / 2; this.root.add(chair);
    this.box(chair, dark, 0, 1.44, 0, 1.37, .22, 1.35, .09);
    this.box(chair, dark, 0, 2.43, -.63, 1.35, 1.85, .2, .1);
    this.box(chair, metal, 0, .69, 0, .14, 1.3, .14);
    for (let n = 0; n < 5; n++) {
      const leg = this.box(chair, metal, Math.sin(n * Math.PI * .4) * .36, .12, Math.cos(n * Math.PI * .4) * .36, .1, .08, .85, .025); leg.rotation.y = n * Math.PI * .4;
    }
    for (const x of [-.77, .77]) { this.box(chair, metal, x, 1.7, 0, .08, .75, .1); this.box(chair, dark, x, 2.05, 0, .14, .1, 1.1, .045); }
    this.box(this.root, wood, -25.3, 1.5, 31, 2.6, 3, 2.8, .04);
    for (const z of [30.4, 31.6]) for (const y of [.6, 1.6, 2.6]) this.box(this.root, metal, -23.97, y, z, .06, .07, .5);
    const task = new THREE.PointLight(0xf4eacb, 18, 10, 2); task.position.set(-21, 5, 27.4); this.root.add(task);
    this.batch();
    this.root.add(this.clipboard); this.clipboard.name = 'delivery-clipboard';
    this.box(this.clipboard, wood, 0, 0, 0, .85, .045, 1.05, .035);
    this.box(this.clipboard, paper, 0, .029, 0, .76, .012, .96);
    this.box(this.clipboard, metal, 0, .046, -.45, .28, .035, .1, .012);
    for (const z of [-.25, -.17, -.09, .23]) this.box(this.clipboard, dark, 0, .039, z, z === .23 ? .58 : .4, .002, .009);
    const points = Array.from({ length: 48 }, (_, i) => { const t = i / 47; return new THREE.Vector3(-.17 + t * .34, .042, Math.sin(t * 38) * .055); });
    const ink = new THREE.LineBasicMaterial({ color: 0x172c40 }); this.materials.add(ink);
    this.signature = new THREE.Line(new THREE.BufferGeometry().setFromPoints(points), ink); this.clipboard.add(this.signature);
  }
  private mat(color: number, roughness: number, metalness = 0) {
    const material = new THREE.MeshStandardMaterial({ color, roughness, metalness }); this.materials.add(material); return material;
  }
  private box(parent: THREE.Object3D, material: THREE.Material, x: number, y: number, z: number, w: number, h: number, d: number, radius = 0) {
    const mesh = new THREE.Mesh(radius ? new RoundedBoxGeometry(w, h, d, 2, radius) : new THREE.BoxGeometry(w, h, d), material);
    mesh.position.set(x, y, z); mesh.castShadow = mesh.receiveShadow = !material.transparent; parent.add(mesh); return mesh;
  }
  private label(title: string, subtitle: string, width: number, height: number, parent: THREE.Object3D, x: number, y: number, z: number, yaw: number, color = '#d5d8c6', background = '#4d5953') {
    const canvas = document.createElement('canvas'); canvas.width = 512; canvas.height = 192; const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = background; ctx.fillRect(0, 0, 512, 192); ctx.fillStyle = color; ctx.textAlign = 'center';
    ctx.font = '28px monospace'; ctx.fillText(title, 256, 77); ctx.font = '16px monospace'; ctx.fillText(subtitle, 256, 128);
    const map = new THREE.CanvasTexture(canvas); map.colorSpace = THREE.SRGBColorSpace; this.textures.add(map);
    const material = new THREE.MeshStandardMaterial({ map, roughness: .64, side: THREE.DoubleSide }); this.materials.add(material);
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(width, height), material); mesh.position.set(x, y, z); mesh.rotation.y = yaw; parent.add(mesh);
  }
  update(journey?: FilmJourney): void {
    const workday = journey?.scene === 'm1_boss' && !journey.visiting ? journey.workday : undefined;
    this.clipboard.visible = Boolean(workday && ['delivery', 'signature', 'signing', 'delivered'].includes(workday.phase));
    if (!workday) return;
    const point = officeClipboardPoint(workday); this.clipboard.position.set(point.x, point.y, point.z);
    const progress = workday.phase === 'delivered' ? 1 : workday.phase === 'signing' ? Math.max(0, Math.min(1, (workday.elapsed - 1) / 1.55)) : 0;
    this.signature.geometry.setDrawRange(0, Math.floor(progress * 48));
  }
  private batch(): void {
    this.root.updateWorldMatrix(true, true); const inverse = this.root.matrixWorld.clone().invert();
    const batches = new Map<THREE.Material, THREE.BufferGeometry[]>(); const meshes: THREE.Mesh[] = [];
    this.root.traverse(object => { if (object instanceof THREE.Mesh && !Array.isArray(object.material) && !object.material.transparent) meshes.push(object); });
    for (const mesh of meshes) {
      const source = mesh.geometry.clone().applyMatrix4(inverse.clone().multiply(mesh.matrixWorld)); const geometry = source.index ? source.toNonIndexed() : source;
      if (geometry !== source) source.dispose();
      const material = mesh.material as THREE.Material; const list = batches.get(material) ?? []; list.push(geometry); batches.set(material, list);
      mesh.geometry.dispose(); mesh.removeFromParent();
    }
    for (const [material, geometries] of batches) {
      const geometry = mergeGeometries(geometries); geometries.forEach(part => part.dispose());
      if (!geometry) throw new Error('Manager office geometry could not be merged');
      const mesh = new THREE.Mesh(geometry, material); mesh.castShadow = mesh.receiveShadow = true; this.root.add(mesh);
    }
  }
  dispose(): void {
    this.root.traverse(object => { if (object instanceof THREE.Mesh || object instanceof THREE.Line) object.geometry.dispose(); if (object instanceof THREE.PointLight) object.dispose(); });
    this.materials.forEach(material => material.dispose()); this.textures.forEach(texture => texture.dispose()); this.root.removeFromParent();
  }
}
