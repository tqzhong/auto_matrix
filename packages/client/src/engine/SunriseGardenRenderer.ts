import * as THREE from 'three';
import { Reflector } from 'three/addons/objects/Reflector.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { SUNRISE_GARDEN, gardenSunrise, gardenTreePlacement, gardenBankTreePlacement, gardenGroundHeight, type TrilogyEpilogueEncounter } from '@auto_matrix/shared';
import { batchStaticGeometry } from './StaticGeometry.js';

/** The ending is an open waterfront lawn, with the city across the water. */
export class SunriseGardenRenderer {
  readonly group = new THREE.Group();
  private geometries = new Set<THREE.BufferGeometry>();
  private materials = new Set<THREE.Material>();
  private textures = new Set<THREE.Texture>();
  private water: Reflector;
  private sky: THREE.ShaderMaterial;
  private sun = new THREE.DirectionalLight(0xffd3aa, 1.4);
  private fill = new THREE.HemisphereLight(0xc8d9e4, 0x53633b, 1.05);
  private rise = 0;
  private seed = 2003;
  private treeFallback = new THREE.Group();
  private treeInstances = new Set<THREE.InstancedMesh>();
  private disposed = false;
  readonly treesReady: Promise<void>;

  constructor(root: THREE.Group) {
    this.group.name = 'sunrise-waterfront-park'; root.add(this.group);
    this.sky = this.skyMaterial();
    const dome = this.mesh(new THREE.SphereGeometry(850, 48, 24), this.sky, 0, 0, 0);
    dome.name = 'sati-sunrise'; dome.castShadow = dome.receiveShadow = false; dome.renderOrder = -10;
    const grass = this.pbr('park', 'lawn_grass', 0xffffff, 40, 28); grass.normalScale.set(.25, .25);
    const pavement = this.pbr('surfaces', 'concrete_pavement_03', 0xa9a895, 18 * SUNRISE_GARDEN.promenadeWidth / 210, 1);
    const soil = this.material(0x282f22, 1), stone = this.material(0x9f9b8a, .94);
    const lawnGeometry = new THREE.PlaneGeometry(210, 150, 140, 150); lawnGeometry.rotateX(-Math.PI / 2);
    const lawnPositions = lawnGeometry.attributes.position;
    for (let index = 0; index < lawnPositions.count; index++)
      lawnPositions.setY(index, gardenGroundHeight(lawnPositions.getX(index), lawnPositions.getZ(index) + 39) - .008);
    lawnGeometry.computeVertexNormals();
    const lawn = this.mesh(lawnGeometry, grass, 0, 0, 39); lawn.name = 'park-mown-lawn';
    // A continuous promenade and low stone retaining edge; the shared shore blocks walking on water.
    const path = this.mesh(new THREE.PlaneGeometry(SUNRISE_GARDEN.promenadeWidth, 6.6), pavement, 0, 0, -31.9); path.rotation.x = -Math.PI / 2;
    this.box(0, -.48, SUNRISE_GARDEN.shore, SUNRISE_GARDEN.promenadeWidth, 1, .75, stone);
    this.box(0, .015, SUNRISE_GARDEN.shore + .24, SUNRISE_GARDEN.promenadeWidth, .11, .95, stone);
    for (let x = -SUNRISE_GARDEN.promenadeWidth / 2 + 5; x <= SUNRISE_GARDEN.promenadeWidth / 2 - 5; x += 3.6) this.box(x, .006, -32, .018, .012, 6.7, soil);
    this.group.add(this.treeFallback);
    this.bench(); this.vegetation(); this.treesReady = this.loadTrees(); this.city();
    const waterGeometry = new THREE.PlaneGeometry(900, 700); this.geometries.add(waterGeometry);
    this.water = new Reflector(waterGeometry, { color: 0x94a8ae, textureWidth: 768, textureHeight: 512, clipBias: .003, multisample: 0 });
    this.water.name = 'park-reflecting-water'; this.water.rotation.x = -Math.PI / 2;
    this.water.position.set(0, -.72, SUNRISE_GARDEN.shore - 350); this.group.add(this.water);
    const reflect = this.water.onBeforeRender.bind(this.water);
    this.water.onBeforeRender = (...args) => { if (!args[1].overrideMaterial) reflect(...args); };
    const shader = this.water.material as THREE.ShaderMaterial;
    shader.uniforms.parkTime = { value: 0 };
    shader.fragmentShader = shader.fragmentShader.replace('uniform vec3 color;', 'uniform vec3 color; uniform float parkTime;')
      .replace('vec4 base = texture2DProj( tDiffuse, vUv );', `
        vec4 waterUv = vUv;
        vec2 uv = vUv.xy / vUv.w;
        waterUv.x += (sin(uv.y * 570.0 + parkTime * .8) + sin(uv.y * 921.0 - parkTime * .6)) * .0014 * vUv.w;
        waterUv.y += sin(uv.x * 110.0 + uv.y * 300.0 + parkTime * .55) * .00065 * vUv.w;
        vec4 base = texture2DProj(tDiffuse, waterUv);`);
    this.sun.position.set(22, 25, -105); this.sun.target.position.set(-6, 0, -20);
    this.sun.castShadow = true; this.sun.shadow.mapSize.set(2048, 2048);
    Object.assign(this.sun.shadow.camera, { left: -42, right: 42, top: 42, bottom: -42, near: 1, far: 180 });
    this.sun.shadow.camera.updateProjectionMatrix();
    this.sun.shadow.bias = -.0003; this.sun.shadow.normalBias = .025;
    this.group.add(this.sun, this.sun.target, this.fill);
    batchStaticGeometry(this.group, new Set([this.water])).forEach(geometry => this.geometries.add(geometry));
    this.update(undefined);
  }

