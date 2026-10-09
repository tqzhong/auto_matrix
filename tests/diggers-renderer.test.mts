import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from 'three';
import { DIGGERS, newDiggers, type FilmJourney } from '@auto_matrix/shared';
import { DiggersRenderer } from '../packages/client/src/engine/DiggersRenderer.js';
import { CharacterModels } from '../packages/client/src/agents/CharacterModel.js';
import { WorldState } from '../packages/server/src/world/WorldState.js';
import { AgentManager } from '../packages/server/src/agents/AgentManager.js';
import { AgentRenderer } from '../packages/client/src/agents/AgentRenderer.js';
import { ZionHomecomingRenderer } from '../packages/client/src/engine/ZionHomecomingRenderer.js';

function surfaceBounds(root: THREE.Object3D): THREE.Box3 {
  root.updateWorldMatrix(true, true);
  const bounds = new THREE.Box3(), matrix = new THREE.Matrix4();
  root.traverseVisible(object => {
    if (!(object instanceof THREE.Mesh)) return;
    if (!(object instanceof THREE.InstancedMesh)) { bounds.union(new THREE.Box3().setFromObject(object, true)); return; }
    // The cutter instances are boxes, so transforming their eight corners gives the exact surface extent.
    assert.ok(object.geometry instanceof THREE.BoxGeometry);
    object.geometry.computeBoundingBox();
    for (let i = 0; i < object.count; i++) {
      object.getMatrixAt(i, matrix); matrix.premultiply(object.matrixWorld);
      bounds.union(object.geometry.boundingBox!.clone().applyMatrix4(matrix));
    }
  });
  return bounds;
}

test('broken lower legs stay on the floor while the drill chassis settles onto its side', () => {
  const root = new THREE.Group(), renderer = new DiggersRenderer(root), state = newDiggers(1);
  const journey = { scene: 'm3_diggers', diggers: state, completed: [] } as unknown as FilmJourney;
  try {
    renderer.update(journey);
    const body = root.getObjectByName('digger-body')!, upright = new THREE.Box3().setFromObject(body);
    Object.assign(state, { phase: 'collapsing', damage: 3, elapsed: 5.5 }); renderer.update(journey);
    const fallen = surfaceBounds(body);
    assert.ok(fallen.max.y < upright.max.y * .65, `broken feet must not jack the chassis upward: ${fallen.max.y}`);
    assert.ok(Math.abs(fallen.min.y - 1) < .01, 'the fallen chassis must actually touch the floor');
    const parts = [0, 1].map(i => root.getObjectByName(`digger-lower-leg-${i}`)!);
    assert.ok(parts.every(part => part && !body.children.includes(part)), 'fractured lower legs must separate from the falling chassis');
    const final = parts.map(part => part.getWorldPosition(new THREE.Vector3()));
    parts.forEach(part => assert.ok(Math.abs(surfaceBounds(part).min.y - 1) < .01, 'detached metal rests on the floor'));
    state.elapsed = 2; renderer.update(journey);
    parts.forEach((part, i) => assert.ok(part.getWorldPosition(new THREE.Vector3()).distanceTo(final[i]) < .001,
      'a detached lower leg cannot rise with the chassis after it has settled'));
  } finally { renderer.dispose(); }
});

test('the full-height digger and its fallen chassis fit the solid bay without crossing the APU route', () => {
  const root = new THREE.Group(), renderer = new DiggersRenderer(root), state = newDiggers();
  const journey = { scene: 'm3_diggers', diggers: state, completed: [] } as unknown as FilmJourney;
  try {
    renderer.update(journey); root.updateMatrixWorld(true);
    const body = root.getObjectByName('digger-body')!, upright = new THREE.Box3().setFromObject(body);
    assert.ok(upright.max.y - upright.min.y > 30, 'the drill must tower over a four-unit character, not be a miniature beside the APU');
    for (const elapsed of [0, 1, 2.5, 4, 5.5]) {
      Object.assign(state, { phase: 'collapsing', damage: 3, elapsed }); renderer.update(journey);
      const bounds = surfaceBounds(root.getObjectByName('digger-wreck')!), solid = DIGGERS.footprint;
      assert.ok(bounds.min.x >= solid.x - solid.width / 2 && bounds.max.x <= solid.x + solid.width / 2, 'the visible chassis must fit its shared solid footprint');
      assert.ok(bounds.min.z >= solid.z - solid.depth / 2 && bounds.max.z <= solid.z + solid.depth / 2);
      assert.ok(bounds.min.x > 12.3 && bounds.max.x < 107, 'the collapse must clear the APU rail and the dock perimeter');
    }
  } finally { renderer.dispose(); }
});

