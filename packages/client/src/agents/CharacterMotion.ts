import { MELEE_COMBO, COMBO_WINDOW, COMBAT_SKILLS, PLAYER_WALK_SPEED, PLAYER_RUN_SPEED, type CombatSkillId, type AwakeningPose, type AwakeningReveal, type OfficePhone, pillPose, lafayetteWelcomePose, oracleVisitPose, betrayalPose, type PillGesture, type InterrogationGesture, type LafayetteWelcomeGesture, type TrainingGesture, type OracleVisitGesture, type BetrayalGesture } from '@auto_matrix/shared';

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
  recovery?: number;
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
  const exiting = input.pills?.role === 'neo' && input.pills.phase === 'taking' && input.pills.elapsed > 11;
  const welcome = input.welcome && lafayetteWelcomePose(input.welcome);
  const oracle = input.oracleVisit && oracleVisitPose(input.oracleVisit);
  const betrayal = input.betrayal && betrayalPose(input.betrayal);
  const welcomeWalking = input.welcome?.phase === 'approach' || input.welcome?.phase === 'departing' && input.welcome.role !== 'neo';
  const welcomeSpeed = input.welcome?.role === 'morpheus' ? 2.6 : input.welcome?.role === 'neo' ? 2.3 : 1.8;
  const speed = input.pills ? exiting ? 1.7 : 0 : welcomeWalking ? welcomeSpeed : input.speed;
  state.time += dt;
  state.speed = mix(state.speed, input.riding || input.climbing !== undefined ? 0 : speed, blend);
  state.climbPhase += (input.climbing ?? 0) * dt * 5;
  state.seated = pills ? pills.seat : welcome ? welcome.seated : mix(state.seated, input.seated || input.riding || input.performance === 'connect' || input.performance === 'construct' ? 1 : 0, blend);
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
  if (exiting) state.phase = (input.pills!.elapsed - 11) * 1.1;
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
  const hipHeight = 1.98 - moving * .08 - run * .12 + bob - state.landing * .20 - guard * .08 - dodging * .3 - (input.crouching ? .9 : 0) - state.seated * .6 - (input.floorSeated ? .85 : 0);
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
  const glance = input.vase === undefined ? 0 : Math.sin(clamp((input.vase - .5) / 2.5) * Math.PI) * .15;
  const twist = Math.cos(cycle) * moving * mix(.055, .10, run) + (extension * .3 - windup * .16) * (activeArm ? -1 : 1) * guard + glance;
  if (casting) for (const arm of arms) { arm.shoulder = mix(arm.shoulder, -1.35, casting); arm.elbow = mix(arm.elbow, -.25, casting); arm.grip = 0; }
  if (input.armed && guard < .1 && !casting) for (const arm of arms) {
    const kickback = Math.max(0, 1 - state.shotAge / .18) ** 2;
    arm.shoulder = -1.16 - recoil * .1 - kickback * .16; arm.elbow = -.4 - kickback * .12; arm.outward *= .4; arm.grip = .9;
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
  if (input.performance === 'touch') { arms[0].shoulder = -1.5; arms[0].elbow = -.06; arms[0].grip = 0; }
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
  if (input.performance && !['touch', 'connect'].includes(input.performance)) for (let i = 0; i < 2; i++) {
    const afloat = input.performance === 'float'; const raised = input.performance === 'lift';
    arms[i].shoulder = raised ? -2 : -.5 + (afloat ? Math.sin(state.time * 2 + i) * .2 : 0);
    arms[i].elbow = -.7; arms[i].outward = (i ? 1 : -1) * (afloat ? .65 : .25); arms[i].grip = raised ? .8 : .1;
    legs[i].hip = -.2; legs[i].knee = .45 + (afloat ? Math.sin(state.time * 1.8 + i * Math.PI) * .15 : 0);
  }
  const oracleLean = oracle && input.oracleVisit?.role === 'oracle' ? oracle.inspect * .07 : 0;
  const oracleLook = oracle && input.oracleVisit ? (input.oracleVisit.role === 'oracle' ? oracle.listen * .12 : -oracle.listen * .09) : 0;
  const betrayalLean = betrayal ? betrayal.fall * 1.15 + (betrayal.unplugged ? .62 : 0) - betrayal.charge * .2 : 0;
  const betrayalRoll = betrayal?.fall ? (input.betrayal?.role === 'cypher' ? -.86 : .68) * betrayal.fall : 0;
  return { legs, arms, hipHeight, twist, lean: run * .12 + state.landing * .12 + state.airborne * .04 + extension * .10 - kick * .27 - recoil * .35 + (input.crouching ? .26 : 0) + (input.riding ? .2 : 0) + oracleLean + betrayalLean,
    sway: Math.sin(cycle) * moving * .035, lunge: extension * .16 - kick * .25 - recoil * .22 - dodging * .35,
    roll: -state.turn * run * .035 - dodging * .22 + betrayalRoll, headTurn: -twist * .65 + glance + oracleLook, moving, run, airborne: state.airborne,
    coat: moving * (.10 + run * .3) + state.airborne * .18 + kick * .35, impact: extension, landing: state.landing };
}
