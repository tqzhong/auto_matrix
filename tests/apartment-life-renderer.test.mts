import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from 'three';
import { APARTMENT, APARTMENT_CHAIR, APARTMENT_ROOM, MORNING, filmPosition, lifeRoomCenter, groundHeight, playerBlocked, type FilmJourney, type NeoLifeState, type SandboxState } from '@auto_matrix/shared';
import { LifeInteriors } from '../packages/client/src/engine/LifeInteriors.js';
import { FilmSetRenderer } from '../packages/client/src/engine/FilmSetRenderer.js';
import { WorldState } from '../packages/server/src/world/WorldState.js';
import { AgentManager } from '../packages/server/src/agents/AgentManager.js';
import { ApartmentSetRenderer } from '../packages/client/src/engine/ApartmentSetRenderer.js';
import { VoxelRenderer } from '../packages/client/src/engine/VoxelRenderer.js';

test('the city road and lane markings stop at the apartment floor', t => {
  t.mock.method(THREE.TextureLoader.prototype, 'load', () => new THREE.Texture());
  const city = new VoxelRenderer(new THREE.Scene());
  (city as unknown as { buildStreets(): void }).buildStreets();
  city.matrix.updateMatrixWorld(true);
  try {
    const roads = city.matrix.children.filter(object => object instanceof THREE.Mesh && object.material === city.streetAsphalt);
    const markings = city.matrix.children.filter(object => object instanceof THREE.LineSegments);
    assert.ok(roads.length && markings.length);
    const ray = new THREE.Raycaster();
    ray.params.Line = { threshold: .015 };
    const cast = (x: number, z: number, objects: THREE.Object3D[]) => {
      ray.set(new THREE.Vector3(x, 1, z), new THREE.Vector3(0, -1, 0));
      return ray.intersectObjects(objects, false);
    };
    const { x, z } = APARTMENT_ROOM.center;
    assert.ok(cast(x - 10, z + 31, roads).length, 'the street continues past the apartment');
    assert.ok(cast(x - 10, z + 25, markings).length, 'outside lane markings remain');
    assert.equal(cast(x - 5, z + 14, roads).length, 0, 'asphalt cannot render above the landing');
    assert.equal(cast(x - 10, z + 18, markings).length, 0, 'a partial lane marking stops at the outer wall');
  } finally { city.matrix.clear(); }
});

test('the street door encloses the visitor landing and clears the existing walking route on approach', t => {
  const original = globalThis.document;
  globalThis.document = { createElement: () => ({ width: 0, height: 0, getContext: () => ({ fillRect() {}, fillText() {} }) }) } as unknown as Document;
  t.mock.method(THREE.TextureLoader.prototype, 'load', () => new THREE.Texture());
  const root = new THREE.Group(), { center } = APARTMENT_ROOM;
  root.position.set(center.x, center.y - 1, center.z);
  const renderer = new ApartmentSetRenderer(root);
  try {
    const leaves = root.getObjectsByProperty('name', 'apartment-street-door');
    assert.equal(leaves.length, 2);
    const invitation = { scene: 'm1_wake_up', contact: { phase: 'invitation', elapsed: 0 } } as FilmJourney;
    const view = (z: number, journey: FilmJourney | undefined = invitation) => {
      renderer.update(journey, 22000, true, false, undefined, undefined, false, { x: center.x, z: center.z + z });
      root.updateMatrixWorld(true);
      return [-3.5, -.25, .25, 3.5].map(x => new THREE.Raycaster(new THREE.Vector3(center.x + x, 4, center.z + 14), new THREE.Vector3(0, 0, 1))
        .intersectObjects(leaves, true).length > 0);
    };
    assert.deepEqual(view(10), [true, true, true, true], 'the view behind the visitors ends in a solid interior');
    assert.deepEqual(view(18), [false, false, false, false], 'the whole walking gap is clear before the actor reaches the door');
    assert.deepEqual(view(22), [false, false, false, false], 'an actor on the pavement can walk back in');
    assert.deepEqual(view(28), [true, true, true, true]);
    assert.deepEqual(view(10, { scene: 'm1_morning' } as FilmJourney), [false, false, false, false]);
    for (const z of [18, 19, 20, 21, MORNING.exit.z]) assert.equal(playerBlocked(filmPosition('film_anderson_flat', MORNING.exit.x, z), true), false);
  } finally { renderer.dispose(); globalThis.document = original; }
});

