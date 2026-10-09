import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from 'three';
import { FILM_SCENE_BY_ID, FILM_SETS, TRAINMAN_CHASE, filmEntry, filmGroundHeight, newTrainmanChase, type FilmJourney, type SandboxState } from '@auto_matrix/shared';
import { FilmSetRenderer } from '../packages/client/src/engine/FilmSetRenderer.js';
import { WorldState } from '../packages/server/src/world/WorldState.js';
import { AgentManager } from '../packages/server/src/agents/AgentManager.js';

test('the chase has an enterable carriage, brake handle, two connected stairways and physical ticket gates', t => {
  t.mock.method(THREE.TextureLoader.prototype, 'load', () => new THREE.Texture());
  const previous = globalThis.document;
  globalThis.document = { createElement: () => ({ width: 0, height: 0, getContext: () => ({ fillRect() {}, strokeRect() {}, fillText() {} }) }) } as unknown as Document;
  const world = new WorldState(); new AgentManager(world).initializeAllAgents(); const player = world.agents.get('seraph')!;
  const journey: FilmJourney = { version: 1, scene: 'm3_trainman_chase', actor: 'seraph', step: 0, completed: [], enteredAt: 0, reflections: {}, lastText: '',
    checkpoint: filmEntry(FILM_SCENE_BY_ID.m3_trainman_chase), helChase: { phase: 'sighting', elapsed: 0, lastTick: 0, performance: newTrainmanChase() } };
  const sandbox = { neoLife: { journey }, structures: [] } as unknown as SandboxState;
  const scene = new THREE.Scene(); scene.background = new THREE.Color(); scene.fog = new THREE.FogExp2(0, .01);
  const renderer = new FilmSetRenderer(scene);
  try {
    player.position = { ...journey.checkpoint }; player.currentLocation = TRAINMAN_CHASE.set; player.isInMatrix = true; renderer.update(player, sandbox, 0);
    for (const name of ['trainman-carriage', 'trainman-emergency-handle', 'trainman-stairs-1', 'trainman-stairs-2', 'trainman-ticket-gates', 'trainman-platform-2'])
      assert.ok(renderer.root.getObjectByName(name), name);
    const door = renderer.root.getObjectByName('trainman-car-door-0')!, handle = renderer.root.getObjectByName('trainman-emergency-handle')!;
    const closed = door.position.z, untouched = handle.rotation.x;
    const state = journey.helChase!.performance!; state.phase = 'braking'; state.elapsed = 1.5; renderer.update(player, sandbox, 80);
    assert.notEqual(handle.rotation.x, untouched); assert.equal(door.position.z, closed, 'door must remain closed until braking finishes');
    state.elapsed = 3.2; renderer.update(player, sandbox, 300); assert.ok(Math.abs(door.position.z - closed) > 1.7);
    const frozen = door.position.clone(); renderer.update(player, sandbox, 900); assert.deepEqual(door.position, frozen, 'a stopped player clock cannot move the doors');
    renderer.root.updateWorldMatrix(true, true);
    const center = FILM_SETS[TRAINMAN_CHASE.set].center;
    for (const z of [18, 23, 29, 35, 41, 45]) {
      const from = new THREE.Vector3(center.x - 32.3, center.y - 1 + 3.65, center.z + z);
      const hits = new THREE.Raycaster(from, new THREE.Vector3(1, 0, 0), 0, 1.2).intersectObject(renderer.root.getObjectByName('trainman-carriage')!, true);
      assert.ok(hits.some(hit => Math.abs(hit.point.x - center.x + 31.3) < .07), `the braking grip needs a physical rail at ${z}`);
    }
    for (const x of [-17, 17]) for (const z of [-3, -5.2, -9.2, -15.7, -20]) {
      const probe = new THREE.Vector3(center.x + x, center.y + 20, center.z + z);
      const hits = new THREE.Raycaster(probe, new THREE.Vector3(0, -1, 0)).intersectObject(renderer.root, true).filter(hit => hit.object.userData.trainmanSupport);
      assert.ok(hits[0], `support ${x}/${z}`);
      assert.ok(Math.abs(hits[0].point.y - (filmGroundHeight({ x: probe.x, y: probe.y, z: probe.z }, FILM_SETS[TRAINMAN_CHASE.set]) - 1)) < .015, `visible stair and player support ${x}/${z}`);
    }
    for (const [z, y] of [[-23, center.y], [TRAINMAN_CHASE.cover.z, center.y], [-23, center.y + TRAINMAN_CHASE.upper]]) {
      const probe = new THREE.Vector3(center.x + TRAINMAN_CHASE.cover.x, y + 3, center.z + z);
      const hits = new THREE.Raycaster(probe, new THREE.Vector3(0, -1, 0)).intersectObject(renderer.root, true).filter(hit => hit.object.userData.trainmanSupport);
      assert.ok(hits[0]); assert.ok(Math.abs(hits[0].point.y - (filmGroundHeight({ x: probe.x, y, z: probe.z }, FILM_SETS[TRAINMAN_CHASE.set]) - 1)) < .015, 'upper and lower support both match the visible decks');
    }
    const escaped = new THREE.Vector3(center.x + 38, center.y + 2, center.z + TRAINMAN_CHASE.escape.runZ);
    const from = new THREE.Vector3(center.x + TRAINMAN_CHASE.exit.x, center.y + 2, center.z + TRAINMAN_CHASE.exit.z), direction = escaped.clone().sub(from);
    const sight = new THREE.Raycaster(from, direction.clone().normalize(), 0, direction.length()).intersectObject(renderer.root, true);
    assert.ok(sight.length, 'physical tunnel walls must conceal the escaped Trainman from the waiting pursuers');
    const support = new THREE.Raycaster(escaped, new THREE.Vector3(0, -1, 0)).intersectObject(renderer.root, true).filter(hit => hit.object.userData.trainmanSupport);
    assert.ok(support[0] && Math.abs(support[0].point.y - center.y + 1) < .015, 'the escape tunnel needs a visible supporting floor');
  } finally { renderer.dispose(); globalThis.document = previous; }
});
