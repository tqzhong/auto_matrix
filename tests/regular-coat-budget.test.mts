import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from 'three';
import { actor } from './helpers/fighting-hand-fixture.mts';
import { newMotion } from '../packages/client/src/agents/CharacterMotion.js';
import { RegularCoatTails } from '../packages/client/src/agents/RegularCoatTails.js';
import type { HeroRig } from '../packages/client/src/agents/HeroModel.js';

function buffers(rig: HeroRig) {
  return rig.panels.map(({ mesh }) => ({
    position: Array.from(mesh.geometry.attributes.position.array),
    normal: Array.from(mesh.geometry.attributes.normal.array),
  }));
}

test('an unchanged posed inner surface reuses its full coat fit as the clock and head move', async t => {
  const h = await actor('morpheus'); t.after(() => h.models.dispose()); h.draw(0);
  const tails = new RegularCoatTails(h.rig), state = newMotion();
  let radialFits = 0; const hypot = Math.hypot;
  t.mock.method(Math, 'hypot', (...values: number[]) => { radialFits++; return hypot(...values); });
  tails.update(state, 0); assert.ok(radialFits > 0);
  const before = buffers(h.rig), versions = h.rig.panels.map(({ mesh }) => mesh.geometry.attributes.position.version);
  radialFits = 0;
  for (let frame = 1; frame <= 8; frame++) {
    state.time = frame / 60; state.phase = frame * .02;
    h.rig.bones.get('head')!.rotation.y = frame * .03;
    tails.update(state, 0);
  }
  assert.deepEqual(buffers(h.rig), before);
  assert.deepEqual(h.rig.panels.map(({ mesh }) => mesh.geometry.attributes.position.version), versions);
  assert.equal(radialFits, 0, 'a changed head and clock must not refit an identical posed lower surface');
});

test('changed inner geometry, skin weights, visibility and panel inputs retain the fresh full fit', async t => {
  const h = await actor('morpheus'); t.after(() => h.models.dispose()); h.draw(0);
  const tails = new RegularCoatTails(h.rig), state = newMotion(); tails.update(state, 0);
  const pants = h.rig.root.getObjectByName('Tailored_trousers') as THREE.SkinnedMesh;
  const position = pants.geometry.attributes.position as THREE.BufferAttribute;
  let lowest = 0; for (let i = 1; i < position.count; i++) if (position.getY(i) < position.getY(lowest)) lowest = i;
  const changes = [
    () => { h.rig.bones.get('hip_L')!.rotation.x += .3; },
    () => { position.setX(lowest, position.getX(lowest) + .08); position.needsUpdate = true; },
    () => {
      const morph = position.clone(); morph.setX(lowest, morph.getX(lowest) + .07);
      pants.geometry.morphAttributes.position = [morph]; pants.updateMorphTargets(); pants.morphTargetInfluences![0] = 1;
    },
    () => { pants.morphTargetInfluences![0] = .3; },
    () => {
      const weights = pants.geometry.attributes.skinWeight as THREE.BufferAttribute;
      const indices = pants.geometry.attributes.skinIndex as THREE.BufferAttribute;
      indices.setX(lowest, pants.skeleton.bones.findIndex(bone => bone.name === 'hip_R')); indices.needsUpdate = true;
      weights.setXYZW(lowest, 1, 0, 0, 0); weights.needsUpdate = true;
    },
    () => { pants.visible = false; },
    () => { pants.visible = true; },
    () => { h.rig.panels[0].mesh.position.x += .015; },
    () => { const p = h.rig.panels[1].mesh.geometry.attributes.position as THREE.BufferAttribute; p.setX(0, p.getX(0) + .05); p.needsUpdate = true; },
    () => { const mesh = h.rig.panels[1].mesh, previous = mesh.geometry; mesh.geometry = previous.clone(); previous.dispose(); },
    () => { h.rig.root.rotation.y += .2; h.rig.root.scale.set(1.1, .9, 1.3); },
  ];
  for (const change of changes) {
    change(); state.time += .1; tails.update(state, 0);
    const cached = buffers(h.rig);
    tails['lastPose'].fill(NaN); tails.update(state, 0);
    assert.deepEqual(buffers(h.rig), cached, 'cache invalidation must match a fresh complete fit exactly');
  }
});

test('a flaring coat and a hidden-to-visible transition cannot reuse a stationary fit', async t => {
  const h = await actor('morpheus'); t.after(() => h.models.dispose()); h.draw(0);
  const tails = new RegularCoatTails(h.rig), state = newMotion(); tails.update(state, .4);
  const before = buffers(h.rig); state.time = .7; state.phase = .3; tails.update(state, .4);
  assert.notDeepEqual(buffers(h.rig), before, 'nonzero flare must retain its clock-driven animation');
  for (const coat of [0, .2, 0]) {
    state.time += .4; tails.update(state, coat); const cached = buffers(h.rig);
    tails['lastPose'].fill(NaN); tails.update(state, coat); assert.deepEqual(buffers(h.rig), cached);
  }
  h.rig.panels.forEach(({ mesh }) => { mesh.visible = false; }); assert.equal(tails.update(state, 0), false);
  h.rig.bones.get('knee_R')!.rotation.x += .3;
  h.rig.panels.forEach(({ mesh }) => { mesh.visible = true; }); tails.update(state, 0);
  const restored = buffers(h.rig); tails['lastPose'].fill(NaN); tails.update(state, 0); assert.deepEqual(buffers(h.rig), restored);
});
