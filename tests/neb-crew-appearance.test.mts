import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { FILM_SETS, type FilmJourney } from '@auto_matrix/shared';
import { AgentRenderer } from '../packages/client/src/agents/AgentRenderer.js';
import { HeroModels } from '../packages/client/src/agents/HeroModel.js';
import { advanceMotion, newMotion, type MotionInput } from '../packages/client/src/agents/CharacterMotion.js';
import { WorldState } from '../packages/server/src/world/WorldState.js';
import { AgentManager } from '../packages/server/src/agents/AgentManager.js';

async function geometry(id: string) {
  const glb = await readFile(new URL(`../packages/client/public/assets/characters/${id}.glb`, import.meta.url));
  const length = glb.readUInt32LE(12), document = JSON.parse(glb.subarray(20, 20 + length).toString());
  for (const material of document.materials) { delete material.pbrMetallicRoughness.baseColorTexture; delete material.normalTexture; }
  document.images = []; document.textures = [];
  const json = Buffer.from(JSON.stringify(document)), padded = Buffer.alloc(Math.ceil(json.length / 4) * 4, 32); json.copy(padded);
  const bin = glb.subarray(20 + length), result = Buffer.alloc(20 + padded.length + bin.length);
  result.writeUInt32LE(0x46546c67, 0); result.writeUInt32LE(2, 4); result.writeUInt32LE(result.length, 8);
  result.writeUInt32LE(padded.length, 12); result.writeUInt32LE(0x4e4f534a, 16); padded.copy(result, 20); bin.copy(result, 20 + padded.length);
  return new GLTFLoader().parseAsync(result.buffer.slice(result.byteOffset, result.byteOffset + result.byteLength), '');
}

test('the first-film Sentinel crew retain their ship clothes in free play, saved phases and both player views', async t => {
  const roles = ['neo', 'morpheus', 'trinity'] as const, ids = [...roles, 'neo-office', 'neo-tracking', 'trinity-club'];
  const assets = await Promise.all(ids.map(geometry));
  t.mock.method(THREE.TextureLoader.prototype, 'load', () => new THREE.Texture());
  t.mock.method(GLTFLoader.prototype, 'loadAsync', async (url: string) => assets[ids.indexOf(url.split('/').at(-1)!.replace('.glb', ''))]);
  const originalDocument = globalThis.document;
  const context = { createRadialGradient: () => ({ addColorStop() {} }), fillRect() {}, strokeRect() {}, fillText() {},
    createImageData: (width: number, height: number) => ({ data: new Uint8ClampedArray(width * height * 4) }), putImageData() {} };
  globalThis.document = { createElement: () => ({ width: 0, height: 0, getContext: () => context }) } as unknown as Document;
  const world = new WorldState(); new AgentManager(world).initializeAllAgents();
  const renderer = new AgentRenderer(new THREE.Scene());
  t.after(() => { renderer.dispose(); globalThis.document = originalDocument; });
  for (const role of roles) {
    const actor = world.agents.get(role)!; actor.currentLocation = 'film_service_tunnels'; actor.isInMatrix = false;
    actor.position = { ...FILM_SETS.film_service_tunnels.center }; actor.currentAction = null;
    renderer.updateAgent(role, actor);
  }
  renderer.setWorld(false); await new Promise(resolve => setImmediate(resolve));
  const journey: FilmJourney = { version: 1, scene: 'm1_sentinels', actor: 'neo', step: 0, completed: [], enteredAt: 0,
    reflections: {}, lastText: '', checkpoint: { ...world.agents.get('neo')!.position } };
  for (const phase of ['ready', 'shutdown', 'sweep', 'done'] as const) {
    journey.sentinel = { phase, elapsed: phase === 'shutdown' ? 1.4 : 0, noise: 0, attempt: 0 };
    for (const player of [null, ...roles]) for (const firstPerson of [false, true]) {
      renderer.setPlayer(player, firstPerson); renderer.update(0, undefined, 0, 0, structuredClone(journey));
      for (const role of roles) {
        const body = renderer.getAgentBody(role)!, knit: THREE.Mesh[] = [], matrix: THREE.Mesh[] = [], hair: THREE.Mesh[] = [];
        assert.ok(body.getObjectByName('pelvis'), `${role}: inspect the delivered rig rather than the temporary fallback`);
        body.traverse(object => {
          if (!(object instanceof THREE.Mesh)) return;
          if (role === 'morpheus' ? object.userData.hammerBriefingCostume : object.userData.logosCostume) knit.push(object);
          if (/Tailored.coat.upper|Black.crew.neck|Fitted.leather.jacket/i.test(object.name)) matrix.push(object);
          if (/Hair|hair|Groom|groom/.test((object.material as THREE.Material).name)) hair.push(object);
        });
        assert.ok(knit.length && knit.every(part => part.visible), `${phase}/${player}/${firstPerson}: ${role} must wear the real ship knit`);
        assert.ok(matrix.length && matrix.every(part => !part.visible), `${role}: no recolored Matrix coat under the knit`);
        if (role === 'neo') {
          assert.ok(hair.length && hair.every(part => !part.visible), 'the first-film real body is shaved');
          assert.equal(body.getObjectByName('neo-farewell-eye-band')!.visible, false, 'the later injury cannot leak into the first film');
        }
      }
    }
  }
  renderer.setPlayer(null); journey.scene = 'm2_stop_sentinels'; renderer.update(0, undefined, 0, 0, journey);
  const hair: THREE.Mesh[] = []; renderer.getAgentBody('neo')!.traverse(object => {
    if (object instanceof THREE.Mesh && /Hair|hair|Groom|groom/.test((object.material as THREE.Material).name)) hair.push(object);
  });
  assert.ok(hair.every(part => part.visible), 'the later tunnel scene keeps Neo’s grown hair');
  journey.scene = 'm1_pill_choice'; renderer.setWorld(true);
  for (const role of roles) {
    const actor = world.agents.get(role)!; actor.currentLocation = 'film_lafayette'; actor.isInMatrix = true;
    renderer.updateAgent(role, actor);
  }
  renderer.update(0, undefined, 0, 0, journey);
  for (const role of roles) renderer.getAgentBody(role)!.traverse(object => {
    if (object instanceof THREE.Mesh && (object.userData.hammerBriefingCostume || object.userData.logosCostume))
      assert.equal(object.visible, false, 'leaving the ship restores the Matrix wardrobe');
  });
});

