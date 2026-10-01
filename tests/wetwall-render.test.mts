import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { FILM_SETS, WETWALL, WETWALL_SHAFT, WETWALL_ROLES, wetwallEntry, wetwallPose, wetwallPath, type WetwallEncounter, type WetwallGesture, type WetwallRole, type FilmJourney } from '@auto_matrix/shared';
import { WorldState } from '../packages/server/src/world/WorldState.js';
import { AgentManager } from '../packages/server/src/agents/AgentManager.js';
import { CharacterModels } from '../packages/client/src/agents/CharacterModel.js';
import { AgentRenderer } from '../packages/client/src/agents/AgentRenderer.js';
import { WetwallRenderer } from '../packages/client/src/engine/WetwallRenderer.js';
import { PlayerControls } from '../packages/client/src/player/PlayerControls.js';

function encounter(): WetwallEncounter {
  const starts = Object.fromEntries(WETWALL_ROLES.map(role => [role, { x: WETWALL.lanes[role], y: WETWALL_SHAFT.top, z: role === 'neo' ? -26.9 : -26 }])) as WetwallEncounter['starts'];
  const progress = Object.fromEntries(WETWALL_ROLES.map(role => [role, 0])) as WetwallEncounter['progress'];
  return { phase: 'climbing', elapsed: 0, attempts: 0, freed: false, starts, progress, checkpoint: { progress: { ...progress }, freed: false } };
}
function gesture(wall: WetwallEncounter, role: WetwallRole, depth: number): WetwallGesture {
  const entry = wetwallEntry(wall, role);
  return { role, phase: wall.phase, elapsed: wall.elapsed, progress: entry + depth, entry, hanging: true, freed: wall.freed, start: wall.starts[role] };
}
async function actualModels(t: test.TestContext) {
  const assets = new Map();
  for (const name of ['neo', 'trinity', 'morpheus', 'choi']) {
    const glb = await readFile(new URL(`../packages/client/public/assets/characters/${name}.glb`, import.meta.url));
    const length = glb.readUInt32LE(12), source = JSON.parse(glb.subarray(20, 20 + length).toString());
    for (const material of source.materials) { delete material.pbrMetallicRoughness.baseColorTexture; delete material.normalTexture; }
    source.images = []; source.textures = [];
    const json = Buffer.from(JSON.stringify(source)), padded = Buffer.alloc(Math.ceil(json.length / 4) * 4, 32); json.copy(padded);
    const bin = glb.subarray(20 + length), buffer = Buffer.alloc(20 + padded.length + bin.length);
    buffer.writeUInt32LE(0x46546c67, 0); buffer.writeUInt32LE(2, 4); buffer.writeUInt32LE(buffer.length, 8);
    buffer.writeUInt32LE(padded.length, 12); buffer.writeUInt32LE(0x4e4f534a, 16); padded.copy(buffer, 20); bin.copy(buffer, 20 + padded.length);
    assets.set(name, await new GLTFLoader().parseAsync(buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength), ''));
  }
  t.mock.method(GLTFLoader.prototype, 'loadAsync', async (url: string) => assets.get(url.includes('morpheus') ? 'morpheus' : url.includes('trinity') ? 'trinity' : url.includes('choi') ? 'choi' : 'neo'));
  t.mock.method(THREE.TextureLoader.prototype, 'load', () => new THREE.Texture());
  const document = globalThis.document;
  globalThis.document = { createElement: () => ({ getContext: () => ({ createRadialGradient: () => ({ addColorStop() {} }), fillRect() {},
    createImageData: (w: number, h: number) => ({ data: new Uint8ClampedArray(w * h * 4) }), putImageData() {} }) }) } as unknown as Document;
  const world = new WorldState(); new AgentManager(world).initializeAllAgents(); const models = new CharacterModels();
  t.after(() => { models.dispose(); globalThis.document = document; });
  return { world, models };
}

