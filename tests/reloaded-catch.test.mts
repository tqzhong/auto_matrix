import assert from 'node:assert/strict';
import test from 'node:test';
import { CATCH, FILM_SCENE_BY_ID, catchCarRoofScale, catchRoot, filmPosition, filmStepPosition, newCatch, type WorldEvent } from '@auto_matrix/shared';
import { WorldState } from '../packages/server/src/world/WorldState.js';
import { AgentManager } from '../packages/server/src/agents/AgentManager.js';
import { SandboxSystem } from '../packages/server/src/player/SandboxSystem.js';
import type { WorldDynamics } from '../packages/server/src/story/WorldDynamics.js';

function setup() {
  const world = new WorldState(); new AgentManager(world).initializeAllAgents();
  const dynamics = { record: (event: Omit<WorldEvent, 'id'>) => world.addWorldEvent(event) } as WorldDynamics;
  const sandbox = new SandboxSystem(world, dynamics, 42), actor = world.agents.get('neo')!;
  sandbox.enter(actor); sandbox.life.begin(actor, 0); sandbox.state.neoLife!.chapter = 1;
  sandbox.life.film.command(actor, 'continue', 0);
  const journey = sandbox.life.film.state!;
  Object.assign(journey, { scene: 'm2_catch', actor: 'neo', step: 0, catch: newCatch() });
  actor.controller = 'rescue-test'; actor.currentLocation = 'film_trinity_roof';
  actor.position = filmPosition(actor.currentLocation, CATCH.start.x, CATCH.start.z);
  const system = sandbox.life.film.catch;
  const frame = (count = 1, x = 0, z = 0, focus = false) => { for (let i = 0; i < count; i++) system.frame(actor, { x, z, focus }, .1, ++world.simulationTick); };
  frame(0); return { world, sandbox, actor, journey, system, frame };
}

test('Neo walks on the exit floor and cannot launch remotely through a closed window', () => {
  const h = setup(); const initial = catchRoot(h.journey.catch!, 'neo');
  assert.ok(initial.z > 44 && initial.z < 50, 'the launch root must be inside the exit tower, not suspended in the street');
  h.system.command(h.actor, 'act', 0); assert.equal(h.journey.catch!.phase, 'launch', 'G at the entry cannot break the remote window');
  h.frame(6, 0, -1); assert.ok(h.journey.catch!.z < initial.z - 1.5, 'W moves Neo toward the real opening');
  h.system.command(h.actor, 'act', 1); assert.equal(h.journey.catch!.phase, 'departing');
  const before = catchRoot(h.journey.catch!, 'neo'); h.frame(1); const after = catchRoot(h.journey.catch!, 'neo');
  assert.ok(Math.hypot(after.x - before.x, after.y - before.y, after.z - before.z) < 1, 'launch is a saved movement, not an instantaneous street teleport');
});

test('the window waypoint uses the launch storey rather than the roof below Neo', () => {
  const scene = FILM_SCENE_BY_ID.m2_catch, target = filmStepPosition(scene, scene.steps[0]);
  assert.equal(target.y, filmPosition(scene.set, 0, 0).y + CATCH.start.y);
});

test('flying through the front of the visible center tower fails before reaching its center line', () => {
  const h = setup(); Object.assign(h.journey.catch!, { phase: 'flight', x: 0, z: 10.5, elapsed: 2 });
  h.frame(1, 0, -1); assert.equal(h.journey.catch!.phase, 'failed', 'the whole visible tower footprint must collide');
});

test('catching preserves both bodies at the interception frame and bridges into a carried ascent', () => {
  const h = setup(); const s = h.journey.catch!;
  Object.assign(s, { phase: 'flight', x: -8.5, z: -24, yaw: Math.PI, elapsed: 6.1 });
  const before = ['neo', 'trinity'].map(role => catchRoot(s, role as 'neo' | 'trinity'));
  h.system.command(h.actor, 'act', 1);
  assert.equal(s.phase, 'catching');
  for (const [index, role] of ['neo', 'trinity'].entries()) {
    const after = catchRoot(s, role as 'neo' | 'trinity');
    assert.ok(Math.hypot(after.x - before[index].x, after.y - before[index].y, after.z - before[index].z) < .001, `${role} teleports at G`);
  }
  h.frame(10); assert.equal(s.phase, 'ascent'); h.frame(29); assert.equal(s.phase, 'landing');
  h.frame(18); assert.equal(s.phase, 'extract_ready');
});

