import * as THREE from 'three';
import { DOCK_BRIEFING, type DockBriefingGesture } from '@auto_matrix/shared';
import type { CharacterRig } from './CharacterModel.js';
import { reach } from './SpoonPerformance.js';

/** Small speaking gestures use the saved line age, so a paused scene keeps its pose. */
export function poseDockBriefing(rig: CharacterRig, gesture?: DockBriefingGesture): void {
  if (!gesture) return;
  const { role, phase, elapsed } = gesture;
  const escorting = role !== 'niobe' && role !== 'lock' && phase === 'walking' && gesture.escort > 0 && gesture.escort < DOCK_BRIEFING.escortSeconds;
  const hero = rig.hero, head = hero?.bones.get('head') ?? rig.head;
  if (escorting || role === 'niobe' && ['walking', 'reply', 'reflection', 'return', 'done'].includes(phase)) return;
  const speaker = role === 'lock' && ['greeting', 'warning'].includes(phase) || role === 'roland' && phase === 'roland' || role === 'niobe' && phase === 'answer';
  const length = phase === 'warning' ? 7 : phase === 'greeting' ? 4.8 : phase === 'roland' ? 3.4 : 2.4;
  const movement = speaker ? Math.sin(Math.min(1, elapsed / length) * Math.PI) : 0;
  rig.detail.position.set(0, 0, 0); rig.detail.rotation.set(0, 0, 0);
  head.rotation.set(.06 + movement * .06 * Math.sin(elapsed * 3.2), 0, 0);
  const rotation = rig.root.getWorldQuaternion(new THREE.Quaternion());
  rig.root.updateMatrixWorld(true);
  for (let i = 0; i < 2; i++) {
    const side = i ? 'L' : 'R', sign = i ? 1 : -1;
    const speaking = i === 0 ? movement : 0;
    const hand = rig.root.localToWorld(new THREE.Vector3(sign * (.64 + speaking * .04), 1.84 + speaking * .64, .10 + speaking * .44));
    if (hero) {
      const shoulder = hero.bones.get(`shoulder_${side}`)!, elbow = hero.bones.get(`elbow_${side}`)!, wrist = hero.bones.get(`wrist_${side}`)!;
      reach(shoulder, elbow, wrist.position, hand.sub(new THREE.Vector3(i ? -.13 : .13, -.18, .02).applyQuaternion(rotation)),
        new THREE.Vector3(sign * .9, -.4, -.3).applyQuaternion(rotation));
      wrist.quaternion.copy(elbow.getWorldQuaternion(new THREE.Quaternion()).invert().multiply(rotation));
      for (let finger = 1; finger <= 5; finger++) for (let joint = 1; joint <= 3; joint++)
        hero.bones.get(`finger${finger}-${joint}_${side}`)!.rotation.set(0, 0, sign * -.12);
    } else {
      reach(rig.shoulders[i], rig.elbows[i], new THREE.Vector3(0, -.79, .055), hand,
        new THREE.Vector3(sign * .9, -.4, -.3).applyQuaternion(rotation));
      rig.fingers[i].forEach(finger => { finger.rotation.x = -.1; });
    }
  }
  rig.root.updateMatrixWorld(true);
}
