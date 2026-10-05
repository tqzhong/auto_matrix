import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { FILM_SETS, SUNRISE_GARDEN, filmPosition, gardenPose, streetResetPose, newTrilogyEpilogue, type TrilogyEpilogueEncounter } from '@auto_matrix/shared';
import { AgentRenderer } from '../packages/client/src/agents/AgentRenderer.js';
import { PlayerControls } from '../packages/client/src/player/PlayerControls.js';
import { WorldState } from '../packages/server/src/world/WorldState.js';
import { AgentManager } from '../packages/server/src/agents/AgentManager.js';

function vertices(body: THREE.Object3D): THREE.Vector3[] {
  body.updateWorldMatrix(true, true); const points: THREE.Vector3[] = [];
  body.traverseVisible(object => {
    if (!(object instanceof THREE.Mesh)) return;
    object.updateMatrixWorld(true);
    if (object instanceof THREE.SkinnedMesh) object.skeleton.update();
    for (let i = 0; i < object.geometry.attributes.position.count; i++)
      points.push(object.localToWorld(object.getVertexPosition(i, new THREE.Vector3())));
  });
  return points;
}

test('saved park poses support the seated Oracle and standing Sati without putting visible meshes through the slats or lawn', t => {
  t.mock.method(THREE.TextureLoader.prototype, 'load', () => new THREE.Texture());
  t.mock.method(GLTFLoader.prototype, 'loadAsync', () => new Promise(() => {}));
  const document = globalThis.document;
  const context = { createRadialGradient: () => ({ addColorStop() {} }), fillRect() {}, strokeRect() {}, fillText() {},
    createImageData: (w: number, h: number) => ({ data: new Uint8ClampedArray(w * h * 4) }), putImageData() {} };
  globalThis.document = { createElement: () => ({ getContext: () => context }) } as unknown as Document;
  const world = new WorldState(); new AgentManager(world).initializeAllAgents();
  const warm = new AgentRenderer(new THREE.Scene()), cold = new AgentRenderer(new THREE.Scene());
  const center = FILM_SETS.film_sunrise_garden.center, b = SUNRISE_GARDEN.bench;
  try {
    for (const role of ['oracle', 'sati'] as const) {
      const actor = world.agents.get(role)!; actor.currentLocation = 'film_sunrise_garden'; actor.isInMatrix = true;
      actor.velocity = { x: 0, y: 0, z: 0 };
      const encounter: TrilogyEpilogueEncounter = { ...newTrilogyEpilogue('dawn'), phase: 'belief', elapsed: 1.3, total: 24.8 };
      const pose = gardenPose(encounter, role);
      actor.position = filmPosition(actor.currentLocation, pose.x, pose.z); actor.rotation = pose.yaw;
      actor.currentAction = { type: 'idle', parameters: { resolved: true, epilogue: { ...encounter, role } }, startedAt: 0, duration: 1, progress: 0 };
      warm.updateAgent(role, actor); warm.update(.07);
      cold.updateAgent(role, structuredClone(actor)); cold.update(0);
      const body = warm.getAgentBody(role)!, points = vertices(body), floor = center.y - 1;
      const box = new THREE.Box3().setFromPoints(points), restored = new THREE.Box3().setFromPoints(vertices(cold.getAgentBody(role)!));
      assert.ok(box.min.y >= floor - .005, `${role}: visible mesh below lawn by ${floor - box.min.y}`);
      assert.ok(box.min.distanceTo(restored.min) < .00001 && box.max.distanceTo(restored.max) < .00001, `${role}: cold loading must reproduce the seat pose`);
      let inside = 0; const embedded: number[][] = [];
      for (const point of points) {
        const x = point.x - center.x - b.x, y = point.y - floor, z = point.z - center.z - b.z;
        if (Math.abs(x) >= (b.width - .35) / 2 - .04 || y <= b.surface - .115 || y >= b.surface - .005) continue;
        for (let slat = 0; slat < 5; slat++) if (Math.abs(z - (-.65 + slat * .32)) < .105) { inside++; embedded.push([x,y,z]); }
      }
      assert.equal(inside, 0, `${role}: visible vertices embedded in wooden seat ${JSON.stringify(embedded.slice(0, 10))}`);
      for (const dt of [0, .03, .1]) { warm.update(dt); const paused = new THREE.Box3().setFromPoints(vertices(body));
        assert.ok(box.min.distanceTo(paused.min) < .00001 && box.max.distanceTo(paused.max) < .00001, `${role}: renderer time cannot move a saved seated body`); }
    }
    const sati = world.agents.get('sati')!;
    sati.currentLocation = 'film_escape_streets'; sati.position = filmPosition(sati.currentLocation, 0, -12); sati.rotation = -Math.PI / 2;
    for (const elapsed of [0, .4, 1.6, 2.6, 3.2, 4, 4.6, 5.2, 6.4, 7.2]) {
      sati.currentAction = { type: 'idle', parameters: { epilogue: { ...newTrilogyEpilogue('reset'), phase: 'waking', elapsed, total: elapsed, role: 'sati' } }, startedAt: 0, duration: 1, progress: 0 };
      warm.updateAgent('sati', sati); warm.update(0);
      const floor = FILM_SETS.film_escape_streets.center.y - 1;
      const box = new THREE.Box3().setFromPoints(vertices(warm.getAgentBody('sati')!));
      assert.ok(Math.abs(box.min.y - floor) < .015, `Sati wake ${elapsed}: real visible surface must meet street, gap ${box.min.y - floor}`);
    }
  } finally { warm.dispose(); cold.dispose(); globalThis.document = document; }
});

