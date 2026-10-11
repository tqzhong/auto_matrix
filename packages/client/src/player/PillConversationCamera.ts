import * as THREE from 'three';
import { PILL_ROOM, pillTalkCue, type PillGesture } from '@auto_matrix/shared';

export function pillConversationCamera(gesture: PillGesture, aspect: number) {
  const speaker = pillTalkCue(gesture).speaker;
  const side = speaker === 'morpheus' ? -1 : 1;
  const focus = new THREE.Vector3(side * PILL_ROOM.seat, 3.15, PILL_ROOM.z);
  const offset = new THREE.Vector3(-side * 3.5, .1, 1.55).multiplyScalar(Math.max(1, .85 / aspect));
  return { speaker, focus, ideal: focus.clone().add(offset) };
}
