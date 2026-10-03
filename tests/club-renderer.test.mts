import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { FILM_SETS, clubRoot, filmPosition, type ClubGesture } from '@auto_matrix/shared';
import { AgentRenderer } from '../packages/client/src/agents/AgentRenderer.js';
import { newMotion } from '../packages/client/src/agents/CharacterMotion.js';
import { WorldState } from '../packages/server/src/world/WorldState.js';
import { AgentManager } from '../packages/server/src/agents/AgentManager.js';

async function geometry(id: string) {
  const glb = await readFile(new URL(`../packages/client/public/assets/characters/${id}.glb`, import.meta.url));
  const length = glb.readUInt32LE(12), source = JSON.parse(glb.subarray(20, 20 + length).toString());
  for (const material of source.materials) { delete material.pbrMetallicRoughness.baseColorTexture; delete material.normalTexture; }
  source.images = []; source.textures = [];
  const json = Buffer.from(JSON.stringify(source)), padded = Buffer.alloc(Math.ceil(json.length / 4) * 4, 32); json.copy(padded);
  const bin = glb.subarray(20 + length), buffer = Buffer.alloc(20 + padded.length + bin.length);
  buffer.writeUInt32LE(0x46546c67, 0); buffer.writeUInt32LE(2, 4); buffer.writeUInt32LE(buffer.length, 8);
  buffer.writeUInt32LE(padded.length, 12); buffer.writeUInt32LE(0x4e4f534a, 16); padded.copy(buffer, 20); bin.copy(buffer, 20 + padded.length);
  return new GLTFLoader().parseAsync(buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength), '');
}

function setup(t: test.TestContext, assets?: Map<string, Awaited<ReturnType<typeof geometry>>>) {
  t.mock.method(THREE.TextureLoader.prototype, 'load', () => new THREE.Texture());
  t.mock.method(GLTFLoader.prototype, 'loadAsync', (url: string) => assets ? Promise.resolve(assets.get(url.split('/').at(-1)!.replace('.glb', ''))!) : new Promise(() => {}));
  const document = globalThis.document;
  const context = { createRadialGradient: () => ({ addColorStop() {} }), fillRect() {}, strokeRect() {}, fillText() {},
    createImageData: (width: number, height: number) => ({ data: new Uint8ClampedArray(width * height * 4) }), putImageData() {} };
  globalThis.document = { createElement: () => ({ width: 0, height: 0, getContext: () => context }) } as unknown as Document;
  const world = new WorldState(); new AgentManager(world).initializeAllAgents();
  const actor = world.agents.get('trinity')!, renderer = new AgentRenderer(new THREE.Scene());
  actor.currentLocation = 'film_white_rabbit_club'; actor.isInMatrix = true;
  const snapshot = (elapsed: number, phase: ClubGesture['phase'] = 'approaching') => {
    const club: ClubGesture = { phase, elapsed, role: 'trinity' }, root = clubRoot(club, 'trinity');
    actor.position = filmPosition('film_white_rabbit_club', root.x, root.z); actor.rotation = root.yaw;
    actor.currentAction = { type: 'idle', parameters: { resolved: true, club }, startedAt: 0, duration: 1, progress: 0 };
    renderer.updateAgent(actor.id, actor);
    const neo = world.agents.get('neo')!, neoRoot = clubRoot(club, 'neo');
    neo.currentLocation = actor.currentLocation; neo.isInMatrix = true;
    neo.position = filmPosition('film_white_rabbit_club', neoRoot.x, neoRoot.z); neo.rotation = neoRoot.yaw;
    neo.currentAction = { type: 'idle', parameters: { club: { ...club, role: 'neo' } }, startedAt: 0, duration: 1, progress: 0 };
    renderer.updateAgent(neo.id, neo);
  };
  t.after(() => { renderer.dispose(); globalThis.document = document; });
  return { actor, renderer, snapshot };
}

