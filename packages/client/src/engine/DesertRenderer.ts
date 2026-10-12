import * as THREE from 'three';
import { mergeGeometries, mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';
import { DESERT_REVEAL, DESERT_FURNITURE, DESERT_TERRAIN, DESERT_RUINS, DESERT_RUBBLE, desertVertexHeight, desertGroundHeight, type FilmJourney } from '@auto_matrix/shared';
import { createLoungeChair } from './LoungeChair.js';
import { createConstructTelevision } from './ConstructTelevision.js';

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
  private ground = this.material(new THREE.MeshStandardMaterial({ color: 0x77828f, roughness: .98, metalness: .04 }));
  private concrete = this.material(new THREE.MeshStandardMaterial({ color: 0x626a73, roughness: .96 }));
  private brokenConcrete = this.material(new THREE.MeshStandardMaterial({ color: 0x343c47, roughness: .98 }));
  private plaster = this.material(new THREE.MeshStandardMaterial({ color: 0x71787f, roughness: .96 }));
  private charcoal = this.material(new THREE.MeshStandardMaterial({ color: 0x252c2c, roughness: .82, metalness: .18 }));
  private rust = this.material(new THREE.MeshStandardMaterial({ color: 0x694a39, roughness: .86, metalness: .36 }));
  private glass = this.material(new THREE.MeshPhysicalMaterial({ color: 0x6a7b77, roughness: .24, metalness: .42, transparent: true, opacity: .4, depthWrite: false }));

  constructor(private root: THREE.Group) {
    if (typeof document !== 'undefined') {
      this.surface([this.ground], 'surfaces', 'asphalt_02');
      this.surface([this.plaster], 'film-materials', 'damaged_plaster');
    }
    this.towerGlow = this.material(new THREE.MeshStandardMaterial({ color: 0x8d563c, emissive: 0xe06d37, emissiveIntensity: .5, metalness: .76, roughness: .31 }));
    this.terrain(); this.city(); this.overpass(); this.harvesters(); this.furniture();
    this.ash = this.createAsh();
    const ambient = new THREE.HemisphereLight(0x8099b3, 0x15191f, 1.45); ambient.name = 'desert-dead-sky-fill'; this.root.add(ambient); this.lights.add(ambient);
    this.flash = new THREE.PointLight(0xaac7c5, 0, 150, 1.5); this.flash.name = 'desert-cloud-flash'; this.flash.position.set(-28, 37, -58); this.root.add(this.flash); this.lights.add(this.flash);
  }

  private material<T extends THREE.Material>(value: T): T { this.materials.add(value); return value; }
  private geometry<T extends THREE.BufferGeometry>(value: T): T { this.geometries.add(value); return value; }
  private surface(materials: THREE.MeshStandardMaterial[], folder: string, id: string): void {
    const loader = new THREE.TextureLoader();
    let ready = 0;
    const load = (kind: string) => {
      const texture = loader.load(`/assets/${folder}/${id}-${kind}.jpg`, loaded => {
        if (this.disposed) { loaded.dispose(); return; }
        if (++ready !== 3) return;
        for (const material of materials) {
          material.map = map; material.normalMap = normalMap; material.roughnessMap = roughnessMap;
          material.normalScale.set(.42, .42); material.needsUpdate = true;
        }
        if (id === 'damaged_plaster') for (const material of [this.concrete, this.brokenConcrete]) {
          material.map = map; material.normalMap = normalMap; material.roughnessMap = roughnessMap;
          material.normalScale.set(.42, .42); material.needsUpdate = true;
        }
      });
      texture.wrapS = texture.wrapT = THREE.RepeatWrapping; texture.anisotropy = 8;
      if (kind === 'color') texture.colorSpace = THREE.SRGBColorSpace;
      this.textures.add(texture); return texture;
    };
    const map = load('color'); const normalMap = load('normal'); const roughnessMap = load('roughness');
  }
  private furniture(): void {
    const leather = this.material(new THREE.MeshStandardMaterial({ color: 0xdec6b8, roughness: .94, metalness: .03 }));
    const wood = this.material(new THREE.MeshStandardMaterial({ color: 0x593a29, roughness: .56 }));
    const black = this.material(new THREE.MeshStandardMaterial({ color: 0x111313, roughness: .36, metalness: .4 }));
    const screen = this.material(new THREE.MeshStandardMaterial({ color: 0x0c1214, roughness: .18, metalness: .15 }));
    if (typeof document !== 'undefined' && typeof document.createElementNS === 'function') {
      this.surface([leather], 'film-materials', 'leather_red_03'); this.surface([wood], 'film-materials', 'old_wood_floor');
    }
    for (const [role, point] of Object.entries(DESERT_FURNITURE.chairs)) {
      const chair = createLoungeChair(leather); chair.name = `desert-chair-${role}`;
      chair.position.set(point.x, 0, point.z); chair.rotation.y = point.yaw; this.root.add(chair);
    }
    const tv = createConstructTelevision(wood, black, screen); tv.name = 'desert-television';
    tv.position.set(DESERT_FURNITURE.television.x, 0, DESERT_FURNITURE.television.z); this.root.add(tv);
    for (const object of [...this.root.children].filter(object => object.name.startsWith('desert-chair-') || object === tv)) object.traverse(part => {
      if (part instanceof THREE.Mesh) {
        this.geometries.add(part.geometry); this.materials.add(part.material);
        const map = (part.material as THREE.MeshStandardMaterial).map;
        if (map instanceof THREE.CanvasTexture) this.textures.add(map);
      }
    });
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
    const { width, depth, columns, rows } = DESERT_TERRAIN;
    const geometry = this.geometry(new THREE.PlaneGeometry(width, depth, columns, rows)); const position = geometry.attributes.position;
    for (let i = 0; i < position.count; i++) {
      const x = position.getX(i); const y = position.getY(i);
      position.setZ(i, desertVertexHeight(x, -y));
    }
    this.tileUvs(geometry);
    geometry.computeVertexNormals(); const floor = this.mesh(this.root, geometry, this.ground, 'desert-cracked-ground'); floor.rotation.x = -Math.PI / 2;
    for (const [i, chunk] of DESERT_RUBBLE.entries()) {
      this.fragment(this.root, chunk.x, chunk.y, chunk.z, chunk.width, chunk.height, chunk.depth, i, `desert-rubble-${i}`);
    }
    for (let i = 0; i < 34; i++) {
      const crack = this.pipe(this.root, [new THREE.Vector3(-5 + (i % 4) * 3.1, .015, 48 - i * 3.1), new THREE.Vector3(-3 + (i % 5) * 1.7, .02, 46 - i * 3.1), new THREE.Vector3(-1 + (i % 3) * 2.1, .015, 43 - i * 3.1)], .025, this.charcoal);
      crack.name = `desert-ground-crack-${i}`;
    }
  }

  private fragment(parent: THREE.Object3D, x: number, y: number, z: number, width: number, height: number, depth: number, seed: number, name?: string): void {
    const shape = new THREE.Shape();
    for (let i = 0; i < 8; i++) {
      const angle = i / 8 * Math.PI * 2;
      const radius = .73 + .24 * Math.abs(Math.sin(seed * 7.3 + i * 2.1));
      const px = Math.cos(angle) * width / 2 * radius, pz = Math.sin(angle) * depth / 2 * radius;
      if (i) shape.lineTo(px, -pz); else shape.moveTo(px, -pz);
    }
    shape.closePath();
    const geometry = new THREE.ExtrudeGeometry(shape, { depth: height, bevelEnabled: false, steps: 1, curveSegments: 1 });
    geometry.rotateX(-Math.PI / 2);
    const vertices = geometry.attributes.position;
    for (let i = 0; i < vertices.count; i++) if (vertices.getY(i) > height / 2)
      vertices.setY(i, height * (.48 + .5 * Math.abs(Math.sin(vertices.getX(i) * 3 + vertices.getZ(i) * 5 + seed))));
    geometry.computeVertexNormals(); this.tileUvs(geometry);
    this.mesh(parent, geometry, seed % 4 ? this.brokenConcrete : this.concrete, name).position.set(x, y, z);
  }

  private fracturedWall(parent: THREE.Object3D, x: number, y: number, z: number, width: number, height: number, seed: number, material = this.brokenConcrete): void {
    const shape = new THREE.Shape(); shape.moveTo(-width / 2, 0); shape.lineTo(width / 2, 0);
    for (let i = 10; i >= 0; i--) shape.lineTo((i / 10 - .5) * width, height * (.53 + .44 * Math.abs(Math.sin(seed * 3.1 + i * 2.7))));
    shape.closePath();
    const geometry = new THREE.ExtrudeGeometry(shape, { depth: .4, bevelEnabled: false, steps: 1, curveSegments: 1 }); geometry.translate(0, 0, -.2);
    this.tileUvs(geometry); this.mesh(parent, geometry, material).position.set(x, y, z);
  }

  private fracturedSlab(parent: THREE.Object3D, x: number, y: number, z: number, width: number, depth: number, seed: number): void {
    const shape = new THREE.Shape();
    const points = [[-.5, -.5], [.5, -.5], [.5, .03], [.31, .1], [.2, .07], [.22, .29], [-.05, .31], [-.5, .5]];
    points.forEach(([px, pz], i) => { if (i) shape.lineTo(px * width, -pz * depth); else shape.moveTo(px * width, -pz * depth); }); shape.closePath();
    const geometry = new THREE.ExtrudeGeometry(shape, { depth: .42, bevelEnabled: false, steps: 1, curveSegments: 1 }); geometry.rotateX(-Math.PI / 2);
    const vertices = geometry.attributes.position;
    for (let i = 0; i < vertices.count; i++) {
      const edge = Math.max(0, vertices.getZ(i) / depth + .1);
      vertices.setY(i, vertices.getY(i) - edge * (.35 + seed % 3 * .13));
    }
    geometry.computeVertexNormals(); this.tileUvs(geometry); this.mesh(parent, geometry, this.concrete).position.set(x, y, z);
  }

  private brokenBuilding(parent: THREE.Group, x: number, z: number, width: number, depth: number, height: number, index: number): void {
    const building = new THREE.Group(); building.position.set(x, 0, z); parent.add(building);
    const levels = Math.max(2, Math.floor(height / 5));
    for (const side of [-1, 1]) this.box(building, this.charcoal, side * width * .24, (levels * 5 - .5) / 2,
      -depth * .3, .55, levels * 5 - .5, .7);
    for (let level = 0; level < levels; level++) {
      const missing = level > 0 && (level * 3 + index) % 7 === 0;
      const base = level * 5; const offset = (level % 3 - 1) * .35;
      const levelWidth = width * (1 - level / levels * .08);
      if (level >= 2) this.fracturedSlab(building, offset, base, 0, levelWidth, depth, index + level);
      else this.box(building, level % 3 ? this.concrete : this.brokenConcrete, offset, base + .2, 0, levelWidth, .42, depth);
      if (missing) {
        for (const side of [-1, 1]) {
          const exposed = this.box(building, this.rust, offset + side * levelWidth * .31, base + 2.05, depth * .28, .12, 3.7, .12);
          exposed.rotation.z = side * .24;
        }
        continue;
      }
      for (const front of [-1, 1]) {
        const face = front * (depth / 2 - .16);
        this.fracturedWall(building, offset, base + .25, face, levelWidth, level === 0 ? 2.3 : 1.6, index * 19 + level * 3 + front + 7,
          (level + index) % 7 === 0 ? this.plaster : this.brokenConcrete);
        if (index === 0 && level < 2) this.fracturedWall(building, offset, base + 4.14, face, levelWidth, .8, index + front + level, this.concrete);
        for (const side of [-1, 1]) {
          this.fracturedWall(building, offset + side * (levelWidth / 2 - .68), base + 1.1, face, 1.35,
            index === 0 && level < 2 ? 3.3 : 1.2 + (index + level + side + 2) % 3 * .8, index + level * 5 + side, this.concrete);
        }
      }
      for (const side of [-1, 1]) for (const end of [-1, 1]) {
        const columnHeight = index === 0 && level < 2 ? 4.4 : 2 + (index + level + end + 3) % 3 * .55;
        this.fracturedWall(building, offset + side * (levelWidth / 2 - .3), base + .3, end * depth * .34,
          .6, columnHeight, index * 11 + level + end);
      }
      if ((level + index) % 3 === 1) {
        const shard = this.box(building, this.glass, offset + levelWidth * .23, base + 3.2, depth / 2 + .065,
          levelWidth * .13, 1.25, .045);
        shard.rotation.z = -.16;
      }
    }
    const roof = levels * 5;
    for (let piece = 0; piece < 3; piece++) this.fracturedWall(building, (piece - 1) * width * .32, roof, depth / 2 - .12,
      width * .3, piece === index % 3 ? 3.2 : 1.8, index * 7 + piece);
    const beam = this.box(building, this.rust, index % 2 ? width * .3 : -width * .25, roof + .7, 0, .14, 3.3, .14); beam.rotation.z = index % 2 ? -.8 : .65;
    for (let piece = 0; piece < 8; piece++) {
      const px = Math.sin(index * 13 + piece * 8) * width * .27, pz = Math.cos(index * 7 + piece * 4) * depth * .24;
      this.fragment(building, px, desertGroundHeight(x + px, z + pz) - .08, pz, width * .42, 1.1 + piece % 3 * .42, depth * .48, index + piece);
    }
    if (index !== 0) for (let piece = 0; piece < 3; piece++) {
      const px = (piece - 1) * width * .15;
      const block = this.box(building, this.brokenConcrete, px, 1.7 + piece * .6, -depth * .08, width * .62, .52, depth * .56);
      block.rotation.set(.2 + piece * .24, .05 * (index % 3 - 1), (piece - 1) * .19);
    }
  }

  private batchCity(city: THREE.Group): void {
    city.updateMatrixWorld(true);
    const inverse = city.matrixWorld.clone().invert();
    const batches = new Map<THREE.Material, THREE.BufferGeometry[]>();
    city.traverse(object => {
      if (!(object instanceof THREE.Mesh)) return;
      let geometry = object.geometry.clone().applyMatrix4(inverse.clone().multiply(object.matrixWorld));
      this.tileUvs(geometry);
      if (!geometry.index) { const indexed = mergeVertices(geometry); geometry.dispose(); geometry = indexed; }
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
    for (const [i, ruin] of DESERT_RUINS.entries()) this.brokenBuilding(city, ruin.x, ruin.z, ruin.width, ruin.depth, ruin.height, i);
    for (const [x, z, scale] of [[-54, -78, 1.7], [42, -91, 1.45], [5, -103, 2.1]] as const) {
      this.brokenBuilding(city, x, z, 12 * scale, 10 * scale, 28 * scale, 30 + Math.round(scale * 10));
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
    const clock = beat?.elapsed ?? elapsed;
    const positions = this.ash.geometry.attributes.position;
    for (let i = 0; i < positions.count; i++) {
      const fall = 1 + (i * 37 % 430) / 10 - .3 - clock * .72;
      positions.setY(i, .3 + (fall % 43.7 + 43.7) % 43.7);
      positions.setX(i, Math.sin(i * 91.17) * 82 + (Math.sin(clock * .35 + i) - Math.sin(i)) * .18);
    }
    positions.needsUpdate = true;
    this.towerGlow.emissiveIntensity = active ? .62 + THREE.MathUtils.smoothstep(t, 5, 9) * 1.15 + Math.sin(clock * 5) * .08 : .5;
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
