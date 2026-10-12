import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { mergeGeometries, mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';
import { CABIN, CABIN_WALLS } from '@auto_matrix/shared';

/** Worn pressure cabin. Decorative relief stays inside the shared bulkheads. */
export class NebCabinRenderer {
  readonly root = new THREE.Group();
  readonly door: THREE.Mesh;
  private geometries = new Set<THREE.BufferGeometry>();
  private materials = new Set<THREE.Material>();
  private textures = new Set<THREE.Texture>();
  private paint = this.material(new THREE.MeshStandardMaterial({ color: 0x414b4d, roughness: .84, metalness: .48 }));
  private steel = this.material(new THREE.MeshStandardMaterial({ color: 0x626b69, roughness: .68, metalness: .74 }));
  private dark = this.material(new THREE.MeshStandardMaterial({ color: 0x18201f, roughness: .86, metalness: .32 }));
  private rubber = this.material(new THREE.MeshStandardMaterial({ color: 0x101716, roughness: .96 }));
  private cotton = this.material(new THREE.MeshStandardMaterial({ color: 0x7b8076, roughness: .98 }));

  constructor(parent: THREE.Group) {
    this.root.name = 'neb-waking-cabin'; parent.add(this.root);
    this.paint.name = 'neb-cabin-painted-steel'; this.cotton.name = 'neb-cabin-cotton';
    this.surface('neb-cabin-painted-steel-v1.png', this.paint, 0xbfc4c2, .009);
    this.surface('neb-cabin-cotton-v1.png', this.cotton, 0xb6b9a8, .004);
    CABIN_WALLS.forEach((wall, index) => this.bulkhead(wall, index));
    this.ceiling(); this.bed(); this.floor();
    const locker = CABIN.locker;
    this.box(this.root, this.paint, locker.x, 2.2, locker.z, locker.width, 3.8, locker.depth, 'neb-cabin-locker');
    this.box(this.root, this.dark, locker.x - locker.width / 2 + .025, 2.5, locker.z + .1, .05, .4, .13);
    this.door = this.hatch();
  }

  private material<T extends THREE.Material>(material: T): T { this.materials.add(material); return material; }
  private surface(file: string, material: THREE.MeshStandardMaterial, tint: number, relief: number): void {
    if (typeof document === 'undefined') return;
    const texture = new THREE.TextureLoader().load(`/assets/film-materials/${file}`, loaded => {
      if (!this.materials.has(material)) return;
      material.map = material.bumpMap = loaded; material.bumpScale = relief;
      material.color.setHex(tint); material.needsUpdate = true;
    });
    texture.wrapS = texture.wrapT = THREE.RepeatWrapping; texture.colorSpace = THREE.SRGBColorSpace; texture.anisotropy = 4;
    this.textures.add(texture);
  }
  private mesh(parent: THREE.Object3D, geometry: THREE.BufferGeometry, material: THREE.Material, name?: string, tile = 2): THREE.Mesh {
    if (material === this.paint || material === this.cotton) {
      const position = geometry.attributes.position, normal = geometry.attributes.normal, uv = geometry.attributes.uv;
      for (let i = 0; i < uv.count; i++) {
        const x = position.getX(i), y = position.getY(i), z = position.getZ(i);
        uv.setXY(i, (Math.abs(normal.getX(i)) > .5 ? z : x) / tile, (Math.abs(normal.getY(i)) > .5 ? z : y) / tile);
      }
    }
    this.geometries.add(geometry);
    const mesh = new THREE.Mesh(geometry, material); mesh.castShadow = mesh.receiveShadow = true;
    if (name) mesh.name = name; parent.add(mesh); return mesh;
  }
  private box(parent: THREE.Object3D, material: THREE.Material, x: number, y: number, z: number, w: number, h: number, d: number, name?: string): THREE.Mesh {
    const mesh = this.mesh(parent, new THREE.BoxGeometry(w, h, d), material, name); mesh.position.set(x, y, z); return mesh;
  }
  private pipe(parent: THREE.Object3D, points: THREE.Vector3[], radius: number, material: THREE.Material): void {
    this.mesh(parent, new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points), Math.max(12, points.length * 6), radius, 6), material);
  }
  private batch(group: THREE.Group): void {
    group.updateMatrixWorld(true);
    const inverse = group.matrixWorld.clone().invert(), batches = new Map<THREE.Material, THREE.BufferGeometry[]>();
    for (const child of [...group.children]) {
      if (!(child instanceof THREE.Mesh) || child instanceof THREE.InstancedMesh || Array.isArray(child.material)) continue;
      const source = child.geometry.clone().applyMatrix4(inverse.clone().multiply(child.matrixWorld));
      const geometry = source.index ? source : mergeVertices(source, 1e-6);
      if (geometry !== source) source.dispose();
      const list = batches.get(child.material) ?? []; list.push(geometry); batches.set(child.material, list);
      this.geometries.delete(child.geometry); child.geometry.dispose(); child.removeFromParent();
    }
    for (const [material, pieces] of batches) {
      const geometry = mergeGeometries(pieces); pieces.forEach(piece => piece.dispose());
      if (!geometry) throw new Error('Cabin geometry could not be merged');
      this.geometries.add(geometry);
      const mesh = new THREE.Mesh(geometry, material); mesh.name = `${group.name}-${material.name || 'hardware'}`;
      mesh.castShadow = mesh.receiveShadow = true; group.add(mesh);
    }
  }

  private bulkhead(wall: typeof CABIN_WALLS[number], index: number): void {
    const group = new THREE.Group(); group.name = `neb-cabin-bulkhead-${index}`; this.root.add(group);
    group.position.set(wall.x, 0, wall.z);
    group.rotation.y = index === 0 ? 0 : index === 1 ? Math.PI : index === 2 ? -Math.PI / 2 : Math.PI / 2;
    const length = index < 2 ? wall.width : wall.depth, thickness = index < 2 ? wall.depth : wall.width;
    this.box(group, this.dark, 0, wall.height / 2, -.3, length, wall.height, .18);
    const columns = Math.max(1, Math.ceil(length / 2.8)), width = length / columns;
    for (let column = 0; column < columns; column++) for (let row = 0; row < 3; row++) {
      const x = -length / 2 + (column + .5) * width, height = wall.height / 3;
      this.box(group, this.paint, x, (row + .5) * height, -.04, width - .055, height - .075, .16);
    }
    for (let i = 0; i <= columns; i++) {
      const x = THREE.MathUtils.clamp(-length / 2 + i * width, -length / 2 + .07, length / 2 - .07);
      this.box(group, this.steel, x, wall.height / 2, .22, .12, wall.height, .3);
      for (const y of [.38, 2.4, 4.7, 6.35]) {
        const bolt = this.mesh(group, new THREE.CylinderGeometry(.045, .045, .05, 6), this.dark);
        bolt.rotation.x = Math.PI / 2; bolt.position.set(x, y, thickness / 2 - .03);
      }
    }
    for (const y of [.12, 2.27, 4.54, 6.66]) this.box(group, this.dark, 0, y, .14, length, .09, .2);
    if (index === 2) {
      const cover = this.mesh(group, new RoundedBoxGeometry(2.05, .95, .17, 3, .08), this.paint);
      cover.position.set(2.45, 3.8, .2);
      for (const x of [1.59, 3.31]) {
        const bolt = this.mesh(group, new THREE.CylinderGeometry(.055, .055, .05, 8), this.steel);
        bolt.rotation.x = Math.PI / 2; bolt.position.set(x, 3.8, .32);
      }
      for (let i = 0; i < 8; i++) {
        const x = -2.1 + i * .075;
        this.pipe(group, [new THREE.Vector3(x, 6.45, .3), new THREE.Vector3(x, 4.8, .3), new THREE.Vector3(x, 1.55, .3)], .025, this.rubber);
      }
      for (const y of [2.1, 4.2, 6.1]) this.box(group, this.steel, -1.8375, y, .33, .75, .09, .1);
      for (const x of [-4.8, 4.75]) {
        this.box(group, this.paint, x, 4.9, .15, .65, .45, .3);
        this.pipe(group, [new THREE.Vector3(x, 4.7, .3), new THREE.Vector3(x, 4.0, .3), new THREE.Vector3(x + .35, 3.6, .3), new THREE.Vector3(x + .7, 4.0, .3), new THREE.Vector3(x + .7, 4.7, .3)], .045, this.rubber);
      }
    }
    this.batch(group);
  }

  private ceiling(): void {
    const group = new THREE.Group(); group.name = 'neb-cabin-ceiling'; this.root.add(group);
    const { height, headroom } = CABIN.ceiling;
    for (const z of [-38.25, -34.75, -31.25, -27.75]) {
      this.box(group, this.paint, 12, height + .01, z, 11.2, .16, 3.43);
      this.box(group, this.steel, 12, height - .23, z - 1.65, 11.3, .25, .16);
    }
    for (let i = 0; i < 6; i++) {
      const x = 7.2 + i * .12;
      this.pipe(group, [new THREE.Vector3(x, headroom + .13, -39.5), new THREE.Vector3(x, headroom + .08, -36), new THREE.Vector3(x, headroom + .09, -29), new THREE.Vector3(x + 1, headroom + .05, -26.6)], .038, this.rubber);
    }
    const fixture = this.material(new THREE.MeshBasicMaterial({ color: 0xd1d9d6, toneMapped: false }));
    this.box(group, this.dark, 13.2, height - .29, -32, 3.95, .19, .5);
    this.box(group, fixture, 13.2, height - .41, -32, 3.6, .08, .22, 'neb-cabin-light-strip');
    this.batch(group);
  }

  private bed(): void {
    const group = new THREE.Group(); group.name = 'neb-cabin-bed'; this.root.add(group);
    const { x, z, surface } = CABIN.bed; group.position.set(x, 0, z);
    this.box(group, this.dark, 0, .32, 0, 2.65, .54, 6.7, 'neb-cabin-bed-base');
    this.box(group, this.steel, 0, .66, 0, 3.15, .14, 6.95, 'neb-cabin-bed-frame');
    for (const side of [-1, 1]) for (const end of [-1, 1]) this.box(group, this.steel, side * 1.3, .33, end * 2.65, .1, .66, .13);
    const mattress = this.mesh(group, new RoundedBoxGeometry(2.85, .38, 6.35, 3, .12), this.cotton, 'neb-cabin-mattress', .7);
    mattress.position.y = surface - .19;
    const pillow = this.mesh(group, new RoundedBoxGeometry(1.55, .2, 1.12, 4, .07), this.cotton, 'neb-cabin-pillow', .65);
    pillow.position.set(0, surface + .1, 2.05);
    const blanket = this.mesh(group, new RoundedBoxGeometry(2.72, .17, .9, 3, .055), this.cotton, 'neb-cabin-folded-blanket', .7);
    blanket.position.set(0, 1.21, -2.5); blanket.rotation.y = .025;
    this.batch(group);
  }

  private floor(): void {
    const group = new THREE.Group(); group.name = 'neb-cabin-grated-deck'; this.root.add(group);
    const deck = CABIN.deck;
    this.box(group, this.dark, deck.x, -.085, deck.z, deck.width, .07, deck.depth);
    const geometry = new THREE.BoxGeometry(.065, .035, deck.depth); this.geometries.add(geometry);
    const bars = new THREE.InstancedMesh(geometry, this.steel, 49); bars.name = 'neb-cabin-grating'; bars.castShadow = bars.receiveShadow = true;
    for (let i = 0; i < bars.count; i++) bars.setMatrixAt(i, new THREE.Matrix4().makeTranslation(deck.x - deck.width / 2 + .15 + i * .225, -.0175, deck.z));
    group.add(bars);
    for (const z of [-39.6, -37.4, -35.2, -33, -30.8, -28.6, -26.4]) this.box(group, this.steel, deck.x, -.025, z, deck.width, .035, .07);
    // The instanced longitudinal bars remain one draw; the crossbars merge separately.
    this.batch(group);
  }

  private hatch(): THREE.Mesh {
    const width = CABIN.door.width, height = 5.8, shape = new THREE.Shape();
    shape.moveTo(-width / 2, -height / 2); shape.lineTo(width / 2, -height / 2);
    shape.lineTo(width / 2, height / 2 - .55); shape.quadraticCurveTo(width / 2, height / 2, width / 2 - .55, height / 2);
    shape.lineTo(-width / 2 + .55, height / 2); shape.quadraticCurveTo(-width / 2, height / 2, -width / 2, height / 2 - .55); shape.closePath();
    const geometry = new THREE.ExtrudeGeometry(shape, { depth: .22, bevelEnabled: false, curveSegments: 8 }); geometry.translate(0, 0, -.11); geometry.rotateY(Math.PI / 2);
    const door = this.mesh(this.root, geometry, this.paint, 'neb-cabin-door'); door.position.set(CABIN.door.x, height / 2, CABIN.door.z);
    this.box(door, this.steel, .15, 0, .9, .12, .72, .14);
    const frame = new THREE.Shape(), outer = width / 2 + .35, inner = width / 2;
    frame.moveTo(-outer, 0); frame.lineTo(-outer, 5.85); frame.quadraticCurveTo(-outer, 6.4, -outer + .55, 6.4);
    frame.lineTo(outer - .55, 6.4); frame.quadraticCurveTo(outer, 6.4, outer, 5.85); frame.lineTo(outer, 0);
    frame.lineTo(inner, 0); frame.lineTo(inner, 5.25); frame.quadraticCurveTo(inner, 5.8, inner - .55, 5.8);
    frame.lineTo(-inner + .55, 5.8); frame.quadraticCurveTo(-inner, 5.8, -inner, 5.25); frame.lineTo(-inner, 0); frame.closePath();
    const surround = new THREE.ExtrudeGeometry(frame, { depth: .45, bevelEnabled: false, curveSegments: 8 }); surround.translate(0, 0, -.225); surround.rotateY(Math.PI / 2);
    const rim = this.mesh(this.root, surround, this.steel, 'neb-cabin-hatch-frame'); rim.position.set(CABIN.door.x, 0, CABIN.door.z);
    return door;
  }

  dispose(): void {
    this.root.traverse(object => { if (object instanceof THREE.InstancedMesh) object.dispose(); });
    this.root.removeFromParent(); this.root.clear();
    this.geometries.forEach(geometry => geometry.dispose()); this.materials.forEach(material => material.dispose()); this.textures.forEach(texture => texture.dispose());
    this.geometries.clear(); this.materials.clear(); this.textures.clear();
  }
}
