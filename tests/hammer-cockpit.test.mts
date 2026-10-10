import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { HAMMER_COCKPIT, FILM_SETS, newHammerFlight, stepHammerFlight, hammerCenter, hammerHeight, hammerHalfWidth, hammerCrewRoot, hammerShipPoint, hammerShipPose, filmPosition, playerBlocked, type HammerFlight, type HammerPilotRole } from '@auto_matrix/shared';
import { CharacterModels } from '../packages/client/src/agents/CharacterModel.js';
import { AgentRenderer } from '../packages/client/src/agents/AgentRenderer.js';
import { HammerRouteRenderer } from '../packages/client/src/engine/HammerRouteRenderer.js';
import { PlayerControls } from '../packages/client/src/player/PlayerControls.js';
import { WorldState } from '../packages/server/src/world/WorldState.js';
import { AgentManager } from '../packages/server/src/agents/AgentManager.js';
import { HAMMER_BEAMS, hammerRouteFrame } from '@auto_matrix/shared';

function legacyFlight() { const flight = newHammerFlight(); delete flight.maneuver; return flight; }

async function geometry(id: string) {
  const glb = await readFile(new URL(`../packages/client/public/assets/characters/${id}.glb`, import.meta.url));
  const length = glb.readUInt32LE(12), document = JSON.parse(glb.subarray(20, 20 + length).toString());
  for (const material of document.materials) { delete material.pbrMetallicRoughness?.baseColorTexture; delete material.normalTexture; }
  document.images = []; document.textures = [];
  const json = Buffer.from(JSON.stringify(document)), padded = Buffer.alloc(Math.ceil(json.length / 4) * 4, 32); json.copy(padded);
  const bin = glb.subarray(20 + length), result = Buffer.alloc(20 + padded.length + bin.length);
  result.writeUInt32LE(0x46546c67, 0); result.writeUInt32LE(2, 4); result.writeUInt32LE(result.length, 8);
  result.writeUInt32LE(padded.length, 12); result.writeUInt32LE(0x4e4f534a, 16); padded.copy(result, 20); bin.copy(result, 20 + padded.length);
  return new GLTFLoader().parseAsync(result.buffer.slice(result.byteOffset, result.byteOffset + result.byteLength), '');
}

async function setup(t: test.TestContext) {
  const ids = ['morpheus', 'trinity', 'niobe-head', 'niobe-body', 'roland-head', 'roland-body'];
  const assets = new Map(await Promise.all(ids.map(async id => [`${id}.glb`, await geometry(id)] as const)));
  t.mock.method(GLTFLoader.prototype, 'loadAsync', (url: string) => assets.has(url.split('/').at(-1)!) ? Promise.resolve(assets.get(url.split('/').at(-1)!)) : new Promise(() => {}));
  t.mock.method(THREE.TextureLoader.prototype, 'load', () => new THREE.Texture());
  const old = globalThis.document;
  globalThis.document = { createElement: () => ({ getContext: () => ({ createRadialGradient: () => ({ addColorStop() {} }), fillRect() {}, strokeRect() {}, fillText() {}, beginPath() {}, closePath() {}, moveTo() {}, lineTo() {}, stroke() {}, ellipse() {}, fill() {}, createImageData: (w: number,h: number) => ({ data: new Uint8ClampedArray(w*h*4) }), putImageData() {} }) }) } as unknown as Document;
  const world = new WorldState(); new AgentManager(world).initializeAllAgents(); const models = new CharacterModels();
  const roles = ['niobe', 'morpheus', 'roland'] as const, rigs = Object.fromEntries(roles.map(role => [role, models.create(world.agents.get(role)!)]));
  const pose = (role: HammerPilotRole, flight: HammerFlight, delta = 0) => {
    const rig = rigs[role], point = hammerShipPoint(flight, { ...HAMMER_COCKPIT.roots[role], y: HAMMER_COCKPIT.floor }), ship = hammerShipPose(flight);
    rig.root.position.set(point.x, point.y + 1, point.z); rig.root.rotation.set(-ship.pitch, ship.yaw + Math.PI, -ship.roll, 'YXZ');
    models.animate(rig, delta, { speed: flight.speed, grounded: true, verticalVelocity: 0, turn: flight.lateral, realWorld: true,
      nebCrew: role === 'morpheus' ? role : undefined, seated: role !== 'roland', riding: true, hammerPilot: { role, flight } }, 0);
    rig.root.updateMatrixWorld(true); rig.root.traverse(object => { if (object instanceof THREE.SkinnedMesh) object.skeleton.update(); }); return rig;
  };
  t.after(() => { models.dispose(); globalThis.document = old; });
  for (const role of roles) pose(role, legacyFlight()); await new Promise(resolve => setImmediate(resolve));
  for (const role of roles) pose(role, legacyFlight()); await new Promise(resolve => setImmediate(resolve));
  return { roles, rigs, pose, models, world };
}

