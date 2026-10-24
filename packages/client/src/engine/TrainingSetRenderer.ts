import * as THREE from 'three';
import type { FilmJourney } from '@auto_matrix/shared';
import { FILM_SETS, JUMP_STREET, JUMP_TOWERS, jumpImpactPose, RED_DRESS_PLAZA, RED_DRESS_SPILLWAY, RED_DRESS_POOL_OUTLINE, RED_DRESS_POOL_INSIDE, RED_DRESS_SPILLWAY_BODY, type PlazaPoint } from '@auto_matrix/shared';
import { RedDressCrowd } from './RedDressCrowd.js';
import { batchStaticGeometry } from './StaticGeometry.js';

/** Film-one training programs share a clean simulation language, but each
 * space has its own physical set and lighting rather than the generic atlas. */
export class TrainingSetRenderer {
  private geometries = new Set<THREE.BufferGeometry>();
  private materials = new Set<THREE.Material>();
  private textures = new Set<THREE.Texture>();
  private impactDepth = { value: 0 };
  private impactCenter = { value: new THREE.Vector2() };
  private lights = new Set<THREE.Light>();
  private disposed = false;
  private crowd: THREE.Group[] = [];
  private pedestrians?: RedDressCrowd;
  private waterClock = { value: 0 };
  private skylineLights: THREE.Mesh[] = [];
  private programLight?: THREE.PointLight;
  private wind?: THREE.Group;
  private wood = this.material(new THREE.MeshStandardMaterial({ color: 0x4c3425, roughness: .72 }));
  private darkWood = this.material(new THREE.MeshStandardMaterial({ color: 0x211b17, roughness: .8 }));
  private paper = this.material(new THREE.MeshPhysicalMaterial({ color: 0xe5dfc9, roughness: .68, transmission: .04 }));
  private stone = this.material(new THREE.MeshStandardMaterial({ color: 0x8a908a, roughness: .88 }));
  private dark = this.material(new THREE.MeshStandardMaterial({ color: 0x252c2d, roughness: .75, metalness: .16 }));
  private metal = this.material(new THREE.MeshStandardMaterial({ color: 0x596463, roughness: .35, metalness: .78 }));
  private glass = this.material(new THREE.MeshPhysicalMaterial({ color: 0x839b9b, roughness: .16, metalness: .28, transparent: true, opacity: .5, depthWrite: false }));
  private glow = this.material(new THREE.MeshBasicMaterial({ color: 0xc9e7d5, toneMapped: false }));

  constructor(private root: THREE.Group, readonly sceneId: string) {
    if (sceneId === 'm1_dojo') this.dojo();
    else if (sceneId === 'm1_jump') this.rooftops();
    else this.plaza();
  }

  private material<T extends THREE.Material>(value: T): T { this.materials.add(value); return value; }
  private geometry<T extends THREE.BufferGeometry>(value: T): T { this.geometries.add(value); return value; }
  private surface(material: THREE.MeshStandardMaterial, name: string, repeat: number, folder = 'film-materials'): void {
    if (typeof document === 'undefined') return;
    const loader = new THREE.TextureLoader();
    for (const [suffix, field] of [['color', 'map'], ['normal', 'normalMap'], ['roughness', 'roughnessMap']] as const) {
      const texture = loader.load(`/assets/${folder}/${name}-${suffix}.jpg`, loaded => { if (this.disposed || !this.materials.has(material)) loaded.dispose(); });
      texture.wrapS = texture.wrapT = THREE.RepeatWrapping; texture.repeat.set(repeat, repeat); texture.anisotropy = 4;
      if (field === 'map') texture.colorSpace = THREE.SRGBColorSpace;
      material[field] = texture; this.textures.add(texture);
    }
    material.normalScale.set(.32, .32); material.needsUpdate = true;
  }
  private cityMatte(parent: THREE.Object3D): void {
    const material = this.material(new THREE.MeshBasicMaterial({ color: 0xb6c5cc, fog: false, side: THREE.DoubleSide, transparent: true, depthWrite: false }));
    material.onBeforeCompile = shader => {
      shader.fragmentShader = shader.fragmentShader.replace('#include <map_fragment>', '#include <map_fragment>\n#ifdef USE_MAP\n diffuseColor.a *= (1.0 - smoothstep(0.64, 0.87, vMapUv.y)) * smoothstep(0.0, 0.1, vMapUv.x) * (1.0 - smoothstep(0.9, 1.0, vMapUv.x));\n#endif');
    };
    if (typeof document !== 'undefined') {
      const texture = new THREE.TextureLoader().load('/assets/rooftops/training-city-matte-v1.png', loaded => { if (this.disposed || !this.materials.has(material)) loaded.dispose(); });
      texture.colorSpace = THREE.SRGBColorSpace; texture.anisotropy = 8; material.map = texture; material.needsUpdate = true; this.textures.add(texture);
    }
    for (const [x, z, rotation, name] of [[0, -160, 0, 'jump-city-matte'], [0, 160, Math.PI, 'jump-city-reverse-matte'],
      [-160, 0, Math.PI / 2, 'jump-city-west-matte'], [160, 0, -Math.PI / 2, 'jump-city-east-matte']] as const) {
      const matte = this.mesh(parent, new THREE.PlaneGeometry(330, 186), material, name); matte.position.set(x, 26, z); matte.rotation.y = rotation; matte.castShadow = false; matte.receiveShadow = false;
    }
  }
  private plazaMatte(parent: THREE.Object3D): void {
    const material = this.material(new THREE.MeshBasicMaterial({ color: 0xd8ddd7, fog: false, side: THREE.DoubleSide }));
    if (typeof document !== 'undefined') {
      const texture = new THREE.TextureLoader().load('/assets/plaza/red-dress-plaza-matte-v1.png', loaded => { if (this.disposed || !this.materials.has(material)) loaded.dispose(); });
      texture.colorSpace = THREE.SRGBColorSpace; texture.anisotropy = 8; material.map = texture; material.needsUpdate = true; this.textures.add(texture);
    }
    for (const [x, z, rotation, name] of [[0, -160, 0, 'red-dress-city-matte'], [0, 160, Math.PI, 'red-dress-city-reverse-matte'],
      [-160, 0, Math.PI / 2, 'red-dress-city-west-matte'], [160, 0, -Math.PI / 2, 'red-dress-city-east-matte']] as const) {
      const matte = this.mesh(parent, new THREE.PlaneGeometry(330, 186), material, name); matte.position.set(x, 28, z); matte.rotation.y = rotation; matte.castShadow = false; matte.receiveShadow = false;
    }
  }
  private mesh(parent: THREE.Object3D, geometry: THREE.BufferGeometry, material: THREE.Material, name?: string): THREE.Mesh {
    const mesh = new THREE.Mesh(this.geometry(geometry), material); mesh.castShadow = mesh.receiveShadow = true;
    if (name) mesh.name = name; parent.add(mesh); return mesh;
  }
  private box(parent: THREE.Object3D, material: THREE.Material, x: number, y: number, z: number, width: number, height: number, depth: number, name?: string): THREE.Mesh {
    const mesh = this.mesh(parent, new THREE.BoxGeometry(width, height, depth), material, name); mesh.position.set(x, y, z); return mesh;
  }
  private cylinder(parent: THREE.Object3D, material: THREE.Material, x: number, y: number, z: number, radius: number, height: number, radial = 20, name?: string): THREE.Mesh {
    const mesh = this.mesh(parent, new THREE.CylinderGeometry(radius, radius, height, radial), material, name); mesh.position.set(x, y, z); return mesh;
  }
  private light(light: THREE.Light, name: string): void {
    light.name = name; this.root.add(light); this.lights.add(light);
    if (light instanceof THREE.DirectionalLight) {
      light.target.name = `${name}-target`; this.root.add(light.target);
      Object.assign(light.shadow.camera, { left: -48, right: 48, top: 48, bottom: -48, near: .5, far: 180 });
      light.shadow.camera.updateProjectionMatrix();
    }
  }

