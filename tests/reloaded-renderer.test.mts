import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { FILM_SETS, RELOADED, newReloaded, reloadedRoot, filmPosition, playerBlocked, type FilmJourney, type SandboxState } from '@auto_matrix/shared';
import { FilmSetRenderer } from '../packages/client/src/engine/FilmSetRenderer.js';
import { LightCulling } from '../packages/client/src/engine/LightCulling.js';
import { AgentRenderer } from '../packages/client/src/agents/AgentRenderer.js';
import { ReloadedOpeningRenderer } from '../packages/client/src/engine/ReloadedOpeningRenderer.js';
import { reloadedCamera } from '../packages/client/src/player/ReloadedCamera.js';
import { EpilogueHeads } from '../packages/client/src/agents/EpilogueHeads.js';
import type { CharacterRig } from '../packages/client/src/agents/CharacterModel.js';
import { AgentManager } from '../packages/server/src/agents/AgentManager.js';
import { WorldState } from '../packages/server/src/world/WorldState.js';

const journey = (kind: 'dream' | 'meeting'): FilmJourney => ({ version: 1, scene: kind === 'dream' ? 'm2_dream' : 'm2_meeting', actor: kind === 'dream' ? 'trinity' : 'neo', step: 0, completed: [], enteredAt: 0, checkpoint: { x: 0, y: 0, z: 0 }, reflections: {}, lastText: '', reloaded: newReloaded(kind) });

test('meeting geometry leaves the central passage and both evacuation exits traversable', () => {
  const set = FILM_SETS.film_captains_meeting;
  for (let z = -32; z <= 13; z += .5) assert.equal(playerBlocked(filmPosition(set.id, 0, z), true), false, `central aisle ${z}`);
  for (const side of [-1, 1]) for (let x = 0; x <= 21; x += .5) assert.equal(playerBlocked(filmPosition(set.id, side * x, 28), true), false, `exit ${side * x}`);
  assert.equal(playerBlocked(filmPosition(set.id, 0, 20), true), true, 'the visible folding table has collision');
  assert.equal(playerBlocked(filmPosition(set.id, 13, 8), true), true, 'brick walls have collision');
  const state = { ...newReloaded('meeting'), phase: 'report' as const };
  for (const role of ['trinity', 'morpheus', 'niobe', 'ballard', 'ghost', 'soren']) {
    const actor = reloadedRoot(state, role); const dx = -actor.x; const dz = 20 - actor.z;
    assert.ok((Math.sin(actor.yaw) * dx + Math.cos(actor.yaw) * dz) / Math.hypot(dx, dz) > .95, `${role} must face the briefing table`);
    for (const exit of ['east', 'west'] as const) for (let frame = 0; frame <= RELOADED.evacuation * 20; frame++) {
      const point = reloadedRoot({ ...state, phase: 'breach', exit, evacuation: frame / 20 }, role);
      assert.equal(playerBlocked(filmPosition(set.id, point.x, point.z), true, .75), false, `${role} clips the ${exit} exit at ${frame / 20}s`);
    }
  }
  for (const role of RELOADED.agents) {
    const waiting = reloadedRoot({ ...state, phase: 'breach', elapsed: 1 }, role);
    assert.ok(waiting.z < -22, 'agents wait outside until the iron door gives way');
    for (let elapsed = 0; elapsed <= RELOADED.breach; elapsed += .05) {
      const entering = reloadedRoot({ ...state, phase: 'breach', elapsed }, role);
      assert.equal(playerBlocked(filmPosition(set.id, entering.x, entering.z), true), false, 'agents enter through the opening, not the brickwork');
    }
  }
});

