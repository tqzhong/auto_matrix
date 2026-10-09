import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { FILM_SETS, HEL_COAT_COUNTERS, HEL_COATCHECK, helCoatcheckAllyRoot, type FilmJourney, type HelCoatcheckEncounter } from '@auto_matrix/shared';
import { CharacterModels, weaponMuzzle } from '../packages/client/src/agents/CharacterModel.js';
import { HelClubPerformers } from '../packages/client/src/engine/HelClubPerformers.js';
import { helAttendantContact, poseHelProtection } from '../packages/client/src/agents/HelCoatcheckPerformance.js';
import { AgentRenderer } from '../packages/client/src/agents/AgentRenderer.js';
import { FilmSetRenderer } from '../packages/client/src/engine/FilmSetRenderer.js';
import { helDanceDoorRoot, helDanceDoorContact, type HelDanceDoorEncounter } from '@auto_matrix/shared';
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

async function setup(t: test.TestContext, player = false) {
  const names = ['club-male', 'club-female', 'seraph-head', 'seraph-body', ...(player ? ['trinity', 'trinity-club'] : [])];
  const assets = Object.fromEntries(await Promise.all(names.map(async name => [name, await geometry(name)])));
  t.mock.method(GLTFLoader.prototype, 'loadAsync', async url => assets[String(url).split('/').pop()!.replace('.glb', '')]);
  t.mock.method(THREE.TextureLoader.prototype, 'load', () => new THREE.Texture());
  const previous = globalThis.document;
  globalThis.document = { createElement: () => ({ getContext: () => ({ createRadialGradient: () => ({ addColorStop() {} }), fillRect() {}, strokeRect() {}, fillText() {},
    createImageData: (w: number, h: number) => ({ data: new Uint8ClampedArray(w * h * 4) }), putImageData() {} }) }) } as unknown as Document;
  const world = new WorldState(); new AgentManager(world).initializeAllAgents(); const models = new CharacterModels();
  const root = new THREE.Group(), center = FILM_SETS.film_club_hel.center; root.position.set(center.x, center.y - 1, center.z);
  const performers = new HelClubPerformers(root); await performers.ready;
  const rig = models.create(world.agents.get('seraph')!);
  t.after(() => { models.dispose(); performers.dispose(); globalThis.document = previous; });
  models.animate(rig, 0, { speed: 0, grounded: true, verticalVelocity: 0, turn: 0 }, 0);
  await new Promise(resolve => setImmediate(resolve)); assert.ok(rig.root.getObjectByName('seraph-detailed-body'));
  const state: HelCoatcheckEncounter = { phase: 'combat', ammo: 12, wave: 1, shots: 0, kills: 0, allyShotAt: [0, 0], coverHits: [0, 0],
    rescuePhysical: true, rescueElapsed: 0, rescueStart: { x: 4, z: 20, yaw: Math.PI } };
  const journey = { scene: 'm3_hel_entry', step: 1, helCoatcheck: state } as FilmJourney;
  function pose(elapsed: number) {
    state.rescueElapsed = elapsed; const at = helCoatcheckAllyRoot(state, 'seraph');
    rig.root.position.set(center.x + at.x, center.y - 1, center.z + at.z); rig.root.rotation.y = at.yaw;
    models.animate(rig, 0, { speed: 0, grounded: true, verticalVelocity: 0, turn: 0 }, 0);
    performers.update(journey, 0); poseHelProtection(rig, performers.coatcheckAttendant, state); root.updateMatrixWorld(true);
  }
  return { rig, performers, root, state, journey, pose, center, models, world };
}

