import assert from 'node:assert/strict';
import test from 'node:test';
import { DIGGERS, diggerEye, diggerShield, filmPosition, FILM_SCENE_BY_ID, playerBlocked, type WorldEvent } from '@auto_matrix/shared';
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
  const state = sandbox.life.film.state!, previous = FILM_SCENE_BY_ID.m3_hammer_tunnels;
  Object.assign(state, { scene: previous.id, actor: 'niobe', step: previous.steps.length, completed: [previous.id] });
  players.possess('p', 'niobe', 2);
  let tick = 3, sequence = 0;
  const command = (target: string) => players.sandboxAction('p', { kind: 'life', target: `film:${target}` }, ++tick);
  command('next');
  const frame = (seconds: number, input: { focus?: boolean; x?: number; z?: number; yaw?: number; pitch?: number } = {}, running = true) => {
    for (let i = 0; i < Math.ceil(seconds / .05); i++) {
      const drill = sandbox.life.film.state!.diggers!;
      players.receiveInput('p', { x: 0, z: 0, yaw: drill?.yaw ?? 0, pitch: drill?.pitch ?? 0, jump: false, sprint: false, focus: false, ...input, sequence: ++sequence });
      players.step(.05, running, ++tick);
    }
  };
  const walk = (x: number, z: number) => {
    const target = filmPosition('film_zion_hangar', x, z);
    for (let i = 0; i < 900; i++) {
      const p = players.getAgent('p')!.position, dx = target.x - p.x, dz = target.z - p.z, gap = Math.hypot(dx, dz);
      if (gap < .3) return;
      frame(.05, { x: dx / gap, z: dz / gap, yaw: Math.atan2(dx, dz) });
    }
    assert.fail(`unreachable firing aperture ${x}, ${z}`);
  };
  return { world, sandbox, players, command, frame, walk, tick: () => tick, state: () => sandbox.life.film.state!, actor: () => players.getAgent('p')! };
}
function fireJoint(h: ReturnType<typeof game>) {
  const state = h.state().diggers!;
  h.frame(3, { focus: true }); assert.equal(state.phase, 'aiming');
  for (let i = 0; i < 200 && Math.abs(diggerShield(state).offset) < 5; i++) h.frame(.05);
  const eye = diggerEye(state), target = DIGGERS.knees[state.station], dx = target.x - eye.x, dz = target.z - eye.z;
  h.frame(.05, { yaw: Math.atan2(dx, dz), pitch: -Math.atan2(target.y - eye.y, Math.hypot(dx, dz)) });
  h.players.act('p', 'shoot', h.tick()); h.frame(2);
}
test('normal chapter handoff, walking between apertures and real shots collapse the drill before the upper-level Zee handoff', () => {
  const h = game(); assert.equal(h.state().scene, 'm3_diggers'); assert.equal(h.actor().id, 'charra');
  h.command('act'); assert.equal(h.state().diggers?.phase, 'approach', 'G at the entrance cannot teleport the player');
  h.walk(-40, 27);
  assert.equal((h.actor().currentAction?.parameters.diggers as { phase?: string })?.phase, 'approach', 'walking must keep the carried launcher and the raised-floor pose');
  h.command('act'); fireJoint(h);
  assert.equal(h.state().diggers?.phase, 'relocate'); assert.equal(h.state().step, 0);
  h.command('act'); assert.equal(h.state().diggers?.station, 0, 'second shot requires real relocation');
  h.walk(-42, 27); h.walk(-42, -16); h.walk(-40, -16); h.command('act');
  assert.equal(h.state().diggers?.station, 1); fireJoint(h); assert.equal(h.state().diggers?.phase, 'collapsing');
  h.frame(6); assert.equal(h.state().step, 1); assert.ok(h.state().completed.includes('m3_diggers'));
  assert.equal(h.world.agents.get('charra')!.status, 'alive', 'the first drill cannot consume Charra’s later death');
  h.frame(.4, { x: -1, yaw: -Math.PI / 2 }); const completedPosition = { ...h.actor().position };
  assert.equal((h.actor().currentAction?.parameters.diggers as { phase?: string })?.phase, 'done', 'completion keeps the carried weapon while the player can walk');
  const zee = h.world.agents.get('zee')!;
  assert.ok(Math.hypot(zee.position.x - h.actor().position.x, zee.position.z - h.actor().position.z) > 1.4, 'Zee must leave space for the player after firing');
  h.sandbox.tick(h.tick() + 1); assert.deepEqual(h.actor().position, completedPosition, 'a completed checkpoint cannot drag the player back to the aperture');
  h.sandbox.restore(structuredClone(h.sandbox.state));
  assert.deepEqual(h.actor().position, completedPosition, 'restoring a completed scene keeps the player’s chosen position');
  h.players.release('p', h.tick()); h.players.possess('p', 'charra', h.tick());
  assert.deepEqual(h.actor().position, completedPosition, 'reconnecting cannot drag the player back either');
  assert.equal((h.actor().currentAction?.parameters.diggers as { phase?: string })?.phase, 'done', 'a paused reconnect must restore the carried launcher before the next running frame');
  h.command('next'); assert.equal(h.state().scene, 'm3_upper_digger'); assert.equal(h.actor().id, 'zee');
  assert.equal(h.state().upperDigger?.phase, 'approach');
  assert.equal(h.sandbox.state.structures.some(s => s.id.startsWith('film:diggers:')), false);
  assert.ok(playerBlocked(filmPosition('film_zion_hangar', 28, -15), false, 1, h.sandbox.state.structures), 'the saved drill wreck remains solid after handoff');
});
test('pause, disconnect and restoring a loaded shot preserve phase, timing and companion contacts', () => {
  const h = game(); h.walk(-40, 27); h.command('act'); h.frame(1, { focus: true });
  const state = structuredClone(h.state().diggers), charra = structuredClone(h.actor().position), zee = structuredClone(h.world.agents.get('zee')!.position);
  h.frame(5, { focus: true }, false); assert.deepEqual(h.state().diggers, state);
  const saved = structuredClone(h.sandbox.state); h.players.release('p', h.tick());
  h.sandbox.restore(saved); for (let i = 0; i < 20; i++) h.sandbox.tick(h.tick() + i);
  assert.deepEqual(h.state().diggers, state);
  h.players.possess('p', 'charra', h.tick() + 21);
  assert.deepEqual(h.actor().position, charra); assert.deepEqual(h.world.agents.get('zee')!.position, zee);
  h.frame(2, { focus: true }); assert.equal(h.state().diggers?.phase, 'aiming');
});
test('timeout at the second aperture retries without resurrecting the destroyed first leg', () => {
  const h = game(); h.walk(-40, 27); h.command('act'); fireJoint(h);
  h.walk(-42, 27); h.walk(-42, -16); h.walk(-40, -16); h.command('act'); h.frame(91);
  assert.equal(h.state().diggers?.phase, 'failed'); h.command('retry');
  assert.equal(h.state().diggers?.station, 1); assert.equal(h.state().diggers?.damage, 1); assert.equal(h.state().step, 0);
  h.command('act'); fireJoint(h); h.frame(6); assert.ok(h.state().completed.includes('m3_diggers'));
});
test('another player occupying Zee freezes the task without moving that player', () => {
  const h = game(); h.walk(-40, 27); h.command('act'); h.frame(.5, { focus: true });
  h.players.possess('other', 'zee', h.tick()); const zee = structuredClone(h.world.agents.get('zee'));
  const saved = structuredClone(h.state().diggers); h.frame(5, { focus: true });
  assert.deepEqual(h.state().diggers, saved);
  const current = h.world.agents.get('zee')!;
  for (const field of ['position', 'rotation', 'health', 'controller', 'currentLocation'] as const) assert.deepEqual(current[field], zee![field]);
  assert.match(h.command('retry'), /玩家/); h.players.release('other', h.tick()); h.frame(3, { focus: true });
  assert.equal(h.state().diggers?.phase, 'aiming');
});

test('the expanded drill bay has no old cargo or invisible perimeter and still blocks its visible walls', () => {
  const h = game(), blocked = (x: number, z: number) => playerBlocked(filmPosition('film_zion_hangar', x, z), false, .7, h.sandbox.state.structures);
  assert.equal(blocked(18, -15), false, 'the removed east cargo cannot leave an invisible obstacle');
  assert.equal(blocked(70, 40), false, 'the old bay edge cannot block the expanded floor');
  assert.equal(blocked(104, 40), false, 'the player can approach the new perimeter');
  assert.equal(blocked(113, 40), true, 'the visible east wall remains solid');
  assert.equal(blocked(-24, -30), true, 'the west cargo still exists');
  assert.equal(blocked(60, -15), true, 'the machine itself remains solid');
});
