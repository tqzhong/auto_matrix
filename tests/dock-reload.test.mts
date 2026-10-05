import assert from 'node:assert/strict';
import test from 'node:test';
import { DOCK_GUNNERY, DOCK_RELOAD, DOCK_LAST_STAND, FILM_SCENE_BY_ID, filmPosition, newDockGunnery, type WorldEvent } from '@auto_matrix/shared';
import { WorldState } from '../packages/server/src/world/WorldState.js';
import { AgentManager } from '../packages/server/src/agents/AgentManager.js';
import { SandboxSystem } from '../packages/server/src/player/SandboxSystem.js';
import { PlayerController } from '../packages/server/src/player/PlayerController.js';
import type { ConversationEngine } from '../packages/server/src/agents/ConversationEngine.js';
import type { ActionExecutor } from '../packages/server/src/agents/ActionExecutor.js';
import type { WorldDynamics } from '../packages/server/src/story/WorldDynamics.js';

function game() {
  const world = new WorldState(); new AgentManager(world).initializeAllAgents();
  const dynamics = { record: (event: Omit<WorldEvent, 'id'>) => world.addWorldEvent(event) } as WorldDynamics;
  const sandbox = new SandboxSystem(world, dynamics, 42);
  const players = new PlayerController(world, { interrupt() {}, isAgentInConversation: () => false } as unknown as ConversationEngine,
    { execute() {} } as unknown as ActionExecutor, dynamics, sandbox);
  players.possess('p', 'neo', 0); sandbox.life.begin(world.agents.get('neo')!, 0);
  sandbox.state.neoLife!.chapter = 1; players.sandboxAction('p', { kind: 'life', target: 'film:start' }, 1);
  const scene = FILM_SCENE_BY_ID.m3_dock_battle, state = sandbox.life.film.state!;
  Object.assign(state, { scene: scene.id, actor: 'mifune', step: 1, dockGunnery: newDockGunnery(2) });
  Object.assign(state.dockGunnery!, { phase: 'cleared', kidZ: DOCK_GUNNERY.kidFinish, kills: 4, ammo: 12 });
  state.dockGunnery!.targets.forEach(target => { target.health = 0; });
  players.possess('p', 'mifune', 2);
  const mifune = players.getAgent('p')!, kid = world.agents.get('kid')!;
  mifune.currentLocation = scene.set; mifune.isInMatrix = false; mifune.position = filmPosition(scene.set, 0, 12);
  kid.currentLocation = scene.set; kid.isInMatrix = false; kid.position = filmPosition(scene.set, -6.8, DOCK_GUNNERY.kidFinish);
  const command = (target: string, tick = 3) => players.sandboxAction('p', { kind: 'life', target: `film:${target}` }, tick);
  return { world, sandbox, players, scene, state, mifune, kid, command, sequence: 0 };
}

function frames(h: ReturnType<typeof game>, seconds: number, input: { focus?: boolean; climb?: number } = {}) {
  for (let frame = 0; frame < Math.ceil(seconds / .05); frame++) {
    h.players.receiveInput('p', { x: 0, z: 0, yaw: Math.PI, jump: false, sprint: false, focus: false, climb: 0, ...input, sequence: ++h.sequence });
    h.players.step(.05, true, 40 + frame);
  }
}
function atLoader(h: ReturnType<typeof game>) {
  h.command('act'); h.kid.position = filmPosition(h.scene.set, DOCK_RELOAD.entry.x, DOCK_RELOAD.entry.z); h.command('act', 4);
}
function jammed(h: ReturnType<typeof game>) {
  atLoader(h); frames(h, 3.1, { focus: true }); frames(h, 3.3, { climb: 1 });
  assert.equal(h.state.dockReload?.phase, 'jammed');
}

test('clearing the cannon wave hands loading to Kid instead of completing it with a two-second timer', () => {
  const h = game(); h.command('act');
  assert.equal(h.players.getAgent('p')?.id, 'kid', 'Kid must perform the reload rather than Mifune waiting at the cannon');
  assert.equal(h.state.actor, 'kid');
  for (let tick = 4; tick <= 30; tick++) h.sandbox.tick(tick);
  assert.equal(h.state.step, 1);
  assert.equal(h.state.completed.includes(h.scene.id), false);
  assert.equal(h.state.started, undefined);
});

