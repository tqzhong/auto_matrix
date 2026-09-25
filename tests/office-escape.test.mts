import assert from 'node:assert/strict';
import test from 'node:test';
import { FILM_SCENE_BY_ID, FILM_SETS, PILL_TIMING, WAKE_CALL, filmStepPosition, filmPosition, officeOccluded, playerBlocked, stepPlayer, type WorldEvent } from '@auto_matrix/shared';
import { WorldState } from '../packages/server/src/world/WorldState.js';
import { AgentManager } from '../packages/server/src/agents/AgentManager.js';
import { SandboxSystem } from '../packages/server/src/player/SandboxSystem.js';
import { PlayerController } from '../packages/server/src/player/PlayerController.js';
import { OfficeEscapeSystem } from '../packages/server/src/story/OfficeEscapeSystem.js';
import type { ConversationEngine } from '../packages/server/src/agents/ConversationEngine.js';
import type { ActionExecutor } from '../packages/server/src/agents/ActionExecutor.js';
import type { WorldDynamics } from '../packages/server/src/story/WorldDynamics.js';

function setup() {
  const world = new WorldState(); new AgentManager(world).initializeAllAgents();
  const dynamics = { record: (e: Omit<WorldEvent, 'id'>) => world.addWorldEvent(e) } as WorldDynamics;
  const sandbox = new SandboxSystem(world, dynamics, 42);
  const players = new PlayerController(world, { interrupt() {}, isAgentInConversation: () => false } as unknown as ConversationEngine, {} as ActionExecutor, dynamics, sandbox);
  players.possess('neo-player', 'neo', 0); sandbox.life.begin(world.agents.get('neo')!, 0); sandbox.state.neoLife!.chapter = 2;
  let tick = 0;
  let sequence = 0;
  let movementFrames = 0;
  let maximumAlert = 0;
  const command = (target: string) => players.sandboxAction('neo-player', { kind: 'life', target: `film:${target}` }, ++tick);
  const advance = (n = 1) => { for (let i = 0; i < n; i++) { sandbox.tick(++tick); maximumAlert = Math.max(maximumAlert, sandbox.life.film.state?.office?.alert ?? 0); } };
  const neo = () => players.getAgent('neo-player')!;
  const scene = () => sandbox.life.film.scene!;
  const goal = () => { neo().position = filmStepPosition(scene(), sandbox.life.film.step!); };
  const frame = (seconds: number, running = true) => { for (let i = 0; i < seconds * 10; i++) players.step(.1, running, tick); };
  const delivery = () => {
    goal(); command('act'); frame(10); command('act');
    goal(); command('act'); frame(11); command('act'); frame(4.1);
  };
  const finish = () => {
    const sceneId = scene().id;
    while (sandbox.life.film.step && scene().id === sceneId) {
      const step = sandbox.life.film.step; goal();
      if (step.kind === 'reach') advance();
      else if (step.kind === 'reflect') command('reflect:agency');
      else if (scene().id === 'm1_boss' && sandbox.life.film.state!.step === 0) delivery();
      else if (scene().id === 'm1_boss' && sandbox.life.film.state!.step === 1) {
        command('act'); for (let f = 0; f < 30; f++) players.step(.1, true, tick);
        command('act'); for (let f = 0; f < 120; f++) players.step(.1, true, tick);
      } else if (scene().id === 'm1_office_escape' && sandbox.life.film.state!.step === 2) {
        command('act'); for (let f = 0; f < 40; f++) players.step(.1, true, tick);
      } else if (scene().id === 'm1_interrogation') {
        command('act'); for (let f = 0; f < 241; f++) players.step(.1, true, tick);
      } else if (scene().id === 'm1_wake_again') {
        if (sandbox.life.film.state!.step === 0) {
          frame(6); goal(); command('act'); frame(12); command('act'); frame(5);
        } else {
          goal(); command('act'); frame(WAKE_CALL.leaving + .2);
        }
      } else if (scene().id === 'm1_bridge') {
        frame(7.1);
        command('act'); for (let f = 0; f < 151; f++) players.step(.1, true, tick);
        command('meeting:stay'); break;
      } else { command('act'); advance((step.seconds ?? 3) * 2); }
    }
  };
  const office = () => { command('continue'); finish(); command('next'); assert.equal(scene().id, 'm1_office_escape'); };
  const crossWindow = () => { command('next'); for (let frame = 0; frame < 130; frame++) players.step(.05, true, tick); };
  const climb = (seconds: number, direction = 1, running = true) => {
    for (let i = 0; i < Math.ceil(seconds / .05); i++) {
      players.receiveInput('neo-player', { x: 0, z: 0, yaw: Math.PI / 2, sprint: false, jump: false, climb: direction, sequence: ++sequence });
      players.step(.05, running, tick);
    }
  };
  const move = (x: number, z: number, crouch = true) => {
    const target = filmPosition(scene().set, x, z);
    for (let frame = 0; frame < 1600; frame++) {
      const dx = target.x - neo().position.x; const dz = target.z - neo().position.z; const length = Math.hypot(dx, dz);
      if (length < .25) return true;
      players.receiveInput('neo-player', { x: dx / length, z: dz / length, yaw: Math.atan2(dx, dz), sprint: !crouch, jump: false, crouch, sequence: ++sequence });
      players.step(.05, true, tick); if (++movementFrames % 10 === 0) advance();
      if (sandbox.life.film.state!.office?.outcome === 'captured') return false;
    }
    assert.fail(`could not walk to ${x}, ${z} from ${JSON.stringify(neo().position)}`);
  };
  return { world, sandbox, players, command, advance, neo, scene, goal, finish, office, delivery, crossWindow, climb, move, maximumAlert: () => maximumAlert, state: () => sandbox.life.film.state!, tick: () => tick };
}

