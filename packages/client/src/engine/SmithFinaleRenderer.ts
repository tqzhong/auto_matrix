import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { Reflector } from 'three/addons/objects/Reflector.js';
import { SmithCrowdRenderer } from './SmithCrowdRenderer.js';
import { SMITH_FINALE, newSmithFinale, smithFinalePose, type SmithFinaleEncounter } from '@auto_matrix/shared';

/** Procedural production sample for the Revolutions rain duel.
 * Character rigs remain owned by AgentRenderer; this class owns the avenue,
 * Smith audience, destruction and connection effects around them. */
export class SmithFinaleRenderer {
  readonly group = new THREE.Group();
  private audience?: SmithCrowdRenderer;
  private avenue = new THREE.Group();
  private water?: Reflector;
  private weatherTime = { value: 0 };
  private textures = new Set<THREE.Texture>();
  private rain = new THREE.Group();
  private lightning = new THREE.Group();
  private shockwave = new THREE.Group();
  private trails = new THREE.Group();
  private breach = new THREE.Group();
  private crater = new THREE.Group();
  private assimilation = new THREE.Group();
  private purge = new THREE.Group();
  private geometries = new Set<THREE.BufferGeometry>();
  private materials = new Set<THREE.Material>();
  private lights: THREE.Light[] = [];
  private shockShell!: THREE.LineSegments;
  private flightSpray!: THREE.LineSegments;
  private purgeShell!: THREE.Mesh;
  private assimilationShell!: THREE.Mesh;
  private puddles!: THREE.InstancedMesh;
  private rippleMatrix = new THREE.Object3D();
  private debris: THREE.Mesh[] = [];

  constructor(root: THREE.Group) {
    this.group.name = 'smith-finale-avenue'; this.rain.name = 'smith-finale-rain';
    this.lightning.name = 'smith-finale-lightning'; this.shockwave.name = 'smith-finale-shockwave';
    this.trails.name = 'smith-finale-air-trails'; this.breach.name = 'smith-finale-building-breach';
    this.crater.name = 'smith-finale-crater'; this.assimilation.name = 'smith-finale-assimilation'; this.purge.name = 'smith-finale-purge';
    root.add(this.group); this.group.add(this.rain, this.lightning, this.shockwave, this.trails,
      this.breach, this.crater, this.assimilation, this.purge);
    this.buildAvenue();
    if (typeof window !== 'undefined') this.audience = new SmithCrowdRenderer(this.group);
    else { const crowd = new THREE.Group(); crowd.name = 'smith-finale-crowd'; this.group.add(crowd); }
    this.buildWeather(); this.buildDestruction(); this.buildConnection();
    this.update(undefined, false, { x: 0, z: 30 });
  }

  private material(parameters: THREE.MeshStandardMaterialParameters): THREE.MeshStandardMaterial {
    const material = new THREE.MeshStandardMaterial(parameters); this.materials.add(material); return material;
  }

  private basic(parameters: THREE.MeshBasicMaterialParameters): THREE.MeshBasicMaterial {
    const material = new THREE.MeshBasicMaterial(parameters); this.materials.add(material); return material;
  }

  private geometry<T extends THREE.BufferGeometry>(geometry: T): T { this.geometries.add(geometry); return geometry; }

  private mesh(geometry: THREE.BufferGeometry, material: THREE.Material, parent: THREE.Object3D,
    x = 0, y = 0, z = 0, name?: string): THREE.Mesh {
    const mesh = new THREE.Mesh(this.geometry(geometry), material); mesh.position.set(x, y, z); if (name) mesh.name = name;
    mesh.castShadow = true; mesh.receiveShadow = true; parent.add(mesh); return mesh;
  }

