import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { Reflector } from 'three/addons/objects/Reflector.js';
import { SmithCrowdRenderer } from './SmithCrowdRenderer.js';
import { SMITH_FINALE, newSmithFinale, smithFinalePose, smithEndingPose, smithCraterAmount, smithCraterFloor, smithCraterRim, type SmithFinaleEncounter } from '@auto_matrix/shared';

/** Procedural production sample for the Revolutions rain duel.
 * Character rigs remain owned by AgentRenderer; this class owns the avenue,
 * Smith audience, destruction and connection effects around them. */
export class SmithFinaleRenderer {
  readonly group = new THREE.Group();
  private audience?: SmithCrowdRenderer;
  private avenue = new THREE.Group();
  private water?: Reflector;
  private road!: THREE.Mesh;
  private paint!: THREE.Mesh;
  private intactRoad!: THREE.BufferGeometry;
  private brokenRoad!: THREE.BufferGeometry;
  private poolWater!: THREE.BufferGeometry;
  private disposed = false;
  private weatherTime = { value: 0 };
  private pitWater = { value: 0 };
  private textures = new Set<THREE.Texture>();
  private rain = new THREE.Group();
  private lightning = new THREE.Group();
  private shockwave = new THREE.Group();
  private trails = new THREE.Group();
  private breach = new THREE.Group();
  private crater = new THREE.Group();
  private purge = new THREE.Group();
  private geometries = new Set<THREE.BufferGeometry>();
  private materials = new Set<THREE.Material>();
  private lights: THREE.Light[] = [];
  private shockShell!: THREE.LineSegments;
  private flightSpray!: THREE.LineSegments;
  private purgeDust!: THREE.Points;
  private puddles!: THREE.InstancedMesh;
  private rippleMatrix = new THREE.Object3D();
  private debris: THREE.Mesh[] = [];
  private rubble!: THREE.InstancedMesh;
  private runoff!: THREE.LineSegments;
  private drains: THREE.Vector3[] = [];