test('another player controlling Kid keeps the cleared wave and cannot be displaced by loading', () => {
  const h = game(); h.players.possess('other', 'kid', 3);
  const before = structuredClone(h.kid);
  const result = h.command('act', 4);
  assert.match(result, /玩家/);
  assert.equal(h.players.getAgent('p')?.id, 'mifune');
  assert.deepEqual(h.kid, before);
  assert.equal(h.state.dockGunnery?.phase, 'cleared');
  assert.equal(h.state.started, undefined);
});

test('Kid must reach the loader, lift the box, climb, brace and kick, then descend before the gate handoff', () => {
  const h = game(); h.command('act');
  h.command('act', 4); assert.equal(h.state.dockReload?.phase, 'approach', 'G at the cart cannot teleport Kid to the loader');
  h.kid.position = filmPosition(h.scene.set, DOCK_RELOAD.entry.x, DOCK_RELOAD.entry.z); h.command('act', 5);
  frames(h, .6); assert.equal(h.state.dockReload?.lift, 0, 'the motor needs player input');
  frames(h, 1, { focus: true }); const lift = h.state.dockReload!.lift;
  frames(h, .3); assert.equal(h.state.dockReload?.lift, lift, 'release leaves the load at its current height');
  frames(h, 2.1, { focus: true }); assert.equal(h.state.dockReload?.phase, 'climbing');
  frames(h, 3.3, { climb: 1 }); assert.equal(h.state.dockReload?.phase, 'jammed');
  h.players.act('p', 'attack', 70); assert.equal(h.state.dockReload?.misses, 1, 'an unsupported kick cannot seat the box');
  frames(h, .7, { focus: true }); h.players.act('p', 'attack', 71);
  assert.equal(h.state.dockReload?.phase, 'kicking');
  frames(h, 1.2); assert.equal(h.state.dockReload?.phase, 'descending');
  assert.equal(h.state.step, 1, 'Kid still needs to get off the APU');
  frames(h, 3.3, { climb: -1 }); assert.equal(h.state.dockReload?.phase, 'done'); assert.equal(h.state.step, 2);
  assert.equal(h.mifune.status, 'alive');
  assert.equal(h.state.completed.includes(h.scene.id), false, 'Mifune still has to give Kid the last orders');
  h.players.receiveInput('p', { x: 1, z: 0, yaw: Math.PI / 2, jump: false, sprint: false, focus: false, climb: 0, sequence: ++h.sequence });
  h.players.step(.1, true, 89);
  const walked = { ...h.kid.position };
  h.players.release('p', 90); h.players.possess('p', 'kid', 91);
  assert.deepEqual(h.kid.position, walked, 'rejoining after loading must preserve free walking rather than snap Kid back onto the loader');
  assert.equal(h.kid.currentAction?.parameters.dockReload, undefined, 'the completed loader pose must release the body');
  h.command('next', 90); assert.equal(h.state.scene, 'm3_dock_battle'); assert.equal(h.state.actor, 'kid');
});

test('load timeout retries only loading and leaves the cleared cannon wave intact', () => {
  const h = game(); atLoader(h); const wave = structuredClone(h.state.dockGunnery);
  frames(h, 29); assert.equal(h.state.dockReload?.phase, 'failed'); assert.equal(h.kid.status, 'alive');
  h.command('retry', 91);
  assert.equal(h.state.dockReload?.phase, 'approach'); assert.equal(h.state.dockReload?.attempts, 1);
  assert.deepEqual(h.state.dockGunnery, wave); assert.equal(h.state.step, 1);
  assert.equal(h.state.completed.includes(h.scene.id), false);
});

test('seating the ammunition cannot silently kill Mifune or skip his last orders', () => {
  const h = game(); jammed(h); frames(h, .7, { focus: true }); h.players.act('p', 'attack', 71);
  frames(h, 1.2); frames(h, 3.3, { climb: -1 });
  assert.equal(h.mifune.status, 'alive', 'Mifune must survive the reload until the visible sentinel attack and final handoff');
  assert.equal(h.state.completed.includes(h.scene.id), false, 'loading is not the end of the dock scene');
  h.command('next', 90);
  assert.equal(h.state.scene, 'm3_dock_battle', 'the player cannot skip the last stand by continuing to Gate Three');
});

function afterReload() {
  const h = game(); jammed(h); frames(h, .7, { focus: true }); h.players.act('p', 'attack', 71);
  frames(h, 1.2); frames(h, 3.3, { climb: -1 }); return h;
}