test('renderer uses saved dream time, opens the real door and releases all owned GPU resources', () => {
  for (const set of ['film_trinity_roof', 'film_captains_meeting', 'film_neb_deck'] as const) {
    const root = new THREE.Group(); root.position.set(5000, 1, 5000); root.updateMatrixWorld(true);
    const renderer = new ReloadedOpeningRenderer(root, set); const state = journey(set === 'film_trinity_roof' ? 'dream' : 'meeting');
    const disposals: string[] = []; renderer.group.traverse(object => { if (object instanceof THREE.Mesh) object.geometry.addEventListener('dispose', () => disposals.push(object.uuid)); });
    if (set === 'film_trinity_roof') {
      state.reloaded!.phase = 'falling'; state.reloaded!.elapsed = 3.2; renderer.update(state);
      assert.equal(renderer.group.getObjectByName('dream-intact-window')!.visible, false);
      const shards = renderer.group.getObjectByName('dream-glass-shards')!; const before = shards.children.map(child => child.position.clone()); renderer.update(structuredClone(state));
      shards.children.forEach((child, i) => assert.ok(child.position.equals(before[i]), 'pause does not advance glass'));
    } else if (set === 'film_captains_meeting') {
      state.reloaded!.phase = 'combat'; renderer.update(state); assert.ok(Math.abs(renderer.group.getObjectByName('captains-entry-door')!.rotation.y) > 1);
    }
    const bounds = new THREE.Box3().setFromObject(root); assert.ok(bounds.min.x > 4900 && bounds.max.x < 5100, 'batching must not apply the world origin twice');
    renderer.dispose(); assert.equal(root.children.length, 0); assert.ok(disposals.length > 0);
  }
});

test('the pursuer crosses the broken middle pane after Trinity and clears the fixed frame', t => {
  const view = new ReloadedOpeningRenderer(new THREE.Group(), 'film_trinity_roof');
  t.after(() => view.dispose());
  const state = journey('dream'), dream = state.reloaded!;
  dream.phase = 'breaking'; dream.actionStart = { x: .7, y: 0, z: -12.6, yaw: Math.PI };
  const window = view.group.getObjectByName('dream-intact-window')!;
  const shards = view.group.getObjectByName('dream-glass-shards')!;
  const atWindow = (x: number, y: number) => {
    const ray = new THREE.Raycaster(new THREE.Vector3(x, y, window.position.z - 2), new THREE.Vector3(0, 0, 1), 0, 4);
    const meshes: THREE.Object3D[] = [];
    view.group.traverseVisible(object => { if (object instanceof THREE.Mesh && object.parent !== shards) meshes.push(object); });
    return ray.intersectObjects(meshes, false);
  };
  dream.elapsed = .25; view.update(state); view.group.updateMatrixWorld(true);
  assert.ok(reloadedRoot(dream, 'agent_johnson').z > window.position.z + 2, 'Johnson must start inside the maintenance level');
  assert.equal(window.visible, true); assert.equal(shards.visible, false);
  assert.ok(atWindow(0, 3).some(hit => hit.object === window));

  dream.elapsed = .64; view.update(state); view.group.updateMatrixWorld(true);
  assert.ok(reloadedRoot(dream, 'trinity').z < window.position.z);
  assert.ok(reloadedRoot(dream, 'agent_johnson').z > window.position.z);
  assert.equal(window.visible, false); assert.equal(shards.visible, true);
  for (const y of [1, 3, 6]) assert.equal(atWindow(0, y).length, 0, `the cleared opening at y=${y}`);
  for (const x of [-8, 8]) assert.ok(atWindow(x, 3).length, 'adjacent panes stay in place');

  dream.elapsed = RELOADED.breakGlass;
  const leaving = reloadedRoot(dream, 'agent_johnson');
  assert.ok(leaving.z < window.position.z);
  assert.deepEqual(reloadedRoot({ ...dream, phase: 'falling', elapsed: 0 }, 'agent_johnson'), leaving);
});

test('fall cameras remain outside the facade and first person turns with the input heading', () => {
  const state = { ...newReloaded('dream'), phase: 'falling' as const, elapsed: 4, drift: 2 };
  const root = reloadedRoot(state, 'trinity'); const position = filmPosition(root.set, root.x, root.z); position.y += root.y;
  for (const aspect of [16 / 9, 9 / 16]) {
    const camera = reloadedCamera({ ...state, role: 'trinity' }, position, root.set, false, aspect, 0, 0);
    assert.ok(camera.eye.z < FILM_SETS[root.set].center.z - 20); assert.ok(camera.eye.distanceTo(camera.target) > 8);
  }
  const a = reloadedCamera({ ...state, role: 'trinity' }, position, root.set, true, 1, 0, 0);
  const b = reloadedCamera({ ...state, role: 'trinity' }, position, root.set, true, 1, Math.PI / 2, .2);
  assert.ok(a.eye.equals(b.eye)); assert.ok(a.target.distanceTo(b.target) > 1);
  assert.ok(a.target.z > a.eye.z); assert.ok(b.target.x > b.eye.x); assert.ok(b.target.y < b.eye.y);
});

