import assert from 'node:assert/strict';
import test from 'node:test';
import { FILM_SCENE_BY_ID, filmPosition, filmStepPosition, HEL_COATCHECK, HEL_DANCE_DOOR, helCoatcheckCover, playerBlocked, type CombatImpact } from '@auto_matrix/shared';
import { WorldState } from '../packages/server/src/world/WorldState.js';
import { AgentManager } from '../packages/server/src/agents/AgentManager.js';
import { SandboxSystem } from '../packages/server/src/player/SandboxSystem.js';
import type { WorldDynamics } from '../packages/server/src/story/WorldDynamics.js';

function setup() {
  const world = new WorldState(); new AgentManager(world).initializeAllAgents();
  const sandbox = new SandboxSystem(world, { record() {} } as unknown as WorldDynamics, 42);
  const neo = world.agents.get('neo')!; sandbox.enter(neo); sandbox.life.begin(neo, 0);
  const trinity = world.agents.get('trinity')!; trinity.controller = 'player'; sandbox.enter(trinity);
  trinity.position = filmStepPosition(FILM_SCENE_BY_ID.m3_hel_entry, FILM_SCENE_BY_ID.m3_hel_entry.steps[1]);
  trinity.currentLocation = 'film_club_hel'; trinity.isInMatrix = true;
  sandbox.state.neoLife!.journey = { version: 1, scene: 'm3_hel_entry', step: 1, actor: 'trinity', completed: [], enteredAt: 0,
    checkpoint: { ...trinity.position }, reflections: {}, lastText: '', helElevator: { phase: 'open', elapsed: 4.2, lastTick: 0 } };
  for (const [id, x] of [['morpheus', -4], ['seraph', 4]] as const) {
    const ally = world.agents.get(id)!; ally.position = filmPosition('film_club_hel', x, 20); ally.currentLocation = 'film_club_hel'; ally.isInMatrix = true;
  }
  const impacts: CombatImpact[] = []; sandbox.onImpact = impact => impacts.push(impact);
  return { world, sandbox, trinity, impacts, combat: sandbox.life.film.coatcheck };
}

test('coat check starts with five authored guards in two saved groups and an armed Trinity', () => {
  const h = setup(); h.sandbox.life.film.command(h.trinity, 'act', 1);
  const state = h.sandbox.life.film.state!;
  assert.equal(state.helCoatcheck!.phase, 'combat'); assert.equal(state.helCoatcheck!.wave, 1);
  assert.equal(state.helCoatcheck!.ammo, HEL_COATCHECK.magazine);
  assert.equal(h.sandbox.state.threats.filter(threat => threat.scene === 'm3_hel_entry').length, 3);
  assert.equal(h.combat.active(h.trinity), true);
});

test('Trinity can shoot, while coat counters block shots and create impacts', () => {
  const h = setup(); h.sandbox.life.film.command(h.trinity, 'act', 1);
  const enemy = h.sandbox.state.threats[0]; h.sandbox.state.threats = [enemy];
  h.trinity.position = filmPosition('film_club_hel', 0, 19); enemy.position = filmPosition('film_club_hel', 0, 7);
  const before = enemy.health;
  h.combat.shoot(h.trinity, Math.PI, 0, 2);
  assert.equal(enemy.health, before - HEL_COATCHECK.damage);
  assert.equal(h.combat.state!.ammo, HEL_COATCHECK.magazine - 1);
  h.trinity.position = filmPosition('film_club_hel', 14, 19); enemy.position = filmPosition('film_club_hel', 14, 5);
  assert.ok(helCoatcheckCover({ ...h.trinity.position, y: h.trinity.position.y + 2.3 }, { x: 0, y: 0, z: -1 }).distance < 14);
  h.combat.shoot(h.trinity, Math.PI, 0, 3);
  assert.equal(enemy.health, before - HEL_COATCHECK.damage);
  assert.equal(h.impacts.at(-1)?.shot?.surface, 'stone');
});

test('reload and enemy aim survive a save; moving off the announced line avoids damage', () => {
  const h = setup(); h.sandbox.life.film.command(h.trinity, 'act', 1);
  h.combat.state!.ammo = 0; h.combat.reload(h.trinity, 3);
  h.sandbox.restore(JSON.parse(JSON.stringify(h.sandbox.state)));
  assert.equal(h.combat.state!.reloadAt, 3 + HEL_COATCHECK.reloadTicks);
  h.combat.tick(h.trinity, 3 + HEL_COATCHECK.reloadTicks);
  assert.equal(h.combat.state!.ammo, HEL_COATCHECK.magazine);
  const enemy = h.sandbox.state.threats[0]; h.sandbox.state.threats = [enemy];
  enemy.position = filmPosition('film_club_hel', 0, 6); h.trinity.position = filmPosition('film_club_hel', 0, 18);
  enemy.lastStrike = 3; delete enemy.aim; delete enemy.attackAt;
  h.combat.tick(h.trinity, 10); assert.ok(enemy.aim, JSON.stringify({ enemy, actor: h.trinity.position, state: h.combat.state }));
  h.trinity.position.x += 5; h.combat.tick(h.trinity, 12);
  assert.equal(h.trinity.health, h.trinity.maxHealth);
});

