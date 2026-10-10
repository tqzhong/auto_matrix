import assert from 'node:assert/strict';
import test, { type TestContext } from 'node:test';
import { readFile } from 'node:fs/promises';
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { APU_RIG, DOCK_RELOAD, dockReloadBox, dockReloadHeight, dockLastStandPose, newDockLastStand, newDockReload, newDockGate, dockGatePoint, dockGateEye, type FilmJourney, type DockLastStand, type DockReload } from '@auto_matrix/shared';
import { CharacterModels } from '../packages/client/src/agents/CharacterModel.js';
import { AgentRenderer } from '../packages/client/src/agents/AgentRenderer.js';
import { PlayerControls } from '../packages/client/src/player/PlayerControls.js';
import { ZionHomecomingRenderer } from '../packages/client/src/engine/ZionHomecomingRenderer.js';
import { WorldState } from '../packages/server/src/world/WorldState.js';
import { AgentManager } from '../packages/server/src/agents/AgentManager.js';

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
  const names = ['mifune-head', 'kid-head', 'mifune-body', 'kid-body'];
  const assets = Object.fromEntries(await Promise.all(names.map(async name => [name, await shipped(name)])));
  const pending: (() => void)[] = [];
  t.mock.method(GLTFLoader.prototype, 'loadAsync', async url => {
    const name = String(url).split('/').pop()!.replace('.glb', '');
    if (delayed && name.endsWith('-body')) await new Promise<void>(resolve => pending.push(resolve));
    return assets[name];
  });
  t.mock.method(THREE.TextureLoader.prototype, 'load', () => new THREE.Texture());
  const previous = globalThis.document;
  globalThis.document = { createElement: () => ({ getContext: () => ({ createRadialGradient: () => ({ addColorStop() {} }), createImageData: (w: number, h: number) => ({ data: new Uint8ClampedArray(w * h * 4) }), putImageData() {}, fillRect() {}, fillText() {}, strokeRect() {} }) }) } as unknown as Document;
  const world = new WorldState(); new AgentManager(world).initializeAllAgents(); const models = new CharacterModels();
  const rigs = { mifune: models.create(world.agents.get('mifune')!), kid: models.create(world.agents.get('kid')!) };
  const root = new THREE.Group(), renderer = new ZionHomecomingRenderer(root, 'film_zion_hangar');
  const input = { speed: 0, grounded: true, verticalVelocity: 0, turn: 0, realWorld: true };
  const seated = () => {
    renderer.update({ scene: 'm3_dock_battle', actor: 'mifune', step: 0, completed: [] } as FilmJourney, 0);
    for (const rig of Object.values(rigs)) {
      rig.root.position.set(0, APU_RIG.floor + APU_RIG.pilot.y, 12); rig.root.rotation.y = Math.PI;
      models.animate(rig, 0, { ...input, apuDriving: true, seated: true, riding: true }, 1);
      rig.root.updateWorldMatrix(true, true);
    }
    root.updateWorldMatrix(true, true);
  };
  const fallen = (state: DockLastStand) => {
    const p = dockLastStandPose(state).mifune, rig = rigs.mifune;
    rig.root.position.set(p.x, p.y, p.z); rig.root.rotation.y = p.yaw;
    models.animate(rig, 0, { ...input, dockLastStand: { ...state, role: 'mifune' } }, 1);
    rig.root.updateWorldMatrix(true, true);
  };
  const reload = (state: DockReload) => {
    const rig = rigs.kid; rig.root.position.set(DOCK_RELOAD.entry.x, dockReloadHeight(state.climb), DOCK_RELOAD.entry.z); rig.root.rotation.y = Math.PI;
    models.animate(rig, 0, { ...input, dockReload: { ...state, role: 'kid' } }, 1); rig.root.updateWorldMatrix(true, true);
  };
  t.after(() => { models.dispose(); renderer.dispose(); globalThis.document = previous; });
  seated(); await new Promise(resolve => setImmediate(resolve)); seated();
  return { world, rigs, root, models, renderer, input, seated, fallen, reload, release: async () => { pending.forEach(resolve => resolve()); await new Promise(resolve => setImmediate(resolve)); } };
}
function points(object: THREE.Object3D) {
  const result: THREE.Vector3[] = [];
  object.traverseVisible(mesh => {
    if (!(mesh instanceof THREE.Mesh)) return;
    if (mesh instanceof THREE.SkinnedMesh) mesh.skeleton.update();
    for (let i = 0; i < mesh.geometry.attributes.position.count; i++) result.push(mesh.localToWorld(mesh.getVertexPosition(i, new THREE.Vector3())));
  });
  return result;
}