test('the delivered phone requires picking up and answering; waiting cannot skip the call', () => {
  const h = setup(); h.command('continue'); h.delivery();
  h.goal(); h.command('act'); h.advance(60);
  assert.equal(h.state().step, 1, 'ordinary story ticks cannot complete a physical phone interaction');
  const frame = (seconds: number, running = true) => { for (let i = 0; i < seconds * 20; i++) h.players.step(.05, running, h.tick()); };
  frame(3); assert.equal(h.state().phone?.phase, 'ready');
  frame(15); assert.equal(h.state().step, 1, 'the player must open the slider to answer');
  h.command('act'); frame(2);
  const elapsed = h.state().phone!.elapsed; const position = { ...h.neo().position };
  frame(2, false); assert.equal(h.state().phone?.elapsed, elapsed);
  h.players.release('neo-player', h.tick()); frame(2); h.advance(10);
  assert.equal(h.state().phone?.elapsed, elapsed, 'disconnecting freezes the call');
  h.sandbox.restore(JSON.parse(JSON.stringify(h.sandbox.state)));
  h.players.possess('neo-player', 'neo', h.tick()); frame(10);
  assert.equal(h.state().phone?.phase, 'connected'); assert.equal(h.state().step, 2);
  h.command('next'); assert.equal(h.scene().id, 'm1_office_escape');
  assert.deepEqual(h.neo().position, position, 'answering leads into the escape from the same desk');
  assert.equal(h.sandbox.state.threats.filter(t => t.patrol).length, 3);
});

test('Neo continues the investigation without taking Trinity from another player or discarding daily records', () => {
  const h = setup(); h.players.possess('trinity-player', 'trinity', 0);
  h.sandbox.state.neoLife!.money = 321; h.sandbox.state.neoLife!.evidence = ['loop'];
  h.command('continue');
  assert.equal(h.neo().id, 'neo'); assert.equal(h.scene().id, 'm1_boss');
  assert.equal(h.sandbox.state.neoLife!.money, 321); assert.deepEqual(h.sandbox.state.neoLife!.evidence, ['loop']);
  assert.equal(h.players.getAgent('trinity-player')!.id, 'trinity');
});

