import assert from 'node:assert/strict';
import test, { type TestContext } from 'node:test';
import { readFile } from 'node:fs/promises';
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { CATCH, catchRoot, filmPosition, newCatch, type CatchEncounter, type FilmJourney } from '@auto_matrix/shared';
import { AgentRenderer } from '../packages/client/src/agents/AgentRenderer.js';
import { ReloadedCatchRenderer } from '../packages/client/src/engine/ReloadedCatchRenderer.js';
import { WorldState } from '../packages/server/src/world/WorldState.js';
import { AgentManager } from '../packages/server/src/agents/AgentManager.js';
async function shipped(name: string) {
  const bytes = await readFile(new URL(`../packages/client/public/assets/characters/${name}.glb`, import.meta.url));
  const length = bytes.readUInt32LE(12), document = JSON.parse(bytes.subarray(20, 20 + length).toString());
  // Keep actual shipped geometry and skinning; Node has no browser image decoder.
  for (const material of document.materials) { delete material.pbrMetallicRoughness.baseColorTexture; delete material.normalTexture; }
  document.images = []; document.textures = [];
  const json = Buffer.from(JSON.stringify(document)), padded = Buffer.alloc(Math.ceil(json.length / 4) * 4, 32); json.copy(padded);
  const binary = bytes.subarray(20 + length), output = Buffer.alloc(20 + padded.length + binary.length);
  output.writeUInt32LE(0x46546c67, 0); output.writeUInt32LE(2, 4); output.writeUInt32LE(output.length, 8);
  output.writeUInt32LE(padded.length, 12); output.writeUInt32LE(0x4e4f534a, 16); padded.copy(output, 20); binary.copy(output, 20 + padded.length);
  const asset = await new GLTFLoader().parseAsync(output.buffer.slice(output.byteOffset, output.byteOffset + output.byteLength), '');
  if (name.endsWith('-head')) asset.scene.traverse(object => { if (object instanceof THREE.Mesh) (object.material as THREE.MeshStandardMaterial).map = new THREE.Texture(); });
  return asset;
}

async function fixture(t: TestContext) {
  const assets = Object.fromEntries(await Promise.all(['neo', 'neo-office', 'neo-tracking', 'trinity', 'trinity-club', 'smith', 'morpheus', 'choi', 'dujour'].map(async name => [name, await shipped(name)])));
  t.mock.method(GLTFLoader.prototype, 'loadAsync', async url => assets[String(url).split('/').pop()!.replace('.glb', '')]);
  t.mock.method(THREE.TextureLoader.prototype, 'load', () => new THREE.Texture());
  const previous = globalThis.document;
  globalThis.document = { createElement: () => ({ getContext: () => ({ createImageData: (w: number, h: number) => ({ data: new Uint8ClampedArray(w * h * 4) }), putImageData() {},
    createRadialGradient: () => ({ addColorStop() {} }), fillRect() {}, strokeRect() {}, fillText() {} }) }) } as unknown as Document;
  const world = new WorldState(); new AgentManager(world).initializeAllAgents(); const renderer = new AgentRenderer(new THREE.Scene());
  t.after(() => { renderer.dispose(); globalThis.document = previous; });
  const apply = (state: CatchEncounter) => {
    for (const role of ['neo', 'trinity', 'agent_thompson'] as const) {
      const actor = world.agents.get(role)!, root = catchRoot(state, role);
      actor.currentLocation = 'film_trinity_roof'; actor.position = filmPosition(actor.currentLocation, root.x, root.z); actor.position.y += root.y;
      actor.isInMatrix = true; actor.isAwakened = true; actor.rotation = root.yaw;
      actor.currentAction = { type: 'idle', parameters: { resolved: true, catch: { ...state, role } }, startedAt: 0, duration: 1e9, progress: 0 }; renderer.updateAgent(role, actor);
    }
    renderer.update(0, undefined, 0);
  };
  apply(newCatch()); await new Promise(resolve => setImmediate(resolve)); apply(newCatch());
  return { renderer, world, apply };
}
function visible(object: THREE.Object3D) { for (let part: THREE.Object3D | null = object; part; part = part.parent) if (!part.visible) return false; return true; }
function skinBounds(body: THREE.Object3D) {
  const box = new THREE.Box3(); body.updateWorldMatrix(true, true);
  body.traverse(object => {
    if (!(object instanceof THREE.SkinnedMesh) || !visible(object)) return;
    object.skeleton.update();
    for (let i = 0; i < object.geometry.attributes.position.count; i++) box.expandByPoint(object.localToWorld(object.getVertexPosition(i, new THREE.Vector3())));
  }); return box;
}

