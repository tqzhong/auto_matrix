import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from 'three';
import { FILM_SETS, filmBlocked, filmGroundHeight, redDressAttention, trainingRoot, type FilmJourney } from '@auto_matrix/shared';
import { TrainingSetRenderer } from '../packages/client/src/engine/TrainingSetRenderer.js';
import { FilmSetRenderer } from '../packages/client/src/engine/FilmSetRenderer.js';
import { LightingSystem } from '../packages/client/src/engine/LightingSystem.js';
import { WorldState } from '../packages/server/src/world/WorldState.js';
import { AgentManager } from '../packages/server/src/agents/AgentManager.js';
import type { SandboxState } from '@auto_matrix/shared';

const set = FILM_SETS.film_red_dress_plaza;
function fixture(t: test.TestContext) {
  const root = new THREE.Group(); root.position.set(set.center.x, set.center.y - 1, set.center.z);
  const renderer = new TrainingSetRenderer(root, 'm1_red_dress'); root.updateMatrixWorld(true);
  t.after(() => renderer.dispose()); return { root, renderer };
}
const position = (x: number, z: number, y = 0) => ({ x: set.center.x + x, y: set.center.y + y, z: set.center.z + z });

test('the actual plaza atmosphere uses one daylight shadow and restores the outside world when leaving', t => {
  const scene = new THREE.Scene(); scene.background = new THREE.Color(); scene.fog = new THREE.FogExp2();
  const film = new FilmSetRenderer(scene), lighting = new LightingSystem(scene), camera = new THREE.PerspectiveCamera();
  t.after(() => { film.dispose(); lighting.dispose(); });
  const world = new WorldState(); new AgentManager(world).initializeAllAgents();
  const neo = world.agents.get('neo')!; neo.position = position(7, -12); neo.isInMatrix = true;
  const journey = { scene: 'm1_red_dress', step: 0, actor: 'neo', completed: [] } as unknown as FilmJourney;
  film.update(neo, { neoLife: { journey } } as SandboxState, 0);
  lighting.update(0, camera, false, film.atmosphere());
  const shadows: THREE.Light[] = [];
  scene.traverse(object => { if (object instanceof THREE.Light && object.castShadow && object.intensity > 0) shadows.push(object); });
  assert.deepEqual(shadows.map(light => light.name), ['red-dress-sun'], 'two suns redraw every pedestrian and produce inconsistent shadow directions');
  assert.ok(shadows[0].intensity >= 2);
  film.update(undefined, undefined, 0); lighting.update(0, camera, false, film.atmosphere());
  assert.equal(lighting.directionalLight.castShadow, true, 'ordinary world daylight still has its shadow');
});

test('the plaza has a broad curved waterfall behind the passing woman, with a continuous receiving pool', t => {
  const { root } = fixture(t), veil = root.getObjectByName('red-dress-water-veil') as THREE.Mesh;
  assert.ok(veil, 'the central jet fountain must be replaced by the film waterfall');
  const bounds = new THREE.Box3().setFromObject(veil), size = bounds.getSize(new THREE.Vector3());
  assert.ok(size.x > 35 && size.y > 4 && size.z > 1, 'a wide curved falling sheet, not a plane or narrow jet');
  assert.ok(bounds.max.z < set.center.z - 30, 'water remains behind the actual woman approach, not beside the player');
  const vertices = veil.geometry.attributes.position;
  const uniqueX = new Set(Array.from({ length: vertices.count }, (_, i) => vertices.getX(i)));
  assert.ok(uniqueX.size >= 48, 'the water lip must remain continuous at player distance');
  assert.equal(root.getObjectByName('red-dress-fountain-upper-bowl'), undefined);
  for (let x = -20; x <= 20; x += 2) {
    const ray = new THREE.Raycaster(new THREE.Vector3(set.center.x + x, 12, set.center.z - 34), new THREE.Vector3(0, -1, 0));
    assert.ok(ray.intersectObject(root.getObjectByName('red-dress-pool-water')!, true).length, `missing receiving pool at ${x}`);
  }
});

test('visible fountain walls, benches and planters stop the player instead of being decorative pass-through meshes', t => {
  const { root } = fixture(t);
  for (const [x, z] of [[0, -38], [10, -38], [-10, -38], [-26, -13], [26, 13], [-26, 29], [26, 29]]) {
    assert.ok(filmBlocked(position(x, z), set, .65), `solid visible prop has no collision: ${x}, ${z}`);
    const hits = [-.2, 0, .2].flatMap(dx => new THREE.Raycaster(new THREE.Vector3(set.center.x + x + dx, 10, set.center.z + z), new THREE.Vector3(0, -1, 0)).intersectObject(root, true));
    assert.ok(hits.some(hit => hit.point.y > .5), `collision needs an actual raised surface at ${x},${z}, including the gaps between bench slats`);
  }
});

