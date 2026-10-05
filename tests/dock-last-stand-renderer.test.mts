import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from 'three';
import { dockLastStandPose, newDockLastStand, type DockLastStandGesture, type FilmJourney } from '@auto_matrix/shared';
import { CharacterModels, type CharacterRig } from '../packages/client/src/agents/CharacterModel.js';
import { ZionHomecomingRenderer } from '../packages/client/src/engine/ZionHomecomingRenderer.js';
import { WorldState } from '../packages/server/src/world/WorldState.js';
import { AgentManager } from '../packages/server/src/agents/AgentManager.js';

function vertices(rig: CharacterRig) {
  const result: THREE.Vector3[] = [];
  rig.root.updateWorldMatrix(true, true);
  rig.detail.traverseVisible(object => {
    if (!(object instanceof THREE.Mesh)) return;
    object.updateMatrixWorld(true);
    if (object instanceof THREE.SkinnedMesh) object.skeleton.update();
    for (let i = 0; i < object.geometry.attributes.position.count; i++) result.push(object.localToWorld(object.getVertexPosition(i, new THREE.Vector3())));
  });
  return result;
}

test('last stand sentinel segments, sparks and cockpit damage freeze at the saved attack time', () => {
  const root = new THREE.Group(), set = new ZionHomecomingRenderer(root, 'film_zion_hangar');
  const encounter = { ...newDockLastStand(), phase: 'attack' as const, elapsed: 1.9, total: 1.9 };
  const journey = { scene: 'm3_dock_battle', actor: 'kid', step: 2, completed: [], dockLastStand: encounter } as unknown as FilmJourney;
  set.update(journey, 1); root.updateWorldMatrix(true, true);
  const sentinel = root.getObjectByName('mifune-attacking-sentinel')!, arms = root.getObjectByName('mifune-sentinel-segments') as THREE.InstancedMesh;
  const before = sentinel.matrixWorld.clone(), matrices = Float32Array.from(arms.instanceMatrix.array);
  assert.equal(root.getObjectByName('mifune-last-stand')!.visible, true);
  assert.equal(root.getObjectByName('mifune-cockpit-sparks')!.visible, true);
  set.update(journey, 400); root.updateWorldMatrix(true, true);
  assert.deepEqual(sentinel.matrixWorld.elements, before.elements);
  assert.deepEqual(arms.instanceMatrix.array, matrices, 'wall clock must not make attack arms keep moving while paused');
  encounter.elapsed = 4.6; set.update(journey, 401);
  assert.ok(root.getObjectByName('apu-upper-rail')!.rotation.z < -.1);
  encounter.elapsed = 1.1; set.update(journey, 401);
  const firing = root.getObjectByName('apu-muzzle-1')!;
  assert.equal(firing.visible, true);
  set.update(journey, 700); assert.equal(firing.visible, true, 'the last cannon burst uses the saved attack clock');
  journey.dockLastStand!.phase = 'wounded'; set.update(journey, 402);
  assert.equal(root.getObjectByName('mifune-last-stand')!.visible, false);
  assert.equal(firing.visible, false);
  set.dispose(); assert.equal(root.children.length, 0);
});

test('Mifune lies on the actual ground without entering the APU, and Kid keeps planted soles through kneeling and rising', t => {
  t.mock.method(THREE.TextureLoader.prototype, 'load', () => new THREE.Texture());
  const previous = globalThis.document;
  globalThis.document = { createElement: () => ({ getContext: () => ({ createImageData: (w: number, h: number) => ({ data: new Uint8ClampedArray(w * h * 4) }), putImageData() {} }) }) } as unknown as Document;
  const world = new WorldState(); new AgentManager(world).initializeAllAgents(); const models = new CharacterModels();
  try {
    const captain = models.create(world.agents.get('mifune')!), kid = models.create(world.agents.get('kid')!);
    const draw = (rig: CharacterRig, gesture: DockLastStandGesture) => {
      models.animate(rig, 0, { speed: 0, grounded: true, verticalVelocity: 0, turn: 0, realWorld: true, dockLastStand: gesture }, 1);
      return vertices(rig);
    };
    for (const [phase, elapsed] of [['attack', 0], ['attack', 2.7], ['attack', 3.4], ['attack', 4.5], ['wounded', 0], ['orders', 2.5], ['dying', 1.5], ['done', 0]] as const) {
      const gesture = { ...newDockLastStand(), role: 'mifune' as const, phase, elapsed, total: elapsed + 5 };
      const pose = dockLastStandPose(gesture); captain.root.position.set(pose.mifune.x, pose.mifune.y, pose.mifune.z); captain.root.rotation.y = pose.mifune.yaw;
      const points = draw(captain, gesture), bottom = Math.min(...points.map(p => p.y));
      assert.ok(bottom >= -.025, `${phase} ${elapsed}: body below floor by ${bottom}`);
      if (pose.fallen === 1) {
        assert.ok(bottom < .035, `${phase}: body floats ${bottom} above ground`);
        assert.equal(points.filter(p => Math.abs(p.x) < 2.6 && p.z > 9.9 && p.z < 14.9 && p.y > .05).length, 0, 'the grounded body cannot intersect the APU armour');
        const before = points[0]; draw(captain, gesture); assert.ok(vertices(captain)[0].distanceTo(before) < 1e-8);
      }
    }
    kid.root.position.set(-1.55, 0, 6.3); kid.root.rotation.y = Math.PI / 2;
    for (const [phase, elapsed] of [['kneeling', .3], ['kneeling', .8], ['orders', 2], ['response', 0], ['rise', .4], ['rise', 1.2]] as const) {
      const points = draw(kid, { ...newDockLastStand(), role: 'kid', phase, elapsed, total: 8 });
      const bottom = Math.min(...points.map(p => p.y));
      assert.ok(bottom >= -.035, `${phase} ${elapsed}: Kid penetrates floor by ${bottom}`);
      for (const ankle of kid.ankles) assert.ok(Math.abs(ankle.localToWorld(new THREE.Vector3(0, -.155, .13)).y) < .035, 'the planted shoes cannot slide vertically through the ground');
    }
  } finally { models.dispose(); globalThis.document = previous; }
});
