import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { FILM_SETS, LAFAYETTE, PILL_ROOM, filmBlocked, filmPosition, type FilmJourney, type SandboxState } from '@auto_matrix/shared';
import { AgentRenderer } from '../packages/client/src/agents/AgentRenderer.js';
import { FilmSetRenderer } from '../packages/client/src/engine/FilmSetRenderer.js';
import { LightCulling } from '../packages/client/src/engine/LightCulling.js';
import { WorldState } from '../packages/server/src/world/WorldState.js';
import { AgentManager } from '../packages/server/src/agents/AgentManager.js';

test('Lafayette prepares the visible actor in batches with the room lights that are reused at arrival', t => {
  t.mock.method(THREE.TextureLoader.prototype, 'load', () => new THREE.Texture());
  const document = globalThis.document;
  globalThis.document = { createElement: () => ({ getContext: () => ({ fillRect() {}, strokeRect() {}, fillText() {}, beginPath() {}, moveTo() {}, lineTo() {}, closePath() {}, stroke() {}, fill() {} }) }) } as unknown as Document;
  const scene = new THREE.Scene(), renderer = new FilmSetRenderer(scene), lighting = new LightCulling(scene);
  t.after(() => { lighting.dispose(); renderer.dispose(); globalThis.document = document; });
  lighting.stablePointSlots = true;
  const world = new WorldState(); new AgentManager(world).initializeAllAgents();
  const neo = world.agents.get('neo')!;
  neo.position = filmPosition('film_extraction_car', 655, 38); neo.currentLocation = 'film_extraction_car'; neo.isInMatrix = true;
  const journey: FilmJourney = { version: 1, scene: 'm1_bug', actor: 'neo', step: 2, enteredAt: 0, completed: [], reflections: {},
    checkpoint: { ...neo.position }, lastText: '', meeting: { phase: 'outside', elapsed: 0, bugged: false, approach: { x: 4, z: -12.35, yaw: 0 } } };
  const sandbox = { neoLife: { journey } } as SandboxState;
  assert.equal(renderer.update(neo, sandbox, 0)?.id, 'film_extraction_car');
  const actor = new THREE.Group(), geometry = new THREE.BoxGeometry(), material = new THREE.MeshStandardMaterial();
  t.after(() => { geometry.dispose(); material.dispose(); });
  for (let i = 0; i < 6; i++) actor.add(new THREE.Mesh(geometry, material));
  const hidden = new THREE.Mesh(geometry, material); hidden.visible = false; actor.add(hidden);
  const eye = new THREE.PerspectiveCamera(), batches: THREE.Object3D[][] = [];
  const children = [...scene.children];
  let key: THREE.SpotLight | undefined;
  let firstReady = false;
  const bindings: number[] = [];
  const programs: { isReady: () => boolean; getUniforms: () => void }[] = [];
  const webgl = {
    info: { programs },
    extensions: { has: () => true }, getRenderTarget: () => null, setRenderTarget() {},
    compile(subject: THREE.Object3D, _eye: THREE.Camera, target: THREE.Scene) {
      const batch: THREE.Object3D[] = []; subject.traverse(object => batch.push(object)); batches.push(batch);
      target.traverseVisible(object => { if (object instanceof THREE.SpotLight && object.intensity === 1900) key = object; });
      assert.ok(key, 'the room shadow light must be present in the program variant');
      assert.equal(key.getWorldPosition(new THREE.Vector3()).y, FILM_SETS.film_lafayette.center.y - 1 + 9.4);
      if (programs.length === 0) programs.push(
        { isReady: () => firstReady, getUniforms: () => { bindings.push(1); } },
        { isReady: () => true, getUniforms: () => { bindings.push(2); } },
      );
    },
  } as unknown as THREE.WebGLRenderer;
  for (let i = 0; i < 4; i++) {
    renderer.prepareLafayette(webgl, eye, lighting, journey, actor);
    assert.deepEqual(scene.children, children, 'preparation cannot light the street');
  }
  assert.deepEqual(batches.map(batch => batch.length), [4, 4, 4, 4]);
  assert.deepEqual(batches.flat().slice(0, 6), actor.children.slice(0, 6));
  assert.ok(batches.flat().slice(6).every(object => renderer.root.getObjectById(object.id) === object),
    'street and hotel materials compile from the live scene meshes');
  for (let frame = 0; frame < 180 && !bindings.length; frame++)
    renderer.prepareLafayette(webgl, eye, lighting, journey, actor);
  assert.deepEqual(bindings, [2], 'only a program with completed linking can prepare its binding locations');
  firstReady = true;
  renderer.prepareLafayette(webgl, eye, lighting, journey, actor);
  assert.deepEqual(bindings, [2, 1]);
  neo.position = filmPosition('film_lafayette', 0, 29); neo.position.y -= LAFAYETTE.upper;
  assert.equal(renderer.update(neo, sandbox, 0)?.id, 'film_lafayette');
  assert.ok(key && renderer.root.getObjectByProperty('uuid', key.uuid) === key);
  assert.equal(key.getWorldPosition(new THREE.Vector3()).y, FILM_SETS.film_lafayette.center.y - 1 + 9.4);
});

