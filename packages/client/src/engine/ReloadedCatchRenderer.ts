import * as THREE from 'three';
import { CATCH, newCatch, type FilmJourney } from '@auto_matrix/shared';

/** A continuous street canyon below Trinity's window and the rooftop where Neo revives her. */
export class ReloadedCatchRenderer {
  readonly group = new THREE.Group();
  private geometries = new Set<THREE.BufferGeometry>();
  private materials = new Set<THREE.Material>();
  private lights = new Set<THREE.Light>();
  private shards = new THREE.Group();
  private bullet = new THREE.Group();
  private pulse = new THREE.Group();
  private pulseRing: THREE.Mesh;
  private pulseLight: THREE.PointLight;
  private fire: THREE.PointLight;

  constructor(root: THREE.Group) {
    this.group.name = 'reloaded-catch-set'; root.add(this.group);
    const stone = this.mat(0x596662, .88), dark = this.mat(0x35484a, .82), trim = this.mat(0x9ca9a1, .54, .52);
    const glass = this.mat(0x6c8786, .23, .38), roof = this.mat(0x465253, .92), road = this.mat(0x273335, .88);
    const warm = this.mat(0xffd6a0, .22, .02, 0xf4ac62, 1.8);
    this.box(road, 0, CATCH.roadY - .35, -5, 145, .7, 135, 'catch-city-road');
    const car = this.mat(0x141f22, .35, .34), bumper = this.mat(0x758385, .32, .7), tail = new THREE.MeshBasicMaterial({ color: 0xd87965 }); this.materials.add(tail);
    this.box(car, 4, CATCH.roadY + .78, -29, 3.5, 1.35, 7, 'catch-johnson-car');
    this.box(car, 4, CATCH.roadY + 1.65, -29.5, 3, .8, 3.8);
    for (const x of [2.35, 5.65]) { this.box(bumper, x, CATCH.roadY + .38, -32.5, .28, .32, 1.1); this.box(tail, x, CATCH.roadY + 1.05, -25.45, .7, .22, .06); }
    const lane = this.mat(0xb7a77e, .7, 0, 0x5f634f, .2);
    for (let x = -10; x <= 10; x += 5) for (let z = -56; z <= 44; z += 13) this.box(lane, x, CATCH.roadY + .03, z, .18, .02, 3.7);
    // The center tower is the navigable obstruction used by the flight simulation.
    this.tower(0, 2, 7, 14, 110, dark, trim, 'catch-center-tower');
    this.tower(0, -15, 26, 20, 75, stone, trim, 'catch-trinity-tower');
    this.tower(0, 52, 29, 16, 115, dark, trim, 'catch-architect-exit-tower');
    for (const [x, z, w, d, h] of [[-36, 18, 21, 25, 95], [34, 10, 20, 28, 108], [-36, -37, 25, 22, 88], [36, -42, 27, 20, 98], [-64, 38, 25, 32, 72], [65, -18, 29, 28, 100]])
      this.tower(x, z, w, d, h, x < 0 ? stone : dark, trim, 'catch-skyline');
    this.windows();
    const amberStrip = new THREE.MeshBasicMaterial({ color: 0xd0b47e, toneMapped: false }); this.materials.add(amberStrip);
    for (const x of [-24.8, 24]) for (const y of [-20, 8, 31]) this.box(amberStrip, x, y, -10, .1, .13, 86, 'catch-street-light-line');
    const guide = new THREE.MeshBasicMaterial({ color: 0x8fb8ad, transparent: true, opacity: .42, depthWrite: false }); this.materials.add(guide);
    for (let z = 17; z >= -15; z -= 11) {
      const ring = this.mesh(new THREE.TorusGeometry(2.6, .06, 8, 48), guide, 'catch-flight-guide');
      ring.position.set(-8.5, 2 - Math.max(0, 17 - z) * .45, z); ring.rotation.x = Math.PI / 2;
    }
    // The fall occurs in front of this roof; it later becomes the rescue surface.
    this.box(roof, 0, -.27, -15, 26.2, .55, 20.2, 'catch-rescue-roof');
    for (const x of [-12.5, 12.5]) this.box(stone, x, .72, -15, .55, 1.45, 20);
    this.box(stone, 0, .7, -5.25, 26, 1.4, .55);
    for (const x of [-8, 8]) { this.box(trim, x, 1.25, -9, 2.7, 2.5, 3.2); this.box(dark, x, 2.6, -9, 3.2, .25, 3.7); }
    this.box(glass, CATCH.trinity.x, -2.7, -24.95, 5.1, 6.5, .08, 'catch-broken-window');
    for (const x of [-11.05, -5.95]) this.box(trim, x, -2.7, -25.02, .12, 6.8, .18);
    this.box(trim, CATCH.trinity.x, .7, -25.02, 5.3, .12, .18);
    this.box(warm, 0, 18, 43.65, 5.4, 8, .1, 'catch-burning-exit');
    this.fire = new THREE.PointLight(0xff8b43, 145, 28, 2); this.fire.position.set(0, 17, 43); this.group.add(this.fire); this.lights.add(this.fire);
    for (let i = 0; i < 40; i++) {
      const shard = this.mesh(new THREE.TetrahedronGeometry(.12 + (i % 5) * .055), glass, `catch-shard-${i}`, this.shards);
      shard.userData.index = i;
    }
    this.group.add(this.shards);
    const bulletMetal = this.mat(0xcacfac, .23, .83, 0x7ba179, 1.4);
    const round = this.mesh(new THREE.CylinderGeometry(.09, .07, .42, 12), bulletMetal, 'catch-extracted-bullet', this.bullet); round.rotation.x = Math.PI / 2;
    const code = this.mat(0x9fe2aa, .2, .1, 0x6fea98, 2.2);
    for (let i = 0; i < 7; i++) { const mote = this.mesh(new THREE.BoxGeometry(.06, .16 + i % 3 * .07, .06), code, `catch-code-${i}`, this.bullet); mote.position.set(Math.sin(i * 2.4) * .7, Math.cos(i * 1.7) * .45, Math.cos(i * 2.4) * .7); }
    this.bullet.position.set(-1.7, .95, -19.2); this.group.add(this.bullet);
    const pulseMat = this.mat(0xa5ffd0, .18, 0, 0x68ffb0, 1.4);
    this.pulseRing = this.mesh(new THREE.TorusGeometry(1, .08, 10, 56), pulseMat, 'catch-heart-pulse', this.pulse); this.pulseRing.rotation.x = -Math.PI / 2;
    const center = this.mesh(new THREE.TorusGeometry(.65, .025, 8, 48), this.mat(0xe6dec2, .3, 0, 0x9ce7b1, 1.4), 'catch-pulse-target', this.pulse); center.rotation.x = -Math.PI / 2;
    this.pulse.position.set(-1.7, .75, -19.3); this.group.add(this.pulse);
    this.pulseLight = new THREE.PointLight(0x80ffb0, 0, 9, 2); this.pulseLight.position.copy(this.pulse.position); this.group.add(this.pulseLight); this.lights.add(this.pulseLight);
    const street = new THREE.PointLight(0xd6dbc0, 280, 110, 2); street.position.set(-22, 21, -32); this.group.add(street); this.lights.add(street);
    const fill = new THREE.PointLight(0x7bafc1, 190, 90, 2); fill.position.set(26, 3, 18); this.group.add(fill); this.lights.add(fill);
  }

