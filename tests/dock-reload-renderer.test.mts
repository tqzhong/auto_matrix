import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from 'three';
import { DOCK_RELOAD, dockReloadBox, dockReloadHeight, newDockReload, type FilmJourney } from '@auto_matrix/shared';
import { ZionHomecomingRenderer } from '../packages/client/src/engine/ZionHomecomingRenderer.js';
import { CharacterModels } from '../packages/client/src/agents/CharacterModel.js';
import { WorldState } from '../packages/server/src/world/WorldState.js';
import { AgentManager } from '../packages/server/src/agents/AgentManager.js';

test('the load reaches a real rear port only when Kid kicks; a paused view retains the box and latch', () => {
  const root = new THREE.Group(), renderer = new ZionHomecomingRenderer(root, 'film_zion_hangar');
  const reload = { ...newDockReload(), phase: 'kicking' as const, lift: 1, climb: 1, elapsed: .2 };
  const journey = { scene: 'm3_dock_battle', step: 1, actor: 'kid', completed: [], dockReload: reload } as unknown as FilmJourney;
  renderer.update(journey, 0);
  const box = root.getObjectByName('apu-reload-ammo-box')!;
  assert.ok(root.getObjectByName('apu-ammo-port-left')); assert.ok(root.getObjectByName('apu-loader-footrest-1.8'));
  assert.equal(box.position.z, DOCK_RELOAD.box.z, 'the box stays jammed until the foot makes contact');
  reload.elapsed = .7; renderer.update(journey, 1);
  assert.ok(box.position.z < DOCK_RELOAD.box.z - .7);
  root.updateWorldMatrix(true, true); const before = box.matrixWorld.clone();
  const latch = root.getObjectByName('apu-loader-lock')!, latchBefore = latch.matrixWorld.clone();
  renderer.update(journey, 200); root.updateWorldMatrix(true, true);
  assert.deepEqual(box.matrixWorld.elements, before.elements, 'wall-clock time cannot alter saved loader travel');
  assert.deepEqual(latch.matrixWorld.elements, latchBefore.elements, 'the lock shares the saved kick clock');
  assert.equal(root.getObjectByName('zion-docked-nebuchadnezzar')?.visible, false, 'the destroyed ship cannot remain parked during the siege');
  renderer.dispose(); assert.equal(root.children.length, 0);
});

test('Kid’s actual sole meets the box and his other shoe and hands remain on the rear support', t => {
  t.mock.method(THREE.TextureLoader.prototype, 'load', () => new THREE.Texture());
  const previous = globalThis.document;
  globalThis.document = { createElement: () => ({ getContext: () => ({ createImageData: (w: number, h: number) => ({ data: new Uint8ClampedArray(w * h * 4) }), putImageData() {} }) }) } as unknown as Document;
  const world = new WorldState(); new AgentManager(world).initializeAllAgents(); const models = new CharacterModels();
  try {
    const rig = models.create(world.agents.get('kid')!);
    rig.root.rotation.y = Math.PI;
    for (const [climb, supportIndex, height] of [[.125, 1, 0], [.375, 0, .9], [.625, 1, .9], [.875, 0, 1.8]]) {
      rig.root.position.set(DOCK_RELOAD.entry.x, dockReloadHeight(climb), DOCK_RELOAD.entry.z);
      models.animate(rig, 0, { speed: 0, grounded: true, verticalVelocity: 0, turn: 0, realWorld: true,
        dockReload: { ...newDockReload(), phase: 'climbing', lift: 1, climb, role: 'kid' } }, 1);
      rig.root.updateWorldMatrix(true, true);
      const sole = rig.ankles[supportIndex].localToWorld(new THREE.Vector3(0, -.155, .13));
      assert.ok(Math.abs(sole.y - height) < .025, `climb ${climb}: the planted shoe must stay on its rung`);
    }
    rig.root.position.set(DOCK_RELOAD.entry.x, DOCK_RELOAD.height, DOCK_RELOAD.entry.z); rig.root.rotation.y = Math.PI;
    for (const elapsed of [.42, .5, .6]) {
      const gesture = { ...newDockReload(), phase: 'kicking' as const, lift: 1, climb: 1, elapsed, role: 'kid' as const };
      const input = { speed: 0, grounded: true, verticalVelocity: 0, turn: 0, realWorld: true, dockReload: gesture };
      models.animate(rig, 0, input, 1); rig.root.updateWorldMatrix(true, true);
      const sole = rig.ankles[0].localToWorld(new THREE.Vector3(0, -.155, .13)), box = dockReloadBox(gesture);
      assert.ok(Math.abs(sole.z - box.z - DOCK_RELOAD.box.depth / 2) < .03, `kick ${elapsed}: sole misses the ammo box by ${sole.z - box.z - DOCK_RELOAD.box.depth / 2}`);
      assert.ok(Math.abs(sole.y - DOCK_RELOAD.box.y) < .03, `kick ${elapsed}: contact must stay on the box face`);
      const support = rig.ankles[1].localToWorld(new THREE.Vector3(0, -.155, .13));
      assert.ok(Math.abs(support.y - DOCK_RELOAD.height) < .025, 'the supporting shoe must not float or sink through the footrest');
      for (const elbow of rig.elbows) {
        const palm = elbow.localToWorld(new THREE.Vector3(0, -.79, .055));
        assert.ok(Math.abs(palm.z - 15.65) < .03, `palm leaves rear bar: ${palm.z}`);
        assert.ok(Math.abs(palm.y - 5.14) < .03, `palm leaves the bar height: ${palm.y}`);
      }
      let inside = 0;
      rig.detail.traverseVisible(object => {
        if (!(object instanceof THREE.Mesh)) return;
        const vertices = object.geometry.attributes.position;
        for (let i = 0; i < vertices.count; i++) {
          const p = object.localToWorld(object.getVertexPosition(i, new THREE.Vector3()));
          if (Math.abs(p.x - box.x) < .78 && Math.abs(p.y - box.y) < .65 && Math.abs(p.z - box.z) < .605) inside++;
        }
      });
      assert.equal(inside, 0, `kick ${elapsed}: actual body vertices penetrate the ammo case`);
      const before = sole.clone(); models.animate(rig, .1, input, 1); rig.root.updateWorldMatrix(true, true);
      assert.ok(rig.ankles[0].localToWorld(new THREE.Vector3(0, -.155, .13)).distanceTo(before) < 1e-6, 'paused contacts must not drift');
    }
  } finally { models.dispose(); globalThis.document = previous; }
});
