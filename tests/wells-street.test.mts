import assert from 'node:assert/strict';
import test, { type TestContext } from 'node:test';
import * as THREE from 'three';
import {
  FILM_SCENE_BY_ID, FILM_SETS, OPENING_PHONE, filmPosition, filmStepActionReady, groundHeight, openingBoothCrush, openingTruckPose, playerBlocked, stepPlayer,
  wellsStreetStructures, type FilmJourney, type OpeningPhoneEncounter, type SandboxState,
} from '@auto_matrix/shared';
import { FilmSetRenderer } from '../packages/client/src/engine/FilmSetRenderer.js';
import { WorldState } from '../packages/server/src/world/WorldState.js';
import { AgentManager } from '../packages/server/src/agents/AgentManager.js';

const set = FILM_SETS.film_wells_phone;
function fixture(t: TestContext) {
  t.mock.method(THREE.TextureLoader.prototype, 'load', () => new THREE.Texture());
  const previous = Object.getOwnPropertyDescriptor(globalThis, 'document');
  Object.assign(globalThis, { document: { createElement: () => ({ getContext: () => ({ fillRect() {}, strokeRect() {}, fillText() {} }) }) } });
  const world = new WorldState(); new AgentManager(world).initializeAllAgents();
  const actor = world.agents.get('trinity')!;
  actor.position = filmPosition(set.id, 0, -28); actor.currentLocation = set.id; actor.isInMatrix = true;
  const journey: FilmJourney = { version: 1, scene: 'm1_phone_escape', actor: actor.id, step: 1, completed: ['m1_room303', 'm1_roofs'], enteredAt: 0,
    reflections: {}, lastText: '', checkpoint: { ...actor.position } };
  const scene = new THREE.Scene(); scene.background = new THREE.Color(); scene.fog = new THREE.FogExp2();
  const renderer = new FilmSetRenderer(scene), sandbox = { neoLife: { journey }, structures: [] } as unknown as SandboxState;
  const draw = (phone: OpeningPhoneEncounter) => { journey.openingPhone = phone; renderer.update(actor, sandbox, 0); scene.updateMatrixWorld(true); };
  const running = (remaining: number): OpeningPhoneEncounter => ({ phase: 'running', remaining, lastTick: 0, attempts: 0 });
  draw(running(15));
  t.after(() => { renderer.dispose(); if (previous) Object.defineProperty(globalThis, 'document', previous); else Reflect.deleteProperty(globalThis, 'document'); });
  return { renderer, draw, running, journey, truck: renderer.root.getObjectByName('opening-garbage-truck')! };
}

const streetPoint = (x: number, y: number, z: number) => new THREE.Vector3(set.center.x + x, set.center.y - 1 + y, set.center.z + z);

test('Wells: paved ground continues beyond the playable edges and through the railway arch', t => {
  const { renderer } = fixture(t);
  for (const [x, z] of [[0, -54], [0, 71], [-24.8, -12], [24.8, 17]]) {
    const ray = new THREE.Raycaster(streetPoint(x, 1, z), new THREE.Vector3(0, -1, 0), 0, 1.05);
    assert.ok(ray.intersectObject(renderer.root, true).some(hit => Math.abs(hit.point.y - set.center.y + 1) < .025),
      `visible ground should continue below ${x}/${z}`);
  }
  const arch = renderer.root.getObjectByName('wells-railway-arch');
  assert.ok(arch, 'a solid railway bridge frames the far end of Wells');
  const from = (x: number, y: number) => new THREE.Raycaster(streetPoint(x, y, 38), new THREE.Vector3(0, 0, 1), 0, 45);
  assert.equal(from(0, 3).intersectObject(arch, true).length, 0, 'the road remains visibly open beneath the arch');
  assert.ok(from(0, 18).intersectObject(arch, true).length > 0, 'the bridge has masonry above the opening');
});

