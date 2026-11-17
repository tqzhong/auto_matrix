import assert from 'node:assert/strict';
import test, { type TestContext } from 'node:test';
import * as THREE from 'three';
import { DOCK_EMP, DOCK_REUNION, FILM_SETS, dockEmpSentinel, dockReunionRoot, filmPosition, newDockGate, newDiggers, type DockReunion, type FilmJourney, type SandboxState } from '@auto_matrix/shared';
import { DockEmpRenderer } from '../packages/client/src/engine/DockEmpRenderer.js';
import { FilmSetRenderer } from '../packages/client/src/engine/FilmSetRenderer.js';
import { WorldState } from '../packages/server/src/world/WorldState.js';
import { AgentManager } from '../packages/server/src/agents/AgentManager.js';

function saved(time: number): FilmJourney {
  return { version: 1, scene: 'm3_emp', actor: 'link', step: 1, completed: ['m3_gate'], enteredAt: 0,
    checkpoint: { x: 0, y: 0, z: 0 }, reflections: {}, lastText: '', emp: { firedAt: 12, elapsed: time },
    dockGate: { ...newDockGate(6, -50), phase: 'done', elapsed: 6, toppled: true } };
}
function vertices(mesh: THREE.InstancedMesh, index: number) {
  const matrix = new THREE.Matrix4(); mesh.getMatrixAt(index, matrix);
  const buffer = mesh.geometry.getAttribute('position');
  return Array.from({ length: buffer.count }, (_, v) => new THREE.Vector3().fromBufferAttribute(buffer, v).applyMatrix4(matrix));
}

function mockRoomTextures(t: TestContext): void {
  const original = globalThis.document;
  globalThis.document = { createElement: () => ({ width: 0, height: 0, getContext: () => ({
    createImageData: (width: number, height: number) => ({ data: new Uint8ClampedArray(width * height * 4) }),
    putImageData() {}, fillRect() {}, strokeRect() {}, fillText() {}, createRadialGradient: () => ({ addColorStop() {} }),
  }) }) } as unknown as Document;
  t.mock.method(THREE.TextureLoader.prototype, 'load', () => new THREE.Texture());
  t.after(() => { globalThis.document = original; });
}

test('the EMP reaches individual machines, leaves grounded wreckage and resumes the identical frame', () => {
  const root = new THREE.Group(), renderer = new DockEmpRenderer(root), state = saved(0);
  const shells = root.getObjectByName('emp-sentinel-shells') as THREE.InstancedMesh;
  const faces = root.getObjectByName('emp-sentinel-faces') as THREE.InstancedMesh;
  const eyes = root.getObjectByName('emp-sentinel-eyes') as THREE.InstancedMesh;
  const tails = root.getObjectByName('emp-sentinel-tails') as THREE.InstancedMesh;
  renderer.update(state);
  const matrix = new THREE.Matrix4(); eyes.getMatrixAt(0, matrix); assert.ok(matrix.determinant() > 0);
  state.emp!.elapsed = .5; renderer.update(state);
  for (let i = 0; i < DOCK_EMP.count; i++) {
    eyes.getMatrixAt(i, matrix);
    assert.equal(matrix.determinant() === 0, dockEmpSentinel(i, .5).dead);
  }
  for (const time of [1.5, 2.5, 3.5, 5, 9]) {
    state.emp!.elapsed = time; renderer.update(state);
    for (let i = 0; i < DOCK_EMP.count; i++) {
      const body = [...vertices(shells, i), ...vertices(faces, i)], low = Math.min(...body.map(v => v.y));
      assert.ok(low >= -.00001, `sentinel ${i} clips floor at ${time}: ${low}`);
      if (time === 9) assert.ok(Math.abs(low - .06) < .00001, `wreck ${i} floats above the dock`);
    }
    for (let i = 0; i < tails.count; i++) assert.ok(Math.min(...vertices(tails, i).map(v => v.y)) >= -.00001, `tail ${i} clips dock at ${time}`);
  }
  const snapshot = [...shells.instanceMatrix.array], tailSnapshot = [...tails.instanceMatrix.array];
  const coldRoot = new THREE.Group(), cold = new DockEmpRenderer(coldRoot); cold.update(structuredClone(state));
  assert.deepEqual([...(coldRoot.getObjectByName('emp-sentinel-shells') as THREE.InstancedMesh).instanceMatrix.array], snapshot);
  assert.deepEqual([...(coldRoot.getObjectByName('emp-sentinel-tails') as THREE.InstancedMesh).instanceMatrix.array], tailSnapshot);
  assert.equal((coldRoot.getObjectByName('emp-dock-flash') as THREE.PointLight).intensity, 0);
  assert.equal(coldRoot.getObjectByName('emp-wavefront')!.visible, false);
  const ship = coldRoot.getObjectByName('gate-three-hammer')!;
  assert.equal(ship.visible, true);
  coldRoot.updateMatrixWorld(true);
  const bounds = new THREE.Box3().setFromObject(ship, true);
  assert.ok(bounds.min.y >= FILM_SETS.film_zion_hangar.center.y - 1, 'the settled hull cannot cut through the dock');
  assert.ok(bounds.min.y < FILM_SETS.film_zion_hangar.center.y - .9, 'the disabled ship must land instead of hovering above the floor');
  state.visiting = 'm3_emp'; renderer.update(state); assert.equal(renderer.group.visible, false);
  cold.dispose(); renderer.dispose(); assert.equal(root.children.length, 0); assert.equal(coldRoot.children.length, 0);
});

