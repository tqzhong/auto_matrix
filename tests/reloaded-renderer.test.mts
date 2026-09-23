import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { FILM_SETS, RELOADED, newReloaded, reloadedRoot, filmPosition, playerBlocked, type FilmJourney } from '@auto_matrix/shared';
import { ReloadedOpeningRenderer } from '../packages/client/src/engine/ReloadedOpeningRenderer.js';
import { reloadedCamera } from '../packages/client/src/player/ReloadedCamera.js';

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

test('completed scene revisits retain their environment without replaying the current encounter', () => {
  const renderer = new ReloadedOpeningRenderer(new THREE.Group(), 'film_captains_meeting');
  const current = journey('dream'); current.visiting = 'm2_meeting';
  const saved = structuredClone(current); renderer.update(current);
  assert.equal(renderer.group.visible, true, 'the meeting hall must not disappear during a revisit');
  assert.ok(Math.abs(renderer.group.getObjectByName('captains-entry-door')!.rotation.y) > 1);
  assert.deepEqual(current, saved, 'rendering a revisit cannot alter the saved journey');
  renderer.dispose();
});
