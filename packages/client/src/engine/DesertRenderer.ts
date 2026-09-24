import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { DESERT_REVEAL, type FilmJourney } from '@auto_matrix/shared';

/** The loading-program reconstruction of the ruined real world: a walkable
 * overlook, collapsed city layers, dead sky and distant harvesting towers. */
export class DesertRenderer {
  private geometries = new Set<THREE.BufferGeometry>();
  private materials = new Set<THREE.Material>();
  private textures = new Set<THREE.Texture>();
  private lights = new Set<THREE.Light>();
  private disposed = false;
  private ash: THREE.Points;
  private towerGlow: THREE.MeshStandardMaterial;
  private flash: THREE.PointLight;
  private ground = this.material(new THREE.MeshStandardMaterial({ color: 0x9daaa4, roughness: .98, metalness: .04 }));
  private concrete = this.material(new THREE.MeshStandardMaterial({ color: 0x68736e, roughness: .96 }));
  private brokenConcrete = this.material(new THREE.MeshStandardMaterial({ color: 0x48534f, roughness: .98 }));
  private plaster = this.material(new THREE.MeshStandardMaterial({ color: 0x78827c, roughness: .96 }));
  private charcoal = this.material(new THREE.MeshStandardMaterial({ color: 0x252c2c, roughness: .82, metalness: .18 }));
  private rust = this.material(new THREE.MeshStandardMaterial({ color: 0x694a39, roughness: .86, metalness: .36 }));
  private glass = this.material(new THREE.MeshPhysicalMaterial({ color: 0x6a7b77, roughness: .24, metalness: .42, transparent: true, opacity: .4, depthWrite: false }));

  constructor(private root: THREE.Group) {
    if (typeof document !== 'undefined') {
      this.surface([this.ground], 'surfaces', 'asphalt_02');
      this.surface([this.plaster], 'film-materials', 'damaged_plaster');
      for (const material of [this.concrete, this.brokenConcrete]) {
        material.normalMap = this.plaster.normalMap;
        material.roughnessMap = this.plaster.roughnessMap;
        material.normalScale.set(.42, .42);
        material.needsUpdate = true;
      }
    }
    this.towerGlow = this.material(new THREE.MeshStandardMaterial({ color: 0x8d563c, emissive: 0xe06d37, emissiveIntensity: .5, metalness: .76, roughness: .31 }));
    this.terrain(); this.city(); this.overpass(); this.harvesters();
    this.ash = this.createAsh();
    const ambient = new THREE.HemisphereLight(0x87999a, 0x202322, 1.65); ambient.name = 'desert-dead-sky-fill'; this.root.add(ambient); this.lights.add(ambient);
    this.flash = new THREE.PointLight(0xaac7c5, 0, 150, 1.5); this.flash.name = 'desert-cloud-flash'; this.flash.position.set(-28, 37, -58); this.root.add(this.flash); this.lights.add(this.flash);
  }

