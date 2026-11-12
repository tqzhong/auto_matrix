import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { FILM_SETS, GOVERNMENT_RESCUE, filmPosition, type FilmJourney } from '@auto_matrix/shared';
import { GovernmentSetRenderer } from '../packages/client/src/engine/GovernmentSetRenderer.js';
import { AgentRenderer } from '../packages/client/src/agents/AgentRenderer.js';
import { AgentManager } from '../packages/server/src/agents/AgentManager.js';
import { WorldState } from '../packages/server/src/world/WorldState.js';

const journey = (scene: 'm1_smith_question' | 'm1_bullet_dodge'): FilmJourney => ({
  version: 1, scene, actor: scene === 'm1_smith_question' ? 'morpheus' : 'neo', step: 0, completed: [], enteredAt: 0,
  checkpoint: { x: 0, y: 1, z: 0 }, reflections: {}, lastText: '',
  government: scene === 'm1_smith_question'
    ? { kind: 'questioning', phase: 'ready', elapsed: 0, attempt: 0, resolve: 1 }
    : { kind: 'rooftop', phase: 'ready', elapsed: 0, attempt: 0, dodges: 0, wounds: 0, resolved: [] },
});

test('executive interrogation set contains physical restraints, drug feed, glass wall and saved alarm effects', () => {
  const root = new THREE.Group(); const renderer = new GovernmentSetRenderer(root, 'film_government_office');
  for (const name of ['government-glass-wall', 'government-restraint-chair', 'government-serum-bag', 'government-sprinklers', 'government-fire-alarm']) {
    assert.ok(root.getObjectByName(name), name);
  }
  const state = journey('m1_smith_question'); renderer.update(state, 2);
  assert.equal(root.getObjectByName('government-sprinklers')!.visible, false);
  state.government!.phase = 'alarm'; state.government!.elapsed = 3.2; renderer.update(state, 8);
  assert.equal(root.getObjectByName('government-sprinklers')!.visible, true);
  assert.ok((root.getObjectByName('government-fire-alarm') as THREE.PointLight).intensity > 20);
  assert.ok(root.getObjectByName('government-serum-bag')!.scale.y > .9);
  const towers = root.children[0].children.filter(child => child.name === 'government-city-tower');
  assert.equal(towers.length, 13); assert.ok(towers.every(tower => tower.position.z < -32), 'the skyline must remain outside the glass wall');
  root.updateMatrixWorld(true); const chair = root.getObjectByName('government-restraint-chair')!;
  const chairBack = root.getObjectByName('government-chair-back'); assert.ok(chairBack);
  assert.ok(chairBack!.getWorldPosition(new THREE.Vector3()).z > chair.getWorldPosition(new THREE.Vector3()).z, 'the backrest belongs behind seated Morpheus');
  renderer.dispose(); assert.equal(root.children.length, 0);
});

test('rooftop set exposes a complete B-212 silhouette and renders each bullet-time firing line', () => {
  const root = new THREE.Group(); const renderer = new GovernmentSetRenderer(root, 'film_government_roof');
  for (const name of ['government-helipad', 'government-helicopter', 'government-main-rotor', 'government-tail-rotor', 'government-skids', 'government-cockpit', 'government-bullet-lines']) {
    assert.ok(root.getObjectByName(name), name);
  }
  const hull = root.getObjectByName('government-helicopter-hull') as THREE.Mesh | undefined; assert.ok(hull);
  assert.ok((hull!.material as THREE.MeshStandardMaterial).color.getHex() > 0x171717, 'the aircraft silhouette retains readable green-grey paint in daylight');
  const state = journey('m1_bullet_dodge'); state.government!.phase = 'bullet_time';
  state.government!.elapsed = GOVERNMENT_RESCUE.rooftop.beats[1]; renderer.update(state, 4);
  const lines = root.getObjectByName('government-bullet-lines')!;
  assert.equal(lines.visible, true); assert.ok(lines.children.some(child => child.visible));
  const rotor = root.getObjectByName('government-main-rotor')!; const before = rotor.rotation.y;
  state.government!.phase = 'downloading'; state.government!.elapsed = 4; renderer.update(state, 7);
  assert.notEqual(rotor.rotation.y, before); assert.equal(lines.visible, false);
  assert.ok((root.getObjectByName('government-cockpit-glow') as THREE.PointLight).intensity > 0);
  renderer.dispose(); assert.equal(root.children.length, 0);
});

