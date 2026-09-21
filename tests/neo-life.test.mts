import assert from 'node:assert/strict';
import { test } from 'node:test';
import { WorldState } from '../packages/server/src/world/WorldState.js';
import { AgentManager } from '../packages/server/src/agents/AgentManager.js';
import { SandboxSystem } from '../packages/server/src/player/SandboxSystem.js';
import { LIFE_ACTIONS, LIFE_ROOMS, NEO_CHAPTERS, NEO_MISSIONS, LOCATIONS, lifeActionPosition, lifeRoomCenter, locationEntrance, missionPosition, playerBlocked, neoSkillUnlocked, type WorldEvent } from '@auto_matrix/shared';
import type { WorldDynamics } from '../packages/server/src/story/WorldDynamics.js';

function setup(seed = 42) {
  const world = new WorldState(); new AgentManager(world).initializeAllAgents();
  const dynamics = { record: (event: Omit<WorldEvent, 'id'>) => world.addWorldEvent(event) } as WorldDynamics;
  const sandbox = new SandboxSystem(world, dynamics, seed);
  const neo = world.agents.get('neo')!; neo.controller = 'player'; sandbox.enter(neo);
  sandbox.life.begin(neo, 0);
  let tick = 0;
  const run = (id: string) => {
    const action = LIFE_ACTIONS.find(a => a.id === id)!;
    neo.isInMatrix = true;
    if (action.location) { neo.currentLocation = action.location; neo.position = lifeActionPosition(action); }
    const result = sandbox.command(neo, { kind: 'life', target: id }, ++tick);
    if (sandbox.life.state!.activity) { tick = sandbox.life.state!.activity!.endsAt; sandbox.tick(tick); }
    return result;
  };
  return { world, sandbox, neo, run, getTick: () => tick, nextTick: () => ++tick };
}

test('a chosen morning and time spent on daily activities survive the next simulation tick', () => {
  const world = new WorldState();
  world.timeOfDay = 7500;
  world.simulationTick = 84000;
  world.advanceTick();
  assert.equal(world.timeOfDay, 7512, 'simulation ticks must advance the actual clock, not reconstruct the old night');
});

test('a Neo life starts in a walkable morning apartment and leaves the shared campaign intact', () => {
  const { world, sandbox, neo } = setup();
  assert.equal(world.timeOfDay, 7500);
  assert.equal(neo.currentLocation, 'neo_apartment');
  assert.equal(neo.isAwakened, false);
  assert.equal(sandbox.state.weather, 'clear');
  assert.equal(sandbox.state.missions.rabbit.status, 'available');
  assert.equal(sandbox.life.state!.missions.rabbit.status, 'locked');
  assert.equal(playerBlocked(neo.position, true), false);
  for (const id of Object.keys(LIFE_ROOMS)) {
    const center = lifeRoomCenter(id)!; const entry = locationEntrance(id);
    assert.equal(playerBlocked(center, true), false, `${id} center`);
    for (let z = center.z; z <= entry.z; z += .2) assert.equal(playerBlocked({ ...center, z }, true), false, `${id} doorway`);
    assert.equal(playerBlocked({ ...center, x: center.x + LIFE_ROOMS[id].width / 2 }, true), true, `${id} wall`);
  }
  for (const mission of NEO_MISSIONS) assert.equal(playerBlocked(missionPosition(mission.id), LOCATIONS[mission.location].world === 'matrix'), false, mission.id);
});

test('work pays once per day, takes seven hours, and rejects remote or unfunded actions atomically', () => {
  const { sandbox, neo, world, run, nextTick } = setup(); const life = sandbox.life.state!;
  const start = life.money;
  assert.match(sandbox.command(neo, { kind: 'life', target: 'work' }, nextTick()), /先到/);
  assert.equal(life.money, start);
  run('breakfast'); assert.equal(life.money, start - 4);
  world.timeOfDay = 9000; life.lastMinute = (world.day - 1) * 1440 + 540;
  run('work'); assert.equal(life.money, start - 4 + 95); assert.equal(world.timeOfDay, 16000);
  const cash = life.money; world.timeOfDay = 10000;
  assert.match(run('work'), /已经做过/); assert.equal(life.money, cash);
  life.money = 0; assert.match(run('coffee'), /现金不足/); assert.equal(life.money, 0);
});

