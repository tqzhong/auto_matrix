import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import test, { beforeEach } from 'node:test';
import * as THREE from 'three';
import { FILM_SETS, TRUCKS, FREEWAY_PICKUP, filmObstacles, filmPosition, truckApproachPose, newFreewayPickup, stepFreewayPickup, newTruckHood, type FilmJourney, type SandboxState } from '@auto_matrix/shared';
import { FreewaySetRenderer } from '../packages/client/src/engine/FreewaySetRenderer.js';
import { newFreewayRide, freewayRideRoot, stepFreeway, freewayPursuitVehicles } from '@auto_matrix/shared';
import { FilmSetRenderer } from '../packages/client/src/engine/FilmSetRenderer.js';
import { WorldState } from '../packages/server/src/world/WorldState.js';
import { AgentManager } from '../packages/server/src/agents/AgentManager.js';
import { AgentRenderer } from '../packages/client/src/agents/AgentRenderer.js';

const canvasDocument = () => ({ createElement: () => ({ width: 0, height: 0, getContext: () => ({
  createImageData: (width: number, height: number) => ({ data: new Uint8ClampedArray(width * height * 4) }),
  putImageData() {}, fillRect() {}, strokeRect() {}, fillText() {},
  createRadialGradient: () => ({ addColorStop() {} }),
  createLinearGradient: () => ({ addColorStop() {} }),
}) }) }) as unknown as Document;
beforeEach(t => { t.mock.method(THREE.TextureLoader.prototype, 'load', () => new THREE.Texture()); });
const journey = (): FilmJourney => ({ version: 1, scene: 'm2_trucks', actor: 'morpheus', step: 1,
  completed: [], enteredAt: 0, checkpoint: filmPosition('film_freeway_trucks'), reflections: {}, lastText: '',
  trucks: { phase: 'collision', elapsed: 9.9, lastTick: 0, attempt: 0 } });

test('escort vehicle and traffic consume the same fast saved frame and reject packets from earlier rides', t => {
  const original = globalThis.document; globalThis.document = canvasDocument();
  const scene = new THREE.Scene(), renderer = new FilmSetRenderer(scene);
  t.after(() => { renderer.dispose(); globalThis.document = original; });
  const world = new WorldState(); new AgentManager(world).initializeAllAgents();
  const player = world.agents.get('trinity')!, state = { ...journey(), scene: 'm2_freeway', actor: 'trinity',
    ride: { ...newFreewayRide(), elapsed: 24, startedAt: 10 } } as FilmJourney;
  const fast = { ...state.ride!, elapsed: 25, x: 18, z: 620, lateral: 8, speed: 28, bank: .28, role: 'trinity' };
  const pose = freewayRideRoot(fast, 'trinity');
  Object.assign(player, { currentLocation: 'film_freeway_101', isInMatrix: true, position: filmPosition('film_freeway_101', pose.x, pose.z) });
  player.currentAction = { type: 'idle', parameters: { riding: true, freewayRide: fast }, startedAt: 10, duration: 1e9, progress: 0 };
  const sandbox = { neoLife: { journey: state } } as SandboxState;
  renderer.update(player, sandbox, 0, player.position);
  const bike = scene.getObjectByName('matrix-freeway-motorcycle')!, freeway = bike.parent!;
  assert.equal(bike.position.z, 620, 'the world snapshot cannot leave the bike behind the fast player frame');
  const frozen = snapshot(freeway); renderer.update(player, sandbox, 100, player.position);
  assert.equal(snapshot(freeway), frozen, 'paused traffic and bike must not advance on browser render time');
  state.ride = { ...newFreewayRide(), startedAt: 30 }; renderer.update(player, sandbox, 101, player.position);
  assert.equal(bike.position.z, state.ride.z, 'an old player packet cannot override a retried escort');
  const coldScene = new THREE.Scene(), cold = new FilmSetRenderer(coldScene); t.after(() => cold.dispose());
  state.ride = structuredClone(fast); renderer.update(player, sandbox, 102, player.position); cold.update(player, sandbox, 800, player.position);
  assert.equal(snapshot(coldScene.getObjectByName('matrix-freeway-motorcycle')!.parent!), snapshot(freeway), 'a cold renderer must draw the same saved traffic and bank');
});

