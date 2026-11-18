import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from 'three';
import { filmPosition, type FilmJourney, type SandboxState, type SandboxThreat } from '@auto_matrix/shared';
import { AgentRenderer } from '../packages/client/src/agents/AgentRenderer.js';
import { CharacterModels, type CharacterRig } from '../packages/client/src/agents/CharacterModel.js';
import { newMotion } from '../packages/client/src/agents/CharacterMotion.js';
import { SandboxRenderer } from '../packages/client/src/engine/SandboxRenderer.js';
import { AgentManager } from '../packages/server/src/agents/AgentManager.js';
import { WorldState } from '../packages/server/src/world/WorldState.js';

function setup(t: test.TestContext, withActor = true) {
  const previous = globalThis.document;
  globalThis.document = { createElement: () => ({ getContext: () => ({ fillRect() {}, strokeRect() {}, fillText() {},
    createImageData: (w: number, h: number) => ({ data: new Uint8ClampedArray(w * h * 4) }), putImageData() {},
    createRadialGradient: () => ({ addColorStop() {} }) }) }) } as unknown as Document;
  t.mock.method(THREE.TextureLoader.prototype, 'load', () => new THREE.Texture());
  const rigs: CharacterRig[] = [];
  t.mock.method(CharacterModels.prototype, 'create', () => {
    const rig = { root: new THREE.Group(), head: new THREE.Group(), motion: newMotion(), hero: { root: new THREE.Group(), bones: new Map() } } as CharacterRig;
    rigs.push(rig); return rig;
  });
  const animate = t.mock.method(CharacterModels.prototype, 'animate', () => {});
  const scene = new THREE.Scene(), actors = new AgentRenderer(scene), sandbox = new SandboxRenderer(scene, actors);
  t.after(() => { sandbox.dispose(); actors.dispose(); globalThis.document = previous; });
  const world = new WorldState(); new AgentManager(world).initializeAllAgents();
  const smith = world.agents.get('smith')!, neo = world.agents.get('neo')!;
  smith.currentLocation = 'film_heart_hotel'; smith.isInMatrix = true; smith.position = filmPosition('film_heart_hotel', 0, -20.7);
  smith.currentAction = { type: 'idle', parameters: { filmDuel: true }, startedAt: 0, duration: 100000, progress: 0 };
  if (withActor) actors.updateAgent('smith', smith);
  const threat: SandboxThreat = { id: 'one-smith', scene: 'm1_return', kind: 'smith', character: 'smith', position: { ...smith.position },
    matrix: true, health: 999, maxHealth: 999, target: 'neo', stunUntil: 0, lastStrike: 0 };
  const sync = (threats: SandboxThreat[]) => sandbox.sync({ threats, nodes: [], structures: [], incidents: [], missions: {} } as SandboxState, { smith, neo });
  return { scene, actors, sandbox, rigs, animate, smith, threat, sync };
}

test('the One counter uses Smith’s loaded body and returns its transforms and motion for the burst', t => {
  const h = setup(t), rig = h.rigs[0], root = h.actors.getAgentBody('smith')!, host = root.parent, motion = rig.motion;
  root.position.set(.1, -1, .2); root.rotation.set(.03, .4, 0);
  const position = root.position.toArray(), rotation = root.quaternion.toArray(), state = structuredClone(h.smith);
  h.sync([h.threat]);
  assert.equal(h.rigs.length, 1, 'counter combat cannot rebuild the detailed body, hands, glasses and textures');
  assert.ok(root.parent !== host && root.parent?.parent === h.scene, 'the existing body moves into the actual combat shell');
  h.actors.update(0);
  assert.equal(h.animate.mock.callCount(), 0, 'the hidden story actor must not animate the borrowed skeleton');
  h.sandbox.update(.1, new THREE.PerspectiveCamera(), true, 1, true);
  assert.equal(h.animate.mock.callCount(), 1, 'the active combat system is the sole animator');
  assert.ok(h.animate.mock.calls[0].this === (h.actors as unknown as { models: CharacterModels }).models,
    'the borrowed body must keep its owning animator and prepared hand, face and clothing caches');
  assert.deepEqual(h.smith, state, 'borrowing a render body cannot change the story actor');
  h.sync([]);
  assert.ok(root.parent === host && rig.motion === motion);
  assert.deepEqual(root.position.toArray(), position); assert.deepEqual(root.quaternion.toArray(), rotation);
  h.sync([h.threat]); assert.equal(h.rigs.length, 1, 'a retry borrows the same body from the bounded shell pool');
  h.sync([]); assert.ok(root.parent === host);
});

