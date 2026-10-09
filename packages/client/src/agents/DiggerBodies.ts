import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import type { CharacterRig } from './CharacterModel.js';
import { enableSkinnedCulling } from './SkinnedBounds.js';

interface BodyEntry {
  role: 'zee' | 'charra' | 'niobe' | 'lock' | 'roland' | 'architect' | 'seraph' | 'keymaker' | 'rama_kandra' | 'kamala' | 'trainman' | 'hamann' | 'west' | 'dillard';
  fallback: THREE.Mesh[];
  materials: THREE.Material[];
  model?: THREE.Group;
  loading: boolean;
  active: boolean;
  park: boolean;
  briefing: boolean;
  dryColor?: THREE.Color;
}

/** Continuous anatomy follows the same joints as the dock contact performances. */
export class DiggerBodies {
  private entries = new Map<CharacterRig, BodyEntry>();
  private geometries = new Set<THREE.BufferGeometry>();
  private materials = new Set<THREE.Material>();
  private skeletons = new Set<THREE.Skeleton>();
  private disposed = false;

  track(rig: CharacterRig, role: BodyEntry['role'], skin: THREE.Material, cloth: THREE.Material, trousers: THREE.Material): void {
    const headObjects = new Set<THREE.Object3D>(); rig.head.traverse(object => headObjects.add(object));
    const fallback: THREE.Mesh[] = [];
    rig.detail.traverse(object => { if (object instanceof THREE.Mesh && !headObjects.has(object) && object.name !== 'kamala-skirt') fallback.push(object); });
    this.entries.set(rig, { role, fallback, materials: [skin, cloth, trousers], loading: false, active: true, park: false, briefing: false,
      dryColor: role === 'seraph' ? (cloth as THREE.MeshStandardMaterial).color.clone() : undefined });
  }

  update(rig: CharacterRig, active = true, park = false, briefing = false): void {
    const entry = this.entries.get(rig); if (!entry) return;
    entry.active = active;
    entry.park = park;
    entry.briefing = briefing;
    if (!active) { if (entry.model) entry.model.visible = false; return; }
    if (!entry.loading) {
      entry.loading = true;
      this.load(rig, entry).catch(error => console.warn(`${entry.role} detailed body could not load; retaining its fallback.`, error));
    }
    if (entry.model) {
      entry.model.visible = true;
      entry.fallback.forEach(mesh => { mesh.visible = false; });
      if (entry.role === 'seraph') {
        const cloth = entry.materials[1] as THREE.MeshStandardMaterial;
        if (park) cloth.color.set('#969d9f'); else cloth.color.copy(entry.dryColor!);
        entry.model.traverse(object => { if (object.userData.wardrobe) object.visible = object.userData.wardrobe === (park ? 'park' : 'matrix'); });
      }
      if (entry.role === 'niobe') entry.model.traverse(object => {
        if (object.userData.wardrobe) object.visible = object.userData.wardrobe === (briefing ? 'briefing' : 'dock');
      });
      rig.root.updateWorldMatrix(true, true);
      entry.model.updateMatrixWorld(true);
    }
  }

  private async load(rig: CharacterRig, entry: BodyEntry): Promise<void> {
    const asset = await new GLTFLoader().loadAsync(`/assets/characters/${entry.role}-body.glb`);
    const model = asset.scene; model.name = `${entry.role}-detailed-body`;
    const drivers: { bone: THREE.Bone; joint?: THREE.Object3D; offset?: THREE.Matrix4 }[] = [];
    for (const name of asset.parser.json.extras.joints as string[]) {
      const bone = model.getObjectByName(name) as THREE.Bone;
      let joint: THREE.Object3D | undefined, offset: THREE.Matrix4 | undefined;
      if (name === 'torso') joint = rig.torso;
      else if (name === 'neck') { joint = rig.head; offset = new THREE.Matrix4().makeTranslation(0, -.55, 0); }
      else if (name !== 'pelvis') {
        const side = name.endsWith('_R') ? 0 : 1, part = name.split('_')[0];
        if (part === 'shoulder') joint = rig.shoulders[side];
        else if (part === 'elbow') joint = rig.elbows[side];
        else if (part === 'wrist') { joint = rig.mobilWrists?.[side] ?? rig.elbows[side]; offset = new THREE.Matrix4().makeTranslation(0, rig.mobilWrists ? 0 : -.65, .005); }
        else if (part === 'hip') joint = rig.hips[side];
        else if (part === 'knee') joint = rig.knees[side];
        else if (part === 'ankle') joint = rig.ankles[side];
        else if (part.startsWith('finger')) joint = rig.fingers[side][Number(part.slice(6))];
      }
      bone.matrixAutoUpdate = false; drivers.push({ bone, joint, offset });
    }
    model.traverse(object => {
      if (!(object instanceof THREE.Mesh)) return;
      this.geometries.add(object.geometry); object.castShadow = object.receiveShadow = true;
      const material = object.material as THREE.Material, index = ['Skin', 'Dock cloth', 'Dock trousers'].indexOf(material.name);
      this.materials.add(material);
      if (index >= 0) object.material = entry.materials[index];
      if (material.name === 'Dock bindings' && ['niobe', 'lock', 'roland', 'rama_kandra', 'kamala', 'trainman', 'hamann', 'west', 'dillard'].includes(entry.role)) {
        const bindings = entry.materials[1].clone() as THREE.MeshStandardMaterial; bindings.color.multiplyScalar(['rama_kandra', 'kamala', 'trainman'].includes(entry.role) ? .95 : .72);
        this.materials.add(bindings); object.material = bindings;
      }
      if (object instanceof THREE.SkinnedMesh) this.skeletons.add(object.skeleton);
    });
    if (this.disposed) { this.release(); return; }
    // The mesh is appended after the performance hierarchy, so its matrix
    // update observes even late contact corrections in the current frame.
    rig.detail.add(model); entry.model = model;
    const inverse = new THREE.Matrix4(), matrix = new THREE.Matrix4(), center = new THREE.Vector3();
    const synchronize = () => {
      inverse.copy(rig.detail.matrixWorld).invert();
      for (const { bone, joint, offset } of drivers) {
        if (joint) {
          matrix.multiplyMatrices(inverse, joint.matrixWorld);
          if (offset) matrix.multiply(offset);
          bone.matrix.copy(matrix);
        } else {
          center.copy(rig.hips[0].position).add(rig.hips[1].position).multiplyScalar(.5);
          bone.matrix.makeTranslation(center.x, center.y, center.z);
        }
        bone.matrixWorldNeedsUpdate = true;
      }
    };
    synchronize();
    enableSkinnedCulling(model);
    const update = model.updateMatrixWorld.bind(model);
    model.updateMatrixWorld = force => { synchronize(); update(force); };
    this.update(rig, entry.active, entry.park, entry.briefing);
  }

  private release(): void {
    this.geometries.forEach(geometry => geometry.dispose()); this.geometries.clear();
    this.materials.forEach(material => material.dispose()); this.materials.clear();
    this.skeletons.forEach(skeleton => skeleton.dispose()); this.skeletons.clear();
  }

  dispose(): void { this.disposed = true; this.entries.clear(); this.release(); }
}
