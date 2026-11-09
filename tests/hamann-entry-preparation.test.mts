import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { FILM_SCENE_BY_ID, filmEntry, filmPosition, type FilmJourney, type SandboxState } from '@auto_matrix/shared';
import { AgentRenderer } from '../packages/client/src/agents/AgentRenderer.js';
import { FilmSetRenderer } from '../packages/client/src/engine/FilmSetRenderer.js';
import { WorldState } from '../packages/server/src/world/WorldState.js';
import { AgentManager } from '../packages/server/src/agents/AgentManager.js';

function story(): FilmJourney {
  return { version: 1, scene: 'm2_bane_copy', actor: 'bane', step: 1, completed: [], enteredAt: 0,
    reflections: {}, lastText: '', checkpoint: filmPosition('film_industrial_loft', 0, -23), baneCopy: { progress: 0 } };
}

test('the offscreen Hamann requests his delivered head and body during copying without changing saved agents or showing their distant detail', t => {
  const requested: string[] = [];
  t.mock.method(GLTFLoader.prototype, 'loadAsync', (url: string) => { requested.push(url); return new Promise(() => {}); });
  t.mock.method(THREE.TextureLoader.prototype, 'load', () => new THREE.Texture());
  const previous = ['window', 'document'].map(key => Object.getOwnPropertyDescriptor(globalThis, key));
  Object.assign(globalThis, { window: new EventTarget(), document: { createElement: () => ({ getContext: () => ({ createRadialGradient: () => ({ addColorStop() {} }), fillRect() {}, strokeRect() {}, fillText() {}, beginPath() {}, closePath() {}, moveTo() {}, lineTo() {}, stroke() {}, ellipse() {}, fill() {}, createImageData: (w: number, h: number) => ({ data: new Uint8ClampedArray(w * h * 4) }), putImageData() {} }) }) } });
  const scene = new THREE.Scene(), renderer = new AgentRenderer(scene), world = new WorldState(); new AgentManager(world).initializeAllAgents();
  const bane = world.agents.get('bane')!, hamann = world.agents.get('hamann')!, journey = story(), camera = new THREE.PerspectiveCamera();
  Object.assign(bane, { isInMatrix: true, currentLocation: 'film_industrial_loft', position: filmPosition('film_industrial_loft', 0, -23), currentAction: null });
  Object.assign(hamann, { isInMatrix: false, currentLocation: 'film_zion_temple', position: filmPosition('film_zion_temple', -15, -30), currentAction: null });
  camera.position.copy(bane.position); renderer.setWorld(true); renderer.updateAgent('bane', bane); renderer.updateAgent('hamann', hamann); renderer.setPlayer('bane', false);
  const before = JSON.stringify([bane, hamann]), update = () => renderer.update(0, camera, 1, 0, journey);
  t.after(() => { renderer.dispose(); ['window', 'document'].forEach((key, i) => { if (previous[i]) Object.defineProperty(globalThis, key, previous[i]!); else Reflect.deleteProperty(globalThis, key); }); });
  update(); assert.ok(!requested.some(url => url.includes('/hamann-')), 'disk handoff cannot prepare the next cast early');
  journey.step = 2; journey.visiting = 'm2_bane_copy'; update(); assert.ok(!requested.some(url => url.includes('/hamann-')), 'free visits cannot prepare the story handoff');
  delete journey.visiting; update(); assert.ok(!requested.some(url => url.includes('/hamann-')), 'let the newly visible Smith render before preparing engineering');
  journey.baneCopy!.progress = .2; update(); update();
  for (const id of ['head', 'body']) assert.equal(requested.filter(url => url.endsWith(`/hamann-${id}.glb`)).length, 1, `request the existing ${id} once before entering engineering`);
  assert.equal(JSON.stringify([bane, hamann]), before); assert.equal(renderer.getAgentDetail('hamann')!.visible, false);
});

