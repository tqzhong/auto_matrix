import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from 'three';
import { FILM_SCENE_BY_ID, FILM_SETS, filmEntry, filmStepPosition, filmPosition, filmGroundHeight, playerBlocked, type FilmJourney, type SandboxState } from '@auto_matrix/shared';
import { FilmSetRenderer } from '../packages/client/src/engine/FilmSetRenderer.js';
import { WorldState } from '../packages/server/src/world/WorldState.js';
import { AgentManager } from '../packages/server/src/agents/AgentManager.js';

test('Mobil station keeps its platform, track, station signs and saved train phase in the rendered world', t => {
  t.mock.method(THREE.TextureLoader.prototype, 'load', () => new THREE.Texture());
  const document = globalThis.document;
  globalThis.document = { createElement: () => ({ width: 0, height: 0, getContext: () => ({ fillRect() {}, strokeRect() {}, fillText() {} }) }) } as unknown as Document;
  const world = new WorldState(); new AgentManager(world).initializeAllAgents();
  const player = world.agents.get('neo')!; player.position = filmEntry(FILM_SCENE_BY_ID.m3_trainman);
  player.currentLocation = 'film_mobil_station'; player.isInMatrix = true;
  const journey: FilmJourney = { version: 1, scene: 'm3_trainman', actor: 'neo', step: 1, completed: [],
    enteredAt: 0, reflections: {}, lastText: '', checkpoint: { ...player.position },
    mobil: { phase: 'waiting', elapsed: 0, lastTick: 0, loops: 0 } };
  const sandbox = { neoLife: { journey }, structures: [] } as unknown as SandboxState;
  const scene = new THREE.Scene(); scene.background = new THREE.Color(); scene.fog = new THREE.FogExp2(0, .01);
  const renderer = new FilmSetRenderer(scene);
  try {
    renderer.update(player, sandbox, 0);
    const train = renderer.root.getObjectByName('mobil-train') as THREE.Group;
    const left = train.getObjectByName('mobil-train-door-left') as THREE.Mesh;
    const right = train.getObjectByName('mobil-train-door-right') as THREE.Mesh;
    assert.ok(train && left && right, 'the single-car train and both sliding doors are geometry');
    assert.equal(train.visible, false, 'no train idles on an empty station');
    journey.mobil!.phase = 'approaching'; journey.mobil!.elapsed = 2.25; renderer.update(player, sandbox, 2.25);
    assert.equal(train.visible, true); assert.ok(train.position.z < -20 && train.position.z > -80);
    journey.mobil!.phase = 'stopped'; renderer.update(player, sandbox, 5);
    assert.ok(Math.abs(train.position.z + 20) < .001); assert.ok(right.position.z - left.position.z > 4, 'doors open at the platform');
    journey.mobil!.phase = 'refusing'; journey.mobil!.elapsed = 1; renderer.update(player, sandbox, 6);
    assert.ok(right.position.z - left.position.z > 4, 'doors stay open while Sati and her parents board');
    journey.mobil!.elapsed = 2; renderer.update(player, sandbox, 6.5);
    assert.ok(right.position.z - left.position.z < 2, 'doors close after boarding');
    journey.mobil!.phase = 'departing'; journey.mobil!.elapsed = 1.5; renderer.update(player, sandbox, 7);
    assert.ok(train.position.z < -20); assert.ok(right.position.z - left.position.z < 2, 'doors close before departure');
    journey.mobil!.phase = 'gone'; renderer.update(player, sandbox, 9); assert.equal(train.visible, false);
    const set = FILM_SETS.film_mobil_station;
    assert.equal(filmGroundHeight(filmPosition(set.id, 12, 0), set), set.center.y - 1.35);
    for (const story of ['m3_mobil', 'm3_family', 'm3_trainman']) for (const step of FILM_SCENE_BY_ID[story].steps)
      assert.equal(playerBlocked(filmStepPosition(FILM_SCENE_BY_ID[story], step), true), false, `${story}: ${step.label}`);
    const disposed: string[] = []; train.traverse(object => {
      if (object instanceof THREE.Mesh) object.geometry.addEventListener('dispose', () => disposed.push(object.uuid));
    });
    renderer.dispose(); assert.ok(disposed.length > 10, 'train geometry is released when the set closes');
  } finally { renderer.dispose(); globalThis.document = document; }
});
