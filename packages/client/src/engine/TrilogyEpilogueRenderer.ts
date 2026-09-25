import * as THREE from 'three';
import { newTrilogyEpilogue, trilogyEpilogueProgress, type TrilogyEpilogueEncounter, type TrilogyEpilogueKind } from '@auto_matrix/shared';

/** Physical epilogue beats layered over the existing Zion, Machine City and park sets. */
export class TrilogyEpilogueRenderer {
  private group = new THREE.Group();
  private geometries = new Set<THREE.BufferGeometry>();
  private materials = new Set<THREE.Material>();
  private lights = new Set<THREE.Light>();
  private sentinels: THREE.Group[] = [];
  private barge?: THREE.Group;
  private tray?: THREE.Group;
  private bodyLight?: THREE.PointLight;
  private cables: THREE.Mesh[] = [];
  private cat?: THREE.Group;
  private catEcho?: THREE.Group;
  private resetTiles: THREE.Mesh[] = [];
  private sun?: THREE.Mesh;
  private sunrise?: THREE.MeshBasicMaterial;
  private rays: THREE.Mesh[] = [];

  constructor(root: THREE.Group, private kind: TrilogyEpilogueKind) {
    root.add(this.group); this.group.name = `trilogy-epilogue-${kind}`;
    if (kind === 'ceasefire') this.buildCeasefire();
    else if (kind === 'neo_carried') this.buildCarried();
    else this.buildDawn();
  }

