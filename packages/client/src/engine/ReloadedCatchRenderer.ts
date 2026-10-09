import * as THREE from 'three';
import { CATCH, CATCH_BUILDINGS, catchCarRoofScale, newCatch, type FilmJourney } from '@auto_matrix/shared';

/** A continuous street canyon below Trinity's window and the rooftop where Neo revives her. */
export class ReloadedCatchRenderer {
  readonly group = new THREE.Group();
  private geometries = new Set<THREE.BufferGeometry>();
  private materials = new Set<THREE.Material>();
  private lights = new Set<THREE.Light>();
  private shards = new THREE.Group();
  private exitShards = new THREE.Group();
  private exitGlass: THREE.Mesh;
  private carRoof: THREE.Mesh;
  private bullet = new THREE.Group();
  private pulse = new THREE.Group();
  private pulseRing: THREE.Mesh;
  private pulseLight: THREE.PointLight;
  private fire: THREE.PointLight;

  constructor(root: THREE.Group) {
    this.group.name = 'reloaded-catch-set'; root.add(this.group);
    const stone = this.mat(0x596662, .88), dark = this.mat(0x35484a, .82), trim = this.mat(0x9ca9a1, .54, .52);
    const glass = this.mat(0x6c8786, .23, .38), roof = this.mat(0x465253, .92), road = this.mat(0x273335, .88);
    const warm = this.mat(0xffd6a0, .22, .02, 0xf4ac62, 1.8);
    this.box(road, 0, CATCH.roadY - .35, -5, 145, .7, 135, 'catch-city-road');
    const car = this.mat(0x141f22, .35, .34), bumper = this.mat(0x758385, .32, .7), tail = new THREE.MeshBasicMaterial({ color: 0xd87965 }); this.materials.add(tail);
    this.box(car, 4, CATCH.roadY + .78, -29, 3.5, 1.35, 7, 'catch-thompson-car');
    this.carRoof = this.box(car, 4, CATCH.roadY + CATCH.carRoof.y, -29.5, 3, CATCH.carRoof.height, 3.8, 'catch-car-roof');
    const wheel = this.mat(0x111719, .93), hub = this.mat(0x9da6a7, .28, .8);
    for (const x of [2.18, 5.82]) for (const z of [-31.1, -26.8]) {
      const tire = this.mesh(new THREE.CylinderGeometry(.62, .62, .32, 20), wheel, 'catch-car-wheel'); tire.rotation.z = Math.PI / 2; tire.position.set(x, CATCH.roadY + .62, z);
      const rim = this.mesh(new THREE.CylinderGeometry(.34, .34, .35, 16), hub, 'catch-car-rim'); rim.rotation.z = Math.PI / 2; rim.position.copy(tire.position);
    }
    this.box(glass, 4, CATCH.roadY + 1.63, -27.45, 2.9, .7, .09, 'catch-car-windshield');
    for (const x of [2.35, 5.65]) { this.box(bumper, x, CATCH.roadY + .38, -32.5, .28, .32, 1.1); this.box(tail, x, CATCH.roadY + 1.05, -25.45, .7, .22, .06); }
    const lane = this.mat(0xb7a77e, .7, 0, 0x5f634f, .2);
    for (let x = -10; x <= 10; x += 5) for (let z = -56; z <= 44; z += 13) this.box(lane, x, CATCH.roadY + .03, z, .18, .02, 3.7);
    for (const building of CATCH_BUILDINGS) {
      if (building.name !== 'catch-architect-exit-tower') this.tower(building.x, building.z, building.width, building.depth, building.height,
        building.name === 'catch-trinity-tower' || building.x < 0 ? stone : dark, trim, building.name);
      else {
        // An actual passage, rather than a bright rectangle stuck on an opaque box.
        const lower = CATCH.start.y - CATCH.roadY, upper = CATCH.roadY + building.height - CATCH.start.y - CATCH.window.height;
        this.box(dark, 0, CATCH.roadY + lower / 2, 52, 29, lower, 16, building.name);
        this.box(dark, 0, CATCH.start.y + CATCH.window.height + upper / 2, 52, 29, upper, 16);
        const side = (29 - CATCH.window.width) / 2;
        for (const sign of [-1, 1]) this.box(dark, sign * (CATCH.window.width / 2 + side / 2), CATCH.start.y + CATCH.window.height / 2, 52, side, CATCH.window.height, 16);
        this.box(roof, 0, CATCH.start.y - .14, 48.5, CATCH.window.width, .28, 9, 'catch-exit-floor');
        this.box(trim, 0, CATCH.start.y + .035, CATCH.window.z, CATCH.window.width, .07, .28, 'catch-exit-sill');
        this.box(stone, 0, CATCH.start.y + 3.5, 53, CATCH.window.width, 7, .28, 'catch-exit-backwall');
        for (const x of [-2.65, 2.65]) this.box(trim, x, CATCH.start.y + 3.5, CATCH.window.z, .16, 7, .3, 'catch-exit-jamb');
        this.box(trim, 0, CATCH.start.y + 6.9, CATCH.window.z, 5.6, .18, .3);
        for (const z of [45, 47, 49, 51]) this.box(trim, 0, CATCH.start.y + .012, z, 5.3, .012, .022, 'catch-floor-seam');
      }
    }
    this.windows();
    const curb = this.mat(0x7c8580, .89);
    for (const x of [-21, 21]) this.box(curb, x, CATCH.roadY + .12, -5, 2.2, .24, 130, 'catch-city-pavement');
    for (const x of [-19.8, 19.8]) for (const z of [-51, -25, 1, 27, 53]) {
      this.box(trim, x, CATCH.roadY + 3.5, z, .13, 7, .13, 'catch-street-lamp-post');
      this.box(warm, x, CATCH.roadY + 7, z, .6, .16, .9, 'catch-street-lamp');
    }
    // The fall occurs in front of this roof; it later becomes the rescue surface.
    this.box(roof, 0, -.27, -12, 26.2, .54, 20.2, 'catch-rescue-roof');
    for (const x of [-12.5, 12.5]) this.box(stone, x, .72, -12, .55, 1.45, 20);
    this.box(stone, 0, .7, -2.25, 26, 1.4, .55);
    for (const x of [-8, 8]) { this.box(trim, x, 1.25, -9, 2.7, 2.5, 3.2); this.box(dark, x, 2.6, -9, 3.2, .25, 3.7); }
    this.box(glass, CATCH.trinity.x, -2.7, -22.04, 5.1, 6.5, .08, 'catch-broken-window');
    for (const x of [-11.05, -5.95]) this.box(trim, x, -2.7, -22.08, .12, 6.8, .18);
    this.box(trim, CATCH.trinity.x, .7, -22.08, 5.3, .12, .18);
    const exitPane = new THREE.MeshStandardMaterial({ color: 0xb8c8c4, roughness: .12, transparent: true, opacity: .28, depthWrite: false }); this.materials.add(exitPane);
    this.exitGlass = this.box(exitPane, 0, CATCH.start.y + 3.5, CATCH.window.z - .04, 5.25, 6.7, .07, 'catch-burning-exit');
    this.box(warm, 0, CATCH.start.y + 4, 52.78, 1.6, 1.3, .1, 'catch-fire-inside');
    for (let i = 0; i < 32; i++) { const shard = this.mesh(new THREE.TetrahedronGeometry(.09 + i % 5 * .04), glass, `catch-exit-shard-${i}`, this.exitShards); shard.castShadow = false; }
    this.group.add(this.exitShards);
    for (let z = -20; z <= -4; z += 3.2) this.box(trim, 0, .012, z, 25.3, .025, .024, 'catch-roof-joint');
    this.box(dark, 0, .012, -12, .04, .025, 19, 'catch-roof-drain');
    for (const x of [-8, 8]) for (let z = -10.3; z <= -7.7; z += .35) this.box(dark, x, 1.6, z, 2.5, .055, .06, 'catch-vent-louvre');
    this.fire = new THREE.PointLight(0xff8b43, 145, 28, 2); this.fire.position.set(0, 17, 43); this.group.add(this.fire); this.lights.add(this.fire);
    for (let i = 0; i < 40; i++) {
      const shard = this.mesh(new THREE.TetrahedronGeometry(.12 + (i % 5) * .055), glass, `catch-shard-${i}`, this.shards);
      shard.userData.index = i;
    }
    this.group.add(this.shards);
    const bulletMetal = this.mat(0xcacfac, .23, .83, 0x7ba179, 1.4);
    const round = this.mesh(new THREE.CylinderGeometry(.09, .07, .42, 12), bulletMetal, 'catch-extracted-bullet', this.bullet); round.rotation.x = Math.PI / 2;
    const code = this.mat(0x9fe2aa, .2, .1, 0x6fea98, 2.2);
    for (let i = 0; i < 7; i++) { const mote = this.mesh(new THREE.BoxGeometry(.06, .16 + i % 3 * .07, .06), code, `catch-code-${i}`, this.bullet); mote.position.set(Math.sin(i * 2.4) * .7, Math.cos(i * 1.7) * .45, Math.cos(i * 2.4) * .7); }
    this.bullet.position.set(CATCH.patient.x, .8, CATCH.patient.z - 2.2); this.group.add(this.bullet);
    const pulseMat = this.mat(0xa5ffd0, .18, 0, 0x68ffb0, 1.4);
    this.pulseRing = this.mesh(new THREE.TorusGeometry(1, .08, 10, 56), pulseMat, 'catch-heart-pulse', this.pulse); this.pulseRing.rotation.x = -Math.PI / 2;
    const center = this.mesh(new THREE.TorusGeometry(.65, .025, 8, 48), this.mat(0xe6dec2, .3, 0, 0x9ce7b1, 1.4), 'catch-pulse-target', this.pulse); center.rotation.x = -Math.PI / 2;
    this.pulse.position.set(CATCH.patient.x, .7, CATCH.patient.z - 2.2); this.group.add(this.pulse);
    this.pulseLight = new THREE.PointLight(0x80ffb0, 0, 9, 2); this.pulseLight.position.copy(this.pulse.position); this.group.add(this.pulseLight); this.lights.add(this.pulseLight);
    const street = new THREE.PointLight(0xd6dbc0, 280, 110, 2); street.position.set(-22, 21, -32); this.group.add(street); this.lights.add(street);
    const fill = new THREE.PointLight(0x7bafc1, 190, 90, 2); fill.position.set(26, 3, 18); this.group.add(fill); this.lights.add(fill);
  }

