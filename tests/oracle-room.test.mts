import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { FILM_SETS, SPOON_LESSON, ORACLE_WAITING_CAST, oracleReceptionRoot, spoonLessonBend, filmPosition, type SpoonLesson } from '@auto_matrix/shared';
import { FilmSetRenderer } from '../packages/client/src/engine/FilmSetRenderer.js';
import { WorldState } from '../packages/server/src/world/WorldState.js';
import { AgentManager } from '../packages/server/src/agents/AgentManager.js';
import { CharacterModels } from '../packages/client/src/agents/CharacterModel.js';
import { AgentRenderer } from '../packages/client/src/agents/AgentRenderer.js';

test('the Oracle waiting room has open window apertures, grounded furniture and a clear spoon encounter', t => {
  t.mock.method(THREE.TextureLoader.prototype, 'load', () => new THREE.Texture());
  const document = globalThis.document;
  const context = { fillRect() {}, strokeRect() {}, fillText() {}, beginPath() {}, moveTo() {}, lineTo() {}, closePath() {}, stroke() {}, fill() {}, ellipse() {} };
  globalThis.document = { createElement: () => ({ getContext: () => context }) } as unknown as Document;
  const world = new WorldState(); new AgentManager(world).initializeAllAgents();
  const neo = world.agents.get('neo')!; neo.position = filmPosition('film_oracle_home', -7, 10); neo.isInMatrix = true;
  const renderer = new FilmSetRenderer(new THREE.Scene());
  try {
    renderer.update(neo, undefined, 0); renderer.root.updateMatrixWorld(true);
    const ray = new THREE.Raycaster();
    const blockers = (point: THREE.Vector3, direction: THREE.Vector3, distance: number) => {
      ray.set(renderer.root.localToWorld(point), direction); ray.far = distance;
      return ray.intersectObject(renderer.root, true).filter(hit => {
        const mesh = hit.object as THREE.Mesh;
        return mesh.castShadow && !Array.isArray(mesh.material) && !mesh.material.transparent;
      });
    };
    assert.equal(blockers(new THREE.Vector3(-6, 3, 11), new THREE.Vector3(0, -1, 0), 2.7).length, 0,
      'the old chair must not occupy the standing / looking space beside Neo and the child');
    for (const side of [-1, 1]) for (const z of [1, 18]) {
      assert.equal(blockers(new THREE.Vector3(side * 13.3, 5.2, z + .65), new THREE.Vector3(side, 0, 0), 2).length, 0,
        'daylight must pass through real openings instead of glass pasted onto solid walls');
      assert.ok(blockers(new THREE.Vector3(side * 13.3, 1, z + .65), new THREE.Vector3(side, 0, 0), 2).length > 0,
        'the lower wall below each window stays solid');
    }
    for (const [x, z] of [[-11.5, 14], [10.8, 9], [11.8, -1], [-12.4, -3], [-10.8, 20]]) {
      assert.ok(blockers(new THREE.Vector3(x, 7, z), new THREE.Vector3(0, -1, 0), 6.5).length > 0,
        `the shared furniture footprint at ${x}, ${z} needs visible geometry`);
    }
    assert.ok(blockers(new THREE.Vector3(0, 7.2, 10), new THREE.Vector3(0, 1, 0), 1.2).length > 0,
      'the residential room has a lower continuous ceiling instead of an oversized hall');
    for (const y of [1, 3, 5]) assert.equal(blockers(new THREE.Vector3(0, y, -6), new THREE.Vector3(0, 0, -1), 3).length, 0,
      'the existing kitchen passage must remain visibly open');
    const blocks = renderer.root.getObjectByName('oracle-floating-alphabet-blocks')!;
    assert.equal(blocks.children.length, 3); assert.equal(blocks.userData.dynamic, true);
    const transforms = blocks.children.map(block => block.matrix.clone()); renderer.update(neo, undefined, 100); blocks.updateWorldMatrix(true, true);
    blocks.children.forEach((block, i) => {
      assert.ok(block.position.y > 1.3 && block.position.y < 2, 'the girl levitates wooden blocks above the floor');
      assert.ok(block.matrix.equals(transforms[i]), 'the room uses its saved action clock rather than wall time while paused');
    });
  } finally { renderer.dispose(); globalThis.document = document; }
});

