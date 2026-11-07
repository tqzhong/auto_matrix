import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from 'three';
import lightFragmentSource from 'three/src/renderers/shaders/ShaderChunk/lights_fragment_begin.glsl.js';
import { APU_RIG, APU_ROUTE, BANE_INQUIRY, BASEMENT, DIGGERS, DOCK_GUNNERY, FILM_SCENE_BY_ID, FILM_SETS, TRAINMAN_CHASE, UPPER_DIGGER, airRescueRoot, filmEntry, filmPosition, filmStepPosition, hammerCrewRoot, newAmbushEscape, newApuRun, newBaneInquiry, newDiggers, newDockGunnery, newGarageEscape, newHammerFlight, newHammerGunnery, newSmithFinale, newTrainmanChase, newUpperDigger, trainmanPassingTrain, type AirRescueEncounter, type BasementEncounter, type FilmJourney, type SandboxState, type SmithFinaleEncounter } from '@auto_matrix/shared';
import { FilmSetRenderer } from '../packages/client/src/engine/FilmSetRenderer.js';
import { LightCulling } from '../packages/client/src/engine/LightCulling.js';
import { AgentManager } from '../packages/server/src/agents/AgentManager.js';
import { WorldState } from '../packages/server/src/world/WorldState.js';

test('zero-energy point slots skip the light body without changing the compiled layout', () => {
  const assignment = 'pointLight = pointLights[ i ];';
  const start = lightFragmentSource.indexOf(assignment) + assignment.length;
  const end = lightFragmentSource.indexOf('\n\t}\n\t#pragma unroll_loop_end', start);
  assert.ok(start >= assignment.length && end > start);
  const before = lightFragmentSource.slice(0, start);
  const body = lightFragmentSource.slice(start, end);
  const after = lightFragmentSource.slice(end);
  const expected = before + '\n\t\tif ( pointLight.color != vec3( 0.0 ) ) {' + body + '\n\t\t}' + after;
  const normalize = (source: string) => source.replace(/\/\*[\s\S]*?\*\/|\/\/[^\n]*/g, '').replace(/\s+/g, '');
  assert.ok(normalize(THREE.ShaderChunk.lights_fragment_begin) === normalize(expected),
    'guard the point-light attenuation, shadow and shading while preserving every light slot and the active formulas');
});

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

test('the desert lightning keeps the same point-light slots between pulses', t => {
  const h = view(), renderer = new FilmSetRenderer(h.scene);
  t.after(() => { h.culling.dispose(); renderer.dispose(); });
  const world = new WorldState(); new AgentManager(world).initializeAllAgents();
  const neo = world.agents.get('neo')!;
  neo.position = filmPosition('film_real_desert', 1.8, -28); neo.isInMatrix = false;
  h.camera.position.set(neo.position.x, neo.position.y + 4, neo.position.z + 4);
  const journey: FilmJourney = { version: 1, scene: 'm1_desert', actor: neo.id, step: 1, completed: [], enteredAt: 0,
    checkpoint: neo.position, reflections: {}, lastText: '', awakening: { kind: 'desert', elapsed: 2, started: true } };
  const sandbox = { neoLife: { journey } } as SandboxState;
  const renderedLights = () => {
    assert.equal(renderer.update(neo, sandbox, 0, neo.position)?.id, 'film_real_desert');
    h.culling.stablePointSlots = renderer.stablePointSlots;
    h.before();
    const lights: { id: number; energy: number }[] = [];
    h.scene.traverseVisible(object => { if (object instanceof THREE.PointLight) lights.push({ id: object.id, energy: object.intensity }); });
    h.after();
    return lights;
  };
  const dark = renderedLights();
  journey.awakening!.elapsed = 2 + Math.PI / (2 * 2.7);
  const bright = renderedLights();
  assert.deepEqual(dark.map(light => light.id), bright.map(light => light.id), 'a pulse must reuse the existing programs');
  const flash = h.scene.getObjectByName('desert-cloud-flash')!;
  assert.equal(dark.find(light => light.id === flash.id)?.energy, 0);
  assert.ok((bright.find(light => light.id === flash.id)?.energy ?? 0) > 500);
});

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

