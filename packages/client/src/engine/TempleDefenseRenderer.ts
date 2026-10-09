import * as THREE from 'three';
import { TEMPLE_DEFENSE, type FilmJourney } from '@auto_matrix/shared';
import { batchStaticGeometry } from './StaticGeometry.js';

/** The temple has an open firing bottleneck, not a powered door that can stop the siege. */
export class TempleDefenseRenderer {
  readonly group = new THREE.Group();
  private wheels: THREE.Group[] = [];
  private drill = new THREE.Group();
  private rubble: THREE.InstancedMesh;
  private dust: THREE.InstancedMesh;
  private geometries = new Set<THREE.BufferGeometry>();
  private materials = new Set<THREE.Material>();
  private textures = new Set<THREE.Texture>();
  private lights: THREE.PointLight[] = [];
  private disposed = false;

  constructor(root: THREE.Group) {
    this.group.name = 'temple-last-defense'; root.add(this.group);
    const steel = this.surface('metal_plate', 0x687472, .62, .55), dark = this.material(0x2c3436, .73, .3);
    const stone = this.surface('damaged_plaster', 0x615a53, 1, .01), cloth = this.material(0x726759, .95, 0);
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
    // The distant city is visible through the narrow entrance; its roofs and service bridges remain outside the walking floor.
    const outside = new THREE.Group(); outside.name = 'temple-city-outlook'; this.group.add(outside);
    for (const side of [-1, 1]) {
      this.box(stone, side * 14, 7, -54, 10, 14, 5, outside);
      this.box(dark, side * 11.5, .1, -68, .8, .3, 30, outside);
      for (let z = -54; z > -80; z -= 2.8) this.pipe(steel, [side * 11.5, .2, z], [side * 11.5, 2.4, z], .06, outside);
      this.pipe(steel, [side * 11.5, 2.4, -54], [side * 11.5, 2.4, -81], .065, outside);
    }
    this.box(stone, 0, 15.3, -54, 37, 2.6, 5, outside);
    this.box(dark, 0, -.3, -70, 24, .5, 34, outside);
    for (let i = 0; i < 9; i++) {
      const x = (i % 3 - 1) * 29, z = -105 - Math.floor(i / 3) * 27, height = 15 + i % 4 * 4;
      this.cylinder(stone, x, -13 + height / 2, z, 7 + i % 2, height, outside);
      for (let y = -9; y < height - 13; y += 3.2) {
        const ring = this.mesh(new THREE.TorusGeometry(7.2 + i % 2, .17, 8, 32), steel, outside); ring.rotation.x = Math.PI / 2; ring.position.set(x, y, z);
      }
      for (const side of [-1, 1]) this.pipe(dark, [x + side * 6.3, -12, z], [x + side * 6.3, height - 10, z], .38, outside);
      this.box(dark, x, -3, z + 12, 28, .55, 3, outside);
      for (let j = -12; j <= 12; j += 3) this.pipe(steel, [x + j, -2.7, z + 10.8], [x + j, -1.1, z + 10.8], .05, outside);
      this.pipe(steel, [x - 13, -1.1, z + 10.8], [x + 13, -1.1, z + 10.8], .05, outside);
    }
    this.drill.name = 'temple-city-digger'; this.drill.position.set(0, 38, -105); this.group.add(this.drill);
    const tip = this.mesh(new THREE.ConeGeometry(5.4, 10, 32), steel, this.drill); tip.rotation.z = Math.PI;
    for (let i = 0; i < 7; i++) { const ring = this.mesh(new THREE.TorusGeometry(5.5 - i * .55, .28, 10, 32), dark, this.drill); ring.rotation.x = Math.PI / 2; ring.position.y = 4.1 - i * 1.25; }
    this.cylinder(dark, 0, 8.5, 0, 5.5, 7, this.drill);
    this.rubble = new THREE.InstancedMesh(new THREE.DodecahedronGeometry(.5, 0), stone, 32); this.rubble.name = 'temple-breach-rubble'; this.rubble.frustumCulled = false;
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
    for (const point of [[-8, 6, -43, 210, 24], [8, 6, -43, 210, 24], [0, 27, -100, 1400, 135]]) {
      const light = new THREE.PointLight(0x8fafd3, point[3], point[4], 2); light.position.set(point[0], point[1], point[2]); this.group.add(light); this.lights.push(light);
    }
    batchStaticGeometry(this.group, new Set()).forEach(geometry => this.geometries.add(geometry));
    this.update(undefined);
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
  private pipe(material: THREE.Material, a: number[], b: number[], radius: number, parent = this.group): void {
    const start = new THREE.Vector3(...a), end = new THREE.Vector3(...b), delta = end.clone().sub(start);
    const mesh = this.mesh(new THREE.CylinderGeometry(radius, radius, delta.length(), 16), material, parent);
    mesh.position.copy(start).addScaledVector(delta, .5); mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), delta.normalize());
  }
  update(journey?: FilmJourney): void {
    this.group.visible = Boolean(journey && !journey.visiting && ['m3_temple_defense', 'm3_temple_breach', 'm3_ceasefire'].includes(journey.scene));
    if (!this.group.visible) return;
    this.wheels.forEach((wheel, index) => wheel.rotation.z = (journey?.templeSeal?.turns?.[index] ?? (journey?.completed.includes('m3_temple_defense') ? 1 : 0)) * TEMPLE_DEFENSE.wheel.angle);
    const breach = journey?.scene === 'm3_temple_breach' ? journey.templeBreach : undefined;
    const active = Boolean(breach && ['breach', 'waiting', 'done'].includes(breach.phase));
    const age = breach?.phase === 'breach' ? breach.elapsed : TEMPLE_DEFENSE.breach.drilling;
    this.drill.visible = active; this.drill.position.y = 38 - Math.min(1, age / TEMPLE_DEFENSE.breach.drilling) * 19;
    this.drill.rotation.y = age * 2.7;
    const matrix = new THREE.Matrix4(), position = new THREE.Vector3(), scale = new THREE.Vector3(), rotation = new THREE.Quaternion();
    this.rubble.visible = this.dust.visible = active; this.rubble.count = 0; this.dust.count = 0;
    if (!active) return;
    for (let i = 0; i < 32; i++) {
      const falling = age - .45 - i * .14; if (falling < 0) continue;
      const a = i * 2.4, r = 1.5 + i % 6;
      position.set(Math.cos(a) * (r + falling * .3), 28 - Math.min(30, falling * falling * 4.9), -104 + Math.sin(a) * r);
      rotation.setFromEuler(new THREE.Euler(falling * .9, a, falling * 1.3)); scale.setScalar(.3 + i % 4 * .18); matrix.compose(position, rotation, scale);
      this.rubble.setMatrixAt(this.rubble.count++, matrix);
    }
    const opacity = this.dust.geometry.getAttribute('cloudOpacity');
    for (let i = 0; i < 24; i++) {
      const growing = age - .9 - i * .16; if (growing < 0) continue;
      const a = i * 2.1;
      position.set(Math.cos(a) * (2 + growing * .65), 26 - growing * .8 + Math.sin(a) * 2, -105 + Math.sin(a) * (2 + growing * .6));
      scale.setScalar(2.5 + growing * 1.25); matrix.compose(position, new THREE.Quaternion(), scale);
      this.dust.setMatrixAt(this.dust.count, matrix); opacity.setX(this.dust.count++, Math.min(.7, growing * .45));
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