  private dojo(): void {
    const { width, depth, height } = FILM_SETS.film_kungfu_dojo;
    const set = new THREE.Group(); set.name = 'training-dojo-set'; this.root.add(set);
    const cedar = this.material(new THREE.MeshStandardMaterial({ color: 0xe2d4c0, roughness: .78 }));
    const border = this.material(new THREE.MeshStandardMaterial({ color: 0x34372a, roughness: .92, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 }));
    const plaster = this.material(new THREE.MeshStandardMaterial({ color: 0xa99a72, roughness: .94 }));
    const shoji = this.material(new THREE.MeshStandardMaterial({ color: 0xe1dfcb, roughness: .9, emissive: 0xc9c8b5, emissiveIntensity: .22 }));
    this.surface(cedar, 'old_wood_floor', 1); this.surface(plaster, 'white_plaster_02', 2);
    shoji.map = plaster.map; shoji.normalMap = plaster.normalMap; shoji.roughnessMap = plaster.roughnessMap; shoji.normalScale.set(.06, .06);

    // Fine woven fibres share one mipmapped texture; geometry stays flat at
    // the shared feet plane, including every cloth border and timber aisle.
    const size = 256, fibres = new Uint8Array(size * size * 4);
    for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
      const value = 227 + Math.sin(y * Math.PI / 2) * 12 + Math.sin(x * .19 + y * .04) * 5 + ((x * 13 + y * 7) % 11);
      const at = (y * size + x) * 4; fibres[at] = fibres[at + 1] = fibres[at + 2] = value; fibres[at + 3] = 255;
    }
    const weave = new THREE.DataTexture(fibres, size, size); weave.colorSpace = THREE.SRGBColorSpace;
    weave.wrapS = weave.wrapT = THREE.RepeatWrapping; weave.repeat.set(10, 18); weave.anisotropy = 8;
    weave.generateMipmaps = true; weave.minFilter = THREE.LinearMipmapLinearFilter; weave.magFilter = THREE.LinearFilter; weave.needsUpdate = true; this.textures.add(weave);
    const mats = [0xbdb58c, 0xb8b186, 0xc1b98f].map(color => this.material(new THREE.MeshStandardMaterial({ color, roughness: .96, map: weave, bumpMap: weave, bumpScale: .025, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 })));
    const floor = new THREE.Group(); floor.name = 'dojo-floor'; set.add(floor);
    const matWidth = (width - 6.8) / 6, matDepth = (depth - 8.4) / 4, edge = .14;
    const halfX = matWidth * 3, halfZ = matDepth * 2;
    this.box(floor, cedar, 0, -.12, 0, width, .24, depth);
    for (let column = 0; column < 6; column++) for (let row = 0; row < 4; row++) {
      const x = -halfX + (column + .5) * matWidth, z = -halfZ + (row + .5) * matDepth;
      this.box(floor, mats[(column + row * 2) % mats.length], x, -.06, z, matWidth - edge * 2, .12, matDepth - edge * 2);
      for (const side of [-1, 1]) {
        this.box(floor, border, x + side * (matWidth - edge) / 2, -.06, z, edge, .12, matDepth);
        this.box(floor, border, x, -.06, z + side * (matDepth - edge) / 2, matWidth - edge * 2, .12, edge);
      }
    }

