import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { FILM_SETS, HEL_DISARM, HEL_BREAKOUT, HEL_TRIO, helDisarmGun, helBreakoutGun, helTerraceFloor, type HelDisarm, type HelBreakout, type FilmJourney } from '@auto_matrix/shared';
import { CharacterModels } from '../packages/client/src/agents/CharacterModel.js';
import { HelClubPerformers } from '../packages/client/src/engine/HelClubPerformers.js';
import { FilmSetRenderer } from '../packages/client/src/engine/FilmSetRenderer.js';
import { WorldState } from '../packages/server/src/world/WorldState.js';
import { AgentManager } from '../packages/server/src/agents/AgentManager.js';

async function geometry(name: string) {
  const bytes = await readFile(new URL(`../packages/client/public/assets/characters/${name}.glb`, import.meta.url));
  const length = bytes.readUInt32LE(12), source = JSON.parse(bytes.subarray(20, 20 + length).toString());
  for (const m of source.materials) { delete m.pbrMetallicRoughness.baseColorTexture; delete m.normalTexture; }
  source.images = []; source.textures = [];
  const json = Buffer.from(JSON.stringify(source)), padded = Buffer.alloc(Math.ceil(json.length / 4) * 4, 32); json.copy(padded);
  const binary = bytes.subarray(20 + length), output = Buffer.alloc(20 + padded.length + binary.length);
  output.writeUInt32LE(0x46546c67, 0); output.writeUInt32LE(2, 4); output.writeUInt32LE(output.length, 8);
  output.writeUInt32LE(padded.length, 12); output.writeUInt32LE(0x4e4f534a, 16); padded.copy(output, 20); binary.copy(output, 20 + padded.length);
  const asset = await new GLTFLoader().parseAsync(output.buffer.slice(output.byteOffset, output.byteOffset + output.byteLength), '');
  if (name.endsWith('-head')) asset.scene.traverse(object => { if (object instanceof THREE.Mesh) (object.material as THREE.MeshStandardMaterial).map = new THREE.Texture(); });
  return asset;
}
async function setup(t: test.TestContext) {
  const names = ['club-male', 'club-female', 'trinity', 'trinity-club', 'morpheus', 'seraph-head', 'seraph-body'];
  const assets = Object.fromEntries(await Promise.all(names.map(async name => [name, await geometry(name)])));
  t.mock.method(GLTFLoader.prototype, 'loadAsync', async url => assets[String(url).split('/').pop()!.replace('.glb', '')]);
  t.mock.method(THREE.TextureLoader.prototype, 'load', () => new THREE.Texture());
  const previous = globalThis.document;
  globalThis.document = { createElement: () => ({ getContext: () => ({ createRadialGradient: () => ({ addColorStop() {} }), fillRect() {}, strokeRect() {}, fillText() {},
    createImageData: (w: number, h: number) => ({ data: new Uint8ClampedArray(w * h * 4) }), putImageData() {} }) }) } as unknown as Document;
  const world = new WorldState(); new AgentManager(world).initializeAllAgents(); const models = new CharacterModels();
  const center = FILM_SETS.film_club_hel.center, root = new THREE.Group(); root.position.set(center.x, center.y - 1, center.z);
  const performers = new HelClubPerformers(root); await performers.ready;
  const rigs = Object.fromEntries(HEL_TRIO.map(id => [id, models.create(world.agents.get(id)!)]));
  for (const rig of Object.values(rigs)) models.animate(rig, 0, { speed: 0, grounded: true, verticalVelocity: 0, turn: 0 }, 0);
  await new Promise(resolve => setImmediate(resolve));
  assert.ok(rigs.trinity.hero && rigs.morpheus.hero && rigs.seraph.root.getObjectByName('seraph-detailed-body'));
  const disarm: HelDisarm = { elapsed: 0, starts: { trinity: { x: 0, y: 1.2, z: -27.92, yaw: Math.PI },
    morpheus: { x: -4, y: 1.2, z: -27, yaw: Math.PI }, seraph: { x: 4, y: 1.2, z: -27, yaw: Math.PI } } };
  const journey = { scene: 'm3_hel_bargain', actor: 'trinity', step: 0, helBargain: { phase: 'disarming', elapsed: 0, disarm } } as FilmJourney;
  const pose = (elapsed: number, time = 0) => {
    disarm.elapsed = elapsed;
    for (const role of HEL_TRIO) {
      const rig = rigs[role], start = disarm.starts[role]; rig.root.position.set(center.x + start.x, center.y - 1 + start.y, center.z + start.z); rig.root.rotation.y = start.yaw;
      models.animate(rig, 0, { speed: 0, grounded: true, verticalVelocity: 0, turn: 0, weaponStyle: 'hel_pistol',
        armed: elapsed < HEL_DISARM.release, helDisarm: { ...disarm, role } }, 0); rig.root.updateMatrixWorld(true);
    }
    performers.update(journey, time); root.updateMatrixWorld(true);
  };
  t.after(() => { models.dispose(); performers.dispose(); globalThis.document = previous; });
  return { models, performers, root, rigs, disarm, journey, center, world, pose };
}