test('the hollow book is a small floor prop beside the bed, rather than a large book on a raised table', t => {
  const original = globalThis.document;
  globalThis.document = { createElement: () => ({ width: 0, height: 0, getContext: () => ({ fillRect() {}, fillText() {} }) }) } as unknown as Document;
  t.mock.method(THREE.TextureLoader.prototype, 'load', () => new THREE.Texture());
  const root = new THREE.Group(), renderer = new ApartmentSetRenderer(root); root.updateMatrixWorld(true);
  try {
    const cover = (renderer as unknown as { cover: THREE.Group }).cover, bounds = new THREE.Box3().setFromObject(cover);
    assert.ok(bounds.min.y >= -.005 && bounds.max.y < .25, 'the closed book must rest just above the apartment floor');
    assert.ok(bounds.max.x - bounds.min.x < .8 && bounds.max.z - bounds.min.z < 1, 'the cover must be proportionate to the delivered human hands');
    assert.ok(bounds.min.z < -4 && bounds.max.x < 7.1, 'the floor book belongs beside the left edge of the bed');
  } finally { renderer.dispose(); globalThis.document = original; }
});

test('the hollow book opens from the green title to an upright printed leaf without hiding the cartridge', t => {
  const original = globalThis.document;
  globalThis.document = { createElement: () => {
    const lines: string[] = [];
    return { width: 0, height: 0, lines, getContext: () => ({ fillRect() {}, fillText(text: string) { lines.push(text); } }) };
  } } as unknown as Document;
  t.mock.method(THREE.TextureLoader.prototype, 'load', () => new THREE.Texture());
  t.after(() => { globalThis.document = original; });
  const root = new THREE.Group(), renderer = new ApartmentSetRenderer(root);
  t.after(() => renderer.dispose());
  const cover = (renderer as unknown as { cover: THREE.Group }).cover;
  const disk = root.getObjectByName('apartment-book-disc')!;
  const readCover = (elapsed: number) => {
    renderer.update({ scene: 'm1_wake_up', contact: { phase: 'retrieving', elapsed, propMotion: 'minidisc' } } as FilmJourney);
    root.updateMatrixWorld(true);
    const center = cover.localToWorld(new THREE.Vector3(.84, 0, 0));
    const ray = new THREE.Raycaster(center.add(new THREE.Vector3(0, 1, 0)), new THREE.Vector3(0, -1, 0));
    const face = ray.intersectObject(cover)[0]?.object as THREE.Mesh<THREE.PlaneGeometry, THREE.MeshStandardMaterial>;
    assert.ok(face.material.map instanceof THREE.CanvasTexture, 'the visible board should carry a printed surface');
    assert.ok(face.localToWorld(new THREE.Vector3(0, 1, 0)).z > face.getWorldPosition(new THREE.Vector3()).z, 'print reads upright from Neo’s side');
    return (face.material.map.image as { lines: string[] }).lines;
  };
  assert.ok(readCover(1.4).includes('ON NIHILISM'));
  assert.ok(disk.visible);
  const approach = disk.getWorldPosition(new THREE.Vector3()).add(new THREE.Vector3(0, 1, 0));
  assert.equal(new THREE.Raycaster(approach, new THREE.Vector3(0, -1, 0)).intersectObject(cover).length, 0);
  assert.deepEqual(readCover(0), ['SIMULACRA', '&', 'SIMULATION']);
  const board = cover.children.find(object => object instanceof THREE.Mesh && object.geometry instanceof THREE.BoxGeometry) as THREE.Mesh<THREE.BoxGeometry, THREE.MeshStandardMaterial>;
  assert.ok(board.material.color.g > board.material.color.r && board.material.color.g > board.material.color.b);
});

test('the rendered computer seat and back agree with their shared walking collider', t => {
  const original = globalThis.document;
  globalThis.document = { createElement: () => ({ width: 0, height: 0, getContext: () => ({ fillRect() {}, fillText() {} }) }) } as unknown as Document;
  t.mock.method(THREE.TextureLoader.prototype, 'load', () => new THREE.Texture());
  const root = new THREE.Group(), renderer = new ApartmentSetRenderer(root); root.updateMatrixWorld(true);
  try {
    let chair: THREE.Mesh | undefined;
    root.traverse(object => { if (object instanceof THREE.Mesh && object.material.name === 'apartment-computer-chair') chair = object; });
    assert.ok(chair);
    const bounds = new THREE.Box3().setFromObject(chair), shared = APARTMENT_CHAIR;
    assert.ok(bounds.min.x >= shared.x - shared.width / 2 - .005 && bounds.max.x <= shared.x + shared.width / 2 + .005);
    assert.ok(bounds.min.z >= shared.z - shared.depth / 2 - .005 && bounds.max.z <= shared.z + shared.depth / 2 + .005);
    assert.ok(Math.abs(bounds.max.y - shared.height) < .005);
    const seat = new THREE.Raycaster(new THREE.Vector3(shared.x, 4, shared.z), new THREE.Vector3(0, -1, 0)).intersectObject(chair)[0];
    assert.ok(seat && Math.abs(seat.point.y - shared.seatY - .15) < .005, 'the lowered seat must match the contact animation');
    const front = new THREE.Raycaster(new THREE.Vector3(shared.x, shared.seatY, shared.z - 1.5), new THREE.Vector3(0, 0, 1)).intersectObject(chair)[0];
    assert.ok(front && Math.abs(front.point.z - shared.z + shared.seatDepth / 2) < .005, 'the shorter cushion must leave the bending trouser legs in front of its real edge');
    const back = new THREE.Raycaster(new THREE.Vector3(shared.x, shared.height - .75, shared.z - 1.5), new THREE.Vector3(0, 0, 1)).intersectObject(chair)[0];
    assert.ok(back && Math.abs(back.point.z - shared.backZ + .12) < .005);
    assert.equal(playerBlocked(filmPosition('film_anderson_flat', shared.x, shared.z), true), true);
  } finally { renderer.dispose(); globalThis.document = original; }
});

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

