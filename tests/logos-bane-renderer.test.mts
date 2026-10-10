import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from 'three';
import { LogosBaneRenderer } from '../packages/client/src/engine/LogosBaneRenderer.js';
import { LOGOS_BANE, FILM_SCENE_BY_ID, filmEntry, type BaneEncounter, type FilmJourney, type SandboxState } from '@auto_matrix/shared';
import { FilmSetRenderer } from '../packages/client/src/engine/FilmSetRenderer.js';
import { WorldState } from '../packages/server/src/world/WorldState.js';
import { AgentManager } from '../packages/server/src/agents/AgentManager.js';

test('Logos cuts the ship lights, reveals the saved gold target and opens the engineering hatch only after rescue', () => {
  const root = new THREE.Group(); const shipLight = new THREE.PointLight(0xffffff, 100); root.add(shipLight);
  const renderer = new LogosBaneRenderer(root);
  const encounter: BaneEncounter = { phase: 'ready', elapsed: 0, attempts: 0, checkpoint: 'gun', hits: 0, focus: 0, counters: 0, lastStrike: -1 };
  const gold = root.getObjectByName('bane-gold-perception') as THREE.Group;
  const hatch = root.getObjectByName('logos-engineering-hatch') as THREE.Group;
  const fill = root.getObjectByName('logos-deck-fill') as THREE.HemisphereLight;
  const gun = root.getObjectByName('bane-electric-gun') as THREE.Group;
  assert.ok(gold && hatch && fill && gun && root.getObjectByName('logos-engineering-hatch-rim'));
  renderer.update(encounter, 1, 0); assert.equal(shipLight.intensity, 100); assert.equal(gold.visible, false); assert.equal(hatch.rotation.z, 0);
  assert.equal(gun.visible, true, 'the same physical gun remains visible while it is held');
  assert.ok(fill.intensity > .6);
  encounter.phase = 'gun_window'; renderer.update(encounter, 1, .8); assert.ok(shipLight.intensity < 10);
  encounter.phase = 'blind'; encounter.focus = .9; renderer.update(encounter, 1, 2); assert.equal(gold.visible, true); assert.ok(shipLight.intensity < 3);
  assert.equal(gun.visible, true, 'the gun remains on the deck after the grapple');
  assert.ok(fill.intensity < .1);
  encounter.phase = 'counter'; encounter.pipeX = 4; encounter.pipeZ = -3; renderer.update(encounter, 1, 3);
  assert.equal(gold.position.x, 4); assert.equal(gold.position.z, -3);
  encounter.phase = 'defeated'; renderer.update(encounter, 3, 4); assert.ok(hatch.rotation.z > .9, 'the lid lifts above the deck');
  renderer.dispose(); assert.equal(root.children.length, 1); assert.equal(shipLight.intensity, 100);
});