test('the shipped pilots keep their soles above the deck and palms on the banking physical yokes', async t => {
  const h = await setup(t), root = new THREE.Group(), renderer = new HammerRouteRenderer(root);
  t.after(() => renderer.dispose());
  const flights = [-12, 0, 12].map(lateral => ({ ...legacyFlight(), elapsed: 7.4, speed: 28, lateral, z: -42, x: -8 }));
  flights.push(...[-1, 1].map(side => ({ ...newHammerFlight(), z: -75, x: -1.5, maneuver: { lift: 0, vertical: 0, bank: side * Math.PI / 2, bankVelocity: side * .8 } })));
  for (const flight of flights) {
    const lateral = flight.maneuver?.bank ?? flight.lateral;
    renderer.update(flight, 30); root.updateMatrixWorld(true);
    const cockpit = root.getObjectByName('hammer-cockpit')!, inverse = cockpit.matrixWorld.clone().invert();
    for (const role of h.roles) {
      const rig = h.pose(role, flight), hero = rig.hero;
      assert.ok(role === 'morpheus' ? hero : rig.root.getObjectByName(`${role}-detailed-body`), `${role}: test must use the shipped body`);
      let lowest = Infinity; const ceilingSamples = new Map<string, THREE.Vector3>();
      rig.root.traverseVisible(object => { if (object instanceof THREE.Mesh) for (let i = 0; i < object.geometry.attributes.position.count; i++) {
        const point = object.localToWorld(object.getVertexPosition(i, new THREE.Vector3())).applyMatrix4(inverse);
        assert.ok(point.toArray().every(Number.isFinite)); lowest = Math.min(lowest, point.y);
        if (point.y > 1.1) {
          const key = `${point.x.toFixed(1)}/${point.z.toFixed(1)}`;
          if (!ceilingSamples.has(key) || ceilingSamples.get(key)!.y < point.y) ceilingSamples.set(key, point);
        }
      } });
      assert.ok(lowest >= HAMMER_COCKPIT.floor - .05 && lowest < HAMMER_COCKPIT.floor + .12, `${role}/${lateral}: soles leave the deck (${lowest})`);
      const roof = root.getObjectByName('hammer-cabin-roof')!, up = new THREE.Vector3(0, 1, 0).transformDirection(cockpit.matrixWorld);
      for (const point of ceilingSamples.values()) {
        const origin = new THREE.Vector3(point.x, HAMMER_COCKPIT.floor, point.z).applyMatrix4(cockpit.matrixWorld);
        const hit = new THREE.Raycaster(origin, up).intersectObject(roof, false)[0];
        assert.ok(hit && hit.point.clone().applyMatrix4(inverse).y >= point.y + .02, `${role}/${lateral}: the body penetrates the actual curved roof at ${point.toArray()}`);
      }
      if (role === 'roland') continue;
      const grips: THREE.Vector3[] = [];
      root.getObjectByName(`${role}-hammer-yoke`)!.traverse(object => { if (object.name === 'hammer-control-grip') grips.push(object.getWorldPosition(new THREE.Vector3())); });
      for (let i = 0; i < 2; i++) {
        const wrist = hero?.bones.get(i ? 'wrist_L' : 'wrist_R') ?? rig.mobilWrists?.[i]; assert.ok(wrist);
        const palm = wrist.localToWorld(hero ? new THREE.Vector3(i ? -.13 : .13, -.18, .02) : new THREE.Vector3(0, -.75 - wrist.position.y, .005));
        assert.ok(Math.min(...grips.map(grip => palm.distanceTo(grip))) < .09, `${role}/${lateral}: palm floats off the physical control grip`);
      }
    }
  }
  assert.equal(h.rigs.morpheus.root.getObjectByName('morpheus-hammer-sweater')!.visible, true);
});

