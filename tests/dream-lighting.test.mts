import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from 'three';
import { FILM_SCENE_BY_ID, FILM_SETS, filmEntry, filmPosition, newReloaded, reloadedRoot, type FilmJourney, type SandboxState } from '@auto_matrix/shared';
import { FilmSetRenderer } from '../packages/client/src/engine/FilmSetRenderer.js';
import { LightCulling } from '../packages/client/src/engine/LightCulling.js';
import { GunfireEffects } from '../packages/client/src/engine/GunfireEffects.js';
import type { GameAudio } from '../packages/client/src/engine/GameAudio.js';
import { reloadedCamera } from '../packages/client/src/player/ReloadedCamera.js';
import { AgentManager } from '../packages/server/src/agents/AgentManager.js';
import { WorldState } from '../packages/server/src/world/WorldState.js';

function setup(t: test.TestContext) {
  const previous = globalThis.document;
  const ctx = { fillRect() {}, strokeRect() {}, fillText() {}, createRadialGradient: () => ({ addColorStop() {} }) };
  globalThis.document = { createElement: () => ({ getContext: () => ctx }) } as unknown as Document;
  t.mock.method(THREE.TextureLoader.prototype, 'load', () => new THREE.Texture({ width: 1, height: 1, complete: true }));
  const scene = new THREE.Scene(), camera = new THREE.PerspectiveCamera(57, 16 / 9, .5, 5000);
  const sets = new FilmSetRenderer(scene), culling = new LightCulling(scene);
  const gunfire = new GunfireEffects(scene, { effects: () => undefined } as unknown as GameAudio);
  t.after(() => { gunfire.dispose(); culling.dispose(); sets.dispose(); globalThis.document = previous; });
  const world = new WorldState(); new AgentManager(world).initializeAllAgents(); const actor = world.agents.get('trinity')!;
  actor.currentLocation = 'film_trinity_roof'; actor.isInMatrix = true;
  const journey: FilmJourney = { version: 1, scene: 'm2_dream', actor: 'trinity', step: 0, completed: [], enteredAt: 0,
    reflections: {}, lastText: '', checkpoint: filmEntry(FILM_SCENE_BY_ID.m2_dream), reloaded: newReloaded('dream') };
  const sandbox = { neoLife: { journey } } as SandboxState;
  const graphics = {} as THREE.WebGLRenderer;
  const pose = (phase: NonNullable<FilmJourney['reloaded']>['phase'], elapsed: number, first = false, yaw = 0) => {
    Object.assign(journey.reloaded!, { phase, elapsed }); journey.step = phase === 'approach' ? 0 : phase === 'done' ? 2 : 1;
    const point = reloadedRoot(journey.reloaded!, 'trinity');
    actor.position = phase === 'approach' ? filmEntry(FILM_SCENE_BY_ID.m2_dream) : phase === 'window_ready' ? filmPosition('film_trinity_roof', .7, -12.4)
      : { ...filmPosition(point.set, point.x, point.z), y: FILM_SETS[point.set].center.y + point.y };
    const frame = reloadedCamera({ ...journey.reloaded!, role: 'trinity' }, actor.position, actor.currentLocation, first, camera.aspect, yaw, .1);
    camera.position.copy(frame.eye); camera.lookAt(frame.target); camera.updateMatrixWorld(true);
    sets.update(actor, sandbox, 0, actor.position, camera.position, undefined, first, 12000, camera);
    culling.stablePointSlots = sets.stablePointSlots; culling.minimumPointSlots = sets.minimumPointSlots;
    scene.updateMatrixWorld(true);
  };
  const sample = () => {
    scene.updateMatrixWorld(true); camera.updateMatrixWorld(true);
    const original: { light: THREE.PointLight; intensity: number; visible: boolean; position: THREE.Vector3 }[] = [];
    scene.traverseVisible(object => { if (object instanceof THREE.PointLight) original.push({ light: object, intensity: object.intensity, visible: object.visible, position: object.getWorldPosition(new THREE.Vector3()) }); });
    scene.onBeforeRender(graphics, scene, camera, null);
    let count = 0;
    try {
      scene.traverseVisible(object => { if (object instanceof THREE.PointLight) count++; });
      for (const x of [-.7, 0, .7]) for (const y of [-.7, 0, .7]) for (const z of [.5, .9, .98, .995]) {
        const point = new THREE.Vector3(x, y, z).unproject(camera);
        for (const item of original) if (item.visible && item.intensity > 0 && point.distanceTo(item.position) < item.light.distance) {
          assert.equal(item.light.visible, true, 'a potentially contributing fixture or muzzle flash cannot disappear');
          assert.equal(item.light.intensity, item.intensity, 'fixed slots cannot dim a contributing light');
        }
      }
    } finally { scene.onAfterRender(graphics, scene, camera); }
    for (const item of original) {
      assert.equal(item.light.intensity, item.intensity); assert.equal(item.light.visible, item.visible);
      assert.ok(item.light.getWorldPosition(new THREE.Vector3()).equals(item.position));
    }
    return count;
  };
  const shot = () => {
    const from = { ...actor.position, y: actor.position.y + 2.4 };
    gunfire.shot({ source: 'trinity', target: 'agent_johnson', position: { ...from, y: from.y + 8 },
      direction: { x: 0, y: 1, z: 0 }, damage: 0, combo: 0, matrix: true, downed: false, shot: { from, surface: 'body' } });
  };
  return { sets, culling, gunfire, journey, pose, sample, shot };
}

test('dream maintains seven point-light slots from the maintenance floor through the saved fall', t => {
  const h = setup(t);
  for (const [phase, elapsed] of [['approach', 0], ['window_ready', 0], ['breaking', .5], ['falling', 1.3], ['falling', 5.1], ['dream_hit', .3], ['done', 0]] as const)
    for (const first of [false, true]) for (const yaw of [0, Math.PI / 2, Math.PI, -Math.PI / 2]) {
      h.pose(phase, elapsed, first, yaw);
      assert.equal(h.sample(), 7, `${phase}/${elapsed}/${first}/${yaw}: camera and marker changes cannot recompile the room`);
    }
});

test('the actual dream muzzle flash uses the reserved slot through its full lifetime without losing energy', t => {
  const h = setup(t); h.pose('falling', 1.3);
  assert.equal(h.sample(), 7);
  h.shot(); assert.equal(h.sample(), 7, 'adding the real shot cannot change the shader layout');
  for (const delta of [.035, .035, .02, .03]) { h.gunfire.update(delta); assert.equal(h.sample(), 7); }
  assert.equal(h.journey.reloaded!.elapsed, 1.3, 'render lighting cannot advance the saved dream clock');
});

test('an unexpected overlapping flash retains its real energy and the dream reservation ends on departure', t => {
  const h = setup(t); h.pose('falling', 3.2); h.shot(); h.shot();
  assert.equal(h.sample(), 8, 'an extra real light cannot be hidden just to meet the usual seven-slot layout');
  h.gunfire.update(.12); assert.equal(h.sample(), 7);
  h.sets.update(undefined, undefined, 0);
  assert.equal(h.sets.minimumPointSlots, 0); assert.equal(h.sets.stablePointSlots, false);
});
