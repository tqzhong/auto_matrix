import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from 'three';
import { FILM_SETS, PILL_ROOM, filmBlocked, filmPosition } from '@auto_matrix/shared';
import { FilmSetRenderer } from '../packages/client/src/engine/FilmSetRenderer.js';
import { WorldState } from '../packages/server/src/world/WorldState.js';
import { AgentManager } from '../packages/server/src/agents/AgentManager.js';

test('Lafayette windows, fireplace and tracking passage have matching visible geometry and access', t => {
  t.mock.method(THREE.TextureLoader.prototype, 'load', () => new THREE.Texture());
  const document = globalThis.document;
  globalThis.document = { createElement: () => ({ getContext: () => ({ fillRect() {}, strokeRect() {}, fillText() {}, beginPath() {}, moveTo() {}, lineTo() {}, closePath() {}, stroke() {}, fill() {} }) }) } as unknown as Document;
  const world = new WorldState(); new AgentManager(world).initializeAllAgents();
  const neo = world.agents.get('neo')!; neo.position = filmPosition('film_lafayette', 1.75, -6); neo.isInMatrix = true;
  const renderer = new FilmSetRenderer(new THREE.Scene());
  try {
    renderer.update(neo, undefined, 0); renderer.root.updateMatrixWorld(true);
    const ray = new THREE.Raycaster();
    const blockers = (point: THREE.Vector3, direction: THREE.Vector3, distance: number) => {
      ray.set(renderer.root.localToWorld(point), direction); ray.far = distance;
      return ray.intersectObject(renderer.root, true).filter(hit => {
        const mesh = hit.object as THREE.Mesh;
        return mesh.castShadow && !Array.isArray(mesh.material) && !mesh.material.transparent;
      });
    };
    for (const z of [-18, -2, 14]) {
      assert.equal(blockers(new THREE.Vector3(-19.5, 8, z + .7), new THREE.Vector3(-1, 0, 0), 4).length, 0,
        `the window at ${z} must not be glass glued onto an opaque wall`);
      assert.ok(blockers(new THREE.Vector3(-19.5, 2, z + .7), new THREE.Vector3(-1, 0, 0), 4).length > 0,
        'the solid sill below the glazing remains');
    }
    for (const x of [-7, -6, -5]) for (const y of [1, 3, 5]) {
      assert.equal(blockers(new THREE.Vector3(x, y, -10.5), new THREE.Vector3(0, 0, -1), 2).length, 0,
        'the chair-to-mirror route must remain visually open');
    }
    assert.ok(blockers(new THREE.Vector3(0, 4.1, -9), new THREE.Vector3(0, 0, -1), 1.9).length > 0,
      'the carved fireplace must be visible immediately behind the meeting table');
    assert.equal(filmBlocked(filmPosition('film_lafayette', 3.1, -10.4), FILM_SETS.film_lafayette, .1), true,
      'the projecting fireplace pilaster must be solid to the player');
    const cup = renderer.root.getObjectByName('pill-water-glass')!;
    const beneathGlass = blockers(cup.position.clone(), new THREE.Vector3(0, -1, 0), .4)[0];
    assert.ok(beneathGlass, 'the glass must sit on the table');
    assert.ok(Math.abs(renderer.root.worldToLocal(beneathGlass.point).y - (cup.position.y - .22)) < .012,
      'the glass base must contact the visible tabletop without hovering');
    assert.equal(blockers(new THREE.Vector3(1.45, 2.8, PILL_ROOM.tableZ - .6), new THREE.Vector3(0, -1, 0), 2.5).length, 0,
      'a slender side table must not retain the large rectangular coffee-table corners');
    assert.equal(filmBlocked(filmPosition('film_lafayette', 1.45, PILL_ROOM.tableZ - .6), FILM_SETS.film_lafayette, .05), false,
      'shrinking the visible table must also remove its old invisible collision');
    const crown = (side: number) => blockers(new THREE.Vector3(PILL_ROOM.seat - 1, 3.35, PILL_ROOM.z + side * .65), new THREE.Vector3(1, 0, 0), 3).length;
    assert.ok(crown(0) > 0 && crown(1.7) === 0 && crown(-1.7) === 0,
      'the upholstered crown must curve down toward its shoulders instead of forming a square slab');
    for (const side of [-1, 1]) assert.ok(blockers(new THREE.Vector3(PILL_ROOM.seat + .9 * .65, 2.3, PILL_ROOM.z + side * 2.2 * .65),
      new THREE.Vector3(0, 0, -side), .6).length > 0, 'the wing upholstery must be closed from both outside views');
  } finally { renderer.dispose(); globalThis.document = document; }
});
