import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { Reflector } from 'three/addons/objects/Reflector.js';
import { HEL_GARAGE, helGarageFall, helGarageGun, helGarageRoot, newHelGarage, type HelGarageEncounter, type AgentState } from '@auto_matrix/shared';
import { CharacterModels, type CharacterRig } from '../agents/CharacterModel.js';
import { batchStaticGeometry } from './StaticGeometry.js';

/** Underground arrival, three paired doormen and the red painted lift entrance. */
export class HelGarageRenderer {
  readonly group = new THREE.Group();
  readonly door = new THREE.Group();
  private fixed = new THREE.Group();
  private models = new CharacterModels();
  private guards: CharacterRig[] = [];
  private guns: THREE.Group[] = [];
  private reflection: Reflector;
  private geometry = new Set<THREE.BufferGeometry>();
  private materials = new Set<THREE.Material>();
  private textures = new Set<THREE.Texture>();
  constructor(parent: THREE.Group, template: AgentState) {
    this.group.name = 'hel-garage-arrival'; parent.add(this.group); this.group.add(this.fixed, this.door);
    const grain = new Uint8Array(128 * 128 * 4);
    for (let i = 0; i < grain.length; i += 4) {
      const value = 142 + ((Math.imul(i + 51, 1664525) >>> 12) % 65); grain[i] = grain[i + 1] = grain[i + 2] = value; grain[i + 3] = 255;
    }
    const texture = new THREE.DataTexture(grain, 128, 128); texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set(5, 8); texture.needsUpdate = true; this.textures.add(texture);
    const concrete = this.surface(0x536452, .85), green = this.surface(0x243a2b, .89), steel = this.surface(0x5f665d, .32, .72);
    concrete.bumpMap = texture; concrete.bumpScale = .055;
    const floor = this.material(new THREE.MeshPhysicalMaterial({ color: 0x313c32, roughness: .29, metalness: .14, clearcoat: .7,
      clearcoatRoughness: .17, roughnessMap: texture }));
    const black = this.surface(0x111815, .68), red = this.surface(0x792326, .78), cream = this.surface(0x9c9e82, .8);
    const lamp = this.material(new THREE.MeshBasicMaterial({ color: 0xd6dfb4, toneMapped: false }));
    this.box(this.fixed, floor, 0, -.08, 0, 56, .16, 80).name = 'hel-garage-floor';
    this.reflection = new Reflector(this.own(new THREE.PlaneGeometry(55.8, 79.8)), { textureWidth: 384, textureHeight: 512, color: 0x455744, clipBias: .004, multisample: 0 });
    this.reflection.name = 'hel-wet-floor-reflection'; this.reflection.rotation.x = -Math.PI / 2; this.reflection.position.y = .012;
    const shader = this.reflection.material as THREE.ShaderMaterial;
    shader.transparent = true; shader.depthWrite = false;
    shader.fragmentShader = shader.fragmentShader.replace('gl_FragColor = vec4( blendOverlay( base.rgb, color ), 1.0 );',
      'float wet = .2 + .08 * sin(vUv.x * 39.0 / vUv.w) * sin(vUv.y * 47.0 / vUv.w); gl_FragColor = vec4(blendOverlay(base.rgb, color), wet);');
    this.group.add(this.reflection);
    for (const side of [-1, 1]) this.box(this.fixed, concrete, side * 28, 4.35, 0, .5, 8.7, 80);
    this.box(this.fixed, concrete, 0, 8.7, 0, 56, .35, 80);
    for (const wall of HEL_GARAGE.walls) this.box(this.fixed, concrete, wall.x, wall.height / 2, wall.z, wall.width, wall.height, wall.depth);
    this.box(this.fixed, concrete, 0, 7.5, -30, 7.2, 2.4, .5);
    for (const column of HEL_GARAGE.columns) {
      this.box(this.fixed, concrete, column.x, column.height / 2, column.z, column.width, column.height, column.depth);
      this.box(this.fixed, green, column.x, 1.1, column.z, column.width + .015, 2.2, column.depth + .015);
      this.box(this.fixed, cream, column.x, 2.25, column.z, column.width + .02, .12, column.depth + .02);
    }
    for (const side of [-1, 1]) for (const y of [1.7, 7.7]) this.box(this.fixed, green, side * 27.72, y, 0, .06, .17, 80);
    for (const z of [-26, -10, 6, 22]) {
      this.box(this.fixed, steel, 0, 8.12, z, 55, .25, .5);
      this.box(this.fixed, black, 0, 7.86, z, 9, .16, .82);
      this.box(this.fixed, lamp, 0, 7.75, z, 8.4, .04, .48);
      const light = new THREE.PointLight(0xdce6be, 64, 26, 2); light.position.set(0, 7.4, z); this.group.add(light);
    }
    for (const x of [-7.8, 7.8]) for (const y of [7.88, 8.15]) this.rail(this.fixed, steel, [x, y, -35.5], [x, y, 35.5], .11);
    for (const car of HEL_GARAGE.cars) this.car(car.x, car.z, steel, black, cream);
    for (const x of [-8.4, 8.4]) for (let z = -33; z < 32; z += 4) this.box(this.fixed, cream, x, .021, z, .12, .018, 2.5);
    for (const z of [-12, 12]) {
      this.box(this.fixed, black, 0, .024, z, 7, .025, .72);
      for (let i = -6; i <= 6; i++) this.box(this.fixed, steel, i * .5, .041, z, .055, .012, .64);
    }
    const arch = new THREE.EllipseCurve(0, 0, 5.65, 8.25, 0, Math.PI, false, 0).getPoints(80);
    const path = new THREE.CatmullRomCurve3(arch.map(p => new THREE.Vector3(p.x, p.y, -29.7)));
    this.mesh(this.fixed, this.own(new THREE.TubeGeometry(path, 80, .17, 8, false)), red).name = 'hel-red-entrance-arch';
    for (const x of [-3.75, 3.75]) this.box(this.fixed, steel, x, 3.2, -29.72, .22, 6.4, .22);
    this.box(this.fixed, steel, 0, 6.42, -29.72, 7.7, .22, .22);
    this.door.name = 'hel-garage-steel-door'; this.door.position.set(-3.6, 0, -30);
    this.box(this.door, green, 3.6, 3.15, 0, 7.2, 6.3, .25);
    for (const y of [.26, 3.15, 6.04]) this.box(this.door, steel, 3.6, y, .145, 6.95, .08, .055);
    for (const x of [.23, 6.97]) this.box(this.door, steel, x, 3.15, .145, .08, 6.12, .055);
    this.rail(this.door, steel, [6.3, 2.76, .25], [6.3, 3.28, .25], .07).name = 'hel-garage-door-handle';
    for (const x of [-6.8, 6.8]) for (const z of [-25.6, -29]) {
      this.rail(this.fixed, steel, [x, .04, z], [x, 2.1, z], .06);
      this.mesh(this.fixed, this.own(new THREE.CylinderGeometry(.26, .36, .11, 20)), steel).position.set(x, .065, z);
    }
    for (const x of [-6.8, 6.8]) this.rail(this.fixed, black, [x, 1.65, -25.6], [x, 1.65, -29], .035);
    for (const x of [-4.2, 4.2]) for (let z = -37.8; z <= -30.4; z += .4) this.rail(this.fixed, steel, [x, .05, z], [x, 6.9, z], .028);
    for (const y of [1, 4, 6.9]) for (const side of [-1, 1]) this.rail(this.fixed, steel, [side * 4.2, y, -30.4], [side * 4.2, y, -38.05], .05);
    for (let x = -4; x <= 4; x += .4) this.rail(this.fixed, steel, [x, .05, -38.05], [x, 6.9, -38.05], .028);
    for (const [pair, spot] of HEL_GARAGE.pairs.entries()) {
      const state = structuredClone(template); state.id = `hel_garage_guard_${pair}`; state.name = 'Hel 入口守卫';
      state.faction = 'merovingian'; state.appearance.headColor = pair === 0 ? '#c0a98e' : '#ac907a'; state.appearance.clothing = '#171b18';
      const rig = this.models.create(state); rig.root.name = state.id; this.group.add(rig.root); this.guards.push(rig);
      const gun = new THREE.Group(); gun.name = `hel-garage-gun-${pair}`; this.group.add(gun); this.guns.push(gun);
      this.box(gun, steel, 0, 0, .18, .15, .19, .58, .025); this.box(gun, black, 0, -.15, -.015, .13, .28, .14, .018);
      this.mesh(gun, this.own(new THREE.TorusGeometry(.085, .012, 8, 18)), black).position.set(0, -.12, .08);
    }
    batchStaticGeometry(this.fixed, new Set()).forEach(g => this.geometry.add(g)); this.update();
  }
  update(state = newHelGarage()): void {
    this.door.rotation.y = state.door * Math.PI / 2;
    this.guards.forEach((rig, pair) => {
      const root = helGarageRoot(state, 'guard', pair)!, fall = helGarageFall(state);
      rig.root.position.set(root.x, .56 * fall, root.z); rig.root.rotation.set(-Math.PI / 2 * fall, root.yaw, 0);
      this.models.animate(rig, 0, { speed: 0, grounded: true, verticalVelocity: 0, turn: 0,
        helGarage: { ...state, role: 'guard', pair } }, 0);
      const gun = this.guns[pair], dropped = helGarageGun(state), drawing = state.phase === 'drawing' ? THREE.MathUtils.smoothstep(state.elapsed, 0, HEL_GARAGE.drawing) : 1;
      gun.visible = !['ready', 'talking'].includes(state.phase);
      gun.position.set(root.x - .46 + dropped.progress * .75, dropped.dropped ? dropped.y : 1.65 + drawing * 1.4, root.z + .1 + drawing + dropped.progress * .45);
      gun.rotation.set(dropped.progress * Math.PI / 2, dropped.progress * .6, dropped.progress * .4);
    });
  }
  private car(x: number, z: number, chrome: THREE.Material, black: THREE.Material, cream: THREE.Material): void {
    const car = new THREE.Group(); car.name = 'hel-parked-car'; car.position.set(x, 0, z); this.fixed.add(car);
    const paint = this.material(new THREE.MeshPhysicalMaterial({ color: 0x101916, roughness: .22, metalness: .55, clearcoat: .9 }));
    const glass = this.surface(0x13231c, .14, .4);
    this.box(car, paint, 0, 1.9, 0, 8.5, 2.35, 13, .6);
    this.box(car, glass, 0, 3.6, -.3, 7.35, 2.55, 6.5, .65);
    this.box(car, paint, 0, 4.84, -.35, 7.3, .22, 5.9, .08);
    for (const side of [-1, 1]) {
      for (const wheelZ of [-4.3, 4.3]) {
        const wheel = this.mesh(car, this.own(new THREE.CylinderGeometry(1.23, 1.23, .7, 32)), black); wheel.position.set(side * 4.05, 1.25, wheelZ); wheel.rotation.z = Math.PI / 2;
        const rim = this.mesh(car, this.own(new THREE.CylinderGeometry(.71, .71, .72, 24)), chrome); rim.position.copy(wheel.position); rim.rotation.z = Math.PI / 2;
      }
      for (const doorZ of [-1.75, 1.8]) this.box(car, chrome, side * 4.27, 2.5, doorZ, .025, .06, .62);
      this.box(car, paint, side * 4, 3.5, 2.35, .8, .4, .55, .09);
      for (const end of [-1, 1]) this.box(car, end > 0 ? cream : this.surface(0x651f1d, .4), side * 2.85, 2.3, end * 6.51, 1.55, .65, .045, .08);
    }
    this.box(car, chrome, 0, 1.45, 6.54, 4.7, .65, .04); this.box(car, black, 0, 1.45, -6.55, 1.7, .5, .045);
  }
  private own<T extends THREE.BufferGeometry>(g: T): T { this.geometry.add(g); return g; }
  private material<T extends THREE.Material>(m: T): T { this.materials.add(m); return m; }
  private surface(color: number, roughness = .7, metalness = 0) { return this.material(new THREE.MeshStandardMaterial({ color, roughness, metalness })); }
  private mesh(parent: THREE.Object3D, geometry: THREE.BufferGeometry, material: THREE.Material): THREE.Mesh {
    const mesh = new THREE.Mesh(geometry, material); mesh.castShadow = mesh.receiveShadow = true; parent.add(mesh); return mesh;
  }
  private box(parent: THREE.Object3D, material: THREE.Material, x: number, y: number, z: number, w: number, h: number, d: number, radius = 0): THREE.Mesh {
    const mesh = this.mesh(parent, this.own(radius ? new RoundedBoxGeometry(w, h, d, 3, radius) : new THREE.BoxGeometry(w, h, d)), material); mesh.position.set(x, y, z); return mesh;
  }
  private rail(parent: THREE.Object3D, material: THREE.Material, from: number[], to: number[], radius: number): THREE.Mesh {
    const a = new THREE.Vector3(...from as [number, number, number]), b = new THREE.Vector3(...to as [number, number, number]), delta = b.clone().sub(a);
    const mesh = this.mesh(parent, this.own(new THREE.CylinderGeometry(radius, radius, delta.length(), 8)), material);
    mesh.position.copy(a.lerp(b, .5)); mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), delta.normalize()); return mesh;
  }
  dispose(): void {
    this.models.dispose(); this.reflection.dispose(); this.geometry.forEach(g => g.dispose()); this.materials.forEach(m => m.dispose()); this.textures.forEach(t => t.dispose()); this.group.removeFromParent();
  }
}
