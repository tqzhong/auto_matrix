import assert from 'node:assert/strict';
import test, { type TestContext } from 'node:test';
import { readFile } from 'node:fs/promises';
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { clone } from 'three/addons/utils/SkeletonUtils.js';
import { FILM_SETS, MOUSE_ROOM_SHOTS, MOUSE_ROOM_RETURN, filmPosition, newAmbushEscape, type AgentState, type CombatImpact, type FilmJourney, type SandboxState } from '@auto_matrix/shared';
import { PlayerControls } from '../packages/client/src/player/PlayerControls.js';
import { Engine } from '../packages/client/src/engine/Engine.js';
import { AgentRenderer } from '../packages/client/src/agents/AgentRenderer.js';
import { SandboxRenderer } from '../packages/client/src/engine/SandboxRenderer.js';
import { AmbushSetRenderer } from '../packages/client/src/engine/AmbushSetRenderer.js';
import { weaponMuzzle, type CharacterRig } from '../packages/client/src/agents/CharacterModel.js';
import { WorldState } from '../packages/server/src/world/WorldState.js';
import { AgentManager } from '../packages/server/src/agents/AgentManager.js';
import { FilmStorySystem } from '../packages/server/src/story/FilmStorySystem.js';

function setup(t: TestContext) {
  class Target extends EventTarget { matches() { return false; } }
  const window = new Target(), canvas = new Target();
  const context = { createImageData: (w: number, h: number) => ({ data: new Uint8ClampedArray(w * h * 4) }), putImageData() {},
    fillRect() {}, strokeRect() {}, fillText() {}, createRadialGradient: () => ({ addColorStop() {} }) };
  const document = Object.assign(new Target(), { pointerLockElement: canvas, hidden: false, exitPointerLock() {},
    createElement: () => ({ width: 0, height: 0, getContext: () => context }) });
  const previous = ['window', 'document'].map(key => Object.getOwnPropertyDescriptor(globalThis, key)); Object.assign(globalThis, { window, document });
  const world = new WorldState(); new AgentManager(world).initializeAllAgents();
  const neo = world.agents.get('neo')!; neo.controller = 'camera-test'; neo.currentLocation = 'film_ambush_house'; neo.isInMatrix = true;
  neo.position = filmPosition('film_ambush_house', 11, 31.8); neo.rotation = 1.2;
  const journey = { scene: 'm1_dejavu', actor: 'neo', step: 1, completed: [], ambushEscape: newAmbushEscape() } as FilmJourney;
  const sandbox = { nodes: [], structures: [], threats: [], incidents: [], missions: {}, neoLife: { journey, missions: {} } } as unknown as SandboxState;
  const story = new FilmStorySystem(world, () => sandbox, () => {}, () => {});
  const camera = new THREE.PerspectiveCamera(57, 16 / 9, .5, 5000), group = new THREE.Group(); group.add(new THREE.Group());
  const controls = new PlayerControls(canvas as unknown as HTMLCanvasElement, camera, () => {}, () => {}); controls.possess(neo);
  const engine = { playerControls: controls, running: false, sandboxRenderer: { sync() {} }, updateAtmosphere() {} } as unknown as Engine;
  const sync = () => Engine.prototype.setSandbox.call(engine, sandbox, Object.fromEntries(world.agents));
  const frame = (elapsed: number | undefined, running = false) => {
    if (elapsed === undefined) journey.ambushEscape!.phase = 'descending';
    else { journey.ambushEscape!.phase = 'alarm'; journey.ambushEscape!.elapsed = elapsed; }
    story.ambushEscapeFrame(neo, 0, 1); sync(); controls.update(.016, neo, group, running); camera.updateMatrixWorld(true);
  };
  const key = (code: string, down = true) => window.dispatchEvent(Object.assign(new Event(down ? 'keydown' : 'keyup'), { code, repeat: false }));
  const look = () => document.dispatchEvent(Object.assign(new Event('mousemove'), { movementX: 120, movementY: -40 }));
  t.after(() => { controls.dispose(); ['window', 'document'].forEach((key, i) => {
    if (previous[i]) Object.defineProperty(globalThis, key, previous[i]!); else Reflect.deleteProperty(globalThis, key);
  }); });
  return { world, neo, journey, sandbox, story, camera, group, controls, frame, key, look, sync };
}