test('Trinity walks between snapshots on the club route instead of jumping to each new network position', t => {
  const h = setup(t); h.snapshot(1); h.renderer.update(0);
  h.snapshot(1.5);
  for (let frame = 1; frame <= 5; frame++) {
    h.renderer.update(.1);
    const root = clubRoot({ phase: 'approaching', elapsed: 1 + frame * .1 }, 'trinity'), target = filmPosition('film_white_rabbit_club', root.x, root.z);
    assert.ok(h.renderer.getAgent('trinity')!.position.distanceTo(new THREE.Vector3(target.x, target.y, target.z)) < .001,
      `frame ${frame}: saved encounter time must drive the rendered route`);
  }
  const entry = (h.renderer as unknown as { agents: Map<string, { rig: { motion: { speed: number } } }> }).agents.get('trinity')!;
  assert.ok(entry.rig.motion.speed > 1, 'route displacement must also drive the walking animation when network velocity is zero');
  for (let i = 0; i < 20; i++) h.renderer.update(.1);
  assert.ok(entry.rig.motion.speed < .1, 'she stops moving her legs when no later position has arrived');
});

test('the actual club models plant the supporting shoe while Trinity steps toward Neo’s ear', async t => {
  const assets = new Map(await Promise.all(['neo', 'neo-office', 'neo-tracking', 'trinity', 'trinity-club'].map(async id => [id, await geometry(id)] as const)));
  const h = setup(t, assets); h.snapshot(0, 'whisper'); await new Promise(resolve => setImmediate(resolve));
  h.renderer.update(0, undefined, 0);
  const left = h.renderer.getAgentBody('trinity')!.getObjectByName('ankle_L')!.getWorldPosition(new THREE.Vector3());
  for (const elapsed of [.15, .3, .45, .6]) {
    h.snapshot(elapsed, 'whisper'); h.renderer.update(0, undefined, 0);
    const foot = h.renderer.getAgentBody('trinity')!.getObjectByName('ankle_L')!.getWorldPosition(new THREE.Vector3());
    assert.ok(foot.distanceTo(left) < .004, `Trinity’s supporting foot slides at ${elapsed}: ${foot.distanceTo(left)}`);
  }
});

test('Trinity turns through a route corner over several rendered frames and restores the exact turn on pause', t => {
  const h = setup(t); h.snapshot(1.6); h.renderer.update(0); h.snapshot(2.1);
  let previous = h.renderer.getAgentBody('trinity')!.rotation.y;
  for (let i = 0; i < 5; i++) {
    h.renderer.update(.1); const heading = h.renderer.getAgentBody('trinity')!.rotation.y;
    assert.ok(Math.abs(Math.atan2(Math.sin(heading - previous), Math.cos(heading - previous))) < .25, 'a corner cannot turn her body in a single frame');
    previous = heading;
  }
  h.renderer.update(0, undefined, 0);
  assert.ok(Math.abs(h.renderer.getAgentBody('trinity')!.rotation.y - clubRoot({ phase: 'approaching', elapsed: 2.1 }, 'trinity').yaw) < .001);
});

test('the actual close pose places Trinity’s lips beside Neo’s ear rather than below his face', async t => {
  const assets = new Map(await Promise.all(['neo', 'neo-office', 'neo-tracking', 'trinity', 'trinity-club'].map(async id => [id, await geometry(id)] as const)));
  const h = setup(t, assets); h.snapshot(6, 'whisper'); await new Promise(resolve => setImmediate(resolve)); h.renderer.update(0, undefined, 0);
  const neo = h.renderer.getAgentBody('neo')!, trinity = h.renderer.getAgentBody('trinity')!;
  neo.updateWorldMatrix(true, true); trinity.updateWorldMatrix(true, true);
  const ear = neo.getObjectByName('head')!.localToWorld(new THREE.Vector3(.21, .06, -.025));
  const lips = trinity.getObjectByName('head')!.localToWorld(new THREE.Vector3(0, -.09, .245));
  assert.ok(lips.distanceTo(ear) < .26, `the whisper must reach her listener’s ear: ${lips.distanceTo(ear)}, lips=${lips.toArray()}, ear=${ear.toArray()}`);
});

