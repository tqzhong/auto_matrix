import * as THREE from 'three';
import type { HeroRig } from './HeroModel.js';

export interface ArticulatedJawData {
  bone: string;
  sourceMesh: string;
  poses: Record<string, { rotation: number[]; translation: number[] }>;
  closureCorrectives?: { meshNames: string[]; interpolation?: 'linear'; samples: { amount: number; target: string }[] };
  lipPoseCorrectives?: {
    meshNames: string[];
    openingSamples: number[];
    closingRatioSamples: number[];
    closingParameter?: 'amount';
    shapes: { control: string; targets: (string | null)[][] }[];
  };
}

function sampleInterval(samples: number[], value: number): [number, number] {
  let index = 0;
  while (index < samples.length - 2 && samples[index + 1] < value) index++;
  return [index, THREE.MathUtils.clamp((value - samples[index]) / (samples[index + 1] - samples[index]), 0, 1)];
}

// Soft lip shapes remain on the face. Only authored jaw channels move the
// rigid dentition, so interpolated teeth retain their original dimensions.
export class ArticulatedJaw {
  private bone: THREE.Bone;
  private face: THREE.Mesh;
  private restPosition: THREE.Vector3;
  private restRotation: THREE.Quaternion;
  private poses: { index: number; rotation: THREE.Quaternion; translation: THREE.Vector3 }[];
  private rotation = new THREE.Quaternion();
  private closure?: { open: number; close: number; knots: number[]; linear: boolean; meshes: { mesh: THREE.Mesh; indices: number[] }[] };
  private lipPose?: {
    open: number; close: number; openings: number[]; ratios: number[]; independentClosing: boolean;
    shapes: { control: number; meshes: { mesh: THREE.Mesh; indices: number[][] }[] }[];
  };

  constructor(rig: Pick<HeroRig, 'root' | 'bones'>, data: ArticulatedJawData) {
    this.bone = rig.bones.get(data.bone)!;
    this.face = rig.root.getObjectByName(data.sourceMesh) as THREE.Mesh;
    this.restPosition = this.bone.position.clone(); this.restRotation = this.bone.quaternion.clone();
    this.poses = Object.entries(data.poses).map(([name, pose]) => ({ index: this.face.morphTargetDictionary![name],
      rotation: new THREE.Quaternion().fromArray(pose.rotation).normalize(), translation: new THREE.Vector3().fromArray(pose.translation) }));
    if (data.closureCorrectives) {
      const { meshNames, samples } = data.closureCorrectives;
      this.closure = { open: this.face.morphTargetDictionary!.jawOpen, close: this.face.morphTargetDictionary!.mouthClose,
        knots: samples.map(sample => sample.amount), linear: data.closureCorrectives.interpolation === 'linear', meshes: meshNames.map(name => {
          const mesh = rig.root.getObjectByName(name) as THREE.Mesh;
          return { mesh, indices: samples.map(sample => mesh.morphTargetDictionary![sample.target]) };
        }) };
    }
    if (data.lipPoseCorrectives) {
      const { meshNames, openingSamples, closingRatioSamples, shapes } = data.lipPoseCorrectives;
      this.lipPose = {
        open: this.face.morphTargetDictionary!.jawOpen, close: this.face.morphTargetDictionary!.mouthClose,
        openings: openingSamples, ratios: closingRatioSamples, independentClosing: data.lipPoseCorrectives.closingParameter === 'amount',
        shapes: shapes.map(shape => ({ control: this.face.morphTargetDictionary![shape.control], meshes: meshNames.map(name => {
          const mesh = rig.root.getObjectByName(name) as THREE.Mesh;
          return { mesh, indices: shape.targets.map(row => row.map(target => target === null ? -1 : mesh.morphTargetDictionary![target])) };
        }) })),
      };
    }
  }

  update(): void {
    this.bone.position.copy(this.restPosition); this.bone.quaternion.copy(this.restRotation);
    for (const pose of this.poses) {
      const amount = THREE.MathUtils.clamp(this.face.morphTargetInfluences![pose.index], 0, 1);
      this.bone.position.addScaledVector(pose.translation, amount);
      this.bone.quaternion.multiply(this.rotation.identity().slerp(pose.rotation, amount));
    }
    if (this.closure) {
      const { open, close, knots, linear, meshes } = this.closure;
      const opening = THREE.MathUtils.clamp(this.face.morphTargetInfluences![open], 0, 1);
      const closing = THREE.MathUtils.clamp(this.face.morphTargetInfluences![close], 0, 1);
      for (let i = 0; i < knots.length; i++) {
        let weight = opening * closing;
        if (linear) {
          const [lower, t] = sampleInterval(knots, opening);
          weight = closing * (i === lower ? 1 - t : i === lower + 1 ? t : 0);
        } else for (let k = 0; k < knots.length; k++) if (k !== i) weight *= (opening-knots[k]) / (knots[i]-knots[k]);
        for (const { mesh, indices } of meshes) mesh.morphTargetInfluences![indices[i]] = weight;
      }
    }
    if (this.lipPose) {
      const { open, close, openings, ratios, independentClosing, shapes } = this.lipPose;
      const opening = THREE.MathUtils.clamp(this.face.morphTargetInfluences![open], 0, 1);
      const closing = THREE.MathUtils.clamp(this.face.morphTargetInfluences![close], 0, 1);
      const [oi, u] = sampleInterval(openings, opening);
      const [ri, v] = sampleInterval(ratios, independentClosing ? closing : opening ? closing / opening : 0);
      for (const shape of shapes) {
        const amount = THREE.MathUtils.clamp(this.face.morphTargetInfluences![shape.control], 0, 1);
        for (const { mesh, indices } of shape.meshes) {
          for (const row of indices) for (const index of row) if (index >= 0) mesh.morphTargetInfluences![index] = 0;
          for (let i = 0; i < 2; i++) for (let j = 0; j < 2; j++) {
            const index = indices[oi + i][ri + j];
            if (index >= 0) mesh.morphTargetInfluences![index] += amount * (i ? u : 1 - u) * (j ? v : 1 - v);
          }
        }
      }
    }
  }
}
