import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from 'three';
import { MATRIX_ESCAPE, filmPosition, matrixEscapeRoot, type FilmJourney, type SandboxState } from '@auto_matrix/shared';
import { FilmSetRenderer } from '../packages/client/src/engine/FilmSetRenderer.js';
import { LightCulling } from '../packages/client/src/engine/LightCulling.js';
import { MatrixEscapeRenderer } from '../packages/client/src/engine/MatrixEscapeRenderer.js';
import { AgentManager } from '../packages/server/src/agents/AgentManager.js';
import { WorldState } from '../packages/server/src/world/WorldState.js';

const journey = (scene: 'm1_subway' | 'm1_city_chase'): FilmJourney => ({
  version: 1, scene, actor: 'neo', step: 0, completed: [], enteredAt: 0,
  checkpoint: { x: 0, y: 1, z: 0 }, reflections: {}, lastText: '',
  matrixEscape: { kind: scene === 'm1_subway' ? 'subway' : 'city', phase: 'ready', elapsed: 0, attempt: 0,
    checkpoint: scene === 'm1_subway' ? 'duel' : 'street', hits: 0, dodges: 0, pursuit: 0, segment: 0, possessions: 0, resolved: [] },
});

test('subway set owns a story-timed train, destructible phone, wall break and track struggle', () => {
  const root = new THREE.Group(); const renderer = new MatrixEscapeRenderer(root, 'film_subway_platform');
  for (const name of ['matrix-subway-platform', 'matrix-subway-track', 'matrix-subway-phone', 'matrix-subway-phone-debris',
    'matrix-subway-wall-break', 'matrix-subway-train', 'matrix-subway-train-headlight']) assert.ok(root.getObjectByName(name), name);
  const state = journey('m1_subway'); const encounter = state.matrixEscape!;
  renderer.update(state, 1); const train = root.getObjectByName('matrix-subway-train')!; const saved = train.position.clone();
  renderer.update(state, 99); assert.deepEqual(train.position.toArray(), saved.toArray(), 'global client time cannot move the saved train');
  encounter.phase = 'train_window'; encounter.elapsed = 2.4; renderer.update(state, 2);
  assert.equal(train.visible, true); assert.notDeepEqual(train.position.toArray(), saved.toArray());
  encounter.phase = 'body_swap'; encounter.elapsed = 1; renderer.update(state, 3);
  assert.equal(root.getObjectByName('matrix-subway-code-transform')!.visible, true);
  renderer.dispose(); assert.equal(root.children.length, 0);
});

test('the subway batches opaque wall tiles', t => {
  const root = new THREE.Group(); const renderer = new MatrixEscapeRenderer(root, 'film_subway_platform');
  t.after(() => renderer.dispose());
  const platform = root.getObjectByName('matrix-subway-platform')!;
  let meshes = 0;
  platform.traverse(object => { if (object instanceof THREE.Mesh) meshes++; });
  assert.ok(meshes < 300, `expected the tiled walls to share draw calls, got ${meshes} platform meshes`);
});