async function actualModels(t: TestContext) {
  const pending: Promise<unknown>[] = [], assets = new Map<string, Promise<any>>();
  const gate = Promise.resolve();
  t.mock.method(GLTFLoader.prototype, 'loadAsync', async url => {
    const name = String(url).split('/').pop()!;
    if (!assets.has(name)) assets.set(name, (async () => {
      await gate;
      const raw = await readFile(new URL(`../packages/client/public/assets/characters/${name}`, import.meta.url)), size = raw.readUInt32LE(12);
      const doc = JSON.parse(raw.subarray(20, 20 + size).toString());
      for (const material of doc.materials) { delete material.pbrMetallicRoughness.baseColorTexture; delete material.normalTexture; }
      doc.images = []; doc.textures = [];
      const json = Buffer.from(JSON.stringify(doc)), padded = Buffer.alloc(Math.ceil(json.length / 4) * 4, 32); json.copy(padded);
      const bin = raw.subarray(20 + size), data = Buffer.alloc(20 + padded.length + bin.length);
      data.writeUInt32LE(0x46546c67); data.writeUInt32LE(2, 4); data.writeUInt32LE(data.length, 8);
      data.writeUInt32LE(padded.length, 12); data.writeUInt32LE(0x4e4f534a, 16); padded.copy(data, 20); bin.copy(data, 20 + padded.length);
      return new GLTFLoader().parseAsync(data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength), '');
    })());
    const promise = assets.get(name)!; pending.push(promise); const asset = await promise; return { ...asset, scene: clone(asset.scene) };
  });

  t.mock.method(THREE.TextureLoader.prototype, 'load', () => new THREE.Texture());
  return async () => { await Promise.all(pending); await new Promise(resolve => setImmediate(resolve)); };
}

function visible(object: THREE.Object3D): boolean {
  for (let p: THREE.Object3D | null = object; p; p = p.parent) if (!p.visible) return false;
  return true;
}

async function roomScene(t: TestContext) {
  const h = setup(t), settle = await actualModels(t), scene = new THREE.Scene(), agents = new AgentRenderer(scene), enemies = new SandboxRenderer(scene);
  agents.setPlayer('neo', false);
  const setRoot = new THREE.Group(), center = FILM_SETS.film_ambush_house.center; setRoot.position.set(center.x, center.y - 1, center.z);
  const set = new AmbushSetRenderer(setRoot); t.after(() => { agents.dispose(); enemies.dispose(); set.dispose(); });
  const officers = (renderer = enemies) => [...(renderer as unknown as { enemies: Map<string, { rig: CharacterRig }> }).enemies.entries()]
    .filter(([id]) => id.startsWith('film:ambush:room:')).sort(([a], [b]) => a.localeCompare(b)).map(([, entry]) => entry.rig);
  const mouse = () => (agents as unknown as { agents: Map<string, { rig: CharacterRig }> }).agents.get('mouse')!.rig;
  const render = (delta = 0, running = false) => {
    agents.update(delta, h.camera, running ? 1 : 0, 1, h.journey); enemies.update(delta, h.camera, true, 1, running);
    set.update(h.journey, h.sandbox.structures, h.journey.ambushEscape!.elapsed); scene.updateMatrixWorld(true); setRoot.updateMatrixWorld(true);
  };
  const show = async (elapsed: number, delta = 0, running = false) => {
    h.journey.ambushEscape!.mouseDead = false; h.world.agents.get('mouse')!.status = 'alive'; h.frame(elapsed);
    agents.updateAgent('mouse', h.world.agents.get('mouse')!); enemies.sync({ ...h.sandbox }, Object.fromEntries(h.world.agents));
    await settle(); render(delta, running); await settle(); render(0, running);
  };
  return { ...h, scene, agents, enemies, setRoot, settle, officers, mouse, render, show };
}