test('the commute keeps four point-light slots as nearby interiors appear and disappear', () => {
  const h = view();
  const street = [h.light(0, -10, 4), h.light(0, 10, 4)];
  const lobby = new THREE.Group(); h.scene.add(lobby);
  for (const x of [-1, 0, 1]) lobby.add(h.light(x, -10, 4));
  const actual = [...street, ...(lobby.children as THREE.PointLight[])];
  const normal = new THREE.MeshNormalMaterial();
  const visibleLights = () => {
    const lights: THREE.PointLight[] = [];
    h.scene.traverseVisible(object => { if (object instanceof THREE.PointLight) lights.push(object); });
    return lights;
  };
  const children = h.scene.children.length;
  h.culling.minimumPointSlots = 4;
  try {
    lobby.visible = false;
    h.before();
    const filled = visibleLights();
    assert.equal(filled.length, 4);
    assert.equal(filled.filter(light => light.intensity > 0).length, 1);
    assert.ok(filled.filter(light => !actual.includes(light)).every(light => !light.castShadow));
    h.scene.overrideMaterial = normal;
    h.before();
    assert.deepEqual(visibleLights(), street);
    h.after(); h.scene.overrideMaterial = null;
    assert.deepEqual(visibleLights(), filled);
    h.after();
    assert.deepEqual(visibleLights(), street);
    assert.equal(street[1].intensity, 10);
    lobby.visible = true;
    h.before();
    assert.deepEqual(visibleLights().filter(light => light.intensity > 0), [street[0], ...lobby.children]);
    assert.equal(visibleLights().length, 4);
    h.after();
    lobby.visible = false;
    h.before(); h.culling.restore();
    assert.deepEqual(visibleLights(), street);
    h.culling.minimumPointSlots = 0;
    h.before(); assert.deepEqual(visibleLights(), street); h.after();
  } finally { normal.dispose(); h.culling.dispose(); }
  assert.equal(h.scene.children.length, children);
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

test('the lobby reserve absorbs two overlapping muzzle flashes without changing the light count or brightness', () => {
  const h = view(); h.culling.stablePointSlots = true; h.culling.minimumPointSlots = 9;
  for (let i = 0; i < 7; i++) h.light(i * .1, -10, 4);
  const sample = () => {
    h.before();
    let count = 0, energy = 0;
    h.scene.traverseVisible(object => {
      if (object instanceof THREE.PointLight) { count++; energy += object.intensity; }
    });
    h.after();
    return [count, energy];
  };
  try {
    assert.deepEqual(sample(), [9, 70]);
    const first = h.light(0, -9, 4, 85);
    assert.deepEqual(sample(), [9, 155]);
    const second = h.light(1, -9, 4, 85);
    assert.deepEqual(sample(), [9, 240]);
    const third = h.light(-1, -9, 4, 85);
    assert.deepEqual(sample(), [10, 325], 'an extra shot still contributes its actual light');
    for (const light of [first, second, third]) light.removeFromParent();
    assert.deepEqual(sample(), [9, 70]);
    h.culling.minimumPointSlots = 0;
    assert.deepEqual(sample(), [7, 70]);
  } finally { h.culling.dispose(); }
});

for (const sceneId of ['m2_temple', 'm3_temple_defense', 'm3_temple_breach', 'm3_ceasefire']) test(`${sceneId} keeps its point-light slots while walking and turning in the temple`, t => {
  const h = view(), renderer = new FilmSetRenderer(h.scene);
  t.after(() => { h.culling.dispose(); renderer.dispose(); });
  const scene = FILM_SCENE_BY_ID[sceneId];
  const world = new WorldState(); new AgentManager(world).initializeAllAgents();
  const actor = world.agents.get(scene.actor)!;
  actor.isInMatrix = false;
  const journey: FilmJourney = { version: 1, scene: scene.id, actor: actor.id, step: 0, completed: [], enteredAt: 0,
    checkpoint: filmEntry(scene), reflections: {}, lastText: '' };
  if (sceneId === 'm3_ceasefire') {
    journey.completed.push('m3_temple_breach');
    journey.epilogue = { kind: 'ceasefire', phase: 'ready', elapsed: 0, total: 0 };
  }
  const sandbox = { neoLife: { journey } } as SandboxState;
  h.camera.aspect = 16 / 9; h.camera.far = 300; h.camera.updateProjectionMatrix();
  actor.position = journey.checkpoint;
  renderer.update(actor, sandbox, 0, actor.position);
  const hallLights: THREE.PointLight[] = [];
  renderer.root.traverseVisible(object => { if (object instanceof THREE.PointLight) hallLights.push(object); });
  const intensities = hallLights.map(light => light.intensity);
  const beacon = renderer.root.getObjectByName('trilogy-epilogue-ceasefire')?.children.find(light => light instanceof THREE.PointLight);
  if (journey.epilogue) assert.ok(beacon instanceof THREE.PointLight && beacon.intensity > 0);
  const slotCounts: number[] = [];
  const views = [[0, 37, -1, 0], [0, 10, -1, 0], [0, -15, -1, 0], [0, -35, 1, 1], [0, -26, -1, Math.min(3, scene.steps.length)],
    [-8, -45, 1, 1], [8, -45, -1, 1], [0, -18, 1, scene.steps.length]];
  for (const [x, z, direction, step] of views) {
    actor.position = filmPosition(scene.set, x, z);
    journey.step = step;
    if (journey.epilogue) {
      journey.epilogue.phase = step === 0 ? 'ready' : step === 1 ? 'retreat' : 'message_ready';
      journey.epilogue.elapsed = step === 1 ? 2 : 0;
    }
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
        const power = light === beacon && step >= 2 ? 0 : intensities[index];
        if (power > 0 && frustum.intersectsSphere(new THREE.Sphere(light.getWorldPosition(new THREE.Vector3()), light.distance))) {
          assert.equal(light.visible, true);
          assert.equal(light.intensity, power, 'a light reaching the visible hall keeps its authored energy');
        }
      });
    } finally { h.after(); }
  }
  if (beacon instanceof THREE.PointLight) assert.equal(beacon.intensity, 0, 'the beacon goes dark after the withdrawal');
  assert.deepEqual(slotCounts, Array(slotCounts.length).fill(hallLights.length + 1), 'hall lights and the objective marker must keep one shader variant');
});

test('the interrogation keeps the objective light slot when Neo sits down', t => {
  const document = globalThis.document;
  globalThis.document = { createElement: () => ({ getContext: () => ({ fillRect() {}, fillText() {} }) }) } as unknown as Document;
  const h = view(), renderer = new FilmSetRenderer(h.scene);
  t.after(() => { h.culling.dispose(); renderer.dispose(); globalThis.document = document; });
  const scene = FILM_SCENE_BY_ID.m1_interrogation;
  const world = new WorldState(); new AgentManager(world).initializeAllAgents();
  const neo = world.agents.get(scene.actor)!; neo.currentLocation = scene.set; neo.isInMatrix = true;
  neo.position = filmStepPosition(scene, scene.steps[0]);
  const journey: FilmJourney = { version: 1, scene: scene.id, actor: neo.id, step: 0, completed: [], enteredAt: 0,
    checkpoint: filmEntry(scene), reflections: {}, lastText: '' };
  const sandbox = { neoLife: { journey } } as SandboxState;
  h.camera.position.set(neo.position.x, neo.position.y + 2, neo.position.z + 2);
  h.camera.lookAt(neo.position.x - 5, neo.position.y, neo.position.z);
  const sample = () => {
    renderer.update(neo, sandbox, 0, neo.position, h.camera.position, undefined, false, 12000, h.camera);
    h.culling.stablePointSlots = renderer.stablePointSlots;
    h.before();
    try {
      const lights: THREE.PointLight[] = [];
      h.scene.traverseVisible(light => { if (light instanceof THREE.PointLight) lights.push(light); });
      return lights.map(light => ({ id: light.id, energy: light.intensity }));
    } finally { h.after(); }
  };
  const standing = sample();
  assert.equal(standing.length, 2);
  assert.ok(standing.some(light => light.energy === 5), 'the visible marker still lights the floor');
  journey.interrogation = { phase: 'file', elapsed: .5, approach: { x: 5.9, z: 0, yaw: -Math.PI / 2 } };
  const sitting = sample();
  assert.deepEqual(sitting.map(light => light.id), standing.map(light => light.id));
  assert.deepEqual(sitting.map(light => light.energy), standing.map(light => light.energy === 5 ? 0 : light.energy));
});

