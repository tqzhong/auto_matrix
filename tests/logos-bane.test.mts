import assert from 'node:assert/strict';
import test from 'node:test';
import { FILM_SCENE_BY_ID, LOGOS_BANE, logosBaneRoot, groundHeight, filmPosition, filmEntry, filmStepPosition, type AgentState, type WorldEvent } from '@auto_matrix/shared';
import { WorldState } from '../packages/server/src/world/WorldState.js';
import { AgentManager } from '../packages/server/src/agents/AgentManager.js';
import { SandboxSystem } from '../packages/server/src/player/SandboxSystem.js';
import { PlayerController } from '../packages/server/src/player/PlayerController.js';
import type { ConversationEngine } from '../packages/server/src/agents/ConversationEngine.js';
import type { ActionExecutor } from '../packages/server/src/agents/ActionExecutor.js';
import type { WorldDynamics } from '../packages/server/src/story/WorldDynamics.js';

function setup() {
  const world = new WorldState(); const manager = new AgentManager(world); manager.initializeAllAgents();
  const dynamics = { record: (event: Omit<WorldEvent, 'id'>) => world.addWorldEvent(event) } as WorldDynamics;
  const sandbox = new SandboxSystem(world, dynamics, 42);
  const conversations = { interrupt() {}, isAgentInConversation: () => false, startConversation: () => false } as unknown as ConversationEngine;
  const actions = { execute() {} } as unknown as ActionExecutor;
  const players = new PlayerController(world, conversations, actions, dynamics, sandbox);
  let tick = 0; let sequence = 0;
  players.possess('film-player', 'neo', tick); sandbox.life.begin(world.agents.get('neo')!, tick); sandbox.state.neoLife!.chapter = 1;
  players.sandboxAction('film-player', { kind: 'life', target: 'film:continue' }, ++tick);
  const scene = FILM_SCENE_BY_ID.m3_bane; const state = sandbox.life.film.state!;
  Object.assign(state, { scene: scene.id, actor: 'neo', step: 0, bane: undefined, checkpoint: filmEntry(scene), completed: [], lastText: scene.context });
  const actor = players.getAgent('film-player')!;
  actor.currentLocation = scene.set; actor.isInMatrix = false; actor.position = filmEntry(scene);
  const command = (target: string) => players.sandboxAction('film-player', { kind: 'life', target: `film:${target}` }, ++tick);
  const act = (kind: string) => players.act('film-player', kind, ++tick);
  const frames = (count: number, focus = false, yaw = actor.rotation, x = 0, z = 0) => {
    for (let i = 0; i < count; i++) {
      players.receiveInput('film-player', { x, z, yaw, jump: false, sprint: false, focus, sequence: ++sequence });
      players.step(.1, true, ++tick);
    }
  };
  const advance = (count = 1) => { for (let i = 0; i < count; i++) sandbox.tick(++tick); };
  return { world, sandbox, players, scene, state, actor, command, act, frames, advance, tick: () => tick };
}

function until(h: ReturnType<typeof setup>, predicate: () => boolean, focus = false) {
  for (let i = 0; i < 400 && !predicate(); i++) h.frames(1, focus);
  assert.ok(predicate(), 'the saved encounter reaches the expected stage');
}
function startGun(h: ReturnType<typeof setup>) {
  h.actor.position = filmStepPosition(h.scene, h.scene.steps[0]); h.advance(); h.command('act');
  until(h, () => h.sandbox.life.film.state!.bane?.physical?.intro === 'lower_ready');
  h.command('act'); until(h, () => h.sandbox.life.film.state!.bane?.physical?.intro === 'recognition_ready');
  h.command('act'); until(h, () => h.sandbox.life.film.state!.bane?.phase === 'gun_warning');
}
function faceBane(h: ReturnType<typeof setup>) {
  const bane = h.world.agents.get('bane')!;
  h.actor.position = { ...bane.position, x: bane.position.x - 2 };
  h.actor.rotation = Math.atan2(bane.position.x - h.actor.position.x, bane.position.z - h.actor.position.z);
}
function surviveGun(h: ReturnType<typeof setup>) {
  until(h, () => h.sandbox.life.film.state!.bane?.phase === 'gun_window'); h.act('dodge');
  until(h, () => h.sandbox.life.film.state!.bane?.phase === 'grapple'); faceBane(h);
  h.act('attack'); until(h, () => !h.sandbox.life.film.state!.bane?.physical?.strike);
  h.act('attack'); until(h, () => h.sandbox.life.film.state!.bane?.phase === 'blind');
}

