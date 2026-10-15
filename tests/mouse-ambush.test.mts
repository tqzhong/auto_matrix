import assert from 'node:assert/strict';
import test, { type TestContext } from 'node:test';
import { readFile } from 'node:fs/promises';
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { clone } from 'three/addons/utils/SkeletonUtils.js';
import { AMBUSH_ESCAPE, MOUSE_ROOM_SHOTS, filmPosition, newAmbushEscape, type AgentState, type CombatImpact, type FilmJourney, type SandboxState } from '@auto_matrix/shared';
import { AgentRenderer } from '../packages/client/src/agents/AgentRenderer.js';
import { type CharacterRig } from '../packages/client/src/agents/CharacterModel.js';
import { AmbushSetRenderer } from '../packages/client/src/engine/AmbushSetRenderer.js';
import { SandboxRenderer } from '../packages/client/src/engine/SandboxRenderer.js';
import { Engine } from '../packages/client/src/engine/Engine.js';
import { WorldState } from '../packages/server/src/world/WorldState.js';
import { AgentManager } from '../packages/server/src/agents/AgentManager.js';
import { FilmStorySystem } from '../packages/server/src/story/FilmStorySystem.js';

// Preserve the delivered geometry, skinning and morphs; only external images are
// omitted because these tests inspect posed meshes without a browser or WebGL.
async function fixture(t: TestContext, delayed = false) {
  const pending: Promise<unknown>[] = [], assets = new Map<string, Promise<any>>();
  let release!: () => void; const gate = new Promise<void>(resolve => { release = resolve; }); if (!delayed) release();
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
  const document = globalThis.document;
  globalThis.document = { createElement: () => ({ getContext: () => ({ createImageData: (w: number, h: number) => ({ data: new Uint8ClampedArray(w * h * 4) }), putImageData() {}, fillRect() {}, strokeRect() {}, fillText() {}, createRadialGradient: () => ({ addColorStop() {} }) }) }) } as unknown as Document;
  const world = new WorldState(); new AgentManager(world).initializeAllAgents();
  const neo = world.agents.get('neo')!, mouse = world.agents.get('mouse')!;
  neo.controller = 'ambush-test'; neo.position = filmPosition('film_ambush_house', 11, 31.8); neo.currentLocation = 'film_ambush_house';
  const journey = { scene: 'm1_dejavu', actor: 'neo', step: 1, completed: [], ambushEscape: newAmbushEscape() } as FilmJourney;
  const sandbox = { structures: [], threats: [], neoLife: { journey } } as unknown as SandboxState;
  const story = new FilmStorySystem(world, () => sandbox, () => {}, () => {});
  const scene = new THREE.Scene(), renderer = new AgentRenderer(scene);
  const rigs = renderer as unknown as { agents: Map<string, { rig: CharacterRig }> };
  const render = (delta = 0) => { renderer.update(delta, undefined, 1, 0, journey); scene.updateMatrixWorld(true); };
  const snapshot = (elapsed: number) => {
    journey.ambushEscape!.elapsed = elapsed; story.ambushEscapeFrame(neo, 0, 1);
    renderer.updateAgent('mouse', mouse); render();
  };
  const settle = async () => { release(); await Promise.all(pending); await new Promise(resolve => setImmediate(resolve)); scene.updateMatrixWorld(true); };
  t.after(() => { renderer.dispose(); globalThis.document = document; });
  return { renderer, scene, mouse, journey, sandbox, world, story, snapshot, render, settle, rig: () => rigs.agents.get('mouse')!.rig };
}

function visible(object: THREE.Object3D): boolean {
  for (let parent: THREE.Object3D | null = object; parent; parent = parent.parent) if (!parent.visible) return false;
  return true;
}

function surfaceBounds(root: THREE.Object3D): THREE.Box3 {
  const bounds = new THREE.Box3(), point = new THREE.Vector3();
  root.traverse(object => {
    if (!(object instanceof THREE.Mesh) || !visible(object)) return;
    const indices = object.geometry.index?.array ?? Array.from({ length: object.geometry.attributes.position.count }, (_, i) => i);
    for (const index of new Set<number>(indices)) { object.getVertexPosition(index, point); object.localToWorld(point); bounds.expandByPoint(point); }
  });
  return bounds;
}

