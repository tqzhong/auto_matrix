import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from 'three';
import { newDeusPact } from '@auto_matrix/shared';
import { MachineCoreRenderer } from '../packages/client/src/engine/MachineCoreRenderer.js';

const player = { x: 0, z: -25 };

test('the collective gathers individual machines into a face without scaling the entire head', () => {
  const root = new THREE.Group(), renderer = new MachineCoreRenderer(root);
  try {
    const face = root.getObjectByName('machine-core-face')!;
    const plates = root.getObjectByName('machine-core-face-plates') as THREE.InstancedMesh;
    const pose = { ...newDeusPact(), phase: 'forming' as const, elapsed: .7, total: 4 };
    renderer.update(pose, 1, false, player);
    const gathering = Array.from(plates.instanceMatrix.array);
    assert.deepEqual(face.scale.toArray(), [1, 1, 1]);
    renderer.update({ ...pose, phase: 'terms', elapsed: 0, total: 6 }, 1, false, player);
    assert.deepEqual(face.scale.toArray(), [1, 1, 1]);
    assert.notDeepEqual(Array.from(plates.instanceMatrix.array), gathering);
    const box = new THREE.Box3(), point = new THREE.Vector3(), matrix = new THREE.Matrix4();
    for (let i = 0; i < plates.count; i++) {
      plates.getMatrixAt(i, matrix); box.expandByPoint(point.setFromMatrixPosition(matrix));
    }
    const size = box.getSize(new THREE.Vector3());
    assert.ok(size.z > size.x * .25, `the face needs depth relative to its width, got ${size.toArray()}`);
    assert.ok(size.x > 20 && size.y > 22, 'the assembly keeps the full head silhouette');
    assert.equal(face.children.length, 1, 'the eyes and mouth belong to the machine surface, not separate giant spheres');
    let released = 0;
    plates.addEventListener('dispose', () => released++);
    renderer.dispose(); assert.equal(released, 1, 'the GPU instance buffer is released when leaving the set');
  } finally { if (root.children.length) renderer.dispose(); }
});

test('Neo’s perception lights the machines and foot ripples without changing physical geometry', () => {
  const root = new THREE.Group(), renderer = new MachineCoreRenderer(root);
  try {
    const state = newDeusPact();
    const plates = root.getObjectByName('machine-core-face-plates') as THREE.InstancedMesh;
    const material = plates.material as THREE.MeshStandardMaterial;
    renderer.update(state, 3, false, player);
    const geometry = Array.from(plates.instanceMatrix.array);
    assert.equal(root.getObjectByName('machine-core-footstep-ripples')!.visible, false);
    assert.equal(material.emissiveIntensity, 0);
    renderer.update(state, 3, true, player);
    assert.equal(root.getObjectByName('machine-core-footstep-ripples')!.visible, true);
    assert.ok(material.emissiveIntensity > 0);
    assert.deepEqual(Array.from(plates.instanceMatrix.array), geometry);
    renderer.update(state, 3, false, player);
    assert.equal(material.emissiveIntensity, 0);
  } finally { renderer.dispose(); }
});

test('the mechanical ribs arch above the traversable deck instead of disappearing beneath it', () => {
  const root = new THREE.Group(), renderer = new MachineCoreRenderer(root);
  try {
    root.updateMatrixWorld(true);
    const ribs: THREE.Object3D[] = [];
    root.traverse(object => { if (object.name === 'machine-core-overhead-rib') ribs.push(object); });
    assert.equal(ribs.length, 14);
    for (const rib of ribs) {
      const bounds = new THREE.Box3().setFromObject(rib);
      assert.ok(bounds.min.y > .5 && bounds.max.y > 15, `${bounds.min.y}..${bounds.max.y}`);
    }
  } finally { renderer.dispose(); }
});

test('leaving Neo’s subjective view restores the exact objective lighting of a cold saved frame', () => {
  const root = new THREE.Group(), renderer = new MachineCoreRenderer(root);
  const lights = () => {
    const result: { color: number; intensity: number }[] = [];
    root.traverse(object => { if (object instanceof THREE.Light) result.push({ color: object.color.getHex(), intensity: object.intensity }); });
    return result;
  };
  try {
    const beat = { ...newDeusPact(), phase: 'terms' as const, total: 8.2 };
    renderer.update(beat, 0, false, player); const objective = lights();
    for (let toggle = 0; toggle < 3; toggle++) {
      renderer.update(beat, 0, true, player);
      assert.notDeepEqual(lights(), objective, 'subjective view must still light the machines in gold');
      renderer.update(beat, 0, false, player);
      assert.deepEqual(lights(), objective, 'V cannot permanently recolor objective lights at the same saved beat');
    }
  } finally { renderer.dispose(); }
});

test('the segmented deck stays below the actual shoe-support plane', () => {
  const root = new THREE.Group(), renderer = new MachineCoreRenderer(root);
  try {
    const deck = root.getObjectByName('machine-core-segmented-deck')!;
    const bounds = new THREE.Box3().setFromObject(deck);
    assert.ok(bounds.max.y <= .02501, `grating reaches ${bounds.max.y}, above the .025 shoe-support plane`);
  } finally { renderer.dispose(); }
});
