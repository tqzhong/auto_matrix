import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from 'three';
import { filmPosition, type FilmJourney } from '@auto_matrix/shared';
import { TrainingSetRenderer } from '../packages/client/src/engine/TrainingSetRenderer.js';
import { NebDeckRenderer } from '../packages/client/src/engine/NebDeckRenderer.js';

const journey = (scene: string, training?: FilmJourney['training']): FilmJourney => ({
  version: 1, scene, step: scene === 'm1_download' ? 0 : 1, actor: 'neo', completed: [], enteredAt: 0,
  checkpoint: filmPosition(scene === 'm1_download' ? 'film_neb_deck' : scene === 'm1_dojo' ? 'film_kungfu_dojo' : scene === 'm1_jump' ? 'film_jump_roofs' : 'film_red_dress_plaza'),
  reflections: {}, lastText: '', training,
});

test('training uses the actual neck socket, a carried disk and a paused upload display', () => {
  const root = new THREE.Group(); const renderer = new NebDeckRenderer(root);
  try {
    const subject = new THREE.Group(), socket = new THREE.Object3D(); socket.name = 'cervical-interface'; socket.position.set(7.4, 2.5, -5); subject.add(socket);
    const state = journey('m1_download', { kind: 'download', elapsed: 0, started: false });
    state.downloadSetup = { phase: 'connecting', elapsed: 2.2, progress: 0 };
    renderer.update(state, 0, subject);
    const rig = root.getObjectByName('neb-training-upload-rig')!;
    const jack = root.getObjectByName('neb-first-core-connector')!;
    assert.ok(rig.visible); assert.ok(root.getObjectByName('neb-first-core-cable')!.visible);
    assert.equal(root.getObjectByName('neb-training-overhead-rail'), undefined, 'the training plug is handled behind the neck, not lowered through the head');
    assert.ok(root.getObjectByName('neb-training-progress'));
    const withdrawn = jack.position.x;
    state.downloadSetup.elapsed = 5; renderer.update(state, 5, subject); root.updateMatrixWorld(true);
    assert.ok(withdrawn - jack.position.x > .69);
    assert.ok(jack.localToWorld(new THREE.Vector3(-.25, 0, 0)).distanceTo(socket.getWorldPosition(new THREE.Vector3())) < .001);
    state.downloadSetup.phase = 'ready'; state.training!.started = true; state.training!.elapsed = 1; renderer.update(state, 5, subject);
    const disk = root.getObjectByName('neb-training-disk')!, lifted = disk.position.y;
    state.training!.elapsed = 5; renderer.update(state, 5, subject);
    assert.ok(lifted - disk.position.y > .1, 'the lifted disk has been inserted into the drive');
    const bars = Array.from({ length: 10 }, (_, index) => root.getObjectByName(`neb-training-bar-${index}`)!);
    assert.ok(bars.filter(bar => bar.visible).length >= 5, 'the console mirrors saved upload progress');
    const paused = { disk: disk.position.toArray(), bars: bars.map(bar => bar.visible) }; renderer.update(state, 500, subject);
    assert.deepEqual({ disk: disk.position.toArray(), bars: bars.map(bar => bar.visible) }, paused);
  } finally { renderer.dispose(); }
});

test('the dojo, roof gap and red-dress plaza are dedicated physical training sets', () => {
  const dojoRoot = new THREE.Group(); const dojo = new TrainingSetRenderer(dojoRoot, 'm1_dojo');
  try {
    assert.ok(dojoRoot.getObjectByName('training-dojo-set'));
    assert.ok(dojoRoot.getObjectByName('dojo-training-light'));
    assert.ok(dojoRoot.getObjectByName('dojo-courtyard'));
    const eaves = dojoRoot.getObjectByName('dojo-main-eaves')!;
    const veranda = dojoRoot.getObjectByName('dojo-garden-veranda')!;
    const garden = dojoRoot.getObjectByName('dojo-garden')!;
    const pavilion = dojoRoot.getObjectByName('dojo-garden-pavilion')!;
    const entryGarden = dojoRoot.getObjectByName('dojo-entry-garden')!;
    const entryGate = dojoRoot.getObjectByName('dojo-entry-gate')!;
    const entryMatte = dojoRoot.getObjectByName('dojo-entry-matte') as THREE.Mesh;
    const gardenMatte = dojoRoot.getObjectByName('dojo-garden-matte') as THREE.Mesh;
    assert.ok(eaves.position.y > 12, 'the sparring floor stays under a visible roof structure');
    assert.ok(veranda.position.z > 24, 'the mat room opens onto a real veranda instead of ending at a back wall');
    assert.ok(garden.position.z > veranda.position.z, 'the garden continues beyond the veranda');
    assert.ok(pavilion.position.z > garden.position.z, 'a distant focal point gives the open side depth');
    assert.ok(entryGarden.position.z < -42, 'the entrance view has its own exterior instead of a paper wall');
    assert.ok(entryGate.position.z < entryGarden.position.z, 'the opposite view terminates in a distant framed landmark');
    assert.equal((entryMatte.material as THREE.MeshBasicMaterial).fog, false, 'the entrance horizon stays readable beyond the local fog');
    assert.equal((gardenMatte.material as THREE.MeshBasicMaterial).fog, false, 'the garden horizon stays readable beyond the local fog');
    assert.ok(entryMatte.position.y <= 16 && gardenMatte.position.y <= 16, 'the player sightline must meet the garden, not the matte’s floor edge');
  } finally { dojo.dispose(); }

  const jumpRoot = new THREE.Group(); const jump = new TrainingSetRenderer(jumpRoot, 'm1_jump'); jumpRoot.updateMatrixWorld(true);
  try {
    assert.ok(jumpRoot.getObjectByName('jump-near-roof')); assert.ok(jumpRoot.getObjectByName('jump-far-roof'));
    assert.ok(jumpRoot.getObjectByName('jump-city-canyon'));
    const down = new THREE.Vector3(0, -1, 0);
    assert.ok(new THREE.Raycaster(new THREE.Vector3(0, 5, 0), down, 0, 8).intersectObject(jumpRoot, true).length > 0, 'the take-off roof is solid');
    assert.equal(new THREE.Raycaster(new THREE.Vector3(0, 5, -21), down, 0, 8).intersectObject(jumpRoot, true).length, 0, 'the alley is a visible physical gap');
  } finally { jump.dispose(); }

  const plazaRoot = new THREE.Group(); const plaza = new TrainingSetRenderer(plazaRoot, 'm1_red_dress');
  try {
    assert.ok(plazaRoot.getObjectByName('red-dress-fountain'));
    assert.ok(plazaRoot.getObjectByName('red-dress-crowd-0'));
    const state = journey('m1_red_dress', { kind: 'red_dress', elapsed: 5, started: true });
    plaza.update(state, 5); const figure = plazaRoot.getObjectByName('red-dress-crowd-0')!; const frozen = figure.position.z;
    plaza.update(state, 5.6); assert.equal(figure.position.z, frozen, 'the crowd holds the exact frozen program frame');
    const reveal = plazaRoot.getObjectByName('red-dress-agent-reveal') as THREE.PointLight;
    assert.equal(reveal.intensity, 0); state.training!.elapsed = 7; plaza.update(state, 7);
    assert.ok(reveal.intensity > 300, 'Smith replacement gets a readable reveal light');
  } finally { plaza.dispose(); }
});
