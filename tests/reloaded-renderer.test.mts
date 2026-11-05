import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { FILM_SETS, RELOADED, newReloaded, reloadedRoot, filmPosition, playerBlocked, type FilmJourney, type SandboxState } from '@auto_matrix/shared';
import { FilmSetRenderer } from '../packages/client/src/engine/FilmSetRenderer.js';
import { AgentRenderer } from '../packages/client/src/agents/AgentRenderer.js';
import { ReloadedOpeningRenderer } from '../packages/client/src/engine/ReloadedOpeningRenderer.js';
import { reloadedCamera } from '../packages/client/src/player/ReloadedCamera.js';
import { AgentManager } from '../packages/server/src/agents/AgentManager.js';
import { WorldState } from '../packages/server/src/world/WorldState.js';

const journey = (kind: 'dream' | 'meeting'): FilmJourney => ({ version: 1, scene: kind === 'dream' ? 'm2_dream' : 'm2_meeting', actor: kind === 'dream' ? 'trinity' : 'neo', step: 0, completed: [], enteredAt: 0, checkpoint: { x: 0, y: 0, z: 0 }, reflections: {}, lastText: '', reloaded: newReloaded(kind) });

test('meeting geometry leaves the central passage and both evacuation exits traversable', () => {
  const set = FILM_SETS.film_captains_meeting;
  for (let z = -32; z <= 13; z += .5) assert.equal(playerBlocked(filmPosition(set.id, 0, z), true), false, `central aisle ${z}`);
  for (const side of [-1, 1]) for (let x = 0; x <= 21; x += .5) assert.equal(playerBlocked(filmPosition(set.id, side * x, 28), true), false, `exit ${side * x}`);
  assert.equal(playerBlocked(filmPosition(set.id, 0, 20), true), true, 'the visible folding table has collision');
  assert.equal(playerBlocked(filmPosition(set.id, 13, 8), true), true, 'brick walls have collision');
  const state = { ...newReloaded('meeting'), phase: 'report' as const };
  for (const role of ['trinity', 'morpheus', 'niobe', 'ballard', 'ghost', 'soren']) {
    const actor = reloadedRoot(state, role); const dx = -actor.x; const dz = 20 - actor.z;
    assert.ok((Math.sin(actor.yaw) * dx + Math.cos(actor.yaw) * dz) / Math.hypot(dx, dz) > .95, `${role} must face the briefing table`);
    for (const exit of ['east', 'west'] as const) for (let frame = 0; frame <= RELOADED.evacuation * 20; frame++) {
      const point = reloadedRoot({ ...state, phase: 'breach', exit, evacuation: frame / 20 }, role);
      assert.equal(playerBlocked(filmPosition(set.id, point.x, point.z), true, .75), false, `${role} clips the ${exit} exit at ${frame / 20}s`);
    }
  }
  for (const role of RELOADED.agents) {
    const waiting = reloadedRoot({ ...state, phase: 'breach', elapsed: 1 }, role);
    assert.ok(waiting.z < -22, 'agents wait outside until the iron door gives way');
    for (let elapsed = 0; elapsed <= RELOADED.breach; elapsed += .05) {
      const entering = reloadedRoot({ ...state, phase: 'breach', elapsed }, role);
      assert.equal(playerBlocked(filmPosition(set.id, entering.x, entering.z), true), false, 'agents enter through the opening, not the brickwork');
    }
  }
});

test('renderer uses saved dream time, opens the real door and releases all owned GPU resources', () => {
  for (const set of ['film_trinity_roof', 'film_captains_meeting', 'film_neb_deck'] as const) {
    const root = new THREE.Group(); root.position.set(5000, 1, 5000); root.updateMatrixWorld(true);
    const renderer = new ReloadedOpeningRenderer(root, set); const state = journey(set === 'film_trinity_roof' ? 'dream' : 'meeting');
    const disposals: string[] = []; renderer.group.traverse(object => { if (object instanceof THREE.Mesh) object.geometry.addEventListener('dispose', () => disposals.push(object.uuid)); });
    if (set === 'film_trinity_roof') {
      state.reloaded!.phase = 'falling'; state.reloaded!.elapsed = 3.2; renderer.update(state);
      assert.equal(renderer.group.getObjectByName('dream-intact-window')!.visible, false);
      const shards = renderer.group.getObjectByName('dream-glass-shards')!; const before = shards.children.map(child => child.position.clone()); renderer.update(structuredClone(state));
      shards.children.forEach((child, i) => assert.ok(child.position.equals(before[i]), 'pause does not advance glass'));
    } else if (set === 'film_captains_meeting') {
      state.reloaded!.phase = 'combat'; renderer.update(state); assert.ok(Math.abs(renderer.group.getObjectByName('captains-entry-door')!.rotation.y) > 1);
    }
    const bounds = new THREE.Box3().setFromObject(root); assert.ok(bounds.min.x > 4900 && bounds.max.x < 5100, 'batching must not apply the world origin twice');
    renderer.dispose(); assert.equal(root.children.length, 0); assert.ok(disposals.length > 0);
  }
});

