import * as THREE from 'three';
import { FILM_SETS, TRINITY_TERMINAL, type TrinityTerminal } from '@auto_matrix/shared';
import type { CharacterRig } from './CharacterModel.js';
import { crosscutPalm } from './CrosscutPerformance.js';

/** Both hands use the same keyboard coordinates as the room and its collision data. */
export function poseTrinityTerminal(rig: CharacterRig, state?: TrinityTerminal): void {
  if (!rig.hero || !state || state.phase === 'ready') return;
  const b = rig.hero.bones;
  b.get('spine')!.rotation.x = .5; b.get('chest')!.rotation.x = .17; b.get('head')!.rotation.x = .08;
  rig.root.updateWorldMatrix(true, true);
  const center = FILM_SETS.film_backup_station.center, keyboard = TRINITY_TERMINAL.keyboard;
  const orientation = rig.root.getWorldQuaternion(new THREE.Quaternion()).multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), -Math.PI / 2));
  for (const side of ['R', 'L'] as const) {
    const sign = side === 'R' ? 1 : -1, typing = state.phase === 'typing';
    const tap = typing ? Math.sin(state.elapsed * 19 + sign) * .015 : 0;
    crosscutPalm(rig, side, new THREE.Vector3(center.x + keyboard.x + sign * .38, center.y - 1 + keyboard.y + .065 + tap, center.z + keyboard.z + .14), orientation);
    for (let finger = 1; finger <= 5; finger++) for (let segment = 1; segment <= 3; segment++) {
      b.get(`finger${finger}-${segment}_${side}`)!.rotation.z = sign * (finger === 1 ? .12 : .1 + (typing ? .08 * (1 + Math.sin(state.elapsed * 19 + finger * 2 + sign)) : .04));
    }
  }
  rig.root.updateWorldMatrix(true, true);
}