test('low partitions conceal a crouched body but not a standing head, and crouching suppresses running and jumping', () => {
  const c = FILM_SETS.film_metacortex_floor.center;
  const from = { ...filmPosition('film_metacortex_floor', -16, -2), y: c.y + 2.9 };
  const to = filmPosition('film_metacortex_floor', -16, 5);
  assert.equal(officeOccluded(from, { ...to, y: to.y + 1.3 }, c), true);
  assert.equal(officeOccluded(from, { ...to, y: to.y + 2.9 }, c), false);
  const p = filmPosition('film_metacortex_floor', 0, 20);
  const moved = stepPlayer(p, 0, { x: 0, z: -1, yaw: Math.PI, crouch: true, sprint: true, jump: true, sequence: 1 }, .1, true);
  assert.equal(moved.position.y, p.y); assert.ok(p.z - moved.position.z < .2);
});

test('exposure triggers capture rather than death; interrogation persists the tracking device', () => {
  const h = setup(); h.office(); h.advance(8);
  const guard = h.sandbox.state.threats.find(t => t.id === 'office:0')!;
  h.neo().position = { ...guard.position, z: guard.position.z + 3 }; guard.yaw = 0;
  h.advance(6);
  assert.equal(h.state().office?.outcome, 'captured'); assert.equal(h.neo().status, 'alive');
  assert.equal(h.state().step, h.scene().steps.length); assert.equal(h.sandbox.state.threats.filter(t => t.patrol).length, 0);
  h.command('next'); assert.equal(h.scene().id, 'm1_interrogation'); assert.ok(h.state().skipped?.includes('m1_ledge'));
  h.finish(); assert.equal(h.state().office?.bugged, true);
  const saved = JSON.parse(JSON.stringify(h.sandbox.state)); h.sandbox.restore(saved);
  assert.equal(h.state().office?.bugged, true); h.command('next'); assert.equal(h.scene().id, 'm1_wake_again');
});

test('capture transition faces Smith instead of inheriting the office pursuit heading', () => {
  const h = setup(); h.office(); h.advance(8);
  const guard = h.sandbox.state.threats.find(t => t.id === 'office:0')!;
  h.neo().position = { ...guard.position, z: guard.position.z + 3 }; guard.yaw = 0;
  h.advance(6); assert.equal(h.state().office?.outcome, 'captured');
  h.neo().rotation = 0;
  h.command('next');
  const smith = h.world.agents.get('smith')!;
  const dx = smith.position.x - h.neo().position.x; const dz = smith.position.z - h.neo().position.z;
  const facing = (Math.sin(h.neo().rotation) * dx + Math.cos(h.neo().rotation) * dz) / Math.hypot(dx, dz);
  assert.ok(facing > .95, `Neo should enter facing Smith, not the wall (facing=${facing})`);
});

test('Neo has time to crouch after the call before the agents begin checking cubicles', () => {
  const h = setup(); h.office(); h.advance(6);
  assert.equal(h.state().office?.alert, 0);
  assert.equal(h.state().office?.outcome, undefined);
});

test('a pursuing agent goes around a cubicle instead of stopping at its partition or cutting through it', () => {
  const h = setup(); h.office();
  const office = new OfficeEscapeSystem(() => h.sandbox.state);
  const guard = h.sandbox.state.threats.find(t => t.id === 'office:0')!;
  h.sandbox.state.threats = [guard];
  guard.position = filmPosition('film_metacortex_floor', -16, -12.5); guard.yaw = 0;
  h.neo().position = filmPosition('film_metacortex_floor', -16, -5.2);
  let closest = Infinity;
  for (let i = 0; i < 32; i++) {
    const previous = { ...guard.position };
    office.tick(h.neo(), h.tick() + 8 + i);
    for (let j = 0; j <= 20; j++) {
      const sample = { x: previous.x + (guard.position.x - previous.x) * j / 20, y: previous.y, z: previous.z + (guard.position.z - previous.z) * j / 20 };
      assert.equal(playerBlocked(sample, true, .7), false, 'the entire movement segment must clear the solid furniture');
    }
    closest = Math.min(closest, Math.hypot(guard.position.x - h.neo().position.x, guard.position.z - h.neo().position.z));
  }
  assert.ok(closest < 2.2, `the guard should reach the open side of the cubicle, closest distance was ${closest}`);
});