test('the narrow street exit label leaves room for every letter', t => {
  const original = globalThis.document;
  const signs: { font: string; height: number; width: number; maxWidth?: number }[] = [];
  globalThis.document = { createElement: () => {
    const canvas = { width: 0, height: 0, getContext: () => ({
      font: '', fillRect() {},
      fillText(text: string, _x: number, _y: number, maxWidth?: number) {
        if (text === 'STREET') signs.push({ font: this.font, height: canvas.height, width: canvas.width, maxWidth });
      },
    }) };
    return canvas;
  } } as unknown as Document;
  t.mock.method(THREE.TextureLoader.prototype, 'load', () => new THREE.Texture());
  t.after(() => { globalThis.document = original; });
  const renderer = new ApartmentSetRenderer(new THREE.Group());
  t.after(() => renderer.dispose());
  assert.equal(signs.length, 1);
  const [sign] = signs;
  assert.ok(parseFloat(sign.font) < sign.height);
  assert.ok(sign.maxWidth !== undefined && sign.maxWidth < sign.width);
});

test('the rendered blanket covers the mattress and hangs clear of both sides', t => {
  const original = globalThis.document;
  globalThis.document = { createElement: () => ({ width: 0, height: 0, getContext: () => ({ fillRect() {}, fillText() {} }) }) } as unknown as Document;
  t.mock.method(THREE.TextureLoader.prototype, 'load', () => new THREE.Texture());
  const root = new THREE.Group(), renderer = new ApartmentSetRenderer(root); root.updateMatrixWorld(true);
  try {
    const surfaces = new Map<number, THREE.Mesh>();
    root.traverse(object => {
      if (object instanceof THREE.Mesh && object.material instanceof THREE.MeshStandardMaterial)
        surfaces.set(object.material.color.getHex(), object);
    });
    const blanket = surfaces.get(0x3c4a43), mattress = surfaces.get(0x777c69);
    assert.ok(blanket && mattress);
    const ray = new THREE.Raycaster();
    let clearance = Infinity;
    for (let x = -3; x <= 3; x += .15) for (let z = -9.9; z <= -4.4; z += .15) {
      ray.set(new THREE.Vector3(APARTMENT.bed.x + x, 3, z), new THREE.Vector3(0, -1, 0));
      const cloth = ray.intersectObject(blanket)[0], top = ray.intersectObject(mattress)[0];
      assert.ok(cloth && top, 'the blanket must cover the mattress in the visible area');
      clearance = Math.min(clearance, cloth.point.y - top.point.y);
    }
    assert.ok(clearance > .005, `the visible mattress breaks through the blanket by ${-clearance}`);
    for (const side of [-1, 1]) {
      ray.set(new THREE.Vector3(APARTMENT.bed.x + side * 4, MORNING.mattressY - .2, -7.5), new THREE.Vector3(-side, 0, 0));
      const cloth = ray.intersectObject(blanket)[0], edge = ray.intersectObject(mattress)[0];
      assert.ok(cloth && edge && cloth.distance < edge.distance, 'the hanging blanket must clear the mattress edge');
    }
  } finally { renderer.dispose(); globalThis.document = original; }
});