test('EMP wreckage lands on the raised east dock and the Hammer slides clear of its railings', () => {
  const root = new THREE.Group(), renderer = new DockEmpRenderer(root), state = saved(9);
  state.diggers = { ...newDiggers(), phase: 'done', damage: 3 };
  renderer.update(state); root.updateMatrixWorld(true);
  const bulbs = new Set<THREE.MeshStandardMaterial>();
  root.getObjectByName('zion-homecoming-set')!.traverseVisible(object => {
    if (object instanceof THREE.Mesh && object.material instanceof THREE.MeshStandardMaterial && object.material.emissive.getHex() === 0xff934a) bulbs.add(object.material);
  });
  assert.ok(bulbs.size > 0);
  assert.ok([...bulbs].every(material => material.emissiveIntensity === 0), 'actual lamp faces must go dark after EMP, not just their point lights');
  const powered: THREE.Light[] = [];
  root.getObjectByName('zion-homecoming-set')!.traverseVisible(object => {
    if (object instanceof THREE.PointLight && object.intensity > 0) powered.push(object);
  });
  assert.equal(powered.length, 0, 'the EMP also extinguishes the drill bay and upper service lights');
  const ship = root.getObjectByName('gate-three-hammer')!, bounds = new THREE.Box3().setFromObject(ship, true);
  const center = FILM_SETS.film_zion_hangar.center;
  assert.ok(Math.abs(bounds.min.y - center.y - .035) < .00001, `ship support ${bounds.min.y - center.y}`);
  assert.ok(bounds.min.x > center.x + 13, 'banked ship must clear the central walkway railings');
  const shells = root.getObjectByName('emp-sentinel-shells') as THREE.InstancedMesh;
  const faces = root.getObjectByName('emp-sentinel-faces') as THREE.InstancedMesh;
  const tails = root.getObjectByName('emp-sentinel-tails') as THREE.InstancedMesh;
  for (let i = 0; i < DOCK_EMP.count; i++) {
    const pose = dockEmpSentinel(i, 9), floor = pose.x >= 12 ? 1 : 0;
    const body = [...vertices(shells, i), ...vertices(faces, i)];
    assert.ok(Math.abs(Math.min(...body.map(p => p.y)) - floor - .06) < .00001, `wreck ${i} must touch its actual deck`);
    for (let segment = i * 72; segment < (i + 1) * 72; segment++)
      assert.ok(vertices(tails, segment).every(p => p.y >= floor), `tail ${segment} clips the raised deck`);
  }
  renderer.dispose();
});

