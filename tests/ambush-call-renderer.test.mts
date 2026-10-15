import assert from 'node:assert/strict';
import test, { type TestContext } from 'node:test';
import { readFile } from 'node:fs/promises';
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { clone } from 'three/addons/utils/SkeletonUtils.js';
import { FILM_SETS, AMBUSH_WINDOW_PROGRESS, ambushRetreatShift, ambushRouteRoot, ambushRetreatRoot, ambushRetreatGoal, newAmbushEscape, type AmbushEscort, type AgentState, type FilmJourney, type SandboxState } from '@auto_matrix/shared';
import { AgentRenderer } from '../packages/client/src/agents/AgentRenderer.js';
import type { CharacterRig } from '../packages/client/src/agents/CharacterModel.js';
import { WorldState } from '../packages/server/src/world/WorldState.js';
import { AgentManager } from '../packages/server/src/agents/AgentManager.js';
import { FilmStorySystem } from '../packages/server/src/story/FilmStorySystem.js';

// Keep the delivered skinning/geometry. Only images are omitted for offline contact checks.
async function fixture(t: TestContext, role: 'morpheus' | 'trinity', delayed = false) {
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
  const actor = world.agents.get(role)!; actor.currentLocation = 'film_ambush_house'; actor.isInMatrix = true;
  const scene = new THREE.Scene(); let renderer = new AgentRenderer(scene);
  const render = (delta = 0, speed = 0) => { renderer.update(delta, undefined, speed); scene.updateMatrixWorld(true); };
  const snapshot = (progress: number, retreat = false, speed = 4.2, watching = false) => {
    const root = retreat ? ambushRetreatRoot(progress, role) : ambushRouteRoot(progress, role, true);
    const center = FILM_SETS.film_ambush_house.center;
    actor.position = { x: center.x + root.x, y: center.y + root.y, z: center.z + root.z };
    actor.rotation = watching ? -1.2 : root.yaw;
    actor.velocity = { x: Math.sin(root.yaw) * speed, y: 0, z: Math.cos(root.yaw) * speed };
    actor.currentAction = { type: 'idle', parameters: { resolved: true, armed: retreat,
      ambushEscort: { role, progress, watching, retreat: retreat ? true : undefined, stairCat: true } satisfies AmbushEscort }, startedAt: 0, duration: 1, progress: 0 };
    renderer.updateAgent(role, actor);
  };
  const rig = () => (renderer as unknown as { agents: Map<string, { rig: CharacterRig }> }).agents.get(role)!.rig;
  const settle = async () => { release(); await Promise.all(pending); await new Promise(resolve => setImmediate(resolve)); render(); assert.ok(rig().hero); };
  const restart = (ids = [role] as string[]) => {
    const saved = ids.map(id => JSON.parse(JSON.stringify(world.agents.get(id))) as AgentState);
    renderer.dispose(); renderer = new AgentRenderer(scene); saved.forEach(state => renderer.updateAgent(state.id, state)); render();
  };
  t.after(() => { renderer.dispose(); globalThis.document = document; });
  return { world, actor, scene, get renderer() { return renderer; }, render, snapshot, settle, rig, restart };
}
// The marker represents the new performance contract. Before the client
// handles it, the current connected-phone fallback reproduces both failures.
function callSnapshot(h: Awaited<ReturnType<typeof fixture>>, elapsed: number, ready = false) {
  const progress = AMBUSH_WINDOW_PROGRESS + ambushRetreatShift('morpheus') - 12.6;
  h.snapshot(progress, true, 0, true);
  h.actor.currentAction!.parameters.armed = ready;
  h.actor.currentAction!.parameters.ambushCall = { role: 'morpheus', elapsed, ready };
  if (!ready) h.actor.currentAction!.parameters.phone = { phase: 'connected', elapsed };
  h.renderer.updateAgent(h.actor.id, h.actor); h.render();
}

