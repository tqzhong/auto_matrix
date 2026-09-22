import assert from 'node:assert/strict';
import test from 'node:test';
import { filmPosition, filmEntry, FILM_SCENE_BY_ID, FILM_SETS, LOBBY_MAGAZINE, RESCUE_LOADOUTS, lobbyCover, type CombatImpact, type RescueLoadout } from '@auto_matrix/shared';
import { WorldState } from '../packages/server/src/world/WorldState.js';
import { AgentManager } from '../packages/server/src/agents/AgentManager.js';
import { SandboxSystem } from '../packages/server/src/player/SandboxSystem.js';
import type { WorldDynamics } from '../packages/server/src/story/WorldDynamics.js';

function setup(loadout?: RescueLoadout) {
  const world = new WorldState(); new AgentManager(world).initializeAllAgents();
  const sandbox = new SandboxSystem(world, { record() {} } as unknown as WorldDynamics, 42);
  const neo = world.agents.get('neo')!; neo.controller = 'player'; sandbox.enter(neo); sandbox.life.begin(neo, 0);
  neo.position = filmPosition('film_government_lobby', 0, 19); neo.currentLocation = 'film_government_lobby'; neo.isInMatrix = true;
  sandbox.state.neoLife!.journey = { version: 1, scene: 'm1_lobby', step: 1, actor: 'neo', completed: [], enteredAt: 0, checkpoint: { ...neo.position }, reflections: {}, lastText: '', fighting: true,
    rescue: loadout ? { phase: 'equipped', elapsed: 0, loadout } : undefined };
  const lobby = sandbox.life.film.lobby; lobby.start(neo, 0);
  const impacts: CombatImpact[] = []; sandbox.onImpact = impact => impacts.push(impact);
  return { world, sandbox, lobby, neo, impacts };
}

test('the lobby begins outside the security gate so entering the hall remains playable', () => {
  const start = filmEntry(FILM_SCENE_BY_ID.m1_lobby); const center = FILM_SETS.film_government_lobby.center;
  assert.ok(start.z - center.z > 30, 'entry must be behind the gate at local z=29');
  assert.ok(Math.abs(start.z - filmPosition('film_government_lobby', 0, 23).z) > 4, 'the first objective must not complete on spawn');
});

test('each physical Construct loadout keeps its own magazine, damage and reload timing in the lobby', () => {
  for (const loadout of Object.keys(RESCUE_LOADOUTS) as RescueLoadout[]) {
    const h = setup(loadout); const spec = RESCUE_LOADOUTS[loadout]; const enemy = h.sandbox.state.threats[0];
    h.sandbox.state.threats = [enemy]; enemy.position = filmPosition('film_government_lobby', 0, 5);
    assert.equal(h.lobby.state!.loadout, loadout); assert.equal(h.lobby.state!.ammo, spec.magazine);
    h.lobby.shoot(h.neo, Math.PI, 2); assert.equal(enemy.health, enemy.maxHealth - spec.damage);
    h.lobby.state!.ammo = 0; h.lobby.shoot(h.neo, Math.PI, 10);
    assert.equal(h.lobby.state!.reloadAt, 10 + spec.reloadTicks);
    h.lobby.tick(h.neo, 9 + spec.reloadTicks); assert.equal(h.lobby.state!.ammo, 0);
    h.lobby.tick(h.neo, 10 + spec.reloadTicks); assert.equal(h.lobby.state!.ammo, spec.magazine);
    const ally = h.world.agents.get('trinity')!;
    ally.currentAction = { type: 'idle', parameters: { resolved: true, armed: true, weaponStyle: loadout === 'rifle' ? 'compact' : 'rifle' }, startedAt: 0, duration: 1, progress: 0 };
    h.lobby.tick(h.neo, 30); assert.equal(ally.currentAction.parameters.weaponStyle, loadout, 'the saved ally model must match Neo loadout after reconnect');
  }
});

test('lobby gunfire hits the first visible target, consumes ammunition, and cannot penetrate a column', () => {
  const { sandbox, lobby, neo, impacts } = setup();
  const enemy = sandbox.state.threats[0]; sandbox.state.threats = [enemy];
  enemy.position = filmPosition('film_government_lobby', 0, 5);
  lobby.shoot(neo, Math.PI, 1); assert.equal(enemy.health, 24); assert.equal(lobby.state!.ammo, LOBBY_MAGAZINE - 1);
  neo.position = filmPosition('film_government_lobby', 10.2, 23); enemy.position = filmPosition('film_government_lobby', 10.2, 9);
  lobby.shoot(neo, Math.PI, 2); assert.equal(enemy.health, 24); assert.equal(impacts.at(-1)!.shot!.surface, 'stone');
  assert.ok(lobby.state!.columns.some(damage => damage > 0));
  for (let i = 0; i < 6; i++) lobby.shoot(neo, Math.PI, 3);
  assert.equal(enemy.health, 24, 'chipping the facing does not remove structural cover');
  const cover = lobbyCover({ ...neo.position, y: 3.3 }, { x: 0, y: 0, z: -1 }, FILM_SETS.film_government_lobby.center);
  assert.ok(cover.distance < 7);
});