  private random(): number { this.seed = Math.imul(1664525, this.seed) + 1013904223 | 0; return (this.seed >>> 0) / 4294967296; }
  private material(color: number, roughness = .8, metalness = 0): THREE.MeshStandardMaterial {
    const material = new THREE.MeshStandardMaterial({ color, roughness, metalness }); this.materials.add(material); return material;
  }
  private pbr(folder: string, name: string, color: number, repeatX: number, repeatY: number): THREE.MeshStandardMaterial {
    const material = this.material(color);
    for (const [key, suffix] of [['map', 'color'], ['normalMap', 'normal'], ['roughnessMap', 'roughness']] as const) {
      const texture = new THREE.TextureLoader().load(`/assets/${folder}/${name}-${suffix}.jpg`);
      texture.wrapS = texture.wrapT = THREE.RepeatWrapping; texture.repeat.set(repeatX, repeatY); texture.anisotropy = 8;
      if (key === 'map') texture.colorSpace = THREE.SRGBColorSpace;
      material[key] = texture; this.textures.add(texture);
    }
    material.normalScale.set(.5, .5); return material;
  }
  private mesh(geometry: THREE.BufferGeometry, material: THREE.Material, x: number, y: number, z: number, parent: THREE.Object3D = this.group): THREE.Mesh {
    this.geometries.add(geometry); const mesh = new THREE.Mesh(geometry, material);
    mesh.position.set(x, y, z); mesh.castShadow = mesh.receiveShadow = true; parent.add(mesh); return mesh;
  }
  private box(x: number, y: number, z: number, w: number, h: number, d: number, material: THREE.Material, parent: THREE.Object3D = this.group): THREE.Mesh {
    return this.mesh(new THREE.BoxGeometry(w, h, d), material, x, y, z, parent);
  }
  private branch(start: THREE.Vector3, end: THREE.Vector3, r1: number, r2: number, material: THREE.Material): void {
    const vector = end.clone().sub(start), midpoint = start.clone().add(end).multiplyScalar(.5);
    const mesh = this.mesh(new THREE.CylinderGeometry(r2, r1, vector.length(), 9, 3), material, midpoint.x, midpoint.y, midpoint.z, this.treeFallback);
    mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), vector.normalize());
  }
  private bench(): void {
    const b = SUNRISE_GARDEN.bench, bench = new THREE.Group(); bench.name = 'oracle-waterfront-bench'; bench.position.set(b.x, 0, b.z); this.group.add(bench);
    const wood = this.pbr('film-materials', 'old_wood_floor', 0x80664d, 2.5, .35), iron = this.material(0x303a36, .58, .65);
    for (let i = 0; i < 5; i++) {
      const seat = this.mesh(new RoundedBoxGeometry(b.width - .35, .12, .29, 2, .035), wood, 0, b.surface - .06, -.65 + i * .32, bench);
      seat.name = `park-bench-seat-slat-${i}`;
    }
    for (let i = 0; i < 4; i++) {
      const back = this.mesh(new RoundedBoxGeometry(b.width - .35, .27, .12, 2, .025), wood, 0, b.surface + .34 + i * .35, .69 + i * .035, bench);
      back.rotation.x = -.09;
    }
    for (const side of [-1, 1]) {
      for (const z of [-.58, .64]) this.box(side * 3.08, (b.surface - .08) / 2, z, .16, b.surface - .08, .17, iron, bench);
      this.box(side * 3.08, b.surface + .47, .73, .14, 2.2, .14, iron, bench);
      const curve = new THREE.CatmullRomCurve3([new THREE.Vector3(side * 3.3, b.surface - .04, -.7), new THREE.Vector3(side * 3.3, b.surface + .65, -.75),
        new THREE.Vector3(side * 3.3, b.surface + .76, -.25), new THREE.Vector3(side * 3.3, b.surface + .6, .7)]);
      this.mesh(new THREE.TubeGeometry(curve, 24, .065, 8), iron, 0, 0, 0, bench);
      this.box(side * 3.08, b.surface - .1, 0, .18, .13, 1.55, iron, bench);
    }
  }
  private vegetation(): void {
    const bark = this.pbr('park', 'bark_willow', 0xa5a195, 1, 2), foliage = this.material(0xe3e6ba, .94);
    foliage.side = THREE.DoubleSide;
    const leaf = new THREE.BufferGeometry();
    leaf.setAttribute('position', new THREE.Float32BufferAttribute([0, 0, 0, -.19, .29, -.015, 0, .65, 0, .19, .29, -.015, 0, .28, .035], 3));
    leaf.setIndex([0, 1, 4, 1, 2, 4, 2, 3, 4, 3, 0, 4]); leaf.computeVertexNormals(); this.geometries.add(leaf);
    const leaves = new THREE.InstancedMesh(leaf, foliage, 6 * 2200);
    this.treeInstances.add(leaves);
    leaves.name = 'park-leaf-canopies'; leaves.castShadow = leaves.receiveShadow = true;
    const transform = new THREE.Object3D(), color = new THREE.Color(); let index = 0;
    for (const [x, z, scale] of SUNRISE_GARDEN.trees.slice(0, 6)) {
      const floor = gardenGroundHeight(x, z);
      const base = new THREE.Vector3(x, floor, z), crown = new THREE.Vector3(x + scale * .5, floor + 8 * scale, z);
      this.branch(base, crown, .62 * scale, .17 * scale, bark);
      for (let i = 0; i < 10; i++) {
        const angle = i * 2.4, radius = (3.2 + this.random() * 2.6) * scale;
        const start = new THREE.Vector3(x, floor + (3.5 + i * .4) * scale, z);
        const end = new THREE.Vector3(x + Math.cos(angle) * radius, floor + (7 + this.random() * 3) * scale, z + Math.sin(angle) * radius);
        this.branch(start, end, .22 * scale, .035 * scale, bark);
        for (let twig = 0; twig < 4; twig++) {
          const tip = end.clone().add(new THREE.Vector3((this.random() - .5) * 4, this.random() * 2, (this.random() - .5) * 4).multiplyScalar(scale));
          this.branch(end.clone().lerp(start, .3), tip, .055 * scale, .009, bark);
        }
        for (let j = 0; j < 220; j++) {
          const angle = this.random() * Math.PI * 2, radius = Math.sqrt(this.random()) * 3.2 * scale;
          transform.position.set(end.x + Math.cos(angle) * radius, end.y + (this.random() - .5) * 3.6 * scale, end.z + Math.sin(angle) * radius);
          transform.rotation.set(this.random() * 2.5, this.random() * 6.28, this.random() * 3.14);
          transform.scale.setScalar(.7 + this.random() * .8); transform.updateMatrix(); leaves.setMatrixAt(index, transform.matrix);
          leaves.setColorAt(index++, color.setHSL(.22 + this.random() * .06, .3 + this.random() * .2, .28 + this.random() * .18));
        }
      }
    }
    leaves.computeBoundingSphere(); this.treeFallback.add(leaves);
    const blade = new THREE.BufferGeometry(), positions: number[] = [], colors: number[] = [], indices: number[] = [];
    // Three curved leaves give a short tuft volume; vertex colors keep roots shaded and tips green.
    for (let leaf = 0; leaf < 3; leaf++) {
      const angle = leaf * 2.4, c = Math.cos(angle), s = Math.sin(angle), height = [.18, .12, .15][leaf];
      for (let section = 0; section < 3; section++) {
        const t = section / 2, bend = .075 * t * t, width = [.009, .012, .0008][section];
        color.setHSL(.245 + leaf * .008, .48, .13 + t * .13);
        for (const side of [-1, 1]) {
          positions.push(c * side * width + s * bend, height * t, -s * side * width + c * bend);
          colors.push(color.r, color.g, color.b);
        }
        if (section < 2) { const base = leaf * 6 + section * 2; indices.push(base, base + 1, base + 2, base + 1, base + 3, base + 2); }
      }
    }
    blade.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3)); blade.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    blade.setIndex(indices); blade.computeVertexNormals(); this.geometries.add(blade);
    const grass = this.material(0xffffff, 1); grass.side = THREE.DoubleSide; grass.vertexColors = true;
    const blades = new THREE.InstancedMesh(blade, grass, 12000); blades.name = 'park-grass-blades'; blades.receiveShadow = true;
    this.treeInstances.add(blades);
    for (let i = 0; i < blades.count; i++) {
      const near = i < 8000, x = (this.random() - .5) * (near ? 44 : 105), z = -28 + this.random() * (near ? 32 : 90);
      transform.position.set(x, gardenGroundHeight(x, z), z); transform.rotation.set(0, this.random() * 6.28, (this.random() - .5) * .22);
      const clearBench = Math.abs(x + 7) < 4.3 && Math.abs(z + 20) < 1.9;
      transform.scale.setScalar(clearBench ? 0 : .65 + this.random() * .65); transform.updateMatrix(); blades.setMatrixAt(i, transform.matrix);
      blades.setColorAt(i, color.setHSL(.24 + this.random() * .025, .15, .72 + this.random() * .14));
    }
    blades.computeBoundingSphere(); this.group.add(blades);
  }
  private async loadTrees(): Promise<void> {
    try {
      const asset = await new GLTFLoader().loadAsync('/assets/park/waterfront-tree.glb');
      asset.scene.traverse(object => {
        if (!(object instanceof THREE.Mesh)) return;
        this.geometries.add(object.geometry);
        const material = object.material as THREE.MeshStandardMaterial; this.materials.add(material);
        for (const value of Object.values(material)) if (value instanceof THREE.Texture) this.textures.add(value);
      });
      if (this.disposed) {
        this.geometries.forEach(geometry => geometry.dispose()); this.materials.forEach(material => material.dispose()); this.textures.forEach(texture => texture.dispose()); return;
      }
      const cutout = new THREE.TextureLoader().load('/assets/park/tree_small_02_leaves_alpha_1k.png');
      cutout.flipY = false; cutout.anisotropy = 8; this.textures.add(cutout);
      const transform = new THREE.Object3D();
      for (const [node, start, end] of [['Park_tree_near', 0, 6], ['Park_tree_background', 6, SUNRISE_GARDEN.trees.length], ['Park_tree_shore', 0, SUNRISE_GARDEN.bankTrees]] as const) {
        const tree = asset.scene.getObjectByName(node)!;
        tree.traverse(object => {
          if (!(object instanceof THREE.Mesh)) return;
          const material = object.material as THREE.MeshStandardMaterial;
          if (material.name.endsWith('_leaves')) { material.alphaMap = cutout; material.alphaTest = .4; material.transparent = false; material.needsUpdate = true; }
          for (const value of Object.values(material)) if (value instanceof THREE.Texture) value.anisotropy = 8;
          const instances = new THREE.InstancedMesh(object.geometry, material, end - start);
          const shore = node === 'Park_tree_shore', near = node === 'Park_tree_near';
          instances.name = `park-${shore ? 'shore' : near ? 'near' : 'background'}-${material.name}`;
          instances.castShadow = near; instances.receiveShadow = true;
          for (let index = start; index < end; index++) {
            const pose = shore ? gardenBankTreePlacement(index) : gardenTreePlacement(index); transform.position.set(pose.x, pose.y, pose.z);
            transform.rotation.set(0, pose.yaw, 0); transform.scale.setScalar(pose.scale); transform.updateMatrix();
            instances.setMatrixAt(index - start, transform.matrix);
          }
          instances.computeBoundingSphere(); this.treeInstances.add(instances); this.group.add(instances);
        });
      }
      this.treeFallback.removeFromParent();
      this.treeFallback.traverse(object => {
        if (!(object instanceof THREE.Mesh)) return;
        object.geometry.dispose(); this.geometries.delete(object.geometry);
        const material = object.material as THREE.MeshStandardMaterial;
        material.dispose(); this.materials.delete(material);
        for (const value of Object.values(material)) if (value instanceof THREE.Texture) { value.dispose(); this.textures.delete(value); }
        if (object instanceof THREE.InstancedMesh) { object.dispose(); this.treeInstances.delete(object); }
      });
      this.treeFallback.clear();
    } catch (error) { if (!this.disposed) console.warn('Waterfront trees unavailable; keeping the procedural fallback.', error); }
  }
  private facade(color: number): THREE.MeshStandardMaterial {
    const material = this.material(color, .86);
    material.onBeforeCompile = shader => {
      shader.vertexShader = 'varying vec2 parkFacadeUv; varying float parkFacadeSide;\n' + shader.vertexShader;
      shader.vertexShader = shader.vertexShader.replace('#include <uv_vertex>', '#include <uv_vertex>\nparkFacadeUv = uv; parkFacadeSide = 1.0 - abs(normal.y);');
      shader.fragmentShader = 'varying vec2 parkFacadeUv; varying float parkFacadeSide;\n' + shader.fragmentShader;
      shader.fragmentShader = shader.fragmentShader.replace('#include <color_fragment>', `#include <color_fragment>
        vec2 cell = fract(parkFacadeUv), edge = max(fwidth(parkFacadeUv), vec2(.003));
        vec2 pane = smoothstep(vec2(.13,.18), vec2(.13,.18)+edge, cell) * (1.0-smoothstep(vec2(.84,.79)-edge, vec2(.84,.79), cell));
        float parkWindow = pane.x * pane.y * parkFacadeSide;
        float room = fract(sin(dot(floor(parkFacadeUv),vec2(127.1,311.7)))*43758.5453);
        vec3 glass = mix(vec3(.055,.082,.09),vec3(.17,.22,.235),room);
        diffuseColor.rgb = mix(diffuseColor.rgb * (.92 + room*.08),glass,parkWindow);
        totalEmissiveRadiance += vec3(.42,.23,.075)*parkWindow*step(.985,room);`);
      shader.fragmentShader = shader.fragmentShader.replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\nroughnessFactor = mix(roughnessFactor, .26, parkWindow);');
    };
    material.customProgramCacheKey = () => 'park-window-grid-v1'; return material;
  }
  private city(): void {
    const skyline = new THREE.Group(); skyline.name = 'park-city-skyline'; this.group.add(skyline);
    const stone = [this.facade(0x79736a), this.facade(0x565f66), this.facade(0x85816f)];
    const trim = this.material(0x404b4d, .72), park = this.material(0x253b29, .96);
    const facadeUv = (mesh: THREE.Mesh, width: number, height: number, depth: number) => {
      mesh.castShadow = mesh.receiveShadow = false;
      if (!stone.includes(mesh.material as THREE.MeshStandardMaterial)) return;
      const uv = mesh.geometry.attributes.uv, normal = mesh.geometry.attributes.normal;
      for (let vertex = 0; vertex < uv.count; vertex++) uv.setXY(vertex,
        uv.getX(vertex) * (Math.abs(normal.getX(vertex)) > .5 ? depth : width) / 2.6 + mesh.position.x / 2.6,
        uv.getY(vertex) * height / 3.3 + (mesh.position.y - height / 2) / 3.3);
    };
    const block = (x: number, y: number, z: number, w: number, h: number, d: number, material: THREE.Material) => {
      const mesh = this.box(x, y, z, w, h, d, material, skyline); facadeUv(mesh, w, h, d); return mesh;
    };
    const cylinder = (x: number, y: number, z: number, radius: number, height: number, material: THREE.Material) => {
      const mesh = this.mesh(new THREE.CylinderGeometry(radius, radius, height, 24), material, x, y, z, skyline);
      facadeUv(mesh, radius * Math.PI * 2, height, radius * Math.PI * 2); return mesh;
    };
    // Tall clusters frame the lower district and the sun; the city is a deep backdrop across the lake.
    for (const [x, z, w, d, h, style] of [[-182,-212,28,22,126,0],[-144,-185,23,24,106,1],[-128,-172,18,20,82,1],[-112,-208,27,28,153,0],[-87,-230,18,20,111,1],[-62,-185,26,25,94,0],[-37,-257,16,20,53,1],
      [75,-245,19,22,72,0],[90,-180,22,29,96,1],[118,-190,21,21,122,0],[151,-208,29,24,154,2],[186,-182,26,25,114,1],[215,-225,24,24,170,2]]) {
      const material = stone[style];
      block(x, 2, z, w + 2, 4, d + 2, trim);
      if (style === 2) {
        cylinder(x, h * .46 + 3, z, w / 2, h * .92, material);
        cylinder(x, h * .96 + 3, z, w * .38, h * .08, material);
        cylinder(x, h + 3.3, z, w * .38 + .2, .6, trim);
      } else {
        let bottom = 4;
        for (const [ratio, scale] of style === 1 ? [[.64,1],[.2,.83],[.1,.64],[.06,.42]] : [[.82,1],[.14,.82],[.04,.5]]) {
          const height = h * ratio; block(x, bottom + height / 2, z, w * scale, height, d * scale, material);
          bottom += height; block(x, bottom, z, w * scale + .5, .55, d * scale + .5, trim);
        }
      }
      for (let floor = 14; floor < h * .62; floor += 13.2)
        if (style === 2) cylinder(x, floor, z, w / 2 + .12, .28, trim); else block(x, floor, z, w + .25, .28, d + .25, trim);
    }
    for (let row = 0; row < 2; row++) for (let column = -18; column <= 18; column++) {
      const x = column * 17 + (this.random() - .5) * 6, z = -260 - row * 64 - this.random() * 24;
      const w = 10 + this.random() * 7, d = 11 + this.random() * 10;
      const h = Math.abs(x) < 64 ? 5 + this.random() * 7 : 24 + this.random() * 32 + Math.abs(x) * .19;
      block(x, h / 2, z, w, h, d, stone[(column + 18 + row) % stone.length]);
      block(x, h + .35, z, w + .3, .7, d + .3, trim);
      if (column % 3 === 0) block(x, h + 2.1, z, w * .55, 3.5, d * .55, stone[(column + 18 + row) % stone.length]);
    }
    const bank = this.box(0, -.85, -149, 640, 1.3, 17, park); bank.castShadow = bank.receiveShadow = false;
  }
  private skyMaterial(): THREE.ShaderMaterial {
    const sky = new THREE.ShaderMaterial({ side: THREE.BackSide, depthWrite: false, toneMapped: false,
      uniforms: { rise: { value: 0 } },
      vertexShader: `varying vec3 direction; void main(){ direction=position; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }`,
      fragmentShader: `varying vec3 direction; uniform float rise;
        float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
        float noise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.0-2.0*f);return mix(mix(hash(i),hash(i+vec2(1,0)),f.x),mix(hash(i+vec2(0,1)),hash(i+vec2(1)),f.x),f.y);}
        float cloud(vec2 p){float v=0.0,a=.5;for(int i=0;i<5;i++){v+=noise(p)*a;p=p*2.04+13.7;a*=.5;}return v;}
        void main(){vec3 d=normalize(direction);float h=max(0.0,d.y);float front=pow(max(0.0,-d.z),3.0);
          vec3 dawn=mix(vec3(.38,.50,.52),vec3(.07,.15,.29),smoothstep(0.0,.7,h));
          vec3 gold=mix(vec3(1.0,.43,.12),vec3(.12,.24,.42),smoothstep(.015,.65,h));
          float n=cloud(vec2(atan(d.x,-d.z)*6.0,h*19.0));
          vec3 bands=mix(vec3(.18,.31,.30),vec3(.46,.11,.26),smoothstep(.32,.7,n));
          gold=mix(gold,bands,smoothstep(.1,.6,h)*.62);
          float wisps=smoothstep(.46,.7,n)*smoothstep(.025,.2,h);
          vec3 sky=mix(dawn,gold,rise*.87);
          sky=mix(sky,mix(vec3(.46,.55,.59),vec3(1.0,.56,.27),rise),wisps*(.27+rise*.23));
          vec3 sunDir=normalize(vec3(.1,.065,-1.0));float angle=length(d-sunDir);
          float halo=exp(-angle*8.0);sky+=vec3(1.0,.46,.12)*halo*(.12+rise*.8);
          sky+=vec3(1.0,.87,.52)*(1.0-smoothstep(.011,.015,angle))*(.3+rise*2.1);
          sky+=vec3(.6,.19,.12)*front*exp(-h*20.0)*rise*.25;
          gl_FragColor=vec4(sky,1.0);
          #include <colorspace_fragment>
        }` });
    this.materials.add(sky); return sky;
  }
  update(encounter?: TrilogyEpilogueEncounter): void {
    this.rise = gardenSunrise(encounter); this.sky.uniforms.rise.value = this.rise;
    (this.water.material as THREE.ShaderMaterial).uniforms.parkTime.value = encounter?.total ?? 0;
    this.sun.intensity = 1.6 + this.rise * 1.6;
    this.sun.color.set(0xdce7eb).lerp(new THREE.Color(0xffc186), this.rise);
    this.fill.intensity = 1.05 + this.rise * .15;
  }
  atmosphere(): { color: number; ambient: number; sun: number } { return { color: 0xffd4ad, ambient: .55 + this.rise * .1, sun: 0 }; }
  dispose(): void {
    this.disposed = true; this.treeInstances.forEach(instances => instances.dispose());
    this.group.removeFromParent(); this.group.clear(); this.water.dispose(); this.sun.dispose(); this.fill.dispose();
    this.geometries.forEach(geometry => geometry.dispose()); this.materials.forEach(material => material.dispose()); this.textures.forEach(texture => texture.dispose());
  }
}
