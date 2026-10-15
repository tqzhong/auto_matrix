import assert from 'node:assert/strict';
import test from 'node:test';
import { AMBUSH_ESCAPE, filmPosition, newAmbushEscape, playerBlocked, mouseRoomDoor, type CombatImpact, type FilmJourney, type SandboxState } from '@auto_matrix/shared';
import { WorldState } from '../packages/server/src/world/WorldState.js';
import { AgentManager } from '../packages/server/src/agents/AgentManager.js';
import { FilmStorySystem } from '../packages/server/src/story/FilmStorySystem.js';

function fixture() {
  const world = new WorldState(); new AgentManager(world).initializeAllAgents();
  const neo = world.agents.get('neo')!; neo.controller = 'room-test';
  neo.position = filmPosition('film_ambush_house', 11, 31.8); neo.currentLocation = 'film_ambush_house';
  const journey = { scene: 'm1_dejavu', actor: 'neo', step: 1, completed: [], ambushEscape: newAmbushEscape() } as FilmJourney;
  const sandbox = { structures: [], threats: [], neoLife: { journey } } as unknown as SandboxState;
  const story = new FilmStorySystem(world, () => sandbox, () => {}, () => {}), impacts: CombatImpact[] = [];
  story.onImpact = hit => impacts.push(hit);
  let tick = 1;
  const frame = (dt = .1) => story.ambushEscapeFrame(neo, dt, tick++);
  return { world, neo, journey, sandbox, impacts, frame };
}

test('the room assault has opponents facing Mouse through the actual doorway, separate from the stair pursuit', () => {
  const h = fixture();
  for (let i = 0; i < 33; i++) h.frame();
  const room = h.sandbox.threats.filter(threat => threat.id.startsWith('film:ambush:room:'));
  assert.equal(room.length, 2, 'the gunfire needs visible room opponents, not only distant stair pursuers');
  const mouse = h.world.agents.get('mouse')!;
  for (const guard of room) {
    assert.equal(guard.target, 'mouse'); assert.equal(guard.patrol, true);
    assert.ok(guard.position.x > mouse.position.x && guard.position.x - mouse.position.x < 10);
    assert.ok(Math.abs(guard.position.z - mouse.position.z) < 2);
    assert.equal(playerBlocked(guard.position, true, 1.1, h.sandbox.structures), false);
    assert.ok(Math.abs(Math.atan2(mouse.position.x - guard.position.x, mouse.position.z - guard.position.z) - guard.yaw!) < .001);
  }
  assert.equal(h.sandbox.threats.filter(threat => threat.id.startsWith('film:ambush:pursuer:')).length, 2);
  assert.ok(h.impacts.some(hit => hit.source === 'mouse' && hit.target.startsWith('film:ambush:room:') && hit.shot));
  assert.ok(h.impacts.some(hit => hit.target === 'mouse' && hit.source.startsWith('film:ambush:room:') && hit.shot));
});

test('saved assault time does not replay shots on pause, restoration or the end of the alarm', () => {
  const h = fixture();
  for (let i = 0; i < 33; i++) h.frame();
  const saved = JSON.stringify(h.sandbox.threats.filter(threat => threat.id.startsWith('film:ambush:room:'))), count = h.impacts.length;
  for (let i = 0; i < 10; i++) h.frame(0);
  assert.equal(h.impacts.length, count);
  assert.equal(JSON.stringify(h.sandbox.threats.filter(threat => threat.id.startsWith('film:ambush:room:'))), saved);
  const cold = fixture(); Object.assign(cold.journey, JSON.parse(JSON.stringify(h.journey)));
  cold.sandbox.threats = JSON.parse(JSON.stringify(h.sandbox.threats)); cold.frame(0);
  assert.equal(cold.impacts.length, 0);
  assert.equal(JSON.stringify(cold.sandbox.threats.filter(threat => threat.id.startsWith('film:ambush:room:'))), saved);
  for (let i = 0; i < 35; i++) h.frame();
  assert.equal(h.journey.ambushEscape!.phase, 'descending');
  assert.equal(h.world.agents.get('mouse')!.status, 'dead');
  const fatal = h.impacts.filter(hit => hit.target === 'mouse' && hit.downed);
  assert.equal(fatal.length, 1, 'the saved death has one corresponding final shot');
  const after = h.impacts.length; for (let i = 0; i < 10; i++) h.frame();
  assert.equal(h.impacts.length, after);
});

test('an occupied Mouse freezes the room assault with the rest of the crew', () => {
  const h = fixture(); h.journey.ambushEscape!.elapsed = AMBUSH_ESCAPE.shots - .05;
  h.world.agents.get('mouse')!.controller = 'another-player';
  h.frame(); const elapsed = h.journey.ambushEscape!.elapsed;
  for (let i = 0; i < 25; i++) h.frame();
  assert.equal(h.journey.ambushEscape!.elapsed, elapsed); assert.equal(h.impacts.length, 0);
  assert.equal(h.world.agents.get('mouse')!.status, 'alive');
});

test('the visible room door blocks its closed opening and clears the firing lane when breached', () => {
  const h = fixture(); h.frame(0);
  const opening = filmPosition('film_ambush_house', -13, -15);
  assert.equal(playerBlocked(opening, true, 1.1, h.sandbox.structures), true);
  h.journey.ambushEscape!.elapsed = 2.2; h.frame(0);
  assert.equal(playerBlocked(opening, true, 1.1, h.sandbox.structures), false);
  const door = mouseRoomDoor(2.2);
  assert.equal(playerBlocked(filmPosition('film_ambush_house', door.x, door.z), true, .2, h.sandbox.structures), true);
  const before = JSON.stringify(h.sandbox.structures); h.frame(0);
  assert.equal(JSON.stringify(h.sandbox.structures), before);
});
