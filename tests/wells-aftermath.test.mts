import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { FILM_SCENE_BY_ID, FILM_SETS, WELLS_AFTERMATH, WELLS_CURB, filmEntry, filmPosition, openingTruckPose, wellsAftermathDoor, wellsAftermathPose, type WellsAftermathGesture, type WorldEvent } from '@auto_matrix/shared';
import { CharacterModels } from '../packages/client/src/agents/CharacterModel.js';
import { FilmSetRenderer } from '../packages/client/src/engine/FilmSetRenderer.js';
import { WellsStreetRenderer } from '../packages/client/src/engine/WellsStreetRenderer.js';
import { PlayerControls } from '../packages/client/src/player/PlayerControls.js';
import { AgentManager } from '../packages/server/src/agents/AgentManager.js';
import type { ActionExecutor } from '../packages/server/src/agents/ActionExecutor.js';
import type { ConversationEngine } from '../packages/server/src/agents/ConversationEngine.js';
import { PlayerController } from '../packages/server/src/player/PlayerController.js';
import { SandboxSystem } from '../packages/server/src/player/SandboxSystem.js';
import type { WorldDynamics } from '../packages/server/src/story/WorldDynamics.js';
import { WorldState } from '../packages/server/src/world/WorldState.js';
import { actor } from './helpers/fighting-hand-fixture.mts';

const scene = FILM_SCENE_BY_ID.m1_phone_escape;
const roles = ['smith', 'agent_jones', 'agent_brown'];

function setup(remaining = 8) {
  const world = new WorldState(); new AgentManager(world).initializeAllAgents();
  const dynamics = { record: (event: Omit<WorldEvent, 'id'>) => world.addWorldEvent(event) } as WorldDynamics;
  const conversations = { interrupt() {}, isAgentInConversation: () => false } as unknown as ConversationEngine;
  const sandbox = new SandboxSystem(world, dynamics, 42);
  const players = new PlayerController(world, conversations, { execute() {} } as unknown as ActionExecutor, dynamics, sandbox);
  const command = (target: string) => players.sandboxAction('caller', { kind: 'life', target: `film:${target}` }, 0);
  players.possess('caller', 'neo', 0); sandbox.life.begin(world.agents.get('neo')!, 0); sandbox.state.neoLife!.chapter = 1;
  command('start');
  const state = () => sandbox.life.film.state!;
  Object.assign(state(), { scene: scene.id, step: 1, actor: 'trinity', checkpoint: filmEntry(scene),
    completed: ['m1_room303', 'm1_roofs'], openingPhone: { phase: 'running', remaining, lastTick: 0, attempts: 0 } });
  const caller = world.agents.get('trinity')!;
  caller.currentLocation = scene.set; caller.isInMatrix = true; caller.position = filmPosition(scene.set, -.55, -28.85); caller.rotation = Math.PI;
  players.possess('caller', 'trinity', 0);
  const phone = () => state().openingPhone!;
  const frame = (count = 1, running = true) => { for (let i = 0; i < count; i++) players.step(.05, running, 0); };
  const cast = () => roles.map(id => world.agents.get(id)!);
  function crash() {
    command('act');
    for (let i = 0; i < 80 && phone().phase !== 'done' && phone().phase !== 'failed'; i++) frame();
  }
  return { state, phone, sandbox, players, caller, command, frame, cast, crash };
}

test('Wells aftermath: watch the inspection and all three agents before taking over Neo', () => {
  const h = setup(), before = structuredClone(h.cast());
  h.command('act'); h.frame(20);
  assert.deepEqual(h.cast(), before, 'the agents stay offstage while Trinity lifts the receiver');
  h.frame(40);
  assert.equal(h.phone().phase, 'done');
  assert.match(h.command('next'), /特工/);
  assert.equal(h.state().scene, scene.id);
  h.frame(120);
  assert.deepEqual(h.cast().map(agent => agent.currentLocation), roles.map(() => scene.set));
  assert.ok(h.cast().every(agent => agent.currentAction?.parameters.wellsAftermath));
  h.frame(160);
  assert.match(h.state().lastText, /Neo/);
  h.command('next');
  assert.equal(h.state().scene, 'm1_wake_up');
  assert.equal(h.players.getAgent('caller')?.id, 'neo');
  assert.equal(h.state().completed.length, 3);
  assert.deepEqual(h.cast(), before, 'leaving the street releases the agents back to their original state');
});

