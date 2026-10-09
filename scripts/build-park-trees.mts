// Offline LODs of Poly Haven's CC0 tree. The game only loads the reduced GLB and 1K maps.
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { createHash } from 'node:crypto';
import { MeshoptSimplifier } from 'meshoptimizer';

const source = resolve(process.argv[2] ?? 'output/gameplay/trilogy-park-vegetation-2026-10-07/source');
const output = resolve('packages/client/public/assets/park');
const metadata = JSON.parse(await readFile(resolve(source, 'download-metadata.json'), 'utf8'));
const json = await readFile(resolve(source, 'tree_small_02_1k.gltf'));
const binary = await readFile(resolve(source, 'tree_small_02.bin'));
for (const [bytes, expected] of [[json, metadata.gltf.md5], [binary, metadata.gltf.include['tree_small_02.bin'].md5]] as const)
  if (createHash('md5').update(bytes).digest('hex') !== expected) throw Error('Tree source checksum mismatch');
const original = JSON.parse(json.toString());
const sizes: Record<string, number> = { SCALAR: 1, VEC2: 2, VEC3: 3 };
function attribute(index: number): Float32Array | Uint32Array | Uint16Array {
  const accessor = original.accessors[index], view = original.bufferViews[accessor.bufferView];
  if (view.byteStride) throw Error('Unexpected interleaved tree source');
  const Type = accessor.componentType === 5126 ? Float32Array : accessor.componentType === 5125 ? Uint32Array : Uint16Array;
  return new Type(binary.buffer, binary.byteOffset + (view.byteOffset ?? 0) + (accessor.byteOffset ?? 0), accessor.count * sizes[accessor.type]);
}
function leafCards(primitive: typeof original.meshes[0].primitives[number], budget: number, expansion: number) {
  const positions = attribute(primitive.attributes.POSITION) as Float32Array;
  const indices = attribute(primitive.indices), uv = attribute(primitive.attributes.TEXCOORD_0), uv1 = attribute(primitive.attributes.TEXCOORD_1);
  const normals = attribute(primitive.attributes.NORMAL);
  // Fit each connected leaf's UV plane to its original surface. The cutout atlas preserves its outline.
  const parent = Uint32Array.from({ length: positions.length / 3 }, (_, i) => i);
  const root = (n: number): number => { while (parent[n] !== n) { parent[n] = parent[parent[n]]; n = parent[n]; } return n; };
  for (let i = 0; i < indices.length; i += 3) { const a = root(indices[i]), b = root(indices[i + 1]), c = root(indices[i + 2]); parent[b] = parent[c] = a; }
  const roots = new Set<number>(); for (let i = 0; i < indices.length; i += 3) roots.add(root(indices[i]));
  const hash = (key: number) => Math.imul(key + 1, 2654435761) >>> 0;
  const selected = new Set([...roots].sort((a, b) => hash(a) - hash(b)).slice(0, Math.floor(budget / 2)));
  const islands = new Map<number, Float64Array>();
  for (let vertex = 0; vertex < parent.length; vertex++) {
    const key = root(vertex);
    if (!selected.has(key)) continue;
    let sums = islands.get(key);
    if (!sums) { sums = new Float64Array(32); for (const index of [6, 8, 25, 27]) sums[index] = Infinity; for (const index of [7, 9, 26, 28]) sums[index] = -Infinity; islands.set(key, sums); }
    const u = uv[vertex * 2], v = uv[vertex * 2 + 1];
    sums[0]++; sums[1] += u; sums[2] += v; sums[3] += u * u; sums[4] += u * v; sums[5] += v * v;
    sums[6] = Math.min(sums[6], u); sums[7] = Math.max(sums[7], u); sums[8] = Math.min(sums[8], v); sums[9] = Math.max(sums[9], v);
    for (let k = 0; k < 5; k++) {
      const value = k < 3 ? positions[vertex * 3 + k] : uv1[vertex * 2 + k - 3], offset = 10 + k * 3;
      sums[offset] += value; sums[offset + 1] += value * u; sums[offset + 2] += value * v;
    }
    for (let k = 0; k < 2; k++) { sums[25 + k * 2] = Math.min(sums[25 + k * 2], uv1[vertex * 2 + k]); sums[26 + k * 2] = Math.max(sums[26 + k * 2], uv1[vertex * 2 + k]); }
    for (let k = 0; k < 3; k++) sums[29 + k] += normals[vertex * 3 + k];
  }
  const packed: Record<string, number[]> = { POSITION: [], NORMAL: [], TEXCOORD_0: [], TEXCOORD_1: [] }, triangles: number[] = [];
  for (const sums of islands.values()) {
    const count = sums[0], meanU = sums[1] / count, meanV = sums[2] / count;
    const uu = sums[3] - sums[1] * meanU, uv = sums[4] - sums[1] * meanV, vv = sums[5] - sums[2] * meanV, determinant = uu * vv - uv * uv;
    if (determinant < 1e-14) continue;
    const fit = Array.from({ length: 5 }, (_, k) => {
      const offset = 10 + k * 3, u = sums[offset + 1] - sums[offset] * meanU, v = sums[offset + 2] - sums[offset] * meanV;
      return [sums[offset] / count, (u * vv - v * uv) / determinant, (v * uu - u * uv) / determinant];
    });
    const normal = [fit[1][1] * fit[2][2] - fit[2][1] * fit[1][2], fit[2][1] * fit[0][2] - fit[0][1] * fit[2][2], fit[0][1] * fit[1][2] - fit[1][1] * fit[0][2]];
    const length = Math.hypot(...normal); if (length < 1e-10) continue;
    const reverse = normal.reduce((dot, value, k) => dot + value * sums[29 + k], 0) < 0;
    const first = packed.POSITION.length / 3;
    for (const [u, v] of [[sums[6], sums[8]], [sums[7], sums[8]], [sums[7], sums[9]], [sums[6], sums[9]]]) {
      for (let k = 0; k < 3; k++) { packed.POSITION.push(fit[k][0] + ((u - meanU) * fit[k][1] + (v - meanV) * fit[k][2]) * expansion + (k === 1 ? .02410384640097618 : 0)); packed.NORMAL.push(normal[k] / length * (reverse ? -1 : 1)); }
      packed.TEXCOORD_0.push(u, v);
      for (let k = 0; k < 2; k++) packed.TEXCOORD_1.push(Math.max(sums[25 + k * 2], Math.min(sums[26 + k * 2], fit[k + 3][0] + (u - meanU) * fit[k + 3][1] + (v - meanV) * fit[k + 3][2])));
    }
    triangles.push(...(reverse ? [first, first + 2, first + 1, first, first + 3, first + 2] : [first, first + 1, first + 2, first, first + 2, first + 3]));
  }
  return { attributes: Object.fromEntries(Object.entries(packed).map(([key, values]) => [key, Float32Array.from(values)])), indices: Uint32Array.from(triangles), leafCards: triangles.length / 6 };
}
await mkdir(output, { recursive: true }); await MeshoptSimplifier.ready;
const chunks: Buffer[] = [], views: object[] = [], accessors: object[] = [], meshes: object[] = [], statistics: object[] = [];
let offset = 0;
function append(array: Float32Array | Uint32Array, type: string, position = false): number {
  const bytes = Buffer.from(array.buffer, array.byteOffset, array.byteLength);
  views.push({ buffer: 0, byteOffset: offset, byteLength: bytes.length }); chunks.push(bytes); offset += bytes.length;
  const accessor: Record<string, unknown> = { bufferView: views.length - 1, componentType: array instanceof Float32Array ? 5126 : 5125, count: array.length / sizes[type], type };
  if (position) {
    const min = [Infinity, Infinity, Infinity], max = [-Infinity, -Infinity, -Infinity];
    for (let i = 0; i < array.length; i += 3) for (let k = 0; k < 3; k++) { min[k] = Math.min(min[k], array[i + k]); max[k] = Math.max(max[k], array[i + k]); }
    Object.assign(accessor, { min, max });
  }
  accessors.push(accessor); return accessors.length - 1;
}
for (const [lod, budgets, error] of [['near', [8000, 80000, 4500], .007], ['background', [0, 7000, 1000], .02], ['shore', [0, 1500, 300], .04]] as const) {
  const primitives: object[] = [];
  for (let surface = 0; surface < original.meshes[0].primitives.length; surface++) {
    if (!budgets[surface]) continue; // Thin twigs do not contribute to the distant silhouette.
    const primitive = original.meshes[0].primitives[surface], positions = attribute(primitive.attributes.POSITION) as Float32Array;
    const indices = Uint32Array.from(attribute(primitive.indices));
    if (surface === 1) {
      const cards = leafCards(primitive, budgets[surface], lod === 'near' ? 1.2 : lod === 'background' ? 2.7 : 5.7);
      if (cards.indices.length / 3 > budgets[surface]) throw Error(`Leaf cards exceed ${lod} triangle budget`);
      const attributes = Object.fromEntries(Object.entries(cards.attributes).map(([name, values]) => [name, append(values, original.accessors[primitive.attributes[name]].type, name === 'POSITION')]));
      primitives.push({ attributes, indices: append(cards.indices, 'SCALAR'), material: primitive.material });
      statistics.push({ lod, material: original.materials[primitive.material].name, originalTriangles: indices.length / 3, triangles: cards.indices.length / 3, vertices: cards.leafCards * 4, leafCards: cards.leafCards });
      continue;
    }
    const selected = indices.slice(), sourcePositions = positions;
    const [initial, used] = MeshoptSimplifier.compactMesh(selected), selectedPositions = new Float32Array(used * 3);
    for (let vertex = 0; vertex < initial.length; vertex++) if (initial[vertex] !== 0xffffffff)
      selectedPositions.set(sourcePositions.subarray(vertex * 3, vertex * 3 + 3), initial[vertex] * 3);
    const [reduced, deviation] = MeshoptSimplifier.simplify(selected, selectedPositions, 3, budgets[surface] * 3, error);
    const [remap, count] = MeshoptSimplifier.compactMesh(reduced), attributes: Record<string, number> = {};
    for (const [name, index] of Object.entries(primitive.attributes) as [string, number][]) {
      const type = original.accessors[index].type, size = sizes[type], values = name === 'POSITION' ? sourcePositions : attribute(index), packed = new Float32Array(count * size);
      for (let vertex = 0; vertex < initial.length; vertex++) if (initial[vertex] !== 0xffffffff && remap[initial[vertex]] !== 0xffffffff)
        for (let k = 0; k < size; k++) packed[remap[initial[vertex]] * size + k] = values[vertex * size + k];
      // Put the lowest root on the same shared lawn as the old procedural tree.
      if (name === 'POSITION') for (let vertex = 0; vertex < count; vertex++) packed[vertex * 3 + 1] += .02410384640097618;
      attributes[name] = append(packed, type, name === 'POSITION');
    }
    primitives.push({ attributes, indices: append(reduced, 'SCALAR'), material: primitive.material });
    statistics.push({ lod, material: original.materials[primitive.material].name, originalTriangles: indices.length / 3, triangles: reduced.length / 3, vertices: count, relativeError: deviation });
  }
  meshes.push({ name: `Park tree ${lod}`, primitives });
}
// The source leaves have opaque JPEG albedo. Use the separate CC0 cutout map at runtime.
const materials = structuredClone(original.materials); materials[1].alphaMode = 'OPAQUE';
const images = original.images.map((entry: { uri: string }) => ({ uri: entry.uri.split('/').pop() }));
const document = { asset: { version: '2.0', generator: 'auto_matrix CC0 waterfront tree LOD', copyright: 'CC0 — Rico Cilliers / Poly Haven' },
  extensionsUsed: original.extensionsUsed, scene: 0, scenes: [{ nodes: [0, 1, 2] }],
  nodes: [{ mesh: 0, name: 'Park tree near' }, { mesh: 1, name: 'Park tree background' }, { mesh: 2, name: 'Park tree shore' }],
  meshes, materials, images, textures: original.textures, samplers: original.samplers, accessors, bufferViews: views, buffers: [{ byteLength: offset }] };
