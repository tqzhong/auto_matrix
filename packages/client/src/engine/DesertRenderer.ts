import * as THREE from 'three';
import { DESERT_REVEAL, type FilmJourney } from '@auto_matrix/shared';

/** The loading-program reconstruction of the ruined real world: a walkable
 * overlook, collapsed city layers, dead sky and distant harvesting towers. */
export class DesertRenderer {
  private geometries = new Set<THREE.BufferGeometry>();
  private materials = new Set<THREE.Material>();
  private lights = new Set<THREE.Light>();
  private ash: THREE.Points;
  private towerGlow: THREE.MeshStandardMaterial;
  private flash: THREE.PointLight;
  private ground = this.material(new THREE.MeshStandardMaterial({ color: 0x454c49, roughness: .98, metalness: .04 }));
  private concrete = this.material(new THREE.MeshStandardMaterial({ color: 0x626865, roughness: .93 }));
  private charcoal = this.material(new THREE.MeshStandardMaterial({ color: 0x252c2c, roughness: .82, metalness: .18 }));
  private rust = this.material(new THREE.MeshStandardMaterial({ color: 0x694a39, roughness: .86, metalness: .36 }));
  private glass = this.material(new THREE.MeshPhysicalMaterial({ color: 0x6a7b77, roughness: .24, metalness: .42, transparent: true, opacity: .4, depthWrite: false }));

  constructor(private root: THREE.Group) {
    this.towerGlow = this.material(new THREE.MeshStandardMaterial({ color: 0x8d563c, emissive: 0xe06d37, emissiveIntensity: .5, metalness: .76, roughness: .31 }));
    this.terrain(); this.city(); this.overpass(); this.harvesters();
    this.ash = this.createAsh();
    const ambient = new THREE.HemisphereLight(0x87999a, 0x202322, 1.65); ambient.name = 'desert-dead-sky-fill'; this.root.add(ambient); this.lights.add(ambient);
    this.flash = new THREE.PointLight(0xaac7c5, 0, 150, 1.5); this.flash.name = 'desert-cloud-flash'; this.flash.position.set(-28, 37, -58); this.root.add(this.flash); this.lights.add(this.flash);
  }