test('Wells aftermath: Neo wakes at the computer and resumes the saved take before trying the keyboard', () => {
  const h = setup(); h.crash(); h.frame(270); h.command('next');
  const neo = h.players.getAgent('caller')!;
  assert.equal(h.state().scene, 'm1_wake_up');
  assert.equal(h.state().contact?.phase, 'arrival');
  assert.deepEqual(neo.position, filmPosition(neo.currentLocation, -9, -8.8));
  h.frame(18);
  const contact = structuredClone(h.state().contact), action = structuredClone(neo.currentAction);
  h.frame(40, false);
  h.players.release('caller', 9);
  h.sandbox.restore(JSON.parse(JSON.stringify(h.sandbox.state)));
  h.players.possess('caller', 'neo', 9);
  assert.deepEqual(h.state().contact, contact);
  assert.deepEqual(neo.currentAction, action);
  h.command('act');
  assert.equal(h.state().contact?.phase, 'arrival');
  for (let i = 0; i < 80 && h.state().contact?.phase === 'arrival'; i++) h.frame();
  assert.equal(h.state().contact?.phase, 'signal');
  assert.deepEqual(neo.position, filmPosition(neo.currentLocation, -9, -8.8));
  h.command('act');
  assert.equal(h.state().contact?.phase, 'signal');
  h.frame(180);
  assert.equal(h.state().contact?.phase, 'reply');
  assert.equal(h.state().step, 0);
  h.command('act');
  assert.equal(h.state().contact?.phase, 'knocking');
  h.frame(90);
  assert.equal(h.state().contact?.phase, 'door');
  assert.equal(h.state().step, 1);
});

test('Wells aftermath: a paused or released take cold-restores the current pose and caption', () => {
  const h = setup(); h.crash(); h.frame(100);
  const phone = structuredClone(h.phone()), agents = structuredClone(h.cast()), line = h.state().lastText;
  assert.ok(phone.aftermath && phone.aftermath.elapsed > 0);
  h.frame(40, false);
  assert.deepEqual(h.phone(), phone);
  assert.deepEqual(h.cast(), agents);
  h.players.release('caller', 0); h.frame(40);
  h.sandbox.restore(JSON.parse(JSON.stringify(h.sandbox.state)));
  assert.deepEqual(h.phone(), phone);
  assert.deepEqual(h.cast(), agents);
  assert.equal(h.state().lastText, line);
  assert.ok('error' in h.players.possess('observer', 'smith', 0));
  h.players.possess('caller', 'trinity', 0); h.frame();
  assert.ok(h.phone().aftermath!.elapsed > phone.aftermath.elapsed);
});

test('Wells aftermath: an old completed crash starts on resume, without taking a controlled role', () => {
  const h = setup(); h.crash();
  delete h.phone().aftermath;
  const old = structuredClone(h.phone());
  h.sandbox.restore(JSON.parse(JSON.stringify(h.sandbox.state)));
  h.frame(4, false);
  assert.deepEqual(h.phone(), old);
  h.frame();
  assert.ok(h.phone().aftermath, 'the old crash starts the new scene when play resumes');

  const occupied = setup();
  assert.ok('agentId' in occupied.players.possess('observer', 'agent_jones', 0));
  occupied.crash(); occupied.frame(20);
  assert.equal(occupied.phone().aftermath, undefined);
  assert.equal(occupied.players.getAgent('observer')?.id, 'agent_jones');
  assert.match(occupied.command('next'), /特工/);
  occupied.players.release('observer', 0); occupied.frame();
  assert.ok(occupied.phone().aftermath);
});

test('Wells aftermath: a missed pickup stays on the retry branch after impact', () => {
  const h = setup(1.3), before = structuredClone(h.cast());
  h.crash(); h.frame(90);
  assert.equal(h.phone().phase, 'failed');
  assert.equal(h.phone().aftermath, undefined);
  assert.deepEqual(h.cast(), before);
  h.command('retry');
  assert.equal(h.phone().phase, 'running');
  assert.equal(h.phone().attempts, 1);
});

