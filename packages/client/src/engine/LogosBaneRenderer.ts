import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { LOGOS_BANE, logosBaneBeat, logosBaneHatch, logosBaneInjured, logosBaneRoot, logosBaneDroppedPipe, type BaneEncounter, type LogosBaneRole } from '@auto_matrix/shared';

/** An independent lower cargo bay. Its dimensions are a playable reconstruction. */
export class LogosBaneRenderer {
  readonly root = new THREE.Group();
  readonly ready: Promise<void>;
  private lights: { light: THREE.Light; intensity: number }[] = [];
  private gold = new THREE.Group();
  private goldBody?: THREE.Group;
  private goldMaterial = new THREE.MeshBasicMaterial({ color: 0xffb642, transparent: true, opacity: .85, depthWrite: false, depthTest: false, toneMapped: false, fog: false });
  private hatch = new THREE.Group();
  private ladder = new THREE.Group();
  private gun = new THREE.Group();
  private pipe = new THREE.Group();
  private blindMask: THREE.Mesh;
  private gunFlash: THREE.PointLight;
  private cableFlash: THREE.PointLight;
  private fill: THREE.HemisphereLight;
  private deckLights: THREE.PointLight[] = [];
  private materials = new Set<THREE.Material>();
  private geometries = new Set<THREE.BufferGeometry>();
  private textures = new Set<THREE.Texture>();
  private skeletons = new Set<THREE.Skeleton>();
  private instances = new Set<THREE.InstancedMesh>();
  private liveCable: THREE.InstancedMesh;
  private beam: THREE.Line;
  private disposed = false;