test('EMP preparation queues work before switching to the powered-off cabin view', t => {
  mockRoomTextures(t);
  const scene = new THREE.Scene(), renderer = new FilmSetRenderer(scene);
  t.after(() => renderer.dispose());
  const world = new WorldState(); new AgentManager(world).initializeAllAgents();
  const link = world.agents.get('link')!, journey = saved(1.8);
  delete journey.emp; journey.step = 0;
  Object.assign(link, { position: filmPosition('film_hammer_deck', 0, -14), isInMatrix: false, currentLocation: 'film_hammer_deck' });
  const sandbox = { neoLife: { journey } } as SandboxState;
  renderer.update(link, sandbox, 0, link.position);
  const screens = new Set<THREE.MeshStandardMaterial>();
  renderer.root.traverse(object => {
    if (object instanceof THREE.Mesh && object.material instanceof THREE.MeshStandardMaterial
      && object.material.emissive.getHex() === 0x315367) screens.add(object.material);
  });
  assert.ok(screens.size > 0 && [...screens].every(material => material.emissiveIntensity > 0), 'the actual cabin starts with powered CRTs');
  journey.empOperator = { phase: 'seating', elapsed: .5, approach: { x: -2.8, z: -16 } };
  const marker = scene.children.find(object => object instanceof THREE.PointLight && object.color.getHex() === 0xf6d99c)!;
  renderer.update(link, sandbox, .5, link.position);
  assert.equal(marker.visible, true, 'seating retains the cabin light layout');
  const before = structuredClone(journey), camera = new THREE.PerspectiveCamera();
  const pointSlots: number[] = [], uploads: THREE.Texture[] = [];
  const body = new THREE.Group();
  const map = new THREE.Texture({ width: 1024, height: 1024 });
  const normalMap = new THREE.Texture({ width: 1024, height: 1024 });
  map.needsUpdate = normalMap.needsUpdate = true;
  body.add(new THREE.Mesh(new THREE.BoxGeometry(), new THREE.MeshStandardMaterial({ map, normalMap })));
  renderer.setCrosscutSubjects(() => undefined, id => id === 'mifune' ? body : undefined);
  let ready = false, reads = 0;
  const program = { isReady: () => ready, getUniforms: () => { reads++; } };
  const programs: typeof program[] = [];
  let target: THREE.WebGLRenderTarget | null = null;
  const webgl = {
    info: { programs }, properties: { get: (texture: THREE.Texture) =>
      texture === map || texture === normalMap ? {} : { __version: texture.version } },
    extensions: { has: () => true }, getRenderTarget: () => target,
    setRenderTarget: (next: typeof target) => { target = next; },
    initTexture: (texture: THREE.Texture) => { uploads.push(texture); },
    compile: (group: THREE.Group, _camera: THREE.Camera, lights: THREE.Scene) => {
      assert.ok(target, 'prepare the programs for the offscreen color pass');
      let points = 0;
      for (const root of [group, lights]) root.traverseVisible(object => { if (object instanceof THREE.PointLight) points++; });
      pointSlots.push(points);
      if (!programs.length) programs.push(program);
    },
  } as unknown as THREE.WebGLRenderer;
  renderer.prepareDockEmp(webgl, camera, journey);
  assert.deepEqual(uploads, []);
  renderer.prepareDockEmp(webgl, camera, journey);
  assert.deepEqual(uploads, [map], 'only one ready texture starts uploading per preparation frame');
  renderer.prepareDockEmp(webgl, camera, journey);
  assert.deepEqual(uploads, [map, normalMap]);
  assert.equal(reads, 0, 'shader reflection waits for the linked program');
  ready = true;
  renderer.prepareDockEmp(webgl, camera, journey);
  assert.equal(reads, 0, 'advance one frame after the driver reports the program is ready');
  renderer.prepareDockEmp(webgl, camera, journey);
  assert.equal(reads, 1);
  renderer.prepareDockEmp(webgl, camera, journey);
  assert.equal(reads, 1);
  assert.deepEqual(pointSlots, [3, 3], 'the dock and the existing cast use the same prepared light layout');
  assert.deepEqual(journey, before, 'warming cannot spend the saved EMP charge');
  assert.equal(target, null);
  const exterior = scene.getObjectByName('hammer-emp-dock')!;
  assert.equal(exterior.visible, false);
  assert.equal(renderer.root.visible, true);
  journey.emp = { firedAt: 12, elapsed: 1.8 }; journey.step = 1;
  link.currentAction = { type: 'idle', parameters: { dockEmp: 1.8 }, startedAt: 0, duration: 1, progress: 0 };
  renderer.update(link, sandbox, 1, link.position);
  assert.equal(scene.getObjectByName('hammer-emp-dock'), exterior, 'the discharge reuses the prepared exterior');
  assert.equal(renderer.root.visible, false, 'the exterior shot does not keep rendering the remote cabin');
  assert.equal(renderer.stablePointSlots, true);
  assert.equal(marker.visible, false, 'the exterior shot excludes the remote objective light');
  renderer.update(link, sandbox, 1, link.position, undefined, undefined, true);
  assert.equal(renderer.root.visible, true, 'V must restore the cabin around Link');
  assert.equal(scene.getObjectByName('hammer-emp-dock')!.visible, false);
  assert.ok([...screens].every(material => material.emissiveIntensity === 0), 'EMP must extinguish the real batched CRT faces');
  const glyphs: THREE.Material[] = [];
  renderer.root.traverse(object => {
    if (object instanceof THREE.Mesh && object.material.name === 'hammer-crt-glyphs') glyphs.push(object.material);
  });
  assert.ok(glyphs.length > 0 && glyphs.every(material => !material.visible), 'powered screen text must disappear too');
  renderer.update(link, sandbox, 1, link.position);
  assert.equal(renderer.root.visible, false);

  const wreck = exterior.getObjectByName('emp-sentinel-shells') as THREE.Mesh;
  let released = 0;
  wreck.geometry.addEventListener('dispose', () => { released++; });
  Object.assign(journey, { scene: 'm3_dock_reunion', step: 0, emp: { firedAt: 12, elapsed: 9 },
    dockReunion: { phase: 'ready', elapsed: 0, floor: 1, departure: 0, forward: true } });
  Object.assign(link, { position: filmPosition('film_zion_hangar', 20, 20), currentLocation: 'film_zion_hangar', currentAction: null });
  renderer.update(link, sandbox, 2, link.position);
  assert.ok(scene.getObjectByName('hammer-emp-dock') === exterior, 'Link must exit into the exterior already used by the EMP');
  assert.equal(exterior.visible, true);
  assert.ok(!renderer.root.getObjectByName('zion-homecoming-set'), 'only the visible blackout dock needs to exist');
  assert.equal(released, 0);
  renderer.update(undefined, undefined, 3);
  assert.equal(exterior.parent, null);
  assert.equal(released, 1);
});

