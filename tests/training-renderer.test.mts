import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from 'three';
import { filmPosition, type FilmJourney } from '@auto_matrix/shared';
import { FILM_SETS, filmGroundHeight, filmBlocked, jumpStreetHeight, jumpImpactPose, jumpImpactTime } from '@auto_matrix/shared';
import { TrainingSetRenderer } from '../packages/client/src/engine/TrainingSetRenderer.js';
import { NebDeckRenderer } from '../packages/client/src/engine/NebDeckRenderer.js';

const journey = (scene: string, training?: FilmJourney['training']): FilmJourney => ({
  version: 1, scene, step: scene === 'm1_download' ? 0 : 1, actor: 'neo', completed: [], enteredAt: 0,
  checkpoint: filmPosition(scene === 'm1_download' ? 'film_neb_deck' : scene === 'm1_dojo' ? 'film_kungfu_dojo' : scene === 'm1_jump' ? 'film_jump_roofs' : 'film_red_dress_plaza'),
  reflections: {}, lastText: '', training,
});

test('red-dress pedestrian lanes leave body clearance beside the actual benches and fountain', () => {
  const root = new THREE.Group(), renderer = new TrainingSetRenderer(root, 'm1_red_dress');
  try {
    root.updateMatrixWorld(true); const obstacles: THREE.Mesh[] = [], walkers: THREE.Object3D[] = [];
    root.traverse(object => {
      if (object instanceof THREE.Mesh && (/red-dress-(planter-base|arcade-column)$/.test(object.name) || object.parent?.name === 'red-dress-bench')) obstacles.push(object);
      if (/^red-dress-crowd-\d+$/.test(object.name)) walkers.push(object);
    });
    assert.equal(walkers.length, 20);
    for (const walker of walkers) for (const obstacle of obstacles) {
      const box = new THREE.Box3().setFromObject(obstacle), x = walker.getWorldPosition(new THREE.Vector3()).x;
      assert.ok(x < box.min.x - .65 || x > box.max.x + .65, `${walker.name} walks through ${obstacle.name}`);
    }
  } finally { renderer.dispose(); }
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

test('the roof canyon shares its visible street height and tower boundaries with player physics, including impact deformation', () => {
  const set = FILM_SETS.film_jump_roofs, root = new THREE.Group(); root.position.set(set.center.x, set.center.y - 1, set.center.z);
  const renderer = new TrainingSetRenderer(root, 'm1_jump');
  try {
    root.updateMatrixWorld(true); const avenue = root.getObjectByName('jump-canyon-avenue') as THREE.Mesh;
    const street = avenue.getWorldPosition(new THREE.Vector3());
    assert.equal(street.y + 1, set.center.y + jumpStreetHeight);
    const belowRoof = { x: set.center.x, y: set.center.y - 12, z: set.center.z - 35 };
    assert.equal(filmGroundHeight(belowRoof, set), street.y + 1, 'being below the far roof cannot teleport a falling body onto its top');
    assert.equal(filmBlocked(belowRoof, set, 1.1), true, 'the visible tower is a physical wall below the roof');
    const material = avenue.material as THREE.MeshStandardMaterial;
    const shader = { uniforms: {}, vertexShader: '#include <common>\n#include <beginnormal_vertex>\n#include <begin_vertex>', fragmentShader: '' };
    material.onBeforeCompile(shader as Parameters<typeof material.onBeforeCompile>[0], {} as THREE.WebGLRenderer);
    const uniforms = shader.uniforms as { jumpDepth: { value: number }; jumpCenter: { value: THREE.Vector2 } };
    const fall = { origin: { x: 0, y: -1, z: -15 }, velocity: { x: 0, y: -8, z: -4 }, yaw: Math.PI };
    const training = { kind: 'jump_fall' as const, elapsed: jumpImpactTime(fall) + .15, started: true, fall };
    renderer.update(journey('m1_jump', training), 0); const pose = jumpImpactPose(fall, training.elapsed);
    assert.ok(uniforms.jumpDepth.value < -.6, 'the displayed street deforms at the actual impact');
    assert.ok(Math.abs(uniforms.jumpDepth.value - (pose.y - jumpStreetHeight)) < 1e-10);
    assert.deepEqual(uniforms.jumpCenter.value.toArray(), [pose.x, -(pose.z + 21)]);
    training.elapsed += 1; renderer.update(journey('m1_jump', training), 0);
    assert.equal(uniforms.jumpDepth.value, 0, 'the road restores while the body rebounds above it');
    assert.ok(jumpImpactPose(fall, training.elapsed).y > jumpStreetHeight);
  } finally { renderer.dispose(); }
});

test('training sunlight keeps its downward direction when the film set is placed far from the world origin', () => {
  for (const id of ['m1_dojo', 'm1_jump', 'm1_red_dress']) {
    const root = new THREE.Group(); root.position.set(6800, 1, 4400);
    const renderer = new TrainingSetRenderer(root, id); root.updateMatrixWorld(true);
    try {
      root.traverse(object => {
        if (!(object instanceof THREE.DirectionalLight)) return;
        object.target.updateWorldMatrix(true, false);
        const direction = object.target.getWorldPosition(new THREE.Vector3()).sub(object.getWorldPosition(new THREE.Vector3())).normalize();
        assert.ok(direction.y < -.3, `${id} sunlight incorrectly points sideways at the remote world origin: ${direction.y}`);
      });
    } finally { renderer.dispose(); }
  }
});

test('the roof city backdrops blend without casting solid shadows or hiding nearer skyline geometry', () => {
  const root = new THREE.Group(), renderer = new TrainingSetRenderer(root, 'm1_jump');
  try {
    for (const name of ['jump-city-matte', 'jump-city-reverse-matte', 'jump-city-west-matte', 'jump-city-east-matte']) {
      const backdrop = root.getObjectByName(name) as THREE.Mesh;
      const material = backdrop.material as THREE.MeshBasicMaterial;
      assert.equal(backdrop.castShadow, false);
      assert.equal(backdrop.receiveShadow, false);
      assert.equal(material.transparent, true);
      assert.equal(material.depthWrite, false);
    }
  } finally { renderer.dispose(); }
});

test('the dojo, roof gap and red-dress plaza are dedicated physical training sets', () => {
  const dojoRoot = new THREE.Group(); const dojo = new TrainingSetRenderer(dojoRoot, 'm1_dojo');
  try {
    assert.ok(dojoRoot.getObjectByName('training-dojo-set'));
    assert.ok(dojoRoot.getObjectByName('dojo-training-light'));
    assert.ok(dojoRoot.getObjectByName('dojo-upper-gallery'));
    assert.ok(dojoRoot.getObjectByName('dojo-coffered-ceiling'));
    assert.ok(dojoRoot.getObjectByName('dojo-shrine-alcove'));
    for (const side of ['north', 'south', 'east', 'west']) assert.ok(dojoRoot.getObjectByName(`dojo-${side}-wall`));
  } finally { dojo.dispose(); }

  const jumpRoot = new THREE.Group(); const jump = new TrainingSetRenderer(jumpRoot, 'm1_jump'); jumpRoot.updateMatrixWorld(true);
  try {
    assert.ok(jumpRoot.getObjectByName('jump-near-roof')); assert.ok(jumpRoot.getObjectByName('jump-far-roof'));
    assert.ok(jumpRoot.getObjectByName('jump-city-canyon'));
    const serviceBank = jumpRoot.getObjectByName('jump-service-bank')!;
    const takeoff = jumpRoot.getObjectByName('jump-takeoff-line')!;
    const distant = jumpRoot.getObjectByName('jump-distant-roofline')!;
    const canyonFloor = jumpRoot.getObjectByName('jump-canyon-floor')!;
    const cityMatte = jumpRoot.getObjectByName('jump-city-matte') as THREE.Mesh;
    const reverseCityMatte = jumpRoot.getObjectByName('jump-city-reverse-matte') as THREE.Mesh;
    const westCityMatte = jumpRoot.getObjectByName('jump-city-west-matte') as THREE.Mesh;
    const eastCityMatte = jumpRoot.getObjectByName('jump-city-east-matte') as THREE.Mesh;
    assert.ok(serviceBank.position.z > 15, 'the playable roof has nearby service detail instead of reading as an empty slab');
    assert.ok(takeoff.position.z < -8 && takeoff.position.z > -13, 'the jump line gives the run-up a readable edge without filling the gap');
    assert.ok(distant.position.z < -70, 'roof volumes continue beyond the landing roof to establish city depth');
    assert.ok(canyonFloor.position.y < -25, 'looking into the gap reveals a distant city floor rather than the renderer background');
    assert.ok(distant.getObjectByName('jump-distant-west-wing') && distant.getObjectByName('jump-distant-east-wing'), 'far roof detail frames the gap from both sides without turning it into a solid wall');
    assert.equal((cityMatte.material as THREE.MeshBasicMaterial).fog, false, 'the city horizon stays legible through the local roof haze');
    assert.ok(cityMatte.position.y <= 28, 'the jump view meets the skyline, not the backdrop floor edge');
    assert.ok((cityMatte.geometry as THREE.PlaneGeometry).parameters.width >= 300, 'the backdrop spans the player camera instead of exposing a blank world edge');
    assert.ok(reverseCityMatte.position.z > 120 && Math.abs(reverseCityMatte.rotation.y - Math.PI) < .001, 'the follow camera has a real city horizon behind the starting roof too');
    assert.ok(westCityMatte.position.x < -120 && eastCityMatte.position.x > 120, 'turning at the take-off line never exposes an empty world edge');
    const down = new THREE.Vector3(0, -1, 0);
    assert.ok(new THREE.Raycaster(new THREE.Vector3(0, 5, 0), down, 0, 8).intersectObject(jumpRoot, true).length > 0, 'the take-off roof is solid');
    assert.equal(new THREE.Raycaster(new THREE.Vector3(0, 5, -21), down, 0, 8).intersectObject(jumpRoot, true).length, 0, 'the alley is a visible physical gap');
  } finally { jump.dispose(); }

  const plazaRoot = new THREE.Group(); const plaza = new TrainingSetRenderer(plazaRoot, 'm1_red_dress');
  try {
    assert.ok(plazaRoot.getObjectByName('red-dress-fountain'));
    assert.ok(plazaRoot.getObjectByName('red-dress-crowd-0'));
    const fountainRim = plazaRoot.getObjectByName('red-dress-fountain-rim')!;
    const cityEdges = plazaRoot.getObjectByName('red-dress-city-edges')!;
    const planters = plazaRoot.getObjectByName('red-dress-planters')!;
    const attentionAxis = plazaRoot.getObjectByName('red-dress-attention-axis')!;
    const plazaMatte = plazaRoot.getObjectByName('red-dress-city-matte') as THREE.Mesh;
    const reversePlazaMatte = plazaRoot.getObjectByName('red-dress-city-reverse-matte') as THREE.Mesh;
    const westPlazaMatte = plazaRoot.getObjectByName('red-dress-city-west-matte') as THREE.Mesh;
    const eastPlazaMatte = plazaRoot.getObjectByName('red-dress-city-east-matte') as THREE.Mesh;
    plazaRoot.updateMatrixWorld(true);
    assert.ok(new THREE.Box3().setFromObject(fountainRim).max.y > 1, 'the receiving pool has a raised physical rim');
    assert.ok(plazaRoot.getObjectByName('red-dress-water-veil'), 'water falls from the curved spillway');
    assert.ok(cityEdges.getObjectByName('red-dress-city-west-wing') && cityEdges.getObjectByName('red-dress-city-east-wing'), 'the plaza is framed by physical city wings without sealing the central route');
    assert.ok(planters.children.length >= 4, 'near planting gives the otherwise open program a real pedestrian scale');
    assert.ok(attentionAxis.position.x > 4 && attentionAxis.position.x < 10, 'the route toward the red-dress encounter remains visibly readable');
    assert.equal((plazaMatte.material as THREE.MeshBasicMaterial).fog, false, 'the city backdrop remains visible through local haze');
    assert.ok((plazaMatte.geometry as THREE.PlaneGeometry).parameters.width >= 300, 'the plaza backdrop spans the player camera without a blank horizon');
    assert.ok(reversePlazaMatte.position.z > 120 && Math.abs(reversePlazaMatte.rotation.y - Math.PI) < .001, 'turning back from the fountain retains a city horizon');
    assert.ok(westPlazaMatte.position.x < -120 && eastPlazaMatte.position.x > 120, 'looking sideways at the arcade never exposes an empty program edge');
    const state = journey('m1_red_dress', { kind: 'red_dress', elapsed: 5, started: true });
    plaza.update(state, 5); const figure = plazaRoot.getObjectByName('red-dress-crowd-0')!; const frozen = figure.position.z;
    const veil = plazaRoot.getObjectByName('red-dress-water-veil')!; const veilPose = veil.matrixWorld.toArray();
    plaza.update(state, 5.6); assert.equal(figure.position.z, frozen, 'the crowd holds the exact frozen program frame');
    assert.deepEqual(veil.matrixWorld.toArray(), veilPose, 'the curved lip stays attached while the saved shader clock freezes the water');
    const daylight = plazaRoot.getObjectByName('red-dress-sun') as THREE.DirectionalLight;
    const intensity = daylight.intensity; state.training!.elapsed = 7; plaza.update(state, 7);
    assert.equal(daylight.intensity, intensity, 'the same daylight illuminates Smith and the frozen crowd');
  } finally { plaza.dispose(); }
});
