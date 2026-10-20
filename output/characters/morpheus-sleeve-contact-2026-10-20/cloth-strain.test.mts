import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import test from 'node:test';

const base = new URL('./', import.meta.url);
const result = new URL(process.env.MORPHEUS_STRAIN_RESULT ?? 'facing-physics/', base);
const cage = JSON.parse(await readFile(new URL('../morpheus-shoulder-release-2026-10-20/cage-fit-4.json', base), 'utf8'));
const frames = JSON.parse(await readFile(new URL('summary.json', result), 'utf8'));
const edges = new Map<string, [number, number]>();
for (let i = 0; i < cage.indices.length; i += 3) {
  for (let k = 0; k < 3; k++) {
    const a = cage.indices[i+k], b = cage.indices[i+(k+1)%3];
    edges.set([a,b].sort((a,b) => a-b).join(','), [a,b]);
  }
}
const distance = (a: number[], b: number[]) => Math.hypot(...a.map((v, i) => v-b[i]));
const lengths = [...edges.values()].map(([a,b]) => distance(cage.points[a], cage.points[b]));
test('the leather panels retain their size during shoulder release', async () => {
  const rows = [];
  for (const frame of frames) {
    const bytes = await readFile(new URL(`cage-${frame.frame}.bin`, result));
    const values = new Float32Array(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset+bytes.byteLength));
    const points = Array.from({length: values.length/3}, (_,i) => [values[3*i]/.4,values[3*i+2]/.4,-values[3*i+1]/.4]);
    const ratio = [...edges.values()].map(([a,b],i) => distance(points[a],points[b])/lengths[i]).sort((a,b) => a-b);
    rows.push({frame:frame.frame,time:frame.time,minimum:ratio[0],median:ratio[Math.floor(ratio.length*.5)],
      p99:ratio[Math.floor(ratio.length*.99)],maximum:ratio.at(-1)!});
  }
  await writeFile(new URL('strain-results.json', result), JSON.stringify(rows,null,2));
  const worst = rows.reduce((a,b) => a.maximum > b.maximum ? a : b);
  console.log(JSON.stringify(worst));
  // An authoring guard against visibly elastic leather, not a measured material specification.
  assert.ok(rows.every(row => row.p99 < 1.2 && row.maximum < 1.5), `the coat stretches out of shape: ${JSON.stringify(worst)}`);
});
