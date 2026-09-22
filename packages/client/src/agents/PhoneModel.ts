import * as THREE from 'three';

/** Curved 1996 handset with the film prop's sliding microphone cover. */
export class PhoneModel {
  readonly root = new THREE.Group();
  private slider = new THREE.Group();
  private materials: THREE.Material[] = [];
  private maps: THREE.Texture[] = [];
  private screen: THREE.Mesh;
  private screens: THREE.Texture[];
  constructor() {
    const shell = this.mat(0x1a1e20, .46); const seam = this.mat(0x050708, .8); const rubber = this.mat(0x454b4b, .85);
    const body = this.rounded(.142, .424, .026, .052); this.mesh(this.root, body, shell);
    const back = this.rounded(.144, .418, .025, .008); this.mesh(this.root, back, seam).position.z = -.03;
    for (let i = -2; i <= 2; i++) this.mesh(this.root, new THREE.BoxGeometry(.039, .003, .003), seam).position.set(0, .175 + i * .008, .04);
    this.mesh(this.root, new THREE.BoxGeometry(.108, .104, .008), seam).position.set(0, .085, .044);
    this.screens = ['INCOMING', 'CONNECTED'].map(label => {
      const canvas = document.createElement('canvas'); canvas.width = 256; canvas.height = 160;
      const ctx = canvas.getContext('2d')!; ctx.fillStyle = '#94a67c'; ctx.fillRect(0, 0, 256, 160); ctx.fillStyle = '#27362e';
      for (let i = 0; i < 4; i++) ctx.fillRect(14 + i * 8, 31 - i * 6, 5, 8 + i * 6);
      ctx.strokeRect(212, 14, 29, 15); ctx.fillRect(215, 17, 22, 9);
      ctx.textAlign = 'center'; ctx.font = '18px monospace'; ctx.fillText(label, 128, 64);
      ctx.font = 'bold 32px monospace'; ctx.fillText('CALL', 128, 105);
      ctx.font = '16px monospace'; ctx.fillText(label === 'INCOMING' ? '--------' : '00:01', 128, 141);
      return this.texture(canvas);
    });
    const lcd = new THREE.MeshStandardMaterial({ map: this.screens[0], roughness: .28, emissive: 0x879872, emissiveIntensity: .18 }); this.materials.push(lcd);
    this.screen = this.mesh(this.root, new THREE.PlaneGeometry(.095, .085), lcd); this.screen.name = 'phone-lcd'; this.screen.position.set(0, .085, .05);
    const keys = document.createElement('canvas'); keys.width = 192; keys.height = 256;
    const ctx = keys.getContext('2d')!; ctx.fillStyle = '#d2d6ca'; ctx.font = '23px monospace'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    const symbols = '123456789*0#';
    for (let row = 0; row < 4; row++) for (let col = 0; col < 3; col++) {
      this.mesh(this.root, this.rounded(.032, .025, .006, .006), rubber).position.set((col - 1) * .04, -.013 - row * .038, .042);
      ctx.fillText(symbols[row * 3 + col], 32 + col * 64, 32 + row * 64);
    }
    const ink = new THREE.MeshStandardMaterial({ map: this.texture(keys), transparent: true, roughness: .8 }); this.materials.push(ink);
    const keypad = this.mesh(this.root, new THREE.PlaneGeometry(.12, .152), ink); keypad.name = 'phone-keypad'; keypad.position.set(0, -.07, .053);
    this.root.add(this.slider); this.slider.position.y = -.102;
    this.mesh(this.slider, this.rounded(.149, .218, .026, .016), shell).position.z = .061;
    for (let i = -1; i <= 1; i++) this.mesh(this.slider, new THREE.BoxGeometry(.036, .002, .004), seam).position.set(0, -.065 + i * .008, .077);
    const aerial = this.mesh(this.root, new THREE.CylinderGeometry(.012, .017, .082, 12), shell); aerial.position.set(.047, .237, -.008);
    this.root.name = 'held-phone';
  }
  private texture(canvas: HTMLCanvasElement): THREE.Texture {
    const texture = new THREE.CanvasTexture(canvas); texture.colorSpace = THREE.SRGBColorSpace; this.maps.push(texture); return texture;
  }
  private mat(color: number, roughness: number): THREE.MeshStandardMaterial {
    const material = new THREE.MeshStandardMaterial({ color, roughness }); this.materials.push(material); return material;
  }
  private rounded(w: number, h: number, r: number, depth: number): THREE.BufferGeometry {
    const s = new THREE.Shape(); const x = -w / 2; const y = -h / 2;
    s.moveTo(x + r, y); s.lineTo(x + w - r, y); s.quadraticCurveTo(x + w, y, x + w, y + r);
    s.lineTo(x + w, y + h - r); s.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    s.lineTo(x + r, y + h); s.quadraticCurveTo(x, y + h, x, y + h - r); s.lineTo(x, y + r); s.quadraticCurveTo(x, y, x + r, y);
    const geometry = new THREE.ExtrudeGeometry(s, { depth, bevelEnabled: true, bevelSize: .0025, bevelThickness: .0025, bevelSegments: 2, curveSegments: 8 });
    geometry.translate(0, 0, -depth / 2);
    const p = geometry.attributes.position;
    for (let i = 0; i < p.count; i++) p.setZ(i, p.getZ(i) + p.getY(i) ** 2 * .23);
    geometry.computeVertexNormals(); return geometry;
  }
  private mesh(parent: THREE.Object3D, geometry: THREE.BufferGeometry, material: THREE.Material): THREE.Mesh {
    const mesh = new THREE.Mesh(geometry, material); mesh.castShadow = mesh.receiveShadow = true; parent.add(mesh); return mesh;
  }
  update(slide: number): void {
    this.slider.position.y = -.102 - THREE.MathUtils.clamp(slide, 0, 1) * .15;
    (this.screen.material as THREE.MeshStandardMaterial).map = this.screens[slide > .5 ? 1 : 0];
  }
  dispose(): void {
    this.root.traverse(o => { if (o instanceof THREE.Mesh) o.geometry.dispose(); });
    this.materials.forEach(m => m.dispose()); this.maps.forEach(m => m.dispose()); this.root.removeFromParent();
  }
}