test('the saved cockpit pose remains fixed through render deltas and leaving restores the wardrobe', async t => {
  const h = await setup(t), flight = { ...legacyFlight(), elapsed: 4.1, speed: 24, lateral: 8 };
  for (const role of h.roles) {
    const rig = h.pose(role, flight), joints = [rig.torso, rig.head, ...rig.shoulders, ...rig.elbows, ...(rig.hero?.bones.values() ?? [])];
    const before = joints.map(joint => joint.matrixWorld.elements.slice()); h.pose(role, structuredClone(flight), 8);
    assert.deepEqual(joints.map(joint => joint.matrixWorld.elements.slice()), before, `${role}: paused flight pose drifted`);
  }
  h.models.animate(h.rigs.morpheus, 0, { speed: 0, grounded: true, verticalVelocity: 0, turn: 0, realWorld: false }, 0);
  assert.equal(h.rigs.morpheus.root.getObjectByName('morpheus-hammer-sweater')!.visible, false);
});

test('the cabin aisle stays usable while seats and side walls block walking through their geometry', () => {
  assert.equal(playerBlocked(filmPosition('film_hammer_route', 0, 183), false), false);
  assert.equal(playerBlocked(filmPosition('film_hammer_route', 0, 172), false), false);
  assert.equal(playerBlocked(filmPosition('film_hammer_route', -1.65, 170.9), false), true);
  assert.equal(playerBlocked(filmPosition('film_hammer_route', 4, 180), false), true);
});

test('leaving a side-rolled flight while paused restores the upright walking body', async t => {
  const h = await setup(t), renderer = new AgentRenderer(new THREE.Scene());
  t.after(() => renderer.dispose()); renderer.setWorld(false);
  const state = h.world.agents.get('niobe')!, flight = newHammerFlight();
  flight.z = -75; flight.maneuver!.bank = Math.PI / 2;
  state.isInMatrix = false; state.currentLocation = 'film_hammer_route';
  state.currentAction = { type: 'idle', parameters: { riding: true, seated: true, hammerPilot: { role: 'niobe', flight } }, startedAt: 1, duration: 1e9, progress: 0 };
  renderer.updateAgent(state.id, state); renderer.update(0);
  assert.ok(Math.abs(renderer.getAgentBody(state.id)!.rotation.z) > 1.5);
  state.currentAction = null; state.position = filmPosition('film_hammer_route', 0, 184);
  renderer.updateAgent(state.id, state); renderer.update(0);
  const body = renderer.getAgentBody(state.id)!;
  assert.ok(Math.abs(body.rotation.z) < .001, 'the paused walking body retains the ship roll');
  assert.ok(body.position.distanceTo(new THREE.Vector3(0, -1, 0)) < .001);
});

