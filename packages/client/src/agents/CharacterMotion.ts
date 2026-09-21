import { MELEE_COMBO, COMBO_WINDOW, COMBAT_SKILLS, PLAYER_WALK_SPEED, PLAYER_RUN_SPEED, type CombatSkillId } from '@auto_matrix/shared';

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
}

export const newMotion = (): MotionState => ({ time: 0, phase: 0, speed: 0, turn: 0, airborne: 0, wasGrounded: true, landing: 0, attackAge: 10, combo: 0, hitAge: 10, hitPause: 0, verticalVelocity: 0, skillAge: 10 });
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
  state.time += dt;
  state.speed = mix(state.speed, input.speed, blend);
  state.turn = mix(state.turn, clamp(input.turn, -3, 3), blend);
  state.airborne = mix(state.airborne, input.grounded ? 0 : 1, 1 - Math.exp(-18 * dt));
  if (dt > 0) {
    if (input.grounded && !state.wasGrounded) state.landing = clamp(Math.abs(state.verticalVelocity) / 14, .25, 1);
    state.wasGrounded = input.grounded;
    state.verticalVelocity = input.verticalVelocity;
    state.landing *= Math.exp(-8 * dt);
    state.hitAge += dt;
    state.skillAge += dt;
    if (input.cast !== undefined && input.cast !== state.castId) { state.castId = input.cast; state.skill = input.skill; state.skillAge = 0; }
    if (input.attack !== undefined && input.attack !== state.attackId) {
      state.combo = input.combo ?? (state.attackAge < COMBO_WINDOW ? (state.combo + 1) % 3 : 0);
      state.attackId = input.attack; state.attackAge = 0;
    } else state.attackAge += dt * (input.windingUp ? .28 : 1);
  }
  const run = smooth(clamp((state.speed - PLAYER_WALK_SPEED) / (PLAYER_RUN_SPEED - PLAYER_WALK_SPEED)));
  const stride = mix(.84, 1.22, run);
  const stance = mix(.6, .42, run);
  if (input.grounded) state.phase += input.speed * dt / (2 * stride / stance);
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
  const hipHeight = 1.98 - moving * .08 - run * .12 + bob - state.landing * .20 - guard * .08 - dodging * .3;
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
  const twist = Math.cos(cycle) * moving * mix(.055, .10, run) + (extension * .3 - windup * .16) * (activeArm ? -1 : 1) * guard;
  if (casting) for (const arm of arms) { arm.shoulder = mix(arm.shoulder, -1.35, casting); arm.elbow = mix(arm.elbow, -.25, casting); arm.grip = 0; }
  return { legs, arms, hipHeight, twist, lean: run * .12 + state.landing * .12 + state.airborne * .04 + extension * .10 - kick * .27 - recoil * .35,
    sway: Math.sin(cycle) * moving * .035, lunge: extension * .16 - kick * .25 - recoil * .22 - dodging * .35,
    roll: -state.turn * run * .035 - dodging * .22, headTurn: -twist * .65, moving, run, airborne: state.airborne,
    coat: moving * (.10 + run * .3) + state.airborne * .18 + kick * .35, impact: extension, landing: state.landing };
}