test('actual rooftop bodies rest above the metal deck and Neo’s hands reach Trinity’s chest', async t => {
  const h = await fixture(t), state = { ...newCatch(), phase: 'extracting' as const, focus: 1.2 };
  h.apply(state); const trinity = h.renderer.getAgentBody('trinity')!, neo = h.renderer.getAgentBody('neo')!;
  const bounds = skinBounds(trinity), floor = filmPosition('film_trinity_roof', 0, 0).y - 1;
  console.log('Trinity actual roof bounds:', bounds.min.toArray(), bounds.max.toArray(), 'floor', floor);
  assert.ok(bounds.min.y >= floor - .015 && bounds.min.y <= floor + .14, `Trinity floats or enters the roof: ${bounds.min.y - floor}`);
  const neoBounds = skinBounds(neo); console.log('Neo actual roof bounds', neoBounds.min.toArray(), neoBounds.max.toArray());
  if (process.env.CATCH_MODEL_DIAGNOSTIC) neo.traverse(object => {
    if (!(object instanceof THREE.Mesh) || !visible(object)) return;
    let minimum = Infinity;
    for (let i = 0; i < object.geometry.attributes.position.count; i++) minimum = Math.min(minimum, object.localToWorld(object.getVertexPosition(i, new THREE.Vector3())).y);
    console.log('Neo mesh floor', object.name, object.type, minimum);
  });
  assert.ok(neoBounds.min.y >= floor - .015 && neoBounds.min.y <= floor + .14, 'Neo knees/coat enter or float above the deck');
  const chest = trinity.getObjectByName('chest')!;
  for (const side of ['R', 'L'] as const) {
    const palm = neo.getObjectByName(`wrist_${side}`)!.localToWorld(new THREE.Vector3(0, -.19, .035));
    const target = chest.localToWorld(new THREE.Vector3(side === 'R' ? -.02 : .23, .18, .3));
    if (side === 'R') target.y += CATCH.extractionLift * state.focus / CATCH.extraction;
    console.log('Medical actual palm gap:', side, palm.distanceTo(target));
    if (process.env.CATCH_MODEL_DIAGNOSTIC) for (const name of ['pelvis', 'spine', 'chest', 'head', `shoulder_${side}`, `elbow_${side}`, `wrist_${side}`, 'hip_R', 'knee_R', 'ankle_R']) {
      const bone = neo.getObjectByName(name)!;
      console.log('Neo bone', name, bone.getWorldPosition(new THREE.Vector3()).toArray(), 'local', bone.position.toArray(), 'target', target.toArray());
    }
    assert.ok(palm.distanceTo(target) < .1, `medical ${side} hand misses the chest by ${palm.distanceTo(target)}`);
  }
});

test('cold paused fall and catch poses match without replaying interpolation frames', async t => {
  const h = await fixture(t), fall = { ...newCatch(), phase: 'flight' as const, elapsed: 6.1, x: -8.5, z: -24 };
  const caught = { neo: catchRoot(fall, 'neo'), trinity: catchRoot(fall, 'trinity'), age: 6.1 };
  for (const phase of ['flight', 'catching', 'ascent', 'landing', 'pulse'] as const) {
    const state = { ...fall, phase, elapsed: phase === 'flight' ? 6.1 : .4, caught };
    h.apply(state); const first = ['neo', 'trinity'].map(role => h.renderer.getAgentBody(role)!.getObjectByName('head')!.getWorldPosition(new THREE.Vector3()));
    for (let frame = 0; frame < 15; frame++) h.renderer.update(.04, undefined, 1);
    h.apply(state);
    for (const [index, role] of ['neo', 'trinity'].entries()) {
      const head = h.renderer.getAgentBody(role)!.getObjectByName('head')!.getWorldPosition(new THREE.Vector3());
      assert.ok(head.distanceTo(first[index]) < .015, `${phase} ${role} depends on unsaved render frames: ${head.distanceTo(first[index])}`);
    }
  }
});