test('the visible cafe tabletop agrees with walking clearance and the landing surface', t => {
  const original = globalThis.document;
  globalThis.document = { createElement: () => ({ width: 0, height: 0, getContext: () => ({ fillRect() {}, fillText() {} }) }) } as unknown as Document;
  t.mock.method(THREE.TextureLoader.prototype, 'load', () => new THREE.Texture());
  const root = new THREE.Group(), renderer = new LifeInteriors(root); root.updateMatrixWorld(true);
  try {
    const center = lifeRoomCenter('corner_cafe')!;
    const room = root.children.find(object => object.position.x === center.x && object.position.z === center.z)!;
    const top = room.children.find(object => object instanceof THREE.Mesh && object.position.x === -8 && object.position.z === 0 && Math.abs(object.position.y - 2.45) < 1e-6)!;
    assert.ok(top, 'inspect the actual rendered tabletop');
    const bounds = new THREE.Box3().setFromObject(top), middle = bounds.getCenter(new THREE.Vector3());
    assert.equal(playerBlocked({ x: bounds.max.x + 1.09, y: 1, z: middle.z }, true), true);
    assert.equal(playerBlocked({ x: bounds.max.x + 1.11, y: 1, z: middle.z }, true), false);
    assert.ok(Math.abs(groundHeight({ x: middle.x, y: bounds.max.y + 1.01, z: middle.z }, true) - bounds.max.y - 1) < 1e-6);
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
    const contactLight = film.atmosphere(true);
    assert.ok(contactLight && contactLight.sun < .2 && contactLight.fill! < .3, 'live contact uses the film’s night lighting');
    assert.ok(scene.environmentIntensity < .35 && scene.background.getHex() !== 0xb9d7ee);
    let rooms = 0; scene.traverse(object => { if (object.name === 'anderson-shared-apartment') rooms++; }); assert.equal(rooms, 1);
    scene.updateMatrixWorld(true); rays.set(new THREE.Vector3(neo.position.x, 2.5, neo.position.z + 1), new THREE.Vector3(0, 0, 1));
    assert.ok(rays.intersectObject(home, true).length, 'the story closes the actual shared door');
    const sunlight = home.getObjectByName('apartment-window-daylight') as THREE.PointLight;
    assert.ok(sunlight.intensity > 90 && sunlight.visible);
    const landing = city.getObjectsByProperty('isSpotLight', true)[0] as THREE.SpotLight;
    const lampPosition = new THREE.Vector3(neo.position.x, 8.3, neo.position.z + 16);
    assert.ok(landing.getWorldPosition(new THREE.Vector3()).distanceTo(lampPosition) < .001);
    assert.equal(landing.intensity, 180);
    assert.equal(landing.shadow.autoUpdate, true);
    const fill = home.getObjectByName('apartment-doorway-fill') as THREE.PointLight;
    const regularFill = { intensity: fill.intensity, x: fill.position.x, color: fill.color.getHex() };
    const entrance = { ...life, journey: { ...journey, contact: { phase: 'invitation', elapsed: 0 } as const } };
    interiors.update(22000, neo.position, entrance);
    assert.ok(fill.intensity < regularFill.intensity / 2 && fill.position.x * regularFill.x < 0,
      'the open doorway uses side light and leaves a visible shadow side on the visitors');
    assert.ok(fill.color.g > fill.color.r && fill.color.g > fill.color.b);
    assert.ok(landing.intensity > 0 && landing.intensity < 180 && landing.castShadow);
    interiors.update(12000, neo.position);
    assert.deepEqual({ intensity: fill.intensity, x: fill.position.x, color: fill.color.getHex() }, regularFill);
    const street = { ...neo.position, z: neo.position.z + 140 };
    const commute = { ...life, journey: { ...journey, scene: 'm1_commute' } };
    interiors.update(12000, street, commute, street, undefined, undefined, true);
    assert.equal(home.parent!.visible, false);
    assert.equal(landing.visible, true);
    assert.ok(landing.parent === city);
    assert.equal(landing.intensity, 0);
    assert.equal(landing.castShadow, true);
    assert.equal(landing.shadow.autoUpdate, false);
    interiors.update(12000, neo.position, commute, neo.position, undefined, undefined, true);
    assert.equal(landing.intensity, 180);
    assert.equal(landing.shadow.autoUpdate, true);
    interiors.update(22000, neo.position, life); assert.equal(sunlight.intensity, 0);
    assert.equal(scene.getObjectByName('anderson-shared-apartment'), home, 'day/night and chapter updates do not recreate the room');
    interiors.update(22000, filmPosition('film_white_rabbit_club'), life);
    assert.equal(landing.visible, false);
    home.traverse(object => { if (object instanceof THREE.Light) assert.equal(object.visible, false, 'remote apartment lights must not render'); });
    const office = { x: 1140, y: 66, z: 827 };
    const cafe = city.children.find(object => object.position.x === 1000 && object.position.z === 668)!;
    const lobby = city.getObjectByName('metacortex-city-lobby')!;
    interiors.update(22000, office, life, office);
    assert.equal(home.parent!.visible, false, 'the distant apartment interior must not draw behind its exterior shell');
    assert.equal(cafe.visible, false, 'the distant cafe interior must not draw from the office');
    assert.equal(lobby.parent!.visible, true, 'the nearby office lift remains available');
    interiors.update(22000, office, life, neo.position);
    assert.equal(home.parent!.visible, true, 'a camera near the apartment still sees its interior');
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
