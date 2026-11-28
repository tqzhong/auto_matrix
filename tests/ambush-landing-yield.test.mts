import assert from 'node:assert/strict';
import test from 'node:test';
import { AMBUSH_RETREAT_LANDINGS, FILM_SCENE_BY_ID, ambushRetreatShift, filmPosition, newAmbushEscape, type WorldEvent } from '@auto_matrix/shared';
import { WorldState } from '../packages/server/src/world/WorldState.js';
import { AgentManager } from '../packages/server/src/agents/AgentManager.js';
import { SandboxSystem } from '../packages/server/src/player/SandboxSystem.js';
import { PlayerController } from '../packages/server/src/player/PlayerController.js';
import type { ConversationEngine } from '../packages/server/src/agents/ConversationEngine.js';
import type { ActionExecutor } from '../packages/server/src/agents/ActionExecutor.js';
import type { WorldDynamics } from '../packages/server/src/story/WorldDynamics.js';

const roles = ['morpheus', 'switch', 'apoc', 'trinity', 'cypher'] as const;
const savedLead = { apoc: 8.4, switch: 4.2, morpheus: 0, trinity: -4.2, cypher: -8.4 };

for (const landing of AMBUSH_RETREAT_LANDINGS.slice(0, -1)) {
  test(`floor ${landing.floor}: Neo can return from the left edge without waiting forever behind Morpheus`, () => {
    const world = new WorldState(); new AgentManager(world).initializeAllAgents();
    const dynamics = { record: (event: Omit<WorldEvent, 'id'>) => world.addWorldEvent(event) } as WorldDynamics;
    const sandbox = new SandboxSystem(world, dynamics, 42);
    const players = new PlayerController(world, { interrupt() {}, isAgentInConversation: () => false } as unknown as ConversationEngine,
      { execute() {} } as unknown as ActionExecutor, dynamics, sandbox);
    players.possess('landing-player', 'neo', 0); const neo = world.agents.get('neo')!;
    sandbox.life.begin(neo, 0); sandbox.state.neoLife!.chapter = 1;
    players.sandboxAction('landing-player', { kind: 'life', target: 'film:continue' }, 1);
    Object.assign(sandbox.life.film.state!, { scene: 'm1_oracle', actor: 'neo', step: FILM_SCENE_BY_ID.m1_oracle.steps.length });
    players.sandboxAction('landing-player', { kind: 'life', target: 'film:next' }, 2);
    const journey = sandbox.life.film.state!, escape = newAmbushEscape();
    journey.step = 1; journey.ambush = { elapsed: 14.8 }; journey.ambushEscape = escape;
    escape.phase = 'descending'; escape.mouseDead = true;
    // Isolate the body/route deadlock from pursuit damage; native pressure is checked separately.
    escape.pursuers = [];
    // Keep the old saved formation unchanged so the fix must release an existing blocked checkpoint.
    for (const role of roles) escape.progress[role] = ambushRetreatShift(role) + landing.progress + savedLead[role];
    neo.position = filmPosition('film_ambush_house', landing.point.x - 2.3, landing.point.z - .1);
    neo.position.y += landing.point.y; neo.rotation = Math.PI / 2;
    journey.checkpoint = { ...neo.position };
    world.agents.get('mouse')!.health = 0; world.agents.get('mouse')!.status = 'dead';
    players.step(0, false, 3);
    const target = filmPosition('film_ambush_house', 5.5, landing.point.z);
    target.y += landing.point.y;
    let tick = 3;
    while (neo.position.x < target.x - .5 && tick < 203) {
      players.receiveInput('landing-player', { x: 1, z: 0, yaw: Math.PI / 2, jump: false, sprint: true, sequence: tick });
      players.step(.05, true, ++tick);
    }
    assert.ok(neo.position.x >= target.x - .5, `Morpheus must lead out of the corner instead of pinning Neo before the route: ${JSON.stringify({ neo: neo.position, morpheus: world.agents.get('morpheus')!.position, progress: escape.progress })}`);
    assert.equal(neo.position.y, target.y);
    assert.equal(neo.health, 100); assert.equal(world.agents.get('mouse')!.status, 'dead');
  });
}
