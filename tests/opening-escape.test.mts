import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from 'three';
import { createHash } from 'node:crypto';
import { FILM_SCENE_BY_ID, FILM_SETS, OPENING_ESCAPE, OPENING_HOTEL, filmEntry, type FilmJourney, type SandboxState } from '@auto_matrix/shared';
import { FilmSetRenderer } from '../packages/client/src/engine/FilmSetRenderer.js';
import { AgentRenderer } from '../packages/client/src/agents/AgentRenderer.js';
import { WorldState } from '../packages/server/src/world/WorldState.js';
import { AgentManager } from '../packages/server/src/agents/AgentManager.js';
import { OpeningHotelSystem } from '../packages/server/src/story/OpeningHotelSystem.js';
import { advanceMotion, newMotion } from '../packages/client/src/agents/CharacterMotion.js';
import { actor } from './helpers/fighting-hand-fixture.mts';

test('the complete Trinity exit surfaces remain identical after a cold join', async t => {
  const warm = await actor('trinity'), cold = await actor('trinity'); t.after(() => { warm.models.dispose(); cold.models.dispose(); });
  const history = newMotion(), idle = { speed: 0, grounded: true, verticalVelocity: 0, turn: 0 };
  for (let frame = 0; frame < 30; frame++) { const walking = { ...idle, speed: 8.4, turn: .8 }; warm.models.animate(warm.rig, advanceMotion(history, walking, .02), history, walking, .02); }
  const surface = (root: THREE.Group) => {
    root.updateMatrixWorld(true); const result: { name: string; points: string }[] = [], point = new THREE.Vector3();
    root.traverseVisible(object => {
      if (!(object instanceof THREE.Mesh)) return; if (object instanceof THREE.SkinnedMesh) object.skeleton.update();
      const points = new Float64Array(object.geometry.attributes.position.count * 3);
      for (let id = 0; id < points.length / 3; id++) object.localToWorld(object.getVertexPosition(id, point)).toArray(points, id * 3);
      result.push({ name: object.name, points: createHash('sha256').update(new Uint8Array(points.buffer)).digest('hex') });
    }); return result;
  };
  for (const elapsed of [.7, 1.8, 2.5, 3]) {
    const input = { ...idle, speed: elapsed < 1.4 ? 5.8 : 0, roofExit: { elapsed, origin: { x: 4416, y: 1, z: 4058 } },
      ...(elapsed >= 1.4 ? { hotel303: { phase: 'dive' as const, elapsed: elapsed - 1.4 } } : {}) }, fresh = newMotion();
    warm.models.animate(warm.rig, advanceMotion(history, input, 0), history, input, 0);
    cold.models.animate(cold.rig, advanceMotion(fresh, input, 0), fresh, input, 0);
    assert.deepEqual(surface(warm.rig.root), surface(cold.rig.root), `${elapsed}: the body or clothing changed after re-entry`);
  }
});

test('saved rooftop run-up and dive poses do not depend on earlier walking or combat', () => {
  for (const elapsed of [.7, 1.8, 2.5, 3]) {
    const warm = newMotion();
    for (let frame = 0; frame < 30; frame++) advanceMotion(warm, { speed: 8.4, grounded: true, verticalVelocity: 0, turn: .8 }, .02);
    advanceMotion(warm, { speed: 0, grounded: true, verticalVelocity: 0, turn: 0, attack: 2, combo: 1 }, .02);
    const input = { speed: elapsed < 1.4 ? 5.8 : 0, grounded: elapsed < 1.4, verticalVelocity: 0, turn: 0,
      roofExit: { elapsed, origin: { x: 4416, y: 1, z: 4058 } }, ...(elapsed >= 1.4 ? { hotel303: { phase: 'dive' as const, elapsed: elapsed - 1.4 } } : {}) };
    const cold = advanceMotion(newMotion(), input, 0);
    assert.deepEqual(advanceMotion(warm, input, 0), cold, `${elapsed}: a cold join must retain the saved exit pose`);
    assert.deepEqual(advanceMotion(warm, input, .1), cold, `${elapsed}: the renderer must not advance the saved exit`);
  }
});

