import { readFile, writeFile } from 'node:fs/promises';
import * as THREE from './candidate-release/node_modules/three/build/three.module.js';
import { GLTFLoader, type GLTF } from './candidate-release/node_modules/three/examples/jsm/loaders/GLTFLoader.js';
import { HeroModels } from './candidate-release/packages/client/src/agents/HeroModel.js';
import { advanceMotion, newMotion } from './candidate-release/packages/client/src/agents/CharacterMotion.js';

async function actor(id: 'neo' | 'morpheus', old: boolean) {
  const models = new HeroModels(new THREE.Texture(), new THREE.Texture()), assets = new Map<string, Promise<GLTF>>();
  (models as any).load = (name: string) => {
    if (assets.has(name)) return assets.get(name)!;
    const loading = (async () => {
      const folder = old && name === id ? 'original-assets' : 'candidate-release/packages/client/public/assets/characters';
      const raw = await readFile(new URL(`./${folder}/${name}.glb`, import.meta.url)), length = raw.readUInt32LE(12);
      const doc = JSON.parse(raw.subarray(20, 20 + length).toString());
      for (const material of doc.materials) { delete material.pbrMetallicRoughness.baseColorTexture; delete material.normalTexture; }
      doc.images = []; doc.textures = [];
      const json = Buffer.from(JSON.stringify(doc)), padded = Buffer.alloc(Math.ceil(json.length / 4) * 4, 32); json.copy(padded);
      const binary = raw.subarray(20 + length), bytes = Buffer.alloc(20 + padded.length + binary.length);
      bytes.writeUInt32LE(0x46546c67); bytes.writeUInt32LE(2, 4); bytes.writeUInt32LE(bytes.length, 8);
      bytes.writeUInt32LE(padded.length, 12); bytes.writeUInt32LE(0x4e4f534a, 16); padded.copy(bytes, 20); binary.copy(bytes, 20 + padded.length);
      return new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength), '');
    })();
    assets.set(name, loading); return loading;
  };
  return { models, rig: (await models.create(id))! };
}

const results = [];
for (const id of ['neo', 'morpheus'] as const) {
  const before = await actor(id, true), after = await actor(id, false);
  const input = { speed: 0, grounded: true, verticalVelocity: 0, turn: 0, dojoOutfit: id, dojoSparring: true }, motion = newMotion(), pose = advanceMotion(motion, input, 0);
  const frame = (h: typeof after) => h.models.animate(h.rig, pose, motion, input, 0);
  for (let i = 0; i < 100; i++) { frame(before); frame(after); }
  const samples: { version: string; wallMs: number; cpuMs: number }[] = [];
  for (let batch = 0; batch < 5; batch++) for (const version of ['before', 'after', 'after', 'before']) {
    const h = version === 'before' ? before : after, cpu = process.cpuUsage(), start = performance.now();
    for (let i = 0; i < 100; i++) frame(h);
    const elapsed = performance.now() - start, used = process.cpuUsage(cpu);
    samples.push({ version, wallMs: elapsed / 100, cpuMs: (used.user + used.system) / 100000 });
  }
  const median = (version: string, key: 'wallMs' | 'cpuMs') => {
    const values = samples.filter(s => s.version === version).map(s => s[key]).sort((a, b) => a - b); return (values[4] + values[5]) / 2;
  };
  results.push({ id, beforeWallMedianMs: median('before', 'wallMs'), afterWallMedianMs: median('after', 'wallMs'), beforeCpuMedianMs: median('before', 'cpuMs'), afterCpuMedianMs: median('after', 'cpuMs'), samples });
  before.models.dispose(); after.models.dispose();
}
const report = { scope: 'Common HeroModels/THREE runtime, old versus new GLB, full animate in stationary dojo guard. Node process CPU and wall time only; not a GPU or browser FPS test.', warmup: 100, samplesPerVersion: 10, framesPerSample: 100, order: 'B/A/A/B repeated five times', results };
await writeFile(new URL('./animation-cost.json', import.meta.url), JSON.stringify(report, null, 2) + '\n'); console.log(JSON.stringify(report));
