import assert from 'node:assert/strict';
import test, { type TestContext } from 'node:test';
import * as THREE from 'three';
import { FILM_SETS, filmPosition, type FilmJourney, type OpeningPhoneEncounter, type SandboxState } from '@auto_matrix/shared';
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
  return { renderer, draw, running, truck: renderer.root.getObjectByName('opening-garbage-truck')! };
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