function gunState(rig: CharacterRig) {
  assert.ok(rig.hero, 'this assertion must inspect the shipped Mouse rig');
  assert.equal(rig.weapons?.length, 2, 'both of Mouse’s hands retain weapons after model loading');
  for (const [i, gun] of rig.weapons!.entries()) {
    assert.equal(gun.parent, rig.hero.bones.get(i ? 'wrist_L' : 'wrist_R'), 'weapon attachment must move from the fallback elbow to the anatomical wrist');
    assert.ok(visible(gun));
    const direction = new THREE.Vector3(0, -1, 0).applyQuaternion(gun.getWorldQuaternion(new THREE.Quaternion()));
    const forward = new THREE.Vector3(0, 0, 1).applyQuaternion(rig.root.getWorldQuaternion(new THREE.Quaternion())); forward.y = 0; forward.normalize();
    assert.ok(direction.dot(forward) > .8, `barrel faces away from the room entrance: ${direction.toArray()}`);
  }
}

test('the actual ambush snapshot rebuilds both held weapons when Mouse finishes a cold load', async t => {
  const h = await fixture(t, true); h.snapshot(1);
  const fallback = [...h.rig().weapons!]; assert.equal(fallback.length, 2); assert.equal(h.rig().hero, undefined);
  await h.settle(); gunState(h.rig());
  for (const gun of fallback) assert.equal(gun.parent, null, 'a hidden duplicate weapon must not remain attached to the discarded body');
  assert.equal(h.rig().root.getObjectByName('mouse_ship_cap')!.visible, false);
  assert.equal(h.rig().root.getObjectByName('mouse_ship_shirt')!.visible, false);
  assert.equal(h.rig().root.getObjectByName('Tailored_coat_upper')!.visible, true);
});

test('Mouse holds the film silhouette with large cylindrical drums, long barrels and actual muzzle anchors', async t => {
  const h = await fixture(t); h.snapshot(3.25); await h.settle(); h.render();
  for (const gun of h.rig().weapons!) {
    const drum = gun.getObjectByName('mouse-weapon-drum') as THREE.Mesh;
    const barrel = gun.getObjectByName('mouse-weapon-barrel') as THREE.Mesh;
    const muzzle = gun.getObjectByName('mouse-weapon-muzzle');
    assert.ok(drum && barrel && muzzle, 'the film’s broad cylinders and extended barrels cannot remain generic small pistols');
    drum.geometry.computeBoundingBox(); barrel.geometry.computeBoundingBox();
    const drumSize = drum.geometry.boundingBox!.getSize(new THREE.Vector3()).multiply(drum.scale);
    const barrelSize = barrel.geometry.boundingBox!.getSize(new THREE.Vector3()).multiply(barrel.scale);
    assert.ok(drumSize.x > .5 && drumSize.z > .5 && drumSize.x > barrelSize.x * 4, 'the prominent cylindrical silhouette is wider than the barrel');
    assert.ok(barrelSize.y > .8, 'the visible forward barrel must retain the long film silhouette');
    const tip = barrel.localToWorld(new THREE.Vector3(0, barrel.geometry.boundingBox!.min.y, 0));
    assert.ok(tip.distanceTo(muzzle.getWorldPosition(new THREE.Vector3())) < .001, 'the muzzle anchor is at the real open barrel tip');
  }
  const rig = h.rig(); rig.muzzleIndex = 0;
  for (const gun of rig.weapons!) assert.ok(h.renderer.muzzle('mouse')!.distanceTo(gun.getObjectByName('mouse-weapon-muzzle')!.getWorldPosition(new THREE.Vector3())) < .001,
    'production shooting must alternate the two actual extended muzzle positions');
});