test('full exposure starts a chase; an agent must get close to capture Neo', () => {
  const h = setup(); h.office();
  const guard = h.sandbox.state.threats.find(t => t.id === 'office:0')!;
  h.sandbox.state.threats = [guard];
  guard.position = filmPosition('film_metacortex_floor', 0, -25); guard.yaw = 0;
  h.neo().position = filmPosition('film_metacortex_floor', 0, -9);
  h.state().office!.searchAt = h.tick();
  h.advance(4);
  assert.equal(h.state().office?.alert, 100);
  assert.equal(h.state().office?.outcome, undefined, 'recognition across the room is not physical capture');
  h.advance(12); assert.equal(h.state().office?.outcome, 'captured');
});

test('agents investigate the last observed position, pause across disconnects and eventually resume patrol', () => {
  const h = setup(); h.office();
  const guard = h.sandbox.state.threats.find(t => t.id === 'office:0')!;
  h.sandbox.state.threats = [guard];
  guard.position = filmPosition('film_metacortex_floor', -16, -12.5); guard.yaw = 0;
  h.neo().position = filmPosition('film_metacortex_floor', -16, -5.2);
  h.state().office!.searchAt = h.tick(); h.advance(2);
  const observed = { ...h.neo().position };
  h.neo().position = filmPosition('film_metacortex_floor', 16, 6.7);
  h.neo().currentAction = { type: 'idle', parameters: { crouching: true }, startedAt: h.tick(), duration: 1, progress: 0 };
  h.advance();
  assert.deepEqual(h.state().office!.searches?.[0]?.position, observed, 'losing sight must preserve the clue, not track through walls');
  const search = structuredClone(h.state().office!.searches![0]!);
  const position = { ...guard.position };
  h.players.release('neo-player', h.tick()); h.advance(30);
  assert.deepEqual(h.state().office!.searches![0], search);
  assert.deepEqual(guard.position, position);
  h.sandbox.restore(JSON.parse(JSON.stringify(h.sandbox.state)));
  h.players.possess('neo-player', 'neo', h.tick()); h.advance();
  assert.equal(h.state().office!.searches![0]!.remaining, search.remaining - 1);
  assert.deepEqual(h.state().office!.searches![0]!.position, observed);
  let closest = Infinity;
  for (let i = 0; i < 30; i++) {
    h.advance(); const searchingGuard = h.sandbox.state.threats.find(t => t.id === 'office:0')!;
    closest = Math.min(closest, Math.hypot(searchingGuard.position.x - observed.x, searchingGuard.position.z - observed.z));
  }
  assert.ok(closest < 1, 'the agent checks the actual last seen cubicle');
  assert.equal(h.state().office!.searches![0], null, 'an unsuccessful search returns to patrol');
  assert.equal(h.state().office!.alert, 0);
});

test('footsteps trigger an investigation without giving a hidden crouching player away', () => {
  const h = setup(); h.office(); const guard = h.sandbox.state.threats.find(t => t.id === 'office:0')!;
  h.sandbox.state.threats = [guard]; guard.position = filmPosition('film_metacortex_floor', 0, -14); guard.yaw = Math.PI;
  h.neo().position = filmPosition('film_metacortex_floor', 0, -6);
  h.neo().velocity = { x: 0, y: 0, z: 8 }; h.state().office!.searchAt = h.tick(); h.advance();
  assert.equal(h.state().office!.searches?.[0]?.source, 'sound');
  assert.equal(h.state().office!.spotted, false); assert.match(h.state().office!.guide, /听见了脚步/);
  h.command('retry'); const fresh = h.sandbox.state.threats.find(t => t.id === 'office:0')!;
  h.sandbox.state.threats = [fresh]; fresh.position = filmPosition('film_metacortex_floor', 0, -14); fresh.yaw = Math.PI;
  h.neo().position = filmPosition('film_metacortex_floor', 0, -6); h.neo().velocity = { x: 0, y: 0, z: 1.6 };
  h.neo().currentAction = { type: 'idle', parameters: { crouching: true }, startedAt: h.tick(), duration: 1, progress: 0 };
  h.state().office!.searchAt = h.tick(); h.advance();
  assert.equal(h.state().office!.searches![0], null); assert.equal(h.state().office!.alert, 0);
});