test('Wells aftermath: the saved take moves the cab door and drops the receiver onto the street', t => {
  t.mock.method(THREE.TextureLoader.prototype, 'load', () => new THREE.Texture());
  const previous = Object.getOwnPropertyDescriptor(globalThis, 'document');
  Object.assign(globalThis, { document: { createElement: () => ({ getContext: () => ({ fillRect() {}, strokeRect() {}, fillText() {} }) }) } });
  const h = setup(), renderer = new FilmSetRenderer(new THREE.Scene());
  t.after(() => { renderer.dispose(); if (previous) Object.defineProperty(globalThis, 'document', previous); else Reflect.deleteProperty(globalThis, 'document'); });
  const draw = () => renderer.update(h.caller, h.sandbox.state, 0);
  h.crash(); draw();
  const door = renderer.root.getObjectByName('wells-driver-door')!;
  const receiver = renderer.root.getObjectByName('opening-booth-receiver')!;
  assert.equal(door.rotation.y, 0);
  assert.equal(receiver.visible, false, 'the receiver is out of sight during the crash');
  h.frame(25); draw();
  assert.ok(door.rotation.y < -.9, 'the driver door swings outward during the first shot');
  assert.equal(receiver.visible, true);
  const dropped = receiver.getWorldPosition(new THREE.Vector3()), center = FILM_SETS[scene.set].center;
  const expected = new THREE.Vector3(center.x + WELLS_AFTERMATH.receiver.x, center.y - 1 + WELLS_AFTERMATH.receiver.y, center.z + WELLS_AFTERMATH.receiver.z);
  assert.ok(dropped.distanceTo(expected) < 1e-7);
  assert.ok(Math.abs(new THREE.Box3().setFromObject(receiver).min.y - (center.y - 1)) < .015, 'the receiver rests on the street');
  h.frame(55); draw();
  assert.equal(Math.abs(door.rotation.y), 0);
  assert.ok(receiver.getWorldPosition(new THREE.Vector3()).distanceTo(dropped) < 1e-7);
});