test('the carried ascent grips Trinity’s actual jacket with both hands', async t => {
  const h = await fixture(t), fall = { ...newCatch(), phase: 'flight' as const, elapsed: 5.6, x: -8.5, z: -24 };
  h.apply({ ...fall, phase: 'ascent', elapsed: 1.3, caught: { neo: catchRoot(fall, 'neo'), trinity: catchRoot(fall, 'trinity'), age: 5.6 } });
  const neo = h.renderer.getAgentBody('neo')!, trinity = h.renderer.getAgentBody('trinity')!, chest = trinity.getObjectByName('chest')!;
  for (const side of ['R', 'L'] as const) {
    const palm = neo.getObjectByName(`wrist_${side}`)!.localToWorld(new THREE.Vector3(0, -.19, .035));
    const target = chest.localToWorld(new THREE.Vector3(side === 'R' ? .34 : -.34, .3, .3));
    console.log('Carried jacket palm gap', side, palm.distanceTo(target));
    assert.ok(palm.distanceTo(target) < .14, `${side} floats away from the carried body`);
  }
});

test('the rooftop bullet and pulse originate at the actual patient chest', async t => {
  const h = await fixture(t), state = { ...newCatch(), phase: 'pulse' as const, elapsed: 1.1, focus: CATCH.extraction };
  h.apply(state); const patient = h.renderer.getAgentBody('trinity')!, root = new THREE.Group();
  const center = filmPosition('film_trinity_roof', 0, 0); root.position.set(center.x, center.y - 1, center.z);
  const renderer = new ReloadedCatchRenderer(root); t.after(() => renderer.dispose());
  renderer.update({ scene: 'm2_catch', catch: state } as FilmJourney, patient);
  const chest = patient.getObjectByName('chest')!, target = chest.localToWorld(new THREE.Vector3(-.02, .18, .3));
  const pulse = root.getObjectByName('catch-heart-pulse')!.parent!.getWorldPosition(new THREE.Vector3());
  assert.ok(pulse.distanceTo(target.clone().add(new THREE.Vector3(0, .08, 0))) < .025, 'the pulse floats at a hard-coded head/neck point instead of the wound');
  renderer.update({ scene: 'm2_catch', catch: { ...state, phase: 'extracting' } } as FilmJourney, patient);
  const bullet = root.getObjectByName('catch-extracted-bullet')!.parent!.getWorldPosition(new THREE.Vector3());
  assert.ok(bullet.distanceTo(target.clone().add(new THREE.Vector3(0, CATCH.extractionLift, 0))) < .025, 'the extracted bullet leaves an unrelated body point');
});

test('legacy freeway characters do not appear as bystanders in the staged rescue', async t => {
  const h = await fixture(t), state = { ...newCatch(), phase: 'extract_ready' as const };
  h.apply(state); const johnson = h.world.agents.get('agent_johnson')!;
  johnson.currentLocation = 'film_trinity_roof'; johnson.isInMatrix = true; johnson.position = filmPosition(johnson.currentLocation, 2, -17);
  h.renderer.updateAgent(johnson.id, johnson);
  h.renderer.update(0, undefined, 0, 0, { scene: 'm2_catch', actor: 'neo', catch: state } as FilmJourney);
  assert.equal(h.renderer.getAgent(johnson.id)!.visible, false, 'a legacy miscast character still stands over the patient');
  johnson.controller = 'another-player'; h.renderer.updateAgent(johnson.id, johnson);
  h.renderer.update(0, undefined, 0, 0, { scene: 'm2_catch', actor: 'neo', catch: state } as FilmJourney);
  assert.equal(h.renderer.getAgent(johnson.id)!.visible, true, 'an actual player cannot be hidden by the film shot');
});