test('dream framing keeps both Trinity and the shooting agent in view throughout the fall', () => {
  for (const elapsed of [1.3, 3.2, 5.1, 7.2]) for (const aspect of [16 / 9, 9 / 16]) {
    const state = { ...newReloaded('dream'), phase: 'falling' as const, elapsed };
    const root = reloadedRoot(state, 'trinity'); const position = filmPosition(root.set, root.x, root.z); position.y += root.y;
    const frame = reloadedCamera({ ...state, role: 'trinity' }, position, root.set, false, aspect, 0, 0);
    const camera = new THREE.PerspectiveCamera(60, aspect, .1, 300); camera.position.copy(frame.eye); camera.lookAt(frame.target); camera.updateMatrixWorld(true);
    for (const role of ['trinity', 'agent_johnson']) {
      const body = reloadedRoot(state, role); const p = filmPosition(body.set, body.x, body.z); p.y += body.y + 2;
      const screen = new THREE.Vector3(p.x, p.y, p.z).project(camera);
      assert.ok(Math.abs(screen.x) < .88 && Math.abs(screen.y) < .88, `${role} outside framing at ${elapsed}, ${aspect}: ${screen.toArray()}`);
    }
  }
});

test('the departure camera stays outside the vault from liftoff to the end', () => {
  const set = FILM_SETS.film_captains_meeting;
  for (const [phase, elapsed] of [['departing', 0], ['departing', 1.6], ['done', 0]] as const) {
    const state = { ...newReloaded('meeting'), phase, elapsed };
    const root = reloadedRoot(state, 'neo'); const position = filmPosition(root.set, root.x, root.z); position.y += root.y;
    for (const aspect of [16 / 9, 9 / 16]) {
      const view = reloadedCamera({ ...state, role: 'neo' }, position, root.set, false, aspect, 0, 0);
      assert.ok(view.eye.z < set.center.z - 21 && view.target.z < set.center.z - 21, 'the vault cannot obscure the ascent');
    }
  }
});

test('the final flight prepares the real dream roof and its cast before Trinity takes over', t => {
  const scene = new THREE.Scene(), sets = new FilmSetRenderer(scene), world = new WorldState();
  new AgentManager(world).initializeAllAgents();
  const neo = world.agents.get('neo')!, trinity = world.agents.get('trinity')!;
  const flight: FilmJourney = { ...journey('dream'), scene: 'm1_final_call', actor: 'neo', reloaded: undefined,
    theOne: { kind: 'flight', phase: 'takeoff', elapsed: 3.2, attempt: 0, checkpoint: 'phone',
      signal: 0, hits: 0, blocks: 0, deadline: 0, altitude: 12, flightX: 4, flightZ: 2, resolved: [] } };
  const sandbox = { neoLife: { journey: flight } } as SandboxState;
  neo.position = filmPosition('film_final_phone');
  neo.isInMatrix = trinity.isInMatrix = true;
  trinity.position = filmPosition('film_trinity_roof');
  const sun = new THREE.DirectionalLight(), camera = new THREE.PerspectiveCamera();
  scene.add(sun, new THREE.DirectionalLight(), new THREE.HemisphereLight());
  const geometry = new THREE.BoxGeometry(), skin = new THREE.Texture({ width: 2048, height: 2048 });
  skin.needsUpdate = true;
  const material = new THREE.MeshStandardMaterial({ map: skin }), actor = new THREE.Group();
  const mesh = new THREE.Mesh(geometry, material); actor.add(mesh); actor.visible = mesh.visible = false;
  t.after(() => { sets.dispose(); geometry.dispose(); material.dispose(); skin.dispose(); });
  let window: THREE.Object3D | undefined, target: THREE.WebGLRenderTarget | null = null;
  const uploads: THREE.Texture[] = [];
  let compiledCast = false;
  const graphics = { extensions: { has: () => true }, properties: { get: () => ({}) }, info: { programs: [] },
    getRenderTarget: () => target, setRenderTarget(value: typeof target) { target = value; },
    initTexture(map: THREE.Texture) { uploads.push(map); },
    compile(subject: THREE.Group, _camera: THREE.Camera, lights: THREE.Scene) {
      assert.equal(target?.width, 1);
      let points = 0;
      lights.traverseVisible(object => {
        if (object instanceof THREE.PointLight) points++;
        if (object.name === 'dream-intact-window') window = object;
      });
      assert.equal(points, 7);
      subject.traverse(object => { if (object === mesh) compiledCast = true; });
    } } as unknown as THREE.WebGLRenderer;
  const prepare = () => sets.prepareDream?.(graphics, camera, flight, id => ({ model: id === 'trinity' ? actor : undefined }), sun);

  for (let frame = 0; frame < 40; frame++) prepare();
  assert.ok(window, 'the roof must be prepared while the final flight is still paused on the landing screen');
  assert.ok(!scene.getObjectByName('dream-intact-window'));
  assert.equal(compiledCast, true);
  assert.deepEqual(uploads, [skin]);
  const preparedWindow = window;
  sets.update(neo, sandbox, 0);
  prepare();
  assert.equal(window, preparedWindow);
  assert.equal(actor.visible, false);
  assert.equal(mesh.visible, false);

  sandbox.neoLife!.journey = journey('dream');
  sets.update(trinity, sandbox, 1);
  assert.equal(scene.getObjectByName('dream-intact-window'), preparedWindow);
  assert.equal(sets.minimumPointSlots, 7);
  let released = 0;
  (preparedWindow as THREE.Mesh).geometry.addEventListener('dispose', () => { released++; });
  sets.update(undefined, undefined, 2);
  assert.equal(released, 1);
});