  constructor(root: THREE.Group) {
    this.group.name = 'smith-finale-avenue'; this.rain.name = 'smith-finale-rain';
    this.lightning.name = 'smith-finale-lightning'; this.shockwave.name = 'smith-finale-shockwave';
    this.trails.name = 'smith-finale-air-trails'; this.breach.name = 'smith-finale-building-breach';
    this.crater.name = 'smith-finale-crater'; this.purge.name = 'smith-finale-purge';
    root.add(this.group); this.group.add(this.rain, this.lightning, this.shockwave, this.trails,
      this.breach, this.crater, this.purge);
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

  private rockMaps(materials: THREE.MeshStandardMaterial[]): void {
    if (typeof document === 'undefined') return;
    let ready = 0; const maps: THREE.Texture[] = [];
    for (const kind of ['color', 'normal', 'roughness']) {
      const texture = new THREE.TextureLoader().load(`/assets/surfaces/seaside_rock-${kind}.jpg`, () => {
        if (++ready !== 3 || this.disposed) return;
        for (const material of materials) {
          [material.map, material.normalMap, material.roughnessMap] = maps; material.needsUpdate = true;
        }
      });
      texture.wrapS = texture.wrapT = THREE.RepeatWrapping; texture.anisotropy = 8;
      if (kind === 'color') texture.colorSpace = THREE.SRGBColorSpace;
      maps.push(texture); this.textures.add(texture);
    }
  }

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
    this.intactRoad = this.geometry(new THREE.PlaneGeometry(42, 190));
    const outline = new THREE.Shape(); outline.moveTo(-21, -95); outline.lineTo(21, -95); outline.lineTo(21, 95); outline.lineTo(-21, 95); outline.closePath();
    const hole = new THREE.Path();
    for (let i = 0; i <= 96; i++) {
      const angle = i / 96 * Math.PI * 2, radius = smithCraterRim(angle);
      const x = Math.cos(angle) * radius, y = -SMITH_FINALE.crater.z - Math.sin(angle) * radius;
      if (i === 0) hole.moveTo(x, y); else hole.lineTo(x, y);
    }
    outline.holes.push(hole); this.brokenRoad = this.geometry(new THREE.ShapeGeometry(outline));
    const positions = this.brokenRoad.getAttribute('position'), uv = this.brokenRoad.getAttribute('uv');
    for (let i = 0; i < positions.count; i++) uv.setXY(i, positions.getX(i) / 42 + .5, positions.getY(i) / 190 + .5);
    this.road = this.mesh(this.intactRoad, wet, this.group, 0, .025, 0, 'smith-finale-flooded-road');
    this.road.rotation.x = -Math.PI / 2;
    // A single low-resolution reflected pass gives the water real silhouettes.
    // The irregular translucent surface leaves the asphalt visible beneath it.
    this.water = new Reflector(this.intactRoad, {
      color: 0x8a9a91, textureWidth: 512, textureHeight: 512, multisample: 0, clipBias: .003,
    });
    const waterMaterial = this.water.material as THREE.ShaderMaterial;
    waterMaterial.vertexShader = waterMaterial.vertexShader.replace('varying vec4 vUv;', 'varying vec4 vUv; varying vec2 streetUv;')
      .replace('vUv = textureMatrix', 'streetUv = uv; vUv = textureMatrix');
    waterMaterial.fragmentShader = waterMaterial.fragmentShader.replace('varying vec4 vUv;', 'varying vec4 vUv; varying vec2 streetUv; uniform float weatherTime; uniform float pitWater;')
      .replace('vec4 base = texture2DProj( tDiffuse, vUv );', `
        vec4 reflected = vUv;
        reflected.x += sin(streetUv.y * 1700.0 + weatherTime * 3.0) * .00055 * reflected.w;
        reflected.y += sin(streetUv.x * 910.0 - weatherTime * 2.0) * .00025 * reflected.w;
        vec4 base = texture2DProj(tDiffuse, reflected);`)
      .replace('gl_FragColor = vec4( blendOverlay( base.rgb, color ), 1.0 );',
        'gl_FragColor = vec4(blendOverlay(base.rgb, color), mix(.38 + .18 * sin(streetUv.x * 57.0 + sin(streetUv.y * 71.0)), .28, pitWater));');
    this.water.name = 'smith-finale-reflected-water'; this.water.rotation.x = -Math.PI / 2; this.water.position.y = .035;
    waterMaterial.transparent = true; waterMaterial.depthWrite = false; waterMaterial.uniforms.weatherTime = this.weatherTime; waterMaterial.uniforms.pitWater = this.pitWater;
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
    stripe.onBeforeCompile = shader => {
      shader.vertexShader = shader.vertexShader.replace('#include <common>', '#include <common>\nvarying vec2 roadPoint;')
        .replace('#include <begin_vertex>', '#include <begin_vertex>\nroadPoint = position.xy;');
      shader.fragmentShader = shader.fragmentShader.replace('#include <common>', '#include <common>\nvarying vec2 roadPoint;')
        .replace('#include <clipping_planes_fragment>', `#include <clipping_planes_fragment>
          bool centerLine = abs(abs(roadPoint.x) - .22) < .06;
          bool edgeLine = abs(abs(roadPoint.x) - 16.8) < .06 && mod(-roadPoint.y + 92.4, 10.0) < 4.8;
          if (!centerLine && !edgeLine) discard;`);
    };
    this.paint = this.mesh(this.intactRoad, stripe, this.group, 0, .051, 0, 'smith-finale-road-stripe'); this.paint.rotation.x = -Math.PI / 2;
    const ripple = this.basic({ color: 0x93a8a0, transparent: true, opacity: .17, side: THREE.DoubleSide, depthWrite: false });
    const ringGeometry = this.geometry(new THREE.RingGeometry(.18, .195, 16));
    this.puddles = new THREE.InstancedMesh(ringGeometry, ripple, 216); this.puddles.name = 'smith-finale-puddle-ripples';
    this.puddles.instanceMatrix.setUsage(THREE.DynamicDrawUsage); this.group.add(this.puddles);
    const ambient = new THREE.HemisphereLight(0xbbc8b4, 0x152320, .85); this.group.add(ambient); this.lights.push(ambient);
    const backlight = new THREE.DirectionalLight(0xd4e0d0, 1.7); backlight.position.set(-18, 48, -65);
    backlight.target.position.set(0, -6, -30); backlight.castShadow = true;
    Object.assign(backlight.shadow.camera, { left: -24, right: 24, top: 24, bottom: -24, near: 1, far: 110 });
    backlight.shadow.mapSize.set(1024, 1024); backlight.shadow.bias = -.00008; backlight.shadow.normalBias = .025;
    this.group.add(backlight, backlight.target); this.lights.push(backlight);
    for (const side of [-1, 1]) for (let z = -72; z < 87; z += 30) {
      const x = side * 20.4;
      const lamp = new THREE.PointLight(0xc6d4b9, 220, 30, 2); lamp.position.set(x - side * 1.2, 9.3, z); this.group.add(lamp); this.lights.push(lamp);
      this.mesh(new THREE.CylinderGeometry(.07, .16, 9.4, 10), dark, this.avenue, x, 4.7, z, 'smith-finale-lamp-post');
      box(1.6, .12, .14, dark, x - side * .65, 9.35, z, 'smith-finale-lamp-arm');
      box(.9, .12, .46, lit, x - side * 1.2, 9.25, z, 'smith-finale-lamp-head');
    }
    this.batchAvenue();
  }