  private material(color: number, roughness = .55, metalness = .15, emissive = 0, intensity = 0): THREE.MeshStandardMaterial {
    const material = new THREE.MeshStandardMaterial({ color, roughness, metalness, emissive, emissiveIntensity: intensity });
    this.materials.add(material); return material;
  }
  private basic(color: number, opacity = 1): THREE.MeshBasicMaterial {
    const material = new THREE.MeshBasicMaterial({ color, transparent: opacity < 1, opacity, depthWrite: opacity >= 1, side: THREE.DoubleSide });
    this.materials.add(material); return material;
  }
  private mesh(geometry: THREE.BufferGeometry, material: THREE.Material, parent = this.group): THREE.Mesh {
    this.geometries.add(geometry); const mesh = new THREE.Mesh(geometry, material); mesh.castShadow = true; mesh.receiveShadow = true; parent.add(mesh); return mesh;
  }
  private cylinderBetween(a: THREE.Vector3, b: THREE.Vector3, radius: number, material: THREE.Material, parent: THREE.Group): THREE.Mesh {
    const midpoint = a.clone().add(b).multiplyScalar(.5); const mesh = this.mesh(new THREE.CylinderGeometry(radius, radius, a.distanceTo(b), 7), material, parent);
    mesh.position.copy(midpoint); mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), b.clone().sub(a).normalize()); return mesh;
  }

  private buildCeasefire(): void {
    const shell = this.material(0x394844, .28, .72); const eye = this.material(0xff7152, .3, .25, 0xff2d19, 5.5);
    for (let i = 0; i < 18; i++) {
      const sentinel = new THREE.Group(); sentinel.name = `ceasefire-retreating-sentinel-${i + 1}`; this.group.add(sentinel);
      const body = this.mesh(new THREE.IcosahedronGeometry(.8 + i % 3 * .08, 1), shell, sentinel); body.scale.set(1.45, .58, 1.7);
      const lamp = this.mesh(new THREE.SphereGeometry(.22, 8, 6), eye, sentinel); lamp.position.z = -1.35;
      for (const side of [-1, 1]) for (let arm = 0; arm < 3; arm++) {
        const start = new THREE.Vector3(side * (.4 + arm * .22), -.2, .5);
        const end = new THREE.Vector3(side * (1.4 + arm * .55), -1.1 - arm * .36, 2 + arm * .8);
        this.cylinderBetween(start, end, .055, shell, sentinel);
      }
      this.sentinels.push(sentinel);
    }
    const beacon = new THREE.PointLight(0x87dfaa, 0, 52, 2); beacon.position.set(0, 15, -45); this.group.add(beacon); this.lights.add(beacon);
  }

  private buildCarried(): void {
    const gold = this.material(0xf0b55c, .25, .75, 0xffa83a, 3.2); const dark = this.material(0x262d2a, .3, .88);
    const traySurface = this.material(0x465049, .48, .58, 0x6f4a24, .18);
    this.barge = new THREE.Group(); this.barge.name = 'neo-machine-funeral-barge'; this.group.add(this.barge);
    const hull = this.mesh(new THREE.CapsuleGeometry(2.5, 8, 6, 16), dark, this.barge); hull.rotation.x = Math.PI / 2; hull.scale.set(1, .42, .34);
    for (const side of [-1, 1]) for (const z of [-3.4, 0, 3.4]) {
      const rib = this.mesh(new THREE.TorusGeometry(2.2, .12, 8, 24, Math.PI), gold, this.barge); rib.position.set(0, .5, z); rib.rotation.set(Math.PI / 2, 0, side > 0 ? 0 : Math.PI);
    }
    this.tray = new THREE.Group(); this.tray.name = 'neo-body-transfer-tray'; this.group.add(this.tray);
    const bed = this.mesh(new THREE.CapsuleGeometry(.82, 3.8, 5, 16), traySurface, this.tray); bed.rotation.x = Math.PI / 2; bed.scale.y = .3;
    for (const side of [-1, 1]) {
      const rail = this.mesh(new THREE.BoxGeometry(.08, .1, 5.1), gold, this.tray); rail.name = `neo-tray-rim-${side < 0 ? 'left' : 'right'}`;
      rail.position.set(side * 1.02, .25, 0);
    }
    this.bodyLight = new THREE.PointLight(0xffd7ad, 420, 18, 2); this.bodyLight.name = 'neo-tray-body-light';
    this.bodyLight.position.set(2.8, 4.2, 1.8); this.tray.add(this.bodyLight); this.lights.add(this.bodyLight);
    for (let i = 0; i < 7; i++) {
      const cable = this.mesh(new THREE.CylinderGeometry(.045, .08, 8, 8), gold); cable.position.set(-1.5 + i * .5, 4.2, -25 + Math.sin(i) * .7); cable.rotation.x = .12 + i * .025; this.cables.push(cable);
    }
    for (const x of [-18, -13, 13, 18]) for (const z of [-42, -28, -12]) {
      const spine = this.mesh(new THREE.CylinderGeometry(.18, .6, 15 + (x + z + 80) % 7, 8), dark); spine.position.set(x, 7, z);
      const node = this.mesh(new THREE.SphereGeometry(.45, 10, 8), gold); node.position.set(x, 13.5, z);
    }
    const light = new THREE.PointLight(0xffb24f, 750, 55, 2); light.position.set(0, 11, -32); this.group.add(light); this.lights.add(light);
  }

  private catModel(material: THREE.Material): THREE.Group {
    const cat = new THREE.Group();
    const body = this.mesh(new THREE.CapsuleGeometry(.28, .8, 4, 10), material, cat); body.rotation.z = Math.PI / 2; body.position.y = .52;
    const head = this.mesh(new THREE.SphereGeometry(.35, 12, 9), material, cat); head.position.set(0, .7, -.62);
    for (const side of [-1, 1]) { const ear = this.mesh(new THREE.ConeGeometry(.15, .34, 4), material, cat); ear.position.set(side * .2, 1.02, -.65); }
    for (const x of [-.34, .34]) for (const z of [-.35, .35]) { const leg = this.mesh(new THREE.CylinderGeometry(.055, .07, .48, 6), material, cat); leg.position.set(x, .25, z); }
    const tail = this.mesh(new THREE.TorusGeometry(.65, .055, 6, 18, Math.PI * 1.3), material, cat); tail.rotation.set(Math.PI / 2, 0, -.5); tail.position.set(.65, .72, .25);
    return cat;
  }

  private buildDawn(): void {
    const black = this.material(0x111817, .82, .05); this.cat = this.catModel(black); this.cat.name = 'matrix-reset-black-cat'; this.group.add(this.cat);
    const echoMaterial = this.basic(0x9ee8c3, .3); this.catEcho = this.catModel(echoMaterial); this.catEcho.name = 'matrix-reset-deja-vu-echo'; this.group.add(this.catEcho);
    const stone = this.material(0x7c8580, .94);
    for (let i = 0; i < 15; i++) {
      const tile = this.mesh(new THREE.BoxGeometry(2.6 + i % 3, .2, 2.2 + (i * 2) % 3), stone); tile.position.set(-12 + i % 5 * 5.6, .08, -29 + Math.floor(i / 5) * 4.8);
      tile.rotation.y = (i % 3 - 1) * .14; tile.rotation.x = (i % 2 ? 1 : -1) * .09; this.resetTiles.push(tile);
    }
    this.sunrise = this.basic(0xffba70, .02);
    this.sun = this.mesh(new THREE.CircleGeometry(8, 48), this.sunrise); this.sun.name = 'sati-sunrise'; this.sun.position.set(0, 20, -52);
    for (let i = 0; i < 7; i++) {
      const material = this.basic(i % 2 ? 0xff87aa : 0xffc56d, .01);
      const ray = this.mesh(new THREE.PlaneGeometry(4 + i * 1.6, 44), material); ray.position.set((i - 3) * 4.5, 15, -49 - i * .05); ray.rotation.z = (i - 3) * .09; this.rays.push(ray);
    }
    const warm = new THREE.PointLight(0xffae72, 0, 100, 1.2); warm.position.set(0, 18, -38); this.group.add(warm); this.lights.add(warm);
  }

  update(encounter: TrilogyEpilogueEncounter | undefined, elapsed: number): void {
    const state = encounter ?? newTrilogyEpilogue(this.kind); const phase = state.phase; const progress = trilogyEpilogueProgress(state);
    if (this.kind === 'ceasefire') {
      const retreat = phase === 'retreat' ? progress : ['message_ready', 'running', 'announcement', 'embrace', 'done'].includes(phase) ? 1 : 0;
      this.sentinels.forEach((sentinel, i) => {
        const row = Math.floor(i / 6), column = i % 6;
        sentinel.visible = retreat < .995; sentinel.position.set((column - 2.5) * 5.4 + row % 2 * 1.8,
          9 + row * 4 + retreat * (27 + row * 5), -48 - row * 5 - retreat * (22 + row * 6));
        sentinel.rotation.set(-.25 - retreat * .65, Math.PI + Math.sin(elapsed * 1.4 + i) * .2, Math.sin(elapsed * 2 + i) * .08);
      });
      const beacon = [...this.lights][0]; if (beacon) beacon.intensity = retreat * 420;
    } else if (this.kind === 'neo_carried' && this.barge && this.tray) {
      const lowering = phase === 'lowering' ? progress : ['transfer', 'departing', 'done'].includes(phase) ? 1 : 0;
      const transfer = phase === 'transfer' ? progress : ['departing', 'done'].includes(phase) ? 1 : 0;
      const depart = phase === 'departing' ? progress : phase === 'done' ? 1 : 0;
      this.tray.position.set(0, 1.05 + (1 - lowering) * 2.4 + depart * 1.2, -25 - transfer * 9 - depart * 20);
      this.barge.position.set(0, .05 + depart * 1.2, -34 - depart * 20); this.barge.rotation.z = Math.sin(elapsed * .35) * .025;
      this.cables.forEach((cable, i) => { cable.visible = phase === 'ready' || phase === 'disconnecting'; cable.scale.y = phase === 'disconnecting' ? Math.max(.03, 1 - progress - i * .035) : 1; });
    } else if (this.kind === 'dawn' && this.cat && this.catEcho && this.sunrise && this.sun) {
      const catActive = phase === 'cat'; const catProgress = catActive ? progress : ['architect', 'choice', 'promise', 'sati', 'sunrise', 'belief', 'done'].includes(phase) ? 1 : 0;
      this.cat.visible = catActive; this.cat.position.set(-15 + catProgress * 24, 0, -25); this.cat.rotation.y = Math.PI / 2;
      this.catEcho.visible = catActive && progress > .34 && progress < .9; this.catEcho.position.set(-15 + Math.max(0, progress - .28) * 24, .02, -25); this.catEcho.rotation.y = Math.PI / 2;
      this.resetTiles.forEach((tile, i) => { const reset = Math.max(0, Math.min(1, catProgress * 1.8 - i * .035)); tile.rotation.x = (i % 2 ? 1 : -1) * .09 * (1 - reset); tile.rotation.z = (i % 2 ? 1 : -1) * .08 * (1 - reset); tile.position.y = .08 + Math.sin(reset * Math.PI) * .42; });
      const rise = phase === 'sunrise' ? progress : ['belief', 'done'].includes(phase) ? 1 : 0;
      this.sunrise.opacity = .02 + rise * .96; this.sun.scale.setScalar(.3 + rise * .7); this.sun.position.y = 9 + rise * 11;
      this.rays.forEach((ray, i) => { const material = ray.material as THREE.MeshBasicMaterial; material.opacity = rise * (.1 + i % 3 * .035); ray.scale.x = .25 + rise * .75; });
      for (const light of this.lights) light.intensity = rise * 1250;
    }
  }

  dispose(): void {
    this.group.removeFromParent(); this.group.clear(); this.geometries.forEach(value => value.dispose());
    this.materials.forEach(value => value.dispose()); this.lights.forEach(value => value.dispose());
    this.geometries.clear(); this.materials.clear(); this.lights.clear();
  }
}