test('fall cameras remain outside the facade and first person turns with the input heading', () => {
  const state = { ...newReloaded('dream'), phase: 'falling' as const, elapsed: 4, drift: 2 };
  const root = reloadedRoot(state, 'trinity'); const position = filmPosition(root.set, root.x, root.z); position.y += root.y;
  for (const aspect of [16 / 9, 9 / 16]) {
    const camera = reloadedCamera({ ...state, role: 'trinity' }, position, root.set, false, aspect, 0, 0);
    assert.ok(camera.eye.z < FILM_SETS[root.set].center.z - 20); assert.ok(camera.eye.distanceTo(camera.target) > 8);
  }
  const a = reloadedCamera({ ...state, role: 'trinity' }, position, root.set, true, 1, 0, 0);
  const b = reloadedCamera({ ...state, role: 'trinity' }, position, root.set, true, 1, Math.PI / 2, .2);
  assert.ok(a.eye.equals(b.eye)); assert.ok(a.target.distanceTo(b.target) > 1);
  assert.ok(a.target.z > a.eye.z); assert.ok(b.target.x > b.eye.x); assert.ok(b.target.y < b.eye.y);
});

test('dream framing keeps both Trinity and the shooting agent in view throughout the fall', () => {
  for (const elapsed of [1.3, 3.2, 5.1, 7.2]) for (const aspect of [16 / 9, 9 / 16]) {
    const state = { ...newReloaded('dream'), phase: 'falling' as const, elapsed };
    const root = reloadedRoot(state, 'trinity'); const position = filmPosition(root.set, root.x, root.z); position.y += root.y;
    const frame = reloadedCamera({ ...state, role: 'trinity' }, position, root.set, false, aspect, 0, 0);
    const camera = new THREE.PerspectiveCamera(60, aspect, .1, 300); camera.position.copy(frame.eye); camera.lookAt(frame.target); camera.updateMatrixWorld(true);
    for (const role of ['trinity', 'agent_johnson']) {
      const body = reloadedRoot(state, role); const p = filmPosition(body.set, body.x, body.z); p.y += body.y + 2;
      const screen = new THREE.Vector3(p.x, p.y, p.z).project(camera);
      assert.ok(Math.abs(screen.x) < .88 && Math.abs(screen.y) < .88, `${role} outside framing at ${elapsed}, ${aspect}: ${screen.toArray()}`);
    }
  }
});

test('the departure camera stays outside the vault from liftoff to the end', () => {
  const set = FILM_SETS.film_captains_meeting;
  for (const [phase, elapsed] of [['departing', 0], ['departing', 1.6], ['done', 0]] as const) {
    const state = { ...newReloaded('meeting'), phase, elapsed };
    const root = reloadedRoot(state, 'neo'); const position = filmPosition(root.set, root.x, root.z); position.y += root.y;
    for (const aspect of [16 / 9, 9 / 16]) {
      const view = reloadedCamera({ ...state, role: 'neo' }, position, root.set, false, aspect, 0, 0);
      assert.ok(view.eye.z < set.center.z - 21 && view.target.z < set.center.z - 21, 'the vault cannot obscure the ascent');
    }
  }
});