test('Jones falls onto the roof and the returned pilot remains on the deck when the pose is restored', t => {
  t.mock.method(THREE.TextureLoader.prototype, 'load', () => new THREE.Texture());
  t.mock.method(GLTFLoader.prototype, 'loadAsync', () => new Promise(() => {}));
  const previous = globalThis.document;
  globalThis.document = { createElement: () => ({ getContext: () => ({
    createImageData: (width: number, height: number) => ({ data: new Uint8ClampedArray(width * height * 4) }), putImageData() {},
    fillRect() {}, strokeRect() {}, fillText() {}, createRadialGradient: () => ({ addColorStop() {} }),
  }) }) } as unknown as Document;
  const world = new WorldState(); new AgentManager(world).initializeAllAgents();
  const scene = new THREE.Scene(), actors = new AgentRenderer(scene);
  t.after(() => { actors.dispose(); globalThis.document = previous; });
  const story = journey('m1_bullet_dodge'), set = FILM_SETS.film_government_roof, floor = set.center.y - 1;
  function pose(id: 'agent_jones' | 'citizen_11', elapsed: number) {
    const actor = world.agents.get(id)!, role = id === 'citizen_11' ? 'pilot' : 'agent_jones';
    const root = GOVERNMENT_RESCUE.rooftop.roots[role];
    actor.position = filmPosition(set.id, root.x, root.z); actor.rotation = root.yaw;
    actor.currentLocation = set.id; actor.isInMatrix = true;
    actor.currentAction = { type: 'idle', parameters: { government: { ...story.government!, phase: 'trinity', elapsed, role } },
      startedAt: 0, duration: 1, progress: 0 };
    actors.updateAgent(id, actor); actors.update(0, undefined, 0, 0, story); scene.updateMatrixWorld(true);
    return actors.getAgentBody(id)!;
  }
  function bounds(body: THREE.Group) {
    const box = new THREE.Box3(), vertex = new THREE.Vector3();
    body.traverseVisible(object => {
      if (!(object instanceof THREE.Mesh)) return;
      const indices = object.geometry.index?.array ?? Array.from({ length: object.geometry.attributes.position.count }, (_, i) => i);
      for (const index of new Set<number>(indices)) box.expandByPoint(object.localToWorld(object.getVertexPosition(index, vertex)));
    });
    return box;
  }
  const pilot = pose('citizen_11', GOVERNMENT_RESCUE.rooftop.trinity);
  assert.ok(pilot.rotation.x > 1.4, 'the returned pilot must lie flat on the roof');
  const final = bounds(pilot);
  assert.ok(final.min.y - floor > -.02 && final.min.y - floor < .035 && final.max.y - floor < 1.45,
    `the pilot silhouette must lie on the deck: ${[final.min.y - floor, final.max.y - floor]}`);
  for (let frame = 0; frame < 4; frame++) actors.update(.05, undefined, 0, 0, story);
  scene.updateMatrixWorld(true); assert.ok(bounds(pilot).equals(final), 'rendering paused frames cannot change the support pose');

  let lastAngle = 0;
  for (const elapsed of [1.75, 1.96, 2.18, 2.39]) {
    const jones = pose('agent_jones', elapsed), shape = bounds(jones);
    assert.ok(jones.rotation.x > lastAngle, `Jones must continue falling at the saved ${elapsed}s`);
    lastAngle = jones.rotation.x;
    assert.ok(Math.abs(shape.min.y - floor - .005) < .025, `Jones leaves the deck at the saved ${elapsed}s: ${shape.min.y - floor}`);
  }
  const upright = pose('citizen_11', 1.1);
  assert.ok(Math.abs(upright.rotation.x) < .01 && bounds(upright).max.y - floor > 3, 'a pre-impact pose cannot retain a previous fall');
});