test('Wells: the truck has grounded axles and real headlamps that swing toward the booth', t => {
  const h = fixture(t), lamps: THREE.SpotLight[] = [], tires: THREE.Mesh[] = [];
  h.truck.traverseVisible(object => {
    if (object instanceof THREE.SpotLight) lamps.push(object);
    if (object instanceof THREE.Mesh && object.geometry instanceof THREE.CylinderGeometry && object.geometry.parameters.radiusTop === 1) tires.push(object);
  });
  assert.equal(lamps.length, 2, 'both headlights must illuminate geometry, including the moving caller');
  const direction = (light: THREE.SpotLight) => light.target.getWorldPosition(new THREE.Vector3()).sub(light.getWorldPosition(new THREE.Vector3())).normalize();
  const before = lamps.map(direction);
  h.draw(h.running(.05));
  for (const [i, light] of lamps.entries()) {
    assert.ok(light.intensity > 0 && light.distance > 20 && !light.castShadow);
    assert.ok(light.intensity <= 240, 'preserve the Wells headlamp intensity limit for wet pavement');
    const after = direction(light);
    assert.ok(after.dot(before[i]) < .65, 'the beam turns with the saved truck yaw');
    assert.ok(after.dot(streetPoint(0, 2.5, -30.08).sub(light.getWorldPosition(new THREE.Vector3())).normalize()) > Math.cos(light.angle));
    const lightLocal = h.truck.worldToLocal(light.getWorldPosition(new THREE.Vector3()));
    const eye = h.truck.localToWorld(lightLocal.clone().add(new THREE.Vector3(0, 0, -1)));
    const front = h.truck.localToWorld(lightLocal).sub(eye).normalize();
    const face = new THREE.Raycaster(eye, front, 0, 2).intersectObject(h.truck, true)[0]?.object as THREE.Mesh;
    assert.ok(face?.material instanceof THREE.MeshBasicMaterial, 'the emissive lens must be exposed in front of the housing and hood');
  }
  assert.equal(tires.length, 6, 'the compactor body is supported by tandem rear axles');
  for (const tire of tires) {
    const { min } = new THREE.Box3().setFromObject(tire, true);
    assert.ok(Math.abs(min.y - set.center.y + 1) < .04, 'the visible tire touches the street during the turn');
  }
});

test('Wells: the raised booth and brick wall use the same visible and walkable street', t => {
  const h = fixture(t);
  const phone = { ...h.running(15), curbside: true } as const;
  h.draw(phone);
  const pavement = h.renderer.root.getObjectByName('wells-booth-sidewalk');
  const wall = h.renderer.root.getObjectByName('wells-booth-wall');
  assert.ok(pavement?.visible && wall?.visible, 'the booth must be on a raised pavement in front of a brick wall');
  const pavingBounds = new THREE.Box3().setFromObject(pavement, true);
  const wallBounds = new THREE.Box3().setFromObject(wall, true);
  const booth = h.renderer.root.getObjectByName('opening-phone-booth')!;
  assert.ok(Math.abs(booth.getWorldPosition(new THREE.Vector3()).y - pavingBounds.max.y) < 1e-6);
  const solids = wellsStreetStructures(set.center, phone);
  const { x, z } = OPENING_PHONE.stand;
  let position = filmPosition(set.id, x, pavingBounds.max.z - set.center.z + 1);
  for (let sequence = 0; sequence < 40 && position.z > set.center.z + z; sequence++) {
    position = stepPlayer(position, 0, { x: 0, z: -1, yaw: Math.PI, jump: false, sprint: false, sequence }, .05, true, solids).position;
  }
  const scene = FILM_SCENE_BY_ID.m1_phone_escape;
  assert.ok(filmStepActionReady(scene, scene.steps[1], position, true, h.journey), 'the player can walk up from the road to the receiver');
  assert.ok(Math.abs(position.y - pavingBounds.max.y - 1) < 1e-6);
  assert.ok(Math.abs(groundHeight(position, true, solids) - position.y) < 1e-6);
  assert.ok(playerBlocked({ x: set.center.x + 5, y: position.y, z: wallBounds.max.z - .1 }, true, 1.1, solids));
  assert.equal(playerBlocked({ x: set.center.x + 5, y: position.y, z: wallBounds.max.z + 1 }, true, 1.1, solids), false);
  h.draw(h.running(15));
  assert.equal(pavement.parent?.visible, false, 'an in-progress legacy save keeps its original geometry');
  assert.equal(wall.parent?.visible, false);
});