  private material<T extends THREE.Material>(value: T): T { this.materials.add(value); return value; }
  private geometry<T extends THREE.BufferGeometry>(value: T): T { this.geometries.add(value); return value; }
  private mesh(parent: THREE.Object3D, geometry: THREE.BufferGeometry, material: THREE.Material, name?: string): THREE.Mesh {
    const mesh = new THREE.Mesh(this.geometry(geometry), material); mesh.castShadow = mesh.receiveShadow = true;
    if (name) mesh.name = name; parent.add(mesh); return mesh;
  }
  private box(parent: THREE.Object3D, material: THREE.Material, x: number, y: number, z: number, width: number, height: number, depth: number, name?: string): THREE.Mesh {
    const mesh = this.mesh(parent, new THREE.BoxGeometry(width, height, depth), material, name); mesh.position.set(x, y, z); return mesh;
  }
  private cylinder(parent: THREE.Object3D, material: THREE.Material, x: number, y: number, z: number, radius: number, height: number, radial = 12): THREE.Mesh {
    const mesh = this.mesh(parent, new THREE.CylinderGeometry(radius * .86, radius, height, radial), material); mesh.position.set(x, y, z); return mesh;
  }
  private pipe(parent: THREE.Object3D, points: THREE.Vector3[], radius: number, material = this.rust): THREE.Mesh {
    return this.mesh(parent, new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points), Math.max(16, points.length * 8), radius, 7), material);
  }

  private terrain(): void {
    const geometry = this.geometry(new THREE.PlaneGeometry(190, 210, 54, 60)); const position = geometry.attributes.position;
    for (let i = 0; i < position.count; i++) {
      const x = position.getX(i); const y = position.getY(i);
      const path = Math.max(0, Math.abs(x) - 7) * .025;
      const height = Math.abs(x) < 7 ? 0 : Math.sin(x * .31 + y * .13) * .23 + Math.cos(y * .19 - x * .08) * .18 + path;
      position.setZ(i, height);
    }
    geometry.computeVertexNormals(); const floor = this.mesh(this.root, geometry, this.ground, 'desert-cracked-ground'); floor.rotation.x = -Math.PI / 2; floor.position.y = -.18;
    for (let i = 0; i < 46; i++) {
      const side = i % 2 ? 1 : -1; const z = 42 - i * 2.45; const x = side * (9 + (i * 17) % 19);
      const rubble = this.mesh(this.root, new THREE.DodecahedronGeometry(.65 + i % 5 * .32, 0), i % 4 ? this.concrete : this.rust, `desert-rubble-${i}`);
      rubble.position.set(x, .35 + i % 3 * .12, z); rubble.scale.set(1.7, .7, 1.1); rubble.rotation.set(i * .17, i * .73, i * .11);
    }
    for (let i = 0; i < 34; i++) {
      const crack = this.pipe(this.root, [new THREE.Vector3(-5 + (i % 4) * 3.1, .015, 48 - i * 3.1), new THREE.Vector3(-3 + (i % 5) * 1.7, .02, 46 - i * 3.1), new THREE.Vector3(-1 + (i % 3) * 2.1, .015, 43 - i * 3.1)], .025, this.charcoal);
      crack.name = `desert-ground-crack-${i}`;
    }
  }

  private brokenBuilding(parent: THREE.Group, x: number, z: number, width: number, depth: number, height: number, index: number): void {
    const building = new THREE.Group(); building.position.set(x, 0, z); building.rotation.z = (index % 5 - 2) * .012; parent.add(building);
    const levels = Math.max(2, Math.floor(height / 5));
    for (let level = 0; level < levels; level++) {
      const missing = (level * 3 + index) % 7 === 0; const levelWidth = width * (1 - level / levels * .08);
      if (!missing) this.box(building, level % 4 ? this.concrete : this.charcoal, (level % 3 - 1) * .35, 2.5 + level * 5, 0, levelWidth, 4.75, depth, `desert-building-${index}-level-${level}`);
      for (const side of [-1, 1]) {
        const column = this.box(building, this.rust, side * (levelWidth / 2 - .35), 2.5 + level * 5, depth * .28, .2, 5.1, .25);
        column.rotation.z = missing ? side * .18 : 0;
      }
    }
    for (let level = 1; level < levels; level += 2) for (const side of [-1, 1]) {
      const window = this.box(building, this.glass, side * width * .24, level * 5 + 2.7, depth / 2 + .03, width * .34, 2.5, .06);
      window.rotation.z = (index + level) % 3 === 0 ? .12 : 0;
    }
    const beam = this.box(building, this.rust, index % 2 ? width * .3 : -width * .25, height + 1.5, 0, .35, 8, .45); beam.rotation.z = index % 2 ? -.8 : .65;
  }

  private city(): void {
    const city = new THREE.Group(); city.name = 'desert-ruined-skyline'; this.root.add(city);
    for (let i = 0; i < 28; i++) {
      const side = i % 2 ? 1 : -1; const lane = 18 + i % 4 * 9; const x = side * lane; const z = 38 - Math.floor(i / 2) * 10.5;
      this.brokenBuilding(city, x, z, 8 + i % 5 * 2, 7 + i % 3 * 2, 17 + (i * 13) % 34, i);
    }
    for (const [x, z, scale] of [[-54, -78, 1.7], [42, -91, 1.45], [5, -103, 2.1]] as const) {
      const tower = this.mesh(city, new THREE.CylinderGeometry(4 * scale, 7 * scale, 54 * scale, 5), this.charcoal, 'desert-distant-ruin');
      tower.position.set(x, 22 * scale, z); tower.rotation.z = x < 0 ? .16 : -.1;
    }
  }

  private overpass(): void {
    const bridge = new THREE.Group(); bridge.name = 'desert-collapsed-overpass'; this.root.add(bridge);
    const left = this.box(bridge, this.concrete, -22, 7.5, -34, 36, 2.2, 8); left.rotation.z = -.12;
    const right = this.box(bridge, this.concrete, 25, 5.2, -39, 31, 2.2, 8); right.rotation.z = .24;
    for (const x of [-34, -17, 20, 34]) { const support = this.box(bridge, this.concrete, x, 3.2, -36, 2.1, 7, 2.1); support.rotation.z = x > 0 ? .13 : -.06; }
    for (let i = 0; i < 18; i++) {
      const rail = this.box(bridge, this.rust, -38 + i * 4.5, 9 + Math.sin(i) * 1.8, -31.5, 3.9, .16, .18); rail.rotation.z = -.35 + i * .04;
    }
  }

  private harvesters(): void {
    const towers = new THREE.Group(); towers.name = 'desert-harvest-towers'; this.root.add(towers);
    for (const [index, x] of [-24, 0, 25].entries()) {
      const height = index === 1 ? 42 : 34;
      this.cylinder(towers, this.charcoal, x, height / 2, DESERT_REVEAL.towersZ - index * 5, 3.8, height, 10);
      for (let y = 6; y < height; y += 6) {
        const ring = this.mesh(towers, new THREE.TorusGeometry(4.5 - y / height, .22, 7, 24), this.rust, `desert-harvester-ring-${index}-${y}`);
        ring.position.set(x, y, DESERT_REVEAL.towersZ - index * 5); ring.rotation.x = Math.PI / 2;
      }
      for (let pod = 0; pod < 7; pod++) {
        const angle = pod / 7 * Math.PI * 2; const light = this.mesh(towers, new THREE.SphereGeometry(.32, 10, 7), this.towerGlow);
        light.position.set(x + Math.sin(angle) * 3.2, 8 + pod * 3.8, DESERT_REVEAL.towersZ - index * 5 + Math.cos(angle) * 3.2);
      }
      this.pipe(towers, [new THREE.Vector3(x, height, DESERT_REVEAL.towersZ - index * 5), new THREE.Vector3(x + (index - 1) * 7, height + 8, DESERT_REVEAL.towersZ - 8 - index * 5)], .55, this.charcoal);
    }
  }

  private createAsh(): THREE.Points {
    const count = 1800; const positions = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      positions[i * 3] = Math.sin(i * 91.17) * 82; positions[i * 3 + 1] = 1 + (i * 37 % 430) / 10; positions[i * 3 + 2] = 52 - (i * 67 % 1450) / 10;
    }
    const geometry = this.geometry(new THREE.BufferGeometry()); geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    const material = this.material(new THREE.PointsMaterial({ color: 0xa6aaa3, size: .16, transparent: true, opacity: .52, depthWrite: false, sizeAttenuation: true }));
    const ash = new THREE.Points(geometry, material); ash.name = 'desert-falling-ash'; ash.frustumCulled = false; this.root.add(ash); return ash;
  }

  update(journey: FilmJourney | undefined, elapsed: number): void {
    const beat = journey?.scene === 'm1_desert' && !journey.visiting && journey.awakening?.kind === 'desert' ? journey.awakening : undefined;
    const active = beat?.started === true; const t = beat?.elapsed ?? 0;
    const positions = this.ash.geometry.attributes.position;
    for (let i = 0; i < positions.count; i++) {
      let y = positions.getY(i) - .012; if (y < .3) y = 43;
      positions.setY(i, y); positions.setX(i, positions.getX(i) + Math.sin(elapsed * .35 + i) * .0015);
    }
    positions.needsUpdate = true;
    this.towerGlow.emissiveIntensity = active ? .62 + THREE.MathUtils.smoothstep(t, 5, 9) * 1.15 + Math.sin(elapsed * 5) * .08 : .5;
    const pulse = active && t > 2 ? Math.max(0, Math.sin((t - 2) * 2.7)) ** 18 : 0;
    this.flash.intensity = pulse * 520;
  }

  dispose(): void {
    this.root.clear(); this.geometries.forEach(value => value.dispose()); this.materials.forEach(value => value.dispose()); this.lights.forEach(value => value.dispose());
    this.geometries.clear(); this.materials.clear(); this.lights.clear();
  }
}
