import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { DOCK_EMP, FILM_SETS, dockEmpFlash, dockEmpSentinel, type FilmJourney, type Vector3 } from '@auto_matrix/shared';
import { ZionHomecomingRenderer } from './ZionHomecomingRenderer.js';

/** The exterior is the same dock used by Kid; the operator remains inside the Hammer. */
export class DockEmpRenderer {
  readonly group = new THREE.Group();
  private dock: ZionHomecomingRenderer;
  private swarm = new THREE.Group();
  private bodies: THREE.InstancedMesh;
  private faces: THREE.InstancedMesh;
  private eyes: THREE.InstancedMesh;
  private tails: THREE.InstancedMesh;
  private sparks: THREE.InstancedMesh;
  private wave: THREE.Mesh<THREE.SphereGeometry, THREE.MeshBasicMaterial>;
  private flash: THREE.PointLight;
  private materials: THREE.Material[];
  private floorOffsets: number[] = [];
  private scratch = new THREE.Object3D();
  private point = new THREE.Vector3();
  private previous = new THREE.Vector3();
  private direction = new THREE.Vector3();
  private up = new THREE.Vector3(0, 1, 0);
  private lastTime?: number;
  constructor(parent: THREE.Object3D) {
    this.group.name = 'hammer-emp-dock'; parent.add(this.group);
    const center = FILM_SETS.film_zion_hangar.center;
    this.group.position.set(center.x, center.y - 1, center.z);
    this.dock = new ZionHomecomingRenderer(this.group, 'film_zion_hangar');
    this.swarm.name = 'emp-sentinel-swarm'; this.group.add(this.swarm);
    const steel = new THREE.MeshStandardMaterial({ color: 0x687b83, roughness: .61, metalness: .72 });
    const dark = new THREE.MeshStandardMaterial({ color: 0x25353b, roughness: .55, metalness: .7 });
    const red = new THREE.MeshBasicMaterial({ color: 0xff3b24, toneMapped: false });
    const hot = new THREE.MeshBasicMaterial({ color: 0xffcc8e, toneMapped: false });
    const pulse = new THREE.MeshBasicMaterial({ color: 0xd6f2ff, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, toneMapped: false });
    this.materials = [steel, dark, red, hot, pulse];
    this.bodies = this.instances(new THREE.IcosahedronGeometry(1, 2).scale(1.35, .75, 1.65), steel, DOCK_EMP.count, 'emp-sentinel-shells');
    const housing: THREE.BufferGeometry[] = [new THREE.CylinderGeometry(1.02, 1.12, .48, 16).rotateX(Math.PI / 2).translate(0, -.08, -1.1)];
    for (const z of [-.75, -.2, .4, .9]) {
      const radius = Math.sqrt(1 - (z / 1.65) ** 2);
      housing.push(new THREE.TorusGeometry(1, .035, 6, 32).scale(1.36 * radius, .76 * radius, 1).translate(0, 0, z));
    }
    for (let i = 0; i < 7; i++) housing.push(new THREE.TorusGeometry(i ? .17 : .27, .065, 8, 16)
      .translate(i ? Math.cos(i) * .7 : 0, i ? Math.sin(i) * .38 : 0, -1.46));
    const plates = mergeGeometries(housing)!; housing.forEach(g => g.dispose());
    this.faces = this.instances(plates, dark, DOCK_EMP.count, 'emp-sentinel-faces');
    const lenses = Array.from({ length: 7 }, (_, i) => new THREE.SphereGeometry(i ? .13 : .23, 8, 6)
      .translate(i ? Math.cos(i) * .7 : 0, i ? Math.sin(i) * .38 : 0, -1.4));
    const optics = mergeGeometries(lenses)!; lenses.forEach(g => g.dispose());
    this.eyes = this.instances(optics, red, DOCK_EMP.count, 'emp-sentinel-eyes');
    this.tails = this.instances(new THREE.CylinderGeometry(.11, .14, 1, 6), steel, DOCK_EMP.count * 6 * 12, 'emp-sentinel-tails');
    this.sparks = this.instances(new THREE.BoxGeometry(.045, .045, .22), hot, DOCK_EMP.count * 6, 'emp-impact-sparks');
    for (let i = 0; i < DOCK_EMP.count; i++) {
      const pose = dockEmpSentinel(i, DOCK_EMP.seconds), rotation = new THREE.Quaternion().setFromEuler(new THREE.Euler(pose.pitch, pose.yaw, pose.roll));
      let lowest = 0;
      for (const mesh of [this.bodies, this.faces]) {
        const vertices = mesh.geometry.getAttribute('position');
        for (let v = 0; v < vertices.count; v++) lowest = Math.min(lowest, this.point.fromBufferAttribute(vertices, v).applyQuaternion(rotation).y);
      }
      this.floorOffsets.push(.06 - lowest);
    }
    this.wave = new THREE.Mesh(new THREE.SphereGeometry(1, 48, 24), pulse); this.wave.name = 'emp-wavefront';
    this.wave.position.copy(DOCK_EMP.source); this.group.add(this.wave);
    this.flash = new THREE.PointLight(0xe4f5ff, 0, 180, 2); this.flash.name = 'emp-dock-flash';
    this.flash.position.copy(DOCK_EMP.source); this.group.add(this.flash);
  }
  private instances(geometry: THREE.BufferGeometry, material: THREE.Material, count: number, name: string) {
    const mesh = new THREE.InstancedMesh(geometry, material, count); mesh.name = name; mesh.frustumCulled = false;
    mesh.castShadow = false; mesh.receiveShadow = true; this.swarm.add(mesh); return mesh;
  }
  update(journey?: FilmJourney, cameraPosition?: Vector3, camera?: THREE.Camera): void {
    this.group.visible = Boolean(journey?.emp && ['m3_emp', 'm3_dock_reunion'].includes(journey.scene) && !journey.visiting);
    if (!this.group.visible) return;
    const time = journey!.emp!.elapsed ?? DOCK_EMP.seconds;
    this.dock.update(journey, time, cameraPosition, camera);
    // The pulse kills the drill bay and service lighting as well as the main dock.
    // Blackout is lit by the environment; powered fixtures must not keep shading it.
    this.dock.group.traverseVisible(object => { if (object instanceof THREE.PointLight) object.visible = false; });
    if (time === this.lastTime) return;
    this.lastTime = time;
    this.wave.visible = time < 1.4; this.wave.scale.setScalar(Math.max(.01, time * DOCK_EMP.waveSpeed));
    this.wave.material.opacity = .2 * Math.max(0, 1 - time / 1.4);
    this.flash.intensity = dockEmpFlash(journey!.emp) * 90000;
    for (let i = 0; i < DOCK_EMP.count; i++) {
      const pose = dockEmpSentinel(i, time), floor = journey!.diggers && pose.x >= 12 ? 1 : 0;
      const height = Math.max(floor + this.floorOffsets[i], pose.y);
      this.scratch.position.set(pose.x, height, pose.z); this.scratch.rotation.set(pose.pitch, pose.yaw, pose.roll);
      this.scratch.scale.setScalar(1); this.scratch.updateMatrix();
      this.bodies.setMatrixAt(i, this.scratch.matrix); this.faces.setMatrixAt(i, this.scratch.matrix);
      const body = this.scratch.matrix.clone();
      this.scratch.scale.setScalar(pose.dead ? 0 : 1); this.scratch.updateMatrix(); this.eyes.setMatrixAt(i, this.scratch.matrix);
      const initial = dockEmpSentinel(i, 0), impactAt = pose.hitAt + Math.sqrt((initial.y - floor - this.floorOffsets[i]) / 4.9);
      const impactAge = time - impactAt;
      for (let chip = 0; chip < 6; chip++) {
        const angle = i * 2.39996 + chip * Math.PI / 3, active = impactAge >= 0 && impactAge < .55;
        const age = active ? impactAge : 0;
        this.scratch.position.set(pose.x + Math.cos(angle) * age * 7, floor + .14 + age * 3 - 4.9 * age * age, pose.z + Math.sin(angle) * age * 7);
        this.scratch.rotation.set(.35, angle, .2); this.scratch.scale.setScalar(active ? 1 - age / .55 : 0); this.scratch.updateMatrix();
        this.sparks.setMatrixAt(i * 6 + chip, this.scratch.matrix);
      }
      for (let arm = 0; arm < 6; arm++) for (let segment = 0; segment < 12; segment++) {
        const angle = arm * Math.PI / 3, u = segment / 11;
        this.point.set(Math.cos(angle) * (.85 + u * 1.3), Math.sin(angle) * (.35 + u * .6) - u, .65 + u * 4.6);
        this.point.x += Math.sin(u * 6 - Math.min(time, pose.hitAt) * 4 + arm) * u * .25;
        this.point.applyMatrix4(body);
        const settling = THREE.MathUtils.clamp((floor + 4 - height) / (4 - this.floorOffsets[i]), 0, 1);
        this.point.y = Math.max(floor + .15, THREE.MathUtils.lerp(this.point.y, floor + .15 + (height - floor - .15) * (1 - u) ** 4, settling));
        if (!segment) this.previous.copy(this.point);
        const delta = this.direction.copy(this.point).sub(this.previous), length = delta.length();
        this.scratch.position.copy(this.point).add(this.previous).multiplyScalar(.5);
        this.scratch.quaternion.setFromUnitVectors(this.up, length ? delta.multiplyScalar(1 / length) : this.up);
        this.scratch.scale.set(1 - u * .65, length + .015, 1 - u * .65); this.scratch.updateMatrix();
        this.tails.setMatrixAt(i * 72 + arm * 12 + segment, this.scratch.matrix); this.previous.copy(this.point);
      }
    }
    for (const mesh of [this.bodies, this.faces, this.eyes, this.tails, this.sparks]) mesh.instanceMatrix.needsUpdate = true;
  }
  dispose(): void {
    this.dock.dispose(); this.group.removeFromParent(); this.group.clear();
    for (const mesh of [this.bodies, this.faces, this.eyes, this.tails, this.sparks, this.wave]) mesh.geometry.dispose();
    this.materials.forEach(material => material.dispose()); this.flash.dispose();
  }
}
