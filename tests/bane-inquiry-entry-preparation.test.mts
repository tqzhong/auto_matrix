import assert from 'node:assert/strict';
import test, { type TestContext } from 'node:test';
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { FILM_SCENE_BY_ID, filmEntry, newOracleAbsorption, newBaneInquiry, type FilmJourney, type SandboxState } from '@auto_matrix/shared';
import { FilmSetRenderer } from '../packages/client/src/engine/FilmSetRenderer.js';
import { LightCulling } from '../packages/client/src/engine/LightCulling.js';
import { WorldOcclusionPass } from '../packages/client/src/engine/PostProcessing.js';
import { AgentRenderer } from '../packages/client/src/agents/AgentRenderer.js';
import { AgentManager } from '../packages/server/src/agents/AgentManager.js';
import { WorldState } from '../packages/server/src/world/WorldState.js';

function canvas(t: TestContext) {
  const previous = globalThis.document;
  const context = { fillRect() {}, strokeRect() {}, fillText() {}, beginPath() {}, moveTo() {}, lineTo() {}, closePath() {}, stroke() {}, fill() {}, ellipse() {},
    createLinearGradient: () => ({ addColorStop() {} }), createRadialGradient: () => ({ addColorStop() {} }),
    createImageData: (width: number, height: number) => ({ data: new Uint8ClampedArray(width * height * 4) }), putImageData() {} };
  globalThis.document = { createElement: () => ({ width: 0, height: 0, getContext: () => context }) } as unknown as Document;
  t.after(() => { globalThis.document = previous; });
  t.mock.method(THREE.TextureLoader.prototype, 'load', () => new THREE.Texture({ width: 1, complete: true }));
  t.mock.method(GLTFLoader.prototype, 'loadAsync', () => new Promise(() => {}));
}

for (const resume of [false, true]) test(`${resume ? 'saved' : 'live'} Oracle confrontation prepares and adopts the actual Hammer interview and its late medical models`, t => {
  canvas(t);
  const scene = new THREE.Scene(), sets = new FilmSetRenderer(scene), camera = new THREE.PerspectiveCamera();
  const world = new WorldState(); new AgentManager(world).initializeAllAgents();
  const source = FILM_SCENE_BY_ID.m3_oracle_absorbed, next = FILM_SCENE_BY_ID.m3_bane_questions, oracle = world.agents.get('oracle')!;
  Object.assign(oracle, { position: filmEntry(source), currentLocation: source.set, isInMatrix: true });
  const journey: FilmJourney = { version: 1, scene: source.id, actor: oracle.id, step: 2, completed: [], enteredAt: 0,
    reflections: {}, lastText: '', checkpoint: { ...oracle.position }, oracleAbsorption: newOracleAbsorption(2, 999) };
  const sandbox = { neoLife: { journey } } as SandboxState;
  if (!resume) sets.update(oracle, sandbox, 0);
  const geometry = new THREE.BoxGeometry(), faceGeometry = geometry.clone(), material = new THREE.MeshStandardMaterial();
  faceGeometry.morphAttributes.position = [faceGeometry.attributes.position.clone()]; faceGeometry.morphTargetsRelative = true;
  const cast = new Map<string, THREE.Group>(), heads: THREE.Mesh[] = [], arriving: { group: THREE.Group; head: THREE.Group; body: THREE.Group; fallback: THREE.Mesh }[] = [];
  for (const id of [next.actor, ...next.cast]) {
    const group = new THREE.Group(), head = new THREE.Mesh(faceGeometry, material), body = new THREE.SkinnedMesh(geometry, material);
    head.name = `${id}-anatomical-head`; head.castShadow = body.castShadow = true; head.updateMorphTargets(); group.visible = false;
    if (id === 'roland' || id === 'maggie') {
      const headRoot = new THREE.Group(), bodyRoot = new THREE.Group(), fallback = new THREE.Mesh(geometry, material);
      headRoot.name = `${id}-detailed-head`; bodyRoot.name = `${id}-detailed-body`; headRoot.add(head); bodyRoot.add(body); group.add(fallback);
      arriving.push({ group, head: headRoot, body: bodyRoot, fallback });
    } else group.add(head, body);
    cast.set(id, group); heads.push(head);
  }
  const colors = new Set<THREE.Object3D>(), normals = new Set<THREE.Object3D>(), depths = new Set<THREE.BufferGeometry>(), layouts = new Set<number>();
  const graphics = { extensions: { has: () => true }, info: { programs: [] }, properties: { get: () => ({}) },
    shadowMap: { enabled: true, type: THREE.PCFSoftShadowMap }, getRenderTarget: () => null, setRenderTarget() {}, initTexture() {},
    compile(subject: THREE.Object3D, _camera: THREE.Camera, target: THREE.Scene) {
      let points = 0; target.traverseVisible(object => { if (object instanceof THREE.PointLight) points++; });
      subject.traverse(object => {
        if (!(object instanceof THREE.Mesh)) return;
        if (object.material instanceof THREE.MeshNormalMaterial) normals.add(object);
        else if (object.material instanceof THREE.MeshDepthMaterial) depths.add(object.geometry);
        else { colors.add(object); layouts.add(points); }
      });
    } } as unknown as THREE.WebGLRenderer;
  const lighting = new LightCulling(scene), occlusion = new WorldOcclusionPass(scene, camera, 1280, 720);
  const prepare = () => {
    sets.prepareSecondOracle(graphics, camera, journey, id => cast.get(id), resume, undefined, id => ({ model: cast.get(id) }), lighting);
    occlusion.prepareNormals(graphics, sets.root, sets.secondOracleEntryNormalMeshes, true);
  };
  t.after(() => { sets.dispose(); lighting.dispose(); occlusion.dispose(); geometry.dispose(); faceGeometry.dispose(); material.dispose(); });
  prepare(); assert.equal(sets['preparedSecondOracle'], undefined, 'the farewell cannot allocate the later investigation');
  journey.step = 3; const saved = JSON.stringify(journey);
  for (let frame = 0; frame < 100; frame++) prepare();
  assert.ok(sets['preparedSecondOracle'], 'prepare Hammer while Smith approaches, before the actor handoff');
  for (const { group } of arriving) assert.equal(sets['preparedSecondOracle']!.colors?.actors.has(group), false, 'a fallback cannot mark a late medical model ready');
  for (const { group, head, body, fallback } of arriving) { fallback.visible = false; group.add(head, body); }
  for (let frame = 0; frame < 400; frame++) prepare();
  const room = sets['preparedSecondOracle']!.room, mess = room.root.getObjectByName('hammer-mess-interview'), prelude = room.root.getObjectByName('revolutions-prelude-m3_bane_questions');
  assert.ok(mess && prelude, 'prepare both the actual mess room and its live lighting');
  assert.ok(colors.has(mess.getObjectByName('report-page-vdt')!), 'the physical report must be prepared before first use');
  assert.ok(heads.every(head => colors.has(head) && normals.has(head)), 'late plain morphed heads need both color and AO variants');
  assert.ok(depths.has(faceGeometry), 'late medical faces need their real shadow variant');
  assert.ok([...cast.values()].every(group => !group.visible)); assert.equal(JSON.stringify(journey), saved);
  Object.assign(journey, { scene: next.id, actor: next.actor, step: 0, baneInquiry: newBaneInquiry(0, 100) });
  const roland = world.agents.get('roland')!; Object.assign(roland, { position: filmEntry(next), currentLocation: next.set, isInMatrix: false });
  sets.update(roland, sandbox, 1);
  assert.equal(sets['baneInquiry']!.root, mess, 'adopt the prepared report and room instead of rebuilding it');
  assert.equal(sets.root.getObjectsByProperty('name', mess.name).length, 1);
  assert.equal(sets.root.getObjectByName(prelude.name), prelude);
  assert.equal(sets.stablePointSlots, true);
  let points = 0; scene.traverseVisible(object => { if (object instanceof THREE.PointLight) points++; });
  assert.ok(points > 0 && layouts.has(points), 'prepared programs must match the adopted point-light layout');
});

