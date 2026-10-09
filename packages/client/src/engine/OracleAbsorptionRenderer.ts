import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { newOracleAbsorption, oracleAbsorptionCookie, oracleAbsorptionPlate, type OracleAbsorption } from '@auto_matrix/shared';

export class OracleAbsorptionRenderer {
  readonly root = new THREE.Group();
  readonly plate = new THREE.Group();
  readonly cookie: THREE.Mesh;
  private shards = new THREE.Group();
  private crowd = new THREE.Group();
  private disposed = false;
  private state?: OracleAbsorption;
  private geometries = new Set<THREE.BufferGeometry>();
  private materials = new Set<THREE.Material>();
  private textures = new Set<THREE.Texture>();
  constructor(parent: THREE.Group) {
    this.root.name = 'oracle-absorption-props'; parent.add(this.root); this.root.add(this.plate, this.shards, this.crowd);
    this.crowd.name = 'oracle-smith-doorway';
    const ceramic = new THREE.MeshStandardMaterial({ color: 0xd9d0af, roughness: .65 });
    const dough = new THREE.MeshStandardMaterial({ color: 0xb9965c, roughness: .94 }); this.materials.add(ceramic); this.materials.add(dough);
    this.mesh(new THREE.CylinderGeometry(.64, .52, .07, 40), ceramic, this.plate);
    for (let i = 0; i < 7; i++) { const biscuit = this.mesh(new THREE.CylinderGeometry(.15, .16, .07, 16), dough, this.plate); biscuit.position.set(Math.cos(i * 2.4) * .34, .09 + i % 2 * .025, Math.sin(i * 2.4) * .34); }
    this.cookie = this.mesh(new THREE.CylinderGeometry(.13, .14, .06, 16), dough, this.root); this.cookie.name = 'sati-farewell-cookie';
    for (let i = 0; i < 14; i++) {
      const geometry = new THREE.BufferGeometry(); geometry.setAttribute('position', new THREE.Float32BufferAttribute([0,0,0, .14 + i % 3 * .04,0,.015, .06,.012,.12],3)); geometry.computeVertexNormals();
      const shard = this.mesh(geometry, i < 8 ? ceramic : dough, this.shards); shard.position.set(-7.25 - i % 4 * .34, .075 + i % 2 * .006, -19.2 + Math.floor(i / 4) * .24); shard.rotation.y = i * 2.4;
    }
    this.update(undefined);
    void this.loadCrowd().catch(error => { if (!this.disposed) console.warn('Unable to load the Oracle doorway copies', error); });
  }
  private async loadCrowd(): Promise<void> {
    const asset = await new GLTFLoader().loadAsync('/assets/characters/smith-crowd.glb');
    const copies = [[0, -10.4], [-1.2, -13.1], [1.2, -12.6], [-.3, -15.8], [1.4, -16.1]];
    const dummy = new THREE.Object3D();
    asset.scene.traverse(object => {
      if (!(object instanceof THREE.Mesh)) return;
      this.geometries.add(object.geometry);
      for (const material of Array.isArray(object.material) ? object.material : [object.material]) {
        this.materials.add(material);
        for (const value of Object.values(material)) if (value instanceof THREE.Texture) this.textures.add(value);
      }
      if (this.disposed) return;
      const mesh = new THREE.InstancedMesh(object.geometry, object.material, copies.length); mesh.name = `oracle-doorway-${object.name}`;
      for (const [i, [x, z]] of copies.entries()) {
        dummy.position.set(x, 0, z); dummy.rotation.y = Math.atan2(-6 - x, -22.9 - z); dummy.updateMatrix(); mesh.setMatrixAt(i, dummy.matrix);
      }
      mesh.instanceMatrix.needsUpdate = true; mesh.castShadow = mesh.receiveShadow = true; mesh.computeBoundingBox(); mesh.computeBoundingSphere(); this.crowd.add(mesh);
    });
    if (this.disposed) this.release(); else this.update(this.state);
  }
  private mesh(geometry: THREE.BufferGeometry, material: THREE.Material, parent: THREE.Group) { this.geometries.add(geometry); const mesh = new THREE.Mesh(geometry, material); mesh.castShadow = mesh.receiveShadow = true; parent.add(mesh); return mesh; }
  update(state?: OracleAbsorption): void {
    this.state = state; state ??= newOracleAbsorption(0, 1); const plate = oracleAbsorptionPlate(state), cookie = oracleAbsorptionCookie(state);
    this.crowd.visible = state.invasion >= 14;
    this.plate.position.set(plate.x, plate.y, plate.z); this.plate.rotation.set(plate.spin, 0, plate.spin * .3);
    this.plate.visible = !plate.broken; this.shards.visible = plate.broken;
    this.cookie.position.set(cookie.x, cookie.y, cookie.z); this.cookie.visible = state.farewell > 1 && state.escape < 24;
  }
  private release(): void { this.geometries.forEach(geometry => geometry.dispose()); this.materials.forEach(material => material.dispose()); this.textures.forEach(texture => texture.dispose()); }
  dispose(): void { this.disposed = true; this.root.removeFromParent(); this.crowd.traverse(object => { if (object instanceof THREE.InstancedMesh) object.dispose(); }); this.release(); }
}