test('the delivered Morpheus phone hand does not fold back across its forearm', async t => {
  const h = await fixture(t, 'morpheus'); callSnapshot(h, 4); await h.settle();
  const rig = h.rig(); assert.ok(rig.phone?.root.visible, 'sample the held physical handset');
  const side = rig.phone.root.parent!.name === 'wrist_L' ? 'L' : 'R';
  const point = (name: string) => rig.hero!.bones.get(name)!.getWorldPosition(new THREE.Vector3());
  const elbow = point('elbow_' + side), wrist = point('wrist_' + side), knuckle = point('finger3-1_' + side);
  const angle = THREE.MathUtils.radToDeg(wrist.clone().sub(elbow).angleTo(knuckle.sub(wrist)));
  assert.ok(angle < 85, `actual forearm-to-middle-knuckle bend is ${angle} degrees`);
});

test('starting the new ambush call cannot teleport the actual wrist', async t => {
  const h = await fixture(t, 'morpheus'); callSnapshot(h, 1.6, true); await h.settle();
  const wrists = () => ['R', 'L'].map(side => h.rig().hero!.bones.get('wrist_' + side)!.getWorldPosition(new THREE.Vector3()));
  const before = wrists(); callSnapshot(h, .016);
  const after = wrists();
  for (let i = 0; i < 2; i++) assert.ok(before[i].distanceTo(after[i]) < .15,
    `call start moves actual wrist ${i} by ${before[i].distanceTo(after[i])} in one frame`);
});

function pairSnapshot(h: Awaited<ReturnType<typeof fixture>>, elapsed: number, ready = false) {
  callSnapshot(h, elapsed, ready); h.actor.rotation = Math.PI / 2; h.renderer.updateAgent('morpheus', h.actor);
  const trinity = h.world.agents.get('trinity')!, progress = AMBUSH_WINDOW_PROGRESS + ambushRetreatShift('trinity') - 16.8 + 1.65;
  const root = ambushRetreatRoot(progress, 'trinity'), center = FILM_SETS.film_ambush_house.center;
  Object.assign(trinity, { currentLocation: 'film_ambush_house', isInMatrix: true, rotation: -Math.PI / 2,
    position: { x: center.x + root.x, y: center.y + root.y, z: center.z + root.z }, velocity: { x: 0, y: 0, z: 0 },
    currentAction: { type: 'idle', parameters: { resolved: true, armed: false, ambushEscort: { role: 'trinity', progress, watching: true, retreat: true },
      ambushCall: { role: 'trinity', elapsed, ready } }, startedAt: 0, duration: 1, progress: 0 } });
  h.renderer.updateAgent('trinity', trinity); h.render();
}
function pairRigs(h: Awaited<ReturnType<typeof fixture>>) {
  return ['morpheus', 'trinity'].map(id => (h.renderer as unknown as { agents: Map<string, { rig: CharacterRig }> }).agents.get(id)!.rig);
}
function visiblePhone(h: Awaited<ReturnType<typeof fixture>>) {
  const visible = pairRigs(h).filter(rig => rig.phone?.root.visible && rig.detail.visible);
  assert.equal(visible.length, 1, 'one physical handset must survive both handovers');
  return visible[0].phone!.root;
}