test('the real shaft has a removable entry, continuous empty descent and solid enclosing walls', () => {
  const root = new THREE.Group(), material = new THREE.MeshStandardMaterial();
  const renderer = new WetwallRenderer(root, { plaster: material, wood: material, iron: material, trim: material });
  const ray = new THREE.Raycaster();
  const hits = (start: THREE.Vector3, direction: THREE.Vector3, far: number) => {
    root.updateWorldMatrix(true, true); ray.set(start, direction); ray.far = far;
    return ray.intersectObject(root, true).filter(hit => {
      for (let object: THREE.Object3D | null = hit.object; object; object = object.parent) if (!object.visible) return false;
      return hit.object instanceof THREE.Mesh && hit.object.castShadow;
    });
  };
  try {
    const wall = encounter(), journey = { scene: 'm1_wetwall', wetwall: wall } as FilmJourney;
    wall.phase = 'sealed'; renderer.update(journey);
    assert.ok(hits(new THREE.Vector3(-18.75, WETWALL_SHAFT.top + 3, -28.4), new THREE.Vector3(0, 0, -1), 3.7).length);
    wall.phase = 'climbing'; renderer.update(journey);
    assert.equal(hits(new THREE.Vector3(-18.75, WETWALL_SHAFT.top + 3, -28.4), new THREE.Vector3(0, 0, -1), 3.7).length, 0,
      'opening the grey wall must expose a genuinely traversable aperture');
    assert.equal(hits(new THREE.Vector3(-16.4, WETWALL_SHAFT.top - 1, WETWALL_SHAFT.bodyZ), new THREE.Vector3(0, -1, 0), 20).length, 0,
      'there cannot be an invisible-looking floor slab across the two-storey descent');
    for (const [direction, distance] of [[new THREE.Vector3(0, 0, -1), 2], [new THREE.Vector3(0, 0, 1), 2], [new THREE.Vector3(-1, 0, 0), 7]] as const)
      assert.ok(hits(new THREE.Vector3(-16.4, WETWALL_SHAFT.sixth + 3, WETWALL_SHAFT.bodyZ), direction, distance).length);
    for (const x of [-20.5, -18, -15.5]) assert.ok(root.getObjectByName(`wetwall-stack-${x}`));
  } finally { renderer.dispose(); material.dispose(); }
});