test('Lafayette prepares the ground and third-floor light layouts without changing the active street', t => {
  t.mock.method(THREE.TextureLoader.prototype, 'load', () => new THREE.Texture());
  const document = globalThis.document;
  globalThis.document = { createElement: () => ({ getContext: () => ({ fillRect() {}, strokeRect() {}, fillText() {}, beginPath() {}, moveTo() {}, lineTo() {}, closePath() {}, stroke() {}, fill() {} }) }) } as unknown as Document;
  const scene = new THREE.Scene(), renderer = new FilmSetRenderer(scene), lighting = new LightCulling(scene);
  t.after(() => { lighting.dispose(); renderer.dispose(); globalThis.document = document; });
  const world = new WorldState(); new AgentManager(world).initializeAllAgents();
  const neo = world.agents.get('neo')!;
  neo.position = filmPosition('film_lafayette', 43, 23); neo.position.y = 8; neo.currentLocation = 'film_lafayette'; neo.isInMatrix = true;
  const journey: FilmJourney = { version: 1, scene: 'm1_pills', actor: 'neo', step: 0, enteredAt: 0, completed: [], reflections: {},
    checkpoint: { ...neo.position }, lastText: '', hotel: { progress: 0 } };
  const sandbox = { neoLife: { journey } } as SandboxState;
  assert.equal(renderer.update(neo, sandbox, 0, neo.position)?.id, 'film_lafayette');
  const { approach, hotel } = renderer as unknown as { approach: { root: THREE.Group }; hotel: { lights: THREE.PointLight[] } };
  const before = hotel.lights.map(light => light.position.toArray());
  const actors = [new THREE.Group(), new THREE.Group()] as const;
  const geometry = new THREE.BoxGeometry(), material = new THREE.MeshStandardMaterial();
  t.after(() => { geometry.dispose(); material.dispose(); });
  for (const actor of actors) for (let i = 0; i < 3; i++) actor.add(new THREE.Mesh(geometry, material));
  const eye = new THREE.PerspectiveCamera(); eye.position.y = 12;
  const pointLights = () => {
    const lights: THREE.PointLight[] = [];
    scene.traverseVisible(object => { if (object instanceof THREE.PointLight) lights.push(object); });
    return lights;
  };
  const groundLights = pointLights();
  const groundBatches: number[] = [];
  const groundWebgl = {
    extensions: { has: () => true }, getRenderTarget: () => null, setRenderTarget() {},
    compile(subject: THREE.Object3D) {
      assert.equal(approach.root.visible, true);
      let count = 0; subject.traverse(() => count++);
      assert.ok(count > 0 && count <= 4);
      groundBatches.push(pointLights().length);
    },
  } as unknown as THREE.WebGLRenderer;
  renderer.prepareLafayetteGround(groundWebgl, eye, lighting, journey, 8, actors);
  assert.deepEqual(groundBatches, []);
  for (let i = 0; i < 2; i++) {
    renderer.prepareLafayetteGround(groundWebgl, eye, lighting, journey, 1, actors);
    assert.deepEqual(pointLights(), groundLights);
    assert.equal(lighting.enabled, true);
  }
  assert.deepEqual(groundBatches, [8, 4]);
  const batches: THREE.Object3D[][] = [];
  const webgl = {
    extensions: { has: () => true }, getRenderTarget: () => null, setRenderTarget() {},
    compile(subject: THREE.Object3D, camera: THREE.Camera) {
      assert.equal(approach.root.visible, false);
      assert.equal(camera.position.y, eye.position.y + LAFAYETTE.rise);
      assert.equal(hotel.lights[0].position.y, before[0][1] + LAFAYETTE.rise);
      const batch: THREE.Object3D[] = []; subject.traverse(object => batch.push(object)); batches.push(batch);
    },
  } as unknown as THREE.WebGLRenderer;
  renderer.prepareLafayetteLanding(webgl, eye, lighting, journey, 7.9, actors);
  assert.equal(batches.length, 0);
  for (let i = 0; i < 2; i++) {
    renderer.prepareLafayetteLanding(webgl, eye, lighting, journey, neo.position.y, actors);
    assert.equal(renderer.lafayetteStreetHidden, false);
    assert.deepEqual(hotel.lights.map(light => light.position.toArray()), before);
  }
  assert.deepEqual(batches.map(batch => batch.length), [4, 4]);
  assert.deepEqual(batches.flat().slice(0, 6), actors.flatMap(actor => actor.children));
  neo.position.y = 15; renderer.update(neo, sandbox, 0, neo.position);
  assert.equal(renderer.lafayetteStreetHidden, true);
  renderer.prepareLafayetteLanding(webgl, eye, lighting, journey, neo.position.y, actors);
  assert.equal(batches.length, 2);
});