test('the real Trinity right hand passes one continuous handset through both Morpheus hands', async t => {
  const h = await fixture(t, 'morpheus'); pairSnapshot(h, 1.6, true); await h.settle();
  const surfaces = (phone: THREE.Object3D) => { const vertices: THREE.Vector3[] = []; phone.traverse(o => { if (o instanceof THREE.Mesh) { const p = o.geometry.attributes.position; for (let i = 0; i < p.count; i += 23) vertices.push(new THREE.Vector3().fromBufferAttribute(p, i).applyMatrix4(o.matrixWorld)); } }); return vertices; };
  let previousSurface = surfaces(visiblePhone(h));
  let phone = visiblePhone(h), previous = phone.getWorldPosition(new THREE.Vector3()), rotation = phone.getWorldQuaternion(new THREE.Quaternion());
  for (let frame = 0; frame < 850; frame++) {
    const time = frame / 100; pairSnapshot(h, time); phone = visiblePhone(h);
    const position = phone.getWorldPosition(new THREE.Vector3()), orientation = phone.getWorldQuaternion(new THREE.Quaternion());
    assert.ok(position.distanceTo(previous) < .055, `phone jumps ${position.distanceTo(previous)} at ${time}; positions=${JSON.stringify([previous.toArray(), position.toArray()])}; arms=${JSON.stringify(pairRigs(h).map(rig => ['shoulder_R','elbow_R','wrist_R'].map(name => rig.hero!.bones.get(name)!.getWorldPosition(new THREE.Vector3()).toArray())))}`);
    assert.ok(orientation.angleTo(rotation) < .12, `phone rotates discontinuously at ${time}`);
    assert.equal(phone.parent!.name, time >= 1.55 ? 'wrist_L' : 'wrist_R');
    const surface = surfaces(phone), surfaceJump = Math.max(...surface.map((point, i) => point.distanceTo(previousSurface[i])));
    assert.ok(surfaceJump < .055, `physical phone surface jumps ${surfaceJump} at ${time}`);
    previous = position; rotation = orientation; previousSurface = surface;
  }
});

function handContact(rig: CharacterRig, side: 'R' | 'L', phone: THREE.Object3D) {
  const skin = rig.hero!.root.getObjectByName('Anatomical_head_and_hands') as THREE.SkinnedMesh;
  skin.skeleton.update();
  const { skinIndex: indices, skinWeight: weights } = skin.geometry.attributes;
  const pads = Array.from({ length: 5 }, () => new THREE.Vector3()), counts = [0, 0, 0, 0, 0];
  const point = new THREE.Vector3(); let penetration = -Infinity; let deepest: number[] = [];
  for (let i = 0; i < indices.count; i++) {
    if (![0, 1, 2, 3].some(j => weights.getComponent(i, j) > .25 && new RegExp(`^(finger\\d-\\d_${side}|wrist_${side})$`).test(skin.skeleton.bones[indices.getComponent(i, j)].name))) continue;
    skin.getVertexPosition(i, point).applyMatrix4(skin.matrixWorld); phone.worldToLocal(point);
    for (let j = 0; j < 4; j++) {
      const tip = new RegExp(`^finger([1-5])-3_${side}$`).exec(skin.skeleton.bones[indices.getComponent(i, j)].name);
      if (tip && weights.getComponent(i, j) > .95) { pads[+tip[1] - 1].add(point); counts[+tip[1] - 1]++; }
    }
    const curve = point.y * point.y * .23;
    const depth = Math.min(.061 - Math.abs(point.x), .18 - Math.abs(point.y), point.z - curve + .034, .026 + curve - point.z);
    if (depth > penetration) { penetration = depth; deepest = point.toArray(); }
  }
  pads.forEach((pad, i) => { assert.ok(counts[i] > 50); pad.divideScalar(counts[i]); });
  const gaps = pads.map(() => Infinity), triangle = new THREE.Triangle(), nearest = new THREE.Vector3(), inverse = phone.matrixWorld.clone().invert();
  phone.traverse(object => {
    if (!(object instanceof THREE.Mesh)) return;
    const { index, attributes: { position } } = object.geometry, matrix = inverse.clone().multiply(object.matrixWorld);
    for (let i = 0; i < (index?.count ?? position.count); i += 3) {
      [triangle.a, triangle.b, triangle.c].forEach((vertex, j) => vertex.fromBufferAttribute(position, index ? index.getX(i + j) : i + j).applyMatrix4(matrix));
      pads.forEach((pad, j) => { triangle.closestPointToPoint(pad, nearest); gaps[j] = Math.min(gaps[j], nearest.distanceTo(pad)); });
    }
  });
  return { penetration, gaps, deepest };
}

