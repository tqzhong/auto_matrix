import * as THREE from 'three';
import { FILM_SETS, SOURCE_PORTAL, sourcePortalAngle, type SourcePortalGesture } from '@auto_matrix/shared';
import type { CharacterRig } from './CharacterModel.js';
import { crosscutPalm } from './CrosscutPerformance.js';
import { reach } from './SpoonPerformance.js';

export class SourcePortalProps {
  readonly key = new THREE.Group();
  private geometry: THREE.BufferGeometry[] = [];
  private material = new THREE.MeshStandardMaterial({ color: 0xab9564, metalness: .8, roughness: .3 });
  constructor(parent: THREE.Group) {
    this.key.name = 'source-neck-key'; parent.add(this.key);
    const bow = new THREE.TorusGeometry(.07, .017, 8, 20); this.geometry.push(bow); this.key.add(new THREE.Mesh(bow, this.material));
    const shaft = new THREE.BoxGeometry(.026, .22, .026); this.geometry.push(shaft);
    const stem = new THREE.Mesh(shaft, this.material); stem.position.y = -.16; this.key.add(stem);
    const bit = new THREE.BoxGeometry(.08, .03, .026); this.geometry.push(bit);
    for (const y of [-.2, -.25]) { const tooth = new THREE.Mesh(bit, this.material); tooth.position.set(.025, y, 0); this.key.add(tooth); }
  }
  dispose(): void { this.key.removeFromParent(); this.geometry.forEach(g => g.dispose()); this.material.dispose(); }
}

