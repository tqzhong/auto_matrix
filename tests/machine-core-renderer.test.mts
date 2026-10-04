import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from 'three';
import { filmPosition, newDeusPact, type DeusPactEncounter, type FilmJourney, type SandboxState } from '@auto_matrix/shared';
import { MachineCoreRenderer } from '../packages/client/src/engine/MachineCoreRenderer.js';
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
const names = ['machine-core-swarm', 'machine-core-face', 'machine-core-seat', 'machine-core-connection-pulse'];
const beats: DeusPactEncounter[] = [
  { ...newDeusPact(), phase: 'swarm', elapsed: 1.4, total: 1.4, resolve: 1.1 },
  { ...newDeusPact(), phase: 'warning', elapsed: 1.2, total: 6.3, resolve: 3 },
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
    for (const [beat, name] of [[beats[0], names[0]], [beats[1], names[1]], [beats[4], names[3]]] as const) {
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
    checkpoint: { ...actor.position }, reflections: {}, lastText: '', deus: { ...beats[2], elapsed: .1, total: 9.5 } };
  const fast = { ...beats[2], role: 'neo' };
  actor.currentAction = { type: 'idle', parameters: { deusPact: fast }, startedAt: 0, duration: 1, progress: 0 };
  const sandbox = { neoLife: { journey } } as SandboxState;
  const verify = (beat: DeusPactEncounter | undefined, reason: string) => {
    renderer.update(actor, sandbox, 0, actor.position); expected.update(beat, 0, false, player);
    for (const name of ['machine-core-body-jacks', 'machine-core-neck-probe', 'machine-core-connection-pulse'])
      assert.deepEqual(snapshot(scene, name), snapshot(expectedRoot, name), reason);
  };
  verify(fast, 'body jacks must use the same fast beat as Neo instead of the older world snapshot');
  assert.equal(journey.deus!.elapsed, .1, 'rendering cannot mutate saved world state');
  journey.deus = { ...beats[2], elapsed: .2, total: 9.6, attempts: 1 };
  verify(journey.deus, 'a previous attempt cannot animate the next connection');
  journey.deus = { ...beats[2], elapsed: 2.4, total: 11.8 };
  verify(journey.deus, 'an older actor packet cannot rewind newer saved cabling');
  journey.deus = { ...beats[4] };
  verify(journey.deus, 'cabling cannot overwrite an already connected phase');
  journey.deus = { ...beats[2], elapsed: .1, total: 9.5 }; actor.id = 'morpheus';
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