test('Neo survives the standoff, power cut and saved physical fight before opening the hatch for Trinity', () => {
  const h = setup(), { state, scene } = h;
  startGun(h); assert.equal(state.step, 1);
  assert.equal(h.sandbox.state.neoLife!.choices.bane_identity, 'smith');
  assert.equal(h.sandbox.state.neoLife!.journal.filter(item => item.title === '肉身背后的身份').length, 1);
  state.completed.push('m1_pills'); assert.match(h.command('visit:m1_pills'), /先完成/); assert.equal(state.visiting, undefined);
  assert.match(h.act('ability'), /现实|无法/); assert.equal(state.bane?.phase, 'gun_warning');
  until(h, () => state.bane?.phase === 'gun_window');
  const gunGesture = h.world.agents.get('bane')!.currentAction!.startedAt;
  h.frames(2); assert.equal(h.world.agents.get('bane')!.currentAction!.startedAt, gunGesture, 'the saved pose does not restart per frame');
  h.act('dodge'); assert.equal(state.bane?.phase, 'gun_window', 'a dodge resolves after its body movement');
  until(h, () => state.bane?.phase === 'grapple');
  assert.match(h.act('attack'), /靠近|面向/);
  const before = h.actor.position.x; h.frames(3, false, h.actor.rotation, 1);
  assert.ok(h.actor.position.x > before + .2, 'Neo can move to close the distance');
  faceBane(h); h.act('attack'); assert.equal(state.bane?.hits, 0);
  h.frames(3); assert.equal(state.bane?.hits, 0, 'the hit waits for actual contact timing');
  until(h, () => !state.bane?.physical?.strike); assert.equal(state.bane?.hits, 1);
  h.act('attack'); until(h, () => state.bane?.phase === 'blind');
  assert.equal(h.sandbox.state.neoLife!.choices.neo_eyes, 'burned');
  assert.equal(h.world.agents.get('bane')!.status, 'alive');
  until(h, () => state.bane?.phase === 'pipe_window', true); h.act('dodge');
  until(h, () => state.bane?.phase === 'counter'); faceBane(h);
  h.act('attack'); until(h, () => !state.bane?.physical?.strike);
  h.act('attack'); assert.equal(h.world.agents.get('bane')!.status, 'alive');
  until(h, () => state.step === 2);
  assert.equal(h.world.agents.get('bane')!.status, 'dead');
  assert.equal(h.world.agents.get('trinity')!.position.y, h.actor.position.y - 4.2);
  h.actor.position = filmStepPosition(scene, scene.steps[2]); h.command('act');
  assert.equal(state.step, 2, 'a use action does not teleport Trinity out of the hatch');
  until(h, () => state.bane?.physical?.rescue === 'climbing'); h.frames(10);
  const trinity = h.world.agents.get('trinity')!;
  assert.ok(trinity.position.y > h.actor.position.y - 4.2 && trinity.position.y < h.actor.position.y);
  until(h, () => state.step === scene.steps.length);
  assert.ok(state.completed.includes(scene.id)); assert.equal(trinity.status, 'alive');
  assert.equal(h.sandbox.state.neoLife!.choices.neo_eyes, 'burned');
});

