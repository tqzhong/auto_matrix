import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from 'three';
import { FILM_SCENE_BY_ID, FILM_SETS, filmPosition, filmStepNear, garageCarPose, garageRiderPose, newGarageEscape, playerBlocked, stepPlayer, type WorldEvent } from '@auto_matrix/shared';
import { WorldState } from '../packages/server/src/world/WorldState.js';
import { AgentManager } from '../packages/server/src/agents/AgentManager.js';
import { SandboxSystem } from '../packages/server/src/player/SandboxSystem.js';
import type { WorldDynamics } from '../packages/server/src/story/WorldDynamics.js';
import { PlayerControls } from '../packages/client/src/player/PlayerControls.js';
import { FilmSetRenderer } from '../packages/client/src/engine/FilmSetRenderer.js';

const set = FILM_SETS.film_chateau_garage, at = (x: number, z: number) => filmPosition(set.id, x, z);
for (const [x, z] of [[0, 14], [-17, -14], [17, 22]]) test(`the visible garage car at ${x},${z} blocks a walking body`, () => {
  assert.equal(playerBlocked(at(x, z), true), true, 'a foot player cannot stand inside the visible chassis');
  let position = at(x, z + 9), velocity = { x: 0, z: 0 };
  for (let frame = 0; frame < 80; frame++) {
    const next = stepPlayer(position, 0, { x: 0, z: -1, yaw: Math.PI, jump: false, sprint: false }, .05, true, [], velocity);
    position = next.position; velocity = next.horizontalVelocity;
  }
  assert.ok(position.z - set.center.z >= z + 4.5 + 1.1 - .04, 'stop before the rear body panel');
  assert.equal(playerBlocked({ ...at(x, z), y: set.center.y + 7 }, true), false);
});

test('the driver door remains reachable and only the occupied chase car is omitted from a driving camera check', () => {
  const door = at(-3.3, 14), scene = FILM_SCENE_BY_ID.m2_garage;
  assert.equal(playerBlocked(door, true), false);
  assert.equal(filmStepNear(scene, scene.steps[1], door, true), true);
  assert.equal(playerBlocked(at(0, 14), true, .5, [], true), false);
  assert.equal(playerBlocked(at(-17, -14), true, .5, [], true), true, 'parked cars remain solid beside the chase');
});

function savedFoot() {
  const world = new WorldState(); new AgentManager(world).initializeAllAgents();
  const dynamics = { record: (_event: Omit<WorldEvent, 'id'>) => undefined } as WorldDynamics;
  const sandbox = new SandboxSystem(world, dynamics, 42), neo = world.agents.get('neo')!, trinity = world.agents.get('trinity')!;
  sandbox.life.begin(neo, 0); world.agents.get('keymaker')!.health = 40;
  Object.assign(trinity, { currentLocation: set.id, isInMatrix: true, health: 73, position: at(0, 16.4277), rotation: Math.PI,
    currentAction: { type: 'idle', parameters: { player: true, resolved: true }, startedAt: 304573, duration: 1, progress: 0 } });
  sandbox.state.neoLife!.journey = { version: 1, scene: 'm2_garage', actor: 'trinity', step: 1, completed: ['m2_mountain'],
    enteredAt: 304569, checkpoint: at(0, 16.4449), reflections: {}, lastText: '' };
  return { world, sandbox, trinity, state: sandbox.life.film.state! };
}

test('a legacy foot save and its separately saved checkpoint both leave the car without losing wounds or clocks', () => {
  const h = savedFoot(), before = structuredClone(h.trinity);
  h.sandbox.life.film.restoreGaragePose(h.trinity, 304573);
  assert.notDeepEqual(h.trinity.position, before.position);
  assert.equal(playerBlocked(h.trinity.position, true), false); assert.equal(playerBlocked(h.state.checkpoint, true), false);
  assert.equal(h.trinity.position.z, before.position.z); assert.equal(h.state.checkpoint.z, set.center.z + 16.4449);
  assert.equal(h.trinity.rotation, before.rotation); assert.equal(h.trinity.health, 73); assert.deepEqual(h.trinity.currentAction, before.currentAction);
  assert.equal(h.world.agents.get('keymaker')!.health, 40); assert.equal(h.state.step, 1); assert.equal(h.state.garage, undefined);
});

test('a valid foot stance keeps its position while its old checkpoint inside the car is corrected', () => {
  const h = savedFoot(); h.trinity.position = at(-6.1154, 16.4277); const before = structuredClone(h.trinity), checkpoint = { ...h.state.checkpoint };
  h.sandbox.life.film.restoreGaragePose(h.trinity, 304573);
  assert.deepEqual(h.trinity, before); assert.notDeepEqual(h.state.checkpoint, checkpoint); assert.equal(playerBlocked(h.state.checkpoint, true), false);
});

test('valid foot positions and checkpoints stay unchanged', () => {
  const h = savedFoot(); h.trinity.position = at(-6, 16); h.state.checkpoint = at(-6, 20);
  const before = structuredClone(h.trinity), checkpoint = { ...h.state.checkpoint };
  h.sandbox.life.film.restoreGaragePose(h.trinity, 304573);
  assert.deepEqual(h.trinity, before); assert.deepEqual(h.state.checkpoint, checkpoint);
});