test('the dock roof support cannot pass through the drill before or during its collapse', () => {
  const root = new THREE.Group(), renderer = new ZionHomecomingRenderer(root, 'film_zion_hangar'), state = newDiggers(1);
  try {
    for (const elapsed of [0, 1, 2.5, 4, 5.5]) {
      Object.assign(state, { damage: 3, phase: 'collapsing', elapsed });
      renderer.update({ scene: 'm3_diggers', diggers: state, completed: [] } as unknown as FilmJourney, 0); root.updateMatrixWorld(true);
      const support = root.getObjectByName('zion-digger-side-support') as THREE.Mesh<THREE.CylinderGeometry>;
      const height = support.geometry.parameters.height;
      for (const offset of [-.18, 0, .18]) {
        const start = support.localToWorld(new THREE.Vector3(offset, height / 2, 0));
        const end = support.localToWorld(new THREE.Vector3(offset, -height / 2, 0)), direction = end.sub(start);
        const hits = new THREE.Raycaster(start, direction.clone().normalize(), 0, direction.length()).intersectObject(root.getObjectByName('digger-body')!, true);
        assert.equal(hits.length, 0, `the actual steel support crosses the drill at ${elapsed}s: ${hits[0]?.point.toArray()}`);
      }
    }
  } finally { renderer.dispose(); }
});

test('visible drill joints match the hit volumes, collapse stays above ground and paused renders are identical', () => {
  const root = new THREE.Group(), renderer = new DiggersRenderer(root), state = newDiggers();
  const journey = { scene: 'm3_diggers', diggers: state, completed: [] } as unknown as FilmJourney;
  renderer.update(journey); root.updateWorldMatrix(true, true);
  for (let i = 0; i < 2; i++) {
    const knee = root.getObjectByName(`digger-knee-${i}`)!.getWorldPosition(new THREE.Vector3());
    const target = DIGGERS.knees[i]; assert.ok(knee.distanceTo(new THREE.Vector3(target.x, target.y + 1, target.z)) < .01);
  }
  state.damage = 1; renderer.update(journey); root.updateWorldMatrix(true, true);
  const second = root.getObjectByName('digger-knee-1')!.getWorldPosition(new THREE.Vector3()), target = DIGGERS.knees[1];
  assert.ok(second.distanceTo(new THREE.Vector3(target.x, target.y + 1, target.z)) < .01, 'the second target remains aligned after the first leg breaks');
  for (const t of [0, 1, 2.5, 4, 5.5]) {
    Object.assign(state, { damage: 3, phase: 'collapsing', elapsed: t }); renderer.update(journey);
    const bounds = surfaceBounds(root.getObjectByName('digger-wreck')!);
    assert.ok(bounds.min.y >= .99, 'actual chassis and broken legs cannot sink through the dock floor');
    assert.ok(bounds.min.x > 12.3, 'the drill cannot cross the central APU walkway or its rail');
    const before = root.getObjectByName('digger-body')!.matrixWorld.clone(); renderer.update(journey); root.updateMatrixWorld(true);
    assert.deepEqual(root.getObjectByName('digger-body')!.matrixWorld.elements, before.elements);
  }
  const geometries = new Set<THREE.BufferGeometry>(); root.traverse(o => { if (o instanceof THREE.Mesh) geometries.add(o.geometry); });
  let disposed = 0; geometries.forEach(g => g.addEventListener('dispose', () => disposed++));
  renderer.dispose(); assert.equal(root.children.length, 0); assert.equal(disposed, geometries.size);
});

