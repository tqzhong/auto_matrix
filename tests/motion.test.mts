import assert from 'node:assert/strict';
import { test } from 'node:test';
import { advanceMotion, footTrajectory, newMotion, solveLeg } from '../packages/client/src/agents/CharacterMotion.js';
import { MELEE_COMBO } from '@auto_matrix/shared';

test('stance keeps the sole planted and the return stroke lifts clear of the ground', () => {
  const start = footTrajectory(.1, .8, .6); const end = footTrajectory(.3, .8, .6);
  assert.equal(start.lift, 0); assert.equal(end.lift, 0);
  assert.ok(end.z < start.z);
  assert.ok(footTrajectory(.8, .8, .6).lift > .9);
  for (const z of [-.6, 0, .6]) {
    const leg = solveLeg(z, 1.68);
    assert.ok(Math.abs(-.94 * Math.sin(leg.hip) - .9 * Math.sin(leg.hip + leg.knee) - z) < .001);
    assert.ok(Math.abs(leg.hip + leg.knee + leg.ankle) < .001, 'sole stays level');
  }
});

test('movement blends settle consistently at different frame rates and freeze when paused', () => {
  const input = { speed: 14, grounded: true, verticalVelocity: 0, turn: 1 };
  const a = newMotion(); const b = newMotion();
  for (let i = 0; i < 120; i++) advanceMotion(a, input, 1 / 60);
  for (let i = 0; i < 60; i++) advanceMotion(b, input, 1 / 30);
  assert.ok(Math.abs(a.speed - b.speed) < .001);
  assert.ok(Math.abs(a.phase - b.phase) < .05);
  const frozen = structuredClone(a); advanceMotion(a, input, 0); assert.deepEqual(a, frozen);
  advanceMotion(a, { ...input, grounded: false, attack: 37 }, 0); assert.deepEqual(a, frozen, 'paused input cannot start a new pose');
});

test('jump, landing recovery and chained strikes are separate finite poses', () => {
  const motion = newMotion();
  const input = { speed: 0, grounded: false, verticalVelocity: 19, turn: 0 };
  const jump = advanceMotion(motion, input, .1);
  assert.ok(jump.legs[0].knee > .8);
  const landed = advanceMotion(motion, { ...input, grounded: true, verticalVelocity: 0 }, .02);
  assert.ok(landed.hipHeight < jump.hipHeight);
  advanceMotion(motion, { ...input, attack: 1 }, .01);
  for (let i = 0; i < 40; i++) advanceMotion(motion, input, .016);
  advanceMotion(motion, { ...input, attack: 2 }, .01);
  assert.equal(motion.combo, 1);
  assert.ok(Object.values(solveLeg(30, 30)).every(Number.isFinite));
});

test('each strike extends at its damage frame and the finisher is a kick', () => {
  const idle = { speed: 0, grounded: true, verticalVelocity: 0, turn: 0 };
  for (let combo = 0; combo < 3; combo++) {
    const motion = newMotion(); const input = { ...idle, attack: combo, combo };
    advanceMotion(motion, input, .001);
    const windup = advanceMotion(motion, input, .03);
    for (let i = 0; i < Math.round((MELEE_COMBO[combo].contact - .03) * 1000); i++) advanceMotion(motion, input, .001);
    const contact = advanceMotion(motion, input, 0);
    assert.ok(contact.impact > .98, 'visual contact matches authoritative damage timing');
    assert.ok(contact.impact > windup.impact);
    if (combo === 2) assert.ok(contact.legs[0].hip < -1 && contact.legs[0].knee < .3, 'finisher extends the leg');
    else assert.ok(contact.arms[combo].elbow > -.3, 'punch opens the active elbow');
  }
});

test('a confirmed hit adds a short recoil and then returns to locomotion', () => {
  const motion = newMotion(); const idle = { speed: 0, grounded: true, verticalVelocity: 0, turn: 0 };
  const rest = advanceMotion(motion, idle, .1);
  advanceMotion(motion, { ...idle, hit: 1 }, .016);
  for (let i = 0; i < 8; i++) advanceMotion(motion, { ...idle, hit: 1 }, .016);
  const struck = advanceMotion(motion, { ...idle, hit: 1 }, .016);
  assert.ok(struck.lean < rest.lean - .08, 'the torso recoils from contact');
  for (let i = 0; i < 90; i++) advanceMotion(motion, { ...idle, hit: 1 }, .016);
  const recovered = advanceMotion(motion, { ...idle, hit: 1 }, .016);
  assert.ok(Math.abs(recovered.lean - rest.lean) < .01);
});

test('gunfire adds a short arm recoil, recovers, and cannot restart while paused', () => {
  const motion = newMotion(); const input = { speed: 0, grounded: true, verticalVelocity: 0, turn: 0, armed: true };
  const idle = advanceMotion(motion, input, .016);
  const fired = advanceMotion(motion, { ...input, shot: 1 }, .016);
  assert.ok(fired.arms[0].shoulder < idle.arms[0].shoulder - .1);
  for (let i = 0; i < 30; i++) advanceMotion(motion, { ...input, shot: 1 }, .016);
  assert.equal(advanceMotion(motion, input, .016).arms[0].shoulder, idle.arms[0].shoulder);
  const frozen = structuredClone(motion); advanceMotion(motion, { ...input, shot: 2 }, 0);
  assert.deepEqual(motion, frozen);
});

