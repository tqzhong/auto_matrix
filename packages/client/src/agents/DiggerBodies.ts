import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import type { CharacterRig } from './CharacterModel.js';
import { enableSkinnedCulling } from './SkinnedBounds.js';
import { architectSeatedPoseActive } from './ArchitectPerformance.js';

interface BodyEntry {
  role: 'spoon_boy' | 'zee' | 'charra' | 'niobe' | 'lock' | 'roland' | 'architect' | 'seraph' | 'keymaker' | 'rama_kandra' | 'kamala' | 'trainman' | 'hamann' | 'west' | 'dillard' | 'maggie' | 'colt' | 'link' | 'bane' | 'mifune' | 'kid';
  fallback: THREE.Mesh[];
  materials: THREE.Material[];
  model?: THREE.Group;
  loading: boolean;
  active: boolean;
  park: boolean;
  briefing: boolean;
  evacuation: boolean;
  dryColor?: THREE.Color;
}

/** Continuous anatomy follows the same joints as the dock contact performances. */
export class DiggerBodies {
  private entries = new Map<CharacterRig, BodyEntry>();
  private geometries = new Set<THREE.BufferGeometry>();
  private materials = new Set<THREE.Material>();
  private textures = new Set<THREE.Texture>();
  private skeletons = new Set<THREE.Skeleton>();
  private disposed = false;

  track(rig: CharacterRig, role: BodyEntry['role'], skin: THREE.Material, cloth: THREE.Material, trousers: THREE.Material): void {
    const headObjects = new Set<THREE.Object3D>(); rig.head.traverse(object => headObjects.add(object));
    const fallback: THREE.Mesh[] = [];
    rig.detail.traverse(object => { if (object instanceof THREE.Mesh && !headObjects.has(object) && object.name !== 'kamala-skirt') fallback.push(object); });
    if (role === 'bane') {
      const upper = cloth.clone() as THREE.MeshStandardMaterial, lower = trousers.clone() as THREE.MeshStandardMaterial;
      upper.color.set('#827463'); upper.roughness = .96; upper.metalness = 0; upper.bumpScale = .006;
      lower.color.set('#343b40'); lower.roughness = .97;
      this.materials.add(upper); this.materials.add(lower); cloth = upper; trousers = lower;
    }
    if (role === 'colt') {
      cloth = cloth.clone(); this.materials.add(cloth);
    }
    this.entries.set(rig, { role, fallback, materials: [skin, cloth, trousers], loading: false, active: true, park: false, briefing: false, evacuation: false,
      dryColor: role === 'seraph' || role === 'colt' ? (cloth as THREE.MeshStandardMaterial).color.clone() : undefined });
  }

