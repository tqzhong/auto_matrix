import * as THREE from 'three';
import { DOCK_GUNNERY, dockGunneryTarget, type FilmJourney } from '@auto_matrix/shared';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

/** Shared instanced parts keep the incoming machines and articulated tails inexpensive. */
export class DockGunneryRenderer {
  readonly group = new THREE.Group();
  private bodies: THREE.InstancedMesh;
  private faces: THREE.InstancedMesh;
  private eyes: THREE.InstancedMesh;
  private arms: THREE.InstancedMesh;
  private sparks: THREE.InstancedMesh;
  private tracer: THREE.Mesh;
  private markers: THREE.Group[] = [];
  private geometries = new Set<THREE.BufferGeometry>();
  private materials: THREE.Material[];
  private scratch = new THREE.Object3D();
  private point = new THREE.Vector3();
  private previous = new THREE.Vector3();
  private settled = new THREE.Vector3();
  private direction = new THREE.Vector3();
  private up = new THREE.Vector3(0, 1, 0);
  constructor(parent: THREE.Group) {
    this.group.name = 'zion-apu-gunnery'; parent.add(this.group);
    const steel = new THREE.MeshStandardMaterial({ color: 0x63706b, metalness: .8, roughness: .4 });
    const dark = new THREE.MeshStandardMaterial({ color: 0x222e2c, metalness: .65, roughness: .55 });
    const red = new THREE.MeshBasicMaterial({ color: 0xff381d, toneMapped: false });
    const glow = new THREE.MeshBasicMaterial({ color: 0xffd59b, toneMapped: false });
    this.materials = [steel, dark, red, glow];
    const count = DOCK_GUNNERY.targets.length;
    this.bodies = this.instances(new THREE.IcosahedronGeometry(1, 2).scale(1.35, .75, 1.65), steel, count, 'apu-sentinel-shells');
    this.faces = this.instances(new THREE.CylinderGeometry(1.02, 1.12, .48, 16).rotateX(Math.PI / 2).translate(0, -.08, -1.1), dark, count, 'apu-sentinel-optics-housings');
    const lenses = Array.from({ length: 7 }, (_, i) => new THREE.SphereGeometry(i ? .13 : .23, 8, 6)
      .translate(i ? Math.cos(i) * .7 : 0, i ? Math.sin(i) * .38 : 0, -1.4));
    const optics = mergeGeometries(lenses)!; lenses.forEach(g => g.dispose());
    this.eyes = this.instances(optics, red, count, 'apu-sentinel-optics');
    this.arms = this.instances(new THREE.CylinderGeometry(.12, .15, 1, 6), steel, count * 8 * 16, 'apu-sentinel-articulated-tails');
    this.sparks = this.instances(new THREE.SphereGeometry(.035, 4, 3), glow, 32, 'apu-sentinel-impact');
    this.tracer = new THREE.Mesh(new THREE.CylinderGeometry(.027, .027, 1, 6), glow);
    this.tracer.name = 'apu-gunnery-tracer'; this.geometries.add(this.tracer.geometry); this.group.add(this.tracer);
    for (let i = 0; i < count; i++) {
      const marker = new THREE.Group(); marker.name = `zion-dock-sentinel-${i + 1}`; this.markers.push(marker); this.group.add(marker);
    }
  }
  private instances(geometry: THREE.BufferGeometry, material: THREE.Material, count: number, name: string) {
    this.geometries.add(geometry);
    const mesh = new THREE.InstancedMesh(geometry, material, count); mesh.name = name; mesh.frustumCulled = false;
    mesh.castShadow = mesh.receiveShadow = material instanceof THREE.MeshStandardMaterial;
    this.group.add(mesh); return mesh;
  }
  update(journey?: FilmJourney, muzzle?: THREE.Vector3): void {
    const state = journey?.dockGunnery;
    this.group.visible = Boolean(state && journey?.scene === 'm3_dock_battle' && !journey.visiting);
    if (!this.group.visible || !state) return;
    for (let i = 0; i < this.markers.length; i++) {
      const target = state.targets[i], marker = this.markers[i];
      marker.visible = Boolean(target && target.spawnAt <= state.elapsed && !target.escaped && (target.health > 0 || target.downFrom));
      const point = target ? dockGunneryTarget(state, i) : { x: 0, y: 0, z: 0 };
      const fall = target?.downAt === undefined ? 0 : Math.min(1, Math.max(0, state.elapsed - target.downAt));
      marker.position.copy(point); marker.rotation.set(fall * 1.2, Math.PI + Math.atan2(-point.x, 12 - point.z), fall * .4);
      const grounded = target?.downFrom ? THREE.MathUtils.clamp((3.7 - point.y) / 2, 0, 1) : 0;
      const s = Math.sin(marker.rotation.y), c = Math.cos(marker.rotation.y);
      marker.updateMatrix();
      this.scratch.position.copy(point); this.scratch.quaternion.copy(marker.quaternion); this.scratch.scale.setScalar(marker.visible ? 1 : 0); this.scratch.updateMatrix();
      for (const mesh of [this.bodies, this.faces, this.eyes]) mesh.setMatrixAt(i, this.scratch.matrix);
      // Dead optics go dark; the body and tails remain as grounded wreckage.
      if (fall) { this.scratch.scale.setScalar(0); this.scratch.updateMatrix(); this.eyes.setMatrixAt(i, this.scratch.matrix); }
      for (let arm = 0; arm < 8; arm++) for (let segment = 0; segment < 16; segment++) {
        const angle = arm * Math.PI / 4, u = segment / 15;
        this.point.set(Math.cos(angle) * (.85 + u * 1.8) + Math.sin(u * 6 - state.elapsed * 3 + arm) * u * .45 * (1 - fall),
          Math.sin(angle) * (.35 + u) - u * 1.5, .65 + u * (5.8 + arm % 3));
        this.point.applyMatrix4(marker.matrix);
        if (grounded) {
          const x = Math.cos(angle) * (.85 + u * 1.8) + Math.sin(u * 6 + arm) * u * .45, z = .65 + u * (5.8 + arm % 3);
          this.settled.set(point.x + x * c + z * s, .16 + (point.y - .16) * (1 - u) ** 4, point.z - x * s + z * c);
          this.point.lerp(this.settled, grounded);
        }
        this.point.y = Math.max(.16, this.point.y);
        if (!segment) this.previous.copy(this.point);
        const direction = this.direction.copy(this.point).sub(this.previous), length = direction.length();
        this.scratch.position.copy(this.point).add(this.previous).multiplyScalar(.5);
        this.scratch.quaternion.setFromUnitVectors(this.up, length ? direction.multiplyScalar(1 / length) : this.up);
        this.scratch.scale.set(marker.visible ? 1 - u * .65 : 0, length + .045, marker.visible ? 1 - u * .65 : 0);
        this.scratch.updateMatrix(); this.arms.setMatrixAt(i * 128 + arm * 16 + segment, this.scratch.matrix); this.previous.copy(this.point);
      }
    }
    for (const mesh of [this.bodies, this.faces, this.eyes, this.arms]) mesh.instanceMatrix.needsUpdate = true;
    const shot = state.lastShot, age = shot ? state.elapsed - shot.at : 10;
    this.tracer.visible = Boolean(shot && muzzle && age >= 0 && age < .16);
    if (this.tracer.visible) {
      const to = new THREE.Vector3().copy(shot!), delta = to.clone().sub(muzzle!);
      this.tracer.position.copy(muzzle!).add(to).multiplyScalar(.5); this.tracer.scale.y = delta.length();
      this.tracer.quaternion.setFromUnitVectors(this.up, delta.normalize());
    }
    this.sparks.visible = Boolean(shot?.target !== undefined && age >= 0 && age < .55);
    if (this.sparks.visible) for (let i = 0; i < 32; i++) {
      const a = i * 2.4, t = age + .015;
      this.scratch.position.set(shot!.x + Math.cos(a) * t * 5, shot!.y + (i % 5 - 1) * t - 4.9 * t * t, shot!.z + Math.sin(a) * t * 5);
      this.scratch.quaternion.identity(); this.scratch.scale.set(.7, 1 + age * 6, .7); this.scratch.updateMatrix(); this.sparks.setMatrixAt(i, this.scratch.matrix);
    }
    this.sparks.instanceMatrix.needsUpdate = true;
  }
  dispose(): void { this.group.removeFromParent(); this.group.clear(); this.geometries.forEach(g => g.dispose()); this.materials.forEach(m => m.dispose()); }
}
