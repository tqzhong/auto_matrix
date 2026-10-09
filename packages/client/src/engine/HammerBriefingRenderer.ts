import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { HAMMER_BRIEFING, type HammerBriefing } from '@auto_matrix/shared';

/** A standing meeting in the curved hull; the wall terminal is the game's route check. */
export class HammerBriefingRenderer {
  readonly root = new THREE.Group();
  private geometries = new Set<THREE.BufferGeometry>();
  private materials = new Set<THREE.Material>();
  private textures = new Set<THREE.Texture>();
  private display?: THREE.CanvasTexture;
  private displayKey = '';
  constructor(parent: THREE.Group) {
    this.root.name = 'hammer-standing-briefing'; parent.add(this.root);
    const hull = this.mat(0x596b73, .91, .38), ribs = this.mat(0x303b41, .75, .66), steel = this.mat(0x72848a, .65, .7);
    const dark = this.mat(0x19262d, .91), floor = this.mat(0x4f5b61, .88, .42), copper = this.mat(0x686055, .9, .5);
    const grain = new Uint8Array(128 * 128 * 4);
    for (let i = 0; i < 128 * 128; i++) {
      const value = 110 + ((Math.imul(i + 19, 374761393) >>> 17) & 63);
      grain[i * 4] = grain[i * 4 + 1] = grain[i * 4 + 2] = value; grain[i * 4 + 3] = 255;
    }
    const paint = new THREE.DataTexture(grain, 128, 128, THREE.RGBAFormat); paint.name = 'hammer-painted-hull-grain';
    paint.wrapS = paint.wrapT = THREE.RepeatWrapping; paint.repeat.set(5, 3); paint.needsUpdate = true;
    hull.bumpMap = paint; hull.bumpScale = .018; this.textures.add(paint);
    this.box('briefing-floor', 18.4, .22, 24, 0, -.11, 0, floor);
    this.box('briefing-entry-floor', 4.6, .22, 8, 0, -.11, 16, floor);
    const positions: number[] = [], uv: number[] = [], indices: number[] = [];
    for (let row = 0; row <= 1; row++) for (let i = 0; i <= 48; i++) {
      const angle = i / 48 * Math.PI;
      positions.push(-Math.cos(angle) * 9.35, Math.sin(angle) * 7.2, row ? 12 : -12); uv.push(i / 48 * 2, row * 3);
      if (!row && i < 48) indices.push(i, i + 49, i + 1, i + 1, i + 49, i + 50);
    }
    const skin = new THREE.BufferGeometry(); skin.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    skin.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); skin.setIndex(indices); skin.computeVertexNormals();
    hull.side = THREE.DoubleSide; const shell = this.mesh(skin, hull); shell.name = 'curved-hammer-hull';
    for (const z of [-10.8, -5.4, 0, 5.4, 11.4]) {
      const curve = new THREE.CatmullRomCurve3(Array.from({ length: 25 }, (_, i) => new THREE.Vector3(-Math.cos(i / 24 * Math.PI) * 9.15, Math.sin(i / 24 * Math.PI) * 7.04, z)));
      const rib = this.mesh(new THREE.TubeGeometry(curve, 48, .16, 8, false), ribs); rib.name = 'curved-pressure-rib';
      for (const x of [-8.8, 8.8]) for (const y of [.6, 1.65]) {
        this.box('pressure-rib-base', .5, .38, .4, x, y, z, ribs, .05);
        const bolt = this.mesh(new THREE.CylinderGeometry(.064, .064, .07, 10), steel); bolt.rotation.z = Math.PI / 2; bolt.position.set(x + (x < 0 ? .26 : -.26), y, z);
      }
    }
    for (const [i, wall] of HAMMER_BRIEFING.walls.entries()) this.box(`briefing-bulkhead-${i}`, wall.width, wall.height, wall.depth, wall.x, wall.height / 2, wall.z, hull);
    for (const x of [-6.68, 6.68]) for (let z = -10.5; z < 12; z += 3) {
      this.box('under-curve-cabinet-seam', .035, 1.8, .045, x, 1.1, z, ribs);
      this.box('cabinet-recessed-handle', .04, .12, .52, x, 1.6, z + .8, steel, .02);
    }
    this.box('entry-corridor-ceiling', 4.6, .2, 8, 0, 7, 16, ribs);
    const hatch = this.box('sealed-aft-hatch', 3.7, 5.3, .28, 0, 3, -11.68, steel, .4);
    hatch.userData.closed = true;
    this.box('aft-hatch-inset', 3.15, 4.7, .12, 0, 3, -11.47, hull, .35);
    const wheel = this.mesh(new THREE.TorusGeometry(.6, .065, 8, 32), ribs); wheel.position.set(.7, 2.9, -11.31);
    for (let i = 0; i < 4; i++) {
      const spoke = this.box('hatch-wheel-spoke', 1.15, .055, .06, .7, 2.9, -11.31, ribs); spoke.rotation.z = i * Math.PI / 4;
    }
    for (const x of [-2.06, 2.06]) for (const y of [1.5, 4.5]) this.box('hatch-hinge', .42, .42, .38, x, y, -11.61, ribs, .05);
    for (const x of [-7.95, 7.95]) for (const y of [2.05, 3.9]) {
      const pipe = this.mesh(new THREE.CylinderGeometry(.1, .1, 23, 12), copper); pipe.rotation.x = Math.PI / 2; pipe.position.set(x, y, -.2);
      for (const z of [-8, -3, 2, 7]) this.box('pipe-clamp', .3, .32, .12, x, y, z, steel, .025);
    }
    for (const z of [-8, -1, 6]) {
      this.box('briefing-light-housing', 1.9, .16, .5, 0, 6.86, z, ribs, .04);
      const diffuser = this.mat(0xc4d4d8, .72); diffuser.emissive.setHex(0xa9c2cf); diffuser.emissiveIntensity = .8;
      this.box('briefing-light-diffuser', 1.7, .04, .34, 0, 6.74, z, diffuser);
      const light = new THREE.PointLight(0xb1cbd8, z === -1 ? 65 : 44, 17, 2); light.position.set(0, 6.2, z); this.root.add(light);
    }
    this.root.add(new THREE.HemisphereLight(0x9bafb9, 0x39342f, .88));
    const console = HAMMER_BRIEFING.console;
    this.box('hammer-route-console', console.width, console.top, console.depth, console.x, console.top / 2, console.z, ribs, .1);
    this.box('route-crt-housing', 1.4, 2.15, 3.2, console.x, 3.47, console.z, dark, .15);
    const screenMaterial = this.mat(0x8a9c92, .93); screenMaterial.emissive.setHex(0x586e66); screenMaterial.emissiveIntensity = .44;
    if (typeof document !== 'undefined') {
      const canvas = document.createElement('canvas'); canvas.width = 1024; canvas.height = 704;
      this.display = new THREE.CanvasTexture(canvas); this.display.colorSpace = THREE.SRGBColorSpace;
      this.textures.add(this.display); screenMaterial.map = this.display; screenMaterial.color.setHex(0xffffff);
    }
    const display = HAMMER_BRIEFING.screen;
    const screen = this.mesh(new THREE.PlaneGeometry(display.width, display.height), screenMaterial); screen.name = 'physical-two-ship-route-screen';
    screen.rotation.y = Math.PI / 2; screen.position.set(display.x, display.y, display.z);
    for (let i = 0; i < 5; i++) this.box('terminal-physical-key', .045, .08, .11, -6.66, 2.69, console.z - .8 + i * .4, steel, .02);
    this.box('terminal-control-shelf', .34, .12, 2.8, -6.6, 2.62, console.z, steel, .04);
    this.update();
  }
  update(state?: HammerBriefing): void {
    const accepted = Boolean(state && !['approach', 'ready', 'proposal', 'objection', 'loan'].includes(state.phase));
    const key = `${accepted}:${state?.confirmed.join(',')}`; if (!this.display || this.displayKey === key) return;
    this.displayKey = key; const ctx = (this.display.image as HTMLCanvasElement).getContext('2d'); if (!ctx) return;
    ctx.fillStyle = '#17282d'; ctx.fillRect(0, 0, 1024, 704); ctx.strokeStyle = '#344b50'; ctx.lineWidth = 1;
    for (let x = 50; x < 974; x += 48) { ctx.beginPath(); ctx.moveTo(x, 130); ctx.lineTo(x, 660); ctx.stroke(); }
    for (let y = 150; y < 660; y += 48) { ctx.beginPath(); ctx.moveTo(50, y); ctx.lineTo(974, y); ctx.stroke(); }
    ctx.fillStyle = '#c0d4ce'; ctx.font = 'bold 34px monospace'; ctx.fillText('HAMMER / NAVIGATION', 52, 73);
    ctx.font = '25px monospace'; ctx.fillText(accepted ? 'TWO SHIPS / TWO DIRECTIONS' : 'MECHANICAL LINE / ZION', 52, 113);
    const routes = accepted ? [ ['HAMMER > ZION', 'NIOBE / CREW / DEFENCE', '#a7c4d3', 290], ['LOGOS > MACHINE CITY', 'NEO / TRINITY / NO AMMO', '#c3b39b', 535] ] as const
      : [ ['HAMMER > ZION', 'MECHANICAL LINE / RETURN', '#a7c4d3', 290] ] as const;
    for (const [label, crew, color, y] of routes) {
      ctx.strokeStyle = color; ctx.lineWidth = 7; ctx.beginPath(); ctx.moveTo(70, y); ctx.lineTo(280, y); ctx.lineTo(370, y - 65); ctx.lineTo(930, y - 65); ctx.stroke();
      ctx.fillStyle = color; ctx.font = 'bold 31px monospace'; ctx.fillText(label, 400, y - 95); ctx.font = '23px monospace'; ctx.fillText(crew, 400, y - 20);
    }
    ctx.fillStyle = '#d4d9ca'; ctx.font = '23px monospace'; ctx.fillText(`VERIFIED: ${state?.confirmed.length ?? 0} / 2`, 52, 662);
    this.display.needsUpdate = true;
  }
  private mat(color: number, roughness: number, metalness = 0) { const material = new THREE.MeshStandardMaterial({ color, roughness, metalness }); this.materials.add(material); return material; }
  private mesh(geometry: THREE.BufferGeometry, material: THREE.Material) {
    this.geometries.add(geometry); const mesh = new THREE.Mesh(geometry, material); mesh.castShadow = mesh.receiveShadow = true; this.root.add(mesh); return mesh;
  }
  private box(name: string, w: number, h: number, d: number, x: number, y: number, z: number, material: THREE.Material, radius = 0) {
    const mesh = this.mesh(radius ? new RoundedBoxGeometry(w, h, d, 2, radius) : new THREE.BoxGeometry(w, h, d), material); mesh.name = name; mesh.position.set(x, y, z); return mesh;
  }
  dispose(): void { this.root.removeFromParent(); this.geometries.forEach(item => item.dispose()); this.materials.forEach(item => item.dispose()); this.textures.forEach(item => item.dispose()); }
}