test('the film cylinders remain hollow around both actual palms and all finger segments while aiming and firing', async t => {
  const h = await fixture(t); h.snapshot(1); await h.settle();
  for (const elapsed of [1, 3.25]) {
    h.snapshot(elapsed); const rig = h.rig();
    const skin = rig.hero!.root.getObjectByName('Anatomical_head_and_hands') as THREE.SkinnedMesh, a = skin.geometry.attributes;
    for (const [hand, side] of ['R', 'L'].entries()) {
      const drum = rig.weapons![hand].getObjectByName('mouse-weapon-drum') as THREE.Mesh;
      let penetration = 0, checked = 0; const point = new THREE.Vector3();
      for (let vertex = 0; vertex < a.position.count; vertex++) {
        if (![0, 1, 2, 3].some(j => a.skinWeight.getComponent(vertex, j) > .9 && new RegExp(`^(wrist|finger[1-5]-[123])_${side}$`).test(skin.skeleton.bones[a.skinIndex.getComponent(vertex, j)].name))) continue;
        drum.worldToLocal(skin.localToWorld(skin.getVertexPosition(vertex, point))); checked++;
        const radial = Math.hypot(point.x, point.z);
        if (radial > .205 && radial < .336 && Math.abs(point.y) < .179)
          penetration = Math.max(penetration, Math.min(radial - .205, .336 - radial, .179 - Math.abs(point.y)));
      }
      assert.ok(checked > 100, 'inspect the shipped palm and all articulated phalanges, not just bone centers');
      assert.ok(penetration < .015, `${side} hand intersects the cylindrical shell by ${penetration} at saved time ${elapsed}`);
    }
  }
});

test('Mouse supports the heavy cylinders with bent elbows below the chest rather than straight pistol arms', async t => {
  const h = await fixture(t); h.snapshot(1); await h.settle();
  for (const elapsed of [1, 3.25]) {
    h.snapshot(elapsed); const hero = h.rig().hero!;
    for (const side of ['R', 'L']) {
      const shoulder = hero.bones.get('shoulder_' + side)!.getWorldPosition(new THREE.Vector3());
      const elbow = hero.bones.get('elbow_' + side)!.getWorldPosition(new THREE.Vector3());
      const wrist = hero.bones.get('wrist_' + side)!, hand = wrist.getWorldPosition(new THREE.Vector3());
      const upper = elbow.clone().sub(shoulder).normalize(), forearm = hand.clone().sub(elbow).normalize();
      assert.ok(upper.dot(forearm) < .5 && upper.dot(forearm) > -.5, 'both elbows retain a substantial, natural bend');
      assert.ok(shoulder.y - hand.y > shoulder.distanceTo(elbow) * .65,
        `the hands stay well below the shoulder, including recoil: ${side}/${elapsed} shoulder=${shoulder.y} hand=${hand.y}`);
      const palm = new THREE.Vector3(0, -1, 0).applyQuaternion(wrist.getWorldQuaternion(new THREE.Quaternion()));
      assert.ok(palm.dot(forearm) > .9, 'lowering the props must not fold the wrists backwards');
    }
    gunState(h.rig());
  }
});