  private mat(color: number, roughness = .8, metalness = .05, emissive = 0, intensity = 0): THREE.MeshStandardMaterial {
    const material = new THREE.MeshStandardMaterial({ color, roughness, metalness, emissive, emissiveIntensity: intensity }); this.materials.add(material); return material;
  }
  private mesh(geometry: THREE.BufferGeometry, material: THREE.Material, name: string, parent: THREE.Object3D = this.group): THREE.Mesh {
    const mesh = new THREE.Mesh(geometry, material); mesh.name = name; mesh.castShadow = mesh.receiveShadow = true; parent.add(mesh); this.geometries.add(geometry); return mesh;
  }
  private box(material: THREE.Material, x: number, y: number, z: number, w: number, h: number, d: number, name = ''): THREE.Mesh {
    const mesh = this.mesh(new THREE.BoxGeometry(w, h, d), material, name); mesh.position.set(x, y, z); return mesh;
  }
  private tower(x: number, z: number, w: number, d: number, h: number, wall: THREE.Material, trim: THREE.Material, name: string): void {
    this.box(wall, x, CATCH.roadY + h / 2, z, w, h, d, name);
    for (let y = CATCH.roadY + 8; y < CATCH.roadY + h; y += 12) this.box(trim, x, y, z - d / 2 - .09, w + .15, .13, .17);
    this.box(trim, x, CATCH.roadY + h + .2, z, w + .6, .38, d + .6);
  }
  private windows(): void {
    const geometry = new THREE.PlaneGeometry(1.5, 2.35); this.geometries.add(geometry);
    const material = new THREE.MeshBasicMaterial({ color: 0xffffff, side: THREE.FrontSide, toneMapped: false }); this.materials.add(material);
    const buildings = CATCH_BUILDINGS.map(b => [b.x, b.z, b.width, b.depth, b.height]);
    const panes: { x: number; y: number; z: number; yaw: number; color: number }[] = [];
    for (let b = 0; b < buildings.length; b++) {
      const [x, z, w, d, h] = buildings[b];
      for (let y = CATCH.roadY + 7; y < CATCH.roadY + h - 2; y += 4.2)
        for (let face = 0; face < 4; face++) {
          const span = face < 2 ? w : d;
          for (let offset = -span / 2 + 2.3; offset < span / 2 - 1; offset += 3.1) {
            if (b === 2 && face === 0 && Math.abs(offset) < CATCH.window.width / 2 + .75 && y > CATCH.start.y - 1 && y < CATCH.start.y + CATCH.window.height + 1) continue;
            const lit = Math.abs((Math.floor(y) * 17 + Math.floor(offset * 10) + b * 13 + face * 5) % 7);
            const color = lit < 2 ? 0xcbb690 : lit === 2 ? 0xabc6c6 : 0x2b4245;
            panes.push(face === 0 ? { x: x + offset, y, z: z - d / 2 - .04, yaw: Math.PI, color }
              : face === 1 ? { x: x + offset, y, z: z + d / 2 + .04, yaw: 0, color }
                : face === 2 ? { x: x - w / 2 - .04, y, z: z + offset, yaw: -Math.PI / 2, color }
                  : { x: x + w / 2 + .04, y, z: z + offset, yaw: Math.PI / 2, color });
          }
        }
    }
    const mesh = new THREE.InstancedMesh(geometry, material, panes.length); mesh.name = 'catch-lit-window-grid'; mesh.receiveShadow = true;
    const matrix = new THREE.Matrix4(); const color = new THREE.Color();
    panes.forEach((pane, index) => { matrix.makeRotationY(pane.yaw); matrix.setPosition(pane.x, pane.y, pane.z); mesh.setMatrixAt(index, matrix); mesh.setColorAt(index, color.setHex(pane.color)); });
    mesh.instanceMatrix.needsUpdate = true; if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    this.group.add(mesh);
  }
  update(journey?: FilmJourney, patient?: THREE.Object3D): void {
    const state = journey?.scene === 'm2_catch' && !journey.visiting ? journey.catch ?? newCatch() : newCatch();
    const flying = state.phase === 'flight'; const rooftop = ['extract_ready', 'extracting', 'pulse', 'reviving', 'done'].includes(state.phase) || state.phase === 'failed' && state.checkpoint === 'pulse';
    this.exitGlass.visible = state.phase === 'launch' || state.phase === 'departing' && state.elapsed < .45;
    this.exitShards.visible = state.phase === 'departing' && state.elapsed >= .45 || flying && state.elapsed < .9;
    const burst = state.phase === 'departing' ? Math.max(0, state.elapsed - .45) : .65 + state.elapsed;
    this.exitShards.children.forEach((shard, index) => {
      shard.position.set(Math.sin(index * 2.4) * (1.5 + burst * 2), CATCH.start.y + 2.8 + Math.cos(index * 1.7) * 2 - 2 * burst * burst, CATCH.window.z - burst * (3 + index % 4));
      shard.rotation.set(index + burst * 3, index * .7 + burst * 2, index + burst);
    });
    this.carRoof.scale.y = catchCarRoofScale(state);
    this.shards.visible = flying && state.elapsed < 3;
    this.shards.children.forEach((shard, index) => {
      const t = state.elapsed; shard.position.set(CATCH.trinity.x + Math.sin(index * 2.4) * (1 + index % 5 * .36), -1 + Math.cos(index * 1.7) * 2 - t * t * .9,
        CATCH.trinity.z - (index % 4) * .4 - t * .8); shard.rotation.set(t * 2 + index, t + index * .8, index + t * 1.3);
    });
    this.bullet.visible = ['extracting', 'pulse', 'reviving', 'done'].includes(state.phase);
    // The separation effect ends with extraction; leaving these fragments up
    // surrounds the kneeling player's eye while he watches Trinity recover.
    for (const fragment of this.bullet.children) if (fragment.name.startsWith('catch-code-')) fragment.visible = state.phase === 'extracting';
    const chest = rooftop && patient?.getObjectByName('chest');
    const wound = chest ? this.group.worldToLocal(chest.localToWorld(new THREE.Vector3(-.02, .18, .3))) : new THREE.Vector3(CATCH.patient.x, .7, CATCH.patient.z - 1.17);
    this.bullet.position.copy(wound);
    if (state.phase === 'extracting') this.bullet.position.y += state.focus / CATCH.extraction * CATCH.extractionLift;
    else { this.bullet.position.x += 1.05; this.bullet.position.z += .7; this.bullet.position.y = .09; }
    this.pulse.position.copy(wound).add(new THREE.Vector3(0, .08, 0)); this.pulseLight.position.copy(this.pulse.position);
    this.bullet.rotation.y = state.focus * 3;
    this.pulse.visible = state.phase === 'pulse';
    if (state.phase === 'pulse') {
      const radius = Math.max(.6, 1.8 - state.elapsed / CATCH.pulseAt * 1.2);
      this.pulseRing.scale.setScalar(radius);
      this.pulseLight.intensity = Math.abs(state.elapsed - CATCH.pulseAt) < CATCH.pulseWindow ? 65 : 18;
    } else this.pulseLight.intensity = rooftop && state.phase === 'done' ? 45 : 0;
    this.fire.intensity = rooftop ? 60 : 270;
  }
  dispose(): void {
    this.group.removeFromParent(); this.group.clear();
    this.geometries.forEach(geometry => geometry.dispose()); this.materials.forEach(material => material.dispose()); this.lights.forEach(light => light.dispose());
    this.geometries.clear(); this.materials.clear(); this.lights.clear();
  }
}