    const gallery = new THREE.Group(); gallery.name = 'dojo-upper-gallery'; set.add(gallery);
    const wall = (span: number, x: number, z: number, yaw: number, name: string, alcove = false) => {
      const face = new THREE.Group(); face.name = name; face.position.set(x, 0, z); face.rotation.y = yaw; set.add(face);
      const bays = Math.round(span / 8), bay = span / bays;
      // The room boundary is the same 0.6-unit inset used by filmBlocked.
      for (let index = 0; index <= bays; index++) {
        const at = -span / 2 + index * bay;
        this.box(face, cedar, at, alcove && index === bays / 2 ? 12.3 : 8.5, 0, 1.2, alcove && index === bays / 2 ? 9.4 : height, 1.2);
      }
      for (let index = 0; index < bays; index++) {
        const at = -span / 2 + (index + .5) * bay, clear = bay - 1.2;
        if (!alcove || Math.abs(at) > bay) {
          this.box(face, cedar, at, .45, .24, clear, .9, .72);
          this.box(face, shoji, at, 3.75, .48, clear, 5.7, .08);
          for (let y = 1.55; y < 6.6; y += .72) this.box(face, cedar, at, y, .5, clear, .065, .2);
          for (let offset = -clear / 2 + .47; offset < clear / 2; offset += .47) this.box(face, cedar, at + offset, 3.75, .5, .055, 5.7, .2);
          this.box(face, cedar, at, 5.5, .46, clear, .22, .28);
        }
        this.box(face, cedar, at, 10.05, .24, clear, 5.1, .72);
        for (let offset = -clear / 2 + .25; offset < clear / 2; offset += .5) this.box(face, this.darkWood, at + offset, 10.15, .56, .025, 4.6, .06);
        this.box(face, shoji, at, 14.5, .48, clear, 3.7, .08);
        for (let y = 13; y < 16.4; y += .65) this.box(face, cedar, at, y, .5, clear, .075, .2);
        for (let offset = -clear / 2 + .65; offset < clear / 2; offset += .65) this.box(face, cedar, at + offset, 14.5, .5, .075, 3.7, .2);
      }
      for (const [y, h] of [[6.95, .7], [7.65, .65], [12.6, .4], [16.65, .7]]) this.box(face, cedar, 0, y, .12, span, h, .96);
      const rail = new THREE.Group(); rail.name = name + '-gallery'; rail.position.copy(face.position); rail.rotation.y = yaw; gallery.add(rail);
      const railSpan = span - 6.7;
      this.box(rail, cedar, 0, 7.45, 2.05, span === width ? span - 7 : span - 1.2, .3, 2.9);
      for (const y of [7.85, 9.8]) this.box(rail, cedar, 0, y, 3.35, railSpan, .19, .22);
      for (let offset = -railSpan / 2 + .2; offset < railSpan / 2; offset += .42) this.box(rail, cedar, offset, 8.85, 3.35, .075, 1.9, .13);
      for (let offset = -railSpan / 2; offset <= railSpan / 2; offset += railSpan / bays) this.box(rail, cedar, offset, 8.7, 3.35, .22, 2.55, .24);
      if (!alcove) return;
      const niche = new THREE.Group(); niche.name = 'dojo-shrine-alcove'; face.add(niche);
      this.box(niche, plaster, 0, 3.3, -2.25, bay * 2 - 1.2, 6.6, .5);
      for (const side of [-1, 1]) this.box(niche, plaster, side * (bay - .65), 3.3, -.65, .1, 6.6, 3.2);
      this.box(niche, cedar, 0, .4, -.8, bay * 2 - 1.2, .8, 2.8);
      this.box(niche, cedar, 0, 2.1, -1.1, 4.1, .25, 1.6);
      for (const side of [-1, 1]) {
        this.box(niche, cedar, side * 1.45, 3.35, -1.1, .18, 2.3, .22);
        this.box(niche, cedar, side * 1.65, 1.4, -1.1, .2, 1.2, .25);
        this.cylinder(niche, shoji, side * .95, 2.55, -.8, .23, .6, 16);
        this.cylinder(niche, this.darkWood, side * .95, 2.9, -.8, .12, .15, 16);
      }
      this.box(niche, cedar, 0, 4.5, -1.15, 4.8, .35, 1.9);
      this.box(niche, this.darkWood, 0, 4.75, -1.15, 5.2, .15, 2.1);
      const scrollPaper = this.material(new THREE.MeshStandardMaterial({ color: 0xc8bb94, roughness: .96, side: THREE.DoubleSide }));
      for (const side of [-1, 1]) {
        const scroll = this.mesh(niche, new THREE.PlaneGeometry(1.7, 4.5, 1, 12), scrollPaper, `dojo-alcove-scroll-${side}`); scroll.position.set(side * 5.2, 3.45, -1.93);
        for (const y of [1.15, 5.75]) { const roller = this.cylinder(niche, cedar, side * 5.2, y, -1.9, .07, 2, 12); roller.rotation.z = Math.PI / 2; }
      }
      // Wall-mounted training weapons remain behind the collision boundary.
      for (const side of [-1, 1]) {
        const rack = new THREE.Group(); rack.name = `dojo-weapon-rack-${side}`; rack.position.set(side * (bay * 2), 0, .1); face.add(rack);
        for (const x of [-1.9, 1.9]) this.box(rack, this.darkWood, x, 2.1, .1, .18, 4.2, .45);
        for (let y = 1.5; y <= 3.8; y += .85) { const staff = this.cylinder(rack, cedar, 0, y, .28, .065, 5.2, 10); staff.rotation.z = Math.PI / 2; }
      }
    };
    wall(width, 0, -depth / 2, 0, 'dojo-north-wall', true);
    wall(width, 0, depth / 2, Math.PI, 'dojo-south-wall');
    wall(depth, -width / 2, 0, Math.PI / 2, 'dojo-west-wall');
    wall(depth, width / 2, 0, -Math.PI / 2, 'dojo-east-wall');
    const ceiling = new THREE.Group(); ceiling.name = 'dojo-coffered-ceiling'; set.add(ceiling);
    this.box(ceiling, this.darkWood, 0, height + .15, 0, width + 1.2, .3, depth + 1.2);
    for (let z = -depth / 2; z <= depth / 2; z += depth / 8) this.box(ceiling, cedar, 0, height - .25, z, width, .5, .38);
    for (let x = -width / 2; x <= width / 2; x += width / 6) this.box(ceiling, cedar, x, height - .1, 0, .25, .35, depth);
    set.traverse(object => {
      if (!(object instanceof THREE.Mesh) || object.material !== cedar || !(object.geometry instanceof THREE.BoxGeometry)) return;
      const { width, height, depth } = object.geometry.parameters, position = object.geometry.attributes.position, normal = object.geometry.attributes.normal, uv = object.geometry.attributes.uv;
      const lengths = [width, height, depth], long = lengths.indexOf(Math.max(...lengths));
      for (let index = 0; index < position.count; index++) {
        const face = [Math.abs(normal.getX(index)), Math.abs(normal.getY(index)), Math.abs(normal.getZ(index))].indexOf(1);
        const axes = [0, 1, 2].filter(axis => axis !== face), along = axes.includes(long) ? long : axes[0], across = axes.find(axis => axis !== along)!;
        uv.setXY(index, position.getComponent(index, along) / 6, position.getComponent(index, across) / 2);
      }
      uv.needsUpdate = true;
    });
    batchStaticGeometry(set, new Set()).forEach(geometry => this.geometries.add(geometry));

