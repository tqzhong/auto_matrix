import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { FILM_SETS, WETWALL_SHAFT, filmPosition, playerBlocked, type FilmJourney, type SandboxState, type SixthEncounter } from '@auto_matrix/shared';
import { WetwallRenderer } from '../packages/client/src/engine/WetwallRenderer.js';
import { FilmSetRenderer } from '../packages/client/src/engine/FilmSetRenderer.js';
import { AgentRenderer } from '../packages/client/src/agents/AgentRenderer.js';
import { WorldState } from '../packages/server/src/world/WorldState.js';
import { AgentManager } from '../packages/server/src/agents/AgentManager.js';

test('room 608 has solid plaster before discovery, a visible gunfire hole, and a real opening for Morpheus after breach', () => {
  const root = new THREE.Group(), material = new THREE.MeshStandardMaterial();
  const renderer = new WetwallRenderer(root, { plaster: material, wood: material, iron: material, trim: material });
  const encounter = { phase: 'searching', elapsed: 3, starts: {} } as SixthEncounter;
  const journey = { scene: 'm1_wall_exposed', wallExposure: encounter, wetwall: { phase: 'done' } } as FilmJourney;
  const blocked = (x: number) => {
    renderer.update(journey); root.updateMatrixWorld(true);
    const hits = new THREE.Raycaster(new THREE.Vector3(x, WETWALL_SHAFT.sixth + 2.8, -32.2), new THREE.Vector3(0, 0, 1), 0, 2).intersectObject(root, true);
    return hits.some(hit => { for (let object: THREE.Object3D | null = hit.object; object; object = object.parent) if (!object.visible) return false; return hit.object instanceof THREE.Mesh && hit.object.castShadow; });
  };
  try {
    assert.equal(blocked(-15.5), true);
    encounter.phase = 'firing'; encounter.elapsed = .3;
    assert.equal(blocked(-15.5), false, 'the bullet hole must expose the room, not be a decal on an opaque wall');
    assert.equal(blocked(-18), true, 'Morpheus cannot have a full opening before he crashes through the lath');
    encounter.phase = 'breach'; encounter.elapsed = 1;
    assert.equal(blocked(-18), false);
  } finally { renderer.dispose(); material.dispose(); }
});

test('the bathroom sink and toilet block walking while the sixth-floor combat lane stays clear', () => {
  const center = FILM_SETS.film_ambush_house.center;
  const position = (x: number, z: number) => ({ x: center.x + x, y: center.y + WETWALL_SHAFT.sixth, z: center.z + z });
  assert.equal(playerBlocked(position(-13.95, -27.5), true, .2), true, 'the sink cannot be a walk-through prop');
  assert.equal(playerBlocked(position(-20.95, -28.25), true, .2), true, 'the toilet must share its visible footprint with movement');
  assert.equal(playerBlocked(position(-15.5, -27.2), true, 1.1), false);
  assert.equal(playerBlocked(position(-15.5, -24.8), true, 1.1), false);
});

test('the approach, pipe chase and bathroom retain the building as the physical opening changes', t => {
  t.mock.method(THREE.TextureLoader.prototype, 'load', () => new THREE.Texture());
  const retained = new FilmSetRenderer(new THREE.Scene()), direct = new FilmSetRenderer(new THREE.Scene());
  t.after(() => { retained.dispose(); direct.dispose(); });
  const world = new WorldState(); new AgentManager(world).initializeAllAgents();
  const neo = world.agents.get('neo')!, morpheus = world.agents.get('morpheus')!;
  neo.isInMatrix = morpheus.isInMatrix = true;
  neo.position = filmPosition('film_ambush_house', -15.5, -32.2); neo.position.y += WETWALL_SHAFT.sixth;
  morpheus.position = filmPosition('film_ambush_house', -15.5, -27.2); morpheus.position.y += WETWALL_SHAFT.sixth;
  const journey = { scene: 'm1_dejavu', actor: neo.id, step: 0, completed: [] } as unknown as FilmJourney;
  const sandbox = { neoLife: { journey } } as SandboxState;
  retained.update(neo, sandbox, 0);
  const room = retained.root.getObjectByName('room-608')!;
  const floor = room.children.find(object => object instanceof THREE.Mesh) as THREE.Mesh;
  let disposed = 0; floor.geometry.addEventListener('dispose', () => disposed++);
  journey.scene = 'm1_wetwall'; retained.update(neo, sandbox, 1);
  assert.ok(retained.root.getObjectByName(room.name) === room);
  journey.scene = 'm1_wall_exposed'; journey.wallExposure = { phase: 'searching', elapsed: 3, starts: {} } as SixthEncounter;
  retained.update(neo, sandbox, 2);
  const panel = retained.root.getObjectByName('sixth-breakable-plaster')!;
  assert.equal(panel.visible, true);
  journey.scene = 'm1_bathroom'; journey.actor = morpheus.id; journey.wallExposure.phase = 'done';
  retained.update(morpheus, sandbox, 3); direct.update(morpheus, sandbox, 3);
  assert.ok(retained.root.getObjectByName(room.name) === room);
  assert.equal(disposed, 0); assert.equal(panel.visible, false);
  const snapshot = (root: THREE.Group) => {
    const values: unknown[] = [];
    root.traverse(object => values.push([object.name, object.type, object.visible, object.position.toArray(), object.rotation.toArray(),
      object instanceof THREE.Mesh ? object.geometry.attributes.position.count : undefined,
      object instanceof THREE.Light ? [object.color.getHex(), object.intensity, object.castShadow] : undefined]));
    return values;
  };
  assert.deepEqual(snapshot(retained.root), snapshot(direct.root), 'the handed-off bathroom matches a direct saved load');
  retained.update(undefined, undefined, 4);
  assert.equal(disposed, 1);
});

test('a police replacement hides the unused body, label and contact shadow in both directions', t => {
  t.mock.method(THREE.TextureLoader.prototype, 'load', () => new THREE.Texture());
  t.mock.method(GLTFLoader.prototype, 'loadAsync', () => new Promise(() => {}));
  const document = globalThis.document;
  globalThis.document = { createElement: () => ({ getContext: () => ({ createRadialGradient: () => ({ addColorStop() {} }), fillRect() {}, strokeRect() {}, fillText() {},
    createImageData: (w: number, h: number) => ({ data: new Uint8ClampedArray(w * h * 4) }), putImageData() {} }) }) } as unknown as Document;
  const world = new WorldState(); new AgentManager(world).initializeAllAgents(); const renderer = new AgentRenderer(new THREE.Scene());
  try {
    for (const [role, elapsed] of [['smith', .7], ['citizen_4', 1.4]] as const) {
      const actor = world.agents.get(role)!; actor.isInMatrix = true;
      actor.currentAction = { type: 'idle', parameters: { resolved: true, sixth: { role, phase: 'replacing', elapsed, covered: false, cover: 0, aim: 0,
        start: { x: -17.5, y: WETWALL_SHAFT.sixth, z: -20.6, yaw: Math.PI } } }, startedAt: 0, duration: 1, progress: 0 };
      renderer.updateAgent(role, actor); renderer.setSelected(role); renderer.update(0);
      const entry = (renderer as unknown as { agents: Map<string, { body: THREE.Group; label: THREE.Sprite; shadow: THREE.Mesh }> }).agents.get(role)!;
      assert.equal(entry.body.visible, false); assert.equal(entry.label.visible, false, `${role} still has a floating label`);
      assert.equal(entry.shadow.visible, false, `${role} still leaves a ghost shadow`);
    }
  } finally { renderer.dispose(); globalThis.document = document; }
});
