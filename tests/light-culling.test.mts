import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from 'three';
import { FILM_SCENE_BY_ID, FILM_SETS, airRescueRoot, filmEntry, filmPosition, filmStepPosition, newAmbushEscape, type AirRescueEncounter, type FilmJourney, type SandboxState } from '@auto_matrix/shared';
import { FilmSetRenderer } from '../packages/client/src/engine/FilmSetRenderer.js';
import { LightCulling } from '../packages/client/src/engine/LightCulling.js';
import { AgentManager } from '../packages/server/src/agents/AgentManager.js';
import { WorldState } from '../packages/server/src/world/WorldState.js';

function view() {
  const scene = new THREE.Scene(), camera = new THREE.PerspectiveCamera(60, 1, .1, 100);
  const culling = new LightCulling(scene), renderer = {} as THREE.WebGLRenderer;
  const before = (eye: THREE.Camera = camera) => { scene.updateMatrixWorld(); eye.updateMatrixWorld(); scene.onBeforeRender(renderer, scene, eye, null); };
  const after = (eye: THREE.Camera = camera) => scene.onAfterRender(renderer, scene, eye);
  const light = (x: number, z: number, radius: number, intensity = 10) => {
    const value = new THREE.PointLight(0xffffff, intensity, radius); value.position.set(x, 0, z); scene.add(value); return value;
  };
  return { scene, camera, culling, before, after, light };
}

test('only lights whose finite influence misses the view lose energy, preserving possible contributors', () => {
  const h = view(), front = h.light(0, -10, 4), outside = h.light(60, -10, 4);
  const overlapping = h.light(8, -10, 6), behind = h.light(0, 3, 6), unlimited = h.light(300, 10, 0);
  const off = h.light(0, -10, 100, 0), hidden = h.light(0, -10, 4); hidden.visible = false;
  const withChild = h.light(300, -10, 2); withChild.add(new THREE.Mesh());
  const sun = new THREE.DirectionalLight(); h.scene.add(sun);
  try {
    h.before();
    for (const light of [front, overlapping, behind, unlimited, withChild, sun]) assert.equal(light.visible, true);
    assert.equal(outside.visible, true); assert.equal(outside.intensity, 0); assert.equal(off.visible, false); assert.equal(hidden.visible, false);
    h.after(); assert.equal(outside.intensity, 10); assert.equal(off.visible, true); assert.equal(hidden.visible, false);
    h.culling.enabled = false; h.before(); assert.equal(outside.intensity, 10); h.after();
  } finally { h.culling.dispose(); }
});

test('a nested reflection gets its own lights and restores the outer selection afterward', () => {
  const h = view(), front = h.light(0, -10, 3), rear = h.light(0, 10, 3);
  const mirror = new THREE.PerspectiveCamera(60, 1, .1, 100); mirror.rotation.y = Math.PI;
  try {
    h.before(); assert.equal(front.intensity, 10); assert.equal(rear.intensity, 0);
    h.before(mirror); assert.equal(front.intensity, 0); assert.equal(rear.intensity, 10);
    h.after(mirror); assert.equal(front.intensity, 10); assert.equal(rear.intensity, 0);
    h.after(); assert.equal(front.intensity, 10); assert.equal(rear.intensity, 10);
    h.camera.rotation.y = Math.PI; h.before(); assert.equal(rear.intensity, 10); assert.equal(front.intensity, 0); h.after();
  } finally { h.culling.dispose(); }
});

test('translated and scaled rooms use world-space distance and hidden rooms remain untouched', () => {
  const h = view(), room = new THREE.Group(), hidden = new THREE.Group(); hidden.visible = false;
  room.position.set(5000, -100, 5000); room.scale.setScalar(10); h.scene.add(room, hidden);
  h.camera.position.copy(room.position);
  const nearby = new THREE.PointLight(0xffffff, 20, 5); nearby.position.set(0, 0, -1); room.add(nearby);
  const far = new THREE.PointLight(0xffffff, 20, 5); far.position.set(6, 0, -1); room.add(far);
  const untouched = new THREE.PointLight(); hidden.add(untouched);
  try {
    h.before(); assert.equal(nearby.intensity, 20); assert.equal(far.intensity, 0); assert.equal(untouched.visible, true); h.after();
    room.position.x += 500; h.before(); assert.equal(nearby.intensity, 0); h.after();
  } finally { h.culling.dispose(); }
});