test('actual six-person models grip the stack and keep skin, shoes and coats outside the pipe and enclosing walls', async t => {
  const h = await actualModels(t), center = FILM_SETS.film_ambush_house.center, wall = encounter(), vertex = new THREE.Vector3();
  const errors: string[] = [];
  for (const role of WETWALL_ROLES) {
    const rig = h.models.create(h.world.agents.get(role)!); await new Promise(resolve => setImmediate(resolve));
    assert.ok(rig.hero);
    for (const depth of [0, .08, .32, .56, .81, 1.05, 4, 9.4, 14.8]) {
      const wallGesture = gesture(wall, role, depth), pose = wetwallPose(wallGesture.start, role, wallGesture.progress, wall.phase, 0);
      rig.root.position.set(center.x + pose.x, center.y - 1 + pose.y, center.z + pose.z); rig.root.rotation.y = pose.yaw;
      h.models.animate(rig, 0, { speed: 0, grounded: true, verticalVelocity: 0, turn: 0, climbing: 0, wetwall: wallGesture }, 4);
      rig.root.updateMatrixWorld(true);
      const contacts = [0, 1].map(i => rig.hero ? rig.hero.bones.get(`wrist_${i ? 'L' : 'R'}`)!.localToWorld(new THREE.Vector3(0, -.19, .035))
        : rig.elbows[i].localToWorld(new THREE.Vector3(0, -.79, .055)));
      const distances = contacts.map(contact => Math.hypot(contact.x - center.x - WETWALL.lanes[role], contact.z - center.z - WETWALL_SHAFT.pipeZ));
      for (const [i, distance] of distances.entries()) if (distance < .18 || distance > .6)
        errors.push(`${role} depth=${depth} palm=${i} leaves the grip / short release stroke: ${distance}`);
      if (!distances.some(distance => distance <= .43)) errors.push(`${role} depth=${depth} releases both hands at once: ${distances}`);
      let wallClearance = Infinity, pipeClearance = Infinity, pipePart = '';
      rig.root.traverse(object => {
        if (!(object instanceof THREE.Mesh) || !object.visible) return;
        for (let parent = object.parent; parent && parent !== rig.root; parent = parent.parent) if (!parent.visible) return;
        for (let i = 0; i < object.geometry.attributes.position.count; i++) {
          object.getVertexPosition(i, vertex); object.localToWorld(vertex);
          const x = vertex.x - center.x, z = vertex.z - center.z;
          wallClearance = Math.min(wallClearance, x - WETWALL_SHAFT.left - .2, WETWALL_SHAFT.right - .2 - x, z - WETWALL_SHAFT.back - .25, WETWALL_SHAFT.front - .12 - z);
          for (const pipe of [-20.5, -18, -15.5]) {
            const clearance = Math.hypot(x - pipe, z - WETWALL_SHAFT.pipeZ) - .2;
            if (clearance < pipeClearance) { pipeClearance = clearance; pipePart = `${object.name || object.geometry.type} vertex=${i} x=${x} z=${z}`; }
          }
        }
      });
      if (wallClearance < -.025) errors.push(`${role} depth=${depth} crosses shaft masonry: ${wallClearance}`);
      if (pipeClearance < -.025) errors.push(`${role} depth=${depth} penetrates pipe core: ${pipeClearance}, ${pipePart}`);
      if (pipeClearance > .08) errors.push(`${role} depth=${depth} has no actual mesh in contact with the pipe: ${pipeClearance}`);
    }
  }
  assert.deepEqual(errors, [], 'contact checks use all six delivered meshes, including the new Cypher surrogate');
});

test('Trinity and Cypher actual hands meet during the rescue without moving their saved pipe height', async t => {
  const h = await actualModels(t), wall = encounter(), center = FILM_SETS.film_ambush_house.center;
  wall.phase = 'rescuing'; wall.elapsed = 1.1;
  const trinity = h.models.create(h.world.agents.get('trinity')!), cypher = h.models.create(h.world.agents.get('cypher')!);
  await new Promise(resolve => setImmediate(resolve)); assert.ok(trinity.hero);
  for (const [role, rig] of [['trinity', trinity], ['cypher', cypher]] as const) {
    const input = gesture(wall, role, WETWALL.jam), pose = wetwallPose(input.start, role, input.progress, input.phase, input.elapsed);
    rig.root.position.set(center.x + pose.x, center.y - 1 + pose.y, center.z + pose.z); rig.root.rotation.y = pose.yaw;
    h.models.animate(rig, 0, { speed: 0, grounded: true, verticalVelocity: 0, turn: 0, climbing: 0, wetwall: input }, 4);
    rig.root.updateMatrixWorld(true);
  }
  const hand = trinity.hero!.bones.get('wrist_R')!.localToWorld(new THREE.Vector3(0, -.19, .035));
  const other = cypher.hero!.bones.get('wrist_L')!.localToWorld(new THREE.Vector3(0, -.19, .035));
  assert.ok(hand.distanceTo(other) < .07, `the rescue cannot be two hands reaching separate empty points: ${hand.distanceTo(other)}`);
  const vertex = new THREE.Vector3(); let clearance = Infinity, part = '';
  for (const [role, rig] of [['trinity', trinity], ['cypher', cypher]] as const) rig.root.traverse(object => {
    if (!(object instanceof THREE.Mesh) || !object.visible) return;
    for (let parent = object.parent; parent && parent !== rig.root; parent = parent.parent) if (!parent.visible) return;
    for (let i = 0; i < object.geometry.attributes.position.count; i++) {
      object.getVertexPosition(i, vertex); object.localToWorld(vertex);
      const y = vertex.y - center.y + 1;
      if (Math.abs(y - (WETWALL_SHAFT.top - WETWALL.jam + 2.2)) > 1.7) continue;
      for (const side of [-1, 1]) {
        const gap = Math.hypot(vertex.x - center.x + 18 - side * 1.18, vertex.z - center.z - WETWALL_SHAFT.bodyZ - .12) - .11;
        if (gap < clearance) { clearance = gap; part = `${role} ${object.name || object.geometry.type} vertex=${i} at=${vertex.clone().sub(new THREE.Vector3(center.x, center.y - 1, center.z)).toArray()}`; }
      }
    }
  });
  assert.ok(clearance >= -.025, `rescue arms and hands must go around the actual supply risers: ${clearance}, ${part}`);
});