  private buildAvenue(): void {
    this.avenue.name = 'smith-finale-facades'; this.group.add(this.avenue);
    const grain = new Uint8Array(128 * 128 * 4);
    for (let y = 0; y < 128; y++) for (let x = 0; x < 128; x++) {
      const shade = 115 + Math.sin(x * 2.41 + y * 5.17) * 23 + Math.sin(x * .3 - y * .7) * 12;
      const i = (y * 128 + x) * 4; grain[i] = grain[i + 1] = grain[i + 2] = shade; grain[i + 3] = 255;
    }
    const surface = new THREE.DataTexture(grain, 128, 128); surface.wrapS = surface.wrapT = THREE.RepeatWrapping;
    surface.repeat.set(16, 50); surface.needsUpdate = true; this.textures.add(surface);
    const wet = this.material({ color: 0x323c3c, metalness: .16, roughness: .21, bumpMap: surface, bumpScale: .035, envMapIntensity: 1.4 });
    const curb = this.material({ color: 0x686e68, roughness: .65 });
    const stone = this.material({ color: 0x575e59, metalness: .05, roughness: .82 });
    const sandstone = this.material({ color: 0x737568, roughness: .86 });
    const dark = this.material({ color: 0x18211e, metalness: .48, roughness: .36 });
    const glass = this.material({ color: 0x182725, metalness: .68, roughness: .2 });
    const lit = this.material({ color: 0x7d9080, emissive: 0x718571, emissiveIntensity: .32, roughness: .45 });
    const road = this.mesh(new THREE.PlaneGeometry(42, 190), wet, this.group, 0, .025, 0, 'smith-finale-flooded-road');
    road.rotation.x = -Math.PI / 2;
    // A single low-resolution reflected pass gives the water real silhouettes.
    // The irregular translucent surface leaves the asphalt visible beneath it.
    this.water = new Reflector(this.geometry(new THREE.PlaneGeometry(41.9, 189.9)), {
      color: 0x8a9a91, textureWidth: 512, textureHeight: 512, multisample: 0, clipBias: .003,
    });
    const waterMaterial = this.water.material as THREE.ShaderMaterial;
    waterMaterial.vertexShader = waterMaterial.vertexShader.replace('varying vec4 vUv;', 'varying vec4 vUv; varying vec2 streetUv;')
      .replace('vUv = textureMatrix', 'streetUv = uv; vUv = textureMatrix');
    waterMaterial.fragmentShader = waterMaterial.fragmentShader.replace('varying vec4 vUv;', 'varying vec4 vUv; varying vec2 streetUv; uniform float weatherTime;')
      .replace('vec4 base = texture2DProj( tDiffuse, vUv );', `
        vec4 reflected = vUv;
        reflected.x += sin(streetUv.y * 1700.0 + weatherTime * 3.0) * .00055 * reflected.w;
        reflected.y += sin(streetUv.x * 910.0 - weatherTime * 2.0) * .00025 * reflected.w;
        vec4 base = texture2DProj(tDiffuse, reflected);`)
      .replace('gl_FragColor = vec4( blendOverlay( base.rgb, color ), 1.0 );',
        'gl_FragColor = vec4(blendOverlay(base.rgb, color), .38 + .18 * sin(streetUv.x * 57.0 + sin(streetUv.y * 71.0)));');
    this.water.name = 'smith-finale-reflected-water'; this.water.rotation.x = -Math.PI / 2; this.water.position.y = .035;
    waterMaterial.transparent = true; waterMaterial.depthWrite = false; waterMaterial.uniforms.weatherTime = this.weatherTime;
    this.group.add(this.water);
    const box = (w: number, h: number, d: number, mat: THREE.Material, x: number, y: number, z: number, name: string) =>
      this.mesh(new THREE.BoxGeometry(w, h, d), mat, this.avenue, x, y, z, name);
    for (const side of [-1, 1]) {
      box(12, .32, 190, curb, side * 27, .13, 0, 'smith-finale-sidewalk');
      for (let segment = 0; segment < 12; segment++) {
        const z = -82.5 + segment * 15, height = 33 + segment % 4 * 6;
        const wall = segment % 3 ? stone : sandstone;
        box(13.5, height, 14.6, wall, side * 32.5, height / 2, z, 'smith-finale-building');
        // Deep reveals, mullions, stone sills and uneven dark windows.
        for (let floor = 7.8; floor < height - 2; floor += 3.5) for (let column = 0; column < 4; column++) {
          const wz = z - 5.4 + column * 3.6;
          box(.12, 2.1, 1.65, ((column + segment + Math.floor(floor)) % 7 === 0) ? lit : glass,
            side * 25.68, floor, wz, 'smith-finale-window');
          for (const edge of [-1, 1]) box(.32, 2.35, .14, dark, side * 25.55, floor, wz + edge * .88, 'smith-finale-window-reveal');
          box(.45, .16, 2.1, curb, side * 25.48, floor - 1.16, wz, 'smith-finale-window-sill');
          box(.16, 2.1, .075, dark, side * 25.5, floor, wz, 'smith-finale-window-mullion');
        }
        for (const level of [5.8, height - .6, height + .1]) box(.7, .35, 14.8, curb, side * 25.45, level, z, 'smith-finale-cornice');
        for (const edge of [-1, 1]) box(.52, height, .7, wall, side * 25.4, height / 2, z + edge * 7.05, 'smith-finale-pilaster');
        for (let bay = 0; bay < 3; bay++) {
          const bz = z - 4.7 + bay * 4.7;
          box(.16, 4.6, 4.0, glass, side * 25.62, 2.7, bz, 'smith-finale-storefront');
          box(.6, .45, 4.5, dark, side * 25.3, 5.05, bz, 'smith-finale-store-transom');
          box(.5, 4.7, .22, curb, side * 25.42, 2.7, bz - 2.1, 'smith-finale-store-column');
          box(.3, 4.5, .1, dark, side * 25.35, 2.7, bz, 'smith-finale-store-door');
          box(.28, .08, .45, curb, side * 25.26, 2.35, bz + .42, 'smith-finale-door-handle');
        }
      }
      // Smaller remote towers extend the street canyon beyond the playable set.
      for (let i = 0; i < 5; i++) box(17, 56 + i * 7, 17, stone, side * (31 + i % 2 * 7), 28 + i * 3.5, -110 - i * 21, 'smith-finale-distant-tower');
      for (let z = -90; z < 96; z += 4) box(4.6, .014, .055, dark, side * 23.4, .298, z, 'smith-finale-paving-joint');
    }
    const stripe = this.material({ color: 0xb1ad86, transparent: true, opacity: .62, roughness: .4 });
    for (const x of [-.22, .22, -16.8, 16.8]) for (let z = -90; z < 94; z += 10)
      box(.12, .012, x * x < 1 ? 9.9 : 4.8, stripe, x, .051, z, 'smith-finale-road-stripe');
    const ripple = this.basic({ color: 0x93a8a0, transparent: true, opacity: .17, side: THREE.DoubleSide, depthWrite: false });
    const ringGeometry = this.geometry(new THREE.RingGeometry(.18, .195, 16));
    this.puddles = new THREE.InstancedMesh(ringGeometry, ripple, 120); this.puddles.name = 'smith-finale-puddle-ripples';
    this.puddles.instanceMatrix.setUsage(THREE.DynamicDrawUsage); this.group.add(this.puddles);
    const ambient = new THREE.HemisphereLight(0xbbc8b4, 0x152320, .85); this.group.add(ambient); this.lights.push(ambient);
    const backlight = new THREE.DirectionalLight(0xd4e0d0, 1.7); backlight.position.set(-18, 48, -65);
    backlight.target.position.set(0, 0, 8); this.group.add(backlight, backlight.target); this.lights.push(backlight);
    for (const side of [-1, 1]) for (let z = -72; z < 87; z += 30) {
      const x = side * 20.4;
      const lamp = new THREE.PointLight(0xc6d4b9, 220, 30, 2); lamp.position.set(x - side * 1.2, 9.3, z); this.group.add(lamp); this.lights.push(lamp);
      this.mesh(new THREE.CylinderGeometry(.07, .16, 9.4, 10), dark, this.avenue, x, 4.7, z, 'smith-finale-lamp-post');
      box(1.6, .12, .14, dark, x - side * .65, 9.35, z, 'smith-finale-lamp-arm');
      box(.9, .12, .46, lit, x - side * 1.2, 9.25, z, 'smith-finale-lamp-head');
    }
    this.batchAvenue();
  }

