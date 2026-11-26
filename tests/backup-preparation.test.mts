import assert from 'node:assert/strict';
import test, { type TestContext } from 'node:test';
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { FILM_SCENE_BY_ID, filmEntry, filmPosition, type FilmJourney, type SandboxState } from '@auto_matrix/shared';
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

for (const resume of [false, true]) test(`${resume ? 'cold' : 'live'} relay prepares hidden Matrix clothes, room depth and normals before entering security`, t => {
  canvas(t);
  const scene = new THREE.Scene(), film = new FilmSetRenderer(scene), camera = new THREE.PerspectiveCamera();
  const sun = new THREE.DirectionalLight(); sun.castShadow = false; scene.add(sun);
  const source = new THREE.Scene(), lights = new LightCulling(source); lights.enabled = false;
  for (let i = 0; i < 17; i++) source.add(new THREE.PointLight());
  const world = new WorldState(); new AgentManager(world).initializeAllAgents(); const actor = world.agents.get('trinity')!;
  Object.assign(actor, { position: filmEntry(FILM_SCENE_BY_ID.m2_relay), currentLocation: 'film_neb_deck', isInMatrix: false });
  const journey: FilmJourney = { version: 1, scene: 'm2_relay', actor: actor.id, step: 2, completed: ['m2_relay'], enteredAt: 0,
    reflections: {}, lastText: '', checkpoint: { ...actor.position }, trinityRelay: { phase: 'connected', elapsed: 16.5 } };
  if (!resume) film.update(actor, { neoLife: { journey } } as SandboxState, 0);
  const geometry = new THREE.BoxGeometry(), material = new THREE.MeshStandardMaterial(), group = new THREE.Group(); group.visible = false;
  const head = new THREE.SkinnedMesh(geometry, material), jacket = new THREE.SkinnedMesh(geometry, material), glasses = new THREE.Mesh(geometry, new THREE.MeshPhysicalMaterial());
  jacket.name = 'Fitted_leather_jacket'; jacket.visible = glasses.visible = false; group.add(head, jacket, glasses);
  const knit = new THREE.Mesh(geometry, material); knit.userData.logosCostume = true; knit.userData.reloadedHidden = true; group.add(knit);
  const shadow = new THREE.Mesh(geometry, new THREE.MeshBasicMaterial({ transparent: true, toneMapped: false }));
  for (const mesh of [head, jacket, glasses]) mesh.castShadow = true;
  const compiled = new Set<THREE.Object3D>(), depths = new Set<THREE.MeshDepthMaterial>(), slots = new Set<number>(), normals = new Set<THREE.Object3D>();
  let ready = false, destinationSun = false;
  const graphics = { extensions: { has: () => true }, info: { programs: [] }, properties: { get: () => ({}) }, shadowMap: { enabled: true, type: THREE.PCFSoftShadowMap },
    getRenderTarget: () => null, setRenderTarget() {}, initTexture() {}, compile(subject: THREE.Object3D, _camera: THREE.Camera, target?: THREE.Scene) {
      let points = 0; target?.traverseVisible(o => { if (o instanceof THREE.PointLight) points++; if (o instanceof THREE.DirectionalLight && o.castShadow) destinationSun = true; });
      subject.traverse(o => { compiled.add(o); if (o instanceof THREE.Mesh && o.material instanceof THREE.MeshDepthMaterial) { depths.add(o.material); slots.add(points); }
        if (o instanceof THREE.Mesh && o.material instanceof THREE.MeshNormalMaterial) normals.add(o); });
    } } as unknown as THREE.WebGLRenderer;
  const occlusion = new WorldOcclusionPass(scene, camera, 1280, 720), saved = JSON.stringify(journey);
  t.after(() => { film.dispose(); lights.dispose(); occlusion.dispose(); geometry.dispose(); material.dispose(); glasses.material.dispose(); shadow.material.dispose(); });
  const prepare = () => {
    film.prepareSecondOracle(graphics, camera, journey, id => ready && id === 'trinity' ? group : undefined, resume, undefined, () => ({ shadow }), lights, sun);
    occlusion.prepareNormals(graphics, film.root, film.secondOracleEntryNormalMeshes, true);
  };
  for (let frame = 0; frame < 100; frame++) prepare(); ready = true;
  for (let frame = 0; frame < 300; frame++) prepare();
  assert.ok(compiled.has(jacket) && compiled.has(glasses), 'real-world visibility cannot exclude the upcoming leather and glasses');
  assert.equal(compiled.has(knit), false, 'the ship knit does not belong in the Matrix preparation');
  assert.ok(compiled.has(shadow)); assert.ok(depths.size); assert.ok(slots.has(4)); assert.ok(destinationSun, 'the real ship disables the world sun shadow; the Matrix needs it');
  if (!resume) assert.ok(slots.has(17));
  assert.ok(normals.has(head) && normals.has(jacket)); assert.equal(jacket.visible, false); assert.equal(group.visible, false); assert.equal(JSON.stringify(journey), saved);
  const room = film['preparedSecondOracle']!.room, terminal = room['trinityTerminal']; assert.ok(terminal);
  assert.ok(compiled.has(terminal.group.getObjectByName('terminal-screen')!), 'the mapped CRT display has its own unlit program');
  assert.ok(normals.has(terminal.group.getObjectByName('terminal-keys')!));
  let disposed = 0; for (const depth of depths) depth.addEventListener('dispose', () => disposed++);
  if (resume) { film.prepareSecondOracle(graphics, camera, undefined, () => undefined); assert.equal(disposed, depths.size); }
  else {
    const arriving = { ...journey, scene: 'm2_backup', step: 0 };
    film.update(actor, { neoLife: { journey: arriving } } as SandboxState, 0);
    assert.equal(film['preparedSecondOracle']?.room, room, 'an early journey packet must retain the prepared room until the actor changes worlds');
    Object.assign(actor, { position: filmEntry(FILM_SCENE_BY_ID.m2_backup), currentLocation: 'film_backup_station', isInMatrix: true });
    film.update(actor, { neoLife: { journey: arriving } } as SandboxState, 0);
    assert.equal(film['trinityTerminal'], terminal); assert.equal(room['trinityTerminal'], undefined);
    assert.equal(film['powerStatus'], undefined, 'adopting a computer room cannot add the old transformer console');
  }
});

