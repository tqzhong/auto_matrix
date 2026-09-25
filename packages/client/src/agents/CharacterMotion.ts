import { reloadedPose, type CatchGesture, type ReloadedGesture } from '@auto_matrix/shared';
import { farewellPose } from '@auto_matrix/shared';
import { MELEE_COMBO, COMBO_WINDOW, COMBAT_SKILLS, PLAYER_WALK_SPEED, PLAYER_RUN_SPEED, PILL_TIMING, MIRROR_TIMING, lobbyPose, governmentPose, airRescuePose, matrixEscapePose, theOnePose, recoveryCrewPose, type CombatSkillId, type AwakeningPose, type AwakeningReveal, type RecoveryCrewGesture, type OfficePhone, pillPose, lafayetteWelcomePose, oracleVisitPose, betrayalPose, rescuePose, type PillGesture, type InterrogationGesture, type LafayetteWelcomeGesture, type TrainingGesture, type OracleVisitGesture, type BetrayalGesture, type RescueGesture, type RescueLoadout, type LobbyGesture, type GovernmentRescueGesture, type AirRescueGesture, type MatrixEscapeGesture, type TheOneGesture } from '@auto_matrix/shared';

export interface MotionInput {
  speed: number;
  grounded: boolean;
  verticalVelocity: number;
  turn: number;
  attack?: number;
  combo?: number;
  hit?: number;
  impact?: number;
  windingUp?: boolean;
  cast?: number;
  skill?: CombatSkillId;
  armed?: boolean;
  shot?: number;
  crouching?: boolean;
  seated?: boolean;
  floorSeated?: boolean;
  riding?: boolean;
  climbing?: number;
  performance?: AwakeningPose;
  mirrorBeat?: number;
  mirrorCrew?: number;
  recovery?: number;
  recoveryCrew?: RecoveryCrewGesture;
  reveal?: AwakeningReveal;
  training?: TrainingGesture;
  workday?: import('@auto_matrix/shared').OfficeWorkdayGesture;
  contact?: import('@auto_matrix/shared').ApartmentGesture;
  wakeCall?: import('@auto_matrix/shared').WakeCall;
  club?: import('@auto_matrix/shared').ClubGesture;
  sentinel?: import('@auto_matrix/shared').SentinelGesture;
  interlude?: import('@auto_matrix/shared').InterludeGesture;
  oracleVisit?: OracleVisitGesture;
  betrayal?: BetrayalGesture;
  rescue?: RescueGesture;
  lobbyEntry?: LobbyGesture;
  government?: GovernmentRescueGesture;
  airRescue?: AirRescueGesture;
  matrixEscape?: MatrixEscapeGesture;
  theOne?: TheOneGesture;
  reloaded?: ReloadedGesture;
  catch?: CatchGesture;
  hotel303?: { phase: 'surrender' | 'dive'; elapsed: number };
  openingRoofLeap?: number;
  burly?: import('@auto_matrix/shared').BurlyEncounter & { role: 'neo' | 'smith' };
  chateauWeapon?: import('@auto_matrix/shared').ChateauWeapon;
  mountainFlight?: import('@auto_matrix/shared').MountainFlight;
  truckFlight?: boolean;
  truckPassenger?: boolean;
  persephone?: import('@auto_matrix/shared').PersephoneEncounter & { role: 'neo' | 'persephone' };
  farewell?: import('@auto_matrix/shared').FarewellGesture;
  weaponStyle?: RescueLoadout | 'hel_pistol';
  helDanceDoor?: number;
  aimPitch?: number;
  clubClothes?: boolean;
  mirror?: number;
  spoon?: number;
  phone?: OfficePhone;
  window?: number;
  crossing?: number;
  pills?: PillGesture;
  interrogation?: InterrogationGesture;
  meeting?: import('@auto_matrix/shared').MeetingGesture;
  welcome?: LafayetteWelcomeGesture;
  knock?: number;
  officeShirt?: boolean;
  inspecting?: boolean;
  vase?: number;
  realWorld?: boolean;
  glasses?: boolean;
}

export interface MotionState {
  time: number;
  phase: number;
  speed: number;
  turn: number;
  airborne: number;
  wasGrounded: boolean;
  landing: number;
  attackId?: number;
  attackAge: number;
  combo: number;
  hitId?: number;
  impactId?: number;
  hitAge: number;
  hitPause: number;
  verticalVelocity: number;
  castId?: number;
  skill?: CombatSkillId;
  skillAge: number;
  shotId?: number;
  shotAge: number;
  seated: number;
  climbPhase: number;
}

export const newMotion = (): MotionState => ({ time: 0, phase: 0, speed: 0, turn: 0, airborne: 0, wasGrounded: true, landing: 0, attackAge: 10, combo: 0, hitAge: 10, hitPause: 0, verticalVelocity: 0, skillAge: 10, shotAge: 10, seated: 0, climbPhase: 0 });
const clamp = (x: number, low = 0, high = 1) => Math.min(high, Math.max(low, x));
const mix = (a: number, b: number, t: number) => a + (b - a) * t;
const smooth = (x: number) => x * x * (3 - 2 * x);

// The planted foot moves backwards at the travelled speed. The return stroke
// lifts it off the ground, instead of rotating both legs like pendulums.
export function footTrajectory(phase: number, stride: number, stance: number): { z: number; lift: number; planted: boolean } {
  const p = ((phase % 1) + 1) % 1;
  if (p < stance) return { z: stride * (1 - 2 * p / stance), lift: 0, planted: true };
  const t = (p - stance) / (1 - stance);
  return { z: mix(-stride, stride, smooth(t)), lift: Math.sin(t * Math.PI), planted: false };
}

export function solveLeg(z: number, height: number): { hip: number; knee: number; ankle: number } {
  const upper = .94; const lower = .9;
  const reach = clamp(Math.hypot(z, height), .15, upper + lower - .002);
  const knee = Math.PI - Math.acos(clamp((upper * upper + lower * lower - reach * reach) / (2 * upper * lower), -1, 1));
  const hip = -Math.atan2(z, height) - Math.acos(clamp((upper * upper + reach * reach - lower * lower) / (2 * upper * reach), -1, 1));
  return { hip, knee, ankle: -hip - knee };
}

