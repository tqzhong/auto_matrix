import assert from 'node:assert/strict';
import test, { type TestContext } from 'node:test';
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { FILM_SCENE_BY_ID, filmEntry, newBaneInquiry, newHammerBriefing, type FilmJourney, type SandboxState } from '@auto_matrix/shared';
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

for (const resume of [false, true]) test(`${resume ? 'saved' : 'live'} Hammer investigation prepares and adopts the actual route meeting and its late crew models`, t => {
  canvas(t);
  const scene = new THREE.Scene(), sets = new FilmSetRenderer(scene), camera = new THREE.PerspectiveCamera();
  const world = new WorldState(); new AgentManager(world).initializeAllAgents();
  const source = FILM_SCENE_BY_ID.m3_bane_questions, next = FILM_SCENE_BY_ID.m3_logos_plan, roland = world.agents.get('roland')!;
  Object.assign(roland, { position: filmEntry(source), currentLocation: source.set, isInMatrix: false });
  const journey: FilmJourney = { version: 1, scene: source.id, actor: roland.id, step: 2, completed: [], enteredAt: 0,
    reflections: {}, lastText: '', checkpoint: { ...roland.position }, baneInquiry: newBaneInquiry(2, 100) };
  const sandbox = { neoLife: { journey } } as SandboxState;
  if (!resume) sets.update(roland, sandbox, 0);
  const geometry = new THREE.BoxGeometry(), faceGeometry = geometry.clone(), material = new THREE.MeshStandardMaterial();
  faceGeometry.morphAttributes.position = [faceGeometry.attributes.position.clone()]; faceGeometry.morphTargetsRelative = true;
  const cast = new Map<string, THREE.Group>(), heads: THREE.Mesh[] = [], arriving: { group: THREE.Group; head: THREE.Group; body: THREE.Group; fallback: THREE.Mesh }[] = [];
  for (const id of [next.actor, ...next.cast]) {
    const group = new THREE.Group(), head = new THREE.Mesh(faceGeometry, material), body = new THREE.SkinnedMesh(geometry, material);
    head.name = `${id}-anatomical-head`; head.castShadow = body.castShadow = true; head.updateMorphTargets(); group.visible = false;
    if (id === 'niobe' || id === 'roland') {
      const headRoot = new THREE.Group(), bodyRoot = new THREE.Group(), fallback = new THREE.Mesh(geometry, material);
      headRoot.name = `${id}-detailed-head`; bodyRoot.name = `${id}-detailed-body`; headRoot.add(head); bodyRoot.add(body); group.add(fallback);
      arriving.push({ group, head: headRoot, body: bodyRoot, fallback });
    } else group.add(head, body);
    cast.set(id, group); heads.push(head);
  }
  const sweater = new THREE.SkinnedMesh(geometry, material); sweater.name = 'niobe-briefing-sweater'; sweater.userData.wardrobe = 'briefing'; sweater.visible = false; sweater.castShadow = true;
  arriving[0].body.add(sweater);
  const garments = ['neo', 'trinity', 'morpheus'].map((id, i) => {
    const fitted = geometry.clone(); fitted.morphAttributes.position = Array.from({ length: i + 2 }, () => fitted.attributes.position.clone());
    const mesh = new THREE.SkinnedMesh(fitted, material); mesh.name = `${id}-ship-garment-proxy`; mesh.castShadow = true;
    t.after(() => fitted.dispose()); return mesh;
  });
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
    sets.prepareSecondOracle(graphics, camera, journey, id => cast.get(id), resume, undefined, id => ({ model: cast.get(id), garments: () => garments.filter(mesh => mesh.name.startsWith(id + '-')) }), lighting);
    occlusion.prepareNormals(graphics, sets.root, sets.secondOracleEntryNormalMeshes, true);
  };
  t.after(() => { sets.dispose(); lighting.dispose(); occlusion.dispose(); geometry.dispose(); faceGeometry.dispose(); material.dispose(); });
  prepare(); assert.equal(sets['preparedSecondOracle'], undefined, 'early questioning cannot allocate the later route meeting');
  journey.step = 3; const saved = JSON.stringify(journey);
  for (let frame = 0; frame < 100; frame++) prepare();
  assert.ok(sets['preparedSecondOracle'], 'prepare the route meeting during medical review, before the actor handoff');
  for (const { group } of arriving) assert.equal(sets['preparedSecondOracle']!.colors?.actors.has(group), false, 'a fallback cannot mark a late crew model ready');
  for (const { group, head, body, fallback } of arriving) { fallback.visible = false; group.add(head, body); }
  const hiddenHeadParent = new THREE.Group(); hiddenHeadParent.visible = false;
  cast.get('niobe')!.add(hiddenHeadParent); hiddenHeadParent.add(arriving[0].head);
  for (let frame = 0; frame < 400; frame++) prepare();
  const room = sets['preparedSecondOracle']!.room, mess = room.root.getObjectByName('hammer-standing-briefing'), prelude = room.root.getObjectByName('revolutions-prelude-m3_logos_plan');
  assert.ok(mess && prelude, 'prepare both the actual curved-hull meeting room and its live lighting');
  assert.ok(colors.has(mess.getObjectByName('briefing-floor')!), 'the physical meeting floor must be prepared before first use');
  assert.ok(heads.every(head => colors.has(head) && normals.has(head)), 'late plain morphed heads need both color and AO variants');
  assert.ok(colors.has(sweater) && normals.has(sweater), 'prepare the hidden meeting sweater without changing the current dock outfit');
  assert.equal(sweater.visible, false);
  assert.equal(hiddenHeadParent.visible, false, 'preparing the real-world face cannot reveal the hidden fallback in her current Matrix appearance');
  assert.ok(garments.every(mesh => colors.has(mesh) && normals.has(mesh) && depths.has(mesh.geometry)), 'future ship garments need their actual color, shadow and AO variants');
  assert.ok(depths.has(faceGeometry), 'late crew faces need their real shadow variant');
  assert.ok([...cast.values()].every(group => !group.visible)); assert.equal(JSON.stringify(journey), saved);
  Object.assign(journey, { scene: next.id, actor: next.actor, step: 0, hammerBriefing: newHammerBriefing(0, 100) });
  const neo = world.agents.get('neo')!; Object.assign(neo, { position: filmEntry(next), currentLocation: next.set, isInMatrix: false });
  sets.update(neo, sandbox, 1);
  assert.equal(sets['hammerBriefing']!.root, mess, 'adopt the prepared console and room instead of rebuilding it');
  assert.equal(sets.root.getObjectsByProperty('name', mess.name).length, 1);
  assert.equal(sets.root.getObjectByName(prelude.name), prelude);
  assert.equal(sets.stablePointSlots, true);
  let points = 0; scene.traverseVisible(object => { if (object instanceof THREE.PointLight) points++; });
  assert.ok(points > 0 && layouts.has(points), 'prepared programs must match the adopted point-light layout');
});

