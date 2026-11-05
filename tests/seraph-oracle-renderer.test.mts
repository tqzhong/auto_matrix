import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from 'three';
import { FILM_SCENE_BY_ID, filmEntry, type FilmJourney, type SandboxState } from '@auto_matrix/shared';
import { FilmSetRenderer } from '../packages/client/src/engine/FilmSetRenderer.js';
import { AgentManager } from '../packages/server/src/agents/AgentManager.js';
import { WorldState } from '../packages/server/src/world/WorldState.js';

test('the second Oracle route adopts prepared sets and keeps their interactive props live', t => {
  const previous = globalThis.document;
  const context = { fillRect() {}, strokeRect() {}, fillText() {} };
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
  const prepare = () => sets.prepareSecondOracle(graphics, camera, journey, id => id === 'neo' ? cast : undefined);
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
