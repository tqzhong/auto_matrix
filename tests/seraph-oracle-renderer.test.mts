import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from 'three';
import { BURLY, FILM_SCENE_BY_ID, FILM_SETS, filmEntry, newCatch, newGarageEscape, newMaggieDiscovery, newTrainmanChase, type FilmJourney, type SandboxState, type SandboxThreat } from '@auto_matrix/shared';
import { AgentRenderer } from '../packages/client/src/agents/AgentRenderer.js';
import { CharacterModels, type CharacterRig } from '../packages/client/src/agents/CharacterModel.js';
import { HeroModels } from '../packages/client/src/agents/HeroModel.js';
import { newMotion } from '../packages/client/src/agents/CharacterMotion.js';
import { FilmSetRenderer } from '../packages/client/src/engine/FilmSetRenderer.js';
import { SandboxRenderer } from '../packages/client/src/engine/SandboxRenderer.js';
import { AgentManager } from '../packages/server/src/agents/AgentManager.js';
import { WorldState } from '../packages/server/src/world/WorldState.js';

test('the Oracle routes adopt prepared sets and keep their interactive props live', async t => {
  const previous = globalThis.document;
  const context = { fillRect() {}, strokeRect() {}, fillText() {}, beginPath() {}, moveTo() {}, lineTo() {}, closePath() {}, stroke() {}, fill() {}, ellipse() {} };
  globalThis.document = { createElement: () => ({ width: 0, height: 0, getContext: () => context }) } as unknown as Document;
  t.after(() => { globalThis.document = previous; });
  t.mock.method(THREE.TextureLoader.prototype, 'load', () => new THREE.Texture({ width: 1, complete: true }));
  const scene = new THREE.Scene(), sets = new FilmSetRenderer(scene), camera = new THREE.PerspectiveCamera();
  const world = new WorldState(); new AgentManager(world).initializeAllAgents();
  const neo = world.agents.get('neo')!;
  const journey: FilmJourney = { version: 1, scene: 'm2_departure', actor: 'neo', step: 0, completed: [], enteredAt: 0,
    checkpoint: neo.position, reflections: {}, lastText: '' };
  const sandbox = { neoLife: { journey } } as SandboxState;
  const cast = new THREE.Group(), body = new THREE.Mesh(new THREE.BoxGeometry(), new THREE.MeshStandardMaterial());
  cast.add(body);
  t.after(() => { sets.dispose(); body.geometry.dispose(); body.material.dispose(); });

  let preview: THREE.Scene | undefined, castCompiled = false, offstageSeraph: THREE.Group | undefined, offstageHost: THREE.Group | undefined;
  const compiled = new Set<THREE.Object3D>();
  const compileCounts = new Map<THREE.Object3D, number>();
  const graphics = { extensions: { has: () => true }, info: { programs: [] }, getRenderTarget: () => null,
    setRenderTarget() {}, initTexture() {}, properties: { get: () => ({}) },
    compile(subject: THREE.Group, _camera: THREE.Camera, target: THREE.Scene) {
      target.traverseVisible(object => { if (object instanceof THREE.Scene) preview = object; });
      subject.traverse(mesh => {
        compiled.add(mesh); compileCounts.set(mesh, (compileCounts.get(mesh) ?? 0) + 1);
        if (mesh === body) castCompiled = true;
      });
    } } as unknown as THREE.WebGLRenderer;
  const enter = (id: string, step: number) => {
    const beat = FILM_SCENE_BY_ID[id];
    Object.assign(journey, { scene: id, step });
    Object.assign(neo, { position: filmEntry(beat), isInMatrix: FILM_SETS[beat.set].world === 'matrix', currentLocation: beat.set });
    sets.update(neo, sandbox, 0);
  };
  const prepare = () => sets.prepareSecondOracle(graphics, camera, journey, id => id === 'seraph' ? offstageSeraph : id === 'merovingian' ? offstageHost
    : ['neo', 'smith', 'trinity', 'roland'].includes(id) ? cast : undefined);
  const warm = (name: string) => {
    preview = undefined; castCompiled = false; compiled.clear();
    for (let i = 0; i < 120; i++) prepare();
    const mesh = preview?.getObjectByName(name);
    assert.ok(mesh instanceof THREE.Mesh || mesh instanceof THREE.Group, `${name} was prepared`);
    assert.ok(!scene.getObjectByName(name));
    assert.equal(castCompiled, true);
    return mesh;
  };
  const pointSlots = (root: THREE.Scene) => {
    let count = 0;
    root.traverseVisible(object => { if (object instanceof THREE.PointLight) count++; });
    return count;
  };

  await t.test('the tea house warms the Matrix coat and the late detailed Seraph before the cut', t => {
    const coat = new THREE.SkinnedMesh(body.geometry, body.material), shipClothes = new THREE.Mesh(body.geometry, body.material);
    const seraph = new THREE.Group(); seraph.visible = false;
    const standIn = new THREE.Mesh(body.geometry, body.material);
    coat.visible = false; shipClothes.visible = false; shipClothes.userData.reloadedHidden = true;
    cast.add(coat, shipClothes); seraph.add(standIn); offstageSeraph = seraph;
    t.after(() => { cast.remove(coat, shipClothes); offstageSeraph = undefined; enter('m2_departure', 3); prepare(); preview = undefined; });
    enter('m2_departure', 4);
    warm('m2_seraph-keyed-door');
    assert(compiled.has(coat), 'the Matrix coat must warm while it is hidden in Zion');
    assert(!compiled.has(shipClothes));
    assert(!compiled.has(standIn), 'leave the temporary Seraph model out of the tea house preparation');
    standIn.visible = false;
    const detailed = ['body', 'head'].map(part => {
      const group = new THREE.Group(); group.name = 'seraph-detailed-' + part;
      const mesh = new THREE.SkinnedMesh(body.geometry, body.material); group.add(mesh); seraph.add(group); return mesh;
    });
    for (let i = 0; i < 100; i++) prepare();
    assert.deepEqual(detailed.map(mesh => compileCounts.get(mesh)), [1, 1]);
    assert.equal(seraph.visible, false);
    assert.equal(coat.visible, false);
  });

  enter('m2_departure', 3); prepare(); assert.ok(!preview);
  enter('m2_departure', 4);
  const teaDoor = warm('m2_seraph-keyed-door');
  const teaSlots = pointSlots(preview!);
  enter('m2_seraph', 0);
  assert.ok(scene.getObjectByName(teaDoor.name) === teaDoor);
  assert.equal(sets.stablePointSlots, true);
  assert.equal(pointSlots(scene), teaSlots);
  assert.equal(teaDoor.parent!.position.x, -2.6); assert.equal(teaDoor.parent!.rotation.y, 0);
  enter('m2_seraph', 1);
  const hallDoor = warm('m2_backdoors-keyed-door');
  enter('m2_seraph', 2);
  assert.equal(teaDoor.parent!.rotation.y, -Math.PI / 2);

  enter('m2_backdoors', 1);
  assert.ok(scene.getObjectByName(hallDoor.name) === hallDoor);
  assert.equal(hallDoor.parent!.position.x, -2.6); assert.equal(hallDoor.parent!.rotation.y, 0);
  const lead = warm('oracle-second-folded-lead');
  enter('m2_backdoors', 2);
  assert.equal(hallDoor.parent!.rotation.y, -Math.PI / 2);
  enter('m2_bench', 0);
  assert.ok(scene.getObjectByName(lead.name) === lead);
  assert.equal(lead.visible, true);
  enter('m2_bench', 4);
  assert.equal(lead.visible, false);
  castCompiled = false;
  prepare();
  assert.equal(castCompiled, true, 'Smith is prepared while the Oracle is leaving');
  enter('m2_burly', 0);
  assert.ok(scene.getObjectByName(lead.name) === lead, 'Smith arrives in the existing courtyard');
  assert.equal(sets.stablePointSlots, true);
  assert.equal(lead.visible, false);

  preview = undefined; prepare(); assert.ok(!preview, 'the restaurant waits until the flight exit opens');
  await t.test('Le Vrai prepares the offstage host and the objective ring before the cut', t => {
    const host = new THREE.Group(), coat = new THREE.Mesh(body.geometry, body.material);
    host.visible = false; host.add(coat); offstageHost = host;
    t.after(() => { offstageHost = undefined; enter('m2_burly', 0); prepare(); preview = undefined; });
    enter('m2_burly', 1);
    warm('causality-dessert');
    assert(compiled.has(coat), 'prepare the detailed host while the courtyard is active');
    assert(compiled.has(sets.goalMarker), 'prepare the first restaurant objective ring');
    assert.equal(host.visible, false);
  });
  enter('m2_burly', 1);
  const dessert = warm('causality-dessert');
  const restaurantSlots = pointSlots(preview!);
  enter('m2_merovingian', 0);
  assert.ok(scene.getObjectByName(dessert.name) === dessert);
  assert.equal(pointSlots(scene), restaurantSlots);
  assert.equal(dessert.visible, false);
  enter('m2_merovingian', 2); assert.equal(dessert.visible, true);
  enter('m2_persephone', 0);
  assert.ok(scene.getObjectByName(dessert.name) === dessert, 'the washroom is in the existing restaurant');
  assert.equal(dessert.visible, false);
  enter('m2_persephone', 4);
  const bookshelf = warm('keymaker-book-door');
  const librarySlots = pointSlots(preview!);
  enter('m2_library', 0);
  assert.ok(scene.getObjectByName(bookshelf.name) === bookshelf);
  assert.equal(pointSlots(scene), librarySlots);
  assert.equal(bookshelf.position.x, -10.5); assert.equal(bookshelf.rotation.y, 0);
  enter('m2_library', 3); assert.equal(bookshelf.rotation.y, Math.PI/2);

  await t.test('the Keymaker escort prepares and adopts the château door and stopped rounds', () => {
    preview = undefined; prepare(); assert.ok(!preview);
    enter('m2_library', 4);
    const abandoned = warm('chateau-upper-door') as THREE.Mesh;
    let disposals = 0; abandoned.geometry.addEventListener('dispose', () => disposals++);
    enter('m2_library', 3); prepare();
    assert.equal(disposals, 1, 'returning for the Keymaker releases the unused hall');

    enter('m2_library', 4);
    const door = warm('chateau-upper-door'), rounds = preview!.getObjectByName('chateau-stopped-rounds')!;
    assert.ok(rounds.children.length && rounds.children.every(round => compiled.has(round)));
    assert.equal(rounds.visible, false);
    assert(compiled.has(sets.goalMarker));
    enter('m2_chateau', 0);
    assert.equal(scene.getObjectByName(door.name), door);
    assert.equal(scene.getObjectByName(rounds.name), rounds);
    journey.chateau = { phase: 'duel', wave: 1, volleyAt: 0, attempts: 0, parries: 0, disarms: 0, wounded: false };
    enter('m2_chateau', 0); assert.equal(rounds.visible, true);
    delete journey.chateau;
    enter('m2_chateau', 2); assert.equal(door.position.x, 5); assert.equal(rounds.visible, false);
  });

  await t.test('the château keeps one light per chandelier', () => {
    enter('m2_chateau', 0);
    assert.equal(pointSlots(scene), 11);
  });
  await t.test('the snowy terrace is prepared once the upper fight clears', () => {
    preview = undefined; prepare(); assert.ok(!preview);
    enter('m2_chateau', 1);
    const terrain = warm('mountain-snow-terrain') as THREE.Mesh;
    const mountainSlots = pointSlots(preview!);
    enter('m2_mountain', 0);
    assert.ok(scene.getObjectByName(terrain.name) === terrain);
    assert.equal(pointSlots(scene), mountainSlots);
    let terrainDisposals = 0; terrain.geometry.addEventListener('dispose', () => terrainDisposals++);
    enter('m2_departure', 4);
    assert.equal(terrainDisposals, 1);
    enter('m2_chateau', 1);
    const abandoned = warm('mountain-snow-terrain') as THREE.Mesh;
    let abandonedDisposals = 0; abandoned.geometry.addEventListener('dispose', () => abandonedDisposals++);
    sets.update(undefined, sandbox, 1);
    assert.equal(abandonedDisposals, 1);
  });
  await t.test('the flight prepares the garage and keeps the same car after the cut', () => {
    enter('m2_mountain', 2);
    journey.mountain = { phase: 'ready', elapsed: 0, x: 0, z: 245, altitude: 0, attempt: 0 };
    preview = undefined; prepare(); assert.ok(!preview);
    Object.assign(journey.mountain, { phase: 'flying', elapsed: 2, z: 112, altitude: 48 });
    const car = warm('garage-chase-car');
    const garageSlots = pointSlots(preview!);
    journey.garage = { ...newGarageEscape(), x: 1.2, z: -10 };
    enter('m2_garage', 1);
    assert.ok(scene.getObjectByName(car.name) === car);
    assert.equal(pointSlots(scene), garageSlots);
    assert.equal(car.position.x, 1.2);
    assert.equal(car.position.z, -10);
    delete journey.garage;
    delete journey.mountain;
  });
  await t.test('terminal work prepares the white corridor and adopts the live door', t => {
    t.mock.method(HeroModels.prototype, 'create', async () => undefined);
    enter('m2_backup', 0); preview = undefined; prepare(); assert.ok(!preview);
    enter('m2_backup', 1);
    journey.trinityTerminal = { phase: 'ready', elapsed: 0, attempts: 0 };
    prepare(); assert.ok(!preview);
    journey.trinityTerminal.phase = 'scanning';
    const leaf = warm('escape-door-leaf') as THREE.Mesh;
    const lights = pointSlots(preview!);
    enter('m2_key_door', 0);
    assert.ok(scene.getObjectByName(leaf.name) === leaf);
    assert.equal(pointSlots(scene), lights);
    assert.equal(leaf.parent!.rotation.y, 0);
    journey.keyDoor = { portalOpened: true, keyTaken: false, performance: { phase: 'cover', elapsed: .5, attempts: 0 } };
    enter('m2_key_door', 3);
    assert.equal(leaf.parent!.rotation.y, Math.PI / 2);
    delete journey.keyDoor;
    delete journey.trinityTerminal;
    let disposals = 0; leaf.geometry.addEventListener('dispose', () => disposals++);
    enter('m2_departure', 4);
    assert.equal(disposals, 1);
  });
  await t.test('the key handoff prepares the Architect room and preserves its door and light rig', t => {
    t.mock.method(HeroModels.prototype, 'create', async () => undefined);
    let finishAtlas: (() => void) | undefined;
    t.mock.method(THREE.TextureLoader.prototype, 'load', (url: string, onLoad?: (texture: THREE.Texture) => void) => {
      if (!url.endsWith('/neo-reactions-atlas.png')) return new THREE.Texture({ width: 1, complete: true });
      const texture = new THREE.Texture();
      finishAtlas = () => { texture.image = { width: 1672, complete: true }; texture.needsUpdate = true; onLoad?.(texture); };
      return texture;
    });
    enter('m2_key_door', 3); preview = undefined; prepare(); assert.ok(!preview);
    enter('m2_key_door', 4);
    const monitors = warm('CRT-wall-cases') as THREE.InstancedMesh;
    const displays = [0, 1, 2, 3].map(index => preview!.getObjectByName(`CRT-wall-neo-${index}`) as THREE.Mesh<THREE.BufferGeometry, THREE.MeshBasicMaterial>);
    const maps = displays.map(display => display.material.map!);
    assert.equal(new Set(maps.map(map => map.source)).size, 1, 'all four CRT views share one uploaded image');
    assert.equal(new Set(maps.map(map => map.offset.toArray().join(','))).size, 4);
    assert.ok(maps.every(map => map.version === 0), 'CRT views wait for decoded image data before upload');
    assert.ok(finishAtlas); finishAtlas();
    assert.ok(maps.every(map => map.version > 0 && map.image.width === 1672));
    assert.ok(displays.every(display => compiled.has(display)), 'CRT program preparation includes the instanced screens');
    const preparedSlots = pointSlots(preview!);
    enter('m2_architect', 0);
    assert.equal(scene.getObjectByName(monitors.name), monitors);
    assert.equal(pointSlots(scene), preparedSlots);
    assert.equal(sets.stablePointSlots, true);
    const hinge = scene.getObjectByName('architect-matrix-hinge')!;
    assert.equal(hinge.rotation.y, 0);
    journey.architect = { phase: 'decision', sourceReviewed: true, trinityReviewed: true, remaining: 40, lastTick: 0, attempts: 0,
      room: { elapsed: 1, chairYaw: .3, exit: { elapsed: 1.1, x: -8, z: -26 } } };
    enter('m2_architect', 5);
    assert.equal(scene.getObjectByName(hinge.name), hinge);
    assert.ok(hinge.rotation.y > .3);
    assert.equal(pointSlots(scene), preparedSlots);
    delete journey.architect;
    let disposals = 0; monitors.geometry.addEventListener('dispose', () => disposals++);
    enter('m2_departure', 4);
    assert.equal(disposals, 1);
  });
  await t.test('the Architect choice prepares the rescue set with its actual breakable window', () => {
    enter('m2_architect', 2); preview = undefined; prepare(); assert.ok(!preview);
    enter('m2_architect', 3);
    const pane = warm('catch-burning-exit') as THREE.Mesh;
    assert.ok(compiled.has(preview!.getObjectByName('catch-lit-window-grid')!), 'prepare the instanced window program before the cut');
    const preparedSlots = pointSlots(preview!);
    enter('m2_catch', 0);
    assert.equal(scene.getObjectByName(pane.name), pane);
    assert.equal(pane.visible, true);
    assert.equal(pointSlots(scene), preparedSlots);
    assert.equal(sets.stablePointSlots, true);
    journey.catch = { ...newCatch(), phase: 'flight', elapsed: .6 };
    enter('m2_catch', 1);
    assert.equal(pane.visible, false);
    assert.equal(pointSlots(scene), preparedSlots);
    delete journey.catch;
    let disposals = 0; pane.geometry.addEventListener('dispose', () => disposals++);
    enter('m2_departure', 4);
    assert.equal(disposals, 1);
  });
  await t.test('Mobil prepares the Oracle apartment with its open entrance and intact vase', () => {
    enter('m3_trainman', 2); preview = undefined; prepare(); assert.ok(!preview);
    enter('m3_trainman', 3);
    const door = warm('oracle-apartment-door');
    const slots = pointSlots(preview!);
    let vase: THREE.Mesh | undefined;
    preview!.traverseVisible(object => {
      if (object instanceof THREE.Mesh && object.geometry instanceof THREE.LatheGeometry) vase = object;
    });
    assert.ok(vase);
    let disposals = 0; vase.geometry.addEventListener('dispose', () => disposals++);
    enter('m3_oracle_request', 0);
    assert.equal(scene.getObjectByName(door.name), door);
    assert.equal(door.rotation.y, Math.PI / 2);
    assert.equal(scene.getObjectById(vase.id), vase);
    assert.equal(scene.getObjectByName('oracle-floating-alphabet-blocks')!.visible, false);
    assert.equal(pointSlots(scene), slots);
    assert.equal(disposals, 0);
    enter('m2_departure', 0);
    assert.equal(disposals, 1);
  });
  await t.test('following Seraph prepares the chase carriage and its live braking doors', () => {
    enter('m3_oracle_request', 2); preview = undefined; prepare(); assert.ok(!preview);
    enter('m3_oracle_request', 3);
    const carriage = warm('trainman-carriage');
    const slots = pointSlots(preview!);
    const door = carriage.getObjectByName('trainman-car-door-0')!, closed = door.position.z;
    const floor = carriage.getObjectByName('trainman-car-floor') as THREE.Mesh;
    let disposals = 0; floor.geometry.addEventListener('dispose', () => disposals++);
    const chase = newTrainmanChase();
    journey.helChase = { phase: 'sighting', elapsed: 0, lastTick: 0, performance: chase };
    enter('m3_trainman_chase', 0);
    assert.equal(scene.getObjectByName(carriage.name), carriage);
    assert.equal(door.position.z, closed);
    assert.equal(pointSlots(scene), slots);
    assert.equal(disposals, 0);
    Object.assign(chase, { phase: 'braking', elapsed: 3.2 });
    enter('m3_trainman_chase', 1);
    assert.ok(Math.abs(door.position.z - closed) > 1.7);
    delete journey.helChase;
    enter('m2_departure', 0);
    assert.equal(disposals, 1);
  });
  await t.test('the council prepares the Hammer infirmary and preserves the physical medical door', () => {
    enter('m3_zion_prepare', 2); preview = undefined; prepare(); assert.ok(!preview);
    enter('m3_zion_prepare', 3);
    const room = warm('hammer-discovery-infirmary');
    const slots = pointSlots(preview!);
    const door = room.getObjectByName('discovery-medical-door') as THREE.Mesh, closed = door.position.x;
    let disposals = 0; door.geometry.addEventListener('dispose', () => disposals++);
    enter('m3_maggie_discovery', 0);
    assert.equal(scene.getObjectByName(room.name), room);
    assert.equal(door.position.x, closed);
    assert.equal(pointSlots(scene), slots);
    assert.equal(sets.stablePointSlots, true);
    journey.maggieDiscovery = { ...newMaggieDiscovery(0, 100), phase: 'calling', elapsed: .6, incident: true };
    enter('m3_maggie_discovery', 0);
    assert.ok(Math.abs(door.position.x) > Math.abs(closed), 'the saved call opens the same door');
    delete journey.maggieDiscovery;
    enter('m2_departure', 0);
    assert.equal(disposals, 1);
  });
  enter('m2_departure', 4);
  const abandoned = warm('m2_seraph-keyed-door') as THREE.Mesh;
  let disposed = 0; abandoned.geometry.addEventListener('dispose', () => disposed++);
  sets.update(undefined, sandbox, 1);
  assert.equal(disposed, 1);
  enter('m2_seraph', 2);
  const restored = scene.getObjectByName(teaDoor.name);
  assert.ok(restored && restored !== abandoned);
  assert.equal(restored.parent!.rotation.y, -Math.PI / 2);
});

