import assert from 'node:assert/strict';
import test, { type TestContext } from 'node:test';
import { createHash } from 'node:crypto';
import * as THREE from 'three';
import { FILM_SCENE_BY_ID, FILM_SETS, OPENING_ESCAPE, openingTruckPose, filmPosition, type FilmJourney, type OpeningPhoneEncounter, type SandboxState } from '@auto_matrix/shared';
import { FilmSetRenderer } from '../packages/client/src/engine/FilmSetRenderer.js';
import { WorldState } from '../packages/server/src/world/WorldState.js';
import { AgentManager } from '../packages/server/src/agents/AgentManager.js';

function fixture(t: TestContext) {
  t.mock.method(THREE.TextureLoader.prototype, 'load', () => new THREE.Texture());
  const previous = Object.getOwnPropertyDescriptor(globalThis, 'document');
  Object.assign(globalThis, { document: { createElement: () => ({ getContext: () => ({ fillRect() {}, strokeRect() {}, fillText() {} }) }) } });
  const world = new WorldState(); new AgentManager(world).initializeAllAgents(); const actor = world.agents.get('trinity')!;
  const film = FILM_SCENE_BY_ID.m1_phone_escape; actor.position = filmPosition(film.set, 0, -28); actor.currentLocation = film.set; actor.isInMatrix = true;
  const journey: FilmJourney = { version: 1, scene: film.id, actor: actor.id, step: 2, completed: ['m1_room303', 'm1_roofs'], enteredAt: 0,
    reflections: {}, lastText: '', checkpoint: { ...actor.position } };
  const renderer = new FilmSetRenderer(new THREE.Scene()), sandbox = { neoLife: { journey }, structures: [] } as unknown as SandboxState;
  t.after(() => { renderer.dispose(); if (previous) Object.defineProperty(globalThis, 'document', previous); else Reflect.deleteProperty(globalThis, 'document'); });
  const draw = (phone: OpeningPhoneEncounter) => { journey.openingPhone = structuredClone(phone); renderer.update(actor, sandbox, 0); renderer.root.updateWorldMatrix(true, true); };
  draw({ phase: 'running', remaining: 8, lastTick: 0, attempts: 0 });
  const booth = renderer.root.getObjectByName('opening-phone-booth')!, truck = renderer.root.getObjectByName('opening-garbage-truck')!, glass = renderer.root.getObjectByName('opening-shattered-glass')!;
  return { actor, journey, renderer, sandbox, draw, booth, truck, glass };
}
function visibleMeshes(root: THREE.Object3D): THREE.Mesh[] {
  const meshes: THREE.Mesh[] = []; root.traverseVisible(object => { if (object instanceof THREE.Mesh) meshes.push(object); }); return meshes;
}
function surface(root: THREE.Object3D): string {
  const hash = createHash('sha256'), point = new THREE.Vector3(); root.updateWorldMatrix(true, true);
  for (const mesh of visibleMeshes(root)) {
    const position = mesh.geometry.getAttribute('position'), vertices = new Float64Array(position.count * 3);
    for (let i = 0; i < position.count; i++) mesh.localToWorld(point.fromBufferAttribute(position, i)).toArray(vertices, i * 3);
    hash.update(new Uint8Array(vertices.buffer));
  }
  return hash.digest('hex');
}
const connected = (elapsed: number): OpeningPhoneEncounter => ({ phase: 'connected', remaining: 8, lastTick: 0, attempts: 0, impactElapsed: elapsed, impactFrom: 8 });

test('opening impact: the countdown keeps the actual truck clear of the standing booth until the deadline', t => {
  const h = fixture(t), center = FILM_SETS.film_wells_phone.center;
  const body = visibleMeshes(h.truck).find(mesh => {
    const size = new THREE.Box3().setFromObject(mesh).getSize(new THREE.Vector3()); return Math.abs(size.y - 1.9) < .01 && Math.max(size.x, size.z) > 14;
  })!;
  assert.ok(body); body.geometry.computeBoundingBox();
  for (const remaining of [15, 8, 3, 1.5, 1, .5, .01, 0]) {
    h.draw({ phase: 'running', remaining, lastTick: 0, attempts: 0 });
    for (const x of [-1.8, 1.8]) for (const z of [-1.4, 1.4]) {
      const point = new THREE.Vector3(center.x + x, center.y - 1 + 1.9, center.z - FILM_SETS.film_wells_phone.depth * .32 + z);
      assert.equal(body.geometry.boundingBox!.containsPoint(body.worldToLocal(point)), false, `truck reaches the booth with ${remaining} seconds left`);
    }
  }
});