test('the submitted terminal keeps its three lamps and objective layout without adding illumination', t => {
  canvas(t);
  const scene = new THREE.Scene(), film = new FilmSetRenderer(scene), lights = new LightCulling(scene), camera = new THREE.PerspectiveCamera(57, 16 / 9, .5, 5000);
  t.after(() => { film.dispose(); lights.dispose(); });
  const world = new WorldState(); new AgentManager(world).initializeAllAgents(); const actor = world.agents.get('trinity')!;
  Object.assign(actor, { position: filmPosition('film_backup_station', 0, -11.9), currentLocation: 'film_backup_station', isInMatrix: true });
  const journey: FilmJourney = { version: 1, scene: 'm2_backup', actor: actor.id, step: 1, completed: [], enteredAt: 0, reflections: {}, lastText: '', checkpoint: { ...actor.position } };
  camera.position.set(actor.position.x, actor.position.y + 5, actor.position.z + 20); camera.lookAt(actor.position.x, actor.position.y + 2, actor.position.z);
  const count = (minimum: number) => { lights.minimumPointSlots = minimum; scene.updateMatrixWorld(); camera.updateMatrixWorld(); scene.onBeforeRender({} as THREE.WebGLRenderer, scene, camera, null);
    const values: number[] = []; scene.traverseVisible(o => { if (o instanceof THREE.PointLight) values.push(o.intensity); }); scene.onAfterRender({} as THREE.WebGLRenderer, scene, camera);
    return { count: values.length, energy: values.reduce((s, n) => s + n, 0) }; };
  for (const step of [1, 2]) {
    journey.step = step; film.update(actor, { neoLife: { journey } } as SandboxState, 0, actor.position);
    const actual = count(film.minimumPointSlots), old = count(0); assert.equal(actual.count, 4); assert.equal(actual.energy, old.energy);
  }
  film.update(undefined, undefined, 0); assert.equal(film.minimumPointSlots, 0);
});

test('the computer room draws local workers but keeps Smith and the Oracle in their saved rooms', t => {
  canvas(t);
  const renderer = new AgentRenderer(new THREE.Scene()), world = new WorldState(); new AgentManager(world).initializeAllAgents();
  t.after(() => renderer.dispose()); t.mock.method(renderer['models'], 'requestHero', () => {}); t.mock.method(renderer['models'], 'animate', () => {});
  for (const id of ['trinity', 'citizen_1', 'smith', 'oracle']) {
    const beat = FILM_SCENE_BY_ID[id === 'smith' || id === 'oracle' ? 'm2_bench' : 'm2_backup'], actor = world.agents.get(id)!;
    Object.assign(actor, { position: filmEntry(beat), currentLocation: beat.set, isInMatrix: true }); renderer.updateAgent(id, actor);
  }
  renderer.setPlayer('trinity'); const journey: FilmJourney = { version: 1, scene: 'm2_backup', actor: 'trinity', step: 0, completed: [], enteredAt: 0,
    reflections: {}, lastText: '', checkpoint: filmEntry(FILM_SCENE_BY_ID.m2_backup) };
  const saved = JSON.stringify([...world.agents]); renderer.update(.02, undefined, 1, 0, journey);
  for (const id of ['smith', 'oracle']) assert.equal(renderer.getAgent(id)!.visible, false);
  for (const id of ['trinity', 'citizen_1']) assert.equal(renderer.getAgent(id)!.visible, true);
  assert.equal(JSON.stringify([...world.agents]), saved);
  renderer.update(.02); assert.equal(renderer.getAgent('smith')!.visible, true); assert.equal(renderer.getAgent('oracle')!.visible, true);
});