test('the EMP retains the gate hangar until the reunion ends', t => {
  mockRoomTextures(t);
  const scene = new THREE.Scene(), renderer = new FilmSetRenderer(scene);
  t.after(() => renderer.dispose());
  const world = new WorldState(); new AgentManager(world).initializeAllAgents();
  const kid = world.agents.get('kid')!, link = world.agents.get('link')!;
  Object.assign(kid, { position: filmPosition('film_zion_hangar', 0, -32), isInMatrix: false, currentLocation: 'film_zion_hangar' });
  Object.assign(link, { position: filmPosition('film_hammer_deck', -2.8, -16), isInMatrix: false, currentLocation: 'film_hammer_deck' });
  const journey = { ...saved(0), scene: 'm3_gate', actor: 'kid', step: 3 };
  delete journey.emp;
  const sandbox = { neoLife: { journey } } as SandboxState;
  renderer.update(kid, sandbox, 0, kid.position);
  const dock = renderer.root.getObjectByName('zion-homecoming-set')!;
  const gangway = dock.getObjectByName('zion-ship-gangway') as THREE.Mesh;
  const gangwayOrigin = gangway.getWorldPosition(new THREE.Vector3());
  let releases = 0;
  gangway.geometry.addEventListener('dispose', () => { releases++; });

  Object.assign(journey, { scene: 'm3_emp', actor: 'link', step: 0 });
  renderer.update(link, sandbox, 1, link.position);
  assert.equal(releases, 0, 'boarding the Hammer must not release the dock geometry');
  assert.ok(!renderer.root.getObjectByName('zion-homecoming-set'), 'the retained hangar is outside the visible cabin');

  journey.emp = { firedAt: 12, elapsed: 1.8 }; journey.step = 1;
  link.currentAction = { type: 'idle', parameters: { dockEmp: 1.8 }, startedAt: 0, duration: 1, progress: 0 };
  renderer.update(link, sandbox, 2, link.position);
  const exterior = scene.getObjectByName('hammer-emp-dock')!;
  assert.equal(exterior.getObjectByName('zion-homecoming-set'), dock);
  assert.equal(exterior.visible, true);
  assert.deepEqual(gangway.getWorldPosition(new THREE.Vector3()).toArray(), gangwayOrigin.toArray());

  Object.assign(journey, { scene: 'm3_dock_reunion', step: 0, emp: { firedAt: 12, elapsed: 9 } });
  Object.assign(link, { position: filmPosition('film_zion_hangar', 20, 20), currentLocation: 'film_zion_hangar', currentAction: null });
  renderer.update(link, sandbox, 3, link.position);
  assert.equal(scene.getObjectByName('hammer-emp-dock'), exterior);
  assert.equal(releases, 0);
  renderer.update(undefined, undefined, 4);
  assert.equal(releases, 1);
  assert.equal(exterior.parent, null);

  Object.assign(journey, { scene: 'm3_gate', actor: 'kid', step: 3 });
  delete journey.emp;
  renderer.update(kid, sandbox, 5, kid.position);
  const pendingGangway = renderer.root.getObjectByName('zion-ship-gangway') as THREE.Mesh;
  pendingGangway.geometry.addEventListener('dispose', () => { releases++; });
  Object.assign(journey, { scene: 'm3_emp', actor: 'link', step: 0 });
  Object.assign(link, { position: filmPosition('film_hammer_deck', -2.8, -16), currentLocation: 'film_hammer_deck' });
  renderer.update(link, sandbox, 6, link.position);
  assert.equal(releases, 1);
  renderer.update(undefined, undefined, 7);
  assert.equal(releases, 2, 'leaving before the EMP releases the pending hangar');
});

