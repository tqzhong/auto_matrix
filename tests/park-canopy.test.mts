import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import { parkLeafMask } from './helpers/park-leaf-mask.mjs';

test('the shipped leaf surfaces retain canopy coverage at every viewing distance within the existing triangle budgets', async () => {
  const alpha = await parkLeafMask();
  const bytes = await readFile(new URL('../packages/client/public/assets/park/waterfront-tree.glb', import.meta.url));
  const length = bytes.readUInt32LE(12), document = JSON.parse(bytes.subarray(20, 20 + length).toString());
  const binary = bytes.subarray(28 + length);
  const attribute = (index: number) => {
    const accessor = document.accessors[index], view = document.bufferViews[accessor.bufferView];
    const Type = accessor.componentType === 5126 ? Float32Array : Uint32Array;
    return new Type(binary.buffer, binary.byteOffset + view.byteOffset + (accessor.byteOffset ?? 0), accessor.count * (accessor.type === 'VEC3' ? 3 : accessor.type === 'VEC2' ? 2 : 1));
  };
  for (const [index, budget] of [[0, 80000], [1, 7000], [2, 1500]]) {
    const mesh = document.meshes[index], leaves = mesh.primitives.find((item: { material: number }) => document.materials[item.material].name.endsWith('_leaves'));
    const positions = attribute(leaves.attributes.POSITION), indices = attribute(leaves.indices), uv = attribute(leaves.attributes.TEXCOORD_0);
    let area = 0, cutoutArea = 0;
    for (let triangle = 0; triangle < indices.length; triangle += 3) {
      const a = indices[triangle] * 3, b = indices[triangle + 1] * 3, c = indices[triangle + 2] * 3;
      const x = positions[b] - positions[a], y = positions[b + 1] - positions[a + 1], z = positions[b + 2] - positions[a + 2];
      const X = positions[c] - positions[a], Y = positions[c + 1] - positions[a + 1], Z = positions[c + 2] - positions[a + 2];
      const triangleArea = Math.hypot(y * Z - z * Y, z * X - x * Z, x * Y - y * X) / 2;
      area += triangleArea;
      // Equal-area barycentric samples include the real atlas holes rather than counting empty card corners.
      let opaque = 0;
      for (let s = 0; s < 4; s++) for (let t = 0; t < 4; t++) {
        const root = Math.sqrt((s + .5) / 4), a = 1 - root, b = root * (1 - (t + .5) / 4), c = root * (t + .5) / 4;
        opaque += Number(alpha({ x: uv[indices[triangle] * 2] * a + uv[indices[triangle + 1] * 2] * b + uv[indices[triangle + 2] * 2] * c,
          y: uv[indices[triangle] * 2 + 1] * a + uv[indices[triangle + 1] * 2 + 1] * b + uv[indices[triangle + 2] * 2 + 1] * c }) >= .4);
      }
      cutoutArea += triangleArea * opaque / 16;
    }
    // The source has 27.8 m² of curved leaf surfaces. Triangle reduction must not erase most of that cover.
    // A coarse cutout estimate must retain at least half of that source area; native shots still check the crown.
    assert.ok(area > 22, `${mesh.name}: foliage reduction leaves a sparse crown (${area} m²)`);
    assert.ok(cutoutArea > 14, `${mesh.name}: transparent atlas padding cannot substitute for real leaf cover (${cutoutArea} m²)`);
    assert.ok(area < 160, `${mesh.name}: oversized cards cannot hide the canopy shape`);
    assert.ok(indices.length / 3 <= budget, `${mesh.name}: restore coverage without millions of triangles`);
    for (const name of ['TEXCOORD_0', 'TEXCOORD_1']) {
      const values = attribute(leaves.attributes[name]);
      assert.ok([...values].every(value => Number.isFinite(value) && value >= -.001 && value <= 1.001), `${mesh.name}: preserve valid atlas coordinates`);
    }
  }
});