test('the held gun, saved deck placement and hatch opening remain physical and stable during a pause', () => {
  const root = new THREE.Group(), renderer = new LogosBaneRenderer(root), h = LOGOS_BANE.hatch;
  const encounter: BaneEncounter = { phase: 'ready', elapsed: 0, attempts: 0, checkpoint: 'gun', hits: 0, focus: 0, counters: 0, lastStrike: -1,
    physical: { version: 1, intro: 'hostage', elapsed: 2, known: false, gunOnDeck: false, rescue: 'waiting', rescueElapsed: 0, gunHealth: 43, blindHealth: 25, baneHealth: 80, fall: 0, player: LOGOS_BANE.neo } };
  const avatar = new THREE.Group(), wrist = new THREE.Group(); wrist.name = 'wrist_R'; wrist.position.set(.5, 2.8, -3.2); avatar.add(wrist); root.add(avatar);
  const gun = root.getObjectByName('bane-electric-gun')!, hatch = root.getObjectByName('logos-engineering-hatch')!;
  renderer.update(encounter, 1, 0, role => role === 'neo' ? avatar : undefined);
  assert.ok(gun.getWorldPosition(new THREE.Vector3()).distanceTo(wrist.localToWorld(new THREE.Vector3(.09, -.18, .02))) < .0001, 'the gun must follow the delivered wrist');
  encounter.physical!.gunPoint = { x: .34, y: .26, z: -3.2 }; encounter.physical!.gunOnDeck = true;
  renderer.update(encounter, 1, 1); assert.deepEqual(gun.position.toArray(), [.34, .26, -3.2]);
  const placed = new THREE.Box3().setFromObject(gun, true);
  assert.ok(placed.min.y >= 0 && placed.max.y < .5, `the actual dropped gun cannot penetrate the deck: ${placed.min.y}/${placed.max.y}`);
  const closed = new THREE.Raycaster(new THREE.Vector3(h.x, 1, h.z), new THREE.Vector3(0, -1, 0), .01, 6);
  root.updateMatrixWorld(true);
  assert.ok(closed.intersectObject(root, true)[0].point.y > 0, 'the closed hatch supports the actual deck surface');
  encounter.phase = 'defeated'; encounter.physical!.intro = 'done'; encounter.physical!.rescue = 'climbing'; encounter.physical!.rescueElapsed = 1;
  renderer.update(encounter, 2, 2); root.updateMatrixWorld(true);
  const open = closed.intersectObject(root, true).filter(hit => {
    for (let o: THREE.Object3D | null = hit.object; o; o = o.parent) if (!o.visible) return false;
    return true;
  });
  assert.ok(Math.abs(open[0].point.y - h.lower) < .01, 'the actual mesh exposes the lower deck, without a render-only invisible floor');
  const cable = root.getObjectByName('logos-live-cable') as THREE.InstancedMesh, before = Array.from(cable.instanceMatrix.array), angle = hatch.rotation.z;
  renderer.update(structuredClone(encounter), 2, 500);
  assert.deepEqual(Array.from(cable.instanceMatrix.array), before); assert.equal(hatch.rotation.z, angle); assert.deepEqual(gun.position.toArray(), [.34, .26, -3.2]);
  renderer.dispose(); root.remove(avatar); assert.equal(root.children.length, 0);
});

test('the cargo-bay waypoint light stays off during the saved hostage and rescue actions', t => {
  t.mock.method(THREE.TextureLoader.prototype, 'load', () => new THREE.Texture());
  const previous = globalThis.document;
  globalThis.document = { createElement: () => ({ getContext: () => ({ fillRect() {}, strokeRect() {}, fillText() {},
    createImageData: (w: number, h: number) => ({ data: new Uint8ClampedArray(w * h * 4) }), putImageData() {} }) }) } as unknown as Document;
  const world = new WorldState(); new AgentManager(world).initializeAllAgents();
  const actor = world.agents.get('neo')!; actor.isInMatrix = false; actor.currentLocation = 'film_logos_deck'; actor.position = filmEntry(FILM_SCENE_BY_ID.m3_bane);
  const bane: BaneEncounter = { phase: 'ready', elapsed: 0, attempts: 0, checkpoint: 'gun', hits: 0, focus: 0, counters: 0, lastStrike: -1,
    physical: { version: 1, intro: 'taking', elapsed: 4.751, known: false, gunOnDeck: true, rescue: 'waiting', rescueElapsed: 0, gunHealth: 100, blindHealth: 100, baneHealth: 80, fall: 0, player: LOGOS_BANE.neo } };
  const journey = { scene: 'm3_bane', actor: 'neo', step: 1, bane } as FilmJourney;
  const sandbox = { neoLife: { journey }, structures: [] } as unknown as SandboxState;
  const scene = new THREE.Scene(); scene.background = new THREE.Color(); scene.fog = new THREE.FogExp2();
  const renderer = new FilmSetRenderer(scene);
  t.after(() => { renderer.dispose(); globalThis.document = previous; });
  const check = (visible: boolean) => {
    renderer.update(actor, sandbox, 0);
    const marker = scene.children.find(object => object instanceof THREE.Mesh && object.geometry instanceof THREE.TorusGeometry)!;
    const light = scene.children.find(object => object instanceof THREE.PointLight)!;
    assert.equal(marker.visible, visible, 'the active action must not retain a waypoint through the player');
    assert.equal(light.visible, visible, 'the old objective light must not overexpose the player during the action');
  };
  check(false);
  bane.physical!.intro = 'recognition_ready'; check(true);
  bane.phase = 'defeated'; bane.physical!.intro = 'done'; bane.physical!.rescue = 'climbing'; journey.step = 2; check(false);
  bane.physical!.rescue = 'done'; journey.step = 3; check(false);
});