test('Smith keeps his hand against the moving cab grip and his soles supported when he steps out', async t => {
  const source = await actor('smith'), asset = await source.models['load']('smith');
  t.mock.method(GLTFLoader.prototype, 'loadAsync', async () => asset);
  t.mock.method(THREE.TextureLoader.prototype, 'load', () => new THREE.Texture());
  const previous = Object.getOwnPropertyDescriptor(globalThis, 'document');
  Object.assign(globalThis, { document: { createElement: () => ({ getContext: () => ({
    fillRect() {}, strokeRect() {}, fillText() {},
    createImageData: (w: number, h: number) => ({ data: new Uint8ClampedArray(w * h * 4) }), putImageData() {},
  }) }) } });
  const h = setup(), models = new CharacterModels(), smith = h.cast()[0];
  smith.isInMatrix = true; smith.currentLocation = scene.set;
  const rig = models.create(smith);
  const set = FILM_SETS[scene.set], { center } = set, scenery = new THREE.Group();
  scenery.position.set(center.x, center.y - 1, center.z);
  const street = new WellsStreetRenderer(scenery, set);
  t.after(() => { street.dispose(); models.dispose(); source.models.dispose(); if (previous) Object.defineProperty(globalThis, 'document', previous); else Reflect.deleteProperty(globalThis, 'document'); });
  await new Promise(resolve => setImmediate(resolve));
  assert.ok(rig.hero, 'use the delivered Smith model');
  const shoes = rig.hero.root.getObjectByName('shoes01') as THREE.SkinnedMesh;
  const { position, skinIndex, skinWeight } = shoes.geometry.attributes;
  const sides = Array.from({ length: position.count }, (_, i) => {
    let influence = 0;
    for (let j = 1; j < 4; j++) if (skinWeight.getComponent(i, j) > skinWeight.getComponent(i, influence)) influence = j;
    return shoes.skeleton.bones[skinIndex.getComponent(i, influence)].name.endsWith('_L') ? 'left' : 'right';
  });
  const point = new THREE.Vector3();
  function soles(elapsed: number, curbside: WellsAftermathGesture['curbside']) {
    const gesture: WellsAftermathGesture = { role: 'smith', elapsed, curbside }, pose = wellsAftermathPose(gesture);
    rig.root.position.set(center.x + pose.x, center.y - 1 + pose.y, center.z + pose.z);
    rig.root.rotation.y = pose.yaw;
    models.animate(rig, 0, { speed: 0, grounded: pose.y <= .12, verticalVelocity: 0, turn: 0, wellsAftermath: gesture }, 0);
    rig.root.updateMatrixWorld(true); shoes.skeleton.update();
    const low = { left: Infinity, right: Infinity };
    for (let i = 0; i < sides.length; i++) {
      shoes.localToWorld(shoes.getVertexPosition(i, point));
      low[sides[i]] = Math.min(low[sides[i]], point.y - (center.y - 1));
    }
    return low;
  }
  for (const curbside of [true, undefined] as const) {
    const lift = curbside ? WELLS_CURB.truckLift : 0, pavement = curbside ? WELLS_CURB.height : 0;
    const surface = curbside ? 'curbside pavement' : 'legacy street';
    const tread = soles(1.2, curbside);
    assert.ok(Math.abs(tread.left - WELLS_AFTERMATH.lowerStep.y - lift) < .02, 'left shoe meets the lower tread');
    assert.ok(Math.abs(tread.right - WELLS_AFTERMATH.upperStep.y - lift) < .02, 'right shoe meets the upper tread');
    const door = scenery.getObjectByName('wells-driver-door')!;
    const rail = (door.getObjectByName('wells-driver-grip') ?? door.children.at(-1)) as THREE.Mesh;
    rail.geometry.computeBoundingBox();
    const hand = rig.hero.bones.get('wrist_R')!;
    const skin = rig.hero.root.getObjectByName('Anatomical_head_and_hands') as THREE.SkinnedMesh;
    const skinIndex = skin.geometry.attributes.skinIndex, skinWeight = skin.geometry.attributes.skinWeight;
    const handVertices = Array.from({ length: skin.geometry.attributes.position.count }, (_, i) => i).filter(i => {
      let weight = 0;
      for (let j = 0; j < 4; j++) if (/^(wrist|finger).*_R$/.test(skin.skeleton.bones[skinIndex.getComponent(i, j)].name)) weight += skinWeight.getComponent(i, j);
      return weight > .7;
    });
    for (const elapsed of [.96, 1.03, 1.13, 1.3, 1.55]) {
      soles(elapsed, curbside);
      street.update(openingTruckPose({ phase: 'done', lastTick: 0, remaining: 0, attempts: 0, curbside }), wellsAftermathDoor(elapsed));
      scenery.updateMatrixWorld(true);
      const palm = hand.localToWorld(point.set(.21, -.18, .02));
      const gap = rail.geometry.boundingBox!.distanceToPoint(rail.worldToLocal(palm));
      assert.ok(gap < .095, `${surface} ${elapsed}: Smith's palm misses the swinging cab grip by ${gap}`);
      skin.skeleton.update();
      const { min, max } = rail.geometry.boundingBox!;
      let nearest = Infinity, deepest = 0;
      for (const vertex of handVertices) {
        rail.worldToLocal(skin.localToWorld(skin.getVertexPosition(vertex, point)));
        nearest = Math.min(nearest, rail.geometry.boundingBox!.distanceToPoint(point));
        deepest = Math.max(deepest, Math.min(point.x - min.x, max.x - point.x, point.y - min.y, max.y - point.y, point.z - min.z, max.z - point.z));
      }
      assert.ok(nearest < .03 && deepest < .025, `${surface} ${elapsed}: cab grip gap ${nearest}, penetration ${deepest}`);
    }
    for (let frame = 0; frame <= 60; frame++) {
      const elapsed = 1.9 + frame / 100, low = soles(elapsed, curbside);
      assert.ok(low.left >= pavement - .02, `${elapsed}: left sole penetrates the ${surface} by ${pavement - low.left}`);
      assert.ok(low.right >= pavement - .02, `${elapsed}: right sole penetrates the ${surface} by ${pavement - low.right}`);
      assert.ok(Math.min(low.left, low.right) <= pavement + .045, `${elapsed}: a shoe must support the transition to walking`);
    }
  }
});