test('the end of the dream prepares the cabin and Neo under the waking light layout', t => {
  const scene = new THREE.Scene(), sets = new FilmSetRenderer(scene), world = new WorldState();
  new AgentManager(world).initializeAllAgents();
  const neo = world.agents.get('neo')!, trinity = world.agents.get('trinity')!;
  const state = journey('dream'), sandbox = { neoLife: { journey: state } } as SandboxState;
  trinity.position = filmPosition('film_trinity_roof'); trinity.isInMatrix = true;
  neo.position = filmPosition('film_neb_deck', 12.5, 32); neo.isInMatrix = false;
  const sun = new THREE.DirectionalLight(), camera = new THREE.PerspectiveCamera();
  scene.add(sun, new THREE.DirectionalLight(), new THREE.HemisphereLight());
  const geometry = new THREE.BoxGeometry(), skin = new THREE.Texture({ width: 2048, height: 2048 });
  skin.needsUpdate = true;
  const material = new THREE.MeshStandardMaterial({ map: skin }), actor = new THREE.Group();
  const mesh = new THREE.Mesh(geometry, material); mesh.name = 'Anatomical_head_and_hands'; actor.add(mesh); actor.visible = false;
  t.after(() => { sets.dispose(); geometry.dispose(); material.dispose(); skin.dispose(); });
  let grating: THREE.Mesh | undefined, face = false;
  const uploads: THREE.Texture[] = [];
  const graphics = { extensions: { has: () => true }, properties: { get: () => ({}) }, info: { programs: [] },
    getRenderTarget: () => null, getActiveCubeFace: () => 0, getActiveMipmapLevel: () => 0,
    setRenderTarget() {}, render() {}, initTexture(map: THREE.Texture) { uploads.push(map); },
    compile(subject: THREE.Group, _camera: THREE.Camera, lights: THREE.Scene) {
      let points = 0;
      lights.traverseVisible(object => { if (object instanceof THREE.PointLight) points++; });
      assert.equal(points, 16);
      subject.traverse(object => {
        if (object instanceof THREE.Mesh && object.name === 'neb-cabin-grating') grating = object;
        if (object === mesh) face = true;
      });
    } } as unknown as THREE.WebGLRenderer;
  const prepare = () => sets.prepareMeetingWake?.(graphics, camera, state, id => ({ model: id === 'neo' ? actor : undefined }), sun);
  state.reloaded!.phase = 'falling'; state.reloaded!.elapsed = 3.2;
  for (let frame = 0; frame < 20; frame++) prepare();
  assert.deepEqual(uploads, []);
  assert.equal(grating, undefined);
  state.reloaded!.phase = 'dream_hit';
  for (let frame = 0; frame < 120; frame++) prepare();
  assert.ok(grating, 'the waking cabin must be prepared before admitting the saved dream');
  assert.equal(face, true);
  assert.deepEqual(uploads, [skin]);
  assert.equal(actor.visible, false);
  sets.update(trinity, sandbox, 1);
  assert.ok(!scene.getObjectByName('neb-cabin-grating'));

  const wake = journey('meeting'); wake.reloaded!.phase = 'waking';
  sandbox.neoLife!.journey = wake;
  sets.update(neo, sandbox, 2);
  assert.equal(scene.getObjectByName('neb-cabin-grating'), grating);
  assert.ok(scene.getObjectByName('reloaded-opening-set'));
  let released = 0;
  grating.geometry.addEventListener('dispose', () => { released++; });
  sets.update(undefined, undefined, 3);
  assert.equal(released, 1);
});