test('the meeting adopts the prepared hall and warms the breach cast with the live light slots', t => {
  const scene = new THREE.Scene(), sets = new FilmSetRenderer(scene), world = new WorldState();
  new AgentManager(world).initializeAllAgents();
  const neo = world.agents.get('neo')!, state = journey('meeting');
  const sandbox = { neoLife: { journey: state } } as SandboxState;
  neo.position = filmPosition('film_neb_deck', -7, 25.7); neo.isInMatrix = false;
  state.reloaded!.phase = 'connecting'; sets.update(neo, sandbox, 0);
  const geometry = new THREE.BoxGeometry(), material = new THREE.MeshStandardMaterial();
  const actor = new THREE.Group(), enemy = new THREE.Mesh(geometry, material); actor.add(enemy);
  t.after(() => { sets.dispose(); geometry.dispose(); material.dispose(); });
  let preview: THREE.Scene | undefined, enemySlots: number | undefined;
  const pointSlots = (root: THREE.Scene) => {
    let count = 0;
    root.traverseVisible(object => { if (object instanceof THREE.PointLight) count++; });
    return count;
  };
  const graphics = { extensions: { has: () => true }, info: { programs: [] }, getRenderTarget: () => null,
    setRenderTarget() {}, properties: { get: () => ({}) },
    compile(subject: THREE.Group, _camera: THREE.Camera, target: THREE.Scene) {
      if (target.getObjectByName('captains-entry-door')) preview = target;
      subject.traverse(object => { if (object === enemy) enemySlots = pointSlots(target); });
    } } as unknown as THREE.WebGLRenderer;
  const camera = new THREE.PerspectiveCamera();
  const prepare = () => sets.prepareCaptainsMeeting(graphics, camera, state, id => id === 'agent_thompson' ? actor : undefined);
  prepare();
  const door = preview?.getObjectByName('captains-entry-door');
  assert.ok(door && !scene.getObjectByName(door.name));
  assert.equal(pointSlots(preview!), 9);

  state.reloaded!.phase = 'report_ready'; neo.position = filmPosition('film_captains_meeting', 0, 31); neo.isInMatrix = true;
  sets.update(neo, sandbox, 1);
  assert.ok(scene.getObjectByName(door.name) === door);
  assert.equal(sets.stablePointSlots, true);
  assert.equal(pointSlots(scene), 9);
  state.reloaded!.phase = 'earpiece_ready';
  prepare(); assert.equal(enemySlots, 9);
  state.reloaded!.phase = 'combat'; sets.update(neo, sandbox, 2);
  assert.ok(door.rotation.y > 1);
});

test('the meeting defers offscreen skin shading and resumes it when the camera turns', t => {
  const originalDocument = globalThis.document;
  const context = { createRadialGradient: () => ({ addColorStop() {} }), fillRect() {}, strokeRect() {}, fillText() {},
    createImageData: (width: number, height: number) => ({ data: new Uint8ClampedArray(width * height * 4) }), putImageData() {} };
  globalThis.document = { createElement: () => ({ width: 0, height: 0, getContext: () => context }) } as unknown as Document;
  t.mock.method(THREE.TextureLoader.prototype, 'load', () => new THREE.Texture());
  const renderer = new AgentRenderer(new THREE.Scene());
  t.after(() => { renderer.dispose(); globalThis.document = originalDocument; });
  const world = new WorldState(); new AgentManager(world).initializeAllAgents();
  const observer = world.agents.get('citizen_1')!;
  observer.position = filmPosition('film_captains_meeting', 8, 28); observer.isInMatrix = true; observer.currentLocation = 'film_captains_meeting';
  renderer.updateAgent(observer.id, observer); renderer.setPlayer('neo');
  const flags: boolean[] = [];
  t.mock.method(renderer['models'], 'animate', (_rig, _delta, input) => flags.push(Boolean(input.skipSkinContinuity)));
  const state = journey('meeting'); state.reloaded!.phase = 'combat';
  const camera = new THREE.PerspectiveCamera(60, 16 / 9, .1, 120);
  camera.position.copy(filmPosition('film_captains_meeting', 0, 2)); camera.position.y += 3;
  camera.lookAt(camera.position.x, camera.position.y, camera.position.z - 10); renderer.update(.02, camera, 1, 0, state);
  assert.equal(renderer.getAgent(observer.id)?.visible, true);
  camera.lookAt(observer.position.x, observer.position.y + 2, observer.position.z); renderer.update(.02, camera, 1, 0, state);
  assert.deepEqual(flags, [true, false]);
});

test('completed scene revisits retain their environment without replaying the current encounter', () => {
  const renderer = new ReloadedOpeningRenderer(new THREE.Group(), 'film_captains_meeting');
  const current = journey('dream'); current.visiting = 'm2_meeting';
  const saved = structuredClone(current); renderer.update(current);
  assert.equal(renderer.group.visible, true, 'the meeting hall must not disappear during a revisit');
  assert.ok(Math.abs(renderer.group.getObjectByName('captains-entry-door')!.rotation.y) > 1);
  assert.deepEqual(current, saved, 'rendering a revisit cannot alter the saved journey');
  renderer.dispose();
});