test('Neo has his grown hair and unbandaged knit costume at the ship loss, with recovery and Matrix clothing restored on leaving', async t => {
  const ids = ['neo', 'neo-office', 'neo-tracking'], assets = await Promise.all(ids.map(geometry));
  t.mock.method(THREE.TextureLoader.prototype, 'load', () => new THREE.Texture());
  t.mock.method(GLTFLoader.prototype, 'loadAsync', async (url: string) => assets[ids.indexOf(url.split('/').at(-1)!.replace('.glb', ''))]);
  const originalDocument = globalThis.document;
  const context = { createRadialGradient: () => ({ addColorStop() {} }), fillRect() {}, strokeRect() {}, fillText() {},
    createImageData: (width: number, height: number) => ({ data: new Uint8ClampedArray(width * height * 4) }), putImageData() {} };
  globalThis.document = { createElement: () => ({ width: 0, height: 0, getContext: () => context }) } as unknown as Document;
  const world = new WorldState(); new AgentManager(world).initializeAllAgents();
  const renderer = new AgentRenderer(new THREE.Scene());
  t.after(() => { renderer.dispose(); globalThis.document = originalDocument; });
  const neo = world.agents.get('neo')!; neo.currentLocation = 'film_neb_deck'; neo.isInMatrix = false;
  neo.position = { ...FILM_SETS.film_neb_deck.center }; neo.currentAction = null;
  const journey: FilmJourney = { version: 1, scene: 'm2_ship_lost', actor: 'neo', step: 3, completed: [], enteredAt: 0,
    reflections: {}, lastText: '', checkpoint: neo.position, shipLoss: { phase: 'evacuating', remaining: 30, lastTick: 0, attempts: 0, age: 2 } };
  renderer.setWorld(false); renderer.updateAgent('neo', neo);
  await new Promise(resolve => setImmediate(resolve));
  const body = renderer.getAgentBody('neo')!, hair: THREE.Mesh[] = [];
  body.traverse(object => { if (object instanceof THREE.Mesh && /Hair|hair|Groom|groom/.test((object.material as THREE.Material).name)) hair.push(object); });
  assert.ok(body.getObjectByName('pelvis'), 'the delivered Neo skeleton must finish loading');
  assert.ok(hair.length >= 2, `use the delivered scalp and hair meshes: ${hair.map(part => part.name).join(', ')}`);
  const shirt = body.getObjectByName('neo-logos-sweater') as THREE.Mesh<THREE.BufferGeometry, THREE.MeshStandardMaterial>;
  const matrixShirt = body.getObjectByName('Black_crew_neck') as THREE.Mesh<THREE.BufferGeometry, THREE.MeshStandardMaterial>;
  const originalBump = matrixShirt.material.bumpMap;
  const band = body.getObjectByName('neo-farewell-eye-band')!;
  const coatTail = body.getObjectByName('neo-coat-panel');
  renderer.update(0, undefined, 0, 0, journey);
  assert.ok(hair.every(part => part.visible), 'the second-film ship scene must not inherit the shaved awakening appearance');
  assert.equal(band.visible, false, 'Neo is not yet blind in the second film');
  assert.equal(shirt.material.bumpMap?.name, 'neo-farewell-knit');
  assert.equal(shirt.material.color.getHex(), 0x393c3a);
  assert.equal(shirt.visible, true); assert.equal(matrixShirt.visible, false);
  if (coatTail) assert.equal(coatTail.visible, false);

  journey.scene = 'm1_recovery'; journey.shipLoss = undefined;
  renderer.update(0, undefined, 0, 0, journey);
  assert.ok(hair.every(part => !part.visible), 'the first-film real body remains shaved');
  assert.equal(band.visible, false);
  assert.equal(shirt.visible, false);
  assert.equal(matrixShirt.material.bumpMap, originalBump);

  journey.scene = 'm3_farewell'; neo.currentLocation = 'film_logos_wreck'; renderer.updateAgent('neo', neo);
  renderer.update(0, undefined, 0, 0, journey);
  assert.ok(hair.every(part => part.visible)); assert.equal(band.visible, true, 'the later injury still requires its bandage');

  journey.scene = 'm1_dojo'; neo.currentLocation = 'film_kungfu_dojo'; neo.isInMatrix = true; renderer.setWorld(true); renderer.updateAgent('neo', neo);
  renderer.update(0, undefined, 0, 0, journey);
  assert.ok(hair.every(part => part.visible)); assert.equal(band.visible, false);
  assert.equal(shirt.visible, false); assert.equal(matrixShirt.visible, true);
  assert.equal(matrixShirt.material.bumpMap, originalBump, 'Matrix clothing must retain its original texture');
});

