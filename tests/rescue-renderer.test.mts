import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from 'three';
import { RESCUE, filmPosition, type FilmJourney, type RescuePhase } from '@auto_matrix/shared';
import { ConstructRenderer } from '../packages/client/src/engine/ConstructRenderer.js';
import { NebDeckRenderer } from '../packages/client/src/engine/NebDeckRenderer.js';

const canvasDocument = () => ({
  createElement: () => ({ width: 0, height: 0, getContext: () => ({
    fillStyle: '', strokeStyle: '', lineWidth: 1, font: '', fillRect() {}, fillText() {}, beginPath() {}, arc() {}, ellipse() {}, fill() {}, stroke() {},
    createLinearGradient: () => ({ addColorStop() {} }),
  }) }),
}) as unknown as Document;

const journey = (scene: 'm1_rescue_decision' | 'm1_guns', phase: RescuePhase, elapsed = 0): FilmJourney => ({
  version: 1, scene, step: scene === 'm1_rescue_decision' ? 1 : 0, actor: 'neo', completed: [], enteredAt: 0,
  checkpoint: filmPosition(scene === 'm1_rescue_decision' ? 'film_neb_deck' : 'film_white_construct'), reflections: {}, lastText: '',
  rescue: { phase, elapsed },
});

test('the Nebuchadnezzar briefing uses a physical building projection, route and Morpheus life signal', () => {
  const root = new THREE.Group(); const renderer = new NebDeckRenderer(root);
  try {
    const rig = root.getObjectByName('neb-rescue-briefing')!;
    assert.ok(rig); assert.ok(root.getObjectByName('neb-rescue-building')); assert.ok(root.getObjectByName('neb-rescue-elevator'));
    assert.ok(root.getObjectByName('neb-rescue-morpheus-signal')); assert.ok(root.getObjectByName('neb-rescue-projection-light'));
    const route = Array.from({ length: 4 }, (_, index) => root.getObjectByName(`neb-rescue-route-${index}`)!);
    const ready = journey('m1_rescue_decision', 'briefing_ready'); renderer.update(ready, 1);
    assert.equal(rig.visible, true); assert.equal(route.filter(segment => segment.visible).length, 1);
    ready.rescue = { phase: 'briefing', elapsed: RESCUE.briefing * .62 }; renderer.update(ready, 4);
    assert.ok(route.filter(segment => segment.visible).length >= 3, 'the saved briefing clock draws the entry-to-roof route in order');
    ready.rescue = { phase: 'briefing_done', elapsed: 0 }; renderer.update(ready, 9);
    assert.ok(route.every(segment => segment.visible));
    ready.scene = 'm1_guns'; renderer.update(ready, 10); assert.equal(rig.visible, false, 'the hologram belongs only to the ship briefing');
  } finally { renderer.dispose(); }
});

test('Construct racks arrive from the horizon and leave three distinct saved loadout choices', () => {
  const savedDocument = globalThis.document; globalThis.document = canvasDocument();
  const root = new THREE.Group(); const renderer = new ConstructRenderer(root, 'm1_guns');
  try {
    for (let index = 0; index < 8; index++) assert.ok(root.getObjectByName(`construct-rack-row-${index}`));
    for (const style of ['compact', 'breacher', 'rifle'] as const) {
      assert.ok(root.getObjectByName(`construct-loadout-${style}`));
      assert.ok(root.getObjectByName(`construct-${style}-weapon`));
    }
    const state = journey('m1_guns', 'racks_ready'); renderer.update(state);
    assert.equal(root.getObjectByName('construct-rack-row-0')!.visible, false);
    assert.equal(root.getObjectByName('construct-loadout-compact')!.visible, false);
    state.rescue = { phase: 'racks_arriving', elapsed: 1 }; renderer.update(state);
    assert.equal(root.getObjectByName('construct-rack-row-0')!.visible, true);
    assert.equal(root.getObjectByName('construct-rack-row-7')!.visible, false, 'rows arrive with a visible stagger instead of teleporting together');
    state.rescue.elapsed = RESCUE.racksArrival; renderer.update(state);
    for (let index = 0; index < 8; index++) assert.equal(root.getObjectByName(`construct-rack-row-${index}`)!.visible, true);
    state.rescue = { phase: 'selecting', elapsed: 0 }; renderer.update(state);
    for (const style of ['compact', 'breacher', 'rifle'] as const) assert.equal(root.getObjectByName(`construct-loadout-${style}`)!.visible, true);
    state.rescue = { phase: 'equipping', elapsed: RESCUE.equip / 2, loadout: 'compact' }; renderer.update(state);
    const selected = root.getObjectByName('construct-loadout-compact')!; const rejected = root.getObjectByName('construct-loadout-rifle')!;
    assert.ok(selected.position.y > .2); assert.ok(selected.scale.x > rejected.scale.x, 'the chosen physical stand remains emphasized during equip');
  } finally { renderer.dispose(); globalThis.document = savedDocument; }
});