  private batchAvenue(): void {
    this.avenue.updateMatrixWorld(true);
    const inverse = this.avenue.matrixWorld.clone().invert(), batches = new Map<THREE.Material, THREE.BufferGeometry[]>();
    this.avenue.traverse(object => {
      if (!(object instanceof THREE.Mesh)) return;
      const geometry = object.geometry.clone().applyMatrix4(inverse.clone().multiply(object.matrixWorld));
      const parts = batches.get(object.material as THREE.Material) ?? []; parts.push(geometry); batches.set(object.material as THREE.Material, parts);
    });
    this.avenue.clear();
    for (const [material, parts] of batches) {
      const geometry = mergeGeometries(parts); parts.forEach(part => part.dispose());
      if (!geometry) continue;
      const mesh = this.mesh(geometry, material, this.avenue, 0, 0, 0, 'smith-finale-static-facade'); mesh.castShadow = false;
    }
  }

  private buildWeather(): void {
    const rainMaterial = this.basic({ color: 0xa8c2ba, transparent: true, opacity: .4, depthWrite: false });
    const points: number[] = [], phases: number[] = [];
    for (let i = 0; i < 3200; i++) {
      const x = -34 + (i * 17.37) % 68; const y = (i * 11.23) % 48; const z = -74 + (i * 29.11) % 148;
      points.push(x, 48, z, x - .08, 48 - 1.2 - i % 4 * .28, z + .18); phases.push(y, y);
    }
    rainMaterial.onBeforeCompile = shader => {
      shader.uniforms.weatherTime = this.weatherTime;
      shader.vertexShader = shader.vertexShader.replace('#include <common>', '#include <common>\nuniform float weatherTime; attribute float rainPhase;')
        .replace('#include <begin_vertex>', '#include <begin_vertex>\ntransformed.y -= mod(weatherTime * 24.0 + rainPhase, 48.0);');
    };
    const geometry = this.geometry(new THREE.BufferGeometry()); geometry.setAttribute('position', new THREE.Float32BufferAttribute(points, 3));
    geometry.setAttribute('rainPhase', new THREE.Float32BufferAttribute(phases, 1));
    const streaks = new THREE.LineSegments(geometry, rainMaterial); streaks.name = 'smith-finale-rain-streaks'; this.rain.add(streaks);
    const lightningMaterial = this.basic({ color: 0xddeee9, transparent: true, opacity: .95, toneMapped: false });
    for (const side of [-1, 1]) {
      const vertices: number[] = []; let x = side * 19; let y = 42; let z = -54;
      for (let i = 0; i < 9; i++) { const nx = x + side * (i % 2 ? -2.8 : 1.7); const ny = y - 5; const nz = z + (i % 3 - 1) * 1.3; vertices.push(x, y, z, nx, ny, nz); x = nx; y = ny; z = nz; }
      const boltGeometry = this.geometry(new THREE.BufferGeometry()); boltGeometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
      const bolt = new THREE.LineSegments(boltGeometry, lightningMaterial); bolt.name = 'smith-finale-lightning-bolt'; this.lightning.add(bolt);
    }
    const flash = new THREE.PointLight(0xe2f2ef, 0, 150, 2); flash.position.set(0, 31, -35); this.lightning.add(flash); this.lights.push(flash);
  }

