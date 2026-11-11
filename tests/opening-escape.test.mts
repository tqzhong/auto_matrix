import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from 'three';
import { createHash } from 'node:crypto';
import { FILM_SCENE_BY_ID, FILM_SETS, OPENING_ESCAPE, OPENING_HOTEL, filmEntry, openingHotelClimbPose, openingHotelDivePose, type FilmJourney, type SandboxState } from '@auto_matrix/shared';
import { FilmSetRenderer } from '../packages/client/src/engine/FilmSetRenderer.js';
import { AgentRenderer } from '../packages/client/src/agents/AgentRenderer.js';
import { WorldState } from '../packages/server/src/world/WorldState.js';
import { AgentManager } from '../packages/server/src/agents/AgentManager.js';
import { OpeningHotelSystem } from '../packages/server/src/story/OpeningHotelSystem.js';
import { advanceMotion, newMotion } from '../packages/client/src/agents/CharacterMotion.js';
import { actor, fingerGroups } from './helpers/fighting-hand-fixture.mts';

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

test('303 bracing and landing lead into the first rung instead of holding an airborne pose', () => {
  const frame = (elapsed: number) => advanceMotion(newMotion(), {
    speed: 0, grounded: true, verticalVelocity: 0, turn: 0, hotel303: { phase: 'dive', elapsed },
  }, 0);
  const flight = frame(.85), landing = frame(1.72), ready = frame(2.24);
  assert.ok(flight.lean > .5, 'Trinity leads with her covered head and shoulders in the air');
  assert.ok(landing.legs.every(leg => leg.knee > .65), 'both knees absorb the landing');
  assert.ok(landing.hipHeight < flight.hipHeight - .2, 'the landing compresses the body');
  assert.ok(ready.hipHeight > landing.hipHeight + .25, 'the body rises into the ladder reach');
});

test('Trinity meets the 303 pane and balcony with the rendered body and reaches the saved rung pose', async t => {
  const { models, rig } = await actor('trinity'); t.after(() => models.dispose());
  const { center } = FILM_SETS.film_heart_hotel, { lowerDeck, roomDive, window } = OPENING_HOTEL;
  const floor = lowerDeck.y + lowerDeck.thickness / 2;
  const body = new THREE.Group(), point = new THREE.Vector3(); body.add(rig.root);
  const from = { position: { x: .95, y: 0, z: -22.1 }, yaw: Math.PI - .24 };
  const sample = (elapsed: number, onLadder = false) => {
    const root = onLadder ? { ...openingHotelClimbPose(0), x: 0, yaw: Math.PI } : openingHotelDivePose(elapsed, from);
    body.position.set(center.x + root.x, center.y - 1 + root.y, center.z + root.z); body.rotation.y = root.yaw;
    const input = { speed: 0, grounded: true, verticalVelocity: 0, turn: 0,
      ...(onLadder ? { hotelClimb: 0 } : { hotel303: { phase: 'dive' as const, elapsed } }) };
    const motion = newMotion(); models.animate(rig, advanceMotion(motion, input, 0), motion, input, 0); body.updateMatrixWorld(true);
    let leading = Infinity, sole = Infinity, inside = 0;
    rig.root.traverseVisible(mesh => {
      if (!(mesh instanceof THREE.SkinnedMesh)) return;
      mesh.skeleton.update();
      for (let index = 0; index < mesh.geometry.attributes.position.count; index++) {
        mesh.localToWorld(mesh.getVertexPosition(index, point));
        const x = point.x - center.x, y = point.y - center.y + 1, z = point.z - center.z;
        if (Math.abs(x) < 3.8 && y >= .15 && y <= 7.35) leading = Math.min(leading, z);
        if (mesh.name === 'shoes01') sole = Math.min(sole, y);
        if (Math.abs(x) < lowerDeck.width / 2 && Math.abs(z - lowerDeck.z) < lowerDeck.depth / 2
          && y < floor - .025 && y > floor - lowerDeck.thickness) inside++;
      }
    });
    const bones = ['pelvis', 'wrist_R', 'wrist_L', 'ankle_R', 'ankle_L'].map(name => rig.bones.get(name)!.getWorldPosition(new THREE.Vector3()));
    return { leading, sole, inside, bones };
  };
  assert.ok(sample(roomDive.glass - .015).leading > window.paneZ + .035, 'the intact pane must still be clear of Trinity');
  assert.ok(Math.abs(sample(roomDive.glass).leading - window.paneZ) < .09, 'the glass breaks as Trinity reaches it');
  for (const elapsed of [roomDive.launch, roomDive.land]) {
    const before = sample(elapsed - .001), after = sample(elapsed + .001);
    assert.ok(before.bones[0].distanceTo(after.bones[0]) < .04, 'pelvis must move continuously through takeoff and landing');
  }
  const landing = sample(roomDive.land + .12);
  assert.ok(Math.abs(landing.sole - floor) < .03, 'the boots must touch the lower platform during the landing');
  for (const elapsed of [1.6, 1.72, 1.81, 1.9, 2, 2.1, roomDive.ready]) assert.equal(sample(elapsed).inside, 0);
  const reaching = sample(roomDive.ready), onLadder = sample(roomDive.ready, true);
  reaching.bones.forEach((bone, i) => assert.ok(bone.distanceTo(onLadder.bones[i]) < 1e-6));
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
    const { ladderZ, ladderRails } = OPENING_HOTEL;
    const rail = new THREE.Raycaster(new THREE.Vector3(center.x + ladderRails.x, center.y - 1 + ladderRails.top, center.z + ladderZ + .1), new THREE.Vector3(0, 0, -1), 0, .75)
      .intersectObjects(renderer.root.children, true);
    assert.ok(rail.length > 0, 'the upper handrail must be part of the visible ladder');
    assert.equal(glass.visible, false); assert.equal(shards.visible, true);
    const fragments = () => shards.children.map(piece => piece.position.toArray());
    const falling = fragments();
    journey.openingHotel!.elapsed = .95; renderer.update(player, sandbox, .4);
    assert.ok(fragments().some((point, i) => point[1] < falling[i][1] - .25 && point[2] < falling[i][2] - .15), 'the glass falls out of the window');
    journey.openingHotel!.elapsed = .7; renderer.update(player, sandbox, .8);
    assert.deepEqual(fragments(), falling, 'the saved dive clock reconstructs the same fragments');
    journey.openingHotel!.phase = 'ladder_ready'; journey.step = 5;
    renderer.update(player, sandbox, 1);
    assert.equal(glass.visible, false); assert.equal(shards.visible, true);
    const { lowerDeck } = OPENING_HOTEL, floor = lowerDeck.y + lowerDeck.thickness / 2;
    assert.ok(fragments().every(point => Math.abs(point[1] - floor) < .04), 'the fragments settle on the lower platform');
  } finally { renderer.dispose(); globalThis.document = document; }
});

