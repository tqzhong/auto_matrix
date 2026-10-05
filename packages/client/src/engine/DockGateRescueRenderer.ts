import * as THREE from 'three';
import { dockGateAttacker, dockGatePoint, type FilmJourney } from '@auto_matrix/shared';

/** A second sentinel attacks the pilot; every tendril and impact uses the saved gate clock. */
export class DockGateRescueRenderer {
  readonly group = new THREE.Group();
  private machine = new THREE.Group();
  private arms: THREE.InstancedMesh;
  private fragments: THREE.InstancedMesh;
  private geometries = new Set<THREE.BufferGeometry>();
  private materials: THREE.Material[] = [];
  private eye = new THREE.MeshStandardMaterial({ color: 0x792211, emissive: 0xff350c, emissiveIntensity: 3 });
  private scratch = new THREE.Object3D();
  constructor(parent: THREE.Group) {
    this.group.name = 'gate-sentinel-rescue'; parent.add(this.group); this.group.add(this.machine);
    this.machine.name = 'gate-attacking-sentinel';
    const steel = new THREE.MeshStandardMaterial({ color: 0x5a655f, metalness: .75, roughness: .38 });
    const glow = new THREE.MeshBasicMaterial({ color: 0xffd8a1, toneMapped: false }); this.materials.push(steel, glow, this.eye);
    const shell = this.mesh(new THREE.IcosahedronGeometry(1.25, 2), steel, this.machine); shell.scale.set(1.1, .64, 1.4);
    for (let i = 0; i < 7; i++) this.mesh(new THREE.SphereGeometry(i ? .14 : .22, 12, 8), this.eye, this.machine)
      .position.set(i ? Math.cos(i) * .62 : 0, i ? Math.sin(i) * .32 : 0, -1.26);
    const segment = new THREE.CylinderGeometry(.12, .15, 1, 8); this.geometries.add(segment);
    this.arms = new THREE.InstancedMesh(segment, steel, 8 * 22); this.arms.name = 'gate-sentinel-tendrils'; this.arms.castShadow = true;
    this.arms.frustumCulled = false; this.group.add(this.arms);
    const fragment = new THREE.SphereGeometry(.045, 4, 3); this.geometries.add(fragment);
    this.fragments = new THREE.InstancedMesh(fragment, glow, 36); this.fragments.name = 'gate-impact-fragments';
    this.fragments.frustumCulled = false; this.group.add(this.fragments);
  }
  private mesh(geometry: THREE.BufferGeometry, material: THREE.Material, parent: THREE.Group): THREE.Mesh {
    this.geometries.add(geometry); const mesh = new THREE.Mesh(geometry, material); mesh.castShadow = mesh.receiveShadow = true; parent.add(mesh); return mesh;
  }
  update(journey?: FilmJourney): void {
    const gate = journey?.dockGate;
    this.group.visible = Boolean(journey?.scene === 'm3_gate' && !journey.visiting && gate?.toppled);
    if (!this.group.visible || !gate) return;
    const attacker = dockGateAttacker(gate), pose = dockGatePoint(gate, { x: 0, y: 2, z: .6 });
    this.machine.position.set(attacker.x, attacker.y, attacker.z); this.machine.rotation.set(.4 + attacker.down, -.5, attacker.down * 1.1);
    this.eye.emissiveIntensity = 3 * (1 - attacker.down);
    const up = new THREE.Vector3(0, 1, 0), body = this.machine.position;
    const contact = gate.phase === 'falling' ? THREE.MathUtils.smoothstep(gate.elapsed, .2, 1.2) : 1;
    for (let arm = 0; arm < 8; arm++) {
      const angle = arm / 8 * Math.PI * 2;
      const start = body.clone().add(new THREE.Vector3(Math.cos(angle), Math.sin(angle) * .4, .4));
      const wrapped = new THREE.Vector3(pose.x + Math.cos(angle) * 1.3, pose.y + Math.sin(angle) * .5, pose.z);
      const loose = start.clone().add(new THREE.Vector3(Math.cos(angle) * (4 - 3.6 * attacker.down), -3, Math.sin(angle) * 3)); loose.y = Math.max(.18, loose.y);
      const end = loose.clone().lerp(wrapped, contact * (1 - attacker.down));
      const middle = start.clone().lerp(end, .5).add(new THREE.Vector3(Math.cos(angle) * 1.5, 1.4, Math.sin(angle)));
      const curve = new THREE.QuadraticBezierCurve3(start, middle, end), length = curve.getLength();
      for (let part = 0; part < 22; part++) {
        const u = part / 21;
        this.scratch.position.copy(curve.getPoint(u)); this.scratch.quaternion.setFromUnitVectors(up, curve.getTangent(u));
        this.scratch.scale.set(1 - u * .55, length / 22, 1 - u * .55); this.scratch.updateMatrix();
        this.arms.setMatrixAt(arm * 22 + part, this.scratch.matrix);
      }
    }
    this.arms.instanceMatrix.needsUpdate = true;
    const impact = gate.phase === 'falling' ? gate.elapsed - 2.65 : gate.phase === 'rescue' ? gate.elapsed - 1.55 : -1;
    this.fragments.visible = impact >= 0 && impact < .7;
    if (this.fragments.visible) for (let i = 0; i < 36; i++) {
      const angle = i * 2.4, origin = gate.phase === 'falling' ? new THREE.Vector3(pose.x - 2, .25, pose.z) : body;
      this.scratch.position.copy(origin).add(new THREE.Vector3(Math.cos(angle) * impact * 7, impact * (2 + i % 5) - impact * impact * 6, Math.sin(angle) * impact * 7));
      this.scratch.position.y = Math.max(.06, this.scratch.position.y); this.scratch.rotation.set(i, i * .4, impact * 7);
      this.scratch.scale.set(.6, 1 + impact * 9, .6); this.scratch.updateMatrix(); this.fragments.setMatrixAt(i, this.scratch.matrix);
    }
    this.fragments.instanceMatrix.needsUpdate = true;
  }
  dispose(): void { this.group.removeFromParent(); this.group.clear(); this.geometries.forEach(g => g.dispose()); this.materials.forEach(m => m.dispose()); }
}
