import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { RELOADED_FINALE, type FilmJourney } from '@auto_matrix/shared';
import { NebDeckRenderer } from '../packages/client/src/engine/NebDeckRenderer.js';
import { ReloadedFinaleRenderer } from '../packages/client/src/engine/ReloadedFinaleRenderer.js';

const journey = (scene: string): FilmJourney => ({ version: 1, scene, actor: 'neo', step: 0, completed: [], enteredAt: 0,
  checkpoint: { x: 0, y: 0, z: 0 }, reflections: {}, lastText: '' });

test('the old ship visibly switches from bomb radar to an open cargo hatch and evacuation lights', () => {
  const root = new THREE.Group(); const renderer = new NebDeckRenderer(root); const saved = journey('m2_ship_lost');
  saved.shipLoss = { phase: 'briefing', remaining: RELOADED_FINALE.evacuationSeconds, lastTick: 0, attempts: 0 };
  renderer.update(saved, 1);
  assert.equal(root.getObjectByName('neb-final-evacuation')?.visible, true);
  assert.ok(root.getObjectByName('neb-bomb-radar')); assert.ok(root.getObjectByName('neb-evacuation-path-25'));
  const hatch = root.getObjectByName('neb-cargo-hatch') as THREE.Mesh; const closed = hatch.position.y;
  saved.shipLoss.phase = 'evacuating'; renderer.update(saved, 2);
  assert.ok(hatch.position.y > closed);
  assert.ok((root.getObjectByName('neb-evacuation-alarm') as THREE.PointLight).intensity > 100);
  renderer.update(journey('m1_download'), 3); assert.equal(root.getObjectByName('neb-final-evacuation')?.visible, false);
  renderer.dispose();
});

test('tunnel Sentinels approach, lose their eyes one by one, and Hammer searches the surviving crew', () => {
  const root = new THREE.Group(); const renderer = new ReloadedFinaleRenderer(root, 'm2_stop_sentinels'); const saved = journey('m2_stop_sentinels');
  saved.tunnel = { phase: 'sensing', remaining: RELOADED_FINALE.sentinelSeconds, focus: 0, lastTick: 0, attempts: 0 };
  renderer.update(saved, 0);
  const first = root.getObjectByName('real-sentinel-1') as THREE.Group; assert.ok(first);
  assert.equal(root.getObjectByName('hammer-rescue-arrival')?.visible, false);
  const before = first.position.z;
  saved.tunnel.remaining = 7; saved.tunnel.focus = RELOADED_FINALE.signalSeconds * .4; renderer.update(saved, 2);
  assert.ok(first.position.z < before);
  assert.equal((first.getObjectByName('sentinel-eye') as THREE.Mesh).material instanceof THREE.MeshBasicMaterial, true);
  assert.equal(((first.getObjectByName('sentinel-eye') as THREE.Mesh).material as THREE.MeshBasicMaterial).color.getHex(), 0x283b3b);
  saved.tunnel.phase = 'collapsed'; renderer.update(saved, 3);
  assert.equal(root.getObjectByName('hammer-rescue-arrival')?.visible, true);
  assert.ok((root.getObjectByName('hammer-rescue-beam') as THREE.SpotLight).intensity > 0);
  renderer.dispose(); assert.equal(root.children.length, 0);
});

test('Hammer has two distinct medical beds and live telemetry screens', () => {
  const root = new THREE.Group(); const renderer = new ReloadedFinaleRenderer(root, 'm2_medical');
  const neo = root.getObjectByName('hammer-medical-neo') as THREE.Group;
  const bane = root.getObjectByName('hammer-medical-bane') as THREE.Group;
  assert.ok(neo && bane); assert.equal(bane.position.x - neo.position.x, 20);
  assert.ok(neo.getObjectByName('medical-telemetry-screen')); assert.ok(bane.getObjectByName('medical-telemetry-screen'));
  renderer.update(journey('m2_medical'), 2); renderer.dispose(); assert.equal(root.children.length, 0);
});