test('actual Neo first-person eyes remain in front of the pipe and show the descent instead of the rear wall', async t => {
  const h = await actualModels(t), wall = encounter(), center = FILM_SETS.film_ambush_house.center, actor = h.world.agents.get('neo')!;
  const rig = h.models.create(actor); await new Promise(resolve => setImmediate(resolve)); assert.ok(rig.hero);
  class InputTarget extends EventTarget { matches() { return false; } }
  const previousWindow = globalThis.window, document = globalThis.document, canvas = new InputTarget();
  globalThis.window = new InputTarget() as unknown as Window & typeof globalThis;
  globalThis.document = Object.assign(new InputTarget(), document, { pointerLockElement: null, hidden: false, exitPointerLock() {} }) as unknown as Document;
  const camera = new THREE.PerspectiveCamera(57, 16 / 9, .5, 5000), group = new THREE.Group(); group.add(rig.root); rig.root.position.y = -1;
  const controls = new PlayerControls(canvas as unknown as HTMLCanvasElement, camera, () => {}, () => {});
  try {
    for (const depth of [1.4, 4, 9.4, 14.8]) {
      const input = gesture(wall, 'neo', depth), pose = wetwallPose(input.start, 'neo', input.progress, input.phase, input.elapsed);
      actor.position = { x: center.x + pose.x, y: center.y + pose.y, z: center.z + pose.z }; actor.rotation = Math.PI; actor.currentLocation = 'film_ambush_house';
      actor.currentAction = { type: 'idle', parameters: { resolved: true, wetwall: input }, startedAt: 0, duration: 1, progress: 0 };
      controls.possess(actor); controls.firstPerson = true; controls.update(.1, actor, group, false);
      h.models.animate(rig, 0, controls.motion, 4); group.updateMatrixWorld(true); controls.update(.1, actor, group, false); camera.updateMatrixWorld(true);
      assert.ok(camera.position.z > center.z + WETWALL_SHAFT.pipeZ + .25,
        `the real head must not move the eye behind the gripped pipe into masonry at depth=${depth}: ${camera.position.toArray()}`);
      const pipe = new THREE.Vector3(center.x + WETWALL.lanes.neo, camera.position.y - .6, center.z + WETWALL_SHAFT.pipeZ + .2).project(camera);
      assert.ok(Math.abs(pipe.x) < .85 && Math.abs(pipe.y) < .85 && pipe.z > -1 && pipe.z < 1,
        `the default view must show the gripped pipe and downward route: ${pipe.toArray()}, eye=${camera.position.clone().sub(new THREE.Vector3(center.x, center.y, center.z)).toArray()}, direction=${camera.getWorldDirection(new THREE.Vector3()).toArray()}`);
    }
  } finally { controls.dispose(); globalThis.window = previousWindow; globalThis.document = document; }
});