test('Spoon Boy folds both legs above the rug instead of driving his shins through the floor', t => {
  t.mock.method(THREE.TextureLoader.prototype, 'load', () => new THREE.Texture());
  const document = globalThis.document;
  globalThis.document = { createElement: () => ({ getContext: () => ({
    createImageData: (w: number, h: number) => ({ data: new Uint8ClampedArray(w * h * 4) }), putImageData() {},
  }) }) } as unknown as Document;
  const world = new WorldState(); new AgentManager(world).initializeAllAgents();
  const models = new CharacterModels(); const rig = models.create(world.agents.get('spoon_boy')!);
  const input = { speed: 0, grounded: true, verticalVelocity: 0, turn: 0, seated: true, floorSeated: true, spoon: 1,
    spoonLesson: { phase: 'offered' as const, elapsed: 0, role: 'boy' as const } };
  try {
    models.animate(rig, 0, input, 4); rig.root.updateMatrixWorld(true);
    const pausedHead = rig.head.getWorldPosition(new THREE.Vector3());
    for (const ankle of rig.ankles) assert.ok(ankle.getWorldPosition(new THREE.Vector3()).y < .4,
      'loading a paused save must restore the folded seated pose without waiting for time to resume');
    for (let frame = 0; frame < 90; frame++) models.animate(rig, 1 / 30, input, 4);
    rig.root.updateMatrixWorld(true);
    assert.ok(Math.abs(pausedHead.y - rig.head.getWorldPosition(new THREE.Vector3()).y) < .025,
      'the child torso cannot float upward only when restoring a paused lesson');
    for (const hip of rig.hips) hip.traverse(object => {
      if (!(object instanceof THREE.Mesh)) return;
      const vertex = new THREE.Vector3();
      for (let i = 0; i < object.geometry.attributes.position.count; i++) {
        object.getVertexPosition(i, vertex); object.localToWorld(vertex);
        assert.ok(vertex.y >= .048, `leg or shoe penetrates the rug: ${vertex.toArray()}`);
      }
    });
    for (const ankle of rig.ankles) {
      const foot = ankle.getWorldPosition(new THREE.Vector3());
      assert.ok(foot.z > .35 && foot.y < .4 && Math.abs(foot.x) < .4,
        `both folded feet must rest in front of the body, not hang below the pelvis: ${foot.toArray()}`);
      const up = new THREE.Vector3(0, 1, 0).applyQuaternion(ankle.getWorldQuaternion(new THREE.Quaternion()));
      assert.ok(up.y > .98, 'the shoes rest flat while the shins fold across the lap');
    }
  } finally { models.dispose(); globalThis.document = document; }
});

