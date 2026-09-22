import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { OFFICE_DESKS, OFFICE_OBSTACLES, OFFICE_LADDER, OFFICE_CONTACT, OFFICE_WINDOW, OFFICE_LEDGE_OFFSET, officeWindowPose, officeParcelPoint, type FilmSet, type FilmJourney, type Vector3 } from '@auto_matrix/shared';
import { PhoneModel } from '../agents/PhoneModel.js';
import { OfficeWorkdayRenderer } from './OfficeWorkdayRenderer.js';
import type { OfficeWorkday } from '@auto_matrix/shared';

/** Office cover is drawn from the same dimensions used by movement and guard sight. */
export class OfficeSetRenderer {
  private root = new THREE.Group();
  private materials: THREE.Material[] = [];
  private textures: THREE.Texture[] = [];
  private light?: THREE.DirectionalLight;
  private delivery?: THREE.Group;
  private flap?: THREE.Group;
  private phone?: PhoneModel;
  private workday: OfficeWorkdayRenderer;
  private sash?: THREE.Group;
  private latch?: THREE.Group;
  private windowMaterials: { material: THREE.MeshStandardMaterial; opacity: number; depthWrite: boolean }[] = [];
  constructor(parent: THREE.Group, set: FilmSet) {
    parent.add(this.root);
    if (set.id === 'film_office_ledge') this.root.position.x = -OFFICE_LEDGE_OFFSET;
    this.office(); this.ledge();
    this.batch();
    this.workday = new OfficeWorkdayRenderer(this.root);
    this.parcel(); this.openingWindow();
  }
  private openingWindow(): void {
    const w = OFFICE_WINDOW;
    const metal = this.mat(0x68736f, .26, .78); const rubber = this.mat(0x222a27, .88);
    const glass = new THREE.MeshStandardMaterial({ color: 0xadc9cc, transparent: true, opacity: .19, roughness: .13, metalness: .25, depthWrite: false }); this.materials.push(glass);
    this.windowMaterials = [metal, rubber, glass].map(material => ({ material, opacity: material.opacity, depthWrite: material.depthWrite }));
    const sash = this.sash = new THREE.Group(); sash.position.set(w.x, w.top, w.z); this.root.add(sash);
    const part = (parent: THREE.Object3D, material: THREE.Material, x: number, y: number, z: number, width: number, height: number, depth: number) => {
      const mesh = new THREE.Mesh(new THREE.BoxGeometry(width, height, depth), material); mesh.position.set(x, y, z); mesh.castShadow = material !== glass; mesh.receiveShadow = true; parent.add(mesh); return mesh;
    };
    const pane = part(sash, glass, 0, -w.height / 2, 0, .035, w.height - .24, w.width - .24); pane.name = 'office-window-glass';
    for (const z of [-w.width / 2, w.width / 2]) {
      part(sash, rubber, 0, -w.height / 2, z, .12, w.height, .17);
      part(sash, metal, .07, -w.height / 2, z, .12, w.height, .1);
    }
    for (const y of [0, -w.height]) part(sash, metal, .03, y, 0, .2, .15, w.width);
    for (const z of [-w.width / 2 + .45, w.width / 2 - .45]) part(this.root, metal, w.x, w.top, w.z + z, .34, .2, .44);
    const latch = this.latch = new THREE.Group(); latch.name = 'office-window-handle'; latch.position.set(.16, w.handleY - w.top, 0); sash.add(latch);
    part(latch, metal, -.045, 0, 0, .12, .3, .22);
    part(latch, metal, .09, .15, 0, .12, .5, .09);
    part(latch, rubber, .09, .24, 0, .14, .28, .1).name = 'office-window-grip';
  }
  private parcel(): void {
    const group = this.delivery = new THREE.Group(); group.position.set(OFFICE_CONTACT.parcelX, 2.51, OFFICE_CONTACT.parcelZ); this.root.add(group);
    const paper = this.mat(0xb6a58b, .95);
    const box = (parent: THREE.Object3D, x: number, y: number, z: number, w: number, h: number, d: number) => {
      const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), paper); mesh.position.set(x, y, z); mesh.castShadow = mesh.receiveShadow = true; parent.add(mesh); return mesh;
    };
    box(group, 0, .025, 0, .95, .05, 1.25);
    for (const x of [-.47, .47]) box(group, x, .14, 0, .014, .25, 1.25);
    box(group, 0, .14, .62, .95, .25, .014);
    const flap = this.flap = new THREE.Group(); flap.position.set(0, .285, -.625); group.add(flap);
    box(flap, 0, 0, .625, .95, .018, 1.25);
    const canvas = document.createElement('canvas'); canvas.width = 512; canvas.height = 512; const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = '#e9e5d6'; ctx.fillRect(0, 0, 512, 512); ctx.fillStyle = '#2b302e'; ctx.font = 'bold 38px sans-serif'; ctx.fillText('EXPRESS', 28, 70);
    ctx.fillRect(28, 90, 455, 3); ctx.font = '20px monospace'; ctx.fillText('DELIVER TO:', 28, 138); ctx.font = 'bold 25px monospace'; ctx.fillText('THOMAS ANDERSON', 28, 197);
    ctx.font = '21px monospace'; ctx.fillText('METACORTEX', 28, 233); ctx.fillText('SOFTWARE / FLOOR 34', 28, 274); ctx.fillText('PERSONAL DELIVERY', 28, 331);
    for (let i = 0; i < 105; i++) if (i % 3 !== 0) ctx.fillRect(34 + i * 4.2, 385, i % 4 === 0 ? 3 : 1.5, 65);
    const texture = new THREE.CanvasTexture(canvas); texture.colorSpace = THREE.SRGBColorSpace; this.textures.push(texture);
    const ink = new THREE.MeshStandardMaterial({ map: texture, roughness: .92 }); this.materials.push(ink);
    const label = new THREE.Mesh(new THREE.PlaneGeometry(.72, .85), ink); label.rotation.x = -Math.PI / 2; label.position.set(0, .012, .62); flap.add(label);
    this.phone = new PhoneModel(); this.phone.root.name = 'parcel-phone'; this.phone.root.position.set(0, .215, 0); this.phone.root.rotation.x = -Math.PI / 2; group.add(this.phone.root);
  }
  update(journey: FilmJourney | undefined, cameraPosition?: Vector3, playerPosition?: Vector3, clock?: OfficeWorkday): void {
    if (journey?.scene === 'm1_boss' && !journey.visiting && clock) journey = { ...journey, workday: clock };
    this.workday.update(journey);
    if (this.sash && this.latch) {
      const time = journey?.office?.window ?? (journey?.completed.includes('m1_office_escape') && journey.office?.outcome !== 'captured' ? OFFICE_WINDOW.seconds : 0);
      const pose = officeWindowPose(time); this.sash.rotation.z = pose.angle; this.latch.rotation.x = pose.latch;
    }
    let obscured = false;
    if (this.sash && journey?.scene === 'm1_ledge' && cameraPosition && playerPosition) {
      this.sash.updateWorldMatrix(true, true);
      const camera = new THREE.Vector3(cameraPosition.x, cameraPosition.y, cameraPosition.z);
      const ray = new THREE.Raycaster();
      for (const height of [1.2, 2.3, 3.3]) {
        const target = new THREE.Vector3(playerPosition.x, playerPosition.y + height, playerPosition.z);
        ray.set(camera, target.clone().sub(camera).normalize()); ray.far = camera.distanceTo(target);
        if (ray.intersectObject(this.sash, true).length) { obscured = true; break; }
      }
    }
    for (const { material, opacity, depthWrite } of this.windowMaterials) {
      const transparent = obscured || opacity < 1;
      if (material.transparent !== transparent) { material.transparent = transparent; material.needsUpdate = true; }
      material.opacity = opacity * (obscured ? .12 : 1); material.depthWrite = !obscured && depthWrite;
    }
    if (!this.delivery || !this.flap || !this.phone) return;
    const workday = journey?.scene === 'm1_boss' && !journey.visiting ? journey.workday : undefined;
    this.delivery.visible = Boolean(journey && (workday ? ['delivery', 'signature', 'signing', 'delivered'].includes(workday.phase) : journey.scene === 'm1_boss' && journey.step > 0 || journey.completed.includes('m1_boss') || journey.scene === 'm1_office_escape'));
    const parcel = workday ? officeParcelPoint(workday) : { x: OFFICE_CONTACT.parcelX, y: 2.51, z: OFFICE_CONTACT.parcelZ };
    this.delivery.position.set(parcel.x, parcel.y, parcel.z);
    const phone = journey?.phone;
    const opened = phone ? phone.phase === 'pickup' ? Math.min(1, phone.elapsed / .45) : 1 : journey?.scene === 'm1_office_escape' || journey?.completed.includes('m1_boss') ? 1 : 0;
    this.flap.rotation.x = -opened * 2.7;
    this.phone.root.visible = Boolean(phone?.phase === 'pickup' && phone.elapsed < .65);
  }
  private mat(color: number, roughness = .7, metalness = 0): THREE.MeshStandardMaterial {
    const material = new THREE.MeshStandardMaterial({ color, roughness, metalness }); this.materials.push(material); return material;
  }
  private box(material: THREE.Material, x: number, y: number, z: number, w: number, h: number, d: number): THREE.Mesh {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material);
    mesh.position.set(x, y, z); mesh.castShadow = mesh.receiveShadow = true; this.root.add(mesh); return mesh;
  }
  private cylinder(material: THREE.Material, x: number, y: number, z: number, r: number, h: number): void {
    const mesh = new THREE.Mesh(new THREE.CylinderGeometry(r, r, h, 16), material); mesh.position.set(x, y, z); mesh.castShadow = true; this.root.add(mesh);
  }
  private sign(text: string, x: number, y: number, z: number, width: number, color = '#dce5df', background = '#15231f'): void {
    const canvas = document.createElement('canvas'); canvas.width = 1024; canvas.height = 256;
    const ctx = canvas.getContext('2d')!; ctx.fillStyle = background; ctx.fillRect(0, 0, 1024, 256);
    ctx.fillStyle = color; ctx.font = '54px monospace'; ctx.textBaseline = 'middle'; ctx.textAlign = 'center'; ctx.fillText(text, 512, 128, 940);
    const map = new THREE.CanvasTexture(canvas); map.colorSpace = THREE.SRGBColorSpace; this.textures.push(map);
    const material = new THREE.MeshBasicMaterial({ map }); this.materials.push(material);
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(width, width / 4), material); mesh.position.set(x, y, z); this.root.add(mesh);
  }
  private office(): void {
    const wall = this.mat(0xb5b5a5); const frame = this.mat(0x737b72, .32, .6); const partition = this.mat(0x747a6a, .95);
    const desk = this.mat(0xb3b2a0, .52); const black = this.mat(0x22282a, .54); const paper = this.mat(0xd5d6c7, .92);
    const carpet = this.mat(0x8a8a77, 1); const canvas = document.createElement('canvas'); canvas.width = canvas.height = 256;
    const ctx = canvas.getContext('2d')!;
    for (let y = 0; y < 256; y += 2) for (let x = 0; x < 256; x += 2) {
      const n = 92 + (x * 17 + y * 31 + x * y) % 36; ctx.fillStyle = `rgb(${n},${n},${n - 7})`; ctx.fillRect(x, y, 2, 2);
    }
    const map = new THREE.CanvasTexture(canvas); map.wrapS = map.wrapT = THREE.RepeatWrapping; map.repeat.set(18, 22); map.colorSpace = THREE.SRGBColorSpace; this.textures.push(map); carpet.map = map;
    this.box(carpet, 0, -.2, 0, 54, .4, 66);
    this.box(wall, 0, 9.3, 0, 54, .4, 66);
    this.box(wall, 27, 4.5, 0, .5, 9, 66); this.box(wall, 0, 4.5, -33, 54, 9, .5); this.box(wall, 0, 4.5, 33, 54, 9, .5);
    const sky = this.mat(0xa8bdc1, .3); sky.emissive.setHex(0x586b70); sky.emissiveIntensity = .3;
    this.box(wall, -27, 1.3, 0, .6, 2.6, 66);
    const edges = [-33, -30, -24, -18, -12, -6, 0, 6, 12, 18, 24, 30, 33];
    for (const z of edges) this.box(frame, -26.8, 5.8, z, .25, 6.4, .13);
    for (let i = 1; i < edges.length; i++) {
      const z = (edges[i - 1] + edges[i]) / 2; const width = edges[i] - edges[i - 1] - .15;
      this.box(desk, -26.4, 2.75, z, 1.1, .15, width);
      if (z === OFFICE_WINDOW.z) {
        this.box(frame, -26.8, 8.96, z, .3, .16, width);
        for (let n = 0; n < 9; n++) this.box(paper, -26.5, 8.95 - n * .045, z, .34, .025, width - .1);
      } else {
        this.box(sky, -27, 5.8, z, .1, 6.2, width);
        for (let y = 3.2; y < 9; y += .38) this.box(paper, -26.5, y, z, .32, .05, width - .1).rotation.z = .24;
        this.box(frame, -26.7, 6, z, .4, .14, width);
      }
    }
    this.exterior(OFFICE_LEDGE_OFFSET);
    for (let x = -24; x <= 24; x += 6) this.box(frame, x, 9.04, 0, .04, .025, 66);
    for (let z = -30; z <= 30; z += 6) this.box(frame, 0, 9.04, z, 54, .025, .04);
    const diffuser = new THREE.MeshBasicMaterial({ color: 0xe7eddb, toneMapped: false }); this.materials.push(diffuser);
    for (const z of [-24, -12, 0, 12, 24]) for (const x of [-16, 0, 16]) {
      this.box(frame, x, 8.98, z, 3, .12, 5.3); this.box(diffuser, x, 8.9, z, 2.7, .04, 5);
      for (let n = -2; n <= 2; n++) this.box(frame, x, 8.87, z + n * .9, 2.75, .03, .055);
    }
    for (const o of OFFICE_OBSTACLES) {
      if (o.kind === 'panel') {
        this.box(partition, o.x, o.height / 2, o.z, o.width, o.height, o.depth);
        this.box(frame, o.x, o.height, o.z, o.width + .03, .07, o.depth + .04);
        this.box(frame, o.x, .18, o.z, o.width + .03, .26, o.depth + .04);
      } else {
        this.box(desk, o.x, 2.38, o.z, o.width, .24, o.depth);
        for (const dx of [-3.5, 3.5]) this.box(frame, o.x + dx, 1.16, o.z, .15, 2.3, 2.6);
        this.box(wall, o.x - 2.3, 1.15, o.z, 2, 2.3, 2.5);
        for (const y of [.45, 1.2, 1.95]) this.box(frame, o.x - 2.3, y, o.z + 1.29, .5, .08, .06);
      }
    }
    const monitor = this.mat(0x204541, .22); monitor.emissive.setHex(0x2d5c4e); monitor.emissiveIntensity = .6;
    for (const { x, z } of OFFICE_DESKS) {
      this.box(wall, x, 3.3, z - 2.6, 2.5, 1.65, 1.7); this.box(black, x, 3.3, z - 1.71, 2.2, 1.4, .08);
      this.box(monitor, x, 3.3, z - 1.66, 2.02, 1.19, .02);
      for (let i = 0; i < 7; i++) this.box(paper, x - .25, 3.7 - i * .13, z - 1.64, .4 + i % 3 * .32, .018, .006);
      this.box(wall, x, 2.58, z - .75, 2.6, .16, .8);
      for (let row = 0; row < 3; row++) for (let col = 0; col < 12; col++) this.box(paper, x - 1.05 + col * .18, 2.68, z - 1 + row * .21, .14, .05, .16);
      this.box(black, x + 2.7, 2.67, z - 1.7, .95, .35, 1.15); this.box(frame, x + 2.7, 2.85, z - 1.8, 1.12, .18, .34);
      if (x !== 16 || z !== 6) this.box(paper, x - 2.3, 2.54, z - 1.4, 1.6, .025, 1.9).rotation.y = .16;
      this.cylinder(wall, x + 1.8, 2.78, z - 2.5, .22, .5);
      this.cylinder(frame, x, .85, z + 1.1, .1, 1.7); this.box(black, x, 1.65, z + 1.1, 2.1, .25, 1.9);
      this.box(black, x, 2.55, z + 2, 2.1, 1.7, .3); this.box(frame, x, .2, z + 1.1, 2.3, .13, .15); this.box(frame, x, .2, z + 1.1, .15, .13, 2.3);
    }
    for (const x of [-3.3, 3.3]) { this.box(black, x, 3.7, -32.7, 5.5, 7.4, .12); this.box(frame, x, 3.65, -32.6, 5.2, 7.2, .08); }
    this.sign('METACORTEX', 0, 8, -32.4, 12, '#344c43', '#b5b5a5');
    this.sign('PERSONNEL / AUTHORIZED ACCESS', 0, 6.1, 32.6, 11);
    for (const z of [-17, 5, 24]) { const light = new THREE.PointLight(0xe4ead6, 160, 36, 2); light.position.set(0, 8, z); this.root.add(light); }
    this.sun(-35, 20, 12, 2.5);
  }
  private ledge(): void {
    const concrete = this.mat(0x939a95, .87); const metal = this.mat(0x6d7778, .35, .75); const glass = this.mat(0x657e87, .17, .6);
    const x = OFFICE_LEDGE_OFFSET; const z = OFFICE_LADDER.z;
    this.box(concrete, x, -.3, 0, 4.8, .6, 76);
    for (const [bottom, top] of [[-65, -.7], [9.5, 44]]) {
      this.box(concrete, -26.85, (bottom + top) / 2, 0, .6, top - bottom, 76);
      for (let y = bottom + 4.5; y < top - 4; y += 9) for (let bay = -33; bay <= 33; bay += 6) {
        this.box(glass, -27.17, y, bay, .06, 8.4, 5.7);
        this.box(metal, -27.23, y - 4.3, bay, .24, .24, 6); this.box(metal, -27.24, y, bay - 3, .28, 9, .2);
      }
    }
    for (const dz of [-3, 2]) for (const dx of [-1.7, 1.7]) this.cylinder(metal, x + dx, -18, z + dz, .09, 39);
    this.box(concrete, x - 1, -OFFICE_LADDER.depth - .15, z, 7, .3, 6);
    for (const dz of [-.82, .82]) this.box(metal, x - 2.5, -13.7, z + dz, .12, OFFICE_LADDER.depth + 4.6, .12);
    for (let y = -OFFICE_LADDER.depth; y <= 4.6; y += .55) this.box(metal, x - 2.5, y, z, .1, .09, 1.65);
    for (let y = -30; y <= 0; y += 6) {
      this.box(metal, x, y, z - 3, 4, .12, .12); this.box(metal, x, y, z + 2, 4, .12, .12);
      this.box(metal, x - 1.7, y, z - .5, .12, .12, 5);
    }
    this.box(metal, x - 4.4, -OFFICE_LADDER.depth + 1.5, z, .1, 3, 6);
  }
  private exterior(offset: number): void {
    const asphalt = this.mat(0x414a4d, .9); this.box(asphalt, offset - 27, -65, 0, 54, 1, 250);
    const facade = this.mat(0x899396, .75); const trim = this.mat(0xc2c7be);
    const glass = this.mat(0x657e87, .17, .6);
    for (let i = 0; i < 9; i++) {
      const x = offset - 42 - (i % 3) * 20; const z = -70 + i * 18; const h = 45 + [36, 6, 22, 52, 15, 38, 8, 48, 20][i];
      this.box(facade, x, h / 2 - 65, z, 15, h, 16);
      for (let y = -58; y < h - 65; y += 5) for (const dz of [-5, 0, 5]) this.box(glass, x + 7.52, y, z + dz, .05, 3.2, 3);
      this.box(trim, x, h - 65, z, 16, .5, 17);
    }
    for (const x of [-17, -29]) for (let z = -115; z <= 115; z += 12) this.box(trim, offset + x, -64.47, z, .13, .015, 4.6);
    for (const z of [-42, 32]) for (let x = -34; x < -7; x += 1.8) this.box(trim, offset + x, -64.46, z, 1.1, .02, 4.5);
    const car = this.mat(0x253a3c, .33, .45); const wheel = this.mat(0x1b2424, .9);
    for (let i = 0; i < 12; i++) {
      const x = offset - 10 - i % 3 * 10; const z = -106 + i * 19;
      this.box(car, x, -63.7, z, 2.2, 1, 4.3); this.box(glass, x, -62.95, z - .1, 1.9, .65, 2.4);
      for (const dx of [-1.1, 1.1]) for (const dz of [-1.3, 1.3]) this.box(wheel, x + dx, -64.1, z + dz, .2, .65, .65);
    }
  }
  private sun(x: number, y: number, z: number, intensity: number): void {
    const light = new THREE.DirectionalLight(0xffefdb, intensity); light.position.set(x, y, z); light.target.position.set(0, 0, -8);
    light.castShadow = true; light.shadow.mapSize.set(2048, 2048); Object.assign(light.shadow.camera, { left: -40, right: 40, top: 48, bottom: -48, near: .5, far: 160 });
    light.shadow.bias = -.0003; light.shadow.normalBias = .08; this.root.add(light, light.target); this.light = light;
  }
  private batch(): void {
    const batches = new Map<THREE.Material, THREE.BufferGeometry[]>(); this.root.updateMatrixWorld(true);
    for (const child of [...this.root.children]) {
      if (!(child instanceof THREE.Mesh) || Array.isArray(child.material)) continue;
      const source = child.geometry.clone().applyMatrix4(child.matrix); const geometry = source.index ? source.toNonIndexed() : source;
      if (source !== geometry) source.dispose();
      const group = batches.get(child.material) ?? []; group.push(geometry); batches.set(child.material, group);
      child.geometry.dispose(); child.removeFromParent();
    }
    for (const [material, geometries] of batches) {
      const geometry = mergeGeometries(geometries); geometries.forEach(g => g.dispose());
      if (!geometry) throw new Error('Office geometry could not be merged');
      const mesh = new THREE.Mesh(geometry, material); mesh.castShadow = mesh.receiveShadow = true; this.root.add(mesh);
    }
  }
  dispose(): void {
    this.workday.dispose();
    this.phone?.dispose();
    this.root.traverse(object => { if (object instanceof THREE.Mesh) object.geometry.dispose(); if (object instanceof THREE.PointLight) object.dispose(); });
    this.light?.dispose(); this.materials.forEach(m => m.dispose()); this.textures.forEach(t => t.dispose()); this.root.removeFromParent();
  }
}