test('retiring the Lafayette street hides parked crew and keeps the tracking-room cast', t => {
  t.mock.method(THREE.TextureLoader.prototype, 'load', () => new THREE.Texture());
  t.mock.method(GLTFLoader.prototype, 'loadAsync', () => new Promise(() => {}));
  const document = globalThis.document;
  const context = { createRadialGradient: () => ({ addColorStop() {} }), fillRect() {}, strokeRect() {}, fillText() {},
    createImageData: (width: number, height: number) => ({ data: new Uint8ClampedArray(width * height * 4) }), putImageData() {} };
  globalThis.document = { createElement: () => ({ width: 0, height: 0, getContext: () => context }) } as unknown as Document;
  const world = new WorldState(); new AgentManager(world).initializeAllAgents();
  const renderer = new AgentRenderer(new THREE.Scene());
  t.after(() => { renderer.dispose(); globalThis.document = document; });
  const apoc = world.agents.get('apoc')!, crew = world.agents.get('switch')!, trinity = world.agents.get('trinity')!;
  for (const actor of [apoc, crew, trinity]) {
    actor.isInMatrix = true; actor.currentLocation = actor === trinity ? 'film_lafayette' : 'film_extraction_car';
    renderer.updateAgent(actor.id, actor); assert.equal(renderer.getAgent(actor.id)?.visible, true);
  }
  renderer.hideLafayetteStreetCast();
  assert.equal(renderer.getAgent('apoc')?.visible, false);
  assert.equal(renderer.getAgent('switch')?.visible, false);
  assert.equal(renderer.getAgent('trinity')?.visible, true);
  for (const actor of [apoc, crew]) {
    assert.equal(actor.currentLocation, 'film_extraction_car');
    actor.currentLocation = 'film_lafayette'; renderer.updateAgent(actor.id, actor);
  }
  renderer.hideLafayetteStreetCast();
  assert.equal(renderer.getAgent('apoc')?.visible, true);
  assert.equal(renderer.getAgent('switch')?.visible, true);
});