  constructor(private parent: THREE.Group) {
    parent.traverse(object => { if (object instanceof THREE.Light) this.lights.push({ light: object, intensity: object.intensity }); });
    parent.add(this.root); this.root.name = 'logos-bane-cargo-bay';
    this.fill = new THREE.HemisphereLight(0xa7bdd0, 0x171c23, .85); this.fill.name = 'logos-deck-fill'; this.root.add(this.fill);
    for (const z of [-26, -13, 0, 13]) {
      const light = new THREE.PointLight(0xc1d5e9, 110, 22, 2); light.position.set(.8, 5.8, z); this.root.add(light); this.deckLights.push(light);
    }
    const steel = this.material(0x46525c, .62, .65), dark = this.material(0x151b21, .78, .36), panels = this.material(0x2c353e, .71, .51);
    const bronze = this.material(0x786e5b, .65, .6), rubber = this.material(0x0c1117, .95), pale = this.material(0xb6c3c8, .4, .45);
    const h = LOGOS_BANE.hatch, deck = (x: number, z: number, w: number, d: number) => this.box(panels, x, -.1, z, w, .2, d);
    deck(0, (-34.5 + h.z - h.depth / 2) / 2, 12.2, h.z - h.depth / 2 + 34.5);
    deck(0, (22.5 + h.z + h.depth / 2) / 2, 12.2, 22.5 - h.z - h.depth / 2);
    for (const [a, b] of [[-6.1, h.x - h.width / 2], [h.x + h.width / 2, 6.1]]) deck((a + b) / 2, h.z, b - a, h.depth);
    for (const wall of LOGOS_BANE.walls) this.box(dark, wall.x, wall.height / 2, wall.z, wall.width, wall.height, wall.depth);
    this.box(dark, 0, 6.55, -6, 12.2, .25, 57);
    const curve = new THREE.CatmullRomCurve3(Array.from({ length: 25 }, (_, i) => {
      const a = i / 24 * Math.PI; return new THREE.Vector3(Math.cos(a) * 5.9, .25 + Math.sin(a) * 6, 0);
    }));
    const rib = this.geometry(new THREE.TubeGeometry(curve, 32, .12, 8, false));
    for (let z = -32; z <= 21; z += 4.8) { const mesh = new THREE.Mesh(rib, steel); mesh.position.z = z; this.root.add(mesh); }
    for (const x of [-5.35, 5.35]) for (const z of [-25, -13, 2, 15]) {
      this.box(panels, x, 1.55, z, 1.1, 3.1, 3.4);
      for (let y = .45; y < 3; y += .65) {
        this.box(dark, x - Math.sign(x) * .58, y, z, .08, .45, 3);
        this.box(bronze, x - Math.sign(x) * .64, y + .17, z, .09, .03, 2.8);
      }
    }
    const repeated: number[][] = [];
    for (const side of [-1, 1]) for (let z = -32; z < 22; z += 1.8) {
      for (const y of [3.8, 4.3, 4.8]) repeated.push([side * 5.94, y, z, .08, .08, 1.72]);
      repeated.push([side * 4.65, 6.1, z, .15, .12, 1.72]);
    }
    this.boxInstances(steel, repeated);
    for (const side of [-1, 1]) for (const z of [-28, -18, -8, 3, 14])
      this.tube([[side * 4.9, 6.1, z], [side * 4.7, 4.9, z + .6], [side * 5.65, 3.45, z + 1.2]], .13, rubber);
    for (let z = -32; z < 22; z += 3) {
      if (Math.abs(z - h.z) > h.depth / 2) this.box(steel, 0, .013, z, 12, .024, .028);
      for (const x of [-3, 0, 3]) if (Math.abs(x - h.x) > h.width / 2 || Math.abs(z + 1.5 - h.z) > h.depth / 2 + 1.5)
        this.box(steel, x, .012, z + 1.5, .026, .024, 2.97);
    }
    this.box(panels, -5.85, -1.45, h.z, .22, 3.7, 3.4);
    for (let i = 0; i < 5; i++) {
      this.box(pale, -5.67, -2.5 + i * .55, h.z + .8, .14, .3, .3);
      this.box(bronze, -5.56, -2.5 + i * .55, h.z + .8, .1, .16, .12);
    }
    this.box(dark, h.x, h.lower - .1, h.z, h.width, .2, h.depth);
    const rim = new THREE.Group(); rim.name = 'logos-engineering-hatch-rim'; this.root.add(rim);
    for (const side of [-1, 1]) {
      this.box(steel, h.x + side * h.width / 2, h.lower / 2, h.z, .08, -h.lower, h.depth);
      this.box(bronze, h.x + side * h.width / 2, .08, h.z, .12, .16, h.depth + .2, rim);
      this.box(bronze, h.x, .08, h.z + side * h.depth / 2, h.width, .16, .12, rim);
    }
    this.hatch.name = 'logos-engineering-hatch'; this.hatch.position.set(h.x - h.width / 2, .08, h.z); this.root.add(this.hatch);
    this.box(steel, h.width / 2, .08, 0, h.width, .14, h.depth, this.hatch);
    for (const z of [-1.1, 1.1]) this.box(dark, h.width / 2, .16, z, h.width - .3, .03, .08, this.hatch);
    this.tube([[h.width - .2, .19, -.22], [h.width - .2, .36, -.22], [h.width - .2, .36, .22], [h.width - .2, .19, .22]], .045, bronze, this.hatch);
    const ladder = LOGOS_BANE.ladder; this.ladder.name = 'logos-engineering-ladder'; this.root.add(this.ladder);
    for (let i = 0; i < ladder.count; i++) this.box(pale, ladder.x, ladder.bottom + i * ladder.gap, ladder.z, 1.1, .06, .13, this.ladder);
    for (const x of [-.55, .55]) this.box(steel, ladder.x + x, h.lower / 2, ladder.z, .07, -h.lower, .07, this.ladder);
    this.batchFixed(this.ladder);
    this.batchFixed();
    this.gun.name = 'bane-electric-gun'; this.root.add(this.gun);
    this.box(rubber, 0, -.11, 0, .22, .38, .15, this.gun); this.box(steel, 0, .11, .28, .27, .23, .74, this.gun);
    for (const x of [-.11, .11]) this.box(bronze, x, .11, .79, .06, .08, .28, this.gun);
    this.box(dark, 0, .17, .23, .16, .04, .55, this.gun);
    this.pipe.name = 'logos-bane-iron-pipe'; this.root.add(this.pipe);
    this.pipe.add(new THREE.Mesh(this.geometry(new THREE.CylinderGeometry(.065, .065, 2.2, 12)), steel));
    const blackout = new THREE.ShaderMaterial({ transparent: true, depthTest: false, depthWrite: false, toneMapped: false,
      vertexShader: 'void main() { gl_Position = vec4(position.xy, 0.0, 1.0); }',
      fragmentShader: 'void main() { gl_FragColor = vec4(0.0, 0.0, 0.0, 1.0); }' });
    this.materials.add(blackout); this.blindMask = new THREE.Mesh(this.geometry(new THREE.PlaneGeometry(2, 2)), blackout);
    this.blindMask.name = 'logos-blind-view-mask'; this.blindMask.frustumCulled = false; this.blindMask.renderOrder = 1; this.blindMask.visible = false; this.root.add(this.blindMask);
    this.gold.name = 'bane-gold-perception'; this.root.add(this.gold); this.materials.add(this.goldMaterial);
    this.goldMaterial.onBeforeCompile = shader => {
      shader.vertexShader = shader.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vGoldSurface;').replace('#include <begin_vertex>', '#include <begin_vertex>\nvGoldSurface = position;');
      shader.fragmentShader = shader.fragmentShader.replace('#include <common>', '#include <common>\nvarying vec3 vGoldSurface;').replace('#include <color_fragment>', '#include <color_fragment>\nfloat strands = .5 + .5 * sin(vGoldSurface.y * 540.0 + sin(vGoldSurface.x * 85.0) * 3.0);\ndiffuseColor.rgb *= .5 + strands * 1.1;');
    };
    this.goldMaterial.customProgramCacheKey = () => 'logos-gold-smith-v1';
    this.ready = typeof window === 'undefined' ? Promise.resolve() : this.loadGold();
    this.liveCable = new THREE.InstancedMesh(this.geometry(new THREE.CylinderGeometry(1, 1, 1, 8)), rubber, 24);
    this.liveCable.name = 'logos-live-cable'; this.root.add(this.liveCable); this.instances.add(this.liveCable);
    const geometry = this.geometry(new THREE.BufferGeometry()); geometry.setAttribute('position', new THREE.Float32BufferAttribute(new Float32Array(39), 3));
    const material = new THREE.LineBasicMaterial({ color: 0xd7e8ff, toneMapped: false }); this.materials.add(material);
    this.beam = new THREE.Line(geometry, material); this.beam.name = 'bane-electric-arc'; this.root.add(this.beam);
    this.gunFlash = new THREE.PointLight(0xcfe1ff, 0, 12, 2); this.root.add(this.gunFlash);
    this.cableFlash = new THREE.PointLight(0xffdb9e, 0, 9, 2); this.root.add(this.cableFlash);
  }

