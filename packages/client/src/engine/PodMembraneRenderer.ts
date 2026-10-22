import * as THREE from 'three';
import { podEmergencePose, type FilmJourney } from '@auto_matrix/shared';

/** Two continuous wet sheets remain attached to the rim as Neo tears their seam. */
export class PodMembraneRenderer {
  private root = new THREE.Group();
  private material = new THREE.MeshPhysicalMaterial({ color: 0x91b2b5, roughness: .19, clearcoat: 1,
    transparent: true, opacity: .5, depthWrite: false, side: THREE.DoubleSide });
  private sheets: THREE.Mesh[] = [];
  private last: number[] = [];
  private rows = 48;
  private columns = 16;

  constructor(parent: THREE.Group) {
    this.root.name = 'pod-membrane'; this.root.visible = false; parent.add(this.root);
    for (const side of [-1, 1]) {
      const geometry = new THREE.BufferGeometry(), indices: number[] = [];
      geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array((this.rows + 1) * (this.columns + 1) * 3), 3).setUsage(THREE.DynamicDrawUsage));
      for (let row = 0; row < this.rows; row++) for (let col = 0; col < this.columns; col++) {
        const a = row * (this.columns + 1) + col;
        indices.push(a, a + this.columns + 1, a + 1, a + 1, a + this.columns + 1, a + this.columns + 2);
      }
      geometry.setIndex(indices);
      const sheet = new THREE.Mesh(geometry, this.material); sheet.name = `pod-membrane-${side}`;
      sheet.userData.side = side; sheet.receiveShadow = true; this.root.add(sheet); this.sheets.push(sheet);
    }
  }

  update(journey: FilmJourney | undefined, body?: THREE.Object3D): void {
    const beat = journey?.awakening;
    this.root.visible = journey?.scene === 'm1_pod' && !journey.visiting && (!beat || beat.kind === 'emerge'
      || beat.emerged === true && (beat.kind === 'breather' || beat.kind === 'disconnect' && beat.elapsed < 4));
    if (!this.root.visible) return;
    this.root.updateWorldMatrix(true, false);
    const elapsed = !beat || beat.kind === 'emerge' ? beat?.elapsed ?? 0 : 5.2, pose = podEmergencePose(elapsed);
    const local = (name: string, offset: THREE.Vector3, fallback: THREE.Vector3) => {
      const bone = body?.getObjectByName(name);
      return bone ? this.root.worldToLocal(bone.localToWorld(offset)) : fallback;
    };
    const head = local('head', new THREE.Vector3(0, .1, .32), new THREE.Vector3(0, 2.34, -14.93));
    const hands = [-1, 1].map(sign => beat && beat.kind !== 'emerge' ? new THREE.Vector3(sign * 1.53829644, 2.16, -13.4)
      : local(`wrist_${sign < 0 ? 'R' : 'L'}`, new THREE.Vector3(-sign * .09, -.18, .15), new THREE.Vector3(sign * .62, 2.5, -14.5)));
    const signature = [elapsed, ...head.toArray(), ...hands.flatMap(hand => hand.toArray())];
    if (signature.length === this.last.length && signature.every((value, i) => Math.abs(value - this.last[i]) < 1e-8)) return;
    this.last = signature;
    for (const sheet of this.sheets) {
      const side = sheet.userData.side as number, hand = hands[side < 0 ? 0 : 1];
      const position = sheet.geometry.getAttribute('position');
      for (let row = 0; row <= this.rows; row++) {
        const v = row / this.rows * 2 - 1, z = -12.8 + v * 3.3;
        const width = 1.75 * Math.sqrt(Math.max(0, 1 - v * v)) * (.84 - .16 * v);
        const headZone = Math.exp(-(((z - head.z) / 1.9) ** 4));
        const handZone = Math.exp(-(((z - hand.z) / 1.2) ** 4));
        const tear = pose.tear * Math.max(.8 * headZone, Math.abs(hand.x) * .83 * handZone);
        const gap = Math.min(width * .94, tear + pose.clear * width * .48);
        for (let col = 0; col <= this.columns; col++) {
          const u = col / this.columns, edge = (1 - u) ** 2;
          const x = side * (gap + (width - gap) * u + .025 * pose.tear * Math.sin(row * 2.3) * edge);
          const arch = .7 * (1 - u) * (1 - v * v) * (1 - pose.tear);
          const crown = head.y + .23 - x * x * 1.4 - (z - head.z) ** 2 * .7;
          const stretch = Math.max(2.16 + arch, crown * (1 - pose.tear) + 2.16 * pose.tear);
          const wrinkle = Math.sin(row * 1.7 + u * 14) * .035 * edge * (pose.press + pose.tear);
          let y = 2.16 + (stretch - 2.16) * Math.sin(Math.PI * .5 * (1 - u)) + wrinkle - .12 * pose.clear * edge;
          // A broad contact patch covers the actual palm and fingers, while the outer seam stays on the rim.
          const contact = Math.exp(-(((x - hand.x) / .48) ** 8) - (((z - hand.z) / .8) ** 8));
          y += Math.max(0, hand.y + .05 - y) * contact * pose.reach * Math.min(1, Math.max(0, width - Math.abs(x)) / .16);
          position.setXYZ(row * (this.columns + 1) + col, x, y, z);
        }
      }
      position.needsUpdate = true; sheet.geometry.computeVertexNormals(); sheet.geometry.computeBoundingSphere();
    }
  }

  dispose(): void {
    this.root.removeFromParent(); this.sheets.forEach(sheet => sheet.geometry.dispose()); this.material.dispose();
  }
}
