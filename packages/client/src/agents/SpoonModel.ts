import * as THREE from 'three';

/** Deform the metal continuously; the bowl follows the handle's final tangent. */
export class SpoonModel {
  readonly root = new THREE.Group();
  private material = new THREE.MeshStandardMaterial({ color: 0xd4dad9, metalness: 1, roughness: .17 });
  private handle: THREE.Mesh;
  private bowl: THREE.Mesh;
  private rest: Float32Array;
  private bend = -1;
  private direction = 1;
  constructor() {
    const handle = new THREE.CylinderGeometry(.032, .045, .65, 8, 40); handle.scale(1, 1, .24); handle.translate(0, .325, 0);
    this.handle = new THREE.Mesh(handle, this.material); this.root.add(this.handle); this.rest = Float32Array.from(handle.attributes.position.array);
    const profile = [new THREE.Vector2(0, .025), new THREE.Vector2(.35, .020), new THREE.Vector2(.7, 0), new THREE.Vector2(1, -.055), new THREE.Vector2(1.015, -.065), new THREE.Vector2(.7, -.015), new THREE.Vector2(.35, .005), new THREE.Vector2(0, .01)];
    const bowl = new THREE.LatheGeometry(profile, 32); bowl.rotateX(Math.PI / 2); bowl.scale(.135, .205, 1); bowl.translate(0, .17, 0);
    this.bowl = new THREE.Mesh(bowl, this.material); this.root.add(this.bowl);
    this.handle.castShadow = this.bowl.castShadow = true; this.setBend(0);
  }
  setBend(amount: number, reverse = false): void {
    const direction = reverse ? -1 : 1;
    if (Math.abs(amount - this.bend) < .0001 && direction === this.direction) return;
    this.bend = amount; this.direction = direction;
    const curvature = direction * Math.max(.00001, amount * 3.2); const vertices = this.handle.geometry.attributes.position;
    for (let i = 0; i < vertices.count; i++) {
      const x = this.rest[i * 3]; const y = this.rest[i * 3 + 1]; const z = this.rest[i * 3 + 2];
      const length = Math.max(0, y - .17); const angle = length * curvature;
      vertices.setXYZ(i, (1 - Math.cos(angle)) / curvature + x * Math.cos(angle), Math.min(.17, y) + Math.sin(angle) / curvature - x * Math.sin(angle), z);
    }
    vertices.needsUpdate = true; this.handle.geometry.computeVertexNormals();
    const angle = .48 * curvature;
    this.bowl.position.set((1 - Math.cos(angle)) / curvature, .17 + Math.sin(angle) / curvature, 0); this.bowl.rotation.z = -angle;
  }
  frameAt(height: number): { point: THREE.Vector3; rotation: THREE.Quaternion } {
    const curvature = this.direction * Math.max(.00001, this.bend * 3.2), length = Math.max(0, height - .17), angle = length * curvature;
    return { point: new THREE.Vector3((1 - Math.cos(angle)) / curvature, Math.min(.17, height) + Math.sin(angle) / curvature, 0),
      rotation: new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), -angle) };
  }
  dispose(): void { this.handle.geometry.dispose(); this.bowl.geometry.dispose(); this.material.dispose(); this.root.removeFromParent(); }
}