test('Seraph’s real palm follows the visible upper arm while the attendant is moved and lowered', async t => {
  const h = await setup(t), girl = h.performers.coatcheckAttendant!;
  for (const elapsed of [1.65, 1.9, 2.25, 2.5, 2.75, 3.1]) {
    h.pose(elapsed); const contact = helAttendantContact(girl); assert.ok(contact, `no visible upper-arm surface at ${elapsed}`);
    const palm = h.rig.mobilWrists![0].localToWorld(new THREE.Vector3(0, -.10, .005));
    t.diagnostic(JSON.stringify({ elapsed, distance: palm.distanceTo(contact.point), palm: palm.toArray(), contact: contact.point.toArray(), normal: contact.normal.toArray(),
      root: h.rig.root.position.toArray(), shoulder: h.rig.shoulders[0].getWorldPosition(new THREE.Vector3()).toArray(),
      elbow: h.rig.elbows[0].getWorldPosition(new THREE.Vector3()).toArray(), wrist: h.rig.mobilWrists![0].getWorldPosition(new THREE.Vector3()).toArray(),
      lengths: [h.rig.elbows[0].position.length(), h.rig.mobilWrists![0].position.length()], scale: h.rig.shoulders[0].getWorldScale(new THREE.Vector3()).toArray(),
      shoulderRotation: h.rig.shoulders[0].rotation.toArray(), wristRotation: h.rig.mobilWrists![0].rotation.toArray(), contactApplied: h.rig.detail.userData.helProtectionContact }));
    assert.ok(palm.distanceTo(contact.point) < .12, `Seraph misses the visible arm at ${elapsed}`);
    const saved = palm.clone(); h.pose(elapsed);
    assert.ok(h.rig.mobilWrists![0].localToWorld(new THREE.Vector3(0, -.10, .005)).distanceTo(saved) < .002, 'the same paused or loaded pose must not drift');
  }
});

test('the actual attendant keeps shoes above the floor and her visible body clear of the solid counter', async t => {
  const h = await setup(t), girl = h.performers.coatcheckAttendant!;
  for (const elapsed of [0, 1.6, 1.9, 2.25, 2.5, 2.75, 3.1, HEL_COATCHECK.rescueSeconds]) {
    h.pose(elapsed); let bottom = Infinity, top = -Infinity, inside = 0;
    girl.traverse(object => {
      if (!(object instanceof THREE.Mesh)) return;
      for (let parent: THREE.Object3D | null = object; parent; parent = parent.parent) if (!parent.visible) return;
      if (object instanceof THREE.SkinnedMesh) object.skeleton.update();
      for (let v = 0; v < object.geometry.attributes.position.count; v++) {
        const point = object.getVertexPosition(v, new THREE.Vector3()).applyMatrix4(object.matrixWorld);
        bottom = Math.min(bottom, point.y); top = Math.max(top, point.y);
        if (HEL_COAT_COUNTERS.some(c => point.x > h.center.x + c.x - c.width / 2 + .02 && point.x < h.center.x + c.x + c.width / 2 - .02
          && point.z > h.center.z + c.z - c.depth / 2 + .02 && point.z < h.center.z + c.z + c.depth / 2 - .02 && point.y < c.height - .02)) inside++;
      }
    });
    t.diagnostic(JSON.stringify({ elapsed, bottom, top, inside }));
    assert.ok(bottom >= -.025 && bottom < .09, `the attendant's soles miss the floor at ${elapsed}: ${bottom}`);
    assert.equal(inside, 0, `visible attendant geometry crosses the counter at ${elapsed}`);
    if (elapsed >= 3.1) assert.ok(top < HEL_COAT_COUNTERS[1].height, 'the crouched attendant is actually below the bullet-blocking counter');
  }
});

test('the shipped Seraph hand reaches the attendant without putting his shoes or body through the counter', async t => {
  const h = await setup(t);
  for (const elapsed of [1.65, 1.9, 2.25, 2.5, 2.75, 3.1]) {
    h.pose(elapsed); const contact = helAttendantContact(h.performers.coatcheckAttendant!)!;
    let nearest = Infinity, bottom = Infinity, inside = 0;
    h.rig.root.traverseVisible(object => {
      if (!(object instanceof THREE.Mesh)) return;
      if (object instanceof THREE.SkinnedMesh) object.skeleton.update();
      const indices = object.geometry.attributes.skinIndex, weights = object.geometry.attributes.skinWeight;
      for (let v = 0; v < object.geometry.attributes.position.count; v++) {
        const point = object.getVertexPosition(v, new THREE.Vector3()).applyMatrix4(object.matrixWorld); bottom = Math.min(bottom, point.y);
        if (HEL_COAT_COUNTERS.some(c => point.x > h.center.x + c.x - c.width / 2 + .02 && point.x < h.center.x + c.x + c.width / 2 - .02
          && point.z > h.center.z + c.z - c.depth / 2 + .02 && point.z < h.center.z + c.z + c.depth / 2 - .02 && point.y < c.height - .02)) inside++;
        if (object instanceof THREE.SkinnedMesh && object.name === 'seraph-anatomical-body') {
          let hand = 0;
          for (let i = 0; i < 4; i++) if (/^(wrist|finger).*_R$/.test(object.skeleton.bones[indices.getComponent(v, i)].name)) hand += weights.getComponent(v, i);
          if (hand > .7) nearest = Math.min(nearest, point.distanceTo(contact.point));
        }
      }
    });
    t.diagnostic(JSON.stringify({ elapsed, nearest, bottom, inside }));
    assert.ok(nearest < .11, `the visible Seraph hand misses the arm at ${elapsed}: ${nearest}`);
    assert.ok(bottom >= -.025 && bottom < .09, `the visible Seraph shoes are unsupported at ${elapsed}: ${bottom}`);
    assert.equal(inside, 0, `Seraph penetrates the solid counter at ${elapsed}`);
  }
});