for (const role of ['mifune', 'kid'] as const) test(`${role}'s delivered anatomy keeps real palm, pedal and seat clearances`, async t => {
  const h = await fixture(t), rig = h.rigs[role];
  const body = rig.root.getObjectByName(`${role}-detailed-body`)!;
  assert.ok(body?.visible && rig.head.getObjectByName(`${role}-detailed-head`)?.visible, 'both delivered GLBs must replace the placeholder');
  assert.equal(rig.head.getObjectByName(`${role}-fallback-head`)!.visible, false);
  const skin = rig.root.getObjectByName(`${role}-anatomical-body`) as THREE.SkinnedMesh; skin.skeleton.update();
  const boots = points(rig.root.getObjectByName(`${role}-work-boots`)!);
  for (let side = 0; side < 2; side++) {
    const sign = side ? 1 : -1, handle = h.root.getObjectByName(`apu-control-${-sign}`)!.getWorldPosition(new THREE.Vector3());
    let distance = Infinity;
    const p = skin.geometry.attributes.position;
    for (let i = 0; i < p.count; i++) if (p.getY(i) >= 1.45 && p.getY(i) <= 1.79 && Math.sign(p.getX(i)) === sign)
      distance = Math.min(distance, skin.localToWorld(skin.getVertexPosition(i, new THREE.Vector3())).distanceTo(handle));
    assert.ok(distance < .075, `palm misses handle by ${distance}`);
    const pedal = h.root.getObjectByName(`apu-pedal-${-sign}`)!, box = new THREE.Box3().setFromObject(pedal);
    const over = boots.filter(p => p.x >= box.min.x && p.x <= box.max.x && p.z >= box.min.z && p.z <= box.max.z);
    assert.ok(over.length > 30); const bottom = Math.min(...over.map(p => p.y));
    assert.ok(Math.abs(bottom - box.max.y) < .035, `sole/pedal gap ${bottom - box.max.y}`);
  }
  const vertices = points(body);
  assert.ok(vertices.every(p => Number.isFinite(p.x + p.y + p.z)));
  for (const name of ['apu-seat-pan', 'apu-seat-back', 'apu-control-panel']) {
    const box = new THREE.Box3().setFromObject(h.root.getObjectByName(name)!).expandByScalar(-.008);
    const intersections: string[] = [];
    body.traverseVisible(mesh => {
      if (!(mesh instanceof THREE.Mesh)) return;
      const hits = points(mesh).filter(p => box.containsPoint(p));
      if (hits.length) intersections.push(`${mesh.name}: ${hits.length}, ${new THREE.Box3().setFromPoints(hits).min.toArray()} / ${new THREE.Box3().setFromPoints(hits).max.toArray()}`);
    });
    assert.equal(vertices.filter(p => box.containsPoint(p)).length, 0, `body enters ${name}: ${intersections.join('; ')}`);
  }
  const before = vertices.map(p => p.toArray()); h.seated();
  assert.deepEqual(points(body).map(p => p.toArray()), before, 'paused anatomy must retain saved contact');
});

test('Mifune closes his actual eyelids and remains above the dock when detailed anatomy arrives after death', async t => {
  const h = await fixture(t, true), state: DockLastStand = { ...newDockLastStand(), phase: 'done' };
  h.fallen(state); await h.release(); h.fallen(state);
  const rig = h.rigs.mifune;
  const face = rig.head.getObjectByName('mifune-anatomical-head') as THREE.Mesh;
  assert.equal(face.morphTargetInfluences![0], 1); assert.equal(rig.head.getObjectByName('mifune-eyes')!.visible, false);
  const bottom = Math.min(...points(rig.detail).map(p => p.y));
  assert.ok(bottom >= -.001 && bottom < .03, `late body sinks or floats: ${bottom}`);
  const before = points(rig.detail).map(p => p.toArray()); h.fallen(structuredClone(state));
  assert.deepEqual(points(rig.detail).map(p => p.toArray()), before);
});

