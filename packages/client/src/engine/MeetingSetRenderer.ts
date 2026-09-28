import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { Reflector } from 'three/addons/objects/Reflector.js';
import { MEETING_CAR, MEETING_DESTINATION, MEETING_ROAD_SAMPLES, MEETING_ROAD_WIDTH, bridgeArrivalPose, meetingCarPose, meetingPose, type FilmJourney, type MeetingGesture } from '@auto_matrix/shared';
import { LafayetteApproachRenderer } from './LafayetteApproachRenderer.js';

// The occupants and vehicle share the server's saved route. The street and
// car body are separate material batches, so no scenery moves with the car.
export class MeetingSetRenderer {
  private root = new THREE.Group();
  private static = new THREE.Group();
  private vehicle = new THREE.Group();
  private door = new THREE.Group();
  private leftDoor = new THREE.Group();
  private wheels: { steering: THREE.Group; spin: THREE.Group; front: boolean }[] = [];
  private steering = new THREE.Group();
  private wipers: THREE.Group[] = [];
  private streetLamps: THREE.Vector3[] = [];
  private lightPool: THREE.PointLight[] = [];
  private hotel?: LafayetteApproachRenderer;
  private window!: THREE.Mesh;
  private reflection!: Reflector;
  private rain!: THREE.LineSegments;
  private rainBase = new Float32Array(1500 * 3);
  private runoff!: THREE.InstancedMesh<THREE.PlaneGeometry, THREE.ShaderMaterial>;
  private spray!: THREE.Mesh<THREE.BufferGeometry, THREE.ShaderMaterial>;
  private geometries = new Set<THREE.BufferGeometry>();
  private materials = new Set<THREE.Material>();
  private textures = new Set<THREE.Texture>();
  private disposed = false;
  constructor(parent: THREE.Group, includeHotel = true) {
    parent.add(this.root); this.root.add(this.static);
    const material = (color: number, roughness = .6, metalness = 0) => new THREE.MeshStandardMaterial({ color, roughness, metalness });
    const paint = new THREE.MeshPhysicalMaterial({ color: 0x090f10, roughness: .22, metalness: .62, clearcoat: 1, clearcoatRoughness: .12 });
    const chrome = material(0xa4b1b0, .19, .93); const black = material(0x080b0c, .85);
    const leather = material(0x191e1c, .43); const rubber = material(0x111313, .94);
    const glass = new THREE.MeshPhysicalMaterial({ color: 0x829c92, roughness: .16, metalness: .05, transparent: true, opacity: .13, depthWrite: false, side: THREE.DoubleSide });
    const stone = material(0x5b6762, .86);
    const road = new THREE.MeshPhysicalMaterial({ color: 0x909a94, roughness: .72, metalness: .02, clearcoat: .6, clearcoatRoughness: .28 });
    road.name = 'meeting-asphalt'; road.normalScale.set(.55, .55);
    const pavement = new THREE.MeshPhysicalMaterial({ color: 0x969a8c, roughness: .82, clearcoat: .22, clearcoatRoughness: .4 });
    pavement.normalScale.set(.5, .5);
    this.surfaceMaps(road, 'asphalt_02'); this.surfaceMaps(pavement, 'concrete_pavement_03');
    const load = (name: string, repeat: number) => {
      const texture = new THREE.TextureLoader().load(`/assets/film-materials/${name}.jpg`); texture.wrapS = texture.wrapT = THREE.RepeatWrapping; texture.repeat.set(repeat, repeat); texture.anisotropy = 4; this.textures.add(texture); return texture;
    };
    stone.map = load('damaged_plaster-color', 2); stone.map.colorSpace = THREE.SRGBColorSpace; stone.normalMap = load('damaged_plaster-normal', 2); stone.normalScale.set(.38, .38);
    leather.normalMap = load('leather_red_03-normal', 2); leather.normalScale.set(.35, .35);
    const glow = new THREE.MeshBasicMaterial({ color: 0xfbeed0 });
    this.buildStreet(road, pavement, stone, black, chrome, glow);
    if (includeHotel) this.hotel = new LafayetteApproachRenderer(this.root, new THREE.Vector3(MEETING_DESTINATION.x, 0, 0), true);
    this.buildPuddles();
    for (const x of [-23, 23]) {
      this.box(x, .22, 0, 2, .46, 108, stone);
      this.box(x, 8, -14, 3.6, 16, 23, stone);
      for (let i = 0; i < 9; i++) this.box(x, i * 1.7 + 1.2, -14, 3.9, .14, 23.2, stone);
      for (const z of [-34, 22]) {
        this.cylinder(x, 6.7, z, .14, 13.4, chrome);
        this.box(x, 13.3, z, 1.4, .3, 1.4, black);
        this.box(x, 13.1, z, 1.1, .08, 1.1, glow);
        const light = new THREE.PointLight(0xb9d0be, 110, 32, 2); light.position.set(x, 12.6, z); this.root.add(light);
      }
    }
    // A shallow masonry barrel, with joints rather than shiny metal ribs.
    const arch = new THREE.Shape();
    arch.moveTo(-21.2, 5.8); for (let i = 0; i <= 64; i++) { const a = Math.PI - i / 64 * Math.PI; arch.lineTo(Math.cos(a) * 21.2, 5.8 + Math.sin(a) * 7.8); }
    arch.lineTo(23, 23); arch.lineTo(-23, 23); arch.closePath();
    const archGeometry = new THREE.ExtrudeGeometry(arch, { depth: 22, bevelEnabled: false, steps: 1 });
    const uv = archGeometry.getAttribute('uv'); for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * .09, uv.getY(i) * .09);
    const bridge = this.mesh(this.static, archGeometry, stone);
    bridge.position.z = -25;
    const mortar = material(0x252e28, .98);
    const archStone = [0x6f7265, 0x808073, 0x747a6d].map(color => { const m = stone.clone(); m.color.setHex(color); return m; });
    for (const z of [-25.3, -2.99]) for (let i = 0; i < 29; i++) {
      const a = i / 29 * Math.PI + .002; const b = (i + 1) / 29 * Math.PI - .002;
      const block = new THREE.Shape();
      for (let j = 0; j <= 4; j++) { const t = a + (b - a) * j / 4; const x = Math.cos(t) * 21.2; const y = 5.8 + Math.sin(t) * 7.8; if (j) block.lineTo(x, y); else block.moveTo(x, y); }
      for (let j = 4; j >= 0; j--) { const t = a + (b - a) * j / 4; block.lineTo(Math.cos(t) * 22.6, 5.8 + Math.sin(t) * 9.2); }
      block.closePath();
      const geometry = new THREE.ExtrudeGeometry(block, { depth: .3, bevelEnabled: false, steps: 1 });
      const blockUv = geometry.getAttribute('uv'); for (let j = 0; j < blockUv.count; j++) blockUv.setXY(j, blockUv.getX(j) * .09, blockUv.getY(j) * .09);
      this.mesh(this.static, geometry, archStone[i % 3]).position.z = z;
    }
    for (const z of [-25.02, -17.7, -10.3, -2.98]) {
      const curve = new THREE.CatmullRomCurve3(Array.from({ length: 65 }, (_, i) => { const a = Math.PI - i / 64 * Math.PI; return new THREE.Vector3(Math.cos(a) * 21.18, 5.78 + Math.sin(a) * 7.8, z); }));
      this.mesh(this.static, new THREE.TubeGeometry(curve, 64, .025, 4), mortar);
    }
    for (const side of [-1, 1]) for (let row = 0; row < 4; row++) for (let column = 0; column < 7; column++) {
      this.box(side * 21.15, .7 + row * 1.4, -24 + column * 3.25 + row % 2 * 1.6, .018, 1.34, .045, mortar);
    }
    this.box(0, 13.25, -14, 1.4, .2, .5, black); this.box(0, 13.12, -14, 1.1, .04, .35, glow);
    const vaultLight = new THREE.PointLight(0xb9c9b4, 80, 28, 2); vaultLight.position.set(0, 12.8, -14); this.root.add(vaultLight);
    for (const z of [-29, 1]) {
      const light = new THREE.SpotLight(0xc2d6d1, 260, 48, .88, .85, 1.6);
      light.position.set(0, 12.3, z); light.target.position.set(0, 0, z + (z < -14 ? 10 : -10)); this.root.add(light, light.target);
    }
    this.buildRunoff();
    for (let z = -45; z < 45; z += 10) this.box(-7, .012, z, .16, .016, 4, material(0xa6a078, .6));
    for (const x of [-30, 32]) for (let i = 0; i < 6; i++) {
      const h = 20 + i % 3 * 7; const z = 25 + i * 14;
      this.box(x, h / 2, z, 14, h, 10, stone);
      for (let y = 4; y < h - 2; y += 3.5) for (let column = 0; column < 3; column++) this.box(x + (x < 0 ? 7.02 : -7.02), y, z - 3 + column * 3, .03, 1.5, 1, i % 2 ? black : glow);
    }
    const car = new THREE.Group(); this.vehicle.add(car); this.root.add(this.vehicle);
    this.box(0, .67, 0, 5.1, .35, 12.8, black, car);
    this.box(0, .96, .3, 4.9, .18, 7.2, black, car);
    this.box(0, 1.65, -4.77, 5.28, 1.35, 3.85, paint, car, .17);
    this.box(0, 1.66, 5.02, 5.28, 1.38, 3.5, paint, car, .15);
    this.box(0, 2.38, -4.6, 5.19, .16, 3.9, paint, car, .08);
    this.box(0, 2.45, 5.02, 5.19, .16, 3.5, paint, car, .08);
    for (const z of [-6.75, 6.75]) this.box(0, .99, z, 5.5, .34, .32, chrome, car, .09);
    this.box(0, 1.65, -6.74, 3.2, .74, .05, black, car);
    for (let i = -12; i <= 12; i++) this.box(i * .12, 1.65, -6.78, .035, .7, .04, chrome, car);
    const tailLens = new THREE.MeshBasicMaterial({ color: 0xe63b28, toneMapped: false });
    for (const side of [-1, 1]) {
      this.box(side * 1.65, 1.75, 6.77, 1.35, .52, .09, black, car, .06);
      this.box(side * 1.65, 1.75, 6.83, 1.12, .33, .035, tailLens, car, .035);
      const tailLight = new THREE.SpotLight(0xef2f20, 58, 18, .72, .5, 2);
      tailLight.name = `meeting-tail-light-${side}`; tailLight.position.set(side * 1.65, 1.75, 6.87);
      tailLight.target.position.set(side * 1.65, .45, 15); this.vehicle.add(tailLight, tailLight.target);
    }
    this.box(0, 1.58, 6.82, .76, .24, .04, chrome, car, .025);
    for (const x of [-2.08, -1.55, 1.55, 2.08]) {
      const lamp = this.cylinder(x, 1.68, -6.79, .215, .07, glow, car); lamp.rotation.x = Math.PI / 2;
      if (Math.abs(x) > 2) {
        const beam = new THREE.SpotLight(0xffedd1, 110, 70, .32, .7, 1.2); beam.position.set(x, 1.7, -6.8); beam.target.position.set(x, 0, -48); this.vehicle.add(beam, beam.target);
      }
    }
    for (const side of [-1, 1]) {
      for (const z of [-4.3, 4.6]) {
        const steering = new THREE.Group(); const spin = new THREE.Group(); steering.position.set(side * 2.58, 1, z); steering.add(spin); this.vehicle.add(steering);
        this.wheels.push({ steering, spin, front: z < 0 });
        const tire = this.cylinder(0, 0, 0, 1.02, .48, rubber, spin); tire.rotation.z = Math.PI / 2;
        const hub = this.cylinder(side * .26, 0, 0, .65, .06, chrome, spin); hub.rotation.z = Math.PI / 2;
        const cap = this.cylinder(side * .3, 0, 0, .28, .08, paint, spin); cap.rotation.z = Math.PI / 2;
        for (let i = 0; i < 8; i++) { const a = i * Math.PI / 4; this.box(side * .3, Math.sin(a) * .47, Math.cos(a) * .47, .025, .07, .07, black, spin); }
      }
      this.box(side * 2.64, 1.12, .2, .12, .18, 7.5, chrome, car);
      this.box(side * 2.56, 2.02, -1.72, .17, 1.18, 3.45, paint, car, .035);
      this.box(side * 2.51, 2.63, -1.72, .2, .1, 3.45, chrome, car);
      this.box(side * 2.48, 3.24, -1.55, .035, 1.13, 3.1, glass, car);
      this.box(side * 2.33, 4.23, .15, .13, .13, 6.2, chrome, car);
      this.box(side * 2.48, 3.39, -.1, .15, 1.62, .14, chrome, car);
      this.box(side * 2.5, 2.4, -.55, .12, .07, .47, chrome, car);
      if (side === -1) {
        this.leftDoor.position.set(-2.56, 0, 3.45); this.vehicle.add(this.leftDoor);
        this.box(0, 2.02, -1.7, .17, 1.18, 3.4, paint, this.leftDoor, .035);
        this.box(.11, 2.06, -1.7, .15, 1.01, 3.3, leather, this.leftDoor);
        this.box(0, 2.64, -1.7, .2, .1, 3.4, chrome, this.leftDoor);
        this.box(.23, 4.06, -1.7, .09, .1, 3.15, chrome, this.leftDoor);
        this.box(-.13, 2.42, -2.85, .12, .07, .47, chrome, this.leftDoor);
        this.window = this.box(.08, 3.28, -1.77, .035, 1.2, 3.15, glass, this.leftDoor);
      }
    }
    this.door.position.set(2.56, 0, 3.45); this.vehicle.add(this.door);
    this.box(0, 2.02, -1.7, .17, 1.18, 3.4, paint, this.door, .035);
    this.box(-.11, 2.06, -1.7, .15, 1.01, 3.3, leather, this.door);
    this.box(0, 2.64, -1.7, .2, .1, 3.4, chrome, this.door);
    this.box(-.08, 3.28, -1.7, .035, 1.2, 3.15, glass, this.door);
    this.box(-.23, 4.06, -1.7, .09, .1, 3.15, chrome, this.door);
    this.box(.13, 2.42, -2.85, .12, .07, .47, chrome, this.door);
    this.box(-.28, 2, -1.5, .25, .16, 1.2, black, this.door, .05);
    this.box(0, 4.28, .1, 4.65, .16, 5.95, paint, car, .12);
    this.box(0, 4.12, .1, 4.42, .09, 5.8, leather, car);
    for (const z of [-3.1, 3.25]) {
      const windshield = this.box(0, 3.28, z, 4.67, 1.55, .04, glass, car); windshield.rotation.x = z < 0 ? -.38 : .38;
      for (const side of [-1, 1]) { const pillar = this.box(side * 2.34, 3.29, z, .15, 1.75, .16, chrome, car); pillar.rotation.x = windshield.rotation.x; }
    }
    for (const z of [MEETING_CAR.front, MEETING_CAR.rear]) {
      this.box(0, 1.26, z - .25, 4.66, .43, 1.53, leather, car, .15);
      const back = this.box(0, 2.12, z + .58, 4.65, 1.54, .4, leather, car, .11); back.rotation.x = -.09;
      for (let x = -2.1; x < 2.2; x += .28) {
        this.box(x, 1.49, z - .25, .016, .022, 1.24, black, car);
        this.box(x, 2.18, z + .355, .016, 1.1, .027, black, car);
      }
    }
    this.box(0, 2.4, -3.7, 4.62, .66, .67, leather, car, .1);
    this.box(-1.15, 2.51, -3.33, 1.63, .37, .04, chrome, car);
    for (const x of [-1.7, -1.22, -.74]) { const dial = this.cylinder(x, 2.53, -3.29, .16, .03, black, car); dial.rotation.x = Math.PI / 2; }
    this.steering.position.set(-1.28, 2.46, -2.8); this.steering.rotation.x = -.32; this.vehicle.add(this.steering);
    this.mesh(this.steering, new THREE.TorusGeometry(.55, .035, 8, 40), black);
    for (let i = 0; i < 3; i++) { const spoke = this.box(0, 0, 0, .05, 1.05, .04, chrome, this.steering); spoke.rotation.z = i * Math.PI / 3; }
    for (const x of [-1.55, .5]) {
      const wiper = new THREE.Group(); wiper.position.set(x, 2.66, -3.34); wiper.rotation.x = -.38; this.vehicle.add(wiper); this.wipers.push(wiper);
      this.box(0, .48, 0, .035, .96, .03, black, wiper); this.box(0, .95, 0, .06, .48, .035, rubber, wiper);
    }
    this.box(0, 3.9, -2.82, .63, .21, .1, chrome, car, .025);
    this.box(0, 3.89, -2.74, .52, .15, .012, black, car);
    this.box(0, 4.055, .1, .48, .08, .7, black, car, .03);
    this.box(0, 4.005, .1, .36, .028, .56, new THREE.MeshStandardMaterial({ color: 0xa2ae88, emissive: 0x88976a, emissiveIntensity: .14, roughness: .65 }), car, .02);
    const cabin = new THREE.PointLight(0xbed3b6, 6, 7, 2); cabin.position.set(0, 3.95, .2); this.vehicle.add(cabin);
    const windowFill = new THREE.PointLight(0xb9d2d1, 28, 12, 2); windowFill.position.set(4.8, 4, 2); this.vehicle.add(windowFill);
    const rain = new Float32Array(1500 * 6);
    for (let i = 0; i < 1500; i++) {
      this.rainBase.set([((i * 7.919) % 1) * 70 - 35, ((i * 5.317) % 1) * 28, ((i * 3.713) % 1) * 100 - 50], i * 3);
    }
    const geometry = new THREE.BufferGeometry(); geometry.setAttribute('position', new THREE.BufferAttribute(rain, 3)); this.geometries.add(geometry);
    const rainMaterial = new THREE.LineBasicMaterial({ color: 0xb1cfc8, transparent: true, opacity: .19, depthWrite: false }); this.materials.add(rainMaterial);
    this.rain = new THREE.LineSegments(geometry, rainMaterial); this.root.add(this.rain);
    for (let i = 0; i < 2; i++) { const light = new THREE.PointLight(0xe5d6ae, 180, 36, 2); this.root.add(light); this.lightPool.push(light); }
    this.batch(); this.batch(car);
  }
  private surfaceMaps(material: THREE.MeshStandardMaterial, id: string): void {
    let ready = 0;
    const maps: THREE.Texture[] = [];
    for (const kind of ['color', 'normal', 'roughness']) {
      const texture = new THREE.TextureLoader().load(`/assets/surfaces/${id}-${kind}.jpg`, () => {
        if (++ready !== 3 || this.disposed) return;
        [material.map, material.normalMap, material.roughnessMap] = maps; material.needsUpdate = true;
      });
      texture.wrapS = texture.wrapT = THREE.RepeatWrapping; texture.anisotropy = 8;
      if (kind === 'color') texture.colorSpace = THREE.SRGBColorSpace;
      maps.push(texture); this.textures.add(texture);
    }
  }
  private buildRunoff(): void {
    const uniforms = { ...THREE.UniformsLib.fog, time: { value: 0 }, car: { value: new THREE.Vector3() } };
    const material = new THREE.ShaderMaterial({ uniforms, transparent: true, depthWrite: false, side: THREE.DoubleSide, fog: true,
      vertexShader: `
        uniform float time;
        attribute float phase;
        attribute float fallHeight;
        varying vec2 vUv;
        varying vec3 vBridge;
        varying float vDistance;
        #include <common>
        #include <logdepthbuf_pars_vertex>
        #include <fog_pars_vertex>
        void main() {
          vUv = uv;
          vec4 local = instanceMatrix * vec4(position, 1.0);
          local.y -= mod(time * (15. + phase * 5.) + phase * fallHeight, fallHeight);
          vBridge = local.xyz;
          vec4 mvPosition = modelViewMatrix * local;
          vDistance = length(mvPosition.xyz);
          gl_Position = projectionMatrix * mvPosition;
          #include <logdepthbuf_vertex>
          #include <fog_vertex>
        }`,
      fragmentShader: `
        uniform vec3 car;
        varying vec2 vUv;
        varying vec3 vBridge;
        varying float vDistance;
        #include <logdepthbuf_pars_fragment>
        #include <fog_pars_fragment>
        void main() {
          #include <logdepthbuf_fragment>
          vec2 offset = vBridge.xz - car.xy;
          vec2 cabin = mat2(cos(car.z), sin(car.z), -sin(car.z), cos(car.z)) * offset;
          if (abs(cabin.x) < 3. && abs(cabin.y) < 7. && vBridge.y < 4.6) discard;
          float alpha = pow(max(0., 1. - abs(vUv.x * 2. - 1.)), 1.5) * sin(vUv.y * 3.14159) * .3 * smoothstep(2., 10., vDistance);
          gl_FragColor = vec4(.64, .82, .8, alpha);
          #include <tonemapping_fragment>
          #include <colorspace_fragment>
          #include <fog_fragment>
        }`,
    });
    const geometry = new THREE.PlaneGeometry(.045, .85); const phases: number[] = []; const heights: number[] = [];
    this.geometries.add(geometry); this.materials.add(material);
    this.runoff = new THREE.InstancedMesh(geometry, material, 1200); this.runoff.name = 'meeting-bridge-runoff';
    const matrix = new THREE.Matrix4();
    const random = (seed: number) => { const value = Math.sin(seed * 12.9898 + 78.233) * 43758.5453; return value - Math.floor(value); };
    for (let i = 0; i < 1200; i++) {
      const x = ((i % 600 + .5) / 600) * 41.4 - 20.7; const height = 5.7 + Math.sqrt(1 - (x / 21.2) ** 2) * 7.8;
      matrix.makeScale(.65 + random(i + 1200), .6 + random(i + 2400) * .8, 1);
      matrix.setPosition(x, height, (i < 600 ? -25.8 : -2.2) + random(i + 3600) * .7);
      this.runoff.setMatrixAt(i, matrix); phases.push(random(i)); heights.push(height);
    }
    geometry.setAttribute('phase', new THREE.InstancedBufferAttribute(new Float32Array(phases), 1));
    geometry.setAttribute('fallHeight', new THREE.InstancedBufferAttribute(new Float32Array(heights), 1));
    this.runoff.frustumCulled = false; this.root.add(this.runoff);
    const sprayMaterial = new THREE.ShaderMaterial({ uniforms: { ...THREE.UniformsLib.fog, time: { value: 0 } }, transparent: true, depthWrite: false, side: THREE.DoubleSide, fog: true,
      vertexShader: `
        varying vec2 vUv;
        #include <common>
        #include <logdepthbuf_pars_vertex>
        #include <fog_pars_vertex>
        void main() {
          vUv = uv; vec4 mvPosition = modelViewMatrix * vec4(position, 1.0); gl_Position = projectionMatrix * mvPosition;
          #include <logdepthbuf_vertex>
          #include <fog_vertex>
        }`,
      fragmentShader: `
        uniform float time;
        varying vec2 vUv;
        #include <logdepthbuf_pars_fragment>
        #include <fog_pars_fragment>
        void main() {
          #include <logdepthbuf_fragment>
          float drift = .65 + .2 * sin(vUv.x * 80. + time * 1.8) * sin(vUv.x * 37. - time);
          float alpha = sin(vUv.x * 3.14159) * pow(1. - vUv.y, 3.) * smoothstep(0., .1, vUv.y) * drift * .23;
          gl_FragColor = vec4(.54, .71, .69, alpha);
          #include <tonemapping_fragment>
          #include <colorspace_fragment>
          #include <fog_fragment>
        }`,
    });
    const planes = [-25.65, -1.85].map(z => new THREE.PlaneGeometry(42, 2.2).translate(0, 1.12, z));
    const sprayGeometry = mergeGeometries(planes)!; planes.forEach(plane => plane.dispose());
    this.spray = this.mesh(this.root, sprayGeometry, sprayMaterial) as THREE.Mesh<THREE.BufferGeometry, THREE.ShaderMaterial>;
    this.spray.name = 'meeting-bridge-spray'; this.spray.castShadow = false; this.spray.receiveShadow = false;
  }
  private buildPuddles(): void {
    this.reflection = new Reflector(new THREE.PlaneGeometry(MEETING_ROAD_WIDTH, 132), {
      color: 0xaebcb8, textureWidth: 512, textureHeight: 512, multisample: 0, clipBias: .004,
      shader: {
        name: 'Meeting road water',
        uniforms: { ...THREE.UniformsLib.fog, color: { value: null }, tDiffuse: { value: null }, textureMatrix: { value: null }, time: { value: 0 } },
        vertexShader: `
          uniform mat4 textureMatrix;
          varying vec4 vReflection;
          varying vec2 vRoad;
          varying vec3 vEye;
          #include <common>
          #include <logdepthbuf_pars_vertex>
          #include <fog_pars_vertex>
          void main() {
            vReflection = textureMatrix * vec4(position, 1.0);
            vRoad = position.xy;
            vEye = cameraPosition - (modelMatrix * vec4(position, 1.0)).xyz;
            vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
            gl_Position = projectionMatrix * mvPosition;
            #include <logdepthbuf_vertex>
            #include <fog_vertex>
          }`,
        fragmentShader: `
          uniform vec3 color;
          uniform sampler2D tDiffuse;
          uniform float time;
          varying vec4 vReflection;
          varying vec2 vRoad;
          varying vec3 vEye;
          #include <logdepthbuf_pars_fragment>
          #include <fog_pars_fragment>
          float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
          float noise(vec2 p) {
            vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
            return mix(mix(hash(i), hash(i + vec2(1., 0.)), f.x), mix(hash(i + vec2(0., 1.)), hash(i + 1.), f.x), f.y);
          }
          void main() {
            #include <logdepthbuf_fragment>
            float edge = smoothstep(0., 1.1, 14. - abs(vRoad.x)) * smoothstep(0., 9., 66. - abs(vRoad.y));
            float pools = smoothstep(.36, .7, noise(vRoad * vec2(.43, .17)) + .12 * noise(vRoad * 2.3));
            float grazing = pow(1. - abs(normalize(vEye).y), 2.);
            float alpha = edge * mix(.025, .72, pools) * mix(.28, 1., grazing);
            if (alpha < .008) discard;
            vec4 uv = vReflection;
            vec2 ripple = vec2(noise(vRoad * 3.7), sin(vRoad.y * 28. + time * 3.)) * .0008;
            uv.xy += (ripple - .0004) * uv.w;
            vec3 reflected = texture2DProj(tDiffuse, uv).rgb * .5;
            reflected += texture2DProj(tDiffuse, uv + vec4(.0012 * uv.w, 0., 0., 0.)).rgb * .25;
            reflected += texture2DProj(tDiffuse, uv - vec4(.0012 * uv.w, 0., 0., 0.)).rgb * .25;
            gl_FragColor = vec4(reflected * color, alpha);
            #include <tonemapping_fragment>
            #include <colorspace_fragment>
            #include <fog_fragment>
          }`,
      },
    });
    this.reflection.name = 'meeting-road-puddles';
    const water = this.reflection.material as THREE.ShaderMaterial;
    water.transparent = true; water.depthWrite = false; water.fog = true;
    this.reflection.rotation.x = -Math.PI / 2; this.reflection.position.set(0, -.005, -15); this.root.add(this.reflection);
  }
  private buildStreet(road: THREE.Material, pavement: THREE.Material, stone: THREE.MeshStandardMaterial, dark: THREE.Material, metal: THREE.Material, glow: THREE.Material): void {
    const samples = MEETING_ROAD_SAMPLES;
    const strip = (from: number, to: number, y: number, material: THREE.Material) => {
      const vertices: number[] = []; const uv: number[] = []; const indices: number[] = []; let distance = 0;
      samples.forEach((p, i) => {
        if (i) distance += Math.hypot(p.x - samples[i - 1].x, p.z - samples[i - 1].z);
        for (const offset of [from, to]) { vertices.push(p.x + Math.cos(p.yaw) * offset, y, p.z - Math.sin(p.yaw) * offset); uv.push(offset / 8, distance / 8); }
        if (i) { const n = i * 2; indices.push(n - 2, n - 1, n, n - 1, n + 1, n); }
      });
      const geometry = new THREE.BufferGeometry(); geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3)); geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); geometry.setIndex(indices); geometry.computeVertexNormals(); this.mesh(this.static, geometry, material);
    };
    strip(-MEETING_ROAD_WIDTH / 2, MEETING_ROAD_WIDTH / 2, -.01, road);
    for (const side of [-1, 1]) { strip(side < 0 ? -22 : 14, side < 0 ? -14 : 22, .05, pavement); strip(side < 0 ? -14.3 : 14, side < 0 ? -14 : 14.3, .13, stone); }
    const line = new THREE.MeshStandardMaterial({ color: 0x92957d, roughness: .55 });
    const wallMaterials = [0x59605b, 0x65615a, 0x434e49].map(color => { const material = stone.clone(); material.color.setHex(color); return material; });
    const window = new THREE.MeshStandardMaterial({ color: 0x101d1c, roughness: .22, metalness: .5 });
    const warmWindow = new THREE.MeshStandardMaterial({ color: 0x7e7961, emissive: 0x50492a, emissiveIntensity: .35, roughness: .45 });
    const building = (x: number, z: number, yaw: number, seed: number) => {
      const group = new THREE.Group(); group.position.set(x, 0, z); group.rotation.y = yaw; this.static.add(group);
      const width = 25; const depth = 18; const height = 25 + seed % 4 * 7;
      const wall = wallMaterials[seed % wallMaterials.length];
      this.box(0, height / 2, 0, width, height, depth, wall, group);
      for (let y = 8; y < height; y += 7) {
        this.box(0, y, depth / 2 + .2, width + .7, .35, .8, stone, group);
        for (let col = 0; col < 4; col++) {
          const xx = -width / 2 + 3.4 + col * 6;
          this.box(xx, y + 3.1, depth / 2 + .04, 3.5, 4.5, .07, (seed + col + y) % 3 ? window : warmWindow, group);
          for (const side of [-1, 1]) this.box(xx + side * 1.83, y + 3.1, depth / 2 + .14, .22, 4.8, .3, stone, group);
          this.box(xx, y + 3.1, depth / 2 + .14, .1, 4.5, .15, metal, group);
          this.box(xx, y + 2.8, depth / 2 + .14, 3.5, .14, .15, metal, group);
          this.box(xx, y + .7, depth / 2 + .35, 4.1, .3, .9, stone, group);
        }
      }
      for (const y of [height - .4, height + .3]) this.box(0, y, 0, width + 1.1, .45, depth + 1.1, stone, group);
      for (const side of [-1, 1]) {
        this.box(side * (width / 2 - 1), height / 2, depth / 2 + .24, .6, height, .5, stone, group);
        this.box(side * 6.5, 3.4, depth / 2 + .05, 7.4, 6.4, .15, dark, group);
        for (let y = .7; y < 6; y += .35) this.box(side * 6.5, y, depth / 2 + .2, 7, .07, .09, metal, group);
      }
      this.box(0, 3.5, depth / 2 + .08, 4.4, 7, .2, dark, group);
      for (const side of [-1, 1]) this.box(side * 2.4, 4, depth / 2 + .35, .45, 8, .6, stone, group);
      this.box(0, 7.8, depth / 2 + .6, 6, .6, 1.6, stone, group);
      this.box(1.5, 3.3, depth / 2 + .28, .09, .8, .09, metal, group);
      if (seed % 3 === 0) {
        for (let y = 8; y < height - 3; y += 7) {
          this.box(-7, y, depth / 2 + 1.2, 8, .13, 2.8, metal, group);
          for (let col = 0; col < 9; col++) this.box(-10.7 + col * .92, y + 1.25, depth / 2 + 2.5, .055, 2.5, .055, metal, group);
          this.box(-7, y + 2.5, depth / 2 + 2.5, 8, .08, .08, metal, group);
        }
      }
    };
    let lastMark = -20; let lastBuilding = 30; let lastLamp = 0; let distance = 0; let seed = 0;
    for (let i = 1; i < samples.length; i++) {
      const p = samples[i]; distance += Math.hypot(p.x - samples[i - 1].x, p.z - samples[i - 1].z);
      if (distance - lastMark > 10) { const mark = this.box(p.x - Math.cos(p.yaw) * 7, .018, p.z + Math.sin(p.yaw) * 7, .15, .02, 4, line); mark.rotation.y = p.yaw; lastMark = distance; }
      if (distance - lastLamp > 55 && distance > 100) {
        for (const side of [-1, 1]) {
          const x = p.x + Math.cos(p.yaw) * side * 18; const z = p.z - Math.sin(p.yaw) * side * 18;
          this.cylinder(x, 6.5, z, .1, 13, metal); this.box(x, 13, z, .9, .2, .9, dark); this.box(x, 12.85, z, .7, .08, .7, glow);
          this.streetLamps.push(new THREE.Vector3(x, 12.4, z));
        }
        lastLamp = distance;
      }
      if (distance - lastBuilding > 37 && distance > 130 && Math.abs(p.yaw % (Math.PI / 2)) < .05) {
        for (const side of [-1, 1]) {
          const x = p.x + Math.cos(p.yaw) * side * 33; const z = p.z - Math.sin(p.yaw) * side * 33;
          if (Math.abs(x - MEETING_DESTINATION.x) < 55 && Math.abs(z) < 60) continue;
          building(x, z, p.yaw - side * Math.PI / 2, seed++);
        }
        lastBuilding = distance;
      }
    }
    building(MEETING_DESTINATION.x, 65, Math.PI, 2);
  }
  private mesh(parent: THREE.Object3D, geometry: THREE.BufferGeometry, material: THREE.Material): THREE.Mesh {
    this.geometries.add(geometry); this.materials.add(material); const mesh = new THREE.Mesh(geometry, material); mesh.castShadow = mesh.receiveShadow = true; parent.add(mesh); return mesh;
  }
  private box(x: number, y: number, z: number, w: number, h: number, d: number, material: THREE.Material, parent: THREE.Object3D = this.static, radius = 0): THREE.Mesh {
    const mesh = this.mesh(parent, radius ? new RoundedBoxGeometry(w, h, d, 2, radius) : new THREE.BoxGeometry(w, h, d), material); mesh.position.set(x, y, z); return mesh;
  }
  private cylinder(x: number, y: number, z: number, radius: number, height: number, material: THREE.Material, parent: THREE.Object3D = this.static): THREE.Mesh {
    const mesh = this.mesh(parent, new THREE.CylinderGeometry(radius, radius, height, 32), material); mesh.position.set(x, y, z); return mesh;
  }
  private batch(root = this.static): void {
    root.updateWorldMatrix(true, true); const inverse = root.matrixWorld.clone().invert(); const batches = new Map<THREE.Material, THREE.BufferGeometry[]>();
    root.traverse(object => { if (object instanceof THREE.Mesh) {
      const geometry = (object.geometry.index ? object.geometry.toNonIndexed() : object.geometry.clone()).applyMatrix4(inverse.clone().multiply(object.matrixWorld));
      const material = object.material as THREE.Material; const list = batches.get(material) ?? []; list.push(geometry); batches.set(material, list);
    } });
    root.clear();
    for (const [material, geometries] of batches) { const geometry = mergeGeometries(geometries); geometries.forEach(g => g.dispose()); if (geometry) this.mesh(root, geometry, material); }
  }
  update(journey: FilmJourney | undefined, elapsed: number, occupant?: MeetingGesture): void {
    const encounter = journey?.visiting ? undefined : occupant ?? journey?.meeting;
    const pose = encounter && meetingPose({ ...encounter, role: 'neo' });
    const car = journey?.scene === 'm1_bridge' && !journey.visiting && !encounter && journey.bridgeArrival
      ? journey.bridgeArrival.parkedRoadTime === undefined ? bridgeArrivalPose(journey.bridgeArrival.elapsed)
        : meetingCarPose({ phase: 'ready', elapsed: 0, roadTime: journey.bridgeArrival.parkedRoadTime }) : meetingCarPose(encounter);
    this.vehicle.position.set(car.x, 0, car.z); this.vehicle.rotation.y = car.yaw;
    for (const wheel of this.wheels) { wheel.steering.rotation.y = wheel.front ? car.steering : 0; wheel.spin.rotation.x = -car.distance / 1.02; }
    this.steering.rotation.z = car.steering * 1.6;
    for (const wiper of this.wipers) wiper.rotation.z = -.45 + Math.sin((encounter?.phase === 'driving' ? encounter.elapsed : elapsed) * 4) * .75;
    this.door.rotation.y = -(pose?.door ?? 0) * 1.05;
    this.leftDoor.rotation.y = encounter?.phase === 'exiting' ? (pose?.door ?? 0) * 1.05 : 0;
    this.hotel?.update(journey?.hotel, 0, true);
    this.window.position.y = 3.28 - (encounter?.phase === 'discarding' ? Math.min(1, encounter.elapsed) : 0) * 1.05;
    this.reflection.visible = Math.hypot(car.x, car.z + 15) < 135;
    (this.reflection.material as THREE.ShaderMaterial).uniforms.time.value = elapsed;
    this.runoff.visible = this.spray.visible = this.reflection.visible;
    this.runoff.material.uniforms.time.value = this.spray.material.uniforms.time.value = elapsed;
    this.runoff.material.uniforms.car.value.set(car.x, car.z, car.yaw);
    const positions = this.rain.geometry.attributes.position as THREE.BufferAttribute;
    const cos = Math.cos(car.yaw); const sin = Math.sin(car.yaw);
    for (let i = 0; i < 1500; i++) {
      const x = this.rainBase[i * 3] + car.x; const z = this.rainBase[i * 3 + 2] + car.z;
      let y = (this.rainBase[i * 3 + 1] - elapsed * 13 % 28 + 28) % 28;
      const localX = cos * (x - car.x) - sin * (z - car.z); const localZ = sin * (x - car.x) + cos * (z - car.z);
      if (Math.abs(x) < 25 && z > -27 && z < -1 || Math.abs(localX) < 3 && Math.abs(localZ) < 7 && y < 5 || x > MEETING_DESTINATION.x - 23 && x < MEETING_DESTINATION.x + 49 && z > -27 && z < 28) y = -100;
      positions.setXYZ(i * 2, x, y, z); positions.setXYZ(i * 2 + 1, x + .07, y - .85, z + .1);
    }
    positions.needsUpdate = true; this.rain.frustumCulled = false;
    const closest = [...this.streetLamps].sort((a, b) => Math.hypot(a.x - car.x, a.z - car.z) - Math.hypot(b.x - car.x, b.z - car.z));
    this.lightPool.forEach((light, i) => { if (closest[i]) { light.position.copy(closest[i]); light.intensity = 180 * Math.max(0, 1 - Math.hypot(closest[i].x - car.x, closest[i].z - car.z) / 55); } });
  }
  dispose(): void {
    this.disposed = true;
    this.hotel?.dispose();
    this.runoff.dispose();
    this.reflection.dispose(); this.reflection.geometry.dispose();
    this.root.traverse(object => { if (object instanceof THREE.Light) object.dispose(); });
    this.geometries.forEach(g => g.dispose()); this.materials.forEach(m => m.dispose()); this.textures.forEach(t => t.dispose()); this.root.removeFromParent();
  }
}
