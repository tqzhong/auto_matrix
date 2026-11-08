import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { FILM_SETS, WETWALL_SHAFT, filmPosition, playerBlocked, sixthPose, type FilmJourney, type SandboxState, type SixthEncounter } from '@auto_matrix/shared';
import { WetwallRenderer } from '../packages/client/src/engine/WetwallRenderer.js';
import { SixthFloorRenderer } from '../packages/client/src/engine/SixthFloorRenderer.js';
import { FilmSetRenderer } from '../packages/client/src/engine/FilmSetRenderer.js';
import { AgentRenderer } from '../packages/client/src/agents/AgentRenderer.js';
import { WorldState } from '../packages/server/src/world/WorldState.js';
import { AgentManager } from '../packages/server/src/agents/AgentManager.js';

test('sixth-floor flashlights retain shadow slots through the approach and replacement without lighting or rendering dormant shadows', () => {
  const root = new THREE.Group(), material = new THREE.MeshStandardMaterial();
  const renderer = new SixthFloorRenderer(root, { plaster: material, wood: material, iron: material, trim: material });
  const lights: THREE.SpotLight[] = []; root.traverse(object => { if (object instanceof THREE.SpotLight) lights.push(object); });
  const roles = ['citizen_4', 'citizen_14'] as const;
  const encounter = { phase: 'ready', elapsed: 0, starts: {
    citizen_4: { x: -17.5, y: WETWALL_SHAFT.sixth, z: -20.6, yaw: Math.PI },
    citizen_14: { x: -19.2, y: WETWALL_SHAFT.sixth, z: -19.5, yaw: Math.PI },
  } } as SixthEncounter;
  const cases: [FilmJourney['scene'], SixthEncounter['phase'], number, number[]][] = [
    ['m1_dejavu', 'ready', 0, [0, 0]], ['m1_wetwall', 'ready', 0, [0, 0]],
    ['m1_wall_exposed', 'ready', 0, [95, 95]], ['m1_wall_exposed', 'searching', 3, [95, 95]],
    ['m1_wall_exposed', 'firing', .3, [95, 95]], ['m1_wall_exposed', 'cover', 1, [95, 95]],
    ['m1_wall_exposed', 'replacing', .8, [0, 95]], ['m1_wall_exposed', 'replacing', 1.5, [0, 95]],
    ['m1_wall_exposed', 'rushing', .6, [0, 18]], ['m1_wall_exposed', 'grapple', .9, [0, 18]],
    ['m1_wall_exposed', 'breach', 1, [0, 18]], ['m1_wall_exposed', 'done', 0, [0, 18]],
    ['m1_bathroom', 'done', 0, [0, 18]], ['m1_wall_exposed', 'failed', 0, [0, 95]],
    ['m1_wetwall', 'done', 0, [0, 0]],
  ];
  try {
    assert.equal(lights.length, 2);
    for (const [scene, phase, elapsed, energies] of cases) {
      encounter.phase = phase; encounter.elapsed = elapsed;
      lights.forEach(light => { light.shadow.needsUpdate = true; });
      renderer.update({ scene, wallExposure: encounter } as FilmJourney);
      const visible: THREE.SpotLight[] = []; root.traverseVisible(object => { if (object instanceof THREE.SpotLight) visible.push(object); });
      assert.deepEqual(visible.map(light => light.id), lights.map(light => light.id), 'dormant flashlights must retain their shader slots');
      for (const [index, light] of lights.entries()) {
        assert.equal(light.castShadow, true); assert.equal(light.intensity, energies[index]);
        assert.equal(light.shadow.autoUpdate, energies[index] > 0);
        if (!energies[index]) assert.equal(light.shadow.needsUpdate, false, 'a dormant shadow must not allocate or render a map');
        assert.deepEqual(light.shadow.mapSize.toArray(), [512, 512]); assert.equal(light.shadow.normalBias, .045);
        assert.equal(light.color.getHex(), 0xdde5d4); assert.equal(light.distance, 15); assert.equal(light.angle, .27); assert.equal(light.penumbra, .45); assert.equal(light.decay, 2);
        if (scene === 'm1_wall_exposed' || scene === 'm1_bathroom') {
          const pose = sixthPose({ ...encounter, role: roles[index], start: encounter.starts[roles[index]] });
          assert.deepEqual(light.position.toArray(), [pose.x + Math.sin(pose.yaw) * 1.85, pose.y + 3, pose.z + Math.cos(pose.yaw) * 1.85]);
          assert.deepEqual(light.target.position.toArray(), [pose.x + Math.sin(pose.yaw) * 5, pose.y + 2.9, pose.z + Math.cos(pose.yaw) * 5]);
        }
      }
    }
  } finally { renderer.dispose(); material.dispose(); }
});

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
