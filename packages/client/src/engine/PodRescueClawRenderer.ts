import * as THREE from 'three';
import { podRescuePose } from '@auto_matrix/shared';
import { batchStaticGeometry } from './StaticGeometry.js';

/** The ship's articulated retrieval harness uses the saved rescue clock and actual chest contacts. */
export class PodRescueClawRenderer {
  private geometries = new Set<THREE.BufferGeometry>();
  private materials = new Set<THREE.Material>();
  private textures = new Map<string, THREE.Texture>();
  private housing: THREE.Mesh;
  private casing = new THREE.Group();
  private cable: THREE.Mesh;
  private ribs: THREE.InstancedMesh;
  private links: THREE.InstancedMesh[] = [];
  private jointBodies: THREE.InstancedMesh;
  private jointPins: THREE.InstancedMesh;
  private connectors: THREE.InstancedMesh;
  private dummy = new THREE.Object3D();
  private arms: { pad: THREE.Mesh; offset: THREE.Vector3; angle: number }[] = [];
  private disposed = false;

  constructor(private root: THREE.Group) {
    root.name = 'pod-rescue-claw';
    const steel = this.metal(0x738482, .5), dark = this.metal(0x263239, .62);
    const rubber = new THREE.MeshStandardMaterial({ color: 0x131b20, roughness: .68, metalness: .12 }); this.materials.add(rubber);
    const chrome = new THREE.MeshStandardMaterial({ color: 0x92a2a8, roughness: .28, metalness: .85 }); this.materials.add(chrome);
    this.housing = this.mesh(new THREE.CylinderGeometry(.3, .5, 1.4, 12), dark, root);
    this.housing.name = 'pod-rescue-housing'; this.housing.position.set(0, -.32, .32);
    root.add(this.casing);
    for (const y of [-.88, .26]) {
      const ring = this.mesh(new THREE.TorusGeometry(y < 0 ? .49 : .33, .045, 6, 24), steel, this.casing);
      ring.rotation.x = Math.PI / 2; ring.position.set(0, y, .32);
    }
    for (const side of [-1, 1]) {
      const spine = this.mesh(new THREE.BoxGeometry(.11, 1.12, .24), steel, this.casing);
      spine.position.set(side * .31, -.31, .47); spine.rotation.z = side * -.12;
      const piston = this.mesh(new THREE.CylinderGeometry(.045, .045, .85, 10), chrome, this.casing);
      piston.position.set(side * .36, -.29, .08);
    }
    for (let i = 0; i < 6; i++) {
      const angle = i / 6 * Math.PI * 2, fitting = this.mesh(new THREE.CylinderGeometry(.043, .043, .09, 8), steel, this.casing);
      fitting.position.set(Math.sin(angle) * .47, -.87, .32 + Math.cos(angle) * .47);
    }
    const beam = new THREE.CylinderGeometry(.17, .2, 1, 6); beam.rotateY(Math.PI / 6);
    const inset = new THREE.BoxGeometry(.13, .72, .035); inset.translate(0, 0, .18);
    const shaft = new THREE.CylinderGeometry(.032, .032, .8, 8); shaft.translate(.13, 0, .16);
    const hose = new THREE.CatmullRomCurve3([new THREE.Vector3(-.12, -.43, .17), new THREE.Vector3(-.22, 0, .21), new THREE.Vector3(-.12, .43, .17)]);
    this.links = [this.instances(beam, steel, 9, 'pod-rescue-arm-armor'), this.instances(inset, dark, 9, 'pod-rescue-arm-insets'),
      this.instances(shaft, chrome, 9, 'pod-rescue-arm-pistons'), this.instances(new THREE.TubeGeometry(hose, 12, .028, 5, false), rubber, 9, 'pod-rescue-arm-hoses')];
    const bearing = new THREE.CylinderGeometry(.22, .22, .32, 12); bearing.rotateX(Math.PI / 2);
    this.jointBodies = this.instances(bearing, dark, 6, 'pod-rescue-joint-bodies');
    const pins = new THREE.Group();
    for (const z of [-.18, .18]) {
      const pin = this.mesh(new THREE.CylinderGeometry(.14, .14, .05, 12), steel, pins); pin.rotation.x = Math.PI / 2; pin.position.z = z;
    }
    this.jointPins = this.instances(batchStaticGeometry(pins, new Set())[0], steel, 6, 'pod-rescue-joint-pins');
    this.connectors = this.instances(new THREE.CylinderGeometry(.045, .045, 1, 8), chrome, 3, 'pod-rescue-contact-links');
    for (const [side, x, z, angle] of [['L', .367, 0, -Math.PI / 2], ['R', -.367, 0, Math.PI / 2], ['back', 0, -.107, 0]] as const) {
      const pad = this.mesh(new THREE.BoxGeometry(.28, .34, .12), rubber, root); pad.name = `pod-rescue-pad-${side}`;
      this.arms.push({ pad, offset: new THREE.Vector3(x, -.15, z), angle });
    }
    this.cable = this.mesh(new THREE.CylinderGeometry(.09, .09, 1, 12), rubber, root); this.cable.name = 'pod-rescue-cable';
    const rib = new THREE.TorusGeometry(.105, .025, 5, 12); rib.rotateX(Math.PI / 2); this.geometries.add(rib);
    this.ribs = new THREE.InstancedMesh(rib, dark, 80); this.ribs.name = 'pod-rescue-cable-ribs';
    this.ribs.instanceMatrix.setUsage(THREE.DynamicDrawUsage); this.ribs.frustumCulled = false; root.add(this.ribs);
    batchStaticGeometry(this.casing, new Set()).forEach(g => this.geometries.add(g));
  }

