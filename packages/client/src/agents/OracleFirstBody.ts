import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import type { CharacterRig } from './CharacterModel.js';
import type { MotionInput } from './CharacterMotion.js';
import { enableSkinnedCulling } from './SkinnedBounds.js';

interface Entry {
  fallback: THREE.Object3D[];
  skin: THREE.MeshStandardMaterial;
  fabric: THREE.Texture | null;
  active: boolean;
  loading: boolean;
  model?: THREE.Group;
  firstSkin?: THREE.MeshStandardMaterial;
}

/** The kitchen has its own body and wardrobe; later-film performances keep theirs. */
export class OracleFirstBodies {
  private entries = new Map<CharacterRig, Entry>();
  private geometries = new Set<THREE.BufferGeometry>();
  private materials = new Set<THREE.Material>();
  private textures = new Set<THREE.Texture>();
  private skeletons = new Set<THREE.Skeleton>();
  private disposed = false;

  track(rig: CharacterRig, skin: THREE.MeshStandardMaterial, fabric: THREE.Texture | null): void {
    const fallback: THREE.Object3D[] = ['oracle-daily-blouse', 'oracle-daily-hem', 'oracle-daily-collar', 'oracle-daily-tailoring', 'oracle-apron-group', 'oracle-neck']
      .map(name => rig.root.getObjectByName(name)!).filter(Boolean);
    for (const joint of [...rig.shoulders, ...rig.elbows, ...rig.hips, ...rig.ankles])
      fallback.push(...joint.children.filter(child => child instanceof THREE.Mesh));
    this.entries.set(rig, { fallback, skin, fabric, active: false, loading: false });
  }

  update(rig: CharacterRig, input: MotionInput): void {
    const entry = this.entries.get(rig); if (!entry) return;
    const active = Boolean((input.oracleKitchen || input.oracleVisit?.role === 'oracle') && !input.oracleRevolutions
      && !input.oracleRequest && !input.oracleLast && !input.oracleRestored && !input.parkOutfit && input.epilogue?.kind !== 'dawn');
    // Restore before the existing performance chooses its own park/sofa outfit.
    if (entry.active && !active) {
      entry.fallback.forEach(object => { object.visible = true; });
      rig.parkHands?.forEach(hand => { hand.skin.material = entry.skin; hand.connection.mesh.material = entry.skin; });
    }
    entry.active = active;
    if (active && !entry.loading) {
      entry.loading = true;
      this.load(rig, entry).catch(error => console.warn('Oracle kitchen body could not load; retaining its fallback.', error));
    }
    if (entry.model) entry.model.visible = active;
  }

  present(rig: CharacterRig): void {
    const entry = this.entries.get(rig); if (!entry?.model || !entry.active) return;
    entry.fallback.forEach(object => { object.visible = false; });
    rig.parkHands?.forEach(hand => { hand.skin.material = entry.firstSkin!; hand.connection.mesh.material = entry.firstSkin!; });
    entry.model.visible = true;
  }