test('the distant Hammer medical models load during the Oracle confrontation without changing world state or other players', t => {
  canvas(t);
  const renderer = new AgentRenderer(new THREE.Scene()), world = new WorldState(); new AgentManager(world).initializeAllAgents();
  t.after(() => renderer.dispose()); t.mock.method(renderer['models'], 'requestHero', () => {});
  const source = FILM_SCENE_BY_ID.m3_oracle_absorbed, next = FILM_SCENE_BY_ID.m3_bane_questions;
  Object.assign(world.agents.get('oracle')!, { position: filmEntry(source), currentLocation: source.set, isInMatrix: true });
  for (const id of [next.actor, ...next.cast]) Object.assign(world.agents.get(id)!, { position: filmEntry(next), currentLocation: next.set, isInMatrix: false });
  for (const [id, actor] of world.agents) renderer.updateAgent(id, actor);
  renderer.setWorld(true); renderer.setPlayer('oracle'); const camera = new THREE.PerspectiveCamera(); camera.position.copy(world.agents.get('oracle')!.position);
  const requested = new Map<string, { prepare?: boolean; distance: number }>();
  t.mock.method(renderer['models'], 'animate', (rig, _delta, input, distance) => {
    const id = [...renderer['agents']].find(([, entry]) => entry.rig === rig)![0]; requested.set(id, { prepare: input.prepareDetailedCast, distance });
  });
  const journey: FilmJourney = { version: 1, scene: source.id, actor: source.actor, step: 2, completed: [], enteredAt: 0,
    reflections: {}, lastText: '', checkpoint: filmEntry(source), oracleAbsorption: newOracleAbsorption(2, 999) };
  const saved = JSON.stringify([...world.agents]);
  renderer.update(.02, camera, 1, 0, journey);
  for (const id of ['roland', 'maggie']) assert.ok(!requested.get(id)?.prepare);
  journey.step = 3; renderer.update(.02, camera, 1, 0, journey);
  for (const id of ['roland', 'maggie']) {
    assert.equal(requested.get(id)?.prepare, true, id); assert.ok(requested.get(id)!.distance > 100);
    assert.equal(renderer.getAgent(id)!.visible, false, 'future real-world participants stay hidden in the Oracle viewpoint');
  }
  journey.visiting = source.id; renderer.update(.02, camera, 1, 0, journey);
  for (const id of ['roland', 'maggie']) assert.ok(!requested.get(id)?.prepare);
  delete journey.visiting; renderer.setPlayer('neo'); renderer.update(.02, camera, 1, 0, journey);
  for (const id of ['roland', 'maggie']) assert.ok(!requested.get(id)?.prepare);
  assert.equal(JSON.stringify([...world.agents]), saved);
});
