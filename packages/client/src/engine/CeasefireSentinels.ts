import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { ceasefireSentinelPose, newTrilogyEpilogue, type TrilogyEpilogueEncounter } from '@auto_matrix/shared';

/** Shared mechanical surfaces, with independently posed trailing arms for all eighteen machines. */
export class CeasefireSentinels {
  private group = new THREE.Group();
  private anchors: THREE.Group[] = [];
  private meshes: THREE.InstancedMesh[] = [];
  private textures = new Set<THREE.Texture>();
  private disposed = false;

  constructor(parent: THREE.Group) {
    this.group.name = 'ceasefire-sentinel-swarm'; parent.add(this.group);
    const shell = new THREE.MeshStandardMaterial({ color: 0x3d484b, metalness: .78, roughness: .56 });
    const steel = new THREE.MeshStandardMaterial({ color: 0x8a9598, metalness: .87, roughness: .36 });
    const optics = new THREE.MeshBasicMaterial({ color: 0xff231b, toneMapped: false });
    const parts: THREE.BufferGeometry[][] = [[], [], [], []];
    const add = (slot: number, geometry: THREE.BufferGeometry, position: number[], scale = [1, 1, 1], rotation = [0, 0, 0]) => {
      const matrix = new THREE.Matrix4().compose(new THREE.Vector3().fromArray(position),
        new THREE.Quaternion().setFromEuler(new THREE.Euler(...rotation)), new THREE.Vector3().fromArray(scale));
      parts[slot].push(geometry.applyMatrix4(matrix));
    };
    add(0, new THREE.SphereGeometry(1, 16, 10), [0, 0, 0], [1.12, .58, 1.42]);
    add(0, new THREE.SphereGeometry(1, 12, 8), [0, -.38, -.1], [.88, .25, 1.12]);
    add(0, new THREE.SphereGeometry(1, 14, 8), [0, .02, 1.25], [.84, .5, .28]);
    for (let i = 0; i < 6; i++) add(1, new THREE.TorusGeometry(1, .035, 4, 20), [0, 0, -.95 + i * .35], [1.1, .55, 1]);
    for (const side of [-1, 1]) for (let i = 0; i < 3; i++) {
      add(1, new THREE.BoxGeometry(.34, .065, .58), [side * .64, .44, -.65 + i * .57], [1, 1, 1], [0, 0, -side * .42]);
    }
    for (const [x, y, radius] of [[0, 0, .19], [-.35, .22, .14], [.35, .22, .14], [-.37, -.2, .14], [.37, -.2, .14],
      [-.62, .05, .1], [.62, .05, .1], [-.19, .36, .1], [.19, .36, .1], [-.18, -.35, .1], [.18, -.35, .1]]) {
      add(1, new THREE.TorusGeometry(radius + .025, .025, 4, 10), [x, y, 1.48]);
      add(2, new THREE.SphereGeometry(radius, 8, 6), [x, y, 1.52], [1, 1, .4]);
    }
    const curve = new THREE.CatmullRomCurve3([[0, 0, 0], [.2, -.1, -1.1], [.5, -.15, -2.5], [.28, -.4, -3.8], [-.32, -.32, -5.2], [-.52, -.2, -6.1]]
      .map(point => new THREE.Vector3(...point)));
    parts[3].push(new THREE.TubeGeometry(curve, 16, .072, 5));
    for (let i = 0; i < 9; i++) {
      const at = i / 8, point = curve.getPoint(at), rotation = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), curve.getTangent(at));
      parts[3].push(new THREE.TorusGeometry(.095 - i * .003, .022, 3, 6)
        .applyMatrix4(new THREE.Matrix4().compose(point, rotation, new THREE.Vector3(1, 1, 1))));
    }
    const tip = curve.getPoint(1);
    for (let i = 0; i < 3; i++) {
      const angle = i * Math.PI * 2 / 3, claw = new THREE.CatmullRomCurve3([tip,
        tip.clone().add(new THREE.Vector3(Math.cos(angle) * .18, Math.sin(angle) * .18, -.22)),
        tip.clone().add(new THREE.Vector3(Math.cos(angle) * .1, Math.sin(angle) * .1, -.4))]);
      parts[3].push(new THREE.TubeGeometry(claw, 4, .028, 4));
    }
    for (const [index, surfaces] of parts.entries()) {
      const geometry = mergeGeometries(surfaces)!; surfaces.forEach(part => part.dispose());
      const material = [shell, steel, optics, steel][index];
      const mesh = new THREE.InstancedMesh(geometry, material, index === 3 ? 18 * 8 : 18);
      mesh.name = ['ceasefire-sentinel-hulls', 'ceasefire-sentinel-armor', 'ceasefire-sentinel-optics', 'ceasefire-sentinel-arms'][index];
      mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage); mesh.castShadow = mesh.receiveShadow = index !== 2;
      this.group.add(mesh); this.meshes.push(mesh);
    }
    if (typeof document !== 'undefined') for (const [suffix, slot] of [['color', 'map'], ['normal', 'normalMap'], ['roughness', 'roughnessMap']] as const) {
      const texture = new THREE.TextureLoader().load(`/assets/film-materials/metal_plate-${suffix}.jpg`, loaded => { if (this.disposed) loaded.dispose(); });
      texture.wrapS = texture.wrapT = THREE.RepeatWrapping; texture.anisotropy = 4;
      if (slot === 'map') texture.colorSpace = THREE.SRGBColorSpace;
      shell[slot] = steel[slot] = texture; this.textures.add(texture);
    }
    shell.normalScale.set(.24, .24); steel.normalScale.set(.24, .24);
    for (let i = 0; i < 18; i++) {
      const anchor = new THREE.Group(); anchor.name = `ceasefire-retreating-sentinel-${i + 1}`;
      this.group.add(anchor); this.anchors.push(anchor);
    }
    this.update(newTrilogyEpilogue('ceasefire'));
  }

  update(encounter: TrilogyEpilogueEncounter): void {
    const matrix = new THREE.Matrix4(), arm = new THREE.Object3D();
    this.group.visible = ceasefireSentinelPose(encounter, 0).visible;
    this.anchors.forEach((anchor, index) => {
      const pose = ceasefireSentinelPose(encounter, index);
      anchor.position.set(pose.x, pose.y, pose.z); anchor.rotation.set(pose.pitch, pose.yaw, pose.roll); anchor.updateMatrix();
      for (let surface = 0; surface < 3; surface++) this.meshes[surface].setMatrixAt(index, anchor.matrix);
      for (let i = 0; i < 8; i++) {
        const angle = i / 8 * Math.PI * 2;
        arm.position.set(Math.cos(angle) * .8, Math.sin(angle) * .38, -.65);
        arm.rotation.set(Math.sin(pose.clock * 1.4 + index * .7 + i) * .065,
          Math.sin(pose.clock * 1.1 + index + i * .9) * .055, angle);
        arm.scale.set(1, 1, .88 + i % 3 * .08); arm.updateMatrix();
        this.meshes[3].setMatrixAt(index * 8 + i, matrix.multiplyMatrices(anchor.matrix, arm.matrix));
      }
    });
    for (const mesh of this.meshes) { mesh.instanceMatrix.needsUpdate = true; mesh.computeBoundingBox(); mesh.computeBoundingSphere(); }
  }

  dispose(): void {
    if (this.disposed) return; this.disposed = true;
    this.group.removeFromParent(); this.group.clear();
    const materials = new Set(this.meshes.map(mesh => mesh.material as THREE.Material));
    for (const mesh of this.meshes) { mesh.dispose(); mesh.geometry.dispose(); }
    materials.forEach(material => material.dispose()); this.textures.forEach(texture => texture.dispose());
    this.meshes = []; this.anchors = []; this.textures.clear();
  }
}