test('the Hammer outer hull and glowing hover coils stay below the walkable cabin floor', () => {
  const root = new THREE.Group(), renderer = new HammerRouteRenderer(root);
  try {
    renderer.update(legacyFlight(), 0); root.updateMatrixWorld(true);
    const cockpit = root.getObjectByName('hammer-cockpit')!, inverse = cockpit.matrixWorld.clone().invert();
    const radio = root.getObjectByName('hammer-radio')!, excluded = new Set<THREE.Object3D>(); radio.traverse(object => excluded.add(object));
    root.getObjectByName('hammer-airframe')!.traverse(object => {
      if (!(object instanceof THREE.Mesh) || excluded.has(object)) return;
      for (let i = 0; i < object.geometry.attributes.position.count; i++) {
        const point = object.localToWorld(object.getVertexPosition(i, new THREE.Vector3())).applyMatrix4(inverse);
        if (Math.abs(point.x) > 4.1 || point.z < HAMMER_COCKPIT.walk.front - 175 || point.z > HAMMER_COCKPIT.walk.back - 175) continue;
        assert.ok(point.y <= HAMMER_COCKPIT.floor + .03, `outer ${object.geometry.type} penetrates the cabin at ${point.toArray()}`);
      }
    });
  } finally { renderer.dispose(); }
});

test('hitting the elliptical tunnel keeps the banked rendered hull inside the wall, including after the collision rebound', () => {
  const root = new THREE.Group(), renderer = new HammerRouteRenderer(root), vertices: THREE.Vector3[] = [];
  try {
    renderer.update(legacyFlight(), 0); root.updateMatrixWorld(true);
    const inverse = root.getObjectByName('hammer-cockpit')!.matrixWorld.clone().invert();
    for (const name of ['hammer-airframe', 'hammer-cockpit']) root.getObjectByName(name)!.traverse(object => {
      if (!(object instanceof THREE.Mesh)) return;
      for (let i = 0; i < object.geometry.attributes.position.count; i++)
        vertices.push(object.localToWorld(object.getVertexPosition(i, new THREE.Vector3())).applyMatrix4(inverse));
    });
    for (const z of [175, 55, -90]) for (const steer of [-1, 1]) {
      let flight = { ...legacyFlight(), x: hammerCenter(z), z, speed: 25 };
      for (let frame = 0; frame < 120 && flight.phase === 'riding'; frame++) {
        flight = stepHammerFlight(flight, { throttle: 1, steer, brake: false }, .05);
        for (const vertex of vertices) {
          const point = hammerShipPoint(flight, vertex), radius = hammerHalfWidth(point.z);
          const radial = Math.hypot((point.x - hammerCenter(point.z)) / radius, (point.y - hammerHeight(point.z)) / (radius * .9));
          assert.ok(radial <= 1.001, `${z}/${steer}/${frame}: the actual hull crosses the tunnel (${radial}), vertex ${vertex.toArray()}, flight ${JSON.stringify(flight)}`);
        }
      }
    }
  } finally { renderer.dispose(); }
});

test('the third-person camera frames Niobe at the saved cabin entry rather than cutting through her upper body', async t => {
  const previous = ['window', 'document'].map(key => Object.getOwnPropertyDescriptor(globalThis, key));
  let controls: PlayerControls | undefined;
  t.after(() => { controls?.dispose(); ['window', 'document'].forEach((key,i) => previous[i] ? Object.defineProperty(globalThis,key,previous[i]!) : Reflect.deleteProperty(globalThis,key)); });
  const h = await setup(t), target = { addEventListener() {}, removeEventListener() {} };
  Object.defineProperty(globalThis, 'window', { configurable: true, value: target });
  Object.defineProperty(globalThis, 'document', { configurable: true, value: target });
  const camera = new THREE.PerspectiveCamera(48, 16/9, .5, 5000); controls = new PlayerControls(target as unknown as HTMLCanvasElement, camera, () => {}, () => {});
  const state = h.world.agents.get('niobe')!, rig = h.rigs.niobe, group = new THREE.Group(); group.add(rig.root);
  state.position = filmPosition('film_hammer_route', 0, 184); state.rotation = Math.PI; state.currentLocation = 'film_hammer_route'; state.currentAction = null;
  group.position.set(state.position.x, state.position.y, state.position.z); rig.root.position.set(0, -1, 0); rig.root.rotation.set(0, Math.PI, 0);
  h.models.animate(rig, 0, { speed: 0, grounded: true, verticalVelocity: 0, turn: 0, realWorld: true }, 0);
  controls.possess(state); controls.update(.1, state, group, false); camera.updateMatrixWorld(true);
  for (const y of [.05, 4.5]) {
    const point = rig.root.localToWorld(new THREE.Vector3(0, y, 0)).project(camera);
    assert.ok(Math.abs(point.x) < .9 && Math.abs(point.y) < .95 && point.z < 1, `body leaves the entry view: ${point.toArray()}`);
  }
});

