import assert from 'node:assert/strict';
import test, { type TestContext } from 'node:test';
import { readFile } from 'node:fs/promises';
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { CharacterModels } from '../packages/client/src/agents/CharacterModel.js';
import { WorldState } from '../packages/server/src/world/WorldState.js';
import { AgentManager } from '../packages/server/src/agents/AgentManager.js';
import { newDiggers, newUpperDigger, upperDiggerRoot, UPPER_DIGGER, TEMPLE_DEFENSE, FILM_SETS, templeWheelHands, type UpperDigger } from '@auto_matrix/shared';
import { diggerLoaderPose, stepDiggers } from '@auto_matrix/shared';

async function shipped(name: string) {
  const bytes = await readFile(new URL(`../packages/client/public/assets/characters/${name}.glb`, import.meta.url));
  const length = bytes.readUInt32LE(12), document = JSON.parse(bytes.subarray(20, 20 + length).toString());
  for (const material of document.materials) delete material.pbrMetallicRoughness.baseColorTexture;
  document.images = []; document.textures = [];
  const json = Buffer.from(JSON.stringify(document)), padded = Buffer.alloc(Math.ceil(json.length / 4) * 4, 32); json.copy(padded);
  const binary = bytes.subarray(20 + length), output = Buffer.alloc(20 + padded.length + binary.length);
  output.writeUInt32LE(0x46546c67, 0); output.writeUInt32LE(2, 4); output.writeUInt32LE(output.length, 8);
  output.writeUInt32LE(padded.length, 12); output.writeUInt32LE(0x4e4f534a, 16); padded.copy(output, 20); binary.copy(output, 20 + padded.length);
  const asset = await new GLTFLoader().parseAsync(output.buffer.slice(output.byteOffset, output.byteOffset + output.byteLength), '');
  if (name.endsWith('-head')) asset.scene.traverse(object => { if (object instanceof THREE.Mesh) (object.material as THREE.MeshStandardMaterial).map = new THREE.Texture(); });
  return asset;
}

async function fixture(t: TestContext, delayed = false) {
  const names = ['zee-head', 'charra-head', 'zee-body', 'charra-body'];
  const assets = Object.fromEntries(await Promise.all(names.map(async name => [name, await shipped(name)])));
  const pending: (() => void)[] = [];
  t.mock.method(GLTFLoader.prototype, 'loadAsync', async url => {
    const name = String(url).split('/').pop()!.replace('.glb', '');
    if (delayed && name.endsWith('-body')) await new Promise<void>(resolve => pending.push(resolve));
    return assets[name];
  });
  t.mock.method(THREE.TextureLoader.prototype, 'load', () => new THREE.Texture());
  const previous = globalThis.document;
  globalThis.document = { createElement: () => ({ getContext: () => ({ createImageData: (w: number, h: number) => ({ data: new Uint8ClampedArray(w * h * 4) }), putImageData() {} }) }) } as unknown as Document;
  const world = new WorldState(); new AgentManager(world).initializeAllAgents(); const models = new CharacterModels();
  t.after(() => { models.dispose(); globalThis.document = previous; });
  const rigs = { charra: models.create(world.agents.get('charra')!), zee: models.create(world.agents.get('zee')!) };
  const pose = (state: UpperDigger) => {
    for (const role of ['charra', 'zee'] as const) {
      const rig = rigs[role], root = upperDiggerRoot(state, role); rig.root.position.set(root.x, root.y, root.z); rig.root.rotation.y = root.yaw;
      const contacts = rigs.charra.diggerProps ? [-1, 1].map(side => rigs.charra.diggerProps!.belt.localToWorld(new THREE.Vector3(side * .23, 0, -.27))) : undefined;
      models.animate(rig, 0, { speed: 0, grounded: true, verticalVelocity: 0, turn: 0, realWorld: true, upperDigger: { ...state, role, contacts } }, 1);
      rig.root.updateMatrixWorld(true);
    }
  };
  const state: UpperDigger = { ...newUpperDigger(), phase: 'bracing', climb: 44, crawl: 26, grip: .55 };
  pose(state); await new Promise(resolve => setImmediate(resolve)); pose(state);
  return { rigs, models, state, pose, release: async () => { pending.forEach(resolve => resolve()); await new Promise(resolve => setImmediate(resolve)); } };
}