test('the fireplace and mirror carvings share one indexed source before room batching', t => {
  t.mock.method(THREE.TextureLoader.prototype, 'load', () => new THREE.Texture());
  const document = globalThis.document;
  globalThis.document = { createElement: () => ({ getContext: () => ({ fillRect() {}, strokeRect() {}, fillText() {}, beginPath() {}, moveTo() {}, lineTo() {}, closePath() {}, stroke() {}, fill() {} }) }) } as unknown as Document;
  const renderer = new FilmSetRenderer(new THREE.Scene());
  t.after(() => { renderer.dispose(); globalThis.document = document; });
  const batching = renderer as unknown as { batch(): void }, original = batching.batch;
  let checked = false;
  t.mock.method(batching, 'batch', () => {
    const uses = new Map<THREE.BufferGeometry, number>();
    renderer.root.traverse(object => {
      if (object instanceof THREE.Mesh) uses.set(object.geometry, (uses.get(object.geometry) ?? 0) + 1);
    });
    const carving = [...uses].find(([, copies]) => copies === 118)?.[0];
    assert.ok(carving?.index, 'the repeated leaf is indexed once before any of its placements are transformed');
    checked = true;
    original.call(renderer);
  });
  const world = new WorldState(); new AgentManager(world).initializeAllAgents();
  const neo = world.agents.get('neo')!; neo.position = filmPosition('film_lafayette', 1.75, -6); neo.isInMatrix = true;
  assert.equal(renderer.update(neo, undefined, 0)?.id, 'film_lafayette');
  assert.equal(checked, true);
});

test('Lafayette uses the room-owned construction buffers for the two chairs and the static batches', async t => {
  t.mock.method(THREE.TextureLoader.prototype, 'load', () => new THREE.Texture());
  const document = globalThis.document;
  globalThis.document = { createElement: () => ({ getContext: () => ({ fillRect() {}, strokeRect() {}, fillText() {}, beginPath() {}, moveTo() {}, lineTo() {}, closePath() {}, stroke() {}, fill() {} }) }) } as unknown as Document;
  const renderer = new FilmSetRenderer(new THREE.Scene());
  t.after(() => { renderer.dispose(); globalThis.document = document; });
  const batching = renderer as unknown as { batch(): void; leather: THREE.Material }, original = batching.batch;
  let chairs: THREE.Mesh<THREE.BufferGeometry, THREE.Material>[][] = [], exclusiveCopies = 0;
  t.mock.method(batching, 'batch', () => {
    chairs = renderer.root.children.filter(object =>
      object instanceof THREE.Group && Math.abs(object.position.x) === PILL_ROOM.seat && object.position.z === PILL_ROOM.z)
      .map(chair => [...chair.children] as THREE.Mesh<THREE.BufferGeometry, THREE.Material>[]);
    const uses = new Map<THREE.BufferGeometry, number>();
    renderer.root.traverse(object => {
      if (object instanceof THREE.Mesh || object instanceof THREE.Line) uses.set(object.geometry, (uses.get(object.geometry) ?? 0) + 1);
    });
    const copy = THREE.BufferGeometry.prototype.copy;
    t.mock.method(THREE.BufferGeometry.prototype, 'copy', function (this: THREE.BufferGeometry, source: THREE.BufferGeometry) {
      if (source.index && uses.get(source) === 1) exclusiveCopies++;
      return copy.call(this, source);
    });
    original.call(renderer);
  });
  const world = new WorldState(); new AgentManager(world).initializeAllAgents();
  const neo = world.agents.get('neo')!; neo.position = filmPosition('film_lafayette', 1.75, -6); neo.isInMatrix = true;
  assert.equal(renderer.update(neo, undefined, 0)?.id, 'film_lafayette');
  await t.test('the matching chairs share indexed geometry and retain their original trim batches', () => {
    assert.equal(chairs.length, 2);
    const [left, right] = chairs;
    assert.ok(left.length > 0);
    assert.equal(right.length, left.length);
    for (const [index, mesh] of left.entries()) {
      assert.equal(right[index].geometry === mesh.geometry, true, 'the second chair should reuse the same source buffer');
      assert.ok(mesh.geometry.index);
      assert.equal(right[index].material === mesh.material, mesh.material === batching.leather);
    }
  });
  await t.test('single-use indexed construction buffers are merged without copying them', () => {
    assert.equal(exclusiveCopies, 0);
  });
});

