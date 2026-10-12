import * as THREE from 'three';
import { POD_RUNOFF, POD_WATER_DROP, podRunoffHeight, type AwakeningBeat } from '@auto_matrix/shared';
import { batchStaticGeometry } from './StaticGeometry.js';

/** The drained patient travels inside a real pipe and exits through a pierced wall. */
export class PodDrainRenderer {
  private root = new THREE.Group();
  private geometries = new Set<THREE.BufferGeometry>();
  private materials = new Set<THREE.Material>();
  private textures = new Set<THREE.Texture>();
  private water: THREE.Mesh;
  private splash: THREE.InstancedMesh;
  private rings: THREE.InstancedMesh;
  private foam: THREE.MeshBasicMaterial;
  private waterRest: Float32Array;
  private dummy = new THREE.Object3D();
  private disposed = false;
  private clock = NaN;

  constructor(parent: THREE.Group) {
    this.root.name = 'pod-drain'; parent.add(this.root);
    const { startZ, endZ, rows, columns, halfWidth: radius, thickness, outletDepth } = POD_RUNOFF;
    const wall = new THREE.MeshPhysicalMaterial({ color: 0x35484c, roughness: .46, metalness: .2, clearcoat: .6, side: THREE.DoubleSide,
      emissive: 0x142d3c, emissiveIntensity: .45 });
    const metal = new THREE.MeshStandardMaterial({ color: 0x33454a, roughness: .4, metalness: .7, side: THREE.DoubleSide });
    this.materials.add(wall); this.materials.add(metal);
    if (typeof document !== 'undefined') for (const [suffix, slot] of [['color', 'map'], ['normal', 'normalMap'], ['roughness', 'roughnessMap']] as const) {
      const texture = new THREE.TextureLoader().load(`/assets/film-materials/damaged_plaster-${suffix}.jpg`, value => { if (this.disposed) value.dispose(); });
      texture.wrapS = texture.wrapT = THREE.RepeatWrapping; texture.repeat.set(3, 8);
      if (slot === 'map') texture.colorSpace = THREE.SRGBColorSpace;
      this.textures.add(texture); wall[slot] = texture;
      if (slot === 'map') wall.emissiveMap = texture;
    }
    wall.normalScale.set(.2, .2);
    const positions: number[] = [], uv: number[] = [], indices: number[] = [], around = columns * 2;
    for (let row = 0; row <= rows + 1; row++) for (let col = 0; col <= around; col++) {
      const z = row > rows ? endZ + outletDepth : startZ + row / rows * (endZ - startZ), angle = col / around * Math.PI * 2;
      positions.push(Math.sin(angle) * radius, podRunoffHeight(0, z)! + radius - Math.cos(angle) * radius, z);
      uv.push(col / around, row / rows);
      if (row <= rows && col < around) {
        // The vertical inlet below the pod has a genuine roof opening.
        const roof = Math.cos((col + .5) / around * Math.PI * 2) < -.7;
        if (z < -9.5 && roof) continue;
        const a = row * (around + 1) + col;
        indices.push(a, a + 1, a + around + 1, a + 1, a + around + 2, a + around + 1);
      }
    }
    const inner = this.geometry(positions, indices, uv);
    this.mesh(inner, wall).name = 'pod-runoff-channel';
    const outerPositions = positions.map((value, i) => i % 3 === 0 ? value * (1 + thickness / radius)
      : i % 3 === 1 ? value + (value - (podRunoffHeight(0, positions[i + 1])! + radius)) * thickness / radius : value);
    this.mesh(this.geometry(outerPositions, indices, uv), metal).name = 'pod-drain-outer';
    const outletY = podRunoffHeight(0, endZ)! + radius;
    const shape = new THREE.Shape(); shape.moveTo(-10, -5); shape.lineTo(10, -5); shape.lineTo(10, 7); shape.lineTo(-10, 7); shape.closePath();
    const hole = new THREE.Path(); hole.absarc(0, 0, radius + .015, 0, Math.PI * 2, true); shape.holes.push(hole);
    const outlet = this.mesh(new THREE.ExtrudeGeometry(shape, { depth: outletDepth, bevelEnabled: false, curveSegments: 32 }), wall);
    outlet.name = 'pod-drain-outlet-wall'; outlet.position.set(0, outletY, endZ);
    for (const z of [endZ - .2, endZ + outletDepth]) {
      const lip = this.mesh(new THREE.TorusGeometry(radius + POD_RUNOFF.lipRadius, POD_RUNOFF.lipRadius, 8, 64), metal); lip.position.set(0, outletY, z);
    }
    const collars: THREE.Matrix4[] = [];
    for (let z = -8; z < endZ; z += 3) {
      this.dummy.position.set(0, podRunoffHeight(0, z)! + radius, z); this.dummy.scale.set(1, 1, 1); this.dummy.updateMatrix(); collars.push(this.dummy.matrix.clone());
    }
    const band = new THREE.TorusGeometry(radius + thickness, .09, 6, 48); this.geometries.add(band);
    const clamps = new THREE.InstancedMesh(band, metal, collars.length); collars.forEach((matrix, i) => clamps.setMatrixAt(i, matrix)); clamps.computeBoundingSphere(); this.root.add(clamps);
    const waterPositions: number[] = [], waterUv: number[] = [], waterIndices: number[] = [];
    const waterRows = 64, waterColumns = 16;
    for (let row = 0; row <= waterRows; row++) for (let col = 0; col <= waterColumns; col++) {
      const z = startZ + row / waterRows * (endZ + 2.5 - startZ), x = (col / waterColumns - .5) * 3.7;
      const spill = Math.max(0, (z - endZ - outletDepth) / (2.5 - outletDepth));
      const y = z <= endZ + outletDepth ? podRunoffHeight(x, z)! + .07
        : podRunoffHeight(x, endZ)! + .07 - (POD_WATER_DROP - 1.7 + podRunoffHeight(x, endZ)! + .07) * spill * spill;
      waterPositions.push(x * (1 + spill * .25), y, z); waterUv.push(col / waterColumns, row / waterRows);
      if (row < waterRows && col < waterColumns) { const a = row * (waterColumns + 1) + col; waterIndices.push(a, a + waterColumns + 1, a + 1, a + 1, a + waterColumns + 1, a + waterColumns + 2); }
    }
    const liquid = new THREE.MeshPhysicalMaterial({ color: 0x526d74, roughness: .19, metalness: .25, clearcoat: 1, transparent: true, opacity: .38, depthWrite: false, side: THREE.DoubleSide }); this.materials.add(liquid);
    this.water = this.mesh(this.geometry(waterPositions, waterIndices, waterUv), liquid); this.water.name = 'pod-drain-water';
    this.waterRest = new Float32Array(this.water.geometry.getAttribute('position').array);
    const foam = this.foam = new THREE.MeshBasicMaterial({ color: 0x66848d, transparent: true, opacity: .22, depthWrite: false }); this.materials.add(foam);
    const droplets = new THREE.SphereGeometry(.055, 6, 4); this.geometries.add(droplets);
    this.splash = new THREE.InstancedMesh(droplets, foam, 96); this.splash.name = 'pod-drain-splash'; this.splash.frustumCulled = false; this.root.add(this.splash);
    const ring = new THREE.RingGeometry(.987, 1, 64); ring.rotateX(-Math.PI / 2);
    const vertices = ring.getAttribute('position'), arcs: number[] = [];
    for (let i = 0; i < vertices.count; i++) {
      const angle = Math.atan2(vertices.getZ(i), vertices.getX(i)), variation = 1 + .018 * Math.sin(angle * 7) + .012 * Math.sin(angle * 13);
      vertices.setXYZ(i, vertices.getX(i) * variation, 0, vertices.getZ(i) * variation);
    }
    for (let i = 0; i < ring.index!.count; i += 6) {
      const segment = i / 6;
      if (segment % 17 < 12 && segment % 11 < 8) for (let j = 0; j < 6; j++) arcs.push(ring.index!.getX(i + j));
    }
    ring.setIndex(arcs); ring.computeBoundingSphere(); this.geometries.add(ring);
    this.rings = new THREE.InstancedMesh(ring, foam, 7); this.rings.frustumCulled = false; this.root.add(this.rings);
    const light = new THREE.PointLight(0x8daebd, 95, 13, 2); light.position.set(1, -7, -3); this.root.add(light);
    const bounce = new THREE.PointLight(0x7f9daa, 65, 12, 2); bounce.position.set(-1.4, podRunoffHeight(0, 2)! + radius + .8, 2); this.root.add(bounce);
    batchStaticGeometry(this.root, new Set([this.water])).forEach(geometry => this.geometries.add(geometry));
    this.update(undefined);
  }