test('each delivered gripping hand reaches the physical handset without entering the solid casing', async t => {
  const h = await fixture(t, 'morpheus'); pairSnapshot(h, 0); await h.settle();
  const problems: string[] = [];
  for (const time of [0, .5, .85, 1.3, 1.8, 2.2, 7, 7.6, 8.2]) {
    pairSnapshot(h, time); const [morpheus, trinity] = pairRigs(h), phone = visiblePhone(h);
    const owner = time < 1.1 ? trinity : morpheus, side = time >= 1.55 ? 'L' : 'R';
    const contact = handContact(owner, side, phone);
    if (contact.penetration > .001 || contact.gaps.some(gap => gap >= .04)) problems.push(`${time}: ${JSON.stringify(contact)}`);
  }
  assert.deepEqual(problems, []);
});

test('Trinity keeps a clear grip throughout preparation and withdraws outside the moving handset', async t => {
  const h = await fixture(t, 'morpheus'); pairSnapshot(h, 0); await h.settle();
  const failures: { ready: boolean; time: number; depth: number }[] = [];
  for (const ready of [true, false]) {
    let previous: { name: string; rotation: THREE.Quaternion; position: THREE.Vector3 }[] | undefined;
    for (let frame = 0; frame <= (ready ? 160 : 70); frame++) {
      const time = ready ? frame / 100 : 1.1 + frame / 100;
      pairSnapshot(h, time, ready);
      const contact = handContact(pairRigs(h)[1], 'R', visiblePhone(h));
      if (contact.penetration > .001) failures.push({ ready, time, depth: contact.penetration });
      if (ready) {
        assert.ok(contact.gaps.every(gap => gap < .04), `the already held phone must stay in all five fingers during preparation at ${time}: ${contact.gaps}`);
        const pose = pairRigs(h).flatMap(rig => [...rig.hero!.bones].map(([name, bone]) => ({ name, rotation: bone.quaternion.clone(), position: bone.getWorldPosition(new THREE.Vector3()) })));
        if (previous) pose.forEach((bone, index) => {
          assert.ok(bone.rotation.angleTo(previous![index].rotation) < .06, `${bone.name} snaps during preparation at ${time}`);
          assert.ok(bone.position.distanceTo(previous![index].position) < .025, `${bone.name} jumps during preparation at ${time}`);
        });
        previous = pose;
      }
    }
  }
  assert.deepEqual(failures, [], 'preparation and releasing frames cannot put skin through the solid phone casing');
});

test('20 Hz authoritative approach and release keep the handset clear before and after a cold renderer rebuild', async t => {
  const h = await fixture(t, 'morpheus'), roles = ['morpheus', 'trinity', 'switch', 'apoc', 'cypher'] as const;
  const escape = newAmbushEscape(), center = FILM_SETS.film_ambush_house.center, neo = h.world.agents.get('neo')!;
  neo.controller = 'call-contact-test'; neo.currentLocation = 'film_ambush_house';
  neo.position = { x: center.x - 5.4, y: center.y - 37, z: center.z - 13.2 };
  escape.phase = 'call'; escape.mouseDead = true;
  for (const role of roles) {
    escape.progress[role] = ambushRetreatGoal(role, AMBUSH_WINDOW_PROGRESS, 'window');
    const root = ambushRetreatRoot(escape.progress[role], role), actor = h.world.agents.get(role)!;
    actor.position = { x: center.x + root.x, y: center.y + root.y, z: center.z + root.z };
    actor.rotation = Math.atan2(neo.position.x - actor.position.x, neo.position.z - actor.position.z);
  }
  escape.callStart = { trinityProgress: escape.progress.trinity, trinityYaw: h.world.agents.get('trinity')!.rotation, morpheusYaw: h.actor.rotation };
  const journey = { scene: 'm1_dejavu', actor: 'neo', step: 1, completed: [], ambushEscape: escape } as FilmJourney;
  const sandbox = { structures: [], threats: [], neoLife: { journey } } as unknown as SandboxState;
  const story = new FilmStorySystem(h.world, () => sandbox, () => {}, () => {});
  const send = () => { for (const id of ['morpheus', 'trinity']) h.renderer.updateAgent(id, h.world.agents.get(id)!); };
  story.ambushEscapeFrame(neo, 0, 0); send(); await h.settle();
  const failures: { clock: number; cold: boolean; depth: number }[] = [];
  const inspect = (cold = false) => {
    const contact = handContact(pairRigs(h)[1], 'R', visiblePhone(h));
    if (contact.penetration > .001) failures.push({ clock: escape.elapsed, cold, depth: contact.penetration });
  };
  for (let frame = 1; frame <= 68; frame++) {
    story.ambushEscapeFrame(neo, .05, frame); send();
    for (let raf = 0; raf < 3; raf++) h.render(1 / 60, 1);
    inspect();
    if (frame === 12 || frame === 55) {
      h.restart(['trinity', 'morpheus']); await h.settle(); inspect(true);
    }
  }
  assert.ok(Math.abs(escape.elapsed - 3.4) < 1e-8, 'the fixture must advance the real server call clock');
  assert.deepEqual(failures, [], 'the saved handoff must work for moving, paused and newly loaded actors');
});