test('Mouse fires along the aimed barrel into actual room police before the saved recoil lifts the props', async t => {
  const h = await fixture(t), enemies = new SandboxRenderer(h.scene); t.after(() => enemies.dispose());
  const camera = new THREE.PerspectiveCamera();
  for (const [index, beat] of MOUSE_ROOM_SHOTS.entries()) {
    h.snapshot(beat);
    camera.position.set(h.mouse.position.x, h.mouse.position.y + 3, h.mouse.position.z + 12);
    enemies.sync({ nodes: [], incidents: [], missions: {}, ...h.sandbox } as SandboxState, Object.fromEntries(h.world.agents));
    enemies.update(0, camera, true, 1, false); await h.settle();
    enemies.update(0, camera, true, 1, false); h.render();
    const gun = h.rig().weapons![index % 2], muzzle = gun.getObjectByName('mouse-weapon-muzzle')!.getWorldPosition(new THREE.Vector3());
    const direction = new THREE.Vector3(0, -1, 0).applyQuaternion(gun.getWorldQuaternion(new THREE.Quaternion()));
    const rooms = [...(enemies as unknown as { enemies: Map<string, { rig: CharacterRig }> }).enemies.entries()].filter(([id]) => id.startsWith('film:ambush:room:'));
    assert.equal(rooms.length, 2, 'use the two actually spawned and posed room police');
    assert.ok(rooms.every(([, entry]) => entry.rig.detail.visible && !entry.rig.distant.visible), 'ray tests must use the shipped detailed officers rather than distance proxies');
    const hits = new THREE.Raycaster(muzzle, direction, 0, 30).intersectObject(rooms[index % 2][1].rig.root, true).filter(hit => visible(hit.object));
    assert.ok(hits.length, `shot ${index + 1} at ${beat}s must leave the aimed barrel toward the actual officer, direction=${direction.toArray()}`);
    const chest = rooms[index % 2][1].rig.root.localToWorld(new THREE.Vector3(0, 2.55, 0));
    const aimError = new THREE.Ray(muzzle, direction).distanceToPoint(chest);
    assert.ok(aimError < .03, `the held barrel must converge on the actual officer's chest, not just graze an extremity: ${aimError}`);
    const firing = h.rig().hero!.bones.get('shoulder_R')!.quaternion.clone();
    h.snapshot(beat + .04);
    assert.ok(firing.angleTo(h.rig().hero!.bones.get('shoulder_R')!.quaternion) > .08, 'recoil develops after firing, rather than peaking before the projectile leaves');
  }
});

test('the same ambush guns survive V toggles and ordinary shooting drives recoil in the anatomical arms', async t => {
  const h = await fixture(t); h.snapshot(1); await h.settle(); h.render(); const rig = h.rig(), guns = [...rig.weapons!];
  for (const firstPerson of [true, false, true, false]) {
    h.renderer.setPlayer('mouse', firstPerson);
    h.renderer.setPlayerMotion({ speed: 0, grounded: true, verticalVelocity: 0, turn: 0, armed: true, firstPerson }); h.render();
    assert.equal(visible(rig.hero!.root), !firstPerson, 'ordinary first person uses the existing whole-body visibility policy');
    assert.deepEqual(rig.weapons, guns, 'V must not recreate or orphan held weapons');
  }
  h.renderer.setPlayer(null); h.journey.visiting = 'm1_dejavu'; h.render(); gunState(rig);
  const before = rig.hero!.bones.get('shoulder_R')!.quaternion.clone();
  const muzzle = h.renderer.muzzle('mouse')!; assert.ok(muzzle.toArray().every(Number.isFinite));
  h.renderer.impact({ source: 'mouse', target: 'film_soldier', position: h.mouse.position, direction: { x: 1, y: 0, z: 0 }, damage: 1, combo: 0, matrix: true, downed: false, shot: { from: { x: muzzle.x, y: muzzle.y, z: muzzle.z }, surface: 'stone' } });
  // Combat impact deliberately inserts a short hit pause before recoil starts.
  let recoil = 0;
  for (let frame = 0; frame < 12; frame++) { h.render(1 / 60); recoil = Math.max(recoil, before.angleTo(rig.hero!.bones.get('shoulder_R')!.quaternion)); }
  assert.ok(recoil > .05, 'ordinary shooting must still visibly kick the arm after hit pause and the delayed recoil rise');
  gunState(rig);
});

test('Mouse’s delivered finger surfaces contact each pistol handle during the ambush aiming pose', async t => {
  const h = await fixture(t); h.snapshot(1); await h.settle(); h.render(); const rig = h.rig(); gunState(rig);
  const skin = rig.hero!.root.getObjectByName('Anatomical_head_and_hands') as THREE.SkinnedMesh, attrs = skin.geometry.attributes;
  const point = new THREE.Vector3(), handle = new THREE.Box3(new THREE.Vector3(-.0525, -.18, -.005), new THREE.Vector3(.0525, 0, .265));
  const gaps: Record<string, number[]> = {};
  for (const [hand, side] of ['R', 'L'].entries()) {
    const gun = rig.weapons![hand], distances: number[] = [];
    for (let digit = 1; digit <= 5; digit++) {
      let closest = Infinity;
      for (let v = 0; v < attrs.position.count; v++) {
        const controlled = [0, 1, 2, 3].some(j => attrs.skinWeight.getComponent(v, j) > .5 && new RegExp(`^finger${digit}-[123]_${side}$`).test(skin.skeleton.bones[attrs.skinIndex.getComponent(v, j)].name));
        if (!controlled) continue;
        skin.getVertexPosition(v, point); skin.localToWorld(point); gun.worldToLocal(point); closest = Math.min(closest, handle.distanceToPoint(point));
      }
      distances.push(closest);
    }
    gaps[side] = distances;
  }
  assert.ok(Object.values(gaps).flat().every(gap => gap < .055), `digits float away from the actual handles: ${JSON.stringify(gaps)}`);
});