test('walking away cancels an activity without costs, rewards or clock skipping', () => {
  const { sandbox, neo, world } = setup(); const life = sandbox.life.state!;
  const before = life.money; const time = world.timeOfDay;
  sandbox.command(neo, { kind: 'life', target: 'breakfast' }, 1);
  assert.ok(life.activity); neo.position.x += 4; sandbox.tick(2);
  assert.equal(life.activity, undefined); assert.equal(life.money, before); assert.equal(world.timeOfDay, time);
});

test('a street anomaly can be revisited after leaving without allowing remote investigation', () => {
  const { sandbox, neo } = setup();
  const position = { x: 1200, y: 1, z: 1120 };
  sandbox.life.state!.anomaly = { id: 'commute', location: 'downtown', position };
  assert.match(sandbox.command(neo, { kind: 'life', target: 'anomaly:test' }, 1), /回到/);
  sandbox.command(neo, { kind: 'life', target: 'go:anomaly' }, 2);
  assert.deepEqual(neo.position, position);
  sandbox.command(neo, { kind: 'life', target: 'anomaly:test' }, 3);
  assert.deepEqual(sandbox.life.state!.evidence, ['commute']);
  assert.equal(sandbox.life.state!.anomaly, undefined);
});

test('appointments distinguish invitations, attendance and missed meetings', () => {
  const { sandbox, run, world } = setup(); const life = sandbox.life.state!;
  run('invite'); assert.equal(life.appointment?.day, 1);
  world.timeOfDay = 19000; run('meet'); assert.equal(life.friends, 30); assert.equal(life.appointment, undefined);
  run('sleep'); assert.equal(life.day, 2); assert.equal(world.timeOfDay, 7500);
  run('invite'); world.timeOfDay = 22000; sandbox.tick(100);
  assert.equal(life.appointment, undefined); assert.equal(life.friends, 25);
});

function discover(set: ReturnType<typeof setup>) {
  const { sandbox, world, run, neo, nextTick } = set;
  for (let day = 0; day < 24 && sandbox.life.state!.chapter === 0; day++) {
    for (const id of ['breakfast', 'computer', 'coffee', 'walk', 'shop', 'bar']) {
      const action = LIFE_ACTIONS.find(a => a.id === id)!;
      if (action.window && world.timeOfDay < action.window[0] * 1000) world.advanceMinutes((action.window[0] * 1000 - world.timeOfDay) * .06);
      run(id);
      if (sandbox.life.state!.anomaly) sandbox.command(neo, { kind: 'life', target: 'anomaly:test' }, nextTick());
      if (sandbox.life.state!.chapter) break;
    }
    if (!sandbox.life.state!.chapter) run('sleep');
  }
}

test('ordinary routines probabilistically reveal distinct evidence before Trinity makes contact', () => {
  const set = setup(); const { sandbox, neo } = set;
  neo.position = missionPosition('rabbit');
  sandbox.command(neo, { kind: 'interact', target: 'mission:rabbit' }, 0);
  assert.equal(sandbox.life.state!.missions.rabbit.status, 'locked');
  assert.equal(neoSkillUnlocked(sandbox.life.state, 0), false);
  discover(set);
  assert.equal(sandbox.life.chapter!.id, 'contact');
  assert.ok(sandbox.life.state!.day >= 3);
  assert.ok(new Set(sandbox.life.state!.evidence).size >= 3);
  assert.equal(neo.isAwakened, false);
  assert.equal(sandbox.life.state!.missions.rabbit.status, 'locked', 'meeting Trinity does not skip the phone call');
});

test('routine anomalies are not guaranteed on every action and replay identically from saved RNG', () => {
  let seen = 0;
  for (let seed = 1; seed <= 40; seed++) {
    const set = setup(seed * 7583); const other = setup(seed * 7583);
    set.run('breakfast'); other.run('breakfast');
    assert.deepEqual(set.sandbox.life.state, other.sandbox.life.state);
    if (set.sandbox.life.state!.anomaly) seen++;
  }
  assert.ok(seen > 0 && seen < 40, `anomalies in ${seen}/40 breakfasts`);
});