test('normal passes, array cameras and exceptional exits do not leave lighting hidden', () => {
  const h = view(), front = h.light(0, -10, 3), rear = h.light(0, 10, 3);
  const mirror = new THREE.PerspectiveCamera(60, 1, .1, 100); mirror.rotation.y = Math.PI;
  try {
    h.before(); h.before(mirror); h.culling.restore();
    assert.equal(front.visible, true); assert.equal(rear.visible, true);
    assert.equal(front.intensity, 10); assert.equal(rear.intensity, 10);
    h.scene.overrideMaterial = new THREE.MeshNormalMaterial(); h.before(); assert.equal(rear.intensity, 10); h.after();
    h.scene.overrideMaterial.dispose(); h.scene.overrideMaterial = null;
    h.before(new THREE.ArrayCamera()); assert.equal(rear.intensity, 10); h.after();
    h.before(); h.culling.dispose(); assert.equal(rear.visible, true);
    h.before(); assert.equal(rear.visible, true);
  } finally { h.culling.dispose(); }
});

test('sampling points across the actual camera volume never discards a light that can contribute there', () => {
  const h = view();
  for (let i = 0; i < 40; i++) h.light(Math.sin(i * 7.3) * 50, Math.cos(i * 2.9) * 80, 2 + i % 17);
  const point = new THREE.Vector3();
  try {
    for (const yaw of [0, .4, -1, Math.PI]) {
      h.camera.rotation.y = yaw; h.before();
      for (let x = -1; x <= 1; x += .2) for (let y = -1; y <= 1; y += .2) for (const z of [-1, 0, .8, .95, .99, 1]) {
        point.set(x, y, z).unproject(h.camera);
        for (const light of h.scene.children as THREE.PointLight[]) if (point.distanceTo(light.position) < light.distance) {
          assert.equal(light.visible, true, 'a potentially illuminated visible point lost its light');
          assert.equal(light.intensity, 10, 'a potentially illuminated visible point lost its energy');
        }
      }
      h.after();
    }
  } finally { h.culling.dispose(); }
});

test('turning through one room keeps non-shadow point-light shader slots stable without lighting offscreen pixels', () => {
  const h = view(), lights = [h.light(0, -10, 3), h.light(10, 0, 3), h.light(0, 10, 3), h.light(-10, 0, 3)];
  const off = h.light(0, -10, 3, 0), shadow = h.light(30000, -10, 3); shadow.castShadow = true;
  const children = h.scene.children.length;
  try {
    for (let frame = 0; frame < 32; frame++) {
      const facing = frame % 4; h.camera.rotation.y = -facing * Math.PI / 2; h.before();
      let slots = 0; h.scene.traverseVisible(object => { if (object instanceof THREE.PointLight) slots++; });
      assert.equal(slots, 4, 'camera-only changes must reuse the same lit-material shader variant');
      lights.forEach((light, index) => { assert.equal(light.visible, true); assert.equal(light.intensity, index === facing ? 10 : 0); });
      assert.equal(off.visible, false); assert.equal(shadow.visible, false, 'offscreen shadow maps still need visibility culling');
      assert.equal(h.scene.children.length, children, 'stability must not add lights to the scene');
      h.after(); lights.forEach(light => assert.equal(light.intensity, 10));
    }
  } finally { h.culling.dispose(); }
});

