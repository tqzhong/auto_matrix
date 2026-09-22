import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { INTERROGATION_ROOM, interrogationPose, type FilmJourney } from '@auto_matrix/shared';

/** A compact, closed interview room. Collision dimensions come from the same table/chair layout. */
export class InterrogationSetRenderer {
  private root = new THREE.Group();
  private geometries = new Set<THREE.BufferGeometry>();
  private materials = new Set<THREE.Material>();
  private textures = new Set<THREE.Texture>();
  private folder = new THREE.Group();
  private chair = new THREE.Group();
  constructor(parent: THREE.Group) {
    parent.add(this.root);
    const { width: w, depth: d, height: h, table } = INTERROGATION_ROOM;
    const wall = this.mat(0x8d9984, .84); const floor = this.mat(0xb2b3a0, .7); const trim = this.mat(0x53604c, .6);
    const metal = this.mat(0x86948b, .24, .82); const dark = this.mat(0x29332b, .54); const paint = this.mat(0x727e6b, .48);
    const grain = new Uint8Array(128 * 128 * 4);
    for (let y = 0; y < 128; y++) for (let x = 0; x < 128; x++) {
      const i = (y * 128 + x) * 4; const value = 185 + ((x * 17 + y * 3) % 47);
      grain[i] = grain[i + 1] = grain[i + 2] = value; grain[i + 3] = 255;
    }
    const map = new THREE.DataTexture(grain, 128, 128); map.wrapS = map.wrapT = THREE.RepeatWrapping; map.repeat.set(6, 1); map.needsUpdate = true; this.textures.add(map);
    metal.roughnessMap = map; wall.bumpMap = map; wall.bumpScale = .015;
    this.box(floor, 0, -.16, 0, w, .3, d);
    for (let x = -w / 2 + 1; x < w / 2; x += 2) for (let z = -d / 2 + 1; z < d / 2; z += 2) this.box(floor, x, .005, z, 1.986, .04, 1.986);
    for (const x of [-w / 2, w / 2]) {
      this.box(trim, x, h / 2, 0, .3, h, d);
      for (let z = -d / 2 + 1.375; z < d / 2; z += 2.75) for (let y = 1.05; y < h; y += 2.1) this.box(wall, x - Math.sign(x) * .17, y, z, .12, 2.087, 2.737);
      this.box(trim, x - Math.sign(x) * .25, .16, 0, .09, .32, d);
    }
    for (const z of [-d / 2, d / 2]) {
      this.box(trim, 0, h / 2, z, w, h, .3);
      for (let x = -w / 2 + 1; x < w / 2; x += 2) for (let y = 1.05; y < h; y += 2.1) this.box(wall, x, y, z - Math.sign(z) * .17, 1.987, 2.087, .12);
      this.box(trim, 0, .16, z - Math.sign(z) * .25, w, .32, .09);
    }
    this.box(wall, 0, h + .15, 0, w, .3, d);
    const lightPanel = new THREE.MeshBasicMaterial({ color: 0xe2e9d1, toneMapped: false }); this.materials.add(lightPanel);
    for (const z of [-4.2, 4.2]) {
      this.box(trim, 0, h - .06, z, 3.6, .17, 1.2);
      for (const x of [-.25, .25]) this.box(lightPanel, x, h - .18, z, .12, .1, .92);
      for (let x = -1.65; x < 1.7; x += .33) this.box(metal, x, h - .19, z, .024, .14, 1.05);
      const light = new THREE.SpotLight(0xe4edd7, 220, 26, 1.03, .75, 2);
      light.position.set(0, h - .4, z); light.target.position.set(0, .2, z * .35); light.castShadow = true;
      light.shadow.mapSize.set(1024, 1024); light.shadow.normalBias = .025; light.shadow.bias = -.00015; this.root.add(light, light.target);
    }
    const bounce = new THREE.PointLight(0xd6dfc5, 25, 20, 2); bounce.position.set(3.7, 4.3, 2); this.root.add(bounce);
    this.box(dark, -5.7, 3, -d / 2 + .3, 3.8, 6, .2);
    this.box(paint, -5.7, 2.9, -d / 2 + .43, 3.43, 5.78, .09);
    this.box(metal, -4.45, 2.8, -d / 2 + .52, .08, .2, .16);
    this.box(metal, -4.65, 2.8, -d / 2 + .63, .5, .07, .08, .03);
    this.box(dark, 1.4, 4.4, -d / 2 + .3, 7.9, 3.7, .24);
    this.box(this.mat(0x29362e, .1, .75), 1.4, 4.4, -d / 2 + .45, 7.5, 3.3, .035);
    for (let x = -6.8; x <= -3.1; x += .2) this.box(paint, x, 7.3, -d / 2 + .4, .1, .55, .1);
    const top = this.box(metal, table.x, table.height - .08, table.z, table.width, .16, table.depth, .07); top.name = 'interrogation-table';
    for (const x of [-2.85, 2.85]) for (const side of [-1, 1]) this.box(metal, x, 1.09, side * (table.depth / 2 - .25), .16, 2.18, .16, .04);
    for (const side of [-1, 1]) this.box(metal, 0, .5, side * (table.depth / 2 - .25), 5.8, .13, .11, .04);
    this.makeChair(-INTERROGATION_ROOM.seat, Math.PI / 2, metal, dark);
    this.chair = this.makeChair(INTERROGATION_ROOM.seat, -Math.PI / 2, metal, dark); this.chair.userData.dynamic = true;
    const paper = this.mat(0xd1d0b7, .96); const file = this.mat(0x46583b, .9);
    this.box(file, -2.2, table.height + .027, .1, .8, .034, 1.15);
    this.box(paper, -2.2, table.height + .073, .1, .75, .058, 1.09);
    const canvas = document.createElement('canvas'); canvas.width = 512; canvas.height = 640;
    const ctx = canvas.getContext('2d')!; ctx.fillStyle = '#d1d0b7'; ctx.fillRect(0, 0, 512, 640); ctx.fillStyle = '#394131';
    ctx.font = 'bold 24px monospace'; ctx.fillText('THOMAS A. ANDERSON', 32, 64); ctx.font = '16px monospace'; ctx.fillText('METACORTEX / PERSONNEL', 32, 100); ctx.fillText('ALIAS: NEO', 32, 154);
    for (let row = 0; row < 17; row++) ctx.fillRect(32, 205 + row * 21, row % 5 === 3 ? 228 : 421, row % 4 ? 2 : 5);
    const pageMap = new THREE.CanvasTexture(canvas); pageMap.colorSpace = THREE.SRGBColorSpace; this.textures.add(pageMap);
    const page = new THREE.MeshStandardMaterial({ map: pageMap, roughness: .96 }); this.materials.add(page);
    const sheet = this.mesh(new THREE.PlaneGeometry(.73, 1.07), page, -2.2, table.height + .105, .1); sheet.rotation.set(-Math.PI / 2, 0, -Math.PI / 2);
    this.folder.position.set(-2.6, table.height + .12, .1); this.folder.userData.dynamic = true; this.root.add(this.folder);
    this.mesh(new THREE.BoxGeometry(.8, .019, 1.15), file, .4, 0, 0, this.folder);
    this.batch();
  }
  private mat(color: number, roughness: number, metalness = 0): THREE.MeshStandardMaterial {
    const material = new THREE.MeshStandardMaterial({ color, roughness, metalness }); this.materials.add(material); return material;
  }
  private mesh(geometry: THREE.BufferGeometry, material: THREE.Material, x: number, y: number, z: number, parent = this.root): THREE.Mesh {
    this.geometries.add(geometry); const mesh = new THREE.Mesh(geometry, material); mesh.position.set(x, y, z); mesh.castShadow = mesh.receiveShadow = true; parent.add(mesh); return mesh;
  }
  private box(material: THREE.Material, x: number, y: number, z: number, w: number, h: number, d: number, radius = 0) {
    return this.mesh(radius ? new RoundedBoxGeometry(w, h, d, 2, radius) : new THREE.BoxGeometry(w, h, d), material, x, y, z);
  }
  private makeChair(x: number, angle: number, metal: THREE.Material, dark: THREE.Material): THREE.Group {
    const chair = new THREE.Group(); chair.position.x = x; chair.rotation.y = angle; this.root.add(chair);
    for (const side of [-1, 1]) {
      const curve = new THREE.CatmullRomCurve3([new THREE.Vector3(side * .55, .05, .62), new THREE.Vector3(side * .55, 1.3, -.55), new THREE.Vector3(side * .55, 2.7, -.57)]);
      this.mesh(new THREE.TubeGeometry(curve, 16, .055, 8), metal, 0, 0, 0, chair);
      this.mesh(new THREE.CylinderGeometry(.055, .055, 1.4, 8), metal, side * .55, .67, -.6, chair);
    }
    this.mesh(new RoundedBoxGeometry(1.3, .13, 1.35, 2, .05), dark, 0, 1.27, 0, chair);
    this.mesh(new RoundedBoxGeometry(1.22, .84, .11, 2, .05), dark, 0, 2.3, -.6, chair);
    return chair;
  }
  update(journey?: FilmJourney): void {
    const state = journey?.scene === 'm1_interrogation' && !journey.visiting ? journey.interrogation : undefined;
    const pose = interrogationPose({ phase: state?.phase ?? 'file', elapsed: state?.elapsed ?? 0, role: 'neo' });
    this.folder.rotation.z = pose.file * Math.PI * .93;
    this.chair.position.z = -1.8 * pose.rise; this.chair.rotation.y = -Math.PI / 2 + pose.rise * .3; this.chair.rotation.z = pose.pinned * .13;
  }
  private batch(): void {
    this.root.updateMatrixWorld(true); const inverse = this.root.matrixWorld.clone().invert();
    const batches = new Map<THREE.Material, THREE.BufferGeometry[]>(); const removed: THREE.Mesh[] = [];
    this.root.traverse(object => {
      if (!(object instanceof THREE.Mesh) || Array.isArray(object.material)) return;
      for (let node: THREE.Object3D | null = object; node && node !== this.root; node = node.parent) if (node.userData.dynamic) return;
      let geo = object.geometry.clone().applyMatrix4(inverse.clone().multiply(object.matrixWorld));
      if (geo.index) { const indexed = geo; geo = indexed.toNonIndexed(); indexed.dispose(); }
      const list = batches.get(object.material) ?? []; list.push(geo); batches.set(object.material, list); removed.push(object);
    });
    removed.forEach(mesh => mesh.removeFromParent());
    for (const [material, geometries] of batches) { this.mesh(mergeGeometries(geometries)!, material, 0, 0, 0); geometries.forEach(geo => geo.dispose()); }
    const live = new Set<THREE.BufferGeometry>(); this.root.traverse(object => { if (object instanceof THREE.Mesh) live.add(object.geometry); });
    for (const geo of this.geometries) if (!live.has(geo)) { geo.dispose(); this.geometries.delete(geo); }
  }
  dispose(): void {
    this.root.traverse(object => { if (object instanceof THREE.SpotLight || object instanceof THREE.PointLight) object.dispose(); });
    this.geometries.forEach(geo => geo.dispose()); this.materials.forEach(mat => mat.dispose()); this.textures.forEach(tex => tex.dispose()); this.root.removeFromParent();
  }
}