test('third-person flight cameras keep an unobstructed view past the two physical crossbeams', async t => {
  const previous = ['window', 'document'].map(key => Object.getOwnPropertyDescriptor(globalThis, key));
  let controls: PlayerControls | undefined;
  t.after(() => { controls?.dispose(); ['window', 'document'].forEach((key,i) => previous[i] ? Object.defineProperty(globalThis,key,previous[i]!) : Reflect.deleteProperty(globalThis,key)); });
  const h = await setup(t), target = { addEventListener() {}, removeEventListener() {} };
  Object.defineProperty(globalThis, 'window', { configurable: true, value: target });
  Object.defineProperty(globalThis, 'document', { configurable: true, value: target });
  const camera = new THREE.PerspectiveCamera(48, 16/9, .5, 5000); controls = new PlayerControls(target as unknown as HTMLCanvasElement, camera, () => {}, () => {});
  const state = h.world.agents.get('niobe')!, center = FILM_SETS.film_hammer_route.center, group = new THREE.Group();
  for (const distance of [60, 85, 110, 310, 330, 350]) {
    const flight = newHammerFlight(); flight.z = 175 - distance; flight.maneuver!.lift = distance < 150 ? 2 : -2.5;
    const point = hammerCrewRoot(flight, 'niobe');
    state.position = { x: center.x + point.x, y: center.y + point.y, z: center.z + point.z }; state.rotation = point.yaw;
    state.currentLocation = 'film_hammer_route';
    state.currentAction = { type: 'idle', parameters: { riding: true, seated: true, hammerPilot: { role: 'niobe', flight } }, startedAt: 1, duration: 1e9, progress: 0 };
    group.position.set(state.position.x, state.position.y, state.position.z); controls.possess(state); controls.update(.1, state, group, false);
    const focus = hammerShipPoint(flight, { x: 0, y: -.6, z: -7 });
    for (const beam of HAMMER_BEAMS) {
      const frame = hammerRouteFrame(beam.distance), inverse = new THREE.Quaternion().setFromEuler(new THREE.Euler(frame.pitch, frame.yaw, 0, 'YXZ')).invert();
      const origin = new THREE.Vector3(focus.x - frame.x, focus.y - frame.y, focus.z - frame.z).applyQuaternion(inverse);
      const eye = camera.position.clone().sub(new THREE.Vector3(center.x + frame.x, center.y + frame.y, center.z + frame.z)).applyQuaternion(inverse);
      const box = new THREE.Box3(new THREE.Vector3(-beam.width / 2, beam.y - beam.height / 2, -beam.depth / 2), new THREE.Vector3(beam.width / 2, beam.y + beam.height / 2, beam.depth / 2)).expandByScalar(.35);
      const hit = new THREE.Ray(origin, eye.clone().sub(origin).normalize()).intersectBox(box, new THREE.Vector3());
      assert.ok(!hit || hit.distanceTo(origin) > eye.distanceTo(origin), `${distance}: the beam blocks the camera or cuts through its near plane`);
    }
  }
});

