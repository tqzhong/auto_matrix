import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from 'three';
import { FILM_SETS, MIRROR_SEAT, MIRROR_TIMING, PILL_ROOM, filmPosition, mirrorEntryPose, mirrorTime, type AwakeningBeat } from '@auto_matrix/shared';
import { WorldState } from '../packages/server/src/world/WorldState.js';
import { AgentManager } from '../packages/server/src/agents/AgentManager.js';
import { PlayerControls } from '../packages/client/src/player/PlayerControls.js';
import { newMotion, advanceMotion } from '../packages/client/src/agents/CharacterMotion.js';
import { actor } from './helpers/fighting-hand-fixture.mjs';
import { FilmSetRenderer } from '../packages/client/src/engine/FilmSetRenderer.js';
import { AgentRenderer } from '../packages/client/src/agents/AgentRenderer.js';
import type { HeroRig } from '../packages/client/src/agents/HeroModel.js';
import { GLTFLoader, type GLTF } from 'three/addons/loaders/GLTFLoader.js';
import { handSurface } from './helpers/hand-surface.mjs';

async function setup(t: test.TestContext) {
  const h = await actor('neo'); t.after(() => h.models.dispose());
  class InputTarget extends EventTarget { matches() { return false; } }
  const previous = ['window', 'document'].map(key => Object.getOwnPropertyDescriptor(globalThis, key));
  const window = new InputTarget(), canvas = new InputTarget();
  const context = { createRadialGradient: () => ({ addColorStop() {} }), fillRect() {}, strokeRect() {}, fillText() {}, beginPath() {}, closePath() {}, moveTo() {}, lineTo() {}, stroke() {}, fill() {},
    createImageData: (width: number, height: number) => ({ data: new Uint8ClampedArray(width * height * 4) }), putImageData() {} };
  const document = Object.assign(new InputTarget(), { pointerLockElement: canvas, hidden: false, exitPointerLock() {}, createElement: () => ({ getContext: () => context }) });
  Object.assign(globalThis, { window, document });
  const camera = new THREE.PerspectiveCamera(57, 16 / 9, .5, 5000), group = new THREE.Group();
  h.rig.root.position.set(0, -1, 0); group.add(h.rig.root);
  const controls = new PlayerControls(canvas as unknown as HTMLCanvasElement, camera, () => {}, () => {});
  t.after(() => { controls.dispose(); ['window', 'document'].forEach((key, i) => {
    if (previous[i]) Object.defineProperty(globalThis, key, previous[i]!); else Reflect.deleteProperty(globalThis, key);
  }); });
  const world = new WorldState(); new AgentManager(world).initializeAllAgents();
  const neo = world.agents.get('neo')!; neo.currentLocation = 'film_lafayette'; neo.isInMatrix = true;
  const beat = { kind: 'mirror' as const, elapsed: 0, chairMotion: 'stepping' as const, approach: { x: -7.1, z: -14.6, yaw: .45 } };
  neo.position = filmPosition('film_lafayette', beat.approach.x, beat.approach.z); neo.rotation = beat.approach.yaw;
  controls.possess(neo); controls.firstPerson = true;
  const motion = newMotion(), head = h.rig.bones.get('head')!;
  const marker = head.userData.cameraEye as THREE.Vector3;
  assert.ok(marker, 'the delivered head must supply its calibrated eye');
  const draw = (saved: AwakeningBeat) => {
    const pose = mirrorEntryPose(saved);
    neo.position = filmPosition('film_lafayette', pose.x, pose.z); neo.rotation = pose.yaw;
    neo.currentAction = { type: 'idle', parameters: { filmPose: 'touch', mirrorBeat: mirrorTime(saved), mirrorEntry: saved }, startedAt: 0, duration: 1, progress: 0 };
    controls.performing = true; controls.update(.05, neo, group, false);
    h.models.animate(h.rig, advanceMotion(motion, controls.motion, 0), motion, controls.motion, 0);
    group.updateMatrixWorld(true);
    controls.syncTrackingCamera(group);
    return head.localToWorld(marker.clone());
  };
  const loadAsset = (name: string) => (h.models as unknown as { load(id: string): Promise<GLTF> }).load(name);
  return { controls, camera, group, neo, document, marker, beat, draw, loadAsset };
}

test('tracking first person uses the delivered current posed eye while retaining mouse look', async t => {
  const { controls, camera, group, document, marker, beat, draw } = await setup(t);
  const unchanged = marker.clone(), entry = mirrorEntryPose(beat);
  const times = [0, .6, 1.5, entry.seatStart - .01, entry.seatStart + .1, entry.seatStart + .7, entry.duration, entry.duration + .8, entry.duration + 2.1];
  for (const elapsed of times) {
    const eye = draw({ ...beat, elapsed });
    assert.ok(camera.position.distanceTo(eye) < 1e-6,
      `camera is ${camera.position.distanceTo(eye)} from the current posed eye at ${elapsed}s`);
  }
  const before = camera.getWorldDirection(new THREE.Vector3());
  document.dispatchEvent(Object.assign(new Event('mousemove'), { movementX: 160, movementY: -80 }));
  draw({ ...beat, elapsed: times.at(-1)! });
  assert.ok(camera.getWorldDirection(new THREE.Vector3()).distanceTo(before) > .25, 'eye resampling cannot override free look');
  assert.deepEqual(marker.toArray(), unchanged.toArray(), 'resampling cannot mutate the shared local eye marker');
  controls.firstPerson = false; draw({ ...beat, elapsed: entry.duration });
  const third = camera.position.clone(); controls.syncTrackingCamera(group);
  assert.ok(third.distanceTo(camera.position) < 1e-8, 'the posed eye cannot override a third-person shot');
});