test('restoring an occupied moving car keeps the driver seat, vehicle damage and action clock', () => {
  const h = savedFoot(); h.trinity.controller = 'garage-car-test';
  h.state.garage = { ...newGarageEscape(), x: 3, z: -4, speed: 12, elapsed: 2.7, hull: 56, passenger: 40 };
  const seat = garageRiderPose(garageCarPose(h.state.garage), 'trinity'); h.trinity.position = at(seat.x, seat.z); h.trinity.rotation = seat.yaw;
  h.trinity.currentAction = { type: 'move_to', parameters: { player: true, resolved: true, riding: true, seated: true }, startedAt: 55, duration: 1, progress: 0 };
  const before = structuredClone(h.trinity), escape = structuredClone(h.state.garage);
  assert.equal(h.sandbox.life.film.restoreGaragePose(h.trinity, 999), true);
  assert.deepEqual(h.trinity, before); assert.deepEqual(h.state.garage, escape);
});

for (const riding of [false, true]) test(`garage ${riding ? 'driving' : 'walking'} retains a clear third-person camera at the car`, t => {
  class Target extends EventTarget { matches() { return false; } }
  const previous = ['window', 'document'].map(key => Object.getOwnPropertyDescriptor(globalThis, key));
  Object.assign(globalThis, { window: new Target(), document: Object.assign(new Target(), { pointerLockElement: null, hidden: false, exitPointerLock() {} }) });
  const h = savedFoot(), camera = new THREE.PerspectiveCamera(57, 16 / 9, .5, 5000), group = new THREE.Group(); group.add(new THREE.Group());
  const controls = new PlayerControls(new Target() as unknown as HTMLCanvasElement, camera, () => {}, () => {});
  t.after(() => { controls.dispose(); ['window', 'document'].forEach((key, i) => {
    if (previous[i]) Object.defineProperty(globalThis, key, previous[i]!); else Reflect.deleteProperty(globalThis, key);
  }); });
  for (const aspect of [16 / 9, 9 / 16]) for (const [x, z, yaw] of riding ? [[-1.05, 14, Math.PI]] : [[-3.25, 14, -Math.PI / 2], [3.25, 14, Math.PI / 2], [0, 8.35, Math.PI], [0, 19.65, 0]]) {
    camera.aspect = aspect; camera.updateProjectionMatrix(); h.trinity.position = at(x, z); h.trinity.rotation = yaw;
    controls.possess(h.trinity); controls.ride = riding ? { speed: 0 } : undefined;
    for (const running of [false, true]) {
      controls.firstPerson = true; controls.update(.02, h.trinity, group, running);
      controls.firstPerson = false; controls.update(.02, h.trinity, group, running);
      const gap = Math.hypot(camera.position.x - h.trinity.position.x, camera.position.z - h.trinity.position.z);
      if (riding) assert.ok(gap > 4.5, 'the driver camera must not collide with its own chase car');
      else if (gap < 1.5) {
        assert.ok(camera.position.y >= h.trinity.position.y + 4.15, 'the car cannot squeeze the lens into Trinity');
        camera.updateMatrixWorld(); const head = new THREE.Vector3(x + set.center.x, h.trinity.position.y + 3, z + set.center.z).project(camera);
        assert.ok(Math.abs(head.x) < 1 && Math.abs(head.y) < 1 && head.z < 1, 'keep the body in a compressed frame');
      }
    }
  }
});

for (const room of ['m2_garage', 'm2_chateau'] as const) test(`${room} collision props cannot become opaque full-height pillars`, t => {
  const previous = globalThis.document;
  const context = { fillRect() {}, strokeRect() {}, fillText() {}, beginPath() {}, moveTo() {}, lineTo() {}, closePath() {}, stroke() {}, fill() {}, ellipse() {},
    createLinearGradient: () => ({ addColorStop() {} }), createRadialGradient: () => ({ addColorStop() {} }),
    createImageData: (w: number, h: number) => ({ data: new Uint8ClampedArray(w * h * 4) }), putImageData() {} };
  globalThis.document = { createElement: () => ({ width: 0, height: 0, getContext: () => context }) } as unknown as Document;
  t.after(() => { globalThis.document = previous; });
  t.mock.method(THREE.TextureLoader.prototype, 'load', () => new THREE.Texture({ width: 1, complete: true }));
  const scene = new THREE.Scene(), sets = new FilmSetRenderer(scene), h = savedFoot(), beat = FILM_SCENE_BY_ID[room], center = FILM_SETS[beat.set].center;
  t.after(() => sets.dispose());
  Object.assign(h.state, { scene: room, actor: 'trinity', step: 0 });
  Object.assign(h.trinity, { currentLocation: beat.set, position: filmPosition(beat.set, 0, 20) });
  sets.update(h.trinity, h.sandbox.state, 0); scene.updateMatrixWorld(true);
  const rays = room === 'm2_garage' ? [[-7, 14, 3.3, 14], [-24, -14, 3.3, 14], [10, 22, 3.3, 14]] : [[-30.5, 17, 8, 3], [27.5, 17, 8, 3]];
  for (const [x, z, y, far] of rays) {
    const ray = new THREE.Raycaster(new THREE.Vector3(center.x + x, center.y - 1 + y, center.z + z), new THREE.Vector3(1, 0, 0), 0, far);
    const hits = ray.intersectObjects(scene.children, true).filter(hit => {
      for (let object: THREE.Object3D | null = hit.object; object; object = object.parent) if (!object.visible) return false;
      return hit.object instanceof THREE.Mesh;
    });
    if (room === 'm2_garage') {
      assert.ok(hits.length, 'the driver window must still be drawn');
      const material = (hits[0].object as THREE.Mesh).material;
      assert.ok([material].flat().some(m => m.transparent || m instanceof THREE.MeshPhysicalMaterial && m.transmission > 0), 'the first cabin surface must be glass, not a collider pillar');
    } else assert.equal(hits.length, 0, 'a weapon stand must leave the air above it clear');
  }
});
