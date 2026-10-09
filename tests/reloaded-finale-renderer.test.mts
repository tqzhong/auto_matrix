import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { RELOADED_FINALE, SIGNAL_OBSTACLES, type FilmJourney } from '@auto_matrix/shared';
import { NebDeckRenderer } from '../packages/client/src/engine/NebDeckRenderer.js';
import { ReloadedFinaleRenderer } from '../packages/client/src/engine/ReloadedFinaleRenderer.js';
import { FILM_SETS, filmPosition, playerBlocked, type WorldStructure } from '@auto_matrix/shared';
import { FilmSetRenderer } from '../packages/client/src/engine/FilmSetRenderer.js';
import { WorldState } from '../packages/server/src/world/WorldState.js';
import { AgentManager } from '../packages/server/src/agents/AgentManager.js';

const journey = (scene: string): FilmJourney => ({ version: 1, scene, actor: 'neo', step: 0, completed: [], enteredAt: 0,
  checkpoint: { x: 0, y: 0, z: 0 }, reflections: {}, lastText: '' });

test('the raised cargo hatch leaves a body-wide passage through the frame and stern into the tunnel', () => {
  const root = new THREE.Group(); const renderer = new NebDeckRenderer(root); const saved = journey('m2_ship_lost');
  saved.step = 3; saved.shipLoss = { phase: 'evacuating', remaining: 25, lastTick: 0, attempts: 0 };
  renderer.update(saved, 40); root.updateMatrixWorld(true);
  const visible: THREE.Mesh[] = [];
  root.traverse(object => { if (!(object instanceof THREE.Mesh)) return; let parent: THREE.Object3D | null = object;
    while (parent) { if (!parent.visible) return; parent = parent.parent; } visible.push(object); });
  for (const x of [-1.1, 0, 1.1]) for (const y of [1.1, 2, 3.8]) {
    const ray = new THREE.Raycaster(new THREE.Vector3(x, y, 36), new THREE.Vector3(0, 0, 1), .01, 14);
    assert.deepEqual(ray.intersectObjects(visible, false).map(hit => hit.object.name), [], `blocked cargo passage at ${x},${y}`);
  }
  renderer.dispose();
});

test('the evacuation route crosses the normal deck boundary only while its physical exit is installed', () => {
  const outside = filmPosition('film_neb_deck', 0, 60);
  const exit: WorldStructure = { id: 'film:neb-escape:route', kind: 'beacon', owner: 'matrix',
    position: { ...FILM_SETS.film_neb_deck.center }, matrix: false, health: 999 };
  assert.equal(playerBlocked(outside, false, 1.1), true);
  assert.equal(playerBlocked(outside, false, 1.1, [exit]), false);
  assert.equal(playerBlocked(filmPosition('film_neb_deck', 9, 60), false, 1.1, [exit]), true);
});

test('the old ship visibly switches from bomb radar to an open cargo hatch and evacuation lights', () => {
  const root = new THREE.Group(); const renderer = new NebDeckRenderer(root); const saved = journey('m2_ship_lost');
  saved.shipLoss = { phase: 'briefing', remaining: RELOADED_FINALE.evacuationSeconds, lastTick: 0, attempts: 0 };
  renderer.update(saved, 1);
  assert.equal(root.getObjectByName('neb-final-evacuation')?.visible, true);
  assert.ok(root.getObjectByName('neb-bomb-radar')); assert.ok(root.getObjectByName('neb-evacuation-path-25'));
  const hatch = root.getObjectByName('neb-cargo-hatch') as THREE.Mesh; const closed = hatch.position.y;
  saved.shipLoss.phase = 'evacuating'; saved.shipLoss.age = .8; renderer.update(saved, 2);
  assert.ok(hatch.position.y > closed);
  assert.ok((root.getObjectByName('neb-evacuation-alarm') as THREE.PointLight).intensity > 100);
  renderer.update(journey('m1_download'), 3); assert.equal(root.getObjectByName('neb-final-evacuation')?.visible, false);
  renderer.dispose();
});