test('empty magazines cannot damage targets; reload survives saving and finishes at its deadline', () => {
  const h = setup(); h.lobby.state!.ammo = 0; const health = h.sandbox.state.threats.map(t => t.health);
  h.lobby.shoot(h.neo, Math.PI, 10); assert.deepEqual(h.sandbox.state.threats.map(t => t.health), health);
  h.sandbox.restore(JSON.parse(JSON.stringify(h.sandbox.state)));
  assert.equal(h.lobby.state!.reloadAt, 14);
  h.lobby.tick(h.neo, 13); assert.equal(h.lobby.state!.ammo, 0);
  h.lobby.tick(h.neo, 14); assert.equal(h.lobby.state!.ammo, LOBBY_MAGAZINE);
  h.sandbox.state.neoLife!.journey!.visiting = 'm1_dojo'; h.lobby.shoot(h.neo, Math.PI, 15);
  assert.equal(h.lobby.state!.ammo, LOBBY_MAGAZINE, 'a scene revisit cannot fire into the saved encounter');
});

test('soldiers announce a fixed aim before firing, so movement and cover avoid damage', () => {
  const { world, sandbox, lobby, neo } = setup(); const enemy = sandbox.state.threats[0]; sandbox.state.threats = [enemy];
  world.agents.get('trinity')!.controller = 'player'; // Isolate the soldier from allied interruption.
  enemy.position = filmPosition('film_government_lobby', 0, -5);
  lobby.tick(neo, 6); assert.ok(enemy.aim); assert.equal(neo.health, 100);
  neo.position.x += 5;
  lobby.tick(neo, 8); assert.equal(neo.health, 100, 'moving out of the announced line evades the shot');
  enemy.stunUntil = 0; lobby.tick(neo, 14); lobby.tick(neo, 16);
  assert.ok(neo.health < 100, 'remaining in an exposed aim line permits damage');
});

test('three waves and the elevator form one encounter, with Trinity assisting and retry restoring it', () => {
  const { world, sandbox, lobby, neo } = setup();
  let tick = 1; let waveCount = 0;
  while (waveCount < 3) {
    waveCount++;
    for (const enemy of [...sandbox.state.threats]) {
      for (let i = 0; enemy.health > 0 && i < 10; i++) {
        neo.position = { ...enemy.position, z: enemy.position.z + 2 }; neo.rotation = Math.PI;
        sandbox.attack(neo, tick, 2);
      }
      assert.equal(enemy.health, 0);
    }
    if (waveCount < 3) { lobby.tick(neo, tick); tick += 3; assert.equal(lobby.tick(neo, tick), false); }
  }
  sandbox.life.film.tick(++tick); assert.equal(sandbox.life.film.state!.step, 2);
  assert.equal(world.agents.get('trinity')!.currentLocation, 'film_government_lobby');
  const journey = sandbox.life.film.state!; journey.step = 1; journey.lastText = '增援从侧廊进入。';
  neo.status = 'dead'; neo.health = 0; sandbox.life.film.command(neo, 'retry', ++tick);
  assert.equal(neo.health, 100); assert.equal(journey.step, 1); assert.equal(journey.lobby!.ammo, LOBBY_MAGAZINE);
  assert.match(journey.lastText, /检查点/, 'retry must clear stale battle instructions from the HUD');
  neo.position = filmPosition('film_government_lobby', 0, 19); sandbox.life.film.command(neo, 'act', ++tick);
  assert.equal(journey.lobby!.wave, 1); assert.equal(sandbox.state.threats.length, 2);
});

test('gunfire can clear all three waves, reload mid-encounter, and unlock the elevator', () => {
  const { sandbox, lobby, neo } = setup(); let tick = 1;
  while (lobby.state!.kills < 8) {
    const enemies = [...sandbox.state.threats];
    assert.ok(enemies.length, 'each wave must spawn its guards');
    for (const enemy of enemies) {
      neo.position = { ...enemy.position, z: enemy.position.z + 7 };
      while (enemy.health > 0) {
        if (!lobby.state!.ammo) { lobby.reload(neo, tick); tick += 4; lobby.tick(neo, tick); }
        lobby.shoot(neo, Math.PI, ++tick);
      }
    }
    lobby.tick(neo, ++tick); tick += 3; lobby.tick(neo, tick);
  }
  assert.equal(lobby.state!.wave, 3); assert.ok(lobby.state!.shots > LOBBY_MAGAZINE);
  sandbox.life.film.tick(++tick); assert.equal(sandbox.life.film.state!.step, 2);
  neo.position = filmPosition('film_government_lobby', 0, -35);
  sandbox.life.film.command(neo, 'act', ++tick); sandbox.life.film.tick(tick + 2);
  assert.equal(sandbox.life.film.state!.step, 3);
  assert.ok(sandbox.life.film.state!.completed.includes('m1_lobby'));
});

test('Trinity fires at visible guards and stops assisting while another player controls her', () => {
  const { world, sandbox, lobby, neo, impacts } = setup();
  lobby.tick(neo, 1);
  assert.ok(impacts.some(hit => hit.source === 'trinity' && hit.damage > 0));
  world.agents.get('trinity')!.controller = 'player'; impacts.length = 0;
  sandbox.state.threats.forEach(enemy => { enemy.stunUntil = 100; });
  lobby.tick(neo, 10);
  assert.ok(!impacts.some(hit => hit.source === 'trinity'));
});