test('gun and blind checkpoints fail and resume with saved injury, crew states and disconnected focus', () => {
  const h = setup(); startGun(h); until(h, () => h.state.bane?.phase === 'failed');
  assert.equal(h.state.bane?.checkpoint, 'gun');
  assert.match(h.command('retry'), /检查点/); assert.equal(h.state.bane?.attempts, 1);
  surviveGun(h); h.frames(8, true);
  const savedFocus = h.state.bane!.focus, injuredHealth = h.actor.health;
  h.sandbox.restore(JSON.parse(JSON.stringify(h.sandbox.state)));
  const restored = h.sandbox.life.film.state!;
  assert.equal(restored.bane?.focus, savedFocus);
  h.players.release('film-player', h.tick()); h.advance(20);
  assert.equal(restored.bane?.focus, savedFocus, 'disconnect does not advance perception');
  h.players.possess('film-player', 'neo', h.tick());
  until(h, () => restored.bane?.phase === 'pipe_window', true); until(h, () => restored.bane?.phase === 'failed');
  assert.equal(restored.bane?.checkpoint, 'blind');
  h.command('retry'); assert.equal(restored.bane?.phase, 'blind'); assert.equal(restored.bane?.attempts, 2);
  assert.equal(h.actor.health, injuredHealth); assert.equal(h.sandbox.state.neoLife!.choices.neo_eyes, 'burned');
});

test('Bane controlled by another player cannot be taken over by the scene', () => {
  const h = setup(); h.actor.position = filmStepPosition(h.scene, h.scene.steps[0]); h.advance();
  h.players.possess('other-player', 'bane', h.tick());
  const before = { ...h.world.agents.get('bane')!.position };
  assert.match(h.command('act'), /另一位玩家/); h.frames(20);
  assert.equal(h.state.bane?.physical?.intro, 'waiting');
  assert.deepEqual(h.world.agents.get('bane')!.position, before); assert.equal(h.players.getAgent('other-player')?.id, 'bane');
});

test('the scripted fight reserves Bane and Trinity during the hostage standoff', () => {
  const h = setup(); h.actor.position = filmStepPosition(h.scene, h.scene.steps[0]); h.advance(); h.command('act');
  assert.equal(h.state.bane?.physical?.intro, 'hostage');
  assert.match(h.players.possess('other-player', 'bane', h.tick()).error ?? '', /剧情|片段|交手/);
  assert.match(h.players.possess('other-player', 'trinity', h.tick()).error ?? '', /剧情|片段|交手/);
  assert.equal(h.players.getAgent('other-player'), undefined);
});

test('the Logos entry keeps Smith unknown and stages the hostage before the power-cut fight', () => {
  const h = setup();
  assert.doesNotMatch(h.scene.context, /Smith|史密斯|金色/);
  h.actor.position = filmStepPosition(h.scene, h.scene.steps[0]); h.advance();
  h.command('act');
  assert.equal(h.state.bane?.phase, 'ready', 'the gun warning must wait for the hostage and recognition sequence');
  assert.match(h.state.lastText, /Trinity|安德森/);
  assert.equal(h.sandbox.state.neoLife!.choices.bane_identity, undefined);
  h.act('attack'); h.frames(10);
  assert.equal(h.state.bane?.phase, 'ready', 'a generic attack cannot skip the standoff');
});

test('Bane in an unfinished legacy save is not resurrected merely by inspecting the scene', () => {
  const h = setup(); const bane = h.world.agents.get('bane')!;
  h.state.step = 2; h.actor.position = filmStepPosition(h.scene, h.scene.steps[1]);
  bane.status = 'dead'; bane.health = 0;
  h.command('act');
  assert.equal(bane.status, 'dead'); assert.equal(bane.health, 0);
  assert.ok(!h.state.completed.includes(h.scene.id));
});

