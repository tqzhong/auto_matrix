import * as THREE from 'three';
import { DOCK_EVACUATION, SHAFT_SEAL, dockEvacuationLift, dockEvacuationSoldier, shaftSealLever, type DockEvacuation, type ShaftSeal } from '@auto_matrix/shared';
import { DockCargoModel } from '../agents/DockCargoModel.js';
import { footTrajectory, solveLeg } from '../agents/CharacterMotion.js';
import { DockEvacuationCrew } from './DockEvacuationCrew.js';
import { batchStaticGeometry } from './StaticGeometry.js';

/** Saved evacuation and demolition clocks also drive the physical cage and crowd. */
export class DockEvacuationRenderer {
  readonly group = new THREE.Group();
  readonly lift = new THREE.Group();
  readonly gate = new THREE.Group();
  readonly lever = new THREE.Group();
  private static = new THREE.Group();
  private geometries = new Set<THREE.BufferGeometry>();
  private materials = new Set<THREE.Material>();
  private textures = new Set<THREE.Texture>();
  private cargo = [new DockCargoModel(), new DockCargoModel()];
  private soldiers: THREE.InstancedMesh[] = [];
  private crew?: DockEvacuationCrew;
  private swarm: THREE.InstancedMesh[] = [];
  private rubble?: THREE.InstancedMesh;
  private smoke?: THREE.InstancedMesh;
  private flash?: THREE.PointLight;
  private grip?: THREE.Mesh;
  private scratch = new THREE.Object3D();
  private crewFrame = new THREE.Object3D();
  private crewMatrix = new THREE.Matrix4();
  private disposed = false;
  private lastFrame = '';
  constructor(parent: THREE.Group, private bunker = false) {
    this.group.name = bunker ? 'shaft-seal-set' : 'dock-evacuation-set'; parent.add(this.group); this.group.add(this.static);
    const concrete = this.surface('damaged_plaster', 0x716b55, .95, .03), steel = this.surface('metal_plate', 0x5b5b4a, .7, .6);
    const iron = this.material(0x292b24, .8, .5), rubber = this.material(0x151915, .85, .1);
    const bulb = new THREE.MeshStandardMaterial({ color: 0xedddc0, emissive: 0xffd5a5, emissiveIntensity: 1.2 }); this.materials.add(bulb);
    if (bunker) {
      const floor = this.surface('white_plaster_02', 0x6c6759, .98, 0), casing = this.material(0x716657, .85, .12);
      this.box(floor, 0, -.2, 0, 36, .4, 38, this.static, 'bunker-floor');
      this.box(concrete, 0, 10, 6, 36, .4, 26);
      SHAFT_SEAL.obstacles.forEach((wall, i) => {
        if (wall.z === -6) return;
        this.box(i > 4 ? casing : concrete, wall.x, wall.height / 2, wall.z, wall.width, wall.height, wall.depth, this.static, `bunker-obstacle-${i}`);
      });
      this.box(concrete, 0, 1.35, -6, 36, 2.7, .8);
      this.box(concrete, 0, 8.4, -6, 36, 3.2, .8);
      for (const side of [-1, 1]) this.box(concrete, side * 12.5, 4.75, -6, 11, 4.1, .8);
      const glass = new THREE.MeshPhysicalMaterial({ color: 0x5e695d, roughness: .27, transparent: true, opacity: .12, depthWrite: false, side: THREE.DoubleSide }); this.materials.add(glass);
      this.box(glass, 0, 4.75, -6, 14, 4.1, .08, this.static, 'bunker-witness-window');
      for (const x of [-7, 0, 7]) this.box(iron, x, 4.75, -5.96, .15, 4.1, .15);
      for (const y of [2.7, 6.8]) this.box(iron, 0, y, -5.96, 14, .15, .15);
      const lever = SHAFT_SEAL.lever; this.lever.position.set(lever.x, lever.y, lever.z); this.group.add(this.lever);
      for (const side of [-1, 1]) {
        this.tube(iron, [[side * lever.grip / 2, .02, 0], [side * lever.grip / 2, lever.length - .12, 0],
          [side * (lever.grip / 2 - .025), lever.length - .035, 0], [side * (lever.grip / 2 - .10), lever.length, 0]], .045, this.lever);
        this.box(casing, lever.x + side * .73, lever.y, lever.z, .14, .34, .30);
        this.pipe(steel, [lever.x + side * .67, lever.y, lever.z], [lever.x + side * .82, lever.y, lever.z], .095);
      }
      this.grip = this.pipe(rubber, [-(lever.grip + .2) / 2, lever.length, 0], [(lever.grip + .2) / 2, lever.length, 0], .058, this.lever);
      this.grip.name = 'shaft-seal-grip';
      this.pipe(steel, [lever.x - .69, lever.y, lever.z], [lever.x + .69, lever.y, lever.z], .07);
      this.box(casing, lever.x, 2.22, -2.25, 1.72, .06, 1.91);
      const conduits = new THREE.Group(); conduits.name = 'bunker-conduit-bundle'; this.static.add(conduits);
      for (let i = 0; i < 6; i++) this.tube(rubber, [[lever.x + .20 + i * .08, 1.7 - i * .08, -3.18],
        [7.5, 1.7 + i * .18, -4.9], [12, 3.5 + i * .23, -5.48], [17.3, 3.9 + i * .25, -5.48]], .10 + i * .009, conduits);
      for (const x of [9, 13.5, 16.7]) this.box(casing, x, 3.5, -5.45, .12, 3.1, .22);
      for (const x of [lever.x - .72, lever.x + .72]) for (const y of [.15, .8, 1.5, 2.06]) {
        this.pipe(steel, [x, y, -1.27], [x, y, -1.34], .027);
      }
      const signal = new THREE.MeshStandardMaterial({ color: 0x638462, emissive: 0x638462, emissiveIntensity: 1 }); this.materials.add(signal);
      this.box(signal, lever.x + .52, 2.26, -2.3, .16, .06, .25, this.static, 'evacuation-clear-lamp');
      for (let i = 0; i < 6; i++) {
        const y = 2 + i * 3.2;
        for (const side of [-1, 1]) this.box(steel, side * 5.5, y, -13, 2.8, .45, 7);
        this.box(iron, 0, y, -16, 10, .32, .4);
      }
      const rock = this.material(0x777060, .99, 0);
      this.rubble = this.instances(new THREE.DodecahedronGeometry(1, 0), rock, 40, 'shaft-collapse-rock');
      const pixels = new Uint8Array(96 * 96 * 4);
      for (let y = 0; y < 96; y++) for (let x = 0; x < 96; x++) {
        const index = (y * 96 + x) * 4, radius = Math.hypot(x - 47.5, y - 47.5) / 47.5;
        const grain = .78 + .10 * Math.sin(x * .19 + y * .12) + .09 * Math.cos(y * .23 - x * .1);
        pixels[index] = pixels[index + 1] = pixels[index + 2] = 255;
        pixels[index + 3] = Math.round(Math.max(0, 1 - radius) ** 1.6 * grain * 255);
      }
      const cloud = new THREE.DataTexture(pixels, 96, 96); cloud.needsUpdate = true;
      cloud.magFilter = cloud.minFilter = THREE.LinearFilter; this.textures.add(cloud);
      const dust = new THREE.ShaderMaterial({ transparent: true, depthWrite: false, fog: true,
        uniforms: { ...THREE.UniformsUtils.clone(THREE.UniformsLib.fog), cloud: { value: cloud }, color: { value: new THREE.Color(0x9b927f) } },
        vertexShader: `
          attribute float cloudOpacity;
          varying vec2 vCloudUv;
          varying float vCloudOpacity;
          #include <fog_pars_vertex>
          void main() {
            vCloudUv = uv; vCloudOpacity = cloudOpacity;
            vec4 mvPosition = modelViewMatrix * instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0);
            vec2 size = vec2(length(instanceMatrix[0].xyz), length(instanceMatrix[1].xyz));
            mvPosition.xy += position.xy * size;
            gl_Position = projectionMatrix * mvPosition;
            #include <fog_vertex>
          }`,
        fragmentShader: `
          uniform sampler2D cloud;
          uniform vec3 color;
          varying vec2 vCloudUv;
          varying float vCloudOpacity;
          #include <fog_pars_fragment>
          void main() {
            float alpha = texture2D(cloud, vCloudUv).a * vCloudOpacity;
            if (alpha < 0.008) discard;
            gl_FragColor = vec4(color, alpha);
            #include <tonemapping_fragment>
            #include <colorspace_fragment>
            #include <fog_fragment>
          }` }); this.materials.add(dust);
      const cloudGeometry = new THREE.PlaneGeometry(1, 1);
      cloudGeometry.setAttribute('cloudOpacity', new THREE.InstancedBufferAttribute(new Float32Array(36), 1));
      this.smoke = this.instances(cloudGeometry, dust, 36, 'shaft-collapse-dust'); this.smoke.receiveShadow = false;
      this.smoke.raycast = () => {};
      this.flash = new THREE.PointLight(0xffc889, 0, 38, 2); this.flash.position.set(0, 7, -13); this.group.add(this.flash);
      this.workLight(bulb, -8, 7.5, 3, 180, 28); this.workLight(bulb, 4, 7.5, 3, 170, 22);
    } else {
      this.group.add(this.lift); const cage = DOCK_EVACUATION.lift;
      for (const side of [-1, 1]) this.box(concrete, side * 14.25, -.2, 0, 19.5, .4, 82);
      this.box(concrete, 0, -.2, 7.25, 9, .4, 67.5);
      this.box(concrete, 0, -.2, -37.25, 9, .4, 7.5);
      DOCK_EVACUATION.walls.forEach((wall, i) => this.box(i > 12 ? steel : concrete, wall.x, wall.height / 2, wall.z, wall.width, wall.height, wall.depth, this.static, `evacuation-obstacle-${i}`));
      for (const side of [-1, 1]) {
        this.box(concrete, side * 4.65, -9, cage.z, .2, 18, 7.3);
        for (const z of [-24, -6, 12, 30]) {
          this.box(steel, side * 22, 8, z, .3, .3, 12);
          this.box(concrete, side * 20, 19, z, 2, 1, 4);
        }
        for (let row = 0; row < 4; row++) this.pipe(iron, [side * 22.6, 5 + row * .8, -40], [side * 22.6, 5 + row * .8, 40], .2 + row * .05);
      }
      this.lift.name = 'evacuation-moving-cage'; this.lift.position.set(cage.x, 0, cage.z);
      this.box(steel, 0, -.16, 0, cage.width, .32, cage.depth, this.lift, 'evacuation-lift-deck');
      this.box(steel, 0, cage.height, 0, cage.width, .18, cage.depth, this.lift);
      for (const side of [-1, 1]) {
        for (let z = -cage.depth / 2; z <= cage.depth / 2; z += .5) this.box(iron, side * cage.width / 2, cage.height / 2, z, .065, cage.height, .065, this.lift);
        for (const y of [1.8, 4.3, cage.height]) this.box(steel, side * cage.width / 2, y, 0, .12, .12, cage.depth, this.lift);
        this.pipe(steel, [side * 3.5, cage.height, 0], [side * 3.5, 33, 0], .1, this.lift);
      }
      for (let x = -4.5; x <= 4.5; x += .5) this.box(iron, x, cage.height / 2, -cage.depth / 2, .065, cage.height, .065, this.lift);
      this.gate.name = 'evacuation-cage-gate'; this.gate.position.z = cage.depth / 2; this.lift.add(this.gate);
      for (let x = -4.5; x <= 4.5; x += .5) this.box(iron, x, cage.height / 2, 0, .065, cage.height, .12, this.gate);
      for (const y of [.2, 2.2, 4.5, cage.height]) this.box(steel, 0, y, 0, cage.width, .12, .18, this.gate);
      this.workLight(bulb, 0, 6.5, 0, 90, 14, this.lift);
      for (const z of [-20, 0, 25]) this.workLight(bulb, -16, 9, z, 350, 34);
      this.workLight(bulb, 10, 7, -21, 260, 25);
      this.cargo.forEach(prop => this.group.add(prop.root));
      this.cargo.forEach((prop, i) => { const at = DOCK_EVACUATION.cargoRest[i]; prop.root.position.set(at.x, at.y, at.z); });
      for (let row = 0; row < 2; row++) for (const x of [-15.4, -12.6]) this.box(steel, x, .8 + row * .65, 21.9, 1.2, .62, .7);
      for (const z of [-23, -18]) for (const x of [-1, 1]) this.box(steel, x * 7.5, .1, z, .08, .02, 2.5);
      const skin = this.material(0xb09173, .92, 0), cloth = this.material(0x5c5946, .97, .02);
      const shirt = new THREE.LatheGeometry([[.01, -.57], [.32, -.57], [.37, -.35], [.41, .1], [.51, .4], [.44, .54], [.18, .62], [.01, .62]].map(([x, y]) => new THREE.Vector2(x, y)), 20);
      shirt.scale(1, 1, .65);
      this.soldiers = [this.instances(new THREE.SphereGeometry(1, 16, 12), skin, 6, 'evacuation-crew-heads'),
        this.instances(shirt, cloth, 6, 'evacuation-crew-uniforms'),
        this.instances(new THREE.CapsuleGeometry(.18, .64, 4, 10), cloth, 24, 'evacuation-crew-trousers'),
        this.instances(new THREE.CapsuleGeometry(.19, .62, 4, 10), cloth, 12, 'evacuation-crew-sleeves'),
        this.instances(new THREE.CapsuleGeometry(.13, .74, 4, 10), skin, 12, 'evacuation-crew-forearms'),
        this.instances(new THREE.SphereGeometry(1, 12, 8), skin, 12, 'evacuation-crew-hands'),
        this.instances(new THREE.SphereGeometry(1, 12, 8), rubber, 12, 'evacuation-crew-boots'),
        this.instances(new THREE.SphereGeometry(1, 10, 8), skin, 30, 'evacuation-crew-faces'),
        this.instances(new THREE.SphereGeometry(1, 12, 8), rubber, 6, 'evacuation-crew-hair'),
        this.instances(new THREE.SphereGeometry(1, 8, 6), rubber, 12, 'evacuation-crew-eyes')];
      for (let i = 0; i < 6; i++) this.soldiers[1].setColorAt(i, new THREE.Color([0xa59a79, 0x786448, 0x9b7958, 0x847355, 0xb2a183, 0x766b58][i]));
      this.soldiers.forEach(mesh => { mesh.castShadow = true; });
      if (typeof window !== 'undefined') {
        this.crew = new DockEvacuationCrew(this.group);
        this.crew.ready.then(() => { this.soldiers.forEach(mesh => { mesh.visible = false; }); })
          .catch(error => console.warn('Dock withdrawal crew could not load; retaining the articulated fallback.', error));
      }
      const machine = this.material(0x696b60, .45, .8), eye = new THREE.MeshBasicMaterial({ color: 0xff3827, toneMapped: false }); this.materials.add(eye);
      this.swarm = [this.instances(new THREE.IcosahedronGeometry(1, 2), machine, 48, 'evacuation-sentinel-shells'),
        this.instances(new THREE.SphereGeometry(.15, 8, 6), eye, 48 * 7, 'evacuation-sentinel-eyes'),
        this.instances(new THREE.CylinderGeometry(.08, .11, 1, 5), machine, 48 * 6 * 7, 'evacuation-sentinel-tendrils')];
    }
    batchStaticGeometry(this.static, new Set()).forEach(g => this.geometries.add(g));
    this.update();
  }
  private material(color: number, roughness: number, metalness: number) {
    const material = new THREE.MeshStandardMaterial({ color, roughness, metalness }); this.materials.add(material); return material;
  }
  private surface(name: string, color: number, roughness: number, metalness: number) {
    const material = this.material(color, roughness, metalness);
    if (typeof document !== 'undefined') for (const [suffix, slot] of [['color', 'map'], ['normal', 'normalMap'], ['roughness', 'roughnessMap']] as const) {
      const texture = new THREE.TextureLoader().load(`/assets/film-materials/${name}-${suffix}.jpg`, value => { if (this.disposed) value.dispose(); });
      texture.wrapS = texture.wrapT = THREE.RepeatWrapping; texture.repeat.set(5, 5); texture.anisotropy = 4;
      if (slot === 'map') texture.colorSpace = THREE.SRGBColorSpace; material[slot] = texture; this.textures.add(texture);
    }
    material.normalScale.set(.35, .35); return material;
  }
  private box(material: THREE.Material, x: number, y: number, z: number, w: number, h: number, d: number, parent: THREE.Object3D = this.static, name?: string) {
    const geometry = new THREE.BoxGeometry(w, h, d); this.geometries.add(geometry);
    const mesh = new THREE.Mesh(geometry, material); mesh.position.set(x, y, z); mesh.castShadow = mesh.receiveShadow = true; if (name) mesh.name = name; parent.add(mesh); return mesh;
  }
  private pipe(material: THREE.Material, a: number[], b: number[], radius: number, parent: THREE.Object3D = this.static) {
    const start = new THREE.Vector3(...a), end = new THREE.Vector3(...b), delta = end.clone().sub(start);
    const geometry = new THREE.CylinderGeometry(radius, radius, delta.length(), 16); this.geometries.add(geometry);
    const mesh = new THREE.Mesh(geometry, material); mesh.position.copy(start).addScaledVector(delta, .5); mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), delta.normalize()); parent.add(mesh); return mesh;
  }
  private tube(material: THREE.Material, points: number[][], radius: number, parent: THREE.Object3D) {
    const curve = new THREE.CatmullRomCurve3(points.map(point => new THREE.Vector3(...point)));
    const geometry = new THREE.TubeGeometry(curve, 32, radius, 12, false); this.geometries.add(geometry);
    const mesh = new THREE.Mesh(geometry, material); mesh.castShadow = mesh.receiveShadow = true; parent.add(mesh);
  }
  private workLight(material: THREE.Material, x: number, y: number, z: number, intensity: number, distance: number, parent: THREE.Object3D = this.static) {
    this.box(material, x, y, z, .9, .12, .45, parent); const light = new THREE.PointLight(0xffddb0, intensity, distance, 2); light.position.set(x, y - .2, z); parent.add(light);
  }
  private instances(geometry: THREE.BufferGeometry, material: THREE.Material, count: number, name: string) {
    this.geometries.add(geometry); const mesh = new THREE.InstancedMesh(geometry, material, count); mesh.name = name; mesh.frustumCulled = false; mesh.receiveShadow = true; this.group.add(mesh); return mesh;
  }
  private instance(mesh: THREE.InstancedMesh, index: number, x: number, y: number, z: number, sx: number, sy: number, sz: number, rx = 0, ry = 0, rz = 0): void {
    this.scratch.position.set(x, y, z); this.scratch.scale.set(sx, sy, sz); this.scratch.rotation.set(rx, ry, rz); this.scratch.updateMatrix(); mesh.setMatrixAt(index, this.scratch.matrix);
  }
  private crewPart(mesh: THREE.InstancedMesh, index: number, x: number, y: number, z: number, sx: number, sy: number, sz: number, rx = 0): void {
    this.scratch.position.set(x, y, z); this.scratch.scale.set(sx, sy, sz); this.scratch.rotation.set(rx, 0, 0); this.scratch.updateMatrix();
    mesh.setMatrixAt(index, this.crewMatrix.multiplyMatrices(this.crewFrame.matrix, this.scratch.matrix));
  }
  update(evacuation?: DockEvacuation, seal?: ShaftSeal): void {
    const key = `${evacuation?.phase}:${evacuation?.elapsed}:${evacuation?.crewAge}:${seal?.phase}:${seal?.turn}:${seal?.elapsed}`;
    if (key === this.lastFrame) return; this.lastFrame = key;
    this.crew?.update(evacuation);
    if (this.bunker) {
      this.lever.rotation.x = shaftSealLever(seal).angle;
      const time = seal?.phase === 'done' ? SHAFT_SEAL.blast : seal?.phase === 'detonating' ? seal.elapsed : -1;
      if (this.flash) this.flash.intensity = time < 0 ? 0 : 900 * Math.max(0, Math.sin(time * 9)) * Math.max(0, 1 - time / 7.2);
      this.rubble!.visible = time >= 0;
      for (let i = 0; i < 40; i++) {
        const age = Math.max(0, time - Math.floor(i / 7) * .7), fall = Math.min(2 + i % 6 * 3.2, 4.9 * age * age);
        this.instance(this.rubble!, i, Math.sin(i * 2.39) * 4.5, 2 + i % 6 * 3.2 - fall + .7, -13 + Math.cos(i * 2.39) * 3, .15 + i % 3 * .12, .22, .3, age * .8, i * 2.39);
      }
      let dustCount = 0;
      for (let i = 0; i < 36; i++) {
        const age = time - i % 6 * .7;
        if (age <= 0) continue;
        const size = .45 + Math.min(6.3, age * .85), opacity = this.smoke!.geometry.getAttribute('cloudOpacity');
        this.instance(this.smoke!, dustCount, Math.sin(i * 2.39) * (4.5 + age * .12), 2 + i % 6 * 3 + Math.min(3, age * .2), -13 + Math.cos(i * 2.39) * 2, size, size * .8, 1);
        opacity.setX(dustCount++, .68 * THREE.MathUtils.smoothstep(age, 0, .3) * Math.exp(-age * .12));
      }
      // Zero-scaled instances divide by zero in Three's normal shader, contaminating bloom and occlusion.
      this.smoke!.count = dustCount; this.smoke!.visible = dustCount > 0;
      this.smoke!.geometry.getAttribute('cloudOpacity').needsUpdate = true;
      this.rubble!.instanceMatrix.needsUpdate = this.smoke!.instanceMatrix.needsUpdate = true; return;
    }
    const state = evacuation ?? { phase: 'supplies', elapsed: 0, crewAge: 0, remaining: 26, attempts: 0, delivered: false };
    this.lift.position.y = dockEvacuationLift(state);
    const close = ['lowering', 'clear'].includes(state.phase) ? 1 : state.phase === 'closing' ? THREE.MathUtils.smoothstep(state.elapsed, 0, DOCK_EVACUATION.lift.closing) : 0;
    this.gate.position.y = (1 - close) * (DOCK_EVACUATION.lift.height + .3);
    this.cargo[0].root.visible = state.phase === 'supplies'; this.cargo[1].root.visible = state.delivered;
    for (let i = 0; i < 6; i++) {
      const at = dockEvacuationSoldier(state, i), row = Math.floor(i / 3);
      const age = Math.max(0, state.crewAge - i * .4), speed = (43.8 + row * 3.5) / (DOCK_EVACUATION.crewSeconds - i * .4);
      const phase = age * speed / (2 * .68 / .6), hipHeight = at.moving ? 1.88 : 1.98;
      this.crewFrame.position.set(at.x, at.y, at.z); this.crewFrame.rotation.y = at.yaw; this.crewFrame.updateMatrix();
      this.crewPart(this.soldiers[0], i, 0, hipHeight + 1.6, 0, .29, .4, .28);
      this.crewPart(this.soldiers[1], i, 0, hipHeight + .51, 0, 1, 1, 1);
      this.crewPart(this.soldiers[8], i, 0, hipHeight + 1.84, -.045, .3, .2, .28);
      this.crewPart(this.soldiers[7], i * 5, 0, hipHeight + 1.53, .28, .055, .095, .07);
      this.crewPart(this.soldiers[7], i * 5 + 1, 0, hipHeight + 1.38, .243, .09, .014, .017);
      this.crewPart(this.soldiers[7], i * 5 + 4, 0, hipHeight + 1.19, 0, .13, .18, .13);
      for (const [j, sign] of [-1, 1].entries()) {
        this.crewPart(this.soldiers[7], i * 5 + 2 + j, sign * .29, hipHeight + 1.52, 0, .055, .11, .05);
        this.crewPart(this.soldiers[9], i * 2 + j, sign * .095, hipHeight + 1.62, .258, .027, .019, .012);
        const foot = footTrajectory(phase + j * .5, .68, .6), lift = at.moving ? foot.lift * .38 : 0;
        const z = at.moving ? foot.z : 0, leg = solveLeg(z, hipHeight - .155 - lift);
        const kneeY = hipHeight - Math.cos(leg.hip) * .94, kneeZ = -Math.sin(leg.hip) * .94;
        this.crewPart(this.soldiers[2], i * 4 + j * 2, sign * .24, (hipHeight + kneeY) / 2, kneeZ / 2, 1.12, .94, 1, leg.hip);
        this.crewPart(this.soldiers[2], i * 4 + j * 2 + 1, sign * .24, (kneeY + .155 + lift) / 2, (kneeZ + z) / 2, .93, .9, .93, leg.hip + leg.knee);
        this.crewPart(this.soldiers[6], i * 2 + j, sign * .24, .155 + lift, z + .14, .18, .155, .34);
        const swing = at.moving ? Math.cos((phase + j * .5) * Math.PI * 2) * .55 : .08;
        const elbowY = hipHeight + 1.08 - Math.cos(swing) * .72, elbowZ = -Math.sin(swing) * .72;
        const forearm = swing - .7, handY = elbowY - Math.cos(forearm) * .7, handZ = elbowZ - Math.sin(forearm) * .7;
        this.crewPart(this.soldiers[3], i * 2 + j, sign * .55, hipHeight + 1.08 - Math.cos(swing) * .36, elbowZ / 2, 1, .72, 1, swing);
        this.crewPart(this.soldiers[4], i * 2 + j, sign * .55, (elbowY + handY) / 2, (elbowZ + handZ) / 2, 1, .7, 1, forearm);
        this.crewPart(this.soldiers[5], i * 2 + j, sign * .55, handY, handZ, .11, .17, .075, forearm);
      }
    }
    const arrival = ['wind', 'order', 'running', 'waiting', 'closing', 'lowering', 'clear', 'failed'].includes(state.phase);
    this.swarm.forEach(mesh => { mesh.visible = arrival; });
    const age = state.phase === 'wind' ? state.elapsed : state.phase === 'order' ? 3.6 + state.elapsed : 7 + state.crewAge;
    for (let i = 0; i < 48; i++) {
      const x = Math.sin(i * 2.399) * 18, y = 12 + i % 5 * 2.2, z = Math.max(-24, 47 - age * 3.4 + i % 8 * 3);
      this.instance(this.swarm[0], i, x, y, z, 1.1, .65, 1.4, .1, Math.PI);
      for (let eye = 0; eye < 7; eye++) this.instance(this.swarm[1], i * 7 + eye, x + Math.cos(eye) * .6, y + Math.sin(eye) * .4, z - 1.15, 1, 1, 1);
      for (let tail = 0; tail < 6; tail++) for (let part = 0; part < 7; part++) {
        const angle = tail * Math.PI / 3;
        this.instance(this.swarm[2], (i * 6 + tail) * 7 + part, x + Math.cos(angle) * (1 + part * .3), y + Math.sin(angle) * (1 + part * .3) + Math.sin(age * 3 + part) * .18, z + .8 + part * .5,
          1, .65, 1, Math.PI / 2, angle * .1);
      }
    }
    [...this.soldiers, ...this.swarm].forEach(mesh => { mesh.instanceMatrix.needsUpdate = true; });
  }
  dispose(): void {
    this.disposed = true; this.group.removeFromParent(); this.cargo.forEach(prop => prop.dispose()); this.crew?.dispose();
    this.geometries.forEach(g => g.dispose()); this.materials.forEach(m => m.dispose()); this.textures.forEach(t => t.dispose());
  }
}