  private async load(rig: CharacterRig, entry: Entry): Promise<void> {
    const asset = await new GLTFLoader().loadAsync('/assets/characters/oracle-first-body.glb');
    const model = asset.scene; model.name = 'oracle-first-detailed-body';
    const drivers: { bone: THREE.Bone; joint?: THREE.Object3D; offset?: THREE.Matrix4 }[] = [];
    for (const name of asset.parser.json.extras.joints as string[]) {
      const bone = model.getObjectByName(name) as THREE.Bone;
      let joint: THREE.Object3D | undefined, offset: THREE.Matrix4 | undefined;
      if (name === 'torso') joint = rig.torso;
      else if (name === 'neck') { joint = rig.head; offset = new THREE.Matrix4().makeTranslation(0, -.55, 0); }
      else if (name !== 'pelvis') {
        const side = name.endsWith('_R') ? 0 : 1, part = name.split('_')[0];
        if (part === 'shoulder') joint = rig.shoulders[side];
        if (part === 'elbow') joint = rig.elbows[side];
        if (part === 'wrist') joint = rig.root.getObjectByName(`oracle-hand-${side ? 'L' : 'R'}`);
        if (part === 'hip') joint = rig.hips[side];
        if (part === 'knee') joint = rig.knees[side];
        if (part === 'ankle') joint = rig.ankles[side];
      }
      bone.matrixAutoUpdate = false; drivers.push({ bone, joint, offset });
    }
    const textile = new THREE.TextureLoader().load('/assets/characters/oracle-first-fabrics.png');
    textile.colorSpace = THREE.SRGBColorSpace; textile.flipY = false; textile.anisotropy = 8; this.textures.add(textile);
    const skinMap = new THREE.TextureLoader().load('/assets/characters/oracle-first-face-reference.png');
    const sample = asset.parser.json.extras.neckSample as number[];
    skinMap.colorSpace = THREE.SRGBColorSpace; skinMap.flipY = false; skinMap.anisotropy = 8;
    skinMap.repeat.set(.035, .012); skinMap.offset.set(sample[0] - .0175, sample[1]); this.textures.add(skinMap);
    entry.firstSkin = entry.skin.clone(); entry.firstSkin.name = 'Oracle first skin'; entry.firstSkin.map = skinMap; entry.firstSkin.color.setHex(0xffffff);
    entry.firstSkin.roughness = .78; entry.firstSkin.bumpScale = .0006; this.materials.add(entry.firstSkin);
    model.traverse(object => {
      if (!(object instanceof THREE.Mesh)) return;
      this.geometries.add(object.geometry); object.castShadow = object.receiveShadow = true;
      const material = object.material as THREE.MeshStandardMaterial; this.materials.add(material);
      if (material.name === 'Oracle first skin') object.material = entry.firstSkin;
      else {
        material.bumpMap = entry.fabric; material.bumpScale = .0014;
        if (material.name === 'Oracle floral' || material.name === 'Oracle apron') {
          const map = textile.clone(); map.repeat.set(.5, 1); map.offset.x = material.name === 'Oracle floral' ? 0 : .5;
          map.needsUpdate = true;
          this.textures.add(map); material.map = map; material.color.setHex(0xffffff);
        }
      }
      if (object instanceof THREE.SkinnedMesh) this.skeletons.add(object.skeleton);
    });
    if (this.disposed) { this.release(); return; }
    entry.model = model; rig.oracleFirstBody = model; rig.detail.add(model);
    const inverse = new THREE.Matrix4(), matrix = new THREE.Matrix4(), center = new THREE.Vector3();
    const sync = () => {
      inverse.copy(rig.detail.matrixWorld).invert();
      for (const { bone, joint, offset } of drivers) {
        if (joint) { matrix.multiplyMatrices(inverse, joint.matrixWorld); if (offset) matrix.multiply(offset); bone.matrix.copy(matrix); }
        else { center.copy(rig.hips[0].position).add(rig.hips[1].position).multiplyScalar(.5); bone.matrix.makeTranslation(center.x, center.y, center.z); }
        bone.matrixWorldNeedsUpdate = true;
      }
    };
    const update = model.updateMatrixWorld.bind(model);
    model.updateMatrixWorld = force => { sync(); update(force); };
    const updateWorld = model.updateWorldMatrix.bind(model);
    model.updateWorldMatrix = (parents, children) => { if (parents) model.parent?.updateWorldMatrix(true, false); sync(); updateWorld(false, children); };
    sync(); enableSkinnedCulling(model); model.visible = entry.active; this.present(rig);
  }

  private release(): void {
    this.geometries.forEach(value => value.dispose()); this.geometries.clear();
    this.materials.forEach(value => value.dispose()); this.materials.clear();
    this.textures.forEach(value => value.dispose()); this.textures.clear();
    this.skeletons.forEach(value => value.dispose()); this.skeletons.clear();
  }
  dispose(): void { this.disposed = true; this.entries.clear(); this.release(); }
}