function skeletonFrame(h: Awaited<ReturnType<typeof fixture>>) {
  return pairRigs(h).map(rig => ({
    root: rig.root.matrixWorld.elements.slice(),
    cloth: rig.hero!.panels.filter(panel => panel.mesh.visible).flatMap(panel => Array.from(panel.mesh.geometry.attributes.position.array)),
    bones: [...rig.hero!.bones].map(([name, bone]) => ({ name, matrix: bone.matrixWorld.elements.slice() })),
    phone: rig.phone?.root.visible ? { parent: rig.phone.root.parent!.name, matrix: rig.phone.root.matrixWorld.elements.slice() } : null,
  }));
}
function sameFrame(actual: ReturnType<typeof skeletonFrame>, expected: ReturnType<typeof skeletonFrame>) {
  const values = (frame: ReturnType<typeof skeletonFrame>) => frame.flatMap(actor => [
    ...actor.root, ...actor.cloth, ...actor.bones.flatMap(bone => bone.matrix), ...(actor.phone?.matrix ?? []),
  ]);
  assert.deepEqual(actual.map(actor => actor.phone?.parent), expected.map(actor => actor.phone?.parent));
  const a = values(actual), b = values(expected); assert.equal(a.length, b.length);
  const error = Math.max(...a.map((value, i) => Math.abs(value - b[i])));
  assert.ok(error < 1e-7, `saved physical pose depends on frame/actor history by ${error}`);
}

test('running, paused and reversed cold actor loading reconstruct the same physical call', async t => {
  const h = await fixture(t, 'morpheus', true); pairSnapshot(h, 0); await h.settle();
  for (const time of [.6, 1.09, 1.1, 1.54, 1.55, 2.2, 7, 7.7, 8.5]) {
    pairSnapshot(h, time); h.render(.016, 1); const running = skeletonFrame(h);
    for (let i = 0; i < 8; i++) h.render(.016, 0);
    sameFrame(skeletonFrame(h), running);
    h.restart(['trinity', 'morpheus']); await h.settle(); sameFrame(skeletonFrame(h), running);
  }
});