test('rushing up the exposed central aisle draws the agents and can end in capture', () => {
  const h = setup(); h.office();
  for (const [x, z] of [[-16, 11], [-8, 11], [-8, -13], [-16, -13], [-8, -13], [-8, -24], [-24, -27]]) if (!h.move(x, z, false)) break;
  assert.equal(h.maximumAlert(), 100);
  assert.equal(h.state().office?.outcome, 'captured'); assert.equal(h.neo().status, 'alive');
  h.command('next'); assert.equal(h.scene().id, 'm1_interrogation');
});

test('Neo can creep from his phone through the empty cubicle and along the windows without being spotted', () => {
  const h = setup(); h.office();
  for (const [x, z] of [[-16, 11], [-24, 11], [-24, -13], [-16, -13], [-24, -13], [-24, -27]]) assert.ok(h.move(x, z), `caught on the way to ${x}, ${z}`);
  assert.equal(h.state().step, 2);
  h.command('act'); for (let f = 0; f < 70; f++) { h.players.step(.05, true, h.tick()); if (f % 10 === 9) h.advance(); }
  assert.equal(h.state().step, h.scene().steps.length);
  assert.equal(h.maximumAlert(), 0, 'the route must provide real cover, without turning off sight or leaving the encounter');
  assert.equal(h.state().office?.outcome, undefined);
});

test('opening the office window has a saved physical action, not an elapsed story timer', () => {
  const h = setup(); h.office(); h.goal(); h.advance(); h.goal(); h.advance(); h.goal();
  h.command('act'); h.advance(2);
  assert.equal(h.state().step, 2, 'ordinary ticks must not finish the window interaction');
  assert.equal(h.state().started, undefined);
  const frame = (seconds: number, running = true) => { for (let f = 0; f < seconds * 20; f++) h.players.step(.05, running, h.tick()); };
  frame(1); const time = h.state().office!.window; const position = { ...h.neo().position };
  assert.ok(time! > .9);
  h.players.receiveInput('neo-player', { x: 1, z: 1, yaw: 0, sprint: true, jump: true, sequence: 1 });
  frame(.1); assert.deepEqual(h.neo().position, position, 'running cannot interrupt contact with the window handle');
  const paused = h.state().office!.window;
  frame(2, false); assert.equal(h.state().office!.window, paused);
  h.players.release('neo-player', h.tick()); frame(2); h.advance(20);
  assert.equal(h.world.agents.get('neo')!.currentAction?.parameters.window, paused, 'disconnecting must retain the visible hand pose');
  h.sandbox.restore(JSON.parse(JSON.stringify(h.sandbox.state)));
  assert.equal(h.state().office!.window, paused);
  h.players.possess('neo-player', 'neo', h.tick());
  assert.equal(h.neo().currentAction?.parameters.window, paused, 'a paused reconnect must restore the window pose before any simulation frame');
  frame(3);
  assert.equal(h.state().step, 3);
  h.crossWindow(); assert.equal(h.scene().id, 'm1_ledge');
});

test('opening the window does not make Neo immune to an agent who reaches him', () => {
  const h = setup(); h.office(); h.goal(); h.advance(); h.goal(); h.advance(); h.goal(); h.command('act');
  h.players.step(.1, true, h.tick());
  const guard = h.sandbox.state.threats.find(t => t.id === 'office:0')!;
  guard.position = { ...h.neo().position, x: h.neo().position.x + 1 }; guard.yaw = -Math.PI / 2;
  h.state().office!.searchAt = h.tick(); h.advance(3);
  assert.equal(h.state().office!.outcome, 'captured');
  h.command('next'); assert.equal(h.scene().id, 'm1_interrogation');
});

