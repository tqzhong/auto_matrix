import { readFile, writeFile } from 'node:fs/promises';
import { auditCage } from '../morpheus-ambush-doff-2026-10-17/cloth-rebuild/cage-contact.mjs';

const base = new URL('./', import.meta.url), name = process.argv[2];
const data = JSON.parse(await readFile(new URL('../morpheus-withdrawal-path-2026-10-20/clearance-input/manifest.json', base), 'utf8'));
const cage = JSON.parse(await readFile(new URL(`${name}.json`, base), 'utf8'));
const result = auditCage({ vertices: cage.points, indices: cage.indices }, data.bodyInitial);
await writeFile(new URL(`${name}-contacts.json`, base), JSON.stringify(result));
console.log(JSON.stringify({ name, vertices: cage.points.length, faces: cage.indices.length / 3, self: result.selfCount, body: result.bodyCount }));
