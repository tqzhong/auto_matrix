import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from 'three';
import { filmPosition, type FilmJourney, type SandboxState } from '@auto_matrix/shared';
import { PodSetRenderer } from '../packages/client/src/engine/PodSetRenderer.js';
import { FilmSetRenderer } from '../packages/client/src/engine/FilmSetRenderer.js';
import { WorldState } from '../packages/server/src/world/WorldState.js';
import { AgentManager } from '../packages/server/src/agents/AgentManager.js';

const journey = { scene: 'm1_pod', awakening: { kind: 'breather', elapsed: 2.943, emerged: true } } as FilmJourney;
const meshes = (root: THREE.Group) => root.getObjectByName('pod-distant-towers')!.children as THREE.InstancedMesh[];
const snapshot = (mesh: THREE.InstancedMesh) => Array.from({ length: mesh.count }, (_, i) => {
  const matrix = new THREE.Matrix4(); mesh.getMatrixAt(i, matrix); return matrix.elements.join(',');
});
const triangles = (batches: THREE.InstancedMesh[]) => batches.reduce((sum, mesh) => sum + mesh.count * mesh.geometry.index!.count / 3, 0);
function view(root: THREE.Group, aspect: number, eye: number[], target: number[]): THREE.PerspectiveCamera {
  root.updateMatrixWorld(true);
  const camera = new THREE.PerspectiveCamera(68, aspect, .06, 5000);
  camera.position.copy(root.localToWorld(new THREE.Vector3(...eye)));
  camera.lookAt(root.localToWorld(new THREE.Vector3(...target))); camera.updateMatrixWorld(true); return camera;
}
function omittedSurfaces(batches: THREE.InstancedMesh[], original: string[][], camera: THREE.Camera): number {
  const projection = new THREE.Matrix4().multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
  const frustum = new THREE.Frustum().setFromProjectionMatrix(projection);
  const point = new THREE.Vector3(), matrix = new THREE.Matrix4(); let rejected = 0;
  batches.forEach((mesh, part) => {
    const shown = new Set(snapshot(mesh));
    for (const key of original[part]) {
      if (shown.has(key)) continue;
      rejected++; matrix.fromArray(key.split(',').map(Number)).premultiply(mesh.matrixWorld);
      const positions = mesh.geometry.attributes.position;
      // Independent convex-hull proof: every actual vertex must be outside
      // the same camera plane, not merely its center offscreen.
      assert.ok(frustum.planes.some(plane => {
        for (let vertex = 0; vertex < positions.count; vertex++) {
          point.fromBufferAttribute(positions, vertex).applyMatrix4(matrix);
          if (plane.distanceToPoint(point) >= 0) return false;
        }
        return true;
      }), `part ${part} omitted a surface that cannot be proved outside one view plane`);
    }
  });
  return rejected;
}

test('the cultivation view does not submit whole offscreen instance rings and keeps every potentially visible surface', () => {
  const root = new THREE.Group(), renderer = new PodSetRenderer(root), batches = meshes(root);
  const original = batches.map(snapshot), geometry = batches.map(mesh => mesh.geometry), materials = batches.map(mesh => mesh.material);
  const allTriangles = triangles(batches);
  const camera = view(root, 16 / 9, [0, 4, -13], [0, 4, -80]);
  try {
    assert.equal(batches.length, 7); assert.ok(allTriangles > 1_000_000);
    renderer.update(journey, 100, true, undefined, camera);
    assert.ok(triangles(batches) < allTriangles * .5, `submit visible pods, not ${triangles(batches)} of ${allTriangles} triangles`);
    batches.forEach((mesh, part) => {
      const shown = new Set(snapshot(mesh));
      assert.equal(mesh.geometry, geometry[part]); assert.equal(mesh.material, materials[part]);
      for (const key of shown) assert.ok(original[part].includes(key), 'selection must not invent or deform instances');
    });
    assert.ok(omittedSurfaces(batches, original, camera) > 6000);
  } finally { renderer.dispose(); }
});