test('the saved third-person room cut frames actual Mouse and room officers through the doorway without moving Neo', async t => {
  const h = await roomScene(t), center = FILM_SETS.film_ambush_house.center, setRoot = h.setRoot;
  const initial = { ...h.neo.position };
  for (const aspect of [16 / 9, .8]) for (const elapsed of [.8, 1.3, 1.8, 2.2, 2.8, 3.25, 4.1, 4.9]) {
    h.camera.aspect = aspect; await h.show(elapsed);
    assert.ok(h.camera.position.distanceTo(new THREE.Vector3(center.x - 20, center.y + 5, center.z - 10)) < 8,
      'the alarm should show 1313 rather than the distant staircase');
    assert.deepEqual(h.neo.position, initial); assert.deepEqual(h.group.position.toArray(), [initial.x, initial.y, initial.z]); assert.equal(h.controls.performing, false);
    const mouse = h.mouse(), room = h.officers();
    assert.ok(mouse.hero, 'inspect the delivered Mouse GLB');
    assert.equal(room.length, 2, 'frame the actual room threats');
    for (const rig of elapsed < 2.2 ? [mouse] : [mouse, ...room]) {
      let outside = 0, total = 0; const point = new THREE.Vector3();
      rig.root.traverseVisible(object => {
        if (!(object instanceof THREE.Mesh)) return;
        for (let v = 0; v < object.geometry.attributes.position.count; v++) {
          object.getVertexPosition(v, point); object.localToWorld(point); point.project(h.camera); total++;
          if (Math.abs(point.x) > .98 || Math.abs(point.y) > .98 || point.z <= -1 || point.z >= 1) outside++;
        }
      });
      assert.equal(outside, 0, `aspect=${aspect}, alarm=${elapsed}: ${outside}/${total} actual body/weapon vertices are cropped`);
      const head = rig.hero?.bones.get('head') ?? rig.head, target = head.getWorldPosition(new THREE.Vector3()), direction = target.clone().sub(h.camera.position);
      const hits = new THREE.Raycaster(h.camera.position, direction.clone().normalize(), .1, direction.length() - .1).intersectObject(setRoot, true).filter(hit => visible(hit.object));
      assert.equal(hits.length, 0, `aspect=${aspect}, alarm=${elapsed}: architecture hides the actor's head at ${hits.map(hit => hit.point.toArray()).join(';')}`);
    }
    const before = h.camera.position.clone(), rotation = h.camera.quaternion.clone(); h.frame(elapsed);
    assert.ok(before.distanceTo(h.camera.position) < 1e-8 && rotation.angleTo(h.camera.quaternion) < 1e-8, 'a paused saved cut cannot ease toward a different frame');
  }
});

test('V preserves Neo first person, moving cancels the cut for this alarm, and leaving restores the follow camera', t => {
  const h = setup(t); h.frame(3.25); const room = h.camera.position.clone();
  h.key('KeyV'); h.key('KeyV', false); h.frame(3.25);
  assert.equal(h.controls.firstPerson, true); assert.ok(h.camera.position.distanceTo(h.group.position) < 5, 'V must return to Neo eyes, not Mouse');
  const direction = h.camera.getWorldDirection(new THREE.Vector3()); h.look(); h.frame(3.25);
  assert.ok(direction.distanceTo(h.camera.getWorldDirection(new THREE.Vector3())) > .1, 'first-person free look still works');
  h.key('KeyV'); h.key('KeyV', false); h.frame(3.25); assert.ok(h.camera.position.distanceTo(room) < 1e-8);
  h.key('KeyW'); h.frame(3.25, true); h.key('KeyW', false);
  assert.ok(h.camera.position.distanceTo(h.group.position) < 15, 'movement restores follow view before the player walks blind');
  h.frame(3.25, true); assert.ok(h.camera.position.distanceTo(h.group.position) < 15, 'releasing W cannot reenter the cut mid-alarm');
  h.frame(undefined); assert.equal(h.controls.ambushAlarm, undefined); assert.equal(h.controls.performing, false);
  assert.equal(h.camera.near, .5);
  h.controls.possess(h.neo); h.frame(3.25); assert.ok(h.camera.position.distanceTo(room) < 1e-8, 'cold possession can view a saved alarm');
  h.frame(5.8); assert.ok(h.camera.position.distanceTo(h.group.position) < 15, 'the short cut ends before descent resumes');
});