test('the rooftop prepares one detached subway and reuses it with the entry light layout', t => {
  const scene = new THREE.Scene(), sets = new FilmSetRenderer(scene);
  const world = new WorldState(); new AgentManager(world).initializeAllAgents();
  const neo = world.agents.get('neo')!;
  neo.position = filmPosition('film_government_roof'); neo.isInMatrix = true;
  const roof: FilmJourney = { ...journey('m1_subway'), scene: 'm1_rooftop_rescue', matrixEscape: undefined,
    airRescue: { kind: 'roof', phase: 'bracing', elapsed: 0, attempt: 0 } };
  const sandbox = { neoLife: { journey: roof } } as SandboxState;
  sets.update(neo, sandbox, 0);
  assert.equal(sets.active?.id, 'film_government_roof');

  const smith = new THREE.Group(), coat = new THREE.Texture(), skin = new THREE.Texture();
  const geometry = new THREE.BoxGeometry(), material = new THREE.MeshStandardMaterial({ map: coat, normalMap: skin });
  smith.add(new THREE.Mesh(geometry, material));
  t.after(() => { sets.dispose(); geometry.dispose(); material.dispose(); coat.dispose(); skin.dispose(); });

  const points = (root: THREE.Scene) => {
    let count = 0;
    root.traverseVisible(object => { if (object instanceof THREE.PointLight) count++; });
    return count;
  };
  let preparedScene: THREE.Scene | undefined, compiledSmith = false;
  const uploads: THREE.Texture[] = [];
  const graphics = { extensions: { has: () => true }, info: { programs: [] }, getRenderTarget: () => null,
    setRenderTarget() {}, properties: { get: () => ({}) }, initTexture(texture: THREE.Texture) { uploads.push(texture); },
    compile(subject: THREE.Group, _camera: THREE.Camera, target: THREE.Scene) {
      preparedScene = target;
      let count = 0;
      subject.traverse(object => { count++; if (object === smith.children[0]) compiledSmith = true; });
      assert.ok(count <= 4);
    } } as unknown as THREE.WebGLRenderer;
  const camera = new THREE.PerspectiveCamera();
  const prepare = () => sets.prepareSubway(graphics, camera, roof, id => id === 'smith' ? smith : undefined);
  prepare(); assert.equal(preparedScene, undefined, 'keep shader preparation outside the playable brace windows');
  roof.airRescue!.phase = 'pulling';
  prepare();
  const station = preparedScene?.getObjectByName('matrix-escape-set');
  assert.ok(station);
  const platform = station.getObjectByName('matrix-subway-platform')!;
  assert.ok(!scene.getObjectByName(station.name), 'leave the current rooftop as the only visible set');
  assert.equal(uploads.length, 0);
  for (const texture of [coat, skin]) { texture.image = { width: 2048, height: 2048 }; texture.needsUpdate = true; }
  for (let frame = 0; frame < 100; frame++) {
    const uploaded = uploads.length;
    prepare(); assert.ok(uploads.length - uploaded <= 1);
  }
  assert.ok(compiledSmith);
  assert.deepEqual(uploads, [coat, skin]);
  const slots = points(preparedScene!);
  assert.equal(slots, 12, 'prepare the color programs with one spare slot for the phone shot');

  sandbox.neoLife!.journey = journey('m1_subway');
  neo.position = filmPosition('film_subway_platform');
  sets.update(neo, sandbox, 1);
  assert.ok(sets.root.getObjectByName(station.name) === station && station.getObjectByName(platform.name) === platform);
  const culling = new LightCulling(scene);
  t.after(() => culling.dispose());
  culling.stablePointSlots = sets.stablePointSlots; culling.minimumPointSlots = slots;
  const renderedPoints = () => {
    scene.updateMatrixWorld(); camera.updateMatrixWorld(); scene.onBeforeRender(graphics, scene, camera, null);
    try { return points(scene); } finally { scene.onAfterRender(graphics, scene, camera); }
  };
  assert.equal(renderedPoints(), slots);
  const flash = new THREE.PointLight(0xffd090, 26); scene.add(flash);
  assert.equal(renderedPoints(), slots, 'the phone shot fills the spare slot');
  assert.equal(flash.intensity, 26);
  flash.removeFromParent(); flash.dispose();
  assert.equal(sets.root.getObjectByName('matrix-subway-train')?.visible, false);
  let released = 0;
  const floor = platform.children.find(object => object instanceof THREE.Mesh) as THREE.Mesh;
  floor.geometry.addEventListener('dispose', () => { released++; });
  sets.update(undefined, undefined, 2);
  assert.equal(released, 1);
  assert.ok(!scene.getObjectByName(station.name));
});

test('the train keeps the headlight in the subway light layout when its body is hidden', t => {
  const root = new THREE.Group(); const renderer = new MatrixEscapeRenderer(root, 'film_subway_platform');
  t.after(() => renderer.dispose());
  const state = journey('m1_subway'), encounter = state.matrixEscape!;
  const headlight = root.getObjectByName('matrix-subway-train-headlight') as THREE.PointLight;
  const train = root.getObjectByName('matrix-subway-train')!;
  for (const phase of ['ready', 'train_window', 'body_swap'] as const) {
    encounter.phase = phase; encounter.elapsed = 2.4; renderer.update(state, 0);
    const visible: THREE.Object3D[] = [];
    root.traverseVisible(object => { if (object instanceof THREE.Light) visible.push(object); });
    assert.ok(visible.includes(headlight), `${phase} must keep the same headlight slot`);
    assert.ok(!visible.some(light => light instanceof THREE.SpotLight), `${phase} must not add unused spotlights`);
    assert.equal(headlight.intensity > 0, phase === 'train_window');
    assert.ok(headlight.getWorldPosition(new THREE.Vector3()).distanceTo(train.localToWorld(new THREE.Vector3(0, 2.6, -16))) < 1e-6);
  }
});

test('backed train windows keep their reflective glazing without requesting a transmission pass', t => {
  const root = new THREE.Group(); const renderer = new MatrixEscapeRenderer(root, 'film_subway_platform');
  t.after(() => renderer.dispose());
  const train = root.getObjectByName('matrix-subway-train')!;
  const glass = train.children.filter(object => object instanceof THREE.Mesh && object.material instanceof THREE.MeshPhysicalMaterial) as THREE.Mesh<THREE.BufferGeometry, THREE.MeshPhysicalMaterial>[];
  assert.equal(glass.length, 11);
  assert.ok(glass.every(window => window.material.clearcoat > 0 && window.material.transparent && window.material.transmission === 0));
});

