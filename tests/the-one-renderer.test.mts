import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from 'three';
import { THE_ONE, filmPosition, theOneRoot, type FilmJourney, type SandboxState, type TheOneKind, type TheOnePhase } from '@auto_matrix/shared';
import { FilmSetRenderer } from '../packages/client/src/engine/FilmSetRenderer.js';
import { TheOneRenderer } from '../packages/client/src/engine/TheOneRenderer.js';
import { LightCulling } from '../packages/client/src/engine/LightCulling.js';
import { AgentManager } from '../packages/server/src/agents/AgentManager.js';
import { WorldState } from '../packages/server/src/world/WorldState.js';

function journey(kind: TheOneKind, phase: TheOnePhase, elapsed = 0): FilmJourney {
  const scene = kind === 'death' ? 'm1_death' : kind === 'return' ? 'm1_return' : 'm1_final_call';
  return {
    version: 1, scene, actor: 'neo', step: kind === 'flight' ? 1 : 0, completed: [], enteredAt: 0,
    checkpoint: { x: 0, y: 1, z: 0 }, reflections: {}, lastText: '',
    theOne: { kind, phase, elapsed, attempt: 0, checkpoint: kind === 'death' ? 'door' : kind === 'return' ? 'bullets' : 'phone',
      signal: 0, hits: 0, blocks: 0, deadline: 0, altitude: 0, flightX: 0, flightZ: 0, resolved: [] },
  };
}

test('room 303 owns the door, exit phone, gunfire damage, stopped volley and code burst', () => {
  const root = new THREE.Group(); const renderer = new TheOneRenderer(root, 'film_heart_hotel');
  for (const name of ['one-hotel-corridor', 'one-room-303-door', 'one-exit-phone', 'one-gunfire-flashes',
    'one-bullet-field', 'one-code-shell', 'one-smith-burst']) assert.ok(root.getObjectByName(name), name);
  const state = journey('return', 'bullet_window', THE_ONE.return.bulletBeat);
  renderer.update(state, 2); const bullets = root.getObjectByName('one-bullet-field')!;
  assert.ok(Math.abs(root.getObjectByName('one-room-303-door')!.rotation.y) > .9, 'revived Neo must see the agents through the open 303 door');
  assert.equal(bullets.visible, true); const position = bullets.children[0].position.clone();
  renderer.update(state, 90); assert.deepEqual(bullets.children[0].position.toArray(), position.toArray(), 'global client time cannot advance the volley');
  state.theOne!.phase = 'bullet_stop'; state.theOne!.elapsed = 1.2; renderer.update(state, 3);
  assert.equal(root.getObjectByName('one-code-shell')!.visible, true); assert.equal(bullets.visible, true);
  const revival = theOneRoot(journey('death', 'done').theOne!, 'neo');
  assert.ok(bullets.children.every(bullet => bullet.position.z < revival.z - .8), 'the stopped rounds stay in front of the revived Neo');
  state.theOne!.phase = 'burst'; state.theOne!.elapsed = .8; renderer.update(state, 4);
  assert.equal(root.getObjectByName('one-smith-burst')!.visible, false, 'fragments wait for the saved impact');
  state.theOne!.elapsed = 1.2; state.theOne!.smithBurst = true; renderer.update(state, 4);
  assert.equal(root.getObjectByName('one-smith-burst')!.visible, true);
  renderer.dispose(); assert.equal(root.children.length, 0);
});

test('303 opens a clear sightline to Smith and stays open through the first shot', () => {
  const root = new THREE.Group(); const renderer = new TheOneRenderer(root, 'film_heart_hotel');
  const corridor = root.getObjectByName('one-hotel-corridor')!;
  const ray = new THREE.Raycaster(new THREE.Vector3(0, 3, -14), new THREE.Vector3(0, 0, -1), 0, 6.5);
  const sightline = (phase: TheOnePhase, elapsed: number) => {
    renderer.update(journey('death', phase, elapsed), 0); root.updateMatrixWorld(true);
    return ray.intersectObject(corridor, true).filter(hit => hit.object.parent?.visible);
  };
  assert.equal(sightline('ready', 0)[0]?.object.name, 'one-room-303-door');
  assert.equal(sightline('ambush', 1.2).length, 0);
  assert.equal(sightline('gunfire', .02).length, 0);
  renderer.dispose();
});