test('the saved ambush firing beat reaches Mouse’s recoil as well as the room light', async t => {
  const h = await fixture(t); h.snapshot(1); await h.settle(); h.render();
  const set = new AmbushSetRenderer(new THREE.Group()); t.after(() => set.dispose());
  const before = h.rig().hero!.bones.get('shoulder_R')!.quaternion.clone();
  h.snapshot(3.25); set.update(h.journey, h.sandbox.structures, 3.25); h.render(1 / 60);
  assert.ok((set as unknown as { gunfire: THREE.PointLight }).gunfire.intensity > 0, '3.25 seconds is a visible flash shortly after the existing 3.2-second gunshot');
  assert.ok(before.angleTo(h.rig().hero!.bones.get('shoulder_R')!.quaternion) > .03, 'the saved burst must move the shooting arm as well as flashing the room');
  const expected = h.rig().hero!.bones.get('shoulder_R')!.quaternion.clone(), muzzle = h.renderer.muzzle('mouse')!;
  const restored = new AgentRenderer(new THREE.Scene()); t.after(() => restored.dispose());
  restored.updateAgent('mouse', JSON.parse(JSON.stringify(h.mouse))); restored.update(0, undefined, 0, 0, h.journey); await h.settle();
  restored.update(0, undefined, 0, 0, h.journey);
  const other = (restored as unknown as { agents: Map<string, { rig: CharacterRig }> }).agents.get('mouse')!.rig;
  assert.ok(expected.angleTo(other.hero!.bones.get('shoulder_R')!.quaternion) < .000001, 'cold paused loading must reconstruct the saved recoil instead of resetting it');
  assert.ok(muzzle.distanceTo(restored.muzzle('mouse')!) < .001, 'the saved pose restores the actual barrel position and heading');
  for (let frame = 0; frame < 10; frame++) restored.update(.1, undefined, 0, 0, h.journey);
  assert.ok(expected.angleTo(other.hero!.bones.get('shoulder_R')!.quaternion) < .000001, 'a paused authoritative clock must freeze the shot');
});