test('the gun checkpoint restores its saved injury level and leaves crew health and supplies alone', () => {
  const h = setup(), bane = h.world.agents.get('bane')!, trinity = h.world.agents.get('trinity')!;
  h.actor.health = 43; bane.health = 37; trinity.health = 47;
  h.sandbox.state.profiles.neo.inventory.medkit = 0;
  h.actor.position = filmStepPosition(h.scene, h.scene.steps[0]); h.advance();
  h.command('act');
  for (let i = 0; i < 1200 && h.state.bane?.phase !== 'failed'; i++) {
    h.frames(1);
    if (h.state.bane?.phase === 'ready') h.command('act');
  }
  assert.equal(h.state.bane?.phase, 'failed');
  h.command('retry');
  assert.equal(h.actor.health, 43); assert.equal(bane.health, 37); assert.equal(trinity.health, 47);
  assert.equal(h.sandbox.state.profiles.neo.inventory.medkit, 0);
});

test('an unavailable Trinity is not moved by the staged encounter', () => {
  const h = setup(), trinity = h.world.agents.get('trinity')!;
  trinity.status = 'disconnected'; trinity.position = { x: 19, y: 7, z: 29 }; trinity.currentAction = null;
  const before = { ...trinity.position };
  h.actor.position = filmStepPosition(h.scene, h.scene.steps[0]); h.advance(); h.command('act'); h.frames(20);
  assert.deepEqual(trinity.position, before); assert.equal(trinity.currentAction, null);
  assert.equal(trinity.status, 'disconnected'); assert.equal(h.state.bane?.elapsed, 0);
});


test('hostage clocks and gun placement resume from a saved partial action without learning Smith early', () => {
  const h = setup(); h.actor.position = filmStepPosition(h.scene, h.scene.steps[0]); h.advance(); h.command('act'); h.frames(17);
  const before = h.state.bane!.physical!.elapsed;
  h.sandbox.restore(JSON.parse(JSON.stringify(h.sandbox.state))); h.players.release('film-player', h.tick()); h.advance(10);
  const state = h.sandbox.life.film.state!;
  assert.equal(state.bane!.physical!.elapsed, before); assert.equal(h.sandbox.state.neoLife!.choices.bane_identity, undefined);
  h.players.possess('film-player', 'neo', h.tick()); until(h, () => state.bane!.physical!.intro === 'lower_ready'); h.command('act'); h.frames(13);
  assert.equal(state.bane!.physical!.gunOnDeck, false);
  const point = { ...state.bane!.physical!.gunPoint! };
  until(h, () => state.bane!.physical!.intro === 'recognition_ready');
  assert.deepEqual(state.bane!.physical!.gunPoint, point); assert.equal(state.bane!.physical!.known, false);
  h.command('act'); h.frames(70); assert.equal(h.sandbox.state.neoLife!.choices.bane_identity, undefined);
  h.frames(20); assert.equal(h.sandbox.state.neoLife!.choices.bane_identity, 'smith');
});


test('opening the hatch exposes the physical lower deck instead of leaving an invisible floor', () => {
  const h = setup(); h.actor.position = filmStepPosition(h.scene, h.scene.steps[0]); h.advance();
  const point = filmPosition(h.scene.set, LOGOS_BANE.hatch.x, LOGOS_BANE.hatch.z);
  assert.equal(groundHeight(point, false, h.sandbox.state.structures), point.y);
  h.state.bane!.phase = 'defeated'; h.state.bane!.physical!.intro = 'done'; h.state.step = 2;
  h.world.agents.get('bane')!.status = 'dead'; h.world.agents.get('bane')!.health = 0;
  h.actor.position = filmStepPosition(h.scene, h.scene.steps[2]); h.command('act'); until(h, () => h.state.bane!.physical!.rescue === 'climbing');
  assert.equal(groundHeight(point, false, h.sandbox.state.structures), point.y + LOGOS_BANE.hatch.lower);
});