  private buildDestruction(): void {
    const pressure = new THREE.LineBasicMaterial({ color: 0xd9eee6, transparent: true, opacity: .36, depthWrite: false });
    this.materials.add(pressure);
    const droplets: number[] = [];
    for (let i = 0; i < 900; i++) {
      const y = 1 - 2 * (i + .5) / 900, radius = Math.sqrt(1 - y * y), angle = i * 2.399963;
      const point = new THREE.Vector3(Math.cos(angle) * radius, y, Math.sin(angle) * radius);
      droplets.push(...point.toArray(), ...point.multiplyScalar(.97).toArray());
    }
    const spray = this.geometry(new THREE.BufferGeometry()); spray.setAttribute('position', new THREE.Float32BufferAttribute(droplets, 3));
    this.shockShell = new THREE.LineSegments(spray, pressure); this.shockShell.name = 'smith-finale-pressure-sphere';
    this.shockShell.position.y = 3.2; this.shockwave.add(this.shockShell);
    const wash = this.basic({ color: 0xb8d0c6, transparent: true, opacity: .14, depthWrite: false, side: THREE.DoubleSide });
    for (let i = 0; i < 4; i++) {
      const ring = this.mesh(new THREE.RingGeometry(.96, 1.0, 64), wash, this.shockwave, 0, .09 + i * .016, 0, 'smith-finale-pressure-ring');
      ring.rotation.x = -Math.PI / 2; ring.scale.setScalar(1 + i * .08);
    }
    const trail = new THREE.LineBasicMaterial({ color: 0xc5ded5, transparent: true, opacity: .24, depthWrite: false });
    this.materials.add(trail);
    const trailGeometry = this.geometry(new THREE.BufferGeometry());
    trailGeometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(2 * 96 * 6), 3).setUsage(THREE.DynamicDrawUsage));
    this.flightSpray = new THREE.LineSegments(trailGeometry, trail); this.flightSpray.name = 'smith-finale-flight-spray';
    this.trails.add(this.flightSpray);
    const concrete = this.material({ color: 0x4b5553, metalness: .08, roughness: .9 });
    this.mesh(new THREE.BoxGeometry(2, 20, 24), concrete, this.breach, -26.5, 12, -27, 'smith-finale-breached-facade');
    for (let i = 0; i < 28; i++) {
      const chunk = this.mesh(new THREE.TetrahedronGeometry(.4 + i % 5 * .16), concrete, this.breach,
        -24 + (i % 7) * 1.2, 4 + Math.floor(i / 7) * 3.1, -33 + (i * 2.3) % 13, 'smith-finale-facade-debris');
      chunk.rotation.set(i * .37, i * .71, i * .19); this.debris.push(chunk);
    }
    const asphalt = this.material({ color: 0x101819, metalness: .16, roughness: .78 });
    const craterFloor = this.mesh(new THREE.CircleGeometry(10, 48), asphalt, this.crater, 0, -.18, -38, 'smith-finale-crater-floor'); craterFloor.rotation.x = -Math.PI / 2;
    for (let i = 0; i < 24; i++) {
      const angle = i / 24 * Math.PI * 2; const radius = 8.3 + i % 3 * 1.1;
      const chunk = this.mesh(new THREE.BoxGeometry(1.3 + i % 4 * .35, .55 + i % 3 * .25, 2.4), asphalt, this.crater,
        Math.sin(angle) * radius, .05 + i % 3 * .18, -38 + Math.cos(angle) * radius, 'smith-finale-crater-rubble');
      chunk.rotation.set((i % 3 - 1) * .25, angle, (i % 5 - 2) * .18); this.debris.push(chunk);
    }
    const pipe = this.material({ color: 0x626f6b, metalness: .82, roughness: .35 });
    for (const [x, z, angle] of [[-5.5, -41, .4], [4.8, -35, -.55], [-1.8, -31.5, .18]] as const) {
      const tube = this.mesh(new THREE.CylinderGeometry(.28, .34, 9, 10), pipe, this.crater, x, 1.2, z, 'smith-finale-broken-pipe');
      tube.rotation.set(Math.PI / 2 + angle, 0, angle);
    }
  }

  private buildConnection(): void {
    const black = this.basic({ color: 0x06100b, transparent: true, opacity: .72, wireframe: true, depthWrite: false });
    this.assimilationShell = this.mesh(new THREE.SphereGeometry(1.45, 18, 12), black, this.assimilation, 0, 1.85, -38, 'smith-finale-code-shell');
    for (let i = 0; i < 9; i++) {
      const ring = this.mesh(new THREE.TorusGeometry(.65 + i * .16, .025, 6, 36), black, this.assimilation, 0, .65 + i * .34, -38, 'smith-finale-code-ring');
      ring.rotation.x = Math.PI / 2; ring.rotation.z = i * .34;
    }
    const gold = this.basic({ color: 0xffbd55, transparent: true, opacity: .58, wireframe: true, depthWrite: false, toneMapped: false });
    this.purgeShell = this.mesh(new THREE.SphereGeometry(1, 24, 14), gold, this.purge, 0, 2.1, -38, 'smith-finale-gold-purge');
    for (let i = 0; i < 32; i++) {
      const angle = i / 32 * Math.PI * 2; const up = ((i * 7) % 13 - 6) / 8;
      const length = 8 + i % 5 * 2.2;
      const geometry = this.geometry(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0, 2.1, -38),
        new THREE.Vector3(Math.sin(angle) * length, 2.1 + up * length, -38 + Math.cos(angle) * length)]));
      const ray = new THREE.Line(geometry, gold); ray.name = 'smith-finale-purge-ray'; this.purge.add(ray);
    }
    const goldLight = new THREE.PointLight(0xffbd55, 0, 90, 2); goldLight.position.set(0, 3, -38); this.purge.add(goldLight); this.lights.push(goldLight);
  }

  update(encounter: SmithFinaleEncounter | undefined, firstPerson: boolean, player: { x: number; z: number }): void {
    const state = encounter ?? newSmithFinale(); const pose = smithFinalePose(state); const phase = state.phase;
    this.weatherTime.value = state.total; this.rain.visible = phase !== 'done';
    const flash = (Math.sin(state.total * 1.73 + 1.2) > .965 || ['shockwave', 'purging'].includes(phase));
    this.lightning.visible = flash && phase !== 'done';
    const flashLight = this.lightning.children.find(child => child instanceof THREE.PointLight) as THREE.PointLight | undefined;
    if (flashLight) flashLight.intensity = flash ? phase === 'purging' ? 1800 : 780 : 0;
    for (let index = 0; index < this.puddles.count; index++) {
      const scale = .5 + ((state.total * 2.2 + index * .37) % 1) * 2.4;
      this.rippleMatrix.position.set(-19 + (index * 7.7) % 38, .064, -88 + (index * 17.3) % 176);
      this.rippleMatrix.rotation.x = -Math.PI / 2; this.rippleMatrix.scale.setScalar(scale); this.rippleMatrix.updateMatrix();
      this.puddles.setMatrixAt(index, this.rippleMatrix.matrix);
    }
    this.puddles.instanceMatrix.needsUpdate = true; this.puddles.computeBoundingSphere();
    this.shockwave.visible = phase === 'shockwave' && state.elapsed >= .17;
    if (phase === 'shockwave') {
      this.shockwave.position.set((pose.neo.x + pose.smith.x) / 2, 0, (pose.neo.z + pose.smith.z) / 2);
      const progress = THREE.MathUtils.clamp((state.elapsed - .17) / (SMITH_FINALE.shockwave - .17), 0, 1);
      this.shockShell.scale.setScalar(2 + progress * 24); this.shockwave.rotation.y = state.elapsed * .7;
      (this.shockShell.material as THREE.LineBasicMaterial).opacity = .48 * (1 - progress);
      this.shockwave.children.forEach(child => { if (child instanceof THREE.Mesh) child.scale.setScalar(2 + progress * 29); });
    }
    this.trails.visible = pose.flight > 0;
    if (this.trails.visible) {
      const previous = smithFinalePose({ ...state, elapsed: Math.max(0, state.elapsed - .04), total: Math.max(0, state.total - .04) });
      const positions = this.flightSpray.geometry.getAttribute('position') as THREE.BufferAttribute;
      for (let body = 0; body < 2; body++) {
        const role = body === 0 ? 'neo' : 'smith', current = pose[role], before = previous[role];
        const velocity = new THREE.Vector3(current.x - before.x, current.y - before.y, current.z - before.z)
          .multiplyScalar(25).clampLength(0, 15);
        for (let i = 0; i < 96; i++) {
          const age = (state.total * 1.4 + i * .618 + body * .31) % 1, angle = i * 2.399963;
          const radius = .12 + age * .5, index = (body * 96 + i) * 2;
          const x = current.x - velocity.x * age * .22 + Math.cos(angle) * radius;
          const y = current.y + 1.7 - velocity.y * age * .22 + Math.sin(angle) * radius - age * age * .8;
          const z = current.z - velocity.z * age * .22 + Math.sin(angle * 1.3) * radius;
          positions.setXYZ(index, x, y, z);
          positions.setXYZ(index + 1, x - velocity.x * .015, y - velocity.y * .015 - .12, z - velocity.z * .015);
        }
      }
      positions.needsUpdate = true; this.flightSpray.geometry.computeBoundingSphere();
    }
    const destroyed = ['building', 'descent', 'crater', 'choice', 'rain_done', 'assault_ready', 'assault', 'vision', 'understanding', 'surrender', 'assimilating', 'purging', 'done'].includes(phase);
    this.breach.visible = destroyed; this.crater.visible = ['descent', 'crater', 'choice', 'rain_done', 'assault_ready', 'assault', 'vision', 'understanding', 'surrender', 'assimilating', 'purging', 'done'].includes(phase);

    this.assimilation.visible = ['assimilating', 'purging'].includes(phase);
    if (this.assimilation.visible) {
      const scale = phase === 'assimilating' ? .5 + smithFinalePose(state).assimilation * 1.35 : 1.85;
      this.assimilationShell.scale.setScalar(scale); this.assimilation.rotation.y = state.elapsed * 1.8;
    }
    this.purge.visible = phase === 'purging' || phase === 'done';
    if (this.purge.visible) {
      const amount = smithFinalePose(state).purge; this.purgeShell.scale.setScalar(.2 + amount * 18);
      (this.purge.children.find(child => child instanceof THREE.PointLight) as THREE.PointLight).intensity = 1200 * (1 - amount * .72);
      this.purge.rotation.y = state.elapsed * .6;
    }
    this.audience?.update(state, player);

  }

  dispose(): void {
    this.group.removeFromParent(); this.group.clear(); this.geometries.forEach(geometry => geometry.dispose());
    this.materials.forEach(material => material.dispose()); this.lights.forEach(light => light.dispose());
    this.textures.forEach(texture => texture.dispose()); this.water?.dispose();
    this.audience?.dispose(); this.puddles.dispose();
  }
}