export function advanceMotion(state: MotionState, input: MotionInput, delta: number) {
  let dt = clamp(delta, 0, .1);
  if (dt > 0) {
    if (input.hit !== undefined && input.hit !== state.hitId) { state.hitId = input.hit; state.hitAge = 0; state.hitPause = .045; }
    if (input.impact !== undefined && input.impact !== state.impactId) { state.impactId = input.impact; state.hitPause = .035; }
    const hold = Math.min(dt, state.hitPause); state.hitPause -= hold; dt -= hold;
  }
  const blend = 1 - Math.exp(-12 * dt);
  const pills = input.pills && pillPose(input.pills);
  const exiting = input.pills?.role === 'neo' && input.pills.phase === 'taking' && input.pills.elapsed > PILL_TIMING.stand && input.pills.elapsed < PILL_TIMING.exit;
  const welcome = input.welcome && lafayetteWelcomePose(input.welcome);
  const oracle = input.oracleVisit && oracleVisitPose(input.oracleVisit);
  const betrayal = input.betrayal && betrayalPose(input.betrayal);
  const rescue = input.rescue && rescuePose(input.rescue);
  const lobby = input.lobbyEntry && lobbyPose(input.lobbyEntry);
  const government = input.government && governmentPose(input.government);
  const airRescue = input.airRescue && airRescuePose(input.airRescue);
  const matrixEscape = input.matrixEscape && matrixEscapePose(input.matrixEscape);
  const theOne = input.theOne && theOnePose(input.theOne);
  const reloaded = input.reloaded && reloadedPose(input.reloaded);
  const recoveryCrew = input.recoveryCrew && recoveryCrewPose(input.recoveryCrew);
  const farewell = input.farewell && farewellPose(input.farewell);
  const welcomeWalking = input.welcome?.phase === 'approach' || input.welcome?.phase === 'departing' && input.welcome.role !== 'neo';
  const welcomeSpeed = input.welcome?.role === 'morpheus' ? 2.6 : input.welcome?.role === 'neo' ? 2.3 : 1.8;
  const speed = input.farewell ? 0 : input.pills ? exiting ? 1.7 : 0 : welcomeWalking ? welcomeSpeed : input.speed;
  state.time += dt;
  state.speed = mix(state.speed, input.riding || input.climbing !== undefined ? 0 : speed, blend);
  state.climbPhase += (input.climbing ?? 0) * dt * 5;
  state.seated = reloaded ? reloaded.seated : pills ? pills.seat : welcome ? welcome.seated : mix(state.seated, input.seated || input.riding || input.performance === 'connect' || input.performance === 'construct' ? 1 : 0, blend);
  state.turn = mix(state.turn, clamp(input.turn, -3, 3), blend);
  state.airborne = mix(state.airborne, input.grounded ? 0 : 1, 1 - Math.exp(-18 * dt));
  if (dt > 0) {
    if (input.grounded && !state.wasGrounded) state.landing = clamp(Math.abs(state.verticalVelocity) / 14, .25, 1);
    state.wasGrounded = input.grounded;
    state.verticalVelocity = input.verticalVelocity;
    state.landing *= Math.exp(-8 * dt);
    state.hitAge += dt;
    state.skillAge += dt;
    state.shotAge += dt;
    if (input.shot !== undefined && input.shot !== state.shotId) { state.shotId = input.shot; state.shotAge = 0; }
    if (input.cast !== undefined && input.cast !== state.castId) { state.castId = input.cast; state.skill = input.skill; state.skillAge = 0; }
    if (input.attack !== undefined && input.attack !== state.attackId) {
      state.combo = input.combo ?? (state.attackAge < COMBO_WINDOW ? (state.combo + 1) % 3 : 0);
      state.attackId = input.attack; state.attackAge = 0;
    } else state.attackAge += dt * (input.windingUp ? .28 : 1);
  }
  const run = smooth(clamp((state.speed - PLAYER_WALK_SPEED) / (PLAYER_RUN_SPEED - PLAYER_WALK_SPEED)));
  const stride = mix(.84, 1.22, run);
  const stance = mix(.6, .42, run);
  if (input.grounded) state.phase += speed * dt / (2 * stride / stance);
  if (welcomeWalking && input.welcome) state.phase = input.welcome.elapsed * welcomeSpeed / (2 * stride / stance);
  if (exiting) state.phase = (input.pills!.elapsed - PILL_TIMING.stand) * 1.1;
  const moving = smooth(clamp(state.speed / 2.2));
  const cycle = state.phase * Math.PI * 2;
  const bob = Math.cos(cycle * 2) * mix(.025, .045, run) * moving + Math.sin(state.time * 1.7) * .009 * (1 - moving);
  const strike = MELEE_COMBO[state.combo];
  const age = state.attackAge;
  const skillDuration = state.skill ? COMBAT_SKILLS[state.skill].duration : 0;
  const skillBlend = smooth(clamp(state.skillAge / .08)) * (1 - smooth(clamp((state.skillAge - skillDuration) / .25)));
  const guarding = state.skill === 'iron_guard' ? skillBlend : 0;
  const dodging = state.skill === 'dodge' ? skillBlend : 0;
  const casting = state.skill && ['force_push', 'system_hack', 'bullet_time', 'code_snare'].includes(state.skill) && state.skillAge < .65 ? Math.sin(state.skillAge / .65 * Math.PI) : 0;
  const guard = Math.max(guarding, smooth(clamp(age / .07)) * (1 - smooth(clamp((age - strike.duration) / .35))));
  const extension = smooth(clamp((age - strike.contact * .5) / (strike.contact * .5)))
    * (1 - smooth(clamp((age - strike.contact - .025) / (strike.duration - strike.contact - .025))));
  const windup = Math.sin(clamp(age / strike.contact) * Math.PI) * guard;
  const recoil = state.hitAge < .32 ? Math.sin(state.hitAge / .32 * Math.PI) * (1 - state.hitAge / .32) : 0;
  const kick = state.combo === 2 ? extension : 0;
  const lobbyDown = lobby?.fall ?? 0;
  const governmentBend = government?.bend ?? 0;
  const escapePinned = matrixEscape?.grapple && input.matrixEscape?.role === 'neo' ? matrixEscape.grapple : 0;
  const hipHeight = 1.98 - moving * .08 - run * .12 + bob - state.landing * .20 - guard * .08 - dodging * .3 - (input.crouching ? .9 : 0) - state.seated * .6 - (input.floorSeated ? .85 : 0) - lobbyDown * 1.5 - governmentBend * .9 - (airRescue?.strain ?? 0) * .32 - (airRescue?.land ?? 0) * .18 - escapePinned * .72 - (matrixEscape?.brace ?? 0) * .55
    - (theOne?.wound ?? 0) * 1.2 - (theOne?.fallen ?? 0) * 1.58 - (theOne?.kiss ?? 0) * .28 - (theOne?.block ?? 0) * .18 - (theOne?.dive ?? 0) * .22 - (theOne?.burst ?? 0) * .28 - (reloaded?.down ?? 0) * 1.5 - (reloaded?.dodge ?? 0) * .38;
  const legs = [0, .5].map(offset => {
    const foot = footTrajectory(state.phase + offset, stride, stance);
    const lift = foot.lift * mix(.22, .55, run) * moving;
    const planted = solveLeg(foot.z * moving, hipHeight - .15 - lift);
    const airHip = input.verticalVelocity > 0 ? -.6 + offset * .45 : -.12 + offset * .18;
    const airKnee = input.verticalVelocity > 0 ? 1.02 : .3;
    return {
      hip: mix(planted.hip, airHip, state.airborne),
      knee: mix(planted.knee, airKnee, state.airborne),
      ankle: mix(planted.ankle, -.2, state.airborne),
    };
  });
  if (state.combo === 2) {
    legs[0].hip = mix(legs[0].hip, -1.35, kick);
    legs[0].knee = mix(legs[0].knee + windup * .65, .12, kick);
    legs[0].ankle = mix(legs[0].ankle, .12, kick);
  }
  const activeArm = state.combo % 2;
  const arms = [0, 1].map(i => {
    const swing = Math.cos(cycle + i * Math.PI) * moving;
    const striking = i === activeArm && state.combo !== 2;
    return {
      shoulder: mix(swing * mix(.32, .65, run), striking ? -.45 + windup * .18 - extension * .95 : -.45, guard) - state.airborne * .25 + recoil * .2,
      elbow: mix(-.22 - run * .8 - Math.max(0, swing) * .15, striking ? -1.7 + extension * 1.6 : -1.55, guard),
      outward: (i ? 1 : -1) * (.075 + run * .025 + state.airborne * .12 + guard * .1),
      grip: Math.max(run * .6, guard),
    };
  });
  const doorPush = input.helDanceDoor === undefined ? 0 : smooth(clamp(input.helDanceDoor * 3)) * (1 - smooth(clamp((input.helDanceDoor - .8) / .2)));
  if (doorPush) for (let i = 0; i < 2; i++) {
    arms[i].shoulder = mix(arms[i].shoulder, -1.48, doorPush);
    arms[i].elbow = mix(arms[i].elbow, -.22, doorPush);
    arms[i].outward = mix(arms[i].outward, (i ? 1 : -1) * .2, doorPush);
    arms[i].grip = mix(arms[i].grip, .15, doorPush);
  }
  const glance = input.vase === undefined ? 0 : Math.sin(clamp((input.vase - .5) / 2.5) * Math.PI) * .15;
  const twist = Math.cos(cycle) * moving * mix(.055, .10, run) + (extension * .3 - windup * .16) * (activeArm ? -1 : 1) * guard + glance;
  if (casting) for (const arm of arms) { arm.shoulder = mix(arm.shoulder, -1.35, casting); arm.elbow = mix(arm.elbow, -.25, casting); arm.grip = 0; }
  if (input.armed && guard < .1 && !casting) for (const [index, arm] of arms.entries()) {
    if (input.weaponStyle === 'hel_pistol' && index === 1) continue;
    const kickback = Math.max(0, 1 - state.shotAge / .18) ** 2;
    arm.shoulder = -1.16 + clamp(input.aimPitch ?? 0, -.9, .9) * .82 - recoil * .1 - kickback * .16; arm.elbow = -.4 - kickback * .12; arm.outward *= .4; arm.grip = .9;
  }
  for (let i = 0; i < 2; i++) {
    legs[i].hip = mix(legs[i].hip, -1.36, state.seated); legs[i].knee = mix(legs[i].knee, 1.46, state.seated); legs[i].ankle = mix(legs[i].ankle, -.1, state.seated);
    arms[i].shoulder = mix(arms[i].shoulder, -.32, state.seated); arms[i].elbow = mix(arms[i].elbow, -1.1, state.seated); arms[i].outward = mix(arms[i].outward, (i ? 1 : -1) * .16, state.seated);
  }
  if (input.riding) for (const arm of arms) { arm.shoulder = -.9; arm.elbow = -.65; arm.grip = .8; }
  if (input.climbing !== undefined) for (let i = 0; i < 2; i++) {
    const pull = Math.sin(state.climbPhase + i * Math.PI);
    legs[i].hip = -.75 + pull * .4; legs[i].knee = 1.1 - pull * .6; legs[i].ankle = -.2;
    arms[i].shoulder = -2.2 - pull * .55; arms[i].elbow = -.65 + pull * .5; arms[i].grip = 1;
  }
  if (input.performance === 'touch') {
    const reach = smooth(clamp(((input.mirrorBeat ?? MIRROR_TIMING.touch) - MIRROR_TIMING.wired) / (MIRROR_TIMING.touch - MIRROR_TIMING.wired)));
    arms[0].shoulder = mix(arms[0].shoulder, -1.5, reach);
    arms[0].elbow = mix(arms[0].elbow, -.65, reach);
    arms[0].grip = mix(arms[0].grip, 0, reach);
  }
  if (input.mirrorCrew !== undefined) {
    const wire = smooth(clamp((input.mirrorCrew - MIRROR_TIMING.sit) / .55)) * (1 - smooth(clamp((input.mirrorCrew - MIRROR_TIMING.wired) / .5)));
    arms[0].shoulder = mix(arms[0].shoulder, -1.42, wire);
    arms[0].elbow = mix(arms[0].elbow, -.34, wire);
    arms[0].outward = mix(arms[0].outward, -.25, wire);
  }
  if (input.spoon !== undefined) { arms[0].shoulder = -.72; arms[0].elbow = -1.45; arms[0].outward = -.2; arms[0].grip = .65; }
  if (input.vase !== undefined) {
    const reach = Math.sin(clamp((input.vase - .6) / 1.8) * Math.PI);
    arms[1].shoulder = mix(arms[1].shoulder, -1.1, reach); arms[1].elbow = mix(arms[1].elbow, -.25, reach);
  }
  if (oracle && input.oracleVisit) {
    if (input.oracleVisit.role === 'oracle') {
      arms[0].shoulder = mix(arms[0].shoulder, -1.34, oracle.inspect);
      arms[0].elbow = mix(arms[0].elbow, -.18, oracle.inspect);
      arms[0].outward = mix(arms[0].outward, -.08, oracle.inspect);
      arms[0].shoulder = mix(arms[0].shoulder, -.76, oracle.offer);
      arms[0].elbow = mix(arms[0].elbow, -1.28, oracle.offer);
      arms[0].outward = mix(arms[0].outward, -.19, oracle.offer);
      arms[0].grip = mix(arms[0].grip, .28, oracle.offer);
      arms[1].shoulder = mix(arms[1].shoulder, -.42, oracle.listen);
      arms[1].elbow = mix(arms[1].elbow, -1.02, oracle.listen);
    } else {
      arms[0].shoulder = mix(arms[0].shoulder, -.66, oracle.receive);
      arms[0].elbow = mix(arms[0].elbow, -1.34, oracle.receive);
      arms[0].outward = mix(arms[0].outward, -.14, oracle.receive);
      arms[0].grip = mix(arms[0].grip, .38, oracle.receive);
    }
  }
  if (betrayal && input.betrayal) {
    if (betrayal.charge) for (let i = 0; i < 2; i++) {
      arms[i].shoulder = mix(arms[i].shoulder, -1.12, betrayal.charge); arms[i].elbow = mix(arms[i].elbow, -.38, betrayal.charge);
      arms[i].outward = mix(arms[i].outward, (i ? 1 : -1) * .28, betrayal.charge); arms[i].grip = mix(arms[i].grip, .9, betrayal.charge);
    }
    if (betrayal.yank) {
      arms[0].shoulder = mix(arms[0].shoulder, -.32, betrayal.yank); arms[0].elbow = mix(arms[0].elbow, -1.72, betrayal.yank);
      arms[0].outward = mix(arms[0].outward, -.42, betrayal.yank); arms[0].grip = mix(arms[0].grip, 1, betrayal.yank);
    }
    if (betrayal.counter || betrayal.reconnect) {
      const reach = Math.max(betrayal.counter, betrayal.reconnect);
      arms[0].shoulder = mix(arms[0].shoulder, -.88, reach); arms[0].elbow = mix(arms[0].elbow, -1.08, reach); arms[0].grip = mix(arms[0].grip, .9, reach);
      if (betrayal.reconnect) { arms[1].shoulder = -.72; arms[1].elbow = -1.34; arms[1].grip = .75; }
    }
    if (betrayal.unplugged) for (let i = 0; i < 2; i++) {
      arms[i].shoulder = mix(arms[i].shoulder, .28, .92); arms[i].elbow = mix(arms[i].elbow, -.18, .92); arms[i].grip = 0;
    }
  }
  if (rescue && input.rescue) {
    if (rescue.briefingPoint) {
      const arm = input.rescue.role === 'trinity' ? 1 : 0;
      arms[arm].shoulder = mix(arms[arm].shoulder, -1.16, rescue.briefingPoint);
      arms[arm].elbow = mix(arms[arm].elbow, -.22, rescue.briefingPoint);
      arms[arm].outward = mix(arms[arm].outward, (arm ? 1 : -1) * .12, rescue.briefingPoint);
      arms[arm].grip = mix(arms[arm].grip, .18, rescue.briefingPoint);
    }
    if (rescue.equip) for (let i = 0; i < 2; i++) {
      const active = input.weaponStyle === 'compact' || i === 0;
      arms[i].shoulder = mix(arms[i].shoulder, active ? -.78 : -.38, rescue.equip);
      arms[i].elbow = mix(arms[i].elbow, active ? -1.16 + rescue.inspect * .42 : -.94, rescue.equip);
      arms[i].outward = mix(arms[i].outward, (i ? 1 : -1) * .16, rescue.equip);
      arms[i].grip = mix(arms[i].grip, active ? .95 : .45, rescue.equip);
    }
  }
  if (lobby && input.lobbyEntry) {
    if (input.lobbyEntry.role === 'guard') {
      arms[0].shoulder = mix(arms[0].shoulder, -1.05, lobby.alarm * (1 - lobby.fall));
      arms[0].elbow = mix(arms[0].elbow, -1.42, lobby.alarm * (1 - lobby.fall));
      arms[0].grip = mix(arms[0].grip, .5, lobby.alarm * (1 - lobby.fall));
      for (let i = 0; i < 2; i++) {
        arms[i].shoulder = mix(arms[i].shoulder, i ? -.35 : .2, lobby.fall);
        arms[i].elbow = mix(arms[i].elbow, -.18, lobby.fall); arms[i].grip = mix(arms[i].grip, 0, lobby.fall);
      }
    } else if (lobby.draw > 0) for (const arm of arms) {
      arm.shoulder = mix(arm.shoulder, -1.16 + clamp(input.aimPitch ?? 0, -.9, .9) * .82, lobby.draw);
      arm.elbow = mix(arm.elbow, -.4, lobby.draw); arm.outward *= mix(1, .4, lobby.draw); arm.grip = mix(arm.grip, .9, lobby.draw);
    }
  }
  if (government && input.government) {
    const role = input.government.role;
    if (role === 'morpheus' && government.restrained) for (let i = 0; i < 2; i++) {
      arms[i].shoulder = -.34 + government.strain * .12; arms[i].elbow = -1.45; arms[i].outward = (i ? 1 : -1) * .42; arms[i].grip = .82;
    }
    if (role === 'smith' && government.removeEarpiece) {
      arms[1].shoulder = mix(arms[1].shoulder, -1.5, government.removeEarpiece);
      arms[1].elbow = mix(arms[1].elbow, -1.3, government.removeEarpiece);
      arms[1].outward = mix(arms[1].outward, .42, government.removeEarpiece); arms[1].grip = mix(arms[1].grip, .48, government.removeEarpiece);
    }
    if (role === 'smith' && government.grip) for (let i = 0; i < 2; i++) {
      arms[i].shoulder = mix(arms[i].shoulder, -.98, government.grip); arms[i].elbow = mix(arms[i].elbow, -.38, government.grip);
      arms[i].outward = mix(arms[i].outward, (i ? 1 : -1) * .3, government.grip); arms[i].grip = mix(arms[i].grip, .9, government.grip);
    }
    if (role === 'neo' && government.bend) {
      for (let i = 0; i < 2; i++) {
        legs[i].hip = mix(legs[i].hip, i ? -.75 : -.98, government.bend); legs[i].knee = mix(legs[i].knee, i ? 1.55 : 1.2, government.bend);
        arms[i].shoulder = mix(arms[i].shoulder, -.7, government.bend); arms[i].elbow = mix(arms[i].elbow, -1.25, government.bend);
        arms[i].outward = mix(arms[i].outward, (i ? 1 : -1) * .48, government.bend); arms[i].grip = mix(arms[i].grip, .94, government.bend);
      }
    }
    if (role === 'trinity' && government.aim) for (let i = 0; i < 2; i++) {
      arms[i].shoulder = mix(arms[i].shoulder, -1.18, government.aim); arms[i].elbow = mix(arms[i].elbow, -.44, government.aim);
      arms[i].outward = mix(arms[i].outward, (i ? 1 : -1) * .1, government.aim); arms[i].grip = mix(arms[i].grip, .96, government.aim);
    }
    if (government.help && (role === 'neo' || role === 'trinity')) {
      const arm = role === 'neo' ? 0 : 1; arms[arm].shoulder = mix(arms[arm].shoulder, -1.02, government.help);
      arms[arm].elbow = mix(arms[arm].elbow, -.72, government.help); arms[arm].outward = mix(arms[arm].outward, arm ? .28 : -.28, government.help);
      arms[arm].grip = mix(arms[arm].grip, .75, government.help);
    }
    if (role === 'trinity' && government.phone) {
      arms[1].shoulder = mix(arms[1].shoulder, -1.38, government.phone); arms[1].elbow = mix(arms[1].elbow, -1.45, government.phone);
      arms[1].outward = mix(arms[1].outward, .42, government.phone); arms[1].grip = mix(arms[1].grip, .52, government.phone);
    }
    if (government.fall) for (let i = 0; i < 2; i++) {
      arms[i].shoulder = mix(arms[i].shoulder, .15, government.fall); arms[i].elbow = mix(arms[i].elbow, -.12, government.fall); arms[i].grip = mix(arms[i].grip, 0, government.fall);
    }
  }
  if (airRescue && input.airRescue) {
    const role = input.airRescue.role;
    if (role === 'neo' && airRescue.gun) for (let i = 0; i < 2; i++) {
      arms[i].shoulder = mix(arms[i].shoulder, -.88, airRescue.gun); arms[i].elbow = mix(arms[i].elbow, -.52, airRescue.gun);
      arms[i].outward = mix(arms[i].outward, (i ? 1 : -1) * .24, airRescue.gun); arms[i].grip = mix(arms[i].grip, .98, airRescue.gun);
    }
    if (role === 'trinity' && airRescue.pilot) for (let i = 0; i < 2; i++) {
      arms[i].shoulder = mix(arms[i].shoulder, -.62, airRescue.pilot); arms[i].elbow = mix(arms[i].elbow, -.92, airRescue.pilot);
      arms[i].outward = mix(arms[i].outward, (i ? 1 : -1) * .28, airRescue.pilot); arms[i].grip = mix(arms[i].grip, .88, airRescue.pilot);
    }
    if (airRescue.rope && role === 'neo') for (let i = 0; i < 2; i++) {
      arms[i].shoulder = mix(arms[i].shoulder, -1.35, airRescue.rope); arms[i].elbow = mix(arms[i].elbow, -1.2, airRescue.rope);
      arms[i].outward = mix(arms[i].outward, (i ? 1 : -1) * .18, airRescue.rope); arms[i].grip = mix(arms[i].grip, .98, airRescue.rope);
    }
    if (airRescue.reach && (role === 'neo' || role === 'morpheus' || role === 'trinity')) {
      const arm = role === 'morpheus' ? 0 : 1; arms[arm].shoulder = mix(arms[arm].shoulder, -1.48, airRescue.reach);
      arms[arm].elbow = mix(arms[arm].elbow, -.25, airRescue.reach); arms[arm].outward = mix(arms[arm].outward, arm ? .22 : -.22, airRescue.reach);
      arms[arm].grip = mix(arms[arm].grip, .92, airRescue.reach);
    }
    if (airRescue.fall && (role === 'morpheus' || role === 'trinity')) for (let i = 0; i < 2; i++) {
      legs[i].hip = mix(legs[i].hip, i ? -.5 : .45, airRescue.fall); legs[i].knee = mix(legs[i].knee, .75, airRescue.fall);
      arms[i].outward = mix(arms[i].outward, (i ? 1 : -1) * .72, airRescue.fall);
    }
    if (airRescue.cut && role === 'trinity') {
      arms[1].shoulder = mix(arms[1].shoulder, -1.2, airRescue.cut); arms[1].elbow = mix(arms[1].elbow, -.2, airRescue.cut); arms[1].grip = mix(arms[1].grip, .95, airRescue.cut);
    }
    if (airRescue.scatter && ['smith', 'agent_brown', 'agent_jones'].includes(role)) {
      arms[0].shoulder = mix(arms[0].shoulder, -.45, airRescue.scatter); arms[1].shoulder = mix(arms[1].shoulder, .35, airRescue.scatter);
      legs[0].hip = mix(legs[0].hip, -.55, airRescue.scatter); legs[1].knee = mix(legs[1].knee, .72, airRescue.scatter);
    }
  }
  if (matrixEscape && input.matrixEscape) {
    const role = input.matrixEscape.role;
    if (role === 'neo' && matrixEscape.phone) {
      arms[1].shoulder = mix(arms[1].shoulder, -1.34, matrixEscape.phone); arms[1].elbow = mix(arms[1].elbow, -1.5, matrixEscape.phone);
      arms[1].outward = mix(arms[1].outward, .36, matrixEscape.phone); arms[1].grip = mix(arms[1].grip, .58, matrixEscape.phone);
    }
    if (role === 'smith' && matrixEscape.aim) for (let i = 0; i < 2; i++) {
      arms[i].shoulder = mix(arms[i].shoulder, -1.12, matrixEscape.aim); arms[i].elbow = mix(arms[i].elbow, -.34, matrixEscape.aim);
      arms[i].outward = mix(arms[i].outward, (i ? 1 : -1) * .08, matrixEscape.aim); arms[i].grip = mix(arms[i].grip, .96, matrixEscape.aim);
    }
    if (matrixEscape.stance) for (let i = 0; i < 2; i++) {
      const neo = role === 'neo';
      arms[i].shoulder = mix(arms[i].shoulder, neo ? -.66 : -.52, matrixEscape.stance);
      arms[i].elbow = mix(arms[i].elbow, neo ? -1.42 : -1.18, matrixEscape.stance);
      arms[i].outward = mix(arms[i].outward, (i ? 1 : -1) * (neo ? .27 : .2), matrixEscape.stance);
      arms[i].grip = mix(arms[i].grip, .88, matrixEscape.stance);
    }
    if (role === 'neo' && matrixEscape.strike) {
      arms[0].shoulder = mix(arms[0].shoulder, -1.34, matrixEscape.strike); arms[0].elbow = mix(arms[0].elbow, -.08, matrixEscape.strike);
      arms[0].outward = mix(arms[0].outward, -.12, matrixEscape.strike); arms[0].grip = mix(arms[0].grip, 1, matrixEscape.strike);
    }
    if (matrixEscape.wall) for (let i = 0; i < 2; i++) {
      arms[i].outward = mix(arms[i].outward, (i ? 1 : -1) * .48, matrixEscape.wall);
      legs[i].hip = mix(legs[i].hip, i ? -.52 : .18, matrixEscape.wall); legs[i].knee = mix(legs[i].knee, .7, matrixEscape.wall);
    }
    if (matrixEscape.grapple) {
      if (role === 'smith') for (let i = 0; i < 2; i++) {
        arms[i].shoulder = mix(arms[i].shoulder, -1.08, matrixEscape.grapple); arms[i].elbow = mix(arms[i].elbow, -.32, matrixEscape.grapple);
        arms[i].outward = mix(arms[i].outward, (i ? 1 : -1) * .18, matrixEscape.grapple); arms[i].grip = mix(arms[i].grip, 1, matrixEscape.grapple);
      } else if (role === 'neo') for (let i = 0; i < 2; i++) {
        arms[i].shoulder = mix(arms[i].shoulder, -.42, matrixEscape.grapple); arms[i].elbow = mix(arms[i].elbow, -1.18, matrixEscape.grapple);
        arms[i].outward = mix(arms[i].outward, (i ? 1 : -1) * .45, matrixEscape.grapple); arms[i].grip = mix(arms[i].grip, .9, matrixEscape.grapple);
        legs[i].hip = mix(legs[i].hip, i ? -.75 : -.98, matrixEscape.grapple); legs[i].knee = mix(legs[i].knee, 1.35, matrixEscape.grapple);
      }
    }
    if (role === 'neo' && matrixEscape.leap) for (let i = 0; i < 2; i++) {
      arms[i].shoulder = mix(arms[i].shoulder, -1.65, matrixEscape.leap); arms[i].elbow = mix(arms[i].elbow, -.35, matrixEscape.leap);
      arms[i].outward = mix(arms[i].outward, (i ? 1 : -1) * .4, matrixEscape.leap);
      legs[i].hip = mix(legs[i].hip, i ? -.85 : .12, matrixEscape.leap); legs[i].knee = mix(legs[i].knee, i ? 1.4 : .62, matrixEscape.leap);
    }
    if (matrixEscape.transform) for (let i = 0; i < 2; i++) {
      arms[i].shoulder = mix(arms[i].shoulder, -.55, matrixEscape.transform); arms[i].elbow = mix(arms[i].elbow, -.18, matrixEscape.transform);
      arms[i].outward = mix(arms[i].outward, (i ? 1 : -1) * .74, matrixEscape.transform); arms[i].grip = mix(arms[i].grip, .12, matrixEscape.transform);
      legs[i].hip = mix(legs[i].hip, i ? -.22 : .16, matrixEscape.transform); legs[i].knee = mix(legs[i].knee, .38, matrixEscape.transform);
    }
    if (role === 'neo' && matrixEscape.brace) for (let i = 0; i < 2; i++) {
      arms[i].shoulder = mix(arms[i].shoulder, i ? -.3 : -1.12, matrixEscape.brace); arms[i].elbow = mix(arms[i].elbow, -1.2, matrixEscape.brace);
      arms[i].outward = mix(arms[i].outward, (i ? 1 : -1) * .52, matrixEscape.brace);
      legs[i].hip = mix(legs[i].hip, i ? -.28 : -1.18, matrixEscape.brace); legs[i].knee = mix(legs[i].knee, i ? 1.42 : .72, matrixEscape.brace);
    }
    if (role === 'neo' && matrixEscape.door) {
      arms[0].shoulder = mix(arms[0].shoulder, -1.25, matrixEscape.door); arms[0].elbow = mix(arms[0].elbow, -.18, matrixEscape.door);
      arms[0].grip = mix(arms[0].grip, .72, matrixEscape.door);
    }
  }
  if (reloaded && input.reloaded) {
    for (let i = 0; i < 2; i++) {
      const fall = reloaded.falling;
      arms[i].shoulder = mix(arms[i].shoulder, reloaded.dreamAgent ? -1.1 : -2.05, fall); arms[i].elbow = mix(arms[i].elbow, -.28, fall); arms[i].grip = mix(arms[i].grip, .92, fall);
      arms[i].outward = mix(arms[i].outward, (i ? 1 : -1) * .18, fall);
      legs[i].hip = mix(legs[i].hip, i ? -.55 : .45, fall); legs[i].knee = mix(legs[i].knee, i ? 1.12 : .6, fall);
      const stance = Math.max(reloaded.windup, reloaded.dodge);
      arms[i].shoulder = mix(arms[i].shoulder, i ? -.5 : -1.25, stance); arms[i].elbow = mix(arms[i].elbow, -1.4, stance);
      legs[i].hip = mix(legs[i].hip, i ? -.55 : .25, stance); legs[i].knee = mix(legs[i].knee, .72, stance);
      arms[i].shoulder = mix(arms[i].shoulder, i ? -1.65 : -.8, Math.max(reloaded.punch, reloaded.strike)); arms[i].elbow = mix(arms[i].elbow, i ? -.15 : -1.3, Math.max(reloaded.punch, reloaded.strike));
      arms[i].shoulder = mix(arms[i].shoulder, -1.55, reloaded.flight); arms[i].elbow = mix(arms[i].elbow, -.18, reloaded.flight);
      legs[i].hip = mix(legs[i].hip, i ? -.3 : .18, reloaded.flight); legs[i].knee = mix(legs[i].knee, .3, reloaded.flight);
      legs[i].knee = mix(legs[i].knee, .42, reloaded.down); arms[i].shoulder = mix(arms[i].shoulder, .25, reloaded.down);
    }
    if (reloaded.inspect) { arms[0].shoulder = -.75; arms[0].elbow = -1.45; arms[0].grip = .45; }
  }
  if (theOne && input.theOne) {
    const role = input.theOne.role;
    if (theOne.wound && role === 'neo') for (let i = 0; i < 2; i++) {
      arms[i].shoulder = mix(arms[i].shoulder, i ? .18 : -.15, theOne.wound); arms[i].elbow = mix(arms[i].elbow, -.18, theOne.wound); arms[i].grip = mix(arms[i].grip, .08, theOne.wound);
      legs[i].hip = mix(legs[i].hip, i ? -.72 : .22, theOne.wound); legs[i].knee = mix(legs[i].knee, i ? 1.28 : .65, theOne.wound);
    }
    if (theOne.fallen && role === 'neo') for (let i = 0; i < 2; i++) {
      arms[i].shoulder = mix(arms[i].shoulder, i ? .35 : -.18, theOne.fallen); arms[i].elbow = mix(arms[i].elbow, -.08, theOne.fallen); arms[i].grip = 0;
      legs[i].hip = mix(legs[i].hip, i ? -.4 : .35, theOne.fallen); legs[i].knee = mix(legs[i].knee, .5, theOne.fallen);
    }
    if (theOne.kiss && role === 'trinity') for (let i = 0; i < 2; i++) {
      arms[i].shoulder = mix(arms[i].shoulder, -1.08, theOne.kiss); arms[i].elbow = mix(arms[i].elbow, -1.28, theOne.kiss);
      arms[i].outward = mix(arms[i].outward, (i ? 1 : -1) * .22, theOne.kiss); arms[i].grip = mix(arms[i].grip, .75, theOne.kiss);
    }
    if (theOne.revive && role === 'neo') for (let i = 0; i < 2; i++) {
      arms[i].shoulder = mix(arms[i].shoulder, -.62, theOne.revive); arms[i].elbow = mix(arms[i].elbow, -.95, theOne.revive); arms[i].grip = mix(arms[i].grip, .45, theOne.revive);
    }
    if (theOne.aim && role === 'smith') for (let i = 0; i < 2; i++) {
      arms[i].shoulder = mix(arms[i].shoulder, -1.18, theOne.aim); arms[i].elbow = mix(arms[i].elbow, -.34, theOne.aim);
      arms[i].outward = mix(arms[i].outward, (i ? 1 : -1) * .08, theOne.aim); arms[i].grip = mix(arms[i].grip, .98, theOne.aim);
    }
    if (theOne.stop && role === 'neo') {
      arms[0].shoulder = mix(arms[0].shoulder, -1.5, theOne.stop); arms[0].elbow = mix(arms[0].elbow, -.18, theOne.stop);
      arms[0].outward = mix(arms[0].outward, -.08, theOne.stop); arms[0].grip = mix(arms[0].grip, .08, theOne.stop);
      arms[1].shoulder = mix(arms[1].shoulder, -.38, theOne.stop); arms[1].elbow = mix(arms[1].elbow, -1.1, theOne.stop);
    }
    if (theOne.block && role === 'neo') for (let i = 0; i < 2; i++) {
      arms[i].shoulder = mix(arms[i].shoulder, i ? -.88 : -1.22, theOne.block); arms[i].elbow = mix(arms[i].elbow, -1.22, theOne.block);
      arms[i].outward = mix(arms[i].outward, (i ? 1 : -1) * .36, theOne.block); arms[i].grip = mix(arms[i].grip, .92, theOne.block);
    }
    if (theOne.dive && role === 'neo') for (let i = 0; i < 2; i++) {
      arms[i].shoulder = mix(arms[i].shoulder, -1.85, theOne.dive); arms[i].elbow = mix(arms[i].elbow, -.2, theOne.dive);
      arms[i].outward = mix(arms[i].outward, (i ? 1 : -1) * .12, theOne.dive); arms[i].grip = mix(arms[i].grip, .82, theOne.dive);
      legs[i].hip = mix(legs[i].hip, i ? -.76 : .2, theOne.dive); legs[i].knee = mix(legs[i].knee, i ? 1.25 : .28, theOne.dive);
    }
    if (theOne.burst && role === 'smith') for (let i = 0; i < 2; i++) {
      arms[i].shoulder = mix(arms[i].shoulder, -.42, theOne.burst); arms[i].elbow = mix(arms[i].elbow, -.12, theOne.burst);
      arms[i].outward = mix(arms[i].outward, (i ? 1 : -1) * .82, theOne.burst); arms[i].grip = mix(arms[i].grip, .06, theOne.burst);
      legs[i].hip = mix(legs[i].hip, i ? -.28 : .22, theOne.burst); legs[i].knee = mix(legs[i].knee, .4, theOne.burst);
    }
    if (theOne.phone && role === 'neo') {
      arms[1].shoulder = mix(arms[1].shoulder, -1.4, theOne.phone); arms[1].elbow = mix(arms[1].elbow, -1.5, theOne.phone);
      arms[1].outward = mix(arms[1].outward, .4, theOne.phone); arms[1].grip = mix(arms[1].grip, .56, theOne.phone);
    }
    if (theOne.flight && role === 'neo') for (let i = 0; i < 2; i++) {
      arms[i].shoulder = mix(arms[i].shoulder, -1.58, theOne.flight); arms[i].elbow = mix(arms[i].elbow, -.12, theOne.flight);
      arms[i].outward = mix(arms[i].outward, (i ? 1 : -1) * .14, theOne.flight); arms[i].grip = mix(arms[i].grip, .28, theOne.flight);
      legs[i].hip = mix(legs[i].hip, i ? -.55 : .22, theOne.flight); legs[i].knee = mix(legs[i].knee, i ? .95 : .3, theOne.flight);
    }
  }
  const catching = input.catch;
  const catchFlying = catching && ['flight', 'ascent'].includes(catching.phase);
  if (catchFlying) for (let i = 0; i < 2; i++) {
    arms[i].shoulder = catching.role === 'trinity' ? -.7 : catching.phase === 'ascent' ? -1.1 : -1.9;
    arms[i].elbow = catching.phase === 'ascent' ? -.85 : -.25;
    arms[i].outward = (i ? 1 : -1) * (catching.role === 'trinity' ? .72 : .2);
    arms[i].grip = catching.role === 'neo' ? .75 : .1;
    legs[i].hip = i ? -.42 : .15; legs[i].knee = i ? .9 : .25;
  }
  if (catching?.role === 'trinity' && ['extract_ready', 'extracting', 'pulse', 'done'].includes(catching.phase)) for (let i = 0; i < 2; i++) {
    arms[i].shoulder = -.55; arms[i].elbow = -.25; legs[i].hip = i ? -.18 : .12; legs[i].knee = i ? .38 : .22;
  }
  if (catching?.role === 'neo' && ['extracting', 'pulse'].includes(catching.phase)) for (let i = 0; i < 2; i++) {
    arms[i].shoulder = catching.phase === 'pulse' ? i ? -.55 : -1.25 : -1.25;
    arms[i].elbow = catching.phase === 'pulse' ? i ? -.45 : -.25 : -1.15;
    arms[i].outward = (i ? 1 : -1) * .3; arms[i].grip = .6;
  }
  const mountainFlight = input.mountainFlight && ['takeoff', 'flying', 'arrived'].includes(input.mountainFlight.phase) || input.truckFlight;
  if (mountainFlight) for (let i = 0; i < 2; i++) {
    arms[i].shoulder = i ? -.25 : -2.15; arms[i].elbow = i ? -.35 : -.08; arms[i].outward = (i ? 1 : -1) * .12; arms[i].grip = i ? .18 : .8;
    legs[i].hip = i ? -.2 : .08; legs[i].knee = i ? .26 : .12;
  }
  if (input.truckPassenger) for (let i = 0; i < 2; i++) {
    arms[i].shoulder = -.92; arms[i].elbow = -.95; arms[i].outward = (i ? 1 : -1) * .38; arms[i].grip = .7;
    legs[i].hip = i ? -.5 : .2; legs[i].knee = i ? .9 : .55;
  }
  if (farewell && input.farewell) {
    const neo = input.farewell.role === 'neo'; const contact = neo ? farewell.neo.hold : farewell.trinity.reach;
    for (let i = 0; i < 2; i++) {
      arms[i].shoulder = mix(arms[i].shoulder, neo ? -.78 : -.52, contact);
      arms[i].elbow = mix(arms[i].elbow, neo ? -1.12 : -.88, contact);
      arms[i].outward = mix(arms[i].outward, (i ? 1 : -1) * (neo ? .25 : .18), contact);
      arms[i].grip = mix(arms[i].grip, neo ? .38 : .12, contact);
    }
    if (!neo) {
      legs[0].hip = -.5; legs[1].hip = .16; legs[0].knee = 1.02; legs[1].knee = .72;
    }
  }
  if (recoveryCrew && input.recoveryCrew) {
    const arm = input.recoveryCrew.role === 'morpheus' ? 0 : 1;
    arms[arm].shoulder = mix(arms[arm].shoulder, -.72, recoveryCrew.support);
    arms[arm].elbow = mix(arms[arm].elbow, -.88, recoveryCrew.support);
    arms[arm].outward = mix(arms[arm].outward, (arm ? 1 : -1) * .32, recoveryCrew.support);
    arms[arm].grip = mix(arms[arm].grip, .08, recoveryCrew.support);
  }
  if (input.performance && !['touch', 'connect'].includes(input.performance)) for (let i = 0; i < 2; i++) {
    const afloat = input.performance === 'float'; const raised = input.performance === 'lift';
    arms[i].shoulder = raised ? -2 : -.5 + (afloat ? Math.sin(state.time * 2 + i) * .2 : 0);
    arms[i].elbow = -.7; arms[i].outward = (i ? 1 : -1) * (afloat ? .65 : .25); arms[i].grip = raised ? .8 : .1;
    legs[i].hip = -.2; legs[i].knee = .45 + (afloat ? Math.sin(state.time * 1.8 + i * Math.PI) * .15 : 0);
  }
  if (input.hotel303?.phase === 'surrender') for (let i = 0; i < 2; i++) {
    arms[i].shoulder = -2.55; arms[i].elbow = -.45; arms[i].outward = (i ? 1 : -1) * .42; arms[i].grip = .1;
    legs[i].hip = 0; legs[i].knee = .12;
  }
  if (input.hotel303?.phase === 'dive') for (let i = 0; i < 2; i++) {
    arms[i].shoulder = -1.35; arms[i].elbow = -.65; arms[i].outward = (i ? 1 : -1) * .38; arms[i].grip = .72;
    legs[i].hip = i ? -.72 : .48; legs[i].knee = i ? 1.12 : .45;
  }
  const roofLeap = input.openingRoofLeap === undefined ? 0 : Math.sin(Math.max(0, Math.min(1, input.openingRoofLeap)) * Math.PI);
  if (roofLeap > 0) for (let i = 0; i < 2; i++) {
    arms[i].shoulder = mix(arms[i].shoulder, -1.9, roofLeap);
    arms[i].elbow = mix(arms[i].elbow, -.25, roofLeap);
    arms[i].outward = mix(arms[i].outward, (i ? 1 : -1) * .22, roofLeap);
    legs[i].hip = mix(legs[i].hip, i ? -.75 : .3, roofLeap);
    legs[i].knee = mix(legs[i].knee, i ? 1.42 : .36, roofLeap);
  }
  const oracleLean = oracle && input.oracleVisit?.role === 'oracle' ? oracle.inspect * .07 : 0;
  const oracleLook = oracle && input.oracleVisit ? (input.oracleVisit.role === 'oracle' ? oracle.listen * .12 : -oracle.listen * .09) : 0;
  const betrayalLean = betrayal ? betrayal.fall * 1.15 + (betrayal.unplugged ? .62 : 0) - betrayal.charge * .2 : 0;
  const betrayalRoll = betrayal?.fall ? (input.betrayal?.role === 'cypher' ? -.86 : .68) * betrayal.fall : 0;
  const rescueLean = rescue?.briefingLean ? rescue.briefingLean * .07 : 0;
  const rescueLook = rescue?.briefingPoint ? (input.rescue?.role === 'trinity' ? -.16 : .13) * rescue.briefingPoint : 0;
  const lobbyLean = lobbyDown * 1.38;
  const lobbyRoll = -1.18 * lobbyDown;
  const governmentLean = government ? government.strain * .42 - government.bend * 1.08 + government.fall * 1.25 - (government.jonesDodge ?? 0) * .24 : 0;
  const governmentRoll = government ? government.bend * (Math.sin(input.government!.elapsed * 2.1) >= 0 ? .42 : -.42) + government.fall * .85 + (government.jonesDodge ?? 0) * .5 : 0;
  const airRescueLean = airRescue ? airRescue.strain * .72 + airRescue.fall * .45 - airRescue.land * .25 : 0;
  const airRescueRoll = airRescue ? airRescue.fall * .5 + airRescue.strain * Math.sin(input.airRescue!.elapsed * 4) * .18 : 0;
  const escapeLean = matrixEscape ? matrixEscape.wall * .75 + matrixEscape.grapple * (input.matrixEscape?.role === 'neo' ? -.82 : .24) - matrixEscape.strike * .32 - matrixEscape.leap * .24 + matrixEscape.brace * .74 : 0;
  const escapeRoll = matrixEscape ? matrixEscape.wall * (input.matrixEscape?.role === 'smith' ? -.68 : .52) + matrixEscape.brace * 1.05 + matrixEscape.transform * Math.sin(input.matrixEscape!.elapsed * 18) * .12 : 0;
  const theOneLean = theOne ? theOne.wound * .92 + theOne.fallen * 1.35 + theOne.kiss * .45 - theOne.revive * .18 + theOne.block * .18 - theOne.dive * .72 + theOne.burst * .32 - theOne.flight * .58 : 0;
  const hotelLean = input.hotel303?.phase === 'dive' ? -.68 : 0;
  const farewellLean = farewell && input.farewell ? input.farewell.role === 'neo' ? farewell.neo.lean : .68 * farewell.trinity.recline : 0;
  const farewellRoll = farewell && input.farewell?.role === 'trinity' ? -.18 * farewell.trinity.recline : 0;
  const theOneRoll = theOne ? theOne.wound * .58 + theOne.fallen * 1.08 + theOne.burst * (.18 + Math.sin(input.theOne!.elapsed * 11) * .12) + theOne.flight * Math.sin(input.theOne!.elapsed * .8) * .08 : 0;
  return { legs, arms, hipHeight, twist, lean: run * .12 + state.landing * .12 + state.airborne * .04 + extension * .10 - kick * .27 - recoil * .35 + (input.crouching ? .26 : 0) + (input.riding ? .2 : 0) + doorPush * .38 + oracleLean + betrayalLean + rescueLean + lobbyLean + governmentLean + airRescueLean + escapeLean + theOneLean + hotelLean + farewellLean + (recoveryCrew?.support ?? 0) * .1 - roofLeap * .45 - (reloaded?.falling ?? 0) * .85 + (reloaded?.dreamAgent ?? 0) * 2 + (reloaded?.down ?? 0) * 1.25 - (reloaded?.flight ?? 0) * .65 - (catchFlying && catching?.role === 'neo' ? .45 : 0) + (catching?.role === 'trinity' && catching.phase === 'flight' ? .25 : 0),
    sway: Math.sin(cycle) * moving * .035, lunge: extension * .16 - kick * .25 - recoil * .22 - dodging * .35 + doorPush * .12 + (matrixEscape?.strike ?? 0) * .32,
    roll: -state.turn * run * .035 - dodging * .22 + betrayalRoll + lobbyRoll + governmentRoll + airRescueRoll + escapeRoll + theOneRoll + farewellRoll + (reloaded?.down ?? 0) * 1.1 - (reloaded?.dodge ?? 0) * .6 + (reloaded?.falling ?? 0) * (input.reloaded?.drift ?? 0) * .055, headTurn: -twist * .65 + glance + oracleLook + rescueLook + (recoveryCrew?.support ?? 0) * (input.recoveryCrew?.role === 'morpheus' ? -.12 : .12), moving, run, airborne: state.airborne,
    coat: moving * (.10 + run * .3) + state.airborne * .18 + kick * .35, impact: extension, landing: state.landing };
}
