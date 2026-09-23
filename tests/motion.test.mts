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

test('the lobby entrance draws weapons after the alarm and leaves the checkpoint guard visibly down', () => {
  const idle = { speed: 0, grounded: true, verticalVelocity: 0, turn: 0 };
  const waiting = advanceMotion(newMotion(), { ...idle, lobbyEntry: { phase: 'checkpoint', elapsed: 1.4, role: 'neo' as const } }, 0);
  assert.ok(waiting.arms.every(arm => arm.grip < .5), 'Neo does not aim a weapon before the checkpoint alarm');
  const drawing = advanceMotion(newMotion(), { ...idle, armed: true, lobbyEntry: { phase: 'checkpoint', elapsed: 4.4, role: 'neo' as const } }, 0);
  assert.ok(drawing.arms[0].grip > .85 && drawing.arms[0].shoulder < -.9, 'Neo visibly clears and raises the selected weapon');
  const guard = advanceMotion(newMotion(), { ...idle, lobbyEntry: { phase: 'down', elapsed: 7.2, role: 'guard' as const } }, 0);
  assert.ok(guard.hipHeight < .7 && guard.lean > 1.2 && Math.abs(guard.roll) > 1, 'the guard reaches the floor instead of remaining bent upright');
});

test('government rescue performances visibly restrain Morpheus and form Neo bullet-time bend', () => {
  const idle = { speed: 0, grounded: true, verticalVelocity: 0, turn: 0 };
  const morpheus = advanceMotion(newMotion(), { ...idle, seated: true,
    government: { kind: 'questioning', phase: 'monologue', elapsed: 7.8, attempt: 0, resolve: .45, role: 'morpheus' as const } }, 0);
  assert.ok(morpheus.arms.every(arm => arm.elbow < -1.2 && arm.grip > .65), 'both restrained wrists stay planted on the chair arms');
  assert.ok(morpheus.lean > .15, 'drug pressure visibly pulls Morpheus forward');
  const smith = advanceMotion(newMotion(), { ...idle,
    government: { kind: 'questioning', phase: 'monologue', elapsed: 3.2, attempt: 0, resolve: .8, role: 'smith' as const } }, 0);
  assert.ok(smith.arms[1].shoulder < -1.25 && smith.arms[1].elbow < -1.1, 'Smith reaches to the earpiece before speaking privately');
  const neo = advanceMotion(newMotion(), { ...idle, armed: true,
    government: { kind: 'rooftop', phase: 'bullet_time', elapsed: 2.65, attempt: 0, dodges: 1, wounds: 0, resolved: [0], role: 'neo' as const } }, 0);
  assert.ok(neo.hipHeight < 1.15 && neo.lean < -.75, 'Neo drops his hips and arches under the firing line');
  assert.ok(Math.abs(neo.roll) > .2 && neo.arms.every(arm => arm.grip > .7), 'the dodge twists the torso while keeping empty pistols in hand');
  const trinity = advanceMotion(newMotion(), { ...idle, armed: true,
    government: { kind: 'rooftop', phase: 'trinity', elapsed: 1.4, attempt: 0, dodges: 2, wounds: 1, resolved: [0, 1, 2], role: 'trinity' as const } }, 0);
  assert.ok(trinity.arms[0].shoulder < -1 && trinity.arms[0].grip > .85, 'Trinity holds the close-range firing pose');
});

test('air rescue performances distinguish the mounted gun, falling catch and roof rope shock', () => {
  const idle = { speed: 0, grounded: true, verticalVelocity: 0, turn: 0 };
  const gunner = advanceMotion(newMotion(), { ...idle,
    airRescue: { kind: 'office', phase: 'firing', elapsed: 2, attempt: 0, suppression: .65, role: 'neo' as const } }, 0);
  assert.ok(gunner.arms.every(arm => arm.grip > .9 && arm.shoulder < -.8), 'Neo visibly grips the mounted gun with both hands');
  const morpheus = advanceMotion(newMotion(), { ...idle,
    airRescue: { kind: 'office', phase: 'catching', elapsed: 1.8, attempt: 0, suppression: 1, role: 'morpheus' as const } }, 0);
  assert.ok(morpheus.legs.every(leg => leg.knee > .35), 'Morpheus hangs below the helicopter instead of standing in mid-air');
  assert.ok(morpheus.arms[0].elbow > -.5 && Math.abs(morpheus.roll) > .1, 'Morpheus reaches into the catch while falling');
  const neo = advanceMotion(newMotion(), { ...idle,
    airRescue: { kind: 'roof', phase: 'bracing', elapsed: 3.35, attempt: 0, grip: .62, braces: 1, misses: 0, resolved: [0], role: 'neo' as const } }, 0);
  assert.ok(neo.arms.every(arm => arm.grip > .9 && arm.elbow < -1), 'Neo keeps both hands closed around the roof rope');
  assert.ok(neo.hipHeight < 1.75 && neo.lean > .35, 'the rope shock visibly pulls Neo off balance');
  const trinity = advanceMotion(newMotion(), { ...idle,
    airRescue: { kind: 'roof', phase: 'pulling', elapsed: .9, attempt: 0, grip: .8, braces: 2, misses: 1, resolved: [0, 1], ropeCut: true, role: 'trinity' as const } }, 0);
  assert.ok(trinity.arms[1].shoulder < -1 && trinity.arms[1].grip > .85, 'Trinity raises the pistol to cut free of the aircraft');
});

test('armed shoulders follow vertical aim while recoil remains finite', () => {
  const idle = { speed: 0, grounded: true, verticalVelocity: 0, turn: 0, armed: true };
  const level = advanceMotion(newMotion(), { ...idle, aimPitch: 0 }, 0);
  const upward = advanceMotion(newMotion(), { ...idle, aimPitch: -.35 }, 0);
  assert.ok(upward.arms[0].shoulder < level.arms[0].shoulder - .2, 'raising the camera raises the weapon arm');
  assert.ok(Object.values(upward.arms[0]).every(Number.isFinite));
});
