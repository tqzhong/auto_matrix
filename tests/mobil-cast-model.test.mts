import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MOBIL_STATION, MOBIL_FAMILY, filmObstacles, FILM_SETS } from '@auto_matrix/shared';
import { CharacterModels } from '../packages/client/src/agents/CharacterModel.js';
import { WorldState } from '../packages/server/src/world/WorldState.js';
import { AgentManager } from '../packages/server/src/agents/AgentManager.js';

test('Kamala’s paused Mobil bench pose is supported and identical on a cold load', t => {
  t.mock.method(THREE.TextureLoader.prototype, 'load', () => new THREE.Texture());
  t.mock.method(GLTFLoader.prototype, 'loadAsync', () => new Promise(() => {}));
  const previous = globalThis.document;
  globalThis.document = { createElement: () => ({ getContext: () => ({ createImageData: (w: number, h: number) => ({ data: new Uint8ClampedArray(w * h * 4) }), putImageData() {} }) }) } as unknown as Document;
  const world = new WorldState(); new AgentManager(world).initializeAllAgents(); const models = new CharacterModels();
  try {
    const warm = models.create(world.agents.get('kamala')!), cold = models.create(world.agents.get('kamala')!);
    const input = { speed: 0, grounded: true, verticalVelocity: 0, turn: 0, seated: true, mobilStation: true };
    models.animate(warm, .3, input, 1); models.animate(cold, 0, input, 1);
    assert.ok(cold.torso.position.y < 1.75, 'the cold actor must sit, rather than stand through the bench');
    for (const rig of [warm, cold]) {
      rig.root.position.set(MOBIL_FAMILY[1].x, 0, MOBIL_FAMILY[1].z); rig.root.rotation.y = Math.PI / 2;
      rig.root.updateMatrixWorld(true);
      let lowest = Infinity; const penetration: { name: string; point: number[] }[] = [];
      rig.detail.traverseVisible(object => {
        if (!(object instanceof THREE.Mesh)) return;
        for (let i = 0; i < object.geometry.attributes.position.count; i++) {
          const point = object.localToWorld(object.getVertexPosition(i, new THREE.Vector3())); lowest = Math.min(lowest, point.y);
          if (Math.abs(point.x - MOBIL_STATION.bench.x) < .82 && Math.abs(point.z - MOBIL_STATION.bench.z) < 3
            && point.y > MOBIL_STATION.bench.seat - .18 && point.y < MOBIL_STATION.bench.seat - .04) penetration.push({ name: object.name || object.type, point: point.toArray() });
        }
      });
      assert.ok(lowest >= -.015 && lowest < .03, `the seated feet must meet the platform, gap ${lowest}`);
      assert.equal(penetration.length, 0, `the visible legs and skirt cut through the seat: ${JSON.stringify(penetration.slice(0, 8))}`);
    }
    assert.deepEqual(cold.torso.position.toArray(), warm.torso.position.toArray());
    assert.deepEqual(cold.hips.map(j => j.quaternion.toArray()), warm.hips.map(j => j.quaternion.toArray()));
    const bench = filmObstacles(FILM_SETS.film_mobil_station)[0];
    assert.ok(bench.depth > bench.width, 'the bench and its collision must run along the station wall');
  } finally { models.dispose(); globalThis.document = previous; }
});