test('nested reflection and normal passes restore the exact point-light energy on return and exceptional exit', () => {
  const h = view(), front = h.light(0, -10, 3, 7.5), rear = h.light(0, 10, 3, 19);
  const distant = Array.from({ length: 10 }, (_, index) => h.light(30000 + index, -10, 3, 4 + index));
  const mirror = new THREE.PerspectiveCamera(60, 1, .1, 100); mirror.rotation.y = Math.PI;
  const normal = new THREE.MeshNormalMaterial();
  try {
    h.before(); assert.equal(front.intensity, 7.5); assert.equal(rear.intensity, 0);
    h.before(mirror); assert.equal(front.intensity, 0); assert.equal(rear.intensity, 19);
    h.scene.overrideMaterial = normal; h.before();
    assert.equal(front.intensity, 7.5); assert.equal(rear.intensity, 19);
    h.after(); h.scene.overrideMaterial = null;
    assert.equal(front.intensity, 0); assert.equal(rear.intensity, 19);
    h.after(mirror); assert.equal(front.intensity, 7.5); assert.equal(rear.intensity, 0);
    h.before(mirror); h.culling.restore();
    assert.equal(front.intensity, 7.5); assert.equal(rear.intensity, 19);
    h.before(); h.culling.dispose();
    assert.equal(front.intensity, 7.5); assert.equal(rear.intensity, 19);
    distant.forEach((light, index) => { assert.equal(light.visible, true); assert.equal(light.intensity, 4 + index); });
  } finally { normal.dispose(); h.culling.dispose(); }
});

test('many offscreen lights use bounded shader slots without losing any contributing light', () => {
  const h = view(), lights = Array.from({ length: 100 }, (_, index) => h.light(30000 + index, -10, 3));
  try {
    for (const contributing of [0, 1, 4, 5, 6, 7, 8, 9]) {
      lights.forEach((light, index) => { light.position.x = index < contributing ? (index - 4) * .1 : 30000 + index; });
      h.before(); let slots = 0;
      h.scene.traverseVisible(object => { if (object instanceof THREE.PointLight) slots++; });
      assert.equal(slots, contributing <= 4 ? 4 : contributing <= 8 ? 8 : 16);
      lights.forEach((light, index) => {
        if (index < contributing) { assert.equal(light.visible, true); assert.equal(light.intensity, 10); }
        else assert.ok(!light.visible || light.intensity === 0, 'a light beyond the view contributes no energy');
      });
      assert.equal(h.scene.children.length, 100);
      h.after(); lights.forEach(light => { assert.equal(light.visible, true); assert.equal(light.intensity, 10); });
    }
  } finally { h.culling.dispose(); }
});

test('a fixed point-light set keeps its shader slots while turning and turning lights off', () => {
  const h = view(); h.culling.stablePointSlots = true;
  const lights = Array.from({ length: 12 }, (_, index) => h.light(index < 7 ? index * .1 : 60 + index, -10, 3));
  const inactive = lights[0]; inactive.intensity = 0;
  const shadow = h.light(90, -10, 3); shadow.castShadow = true;
  try {
    for (const yaw of [0, Math.PI, 0]) {
      h.camera.rotation.y = yaw;
      h.before();
      assert.equal(lights.filter(light => light.visible).length, 12);
      assert.equal(lights[1].intensity, yaw === 0 ? 10 : 0);
      assert.equal(inactive.intensity, 0);
      assert.equal(shadow.visible, false);
      h.after();
      assert.equal(lights[1].intensity, 10);
      assert.equal(shadow.visible, true);
      inactive.intensity = yaw === 0 ? 10 : 0;
    }
  } finally { h.culling.dispose(); }
});