test('late dock body loading keeps the saved pose, detailed head and held props while replacing the old limbs', async t => {
  const { rigs, state, pose, release } = await fixture(t, true);
  const saved = Object.values(rigs).map(rig => rig.root.matrixWorld.clone());
  await release(); pose(state);
  for (const [index, rig] of Object.values(rigs).entries()) {
    const role = index ? 'zee' : 'charra';
    assert.ok(rig.root.getObjectByName(`${role}-detailed-body`), `${role}: still uses disconnected lathe limbs`);
    assert.ok(rig.root.matrixWorld.equals(saved[index]), 'loading must not move a saved character');
    assert.equal(rig.head.getObjectByName(`${role}-detailed-head`)!.visible, true);
    assert.equal(rig.diggerProps!.group.visible, true, 'the body swap must preserve the held launcher and belt');
    assert.equal(rig.shoulders[0].children.find(object => object instanceof THREE.SkinnedMesh)!.visible, false);
    const before = rig.root.getObjectByName(`${role}-anatomical-body`) as THREE.SkinnedMesh;
    before.skeleton.update(); const point = before.getVertexPosition(100, new THREE.Vector3());
    pose(state); before.skeleton.update();
    assert.ok(point.distanceTo(before.getVertexPosition(100, new THREE.Vector3())) < 1e-7, 'a paused body must not drift');
  }
});

test('the shipped dock hands remain on the support belt after full body skinning', async t => {
  const { rigs } = await fixture(t);
  const skin = rigs.zee.root.getObjectByName('zee-anatomical-body') as THREE.SkinnedMesh;
  assert.ok(skin, 'the actual continuous body must be loaded'); skin.skeleton.update();
  for (const side of [-1, 1]) {
    const contact = rigs.charra.diggerProps!.belt.localToWorld(new THREE.Vector3(side * .23, 0, -.27));
    let distance = Infinity;
    for (let i = 0; i < skin.geometry.attributes.position.count; i++) {
      const p = skin.geometry.attributes.position;
      if (p.getY(i) > 1.79 || p.getY(i) < 1.45 || Math.sign(p.getX(i)) !== side) continue;
      distance = Math.min(distance, skin.localToWorld(skin.getVertexPosition(i, new THREE.Vector3())).distanceTo(contact));
    }
    assert.ok(distance < .075, `actual palm surface is ${distance} away from the belt`);
  }
});