test('a cold reunion builds one blackout dock and still supports older saves without EMP state', t => {
  const scene = new THREE.Scene(), renderer = new FilmSetRenderer(scene);
  t.after(() => renderer.dispose());
  const world = new WorldState(); new AgentManager(world).initializeAllAgents();
  const link = world.agents.get('link')!, journey = saved(9);
  Object.assign(journey, { scene: 'm3_dock_reunion', step: 0, dockReunion: { phase: 'ready', elapsed: 0, floor: 0 } });
  Object.assign(link, { position: filmPosition('film_zion_hangar', 20, 38), isInMatrix: false, currentLocation: 'film_zion_hangar' });
  const sandbox = { neoLife: { journey } } as SandboxState;
  renderer.update(link, sandbox, 0, link.position);
  assert.ok(scene.getObjectByName('hammer-emp-dock')?.visible);
  assert.ok(!renderer.root.getObjectByName('zion-homecoming-set'), 'a cold load cannot allocate two complete docks');
  renderer.update(undefined, undefined, 1);
  delete journey.emp;
  renderer.update(link, sandbox, 2, link.position);
  assert.ok(renderer.root.getObjectByName('zion-homecoming-set'));
  assert.equal(renderer.root.visible, true);
});

test('settled Sentinels leave the walk from the Hammer to Zee clear of feet', t => {
  const root = new THREE.Group(), renderer = new DockEmpRenderer(root);
  t.after(() => renderer.dispose());
  for (const forward of [false, true]) {
    const reunion: DockReunion = { phase: 'embrace', elapsed: 1.9, floor: 1, departure: DOCK_REUNION.departure.seconds, forward };
    const journey = { ...saved(DOCK_EMP.seconds), scene: 'm3_dock_reunion', dockReunion: reunion,
      diggers: { ...newDiggers(1), phase: 'done', damage: 3 } };
    renderer.update(journey);
    const start = dockReunionRoot({ ...reunion, phase: 'exiting', elapsed: DOCK_REUNION.exitSeconds }, 'link');
    const end = dockReunionRoot(reunion, 'link'), zee = dockReunionRoot(reunion, 'zee');
    const steps = Array.from({ length: 17 }, (_, i) => new THREE.Vector3().copy(start).lerp(end, i / 16));
    const half = new THREE.Vector3(.64, 0, .64);
    const passage = [...steps, new THREE.Vector3().copy(zee)].map(point => new THREE.Box3(
      point.clone().sub(half), point.clone().add(half).add(new THREE.Vector3(0, .42, 0))));
    for (const name of ['emp-sentinel-shells', 'emp-sentinel-faces', 'emp-sentinel-tails']) {
      const mesh = root.getObjectByName(name) as THREE.InstancedMesh;
      assert.equal(mesh.count, DOCK_EMP.count * (name.endsWith('tails') ? 72 : 1));
      assert.equal(mesh.visible, true);
      mesh.geometry.computeBoundingBox();
      const matrix = new THREE.Matrix4(), bounds = new THREE.Box3();
      for (let i = 0; i < mesh.count; i++) {
        mesh.getMatrixAt(i, matrix);
        bounds.copy(mesh.geometry.boundingBox!).applyMatrix4(matrix);
        const nearby = passage.filter(box => box.intersectsBox(bounds));
        if (!nearby.length) continue;
        assert.ok(!vertices(mesh, i).some(point => nearby.some(box => box.containsPoint(point))),
          `${name} instance ${i} crosses the ${forward ? 'forward' : 'legacy'} reunion route`);
      }
    }
  }
});