test('agents keep searching after the window opens, and leaving requires returning to that window', () => {
  const h = setup(); h.office(); h.finish();
  assert.equal(h.sandbox.state.threats.filter(t => t.patrol).length, 3, 'opening a window must not remove the agents inside the office');
  h.neo().position = filmPosition(h.scene().set, -24, 5);
  assert.match(h.command('next'), /窗口/); assert.equal(h.scene().id, 'm1_office_escape');
  const guard = h.sandbox.state.threats.find(t => t.id === 'office:0')!;
  guard.position = { ...h.neo().position, z: h.neo().position.z - 1 }; guard.yaw = 0;
  h.state().office!.searchAt = h.tick(); h.advance(3);
  assert.equal(h.state().office!.outcome, 'captured');
  h.command('next'); assert.equal(h.scene().id, 'm1_interrogation');
});

test('Neo crosses the sill before reaching the ledge, with continuous position and a saved handhold', () => {
  const h = setup(); h.office(); h.finish(); const start = { ...h.neo().position };
  h.command('next');
  assert.equal(h.scene().id, 'm1_office_escape', 'leaving must begin a body movement, not teleport to another map');
  const frame = (seconds: number, running = true) => {
    for (let f = 0; f < seconds * 20; f++) {
      const before = { ...h.neo().position }; h.players.step(.05, running, h.tick());
      assert.ok(Math.hypot(h.neo().position.x - before.x, h.neo().position.y - before.y, h.neo().position.z - before.z) < .3, 'no frame may jump between sets');
    }
  };
  frame(2.6); const elapsed = h.state().office!.crossing; const position = { ...h.neo().position };
  assert.ok(elapsed! > 2.5); assert.ok(position.y > start.y + .5, 'the body must rise over the sill');
  frame(2, false); assert.deepEqual(h.neo().position, position);
  h.players.release('neo-player', h.tick()); h.advance(10);
  assert.equal(h.world.agents.get('neo')!.currentAction?.parameters.crossing, elapsed);
  h.sandbox.restore(JSON.parse(JSON.stringify(h.sandbox.state)));
  h.players.possess('neo-player', 'neo', h.tick());
  assert.deepEqual(h.neo().position, position); assert.equal(h.neo().currentAction?.parameters.crossing, elapsed);
  assert.match(h.command('next'), /窗/); assert.equal(h.state().office!.crossing, elapsed);
  frame(5);
  assert.equal(h.scene().id, 'm1_ledge'); assert.equal(h.state().step, 0);
  assert.ok(Math.hypot(h.neo().position.x - start.x, h.neo().position.z - start.z) < 6);
  assert.equal(h.neo().position.y, start.y); assert.equal(playerBlocked(h.neo().position, true), false);
  assert.equal(h.sandbox.state.threats.filter(t => t.patrol).length, 0);
});

test('an agent reaching Neo before he clears the window interrupts the crossing', () => {
  const h = setup(); h.office(); h.finish(); h.command('next'); h.players.step(.1, true, h.tick());
  const guard = h.sandbox.state.threats.find(t => t.id === 'office:0')!;
  assert.ok(guard, 'pursuers stay in the office until Neo has crossed the window');
  guard.position = { ...h.neo().position, x: h.neo().position.x + 1 }; guard.yaw = -Math.PI / 2;
  h.state().office!.searchAt = h.tick(); h.advance(3);
  assert.equal(h.state().office!.outcome, 'captured'); assert.equal(h.state().office!.crossing, undefined);
  h.command('next'); assert.equal(h.scene().id, 'm1_interrogation');
});

test('retrying a crossing returns to the open window without erasing the search', () => {
  const h = setup(); h.office(); h.finish(); const checkpoint = { ...h.state().checkpoint };
  h.command('next'); for (let f = 0; f < 40; f++) h.players.step(.05, true, h.tick());
  h.command('retry');
  assert.deepEqual(h.neo().position, checkpoint); assert.equal(h.state().office!.crossing, undefined);
  assert.equal(h.state().office!.window, 3.2); assert.equal(h.sandbox.state.threats.filter(t => t.patrol).length, 3);
  h.crossWindow(); assert.equal(h.scene().id, 'm1_ledge');
});