  private async loadGold(): Promise<void> {
    const asset = await new GLTFLoader().loadAsync('/assets/characters/smith.glb');
    asset.scene.traverse(object => {
      if (!(object instanceof THREE.Mesh)) return;
      this.geometries.add(object.geometry);
      for (const material of Array.isArray(object.material) ? object.material : [object.material]) {
        this.materials.add(material); const map = (material as THREE.MeshStandardMaterial).map; if (map) this.textures.add(map);
      }
      object.material = this.goldMaterial; object.renderOrder = 2; object.castShadow = object.receiveShadow = false;
      if (object instanceof THREE.SkinnedMesh) { this.skeletons.add(object.skeleton); object.frustumCulled = false; }
    });
    if (this.disposed) { this.release(); return; }
    this.goldBody = asset.scene; this.goldBody.name = 'logos-gold-smith-body'; this.gold.add(asset.scene);
  }

  update(encounter: BaneEncounter | undefined, step: number, _time: number, avatars?: (id: string) => THREE.Object3D | undefined, neoFirstPerson = false): void {
    const phase = encounter?.phase ?? 'ready', state = encounter?.physical, beat = logosBaneBeat(encounter);
    const cut = !['ready', 'gun_warning'].includes(phase), injured = logosBaneInjured(encounter), dark = neoFirstPerson && injured;
    this.blindMask.visible = dark;
    const clock = state && state.intro !== 'done' ? state.elapsed : encounter?.elapsed ?? 0, flicker = phase === 'gun_warning' ? .7 + .22 * Math.sin(clock * 29) : 1;
    for (const { light, intensity } of this.lights) light.intensity = intensity * (cut ? dark ? .025 : .24 : flicker);
    this.fill.intensity = cut ? dark ? .07 : .52 : .85 * flicker;
    for (const light of this.deckLights) light.intensity = 110 * (cut ? dark ? .015 : .32 : flicker);
    const local = (role: LogosBaneRole) => encounter ? logosBaneRoot(encounter, role) : role === 'neo' ? LOGOS_BANE.neo : role === 'bane' ? LOGOS_BANE.holder : LOGOS_BANE.hostage;
    const hand = (role: LogosBaneRole, side = 'R', pipeGrip = false) => {
      const wrist = avatars?.(role)?.getObjectByName('wrist_' + side), root = local(role);
      if (wrist) return this.parent.worldToLocal(wrist.localToWorld(pipeGrip && wrist.userData.logosBanePalm instanceof THREE.Vector3 ? wrist.userData.logosBanePalm.clone()
        : role === 'bane' ? new THREE.Vector3(0, -.1, .005) : new THREE.Vector3(side === 'R' ? .09 : -.09, -.18, .02)));
      return new THREE.Vector3(root.x + Math.cos(root.yaw) * .2, root.y + 3.15, root.z + Math.cos(root.yaw) * .85);
    };
    const eyes = (role: LogosBaneRole) => {
      const head = avatars?.(role)?.getObjectByName('head'), root = local(role);
      return head ? this.parent.worldToLocal(head.localToWorld((head.userData.cameraEye as THREE.Vector3 | undefined)?.clone() ?? new THREE.Vector3(0, .02, .23))) : new THREE.Vector3(root.x, root.y + 3.8, root.z);
    };
    const heldBy = state && state.intro !== 'done' && !['taking', 'recognition_ready', 'recognition'].includes(state.intro) ? 'neo' : 'bane';
    const dropped = state ? state.gunOnDeck : !['ready', 'gun_warning', 'gun_window'].includes(phase);
    this.gun.visible = true;
    if (dropped) { const point = state?.gunPoint ?? { x: 2.4, y: .26, z: -.7 }; this.gun.position.set(point.x, point.y, point.z); this.gun.rotation.set(0, .2, Math.PI / 2); }
    else {
      this.gun.position.copy(hand(heldBy));
      this.gun.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), eyes(heldBy === 'neo' ? 'bane' : 'neo').sub(this.gun.position).normalize());
      const resting = new THREE.Quaternion().setFromEuler(new THREE.Euler(0, .2, Math.PI / 2));
      if (state?.intro === 'lowering') this.gun.quaternion.slerp(resting, THREE.MathUtils.smoothstep(clock, .65, LOGOS_BANE.lowerSeconds * .68));
      else if (state?.intro === 'taking') this.gun.quaternion.copy(resting.slerp(this.gun.quaternion, THREE.MathUtils.smoothstep(clock, LOGOS_BANE.takeSeconds - .4, LOGOS_BANE.takeSeconds)));
    }
    this.hatch.rotation.z = (state ? logosBaneHatch(encounter) : step >= 3 ? 1 : 0) * 1.43;
    const bane = local('bane');
    const focus = phase === 'blind' ? (encounter?.focus ?? 0) / 1.8 : ['pipe_window', 'counter'].includes(phase) ? 1 : phase === 'defeated' && state ? 1 - state.fall / 1.2 : 0;
    this.gold.visible = neoFirstPerson && focus > .12; this.goldMaterial.opacity = .12 + .8 * focus; this.gold.position.set(bane.x, bane.y, bane.z); this.gold.rotation.y = bane.yaw;
    const baneBody = avatars?.('bane');
    if (baneBody) {
      baneBody.updateWorldMatrix(true, false);
      this.parent.matrixWorld.clone().invert().multiply(baneBody.matrixWorld).decompose(this.gold.position, this.gold.quaternion, this.gold.scale);
    }
    if (this.goldBody) for (const [name, x, z] of [['shoulder_R', -1.1, -.2], ['shoulder_L', -.95, .2], ['elbow_R', -.75, 0], ['elbow_L', -.7, 0]] as const) {
      const joint = this.goldBody.getObjectByName(name); if (joint) joint.rotation.set(x + (state?.strike ? Math.sin(state.strike.elapsed * 6) * .35 : 0), 0, z);
    }
    const pipeHeld = ['blind', 'pipe_window', 'counter', 'defeated'].includes(phase), pipeOwner = state?.strike?.kind === 'pipe' || phase === 'defeated' ? 'neo' : 'bane';
    const droppedPipe = logosBaneDroppedPipe(encounter);
    this.pipe.position.copy(droppedPipe ? new THREE.Vector3(droppedPipe.x, droppedPipe.y, droppedPipe.z)
      : pipeHeld ? hand(pipeOwner, 'R', true) : new THREE.Vector3(LOGOS_BANE.pipe.x, LOGOS_BANE.pipe.y, LOGOS_BANE.pipe.z));
    this.pipe.rotation.set(0, 0, droppedPipe?.roll ?? (pipeHeld ? .5 + (state?.strike ? Math.sin(state.strike.elapsed * 6) * 1.4 : 0) : Math.PI / 2));
    const endpoint = phase === 'burning' ? eyes('neo') : injured && state?.burnTo ? new THREE.Vector3(state.burnTo.x + .3, .1, state.burnTo.z + .2) : new THREE.Vector3(4.6, 1.1, -2);
    const cable = new THREE.CatmullRomCurve3([new THREE.Vector3(4.8, 6, -3), new THREE.Vector3(4.6, 4.9, -3.1),
      phase === 'burning' ? hand('bane').lerp(endpoint, .7) : injured ? new THREE.Vector3(4.5, .16, -3.1) : new THREE.Vector3(4.6, 2.2, -2.5), endpoint]), points = cable.getPoints(24), transform = new THREE.Object3D();
    for (let i = 0; i < 24; i++) {
      const a = points[i], b = points[i + 1]; transform.position.copy(a).add(b).multiplyScalar(.5); transform.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), b.clone().sub(a).normalize()); transform.scale.set(.055, a.distanceTo(b), .055); transform.updateMatrix(); this.liveCable.setMatrixAt(i, transform.matrix);
    }
    this.liveCable.instanceMatrix.needsUpdate = true; this.liveCable.computeBoundingSphere();
    this.cableFlash.position.copy(endpoint); this.cableFlash.intensity = phase === 'burning' ? 8 + Math.sin(clock * 43) * 3.5 : 0;
    this.gunFlash.position.copy(this.gun.position); this.gunFlash.intensity = phase === 'gun_window' ? 72 + Math.sin(clock * 44) * 27 : 0;
    this.beam.visible = phase === 'gun_window' || beat === 'dodge_gun';
    const beam = this.beam.geometry.attributes.position as THREE.BufferAttribute, source = this.gun.position, target = eyes('neo');
    for (let i = 0; i < 13; i++) { const t = i / 12, p = source.clone().lerp(target, t); p.x += Math.sin(i * 17 + clock * 43) * .035 * Math.sin(t * Math.PI); beam.setXYZ(i, p.x, p.y, p.z); }
    beam.needsUpdate = true; this.beam.geometry.computeBoundingSphere();
  }

  dispose(): void {
    this.disposed = true; this.root.removeFromParent(); this.root.clear();
    for (const { light, intensity } of this.lights) light.intensity = intensity;
    this.release(); this.instances.forEach(item => item.dispose()); this.instances.clear(); this.gunFlash.dispose(); this.cableFlash.dispose(); this.fill.dispose(); this.deckLights.forEach(light => light.dispose());
  }
  private release(): void { this.materials.forEach(item => item.dispose()); this.materials.clear(); this.geometries.forEach(item => item.dispose()); this.geometries.clear(); this.textures.forEach(item => item.dispose()); this.textures.clear(); this.skeletons.forEach(item => item.dispose()); this.skeletons.clear(); }
  private material(color: number, roughness: number, metalness = 0): THREE.MeshStandardMaterial { const item = new THREE.MeshStandardMaterial({ color, roughness, metalness }); this.materials.add(item); return item; }
  private geometry<T extends THREE.BufferGeometry>(item: T): T { this.geometries.add(item); return item; }
  private box(material: THREE.Material, x: number, y: number, z: number, w: number, h: number, d: number, parent = this.root): THREE.Mesh { const mesh = new THREE.Mesh(this.geometry(new THREE.BoxGeometry(w, h, d)), material); mesh.position.set(x, y, z); mesh.castShadow = mesh.receiveShadow = true; parent.add(mesh); return mesh; }
  private tube(points: number[][], radius: number, material: THREE.Material, parent = this.root): void { const curve = new THREE.CatmullRomCurve3(points.map(point => new THREE.Vector3().fromArray(point))); parent.add(new THREE.Mesh(this.geometry(new THREE.TubeGeometry(curve, 20, radius, 8, false)), material)); }
  private boxInstances(material: THREE.Material, items: number[][]): void {
    const mesh = new THREE.InstancedMesh(this.geometry(new THREE.BoxGeometry(1, 1, 1)), material, items.length), transform = new THREE.Object3D();
    items.forEach(([x, y, z, w, h, d], index) => { transform.position.set(x, y, z); transform.scale.set(w, h, d); transform.updateMatrix(); mesh.setMatrixAt(index, transform.matrix); });
    mesh.castShadow = mesh.receiveShadow = true; this.root.add(mesh); this.instances.add(mesh);
  }
  private batchFixed(root = this.root): void {
    root.updateWorldMatrix(true, true);
    const groups = new Map<THREE.Material, { mesh: THREE.Mesh; geometry: THREE.BufferGeometry }[]>();
    root.traverse(object => {
      if (!(object instanceof THREE.Mesh) || object instanceof THREE.InstancedMesh) return;
      for (let p: THREE.Object3D | null = object; p; p = p.parent) if (p === this.hatch || root === this.root && p === this.ladder) return;
      const material = object.material as THREE.Material, entries = groups.get(material) ?? [];
      const transform = root.matrixWorld.clone().invert().multiply(object.matrixWorld);
      entries.push({ mesh: object, geometry: object.geometry.clone().applyMatrix4(transform) }); groups.set(material, entries);
    });
    for (const [material, entries] of groups) {
      const geometry = this.geometry(mergeGeometries(entries.map(entry => entry.geometry))!);
      entries.forEach(entry => { entry.mesh.removeFromParent(); entry.geometry.dispose(); });
      const mesh = new THREE.Mesh(geometry, material); mesh.castShadow = mesh.receiveShadow = true; mesh.name = 'logos-fixed-equipment'; root.add(mesh);
    }
  }
}