test('Morpheus and Seraph assist, the last guard unlocks the weapon check, and retry resets the room', () => {
  const h = setup(); h.sandbox.life.film.command(h.trinity, 'act', 1);
  for (const threat of h.sandbox.state.threats) threat.stunUntil = 100;
  h.combat.tick(h.trinity, 4);
  assert.ok(h.impacts.some(impact => ['morpheus', 'seraph'].includes(impact.source) && impact.damage > 0), JSON.stringify({ impacts: h.impacts, allies: ['morpheus', 'seraph'].map(id => h.world.agents.get(id)?.position) }));
  h.world.agents.get('morpheus')!.controller = 'other-player'; h.world.agents.get('seraph')!.controller = 'other-player';
  h.impacts.length = 0; h.combat.tick(h.trinity, 10);
  assert.ok(!h.impacts.some(impact => ['morpheus', 'seraph'].includes(impact.source)));
  for (const threat of h.sandbox.state.threats) threat.health = 0;
  h.sandbox.state.threats = []; h.combat.tick(h.trinity, 11); h.combat.tick(h.trinity, 14);
  assert.equal(h.combat.state!.wave, 2); assert.equal(h.sandbox.state.threats.length, 2);
  h.sandbox.state.threats = []; h.sandbox.life.film.tick(15);
  assert.equal(h.sandbox.life.film.state!.step, 2);
  h.sandbox.life.film.state!.step = 1; h.trinity.health = 0; h.trinity.status = 'dead';
  h.sandbox.life.film.command(h.trinity, 'retry', 16);
  assert.equal(h.combat.state!.phase, 'ready'); assert.equal(h.trinity.health, h.trinity.maxHealth);
});

test('player gunfire can clear both guard groups without scripted removal', () => {
  const h = setup(); h.sandbox.life.film.command(h.trinity, 'act', 1);
  h.world.agents.get('morpheus')!.controller = 'other-player'; h.world.agents.get('seraph')!.controller = 'other-player';
  h.trinity.position = filmPosition('film_club_hel', 0, 19);
  let tick = 2;
  for (let wave = 1; wave <= 2; wave++) {
    for (const enemy of [...h.sandbox.state.threats]) {
      for (const other of h.sandbox.state.threats) if (other !== enemy) other.position = filmPosition('film_club_hel', 20, 0);
      enemy.position = filmPosition('film_club_hel', 0, 7);
      for (let shot = 0; enemy.health > 0 && shot < 4; shot++) h.combat.shoot(h.trinity, Math.PI, 0, tick++);
      assert.equal(enemy.health, 0);
    }
    h.combat.tick(h.trinity, tick++);
    if (wave === 1) h.combat.tick(h.trinity, tick += 3);
  }
  h.sandbox.life.film.tick(tick++);
  assert.equal(h.combat.state!.kills, 5);
  assert.equal(h.sandbox.life.film.state!.step, 2);
});

test('an older mid-fight save replaces the generic melee group at the same checkpoint', () => {
  const h = setup(); const journey = h.sandbox.life.film.state!;
  journey.fighting = true;
  h.sandbox.state.threats = [{ id: 'legacy-guard', scene: 'm3_hel_entry', kind: 'agent', position: filmPosition('film_club_hel', 0, 8),
    matrix: true, health: 48, maxHealth: 48, target: 'trinity', stunUntil: 0, lastStrike: 0 }];
  h.sandbox.life.film.tick(2);
  assert.equal(journey.helCoatcheck!.wave, 1);
  assert.equal(h.sandbox.state.threats.filter(threat => threat.scene === 'm3_hel_entry').length, 3);
  assert.ok(!h.sandbox.state.threats.some(threat => threat.id === 'legacy-guard'));
});

test('the saved guard count includes a close-range knockout as well as gunfire', () => {
  const h = setup(); h.sandbox.life.film.command(h.trinity, 'act', 1);
  const enemy = h.sandbox.state.threats[0]; enemy.position = filmPosition('film_club_hel', 0, 8); enemy.health = 1;
  for (const other of h.sandbox.state.threats) if (other !== enemy) other.position = filmPosition('film_club_hel', 20, 0);
  h.trinity.position = filmPosition('film_club_hel', 0, 10); h.trinity.rotation = Math.PI;
  h.sandbox.attack(h.trinity, 2);
  assert.equal(enemy.health, 0);
  h.combat.tick(h.trinity, 3);
  assert.equal(h.combat.state!.kills, 1);
});