function surface(mesh: THREE.SkinnedMesh, minimumY = -Infinity) {
  mesh.updateWorldMatrix(true, false); mesh.skeleton.update();
  const center = FILM_SETS.film_white_rabbit_club.center, origin = new THREE.Vector3(center.x, center.y - 1, center.z);
  const points = Array.from({ length: mesh.geometry.attributes.position.count }, (_, i) => mesh.localToWorld(mesh.getVertexPosition(i, new THREE.Vector3())).sub(origin));
  const source = mesh.geometry.index!, indices: number[] = [];
  for (let i = 0; i < source.count; i += 3) {
    const triangle = [source.getX(i), source.getX(i + 1), source.getX(i + 2)];
    if (triangle.every(index => points[index].y >= minimumY)) indices.push(...triangle);
  }
  const geometry = new THREE.BufferGeometry(); geometry.setAttribute('position', new THREE.Float32BufferAttribute(points.flatMap(p => p.toArray()), 3)); geometry.setIndex(indices);
  const result = new THREE.Mesh(geometry, new THREE.MeshBasicMaterial({ side: THREE.DoubleSide })); result.updateMatrixWorld(true);
  return { mesh: result, points: [...new Set(indices)].map(i => points[i]), dispose: () => { geometry.dispose(); result.material.dispose(); } };
}

function inside(point: THREE.Vector3, target: THREE.Mesh): boolean {
  const intersections = new THREE.Raycaster(point.clone().add(new THREE.Vector3(8, 0, 0)), new THREE.Vector3(-1, 0, 0), 0, 8 - .002).intersectObject(target, false);
  return new Set(intersections.map(hit => Math.round(hit.distance * 10000))).size % 2 === 1;
}

test('actual shoe soles stay above the floor and neither shoes nor head skin overlap throughout the close steps and retreat', async t => {
  const assets = new Map(await Promise.all(['neo', 'neo-office', 'neo-tracking', 'trinity', 'trinity-club'].map(async id => [id, await geometry(id)] as const)));
  const h = setup(t, assets); h.snapshot(0, 'whisper'); await new Promise(resolve => setImmediate(resolve));
  const samples: [ClubGesture['phase'], number][] = [0, .15, .35, .65, .95, 1.25, 1.55, 1.8, 6, 13.9].map(elapsed => ['whisper', elapsed]);
  samples.push(['question', 0], ['reply', 3], ['departing', .4], ['departing', 1], ['departing', 1.48]);
  for (const [phase, elapsed] of samples) {
    h.snapshot(elapsed, phase); h.renderer.update(0, undefined, 0);
    const bodies = ['neo', 'trinity'].map(id => h.renderer.getAgentBody(id)!);
    const heads = bodies.map(body => surface(body.getObjectByName('Anatomical_head_and_hands') as THREE.SkinnedMesh,
      body.getObjectByName('head')!.getWorldPosition(new THREE.Vector3()).y - .25));
    const shoes = bodies.map(body => surface(body.getObjectByName('shoes01') as THREE.SkinnedMesh));
    try {
      for (const [i, id] of ['neo', 'trinity'].entries()) {
        const lowest = Math.min(...shoes[i].points.map(point => point.y));
        assert.ok(lowest >= -.015 && lowest < .12, `${id} needs real sole contact at ${phase} ${elapsed}: ${lowest}`);
        assert.ok(heads[i].points.length > 500, 'head checks must use the delivered skinned geometry');
        for (let vertex = 0; vertex < heads[i].points.length; vertex += 64)
          assert.equal(inside(heads[i].points[vertex], heads[1 - i].mesh), false, `${id} head penetrates the speaker at ${phase} ${elapsed}`);
        for (let vertex = 0; vertex < shoes[i].points.length; vertex += 32)
          assert.equal(inside(shoes[i].points[vertex], shoes[1 - i].mesh), false, `${id} shoes penetrate the other character at ${phase} ${elapsed}`);
      }
    } finally { heads.forEach(head => head.dispose()); shoes.forEach(shoe => shoe.dispose()); }
  }
});