test('the Reloaded temple keeps point-light shader slots while walking, turning and finishing the assembly', t => {
  const h = view(), renderer = new FilmSetRenderer(h.scene);
  t.after(() => { h.culling.dispose(); renderer.dispose(); });
  const scene = FILM_SCENE_BY_ID.m2_temple;
  const world = new WorldState(); new AgentManager(world).initializeAllAgents();
  const actor = world.agents.get(scene.actor)!;
  actor.isInMatrix = false;
  const journey: FilmJourney = { version: 1, scene: scene.id, actor: actor.id, step: 0, completed: [], enteredAt: 0,
    checkpoint: filmEntry(scene), reflections: {}, lastText: '' };
  const sandbox = { neoLife: { journey } } as SandboxState;
  h.camera.aspect = 16 / 9; h.camera.far = 300; h.camera.updateProjectionMatrix();
  actor.position = journey.checkpoint;
  renderer.update(actor, sandbox, 0, actor.position);
  const hallLights: THREE.PointLight[] = [];
  renderer.root.traverseVisible(object => { if (object instanceof THREE.PointLight) hallLights.push(object); });
  const intensities = hallLights.map(light => light.intensity);
  const slotCounts: number[] = [];
  for (const [z, direction, step] of [[37, -1, 0], [10, -1, 0], [-15, -1, 0], [-35, 1, 1], [-26, -1, 3]]) {
    actor.position = filmPosition(scene.set, 0, z);
    journey.step = step;
    h.camera.position.set(actor.position.x, actor.position.y + 4, actor.position.z - direction * 6);
    h.camera.lookAt(actor.position.x, actor.position.y + 1, actor.position.z + direction * 10);
    renderer.update(actor, sandbox, 0, actor.position, h.camera.position, undefined, false, 12000, h.camera);
    h.culling.stablePointSlots = renderer.stablePointSlots;
    h.before();
    try {
      let slots = 0;
      h.scene.traverseVisible(object => { if (object instanceof THREE.PointLight) slots++; });
      slotCounts.push(slots);
      const frustum = new THREE.Frustum().setFromProjectionMatrix(new THREE.Matrix4().multiplyMatrices(h.camera.projectionMatrix, h.camera.matrixWorldInverse));
      hallLights.forEach((light, index) => {
        if (frustum.intersectsSphere(new THREE.Sphere(light.getWorldPosition(new THREE.Vector3()), light.distance))) {
          assert.equal(light.visible, true);
          assert.equal(light.intensity, intensities[index], 'a light reaching the visible hall keeps its authored energy');
        }
      });
    } finally { h.after(); }
  }
  assert.deepEqual(slotCounts, Array(slotCounts.length).fill(hallLights.length + 1), 'hall lights and the objective marker must keep one shader variant');
});

for (const id of ['m1_sentinels', 'm1_steak'] as const) test(`${id} turns off the goal light without dropping its shader slot`, t => {
  const h = view(), renderer = new FilmSetRenderer(h.scene);
  t.after(() => { h.culling.dispose(); renderer.dispose(); });
  const scene = FILM_SCENE_BY_ID[id], step = id === 'm1_sentinels' ? 0 : 1;
  const world = new WorldState(); new AgentManager(world).initializeAllAgents();
  const actor = world.agents.get(scene.actor)!;
  actor.position = filmStepPosition(scene, scene.steps[step]);
  actor.isInMatrix = FILM_SETS[scene.set].world === 'matrix';
  const journey: FilmJourney = { version: 1, scene: id, actor: actor.id, step, completed: [], enteredAt: 0,
    checkpoint: actor.position, reflections: {}, lastText: '' };
  if (id === 'm1_sentinels') journey.sentinel = { phase: 'ready', elapsed: 0, noise: 0, attempt: 0 };
  else journey.interlude = { kind: 'steak', phase: 'ready', elapsed: 0 };
  const sandbox = { neoLife: { journey } } as SandboxState;
  const markerLight = h.scene.children.find(object => object instanceof THREE.PointLight) as THREE.PointLight;
  h.camera.position.set(actor.position.x, actor.position.y + 3, actor.position.z + 3);
  const renderedLights = () => {
    assert.equal(renderer.update(actor, sandbox, 0, actor.position)?.id, scene.set);
    h.culling.stablePointSlots = renderer.stablePointSlots;
    h.before();
    const lights: THREE.PointLight[] = [];
    h.scene.traverseVisible(object => { if (object instanceof THREE.PointLight) lights.push(object); });
    h.after();
    return lights;
  };
  const ready = renderedLights();
  assert.ok(ready.includes(markerLight));
  assert.equal(markerLight.intensity, 5);
  if (journey.sentinel) journey.sentinel.phase = 'shutdown';
  if (journey.interlude) journey.interlude.phase = 'performing';
  const active = renderedLights();
  assert.equal(markerLight.intensity, 0);
  assert.ok(active.includes(markerLight), 'the unlit marker still occupies its existing shader slot');
  assert.deepEqual(active.map(light => light.id), ready.map(light => light.id));
  if (journey.sentinel) {
    const scanLight = h.scene.getObjectByName('sentinel-scan-light') as THREE.PointLight;
    assert.ok(!ready.includes(scanLight), 'the dormant scanner shares the existing marker slot');
    journey.sentinel.phase = 'sweep'; journey.sentinel.elapsed = 4;
    const sweep = renderedLights();
    assert.ok(sweep.includes(scanLight)); assert.ok(scanLight.intensity > 0);
    assert.ok(!sweep.includes(markerLight));
    assert.equal(sweep.length, ready.length);
    journey.sentinel.phase = 'done'; journey.step = scene.steps.length;
    const done = renderedLights();
    assert.deepEqual(done.map(light => light.id), ready.map(light => light.id));
    assert.equal(markerLight.intensity, 0);
  }
});