test('the first Smith copies reuse the actor model cache and take their prepared rigs from the pool', t => {
  const previous = globalThis.document;
  const context = { fillRect() {}, strokeRect() {}, fillText() {}, putImageData() {}, createRadialGradient: () => ({ addColorStop() {} }),
    createImageData: (w: number, h: number) => ({ data: new Uint8ClampedArray(w * h * 4) }) };
  globalThis.document = { createElement: () => ({ getContext: () => context }) } as unknown as Document;
  t.after(() => { globalThis.document = previous; });
  t.mock.method(THREE.TextureLoader.prototype, 'load', () => new THREE.Texture());
  const created: { owner: CharacterModels; rig: CharacterRig }[] = [];
  t.mock.method(CharacterModels.prototype, 'create', function (this: CharacterModels) {
    const rig = { root: new THREE.Group(), motion: newMotion() } as CharacterRig;
    created.push({ owner: this, rig }); return rig;
  });
  const animated: CharacterModels[] = [];
  t.mock.method(CharacterModels.prototype, 'animate', function (this: CharacterModels) { animated.push(this); });
  const scene = new THREE.Scene(), agents = new AgentRenderer(scene), sandbox = new SandboxRenderer(scene, agents);
  t.after(() => { sandbox.dispose(); agents.dispose(); });
  const world = new WorldState(); new AgentManager(world).initializeAllAgents();
  const smith = world.agents.get('smith')!, neo = world.agents.get('neo')!;
  agents.updateAgent('smith', smith);
  const host = created[0].rig.root.parent;
  const journey = { scene: 'm2_burly', burly: { phase: 'ready' } } as FilmJourney;
  const sync = (threats: SandboxThreat[]) => sandbox.sync({ threats, nodes: [], structures: [], incidents: [], missions: {}, neoLife: { journey } } as SandboxState, { smith, neo });
  sync([]);
  sandbox.prepareBurlyCopies(); sandbox.prepareBurlyCopies();
  assert.equal(created.length, 2, 'wait for a prepared copy before creating another');
  for (let i = 0; i < BURLY.initialCopies; i++) {
    created.at(-1)!.rig.hero = { root: new THREE.Group() } as CharacterRig['hero'];
    sandbox.prepareBurlyCopies();
  }
  assert.equal(created.length, BURLY.initialCopies + 1);
  assert.ok(created.every(item => item.owner === created[0].owner));
  assert.ok(created.slice(1).every(item => !item.rig.root.parent?.parent), 'prepared copies stay outside the live scene');
  journey.burly!.phase = 'swarm';
  sync(Array.from({ length: BURLY.initialCopies }, (_, i) => ({ id: `copy-${i}`, scene: journey.scene, kind: 'smith', matrix: true,
    position: { ...smith.position, x: smith.position.x + i }, health: 64, maxHealth: 64, target: 'neo', stunUntil: 0, lastStrike: 0 })));
  assert.equal(created.length, BURLY.initialCopies + 1);
  assert.ok(created[0].rig.root.parent === host);
  assert.ok(created.slice(1).every(item => item.rig.root.parent?.parent === scene));
  sandbox.update(.02, new THREE.PerspectiveCamera(), true, 0, true);
  assert.equal(animated.length, BURLY.initialCopies);
  assert.ok(animated.every(owner => owner === created[0].owner));
});