test('walking around the closed cabin does not put the third-person camera behind its opaque shell', async t => {
  const previous = ['window', 'document'].map(key => Object.getOwnPropertyDescriptor(globalThis, key));
  let controls: PlayerControls | undefined;
  t.after(() => { controls?.dispose(); ['window', 'document'].forEach((key,i) => previous[i] ? Object.defineProperty(globalThis,key,previous[i]!) : Reflect.deleteProperty(globalThis,key)); });
  const h = await setup(t), target = { addEventListener() {}, removeEventListener() {} };
  const center = FILM_SETS.film_hammer_route.center, root = new THREE.Group(), renderer = new HammerRouteRenderer(root);
  t.after(() => renderer.dispose()); root.position.set(center.x, center.y - 1, center.z); root.updateMatrixWorld(true);
  const shell: THREE.Object3D[] = []; root.traverse(object => { if (['hammer-cabin-shell', 'hammer-cabin-roof'].includes(object.name)) shell.push(object); });
  Object.defineProperty(globalThis, 'window', { configurable: true, value: target });
  Object.defineProperty(globalThis, 'document', { configurable: true, value: target });
  const camera = new THREE.PerspectiveCamera(48, 16/9, .5, 5000); controls = new PlayerControls(target as unknown as HTMLCanvasElement, camera, () => {}, () => {});
  const state = h.world.agents.get('niobe')!, group = new THREE.Group();
  state.currentLocation = 'film_hammer_route'; state.currentAction = null;
  for (const [x, z, yaw] of [[-1.467661284, 172.56442311593, 1.7634896785663674], [0, 184, Math.PI], [-3.1, 173.3, 0], [3.1, 180, -Math.PI / 2]]) {
    state.position = filmPosition('film_hammer_route', x, z); state.rotation = yaw; controls.possess(state);
    group.position.set(state.position.x, state.position.y, state.position.z); controls.update(.1, state, group, false);
    assert.ok(Math.abs(camera.position.x - center.x) < 3.7, 'the walking camera leaves the enclosed cabin through its side window');
    const focus = new THREE.Vector3(state.position.x, state.position.y + 1.45, state.position.z), direction = focus.clone().sub(camera.position);
    const ray = new THREE.Raycaster(camera.position, direction.clone().normalize(), .05, direction.length() - .1);
    assert.equal(ray.intersectObjects(shell, false).length, 0, `the cabin blocks the camera at ${x}/${z}/${yaw}`);
  }
});