test('the shipped pair keeps grounded boots, clear bodies and belt contact throughout reaching and lowering the launcher', async t => {
  const { rigs, state, pose } = await fixture(t);
  const clashes = new Map<string, string>();
  for (const phase of ['bracing', 'shot'] as const) for (let sample = 0; sample <= 20; sample++) {
    Object.assign(state, { phase, grip: sample / 20, elapsed: phase === 'shot' ? 2 + sample / 20 * .8 : 0 }); pose(state);
    for (const role of ['zee', 'charra'] as const) {
      const rig = rigs[role], boots = rig.root.getObjectByName(`${role}-work-boots`) as THREE.SkinnedMesh; boots.skeleton.update();
      const floor = new THREE.Box3().setFromObject(boots, true).min.y;
      assert.ok(floor >= 43.98 && floor < 44.03, `${role} ${phase} ${sample}: soles lost support at ${floor}`);
      const body = rig.root.getObjectByName(`${role}-detailed-body`)!;
      body.traverseVisible(object => {
        if (!(object instanceof THREE.SkinnedMesh)) return;
        object.skeleton.update(); const point = new THREE.Vector3();
        for (let i = 0; i < object.geometry.attributes.position.count; i++) {
          object.localToWorld(object.getVertexPosition(i, point));
          assert.ok(point.y >= 43.97, `${role} ${phase} ${sample}: ${object.name} crosses the deck at ${point.toArray()}`);
          if (point.x > -49 && point.x < -16) assert.ok(UPPER_DIGGER.pipes.every(z => Math.hypot(point.y - 46, point.z - z) >= 2.5), 'a limb enters the neighboring pipe');
          if (role === 'zee') {
            const gun = rigs.charra.diggerProps!.gun.worldToLocal(point.clone());
            if (gun.z >= -1.105 && gun.z <= 1.505 && Math.min(Math.hypot(gun.x - .21, gun.y), Math.hypot(gun.x + .21, gun.y)) < .22)
              clashes.set(`${phase}-${sample}`, `Zee ${phase} ${sample}: ${object.name} enters the launcher's barrels at ${gun.toArray()}`);
          }
        }
      });
      if (role === 'charra') {
        const skin = rig.root.getObjectByName('charra-anatomical-body') as THREE.SkinnedMesh; skin.skeleton.update();
        for (let i = 0; i < 2; i++) {
          if (i === 1 && (phase === 'bracing' ? state.grip < .4 : state.elapsed > 2)) continue;
          const side = i ? 1 : -1, target = rig.diggerProps!.gun.localToWorld(new THREE.Vector3(.05, -.31, i ? .85 : -.12));
          const position = skin.geometry.attributes.position; let distance = Infinity;
          for (let vertex = 0; vertex < position.count; vertex++) {
            if (position.getY(vertex) > 1.79 || position.getY(vertex) < 1.45 || Math.sign(position.getX(vertex)) !== side) continue;
            distance = Math.min(distance, skin.localToWorld(skin.getVertexPosition(vertex, new THREE.Vector3())).distanceTo(target));
          }
          assert.ok(distance < .075, `Charra ${phase} ${sample}: actual palm ${i} misses the launcher handle by ${distance}`);
        }
      }
    }
    if (phase !== 'bracing' || state.grip < .42) continue;
    const skin = rigs.zee.root.getObjectByName('zee-anatomical-body') as THREE.SkinnedMesh; skin.skeleton.update();
    for (const side of [-1, 1]) {
      const target = rigs.charra.diggerProps!.belt.localToWorld(new THREE.Vector3(side * .23, 0, -.27));
      const position = skin.geometry.attributes.position; let distance = Infinity;
      for (let i = 0; i < position.count; i++) {
        if (position.getY(i) > 1.79 || position.getY(i) < 1.45 || Math.sign(position.getX(i)) !== side) continue;
        distance = Math.min(distance, skin.localToWorld(skin.getVertexPosition(i, new THREE.Vector3())).distanceTo(target));
      }
      assert.ok(distance < .075, `support ${state.grip}: the actual hand surface misses the belt by ${distance}`);
    }
  }
  assert.deepEqual([...clashes.values()], []);
});