test('nearby Smith copies keep readable bounded health bars without repeated name boards covering the fight', t => {
  const previous = globalThis.document, context = { fillRect() {}, fillText() {}, putImageData() {}, createRadialGradient: () => ({ addColorStop() {} }), createImageData: (w: number, h: number) => ({ data: new Uint8ClampedArray(w * h * 4) }) };
  globalThis.document = { createElement: () => ({ getContext: () => context }) } as unknown as Document; t.after(() => { globalThis.document = previous; });
  t.mock.method(THREE.TextureLoader.prototype, 'load', () => new THREE.Texture());
  t.mock.method(CharacterModels.prototype, 'create', () => ({ root: new THREE.Group(), motion: newMotion() } as CharacterRig)); t.mock.method(CharacterModels.prototype, 'animate', () => {});
  const scene = new THREE.Scene(), sandbox = new SandboxRenderer(scene), world = new WorldState(); new AgentManager(world).initializeAllAgents(); t.after(() => sandbox.dispose());
  const smith = world.agents.get('smith')!, neo = world.agents.get('neo')!, camera = new THREE.PerspectiveCamera(55, 960 / 540, .1, 200); camera.position.set(0, 6.4, 0); camera.updateMatrixWorld(true);
  const misses: unknown[] = [];
  for (const depth of [.3, 1, 2, 8, 20]) {
    sandbox.sync({ threats: [{ id: 'copy', scene: 'm2_burly', kind: 'smith', matrix: true, position: { x: 0, y: 1, z: -depth }, health: 32, maxHealth: 64, target: 'neo', stunUntil: 0, lastStrike: 0 }], nodes: [], structures: [], incidents: [], missions: {} } as unknown as SandboxState, { smith, neo });
    const enemy = (sandbox as unknown as { enemies: Map<string, { group: THREE.Group; label: THREE.Sprite; health: THREE.Mesh }> }).enemies.get('copy')!; enemy.group.position.z = -depth; sandbox.update(0, camera, true, 0, false); scene.updateMatrixWorld(true);
    if (enemy.label.visible || depth < 1.5 && enemy.health.visible) misses.push({ depth, nameVisible: enemy.label.visible, healthVisible: enemy.health.visible });
    if (enemy.health.visible) { const left = enemy.health.localToWorld(new THREE.Vector3(-.5, 0, .5)).project(camera), right = enemy.health.localToWorld(new THREE.Vector3(.5, 0, .5)).project(camera); if (Math.abs(right.x - left.x) > .27) misses.push({ depth, projectedWidth: Math.abs(right.x - left.x) }); }
  }
  assert.equal(misses.length, 0, JSON.stringify(misses));
});
