import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { HOTEL_SURFACES, HOTEL_WALLS, LAFAYETTE, lafayetteKnockPose, lafayetteSideDoor, type HotelApproach } from '@auto_matrix/shared';

export class LafayetteApproachRenderer {
  private root = new THREE.Group();
  private static = new THREE.Group();
  private door = new THREE.Group();
  private sideDoor = new THREE.Group();
  private lights: THREE.PointLight[] = [];
  private geometries = new Set<THREE.BufferGeometry>();
  private materials = new Set<THREE.Material>();
  private textures = new Set<THREE.Texture>();
  constructor(parent: THREE.Group, offset: THREE.Vector3, exterior = false) {
    parent.add(this.root); this.root.position.copy(offset); this.root.add(this.static);
    const mat = (color: number, roughness = .8, metalness = 0) => new THREE.MeshStandardMaterial({ color, roughness, metalness });
    const pbr = (id: string, color: number, repeat: number, roughness = .8) => {
      const material = mat(color, roughness);
      for (const [key, name] of [['map', 'color'], ['normalMap', 'normal'], ['roughnessMap', 'roughness']] as const) {
        const texture = new THREE.TextureLoader().load(`/assets/film-materials/${id}-${name}.jpg`);
        texture.wrapS = texture.wrapT = THREE.RepeatWrapping; texture.repeat.set(repeat, repeat); texture.anisotropy = 4;
        if (key === 'map') texture.colorSpace = THREE.SRGBColorSpace;
        material[key] = texture; this.textures.add(texture);
      }
      material.normalScale.set(.35, .35); return material;
    };
    const plaster = pbr('damaged_plaster', 0x8b8a72, 3);
    const stone = pbr('damaged_plaster', 0x535e56, 8);
    const wood = pbr('old_wood_floor', 0x736748, 2, .62);
    const wornEdge = mat(0x8c795c, .8); const trim = mat(0x4b4d3b, .65); const metal = mat(0x393d30, .53, .5);
    const dark = mat(0x171e1b); const crack = mat(0x3c4032); const glass = mat(0x23342d, .2, .55);
    const bulb = new THREE.MeshStandardMaterial({ color: 0xcfbc8e, emissive: 0xceb979, emissiveIntensity: .38, roughness: .65 });
    // All walkable treads and landings come from the collision data.
    for (const surface of HOTEL_SURFACES) {
      if (surface.x === 0 && surface.y === 84 && surface.depth === 50) continue;
      this.box(surface.x, surface.y - .14, surface.z, surface.width, .28, surface.depth, wood);
      if (surface.depth === 2) this.box(surface.x, surface.y + .018, surface.z + (surface.x === LAFAYETTE.left ? 1 : -1) * .9, surface.width, .04, .15, wornEdge);
    }
    for (const wall of HOTEL_WALLS) this.box(wall.x, wall.y + wall.height / 2, wall.z, wall.width, wall.height, wall.depth, plaster);
    // The unvisited lower rooms remain behind the exterior wall. The staircase
    // and service foyer are hollow, rather than hidden inside a solid hotel box.
    this.box(-21.5, 42, -2.5, 1, 84, 47, stone);
    this.box(14, 42, -25.5, 71, 84, 1, stone);
    this.box(-12, 42, 26, 19, 84, 1, stone);
    this.box(14.5, 45.5, 26, 35, 77, 1, stone);
    this.box(25.5, 3.5, 28.03, 45, 7, .06, stone);
    this.box(-3.5, 3.5, 28.03, 2, 7, .06, stone);
    this.box(0, 7.25, 26, 6, .5, 1.2, trim);
    this.box(22, 7, 24, 52, .24, 8, plaster);
    if (exterior) {
      this.box(-21.5, 91, 0, 1, 14, 51, stone); this.box(0, 91, -25.5, 44, 14, 1, stone);
      this.box(0, 91, 26, 44, 14, 1, stone); this.box(14, 98.4, 0, 71, .7, 54, stone);
    }
    // Rear facade, drain pipes and the open service door.
    for (let floor = 1; floor <= 13; floor++) {
      const y = (floor - 1) * 7;
      this.box(0, y + .25, 26.55, 44, .32, .65, trim);
      for (const x of [-16, -9, 8, 16]) {
        this.box(x, y + 4.1, 26.56, 3.4, 4.5, .06, glass);
        this.box(x, y + 4.1, 26.63, .12, 4.6, .12, trim);
        this.box(x, y + 1.8, 26.72, 3.9, .16, .6, stone);
      }
    }
    for (const x of [-20, 20]) this.rod(new THREE.Vector3(x, .2, 27), new THREE.Vector3(x, 97, 27), .13, metal);
    this.box(0, 7.5, 28.1, 6.5, .15, 3, metal);
    this.box(0, 7.2, 28.3, .8, .13, .6, bulb);
    this.label('LAFAYETTE / SERVICE', 0, 8.6, 26.7, 0, 6, 0.8);
    const serviceDoor = new THREE.Group(); serviceDoor.position.set(-2.75, 0, 26); serviceDoor.rotation.y = -1.35; this.static.add(serviceDoor);
    this.box(2.6, 3.3, 0, 5.2, 6.6, .16, metal, serviceDoor);
    for (let floor = 0; floor < 13; floor++) {
      const y = floor * 7;
      this.label(String(floor + 1).padStart(2, '0'), 47.92, y + 3.4, 23, -Math.PI / 2, 1.2, 1.5);
      this.box(39, y + 6.3, 24.6, .25, .6, .25, metal); this.box(39, y + 5.9, 24.6, .95, .3, .95, bulb);
      if (floor > 0 && floor < 12) {
        this.box(30.4, y + 3.5, 23, .2, 6.6, 4.7, trim);
        for (const z of [21, 25]) this.box(30.2, y + 3.5, z, .25, 7, .2, wood);
        this.box(30.2, y + 6.9, 23, .25, .2, 4.8, wood);
      }
      if (floor === 12) break;
      for (const x of [31.85, 38.15, 39.85, 46.15]) {
        const left = x < 39; const points: THREE.Vector3[] = [];
        for (let i = 0; i <= 12; i++) {
          const z = left ? 20 - i * 2 : -4 + i * 2; const h = y + (left ? 0 : 3.5) + i * 3.5 / 12;
          points.push(new THREE.Vector3(x, h + 2.3, z));
          this.rod(new THREE.Vector3(x, h + .05, z), new THREE.Vector3(x, h + 2.2, z), .055, metal);
          this.mesh(new THREE.SphereGeometry(.095, 8, 6), trim, new THREE.Vector3(x, h + 1.4, z));
        }
        this.mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points), 20, .1, 7, false), wood);
      }
      for (const z of [-7.8, 25.7]) this.rod(new THREE.Vector3(31, y + (z < 0 ? 5.8 : 2.3), z), new THREE.Vector3(47, y + (z < 0 ? 5.8 : 2.3), z), .1, wood);
      // Deliberate weathering patches and hairline cracks keep the repeating
      // flights legible while varying the damaged surface without random saves.
      for (let i = 0; i < 4; i++) {
        const z = -3 + i * 7; const h = y + 1.1 + (floor * 7 + i) % 3;
        const shape = new THREE.Shape(); shape.moveTo(0, 0); shape.lineTo(.8, .16); shape.lineTo(1.4, 1.3); shape.lineTo(.5, 2.1); shape.lineTo(-.25, 1.5); shape.closePath();
        const patch = this.mesh(new THREE.ShapeGeometry(shape), wornEdge, new THREE.Vector3(47.97, h, z)); patch.rotation.y = -Math.PI / 2;
        this.rod(new THREE.Vector3(47.94, h + 1.5, z), new THREE.Vector3(47.94, h + 2.4, z - .3), .012, crack);
      }
    }
    // The final hall has a worn runner, panelled doors, cornices and wall lamps.
    this.box(26, 84.025, 0, 5.2, .045, 45, pbr('leather_red_03', 0x35452b, 5, .97));
    this.box(26, 97.7, 0, 10, .4, 52, plaster);
    for (const x of [21.4, 30.1]) {
      for (const y of [84.3, 84.7, 87.3, 97]) {
        if (x === 21.4 && y < 91.7) for (const [z, depth] of [[-14.65, 22.7], [7.2, 7.8], [21.45, 9.1]] as const) this.box(x, y, z, .16, .16, depth, trim);
        else this.box(x, y, 0, .16, .16, 52, trim);
      }
      for (let z = -23; z < 24; z += 4) if (x !== 21.4 || Math.abs(z) > 3.3 && Math.abs(z - LAFAYETTE.sideDoor.z) > 3) this.box(x, 85.95, z, .1, 2.4, .1, trim);
    }
    for (const [i, z] of [-19, -10, 20].entries()) {
      this.box(21.4, 87.55, z, .17, 6.8, 4.7, wood);
      this.label(String([1309, 1311, 1315][i]), 21.52, 88.7, z, Math.PI / 2, 1.5, .65);
      this.box(29.95, 88.5, z, .2, .9, .6, metal); this.box(29.8, 89, z, .45, .65, .8, bulb);
    }
    for (const z of [-2.95, 2.95]) this.box(21.3, 87.8, z, .4, 7.7, .3, trim);
    this.box(21, 94.8, 0, .7, 6.4, 5.6, plaster);
    this.box(21.3, 91.7, 0, .5, .3, 6.2, trim);
    this.label('1313', 21.57, 92.5, 0, Math.PI / 2, 2.1, .85);
    this.door.position.set(21, 84, -2.8); this.root.add(this.door);
    this.box(0, 3.7, 2.8, .18, 7.4, 5.6, wood, this.door);
    for (const y of [1.65, 5.4]) for (const z of [1.45, 4.1]) {
      this.box(.13, y, z, .12, 2.4, 2.1, trim, this.door);
      this.box(.21, y, z, .06, 2.1, 1.8, wood, this.door);
    }
    this.box(.24, 3.45, 4.75, .18, .7, .2, metal, this.door);
    this.box(.42, 3.45, 4.47, .18, .14, .72, metal, this.door);
    this.sideDoor.position.set(LAFAYETTE.sideDoor.x, 84, LAFAYETTE.sideDoor.z - LAFAYETTE.sideDoor.depth / 2); this.root.add(this.sideDoor);
    this.box(0, LAFAYETTE.sideDoor.height / 2, LAFAYETTE.sideDoor.depth / 2, LAFAYETTE.sideDoor.width, LAFAYETTE.sideDoor.height, LAFAYETTE.sideDoor.depth, wood, this.sideDoor);
    for (const y of [1.65, 5.4]) for (const z of [1.35, 3.85]) {
      this.box(.12, y, z, .1, 2.35, 1.85, trim, this.sideDoor);
      this.box(.2, y, z, .05, 2.05, 1.55, wood, this.sideDoor);
    }
    this.box(.28, 3.45, 4.35, .16, .14, .65, metal, this.sideDoor);
    for (let i = 0; i < 3; i++) { const light = new THREE.PointLight(0xe8d9aa, 35, 19, 2); this.root.add(light); this.lights.push(light); }
    this.batch();
  }
  private mesh(geometry: THREE.BufferGeometry, material: THREE.Material, position = new THREE.Vector3(), parent: THREE.Object3D = this.static): THREE.Mesh {
    this.geometries.add(geometry); this.materials.add(material); const mesh = new THREE.Mesh(geometry, material); mesh.position.copy(position); mesh.castShadow = mesh.receiveShadow = true; parent.add(mesh); return mesh;
  }
  private box(x: number, y: number, z: number, w: number, h: number, d: number, material: THREE.Material, parent: THREE.Object3D = this.static): THREE.Mesh {
    const geometry = new THREE.BoxGeometry(w, h, d);
    if (material instanceof THREE.MeshStandardMaterial && material.map) {
      const uv = geometry.attributes.uv; const normal = geometry.attributes.normal;
      for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * (Math.abs(normal.getX(i)) > .5 ? d : w) / 12, uv.getY(i) * (Math.abs(normal.getY(i)) > .5 ? d : h) / 12);
    }
    return this.mesh(geometry, material, new THREE.Vector3(x, y, z), parent);
  }
  private rod(a: THREE.Vector3, b: THREE.Vector3, radius: number, material: THREE.Material): void {
    const mesh = this.mesh(new THREE.CylinderGeometry(radius, radius, a.distanceTo(b), 7), material, a.clone().add(b).multiplyScalar(.5));
    mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), b.clone().sub(a).normalize());
  }
  private label(text: string, x: number, y: number, z: number, yaw: number, w: number, h: number): void {
    const canvas = document.createElement('canvas'); canvas.width = 512; canvas.height = 128;
    const context = canvas.getContext('2d')!; context.fillStyle = '#313a2c'; context.fillRect(0, 0, 512, 128); context.fillStyle = '#cabf9a'; context.font = '54px serif'; context.textAlign = 'center'; context.fillText(text, 256, 86);
    const texture = new THREE.CanvasTexture(canvas); texture.colorSpace = THREE.SRGBColorSpace; this.textures.add(texture);
    const mesh = this.mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshStandardMaterial({ map: texture, roughness: .8 }), new THREE.Vector3(x, y, z)); mesh.rotation.y = yaw;
  }
  private batch(): void {
    this.static.updateWorldMatrix(true, true); const inverse = this.static.matrixWorld.clone().invert();
    const batches = new Map<THREE.Material, THREE.BufferGeometry[]>(); const meshes: THREE.Mesh[] = [];
    this.static.traverse(object => { if (object instanceof THREE.Mesh) {
      const geometry = object.geometry.clone().applyMatrix4(inverse.clone().multiply(object.matrixWorld));
      const material = object.material as THREE.Material; const list = batches.get(material) ?? []; list.push(geometry); batches.set(material, list); meshes.push(object);
    } });
    meshes.forEach(mesh => mesh.removeFromParent());
    for (const [material, geometries] of batches) { const geometry = mergeGeometries(geometries); geometries.forEach(g => g.dispose()); if (geometry) this.mesh(geometry, material); }
  }
  update(hotel: HotelApproach | undefined, height: number, exterior = false): void {
    const progress = hotel?.door === undefined ? hotel ? 0 : 1 : hotel.door / LAFAYETTE.doorSeconds;
    this.door.position.x = LAFAYETTE.door.x - lafayetteKnockPose(hotel?.knock ?? 0).strike * .035;
    this.door.rotation.y = -THREE.MathUtils.smoothstep(progress, 0, 1) * 1.48;
    this.sideDoor.rotation.y = -THREE.MathUtils.smoothstep(lafayetteSideDoor(hotel?.welcome), 0, 1) * 1.4;
    const floor = Math.max(0, Math.min(12, Math.floor(height / 7)));
    this.lights[0].position.set(39, floor * 7 + 5.5, 23);
    this.lights[1].position.set(45.5, floor * 7 + 5, -5);
    this.lights[2].position.set(exterior ? 0 : floor === 12 ? 27 : 12, exterior ? 7 : floor === 12 ? 90 : 5.6, exterior ? 29 : floor === 12 ? 0 : 23);
  }
  dispose(): void {
    this.lights.forEach(light => light.dispose()); this.geometries.forEach(g => g.dispose()); this.materials.forEach(m => m.dispose()); this.textures.forEach(t => t.dispose()); this.root.removeFromParent();
  }
}