test('a dead ambush save loads lying down immediately and preserves the live corpse pose while paused', async t => {
  const h = await fixture(t); h.snapshot(1); await h.settle(); h.render();
  h.snapshot(AMBUSH_ESCAPE.mouse + .9); assert.equal(h.mouse.status, 'dead');
  for (let frame = 0; frame < 120; frame++) h.render(1 / 60);
  assert.ok(h.rig().weapons!.every(gun => !visible(gun)), 'death must stop displaying the held weapons');
  const floor = h.mouse.position.y - 1, corpse = surfaceBounds(h.rig().hero!.root);
  t.diagnostic(`Settled corpse surface relative to floor: min=${corpse.min.y - floor}, max=${corpse.max.y - floor}`);
  const saved = JSON.parse(JSON.stringify(h.mouse)) as AgentState;
  const restored = new AgentRenderer(new THREE.Scene()); t.after(() => restored.dispose());
  restored.updateAgent('mouse', saved); restored.update(0, undefined, 0, 0, h.journey); await h.settle();
  restored.update(0, undefined, 0, 0, h.journey);
  const body = restored.getAgentBody('mouse')!; body.updateWorldMatrix(true, false); body.updateMatrixWorld(true);
  const up = new THREE.Vector3(0, 1, 0).applyQuaternion(body.getWorldQuaternion(new THREE.Quaternion()));
  assert.ok(Math.abs(up.y) < .1, `paused loading resurrects the upright pose: up=${up.toArray()}`);
  assert.ok(body.quaternion.angleTo(h.rig().root.quaternion) < .01, 'a saved corpse must not restart its fall each time the page loads');
  assert.ok(corpse.min.y - floor >= -.025 && corpse.min.y - floor < .12, `the actual fallen body needs floor support: minY=${corpse.min.y - floor}`);
  const restoredBounds = surfaceBounds(body);
  assert.ok(restoredBounds.min.distanceTo(corpse.min) < .001 && restoredBounds.max.distanceTo(corpse.max) < .001, 'cold loading must preserve actual corpse geometry and ground contact');
  const oldJourney = JSON.parse(JSON.stringify(h.journey)) as FilmJourney; delete oldJourney.ambushEscape;
  restored.update(0, undefined, 0, 0, oldJourney); body.updateMatrixWorld(true);
  const legacyBounds = surfaceBounds(body);
  assert.ok(legacyBounds.min.distanceTo(corpse.min) < .001 && legacyBounds.max.distanceTo(corpse.max) < .001, 'an old dead save without an escape clock stays supported in its final pose');
  saved.status = 'alive'; saved.isInMatrix = false; saved.currentLocation = 'film_neb_deck'; saved.position = filmPosition('film_neb_deck', -4, 19);
  restored.setWorld(false); restored.updateAgent('mouse', saved); restored.update(0);
  assert.ok(Math.abs(body.rotation.z) < .001, 'returning to a living ship scene cannot retain the hotel corpse roll');
});

test('Mouse’s fall uses the saved alarm time and keeps visible mesh support throughout its descent', async t => {
  const h = await fixture(t); h.snapshot(1); await h.settle();
  let previous = -1;
  for (const elapsed of [4.4, 4.6, 4.8, 5.12]) {
    h.snapshot(elapsed); const rig = h.rig(), floor = h.mouse.position.y - 1;
    const bounds = surfaceBounds(rig.hero!.root), rotation = rig.root.quaternion.clone();
    assert.ok(rig.root.rotation.z >= previous, 'the saved fall progresses toward the floor'); previous = rig.root.rotation.z;
    assert.ok(Math.abs(bounds.min.y - floor - .005) < .001, `actual mesh loses floor support at ${elapsed}: ${bounds.min.y - floor}`);
    for (let frame = 0; frame < 12; frame++) h.render(1 / 60);
    const paused = surfaceBounds(rig.hero!.root);
    assert.ok(rotation.angleTo(rig.root.quaternion) < .000001, 'rendering extra frames cannot advance the authoritative fall');
    assert.ok(paused.min.distanceTo(bounds.min) < .001 && paused.max.distanceTo(bounds.max) < .001, 'the body must not breathe or drift under a frozen death clock');
    if (elapsed === 4.6) {
      const restored = new AgentRenderer(new THREE.Scene()); t.after(() => restored.dispose());
      restored.updateAgent('mouse', JSON.parse(JSON.stringify(h.mouse))); restored.update(0, undefined, 0, 0, h.journey); await h.settle();
      restored.update(0, undefined, 0, 0, h.journey);
      const body = restored.getAgentBody('mouse')!; body.updateMatrixWorld(true); const cold = surfaceBounds(body);
      assert.ok(rotation.angleTo(body.quaternion) < .000001, 'a cold save in mid-fall restores the same orientation');
      assert.ok(cold.min.distanceTo(bounds.min) < .001 && cold.max.distanceTo(bounds.max) < .001, 'a cold mid-fall model keeps the same actual floor support');
    }
  }
  assert.ok(Math.abs(previous - Math.PI / 2) < .001);
});

test('returning from the distant corpse proxy remeasures the actual Mouse body floor support', async t => {
  const h = await fixture(t); h.snapshot(1); await h.settle(); h.snapshot(5.3);
  const camera = new THREE.PerspectiveCamera(), floor = h.mouse.position.y - 1;
  for (const distance of [200, 4, 200, 4]) {
    camera.position.set(h.mouse.position.x, h.mouse.position.y, h.mouse.position.z + distance);
    h.renderer.update(0, camera, 0, 0, h.journey); h.scene.updateMatrixWorld(true);
    const bounds = surfaceBounds(h.rig().root);
    assert.ok(Math.abs(bounds.min.y - floor - .005) < .001, `LOD ${distance} loses floor contact: ${bounds.min.y - floor}`);
  }
});


