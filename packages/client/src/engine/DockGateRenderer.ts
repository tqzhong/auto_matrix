import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { DOCK_EMP, DOCK_GATE, dockGateOpen, dockGateShip, dockEmpShip, dockPowerOffline, type FilmJourney } from '@auto_matrix/shared';
import { DOCK_REUNION, dockEmpHullBase, dockHatchPose, dockReunionTread } from '@auto_matrix/shared';

export class DockGateRenderer {
  readonly group = new THREE.Group();
  private fixed = new THREE.Group();
  private leaf = new THREE.Group();
  private weight = new THREE.Group();
  private cable = new THREE.Group();
  private ship = new THREE.Group();
  private hatch = new THREE.Group();
  private descent = new THREE.Group();
  private engines: THREE.MeshBasicMaterial;
  private spark: THREE.InstancedMesh;
  private tracer: THREE.Mesh;
  private geometries = new Set<THREE.BufferGeometry>();
  private materials = new Set<THREE.Material>();
  private scratch = new THREE.Object3D();
  constructor(parent: THREE.Group, metal: THREE.MeshStandardMaterial, iron: THREE.MeshStandardMaterial) {
    this.group.name = 'gate-three-mechanism'; parent.add(this.group);
    this.leaf.name = 'zion-gate-three'; this.weight.name = 'gate-three-counterweight'; this.cable.name = 'gate-three-cable'; this.ship.name = 'gate-three-hammer';
    this.group.add(this.fixed, this.leaf, this.weight, this.cable, this.ship, this.descent);
    this.descent.name = 'hammer-broken-hatch-descent'; this.hatch.name = 'hammer-rear-hatch';
    const plate = metal.clone(); plate.color.set(0x646e70); plate.roughness = .61; this.materials.add(plate);
    const edge = iron.clone(); edge.color.set(0x303c41); this.materials.add(edge);
    const cableMaterial = new THREE.MeshStandardMaterial({ color: 0x958575, roughness: .48, metalness: .8 }); this.materials.add(cableMaterial);
    const warm = new THREE.MeshBasicMaterial({ color: 0xffc187, toneMapped: false }); this.materials.add(warm);
    this.engines = warm.clone(); this.materials.add(this.engines);
    for (const side of [-1, 1]) {
      const shape = new THREE.Shape(); shape.moveTo(0, -DOCK_GATE.radius);
      for (let i = 0; i <= 40; i++) { const a = -Math.PI / 2 + i * Math.PI / 40; shape.lineTo(side * Math.cos(a) * DOCK_GATE.radius, Math.sin(a) * DOCK_GATE.radius); }
      shape.closePath(); const owner = side < 0 ? this.fixed : this.leaf;
      const door = this.mesh(new THREE.ExtrudeGeometry(shape, { depth: 1.8, bevelEnabled: true, bevelSize: .13, bevelThickness: .1, bevelSegments: 2, steps: 1 }), plate, owner);
      door.position.set(0, DOCK_GATE.centerY, DOCK_GATE.z - .9);
      for (let y = 6; y <= 50; y += 4) {
        const width = Math.sqrt(Math.max(0, DOCK_GATE.radius ** 2 - (y - DOCK_GATE.centerY) ** 2)) - .5;
        this.box(edge, side * width / 2, y, DOCK_GATE.z + 1.15, width, .55, .65, owner);
        for (let x = 2; x < width - 1; x += 3.8) this.box(cableMaterial, side * x, y, DOCK_GATE.z + 1.53, .24, .24, .12, owner);
      }
      this.box(edge, side * .55, DOCK_GATE.centerY, DOCK_GATE.z + 1.4, .65, 47, .7, owner);
      for (const x of [side * 5, side * 13, side * 21]) {
        const h = Math.sqrt(DOCK_GATE.radius ** 2 - x * x) * 2 - 1;
        this.box(edge, x, DOCK_GATE.centerY, DOCK_GATE.z + 1.3, .5, h, .45, owner);
      }
    }
    const ring = this.mesh(new THREE.TorusGeometry(26.3, 1.4, 12, 80), plate, this.fixed); ring.position.set(0, DOCK_GATE.centerY, DOCK_GATE.z);
    for (let i = 0; i < 24; i++) {
      const a = i * Math.PI / 12, shoe = this.box(edge, Math.sin(a) * 26.1, DOCK_GATE.centerY + Math.cos(a) * 26.1, DOCK_GATE.z + 1.4, 1.15, 2.2, 1, this.fixed); shoe.rotation.z = -a;
    }
    const tunnelMaterial = edge.clone(); tunnelMaterial.side = THREE.BackSide; this.materials.add(tunnelMaterial);
    const tunnel = this.mesh(new THREE.CylinderGeometry(24.8, 24.8, 85, 64, 1, true), tunnelMaterial, this.fixed);
    tunnel.rotation.x = Math.PI / 2; tunnel.position.set(0, DOCK_GATE.centerY, DOCK_GATE.z - 44);
    for (let z = -75; z > -145; z -= 14) {
      const rib = this.mesh(new THREE.TorusGeometry(24.4, .38, 8, 48), plate, this.fixed); rib.position.set(0, DOCK_GATE.centerY, z);
    }
    for (const x of [27.6, 34.4]) {
      this.box(edge, x, 26, -62, .75, 49, 1.2, this.fixed);
      for (let y = 3; y < 49; y += 4) this.box(plate, x, y, -60.5, 1.3, .35, 2.6, this.fixed);
    }
    for (let i = 0; i < 7; i++) this.box(plate, 31, 15.6 + i * 1.25, -61, 5.6, 1.1, 2.2, this.weight);
    for (const x of [28.9, 33.1]) this.box(edge, x, 19.3, -59.75, .35, 9.5, .35, this.weight);
    const pulley = this.mesh(new THREE.TorusGeometry(2, .42, 12, 32), cableMaterial, this.fixed); pulley.position.set(31, 46, -61); pulley.rotation.y = Math.PI / 2;
    this.box(edge, 31, 47, -62, 8, .7, 4, this.fixed);
    // Short braided sections let the two broken ends separate at the actual bullet impact.
    for (let segment = 0; segment < 28; segment++) {
      const section = new THREE.Group(); section.position.set(31, 22 + segment * .85, -61); section.userData.height = section.position.y;
      this.cable.add(section);
      for (let strand = 0; strand < 5; strand++) {
        const points = Array.from({ length: 7 }, (_, i) => {
          const a = strand * Math.PI * .4 + (segment + i / 6) * 1.7;
          return new THREE.Vector3(Math.cos(a) * .32, i / 6 * .85, Math.sin(a) * .32);
        });
        this.mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points), 6, .18, 6, false), cableMaterial, section);
      }
      this.batch(section);
    }
    const hull = this.mesh(new THREE.CylinderGeometry(4.4, 3.4, 34, 16, 1, true), edge, this.ship); hull.rotation.x = Math.PI / 2;
    const front = this.mesh(new THREE.CircleGeometry(3.4, 32), edge, this.ship); front.position.z = -17; front.rotation.y = Math.PI;
    const rear = new THREE.Shape(); rear.absarc(0, 0, 4.4, 0, Math.PI * 2, false);
    const opening = new THREE.Path(); opening.absarc(0, 0, DOCK_REUNION.hatch.radius, 0, Math.PI * 2, true); rear.holes.push(opening);
    const rim = this.mesh(new THREE.ShapeGeometry(rear, 32), plate, this.ship); rim.position.z = 17.02;
    this.box(plate, 0, 1.8, 1, 7.2, 2.2, 23, this.ship);
    for (const side of [-1, 1]) this.box(edge, side * 3.45, 0, 15.7, .35, 4.7, 2.5, this.ship);
    for (const side of [-1, 1]) {
      this.box(edge, side * 5.7, 0, -5, 3, 3, 20, this.ship);
      for (let z = -13; z < 12; z += 6) {
        const pad = this.mesh(new THREE.TorusGeometry(1.55, .37, 8, 18), plate, this.ship); pad.position.set(side * 5.8, -.4, z); pad.rotation.x = Math.PI / 2;
        const core = this.mesh(new THREE.CircleGeometry(1.15, 16), this.engines, this.ship); core.position.copy(pad.position); core.rotation.x = -Math.PI / 2;
      }
      for (let z = -14; z <= 12; z += 4) this.box(plate, side * 3.9, 2.7, z, .4, 1.1, 1.7, this.ship);
    }
    this.batch(this.ship); this.batch(this.fixed); this.batch(this.leaf); this.batch(this.weight);
    this.ship.add(this.hatch); this.hatch.position.z = 17.04;
    const cover = this.mesh(new THREE.CylinderGeometry(DOCK_REUNION.hatch.radius, DOCK_REUNION.hatch.radius, .18, 32), edge, this.hatch);
    cover.rotation.x = Math.PI / 2;
    for (const y of [-1.9, -.8, .3, 1.4]) this.box(plate, 0, y, .06, 5.4, .12, .15, this.hatch);
    const deck = this.box(plate, 20, 0, 52.65, 7.4, .16, 5.4, this.descent); deck.name = 'hammer-exit-deck';
    for (let i = 0; i <= DOCK_REUNION.steps; i++) {
      const tread = this.box(plate, 0, 0, 0, 7.4, .16, 1.12, this.descent); tread.name = `hammer-exit-tread-${i}`;
      for (const side of [-1, 1]) {
        const post = this.box(edge, 0, 0, 0, .09, 1.4, .09, this.descent); post.name = `hammer-exit-post-${i}-${side}`;
        if (i < DOCK_REUNION.steps) {
          const rail = this.box(edge, 0, 0, 0, .1, 1, .1, this.descent); rail.name = `hammer-exit-rail-${i}-${side}`;
        }
      }
    }
    const sparkGeo = new THREE.SphereGeometry(.05, 4, 3); this.geometries.add(sparkGeo);
    this.spark = new THREE.InstancedMesh(sparkGeo, warm, 24); this.spark.frustumCulled = false; this.spark.name = 'gate-cable-impact'; this.group.add(this.spark);
    this.tracer = this.mesh(new THREE.CylinderGeometry(.025, .025, 1, 6), warm, this.group); this.tracer.name = 'gate-apu-tracer';
  }
  private mesh(geometry: THREE.BufferGeometry, material: THREE.Material, parent: THREE.Object3D): THREE.Mesh {
    this.geometries.add(geometry); const mesh = new THREE.Mesh(geometry, material); mesh.castShadow = true; mesh.receiveShadow = true; parent.add(mesh); return mesh;
  }
  private box(material: THREE.Material, x: number, y: number, z: number, w: number, h: number, d: number, parent: THREE.Object3D): THREE.Mesh {
    const mesh = this.mesh(new THREE.BoxGeometry(w, h, d), material, parent); mesh.position.set(x, y, z); return mesh;
  }
  private batch(parent: THREE.Group): void {
    parent.updateWorldMatrix(true, true); const inverse = parent.matrixWorld.clone().invert();
    const batches = new Map<THREE.Material, THREE.BufferGeometry[]>(), meshes: THREE.Mesh[] = [];
    parent.traverse(object => {
      if (!(object instanceof THREE.Mesh) || Array.isArray(object.material)) return;
      const copy = object.geometry.clone().applyMatrix4(inverse.clone().multiply(object.matrixWorld));
      const flat = copy.index ? copy.toNonIndexed() : copy; if (flat !== copy) copy.dispose();
      (batches.get(object.material) ?? (batches.set(object.material, []), batches.get(object.material)!)).push(flat); meshes.push(object);
    });
    meshes.forEach(mesh => { mesh.removeFromParent(); this.geometries.delete(mesh.geometry); mesh.geometry.dispose(); });
    for (const [material, shapes] of batches) { const merged = mergeGeometries(shapes); shapes.forEach(shape => shape.dispose()); if (merged) this.mesh(merged, material, parent); }
  }
  update(journey?: FilmJourney, muzzle?: THREE.Vector3): void {
    const gate = journey?.dockGate;
    const complete = Boolean(journey?.completed.includes('m3_gate'));
    const open = gate ? dockGateOpen(gate) : complete ? 1 : 0;
    this.leaf.position.x = DOCK_GATE.travel * open; this.weight.position.y = -DOCK_GATE.weight.travel * open;
    for (const section of this.cable.children) {
      const y = section.userData.height as number, cut = gate?.lastShot?.y ?? 32;
      section.position.y = y - (y < cut ? DOCK_GATE.weight.travel * open : 0);
      section.position.x = 31 + (open && y > cut && y < cut + 3 ? Math.sin((y - cut) * 1.3) * .5 : 0);
      section.visible = !open || Math.abs(y - cut) > .8;
    }
    this.ship.visible = Boolean(!journey?.visiting && (gate && ['opening', 'entering', 'done'].includes(gate.phase) && journey?.scene === 'm3_gate' || ['m3_emp', 'm3_dock_reunion'].includes(journey?.scene ?? '')));
    const ship = journey?.emp ? dockEmpShip(journey.emp.elapsed ?? DOCK_EMP.seconds) : dockGateShip(gate);
    this.ship.position.set(ship.x, ship.y, ship.z); this.ship.rotation.z = ship.roll;
    if (journey?.emp) {
      const floor = journey.diggers ? 1 : 0;
      this.ship.position.y = Math.max(ship.y, dockEmpHullBase(ship.roll, floor));
    }
    if (journey?.scene === 'm3_dock_reunion' && !journey.visiting) {
      if (this.hatch.parent !== this.group) this.group.add(this.hatch);
      const pose = dockHatchPose(journey.dockReunion?.departure ?? DOCK_REUNION.departure.hatchSeconds, journey.dockReunion?.floor ?? (journey.diggers ? 1 : 0));
      this.hatch.position.set(pose.x, pose.y, pose.z); this.hatch.rotation.set(pose.pitch, 0, pose.roll);
    } else {
      if (this.hatch.parent !== this.ship) this.ship.add(this.hatch);
      this.hatch.position.set(0, 0, 17.04); this.hatch.rotation.set(0, 0, 0);
    }
    this.hatch.visible = this.ship.visible;
    this.descent.visible = journey?.scene === 'm3_dock_reunion' && !journey.visiting;
    if (this.descent.visible) this.descent.getObjectByName('hammer-exit-deck')!.position.y = dockReunionTread(0,
      journey!.dockReunion?.floor ?? (journey!.diggers ? 1 : 0)).y - .08;
    if (this.descent.visible) for (let i = 0; i <= DOCK_REUNION.steps; i++) {
      const tread = dockReunionTread(i, journey!.dockReunion?.floor ?? (journey!.diggers ? 1 : 0));
      this.descent.getObjectByName(`hammer-exit-tread-${i}`)!.position.set(tread.x, tread.y - .08, tread.z);
      for (const side of [-1, 1]) {
        this.descent.getObjectByName(`hammer-exit-post-${i}-${side}`)!.position.set(tread.x + side * DOCK_REUNION.rail.halfWidth, tread.y + .7, tread.z);
        const rail = this.descent.getObjectByName(`hammer-exit-rail-${i}-${side}`);
        if (rail) {
          const next = dockReunionTread(i + 1, journey!.dockReunion?.floor ?? (journey!.diggers ? 1 : 0));
          const direction = new THREE.Vector3(0, next.y - tread.y, next.z - tread.z);
          rail.position.set(tread.x + side * DOCK_REUNION.rail.halfWidth, (tread.y + next.y) / 2 + DOCK_REUNION.rail.height, (tread.z + next.z) / 2);
          rail.scale.y = direction.length(); rail.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction.normalize());
        }
      }
    }
    this.engines.color.setHex(dockPowerOffline(journey) ? 0x101b20 : 0xffc187);
    const shot = gate?.lastShot, age = shot ? gate!.total - shot.at : 10;
    this.spark.visible = Boolean(shot?.hit && age < .5);
    if (this.spark.visible) for (let i = 0; i < 24; i++) {
      const angle = i * 2.4; this.scratch.position.set(shot!.x + Math.cos(angle) * age * 7, shot!.y + Math.sin(angle) * age * 5 - 5 * age * age, shot!.z + .3 + age * (2 + i % 4));
      this.scratch.scale.set(.6, 1 + age * 7, .6); this.scratch.quaternion.identity(); this.scratch.updateMatrix(); this.spark.setMatrixAt(i, this.scratch.matrix);
    }
    this.spark.instanceMatrix.needsUpdate = true; this.tracer.visible = Boolean(gate && shot && muzzle && age < .1);
    if (this.tracer.visible) {
      const from = muzzle!, to = new THREE.Vector3(shot!.x, shot!.y, shot!.z);
      const delta = to.clone().sub(from); this.tracer.position.copy(from).add(to).multiplyScalar(.5); this.tracer.scale.y = delta.length();
      this.tracer.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), delta.normalize());
    }
  }
  dispose(): void { this.group.removeFromParent(); this.group.clear(); this.geometries.forEach(g => g.dispose()); this.materials.forEach(m => m.dispose()); }
}