test('saved blast and hatch positions stay fixed across renderer clocks and recreation', () => {
  const root = new THREE.Group(); const renderer = new NebDeckRenderer(root); const saved = journey('m2_ship_lost');
  saved.shipLoss = { phase: 'evacuating', remaining: 30, lastTick: 0, attempts: 0, age: .6, elapsed: 0 };
  renderer.update(saved, 1); const halfOpen = root.getObjectByName('neb-cargo-hatch')!.position.clone();
  renderer.update(saved, 700); assert.deepEqual(root.getObjectByName('neb-cargo-hatch')!.position, halfOpen);
  saved.shipLoss.phase = 'destroying'; saved.shipLoss.elapsed = 2.1; renderer.update(saved, 800);
  assert.equal(root.getObjectByName('neb-interior-deck')!.visible, false);
  assert.equal(root.getObjectByName('neb-exterior-hull')!.visible, false);
  const debris = root.getObjectByName('neb-hull-fragment-0')!, position = debris.position.clone(), rotation = debris.rotation.toArray();
  renderer.update(saved, 1800); assert.deepEqual(debris.position, position); assert.deepEqual(debris.rotation.toArray(), rotation);
  const coldRoot = new THREE.Group(), cold = new NebDeckRenderer(coldRoot);
  cold.update(JSON.parse(JSON.stringify(saved)), 0);
  assert.deepEqual(coldRoot.getObjectByName('neb-hull-fragment-0')!.position, position);
  assert.deepEqual(coldRoot.getObjectByName('neb-hull-fragment-0')!.rotation.toArray(), rotation);
  for (let t = .1; t <= 5.6; t += .1) {
    saved.shipLoss.elapsed = t; renderer.update(saved, 10);
    root.getObjectByName('neb-destruction')!.traverse(object => {
      if (object.name.startsWith('neb-hull-fragment-')) { assert.ok(object.position.y >= .12); assert.ok(object.position.z < 56, 'debris enters the safe crew area'); }
    });
  }
  renderer.dispose(); cold.dispose(); assert.equal(root.children.length, 0); assert.equal(coldRoot.children.length, 0);
});

test('tunnel Sentinels approach without shutting down before Neo establishes the signal', () => {
  const root = new THREE.Group(); const renderer = new ReloadedFinaleRenderer(root, 'm2_stop_sentinels'); const saved = journey('m2_stop_sentinels');
  saved.tunnel = { phase: 'sensing', remaining: RELOADED_FINALE.sentinelSeconds, focus: 0, lastTick: 0, attempts: 0 };
  renderer.update(saved, 0);
  const first = root.getObjectByName('real-sentinel-1') as THREE.Group; assert.ok(first);
  assert.equal(root.getObjectByName('hammer-rescue-arrival')?.visible, false);
  const before = first.position.z;
  saved.tunnel.remaining = 7; saved.tunnel.focus = RELOADED_FINALE.signalSeconds * .4; renderer.update(saved, 2);
  assert.ok(first.position.z < before);
  assert.equal((first.getObjectByName('sentinel-eye') as THREE.Mesh).material instanceof THREE.MeshBasicMaterial, true);
  assert.equal(((first.getObjectByName('sentinel-eye') as THREE.Mesh).material as THREE.MeshBasicMaterial).color.getHex(), 0xf06554);
  saved.tunnel.phase = 'collapsed'; renderer.update(saved, 3);
  assert.equal(root.getObjectByName('hammer-rescue-arrival')?.visible, true);
  assert.ok((root.getObjectByName('hammer-rescue-beam') as THREE.SpotLight).intensity > 0);
  renderer.dispose(); assert.equal(root.children.length, 0);
});

test('paused tunnel machines and wreck lighting retain their saved pose across browser clocks and cold loading', () => {
  const root = new THREE.Group(), renderer = new ReloadedFinaleRenderer(root, 'm2_stop_sentinels'), saved = journey('m2_stop_sentinels');
  saved.tunnel = { phase: 'sensing', remaining: 7, focus: 1, lastTick: 42, attempts: 0 };
  const snapshot = (stage: THREE.Group) => {
    const unit = stage.getObjectByName('real-sentinel-1')!;
    return { position: unit.position.toArray(), rotation: unit.rotation.toArray() };
  };
  renderer.update(saved, 2); const expected = snapshot(root);
  renderer.update(saved, 900); assert.deepEqual(snapshot(root), expected);
  const coldRoot = new THREE.Group(), cold = new ReloadedFinaleRenderer(coldRoot, 'm2_stop_sentinels');
  cold.update(structuredClone(saved), 0); assert.deepEqual(snapshot(coldRoot), expected);
  renderer.dispose(); cold.dispose();
});

test('Hammer has two distinct medical beds and live telemetry screens', () => {
  const root = new THREE.Group(); const renderer = new ReloadedFinaleRenderer(root, 'm2_medical');
  const neo = root.getObjectByName('hammer-medical-neo') as THREE.Group;
  const bane = root.getObjectByName('hammer-medical-bane') as THREE.Group;
  assert.ok(neo && bane); assert.equal(bane.position.x - neo.position.x, 20);
  assert.ok(neo.getObjectByName('medical-telemetry-screen')); assert.ok(bane.getObjectByName('medical-telemetry-screen'));
  renderer.update(journey('m2_medical'), 2); renderer.dispose(); assert.equal(root.children.length, 0);
});