test('switching to first person keeps the held spoon visible and restores normal visibility when it is put away', t => {
  t.mock.method(THREE.TextureLoader.prototype, 'load', () => new THREE.Texture());
  t.mock.method(GLTFLoader.prototype, 'loadAsync', () => new Promise(() => {}));
  const document = globalThis.document;
  const context = { createRadialGradient: () => ({ addColorStop() {} }), fillRect() {}, strokeRect() {}, fillText() {},
    createImageData: (w: number, h: number) => ({ data: new Uint8ClampedArray(w * h * 4) }), putImageData() {} };
  globalThis.document = { createElement: () => ({ getContext: () => context }) } as unknown as Document;
  const world = new WorldState(); new AgentManager(world).initializeAllAgents();
  const neo = world.agents.get('neo')!; neo.position = filmPosition('film_oracle_home', -7, 10); neo.isInMatrix = true;
  const renderer = new AgentRenderer(new THREE.Scene());
  const input = { speed: 0, grounded: true, verticalVelocity: 0, turn: 0, spoon: .4 };
  try {
    renderer.updateAgent('neo', neo); renderer.setPlayer('neo', true); renderer.setPlayerMotion(input); renderer.update(.1);
    const spoon = renderer.getAgent('neo')!.getObjectByName('held-spoon')!;
    assert.ok(spoon);
    for (let parent: THREE.Object3D | null = spoon; parent; parent = parent.parent) assert.equal(parent.visible, true,
      'the spoon cannot be visible if the first-person actor root hides all descendants');
    renderer.setPlayerMotion({ ...input, spoon: undefined }); renderer.update(.1);
    assert.equal(renderer.getAgentBody('neo')!.visible, false);
    renderer.setPlayer('neo', false); renderer.update(.1);
    assert.equal(renderer.getAgentBody('neo')!.visible, true);
  } finally { renderer.dispose(); globalThis.document = document; }
});

