import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from 'three';
import { FILM_SCENE_BY_ID, FILM_SETS, OPENING_ESCAPE, filmEntry, type FilmJourney, type SandboxState } from '@auto_matrix/shared';
import { FilmSetRenderer } from '../packages/client/src/engine/FilmSetRenderer.js';
import { WorldState } from '../packages/server/src/world/WorldState.js';
import { AgentManager } from '../packages/server/src/agents/AgentManager.js';

test('the opening roof has a raycastable drop and the phone truck follows saved time into a visible impact', t => {
  t.mock.method(THREE.TextureLoader.prototype, 'load', () => new THREE.Texture());
  const document = globalThis.document;
  globalThis.document = { createElement: () => ({ width: 0, height: 0, getContext: () => ({ fillRect() {}, strokeRect() {}, fillText() {} }) }) } as unknown as Document;
  const world = new WorldState(); new AgentManager(world).initializeAllAgents();
  const player = world.agents.get('trinity')!;
  const roof = FILM_SCENE_BY_ID.m1_roofs; const phone = FILM_SCENE_BY_ID.m1_phone_escape;
  const journey: FilmJourney = { version: 1, scene: roof.id, actor: player.id, step: 1, completed: [], enteredAt: 0,
    reflections: {}, lastText: '', checkpoint: filmEntry(roof), openingRoof: { phase: 'running', lastTick: 0, attempts: 0 } };
  const sandbox = { neoLife: { journey }, structures: [] } as unknown as SandboxState;
  const scene = new THREE.Scene(); scene.background = new THREE.Color(); scene.fog = new THREE.FogExp2(0, .01);
  const renderer = new FilmSetRenderer(scene);
  try {
    player.position = filmEntry(roof); player.currentLocation = roof.set; player.isInMatrix = true;
    renderer.update(player, sandbox, 0);
    renderer.root.updateMatrixWorld(true);
    const roofCenter = FILM_SETS[roof.set].center;
    const surface = (z: number) => {
      const ray = new THREE.Raycaster(new THREE.Vector3(roofCenter.x, roofCenter.y + 10, roofCenter.z + z), new THREE.Vector3(0, -1, 0));
      return ray.intersectObjects(renderer.root.children, true)[0]?.point.y;
    };
    assert.ok(Math.abs(surface(10)! - roofCenter.y) < 2, `roof surface: ${surface(10)}`);
    assert.ok(surface(-4)! < roofCenter.y - 20, `gap surface: ${surface(-4)}`);

    journey.scene = phone.id; journey.step = 0;
    journey.openingPhone = { phase: 'running', remaining: OPENING_ESCAPE.phoneSeconds, lastTick: 0, attempts: 0 };
    player.position = filmEntry(phone); player.currentLocation = phone.set;
    renderer.update(player, sandbox, 0);
    const truck = renderer.root.getObjectByName('opening-garbage-truck') as THREE.Group;
    const booth = renderer.root.getObjectByName('opening-phone-booth') as THREE.Group;
    const glass = renderer.root.getObjectByName('opening-shattered-glass') as THREE.Group;
    assert.ok(truck && booth && glass);
    const startX = truck.position.x;
    journey.openingPhone.remaining = 3; renderer.update(player, sandbox, 1);
    assert.ok(truck.position.x < startX - 5, 'the truck turns toward the same booth the player must reach');
    journey.openingPhone.phase = 'done'; journey.openingPhone.impactElapsed = OPENING_ESCAPE.truckImpactSeconds;
    renderer.update(player, sandbox, 2);
    assert.ok(Math.abs(truck.position.x) < .01);
    assert.ok(booth.rotation.x < -.4 && glass.visible, 'connected escape is followed by the glass booth impact');
  } finally { renderer.dispose(); globalThis.document = document; }
});

test('303 broken glass stays broken while Trinity climbs the visible fire escape', t => {
  t.mock.method(THREE.TextureLoader.prototype, 'load', () => new THREE.Texture());
  const document = globalThis.document;
  globalThis.document = { createElement: () => ({ width: 0, height: 0, getContext: () => ({ fillRect() {}, strokeRect() {}, fillText() {} }) }) } as unknown as Document;
  const world = new WorldState(); new AgentManager(world).initializeAllAgents();
  const player = world.agents.get('trinity')!; const hotel = FILM_SCENE_BY_ID.m1_room303;
  const journey: FilmJourney = { version: 1, scene: hotel.id, actor: player.id, step: 4, completed: [], enteredAt: 0,
    reflections: {}, lastText: '', checkpoint: filmEntry(hotel), openingHotel: { phase: 'dive', elapsed: .7, lastTick: 0, attempts: 0, disarmed: true, ammo: 2, shots: 6 } };
  const sandbox = { neoLife: { journey }, structures: [] } as unknown as SandboxState;
  const scene = new THREE.Scene(); scene.background = new THREE.Color(); scene.fog = new THREE.FogExp2(0, .01);
  const renderer = new FilmSetRenderer(scene);
  try {
    player.position = filmEntry(hotel); player.currentLocation = hotel.set; player.isInMatrix = true;
    renderer.update(player, sandbox, 0);
    const glass = renderer.root.getObjectByName('hotel-303-window')!;
    const shards = renderer.root.getObjectByName('hotel-303-window-shards')!;
    renderer.root.updateMatrixWorld(true);
    const center = FILM_SETS[hotel.set].center;
    const rung = new THREE.Raycaster(new THREE.Vector3(center.x, center.y + 1.3, center.z - 28), new THREE.Vector3(0, 0, -1))
      .intersectObjects(renderer.root.children, true)[0];
    assert.ok(rung && rung.point.z - center.z < -29 && rung.point.z - center.z > -31, 'the ladder rungs are part of the playable set');
    assert.equal(glass.visible, false); assert.equal(shards.visible, true);
    journey.openingHotel!.phase = 'ladder_ready'; journey.step = 5;
    renderer.update(player, sandbox, 1);
    assert.equal(glass.visible, false); assert.equal(shards.visible, true);
  } finally { renderer.dispose(); globalThis.document = document; }
});
