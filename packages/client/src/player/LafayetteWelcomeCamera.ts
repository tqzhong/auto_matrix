import * as THREE from 'three';
import { lafayetteWelcomeRoot, type LafayetteWelcomeGesture } from '@auto_matrix/shared';

export interface LafayetteWelcomeShot {
  name: 'approach' | 'handshake' | 'trinity-exit' | 'morpheus-seat';
  ideal: THREE.Vector3;
  focus: THREE.Vector3;
}

export function lafayetteWelcomeCamera(gesture: LafayetteWelcomeGesture): LafayetteWelcomeShot {
  const neo = lafayetteWelcomeRoot(gesture, 'neo'); const morpheus = lafayetteWelcomeRoot(gesture, 'morpheus');
  if (gesture.phase === 'approach') {
    const closer = THREE.MathUtils.smoothstep(gesture.elapsed, 2.6, 6.5);
    return { name: 'approach', ideal: new THREE.Vector3(1.5, 7.2, 22).lerp(new THREE.Vector3(6.2, 4.8, 9), closer),
      focus: new THREE.Vector3((neo.x + morpheus.x) / 2, 2.45, (neo.z + morpheus.z) / 2) };
  }
  if (gesture.phase === 'ready' || gesture.phase === 'handshake') {
    const hands = gesture.phase === 'handshake' ? THREE.MathUtils.smoothstep(gesture.elapsed, .2, 1.05) : 0;
    return { name: 'handshake', ideal: new THREE.Vector3(6.2, 4.65, 8.2).lerp(new THREE.Vector3(4.5, 3.65, 4.8), hands),
      focus: new THREE.Vector3(1.5, 2.45, 0) };
  }
  if (gesture.phase === 'departing' && gesture.elapsed < 3.65) {
    const trinity = lafayetteWelcomeRoot(gesture, 'trinity');
    return { name: 'trinity-exit', ideal: new THREE.Vector3(2, 4.4, 16.5), focus: new THREE.Vector3(trinity.x, 2.35, trinity.z) };
  }
  return { name: 'morpheus-seat', ideal: new THREE.Vector3(6.8, 5.1, 1.2), focus: new THREE.Vector3(morpheus.x, 2.2, morpheus.z) };
}
