import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { PRIMARY_DEMOLITION as P, primaryFloor, primaryMountPoint, type PrimaryDemolition, type GridOperation } from '@auto_matrix/shared';
import { batchStaticGeometry } from './StaticGeometry.js';

/** Industrial power hall. The three installations and exit bridge are gameplay adaptations. */
export class PrimaryDemolitionRenderer {
  readonly group = new THREE.Group();
  private static = new THREE.Group();
  private charges: THREE.Group[] = [];
  private lamps: THREE.MeshStandardMaterial[] = [];
  private pointer = new THREE.Group();
  private lights: THREE.PointLight[] = [];
  private fire = new THREE.Group();
  private smoke = new THREE.Group();
  private flash = new THREE.PointLight(0xff8b38, 0, 210, 2);
  private fireMaterial?: THREE.ShaderMaterial;
  private smokeMaterial?: THREE.ShaderMaterial;
  private roof = new THREE.Group();
  private geometries = new Set<THREE.BufferGeometry>();
  private materials = new Set<THREE.Material>();
  private textures = new Set<THREE.Texture>();
  private cityLight = this.material(0x948f6d, .7, 0, 0xb7af80, 1.3);
  private hallLamp = this.material(0xb8cfce, .3, 0, 0xa7c8cc, 2);
  private disposed = false;
  constructor(parent: THREE.Group) {
    parent.add(this.group); this.group.add(this.static);
    const concrete = this.surface('white_plaster_02', 0x777b73), metal = this.surface('metal_plate', 0x424c4d);
    const casing = this.material(0x46504d, .45, .7), dark = this.material(0x101818, .7, .45);
    const steel = this.material(0x788380, .35, .8), copper = this.material(0x705647, .5, .7), ceramic = this.material(0xbebcab, .25);
    const safety = this.material(0xb49b53, .65, .2);
    this.box(concrete, 0, -.2, 0, 64, .4, 90, 'primary-floor');
    for (const [i, wall] of P.walls.entries()) this.box(concrete, wall.x, wall.height / 2, wall.z, wall.width, wall.height, wall.depth, `primary-wall-${i}`);
    this.group.add(this.roof);
    for (const x of [-24, -8, 8, 24]) for (const z of [-35.875, -18.625, -1.375, 15.875]) {
      const panel = this.box(metal, x, P.roof.y, z, 16, P.roof.height, 17.25);
      this.static.remove(panel); panel.name = 'primary-roof-panel'; panel.userData.origin = new THREE.Vector3(x, P.roof.y, z); this.roof.add(panel);
    }
    for (const z of [-38, -26, -14, -2, 10, 22]) {
      this.box(steel, 0, 16.5, z, 63, .5, .3);
      for (const x of [-29, 29]) this.box(steel, x, 8, z, .45, 16, .45);
      for (const x of [-8, 8]) this.pipe(copper, new THREE.Vector3(x, 12.5, -40), new THREE.Vector3(x, 12.5, 24), .24);
      this.box(this.hallLamp, 0, 16.1, z, 4.5, .12, .7);
      const light = new THREE.PointLight(0xc3d2cb, 380, 33, 2); light.position.set(0, 13.5, z); this.group.add(light); this.lights.push(light);
    }
    for (const [i, bank] of P.banks.entries()) {
      this.box(casing, bank.x, bank.height / 2, bank.z, bank.width, bank.height, bank.depth, `primary-bank-${i}`, .16);
      this.box(dark, bank.x, .2, bank.z, bank.width + .08, .4, bank.depth + .08);
      const sign = Math.sign(bank.x), face = bank.x - sign * (bank.width / 2 + .03);
      this.box(dark, face, 4.5, bank.z, .12, 7.9, 4.2);
      for (let y = 1.2; y < 8; y += .5) this.box(steel, face - sign * .08, y, bank.z, .1, .07, 3.8);
      for (const dz of [-1.25, 1.25]) {
        this.pipe(copper, new THREE.Vector3(bank.x, 9, bank.z + dz), new THREE.Vector3(bank.x, 12.5, bank.z + dz), .15);
        for (let y = 9.1; y < 10.4; y += .22) this.cylinder(ceramic, bank.x, y, bank.z + dz, .4, .08);
      }
      for (const z of [bank.z - 2.25, bank.z + 2.25]) this.box(safety, face - sign * .16, .08, z, 1.2, .06, .18);
    }
    const terminal = P.terminal;
    this.box(casing, terminal.x, terminal.height / 2, terminal.z, terminal.width, terminal.height, terminal.depth, 'primary-terminal', .12);
    for (const x of [-2.8, -1.4, 0, 1.4, 2.8]) {
      this.box(dark, x, 3.1, -30.75, 1.1, 4.8, .12);
      this.cylinder(ceramic, x, 4.8, -30.56, .25, .06).rotation.x = Math.PI / 2;
      for (const y of [1.4, 2.2, 3.9]) this.box(steel, x, y, -30.6, .7, .06, .08);
    }
    for (const [i, site] of P.sites.entries()) {
      const charge = new THREE.Group(); charge.name = `primary-charge-${site.id}`;
      charge.position.set(site.contact.x, site.contact.y, site.contact.z); charge.rotation.y = site.yaw + Math.PI;
      const pack = this.box(dark, 0, 0, 0, .68, .8, .14, undefined, .04); this.static.remove(pack); charge.add(pack);
      for (const x of [-.22, 0, .22]) {
        const cell = this.box(this.material(0x686e60, .8), x, 0, .09, .16, .54, .12, undefined, .02); this.static.remove(cell); charge.add(cell);
      }
      const lamp = this.material(0xb06d38, .3, .15, 0xb76c30, 1.5); this.lamps.push(lamp);
      const indicator = this.box(lamp, 0, .3, .10, .2, .07, .03); this.static.remove(indicator); charge.add(indicator);
      charge.visible = false; this.group.add(charge); this.charges.push(charge);
      // A flush mounting plate gives the hands a visible surface before the charge is fixed.
      const plate = this.box(steel, site.contact.x, site.contact.y, site.contact.z, i === 2 ? .9 : .08, 1.1, i === 2 ? .08 : .9, `primary-mount-${site.id}`);
      plate.userData.installation = site.id;
    }
    this.pointer.position.set(0, 4.8, -30.46); this.group.add(this.pointer);
    const clock = new THREE.Mesh(new THREE.CircleGeometry(.48, 48), dark); this.geometries.add(clock.geometry); clock.position.copy(this.pointer.position); clock.name = 'primary-sync-dial'; this.group.add(clock);
    const start = P.syncStart / P.syncCycle * Math.PI * 2, length = (P.syncEnd - P.syncStart) / P.syncCycle * Math.PI * 2;
    const window = new THREE.Mesh(new THREE.RingGeometry(.35, .47, 40, 1, Math.PI / 2 - start - length, length), this.material(0x68b887, .5, 0, 0x35673e, .7));
    this.geometries.add(window.geometry); window.position.copy(this.pointer.position).add(new THREE.Vector3(0, 0, .01)); this.group.add(window);
    const needle = this.box(this.material(0xf2dfb8, .45, 0, 0xcbbc91, .25), 0, .21, .025, .035, .42, .025); this.static.remove(needle); this.pointer.add(needle);
    const ramp = new THREE.BoxGeometry(P.ramp.width, .2, P.ramp.finish - P.ramp.start, 1, 1, 7), positions = ramp.attributes.position;
    for (let i = 0; i < positions.count; i++) {
      const z = positions.getZ(i) + (P.ramp.start + P.ramp.finish) / 2;
      positions.setY(i, positions.getY(i) > 0 ? primaryFloor(0, z) : -.2);
    }
    ramp.computeVertexNormals(); this.geometries.add(ramp);
    const bridge = new THREE.Mesh(ramp, metal); bridge.position.z = (P.ramp.start + P.ramp.finish) / 2; bridge.receiveShadow = true; bridge.name = 'primary-exit-bridge'; this.static.add(bridge);
    for (const rail of P.rails) this.box(steel, rail.x, rail.height / 2, rail.z, rail.width, rail.height, rail.depth, `primary-rail-${rail.x}-${rail.z}`);
    for (const side of [-1, 1]) this.pipe(safety, new THREE.Vector3(side * 4.5, 2, 30), new THREE.Vector3(side * 4.5, 5.2, 38), .085);
    for (const z of [39, 41, 43]) {
      this.box(safety, 0, 3.215, z, P.ramp.width, .03, .1);
      for (const x of [-4.5, 4.5]) this.pipe(safety, new THREE.Vector3(x, 5.2, z - 1), new THREE.Vector3(x, 5.2, z + 1), .085);
    }
    for (const x of [-24, 24]) {
      this.pipe(steel, new THREE.Vector3(x, 0, 34), new THREE.Vector3(x, 20, 34), 1.2);
      for (const y of [1, 7, 13, 19]) this.cylinder(dark, x, y, 34, 1.35, .16);
    }
    this.exterior(concrete, metal, steel, dark);
    this.group.add(this.fire, this.smoke, this.flash);
    this.flash.position.set(0, 20, 0);
    const cloud = (smoke: boolean) => {
      const material = new THREE.ShaderMaterial({ transparent: true, depthWrite: false, side: THREE.DoubleSide, toneMapped: false,
        uniforms: { age: { value: 0 }, strength: { value: 0 } },
        vertexShader: 'varying vec2 vUv; void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
        fragmentShader: `varying vec2 vUv; uniform float age; uniform float strength;
          float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
          float noise(vec2 p){vec2 a=floor(p),b=fract(p);b=b*b*(3.-2.*b);return mix(mix(hash(a),hash(a+vec2(1,0)),b.x),mix(hash(a+vec2(0,1)),hash(a+vec2(1)),b.x),b.y);}
          void main(){vec2 p=(vUv-.5)*2.; float n=noise(vUv*7.+vec2(age*.27,-age*.6))*.6+noise(vUv*17.-age*.5)*.4;
            float edge=(1.-smoothstep(.36,.96,length(p*vec2(1.,.78))+(n-.5)*.34))
              *(1.-smoothstep(.82,1.,max(abs(p.x),abs(p.y))));
            ${smoke ? 'vec3 color=mix(vec3(.065,.075,.085),vec3(.29,.27,.24),n);float alpha=edge*strength*.62;' : 'float heat=clamp(1.-length(p)*.64+n*.3,0.,1.);vec3 color=mix(vec3(.92,.11,.015),vec3(2.6,1.8,.38),heat*heat);float alpha=edge*strength;'}
            gl_FragColor=vec4(color,alpha); }` });
      this.materials.add(material); return material;
    };
    this.fireMaterial = cloud(false); this.smokeMaterial = cloud(true);
    const plane = new THREE.PlaneGeometry(1, 1); this.geometries.add(plane);
    for (let i = 0; i < 30; i++) {
      const sheet = new THREE.Mesh(plane, this.fireMaterial); sheet.userData.seed = i; sheet.name = `primary-flame-${i}`; this.fire.add(sheet);
      const smoke = new THREE.Mesh(plane, this.smokeMaterial); smoke.userData.seed = i; smoke.name = `primary-smoke-${i}`; this.smoke.add(smoke);
    }
    batchStaticGeometry(this.static, new Set()).forEach(geometry => this.geometries.add(geometry));
  }
  private exterior(concrete: THREE.Material, metal: THREE.Material, steel: THREE.Material, dark: THREE.Material): void {
    const brick = this.surface('damaged_plaster', 0x6f5142), road = this.material(0x293337, .94), lines = this.material(0xadad98, .85);
    this.box(concrete, 0, -.45, 100, 360, .5, 360, 'primary-exterior-ground');
    this.box(road, 0, -.14, 64, 350, .12, 18, 'primary-exterior-road');
    for (const x of [-20, 20]) {
      this.box(brick, x, 9, 25.1, 24, 18, .4, 'primary-brick-front');
      for (const y of [7, 12.5]) for (const dx of [-8, -4, 0, 4, 8]) {
        this.box(dark, x + dx, y, 25.34, 2.8, 3.5, .08);
        this.box(this.material(0x718680, .4, .1, 0x728478, .3), x + dx, y, 25.40, 2.5, 3.2, .03);
        this.box(steel, x + dx, y, 25.43, .07, 3.4, .05);
        this.box(steel, x + dx, y, 25.43, 2.7, .07, .05);
      }
    }
    for (let x = -160; x < 160; x += 10) this.box(lines, x, -.065, 64, 4, .02, .12);
    for (const z of [54.5, 73.5]) this.box(concrete, 0, -.05, z, 350, .24, 1.2);
    for (const x of [-75, -40, 40, 75]) {
      this.pipe(steel, new THREE.Vector3(x, 0, 53), new THREE.Vector3(x, 9.5, 53), .1);
      this.box(steel, x, 9.5, 54, .16, .16, 2.1);
      this.box(this.cityLight, x, 9.3, 55, .7, .08, 1.1);
    }
    const yard = new THREE.PointLight(0xcad7d3, 1100, 155, 2); yard.position.set(0, 15, 55); this.group.add(yard); this.lights.push(yard);
    for (const x of [-69, 69]) {
      this.box(brick, x, 7, 106, 42, 14, 38, `primary-exterior-warehouse-${x}`);
      this.box(metal, x, 14.1, 106, 43, .3, 39);
      for (const dx of [-12, 0, 12]) this.box(dark, x + dx, 4, 86.94, 9, 8, .1);
      this.box(this.cityLight, x, 10.5, 86.8, 2, .2, .1);
    }
    const windowGeometry = new THREE.BoxGeometry(1.15, 1.5, .06); this.geometries.add(windowGeometry);
    const windows: THREE.Matrix4[] = [];
    for (let i = 0; i < 11; i++) {
      const x = -155 + i * 31, height = 28 + (i * 17 % 37), z = 180 + i % 3 * 26;
      this.box(this.material(0x263439 + i % 3 * 0x020202, .88), x, height / 2, z, 22, height, 24, `primary-skyline-${i}`);
      for (let y = 5; y < height - 2; y += 4) for (let dx = -8; dx <= 8; dx += 4) if ((i + dx + y) % 3 !== 0)
        windows.push(new THREE.Matrix4().makeTranslation(x + dx, y, z - 12.04));
    }
    const lights = new THREE.InstancedMesh(windowGeometry, this.cityLight, windows.length); lights.name = 'primary-city-windows';
    windows.forEach((matrix, i) => lights.setMatrixAt(i, matrix)); lights.computeBoundingSphere(); this.static.add(lights);
    // Fences remain outside the playable hall and do not obstruct the shared escape ramp.
    for (const x of [-38, 38]) for (let z = -45; z <= 29; z += 5) {
      this.pipe(steel, new THREE.Vector3(x, 0, z), new THREE.Vector3(x, 4.6, z), .06);
      for (const y of [1, 2.3, 3.6]) this.pipe(steel, new THREE.Vector3(x, y, z), new THREE.Vector3(x, y, z + 5), .012);
    }
  }
  private material(color: number, roughness: number, metalness = .02, emissive = 0, emissiveIntensity = 0): THREE.MeshStandardMaterial {
    const material = new THREE.MeshStandardMaterial({ color, roughness, metalness, emissive, emissiveIntensity }); this.materials.add(material); return material;
  }
  private surface(name: string, color: number): THREE.MeshStandardMaterial {
    const material = this.material(color, .8, name === 'metal_plate' ? .65 : .02);
    if (typeof document !== 'undefined') for (const [suffix, slot] of [['color', 'map'], ['normal', 'normalMap'], ['roughness', 'roughnessMap']] as const) {
      const texture = new THREE.TextureLoader().load(`/assets/film-materials/${name}-${suffix}.jpg`, value => { if (this.disposed) value.dispose(); });
      texture.wrapS = texture.wrapT = THREE.RepeatWrapping; texture.anisotropy = 4; if (slot === 'map') texture.colorSpace = THREE.SRGBColorSpace;
      material[slot] = texture; this.textures.add(texture);
    }
    material.normalScale.set(.3, .3); return material;
  }
  private box(material: THREE.Material, x: number, y: number, z: number, w: number, h: number, d: number, name?: string, radius = 0): THREE.Mesh {
    const geometry = radius ? new RoundedBoxGeometry(w, h, d, 2, radius) : new THREE.BoxGeometry(w, h, d);
    if (material instanceof THREE.MeshStandardMaterial && material.map) {
      const uv = geometry.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * Math.max(w, d) / 4, uv.getY(i) * Math.max(h, d) / 4);
    }
    this.geometries.add(geometry); const mesh = new THREE.Mesh(geometry, material); mesh.position.set(x, y, z); if (name) mesh.name = name;
    mesh.castShadow = mesh.receiveShadow = true; this.static.add(mesh); return mesh;
  }
  private cylinder(material: THREE.Material, x: number, y: number, z: number, radius: number, height: number): THREE.Mesh {
    const geometry = new THREE.CylinderGeometry(radius, radius, height, 16); this.geometries.add(geometry);
    const mesh = new THREE.Mesh(geometry, material); mesh.position.set(x, y, z); mesh.castShadow = mesh.receiveShadow = true; this.static.add(mesh); return mesh;
  }
  private pipe(material: THREE.Material, from: THREE.Vector3, to: THREE.Vector3, radius: number): void {
    const middle = from.clone().add(to).multiplyScalar(.5), pipe = this.cylinder(material, middle.x, middle.y, middle.z, radius, from.distanceTo(to));
    pipe.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), to.clone().sub(from).normalize());
  }
  update(state?: PrimaryDemolition, grid?: GridOperation, camera?: THREE.Camera): void {
    const off = grid?.primary === 'off';
    this.hallLamp.emissiveIntensity = off ? 0 : 2;
    for (const [i, charge] of this.charges.entries()) {
      const installed = state?.installed.includes(P.sites[i].id);
      const mounting = state?.phase === 'mounting' && state.selected === i;
      charge.visible = Boolean(installed || mounting);
      const point = mounting ? primaryMountPoint(state!) : P.sites[i].contact; charge.position.set(point.x, point.y, point.z);
      this.lamps[i].color.setHex(off ? 0x27332a : state?.phase === 'failed' ? 0xbd5c40 : installed ? 0x74b794 : 0xb78952);
      this.lamps[i].emissive.copy(this.lamps[i].color); this.lamps[i].emissiveIntensity = off ? 0 : 1.5;
    }
    this.pointer.rotation.z = -(state?.elapsed ?? 0) / P.syncCycle * Math.PI * 2;
    this.lights.forEach(light => { light.intensity = off ? 25 : 380; light.color.setHex(off ? 0x82958c : 0xc3d2cb); });
    const blast = state?.blast, time = blast?.phase === 'blast' ? blast.elapsed : blast?.phase === 'done' || off && !blast ? P.blastSeconds : -1;
    this.fire.visible = this.smoke.visible = time >= 0;
    this.fireMaterial!.uniforms.age.value = this.smokeMaterial!.uniforms.age.value = Math.max(0, time);
    const strength = time < 0 ? 0 : Math.min(1, time / .18) * Math.exp(-Math.max(0, time - 1.5) * .65);
    this.fireMaterial!.uniforms.strength.value = strength;
    this.smokeMaterial!.uniforms.strength.value = time < 0 ? 0 : Math.min(.8, time / 1.2);
    this.flash.intensity = time < 0 ? 0 : Math.min(1, time / .04) * Math.exp(-time * 4.8) * 90000 + strength * 1200;
    this.cityLight.emissiveIntensity = time < 0 ? 1.3 : time < P.emergencyReturnSeconds ? .025
      : .6 + .7 * Math.min(1, (time - P.emergencyReturnSeconds) / 2);
    const facing = camera?.getWorldQuaternion(new THREE.Quaternion());
    for (const [i, panel] of this.roof.children.entries()) {
      const origin = panel.userData.origin as THREE.Vector3, t = time < 0 ? 0 : Math.max(0, time - i % 4 * .07);
      const fall = Math.min(t, 3.9), sign = Math.sign(origin.x);
      panel.position.copy(origin); panel.position.x += sign * fall * 20;
      const rx = Math.min(1, fall / 3.9) * (.18 + i % 3 * .08), rz = sign * Math.min(1, fall / 3.9) * .13;
      panel.rotation.set(rx, .02 * fall * sign, rz);
      panel.position.y = Math.max(.3 + Math.abs(Math.sin(rx)) * 8.625 + Math.abs(Math.sin(rz)) * 8, origin.y + 10 * fall - 4.9 * fall * fall);
    }
    for (const [i, flame] of this.fire.children.entries()) {
      const site = P.sites[i % 3], t = Math.max(0, time - i % 5 * .04), angle = i * 2.39996;
      flame.position.set(site.contact.x + Math.sin(angle) * Math.min(15, t * 9), 3 + Math.min(24, t * (5 + i % 4)) + Math.cos(angle) * 3,
        site.contact.z + Math.cos(angle) * Math.min(12, t * 7));
      flame.scale.set(5 + Math.min(23, t * 18), 5 + Math.min(27, t * 14), 1);
      if (facing) flame.quaternion.copy(facing);
      const smoke = this.smoke.children[i];
      smoke.position.copy(flame.position); smoke.position.y += Math.min(23, t * 3.5); smoke.position.x += t * .5;
      smoke.scale.set(10 + Math.min(27, t * 8), 10 + Math.min(31, t * 10), 1);
      if (facing) smoke.quaternion.copy(facing);
    }
    this.group.userData.blastTime = time; this.group.userData.cityLighting = this.cityLight.emissiveIntensity;
  }
  dispose(): void {
    this.disposed = true; this.group.removeFromParent(); this.lights.forEach(light => light.dispose()); this.flash.dispose();
    this.geometries.forEach(geometry => geometry.dispose()); this.materials.forEach(material => material.dispose()); this.textures.forEach(texture => texture.dispose());
  }
}