test('holding at seven seconds keeps the left phone while route-driven feet continue walking', async t => {
  const h = await fixture(t, 'morpheus'); pairSnapshot(h, 7); await h.settle();
  const frames: THREE.Vector3[][] = [];
  for (const travel of [0, .45, .9]) {
    const progress = AMBUSH_WINDOW_PROGRESS + ambushRetreatShift('morpheus') - 12.6 + travel;
    h.snapshot(progress, true, 2.4, false);
    h.actor.currentAction!.parameters.ambushCall = { role: 'morpheus', elapsed: 7 };
    h.renderer.updateAgent('morpheus', h.actor); h.render(.5, 1);
    const rig = h.rig(), phone = rig.phone!.root;
    assert.equal(phone.visible, true); assert.equal(phone.parent!.name, 'wrist_L');
    const contact = handContact(rig, 'L', phone); assert.ok(contact.penetration <= .001); assert.ok(contact.gaps.every(gap => gap < .04));
    frames.push(['ankle_L', 'ankle_R'].map(name => rig.root.worldToLocal(rig.hero!.bones.get(name)!.getWorldPosition(new THREE.Vector3()))));
  }
  assert.ok(frames[0].some((foot, i) => foot.distanceTo(frames[1][i]) > .1), 'a held call cannot freeze the walking gait');
});

function headSurface(rig: CharacterRig) {
  const skin = rig.hero!.root.getObjectByName('Anatomical_head_and_hands') as THREE.SkinnedMesh;
  const head = rig.hero!.bones.get('head')!, matrix = head.matrixWorld.clone().invert().multiply(skin.matrixWorld);
  const { skinIndex: indices, skinWeight: weights, position } = skin.geometry.attributes, original = skin.geometry.index!;
  const selected = new Map<number, number>(), vertices: number[] = [], faces: number[] = [], point = new THREE.Vector3();
  for (let i = 0; i < position.count; i++) {
    if (![0, 1, 2, 3].some(j => weights.getComponent(i, j) > .5 && /^(head|neck.*)$/.test(skin.skeleton.bones[indices.getComponent(i, j)].name))) continue;
    selected.set(i, vertices.length / 3); skin.getVertexPosition(i, point).applyMatrix4(matrix); vertices.push(...point.toArray());
  }
  for (let i = 0; i < original.count; i += 3) {
    const triangle = [original.getX(i), original.getX(i + 1), original.getX(i + 2)];
    if (triangle.every(index => selected.has(index))) faces.push(...triangle.map(index => selected.get(index)!));
  }
  const geometry = new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3)).setIndex(faces);
  geometry.computeBoundingBox(); const mesh = new THREE.Mesh(geometry, new THREE.MeshBasicMaterial({ side: THREE.DoubleSide })); mesh.updateMatrixWorld(true);
  return { head, mesh, bounds: geometry.boundingBox!, dispose: () => { geometry.dispose(); mesh.material.dispose(); } };
}

test('the actual earpiece reaches the left head surface without putting the handset inside it', async t => {
  const h = await fixture(t, 'morpheus'); pairSnapshot(h, 2.2); await h.settle();
  for (const time of [2.2, 4, 7, 7.3]) {
    pairSnapshot(h, time); const rig = h.rig(), phone = rig.phone!.root, surface = headSurface(rig);
    try {
      const earpiece = surface.head.worldToLocal(phone.localToWorld(new THREE.Vector3(0, .175, .04)));
      const hit = new THREE.Raycaster(earpiece, earpiece.clone().negate().normalize(), .0001, .2).intersectObject(surface.mesh)[0];
      if (time <= 7) assert.ok(hit && hit.distance < .09, `left earpiece does not reach actual skin at ${time}: ${hit?.distance}`);
      let deepest = 0;
      phone.traverse(object => {
        if (!(object instanceof THREE.Mesh)) return;
        const p = object.geometry.attributes.position;
        for (let i = 0; i < p.count; i += 3) {
          const point = surface.head.worldToLocal(new THREE.Vector3().fromBufferAttribute(p, i).applyMatrix4(object.matrixWorld));
          if (!surface.bounds.containsPoint(point)) continue;
          const direction = point.clone().normalize(), exit = new THREE.Raycaster(point, direction, .0001, .3).intersectObject(surface.mesh)[0];
          if (exit && exit.face!.normal.dot(direction) > .001) deepest = Math.max(deepest, exit.distance);
        }
      });
      assert.ok(deepest < .006, `handset enters the actual head at ${time} by ${deepest}`);
    } finally { surface.dispose(); }
  }
});

