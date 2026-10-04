import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { FREEWAY_START, FREEWAY_FINISH, TRUCKS, freewayTraffic, filmObstacles, type FilmSet, type FilmJourney, type Vector3 } from '@auto_matrix/shared';

/** The ride, traffic and roadside barriers share the server's road coordinates. */
export class FreewaySetRenderer {
  private root = new THREE.Group();
  private geometries = new Set<THREE.BufferGeometry>();
  private materials = new Set<THREE.Material>();
  private textures = new Set<THREE.Texture>();
  private bike = new THREE.Group();
  private heroTruck?: THREE.Group;
  private oncomingTruck?: THREE.Group;
  private niobeCar?: THREE.Group;
  private neoTrail?: THREE.Group;
  private impact?: THREE.Group;
  private fire?: THREE.Group;
  private smoke?: THREE.Group;
  private fragments?: THREE.Group;
  private crumple: THREE.Mesh[] = [];
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
    if (set.id === 'film_freeway_trucks') this.buildTruckScene();
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
  private buildTruckScene(): void {
    const trailer = this.mat(0xc4c7bd, .78, .18); const roof = this.mat(0xb1b9ae, .86, .12); const cab = this.mat(0x32433e, .35, .43);
    const red = this.mat(0x973b2c, .45, .35); const lamp = this.mat(0xffdca4, .19);
    const buildRig = (body: THREE.Material, name: string): THREE.Group => {
      const rig = new THREE.Group(); rig.name = name; this.root.add(rig);
      this.box(this.rubber, 0, 1.15, 2.5, 5.3, .7, 25, rig, .15);
      this.box(trailer, 0, 3.6, 3.5, 5.6, 6, 20, rig, .1);
      this.box(roof, 0, TRUCKS.roof.height + .01, 3.5, 5.65, .07, 19.9, rig);
      for (let z = -6; z <= 12; z += 1.8) this.box(this.steel, 0, TRUCKS.roof.height + .08, z, 5.45, .035, .06, rig);
      for (const x of [-2.84, 2.84]) for (let z = -6; z < 13; z += 2.4) this.box(this.steel, x, 3.7, z, .055, 5.65, .1, rig);
      this.box(body, 0, 2.8, -10.4, 5.35, 3.7, 6.8, rig, .35);
      this.box(body, 0, 4.25, -11.8, 5, 2.8, 3.6, rig, .4);
      this.box(this.windows, 0, 4.45, -13.62, 4.35, 2, .06, rig);
      for (const x of [-2.1, 2.1]) {
        this.box(lamp, x, 2.2, -13.84, .7, .4, .08, rig, .05);
        this.box(this.rubber, x * 1.13, 3.4, -11.3, .3, .65, .65, rig, .08);
      }
      for (const side of [-1, 1]) for (const z of [-11, 1, 7, 11]) {
        const wheel = this.cylinder(this.rubber, side * 2.52, 1, z, 1.08, .65, rig); wheel.rotation.z = Math.PI / 2;
        const hub = this.cylinder(this.steel, side * 2.88, 1, z, .57, .04, rig); hub.rotation.z = Math.PI / 2;
      }
      this.box(this.steel, 0, 1.8, -13.9, 5.8, .5, .3, rig, .08);
      // Only the front cab folds: the occupied trailer retains its server-supported roof.
      rig.traverse(object => {
        if (!(object instanceof THREE.Mesh) || object.position.z > -8 || object.position.y < 1.4) return;
        const position = object.geometry.getAttribute('position'), folded = position.clone();
        for (let i = 0; i < position.count; i++) {
          const x = position.getX(i) + object.position.x, y = position.getY(i) + object.position.y, z = position.getZ(i) + object.position.z;
          const front = THREE.MathUtils.clamp((-z - 7) / 7, 0, 1), height = THREE.MathUtils.clamp((y - 1.4) / 4.2, 0, 1);
          folded.setXYZ(i, position.getX(i) + Math.sign(x) * front * (.36 + .28 * Math.sin(y * 4 + Math.abs(z))),
            position.getY(i) + front * (.45 - height * 1.4 + .15 * Math.sin(x * 3.8)),
            position.getZ(i) + front * (1.35 + height * 1.8 + .25 * Math.sin(y * 3.7)));
        }
        const normals = object.geometry.clone(); normals.setAttribute('position', folded); normals.computeVertexNormals();
        object.geometry.morphAttributes.position = [folded];
        object.geometry.morphAttributes.normal = [normals.getAttribute('normal').clone()]; normals.dispose();
        object.updateMorphTargets(); this.crumple.push(object);
      });
      return rig;
    };
    this.heroTruck = buildRig(cab, 'matrix-freeway-hero-truck'); this.heroTruck.position.set(TRUCKS.roof.x, 0, TRUCKS.morpheus.z);
    this.oncomingTruck = buildRig(red, 'matrix-freeway-oncoming-truck'); this.oncomingTruck.position.set(TRUCKS.roof.x, 0, TRUCKS.oncomingStart);
    this.oncomingTruck.rotation.y = Math.PI;
    const car = this.niobeCar = new THREE.Group(); car.name = 'matrix-freeway-niobe-car'; this.root.add(car); car.position.set(TRUCKS.niobe.x, 0, TRUCKS.niobe.z);
    this.box(cab, 0, 1.25, 0, 4.5, 1.4, 9, car, .4);
    this.box(this.windows, 0, 2.45, -.2, 3.7, 1.35, 4.5, car, .55);
    this.box(cab, 0, 3.15, -.2, 3.8, .18, 4.4, car, .08);
    for (const side of [-1, 1]) for (const z of [-2.9, 2.8]) {
      const wheel = this.cylinder(this.rubber, side * 2.1, .9, z, .83, .48, car); wheel.rotation.z = Math.PI / 2;
      const hub = this.cylinder(this.steel, side * 2.35, .9, z, .45, .03, car); hub.rotation.z = Math.PI / 2;
    }
    for (const x of [-1.5, 1.5]) this.box(lamp, x, 1.55, -4.52, .7, .25, .07, car, .05);
    this.neoTrail = new THREE.Group(); this.neoTrail.name = 'matrix-freeway-neo-trail'; this.root.add(this.neoTrail);
    const trailMat = new THREE.MeshBasicMaterial({ color: 0xdcead8, transparent: true, opacity: .4, depthWrite: false }); this.materials.add(trailMat);
    for (let i = 0; i < 5; i++) {
      const ring = this.mesh(new THREE.TorusGeometry(.55 + i * .27, .045, 5, 24), trailMat, 0, 0, i * 2.5, this.neoTrail);
      ring.rotation.y = Math.PI / 2;
    }
    this.impact = new THREE.Group(); this.impact.name = 'matrix-freeway-collision'; this.root.add(this.impact); this.impact.position.set(TRUCKS.roof.x, 3.2, 11.5);
    this.fire = new THREE.Group(); this.impact.add(this.fire);
    this.smoke = new THREE.Group(); this.impact.add(this.smoke);
    const fireCanvas = document.createElement('canvas'); fireCanvas.width = fireCanvas.height = 128;
    const fireContext = fireCanvas.getContext('2d')!, firePixels = fireContext.createImageData(128, 128);
    for (let y = 0; y < 128; y++) for (let x = 0; x < 128; x++) {
      const nx = (x - 64) / 62, ny = (y - 64) / 62;
      const noise = Math.sin(x * .19 + Math.sin(y * .14) * 2) * Math.sin(y * .21 + Math.sin(x * .12));
      const heat = Math.max(0, 1 - Math.hypot(nx, ny) * (1 + noise * .15));
      const edge = THREE.MathUtils.clamp((1 - Math.hypot(nx, ny)) * 5, 0, 1);
      const offset = (y * 128 + x) * 4;
      firePixels.data.set([255, 82 + heat * 173, 8 + Math.pow(heat, 3) * 188,
        Math.pow(heat, 1.15) * (180 + noise * 45) * edge], offset);
    }
    fireContext.putImageData(firePixels, 0, 0);
    const fireTexture = new THREE.CanvasTexture(fireCanvas); fireTexture.colorSpace = THREE.SRGBColorSpace; this.textures.add(fireTexture);
    const flare = new THREE.SpriteMaterial({ map: fireTexture, transparent: true, opacity: .85, depthWrite: false,
      blending: THREE.AdditiveBlending, toneMapped: false }); this.materials.add(flare);
    for (let i = 0; i < 14; i++) {
      const flame = new THREE.Sprite(flare), angle = i * 2.399963;
      flame.position.set(Math.sin(angle) * (i < 7 ? 1.45 : .85), i < 7 ? -.25 : .9, Math.cos(angle) * 1.1);
      flame.scale.set(i < 7 ? 2.8 : 1.7, i < 7 ? 2.2 : 3.2, 1); this.fire.add(flame);
    }
    const smokeCanvas = document.createElement('canvas'); smokeCanvas.width = smokeCanvas.height = 64;
    const smokeContext = smokeCanvas.getContext('2d')!;
    const gradient = smokeContext.createRadialGradient(32, 32, 3, 32, 32, 31);
    gradient.addColorStop(0, 'rgba(255,255,255,.68)'); gradient.addColorStop(.5, 'rgba(255,255,255,.36)'); gradient.addColorStop(1, 'rgba(255,255,255,0)');
    smokeContext.fillStyle = gradient; smokeContext.fillRect(0, 0, 64, 64);
    const smokeTexture = new THREE.CanvasTexture(smokeCanvas); this.textures.add(smokeTexture);
    const soot = new THREE.SpriteMaterial({ map: smokeTexture, color: 0x424942, transparent: true, opacity: .62, depthWrite: false }); this.materials.add(soot);
    for (let i = 0; i < 7; i++) {
      const puff = new THREE.Sprite(soot); this.smoke.add(puff);
      puff.position.set(Math.sin(i * 2.4) * (1 + i * .34), 1 + i * 1.15, Math.cos(i * 2.4) * (1 + i * .28));
      puff.scale.set(5 + i * .55, 5 + i * .65, 1);
    }
    this.fragments = new THREE.Group(); this.fragments.name = 'matrix-freeway-crash-fragments'; this.impact.add(this.fragments);
    const glass = this.mat(0xa5c1b6, .16, .6); glass.side = THREE.DoubleSide;
    const sheet = this.mat(0x7c867e, .42, .7); sheet.side = THREE.DoubleSide;
    for (let i = 0; i < 32; i++) {
      const shard = this.mesh(new THREE.PlaneGeometry(i % 3 === 0 ? .65 : .28, i % 3 === 0 ? 1.1 : .45),
        i % 3 === 0 ? sheet : glass, 0, 0, 0, this.fragments);
      shard.name = `matrix-freeway-crash-shard-${i}`;
    }
    this.impact.visible = false; this.neoTrail.visible = false;
  }
  update(journey: FilmJourney | undefined, elapsed: number, playerPosition?: Vector3): void {
    const ride = journey?.ride;
    const trucks = journey?.scene === 'm2_trucks' && !journey.visiting ? journey.trucks : undefined;
    const crashed = trucks?.phase === 'rescue' || trucks?.phase === 'rescued' || trucks?.phase === 'failed';
    const crashTime = !crashed ? 0 : trucks.phase === 'rescue' ? trucks.rescueElapsed ?? 0 : TRUCKS.rescueSeconds;
    // The encounter owns its time after the duel. Render time must not restart a saved explosion.
    const truckClock = trucks && trucks.phase !== 'duel' ? trucks.elapsed + crashTime : elapsed;
    if (ride && ride.elapsed !== this.previousElapsed) { this.clock = ride.elapsed; this.previousElapsed = ride.elapsed; this.syncAt = elapsed; }
    const traffic = freewayTraffic(this.oncomingTruck ? truckClock : ride ? this.clock + (ride.phase === 'riding' ? Math.min(.5, elapsed - this.syncAt) : 0) : elapsed);
    const pose = new THREE.Object3D();
    for (const batch of this.traffic) {
      let i = 0;
      for (const car of traffic) if (car.truck === batch.truck) {
        const staged = this.set.id === 'film_freeway_trucks' && Math.abs(car.z) < 110 && car.x > 0;
        pose.position.set(car.x, 0, staged ? car.z + 500 : car.z); pose.rotation.set(0, car.speed > 0 ? Math.PI : 0, 0); pose.updateMatrix();
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
    if (this.oncomingTruck) {
      const progress = trucks?.phase === 'duel' || !trucks ? 0 : Math.min(1, trucks.elapsed / TRUCKS.collisionSeconds);
      this.oncomingTruck.position.z = TRUCKS.oncomingStart + (TRUCKS.oncomingEnd - TRUCKS.oncomingStart) * progress;
      this.niobeCar!.position.z = TRUCKS.niobe.z + Math.sin(truckClock * 1.7) * .45;
      const fold = THREE.MathUtils.smoothstep(crashTime, 0, 1.15);
      for (const mesh of this.crumple) mesh.morphTargetInfluences![0] = fold;
      this.impact!.visible = crashed;
      const fireTime = Math.max(0, crashTime - .55);
      this.fire!.visible = crashed && fireTime > 0;
      this.fire!.scale.set(1 + fireTime * .85, 1 + fireTime * 1.1, 1 + fireTime * .7);
      this.fire!.rotation.y = fireTime * .4;
      this.smoke!.position.y = crashTime * 2.3;
      this.smoke!.scale.setScalar(.55 + crashTime * .48);
      this.smoke!.visible = crashTime > .25;
      this.fragments!.visible = crashed;
      for (let i = 0; i < this.fragments!.children.length; i++) {
        const shard = this.fragments!.children[i], angle = i * 2.399963;
        // Paired outward trajectories keep debris out of the occupied trailer behind the cab.
        const side = i % 2 ? 1 : -1, speed = 3 + i % 7 * .42;
        const travel = crashTime * speed;
        shard.rotation.set(angle + crashTime * side * 1.6, angle * .6 + crashTime * 2, angle * .3);
        this.matrix.makeRotationFromEuler(shard.rotation);
        const width = i % 3 === 0 ? .65 : .28, height = i % 3 === 0 ? 1.1 : .45;
        const extent = (Math.abs(this.matrix.elements[1]) * width + Math.abs(this.matrix.elements[5]) * height) / 2;
        shard.position.set(side * (1.2 + travel), Math.max(-this.impact!.position.y + extent + .025,
          .4 + (3 + i % 5 * .7) * crashTime - 2.8 * crashTime * crashTime), Math.sin(angle) * (1 + travel * .5));
      }
      this.neoTrail!.visible = Boolean(trucks && trucks.phase === 'collision' && trucks.elapsed > 5.5);
      if (this.neoTrail!.visible) this.neoTrail!.position.set(TRUCKS.roof.x, 13 + (trucks!.elapsed - 5.5) * -1.5,
        -58 + (trucks!.elapsed - 5.5) * 20);
    }
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