test('rebuilding a fallen Kid during the handoff restores only Kid and keeps Mifune’s saved injuries', () => {
  const h = afterReload(); h.command('act', 90); frames(h, 5.3);
  const saved = structuredClone(h.state.dockLastStand), body = structuredClone(h.mifune.position), health = h.mifune.health;
  h.kid.status = 'dead'; h.kid.health = 0; h.players.release('p', 100); h.players.possess('p', 'kid', 101);
  assert.equal(h.kid.status, 'alive'); assert.equal(h.kid.health, h.kid.maxHealth);
  assert.deepEqual(h.state.dockLastStand, saved); assert.deepEqual(h.mifune.position, body); assert.equal(h.mifune.health, health);
  assert.equal(h.state.completed.includes(h.scene.id), false);
});

test('Kid witnesses the attack, physically approaches Mifune and answers before the irreversible gate handoff', () => {
  const h = afterReload(); const loaded = structuredClone(h.state.dockReload);
  h.command('act', 90); assert.equal(h.state.dockLastStand?.phase, 'attack');
  frames(h, 2); assert.equal(h.mifune.status, 'alive'); assert.equal(h.mifune.health, 1);
  frames(h, 3.3); assert.equal(h.state.dockLastStand?.phase, 'wounded');
  assert.equal(h.mifune.position.y, filmPosition(h.scene.set, 0, 0).y);
  h.command('act', 100); assert.equal(h.state.dockLastStand?.phase, 'wounded', 'interaction from the rear must not teleport Kid');
  // Real controller movement along the outside of the APU, then its front.
  for (const [x, z] of [[-4.3, 16.25], [-4.3, 6.3], [DOCK_LAST_STAND.kid.x, DOCK_LAST_STAND.kid.z]]) {
    const target = filmPosition(h.scene.set, x, z);
    for (let frame = 0; frame < 240; frame++) {
      const dx = target.x - h.kid.position.x, dz = target.z - h.kid.position.z, gap = Math.hypot(dx, dz);
      if (gap < .25) break;
      h.players.receiveInput('p', { x: dx / gap, z: dz / gap, yaw: Math.atan2(dx, dz), jump: false, sprint: false, sequence: ++h.sequence });
      h.players.step(.05, true, 110 + frame);
    }
    assert.ok(Math.hypot(target.x - h.kid.position.x, target.z - h.kid.position.z) < .25, 'the wounded captain must be reachable around the APU');
  }
  h.command('act', 400); assert.equal(h.state.dockLastStand?.phase, 'kneeling');
  frames(h, 6.8); assert.equal(h.state.dockLastStand?.phase, 'response');
  frames(h, 30); h.command('next', 450);
  assert.equal(h.state.scene, 'm3_dock_battle'); assert.equal(h.mifune.status, 'alive', 'waiting cannot supply Kid’s response');
  h.command('act', 451); frames(h, 3.3); assert.equal(h.state.dockLastStand?.phase, 'dying');
  frames(h, 4.2); assert.equal(h.state.dockLastStand?.phase, 'done'); assert.equal(h.state.step, 3);
  assert.equal(h.mifune.status, 'dead'); assert.equal(h.mifune.health, 0);
  assert.deepEqual(h.state.dockReload, loaded, 'the last stand cannot replay the successful reload');
  const body = structuredClone(h.mifune.position), kid = structuredClone(h.kid.position), xp = h.sandbox.state.profiles.kid.xp;
  h.sandbox.tick(480); h.sandbox.life.film.reconcileCast(); assert.equal(h.sandbox.state.profiles.kid.xp, xp);
  h.command('next', 481); assert.equal(h.state.scene, 'm3_gate');
  assert.deepEqual(h.kid.position, kid, 'Kid must stay beside Mifune when the gate mission starts');
  assert.deepEqual(h.mifune.position, body, 'the dead captain must remain in the dock rather than return to an initial spawn');
  assert.equal(h.mifune.status, 'dead');
});