test('listening keeps the supporting elbow below the shoulder rather than raised sideways', async t => {
  const h = await fixture(t, 'morpheus'); pairSnapshot(h, 4); await h.settle();
  const rig = h.rig(), shoulder = rig.hero!.bones.get('shoulder_L')!.getWorldPosition(new THREE.Vector3());
  const elbow = rig.hero!.bones.get('elbow_L')!.getWorldPosition(new THREE.Vector3());
  assert.ok(elbow.y < shoulder.y - .15, `supporting elbow is ${elbow.y - shoulder.y} relative to shoulder; ${JSON.stringify(["head","shoulder_L","elbow_L","wrist_L"].map(n=>rig.root.worldToLocal(rig.hero!.bones.get(n)!.getWorldPosition(new THREE.Vector3())).toArray()))}`);
});

function wallSnapshot(h: Awaited<ReturnType<typeof fixture>>, elapsed: number, active = true) {
  const center = FILM_SETS.film_ambush_house.center;
  h.actor.velocity = { x: 0, y: 0, z: 0 };
  h.actor.currentAction = { type: 'idle', parameters: { resolved: true,
    wetwall: { role: 'morpheus', phase: elapsed === 0 ? 'sealed' : 'breaking', elapsed, progress: 0, entry: 10,
      hanging: false, freed: false, start: { x: h.actor.position.x - center.x, y: h.actor.position.y - center.y, z: h.actor.position.z - center.z } },
    ...(active ? { ambushCall: { role: 'morpheus', elapsed: 7 + elapsed } } : {}),
  }, startedAt: 0, duration: 1, progress: 0 };
  const trinity = h.world.agents.get('trinity')!; delete trinity.currentAction!.parameters.ambushCall;
  h.renderer.updateAgent('morpheus', h.actor); h.renderer.updateAgent('trinity', trinity); h.render(.5, 1);
}

test('the standalone wetwall call restores without old escort state and releases to ordinary hands', async t => {
  const h = await fixture(t, 'morpheus'); pairSnapshot(h, 7); await h.settle();
  h.snapshot(AMBUSH_WINDOW_PROGRESS + ambushRetreatShift('morpheus') - 12.2, true, 3, false); h.render(.2, 1);
  wallSnapshot(h, .3); const warm = skeletonFrame(h);
  h.restart(['trinity', 'morpheus']); await h.settle(); sameFrame(skeletonFrame(h), warm);
  wallSnapshot(h, 1.49);
  const before = [...h.rig().hero!.bones].map(([name, bone]) => [name, bone.getWorldPosition(new THREE.Vector3())] as const);
  wallSnapshot(h, 1.5, false);
  const jumps = before.map(([name, point]) => [name, point.distanceTo(h.rig().hero!.bones.get(name)!.getWorldPosition(new THREE.Vector3()))] as const).filter(([, distance]) => distance > .04);
  assert.deepEqual(jumps, [], 'putting the handset away cannot snap actual fingers/arms');
  assert.equal(h.rig().phone!.root.visible, false);
});