function setup(t: { after: (callback: () => void) => void }) {
  const original = globalThis.document; globalThis.document = canvasDocument();
  const root = new THREE.Group(), renderer = new FreewaySetRenderer(root, FILM_SETS.film_freeway_trucks);
  t.after(() => { renderer.dispose(); globalThis.document = original; });
  return { root, renderer };
}
test('falling from Niobe’s cracked hood does not explode the trucks before their collision', t => {
  const {root,renderer}=setup(t),state=journey();
  const hood=newTruckHood({x:0,y:6.6,z:-3.5,yaw:0},{x:0,y:6.6,z:-7.5,yaw:0},100,2);
  hood.phase='failed';hood.glassAge=.2;
  for(const failure of ['balance','miss']) {
    hood.failure=failure;state.trucks={...state.trucks!,phase:'failed',hood};renderer.update(state,500);
    assert.equal(root.getObjectByName('matrix-freeway-collision')!.visible,false,'a missed car reception must not trigger the later truck explosion');
    const cracks=root.getObjectByName('niobe-windshield-cracks') as THREE.Mesh;
    assert.ok(cracks.visible&&cracks.geometry.drawRange.count>0,'the car retains its actual glass damage after the fall');
    const saved=snapshot(root),range=cracks.geometry.drawRange.count;renderer.update(state,900);
    assert.equal(snapshot(root),saved);assert.equal(cracks.geometry.drawRange.count,range,'render time must not grow paused fractures');
  }
  state.trucks={...state.trucks!,phase:'rescue',rescueElapsed:1};renderer.update(state,901);
  assert.equal(root.getObjectByName('matrix-freeway-collision')!.visible,true,'the actual subsequent collision still explodes');
});
test('the drawn passenger leaves the saved riding pose once the escort advances to the handoff step', t => {
  const original = globalThis.document; globalThis.document = canvasDocument();
  t.mock.method(THREE.TextureLoader.prototype, 'load', () => new THREE.Texture());
  const renderer = new AgentRenderer(new THREE.Scene());
  t.after(() => { renderer.dispose(); globalThis.document = original; });
  const world = new WorldState(); new AgentManager(world).initializeAllAgents(); const passenger = world.agents.get('keymaker')!;
  passenger.position = filmPosition('film_freeway_101', 20, -660); passenger.currentLocation = 'film_freeway_101'; passenger.isInMatrix = true; passenger.currentAction = null;
  const state: FilmJourney = { ...journey(), scene: 'm2_freeway', actor: 'trinity', step: 2,
    ride: { ...newFreewayRide(), x: 17.6, z: -660, phase: 'arrived', elapsed: 64 } };
  renderer.updateAgent(passenger.id, passenger); renderer.update(0, undefined, 0, 163, state);
  assert.ok(renderer.getAgent(passenger.id)!.position.distanceTo(new THREE.Vector3(passenger.position.x, passenger.position.y, passenger.position.z)) < 1e-7,
    'the old riding save cannot put the dismounted passenger back on the motorcycle');
});
test('a saved escort impact keeps the physical motorcycle outside the shield car during damage cooldown', t => {
  const original = globalThis.document; globalThis.document = canvasDocument();
  const root = new THREE.Group(), renderer = new FreewaySetRenderer(root, FILM_SETS.film_freeway_101);
  t.after(() => { renderer.dispose(); globalThis.document = original; });
  const pickup = { ...newFreewayPickup(), phase: 'done' as const, total: 24,
    chase: { phase: 'crossing' as const, elapsed: 1, truck: { x: 8.5, z: 786.9, speed: 0, yaw: 0 }, shield: { x: 6, z: 800, speed: 0 } } };
  const state: FilmJourney = { ...journey(), scene: 'm2_freeway', actor: 'trinity', step: 1, freewayPickup: pickup,
    ride: { ...newFreewayRide(), x: 6, z: 810, speed: 44, elapsed: 24, obstacles: freewayPursuitVehicles(pickup) } };
  for (let frame = 0; frame < 8; frame++) {
    state.ride = stepFreeway(state.ride!, { throttle: 1, steer: 0, brake: false }, .1); renderer.update(state, frame * .1);
    root.updateMatrixWorld(true);
    const bike = new THREE.Box3().setFromObject(root.getObjectByName('matrix-freeway-motorcycle')!), car = new THREE.Box3().setFromObject(root.getObjectByName('matrix-freeway-shield-car')!);
    assert.equal(bike.intersectsBox(car), false, 'taking damage must not leave the rendered bike inside the car');
    assert.equal(state.ride.hits, 1, 'cooldown should suppress repeated damage while preserving physical separation');
  }
});