test('the Engine alarm handoff excludes visits and other controlled characters', t => {
  const h = setup(t); h.frame(3.25); assert.equal(h.controls.ambushAlarm, 3.25);
  h.journey.visiting = 'm1_dejavu'; h.sync(); assert.equal(h.controls.ambushAlarm, undefined);
  delete h.journey.visiting; h.journey.actor = 'trinity'; h.controls.id = 'trinity'; h.sync(); assert.equal(h.controls.ambushAlarm, undefined);
  h.journey.actor = 'neo'; h.controls.id = 'neo'; h.journey.ambushEscape!.phase = 'descending'; h.sync(); assert.equal(h.controls.ambushAlarm, undefined);
});

test('saved alarm snapshots do not duplicate actual impact gunfire and retain the death cue', t => {
  const h = setup(t), sounds: string[] = [], before = structuredClone(h.sandbox);
  before.neoLife!.journey!.ambushEscape!.elapsed = 2.7;
  h.journey.ambushEscape!.elapsed = 4.45; h.journey.ambushEscape!.mouseDead = true;
  const engine = { playerControls: h.controls, running: true, sandbox: before, sandboxRenderer: { sync() {} }, updateAtmosphere() {},
    audio: { governmentSound: (name: string) => sounds.push(name), theOneSound: (name: string) => sounds.push(name) } } as unknown as Engine;
  Engine.prototype.setSandbox.call(engine, h.sandbox, Object.fromEntries(h.world.agents));
  assert.deepEqual(sounds, ['flatline'], 'shot sounds belong to the authoritative impact events, not snapshot threshold crossings');
});


function inside(object: THREE.Object3D, parent: THREE.Object3D): boolean {
  for (let p: THREE.Object3D | null = object; p; p = p.parent) if (p === parent) return true;
  return false;
}

function barrel(rig: CharacterRig, hand = 0) {
  const muzzle = weaponMuzzle(rig, hand)!, gun = rig.weapons![hand];
  return new THREE.Raycaster(muzzle, new THREE.Vector3(0, -1, 0).applyQuaternion(gun.getWorldQuaternion(new THREE.Quaternion())), 0, 30);
}