test('Charra grips the launcher, Zee loads the breeches, and the actual shoes stay on the floor', t => {
  t.mock.method(THREE.TextureLoader.prototype, 'load', () => new THREE.Texture());
  const previous = globalThis.document;
  globalThis.document = { createElement: () => ({ getContext: () => ({ createImageData: (w: number, h: number) => ({ data: new Uint8ClampedArray(w * h * 4) }), putImageData() {} }) }) } as unknown as Document;
  const world = new WorldState(); new AgentManager(world).initializeAllAgents(); const models = new CharacterModels();
  try {
    for (const role of ['charra', 'zee'] as const) {
      const rig = models.create(world.agents.get(role)!);
      for (const load of [0, .3, .7, 1]) {
        const state = { ...newDiggers(), phase: 'loading' as const, load, role, pitch: -.09 };
        rig.root.position.set(0, 0, role === 'zee' ? -1.95 : 0);
        models.animate(rig, 0, { speed: 0, grounded: true, verticalVelocity: 0, turn: 0, realWorld: true, diggers: state }, 1);
        rig.root.updateWorldMatrix(true, true);
        for (let i = 0; i < 2; i++) {
          const sole = rig.ankles[i].localToWorld(new THREE.Vector3(0, -.155, .13));
          assert.ok(Math.abs(sole.y) < .015, `${role} foot ${i}: ${sole.y}`);
          const palm = rig.elbows[i].localToWorld(new THREE.Vector3(0, -.79, .055));
          const target = role === 'charra' ? rig.diggerProps!.gun.localToWorld(new THREE.Vector3(.05, -.31, i ? .85 : -.12))
            : rig.root.localToWorld(rig.diggerProps!.rounds.position.clone().add(new THREE.Vector3((i ? 1 : -1) * .21, -.12, -.2)));
          assert.ok(palm.distanceTo(target) < .035, `${role} load ${load} hand ${i} gap ${palm.distanceTo(target)}`);
        }
        const gun = rig.diggerProps!.gun.matrixWorld.clone();
        models.animate(rig, 0, { speed: 0, grounded: true, verticalVelocity: 0, turn: 0, realWorld: true, diggers: state }, 1);
        rig.root.updateWorldMatrix(true, true); assert.deepEqual(rig.diggerProps!.gun.matrixWorld.elements, gun.elements);
      }
      const walking = { speed: 4, grounded: true, verticalVelocity: 0, turn: 0, realWorld: true,
        diggers: { ...newDiggers(), phase: 'done' as const, role } };
      models.animate(rig, .15, walking, 1); const knee = rig.knees[0].quaternion.clone();
      models.animate(rig, .2, walking, 1);
      assert.ok(knee.angleTo(rig.knees[0].quaternion) > .02, `${role} must keep walking after the drill falls`);
    }
  } finally { models.dispose(); globalThis.document = previous; }
});

test('first person retains Charra’s launcher and arms, hides only her head, and restores third person', t => {
  t.mock.method(THREE.TextureLoader.prototype, 'load', () => new THREE.Texture());
  const previous = globalThis.document;
  const context = { createRadialGradient: () => ({ addColorStop() {} }), fillRect() {}, fillText() {}, strokeRect() {},
    createImageData: (w: number, h: number) => ({ data: new Uint8ClampedArray(w * h * 4) }), putImageData() {} };
  globalThis.document = { createElement: () => ({ getContext: () => context }) } as unknown as Document;
  const world = new WorldState(); new AgentManager(world).initializeAllAgents();
  const renderer = new AgentRenderer(new THREE.Scene());
  try {
    const actor = world.agents.get('charra')!, diggers = { ...newDiggers(), phase: 'aiming' as const, role: 'charra' as const };
    actor.isInMatrix = false; actor.currentAction = { type: 'idle', parameters: { diggers }, startedAt: 0, duration: 1e9, progress: 0 };
    renderer.updateAgent(actor.id, actor); renderer.setWorld(false); renderer.setPlayer('charra', true);
    renderer.setPlayerMotion({ speed: 0, grounded: true, verticalVelocity: 0, turn: 0, diggers, firstPerson: true }); renderer.update(0);
    const body = renderer.getAgentBody('charra')!;
    assert.ok(body.visible, 'first-person aiming must render the held weapon');
    assert.ok(body.getObjectByName('charra-double-launcher')!.visible);
    body.updateWorldMatrix(true, true);
    assert.ok(Math.abs(body.getWorldPosition(new THREE.Vector3()).y - actor.position.y) < .001, 'boots must meet the raised duct floor');
    assert.equal(body.getObjectByName('charra-head')!.visible, false);
    renderer.setPlayer('charra', false); renderer.update(0);
    assert.equal(body.getObjectByName('charra-head')!.visible, true);
  } finally { renderer.dispose(); globalThis.document = previous; }
});