export function sourceKeyContact(): THREE.Vector3 {
  const c = FILM_SETS.film_source_corridor.center; return new THREE.Vector3(c.x + .35, c.y - 1 + 1.25, c.z - 43.45);
}
export function poseSourcePortal(rig: CharacterRig, state?: SourcePortalGesture): void {
  const props = rig.sourcePortalProps;
  if (props) props.key.visible = Boolean(state && state.role === 'keymaker' && !['key_taken', 'entering', 'done', 'failed'].includes(state.phase)
    && !(state.phase === 'taking' && state.elapsed >= .9) || state?.role === 'neo' && (state.phase === 'taking' && state.elapsed >= .9 || state.phase === 'entering'));
  if (!state) return;
  const p = state.phase, c = FILM_SETS.film_source_corridor.center;
  const wounded = ['wounded', 'listening', 'offering', 'key_ready', 'taking', 'key_taken', 'entering', 'done'].includes(p);
  if (state.role === 'keymaker' && !rig.hero && wounded) {
    const resting = ['key_taken', 'entering', 'done'].includes(p);
    rig.detail.position.set(0, .16, 0); rig.detail.rotation.set(-1.23, 0, 0);
    rig.torso.position.set(0, 1.91, 0); rig.torso.rotation.set(.04, 0, 0); rig.head.rotation.set(.23, 0, 0);
    for (let i = 0; i < 2; i++) {
      rig.hips[i].position.set((i ? 1 : -1) * .225, 1.91, 0); rig.hips[i].rotation.set(-.13, 0, 0);
      rig.knees[i].rotation.set(.16, 0, 0); rig.ankles[i].rotation.set(0, 0, 0);
      rig.shoulders[i].rotation.set(.18, 0, (i ? 1 : -1) * .08); rig.elbows[i].rotation.set(.08, 0, 0);
    }
    rig.root.updateWorldMatrix(true, true);
    const hand = ['offering', 'key_ready', 'taking'].includes(p) ? sourceKeyContact() : rig.head.localToWorld(new THREE.Vector3(.2, -.65, .32));
    const blend = p === 'offering' ? THREE.MathUtils.smoothstep(state.elapsed, 0, SOURCE_PORTAL.offeringSeconds) : 1;
    const rest = rig.elbows[1].localToWorld(new THREE.Vector3(0, -.79, .055)); hand.lerpVectors(rest, hand, blend);
    if (!resting) reach(rig.shoulders[1], rig.elbows[1], new THREE.Vector3(0, -.79, .055), hand, new THREE.Vector3(.3, .6, .4));
    if (props) { props.key.position.copy(rig.detail.worldToLocal(hand.clone())); props.key.rotation.set(0, 0, .4); }
    rig.fingers[1].forEach(f => { f.rotation.x = -.65; });
  } else if (state.role === 'neo' && rig.hero) {
    const b = rig.hero.bones;
    if (['listening', 'offering', 'key_ready', 'taking'].includes(p)) {
      b.get('pelvis')!.position.y = 1.05; b.get('spine')!.rotation.x = .12; b.get('head')!.rotation.x = .26;
      rig.root.updateWorldMatrix(true, true);
      const rotation = rig.root.getWorldQuaternion(new THREE.Quaternion());
      for (const side of ['R', 'L'] as const) {
        const sign = side === 'R' ? 1 : -1, hip = b.get(`hip_${side}`)!, knee = b.get(`knee_${side}`)!, ankle = b.get(`ankle_${side}`)!;
        const foot = rig.hero.root.localToWorld(new THREE.Vector3(sign * .4, rig.hero.footHeight + .18, side === 'R' ? .78 : -.45));
        reach(hip, knee, ankle.position, foot, new THREE.Vector3(sign * .5, .25, 1).applyQuaternion(rotation));
        ankle.quaternion.copy(knee.getWorldQuaternion(new THREE.Quaternion()).invert().multiply(rotation));
      }
      if (p === 'taking') {
        const wrist = b.get('wrist_R')!, rest = wrist.localToWorld(new THREE.Vector3(0, -.19, .035));
        const hand = rest.lerp(sourceKeyContact(), THREE.MathUtils.smoothstep(state.elapsed, 0, .85));
        crosscutPalm(rig, 'R', hand);
      }
      // The delivered coat tails attach to the pelvis. Fold their lower
      // vertices onto the floor instead of lifting Neo away from the key.
      rig.root.updateWorldMatrix(true, true);
      const floor = rig.root.getWorldPosition(new THREE.Vector3()).y + .07;
      for (const panel of rig.hero.panels) {
        const position = panel.mesh.geometry.attributes.position, vertex = new THREE.Vector3();
        let changed = false;
        for (let i = 0; i < position.count; i++) {
          vertex.fromBufferAttribute(position, i); panel.mesh.localToWorld(vertex);
          if (vertex.y >= floor) continue;
          vertex.y = floor; panel.mesh.worldToLocal(vertex); position.setXYZ(i, vertex.x, vertex.y, vertex.z); changed = true;
        }
        if (changed) { position.needsUpdate = true; panel.mesh.geometry.computeVertexNormals(); panel.mesh.geometry.computeBoundingSphere(); }
      }
    } else if (p === 'opening' && state.elapsed < .65 || p === 'sealing') {
      const angle = sourcePortalAngle({ portalOpened: true, keyTaken: false, performance: state });
      const hand = new THREE.Vector3(c.x - 3.4 + 5.05 * Math.cos(angle), c.y - 1 + 3.05, c.z - 39 - 5.05 * Math.sin(angle));
      // Early contact unlocks the door; the hand releases as the leaf swings clear.
      if (p === 'opening') crosscutPalm(rig, 'R', hand);
      else { b.get('shoulder_L')!.rotation.x = -1.1; b.get('elbow_L')!.rotation.x = -.8; }
    } else if (p === 'entering' && state.elapsed < .35) {
      crosscutPalm(rig, 'R', new THREE.Vector3(c.x + .95, c.y - 1 + 3.05, c.z - 54.3));
    }
    if (props && props.key.visible) {
      const hand = b.get('wrist_R')!.localToWorld(new THREE.Vector3(0, -.19, .035)); props.key.position.copy(rig.detail.worldToLocal(hand)); props.key.rotation.z = -.6;
    }
  } else if (props && state.role === 'keymaker') { props.key.position.set(0, 3.48, .27); props.key.rotation.set(0, 0, 0); }
  rig.root.updateWorldMatrix(true, true);
}