test('an old isolated-ledge save migrates its player and checkpoint once, retaining ladder progress', () => {
  const h = setup(); h.office(); h.finish();
  const center = FILM_SETS.film_metacortex_floor.center;
  h.state().scene = 'm1_ledge'; h.state().step = 1; h.state().office!.climbed = 16;
  h.neo().currentLocation = 'film_office_ledge';
  h.neo().position = { x: center.x + 320 - 3.45, y: center.y - 16, z: center.z - 26 };
  h.state().checkpoint = { x: center.x + 320, y: center.y, z: center.z - 26 };
  h.sandbox.restore(JSON.parse(JSON.stringify(h.sandbox.state)));
  const position = { ...h.neo().position };
  assert.deepEqual(position, { ...filmPosition('film_office_ledge', -3.45, 26), y: center.y - 16 });
  assert.deepEqual(h.state().checkpoint, filmPosition('film_office_ledge', 0, 26));
  assert.equal(h.state().office!.climbed, 16);
  h.sandbox.restore(JSON.parse(JSON.stringify(h.sandbox.state)));
  assert.deepEqual(h.neo().position, position, 'migration must not move already migrated saves');
});

test('the agents pause to inspect the office, preserve that pause on reconnect, and still react to Neo', () => {
  const h = setup(); h.office();
  h.neo().currentAction = { type: 'idle', parameters: { crouching: true }, startedAt: h.tick(), duration: 1, progress: 0 };
  const guard = h.sandbox.state.threats.find(t => t.id === 'office:0')!; const start = { ...guard.position };
  h.advance(4); assert.deepEqual(guard.position, start);
  const remaining = h.state().office!.patrolWait![0];
  h.players.release('neo-player', h.tick()); h.advance(20);
  h.sandbox.restore(JSON.parse(JSON.stringify(h.sandbox.state)));
  h.players.possess('neo-player', 'neo', h.tick()); h.advance();
  assert.equal(h.state().office!.patrolWait![0], remaining - 1);
  const restored = h.sandbox.state.threats.find(t => t.id === 'office:0')!;
  h.neo().position = { ...restored.position, x: restored.position.x + Math.sin(restored.yaw!) * 6, z: restored.position.z + Math.cos(restored.yaw!) * 6 };
  h.state().office!.searchAt = h.tick(); h.advance();
  assert.ok(h.state().office!.alert > 0);
  assert.equal(h.state().office!.patrolWait![0], 0, 'an inspection pause must never disable perception or pursuit');
});

test('the agents find Anderson at his desk if he ignores the warning and stays there', () => {
  const h = setup(); h.office();
  h.neo().currentAction = { type: 'idle', parameters: { crouching: true }, startedAt: h.tick(), duration: 1, progress: 0 };
  h.advance(180);
  assert.equal(h.state().office?.outcome, 'captured');
  assert.equal(h.neo().status, 'alive');
});

test('successful escape skips interrogation and the car scan does not invent an implanted device', () => {
  const h = setup(); h.office(); h.finish(); h.crossWindow();
  assert.equal(h.scene().id, 'm1_ledge'); h.goal(); h.advance();
  h.goal(); h.command('escape:climb'); h.climb(8.1); assert.equal(h.state().office?.outcome, 'escaped');
  h.command('next'); assert.equal(h.scene().id, 'm1_wake_again');
  assert.ok(h.state().skipped?.includes('m1_interrogation')); assert.ok(!h.state().completed.includes('m1_interrogation'));
  h.finish(); h.command('next'); h.finish(); h.command('next'); assert.equal(h.scene().id, 'm1_bug');
  h.goal(); h.command('act'); for (let frame = 0; frame < 81; frame++) h.players.step(.1, true, h.tick());
  assert.match(h.state().lastText, /没有发现追踪装置/); assert.equal(h.state().office?.bugged, false);
});