test('Trinity’s shipped first-person pistol and gripping hand remain visible without rendering her own face', async t => {
  const h = await setup(t, true), rig = h.models.create(h.world.agents.get('trinity')!);
  await new Promise(resolve => setImmediate(resolve)); assert.ok(rig.hero);
  rig.root.position.set(h.center.x, h.center.y - 1, h.center.z + 19); rig.root.rotation.y = Math.PI;
  for (const aspect of [440 / 668, 16 / 9]) for (const pitch of [-.55, 0, .55]) {
    h.models.animate(rig, 0, { speed: 0, grounded: true, verticalVelocity: 0, turn: 0, firstPerson: true,
      armed: true, weaponStyle: 'hel_pistol', aimPitch: pitch }, 0); rig.root.updateMatrixWorld(true);
    const camera = new THREE.PerspectiveCamera(68, aspect, .15, 500);
    camera.position.set(h.center.x, h.center.y + 2.99, h.center.z + 19);
    const forward = new THREE.Vector3(0, -Math.sin(pitch), -Math.cos(pitch)); camera.lookAt(camera.position.clone().add(forward)); camera.updateMatrixWorld(true);
    const gun = rig.weapons![0], palm = rig.hero!.bones.get('wrist_R')!.localToWorld(new THREE.Vector3(0, -.13, .03)), screen = palm.clone().project(camera);
    let visible = 0;
    gun.traverseVisible(object => {
      if (!(object instanceof THREE.Mesh)) return;
      for (let v = 0; v < object.geometry.attributes.position.count; v++) {
        const p = object.getVertexPosition(v, new THREE.Vector3()).applyMatrix4(object.matrixWorld).project(camera);
        if (Math.abs(p.x) < .95 && p.y > -.75 && p.y < .9 && p.z > -1 && p.z < 1) visible++;
      }
    });
    t.diagnostic(JSON.stringify({ aspect, pitch, visible, hand: screen.toArray() }));
    assert.ok(visible > 0, `the held pistol is outside the firing view at ${aspect}/${pitch}`);
    assert.ok(weaponMuzzle(rig)!.distanceTo(gun.localToWorld(new THREE.Vector3(0, .065, .475))) < .005, 'gunfire must start at the visible barrel');
    assert.ok(new THREE.Vector3(0, 0, 1).transformDirection(gun.matrixWorld).dot(forward) > .999, 'the physical barrel must follow the pitch of the firing view');
    assert.ok(Math.abs(screen.x) < .95 && screen.y > -.5 && screen.y < .9 && screen.z > -1 && screen.z < 1,
      `the real gripping hand is outside the firing view at ${aspect}/${pitch}: ${screen.toArray()}`);
    const skin = rig.hero!.trackingSkin!.mesh; skin.skeleton.update(); skin.computeBoundingBox(); skin.computeBoundingSphere();
    const face = new THREE.Raycaster(camera.position, forward, .01, 20).intersectObject(skin).filter(hit =>
      [hit.face!.a, hit.face!.b, hit.face!.c].some(v => [0, 1, 2, 3].some(i => skin.geometry.attributes.skinWeight.getComponent(v, i) > .05
        && /^(head|neck)$/.test(skin.skeleton.bones[skin.geometry.attributes.skinIndex.getComponent(v, i)].name))));
    assert.equal(face.length, 0, 'own head/neck skin cannot obstruct the actual firing view');
  }
});

