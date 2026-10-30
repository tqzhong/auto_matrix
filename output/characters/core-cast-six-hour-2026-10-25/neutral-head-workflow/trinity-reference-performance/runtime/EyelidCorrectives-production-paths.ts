import * as THREE from 'three';
import type { HeroRig } from '../../../../../../packages/client/src/agents/HeroModel.js';

export interface EyelidCorrectivesData {
  sourceMesh: string;
  mesh: string;
  sealMesh?: string;
  followers?: string[];
  blinkClosure?: { blink: string; shapes: { control: string; target: string; curve?: 'midpoint' }[] }[];
  shapes: { control: string; target: string }[];
  faceShapes?: { control: string; target: string }[];
  limits?: { controls: [string, string]; targets: [string, string] }[];
  neutralAperture?: { blink: string; target: string; shapes: { control: string; target: string; limit?: string }[] }[];
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
  private followers: { mesh: THREE.Mesh; shapes: { source: number; target: number }[] }[];
  private blinkClosure: { blink: number; shapes: { control: number; face: number; lining: number; midpoint: boolean }[] }[];
  private neutralAperture: { blink: number; face: number; lining: number; shapes: { control: number; face: number; lining: number; limit?: number }[] }[];

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
    this.neutralAperture = (data.neutralAperture ?? []).map(aperture => ({
      blink: this.face.morphTargetDictionary![aperture.blink],
      face: this.face.morphTargetDictionary![aperture.target],
      lining: this.lining.morphTargetDictionary![aperture.target],
      shapes: aperture.shapes.map(shape => ({
        control: this.face.morphTargetDictionary![shape.control],
        face: this.face.morphTargetDictionary![shape.target],
        lining: this.lining.morphTargetDictionary![shape.target],
        limit: shape.limit ? this.face.morphTargetDictionary![shape.limit] : undefined,
      })),
    }));
    this.blinkClosure = (data.blinkClosure ?? []).map(group => ({
      blink: this.face.morphTargetDictionary![group.blink],
      shapes: group.shapes.map(shape => ({ control: this.face.morphTargetDictionary![shape.control], face: this.face.morphTargetDictionary![shape.target], lining: this.lining.morphTargetDictionary![shape.target], midpoint: shape.curve === 'midpoint' })),
    }));
    this.followers = (data.followers ?? []).map(name => {
      const mesh = rig.root.getObjectByName(name) as THREE.Mesh;
      return { mesh, shapes: Object.entries(mesh.morphTargetDictionary!).map(([key, target]) => ({ source: this.lining.morphTargetDictionary![key], target })) };
    });
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
    // A full blink closes the authored lid even when squint/gaze inputs remain.
    // The extra shapes preserve the new rest arc under combined controls.
    for (const aperture of this.neutralAperture) {
      const values = this.face.morphTargetInfluences!;
      const blink = THREE.MathUtils.clamp(values[aperture.blink], 0, 1);
      let sum = 0, greatest = 0;
      for (const shape of aperture.shapes) {
        const amount = THREE.MathUtils.clamp(values[shape.control], 0, 1);
        const active = Math.max(0, amount - (shape.limit === undefined ? 0 : values[shape.limit]));
        values[shape.face] = this.lining.morphTargetInfluences![shape.lining] = blink * active;
        sum += active; greatest = Math.max(greatest, amount);
      }
      values[aperture.face] = this.lining.morphTargetInfluences![aperture.lining] = (1 - blink) * Math.max(0, sum - greatest);
    }
    for (const { control, target } of this.shapes) {
      const amount = THREE.MathUtils.clamp(this.face.morphTargetInfluences![control], 0, 1);
      this.lining.morphTargetInfluences![target] = 4 * amount * (1 - amount);
    }
    // Preserve public expression inputs while the stored local corrective
    // removes their rim displacement as the blink reaches full closure.
    for (const group of this.blinkClosure) {
      const blink = THREE.MathUtils.clamp(this.face.morphTargetInfluences![group.blink], 0, 1);
      for (const shape of group.shapes) {
        const amount = THREE.MathUtils.clamp(this.face.morphTargetInfluences![shape.control], 0, 1);
        const weight = blink * (shape.midpoint ? 4 * amount * (1 - amount) : amount);
        this.face.morphTargetInfluences![shape.face] = this.lining.morphTargetInfluences![shape.lining] = weight;
      }
    }
    for (const { source, target } of this.sealShapes) this.seal!.morphTargetInfluences![target] = this.lining.morphTargetInfluences![source];
    for (const follower of this.followers) for (const { source, target } of follower.shapes) follower.mesh.morphTargetInfluences![target] = this.lining.morphTargetInfluences![source];
  }
}