test('the saved first-film cabin and its escort select the actual knit outfits for Neo and Morpheus', async t => {
  const ids = ['neo', 'neo-office', 'neo-tracking', 'morpheus'], assets = await Promise.all(ids.map(geometry));
  t.mock.method(THREE.TextureLoader.prototype, 'load', () => new THREE.Texture());
  t.mock.method(GLTFLoader.prototype, 'loadAsync', async (url: string) => assets[ids.indexOf(url.split('/').at(-1)!.replace('.glb', ''))]);
  const originalDocument = globalThis.document;
  const context = { createRadialGradient: () => ({ addColorStop() {} }), fillRect() {}, strokeRect() {}, fillText() {},
    createImageData: (width: number, height: number) => ({ data: new Uint8ClampedArray(width * height * 4) }), putImageData() {} };
  globalThis.document = { createElement: () => ({ width: 0, height: 0, getContext: () => context }) } as unknown as Document;
  const world = new WorldState(); new AgentManager(world).initializeAllAgents();
  const renderer = new AgentRenderer(new THREE.Scene());
  t.after(() => { renderer.dispose(); globalThis.document = originalDocument; });
  for (const id of ['neo', 'morpheus']) {
    const actor = world.agents.get(id)!;
    actor.currentLocation = 'film_neb_deck'; actor.isInMatrix = false;
    actor.position = { ...FILM_SETS.film_neb_deck.center }; actor.currentAction = null;
    renderer.updateAgent(id, actor);
  }
  renderer.setWorld(false); await new Promise(resolve => setImmediate(resolve));
  const journey: FilmJourney = { version: 1, scene: 'm1_cabin', actor: 'neo', step: 0, completed: [], enteredAt: 0,
    reflections: {}, lastText: '', checkpoint: { ...world.agents.get('neo')!.position }, awakening: { kind: 'cabin', elapsed: 6, started: true } };
  for (const firstPerson of [false, true]) for (const step of [0, 1, 2]) {
    journey.step = step; renderer.setPlayer('neo', firstPerson); renderer.update(0, undefined, 0, 0, journey);
    for (const role of ['neo', 'morpheus'] as const) {
      const body = renderer.getAgentBody(role)!, sweater = body.getObjectByName(`${role}-${role === 'neo' ? 'logos' : 'hammer'}-sweater`) as THREE.Mesh;
      assert.equal(sweater.visible, true, `${role}/${step}: the production renderer must choose the knit, not only a direct model fixture`);
      const old: THREE.Mesh[] = [], hair: THREE.Mesh[] = [];
      body.traverse(object => {
        if (!(object instanceof THREE.Mesh)) return;
        if (/Tailored.coat.upper|Black.crew.neck/i.test(object.name)) old.push(object);
        if (/Hair|hair|Groom|groom/.test((object.material as THREE.Material).name)) hair.push(object);
      });
      assert.ok(old.length && old.every(part => !part.visible));
      if (role === 'neo') assert.ok(hair.length && hair.every(part => !part.visible), 'the first-film scalp must not grow the later crew hairstyle');
    }
  }
  journey.scene = 'm2_ship_lost'; journey.awakening = undefined;
  renderer.setPlayer(null); renderer.update(0, undefined, 0, 0, journey);
  const neo = renderer.getAgentBody('neo')!, hair: THREE.Mesh[] = [];
  neo.traverse(object => { if (object instanceof THREE.Mesh && /Hair|hair|Groom|groom/.test((object.material as THREE.Material).name)) hair.push(object); });
  assert.ok(hair.every(part => part.visible), 'the early-film flag must clear in the later crew scene');
});