function cabVertices(rig: THREE.Object3D): THREE.Vector3[] {
  rig.updateWorldMatrix(true, true); const points: THREE.Vector3[] = [];
  rig.getObjectByName(`${rig.name}-cab`)!.traverse(object => {
    if (!(object instanceof THREE.Mesh)) return;
    const position = object.geometry.getAttribute('position');
    for (let i = 0; i < position.count; i++) points.push(object.getVertexPosition(i, new THREE.Vector3()).applyMatrix4(object.matrixWorld));
  });
  return points;
}
function rearVertices(rig: THREE.Object3D): THREE.Vector3[] {
  rig.updateWorldMatrix(true, true); const points: THREE.Vector3[] = [];
  const inverse = rig.matrixWorld.clone().invert();
  rig.traverse(object => {
    if (!(object instanceof THREE.Mesh)) return;
    const position = object.geometry.getAttribute('position');
    for (let i = 0; i < position.count; i++) {
      const point = object.getVertexPosition(i, new THREE.Vector3()).applyMatrix4(object.matrixWorld).applyMatrix4(inverse);
      if (point.z > -6.7) points.push(point);
    }
  });
  return points;
}

test('both trailers and their chassis buckle behind the airborne passengers instead of staying rigid', t => {
  const { root, renderer } = setup(t), state = journey();
  state.trucks!.elapsed = TRUCKS.collisionSeconds; renderer.update(state, 0);
  const rigs = ['matrix-freeway-hero-truck', 'matrix-freeway-oncoming-truck'].map(name => root.getObjectByName(name)!);
  const intact = rigs.map(rearVertices);
  state.trucks = { ...state.trucks!, phase: 'rescue', rescueElapsed: 2 };
  renderer.update(state, 2);
  rigs.forEach((rig, index) => {
    const crushed = rearVertices(rig), before = intact[index];
    assert.ok(crushed.some(point => point.y > TRUCKS.roof.height + 1), `${rig.name}: the trailer tail must rise in the collision`);
    assert.ok(crushed.some(point => point.y < 3 && Math.abs(point.x) < 2 && point.z > 2
      && before.every(old => point.distanceTo(old) > .3)), `${rig.name}: the real chassis must bend with the cargo shell`);
    const side = crushed.filter(point => Math.abs(point.x) > 2.2 && point.y > 3 && point.y < 6 && point.z < 7);
    assert.ok(new Set(side.map(point => Math.round(point.z * 4))).size > 12,
      `${rig.name}: longitudinal sheet-metal folds need actual segmented surfaces`);
  });
});

test('the buckled truck shells and moving axles remain above the road throughout the saved crash', t => {
  const { root, renderer } = setup(t), state = journey();
  state.trucks = { ...state.trucks!, phase: 'rescue', elapsed: TRUCKS.collisionSeconds, rescueElapsed: 0 };
  for (let frame = 0; frame <= 30; frame++) {
    state.trucks.rescueElapsed = frame * .1; renderer.update(state, frame);
    for (const name of ['matrix-freeway-hero-truck', 'matrix-freeway-oncoming-truck']) {
      const rig = root.getObjectByName(name)!; rig.updateWorldMatrix(true, true);
      rig.traverse(object => {
        if (!(object instanceof THREE.Mesh)) return;
        const position = object.geometry.getAttribute('position');
        for (let i = 0; i < position.count; i++) {
          const point = object.getVertexPosition(i, new THREE.Vector3()).applyMatrix4(object.matrixWorld);
          assert.ok(point.y > -.03, `${name} body/wheel enters asphalt at ${frame * .1}s: ${point.y}`);
        }
      });
    }
  }
});

