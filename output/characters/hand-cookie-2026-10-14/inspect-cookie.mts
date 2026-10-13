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
  for (const [mode, elapsed, yaw] of [['visit', 9.2, -Math.PI / 2], ['carry', 0, 0], ['carry', 0, Math.PI / 2], ['bite', 1.5, -Math.PI / 2]] as const) {
    rig.root.rotation.y = yaw;
    for (const [body, role] of [[rig, 'neo'], [oracle, 'oracle']] as const) {
      const base = { speed: 0, grounded: true, verticalVelocity: 0, turn: 0 };
      if (mode === 'visit') models.animate(body, 0, { ...base, oracleVisit: { phase: 'examining', elapsed, role } }, 4);
      else if (role === 'neo') models.animate(body, 0, { ...base, oracleDeparture: { phase: mode === 'bite' ? 'biting' : 'guiding', elapsed, rise: 3.8, role } }, 4);
      body.root.updateMatrixWorld(true);
    }
    const wrist = rig.hero!.bones.get('wrist_R')!, inverse = wrist.matrixWorld.clone().invert();
    const skin = rig.hero!.root.getObjectByName('Anatomical_head_and_hands') as THREE.SkinnedMesh; skin.skeleton.update();
    const { position, skinIndex, skinWeight } = skin.geometry.attributes;
    const vertices: number[][] = [], indices: number[] = [], labels: string[] = [], lookup = new Map<number, number>();
    const pads = Array.from({ length: 5 }, () => new THREE.Vector3()), counts = [0, 0, 0, 0, 0];
    for (let i = 0; i < position.count; i++) {
      let hand = 0, label = '', best = 0;
      for (let j = 0; j < 4; j++) {
        const name = skin.skeleton.bones[skinIndex.getComponent(i, j)].name, w = skinWeight.getComponent(i, j);
        if (/^(wrist|finger).*_R$/.test(name)) hand += w;
        if (w > best) { best = w; label = name; }
      }
      if (hand < .5) continue;
      const point = skin.localToWorld(skin.getVertexPosition(i, new THREE.Vector3())).applyMatrix4(inverse);
      lookup.set(i, vertices.length); vertices.push(point.toArray()); labels.push(label);
      for (let j = 0; j < 4; j++) {
        const match = /^finger([1-5])-3_R$/.exec(skin.skeleton.bones[skinIndex.getComponent(i, j)].name);
        if (match && skinWeight.getComponent(i, j) > .95) { pads[Number(match[1]) - 1].add(point); counts[Number(match[1]) - 1]++; }
      }
    }
    const source = skin.geometry.index!;
    for (let i = 0; i < source.count; i += 3) {
      const tri = [source.getX(i), source.getX(i + 1), source.getX(i + 2)];
      if (tri.every(v => lookup.has(v))) indices.push(...tri.map(v => lookup.get(v)!));
    }
    const object = rig.cookie!.visible ? rig.cookie! : oracle.cookie!;
    const prop: { vertices: number[][]; indices: number[] } = { vertices: [], indices: [] };
    object.traverseVisible(child => {
      if (!(child instanceof THREE.Mesh)) return;
      const start = prop.vertices.length, p = child.geometry.attributes.position, idx = child.geometry.index;
      for (let i = 0; i < p.count; i++) prop.vertices.push(child.localToWorld(child.getVertexPosition(i, new THREE.Vector3())).applyMatrix4(inverse).toArray());
      for (let i = 0; i < (idx?.count ?? p.count); i++) prop.indices.push(start + (idx ? idx.getX(i) : i));
    });
    const joints = Object.fromEntries([...rig.hero!.bones].filter(([name]) => /^(finger|wrist).*_R$/.test(name))
      .map(([name, bone]) => [name, bone.getWorldPosition(new THREE.Vector3()).applyMatrix4(inverse).toArray()]));
    const propMatrix = inverse.clone().multiply(object.matrixWorld), contact = object.localToWorld(new THREE.Vector3(.1, 0, 0));
    const report = pads.map((pad, i) => ({ finger: i + 1, pad: pad.divideScalar(counts[i]).toArray(),
      distance: pad.clone().applyMatrix4(wrist.matrixWorld).distanceTo(contact) }));
    const file = `${mode}-${elapsed}-${yaw}`;
    await writeFile(`${out}/${file}.json`, JSON.stringify({ vertices, indices, labels, prop, propMatrix: propMatrix.toArray(), joints, report }));
    console.log(file, JSON.stringify({ contact: contact.clone().sub(new THREE.Vector3(center.x, center.y - 1, center.z)).toArray(), report }));
  }
} finally { models.dispose(); }