test('Trinity’s actual finger skin closes around the pistol grip instead of passing through it', async t => {
  const h = await setup(t, true), rig = h.models.create(h.world.agents.get('trinity')!);
  await new Promise(resolve => setImmediate(resolve)); assert.ok(rig.hero);
  h.models.animate(rig, 0, { speed: 0, grounded: true, verticalVelocity: 0, turn: 0, armed: true, weaponStyle: 'hel_pistol' }, 0);
  rig.root.updateMatrixWorld(true);
  const gun = rig.weapons![0], grip = gun.children.find(object => object instanceof THREE.Mesh
    && object.geometry.type === 'BoxGeometry' && object.scale.y === .27)!;
  assert.ok(grip, 'the held pistol must have a physical grip');
  const skin = rig.hero!.trackingSkin!.mesh, nearest = [Infinity, Infinity, Infinity];
  t.diagnostic(JSON.stringify({ rest: Array.from({ length: 5 }, (_, f) => Array.from({ length: 3 }, (_, s) =>
    rig.hero!.rest.get(`finger${f + 1}-${s + 1}_R`)!.toArray())) }));
  skin.skeleton.update(); const scale = grip.getWorldScale(new THREE.Vector3()); let penetration = 0;
  let deepest: unknown;
  for (let v = 0; v < skin.geometry.attributes.position.count; v++) {
    let hand = 0; const distal = [0, 0, 0];
    for (let i = 0; i < 4; i++) {
      const name = skin.skeleton.bones[skin.geometry.attributes.skinIndex.getComponent(v, i)].name;
      const weight = skin.geometry.attributes.skinWeight.getComponent(v, i);
      if (/^(wrist|finger).*_R$/.test(name)) hand += weight;
      for (let f = 3; f <= 5; f++) if (name === `finger${f}-3_R`) distal[f - 3] += weight;
    }
    if (hand < .7) continue;
    const point = grip.worldToLocal(skin.getVertexPosition(v, new THREE.Vector3()).applyMatrix4(skin.matrixWorld));
    const outside = new THREE.Vector3(Math.max(0, Math.abs(point.x) - .5) * scale.x,
      Math.max(0, Math.abs(point.y) - .5) * scale.y, Math.max(0, Math.abs(point.z) - .5) * scale.z).length();
    if (!outside) {
      const depth = Math.min((.5 - Math.abs(point.x)) * scale.x, (.5 - Math.abs(point.y)) * scale.y, (.5 - Math.abs(point.z)) * scale.z);
      if (depth > penetration) {
        penetration = depth; deepest = { point: point.toArray(), bones: Array.from({ length: 4 }, (_, i) => [
          skin.skeleton.bones[skin.geometry.attributes.skinIndex.getComponent(v, i)].name, skin.geometry.attributes.skinWeight.getComponent(v, i)]) };
      }
    }
    for (let f = 0; f < 3; f++) if (distal[f] > .5) nearest[f] = Math.min(nearest[f], outside);
  }
  t.diagnostic(JSON.stringify({ nearest, penetration, deepest, fingers: Array.from({ length: 5 }, (_, f) =>
    grip.worldToLocal(rig.hero!.bones.get(`finger${f + 1}-3_R`)!.getWorldPosition(new THREE.Vector3())).toArray()) }));
  assert.ok(penetration < .018, `the visible hand penetrates the solid grip by ${penetration}m`);
  nearest.forEach((distance, i) => assert.ok(distance < .035, `finger ${i + 3} is open, ${distance}m away from the grip`));
});