test('Neo’s approach trail follows the same saved flight path as his body', t => {
  const { root, renderer } = setup(t), state = journey();
  for (const elapsed of [5.6, 7, 9.9]) {
    state.trucks!.elapsed = elapsed; renderer.update(state, 500);
    const trail = root.getObjectByName('matrix-freeway-neo-trail')!, pose = truckApproachPose(elapsed);
    assert.ok(trail.visible);
    assert.ok(trail.position.distanceTo(new THREE.Vector3(pose.x, pose.y, pose.z)) < .01,
      'a separate approximate trail trajectory detaches from Neo during approach');
    assert.ok(trail.children.every(ring => ring.position.z <= 0), 'the wake extends behind the forward-moving body');
  }
});
function snapshot(root: THREE.Group): string {
  const hash = createHash('sha256'); root.updateMatrixWorld(true);
  root.traverse(object => {
    hash.update(JSON.stringify([object.type, object.name, object.visible, object.matrixWorld.elements]));
    if (object instanceof THREE.Mesh) {
      hash.update(Buffer.from(object.geometry.getAttribute('position').array.buffer));
      hash.update(JSON.stringify(object.morphTargetInfluences ?? []));
      for (const material of Array.isArray(object.material) ? object.material : [object.material]) hash.update(String(material.opacity));
    }
    if (object instanceof THREE.InstancedMesh) hash.update(Buffer.from(object.instanceMatrix.array.buffer));
  });
  return hash.digest('hex');
}

test('the truck collision folds actual cab surfaces while the occupied trailer stays supported', t => {
  const { root, renderer } = setup(t), state = journey(); renderer.update(state, 100);
  const rig = root.getObjectByName('matrix-freeway-hero-truck')!, intact = cabVertices(rig);
  assert.ok(intact.length > 50, 'sample the rendered cab rather than a proxy control point');
  state.trucks = { ...state.trucks!, phase: 'rescue', elapsed: TRUCKS.collisionSeconds, rescueElapsed: 1.2 };
  renderer.update(state, 101.2); const crushed = cabVertices(rig);
  assert.equal(crushed.length, intact.length);
  assert.ok(crushed.some((point, i) => point.distanceTo(intact[i]) > 1), 'the real cab must crumple, not remain intact behind a fire sprite');
  state.trucks.rescueElapsed = .15; renderer.update(state, 100.15);
  for (const z of [20, 25, 32.5, 37]) {
    const ray = new THREE.Raycaster(new THREE.Vector3(TRUCKS.roof.x, 12, z), new THREE.Vector3(0, -1, 0));
    const surface = ray.intersectObject(rig, true)[0];
    assert.ok(surface && Math.abs(surface.point.y - TRUCKS.roof.height) < .15, `the roof must stay supported until the passengers jump at ${z}`);
  }
  const fragments = root.getObjectByName('matrix-freeway-crash-fragments');
  assert.ok(fragments?.visible && fragments.children.length >= 12, 'the impact needs physical metal and glass debris');
});

test('the truck crash progresses from cab folding to an expanding fire plume on the saved rescue clock', t => {
  const { root, renderer } = setup(t), state = journey();
  state.trucks = { ...state.trucks!, phase: 'rescue', elapsed: TRUCKS.collisionSeconds, rescueElapsed: 0 };
  renderer.update(state, 50);
  const impact = root.getObjectByName('matrix-freeway-collision')!;
  assert.equal(impact.children[0].visible, false, 'fire cannot precede the metal impact and passenger lift');
  state.trucks.rescueElapsed = .8; renderer.update(state, 50.8);
  assert.equal(impact.children[0].visible, true);
  const fireStart = impact.children[0].scale.clone(), smokeStart = impact.children[1].position.clone();
  state.trucks.rescueElapsed = 2; renderer.update(state, 52);
  assert.ok(impact.children[0].scale.y > fireStart.y * 1.4, 'the orange plume rises behind the departing passengers');
  assert.ok(impact.children[1].position.y > smokeStart.y + 1, 'smoke has its own saved rise rather than a static ball');
});