test('the Logos wreck keeps the fire and objective light slots as Neo reaches Trinity', t => {
  const h = view(), renderer = new FilmSetRenderer(h.scene);
  t.after(() => { h.culling.dispose(); renderer.dispose(); });
  const scene = FILM_SCENE_BY_ID.m3_farewell;
  const world = new WorldState(); new AgentManager(world).initializeAllAgents();
  const neo = world.agents.get(scene.actor)!; neo.isInMatrix = false; neo.position = filmEntry(scene);
  const journey: FilmJourney = { version: 1, scene: scene.id, actor: neo.id, step: 0, completed: [], enteredAt: 0,
    checkpoint: filmEntry(scene), reflections: {}, lastText: '', farewell: { phase: 'ready', elapsed: 0, total: 0 } };
  const sandbox = { neoLife: { journey } } as SandboxState;
  const slots = (direction: number, firstPerson = false) => {
    h.camera.position.set(neo.position.x, neo.position.y + 3, neo.position.z - direction * (firstPerson ? 0 : 5));
    h.camera.lookAt(neo.position.x, neo.position.y + 2, neo.position.z + direction * 10);
    renderer.update(neo, sandbox, 0, neo.position, h.camera.position, undefined, firstPerson, 12000, h.camera);
    h.culling.stablePointSlots = renderer.stablePointSlots;
    h.before();
    try {
      const ids: number[] = [];
      h.scene.traverseVisible(light => { if (light instanceof THREE.PointLight) ids.push(light.id); });
      return ids;
    } finally { h.after(); }
  };
  const entry = slots(-1);
  assert.ok(entry.length > 1);
  neo.position = filmStepPosition(scene, scene.steps[1], journey);
  journey.step = 1;
  assert.deepEqual(slots(1), entry);
  journey.farewell = { phase: 'reaching', elapsed: 1.2, total: 1.2 };
  assert.deepEqual(slots(-1, true), entry, 'hiding the objective must keep its dark shader slot');
});

test('the Smith avenue keeps its light slots through lightning, the purge and the end of the rain', t => {
  const h = view(), renderer = new FilmSetRenderer(h.scene);
  t.after(() => { h.culling.dispose(); renderer.dispose(); });
  const scene = FILM_SCENE_BY_ID.m3_rain;
  const world = new WorldState(); new AgentManager(world).initializeAllAgents();
  const neo = world.agents.get(scene.actor)!; neo.isInMatrix = true; neo.position = filmEntry(scene);
  const journey: FilmJourney = { version: 1, scene: scene.id, actor: neo.id, step: 0, completed: [], enteredAt: 0,
    checkpoint: filmEntry(scene), reflections: {}, lastText: '' };
  const sandbox = { neoLife: { journey } } as SandboxState;
  const sample = (phase: SmithFinaleEncounter['phase'], total: number, elapsed = 0, direction = -1) => {
    journey.smithFinale = { ...newSmithFinale(), phase, total, elapsed };
    h.camera.position.set(neo.position.x, neo.position.y + 3, neo.position.z);
    h.camera.lookAt(neo.position.x, neo.position.y + 2, neo.position.z + direction * 10);
    renderer.update(neo, sandbox, total, neo.position, h.camera.position, undefined, false, 12000, h.camera);
    h.culling.stablePointSlots = renderer.stablePointSlots;
    h.before();
    try {
      const ids: number[] = [];
      h.scene.traverseVisible(light => { if (light instanceof THREE.PointLight) ids.push(light.id); });
      return ids;
    } finally { h.after(); }
  };
  const dark = sample('approach', 0);
  assert.ok(dark.length > 1);
  assert.deepEqual(sample('approach', .2), dark, 'a lightning flash must reuse the same shader slots');
  const lightning = h.scene.getObjectByName('smith-finale-lightning-light') as THREE.PointLight;
  const purge = h.scene.getObjectByName('smith-finale-purge-light') as THREE.PointLight;
  assert.ok(lightning.intensity > 0);
  assert.equal(purge.intensity, 0);
  assert.deepEqual(sample('purging', 50, 1, 1), dark, 'the purge and a camera turn must keep the same shader slots');
  assert.ok(purge.intensity > 0);
  assert.deepEqual(sample('done', 60), dark, 'ending the rain must leave the slots in place');
  assert.equal(lightning.intensity, 0);
  assert.equal(purge.intensity, 0);
});

test('the château keeps the hall and objective light slots when guards start the duel', t => {
  t.mock.method(THREE.TextureLoader.prototype, 'load', () => new THREE.Texture());
  const document = globalThis.document;
  globalThis.document = { createElement: () => ({ getContext: () => ({ fillRect() {}, strokeRect() {}, fillText() {} }) }) } as unknown as Document;
  const h = view(), renderer = new FilmSetRenderer(h.scene);
  t.after(() => { h.culling.dispose(); renderer.dispose(); globalThis.document = document; });
  const scene = FILM_SCENE_BY_ID.m2_chateau;
  const world = new WorldState(); new AgentManager(world).initializeAllAgents();
  const actor = world.agents.get(scene.actor)!;
  actor.position = filmStepPosition(scene, scene.steps[0]);
  const journey: FilmJourney = { version: 1, scene: scene.id, actor: actor.id, step: 0, completed: [], enteredAt: 0,
    checkpoint: actor.position, reflections: {}, lastText: '',
    chateau: { phase: 'ready', wave: 1, parries: 0, disarms: 0, attempts: 0, wounded: false } };
  const sandbox = { neoLife: { journey } } as SandboxState;
  const marker = h.scene.children.find(object => object instanceof THREE.PointLight) as THREE.PointLight;
  const renderLights = (yaw: number, tick = 12) => {
    h.camera.position.set(actor.position.x, actor.position.y + 4, actor.position.z + 6);
    h.camera.rotation.y = yaw;
    assert.equal(renderer.update(actor, sandbox, 0, actor.position, undefined, undefined, false, 12000, undefined, tick)?.id, scene.set);
    h.culling.stablePointSlots = renderer.stablePointSlots;
    h.before();
    const lights: number[] = [];
    h.scene.traverseVisible(object => { if (object instanceof THREE.PointLight) lights.push(object.id); });
    h.after();
    return lights;
  };
  const approach = renderLights(0);
  assert.ok(approach.includes(marker.id));
  assert.ok(marker.intensity > 0);
  journey.chateau!.phase = 'duel';
  journey.chateau!.volleyAt = 12;
  assert.deepEqual(renderLights(0), approach);
  assert.deepEqual(renderLights(Math.PI), approach);
  assert.equal(marker.intensity, 0, 'the duel keeps the marker slot dark');
  const volley = (renderer as unknown as { chateauVolley: THREE.Group }).chateauVolley;
  assert.equal(volley.visible, true, 'stopped rounds are visible during the volley');
  renderLights(0, 16);
  assert.equal(volley.visible, false, 'saved volley age does not depend on time since opening the client');
});