test('the meeting adopts the prepared hall and warms the breach cast with the live light slots', t => {
  const scene = new THREE.Scene(), sets = new FilmSetRenderer(scene), world = new WorldState();
  new AgentManager(world).initializeAllAgents();
  const neo = world.agents.get('neo')!, state = journey('meeting');
  const sandbox = { neoLife: { journey: state } } as SandboxState;
  neo.position = filmPosition('film_neb_deck', -7, 25.7); neo.isInMatrix = false;
  state.reloaded!.phase = 'connecting'; sets.update(neo, sandbox, 0);
  const geometry = new THREE.BoxGeometry(), material = new THREE.MeshStandardMaterial();
  const actor = new THREE.Group(), enemy = new THREE.Mesh(geometry, material); actor.add(enemy);
  t.after(() => { sets.dispose(); geometry.dispose(); material.dispose(); });
  let preview: THREE.Scene | undefined, door: THREE.Object3D | undefined, enemySlots: number | undefined;
  const pointSlots = (root: THREE.Scene) => {
    let count = 0;
    root.traverseVisible(object => { if (object instanceof THREE.PointLight) count++; });
    return count;
  };
  const graphics = { extensions: { has: () => true }, info: { programs: [] }, getRenderTarget: () => null,
    setRenderTarget() {}, properties: { get: () => ({}) },
    compile(subject: THREE.Group, _camera: THREE.Camera, target: THREE.Scene) {
      target.traverseVisible(object => { if (object.name === 'captains-entry-door') { preview = target; door = object; } });
      subject.traverse(object => { if (object === enemy) enemySlots = pointSlots(target); });
    } } as unknown as THREE.WebGLRenderer;
  const camera = new THREE.PerspectiveCamera();
  const prepare = () => sets.prepareCaptainsMeeting(graphics, camera, state, id => id === 'agent_thompson' ? actor : undefined);
  prepare();
  assert.ok(door && !scene.getObjectByName(door.name));
  assert.equal(pointSlots(preview!), 9);

  state.reloaded!.phase = 'report_ready'; neo.position = filmPosition('film_captains_meeting', 0, 31); neo.isInMatrix = true;
  sets.update(neo, sandbox, 1);
  assert.ok(scene.getObjectByName(door.name) === door);
  assert.equal(sets.stablePointSlots, true);
  assert.equal(pointSlots(scene), 9);
  state.reloaded!.phase = 'earpiece_ready';
  prepare(); assert.equal(enemySlots, 9);
  state.reloaded!.phase = 'combat'; sets.update(neo, sandbox, 2);
  assert.ok(door.rotation.y > 1);
});

