import * as THREE from 'three';
import { MOUNTAIN, mountainFloor, type MountainFlight } from '@auto_matrix/shared';

/** Snowy exterior of the château and the first steerable stretch of Neo's return. */
export class MountainSetRenderer {
  private geometries = new Set<THREE.BufferGeometry>();
  private materials = new Set<THREE.Material>();
  private trail = new THREE.Group();
  private snow: THREE.Points;
  private door: THREE.Mesh;

  constructor(private root: THREE.Group) {
    const snow = this.material(new THREE.MeshStandardMaterial({ color: 0xf1f2ed, roughness: .93, vertexColors: true }));
    const stone = this.material(new THREE.MeshStandardMaterial({ color: 0x727b78, roughness: .91 }));
    const dark = this.material(new THREE.MeshStandardMaterial({ color: 0x303a3b, roughness: .83 }));
    const ice = this.material(new THREE.MeshStandardMaterial({ color: 0xd9e8eb, roughness: .54, metalness: .04 }));
    const rock = this.material(new THREE.MeshStandardMaterial({ vertexColors: true, side: THREE.DoubleSide, roughness: .98, flatShading: true }));
    const pine = this.material(new THREE.MeshStandardMaterial({ color: 0x314c46, roughness: .9 }));
    const terrain = this.geometry(new THREE.PlaneGeometry(280, 760, 56, 152)); terrain.rotateX(-Math.PI / 2);
    const vertices = terrain.attributes.position; const colors = new Float32Array(vertices.count * 3);
    const white = new THREE.Color(0xe7edec); const shadow = new THREE.Color(0x7f9799); const tint = new THREE.Color();
    for (let i = 0; i < vertices.count; i++) {
      const x = vertices.getX(i); const z = vertices.getZ(i); const y = mountainFloor(x, z);
      vertices.setY(i, y);
      const slope = Math.min(1, Math.abs(mountainFloor(x + 3, z) - y) * .9 + Math.abs(mountainFloor(x, z + 3) - y) * .5);
      tint.copy(white).lerp(shadow, slope * .56 + (Math.sin(x * .11 + z * .037) + 1) * .04);
      colors[i * 3] = tint.r; colors[i * 3 + 1] = tint.g; colors[i * 3 + 2] = tint.b;
    }
    terrain.setAttribute('color', new THREE.BufferAttribute(colors, 3)); terrain.computeVertexNormals();
    const ground = this.mesh(terrain, snow, 'mountain-snow-terrain'); ground.receiveShadow = true;

    const terrace = this.box(stone, 0, .82, 295, 46, .6, 80, 'mountain-chateau-terrace'); terrace.receiveShadow = true;
    for (const side of [-1, 1]) {
      this.box(stone, side * 23.5, 2.1, 295, 1.8, 2.8, 80, 'mountain-terrace-parapet');
      for (let z = 258; z <= 332; z += 12) this.box(ice, side * 23.5, 3.55, z, 2.5, .36, 4.8);
    }
    this.box(stone, 0, 13, 341, 64, 26, 7, 'mountain-chateau-rear-wall');
    this.box(ice, 0, 26.2, 341, 67, 2.6, 8);
    for (const side of [-1, 1]) {
      const tower = this.mesh(new THREE.CylinderGeometry(6.8, 8.1, 36, 10), stone, 'mountain-chateau-tower');
      tower.position.set(side * 27, 17.5, 339);
      const roof = this.mesh(new THREE.ConeGeometry(9.2, 12, 10), dark); roof.position.set(side * 27, 41, 339);
      const cap = this.mesh(new THREE.ConeGeometry(9.35, 2.6, 10), ice); cap.position.set(side * 27, 45.4, 339);
      for (let level = 0; level < 3; level++) this.box(dark, side * 27, 8 + level * 9, 332.8, 2.3, 4.2, .25);
    }
    this.door = this.box(dark, 0, 5.5, 336.9, 7, 11, .5, 'mountain-locked-door');
    this.box(stone, 0, 12, 336.5, 10, 2, 1.3, 'mountain-door-lintel');
    for (const x of [-5, 5]) this.box(stone, x, 6, 336.5, 2, 12, 1.3);
    this.box(ice, 0, 13.3, 336, 12, .45, 2);
    for (let z = 325; z >= 245; z -= 8) {
      for (const x of [-21, 21]) {
        const post = this.box(stone, x, 1.7, z, 1.2, 3.4, 1.2); post.rotation.y = z * .002;
      }
    }
    for (let i = 0; i < 24; i++) {
      const side = i % 2 ? 1 : -1; const x = side * (34 + (i * 17) % 70); const z = 230 - i * 21;
      const y = mountainFloor(x, z); const height = 6 + (i * 13) % 11;
      const tree = this.mesh(new THREE.ConeGeometry(2.2 + i % 3, height, 6), pine, 'mountain-pine');
      tree.position.set(x, y + height / 2, z);
      const crown = this.mesh(new THREE.ConeGeometry(2.6 + i % 3, height * .32, 6), ice); crown.position.set(x, y + height * .92, z);
    }
    this.ridge(-375, 1, rock);
    this.ridge(-620, .75, rock);
    this.snow = this.particles();
    this.trail.name = 'mountain-flight-trail'; this.root.add(this.trail);
    const trailMaterial = this.material(new THREE.MeshBasicMaterial({ color: 0xdff3f4, transparent: true, opacity: .24, depthWrite: false }));
    for (let i = 0; i < 14; i++) {
      const streak = this.mesh(new THREE.BoxGeometry(.025, .025, 3 + i * .35), trailMaterial);
      streak.removeFromParent(); this.trail.add(streak);
      streak.position.set((i % 2 ? 1 : -1) * (.5 + i % 4 * .22), (i % 5 - 2) * .23, 7 + i * 2.2);
    }
    this.trail.visible = false;
    const sun = new THREE.DirectionalLight(0xe1f2ff, 1.45); sun.position.set(-45, 95, 120); sun.name = 'mountain-cold-sun'; this.root.add(sun);
  }