test('all three shipped hands release the same physical pistol at the start of its fall', async t => {
  const h = await setup(t); h.pose(HEL_DISARM.release - .000001);
  for (const role of HEL_TRIO) {
    const point = helDisarmGun({ ...h.disarm, elapsed: HEL_DISARM.release }, role);
    const target = new THREE.Vector3(h.center.x + point.x, h.center.y - 1 + point.y, h.center.z + point.z);
    const gun = h.rigs[role].weapons![0], gap = gun.getWorldPosition(new THREE.Vector3()).distanceTo(target);
    const rig = h.rigs[role], shoulder = rig.hero?.bones.get('shoulder_R') ?? rig.shoulders[0], elbow = rig.hero?.bones.get('elbow_R') ?? rig.elbows[0], wrist = rig.hero?.bones.get('wrist_R') ?? rig.mobilWrists![0];
    t.diagnostic(JSON.stringify({ role, gap, held: gun.getWorldPosition(new THREE.Vector3()).toArray(), target: target.toArray(),
      shoulder: shoulder.getWorldPosition(new THREE.Vector3()).toArray(), wrist: wrist.getWorldPosition(new THREE.Vector3()).toArray(), length: elbow.position.length() + wrist.position.length() }));
    assert.ok(gun.visible && gap < .015, `${role}'s gun jumps ${gap}m on release`);
  }
  h.pose(HEL_DISARM.release); for (const role of HEL_TRIO) assert.equal(h.rigs[role].weapons![0].visible, false);
});

test('the falling pistols land on the actual higher tread and transfer continuously to the collectors', async t => {
  const h = await setup(t), scene = new THREE.Scene(); scene.background = new THREE.Color(); scene.fog = new THREE.FogExp2();
  const renderer = new FilmSetRenderer(scene); t.after(() => renderer.dispose());
  const actor = h.world.agents.get('trinity')!; actor.currentLocation = 'film_club_hel'; actor.isInMatrix = true;
  const start = h.disarm.starts.trinity; actor.position = { x: h.center.x, y: h.center.y + start.y, z: h.center.z + start.z };
  for (const elapsed of [1.35, 1.45, 1.6, 1.85, 2.1, 2.25, 2.5, 2.75, 3.1, 3.499999, 3.5]) {
    h.pose(elapsed); renderer.update(actor, { neoLife: { journey: h.journey }, structures: [] } as any, 0); renderer.root.updateMatrixWorld(true);
    for (const role of HEL_TRIO) {
      const loose = renderer.root.getObjectByName(`hel-ground-gun-${role}`)!, collected = h.root.getObjectByName(`hel-collected-gun-${role}`)!;
      const gun = elapsed < HEL_DISARM.seconds ? loose : collected; let clearance = Infinity;
      gun.traverseVisible(object => {
        if (!(object instanceof THREE.Mesh)) return;
        for (let v = 0; v < object.geometry.attributes.position.count; v++) {
          const p = object.getVertexPosition(v, new THREE.Vector3()).applyMatrix4(object.matrixWorld);
          clearance = Math.min(clearance, p.y - (h.center.y - 1 + helTerraceFloor(p.x - h.center.x, p.z - h.center.z)));
        }
      });
      t.diagnostic(JSON.stringify({ role, elapsed, clearance })); assert.ok(clearance >= -.015, `${role}'s pistol penetrates the tread at ${elapsed}: ${clearance}`);
      if (elapsed === 3.5) {
        assert.equal(collected.visible, true); assert.ok(collected.getWorldPosition(new THREE.Vector3()).distanceTo(loose.getWorldPosition(new THREE.Vector3())) < .005,
          'the collected prop must start at the same visible position');
      }
    }
  }
});

