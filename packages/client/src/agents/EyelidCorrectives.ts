import * as THREE from 'three';
import type { HeroRig } from './HeroModel.js';

export interface EyelidCorrectivesData {
  sourceMesh: string;
  mesh: string;
  sealMesh?: string;
  shapes: { control: string; target: string }[];
  faceShapes?: { control: string; target: string }[];
  limits?: { controls: [string, string]; targets: [string, string] }[];
}

// The tear line follows the eye's curved surface between authored endpoints.
export class EyelidCorrectives {
  private face: THREE.Mesh;
  private lining: THREE.Mesh;
  private shapes: { control: number; target: number }[];
  private faceShapes: { control: number; target: number }[];
  private limits: { controls: number[]; faceTargets: number[]; liningTargets: number[] }[];
  private seal?: THREE.Mesh;
  private sealShapes: { source: number; target: number }[] = [];

  constructor(rig: Pick<HeroRig, 'root'>, data: EyelidCorrectivesData) {
    this.face = rig.root.getObjectByName(data.sourceMesh) as THREE.Mesh;
    this.lining = rig.root.getObjectByName(data.mesh) as THREE.Mesh;
    this.shapes = data.shapes.map(shape => ({ control: this.face.morphTargetDictionary![shape.control], target: this.lining.morphTargetDictionary![shape.target] }));
    this.faceShapes = (data.faceShapes ?? []).map(shape => ({ control: this.face.morphTargetDictionary![shape.control], target: this.face.morphTargetDictionary![shape.target] }));
    this.limits = (data.limits ?? []).map(limit => ({
      controls: limit.controls.map(name => this.face.morphTargetDictionary![name]),
      faceTargets: limit.targets.map(name => this.face.morphTargetDictionary![name]),
      liningTargets: limit.targets.map(name => this.lining.morphTargetDictionary![name]),
    }));
    if (data.sealMesh) {
      this.seal = rig.root.getObjectByName(data.sealMesh) as THREE.Mesh;
      this.sealShapes = Object.entries(this.seal.morphTargetDictionary!).map(([name, target]) => ({ source: this.lining.morphTargetDictionary![name], target }));
    }
  }

  update(): void {
    for (const { control, target } of this.faceShapes) {
      const amount = THREE.MathUtils.clamp(this.face.morphTargetInfluences![control], 0, 1);
      this.face.morphTargetInfluences![target] = 4 * amount * (1 - amount);
    }
    // Negative corrective shapes remove excess extent without changing inputs.
    for (const { controls, faceTargets, liningTargets } of this.limits) {
      const a = THREE.MathUtils.clamp(this.face.morphTargetInfluences![controls[0]], 0, 1);
      const b = THREE.MathUtils.clamp(this.face.morphTargetInfluences![controls[1]], 0, 1);
      const sum = a + b, excess = sum > 1 ? 1 - 1 / sum : 0;
      this.face.morphTargetInfluences![faceTargets[0]] = this.lining.morphTargetInfluences![liningTargets[0]] = a * excess;
      this.face.morphTargetInfluences![faceTargets[1]] = this.lining.morphTargetInfluences![liningTargets[1]] = b * excess;
    }
    for (const { control, target } of this.shapes) {
      const amount = THREE.MathUtils.clamp(this.face.morphTargetInfluences![control], 0, 1);
      this.lining.morphTargetInfluences![target] = 4 * amount * (1 - amount);
    }
    for (const { source, target } of this.sealShapes) this.seal!.morphTargetInfluences![target] = this.lining.morphTargetInfluences![source];
  }
}