test('Zee’s shipped hands stay on the artillery wheel without crossing her arms or lifting her boots', async t => {
  const { rigs, models } = await fixture(t), rig = rigs.zee, center = FILM_SETS.film_zion_temple.center;
  rig.root.position.set(center.x + TEMPLE_DEFENSE.mounts[0].x, center.y - 1, center.z + TEMPLE_DEFENSE.operatorZ); rig.root.rotation.set(0, Math.PI, 0);
  for (const turn of [0, .45, 1]) {
    const motion = { speed: 0, grounded: true, verticalVelocity: 0, turn: 0, realWorld: true,
      templeDefense: { role: 'zee', phase: 'mounting' as const, elapsed: 4, mount: 0 as const, turn, grip: 1 } };
    models.animate(rig, 0, motion, 1); rig.root.updateMatrixWorld(true);
    const skin = rig.root.getObjectByName('zee-anatomical-body') as THREE.SkinnedMesh; skin.skeleton.update();
    const points = templeWheelHands(0, turn);
    for (let i = 0; i < 2; i++) {
      const side = i ? 1 : -1, point = points[1 - i];
      const contact = new THREE.Vector3(center.x + point.x, center.y - 1 + point.y, center.z + point.z);
      let distance = Infinity; const position = skin.geometry.attributes.position;
      for (let vertex = 0; vertex < position.count; vertex++) if (position.getY(vertex) <= 1.79 && position.getY(vertex) > 1.45 && Math.sign(position.getX(vertex)) === side)
        distance = Math.min(distance, skin.localToWorld(skin.getVertexPosition(vertex, new THREE.Vector3())).distanceTo(contact));
      assert.ok(distance < .075, `turn ${turn}: hand ${i} surface misses its wheel handle by ${distance}`);
      const elbow = rig.elbows[i].getWorldPosition(new THREE.Vector3());
      assert.ok((elbow.x - rig.root.position.x) * -side > .15, `turn ${turn}: elbow ${i} crosses the torso`);
    }
    const boots = rig.root.getObjectByName('zee-work-boots') as THREE.SkinnedMesh; boots.skeleton.update();
    const floor = new THREE.Box3().setFromObject(boots, true).min.y - (center.y - 1);
    assert.ok(floor >= -.01 && floor < .03, `boot sole support is ${floor}`);
    const before = skin.getVertexPosition(100, new THREE.Vector3()); models.animate(rig, 0, motion, 1); skin.skeleton.update();
    assert.ok(before.distanceTo(skin.getVertexPosition(100, new THREE.Vector3())) < 1e-7, 'pause cannot drift the saved hand contact');
  }
});

test('Zee shelters below standing height with planted boots while waiting for Neo', async t => {
  const { rigs, models } = await fixture(t), rig = rigs.zee;
  rig.root.position.set(0, 0, 0); rig.root.rotation.set(0, -Math.PI / 2, 0);
  const motion = { speed: 0, grounded: true, verticalVelocity: 0, turn: 0, realWorld: true,
    templeDefense: { role: 'zee', phase: 'waiting' as const, elapsed: 2.1, turn: 1, grip: 0 } };
  models.animate(rig, 0, motion, 1); rig.root.updateMatrixWorld(true);
  assert.ok(rig.torso.getWorldPosition(new THREE.Vector3()).y < 1.35, 'the temple wait is a crouched huddle, not a replay of the standing dock reunion');
  const boots = rig.root.getObjectByName('zee-work-boots') as THREE.SkinnedMesh; boots.skeleton.update();
  const floor = new THREE.Box3().setFromObject(boots, true).min.y;
  assert.ok(floor >= -.01 && floor < .03, `crouched sole support is ${floor}`);
  const skin = rig.root.getObjectByName('zee-anatomical-body') as THREE.SkinnedMesh; skin.skeleton.update();
  const before = skin.getVertexPosition(100, new THREE.Vector3()); models.animate(rig, 0, motion, 1); skin.skeleton.update();
  assert.ok(before.distanceTo(skin.getVertexPosition(100, new THREE.Vector3())) < 1e-7, 'a paused huddle does not drift');
});

test('a contact correction after animation moves the rendered skin and its culling bounds in the same frame', async t => {
  const { rigs } = await fixture(t);
  const rig = rigs.zee, skin = rig.root.getObjectByName('zee-anatomical-body') as THREE.SkinnedMesh;
  const position = skin.geometry.attributes.position;
  const index = Array.from({ length: position.count }, (_, i) => i).find(i => position.getX(i) < -.4 && position.getY(i) > 2.6 && position.getY(i) < 2.8)!;
  skin.skeleton.update(); const before = skin.localToWorld(skin.getVertexPosition(index, new THREE.Vector3()));
  // AgentRenderer's second pass corrects Zee's hands after Charra's belt has
  // its current pose, without calling CharacterModels.animate again.
  rig.shoulders[0].rotation.x += .35; rig.root.updateMatrixWorld(true); skin.skeleton.update();
  const after = skin.localToWorld(skin.getVertexPosition(index, new THREE.Vector3()));
  assert.ok(before.distanceTo(after) > .06, 'late corrections cannot leave one frame of stale skin');
  const bounds = skin.boundingBox!.clone().applyMatrix4(skin.matrixWorld);
  assert.ok(bounds.containsPoint(after), 'the moved limb must remain inside its actual culling bounds');
});

