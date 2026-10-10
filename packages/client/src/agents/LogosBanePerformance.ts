import * as THREE from 'three';
import { LOGOS_BANE, FILM_SETS, logosBaneBeat, logosBaneRoot, logosBaneSpeaker, logosBaneHandle, type LogosBaneGesture } from '@auto_matrix/shared';
import type { CharacterRig } from './CharacterModel.js';
import { reach } from './SpoonPerformance.js';

/** Physical actions follow the saved encounter clocks, including pauses/reloads. */
export function poseLogosBane(rig: CharacterRig, gesture?: LogosBaneGesture): void {
  if (!gesture) {
    if (rig.detail.userData.logosBanePose) {
      delete rig.detail.userData.logosBanePose;
      rig.mobilWrists?.forEach(wrist => { wrist.quaternion.identity(); delete wrist.userData.logosBanePalm; });
      for (const side of ['R', 'L']) if (rig.hero) delete rig.hero.bones.get('wrist_' + side)!.userData.logosBanePalm;
    }
    return;
  }
  rig.detail.userData.logosBanePose = true;
  const { encounter, role } = gesture, state = encounter.physical, beat = logosBaneBeat(encounter);
  if (!state) return;
  const hero = rig.hero, clock = state.intro !== 'done' ? state.elapsed : state.rescue !== 'waiting' ? state.rescueElapsed : encounter.elapsed;
  const bone = (part: string, index: number) => hero?.bones.get(`${part}_${index ? 'L' : 'R'}`);
  const speaker = logosBaneSpeaker(encounter), speaking = speaker === role ? Math.sin(clock % LOGOS_BANE.lineSeconds / LOGOS_BANE.lineSeconds * Math.PI) : 0;
  const hostage = ['waiting', 'hostage', 'lower_ready', 'lowering'].includes(beat);
  const lowering = role === 'neo' && beat === 'lowering' || role === 'bane' && beat === 'taking';
  const lowerClock = role === 'neo' ? clock : clock - (LOGOS_BANE.takeSeconds - 1.4);
  const bend = role === 'neo' && beat === 'opening' ? .9 * THREE.MathUtils.smoothstep(clock, 0, .55) * (1 - THREE.MathUtils.smoothstep(clock, 1.1, 1.7))
    : lowering ? THREE.MathUtils.smoothstep(lowerClock, 0, .7) * (1 - THREE.MathUtils.smoothstep(lowerClock, role === 'neo' ? 1.7 : 1, role === 'neo' ? 2.4 : 1.4)) : 0;
  const dodge = role === 'neo' && state.dodge ? Math.sin(state.dodge.elapsed / LOGOS_BANE.dodgeSeconds * Math.PI) : 0;
  const strike = state.strike, attack = strike ? Math.sin(Math.min(1, strike.elapsed / (strike.kind === 'punch' ? LOGOS_BANE.punchSeconds : LOGOS_BANE.pipeSeconds)) * Math.PI) : 0;
  const burning = encounter.phase === 'burning' ? THREE.MathUtils.smoothstep(encounter.elapsed, 0, .55) : 0;
  const falling = role === 'bane' && encounter.phase === 'defeated' ? THREE.MathUtils.smoothstep(state.fall, 0, 1.2) : 0;
  const climbing = role === 'trinity' && beat === 'climbing', climbRoot = climbing ? logosBaneRoot(encounter, 'trinity') : undefined;
  const exit = climbing ? THREE.MathUtils.smoothstep(clock, LOGOS_BANE.climbSeconds - 1, LOGOS_BANE.climbSeconds) : 0;
  const crouch = climbRoot ? THREE.MathUtils.smoothstep(climbRoot.y, -2.4, -.8) * (1 - exit) : 0;
  const moving = role === 'bane' && ['taking', 'recognition'].includes(beat) || role === 'trinity' && ['dropping', 'climbing'].includes(beat);
  const arrival = beat === 'taking' ? LOGOS_BANE.takeSeconds - 1.2 : LOGOS_BANE.walkSeconds;
  const gait = moving ? Math.sin(clock * 8) * (role === 'bane' ? 1 - THREE.MathUtils.smoothstep(clock, arrival - .5, arrival) : 1) : 0;
  const pelvis = hero?.bones.get('pelvis');
  if (pelvis) {
    pelvis.position.y -= (lowering ? 1.45 : 1.18) * bend + .32 * dodge + 1.3 * crouch;
    hero!.bones.get('spine')!.rotation.x += (lowering ? 1.1 : .5) * bend + .12 * burning + .9 * crouch;
    if (lowering) hero!.bones.get('chest')!.rotation.x += .35 * bend;
  }
  else { rig.torso.position.y -= (lowering ? 1.45 : 1.18) * bend + .32 * dodge + 1.3 * crouch; rig.torso.rotation.x += .5 * bend + .15 * burning + .9 * crouch; rig.hips.forEach(hip => { hip.position.y -= (lowering ? 1.45 : 1.18) * bend + .32 * dodge + 1.3 * crouch; }); }
  const head = hero?.bones.get('head') ?? rig.head;
  head.rotation.x = .3 * bend - .18 * burning + speaking * .025 * Math.sin(clock * 1.6);
  if (falling) { rig.root.rotation.x = -Math.PI / 2 * falling; rig.root.rotation.z = 0; rig.root.position.y += .54 * falling; }
  rig.root.updateWorldMatrix(true, true);
  const orientation = rig.root.getWorldQuaternion(new THREE.Quaternion());
  const ladderContact = (i: number, hand: boolean) => {
    const ladder = LOGOS_BANE.ladder, center = FILM_SETS.film_logos_deck.center;
    const height = climbRoot!.y + (hand ? 2.7 - 1.3 * crouch : hero?.footHeight ?? .16) + (i ? ladder.gap / 2 : 0);
    const step = Math.max(0, Math.min(ladder.count - 1, (height - ladder.bottom) / ladder.gap)), index = Math.floor(step);
    const travel = THREE.MathUtils.smoothstep(step - index, .55, 1);
    return new THREE.Vector3(center.x + ladder.x + (i ? 1 : -1) * (hand ? .46 : .25),
      center.y - 1 + ladder.bottom + (index + travel) * ladder.gap + (hand ? 0 : .03 + (hero?.footHeight ?? .16)),
      center.z + ladder.z - (hand ? .085 : .18) - Math.sin(travel * Math.PI) * (hand ? .12 : .15));
  };
  for (let i = 0; i < 2; i++) {
    const sign = i ? 1 : -1, upper = bone('hip', i) ?? rig.hips[i], lower = bone('knee', i) ?? rig.knees[i], ankle = bone('ankle', i) ?? rig.ankles[i];
    const stride = gait * (i ? 1 : -1);
    const foot = new THREE.Vector3(sign * (.24 + dodge * .18), (hero?.footHeight ?? .16) + Math.max(0, stride) * .15, -.18 + stride * .4 + (i ? -.22 : .20) * (bend + attack));
    if (role === 'bane' && lowering) foot.z = THREE.MathUtils.lerp(foot.z, i ? .36 : .18, bend);
    let target = rig.root.localToWorld(foot);
    if (climbing && clock > .45) {
      target = ladderContact(i, false);
      if (i) {
        const center = FILM_SETS.film_logos_deck.center, h = LOGOS_BANE.hatch;
        const deck = new THREE.Vector3(center.x + h.x + h.width / 2 + .22, center.y - 1 + (hero?.footHeight ?? .16), center.z + LOGOS_BANE.ladder.z - .25);
        target.lerp(deck, THREE.MathUtils.smoothstep(exit, 0, .35)).lerp(rig.root.localToWorld(foot), THREE.MathUtils.smoothstep(exit, .75, 1));
      } else target.lerp(rig.root.localToWorld(foot), THREE.MathUtils.smoothstep(exit, .55, 1));
    }
    reach(upper, lower, ankle.position, target, new THREE.Vector3(sign * .3, .1, 1).applyQuaternion(orientation));
    ankle.quaternion.copy(lower.getWorldQuaternion(new THREE.Quaternion()).invert().multiply(orientation));
  }
  rig.root.updateWorldMatrix(true, true);
  for (let i = 0; i < 2; i++) {
    const sign = i ? 1 : -1, shoulder = bone('shoulder', i) ?? rig.shoulders[i], elbow = bone('elbow', i) ?? rig.elbows[i];
    const wrist = bone('wrist', i) ?? rig.mobilWrists?.[i];
    const hand = new THREE.Vector3(sign * .54, 1.96 + .7 * speaking, .24 + .2 * speaking);
    let target: THREE.Vector3 | undefined;
    let grip = .15;
    if (role === 'neo' && hostage) { hand.set(sign * .16, 2.95, .85); grip = .75; }
    if (role === 'bane' && hostage) {
      const trinity = logosBaneRoot(encounter, 'trinity'), center = FILM_SETS.film_logos_deck.center;
      target = gesture.contact && i === 1 ? new THREE.Vector3().copy(gesture.contact) : new THREE.Vector3(center.x + trinity.x + (i ? 0 : .42), center.y - 1 + (i ? 3.48 : 3.12), center.z + trinity.z + .14);
      grip = .85;
    }
    if (role === 'trinity' && hostage) { hand.set(sign * .28, 3.17, .14); grip = .65; }
    if (lowering) {
      hand.set(sign * (.28 + .2 * bend), 2.95 - 2.68 * bend, .85 - .02 * bend);
      if (role === 'bane') hand.set(sign * (.54 - .06 * bend), 1.96 - 1.69 * bend, .24 + .59 * bend)
        .lerp(new THREE.Vector3(sign * .16, 2.98, 1.1), THREE.MathUtils.smoothstep(lowerClock, 1, 1.4));
      grip = role === 'bane' || !state.gunOnDeck ? .8 : .08;
      if (i === 0 && state.gunPoint) {
        const center = FILM_SETS.film_logos_deck.center, point = state.gunPoint;
        target = rig.root.localToWorld(hand.clone()).lerp(new THREE.Vector3(center.x + point.x, center.y - 1 + point.y, center.z + point.z), bend);
      }
    }
    if (role === 'bane' && ['recognition_ready', 'recognition', 'gun_warning', 'gun_window', 'dodge_gun'].includes(beat)) { hand.set(sign * .16, 2.98, 1.1); grip = .8; }
    if (['grapple', 'punch', 'dodge_gun'].includes(beat)) {
      hand.set(sign * .38, 3.05, .65 + (role === 'neo' && i === (encounter.hits % 2) ? .77 * attack : 0)); grip = .92;
      if (role === 'bane' && strike?.landed) head.rotation.x -= .15 * attack;
    }
    if (encounter.phase === 'burning') {
      hand.set(sign * .27, 3.58, .22);
      if (role === 'bane' && i === 0) {
        const neo = logosBaneRoot(encounter, 'neo'), center = FILM_SETS.film_logos_deck.center;
        target = gesture.contact ? new THREE.Vector3().copy(gesture.contact) : new THREE.Vector3(center.x + neo.x, center.y - 1 + 3.7, center.z + neo.z);
      }
      grip = .9;
    }
    if (role === 'neo' && ['blind', 'failed'].includes(beat) && encounter.checkpoint === 'blind') { hand.set(sign * .32, 3.55, .33); grip = .3; }
    if (role === 'bane' && ['blind', 'pipe_window', 'counter', 'dodge_pipe', 'pipe_strike', 'finishing'].includes(beat)) { hand.set(sign * .27, 3.5 + (i ? -.3 : .25), .48 + attack * .65); grip = .92; }
    if (role === 'neo' && ['counter', 'dodge_pipe', 'pipe_strike', 'finishing'].includes(beat)) { hand.set(sign * .25, 3.16 + .18 * attack, .55 + .8 * attack); grip = .9; }
    if (role === 'neo' && ['defeated', 'opening'].includes(beat) && i === 0) { hand.y = 2.15; if (!state.pipeDrop) grip = .78; }
    if (climbing && clock > .45) {
      target = ladderContact(i, true); grip = .85;
      const h = LOGOS_BANE.hatch, center = FILM_SETS.film_logos_deck.center;
      if (i) target.lerp(new THREE.Vector3(center.x + h.x + h.width / 2 + .03, center.y - 1 + .16, center.z + LOGOS_BANE.ladder.z + sign * .28), THREE.MathUtils.smoothstep(exit, 0, .35));
      target.lerp(rig.root.localToWorld(hand), THREE.MathUtils.smoothstep(exit, i ? .65 : .35, 1));
    }
    if (role === 'trinity' && beat === 'opening') { hand.set(sign * .2, 3.28, .36); grip = .6; }
    if (role === 'neo' && beat === 'opening') {
      const center = FILM_SETS.film_logos_deck.center, handle = logosBaneHandle(encounter);
      const contact = THREE.MathUtils.smoothstep(clock, LOGOS_BANE.pipeReleaseSeconds, .95) * (1 - THREE.MathUtils.smoothstep(clock, 1.1, 1.55));
      target = rig.root.localToWorld(hand.clone()).lerp(new THREE.Vector3(center.x + handle.x, center.y - 1 + handle.y, center.z + handle.z), contact);
      grip = .82 * contact;
    }
    if (beat === 'checking' && role !== 'bane' && gesture.handContacts) {
      const contact = THREE.MathUtils.smoothstep(clock, .4, .9) * (1 - THREE.MathUtils.smoothstep(clock, LOGOS_BANE.rescueLines.length * LOGOS_BANE.lineSeconds - 1.4, LOGOS_BANE.rescueLines.length * LOGOS_BANE.lineSeconds - .4));
      target = rig.root.localToWorld(hand).lerp(new THREE.Vector3().copy(gesture.handContacts[i]), contact); grip = .15 + .25 * contact;
    }
    if (falling) hand.set(sign * .7, 2.2 - .6 * falling, .1);
    target ??= rig.root.localToWorld(hand);
    const palm = orientation.clone().multiply(new THREE.Quaternion().setFromEuler(new THREE.Euler(.35 + .4 * grip, 0, sign * .15)));
    if (wrist) {
      const offset = hero ? new THREE.Vector3(i ? -.13 : .13, -.18, .02) : new THREE.Vector3(0, -.75 - wrist.position.y, .005);
      wrist.userData.logosBanePalm = offset.clone();
      reach(shoulder, elbow, wrist.position, target.sub(offset.multiply(wrist.getWorldScale(new THREE.Vector3())).applyQuaternion(palm)), new THREE.Vector3(sign * .7, -.4, -.2).applyQuaternion(orientation));
      wrist.quaternion.copy(elbow.getWorldQuaternion(new THREE.Quaternion()).invert().multiply(palm));
    } else reach(shoulder, elbow, new THREE.Vector3(0, -.75, .005), target, new THREE.Vector3(sign * .7, -.4, -.2).applyQuaternion(orientation));
    if (hero) for (let finger = 1; finger <= 5; finger++) for (let joint = 1; joint <= 3; joint++) hero.bones.get(`finger${finger}-${joint}_${i ? 'L' : 'R'}`)!.rotation.set(0, 0, sign * -grip * .85);
    else rig.fingers[i].forEach(finger => { finger.rotation.x = -grip; });
  }
  rig.root.updateWorldMatrix(true, true);
}
