import * as THREE from 'three';
import { TEMPLE_DEFENSE, trilogyEpilogueProgress, type FilmJourney } from '@auto_matrix/shared';
import { batchStaticGeometry } from './StaticGeometry.js';

/** The temple has an open firing bottleneck, not a powered door that can stop the siege. */
export class TempleDefenseRenderer {
  readonly group = new THREE.Group();
  private wheels: THREE.Group[] = [];
  private drill = new THREE.Group();
  private ceilingFragments: { mesh: THREE.Mesh; origin: THREE.Vector3; angle: number }[] = [];
  private rubble: THREE.InstancedMesh;
  private dust: THREE.InstancedMesh;
  private geometries = new Set<THREE.BufferGeometry>();
  private materials = new Set<THREE.Material>();
  private textures = new Set<THREE.Texture>();
  private lights: THREE.Light[] = [];
  private disposed = false;

  constructor(root: THREE.Group) {
    this.group.name = 'temple-last-defense'; root.add(this.group);
    const steel = this.surface('metal_plate', 0x687472, .62, .55), dark = this.material(0x2c3436, .73, .3);
    const stone = this.surface('damaged_plaster', 0x615a53, 1, .01), cloth = this.material(0x726759, .95, 0);
    const cave = this.surface('rock_wall_02', 0xa19d97, 1, .01);
    const black = this.material(0x0d1011, 1, 0), bronze = this.material(0x90816b, .62, .4);
    for (const [index, mount] of TEMPLE_DEFENSE.mounts.entries()) {
      const gun = new THREE.Group(); gun.name = `temple-artillery-${index}`; gun.position.set(mount.x, 0, mount.z); this.group.add(gun);
      this.box(dark, 0, .55, 0, 3, .65, 4, gun);
      this.cylinder(steel, 0, 1.7, 0, .45, 2.6, gun);
      for (const side of [-1, 1]) {
        this.pipe(steel, [side * 1.25, .35, 1.7], [side * .55, 2.95, 0], .12, gun);
        this.pipe(dark, [side * 1.25, .35, -1.7], [side * .55, 2.95, 0], .16, gun);
        this.box(steel, side * 1.2, .24, 1.7, .65, .22, .85, gun);
        this.box(dark, side * .95, 2.85, 0, .2, 1.2, 2.8, gun);
        this.pipe(steel, [side * .62, 3.7, -.7], [side * .62, 3.7, -5.7], .25, gun);
        for (let z = -1.7; z > -5.7; z -= .65) {
          const ring = this.mesh(new THREE.TorusGeometry(.29, .065, 8, 24), dark, gun); ring.position.set(side * .62, 3.7, z);
        }
        const mouth = this.mesh(new THREE.CylinderGeometry(.34, .34, .65, 24, 1, true), steel, gun);
        mouth.rotation.x = Math.PI / 2; mouth.position.set(side * .62, 3.7, -5.65);
        const inner = this.mesh(new THREE.CircleGeometry(.27, 24), black, gun); inner.rotation.y = Math.PI; inner.position.set(side * .62, 3.7, -5.74);
        const feed = this.mesh(new THREE.TorusGeometry(.6, .11, 8, 20, Math.PI), bronze, gun); feed.rotation.y = Math.PI / 2; feed.position.set(side * 1.35, 2.95, .2);
        for (let i = 0; i < 7; i++) { const shell = this.cylinder(bronze, side * 1.46, 2.35 + i * .17, .27, .07, .42, gun); shell.rotation.z = Math.PI / 2; }
      }
      this.box(steel, 0, 3.1, -.15, 1.35, 1.1, 2.4, gun);
      this.box(dark, 0, 4, -.6, 1.5, .18, 2.1, gun);
      const wheel = new THREE.Group(); wheel.name = `temple-mount-wheel-${index}`;
      wheel.position.set(mount.x, TEMPLE_DEFENSE.wheel.y, TEMPLE_DEFENSE.wheel.z); this.group.add(wheel); this.wheels.push(wheel);
      this.mesh(new THREE.TorusGeometry(TEMPLE_DEFENSE.wheel.radius, .055, 12, 40), steel, wheel);
      for (let spoke = 0; spoke < 6; spoke++) { const a = spoke * Math.PI / 3; this.pipe(dark, [0, 0, 0], [Math.cos(a) * .49, Math.sin(a) * .49, 0], .035, wheel); }
      for (const side of [-1, 1]) this.pipe(bronze, [side * TEMPLE_DEFENSE.wheel.radius, 0, -.02], [side * TEMPLE_DEFENSE.wheel.radius, 0, .18], .06, wheel);
      this.pipe(steel, [mount.x, TEMPLE_DEFENSE.wheel.y, TEMPLE_DEFENSE.wheel.z], [mount.x, 1.9, mount.z + .2], .1);
      for (let row = 0; row < 2; row++) for (let i = 0; i < 4; i++) {
        const bag = this.mesh(new THREE.SphereGeometry(.55, 16, 10), cloth); bag.scale.set(1.3, .48, .72);
        bag.position.set(mount.x - 2 + i * 1.1, .28 + row * .48, mount.z - 2.3); bag.rotation.y = .12 * Math.sin(i * 3 + row);
      }
      for (let i = 0; i < 3; i++) { const x = mount.x + (index ? 2.8 : -2.8); this.box(dark, x, .55 + i * .52, mount.z + .4, 1.6, .48, 1.1); this.box(steel, x, .78 + i * .52, mount.z + .4, 1.7, .06, 1.2); }
    }
    this.cityOutlook(stone, cave, steel, dark, black);
    this.cityCeiling(cave, steel);
    this.drill.name = 'temple-city-digger'; this.drill.position.set(0, 38, -105); this.group.add(this.drill);
    const tip = this.mesh(new THREE.ConeGeometry(5.4, 10, 32), steel, this.drill); tip.rotation.z = Math.PI;
    for (let i = 0; i < 7; i++) {
      const radius = 5.5 - i * .55, y = 4.1 - i * 1.25;
      const ring = this.mesh(new THREE.TorusGeometry(radius, .28, 10, 32), dark, this.drill); ring.rotation.x = Math.PI / 2; ring.position.y = y;
      for (let tooth = 0; tooth < 12; tooth++) {
        const angle = tooth * Math.PI / 6 + i * .38;
        const cutter = this.mesh(new THREE.BoxGeometry(.56, .55, .86), steel, this.drill);
        cutter.position.set(Math.cos(angle) * radius, y, Math.sin(angle) * radius); cutter.rotation.set(.24, -angle, .16);
      }
    }
    this.cylinder(dark, 0, 8.5, 0, 5.5, 7, this.drill);
    for (let i = 0; i < 12; i++) {
      const angle = i * Math.PI / 6;
      this.pipe(steel, [Math.cos(angle) * 5.65, 5.2, Math.sin(angle) * 5.65], [Math.cos(angle) * 5.65, 11.5, Math.sin(angle) * 5.65], .18, this.drill);
    }
    this.rubble = new THREE.InstancedMesh(new THREE.DodecahedronGeometry(.5, 0), cave, 32); this.rubble.name = 'temple-breach-rubble'; this.rubble.frustumCulled = false;
    this.geometries.add(this.rubble.geometry); this.group.add(this.rubble);
    const pixels = new Uint8Array(64 * 64 * 4);
    for (let y = 0; y < 64; y++) for (let x = 0; x < 64; x++) {
      const radius = Math.hypot((x - 31.5) / 31.5, (y - 31.5) / 31.5), offset = (y * 64 + x) * 4;
      pixels[offset] = pixels[offset + 1] = pixels[offset + 2] = 255;
      pixels[offset + 3] = Math.round(255 * Math.max(0, 1 - radius) ** 2 * (.8 + .2 * Math.sin(x * .91 + y * 1.23) ** 2));
    }
    const cloud = new THREE.DataTexture(pixels, 64, 64); cloud.needsUpdate = true; cloud.minFilter = cloud.magFilter = THREE.LinearFilter; this.textures.add(cloud);
    const smoke = new THREE.ShaderMaterial({ transparent: true, depthWrite: false, fog: true,
      uniforms: { ...THREE.UniformsUtils.clone(THREE.UniformsLib.fog), cloud: { value: cloud } },
      vertexShader: `attribute float cloudOpacity;
        varying vec2 vUv; varying float vOpacity;
        #include <fog_pars_vertex>
        void main() { vUv = uv; vOpacity = cloudOpacity;
          vec4 mvPosition = modelViewMatrix * vec4(instanceMatrix[3].xyz, 1.0);
          mvPosition.xy += position.xy * vec2(length(instanceMatrix[0].xyz), length(instanceMatrix[1].xyz));
          gl_Position = projectionMatrix * mvPosition;
          #include <fog_vertex>
        }`,
      fragmentShader: `uniform sampler2D cloud; varying vec2 vUv; varying float vOpacity;
        #include <fog_pars_fragment>
        void main() { gl_FragColor = vec4(vec3(.32, .34, .38), texture2D(cloud, vUv).a * vOpacity);
          #include <tonemapping_fragment>
          #include <colorspace_fragment>
          #include <fog_fragment>
        }` });
    this.materials.add(smoke);
    const clouds = new THREE.PlaneGeometry(1, 1); clouds.setAttribute('cloudOpacity', new THREE.InstancedBufferAttribute(new Float32Array(24), 1));
    this.geometries.add(clouds); this.dust = new THREE.InstancedMesh(clouds, smoke, 24); this.dust.name = 'temple-breach-dust'; this.dust.frustumCulled = false;
    this.dust.raycast = () => {}; this.group.add(this.dust);
    for (const point of [[-8, 6, -43, 210, 24], [8, 6, -43, 210, 24]]) {
      const light = new THREE.PointLight(0x8fafd3, point[3], point[4], 2); light.position.set(point[0], point[1], point[2]); this.group.add(light); this.lights.push(light);
    }
    const flood = new THREE.SpotLight(0xb3c8d5, 18000, 240, 1.1, .7, 2);
    flood.position.set(-5, 13.3, -57.6); flood.target.position.set(0, -5, -170);
    this.group.add(flood, flood.target); this.lights.push(flood);
    batchStaticGeometry(this.group, new Set()).forEach(geometry => this.geometries.add(geometry));
    this.update(undefined);
  }
  private cityOutlook(stone: THREE.MeshStandardMaterial, cave: THREE.MeshStandardMaterial, steel: THREE.MeshStandardMaterial, dark: THREE.Material, black: THREE.Material): void {
    // The residential shaft is scenery beyond the temple's walking boundary. Keep the central bore and approach open.
    const outside = new THREE.Group(); outside.name = 'temple-city-outlook'; this.group.add(outside);
    const rust = steel.clone(); rust.color.setHex(0xc49a82); rust.roughness = .96; rust.metalness = .05; this.materials.add(rust);
    const rock = cave.clone(); rock.vertexColors = true; this.materials.add(rock);
    const window = this.material(0x95816c, .85, .05); window.emissive.setHex(0xe7a76f); window.emissiveIntensity = .75;
    const lamp = this.material(0xc7d4cc, .4, .1); lamp.emissive.setHex(0xa9c9d5); lamp.emissiveIntensity = 1.5;
    for (const side of [-1, 1]) {
      this.box(stone, side * 14, 7, -54, 10, 14, 5, outside);
      this.box(dark, side * 11.5, .1, -68, .8, .3, 30, outside);
      for (let z = -54; z > -85; z -= 2.8) {
        this.pipe(steel, [side * 11.5, .2, z], [side * 11.5, 2.4, z], .06, outside, 8);
        this.box(dark, side * 10.8, -2.2, z, .35, 4.2, .4, outside);
      }
      for (const y of [1.2, 2.4]) this.pipe(steel, [side * 11.5, y, -54], [side * 11.5, y, -85], .065, outside, 8);
      this.pipe(steel, [side * 10.8, -4, -54], [side * 10.8, -4, -99], .42, outside, 8);
      for (let z = -58; z > -83; z -= 8) {
        this.box(dark, side * 10.8, 3, z, .65, .2, .65, outside);
        this.box(lamp, side * 10.8, 2.88, z, .42, .07, .42, outside);
      }
    }
    this.box(stone, 0, 15.3, -54, 37, 2.6, 5, outside);
    this.box(dark, -5, 13.65, -57, 1.8, .7, 1, outside);
    this.box(lamp, -5, 13.65, -57.52, 1.45, .42, .06, outside);
    this.box(dark, 0, -.3, -70, 24, .5, 34, outside);
    for (let z = -55; z > -87; z -= 1.4) this.box(steel, 0, -.025, z, 22.5, .04, .06, outside);
    // Broken roof pieces land on a service crown, with the city's occupied levels continuing below it.
    this.cylinder(dark, 0, -39, -105, 8.5, 90, outside);
    this.cylinder(steel, 0, 5.7, -105, 11, .65, outside);
    for (let i = 0; i < 16; i++) this.box(steel, 0, i * .38, -87.4 - i * .63, 16, .5, .7, outside);
    for (let i = 0; i < 12; i++) {
      const a = i * Math.PI / 6, x = Math.cos(a) * 8.8, z = -105 + Math.sin(a) * 8.8;
      this.pipe(steel, [x, -83, z], [x, 5.35, z], .22, outside, 8);
    }
    const houseShape = new THREE.Shape(); houseShape.moveTo(-5, 0); houseShape.lineTo(-5, 3);
    houseShape.quadraticCurveTo(-5, 8, 0, 8); houseShape.quadraticCurveTo(5, 8, 5, 3); houseShape.lineTo(5, 0); houseShape.closePath();
    const house = new THREE.ExtrudeGeometry(houseShape, { depth: 7, bevelEnabled: true, bevelSize: .16, bevelThickness: .12, bevelSegments: 2, curveSegments: 8 });
    house.translate(0, 0, -6);
    const port = new THREE.TorusGeometry(.78, .14, 6, 16), glass = new THREE.CircleGeometry(.68, 16);
    const levels = [-63, -50, -37, -24, -11, 2, 15];
    for (let bay = 0; bay < 13; bay++) {
      const angle = (bay - 6) * .26, radius = 77 + Math.sin(bay * 2.1) * 1.5;
      const origin = new THREE.Vector3(Math.sin(angle) * radius, 0, -125 - Math.cos(angle) * radius);
      const rotation = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), -angle);
      const point = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z).applyQuaternion(rotation).add(origin);
      const box = (material: THREE.Material, x: number, y: number, z: number, w: number, h: number, d: number) => {
        const mesh = this.mesh(new THREE.BoxGeometry(w, h, d), material, outside); mesh.position.copy(point(x, y, z)); mesh.quaternion.copy(rotation);
      };
      for (const x of [-7.2, 7.2]) {
        this.pipe(steel, point(x, -82, 2).toArray(), point(x, 29, 2).toArray(), .42, outside, 8);
        this.pipe(rust, point(x + .9, -82, 1).toArray(), point(x + .9, 27, 1).toArray(), .2, outside, 8);
      }
      for (const [level, floor] of levels.entries()) {
        const home = this.mesh(house, rust, outside); home.position.copy(point(0, floor + .3, 0)); home.quaternion.copy(rotation);
        box(black, 0, floor + 2.35, 1.17, 2.4, 4, .12);
        box(steel, 0, floor + 4.4, 1.3, 2.8, .22, .4);
        for (const x of [-1.35, 1.35]) box(steel, x, floor + 2.35, 1.3, .18, 4.2, .4);
        const lit = (bay * 3 + level) % 5 < 2;
        const rim = this.mesh(port, steel, outside); rim.position.copy(point(3.05, floor + 3.5, 1.22)); rim.quaternion.copy(rotation);
        const pane = this.mesh(glass, lit ? window : black, outside); pane.position.copy(point(3.05, floor + 3.5, 1.2)); pane.quaternion.copy(rotation);
        box(lit ? window : black, -3, floor + 3.4, 1.22, 1.25, 1.7, .08);
        for (let slat = 0; slat < 4; slat++) box(steel, -3, floor + 2.85 + slat * .38, 1.3, 1.5, .07, .12);
        box(steel, 0, floor + 6.7, 2, 8, .18, 2.5);
        box(lamp, 0, floor + 4.12, 1.55, .7, .06, .22);
        for (const x of [-5.5, 5.5]) {
          this.pipe(dark, point(x, floor + .5, 1.2).toArray(), point(x, floor + 6.3, 1.2).toArray(), .15, outside, 8);
          this.pipe(steel, point(x, floor + 5.5, 1.2).toArray(), point(x > 0 ? 4 : -4, floor + 5.5, 1.2).toArray(), .14, outside, 8);
        }
        box(dark, 0, floor - 1.45, -.7, 16, 2.2, 1.1);
        this.pipe(steel, point(-7, floor - 2.5, -.7).toArray(), point(0, floor - .5, 3).toArray(), .15, outside, 8);
        this.pipe(steel, point(7, floor - 2.5, -.7).toArray(), point(0, floor - .5, 3).toArray(), .15, outside, 8);
      }
    }
    // Continuous polygonal balconies connect the modules, rather than isolated rings around solid pillars.
    const gallery = new THREE.Shape();
    for (let i = 0; i <= 48; i++) {
      const angle = -1.72 + i * 3.44 / 48, x = Math.sin(angle) * 80, z = -125 - Math.cos(angle) * 80;
      if (i === 0) gallery.moveTo(x, z); else gallery.lineTo(x, z);
    }
    for (let i = 48; i >= 0; i--) { const angle = -1.72 + i * 3.44 / 48; gallery.lineTo(Math.sin(angle) * 67, -125 - Math.cos(angle) * 67); }
    gallery.closePath();
    const balcony = new THREE.ExtrudeGeometry(gallery, { depth: .5, bevelEnabled: false }); balcony.rotateX(Math.PI / 2);
    for (const floor of levels) this.mesh(balcony, dark, outside).position.y = floor + .25;
    for (const floor of levels) for (let i = 0; i < 48; i++) {
      const a = -1.72 + i * 3.44 / 48, b = -1.72 + (i + 1) * 3.44 / 48;
      const p = (angle: number, r: number, y: number) => new THREE.Vector3(Math.sin(angle) * r, y, -125 - Math.cos(angle) * r);
      for (const y of [floor + 1.1, floor + 2.1]) this.pipe(steel, p(a, 67, y).toArray(), p(b, 67, y).toArray(), .07, outside, 8);
      this.pipe(steel, p(a, 67, floor).toArray(), p(a, 67, floor + 2.1).toArray(), .07, outside, 8);
    }
    for (const side of [-1, 1]) for (const floor of [-37, -11, 2]) {
      this.box(dark, side * 36, floor, -137, 54, .65, 5, outside);
      for (const z of [-139.4, -134.6]) {
        this.pipe(steel, [side * 9, floor + 2, z], [side * 63, floor + 2, z], .1, outside, 8);
        for (let x = 9; x < 64; x += 3) this.pipe(steel, [side * x, floor, z], [side * x, floor + 2, z], .07, outside, 8);
      }
    }
    const positions: number[] = [], colors: number[] = [], uvs: number[] = [], indices: number[] = [];
    for (let y = 0; y <= 12; y++) for (let i = 0; i <= 64; i++) {
      const angle = -1.94 + i * 3.88 / 64, height = -88 + y * 12;
      const radius = 101 + Math.sin(i * 1.17 + y * .7) * 2.5 + Math.sin(i * .3 - y * 1.8) * 2;
      positions.push(Math.sin(angle) * radius, height, -125 - Math.cos(angle) * radius);
      const shade = .52 + y / 12 * .35 + Math.sin(i * .8 + y * 1.7) * .07; colors.push(shade, shade, shade);
      uvs.push(i * .32, y * .75);
      if (y < 12 && i < 64) { const a = y * 65 + i; indices.push(a, a + 1, a + 65, a + 1, a + 66, a + 65); }
    }
    const wall = new THREE.BufferGeometry(); wall.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    wall.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3)); wall.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
    wall.setIndex(indices); wall.computeVertexNormals(); rock.side = THREE.DoubleSide; this.mesh(wall, rock, outside);
    this.box(black, 0, -88.6, -145, 202, 1, 180, outside);
  }
  private cityCeiling(stone: THREE.MeshStandardMaterial, steel: THREE.Material): void {
    const ceiling = new THREE.Group(); ceiling.name = 'temple-city-ceiling'; this.group.add(ceiling);
    const material = stone.clone(); material.side = THREE.DoubleSide; material.color.setHex(0x8f8d89); this.materials.add(material);
    const edge = Array.from({ length: 12 }, (_, i) => {
      const angle = i * Math.PI / 6, radius = 7.5 + Math.sin(i * 1.7) * .45;
      return new THREE.Vector2(Math.cos(angle) * radius, Math.sin(angle) * radius);
    });
    // A continuous, thick rock vault surrounds the original breakable twelve-sided bore.
    const positions: number[] = [], uvs: number[] = [], indices: number[] = [], rings = [0, .08, .2, .4, .65, 1];
    const segments = edge.length * 4, surfaceCount = rings.length * segments;
    for (let side = 0; side < 2; side++) for (const ring of rings) for (let i = 0; i < segments; i++) {
      const inner = edge[Math.floor(i / 4)].clone().lerp(edge[(Math.floor(i / 4) + 1) % edge.length], i % 4 / 4);
      const direction = inner.clone().normalize();
      const extent = Math.min(110 / Math.max(.0001, Math.abs(direction.x)), (direction.y > 0 ? 46 : 140) / Math.max(.0001, Math.abs(direction.y)));
      const distance = THREE.MathUtils.lerp(inner.length(), extent, ring), x = direction.x * distance, z = direction.y * distance;
      const lift = ring === 0 ? 0 : (distance - inner.length()) * .11 + ring * (Math.sin(x * .18) * 1.4 + Math.cos(z * .21) * 1.2);
      positions.push(x, 31.55 + lift - side * 1.1, z - 105); uvs.push(x / 20, z / 20);
    }
    for (let side = 0; side < 2; side++) for (let ring = 0; ring < rings.length - 1; ring++) for (let i = 0; i < segments; i++) {
      const a = side * surfaceCount + ring * segments + i, b = side * surfaceCount + ring * segments + (i + 1) % segments;
      const c = a + segments, d = b + segments;
      indices.push(...(side ? [a, c, b, b, c, d] : [a, b, c, b, d, c]));
    }
    for (const ring of [0, rings.length - 1]) for (let i = 0; i < segments; i++) {
      const a = ring * segments + i, b = ring * segments + (i + 1) % segments, c = a + surfaceCount, d = b + surfaceCount;
      indices.push(...(ring ? [a, b, c, b, d, c] : [a, c, b, b, c, d]));
    }
    const vault = new THREE.BufferGeometry(); vault.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    vault.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2)); vault.setIndex(indices); vault.computeVertexNormals();
    this.mesh(vault, material, ceiling).name = 'temple-city-roof';
    const pieces = new THREE.Group(); pieces.name = 'temple-ceiling-fragments'; ceiling.add(pieces);
    for (let i = 0; i < edge.length; i++) {
      const a = edge[i], b = edge[(i + 1) % edge.length], center = a.clone().add(b).multiplyScalar(1 / 3);
      const triangle = new THREE.Shape(); triangle.moveTo(-center.x, -center.y); triangle.lineTo(a.x - center.x, a.y - center.y); triangle.lineTo(b.x - center.x, b.y - center.y); triangle.closePath();
      const geometry = new THREE.ExtrudeGeometry(triangle, { depth: 1.1, bevelEnabled: false });
      geometry.translate(0, 0, -.55); geometry.rotateX(Math.PI / 2);
      const piece = this.mesh(geometry, material, pieces); piece.name = `temple-roof-piece-${i}`;
      const origin = new THREE.Vector3(center.x, 31, center.y - 105); piece.position.copy(origin);
      this.ceilingFragments.push({ mesh: piece, origin, angle: Math.atan2(center.y, center.x) });
    }
    // Broken service reinforcement stays around the bore rather than crossing its opening.
    for (const side of [-1, 1]) {
      this.pipe(steel, [side * 9, 30.25, -157], [side * 9, 30.25, -60], .16, ceiling);
    }
    for (let x = -67; x <= 67; x += 22) this.pipe(steel, [x, 30.25, -157], [x, 30.25, -115], .12, ceiling);
  }
  private material(color: number, roughness: number, metalness: number): THREE.MeshStandardMaterial {
    const material = new THREE.MeshStandardMaterial({ color, roughness, metalness }); this.materials.add(material); return material;
  }
  private surface(name: string, color: number, roughness: number, metalness: number): THREE.MeshStandardMaterial {
    const material = this.material(color, roughness, metalness); if (typeof document === 'undefined') return material;
    for (const [suffix, slot] of [['color', 'map'], ['normal', 'normalMap'], ['roughness', 'roughnessMap']] as const) {
      const texture = new THREE.TextureLoader().load(`/assets/film-materials/${name}-${suffix}.jpg`, loaded => { if (this.disposed) loaded.dispose(); });
      texture.wrapS = texture.wrapT = THREE.RepeatWrapping; texture.repeat.set(2, 2); texture.anisotropy = 4;
      if (slot === 'map') texture.colorSpace = THREE.SRGBColorSpace;
      material[slot] = texture; this.textures.add(texture);
    }
    material.normalScale.set(.4, .4); return material;
  }
  private mesh(geometry: THREE.BufferGeometry, material: THREE.Material, parent: THREE.Object3D = this.group): THREE.Mesh {
    this.geometries.add(geometry); const mesh = new THREE.Mesh(geometry, material); mesh.castShadow = mesh.receiveShadow = true; parent.add(mesh); return mesh;
  }
  private box(material: THREE.Material, x: number, y: number, z: number, w: number, h: number, d: number, parent = this.group): void {
    this.mesh(new THREE.BoxGeometry(w, h, d), material, parent).position.set(x, y, z);
  }
  private cylinder(material: THREE.Material, x: number, y: number, z: number, r: number, h: number, parent = this.group): THREE.Mesh {
    const mesh = this.mesh(new THREE.CylinderGeometry(r, r, h, 24), material, parent); mesh.position.set(x, y, z); return mesh;
  }
  private pipe(material: THREE.Material, a: number[], b: number[], radius: number, parent = this.group, sides = 16): void {
    const start = new THREE.Vector3(...a), end = new THREE.Vector3(...b), delta = end.clone().sub(start);
    const mesh = this.mesh(new THREE.CylinderGeometry(radius, radius, delta.length(), sides), material, parent);
    mesh.position.copy(start).addScaledVector(delta, .5); mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), delta.normalize());
  }
  update(journey?: FilmJourney): void {
    this.group.visible = Boolean(journey && !journey.visiting && ['m3_temple_defense', 'm3_temple_breach', 'm3_ceasefire'].includes(journey.scene));
    if (!this.group.visible) return;
    this.wheels.forEach((wheel, index) => wheel.rotation.z = (journey?.templeSeal?.turns?.[index] ?? (journey?.completed.includes('m3_temple_defense') ? 1 : 0)) * TEMPLE_DEFENSE.wheel.angle);
    const breach = journey?.templeBreach;
    const active = Boolean(breach && ['breach', 'waiting', 'done'].includes(breach.phase) || journey?.completed.includes('m3_temple_breach'));
    const age = breach?.phase === 'breach' ? breach.elapsed : TEMPLE_DEFENSE.breach.drilling;
    this.drill.visible = active; this.drill.position.y = 38 - Math.min(1, age / TEMPLE_DEFENSE.breach.drilling) * 19;
    this.drill.rotation.y = age * 2.7;
    const epilogue = journey?.scene === 'm3_ceasefire' ? journey.epilogue : undefined;
    if (epilogue) {
      const withdrawing = epilogue.phase === 'retreat' ? trilogyEpilogueProgress(epilogue) : epilogue.phase === 'ready' ? 0 : 1;
      this.drill.position.y += THREE.MathUtils.smoothstep(withdrawing, 0, .3) * 128;
    }
    const vertex = new THREE.Vector3();
    this.ceilingFragments.forEach(({ mesh, origin, angle }, index) => {
      const falling = active ? Math.max(0, age - .86 - index * .045) : 0;
      const settle = Math.min(1, falling / 2.1);
      mesh.rotation.set(settle * (.32 + index % 3 * .19), settle * .4, settle * (index % 2 ? -.42 : .36));
      let support = Infinity;
      const positions = mesh.geometry.attributes.position;
      for (let i = 0; i < positions.count; i++) support = Math.min(support, vertex.fromBufferAttribute(positions, i).applyEuler(mesh.rotation).y);
      mesh.position.copy(origin);
      mesh.position.y = Math.max(6.025 - support, origin.y - 4.9 * falling * falling);
      mesh.position.x += Math.cos(angle) * settle * 1.3; mesh.position.z += Math.sin(angle) * settle * 1.3;
    });
    const matrix = new THREE.Matrix4(), position = new THREE.Vector3(), scale = new THREE.Vector3(), rotation = new THREE.Quaternion();
    this.rubble.visible = this.dust.visible = active; this.rubble.count = 0; this.dust.count = 0;
    if (!active) return;
    for (let i = 0; i < 32; i++) {
      const falling = age - .86 - i * .14; if (falling < 0) continue;
      const a = i * 2.4, r = 1.5 + i % 6;
      position.set(Math.cos(a) * (r + Math.min(2.1, falling) * .3), Math.max(6.5, 31 - falling * falling * 4.9), -104 + Math.sin(a) * r);
      rotation.setFromEuler(new THREE.Euler(falling * .9, a, falling * 1.3)); scale.setScalar(.3 + i % 4 * .18); matrix.compose(position, rotation, scale);
      this.rubble.setMatrixAt(this.rubble.count++, matrix);
    }
    const opacity = this.dust.geometry.getAttribute('cloudOpacity');
    const dustAge = journey?.scene === 'm3_ceasefire' || breach?.phase === 'done' ? TEMPLE_DEFENSE.breach.drilling + TEMPLE_DEFENSE.breach.waiting
      : age + (breach?.phase === 'waiting' ? breach.elapsed : 0);
    for (let i = 0; i < 24; i++) {
      const growing = dustAge - .9 - i * .16; if (growing < 0) continue;
      const alpha = Math.min(.7, growing * .45) * (1 - THREE.MathUtils.smoothstep(growing, 4.5, 8.2));
      if (alpha < .001) continue;
      const a = i * 2.1;
      position.set(Math.cos(a) * (2 + growing * .65), 26 - growing * .8 + Math.sin(a) * 2, -105 + Math.sin(a) * (2 + growing * .6));
      scale.setScalar(2.5 + growing * 1.25); matrix.compose(position, new THREE.Quaternion(), scale);
      this.dust.setMatrixAt(this.dust.count, matrix); opacity.setX(this.dust.count++, alpha);
    }
    this.rubble.instanceMatrix.needsUpdate = this.dust.instanceMatrix.needsUpdate = opacity.needsUpdate = true;
  }
  dispose(): void {
    if (this.disposed) return; this.disposed = true;
    this.group.removeFromParent(); this.group.clear();
    this.geometries.forEach(geometry => geometry.dispose()); this.materials.forEach(material => material.dispose());
    this.textures.forEach(texture => texture.dispose()); this.lights.forEach(light => light.dispose());
  }
}