test('paused and cold-loaded truck checkpoints reproduce traffic, cab damage, debris and smoke exactly', t => {
  const { root, renderer } = setup(t), state = journey();
  state.trucks = { ...state.trucks!, phase: 'rescue', elapsed: 10, rescueElapsed: 1.4 };
  renderer.update(state, 20); const saved = snapshot(root);
  renderer.update(state, 2000);
  assert.equal(snapshot(root), saved, 'advancing only the browser clock cannot move a paused crash');
  const other = new THREE.Group(), restored = new FreewaySetRenderer(other, FILM_SETS.film_freeway_trucks);
  try { restored.update(JSON.parse(JSON.stringify(state)), 9000); assert.equal(snapshot(other), saved); }
  finally { restored.dispose(); }
});

test('retry restores undamaged cabs and hides the previous collision debris', t => {
  const { root, renderer } = setup(t), state = journey();
  state.trucks!.elapsed = 0; renderer.update(state, 10); const intact = snapshot(root);
  state.trucks = { ...state.trucks!, phase: 'failed', elapsed: 10 };
  renderer.update(state, 50);
  assert.ok(root.getObjectByName('matrix-freeway-crash-fragments')?.visible);
  state.trucks = { phase: 'collision', elapsed: 0, attempt: 1, lastTick: 20 };
  renderer.update(state, 90); assert.equal(snapshot(root), intact, 'retry resets every deformation and saved-clock effect');
});

test('crash fragments clear the occupied trailer and never settle through the asphalt', t => {
  const { root, renderer } = setup(t), state = journey();
  state.trucks = { ...state.trucks!, phase: 'rescue', elapsed: 10, rescueElapsed: 0 };
  for (let frame = 0; frame <= 60; frame++) {
    state.trucks.rescueElapsed = frame * .05; renderer.update(state, frame); root.updateMatrixWorld(true);
    const fragments = root.getObjectByName('matrix-freeway-crash-fragments')!;
    for (const object of fragments.children as THREE.Mesh[]) {
      const position = object.geometry.getAttribute('position');
      for (let vertex = 0; vertex < position.count; vertex++) {
        const point = object.getVertexPosition(vertex, new THREE.Vector3()).applyMatrix4(object.matrixWorld);
        assert.ok(point.y >= -.01, `${object.name} penetrates the asphalt at ${frame * .05}s: ${point.y}`);
        assert.ok(Math.abs(point.x - TRUCKS.roof.x) > TRUCKS.roof.width / 2 || Math.abs(point.z - TRUCKS.roof.z) > TRUCKS.roof.depth / 2,
          `${object.name} enters the occupied roof at ${frame * .05}s`);
      }
    }
  }
});