test('Neo keeps the spoon between his actual thumb and index finger, including a late character load', async t => {
  const glb = await readFile(new URL('../packages/client/public/assets/characters/neo.glb', import.meta.url));
  const length = glb.readUInt32LE(12), source = JSON.parse(glb.subarray(20, 20 + length).toString());
  for (const material of source.materials) { delete material.pbrMetallicRoughness.baseColorTexture; delete material.normalTexture; }
  source.images = []; source.textures = [];
  const json = Buffer.from(JSON.stringify(source)), padded = Buffer.alloc(Math.ceil(json.length / 4) * 4, 32); json.copy(padded);
  const bin = glb.subarray(20 + length), buffer = Buffer.alloc(20 + padded.length + bin.length);
  buffer.writeUInt32LE(0x46546c67, 0); buffer.writeUInt32LE(2, 4); buffer.writeUInt32LE(buffer.length, 8);
  buffer.writeUInt32LE(padded.length, 12); buffer.writeUInt32LE(0x4e4f534a, 16); padded.copy(buffer, 20); bin.copy(buffer, 20 + padded.length);
  const asset = await new GLTFLoader().parseAsync(buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength), '');
  t.mock.method(GLTFLoader.prototype, 'loadAsync', async () => asset);
  t.mock.method(THREE.TextureLoader.prototype, 'load', () => new THREE.Texture());
  const document = globalThis.document;
  globalThis.document = { createElement: () => ({ getContext: () => ({
    createImageData: (w: number, h: number) => ({ data: new Uint8ClampedArray(w * h * 4) }), putImageData() {},
  }) }) } as unknown as Document;
  const world = new WorldState(); new AgentManager(world).initializeAllAgents();
  const models = new CharacterModels(), rig = models.create(world.agents.get('neo')!);
  const input = { speed: 0, grounded: true, verticalVelocity: 0, turn: 0, spoon: 0 };
  try {
    models.animate(rig, 1 / 30, input, 4); // Picking up before the GLB resolves must survive the rig swap.
    await new Promise(resolve => setImmediate(resolve));
    assert.ok(rig.hero);
    for (const bend of [0, .5, 1]) {
      models.animate(rig, 1 / 30, { ...input, spoon: bend }, 4); rig.root.updateMatrixWorld(true);
      assert.ok(rig.spoon!.root.parent === rig.hero.bones.get('wrist_R'), 'the prop must follow the loaded wrist instead of a hidden fallback hand');
      const contact = rig.spoon!.root.localToWorld(new THREE.Vector3(0, .08, 0));
      for (const finger of [1, 2]) {
        let nearest = Infinity;
        for (const part of rig.hero.wardrobe) {
          const mesh = part.mesh;
          if (!(mesh instanceof THREE.SkinnedMesh) || !mesh.visible || Array.isArray(mesh.material) || mesh.material.name !== 'Skin') continue;
          const indices = mesh.geometry.attributes.skinIndex, weights = mesh.geometry.attributes.skinWeight, point = new THREE.Vector3();
          for (let i = 0; i < indices.count; i++) {
            if (![0, 1, 2, 3].some(k => weights.getComponent(i, k) > .2 && mesh.skeleton.bones[indices.getComponent(i, k)]?.name.startsWith(`finger${finger}-`) && mesh.skeleton.bones[indices.getComponent(i, k)].name.endsWith('_R'))) continue;
            mesh.getVertexPosition(i, point); mesh.localToWorld(point); nearest = Math.min(nearest, point.distanceTo(contact));
          }
        }
        assert.ok(nearest < .05, `finger ${finger} must contact the handle at bend ${bend}, gap=${nearest}`);
      }
    }
    const boy = models.create(world.agents.get('spoon_boy')!);
    const center = FILM_SETS.film_oracle_home.center;
    for (const [body, place] of [[rig, SPOON_LESSON.neo], [boy, SPOON_LESSON.boy]] as const) {
      body.root.position.set(center.x + place.x, center.y - 1, center.z + place.z); body.root.rotation.y = place.yaw;
    }
    const pose = (phase: SpoonLesson['phase'], elapsed: number) => {
      const lesson = { phase, elapsed };
      for (const [body, role] of [[rig, 'neo'], [boy, 'boy']] as const) {
        models.animate(body, 1 / 30, { ...input, spoon: spoonLessonBend(lesson, role, .5), spoonLesson: { ...lesson, role },
          seated: role === 'boy', floorSeated: role === 'boy' }, 4);
        body.root.updateWorldMatrix(true, true);
      }
    };
    for (let frame = 0; frame < 90; frame++) pose('offered', 0);
    pose('receiving', SPOON_LESSON.transfer - .001);
    assert.equal(rig.spoon!.root.visible, false); assert.equal(boy.spoon!.root.visible, true);
    const before = boy.spoon!.root.localToWorld(new THREE.Vector3(0, .08, 0));
    const beforeRotation = boy.spoon!.root.getWorldQuaternion(new THREE.Quaternion());
    pose('receiving', SPOON_LESSON.transfer + .001);
    const after = rig.spoon!.root.localToWorld(new THREE.Vector3(0, .08, 0));
    assert.equal(rig.spoon!.root.visible, true); assert.equal(boy.spoon!.root.visible, false);
    assert.ok(before.distanceTo(after) < .025, `handing over cannot teleport the spoon: ${before.distanceTo(after)}`);
    assert.ok(beforeRotation.angleTo(rig.spoon!.root.getWorldQuaternion(new THREE.Quaternion())) < .04, 'handoff preserves the spoon orientation');
    assert.ok(rig.spoon!.root.getWorldScale(new THREE.Vector3()).distanceTo(new THREE.Vector3(.55, .55, .55)) < .001);
    for (const [phase, elapsed] of [['sitting', 2.6], ['sitting', 4], ['receiving', 1.1], ['focus', 2], ['rising', 1.2]] as const) {
      for (let frame = 0; frame < 12; frame++) pose(phase, elapsed);
      let lowest = Infinity, meshName = '';
      rig.root.traverseVisible(object => {
        if (!(object instanceof THREE.Mesh)) return;
        const vertex = new THREE.Vector3();
        for (let i = 0; i < object.geometry.attributes.position.count; i++) {
          object.getVertexPosition(i, vertex); object.localToWorld(vertex);
          if (vertex.y < lowest) { lowest = vertex.y; meshName = object.name; }
        }
      });
      assert.ok(lowest >= center.y - 1 - .015, `${phase} must keep ${meshName} above the rug: ${lowest - center.y + 1}`);
      if (phase === 'focus') {
        const head = rig.hero.bones.get('head')!.getWorldPosition(new THREE.Vector3());
        assert.ok(head.y > center.y + .65 && head.y < center.y + 1.5, `sitting head height: ${head.y - center.y}`);
      }
    }
    const paused = models.create(world.agents.get('neo')!);
    await new Promise(resolve => setImmediate(resolve));
    models.animate(paused, 0, { ...input, spoonLesson: { phase: 'focus', elapsed: 0, role: 'neo' } }, 4);
    paused.root.updateWorldMatrix(true, true);
    for (const panel of paused.hero!.panels) {
      const vertex = new THREE.Vector3();
      for (let i = 0; i < panel.mesh.geometry.attributes.position.count; i++) {
        panel.mesh.getVertexPosition(i, vertex); panel.mesh.localToWorld(vertex);
        assert.ok(vertex.y >= -.015, `a fresh paused Neo must not load with his coat below the rug: ${vertex.y}`);
      }
    }
  } finally { models.dispose(); globalThis.document = document; }
});

