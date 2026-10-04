import * as THREE from 'three';
import { Reflector } from 'three/addons/objects/Reflector.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { SUNRISE_GARDEN, gardenSunrise, type TrilogyEpilogueEncounter } from '@auto_matrix/shared';
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
  private fill = new THREE.HemisphereLight(0xaecbdc, 0x4a4933, .65);
  private rise = 0;
  private seed = 2003;

  constructor(root: THREE.Group) {
    this.group.name = 'sunrise-waterfront-park'; root.add(this.group);
    this.sky = this.skyMaterial();
    const dome = this.mesh(new THREE.SphereGeometry(850, 48, 24), this.sky, 0, 0, 0);
    dome.name = 'sati-sunrise'; dome.castShadow = dome.receiveShadow = false; dome.renderOrder = -10;
    const grass = this.pbr('park', 'grass_ground', 0x91aa65, 22, 24);
    const pavement = this.pbr('surfaces', 'concrete_pavement_03', 0xa9a895, 18, 1);
    const soil = this.material(0x282f22, 1), stone = this.material(0x9f9b8a, .94);
    const lawn = this.mesh(new THREE.PlaneGeometry(210, 150), grass, 0, -.015, 39); lawn.rotation.x = -Math.PI / 2;
    // A continuous promenade and low stone retaining edge; the shared shore blocks walking on water.
    const path = this.mesh(new THREE.PlaneGeometry(210, 6.6), pavement, 0, 0, -31.9); path.rotation.x = -Math.PI / 2;
    this.box(0, -.48, SUNRISE_GARDEN.shore, 210, 1, .75, stone);
    this.box(0, .015, SUNRISE_GARDEN.shore + .24, 210, .11, .95, stone);
    for (let x = -100; x <= 100; x += 3.6) this.box(x, .006, -32, .018, .012, 6.7, soil);
    this.bench(); this.vegetation(); this.city();
    const waterGeometry = new THREE.PlaneGeometry(900, 700); this.geometries.add(waterGeometry);
    this.water = new Reflector(waterGeometry, { color: 0x94a8ae, textureWidth: 768, textureHeight: 512, clipBias: .003, multisample: 0 });
    this.water.name = 'park-reflecting-water'; this.water.rotation.x = -Math.PI / 2;
    this.water.position.set(0, -.72, SUNRISE_GARDEN.shore - 350); this.group.add(this.water);
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
    const mesh = this.mesh(new THREE.CylinderGeometry(r2, r1, vector.length(), 9, 3), material, midpoint.x, midpoint.y, midpoint.z);
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
    const leaves = new THREE.InstancedMesh(leaf, foliage, SUNRISE_GARDEN.trees.length * 2200);
    leaves.name = 'park-leaf-canopies'; leaves.castShadow = leaves.receiveShadow = true;
    const transform = new THREE.Object3D(), color = new THREE.Color(); let index = 0;
    for (const [x, z, scale] of SUNRISE_GARDEN.trees) {
      const base = new THREE.Vector3(x, 0, z), crown = new THREE.Vector3(x + scale * .5, 8 * scale, z);
      this.branch(base, crown, .62 * scale, .17 * scale, bark);
      for (let i = 0; i < 10; i++) {
        const angle = i * 2.4, radius = (3.2 + this.random() * 2.6) * scale;
        const start = new THREE.Vector3(x, (3.5 + i * .4) * scale, z);
        const end = new THREE.Vector3(x + Math.cos(angle) * radius, (7 + this.random() * 3) * scale, z + Math.sin(angle) * radius);
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
    leaves.computeBoundingSphere(); this.group.add(leaves);
    const blade = new THREE.BufferGeometry();
    blade.setAttribute('position', new THREE.Float32BufferAttribute([-.025, 0, 0, .025, 0, 0, .016, .18, .012, -.018, .16, .008, .045, .32, .05], 3));
    blade.setIndex([0, 1, 2, 0, 2, 3, 3, 2, 4]); blade.computeVertexNormals(); this.geometries.add(blade);
    const grass = this.material(0x5d713c, 1); grass.side = THREE.DoubleSide;
    const blades = new THREE.InstancedMesh(blade, grass, 18000); blades.name = 'park-grass-blades'; blades.receiveShadow = true;
    for (let i = 0; i < blades.count; i++) {
      const x = (this.random() - .5) * 105, z = -28 + this.random() * 90;
      transform.position.set(x, 0, z); transform.rotation.set(0, this.random() * 6.28, (this.random() - .5) * .22);
      const clearBench = Math.abs(x + 7) < 4.3 && Math.abs(z + 20) < 1.9;
      transform.scale.setScalar(clearBench ? 0 : .4 + this.random() * .65); transform.updateMatrix(); blades.setMatrixAt(i, transform.matrix);
      blades.setColorAt(i, color.setHSL(.2 + this.random() * .05, .35, .2 + this.random() * .12));
    }
    blades.computeBoundingSphere(); this.group.add(blades);
  }
  private city(): void {
    const stone = [this.material(0x626b6c, .8), this.material(0x84816f, .85), this.material(0x444f59, .7)];
    const windows = this.material(0x859aa4, .24, .6), trim = this.material(0x353f43, .7), park = this.material(0x253b29, .96);
    for (let i = 0; i < 48; i++) {
      const side = i < 24 ? -1 : 1, column = i % 24;
      const x = side * (35 + column * 10.3), z = -152 - this.random() * 100;
      const width = 9 + this.random() * 9, depth = 9 + this.random() * 10, height = 18 + this.random() * 65;
      this.box(x, height / 2 - 1, z, width, height, depth, stone[i % 3]);
      this.box(x, height - .5, z, width + .5, 1, depth + .5, trim);
      if (i % 4 === 0) this.box(x, height + 3, z, width * .62, 6, depth * .64, stone[i % 3]);
      for (let floor = 3; floor < height - 2; floor += 3.1) {
        this.box(x, floor, z + depth / 2 + .02, width - .7, 1.6, .08, windows);
        this.box(x, floor + 1.12, z + depth / 2 + .07, width + .12, .13, .13, trim);
      }
      for (let col = -width / 2 + 1.2; col < width / 2; col += 2.4)
        this.box(x + col, height / 2, z + depth / 2 + .12, .16, height - 1, .15, stone[i % 3]);
    }
    this.box(0, -.85, -149, 640, 1.3, 17, park);
    for (let i = 0; i < 100; i++) {
      const crown = this.mesh(new THREE.IcosahedronGeometry(2.3 + this.random() * 2.6, 2), park, -310 + i * 6.2, 1 + this.random() * 3, -146 - this.random() * 10);
      crown.scale.y = 1.2; crown.castShadow = false;
    }
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
          vec3 dawn=mix(vec3(.26,.40,.47),vec3(.025,.09,.19),smoothstep(0.0,.7,h));
          vec3 gold=mix(vec3(1.0,.43,.12),vec3(.12,.24,.42),smoothstep(.015,.65,h));
          float n=cloud(vec2(atan(d.x,-d.z)*6.0,h*19.0));
          vec3 bands=mix(vec3(.18,.31,.30),vec3(.46,.11,.26),smoothstep(.32,.7,n));
          gold=mix(gold,bands,smoothstep(.1,.6,h)*.62);
          float wisps=smoothstep(.46,.7,n)*smoothstep(.025,.2,h);
          vec3 sky=mix(dawn,gold,rise*.87);
          sky=mix(sky,mix(vec3(.34,.42,.47),vec3(1.0,.56,.27),rise),wisps*.5);
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
    this.sun.intensity = 1.15 + this.rise * 1.6;
    this.sun.color.set(0xdce7eb).lerp(new THREE.Color(0xffc186), this.rise);
    this.fill.intensity = .7 + this.rise * .1;
  }
  atmosphere(): { color: number; ambient: number; sun: number } { return { color: 0xffd4ad, ambient: .42, sun: 0 }; }
  dispose(): void {
    this.group.removeFromParent(); this.group.clear(); this.water.dispose(); this.sun.dispose(); this.fill.dispose();
    this.geometries.forEach(geometry => geometry.dispose()); this.materials.forEach(material => material.dispose()); this.textures.forEach(texture => texture.dispose());
  }
}