test('Trinity’s trouser cuffs stay connected to her boots in the saved lying pose', async t => {
  const h = await fixture(t); h.apply({ ...newCatch(), phase: 'extract_ready' });
  const body = h.renderer.getAgentBody('trinity')!, pants = body.getObjectByName('Tailored_trousers') as THREE.SkinnedMesh, boots = body.getObjectByName('shoes01') as THREE.SkinnedMesh;
  assert.ok(pants && boots); body.updateMatrixWorld(true);
  for (const side of ['R', 'L'] as const) {
    const ankle = body.getObjectByName(`ankle_${side}`)!.getWorldPosition(new THREE.Vector3()), cuffs: THREE.Vector3[] = [], footwear: THREE.Vector3[] = [];
    for (const [mesh, points] of [[pants, cuffs], [boots, footwear]] as const) for (let i = 0; i < mesh.geometry.attributes.position.count; i++) {
      const { skinIndex, skinWeight } = mesh.geometry.attributes; let sideWeight = 0;
      for (let joint = 0; joint < 4; joint++) if (mesh.skeleton.bones[skinIndex.getComponent(i, joint)].name.endsWith(`_${side}`)) sideWeight += skinWeight.getComponent(i, joint);
      if (sideWeight < .5) continue;
      const point = mesh.localToWorld(mesh.getVertexPosition(i, new THREE.Vector3())); if (point.distanceTo(ankle) < .75) points.push(point);
    }
    let gap = Infinity, nearest: THREE.Vector3[] = []; for (const cuff of cuffs) for (const shoe of footwear) {
      const distance = cuff.distanceTo(shoe); if (distance < gap) { gap = distance; nearest = [cuff, shoe]; }
    }
    if (process.env.CATCH_MODEL_DIAGNOSTIC) console.log('Patient cuff/boot bounds', side, ankle.toArray(), new THREE.Box3().setFromPoints(cuffs), new THREE.Box3().setFromPoints(footwear), nearest.map(point => point.toArray()));
    console.log('Patient boot/cuff gap', side, gap, cuffs.length, footwear.length); assert.ok(gap < .07, `${side} boot is detached from the leg by ${gap}`);
  }
});

test('the complete patient trouser hems meet the boot surfaces around both ankles', async t => {
  const h = await fixture(t); h.apply({ ...newCatch(), phase: 'reviving', elapsed: .477 });
  const body = h.renderer.getAgentBody('trinity')!, pants = body.getObjectByName('Tailored_trousers') as THREE.SkinnedMesh, boots = body.getObjectByName('shoes01') as THREE.SkinnedMesh;
  body.updateMatrixWorld(true);
  const position = pants.geometry.attributes.position, bottom = Math.min(...Array.from({ length: position.count }, (_, i) => position.getY(i)));
  const index = boots.geometry.index!, triangles: THREE.Triangle[] = [];
  for (let i = 0; i < index.count; i += 3) triangles.push(new THREE.Triangle(...[0, 1, 2].map(j => boots.localToWorld(boots.getVertexPosition(index.getX(i + j), new THREE.Vector3()))) as [THREE.Vector3, THREE.Vector3, THREE.Vector3]));
  const gaps: number[] = [];
  for (let i = 0; i < position.count; i++) if (position.getY(i) < bottom + .04) {
    const cuff = pants.localToWorld(pants.getVertexPosition(i, new THREE.Vector3())), near = new THREE.Vector3();
    gaps.push(Math.min(...triangles.map(triangle => triangle.closestPointToPoint(cuff, near).distanceTo(cuff))));
  }
  gaps.sort((a, b) => a - b);
  console.log('Complete cuff surface gaps', bottom, gaps.length, gaps[0], gaps[Math.floor(gaps.length * .9)], gaps.at(-1));
  assert.ok(gaps.length > 20, 'the cuff check must include a ring, not a single nearest vertex');
  assert.ok(gaps.at(-1)! < .07, `part of Trinity’s trouser hem is ${gaps.at(-1)} metres from her boots`);
});

test('Neo’s first-person medical sleeves leave Trinity’s face visible from his posed eye', async t => {
  const h = await fixture(t), state = { ...newCatch(), phase: 'extract_ready' as const };
  h.apply(state); h.renderer.setPlayer('neo', true);
  h.renderer.setPlayerMotion({ speed: 0, grounded: true, verticalVelocity: 0, turn: 0, catch: { ...state, role: 'neo' }, firstPerson: true });
  h.renderer.update(0, undefined, 0);
  const neo = h.renderer.getAgentBody('neo')!, patient = h.renderer.getAgentBody('trinity')!, head = neo.getObjectByName('head')!;
  neo.updateWorldMatrix(true, true); patient.updateWorldMatrix(true, true);
  const eye = head.localToWorld(head.userData.cameraEye.clone()), face = patient.getObjectByName('head')!.localToWorld(new THREE.Vector3(0, .05, .23));
  const direction = face.clone().sub(eye), ray = new THREE.Raycaster(eye, direction.clone().normalize(), 0, direction.length() - .06), garments: THREE.Mesh[] = [];
  neo.traverse(object => {
    if (!(object instanceof THREE.SkinnedMesh) || !visible(object) || !/Tailored.coat.upper|Black.crew.neck/.test(object.name)) return;
    object.computeBoundingBox(); object.computeBoundingSphere(); garments.push(object);
  });
  const hits = ray.intersectObjects(garments); console.log('First-person face occluders', hits.map(hit => [hit.object.name, hit.distance]));
  assert.equal(hits.length, 0, 'a deformed sleeve covers the patient’s face');
});