test('the anatomical palms meet the launcher and rockets, and boot soles support both fighters during loading', async t => {
  const { rigs, models } = await fixture(t);
  for (const role of ['charra', 'zee'] as const) for (const pitch of [-.65, 0, .5]) for (const load of [0, .5, .8]) {
    const rig = rigs[role]; rig.root.position.set(0, 0, 0); rig.root.rotation.set(0, .65, 0);
    models.animate(rig, 0, { speed: 0, grounded: true, verticalVelocity: 0, turn: 0, realWorld: true,
      diggers: { ...newDiggers(), phase: 'loading', role, load, pitch } }, 1);
    rig.root.updateMatrixWorld(true);
    const skin = rig.root.getObjectByName(`${role}-anatomical-body`) as THREE.SkinnedMesh; skin.skeleton.update();
    for (let side = 0; side < 2; side++) {
      const sign = side ? 1 : -1;
      const contact = role === 'charra' ? rig.diggerProps!.gun.localToWorld(new THREE.Vector3(.05, -.31, side ? .85 : -.12))
        : rig.root.localToWorld(rig.diggerProps!.rounds.position.clone().add(new THREE.Vector3(sign * .21, -.12, -.2)));
      let closest = Infinity;
      const position = skin.geometry.attributes.position;
      for (let i = 0; i < position.count; i++) if (position.getY(i) <= 1.79 && position.getY(i) > 1.45 && Math.sign(position.getX(i)) === sign)
        closest = Math.min(closest, skin.localToWorld(skin.getVertexPosition(i, new THREE.Vector3())).distanceTo(contact));
      assert.ok(closest < .075, `${role} ${pitch} ${load} hand ${side}: skin is ${closest} away from grip`);
    }
    const boots = rig.root.getObjectByName(`${role}-work-boots`) as THREE.SkinnedMesh; boots.skeleton.update();
    const floor = new THREE.Box3().setFromObject(boots, true).min.y;
    assert.ok(floor >= -.01 && floor < .03, `${role}: boot sole support is ${floor}`);
  }
});

test('Zee releases the seated rounds before aiming without snapping either arm down', async t => {
  const { rigs, models } = await fixture(t), rig = rigs.zee;
  const state = { ...newDiggers(), phase: 'loading' as const, load: 1 };
  const pose = (phase: 'loading' | 'aiming') => { models.animate(rig, 0, { speed: 0, grounded: true, verticalVelocity: 0, turn: 0, realWorld: true, diggers: { ...state, phase, role: 'zee' } }, 1); rig.root.updateMatrixWorld(true); };
  pose('loading'); const before = rig.elbows.map(elbow => elbow.localToWorld(new THREE.Vector3(0, -.79, .055)));
  pose('aiming'); rig.elbows.forEach((elbow, i) => assert.ok(elbow.localToWorld(new THREE.Vector3(0, -.79, .055)).distanceTo(before[i]) < .001, 'the loading boundary teleports the hand'));
});

