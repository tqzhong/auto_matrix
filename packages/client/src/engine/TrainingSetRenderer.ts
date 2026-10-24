import * as THREE from 'three';
import type { FilmJourney } from '@auto_matrix/shared';
import { FILM_SETS, JUMP_STREET, JUMP_TOWERS, jumpImpactPose } from '@auto_matrix/shared';
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
  private fountainJets: THREE.Mesh[] = [];
  private skylineLights: THREE.Mesh[] = [];
  private programLight?: THREE.PointLight;
  private revealLight?: THREE.PointLight;
  private wind?: THREE.Group;
  private wood = this.material(new THREE.MeshStandardMaterial({ color: 0x4c3425, roughness: .72 }));
  private darkWood = this.material(new THREE.MeshStandardMaterial({ color: 0x211b17, roughness: .8 }));
  private paper = this.material(new THREE.MeshPhysicalMaterial({ color: 0xe5dfc9, roughness: .68, transmission: .04 }));
  private stone = this.material(new THREE.MeshStandardMaterial({ color: 0x8a908a, roughness: .88 }));
  private dark = this.material(new THREE.MeshStandardMaterial({ color: 0x252c2d, roughness: .75, metalness: .16 }));
  private metal = this.material(new THREE.MeshStandardMaterial({ color: 0x596463, roughness: .35, metalness: .78 }));
  private glass = this.material(new THREE.MeshPhysicalMaterial({ color: 0x839b9b, roughness: .16, metalness: .28, transparent: true, opacity: .5, depthWrite: false }));
  private water = this.material(new THREE.MeshPhysicalMaterial({ color: 0x609394, roughness: .08, metalness: .28, clearcoat: 1, transparent: true, opacity: .82 }));
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

  private plaza(): void {
    const set = new THREE.Group(); set.name = 'training-red-dress-set'; this.root.add(set);
    const paving = this.material(new THREE.MeshStandardMaterial({ color: 0xc2c2b8, roughness: .9 }));
    const joint = this.material(new THREE.MeshStandardMaterial({ color: 0xa7aaa2, roughness: .95 }));
    const limestone = this.material(new THREE.MeshStandardMaterial({ color: 0xc5b79d, roughness: .76, metalness: .04 }));
    const facade = this.material(new THREE.MeshStandardMaterial({ color: 0xb2a894, roughness: .86, metalness: .03 }));
    const window = this.material(new THREE.MeshStandardMaterial({ color: 0x627274, roughness: .4, metalness: .18 }));
    const foliage = this.material(new THREE.MeshStandardMaterial({ color: 0x45634a, roughness: .92 }));
    const benchWood = this.material(new THREE.MeshStandardMaterial({ color: 0x604633, roughness: .72 }));
    const attentionInlay = this.material(new THREE.MeshStandardMaterial({ color: 0xaeb4a9, roughness: .9 }));
    this.surface(limestone, 'marble_01', 5); this.surface(benchWood, 'old_wood_floor', 3);
    this.box(set, paving, 0, -.08, 0, 62, .16, 82, 'red-dress-paving');
    for (let x = -30; x <= 30; x += 4.1) this.box(set, joint, x, .012, 0, .024, .02, 81, 'red-dress-paving-joint');
    for (let z = -40; z <= 40; z += 4.1) this.box(set, joint, 0, .014, z, 61, .02, .024, 'red-dress-paving-joint');
    this.box(set, attentionInlay, 7, .021, -12, 2.7, .026, 17.5, 'red-dress-attention-axis');

    const fountain = new THREE.Group(); fountain.name = 'red-dress-fountain'; fountain.position.set(-15.5, 0, 3); set.add(fountain);
    this.cylinder(fountain, limestone, 0, .26, 0, 8.05, .52, 48, 'red-dress-fountain-apron');
    this.cylinder(fountain, facade, 0, .58, 0, 7.35, .26, 48, 'red-dress-fountain-rim'); this.cylinder(fountain, this.water, 0, .75, 0, 6.72, .08, 48);
    this.cylinder(fountain, limestone, 0, 1.65, 0, 1.5, 2.35, 24, 'red-dress-fountain-pedestal');
    this.cylinder(fountain, limestone, 0, 3.04, 0, 2.45, .3, 28, 'red-dress-fountain-upper-bowl'); this.cylinder(fountain, this.water, 0, 3.24, 0, 2.1, .05, 28);
    for (let index = 0; index < 8; index++) {
      const angle = index / 8 * Math.PI * 2; const jet = this.cylinder(fountain, this.water, Math.cos(angle) * .72, 4.15, Math.sin(angle) * .72, .075, 2.05, 8, `red-dress-fountain-jet-${index}`);
      jet.userData.phase = index * .77; this.fountainJets.push(jet);
    }

    const planters = new THREE.Group(); planters.name = 'red-dress-planters'; set.add(planters);
    for (const [x, z, size] of [[-26, -28, .82], [-26, 28, .76], [26, -25, .8], [26, 29, .88]] as const) {
      const planter = new THREE.Group(); planter.name = 'red-dress-planter'; planter.position.set(x, 0, z); planters.add(planter);
      this.box(planter, limestone, 0, .54, 0, 3.9, 1.08, 3.9, 'red-dress-planter-base');
      for (const [offsetX, offsetZ, scale] of [[-.7, -.25, .82], [.65, -.35, .76], [0, .72, 1]] as const) {
        const shrub = this.mesh(planter, new THREE.DodecahedronGeometry(.92 * size * scale, 1), foliage, 'red-dress-planter-shrub'); shrub.position.set(offsetX, 1.7 + scale * .35, offsetZ); shrub.scale.y = 1.35;
      }
    }

    const furniture = new THREE.Group(); furniture.name = 'red-dress-street-furniture'; set.add(furniture);
    for (const [x, z, rotation] of [[-10, -28, 0], [12, -30, Math.PI], [-10, 29, 0], [12, 27, Math.PI]] as const) {
      const bench = new THREE.Group(); bench.name = 'red-dress-bench'; bench.position.set(x, 0, z); bench.rotation.y = rotation; furniture.add(bench);
      this.box(bench, benchWood, 0, .98, 0, 4.2, .16, .75, 'red-dress-bench-seat'); this.box(bench, benchWood, 0, 1.7, .27, 4.2, 1.35, .16, 'red-dress-bench-back');
      for (const side of [-1, 1]) this.box(bench, this.metal, side * 1.55, .48, 0, .12, .96, .55, 'red-dress-bench-leg');
    }

    for (const side of [-1, 1]) {
      const arcade = new THREE.Group(); arcade.name = `red-dress-${side < 0 ? 'west' : 'east'}-arcade`; arcade.position.x = side * 29.6; set.add(arcade);
      for (let z = -36; z <= 36; z += 9) {
        this.cylinder(arcade, limestone, 0, 5.2, z, .62, 10.4, 20, 'red-dress-arcade-column');
        this.box(arcade, limestone, 0, 10.6, z, 4.6, .65, 8.4, 'red-dress-arcade-beam');
      }
      this.box(arcade, facade, side * 4.25, 8.4, 0, .8, 16.8, 82, 'red-dress-arcade-facade');
      for (let z = -34; z < 36; z += 12) {
        const lamp = this.mesh(arcade, new THREE.SphereGeometry(.22, 12, 8), this.glow); lamp.position.set(-side * .85, 7.4, z);
      }
      const arcadeLight = new THREE.PointLight(0xffddb2, 11, 16, 2); arcadeLight.position.set(side * 28.6, 7.3, 0); this.light(arcadeLight, `red-dress-${side < 0 ? 'west' : 'east'}-arcade-light`);
    }

    const cityEdges = new THREE.Group(); cityEdges.name = 'red-dress-city-edges'; cityEdges.position.z = -78; set.add(cityEdges);
    for (const side of [-1, 1]) {
      const wing = new THREE.Group(); wing.name = `red-dress-city-${side < 0 ? 'west' : 'east'}-wing`; wing.position.set(side * 42, 0, 0); cityEdges.add(wing);
      this.box(wing, facade, 0, 7.5, 0, 18, 15, 3.6, 'red-dress-city-facade');
      for (let y = 3; y < 13.5; y += 3.4) this.box(wing, window, 0, y, 1.85, 14.2, 1.08, .06, 'red-dress-city-window-band');
      this.box(wing, limestone, 0, 15.25, 0, 20.5, .48, 4.5, 'red-dress-city-cornice');
    }
    for (let i = 0; i < 20; i++) {
      const x = [0, 16, -6, 22][i % 4]; const z = -35 + Math.floor(i / 2) * 7.2;
      this.mannequin(set, x, z, [0x364947, 0x585a52, 0x31363b, 0x706757][i % 4], i);
    }
    this.pedestrians = new RedDressCrowd(this.crowd);
    this.plazaMatte(set);
    this.programLight = new THREE.PointLight(0xf2e3c8, 160, 40, 2); this.programLight.position.set(7, 9, -10); this.light(this.programLight, 'red-dress-program-light');
    this.revealLight = new THREE.PointLight(0xf2e3c8, 0, 16, 2); this.revealLight.position.set(14, 8, -12); this.light(this.revealLight, 'red-dress-agent-reveal');
    const sun = new THREE.DirectionalLight(0xffe6bc, 2.3); sun.position.set(-20, 38, 26); sun.castShadow = true; this.light(sun, 'red-dress-sun');
    this.light(new THREE.HemisphereLight(0xd4e0e2, 0x4a5147, .84), 'red-dress-daylight');
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
    this.fountainJets.forEach(jet => {
      const phase = Number(jet.userData.phase ?? 0); jet.scale.y = .82 + Math.sin(clock * 3.4 + phase) * .16;
      jet.position.y = 4.15 + Math.sin(clock * 3.4 + phase) * .12;
    });
    this.crowd.forEach((figure, index) => {
      if (figure.userData.detailed) return;
      const phase = Number(figure.userData.phase); const base = Number(figure.userData.baseZ);
      figure.position.z = base + (training?.started ? Math.sin(clock * .55 + phase) * 1.4 : 0);
      figure.rotation.z = Math.sin(clock * 1.6 + phase) * .018;
      figure.children.forEach((child, childIndex) => { if (child.userData.crowdLimb) child.rotation.x = Math.sin(clock * 3.2 + phase + childIndex) * .08; });
    });
    this.pedestrians?.update(clock, Boolean(training?.started));
    if (this.revealLight) this.revealLight.intensity = training?.attention ? training.attention.phase !== 'walking' ? 45 : 0 : t >= 6.2 && t < 9.2 ? 45 : 0;
    if (this.programLight) this.programLight.intensity = 145;
  }

  dispose(): void {
    this.disposed = true; this.pedestrians?.dispose(); this.root.clear(); this.geometries.forEach(value => value.dispose()); this.materials.forEach(value => value.dispose()); this.textures.forEach(value => value.dispose()); this.lights.forEach(value => value.dispose());
    this.geometries.clear(); this.materials.clear(); this.textures.clear(); this.lights.clear(); this.crowd = []; this.fountainJets = []; this.skylineLights = [];
  }
}
