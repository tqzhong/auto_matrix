import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from 'three';
import { BURLY, FILM_SCENE_BY_ID, filmEntry, type FilmJourney, type SandboxState, type SandboxThreat } from '@auto_matrix/shared';
import { AgentRenderer } from '../packages/client/src/agents/AgentRenderer.js';
import { CharacterModels, type CharacterRig } from '../packages/client/src/agents/CharacterModel.js';
import { newMotion } from '../packages/client/src/agents/CharacterMotion.js';
import { FilmSetRenderer } from '../packages/client/src/engine/FilmSetRenderer.js';
import { SandboxRenderer } from '../packages/client/src/engine/SandboxRenderer.js';
import { AgentManager } from '../packages/server/src/agents/AgentManager.js';
import { WorldState } from '../packages/server/src/world/WorldState.js';

test('the second Oracle route adopts prepared sets and keeps their interactive props live', t => {
  const previous = globalThis.document;
  const context = { fillRect() {}, strokeRect() {}, fillText() {}, beginPath() {}, moveTo() {}, lineTo() {}, closePath() {}, stroke() {}, fill() {} };
  globalThis.document = { createElement: () => ({ width: 0, height: 0, getContext: () => context }) } as unknown as Document;
  t.after(() => { globalThis.document = previous; });
  t.mock.method(THREE.TextureLoader.prototype, 'load', () => new THREE.Texture({ width: 1, complete: true }));
  const scene = new THREE.Scene(), sets = new FilmSetRenderer(scene), camera = new THREE.PerspectiveCamera();
  const world = new WorldState(); new AgentManager(world).initializeAllAgents();
  const neo = world.agents.get('neo')!;
  const journey: FilmJourney = { version: 1, scene: 'm2_departure', actor: 'neo', step: 0, completed: [], enteredAt: 0,
    checkpoint: neo.position, reflections: {}, lastText: '' };
  const sandbox = { neoLife: { journey } } as SandboxState;
  const cast = new THREE.Group(), body = new THREE.Mesh(new THREE.BoxGeometry(), new THREE.MeshStandardMaterial());
  cast.add(body);
  t.after(() => { sets.dispose(); body.geometry.dispose(); body.material.dispose(); });

  let preview: THREE.Scene | undefined, castCompiled = false;
  const graphics = { extensions: { has: () => true }, info: { programs: [] }, getRenderTarget: () => null,
    setRenderTarget() {}, initTexture() {}, properties: { get: () => ({}) },
    compile(subject: THREE.Group, _camera: THREE.Camera, target: THREE.Scene) {
      preview = target;
      subject.traverse(mesh => { if (mesh === body) castCompiled = true; });
    } } as unknown as THREE.WebGLRenderer;
  const enter = (id: string, step: number) => {
    const beat = FILM_SCENE_BY_ID[id];
    Object.assign(journey, { scene: id, step });
    Object.assign(neo, { position: filmEntry(beat), isInMatrix: id !== 'm2_departure', currentLocation: beat.set });
    sets.update(neo, sandbox, 0);
  };
  const prepare = () => sets.prepareSecondOracle(graphics, camera, journey, id => ['neo', 'smith'].includes(id) ? cast : undefined);
  const warm = (name: string) => {
    preview = undefined; castCompiled = false;
    for (let i = 0; i < 120; i++) prepare();
    const mesh = preview?.getObjectByName(name);
    assert.ok(mesh instanceof THREE.Mesh || mesh instanceof THREE.Group, `${name} was prepared`);
    assert.ok(!scene.getObjectByName(name));
    assert.equal(castCompiled, true);
    return mesh;
  };
  const pointSlots = (root: THREE.Scene) => {
    let count = 0;
    root.traverseVisible(object => { if (object instanceof THREE.PointLight) count++; });
    return count;
  };

  enter('m2_departure', 3); prepare(); assert.ok(!preview);
  enter('m2_departure', 4);
  const teaDoor = warm('m2_seraph-keyed-door');
  const teaSlots = pointSlots(preview!);
  enter('m2_seraph', 0);
  assert.ok(scene.getObjectByName(teaDoor.name) === teaDoor);
  assert.equal(sets.stablePointSlots, true);
  assert.equal(pointSlots(scene), teaSlots);
  assert.equal(teaDoor.parent!.position.x, 0);
  enter('m2_seraph', 1);
  const hallDoor = warm('m2_backdoors-keyed-door');
  enter('m2_seraph', 2);
  assert.ok(teaDoor.parent!.position.x > 5);

  enter('m2_backdoors', 1);
  assert.ok(scene.getObjectByName(hallDoor.name) === hallDoor);
  assert.equal(hallDoor.parent!.position.x, 0);
  const lead = warm('oracle-second-folded-lead');
  enter('m2_backdoors', 2);
  assert.ok(hallDoor.parent!.position.x > 5);
  enter('m2_bench', 0);
  assert.ok(scene.getObjectByName(lead.name) === lead);
  assert.equal(lead.visible, true);
  enter('m2_bench', 4);
  assert.equal(lead.visible, false);
  castCompiled = false;
  prepare();
  assert.equal(castCompiled, true, 'Smith is prepared while the Oracle is leaving');
  enter('m2_burly', 0);
  assert.ok(scene.getObjectByName(lead.name) === lead, 'Smith arrives in the existing courtyard');
  assert.equal(sets.stablePointSlots, true);
  assert.equal(lead.visible, false);

  preview = undefined; prepare(); assert.ok(!preview, 'the restaurant waits until the flight exit opens');
  enter('m2_burly', 1);
  const dessert = warm('causality-dessert');
  const restaurantSlots = pointSlots(preview!);
  enter('m2_merovingian', 0);
  assert.ok(scene.getObjectByName(dessert.name) === dessert);
  assert.equal(pointSlots(scene), restaurantSlots);
  assert.equal(dessert.visible, false);
  enter('m2_merovingian', 2); assert.equal(dessert.visible, true);
  enter('m2_persephone', 0);
  assert.ok(scene.getObjectByName(dessert.name) === dessert, 'the washroom is in the existing restaurant');
  assert.equal(dessert.visible, false);
  enter('m2_persephone', 4);
  const bookshelf = warm('keymaker-book-door');
  const librarySlots = pointSlots(preview!);
  enter('m2_library', 0);
  assert.ok(scene.getObjectByName(bookshelf.name) === bookshelf);
  assert.equal(pointSlots(scene), librarySlots);
  assert.equal(bookshelf.position.x, 0);
  enter('m2_library', 3); assert.equal(bookshelf.position.x, -5.8);

  enter('m2_departure', 4);
  const abandoned = warm('m2_seraph-keyed-door') as THREE.Mesh;
  let disposed = 0; abandoned.geometry.addEventListener('dispose', () => disposed++);
  sets.update(undefined, sandbox, 1);
  assert.equal(disposed, 1);
  enter('m2_seraph', 2);
  const restored = scene.getObjectByName(teaDoor.name);
  assert.ok(restored && restored !== abandoned);
  assert.ok(restored.parent!.position.x > 5);
});