test('a cold load before the second Mouse shot uses its saved left hand without consuming ordinary dual-gun rotation', async t => {
  const h = await fixture(t); h.snapshot(3.15); await h.settle(); h.render();
  const impacts: CombatImpact[] = []; h.story.onImpact = hit => impacts.push(hit);
  h.story.ambushEscapeFrame(h.world.agents.get('neo')!, .06, 2);
  h.renderer.updateAgent('mouse', h.mouse); h.render();
  const hit = impacts.find(hit => hit.source === 'mouse')!; assert.ok(hit, 'continue the actual saved clock through its second firing beat');
  const left = h.rig().weapons![1].getObjectByName('mouse-weapon-muzzle')!.getWorldPosition(new THREE.Vector3());
  const right = h.rig().weapons![0].getObjectByName('mouse-weapon-muzzle')!.getWorldPosition(new THREE.Vector3());
  const selected: THREE.Vector3[] = [];
  const engine = { matrix: true, camera: new THREE.PerspectiveCamera(), agentRenderer: h.renderer,
    sandboxRenderer: { muzzle: () => undefined, impact() {} },
    combatEffects: { impact: (_hit: CombatImpact, _hurt: boolean, muzzle: THREE.Vector3) => selected.push(muzzle.clone()) },
    playerControls: { id: 'neo', impact() {} }, audio: { impact() {} }, filmSets: { impact() {} } };
  engine.camera.position.copy(left);
  for (let i = 0; i < 2; i++) Engine.prototype.showImpact.call(engine as unknown as Engine, hit);
  assert.ok(selected.every(point => point.distanceTo(left) < .001), `saved left-hand event uses the wrong barrel: ${selected.map(point => point.distanceTo(left))}`);
  assert.equal(hit.shot!.hand, 1);
  assert.ok(h.renderer.muzzle('mouse')!.distanceTo(right) < .001, 'explicit scene hands cannot consume the normal weapon cycle');
  assert.ok(h.renderer.muzzle('mouse')!.distanceTo(left) < .001, 'ordinary dual-wield shooting must still alternate');
});

test('a room impact arriving between animation frames uses the newly received pose for its muzzle', async t => {
  const h = await fixture(t); h.snapshot(3.15); await h.settle(); h.render();
  const impacts: CombatImpact[] = []; h.story.onImpact = hit => impacts.push(hit);
  h.story.ambushEscapeFrame(h.world.agents.get('neo')!, .07, 2);
  h.renderer.updateAgent('mouse', h.mouse);
  // A socket delta updates data, but no browser animation frame has run yet.
  const selected: THREE.Vector3[] = [], hit = impacts.find(hit => hit.source === 'mouse')!;
  const engine = { matrix: true, tick: 2, sandbox: h.sandbox, camera: new THREE.PerspectiveCamera(), agentRenderer: h.renderer,
    sandboxRenderer: { update() {}, muzzle: () => undefined, impact() {} },
    combatEffects: { impact: (_hit: CombatImpact, _hurt: boolean, muzzle: THREE.Vector3) => selected.push(muzzle.clone()) },
    playerControls: { id: 'neo', impact() {} }, audio: { impact() {} }, filmSets: { impact() {} } };
  engine.camera.position.copy(h.rig().weapons![1].getObjectByName('mouse-weapon-muzzle')!.getWorldPosition(new THREE.Vector3()));
  Engine.prototype.showImpact.call(engine as unknown as Engine, hit);
  h.render();
  const expected = h.rig().weapons![1].getObjectByName('mouse-weapon-muzzle')!.getWorldPosition(new THREE.Vector3());
  assert.ok(selected[0].distanceTo(expected) < .001, `impact used the previous rendered pose, offset=${selected[0].distanceTo(expected)}`);
});