test('the wall camera clears the actual companions and shows Trinity and Cypher during the rescue', async t => {
  const h = await actualModels(t), wall = encounter(), center = FILM_SETS.film_ambush_house.center, actor = h.world.agents.get('neo')!;
  const rigs = Object.fromEntries(WETWALL_ROLES.map(role => [role, h.models.create(h.world.agents.get(role)!)]));
  await new Promise(resolve => setImmediate(resolve));
  class InputTarget extends EventTarget { matches() { return false; } }
  const previousWindow = globalThis.window, document = globalThis.document, canvas = new InputTarget();
  globalThis.window = new InputTarget() as unknown as Window & typeof globalThis;
  globalThis.document = Object.assign(new InputTarget(), document, { pointerLockElement: null, hidden: false, exitPointerLock() {} }) as unknown as Document;
  const camera = new THREE.PerspectiveCamera(57, 16 / 9, .5, 5000), group = new THREE.Group(); group.add(rigs.neo.root); rigs.neo.root.position.y = -1;
  const shaftRoot = new THREE.Group(); shaftRoot.position.set(center.x, center.y - 1, center.z);
  const material = new THREE.MeshStandardMaterial(), shaft = new WetwallRenderer(shaftRoot, { plaster: material, wood: material, iron: material, trim: material });
  const controls = new PlayerControls(canvas as unknown as HTMLCanvasElement, camera, () => {}, () => {}), errors: string[] = [];
  try {
    for (const aspect of [.72, 16 / 9]) for (const [phase, depth] of [['climbing', 4], ['climbing', 14.8], ['rescuing', 4]] as const) {
      wall.phase = phase; wall.elapsed = phase === 'rescuing' ? 1.1 : 0; wall.freed = true; camera.aspect = aspect;
      shaft.update({ scene: 'm1_wetwall', wetwall: wall } as FilmJourney); shaftRoot.updateMatrixWorld(true);
      for (const role of WETWALL_ROLES) {
        const lead = role === 'neo' ? 0 : role === 'morpheus' ? -WETWALL.spacing : ['apoc', 'switch'].includes(role) ? 11 : WETWALL.spacing;
        const input = gesture(wall, role, Math.max(0, depth + lead)), pose = wetwallPose(input.start, role, input.progress, input.phase, input.elapsed);
        const rig = rigs[role];
        if (role === 'neo') {
          actor.position = { x: center.x + pose.x, y: center.y + pose.y, z: center.z + pose.z }; actor.rotation = Math.PI; actor.currentLocation = 'film_ambush_house';
          actor.currentAction = { type: 'idle', parameters: { resolved: true, wetwall: input }, startedAt: 0, duration: 1, progress: 0 };
          controls.possess(actor); controls.update(.1, actor, group, false);
        } else { rig.root.position.set(center.x + pose.x, center.y - 1 + pose.y, center.z + pose.z); rig.root.rotation.y = pose.yaw; }
        h.models.animate(rig, 0, { speed: 0, grounded: true, verticalVelocity: 0, turn: 0, climbing: 0, wetwall: input }, 4);
        rig.root.updateMatrixWorld(true);
      }
      controls.update(.1, actor, group, false); camera.updateMatrixWorld(true);
      for (const role of phase === 'rescuing' ? ['trinity', 'cypher'] as const : ['neo'] as const) {
        const rig = rigs[role], targets = rig.hero ? [rig.hero.bones.get('head')!.getWorldPosition(new THREE.Vector3()), rig.hero.bones.get(phase === 'rescuing' ? 'wrist_R' : 'ankle_R')!.getWorldPosition(new THREE.Vector3())]
          : [rig.head.getWorldPosition(new THREE.Vector3()), rig.elbows[1].localToWorld(new THREE.Vector3(0, -.79, .055))];
        for (const [index, target] of targets.entries()) {
          const screen = target.clone().project(camera);
          if (Math.abs(screen.x) > .94 || Math.abs(screen.y) > .92 || screen.z < -1 || screen.z > 1)
            errors.push(`${phase} aspect=${aspect} ${role} is outside the shot: ${screen.toArray()}`);
          const direction = target.clone().sub(camera.position), ray = new THREE.Raycaster(camera.position, direction.clone().normalize(), .06, direction.length() - .15);
          for (const other of WETWALL_ROLES.filter(other => phase === 'rescuing' && index > 0 ? !['trinity', 'cypher'].includes(other) : other !== role)) {
            rigs[other].root.traverse(object => { if (object instanceof THREE.SkinnedMesh) object.computeBoundingSphere(); });
            const hits = ray.intersectObject(rigs[other].root, true).filter(hit => { for (let object: THREE.Object3D | null = hit.object; object; object = object.parent) if (!object.visible) return false; return true; });
            if (hits.length) errors.push(`${phase} aspect=${aspect} ${other}'s delivered body covers ${role}`);
          }
          const masonry = ray.intersectObject(shaftRoot, true).filter(hit => { for (let object: THREE.Object3D | null = hit.object; object; object = object.parent) if (!object.visible) return false; return hit.object instanceof THREE.Mesh && hit.object.castShadow; });
          if (masonry.length) errors.push(`${phase} aspect=${aspect} shaft fittings cover ${role}: ${masonry[0].object.name || masonry[0].point.toArray()}`);
        }
      }
    }
    assert.deepEqual(errors, [], 'the camera must show the saved action rather than a companion coat in front of the lens');
  } finally { controls.dispose(); shaft.dispose(); material.dispose(); globalThis.window = previousWindow; globalThis.document = document; }
});