for (const id of ['m1_sentinels', 'm1_steak', 'm2_garage'] as const) test(`${id} turns off the goal light without dropping its shader slot`, t => {
  if (id === 'm2_garage') {
    t.mock.method(THREE.TextureLoader.prototype, 'load', () => new THREE.Texture());
    const document = globalThis.document;
    globalThis.document = { createElement: () => ({ getContext: () => ({ fillRect() {}, strokeRect() {}, fillText() {} }) }) } as unknown as Document;
    t.after(() => { globalThis.document = document; });
  }
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
  if (id === 'm1_steak') journey.interlude = { kind: 'steak', phase: 'ready', elapsed: 0 };
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
  if (id === 'm2_garage') journey.garage = newGarageEscape();
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

test('the crew meal retains its light slots through seating, camera turns and return to the core', t => {
  const h = view(), renderer = new FilmSetRenderer(h.scene);
  t.after(() => { h.culling.dispose(); renderer.dispose(); });
  const scene = FILM_SCENE_BY_ID.m1_meal;
  const world = new WorldState(); new AgentManager(world).initializeAllAgents();
  const neo = world.agents.get('neo')!;
  neo.position = filmStepPosition(scene, scene.steps[0]); neo.isInMatrix = false;
  const journey: FilmJourney = { version: 1, scene: scene.id, actor: neo.id, step: 0, completed: [], enteredAt: 0,
    checkpoint: neo.position, reflections: {}, lastText: '', interlude: { kind: 'meal', phase: 'ready', elapsed: 0 } };
  const sandbox = { neoLife: { journey } } as SandboxState;
  const marker = h.scene.children.find(object => object instanceof THREE.PointLight) as THREE.PointLight;
  const visibleLights = (yaw: number) => {
    h.camera.position.set(neo.position.x, neo.position.y + 3, neo.position.z);
    h.camera.rotation.y = yaw;
    assert.equal(renderer.update(neo, sandbox, 0, neo.position)?.id, scene.set);
    h.culling.stablePointSlots = renderer.stablePointSlots;
    h.before();
    const lights: number[] = [];
    h.scene.traverseVisible(object => { if (object instanceof THREE.PointLight) lights.push(object.id); });
    h.after();
    return lights;
  };
  const ready = visibleLights(0);
  assert.ok(ready.includes(marker.id));
  assert.equal(marker.intensity, 5);
  journey.interlude!.phase = 'performing';
  assert.deepEqual(visibleLights(0), ready, 'seating keeps the dark marker in the same program');
  assert.equal(marker.intensity, 0);
  assert.deepEqual(visibleLights(Math.PI), ready, 'a turn at the table only mutes offscreen lights');
  journey.interlude!.phase = 'done'; journey.step = 1;
  neo.position = filmStepPosition(scene, scene.steps[1]);
  assert.deepEqual(visibleLights(0), ready, 'walking back to the core keeps the same program');
});

test('the basement keeps the same light slots from the grate through the drain turns', t => {
  t.mock.method(THREE.TextureLoader.prototype, 'load', () => new THREE.Texture());
  const h = view(), renderer = new FilmSetRenderer(h.scene);
  t.after(() => { h.culling.dispose(); renderer.dispose(); });
  const scene = FILM_SCENE_BY_ID.m1_basement, center = FILM_SETS[scene.set].center;
  const world = new WorldState(); new AgentManager(world).initializeAllAgents();
  const neo = world.agents.get('neo')!;
  neo.isInMatrix = true;
  const basement = { phase: 'hatch_ready', hatch: 1, gas: 0 } as BasementEncounter;
  const journey: FilmJourney = { version: 1, scene: scene.id, actor: neo.id, step: 3, completed: [], enteredAt: 0,
    checkpoint: neo.position, reflections: {}, lastText: '', basement };
  const sandbox = { neoLife: { journey } } as SandboxState;
  const marker = h.scene.children.find(object => object instanceof THREE.PointLight) as THREE.PointLight;
  const visibleLights = (x: number, y: number, z: number, yaw: number) => {
    neo.position = { x: center.x + x, y: center.y + y, z: center.z + z };
    h.camera.position.set(neo.position.x, neo.position.y + 1.5, neo.position.z);
    h.camera.rotation.y = yaw;
    assert.equal(renderer.update(neo, sandbox, 0, neo.position)?.id, scene.set);
    h.culling.stablePointSlots = renderer.stablePointSlots;
    const lights: { id: number; intensity: number }[] = [];
    h.before();
    h.scene.traverseVisible(object => { if (object instanceof THREE.PointLight) lights.push({ id: object.id, intensity: object.intensity }); });
    h.after();
    return lights;
  };
  const grate = visibleLights(BASEMENT.approach.x, BASEMENT.floor, BASEMENT.approach.z, Math.PI);
  assert.equal(marker.intensity, 5);
  basement.phase = 'tunnel'; journey.step = 4;
  const tunnel = visibleLights(9, BASEMENT.tunnelFloor, 30, Math.PI / 2);
  assert.deepEqual(tunnel.map(light => light.id), grate.map(light => light.id));
  assert.equal(tunnel.find(light => light.id === marker.id)?.intensity, 0);
  const turn = visibleLights(0, BASEMENT.tunnelFloor, 30, Math.PI);
  assert.deepEqual(turn.map(light => light.id), tunnel.map(light => light.id));
  assert.ok(turn.some(light => light.id !== marker.id && light.intensity === 0));
  assert.ok(turn.some(light => light.intensity > 0));
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

test('the Trainman chase keeps its light slots as the passing train appears and leaves', t => {
  const previous = globalThis.document;
  globalThis.document = { createElement: () => ({ getContext: () => ({ fillRect() {}, strokeRect() {}, fillText() {} }) }) } as unknown as Document;
  const h = view(), renderer = new FilmSetRenderer(h.scene);
  t.after(() => { h.culling.dispose(); renderer.dispose(); globalThis.document = previous; });
  const scene = FILM_SCENE_BY_ID.m3_trainman_chase;
  const world = new WorldState(); new AgentManager(world).initializeAllAgents();
  const actor = world.agents.get(scene.actor)!;
  Object.assign(actor, { isInMatrix: true, currentLocation: scene.set, position: filmEntry(scene) });
  const chase = newTrainmanChase();
  const journey: FilmJourney = { version: 1, scene: scene.id, actor: actor.id, step: 0, completed: [], enteredAt: 0,
    checkpoint: actor.position, reflections: {}, lastText: '', helChase: { phase: 'sighting', elapsed: 0, lastTick: 0, performance: chase } };
  const sandbox = { neoLife: { journey } } as SandboxState;
  const sample = (x: number, z: number, targetX: number, targetZ: number, height = 0) => {
    actor.position = filmPosition(scene.set, x, z);
    actor.position.y += height;
    const target = filmPosition(scene.set, targetX, targetZ);
    h.camera.position.set(actor.position.x, actor.position.y + 3, actor.position.z);
    h.camera.lookAt(target.x, actor.position.y + 2, target.z);
    assert.equal(renderer.update(actor, sandbox, 0, actor.position)?.id, scene.set);
    h.culling.stablePointSlots = renderer.stablePointSlots;
    h.before();
    try {
      const lights: THREE.PointLight[] = [];
      h.scene.traverseVisible(object => { if (object instanceof THREE.PointLight) lights.push(object); });
      return lights.map(light => ({ id: light.id, intensity: light.intensity }));
    } finally { h.after(); }
  };

  const car = sample(-30, 36, -30, 18);
  assert.equal(car.length, 8, 'five station lights, the carriage, the objective and the passing headlamp');
  const ids = car.map(light => light.id);
  const headlamp = h.scene.getObjectByName('trainman-passing-headlight') as THREE.PointLight;
  assert.equal(headlamp.intensity, 0);
  assert.equal(h.scene.getObjectByName('trainman-passing-train')!.visible, false);
  journey.step = 1;
  chase.phase = 'vaulting';
  assert.deepEqual(sample(-3.2, -21.5, 15, -21.5, TRAINMAN_CHASE.upper).map(light => light.id), ids);
  Object.assign(chase, { phase: 'crossing', elapsed: 1 });
  const crossing = sample(21.1, -35.5, 28, -50);
  assert.deepEqual(crossing.map(light => light.id), ids);
  assert.equal(crossing.find(light => light.id === headlamp.id)?.intensity, 230);
  assert.deepEqual(headlamp.position.toArray(), [28, 2.3, trainmanPassingTrain(chase).z + 32]);
  Object.assign(chase, { phase: 'escaped', elapsed: 8 });
  journey.step = 2;
  assert.deepEqual(sample(17, -31, 17, -20).map(light => light.id), ids);
  assert.equal(headlamp.intensity, 0);
  assert.equal(h.scene.getObjectByName('trainman-passing-train')!.visible, false);
});

test('the Sentinel pursuit keeps its light slots while Neo runs, turns and shuts down the machines', t => {
  const h = view(), renderer = new FilmSetRenderer(h.scene);
  t.after(() => { h.culling.dispose(); renderer.dispose(); });
  const scene = FILM_SCENE_BY_ID.m2_stop_sentinels;
  const world = new WorldState(); new AgentManager(world).initializeAllAgents();
  const actor = world.agents.get(scene.actor)!; actor.isInMatrix = false;
  const tunnel: NonNullable<FilmJourney['tunnel']> = { phase: 'running', remaining: 14, focus: 0, lastTick: 0, attempts: 0 };
  const journey: FilmJourney = { version: 1, scene: scene.id, actor: actor.id, step: 0, completed: [], enteredAt: 0,
    checkpoint: filmEntry(scene), reflections: {}, lastText: '', tunnel };
  const sandbox = { neoLife: { journey } } as SandboxState;
  const sample = (z: number, yaw: number) => {
    actor.position = filmPosition(scene.set, 0, z);
    h.camera.position.set(actor.position.x, actor.position.y + 3, actor.position.z + 6 * Math.cos(yaw));
    h.camera.rotation.y = yaw;
    assert.equal(renderer.update(actor, sandbox, 0, actor.position)?.id, scene.set);
    h.culling.stablePointSlots = renderer.stablePointSlots;
    h.before();
    try {
      const lights: { id: number; name: string; intensity: number }[] = [];
      h.scene.traverseVisible(light => { if (light instanceof THREE.PointLight) lights.push({ id: light.id, name: light.name, intensity: light.intensity }); });
      return lights;
    } finally { h.after(); }
  };
  const entrance = sample(46, 0);
  tunnel.pursuit = 12;
  assert.deepEqual(sample(34, 0).map(light => light.id), entrance.map(light => light.id));
  journey.step = 1; tunnel.phase = 'sensing'; tunnel.pursuit = 71;
  const turn = sample(-25, Math.PI);
  assert.deepEqual(turn.map(light => light.id), entrance.map(light => light.id));
  assert.equal(turn.filter(light => light.name === 'sentinel-optical-light' && light.intensity > 0).length, 3);
  tunnel.phase = 'collapsing'; tunnel.elapsed = 1;
  const cut = sample(-25, Math.PI);
  assert.deepEqual(cut.map(light => light.id), entrance.map(light => light.id));
  assert.equal(cut.filter(light => light.name === 'sentinel-optical-light' && light.intensity === 0).length, 3);
});

test('Mobil keeps its point-light slots when turning from the platform to the station sign', t => {
  const document = globalThis.document;
  globalThis.document = { createElement: () => ({ getContext: () => ({ fillRect() {}, strokeRect() {}, fillText() {} }) }) } as unknown as Document;
  const h = view(), renderer = new FilmSetRenderer(h.scene);
  t.after(() => { h.culling.dispose(); renderer.dispose(); globalThis.document = document; });
  const scene = FILM_SCENE_BY_ID.m3_mobil;
  const world = new WorldState(); new AgentManager(world).initializeAllAgents();
  const actor = world.agents.get(scene.actor)!; actor.isInMatrix = true;
  const journey: FilmJourney = { version: 1, scene: scene.id, actor: actor.id, step: 0, completed: [], enteredAt: 0,
    checkpoint: filmEntry(scene), reflections: {}, lastText: '' };
  const sandbox = { neoLife: { journey } } as SandboxState;
  const renderLights = (x: number, z: number, dx: number, dz: number) => {
    actor.position = filmPosition(scene.set, x, z);
    h.camera.position.set(actor.position.x - dx * 4, actor.position.y + 3, actor.position.z - dz * 4);
    h.camera.lookAt(actor.position.x + dx * 8, actor.position.y + 2, actor.position.z + dz * 8);
    assert.equal(renderer.update(actor, sandbox, 0, actor.position)?.id, scene.set);
    h.culling.stablePointSlots = renderer.stablePointSlots;
    h.before();
    try {
      const lights: number[] = [];
      h.scene.traverseVisible(light => { if (light instanceof THREE.PointLight) lights.push(light.id); });
      return lights;
    } finally { h.after(); }
  };
  const platform = renderLights(0, 22, 0, -1);
  journey.step = 1;
  assert.deepEqual(renderLights(-10, 17, -1, 0), platform);
  assert.equal(platform.length, 6, 'all five station lamps and the objective light share one layout');
});

for (const [sceneId, x, z] of [['m3_oracle_request', -4.6, 12], ['m3_oracle_last', -6, -15.4]] as const) test(`${sceneId} keeps the light slots while approaching and turning to the Oracle`, t => {
  t.mock.method(THREE.TextureLoader.prototype, 'load', () => new THREE.Texture());
  const document = globalThis.document;
  const context = { fillRect() {}, strokeRect() {}, fillText() {}, beginPath() {}, moveTo() {}, lineTo() {}, closePath() {}, stroke() {}, fill() {}, ellipse() {} };
  globalThis.document = { createElement: () => ({ getContext: () => context }) } as unknown as Document;
  const h = view(), renderer = new FilmSetRenderer(h.scene);
  t.after(() => { h.culling.dispose(); renderer.dispose(); globalThis.document = document; });
  const scene = FILM_SCENE_BY_ID[sceneId];
  const world = new WorldState(); new AgentManager(world).initializeAllAgents();
  const actor = world.agents.get(scene.actor)!; actor.isInMatrix = true;
  const journey: FilmJourney = { version: 1, scene: scene.id, actor: actor.id, step: 0, completed: [], enteredAt: 0,
    checkpoint: filmEntry(scene), reflections: {}, lastText: '',
    ...(sceneId === 'm3_oracle_request' ? { oracleRequest: { phase: 'ready', elapsed: 0, guide: 0 } }
      : { oracleLast: { phase: 'waiting', arrival: 0, elapsed: 0, checkpointHealth: actor.health } }) };
  const sandbox = { neoLife: { journey } } as SandboxState;
  const sample = (x: number, z: number, dx: number, dz: number) => {
    actor.position = filmPosition(scene.set, x, z);
    h.camera.position.set(actor.position.x - dx * 5, actor.position.y + 3, actor.position.z - dz * 5);
    h.camera.lookAt(actor.position.x + dx * 8, actor.position.y + 2, actor.position.z + dz * 8);
    assert.equal(renderer.update(actor, sandbox, 0, actor.position)?.id, scene.set);
    h.culling.stablePointSlots = renderer.stablePointSlots;
    h.before();
    try {
      const slots: number[] = [];
      h.scene.traverseVisible(light => { if (light instanceof THREE.PointLight) slots.push(light.id); });
      return slots;
    } finally { h.after(); }
  };
  const entrance = sample(0, 19.2, 0, -1);
  assert.deepEqual(sample(x, z, -1, 0), entrance);
  if (journey.oracleRequest) journey.oracleRequest.phase = 'answering';
  if (journey.oracleLast) Object.assign(journey.oracleLast, { phase: 'answering', arrival: 28 });
  assert.deepEqual(sample(x, z, -1, 0), entrance);
});

test('the Bane interview keeps its light slots between the entrance and the mess table', t => {
  t.mock.method(THREE.TextureLoader.prototype, 'load', () => new THREE.Texture());
  const previous = globalThis.document;
  const context = { fillRect() {}, strokeRect() {}, fillText() {}, beginPath() {}, moveTo() {}, lineTo() {}, stroke() {} };
  globalThis.document = { createElement: () => ({ getContext: () => context }) } as unknown as Document;
  const h = view(), renderer = new FilmSetRenderer(h.scene);
  t.after(() => { h.culling.dispose(); renderer.dispose(); globalThis.document = previous; });
  const scene = FILM_SCENE_BY_ID.m3_bane_questions;
  const world = new WorldState(); new AgentManager(world).initializeAllAgents();
  const actor = world.agents.get(scene.actor)!; actor.isInMatrix = false;
  const journey: FilmJourney = { version: 1, scene: scene.id, actor: actor.id, step: 0, completed: [], enteredAt: 0,
    checkpoint: filmEntry(scene), reflections: {}, lastText: '', baneInquiry: newBaneInquiry(0, actor.health) };
  const sandbox = { neoLife: { journey } } as SandboxState;
  const sample = (point: { x: number; z: number }, dx: number, dz: number) => {
    actor.position = filmPosition(scene.set, point.x, point.z);
    h.camera.position.set(actor.position.x - dx * 5, actor.position.y + 3, actor.position.z - dz * 5);
    h.camera.lookAt(actor.position.x + dx * 8, actor.position.y + 2, actor.position.z + dz * 8);
    assert.equal(renderer.update(actor, sandbox, 0, actor.position)?.id, scene.set);
    h.culling.stablePointSlots = renderer.stablePointSlots;
    h.before();
    try {
      const lights: number[] = [];
      h.scene.traverseVisible(light => { if (light instanceof THREE.PointLight) lights.push(light.id); });
      return lights;
    } finally { h.after(); }
  };
  const entrance = sample(BANE_INQUIRY.entry, 0, -1);
  assert.deepEqual(sample(BANE_INQUIRY.approach, 0, -1), entrance);
  journey.step = 1;
  journey.baneInquiry = newBaneInquiry(1, actor.health);
  assert.deepEqual(sample(BANE_INQUIRY.roots.roland, -1, 0), entrance);
});

test('Hammer keeps point-light slots while the crew looks around and switches views in flight', t => {
  const h = view(), renderer = new FilmSetRenderer(h.scene);
  t.after(() => { h.culling.dispose(); renderer.dispose(); });
  const scene = FILM_SCENE_BY_ID.m3_hammer_tunnels, center = FILM_SETS[scene.set].center;
  const world = new WorldState(); new AgentManager(world).initializeAllAgents();
  const actor = world.agents.get(scene.actor)!; actor.isInMatrix = false;
  const journey: FilmJourney = { version: 1, scene: scene.id, actor: scene.actor, step: 0, completed: [], enteredAt: 0,
    checkpoint: filmEntry(scene), reflections: {}, lastText: '', hammerHandover: { phase: 'waiting', elapsed: 0 } };
  const sandbox = { neoLife: { journey } } as SandboxState;
  h.camera.aspect = 16 / 9; h.camera.far = 5000; h.camera.updateProjectionMatrix();
  const sample = (direction: number, firstPerson = false) => {
    h.camera.position.set(actor.position.x, actor.position.y + 2.2, actor.position.z - direction * 4);
    h.camera.lookAt(actor.position.x, actor.position.y + 2, actor.position.z + direction * 8);
    assert.equal(renderer.update(actor, sandbox, 0, actor.position, h.camera.position, undefined, firstPerson)?.id, scene.set);
    h.culling.stablePointSlots = renderer.stablePointSlots;
    h.before();
    const slots: number[] = [];
    try { h.scene.traverseVisible(light => { if (light instanceof THREE.PointLight) slots.push(light.id); }); }
    finally { h.after(); }
    return slots;
  };
  actor.position = filmEntry(scene);
  const entrance = sample(-1);
  assert.deepEqual(sample(1), entrance);
  actor.position = filmStepPosition(scene, scene.steps[0]);
  assert.deepEqual(sample(-1), entrance);
  journey.step = 1; journey.hammerHandover = { phase: 'moving', elapsed: 3 };
  assert.deepEqual(sample(-1), entrance, 'an older preparation can hide the gunner room without changing shader slots');
  const flight = { ...newHammerFlight(), z: 45, gunnery: newHammerGunnery() };
  journey.step = 2; journey.hammer = flight;
  const root = hammerCrewRoot(flight, 'niobe');
  actor.position = { x: center.x + root.x, y: center.y + root.y, z: center.z + root.z };
  assert.deepEqual(sample(-1), entrance);
  const exterior = h.scene.getObjectByProperty('id', entrance.find(id =>
    (h.scene.getObjectByProperty('id', id) as THREE.PointLight).color.getHex() === 0x91b4d4)!) as THREE.PointLight;
  assert.equal(exterior.intensity, 27);
  const outsidePosition = exterior.getWorldPosition(new THREE.Vector3());
  assert.deepEqual(sample(1, true), entrance, 'hiding the hull for the cockpit must not compile another light layout');
  assert.equal(exterior.intensity, 0, 'the hull beacon still turns off in first person');
  assert.deepEqual(exterior.getWorldPosition(new THREE.Vector3()).toArray(), outsidePosition.toArray());
});

test('the dock defense stabilizes the moving approach and keeps cockpit light culling', t => {
  const h = view(), renderer = new FilmSetRenderer(h.scene);
  t.after(() => { h.culling.dispose(); renderer.dispose(); });
  const ground = FILM_SCENE_BY_ID.m3_diggers, upper = FILM_SCENE_BY_ID.m3_upper_digger;
  const world = new WorldState(); new AgentManager(world).initializeAllAgents();
  const charra = world.agents.get('charra')!, zee = world.agents.get('zee')!;
  charra.isInMatrix = zee.isInMatrix = false;
  const journey: FilmJourney = { version: 1, scene: ground.id, actor: charra.id, step: 0, completed: [], enteredAt: 0,
    checkpoint: filmEntry(ground), reflections: {}, lastText: '', diggers: newDiggers() };
  const sandbox = { neoLife: { journey } } as SandboxState;
  h.camera.aspect = 16 / 9; h.camera.far = 5000; h.camera.updateProjectionMatrix();
  const sample = (actor: typeof charra, x: number, y: number, z: number, yaw: number) => {
    actor.position = filmPosition(ground.set, x, z); actor.position.y += y;
    h.camera.position.set(actor.position.x - Math.sin(yaw) * 4, actor.position.y + 3, actor.position.z - Math.cos(yaw) * 4);
    h.camera.lookAt(actor.position.x + Math.sin(yaw) * 8, actor.position.y + 2, actor.position.z + Math.cos(yaw) * 8);
    assert.equal(renderer.update(actor, sandbox, 0, actor.position, h.camera.position, undefined, false, 12000, h.camera)?.id, ground.set);
    h.culling.stablePointSlots = renderer.stablePointSlots;
    h.before();
    let slots = 0, dockLamps = 0;
    try {
      h.scene.traverseVisible(light => {
        if (!(light instanceof THREE.PointLight)) return;
        slots++;
        if (light.color.getHex() === 0xffbd83) dockLamps++;
      });
    } finally { h.after(); }
    return { slots, dockLamps };
  };
  const approach = sample(charra, -42, 0, 31, Math.PI);
  assert.deepEqual(sample(charra, -42, 0, 16, Math.PI), approach);
  assert.deepEqual(sample(charra, -42, 0, 31, Math.PI / 2), approach);
  assert.equal(approach.dockLamps, 6, 'only the six nearby dock lamps occupy slots');
  const aperture = DIGGERS.stations[0], joint = DIGGERS.knees[0];
  Object.assign(journey.diggers!, { phase: 'rocket', total: 1.1, shot: { from: { ...aperture, y: 3.5 }, to: joint, at: 0, flight: 1, result: 'joint' } });
  assert.deepEqual(sample(charra, aperture.x, 0, aperture.z, 1.9), approach);
  Object.assign(journey.diggers!, { phase: 'done', damage: 3 });
  journey.scene = upper.id; journey.actor = zee.id; journey.completed = [ground.id]; journey.upperDigger = newUpperDigger();
  const ladder = UPPER_DIGGER.ladder;
  const base = sample(zee, ladder.x, 0, ladder.z, -Math.PI / 2);
  journey.upperDigger.phase = 'climbing'; journey.upperDigger.climb = 24;
  assert.deepEqual(sample(zee, ladder.x, 24, ladder.z, -Math.PI / 2), base);
  journey.upperDigger.phase = 'crawl'; journey.upperDigger.crawl = 15;
  assert.deepEqual(sample(zee, -26, UPPER_DIGGER.height, 28, Math.PI / 2), base);

  const mifune = world.agents.get('mifune')!;
  mifune.isInMatrix = false;
  journey.scene = 'm3_dock_battle'; journey.actor = mifune.id; journey.completed.push(upper.id);
  journey.upperDigger.phase = 'done'; journey.upperDigger.charraDead = true;
  journey.dockGunnery = newDockGunnery(0);
  const entrance = sample(mifune, 0, 0, 44, Math.PI);
  assert.equal(entrance.dockLamps, 6);
  assert.deepEqual(sample(mifune, -4.3, 0, 44, -Math.PI / 2), entrance);
  assert.deepEqual(sample(mifune, -4.3, 0, 10, Math.PI), entrance);
  journey.dockGunnery.phase = 'firing';
  sample(mifune, 0, APU_RIG.floor + APU_RIG.pilot.y, DOCK_GUNNERY.apuZ, Math.PI - .8);
  assert.equal(renderer.stablePointSlots, false, 'the cockpit can cull lights outside its restricted view');

  const kid = world.agents.get('kid')!;
  kid.isInMatrix = false;
  journey.scene = 'm3_gate'; journey.actor = kid.id; journey.completed.push('m3_dock_battle');
  delete journey.dockGunnery;
  const handoff = sample(kid, -1.55, 0, 6.3, -Math.PI / 2);
  assert.equal(handoff.slots, entrance.slots, 'the hovering Sentinels use the existing dock slots at the handoff');
  assert.equal(sample(kid, -5.5, 0, 6.3, Math.PI / 2).slots, handoff.slots);
  journey.step = 1;
  assert.equal(sample(kid, APU_ROUTE.entry.x, 0, APU_ROUTE.entry.z, .12).slots, handoff.slots);
  const signal = (index: number) => {
    const sentinel = renderer.root.getObjectByName(`zion-gate-sentinel-${index}`)!;
    assert.equal(sentinel.visible, true, 'the complete Sentinel remains in view');
    return sentinel.children.find(object => object instanceof THREE.PointLight)!;
  };
  const near = sample(kid, 0, 0, -13, Math.PI);
  assert.equal(near.slots, handoff.slots);
  assert.ok(near.dockLamps < 6 && signal(1).visible, 'a nearby Sentinel can light the dock');
  assert.equal(signal(4).visible, false, 'a distant Sentinel retains its emissive optics');
  assert.equal(sample(kid, 0, 0, -43, Math.PI).slots, handoff.slots);
  assert.equal(signal(4).visible, true);
  journey.apu = newApuRun();
  sample(kid, 0, APU_RIG.floor + APU_RIG.pilot.y, APU_ROUTE.start, Math.PI);
  assert.equal(renderer.stablePointSlots, false, 'the moving APU keeps its existing culling');
  renderer.update(kid, sandbox, 0, kid.position, h.camera.position);
  for (let i = 1; i <= APU_ROUTE.dives.length; i++) assert.equal(signal(i).visible, true);
});

test('the command bunker retains its demolition flash slot through ignition and settling', t => {
  const h = view(), renderer = new FilmSetRenderer(h.scene);
  t.after(() => { h.culling.dispose(); renderer.dispose(); });
  const chapter = FILM_SCENE_BY_ID.m3_shaft_seal, center = FILM_SETS[chapter.set].center;
  const world = new WorldState(); new AgentManager(world).initializeAllAgents();
  const operator = world.agents.get('citizen_15')!;
  Object.assign(operator, { position: filmStepPosition(chapter, chapter.steps[1]), currentLocation: chapter.set, isInMatrix: false });
  h.camera.position.set(center.x, center.y + 3, center.z + 8);
  h.camera.lookAt(center.x, center.y + 3, center.z - 13);
  const journey: FilmJourney = { version: 1, scene: chapter.id, actor: operator.id, step: 1, completed: [], enteredAt: 0,
    checkpoint: operator.position, reflections: {}, lastText: '', shaftSeal: { phase: 'armed', elapsed: 0, turn: .5 } };
  const sandbox = { neoLife: { journey } } as SandboxState;
  const sample = () => {
    renderer.update(operator, sandbox, 0, operator.position, h.camera.position, undefined, false, 12000, h.camera);
    h.culling.stablePointSlots = renderer.stablePointSlots;
    const slots: { id: number; color: number; power: number }[] = [];
    h.before();
    try {
      h.scene.traverseVisible(object => {
        if (object instanceof THREE.PointLight) slots.push({ id: object.id, color: object.color.getHex(), power: object.intensity });
      });
    } finally { h.after(); }
    return slots;
  };
  const ready = sample(), flash = (slots: ReturnType<typeof sample>) => slots.find(light => light.color === 0xffc889);
  assert.equal(flash(ready)?.power, 0);
  Object.assign(journey.shaftSeal!, { phase: 'detonating', elapsed: .06, turn: 1, firedAt: 4 });
  const ignition = sample();
  assert.deepEqual(ignition.map(light => light.id), ready.map(light => light.id));
  assert.ok(flash(ignition)!.power > 0);
  Object.assign(journey.shaftSeal!, { phase: 'done', elapsed: 7.2 });
  journey.step = 2;
  const settled = sample();
  assert.deepEqual(settled.map(light => light.id), ready.map(light => light.id));
  assert.equal(flash(settled)?.power, 0);
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
