import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from 'three';
import { filmPosition, type FilmJourney } from '@auto_matrix/shared';
import { AmbushSetRenderer } from '../packages/client/src/engine/AmbushSetRenderer.js';
import { NebDeckRenderer } from '../packages/client/src/engine/NebDeckRenderer.js';

const journey = (scene: 'm1_bathroom' | 'm1_unplugged', phase: NonNullable<FilmJourney['betrayal']>['phase'], elapsed = 0): FilmJourney => ({
  version: 1, scene, actor: scene === 'm1_bathroom' ? 'morpheus' : 'tank', step: scene === 'm1_bathroom' ? 0 : 1,
  completed: [], enteredAt: 0, reflections: {}, lastText: '', checkpoint: filmPosition(scene === 'm1_bathroom' ? 'film_ambush_house' : 'film_neb_deck'),
  betrayal: { kind: scene === 'm1_bathroom' ? 'bathroom' : 'unplugged', phase, elapsed, attempt: 0, repels: 0, rescued: 0 },
});

test('the bathroom holdout owns fixtures, a breakable partition and saved crash debris', t => {
  t.mock.method(THREE.TextureLoader.prototype, 'load', () => new THREE.Texture());
  const root = new THREE.Group(); const renderer = new AmbushSetRenderer(root);
  try {
    for (const name of ['ambush-bathroom-holdout', 'ambush-bathroom-tub', 'ambush-bathroom-sink', 'ambush-bathroom-partition-intact', 'ambush-bathroom-breach-debris']) {
      assert.ok(root.getObjectByName(name), `${name} must be rendered geometry`);
    }
    const intact = root.getObjectByName('ambush-bathroom-partition-intact')!;
    const debris = root.getObjectByName('ambush-bathroom-breach-debris')!;
    renderer.update(journey('m1_bathroom', 'defending', 8), [], 8);
    assert.equal(intact.visible, true); assert.equal(debris.visible, false);
    renderer.update(journey('m1_bathroom', 'sacrifice', 3.2), [], 12);
    assert.equal(intact.visible, false, 'the collision beat must open the partition');
    assert.equal(debris.visible, true, 'saved elapsed time must restore the breached wall state');
    assert.ok(debris.children.some(piece => piece.rotation.x !== 0 || piece.rotation.z !== 0), 'the breach needs scattered masonry rather than a hidden wall');
  } finally { renderer.dispose(); }
});

test('Cypher betrayal has physical jacks, per-person signals and a timed counter discharge', () => {
  const root = new THREE.Group(); const renderer = new NebDeckRenderer(root);
  try {
    for (const name of ['neb-betrayal-scene', 'neb-betrayal-console', 'neb-betrayal-jack-apoc', 'neb-betrayal-jack-switch',
      'neb-betrayal-signal-neo', 'neb-betrayal-signal-trinity', 'neb-betrayal-signal-apoc', 'neb-betrayal-signal-switch', 'neb-betrayal-counter-flash']) {
      assert.ok(root.getObjectByName(name), `${name} must be visible through physical scene geometry`);
    }
    const jack = root.getObjectByName('neb-betrayal-jack-apoc')!;
    const apoc = root.getObjectByName('neb-betrayal-signal-apoc') as THREE.Mesh;
    const neo = root.getObjectByName('neb-betrayal-signal-neo') as THREE.Mesh;
    const flash = root.getObjectByName('neb-betrayal-counter-flash')!;
    const scene = journey('m1_unplugged', 'unplugging', 1);
    renderer.update(scene, 1); assert.equal(jack.visible, true); assert.equal(flash.visible, false);
    const live = (apoc.material as THREE.MeshBasicMaterial).color.getHex();
    scene.betrayal!.elapsed = 3; renderer.update(scene, 3);
    assert.equal(jack.visible, false, 'Apoc jack is visibly removed after Cypher pulls it');
    assert.notEqual((apoc.material as THREE.MeshBasicMaterial).color.getHex(), live, 'Apoc signal goes dark when his cable is removed');
    assert.equal((neo.material as THREE.MeshBasicMaterial).color.getHex(), live, 'Neo signal remains alive before Tank reconnects it');
    scene.betrayal = { ...scene.betrayal!, phase: 'countering', elapsed: 2.32 };
    renderer.update(scene, 5.32); assert.equal(flash.visible, true, 'the saved firing beat restores the pulse discharge');
    scene.betrayal.elapsed = 3.1; renderer.update(scene, 6.1); assert.equal(flash.visible, false);
  } finally { renderer.dispose(); }
});