test('pushing Trinity below, picking up the gun and returning to the deck do not teleport the cast', () => {
  const h = setup(); h.actor.position = filmStepPosition(h.scene, h.scene.steps[0]); h.advance();
  const encounter = h.state.bane!, physical = encounter.physical!;
  physical.intro = 'dropping'; physical.elapsed = LOGOS_BANE.dropSeconds;
  const pushed = logosBaneRoot(encounter, 'bane');
  physical.intro = 'taking'; physical.elapsed = 0;
  assert.ok(Math.hypot(pushed.x - logosBaneRoot(encounter, 'bane').x, pushed.z - logosBaneRoot(encounter, 'bane').z) < .03, 'Bane must start walking to the gun from his actual push position');
  physical.intro = 'done'; physical.rescue = 'climbing'; physical.rescueElapsed = LOGOS_BANE.climbSeconds;
  const climbed = logosBaneRoot(encounter, 'trinity');
  physical.rescue = 'checking'; physical.rescueElapsed = 0;
  const checking = logosBaneRoot(encounter, 'trinity');
  assert.ok(Math.hypot(climbed.x - checking.x, climbed.y - checking.y, climbed.z - checking.z) < .03, 'Trinity must finish climbing at her actual check-in position');
  assert.ok(Math.abs(checking.x - LOGOS_BANE.hatch.x) > LOGOS_BANE.hatch.width / 2 || Math.abs(checking.z - LOGOS_BANE.hatch.z) > LOGOS_BANE.hatch.depth / 2, 'Trinity must stand on the deck instead of above the open hole');
});

test('a paused legacy Logos save stages the bay and camera before any world time advances', () => {
  const h = setup(); h.state.lastText = 'Neo 发现占据 Bane 身体的 Smith。';
  h.players.release('film-player', h.tick()); h.actor.currentAction = null;
  h.sandbox.restore(JSON.parse(JSON.stringify(h.sandbox.state)));
  const journey = h.sandbox.life.film.state!;
  assert.equal(journey.bane?.physical?.intro, 'waiting');
  assert.equal(journey.bane?.physical?.elapsed, 0);
  assert.equal((h.actor.currentAction?.parameters.logosBane as any)?.role, 'neo');
  assert.doesNotMatch(journey.lastText, /Smith|史密斯/);
  h.actor.currentAction = null;
  h.players.possess('film-player', 'neo', h.tick());
  assert.equal((h.actor.currentAction?.parameters.logosBane as any)?.role, 'neo', 'paused possession must restore the actual camera gesture');
  assert.equal(journey.bane?.physical?.elapsed, 0);
});

test('releasing Neo retains the paused physical encounter without changing its saved clocks', () => {
  const h = setup(); h.actor.position = filmStepPosition(h.scene, h.scene.steps[0]); h.advance(); h.command('act'); h.frames(13);
  const before = JSON.stringify(h.state.bane);
  h.players.release('film-player', h.tick());
  assert.equal(h.actor.controller, undefined);
  assert.equal((h.actor.currentAction?.parameters.logosBane as any)?.role, 'neo');
  assert.equal(JSON.stringify(h.state.bane), before);
});

test('Neo backs away after placing the gun and a partial retreat stays fixed while paused', () => {
  const h = setup(); h.actor.position = filmStepPosition(h.scene, h.scene.steps[0]); h.advance(); h.command('act');
  until(h, () => h.state.bane!.physical!.intro === 'lower_ready'); h.command('act');
  const start = { ...h.actor.position }, point = { ...h.state.bane!.physical!.gunPoint! }, yaw = h.actor.rotation;
  const retreat = () => (start.x - h.actor.position.x) * Math.sin(yaw) + (start.z - h.actor.position.z) * Math.cos(yaw);
  h.frames(15); assert.ok(Math.abs(h.actor.position.z - start.z) < .03, 'the gun is still being placed before the retreat');
  h.frames(5); assert.ok(retreat() > .4, 'Neo retreats relative to his saved facing direction');
  assert.deepEqual(h.state.bane!.physical!.gunPoint, point, 'the retreat cannot drag the dropped gun');
  const paused = { ...h.actor.position }, elapsed = h.state.bane!.physical!.elapsed;
  h.players.release('film-player', h.tick()); h.sandbox.restore(JSON.parse(JSON.stringify(h.sandbox.state)));
  const state = h.sandbox.life.film.state!;
  assert.deepEqual(h.actor.position, paused); assert.equal(state.bane!.physical!.elapsed, elapsed);
  h.players.possess('film-player', 'neo', h.tick()); until(h, () => state.bane!.physical!.intro === 'recognition_ready');
  assert.ok(retreat() > 1.9); assert.equal(state.bane!.physical!.known, false);
  h.command('act'); assert.equal(state.bane!.physical!.intro, 'recognition', 'recognition remains available from the actual retreated position');
});

