import * as THREE from 'three';
import { FILM_SETS, reloadedRoot, type ReloadedGesture, type Vector3 } from '@auto_matrix/shared';

export function reloadedCamera(gesture: ReloadedGesture, position: Vector3, set: string, firstPerson: boolean, aspect: number, yaw: number, pitch: number) {
  const origin = FILM_SETS[set].center; const ship = set === 'film_neb_deck';
  if (firstPerson) {
    const eye = new THREE.Vector3(position.x, position.y + (ship ? 2.2 : 2.9), position.z);
    const forward = new THREE.Vector3(Math.sin(yaw) * Math.cos(pitch), -Math.sin(pitch), Math.cos(yaw) * Math.cos(pitch));
    return { eye, target: eye.clone().add(forward) };
  }
  const portrait = aspect < .85; let eye: THREE.Vector3; let target: THREE.Vector3;
  if (gesture.kind === 'dream' || gesture.phase === 'departing') {
    const enemy = reloadedRoot(gesture, 'agent_johnson');
    const height = gesture.kind === 'dream' ? Math.max(0, origin.y + enemy.y - position.y) : 0;
    eye = new THREE.Vector3(position.x + (portrait ? 12 : 9), position.y + 5 + height * .48, position.z + (gesture.kind === 'dream' ? portrait ? -31 : -24 : 16));
    target = new THREE.Vector3(position.x, position.y + 2.1 + height * .46, position.z + (gesture.kind === 'dream' ? 1.5 : -3));
    return { eye, target };
  }
  if (ship && gesture.phase === 'waking') { eye = new THREE.Vector3(portrait ? 3 : 5, 5.1, 36); target = new THREE.Vector3(11.3, 2.3, 32); }
  else if (ship) { eye = new THREE.Vector3(portrait ? 2 : -.8, 5.6, 31.5); target = new THREE.Vector3(-8.7, 2.4, 24); }
  else if (gesture.phase === 'report') { eye = new THREE.Vector3(8, 6.4, portrait ? 5 : 10); target = new THREE.Vector3(0, 3, 22); }
  else if (gesture.phase === 'earpiece') { eye = new THREE.Vector3(4.5, 4.4, portrait ? -5.5 : -9); target = new THREE.Vector3(0, 2.8, -14.5); }
  else { eye = new THREE.Vector3(8, 5.9, portrait ? 7 : 2); target = new THREE.Vector3(0, 2.6, -14); }
  eye.add(new THREE.Vector3(origin.x, origin.y - 1, origin.z)); target.add(new THREE.Vector3(origin.x, origin.y - 1, origin.z));
  return { eye, target };
}