test('the shipped loading pair carries the rounds, clears the other body and feeds them entirely inside the open breeches', async t => {
  const { rigs, models } = await fixture(t), state = { ...newDiggers(), phase: 'loading' as const, loader: { x: 2.3, z: -1.4, yaw: 0, elapsed: 0 } };
  for (let frame = 0; frame <= 65; frame++) {
    const loader = diggerLoaderPose(state);
    for (const role of ['charra', 'zee'] as const) {
      const rig = rigs[role]; rig.root.position.set(role === 'zee' ? loader.x : 0, 0, role === 'zee' ? loader.z : 0); rig.root.rotation.set(0, role === 'zee' ? loader.yaw : 0, 0);
      models.animate(rig, 0, { speed: 0, grounded: true, verticalVelocity: 0, turn: 0, realWorld: true, diggers: { ...state, role } }, 1);
      rig.root.updateMatrixWorld(true);
      rig.root.getObjectByName(`${role}-detailed-body`)!.traverseVisible(object => {
        if (!(object instanceof THREE.SkinnedMesh)) return;
        object.skeleton.update(); const point = new THREE.Vector3();
        for (let i = 0; i < object.geometry.attributes.position.count; i++) {
          object.localToWorld(object.getVertexPosition(i, point));
          assert.ok(point.y >= -.02, `${role} frame ${frame}: ${object.name} crosses the floor at ${point.toArray()}`);
          if (role === 'zee') assert.ok(!(Math.abs(point.x) < .35 && Math.abs(point.z) < .3 && point.y > 1.6 && point.y < 3.2), `frame ${frame}: Zee crosses Charra's torso`);
        }
      });
    }
    if (state.load > 0 && rigs.zee.diggerProps!.rounds.visible) {
      rigs.zee.diggerProps!.rounds.traverseVisible(object => {
        if (!(object instanceof THREE.Mesh)) return;
        for (let i = 0; i < object.geometry.attributes.position.count; i++) {
          const point = rigs.charra.diggerProps!.gun.worldToLocal(object.localToWorld(new THREE.Vector3().fromBufferAttribute(object.geometry.attributes.position, i)));
          if (state.load >= .9) assert.ok(point.z > -1.05 && point.z < 1.55, 'loaded rocket disappears before entering the barrel');
          if (point.z >= -1.1025) assert.ok(Math.min(Math.hypot(point.x - .21, point.y), Math.hypot(point.x + .21, point.y)) < .17,
            `load ${state.load}: a rocket enters the breech before aligning with its open bore`);
        }
      });
    }
    stepDiggers(state, .1, true);
  }
  assert.equal(state.phase, 'aiming');
});

test('boot cuffs follow the shin when the ankle flexes, without pulling the flat sole off the foot', async t => {
  const { rigs } = await fixture(t);
  for (const role of ['charra', 'zee'] as const) {
    const rig = rigs[role], boots = rig.root.getObjectByName(`${role}-work-boots`) as THREE.SkinnedMesh;
    rig.knees[0].rotation.x = .9; rig.ankles[0].rotation.x = -.9; rig.root.updateMatrixWorld(true); boots.skeleton.update();
    const rest = boots.geometry.attributes.position;
    for (let i = 0; i < rest.count; i++) {
      if (rest.getX(i) > 0) continue;
      const point = new THREE.Vector3().fromBufferAttribute(rest, i);
      const cuff = point.y > .419, sole = point.y < -.134;
      if (!cuff && !sole) continue;
      const expected = (cuff ? rig.knees[0] : rig.ankles[0]).localToWorld(point.clone().sub(new THREE.Vector3(-.225, cuff ? .92 : .02, 0)));
      const actual = boots.localToWorld(boots.getVertexPosition(i, new THREE.Vector3()));
      assert.ok(actual.distanceTo(expected) < .015, `${role}: ${cuff ? 'cuff separates from shin' : 'sole bends away from foot'} by ${actual.distanceTo(expected)}`);
    }
  }
});

test('the separate head and anatomical body keep a closed neck silhouette while looking down to load', async t => {
  const { rigs, models } = await fixture(t);
  for (const role of ['zee', 'charra'] as const) {
    const rig = rigs[role]; rig.root.position.set(0, 0, 0); rig.root.rotation.set(0, 0, 0);
    models.animate(rig, 0, { speed: 0, grounded: true, verticalVelocity: 0, turn: 0, realWorld: true,
      diggers: { ...newDiggers(), phase: 'loading', role, load: 0, pitch: -.65 } }, 1);
    rig.root.updateMatrixWorld(true);
    const body = rig.root.getObjectByName(`${role}-anatomical-body`) as THREE.SkinnedMesh; body.skeleton.update();
    const head = rig.head.getObjectByName(`${role}-anatomical-head`) as THREE.Mesh;
    // Follow the tilted head section: a fixed torso-space ray can pass
    // outside a correctly bending neck and wrongly report an opening.
    for (const z of [-.14, -.07, 0]) for (let y = -.56; y <= -.40; y += .01) {
      const origin = rig.head.localToWorld(new THREE.Vector3(1, y, z));
      const ray = new THREE.Raycaster(origin, new THREE.Vector3(-1, 0, 0).transformDirection(rig.head.matrixWorld));
      assert.ok(ray.intersectObjects([body, head], false).length, `${role}: visible neck gap at head height ${y}, depth ${z}`);
    }
  }
});

