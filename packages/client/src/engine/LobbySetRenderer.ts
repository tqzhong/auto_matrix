import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { LOBBY_COLUMNS, LOBBY_ENTRY, type FilmJourney, type FilmSet, type CombatImpact } from '@auto_matrix/shared';

/** Authored from the ASC lobby reference frames in references/matrix/lobby. */
export class LobbySetRenderer {
  private root = new THREE.Group();
  private materials: THREE.Material[] = [];
  private textures: THREE.Texture[] = [];
  private facings: THREE.Group[] = [];
  private rubble: THREE.Group[] = [];
  private doors: THREE.Mesh[] = [];
  private marks: THREE.Mesh[] = [];
  private alarmLights: THREE.Mesh[] = [];
  private weaponCase?: THREE.Group;
  private debris: { group: THREE.Group; age: number }[] = [];
  private opening = 0;
  private lastTime = 0;
  private scar = new THREE.MeshBasicMaterial({ color: 0x17201c, transparent: true, opacity: .85, polygonOffset: true, polygonOffsetFactor: -2 });
  constructor(parent: THREE.Group, private set: FilmSet) {
    parent.add(this.root); this.materials.push(this.scar);
    const granite = this.stone(0x5b7161, .43);
    const dark = this.stone(0x2b3c2e, .33);
    const floor = this.stone(0x71826c, .3);
    const trim = this.material(0xafb5a0, .36);
    const core = this.stone(0xadaf9c, .96);
    const black = this.material(0x141b19, .6);
    const steel = this.material(0x9aa69f, .27, .8);
    const light = new THREE.MeshBasicMaterial({ color: 0xd6e2c9, toneMapped: false }); this.materials.push(light);
    const { width: w, depth: d, height: h } = set;
    this.box(dark, 0, -.2, 0, w, .4, d);
    for (let z = -39.8; z < 41; z += 2.7) for (let x = -17.6; x < 19; x += 3.5) this.box(floor, x, .006, z, 3.46, .015, 2.66);
    for (const x of [-12.1, -8.3, 8.3, 12.1]) this.box(trim, x, .026, 0, .23, .025, d);
    for (const z of [-33, -19, -5, 9, 23, 37]) {
      for (const x of [-15.4, 0, 15.4]) this.box(trim, x, .028, z, x ? 7 : 16.6, .028, .2);
    }
    for (const side of [-1, 1]) {
      this.box(dark, side * w / 2, h / 2, 0, .7, h, d);
      for (const z of [-33, -19, -5, 9, 23, 37]) {
        this.box(granite, side * (w / 2 - .39), 8, z, .12, 15.7, 10.6);
        this.box(black, side * (w / 2 - .48), 4.5, z, .08, 7.2, 4.8);
        for (const dz of [-2.55, 2.55]) this.box(steel, side * (w / 2 - .55), 4.6, z + dz, .14, 7.5, .23);
        this.box(steel, side * (w / 2 - .55), 8.3, z, .14, .24, 5.3);
        for (const y of [9.4, 12.8]) this.box(trim, side * (w / 2 - .52), y, z, .18, .28, 10.8);
        for (let dz = -1.5; dz <= 1.5; dz += .25) this.box(steel, side * (w / 2 - .55), 10.8, z + dz, .08, 1, .045);
      }
    }
    this.box(dark, 0, h / 2, -d / 2, w, h, .7);
    this.box(granite, 0, h / 2, d / 2, w, h, .7);
    // Solid, coffered ceiling with luminous panels. No generic hanging lamps or side windows.
    this.box(black, 0, h + .2, 0, w, .4, d);
    for (let z = -35; z < 40; z += 14) {
      for (const x of [-14.8, 0, 14.8]) {
        const width = x ? 7 : 17.6;
        this.box(trim, x, h - .3, z, width, .5, 12.2);
        this.box(black, x, h - .59, z, width - .5, .08, 11.5);
        this.box(light, x, h - .65, z, width - 1.3, .025, 10.6);
        for (const dz of [-3.5, 0, 3.5]) this.box(trim, x, h - .69, z + dz, width - 1, .06, .07);
      }
      this.box(trim, 0, h - .7, z + 6.5, w, 1, .8);
      const lamp = new THREE.PointLight(0xd6e3ca, 680, 38, 2); lamp.position.set(-3, h - 2, z); this.root.add(lamp);
    }
    for (const [i, c] of LOBBY_COLUMNS.entries()) {
      this.box(core, c.x, h / 2, c.z, c.width - .06, h, c.depth - .06);
      const facing = new THREE.Group(); facing.userData.dynamic = true; this.root.add(facing); this.facings.push(facing);
      for (const side of [-1, 1]) {
        for (let y = 1.5; y < 15; y += 3) {
          this.box(granite, c.x + side * c.width / 2, y, c.z, .04, 2.97, c.depth, y < 6 ? facing : this.root);
          this.box(granite, c.x, y, c.z + side * c.depth / 2, c.width, 2.97, .04, y < 6 ? facing : this.root);
        }
      }
      for (const y of [.2, h - .4]) this.box(dark, c.x, y, c.z, c.width + .2, .4, c.depth + .2);
      const rubble = new THREE.Group(); rubble.userData.dynamic = true; rubble.visible = false; this.root.add(rubble); this.rubble.push(rubble);
      for (let j = 0; j < 22; j++) {
        const angle = j * 2.4 + i; const radius = 1.8 + (j * 7 % 17) * .15;
        const chunk = this.box(j % 3 ? core : granite, c.x + Math.cos(angle) * radius, .06 + (j % 3) * .03, c.z + Math.sin(angle) * radius, .1 + j % 4 * .11, .09 + j % 3 * .09, .16 + j % 5 * .09, rubble);
        chunk.rotation.set(j * .1, angle, j * .17);
      }
    }
    // Three framed elevator bays at the far end, with the centre doors opening after combat.
    for (const x of [-12, 0, 12]) {
      this.box(black, x, 4.7, -40.55, 6, 9.4, .2);
      for (const side of [-1, 1]) {
        this.box(trim, x + side * 3.4, 4.8, -40.3, .5, 9.6, .6);
        const door = this.box(steel, x + side * 1.43, 4.5, -40.1, 2.82, 9, .12);
        if (!x) { door.userData.dynamic = true; this.doors.push(door); }
        this.box(steel, x + side * 3.95, 4, -40.05, .22, .8, .1);
      }
      this.box(trim, x, 9.7, -40.3, 7.3, .6, .6);
      this.box(black, x, 10.6, -40.05, 2, .65, .08); this.box(light, x, 10.6, -39.99, .1, .32, .04);
    }
    for (const side of [-1, 1]) this.box(steel, side * 2.6, 3.6, 29, .5, 7.2, 1);
    this.box(steel, 0, 7.2, 29, 5.7, .45, 1); this.box(black, 0, 7.1, 29.55, 2, .18, .03);
    const led = this.material(0x638044, .4); led.emissive.setHex(0x638044); led.emissiveIntensity = .8;
    this.box(led, 2.33, 5.4, 29.55, .12, .16, .05);
    this.box(steel, 7.4, 2.2, 30, 5.2, 4.4, 3.8); this.box(black, 7.4, 2.2, 32, 3.8, 2.6, .1);
    for (let x = 5.6; x < 9.3; x += .38) this.box(black, x, 2.2, 32.1, .26, 2.5, .08);
    this.box(steel, 7.4, 1.1, 33.2, 4.6, .25, 3); this.box(black, 7.4, 1.25, 33.2, 4.4, .05, 2.8);
    this.box(black, -7.4, 2.4, 31, 5, 4.8, 2.5); this.box(steel, -7.4, 4.85, 31, 5.2, .15, 2.8);
    this.box(black, -7.4, 5.65, 30.8, 1.9, 1.6, 1.4); this.box(led, -7.4, 5.65, 31.52, 1.5, 1.1, .02);
    const checkpoint = new THREE.Group(); checkpoint.name = 'lobby-security-checkpoint'; checkpoint.userData.dynamic = true; this.root.add(checkpoint);
    this.box(steel, 4.35, 1.12, 21.2, 2.8, 2.24, 1.25, checkpoint).name = 'lobby-security-console';
    this.box(black, 4.35, 2.32, 21.1, 1.75, .17, .82, checkpoint);
    const display = this.box(led, 4.35, 2.43, 21.05, 1.25, .08, .5, checkpoint); display.name = 'lobby-security-display';
    this.weaponCase = new THREE.Group(); this.weaponCase.name = 'lobby-weapon-case'; this.weaponCase.position.set(-5.4, .14, 22.4); this.weaponCase.userData.dynamic = true; checkpoint.add(this.weaponCase);
    this.box(black, 0, .28, 0, 3.7, .5, 1.5, this.weaponCase); const lid = this.box(black, 0, .62, -.72, 3.7, .12, 1.45, this.weaponCase);
    lid.name = 'lobby-weapon-case-lid'; lid.geometry.translate(0, 0, .72);
    for (const x of [-1.25, -.42, .42, 1.25]) { const weapon = this.box(steel, x, .63, .12, .16, .14, 1.05, this.weaponCase); weapon.rotation.z = x * .05; }
    const alarm = this.material(0x2c0704, .34); alarm.emissive.setHex(0xff280c); alarm.emissiveIntensity = 0;
    for (const x of [-2.35, 2.35]) {
      const lightMesh = this.box(alarm.clone(), x, 6.95, 29.55, .32, .24, .12, checkpoint); this.materials.push(lightMesh.material as THREE.Material);
      lightMesh.name = x < 0 ? 'lobby-alarm-left' : 'lobby-alarm-right'; this.alarmLights.push(lightMesh);
    }
    for (const x of [-13.2, 13.2]) for (const z of [26, 34]) {
      this.box(black, x, 1.3, z, 2, .25, 1.8); this.box(black, x, 2.3, z + .8, 2, 2, .17);
      for (const dx of [-.8, .8]) for (const dz of [-.65, .65]) this.box(steel, x + dx, .65, z + dz, .08, 1.3, .08);
    }
    for (const x of [-10, 0, 10]) {
      this.box(light, x, 10.4, 40.6, 7.2, 10.4, .03);
      for (const dx of [-3.7, 0, 3.7]) this.box(steel, x + dx, 10.4, 40.4, .13, 10.8, .2);
      for (const y of [5.1, 8.7, 12.3, 15.8]) this.box(steel, x, y, 40.4, 7.4, .13, .2);
    }
    for (const group of [...this.facings, ...this.rubble]) this.batch(group);
    this.batch();
  }
  private material(color: number, roughness: number, metalness = 0): THREE.MeshStandardMaterial {
    const material = new THREE.MeshStandardMaterial({ color, roughness, metalness }); this.materials.push(material); return material;
  }
  private stone(color: number, roughness: number): THREE.MeshStandardMaterial {
    const canvas = document.createElement('canvas'); canvas.width = canvas.height = 256;
    const ctx = canvas.getContext('2d')!; const image = ctx.createImageData(256, 256);
    let seed = 7121;
    for (let i = 0; i < image.data.length; i += 4) {
      seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
      const grain = 120 + (seed >>> 24) * .43;
      image.data.set([grain, grain + 3, grain, 255], i);
    }
    ctx.putImageData(image, 0, 0);
    const texture = new THREE.CanvasTexture(canvas); texture.colorSpace = THREE.SRGBColorSpace;
    texture.wrapS = texture.wrapT = THREE.RepeatWrapping; texture.repeat.set(2, 4); texture.anisotropy = 8; this.textures.push(texture);
    const material = this.material(color, roughness); material.map = texture; material.bumpMap = texture; material.bumpScale = .018;
    return material;
  }
  private box(material: THREE.Material, x: number, y: number, z: number, w: number, h: number, d: number, parent = this.root): THREE.Mesh {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material); mesh.position.set(x, y, z); mesh.castShadow = mesh.receiveShadow = true; parent.add(mesh); return mesh;
  }
  private batch(root = this.root): void {
    root.updateWorldMatrix(true, true); const inverse = root.matrixWorld.clone().invert(); const batches = new Map<THREE.Material, THREE.BufferGeometry[]>(); const remove: THREE.Mesh[] = [];
    root.traverse(object => {
      if (!(object instanceof THREE.Mesh)) return;
      let parent: THREE.Object3D | null = object; while (parent && parent !== root) { if (parent.userData.dynamic) return; parent = parent.parent; }
      const material = object.material as THREE.Material; const list = batches.get(material) ?? [];
      list.push(object.geometry.clone().applyMatrix4(inverse.clone().multiply(object.matrixWorld))); batches.set(material, list); remove.push(object);
    });
    for (const object of remove) { object.geometry.dispose(); object.removeFromParent(); }
    for (const [material, parts] of batches) {
      const geometry = mergeGeometries(parts)!; parts.forEach(g => g.dispose());
      const mesh = new THREE.Mesh(geometry, material); mesh.castShadow = mesh.receiveShadow = true; root.add(mesh);
    }
  }
  update(journey: FilmJourney | undefined, time: number): void {
    const lobby = journey?.scene === 'm1_lobby' ? journey.lobby : undefined;
    this.facings.forEach((group, i) => {
      const damage = lobby?.columns[i] ?? 0;
      group.visible = damage < 50;
      this.rubble[i].visible = damage >= 30;
    });
    const dt = this.lastTime ? Math.max(0, Math.min(.1, time - this.lastTime)) : 0; this.lastTime = time;
    const entry = lobby?.phase === 'checkpoint' ? lobby.elapsed ?? 0 : lobby?.phase === 'combat' || lobby?.phase === 'cleared' ? LOBBY_ENTRY.duration : 0;
    const alarm = entry >= LOBBY_ENTRY.alarmAt;
    this.alarmLights.forEach((mesh, index) => {
      const material = mesh.material as THREE.MeshStandardMaterial;
      material.emissiveIntensity = alarm && Math.sin(time * 16 + index * Math.PI) > -.1 ? 4.5 : 0;
    });
    const lid = this.weaponCase?.getObjectByName('lobby-weapon-case-lid');
    if (lid) lid.rotation.x = -Math.PI * .42 * THREE.MathUtils.smoothstep(entry, LOBBY_ENTRY.drawAt - .5, LOBBY_ENTRY.drawAt + .8);
    for (const burst of [...this.debris]) {
      burst.age += dt;
      for (const chunk of burst.group.children) {
        const velocity = chunk.userData.velocity as THREE.Vector3; velocity.y -= 9 * dt; chunk.position.addScaledVector(velocity, dt); chunk.rotation.x += dt * 8; chunk.rotation.z += dt * 5;
      }
      burst.group.scale.setScalar(Math.max(0, 1 - Math.max(0, burst.age - .75) / .45));
      if (burst.age > 1.2) { burst.group.traverse(object => { if (object instanceof THREE.Mesh) object.geometry.dispose(); }); burst.group.removeFromParent(); this.debris.splice(this.debris.indexOf(burst), 1); }
    }
    const target = journey?.scene === 'm1_lobby' && journey.step >= 3 ? 1 : 0;
    this.opening = THREE.MathUtils.damp(this.opening, target, 3, dt);
    this.doors.forEach((door, i) => { door.position.x = (i ? 1 : -1) * (1.43 + this.opening * 2.8); });
  }
  impact(hit: CombatImpact): void {
    if (!hit.shot || hit.shot.surface !== 'stone') return;
    const position = new THREE.Vector3(hit.position.x - this.set.center.x, hit.position.y - this.set.center.y + 1, hit.position.z - this.set.center.z);
    const mark = new THREE.Mesh(new THREE.CircleGeometry(.08 + Math.random() * .08, 7), this.scar); mark.position.copy(position);
    mark.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), new THREE.Vector3(-hit.direction.x, -hit.direction.y, -hit.direction.z));
    mark.position.addScaledVector(new THREE.Vector3(hit.direction.x, hit.direction.y, hit.direction.z), -.025); this.root.add(mark); this.marks.push(mark);
    if (this.marks.length > 64) { const old = this.marks.shift()!; old.removeFromParent(); old.geometry.dispose(); }
    const burst = new THREE.Group(); burst.name = 'lobby-impact-debris'; burst.position.copy(position); burst.userData.dynamic = true; this.root.add(burst);
    for (let i = 0; i < 10; i++) {
      const angle = i * 2.4; const chunk = new THREE.Mesh(new THREE.BoxGeometry(.035 + i % 3 * .025, .035 + i % 2 * .03, .06), this.scar);
      chunk.userData.velocity = new THREE.Vector3(Math.cos(angle) * (.35 + i * .035) - hit.direction.x * .6, .35 + i % 4 * .16, Math.sin(angle) * (.35 + i * .035) - hit.direction.z * .6);
      burst.add(chunk);
    }
    this.debris.push({ group: burst, age: 0 });
    if (this.debris.length > 12) { const old = this.debris.shift()!; old.group.traverse(object => { if (object instanceof THREE.Mesh) object.geometry.dispose(); }); old.group.removeFromParent(); }
  }
  dispose(): void {
    this.root.traverse(object => { if (object instanceof THREE.Mesh) object.geometry.dispose(); if (object instanceof THREE.PointLight) object.dispose(); });
    this.materials.forEach(m => m.dispose()); this.textures.forEach(t => t.dispose()); this.root.removeFromParent();
  }
}