test('the roof exit opens a real window while retaining the wall and an exterior landing', t => {
  t.mock.method(THREE.TextureLoader.prototype, 'load', () => new THREE.Texture());
  const document = globalThis.document;
  globalThis.document = { createElement: () => ({ width: 0, height: 0, getContext: () => ({ fillRect() {}, strokeRect() {}, fillText() {} }) }) } as unknown as Document;
  const world = new WorldState(); new AgentManager(world).initializeAllAgents(); const player = world.agents.get('trinity')!;
  const film = FILM_SCENE_BY_ID.m1_roofs, center = FILM_SETS[film.set].center;
  const journey = { version: 1, scene: film.id, actor: player.id, step: 2, completed: [], enteredAt: 0,
    reflections: {}, lastText: '', checkpoint: filmEntry(film), openingRoof: { phase: 'running', lastTick: 0, attempts: 0 } } as FilmJourney;
  const sandbox = { neoLife: { journey }, structures: [] } as unknown as SandboxState;
  const scene = new THREE.Scene(); scene.background = new THREE.Color(); scene.fog = new THREE.FogExp2(0, .01); const renderer = new FilmSetRenderer(scene);
  try {
    player.position = filmEntry(film); player.currentLocation = film.set; player.isInMatrix = true; renderer.update(player, sandbox, 0);
    const pane = renderer.root.getObjectByName('opening-roof-window-glass'), shards = renderer.root.getObjectByName('opening-roof-window-shards');
    assert.ok(pane && shards, 'the roof window needs saved intact and broken states');
    assert.equal(pane.visible, true); assert.equal(shards.visible, false);
    player.currentAction = { type: 'move_to', parameters: { resolved: true, roofExit: { elapsed: 1.7, origin: filmEntry(film) } }, startedAt: 0, duration: 1e9, progress: 0 };
    renderer.update(player, sandbox, .5); assert.equal(pane.visible, false, 'the pane and crossbars must break before the leading body reaches them');
    player.currentAction = { type: 'move_to', parameters: { resolved: true, roofExit: { elapsed: 2.2, origin: filmEntry(film) } }, startedAt: 0, duration: 1e9, progress: 0 };
    renderer.update(player, sandbox, 1); renderer.root.updateMatrixWorld(true);
    assert.equal(pane.visible, false); assert.equal(shards.visible, true);
    const ray = (x: number, y = 3) => new THREE.Raycaster(new THREE.Vector3(center.x + x, center.y + y, center.z - 47), new THREE.Vector3(0, 0, -1), 0, 5).intersectObjects(renderer.root.children, true).filter(hit => {
      let visible = hit.object.visible; hit.object.traverseAncestors(parent => { visible &&= parent.visible; }); return visible;
    });
    assert.equal(ray(2).length, 0, 'the broken window must not conceal an opaque wall');
    for (const y of [.5, 1.5, 2]) assert.equal(ray(2, y).length, 0, 'the rear parapet must not block the lower opening');
    assert.ok(ray(9).length > 0, 'the opaque wall beside the window must remain');
    const floor = new THREE.Raycaster(new THREE.Vector3(center.x, center.y + 3, center.z - 52.2), new THREE.Vector3(0, -1, 0), 0, 5).intersectObjects(renderer.root.children, true)[0];
    assert.ok(floor && Math.abs(floor.point.y - (center.y - 1.35)) < .05, 'the dive must end on the exterior landing');
  } finally { renderer.dispose(); globalThis.document = document; }
});

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
    const roofPart = renderer.root.getObjectByName('opening-booth-roof')!;
    assert.ok(roofPart.position.y < 1 && glass.visible, 'connected escape leaves the detached roof and broken glass on the road');
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

