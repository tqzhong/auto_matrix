import * as THREE from 'three';
import { RELOADED_FINALE, SENTINEL_SIGNAL, type TunnelEncounter } from '@auto_matrix/shared';
import type { CharacterRig } from './CharacterModel.js';
import { groundCharacter } from './GroundContact.js';
import { reach } from './SpoonPerformance.js';

/** Saved, continuous palm extension, loss of balance and a supported body. */
export function poseSentinelSignal(rig: CharacterRig, signal?: TunnelEncounter): void {
  if (!signal || !rig.hero) return;
  const hero = rig.hero, bone = (name: string) => hero.bones.get(name)!, pelvis = bone('pelvis');
  const elapsed = signal.phase === 'collapsed' ? SENTINEL_SIGNAL.collapseSeconds : signal.phase === 'collapsing' ? signal.elapsed ?? 0 : 0;
  const down = THREE.MathUtils.smoothstep(elapsed, .65, 2.7), buckle = Math.sin(Math.PI * THREE.MathUtils.smoothstep(elapsed, 0, 2.7));
  const palm = (signal.phase === 'stopping' || signal.phase === 'collapsing' ? 1 : signal.phase === 'sensing' ? Math.min(1, signal.focus / RELOADED_FINALE.signalSeconds) : 0)
    * (1 - THREE.MathUtils.smoothstep(elapsed, 0, .8));
  pelvis.position.copy(hero.rest.get('pelvis')!); pelvis.position.z = .4 * down;
  pelvis.position.y -= .6 * buckle; pelvis.rotation.set(-Math.PI / 2 * down, 0, -.18 * buckle);
  bone('spine').rotation.set(.14 * buckle, 0, 0); bone('chest').rotation.set(.08 * buckle, 0, 0);
  bone('head').rotation.set(.27 * buckle + .05 * down, .08 * down, 0);
  for (const side of ['R', 'L'] as const) {
    bone(`hip_${side}`).rotation.set(-.5 * buckle, 0, 0); bone(`knee_${side}`).rotation.set(.85 * buckle, 0, 0);
    bone(`ankle_${side}`).rotation.set(-.12 * buckle, 0, 0);
    bone(`shoulder_${side}`).rotation.set(.03, 0, (side === 'R' ? -1 : 1) * (.14 + .13 * down));
    bone(`elbow_${side}`).rotation.set(.08 * (1 - down), 0, 0); bone(`wrist_${side}`).quaternion.identity();
    for (let finger = 1; finger <= 5; finger++) for (let joint = 1; joint <= 3; joint++)
      bone(`finger${finger}-${joint}_${side}`).rotation.set(0, 0, (side === 'R' ? 1 : -1) * .06);
  }
  rig.root.updateWorldMatrix(true, true);
  if (palm > 0) {
    const wrist = bone('wrist_R'), elbow = bone('elbow_R'), rotation = rig.root.getWorldQuaternion(new THREE.Quaternion());
    const orientation = rotation.clone().multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), Math.PI));
    const target = rig.root.localToWorld(new THREE.Vector3(-.62, 3.05, 1.6));
    const head = bone('head'), localEye = head.userData.cameraEye as THREE.Vector3 | undefined;
    target.y = head.localToWorld(localEye?.clone() ?? new THREE.Vector3(0, .1, .32)).y - .2;
    const current = wrist.getWorldPosition(new THREE.Vector3()); target.lerp(current, 1 - palm);
    reach(bone('shoulder_R'), elbow, wrist.position, target, new THREE.Vector3(1, -.8, .2).applyQuaternion(rotation));
    wrist.quaternion.copy(elbow.getWorldQuaternion(new THREE.Quaternion()).invert().multiply(orientation));
    bone('finger1-1_R').rotation.z = -.3; wrist.updateWorldMatrix(false, true);
  }
  groundCharacter(rig, down);
}
