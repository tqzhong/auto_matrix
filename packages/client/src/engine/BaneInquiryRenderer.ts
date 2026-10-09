import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { BANE_INQUIRY, type BaneInquiry } from '@auto_matrix/shared';

/** Hammer's mess table, rather than the medical berth used in the earlier prototype. */
export class BaneInquiryRenderer {
  readonly root = new THREE.Group();
  readonly report = new THREE.Group();
  private pages: THREE.Mesh[] = [];
  private geometries = new Set<THREE.BufferGeometry>();
  private materials = new Set<THREE.Material>();
  private textures = new Set<THREE.Texture>();
  constructor(parent: THREE.Group) {
    this.root.name = 'hammer-mess-interview'; parent.add(this.root);
    const hull = this.mat(0x48535a, .83, .55), frame = this.mat(0x29333a, .65, .7), steel = this.mat(0x7c898d, .4, .8);
    const dark = this.mat(0x222729, .95), seat = this.mat(0x5b6569, .86), floor = this.mat(0x3c454a, .9, .55);
    if (typeof document !== 'undefined') {
      const loader = new THREE.TextureLoader();
      for (const [slot, file] of [['map', 'color'], ['normalMap', 'normal'], ['roughnessMap', 'roughness']] as const) {
        const texture = loader.load(`/assets/film-materials/metal_plate-${file}.jpg`);
        texture.wrapS = texture.wrapT = THREE.RepeatWrapping; texture.repeat.set(4, 3);
        if (slot === 'map') { texture.colorSpace = THREE.SRGBColorSpace; hull.color.setHex(0x737b80); }
        hull[slot] = texture; this.textures.add(texture);
      }
      hull.normalScale.set(.22, .22);
    }
    this.box('mess-floor', 19.2, .22, 25, 0, -.11, -17, floor);
    this.box('mess-ceiling', 19.2, .3, 25, 0, 7.15, -17, frame);
    for (const [name, x, z, w, d] of [ ['left', -9.6, -17, .35, 25], ['right', 9.6, -17, .35, 25],
      ['back', 0, -29.5, 19.2, .35], ['front-left', -2.5, -4.5, 14.2, .35], ['front-right', 8.3, -4.5, 2.6, .35] ] as const)
      this.box(`mess-wall-${name}`, w, 7, d, x, 3.5, z, hull);
    for (const x of [-9.33, 9.33]) for (let z = -28; z < -5; z += 3.6) {
      this.box('hull-rib', .2, 6.9, .16, x, 3.45, z, frame);
      for (const y of [.3, 3.35, 6.55]) {
        const bolt = this.mesh(new THREE.CylinderGeometry(.052, .052, .04, 8), steel);
        bolt.rotation.z = Math.PI / 2; bolt.position.set(x + (x < 0 ? .12 : -.12), y, z);
      }
    }
    const pipe = new THREE.CylinderGeometry(.13, .13, 24, 12);
    for (const x of [-8.65, 8.65]) { const item = this.mesh(pipe, steel); item.rotation.x = Math.PI / 2; item.position.set(x, 6.3, -17); }
    for (const z of [-9, -16, -23, -28]) {
      this.box('ceiling-crossbeam', 19, .24, .32, 0, 6.92, z, frame);
      this.box('fluorescent-housing', 3.6, .2, .45, 0, 6.76, z, steel);
      const diffuser = this.mat(0xb5cbcf, .55); diffuser.emissive.setHex(0x7c9baf); diffuser.emissiveIntensity = .85;
      this.box('fluorescent-diffuser', 3.35, .035, .3, 0, 6.64, z, diffuser);
      const light = new THREE.PointLight(0xb4d0df, z === -16 ? 48 : 26, 14, 2); light.position.set(0, 6.2, z); this.root.add(light);
    }
    const bounce = new THREE.HemisphereLight(0x91aab8, 0x373028, .78); this.root.add(bounce);
    const table = BANE_INQUIRY.table;
    this.box('interview-tabletop', table.width, table.thickness, table.depth, table.x, table.top - table.thickness / 2, table.z, steel, .08);
    for (const x of [-1.12, 1.12]) for (const z of [-17.1, -25.5]) {
      this.box('table-leg', .18, table.top - .14, .18, x, (table.top - .14) / 2, z, frame);
      this.box('table-foot', .48, .075, .4, x, .0375, z, frame, .035);
    }
    this.box('table-crossbrace', 2.24, .13, .13, 0, .64, -21.3, frame);
    for (const [role, root] of Object.entries(BANE_INQUIRY.roots)) {
      const chair = new THREE.Group(); chair.name = `interview-chair-${role}`; chair.position.set(root.x, 0, root.z); chair.rotation.y = root.yaw; this.root.add(chair);
      const pad = this.mesh(new RoundedBoxGeometry(BANE_INQUIRY.seat.width, .18, BANE_INQUIRY.seat.depth, 2, .07), seat, chair);
      pad.name = 'seat-contact'; pad.position.y = BANE_INQUIRY.seat.top - .09;
      const legHeight = BANE_INQUIRY.seat.top - .18;
      for (const x of [-.53, .53]) for (const z of [-.54, .54]) {
        const leg = this.mesh(new THREE.CylinderGeometry(.055, .055, legHeight, 10), steel, chair); leg.position.set(x, legHeight / 2, z);
      }
      const back = this.mesh(new RoundedBoxGeometry(1.36, 1.42, .17, 2, .06), seat, chair); back.position.set(0, BANE_INQUIRY.seat.top + .74, -.67);
      const rail = this.mesh(new THREE.BoxGeometry(1.35, .09, .12), steel, chair); rail.position.set(0, legHeight * .4, -.54);
    }
    // A compact galley behind the interview: exposed supplies and utensils, no diagnostic wall screen.
    this.box('galley-counter', 11.4, .15, 1.35, -1.3, 2.3, -28.35, steel);
    for (const x of [-6.8, -3.9, -1, 1.9, 4.8]) {
      this.box('galley-cabinet', 2.7, 2.12, 1.2, x, 1.1, -28.45, hull, .05);
      this.box('cabinet-handle', .65, .05, .055, x, 1.93, -27.82, steel);
    }
    for (const y of [3.45, 4.7]) {
      this.box('galley-shelf', 11.4, .1, .92, -1.3, y, -28.65, steel);
      for (let i = 0; i < 9; i++) {
        const cup = this.mesh(new THREE.LatheGeometry([[0, 0], [.15, 0], [.17, .05], [.18, .29], [.16, .31], [.145, .07], [0, .07]].map(([r, h]) => new THREE.Vector2(r, h)), 16), steel);
        cup.position.set(-5.9 + i * 1.13, y + .05, -28.48);
      }
    }
    for (const z of [-15, -25.7]) {
      this.box('supply-rack', 1.3, 4.6, 3, -8.65, 2.3, z, frame);
      for (const y of [.6, 2, 3.4]) for (let i = 0; i < 3; i++) {
        const can = this.mesh(new THREE.CylinderGeometry(.24, .24, .65, 16), this.mat(i % 2 ? 0x635e50 : 0x7d837b, .85, .25));
        can.position.set(-8.4, y, z - 1 + i); this.box('can-band', .49, .035, .02, -8.145, y + .12, z - 1 + i, dark);
      }
    }
    const mug = this.mesh(new THREE.LatheGeometry([[0, 0], [.16, 0], [.18, .05], [.185, .34], [.16, .34], [.145, .065], [0, .065]].map(([r, y]) => new THREE.Vector2(r, y)), 24), steel);
    mug.position.set(-.9, table.top, -24.35);
    const handle = this.mesh(new THREE.TorusGeometry(.13, .03, 8, 20), steel); handle.position.set(-1.13, table.top + .2, -24.35);
    this.report.name = 'maggie-examination-report'; this.report.position.set(.84, table.top + .018, -20.5); this.report.rotation.y = -Math.PI / 2; this.root.add(this.report);
    const board = this.mesh(new RoundedBoxGeometry(1.18, .03, 1.58, 2, .03), dark, this.report); board.position.y = -.015;
    for (const page of ['vdt', 'neural'] as const) {
      const paper = this.mat(0xd1d1bd, .93), texture = this.reportTexture(page);
      if (texture) { paper.map = texture; paper.color.setHex(0xffffff); }
      const sheet = this.mesh(new THREE.PlaneGeometry(1.1, 1.48), paper, this.report); sheet.rotation.x = -Math.PI / 2; sheet.position.y = .015;
      sheet.name = `report-page-${page}`; this.pages.push(sheet);
    }
    const clip = this.mesh(new THREE.BoxGeometry(.35, .035, .1), steel, this.report); clip.position.set(0, .025, -.7);
    this.update(undefined);
  }
  private reportTexture(page: 'vdt' | 'neural'): THREE.CanvasTexture | undefined {
    if (typeof document === 'undefined') return;
    const canvas = document.createElement('canvas'); canvas.width = 512; canvas.height = 704; const ctx = canvas.getContext('2d'); if (!ctx) return;
    ctx.fillStyle = '#d1d1bd'; ctx.fillRect(0, 0, 512, 704); ctx.fillStyle = '#26353d'; ctx.font = 'bold 30px monospace'; ctx.fillText('HAMMER / MEDICAL', 30, 54);
    ctx.font = '20px monospace'; ctx.fillText('SUBJECT: BANE', 30, 105); ctx.fillText(page === 'vdt' ? 'VDT SCREEN / 01' : 'NEURAL SCAN / 02', 30, 144);
    ctx.fillStyle = '#335047'; ctx.font = 'bold 42px monospace'; ctx.fillText(page === 'vdt' ? 'NEGATIVE' : 'ABNORMAL', 30, 220);
    ctx.strokeStyle = '#789087'; ctx.lineWidth = 1;
    for (let x = 30; x <= 482; x += 24) { ctx.beginPath(); ctx.moveTo(x, 275); ctx.lineTo(x, 472); ctx.stroke(); }
    for (let y = 275; y <= 472; y += 24) { ctx.beginPath(); ctx.moveTo(30, y); ctx.lineTo(482, y); ctx.stroke(); }
    ctx.strokeStyle = '#254438'; ctx.lineWidth = 2; ctx.beginPath();
    for (let x = 30; x < 482; x++) { const y = 374 + Math.sin(x * .13) * (page === 'vdt' ? 9 : 33) + (page === 'neural' && x % 67 < 7 ? -48 : 0); if (x === 30) ctx.moveTo(x, y); else ctx.lineTo(x, y); } ctx.stroke();
    ctx.fillStyle = '#26353d'; ctx.font = '19px monospace';
    (page === 'vdt' ? ['VDT: NOT DETECTED', 'NEURAL REVIEW REQUIRED'] : ['CROSS-SYNAPTIC ACTIVITY', 'RECENT TRAUMA', 'FIBROUS CORTEX SCARRING']).forEach((line, i) => ctx.fillText(line, 30, 532 + i * 36));
    const texture = new THREE.CanvasTexture(canvas); texture.colorSpace = THREE.SRGBColorSpace; this.textures.add(texture); return texture;
  }
  private mat(color: number, roughness: number, metalness = 0) { const material = new THREE.MeshStandardMaterial({ color, roughness, metalness }); this.materials.add(material); return material; }
  private mesh(geometry: THREE.BufferGeometry, material: THREE.Material, parent: THREE.Object3D = this.root) {
    this.geometries.add(geometry); const mesh = new THREE.Mesh(geometry, material); mesh.castShadow = mesh.receiveShadow = true; parent.add(mesh); return mesh;
  }
  private box(name: string, w: number, h: number, d: number, x: number, y: number, z: number, material: THREE.Material, radius = 0) {
    const mesh = this.mesh(radius ? new RoundedBoxGeometry(w, h, d, 2, radius) : new THREE.BoxGeometry(w, h, d), material); mesh.name = name; mesh.position.set(x, y, z); return mesh;
  }
  update(state?: BaneInquiry): void {
    this.pages.forEach((page, i) => { page.visible = (state?.page === 'neural' ? 1 : 0) === i; });
  }
  dispose(): void { this.root.removeFromParent(); this.geometries.forEach(item => item.dispose()); this.materials.forEach(item => item.dispose()); this.textures.forEach(item => item.dispose()); }
}