test('the real freeway fire and smoke use Morpheus’s fast rescue clock and reject old actions after retry or completion', t => {
  const original = globalThis.document; globalThis.document = canvasDocument();
  const scene = new THREE.Scene(), renderer = new FilmSetRenderer(scene);
  t.after(() => { renderer.dispose(); globalThis.document = original; });
  const world = new WorldState(); new AgentManager(world).initializeAllAgents();
  const player = world.agents.get('morpheus')!;
  Object.assign(player, { position: filmPosition('film_freeway_trucks', 14.6, 32.5), isInMatrix: true, currentLocation: 'film_freeway_trucks' });
  const state = journey(); state.step = 2;
  state.trucks = { ...state.trucks!, phase: 'rescue', elapsed: 10, rescueElapsed: .2 };
  const fast = { ...state.trucks, role: 'morpheus', rescueElapsed: .4 };
  player.currentAction = { type: 'move_to', parameters: { truckRescue: fast }, startedAt: 0, duration: 100000, progress: 0 };
  const sandbox = { neoLife: { journey: state } } as SandboxState;
  renderer.update(player, sandbox, 0, player.position);
  const impact = scene.getObjectByName('matrix-freeway-collision')!, fire = impact.children[0], smoke = impact.children[1];
  assert.equal(fire.visible, false);
  fast.rescueElapsed = 1.4; renderer.update(player, sandbox, .05, player.position);
  assert.equal(fire.visible, true, 'the slow journey snapshot cannot hold back the explosion after the carried bodies have moved');
  assert.ok(Math.abs(smoke.position.y - 1.4 * 2.3) < .001, 'smoke and all three actors must use one rescued frame');
  const freeway = scene.getObjectByName('matrix-freeway-hero-truck')!.parent as THREE.Group;
  const paused = snapshot(freeway); renderer.update(player, sandbox, 9000, player.position);
  assert.equal(snapshot(freeway), paused, 'only a new saved actor clock may advance the paused explosion');
  assert.equal(state.trucks.rescueElapsed, .2, 'rendering must not mutate the authoritative journey snapshot');

  state.trucks = { phase: 'collision', elapsed: 0, attempt: 1, lastTick: 10 };
  renderer.update(player, sandbox, 9001, player.position);
  assert.equal(impact.visible, false, 'an old rescue action cannot replay the previous explosion after retry');
  state.trucks = { phase: 'rescue', elapsed: 10, rescueElapsed: .1, attempt: 1, lastTick: 11 };
  renderer.update(player, sandbox, 9002, player.position);
  assert.equal(fire.visible, false, 'an earlier attempt cannot override the new rescue even when the phase matches');
  state.trucks = { phase: 'rescued', elapsed: 10, rescueElapsed: 3, attempt: 0, lastTick: 12 };
  renderer.update(player, sandbox, 9003, player.position);
  assert.ok(Math.abs(smoke.position.y - 3 * 2.3) < .001, 'a carried-pose packet cannot rewind the completed explosion');
  state.trucks.phase = 'rescue'; state.trucks.rescueElapsed = 2;
  renderer.update(player, sandbox, 9004, player.position);
  assert.ok(Math.abs(smoke.position.y - 2 * 2.3) < .001, 'a newer authoritative save wins over an older actor packet');
  state.trucks.rescueElapsed = .2;
  const other = world.agents.get('neo')!;
  Object.assign(other, { position: { ...player.position }, currentLocation: player.currentLocation, isInMatrix: true, currentAction: player.currentAction });
  renderer.update(other, sandbox, 9005, other.position);
  assert.equal(fire.visible, false, 'another selected character cannot supply Morpheus’s scene clock');
  state.visiting = 'm2_trucks'; renderer.update(player, sandbox, 9006, player.position);
  assert.equal(impact.visible, false, 'a visit cannot replay a saved active rescue');
  delete state.visiting; state.scene = 'm2_freeway'; renderer.update(player, sandbox, 9007, player.position);
  assert.equal(scene.getObjectByName('matrix-freeway-collision')!.visible, false, 'a different chapter cannot consume the stale truck pose');
});

test('the actual chain splits and drops onto the deck after the saved shot rather than disappearing', t => {
  const original = globalThis.document; globalThis.document = canvasDocument();
  const root = new THREE.Group(), renderer = new FreewaySetRenderer(root, FILM_SETS.film_freeway_101);
  t.after(() => { renderer.dispose(); globalThis.document = original; });
  const state = { ...journey(), scene: 'm2_freeway', actor: 'trinity', step: 0,
    freewayPickup: { ...newFreewayPickup(), phase: 'shooting', key: true, total: 12, elapsed: .5, chain: false, shotAt: 12 } } as FilmJourney;
  renderer.update(state, 0);
  const chain = root.getObjectByName('matrix-carrier-bike-chain')!;
  assert.ok(chain.visible, 'the shot cannot delete the entire chain in one frame');
  const before = chain.children.map(link => link.position.clone());
  state.freewayPickup!.total += .65; state.freewayPickup!.elapsed += .65; renderer.update(state, 100);
  assert.ok(chain.children.some((link, index) => link.position.distanceTo(before[index]) > .4), 'the physical links must fall after being shot');
  chain.traverse(object => {
    if (!(object instanceof THREE.Mesh)) return;
    for (let v = 0; v < object.geometry.attributes.position.count; v++) {
      const point = object.getVertexPosition(v, new THREE.Vector3()); object.updateWorldMatrix(true, false); object.localToWorld(point);
      assert.ok(point.y >= 5.79, 'broken links cannot fall through the actual carrier deck');
    }
  });
  const stopped = snapshot(root); renderer.update(JSON.parse(JSON.stringify(state)), 9000);
  assert.equal(snapshot(root), stopped, 'the chain must use the saved clock when redrawing a paused/cold checkpoint');
});

