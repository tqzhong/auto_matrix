import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from 'three';
import { FILM_SETS, type FilmJourney, type SandboxState } from '@auto_matrix/shared';
import { FilmSetRenderer } from '../packages/client/src/engine/FilmSetRenderer.js';
import { LightCulling } from '../packages/client/src/engine/LightCulling.js';
import { WorldState } from '../packages/server/src/world/WorldState.js';
import { AgentManager } from '../packages/server/src/agents/AgentManager.js';

function fixture(t: test.TestContext) {
  t.mock.method(THREE.TextureLoader.prototype, 'load', () => new THREE.Texture());
  const document = globalThis.document;
  globalThis.document = { createElement: () => ({ getContext: () => ({ fillRect() {}, strokeRect() {}, fillText() {}, beginPath() {}, moveTo() {}, lineTo() {}, closePath() {}, stroke() {}, fill() {}, ellipse() {} }) }) } as unknown as Document;
  const scene = new THREE.Scene(), film = new FilmSetRenderer(scene), culling = new LightCulling(scene), camera = new THREE.PerspectiveCamera(60, 1, .1, 1000);
  const world = new WorldState(); new AgentManager(world).initializeAllAgents(); const neo = world.agents.get('neo')!, center = FILM_SETS.film_ambush_house.center;
  neo.position = { x: center.x + 11, y: center.y, z: center.z + 31.8 }; neo.currentLocation = 'film_ambush_house'; neo.isInMatrix = true;
  const journey = { scene: 'm1_dejavu', actor: 'neo', step: 0, completed: [], ambush: { elapsed: 13.7 } } as FilmJourney;
  const sandbox = { structures: [], neoLife: { journey } } as unknown as SandboxState;
  const stage = (id: FilmJourney['scene']) => { journey.scene = id; film.update(neo, sandbox, 0); };
  stage('m1_dejavu');
  const flash = new THREE.PointLight(0xffd495, 85, 9); flash.position.set(center.x - 18, center.y + 2.6, center.z - 15);
  let result: { slots: number; energy: [number, number][] };
  const renderer = { compile(_subject: THREE.Object3D, _camera: THREE.Camera, lights: THREE.Scene) {
    const points: THREE.PointLight[] = []; lights.traverseVisible(object => { if (object instanceof THREE.PointLight) points.push(object); });
    result = { slots: points.length, energy: points.filter(light => light.intensity > 0).map(light => [light.id, light.intensity]) };
  } } as unknown as THREE.WebGLRenderer;
  const sample = (reserve = true) => {
    culling.minimumPointSlots = reserve ? film.minimumPointSlots : 0; culling.stablePointSlots = film.stablePointSlots;
    culling.compileSubject(renderer, camera, new THREE.Group()); return result!;
  };
  t.after(() => { flash.dispose(); culling.dispose(); film.dispose(); globalThis.document = document; });
  return { scene, film, camera, flash, center, sample, stage };
}

test('the old-building alarm, revealed shaft and bathroom keep one light layout without changing selected real light energy', t => {
  const h = fixture(t), slots: number[] = [];
  const door = h.scene.getObjectByName('mouse-room-door');
  for (const id of ['m1_dejavu', 'm1_wetwall', 'm1_wall_exposed', 'm1_bathroom'] as const) {
    h.flash.removeFromParent(); h.stage(id);
    assert.equal(h.scene.getObjectByName('mouse-room-door'), door, 'the continuous old-building scenes must keep the same physical set');
    const shaft = h.scene.getObjectByName('ambush-wetwall-shaft'); assert.ok(shaft);
    let lights = 0; shaft.traverseVisible(object => { if (object instanceof THREE.PointLight) lights++; });
    assert.equal(lights, id === 'm1_dejavu' ? 0 : 6, `${id}: revealing the shaft must retain its five lamps and the sixth-floor room lamp`);
    for (const [x, y, z, toward] of [[8, 4, 32, [16, 2, 29]], [-16, 4, -12, [-18, 2, -15]], [11, -32, 32, [-18, -34, -16]], [-18, -33, -28, [-18, -40, -32]], [-18, -42, -32, [-18, -20, -32]], [9, 4, -4, [-2, 2, -8]]] as [number, number, number, number[]][]) {
      h.camera.position.set(h.center.x+x, h.center.y+y, h.center.z+z); h.camera.lookAt(h.center.x+toward[0],h.center.y+toward[1],h.center.z+toward[2]);
      for (const firing of id === 'm1_dejavu' ? [false, true, false] : [false]) {
        if (firing) h.scene.add(h.flash); else h.flash.removeFromParent();
        const reference = h.sample(false), reserved = h.sample();
        assert.deepEqual(reserved.energy, reference.energy, 'empty shader slots must not relight the room or remove real fixtures');
        slots.push(reserved.slots);
      }
    }
  }
  assert.deepEqual([...new Set(slots)], [17], 'the camera cut, scripted flash and revealed shaft must reuse the seventeen-slot color variant');
});
