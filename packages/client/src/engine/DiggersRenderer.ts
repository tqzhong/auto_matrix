import { UpperDiggerRenderer } from './UpperDiggerRenderer.js';
import * as THREE from 'three';
import { DIGGERS, diggerShield, type FilmJourney } from '@auto_matrix/shared';
import { batchStaticGeometry } from './StaticGeometry.js';

/** The drill, firing apertures and rockets share the authoritative encounter clock. */
export class DiggersRenderer {
  readonly group = new THREE.Group();
  private wreck = new THREE.Group();
  private drill = new THREE.Group();
  private rotor = new THREE.Group();
  private legs: THREE.Group[] = [];
  private lowerLegs: THREE.Group[] = [];
  private knees: THREE.Mesh[] = [];
  private sentinel = new THREE.Group();
  private tentacles: THREE.InstancedMesh;
  private rockets: THREE.Mesh[] = [];
  private blast = new THREE.Group();
  private chips: THREE.InstancedMesh;
  private flash = new THREE.PointLight(0xffbb78, 0, 40, 2);
  private geometry = new Set<THREE.BufferGeometry>();
  private materials: THREE.Material[] = [];
  private textures: THREE.Texture[] = [];
  private scratch = new THREE.Object3D();
  private disposed = false;
  private upper: UpperDiggerRenderer;
  private lastFrame = '';
  constructor(parent: THREE.Group) {
    this.group.name = 'zion-digger-infantry'; parent.add(this.group);
    const iron = this.material(0x303d40, .58, .64), steel = this.material(0x6e7c7c, .66, .47);
    const piston = this.material(0x8c9895, .88, .28), brass = this.material(0xb08b51, .68, .5);
    const concrete = this.material(0x5c6767, .04, .95), dark = this.material(0x111c20, .55, .7);
    if (typeof document !== 'undefined') {
      for (const [material, name] of [[steel, 'metal_plate'], [concrete, 'damaged_plaster']] as const)
      for (const [suffix, slot] of [['color', 'map'], ['normal', 'normalMap'], ['roughness', 'roughnessMap']] as const) {
        const texture = new THREE.TextureLoader().load(`/assets/film-materials/${name}-${suffix}.jpg`, loaded => { if (this.disposed) loaded.dispose(); });
        texture.wrapS = texture.wrapT = THREE.RepeatWrapping; texture.repeat.set(3, 2);
        if (slot === 'map') texture.colorSpace = THREE.SRGBColorSpace;
        material[slot] = texture; this.textures.push(texture);
      }
      steel.normalScale.set(.35, .35);
    }
    const duct = new THREE.Group(); duct.name = 'digger-defense-duct'; this.group.add(duct);
    for (const wall of DIGGERS.walls) this.box(concrete, wall.x, 1 + wall.height / 2, wall.z, wall.width, wall.height, wall.depth, duct);
    this.box(steel, -41.9, .9, 5.5, 12.2, .2, 60, duct);
    for (let z = -23; z < 36; z += 4) {
      if (DIGGERS.stations.every(point => Math.abs(point.z - z) > 4.5)) this.pipe(iron, [-47.5, 6.9, z], [-36.2, 6.9, z], .15, duct);
      for (const x of [-47.5, -36.3]) if (x < -40 || DIGGERS.stations.every(point => Math.abs(point.z - z) > 4.5))
        this.pipe(steel, [x, 1, z], [x, 6.9, z], .12, duct);
      for (const x of [-46.9, -46.4]) this.pipe(iron, [x, 6.2, z], [x, 6.2, z + 4], .12, duct);
    }
    for (const point of DIGGERS.stations) {
      this.box(steel, -35.8, 2.6, point.z, .95, .3, 9, duct);
      for (const z of [point.z - 4.2, point.z + 4.2]) this.box(steel, -35.8, 3.6, z, 1.05, 5.9, .35, duct);
      for (let i = 0; i < 8; i++) this.box(i % 2 ? dark : brass, -40 + i * .4, 1.02, point.z + 2.6, .32, .025, .6, duct);
      const light = new THREE.PointLight(0xbdd4e2, 45, 15, 2); light.position.set(-43, 6, point.z); this.group.add(light);
      this.box(brass, -44, 1.45, point.z + 1.6, 1.4, .8, 1, duct);
      for (let i = 0; i < 3; i++) this.pipe(piston, [-44.45 + i * .45, 2, point.z + 1.15], [-44.45 + i * .45, 2, point.z + 2.1], .14, duct);
    }
    batchStaticGeometry(duct, new Set()).forEach(g => this.geometry.add(g));
    // A separate east bay gives the machine room to fall, clear of the central APU route.
    const bay = new THREE.Group(); bay.name = 'digger-east-bay'; this.group.add(bay);
    this.box(concrete, 63, .5, 0, 102, 1, 138, bay);
    this.box(dark, 114, 29, 0, 2, 58, 138, bay);
    for (const z of [-69, 69]) this.box(concrete, 63, 29, z, 102, 58, 1.2, bay);
    for (let z = -60; z <= 60; z += 12) {
      this.box(concrete, 112, 27, z, 1.4, 50, 10.7, bay);
      for (const y of [9, 24, 42]) {
        this.box(iron, 110.9, y, z, 1.1, 1.3, 11.8, bay);
        for (let n = 0; n < 7; n++) this.box(steel, 110.4, y + 3.8, z - 4.5 + n * 1.5, .5, 5.4, .3, bay);
      }
      this.pipe(iron, [-51, 58, z], [110, 58, z], .65, bay);
      this.pipe(steel, [-51, 62, z], [110, 62, z], .4, bay);
      for (let x = -50; x < 110; x += 10) this.pipe(iron, [x, 58, z], [x + 10, 62, z], .22, bay);
      this.pipe(iron, [110, 1, z], [110, 58, z], .7, bay).name = z === -12 ? 'zion-digger-side-support' : '';
      for (const y of [12, 45]) this.pipe(steel, [108, y, z - 6], [108, y, z + 6], .42, bay);
    }
    for (const post of DIGGERS.supports) this.box(steel, post.x, post.height / 2, post.z, post.width, post.height, post.depth, bay);
    for (let x = 20; x < 109; x += 8) {
      this.box(iron, x, .94, 0, .16, .08, 132, bay);
      for (const z of [-51, 42]) this.box(iron, x, 1, z, 5.5, .12, 3.2, bay);
    }
    batchStaticGeometry(bay, new Set()).forEach(g => this.geometry.add(g));
    for (const [x, y, z, intensity] of [[43, 43, 18, 18000], [-27, 13, 1, 1800]]) {
      const light = new THREE.PointLight(0xadc6ed, intensity, 130, 2); light.position.set(x, y, z); this.group.add(light);
    }
    this.wreck.name = 'digger-wreck'; this.group.add(this.wreck);
    this.drill.name = 'digger-body'; this.drill.position.set(DIGGERS.center.x, 1, DIGGERS.center.z); this.drill.scale.setScalar(DIGGERS.scale); this.wreck.add(this.drill);
    this.rotor.name = 'digger-cutting-crown'; this.drill.add(this.rotor);
    // George Hull's design separates the lower conical cutter, exposed drive and toothed upper drum.
    const profile = [[.15, 2], [1, 3], [2.1, 5], [3.4, 8], [4.8, 11.5], [6.5, 15.5], [6.8, 17.5]];
    this.mesh(new THREE.LatheGeometry(profile.map(([r, y]) => new THREE.Vector2(r, y)), 56), iron, this.rotor);
    const hot = this.material(0x563123, .65, .62); hot.emissive.set(0xbc4f17); hot.emissiveIntensity = .55;
    for (const [y, radius, h] of [[18.2, 6.7, 1.8], [34.9, 6, 1.2], [37.8, 6.4, 4.1]]) {
      const drum = this.mesh(new THREE.CylinderGeometry(radius, radius, h, 48), steel, this.drill); drum.position.y = y;
      for (const end of [-1, 1]) {
        const ring = this.mesh(new THREE.TorusGeometry(radius + .12, .27, 8, 48), piston, this.drill); ring.rotation.x = Math.PI / 2; ring.position.y = y + end * h / 2;
      }
    }
    const axle = this.mesh(new THREE.CylinderGeometry(1.8, 2.7, 15.2, 24), dark, this.drill); axle.position.y = 26;
    for (let i = 0; i < 8; i++) {
      const angle = i * Math.PI / 4, x = Math.cos(angle) * 4.35, z = Math.sin(angle) * 4.35;
      this.pipe(iron, [x, 19, z], [x * .8, 34.3, z * .8], .55, this.drill);
      this.pipe(piston, [x * .8, 25.5, z * .8], [x * .64, 35, z * .64], .21, this.drill);
      const line = new THREE.CatmullRomCurve3([new THREE.Vector3(x, 19.4, z), new THREE.Vector3(x * .65, 24, z * .65),
        new THREE.Vector3(-z * .55, 30, x * .55), new THREE.Vector3(x * .7, 34.3, z * .7)]);
      this.mesh(new THREE.TubeGeometry(line, 18, .15, 6, false), iron, this.drill);
      for (const y of [20.3, 24, 31.5, 33.5]) {
        const collar = this.mesh(new THREE.TorusGeometry(.59, .13, 6, 12), brass, this.drill); collar.rotation.x = Math.PI / 2; collar.position.set(x, y, z);
      }
      const vent = this.box(hot, Math.cos(angle) * 6.38, 37.8, Math.sin(angle) * 6.38, 1.5, 2.6, .15, this.drill);
      vent.rotation.y = Math.PI / 2 - angle;
      const fin = this.box(iron, Math.cos(angle + .15) * 6.7, 37.8, Math.sin(angle + .15) * 6.7, .6, 4.8, 1, this.drill);
      fin.rotation.y = -angle;
    }
    const teethGeometry = new THREE.BoxGeometry(.5, .65, .85); this.geometry.add(teethGeometry);
    const teeth = new THREE.InstancedMesh(teethGeometry, piston, 480); teeth.name = 'digger-cutting-teeth'; teeth.castShadow = teeth.receiveShadow = true; this.rotor.add(teeth);
    for (let i = 0; i < 480; i++) {
      const u = (i % 80) / 79, y = 3 + u * 14, angle = Math.floor(i / 80) * Math.PI / 3 + u * Math.PI * 4, radius = 1 + u * 5.5;
      this.scratch.position.set(Math.cos(angle) * radius, y, Math.sin(angle) * radius); this.scratch.rotation.set(.3, -angle, -.35); this.scratch.scale.setScalar(.55 + u * .7); this.scratch.updateMatrix(); teeth.setMatrixAt(i, this.scratch.matrix);
    }
    for (let i = 0; i < 4; i++) {
      const leg = new THREE.Group(); leg.name = `digger-leg-${i}`; this.drill.add(leg); this.legs.push(leg);
      const lower = new THREE.Group(); lower.name = `digger-lower-leg-${i}`; this.wreck.add(lower); this.lowerLegs.push(lower);
      const side = i < 2 ? -1 : 1, z = i % 2 ? -13 : 13;
      const hip: [number, number, number] = [side * 5, 22, z * .38], knee: [number, number, number] = [side * 13, 8, z], foot: [number, number, number] = [side * 16, .65, z * 1.15];
      for (const [a, b, radius] of [[hip, knee, 1.15], [knee, foot, .85]] as const) {
        const part = a === hip ? leg : lower;
        this.pipe(iron, [...a], [...b], radius, part);
        const start = new THREE.Vector3(...a), delta = new THREE.Vector3(...b).sub(start), rotation = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), delta.clone().normalize());
        for (let n = 0; n < 6; n++) {
          const plate = this.mesh(new THREE.BoxGeometry(radius * 2.65, delta.length() / 7, radius * 1.4), steel, part);
          plate.position.copy(start).addScaledVector(delta, .12 + n * .145); plate.quaternion.copy(rotation);
          plate.position.x += side * .45;
        }
        this.pipe(piston, [a[0] - side * 1.1, a[1], a[2]], [a[0] + (b[0] - a[0]) * .72 - side * 1.1, a[1] + (b[1] - a[1]) * .72, a[2] + (b[2] - a[2]) * .72], .32, part);
        this.pipe(dark, [a[0] + (b[0] - a[0]) * .5 - side * 1.1, a[1] + (b[1] - a[1]) * .5, a[2] + (b[2] - a[2]) * .5], [b[0] - side * 1.1, b[1], b[2]], .48, part);
      }
      const joint = this.mesh(new THREE.CylinderGeometry(1.6, 1.6, 1.65, 24), i < 2 ? brass : iron, leg);
      joint.name = `digger-knee-${i}`; joint.position.set(...knee); joint.rotation.z = Math.PI / 2; this.knees.push(joint);
      for (let bolt = 0; bolt < 8; bolt++) this.mesh(new THREE.CylinderGeometry(.16, .16, .22, 6), piston, joint).position.set(Math.sin(bolt * Math.PI / 4) * 1.1, 1, Math.cos(bolt * Math.PI / 4) * 1.1);
      this.box(iron, foot[0], .4, foot[2], 3.3, .8, 4.2, lower);
      for (const claw of [-1, 0, 1]) this.box(piston, foot[0] + claw, .35, foot[2] + Math.sign(z) * 1.8, .55, .7, 2, lower);
    }
    batchStaticGeometry(this.wreck, new Set()).forEach(g => this.geometry.add(g));
    this.sentinel.name = 'digger-screening-sentinel'; this.group.add(this.sentinel);
    const shell = this.mesh(new THREE.IcosahedronGeometry(1.25, 2), steel, this.sentinel); shell.scale.set(1.2, .6, 1.35);
    const eye = this.material(0xd95835, .2, .3); eye.emissive.set(0xff321a); eye.emissiveIntensity = 2.5;
    for (let i = 0; i < 7; i++) this.mesh(new THREE.SphereGeometry(i ? .12 : .2, 10, 8), eye, this.sentinel).position.set(i ? Math.cos(i) * .7 : 0, i ? Math.sin(i) * .35 : 0, -.95);
    const segment = new THREE.CylinderGeometry(.11, .13, .4, 6); this.geometry.add(segment);
    this.tentacles = new THREE.InstancedMesh(segment, piston, 6 * 18); this.tentacles.name = 'digger-sentinel-arms'; this.tentacles.frustumCulled = false; this.sentinel.add(this.tentacles);
    const glow = new THREE.MeshBasicMaterial({ color: 0xffdab0, toneMapped: false }); this.materials.push(glow);
    for (let i = 0; i < 2; i++) {
      const rocket = this.mesh(new THREE.CylinderGeometry(.13, .19, .8, 12), brass, this.group); rocket.name = `digger-rocket-${i}`; rocket.visible = false;
      const flame = this.mesh(new THREE.ConeGeometry(.18, 1.9, 8), glow, rocket); flame.position.y = -1.15; flame.rotation.z = Math.PI; this.rockets.push(rocket);
    }
    this.group.add(this.blast, this.flash); this.blast.name = 'digger-impact';
    for (let i = 0; i < 3; i++) {
      const flash = this.mesh(new THREE.IcosahedronGeometry(1, 1), glow, this.blast); flash.position.set(Math.sin(i) * .65, Math.cos(i) * .5, .2 * i);
    }
    const chip = new THREE.BoxGeometry(.22, .11, .34); this.geometry.add(chip);
    this.chips = new THREE.InstancedMesh(chip, steel, 60); this.chips.name = 'digger-joint-fragments'; this.chips.frustumCulled = false; this.group.add(this.chips);
    this.upper = new UpperDiggerRenderer(this.group, this.wreck, this.sentinel);
    this.group.visible = false;
  }
  private material(color: number, metalness: number, roughness: number): THREE.MeshStandardMaterial {
    const mat = new THREE.MeshStandardMaterial({ color, metalness, roughness }); this.materials.push(mat); return mat;
  }
  private mesh(geometry: THREE.BufferGeometry, material: THREE.Material, parent: THREE.Object3D): THREE.Mesh {
    this.geometry.add(geometry); const mesh = new THREE.Mesh(geometry, material); mesh.castShadow = mesh.receiveShadow = true; parent.add(mesh); return mesh;
  }
  private box(material: THREE.Material, x: number, y: number, z: number, w: number, h: number, d: number, parent: THREE.Object3D): THREE.Mesh {
    const mesh = this.mesh(new THREE.BoxGeometry(w, h, d), material, parent); mesh.position.set(x, y, z); return mesh;
  }
  private pipe(material: THREE.Material, a: [number, number, number], b: [number, number, number], radius: number, parent: THREE.Object3D): THREE.Mesh {
    const start = new THREE.Vector3(...a), end = new THREE.Vector3(...b), direction = end.clone().sub(start);
    const mesh = this.mesh(new THREE.CylinderGeometry(radius, radius, direction.length(), 12), material, parent);
    mesh.position.copy(start).add(end).multiplyScalar(.5); mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction.normalize()); return mesh;
  }
  private lowestSurface(root: THREE.Object3D): number {
    // A rotated bounding box includes empty corners below the cone. Use the visible metal, including cutter teeth.
    root.updateWorldMatrix(true, true);
    let lowest = Infinity;
    const matrix = new THREE.Matrix4(), instance = new THREE.Matrix4();
    root.traverseVisible(object => {
      if (!(object instanceof THREE.Mesh)) return;
      const positions = object.geometry.getAttribute('position'), instances = object instanceof THREE.InstancedMesh ? object.count : 1;
      for (let i = 0; i < instances; i++) {
        matrix.copy(object.matrixWorld);
        if (object instanceof THREE.InstancedMesh) { object.getMatrixAt(i, instance); matrix.multiply(instance); }
        const m = matrix.elements;
        for (let p = 0; p < positions.count; p++) lowest = Math.min(lowest, m[1] * positions.getX(p) + m[5] * positions.getY(p) + m[9] * positions.getZ(p) + m[13]);
      }
    });
    return lowest;
  }
  update(journey?: FilmJourney): void {
    const state = journey?.diggers;
    this.group.visible = Boolean(state && (state.phase === 'done' || !journey?.visiting && ['m3_diggers', 'm3_upper_digger', 'm3_dock_battle', 'm3_gate'].includes(journey!.scene)));
    if (!this.group.visible || !state) return;
    this.upper.update(journey);
    const frame = `${journey!.scene}/${state.phase}/${state.station}/${state.damage}/${state.total}/${state.elapsed}/${state.yaw}`;
    if (frame === this.lastFrame) return;
    this.lastFrame = frame;
    this.group.getObjectByName('digger-defense-duct')!.visible = journey!.scene === 'm3_diggers';
    const collapse = state.phase === 'done' ? 1 : state.phase === 'collapsing' ? Math.min(1, state.elapsed / DIGGERS.collapse) : 0;
    const tilt = collapse * collapse * 1.35;
    this.drill.rotation.z = tilt; this.drill.position.set(DIGGERS.center.x, 1, DIGGERS.center.z);
    this.rotor.rotation.y = state.total * .65 * (1 - collapse);
    this.legs.forEach((leg, i) => {
      const broken = i < 2 && Boolean(state.damage & (1 << i));
      const fracture = broken ? state.phase === 'done' || i < state.station ? 1 : Math.min(1, state.elapsed / 1.2) : 0;
      const hip = new THREE.Vector3(i < 2 ? -5 : 5, 22, (i % 2 ? -13 : 13) * .38);
      leg.rotation.z = fracture * .95; leg.position.copy(hip).sub(hip.clone().applyEuler(leg.rotation)); this.knees[i].visible = !broken;
    });
    const floor = this.group.getWorldPosition(new THREE.Vector3()).y + 1;
    this.drill.position.y += Math.max(0, floor - this.lowestSurface(this.drill));
    this.lowerLegs.forEach((leg, i) => {
      leg.position.copy(this.drill.position); leg.rotation.copy(this.drill.rotation); leg.scale.setScalar(DIGGERS.scale);
      if (i >= 2 || !(state.damage & (1 << i))) return;
      const fracture = state.phase === 'done' || i < state.station ? 1 : Math.min(1, state.elapsed / 1.2);
      const foot = new THREE.Vector3(-16, .65, (i % 2 ? -13 : 13) * 1.15);
      leg.rotation.set(0, 0, fracture * 1.35);
      leg.position.set(DIGGERS.center.x, 1, DIGGERS.center.z).add(foot).sub(foot.clone().applyEuler(leg.rotation));
      leg.position.y += Math.max(0, floor - this.lowestSurface(leg));
    });
    const shield = diggerShield(state); this.sentinel.position.set(shield.x, shield.y + 1, shield.z); this.sentinel.rotation.y = state.yaw + Math.PI;
    this.sentinel.visible = !['collapsing', 'done'].includes(state.phase);
    const up = new THREE.Vector3(0, 1, 0);
    for (let a = 0; a < 6; a++) for (let i = 0; i < 18; i++) {
      const u = i / 17, angle = a / 6 * Math.PI * 2;
      this.scratch.position.set(Math.cos(angle) * (1 + u * 2.4) + Math.sin(state.total * 3 + u * 4 + a) * u * .4, Math.sin(angle) * .45 - u * 1.1, 1 + u * 4.3);
      this.scratch.rotation.set(Math.PI / 2 + .2, 0, Math.cos(angle) * -.25); this.scratch.scale.setScalar(1 - u * .5); this.scratch.updateMatrix(); this.tentacles.setMatrixAt(a * 18 + i, this.scratch.matrix);
    }
    this.tentacles.instanceMatrix.needsUpdate = true;
    const shot = state.shot, age = shot ? state.total - shot.at : 99;
    this.rockets.forEach((rocket, i) => {
      rocket.visible = Boolean(shot && age >= i * .035 && age < shot.flight);
      if (!shot || !rocket.visible) return;
      const from = new THREE.Vector3(shot.from.x, shot.from.y + 1, shot.from.z), to = new THREE.Vector3(shot.to.x, shot.to.y + 1, shot.to.z);
      const direction = to.clone().sub(from).normalize();
      rocket.position.copy(from).lerp(to, Math.min(1, (age - i * .035) / shot.flight));
      rocket.position.x += Math.cos(state.yaw) * (i ? .2 : -.2); rocket.position.z -= Math.sin(state.yaw) * (i ? .2 : -.2);
      rocket.quaternion.setFromUnitVectors(up, direction);
    });
    const impact = shot ? age - shot.flight : 99;
    this.blast.visible = Boolean(shot && impact >= 0 && impact < .25); this.chips.visible = Boolean(shot && impact >= 0 && impact < 2);
    this.flash.intensity = this.blast.visible ? 240 * (1 - impact / .25) : 0;
    if (shot) {
      this.blast.position.set(shot.to.x, shot.to.y + 1, shot.to.z); this.blast.scale.setScalar(.7 + Math.max(0, impact) * 8); this.flash.position.copy(this.blast.position);
      if (this.chips.visible) for (let i = 0; i < 60; i++) {
        const angle = i * 2.4, t = impact;
        this.scratch.position.set(shot.to.x + Math.sin(angle) * t * (2 + i % 5), Math.max(1.08, shot.to.y + 1 + t * (i % 7) - t * t * 9), shot.to.z + Math.cos(angle) * t * 7);
        this.scratch.rotation.set(i + t * 2, t * 3, angle); this.scratch.scale.setScalar(1); this.scratch.updateMatrix(); this.chips.setMatrixAt(i, this.scratch.matrix);
      }
    }
    this.chips.instanceMatrix.needsUpdate = true;
  }
  dispose(): void {
    this.upper.dispose();
    this.disposed = true; this.group.removeFromParent(); this.group.traverse(object => { if (object instanceof THREE.Light) object.dispose(); });
    this.geometry.forEach(g => g.dispose()); this.materials.forEach(m => m.dispose()); this.textures.forEach(t => t.dispose()); this.group.clear();
  }
}