test('the full player attention route and moving crowd lanes stay clear of the new fountain and furniture', t => {
  const { root } = fixture(t);
  for (const x of [0, 16, -6, 22]) for (let z = -26; z <= 35; z += .5)
    assert.equal(filmBlocked(position(x, z), set, .65), false, `pedestrian blocked at ${x},${z}`);
  for (let elapsed = 0; elapsed <= 12; elapsed += .1) {
    const attention = redDressAttention(elapsed), training = { kind: 'red_dress' as const, elapsed, started: true, attention };
    for (const role of ['neo', 'morpheus', 'citizen_1', 'citizen_2', 'smith'] as const) {
      const actor = trainingRoot(training, role);
      assert.equal(filmBlocked(position(actor.x, actor.z), set, .65), false, `${role} enters scenery at ${elapsed}`);
    }
  }
  for (let z = -26; z <= 35; z += 1) {
    const ray = new THREE.Raycaster(new THREE.Vector3(set.center.x + 7, 6, set.center.z + z), new THREE.Vector3(0, -1, 0));
    const hit = ray.intersectObject(root.getObjectByName('red-dress-paving')!, true)[0];
    assert.ok(hit && Math.abs(hit.point.y + 1 - filmGroundHeight(position(7, z), set)) < .001, 'visible paving and feet plane must coincide');
  }
});

test('falling water and the pool use the saved frozen clock, including a cold renderer', t => {
  const { root, renderer } = fixture(t);
  const shader = (name: string) => {
    const material = (root.getObjectByName(name) as THREE.Mesh)?.material as THREE.MeshStandardMaterial;
    assert.ok(material, `missing actual water surface ${name}`);
    const source = { uniforms: {}, vertexShader: '#include <common>\n#include <uv_vertex>', fragmentShader: '#include <common>\n#include <color_fragment>' };
    material.onBeforeCompile(source as Parameters<typeof material.onBeforeCompile>[0], {} as THREE.WebGLRenderer);
    return source.uniforms as { trainingWaterTime: { value: number } };
  };
  const veil = shader('red-dress-water-veil'), pool = shader('red-dress-pool-water');
  const training = { kind: 'red_dress' as const, elapsed: 7, started: true, attention: { ...redDressAttention(6.2), clock: 8.4 } };
  const state = { version: 1, scene: 'm1_red_dress', step: 1, actor: 'neo', completed: [], enteredAt: 0,
    checkpoint: set.center, reflections: {}, lastText: '', training } as FilmJourney;
  renderer.update(state, 10); assert.equal(veil.trainingWaterTime.value, 8.4); assert.equal(pool.trainingWaterTime.value, 8.4);
  renderer.update(state, 1000); assert.equal(veil.trainingWaterTime.value, 8.4);
  training.attention.phase = 'walking'; training.attention.clock = 9; renderer.update(state, 1001);
  assert.equal(veil.trainingWaterTime.value, 9);
  const cold = fixture(t); cold.renderer.update(JSON.parse(JSON.stringify(state)), 0);
  const material = (cold.root.getObjectByName('red-dress-water-veil') as THREE.Mesh).material as THREE.MeshStandardMaterial;
  const source = { uniforms: {}, vertexShader: '#include <common>\n#include <uv_vertex>', fragmentShader: '#include <common>\n#include <color_fragment>' };
  material.onBeforeCompile(source as Parameters<typeof material.onBeforeCompile>[0], {} as THREE.WebGLRenderer);
  assert.equal((source.uniforms as typeof veil).trainingWaterTime.value, 9);
});

test('curved pool walls, the recessed basin floor and the raised spillway agree with actual rendered surfaces', t => {
  const { root } = fixture(t), fountain = root.getObjectByName('red-dress-fountain')!;
  const solid: THREE.Object3D[] = [];
  fountain.traverse(object => { if (object instanceof THREE.Mesh && !/water/.test(object.name)) solid.push(object); });
  solid.push(root.getObjectByName('red-dress-paving')!);
  let samples = 0;
  for (let x = -22; x <= 22; x += .5) for (let z = -40.25; z <= -30; z += .5) {
    const ray = new THREE.Raycaster(new THREE.Vector3(set.center.x + x, 10, set.center.z + z), new THREE.Vector3(0, -1, 0));
    const hit = ray.intersectObjects(solid, false)[0];
    assert.ok(hit, `no visible support at ${x},${z}`);
    assert.ok(Math.abs(hit.point.y + 1 - filmGroundHeight(position(x, z), set)) < .001, `render/physics floor mismatch at ${x},${z}: ${hit.point.y}`);
    if (hit.point.y > .2) assert.ok(filmBlocked(position(x, z), set, .1), `raised solid can be walked through at ${x},${z}`);
    samples++;
  }
  t.diagnostic(JSON.stringify({ floorSamples: samples }));
});

test('physical bank facades enclose the plaza while static detail stays within its draw budget', t => {
  const { root } = fixture(t); let meshes = 0, triangles = 0;
  root.traverse(object => {
    if (!(object instanceof THREE.Mesh)) return;
    for (let parent: THREE.Object3D | null = object; parent; parent = parent.parent) if (/^red-dress-crowd-/.test(parent.name)) return;
    meshes++; triangles += (object.geometry.index?.count ?? object.geometry.attributes.position.count) / 3;
  });
  for (const side of [-1, 1]) for (const z of [-24, -6, 12, 30]) {
    const hits = new THREE.Raycaster(new THREE.Vector3(set.center.x, 5, set.center.z + z), new THREE.Vector3(side, 0, 0), 0, 36).intersectObject(root, true);
    assert.ok(hits.some(hit => Math.abs(hit.point.x - set.center.x) > 29 && Math.abs(hit.point.x - set.center.x) < 34), 'the street needs nearby three-dimensional facades, including recessed windows behind the pilasters');
  }
  assert.ok(meshes <= 100, `${meshes} static meshes exceed the plaza draw budget`);
  assert.ok(triangles <= 75000, `${triangles} static triangles exceed the plaza budget`);
  t.diagnostic(JSON.stringify({ meshes, triangles }));
});