test('the heavy door holds the dance floor until Trinity pushes it open, then saves a passable route', () => {
  const h = setup(); const film = h.sandbox.life.film; const journey = film.state!;
  journey.step = 3; journey.helDanceDoor = { phase: 'sealed', elapsed: 0, lastTick: 0 };
  h.trinity.position = filmStepPosition(FILM_SCENE_BY_ID.m3_hel_entry, FILM_SCENE_BY_ID.m3_hel_entry.steps[3]);
  film.reconcileCast();
  const threshold = filmPosition('film_club_hel', 0, HEL_DANCE_DOOR.z);
  assert.equal(playerBlocked(threshold, true, .7, h.sandbox.state.structures), true);
  assert.equal(playerBlocked(filmPosition('film_club_hel', 9.5, HEL_DANCE_DOOR.z), true, .7, h.sandbox.state.structures), true,
    'the masonry beside the door cannot be used to bypass the door');
  film.command(h.trinity, 'act', 2);
  assert.equal(journey.helDanceDoor.phase, 'opening');
  film.tick(4);
  assert.equal(journey.step, 3); assert.equal(journey.helDanceDoor.elapsed, 1);
  assert.equal(playerBlocked(threshold, true, .7, h.sandbox.state.structures), true);
  h.trinity.controller = null; film.tick(20);
  assert.equal(journey.helDanceDoor.elapsed, 1, 'disconnect pauses the opening');
  h.trinity.controller = 'player';
  h.sandbox.restore(JSON.parse(JSON.stringify(h.sandbox.state)));
  assert.equal(film.state!.helDanceDoor?.elapsed, 1);
  film.tick(22);
  assert.equal(film.state!.step, 3);
  film.tick(26);
  assert.equal(film.state!.step, 4);
  assert.equal(film.state!.helDanceDoor?.phase, 'open');
  assert.equal(playerBlocked(threshold, true, .7, h.sandbox.state.structures), false);
});

test('an older save already walking through Club Hel keeps its progress and an open door', () => {
  const h = setup(); const journey = h.sandbox.life.film.state!;
  journey.step = 3; delete journey.helDanceDoor;
  h.trinity.position = filmPosition('film_club_hel', 0, -13);
  h.sandbox.restore(JSON.parse(JSON.stringify(h.sandbox.state)));
  assert.equal(h.sandbox.life.film.state!.step, 4);
  assert.equal(h.sandbox.life.film.state!.helDanceDoor?.phase, 'open');
  assert.equal(playerBlocked(filmPosition('film_club_hel', 0, HEL_DANCE_DOOR.z), true, .7, h.sandbox.state.structures), false);
});

test('an older save after Club Hel remains completed with the inserted door objective', () => {
  const h = setup(); const journey = h.sandbox.life.film.state!;
  journey.step = 4; journey.completed.push('m3_hel_entry'); delete journey.helDanceDoor;
  h.sandbox.restore(JSON.parse(JSON.stringify(h.sandbox.state)));
  assert.equal(h.sandbox.life.film.state!.step, FILM_SCENE_BY_ID.m3_hel_entry.steps.length);
  assert.equal(h.sandbox.life.film.state!.helDanceDoor?.phase, 'open');
});

test('Morpheus and Seraph regroup at the dance door and follow Trinity without moving another player', () => {
  const h = setup(); const film = h.sandbox.life.film; const journey = film.state!;
  journey.step = 3; journey.helDanceDoor = { phase: 'sealed', elapsed: 0, lastTick: 0 };
  h.trinity.position = filmStepPosition(FILM_SCENE_BY_ID.m3_hel_entry, FILM_SCENE_BY_ID.m3_hel_entry.steps[3]);
  const morpheus = h.world.agents.get('morpheus')!; const seraph = h.world.agents.get('seraph')!;
  seraph.controller = 'other-player'; const seraphStart = { ...seraph.position };
  film.tick(2);
  assert.ok(morpheus.position.z < filmPosition('film_club_hel', 0, 20).z);
  assert.deepEqual(seraph.position, seraphStart);
  film.command(h.trinity, 'act', 2);
  for (let tick = 3; tick <= 8; tick++) film.tick(tick);
  assert.equal(journey.helDanceDoor.phase, 'open');
  assert.ok(morpheus.position.z <= filmPosition('film_club_hel', 0, 8).z);
  h.trinity.position = filmPosition('film_club_hel', 0, -8);
  film.tick(9);
  assert.ok(morpheus.velocity.z < 0, 'the companion follows through the open doorway');
  assert.deepEqual(seraph.position, seraphStart);
});