test('Lafayette windows, fireplace and tracking passage have matching visible geometry and access', t => {
  t.mock.method(THREE.TextureLoader.prototype, 'load', () => new THREE.Texture());
  const document = globalThis.document;
  globalThis.document = { createElement: () => ({ getContext: () => ({ fillRect() {}, strokeRect() {}, fillText() {}, beginPath() {}, moveTo() {}, lineTo() {}, closePath() {}, stroke() {}, fill() {} }) }) } as unknown as Document;
  const world = new WorldState(); new AgentManager(world).initializeAllAgents();
  const neo = world.agents.get('neo')!; neo.position = filmPosition('film_lafayette', 1.75, -6); neo.isInMatrix = true;
  const renderer = new FilmSetRenderer(new THREE.Scene());
  try {
    renderer.update(neo, undefined, 0); renderer.root.updateMatrixWorld(true);
    const ray = new THREE.Raycaster();
    const blockers = (point: THREE.Vector3, direction: THREE.Vector3, distance: number) => {
      ray.set(renderer.root.localToWorld(point), direction); ray.far = distance;
      return ray.intersectObject(renderer.root, true).filter(hit => {
        const mesh = hit.object as THREE.Mesh;
        return mesh.castShadow && !Array.isArray(mesh.material) && !mesh.material.transparent;
      });
    };
    for (const z of [-18, -2, 14]) {
      assert.equal(blockers(new THREE.Vector3(-19.5, 8, z + .7), new THREE.Vector3(-1, 0, 0), 4).length, 0,
        `the window at ${z} must not be glass glued onto an opaque wall`);
      assert.ok(blockers(new THREE.Vector3(-19.5, .35, z + .7), new THREE.Vector3(-1, 0, 0), 4).length > 0,
        'the solid sill below the glazing remains');
    }
    for (const x of [-7, -6, -5]) for (const y of [1, 3, 5]) {
      assert.equal(blockers(new THREE.Vector3(x, y, -10.5), new THREE.Vector3(0, 0, -1), 2).length, 0,
        'the chair-to-mirror route must remain visually open');
    }
    assert.ok(blockers(new THREE.Vector3(0, 4.1, -9), new THREE.Vector3(0, 0, -1), 1.9).length > 0,
      'the carved fireplace must be visible immediately behind the meeting table');
    assert.equal(filmBlocked(filmPosition('film_lafayette', 3.1, -10.4), FILM_SETS.film_lafayette, .1), true,
      'the projecting fireplace pilaster must be solid to the player');
    const cup = renderer.root.getObjectByName('pill-water-glass')!;
    const beneathGlass = blockers(cup.position.clone(), new THREE.Vector3(0, -1, 0), .4)[0];
    assert.ok(beneathGlass, 'the glass must sit on the table');
    assert.ok(Math.abs(renderer.root.worldToLocal(beneathGlass.point).y - (cup.position.y - .22)) < .012,
      'the glass base must contact the visible tabletop without hovering');
    assert.equal(blockers(new THREE.Vector3(1.45, 2.8, PILL_ROOM.tableZ - .6), new THREE.Vector3(0, -1, 0), 2.5).length, 0,
      'a slender side table must not retain the large rectangular coffee-table corners');
    assert.equal(filmBlocked(filmPosition('film_lafayette', 1.45, PILL_ROOM.tableZ - .6), FILM_SETS.film_lafayette, .05), false,
      'shrinking the visible table must also remove its old invisible collision');
    const crown = (side: number) => blockers(new THREE.Vector3(PILL_ROOM.seat - 1, 3.35, PILL_ROOM.z + side * .65), new THREE.Vector3(1, 0, 0), 3).length;
    assert.ok(crown(0) > 0 && crown(1.7) === 0 && crown(-1.7) === 0,
      'the upholstered crown must curve down toward its shoulders instead of forming a square slab');
    for (const side of [-1, 1]) assert.ok(blockers(new THREE.Vector3(PILL_ROOM.seat + .9 * .65, 2.3, PILL_ROOM.z + side * 2.2 * .65),
      new THREE.Vector3(0, 0, -side), .6).length > 0, 'the wing upholstery must be closed from both outside views');
    const journey: FilmJourney = { version: 1, scene: 'm1_pills', actor: 'neo', step: 1, enteredAt: 0, completed: [], reflections: {},
      checkpoint: { ...neo.position }, lastText: '', pills: { phase: 'done', elapsed: 17, choice: 'red', approach: { x: 1.75, z: -6, yaw: -Math.PI / 2 } } };
    renderer.update(neo, { neoLife: { journey } } as SandboxState, 0); renderer.root.updateMatrixWorld(true);
    const usedGlass = renderer.root.getObjectByName('pill-water-glass')!; const camera = new THREE.PerspectiveCamera();
    for (const distance of [16, 3, 30, 3]) {
      camera.position.copy(usedGlass.getWorldPosition(new THREE.Vector3())).add(new THREE.Vector3(0, 0, distance)); camera.updateMatrixWorld(true);
      usedGlass.traverse(object => { if (object instanceof THREE.LOD) object.update(camera); });
      const levels: THREE.Object3D[] = [];
      usedGlass.traverseVisible(object => { if (object.name === 'pill-water-level') levels.push(object); });
      assert.equal(levels.length, 1, 'only one glass and water representation can be drawn per view');
      assert.equal(levels[0].scale.y, .45, 'changing view distance after drinking must not refill the glass');
      assert.equal(levels[0].position.y, -.12, 'both views retain the saved water surface height');
    }
  } finally { renderer.dispose(); globalThis.document = document; }
});

