import * as THREE from 'three';
import { smithFinaleBeat, type SmithFinaleEncounter } from '@auto_matrix/shared';
import type { HeroRig } from './HeroModel.js';

export function smithFaceImpact(encounter: SmithFinaleEncounter): number {
  const beat = smithFinaleBeat(encounter);
  return beat.phase === 'pit_punch' ? THREE.MathUtils.smoothstep(beat.elapsed, .62, .8)
    * (1 - THREE.MathUtils.smoothstep(beat.elapsed, 1.02, 1.55)) : 0;
}

/** Head-local soft tissue displacement shared by the visible skin and fist target. */
export function compressSmithCheek(point: THREE.Vector3, amount: number): THREE.Vector3 {
  const radius = ((point.x + .11) / .12) ** 2 + ((point.y + .035) / .12) ** 2;
  const pressure = amount * (1 - THREE.MathUtils.smoothstep(radius, 0, 1))
    * THREE.MathUtils.smoothstep(point.z, .12, .25) * (1 - THREE.MathUtils.smoothstep(point.y, -.005, .07));
  point.x -= pressure * .014; point.y -= pressure * .008; point.z -= pressure * .055;
  return point;
}

/** A private morph for the principal Smith; the shared crowd/replica geometry stays untouched. */
export class SmithFaceImpact {
  private mesh: THREE.SkinnedMesh;
  private original: THREE.BufferGeometry;
  private geometry: THREE.BufferGeometry;
  private influences?: number[];
  private dictionary?: { [key: string]: number };

  constructor(rig: HeroRig) {
    this.mesh = rig.root.getObjectByName('Anatomical_head_and_hands') as THREE.SkinnedMesh;
    this.original = this.mesh.geometry;
    this.influences = this.mesh.morphTargetInfluences; this.dictionary = this.mesh.morphTargetDictionary;
    this.geometry = this.original.clone();
    const position = this.original.attributes.position, target = position.clone();
    const { skinIndex, skinWeight } = this.original.attributes;
    const head = this.mesh.skeleton.bones.indexOf(rig.bones.get('head')!);
    const toHead = this.mesh.skeleton.boneInverses[head].clone().multiply(this.mesh.bindMatrix), toMesh = toHead.clone().invert();
    const point = new THREE.Vector3();
    for (let i = 0; i < position.count; i++) {
      let weight = 0;
      for (let k = 0; k < 4; k++) if (skinIndex.getComponent(i, k) === head) weight += skinWeight.getComponent(i, k);
      if (weight < .99) continue;
      point.fromBufferAttribute(position, i).applyMatrix4(toHead);
      compressSmithCheek(point, 1).applyMatrix4(toMesh); target.setXYZ(i, point.x, point.y, point.z);
    }
    const surface = new THREE.BufferGeometry(); surface.setIndex(this.original.index); surface.setAttribute('position', position); surface.computeVertexNormals();
    const restingNormals = surface.getAttribute('normal').clone(), normals = this.original.attributes.normal.clone();
    surface.setAttribute('position', target); surface.computeVertexNormals();
    const deformedNormals = surface.getAttribute('normal'), change = new THREE.Vector3();
    // Preserve the artist's normals outside the impact; rebuilding the entire
    // head's shading would darken the untouched eye sockets and mouth seams.
    for (let i = 0; i < normals.count; i++) {
      point.fromBufferAttribute(normals, i);
      change.set(deformedNormals.getX(i) - restingNormals.getX(i), deformedNormals.getY(i) - restingNormals.getY(i),
        deformedNormals.getZ(i) - restingNormals.getZ(i));
      if (change.lengthSq() < 1e-10) continue;
      point.add(change).normalize(); normals.setXYZ(i, point.x, point.y, point.z);
    }
    target.name = 'smith-cheek-impact';
    this.geometry.morphAttributes.position = [target]; this.geometry.morphAttributes.normal = [normals];
    this.geometry.morphTargetsRelative = false; surface.dispose();
    this.mesh.geometry = this.geometry; this.mesh.updateMorphTargets();
  }

  update(encounter: SmithFinaleEncounter): void {
    this.mesh.morphTargetInfluences![0] = smithFaceImpact(encounter);
  }

  dispose(): void {
    this.mesh.geometry = this.original; this.mesh.morphTargetInfluences = this.influences; this.mesh.morphTargetDictionary = this.dictionary;
    this.geometry.dispose();
  }
}
