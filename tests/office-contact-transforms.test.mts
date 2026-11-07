import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from 'three';
import { actor } from './helpers/fighting-hand-fixture.mjs';
import type { HeroModels, HeroRig } from '../packages/client/src/agents/HeroModel.js';

const contacts: [string, (models: HeroModels, rig: HeroRig) => void][] = [
  ['phone pickup', (models, rig) => models['holdPhone'](rig, { phase: 'pickup', elapsed: .4 })],
  ['phone call', (models, rig) => models['holdPhone'](rig, { phase: 'connected', elapsed: 11 })],
  ['window handle', (models, rig) => models['openWindow'](rig, 1.1)],
  ['window crossing', (models, rig) => models['crossWindow'](rig, 3.2)],
];

for (const [name, solve] of contacts) test(`${name} refreshes moving ancestors without traversing unrelated render branches`, async t => {
  const h = await actor('neo'); t.after(() => h.models.dispose()); h.draw(0);
  // Warm the authored phone grip before comparing identical starting poses.
  solve(h.models, h.rig);
  const scene = new THREE.Scene(), parent = new THREE.Group(), unrelated = new THREE.Object3D();
  scene.add(parent); parent.add(h.rig.root); h.rig.root.add(unrelated);
  const base: { node: THREE.Object3D; position: THREE.Vector3; rotation: THREE.Quaternion; scale: THREE.Vector3 }[] = [];
  h.rig.root.traverse(node => base.push({ node, position: node.position.clone(), rotation: node.quaternion.clone(), scale: node.scale.clone() }));
  const restore = () => base.forEach(({ node, position, rotation, scale }) => {
    node.position.copy(position); node.quaternion.copy(rotation); node.scale.copy(scale);
  });
  const move = (frame: number) => {
    parent.position.set(14 + frame * .3, 2 + frame * .1, -9 + frame * .2);
    parent.rotation.set(.03 * frame, .3 + frame * .1, -.02 * frame);
    parent.scale.setScalar(1 + frame * .02);
    h.rig.root.rotation.y = -.2 + frame * .07;
    unrelated.position.set(frame, frame * 2, -frame);
  };
  const snapshot = () => base.map(({ node }) => ({
    position: node.position.toArray(), rotation: node.quaternion.toArray(), scale: node.scale.toArray(), world: node.matrixWorld.toArray(),
  }));
  const update = t.mock.method(unrelated, 'updateWorldMatrix');
  for (let frame = 1; frame <= 3; frame++) {
    restore(); move(frame - 1); scene.updateMatrixWorld(true);
    move(frame); h.rig.root.updateWorldMatrix(true, true); solve(h.models, h.rig); scene.updateMatrixWorld(true);
    const expected = snapshot();
    restore(); move(frame - 1); scene.updateMatrixWorld(true);
    move(frame); update.mock.resetCalls(); solve(h.models, h.rig);
    const unrelatedUpdates = update.mock.callCount();
    scene.updateMatrixWorld(true);
    assert.deepEqual(snapshot(), expected, 'limb poses and rendered transforms must match an eager full-tree refresh');
    assert.equal(unrelatedUpdates, 0, 'contact queries must leave unrelated render transforms to the scene traversal');
  }
});