  private mat(color: number, roughness = .8, metalness = .05, emissive = 0, intensity = 0): THREE.MeshStandardMaterial {
    const material = new THREE.MeshStandardMaterial({ color, roughness, metalness, emissive, emissiveIntensity: intensity }); this.materials.add(material); return material;
  }
  private mesh(geometry: THREE.BufferGeometry, material: THREE.Material, name: string, parent: THREE.Object3D = this.group): THREE.Mesh {
    const mesh = new THREE.Mesh(geometry, material); mesh.name = name; mesh.castShadow = mesh.receiveShadow = true; parent.add(mesh); this.geometries.add(geometry); return mesh;
  }
  private box(material: THREE.Material, x: number, y: number, z: number, w: number, h: number, d: number, name = ''): THREE.Mesh {
    const mesh = this.mesh(new THREE.BoxGeometry(w, h, d), material, name); mesh.position.set(x, y, z); return mesh;
  }
  private tower(x: number, z: number, w: number, d: number, h: number, wall: THREE.Material, trim: THREE.Material, name: string): void {
    this.box(wall, x, CATCH.roadY + h / 2, z, w, h, d, name);
    for (let y = CATCH.roadY + 8; y < CATCH.roadY + h; y += 12) this.box(trim, x, y, z - d / 2 - .09, w + .15, .13, .17);
    this.box(trim, x, CATCH.roadY + h + .2, z, w + .6, .38, d + .6);
  }
  private windows(): void {
    const geometry = new THREE.PlaneGeometry(1.5, 2.35); this.geometries.add(geometry);
    const material = new THREE.MeshBasicMaterial({ color: 0xffffff, side: THREE.FrontSide, toneMapped: false }); this.materials.add(material);
    const buildings = [[0, 2, 7, 14, 110], [0, -15, 26, 20, 75], [0, 52, 29, 16, 115], [-36, 18, 21, 25, 95], [34, 10, 20, 28, 108], [-36, -37, 25, 22, 88], [36, -42, 27, 20, 98], [-64, 38, 25, 32, 72], [65, -18, 29, 28, 100]];
    const panes: { x: number; y: number; z: number; yaw: number; color: number }[] = [];
    for (let b = 0; b < buildings.length; b++) {
      const [x, z, w, d, h] = buildings[b];
      for (let y = CATCH.roadY + 7; y < CATCH.roadY + h - 2; y += 4.2)
        for (let face = 0; face < 4; face++) {
          const span = face < 2 ? w : d;
          for (let offset = -span / 2 + 2.3; offset < span / 2 - 1; offset += 3.1) {
            const lit = Math.abs((Math.floor(y) * 17 + Math.floor(offset * 10) + b * 13 + face * 5) % 7);
            const color = lit < 2 ? 0xcbb690 : lit === 2 ? 0xabc6c6 : 0x2b4245;
            panes.push(face === 0 ? { x: x + offset, y, z: z - d / 2 - .04, yaw: 0, color }
              : face === 1 ? { x: x + offset, y, z: z + d / 2 + .04, yaw: Math.PI, color }
                : face === 2 ? { x: x - w / 2 - .04, y, z: z + offset, yaw: -Math.PI / 2, color }
                  : { x: x + w / 2 + .04, y, z: z + offset, yaw: Math.PI / 2, color });
          }
        }
    }
    const mesh = new THREE.InstancedMesh(geometry, material, panes.length); mesh.name = 'catch-lit-window-grid'; mesh.receiveShadow = true;
    const matrix = new THREE.Matrix4(); const color = new THREE.Color();
    panes.forEach((pane, index) => { matrix.makeRotationY(pane.yaw); matrix.setPosition(pane.x, pane.y, pane.z); mesh.setMatrixAt(index, matrix); mesh.setColorAt(index, color.setHex(pane.color)); });
    mesh.instanceMatrix.needsUpdate = true; if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    this.group.add(mesh);
  }
  update(journey?: FilmJourney): void {
    const state = journey?.scene === 'm2_catch' && !journey.visiting ? journey.catch ?? newCatch() : newCatch();
    const flying = state.phase === 'flight'; const rooftop = ['extract_ready', 'extracting', 'pulse', 'done'].includes(state.phase) || state.phase === 'failed' && state.checkpoint === 'pulse';
    this.shards.visible = flying && state.elapsed < 3;
    this.shards.children.forEach((shard, index) => {
      const t = state.elapsed; shard.position.set(CATCH.trinity.x + Math.sin(index * 2.4) * (1 + index % 5 * .36), -1 + Math.cos(index * 1.7) * 2 - t * t * .9,
        CATCH.trinity.z - (index % 4) * .4 - t * .8); shard.rotation.set(t * 2 + index, t + index * .8, index + t * 1.3);
    });
    this.bullet.visible = ['extracting', 'pulse', 'done'].includes(state.phase);
    this.bullet.position.y = .95 + state.focus / CATCH.extraction * 1.5;
    this.bullet.rotation.y = state.focus * 3;
    this.pulse.visible = state.phase === 'pulse';
    if (state.phase === 'pulse') {
      const radius = Math.max(.6, 1.8 - state.elapsed / CATCH.pulseAt * 1.2);
      this.pulseRing.scale.setScalar(radius);
      this.pulseLight.intensity = Math.abs(state.elapsed - CATCH.pulseAt) < CATCH.pulseWindow ? 65 : 18;
    } else this.pulseLight.intensity = rooftop && state.phase === 'done' ? 45 : 0;
    this.fire.intensity = rooftop ? 60 : 270;
  }
  dispose(): void {
    this.group.removeFromParent(); this.group.clear();
    this.geometries.forEach(geometry => geometry.dispose()); this.materials.forEach(material => material.dispose()); this.lights.forEach(light => light.dispose());
    this.geometries.clear(); this.materials.clear(); this.lights.clear();
  }
}
