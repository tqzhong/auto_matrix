import * as THREE from 'three';
import { SMITH_FINALE, newSmithFinale, smithFinalePose, type SmithFinaleEncounter } from '@auto_matrix/shared';

/** Procedural production sample for the Revolutions rain duel.
 * Character rigs remain owned by AgentRenderer; this class owns the avenue,
 * Smith audience, destruction and connection effects around them. */
export class SmithFinaleRenderer {
  readonly group = new THREE.Group();
  private crowd = new THREE.Group();
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
  private shockShell!: THREE.Mesh;
  private purgeShell!: THREE.Mesh;
  private assimilationShell!: THREE.Mesh;
  private puddles: THREE.Mesh[] = [];
  private debris: THREE.Mesh[] = [];

  constructor(root: THREE.Group) {
    this.group.name = 'smith-finale-avenue'; this.crowd.name = 'smith-finale-crowd'; this.rain.name = 'smith-finale-rain';
    this.lightning.name = 'smith-finale-lightning'; this.shockwave.name = 'smith-finale-shockwave';
    this.trails.name = 'smith-finale-air-trails'; this.breach.name = 'smith-finale-building-breach';
    this.crater.name = 'smith-finale-crater'; this.assimilation.name = 'smith-finale-assimilation'; this.purge.name = 'smith-finale-purge';
    root.add(this.group); this.group.add(this.crowd, this.rain, this.lightning, this.shockwave, this.trails,
      this.breach, this.crater, this.assimilation, this.purge);
    this.buildAvenue(); this.buildCrowd(); this.buildWeather(); this.buildDestruction(); this.buildConnection();
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
    const wet = this.material({ color: 0x172528, metalness: .2, roughness: .18, envMapIntensity: 1.5 });
    const curb = this.material({ color: 0x4b5150, metalness: .06, roughness: .72 });
    const stone = this.material({ color: 0x202929, metalness: .12, roughness: .82 });
    const dark = this.material({ color: 0x090e0f, metalness: .35, roughness: .46 });
    const window = this.basic({ color: 0x6f967d, transparent: true, opacity: .7, toneMapped: false });
    const road = this.mesh(new THREE.PlaneGeometry(42, 150), wet, this.group, 0, .035, 0, 'smith-finale-flooded-road');
    road.rotation.x = -Math.PI / 2;
    for (const side of [-1, 1]) {
      this.mesh(new THREE.BoxGeometry(12, .32, 150), curb, this.group, side * 27, .13, 0, 'smith-finale-sidewalk');
      for (let segment = 0; segment < 10; segment++) {
        const z = -67.5 + segment * 15; const height = 27 + segment % 4 * 5;
        this.mesh(new THREE.BoxGeometry(13.5, height, 14.2), segment % 3 ? stone : dark, this.group,
          side * 32.5, height / 2, z, 'smith-finale-building');
        for (let floor = 2; floor < height - 2; floor += 3.4) for (let column = 0; column < 3; column++) {
          const pane = this.mesh(new THREE.PlaneGeometry(1.5, 1.65), window, this.group,
            side * 25.68, floor, z - 4.5 + column * 4.5, 'smith-finale-window');
          pane.rotation.y = side < 0 ? Math.PI / 2 : -Math.PI / 2;
        }
      }
    }
    const stripe = this.basic({ color: 0xb8b58c, transparent: true, opacity: .55 });
    for (const x of [-5.6, 5.6]) for (let z = -70; z < 74; z += 10)
      this.mesh(new THREE.BoxGeometry(.14, .025, 4.8), stripe, this.group, x, .075, z, 'smith-finale-road-stripe');
    const puddle = this.basic({ color: 0x8daaa2, transparent: true, opacity: .22, side: THREE.DoubleSide, depthWrite: false });
    for (let i = 0; i < 18; i++) {
      const ring = this.mesh(new THREE.RingGeometry(.16 + i % 4 * .08, .19 + i % 4 * .08, 24), puddle, this.group,
        -16 + (i * 7.7) % 32, .085, -66 + (i * 17.3) % 132, 'smith-finale-puddle-ripple');
      ring.rotation.x = -Math.PI / 2; this.puddles.push(ring);
    }
    const ambient = new THREE.HemisphereLight(0x9cb4ab, 0x07100f, .72); this.group.add(ambient); this.lights.push(ambient);
    for (const [x, z] of [[-17, -44], [17, -18], [-17, 14], [17, 43]] as const) {
      const lamp = new THREE.PointLight(0x9fc4ad, 260, 30, 2); lamp.position.set(x, 9, z); this.group.add(lamp); this.lights.push(lamp);
      this.mesh(new THREE.CylinderGeometry(.1, .13, 9, 8), dark, this.group, x, 4.5, z, 'smith-finale-lamp-post');
    }
  }

