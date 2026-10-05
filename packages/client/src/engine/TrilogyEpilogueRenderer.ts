import * as THREE from 'three';
import { STREET_RESET, neoCarryPose, newTrilogyEpilogue, streetResetPose, trilogyEpilogueProgress, type TrilogyEpilogueEncounter, type TrilogyEpilogueKind } from '@auto_matrix/shared';
import { MachineUplinkContacts } from './MachineUplinkContacts.js';
import { SunriseGardenRenderer } from './SunriseGardenRenderer.js';
import { reach } from '../agents/SpoonPerformance.js';
import { batchStaticGeometry } from './StaticGeometry.js';

/** Physical epilogue beats layered over the existing Zion, Machine City and park sets. */
export class TrilogyEpilogueRenderer {
  private group = new THREE.Group();
  private geometries = new Set<THREE.BufferGeometry>();
  private materials = new Set<THREE.Material>();
  private textures = new Set<THREE.Texture>();
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
  private catLegs: { hip: THREE.Group; knee: THREE.Group; ankle: THREE.Group; rear: boolean; side: number }[] = [];
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
    const sphere = new THREE.SphereGeometry(1, 20, 14);
    const oval = (parent: THREE.Group, position: number[], size: number[], surface = material) => {
      const mesh = this.mesh(sphere, surface, parent); mesh.position.fromArray(position); mesh.scale.fromArray(size); return mesh;
    };
    oval(cat, [0, .48, 0], [.48, .19, .20]); oval(cat, [.35, .54, 0], [.20, .26, .21]);
    const head = new THREE.Group(); head.name = 'reset-cat-head'; head.position.set(.55, .67, 0); cat.add(head);
    oval(head, [0, 0, 0], [.19, .18, .18]); oval(head, [.15, -.07, 0], [.11, .075, .12]);
    const eye = this.material(0x8f9256, .32), nose = this.material(0x24221f, .65);
    oval(head, [.24, -.055, 0], [.032, .025, .035], nose);
    for (const side of [-1, 1]) {
      const ear = this.mesh(new THREE.ConeGeometry(.095, .20, 8), material, head); ear.position.set(-.02, .20, side * .11); ear.rotation.x = side * .18;
      oval(head, [.12, .035, side * .13], [.028, .025, .015], eye);
      oval(head, [.13, .035, side * .143], [.008, .022, .004]);
      for (const rear of [false, true]) {
        const hip = new THREE.Group(); hip.position.set(rear ? -.36 : .34, .46, side * .13); cat.add(hip);
        oval(hip, [0, -.12, 0], [rear ? .10 : .063, .16, .066]);
        const knee = new THREE.Group(); knee.position.y = -.24; hip.add(knee);
        oval(knee, [0, -.11, 0], [.040, .135, .045]);
        const ankle = new THREE.Group(); ankle.position.y = -.24; knee.add(ankle);
        oval(ankle, [.025, 0, 0], [.10, .048, .063]).name = 'reset-cat-paw';
        this.catLegs.push({ hip, knee, ankle, rear, side });
      }
    }
    const curve = new THREE.CatmullRomCurve3([new THREE.Vector3(-.42,.52,0), new THREE.Vector3(-.72,.63,.03), new THREE.Vector3(-.87,.98,.08), new THREE.Vector3(-.80,1.15,.10)]);
    this.mesh(new THREE.TubeGeometry(curve, 28, .043, 8, false), material, cat).name = 'reset-cat-tail';
    return cat;
  }

  private buildReset(): void {
    const black = this.material(0x111817, .82, .05); this.cat = this.catModel(black); this.cat.name = 'matrix-reset-black-cat'; this.group.add(this.cat);
    const pbr = (folder: string, name: string, color: number, repeatX: number, repeatY: number) => {
      const material = this.material(color, .87, 0);
      for (const [key, suffix] of [['map', 'color'], ['normalMap', 'normal'], ['roughnessMap', 'roughness']] as const) {
        const texture = new THREE.TextureLoader().load(`/assets/${folder}/${name}-${suffix}.jpg`);
        texture.wrapS = texture.wrapT = THREE.RepeatWrapping; texture.repeat.set(repeatX, repeatY); texture.anisotropy = 8;
        if (key === 'map') texture.colorSpace = THREE.SRGBColorSpace;
        material[key] = texture; this.textures.add(texture);
      }
      material.normalScale.set(.45, .45); return material;
    };
    const pavement = pbr('surfaces', 'concrete_pavement_03', 0x919993, 90, 1.5);
    const slab = pbr('surfaces', 'concrete_pavement_03', 0x919993, .75, .75);
    const asphalt = pbr('surfaces', 'asphalt_02', 0x707b7d, 82.5, 6);
    const plaster = pbr('film-materials', 'damaged_plaster', 0x7e8179, 3, 1);
    const stone = this.material(0x777b74, .94, 0), iron = this.material(0x1b2428, .72, .35);
    const recess = this.material(0x080f13, .93, 0), glass = this.material(0x344543, .38, .12, 0x243631, .16);
    const cube = new THREE.BoxGeometry(1, 1, 1);
    const box = (x: number, y: number, z: number, w: number, h: number, d: number, material: THREE.Material, parent = this.group) => {
      const mesh = this.mesh(cube, material, parent); mesh.position.set(x, y, z); mesh.scale.set(w, h, d); return mesh;
    };
    const sidewalk = this.mesh(new THREE.PlaneGeometry(600, 5.2), pavement); sidewalk.name = 'reset-sidewalk';
    sidewalk.rotation.x = -Math.PI / 2; sidewalk.position.set(0, -.006, -12);
    const across = sidewalk.clone(); across.name = 'reset-opposite-sidewalk'; across.position.z = 12; this.group.add(across);
    const road = this.mesh(new THREE.PlaneGeometry(600, STREET_RESET.curb * 2), asphalt); road.rotation.x = -Math.PI / 2; road.position.set(0, -STREET_RESET.roadDrop, 0);
    for (const side of [-1, 1]) box(0, -.12, STREET_RESET.curb * side, 600, .24, .28, stone);
    const facade = new THREE.Group(); facade.name = 'reset-basement-front'; facade.position.z = STREET_RESET.facade.z; this.group.add(facade);
    // The sleeping child stays on the original save coordinates. The street is
    // built around that body, with low barred windows immediately behind it.
    for (let bay = -8; bay <= 8; bay++) {
      const x = 2.5 + bay * 6.8;
      box(x, 8.2, -0.10, 6.76, 13.6, .5, plaster, facade);
      box(x, .76, -0.35, 6.76, 1.52, .25, recess, facade);
      for (const side of [-1, 1]) box(x + side * 2.88, .76, 0.08, 1.02, 1.52, .7, stone, facade);
      box(x, .08, 0.28, 4.82, .16, .55, stone, facade);
      box(x, 1.46, 0.26, 4.86, .22, .6, stone, facade);
      box(x, .77, -0.15, 4.73, 1.15, .05, glass, facade);
      for (let bar = -3; bar <= 3; bar++) box(x + bar * .62, .78, 0.22, .047, 1.17, .07, iron, facade);
      box(x, .85, 0.22, 4.75, .055, .07, iron, facade);
      for (const y of [3.35, 6.9, 10.45]) {
        box(x, y, 0.19, 2.15, 2.72, .13, recess, facade);
        box(x, y, 0.30, 1.96, 2.53, .035, glass, facade);
        for (const side of [-1, 1]) box(x + side * 1.1, y, 0.38, .11, 2.94, .16, stone, facade);
        box(x, y, 0.43, .075, 2.6, .12, iron, facade);
        box(x, y + .1, 0.43, 2.03, .07, .12, iron, facade);
        box(x, y - 1.42, 0.48, 2.46, .15, .5, stone, facade);
      }
    }
    box(0, 1.67, 0.20, STREET_RESET.facade.width, .18, .56, stone, facade);
    box(0, 5.2, 0.18, STREET_RESET.facade.width, .10, .48, stone, facade);
    for (const x of [-18, 16]) {
      box(x, 3, 0.55, .13, 6, .13, iron, facade);
      const elbow = this.mesh(new THREE.TorusGeometry(.22, .065, 8, 12, Math.PI / 2), iron, facade);
      elbow.position.set(x + .22, .24, 0.55); elbow.rotation.z = Math.PI;
    }
    const tiles = new THREE.Group(); tiles.name = 'reset-paving-slabs'; this.group.add(tiles);
    for (let row = 0; row < 3; row++) for (let column = 0; column < 13; column++) {
      const x = -10.8 + column * 1.7, z = -13.7 + row * 1.7;
      // A stationary support patch remains beneath Sati's body and gathering legs.
      if (row < 2 && x > -1.8 && x < 4) continue;
      const tile = this.mesh(new THREE.BoxGeometry(1.68, .12, 1.68), slab, tiles);
      tile.position.set(x, -.06, z); this.resetTiles.push(tile);
    }
    const key = new THREE.DirectionalLight(0x91bfd4, 2.1); key.position.set(-9, 9, -3); key.target.position.set(0, 0, -12);
    key.castShadow = true; key.shadow.mapSize.set(1024, 1024); key.shadow.normalBias = .018; key.shadow.bias = -.0002;
    Object.assign(key.shadow.camera, { left: -14, right: 14, top: 9, bottom: -9, near: .1, far: 40 });
    this.group.add(key, key.target); this.lights.add(key);
    const fill = new THREE.HemisphereLight(0x86a3bb, 0x252923, .32); this.group.add(fill); this.lights.add(fill);
    batchStaticGeometry(this.group, new Set(this.resetTiles)).forEach(geometry => this.geometries.add(geometry));
    // Reuse the already batched geometry for the surrounding street, including
    // views away from the child. These distant copies add no texture allocations.
    for (const side of [-1, 1]) for (const offset of [-2, -1, 0, 1, 2]) {
      if (side === 1 && offset === 0) continue;
      const block = facade.clone(); block.name = 'reset-surrounding-block';
      block.position.set(offset * 115.6, 0, STREET_RESET.facade.z * side); block.rotation.y = side === 1 ? 0 : Math.PI;
      this.group.add(block);
    }
    this.update(newTrilogyEpilogue('reset'), 0);
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
      const pose = streetResetPose(state);
      this.cat.visible = pose.visible; this.cat.position.set(pose.catX, 0, pose.catZ); this.cat.rotation.y = pose.catYaw;
      this.cat.getObjectByName('reset-cat-head')!.rotation.y = phase === 'waking' ? -.4 * (1 - THREE.MathUtils.smoothstep(state.elapsed, 0, 2)) : 0;
      this.cat.updateWorldMatrix(true, true); const rotation = this.cat.getWorldQuaternion(new THREE.Quaternion());
      this.catLegs.forEach(({ hip, knee, ankle, rear, side }) => {
        const cycle = pose.catClock * 8 + (rear ? Math.PI : 0) + (side > 0 ? Math.PI : 0);
        const stride = Math.sin(cycle) * .14 * pose.catWalk, lift = Math.max(0, Math.cos(cycle)) * .07 * pose.catWalk;
        const target = this.cat!.localToWorld(new THREE.Vector3(hip.position.x + stride, .048 + lift, hip.position.z));
        reach(hip, knee, ankle.position, target, new THREE.Vector3(rear ? 1 : -1, 0, 0).applyQuaternion(rotation));
        ankle.quaternion.copy(knee.getWorldQuaternion(new THREE.Quaternion()).invert().multiply(rotation));
      });
      this.resetTiles.forEach((tile, i) => {
        const front = -6 + pose.pavement * 20;
        const broken = 1 - THREE.MathUtils.smoothstep(front, tile.position.x - 1.3, tile.position.x + 1.3);
        tile.rotation.set((i % 2 ? 1 : -1) * .13 * broken, 0, (i % 3 - 1) * .1 * broken);
        tile.position.y = -.06 + (.18 + i % 3 * .06) * broken;
      });
    }
    this.park?.update(state);
  }

  parkAtmosphere(): { color: number; ambient: number; sun: number } | undefined { return this.park?.atmosphere(); }

  dispose(): void {
    this.park?.dispose();
    this.group.removeFromParent(); this.group.clear(); this.geometries.forEach(value => value.dispose());
    this.materials.forEach(value => value.dispose()); this.lights.forEach(value => value.dispose());
    this.textures.forEach(value => value.dispose());
    this.geometries.clear(); this.materials.clear(); this.lights.clear(); this.textures.clear();
  }
}