test('city route renders distinct market, failed phones, fire escapes, garbage truck and room 303 entrance', () => {
  const root = new THREE.Group(); const renderer = new MatrixEscapeRenderer(root, 'film_escape_streets');
  for (const name of ['matrix-city-market', 'matrix-city-phone-0', 'matrix-city-phone-1', 'matrix-city-fire-escape',
    'matrix-city-garbage-truck', 'matrix-city-room-303', 'matrix-city-code-transform']) assert.ok(root.getObjectByName(name), name);
  const state = journey('m1_city_chase'); const encounter = state.matrixEscape!;
  encounter.phase = 'phone_failure'; encounter.elapsed = 1.2; renderer.update(state, 4);
  assert.equal(root.getObjectByName('matrix-city-phone-sparks')!.visible, true);
  encounter.phase = 'truck_window'; encounter.elapsed = MATRIX_ESCAPE.city.truckBeat; renderer.update(state, 5);
  const truck = root.getObjectByName('matrix-city-garbage-truck')!; assert.equal(truck.visible, true); assert.ok(truck.position.z < 15);
  const neo = matrixEscapeRoot(encounter, 'neo');
  assert.ok(Math.abs(truck.position.z - 6.48 - neo.z) < 1, 'the truck front reaches Neo at the saved dodge beat');
  encounter.phase = 'possession'; encounter.elapsed = 1; renderer.update(state, 6);
  assert.equal(root.getObjectByName('matrix-city-code-transform')!.visible, true);
  renderer.dispose(); assert.equal(root.children.length, 0);
});

test('the saved truck dodge clears the actual body and wheels before the truck passes Neo', t => {
  const root = new THREE.Group(); const renderer = new MatrixEscapeRenderer(root, 'film_escape_streets');
  t.after(() => renderer.dispose());
  const truck = root.getObjectByName('matrix-city-garbage-truck')!;
  const state = journey('m1_city_chase'), encounter = state.matrixEscape!;
  encounter.phase = 'truck_window'; encounter.elapsed = MATRIX_ESCAPE.city.truckBeat;
  const waiting = matrixEscapeRoot(encounter, 'neo');
  encounter.phase = 'possession'; encounter.elapsed = 0;
  assert.deepEqual(matrixEscapeRoot(encounter, 'neo'), waiting, 'pressing X begins the move at the player’s existing position');
  for (let elapsed = 0; elapsed <= MATRIX_ESCAPE.city.possession; elapsed += .02) {
    encounter.elapsed = elapsed; renderer.update(state, 0);
    const bounds = new THREE.Box3().setFromObject(truck);
    const neo = matrixEscapeRoot(encounter, 'neo');
    assert.ok(neo.z < bounds.min.z - .55 || neo.z > bounds.max.z + .55 || neo.x > bounds.max.x + .55,
      `the garbage truck intersects Neo at ${elapsed.toFixed(2)}s`);
  }
});

test('street windows face out of their backing instead of being buried in the facade', t => {
  const root = new THREE.Group(); const renderer = new MatrixEscapeRenderer(root, 'film_escape_streets');
  t.after(() => renderer.dispose());
  const set = root.getObjectByName('matrix-escape-set')!;
  const facades = set.children.filter(object => Math.abs(object.position.x) === 18.1);
  assert.equal(facades.length, 16);
  for (const facade of facades) {
    const panes = facade.children.filter(object => object instanceof THREE.Mesh && object.material instanceof THREE.MeshPhysicalMaterial);
    assert.equal(panes.length, 9);
    assert.ok(panes.every(pane => Math.abs(pane.getWorldPosition(new THREE.Vector3()).x) < Math.abs(facade.position.x) - .225));
  }
});

test('the hotel door opens a real passage and Neo crosses its threshold', t => {
  const root = new THREE.Group(); const renderer = new MatrixEscapeRenderer(root, 'film_escape_streets');
  t.after(() => renderer.dispose());
  const hotel = root.getObjectByName('matrix-city-room-303')!;
  const state = journey('m1_city_chase'), encounter = state.matrixEscape!;
  const ray = new THREE.Raycaster(new THREE.Vector3(0, 4, -47), new THREE.Vector3(0, 0, -1));
  renderer.update(state, 0); root.updateMatrixWorld(true);
  assert.equal(ray.intersectObject(hotel, true)[0]?.object.name, 'matrix-city-room-303-door');
  encounter.phase = 'door'; encounter.elapsed = MATRIX_ESCAPE.city.door;
  renderer.update(state, 0); root.updateMatrixWorld(true);
  const neo = matrixEscapeRoot(encounter, 'neo');
  assert.ok(neo.z < -50.5 && neo.y >= 2.5, 'Neo climbs the steps and ends inside the open door');
  assert.ok(ray.intersectObject(hotel, true).every(hit => hit.point.z < neo.z), 'no door or solid facade blocks the crossing');
});