test('Morpheus wears his short suit and olive tie in both lesson spaces, including free possession, and restores ship and Matrix outfits', async t => {
  const asset = await geometry('morpheus');
  t.mock.method(THREE.TextureLoader.prototype, 'load', () => new THREE.Texture());
  t.mock.method(GLTFLoader.prototype, 'loadAsync', async () => asset);
  const originalDocument = globalThis.document;
  const context = { createRadialGradient: () => ({ addColorStop() {} }), fillRect() {}, strokeRect() {}, fillText() {},
    createImageData: (width: number, height: number) => ({ data: new Uint8ClampedArray(width * height * 4) }), putImageData() {} };
  globalThis.document = { createElement: () => ({ width: 0, height: 0, getContext: () => context }) } as unknown as Document;
  const world = new WorldState(); new AgentManager(world).initializeAllAgents();
  const renderer = new AgentRenderer(new THREE.Scene());
  t.after(() => { renderer.dispose(); globalThis.document = originalDocument; });
  const actor = world.agents.get('morpheus')!; actor.currentLocation = 'film_white_construct'; actor.isInMatrix = false;
  actor.position = { ...FILM_SETS.film_white_construct.center }; actor.currentAction = null;
  renderer.setWorld(false); renderer.updateAgent(actor.id, actor); await new Promise(resolve => setImmediate(resolve));
  const body = renderer.getAgentBody(actor.id)!, jacket = body.getObjectByName('Tailored_coat_upper') as THREE.Mesh<THREE.BufferGeometry, THREE.MeshStandardMaterial>;
  const tails = body.getObjectByName('pelvis')!.children.filter(part => part instanceof THREE.Mesh);
  assert.ok(tails.length, 'inspect the delivered pelvis-mounted coat surfaces');
  const leatherRoughness = jacket.material.roughness;
  const journey: FilmJourney = { version: 1, scene: 'm1_construct', actor: 'neo', step: 0, completed: [], enteredAt: 0,
    reflections: {}, lastText: '', checkpoint: actor.position };
  for (const [scene, location] of [['m1_construct', 'film_white_construct'], ['m1_desert', 'film_real_desert'], ['m1_truth_exit', 'film_white_construct']] as const) {
    journey.scene = scene; actor.currentLocation = location; actor.position = { ...FILM_SETS[location].center };
    for (const player of [null, 'morpheus']) {
      if (player) {
        actor.controller = undefined;
        actor.currentAction = { type: 'wait', parameters: { seated: true, reveal: { kind: scene === 'm1_desert' ? 'desert' : 'construct', role: 'morpheus', elapsed: 3, started: true } },
          startedAt: 0, duration: 1, progress: 0 };
        renderer.updateAgent(actor.id, actor); renderer.setPlayer(null); renderer.update(0, undefined, 0, 0, journey);
        actor.currentAction = null;
      }
      actor.controller = player ? 'player' : undefined; renderer.updateAgent(actor.id, actor); renderer.setPlayer(player);
      renderer.update(0, undefined, 0, 0, journey);
      const tie = body.getObjectByName('morpheus-construct-tie') as THREE.SkinnedMesh<THREE.BufferGeometry, THREE.MeshStandardMaterial>;
      const vest = body.getObjectByName('morpheus-construct-waistcoat') as THREE.SkinnedMesh;
      assert.ok(tie?.visible && vest?.visible, `${scene}/${player}: use the same suit during the lecture and ordinary player movement`);
      assert.ok(tie.isSkinnedMesh && vest.isSkinnedMesh, 'the cloth must follow the delivered body, rather than float as a chest-mounted badge');
      assert.ok(tie.material.color.g > tie.material.color.r && tie.material.color.r > tie.material.color.b, 'the film tie is olive, not a black stock neck strip');
      assert.ok(jacket.material.roughness >= .8 && jacket.visible, 'the short jacket is matte tailoring rather than a leather raincoat');
      assert.ok(tails.every(part => !part.visible), 'the lesson suit has no long coat tails');
      if (player) assert.ok(body.worldToLocal(body.getObjectByName('head')!.getWorldPosition(new THREE.Vector3())).y > 3.8,
        'paused free possession must release the old seated body, rather than leave Morpheus crouched in mid-air');
    }
  }
  actor.controller = undefined; renderer.setPlayer(null); journey.scene = 'm1_cabin'; actor.currentLocation = 'film_neb_deck';
  actor.position = { ...FILM_SETS.film_neb_deck.center }; renderer.updateAgent(actor.id, actor); renderer.update(0, undefined, 0, 0, journey);
  assert.equal(body.getObjectByName('morpheus-construct-tie')!.visible, false);
  assert.equal(body.getObjectByName('morpheus-hammer-sweater')!.visible, true, 'returning to the actual ship restores its knit clothes');
  journey.scene = 'm1_pill_choice'; actor.currentLocation = 'film_lafayette'; actor.isInMatrix = true;
  actor.position = { ...FILM_SETS.film_lafayette.center }; renderer.setWorld(true); renderer.updateAgent(actor.id, actor); renderer.update(0, undefined, 0, 0, journey);
  assert.equal(body.getObjectByName('morpheus-construct-waistcoat')!.visible, false);
  assert.ok(tails.every(part => part.visible));
  assert.equal(jacket.material.roughness, leatherRoughness, 'the lesson material cannot leak into the original Matrix leather coat');
});

