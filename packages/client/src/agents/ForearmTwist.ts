import * as THREE from 'three';

/** Distribute palm roll along the forearm without changing the authored hand pose. */
export class ForearmTwist {
  private geometries = new Map<THREE.BufferGeometry, THREE.BufferGeometry>();
  private skeletons = new Set<THREE.Skeleton>();

  attach(root: THREE.Group, bones: Map<string, THREE.Bone>, rest: Map<string, THREE.Vector3>): void {
    const arms = ['R', 'L'].map(side => {
      const wrist = bones.get(`wrist_${side}`)!, elbow = bones.get(`elbow_${side}`)!;
      const axis = wrist.position.clone().normalize();
      const twists = [1, 2, 3].map(part => {
        const bone = new THREE.Bone(); bone.name = `forearm_twist_${side}_${part}`;
        wrist.add(bone);
        bones.set(bone.name, bone); rest.set(bone.name, bone.position.clone());
        const update = bone.updateMatrix.bind(bone), rotation = new THREE.Quaternion();
        // Both updateMatrixWorld and updateWorldMatrix call this, including
        // contact solvers that re-pose an arm after the ordinary animation.
        bone.updateMatrix = () => {
          const q = wrist.quaternion, projection = q.x * axis.x + q.y * axis.y + q.z * axis.z;
          let angle = Math.abs(projection) + Math.abs(q.w) < 1e-8 ? 0 : 2 * Math.atan2(projection, q.w);
          if (angle > Math.PI) angle -= Math.PI * 2;
          if (angle < -Math.PI) angle += Math.PI * 2;
          rotation.setFromAxisAngle(axis, angle * part / 3);
          // Cancel the parent's full wrist swing/roll, then apply only this
          // part of the roll. Being a wrist child also handles late IK updates.
          bone.quaternion.copy(q).invert().multiply(rotation);
          update();
        };
        return bone;
      });
      return { wrist, elbow, axis, twists };
    });
    root.updateMatrixWorld(true);
    const replacements = new Map<THREE.Skeleton, THREE.Skeleton>();
    root.traverse(object => {
      if (!(object instanceof THREE.SkinnedMesh)) return;
      const source = object.skeleton;
      let skeleton = replacements.get(source);
      if (!skeleton) {
        const extra = arms.flatMap(arm => arm.twists);
        skeleton = new THREE.Skeleton([...source.bones, ...extra], [...source.boneInverses,
          ...extra.map(bone => bone.matrixWorld.clone().invert())]);
        replacements.set(source, skeleton); this.skeletons.add(skeleton);
      }
      let geometry = this.geometries.get(object.geometry);
      if (!geometry) {
        const prepared: THREE.BufferGeometry = object.geometry.clone();
        const { position, skinIndex, skinWeight } = prepared.attributes;
        const transforms = arms.map(arm => ({ ...arm, index: source.bones.indexOf(arm.elbow),
          inverse: source.boneInverses[source.bones.indexOf(arm.elbow)].clone().multiply(object.bindMatrix),
          indices: [source.bones.indexOf(arm.elbow), ...arm.twists.map(bone => skeleton!.bones.indexOf(bone))] }));
        const point = new THREE.Vector3();
        for (let i = 0; i < position.count; i++) {
          const entries = new Map<number, number>(); let changed = false;
          for (let j = 0; j < 4; j++) {
            const index = skinIndex.getComponent(i, j), weight = skinWeight.getComponent(i, j);
            if (!weight) continue;
            const arm = transforms.find(arm => arm.index === index);
            if (!arm) { entries.set(index, (entries.get(index) ?? 0) + weight); continue; }
            point.fromBufferAttribute(position, i).applyMatrix4(arm.inverse);
            const blend = THREE.MathUtils.smoothstep(point.dot(arm.axis) / arm.wrist.position.length(), .1, .95) * 3;
            const lower = Math.min(2, Math.floor(blend)), fraction = blend - lower;
            for (const [joint, amount] of [[arm.indices[lower], 1 - fraction], [arm.indices[lower + 1], fraction]])
              entries.set(joint, (entries.get(joint) ?? 0) + weight * amount);
            changed ||= blend > 0;
          }
          if (!changed) continue;
          const strongest = [...entries].sort((a, b) => b[1] - a[1]).slice(0, 4);
          const total = strongest.reduce((sum, entry) => sum + entry[1], 0);
          for (let j = 0; j < 4; j++) {
            skinIndex.setComponent(i, j, strongest[j]?.[0] ?? 0);
            skinWeight.setComponent(i, j, (strongest[j]?.[1] ?? 0) / total);
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