test('blue pill returns to daily life, retaining evidence and a delayed chance to reconnect', () => {
  const set = setup(); discover(set); const { sandbox, neo, world } = set;
  let tick = set.getTick() + 1;
  for (const id of ['contact', 'office_call']) {
    const chapter = sandbox.life.chapter!; assert.equal(chapter.id, id);
    neo.position = lifeRoomCenter(chapter.location)!; neo.currentLocation = chapter.location; world.timeOfDay = 19000;
    sandbox.command(neo, { kind: 'life', target: `choice:${id}:${chapter.choices![0].id}` }, ++tick);
  }
  neo.position = missionPosition('rabbit');
  sandbox.command(neo, { kind: 'interact', target: 'mission:rabbit' }, ++tick);
  const evidence = [...sandbox.life.state!.evidence];
  sandbox.command(neo, { kind: 'choose', target: 'rabbit:blue' }, ++tick);
  assert.equal(sandbox.life.state!.chapter, 0); assert.equal(neo.isAwakened, false);
  assert.deepEqual(sandbox.life.state!.evidence, evidence);
  assert.equal(neo.currentLocation, 'neo_apartment');
  sandbox.tick(++tick); assert.equal(sandbox.life.state!.chapter, 0);
});

test('trilogy requires its encounters and final core dialogue, then begins a saved next cycle', () => {
  const set = setup(); discover(set); const { sandbox, neo, world } = set;
  let tick = set.getTick() + 1;
  const previousShared = structuredClone(sandbox.state.missions);
  while (sandbox.life.state!.cycle === 1 && tick < 5000) {
    const chapter = sandbox.life.chapter!;
    neo.isInMatrix = LOCATIONS[chapter.location].world === 'matrix'; neo.currentLocation = chapter.location;
    neo.position = chapter.mission ? missionPosition(chapter.mission) : lifeRoomCenter(chapter.location) ?? locationEntrance(chapter.location);
    if (chapter.id === 'contact') world.timeOfDay = 19000;
    if (chapter.choices) {
      if (chapter.id === 'source') assert.equal(sandbox.life.state!.ending, undefined, 'winning combat is not the ending');
      const result = sandbox.command(neo, { kind: 'life', target: `choice:${chapter.id}:${chapter.choices[0].id}` }, ++tick);
      assert.notEqual(sandbox.life.chapter?.id, chapter.id, `${chapter.id}: ${result}`);
    } else if (chapter.mission) {
      const mission = NEO_MISSIONS.find(m => m.id === chapter.mission)!;
      const result = sandbox.command(neo, { kind: 'interact', target: `mission:${mission.id}` }, ++tick);
      assert.ok(!result.includes('缺少'), `${mission.id}: campaign must supply required resources`);
      if (mission.mode === 'hack') sandbox.tick(tick += 12);
      for (let i = 0; i < 100 && sandbox.state.threats.some(t => t.campaign === 'neo' && t.mission === mission.id); i++) {
        const threat = sandbox.state.threats.find(t => t.campaign === 'neo' && t.mission === mission.id)!;
        neo.position = { ...threat.position }; sandbox.attack(neo, ++tick, i % 3);
      }
      const progress = sandbox.life.state!.missions[mission.id];
      if (progress.escort) while (progress.status === 'active' && tick < 4500) { neo.position = { ...progress.escort!.position }; sandbox.tick(++tick); }
      if (mission.choices) { neo.position = missionPosition(mission.id); sandbox.command(neo, { kind: 'choose', target: `${mission.id}:${mission.choices[0].id}` }, ++tick); }
      assert.equal(progress.status, 'complete', mission.id);
    } else assert.fail(`No playable step in ${chapter.id}`);
  }
  assert.equal(sandbox.life.state!.cycle, 2);
  assert.equal(sandbox.life.state!.chapter, 0);
  assert.equal(sandbox.life.state!.cycles[0].ending, 'peace');
  assert.ok(sandbox.life.state!.cycles[0].choices.source);
  assert.ok(sandbox.life.state!.cycles[0].philosophy.care > 4);
  assert.equal(world.timeOfDay, 7500); assert.equal(neo.isAwakened, false);
  assert.deepEqual(sandbox.state.missions, previousShared, 'Neo does not overwrite the shared sandbox campaign');
  const saved = structuredClone(sandbox.state); sandbox.restore(saved);
  assert.equal(sandbox.life.state!.cycle, 2); saved.neoLife!.cycle = 99;
  assert.equal(sandbox.life.state!.cycle, 2, 'no alias to checkpoint');
});
