import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { BURLY, CHATEAU, FILM_SCENE_BY_ID, FILM_SETS, HEL_ELEVATOR, SERAPH_ORACLE, filmEntry, filmPosition, helElevatorFloor, newCatch, newGarageEscape, newHelGarage, newMaggieDiscovery, newTrainmanChase, type FilmJourney, type SandboxState, type SandboxThreat } from '@auto_matrix/shared';
import { AgentRenderer } from '../packages/client/src/agents/AgentRenderer.js';
import { CharacterModels, type CharacterRig } from '../packages/client/src/agents/CharacterModel.js';
import { HeroModels } from '../packages/client/src/agents/HeroModel.js';
import { newMotion } from '../packages/client/src/agents/CharacterMotion.js';
import { FilmSetRenderer } from '../packages/client/src/engine/FilmSetRenderer.js';
import { LightCulling } from '../packages/client/src/engine/LightCulling.js';
import { SandboxRenderer } from '../packages/client/src/engine/SandboxRenderer.js';
import { AgentManager } from '../packages/server/src/agents/AgentManager.js';
import { WorldState } from '../packages/server/src/world/WorldState.js';

test('the Oracle routes adopt prepared sets and keep their interactive props live', async t => {
  const previous = globalThis.document;
  const context = { fillRect() {}, strokeRect() {}, fillText() {}, beginPath() {}, moveTo() {}, lineTo() {}, closePath() {}, stroke() {}, fill() {}, ellipse() {},
    createLinearGradient: () => ({ addColorStop() {} }), createRadialGradient: () => ({ addColorStop() {} }),
    createImageData: (width: number, height: number) => ({ data: new Uint8ClampedArray(width * height * 4) }), putImageData() {} };
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
  const liveLighting = new LightCulling(scene);
  t.after(() => { sets.dispose(); liveLighting.dispose(); body.geometry.dispose(); body.material.dispose(); });

  let preview: THREE.Scene | undefined, castCompiled = false, offstageSeraph: THREE.Group | undefined, offstageHost: THREE.Group | undefined;
  const libraryCast = new Map<string, THREE.Group>();
  const compiled = new Set<THREE.Object3D>();
  const uploads = new Set<THREE.Texture>();
  const compileCounts = new Map<THREE.Object3D, number>();
  const shadowLayouts = new Set<number>();
  const graphics = { extensions: { has: () => true }, info: { programs: [] }, getRenderTarget: () => null,
    shadowMap: { enabled: true, type: THREE.PCFShadowMap },
    setRenderTarget() {}, initTexture(texture: THREE.Texture) { uploads.add(texture); }, properties: { get: () => ({}) },
    compile(subject: THREE.Group, _camera: THREE.Camera, target: THREE.Scene) {
      target.traverseVisible(object => { if (object instanceof THREE.Scene) preview = object; });
      subject.traverse(mesh => {
        compiled.add(mesh); compileCounts.set(mesh, (compileCounts.get(mesh) ?? 0) + 1);
        if (mesh === body) castCompiled = true;
        if (mesh instanceof THREE.SkinnedMesh && mesh.material instanceof THREE.MeshDepthMaterial) {
          let spots = 0;
          target.traverseVisible(light => { if (light instanceof THREE.SpotLight) spots++; });
          shadowLayouts.add(spots);
        }
      });
    } } as unknown as THREE.WebGLRenderer;
  const enter = (id: string, step: number) => {
    const beat = FILM_SCENE_BY_ID[id];
    Object.assign(journey, { scene: id, step });
    Object.assign(neo, { position: filmEntry(beat), isInMatrix: FILM_SETS[beat.set].world === 'matrix', currentLocation: beat.set });
    sets.update(neo, sandbox, 0);
  };
  const prepare = (resumeLibrary = false) => sets.prepareSecondOracle(graphics, camera, journey, id => libraryCast.get(id)
    ?? (id === 'seraph' ? offstageSeraph : id === 'merovingian' ? offstageHost
      : ['neo', 'smith', 'trinity', 'roland'].includes(id) ? cast : undefined), resumeLibrary, world.agents.get('trinity'), undefined, liveLighting);
  const warm = (name: string, resumeLibrary = false) => {
    preview = undefined; castCompiled = false; compiled.clear();
    for (let i = 0; i < 120; i++) prepare(resumeLibrary);
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

  await t.test('a boarded save keeps the tea house built on the landing screen through possession', t => {
    t.after(() => { journey.completed.pop(); enter('m2_departure', 3); prepare(); preview = undefined; });
    enter('m2_departure', 4);
    sets.update(undefined, sandbox, 0);
    preview = undefined;
    for (let i = 0; i < 120; i++) prepare(true);
    assert.ok(!preview, 'the landing page waits until boarding is complete');

    const boarded = FILM_SCENE_BY_ID.m2_departure.steps.length;
    journey.step = boarded;
    journey.completed.push('m2_departure');
    const saved = structuredClone(journey);
    const door = warm('m2_seraph-keyed-door', true);
    const slots = pointSlots(preview!);
    assert.deepEqual(journey, saved);
    enter('m2_departure', boarded);
    assert.equal(scene.getObjectByName(door.name), undefined);
    enter('m2_seraph', 0);
    assert.equal(scene.getObjectByName(door.name), door);
    assert.equal(pointSlots(scene), slots);
  });

  await t.test('the courtyard prepares the offstage Oracle once her first head arrives', t => {
    const oracle = new THREE.Group(), outfit = new THREE.Mesh(body.geometry, body.material);
    oracle.visible = false; oracle.add(outfit); libraryCast.set('oracle', oracle);
    t.after(() => { libraryCast.delete('oracle'); enter('m2_departure', 3); prepare(); preview = undefined; });
    enter('m2_backdoors', 1);
    warm('oracle-second-folded-lead');
    assert.ok(!compiled.has(outfit), 'wait for the first Oracle head with the courtyard cast');

    const head = new THREE.Group(), face = new THREE.Mesh(body.geometry, body.material);
    head.name = 'oracle-first-detailed-head'; head.add(face); oracle.add(head);
    for (let i = 0; i < 100; i++) prepare();
    assert.ok(compiled.has(outfit) && compiled.has(face), 'prepare the actual Oracle body and head before the courtyard cut');
    assert.equal(oracle.visible, false);
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
  await t.test('the library prepares the hidden guard, the objective and the late Keymaker models', t => {
    const keymaker = new THREE.Group(), cain = new THREE.Group();
    const physical = new THREE.MeshPhysicalMaterial();
    const guard = new THREE.Mesh(body.geometry, physical);
    cain.visible = keymaker.visible = false;
    cain.add(guard);
    libraryCast.set('cain', cain); libraryCast.set('keymaker', keymaker);
    t.after(() => { libraryCast.clear(); enter('m2_persephone', 2); prepare(); physical.dispose(); });
    enter('m2_persephone', 4);
    compiled.clear();
    for (let i = 0; i < 120 && !compiled.size; i++) prepare();
    assert([...compiled][0] === sets.goalMarker, 'the first preparation batch starts with the entry objective');
    for (let i = 0; i < 120; i++) prepare();
    assert(preview?.getObjectByName('keymaker-book-door'));
    assert(compiled.has(body) && compiled.has(guard), 'prepare the player and hidden guard with the library lights');
    const detailed = ['body', 'head'].map(part => {
      const mesh = new THREE.Mesh(body.geometry, body.material);
      mesh.name = 'keymaker-detailed-' + part; keymaker.add(mesh); return mesh;
    });
    for (let i = 0; i < 80; i++) prepare();
    assert.deepEqual(detailed.map(mesh => compileCounts.get(mesh)), [1, 1]);
    assert.equal(keymaker.visible, false);
    assert.equal(cain.visible, false);
  });
  await t.test('an office save keeps the library built on the landing screen through possession', t => {
    t.after(() => { enter('m2_persephone', 2); prepare(); });
    enter('m2_persephone', 4);
    sets.update(undefined, sandbox, 0);
    const shelf = warm('keymaker-book-door', true);
    const slots = pointSlots(preview!);
    enter('m2_persephone', 4);
    assert.equal(scene.getObjectByName(shelf.name), undefined);
    enter('m2_library', 0);
    assert.equal(scene.getObjectByName(shelf.name), shelf);
    assert.equal(pointSlots(scene), slots);
  });
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
  await t.test('the flight prepares the close garage cast and keeps the same car after the cut', t => {
    t.mock.method(THREE.TextureLoader.prototype, 'load', (_url: string, onLoad?: (texture: THREE.Texture) => void) => {
      const texture = new THREE.Texture({ width: 1, complete: true });
      onLoad?.(texture);
      return texture;
    });
    const twin = new THREE.Group(), keymaker = new THREE.Group();
    const twinCoat = new THREE.Mesh(body.geometry, body.material);
    const standIn = new THREE.Mesh(body.geometry, body.material);
    twin.visible = keymaker.visible = false;
    twin.add(twinCoat); keymaker.add(standIn);
    libraryCast.set('twin1', twin); libraryCast.set('keymaker', keymaker);
    t.after(() => { libraryCast.delete('twin1'); libraryCast.delete('keymaker'); });
    enter('m2_mountain', 2);
    journey.mountain = { phase: 'ready', elapsed: 0, x: 0, z: 245, altitude: 0, attempt: 0 };
    preview = undefined; prepare(); assert.ok(!preview);
    Object.assign(journey.mountain, { phase: 'flying', elapsed: 2, z: 112, altitude: 48 });
    const car = warm('garage-chase-car');
    const order = [...compiled];
    const mappedShell = order.find(object => object instanceof THREE.Mesh && object.parent === car.parent
      && object.material instanceof THREE.MeshStandardMaterial && object.material.normalMap);
    assert.ok(mappedShell, 'prepare the mapped garage shell');
    assert.ok(order.indexOf(mappedShell) < order.indexOf(twinCoat), 'link the mapped garage shell before the cast can fill the queue');
    assert(compiled.has(twinCoat));
    assert.equal(twin.visible, false);
    assert(!compiled.has(standIn));
    const head = new THREE.Mesh(body.geometry, body.material), jacket = new THREE.Mesh(body.geometry, body.material);
    head.name = 'keymaker-detailed-head'; jacket.name = 'keymaker-detailed-body';
    standIn.visible = false; keymaker.add(head, jacket);
    for (let i = 0; i < 15; i++) prepare();
    assert(compiled.has(head) && compiled.has(jacket));
    assert.equal(keymaker.visible, false);
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
  await t.test('a returned mountain save keeps its prepared garage when Neo takes control', () => {
    enter('m2_mountain', 3);
    journey.mountain = { phase: 'arrived', elapsed: 8, x: 0, z: -310, altitude: 45, attempt: 0 };
    sets.update(undefined, sandbox, 0);
    const car = warm('garage-chase-car', true);
    enter('m2_mountain', 3);
    assert.equal(scene.getObjectByName(car.name), undefined);
    enter('m2_garage', 0);
    assert.equal(scene.getObjectByName(car.name), car);
    delete journey.mountain;
  });
  await t.test('the highway rescue prepares the operation apartment and adopts it on the story cut', () => {
    journey.trucks = { phase: 'collision', elapsed: 0, lastTick: 0, attempt: 1 };
    enter('m2_trucks', 2);
    Object.assign(neo, { position: filmPosition('film_freeway_101', 14, 20), currentLocation: 'film_freeway_101' });
    sets.update(neo, sandbox, 0);
    preview = undefined; prepare();
    assert.equal(preview, undefined);
    journey.trucks.phase = 'rescue';
    const world = structuredClone(journey);
    const room = warm('source-briefing-apartment');
    const floor = room.getObjectByName('briefing-floor') as THREE.Mesh;
    const paper = room.getObjectByName('briefing-plan-primary');
    assert.ok(compiled.has(floor) && paper && compiled.has(paper));
    assert.deepEqual(journey, world);

    journey.trucks.phase = 'rescued'; journey.step = 3; prepare();
    enter('m2_plan', 0);
    assert.equal(scene.getObjectByName(room.name), room);
    assert.equal(scene.getObjectByName(paper.name), paper);
    let floorDisposals = 0;
    floor.geometry.addEventListener('dispose', () => floorDisposals++);
    enter('m2_backup', 0);
    assert.equal(floorDisposals, 1);
    delete journey.trucks;
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
    const actor = new THREE.Group(), standIn = new THREE.Mesh(body.geometry, body.material);
    actor.visible = false; actor.add(standIn);
    libraryCast.set('architect', actor);
    t.after(() => { libraryCast.delete('architect'); });
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
    assert(!compiled.has(standIn));
    const head = new THREE.Mesh(body.geometry, body.material), suit = new THREE.SkinnedMesh(body.geometry, body.material);
    suit.castShadow = true;
    head.name = 'architect-detailed-head'; suit.name = 'architect-detailed-body';
    standIn.visible = false; actor.add(head, suit);
    shadowLayouts.clear();
    for (let i = 0; i < 32; i++) prepare();
    assert(compiled.has(head) && compiled.has(suit));
    assert.deepEqual(shadowLayouts, new Set([0, 1]), 'the suit prepares shadows for both the corridor and the room lights');
    assert.ok(sets.secondOracleEntryNormalMeshes?.includes(monitors) && sets.secondOracleEntryNormalMeshes.includes(suit));
    assert.equal(actor.visible, false);
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
  await t.test('a saved source door approach keeps the prepared CRT room when Neo takes control', t => {
    t.mock.method(HeroModels.prototype, 'create', async () => undefined);
    enter('m2_key_door', 5);
    sets.update(undefined, sandbox, 0);
    const monitors = warm('CRT-wall-cases', true);
    enter('m2_key_door', 5);
    assert.equal(scene.getObjectByName(monitors.name), undefined);
    enter('m2_architect', 0);
    assert.equal(scene.getObjectByName(monitors.name), monitors);
  });
  await t.test('the Architect choice prepares the rescue set with its actual breakable window', t => {
    const trinity = new THREE.Group(), costume = new THREE.SkinnedMesh(body.geometry, body.material);
    costume.castShadow = true;
    trinity.add(costume); libraryCast.set('trinity', trinity);
    t.after(() => { libraryCast.delete('trinity'); });
    enter('m2_architect', 2); preview = undefined; prepare(); assert.ok(!preview);
    enter('m2_architect', 3);
    shadowLayouts.clear();
    const pane = warm('catch-burning-exit') as THREE.Mesh;
    const windows = preview!.getObjectByName('catch-lit-window-grid') as THREE.InstancedMesh;
    assert.ok(compiled.has(windows), 'prepare the instanced window program before the cut');
    assert.deepEqual(shadowLayouts, new Set([1, 0]), 'Trinity prepares shadows for both the room and the roof lights');
    assert.ok(sets.secondOracleEntryNormalMeshes?.includes(windows) && sets.secondOracleEntryNormalMeshes.includes(costume));
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
  await t.test('a saved evacuation prepares the real Sentinel tunnel after the timed escape', t => {
    t.after(() => { delete journey.shipLoss; delete journey.tunnel; enter('m2_departure', 0); });
    journey.shipLoss = { phase: 'evacuating', remaining: 20, lastTick: 0, attempts: 1 };
    enter('m2_ship_lost', 3);
    preview = undefined; prepare(); assert.ok(!preview);

    journey.shipLoss.phase = 'mourning';
    enter('m2_ship_lost', 4);
    sets.update(undefined, sandbox, 0);
    const floor = warm('signal-wet-floor', true) as THREE.Mesh;
    const slots = pointSlots(preview!);
    const beam = preview!.getObjectByName('hammer-rescue-beam') as THREE.SpotLight;
    assert.ok(compiled.has(floor));
    assert.equal(beam.intensity, 0);
    assert.equal(beam.visible, true);
    enter('m2_ship_lost', 4);
    assert.ok(!scene.getObjectByName(floor.name));

    journey.tunnel = { phase: 'running', remaining: 14, focus: 0, lastTick: 0, attempts: 0 };
    enter('m2_stop_sentinels', 0);
    assert.ok(scene.getObjectByName(floor.name) === floor, 'the pursuit adopts the prepared tunnel');
    assert.ok(scene.getObjectByName(beam.name) === beam);
    assert.equal(pointSlots(scene), slots);
    let disposals = 0; floor.geometry.addEventListener('dispose', () => disposals++);
    enter('m2_departure', 0);
    assert.equal(disposals, 1);
  });
  await t.test('the saved tunnel prepares the Hammer beds and brings in the finished medical cast', t => {
    t.mock.method(HeroModels.prototype, 'create', async () => undefined);
    const maggie = new THREE.Group(), fallback = new THREE.Mesh(body.geometry, body.material);
    maggie.visible = false; maggie.add(fallback); libraryCast.set('maggie', maggie);
    t.after(() => { libraryCast.delete('maggie'); });
    enter('m2_stop_sentinels', 0); preview = undefined; prepare(); assert.ok(!preview);
    enter('m2_stop_sentinels', 2); sets.update(undefined, sandbox, 0);
    const bed = warm('hammer-medical-neo', true);
    assert.ok(preview!.getObjectByName('hammer-medical-bane'));
    assert.ok(!compiled.has(fallback));
    const face = new THREE.Mesh(body.geometry, body.material); face.name = 'maggie-detailed-head';
    fallback.visible = false; maggie.add(face);
    for (let i = 0; i < 30; i++) prepare(true);
    assert.ok(compiled.has(face));
    assert.equal(maggie.visible, false);
    const pointCount = pointSlots(preview!);
    const mattress = bed.getObjectByName('medical-mattress') as THREE.Mesh;
    let disposals = 0; mattress.geometry.addEventListener('dispose', () => disposals++);
    enter('m2_stop_sentinels', 2);
    assert.equal(scene.getObjectByName(bed.name), undefined);
    enter('m2_medical', 0);
    assert.equal(scene.getObjectByName(bed.name), bed);
    assert.equal(pointSlots(scene), pointCount);
    assert.equal(sets.stablePointSlots, true);
    enter('m2_departure', 0);
    assert.equal(disposals, 1);
  });
  await t.test('a saved bedside check prepares the actual Mobil platform and hands off its reflection', t => {
    const trinity = world.agents.get('trinity')!, medical = FILM_SCENE_BY_ID.m2_medical;
    const bedside = (step: number) => {
      Object.assign(journey, { actor: trinity.id, scene: medical.id, step });
      Object.assign(trinity, { position: filmEntry(medical), isInMatrix: false, currentLocation: medical.set });
      sets.update(trinity, sandbox, 0);
    };
    t.after(() => { journey.actor = neo.id; enter('m2_departure', 0); });
    bedside(1); preview = undefined; prepare(); assert.ok(!preview);
    bedside(2); sets.update(undefined, sandbox, 0);
    const platform = warm('mobil-platform-support', true) as THREE.Mesh;
    const floorMirror = preview!.getObjectByName('mobil-polished-platform')!;
    const original = floorMirror.onBeforeRender;
    const slots = pointSlots(preview!);
    assert.ok(compiled.has(platform));
    bedside(2);
    assert.ok(!scene.getObjectByName(platform.name));

    journey.actor = neo.id;
    enter('m3_mobil', 0);
    assert.ok(scene.getObjectByName(platform.name) === platform);
    assert.ok(scene.getObjectByName(floorMirror.name) === floorMirror);
    assert.notEqual(floorMirror.onBeforeRender, original, 'the reflection uses the active player view');
    assert.equal(pointSlots(scene), slots);
    let disposals = 0; platform.geometry.addEventListener('dispose', () => disposals++);
    enter('m3_family', 0);
    assert.ok(scene.getObjectByName(platform.name) === platform);
    enter('m2_departure', 0);
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
  await t.test('a saved Trainman escape prepares and transfers the physical garage, including its wet floor and door', () => {
    enter('m3_trainman_chase', 1); preview = undefined; prepare(); assert.ok(!preview);
    enter('m3_trainman_chase', 2); sets.update(undefined, sandbox, 0);
    const floor = warm('hel-wet-floor-reflection', true) as THREE.Mesh;
    const door = preview!.getObjectByName('hel-garage-steel-door')!, slots = pointSlots(preview!);
    let disposals = 0; floor.geometry.addEventListener('dispose', () => disposals++);
    enter('m3_trainman_chase', 2);
    assert.equal(scene.getObjectByName(floor.name), undefined);
    enter('m3_hel_garage', 0);
    assert.equal(scene.getObjectByName(floor.name), floor);
    assert.equal(scene.getObjectByName(door.name), door);
    assert.ok(scene.getObjectByName('hel_garage_guard_2'));
    assert.equal(pointSlots(scene), slots);
    assert.equal(sets.stablePointSlots, true);
    assert.equal(disposals, 0);
    journey.helGarage = { ...newHelGarage(), phase: 'opening', door: .5 };
    enter('m3_hel_garage', 1);
    assert.equal(door.rotation.y, Math.PI / 4);
    delete journey.helGarage;
    enter('m2_departure', 0);
    assert.equal(disposals, 1);
  });
  await t.test('the saved Hel garage prepares the next elevator and transfers its moving cage and door', () => {
    enter('m3_hel_garage', 0); preview = undefined; prepare(); assert.ok(!preview);
    enter('m3_hel_garage', 1); sets.update(undefined, sandbox, 0);
    const cage = warm('hel-elevator-cage', true);
    const floor = cage.getObjectByName('hel-elevator-floor') as THREE.Mesh;
    const gate = cage.getObjectByName('hel-elevator-left-door')!, slots = pointSlots(preview!);
    let disposals = 0; floor.geometry.addEventListener('dispose', () => disposals++);
    enter('m3_hel_garage', 1);
    assert.equal(scene.getObjectByName(cage.name), undefined);
    journey.helElevator = { phase: 'ready', elapsed: 0, lastTick: 0, physical: true };
    enter('m3_hel_entry', 0);
    assert.equal(scene.getObjectByName(cage.name), cage);
    assert.equal(cage.position.y, HEL_ELEVATOR.upper);
    assert.equal(pointSlots(scene), slots); assert.equal(sets.stablePointSlots, true);
    Object.assign(journey.helElevator, { phase: 'descending', elapsed: 3.8 });
    enter('m3_hel_entry', 0);
    assert.equal(cage.position.y, helElevatorFloor(journey.helElevator));
    assert.equal(gate.position.x, -HEL_ELEVATOR.doorWidth / 4);
    Object.assign(journey.helElevator, { phase: 'opening', elapsed: HEL_ELEVATOR.seconds, gateElapsed: HEL_ELEVATOR.opening });
    enter('m3_hel_entry', 0);
    assert.ok(gate.position.x < -8);
    assert.equal(disposals, 0);
    delete journey.helElevator;
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
  await t.test('the saved investigation prepares the actual Logos cargo bay and its crew before the cut', () => {
    const atlas = new THREE.Texture({ width: 2048, complete: true }); atlas.needsUpdate = true;
    const knit = new THREE.Mesh(body.geometry, new THREE.MeshStandardMaterial({ map: atlas })); knit.name = 'neo-logos-sweater';
    const shadowMap = new THREE.Texture({ width: 64, complete: true });
    const shadow = new THREE.Mesh(body.geometry, new THREE.MeshBasicMaterial({ map: shadowMap, transparent: true, toneMapped: false }));
    let materialsDisposed = 0, shadowsDisposed = 0;
    knit.material.addEventListener('dispose', () => materialsDisposed++);
    shadow.material.addEventListener('dispose', () => shadowsDisposed++);
    const warmLogos = () => sets.prepareSecondOracle(graphics, camera, journey, id => id === 'neo' ? cast : undefined,
      true, undefined, () => ({ shadow, garments: () => [knit] }));
    enter('m3_maggie_discovery', 4); preview = undefined; warmLogos(); assert.ok(!preview);
    enter('m3_maggie_discovery', 5); sets.update(undefined, sandbox, 0);
    compiled.clear(); uploads.clear();
    for (let i = 0; i < 120; i++) warmLogos();
    const cargo = preview?.getObjectByName('logos-bane-cargo-bay');
    assert.ok(cargo, 'the actual Logos cargo bay must already be staged when restoring Hammer');
    assert.ok(!scene.getObjectByName(cargo.name));
    assert.ok(compiled.has(shadow), 'the shared contact shadow program must be prepared for the Logos lights');
    assert.ok(compiled.has(body) && compiled.has(knit) && uploads.has(atlas));
    const hatch = cargo.getObjectByName('logos-engineering-hatch')!, deck = hatch.children[0] as THREE.Mesh;
    const slots = pointSlots(preview!);
    let disposals = 0; deck.geometry.addEventListener('dispose', () => disposals++);
    enter('m3_maggie_discovery', 5); assert.ok(!scene.getObjectByName(cargo.name));
    enter('m3_bane', 0);
    assert.equal(scene.getObjectByName(cargo.name), cargo);
    assert.equal(scene.getObjectByName(hatch.name), hatch); assert.equal(hatch.rotation.z, 0);
    assert.equal(pointSlots(scene), slots); assert.equal(sets.stablePointSlots, true);
    assert.equal(sets.minimumPointSlots, slots);
    journey.bane = { phase: 'defeated', elapsed: 0, attempts: 0, checkpoint: 'blind', hits: 2, focus: 0, counters: 2, lastStrike: -1 };
    enter('m3_bane', 3); assert.ok(hatch.rotation.z > 1);
    delete journey.bane;
    enter('m2_departure', 0); assert.equal(disposals, 1); assert.equal(materialsDisposed, 1);
    assert.equal(shadowsDisposed, 0);
    atlas.dispose(); shadow.material.dispose(); shadowMap.dispose();
  });
  await t.test('the Logos rescue prepares the actual Hammer cockpit and its late crew before the cut', () => {
    const niobe = new THREE.Group(); niobe.visible = false;
    const head = new THREE.Mesh(body.geometry, body.material); head.name = 'niobe-detailed-head';
    const atlas = new THREE.Texture({ width: 2048, complete: true }); atlas.needsUpdate = true;
    const uniform = new THREE.Mesh(body.geometry, new THREE.MeshStandardMaterial({ map: atlas })); uniform.name = 'niobe-detailed-body';
    const knit = new THREE.Mesh(body.geometry, new THREE.MeshStandardMaterial()); knit.name = 'morpheus-hammer-sweater';
    const shadow = new THREE.Mesh(body.geometry, new THREE.MeshBasicMaterial({ transparent: true, toneMapped: false }));
    const warmHammer = () => sets.prepareSecondOracle(graphics, camera, journey,
      id => id === 'niobe' ? niobe : id === 'morpheus' ? cast : undefined, true, undefined,
      id => id === 'niobe' ? { shadow } : { garments: () => [knit] });
    enter('m3_bane', 1); preview = undefined; warmHammer(); assert.ok(!preview);
    enter('m3_bane', 2); sets.update(undefined, sandbox, 0);
    compiled.clear(); uploads.clear();
    for (let i = 0; i < 120; i++) warmHammer();
    const cockpit = preview?.getObjectByName('hammer-cockpit');
    assert.ok(cockpit, 'the actual Hammer cockpit must be staged during the Logos rescue');
    assert.ok(!scene.getObjectByName(cockpit.name));
    assert.ok(compiled.has(knit) && compiled.has(shadow));
    niobe.add(head, uniform);
    for (let i = 0; i < 20; i++) warmHammer();
    assert.ok(compiled.has(head) && compiled.has(uniform) && uploads.has(atlas));
    const door = cockpit.getObjectByName('hammer-aft-door') as THREE.Mesh;
    const slots = pointSlots(preview!);
    let disposals = 0; door.geometry.addEventListener('dispose', () => disposals++);
    enter('m3_bane', 2);
    enter('m3_hammer_tunnels', 0);
    assert.equal(scene.getObjectByName(cockpit.name), cockpit);
    assert.equal(pointSlots(scene), slots);
    assert.ok(Math.abs(door.rotation.y) > 1);
    journey.hammerHandover = { phase: 'ready', elapsed: 16.8, station: true };
    enter('m3_hammer_tunnels', 2);
    assert.equal(Math.abs(door.rotation.y), 0);
    delete journey.hammerHandover;
    enter('m2_departure', 0); assert.equal(disposals, 1);
    uniform.material.dispose(); atlas.dispose(); shadow.material.dispose();
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

test('the tea house and library render their occupants and leave actors elsewhere offstage', t => {
  const previous = globalThis.document;
  const context = { fillRect() {}, strokeRect() {}, fillText() {}, putImageData() {}, createRadialGradient: () => ({ addColorStop() {} }),
    createImageData: (w: number, h: number) => ({ data: new Uint8ClampedArray(w * h * 4) }) };
  globalThis.document = { createElement: () => ({ getContext: () => context }) } as unknown as Document;
  t.after(() => { globalThis.document = previous; });
  t.mock.method(THREE.TextureLoader.prototype, 'load', () => new THREE.Texture());
  t.mock.method(HeroModels.prototype, 'create', async () => undefined);
  t.mock.method(CharacterModels.prototype, 'animate', () => {});
  const renderer = new AgentRenderer(new THREE.Scene()), world = new WorldState();
  t.after(() => renderer.dispose());
  new AgentManager(world).initializeAllAgents();
  const tea = FILM_SCENE_BY_ID.m2_seraph, hotel = FILM_SCENE_BY_ID.m1_room303;
  for (const [id, beat] of [['neo', tea], ['seraph', tea], ['agent_jones', hotel]] as const) {
    const state = world.agents.get(id)!;
    Object.assign(state, { position: filmEntry(beat), currentLocation: beat.set, isInMatrix: true });
    renderer.updateAgent(id, state);
  }
  renderer.setPlayer('neo');
  const journey: FilmJourney = { version: 1, scene: tea.id, actor: 'neo', step: 0, completed: ['m2_departure'],
    enteredAt: 0, checkpoint: filmEntry(tea), reflections: {}, lastText: '' };
  renderer.update(.02, undefined, 1, 0, journey);
  assert.equal(renderer.getAgent('neo')!.visible, true);
  assert.equal(renderer.getAgent('seraph')!.visible, true);
  assert.equal(renderer.getAgent('agent_jones')!.visible, false);

  renderer.update(.02);
  assert.equal(renderer.getAgent('agent_jones')!.visible, true);

  const library = FILM_SCENE_BY_ID.m2_library;
  for (const id of ['neo', 'keymaker']) {
    const state = world.agents.get(id)!;
    Object.assign(state, { position: filmEntry(library), currentLocation: library.set, isInMatrix: true });
    renderer.updateAgent(id, state);
  }
  Object.assign(journey, { scene: library.id, checkpoint: filmEntry(library) });
  renderer.update(.02, undefined, 1, 0, journey);
  assert.equal(renderer.getAgent('neo')!.visible, true);
  assert.equal(renderer.getAgent('keymaker')!.visible, true);
  assert.equal(renderer.getAgent('agent_jones')!.visible, false, 'an actor outside the library must not enter its draw lists');

  renderer.update(.02);
  assert.equal(renderer.getAgent('agent_jones')!.visible, true);
});

test('the courtyard flight prepares one hidden Le Vrai companion per frame', t => {
  const previous = globalThis.document;
  const context = { fillRect() {}, strokeRect() {}, fillText() {}, putImageData() {}, createRadialGradient: () => ({ addColorStop() {} }),
    createImageData: (w: number, h: number) => ({ data: new Uint8ClampedArray(w * h * 4) }) };
  globalThis.document = { createElement: () => ({ getContext: () => context }) } as unknown as Document;
  t.after(() => { globalThis.document = previous; });
  t.mock.method(THREE.TextureLoader.prototype, 'load', () => new THREE.Texture());
  t.mock.method(HeroModels.prototype, 'create', async () => undefined);
  t.mock.method(CharacterModels.prototype, 'animate', () => {});
  const prepared: string[] = [];
  t.mock.method(CharacterModels.prototype, 'prepareHiddenHero', (hero: NonNullable<CharacterRig['hero']>) => prepared.push(hero.root.name));
  const renderer = new AgentRenderer(new THREE.Scene()), world = new WorldState();
  t.after(() => renderer.dispose());
  new AgentManager(world).initializeAllAgents();
  const checkpoint = filmEntry(FILM_SCENE_BY_ID.m2_burly);
  const journey: FilmJourney = { version: 1, scene: 'm2_burly', actor: 'neo', step: 1, completed: [],
    enteredAt: 0, checkpoint, reflections: {}, lastText: '',
    burly: { phase: 'flight_ready', elapsed: 0, attempt: 1, repelled: 2, staffSwings: 3, assimilation: 0, nextCopyAt: 0 } };
  const companions = ['morpheus', 'trinity'];
  for (const id of companions) {
    const state = world.agents.get(id)!;
    Object.assign(state, { position: filmEntry(FILM_SCENE_BY_ID.m2_departure), currentLocation: 'film_zion_hangar', isInMatrix: false });
    renderer.updateAgent(id, state);
    const rig = renderer['agents'].get(id)!.rig, root = new THREE.Group(); root.name = id;
    rig.hero = { root, bones: new Map() } as NonNullable<CharacterRig['hero']>;
    rig.detail.visible = false;
  }
  renderer.setPlayer('neo');
  renderer.update(.02, undefined, 0, 1, journey);
  assert.deepEqual(prepared, []);
  journey.burly!.phase = 'flight';
  const morpheus = world.agents.get('morpheus')!;
  morpheus.controller = 'another-player';
  renderer.update(.02, undefined, 0, 1, journey);
  assert.deepEqual(prepared, ['trinity']);
  morpheus.controller = null;
  renderer.update(.02, undefined, 0, 1, journey);
  renderer.update(.02, undefined, 0, 1, journey);
  assert.deepEqual(prepared, ['trinity', 'morpheus']);
  assert(companions.every(id => !renderer.getAgent(id)!.visible));
});

test('a paused courtyard save restores the Oracle against the actual bench and floor', t => {
  const previous = globalThis.document;
  const context = { fillRect() {}, strokeRect() {}, fillText() {}, putImageData() {}, createRadialGradient: () => ({ addColorStop() {} }),
    createImageData: (w: number, h: number) => ({ data: new Uint8ClampedArray(w * h * 4) }) };
  globalThis.document = { createElement: () => ({ getContext: () => context }) } as unknown as Document;
  t.after(() => { globalThis.document = previous; });
  t.mock.method(THREE.TextureLoader.prototype, 'load', () => new THREE.Texture());
  t.mock.method(GLTFLoader.prototype, 'loadAsync', () => new Promise(() => {}));
  const scene = new THREE.Scene(), renderer = new AgentRenderer(scene), sets = new FilmSetRenderer(scene), world = new WorldState();
  t.after(() => { renderer.dispose(); sets.dispose(); });
  new AgentManager(world).initializeAllAgents();
  const beat = FILM_SCENE_BY_ID.m2_bench, neo = world.agents.get('neo')!, oracle = world.agents.get('oracle')!;
  const { bench, oracle: chair } = SERAPH_ORACLE.yard;
  Object.assign(neo, { position: filmPosition(beat.set, bench.x, bench.z), currentLocation: beat.set, isInMatrix: true });
  Object.assign(oracle, { position: filmPosition(beat.set, chair.x, chair.z), currentLocation: beat.set, isInMatrix: true, rotation: 0,
    currentAction: { type: 'idle', parameters: { seated: true }, startedAt: 0, duration: 100000, progress: .01 } });
  const journey: FilmJourney = { version: 1, scene: beat.id, actor: 'neo', step: 1, completed: ['m2_backdoors'],
    enteredAt: 0, checkpoint: neo.position, reflections: {}, lastText: '' };
  const sandbox = { neoLife: { journey } } as SandboxState, camera = new THREE.PerspectiveCamera();
  camera.position.set(neo.position.x, neo.position.y + 2, neo.position.z);
  renderer.updateAgent('neo', neo); renderer.updateAgent('oracle', oracle); renderer.setPlayer('neo');
  sets.update(neo, sandbox, 0); renderer.update(0, camera, 0, 0, journey); scene.updateMatrixWorld(true);
  const rig = renderer['agents'].get('oracle')!.rig, point = new THREE.Vector3();
  const down = new THREE.Raycaster(new THREE.Vector3(), new THREE.Vector3(0, -1, 0));
  const floor = sets.root.position.y;
  const topAt = (x: number, z: number) => {
    down.ray.origin.set(x, floor + 3, z);
    return down.intersectObject(sets.root, true)[0]?.point.y ?? floor;
  };
  assert.equal(rig.motion.seated, 1, 'the first paused frame must honor the saved seated action');
  for (let i = 0; i < rig.hips.length; i++) {
    const hip = rig.hips[i].getWorldPosition(new THREE.Vector3()), knee = rig.knees[i].getWorldPosition(new THREE.Vector3());
    const seat = topAt(hip.x, hip.z);
    assert.ok(hip.y - seat > .19 && hip.y - seat < .32);
    assert.ok(knee.z - hip.z > .75 && topAt(knee.x, knee.z) < seat - .45, 'the knees clear the front slat');
    assert.ok(Math.abs(new THREE.Box3().setFromObject(rig.ankles[i], true).min.y - floor) < .03, 'the shoes rest on the floor');
    const trousers = rig.hips[i].children.find(object => object instanceof THREE.SkinnedMesh) as THREE.SkinnedMesh;
    const positions = trousers.geometry.getAttribute('position');
    let lowest = Infinity;
    for (let vertex = 0; vertex < positions.count; vertex++) {
      if (positions.getY(vertex) < -.58) continue;
      trousers.localToWorld(trousers.getVertexPosition(vertex, point));
      if (Math.abs(topAt(point.x, point.z) - seat) < .01) lowest = Math.min(lowest, point.y - seat);
    }
    assert.ok(lowest > -.025 && lowest < .07, `the upper leg sits on the slats with ${lowest} clearance`);
  }

  oracle.currentAction = null;
  renderer.updateAgent('oracle', oracle);
  for (let i = 0; i < 75; i++) renderer.update(.016, camera, 1, 1, journey);
  assert.ok(rig.motion.seated < .01, 'clearing the seated action releases the pose for departure');
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

test('the château landing prepares each upper guard with its weapon before the world starts the fight', t => {
  const previous = globalThis.document;
  const context = { fillRect() {}, strokeRect() {}, fillText() {}, putImageData() {}, createRadialGradient: () => ({ addColorStop() {} }),
    createImageData: (w: number, h: number) => ({ data: new Uint8ClampedArray(w * h * 4) }) };
  globalThis.document = { createElement: () => ({ getContext: () => context }) } as unknown as Document;
  t.after(() => { globalThis.document = previous; });
  t.mock.method(THREE.TextureLoader.prototype, 'load', () => new THREE.Texture());
  const created: CharacterRig[] = [], weapons: string[] = [];
  t.mock.method(CharacterModels.prototype, 'create', () => {
    const rig = { root: new THREE.Group(), motion: newMotion() } as CharacterRig;
    created.push(rig); return rig;
  });
  t.mock.method(CharacterModels.prototype, 'animate', (_rig, _delta, input) => { if (input.chateauWeapon) weapons.push(input.chateauWeapon); });
  const scene = new THREE.Scene(), sandbox = new SandboxRenderer(scene), world = new WorldState();
  t.after(() => sandbox.dispose());
  new AgentManager(world).initializeAllAgents();
  const neo = world.agents.get('neo')!, beat = FILM_SCENE_BY_ID.m2_chateau;
  Object.assign(neo, { position: filmEntry(beat), currentLocation: beat.set, isInMatrix: true });
  const journey: FilmJourney = { version: 1, scene: beat.id, actor: 'neo', step: 0, enteredAt: 0, completed: [],
    checkpoint: neo.position, reflections: {}, lastText: '', chateau: { phase: 'ready', wave: 1, parries: 2, disarms: 2, attempts: 1, wounded: true } };
  const sync = (threats: SandboxThreat[]) => sandbox.sync({ threats, nodes: [], structures: [], incidents: [], missions: {}, neoLife: { journey } } as SandboxState,
    Object.fromEntries(world.agents));
  const camera = new THREE.PerspectiveCamera();
  const frame = () => sandbox.update(.02, camera, true, 20, true, neo);
  sync([]); frame();
  assert.deepEqual(created, []);
  journey.chateau!.phase = 'landing';
  const saved = structuredClone(journey);
  frame();
  assert.equal(created.length, 1, 'prepare only one guard in a frame');
  frame(); frame();
  assert.deepEqual(weapons, ['spear', 'axe']);
  assert(created.every(rig => rig.root.parent && !rig.root.parent.parent), 'the prepared guards stay outside the rendered scene');
  assert.deepEqual(journey, saved);
  Object.assign(journey.chateau!, { phase: 'duel', wave: 2 });
  sync(CHATEAU.waves[1].map(({ weapon, x, z }) => ({ id: weapon, scene: beat.id, kind: 'agent', weapon, matrix: true,
    position: filmPosition(beat.set, x, z), health: 88, maxHealth: 88, target: neo.id, stunUntil: 22, lastStrike: 20 })));
  assert.equal(created.length, 2, 'the actual wave takes the two prepared models');
  assert(created.every(rig => rig.root.parent?.parent === scene));
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