test('the visible collectors reach the grips, stay above the floor and keep the same paused pose', async t => {
  const h = await setup(t);
  for (const elapsed of [0, .7, 1.35, 1.65, 1.9, 2.25, 2.45, 2.75, 3.1, 3.5]) {
    h.pose(elapsed);
    for (const [i, role] of HEL_TRIO.entries()) {
      const side = role === 'morpheus' ? 'L' : 'R', person = h.root.getObjectByName(`hel-dancer-${i}`)!, wrist = person.getObjectByName('wrist_' + side)!;
      const gun = helDisarmGun(h.disarm, role), orientation = new THREE.Quaternion().setFromEuler(new THREE.Euler(gun.pitch, gun.yaw, gun.roll, 'YXZ'));
      const grip = new THREE.Vector3(h.center.x + gun.x, h.center.y - 1 + gun.y, h.center.z + gun.z)
        .sub(new THREE.Vector3(0, -.08, .13).applyQuaternion(orientation));
      const gap = wrist.getWorldPosition(new THREE.Vector3()).distanceTo(grip); let clearance = Infinity, lowest: unknown;
      person.traverseVisible(object => {
        if (!(object instanceof THREE.Mesh) || object.parent?.userData.helPistol) return;
        if (object instanceof THREE.SkinnedMesh) object.skeleton.update();
        for (let v = 0; v < object.geometry.attributes.position.count; v++) {
          const p = object.getVertexPosition(v, new THREE.Vector3()).applyMatrix4(object.matrixWorld);
          const floor = h.center.y - 1 + helTerraceFloor(p.x - h.center.x, p.z - h.center.z), distance = p.y - floor;
          if (distance < clearance) { clearance = distance; lowest = { object: object.name, position: p.toArray(), floor, bones: object instanceof THREE.SkinnedMesh
            ? [0, 1, 2, 3].map(k => [object.skeleton.bones[object.geometry.attributes.skinIndex.getComponent(v, k)].name, object.geometry.attributes.skinWeight.getComponent(v, k)]) : [] }; }
        }
      });
      t.diagnostic(JSON.stringify({ role, elapsed, gap, clearance, lowest, shoulder: person.getObjectByName('shoulder_' + side)!.getWorldPosition(new THREE.Vector3()).toArray(),
        wrist: wrist.getWorldPosition(new THREE.Vector3()).toArray(), target: grip.toArray(), length: (person.getObjectByName('elbow_' + side)!.position.length() + wrist.position.length()) * .88 }));
      assert.ok(clearance >= -.025, `the visible collector enters the floor at ${elapsed}: ${clearance}`);
      if (elapsed >= HEL_DISARM.pickup) assert.ok(gap < .025, `the actual hand misses ${role}'s pistol by ${gap}m`);
      const before = wrist.getWorldPosition(new THREE.Vector3()); h.pose(elapsed, 1000);
      assert.ok(wrist.getWorldPosition(new THREE.Vector3()).distanceTo(before) < .002, 'wall time cannot move a saved pickup pose');
    }
  }
});