test('Niobe first-person steering carries the view with the bank while preserving subsequent free look', async t => {
  const previous = ['window', 'document'].map(key => Object.getOwnPropertyDescriptor(globalThis, key));
  let controls: PlayerControls | undefined;
  t.after(() => { controls?.dispose(); ['window', 'document'].forEach((key,i) => previous[i] ? Object.defineProperty(globalThis,key,previous[i]!) : Reflect.deleteProperty(globalThis,key)); });
  const h = await setup(t);
  const target = { addEventListener() {}, removeEventListener() {} }, actions: string[] = [];
  Object.defineProperty(globalThis, 'window', { configurable: true, value: target });
  Object.defineProperty(globalThis, 'document', { configurable: true, value: target });
  const camera = new THREE.PerspectiveCamera(48, 16/9, .5, 5000); controls = new PlayerControls(target as unknown as HTMLCanvasElement, camera, () => {}, kind => actions.push(kind));
  const state = h.world.agents.get('niobe')!, center = FILM_SETS.film_hammer_route.center, group = new THREE.Group();
  const place = (lateral: number, z = 175, bank?: number) => {
    const flight = bank === undefined ? { ...legacyFlight(), x: hammerCenter(z), z, speed: 28, lateral }
      : { ...newHammerFlight(), x: -1.5, z, speed: 23, maneuver: { lift: 0, vertical: 0, bank, bankVelocity: 0 } };
    const point = hammerCrewRoot(flight, 'niobe');
    state.position = { x: center.x + point.x, y: center.y + point.y, z: center.z + point.z }; state.rotation = point.yaw;
    state.currentLocation = 'film_hammer_route'; state.currentAction = { type: 'idle', parameters: { riding: true, seated: true, hammerPilot: { role: 'niobe', flight } }, startedAt: 1, duration: 1e9, progress: 0 };
    h.rigs.niobe.root.removeFromParent();
    const rig = h.pose('niobe', flight), ship = hammerShipPose(flight);
    group.position.set(state.position.x, state.position.y, state.position.z); group.add(rig.root);
    rig.root.position.set(0, -1, 0).applyQuaternion(new THREE.Quaternion().setFromEuler(new THREE.Euler(ship.pitch, ship.yaw, ship.roll, 'YXZ')));
    group.updateMatrixWorld(true); return rig;
  };
  let rig = place(0); controls.possess(state); controls.firstPerson = true;
  controls.update(.1, state, group, false); const before = camera.getWorldDirection(new THREE.Vector3());
  const eye = rig.head.localToWorld((rig.head.userData.cameraEye as THREE.Vector3 | undefined)?.clone() ?? new THREE.Vector3(0, .1, .32));
  assert.ok(camera.position.distanceTo(eye) < .04, 'the real-world camera is still using the hidden Matrix body instead of Niobe eyes');
  rig = place(10); controls.update(.1, state, group, false);
  assert.ok(camera.getWorldDirection(new THREE.Vector3()).distanceTo(before) > .12);
  const look = controls as unknown as { yaw: number }; look.yaw += .4;
  const turned = camera.getWorldDirection(new THREE.Vector3()); controls.update(.1, state, group, false);
  assert.ok(camera.getWorldDirection(new THREE.Vector3()).distanceTo(turned) > .25);
  assert.ok(Math.abs(camera.up.x) > .05);
  controls.firstPerson = false;
  for (const z of [175, -90]) {
    rig = place(8, z); controls.update(.1, state, group, false);
    for (const angle of [0, Math.PI / 2, Math.PI, -Math.PI / 2]) {
      look.yaw = state.rotation + angle; controls.update(.1, state, group, false);
      const eye = camera.position.clone().sub(new THREE.Vector3(center.x, center.y, center.z)), radius = hammerHalfWidth(eye.z);
      assert.ok(Math.hypot((eye.x - hammerCenter(eye.z)) / radius, (eye.y - hammerHeight(eye.z)) / (radius * .9)) < 1,
        `the orbit camera leaves the tunnel at ${z}/${angle}`);
      assert.ok(eye.z <= 189, 'the start camera sits behind the rendered tunnel entrance');
    }
  }
  for (const bank of [-Math.PI / 2, Math.PI / 2]) {
    rig = place(0, -75, bank); controls.possess(state); controls.firstPerson = true;
    controls.update(.1, state, group, false);
    const direction = camera.getWorldDirection(new THREE.Vector3());
    assert.ok(direction.x > .7 && direction.y > .3, `after the elbow the pilot still looks along the original horizontal axis: ${direction.toArray()}, yaw ${look.yaw}, root ${state.rotation}`);
    assert.ok(camera.up.z * Math.sign(bank) < -.9, 'the horizon does not follow a ninety-degree side roll');
    const eye = rig.head.localToWorld((rig.head.userData.cameraEye as THREE.Vector3 | undefined)?.clone() ?? new THREE.Vector3(0, .1, .32));
    assert.ok(camera.position.distanceTo(eye) < .04, 'pitch and bank move the view away from the physical head');
  }
  controls.ride = { speed: 23 }; controls.setEnabled(true);
  const keys = controls as unknown as { keyDown(event: KeyboardEvent): void; keyUp(event: KeyboardEvent): void; input(jump: boolean): { drive?: { lift?: number; roll?: number }; jump: boolean }; networkJump: boolean };
  const key = (code: string) => ({ code, target: { matches: () => false }, repeat: false, preventDefault() {} }) as unknown as KeyboardEvent;
  keys.keyDown(key('KeyQ')); keys.keyDown(key('Space'));
  assert.equal(keys.input(false).drive?.roll, 1); assert.equal(keys.input(false).drive?.lift, 1);
  assert.equal(keys.networkJump, false); assert.deepEqual(actions, []);
  keys.keyUp(key('KeyQ')); keys.keyUp(key('Space')); keys.keyDown(key('KeyE')); keys.keyDown(key('KeyC'));
  assert.equal(keys.input(false).drive?.roll, -1); assert.equal(keys.input(false).drive?.lift, -1);
  assert.deepEqual(actions, [], 'flight keys must not open conversation or trigger a combat ability');
  controls.setEnabled(false); assert.equal(keys.input(false).drive?.lift, 0); assert.equal(keys.input(false).drive?.roll, 0);

});