test('escaping requires descending the ladder; stopping, climbing up, pause and saving retain the handhold', () => {
  const h = setup(); h.office(); h.finish(); h.crossWindow(); h.goal(); h.advance(); h.command('escape:climb');
  h.advance(20); assert.equal(h.state().office?.outcome, undefined); assert.equal(h.state().office?.climbed, 0);
  h.climb(2); assert.ok(h.state().office!.climbed! > 7); const position = { ...h.neo().position };
  h.climb(1, 0); assert.deepEqual(h.neo().position, position);
  h.climb(1, 1, false); assert.deepEqual(h.neo().position, position);
  h.sandbox.restore(JSON.parse(JSON.stringify(h.sandbox.state))); h.advance(20);
  assert.equal(h.state().office?.outcome, undefined); assert.deepEqual(h.neo().position, position);
  h.climb(1, -1); assert.ok(h.neo().position.y > position.y + 3);
  assert.match(h.command('next'), /先完成/);
  h.climb(8); assert.equal(h.state().office?.outcome, 'escaped'); assert.equal(h.neo().status, 'alive');
  assert.equal(h.state().step, 2); assert.ok(h.neo().position.y < FILM_SETS.film_office_ledge.center.y - 30);
  h.climb(.1, 0); assert.ok(h.neo().position.y < FILM_SETS.film_office_ledge.center.y - 30, 'the lower platform must support the body');
});

test('losing sight reduces suspicion, reopening the save retains patrol progress, and retry resets detection', () => {
  const h = setup(); h.office(); h.advance(8); const guard = h.sandbox.state.threats.find(t => t.id === 'office:0')!;
  h.neo().position = { ...guard.position, z: guard.position.z + 8 }; guard.yaw = 0; h.advance();
  assert.ok(h.state().office!.alert > 0 && h.state().office!.alert < 100);
  const previous = h.state().office!.alert; h.sandbox.restore(JSON.parse(JSON.stringify(h.sandbox.state)));
  assert.equal(h.state().office!.alert, previous);
  h.neo().position = filmPosition('film_metacortex_floor', -16, 5);
  h.neo().currentAction = { type: 'idle', parameters: { crouching: true }, startedAt: h.tick(), duration: 1, progress: 0 };
  h.advance(3); assert.ok(h.state().office!.alert < previous);
  h.command('retry'); assert.equal(h.state().office!.alert, 0); assert.equal(h.sandbox.state.threats.filter(t => t.patrol).length, 3);
});

test('pills require the live choice position and red cannot be selected through a generic reflection', () => {
  const h = setup(); h.command('continue');
  const state = h.state(); const scene = FILM_SCENE_BY_ID.m1_pills;
  state.scene = scene.id; state.step = 1; h.neo().currentLocation = scene.set;
  h.neo().position = filmPosition(scene.set, 0, 18);
  assert.match(h.command('blue'), /请走近/); assert.ok(h.sandbox.state.neoLife!.journey);
  h.goal(); state.visiting = 'm1_boss'; assert.match(h.command('blue'), /回访/); delete state.visiting;
  h.command('reflect:agency'); assert.equal(state.step, 1);
  h.command('pill:red'); assert.equal(state.step, 1);
  for (let frame = 0; frame < Math.ceil(PILL_TIMING.take / .1) + 1; frame++) h.players.step(.1, true, h.tick());
  assert.equal(state.scene, 'm1_mirror'); assert.equal(state.step, 0);
  assert.equal(h.sandbox.state.neoLife!.choices.pill, 'red');
});

test('blue pill returns to daily life with money and evidence preserved', () => {
  const h = setup(); h.command('continue'); const state = h.state();
  state.scene = 'm1_pills'; state.step = 1; h.neo().currentLocation = 'film_lafayette'; h.goal();
  h.sandbox.state.neoLife!.money = 287; h.sandbox.state.neoLife!.evidence = ['clock']; h.command('blue');
  assert.ok(h.sandbox.state.neoLife!.journey);
  for (let frame = 0; frame < Math.ceil(PILL_TIMING.take / .1) + 1; frame++) h.players.step(.1, true, h.tick());
  assert.equal(h.sandbox.state.neoLife!.journey, undefined); assert.equal(h.sandbox.state.neoLife!.chapter, 0);
  assert.equal(h.sandbox.state.neoLife!.money, 287); assert.deepEqual(h.sandbox.state.neoLife!.evidence, ['clock']);
  assert.equal(h.neo().currentLocation, 'neo_apartment');
});
