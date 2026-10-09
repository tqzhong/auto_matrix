import * as THREE from 'three';
import { CATCH, catchFallClock, type CatchGesture } from '@auto_matrix/shared';
import type { CharacterRig } from './CharacterModel.js';
import { groundCharacter } from './GroundContact.js';
import { crosscutPalm } from './CrosscutPerformance.js';

const ease = (age: number, duration: number) => THREE.MathUtils.smoothstep(age, 0, duration);

function groundBody(rig: CharacterRig, settle: number): void {
  // A coat hem bends against the deck; it cannot hold the knees above it.
  const panels = rig.hero!.panels.map(panel => ({ panel, visible: panel.mesh.visible }));
  for (const { panel } of panels) panel.mesh.visible = false;
  groundCharacter(rig, settle);
  for (const { panel, visible } of panels) panel.mesh.visible = visible;
}

function fitCoat(rig: CharacterRig, settle: number): void {
  const hero = rig.hero!, floor = rig.root.getWorldPosition(new THREE.Vector3()).y + .035;
  rig.root.updateWorldMatrix(true, true); rig.root.updateMatrixWorld(true);
  const pelvis = hero.bones.get('pelvis')!, point = new THREE.Vector3();
  const legs = ['R', 'L'].flatMap(side => ['hip', 'knee'].map((part, index) => ({
    start: pelvis.worldToLocal(hero.bones.get(`${part}_${side}`)!.getWorldPosition(new THREE.Vector3())),
    end: pelvis.worldToLocal(hero.bones.get(`${index ? 'ankle' : 'knee'}_${side}`)!.getWorldPosition(new THREE.Vector3())), radius: index ? .17 : .21,
  })));
  for (const panel of hero.panels) {
    if (!panel.mesh.visible) continue;
    const position = panel.mesh.geometry.attributes.position;
    for (let i = 0; i < position.count; i++) {
      point.fromArray(panel.rest, i * 3).add(panel.mesh.position);
      if (panel.rest[i * 3 + 1] < -.08) for (const leg of legs) {
        const segment = leg.end.clone().sub(leg.start), along = THREE.MathUtils.clamp(point.clone().sub(leg.start).dot(segment) / segment.lengthSq(), 0, 1);
        const offset = point.clone().sub(leg.start.clone().addScaledVector(segment, along)), length = offset.length();
        if (length > .001 && length < leg.radius) point.addScaledVector(offset, (leg.radius - length) / length);
      }
      point.sub(panel.mesh.position);
      if (settle > .65) { panel.mesh.localToWorld(point); point.y = Math.max(floor, point.y); panel.mesh.worldToLocal(point); }
      position.setXYZ(i, point.x, point.y, point.z);
    }
    panel.velocity.fill(0); position.needsUpdate = true; panel.mesh.geometry.computeVertexNormals();
  }
}

