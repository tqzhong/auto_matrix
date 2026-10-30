import * as THREE from 'three';

/** Preserve shoulder volume across large arm raises on explicitly authored rigs. */
export class ShoulderSupport {
  private geometries = new Map<THREE.BufferGeometry, THREE.BufferGeometry>();
  private skeletons = new Set<THREE.Skeleton>();

  attach(root: THREE.Group, bones: Map<string, THREE.Bone>, rest: Map<string, THREE.Vector3>): void {
    const chest = bones.get('chest')!;
    const arms = ['R', 'L'].map(side => {
      const shoulder = bones.get(`shoulder_${side}`)!;
      const supports = Array.from({ length: 7 }, (_, i) => {
        const bone = new THREE.Bone(), amount = (i + 1) / 8;
        bone.name = `shoulder_support_${side}_${i + 1}`;
        shoulder.add(bone); bones.set(bone.name, bone); rest.set(bone.name, bone.position.clone());
        const update = bone.updateMatrix.bind(bone), identity = new THREE.Quaternion(), rotation = new THREE.Quaternion();
        // Match late IK updates as well as ordinary animation, like ForearmTwist.
        bone.updateMatrix = () => {
          rotation.copy(identity).slerp(shoulder.quaternion, amount);
          bone.quaternion.copy(shoulder.quaternion).invert().multiply(rotation);
          update();
        };
        return bone;
      });
      return { shoulder, supports };
    });
    root.updateMatrixWorld(true);
    const replacements = new Map<THREE.Skeleton, THREE.Skeleton>();
    root.traverse(object => {
      if (!(object instanceof THREE.SkinnedMesh)) return;
      const source = object.skeleton;
      let skeleton = replacements.get(source);
      if (!skeleton) {
        const extra = arms.flatMap(arm => arm.supports);
        skeleton = new THREE.Skeleton([...source.bones, ...extra], [...source.boneInverses.map(m => m.clone()),
          ...extra.map(bone => bone.matrixWorld.clone().invert())]);
        replacements.set(source, skeleton); this.skeletons.add(skeleton);
      }
      let geometry = this.geometries.get(object.geometry);
      if (!geometry) {
        const prepared = object.geometry.clone();
        const { skinIndex, skinWeight } = prepared.attributes, chestIndex = source.bones.indexOf(chest);
        const indices = arms.map(arm => ({ original: source.bones.indexOf(arm.shoulder),
          steps: [chestIndex, ...arm.supports.map(bone => skeleton!.bones.indexOf(bone)), source.bones.indexOf(arm.shoulder)] }));
        for (let vertex = 0; vertex < skinIndex.count; vertex++) {
          const entries = new Map<number, number>();
          for (let k = 0; k < 4; k++) {
            const index = skinIndex.getComponent(vertex, k), weight = skinWeight.getComponent(vertex, k);
            if (weight) entries.set(index, (entries.get(index) ?? 0) + weight);
          }
          const torsoWeight = entries.get(chestIndex) ?? 0;
          const armWeights = indices.map(arm => entries.get(arm.original) ?? 0), armWeight = armWeights[0] + armWeights[1];
          if (!torsoWeight || !armWeight) continue;
          // Share the chest contribution once when both shoulders influence a
          // vertex. Independent pair corrections would count it twice.
          const total = torsoWeight + armWeight, blend = armWeight / total * 8;
          const lower = Math.min(7, Math.floor(blend)), fraction = blend - lower;
          entries.delete(chestIndex); indices.forEach(arm => entries.delete(arm.original));
          indices.forEach((arm, i) => {
            const weight = total * armWeights[i] / armWeight;
            for (const [index, amount] of [[arm.steps[lower], 1 - fraction], [arm.steps[lower + 1], fraction]]) {
              if (weight * amount) entries.set(index, (entries.get(index) ?? 0) + weight * amount);
            }
          });
          const strongest = [...entries].sort((a, b) => b[1] - a[1]).slice(0, 4), sum = strongest.reduce((s, item) => s + item[1], 0);
          for (let k = 0; k < 4; k++) {
            skinIndex.setComponent(vertex, k, strongest[k]?.[0] ?? 0);
            skinWeight.setComponent(vertex, k, (strongest[k]?.[1] ?? 0) / sum);
          }
        }
        this.geometries.set(object.geometry, prepared); geometry = prepared;
      }
      object.geometry = geometry; object.skeleton = skeleton;
    });
  }

  dispose(): void {
    this.geometries.forEach(geometry => geometry.dispose()); this.geometries.clear();
    this.skeletons.forEach(skeleton => skeleton.dispose()); this.skeletons.clear();
  }
}
