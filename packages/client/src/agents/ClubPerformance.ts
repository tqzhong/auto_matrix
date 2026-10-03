import * as THREE from 'three';
import { CLUB, FILM_SETS, clubCloseness, type ClubEncounter } from '@auto_matrix/shared';
import type { HeroRig } from './HeroModel.js';
import { reach } from './SpoonPerformance.js';

function contact(root: { x: number; z: number; yaw: number }, x: number, z: number, floor: number): THREE.Vector3 {
  const center = FILM_SETS.film_white_rabbit_club.center;
  return new THREE.Vector3(center.x + root.x + x * Math.cos(root.yaw) + z * Math.sin(root.yaw), floor,
    center.z + root.z - x * Math.sin(root.yaw) + z * Math.cos(root.yaw));
}

/** The saved whisper clock drives two steps; the supporting foot stays on the floor. */
export function poseClub(neo: HeroRig | undefined, trinity: HeroRig | undefined, encounter?: ClubEncounter): void {
  if (!encounter || ['crowd', 'approaching', 'done'].includes(encounter.phase)
    || encounter.phase === 'departing' && encounter.elapsed > 1.5 || encounter.phase === 'introduction' && encounter.elapsed < 1.5) return;
  const close = clubCloseness(encounter), smooth = THREE.MathUtils.smoothstep;
  const stepTime = encounter.phase === 'whisper' ? encounter.elapsed : encounter.phase === 'departing' ? 1.8 * (1 - encounter.elapsed / 1.5) : close ? 1.8 : 0;
  for (const [role, rig] of [['neo', neo], ['trinity', trinity]] as const) {
    if (!rig) continue;
    const bone = (name: string) => rig.bones.get(name)!, pelvis = bone('pelvis');
    pelvis.position.copy(rig.rest.get('pelvis')!); pelvis.rotation.set(0, 0, 0);
    if (role === 'neo') {
      pelvis.position.y -= .11 * close;
      bone('spine').rotation.set(.12 * close, 0, -.075 * close);
      bone('chest').rotation.set(.1 * close, .08 * close, -.075 * close);
      bone('head').rotation.set(.04 * close, .6 * close, .05 * close);
    } else {
      pelvis.position.y -= .13 * Math.sin(close * Math.PI);
      bone('spine').rotation.set(.07 * close, 0, 0); bone('chest').rotation.set(.1 * close, 0, 0);
      const emphasis = ['introduction', 'reply'].includes(encounter.phase) ? Math.sin(Math.min(1, encounter.elapsed / 6) * Math.PI) : 0;
      bone('head').rotation.set(-.18 * close + Math.sin(encounter.elapsed * 2) * .025 * emphasis, .23 * close, .06 * close);
    }
    rig.root.updateWorldMatrix(true, true);
    const floor = FILM_SETS.film_white_rabbit_club.center.y - 1 + rig.footHeight + .025;
    for (const [i, side] of ['R', 'L'].entries()) {
      const hip = bone(`hip_${side}`), knee = bone(`knee_${side}`), ankle = bone(`ankle_${side}`);
      const sign = i ? 1 : -1;
      let target = contact(CLUB.neo, sign * .276, .035, floor), yaw: number = CLUB.neo.yaw;
      if (role === 'trinity') {
        const step = smooth(stepTime, i ? .65 : .08, i ? 1.75 : .95);
        target = contact(CLUB.trinity, sign * .252, .035, floor).lerp(contact({ x: CLUB.trinity.x - .72, z: CLUB.trinity.z + 1.77, yaw: .64 }, i ? .22 : -.27, i ? -.28 : -.035, floor), step);
        target.y += Math.sin(step * Math.PI) * .15; yaw = .64 * step;
      }
      const rotation = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), yaw);
      reach(hip, knee, ankle.position, target, new THREE.Vector3(sign * .2, .1, 1).applyQuaternion(rotation));
      ankle.quaternion.copy(knee.getWorldQuaternion(new THREE.Quaternion()).invert().multiply(rotation)); ankle.updateWorldMatrix(false, true);
    }
  }
}