test('Wells agents look at their targets and only the speaker moves their mouth', async t => {
  const source = await actor('smith'), asset = await source.models['load']('smith');
  t.mock.method(GLTFLoader.prototype, 'loadAsync', async () => asset);
  t.mock.method(THREE.TextureLoader.prototype, 'load', () => new THREE.Texture());
  const previous = Object.getOwnPropertyDescriptor(globalThis, 'document');
  Object.assign(globalThis, { document: { createElement: () => ({ getContext: () => ({
    fillRect() {}, strokeRect() {}, fillText() {},
    createImageData: (w: number, h: number) => ({ data: new Uint8ClampedArray(w * h * 4) }), putImageData() {},
  }) }) } });
  const models = new CharacterModels();
  t.after(() => { models.dispose(); source.models.dispose(); if (previous) Object.defineProperty(globalThis, 'document', previous); else Reflect.deleteProperty(globalThis, 'document'); });
  const rigs = setup().cast().map(agent => models.create(agent));
  await new Promise(resolve => setImmediate(resolve));
  assert.ok(rigs.every(rig => rig.hero), 'use the delivered agent models');
  const heads = rigs.map(rig => rig.hero!.bones.get('head')!);
  const faces = rigs.map(rig => rig.hero!.root.getObjectByName('Anatomical_head_and_hands') as THREE.SkinnedMesh);
  const jawIndices = faces.map(face => face.morphTargetDictionary?.jawOpen);
  assert.ok(jawIndices.every(index => index !== undefined), 'the delivered Smith, Jones and Brown meshes must have a moving jaw');
  const jaws = () => faces.map((face, i) => face.morphTargetInfluences![jawIndices[i]!]);
  const mouths = heads.map(head => head.getObjectByName('smith-mouth')!);
  const lowers = mouths.map(mouth => mouth.getObjectByName('smith-teeth-lower') as THREE.Mesh);
  const uppers = mouths.map(mouth => mouth.getObjectByName('smith-teeth-upper') as THREE.Mesh);
  assert.ok(mouths.every(mouth => !mouth.visible), 'the oral surfaces start hidden');
  const tooth = (mesh: THREE.Mesh, vertex: number) => mesh.localToWorld(new THREE.Vector3().fromBufferAttribute(mesh.geometry.attributes.position, vertex));
  const { center } = FILM_SETS[scene.set];
  const eye = (head: THREE.Bone) => head.localToWorld((head.userData.cameraEye as THREE.Vector3).clone());
  const forward = (head: THREE.Bone) => new THREE.Vector3(0, 0, 1).transformDirection(head.matrixWorld);
  for (const curbside of [true, undefined] as const) {
    const { x, y, z } = WELLS_AFTERMATH.receiver;
    const receiver = new THREE.Vector3(center.x + x, center.y - 1 + y + (curbside ? WELLS_CURB.height : 0), center.z + z);
    function draw(elapsed: number) {
      rigs.forEach((rig, i) => {
        const gesture = { role: WELLS_AFTERMATH.roles[i], elapsed, curbside };
        const pose = wellsAftermathPose(gesture);
        rig.root.position.set(center.x + pose.x, center.y - 1 + pose.y, center.z + pose.z);
        rig.root.rotation.y = pose.yaw;
        models.animate(rig, 0, { speed: pose.speed, grounded: true, verticalVelocity: 0, turn: 0, wellsAftermath: gesture }, 0);
        rig.root.updateWorldMatrix(true, true);
      });
    }
    for (const [start, end, targets] of [
      [6.93, 7.68, [1, 0, 1]],
      [8.48, 9.95, [2, 2, 0]],
      [10.73, 11.14, [2, 0, 0]],
    ] as const) for (let elapsed = start; elapsed < end; elapsed += .05) {
      draw(elapsed);
      targets.forEach((target, i) => {
        const toward = eye(heads[target]).sub(eye(heads[i]));
        const error = THREE.MathUtils.radToDeg(forward(heads[i]).setY(0).angleTo(toward.setY(0)));
        assert.ok(error < 24, `${roles[i]} looks ${error.toFixed(1)}° away from ${roles[target]} at ${elapsed.toFixed(2)}s`);
      });
    }
    draw(5.2);
    const error = THREE.MathUtils.radToDeg(forward(heads[0]).angleTo(receiver.clone().sub(eye(heads[0]))));
    assert.ok(error < 36, `Smith looks ${error.toFixed(1)}° away from the dropped receiver`);
    for (const [start, end, speaker] of [[4.8, 6.3, 0], [6.3, 7.95, 1], [7.95, 10.25, 2], [10.25, 11.85, 0]]) {
      const amounts: number[] = [];
      for (let elapsed = start; elapsed < end; elapsed += .025) {
        draw(elapsed);
        const values = jaws();
        values.forEach((value, i) => { if (i !== speaker) assert.equal(value, 0); });
        amounts.push(values[speaker]);
      }
      assert.ok(Math.max(...amounts) > .35 && Math.min(...amounts) === 0, `${roles[speaker]} opens and closes their mouth during the line`);
    }
    for (const elapsed of [8.05, 9.15, 10.13]) {
      draw(elapsed);
      const blockers: THREE.Mesh[] = [];
      for (const { root } of rigs.slice(0, 2)) {
        root.updateMatrixWorld(true);
        root.traverseVisible(object => {
          if (object instanceof THREE.SkinnedMesh) object.computeBoundingSphere();
          if (object instanceof THREE.Mesh) blockers.push(object);
        });
      }
      for (const aspect of [16 / 9, 780 / 1080]) {
        const camera = new THREE.PerspectiveCamera(50, aspect, .06, 500);
        const controls = Object.assign(Object.create(PlayerControls.prototype) as PlayerControls, { camera });
        controls['wellsAftermathCamera'](elapsed, curbside);
        camera.updateMatrixWorld(true);
        const lips = heads[2].localToWorld(new THREE.Vector3(0, -.085, .28));
        const direction = lips.clone().sub(camera.position);
        const hits = new THREE.Raycaster(camera.position, direction.clone().normalize(), 0, direction.length() - .07)
          .intersectObjects(blockers, false);
        assert.equal(hits.length, 0, `Brown's speaking shot at ${elapsed}s is blocked by ${hits[0]?.object.name}`);
        const projected = lips.project(camera);
        assert.ok(Math.abs(projected.x) < .9 && Math.abs(projected.y) < .9 && Math.abs(projected.z) < 1);
      }
    }
    draw(8.74);
    const brown = jaws(); assert.ok(brown[2] > 0);
    const lower = heads[2].worldToLocal(tooth(lowers[2], 6)), upper = heads[2].worldToLocal(tooth(uppers[2], 6));
    const spacing = tooth(lowers[2], 6).distanceTo(tooth(lowers[2], 63));
    draw(9.88); draw(8.74);
    assert.deepEqual(jaws(), brown, 'restoring a saved dialogue time restores the expression');
    assert.ok(lower.distanceTo(heads[2].worldToLocal(tooth(lowers[2], 6))) < 1e-9);
    for (const rig of rigs) models.animate(rig, 0, { speed: 0, grounded: true, verticalVelocity: 0, turn: 0 }, 0);
    assert.deepEqual(jaws(), [0, 0, 0], 'leaving Wells restores the neutral mouths');
    assert.ok(mouths.every(mouth => !mouth.visible));
    assert.ok(lower.distanceTo(heads[2].worldToLocal(tooth(lowers[2], 6))) > .02, 'the lower teeth follow the mandible');
    assert.ok(upper.distanceTo(heads[2].worldToLocal(tooth(uppers[2], 6))) < 1e-9, 'the upper teeth remain fixed in the head');
    assert.ok(Math.abs(spacing - tooth(lowers[2], 6).distanceTo(tooth(lowers[2], 63))) < .001, 'the lower teeth keep their size');
  }
});