test('opening impact: the booth stays upright before contact and its intact glass is replaced by shards after contact', t => {
  const h = fixture(t), before = surface(h.booth);
  h.draw(connected(.25)); assert.equal(surface(h.booth), before, 'answering the phone cannot damage a booth before the truck reaches it');
  h.draw(connected(OPENING_ESCAPE.truckImpactSeconds));
  const intactPanes = visibleMeshes(h.booth).filter(mesh => {
    const material = mesh.material as THREE.Material, shape = (mesh.geometry as THREE.BoxGeometry).parameters;
    return material.transparent && shape?.height === 7 && shape?.depth === 2.8;
  });
  assert.equal(intactPanes.length, 0, 'the full-height glass panels must disappear when replaced by their broken pieces');
  assert.ok(h.glass.visible && visibleMeshes(h.glass).length >= 18);
  assert.notEqual(surface(h.booth), before);
});

test('opening impact: the completed wreck stays above the road and outside the rendered truck', t => {
  const h = fixture(t), road = FILM_SETS.film_wells_phone.center.y - 1;
  for (const phase of ['done', 'failed'] as const) {
    h.draw({ ...connected(OPENING_ESCAPE.truckImpactSeconds), phase, remaining: phase === 'failed' ? 0 : 8 });
    const vehicle = visibleMeshes(h.truck).map(mesh => new THREE.Box3().setFromObject(mesh));
    for (const mesh of [...visibleMeshes(h.booth), ...visibleMeshes(h.glass)]) {
      const bounds = new THREE.Box3().setFromObject(mesh);
      assert.ok(bounds.min.y >= road - .02, `${phase}: wreck geometry sinks under the road`);
      assert.equal(vehicle.some(body => body.intersectsBox(bounds)), false, `${phase}: visible booth geometry remains embedded in the truck`);
    }
  }
});

test('opening impact: cold reconstruction and retry restore the complete geometry without allocating per frame', t => {
  const h = fixture(t), cold = new FilmSetRenderer(new THREE.Scene()); t.after(() => cold.dispose());
  const initial = surface(h.booth), geometries = new Set<THREE.BufferGeometry>(); h.renderer.root.traverse(o => { if (o instanceof THREE.Mesh) geometries.add(o.geometry); });
  for (const elapsed of [0, .25, .9, 1.15, 1.35]) {
    h.draw(connected(elapsed)); cold.update(h.actor, structuredClone(h.sandbox), 100); cold.root.updateWorldMatrix(true, true);
    assert.equal(surface(cold.root.getObjectByName('opening-phone-booth')!), surface(h.booth));
    assert.equal(surface(cold.root.getObjectByName('opening-shattered-glass')!), surface(h.glass));
    h.renderer.root.traverse(o => { if (o instanceof THREE.Mesh) assert.ok(geometries.has(o.geometry), 'impact updates cannot create new geometry every frame'); });
  }
  h.draw({ phase: 'running', remaining: 15, lastTick: 100, attempts: 1 });
  assert.equal(surface(h.booth), initial); assert.equal(h.glass.visible, false);
});

test('opening impact: legacy failed saves keep their completed wreck without replaying a new crash', t => {
  const h = fixture(t), legacy: OpeningPhoneEncounter = { phase: 'failed', remaining: 0, lastTick: 500, attempts: 2 };
  h.draw(legacy); const before = surface(h.booth);
  assert.deepEqual(openingTruckPose(legacy), openingTruckPose({ ...legacy, impactElapsed: OPENING_ESCAPE.truckImpactSeconds, impactFrom: 0 }));
  h.draw({ ...legacy, impactElapsed: OPENING_ESCAPE.truckImpactSeconds, impactFrom: 0 }); assert.equal(surface(h.booth), before);
});