test('a paused reload restores the actual head and foot pose at the middle of a step', async t => {
  const assets = new Map(await Promise.all(['neo', 'neo-office', 'neo-tracking', 'trinity', 'trinity-club'].map(async id => [id, await geometry(id)] as const)));
  const h = setup(t, assets); h.snapshot(.9, 'whisper'); await new Promise(resolve => setImmediate(resolve)); h.renderer.update(0, undefined, 0);
  const pose = () => ['neo', 'trinity'].flatMap(id => {
    const body = h.renderer.getAgentBody(id)!; body.updateWorldMatrix(true, true);
    return ['head', 'ankle_R', 'ankle_L'].map(name => ({ position: body.getObjectByName(name)!.getWorldPosition(new THREE.Vector3()),
      rotation: body.getObjectByName(name)!.getWorldQuaternion(new THREE.Quaternion()) }));
  });
  const before = pose(); h.renderer.update(.2, undefined, 0);
  h.renderer.removeAgent('neo'); h.renderer.removeAgent('trinity'); h.snapshot(.9, 'whisper');
  await new Promise(resolve => setImmediate(resolve)); h.renderer.update(0, undefined, 0);
  pose().forEach((joint, i) => {
    assert.ok(joint.position.distanceTo(before[i].position) < .001, 'loading cannot restart the planted/swinging foot or the head lean');
    assert.ok(Math.abs(joint.rotation.dot(before[i].rotation)) > .99999, 'loading restores the saved shoe and head orientation');
  });
});

test('the close pose releases Neo’s feet when he walks away while Trinity is still departing', async t => {
  const assets = new Map(await Promise.all(['neo', 'neo-office', 'neo-tracking', 'trinity', 'trinity-club'].map(async id => [id, await geometry(id)] as const)));
  const h = setup(t, assets); h.snapshot(.7, 'departing'); await new Promise(resolve => setImmediate(resolve));
  const neo = h.renderer.getAgentState('neo')!; neo.currentAction = null; neo.position = filmPosition('film_white_rabbit_club', 9, -3);
  h.renderer.updateAgent('neo', neo); h.renderer.setPlayer('neo');
  const group = h.renderer.getAgent('neo')!; group.position.set(neo.position.x, neo.position.y, neo.position.z);
  h.renderer.setPlayerMotion({ speed: 3, grounded: true, verticalVelocity: 0, turn: 0 });
  h.renderer.update(.1);
  const feet = () => ['R', 'L'].map(side => h.renderer.getAgentBody('neo')!.getObjectByName(`ankle_${side}`)!.getWorldPosition(new THREE.Vector3()));
  const walking = feet(); h.actor.currentAction = null; h.renderer.updateAgent('trinity', h.actor);
  const entry = (h.renderer as unknown as { agents: Map<string, { rig: { motion: ReturnType<typeof newMotion> } }> }).agents.get('neo')!;
  entry.rig.motion = newMotion(); h.renderer.update(.1);
  feet().forEach((foot, i) => assert.ok(foot.distanceTo(walking[i]) < .001, 'departing Trinity cannot change Neo’s ordinary walking gait or anchor his shoes to the meeting point'));
});

test('a paused club load restores the exact saved root and heading and does not replay a stale approach', t => {
  const h = setup(t); h.snapshot(2); h.renderer.update(0); h.snapshot(2.5); h.renderer.update(.1);
  h.renderer.update(.1, undefined, 0);
  const root = clubRoot({ phase: 'approaching', elapsed: 2.5 }, 'trinity'), target = filmPosition('film_white_rabbit_club', root.x, root.z);
  assert.ok(h.renderer.getAgent('trinity')!.position.distanceTo(new THREE.Vector3(target.x, target.y, target.z)) < .001);
  assert.ok(Math.abs(h.renderer.getAgentBody('trinity')!.rotation.y - root.yaw) < .001);
  const paused = h.renderer.getAgent('trinity')!.position.clone();
  for (let i = 0; i < 10; i++) h.renderer.update(.1, undefined, 0);
  assert.deepEqual(h.renderer.getAgent('trinity')!.position, paused);
  h.snapshot(.8, 'whisper'); h.renderer.update(0, undefined, 0);
  const loaded = clubRoot({ phase: 'whisper', elapsed: .8 }, 'trinity');
  assert.deepEqual(h.renderer.getAgent('trinity')!.position.toArray(), Object.values(filmPosition('film_white_rabbit_club', loaded.x, loaded.z)));
  assert.ok(Math.abs(h.renderer.getAgentBody('trinity')!.rotation.y - loaded.yaw) < .001, 'loading a different phase cannot retain the walking turn');
});