test('the actual trio keeps shoes and clothes above the shared stairs during surrender', async t => {
  const h = await setup(t);
  for (const elapsed of [0, .3, .7, 1.1, 1.349, 1.35, 1.6, 1.9, 2.25, 2.75, 3.5]) {
    h.pose(elapsed);
    for (const role of HEL_TRIO) {
      let clearance = Infinity;
      h.rigs[role].root.traverseVisible(object => {
        if (!(object instanceof THREE.Mesh)) return;
        if (object instanceof THREE.SkinnedMesh) object.skeleton.update();
        for (let v = 0; v < object.geometry.attributes.position.count; v++) {
          const p = object.getVertexPosition(v, new THREE.Vector3()).applyMatrix4(object.matrixWorld);
          clearance = Math.min(clearance, p.y - (h.center.y - 1 + helTerraceFloor(p.x - h.center.x, p.z - h.center.z)));
        }
      });
      t.diagnostic(JSON.stringify({ role, elapsed, clearance })); assert.ok(clearance >= -.025, `${role}'s visible model enters a stair at ${elapsed}: ${clearance}`);
    }
  }
});

function physicalBreakout(h: Awaited<ReturnType<typeof setup>>) {
  // The real previous checkpoint has companions on the lower stair, not the test platform.
  h.disarm.starts = { trinity: { x: 0, y: 1.2, z: -27.91982178487342, yaw: Math.PI },
    morpheus: { x: -2.5, y: .4, z: -24.651042432590657, yaw: Math.PI },
    seraph: { x: 2.5, y: .4, z: -24.651042432590657, yaw: Math.PI } };
  h.pose(HEL_DISARM.seconds);
  const breakout: HelBreakout = { starts: { ...h.disarm.starts, trinity: { x: 0, y: 1.6, z: -29, yaw: Math.PI } }, guard: { x: 0, y: 1.6, z: -29, yaw: Math.PI },
    source: helDisarmGun(h.disarm, 'seraph') };
  const pose = (phase: 'airborne' | 'catching', elapsed: number) => {
    h.journey.helBargain = { phase, elapsed, attempts: 0, lastTick: 0, disarm: h.disarm, breakout };
    for (const role of ['trinity', 'seraph'] as const) {
      const rig = h.rigs[role], start = breakout.starts[role];
      rig.root.position.set(h.center.x + start.x, h.center.y - 1 + start.y, h.center.z + start.z); rig.root.rotation.y = start.yaw;
      h.models.animate(rig, 0, { speed: 0, grounded: true, verticalVelocity: 0, turn: 0, weaponStyle: 'hel_pistol',
        armed: role === 'trinity' && phase === 'catching', helBreakout: { role, phase, elapsed, breakout } }, 0);
    }
    h.performers.update(h.journey, 1000); h.root.updateMatrixWorld(true);
  };
  return { breakout, pose };
}

test('the real checkpoint lets Seraph’s shipped boot touch the same pistol before it leaves the collector', async t => {
  const h = await setup(t), p = physicalBreakout(h); p.pose('airborne', HEL_BREAKOUT.kick);
  const source = p.breakout.source, gun = h.root.getObjectByName('hel-collected-gun-seraph')!;
  const target = new THREE.Vector3(h.center.x + source.x, h.center.y - 1 + source.y - .07, h.center.z + source.z);
  let closest = Infinity;
  h.rigs.seraph.root.traverseVisible(object => {
    if (!(object instanceof THREE.SkinnedMesh)) return;
    object.skeleton.update(); const indices = object.geometry.attributes.skinIndex, weights = object.geometry.attributes.skinWeight;
    for (let v = 0; v < indices.count; v++) {
      const boot = [0, 1, 2, 3].some(k => /ankle_R/.test(object.skeleton.bones[indices.getComponent(v, k)].name) && weights.getComponent(v, k) > .5);
      if (boot) closest = Math.min(closest, object.getVertexPosition(v, new THREE.Vector3()).applyMatrix4(object.matrixWorld).distanceTo(target));
    }
  });
  t.diagnostic(JSON.stringify({ closest, target: target.toArray(), ankle: h.rigs.seraph.ankles[0].getWorldPosition(new THREE.Vector3()).toArray() }));
  assert.ok(closest < .16, `the visible kicking boot misses the pistol by ${closest}m`);
  p.pose('airborne', HEL_BREAKOUT.kick - .000001); assert.equal(gun.visible, true);
  const point = helBreakoutGun(p.breakout, HEL_BREAKOUT.kick);
  assert.ok(gun.getWorldPosition(new THREE.Vector3()).distanceTo(new THREE.Vector3(h.center.x + point.x, h.center.y - 1 + point.y, h.center.z + point.z)) < .005);
  p.pose('airborne', HEL_BREAKOUT.kick); assert.equal(gun.visible, false);
});

