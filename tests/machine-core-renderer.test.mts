import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from 'three';
import { filmPosition, newDeusPact, type DeusPactEncounter, type FilmJourney, type SandboxState } from '@auto_matrix/shared';
import { MachineCoreRenderer } from '../packages/client/src/engine/MachineCoreRenderer.js';
import { MachineCityRenderer } from '../packages/client/src/engine/MachineCityRenderer.js';
import { FilmSetRenderer } from '../packages/client/src/engine/FilmSetRenderer.js';
import { WorldState } from '../packages/server/src/world/WorldState.js';
import { AgentManager } from '../packages/server/src/agents/AgentManager.js';

const player = { x: 0, z: -25 };
function snapshot(root: THREE.Group, name: string) {
  const objects: unknown[] = [];
  root.getObjectByName(name)!.traverse(object => {
    const mesh = object as THREE.Mesh;
    objects.push({ position: object.position.toArray(), rotation: object.quaternion.toArray(), scale: object.scale.toArray(),
      visible: object.visible, opacity: mesh.material && (Array.isArray(mesh.material) ? mesh.material : [mesh.material]).map(material => material.opacity),
      instances: object instanceof THREE.InstancedMesh ? Array.from(object.instanceMatrix.array) : undefined });
  });
  return objects;
}
const names = ['machine-core-swarm', 'machine-core-face', 'machine-core-seat', 'machine-core-connection-pulse', 'machine-core-storm', 'machine-core-collective-chassis'];
const beats: DeusPactEncounter[] = [
  { ...newDeusPact(), phase: 'swarm', elapsed: 1.4, total: 1.4, resolve: 1.1 },
  { ...newDeusPact(), phase: 'challenge', elapsed: .85, total: 6.2, resolve: 3 },
  { ...newDeusPact(), phase: 'warning', elapsed: 1.2, total: 6.3, resolve: 3 },
  { ...newDeusPact(), phase: 'question', elapsed: .8, total: 16, resolve: 3 },
  { ...newDeusPact(), phase: 'assurance', elapsed: .8, total: 18, resolve: 3 },
  { ...newDeusPact(), phase: 'cabling', elapsed: 1.4, total: 10.8, resolve: 3 },
  { ...newDeusPact(), phase: 'consent', elapsed: 1.1, total: 13.3, resolve: 3, consent: .7 },
  { ...newDeusPact(), phase: 'connected', elapsed: 0, total: 15.5, resolve: 3, consent: 1.8 },
];

test('the actual machine core stays identical while a saved performance is paused for repeated frames', () => {
  const root = new THREE.Group(), renderer = new MachineCoreRenderer(root);
  try {
    for (const beat of beats) {
      renderer.update(beat, 100, false, player);
      const before = names.map(name => snapshot(root, name));
      for (let frame = 0; frame < 90; frame++) renderer.update(beat, 100, false, player);
      assert.deepEqual(names.map(name => snapshot(root, name)), before, `${beat.phase} moved while the world clock was stopped`);
    }
  } finally { renderer.dispose(); }
});

test('cold machine-core rendering and reverse saved-frame seeking reproduce the same live scene without the page clock', () => {
  const root = new THREE.Group(), renderer = new MachineCoreRenderer(root);
  try {
    for (const beat of [...beats, ...beats.toReversed()]) {
      for (let frame = 0; frame < 20; frame++) renderer.update(beat, 123 + frame / 60, false, player);
      const coldRoot = new THREE.Group(), cold = new MachineCoreRenderer(coldRoot);
      try {
        cold.update(structuredClone(beat), 0, false, player);
        for (const name of names) assert.deepEqual(snapshot(root, name), snapshot(coldRoot, name), `${beat.phase}: ${name} depends on page age or prior frames`);
      } finally { cold.dispose(); }
    }
  } finally { renderer.dispose(); }
});

test('saved performance time still animates the visible swarm, face and connection rather than freezing them', () => {
  const root = new THREE.Group(), renderer = new MachineCoreRenderer(root);
  try {
    for (const [beat, name] of [[beats[0], names[0]], [beats[2], names[1]], [beats.at(-1)!, names[3]]] as const) {
      renderer.update(beat, 50, false, player);
      assert.equal(root.getObjectByName(name)!.visible, true);
      const before = snapshot(root, name);
      renderer.update({ ...beat, total: beat.total + .2 }, 50, false, player);
      assert.notDeepEqual(snapshot(root, name), before, `${name} must retain its bounded animation on the saved clock`);
    }
  } finally { renderer.dispose(); }
});

