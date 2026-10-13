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
  const samples = [];
  for (let frame = 0; frame <= 60; frame++) {
    const elapsed = frame * .05;
    models.animate(rig, 0, { speed: 0, grounded: true, verticalVelocity: 0, turn: 0, glasses: false,
      oracleDeparture: { phase: 'biting', elapsed, rise: 3.8, role: 'neo' } }, 4);
    rig.root.updateMatrixWorld(true);
    const bone = (name: string) => rig.hero!.bones.get(name)!.getWorldPosition(new THREE.Vector3());
    const wrist = bone('wrist_R'), forearm = wrist.clone().sub(bone('elbow_R')).normalize(), hand = bone('finger3-1_R').sub(wrist).normalize();
    samples.push({ elapsed, dot: forearm.dot(hand), forearm: forearm.toArray(), hand: hand.toArray() });
    if ([0, 17, 24, 30].includes(frame)) {
      const body: { vertices: number[][]; indices: number[] } = { vertices: [], indices: [] };
      rig.root.traverseVisible(object => {
        if (!(object instanceof THREE.Mesh)) return;
        if (object instanceof THREE.SkinnedMesh) object.skeleton.update();
        const start = body.vertices.length, p = object.geometry.attributes.position, idx = object.geometry.index;
        for (let i = 0; i < p.count; i++) body.vertices.push(rig.root.worldToLocal(object.localToWorld(object.getVertexPosition(i, new THREE.Vector3()))).toArray());
        for (let i = 0; i < (idx?.count ?? p.count); i += 3) {
          const tri = [0, 1, 2].map(j => start + (idx ? idx.getX(i + j) : i + j));
          if (tri.every(v => body.vertices[v][1] > 1.5)) body.indices.push(...tri);
        }
      });
      await writeFile(`${out}/bite-${frame}.json`, JSON.stringify({ body }));
    }
  }
  await writeFile(`${out}/wrist-curve.json`, JSON.stringify(samples, null, 2));
  console.log(JSON.stringify(samples.filter((_, i) => i % 5 === 0)));
} finally { models.dispose(); }