  private material<T extends THREE.Material>(value: T): T { this.materials.add(value); return value; }
  private geometry<T extends THREE.BufferGeometry>(value: T): T { this.geometries.add(value); return value; }
  private surface(materials: THREE.MeshStandardMaterial[], folder: string, id: string): void {
    const loader = new THREE.TextureLoader();
    const load = (kind: string) => {
      const texture = loader.load(`/assets/${folder}/${id}-${kind}.jpg`, loaded => { if (this.disposed) loaded.dispose(); });
      texture.wrapS = texture.wrapT = THREE.RepeatWrapping; texture.anisotropy = 8;
      if (kind === 'color') texture.colorSpace = THREE.SRGBColorSpace;
      this.textures.add(texture); return texture;
    };
    const map = load('color'); const normalMap = load('normal'); const roughnessMap = load('roughness');
    for (const material of materials) {
      material.map = map; material.normalMap = normalMap; material.roughnessMap = roughnessMap;
      material.normalScale.set(.42, .42); material.needsUpdate = true;
    }
  }
  private mesh(parent: THREE.Object3D, geometry: THREE.BufferGeometry, material: THREE.Material, name?: string): THREE.Mesh {
    const mesh = new THREE.Mesh(this.geometry(geometry), material); mesh.castShadow = mesh.receiveShadow = true;
    if (name) mesh.name = name; parent.add(mesh); return mesh;
  }
  private tileUvs(geometry: THREE.BufferGeometry): void {
    const position = geometry.attributes.position; const normal = geometry.attributes.normal; const uv = geometry.attributes.uv;
    for (let i = 0; i < uv.count; i++) uv.setXY(i,
      (Math.abs(normal.getX(i)) > .5 ? position.getZ(i) : position.getX(i)) / 5,
      (Math.abs(normal.getY(i)) > .5 ? position.getZ(i) : position.getY(i)) / 5);
    uv.needsUpdate = true;
  }
  private box(parent: THREE.Object3D, material: THREE.Material, x: number, y: number, z: number, width: number, height: number, depth: number, name?: string): THREE.Mesh {
    const geometry = new THREE.BoxGeometry(width, height, depth);
    this.tileUvs(geometry);
    const mesh = this.mesh(parent, geometry, material, name); mesh.position.set(x, y, z); return mesh;
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
    this.tileUvs(geometry);
    geometry.computeVertexNormals(); const floor = this.mesh(this.root, geometry, this.ground, 'desert-cracked-ground'); floor.rotation.x = -Math.PI / 2; floor.position.y = -.18;
    for (let i = 0; i < 46; i++) {
      const side = i % 2 ? 1 : -1; const z = 42 - i * 2.45; const x = side * (9 + (i * 17) % 19);
      const rubble = this.mesh(this.root, new THREE.DodecahedronGeometry(.65 + i % 5 * .32, 0), i % 4 ? this.brokenConcrete : this.rust, `desert-rubble-${i}`);
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
      const missing = level > 0 && (level * 3 + index) % 7 === 0;
      const base = level * 5; const offset = (level % 3 - 1) * .35;
      const levelWidth = width * (1 - level / levels * .08);
      const slab = this.box(building, level % 3 ? this.concrete : this.brokenConcrete,
        offset + (missing ? levelWidth * .16 : 0), base + .2, 0, levelWidth * (missing ? .68 : 1), .42, depth * (missing ? .78 : 1));
      if (missing) {
        slab.rotation.z = (index % 2 ? 1 : -1) * .08;
        for (const side of [-1, 1]) {
          const exposed = this.box(building, this.rust, offset + side * levelWidth * .31, base + 2.05, depth * .28, .12, 3.7, .12);
          exposed.rotation.z = side * .24;
        }
        continue;
      }
      for (const front of [-1, 1]) {
        const face = front * (depth / 2 - .16);
        this.box(building, (level + index) % 7 === 0 ? this.plaster : this.brokenConcrete,
          offset, base + 1, face, levelWidth, 1.45, .35);
        this.box(building, this.concrete, offset, base + 4.55, face, levelWidth, .82, .38);
        for (const side of [-1, 1]) {
          this.box(building, level % 4 ? this.concrete : this.brokenConcrete,
            offset + side * (levelWidth / 2 - .68), base + 2.8, face, 1.35, 3.3, .45);
        }
      }
      for (const side of [-1, 1]) for (const end of [-1, 1]) {
        this.box(building, this.brokenConcrete, offset + side * (levelWidth / 2 - .18), base + 2.65,
          end * depth * .34, .34, 4.4, depth * .29);
      }
      if ((level + index) % 3 === 1) {
        const shard = this.box(building, this.glass, offset + levelWidth * .23, base + 3.2, depth / 2 + .065,
          levelWidth * .13, 1.25, .045);
        shard.rotation.z = -.16;
      }
    }
    const roof = levels * 5;
    for (let piece = 0; piece < 3; piece++) {
      const wall = this.box(building, piece === 1 ? this.brokenConcrete : this.concrete,
        (piece - 1) * width * .32, roof + (piece === index % 3 ? 1.2 : .65), depth / 2 - .12,
        width * .3, piece === index % 3 ? 2.4 : 1.3, .38);
      wall.rotation.z = (piece - 1) * .07;
    }
    const beam = this.box(building, this.rust, index % 2 ? width * .3 : -width * .25, roof + 1.5, 0, .22, 5, .22); beam.rotation.z = index % 2 ? -.8 : .65;
  }