test('the Lafayette greeting walks from saved time and settles Morpheus into the chair', () => {
  const motion = newMotion(); const idle = { speed: 0, grounded: true, verticalVelocity: 0, turn: 0 };
  advanceMotion(motion, { ...idle, welcome: { phase: 'approach', elapsed: 3, role: 'morpheus' as const } }, .1);
  assert.ok(motion.speed > 1.7, 'Morpheus walks away from the window instead of gliding');
  const phase = motion.phase;
  advanceMotion(motion, { ...idle, welcome: { phase: 'approach', elapsed: 3, role: 'morpheus' as const } }, 0);
  assert.equal(motion.phase, phase, 'a paused saved frame does not advance the gait');
  const seated = advanceMotion(motion, { ...idle, welcome: { phase: 'done', elapsed: 5.4, role: 'morpheus' as const } }, 0);
  assert.equal(motion.seated, 1); assert.ok(seated.legs.every(leg => leg.knee > 1.4));
});

test('the Oracle examines Neo and visibly passes the cookie into his hand', () => {
  const idle = { speed: 0, grounded: true, verticalVelocity: 0, turn: 0 };
  const inspecting = advanceMotion(newMotion(), { ...idle, oracleVisit: { phase: 'examining', elapsed: 3, role: 'oracle' as const } }, 0);
  assert.ok(inspecting.arms[0].shoulder < -1.15 && inspecting.arms[0].elbow > -.35, 'the Oracle reaches toward Neo during the examination');
  const offering = advanceMotion(newMotion(), { ...idle, oracleVisit: { phase: 'examining', elapsed: 8.1, role: 'oracle' as const } }, 0);
  const receiving = advanceMotion(newMotion(), { ...idle, oracleVisit: { phase: 'examining', elapsed: 9.1, role: 'neo' as const } }, 0);
  assert.ok(offering.arms[0].elbow < -1 && receiving.arms[0].elbow < -1.1, 'both hands meet during the cookie handoff');
});

test('betrayal performances visibly distinguish the charge, cable pull, collapse and counterattack', () => {
  const idle = { speed: 0, grounded: true, verticalVelocity: 0, turn: 0 };
  const morpheus = advanceMotion(newMotion(), { ...idle, betrayal: { kind: 'bathroom', phase: 'sacrifice', elapsed: 1.9, attempt: 0, role: 'morpheus' as const } }, 0);
  assert.ok(morpheus.arms.every(arm => arm.shoulder < -.9), 'Morpheus drives both shoulders into the sacrificial charge');
  assert.ok(morpheus.lean < -.12, 'the charge moves his weight forward');
  const cypher = advanceMotion(newMotion(), { ...idle, betrayal: { kind: 'unplugged', phase: 'unplugging', elapsed: 2, attempt: 0, role: 'cypher' as const } }, 0);
  assert.ok(cypher.arms[0].elbow < -1.45 && cypher.arms[0].grip > .85, 'Cypher visibly grips and yanks a jack');
  const apoc = advanceMotion(newMotion(), { ...idle, betrayal: { kind: 'unplugged', phase: 'unplugging', elapsed: 3, attempt: 0, role: 'apoc' as const } }, 0);
  assert.ok(apoc.lean > .55 && apoc.arms.every(arm => arm.grip === 0), 'the disconnected body slumps with released hands');
  const tank = advanceMotion(newMotion(), { ...idle, betrayal: { kind: 'unplugged', phase: 'countering', elapsed: 2.1, attempt: 0, role: 'tank' as const } }, 0);
  assert.ok(tank.arms[0].shoulder < -.75 && tank.arms[0].grip > .8, 'Tank raises the pulse rifle during the counterattack');
});

test('rescue preparation points across the briefing and grips the chosen weapon with the correct hands', () => {
  const idle = { speed: 0, grounded: true, verticalVelocity: 0, turn: 0 };
  const tank = advanceMotion(newMotion(), { ...idle, rescue: { phase: 'briefing', elapsed: 2.2, role: 'tank' as const } }, 0);
  assert.ok(tank.arms[0].shoulder < -1 && tank.arms[0].grip > .1, 'Tank points out the projected route instead of standing idle');
  const compact = advanceMotion(newMotion(), { ...idle, armed: true, weaponStyle: 'compact' as const,
    rescue: { phase: 'equipping', elapsed: 3, loadout: 'compact' as const, role: 'neo' as const } }, 0);
  assert.ok(compact.arms.every(arm => arm.grip > .85), 'the dual compact loadout occupies both hands');
  const breacher = advanceMotion(newMotion(), { ...idle, armed: true, weaponStyle: 'breacher' as const,
    rescue: { phase: 'equipping', elapsed: 3, loadout: 'breacher' as const, role: 'neo' as const } }, 0);
  assert.ok(breacher.arms[0].grip > .85 && breacher.arms[1].grip < .6, 'the single long gun keeps one primary grip distinct from dual weapons');
});