test('Kid retains finite anatomy and actual hand contact while climbing, bracing and kicking the ammunition box', async t => {
  const h = await fixture(t), rig = h.rigs.kid;
  for (const phase of ['climbing', 'jammed', 'kicking', 'descending'] as const) for (const sample of [0, .25, .5, .75, 1]) {
    const state = { ...newDockReload(), phase, lift: 1, climb: phase === 'climbing' || phase === 'descending' ? sample : 1, brace: .65, elapsed: sample * 1.15 };
    h.reload(state);
    const body = rig.root.getObjectByName('kid-detailed-body')!, vertices = points(body);
    assert.ok(vertices.every(p => Number.isFinite(p.x + p.y + p.z)), `${phase}/${sample}: invalid body`);
    assert.ok(Math.min(...vertices.map(p => p.y)) >= -.03, `${phase}/${sample}: body enters floor`);
    if (phase === 'kicking') {
      const box = dockReloadBox(state);
      const inside = (p: THREE.Vector3) => Math.abs(p.x - box.x) < .78 && Math.abs(p.y - box.y) < .65 && Math.abs(p.z - box.z) < .605;
      const overlaps: string[] = [];
      body.traverseVisible(mesh => { if (mesh instanceof THREE.Mesh) {
        const hits = points(mesh).filter(inside);
        if (hits.length) { const bounds = new THREE.Box3().setFromPoints(hits); overlaps.push(`${mesh.name}: ${hits.length}, ${bounds.min.toArray()} / ${bounds.max.toArray()}`); }
      } });
      assert.equal(vertices.filter(inside).length, 0, `kick ${state.elapsed}: delivered anatomy enters ammunition case: ${overlaps.join('; ')}`);
    }
    const skin = rig.root.getObjectByName('kid-anatomical-body') as THREE.SkinnedMesh;
    for (let i = 0; i < 2; i++) {
      const target = rig.elbows[i].localToWorld(new THREE.Vector3(0, -.79, .055));
      assert.ok(points(skin).some(p => p.distanceTo(target) < .075), `${phase}/${sample}: skin leaves its hand contact`);
    }
  }
});

test('APU first person retains operating arms, hides the eye-camera head, and restores both views after leaving', async t => {
  const h = await fixture(t), renderer = new AgentRenderer(new THREE.Scene()); t.after(() => renderer.dispose());
  const actor = h.world.agents.get('kid')!; actor.isInMatrix = false;
  for (const action of [
    { dockReload: { ...newDockReload(), role: 'kid' as const, phase: 'climbing' as const, climb: .5 } },
    { dockLastStand: { ...newDockLastStand(), role: 'kid' as const, phase: 'orders' as const } },
    { apuDriving: true, seated: true, riding: true },
    { dockGate: { ...newDockGate(5, -50), toppled: true, phase: 'braced' as const, brace: .5 }, seated: true, riding: true },
  ]) {
    actor.currentAction = { type: 'idle', parameters: action, startedAt: 0, duration: 1e9, progress: 0 };
    renderer.updateAgent(actor.id, actor); renderer.setWorld(false); renderer.setPlayer('kid', true);
    renderer.setPlayerMotion({ ...h.input, ...action, firstPerson: true }); renderer.update(0);
    await new Promise(resolve => setImmediate(resolve)); renderer.update(0);
    const body = renderer.getAgentBody('kid')!, head = body.getObjectByName('kid-head')!;
    assert.ok(body.visible, `${Object.keys(action)[0]} hides the operating arms`);
    assert.equal(head.visible, false, 'the eye camera must not enter its own face');
    renderer.setPlayer('kid', false); renderer.update(0);
    assert.ok(body.visible && head.visible, 'V restores the complete third-person character');
    renderer.setPlayer('kid', true); renderer.update(0);
    actor.currentAction.parameters = {}; renderer.setPlayerMotion({ ...h.input, firstPerson: true }); renderer.update(0);
    assert.equal(body.visible, false, 'ordinary first person retains its existing visibility policy');
    assert.ok(head.visible, 'the temporary head mask must be released');
  }
});

