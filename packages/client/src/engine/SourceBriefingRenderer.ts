import * as THREE from 'three';
import { SOURCE_BRIEFING, type SourceBriefing } from '@auto_matrix/shared';
import { createLoungeChair } from './LoungeChair.js';
import { batchStaticGeometry } from './StaticGeometry.js';

/** Abandoned apartment: worn plaster, dark timber and the Keymaker's red wingback. */
export class SourceBriefingRenderer {
  readonly group = new THREE.Group();
  private static = new THREE.Group();
  private papers = new Map<string, THREE.MeshStandardMaterial>();
  private geometries = new Set<THREE.BufferGeometry>();
  private materials = new Set<THREE.Material>();
  private textures = new Set<THREE.Texture>();
  private disposed = false;
  constructor(root: THREE.Group) {
    // The shared actor root is one unit above the visible floor.
    this.group.position.y = -1;
    this.group.name = 'source-briefing-apartment'; root.add(this.group); this.group.add(this.static);
    const plaster = this.surface('damaged_plaster', 0xa8a58e), wood = this.surface('old_wood_floor', 0x82715c);
    const dark = this.material(0x272922, .8), frame = this.material(0x484437, .78), iron = this.material(0x555b53, .62, .55);
    this.box(wood, 0, .8, 0, 32, .4, 32, 'briefing-floor');
    for (const [i, wall] of SOURCE_BRIEFING.walls.entries()) {
      // Tall window bays occupy the back wall; the frame and sill retain the shared footprint.
      if (i === 2) {
        this.box(plaster, 0, 1.65, wall.z, 32, 1.3, .6);
        this.box(plaster, 0, 7.15, wall.z, 32, 2.7, .6);
        for (const x of [-14.4, -8, 0, 8, 14.4]) this.box(plaster, x, 4.05, wall.z, x === 0 ? 2.6 : 3.2, 3.5, .6);
      } else this.box(plaster, wall.x, 1 + wall.height / 2, wall.z, wall.width, wall.height, wall.depth, `briefing-wall-${i}`);
    }
    this.box(plaster, 0, 8.65, 0, 32, .3, 32);
    for (const side of [-1, 1]) this.box(wood, side * 15.31, 1.28, 0, .13, .48, 31.2);
    for (const z of [-15.31, 15.31]) this.box(wood, 0, 1.28, z, 31.2, .48, .13);
    for (const x of [-11.2, -4.1, 4.1, 11.2]) {
      const glass = new THREE.MeshStandardMaterial({ color: 0x687d76, roughness: .28, metalness: .1, transparent: true, opacity: .48, depthWrite: false }); this.materials.add(glass);
      this.box(glass, x, 4.08, -15.73, 3.3, 3.6, .035, 'briefing-window');
      for (const dx of [-1.72, 0, 1.72]) this.box(frame, x + dx, 4.08, -15.33, .13, 3.85, .14);
      for (const y of [2.18, 4.16, 6.02]) this.box(frame, x, y, -15.33, 3.55, .12, .2);
      this.box(wood, x, 2.13, -15.2, 3.8, .18, .65);
      for (let i = 0; i < 12; i++) this.box(iron, x - 1.2 + i * .22, 1.67, -14.95, .11, .8, .28);
      const street = new THREE.PointLight(0xc0cfc1, 12, 18, 2); street.position.set(x, 4.4, -17.5); this.group.add(street);
    }
    // An unlit neighboring facade is visible through the glass, not a television or ship console.
    this.box(dark, 0, 7, -24, 36, 14, .5);
    const distant = new THREE.MeshStandardMaterial({ color: 0xb3ab81, emissive: 0xc2b883, emissiveIntensity: .4, roughness: .8 }); this.materials.add(distant);
    for (let x = -15; x <= 15; x += 3) for (const y of [3, 7, 11]) this.box((Math.round(x) + y) % 3 ? frame : distant, x, y, -23.7, 1.15, 2.1, .04);
    const table = SOURCE_BRIEFING.table;
    this.box(wood, table.x, 1 + table.height - .15, table.z, table.width, .3, table.depth, 'briefing-plan-table');
    for (const x of [-2.8, 2.8]) for (const z of [-3.05, -.95]) this.box(frame, x, 1.75, z, .2, 1.5, .2);
    for (const route of SOURCE_BRIEFING.routes) {
      const paper = new THREE.MeshStandardMaterial({ color: 0xd8d3b6, roughness: .95, map: this.diagram(route.id) });
      paper.name = `briefing-paper-${route.id}`; this.materials.add(paper); this.papers.set(route.id, paper);
      const plan = this.box(paper, route.paperX, 3.52, -2, 1.8, .018, 2.1, `briefing-plan-${route.id}`);
      plan.rotation.y = route.id === 'primary' ? .05 : route.id === 'source' ? -.07 : 0;
    }
    const leather = this.surface('leather_red_03', 0xb69279);
    const chair = createLoungeChair(leather); chair.name = 'briefing-keymaker-chair';
    // The lounge chair's wooden feet start .12 above its origin, before scaling.
    chair.position.set(0, 1 - .12 * chair.scale.y, SOURCE_BRIEFING.roots.keymaker.z - .3);
    chair.traverse(object => { if (object instanceof THREE.Mesh) { this.geometries.add(object.geometry); this.materials.add(object.material); } }); this.static.add(chair);
    this.box(dark, -10, 2.5, -8.3, 1.1, 3, 1.1);
    const shade = this.material(0xbab293, .88);
    const lamp = new THREE.Mesh(new THREE.CylinderGeometry(.75, 1.05, 1.2, 24, 1, true), shade); this.geometries.add(lamp.geometry); lamp.position.set(-10, 4.5, -8.3); this.static.add(lamp);
    const warm = new THREE.PointLight(0xffdab0, 160, 20, 2); warm.position.set(-10, 4, -8.3); this.group.add(warm);
    const fill = new THREE.PointLight(0xe0e4cd, 160, 24, 2); fill.position.set(0, 6.6, 1); this.group.add(fill);
    for (const x of [-12, 12]) {
      this.box(frame, x, 6.95, 0, .2, .22, 31.2);
      for (const z of [-11, 0, 11]) this.box(frame, x, 7.1, z, .4, .6, .4);
    }
    batchStaticGeometry(this.static, new Set()).forEach(geometry => this.geometries.add(geometry));
  }
  private material(color: number, roughness: number, metalness = .02): THREE.MeshStandardMaterial {
    const material = new THREE.MeshStandardMaterial({ color, roughness, metalness }); this.materials.add(material); return material;
  }
  private surface(name: string, color: number): THREE.MeshStandardMaterial {
    const material = this.material(color, .88);
    if (typeof document === 'undefined') return material;
    for (const [suffix, slot] of [['color', 'map'], ['normal', 'normalMap'], ['roughness', 'roughnessMap']] as const) {
      const texture = new THREE.TextureLoader().load(`/assets/film-materials/${name}-${suffix}.jpg`, value => { if (this.disposed) value.dispose(); });
      texture.wrapS = texture.wrapT = THREE.RepeatWrapping; texture.anisotropy = 4;
      if (slot === 'map') texture.colorSpace = THREE.SRGBColorSpace;
      material[slot] = texture; this.textures.add(texture);
    }
    material.normalScale.set(.4, .4); return material;
  }
  private diagram(id: string): THREE.Texture | null {
    if (typeof document === 'undefined') return null;
    const canvas = document.createElement('canvas'); canvas.width = 512; canvas.height = 640;
    const ctx = canvas.getContext('2d'); if (!ctx) return null;
    ctx.fillStyle = '#dad6bf'; ctx.fillRect(0, 0, 512, 640); ctx.strokeStyle = '#bbb9a6'; ctx.lineWidth = 1;
    for (let x = 24; x < 512; x += 24) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, 640); ctx.stroke(); }
    for (let y = 24; y < 640; y += 24) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(512, y); ctx.stroke(); }
    ctx.fillStyle = '#2b342d'; ctx.font = 'bold 28px monospace';
    const titles = { primary: 'LOGOS / PRIMARY', emergency: 'VIGILANT / BACKUP', source: 'SOURCE / 314 SEC' };
    ctx.fillText(titles[id as keyof typeof titles], 24, 48);
    ctx.strokeStyle = '#35483a'; ctx.lineWidth = 5;
    for (const [x, y, w, h] of [[62, 125, 170, 150], [282, 125, 170, 150], [168, 380, 176, 136]]) ctx.strokeRect(x, y, w, h);
    ctx.beginPath(); ctx.moveTo(145, 280); ctx.lineTo(145, 334); ctx.lineTo(256, 334); ctx.lineTo(365, 334); ctx.lineTo(365, 280); ctx.moveTo(256, 334); ctx.lineTo(256, 380); ctx.stroke();
    ctx.font = '18px monospace'; ctx.fillText(id === 'source' ? 'WHITE DOOR' : 'SWITCHING NETWORK', 110, 568);
    const texture = new THREE.CanvasTexture(canvas); texture.colorSpace = THREE.SRGBColorSpace; this.textures.add(texture); return texture;
  }
  private box(material: THREE.Material, x: number, y: number, z: number, w: number, h: number, d: number, name?: string): THREE.Mesh {
    const geometry = new THREE.BoxGeometry(w, h, d), uv = geometry.getAttribute('uv');
    // PBR repeats follow meters on each face instead of stretching a wall-sized photograph.
    if (material instanceof THREE.MeshStandardMaterial && material.normalMap) for (let i = 0; i < uv.count; i++) {
      const face = Math.floor(i / 4), sx = face < 2 ? d : w, sy = face < 2 ? h : face < 4 ? d : h;
      uv.setXY(i, uv.getX(i) * sx / 4, uv.getY(i) * sy / 4);
    }
    this.geometries.add(geometry); const mesh = new THREE.Mesh(geometry, material); mesh.position.set(x, y, z); if (name) mesh.name = name;
    mesh.castShadow = mesh.receiveShadow = true; this.static.add(mesh); return mesh;
  }
  update(state?: SourceBriefing): void {
    for (const [id, material] of this.papers) material.color.setHex(state?.reviewed.includes(id as 'primary' | 'emergency' | 'source') ? 0xaac2a1 : state?.selected === id ? 0xffe5ad : 0xd8d3b6);
  }
  dispose(): void {
    this.disposed = true; this.group.removeFromParent();
    this.group.traverse(object => { if (object instanceof THREE.PointLight) object.dispose(); });
    this.geometries.forEach(geometry => geometry.dispose()); this.materials.forEach(material => material.dispose()); this.textures.forEach(texture => texture.dispose());
  }
}
