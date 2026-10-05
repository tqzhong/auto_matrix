import * as THREE from 'three';
import { type FilmJourney } from '@auto_matrix/shared';

/** A near sentinel with articulated metal segments, driven entirely by the saved attack clock. */
export class DockLastStandRenderer {
  readonly group = new THREE.Group();
  private machine = new THREE.Group();
  private arms: THREE.InstancedMesh;
  private sparks: THREE.InstancedMesh;
  private geometry = new Set<THREE.BufferGeometry>();
  private materials: THREE.Material[] = [];
  private light = new THREE.PointLight(0xffb77a, 0, 13, 2);
  private scratch = new THREE.Object3D();
  constructor(parent: THREE.Group) {
    this.group.name = 'mifune-last-stand'; parent.add(this.group); this.group.add(this.machine, this.light);
    const steel = this.material(0x5a655f, .72, .42), dark = this.material(0x242d2c, .7, .7), eye = this.material(0xa42a13, .25, .28);
    eye.emissive.set(0xff250c); eye.emissiveIntensity = 2.8;
    this.machine.name = 'mifune-attacking-sentinel';
    const shell = this.mesh(new THREE.IcosahedronGeometry(1.35, 2), steel, this.machine); shell.scale.set(1.1, .65, 1.35);
    const visor = this.mesh(new THREE.CylinderGeometry(.96, 1.05, .5, 24), dark, this.machine); visor.rotation.x = Math.PI / 2; visor.position.z = -.95;
    for (let i = 0; i < 7; i++) {
      const optic = this.mesh(new THREE.SphereGeometry(i ? .15 : .23, 12, 8), eye, this.machine);
      optic.position.set(i ? Math.cos(i) * .6 : 0, i ? Math.sin(i) * .35 : 0, -1.28);
    }
    const joint = new THREE.CylinderGeometry(.12, .15, .27, 8); this.geometry.add(joint);
    this.arms = new THREE.InstancedMesh(joint, steel, 8 * 24); this.arms.name = 'mifune-sentinel-segments'; this.arms.castShadow = true; this.arms.frustumCulled = false; this.group.add(this.arms);
    const glow = new THREE.MeshBasicMaterial({ color: 0xffc67c, toneMapped: false }); this.materials.push(glow);
    const spark = new THREE.SphereGeometry(.035, 4, 3); this.geometry.add(spark);
    this.sparks = new THREE.InstancedMesh(spark, glow, 28); this.sparks.name = 'mifune-cockpit-sparks'; this.sparks.frustumCulled = false; this.group.add(this.sparks);
  }
  private material(color: number, metalness: number, roughness: number): THREE.MeshStandardMaterial {
    const material = new THREE.MeshStandardMaterial({ color, metalness, roughness }); this.materials.push(material); return material;
  }
  private mesh(geometry: THREE.BufferGeometry, material: THREE.Material, parent: THREE.Group): THREE.Mesh {
    this.geometry.add(geometry); const mesh = new THREE.Mesh(geometry, material); mesh.castShadow = true; mesh.receiveShadow = true; parent.add(mesh); return mesh;
  }
  update(journey?: FilmJourney): void {
    const encounter = journey?.dockLastStand;
    this.group.visible = Boolean(encounter?.phase === 'attack' && journey?.scene === 'm3_dock_battle' && !journey.visiting);
    if (!this.group.visible || !encounter) { this.light.intensity = 0; return; }
    const t = encounter.elapsed, approach = THREE.MathUtils.smoothstep(t, 0, 1.3), retreat = THREE.MathUtils.smoothstep(t, 2.8, 5.2);
    this.machine.position.set(3.2 + 5 * (1 - approach) + retreat * 9, 15.5 - approach * 5.5 + retreat * 13, 8 + approach * 3.1);
    this.machine.rotation.set(.55, Math.PI * .1, -.1);
    const body = this.machine.position, up = new THREE.Vector3(0, 1, 0);
    for (let arm = 0; arm < 8; arm++) {
      const angle = arm / 8 * Math.PI * 2, origin = body.clone().add(new THREE.Vector3(Math.cos(angle), Math.sin(angle) * .4, .5));
      const strike = THREE.MathUtils.smoothstep(t, .85 + arm * .045, 1.45 + arm * .045) * (1 - retreat);
      const target = new THREE.Vector3(Math.cos(angle) * (arm < 4 ? .62 : 2.4), arm < 4 ? 5.3 : 6.7, 11.5 + Math.sin(angle) * .65);
      target.lerp(origin.clone().add(new THREE.Vector3(Math.cos(angle) * 4, -3, -3)), 1 - strike);
      const middle = origin.clone().lerp(target, .45).add(new THREE.Vector3(Math.cos(angle) * 1.5, .7, -1.5));
      const curve = new THREE.QuadraticBezierCurve3(origin, middle, target);
      const length = curve.getLength();
      for (let segment = 0; segment < 24; segment++) {
        const u = segment / 23, point = curve.getPoint(u), tangent = curve.getTangent(u);
        this.scratch.position.copy(point); this.scratch.quaternion.setFromUnitVectors(up, tangent);
        this.scratch.scale.setScalar(1 - u * .52); this.scratch.scale.y = length / 24 / .27;
        this.scratch.updateMatrix(); this.arms.setMatrixAt(arm * 24 + segment, this.scratch.matrix);
      }
    }
    this.arms.instanceMatrix.needsUpdate = true;
    const impact = t >= 1.4 && t <= 2.8;
    this.sparks.visible = impact; this.light.position.set(0, 5.7, 11.2); this.light.intensity = impact ? 90 * (.55 + Math.sin(t * 41) * .35) : 0;
    if (impact) for (let i = 0; i < 28; i++) {
      const age = (t - 1.4 + i * .031) % .7, angle = i * 2.4;
      this.scratch.position.set(Math.cos(angle) * age * 6, 5.6 + age * (i % 4) - age * age * 12, 11.2 + Math.sin(angle) * age * 4);
      this.scratch.quaternion.identity(); this.scratch.scale.set(.7, 2 + age * 7, .7); this.scratch.updateMatrix(); this.sparks.setMatrixAt(i, this.scratch.matrix);
    }
    this.sparks.instanceMatrix.needsUpdate = true;
  }
  dispose(): void { this.group.removeFromParent(); this.group.clear(); this.geometry.forEach(g => g.dispose()); this.materials.forEach(m => m.dispose()); this.light.dispose(); }
}