test('Trinity finishes the final approach and return steps before settling into the waiting snapshot', t => {
  const h = setup(t);
  for (const [moving, waiting] of [['approaching', 'ready'], ['departing', 'done']] as const) {
    h.snapshot(7.5, moving); h.renderer.update(0);
    h.snapshot(0, waiting);
    for (let frame = 1; frame <= 5; frame++) {
      h.renderer.update(.1);
      const root = clubRoot({ phase: moving, elapsed: 7.5 + frame * .1 }, 'trinity'), target = filmPosition('film_white_rabbit_club', root.x, root.z);
      assert.ok(h.renderer.getAgent('trinity')!.position.distanceTo(new THREE.Vector3(target.x, target.y, target.z)) < .001,
        `${moving} frame ${frame}: entering ${waiting} cannot skip the last walking segment`);
    }
    h.renderer.update(.1); const end = clubRoot({ phase: waiting, elapsed: 0 }, 'trinity');
    assert.ok(h.renderer.getAgent('trinity')!.position.distanceTo(new THREE.Vector3(...Object.values(filmPosition('film_white_rabbit_club', end.x, end.z)))) < .001);
  }
});

test('responding immediately or receiving another waiting packet does not skip Trinity’s last approach step', t => {
  const h = setup(t); h.snapshot(7.5); h.renderer.update(0); h.snapshot(0, 'ready'); h.renderer.update(.1);
  h.snapshot(0, 'ready'); h.renderer.update(.1); h.snapshot(.1, 'introduction'); h.renderer.update(.1);
  const root = clubRoot({ phase: 'approaching', elapsed: 7.8 }, 'trinity'), target = filmPosition('film_white_rabbit_club', root.x, root.z);
  assert.ok(h.renderer.getAgent('trinity')!.position.distanceTo(new THREE.Vector3(target.x, target.y, target.z)) < .001,
    'an early response must not restart or truncate the final segment');
  h.renderer.update(.2); const end = clubRoot({ phase: 'introduction', elapsed: .1 }, 'trinity');
  assert.ok(h.renderer.getAgent('trinity')!.position.distanceTo(new THREE.Vector3(...Object.values(filmPosition('film_white_rabbit_club', end.x, end.z)))) < .001);
});

test('pausing during a terminal route segment restores the saved waiting pose without replaying that segment', t => {
  const h = setup(t);
  for (const [moving, waiting] of [['approaching', 'ready'], ['departing', 'done']] as const) {
    h.snapshot(7.5, moving); h.renderer.update(0); h.snapshot(0, waiting); h.renderer.update(.1);
    h.renderer.update(.1, undefined, 0); const root = clubRoot({ phase: waiting, elapsed: 0 }, 'trinity');
    assert.deepEqual(h.renderer.getAgent('trinity')!.position.toArray(), Object.values(filmPosition('film_white_rabbit_club', root.x, root.z)));
    const turn = h.renderer.getAgentBody('trinity')!.rotation.y - root.yaw;
    assert.ok(Math.abs(Math.atan2(Math.sin(turn), Math.cos(turn))) < .001);
    const paused = h.renderer.getAgent('trinity')!.position.clone(); h.renderer.update(.1);
    assert.deepEqual(h.renderer.getAgent('trinity')!.position, paused, 'continuing cannot replay the unfinished rendered segment');
  }
});
