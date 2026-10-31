import { mkdir, writeFile } from 'node:fs/promises';
import * as THREE from 'three';
import { AMBUSH_DOFF } from '@auto_matrix/shared';
import { makeModel, meshSurface, worldPoints } from '../morpheus-ambush-doff-2026-10-17/grip-fixture.mjs';
import { FrontExitBody as WithdrawalBody } from './FrontExitBody.mjs';
import { WithdrawalCuffs } from '../morpheus-withdrawal-path-2026-10-20/WithdrawalCuffs.mjs';

const full = process.argv.includes('--full-removal');
const shoulderRelease = process.argv.includes('--front-exit') ? 'front-exit' : process.argv.includes('--shoulder-release');
const destination = process.argv.slice(2).find(arg => !arg.startsWith('--')) ?? (shoulderRelease === 'front-exit' ? './front-exit-input/' : shoulderRelease ? './shoulder-release-input/' : full ? './full-removal-input/' : './clearance-input/');
const h = await makeModel(), directory = new URL(destination, import.meta.url);
await mkdir(directory, { recursive: true });
const body = new WithdrawalBody(h.rig, shoulderRelease); body.pose(.8);
const guides = new WithdrawalCuffs(h.rig, body);
const clothes = ['morpheus-ambush-coat', 'morpheus-ambush-lapels'].map(name => h.rig.root.getObjectByName(name) as THREE.Mesh);
clothes.push(...h.rig.panels.map(panel => panel.mesh));
const bodies: THREE.Mesh[] = [];
h.rig.root.traverseVisible(object => { if (object instanceof THREE.Mesh && !clothes.includes(object)) bodies.push(object); });
const surfaces = clothes.map(mesh => meshSurface(mesh)), initial = bodies.map(mesh => meshSurface(mesh));
const points: number[][] = [], indices: number[] = [], parts = [], weld = new Map<string, number>();
for (const surface of surfaces) {
  const ids = surface.vertices.map(point => {
    const key = point.map(value => value.toFixed(7)).join(','); let id = weld.get(key);
    if (id === undefined) { id = points.length; points.push(point); weld.set(key, id); }
    return id;
  });
  parts.push({ name: surface.name, vertices: ids }); indices.push(...surface.indices.map(id => ids[id]));
}
const wristBase = Object.fromEntries(['R', 'L'].map(side => [side, h.rig.bones.get(`wrist_${side}`)!.matrixWorld.clone()]));
const frames = [];
const frameCount = full ? Math.round((AMBUSH_DOFF.duration - .8) * 30) + 1 : 73;
for (let frame = 1; frame <= frameCount; frame++) {
  const time = .8 + (frame - 1) / 30; body.pose(time);
  const flat = new Float32Array(bodies.flatMap(mesh => worldPoints(mesh).flatMap(p => [.4 * p.x, -.4 * p.z, .4 * p.y])));
  await writeFile(new URL(`body-${frame}.bin`, directory), Buffer.from(flat.buffer));
  const cuffs = ['R', 'L'].map(side => ({ side, matrix: guides.matrix(side, time).toArray() }));
  frames.push({ frame, time, cuffs, reachErrors: body.errors.map(error => ({ ...error })) });
}
await writeFile(new URL('manifest.json', directory), JSON.stringify({
  points, indices, parts, surfaces, bodies: initial.map(surface => ({ name: surface.name, count: surface.vertices.length, indices: surface.indices })),
  bodyInitial: initial, wristBase: Object.fromEntries(Object.entries(wristBase).map(([name, matrix]) => [name, matrix.toArray()])), frames,
}));
console.log(JSON.stringify({ vertices: points.length, faces: indices.length / 3, bodies: bodies.length,
  maximumReachError: Math.max(...frames.flatMap(frame => frame.reachErrors.map(error => error.distance))) }));
h.models.dispose();