  private batchCity(city: THREE.Group): void {
    city.updateMatrixWorld(true);
    const inverse = city.matrixWorld.clone().invert();
    const batches = new Map<THREE.Material, THREE.BufferGeometry[]>();
    city.traverse(object => {
      if (!(object instanceof THREE.Mesh)) return;
      const geometry = object.geometry.clone().applyMatrix4(inverse.clone().multiply(object.matrixWorld));
      this.tileUvs(geometry);
      const bucket = batches.get(object.material) ?? []; bucket.push(geometry); batches.set(object.material, bucket);
    });
    city.traverse(object => {
      if (!(object instanceof THREE.Mesh)) return;
      this.geometries.delete(object.geometry); object.geometry.dispose();
    });
    city.clear();
    for (const [material, geometries] of batches) {
      const merged = mergeGeometries(geometries, false);
      geometries.forEach(geometry => geometry.dispose());
      if (merged) this.mesh(city, merged, material, 'desert-ruin-facades');
    }
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
    this.batchCity(city);
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
    const podShell = this.geometry(new THREE.CapsuleGeometry(.58, 1.5, 4, 8));
    const podLight = this.geometry(new THREE.SphereGeometry(.32, 8, 6));
    const armGeometry = this.geometry(new THREE.CylinderGeometry(.12, .2, 2.3, 6));
    const hangerGeometry = this.geometry(new THREE.CylinderGeometry(.16, .16, .65, 6));
    const pods = new THREE.InstancedMesh(podShell, this.glass, 120); pods.name = 'desert-harvester-pods'; towers.add(pods);
    const lights = new THREE.InstancedMesh(podLight, this.towerGlow, 120); towers.add(lights);
    const arms = new THREE.InstancedMesh(armGeometry, this.rust, 120); towers.add(arms);
    const hangers = new THREE.InstancedMesh(hangerGeometry, this.rust, 120); towers.add(hangers);
    const radial = new THREE.Vector3();
    const position = new THREE.Vector3(); const rotation = new THREE.Quaternion(); const matrix = new THREE.Matrix4();
    const up = new THREE.Vector3(0, 1, 0); const scale = new THREE.Vector3(1, 1, 1);
    let podIndex = 0;
    for (const [index, x] of [-24, 0, 25].entries()) {
      const height = index === 1 ? 42 : 34;
      const z = DESERT_REVEAL.towersZ - index * 5;
      this.cylinder(towers, this.charcoal, x, height / 2, z, 3.2, height, 10);
      for (let level = 0, y = 7; y < height - 3; level++, y += 5.2) {
        const ring = this.mesh(towers, new THREE.TorusGeometry(4.4, .2, 6, 24), this.rust, `desert-harvester-ring-${index}-${level}`);
        ring.position.set(x, y - 1.5, z); ring.rotation.x = Math.PI / 2;
        for (let slot = 0; slot < 6; slot++) {
          const angle = (slot + (level % 2) * .5) / 6 * Math.PI * 2;
          radial.set(Math.sin(angle), 0, Math.cos(angle));
          const px = x + radial.x * 5.1; const pz = z + radial.z * 5.1;
          rotation.setFromUnitVectors(up, radial);
          arms.setMatrixAt(podIndex, matrix.compose(position.set(x + radial.x * 4.05, y + .72, z + radial.z * 4.05), rotation, scale));
          rotation.identity();
          pods.setMatrixAt(podIndex, matrix.makeTranslation(px, y, pz));
          scale.set(1, 1.65, 1);
          lights.setMatrixAt(podIndex, matrix.compose(position.set(px, y - .15, pz), rotation, scale));
          scale.set(1, 1, 1);
          hangers.setMatrixAt(podIndex, matrix.makeTranslation(px, y + 1.55, pz));
          podIndex++;
        }
      }
      for (let strut = 0; strut < 4; strut++) {
        const angle = strut * Math.PI / 2 + .35;
        this.pipe(towers, [new THREE.Vector3(x + Math.sin(angle) * 7, 0, z + Math.cos(angle) * 7),
          new THREE.Vector3(x + Math.sin(angle) * 4.2, 9, z + Math.cos(angle) * 4.2),
          new THREE.Vector3(x + Math.sin(angle) * 2.8, 18, z + Math.cos(angle) * 2.8)], .24, this.rust);
      }
      this.pipe(towers, [new THREE.Vector3(x, height, z), new THREE.Vector3(x + (index - 1) * 7, height + 8, z - 8)], .55, this.charcoal);
    }
    for (const mesh of [pods, lights, arms, hangers]) { mesh.count = podIndex; mesh.instanceMatrix.needsUpdate = true; mesh.computeBoundingSphere(); }
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
    this.disposed = true;
    this.root.clear(); this.geometries.forEach(value => value.dispose()); this.materials.forEach(value => value.dispose());
    this.textures.forEach(value => value.dispose()); this.lights.forEach(value => value.dispose());
    this.geometries.clear(); this.materials.clear(); this.textures.clear(); this.lights.clear();
  }
}
