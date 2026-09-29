import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from 'three';
import { filmPosition, lifeRoomCenter, type FilmJourney, type NeoLifeState, type SandboxState } from '@auto_matrix/shared';
import { LifeInteriors } from '../packages/client/src/engine/LifeInteriors.js';
import { FilmSetRenderer } from '../packages/client/src/engine/FilmSetRenderer.js';
import { WorldState } from '../packages/server/src/world/WorldState.js';
import { AgentManager } from '../packages/server/src/agents/AgentManager.js';
import { ApartmentSetRenderer } from '../packages/client/src/engine/ApartmentSetRenderer.js';

test('the physical bedside clock shows world time, flashes while ringing and depresses under Neo’s hand', t => {
  const original = globalThis.document; const text: string[] = [];
  globalThis.document = { createElement: () => ({ width: 0, height: 0, getContext: () => ({ fillRect() {}, fillText(line: string) { text.push(line); } }) }) } as unknown as Document;
  t.mock.method(THREE.TextureLoader.prototype, 'load', () => new THREE.Texture());
  const root = new THREE.Group(); const renderer = new ApartmentSetRenderer(root);
  const journey = { scene: 'm1_morning', step: 1, morning: { phase: 'alarm', elapsed: 0 } } as FilmJourney;
  try {
    text.length = 0; renderer.update(journey, 9250);
    assert.ok(text.includes('09:15') && text.includes('ALARM'));
    const clock = root.getObjectByName('apartment-alarm-clock')!; const button = clock.getObjectByName('apartment-alarm-button')!;
    assert.ok(clock); const height = button.position.y;
    const light = root.getObjectByName('apartment-window-daylight') as THREE.PointLight;
    assert.ok(light.intensity > 60, 'daylight must reach the room when the alarm rings');
    journey.morning!.elapsed = .3; text.length = 0; renderer.update(journey, 9250);
    assert.ok(text.includes('09:15')); assert.ok(!text.includes('ALARM'), 'the saved story clock controls the blink');
    text.length = 0; renderer.update(structuredClone(journey), 9250); assert.equal(text.length, 0, 'a paused/restored frame must not toggle the display');
    journey.morning = { phase: 'stopping', elapsed: .6 }; renderer.update(journey, 9250); assert.ok(button.position.y < height);
    journey.morning = { phase: 'rising', elapsed: .2 }; renderer.update(journey, 9267); assert.equal(button.position.y, height);
    assert.ok(text.includes('09:16'));
  } finally { renderer.dispose(); globalThis.document = original; }
});

test('one persistent city apartment renders ordinary life, contact, daylight and an open street portal', t => {
  const original = globalThis.document; const text: string[] = [];
  globalThis.document = { createElement: () => ({ width: 0, height: 0, getContext: () => ({ fillRect() {}, fillText(line: string) { text.push(line); } }) }) } as unknown as Document;
  t.mock.method(THREE.TextureLoader.prototype, 'load', () => new THREE.Texture());
  const scene = new THREE.Scene(); scene.background = new THREE.Color(0xb9d7ee); scene.fog = new THREE.FogExp2(0xb9d7ee, .00075);
  scene.environmentIntensity = 1.05;
  const city = new THREE.Group(); scene.add(city); const interiors = new LifeInteriors(city); const film = new FilmSetRenderer(scene);
  const world = new WorldState(); new AgentManager(world).initializeAllAgents(); const neo = world.agents.get('neo')!;
  neo.position = lifeRoomCenter('neo_apartment')!; neo.isInMatrix = true;
  try {
    interiors.update(12000, neo.position);
    const home = scene.getObjectByName('anderson-shared-apartment')!; assert.ok(home);
    const door = home.getObjectByName('apartment-101-door')!; assert.equal(door.rotation.y, 1.42);
    assert.ok(text.includes('MAIL / WORK / CONTACTS')); assert.ok(!text.some(line => line.includes('MORPHEUS')));
    const rays = new THREE.Raycaster(); scene.updateMatrixWorld(true);
    for (const x of [-.6, 0, .6]) {
      rays.set(new THREE.Vector3(neo.position.x + x, 2.5, neo.position.z + 1), new THREE.Vector3(0, 0, 1)); rays.far = 28;
      assert.equal(rays.intersectObject(home, true).length, 0, `visible geometry must leave the walking exit clear at x=${x}`);
    }
    const journey: FilmJourney = { version: 1, scene: 'm1_wake_up', step: 0, actor: 'neo', completed: [], enteredAt: 0,
      reflections: {}, lastText: '', checkpoint: { ...neo.position }, contact: { phase: 'idle', elapsed: 0 } };
    const life = { journey, contactSignal: true } as NeoLifeState;
    interiors.update(12000, neo.position, life);
    const set = film.update(neo, { neoLife: life } as SandboxState, 0);
    assert.equal(set?.id, 'film_anderson_flat'); assert.equal(door.rotation.y, 0);
    assert.equal(film.atmosphere(), undefined); assert.equal(scene.environmentIntensity, 1.05);
    assert.equal(scene.background.getHex(), 0xb9d7ee); assert.equal(scene.fog.density, .00075);
    let rooms = 0; scene.traverse(object => { if (object.name === 'anderson-shared-apartment') rooms++; }); assert.equal(rooms, 1);
    scene.updateMatrixWorld(true); rays.set(new THREE.Vector3(neo.position.x, 2.5, neo.position.z + 1), new THREE.Vector3(0, 0, 1));
    assert.ok(rays.intersectObject(home, true).length, 'the story closes the actual shared door');
    const sunlight = home.getObjectByName('apartment-window-daylight') as THREE.PointLight;
    assert.ok(sunlight.intensity > 90 && sunlight.visible);
    interiors.update(22000, neo.position, life); assert.equal(sunlight.intensity, 0);
    assert.equal(scene.getObjectByName('anderson-shared-apartment'), home, 'day/night and chapter updates do not recreate the room');
    interiors.update(22000, filmPosition('film_white_rabbit_club'), life);
    home.traverse(object => { if (object instanceof THREE.Light) assert.equal(object.visible, false, 'remote apartment lights must not render'); });
    interiors.update(7500, neo.position, { contactSignal: true } as NeoLifeState);
    assert.equal(door.rotation.y, 1.42, 'deferring the invitation restores the daily open door');
    assert.ok(sunlight.intensity > 0);
    const meshes = () => { let count = 0; scene.traverse(object => { if (object instanceof THREE.Mesh) count++; }); return count; };
    const before = meshes();
    for (const chapter of ['m1_dojo', 'm1_sentinels', 'm3_ceasefire']) {
      const elsewhere = { ...journey, scene: chapter };
      const visitor = { ...world.agents.get('choi')!, position: { ...neo.position }, isInMatrix: true };
      film.update(visitor, { neoLife: { journey: elsewhere } } as SandboxState, 0);
      assert.equal(meshes(), before, 'another character visiting home must not load Neo’s distant story scenery into the apartment');
    }
  } finally { film.dispose(); interiors.dispose(); globalThis.document = original; }
});