test('303 keeps one light slot and illuminates only the saved shot beats', () => {
  const root = new THREE.Group(); const renderer = new TheOneRenderer(root, 'film_heart_hotel');
  const state = journey('death', 'ambush', 1.4);
  renderer.update(state, 0);
  const light = root.getObjectByName('one-muzzle-light') as THREE.PointLight;
  assert.ok(light?.isPointLight && light.visible);
  assert.equal(light.intensity, 0);
  state.theOne!.phase = 'gunfire';
  for (const shot of [.35, .78, 1.22]) {
    state.theOne!.elapsed = shot + .025; renderer.update(state, 1);
    assert.ok(light.intensity > 20);
    renderer.update(state, 10); assert.ok(light.intensity > 20);
    state.theOne!.elapsed = shot + .2; renderer.update(state, 10);
    assert.equal(light.intensity, 0);
    assert.equal(root.getObjectByName('one-muzzle-light'), light);
    assert.equal(light.visible, true);
  }
  renderer.dispose();
});

test('Nebuchadnezzar overlay distinguishes flatline, hull breach and Morpheus EMP', () => {
  const root = new THREE.Group(); const renderer = new TheOneRenderer(root, 'film_neb_deck');
  for (const name of ['one-life-monitor', 'one-flatline-line', 'one-heart-pulse', 'one-sentinel-cutters', 'one-emp-switch', 'one-emp-flash']) {
    assert.ok(root.getObjectByName(name), name);
  }
  const death = journey('death', 'flatline', .9); renderer.update(death, 1);
  assert.equal(root.getObjectByName('one-flatline-line')!.visible, true); assert.equal(root.getObjectByName('one-heart-pulse')!.visible, false);
  death.theOne!.phase = 'kiss'; death.theOne!.elapsed = 1.7; renderer.update(death, 2);
  assert.equal(root.getObjectByName('one-heart-pulse')!.visible, true);
  const escape = journey('return', 'emp', THE_ONE.return.empFireAt - .14);
  renderer.update(escape, 3);
  const handle = root.getObjectByName('one-emp-handle')!;
  assert.ok(handle.rotation.z < -.16 && handle.rotation.z > -1.05, 'the lever travels toward the discharge position');
  escape.theOne!.elapsed = 1.4; escape.theOne!.empFired = true; renderer.update(escape, 3);
  assert.equal(root.getObjectByName('one-sentinel-cutters')!.visible, true); assert.equal(root.getObjectByName('one-emp-flash')!.visible, true);
  root.updateMatrixWorld(true);
  const console = new THREE.Box3().setFromObject(root.getObjectByName('one-emp-housing')!);
  const operator = theOneRoot(escape.theOne!, 'morpheus');
  const torso = new THREE.Box3(new THREE.Vector3(operator.x - .58, 1, operator.z - .58), new THREE.Vector3(operator.x + .58, 3.3, operator.z + .58));
  assert.ok(!console.intersectsBox(torso), 'Morpheus stands beside the console housing throughout the discharge');
  renderer.dispose(); assert.equal(root.children.length, 0);
});