test('shipped dock bodies and clothes clear the deck and pipes through crawl, support, fall and hatch transfer', async t => {
  const { rigs, state, pose } = await fixture(t);
  const failures: string[] = [];
  for (const phase of ['mounting', 'crawl', 'bracing', 'attack', 'escape', 'dismounting'] as const) for (const elapsed of [.2, 1.2, 1.8, 2.6, 3.2]) {
    Object.assign(state, { phase, elapsed, charraDead: ['attack', 'escape', 'dismounting'].includes(phase) && (phase !== 'attack' || elapsed >= 1.2), retreat: phase === 'attack' || phase === 'escape' ? 7 : phase === 'dismounting' ? 26 : 0 }); pose(state);
    for (const role of ['charra', 'zee'] as const) {
      const body = rigs[role].root.getObjectByName(`${role}-detailed-body`); assert.ok(body);
      body.traverseVisible(object => {
        if (!(object instanceof THREE.SkinnedMesh)) return;
        object.skeleton.update();
        const minimum = phase === 'mounting' || phase === 'dismounting' ? 40 : 43.97;
        const point = new THREE.Vector3();
        for (let i = 0; i < object.geometry.attributes.position.count; i++) {
          object.localToWorld(object.getVertexPosition(i, point));
          if (!Number.isFinite(point.lengthSq()) || point.y < minimum) { failures.push(`${role} ${phase} ${elapsed} ${object.name} floor at ${point.toArray()}`); break; }
          if (point.x > -49 && point.x < -16 && UPPER_DIGGER.pipes.some(z => Math.hypot(point.y - 46, point.z - z) < 2.5)) {
            failures.push(`${role} ${phase} ${elapsed} ${object.name} pipe at ${point.toArray()}`); break;
          }
        }
      });
    }
  }
  assert.deepEqual(failures, []);
});

test('the continuous dock meshes remain outside the actual hatch deck during both transfers', async t => {
  const { rigs, state, pose } = await fixture(t);
  const failures: string[] = [];
  for (const down of [false, true]) for (let sample = 0; sample <= 40; sample++) {
    Object.assign(state, { phase: down ? 'dismounting' : 'mounting', climb: 44, elapsed: sample / 40 * UPPER_DIGGER.mount, charraDead: down }); pose(state);
    const body = rigs.zee.root.getObjectByName('zee-detailed-body')!;
    body.traverseVisible(object => {
      if (!(object instanceof THREE.SkinnedMesh)) return;
      object.skeleton.update(); const point = new THREE.Vector3();
      for (let i = 0; i < object.geometry.attributes.position.count; i++) {
        object.localToWorld(object.getVertexPosition(i, point));
        if (point.x >= -42.4 && point.x <= -11.2 && point.z >= 26 && point.z <= 30 && point.y < 43.97) {
          failures.push(`${state.phase} ${sample}/40 ${object.name} deck at ${point.toArray()}`); break;
        }
        if (point.x > -49 && point.x < -16 && UPPER_DIGGER.pipes.some(z => Math.hypot(point.y - 46, point.z - z) < 2.5)) {
          failures.push(`${state.phase} ${sample}/40 ${object.name} pipe at ${point.toArray()}`); break;
        }
      }
    });
  }
  assert.deepEqual(failures, []);
});
