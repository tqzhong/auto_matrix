import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { DREAM_CABINETS, RELOADED, RELOADED_TABLE, RELOADED_WALLS, newReloaded, reloadedRoot, type FilmJourney } from '@auto_matrix/shared';

/** Set-specific surfaces and props. Moving effects use the persisted encounter clock. */
export class ReloadedOpeningRenderer {
  readonly group = new THREE.Group();
  private static = new THREE.Group();
  private geometries = new Set<THREE.BufferGeometry>();
  private materials = new Set<THREE.Material>();
  private textures = new Set<THREE.Texture>();
  private lights = new Set<THREE.Light>();
  private door = new THREE.Group();
  private shards = new THREE.Group();
  private envelope = new THREE.Group();
  private glass?: THREE.Mesh;
  private sight = new THREE.Group();
  private flash = new THREE.Group();
  private exits: THREE.MeshStandardMaterial[] = [];
  private disposed = false;
  constructor(root: THREE.Group, readonly set: 'film_trinity_roof' | 'film_captains_meeting' | 'film_neb_deck') {
    this.group.name = 'reloaded-opening-set'; root.add(this.group); this.group.add(this.static);
    if (set === 'film_trinity_roof') this.dream();
    else if (set === 'film_captains_meeting') this.meeting();
    else this.ship();
    this.batch();
  }
  private material(color: number, roughness = .75, metalness = .05, emissive = 0, intensity = 0): THREE.MeshStandardMaterial {
    const material = new THREE.MeshStandardMaterial({ color, roughness, metalness, emissive, emissiveIntensity: intensity }); this.materials.add(material); return material;
  }
  private texture(draw: (ctx: CanvasRenderingContext2D) => void, repeatX = 1, repeatY = 1): THREE.CanvasTexture | undefined {
    if (typeof document === 'undefined') return;
    const canvas = document.createElement('canvas'); canvas.width = canvas.height = 512; const ctx = canvas.getContext('2d')!; draw(ctx);
    const texture = new THREE.CanvasTexture(canvas); texture.colorSpace = THREE.SRGBColorSpace; texture.wrapS = texture.wrapT = THREE.RepeatWrapping; texture.repeat.set(repeatX, repeatY); texture.anisotropy = 4; this.textures.add(texture); return texture;
  }
  private surface(name: string, color: number, scale: number): THREE.MeshStandardMaterial {
    const material = this.material(color, .88, .08);
    if (typeof document !== 'undefined') {
      const loader = new THREE.TextureLoader();
      for (const [suffix, field] of [['color', 'map'], ['normal', 'normalMap'], ['roughness', 'roughnessMap']] as const) {
        const texture = loader.load(`/assets/film-materials/${name}-${suffix}.jpg`, loaded => { if (this.disposed) loaded.dispose(); });
        texture.wrapS = texture.wrapT = THREE.RepeatWrapping; texture.repeat.set(scale, scale); texture.anisotropy = 4;
        if (field === 'map') texture.colorSpace = THREE.SRGBColorSpace; material[field] = texture; this.textures.add(texture);
      }
      material.normalScale.set(.35, .35);
    }
    return material;
  }
  private mesh(geometry: THREE.BufferGeometry, material: THREE.Material, parent: THREE.Object3D = this.static, name?: string): THREE.Mesh {
    const mesh = new THREE.Mesh(geometry, material); mesh.castShadow = true; mesh.receiveShadow = true; if (name) mesh.name = name; parent.add(mesh); this.geometries.add(geometry); return mesh;
  }
  private box(material: THREE.Material, x: number, y: number, z: number, w: number, h: number, d: number, parent: THREE.Object3D = this.static, name?: string): THREE.Mesh {
    const mesh = this.mesh(new THREE.BoxGeometry(w, h, d), material, parent, name); mesh.position.set(x, y, z); return mesh;
  }
  private tube(material: THREE.Material, a: number[], b: number[], radius: number, parent: THREE.Object3D = this.static): THREE.Mesh {
    const from = new THREE.Vector3(...a); const to = new THREE.Vector3(...b); const delta = to.sub(from);
    const mesh = this.mesh(new THREE.CylinderGeometry(radius, radius, delta.length(), 10), material, parent); mesh.position.copy(from).addScaledVector(delta, .5); mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), delta.normalize()); return mesh;
  }
  private light(color: number, strength: number, range: number, x: number, y: number, z: number): void {
    const light = new THREE.PointLight(color, strength, range, 2); light.position.set(x, y, z); this.group.add(light); this.lights.add(light);
  }
  private label(text: string, x: number, y: number, z: number, width: number, height: number, parent: THREE.Object3D = this.static): void {
    const material = this.material(0xd1d7bb, .8);
    material.map = this.texture(ctx => { ctx.fillStyle = '#17201b'; ctx.fillRect(0, 0, 512, 512); ctx.strokeStyle = '#aeb395'; ctx.lineWidth = 6; ctx.strokeRect(12, 120, 488, 260); ctx.fillStyle = '#b9c3a4'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.font = 'bold 44px monospace'; ctx.fillText(text, 256, 256, 475); }) ?? null;
    const sign = this.mesh(new THREE.PlaneGeometry(width, height), material, parent); sign.position.set(x, y, z);
  }
  private meeting(): void {
    const brick = this.material(0xaaa496, .95); brick.map = this.texture(ctx => {
      ctx.fillStyle = '#292c25'; ctx.fillRect(0, 0, 512, 512);
      for (let row = 0; row < 16; row++) for (let col = -1; col < 9; col++) {
        const value = 62 + (row * 17 + col * 23 + 512) % 35; ctx.fillStyle = `rgb(${value + 13},${value + 8},${value})`;
        ctx.fillRect(col * 64 + row % 2 * 32 + 2, row * 32 + 2, 60, 28);
      }
      for (let i = 0; i < 3000; i++) { ctx.fillStyle = i % 2 ? '#00000012' : '#dedfc20a'; ctx.fillRect(i * 59 % 512, i * 101 % 512, 2, 3); }
    }, 3, 2) ?? null;
    const concrete = this.surface('damaged_plaster', 0x969b8c, 4); const steel = this.surface('metal_plate', 0x566461, 2);
    const black = this.material(0x111815, .5, .6); const warm = this.material(0xdacb9b, .3, .12, 0xefddae, 3);
    this.box(concrete, 0, -.2, 5, 46, .4, 80, this.static, 'reloaded-floor');
    for (const wall of RELOADED_WALLS) this.box(brick, wall.x, wall.height / 2, wall.z, wall.width, wall.height, wall.depth);
    // Elliptical vault and brick ribs; the entrance and both escape aisles stay open.
    const vertices: number[] = []; const uv: number[] = []; const indices: number[] = [];
    for (let z = 0; z <= 8; z++) for (let arc = 0; arc <= 28; arc++) {
      const theta = arc / 28 * Math.PI; vertices.push(Math.cos(theta) * 12.8, 10 + Math.sin(theta) * 7, -20 + z * 7); uv.push(arc / 28 * 2, z / 8 * 4);
      if (arc < 28 && z < 8) { const a = z * 29 + arc; indices.push(a, a + 1, a + 29, a + 1, a + 30, a + 29); }
    }
    const vault = new THREE.BufferGeometry(); vault.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3)); vault.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); vault.setIndex(indices); vault.computeVertexNormals(); brick.side = THREE.DoubleSide; this.mesh(vault, brick);
    for (let z = -18; z <= 34; z += 8) {
      const rib = this.mesh(new THREE.TorusGeometry(12.6, .32, 7, 32, Math.PI), concrete); rib.position.set(0, 10, z); rib.scale.y = .55;
      for (const x of [-12.4, 12.4]) this.box(concrete, x, 5, z, .9, 10, 1);
    }
    for (const x of [-11.8, 11.8]) for (const y of [7.7, 8.6]) {
      this.tube(steel, [x, y, -18], [x, y, 34], .16);
      for (let z = -14; z <= 32; z += 8) this.box(black, x, y, z, .5, .54, .16);
    }
    for (const z of [-13, 1, 17, 30]) {
      this.tube(black, [0, 16.6, z], [0, 10.3, z], .045);
      const shade = this.mesh(new THREE.ConeGeometry(1.05, .75, 20, 1, true), black); shade.position.set(0, 10.4, z);
      this.box(warm, 0, 10, z, 1.3, .06, 1.3); this.light(0xe5d6ad, 130, 24, 0, 9.7, z);
    }
    const table = RELOADED_TABLE; this.box(this.material(0x655b3d, .87), table.x, table.height - .14, table.z, table.width, .28, table.depth, this.static, 'captains-folding-table');
    for (const x of [-4.2, 4.2]) { this.tube(steel, [x - .4, 0, 18.9], [x + .4, 2.4, 21], .09); this.tube(steel, [x + .4, 0, 18.9], [x - .4, 2.4, 21], .09); }
    for (let i = 0; i < 5; i++) {
      const photo = this.material(0xe0d7b7, .9); photo.map = this.texture(ctx => {
        ctx.fillStyle = '#d0c9ac'; ctx.fillRect(0, 0, 512, 512); ctx.fillStyle = '#1d2523'; ctx.fillRect(20, 20, 472, 418);
        for (let y = 0; y < 22; y++) for (let x = 0; x < 25; x++) { const v = (Math.sin(x * .31 + i) + Math.cos(y * .5) + 2) / 4; ctx.fillStyle = `rgb(${Math.floor(v * 197)},${Math.floor(44 + v * 69)},${Math.floor(27 + v * 37)})`; ctx.fillRect(25 + x * 18, 25 + y * 18, 18, 18); }
        ctx.fillStyle = '#323a31'; ctx.font = 'bold 22px monospace'; ctx.fillText(i % 2 ? 'SEISMIC / OSIRIS' : 'GEOTHERM / ZION', 25, 478);
      }) ?? null;
      const paper = this.mesh(new THREE.PlaneGeometry(1.65, 2), photo); paper.rotation.set(-Math.PI / 2, 0, (i - 2) * .16); paper.position.set(-3.2 + i * 1.65, 2.615, 20);
    }
    this.door.name = 'captains-entry-door'; this.door.position.set(-3.7, 0, -20); this.group.add(this.door);
    this.box(steel, 3.7, 4.3, 0, 7.4, 8.6, .3, this.door); this.box(black, 5.8, 4.2, .3, .16, 1.2, .18, this.door);
    this.box(black, 3.7, 6.3, .2, 2, .45, .12, this.door); this.tube(black, [2, 3.7, .25], [6, 3.7, .25], .09, this.door);
    this.label('SUBMETRO ACCESS', 0, 10.2, -19.55, 6, 2);
    for (const [i, x] of [-18, 18].entries()) {
      const material = this.material(0x6c9972, .3, .1, 0x297846, .3); this.exits.push(material);
      this.box(material, x, 7, 33, 5, 1.1, .18); this.label(i ? 'EXIT / EAST' : 'EXIT / WEST', x, 7, 33.15, 4.6, 1.4);
      this.box(brick, x, 5.5, 35, 10, 11, .7); this.light(0x86bc9d, 38, 12, x, 6.5, 28);
    }
    // Exterior alley gives the broken door a destination rather than a black void.
    for (const x of [-20, 20]) { this.box(brick, x, 15, -32, 5, 30, 20); for (let y = 5; y < 29; y += 5) for (let z = -39; z < -23; z += 6) this.box(black, x > 0 ? 17.4 : -17.4, y, z, .12, 2.7, 2.2); }
    for (const x of [-10, 10]) { this.tube(steel, [x, 0, -31], [x, 9, -31], .12); this.box(warm, x, 9, -31, .9, .3, .9); this.light(0xe4cda4, 64, 22, x, 8.8, -31); }
    this.envelope.name = 'smith-earpiece-envelope'; this.envelope.position.set(0, 2.8, -15.1); this.group.add(this.envelope);
    this.box(this.material(0xcac5a9, .96), 0, 0, 0, 1.05, .07, .65, this.envelope);
    const wire = this.mesh(new THREE.TorusGeometry(.18, .035, 8, 24, Math.PI * 1.7), this.material(0xb4b9aa, .24, .7), this.envelope); wire.rotation.x = -Math.PI / 2; wire.position.y = .11;
    this.box(black, -.18, .13, -.06, .11, .18, .12, this.envelope);
  }
  private dream(): void {
    const metal = this.surface('metal_plate', 0x526965, 2); const plaster = this.surface('white_plaster_02', 0x8c9e8e, 3);
    const black = this.material(0x101d1b, .5, .45); const light = this.material(0xc5d5b4, .2, .1, 0xabc69a, 2);
    this.box(black, 0, -.2, 7, 30, .4, 50);
    for (const x of [-15, 15]) this.box(plaster, x, 6.3, 7, .6, 12.6, 50);
    this.box(plaster, 0, 12.6, 7, 30, .35, 50);
    for (const cabinet of DREAM_CABINETS) {
      this.box(metal, cabinet.x, cabinet.height / 2, cabinet.z, cabinet.width, cabinet.height, cabinet.depth);
      for (let row = 0; row < 5; row++) this.box(black, cabinet.x > 0 ? cabinet.x - 2.05 : cabinet.x + 2.05, 1 + row * .9, cabinet.z, .05, .08, 4.5);
    }
    for (let z = -11; z <= 27; z += 10) { this.box(black, 0, 12.35, z, 5.6, .3, 1.6); this.box(light, 0, 12.1, z, 5.1, .06, 1.15); this.light(0xc3d9b9, 95, 20, 0, 11.7, z); }
    const glass = new THREE.MeshPhysicalMaterial({ color: 0x9cbcb8, roughness: .15, metalness: .35, transparent: true, opacity: .32, side: THREE.DoubleSide, depthWrite: false }); this.materials.add(glass);
    this.glass = this.box(glass, 0, 5.4, -18.1, 29, 10.8, .08, this.group, 'dream-intact-window');
    for (let x = -15; x <= 15; x += 5) this.box(metal, x, -30, -18, .16, 86, .35);
    for (let y = -72; y <= 12; y += 6) this.box(metal, 0, y, -18, 30, .16, .4);
    for (const x of [-10, 10]) this.box(glass, x, -31, -18.05, 10, 84, .08);
    this.box(glass, 0, -40.5, -18.05, 10, 63, .08);
    this.box(this.material(0x253635, .42, .25), 0, -75, -33, 98, .3, 31);
    for (const x of [-7, 7]) for (let z = -44; z < -24; z += 5) this.box(light, x, -74.8, z, .13, .02, 2);
    const window = this.material(0x697b67, .32, .22, 0x526b4c, .45);
    for (const side of [-1, 1]) for (let i = 0; i < 5; i++) {
      const x = side * (25 + i * 13); const h = 68 + (i * 19) % 50; const z = -36 - i % 2 * 20;
      this.box(this.material(i % 2 ? 0x344540 : 0x3c4b46, .85), x, -75 + h / 2, z, 11, h, 17);
      for (let y = -70; y < -75 + h - 2; y += 4.5) for (const dx of [-3, 0, 3]) this.box(window, x + dx, y, z - 8.6, 1.3, 2.4, .06);
    }
    const car = new THREE.Group(); car.position.set(0, -74.3, -29); this.static.add(car);
    this.box(black, 0, .7, 0, 3.4, 1.4, 6.8, car); this.box(metal, 0, 1.75, -.25, 2.85, 1.05, 3.7, car);
    this.shards.name = 'dream-glass-shards'; this.group.add(this.shards);
    for (let i = 0; i < 56; i++) { const shard = this.mesh(new THREE.TetrahedronGeometry(.1 + i % 7 * .055), glass, this.shards); shard.userData.index = i; }
    this.sight.name = 'dream-shot-focus'; this.group.add(this.sight);
    const reticleMaterial = this.material(0xdfd5af, .3, .1, 0xcfcaa7, 2.5);
    const ring = this.mesh(new THREE.TorusGeometry(.62, .022, 6, 40), reticleMaterial, this.sight); ring.rotation.x = Math.PI / 2;
    this.flash.name = 'dream-muzzle-flash'; this.group.add(this.flash);
    for (const x of [-.38, .38]) this.box(this.material(0xffe9a9, .1, 0, 0xffc65b, 5), x, 2.9, 1, .1, .14, .5, this.flash);
    this.light(0x8eb3c2, 280, 100, 7, -12, -37);
  }
  private ship(): void {
    const frame = this.surface('metal_plate', 0x394745, 1); const blanket = this.material(0x787c70, .97);
    this.box(frame, 12.5, .5, 32, 4.8, 1, 7.2); this.box(blanket, 12.5, 1.05, 32, 4.55, .35, 6.9);
    this.box(this.material(0x9b9c85, .95), 12.5, 1.36, 29.6, 3.7, .3, 1.5);
    for (let i = 0; i < 9; i++) this.box(blanket, 12.5, 1.25 + Math.sin(i) * .015, 30.6 + i * .45, 4.55, .07, .08);
    this.light(0xd3c3a1, 30, 10, 15, 5.5, 31);
    const cup = this.material(0x728379, .3, .65); const drink = this.material(0x322e20, .24);
    const mesh = this.mesh(new THREE.CylinderGeometry(.32, .26, .65, 24, 1, true), cup); mesh.position.set(-7, 1.75, 23.1);
    const rim = this.mesh(new THREE.TorusGeometry(.29, .03, 8, 24), cup); rim.position.set(-7, 2.08, 23.1); rim.rotation.x = Math.PI / 2;
    const coffee = this.mesh(new THREE.CircleGeometry(.27, 24), drink); coffee.rotation.x = -Math.PI / 2; coffee.position.set(-7, 2.02, 23.1);
    this.light(0xc5ceb1, 46, 13, -6, 6.4, 23);
  }
  private batch(): void {
    this.static.updateWorldMatrix(true, true); const inverse = this.static.matrixWorld.clone().invert(); const groups = new Map<THREE.Material, THREE.BufferGeometry[]>();
    this.static.traverse(object => {
      if (!(object instanceof THREE.Mesh) || Array.isArray(object.material)) return;
      const geometry = object.geometry.clone().applyMatrix4(new THREE.Matrix4().multiplyMatrices(inverse, object.matrixWorld)); if (!geometry.getAttribute('uv')) geometry.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array(geometry.getAttribute('position').count * 2), 2));
      const list = groups.get(object.material) ?? []; list.push(geometry); groups.set(object.material, list);
    });
    this.static.clear();
    for (const [material, geometries] of groups) {
      const merged = mergeGeometries(geometries); geometries.forEach(geometry => geometry.dispose());
      if (merged) { this.geometries.add(merged); const mesh = new THREE.Mesh(merged, material); mesh.castShadow = mesh.receiveShadow = true; this.static.add(mesh); }
    }
  }
  update(journey?: FilmJourney): void {
    const state = journey?.reloaded && !journey.visiting ? journey.reloaded : newReloaded(this.set === 'film_trinity_roof' ? 'dream' : 'meeting');
    if (journey?.visiting && state.kind === 'meeting') state.phase = 'done';
    if (this.set === 'film_trinity_roof') {
      const falling = ['falling', 'dream_hit', 'done'].includes(state.phase); const breaking = state.phase === 'breaking';
      if (this.glass) this.glass.visible = !falling && !(breaking && state.elapsed > .35);
      this.shards.visible = falling || breaking; const t = falling ? Math.min(RELOADED.fall, state.phase === 'falling' ? state.elapsed : RELOADED.fall) : state.elapsed * .35;
      this.shards.children.forEach((shard, i) => { const angle = i * 2.4; shard.position.set(Math.sin(angle) * (1.1 + i % 6 * .42) + state.drift * .5, 2.8 + Math.cos(angle) * 2.1 - 1.1 * t * t, -19 - t * (1.1 + i % 4 * .14)); shard.rotation.set(i + t, i * .5 + t * .7, i * .3 + t * 1.5); });
      const pose = reloadedRoot(state, 'agent_johnson'); this.sight.position.set(pose.x, pose.y + 2.4, pose.z); this.sight.rotation.x = Math.PI / 2;
      const beat = RELOADED.dreamShots.find(beat => !state.shots.includes(beat) && !state.missed.includes(beat));
      this.sight.visible = state.phase === 'falling' && beat !== undefined; this.sight.scale.setScalar(beat === undefined ? 1 : .5 + Math.min(2, Math.abs(beat - state.elapsed)));
      const trinity = reloadedRoot(state, 'trinity'); this.flash.position.set(trinity.x, trinity.y, trinity.z); this.flash.visible = state.phase === 'falling' && state.shotAge < .2;
    } else if (this.set === 'film_captains_meeting') {
      const open = state.phase === 'breach' ? THREE.MathUtils.smoothstep(state.elapsed, 1.9, RELOADED.breach) : ['combat', 'departure_ready', 'departing', 'done', 'failed'].includes(state.phase) ? 1 : 0;
      this.door.rotation.y = open * 1.45; this.door.rotation.z = state.phase === 'breach' ? Math.sin(state.elapsed * 31) * .025 : 0;
      this.envelope.visible = ['earpiece_ready', 'earpiece', 'evacuate_ready'].includes(state.phase);
      this.exits.forEach((material, i) => { material.emissiveIntensity = state.exit === (i ? 'east' : 'west') ? 2 : .3; });
    }
  }
  dispose(): void {
    this.disposed = true; this.group.removeFromParent(); this.group.clear(); this.geometries.forEach(geometry => geometry.dispose()); this.materials.forEach(material => material.dispose()); this.textures.forEach(texture => texture.dispose()); this.lights.forEach(light => light.dispose());
    this.geometries.clear(); this.materials.clear(); this.textures.clear(); this.lights.clear();
  }
}