test('Wells: the front wheels climb the curb before contact and the wreck stops at the wall', t => {
  const h = fixture(t);
  const phone = { ...h.running(5.88), phase: 'connected', impactElapsed: 1.035, curbside: true } as const;
  const tires: THREE.Mesh[] = [];
  h.truck.traverseVisible(object => {
    if (object instanceof THREE.Mesh && object.geometry instanceof THREE.CylinderGeometry && object.geometry.parameters.radiusTop === 1) tires.push(object);
  });
  h.draw(phone);
  assert.equal(openingBoothCrush(openingTruckPose(phone)), 0);
  const bounds = tires.map(tire => new THREE.Box3().setFromObject(tire, true));
  const raised = bounds.filter(box => box.min.y > set.center.y - 1 + .32);
  assert.ok(raised.length >= 1 && raised.length <= 2, 'front tires rise while the tandem axles remain on the road');
  const done = { ...phone, phase: 'done' } as const;
  h.draw(done);
  const wall = h.renderer.root.getObjectByName('wells-booth-wall')!;
  const booth = h.renderer.root.getObjectByName('opening-phone-booth')!;
  const wallFace = new THREE.Box3().setFromObject(wall, true).max.z;
  const wreck = new THREE.Box3();
  booth.traverseVisible(object => { if (object instanceof THREE.Mesh) wreck.union(new THREE.Box3().setFromObject(object, true)); });
  assert.ok(Math.abs(wreck.min.z - wallFace) < .015, 'the displaced booth reaches the visible wall');
  const physicalPosts = wellsStreetStructures(set.center, done).filter(s => s.id.startsWith('film:wells:post:'));
  assert.ok(Math.abs(Math.min(...physicalPosts.map(s => s.position.z - s.film!.depth / 2)) - wallFace) < 1e-6);
});

test('Wells: the truck pulls out of an opening in the east block without passing through masonry', t => {
  const { renderer, truck } = fixture(t);
  const ray = new THREE.Raycaster(streetPoint(24, 4.25, 4), new THREE.Vector3(1, 0, 0), 0, 9.8);
  const wallHits = ray.intersectObject(renderer.root, true).filter(hit => {
    for (let object: THREE.Object3D | null = hit.object; object; object = object.parent) if (object === truck) return false;
    return true;
  });
  assert.equal(wallHits.length, 0, 'the compactor projects into a paved service lane instead of a side wall');
});

test('Wells: the street uses mapped pavement and keeps its night lighting layout until leaving', t => {
  const { renderer } = fixture(t);
  const road = renderer.root.getObjectByName('wells-asphalt') as THREE.Mesh<THREE.BufferGeometry, THREE.MeshPhysicalMaterial>;
  assert.ok(road?.material.map && road.material.normalMap && road.material.roughnessMap);
  assert.ok(renderer.atmosphere()!.ambient < .5);
  assert.equal(renderer.stablePointSlots, true);
  const textures = [road.material.map, road.material.normalMap, road.material.roughnessMap], resources = [road.geometry, road.material, ...textures];
  const disposals = resources.map(resource => {
    let count = 0; resource.addEventListener('dispose', () => count++); return () => count;
  });
  renderer.update(undefined, undefined, 0);
  assert.deepEqual(disposals.map(count => count()), [1, 1, 1, 1, 1]);
  assert.equal(renderer.stablePointSlots, false);
});
