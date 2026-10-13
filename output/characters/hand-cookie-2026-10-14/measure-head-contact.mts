import { readFile, mkdir, writeFile } from 'node:fs/promises';
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { CharacterModels } from '../../../packages/client/src/agents/CharacterModel.js';
import { WorldState } from '../../../packages/server/src/world/WorldState.js';
import { AgentManager } from '../../../packages/server/src/agents/AgentManager.js';
import { FILM_SETS, ORACLE_VISIT } from '@auto_matrix/shared';

async function loadGeometry(id: string) {
  const glb = await readFile(new URL(`../../../packages/client/public/assets/characters/${id}.glb`, import.meta.url));
  const length = glb.readUInt32LE(12), document = JSON.parse(glb.subarray(20, 20 + length).toString());
  for (const material of document.materials) { delete material.pbrMetallicRoughness.baseColorTexture; delete material.normalTexture; }
  document.images = []; document.textures = [];
  const json = Buffer.from(JSON.stringify(document)), padded = Buffer.alloc(Math.ceil(json.length / 4) * 4, 32); json.copy(padded);
  const bin = glb.subarray(20 + length), buffer = Buffer.alloc(20 + padded.length + bin.length);
  buffer.writeUInt32LE(0x46546c67, 0); buffer.writeUInt32LE(2, 4); buffer.writeUInt32LE(buffer.length, 8);
  buffer.writeUInt32LE(padded.length, 12); buffer.writeUInt32LE(0x4e4f534a, 16); padded.copy(buffer, 20); bin.copy(buffer, 20 + padded.length);
  return new GLTFLoader().parseAsync(buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength), '');
}
const out = process.argv[2]; if (!out) throw new Error('Specify output directory'); await mkdir(out, { recursive: true });
const assets = new Map(await Promise.all(['neo', 'neo-office', 'neo-tracking'].map(async id => [id, await loadGeometry(id)] as const)));
GLTFLoader.prototype.loadAsync = async (url: string) => assets.get(url.split('/').at(-1)!.replace('.glb', ''))!;
THREE.TextureLoader.prototype.load = () => new THREE.Texture();
globalThis.document = { createElement: () => ({ getContext: () => ({ fillRect() {}, strokeRect() {}, fillText() {},
  createImageData: (w: number, h: number) => ({ data: new Uint8ClampedArray(w * h * 4) }), putImageData() {} }) }) } as unknown as Document;
const world = new WorldState(); new AgentManager(world).initializeAllAgents();
const models = new CharacterModels(), rig = models.create(world.agents.get('neo')!), oracle = models.create(world.agents.get('oracle')!);
await new Promise(resolve => setImmediate(resolve));
const center = FILM_SETS.film_oracle_home.center;
for (const [body, place] of [[rig, ORACLE_VISIT.neo], [oracle, ORACLE_VISIT.oracle]] as const) {
  body.root.position.set(center.x + place.x, center.y - 1, center.z + place.z); body.root.rotation.y = place.yaw;
}
try {
 const checks = [];
 for (const elapsed of [.65, .85, 1, 1.2, 1.5, 1.9, 2.3]) {
  models.animate(rig, 0, { speed: 0, grounded: true, verticalVelocity: 0, turn: 0, oracleDeparture: { phase: 'biting', elapsed, rise: 3.8, role: 'neo' } }, 4);
  rig.root.updateMatrixWorld(true);
  const skin = rig.hero!.root.getObjectByName('Anatomical_head_and_hands') as THREE.SkinnedMesh; skin.skeleton.update();
  const { position, skinIndex, skinWeight } = skin.geometry.attributes, idx = skin.geometry.index!;
  const vertices: THREE.Vector3[] = [], head: boolean[] = [], hands: number[] = [];
  for (let i = 0; i < position.count; i++) {
   vertices.push(rig.root.worldToLocal(skin.localToWorld(skin.getVertexPosition(i, new THREE.Vector3()))));
   let skull = 0, hand = 0;
   for (let j = 0; j < 4; j++) {
    const name = skin.skeleton.bones[skinIndex.getComponent(i, j)].name, weight = skinWeight.getComponent(i, j);
    if (/head|neck/.test(name)) skull += weight;
    if (/^(wrist|finger).*_R$/.test(name)) hand += weight;
   }
   head.push(skull > .5); if (hand > .5) hands.push(i);
  }
  const triangles: THREE.Triangle[] = [], bounds = new THREE.Box3();
  for (let i = 0; i < idx.count; i += 3) {
   const ids = [idx.getX(i), idx.getX(i + 1), idx.getX(i + 2)];
   if (!ids.every(v => head[v])) continue;
   const triangle = new THREE.Triangle(...ids.map(v => vertices[v]) as [THREE.Vector3, THREE.Vector3, THREE.Vector3]);
   if (triangle.getArea() < 1e-10) continue;
   triangles.push(triangle); ids.forEach(v => bounds.expandByPoint(vertices[v]));
  }
  let inside = 0, worst = 0, nearest = Infinity;
  const contact = new THREE.Vector3(), best = new THREE.Vector3(), normal = new THREE.Vector3();
  for (const i of hands) {
   if (!bounds.containsPoint(vertices[i])) continue;
   let distance = Infinity, face: THREE.Triangle | undefined;
   for (const triangle of triangles) {
    triangle.closestPointToPoint(vertices[i], contact); const gap = contact.distanceToSquared(vertices[i]);
    if (gap < distance) { distance = gap; best.copy(contact); face = triangle; }
   }
   nearest = Math.min(nearest, Math.sqrt(distance));
   const signed = vertices[i].clone().sub(best).dot(face!.getNormal(normal));
   if (signed < -.003) { inside++; worst = Math.min(worst, signed); }
  }
  checks.push({ elapsed, inside, worst, nearest });
 }
 console.log(JSON.stringify(checks, null, 2)); await writeFile(`${out}/head-contact.json`, JSON.stringify(checks, null, 2));
} finally { models.dispose(); }