test('Bane approaches the retreated Neo during recognition instead of walking away with the gun', () => {
  const h = setup(); h.actor.position = filmStepPosition(h.scene, h.scene.steps[0]); h.actor.rotation = 0; h.advance(); h.command('act');
  until(h, () => h.state.bane!.physical!.intro === 'lower_ready'); h.command('act');
  until(h, () => h.state.bane!.physical!.intro === 'recognition_ready');
  const gap = () => Math.hypot(h.actor.position.x - h.world.agents.get('bane')!.position.x, h.actor.position.z - h.world.agents.get('bane')!.position.z);
  const before = gap(); h.command('act'); h.frames(44);
  assert.ok(gap() < before - .5, `Bane must approach Neo: ${before} → ${gap()}`);
  assert.ok(gap() >= 1.5, 'the gunman must stop before his body intersects Neo');
});

test('an older partial eye-burn save repairs the head clearance without advancing time or healing the cast', () => {
  const h = setup(); startGun(h); until(h, () => h.state.bane?.phase === 'gun_window'); h.act('dodge');
  until(h, () => h.state.bane?.phase === 'grapple'); faceBane(h);
  h.act('attack'); until(h, () => !h.state.bane!.physical!.strike); h.act('attack'); until(h, () => h.state.bane?.phase === 'burning');
  h.frames(6); h.players.release('film-player', h.tick());
  const saved = JSON.parse(JSON.stringify(h.sandbox.state)), physical = saved.neoLife.journey.bane.physical;
  const bane = logosBaneRoot(saved.neoLife.journey.bane, 'bane'), dx = physical.burnTo.x - bane.x, dz = physical.burnTo.z - bane.z, length = Math.hypot(dx, dz);
  physical.burnTo.x = bane.x + dx / length * 1.1; physical.burnTo.z = bane.z + dz / length * 1.1;
  h.actor.position = filmPosition(h.scene.set, physical.burnTo.x, physical.burnTo.z);
  const elapsed = saved.neoLife.journey.bane.elapsed, health = [...h.world.agents].map(([id, a]) => [id, a.status, a.health]), choices = structuredClone(saved.neoLife.choices);
  h.sandbox.restore(saved); const restored = h.sandbox.life.film.state!.bane!;
  assert.ok(Math.hypot(restored.physical!.burnTo!.x - bane.x, restored.physical!.burnTo!.z - bane.z) >= 1.79, 'an older target cannot keep the two heads interpenetrating');
  const root = logosBaneRoot(restored, 'neo');
  assert.ok(Math.hypot(h.actor.position.x - filmPosition(h.scene.set, root.x, root.z).x, h.actor.position.z - filmPosition(h.scene.set, root.x, root.z).z) < .001, 'the repair is visible while the saved action remains paused');
  assert.equal(restored.elapsed, elapsed); assert.deepEqual([...h.world.agents].map(([id, a]) => [id, a.status, a.health]), health);
  assert.deepEqual(h.sandbox.state.neoLife!.choices, choices); assert.equal(h.actor.controller, undefined);
});