test('Trinity’s visible climb holds the 303 rungs and clears the upper platform', async t => {
  const { models, rig } = await actor('trinity'); t.after(() => models.dispose());
  const world = new WorldState(); new AgentManager(world).initializeAllAgents();
  const trinity = world.agents.get('trinity')!, scene = FILM_SCENE_BY_ID.m1_room303;
  const { center } = FILM_SETS[scene.set], { ladderHeight, ladderZ, ladderRungs, ladderRails, landing } = OPENING_HOTEL;
  const journey: FilmJourney = { version: 1, scene: scene.id, actor: trinity.id, step: 5, completed: [], enteredAt: 0,
    reflections: {}, lastText: '', checkpoint: filmEntry(scene), openingHotel: { phase: 'climbing', elapsed: 0, lastTick: 0, attempts: 0, disarmed: true, ammo: 0, shots: 0 } };
  const system = new OpeningHotelSystem(world, () => ({ neoLife: { journey } }) as unknown as SandboxState);
  const origin = new THREE.Vector3(center.x, center.y - 1, center.z);
  const body = new THREE.Group(); body.rotation.y = Math.PI; body.add(rig.root);
  const deck = new THREE.Box3(new THREE.Vector3(-landing.width / 2 + .02, ladderHeight + .02, ladderZ + landing.offsetZ - landing.depth / 2 + .02),
    new THREE.Vector3(landing.width / 2 - .02, ladderHeight + landing.thickness - .02, ladderZ + landing.offsetZ + landing.depth / 2 - .02));
  const rungs: THREE.Box3[] = [];
  const halfRung = new THREE.Vector3(ladderRungs.width, ladderRungs.height, ladderRungs.depth).multiplyScalar(.5);
  for (let y = ladderRungs.bottom; y < ladderHeight; y += ladderRungs.spacing) {
    const center = new THREE.Vector3(0, y, ladderZ + ladderRungs.offsetZ);
    rungs.push(new THREE.Box3(center.clone().sub(halfRung), center.add(halfRung)));
  }
  const railZ = ladderZ + ladderRungs.offsetZ, railEnd = ladderZ + ladderRails.endOffsetZ;
  const handrails = [-ladderRails.x, ladderRails.x].flatMap(x => [
    new THREE.Box3(new THREE.Vector3(x - halfRung.y, ladderHeight, railZ - halfRung.z), new THREE.Vector3(x + halfRung.y, ladderRails.top, railZ + halfRung.z)),
    new THREE.Box3(new THREE.Vector3(x - halfRung.z, ladderRails.top - halfRung.y, railEnd - halfRung.y), new THREE.Vector3(x + halfRung.z, ladderRails.top + halfRung.y, railZ + halfRung.y)),
  ]);
  const hands = ['R', 'L'].map(side => fingerGroups(rig, side));
  const shoes = rig.root.getObjectByName('shoes01') as THREE.SkinnedMesh;
  const point = new THREE.Vector3();
  const nearestRung = (height: number) => rungs[THREE.MathUtils.clamp(Math.round((height - ladderRungs.bottom) / ladderRungs.spacing), 0, rungs.length - 1)];
  const overlaps: string[] = [];
  const samples = [0, .18, .32, .51, .65, .94, 1.3, 1.62, 2.1, 2.6, 3.25, 3.55, 4.2, 4.35, 4.55, 4.8, 5, 5.0688, 5.1, 5.2, 5.3, 5.45, 5.8, 6, 6.25, 6.5, 6.75, 6.95, ladderHeight]
    .map(climbed => ({ climbed, waiting: false }));
  samples.unshift({ climbed: 0, waiting: true });
  for (const { climbed, waiting } of samples) {
    journey.openingHotel!.phase = waiting ? 'ladder_ready' : climbed === ladderHeight ? 'done' : 'climbing';
    journey.openingHotel!.climbed = climbed; system.frame(trinity);
    body.position.set(trinity.position.x, trinity.position.y - 1, trinity.position.z);
    const motion = newMotion(), input = { speed: 0, grounded: true, verticalVelocity: 0, turn: 0, climbing: waiting || climbed === ladderHeight ? undefined : 0, hotelClimb: climbed };
    models.animate(rig, advanceMotion(motion, input, 0), motion, input, 0); body.updateMatrixWorld(true);
    let inspected = 0, inside = 0, soles = Infinity;
    rig.root.traverseVisible(mesh => {
      if (!(mesh instanceof THREE.SkinnedMesh)) return;
      mesh.skeleton.update();
      let penetration = 0;
      for (let vertex = 0; vertex < mesh.geometry.attributes.position.count; vertex++) {
        mesh.localToWorld(mesh.getVertexPosition(vertex, point)); point.sub(origin); inspected++;
        if (deck.containsPoint(point)) inside++;
        const rung = nearestRung(point.y);
        if (rung.containsPoint(point)) penetration = Math.max(penetration, Math.min(
          point.x - rung.min.x, rung.max.x - point.x, point.y - rung.min.y, rung.max.y - point.y, point.z - rung.min.z, rung.max.z - point.z));
        soles = Math.min(soles, point.y);
      }
      if (penetration > .025) overlaps.push(`${climbed}: ${mesh.name} penetrates a rung by ${penetration.toFixed(3)}`);
    });
    assert.ok(inspected > 1000);
    assert.equal(inside, 0, `${climbed}: Trinity intersects the upper deck at ${inside} rendered vertices`);
    if (climbed === ladderHeight) assert.ok(Math.abs(soles - ladderHeight - landing.thickness) < .05, 'the finished shoes must meet the deck');
    if (climbed <= 3.55) {
      let palm = Infinity, sole = Infinity;
      const contact = (mesh: THREE.SkinnedMesh, vertex: number, foot: boolean) => {
        mesh.localToWorld(mesh.getVertexPosition(vertex, point)); point.sub(origin);
        const rung = nearestRung(point.y);
        const distance = rung.distanceToPoint(point);
        if (foot && point.y >= rung.max.y - .01) sole = Math.min(sole, distance);
        if (!foot) palm = Math.min(palm, distance);
      };
      for (const { skin, hand } of hands) for (const vertex of hand) contact(skin, vertex, false);
      for (let vertex = 0; vertex < shoes.geometry.attributes.position.count; vertex++) contact(shoes, vertex, true);
      const label = waiting ? 'waiting at the ladder' : climbed;
      assert.ok(palm < .025, `${label}: neither hand contacts a rung (${palm.toFixed(3)} gap)`);
      assert.ok(sole < .025, `${label}: neither shoe is supported by a rung (${sole.toFixed(3)} gap)`);
    }
    if (climbed >= 4.2 && climbed <= 6.5) {
      let grip = Infinity;
      for (const { skin, hand } of hands) for (const vertex of hand) {
        skin.localToWorld(skin.getVertexPosition(vertex, point)); point.sub(origin);
        for (const rail of handrails) grip = Math.min(grip, rail.distanceToPoint(point));
        grip = Math.min(grip, rungs.at(-1)!.distanceToPoint(point));
      }
      assert.ok(grip < .035, `${climbed}: neither hand supports the transfer (${grip.toFixed(3)} gap)`);
    }
  }
  assert.equal(overlaps.length, 0, overlaps.join('\n'));
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
