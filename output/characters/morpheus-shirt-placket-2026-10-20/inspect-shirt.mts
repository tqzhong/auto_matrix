import { writeFile } from 'node:fs/promises';
import * as THREE from 'three';
import { makeModel, meshSurface } from '../morpheus-ambush-doff-2026-10-17/grip-fixture.mjs';
import { auditCage } from '../morpheus-ambush-doff-2026-10-17/cloth-rebuild/cage-contact.mjs';

const h = await makeModel();
const shirt = h.rig.root.getObjectByName('morpheus-ambush-shirt') as THREE.SkinnedMesh;
const surface = meshSurface(shirt), hits = auditCage(surface, []).self;
const faces = [...new Set(hits.flatMap(hit => [hit.face,hit.other]))];
const ids = [...new Set(faces.flatMap(face => surface.indices.slice(face*3,face*3+3)))];
const a = shirt.geometry.attributes;
const vertices = ids.map(id => ({ id, actual: surface.vertices[id],
  rest: [a.position.getX(id),a.position.getY(id),a.position.getZ(id)],
  uv: [a.uv.getX(id),a.uv.getY(id)],
  fit: [0,1,2].map(k => shirt.geometry.morphAttributes.position[0].getComponent(id,k)),
  bindings: [0,1,2,3].map(k => [shirt.skeleton.bones[a.skinIndex.getComponent(id,k)].name,a.skinWeight.getComponent(id,k)]) }));
await writeFile(new URL(process.argv[2] ?? 'shirt-contacts-before.json',import.meta.url),JSON.stringify({ hits, faces, vertices, indices:surface.indices, points:surface.vertices },null,2));
const box = new THREE.Box3().setFromPoints(vertices.map(row => new THREE.Vector3(...row.actual)));
console.log(JSON.stringify({ self: hits.length, affectedVertices: vertices.length, bounds:vertices.length ? [box.min.toArray(),box.max.toArray()] : null, faces, examples:vertices.slice(0,8) }));
h.models.dispose();
