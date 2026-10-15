import assert from 'node:assert/strict';
import test, { type TestContext } from 'node:test';
import { readFile } from 'node:fs/promises';
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { clone } from 'three/addons/utils/SkeletonUtils.js';
import { CharacterModels } from '../packages/client/src/agents/CharacterModel.js';
import { AgentRenderer } from '../packages/client/src/agents/AgentRenderer.js';
import { FILM_SETS, type FilmJourney } from '@auto_matrix/shared';
import { WorldState } from '../packages/server/src/world/WorldState.js';
import { AgentManager } from '../packages/server/src/agents/AgentManager.js';
import type { MotionInput } from '../packages/client/src/agents/CharacterMotion.js';

async function fixture(t: TestContext, delayed = false) {
  const requests: string[] = [], pending: Promise<unknown>[] = [], assets = new Map<string, Promise<any>>();
  let release!: () => void; const gate = new Promise<void>(resolve => { release = resolve; }); if (!delayed) release();
  t.mock.method(GLTFLoader.prototype, 'loadAsync', async url => {
    const name = String(url).split('/').pop()!; requests.push(name);
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
  const original = globalThis.document;
  globalThis.document = { createElement: () => ({ getContext: () => ({ createImageData: (w: number, h: number) => ({ data: new Uint8ClampedArray(w * h * 4) }), putImageData() {}, fillRect() {}, strokeRect() {}, fillText() {}, createRadialGradient: () => ({ addColorStop() {} }) }) }) } as unknown as Document;
  const world = new WorldState(); new AgentManager(world).initializeAllAgents(); const models = new CharacterModels(), mouse = models.create(world.agents.get('mouse')!);
  const settle = async () => { release(); await Promise.all(pending); await new Promise(resolve => setImmediate(resolve)); };
  const draw = (input: Partial<MotionInput> = {}, distance = 4, delta = 0) => {
    models.animate(mouse, delta, { speed: 0, grounded: true, verticalVelocity: 0, turn: 0, realWorld: true, ...input }, distance); mouse.root.updateMatrixWorld(true);
  };
  t.after(() => { models.dispose(); globalThis.document = original; });
  return { models, mouse, world, requests, assets, draw, settle, release };
}

test('Mouse uses his own anatomical body and costumes while retaining both complete five-finger chains and forearm twist', async t => {
  const h = await fixture(t); await h.settle(); h.draw();
  assert.ok(h.mouse.hero, 'Mouse must load an anatomical actor rather than remain the procedural fallback');
  assert.equal(h.mouse.hero.support, 'mouse');
  for (const name of ['mouse.glb', 'mouse-ship.glb', 'mouse-head.glb']) assert.ok(h.requests.includes(name), `missing dedicated ${name}`);
  assert.ok(h.requests.every(name => name.startsWith('mouse')), `Mouse cannot borrow Neo office/coat assets: ${h.requests}`);
  for (const side of ['R', 'L']) {
    for (let digit = 1; digit <= 5; digit++) for (let joint = 1; joint <= 3; joint++) assert.ok(h.mouse.hero.bones.has(`finger${digit}-${joint}_${side}`));
    for (let joint = 1; joint <= 3; joint++) assert.ok(h.mouse.hero.bones.has(`forearm_twist_${side}_${joint}`));
  }
  assert.equal(h.mouse.hero.panels.length, 0, 'the short jacket must not grow Neo’s long coat tails');
});

function visible(object: THREE.Object3D): boolean {
  for (let p: THREE.Object3D | null = object; p; p = p.parent) if (!p.visible) return false;
  return true;
}

test('Mouse changes ship and Matrix wardrobes without leaking cap, coat or borrowed face across V toggles', async t => {
  const h = await fixture(t); await h.settle();
  const root = h.mouse.root, hero = h.mouse.hero!;
  const ship = root.getObjectByName('mouse_ship_shirt')!, collar = root.getObjectByName('mouse_ship_collar')!;
  const jacket = root.getObjectByName('Tailored_coat_upper')!, cap = root.getObjectByName('mouse_ship_cap')!;
  const face = root.getObjectByName('mouse-detailed-head')!, eyes = root.getObjectByName('mouse-eyes')!;
  const skin = root.getObjectByName('Anatomical_head_and_hands') as THREE.SkinnedMesh;
  assert.ok(ship && collar && jacket && cap && face && eyes && skin);
  const source = skin.geometry, a = source.attributes;
  for (const realWorld of [true, false, true]) for (const firstPerson of [false, true, false]) {
    h.draw({ realWorld, firstPerson, glasses: true });
    assert.equal(ship.visible, realWorld); assert.equal(collar.visible, realWorld); assert.equal(jacket.visible, !realWorld);
    assert.equal(visible(cap), realWorld && !firstPerson); assert.equal(visible(face), !firstPerson); assert.equal(visible(eyes), !firstPerson);
    assert.equal(hero.glasses.visible, !realWorld && !firstPerson);
    for (const side of ['R', 'L']) assert.ok(visible(root.getObjectByName(`mouse_boot_sole_${side}`)!), 'both wardrobes retain the actual boot soles');
    assert.equal(root.getObjectByName('mouse-neck-reference')!.visible, false);
    const retained = new Set(Array.from(skin.geometry.index!.array)); let hands = 0;
    for (let i = 0; i < a.position.count; i++) {
      if ([0, 1, 2, 3].some(j => a.skinWeight.getComponent(i, j) > .5 && /^finger[1-5]-[1-3]_[RL]$/.test(skin.skeleton.bones[a.skinIndex.getComponent(i, j)].name))) {
        hands++; assert.ok(retained.has(i), 'identity and V switches cannot remove anatomical fingers');
      }
    }
    assert.ok(hands > 200, 'test the delivered articulated hand surfaces');
  }
});

test('a cold first-person load applies the most recent realm and visibility before showing Mouse', async t => {
  const h = await fixture(t, true);
  h.draw({ realWorld: false, firstPerson: false }); h.draw({ realWorld: true, firstPerson: true });
  assert.equal(visible(h.mouse.head), false, 'the loading fallback head must not enter first person');
  await h.settle();
  assert.ok(h.mouse.hero); assert.equal(visible(h.mouse.root.getObjectByName('mouse-detailed-head')!), false);
  assert.equal(h.mouse.root.getObjectByName('mouse_ship_shirt')!.visible, true, 'apply the saved ship appearance on asynchronous arrival');
  h.draw({ realWorld: false, firstPerson: false }, 200);
  assert.equal(h.mouse.detail.visible, false); assert.equal(h.mouse.distant.visible, true);
  h.draw({ realWorld: false, firstPerson: false }, 4);
  assert.equal(visible(h.mouse.root.getObjectByName('mouse-detailed-head')!), true);
  assert.equal(h.mouse.root.getObjectByName('mouse_ship_shirt')!.visible, false);
  assert.equal(h.mouse.root.getObjectByName('Tailored_coat_upper')!.visible, true);
});

test('a Mouse asset that finishes outside the visible LOD stays hidden until its current Matrix appearance is applied', async t => {
  const h = await fixture(t, true); h.draw({ realWorld: false }, 200); await h.settle();
  assert.ok(h.mouse.hero); assert.equal(visible(h.mouse.hero.root), false);
  assert.equal(h.mouse.detail.visible, false); assert.equal(h.mouse.distant.visible, true);
  h.draw({ realWorld: false }, 4);
  assert.equal(visible(h.mouse.root.getObjectByName('mouse_ship_shirt')!), false);
  assert.equal(visible(h.mouse.root.getObjectByName('Tailored_coat_upper')!), true);
  assert.equal(visible(h.mouse.root.getObjectByName('mouse-detailed-head')!), true);
});

test('the meal drives Mouse’s real head and arms deterministically and removes its pose on returning to training or hotel walking', async t => {
  const h = await fixture(t); await h.settle();
  const input = { realWorld: true, interlude: { kind: 'meal', phase: 'accepting', elapsed: 3, role: 'mouse', physicalMeal: true } } as const;
  h.draw(input); const hero = h.mouse.hero!, names = ['head', 'shoulder_R', 'elbow_R', 'hip_L', 'knee_L'];
  const meal = names.map(name => hero.bones.get(name)!.quaternion.toArray());
  h.draw({ realWorld: false, speed: 4 });
  assert.ok(names.some((name, i) => hero.bones.get(name)!.quaternion.toArray().some((value, n) => Math.abs(value - meal[i][n]) > .01)));
  h.draw(input); assert.deepEqual(names.map(name => hero.bones.get(name)!.quaternion.toArray()), meal, 'saved meal rendering cannot depend on the previous scene');
  for (let i = 0; i < 60; i++) h.draw({ realWorld: false, speed: 4 }, 4, 1 / 60);
  assert.ok(h.mouse.motion.seated < .001, 'leaving the meal must release its seat into the ordinary walking solver');
  assert.equal(h.mouse.root.getObjectByName('mouse_ship_shirt')!.visible, false);
  assert.ok(h.mouse.hero!.glasses.visible, 'Matrix free play restores Mouse’s own round glasses');
});

test('the production renderer selects Mouse’s wardrobe in the meal, red-dress program and hotel across both views', async t => {
  const h = await fixture(t); const renderer = new AgentRenderer(new THREE.Scene()); t.after(() => renderer.dispose());
  const state = h.world.agents.get('mouse')!;
  const journey: FilmJourney = { version: 1, scene: 'm1_meal', actor: 'neo', step: 0, completed: [], enteredAt: 0,
    reflections: {}, lastText: '', checkpoint: state.position };
  for (const [scene, location, isInMatrix] of [['m1_meal', 'film_neb_deck', false], ['m1_red_dress', 'film_red_dress_plaza', true], ['m1_pills', 'film_lafayette', true], ['m1_dejavu', 'film_ambush_house', true]] as const) {
    journey.scene = scene; state.currentLocation = location; state.isInMatrix = isInMatrix; state.position = { ...FILM_SETS[location].center };
    state.currentAction = null; renderer.setWorld(isInMatrix); renderer.updateAgent('mouse', state); await h.settle();
    const body = renderer.getAgentBody('mouse')!;
    for (const firstPerson of [false, true, false]) {
      renderer.setPlayer('mouse', firstPerson); renderer.setPlayerMotion({ speed: 0, grounded: true, verticalVelocity: 0, turn: 0, firstPerson });
      renderer.update(0, undefined, 0, 0, journey);
      assert.equal(body.visible, !firstPerson, 'ordinary possession hides the body at the camera and restores it after V');
      assert.equal(body.getObjectByName('mouse_ship_shirt')!.visible, !isInMatrix, `${scene} must use its physical realm wardrobe`);
      assert.equal(body.getObjectByName('Tailored_coat_upper')!.visible, isInMatrix);
      assert.equal(visible(body.getObjectByName('mouse-detailed-head')!), !firstPerson);
    }
  }
});

test('Mouse releases his fitted head, eyes, masked skin and ship resources exactly once', async t => {
  const h = await fixture(t); await h.settle(); h.draw();
  const resources = new Set<THREE.BufferGeometry | THREE.Material>();
  for (const name of ['mouse-anatomical-head', 'mouse-eyes', 'Anatomical_head_and_hands', 'mouse_ship_shirt', 'mouse-glasses-temple--1', 'mouse-glasses-temple-1']) {
    h.mouse.root.getObjectByName(name)!.traverse(object => {
      if (object instanceof THREE.Mesh) { resources.add(object.geometry); for (const material of Array.isArray(object.material) ? object.material : [object.material]) resources.add(material); }
    });
  }
  const counts = new Map([...resources].map(resource => [resource, 0]));
  for (const resource of resources) resource.addEventListener('dispose', () => counts.set(resource, counts.get(resource)! + 1));
  h.models.dispose();
  for (const count of counts.values()) assert.equal(count, 1);
  assert.equal(h.mouse.root.getObjectByName('mouse-detailed-head'), undefined);
  assert.equal(h.mouse.root.getObjectByName('mouse-eyes'), undefined);
});

test('registered Mouse eyelids preserve their named morph and the body-relative displacement scale', async t => {
  const h = await fixture(t); await h.settle(); h.draw();
  const asset = await h.assets.get('mouse-head.glb')!, source = asset.scene.getObjectByName('mouse-anatomical-head') as THREE.Mesh;
  const face = h.mouse.root.getObjectByName('mouse-anatomical-head') as THREE.SkinnedMesh;
  assert.equal(face.morphTargetDictionary?.closedEyes, source.morphTargetDictionary?.closedEyes);
  assert.ok(face.morphTargetDictionary?.closedEyes !== undefined, 'the delivered close-eyes target must remain addressable after skinning');
  const max = (attribute: THREE.BufferAttribute) => { let maximum = 0; for (let i = 0; i < attribute.count; i++) maximum = Math.max(maximum, Math.hypot(attribute.getX(i), attribute.getY(i), attribute.getZ(i))); return maximum; };
  const body = await h.assets.get('mouse.glb')!, scale = Math.abs(body.parser.json.extras.eye[0]) / asset.parser.json.extras.eye[0];
  assert.ok(Math.abs(max(face.geometry.morphAttributes.position[0] as THREE.BufferAttribute) / max(source.geometry.morphAttributes.position[0] as THREE.BufferAttribute) - scale) < 1e-5,
    'eyelids must deform in the same fitted units as the head rather than the unscaled portrait mesh');
});

test('the fitted lower neck keeps the original body texture coordinates at its weighted attachment', async t => {
  const h = await fixture(t); await h.settle(); h.draw();
  const face = h.mouse.root.getObjectByName('mouse-anatomical-head') as THREE.SkinnedMesh;
  const reference = h.mouse.root.getObjectByName('mouse-neck-reference') as THREE.SkinnedMesh;
  const a = face.geometry.attributes, uv = a._body_uv, original = reference.geometry.attributes, index = reference.geometry.index!;
  assert.ok(uv, 'the lower registered head must sample the original neck map instead of ending in an unrelated portrait color');
  const point = new THREE.Vector3(), nearest = new THREE.Vector3(), barycentric = new THREE.Vector3(); let checked = 0;
  for (let i = 0; i < a.position.count; i++) {
    if (a._head_rest.getY(i) > -.48) continue;
    point.fromBufferAttribute(a.position, i); let closest = Infinity, textureDistance = Infinity;
    for (let triangle = 0; triangle < index.count; triangle += 3) {
      const vertices = [0, 1, 2].map(corner => index.getX(triangle + corner));
      const surface = new THREE.Triangle(...vertices.map(v => new THREE.Vector3().fromBufferAttribute(original.position, v)) as [THREE.Vector3, THREE.Vector3, THREE.Vector3]);
      surface.closestPointToPoint(point, nearest); const distance = point.distanceToSquared(nearest);
      closest = Math.min(closest, distance); if (distance > 1e-6) continue;
      surface.getBarycoord(nearest, barycentric); const expected = new THREE.Vector2();
      vertices.forEach((v, corner) => expected.addScaledVector(new THREE.Vector2().fromBufferAttribute(original.uv, v), barycentric.getComponent(corner)));
      // A mirrored texture seam may have two UVs at the same physical point.
      textureDistance = Math.min(textureDistance, new THREE.Vector2().fromBufferAttribute(uv, i).distanceTo(expected));
    }
    if (closest > 1e-6) continue;
    assert.ok(textureDistance < .002, `neck texture coordinates must remain continuous across the actual skin attachment: vertex ${i}, UV distance ${textureDistance}`); checked++;
  }
  assert.ok(checked > 100, `validate the fitted circumference rather than a single seam vertex: ${checked}`);
});

test('Mouse’s round glasses keep both temples outside his actual fitted skull as the head turns', async t => {
  const h = await fixture(t); await h.settle();
  const hero = h.mouse.hero!, head = hero.bones.get('head')!, face = hero.root.getObjectByName('mouse-anatomical-head') as THREE.SkinnedMesh;
  const temples = hero.glasses.children.filter((part): part is THREE.Mesh<THREE.TubeGeometry> => part instanceof THREE.Mesh && part.geometry instanceof THREE.TubeGeometry && part.geometry.parameters.radialSegments === 6 && part.geometry.parameters.radius === .004);
  assert.equal(temples.length, 2, 'inspect both delivered temple arms, with their original round cross-section');
  for (const input of [{ realWorld: false }, { realWorld: true, interlude: { kind: 'meal', phase: 'accepting', elapsed: 3, role: 'mouse', physicalMeal: true } }] as const) {
    h.draw(input); face.skeleton.update(); let checked = 0;
    const direction = new THREE.Vector3(), origin = new THREE.Vector3(), point = new THREE.Vector3(), local = new THREE.Vector3();
    for (const temple of temples) for (let vertex = 0; vertex < temple.geometry.attributes.position.count; vertex += 3) {
      point.fromBufferAttribute(temple.geometry.attributes.position, vertex); temple.localToWorld(point); local.copy(point); head.worldToLocal(local);
      const side = Math.sign(local.x); origin.set(side, local.y, local.z); head.localToWorld(origin);
      direction.set(-side, 0, 0).applyQuaternion(head.getWorldQuaternion(new THREE.Quaternion()));
      const hit = new THREE.Raycaster(origin, direction, 0, 2).intersectObject(face)[0]; if (!hit) continue;
      const surface = head.worldToLocal(hit.point.clone()); const depth = side * (surface.x - local.x); checked++;
      assert.ok(depth < .003, `Mouse's temple penetrates the registered skull by ${depth}: ${temple.name}/${vertex}, ${local.toArray()}`);
    }
    assert.ok(checked > 40, `inspect enough of both temple surfaces: ${checked}`);
  }
});

test('disposing while Mouse assets load never attaches a late orphan actor', async t => {
  const h = await fixture(t, true); h.draw(); h.models.dispose(); await h.settle();
  assert.equal(h.mouse.hero, undefined); assert.equal(h.mouse.root.getObjectByName('mouse-detailed-head'), undefined);
});

test('Mouse seats each pistol in the palm with the index pad on its trigger and the other pads around the handle', async t => {
  const h = await fixture(t); await h.settle(); h.draw({ realWorld: false, armed: true });
  const hero = h.mouse.hero!, skin = hero.root.getObjectByName('Anatomical_head_and_hands') as THREE.SkinnedMesh;
  const a = skin.geometry.attributes, point = new THREE.Vector3(), gaps: number[] = [];
  for (const [hand, side] of ['R', 'L'].entries()) {
    const gun = h.mouse.weapons![hand], handle = gun.children[2] as THREE.Mesh, trigger = gun.children[3] as THREE.Mesh;
    for (let digit = 1; digit <= 5; digit++) {
      const contact = digit === 2 ? trigger : handle; contact.geometry.computeBoundingBox();
      let closest = Infinity, penetration = 0;
      for (let vertex = 0; vertex < a.position.count; vertex++) {
        const distal = [0, 1, 2, 3].some(j => a.skinWeight.getComponent(vertex, j) > .9 && skin.skeleton.bones[a.skinIndex.getComponent(vertex, j)].name === `finger${digit}-3_${side}`);
        if (!distal) continue;
        contact.worldToLocal(skin.localToWorld(skin.getVertexPosition(vertex, point)));
        const box = contact.geometry.boundingBox!, scale = contact.scale;
        const distance = point.clone().clamp(box.min, box.max).sub(point).multiply(scale).length(); closest = Math.min(closest, distance);
        if (box.containsPoint(point)) penetration = Math.max(penetration, Math.min(...(['x', 'y', 'z'] as const).map(axis => Math.min(point[axis] - box.min[axis], box.max[axis] - point[axis]) * scale[axis])));
      }
      gaps.push(closest); assert.ok(penetration < .025, `${side} digit ${digit} cuts through its metal contact by ${penetration}`);
    }
  }
  assert.ok(gaps.every(gap => gap < .025), `the actual distal pads must hold the metal, including both trigger fingers: ${JSON.stringify(gaps)}`);
  const relaxed = hero.bones.get('finger5-1_R')!.quaternion.clone(); h.draw({ realWorld: false, armed: false });
  assert.ok(relaxed.angleTo(hero.bones.get('finger5-1_R')!.quaternion) > .1, 'holstering releases the dedicated grip');
});

test('Mouse’s seated pistol grip leaves the palm and whole phalanges outside the metal handle', async t => {
  const h = await fixture(t); await h.settle(); h.draw({ realWorld: false, armed: true });
  const skin = h.mouse.hero!.root.getObjectByName('Anatomical_head_and_hands') as THREE.SkinnedMesh, a = skin.geometry.attributes;
  for (const [hand, side] of ['R', 'L'].entries()) {
    const handle = h.mouse.weapons![hand].children[2] as THREE.Mesh; handle.geometry.computeBoundingBox();
    const box = handle.geometry.boundingBox!, point = new THREE.Vector3(); let penetration = 0;
    for (let vertex = 0; vertex < a.position.count; vertex++) {
      if (![0, 1, 2, 3].some(j => a.skinWeight.getComponent(vertex, j) > .9 && new RegExp(`^(wrist|finger[1-5]-[123])_${side}$`).test(skin.skeleton.bones[a.skinIndex.getComponent(vertex, j)].name))) continue;
      handle.worldToLocal(skin.localToWorld(skin.getVertexPosition(vertex, point)));
      if (box.containsPoint(point)) penetration = Math.max(penetration, Math.min(...(['x', 'y', 'z'] as const).map(axis => Math.min(point[axis] - box.min[axis], box.max[axis] - point[axis]) * handle.scale[axis])));
    }
    assert.ok(penetration < .02, `${side} palm/finger surface passes through the handle by ${penetration}`);
  }
});