test('the hardline prepares a detached deck and uses it for the live EMP', t => {
  const scene = new THREE.Scene(), sets = new FilmSetRenderer(scene);
  const world = new WorldState(); new AgentManager(world).initializeAllAgents();
  const neo = world.agents.get('neo')!;
  neo.position = filmPosition('film_heart_hotel'); neo.isInMatrix = true;
  let state = journey('death', 'ambush');
  const sandbox = { neoLife: { journey: state } } as SandboxState;
  sets.update(neo, sandbox, 0);
  assert.equal(sets.active?.id, 'film_heart_hotel');
  const door = scene.getObjectByName('one-room-303-door');
  assert.ok(door);

  const actor = new THREE.Group(), texture = new THREE.Texture({ width: 2048, height: 2048 });
  actor.visible = false;
  const cabinMap = new THREE.Texture({ width: 2048, height: 2048 });
  cabinMap.needsUpdate = true;
  const geometry = new THREE.BoxGeometry(), material = new THREE.MeshStandardMaterial({ map: texture });
  const mesh = new THREE.Mesh(geometry, material); actor.add(mesh); texture.needsUpdate = true;
  t.after(() => { sets.dispose(); geometry.dispose(); material.dispose(); texture.dispose(); cabinMap.dispose(); });

  let preview: THREE.Scene | undefined, actorReady = false, compiledActor = false;
  const uploads: THREE.Texture[] = [];
  const graphics = { extensions: { has: () => true }, info: { programs: [] }, getRenderTarget: () => null,
    setRenderTarget() {}, properties: { get: () => ({}) }, initTexture(candidate: THREE.Texture) { uploads.push(candidate); },
    compile(subject: THREE.Group, _camera: THREE.Camera, target: THREE.Scene) {
      preview = target;
      subject.traverse(object => { if (object === mesh) compiledActor = true; });
    } } as unknown as THREE.WebGLRenderer;
  const camera = new THREE.PerspectiveCamera();
  const prepare = () => sets.prepareOneDeck(graphics, camera, state, id => id === 'neo' && actorReady ? actor : undefined, neo.position);
  prepare(); assert.ok(!preview, 'let Smith render before starting the deck');
  state.theOne!.phase = 'ready';
  prepare(); assert.ok(preview, 'prepare while Neo is walking toward 303');
  state = journey('return', 'counter'); sandbox.neoLife!.journey = state;
  sets.update(neo, sandbox, 0);
  assert.ok(scene.getObjectByName('one-room-303-door') === door, 'code sight keeps the revived corridor');
  preview = undefined;
  prepare(); assert.ok(!preview, 'wait until the fight is resolved');
  state.theOne!.phase = 'dive'; state.theOne!.elapsed = .5;
  prepare();
  const bed = preview?.getObjectByName('neb-cabin-bed-neb-cabin-cotton') as THREE.Mesh<THREE.BufferGeometry, THREE.MeshStandardMaterial>;
  assert.ok(bed);
  bed.material.map = cabinMap;
  actorReady = true;
  for (let frame = 0; frame < 120; frame++) prepare();
  assert.deepEqual(uploads.filter(map => map === texture || map === cabinMap), [cabinMap, texture],
    'upload the late cabin map and the offstage skin while the hotel is still active');
  assert.ok(compiledActor); assert.equal(actor.visible, false);
  const deck = preview?.getObjectByName('neb-interior-deck'), handle = preview?.getObjectByName('one-emp-handle') as THREE.Mesh;
  assert.ok(deck && handle);
  assert.ok(!scene.getObjectByName('neb-interior-deck'), 'leave the hotel as the active set');
  const lights = (root: THREE.Scene) => {
    let points = 0, spots = 0;
    root.traverseVisible(object => {
      if (object instanceof THREE.PointLight) points++;
      if (object instanceof THREE.SpotLight) spots++;
    });
    return { points, spots };
  };
  const layout = lights(preview!);
  assert.deepEqual(layout, { points: 16, spots: 0 });

  state.theOne!.phase = 'emp'; state.theOne!.elapsed = 1.4; state.theOne!.empFired = true;
  neo.position = filmPosition('film_neb_deck', 6.5, -5); neo.isInMatrix = false;
  sets.update(neo, sandbox, 1);
  assert.ok(scene.getObjectByName('neb-interior-deck') === deck);
  assert.ok(scene.getObjectByName('one-emp-handle') === handle);
  assert.equal(handle.rotation.z, -1.05, 'the adopted overlay uses the live saved beat');
  assert.deepEqual(lights(scene), layout);
  let released = 0;
  handle.geometry.addEventListener('dispose', () => { released++; });
  sets.update(undefined, undefined, 2);
  assert.equal(released, 1);
  assert.ok(!scene.getObjectByName('neb-interior-deck'));
});