const encoded = Buffer.from(JSON.stringify(document)), padded = Buffer.alloc(Math.ceil(encoded.length / 4) * 4, 32); encoded.copy(padded);
const bytes = Buffer.concat(chunks), glb = Buffer.alloc(28 + padded.length + bytes.length);
glb.writeUInt32LE(0x46546c67, 0); glb.writeUInt32LE(2, 4); glb.writeUInt32LE(glb.length, 8);
glb.writeUInt32LE(padded.length, 12); glb.writeUInt32LE(0x4e4f534a, 16); padded.copy(glb, 20);
glb.writeUInt32LE(bytes.length, 20 + padded.length); glb.writeUInt32LE(0x004e4942, 24 + padded.length); bytes.copy(glb, 28 + padded.length);
await writeFile(resolve(output, 'waterfront-tree.glb'), glb);
const downloads = Object.entries(metadata.gltf.include).filter(([name]) => name.startsWith('textures/')) as [string, { url: string; md5: string; size: number }][];
downloads.push(['tree_small_02_leaves_alpha_1k.png', metadata.alpha]);
await Promise.all(downloads.map(async ([name, file]) => {
  const target = resolve(output, name.split('/').pop()!);
  let cached: Buffer | undefined;
  try { cached = await readFile(target); } catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error; }
  if (cached?.length === file.size && createHash('md5').update(cached).digest('hex') === file.md5) return;
  const response = await fetch(file.url); if (!response.ok) throw Error(`Tree texture ${response.status}: ${name}`);
  const data = Buffer.from(await response.arrayBuffer());
  if (data.length !== file.size || createHash('md5').update(data).digest('hex') !== file.md5) throw Error(`Tree texture checksum: ${name}`);
  await writeFile(target, data);
}));
await writeFile(resolve(output, 'waterfront-tree.sources.json'), JSON.stringify({ asset: 'tree_small_02', page: 'https://polyhaven.com/a/tree_small_02',
  author: metadata.info.authors, license: 'CC0', licensePage: 'https://polyhaven.com/license', source: { gltf: metadata.gltf.url, gltfMd5: metadata.gltf.md5, binary: metadata.gltf.include['tree_small_02.bin'] },
  output: { file: 'waterfront-tree.glb', bytes: glb.length, sha256: createHash('sha256').update(glb).digest('hex'), statistics },
  textures: downloads.map(([name, file]) => ({ file: name.split('/').pop(), ...file })),
  processing: 'meshoptimizer 0.18.1 (already locked by @types/three) for wood; connected leaf surfaces fitted to their UV0 planes, two triangles per cutout card, original atlas regions retained and UV1 fitted within each island; near uses every valid card at 1.2x, background and shore select whole islands by stable hash order within their 7000/1500 triangle budgets and expand 2.7x/5.7x; distant LODs omit thin twigs; root raised 0.0241038464 m; separate opaque/cutout leaf material' }, null, 2));
console.log(JSON.stringify({ bytes: glb.length, statistics }));
