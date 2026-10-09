import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from 'three';
import { DOCK_EMP, FILM_SETS, dockEmpSentinel, filmPosition, newDockGate, newDiggers, type FilmJourney, type SandboxState } from '@auto_matrix/shared';
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

test('switching back inside the Hammer restores the cabin with its CRTs powered off', t => {
  const original = globalThis.document;
  globalThis.document = { createElement: () => ({ width: 0, height: 0, getContext: () => ({
    createImageData: (width: number, height: number) => ({ data: new Uint8ClampedArray(width * height * 4) }),
    putImageData() {}, fillRect() {}, strokeRect() {}, fillText() {}, createRadialGradient: () => ({ addColorStop() {} }),
  }) }) } as unknown as Document;
  t.mock.method(THREE.TextureLoader.prototype, 'load', () => new THREE.Texture());
  const scene = new THREE.Scene(), renderer = new FilmSetRenderer(scene);
  t.after(() => { renderer.dispose(); globalThis.document = original; });
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
  journey.emp = { firedAt: 12, elapsed: 1.8 }; journey.step = 1;
  link.currentAction = { type: 'idle', parameters: { dockEmp: 1.8 }, startedAt: 0, duration: 1, progress: 0 };
  renderer.update(link, sandbox, 1, link.position);
  assert.equal(renderer.root.visible, false, 'the exterior shot does not keep rendering the remote cabin');
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
});
