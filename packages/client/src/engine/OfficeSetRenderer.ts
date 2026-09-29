import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { clone } from 'three/addons/utils/SkeletonUtils.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { OFFICE_DESKS, OFFICE_OBSTACLES, OFFICE_LADDER, OFFICE_CONTACT, OFFICE_WINDOW, OFFICE_LEDGE_OFFSET, officeWindowPose, officeParcelPoint, type FilmSet, type FilmJourney, type Vector3 } from '@auto_matrix/shared';
import { PhoneModel } from '../agents/PhoneModel.js';
import { OfficeWorkdayRenderer } from './OfficeWorkdayRenderer.js';
import type { OfficeWorkday } from '@auto_matrix/shared';

/** Office cover is drawn from the same dimensions used by movement and guard sight. */
export class OfficeSetRenderer {
  private root = new THREE.Group();
  private materials: THREE.Material[] = [];
  private textures: THREE.Texture[] = [];
  private windowLight?: THREE.SpotLight;
  private delivery?: THREE.Group;
  private flap?: THREE.Group;
  private phone?: PhoneModel;
  private workday: OfficeWorkdayRenderer;
  private sash?: THREE.Group;
  private latch?: THREE.Group;
  private windowMaterials: { material: THREE.MeshStandardMaterial; opacity: number; depthWrite: boolean }[] = [];
  private cleaners = new THREE.Group();
  private cleanerActors: { root: THREE.Group; bones: Map<string, THREE.Bone>; blade: THREE.Mesh; handle: THREE.Mesh; z: number }[] = [];
  private cleanerSkeletons: THREE.Skeleton[] = [];
  private disposed = false;
  constructor(parent: THREE.Group, set: FilmSet) {
    parent.add(this.root);
    if (set.id === 'film_office_ledge') this.root.position.x = -OFFICE_LEDGE_OFFSET;
    this.office(); this.ledge();
    this.batch();
    this.workday = new OfficeWorkdayRenderer(this.root);
    this.parcel(); this.openingWindow();
    this.cleaners.name = 'office-window-cleaners'; this.root.add(this.cleaners);
    void this.loadCleaners().catch(error => console.error('窗外清洁工模型加载失败', error));
  }
  private async loadCleaners(): Promise<void> {
    const asset = await new GLTFLoader().loadAsync('/assets/characters/club-male.glb');
    if (this.disposed) return;
    asset.scene.traverse(object => {
      if (!(object instanceof THREE.Mesh)) return;
      const material = object.material as THREE.MeshStandardMaterial; this.materials.push(material);
      for (const texture of [material.map, material.normalMap]) if (texture) this.textures.push(texture);
    });
    const rubber = this.mat(0x1e2727, .9); const steel = this.mat(0x7c8986, .32, .65);
    for (const [i, z] of [25, 28.4].entries()) {
      const root = clone(asset.scene) as THREE.Group; root.name = `window-cleaner-${i + 1}`;
      const bones = new Map<string, THREE.Bone>();
      root.traverse(object => {
        if (object instanceof THREE.Bone) bones.set(object.name, object);
        if (!(object instanceof THREE.Mesh)) return;
        object.castShadow = false; object.receiveShadow = true;
        if (object instanceof THREE.SkinnedMesh) { object.frustumCulled = false; this.cleanerSkeletons.push(object.skeleton); }
        const source = object.material as THREE.MeshStandardMaterial;
        if (/Coat|Trousers/.test(source.name)) {
          const material = source.clone(); material.color.setHex(source.name === 'Trousers' ? 0x303b3e : i ? 0x626b64 : 0x435e66);
          object.material = material; this.materials.push(material);
        }
      });
      root.position.set(-29.35, 0, z); root.rotation.y = Math.PI / 2; root.scale.setScalar(i ? .88 : .92); this.cleaners.add(root);
      const blade = new THREE.Mesh(new THREE.BoxGeometry(.09, .08, .94), rubber); blade.name = `window-squeegee-${i + 1}`; this.cleaners.add(blade);
      const handle = new THREE.Mesh(new THREE.CylinderGeometry(.035, .035, 1, 8), steel); this.cleaners.add(handle);
      this.cleanerActors.push({ root, bones, blade, handle, z });
    }
  }
  private updateCleaners(time: number, visible: boolean): void {
    this.cleaners.visible = visible;
    if (!visible) return;
    const up = new THREE.Vector3(0, 1, 0);
    this.cleanerActors.forEach(({ root, bones, blade, handle, z }, i) => {
      const sweep = Math.sin(time * 1.1 + i * 1.7);
      bones.get('shoulder_R')!.rotation.x = -1.03 + sweep * .13;
      bones.get('elbow_R')!.rotation.x = -.42 - sweep * .16;
      bones.get('shoulder_L')!.rotation.x = -.42;
      bones.get('elbow_L')!.rotation.x = -.63;
      bones.get('head')!.rotation.y = -.18 + sweep * .06;
      root.updateWorldMatrix(true, true);
      const wrist = this.root.worldToLocal(bones.get('wrist_R')!.getWorldPosition(new THREE.Vector3()));
      const glass = new THREE.Vector3(-27.14, 4.8 + sweep * .5, z);
      blade.position.copy(glass);
      const reach = glass.clone().sub(wrist); handle.position.copy(wrist).addScaledVector(reach, .5);
      handle.quaternion.setFromUnitVectors(up, reach.clone().normalize()); handle.scale.y = reach.length();
    });
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
    ctx.font = '21px monospace'; ctx.fillText('METACORTEX', 28, 233); ctx.fillText('SOFTWARE / FLOOR 08', 28, 274); ctx.fillText('PERSONAL DELIVERY', 28, 331);
    for (let i = 0; i < 105; i++) if (i % 3 !== 0) ctx.fillRect(34 + i * 4.2, 385, i % 4 === 0 ? 3 : 1.5, 65);
    const texture = new THREE.CanvasTexture(canvas); texture.colorSpace = THREE.SRGBColorSpace; this.textures.push(texture);
    const ink = new THREE.MeshStandardMaterial({ map: texture, roughness: .92 }); this.materials.push(ink);
    const label = new THREE.Mesh(new THREE.PlaneGeometry(.72, .85), ink); label.rotation.x = -Math.PI / 2; label.position.set(0, .012, .62); flap.add(label);
    this.phone = new PhoneModel(); this.phone.root.name = 'parcel-phone'; this.phone.root.position.set(0, .215, 0); this.phone.root.rotation.x = -Math.PI / 2; group.add(this.phone.root);
  }
  update(journey: FilmJourney | undefined, cameraPosition?: Vector3, playerPosition?: Vector3, clock?: OfficeWorkday, time = 0, timeOfDay = 12000): void {
    if (this.windowLight) this.windowLight.intensity = 500 * Math.max(0, Math.sin((timeOfDay / 24000 - .25) * Math.PI * 2));
    if (journey?.scene === 'm1_boss' && !journey.visiting && clock) journey = { ...journey, workday: clock };
    this.workday.update(journey);
    this.updateCleaners(time, journey?.scene === 'm1_boss' && !journey.visiting);
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
  private box(material: THREE.Material, x: number, y: number, z: number, w: number, h: number, d: number, radius = 0): THREE.Mesh {
    const mesh = new THREE.Mesh(radius ? new RoundedBoxGeometry(w, h, d, 2, radius) : new THREE.BoxGeometry(w, h, d), material);
    mesh.position.set(x, y, z); mesh.castShadow = mesh.receiveShadow = !material.transparent; this.root.add(mesh); return mesh;
  }
  private surface(material: THREE.Material, x: number, y: number, z: number, w: number, h: number, d: number, tile: number): void {
    const mesh = this.box(material, x, y, z, w, h, d);
    const { uv, position, normal } = mesh.geometry.attributes;
    // A constant world-space weave avoids stretched fibers and seams between floor sections.
    for (let i = 0; i < uv.count; i++) {
      const side = Math.abs(normal.getX(i)) > .5, top = Math.abs(normal.getY(i)) > .5;
      uv.setXY(i, (side ? z + position.getZ(i) : x + position.getX(i)) / tile,
        (top ? z + position.getZ(i) : y + position.getY(i)) / tile);
    }
  }
  private cable(material: THREE.Material, points: THREE.Vector3[]): void {
    const curve = new THREE.CatmullRomCurve3(points);
    const mesh = new THREE.Mesh(new THREE.TubeGeometry(curve, Math.max(12, points.length * 2), .025, 5, false), material);
    mesh.castShadow = mesh.receiveShadow = true; this.root.add(mesh);
  }
  private workstationScreen(): THREE.MeshStandardMaterial {
    const canvas = document.createElement('canvas'); canvas.width = 1024; canvas.height = 768;
    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = '#142422'; ctx.fillRect(0, 0, 1024, 768);
    ctx.fillStyle = '#a0aaa2'; ctx.fillRect(42, 38, 940, 690);
    ctx.fillStyle = '#324f47'; ctx.fillRect(48, 44, 928, 44);
    ctx.font = '22px monospace'; ctx.fillStyle = '#dce3d7'; ctx.fillText('METACORTEX / SOFTWARE ENGINEERING', 65, 75);
    ctx.fillStyle = '#c9cbbf'; ctx.fillRect(48, 93, 928, 35); ctx.fillStyle = '#333c37'; ctx.font = '18px monospace'; ctx.fillText('File   Edit   Search   Project   Help', 65, 116);
    ctx.fillStyle = '#1c302c'; ctx.fillRect(55, 136, 912, 485);
    const lines = ['anderson@metacortex:~$ make verify', '', 'Building client directory ...', 'Compiling network services ...', 'Loading personnel records ...', '', '    core .......... ok', '    accounts ...... ok', '    gateway ....... ok', '', 'BUILD COMPLETE.  0 ERRORS.', '', '> _'];
    ctx.font = '22px monospace';
    lines.forEach((line, i) => { ctx.fillStyle = i > 9 ? '#bac9b0' : '#7d9e8e'; ctx.fillText(line, 76, 176 + i * 31); });
    ctx.fillStyle = '#525f56'; ctx.font = '18px monospace'; ctx.fillText('Ready     Ln 101, Col 1                         INS', 65, 698);
    for (let y = 0; y < 768; y += 4) { ctx.fillStyle = 'rgba(0, 0, 0, .1)'; ctx.fillRect(0, y, 1024, 1); }
    const map = new THREE.CanvasTexture(canvas); map.colorSpace = THREE.SRGBColorSpace; map.anisotropy = 8; this.textures.push(map);
    const material = new THREE.MeshStandardMaterial({ map, emissiveMap: map, emissive: 0xffffff, emissiveIntensity: .25, roughness: .26 });
    this.materials.push(material); return material;
  }
  private documentPage(): THREE.MeshStandardMaterial {
    const canvas = document.createElement('canvas'); canvas.width = 256; canvas.height = 384;
    const ctx = canvas.getContext('2d')!; ctx.fillStyle = '#d3d1bc'; ctx.fillRect(0, 0, 256, 384);
    ctx.fillStyle = '#505950'; ctx.font = 'bold 17px monospace'; ctx.fillText('METACORTEX', 22, 39);
    ctx.font = '9px monospace'; ctx.fillText('INTERNAL / WEEKLY REPORT', 22, 62); ctx.fillRect(22, 76, 209, 2);
    for (let i = 0; i < 24; i++) { ctx.fillStyle = i % 6 === 0 ? '#696d61' : '#989b87'; ctx.fillRect(22, 99 + i * 9, 135 + i * 37 % 70, 2); }
    const map = new THREE.CanvasTexture(canvas); map.colorSpace = THREE.SRGBColorSpace; map.anisotropy = 8; this.textures.push(map);
    const material = new THREE.MeshStandardMaterial({ map, roughness: .98 }); this.materials.push(material); return material;
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
    const wall = this.mat(0xa4aca4, .94); const ceiling = this.mat(0xb5bcb2, .98); const frame = this.mat(0x59645e, .48, .35); const partition = this.mat(0x747e78, 1);
    // Small baked bounce from the fluorescent banks, without another global light.
    ceiling.emissive.setHex(0x5a6254); ceiling.emissiveIntensity = .28;
    const desk = this.mat(0xb7b9a8, .69); const edge = this.mat(0x80715d, .75); const cabinet = this.mat(0x89908a, .62, .1);
    const black = this.mat(0x202828, .72); const paper = this.mat(0xd5d6c7, .96); const beige = this.mat(0xb4b49f, .74);
    const carpet = this.mat(0x687671, 1); const canvas = document.createElement('canvas'); canvas.width = canvas.height = 256;
    const ctx = canvas.getContext('2d')!;
    for (let y = 0; y < 256; y += 2) for (let x = 0; x < 256; x += 2) {
      const n = 158 + (x * 17 + y * 31 + x * y) % 28 + (x % 4 === 0 ? 13 : 0); ctx.fillStyle = `rgb(${n},${n},${n})`; ctx.fillRect(x, y, 2, 2);
    }
    const map = new THREE.CanvasTexture(canvas); map.wrapS = map.wrapT = THREE.RepeatWrapping; map.colorSpace = THREE.SRGBColorSpace; map.anisotropy = 8; this.textures.push(map);
    carpet.map = partition.map = map; carpet.bumpMap = partition.bumpMap = map; carpet.bumpScale = .045; partition.bumpScale = .025;
    for (const [x, z, w, d] of [[-15.3, 0, 23.4, 66], [15.3, 0, 23.4, 66], [0, 3.7, 7.2, 58.6]]) this.surface(carpet, x, -.2, z, w, .4, d, 1.5);
    this.box(ceiling, 0, 9.3, 0, 54, .4, 66);
    this.box(wall, 27, 4.5, 0, .5, 9, 66); this.box(wall, 0, 4.5, -33, 54, 9, .5); this.box(wall, 0, 4.5, 33, 54, 9, .5);
    this.box(frame, 26.7, .3, 0, .08, .6, 66);
    for (const z of [-32.7, 32.7]) this.box(frame, 0, .3, z, 54, .6, .08);
    const cleanerGlass = new THREE.MeshStandardMaterial({ color: 0xb8cac8, transparent: true, opacity: .19, roughness: .1, metalness: .12, depthWrite: false, side: THREE.DoubleSide }); this.materials.push(cleanerGlass);
    this.box(wall, -27, 1.3, 0, .6, 2.6, 66);
    const edges = [-33, -30, -24, -18, -12, -6, 0, 6, 12, 18, 24, 30, 33];
    for (const z of edges) this.box(frame, -26.8, 5.8, z, .25, 6.4, .13);
    for (let i = 1; i < edges.length; i++) {
      const z = (edges[i - 1] + edges[i]) / 2; const width = edges[i] - edges[i - 1] - .15;
      this.box(desk, -26.4, 2.75, z, 1.1, .15, width);
      if (z === OFFICE_WINDOW.z) {
        this.box(frame, -26.8, 8.96, z, .3, .16, width);
        for (let n = 0; n < 9; n++) this.box(paper, -26.5, 8.95 - n * .045, z, .34, .025, width - .1);
      } else if (z === 27) {
        this.box(cleanerGlass, -27, 5.8, z, .045, 6.2, width);
        for (let y = 7.8; y < 9; y += .35) this.box(paper, -26.5, y, z, .32, .05, width - .1).rotation.z = .24;
        this.box(frame, -26.7, 6, z, .4, .14, width);
      } else {
        this.box(cleanerGlass, -27, 5.8, z, .045, 6.2, width);
        for (let y = 3.2; y < 9; y += .38) this.box(paper, -26.5, y, z, .32, .05, width - .1).rotation.z = .24;
        this.box(frame, -26.7, 6, z, .4, .14, width);
      }
    }
    for (let x = -24; x <= 24; x += 6) this.box(frame, x, 9.04, 0, .04, .025, 66);
    for (let z = -30; z <= 30; z += 6) this.box(frame, 0, 9.04, z, 54, .025, .04);
    const diffuser = new THREE.MeshBasicMaterial({ color: 0xc2cbbd }); this.materials.push(diffuser);
    for (const z of [-24, -12, 0, 12, 24]) for (const x of [-16, 0, 16]) {
      this.box(frame, x, 8.98, z, 3, .12, 5.3); this.box(diffuser, x, 8.9, z, 2.7, .04, 5);
      for (let n = -2; n <= 2; n++) this.box(frame, x, 8.87, z + n * .9, 2.75, .03, .055);
    }
    for (const o of OFFICE_OBSTACLES) {
      if (o.kind === 'panel') {
        this.surface(partition, o.x, o.height / 2, o.z, o.width, o.height, o.depth, .85);
        this.box(frame, o.x, o.height, o.z, o.width + .03, .07, o.depth + .04);
        this.box(frame, o.x, .18, o.z, o.width + .03, .26, o.depth + .04);
      } else {
        this.box(edge, o.x, 2.37, o.z, o.width, .24, o.depth, .045);
        this.box(desk, o.x, 2.475, o.z, o.width - .04, .05, o.depth - .04, .02);
        for (const dx of [-3.5, 3.5]) this.box(frame, o.x + dx, 1.16, o.z, .15, 2.3, 2.6);
        this.box(cabinet, o.x - 2.3, 1.15, o.z, 2, 2.3, 2.5, .04);
        for (const y of [.45, 1.2, 1.95]) {
          this.box(frame, o.x - 2.3, y - .34, o.z + 1.26, 1.88, .018, .015);
          this.box(black, o.x - 2.3, y, o.z + 1.27, .61, .13, .024, .02);
          this.box(frame, o.x - 2.3, y + .01, o.z + 1.3, .48, .04, .07, .012);
          this.box(paper, o.x - 1.67, y + .12, o.z + 1.269, .25, .1, .018);
        }
      }
    }
    const monitor = this.workstationScreen(), report = this.documentPage();
    const led = this.mat(0x66884e, .5); led.emissive.setHex(0x50783c); led.emissiveIntensity = .4;
    for (const { x, z } of OFFICE_DESKS) {
      const screenX = x + .35, keyboardX = x + .4, mouseX = x + 2.05, phoneX = x + 3.2;
      this.box(beige, screenX, 2.59, z - 2.6, 1.45, .18, 1.2, .08);
      this.box(beige, screenX, 2.8, z - 2.6, .65, .27, .7, .07);
      this.box(beige, screenX, 3.53, z - 2.85, 1.8, 1.45, 1.45, .12);
      this.box(beige, screenX, 3.53, z - 2.05, 2.38, 1.73, .48, .1);
      this.box(black, screenX, 3.58, z - 1.79, 2.06, 1.36, .085, .065);
      this.box(monitor, screenX, 3.58, z - 1.738, 1.96, 1.26, .04, .015);
      this.box(led, screenX + .91, 2.85, z - 1.799, .047, .037, .016);
      for (let i = 0; i < 8; i++) this.box(frame, screenX + .915, 3.21 + i * .1, z - 2.75, .012, .031, .71);
      for (const dx of [-.65, -.45, -.25]) this.box(frame, screenX + dx, 2.85, z - 1.799, .1, .025, .02);
      this.box(beige, keyboardX, 2.58, z - .98, 2.6, .16, .82, .04);
      for (let row = 0; row < 4; row++) for (let col = 0; col < 13; col++) this.box(paper, keyboardX - 1.11 + col * .183, 2.686, z - 1.24 + row * .17, .145, .05, .132, .01);
      this.box(black, mouseX, 2.513, z - 1.08, .7, .018, .85, .018);
      this.box(beige, mouseX, 2.62, z - 1.11, .35, .2, .57, .09);
      this.cable(black, [new THREE.Vector3(mouseX, 2.57, z - 1.37), new THREE.Vector3(mouseX + .1, 2.54, z - 2.65), new THREE.Vector3(screenX + .8, 2.55, z - 3.24)]);
      this.box(beige, phoneX, 2.62, z - 1.69, 1.03, .23, 1.26, .06);
      for (const dx of [-.43, .43]) this.box(beige, phoneX + dx, 2.83, z - 2.08, .35, .2, .36, .09);
      this.box(beige, phoneX, 2.83, z - 2.08, .7, .12, .2, .035);
      for (let row = 0; row < 4; row++) for (let col = 0; col < 3; col++) this.box(frame, phoneX - .22 + col * .22, 2.746, z - 1.76 + row * .17, .15, .035, .1, .012);
      this.cable(black, Array.from({ length: 29 }, (_, i) => new THREE.Vector3(phoneX + .6 + Math.sin(i * Math.PI * .8) * .06, 2.57 + Math.cos(i * Math.PI * .8) * .045, z - 2.07 + i * .03)));
      for (let tier = 0; tier < 3; tier++) {
        const y = 2.57 + tier * .25;
        this.box(black, x - 2.95, y, z - 2.8, 1.57, .055, 1.77, .02);
        for (const dx of [-.76, .76]) this.box(black, x - 2.95 + dx, y + .07, z - 2.8, .05, .17, 1.77);
        this.box(paper, x - 2.95, y + .055, z - 2.81, 1.37, .04, 1.55);
        const page = new THREE.Mesh(new THREE.PlaneGeometry(1.35, 1.53), report); page.position.set(x - 2.95, y + .078, z - 2.81); page.rotation.x = -Math.PI / 2; this.root.add(page);
      }
      if (x !== 16 || z !== 6) this.box(paper, x - 1.75, 2.515, z - 1.05, .85, .024, .75).rotation.y = .16;
      this.cylinder(beige, x + 1.8, 2.78, z - 3.02, .2, .5);
      for (let i = 0; i < 3; i++) this.cylinder(black, x + 1.74 + i * .06, 3.02 + i % 2 * .1, z - 3.02, .022, .46);
      this.cylinder(frame, x, .85, z + 1.1, .1, 1.7); this.box(black, x, 1.65, z + 1.1, 2.1, .25, 1.9, .12);
      this.box(black, x, 2.55, z + 2, 2.1, 1.7, .3, .12);
      for (let i = 0; i < 5; i++) {
        const angle = i * Math.PI * .4;
        this.box(frame, x + Math.sin(angle) * .51, .24, z + 1.1 + Math.cos(angle) * .51, .13, .12, 1.13, .03).rotation.y = angle;
        this.box(black, x + Math.sin(angle), .13, z + 1.1 + Math.cos(angle), .23, .23, .2, .09);
      }
    }
    this.sign('METACORTEX', 0, 8, -32.4, 12, '#344c43', '#b5b5a5');
    this.sign('PERSONNEL / AUTHORIZED ACCESS', 0, 6.1, 32.6, 11);
    // Broad downward lobes approximate the three banks of fluorescent panels.
    // Point lights here overexpose the ceiling only one unit above the source.
    for (const z of [-17, 5, 24]) {
      const light = new THREE.SpotLight(0xdce4d4, 95, 36, 1.4, .8, 2);
      light.position.set(0, 8.65, z); light.target.position.set(0, 0, z); this.root.add(light, light.target);
    }
    const window = this.windowLight = new THREE.SpotLight(0xd0dce0, 500, 58, 1.1, .85, 2);
    window.name = 'office-window-light'; window.position.set(-25.6, 7.7, 2); window.target.position.set(4, 1.2, -3);
    this.root.add(window, window.target);
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
      const mesh = new THREE.Mesh(geometry, material); mesh.castShadow = mesh.receiveShadow = !material.transparent; this.root.add(mesh);
    }
  }
  dispose(): void {
    this.disposed = true;
    this.workday.dispose();
    this.phone?.dispose();
    this.root.traverse(object => { if (object instanceof THREE.Mesh) object.geometry.dispose(); if (object instanceof THREE.PointLight || object instanceof THREE.SpotLight) object.dispose(); });
    this.cleanerSkeletons.forEach(skeleton => skeleton.dispose());
    this.materials.forEach(m => m.dispose()); this.textures.forEach(t => t.dispose()); this.root.removeFromParent();
  }
}