test('the pursuit vehicles, shoulder and extended asphalt use the saved physical coordinates on pause and cold load', t => {
  const original = globalThis.document; globalThis.document = canvasDocument();
  const root = new THREE.Group(), renderer = new FreewaySetRenderer(root, FILM_SETS.film_freeway_101);
  t.after(() => { renderer.dispose(); globalThis.document = original; });
  const state: FilmJourney = { ...journey(), scene: 'm2_freeway', actor: 'trinity', step: 0,
    freewayPickup: { ...newFreewayPickup(), phase: 'merging', total: 20, x: 2.5, z: 780, speed: 32,
      chase: { phase: 'ramming', elapsed: .6, truck: { x: 10, z: 800, speed: 28, yaw: -.127 }, shield: { x: 6, z: 835, speed: 12 } } } };
  renderer.update(state, 0); root.updateMatrixWorld(true);
  const truck = root.getObjectByName('matrix-freeway-jackson-truck')!, car = root.getObjectByName('matrix-freeway-shield-car')!;
  assert.ok(truck.visible && car.visible); assert.deepEqual(truck.position.toArray(), [10, 0, 800]);
  assert.deepEqual(car.position.toArray(), [6, 0, 835]); assert.ok(Math.abs(truck.rotation.y - Math.PI + .127) < 1e-8);
  const asphalt: THREE.Mesh[] = []; root.traverse(o => {
    if (o instanceof THREE.Mesh && (o.material as THREE.MeshStandardMaterial).name === 'freeway-asphalt') asphalt.push(o);
  });
  for (const z of [-FREEWAY_PICKUP.roadEnd, FREEWAY_PICKUP.roadEnd]) {
    const ray = new THREE.Raycaster(new THREE.Vector3(2.5, 10, z), new THREE.Vector3(0, -1, 0));
    const surface = ray.intersectObjects(asphalt)[0];
    assert.ok(surface && Math.abs(surface.point.y) < 1e-6, `the allowed road at ${z} needs asphalt; measured surface ${surface?.point.toArray()}`);
  }
  const median = filmObstacles(FILM_SETS.film_freeway_101).find(o => o.x === 0)!;
  assert.ok(median.depth / 2 > FREEWAY_PICKUP.roadEnd && 2.5 - 1.05 > median.width / 2, 'the shared shoulder must clear the actual median');
  const before = snapshot(root); renderer.update(JSON.parse(JSON.stringify(state)), 9000); assert.equal(snapshot(root), before);
  const cold = new THREE.Group(), restored = new FreewaySetRenderer(cold, FILM_SETS.film_freeway_101);
  try { restored.update(JSON.parse(JSON.stringify(state)), 10000); assert.equal(snapshot(cold), before); }
  finally { restored.dispose(); }
  for (let frame = 0; frame < 80 && state.freewayPickup!.chase!.impactAt === undefined; frame++)
    state.freewayPickup = stepFreewayPickup(state.freewayPickup!, { drive: { throttle: 0, steer: 0, brake: false } }, .05);
  assert.ok(state.freewayPickup!.chase!.impactAt, 'the simulated truck must actually reach the shield car');
  renderer.update(state, 11000); root.updateMatrixWorld(true);
  const gap = new THREE.Box3().setFromObject(car).min.z - new THREE.Box3().setFromObject(truck).max.z;
  assert.ok(gap >= -1e-5 && gap < .03, `the actual bumper must meet the shield car without intersecting its body: ${gap}`);
});
