import assert from 'node:assert/strict';
import test, { type TestContext } from 'node:test';
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { FILM_SCENE_BY_ID, filmEntry, filmPosition, newOracleAbsorption, type FilmJourney, type SandboxState } from '@auto_matrix/shared';
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

for (const resume of [false, true]) test(`${resume ? 'saved' : 'live'} Oracle departure prepares the next viewpoint's props, four actors and render passes`, t => {
  canvas(t);
  const scene = new THREE.Scene(), sets = new FilmSetRenderer(scene), camera = new THREE.PerspectiveCamera();
  const world = new WorldState(); new AgentManager(world).initializeAllAgents(); const neo = world.agents.get('neo')!;
  const source = FILM_SCENE_BY_ID.m3_oracle_last, next = FILM_SCENE_BY_ID.m3_oracle_absorbed;
  Object.assign(neo, { position: filmEntry(source), currentLocation: source.set, isInMatrix: true });
  const journey: FilmJourney = { version: 1, scene: source.id, actor: neo.id, step: 3, completed: [], enteredAt: 0,
    reflections: {}, lastText: '', checkpoint: { ...neo.position } };
  const sandbox = { neoLife: { journey } } as SandboxState;
  if (!resume) sets.update(neo, sandbox, 0);
  const geometry = new THREE.BoxGeometry(), faceGeometry = geometry.clone(), material = new THREE.MeshStandardMaterial();
  faceGeometry.morphAttributes.position = [faceGeometry.attributes.position.clone()]; faceGeometry.morphTargetsRelative = true;
  const cast = new Map<string, THREE.Group>(), heads: THREE.Mesh[] = [], arriving: { group: THREE.Group; head: THREE.Group; body: THREE.Group; fallback: THREE.Mesh }[] = [];
  for (const id of [next.actor, ...next.cast]) {
    const group = new THREE.Group(), head = new THREE.Mesh(faceGeometry, material), body = new THREE.SkinnedMesh(geometry, material);
    head.name = `${id}-anatomical-head`; head.castShadow = body.castShadow = true; head.updateMorphTargets();
    const headRoot = new THREE.Group(), bodyRoot = new THREE.Group(), fallback = new THREE.Mesh(geometry, material);
    headRoot.name = `${id === 'oracle' ? 'oracle-revolutions' : id}-detailed-head`; bodyRoot.name = `${id}-detailed-body`;
    headRoot.add(head); bodyRoot.add(body); group.visible = false; group.add(fallback);
    cast.set(id, group); heads.push(head); arriving.push({ group, head: headRoot, body: bodyRoot, fallback });
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
  const lighting = new LightCulling(scene), occlusion = new WorldOcclusionPass(scene, camera, 1280, 720); let ready = false;
  const prepare = () => {
    sets.prepareSecondOracle(graphics, camera, journey, id => id === 'smith' && !ready ? undefined : cast.get(id), resume, undefined, undefined, lighting);
    occlusion.prepareNormals(graphics, sets.root, sets.secondOracleEntryNormalMeshes, true);
  };
  t.after(() => { sets.dispose(); lighting.dispose(); occlusion.dispose(); geometry.dispose(); faceGeometry.dispose(); material.dispose(); });
  prepare(); assert.equal(sets['preparedSecondOracle'], undefined, 'the unanswered reflection does not prepare a different viewpoint');
  journey.step = 4; const saved = JSON.stringify(journey);
  for (let frame = 0; frame < 80; frame++) prepare(); ready = true;
  for (const { group, head, body, fallback } of arriving) { fallback.visible = false; group.add(head, body); }
  for (let frame = 0; frame < 300; frame++) prepare();
  const room = sets['preparedSecondOracle']?.room;
  assert.ok(room, 'physical departure must prepare the Oracle viewpoint before the cut');
  const props = room.root.getObjectByName('oracle-absorption-props'), corridor = room.root.getObjectByName('revolutions-prelude-m3_oracle_absorbed');
  assert.ok(props && corridor, 'prepare the actual cookie, plate and corridor fixtures');
  assert.ok(heads.every(head => colors.has(head) && normals.has(head)), 'plain morphed heads need their color and AO variants');
  assert.ok(depths.has(faceGeometry), 'the arriving actors need the shadow pass');
  assert.ok([...cast.values()].every(group => !group.visible)); assert.equal(JSON.stringify(journey), saved);
  Object.assign(journey, { scene: next.id, actor: next.actor, step: 0, oracleAbsorption: newOracleAbsorption(0, 999) });
  const oracle = world.agents.get('oracle')!;
  Object.assign(oracle, { position: filmEntry(next), currentLocation: next.set, isInMatrix: true });
  sets.update(oracle, sandbox, 1);
  assert.equal(sets.root.getObjectsByProperty('name', props.name).length, 1); assert.equal(sets.root.getObjectByName(props.name), props);
  assert.equal(sets.root.getObjectByName(corridor.name), corridor, 'the prepared fixtures are adopted rather than rebuilt');
  assert.equal(sets.stablePointSlots, true);
  let points = 0; scene.traverseVisible(object => { if (object instanceof THREE.PointLight) points++; });
  assert.ok(points > 0 && layouts.has(points), 'the prepared color layout includes the live corridor lamps');
});

test('the Oracle viewpoint retains its four actors without drawing past rooms or changing their saved fates', t => {
  canvas(t);
  const world = new WorldState(); new AgentManager(world).initializeAllAgents();
  const renderer = new AgentRenderer(new THREE.Scene()), scene = FILM_SCENE_BY_ID.m3_oracle_absorbed;
  t.after(() => renderer.dispose()); t.mock.method(renderer['models'], 'requestHero', () => {}); t.mock.method(renderer['models'], 'animate', () => {});
  for (const id of [scene.actor, ...scene.cast]) Object.assign(world.agents.get(id)!, { position: filmEntry(scene), currentLocation: scene.set, isInMatrix: true });
  for (const [id, location] of [['agent_jones', 'film_heart_hotel'], ['merovingian', 'film_club_hel'], ['keymaker', 'film_source_corridor']])
    Object.assign(world.agents.get(id)!, { position: filmPosition(location), currentLocation: location, isInMatrix: true,
      ...(id === 'keymaker' ? { status: 'dead', health: 0 } : {}) });
  for (const [id, actor] of world.agents) renderer.updateAgent(id, actor);
  renderer.setPlayer('oracle'); renderer.setWorld(true);
  const journey: FilmJourney = { version: 1, scene: scene.id, actor: scene.actor, step: 0, completed: [], enteredAt: 0,
    reflections: {}, lastText: '', checkpoint: filmEntry(scene), oracleAbsorption: newOracleAbsorption(0, 999) };
  const saved = JSON.stringify([...world.agents]); renderer.update(.02, undefined, 1, 0, journey);
  for (const id of ['agent_jones', 'merovingian', 'keymaker']) assert.equal(renderer.getAgent(id)!.visible, false, id);
  for (const id of [scene.actor, ...scene.cast]) assert.equal(renderer.getAgent(id)!.visible, true, id);
  assert.equal(JSON.stringify([...world.agents]), saved);
  renderer.update(.02); assert.equal(renderer.getAgent('agent_jones')!.visible, true);
});