test('Trinity’s visible climb clears the 303 platform up to the standing pose', async t => {
  const { models, rig } = await actor('trinity'); t.after(() => models.dispose());
  const world = new WorldState(); new AgentManager(world).initializeAllAgents();
  const trinity = world.agents.get('trinity')!, scene = FILM_SCENE_BY_ID.m1_room303;
  const { center } = FILM_SETS[scene.set], { ladderHeight, ladderZ, landing } = OPENING_HOTEL;
  const journey: FilmJourney = { version: 1, scene: scene.id, actor: trinity.id, step: 5, completed: [], enteredAt: 0,
    reflections: {}, lastText: '', checkpoint: filmEntry(scene), openingHotel: { phase: 'climbing', elapsed: 0, lastTick: 0, attempts: 0, disarmed: true, ammo: 0, shots: 0 } };
  const system = new OpeningHotelSystem(() => ({ neoLife: { journey } }) as unknown as SandboxState);
  const body = new THREE.Group(); body.rotation.y = Math.PI; body.add(rig.root);
  const deck = new THREE.Box3(new THREE.Vector3(-landing.width / 2 + .02, ladderHeight + .02, ladderZ + landing.offsetZ - landing.depth / 2 + .02),
    new THREE.Vector3(landing.width / 2 - .02, ladderHeight + landing.thickness - .02, ladderZ + landing.offsetZ + landing.depth / 2 - .02));
  const point = new THREE.Vector3();
  for (const climbed of [0, 2.1, 3.55, 4.2, 4.8, 5.3, 5.8, 6, 6.25, 6.5, 6.75, 6.95, ladderHeight]) {
    journey.openingHotel!.phase = climbed === ladderHeight ? 'done' : 'climbing';
    journey.openingHotel!.climbed = climbed; system.frame(trinity);
    body.position.set(trinity.position.x - center.x, trinity.position.y - center.y, trinity.position.z - center.z);
    const motion = newMotion(), input = { speed: 0, grounded: true, verticalVelocity: 0, turn: 0, climbing: climbed === ladderHeight ? undefined : 0, hotelClimb: climbed };
    models.animate(rig, advanceMotion(motion, input, 0), motion, input, 0); body.updateMatrixWorld(true);
    let inspected = 0, inside = 0, soles = Infinity;
    rig.root.traverseVisible(mesh => {
      if (!(mesh instanceof THREE.SkinnedMesh)) return;
      mesh.skeleton.update();
      for (let vertex = 0; vertex < mesh.geometry.attributes.position.count; vertex++) {
        mesh.localToWorld(mesh.getVertexPosition(vertex, point)); inspected++;
        if (deck.containsPoint(point)) inside++;
        soles = Math.min(soles, point.y);
      }
    });
    assert.ok(inspected > 1000);
    assert.equal(inside, 0, `${climbed}: Trinity intersects the upper deck at ${inside} rendered vertices`);
    if (climbed === ladderHeight) assert.ok(Math.abs(soles - ladderHeight - landing.thickness) < .05, 'the finished shoes must meet the deck');
  }
});

test('the caller disappears from the booth after the line connects and returns on retry', t => {
  t.mock.method(THREE.TextureLoader.prototype, 'load', () => new THREE.Texture());
  const originalDocument = globalThis.document;
  const context = { createRadialGradient: () => ({ addColorStop() {} }), fillRect() {}, strokeRect() {}, fillText() {},
    createImageData: (width: number, height: number) => ({ data: new Uint8ClampedArray(width * height * 4) }), putImageData() {} };
  globalThis.document = { createElement: () => ({ width: 0, height: 0, getContext: () => context }) } as unknown as Document;
  const world = new WorldState(); new AgentManager(world).initializeAllAgents();
  const caller = world.agents.get('citizen_1')!; const scene = new THREE.Scene();
  const renderer = new AgentRenderer(scene); renderer.updateAgent(caller.id, caller); renderer.setPlayer(caller.id);
  const film = FILM_SCENE_BY_ID.m1_phone_escape;
  const journey: FilmJourney = { version: 1, scene: film.id, actor: caller.id, step: 2, completed: [film.id], enteredAt: 0,
    reflections: {}, lastText: '', checkpoint: filmEntry(film), openingPhone: { phase: 'running', remaining: 4, lastTick: 0, attempts: 0 } };
  const body = renderer.getAgent(caller.id)!;
  try {
    renderer.update(.016, undefined, 1, 0, journey); assert.equal(body.visible, true);
    journey.openingPhone!.phase = 'connected'; renderer.update(.016, undefined, 1, 0, journey);
    assert.equal(body.visible, false, 'the truck must strike an empty booth after Trinity exits');
    journey.openingPhone!.phase = 'done'; renderer.update(.016, undefined, 1, 0, journey); assert.equal(body.visible, false);
    journey.openingPhone!.phase = 'running'; renderer.update(.016, undefined, 1, 0, journey);
    assert.equal(body.visible, true, 'retry restores a visible playable actor');
    const answer = { elapsed: 1.1, origin: { x: -.55, y: 0, z: -28.85 }, yaw: Math.PI };
    journey.openingPhone = { phase: 'failed', remaining: 0, impactElapsed: .1, lastTick: 0, attempts: 0, answer };
    renderer.setPlayer(caller.id, true); renderer.setPlayerMotion({ speed: 0, grounded: true, verticalVelocity: 0, turn: 0, firstPerson: true, openingAnswer: answer });
    let renderedFirstPerson: boolean | undefined;
    t.mock.method((renderer as any).models, 'animate', (_rig: unknown, _delta: number, input: { firstPerson?: boolean }) => { renderedFirstPerson = input.firstPerson; });
    renderer.update(.016, undefined, 1, 0, journey);
    assert.equal(renderer.getAgentBody(caller.id)!.visible, true, 'the failed exterior must show the caller even when V selects first person');
    assert.equal(renderedFirstPerson, false, 'the exterior must draw the complete caller rather than a first person cutout');
  } finally { renderer.dispose(); globalThis.document = originalDocument; }
});
