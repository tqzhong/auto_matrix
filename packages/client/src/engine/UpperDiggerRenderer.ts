import * as THREE from 'three';
import { DIGGERS, UPPER_DIGGER, upperDiggerRoot, upperDiggerShot, upperDiggerFall, type FilmJourney } from '@auto_matrix/shared';
import { batchStaticGeometry } from './StaticGeometry.js';

export class UpperDiggerRenderer {
  readonly group = new THREE.Group();
  private machine: THREE.Group;
  private sentinels: THREE.Group[] = [];
  private rockets: THREE.Mesh[] = [];
  private flashes: { group: THREE.Group; flare: THREE.Sprite; smoke: THREE.Sprite; sparks: THREE.InstancedMesh }[] = [];
  private blastTexture: THREE.DataTexture;
  private hatch = new THREE.Group();
  private geometry = new Set<THREE.BufferGeometry>();
  private materials: THREE.Material[] = [];
  private scratch = new THREE.Object3D();
  constructor(parent: THREE.Group, drill: THREE.Group, sentinel: THREE.Group) {
    this.group.name = 'zion-upper-digger'; parent.add(this.group);
    this.machine = drill.clone(true); this.machine.name = 'second-digger'; this.group.add(this.machine);
    this.machine.position.set(UPPER_DIGGER.machine.x - DIGGERS.center.x, 0, UPPER_DIGGER.machine.z - DIGGERS.center.z);
    this.machine.traverse(object => { if (object.name.startsWith('digger-')) object.name = 'second-' + object.name; });
    for (let i = 0; i < 4; i++) this.machine.getObjectByName(`second-digger-lower-leg-${i}`)!.position.set(DIGGERS.center.x, 1, DIGGERS.center.z);
    const steel = new THREE.MeshStandardMaterial({ color: 0x5e6d72, roughness: .72, metalness: .65 });
    const dark = new THREE.MeshStandardMaterial({ color: 0x263438, roughness: .8, metalness: .5 });
    const brass = new THREE.MeshStandardMaterial({ color: 0x9b8355, roughness: .7, metalness: .5 });
    const glow = new THREE.MeshBasicMaterial({ color: 0xffc47e, toneMapped: false }); this.materials.push(steel, dark, brass, glow);
    const pixels = new Uint8Array(64 * 64 * 4);
    for (let y = 0; y < 64; y++) for (let x = 0; x < 64; x++) {
      const index = (y * 64 + x) * 4, radius = Math.hypot(x - 31.5, y - 31.5) / 31.5;
      pixels[index] = pixels[index + 1] = pixels[index + 2] = 255;
      pixels[index + 3] = Math.round(Math.max(0, 1 - radius) ** 2 * 255);
    }
    this.blastTexture = new THREE.DataTexture(pixels, 64, 64); this.blastTexture.needsUpdate = true;
    this.blastTexture.magFilter = this.blastTexture.minFilter = THREE.LinearFilter;
    const fixed = new THREE.Group(); fixed.name = 'upper-digger-service-channel'; this.group.add(fixed);
    // Pipe elbows descend towards the dock, leaving a narrow service gap between them.
    for (const z of UPPER_DIGGER.pipes) {
      const curve = new THREE.CatmullRomCurve3([new THREE.Vector3(-53, 47, z), new THREE.Vector3(-16, 47, z),
        new THREE.Vector3(-9, 46, z), new THREE.Vector3(-6, 40, z), new THREE.Vector3(-6, 3, z)]);
      this.mesh(new THREE.TubeGeometry(curve, 56, 2.55, 16, false), steel, fixed).name = 'upper-digger-major-pipe';
      for (let x = -49; x < -12; x += 6) {
        const ring = this.mesh(new THREE.TorusGeometry(2.65, .14, 8, 24), dark, fixed); ring.position.set(x, 47, z); ring.rotation.y = Math.PI / 2;
        for (let i = 0; i < 8; i++) {
          const bolt = this.mesh(new THREE.CylinderGeometry(.12, .12, .35, 6), brass, fixed);
          bolt.rotation.z = Math.PI / 2; bolt.position.set(x, 47 + Math.cos(i * Math.PI / 4) * 2.65, z + Math.sin(i * Math.PI / 4) * 2.65);
        }
      }
    }
    // The real aperture is left out of the deck; no hidden plane covers the ladder.
    this.box(steel, -26.8, 44.8, 28, 31.2, .4, 4, fixed);
    for (const z of [26.15, 29.85]) this.box(steel, -44.9, 44.8, z, 5, .4, .3, fixed);
    this.box(steel, -47, 44.8, 28, 1, .4, 4, fixed);
    for (let x = -41; x < -11.5; x += .8) this.box(dark, x, 45.01, 28, .065, .025, 3.9, fixed);
    const rungs = UPPER_DIGGER.rungs, top = 1 + rungs.first + (rungs.count - 1) * rungs.spacing;
    for (const z of [26.65, 29.35]) this.pipe(steel, [rungs.x, 1, z], [rungs.x, top + .4, z], .1, fixed);
    for (let i = 0; i < rungs.count; i++) {
      const y = 1 + rungs.first + i * rungs.spacing;
      this.pipe(steel, [rungs.x, y, 26.65], [rungs.x, y, 29.35], rungs.radius, fixed);
    }
    for (const x of [-40, -32, -24]) {
      this.box(dark, x, 47.8, 28, .4, .4, 5, fixed);
      this.pipe(dark, [x, 45, 25.8], [x, 50, 25.8], .2, fixed);
      this.pipe(dark, [x, 45, 30.2], [x, 50, 30.2], .2, fixed);
      this.box(brass, x + .25, 47.55, 28, .3, .08, 1.2, fixed);
    }
    for (const z of [25.9, 30.1]) this.box(dark, -27, 44.1, z, 31, 1.3, .35, fixed);
    const collar = this.mesh(new THREE.TorusGeometry(1.55, .15, 10, 36), dark, fixed); collar.rotation.x = Math.PI / 2; collar.position.set(-44, 45, 28);
    this.hatch.position.set(-45.55, 45, 28); this.group.add(this.hatch);
    const lid = this.mesh(new THREE.CylinderGeometry(1.48, 1.48, .14, 32), steel, this.hatch); lid.position.x = 1.48;
    this.pipe(brass, [.6, .2, 0], [1.5, .2, 0], .08, this.hatch);
    this.hatch.rotation.z = 1.6;
    batchStaticGeometry(fixed, new Set()).forEach(geometry => this.geometry.add(geometry));
    const fill = new THREE.PointLight(0xb5cce4, 550, 26, 2); fill.position.set(-28, 51, 28); this.group.add(fill);
    for (let i = 0; i < 3; i++) {
      const machine = sentinel.clone(true); machine.name = `upper-digger-sentinel-${i}`; this.group.add(machine); this.sentinels.push(machine);
      if (i === 2) continue;
      const rocket = this.mesh(new THREE.CylinderGeometry(.14, .14, .9, 10), brass, this.group); rocket.name = `upper-digger-rocket-${i}`; this.rockets.push(rocket);
      const exhaust = this.mesh(new THREE.ConeGeometry(.18, 1.8, 8), glow, rocket); exhaust.rotation.z = Math.PI; exhaust.position.y = -1.2;
      const burst = new THREE.Group(); burst.name = `upper-digger-interception-${i}`; this.group.add(burst);
      const fire = new THREE.SpriteMaterial({ map: this.blastTexture, color: 0xffd8a4, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false });
      const ash = new THREE.SpriteMaterial({ map: this.blastTexture, color: 0x777d7f, transparent: true, depthWrite: false });
      this.materials.push(fire, ash);
      const flare = new THREE.Sprite(fire), smoke = new THREE.Sprite(ash); burst.add(smoke, flare);
      flare.raycast = smoke.raycast = () => {};
      const chip = new THREE.BoxGeometry(.07, .5, .07); this.geometry.add(chip);
      const sparks = new THREE.InstancedMesh(chip, glow, 40); sparks.frustumCulled = false; burst.add(sparks);
      sparks.raycast = () => {};
      this.flashes.push({ group: burst, flare, smoke, sparks });
    }
    this.group.visible = false;
  }
  private mesh(geometry: THREE.BufferGeometry, material: THREE.Material, parent: THREE.Object3D): THREE.Mesh {
    this.geometry.add(geometry); const mesh = new THREE.Mesh(geometry, material); mesh.castShadow = mesh.receiveShadow = true; parent.add(mesh); return mesh;
  }
  private box(material: THREE.Material, x: number, y: number, z: number, width: number, height: number, depth: number, parent: THREE.Object3D): THREE.Mesh {
    const mesh = this.mesh(new THREE.BoxGeometry(width, height, depth), material, parent); mesh.position.set(x, y, z); return mesh;
  }
  private pipe(material: THREE.Material, a: [number, number, number], b: [number, number, number], radius: number, parent: THREE.Object3D): THREE.Mesh {
    const from = new THREE.Vector3(...a), to = new THREE.Vector3(...b), direction = to.clone().sub(from);
    const mesh = this.mesh(new THREE.CylinderGeometry(radius, radius, direction.length(), 12), material, parent);
    mesh.position.copy(from).add(to).multiplyScalar(.5); mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction.normalize()); return mesh;
  }
  update(journey?: FilmJourney): void {
    const state = journey?.upperDigger;
    this.group.visible = Boolean(state && (state.charraDead || !journey?.visiting && ['m3_upper_digger', 'm3_dock_battle', 'm3_gate'].includes(journey!.scene)));
    if (!state || !this.group.visible) return;
    this.machine.getObjectByName('second-digger-cutting-crown')!.rotation.y = state.total * .65;
    const shot = upperDiggerShot(), firing = state.phase === 'shot', t = state.elapsed;
    const from = new THREE.Vector3(shot.from.x, shot.from.y + 1, shot.from.z), to = new THREE.Vector3(shot.to.x, shot.to.y + 1, shot.to.z);
    const direction = to.clone().sub(from).normalize(), up = new THREE.Vector3(0, 1, 0);
    this.rockets.forEach((rocket, i) => {
      const age = t - .5 - i * .12; rocket.visible = firing && age >= 0 && age < shot.flight;
      rocket.position.copy(from).lerp(to, Math.min(1, Math.max(0, age / shot.flight))); rocket.position.z += (i ? .2 : -.2);
      rocket.quaternion.setFromUnitVectors(up, direction);
      const flash = this.flashes[i], burstAge = age - shot.flight;
      flash.group.visible = firing && burstAge >= 0 && burstAge < 1.2;
      flash.group.position.copy(to); flash.group.position.z += (i ? .2 : -.2);
      if (flash.group.visible) {
        flash.flare.scale.setScalar(5 + burstAge * 5); flash.flare.material.opacity = Math.exp(-burstAge * 7);
        flash.smoke.scale.setScalar(3 + burstAge * 7); flash.smoke.position.y = burstAge * 1.8; flash.smoke.material.opacity = .8 * (1 - burstAge / 1.2);
        for (let j = 0; j < flash.sparks.count; j++) {
          const angle = j * 2.39996, height = (j + .5) / flash.sparks.count * 2 - 1, radius = Math.sqrt(1 - height * height);
          const velocity = new THREE.Vector3(Math.cos(angle) * radius, height, Math.sin(angle) * radius).multiplyScalar(7 + j % 5 * 2);
          this.scratch.position.copy(velocity).multiplyScalar(burstAge); this.scratch.position.y -= burstAge * burstAge * 4.9;
          this.scratch.quaternion.setFromUnitVectors(up, velocity.normalize()); this.scratch.scale.set(1, .5 + burstAge * 1.8, 1); this.scratch.updateMatrix();
          flash.sparks.setMatrixAt(j, this.scratch.matrix);
        }
        flash.sparks.instanceMatrix.needsUpdate = true;
      }
    });
    const attacked = state.phase === 'attack' || state.charraDead, retreating = ['retreat', 'escape'].includes(state.phase);
    for (let i = 0; i < 3; i++) {
      const sentinel = this.sentinels[i], hunter = i === 2, age = t - .5 - i * .12;
      const spent = attacked || retreating || ['hatch', 'dismounting', 'descending', 'done'].includes(state.phase) || state.phase === 'failed' && state.grip === 1;
      sentinel.visible = journey!.scene === 'm3_upper_digger' && !['done', 'descending'].includes(state.phase)
        && (hunter ? attacked || retreating : !spent && (!firing || age < shot.flight + .18));
      if (!sentinel.visible) continue;
      if (hunter) sentinel.position.set(attacked ? -17 : THREE.MathUtils.lerp(-5, -17, Math.min(1, t / 2.3)), 51, 28);
      else {
        const approach = firing ? THREE.MathUtils.smoothstep(age, 0, shot.flight) : 0;
        sentinel.position.copy(to).add(new THREE.Vector3(0, (i ? 1 : -1) * 4 * (1 - approach), (i ? .2 : -.2) + (i ? 1 : -1) * 5 * (1 - approach)));
      }
      sentinel.rotation.y = -Math.PI / 2; sentinel.updateWorldMatrix(true, true);
      const arms = sentinel.getObjectByName('digger-sentinel-arms') as THREE.InstancedMesh;
      for (let arm = 0; arm < 6; arm++) {
        const angle = arm / 6 * Math.PI * 2, start = new THREE.Vector3(Math.cos(angle), Math.sin(angle) * .4, .8);
        let end = new THREE.Vector3(Math.cos(angle) * 2.8, hunter ? 1.5 + Math.sin(angle) * .4 : Math.sin(angle) - 1, 6);
        if (attacked && hunter && arm < 2) {
          const body = upperDiggerRoot(state, 'charra'), blend = state.charraDead ? 1 : THREE.MathUtils.smoothstep(t, .2, 1.2);
          const collapse = upperDiggerFall(state);
          const point = this.group.localToWorld(new THREE.Vector3(body.x - .6 - arm * .3, body.y + 2.06 - collapse * .44, body.z + (arm ? .12 : -.12)));
          end.lerp(sentinel.worldToLocal(point), blend);
        }
        const bend = start.clone().lerp(end, .5).add(new THREE.Vector3(Math.sin(state.total * 2 + arm) * .45, .9, .4));
        const curve = new THREE.QuadraticBezierCurve3(start, bend, end);
        for (let j = 0; j < 18; j++) {
          const a = curve.getPoint(j / 18), b = curve.getPoint((j + 1) / 18), delta = b.clone().sub(a);
          this.scratch.position.copy(a).add(b).multiplyScalar(.5); this.scratch.quaternion.setFromUnitVectors(up, delta.clone().normalize());
          this.scratch.scale.set(1 - j / 40, delta.length() / .4, 1 - j / 40); this.scratch.updateMatrix(); arms.setMatrixAt(arm * 18 + j, this.scratch.matrix);
        }
      }
      arms.instanceMatrix.needsUpdate = true;
    }
  }
  dispose(): void {
    this.group.removeFromParent(); this.group.traverse(object => { if (object instanceof THREE.Light || object instanceof THREE.InstancedMesh) object.dispose(); });
    this.geometry.forEach(geometry => geometry.dispose()); this.materials.forEach(material => material.dispose()); this.blastTexture.dispose(); this.group.clear();
  }
}
