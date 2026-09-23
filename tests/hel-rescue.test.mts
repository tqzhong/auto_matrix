import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from 'three';
import { FILM_SCENE_BY_ID, FILM_SETS, filmEntry, filmStepPosition, filmPosition, filmGroundHeight, playerBlocked, type FilmJourney, type SandboxState } from '@auto_matrix/shared';
import { FilmSetRenderer } from '../packages/client/src/engine/FilmSetRenderer.js';
import { WorldState } from '../packages/server/src/world/WorldState.js';
import { AgentManager } from '../packages/server/src/agents/AgentManager.js';

test('Hel rescue has a saved chase train and separate garage, elevator, coat check and VIP spaces', t => {
  t.mock.method(THREE.TextureLoader.prototype, 'load', () => new THREE.Texture());
  const document = globalThis.document;
  globalThis.document = { createElement: () => ({ width: 0, height: 0, getContext: () => ({ fillRect() {}, strokeRect() {}, fillText() {} }) }) } as unknown as Document;
  const world = new WorldState(); new AgentManager(world).initializeAllAgents();
  let player = world.agents.get('seraph')!;
  const journey: FilmJourney = { version: 1, scene: 'm3_trainman_chase', actor: 'seraph', step: 1, completed: [],
    enteredAt: 0, reflections: {}, lastText: '', checkpoint: filmEntry(FILM_SCENE_BY_ID.m3_trainman_chase),
    helChase: { phase: 'sighting', elapsed: 0, lastTick: 0 } };
  const sandbox = { neoLife: { journey }, structures: [] } as unknown as SandboxState;
  const scene = new THREE.Scene(); scene.background = new THREE.Color(); scene.fog = new THREE.FogExp2(0, .01);
  const renderer = new FilmSetRenderer(scene);
  try {
    player.position = filmEntry(FILM_SCENE_BY_ID.m3_trainman_chase); player.currentLocation = 'film_subway_platform'; player.isInMatrix = true;
    renderer.update(player, sandbox, 0);
    const train = renderer.root.getObjectByName('hel-chase-train') as THREE.Group;
    assert.ok(train); assert.equal(train.visible, false);
    journey.helChase!.phase = 'running'; journey.helChase!.elapsed = 4;
    renderer.update(player, sandbox, 4); assert.equal(train.visible, true); assert.ok(train.position.z < 60);
    journey.helChase!.phase = 'escaped'; renderer.update(player, sandbox, 7); assert.equal(train.visible, false);

    journey.scene = 'm3_hel_garage'; journey.actor = 'trinity'; player = world.agents.get('trinity')!;
    player.position = filmEntry(FILM_SCENE_BY_ID.m3_hel_garage); player.currentLocation = 'film_hel_garage'; player.isInMatrix = true;
    renderer.update(player, sandbox, 8);
    assert.ok(renderer.root.getObjectByName('hel-garage-steel-door'));
    assert.equal(renderer.root.children.filter(object => object.name === 'hel-parked-car').length, 6);
    journey.scene = 'm3_hel_entry'; journey.step = 0; player.position = filmEntry(FILM_SCENE_BY_ID.m3_hel_entry);
    renderer.update(player, sandbox, 9);
    assert.ok(renderer.root.getObjectByName('hel-elevator-sign'));
    assert.ok(renderer.root.getObjectByName('hel-elevator-button'));
    const door = renderer.root.getObjectByName('hel-elevator-left-door') as THREE.Group;
    const shaftBand = renderer.root.getObjectByName('hel-shaft-band') as THREE.Mesh;
    assert.ok(door); assert.ok(shaftBand);
    shaftBand.geometry.computeBoundingBox();
    assert.ok(shaftBand.geometry.boundingBox!.max.z - shaftBand.geometry.boundingBox!.min.z < 1, 'shaft lamps stay short inside the narrow cage');
    const marker = scene.children.find(object => object instanceof THREE.Mesh && object.geometry instanceof THREE.TorusGeometry)!;
    assert.equal(marker.visible, true);
    const shut = door.position.x; const bandY = shaftBand.position.y;
    journey.helElevator = { phase: 'descending', elapsed: 1.5, lastTick: 0 };
    renderer.update(player, sandbox, 10);
    assert.equal(door.position.x, shut, 'the lift remains sealed during travel');
    assert.equal(marker.visible, false, 'the button waypoint disappears during the ride');
    assert.notEqual(shaftBand.position.y, bandY, 'shaft lights pass the cage during travel');
    journey.helElevator.phase = 'open'; journey.step = 1;
    renderer.update(player, sandbox, 11);
    assert.ok(door.position.x < shut - 4, 'both the animation and the server barrier open at the first combat step');
    assert.equal(renderer.root.children.filter(object => object.name === 'hel-coatcheck-counter').length, 2);
    assert.ok(renderer.root.getObjectByName('hel-vip-table'));
    assert.equal(filmGroundHeight(filmPosition('film_club_hel', 0, -33), FILM_SETS.film_club_hel), FILM_SETS.film_club_hel.center.y + .6);
    for (const id of ['m3_hel_garage', 'm3_hel_entry', 'm3_hel_bargain']) for (const step of FILM_SCENE_BY_ID[id].steps)
      assert.equal(playerBlocked(filmStepPosition(FILM_SCENE_BY_ID[id], step), true), false, `${id}: ${step.label}`);
  } finally { renderer.dispose(); globalThis.document = document; }
});