  private metal(color: number, roughness: number): THREE.MeshStandardMaterial {
    const material = new THREE.MeshStandardMaterial({ color, roughness, metalness: .72 }); this.materials.add(material);
    if (typeof document === 'undefined') return material;
    for (const [suffix, slot] of [['color', 'map'], ['normal', 'normalMap'], ['roughness', 'roughnessMap']] as const) {
      let texture = this.textures.get(slot);
      if (!texture) {
        texture = new THREE.TextureLoader().load(`/assets/film-materials/metal_plate-${suffix}.jpg`, loaded => { if (this.disposed) loaded.dispose(); });
        texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
        if (slot === 'map') texture.colorSpace = THREE.SRGBColorSpace;
        this.textures.set(slot, texture);
      }
      material[slot] = texture;
    }
    material.normalScale.set(.15, .15); return material;
  }
  private mesh(geometry: THREE.BufferGeometry, material: THREE.Material, parent: THREE.Object3D): THREE.Mesh {
    this.geometries.add(geometry); const mesh = new THREE.Mesh(geometry, material);
    mesh.castShadow = mesh.receiveShadow = true; parent.add(mesh); return mesh;
  }
  private link(object: THREE.Object3D, from: THREE.Vector3, to: THREE.Vector3): void {
    object.position.copy(from).add(to).multiplyScalar(.5); object.scale.y = from.distanceTo(to);
    object.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), to.clone().sub(from).normalize());
  }
  private instances(geometry: THREE.BufferGeometry, material: THREE.Material, count: number, name: string): THREE.InstancedMesh {
    this.geometries.add(geometry); const mesh = new THREE.InstancedMesh(geometry, material, count); mesh.name = name;
    mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage); mesh.frustumCulled = false; mesh.castShadow = mesh.receiveShadow = true;
    this.root.add(mesh); return mesh;
  }
  update(elapsed: number, firstPerson: boolean, center: THREE.Vector3, winch: THREE.Vector3, chest?: THREE.Object3D): void {
    if (!this.root.visible) return;
    const rescue = podRescuePose(elapsed), parent = this.root.parent!;
    this.root.position.copy(center).add(new THREE.Vector3(0, 2.6 + 5 * (1 - rescue.descend) + rescue.release * 2.2 + rescue.settle * 1.1, 0));
    this.root.position.y = Math.min(this.root.position.y, winch.y - .85);
    this.housing.visible = this.casing.visible = !firstPerson;
    for (const [index, arm] of this.arms.entries()) {
      const radial = new THREE.Vector3(Math.sin(arm.angle), 0, Math.cos(arm.angle));
      const contact = chest ? parent.worldToLocal(chest.localToWorld(arm.offset.clone())).sub(this.root.position)
        : arm.offset.clone().applyAxisAngle(new THREE.Vector3(0, 1, 0), Math.PI).add(center).sub(this.root.position);
      const tip = radial.clone().multiplyScalar(1.4).setY(-2.6).lerp(contact, rescue.grip * (1 - rescue.release));
      const outside = tip.clone().addScaledVector(radial, .2);
      const nodes = [radial.clone().multiplyScalar(.5), radial.clone().multiplyScalar(1.3).setY(-.95), radial.clone().multiplyScalar(1.3).setY(-2.45), outside];
      for (let i = 0; i < 3; i++) {
        this.link(this.dummy, nodes[i], nodes[i + 1]); this.dummy.updateMatrix();
        this.links.forEach(mesh => mesh.setMatrixAt(index * 3 + i, this.dummy.matrix));
      }
      for (let i = 0; i < 2; i++) {
        this.dummy.position.copy(nodes[i + 1]); this.dummy.scale.setScalar(1); this.dummy.rotation.set(0, arm.angle, 0); this.dummy.updateMatrix();
        this.jointBodies.setMatrixAt(index * 2 + i, this.dummy.matrix); this.jointPins.setMatrixAt(index * 2 + i, this.dummy.matrix);
      }
      this.link(this.dummy, outside, tip); this.dummy.updateMatrix(); this.connectors.setMatrixAt(index, this.dummy.matrix);
      arm.pad.position.copy(tip); arm.pad.rotation.y = arm.angle;
    }
    for (const mesh of [...this.links, this.jointBodies, this.jointPins, this.connectors]) mesh.instanceMatrix.needsUpdate = true;
    const top = winch.clone().sub(this.root.position), bottom = new THREE.Vector3(0, .4, .32);
    this.link(this.cable, bottom, top);
    for (let i = 0; i < this.ribs.count; i++) {
      this.dummy.position.copy(bottom).lerp(top, (i + .5) / this.ribs.count); this.dummy.quaternion.copy(this.cable.quaternion); this.dummy.scale.setScalar(1);
      this.dummy.updateMatrix(); this.ribs.setMatrixAt(i, this.dummy.matrix);
    }
    this.ribs.instanceMatrix.needsUpdate = true;
  }
  dispose(): void {
    if (this.disposed) return;
    this.disposed = true; this.root.removeFromParent();
    for (const mesh of [...this.links, this.jointBodies, this.jointPins, this.connectors, this.ribs]) mesh.dispose();
    this.geometries.forEach(g => g.dispose()); this.materials.forEach(m => m.dispose()); this.textures.forEach(t => t.dispose());
  }
}
