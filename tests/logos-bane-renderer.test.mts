import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from 'three';
import { LogosBaneRenderer } from '../packages/client/src/engine/LogosBaneRenderer.js';
import type { BaneEncounter } from '@auto_matrix/shared';

test('Logos cuts the ship lights, reveals the saved gold target and opens the engineering hatch only after rescue', () => {
  const root = new THREE.Group(); const shipLight = new THREE.PointLight(0xffffff, 100); root.add(shipLight);
  const renderer = new LogosBaneRenderer(root);
  const encounter: BaneEncounter = { phase: 'ready', elapsed: 0, attempts: 0, checkpoint: 'gun', hits: 0, focus: 0, counters: 0, lastStrike: -1 };
  const gold = root.getObjectByName('bane-gold-perception') as THREE.Group;
  const hatch = root.getObjectByName('logos-engineering-hatch') as THREE.Group;
  const fill = root.getObjectByName('logos-deck-fill') as THREE.HemisphereLight;
  const gun = root.getObjectByName('bane-electric-gun') as THREE.Group;
  assert.ok(gold && hatch && fill && gun && root.getObjectByName('logos-engineering-hatch-rim'));
  renderer.update(encounter, 1, 0); assert.equal(shipLight.intensity, 100); assert.equal(gold.visible, false); assert.equal(hatch.rotation.z, 0);
  assert.equal(gun.visible, false, 'the dropped gun is hidden while Bane holds his weapon');
  assert.ok(fill.intensity > .6);
  encounter.phase = 'gun_window'; renderer.update(encounter, 1, .8); assert.ok(shipLight.intensity < 10);
  encounter.phase = 'blind'; encounter.focus = .9; renderer.update(encounter, 1, 2); assert.equal(gold.visible, true); assert.ok(shipLight.intensity < 3);
  assert.equal(gun.visible, true, 'the gun remains on the deck after the grapple');
  assert.ok(fill.intensity < .1);
  encounter.phase = 'counter'; encounter.pipeX = 4; encounter.pipeZ = -3; renderer.update(encounter, 1, 3);
  assert.equal(gold.position.x, 4); assert.equal(gold.position.z, -3);
  encounter.phase = 'defeated'; renderer.update(encounter, 3, 4); assert.ok(hatch.rotation.z < -.9);
  renderer.dispose(); assert.equal(root.children.length, 1); assert.equal(shipLight.intensity, 100);
});