test('the 303 approach prepares the hidden agents with the current hotel lights before opening the door', t => {
  const scene = new THREE.Scene(), sets = new FilmSetRenderer(scene), lighting = new LightCulling(scene);
  lighting.stablePointSlots = true;
  const world = new WorldState(); new AgentManager(world).initializeAllAgents();
  const neo = world.agents.get('neo')!; neo.position = filmPosition('film_heart_hotel', 0, -16); neo.isInMatrix = true;
  const state = journey('death', 'ready');
  sets.update(neo, { neoLife: { journey: state } } as SandboxState, 0);
  const actor = new THREE.Group(), geometry = new THREE.BoxGeometry(), material = new THREE.MeshStandardMaterial();
  const skin = new THREE.SkinnedMesh(geometry, material); skin.name = 'Anatomical_head_and_hands'; skin.castShadow = true;
  skin.visible = actor.visible = false; actor.add(skin);
  const batches: THREE.Object3D[][] = [], depths: THREE.MeshDepthMaterial[] = [];
  const graphics = { extensions: { has: () => true }, info: { programs: [] }, properties: { get: () => ({}) },
    shadowMap: { enabled: true, type: THREE.PCFSoftShadowMap }, getRenderTarget: () => null, setRenderTarget() {},
    compile(subject: THREE.Object3D, _camera: THREE.Camera, target: THREE.Scene) {
      const batch: THREE.Object3D[] = []; subject.traverse(object => batch.push(object)); batches.push(batch);
      assert.ok(batch.length <= 4); assert.notEqual(target, scene);
      const points = (root: THREE.Scene) => { let count = 0; root.traverseVisible(o => { if (o instanceof THREE.PointLight) count++; }); return count; };
      assert.equal(points(target), points(scene), 'prepare with the current eight-slot hotel layout');
      for (const mesh of batch) if (mesh instanceof THREE.Mesh && mesh.material instanceof THREE.MeshDepthMaterial) depths.push(mesh.material);
    } } as unknown as THREE.WebGLRenderer;
  const camera = new THREE.PerspectiveCamera(), prepare = () => sets.prepareOneHotel(graphics, camera, state,
    id => id === 'smith' ? actor : undefined, neo.position, lighting);
  t.after(() => { sets.dispose(); lighting.dispose(); geometry.dispose(); material.dispose(); });
  for (let i = 0; i < 20; i++) prepare();
  assert.ok(batches.some(batch => batch.includes(skin)), 'Smith must not wait for the first ambush draw');
  assert.ok(depths.length, 'prepare the packed skin shadow too');
  assert.ok(sets.oneHotelNormalMeshes?.includes(skin), 'the actual head also needs its occlusion program');
  assert.equal(actor.visible, false); assert.equal(skin.visible, false); assert.equal(skin.parent, actor);
  assert.equal(state.theOne!.phase, 'ready'); assert.equal(state.theOne!.elapsed, 0);
  const count = batches.length; prepare(); assert.equal(batches.length, count);
  const normals = sets.oneHotelNormalMeshes;
  const late = new THREE.Mesh(geometry, material); late.name = 'Anatomical_head_and_hands'; late.visible = false; actor.add(late);
  for (let i = 0; i < 10; i++) prepare();
  assert.ok(batches.slice(count).some(batch => batch.includes(late)), 'late meshes in an existing actor must also prepare');
  assert.notEqual(sets.oneHotelNormalMeshes, normals, 'late heads must restart the destination normal queue');
  state.theOne!.phase = 'ambush'; const combatCount = batches.length;
  prepare(); assert.equal(batches.length, combatCount, 'leave the actual ambush its render budget');
  let released = 0; for (const depth of new Set(depths)) depth.addEventListener('dispose', () => released++);
  state.visiting = state.scene; prepare(); assert.equal(released, new Set(depths).size);
  assert.equal(sets.oneHotelNormalMeshes, undefined);
});

