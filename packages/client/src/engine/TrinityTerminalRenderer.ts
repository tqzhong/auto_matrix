import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { TRINITY_TERMINAL, type TrinityTerminal } from '@auto_matrix/shared';
import { batchStaticGeometry } from './StaticGeometry.js';

/** A computer control room, rather than another hall of transformer banks. */
export class TrinityTerminalRenderer {
  readonly group = new THREE.Group();
  private static = new THREE.Group();
  private geometries = new Set<THREE.BufferGeometry>();
  private materials = new Set<THREE.Material>();
  private textures = new Set<THREE.Texture>();
  private lamps: THREE.PointLight[] = [];
  private screen?: THREE.CanvasTexture;
  private signature = '';
  private disposed = false;
  constructor(root: THREE.Group) {
    this.group.name = 'trinity-grid-control-room'; root.add(this.group); this.group.add(this.static);
    const wall = this.surface('white_plaster_02', 0x7d8981, 4), metal = this.surface('metal_plate', 0x727a76, 2);
    const floor = this.surface('marble_01', 0x6e7771, 12), dark = this.material(0x242c28, .72), plastic = this.material(0x929d91, .5);
    this.box(floor, 0, -.15, 0, 28, .3, 42, 'terminal-floor');
    for (const [i, side] of TRINITY_TERMINAL.walls.entries()) {
      this.box(wall, side.x, side.height / 2, side.z, side.width, side.height, side.depth, `terminal-wall-${i}`);
    }
    this.box(wall, 0, 8, 0, 28, .2, 42);
    for (const z of [-20.55, 20.55]) this.box(metal, 0, .25, z, 27.4, .5, .12);
    for (const x of [-13.55, 13.55]) this.box(metal, x, .25, 0, .12, .5, 41);
    const desks = [TRINITY_TERMINAL.desk, ...TRINITY_TERMINAL.desks];
    for (const [i, desk] of desks.entries()) {
      this.box(metal, desk.x, desk.height - .12, desk.z, desk.width, .24, desk.depth, `terminal-desk-${i}`);
      for (const side of [-1, 1]) this.box(dark, desk.x + side * (desk.width / 2 - .45), desk.height / 2 - .1, desk.z, .24, desk.height - .2, desk.depth - .2);
      if (i) {
        this.box(plastic, desk.x, desk.height + .64, desk.z - .2, 1.7, 1.3, 1.35);
        this.box(dark, desk.x, desk.height + .68, desk.z + .49, 1.35, .94, .015);
        this.box(dark, desk.x, desk.height + .035, desk.z + .6, 1.4, .07, .4);
      }
    }
    // Backlit glass partitions, cable trays and fluorescent ceiling strips.
    for (const x of [-13.68, 13.68]) for (const z of [-13, 0, 12]) {
      const glass = new THREE.MeshStandardMaterial({ color: 0x75887c, roughness: .3, metalness: .12, transparent: true, opacity: .35 }); this.materials.add(glass);
      this.box(glass, x, 4.4, z, .025, 3.8, 6.5);
      for (const y of [2.45, 6.35]) this.box(metal, x + Math.sign(x) * -.07, y, z, .16, .12, 6.65);
      for (const dz of [-3.3, 0, 3.3]) this.box(metal, x + Math.sign(x) * -.07, 4.4, z + dz, .16, 4, .12);
    }
    const glow = new THREE.MeshBasicMaterial({ color: 0xcddbd0, toneMapped: false }); this.materials.add(glow);
    for (const z of [-13, 0, 12]) {
      this.box(metal, 0, 7.55, z, 9, .22, 1.1);
      for (const x of [-2.3, 2.3]) this.box(glow, x, 7.39, z, 4, .09, .24);
      const lamp = new THREE.PointLight(0xd1ded1, 220, 24, 2); lamp.position.set(0, 6.9, z); this.lamps.push(lamp); this.group.add(lamp);
    }
    const p = TRINITY_TERMINAL.screen;
    this.box(dark, p.x, TRINITY_TERMINAL.desk.height + .065, p.z - .4, 1.7, .13, 1.3);
    const caseGeometry = new RoundedBoxGeometry(p.width + .32, p.height + .28, 1.6, 3, .1); this.geometries.add(caseGeometry);
    const casing = new THREE.Mesh(caseGeometry, plastic); casing.name = 'terminal-crt-casing'; casing.position.set(p.x, p.y, p.z - .83); this.static.add(casing);
    this.box(dark, p.x, p.y, p.z - .031, p.width + .2, p.height + .2, .08, 'terminal-crt-bezel');
    const canvas = typeof document === 'undefined' ? undefined : document.createElement('canvas');
    if (canvas) { canvas.width = 960; canvas.height = 680; this.screen = new THREE.CanvasTexture(canvas); this.screen.colorSpace = THREE.SRGBColorSpace; this.textures.add(this.screen); }
    const display = new THREE.MeshBasicMaterial({ color: this.screen ? 0xffffff : 0x0c2414, map: this.screen, toneMapped: false }); this.materials.add(display);
    this.box(display, p.x, p.y, p.z + .021, p.width, p.height, .018, 'terminal-screen');
    this.box(plastic, 2.2, 2.67, -14.1, 1.15, 1, 1.55, 'terminal-computer');
    this.box(dark, 2.2, 2.87, -13.31, .85, .1, .01);
    this.box(glow, 2.46, 2.48, -13.31, .05, .05, .012);
    const keyboard = TRINITY_TERMINAL.keyboard;
    this.box(plastic, keyboard.x, keyboard.y - .045, keyboard.z, keyboard.width, .09, keyboard.depth, 'terminal-keyboard');
    const keyGeometry = new THREE.BoxGeometry(.102, .036, .09); this.geometries.add(keyGeometry);
    const keys = new THREE.InstancedMesh(keyGeometry, dark, 72); keys.name = 'terminal-keys';
    const transform = new THREE.Matrix4();
    for (let row = 0; row < 4; row++) for (let column = 0; column < 18; column++) {
      transform.makeTranslation(keyboard.x - .9 + column * .105, keyboard.y + .018, keyboard.z - .225 + row * .135); keys.setMatrixAt(row * 18 + column, transform);
    }
    this.group.add(keys);
    batchStaticGeometry(this.static, new Set()).forEach(geometry => this.geometries.add(geometry)); this.update();
  }
  private material(color: number, roughness: number): THREE.MeshStandardMaterial {
    const material = new THREE.MeshStandardMaterial({ color, roughness }); this.materials.add(material); return material;
  }
  private surface(name: string, color: number, repeat: number): THREE.MeshStandardMaterial {
    const material = this.material(color, .82);
    if (typeof document === 'undefined') return material;
    for (const [suffix, slot] of [['color', 'map'], ['normal', 'normalMap'], ['roughness', 'roughnessMap']] as const) {
      const texture = new THREE.TextureLoader().load(`/assets/film-materials/${name}-${suffix}.jpg`, value => { if (this.disposed) value.dispose(); });
      texture.wrapS = texture.wrapT = THREE.RepeatWrapping; texture.repeat.set(repeat, repeat); if (slot === 'map') texture.colorSpace = THREE.SRGBColorSpace;
      this.textures.add(texture); material[slot] = texture;
    }
    material.normalScale.set(.25, .25); return material;
  }
  private box(material: THREE.Material, x: number, y: number, z: number, width: number, height: number, depth: number, name = ''): THREE.Mesh {
    const geometry = new THREE.BoxGeometry(width, height, depth); this.geometries.add(geometry);
    const mesh = new THREE.Mesh(geometry, material); mesh.position.set(x, y, z); mesh.name = name; mesh.receiveShadow = true; this.static.add(mesh); return mesh;
  }
  update(state?: TrinityTerminal, power = true): void {
    for (const lamp of this.lamps) lamp.intensity = power ? 220 : 18;
    const signature = `${state?.phase}:${Math.floor((state?.elapsed ?? 0) * 8)}:${state?.selected}:${state?.paused}:${state?.unavailable}`;
    if (!this.screen || this.signature === signature) return; this.signature = signature;
    const ctx = (this.screen.image as HTMLCanvasElement).getContext('2d')!;
    ctx.fillStyle = '#04100a'; ctx.fillRect(0, 0, 960, 680); ctx.fillStyle = '#80cc96'; ctx.font = '27px monospace';
    const phase = state?.phase ?? 'ready', lines = ['EMERGENCY ROUTE CONTROL', 'LOCAL CONSOLE / ACCESS REQUIRED', ''];
    if (phase === 'ready') lines.push('> CHECK LOCAL SERVICES');
    if (phase === 'scanning') lines.push('> DISCOVERING SERVICES ...', `[ ${Math.round((state?.elapsed ?? 0) / 3 * 100)}% ]`);
    if (['selecting', 'typing', 'armed', 'deployed', 'failed'].includes(phase)) for (const node of TRINITY_TERMINAL.nodes) lines.push(`${node.address}  ${node.port}  ${node.service}`);
    if (phase === 'typing') lines.push('', '> LOCAL OVERRIDE BUFFER', 'ROUTE PATCH  '.repeat(5).slice(0, Math.floor((state?.elapsed ?? 0) / 4 * 60)) + '_');
    if (phase === 'armed') lines.push('', '> BUFFER READY', '> AWAITING EXPLICIT SUBMIT _');
    if (phase === 'deployed') lines.push('', '> OVERRIDE SUBMITTED', '> WAITING FOR CORRIDOR SIGNAL');
    if (phase === 'failed') lines.push('', '> SERVICE HAS NO ROUTE PRIVILEGES', '> LOCAL ACCESS REJECTED');
    if (state?.paused || state?.unavailable) lines.push('', '> OPERATOR LINK UNAVAILABLE');
    for (const [i, line] of lines.entries()) ctx.fillText(line, 38, 54 + i * 46);
    this.screen.needsUpdate = true;
  }
  dispose(): void {
    this.disposed = true; this.group.removeFromParent(); this.lamps.forEach(light => light.dispose());
    this.geometries.forEach(geometry => geometry.dispose()); this.materials.forEach(material => material.dispose()); this.textures.forEach(texture => texture.dispose());
  }
}
