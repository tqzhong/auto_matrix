import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from 'three';
import { FILM_SETS, LAFAYETTE, PILL_ROOM, filmBlocked, filmPosition } from '@auto_matrix/shared';
import { FilmSetRenderer } from '../packages/client/src/engine/FilmSetRenderer.js';
import { WorldState } from '../packages/server/src/world/WorldState.js';
import { AgentManager } from '../packages/server/src/agents/AgentManager.js';

test('the Lafayette meeting has low window sills, recessed wall panels and a solid arched fireplace', t => {
  t.mock.method(THREE.TextureLoader.prototype, 'load', () => new THREE.Texture());
  const document = globalThis.document;
  globalThis.document = { createElement: () => ({ getContext: () => ({ fillRect() {}, strokeRect() {}, fillText() {}, beginPath() {}, moveTo() {}, lineTo() {}, closePath() {}, stroke() {}, fill() {} }) }) } as unknown as Document;
  const world = new WorldState(); new AgentManager(world).initializeAllAgents();
  const neo = world.agents.get('neo')!; neo.position = filmPosition('film_lafayette', PILL_ROOM.seat, PILL_ROOM.z); neo.isInMatrix = true;
  const renderer = new FilmSetRenderer(new THREE.Scene());
  try {
    renderer.update(neo, undefined, 0); renderer.root.updateMatrixWorld(true);
    const ray = new THREE.Raycaster();
    const hit = (x: number, y: number, z: number, direction: THREE.Vector3, distance: number) => {
      ray.set(renderer.root.localToWorld(new THREE.Vector3(x, y, z)), direction); ray.far = distance;
      return ray.intersectObject(renderer.root, true).find(item => {
        const mesh = item.object as THREE.Mesh;
        return mesh.castShadow && !Array.isArray(mesh.material) && !mesh.material.transparent;
      });
    };
    for (const z of [-18, -2, 14]) {
      assert.equal(Boolean(hit(-19.5, 2, z + .7, new THREE.Vector3(-1, 0, 0), 4)), false,
        'the tall window reaches below standing waist level instead of sitting on a high solid wall');
      assert.ok(hit(-19.5, .35, z + .7, new THREE.Vector3(-1, 0, 0), 4), 'the low sill still has a solid base');
    }
    const panelDepths: number[] = [];
    for (let x = -19; x <= -10; x += .06) {
      const surface = hit(x, 4.8, -9.5, new THREE.Vector3(0, 0, -1), 2);
      assert.ok(surface, 'the framed plaster panel must remain a closed wall');
      panelDepths.push(renderer.root.worldToLocal(surface.point).z);
    }
    assert.ok(Math.max(...panelDepths) - Math.min(...panelDepths) > .2,
      'the broad mouldings stand in front of a recessed panel rather than drawing thin lines on wallpaper');
    let panelTriangles = 0;
    renderer.root.traverse(object => {
      if (!(object instanceof THREE.Mesh) || !(object.material instanceof THREE.MeshStandardMaterial)
        || ![0x535d4b, 0x737a66].includes(object.material.color.getHex())) return;
      panelTriangles += (object.geometry.index?.count ?? object.geometry.attributes.position.count) / 3;
    });
    assert.ok(panelTriangles < 12000, `the fixed room's narrow wall mouldings must not dominate its geometry (${panelTriangles} triangles)`);
    const f = PILL_ROOM.fireplace, front = f.z + f.depth / 2 + .12;
    assert.equal(Boolean(hit(0, 3.25, front, new THREE.Vector3(0, 0, -1), .65)), false,
      'the middle of the arched firebox must be a recessed opening');
    assert.ok(hit(1.95, 3.25, front, new THREE.Vector3(0, 0, -1), .65),
      'the sides of the curved arch must contain real stone');
    assert.equal(filmBlocked(filmPosition('film_lafayette', 3.7, -10.4), FILM_SETS.film_lafayette, .08), false,
      'the narrower fireplace must release the space occupied only by its previous wide collision');
    const ceiling = hit(0, 8, 6, new THREE.Vector3(0, 1, 0), 8);
    assert.ok(ceiling);
    assert.ok(renderer.root.worldToLocal(ceiling.point).y < LAFAYETTE.door.height * 1.6,
      'the room ceiling must remain proportionate to the existing tall entrance');
  } finally { renderer.dispose(); globalThis.document = document; }
});