test('rejoining the saved half-open Hel door restores both real arms even after the temporary action was cleared', async t => {
  const h = await setup(t, true), actor = h.world.agents.get('trinity')!;
  actor.position = { x: h.center.x, y: h.center.y, z: h.center.z + 4 };
  actor.rotation = Math.PI; actor.currentLocation = 'film_club_hel'; actor.isInMatrix = true; actor.currentAction = null;
  const journey = { scene: 'm3_hel_entry', actor: 'trinity', step: 3, helDanceDoor: { phase: 'opening', elapsed: 1.5, lastTick: 6960 } } as FilmJourney;
  const warm = new AgentRenderer(new THREE.Scene()), cold = new AgentRenderer(new THREE.Scene());
  t.after(() => { warm.dispose(); cold.dispose(); });
  for (const renderer of [warm, cold]) { renderer.updateAgent('trinity', actor); renderer.setPlayer('trinity', true); renderer.getAgentBody('trinity')!.rotation.y = actor.rotation; }
  await new Promise(resolve => setImmediate(resolve));
  const input = { speed: 0, grounded: true, verticalVelocity: 0, turn: 0, firstPerson: true };
  warm.setPlayerMotion({ ...input, helDanceDoor: .6 }); cold.setPlayerMotion({ ...input });
  warm.update(0, undefined, 0, 6960, journey); cold.update(0, undefined, 0, 6960, journey);
  const warmBody = warm.getAgentBody('trinity')!, coldBody = cold.getAgentBody('trinity')!;
  warmBody.updateWorldMatrix(true, true); coldBody.updateWorldMatrix(true, true);
  assert.ok(coldBody.visible, 'the actual first-person arms must survive rejoining a paused door');
  for (const side of ['R', 'L']) {
    const before = warmBody.getObjectByName(`wrist_${side}`)!.getWorldPosition(new THREE.Vector3());
    const after = coldBody.getObjectByName(`wrist_${side}`)!.getWorldPosition(new THREE.Vector3());
    assert.ok(after.distanceTo(before) < .005, `the saved ${side} arm lost its pushing pose`);
    assert.ok(after.y > h.center.y + 1.2 && after.z < actor.position.z - .3, `the ${side} hand must actually be raised forward`);
  }
  assert.equal(coldBody.getObjectByName('head')!.visible, false, 'the restored own head must not fill the first-person view');
  const saved = coldBody.getObjectByName('wrist_R')!.getWorldPosition(new THREE.Vector3());
  cold.update(.3, undefined, 0, 6960, journey); coldBody.updateWorldMatrix(true, true);
  assert.ok(coldBody.getObjectByName('wrist_R')!.getWorldPosition(new THREE.Vector3()).distanceTo(saved) < .005, 'paused presentation cannot advance the saved action');
  journey.helDanceDoor!.phase = 'open'; journey.step = 4;
  cold.setPlayerMotion({ ...input }); cold.update(0, undefined, 0, 6960, journey);
  assert.equal(coldBody.visible, false, 'the temporary first-person body exception must end with the door');
});