test('the medical coat stays out of the upper first-person frame while the hands work on the wound', async t => {
  const h = await fixture(t), state = { ...newCatch(), phase: 'reviving' as const, elapsed: .477 };
  h.apply(state); h.renderer.setPlayer('neo', true);
  h.renderer.setPlayerMotion({ speed: 0, grounded: true, verticalVelocity: 0, turn: 0, catch: { ...state, role: 'neo' }, firstPerson: true });
  h.renderer.update(0, undefined, 0);
  const neo = h.renderer.getAgentBody('neo')!, patient = h.renderer.getAgentBody('trinity')!, head = neo.getObjectByName('head')!;
  neo.updateMatrixWorld(true); patient.updateMatrixWorld(true);
  const eye = head.localToWorld(head.userData.cameraEye.clone()), chest = patient.getObjectByName('chest')!;
  const garments: THREE.Mesh[] = [];
  neo.traverse(object => { if (object instanceof THREE.Mesh && visible(object) && /Coat|Cotton/.test((object.material as THREE.Material).name)) {
    if (object instanceof THREE.SkinnedMesh) { object.computeBoundingBox(); object.computeBoundingSphere(); }
    garments.push(object);
  } });
  if (process.env.CATCH_MODEL_DIAGNOSTIC) {
    console.log('Medical eye', eye.toArray());
    for (const name of ['head', 'chest', 'shoulder_R', 'elbow_R', 'wrist_R', 'shoulder_L', 'elbow_L', 'wrist_L']) console.log('Medical joint', name, neo.getObjectByName(name)!.getWorldPosition(new THREE.Vector3()).sub(eye).toArray());
  }
  let blocked = 0; const occluders = new Map<string, number>();
  for (const x of [-.3, -.15, 0, .15, .3]) for (const y of [-.12, 0, .12, .24, .36]) {
    const target = chest.localToWorld(new THREE.Vector3(x, y, .3)), direction = target.clone().sub(eye);
    const ray = new THREE.Raycaster(eye, direction.clone().normalize(), 0, direction.length() - .04), hit = ray.intersectObjects(garments)[0];
    if (hit) { blocked++; occluders.set(hit.object.name, (occluders.get(hit.object.name) ?? 0) + 1);
      if (process.env.CATCH_MODEL_DIAGNOSTIC) {
        const mesh = hit.object as THREE.SkinnedMesh, { skinIndex, skinWeight } = mesh.geometry.attributes, vertex = hit.face!.a;
        console.log('Masked sample', x, y, hit.distance, hit.point.clone().sub(eye).toArray(), Array.from({ length: 4 }, (_, k) => [mesh.skeleton.bones[skinIndex.getComponent(vertex, k)].name, skinWeight.getComponent(vertex, k)]));
      }
    }
  }
  let longest = 0, worst = '';
  for (const mesh of garments) {
    const { position } = mesh.geometry.attributes, index = mesh.geometry.index!, points = Array.from({ length: position.count }, (_, i) => mesh.localToWorld(mesh.getVertexPosition(i, new THREE.Vector3())));
    for (let i = 0; i < index.count; i += 3) for (let j = 0; j < 3; j++) {
      const a = index.getX(i + j), b = index.getX(i + (j + 1) % 3), distance = points[a].distanceTo(points[b]);
      if (distance > longest) { longest = distance; worst = mesh.name; }
    }
  }
  console.log('Medical coat wound mask', blocked, [...occluders], 'longest edge', longest, worst);
  // Hands working on the wound can legitimately cover part of this patch.
  // The defect is the collar/upper sleeves filling the space above the patient.
  for (const aspect of [16 / 9, .7]) {
    const camera = new THREE.PerspectiveCamera(68, aspect, .06, 6); camera.position.copy(eye);
    camera.lookAt(chest.localToWorld(new THREE.Vector3(-.02, .18, .3))); camera.updateMatrixWorld(true);
    const ray = new THREE.Raycaster(); ray.near = camera.near; ray.far = 2.5;
    for (const x of [-.6, -.3, 0, .3, .6]) for (const y of [.35, .65, .85]) {
      ray.setFromCamera(new THREE.Vector2(x, y), camera);
      assert.equal(ray.intersectObjects(garments).length, 0, `Neo’s coat fills the upper view at ${x}/${y}/${aspect}`);
    }
  }
  assert.ok(longest < .65, `a ${worst} triangle is stretched to ${longest} metres`);
});