test('the real film set follows Neo’s fast connection clock without replaying stale phases, retries or visits', t => {
  const original = globalThis.document;
  t.mock.method(THREE.TextureLoader.prototype, 'load', () => new THREE.Texture());
  globalThis.document = { createElement: () => ({ width: 0, height: 0, getContext: () => ({
    createImageData: (width: number, height: number) => ({ data: new Uint8ClampedArray(width * height * 4) }),
    putImageData() {}, fillRect() {}, strokeRect() {}, fillText() {}, createRadialGradient: () => ({ addColorStop() {} }),
  }) }) } as unknown as Document;
  const scene = new THREE.Scene(), renderer = new FilmSetRenderer(scene), expectedRoot = new THREE.Group(), expected = new MachineCoreRenderer(expectedRoot);
  t.after(() => { renderer.dispose(); expected.dispose(); globalThis.document = original; });
  const world = new WorldState(); new AgentManager(world).initializeAllAgents();
  const actor = world.agents.get('neo')!;
  Object.assign(actor, { position: filmPosition('film_machine_core', 0, -25), isInMatrix: false, currentLocation: 'film_machine_core' });
  const journey: FilmJourney = { version: 1, scene: 'm3_deus', actor: 'neo', step: 3, completed: [], enteredAt: 0,
    checkpoint: { ...actor.position }, reflections: {}, lastText: '', deus: { ...beats[5], elapsed: .1, total: 9.5 } };
  const fast = { ...beats[5], role: 'neo' };
  actor.currentAction = { type: 'idle', parameters: { deusPact: fast }, startedAt: 0, duration: 1, progress: 0 };
  const sandbox = { neoLife: { journey } } as SandboxState;
  const verify = (beat: DeusPactEncounter | undefined, reason: string) => {
    renderer.update(actor, sandbox, 0, actor.position); expected.update(beat, 0, false, player);
    for (const name of ['machine-core-body-jacks', 'machine-core-neck-probe', 'machine-core-connection-pulse'])
      assert.deepEqual(snapshot(scene, name), snapshot(expectedRoot, name), reason);
  };
  verify(fast, 'body jacks must use the same fast beat as Neo instead of the older world snapshot');
  assert.equal(journey.deus!.elapsed, .1, 'rendering cannot mutate saved world state');
  journey.deus = { ...beats[5], elapsed: .2, total: 9.6, attempts: 1 };
  verify(journey.deus, 'a previous attempt cannot animate the next connection');
  journey.deus = { ...beats[5], elapsed: 2.4, total: 11.8 };
  verify(journey.deus, 'an older actor packet cannot rewind newer saved cabling');
  journey.deus = { ...beats.at(-1)! };
  verify(journey.deus, 'cabling cannot overwrite an already connected phase');
  journey.deus = { ...beats[5], elapsed: .1, total: 9.5 }; actor.id = 'morpheus';
  verify(journey.deus, 'another selected role cannot supply Neo’s performance clock');
  actor.id = 'neo'; journey.visiting = 'm3_deus';
  verify(undefined, 'a visit cannot replay the active negotiation');
  delete journey.visiting; journey.scene = 'm3_neo_carried';
  verify(undefined, 'the next use of this set cannot consume stale connection actions');
});

test('only Neo’s real-world first-person view receives the machine-core golden perception', t => {
  const original = globalThis.document;
  globalThis.document = { createElement: () => ({ width: 0, height: 0, getContext: () => ({
    createImageData: (width: number, height: number) => ({ data: new Uint8ClampedArray(width * height * 4) }),
    putImageData() {}, fillRect() {}, strokeRect() {}, fillText() {}, createRadialGradient: () => ({ addColorStop() {} }),
  }) }) } as unknown as Document;
  const scene = new THREE.Scene(), renderer = new FilmSetRenderer(scene);
  t.after(() => { renderer.dispose(); globalThis.document = original; });
  const world = new WorldState(); new AgentManager(world).initializeAllAgents();
  const journey: FilmJourney = { version: 1, scene: 'm3_deus', actor: 'neo', step: 0, completed: [], enteredAt: 0,
    checkpoint: filmPosition('film_machine_core', 0, -25), reflections: {}, lastText: '', deus: newDeusPact() };
  const sandbox = { neoLife: { journey } } as SandboxState;
  for (const [id, firstPerson, subjective] of [['morpheus', true, false], ['neo', true, true], ['neo', false, false], ['morpheus', true, false]] as const) {
    const actor = world.agents.get(id)!;
    Object.assign(actor, { position: { ...journey.checkpoint }, isInMatrix: false, currentLocation: 'film_machine_core', currentAction: null });
    renderer.update(actor, sandbox, 0, actor.position, undefined, undefined, firstPerson);
    const plates = scene.getObjectByName('machine-core-face-plates') as THREE.InstancedMesh;
    assert.equal((plates.material as THREE.MeshStandardMaterial).emissiveIntensity > 0, subjective,
      `${id}/${firstPerson}: the actual film set must reserve golden perception for Neo`);
    assert.equal(scene.getObjectByName('machine-core-footstep-ripples')!.visible, subjective);
  }
});