test('each actual firing barrel contacts the intended delivered body before the room architecture', async t => {
  const h = await roomScene(t);
  const impacts: CombatImpact[] = []; h.story.onImpact = impact => impacts.push(impact);
  const fireAt = async (beat: number, source: string) => {
    await h.show(beat - .0625); impacts.length = 0;
    h.story.ambushEscapeFrame(h.neo, .0625, 1);
    const hit = impacts.find(impact => impact.source === source);
    assert.ok(hit?.shot, `the authoritative clock must actually emit ${source}'s shot at ${beat}`);
    await h.show(beat);
    return hit;
  };
  const check = (ray: THREE.Raycaster, target: CharacterRig, event: CombatImpact, label: string) => {
    assert.ok(target.hero || visible(target.detail), `${label}: use the delivered detailed body, not a distant proxy`);
    const all = ray.intersectObject(target.root, true).filter(hit => visible(hit.object));
    const bodies = all.filter(hit => !(target.weapons ?? []).some(gun => inside(hit.object, gun)));
    assert.ok(bodies.length, `${label}: the actual barrel misses every visible body triangle`);
    assert.equal(all[0], bodies[0], `${label}: a held weapon intercepts the supposed body hit`);
    const architecture = ray.intersectObject(h.setRoot, true).filter(hit => visible(hit.object));
    assert.ok(!architecture.length || bodies[0].distance < architecture[0].distance, `${label}: a door or wall intercepts the shot`);
    const destination = new THREE.Vector3(event.position.x, event.position.y, event.position.z), error = ray.ray.distanceToPoint(destination);
    assert.ok(error < .03, `${label}: the actual impact tracer destination deviates ${error} from the held barrel; muzzle=${ray.ray.origin.toArray()}, direction=${ray.ray.direction.toArray()}, destination=${destination.toArray()}`);
  };
  for (const [index, beat] of MOUSE_ROOM_SHOTS.entries()) {
    const hit = await fireAt(beat, 'mouse');
    assert.equal(hit.shot!.hand, index % 2, 'a saved shot must carry its firing hand rather than reuse a local alternating counter');
    check(barrel(h.mouse(), hit.shot!.hand), h.officers()[index % 2], hit, `Mouse shot ${index + 1}`);
  }
  for (const [index, beat] of MOUSE_ROOM_RETURN.entries()) {
    const hit = await fireAt(beat, `film:ambush:room:${index % 2}`);
    check(barrel(h.officers()[index % 2]), h.mouse(), hit, `officer shot ${index + 1}`);
  }
});

function roomSurface(rig: CharacterRig): number[] {
  const values: number[] = [], point = new THREE.Vector3();
  rig.root.traverseVisible(object => {
    if (!(object instanceof THREE.Mesh)) return;
    for (let v = 0; v < object.geometry.attributes.position.count; v++) {
      object.getVertexPosition(v, point); object.localToWorld(point); values.push(point.x, point.y, point.z);
    }
  });
  const ray = barrel(rig); values.push(...ray.ray.origin.toArray(), ...ray.ray.direction.toArray());
  return values;
}

function sameRoomSurface(actual: number[], expected: number[], label: string): void {
  assert.equal(actual.length, expected.length, `${label}: visible delivered geometry changed`);
  let worst = 0; for (let i = 0; i < actual.length; i++) worst = Math.max(worst, Math.abs(actual[i] - expected[i]));
  assert.ok(worst < 1e-6, `${label}: actual visible geometry/muzzle drift ${worst}`);
}

test('running room officers preserve actual body, gun and muzzle pose through nonzero RAF pause and JSON cold reconstruction', async t => {
  const h = await roomScene(t); await h.show(.8);
  for (const elapsed of [1.95, 2.65, 3.04, 3.44, 4.44]) {
    await h.show(elapsed - .1, .1, true); await h.show(elapsed, .1, true);
    const before = h.officers().map(roomSurface); assert.equal(before.length, 2);
    for (let frame = 0; frame < 12; frame++) h.render(.016, false);
    h.officers().forEach((rig, index) => sameRoomSurface(roomSurface(rig), before[index], `pause ${elapsed}, officer ${index}`));
    const saved = JSON.parse(JSON.stringify({ sandbox: h.sandbox, actors: Object.fromEntries(h.world.agents) })) as { sandbox: SandboxState; actors: Record<string, AgentState> };
    const scene = new THREE.Scene(), cold = new SandboxRenderer(scene);
    try {
      cold.sync(saved.sandbox, saved.actors); cold.update(.016, h.camera, true, 1, false); await h.settle();
      cold.update(.016, h.camera, true, 1, false); scene.updateMatrixWorld(true);
      const restored = h.officers(cold); assert.equal(restored.length, before.length, `cold ${elapsed}: both saved officers must be reconstructed`);
      restored.forEach((rig, index) => sameRoomSurface(roomSurface(rig), before[index], `cold ${elapsed}, officer ${index}`));
    } finally { cold.dispose(); }
  }
});