  update(rig: CharacterRig, active = true, park = false, briefing = false, evacuation = false): void {
    const entry = this.entries.get(rig); if (!entry) return;
    entry.active = active;
    entry.park = park;
    entry.briefing = briefing;
    entry.evacuation = evacuation;
    if (!active) {
      if (entry.model) entry.model.visible = false;
      if (entry.role === 'colt' || entry.role === 'bane') entry.fallback.forEach(mesh => { mesh.visible = true; });
      return;
    }
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
      if (entry.role === 'colt') {
        const cloth = entry.materials[1] as THREE.MeshStandardMaterial;
        if (evacuation) cloth.color.set('#b4a58c'); else cloth.color.copy(entry.dryColor!);
        entry.model.traverse(object => { if (object.userData.wardrobe === 'evacuation') object.visible = evacuation; });
      }
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
        else if (part === 'wrist') {
          const child = entry.role === 'spoon_boy' ? rig.root.getObjectByName(`spoon-boy-wrist-${side ? 'L' : 'R'}`) : undefined;
          joint = child ?? rig.mobilWrists?.[side] ?? rig.elbows[side];
          if (!child) offset = new THREE.Matrix4().makeTranslation(0, rig.mobilWrists ? 0 : -.65, .005);
        }
        else if (part === 'thumb' && entry.role === 'architect') {
          const thumb = new THREE.Group(); thumb.name = `architect-thumb-${side}`;
          thumb.position.copy(bone.position).sub(model.getObjectByName(`wrist_${side ? 'L' : 'R'}`)!.position); thumb.position.z += .005;
          rig.mobilWrists![side].add(thumb);
          rig.architectThumbs ??= []; rig.architectThumbs[side] = thumb; joint = thumb;
        }
        else if (part === 'hip') joint = rig.hips[side];
        else if (part === 'knee') joint = rig.knees[side];
        else if (part === 'ankle') joint = rig.ankles[side];
        else if (entry.role === 'architect' && /^(thumb|finger[0-3])(mid|tip)$/.test(part)) {
          const [, digit, segment] = /^(thumb|finger[0-3])(mid|tip)$/.exec(part)!;
          const first = digit === 'thumb' ? rig.architectThumbs![side] : rig.fingers[side][Number(digit.slice(6))];
          const parent = segment === 'mid' ? first : first.getObjectByName('architect-mid')!;
          const previous = model.getObjectByName(`${digit}${segment === 'mid' ? '' : 'mid'}_${side ? 'L' : 'R'}`)!;
          const child = new THREE.Group(); child.name = `architect-${segment}`; child.position.copy(bone.position).sub(previous.position);
          parent.add(child); joint = child;
        }
        else if (part.startsWith('finger')) {
          joint = rig.fingers[side][Number(part.slice(6))];
          if (entry.role === 'architect') {
            joint.position.copy(bone.position).sub(model.getObjectByName(`wrist_${side ? 'L' : 'R'}`)!.position); joint.position.z += .005;
          }
        }
      }
      bone.matrixAutoUpdate = false; drivers.push({ bone, joint, offset });
    }
    // Capture imported maps before shared cloth maps replace any material slots.
    model.traverse(object => {
      if (!(object instanceof THREE.Mesh)) return;
      for (const value of Object.values(object.material)) if (value instanceof THREE.Texture) this.textures.add(value);
    });
    model.traverse(object => {
      if (!(object instanceof THREE.Mesh)) return;
      this.geometries.add(object.geometry); object.castShadow = object.receiveShadow = true;
      const material = object.material as THREE.Material, index = ['Skin', 'Dock cloth', 'Dock trousers'].indexOf(material.name);
      this.materials.add(material);
      if (index >= 0) object.material = entry.materials[index];
      if (material.name === 'APU woven vest' || material.name === 'Dock woven vest') {
        const vest = material as THREE.MeshStandardMaterial;
        vest.bumpMap = (entry.materials[1] as THREE.MeshStandardMaterial).bumpMap; vest.bumpScale = .004;
      }
      if (material.name === 'Dock bindings' && ['spoon_boy', 'niobe', 'lock', 'roland', 'rama_kandra', 'kamala', 'trainman', 'hamann', 'west', 'dillard', 'maggie', 'colt', 'link', 'bane', 'mifune'].includes(entry.role)) {
        const bindings = entry.materials[1].clone() as THREE.MeshStandardMaterial; bindings.color.multiplyScalar(entry.role === 'spoon_boy' ? .99 : ['rama_kandra', 'kamala', 'trainman'].includes(entry.role) ? .95 : .72);
        this.materials.add(bindings); object.material = bindings;
      }
      if (object instanceof THREE.SkinnedMesh) this.skeletons.add(object.skeleton);
    });
    if (this.disposed) { this.release(); return; }
    // The mesh is appended after the performance hierarchy, so its matrix
    // update observes even late contact corrections in the current frame.
    rig.detail.add(model); entry.model = model;
    const inverse = new THREE.Matrix4(), matrix = new THREE.Matrix4(), center = new THREE.Vector3();
    const openings: { mesh: THREE.Mesh; target: number }[] = [], thigh = new THREE.Vector3();
    const walking: { mesh: THREE.Mesh; target: number; back: boolean }[] = [];
    if (entry.role === 'architect') model.traverse(object => {
      if (!(object instanceof THREE.Mesh)) return;
      const target = object.morphTargetDictionary?.['architect-seated-opening'];
      if (target !== undefined) openings.push({ mesh: object, target });
      for (const back of [false, true]) {
        const target = object.morphTargetDictionary?.[back ? 'architect-walk-back' : 'architect-walk-front'];
        if (target !== undefined) walking.push({ mesh: object, target, back });
      }
    });
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
      if (openings.length || walking.length) {
        let flexion = Infinity, forward = 0, backward = 0;
        for (const hip of rig.hips) {
          thigh.set(0, -1, 0).applyQuaternion(hip.quaternion);
          const angle = Math.atan2(thigh.z, -thigh.y);
          flexion = Math.min(flexion, angle); forward = Math.max(forward, angle); backward = Math.max(backward, -angle);
        }
        const seated = architectSeatedPoseActive(rig);
        const amount = seated ? THREE.MathUtils.smoothstep(flexion, .2, 1.05) : 0;
        for (const { mesh, target } of openings) mesh.morphTargetInfluences![target] = amount;
        if (walking.length) {
          const front = seated ? 0 : THREE.MathUtils.smoothstep(forward, .28, .8);
          const back = seated ? 0 : THREE.MathUtils.smoothstep(backward, .12, .5);
          for (const { mesh, target, back: rear } of walking) mesh.morphTargetInfluences![target] = rear ? back : front;
        }
      }
    };
    synchronize();
    enableSkinnedCulling(model);
    const update = model.updateMatrixWorld.bind(model);
    model.updateMatrixWorld = force => { synchronize(); update(force); };
    this.update(rig, entry.active, entry.park, entry.briefing, entry.evacuation);
  }

  private release(): void {
    this.geometries.forEach(geometry => geometry.dispose()); this.geometries.clear();
    this.materials.forEach(material => material.dispose()); this.materials.clear();
    this.textures.forEach(texture => texture.dispose()); this.textures.clear();
    this.skeletons.forEach(skeleton => skeleton.dispose()); this.skeletons.clear();
  }

  dispose(): void { this.disposed = true; this.entries.clear(); this.release(); }
}
