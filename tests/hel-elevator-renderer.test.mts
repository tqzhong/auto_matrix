import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from 'three';
import { FILM_SCENE_BY_ID, FILM_SETS, HEL_ELEVATOR, helElevatorFloor, filmEntry, type FilmJourney, type SandboxState } from '@auto_matrix/shared';
import { FilmSetRenderer } from '../packages/client/src/engine/FilmSetRenderer.js';
import { WorldState } from '../packages/server/src/world/WorldState.js';
import { AgentManager } from '../packages/server/src/agents/AgentManager.js';

test('the real cage floor, roof, gate and button ride together past a stationary shaft', t => {
  t.mock.method(THREE.TextureLoader.prototype, 'load', () => new THREE.Texture());
  const previous = globalThis.document;
  globalThis.document = { createElement: () => ({ getContext: () => ({ fillRect() {}, strokeRect() {}, fillText() {},
    createImageData: (w: number, h: number) => ({ data: new Uint8ClampedArray(w * h * 4) }), putImageData() {} }) }) } as unknown as Document;
  const world = new WorldState(); new AgentManager(world).initializeAllAgents();
  const actor = world.agents.get('trinity')!, center = FILM_SETS.film_club_hel.center;
  actor.position = filmEntry(FILM_SCENE_BY_ID.m3_hel_entry); actor.currentLocation = 'film_club_hel'; actor.isInMatrix = true;
  const journey: FilmJourney = { version: 1, scene: 'm3_hel_entry', actor: 'trinity', step: 0, completed: [], enteredAt: 0,
    checkpoint: { ...actor.position }, reflections: {}, lastText: '', helElevator: { phase: 'ready', elapsed: 0, lastTick: 0, physical: true } };
  const sandbox = { neoLife: { journey }, structures: [] } as unknown as SandboxState;
  const scene = new THREE.Scene(); scene.background = new THREE.Color(); scene.fog = new THREE.FogExp2(0, .01);
  const renderer = new FilmSetRenderer(scene);
  t.after(() => { renderer.dispose(); globalThis.document = previous; });
  renderer.update(actor, sandbox, 0); renderer.root.updateMatrixWorld(true);
  const floor = renderer.root.getObjectByName('hel-elevator-floor'); assert.ok(floor, 'a scrolling lamp cannot replace a moving platform');
  const cage = renderer.root.getObjectByName('hel-elevator-cage'); assert.ok(cage);
  const roof = renderer.root.getObjectByName('hel-elevator-roof'); assert.ok(roof);
  const button = renderer.root.getObjectByName('hel-elevator-button')!, gate = renderer.root.getObjectByName('hel-elevator-left-door')!;
  for (const part of [floor, roof, button, gate]) assert.ok(part.parent === cage || part.parent?.parent === cage);
  const lamp = renderer.root.getObjectByName('hel-shaft-band')!, lampY = lamp.getWorldPosition(new THREE.Vector3()).y;
  const upperY = floor.getWorldPosition(new THREE.Vector3()).y;
  const buttonRelativeY = button.getWorldPosition(new THREE.Vector3()).y - upperY;
  journey.helElevator!.phase = 'descending'; journey.helElevator!.elapsed = 3.8;
  actor.position.y = center.y + helElevatorFloor(journey.helElevator);
  renderer.update(actor, sandbox, 30); renderer.root.updateMatrixWorld(true);
  assert.ok(floor.getWorldPosition(new THREE.Vector3()).y < upperY - 2);
  assert.ok(Math.abs(button.getWorldPosition(new THREE.Vector3()).y - floor.getWorldPosition(new THREE.Vector3()).y - buttonRelativeY) < 1e-6);
  assert.equal(lamp.getWorldPosition(new THREE.Vector3()).y, lampY, 'the shaft itself must not scroll around a stationary cage');
  const halfway = floor.getWorldPosition(new THREE.Vector3()).clone();
  renderer.update(actor, sandbox, 300); renderer.root.updateMatrixWorld(true);
  assert.deepEqual(floor.getWorldPosition(new THREE.Vector3()).toArray(), halfway.toArray(), 'paused or cold presentation is driven by saved progress');
  journey.helElevator!.phase = 'arrived'; journey.helElevator!.elapsed = HEL_ELEVATOR.seconds;
  renderer.update(actor, sandbox, 301); renderer.root.updateMatrixWorld(true);
  assert.equal(cage.position.y, 0); assert.equal(gate.position.x, -HEL_ELEVATOR.doorWidth / 4, 'arrival alone does not slide the gate');
  journey.helElevator!.phase = 'opening'; journey.helElevator!.gateElapsed = HEL_ELEVATOR.opening;
  renderer.update(actor, sandbox, 302); renderer.root.updateMatrixWorld(true);
  assert.ok(gate.position.x < -8, 'the player-pulled lattice gate clears the exit');
});