test('paused medical lighting does not change with browser render time or cold recreation', () => {
  const saved = journey('m2_medical'), root = new THREE.Group(), renderer = new ReloadedFinaleRenderer(root, 'm2_medical');
  const lights = (group: THREE.Group) => { const result: number[] = []; group.traverse(object => { if (object instanceof THREE.Light) result.push(object.intensity); }); return result; };
  renderer.update(saved, 2); const expected = lights(root);
  renderer.update(saved, 2000); assert.deepEqual(lights(root), expected);
  const coldRoot = new THREE.Group(), cold = new ReloadedFinaleRenderer(coldRoot, 'm2_medical');
  cold.update(structuredClone(saved), 0); assert.deepEqual(lights(coldRoot), expected);
  renderer.dispose(); cold.dispose();
});

test('the playable medical room has exactly two patient surfaces, without the generic Hammer beds underneath', t => {
  t.mock.method(THREE.TextureLoader.prototype, 'load', () => new THREE.Texture());
  const originalDocument = globalThis.document;
  globalThis.document = { createElement: () => ({ width: 0, height: 0, getContext: () => ({ fillRect() {}, strokeRect() {}, fillText() {}, createRadialGradient: () => ({ addColorStop() {} }) }) }) } as unknown as Document;
  t.after(() => { globalThis.document = originalDocument; });
  const scene = new THREE.Scene(), renderer = new FilmSetRenderer(scene);
  t.after(() => renderer.dispose());
  const world = new WorldState(); new AgentManager(world).initializeAllAgents(); const player = world.agents.get('trinity')!;
  Object.assign(player, { position: filmPosition('film_hammer_deck', 0, -16), currentLocation: 'film_hammer_deck', isInMatrix: false });
  renderer.update(player, { neoLife: { journey: journey('m2_medical') } } as never, 0, player.position);
  scene.updateMatrixWorld(true);
  const beds = new THREE.Raycaster(new THREE.Vector3(player.position.x - 10, player.position.y + 10, player.position.z - 9), new THREE.Vector3(0, -1, 0), 0, 15)
    .intersectObjects(scene.children, true).filter(hit => hit.object instanceof THREE.Mesh && hit.point.y > FILM_SETS.film_hammer_deck.center.y);
  const surfaces = [...new Set(beds.map(hit => hit.object.name))];
  assert.ok(surfaces.length > 0); assert.ok(surfaces.every(name => name.startsWith('medical-')), `conflicting bed surfaces: ${surfaces}`);
  assert.equal(scene.getObjectByName('hammer-medical-floor') !== undefined, true);
});

test('stopped machine hulls retain floor support, extinguish their lamps and cannot restart when focus is released', () => {
  const root = new THREE.Group(), renderer = new ReloadedFinaleRenderer(root, 'm2_stop_sentinels'), saved = journey('m2_stop_sentinels');
  saved.tunnel = { phase: 'stopping', remaining: 9, focus: 2.2, lastTick: 20, attempts: 0, age: 5, elapsed: 0 };
  for (let t = 0; t <= 1.61; t += .08) {
    saved.tunnel.elapsed = t; renderer.update(saved, 80); root.updateMatrixWorld(true);
    for (let i = 1; i <= 3; i++) {
      const unit = root.getObjectByName(`real-sentinel-${i}`)!;
      assert.ok(new THREE.Box3().setFromObject(unit).min.y >= .069, `machine ${i} enters the physical floor at ${t}`);
      if (t > (i - 1) * .18) assert.equal((unit.getObjectByName('sentinel-optical-light') as THREE.PointLight).intensity, 0);
    }
  }
  const unit = root.getObjectByName('real-sentinel-1')!, expected = unit.position.clone();
  saved.tunnel.focus = 0; renderer.update(saved, 1800); assert.deepEqual(unit.position, expected);
  renderer.dispose();
});

test('the brick passage and side pipes use the same footprints as normal movement collision', () => {
  const center = FILM_SETS.film_service_tunnels.center;
  const structures: WorldStructure[] = [{ id: 'film:sentinel-signal:route', kind: 'beacon', owner: 'matrix', position: { ...center }, matrix: false, health: 999 },
    ...SIGNAL_OBSTACLES.map((box, index) => ({ id: `film:sentinel-signal:${index}`, kind: 'barricade' as const, owner: 'matrix', position: filmPosition('film_service_tunnels', box.x, box.z), matrix: false, health: 999,
      film: { scene: 'm2_stop_sentinels', width: box.width, depth: box.depth, height: box.height } }))];
  for (const z of [-65, -25, 0, 40]) assert.equal(playerBlocked(filmPosition('film_service_tunnels', 0, z), false, 1.1, structures), false);
  assert.equal(playerBlocked(filmPosition('film_service_tunnels', 12.7, -25), false, 1.1, structures), true);
  assert.equal(playerBlocked(filmPosition('film_service_tunnels', 18, -25), false, 1.1, structures), true);
  assert.equal(playerBlocked(filmPosition('film_service_tunnels', 0, 58), false, 1.1, structures), true);
});