test('Kid braces with his delivered body while retaining seat, hand, pedal and eye contacts through the gate fall', async t => {
  const h = await fixture(t), kid = h.rigs.kid;
  const gate = { ...newDockGate(5, -50), toppled: true, brace: 0 };
  const draw = () => {
    const p = dockGatePoint(gate, APU_RIG.pilot);
    kid.root.position.set(p.x, p.y, p.z); kid.root.rotation.y = Math.PI;
    h.models.animate(kid, 0, { ...h.input, seated: true, riding: true, dockGate: gate }, 1);
    h.renderer.update({ scene: 'm3_gate', actor: 'kid', step: 2, completed: [], dockGate: gate } as FilmJourney, 0);
    kid.root.updateWorldMatrix(true, true); h.root.updateWorldMatrix(true, true);
  };
  for (const [phase, elapsed, brace] of [['falling', 0, 0], ['falling', 1.3, 0], ['falling', 2.7, 0], ['rescue', .8, 0],
    ['braced', 0, 0], ['braced', .5, .5], ['aiming', 0, 1]] as const) {
    Object.assign(gate, { phase, elapsed, brace }); draw();
    const body = kid.root.getObjectByName('kid-detailed-body')!, vertices = points(body);
    assert.ok(vertices.every(p => Number.isFinite(p.x + p.y + p.z) && p.y >= -.025), `${phase}: floor penetration`);
    for (const name of ['apu-seat-pan', 'apu-seat-back', 'apu-control-panel']) {
      const seat = h.root.getObjectByName(name) as THREE.Mesh; seat.geometry.computeBoundingBox();
      const box = seat.geometry.boundingBox!.clone().expandByScalar(-.008);
      assert.equal(vertices.filter(p => box.containsPoint(seat.worldToLocal(p.clone()))).length, 0, `${phase}/${brace}: anatomy enters ${name}`);
    }
    for (let i = 0; i < 2; i++) {
      const palm = kid.elbows[i].localToWorld(new THREE.Vector3(0, -.79, .055));
      const grip = h.root.getObjectByName(`apu-control-${i ? -1 : 1}`)!.getWorldPosition(new THREE.Vector3());
      assert.ok(palm.distanceTo(grip) < .04, 'bracing must keep both palms on the physical controls');
      const pedal = h.root.getObjectByName(`apu-pedal-${i ? -1 : 1}`)!;
      const sole = kid.ankles[i].localToWorld(new THREE.Vector3(0, -.155, .13));
      assert.ok(sole.distanceTo(pedal.localToWorld(new THREE.Vector3(0, .06, 0))) < .025);
    }
    assert.ok(kid.head.localToWorld(new THREE.Vector3(0, -.005, .275)).distanceTo(new THREE.Vector3().copy(dockGateEye(gate))) < 1e-5,
      'the authoritative aiming origin must follow the braced eye');
    const before = vertices.map(p => p.toArray()); draw(); assert.deepEqual(points(body).map(p => p.toArray()), before);
  }
  Object.assign(gate, { phase: 'braced', elapsed: 0, brace: 0 }); draw();
  const relaxed = kid.head.getWorldPosition(new THREE.Vector3());
  gate.brace = 1; draw();
  assert.ok(kid.head.getWorldPosition(new THREE.Vector3()).distanceTo(relaxed) > .12, 'holding G must animate the pilot’s effort, not just the cannon');
  gate.brace = 0; draw(); assert.ok(kid.head.getWorldPosition(new THREE.Vector3()).distanceTo(relaxed) < 1e-6, 'letting go releases the same saved effort');
});