function handShell(rig: CharacterRig, side: 'R' | 'L', phone: THREE.Object3D) {
  const skin = rig.hero!.root.getObjectByName('Anatomical_head_and_hands') as THREE.SkinnedMesh;
  const { skinIndex: indices, skinWeight: weights, position } = skin.geometry.attributes, index = skin.geometry.index!;
  const matrix = phone.matrixWorld.clone().invert().multiply(skin.matrixWorld), selected = new Map<number, number>(), points: THREE.Vector3[] = [], faces: number[] = [];
  for (let i = 0; i < position.count; i++) {
    if (![0, 1, 2, 3].some(j => weights.getComponent(i, j) > .25 && new RegExp(`^(finger\\d-\\d_${side}|wrist_${side})$`).test(skin.skeleton.bones[indices.getComponent(i, j)].name))) continue;
    selected.set(i, points.length); points.push(skin.getVertexPosition(i, new THREE.Vector3()).applyMatrix4(matrix));
  }
  for (let i = 0; i < index.count; i += 3) {
    const triangle = [index.getX(i), index.getX(i + 1), index.getX(i + 2)];
    if (triangle.every(id => selected.has(id))) faces.push(...triangle.map(id => selected.get(id)!));
  }
  const geometry = new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute(points.flatMap(p => p.toArray()), 3)).setIndex(faces);
  geometry.computeBoundingBox(); const mesh = new THREE.Mesh(geometry, new THREE.MeshBasicMaterial({ side: THREE.DoubleSide })); mesh.updateMatrixWorld(true);
  const wrist = phone.worldToLocal(rig.hero!.bones.get('wrist_' + side)!.getWorldPosition(new THREE.Vector3()));
  return { points, wrist, bounds: geometry.boundingBox!, mesh, dispose: () => { geometry.dispose(); mesh.material.dispose(); } };
}

test('both real hands contact opposite sides of the handset at each transfer without deep skin overlap', async t => {
  const h = await fixture(t, 'morpheus'); pairSnapshot(h, 0); await h.settle();
  for (const time of [.85, .95, 1.05, 1.1, 1.15, 1.17, 1.2, 1.3, 1.45, 1.55, 1.65, 1.8]) {
    pairSnapshot(h, time); const [morpheus, trinity] = pairRigs(h), phone = visiblePhone(h);
    const hands = time < 1.3 ? [[trinity, 'R'], [morpheus, 'R']] as const : [[morpheus, 'R'], [morpheus, 'L']] as const;
    const shells = hands.map(([rig, side], i) => {
      const contact = handContact(rig, side, phone);
      assert.ok(contact.penetration <= .001 && (![1.1, 1.55].includes(time) || Math.min(...contact.gaps) < .04), `hand ${i} (${side}) misses the shared prop at ${time}: ${JSON.stringify(contact)}`);
      return handShell(rig, side, phone);
    });
    try {
      if ([1.1, 1.55].includes(time)) assert.ok(shells[0].wrist.z * shells[1].wrist.z < 0, 'the two palms cannot use the same side of the prop');
      for (const [from, other] of [[shells[0], shells[1]], [shells[1], shells[0]]]) {
        let deepest = 0, where: number[] = [];
        for (const point of from.points) {
          if (!other.bounds.containsPoint(point) || point.distanceTo(other.wrist) < .07) continue;
          const direction = point.clone().sub(other.wrist).normalize();
          const exit = new THREE.Raycaster(point, direction, .0001, .15).intersectObject(other.mesh)[0];
          if (exit && exit.face!.normal.dot(direction) > .001 && exit.distance > deepest) { deepest = exit.distance; where = point.toArray(); }
        }
        assert.ok(deepest < .01, `the two gripping hands overlap by ${deepest} at ${time}, point=${where}, wrists=${JSON.stringify(shells.map(h=>h.wrist.toArray()))}`);
      }
    } finally { shells.forEach(shell => shell.dispose()); }
  }
});

test('leaving the new call restores the existing right-hand phone path', async t => {
  const h = await fixture(t, 'morpheus'); pairSnapshot(h, 7); await h.settle();
  h.actor.currentAction!.parameters.phone = { phase: 'connected', elapsed: 2 };
  delete h.actor.currentAction!.parameters.ambushCall;
  const trinity = h.world.agents.get('trinity')!; delete trinity.currentAction!.parameters.ambushCall;
  h.renderer.updateAgent('morpheus', h.actor); h.renderer.updateAgent('trinity', trinity); h.render();
  const restored = skeletonFrame(h); assert.equal(h.rig().phone!.root.parent!.name, 'wrist_R');
  h.restart(['morpheus', 'trinity']); await h.settle(); sameFrame(skeletonFrame(h), restored);
});
