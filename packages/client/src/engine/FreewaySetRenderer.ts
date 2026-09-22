import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { FREEWAY_START, FREEWAY_FINISH, freewayTraffic, filmObstacles, type FilmSet, type FilmJourney, type Vector3 } from '@auto_matrix/shared';

/** The ride, traffic and roadside barriers share the server's road coordinates. */
export class FreewaySetRenderer {
  private root = new THREE.Group();
  private geometries = new Set<THREE.BufferGeometry>();
  private materials = new Set<THREE.Material>();
  private textures = new Set<THREE.Texture>();
  private bike = new THREE.Group();
  private wheels: THREE.Mesh[] = [];
  private traffic: { mesh: THREE.InstancedMesh; part: THREE.Matrix4; truck: boolean; paint: boolean }[] = [];
  private previousElapsed = 0;
  private clock = 0;
  private syncAt = 0;
  private matrix = new THREE.Matrix4();
  private color = new THREE.Color();
  private paint: THREE.MeshStandardMaterial;
  private rubber: THREE.MeshStandardMaterial;
  private steel: THREE.MeshStandardMaterial;
  private windows: THREE.MeshStandardMaterial;
  private white: THREE.MeshStandardMaterial;

  constructor(parent: THREE.Group, private set: FilmSet) {
    parent.add(this.root);
    this.paint = this.mat(0xffffff, .26, .65); this.rubber = this.mat(0x121713, .9); this.steel = this.mat(0x858c82, .34, .8);
    this.windows = this.mat(0x1e393b, .13, .7); this.white = this.mat(0xd3cfb9, .85);
    this.buildRoad(); this.batch(); this.buildBike(); this.buildTraffic(false); this.buildTraffic(true);
  }
  private mat(color: number, roughness: number, metalness = 0): THREE.MeshStandardMaterial {
    const mat = new THREE.MeshStandardMaterial({ color, roughness, metalness }); this.materials.add(mat); return mat;
  }
  private mesh(geometry: THREE.BufferGeometry, material: THREE.Material, x: number, y: number, z: number, parent: THREE.Group = this.root): THREE.Mesh {
    this.geometries.add(geometry); const mesh = new THREE.Mesh(geometry, material); mesh.position.set(x, y, z); mesh.castShadow = mesh.receiveShadow = true; parent.add(mesh); return mesh;
  }
  private box(mat: THREE.Material, x: number, y: number, z: number, w: number, h: number, d: number, parent = this.root, bevel = 0): THREE.Mesh {
    return this.mesh(bevel ? new RoundedBoxGeometry(w, h, d, 2, bevel) : new THREE.BoxGeometry(w, h, d), mat, x, y, z, parent);
  }
  private cylinder(mat: THREE.Material, x: number, y: number, z: number, r: number, h: number, parent = this.root): THREE.Mesh {
    return this.mesh(new THREE.CylinderGeometry(r, r, h, 16), mat, x, y, z, parent);
  }
  private buildRoad(): void {
    const canvas = document.createElement('canvas'); canvas.width = canvas.height = 512;
    const ctx = canvas.getContext('2d')!; const pixels = ctx.createImageData(512, 512);
    let seed = 12;
    for (let i = 0; i < pixels.data.length; i += 4) {
      seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; const tone = 78 + (seed >>> 26);
      pixels.data.set([tone, tone + 2, tone - 3, 255], i);
    }
    ctx.putImageData(pixels, 0, 0);
    const roadTexture = new THREE.CanvasTexture(canvas); roadTexture.wrapS = roadTexture.wrapT = THREE.RepeatWrapping; roadTexture.repeat.set(10, 240); roadTexture.colorSpace = THREE.SRGBColorSpace; roadTexture.anisotropy = 8; this.textures.add(roadTexture);
    const road = this.mat(0x676e67, .93); road.map = roadTexture;
    this.box(road, 0, -.3, 0, 60, .6, 1600);
    const concrete = this.mat(0xaaa995, .94); const yellow = this.mat(0xc1a342, .86);
    for (const o of filmObstacles(this.set)) {
      this.box(concrete, o.x, o.height / 2, 0, o.width, o.height, o.depth);
      this.box(this.steel, o.x, o.height + .1, 0, .24, .2, o.depth);
      for (let z = -790; z < 800; z += 16) this.box(this.steel, o.x, o.height + .55, z, .16, 1, .16);
    }
    for (const x of [-26, -2.8, 2.8, 26]) this.box(yellow, x, .015, 0, .18, .025, 1600);
    for (const x of [-18, -10, 10, 18]) for (let z = -796; z < 800; z += 20) this.box(this.white, x, .025, z, .22, .025, 8);
    for (const side of [-1, 1]) for (let z = -780; z < 800; z += 80) {
      this.cylinder(this.steel, side * 29, 11, z, .16, 22);
      this.box(this.steel, side * 26, 22, z, 6, .2, .2);
      this.box(this.white, side * 23.2, 21.85, z, 2, .32, .7);
    }
    for (const z of [-480, -40, 400]) {
      this.box(concrete, 0, 17, z, 120, 2, 18);
      for (const x of [-35, 35]) { this.box(concrete, x, 8, z, 4, 16, 12); this.box(this.steel, x, 20, z, .25, 4, 19); }
      this.box(concrete, 0, 19, z - 9, 120, 2, .5); this.box(concrete, 0, 19, z + 9, 120, 2, .5);
      for (let x = -55; x < 60; x += 3) this.box(this.steel, x, 21, z - 9, .06, 3, .06);
    }
    for (const z of [560, 180, -230, -590]) {
      for (const x of [-30, 30]) this.box(this.steel, x, 13, z, .65, 26, .65);
      this.box(this.steel, 0, 25, z, 61, .8, .8);
      this.sign(z > 0 ? '101  NORTH     DOWNTOWN' : 'EXIT  23     CITY CENTER', 14, 22, z, 23);
    }
    // Industrial edges, shallow embankments and repeating sound barriers give the road depth.
    const wall = this.mat(0x8b907d, .97); const earth = this.mat(0x72735b, 1);
    for (const side of [-1, 1]) {
      this.box(earth, side * 83, -1, 0, 100, 2, 1660);
      for (let z = -790; z < 800; z += 24) {
        this.box(wall, side * 42, 4.2, z, 1, 8.4, 23.7);
        this.box(concrete, side * 42, 4.5, z - 12, 1.35, 9, .4);
      }
      for (let z = -740; z < 800; z += 132) {
        const h = 12 + (Math.abs(z) % 7) * 4;
        this.box(wall, side * 73, h / 2, z, 37, h, 65);
        this.box(this.rubber, side * 73, h + .4, z, 39, .8, 67);
        for (let y = 6; y < h; y += 5) for (let dz = -26; dz < 30; dz += 7) this.box(this.windows, side * 54.4, y, z + dz, .1, 2.5, 4.8);
      }
    }
    this.sign('MORPHEUS   ↓', 18, 6, FREEWAY_FINISH - 10, 10);
  }
  private sign(text: string, x: number, y: number, z: number, w: number): void {
    const canvas = document.createElement('canvas'); canvas.width = 1024; canvas.height = 256;
    const ctx = canvas.getContext('2d')!; ctx.fillStyle = '#355443'; ctx.fillRect(0, 0, 1024, 256); ctx.strokeStyle = '#dedfcf'; ctx.lineWidth = 7; ctx.strokeRect(12, 12, 1000, 232);
    ctx.fillStyle = '#e8e9d9'; ctx.font = 'bold 58px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(text, 512, 116, 950); ctx.font = '44px sans-serif'; ctx.fillText('↓                 ↓', 512, 200);
    const texture = new THREE.CanvasTexture(canvas); texture.colorSpace = THREE.SRGBColorSpace; this.textures.add(texture);
    const mat = this.mat(0xffffff, .8); mat.map = texture;
    this.mesh(new THREE.PlaneGeometry(w, w / 4), mat, x, y, z);
  }
  private buildBike(): void {
    this.root.add(this.bike); this.bike.position.set(14, 0, FREEWAY_START);
    const green = this.mat(0x344732, .23, .6); const light = this.mat(0xdce8ba, .18); const red = this.mat(0x921814, .35);
    this.box(green, 0, 2.05, -.65, 1.65, 1.3, 2.8, this.bike, .24);
    this.box(green, 0, 2.1, -2.3, 1.8, 1.6, 1.15, this.bike, .28);
    this.box(this.windows, 0, 2.9, -2.15, 1.35, .85, .12, this.bike, .04).rotation.x = -.4;
    this.box(light, 0, 2.05, -2.91, 1.4, .35, .07, this.bike, .08);
    this.box(this.rubber, 0, 2.05, 1.2, 1.4, .4, 2.3, this.bike, .15);
    this.box(green, 0, 1.6, 2.6, 1.6, .9, 1.25, this.bike, .18);
    this.box(red, 0, 1.95, 3.25, .9, .2, .08, this.bike);
    this.box(this.steel, 0, 2.5, -1.55, 2.35, .14, .16, this.bike);
    for (const x of [-.9, .9]) { this.box(this.rubber, x, 2.5, -1.55, .5, .2, .2, this.bike); this.box(this.steel, x, .9, .3, .6, .12, .22, this.bike); }
    for (const z of [-2.1, 2.2]) {
      const tire = this.cylinder(this.rubber, 0, .98, z, .98, .62, this.bike); tire.rotation.z = Math.PI / 2; this.wheels.push(tire);
      for (const x of [-.33, .33]) { const disc = this.cylinder(this.steel, x, .98, z, .61, .025, this.bike); disc.rotation.z = Math.PI / 2; }
    }
    for (const x of [-.6, .6]) { this.box(this.steel, x, 1.6, -1.85, .14, 1.55, .18, this.bike).rotation.x = -.25; this.box(this.steel, x, .8, 1.1, .18, .25, 2, this.bike); }
    this.cylinder(this.rubber, .95, 1.1, 2, .24, 2.2, this.bike).rotation.x = Math.PI / 2;
  }
  private buildTraffic(truck: boolean): void {
    const prototype = new THREE.Group(); const count = freewayTraffic(0).filter(c => c.truck === truck).length;
    this.box(this.paint, 0, 1.8, 0, truck ? 5 : 4.1, 1.4, truck ? 17 : 8.7, prototype, .3);
    this.box(this.windows, 0, truck ? 3.7 : 3, truck ? -6.1 : .15, truck ? 4.5 : 3.6, truck ? 2.5 : 1.4, truck ? 3.5 : 4.3, prototype, .22);
    this.box(this.paint, 0, truck ? 5 : 3.8, truck ? -6 : .2, truck ? 4.7 : 3.75, .2, truck ? 3.7 : 4.6, prototype, .07);
    if (truck) {
      this.box(this.white, 0, 4.35, 2.3, 5.4, 6.5, 12.9, prototype, .12);
      for (let z = -3.8; z < 8.8; z += .7) for (const x of [-2.72, 2.72]) this.box(this.steel, x, 4.45, z, .025, 6.1, .045, prototype);
    }
    for (const side of [-1, 1]) for (const z of truck ? [-6.5, 3.8, 6.8] : [-2.8, 2.7]) {
      this.cylinder(this.rubber, side * (truck ? 2.4 : 1.96), 1, z, truck ? 1.1 : .95, .6, prototype).rotation.z = Math.PI / 2;
      this.cylinder(this.steel, side * (truck ? 2.74 : 2.28), 1, z, .56, .06, prototype).rotation.z = Math.PI / 2;
    }
    for (const side of [-1, 1]) {
      this.box(this.white, side * 1.4, 1.9, truck ? -8.6 : -4.4, .9, .38, .1, prototype);
      this.box(this.rubber, side * 1.88, 2.35, .2, .1, .12, truck ? 2 : 3.8, prototype);
      this.box(this.steel, side * 2.12, 2.8, -1.1, .55, .35, .55, prototype, .06);
    }
    this.box(this.steel, 0, 1.25, truck ? -8.65 : -4.45, truck ? 4.8 : 3.9, .26, .16, prototype);
    this.batch(prototype); prototype.updateMatrixWorld(true);
    // Each body part is one instanced draw for the whole traffic stream.
    for (const object of prototype.children as THREE.Mesh[]) {
      const mesh = new THREE.InstancedMesh(object.geometry, object.material, count); mesh.castShadow = mesh.receiveShadow = true; mesh.frustumCulled = false; mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage); this.root.add(mesh);
      this.traffic.push({ mesh, part: object.matrix.clone(), truck, paint: object.material === this.paint });
    }
  }
  update(journey: FilmJourney | undefined, elapsed: number, playerPosition?: Vector3): void {
    const ride = journey?.ride;
    if (ride && ride.elapsed !== this.previousElapsed) { this.clock = ride.elapsed; this.previousElapsed = ride.elapsed; this.syncAt = elapsed; }
    const traffic = freewayTraffic(ride ? this.clock + (ride.phase === 'riding' ? Math.min(.5, elapsed - this.syncAt) : 0) : elapsed);
    const pose = new THREE.Object3D();
    for (const batch of this.traffic) {
      let i = 0;
      for (const car of traffic) if (car.truck === batch.truck) {
        pose.position.set(car.x, 0, car.z); pose.rotation.set(0, car.speed > 0 ? Math.PI : 0, 0); pose.updateMatrix();
        this.matrix.multiplyMatrices(pose.matrix, batch.part); batch.mesh.setMatrixAt(i, this.matrix);
        if (batch.paint) batch.mesh.setColorAt(i, this.color.setHex(car.color)); i++;
      }
      batch.mesh.instanceMatrix.needsUpdate = true; if (batch.mesh.instanceColor) batch.mesh.instanceColor.needsUpdate = true;
    }
    this.bike.visible = !journey || journey.scene === 'm2_freeway' || journey.visiting === 'm2_freeway';
    const riding = ride?.phase === 'riding' && playerPosition && !journey?.visiting;
    this.bike.position.set(riding ? playerPosition.x - this.set.center.x : ride?.x ?? 14, 0, riding ? playerPosition.z - this.set.center.z : ride?.z ?? FREEWAY_START);
    this.bike.rotation.y = ride ? -Math.atan2(ride.lateral, Math.max(1, ride.speed)) : 0;
    this.bike.rotation.z = ride ? -ride.lateral * .025 : 0;
    for (const wheel of this.wheels) wheel.rotation.x = -(FREEWAY_START - (ride?.z ?? FREEWAY_START));
  }
  private batch(parent = this.root): void {
    parent.updateMatrixWorld(true); const batches = new Map<THREE.Material, THREE.BufferGeometry[]>();
    for (const child of [...parent.children]) if (child instanceof THREE.Mesh && !Array.isArray(child.material)) {
      const source = child.geometry.clone().applyMatrix4(child.matrix); const geometry = source.index ? source.toNonIndexed() : source;
      if (source !== geometry) source.dispose();
      const list = batches.get(child.material) ?? []; list.push(geometry); batches.set(child.material, list); parent.remove(child);
    }
    for (const [material, geometries] of batches) {
      const geometry = mergeGeometries(geometries); geometries.forEach(g => g.dispose());
      if (geometry) this.mesh(geometry, material, 0, 0, 0, parent);
    }
  }
  dispose(): void {
    this.root.traverse(object => { if (object instanceof THREE.InstancedMesh) object.dispose(); });
    this.root.removeFromParent(); this.geometries.forEach(g => g.dispose()); this.materials.forEach(m => m.dispose()); this.textures.forEach(t => t.dispose());
  }
}
