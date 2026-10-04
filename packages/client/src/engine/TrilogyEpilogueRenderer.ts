import * as THREE from 'three';
import { neoCarryPose, newTrilogyEpilogue, trilogyEpilogueProgress, type TrilogyEpilogueEncounter, type TrilogyEpilogueKind } from '@auto_matrix/shared';
import { MachineUplinkContacts } from './MachineUplinkContacts.js';
import { SunriseGardenRenderer } from './SunriseGardenRenderer.js';

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
  private deck?: THREE.Mesh;
  private hull?: THREE.Mesh;
  private rails: THREE.Mesh[] = [];
  private braces: THREE.Mesh[] = [];
  private supports: THREE.Mesh[] = [];
  private liftArms: { lower: THREE.Mesh; upper: THREE.Mesh; end: THREE.Mesh }[] = [];
  private bargePosts: THREE.Mesh[] = [];
  private fittedBody?: THREE.Object3D;
  private cat?: THREE.Group;
  private resetTiles: THREE.Mesh[] = [];
  private park?: SunriseGardenRenderer;

  constructor(root: THREE.Group, private kind: TrilogyEpilogueKind) {
    root.add(this.group); this.group.name = `trilogy-epilogue-${kind}`;
    if (kind === 'ceasefire') this.buildCeasefire();
    else if (kind === 'neo_carried') this.buildCarried();
    else if (kind === 'reset') this.buildReset();
    else this.park = new SunriseGardenRenderer(this.group);
  }

  private material(color: number, roughness = .55, metalness = .15, emissive = 0, intensity = 0): THREE.MeshStandardMaterial {
    const material = new THREE.MeshStandardMaterial({ color, roughness, metalness, emissive, emissiveIntensity: intensity });
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
    const iron = this.material(0x3f515e, .38, .83), dark = this.material(0x19232b, .45, .78);
    const inset = this.material(0x202b32, .64, .25), signal = this.material(0xcba977, .4, .6, 0xffac42, .45);
    this.barge = new THREE.Group(); this.barge.name = 'neo-machine-funeral-barge'; this.group.add(this.barge);
    this.hull = this.mesh(new THREE.SphereGeometry(1, 24, 12), dark, this.barge);
    this.hull.scale.set(3.4, .42, 3.3); this.hull.position.set(0, .1, 2);
    for (const side of [-1, 1]) for (let i = 0; i < 5; i++) {
      const fin = this.mesh(new THREE.BoxGeometry(.65, .14, 1.5), iron, this.barge);
      fin.position.set(side * (2.5 + Math.sin(i / 4 * Math.PI) * .35), .22, -.2 + i * 1.1); fin.rotation.z = side * .15;
      const light = this.mesh(new THREE.BoxGeometry(.035, .05, .7), signal, this.barge); light.position.set(side * 2.85, .34, i * 1.1);
    }
    this.tray = new THREE.Group(); this.tray.name = 'neo-body-transfer-tray'; this.group.add(this.tray);
    this.deck = this.mesh(new THREE.BoxGeometry(1, 1, 1), inset, this.tray); this.deck.name = 'neo-carry-deck';
    this.deck.scale.set(6.2, .1, 5.8); this.deck.position.set(0, .88, 2);
    for (const side of [-1, 1]) {
      const rail = this.mesh(new THREE.BoxGeometry(.08, .1, 1), iron, this.tray); rail.name = `neo-tray-rim-${side < 0 ? 'left' : 'right'}`;
      this.rails.push(rail);
    }
    for (let i = 0; i < 24; i++) this.braces.push(this.mesh(new THREE.BoxGeometry(1, .075, .07), iron, this.tray));
    for (let i = 0; i < 7; i++) {
      const pad = this.mesh(new THREE.SphereGeometry(1, 14, 10), inset, this.tray); pad.name = `neo-carry-support-${i}`;
      pad.visible = false; this.supports.push(pad);
    }
    for (let i = 0; i < 4; i++) {
      const lower = this.mesh(new THREE.CylinderGeometry(.1, .15, 1, 10), dark);
      const upper = this.mesh(new THREE.CylinderGeometry(.07, .095, 1, 10), iron);
      const end = this.mesh(new THREE.SphereGeometry(.14, 10, 8), iron);
      lower.name = `neo-transfer-manipulator-${i}`; this.liftArms.push({ lower, upper, end });
      this.bargePosts.push(this.mesh(new THREE.CylinderGeometry(.1, .18, 1, 10), iron, this.barge));
    }
    this.bodyLight = new THREE.PointLight(0xafcfe3, 240, 18, 2); this.bodyLight.name = 'neo-tray-body-light';
    this.bodyLight.position.set(2.8, 4.2, 1.8); this.tray.add(this.bodyLight); this.lights.add(this.bodyLight);
  }

  private fitBody(subject?: THREE.Object3D): void {
    if (!subject?.getObjectByName('pelvis') || this.fittedBody === subject || !this.tray || !this.deck) return;
    subject.updateWorldMatrix(true, false); subject.updateMatrixWorld(true); this.tray.updateWorldMatrix(true, true);
    const points: THREE.Vector3[] = [], bounds = new THREE.Box3();
    subject.traverse(object => {
      if (!(object instanceof THREE.SkinnedMesh)) return;
      for (let parent: THREE.Object3D | null = object; parent && parent !== subject; parent = parent.parent) if (!parent.visible) return;
      object.skeleton.update();
      for (let i = 0; i < object.geometry.attributes.position.count; i++) {
        const point = this.tray!.worldToLocal(object.localToWorld(object.getVertexPosition(i, new THREE.Vector3())));
        points.push(point); bounds.expandByPoint(point);
      }
    });
    if (!points.length) return;
    this.fittedBody = subject;
    const size = bounds.getSize(new THREE.Vector3()), center = bounds.getCenter(new THREE.Vector3()), top = bounds.min.y - .006;
    const width = size.x + .4, length = size.z + .4, shape = new THREE.Shape();
    shape.moveTo(-width / 2, -length / 2); shape.lineTo(width / 2, -length / 2); shape.lineTo(width / 2, length / 2);
    shape.lineTo(-width / 2, length / 2); shape.closePath();
    const contacts = new MachineUplinkContacts().sample(subject);
    for (const contact of contacts?.ports ?? []) {
      const p = this.tray.worldToLocal(contact.point.clone()), opening = new THREE.Path();
      opening.absarc(p.x - center.x, center.z - p.z, .14, 0, Math.PI * 2, true); shape.holes.push(opening);
    }
    const neck = subject.getObjectByName('cervical-interface');
    if (neck) { const p = this.tray.worldToLocal(neck.getWorldPosition(new THREE.Vector3())), opening = new THREE.Path();
      opening.absarc(p.x - center.x, center.z - p.z, .17, 0, Math.PI * 2, true); shape.holes.push(opening); }
    const deck = new THREE.ExtrudeGeometry(shape, { depth: .1, bevelEnabled: false, curveSegments: 12 }); deck.rotateX(-Math.PI / 2);
    this.geometries.delete(this.deck.geometry); this.deck.geometry.dispose(); this.geometries.add(deck); this.deck.geometry = deck;
    this.deck.scale.setScalar(1); this.deck.position.set(center.x, top - .1, center.z);
    this.rails.forEach((rail, i) => { rail.scale.z = size.z + .65; rail.position.set(center.x + (i ? 1 : -1) * (size.x / 2 + .24), top + .035, center.z); });
    this.braces.forEach((rib, i) => { rib.scale.x = size.x + .42; rib.position.set(center.x, top - .14, bounds.min.z - .15 + i / 23 * (size.z + .3)); });
    if (this.hull) { this.hull.position.z = center.z; this.hull.scale.x = size.x / 2 + .4; this.hull.scale.z = size.z / 2 + .65; }
    ['head', 'chest', 'pelvis', 'wrist_L', 'wrist_R', 'ankle_L', 'ankle_R'].forEach((name, i) => {
      const bone = subject.getObjectByName(name); if (!bone) return;
      const position = this.tray!.worldToLocal(bone.getWorldPosition(new THREE.Vector3()));
      const rx = i === 1 || i === 2 ? .48 : .22, rz = i === 1 || i === 2 ? .38 : .22, ry = .12;
      let y = Infinity;
      for (const point of points) {
        const radial = ((point.x - position.x) / rx) ** 2 + ((point.z - position.z) / rz) ** 2;
        if (radial < 1) y = Math.min(y, point.y - ry * Math.sqrt(1 - radial) - .004);
      }
      const pad = this.supports[i]; pad.visible = Number.isFinite(y);
      if (pad.visible) { pad.position.set(position.x, y, position.z); pad.scale.set(rx, ry, rz); }
    });
  }

  private catModel(material: THREE.Material): THREE.Group {
    const cat = new THREE.Group();
    const body = this.mesh(new THREE.CapsuleGeometry(.23, .65, 4, 12), material, cat); body.rotation.x = Math.PI / 2; body.position.y = .52;
    const head = this.mesh(new THREE.SphereGeometry(.35, 12, 9), material, cat); head.position.set(0, .7, -.62);
    for (const side of [-1, 1]) { const ear = this.mesh(new THREE.ConeGeometry(.15, .34, 4), material, cat); ear.position.set(side * .2, 1.02, -.65); }
    for (const x of [-.16, .16]) for (const z of [-.35, .35]) {
      const leg = new THREE.Group(); leg.name = 'reset-cat-leg'; leg.position.set(x, .5, z); cat.add(leg);
      const shin = this.mesh(new THREE.CylinderGeometry(.055, .07, .43, 8), material, leg); shin.position.y = -.215;
      const paw = this.mesh(new THREE.SphereGeometry(.07, 8, 6), material, leg); paw.position.set(0, -.44, -.025); paw.scale.z = 1.4;
    }
    const tail = this.mesh(new THREE.TorusGeometry(.65, .055, 6, 18, Math.PI * 1.3), material, cat); tail.rotation.set(Math.PI / 2, 0, -.5); tail.position.set(.65, .72, .25);
    return cat;
  }

  private buildReset(): void {
    const black = this.material(0x111817, .82, .05); this.cat = this.catModel(black); this.cat.name = 'matrix-reset-black-cat'; this.group.add(this.cat);
    const stone = this.material(0x7c8580, .94);
    for (let i = 0; i < 15; i++) {
      const tile = this.mesh(new THREE.BoxGeometry(2.6 + i % 3, .2, 2.2 + (i * 2) % 3), stone); tile.position.set(-12 + i % 5 * 5.6, .1, -24 + Math.floor(i / 5) * 4.8);
      tile.rotation.y = (i % 3 - 1) * .14; tile.rotation.x = (i % 2 ? 1 : -1) * .09; this.resetTiles.push(tile);
    }
  }

  update(encounter: TrilogyEpilogueEncounter | undefined, elapsed: number, subject?: THREE.Object3D): void {
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
      const pose = neoCarryPose(state);
      this.tray.position.set(pose.x, 1.05 + pose.y, pose.z);
      this.barge.position.set(pose.x, pose.bargeY, pose.bargeZ);
      this.fitBody(subject);
      if (this.deck) {
        this.deck.geometry.computeBoundingBox(); const deck = this.deck.geometry.boundingBox!;
        const halfWidth = (deck.max.x - deck.min.x) * this.deck.scale.x / 2 - .14;
        const top = this.tray.position.y + this.deck.position.y - .14;
        const release = THREE.MathUtils.smoothstep(pose.transfer, .84, 1);
        const rod = (mesh: THREE.Mesh, start: THREE.Vector3, end: THREE.Vector3) => {
          const direction = end.clone().sub(start); mesh.position.copy(start).addScaledVector(direction, .5);
          mesh.scale.y = direction.length(); mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction.normalize());
        };
        this.liftArms.forEach((arm, i) => {
          const side = i % 2 ? 1 : -1, z = this.deck!.position.z + (i < 2 ? -1.3 : 1.3);
          const foot = new THREE.Vector3(side * (halfWidth + 1.4), .12, -25 + z);
          const elbow = new THREE.Vector3(side * (halfWidth + .75), 1.1, -25 + z);
          const end = new THREE.Vector3(pose.x + side * halfWidth, top, pose.z + z).lerp(elbow, release);
          rod(arm.lower, foot, elbow); rod(arm.upper, elbow, end); arm.end.position.copy(end);
          const post = this.bargePosts[i], height = 1.05 + this.deck!.position.y - .05 - .35;
          post.position.set(side * halfWidth, .35 + height / 2, z); post.scale.y = height;
        });
      }
    } else if (this.kind === 'reset' && this.cat) {
      const catProgress = phase === 'cat' ? progress : phase === 'done' ? 1 : 0;
      this.cat.visible = phase !== 'ready'; this.cat.position.set(-8 + Math.min(1, catProgress * 1.4) * 10, 0, -13); this.cat.rotation.y = -Math.PI / 2;
      this.cat.getObjectsByProperty('name', 'reset-cat-leg').forEach((leg, i) => { leg.rotation.x = catProgress < .72 ? Math.sin(state.total * 8 + i % 3 * Math.PI) * .35 : 0; });
      this.resetTiles.forEach((tile, i) => { const reset = Math.max(0, Math.min(1, catProgress * 2 - i * .035));
        tile.visible = reset < .99; tile.rotation.x = (i % 2 ? 1 : -1) * .09 * (1 - reset); tile.position.y = .1 * (1 - reset); });
    }
    this.park?.update(state);
  }

  parkAtmosphere(): { color: number; ambient: number; sun: number } | undefined { return this.park?.atmosphere(); }

  dispose(): void {
    this.park?.dispose();
    this.group.removeFromParent(); this.group.clear(); this.geometries.forEach(value => value.dispose());
    this.materials.forEach(value => value.dispose()); this.lights.forEach(value => value.dispose());
    this.geometries.clear(); this.materials.clear(); this.lights.clear();
  }
}