test('the minigun changes illumination without dropping a light slot during the air rescue', t => {
  const h = view(), renderer = new FilmSetRenderer(h.scene);
  t.after(() => { h.culling.dispose(); renderer.dispose(); });
  const scene = FILM_SCENE_BY_ID.m1_helicopter;
  const world = new WorldState(); new AgentManager(world).initializeAllAgents();
  const actor = world.agents.get(scene.actor)!;
  actor.isInMatrix = true;
  const rescue: AirRescueEncounter = { kind: 'office', phase: 'ready', elapsed: 0, attempt: 0 };
  const journey: FilmJourney = { version: 1, scene: scene.id, actor: actor.id, step: 0, completed: [], enteredAt: 0,
    checkpoint: actor.position, reflections: {}, lastText: '', airRescue: rescue };
  const sandbox = { neoLife: { journey } } as SandboxState;
  const slots = () => {
    const root = airRescueRoot(rescue, 'neo');
    actor.position = filmPosition(scene.set, root.x, root.z);
    actor.position.y += root.y;
    h.camera.position.set(actor.position.x, actor.position.y + 3, actor.position.z - 6);
    h.camera.rotation.y = Math.PI;
    assert.equal(renderer.update(actor, sandbox, 0, actor.position)?.id, scene.set);
    h.culling.stablePointSlots = renderer.stablePointSlots;
    h.before();
    const lights: { id: number; name: string; intensity: number }[] = [];
    h.scene.traverseVisible(object => {
      if (object instanceof THREE.PointLight) lights.push({ id: object.id, name: object.name, intensity: object.intensity });
    });
    h.after();
    return lights;
  };
  const ready = slots();
  rescue.phase = 'firing'; rescue.suppression = .5;
  const firing = slots();
  rescue.phase = 'catching'; rescue.elapsed = 1.4;
  const catching = slots();
  assert.equal(ready.find(light => light.name === 'air-rescue-minigun-flash')?.intensity, 0);
  assert.ok(firing.some(light => light.name === 'air-rescue-minigun-flash' && light.intensity > 20));
  assert.deepEqual(firing.map(light => light.id), ready.map(light => light.id));
  assert.deepEqual(catching.map(light => light.id), ready.map(light => light.id));
});