/** Saved body poses use the shipped pelvis and limbs, so cold-loading does not depend on frame deltas. */
export function poseReloadedCatch(rig: CharacterRig, gesture?: CatchGesture): void {
  if (!gesture || !rig.hero) return;
  const hero = rig.hero, bone = (name: string) => hero.bones.get(name)!, pelvis = bone('pelvis');
  const catching = gesture.phase === 'catching', landing = gesture.phase === 'landing';
  const lowered = ['extract_ready', 'extracting', 'pulse', 'reviving', 'done'].includes(gesture.phase) || gesture.phase === 'failed' && gesture.checkpoint === 'pulse';
  const settle = landing ? ease(gesture.elapsed, CATCH.landing) : lowered ? 1 : 0;
  const fly = gesture.phase === 'flight' || gesture.phase === 'failed' && gesture.checkpoint === 'flight' ? 1 : gesture.phase === 'departing' ? ease(gesture.elapsed - .45, .6)
    : catching ? 1 - ease(gesture.elapsed, CATCH.catching) : 0;
  pelvis.position.copy(hero.rest.get('pelvis')!); pelvis.rotation.set(0, 0, 0);
  if (gesture.phase !== 'launch') { bone('spine').rotation.set(0, 0, 0); bone('chest').rotation.set(0, 0, 0); bone('head').rotation.set(0, 0, 0); }
  if (gesture.role === 'agent_thompson') {
    const impact = ease(catchFallClock(gesture) - 5.6, .45);
    pelvis.rotation.x = -.6 * (1 - impact) - Math.PI / 2 * impact;
    if (impact) pelvis.position.y = THREE.MathUtils.lerp(pelvis.position.y, .58, impact);
    bone('shoulder_R').rotation.set(-1.35, 0, .1); bone('elbow_R').rotation.set(-.2, 0, 0);
    if (impact >= 1) groundBody(rig, 1);
    return;
  }
  pelvis.rotation.x = (gesture.role === 'neo' ? 1.05 : -.95) * fly;
  if (gesture.role === 'trinity') {
    pelvis.rotation.x -= Math.PI / 2 * settle;
    pelvis.position.y = THREE.MathUtils.lerp(pelvis.position.y, .6, settle);
    for (const side of ['R', 'L'] as const) {
      bone(`shoulder_${side}`).rotation.set(.06 + fly * -.7, 0, (side === 'R' ? 1 : -1) * .13);
      bone(`elbow_${side}`).rotation.set(.16, 0, 0);
      bone(`hip_${side}`).rotation.set(side === 'R' ? -.04 : -.13, 0, 0); bone(`knee_${side}`).rotation.set(side === 'R' ? .18 : .36, 0, 0);
      bone(`ankle_${side}`).rotation.set(0, 0, 0);
    }
    bone('head').rotation.set(.08 * settle, 0, gesture.phase === 'reviving' || gesture.phase === 'done' ? -.08 : 0);
    bone('chest').rotation.set(gesture.phase === 'reviving' ? Math.sin(gesture.elapsed * 4) * .025 : 0, 0, 0);
  } else if (settle) {
    pelvis.position.y = THREE.MathUtils.lerp(pelvis.position.y, 1.18, settle);
    // Sit back over the heels: the eyes stay on Neo's side of the wound.
    // Leaning through the patient made the first-person camera look backward
    // into the sleeves, even with an otherwise correct chest target.
    pelvis.position.z -= .36 * settle;
    bone('spine').rotation.set(.9 * settle, 0, 0); bone('chest').rotation.set(.25 * settle, 0, 0); bone('head').rotation.set(-1.03 * settle, 0, 0);
    for (const side of ['R', 'L'] as const) {
      bone(`hip_${side}`).rotation.set(-1 * settle, 0, 0); bone(`knee_${side}`).rotation.set(2.98 * settle, 0, 0); bone(`ankle_${side}`).rotation.set(-1.23 * settle, 0, 0);
    }
  }
  rig.root.updateWorldMatrix(true, true);
  if (settle > .65) groundBody(rig, ease(settle - .65, .35));
  if (gesture.phase !== 'launch') fitCoat(rig, settle);
}

/** Reach actual Trinity bones after both models have been posed, without changing either saved root. */
export function poseReloadedCatchContact(neo: CharacterRig, trinity: CharacterRig, gesture: CatchGesture): void {
  if (!neo.hero || !trinity.hero) return;
  const holding = gesture.phase === 'ascent' ? 1 : gesture.phase === 'catching' ? ease(gesture.elapsed, CATCH.catching) : 0;
  const medical = ['extract_ready', 'extracting', 'pulse', 'reviving'].includes(gesture.phase);
  if (!holding && !medical) return;
  neo.root.updateWorldMatrix(true, true); trinity.root.updateWorldMatrix(true, true);
  const chest = trinity.hero.bones.get('chest')!;
  for (let pass = 0; pass < (medical ? 2 : 1); pass++) {
    for (const side of ['R', 'L'] as const) {
      const sign = side === 'R' ? 1 : -1;
      const target = chest.localToWorld(new THREE.Vector3(holding ? sign * .34 : side === 'R' ? -.02 : .23, holding ? .3 : .18, .3));
      if (medical && side === 'R' && gesture.phase === 'extracting') target.y += CATCH.extractionLift * gesture.focus / CATCH.extraction;
      const wrist = neo.hero.bones.get(`wrist_${side}`)!;
      const palm = wrist.localToWorld(new THREE.Vector3(0, -.19, .035));
      crosscutPalm(neo, side, palm.lerp(target, medical ? 1 : holding), chest.getWorldQuaternion(new THREE.Quaternion())
        .multiply(new THREE.Quaternion().setFromEuler(new THREE.Euler(Math.PI, 0, 0))));
    }
    neo.root.updateWorldMatrix(true, true);
    if (medical && pass === 0) groundBody(neo, 1);
  }
  if (medical) fitCoat(neo, 1);
}
