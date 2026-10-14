import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import type { CharacterRig } from './CharacterModel.js';
import { createAnatomicalHand, connectGardenWrists } from './OracleParkHands.js';
import { enableSkinnedCulling } from './SkinnedBounds.js';

/** The child reuses hand anatomy only, scaled inside his existing sleeve. */
export class SpoonBoyHands {
  private geometries = new Set<THREE.BufferGeometry>();
  private materials = new Set<THREE.Material>();
  private skeletons = new Set<THREE.Skeleton>();
  private disposed = false;

  track(rig: CharacterRig, material: THREE.Material): void {
    const wrists = ['R', 'L'].map(side => rig.root.getObjectByName(`spoon-boy-wrist-${side}`)!);
    const fallback = wrists.flatMap(wrist => [...wrist.children]);
    new GLTFLoader().loadAsync('/assets/characters/oracle-park-hands.glb').then(asset => {
      const hands = ['R', 'L'].map((side, i) => {
        const root = asset.scene.getObjectByName(`oracle-anatomical-hand-${side}`)!;
        const skin = root.getObjectByName(`oracle-hand-skin-${side}`) as THREE.SkinnedMesh;
        this.materials.add(skin.material as THREE.Material);
        const hand = createAnatomicalHand(root, wrists[i], material, side); root.scale.setScalar(.75);
        this.geometries.add(skin.geometry); this.geometries.add(hand.connection.mesh.geometry); this.skeletons.add(skin.skeleton);
        return hand;
      });
      if (this.disposed) { this.release(); return; }
      rig.spoonHands = hands; fallback.forEach(object => { object.visible = false; });
      hands.forEach((hand, i) => { hand.wrist.add(hand.root); rig.elbows[i].add(hand.connection.mesh); enableSkinnedCulling(hand.root); });
      this.reset(rig); connectGardenWrists(rig, hands);
    }).catch(error => console.warn('Spoon boy hand anatomy could not load; retaining the existing hands.', error));
  }

  reset(rig: CharacterRig): void {
    rig.spoonHands?.forEach((hand, side) => {
      hand.wrist.quaternion.identity();
      hand.bones.forEach((chain, digit) => chain.forEach(bone => bone.rotation.set(0, 0, (side ? -1 : 1) * (digit ? .12 : .05))));
    });
  }

  private release(): void {
    this.geometries.forEach(value => value.dispose()); this.geometries.clear();
    this.materials.forEach(value => value.dispose()); this.materials.clear();
    this.skeletons.forEach(value => value.dispose()); this.skeletons.clear();
  }
  dispose(): void { this.disposed = true; this.release(); }
}