  private geometry(positions: number[], indices: number[], uv: number[]): THREE.BufferGeometry {
    const geometry = new THREE.BufferGeometry(); geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); geometry.setIndex(indices); geometry.computeVertexNormals(); return geometry;
  }
  private mesh(geometry: THREE.BufferGeometry, material: THREE.Material): THREE.Mesh {
    this.geometries.add(geometry); const mesh = new THREE.Mesh(geometry, material); mesh.receiveShadow = true; this.root.add(mesh); return mesh;
  }
  update(beat?: AwakeningBeat): void {
    const clock = beat?.kind === 'disconnect' ? beat.elapsed : beat?.kind === 'rescue' ? 9 + beat.elapsed : 0;
    if (this.clock === clock) return;
    this.clock = clock;
    const emptied = THREE.MathUtils.smoothstep(clock, 8, 9);
    this.water.visible = clock >= 4 && emptied < 1;
    (this.water.material as THREE.MeshPhysicalMaterial).opacity = .38 * (1 - emptied);
    this.foam.opacity = .22 * (1 - emptied);
    const positions = this.water.geometry.getAttribute('position');
    for (let i = 0; i < positions.count; i++) {
      const x = this.waterRest[i * 3], y = this.waterRest[i * 3 + 1], z = this.waterRest[i * 3 + 2];
      positions.setY(i, y + .028 * Math.sin(z * 5.4 - clock * 12 + x * 3) + .015 * Math.sin(z * 11 - clock * 17 - x));
    }
    positions.needsUpdate = true; this.water.geometry.computeVertexNormals();
    this.splash.visible = this.rings.visible = clock >= 7 && emptied < 1;
    const waterY = -POD_WATER_DROP + 1.73;
    for (let i = 0; i < this.splash.count; i++) {
      const age = (clock * 1.6 + i * .137) % 1, angle = i * 2.39996, impact = i >= 64;
      const force = impact ? 1 - THREE.MathUtils.smoothstep(clock, 7.6, 9.1) : .65;
      const radius = (impact ? .6 : .8) + age * 2.6 * force;
      this.dummy.position.set(Math.sin(angle) * radius, waterY + 3.8 * age * (1 - age) * force,
        (impact ? 14.3 : POD_RUNOFF.endZ + 2.3) + Math.cos(angle) * radius);
      this.dummy.scale.set(.5 + force, 1.5 + 1.3 * force, .5 + force); this.dummy.scale.multiplyScalar((1 - age) * force);
      this.dummy.updateMatrix(); this.splash.setMatrixAt(i, this.dummy.matrix);
    }
    this.splash.instanceMatrix.needsUpdate = true;
    for (let i = 0; i < this.rings.count; i++) {
      const age = (clock * .7 + i / this.rings.count) % 1;
      this.dummy.position.set(Math.sin(i * 2.4) * .8, waterY + .005 * i, POD_RUNOFF.endZ + 2.3 + Math.cos(i * 2.4) * .9);
      this.dummy.scale.setScalar(.5 + 3.5 * age); this.dummy.updateMatrix(); this.rings.setMatrixAt(i, this.dummy.matrix);
    }
    this.rings.instanceMatrix.needsUpdate = true;
  }
  dispose(): void {
    this.disposed = true; this.root.traverse(object => { if (object instanceof THREE.InstancedMesh || object instanceof THREE.PointLight) object.dispose(); });
    this.root.removeFromParent(); this.geometries.forEach(geometry => geometry.dispose()); this.materials.forEach(material => material.dispose()); this.textures.forEach(texture => texture.dispose());
  }
}
