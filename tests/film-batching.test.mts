import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from 'three';
import { PILL_ROOM, filmPosition } from '@auto_matrix/shared';
import { FilmSetRenderer } from '../packages/client/src/engine/FilmSetRenderer.js';
import { WorldState } from '../packages/server/src/world/WorldState.js';
import { AgentManager } from '../packages/server/src/agents/AgentManager.js';

test('Lafayette batching reuses shared vertices without changing any triangle, surface normal, UV or shadow caster', t => {
  t.mock.method(THREE.TextureLoader.prototype, 'load', () => new THREE.Texture());
  const document = globalThis.document;
  globalThis.document = { createElement: () => ({ getContext: () => ({ fillRect() {}, strokeRect() {}, fillText() {}, beginPath() {}, moveTo() {}, lineTo() {}, closePath() {}, stroke() {}, fill() {} }) }) } as unknown as Document;
  const prototype = FilmSetRenderer.prototype as unknown as { batch(): void }, batch = prototype.batch;
  let checked = false;
  t.mock.method(prototype, 'batch', function(this: FilmSetRenderer) {
    const surfaces = () => {
      this.root.updateMatrixWorld(true);
      const inverse = this.root.matrixWorld.clone().invert();
      const result = new Map<THREE.Material, number[]>();
      let vertices = 0, bytes = 0, indexed = true;
      this.root.traverse(object => {
        if (!(object instanceof THREE.Mesh) || Array.isArray(object.material)) return;
        let ancestor: THREE.Object3D | null = object;
        while (ancestor && ancestor !== this.root) { if (ancestor.userData.dynamic) return; ancestor = ancestor.parent; }
        assert.ok(object.castShadow && object.receiveShadow, 'fixed architecture and furniture keep both kinds of shadows');
        const transform = inverse.clone().multiply(object.matrixWorld), normalTransform = new THREE.Matrix3().getNormalMatrix(transform);
        const geometry = object.geometry, index = geometry.index, { position, normal, uv } = geometry.attributes;
        vertices += position.count; indexed &&= Boolean(index);
        bytes += Object.values(geometry.attributes).reduce((sum, attribute) => sum + attribute.array.byteLength, 0) + (index?.array.byteLength ?? 0);
        const values = result.get(object.material) ?? [];
        for (let i = 0; i < (index?.count ?? position.count); i++) {
          const vertex = index ? index.getX(i) : i;
          const p = new THREE.Vector3().fromBufferAttribute(position, vertex).applyMatrix4(transform);
          const n = new THREE.Vector3().fromBufferAttribute(normal, vertex).applyMatrix3(normalTransform).normalize();
          values.push(p.x, p.y, p.z, n.x, n.y, n.z, uv.getX(vertex), uv.getY(vertex));
        }
        result.set(object.material, values);
      });
      return { result, vertices, bytes, indexed };
    };
    const before = surfaces(); batch.call(this); const after = surfaces();
    t.diagnostic(JSON.stringify({ inputVertices: before.vertices, indexedVertices: after.vertices, indexedBytes: after.bytes,
      triangleCorners: [...after.result.values()].reduce((sum, values) => sum + values.length / 8, 0) }));
    assert.equal(after.indexed, true, 'batching must not expand already shared furniture vertices into three independent triangle corners');
    assert.ok(after.vertices < before.vertices * .65, `the actual padded chairs and room must share their repeated corners: ${before.vertices} -> ${after.vertices}`);
    assert.equal(after.result.size, before.result.size, 'all material assignments survive');
    for (const [material, expected] of before.result) {
      const actual = after.result.get(material)!;
      assert.equal(actual.length, expected.length, 'no triangles or attributes may be dropped');
      for (let i = 0; i < expected.length; i++) assert.ok(Math.abs(actual[i] - expected[i]) < 1e-5,
        `position/normal/UV ${i} changed during batching: ${expected[i]} -> ${actual[i]}`);
    }
    checked = true;
  });
  const world = new WorldState(); new AgentManager(world).initializeAllAgents();
  const neo = world.agents.get('neo')!; neo.position = filmPosition('film_lafayette', PILL_ROOM.seat, PILL_ROOM.z); neo.isInMatrix = true;
  const renderer = new FilmSetRenderer(new THREE.Scene());
  try { renderer.update(neo, undefined, 0); assert.ok(checked, 'exercise the real loaded room batch'); }
  finally { renderer.dispose(); globalThis.document = document; }
});