test('the ship connection prepares hidden Matrix clothing, both depth layouts and late hall heads', t => {
  const scene = new THREE.Scene(), sets = new FilmSetRenderer(scene), lighting = new LightCulling(scene);
  lighting.minimumPointSlots = 16;
  const sun = new THREE.DirectionalLight(); sun.castShadow = true; scene.add(sun);
  const world = new WorldState(); new AgentManager(world).initializeAllAgents();
  const neo = world.agents.get('neo')!, state = journey('meeting'); state.reloaded!.phase = 'connecting';
  const sandbox = { neoLife: { journey: state } } as SandboxState;
  neo.position = filmPosition('film_neb_deck', -7, 25.7); neo.isInMatrix = false; sets.update(neo, sandbox, 0);
  const actor = new THREE.Group(), geometry = new THREE.BoxGeometry(), material = new THREE.MeshStandardMaterial();
  const coat = new THREE.SkinnedMesh(geometry, material); coat.name = 'Tailored_coat_upper'; coat.castShadow = true;
  const shadowMaterial = new THREE.MeshBasicMaterial({ transparent: true, toneMapped: false });
  const shadow = new THREE.Mesh(geometry, shadowMaterial);
  actor.visible = coat.visible = false; actor.add(coat);
  const compiled = new Set<THREE.Object3D>(), depths = new Set<THREE.MeshDepthMaterial>(), depthSlots = new Set<number>();
  let marker = false;
  const graphics = { extensions: { has: () => true }, info: { programs: [] }, properties: { get: () => ({}) },
    shadowMap: { enabled: true, type: THREE.PCFSoftShadowMap }, getRenderTarget: () => null, setRenderTarget() {},
    compile(subject: THREE.Object3D, _camera: THREE.Camera, target: THREE.Scene) {
      let slots = 0; target.traverseVisible(object => { if (object instanceof THREE.PointLight) slots++; });
      subject.traverse(object => {
        compiled.add(object); if (object === sets.goalMarker) marker = true;
        if (object instanceof THREE.Mesh && object.material instanceof THREE.MeshDepthMaterial) {
          depths.add(object.material); depthSlots.add(slots);
        }
      });
    } } as unknown as THREE.WebGLRenderer;
  const camera = new THREE.PerspectiveCamera(), prepare = () => sets.prepareCaptainsMeeting(graphics, camera, state,
    id => id === 'neo' ? actor : undefined, sun, lighting, false, shadow);
  t.after(() => { sets.dispose(); lighting.dispose(); geometry.dispose(); material.dispose(); shadowMaterial.dispose(); });
  for (let i = 0; i < 100; i++) prepare();
  assert.ok(compiled.has(coat), 'the Matrix coat is hidden by the live ship costume');
  assert.deepEqual([...depthSlots].sort((a, b) => a - b), [9, 16]);
  assert.ok(marker, 'the goal marker must not wait until the hall entry');
  assert.ok(compiled.has(shadow), 'the shared ground shadow has a different unlit program from the marker');
  assert.equal(actor.visible, false); assert.equal(coat.visible, false); assert.equal(coat.parent, actor);
  const normals = sets.meetingEntryNormalMeshes;
  const late = new THREE.SkinnedMesh(geometry, material); late.name = 'Anatomical_head_and_hands'; actor.add(late);
  for (let i = 0; i < 20; i++) prepare();
  assert.ok(compiled.has(late), 'a head arriving in an already-seen actor still needs its program');
  assert.ok(sets.meetingEntryNormalMeshes?.includes(late)); assert.notEqual(sets.meetingEntryNormalMeshes, normals);
  assert.equal(state.reloaded!.phase, 'connecting'); assert.equal(state.reloaded!.elapsed, 0);
  let released = 0; for (const depth of depths) depth.addEventListener('dispose', () => released++);
  state.reloaded!.phase = 'report_ready'; neo.position = filmPosition('film_captains_meeting', 0, 31); neo.isInMatrix = true;
  sets.update(neo, sandbox, 1); assert.ok(scene.getObjectByName('captains-entry-door')); assert.equal(released, 0);
  sets.update(undefined, undefined, 2); assert.equal(released, depths.size);
});

test('the meeting defers offscreen skin shading and resumes it when the camera turns', t => {
  const originalDocument = globalThis.document;
  const context = { createRadialGradient: () => ({ addColorStop() {} }), fillRect() {}, strokeRect() {}, fillText() {},
    createImageData: (width: number, height: number) => ({ data: new Uint8ClampedArray(width * height * 4) }), putImageData() {} };
  globalThis.document = { createElement: () => ({ width: 0, height: 0, getContext: () => context }) } as unknown as Document;
  t.mock.method(THREE.TextureLoader.prototype, 'load', () => new THREE.Texture());
  const renderer = new AgentRenderer(new THREE.Scene());
  t.after(() => { renderer.dispose(); globalThis.document = originalDocument; });
  const world = new WorldState(); new AgentManager(world).initializeAllAgents();
  const neo = world.agents.get('neo')!, persephone = world.agents.get('persephone')!;
  neo.position = filmPosition('film_captains_meeting', 0, 2); neo.isInMatrix = true; neo.currentLocation = 'film_captains_meeting';
  const observer = world.agents.get('citizen_1')!;
  observer.position = filmPosition('film_captains_meeting', 8, 28); observer.isInMatrix = true; observer.currentLocation = 'film_captains_meeting';
  for (const actor of [neo, observer, persephone]) renderer.updateAgent(actor.id, actor);
  renderer.setPlayer('neo');
  const observerBody = renderer.getAgentBody(observer.id);
  const flags: boolean[] = [];
  t.mock.method(renderer['models'], 'animate', (rig, _delta, input) => {
    if (rig.root === observerBody) flags.push(Boolean(input.skipSkinContinuity));
  });
  const state = journey('meeting'); state.reloaded!.phase = 'combat';
  const camera = new THREE.PerspectiveCamera(60, 16 / 9, .1, 120);
  camera.position.copy(filmPosition('film_captains_meeting', 0, 2)); camera.position.y += 3;
  camera.lookAt(camera.position.x, camera.position.y, camera.position.z - 10); renderer.update(.02, camera, 1, 0, state);
  assert.equal(renderer.getAgent(observer.id)?.visible, true);
  assert.equal(renderer.getAgent(persephone.id)?.visible, false, 'the hall draws only its own occupants');
  camera.lookAt(observer.position.x, observer.position.y + 2, observer.position.z); renderer.update(.02, camera, 1, 0, state);
  assert.deepEqual(flags, [true, false]);
  renderer.update(.02, camera, 1, 0);
  assert.equal(renderer.getAgent(persephone.id)?.visible, true, 'other routes recover the normal Matrix view');
});

