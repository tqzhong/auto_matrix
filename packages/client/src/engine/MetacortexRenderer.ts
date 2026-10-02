import * as THREE from 'three';
import { METACORTEX, METACORTEX_LOBBY, OFFICE_CUSTODY_CAR, metacortexLiftPose, type MetacortexLift, type OfficeCustody } from '@auto_matrix/shared';
import { batchStaticGeometry } from './StaticGeometry.js';
import { CustodyStreetRenderer } from './CustodyStreetRenderer.js';

/** Lobby and moving car stay in the city while the office is streamed above. */
export class MetacortexRenderer {
  private root = new THREE.Group();
  private car = new THREE.Group();
  private lobbyButton!: THREE.Mesh;
  private doors: { mesh: THREE.Mesh; side: number; floor?: number }[] = [];
  private geometry = new THREE.BoxGeometry(1, 1, 1);
  private materials = new Map<number, THREE.MeshStandardMaterial>();
  private textures: THREE.Texture[] = [];
  private displays: { canvas: HTMLCanvasElement; texture: THREE.CanvasTexture }[] = [];
  private lights: THREE.PointLight[] = [];
  private display = '';
  private street?: CustodyStreetRenderer;
  constructor(parent: THREE.Group) {
    this.root.name = 'metacortex-city-lobby'; parent.add(this.root);
    const stone = 0xc9c5b5, metal = 0x686e69, dark = 0x303a36, brass = 0x9e8d5e;
    this.box(this.root, 0, -.15, 0, 54, .3, 66, 0x8f948e);
    for (let x = -24; x <= 24; x += 6) this.box(this.root, x, .012, 0, .045, .016, 66, 0x606c65);
    for (let z = -30; z <= 30; z += 6) this.box(this.root, 0, .014, z, 54, .016, .045, 0x606c65);
    for (const side of [-1, 1]) {
      this.box(this.root, side * 27, 5, 0, .6, 10, 66, stone);
      this.box(this.root, side * 16, 5, 33, 22, 10, .4, 0x738d90);
      this.box(this.root, side * 5.1, 4.6, 33, .18, 9.2, .6, metal);
      this.box(this.root, side * 18, 5, 32.7, .2, 10, .2, metal);
      this.box(this.root, side * 26.6, .4, 0, .16, .8, 66, dark);
      this.box(this.root, side * 15.25, 9.7, 0, 23.5, .5, 66, stone);
      this.box(this.root, side * 12, 9.35, 1, .28, .12, 60, 0xe8ddbd);
      for (const z of [-18, 5, 24]) this.box(this.root, side * 24.5, 5, z, 1.2, 10, 1.2, stone);
    }
    this.box(this.root, 0, 5, -33, 54, 10, .5, stone);
    this.box(this.root, 0, 9.7, 3.7, 7, .5, 58.6, stone);
    this.box(this.root, 0, 9.6, 33, 10, .8, .5, stone);
    this.box(this.root, 0, .025, 29, 9.5, .02, 6, dark);
    this.box(this.root, 0, 8.4, 34, 18, .4, 3.5, dark);
    this.label(this.root, 'METACORTEX', 0, 7.3, 34.8, 13);
    for (const prop of METACORTEX_LOBBY.slice(3)) {
      this.box(this.root, prop.x, prop.height / 2, prop.z, prop.width, prop.height, prop.depth, prop.x === -13 ? stone : dark);
      this.box(this.root, prop.x, prop.height, prop.z, prop.width + .1, .13, prop.depth + .1, prop.x === -13 ? dark : 0x596159);
    }
    this.label(this.root, 'RECEPTION', -13, 1.8, 14.83, 6);
    this.box(this.root, -14, 3.8, 12.6, 2.4, 1.5, 1.6, 0xaaa997);
    this.box(this.root, -11, 3.2, 13.6, 1.5, .1, 1, 0xe1ddd0);
    this.label(this.root, 'DEVELOPMENT  /  8', 0, 8.4, -25.48, 12);
    this.label(this.root, 'STAFF ELEVATOR', 0, 6.7, -25.48, 7);
    // Separate landing doors protect the empty shaft; the car doors travel with it.
    for (const floor of [0, 1]) {
      const y = floor * METACORTEX.upper;
      for (const side of [-1, 1]) {
        this.box(this.root, side * 3.2, y + 4, -29, .4, 8, 6.8, metal);
        this.box(this.root, side * 3.6, y + 3.6, METACORTEX.doorZ, .35, 7.2, .65, brass);
        const mesh = this.box(this.root, side * 1.5, y + 3.4, METACORTEX.doorZ, 3, 6.8, .12, metal);
        mesh.name = `metacortex-landing-${floor}-${side}`; this.doors.push({ mesh, side, floor });
      }
      this.box(this.root, 0, y + 7, METACORTEX.doorZ, 7.5, .25, .7, brass);
      this.box(this.root, 4.2, y + 3.2, -25.5, .7, 1.1, .18, dark);
      this.box(this.root, 4.2, y + 3.3, -25.36, .22, .22, .05, 0xc5b783);
      this.label(this.root, '', 0, y + 7.7, -25.4, 2.3, true);
    }
    this.car.name = 'metacortex-elevator-car'; this.root.add(this.car);
    this.box(this.car, 0, -.13, -29, 6, .26, 6.4, dark);
    this.box(this.car, 0, 7.3, -29, 6, .3, 6.4, metal);
    this.box(this.car, 0, 3.6, -32.05, 6, 7.2, .18, metal);
    this.box(this.car, 0, 3.5, -31.93, 4.5, 3.2, .04, 0x96a6a0);
    this.label(this.car, 'METACORTEX', 0, 5.7, -31.8, 4.4);
    for (const side of [-1, 1]) {
      this.box(this.car, side * 2.98, 3.6, -29, .14, 7.2, 6.2, metal);
      this.box(this.car, side * 2.8, 2.5, -29, .1, .15, 4.8, brass);
      const door = this.box(this.car, side * 1.5, 3.4, -26, 3, 6.8, .1, metal);
      this.doors.push({ mesh: door, side });
    }
    this.box(this.car, 0, 7.1, -29, 4.8, .12, 4.8, 0xece1c7);
    const button = OFFICE_CUSTODY_CAR.button;
    this.box(this.car, 2.92, button.y, button.z, .2, 1.2, .65, dark);
    this.lobbyButton = this.box(this.car, button.x + .02, button.y, button.z, .04, .24, .24, 0xc5b783);
    this.lobbyButton.name = 'metacortex-lobby-button';
    this.label(this.car, 'G  /  LOBBY - DEVELOPMENT', 0, 1.3, -31.8, 4.8);
    for (const [parent, y, z, power, range] of [[this.root, 8, 15, 200, 40], [this.root, 8, -15, 190, 38], [this.car, 6.7, -29, 55, 10]] as const) {
      const light = new THREE.PointLight(0xffefcf, power, range, 2); light.position.set(0, y, z); parent.add(light); this.lights.push(light);
    }
    batchStaticGeometry(this.root, new Set([...this.doors.map(door => door.mesh), this.lobbyButton]));
    this.update(undefined);
  }
  private box(parent: THREE.Group, x: number, y: number, z: number, w: number, h: number, d: number, color: number): THREE.Mesh {
    if (!this.materials.has(color)) this.materials.set(color, new THREE.MeshStandardMaterial({ color, roughness: color === 0x686e69 ? .34 : .72, metalness: color === 0x686e69 ? .65 : .12 }));
    const mesh = new THREE.Mesh(this.geometry, this.materials.get(color)); mesh.position.set(x, y, z); mesh.scale.set(w, h, d); mesh.castShadow = mesh.receiveShadow = true; parent.add(mesh); return mesh;
  }
  private label(parent: THREE.Group, text: string, x: number, y: number, z: number, width: number, display = false): void {
    const canvas = document.createElement('canvas'); canvas.width = 768; canvas.height = 96;
    const ctx = canvas.getContext('2d')!; ctx.fillStyle = '#24302c'; ctx.fillRect(0, 0, 768, 96); ctx.fillStyle = '#d7d8bd'; ctx.font = '34px monospace'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(text, 384, 48);
    const texture = new THREE.CanvasTexture(canvas); texture.colorSpace = THREE.SRGBColorSpace; this.textures.push(texture);
    const material = new THREE.MeshStandardMaterial({ map: texture, roughness: .65, emissiveMap: texture, emissive: 0xffffff, emissiveIntensity: display ? .5 : .12 });
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(width, display ? .7 : width / 8), material); mesh.position.set(x, y, z); parent.add(mesh);
    if (display) this.displays.push({ canvas, texture });
  }
  update(lift?: MetacortexLift, nearby = false, custody?: OfficeCustody, subject?: THREE.Object3D): void {
    if (custody?.lift && !this.street) this.street = new CustodyStreetRenderer(this.root);
    if (!custody && this.street) { this.street.dispose(); this.street = undefined; }
    this.street?.update(custody, subject);
    const pose = metacortexLiftPose(lift); this.car.position.y = pose.height;
    const pressing = custody?.phase === 'selecting' && (custody.transportElapsed ?? 0) >= .65 && (custody.transportElapsed ?? 0) <= 1.1;
    this.lobbyButton.position.x = OFFICE_CUSTODY_CAR.button.x + .02 + (pressing ? .015 : 0);
    for (const door of this.doors) {
      const open = door.floor === undefined || Math.abs(pose.height - door.floor * METACORTEX.upper) < .01 ? pose.door : 0;
      door.mesh.position.x = door.side * (1.5 + open * 3.1);
    }
    const text = `${lift?.phase === 'travel' ? lift.target ? 'UP' : 'DOWN' : 'FLOOR'}  ${pose.height < .1 ? 'G' : String(Math.max(1, Math.round(pose.height / METACORTEX.upper * 7) + 1)).padStart(2, '0')}`;
    if (text !== this.display) {
      this.display = text;
      for (const { canvas, texture } of this.displays) {
        const ctx = canvas.getContext('2d')!; ctx.fillStyle = '#152621'; ctx.fillRect(0, 0, 768, 96); ctx.fillStyle = '#d7dfbf'; ctx.font = '60px monospace'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(text, 384, 48); texture.needsUpdate = true;
      }
    }
    this.lights.forEach(light => { light.visible = nearby; });
  }
  dispose(): void {
    this.street?.dispose();
    this.root.traverse(object => { if (object instanceof THREE.Mesh && object.geometry !== this.geometry) {
      object.geometry.dispose();
      if (![...this.materials.values()].includes(object.material as THREE.MeshStandardMaterial)) (object.material as THREE.Material).dispose();
    } });
    this.geometry.dispose(); this.materials.forEach(material => material.dispose()); this.textures.forEach(texture => texture.dispose()); this.lights.forEach(light => light.dispose()); this.root.removeFromParent();
  }
}