    const sun = new THREE.DirectionalLight(0xffefd8, 1.65); sun.position.set(-width / 2 + 2, height - 2, 7); sun.castShadow = true;
    this.light(sun, 'dojo-training-light'); sun.target.position.set(5, 0, -8);
    sun.shadow.mapSize.set(2048, 2048); sun.shadow.bias = -.00008; sun.shadow.normalBias = .025;
    Object.assign(sun.shadow.camera, { left: -40, right: 40, top: 40, bottom: -40, near: .5, far: 100 }); sun.shadow.camera.updateProjectionMatrix();
    this.light(new THREE.HemisphereLight(0xdce1d5, 0x383325, .35), 'dojo-window-fill');
  }

  private rooftopUnit(parent: THREE.Object3D, x: number, z: number, index: number): void {
    const unit = new THREE.Group(); unit.position.set(x, 0, z); parent.add(unit);
    this.box(unit, this.dark, 0, 1.2, 0, 5.5, 2.4, 4.2, `jump-hvac-${index}`);
    for (let i = -2; i <= 2; i++) this.box(unit, this.metal, i * .9, 1.25, 2.13, .55, 1.35, .08);
    const fan = this.mesh(unit, new THREE.TorusGeometry(1.05, .12, 8, 30), this.metal); fan.position.y = 2.48; fan.rotation.x = Math.PI / 2;
  }

  private rooftops(): void {
    const set = new THREE.Group(); set.name = 'training-jump-set'; this.root.add(set);
    const tar = this.material(new THREE.MeshStandardMaterial({ color: 0x5a5e5a, roughness: .92 }));
    const concrete = this.material(new THREE.MeshStandardMaterial({ color: 0x777a73, roughness: .9 }));
    const roofMetal = this.material(new THREE.MeshStandardMaterial({ color: 0x4c5856, roughness: .48, metalness: .68 }));
    const warning = this.material(new THREE.MeshStandardMaterial({ color: 0xc19649, roughness: .64, metalness: .1 }));
    this.surface(tar, 'asphalt_02', 7, 'surfaces'); this.surface(concrete, 'damaged_plaster', 5); this.surface(roofMetal, 'metal_plate', 3);
    this.box(set, tar, 0, -.12, 17, 50, .24, 60, 'jump-near-roof');
    this.box(set, tar, 0, -.12, -38.5, 50, .24, 17, 'jump-far-roof');
    this.box(set, warning, 0, .02, -10.8, 18, .025, .32, 'jump-takeoff-line');
    for (const z of [-13, -30]) {
      this.box(set, concrete, -20, .75, z, 10, 1.5, .7, `jump-parapet-left-${z}`);
      this.box(set, concrete, 20, .75, z, 10, 1.5, .7, `jump-parapet-right-${z}`);
    }
    for (const side of [-1, 1]) this.box(set, concrete, side * 24.65, .65, 7, .7, 1.3, 80);
    this.rooftopUnit(set, -15, 16, 0); this.rooftopUnit(set, 15, 31, 1); this.rooftopUnit(set, 13, -39, 2);
    const service = new THREE.Group(); service.name = 'jump-service-bank'; service.position.set(-10, 0, 34); set.add(service);
    this.box(service, concrete, 0, 2.45, 0, 10, 4.9, 7.5, 'jump-service-hut');
    this.box(service, roofMetal, 0, 5.1, 0, 11.3, .34, 8.6, 'jump-service-hut-roof');
    this.box(service, this.dark, 0, 1.75, 3.82, 2.6, 3.5, .12, 'jump-service-door');
    for (const x of [-4.25, 4.25]) this.cylinder(service, roofMetal, x, 2.2, -2.6, .26, 4.4, 10, 'jump-service-vent');
    for (let y = .8; y < 4.8; y += .72) this.box(service, roofMetal, -5.2, y, -2.7, .12, .11, 2.4, 'jump-service-ladder-rung');
    for (const [x, z, height] of [[-17, 4, 8], [18, 8, 6], [-14, 33, 5]] as const) {
      const tank = this.cylinder(set, this.metal, x, height / 2 + 1, z, 2.4, height, 20, 'jump-water-tank');
      tank.scale.x = 1.18; for (const dx of [-1.7, 1.7]) this.box(set, this.dark, x + dx, 1, z, .22, 2, .22);
    }
    this.wind = new THREE.Group(); this.wind.name = 'jump-wind-lines'; set.add(this.wind);
    for (let i = 0; i < 14; i++) {
      const line = this.box(this.wind, this.glow, -20 + i * 3.1, 3 + i % 4 * 1.4, -21.5, 1.8, .025, .025);
      line.material = this.glow; line.userData.phase = i * .73;
    }
    const city = new THREE.Group(); city.name = 'jump-city-canyon'; set.add(city);
    const facade = this.material(new THREE.MeshStandardMaterial({ color: 0x56605d, roughness: .82, metalness: .08 }));
    const windows = this.material(new THREE.MeshStandardMaterial({ color: 0x182c30, roughness: .32, metalness: .48, emissive: 0x071111, emissiveIntensity: .32 }));
    this.surface(facade, 'damaged_plaster', 4);
    for (let index = 0; index < 16; index++) {
      const side = index % 2 ? 1 : -1; const width = 14 + index % 3 * 3; const depth = 12 + index % 2 * 3;
      const x = side * (47 + index % 3 * 12); const z = -48 - Math.floor(index / 2) * 16; const height = 15 + index % 5 * 4;
      this.box(city, facade, x, height / 2, z, width, height, depth, 'jump-city-building');
      for (let y = 3; y < height - 2; y += 3.2) {
        const pane = this.box(city, windows, x - side * (width / 2 + .045), y, z, .09, 1.35, depth - 1.2, 'jump-city-window-band');
        this.skylineLights.push(pane);
      }
    }
    const distant = new THREE.Group(); distant.name = 'jump-distant-roofline'; distant.position.z = -88; set.add(distant);
    for (const side of [-1, 1]) {
      const wing = new THREE.Group(); wing.name = `jump-distant-${side < 0 ? 'west' : 'east'}-wing`; wing.position.set(side * 48, 0, side * 5); distant.add(wing);
      this.box(wing, facade, 0, 9, 0, 20, 18, 14, 'jump-distant-building');
      for (let y = 3; y < 16; y += 3.2) this.box(wing, windows, -side * 10.05, y, 0, .09, 1.35, 12.5, 'jump-distant-window-band');
      this.cylinder(wing, roofMetal, -side * 3.4, 21, 0, 1.3, 5.5, 16, 'jump-distant-tank');
      this.box(wing, concrete, side * 5.2, 20.1, 0, 7.2, .35, 9.4, 'jump-distant-roof');
    }
    for (const tower of JUMP_TOWERS) {
      this.box(set, facade, 0, JUMP_STREET.base / 2, tower.z, 50, -JUMP_STREET.base, tower.depth, 'jump-tower-body');
      const geometry = new THREE.BoxGeometry(2.1, 1.75, .1); this.geometries.add(geometry);
      const panes = new THREE.InstancedMesh(geometry, windows, 80), matrix = new THREE.Matrix4();
      const face = tower.z > 0 ? tower.z - tower.depth / 2 : tower.z + tower.depth / 2;
      for (let row = 0; row < 10; row++) for (let col = 0; col < 8; col++) {
        matrix.makeTranslation(-20.5 + col * 5.85, -3.4 - row * 3.8, face + (tower.z > 0 ? -.06 : .06)); panes.setMatrixAt(row * 8 + col, matrix);
      }
      panes.name = 'jump-tower-windows'; panes.castShadow = false; panes.receiveShadow = true; set.add(panes);
    }
    const canyon = new THREE.Group(); canyon.name = 'jump-canyon-floor'; canyon.position.set(0, JUMP_STREET.base, -21); set.add(canyon);
    for (const side of [-1, 1]) this.box(canyon, tar, side * 43.5, 0, 0, 69, .18, 176, 'jump-canyon-street-grid');
    const street = tar.clone(); this.materials.add(street);
    street.onBeforeCompile = shader => {
      shader.uniforms.jumpDepth = this.impactDepth; shader.uniforms.jumpCenter = this.impactCenter;
      shader.vertexShader = shader.vertexShader.replace('#include <common>', '#include <common>\nuniform float jumpDepth; uniform vec2 jumpCenter;')
        .replace('#include <beginnormal_vertex>', '#include <beginnormal_vertex>\nvec2 jumpNormalOffset = position.xy - jumpCenter; float jumpGradient = 0.4 * jumpDepth * exp(-0.2 * dot(jumpNormalOffset, jumpNormalOffset)); objectNormal = normalize(vec3(jumpGradient * jumpNormalOffset, 1.0));')
        .replace('#include <begin_vertex>', '#include <begin_vertex>\nvec2 jumpOffset = transformed.xy - jumpCenter; transformed.z += jumpDepth * exp(-0.2 * dot(jumpOffset, jumpOffset));');
    };
    const avenue = this.mesh(canyon, new THREE.PlaneGeometry(18, 176, 24, 128), street, 'jump-canyon-avenue');
    avenue.rotation.x = -Math.PI / 2; avenue.position.y = JUMP_STREET.surface;
    for (const [x, z, width, height, depth] of [[-47, -32, 26, 14, 29], [-43, 29, 33, 20, 25], [45, -22, 31, 17, 35], [49, 35, 22, 12, 26]] as const) {
      this.box(canyon, facade, x, height / 2, z, width, height, depth, 'jump-canyon-block');
      this.box(canyon, windows, x, height * .6, z - depth / 2 - .05, width - 2, 2.2, .1, 'jump-canyon-window-band');
    }
    this.cityMatte(set);
    this.programLight = new THREE.PointLight(0xdbe9de, 190, 48, 2); this.programLight.position.set(0, 12, -21); this.light(this.programLight, 'jump-gap-light');
    const sun = new THREE.DirectionalLight(0xffedcc, 2.3); sun.position.set(-22, 44, 30); sun.castShadow = true; this.light(sun, 'jump-program-sun');
  }

  private mannequin(parent: THREE.Object3D, x: number, z: number, color: number, index: number): void {
    const figure = new THREE.Group(); figure.name = `red-dress-crowd-${index}`; figure.position.set(x, 0, z); figure.rotation.y = index % 2 ? 0 : Math.PI; parent.add(figure); this.crowd.push(figure);
    figure.scale.setScalar(.86 + index % 3 * .06);
    const cloth = this.material(new THREE.MeshStandardMaterial({ color, roughness: .8 }));
    const skin = this.material(new THREE.MeshStandardMaterial({ color: index % 3 === 0 ? 0xb98265 : index % 3 === 1 ? 0xd5aa8a : 0x8a5f4a, roughness: .76 }));
    const hair = this.material(new THREE.MeshStandardMaterial({ color: index % 4 === 0 ? 0x211d1a : index % 4 === 1 ? 0x47382f : 0x181c1c, roughness: .9 }));
    this.mesh(figure, new THREE.CylinderGeometry(.38, .58, 2.45, 14), cloth).position.y = 2.25;
    this.cylinder(figure, skin, 0, 3.63, 0, .14, .32, 10);
    this.mesh(figure, new THREE.SphereGeometry(.32, 14, 10), skin).position.y = 4.05;
    const cap = this.mesh(figure, new THREE.SphereGeometry(.33, 14, 8), hair); cap.position.set(0, 4.22, -.025); cap.scale.y = .5;
    for (const side of [-1, 1]) {
      const leg = this.box(figure, this.dark, side * .2, .72, 0, .24, 1.44, .31); leg.rotation.x = (index + side) % 3 * .06; leg.userData.crowdLimb = true;
      const arm = this.box(figure, cloth, side * .54, 2.28, 0, .22, 2.05, .28); arm.rotation.z = side * .12; arm.userData.crowdLimb = true;
    }
    figure.userData.baseZ = z; figure.userData.phase = index * .77;
  }

  private plazaSolid(parent: THREE.Object3D, outline: readonly PlazaPoint[], bottom: number, top: number, material: THREE.Material, name: string, holes: readonly PlazaPoint[][] = []): THREE.Mesh {
    const path = (points: readonly PlazaPoint[]) => points.map(point => new THREE.Vector2(point.x, -point.z));
    const shape = new THREE.Shape(path(outline)); holes.forEach(hole => shape.holes.push(new THREE.Path(path(hole))));
    const mesh = this.mesh(parent, new THREE.ExtrudeGeometry(shape, { depth: top - bottom, bevelEnabled: false, steps: 1, curveSegments: 1 }), material, name);
    mesh.rotation.x = -Math.PI / 2; mesh.position.y = bottom; return mesh;
  }

  private plazaWater(falling: boolean): THREE.MeshStandardMaterial {
    const material = this.material(new THREE.MeshStandardMaterial({ color: 0x253a35, roughness: falling ? .28 : .12, metalness: .42, side: THREE.DoubleSide }));
    material.onBeforeCompile = shader => {
      shader.uniforms.trainingWaterTime = this.waterClock;
      shader.vertexShader = shader.vertexShader.replace('#include <common>', '#include <common>\nvarying vec2 vTrainingWaterUv;')
        .replace('#include <uv_vertex>', '#include <uv_vertex>\nvTrainingWaterUv = uv;');
      shader.fragmentShader = shader.fragmentShader.replace('#include <common>', '#include <common>\nuniform float trainingWaterTime; varying vec2 vTrainingWaterUv;')
        .replace('#include <color_fragment>', `#include <color_fragment>
          vec2 waterUv = vTrainingWaterUv;
          ${falling ? `
          float channel = floor(waterUv.x * 900.0);
          float seed = fract(sin(channel * 31.17) * 4375.87);
          float streak = pow(max(0.0, sin(waterUv.x * 3100.0 + sin(waterUv.y * 19.0 + seed * 10.0))), 8.0);
          float bead = pow(max(0.0, sin(waterUv.y * (85.0 + seed * 90.0) - trainingWaterTime * (15.0 + seed * 8.0) + seed * 50.0)), 5.0);
          float foam = smoothstep(.8, 1.0, waterUv.y) * (.3 + .7 * bead);
          diffuseColor.rgb = mix(vec3(.018, .034, .03), vec3(.7, .77, .72), clamp(streak * (.16 + .84 * bead) + foam * .6, 0.0, 1.0));`
          : `
          float ripple = sin(waterUv.x * 13.0 + waterUv.y * 21.0 - trainingWaterTime * 3.0) * sin(waterUv.y * 31.0 + trainingWaterTime * 2.0);
          diffuseColor.rgb *= .8 + .4 * ripple;`}
        `);
    };
    material.customProgramCacheKey = () => falling ? 'red-dress-falling-water-v1' : 'red-dress-pool-water-v1';
    return material;
  }

  private plaza(): void {
    const set = new THREE.Group(); set.name = 'training-red-dress-set'; this.root.add(set);
    const paving = this.material(new THREE.MeshStandardMaterial({ color: 0xb7b6a6, roughness: .91 }));
    const limestone = this.material(new THREE.MeshStandardMaterial({ color: 0x847d68, roughness: .85 }));
    const bankStone = this.material(new THREE.MeshStandardMaterial({ color: 0x665c4d, roughness: .83 }));
    const darkGranite = this.material(new THREE.MeshStandardMaterial({ color: 0x242b2b, roughness: .32, metalness: .12 }));
    const window = this.material(new THREE.MeshStandardMaterial({ color: 0x182728, roughness: .3, metalness: .48 }));
    const foliage = this.material(new THREE.MeshStandardMaterial({ color: 0x354937, roughness: .95 }));
    const benchWood = this.material(new THREE.MeshStandardMaterial({ color: 0x514635, roughness: .82 }));
    this.surface(bankStone, 'damaged_plaster', 3); this.surface(darkGranite, 'marble_01', 3); this.surface(benchWood, 'old_wood_floor', 3);
    bankStone.normalScale.set(.1, .1); darkGranite.normalScale.set(.05, .05);
    const size = 128, pixels = new Uint8Array(size * size * 4);
    for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
      const joint = x < 1 || y < 1, value = joint ? 112 : 221 + ((x * 19 + y * 7) % 23);
      const i = (y * size + x) * 4; pixels.set([value, value, value, 255], i);
    }
    const slabs = new THREE.DataTexture(pixels, size, size); slabs.colorSpace = THREE.SRGBColorSpace;
    slabs.wrapS = slabs.wrapT = THREE.RepeatWrapping; slabs.repeat.set(1 / 2.6, 1 / 1.8); slabs.generateMipmaps = true;
    slabs.minFilter = THREE.LinearMipmapLinearFilter; slabs.anisotropy = 8; slabs.needsUpdate = true; this.textures.add(slabs); paving.map = slabs;
    this.plazaSolid(set, [{ x: -31, z: -41 }, { x: 31, z: -41 }, { x: 31, z: 41 }, { x: -31, z: 41 }], -.24, 0, paving, 'red-dress-paving', [RED_DRESS_POOL_OUTLINE]);
    const route = new THREE.Group(); route.name = 'red-dress-attention-axis'; route.position.set(7, 0, -12); set.add(route);

    const fountain = new THREE.Group(); fountain.name = 'red-dress-fountain'; set.add(fountain);
    const f = RED_DRESS_PLAZA.fountain;
    this.plazaSolid(fountain, RED_DRESS_POOL_OUTLINE, f.floor - .2, f.floor, darkGranite, 'red-dress-fountain-bed');
    this.plazaSolid(fountain, RED_DRESS_POOL_OUTLINE, f.floor, f.rim, darkGranite, 'red-dress-fountain-rim', [RED_DRESS_POOL_INSIDE]);
    this.plazaSolid(fountain, RED_DRESS_SPILLWAY_BODY, f.floor, f.lip, darkGranite, 'red-dress-fountain-spillway');
    this.plazaSolid(fountain, RED_DRESS_POOL_INSIDE, f.pool - .025, f.pool, this.plazaWater(false), 'red-dress-pool-water', [RED_DRESS_SPILLWAY_BODY]);
    const positions: number[] = [], uvs: number[] = [], indices: number[] = [];
    const rows = 12, columns = RED_DRESS_SPILLWAY.length;
    for (let row = 0; row <= rows; row++) for (let col = 0; col < columns; col++) {
      const t = row / rows, p = RED_DRESS_SPILLWAY[col];
      positions.push(p.x, f.lip + .025 - t * (f.lip + .025 - f.pool), p.z + .045 + .32 * t * t);
      uvs.push(col / (columns - 1), t);
      if (row < rows && col < columns - 1) {
        const i = row * columns + col; indices.push(i, i + 1, i + columns, i + 1, i + columns + 1, i + columns);
      }
    }
    const curtain = new THREE.BufferGeometry(); curtain.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    curtain.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2)); curtain.setIndex(indices); curtain.computeVertexNormals();
    const veil = this.mesh(fountain, curtain, this.plazaWater(true), 'red-dress-water-veil'); veil.castShadow = false;
    const froth = this.material(new THREE.MeshStandardMaterial({ color: 0xc1cec4, roughness: .7, emissive: 0x1a251f, emissiveIntensity: .18 }));
    const foamOutline = [...RED_DRESS_SPILLWAY.map(p => ({ x: p.x, z: p.z + .2 })), ...[...RED_DRESS_SPILLWAY].reverse().map(p => ({ x: p.x, z: p.z + .85 }))];
    const foam = this.plazaSolid(fountain, foamOutline, f.pool + .003, f.pool + .018, froth, 'red-dress-water-foam'); foam.castShadow = false;

    const furniture = new THREE.Group(); furniture.name = 'red-dress-street-furniture'; set.add(furniture);
    for (const p of RED_DRESS_PLAZA.benches) {
      const bench = new THREE.Group(); bench.name = 'red-dress-bench'; bench.position.set(p.x, 0, p.z); furniture.add(bench);
      for (let slat = 0; slat < 4; slat++) this.box(bench, benchWood, -.45 + slat * .3, .98, 0, .25, .16, p.depth);
      for (let slat = 0; slat < 4; slat++) this.box(bench, benchWood, p.side * .52, 1.45 + slat * .25, 0, .16, .2, p.depth);
      for (const z of [-1.5, 1.5]) for (const x of [-.4, .4]) this.box(bench, this.metal, x, .48, z, .12, .96, .16);
    }
    const planters = new THREE.Group(); planters.name = 'red-dress-planters'; set.add(planters);
    for (const p of RED_DRESS_PLAZA.planters) {
      const planter = new THREE.Group(); planter.name = 'red-dress-planter'; planter.position.set(p.x, 0, p.z); planters.add(planter);
      this.box(planter, limestone, 0, p.height / 2, 0, p.width, p.height, p.depth, 'red-dress-planter-base');
      for (const [x, z, scale] of [[-.8, -.5, .8], [.65, -.4, .75], [0, .7, 1]]) {
        const shrub = this.mesh(planter, new THREE.SphereGeometry(.86 * scale, 10, 8), foliage); shrub.position.set(x, 1.45, z); shrub.scale.y = 1.25;
      }
    }
    const facades = new THREE.Group(); facades.name = 'red-dress-bank-frontages'; set.add(facades);
    const frontage = (x: number, z: number, yaw: number, width: number, heritage: boolean, name: string) => {
      const wall = new THREE.Group(); wall.name = name; wall.position.set(x, 0, z); wall.rotation.y = yaw; facades.add(wall);
      const stone = heritage ? bankStone : limestone, height = heritage ? 32 : 43, count = Math.round(width / 7), bay = width / count;
      this.box(wall, stone, 0, height / 2, -1, width, height, 4);
      for (const y of [1, 11.8, 13, 23.7, 31.6]) this.box(wall, stone, 0, y, 1.35, width + .6, y === 13 ? .8 : .4, 1.3);
      for (let i = 0; i < count; i++) {
        const at = -width / 2 + (i + .5) * bay;
        for (let row = 0; row < (heritage ? 3 : 5); row++) {
          const y = row === 0 ? 5.8 : 16.8 + (row - 1) * 7;
          this.box(wall, window, at, y, 1.04, bay - 1.8, row === 0 ? 9 : 4.9, .08);
          for (const dx of [-1, 0, 1]) this.box(wall, this.metal, at + dx * (bay - 1.8) / 3, y, 1.13, .07, row === 0 ? 8.8 : 4.8, .12);
          this.box(wall, stone, at, y - (row === 0 ? 4.6 : 2.5), 1.28, bay - 1.3, .22, .6);
          this.box(wall, this.metal, at, y, 1.13, bay - 1.8, .08, .12);
        }
        for (const side of [-1, 1]) {
          const px = at + side * bay / 2;
          this.box(wall, stone, px, 6.2, 1.35, 1.2, 12.4, 1.3);
          for (let y = 1; y < 12; y += .85) this.box(wall, this.dark, px, y, 2.015, 1.2, .035, .03);
          if (heritage) {
            this.cylinder(wall, stone, px, 6.8, 2, .52, 9.6, 20);
            this.cylinder(wall, stone, px, 1.8, 2, .72, .45, 20);
            this.cylinder(wall, stone, px, 11.65, 2, .72, .4, 20);
          }
        }
        if (heritage) for (let dx = -bay / 2 + .9; dx < bay / 2 - .5; dx += .34) this.box(wall, this.metal, at + dx, 2.4, 1.25, .06, 3.2, .1);
      }
      if (heritage) for (let x = -width / 2 + .6; x < width / 2; x += .9) this.box(wall, stone, x, 31.2, 1.8, .3, .65, .65);
      batchStaticGeometry(wall, new Set()).forEach(geometry => this.geometries.add(geometry));
    };
    frontage(0, -43.2, 0, 68, true, 'red-dress-north-bank');
    frontage(-33.12, 0, Math.PI / 2, 86, true, 'red-dress-west-bank');
    frontage(32.415, 0, -Math.PI / 2, 86, false, 'red-dress-east-offices');
    const city = new THREE.Group(); city.name = 'red-dress-city-edges'; set.add(city);
    for (const side of [-1, 1]) {
      const wing = new THREE.Group(); wing.name = `red-dress-city-${side < 0 ? 'west' : 'east'}-wing`; wing.position.set(side * 25, 0, 56); city.add(wing);
      this.box(wing, limestone, 0, 20, 0, 29, 40, 12);
      for (let y = 4; y < 40; y += 5.5) this.box(wing, window, 0, y, -6.06, 27, 2.9, .08);
      batchStaticGeometry(wing, new Set()).forEach(geometry => this.geometries.add(geometry));
    }
    for (let i = 0; i < 20; i++) {
      const x = [0, 16, -6, 22][i % 4], z = -25 + Math.floor(i / 2) * 6;
      this.mannequin(set, x, z, [0x364947, 0x585a52, 0x31363b, 0x706757][i % 4], i);
    }
    this.pedestrians = new RedDressCrowd(this.crowd);
    this.plazaMatte(set);
    // Architectural batches keep depth and local perspective without hundreds of draw submissions.
    batchStaticGeometry(furniture, new Set()).forEach(geometry => this.geometries.add(geometry));
    batchStaticGeometry(planters, new Set()).forEach(geometry => this.geometries.add(geometry));
    const sun = new THREE.DirectionalLight(0xe6e5d6, 2.7); sun.position.set(-24, 48, 18); sun.castShadow = true; this.light(sun, 'red-dress-sun');
    sun.shadow.mapSize.set(2048, 2048); sun.shadow.bias = -.00005; sun.shadow.normalBias = .035;
    this.light(new THREE.HemisphereLight(0xc8d2ce, 0x42473d, .78), 'red-dress-daylight');
  }

  update(journey: FilmJourney | undefined, elapsed: number): void {
    if (this.sceneId === 'm1_dojo') return;
    if (this.sceneId === 'm1_jump') {
      const training = journey?.scene === 'm1_jump' && !journey.visiting ? journey.training : undefined;
      const impact = training?.kind === 'jump_fall' && jumpImpactPose(training.fall!, training.elapsed);
      this.impactDepth.value = impact ? impact.depression : 0;
      if (impact) this.impactCenter.value.set(impact.x, -(impact.z + 21));
      if (this.wind) for (const object of this.wind.children) {
        const phase = Number(object.userData.phase ?? 0); object.position.x = -20 + ((elapsed * 8 + phase * 4) % 40); object.visible = Boolean(training?.started);
      }
      if (this.programLight) {
        this.programLight.position.set(impact ? 6 : 0, impact ? -30 : 12, -21);
        this.programLight.intensity = impact ? 420 : training?.started ? 260 : 120;
      }
      return;
    }
    const training = journey?.scene === 'm1_red_dress' && !journey.visiting ? journey.training : undefined;
    const t = training?.elapsed ?? 0; const frozen = training?.attention ? training.attention.phase === 'frozen' : Boolean(training?.started && t >= 4.8 && t < 9.2);
    const clock = training?.attention?.clock ?? (frozen ? 4.8 : training?.elapsed ?? elapsed);
    this.waterClock.value = clock;
    this.crowd.forEach((figure, index) => {
      if (figure.userData.detailed) return;
      const phase = Number(figure.userData.phase); const base = Number(figure.userData.baseZ);
      figure.position.z = base + (training?.started ? Math.sin(clock * .55 + phase) * 1.4 : 0);
      figure.rotation.z = Math.sin(clock * 1.6 + phase) * .018;
      figure.children.forEach((child, childIndex) => { if (child.userData.crowdLimb) child.rotation.x = Math.sin(clock * 3.2 + phase + childIndex) * .08; });
    });
    this.pedestrians?.update(clock, Boolean(training?.started));
  }

  dispose(): void {
    this.disposed = true; this.pedestrians?.dispose(); this.root.clear(); this.geometries.forEach(value => value.dispose()); this.materials.forEach(value => value.dispose()); this.textures.forEach(value => value.dispose()); this.lights.forEach(value => value.dispose());
    this.geometries.clear(); this.materials.clear(); this.textures.clear(); this.lights.clear(); this.crowd = []; this.skylineLights = [];
  }
}