test('leaving the captains hall prepares Kid at the next real-world dock without revealing him', t => {
  const originalDocument = globalThis.document;
  const context = { createRadialGradient: () => ({ addColorStop() {} }), fillRect() {}, strokeRect() {}, fillText() {},
    createImageData: (width: number, height: number) => ({ data: new Uint8ClampedArray(width * height * 4) }), putImageData() {} };
  globalThis.document = { createElement: () => ({ width: 0, height: 0, getContext: () => context }) } as unknown as Document;
  t.mock.method(THREE.TextureLoader.prototype, 'load', () => new THREE.Texture());
  const renderer = new AgentRenderer(new THREE.Scene());
  t.after(() => { renderer.dispose(); globalThis.document = originalDocument; });
  t.mock.method(renderer['models'], 'requestHero', () => {});
  const world = new WorldState(); new AgentManager(world).initializeAllAgents();
  const neo = world.agents.get('neo')!, kid = world.agents.get('kid')!;
  neo.position = filmPosition('film_captains_meeting', 0, -24); neo.currentLocation = 'film_captains_meeting'; neo.isInMatrix = true;
  kid.position = filmPosition('film_zion_hangar', -5, -28); kid.currentLocation = 'film_zion_hangar'; kid.isInMatrix = false;
  const lock = world.agents.get('lock')!, niobe = world.agents.get('niobe')!;
  for (const actor of [neo, kid, lock, niobe]) renderer.updateAgent(actor.id, actor);
  renderer.setPlayer('neo'); renderer.setWorld(true);
  const body = renderer.getAgentBody(kid.id), prepared: boolean[] = [], council: Record<string, boolean[]> = { lock: [], niobe: [] };
  t.mock.method(renderer['models'], 'animate', (rig, _delta, input) => {
    if (rig.root === body) prepared.push(Boolean(input.prepareDetailedCast));
    for (const id of ['lock', 'niobe']) if (rig.root === renderer.getAgentBody(id)) council[id].push(Boolean(input.prepareDetailedCast));
  });
  const state = journey('meeting'), camera = new THREE.PerspectiveCamera(); camera.position.copy(neo.position);
  state.step = 3; renderer.update(.02, camera, 1, 0, state);
  state.step = 4; renderer.update(.02, camera, 1, 0, state);
  assert.equal(renderer.getAgent('kid')?.visible, false, 'the next world must remain hidden during the Matrix escape');
  state.visiting = 'm2_meeting'; renderer.update(.02, camera, 1, 0, state);
  delete state.visiting; renderer.setPlayer('kid'); renderer.update(.02, camera, 1, 0, state);
  assert.deepEqual(prepared, [false, true, false, false]);
  renderer.setPlayer('neo'); renderer.setWorld(false); neo.isInMatrix = false;
  neo.position = filmPosition('film_zion_hangar', 11, -15); neo.currentLocation = 'film_zion_hangar'; renderer.updateAgent('neo', neo);
  Object.assign(state, { scene: 'm2_dock', step: 1 });
  for (const id of ['lock', 'niobe']) council[id] = [];
  renderer.update(.02, camera, 1, 0, state);
  state.step = 2; renderer.update(.02, camera, 1, 0, state);
  state.visiting = 'm2_dock'; renderer.update(.02, camera, 1, 0, state);
  delete state.visiting; renderer.setPlayer('kid'); renderer.update(.02, camera, 1, 0, state);
  for (const id of ['lock', 'niobe']) assert.deepEqual(council[id], [false, true, false, false], `${id} must prepare before entering the council`);
});