test('both shipped Trinity palms contact the same swinging door panels without skin entering their solid fronts', async t => {
  const h = await setup(t, true), actor = h.world.agents.get('trinity')!, rig = h.models.create(actor);
  await new Promise(resolve => setImmediate(resolve)); assert.ok(rig.hero);
  const door: HelDanceDoorEncounter = { phase: 'opening', physical: true, elapsed: 1.3, lastTick: 0, approach: { x: .6, z: 4.2, yaw: .3 } };
  const journey = { scene: 'm3_hel_entry', actor: 'trinity', step: 3, helDanceDoor: door } as FilmJourney;
  const scene = new THREE.Scene(); scene.background = new THREE.Color(); scene.fog = new THREE.FogExp2();
  const renderer = new FilmSetRenderer(scene); t.after(() => renderer.dispose());
  actor.currentLocation = 'film_club_hel'; actor.isInMatrix = true;
  for (const elapsed of [0, .2, .35, .6, .7, .85, 1, 1.15, 1.3, 1.4, 1.6, 1.8, 2, 2.1, 2.2, 2.3, 2.4, 2.5, 2.8, 3.2, 3.6]) {
    door.elapsed = elapsed; const at = helDanceDoorRoot(door);
    actor.position = { x: h.center.x + at.x, y: h.center.y, z: h.center.z + at.z };
    rig.root.position.set(actor.position.x, actor.position.y - 1, actor.position.z); rig.root.rotation.y = at.yaw;
    h.models.animate(rig, 0, { speed: 0, grounded: true, verticalVelocity: 0, turn: 0, helDoorPush: door }, 0);
    renderer.update(actor, { neoLife: { journey }, structures: [] } as any, 0);
    rig.root.updateMatrixWorld(true); renderer.root.updateMatrixWorld(true);
    const skin = rig.hero!.trackingSkin!.mesh; skin.skeleton.update();
    const solids: THREE.Mesh[] = [];
    for (const name of ['hel-dance-left-door', 'hel-dance-right-door']) renderer.root.getObjectByName(name)!.traverseVisible(object => {
      if (object instanceof THREE.Mesh) { object.geometry.computeBoundingBox(); solids.push(object); }
    });
    let bottom = Infinity, inside = 0;
    rig.root.traverseVisible(object => {
      if (!(object instanceof THREE.Mesh)) return;
      if (object instanceof THREE.SkinnedMesh) object.skeleton.update();
      for (let v = 0; v < object.geometry.attributes.position.count; v++) {
        const point = object.getVertexPosition(v, new THREE.Vector3()).applyMatrix4(object.matrixWorld); bottom = Math.min(bottom, point.y);
        for (const solid of solids) {
          const local = solid.worldToLocal(point.clone()), bounds = solid.geometry.boundingBox!, scale = solid.getWorldScale(new THREE.Vector3());
          if (local.x > bounds.min.x + .015 / scale.x && local.x < bounds.max.x - .015 / scale.x
            && local.y > bounds.min.y + .015 / scale.y && local.y < bounds.max.y - .015 / scale.y
            && local.z > bounds.min.z + .015 / scale.z && local.z < bounds.max.z - .015 / scale.z) inside++;
        }
      }
    });
    t.diagnostic(JSON.stringify({ elapsed, bottom, inside }));
    assert.ok(bottom >= -.025 && bottom < .09, `Trinity's actual soles lose support at ${elapsed}: ${bottom}`);
    assert.equal(inside, 0, `visible skin or clothes enter the moving door at ${elapsed}`);
    if (elapsed < 1.3 || elapsed > 2.1) continue;
    for (const [i, side] of (['R', 'L'] as const).entries()) {
      const contact = helDanceDoorContact(door, i ? -1 : 1), normal = new THREE.Vector3(contact.normal.x, 0, contact.normal.z);
      const target = new THREE.Vector3(h.center.x + contact.x, h.center.y - 1 + contact.y, h.center.z + contact.z);
      const panel = renderer.root.getObjectByName(i ? 'hel-dance-left-door' : 'hel-dance-right-door')!;
      const surface = new THREE.Raycaster(target.clone().addScaledVector(normal, .4), normal.clone().negate(), 0, 1).intersectObject(panel, true)[0];
      assert.ok(surface && surface.point.distanceTo(target) < .006, 'the contact point must use the actually rendered panel front');
      let gap = Infinity, penetration = 0, maximum = -Infinity, front: unknown;
      for (let v = 0; v < skin.geometry.attributes.position.count; v++) {
        let hand = 0;
        for (let k = 0; k < 4; k++) if (new RegExp(`^(wrist|finger).*_${side}$`).test(skin.skeleton.bones[skin.geometry.attributes.skinIndex.getComponent(v, k)].name)) hand += skin.geometry.attributes.skinWeight.getComponent(v, k);
        if (hand < .8) continue;
        const point = skin.getVertexPosition(v, new THREE.Vector3()).applyMatrix4(skin.matrixWorld);
        const local = rig.hero!.bones.get(`wrist_${side}`)!.worldToLocal(point.clone());
        if (local.x * (i ? -1 : 1) > maximum) { maximum = local.x * (i ? -1 : 1); front = { point: local.toArray(), bones: [0, 1, 2, 3].map(k => [skin.skeleton.bones[skin.geometry.attributes.skinIndex.getComponent(v, k)].name, skin.geometry.attributes.skinWeight.getComponent(v, k)]) }; }
        gap = Math.min(gap, point.distanceTo(surface.point));
        penetration = Math.max(penetration, -point.clone().sub(surface.point).dot(normal));
      }
      t.diagnostic(JSON.stringify({ elapsed, side, gap, penetration, front, target: target.toArray(), root: rig.root.position.toArray(),
        shoulder: rig.hero!.bones.get(`shoulder_${side}`)!.getWorldPosition(new THREE.Vector3()).toArray(),
        wrist: rig.hero!.bones.get(`wrist_${side}`)!.getWorldPosition(new THREE.Vector3()).toArray(),
        palm: rig.detail.userData[`helDoorPalm${side}`]?.toArray(), scale: rig.hero!.bones.get(`wrist_${side}`)!.getWorldScale(new THREE.Vector3()).toArray(),
        lengths: [rig.hero!.bones.get(`elbow_${side}`)!.position.length(), rig.hero!.bones.get(`wrist_${side}`)!.position.length()] }));
      assert.ok(gap < .035, `the actual ${side} palm floats off its panel at ${elapsed}: ${gap}`);
      assert.ok(penetration < .015, `the ${side} hand crosses the panel by ${penetration}m at ${elapsed}`);
    }
  }
});