test('companion entry snapshots interpolate along corners and preserve a paused hanging height', t => {
  t.mock.method(THREE.TextureLoader.prototype, 'load', () => new THREE.Texture());
  t.mock.method(GLTFLoader.prototype, 'loadAsync', () => new Promise(() => {}));
  const document = globalThis.document;
  globalThis.document = { createElement: () => ({ getContext: () => ({ createRadialGradient: () => ({ addColorStop() {} }), fillRect() {}, strokeRect() {}, fillText() {},
    createImageData: (w: number, h: number) => ({ data: new Uint8ClampedArray(w * h * 4) }), putImageData() {} }) }) } as unknown as Document;
  const world = new WorldState(); new AgentManager(world).initializeAllAgents(); const wall = encounter(), actor = world.agents.get('trinity')!;
  const renderer = new AgentRenderer(new THREE.Scene()), center = FILM_SETS.film_ambush_house.center;
  const snapshot = (progress: number) => {
    const input = gesture(wall, 'trinity', 0); input.progress = progress;
    const pose = wetwallPose(input.start, input.role, progress, input.phase, input.elapsed); input.hanging = pose.hanging;
    actor.position = { x: center.x + pose.x, y: center.y + pose.y, z: center.z + pose.z }; actor.rotation = pose.yaw; actor.isInMatrix = true;
    actor.currentAction = { type: 'idle', parameters: { resolved: true, wetwall: input }, startedAt: 0, duration: 1, progress: 0 };
    renderer.updateAgent(actor.id, actor);
  };
  try {
    const points = wetwallPath(wall.starts.trinity, 'trinity'), corner = Math.hypot(points[1].x - points[0].x, points[1].z - points[0].z);
    snapshot(corner - .3); renderer.update(0); snapshot(corner + .6);
    for (let frame = 1; frame <= 5; frame++) {
      renderer.update(.1); const progress = corner - .3 + .9 * frame / 5, pose = wetwallPose(wall.starts.trinity, 'trinity', progress, wall.phase, 0);
      assert.ok(renderer.getAgent('trinity')!.position.distanceTo(new THREE.Vector3(center.x + pose.x, center.y + pose.y, center.z + pose.z)) < .001);
    }
    const depth = wetwallEntry(wall, 'trinity') + WETWALL.jam; snapshot(depth); renderer.update(.5);
    const saved = renderer.getAgent('trinity')!.position.clone(); snapshot(depth + .6); renderer.update(.2, undefined, 0);
    assert.deepEqual(renderer.getAgent('trinity')!.position.toArray(), saved.toArray());
  } finally { renderer.dispose(); globalThis.document = document; }
});