  private geometry<T extends THREE.BufferGeometry>(value: T): T { this.geometries.add(value); return value; }
  private material<T extends THREE.Material>(value: T): T { this.materials.add(value); return value; }
  private mesh(geometry: THREE.BufferGeometry, material: THREE.Material, name?: string): THREE.Mesh {
    const mesh = new THREE.Mesh(this.geometry(geometry), material); if (name) mesh.name = name;
    mesh.castShadow = true; this.root.add(mesh); return mesh;
  }
  private box(material: THREE.Material, x: number, y: number, z: number, width: number, height: number, depth: number, name?: string): THREE.Mesh {
    const mesh = this.mesh(new THREE.BoxGeometry(width, height, depth), material, name); mesh.position.set(x, y, z); return mesh;
  }
  private ridge(depth: number, scale: number, material: THREE.Material): void {
    const points: number[] = []; const shades: number[] = []; const indices: number[] = [];
    const colors = [new THREE.Color(0x789094), new THREE.Color(0x9eb6b8), new THREE.Color(0xe7eeee)];
    for (let i = 0; i <= 28; i++) {
      const x = -420 + i * 30;
      const height = (72 + (i * 47 % 91) + Math.sin(i * 1.83) * 18) * scale;
      const z = depth + Math.sin(i * 2.17) * 13;
      const profile = [[-26, 0], [height * .58, -11], [height, 0]];
      for (let row = 0; row < profile.length; row++) {
        points.push(x, profile[row][0], z + profile[row][1]);
        const color = colors[row]; shades.push(color.r, color.g, color.b);
      }
      if (!i) continue;
      for (let column = 0; column < 2; column++) {
        const a = (i - 1) * 3 + column; const b = i * 3 + column;
        indices.push(a, b, a + 1, b, b + 1, a + 1);
      }
    }
    const geometry = this.geometry(new THREE.BufferGeometry());
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(points, 3));
    geometry.setAttribute('color', new THREE.Float32BufferAttribute(shades, 3));
    geometry.setIndex(indices); geometry.computeVertexNormals();
    const range = this.mesh(geometry, material, 'mountain-distant-ridge'); range.castShadow = false;
  }
  private particles(): THREE.Points {
    const values = new Float32Array(900 * 3); let seed = 71573;
    const random = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; };
    for (let i = 0; i < 900; i++) { values[i * 3] = (random() - .5) * 280; values[i * 3 + 1] = random() * 100; values[i * 3 + 2] = (random() - .5) * 760; }
    const geometry = this.geometry(new THREE.BufferGeometry()); geometry.setAttribute('position', new THREE.BufferAttribute(values, 3));
    const material = this.material(new THREE.PointsMaterial({ color: 0xfaffff, size: .55, transparent: true, opacity: .72, depthWrite: false }));
    const points = new THREE.Points(geometry, material); points.name = 'mountain-wind-snow'; this.root.add(points); return points;
  }
  update(flight: MountainFlight | undefined, elapsed: number): void {
    this.snow.position.x = Math.sin(elapsed * .35) * 2;
    this.door.rotation.y = Math.sin(elapsed * .5) * .003;
    this.trail.visible = flight?.phase === 'takeoff' || flight?.phase === 'flying' || flight?.phase === 'arrived';
    if (flight) this.trail.position.set(flight.x, flight.altitude + 2, flight.z);
  }
  dispose(): void {
    this.root.traverse(object => { if (object instanceof THREE.Light) object.dispose(); });
    this.geometries.forEach(geometry => geometry.dispose()); this.materials.forEach(material => material.dispose());
    this.geometries.clear(); this.materials.clear();
  }
}