test('the street waking shot keeps Sati’s real head and torso above the lower subtitle panel', t => {
  t.mock.method(THREE.TextureLoader.prototype, 'load', () => new THREE.Texture());
  t.mock.method(GLTFLoader.prototype, 'loadAsync', () => new Promise(() => {}));
  class Target extends EventTarget { matches() { return false; } }
  const context = { createRadialGradient: () => ({ addColorStop() {} }), fillRect() {}, strokeRect() {}, fillText() {},
    createImageData: (w: number, h: number) => ({ data: new Uint8ClampedArray(w * h * 4) }), putImageData() {} };
  const previous = { window: globalThis.window, document: globalThis.document };
  Object.assign(globalThis, { window: new Target(), document: Object.assign(new Target(), { hidden: false, pointerLockElement: null,
    exitPointerLock() {}, createElement: () => ({ getContext: () => context }) }) });
  const world = new WorldState(); new AgentManager(world).initializeAllAgents();
  const actor = world.agents.get('sati')!, renderer = new AgentRenderer(new THREE.Scene());
  const camera = new THREE.PerspectiveCamera(57, 16 / 9, .5, 5000);
  const controls = new PlayerControls(new Target() as unknown as HTMLCanvasElement, camera, () => {}, () => {});
  actor.currentLocation = 'film_escape_streets'; actor.isInMatrix = true;
  actor.position = filmPosition(actor.currentLocation, 0, -12); actor.rotation = -Math.PI / 2;
  actor.velocity = { x: 0, y: 0, z: 0 }; controls.possess(actor);
  try {
    for (const aspect of [16 / 9, 4 / 3, 9 / 16]) for (const elapsed of [0, .4, 1.6, 2.6, 3.2, 4, 5.2, 6.4, 7.2]) {
      actor.currentAction = { type: 'idle', parameters: { epilogue: { ...newTrilogyEpilogue('reset'), phase: 'waking', elapsed, total: elapsed, role: 'sati' } }, startedAt: 0, duration: 1, progress: 0 };
      renderer.updateAgent('sati', actor); const group = renderer.getAgent('sati')!;
      camera.aspect = aspect; camera.updateProjectionMatrix(); controls.update(.1, actor, group, false);
      renderer.setPlayer('sati', false); renderer.setPlayerMotion(controls.motion); renderer.update(0, camera, 0);
      camera.updateMatrixWorld(); group.updateWorldMatrix(true, true);
      const head = group.getObjectByName('sati-head')!;
      for (const [name, subject] of [['head', head], ['torso', head.parent!]] as const) {
        const screen = subject.getWorldPosition(new THREE.Vector3()).project(camera);
        assert.ok(Math.abs(screen.x) < .8 && screen.y > -.38 && screen.y < .8 && Math.abs(screen.z) < 1,
          `${aspect} waking ${elapsed}: ${name} hidden by caption or cropped: ${screen.toArray()}`);
      }
    }
    for (const aspect of [16 / 9, 4 / 3, 9 / 16]) for (const elapsed of [0, 2, 5, 8.8]) {
      const epilogue = { ...newTrilogyEpilogue('reset'), phase: 'cat' as const, elapsed, total: elapsed, role: 'sati' as const };
      actor.currentAction!.parameters.epilogue = epilogue;
      camera.aspect = aspect; camera.updateProjectionMatrix(); renderer.updateAgent('sati', actor);
      controls.update(1, actor, renderer.getAgent('sati')!, false); camera.updateMatrixWorld();
      const cat = streetResetPose(epilogue), center = FILM_SETS.film_escape_streets.center;
      const screen = new THREE.Vector3(center.x + cat.catX, center.y - .5, center.z + cat.catZ).project(camera);
      assert.ok(Math.abs(screen.x) < .94 && screen.y > -.38 && screen.y < .8, `${aspect} cat ${elapsed}: the approaching cat is outside the story frame ${screen.toArray()}`);
    }
  } finally { controls.dispose(); renderer.dispose(); Object.assign(globalThis, previous); }
});
