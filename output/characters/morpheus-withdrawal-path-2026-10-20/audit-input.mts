import { readFile, writeFile } from 'node:fs/promises';
import { auditCage } from '../morpheus-ambush-doff-2026-10-17/cloth-rebuild/cage-contact.mjs';

const base = new URL('./', import.meta.url);
const input = process.argv.find(arg => arg.startsWith('--input='))?.slice(8) ?? 'input';
const data = JSON.parse(await readFile(new URL(`${input}/manifest.json`, base), 'utf8'));
const cageOnly = process.argv.includes('--physical-cage');
const physical = process.argv.includes('--physics') || process.argv.includes('--cage') || cageOnly;
const folder = process.argv.find(arg => arg.startsWith('--folder='))?.slice(9)
  ?? (process.argv.includes('--cage') || cageOnly ? 'cage-physics' : physical ? 'physics' : 'input');
const cageSource = cageOnly ? JSON.parse(await readFile(new URL(`${folder}/cage-rest.json`, base), 'utf8')) : undefined;
const values = async (file: string) => {
  const bytes = await readFile(new URL(`${folder}/${file}`, base));
  const a = new Float32Array(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength));
  return Array.from({ length: a.length / 3 }, (_, i) => [a[i*3] / .4, a[i*3+2] / .4, -a[i*3+1] / .4]);
};
const frames = process.argv.find(arg => arg.startsWith('--frames='))?.slice(9).split(',').map(Number) ?? [1, 16, 25, 40, 55, 67, 79, 97], results = [];
for (const frame of frames) {
  const source = await values(`body-${frame}.bin`); let offset = 0;
  const bodies = data.bodies.map((part: { name: string; count: number; indices: number[] }) => {
    const vertices = source.slice(offset, offset + part.count); offset += part.count;
    return { name: part.name, indices: part.indices, vertices };
  });
  const shirt = bodies.find((part: { name: string }) => part.name === 'morpheus-ambush-shirt');
  const surface = physical ? { name: 'complete garment', indices: cageSource?.indices ?? data.indices, vertices: await values(`${cageOnly ? 'cage' : 'cloth'}-${frame}.bin`) } : shirt;
  const result = auditCage(surface, physical ? bodies : bodies.filter((part: object) => part !== shirt));
  const entry = { frame, time: data.frames[frame - 1].time, self: result.selfCount, body: result.bodyCount,
    lowest: Math.min(...surface.vertices.map((p: number[]) => p[1])),
    selfPairs: result.self.sort((a,b) => b.line-a.line).slice(0, 12), bodyPairs: result.body.sort((a,b) => b.line-a.line).slice(0, 12) };
  results.push(entry); console.log(JSON.stringify(entry));
  await writeFile(new URL(cageOnly ? `${folder}-physical-audit.json` : physical ? `${folder}-audit.json` : 'body-audit.json', base), JSON.stringify(results, null, 2));
}