test('delivered dock anatomy stays above the floor through Mifune’s fall and Kid’s kneel and rise', async t => {
  const h = await fixture(t);
  for (const [phase, elapsed] of [['attack', 0], ['attack', 2.7], ['attack', 3.4], ['attack', 4.5], ['wounded', 0], ['orders', 2.5], ['dying', 1.5], ['done', 0]] as const) {
    const state = { ...newDockLastStand(), phase, elapsed, total: elapsed + 5 }; h.fallen(state);
    const vertices = points(h.rigs.mifune.detail), bottom = Math.min(...vertices.map(p => p.y));
    assert.ok(bottom >= -.025, `${phase}/${elapsed}: Mifune below floor ${bottom}`);
    if (dockLastStandPose(state).fallen === 1) {
      assert.ok(bottom < .035, `${phase}: Mifune floats ${bottom}`);
      assert.equal(vertices.filter(p => Math.abs(p.x) < 2.6 && p.z > 9.9 && p.z < 14.9 && p.y > .05).length, 0, 'fallen body enters APU armour');
    }
  }
  const kid = h.rigs.kid; kid.root.position.set(-1.55, 0, 6.3); kid.root.rotation.y = Math.PI / 2;
  for (const [phase, elapsed] of [['kneeling', .3], ['kneeling', .8], ['orders', 2], ['response', 0], ['rise', .4], ['rise', 1.2]] as const) {
    h.models.animate(kid, 0, { ...h.input, dockLastStand: { ...newDockLastStand(), role: 'kid', phase, elapsed, total: 8 } }, 1);
    kid.root.updateWorldMatrix(true, true);
    const bottom = Math.min(...points(kid.detail).map(p => p.y));
    assert.ok(bottom >= -.035 && bottom < .035, `${phase}/${elapsed}: Kid floor contact ${bottom}`);
  }
});

test('the reload eye camera follows the posed head and does not clip nearby hands at cold load', async t => {
  const h = await fixture(t), kid = h.rigs.kid, actor = h.world.agents.get('kid')!;
  const previousWindow = globalThis.window; globalThis.window = new EventTarget() as unknown as Window & typeof globalThis;
  Object.assign(document, { addEventListener() {}, removeEventListener() {} });
  const canvas = new EventTarget() as unknown as HTMLCanvasElement, camera = new THREE.PerspectiveCamera(68, 16 / 9, .5, 5000);
  const controls = new PlayerControls(canvas, camera, () => {}, () => {}), carrier = new THREE.Group(); carrier.add(kid.root);
  try {
    const reload = { ...newDockReload(), phase: 'climbing' as const, climb: .55625, lift: 1, role: 'kid' as const };
    actor.isInMatrix = false; actor.rotation = Math.PI;
    actor.position = { x: DOCK_RELOAD.entry.x, y: dockReloadHeight(reload.climb) + 1, z: DOCK_RELOAD.entry.z };
    actor.currentAction = { type: 'idle', parameters: { dockReload: reload }, startedAt: 0, duration: 1e9, progress: 0 };
    carrier.position.copy(actor.position); kid.root.position.set(0, -1, 0); kid.root.rotation.y = Math.PI;
    h.models.animate(kid, 0, { ...h.input, dockReload: reload }, 1); carrier.updateWorldMatrix(true, true);
    controls.possess(actor); controls.firstPerson = true; controls.update(0, actor, carrier, false); camera.updateMatrixWorld(true);
    const eye = kid.head.localToWorld(new THREE.Vector3(0, -.005, .275));
    assert.ok(camera.position.distanceTo(eye) < .001, `camera leaves actual head by ${camera.position.distanceTo(eye)}`);
    assert.ok(camera.near <= .08, 'nearby operating fingers must survive the clipping plane');
    for (const elbow of kid.elbows) {
      const palm = elbow.localToWorld(new THREE.Vector3(0, -.79, .055)).project(camera);
      assert.ok(Math.abs(palm.x) < 1 && Math.abs(palm.y) < 1 && palm.z < 1, `default view loses hand: ${palm.toArray()}`);
    }
    const heading = camera.getWorldDirection(new THREE.Vector3());
    (controls as unknown as { yaw: number }).yaw += .3; controls.update(0, actor, carrier, false);
    const turned = camera.getWorldDirection(new THREE.Vector3());
    assert.ok(Math.abs(Math.atan2(Math.sin(Math.atan2(turned.x, turned.z) - Math.atan2(heading.x, heading.z)), Math.cos(Math.atan2(turned.x, turned.z) - Math.atan2(heading.x, heading.z)))) > .25, 'player still controls view direction');
  } finally { controls.dispose(); globalThis.window = previousWindow; }
});