test('the actual Trinity arm catches the flying prop without a jump and keeps the grip while returning to aim', async t => {
  const h = await setup(t), p = physicalBreakout(h);
  p.breakout.caught = helBreakoutGun(p.breakout, 3.15); p.breakout.catchRoot = p.breakout.starts.trinity;
  p.pose('catching', 0);
  const gun = h.rigs.trinity.weapons![0], caught = p.breakout.caught;
  const expected = new THREE.Vector3(h.center.x + caught.x, h.center.y - 1 + caught.y, h.center.z + caught.z);
  const gap = gun.getWorldPosition(new THREE.Vector3()).distanceTo(expected);
  t.diagnostic(JSON.stringify({ gap, gun: gun.getWorldPosition(new THREE.Vector3()).toArray(), expected: expected.toArray() }));
  assert.ok(gun.visible && gap < .015, `the pistol jumps ${gap}m from flight to the visible hand`);
  for (const elapsed of [.15, .3, .5, HEL_BREAKOUT.catch]) {
    p.pose('catching', elapsed); const grip = gun.getObjectByName('hel-pistol-grip')!, wrist = h.rigs.trinity.hero!.bones.get('wrist_R')!;
    assert.ok(grip.getWorldPosition(new THREE.Vector3()).distanceTo(wrist.getWorldPosition(new THREE.Vector3())) < .23, 'the hand must travel with the grip');
    const before = gun.getWorldPosition(new THREE.Vector3()); p.pose('catching', elapsed);
    assert.ok(before.distanceTo(gun.getWorldPosition(new THREE.Vector3())) < .001, 'a paused catch cannot drift');
  }
  const end = gun.getWorldPosition(new THREE.Vector3());
  h.models.animate(h.rigs.trinity, 0, { speed: 0, grounded: true, verticalVelocity: 0, turn: 0, armed: true, weaponStyle: 'hel_pistol' }, 0);
  assert.ok(end.distanceTo(gun.getWorldPosition(new THREE.Vector3())) < .015, 'finishing the catch cannot pop into another aim pose');
});

test('the shipped kick, catch and recoiling guard stay above the actual VIP stairs', async t => {
  const h = await setup(t), p = physicalBreakout(h);
  p.breakout.caught = helBreakoutGun(p.breakout, 3.09); p.breakout.catchRoot = p.breakout.starts.trinity;
  for (const [phase, times] of [['airborne', [0, .1, .27, .55, .7, .95, 2.9, 3.1]], ['catching', [0, .15, .27, .5, .65]]] as const) {
    for (const elapsed of times) {
      p.pose(phase, elapsed);
      const guard = h.root.getObjectByName('hel-rigged-guard')!;
      for (const [role, root] of [['trinity', h.rigs.trinity.root], ['seraph', h.rigs.seraph.root], ['guard', guard]] as const) {
        let clearance = Infinity;
        root.traverseVisible(object => {
          if (!(object instanceof THREE.Mesh)) return;
          if (object instanceof THREE.SkinnedMesh) object.skeleton.update();
          for (let v = 0; v < object.geometry.attributes.position.count; v++) {
            const at = object.getVertexPosition(v, new THREE.Vector3()).applyMatrix4(object.matrixWorld);
            clearance = Math.min(clearance, at.y - (h.center.y - 1 + helTerraceFloor(at.x - h.center.x, at.z - h.center.z)));
          }
        });
        t.diagnostic(JSON.stringify({ role, phase, elapsed, clearance }));
        assert.ok(clearance >= -.025, `${role} enters a VIP tread during ${phase} at ${elapsed}: ${clearance}`);
      }
    }
  }
});