test('attack and final dialogue resume their saved poses without advancing during pause or disconnect', () => {
  const h = afterReload(); h.command('act', 90); frames(h, 3.4);
  const saved = structuredClone(h.sandbox.state), body = structuredClone(h.mifune), kid = structuredClone(h.kid.position);
  h.players.step(.1, false, 150);
  assert.deepEqual(h.state.dockLastStand, saved.neoLife!.journey!.dockLastStand);
  h.players.release('p', 151); h.sandbox.tick(180); frames(h, 3);
  assert.deepEqual(h.state.dockLastStand, saved.neoLife!.journey!.dockLastStand);
  h.sandbox.restore(saved); h.players.possess('p', 'kid', 181);
  assert.deepEqual(h.kid.position, kid); assert.deepEqual(h.mifune.position, body.position);
  assert.deepEqual(h.mifune.currentAction?.parameters.dockLastStand, body.currentAction?.parameters.dockLastStand);
  frames(h, 2); const state = h.sandbox.life.film.state!;
  assert.equal(state.dockLastStand?.phase, 'wounded');
  h.kid.position = filmPosition(h.scene.set, DOCK_LAST_STAND.kid.x, DOCK_LAST_STAND.kid.z);
  h.command('act', 190); frames(h, 6.8); assert.equal(state.dockLastStand?.phase, 'response');
  const question = structuredClone(h.sandbox.state); h.sandbox.restore(question); h.command('retry', 200);
  assert.deepEqual(h.sandbox.state.neoLife, question.neoLife, 'retry at a preserved conversation must not reset orders or grant rewards');
  assert.match(h.players.possess('other', 'mifune', 201).error ?? '', /不能接管/);
});

test('Kid walks around the APU body to the rear loader instead of through its armour', () => {
  const h = game(); h.command('act'); h.kid.position = filmPosition(h.scene.set, -5, 12.4);
  for (let frame = 0; frame < 50; frame++) {
    h.players.receiveInput('p', { x: 1, z: 0, yaw: Math.PI / 2, jump: false, sprint: false, sequence: ++h.sequence });
    h.players.step(.05, true, 100 + frame);
  }
  assert.ok(h.kid.position.x < filmPosition(h.scene.set, -3.4, 0).x, 'normal walking must stop outside the APU armour');
  for (const [x, z] of [[-5, 17], [DOCK_RELOAD.entry.x, DOCK_RELOAD.entry.z]]) {
    const target = filmPosition(h.scene.set, x, z);
    for (let frame = 0; frame < 160; frame++) {
      const dx = target.x - h.kid.position.x, dz = target.z - h.kid.position.z, gap = Math.hypot(dx, dz);
      if (gap < .4) break;
      h.players.receiveInput('p', { x: dx / gap, z: dz / gap, yaw: Math.atan2(dx, dz), jump: false, sprint: false, sequence: ++h.sequence });
      h.players.step(.05, true, 200 + frame);
    }
    assert.ok(Math.hypot(target.x - h.kid.position.x, target.z - h.kid.position.z) < .4, 'the rear approach must remain walkable');
  }
  h.command('act', 400); assert.equal(h.state.dockReload?.phase, 'hoisting');
});

test('kick pose, load travel and the life save survive restore; disconnected input does not advance loading', () => {
  const h = game(); jammed(h); frames(h, .7, { focus: true }); h.players.act('p', 'attack', 71); frames(h, .45);
  const saved = structuredClone(h.sandbox.state), body = structuredClone(h.kid.position), pose = structuredClone(h.kid.currentAction?.parameters.dockReload);
  h.players.release('p', 80); frames(h, 2); h.sandbox.tick(81);
  assert.deepEqual(h.state.dockReload, saved.neoLife!.journey!.dockReload);
  h.sandbox.restore(saved); const restored = h.sandbox.life.film.state!;
  assert.deepEqual(restored.dockReload, saved.neoLife!.journey!.dockReload);
  assert.deepEqual(h.sandbox.state.neoLife, saved.neoLife);
  h.players.possess('p', 'kid', 82);
  assert.deepEqual(h.kid.position, body); assert.deepEqual(h.kid.currentAction?.parameters.dockReload, pose);
  h.players.step(.1, false, 83); assert.deepEqual(restored.dockReload, saved.neoLife!.journey!.dockReload);
  frames(h, .8); assert.equal(restored.dockReload?.phase, 'descending');
});

test('legacy active reload timers are cleared, while already completed docks are not replayed', () => {
  const h = game(); h.state.started = 1; h.sandbox.tick(20);
  assert.equal(h.state.started, undefined); assert.equal(h.state.step, 1);
  h.state.completed.push('m3_dock_battle'); h.state.step = 2;
  h.command('next', 21); assert.equal(h.state.scene, 'm3_gate');
});