function setup(t: test.TestContext) {
  const scene = new THREE.Scene(), sets = new FilmSetRenderer(scene), camera = new THREE.PerspectiveCamera(), journey = story();
  const world = new WorldState(); new AgentManager(world).initializeAllAgents(); const bane = world.agents.get('bane')!, neo = world.agents.get('neo')!;
  Object.assign(bane, { isInMatrix: true, currentLocation: 'film_industrial_loft', position: filmPosition('film_industrial_loft', 0, -23) });
  const geometry = new THREE.BoxGeometry(), material = new THREE.MeshStandardMaterial(), cast = new Map<string, THREE.Group>();
  for (const id of ['neo', 'hamann']) { const group = new THREE.Group(); group.add(new THREE.Mesh(geometry, material)); cast.set(id, group); }
  const compiled = new Map<THREE.Mesh, number>(), batches: number[] = []; let preview: THREE.Scene | undefined, current: THREE.WebGLRenderTarget | null = null;
  const graphics = { extensions: { has: () => true }, info: { programs: [] }, properties: { get: (texture: THREE.Texture) => ({ __version: texture.version }) },
    getRenderTarget: () => current, setRenderTarget: (value: THREE.WebGLRenderTarget | null) => { current = value; },
    compile(subject: THREE.Group, _camera: THREE.Camera, next: THREE.Scene) { preview = next; let count = 0; subject.traverse(object => { if (object instanceof THREE.Mesh) { count++; compiled.set(object, (compiled.get(object) ?? 0) + 1); } }); batches.push(count); } } as unknown as THREE.WebGLRenderer;
  const sandbox = { neoLife: { journey } } as SandboxState, update = () => sets.update(journey.actor === 'bane' ? bane : neo, sandbox, 0);
  const prepare = () => sets.prepareZionHomecoming(graphics, camera, journey, id => cast.get(id));
  update(); t.after(() => { sets.dispose(); geometry.dispose(); material.dispose(); });
  return { scene, sets, camera, journey, neo, cast, compiled, batches, geometry, material, update, prepare, get preview() { return preview; } };
}

test('copying prepares the existing engineering set and the actual Neo handoff adopts it without changing the story', t => {
  const h = setup(t); h.prepare(); assert.equal(h.preview === undefined, true);
  h.journey.step = 2; h.update(); h.prepare(); assert.equal(h.preview === undefined, true, 'do not compete with Smith first appearing after the disk handoff');
  h.journey.baneCopy!.progress = .2; const saved = JSON.stringify(h.journey); h.prepare();
  const wheel = h.preview?.getObjectByName('zion-recycler-flywheel'); assert.ok(wheel, 'begin engineering preparation during copying instead of waiting for the phone');
  assert.equal(JSON.stringify(h.journey), saved); assert.equal(h.scene.getObjectByName(wheel.name), undefined);
  let disposed = 0; wheel.traverse(object => { if (object instanceof THREE.Mesh) object.geometry.addEventListener('dispose', () => disposed++); });
  Object.assign(h.journey, { scene: 'm2_hamann', actor: 'neo', step: 0 });
  Object.assign(h.neo, { isInMatrix: false, currentLocation: 'film_zion_engineering', position: filmEntry(FILM_SCENE_BY_ID.m2_hamann) }); h.update();
  assert.ok(h.scene.getObjectByName(wheel.name) === wheel); assert.equal(disposed, 0);
});

test('the preparation collects late detailed meshes inside the same hidden Hamann and releases cancelled engineering once', t => {
  const h = setup(t); h.journey.step = 3; h.update(); for (let frame = 0; frame < 60; frame++) h.prepare();
  const hamann = h.cast.get('hamann')!, original = hamann.children[0] as THREE.Mesh; hamann.visible = false;
  const late = new THREE.Mesh(h.geometry, h.material); late.name = 'late-delivered-hamann-head'; hamann.add(late);
  for (let frame = 0; frame < 20; frame++) h.prepare();
  assert.equal(h.compiled.get(late), 1, 'a known actor root cannot hide newly loaded detailed meshes from the queue');
  assert.equal(h.compiled.get(original), 1, 'rescan without recompiling previously consumed meshes'); assert.equal(hamann.visible, false); assert.ok(h.batches.every(count => count <= 4));
  const wheel = h.preview?.getObjectByName('zion-recycler-flywheel'); assert.ok(wheel); let disposed = 0;
  wheel.traverse(object => { if (object instanceof THREE.Mesh) object.geometry.addEventListener('dispose', () => disposed++); });
  h.sets.prepareZionHomecoming({} as THREE.WebGLRenderer, h.camera, undefined, () => undefined); assert.ok(disposed > 0); const once = disposed;
  h.sets.prepareZionHomecoming({} as THREE.WebGLRenderer, h.camera, undefined, () => undefined); assert.equal(disposed, once);
});