test('the wrong or occupied character is never staged, and an alive retry preserves injury and inventory', () => {
  const h = setup(), johnson = h.world.agents.get('agent_johnson')!, thompson = h.world.agents.get('agent_thompson')!;
  const original = structuredClone(johnson.position); h.frame(); assert.deepEqual(johnson.position, original, 'Johnson belongs to the freeway encounter');
  assert.equal(thompson.currentAction?.parameters.catch?.role, 'agent_thompson');
  const age = h.journey.catch!.elapsed, position = structuredClone(thompson.position);
  thompson.controller = 'another-player'; h.frame(10); assert.equal(h.journey.catch!.elapsed, age); assert.deepEqual(thompson.position, position);
  thompson.controller = undefined; h.actor.health = 37; h.actor.activeEffects = [{ type: 'wounded', remaining: 20 }] as typeof h.actor.activeEffects;
  Object.assign(h.journey.catch!, { phase: 'failed', checkpoint: 'flight' });
  const effects = structuredClone(h.actor.activeEffects), inventory = structuredClone(h.sandbox.state.profiles.neo.inventory);
  h.system.command(h.actor, 'retry', 2); assert.equal(h.actor.health, 37); assert.deepEqual(h.actor.activeEffects, effects); assert.deepEqual(h.sandbox.state.profiles.neo.inventory, inventory);
  const trinity = h.world.agents.get('trinity')!; trinity.status = 'dead'; trinity.health = 0;
  const deadPosition = structuredClone(trinity.position); h.frame(2); assert.deepEqual(trinity.position, deadPosition, 'a pre-existing death cannot become a stage prop');
});

test('a dead participant cannot start a leap or advance the saved revival by an action', () => {
  const h = setup(), trinity = h.world.agents.get('trinity')!;
  Object.assign(h.journey.catch!, { x: 0, z: CATCH.window.z + .6 });
  trinity.status = 'dead'; trinity.health = 0;
  const before = structuredClone(h.journey.catch);
  h.system.command(h.actor, 'act', 1); assert.deepEqual(h.journey.catch, before);
  Object.assign(h.journey.catch!, { phase: 'pulse', elapsed: CATCH.pulseAt });
  h.system.handle(h.actor, 'attack', 2); assert.equal(h.journey.catch!.beats, 0);
});

test('pausing and restoring a caught body keeps the exact clock, roots, injury and inventory', () => {
  const h = setup(), s = h.journey.catch!;
  Object.assign(s, { phase: 'flight', elapsed: 5.6, x: CATCH.trinity.x, z: CATCH.trinity.z });
  h.system.command(h.actor, 'act', 1); h.frame(3);
  h.actor.health = 39; h.actor.activeEffects = [{ type: 'wounded', remaining: 20 }] as typeof h.actor.activeEffects;
  const before = JSON.parse(JSON.stringify({ life: h.sandbox.state.neoLife, profile: h.sandbox.state.profiles.neo, position: h.actor.position, health: h.actor.health, effects: h.actor.activeEffects }));
  const actors = JSON.parse(JSON.stringify(['neo', 'trinity', 'agent_thompson'].map(id => h.world.agents.get(id))));
  h.system.frame(h.actor, { x: 1, z: 1, focus: true }, 0, h.world.simulationTick);
  h.sandbox.restore(JSON.parse(JSON.stringify(h.sandbox.state)));
  assert.deepEqual({ life: h.sandbox.state.neoLife, profile: h.sandbox.state.profiles.neo, position: h.actor.position, health: h.actor.health, effects: h.actor.activeEffects }, before);
  assert.deepEqual(JSON.parse(JSON.stringify(['neo', 'trinity', 'agent_thompson'].map(id => h.world.agents.get(id)))), actors);
});

test('Thompson’s car impact persists as one death and is not undone by a rooftop retry', () => {
  const h = setup(), s = h.journey.catch!, thompson = h.world.agents.get('agent_thompson')!;
  Object.assign(s, { phase: 'ascent', elapsed: 1.3, caught: { neo: { x: -8.5, y: -40, z: -24, yaw: Math.PI }, trinity: { x: -8.5, y: -41.3, z: -24, yaw: 0 }, age: 5.6 } });
  h.frame(); assert.equal(thompson.status, 'dead'); assert.equal(thompson.health, 0);
  const deaths = h.world.globalEvents.filter(event => event.type === 'death' && event.involvedAgents.includes('agent_thompson'));
  assert.equal(deaths.length, 1); h.frame(); assert.equal(h.world.globalEvents.filter(event => event.type === 'death' && event.involvedAgents.includes('agent_thompson')).length, 1);
  Object.assign(s, { phase: 'failed', checkpoint: 'pulse' }); h.system.command(h.actor, 'retry', 4); assert.equal(thompson.status, 'dead');
  Object.assign(s, { phase: 'failed', checkpoint: 'flight' }); h.system.command(h.actor, 'retry', 5);
  assert.equal(thompson.status, 'dead'); assert.equal(catchCarRoofScale(h.journey.catch!), .35, 'a checkpoint retry cannot repair the crushed car under a persistent corpse');
});