test('a possessed Smith regains his body while the old counter keeps a separate fallback', t => {
  const h = setup(t), root = h.actors.getAgentBody('smith')!, host = root.parent;
  h.sync([h.threat]); h.smith.controller = 'another-player'; h.actors.updateAgent('smith', h.smith);
  h.sandbox.update(0, new THREE.PerspectiveCamera(), true, 0, false);
  assert.ok(root.parent === host, 'the owner regains the original skeleton');
  assert.equal(h.rigs.length, 2, 'the opponent uses a fallback rather than stealing the controlled body');
});

test('leaving the hotel returns the borrowed Smith and disposing combat cannot remove his story body', t => {
  const h = setup(t), root = h.actors.getAgentBody('smith')!, host = root.parent;
  h.sync([h.threat]);
  assert.ok(root.parent !== host, 'start with a real borrowed body');
  h.smith.currentAction = null; h.actors.updateAgent('smith', h.smith); h.sync([]);
  assert.ok(root.parent === host);
  h.smith.currentAction = { type: 'idle', parameters: { filmDuel: true }, startedAt: 2, duration: 100000, progress: 0 };
  h.actors.updateAgent('smith', h.smith); h.sync([h.threat]); h.sandbox.dispose();
  assert.ok(root.parent === host && host?.parent !== null, 'the borrowed original survives renderer disposal');
});

test('a missing or actively controlled story Smith still has a functional independent opponent', t => {
  const missing = setup(t, false); missing.sync([missing.threat]);
  assert.equal(missing.rigs.length, 1);
  missing.sandbox.update(0, new THREE.PerspectiveCamera(), true, 0, false);
  assert.equal(missing.animate.mock.callCount(), 1);
});

test('a cold counter borrows the existing skeleton container while its detailed model is still loading', t => {
  const h = setup(t), rig = h.rigs[0], hero = rig.hero, root = rig.root, host = root.parent;
  rig.hero = undefined;
  h.sync([h.threat]);
  assert.equal(h.rigs.length, 1, 'cold restore must not start a second detailed model while the first is loading');
  assert.ok(root.parent !== host);
  rig.hero = hero;
  h.sandbox.update(0, new THREE.PerspectiveCamera(), true, 0, false);
  h.sync([]); assert.ok(root.parent === host && rig.hero === hero);
});

test('the saved code impact removes Smith from 303 through the exit retry', t => {
  const h = setup(t), body = h.actors.getAgent('smith')!;
  const journey: FilmJourney = {
    version: 1, scene: 'm1_return', actor: 'neo', step: 1, enteredAt: 0, completed: ['m1_death'],
    checkpoint: { ...h.smith.position }, reflections: {}, lastText: '',
    theOne: { kind: 'return', phase: 'burst', elapsed: .8, attempt: 1, checkpoint: 'bullets',
      signal: 0, hits: 3, blocks: 1, deadline: 0, altitude: 0, flightX: 0, flightZ: 0, resolved: [] },
  };
  h.smith.currentAction = null;
  h.actors.updateAgent('smith', h.smith, journey);
  h.actors.update(0, undefined, 0, 0, journey);
  assert.equal(body.visible, true, 'Smith is still intact on the lead-in');

  const impact = journey.theOne!;
  impact.elapsed = 1.2; impact.smithBurst = true;
  const before = structuredClone(h.smith);
  h.actors.update(0, undefined, 0, 0, journey);
  assert.equal(body.visible, false);
  impact.phase = 'exit_run'; impact.checkpoint = 'exit'; impact.attempt++;
  h.actors.updateAgent('smith', h.smith, journey);
  assert.equal(body.visible, false, 'a newly synced exit retry still has no intact Smith');
  h.actors.update(0, undefined, 0, 0, journey);
  assert.equal(body.visible, false);
  assert.deepEqual(h.smith, before);

  journey.step = 2; delete impact.smithBurst;
  h.actors.update(0, undefined, 0, 0, journey);
  assert.equal(body.visible, false, 'the saved exit step also identifies a completed fight in older saves');

  h.smith.controller = 'another-player';
  h.actors.updateAgent('smith', h.smith, journey);
  h.actors.update(0, undefined, 0, 0, journey);
  assert.equal(body.visible, true, 'the cut cannot hide another player');
  h.smith.controller = undefined;
  h.actors.updateAgent('smith', h.smith);
  h.actors.update(0);
  assert.equal(body.visible, true, 'the same actor can appear in later scenes');
});
