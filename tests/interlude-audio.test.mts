import assert from 'node:assert/strict';
import test from 'node:test';
import { FILM_SCENE_BY_ID, filmEntry, type InterludeEncounter, type WorldEvent } from '@auto_matrix/shared';
import { Engine } from '../packages/client/src/engine/Engine.js';
import { AgentManager } from '../packages/server/src/agents/AgentManager.js';
import { SandboxSystem } from '../packages/server/src/player/SandboxSystem.js';
import type { WorldDynamics } from '../packages/server/src/story/WorldDynamics.js';
import { WorldState } from '../packages/server/src/world/WorldState.js';

function fixture(kind: InterludeEncounter['kind'] = 'meal') {
  const world = new WorldState(); new AgentManager(world).initializeAllAgents();
  const dynamics = { record: (event: Omit<WorldEvent, 'id'>) => world.addWorldEvent(event) } as WorldDynamics;
  const sandbox = new SandboxSystem(world, dynamics, 42), neo = world.agents.get('neo')!;
  sandbox.enter(neo); sandbox.life.begin(neo, 0);
  const sounds: string[] = [], actor = kind === 'steak' ? 'smith' : 'neo';
  const scene = FILM_SCENE_BY_ID[kind === 'meal' ? 'm1_meal' : kind === 'steak' ? 'm1_steak' : 'm1_cypher_console'];
  const engine = Object.assign(Object.create(Engine.prototype), { playerControls: { id: actor },
    audio: { dialogue: () => sounds.push('dialogue'), interludeSound: (sound: string) => sounds.push(sound) },
    sandboxRenderer: { sync() {} }, updateAtmosphere() {} });
  function frame(encounter: Omit<InterludeEncounter, 'kind'>, { running = true, owner = actor, visiting = false } = {}) {
    engine.running = running; engine.playerControls.id = owner;
    const journey = { version: 1 as const, scene: scene.id, actor, step: 0, completed: [], enteredAt: 0,
      reflections: {}, lastText: '', checkpoint: filmEntry(scene), visiting: visiting ? scene.id : undefined,
      interlude: { kind, ...encounter } };
    Engine.prototype.setSandbox.call(engine, { ...sandbox.state, neoLife: { ...sandbox.state.neoLife!, journey } }, Object.fromEntries(world.agents));
    return sounds.splice(0);
  }
  return { frame };
}

test('the physical meal follows the spoon clock after the player chooses to eat', () => {
  const h = fixture(), frame = (phase: InterludeEncounter['phase'], elapsed = 0) => h.frame({ phase, elapsed, physicalMeal: true });
  assert.deepEqual(frame('ready'), []);
  assert.deepEqual(frame('performing'), ['dialogue', 'bowl']);
  assert.deepEqual(frame('performing', 2.2), []);
  assert.deepEqual(frame('accept_ready'), []);
  assert.deepEqual(frame('accept_ready'), [], 'waiting does not start eating or its sounds');
  assert.deepEqual(frame('accepting'), ['dialogue'], 'the explicit first bite ducks the music again');
  assert.deepEqual(frame('accepting', 1), []);
  assert.deepEqual(frame('accepting', 1.2), ['cutlery'], 'the spoon reaches the bowl at meal age 3.4');
  assert.deepEqual(frame('accepting', 1.2), []);
  assert.deepEqual(frame('accepting', 5.8), []);
  assert.deepEqual(frame('accepting', 6), ['cutlery'], 'the spoon returns at meal age 8.2');
  assert.deepEqual(frame('accepting', 8.6), [], 'the old performing-only beat cannot add another clink');
});

test('a cold meal resumes at its saved spoon position without replaying earlier sounds', () => {
  const h = fixture();
  assert.deepEqual(h.frame({ phase: 'accepting', elapsed: 4, physicalMeal: true }), []);
  assert.deepEqual(h.frame({ phase: 'accepting', elapsed: 6, physicalMeal: true }), ['cutlery']);
  assert.deepEqual(h.frame({ phase: 'done', elapsed: 10.9, physicalMeal: true }), []);
});

test('paused, visiting and other-role meal snapshots stay quiet', () => {
  for (const options of [{ running: false }, { visiting: true }, { owner: 'smith' }]) {
    const h = fixture();
    h.frame({ phase: 'accepting', elapsed: 1, physicalMeal: true });
    assert.deepEqual(h.frame({ phase: 'accepting', elapsed: 1.2, physicalMeal: true }, options), []);
    assert.deepEqual(h.frame({ phase: 'accepting', elapsed: 1.2, physicalMeal: true }), [], 'resume does not replay a paused contact');
  }
});

test('legacy meals and restaurant transactions keep their existing cutlery beat', () => {
  for (const kind of ['meal', 'steak'] as const) {
    const h = fixture(kind), beat = kind === 'meal' ? 8.5 : 3.2;
    h.frame({ phase: 'performing', elapsed: beat - .1 });
    assert.deepEqual(h.frame({ phase: 'performing', elapsed: beat + .1 }), ['cutlery']);
    assert.deepEqual(h.frame({ phase: 'performing', elapsed: beat + .1 }), []);
  }
});