test('Neo kneels over the patient with his eyes above his coat collar', async t => {
  const h = await fixture(t);
  for (const phase of ['extract_ready', 'pulse', 'reviving'] as const) {
    h.apply({ ...newCatch(), phase, elapsed: .477 });
    const body = h.renderer.getAgentBody('neo')!, head = body.getObjectByName('head')!;
    const eye = head.localToWorld(head.userData.cameraEye.clone());
    const shoulder = Math.max(...['R', 'L'].map(side => body.getObjectByName(`shoulder_${side}`)!.getWorldPosition(new THREE.Vector3()).y));
    console.log('Kneeling eye/collar clearance', phase, eye.y - shoulder);
    assert.ok(eye.y - shoulder > .13, `${phase} bends Neo's eyes below his own collar`);
    const chest = h.renderer.getAgentBody('trinity')!.getObjectByName('chest')!.localToWorld(new THREE.Vector3(-.02, .18, .3));
    const forward = new THREE.Vector3(0, 0, 1).applyQuaternion(body.getWorldQuaternion(new THREE.Quaternion()));
    assert.ok(chest.sub(eye).dot(forward) > .15, `${phase} puts Neo’s eyes past the wound and turns his view back into his own arms`);
  }
});

test('completed extraction code does not fill the first-person view during revival', async t => {
  const h = await fixture(t), state = { ...newCatch(), phase: 'reviving' as const, elapsed: .477, focus: CATCH.extraction };
  h.apply(state); const patient = h.renderer.getAgentBody('trinity')!, head = h.renderer.getAgentBody('neo')!.getObjectByName('head')!;
  const root = new THREE.Group(), center = filmPosition('film_trinity_roof', 0, 0); root.position.set(center.x, center.y - 1, center.z);
  const renderer = new ReloadedCatchRenderer(root); t.after(() => renderer.dispose()); renderer.update({ scene: 'm2_catch', catch: state } as FilmJourney, patient);
  root.updateMatrixWorld(true);
  const camera = new THREE.PerspectiveCamera(68, 16 / 9, .06, 6); camera.position.copy(head.localToWorld(head.userData.cameraEye.clone()));
  camera.lookAt(patient.getObjectByName('chest')!.localToWorld(new THREE.Vector3(-.02, .18, .3))); camera.updateMatrixWorld(true);
  const fragments = [root.getObjectByName('catch-extracted-bullet')!, ...Array.from({ length: 7 }, (_, i) => root.getObjectByName(`catch-code-${i}`)!)].filter(visible), ray = new THREE.Raycaster(); ray.near = camera.near; ray.far = 2;
  let covered = 0;
  for (let x = -.9; x <= .9; x += .1) for (let y = -.8; y <= .9; y += .1) {
    ray.setFromCamera(new THREE.Vector2(x, y), camera); if (ray.intersectObjects(fragments).length) covered++;
  }
  console.log('Revival code foreground samples', covered);
  assert.equal(covered, 0, 'the finished extraction still surrounds Neo’s eye with opaque code blocks');
});

test('both medical palms keep contact before extraction, through the lift and during revival', async t => {
  const h = await fixture(t);
  for (const [phase, focus] of [['extract_ready', 0], ['extracting', 0], ['extracting', 1.2], ['extracting', CATCH.extraction], ['pulse', CATCH.extraction], ['reviving', CATCH.extraction]] as const) {
    const state = { ...newCatch(), phase, focus, elapsed: .477 }; h.apply(state);
    const neo = h.renderer.getAgentBody('neo')!, chest = h.renderer.getAgentBody('trinity')!.getObjectByName('chest')!;
    for (const side of ['R', 'L'] as const) {
      const palm = neo.getObjectByName(`wrist_${side}`)!.localToWorld(new THREE.Vector3(0, -.19, .035));
      const target = chest.localToWorld(new THREE.Vector3(side === 'R' ? -.02 : .23, .18, .3));
      if (side === 'R' && phase === 'extracting') target.y += CATCH.extractionLift * focus / CATCH.extraction;
      console.log('Complete medical contact', phase, focus, side, palm.distanceTo(target));
      assert.ok(palm.distanceTo(target) < .04, `${phase}/${focus} ${side} palm floats ${palm.distanceTo(target)} metres from its contact`);
    }
  }
});