test('crossing the Lafayette entrance keeps the already visible hotel and street resources', t => {
  const pending: { url: string; texture: THREE.Texture; finish: () => void }[] = [];
  t.mock.method(THREE.TextureLoader.prototype, 'load', (url: string, onLoad?: (texture: THREE.Texture) => void) => {
    const texture = new THREE.Texture();
    if (onLoad) pending.push({ url, texture, finish: () => onLoad(texture) });
    return texture;
  });
  const document = globalThis.document;
  globalThis.document = { createElement: () => ({ getContext: () => ({ fillRect() {}, strokeRect() {}, fillText() {}, beginPath() {}, moveTo() {}, lineTo() {}, closePath() {}, stroke() {}, fill() {} }) }) } as unknown as Document;
  const world = new WorldState(); new AgentManager(world).initializeAllAgents();
  const neo = world.agents.get('neo')!;
  neo.position = filmPosition('film_extraction_car', 655, 38); neo.currentLocation = 'film_extraction_car'; neo.isInMatrix = true;
  const journey: FilmJourney = { version: 1, scene: 'm1_bug', actor: 'neo', step: 2, enteredAt: 0, completed: [], reflections: {},
    checkpoint: { ...neo.position }, lastText: '', meeting: { phase: 'outside', elapsed: 0, bugged: false, approach: { x: 4, z: -12.35, yaw: 0 } } };
  const curb = { ...neo.position }, meeting = journey.meeting;
  const sandbox = { neoLife: { journey } } as SandboxState;
  const scene = new THREE.Scene(), renderer = new FilmSetRenderer(scene), lighting = new LightCulling(scene);
  try {
    assert.equal(renderer.update(neo, sandbox, 0)?.id, 'film_extraction_car');
    let street: THREE.Mesh | undefined;
    renderer.root.traverse(object => { if (object instanceof THREE.Mesh && object.material.name === 'meeting-asphalt') street = object; });
    assert.ok(street);
    const streetPosition = street.getWorldPosition(new THREE.Vector3());
    let disposals = 0; street.geometry.addEventListener('dispose', () => disposals++);
    const webgl = { extensions: { has: () => false } } as unknown as THREE.WebGLRenderer;
    const eye = new THREE.PerspectiveCamera();
    const staging = renderer as unknown as {
      meeting?: { hotel?: { root: THREE.Group } };
      hotel?: { root: THREE.Group };
      preparedLafayette?: { room?: FilmSetRenderer; roomSteps?: Generator<void> };
    };
    const preview = staging.meeting?.hotel;
    assert.ok(preview);
    const previewPosition = preview.root.getWorldPosition(new THREE.Vector3());
    const before = new Map<THREE.BufferGeometry, number>();
    preview.root.traverse(object => {
      if (object instanceof THREE.Mesh) {
        before.set(object.geometry, 0);
        object.geometry.addEventListener('dispose', () => before.set(object.geometry, (before.get(object.geometry) ?? 0) + 1));
      }
    });
    const streetChildren = [...renderer.root.children];
    const stagedTextureStart = pending.length;
    renderer.prepareLafayette(webgl, eye, lighting, journey);
    const room = staging.preparedLafayette?.room;
    assert.ok(room, 'room construction can begin on the approach without a shader extension');
    assert.ok(staging.preparedLafayette?.roomSteps);
    assert.equal(scene.getObjectByName('pill-water-glass'), undefined);
    let frames = 1;
    while (staging.preparedLafayette?.roomSteps && frames < 180) {
      renderer.prepareLafayette(webgl, eye, lighting, journey);
      frames++;
    }
    assert.ok(frames > 4 && frames < 180);
    assert.deepEqual(renderer.root.children, streetChildren);
    const cup = room.root.getObjectByName('pill-water-glass');
    assert.ok(cup);
    const rug = pending.slice(stagedTextureStart).find(entry => entry.url.endsWith('lafayette-rug-v1.jpg'));
    assert.ok(rug);
    let roomDisposals = 0;
    cup.traverse(object => { if (object instanceof THREE.Mesh) object.geometry.addEventListener('dispose', () => roomDisposals++); });
    neo.position = filmPosition('film_lafayette', 0, 29); neo.position.y -= LAFAYETTE.upper;
    assert.equal(renderer.update(neo, sandbox, 0)?.id, 'film_lafayette');
    assert.ok(renderer.root.getObjectByProperty('uuid', street.uuid) === street, 'the road from the ride must remain the same object');
    assert.deepEqual(street.getWorldPosition(new THREE.Vector3()), streetPosition);
    assert.equal(disposals, 0);
    assert.ok(staging.hotel === preview, 'the hotel must keep the stair and facade resources from the ride');
    assert.deepEqual(preview.root.getWorldPosition(new THREE.Vector3()), previewPosition);
    const retired = [...before.values()].filter(count => count > 0);
    assert.deepEqual(retired, [1], 'only the exterior-only roof batch is released at the handoff');
    const children = [...renderer.root.children];
    assert.equal(renderer.root.getObjectByName('pill-water-glass'), cup, 'arrival must attach the prepared room');
    assert.equal(roomDisposals, 0);
    rug.finish();
    let rugAttached = false;
    renderer.root.traverse(object => {
      if (object instanceof THREE.Mesh && object.material instanceof THREE.MeshStandardMaterial && object.material.map === rug.texture) rugAttached = true;
    });
    assert.equal(rugAttached, true, 'a staged texture can finish loading after the room changes owners');
    journey.scene = 'm1_pills'; journey.step = 0; journey.hotel = { progress: 0 }; delete journey.meeting;
    assert.equal(renderer.update(neo, sandbox, 0)?.id, 'film_lafayette');
    assert.ok(children.every((child, index) => renderer.root.children[index] === child), 'confirming the entrance must keep the already rendered set');
    renderer.update(undefined, undefined, 0);
    assert.equal(renderer.root.children.length, 0);
    assert.equal(disposals, 1, 'leaving the combined street and hotel must release the road once');
    assert.ok([...before.values()].every(count => count === 1));
    assert.ok(roomDisposals > 0, 'the adopted room releases its geometry when leaving');
    neo.position = curb; journey.scene = 'm1_bug'; journey.step = 2; journey.meeting = meeting; delete journey.hotel;
    assert.equal(renderer.update(neo, sandbox, 0)?.id, 'film_extraction_car');
    renderer.prepareLafayette(webgl, eye, lighting, journey);
    const abandoned = staging.preparedLafayette?.room;
    assert.ok(abandoned && staging.preparedLafayette?.roomSteps);
    let abandonedGeometry: THREE.BufferGeometry | undefined;
    abandoned.root.traverse(object => { if (!abandonedGeometry && object instanceof THREE.Mesh) abandonedGeometry = object.geometry; });
    assert.ok(abandonedGeometry);
    let abandonedDisposals = 0; abandonedGeometry.addEventListener('dispose', () => abandonedDisposals++);
    journey.meeting = { ...meeting!, phase: 'parked' };
    assert.equal(renderer.update(neo, sandbox, 0)?.id, 'film_extraction_car');
    assert.equal(staging.preparedLafayette, undefined);
    assert.equal(abandonedDisposals, 1, 'a room left before entry also releases its geometry');
  } finally { lighting.dispose(); renderer.dispose(); globalThis.document = document; }
});