test('the delivered Morpheus suit keeps its tie and collar outside the torso through both seated lessons', async () => {
  const asset = await geometry('morpheus'), models = new HeroModels(new THREE.Texture(), new THREE.Texture());
  (models as unknown as { load: () => Promise<typeof asset> }).load = async () => asset;
  try {
    const rig = (await models.create('morpheus'))!;
    const tie = rig.root.getObjectByName('morpheus-construct-tie') as THREE.SkinnedMesh;
    const collar = rig.root.getObjectByName('morpheus-construct-collar') as THREE.SkinnedMesh;
    const targets = ['Black_crew_neck', 'Tailored_coat_upper', 'morpheus-construct-waistcoat'].map(name => rig.root.getObjectByName(name) as THREE.SkinnedMesh);
    for (const kind of ['construct', 'desert'] as const) for (const elapsed of [0, 3.8, 8, 12.5]) {
      const input: MotionInput = { speed: 0, grounded: true, verticalVelocity: 0, turn: 0, constructSuit: true,
        performance: kind, reveal: { kind, role: 'morpheus', elapsed, started: true } };
      const motion = newMotion(); models.animate(rig, advanceMotion(motion, input, 0), motion, input, 0);
      rig.root.updateMatrixWorld(true); for (const mesh of [tie, collar, ...targets]) mesh.skeleton.update();
      const front = new THREE.Vector3(0, 0, 1).applyQuaternion(rig.bones.get('chest')!.getWorldQuaternion(new THREE.Quaternion()));
      const samples = [2, 8, 12].map(row => tie.localToWorld(tie.getVertexPosition(row * 7 + 3, new THREE.Vector3())));
      for (const start of [0, 49]) samples.push(collar.localToWorld([23, 30, 24].reduce((p, i) =>
        p.add(collar.getVertexPosition(start + i, new THREE.Vector3())), new THREE.Vector3()).multiplyScalar(1 / 3)));
      for (const [sample, point] of samples.entries()) {
        const hit = new THREE.Raycaster(point.clone().addScaledVector(front, .1), front.clone().negate(), 0, .2).intersectObjects(targets)[0];
        assert.ok(hit && hit.distance >= .098 && hit.distance <= .18,
          `${kind}/${elapsed}/${sample}: the visible cloth must clear its actual skinned shirt/vest without hovering: ${hit?.distance}; point ${point.toArray()}; wider ray ${new THREE.Raycaster(point.clone().addScaledVector(front, .1), front.clone().negate(), 0, 3).intersectObjects(targets)[0]?.distance}`);
      }
    }
  } finally { models.dispose(); }
});