test('the subway keeps one point-light layout on the platform and tracks', t => {
  const h = view(), renderer = new FilmSetRenderer(h.scene);
  t.after(() => { h.culling.dispose(); renderer.dispose(); });
  const scene = FILM_SCENE_BY_ID.m1_subway;
  const world = new WorldState(); new AgentManager(world).initializeAllAgents();
  const actor = world.agents.get(scene.actor)!;
  actor.isInMatrix = true; actor.position = filmEntry(scene);
  const journey: FilmJourney = { version: 1, scene: scene.id, actor: actor.id, step: 0, completed: [], enteredAt: 0,
    checkpoint: actor.position, reflections: {}, lastText: '', matrixEscape: { kind: 'subway', phase: 'ready', elapsed: 0,
      attempt: 0, checkpoint: 'duel', hits: 0, dodges: 0, pursuit: 0, segment: 0, possessions: 0, resolved: [] } };
  const sandbox = { neoLife: { journey } } as SandboxState;
  const sample = (x: number, z: number, yaw: number) => {
    const camera = filmPosition(scene.set, x, z);
    h.camera.position.set(camera.x, camera.y + 3, camera.z); h.camera.rotation.y = yaw;
    assert.equal(renderer.update(actor, sandbox, 0, actor.position)?.id, scene.set);
    h.culling.stablePointSlots = renderer.stablePointSlots;
    h.before();
    const lights: number[] = [];
    h.scene.traverseVisible(light => { if (light instanceof THREE.PointLight) lights.push(light.id); });
    h.after();
    return lights;
  };
  const platform = sample(-3, 24, 0);
  journey.matrixEscape!.phase = 'train_window'; journey.matrixEscape!.elapsed = 2.4;
  assert.deepEqual(sample(16, -7, Math.PI), platform);
  assert.deepEqual(sample(16, -7, Math.PI / 2), platform);
});

test('the old building stair pursuit keeps one point-light layout until the pipe wall scene', t => {
  t.mock.method(THREE.TextureLoader.prototype, 'load', () => new THREE.Texture());
  const h = view(), renderer = new FilmSetRenderer(h.scene);
  t.after(() => { h.culling.dispose(); renderer.dispose(); });
  const scene = FILM_SCENE_BY_ID.m1_dejavu, center = FILM_SETS[scene.set].center;
  const world = new WorldState(); new AgentManager(world).initializeAllAgents();
  const actor = world.agents.get('neo')!;
  actor.position = filmStepPosition(scene, scene.steps[0]);
  actor.isInMatrix = true;
  const journey: FilmJourney = { version: 1, scene: scene.id, actor: actor.id, step: 0, completed: [],
    enteredAt: 0, checkpoint: actor.position, reflections: {}, lastText: '' };
  const sandbox = { neoLife: { journey } } as SandboxState;
  const renderedLights = () => {
    assert.equal(renderer.update(actor, sandbox, 0, actor.position)?.id, scene.set);
    h.culling.stablePointSlots = renderer.stablePointSlots;
    const points: THREE.PointLight[] = [];
    h.before();
    h.scene.traverseVisible(object => { if (object instanceof THREE.PointLight) points.push(object); });
    h.after();
    return points;
  };
  h.camera.position.set(center.x + 11, center.y + 3, center.z + 31.8);
  const arrival = renderedLights();
  assert.equal(arrival.length, 11, 'lights inside the closed pipe shaft and room 608 are outside the chase rig');
  journey.step = 1; journey.ambushEscape = newAmbushEscape(); journey.ambushEscape.elapsed = 2.8;
  const firing = renderedLights();
  assert.deepEqual(firing, arrival);
  assert.ok(firing.some(light => light.intensity === 900), 'the Mouse room flash retains its light');
  journey.ambushEscape.phase = 'descending';
  h.camera.position.y = center.y - 15; h.camera.rotation.y = Math.PI;
  assert.deepEqual(renderedLights(), arrival);

  journey.scene = 'm1_wetwall'; journey.step = 0;
  renderedLights();
  const shaft = h.scene.getObjectByName('ambush-wetwall-shaft')!;
  const points: THREE.PointLight[] = [];
  shaft.traverseVisible(object => { if (object instanceof THREE.PointLight) points.push(object); });
  assert.equal(points.length, 6, 'the shaft and room lights return when their scene loads');
});