test('the actual player renderer preserves mirror hand contact in both views and during silver spread', async t => {
  const game = await setup(t);
  t.mock.method(THREE.TextureLoader.prototype, 'load', () => new THREE.Texture());
  t.mock.method(GLTFLoader.prototype, 'loadAsync', async url => game.loadAsset(/\/characters\/([^/]+)\.glb$/.exec(String(url))![1]));
  const renderer = new AgentRenderer(new THREE.Scene()); t.after(() => renderer.dispose());
  game.neo.position = filmPosition('film_lafayette', MIRROR_SEAT.x, MIRROR_SEAT.z); game.neo.rotation = Math.PI;
  renderer.updateAgent('neo', game.neo); await new Promise(resolve => setImmediate(resolve));
  const group = renderer.getAgent('neo')!;
  const rig = (renderer as unknown as { agents: Map<string, { rig: { hero?: HeroRig } }> }).agents.get('neo')!.rig.hero;
  assert.ok(rig, 'the actual renderer must finish loading the delivered Neo, rather than testing a placeholder');
  const hand = handSurface(rig, 'R');
  for (const firstPerson of [false, true]) for (const mirrorBeat of [3.1, MIRROR_TIMING.touch, 4.2]) {
    const entry = { ...game.beat, elapsed: mirrorEntryPose(game.beat).duration + mirrorBeat - MIRROR_TIMING.sit };
    game.neo.currentAction = { type: 'idle', parameters: { filmPose: 'touch', mirrorBeat, mirrorEntry: entry }, startedAt: 0, duration: 1, progress: 0 };
    renderer.updateAgent('neo', game.neo); game.controls.possess(game.neo); game.controls.firstPerson = firstPerson; game.controls.performing = true;
    game.controls.update(.05, game.neo, group, false); renderer.setPlayer('neo', firstPerson); renderer.setPlayerMotion(game.controls.motion);
    renderer.update(0, game.camera, 0); group.updateMatrixWorld(true); game.controls.syncTrackingCamera(group);
    const actual = hand.draw(); assert.equal(actual.self.count, 0, `player ${firstPerson}/${mirrorBeat}: ${JSON.stringify(actual.self)}`);
    const world = [...actual.points.values()].map(point => point.clone().applyMatrix4(rig.bones.get('wrist_R')!.matrixWorld));
    const nearest = Math.min(...world.map(point => point.z - FILM_SETS.film_lafayette.center.z - PILL_ROOM.mirror.z));
    assert.ok(nearest > -.015, `the actual player skin passes through the mirror at ${firstPerson}/${mirrorBeat}: ${nearest}`);
    if (mirrorBeat === MIRROR_TIMING.touch) assert.ok(nearest < .03, 'the actual player must make contact with its skin');
  }
});

test('the real first-person near plane stays clear of the tracking mirror frame during entry', async t => {
  const game = await setup(t);
  t.mock.method(THREE.TextureLoader.prototype, 'load', () => new THREE.Texture());
  const renderer = new FilmSetRenderer(new THREE.Scene());
  renderer.update(game.neo, undefined, 0); renderer.root.updateMatrixWorld(true);
  try { for (const aspect of [16 / 9, .65]) for (const approach of [game.beat.approach,
    { x: -7.0594900428505, z: -14.53079340651, yaw: -2.6137389711102355 }]) {
    const beat = { ...game.beat, approach }, entry = mirrorEntryPose(beat);
    game.neo.position = filmPosition('film_lafayette', approach.x, approach.z); game.neo.rotation = approach.yaw;
    game.controls.possess(game.neo); game.controls.firstPerson = true; game.camera.aspect = aspect;
    const times = Array.from({ length: Math.ceil(entry.duration / .22) + 1 }, (_, i) => Math.min(entry.duration, i * .22));
    for (const elapsed of times) {
      game.draw({ ...beat, elapsed }); game.camera.updateMatrixWorld(true);
      for (const x of [-1, 1]) for (const y of [-1, 1]) {
        const corner = new THREE.Vector3(x, y, -1).unproject(game.camera), sight = corner.sub(game.camera.position);
        const hit = new THREE.Raycaster(game.camera.position, sight.clone().normalize(), .0001, sight.length() + .001)
          .intersectObject(renderer.root, true).find(hit => {
            for (let object: THREE.Object3D | null = hit.object; object; object = object.parent) if (!object.visible) return false;
            const mesh = hit.object as THREE.Mesh;
            return mesh.castShadow && !Array.isArray(mesh.material) && !mesh.material.transparent;
          });
        assert.ok(!hit, `near plane cuts the actual scenery at ${aspect}/${elapsed}, corner=${x}/${y}, hit=${hit?.point.toArray()}`);
      }
    }
  } } finally { renderer.dispose(); }
});
