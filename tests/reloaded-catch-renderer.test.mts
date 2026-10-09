import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { newCatch, type FilmJourney } from '@auto_matrix/shared';
import { ReloadedCatchRenderer } from '../packages/client/src/engine/ReloadedCatchRenderer.js';

test('Trinity catch set shows the flyable city, saved fall, rooftop bullet and readable pulse', () => {
  const root = new THREE.Group(); const renderer = new ReloadedCatchRenderer(root);
  const state: FilmJourney = { version: 1, scene: 'm2_catch', actor: 'neo', step: 1, completed: [], enteredAt: 0,
    checkpoint: { x: 0, y: 0, z: 0 }, reflections: {}, lastText: '', catch: newCatch() };
  for (const name of ['catch-center-tower', 'catch-trinity-tower', 'catch-city-road', 'catch-rescue-roof', 'catch-heart-pulse', 'catch-extracted-bullet'])
    assert.ok(root.getObjectByName(name), name);
  const disposed: string[] = []; renderer.group.traverse(object => {
    if (object instanceof THREE.Mesh) object.geometry.addEventListener('dispose', () => disposed.push(object.uuid));
  });
  state.catch!.phase = 'flight'; state.catch!.elapsed = 2.3; renderer.update(state);
  const shards = renderer.group.children.find(child => child.children.some(mesh => mesh.name === 'catch-shard-0'))!;
  const before = shards.children[0].position.clone(); renderer.update(structuredClone(state));
  assert.ok(shards.children[0].position.equals(before), 'reloading the saved fall keeps the same glass positions');
  assert.equal(renderer.group.getObjectByName('catch-extracted-bullet')!.parent!.visible, false);
  state.catch!.phase = 'pulse'; state.catch!.elapsed = 1.1; state.catch!.focus = 2.4; renderer.update(state);
  assert.equal(renderer.group.getObjectByName('catch-heart-pulse')!.parent!.visible, true);
  assert.ok(renderer.group.getObjectByName('catch-heart-pulse')!.scale.x < 1);
  assert.ok(renderer.group.getObjectByName('catch-extracted-bullet')!.parent!.visible);
  renderer.dispose(); assert.equal(root.children.length, 0); assert.ok(disposed.length > 0);
});

test('the launch has a visible supporting floor and an actual openable facade aperture', async () => {
  const { CATCH, catchRoot } = await import('@auto_matrix/shared');
  const root = new THREE.Group(), renderer = new ReloadedCatchRenderer(root);
  renderer.update({ scene: 'm2_catch', catch: newCatch() } as FilmJourney); root.updateMatrixWorld(true);
  const at = catchRoot(newCatch(), 'neo');
  const ray = new THREE.Raycaster(new THREE.Vector3(at.x, at.y + .2, at.z), new THREE.Vector3(0, -1, 0));
  const floor = ray.intersectObject(renderer.group, true).find(hit => Math.abs(hit.point.y - at.y) < .08);
  assert.ok(floor, `no supporting floor at ${JSON.stringify(at)}`);
  const state = newCatch(); state.phase = 'flight'; renderer.update({ scene: 'm2_catch', catch: state } as FilmJourney); root.updateMatrixWorld(true);
  const throughWindow = new THREE.Raycaster(new THREE.Vector3(0, CATCH.start.y + 2.4, 47), new THREE.Vector3(0, 0, -1));
  assert.ok(!throughWindow.intersectObject(renderer.group, true).filter(hit => { for (let object: THREE.Object3D | null = hit.object; object; object = object.parent) if (!object.visible) return false; return true; }).some(hit => hit.point.z > 43 && hit.point.z < 44.5), 'a full opaque box still blocks the launch aperture');
  renderer.dispose();
});

test('front facade windows face the street rather than being culled from the player view', () => {
  const root = new THREE.Group(), renderer = new ReloadedCatchRenderer(root); root.updateMatrixWorld(true);
  const windows = root.getObjectByName('catch-lit-window-grid') as THREE.InstancedMesh;
  const matrix = new THREE.Matrix4(), point = new THREE.Vector3(); let front = 0;
  for (let i = 0; i < windows.count; i++) {
    windows.getMatrixAt(i, matrix); point.setFromMatrixPosition(matrix);
    if (Math.abs(point.z - (2 - 14 / 2 - .04)) > .01 || Math.abs(point.x) > 3.5) continue;
    const normal = new THREE.Vector3(0, 0, 1).transformDirection(matrix); assert.ok(normal.z < -.99, 'front glass faces into its tower'); front++;
  }
  assert.ok(front > 5); renderer.dispose();
});

test('the intact exit glass lets the player see the city before committing to the leap', () => {
  const root = new THREE.Group(), renderer = new ReloadedCatchRenderer(root);
  const pane = root.getObjectByName('catch-burning-exit') as THREE.Mesh;
  const material = pane.material as THREE.MeshStandardMaterial;
  assert.ok(material.transparent && material.opacity < .4, 'the launch window is an opaque painted rectangle');
  renderer.dispose();
});