test('the first Smith copies reuse the actor model cache and take their prepared rigs from the pool', t => {
  const previous = globalThis.document;
  const context = { fillRect() {}, strokeRect() {}, fillText() {}, putImageData() {}, createRadialGradient: () => ({ addColorStop() {} }),
    createImageData: (w: number, h: number) => ({ data: new Uint8ClampedArray(w * h * 4) }) };
  globalThis.document = { createElement: () => ({ getContext: () => context }) } as unknown as Document;
  t.after(() => { globalThis.document = previous; });
  t.mock.method(THREE.TextureLoader.prototype, 'load', () => new THREE.Texture());
  const created: { owner: CharacterModels; rig: CharacterRig }[] = [];
  t.mock.method(CharacterModels.prototype, 'create', function (this: CharacterModels) {
    const rig = { root: new THREE.Group(), motion: newMotion() } as CharacterRig;
    created.push({ owner: this, rig }); return rig;
  });
  const animated: CharacterModels[] = [];
  t.mock.method(CharacterModels.prototype, 'animate', function (this: CharacterModels) { animated.push(this); });
  const scene = new THREE.Scene(), agents = new AgentRenderer(scene), sandbox = new SandboxRenderer(scene, agents);
  t.after(() => { sandbox.dispose(); agents.dispose(); });
  const world = new WorldState(); new AgentManager(world).initializeAllAgents();
  const smith = world.agents.get('smith')!, neo = world.agents.get('neo')!;
  agents.updateAgent('smith', smith);
  const host = created[0].rig.root.parent;
  const journey = { scene: 'm2_burly', burly: { phase: 'ready' } } as FilmJourney;
  const sync = (threats: SandboxThreat[]) => sandbox.sync({ threats, nodes: [], structures: [], incidents: [], missions: {}, neoLife: { journey } } as SandboxState, { smith, neo });
  sync([]);
  sandbox.prepareBurlyCopies(); sandbox.prepareBurlyCopies();
  assert.equal(created.length, 2, 'wait for a prepared copy before creating another');
  for (let i = 0; i < BURLY.initialCopies; i++) {
    created.at(-1)!.rig.hero = { root: new THREE.Group() } as CharacterRig['hero'];
    sandbox.prepareBurlyCopies();
  }
  assert.equal(created.length, BURLY.initialCopies + 1);
  assert.ok(created.every(item => item.owner === created[0].owner));
  assert.ok(created.slice(1).every(item => !item.rig.root.parent?.parent), 'prepared copies stay outside the live scene');
  journey.burly!.phase = 'swarm';
  sync(Array.from({ length: BURLY.initialCopies }, (_, i) => ({ id: `copy-${i}`, scene: journey.scene, kind: 'smith', matrix: true,
    position: { ...smith.position, x: smith.position.x + i }, health: 64, maxHealth: 64, target: 'neo', stunUntil: 0, lastStrike: 0 })));
  assert.equal(created.length, BURLY.initialCopies + 1);
  assert.ok(created[0].rig.root.parent === host);
  assert.ok(created.slice(1).every(item => item.rig.root.parent?.parent === scene));
  sandbox.update(.02, new THREE.PerspectiveCamera(), true, 0, true);
  assert.equal(animated.length, BURLY.initialCopies);
  assert.ok(animated.every(owner => owner === created[0].owner));
});