  private buildCrowd(): void {
    const count = 72; const dummy = new THREE.Object3D();
    const suit = this.material({ color: 0x101615, metalness: .18, roughness: .54 });
    const shirt = this.material({ color: 0xd2d5c9, metalness: 0, roughness: .72 });
    const skin = this.material({ color: 0xa89072, metalness: 0, roughness: .82 });
    const glass = this.basic({ color: 0x020404, toneMapped: false });
    const torso = new THREE.InstancedMesh(this.geometry(new THREE.BoxGeometry(1.45, 2.1, .72)), suit, count);
    const collar = new THREE.InstancedMesh(this.geometry(new THREE.BoxGeometry(.68, .3, .76)), shirt, count);
    const head = new THREE.InstancedMesh(this.geometry(new THREE.SphereGeometry(.48, 12, 8)), skin, count);
    const glasses = new THREE.InstancedMesh(this.geometry(new THREE.BoxGeometry(.88, .15, .08)), glass, count);
    torso.name = 'smith-finale-crowd-suits'; collar.name = 'smith-finale-crowd-collars'; head.name = 'smith-finale-crowd-heads'; glasses.name = 'smith-finale-crowd-glasses';
    for (let i = 0; i < count; i++) {
      const side = i % 2 ? 1 : -1; const row = Math.floor(i / 2); const z = -70 + row * 4;
      const x = side * (20.5 + row % 3 * 1.65); const yaw = side > 0 ? -.36 : .36;
      dummy.position.set(x, 2.05, z); dummy.rotation.set(0, yaw, 0); dummy.scale.set(1, 1, 1); dummy.updateMatrix(); torso.setMatrixAt(i, dummy.matrix);
      dummy.position.y = 3.17; dummy.scale.set(1, 1, 1); dummy.updateMatrix(); collar.setMatrixAt(i, dummy.matrix);
      dummy.position.y = 3.78; dummy.scale.set(1, 1.08, .92); dummy.updateMatrix(); head.setMatrixAt(i, dummy.matrix);
      dummy.position.y = 3.86; dummy.position.x -= Math.sin(yaw) * .43; dummy.position.z -= Math.cos(yaw) * .43;
      dummy.scale.set(1, 1, 1); dummy.updateMatrix(); glasses.setMatrixAt(i, dummy.matrix);
    }
    for (const mesh of [torso, collar, head, glasses]) { mesh.instanceMatrix.needsUpdate = true; mesh.castShadow = true; this.crowd.add(mesh); }
  }

  private buildWeather(): void {
    const rainMaterial = this.basic({ color: 0xa8c2ba, transparent: true, opacity: .4, depthWrite: false });
    const points: number[] = [];
    for (let i = 0; i < 520; i++) {
      const x = -34 + (i * 17.37) % 68; const y = (i * 11.23) % 48; const z = -74 + (i * 29.11) % 148;
      points.push(x, y, z, x - .08, y - 1.2 - i % 4 * .28, z + .18);
    }
    const geometry = this.geometry(new THREE.BufferGeometry()); geometry.setAttribute('position', new THREE.Float32BufferAttribute(points, 3));
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
    const pressure = this.basic({ color: 0xd9eee6, transparent: true, opacity: .24, wireframe: true, depthWrite: false, toneMapped: false });
    this.shockShell = this.mesh(new THREE.SphereGeometry(1, 24, 14), pressure, this.shockwave, 0, 5, -10, 'smith-finale-pressure-sphere');
    for (let i = 0; i < 4; i++) {
      const ring = this.mesh(new THREE.TorusGeometry(1, .035, 8, 64), pressure, this.shockwave, 0, 4 + i * .7, -10, 'smith-finale-pressure-ring');
      ring.rotation.x = Math.PI / 2 + i * .22;
    }
    const trail = this.basic({ color: 0xc5ded5, transparent: true, opacity: .18, depthWrite: false, side: THREE.DoubleSide, toneMapped: false });
    for (const side of [-1, 1]) {
      const cone = this.mesh(new THREE.ConeGeometry(1, 12, 14, 1, true), trail, this.trails, side * 4, 20, -18, 'smith-finale-flight-trail');
      cone.rotation.x = Math.PI / 2; cone.rotation.z = side * .2;
    }
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
    this.rain.position.y = -((state.total * 24) % 12); this.rain.visible = phase !== 'done';
    const flash = (Math.sin(state.total * 1.73 + 1.2) > .965 || ['shockwave', 'purging'].includes(phase));
    this.lightning.visible = flash && phase !== 'done';
    const flashLight = this.lightning.children.find(child => child instanceof THREE.PointLight) as THREE.PointLight | undefined;
    if (flashLight) flashLight.intensity = flash ? phase === 'purging' ? 1800 : 780 : 0;
    this.puddles.forEach((ring, index) => {
      const scale = .5 + ((state.total * 2.2 + index * .37) % 1) * 2.4; ring.scale.setScalar(scale);
    });
    this.shockwave.visible = phase === 'shockwave';
    if (this.shockwave.visible) {
      const progress = Math.min(1, state.elapsed / SMITH_FINALE.shockwave); this.shockwave.position.set(0, 0, -10);
      this.shockShell.scale.setScalar(2 + progress * 24); this.shockwave.rotation.y = state.elapsed * .7;
    }
    this.trails.visible = ['air_warning', 'air_dodge', 'air_counter', 'building', 'descent'].includes(phase);
    if (this.trails.visible) { this.trails.position.set(pose.neo.x * .3, pose.neo.y - 20, pose.neo.z + 18); this.trails.rotation.y = state.lane * .22; }
    const destroyed = ['building', 'descent', 'crater', 'choice', 'rain_done', 'assault_ready', 'assault', 'vision', 'understanding', 'surrender', 'assimilating', 'purging', 'done'].includes(phase);
    this.breach.visible = destroyed; this.crater.visible = ['descent', 'crater', 'choice', 'rain_done', 'assault_ready', 'assault', 'vision', 'understanding', 'surrender', 'assimilating', 'purging', 'done'].includes(phase);
    this.debris.forEach((chunk, index) => { if (destroyed) chunk.rotation.y += .001 * ((index % 3) - 1); });
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
    this.crowd.visible = phase !== 'done';
    this.crowd.scale.y = phase === 'purging' ? Math.max(.02, 1 - smithFinalePose(state).purge) : 1;
    this.rain.children.forEach(child => { child.visible = !firstPerson || child.position.z < player.z - 1 || child.position.z > player.z + 1; });
  }

  dispose(): void {
    this.group.removeFromParent(); this.group.clear(); this.geometries.forEach(geometry => geometry.dispose());
    this.materials.forEach(material => material.dispose()); this.lights.forEach(light => light.dispose());
  }
}