test('turning, portrait views and cold loads restore pods without changing geometry or repeatedly uploading a paused view', () => {
  const root = new THREE.Group(); root.position.set(5056, -100, 4416); root.rotation.y = .47; root.scale.set(1.1, .9, 1.2);
  const renderer = new PodSetRenderer(root), batches = meshes(root), original = batches.map(snapshot);
  const perspectives = [
    [16 / 9, [0, 4, -13], [0, 4, -100]], [9 / 16, [0, 4, -13], [95, 80, 35]],
    [16 / 9, [-.85, -15.5, 11.5], [28, 21, 11.5]], [16 / 9, [0, 70, 12], [0, -40, -14]],
  ] as const;
  try {
    let first: string[][] | undefined;
    for (const [aspect, eye, target] of [...perspectives, perspectives[0]]) {
      const camera = view(root, aspect, [...eye], [...target]);
      renderer.update(journey, 100, true, undefined, camera);
      const selected = batches.map(snapshot), versions = batches.map(mesh => mesh.instanceMatrix.version);
      assert.ok(omittedSurfaces(batches, original, camera) > 1000, 'verify actual omitted surfaces in every transformed/portrait/rescue/aerial view');
      if (!first) first = selected; else if (eye === perspectives[0][1]) assert.deepEqual(selected, first);
      for (let frame = 0; frame < 12; frame++) renderer.update(journey, 100, true, undefined, camera);
      assert.deepEqual(batches.map(mesh => mesh.instanceMatrix.version), versions, 'a paused selection must not upload instance matrices again');
      const coldRoot = new THREE.Group(); coldRoot.position.copy(root.position); coldRoot.quaternion.copy(root.quaternion); coldRoot.scale.copy(root.scale);
      const cold = new PodSetRenderer(coldRoot);
      try { cold.update(structuredClone(journey), 900, true, undefined, camera); assert.deepEqual(meshes(coldRoot).map(snapshot), selected); }
      finally { cold.dispose(); }
    }
    root.getObjectByName('pod-distant-towers')!.frustumCulled = false;
    renderer.update(journey, 100, true, undefined, view(root, 16 / 9, [0, 4, -13], [0, 4, -100]));
    assert.deepEqual(batches.map(snapshot), original, 'the actual comparison control must restore every original instance');
    root.getObjectByName('pod-distant-towers')!.frustumCulled = true;
    renderer.update(journey, 100, true);
    assert.deepEqual(batches.map(snapshot), original, 'renderers without a camera retain the complete world');
  } finally { renderer.dispose(); }
});

test('the real film renderer supplies the active player camera for distant pod selection', t => {
  const original = globalThis.document;
  t.mock.method(THREE.TextureLoader.prototype, 'load', () => new THREE.Texture());
  globalThis.document = { createElement: () => ({ width: 0, height: 0, getContext: () => ({
    createImageData: (width: number, height: number) => ({ data: new Uint8ClampedArray(width * height * 4) }),
    putImageData() {}, fillRect() {}, strokeRect() {}, fillText() {}, createRadialGradient: () => ({ addColorStop() {} }),
  }) }) } as unknown as Document;
  const scene = new THREE.Scene(), renderer = new FilmSetRenderer(scene);
  t.after(() => { renderer.dispose(); globalThis.document = original; });
  const world = new WorldState(); new AgentManager(world).initializeAllAgents(); const neo = world.agents.get('neo')!;
  Object.assign(neo, { position: filmPosition('film_power_plant_pods', 0, -13), currentLocation: 'film_power_plant_pods', isInMatrix: false, currentAction: null });
  const sandbox = { neoLife: { journey: { ...journey, actor: 'neo', completed: [], reflections: {} } } } as SandboxState;
  const camera = new THREE.PerspectiveCamera(68, 16 / 9, .06, 5000); camera.position.set(neo.position.x, neo.position.y + 4, neo.position.z);
  camera.lookAt(neo.position.x, neo.position.y + 4, neo.position.z - 100); camera.updateMatrixWorld(true);
  renderer.update(neo, sandbox, 100, neo.position, camera.position, undefined, true, 12000, camera);
  const batches = meshes(renderer.root), selected = triangles(batches);
  renderer.update(neo, sandbox, 100, neo.position, camera.position, undefined, true);
  assert.ok(selected < triangles(batches) * .5, 'unit selection must also run in the actual gameplay update path');
});

test('a paused view reuses its selection but camera and set transforms invalidate it on the first changed frame', t => {
  const root = new THREE.Group(), renderer = new PodSetRenderer(root);
  const camera = view(root, 16 / 9, [0, 4, -13], [0, 4, -100]);
  try {
    renderer.update(journey, 100, true, undefined, camera);
    const check = t.mock.method(THREE.Frustum.prototype, 'intersectsSphere');
    for (let frame = 0; frame < 12; frame++) renderer.update(journey, 100, true, undefined, camera);
    assert.equal(check.mock.callCount(), 0, 'unchanged camera and set matrices must not recheck thousands of fixed pod bounds');
    camera.lookAt(100, 4, -13); camera.updateMatrixWorld(true);
    renderer.update(journey, 100, true, undefined, camera);
    assert.ok(check.mock.callCount() > 6000, 'a turn must immediately rebuild the selected set');
    check.mock.resetCalls(); root.position.x = 50;
    renderer.update(journey, 100, true, undefined, camera);
    assert.ok(check.mock.callCount() > 6000, 'the same camera looking at a relocated set must be reevaluated');
  } finally { renderer.dispose(); }
});