test('the saved EMP prepares and adopts the daylight phone booth with zero point lights', t => {
  const scene = new THREE.Scene(), sets = new FilmSetRenderer(scene), lighting = new LightCulling(scene);
  const sun = new THREE.DirectionalLight(); sun.castShadow = true; scene.add(sun);
  const world = new WorldState(); new AgentManager(world).initializeAllAgents(); const neo = world.agents.get('neo')!;
  neo.position = filmPosition('film_neb_deck'); neo.isInMatrix = false;
  const state = journey('return', 'emp', 1.5);
  sets.update(neo, { neoLife: { journey: state } } as SandboxState, 0);
  const actor = new THREE.Group(), geometry = new THREE.BoxGeometry(), material = new THREE.MeshPhysicalMaterial();
  const skin = new THREE.SkinnedMesh(geometry, material); skin.visible = actor.visible = false; actor.add(skin);
  let booth: THREE.Object3D | undefined, compiledActor = false;
  const graphics = { extensions: { has: () => true }, info: { programs: [] }, properties: { get: () => ({}) },
    getRenderTarget: () => null, setRenderTarget() {},
    compile(subject: THREE.Object3D, _camera: THREE.Camera, target: THREE.Scene) {
      let count = 0, points = 0; subject.traverse(object => { count++; if (object === skin) compiledActor = true; });
      assert.ok(count <= 4); target.traverseVisible(object => {
        if (object instanceof THREE.PointLight) points++;
        if (object.name === 'one-final-phone-booth') booth = object;
      });
      assert.equal(points, 0, 'the daylight entry must not inherit the ship or objective point lamp');
    } } as unknown as THREE.WebGLRenderer;
  const camera = new THREE.PerspectiveCamera(), prepare = () => sets.prepareMatrixEscape(graphics, camera, state,
    id => id === 'neo' ? actor : undefined, () => undefined, sun, lighting);
  t.after(() => { sets.dispose(); lighting.dispose(); geometry.dispose(); material.dispose(); });
  for (let i = 0; i < 160; i++) prepare();
  assert.ok(booth && compiledActor, 'the real booth and hidden Matrix skin must prepare before leaving the ship');
  assert.equal(scene.getObjectByName('one-final-phone-booth'), undefined); assert.equal(actor.visible, false);
  assert.equal(state.scene, 'm1_return'); assert.equal(state.theOne!.phase, 'emp'); assert.equal(state.theOne!.elapsed, 1.5);
  const pane = booth.children.find(object => object instanceof THREE.Mesh && object.material instanceof THREE.MeshPhysicalMaterial) as THREE.Mesh;
  assert.ok(pane); let released = 0; pane.geometry.addEventListener('dispose', () => released++);
  neo.position = filmPosition('film_final_phone'); neo.isInMatrix = true;
  sets.update(neo, { neoLife: { journey: journey('flight', 'ready') } } as SandboxState, 0);
  assert.equal(scene.getObjectByName('one-final-phone-booth'), booth); assert.equal(released, 0);
  sets.update(undefined, undefined, 0); assert.equal(released, 1);
});

test('final daylight corner owns a phone booth, commuters, skyline and saved flight trail', () => {
  const root = new THREE.Group(); const renderer = new TheOneRenderer(root, 'film_final_phone');
  for (const name of ['one-final-street', 'one-final-phone-booth', 'one-final-commuters', 'one-final-skyline', 'one-flight-rings', 'one-flight-trail']) {
    assert.ok(root.getObjectByName(name), name);
  }
  const state = journey('flight', 'call', 2.4); renderer.update(state, 2);
  assert.equal(root.getObjectByName('one-final-phone-booth')!.visible, true);
  const booth = root.getObjectByName('one-final-phone-booth')!;
  state.theOne!.phase = 'takeoff_ready'; renderer.update(state, 3); root.updateMatrixWorld(true);
  const egress = new THREE.Raycaster(new THREE.Vector3(-.35, 2.8, THE_ONE.flight.boothZ), new THREE.Vector3(0, 0, 1), 0, 2);
  assert.equal(egress.intersectObject(booth, true).length, 0, 'the phone cannot obstruct Neo’s shoulder at the open side');
  assert.equal(root.getObjectByName('one-flight-launch')!.visible, true);
  state.theOne!.phase = 'takeoff'; state.theOne!.elapsed = 3.6; state.theOne!.altitude = 17; state.theOne!.flightX = 4; state.theOne!.flightZ = -3;
  renderer.update(state, 5); const trail = root.getObjectByName('one-flight-trail')!;
  assert.equal(trail.visible, true); const saved = trail.position.clone(); renderer.update(state, 100);
  assert.deepEqual(trail.position.toArray(), saved.toArray(), 'flight effects derive from saved encounter state');
  renderer.dispose(); assert.equal(root.children.length, 0);
});