  private batchAvenue(parent = this.avenue): void {
    parent.updateMatrixWorld(true);
    const inverse = parent.matrixWorld.clone().invert(), batches = new Map<THREE.Material, THREE.BufferGeometry[]>();
    parent.traverse(object => {
      if (!(object instanceof THREE.Mesh)) return;
      const geometry = object.geometry.clone().applyMatrix4(inverse.clone().multiply(object.matrixWorld));
      const parts = batches.get(object.material as THREE.Material) ?? []; parts.push(geometry); batches.set(object.material as THREE.Material, parts);
    });
    parent.clear();
    for (const [material, parts] of batches) {
      const geometry = mergeGeometries(parts); parts.forEach(part => part.dispose());
      if (!geometry) continue;
      const mesh = this.mesh(geometry, material, parent, 0, 0, 0, parent === this.avenue ? 'smith-finale-static-facade' : 'smith-finale-exposed-utilities'); mesh.castShadow = false;
    }
  }

  private buildWeather(): void {
    const rainMaterial = this.basic({ color: 0xa8c2ba, transparent: true, opacity: .4, depthWrite: false });
    const points: number[] = [], phases: number[] = [];
    for (let i = 0; i < 3200; i++) {
      const x = -34 + (i * 17.37) % 68; const y = (i * 11.23) % 60; const z = -74 + (i * 29.11) % 148;
      points.push(x, 48, z, x - .08, 48 - 1.2 - i % 4 * .28, z + .18); phases.push(y, y);
    }
    rainMaterial.onBeforeCompile = shader => {
      shader.uniforms.weatherTime = this.weatherTime;
      shader.vertexShader = shader.vertexShader.replace('#include <common>', '#include <common>\nuniform float weatherTime; attribute float rainPhase;')
        .replace('#include <begin_vertex>', '#include <begin_vertex>\ntransformed.y -= mod(weatherTime * 24.0 + rainPhase, 60.0);');
    };
    const geometry = this.geometry(new THREE.BufferGeometry()); geometry.setAttribute('position', new THREE.Float32BufferAttribute(points, 3));
    geometry.setAttribute('rainPhase', new THREE.Float32BufferAttribute(phases, 1));
    const streaks = new THREE.LineSegments(geometry, rainMaterial); streaks.name = 'smith-finale-rain-streaks'; streaks.frustumCulled = false; this.rain.add(streaks);
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
    this.buildCrater();
  }