test('the white-clothed hostess touches seated Neo actual shoulder without moving her feet through the floor', async t => {
  const assets = new Map();
  for (const name of ['neo', 'dujour', 'morpheus']) {
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
  t.mock.method(GLTFLoader.prototype, 'loadAsync', async (url: string) => assets.get(url.includes('dujour') ? 'dujour' : url.includes('morpheus') ? 'morpheus' : 'neo'));
  t.mock.method(THREE.TextureLoader.prototype, 'load', () => new THREE.Texture());
  const document = globalThis.document;
  globalThis.document = { createElement: () => ({ getContext: () => ({ createImageData: (w: number, h: number) => ({ data: new Uint8ClampedArray(w * h * 4) }), putImageData() {} }) }) } as unknown as Document;
  const world = new WorldState(); new AgentManager(world).initializeAllAgents();
  const models = new CharacterModels(), neo = models.create(world.agents.get('neo')!), hostess = models.create(world.agents.get('oracle_priestess')!);
  try {
    await new Promise(resolve => setImmediate(resolve)); assert.ok(neo.hero); assert.ok(hostess.hero);
    const center = FILM_SETS.film_oracle_home.center, place = oracleReceptionRoot({ phase: 'inviting', progress: 0, elapsed: 1 });
    neo.root.position.set(center.x + SPOON_LESSON.neo.x, center.y - 1, center.z + SPOON_LESSON.neo.z); neo.root.rotation.y = SPOON_LESSON.neo.yaw;
    hostess.root.position.set(center.x + place.x, center.y - 1, center.z + place.z); hostess.root.rotation.y = place.yaw;
    const input = { speed: 0, grounded: true, verticalVelocity: 0, turn: 0, glasses: false };
    models.animate(neo, 0, { ...input, spoonLesson: { phase: 'understood', elapsed: 0, role: 'neo' } }, 4);
    neo.root.updateWorldMatrix(true, true);
    const target = neo.hero.bones.get('shoulder_R')!.localToWorld(new THREE.Vector3(0, -.12, .07));
    models.animate(hostess, 0, { ...input, oracleReception: { phase: 'inviting', progress: 0, elapsed: 1.5, seated: true, target } }, 4);
    hostess.root.updateWorldMatrix(true, true);
    const palm = hostess.hero.bones.get('wrist_R')!.localToWorld(new THREE.Vector3(0, -.19, .035));
    assert.ok(palm.distanceTo(target) < .065, `the hostess hand must touch Neo instead of hovering beside him: ${JSON.stringify({ gap: palm.distanceTo(target), palm: palm.toArray(), target: target.toArray(), shoulder: hostess.hero.bones.get('shoulder_R')!.getWorldPosition(new THREE.Vector3()).toArray(), elbow: hostess.hero.bones.get('elbow_R')!.position.toArray(), wrist: hostess.hero.bones.get('wrist_R')!.position.toArray(), scale: hostess.hero.bones.get('wrist_R')!.getWorldScale(new THREE.Vector3()).toArray() })}`);
    for (const part of hostess.hero.wardrobe) {
      const mesh = part.mesh; if (!mesh.visible || Array.isArray(mesh.material)) continue;
      if (/Coat|Trousers/.test(mesh.material.name)) assert.ok((mesh.material as THREE.MeshStandardMaterial).color.r > .6, 'staff wears white cotton rather than the borrowed dark outfit');
      const point = new THREE.Vector3();
      for (let i = 0; i < mesh.geometry.attributes.position.count; i++) {
        mesh.getVertexPosition(i, point); mesh.localToWorld(point);
        assert.ok(point.y >= center.y - 1 - .02, `${mesh.name} penetrates the floor during the shoulder touch: ${point.y}`);
      }
    }
    for (const id of ['morpheus', 'oracle_attendant'] as const) {
      const actor = models.create(world.agents.get(id)!); await new Promise(resolve => setImmediate(resolve)); assert.ok(actor.hero);
      models.animate(actor, 0, { ...input, seated: true, oracleWaiting: { kind: 'watching', elapsed: 0 } }, 4); actor.root.updateWorldMatrix(true, true);
      let lowest = Infinity, sole = Infinity;
      for (const part of actor.hero.wardrobe) {
        const mesh = part.mesh; if (!mesh.visible || Array.isArray(mesh.material)) continue;
        const point = new THREE.Vector3();
        for (let i = 0; i < mesh.geometry.attributes.position.count; i++) {
          mesh.getVertexPosition(i, point); mesh.localToWorld(point); actor.root.worldToLocal(point);
          assert.ok(point.y >= -.02, `${id} ${mesh.material.name} must stay above the room floor: ${point.y}`);
          if (mesh.material.name === 'Trousers' && Math.abs(point.x) < .5 && point.z > -.4 && point.z < .05) lowest = Math.min(lowest, point.y);
          if (mesh.material.name === 'Boot leather') sole = Math.min(sole, point.y);
        }
      }
      assert.ok(lowest >= 1.60 && lowest <= 1.75, `${id} hips must rest on the 1.65-high sofa cushion instead of sinking through or floating above it: ${lowest}`);
      assert.ok(sole <= .14, `${id} feet must stay grounded after lifting his hips onto the sofa: ${sole}`);
    }
  } finally { models.dispose(); globalThis.document = document; }
});

test('the other potentials keep seated legs above the rug when a paused room loads', t => {
  t.mock.method(THREE.TextureLoader.prototype, 'load', () => new THREE.Texture());
  const document = globalThis.document;
  globalThis.document = { createElement: () => ({ getContext: () => ({ createImageData: (w: number, h: number) => ({ data: new Uint8ClampedArray(w * h * 4) }), putImageData() {} }) }) } as unknown as Document;
  const world = new WorldState(); new AgentManager(world).initializeAllAgents(); const models = new CharacterModels();
  try {
    for (const [id, pose] of Object.entries(ORACLE_WAITING_CAST).filter(([id]) => id.startsWith('potential_'))) {
      const rig = models.create(world.agents.get(id)!);
      models.animate(rig, 0, { speed: 0, grounded: true, verticalVelocity: 0, turn: 0, seated: true, floorSeated: true, oracleWaiting: { kind: pose.kind, elapsed: 1.5 } }, 4);
      rig.root.updateWorldMatrix(true, true);
      for (const hip of rig.hips) hip.traverse(object => {
        if (!(object instanceof THREE.Mesh)) return;
        const point = new THREE.Vector3();
        for (let i = 0; i < object.geometry.attributes.position.count; i++) {
          object.getVertexPosition(i, point); object.localToWorld(point);
          assert.ok(point.y >= .035, `${id} shoe / shin penetrates the floor after loading: ${point.y}`);
        }
      });
    }
  } finally { models.dispose(); globalThis.document = document; }
});
