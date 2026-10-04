import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import test from 'node:test';
import * as THREE from 'three';
import { FILM_SETS, TRUCKS, filmPosition, type FilmJourney } from '@auto_matrix/shared';
import { FreewaySetRenderer } from '../packages/client/src/engine/FreewaySetRenderer.js';

const canvasDocument = () => ({ createElement: () => ({ width: 0, height: 0, getContext: () => ({
  createImageData: (width: number, height: number) => ({ data: new Uint8ClampedArray(width * height * 4) }),
  putImageData() {}, fillRect() {}, strokeRect() {}, fillText() {},
  createRadialGradient: () => ({ addColorStop() {} }),
}) }) }) as unknown as Document;
const journey = (): FilmJourney => ({ version: 1, scene: 'm2_trucks', actor: 'morpheus', step: 1,
  completed: [], enteredAt: 0, checkpoint: filmPosition('film_freeway_trucks'), reflections: {}, lastText: '',
  trucks: { phase: 'collision', elapsed: 9.9, lastTick: 0, attempt: 0 } });

function setup(t: { after: (callback: () => void) => void }) {
  const original = globalThis.document; globalThis.document = canvasDocument();
  const root = new THREE.Group(), renderer = new FreewaySetRenderer(root, FILM_SETS.film_freeway_trucks);
  t.after(() => { renderer.dispose(); globalThis.document = original; });
  return { root, renderer };
}
function cabVertices(rig: THREE.Object3D): THREE.Vector3[] {
  rig.updateWorldMatrix(true, true); const points: THREE.Vector3[] = [];
  rig.traverse(object => {
    if (!(object instanceof THREE.Mesh) || object.position.z > -8 || object.position.y < 1.4) return;
    const position = object.geometry.getAttribute('position');
    for (let i = 0; i < position.count; i++) points.push(object.getVertexPosition(i, new THREE.Vector3()).applyMatrix4(object.matrixWorld));
  });
  return points;
}
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
  for (const z of [20, 25, 32.5, 37]) {
    const ray = new THREE.Raycaster(new THREE.Vector3(TRUCKS.roof.x, 12, z), new THREE.Vector3(0, -1, 0));
    const surface = ray.intersectObject(rig, true)[0];
    assert.ok(surface && Math.abs(surface.point.y - TRUCKS.roof.height) < .15, `the server-supported trailer cannot move out from under the character at ${z}`);
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