  private buildCrater(): void {
    const { depth, z: centerZ } = SMITH_FINALE.crater;
    const grain = new Uint8Array(128 * 128 * 4);
    for (let y = 0; y < 128; y++) for (let x = 0; x < 128; x++) {
      const seam = Math.pow(Math.abs(Math.sin(x * .16 + Math.sin(y * .13) * 2.2)), 16);
      const value = 135 - seam * 90 + Math.sin(x * 9.1 + y * 13.7) * 24;
      const i = (y * 128 + x) * 4; grain[i] = grain[i + 1] = grain[i + 2] = value; grain[i + 3] = 255;
    }
    const fracture = new THREE.DataTexture(grain, 128, 128); fracture.wrapS = fracture.wrapT = THREE.RepeatWrapping;
    fracture.needsUpdate = true; this.textures.add(fracture);
    const rock = this.material({ color: 0xb5b9b2, vertexColors: true, roughness: .58, metalness: .04,
      bumpMap: fracture, bumpScale: .12, normalScale: new THREE.Vector2(.8, .8) });
    const positions: number[] = [], colors: number[] = [], uv: number[] = [], indices: number[] = [];
    const rings = 64, segments = 144;
    for (let ring = 0; ring <= rings; ring++) for (let segment = 0; segment <= segments; segment++) {
      const angle = segment / segments * Math.PI * 2, radius = smithCraterRim(angle) * ring / rings;
      const x = Math.cos(angle) * radius, z = centerZ + Math.sin(angle) * radius, y = smithCraterFloor(x, z);
      positions.push(x, y, z); uv.push(segment / segments * 22, (y + depth + radius * .25) / 5);
      const shade = .81 + .08 * Math.sin(ring * 2.7 + segment * 8.3) + .09 * Math.sin(y * 3.8);
      colors.push(shade * .86, shade, shade * .93);
      if (ring < rings && segment < segments) {
        const a = ring * (segments + 1) + segment, b = a + segments + 1;
        indices.push(a, a + 1, b, a + 1, b + 1, b);
      }
    }
    const bowl = new THREE.BufferGeometry(); bowl.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    bowl.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3)); bowl.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    bowl.setIndex(indices); bowl.computeVertexNormals();
    this.mesh(bowl, rock, this.crater, 0, 0, 0, 'smith-finale-crater-floor');
    const mud = this.material({ color: 0x38433d, metalness: .12, roughness: .3, bumpMap: fracture, bumpScale: .018 });
    const pool = this.mesh(new THREE.CircleGeometry(8.9, 96), mud, this.crater, 0, -depth + .025, centerZ, 'smith-finale-crater-water');
    pool.rotation.x = -Math.PI / 2; pool.castShadow = false;
    this.poolWater = this.geometry(new THREE.CircleGeometry(8.9, 96).translate(0, -centerZ, 0));
    const poolPoints = this.poolWater.getAttribute('position'), poolUV = this.poolWater.getAttribute('uv');
    for (let i = 0; i < poolPoints.count; i++) poolUV.setXY(i, poolPoints.getX(i) / 42 + .5, poolPoints.getY(i) / 190 + .5);
    const concrete = this.material({ color: 0xa9ada7, roughness: .64, metalness: .04, normalScale: new THREE.Vector2(.7, .7) });
    this.rockMaps([rock, concrete]);
    const slab = this.geometry(new THREE.IcosahedronGeometry(1, 1)), vertices = slab.getAttribute('position');
    for (let i = 0; i < vertices.count; i++) {
      const x = vertices.getX(i), y = vertices.getY(i), z = vertices.getZ(i);
      const irregular = 1 + Math.sin(x * 5.7 + y * 7.3 + z * 4.2) * .15;
      vertices.setXYZ(i, x * irregular, y * .55 * irregular, z * irregular);
    }
    slab.computeVertexNormals();
    this.rubble = new THREE.InstancedMesh(slab, concrete, 280); this.rubble.name = 'smith-finale-crater-rubble';
    this.rubble.castShadow = true; this.rubble.receiveShadow = true; this.crater.add(this.rubble);
    const transform = new THREE.Object3D(), normal = new THREE.Vector3(), up = new THREE.Vector3(0, 1, 0);
    for (let i = 0; i < this.rubble.count; i++) {
      const angle = i * 2.399963, radius = 10.2 + (i * .713) % 6.4;
      const x = Math.cos(angle) * radius, z = centerZ + Math.sin(angle) * radius;
      const size = .35 + (i % 7) * .18;
      normal.set(smithCraterFloor(x - .2, z) - smithCraterFloor(x + .2, z), .4,
        smithCraterFloor(x, z - .2) - smithCraterFloor(x, z + .2)).normalize();
      transform.position.set(x, smithCraterFloor(x, z), z);
      // Half-buried fragments conform to the bank rather than perching on a
      // single high corner with their lower faces suspended over empty air.
      transform.quaternion.setFromUnitVectors(up, normal); transform.rotateY(angle);
      transform.scale.set(size * 1.3, size, size * (.7 + i % 4 * .13)); transform.updateMatrix();
      this.rubble.setMatrixAt(i, transform.matrix);
      this.rubble.setColorAt(i, new THREE.Color().setScalar(.68 + i % 6 * .055));
    }
    const utilities = new THREE.Group(); this.crater.add(utilities);
    const asphalt = this.material({ color: 0x252e2a, roughness: .77, bumpMap: fracture, bumpScale: .09 });
    for (let i = 0; i < 24; i++) {
      const angle = i * 2.399963 + .2, radius = 11.3 + i % 4 * 1.3;
      const x = Math.cos(angle) * radius, z = centerZ + Math.sin(angle) * radius;
      const fragment = new THREE.Group(); fragment.position.set(x, smithCraterFloor(x, z), z);
      fragment.rotation.set(.2 + i % 3 * .3, angle, .25); utilities.add(fragment);
      const shape = new THREE.BoxGeometry(2.3 + i % 3 * .3, .55, 1.8, 2, 1, 2), points = shape.getAttribute('position');
      for (let v = 0; v < points.count; v++) {
        const px = points.getX(v), py = points.getY(v), pz = points.getZ(v);
        points.setXYZ(v, px + Math.sin(pz * 7.8 + py * 6.1) * .12, py + Math.sin(px * 4.4 + pz * 5.3) * .07, pz + Math.sin(px * 6.2) * .11);
      }
      shape.computeVertexNormals(); this.mesh(shape, concrete, fragment);
      this.mesh(new THREE.BoxGeometry(2.1 + i % 3 * .3, .1, 1.6), asphalt, fragment, 0, .3, 0);
    }
    const iron = this.material({ color: 0x56615b, metalness: .74, roughness: .44 });
    const inside = this.material({ color: 0x101b17, metalness: .35, roughness: .85, side: THREE.BackSide });
    const pipe = (angle: number, radius: number) => {
      const start = new THREE.Vector3(Math.cos(angle) * 16.6, -3.2, centerZ + Math.sin(angle) * 16.6);
      const end = new THREE.Vector3(Math.cos(angle) * 12.2, -6.2, centerZ + Math.sin(angle) * 12.2);
      const direction = end.clone().sub(start), midpoint = start.clone().lerp(end, .5);
      for (const [r, material] of [[radius, concrete], [radius - .14, inside]] as const) {
        const tube = this.mesh(new THREE.CylinderGeometry(r, r, direction.length(), 24, 1, true), material, utilities, midpoint.x, midpoint.y, midpoint.z);
        tube.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction.clone().normalize());
      }
      const lip = this.mesh(new THREE.TorusGeometry(radius - .07, .07, 6, 24), concrete, utilities, end.x, end.y, end.z);
      lip.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), direction.normalize());
      this.drains.push(end.clone().add(new THREE.Vector3(0, -radius + .15, 0)));
    };
    pipe(.2, 1.32); pipe(2.8, .76);
    // Torn reinforcement cages and broken road substructure around the lip.
    for (let i = 0; i < 8; i++) {
      const angle = i * .79 + .45, radius = 12.2 + i % 3, x = Math.cos(angle) * radius, z = centerZ + Math.sin(angle) * radius;
      const cage = new THREE.Group(); cage.position.set(x, smithCraterFloor(x, z) + 1.1, z); cage.rotation.set(.2 + i % 3 * .3, angle, .35); utilities.add(cage);
      for (const offset of [-.9, -.3, .3, .9]) {
        const vertical = this.mesh(new THREE.CylinderGeometry(.035, .035, 2.8, 5), iron, cage, offset, 0, 0); vertical.castShadow = false;
        const horizontal = this.mesh(new THREE.CylinderGeometry(.035, .035, 2.2, 5), iron, cage, 0, offset, 0);
        horizontal.rotation.z = Math.PI / 2; horizontal.castShadow = false;
      }
    }
    this.batchAvenue(utilities);
    const runoffMaterial = new THREE.LineBasicMaterial({ color: 0xaebfb5, transparent: true, opacity: .46, depthWrite: false }); this.materials.add(runoffMaterial);
    const runoff = this.geometry(new THREE.BufferGeometry());
    runoff.setAttribute('position', new THREE.BufferAttribute(new Float32Array(2 * 96 * 6), 3).setUsage(THREE.DynamicDrawUsage));
    this.runoff = new THREE.LineSegments(runoff, runoffMaterial); this.runoff.name = 'smith-finale-crater-runoff'; this.runoff.frustumCulled = false; this.crater.add(this.runoff);
  }

  private buildConnection(): void {
    const light = new THREE.PointLight(0xe5f3ff, 0, 50, 2); this.purge.add(light); this.lights.push(light);
    const material = new THREE.PointsMaterial({ color: 0xd0ded8, size: .065, transparent: true, opacity: .6, depthWrite: false });
    material.onBeforeCompile = shader => {
      shader.fragmentShader = shader.fragmentShader.replace('#include <clipping_planes_fragment>',
        '#include <clipping_planes_fragment>\nif (length(gl_PointCoord - .5) > .5) discard;');
    };
    this.materials.add(material);
    const dust = this.geometry(new THREE.BufferGeometry()); dust.setAttribute('position', new THREE.BufferAttribute(new Float32Array(480 * 3), 3).setUsage(THREE.DynamicDrawUsage));
    this.purgeDust = new THREE.Points(dust, material); this.purgeDust.name = 'smith-finale-purge-dust'; this.purgeDust.frustumCulled = false; this.purge.add(this.purgeDust);
  }

  update(encounter: SmithFinaleEncounter | undefined, firstPerson: boolean, player: { x: number; z: number }): void {
    const state = encounter ?? newSmithFinale(); const pose = smithFinalePose(state); const phase = state.phase;
    const crater = smithCraterAmount(state);
    this.crater.visible = crater > 0; this.crater.scale.y = crater;
    this.road.geometry = this.paint.geometry = crater > 0 ? this.brokenRoad : this.intactRoad;
    // Reuse the single reflection pass at the pit bottom instead of adding a
    // second full scene render while the camera follows the two fighters down.
    this.water!.geometry = crater > 0 ? this.poolWater : this.intactRoad;
    this.water!.position.y = -SMITH_FINALE.crater.depth * crater + .035;
    this.pitWater.value = crater;
    const ending = smithEndingPose(state);
    this.weatherTime.value = state.total; this.rain.visible = ending.rain > 0;
    (this.rain.children[0] as THREE.LineSegments<THREE.BufferGeometry, THREE.MeshBasicMaterial>).material.opacity = .4 * ending.rain;
    const flash = (Math.sin(state.total * 1.73 + 1.2) > .965 || phase === 'shockwave');
    this.lightning.visible = flash && ending.rain > 0;
    const flashLight = this.lightning.children.find(child => child instanceof THREE.PointLight) as THREE.PointLight | undefined;
    if (flashLight) flashLight.intensity = this.lightning.visible ? phase === 'purging' ? 1800 : 780 : 0;
    for (let index = 0; index < this.puddles.count; index++) {
      const scale = .5 + ((state.total * 2.2 + index * .37) % 1) * 2.4;
      const radius = Math.sqrt((index * .618) % 1) * 8.6, angle = index * 2.399963;
      const x = index < 120 ? -19 + (index * 7.7) % 38 : Math.cos(angle) * radius;
      const z = index < 120 ? -88 + (index * 17.3) % 176 : SMITH_FINALE.crater.z + Math.sin(angle) * radius;
      const floor = smithCraterFloor(x, z);
      this.rippleMatrix.position.set(x, .064 + floor * crater, z);
      this.rippleMatrix.rotation.x = -Math.PI / 2;
      this.rippleMatrix.scale.setScalar(crater > 0 && floor < -.01 && floor > -11.99 ? 0 : scale * (crater > 0 && floor <= -11.99 ? .34 : 1));
      this.rippleMatrix.updateMatrix();
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
    const destroyed = crater > 0 || ['building', 'descent'].includes(phase);
    this.breach.visible = destroyed;
    if (crater > 0) {
      const points = this.runoff.geometry.getAttribute('position') as THREE.BufferAttribute;
      for (let drain = 0; drain < this.drains.length; drain++) for (let i = 0; i < 96; i++) {
        const start = this.drains[drain], age = (state.total * .85 + i * .618) % 1, inward = drain === 0 ? -1 : 1;
        const x = start.x + inward * age * 1.8 + Math.sin(i * 2.4) * .16, y = Math.max(-11.97, start.y - age * age * 5.6);
        const z = start.z + Math.cos(i * 2.4) * .2, index = (drain * 96 + i) * 2;
        points.setXYZ(index, x, y, z); points.setXYZ(index + 1, x + inward * .04, Math.max(-11.97, y - .17), z);
      }
      points.needsUpdate = true;
    }
    this.purge.visible = phase === 'purging';
    if (this.purge.visible) {
      const body = state.elapsed < 2.5 ? pose.neo : pose.smith;
      this.purge.position.set(body.x, body.y + 2.8, body.z);
      (this.purge.children.find(child => child instanceof THREE.PointLight) as THREE.PointLight).intensity = Math.max(ending.neoPulse, ending.smithPulse) * 180;
      const age = Math.max(0, state.elapsed - (state.elapsed < 2.5 ? 1.6 : 3.8));
      const points = this.purgeDust.geometry.getAttribute('position') as THREE.BufferAttribute;
      this.purgeDust.visible = age > 0 && age < 2;
      for (let i = 0; i < points.count; i++) {
        const angle = i * 2.399963, radius = age * (1 + i % 7 * .22), y = (i * .618 % 1) * 3.2 - 2;
        points.setXYZ(i, Math.cos(angle) * radius, Math.max(-2.78, y + age * .6 - age * age * 1.7), Math.sin(angle) * radius);
      }
      points.needsUpdate = true; (this.purgeDust.material as THREE.PointsMaterial).opacity = .5 * Math.max(0, 1 - age / 2);
    }
    this.audience?.update(state, player);

  }

  dispose(): void {
    this.disposed = true;
    this.group.removeFromParent(); this.group.clear(); this.geometries.forEach(geometry => geometry.dispose());
    this.materials.forEach(material => material.dispose()); this.lights.forEach(light => light.dispose());
    this.textures.forEach(texture => texture.dispose()); this.water?.dispose();
    this.audience?.dispose(); this.puddles.dispose(); this.rubble.dispose();
  }
}