test('Niobe can request her next real-world head while her saved body is still in the Matrix', t => {
  const requested: string[] = [];
  t.mock.method(GLTFLoader.prototype, 'loadAsync', url => { requested.push(String(url)); return new Promise(() => {}); });
  const heads = new EpilogueHeads(), root = new THREE.Group(), head = new THREE.Group(); root.add(head);
  const rig = { root, head } as CharacterRig; heads.track(rig, 'niobe'); t.after(() => heads.dispose());
  const input = { speed: 0, grounded: true, verticalVelocity: 0, turn: 0, realWorld: false };
  heads.update(rig, input); assert.deepEqual(requested, []);
  heads.update(rig, { ...input, prepareDetailedCast: true });
  assert.deepEqual(requested, ['/assets/characters/niobe-head.glb']);
  heads.update(rig, input); assert.equal(requested.length, 1, 'the saved Matrix body cannot request a duplicate head');
});

test('the château garage renders local riders and Twins while keeping other sets out of the draw', t => {
  const originalDocument = globalThis.document;
  const context = { createRadialGradient: () => ({ addColorStop() {} }), fillRect() {}, strokeRect() {}, fillText() {},
    createImageData: (width: number, height: number) => ({ data: new Uint8ClampedArray(width * height * 4) }), putImageData() {} };
  globalThis.document = { createElement: () => ({ width: 0, height: 0, getContext: () => context }) } as unknown as Document;
  t.mock.method(THREE.TextureLoader.prototype, 'load', () => new THREE.Texture());
  const renderer = new AgentRenderer(new THREE.Scene());
  t.after(() => { renderer.dispose(); globalThis.document = originalDocument; });
  t.mock.method(renderer['models'], 'requestHero', () => {});
  t.mock.method(renderer['models'], 'animate', () => {});
  const world = new WorldState(); new AgentManager(world).initializeAllAgents();
  const garage = 'film_chateau_garage', occupants = ['trinity', 'morpheus', 'keymaker', 'twin1', 'twin2'];
  for (const [index, id] of occupants.entries()) {
    const actor = world.agents.get(id)!;
    Object.assign(actor, { position: filmPosition(garage, index, 14), currentLocation: garage, isInMatrix: true });
    renderer.updateAgent(id, actor);
  }
  const jones = world.agents.get('agent_jones')!;
  Object.assign(jones, { position: filmPosition('film_heart_hotel'), currentLocation: 'film_heart_hotel', isInMatrix: true });
  renderer.updateAgent(jones.id, jones);
  renderer.setPlayer('trinity');
  const state: FilmJourney = { ...journey('dream'), scene: 'm2_garage', reloaded: undefined };
  const camera = new THREE.PerspectiveCamera(60, 16 / 9, .1, 3000);
  camera.position.copy(filmPosition(garage, 0, 19));
  renderer.update(.02, camera, 1, 0, state);
  assert.equal(renderer.getAgent(jones.id)?.visible, false, 'the hotel cast stays out of the garage render and its shadows');
  assert(occupants.every(id => renderer.getAgent(id)?.visible), 'keep all garage cast visible');
  renderer.update(.02, camera, 1, 0, { ...state, scene: 'm2_freeway' });
  assert.equal(renderer.getAgent(jones.id)?.visible, true, 'leaving the garage restores ordinary visibility');
});

test('completed scene revisits retain their environment without replaying the current encounter', () => {
  const renderer = new ReloadedOpeningRenderer(new THREE.Group(), 'film_captains_meeting');
  const current = journey('dream'); current.visiting = 'm2_meeting';
  const saved = structuredClone(current); renderer.update(current);
  assert.equal(renderer.group.visible, true, 'the meeting hall must not disappear during a revisit');
  assert.ok(Math.abs(renderer.group.getObjectByName('captains-entry-door')!.rotation.y) > 1);
  assert.deepEqual(current, saved, 'rendering a revisit cannot alter the saved journey');
  renderer.dispose();
});