test('the audience and body route overlook a layered machine city without adding structures to their playable volume', () => {
  const root = new THREE.Group(), renderer = new MachineCoreRenderer(root);
  try {
    const city = root.getObjectByName('machine-city-exterior');
    assert.ok(city, 'the open audience platform needs a real city below and beyond it');
    root.updateMatrixWorld(true);
    const rays = [new THREE.Vector3(-1, -.35, .4), new THREE.Vector3(1, -.5, .7), new THREE.Vector3(0, -.45, -1)];
    for (const direction of rays) {
      const hits = new THREE.Raycaster(new THREE.Vector3(14, 7, -54), direction.normalize(), 30, 450).intersectObject(city, true);
      assert.ok(hits.some(hit => hit.object instanceof THREE.InstancedMesh), 'looking out during departure must reveal physical city depth');
    }
    const corridor = new THREE.Box3(new THREE.Vector3(-21, -2, -66), new THREE.Vector3(42, 46, 47));
    let triangles = 0, draws = 0;
    city.traverse(object => {
      if (!(object instanceof THREE.Mesh)) return;
      draws++;
      const count = object instanceof THREE.InstancedMesh ? object.count : 1;
      triangles += (object.geometry.index?.count ?? object.geometry.attributes.position.count) / 3 * count;
      if (!(object instanceof THREE.InstancedMesh)) return;
      object.geometry.computeBoundingBox();
      for (let i = 0; i < count; i++) {
        const matrix = new THREE.Matrix4(); object.getMatrixAt(i, matrix); matrix.premultiply(object.matrixWorld);
        assert.equal(object.geometry.boundingBox!.clone().applyMatrix4(matrix).intersectsBox(corridor), false,
          `${object.name}/${i} intrudes into the audience / camera / body route`);
      }
    });
    assert.ok(draws <= 12, `background draw budget: ${draws}`);
    assert.ok(triangles < 350000, `background triangle budget: ${triangles}`);
  } finally { renderer.dispose(); }
});

test('machine-city cold geometry is reproducible, golden perception is reversible and leaving frees its GPU resources once', () => {
  const root = new THREE.Group(), city = new MachineCityRenderer(root);
  const coldRoot = new THREE.Group(), cold = new MachineCityRenderer(coldRoot);
  try { assert.deepEqual(snapshot(root, 'machine-city-exterior'), snapshot(coldRoot, 'machine-city-exterior')); }
  finally { cold.dispose(); }
  const materials = new Set<THREE.Material>(), resources = new Set<THREE.EventDispatcher<{ dispose: {} }>>();
  root.traverse(object => {
    if (!(object instanceof THREE.Mesh)) return;
    resources.add(object.geometry); resources.add(object.material as THREE.Material); materials.add(object.material as THREE.Material);
    if (object instanceof THREE.InstancedMesh) resources.add(object);
  });
  const before = [...materials].map(material => material.toJSON());
  city.setPerception(true);
  assert.notDeepEqual([...materials].map(material => material.toJSON()), before);
  city.setPerception(false);
  assert.deepEqual([...materials].map(material => material.toJSON()), before, 'switching away from Neo’s eyes must restore the cold city');
  const disposed = new Map([...resources].map(resource => [resource, 0]));
  resources.forEach(resource => resource.addEventListener('dispose', () => disposed.set(resource, disposed.get(resource)! + 1)));
  city.dispose();
  assert.equal(root.children.length, 0);
  assert.ok([...disposed.values()].every(count => count === 1), 'changing film sets must release every city buffer/material exactly once');
});