test('fuel fires light the disabled dock without restoring powered fixtures, and resume at the saved frame', t => {
  const root = new THREE.Group(), renderer = new DockEmpRenderer(root), state = saved(9);
  state.diggers = { ...newDiggers(), phase: 'done', damage: 3 };
  t.after(() => renderer.dispose()); renderer.update(state);
  const fire = root.getObjectByName('emp-dock-fuel-fires'); assert.ok(fire, 'the blackout needs visible non-electrical light sources');
  const lights: THREE.PointLight[] = [];
  renderer.group.traverse(object => {
    if (object instanceof THREE.PointLight && object.color.getHex() === 0xff873e) lights.push(object);
  });
  assert.equal(lights.length, 2); assert.ok(lights.every(light => light.visible && light.intensity > 0));
  const powered: THREE.PointLight[] = [];
  root.getObjectByName('zion-homecoming-set')!.traverseVisible(object => { if (object instanceof THREE.PointLight && object.intensity > 0) powered.push(object); });
  assert.equal(powered.length, 0);
  const flame = fire.getObjectByName('emp-fuel-flames') as THREE.InstancedMesh;
  assert.ok(flame?.count); const matrices = [...flame.instanceMatrix.array];
  const coldRoot = new THREE.Group(), cold = new DockEmpRenderer(coldRoot); t.after(() => cold.dispose());
  cold.update(structuredClone(state));
  assert.deepEqual([...(coldRoot.getObjectByName('emp-fuel-flames') as THREE.InstancedMesh).instanceMatrix.array], matrices);
  assert.equal((coldRoot.getObjectByName('emp-fuel-flames') as THREE.InstancedMesh<THREE.PlaneGeometry, THREE.ShaderMaterial>).material.uniforms.time.value,
    (flame.material as THREE.ShaderMaterial).uniforms.time.value);
  state.emp!.elapsed = 0; renderer.update(state); assert.equal(fire.visible, false, 'new crash fires cannot precede the impact');
  assert.ok(lights.every(light => light.visible && light.intensity === 0), 'the fuel lights occupy slots without illuminating the flash');
});