test('the distant route meeting crew models load during the Hammer investigation without changing world state or other players', t => {
  canvas(t);
  const renderer = new AgentRenderer(new THREE.Scene()), world = new WorldState(); new AgentManager(world).initializeAllAgents();
  t.after(() => renderer.dispose()); t.mock.method(renderer['models'], 'requestHero', () => {});
  const source = FILM_SCENE_BY_ID.m3_bane_questions, next = FILM_SCENE_BY_ID.m3_logos_plan;
  Object.assign(world.agents.get('roland')!, { position: filmEntry(source), currentLocation: source.set, isInMatrix: false });
  for (const id of [next.actor, ...next.cast].filter(id => id !== source.actor)) Object.assign(world.agents.get(id)!, { position: { ...filmEntry(next), x: filmEntry(next).x + 500 }, currentLocation: next.set, isInMatrix: false });
  for (const [id, actor] of world.agents) renderer.updateAgent(id, actor);
  renderer.setWorld(true); renderer.setPlayer('roland'); const camera = new THREE.PerspectiveCamera(); camera.position.copy(world.agents.get('roland')!.position);
  const requested = new Map<string, { prepare?: boolean; distance: number }>();
  t.mock.method(renderer['models'], 'animate', (rig, _delta, input, distance) => {
    const id = [...renderer['agents']].find(([, entry]) => entry.rig === rig)![0]; requested.set(id, { prepare: input.prepareDetailedCast, distance });
  });
  const journey: FilmJourney = { version: 1, scene: source.id, actor: source.actor, step: 2, completed: [], enteredAt: 0,
    reflections: {}, lastText: '', checkpoint: filmEntry(source), baneInquiry: newBaneInquiry(2, 100) };
  const saved = JSON.stringify([...world.agents]);
  renderer.update(.02, camera, 1, 0, journey);
  for (const id of ['niobe', 'roland']) assert.ok(!requested.get(id)?.prepare);
  journey.step = 3; renderer.update(.02, camera, 1, 0, journey);
  for (const id of ['niobe', 'roland']) {
    assert.equal(requested.get(id)?.prepare, true, id);
    if (id === 'niobe') assert.ok(requested.get(id)!.distance > 100);
    if (id === 'niobe') assert.equal(renderer.getAgent(id)!.visible, false, 'future meeting participants stay hidden from the current investigation');
  }
  journey.visiting = source.id; renderer.update(.02, camera, 1, 0, journey);
  for (const id of ['niobe', 'roland']) assert.ok(!requested.get(id)?.prepare);
  delete journey.visiting; renderer.setPlayer('neo'); renderer.update(.02, camera, 1, 0, journey);
  for (const id of ['niobe', 'roland']) assert.ok(!requested.get(id)?.prepare);
  assert.equal(JSON.stringify([...world.agents]), saved);
});
