import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { CharacterModels } from '../packages/client/src/agents/CharacterModel.js';
import { WorldState } from '../packages/server/src/world/WorldState.js';
import { AgentManager } from '../packages/server/src/agents/AgentManager.js';
import { ORACLE_REQUEST, type OracleRequestGesture } from '@auto_matrix/shared';

test('the new Oracle appearance is enabled for the Revolutions living-room visit, without replacing her earlier head', t => {
  const requested: string[] = [];
  t.mock.method(GLTFLoader.prototype, 'loadAsync', url => { requested.push(String(url)); return new Promise(() => {}); });
  t.mock.method(THREE.TextureLoader.prototype, 'load', () => new THREE.Texture());
  const previous = globalThis.document;
  globalThis.document = { createElement: () => ({ getContext: () => ({ createImageData: (w: number, h: number) => ({ data: new Uint8ClampedArray(w * h * 4) }), putImageData() {} }) }) } as unknown as Document;
  const world = new WorldState(); new AgentManager(world).initializeAllAgents(); const models = new CharacterModels();
  try {
    const rig = models.create(world.agents.get('oracle')!);
    const input = { speed: 0, grounded: true, verticalVelocity: 0, turn: 0 };
    models.animate(rig, 0, input, 1);
    assert.equal(requested.length, 0, 'first-film Oracle keeps her own appearance');
    models.animate(rig, 0, { ...input, oracleRevolutions: true }, 1);
    assert.ok(requested.some(url => url.endsWith('oracle-revolutions-head.glb')), 'the request visit must load the already shipped third-film head');
  } finally { models.dispose(); globalThis.document = previous; }
});

test('the actual Oracle head, bent legs and dress retain sofa clearance when a paused conversation loads', async t => {
  const bytes = await readFile(new URL('../packages/client/public/assets/characters/oracle-revolutions-head.glb', import.meta.url));
  const length = bytes.readUInt32LE(12), document = JSON.parse(bytes.subarray(20, 20 + length).toString());
  for (const material of document.materials) delete material.pbrMetallicRoughness.baseColorTexture;
  document.images = []; document.textures = [];
  const json = Buffer.from(JSON.stringify(document)), padded = Buffer.alloc(Math.ceil(json.length / 4) * 4, 32); json.copy(padded);
  const binary = bytes.subarray(20 + length), output = Buffer.alloc(20 + padded.length + binary.length);
  output.writeUInt32LE(0x46546c67, 0); output.writeUInt32LE(2, 4); output.writeUInt32LE(output.length, 8);
  output.writeUInt32LE(padded.length, 12); output.writeUInt32LE(0x4e4f534a, 16); padded.copy(output, 20); binary.copy(output, 20 + padded.length);
  const asset = await new GLTFLoader().parseAsync(output.buffer.slice(output.byteOffset, output.byteOffset + output.byteLength), '');
  asset.scene.traverse(object => { if (object instanceof THREE.Mesh) (object.material as THREE.MeshStandardMaterial).map = new THREE.Texture(); });
  t.mock.method(GLTFLoader.prototype, 'loadAsync', async () => asset);
  t.mock.method(THREE.TextureLoader.prototype, 'load', () => new THREE.Texture());
  const previous = globalThis.document;
  globalThis.document = { createElement: () => ({ getContext: () => ({ createImageData: (w: number, h: number) => ({ data: new Uint8ClampedArray(w * h * 4) }), putImageData() {} }) }) } as unknown as Document;
  const world = new WorldState(); new AgentManager(world).initializeAllAgents(); const models = new CharacterModels();
  try {
    const rig = models.create(world.agents.get('oracle')!);
    rig.root.position.set(ORACLE_REQUEST.oracle.x, 0, ORACLE_REQUEST.oracle.z); rig.root.rotation.y = ORACLE_REQUEST.oracle.yaw;
    const root = rig.root.position.clone(), input = { speed: 0, grounded: true, verticalVelocity: 0, turn: 0, oracleRevolutions: true };
    for (const elapsed of [0, 4.8, 8, 12, 16]) {
      const gesture: OracleRequestGesture = { role: 'oracle', phase: 'answering', step: 1, elapsed, guide: 0 };
      models.animate(rig, 0, { ...input, oracleRequest: gesture }, 1);
      await new Promise(resolve => setImmediate(resolve)); models.animate(rig, 0, { ...input, oracleRequest: gesture }, 1);
      rig.root.updateWorldMatrix(true, true);
      assert.equal(rig.root.getObjectByName('oracle-revolutions-detailed-head')!.visible, true);
      assert.deepEqual(rig.root.position, root, 'the late head load must not move the saved seat');
      assert.equal(rig.root.getObjectByName('oracle-apron-group')!.visible, false);
      for (const ankle of rig.ankles) {
        const foot = new THREE.Box3().setFromObject(ankle);
        assert.ok(foot.min.y >= -.015 && foot.min.y < .08, `a real shoe must be planted on the floor: ${foot.min.y}; ankle ${ankle.getWorldPosition(new THREE.Vector3()).toArray()}; hips ${rig.hips.map(joint => joint.getWorldPosition(new THREE.Vector3()).toArray())}; knee ${rig.knees.map(joint => joint.position.toArray())}`);
        assert.ok(foot.min.x >= -9.94, `the shoe cannot occupy the sofa front: ${foot.min.x}`);
      }
      const dress = rig.root.getObjectByName('oracle-request-dress') as THREE.Mesh;
      const vertices = dress.geometry.attributes.position;
      for (let vertex = 0; vertex < vertices.count; vertex++) {
        const point = dress.localToWorld(new THREE.Vector3().fromBufferAttribute(vertices, vertex));
        assert.ok(point.y >= .035, 'dress hem cannot sink through the floor');
        if (point.y < ORACLE_REQUEST.oracle.seat) assert.ok(point.x > -9.94, 'fabric below the cushion must hang in front of it');
      }
      for (const knee of rig.knees) {
        const point = knee.getWorldPosition(new THREE.Vector3());
        const ray = new THREE.Raycaster(point.clone().add(new THREE.Vector3(3, 0, 0)), new THREE.Vector3(-1, 0, 0));
        assert.ok(ray.intersectObject(dress)[0], 'the folded skirt covers the bent knee in front of the sofa');
      }
    }
    models.animate(rig, 0, { ...input, oracleRevolutions: false, oracleRequest: { role: 'oracle', phase: 'done', step: 4, elapsed: 0, guide: ORACLE_REQUEST.guideLength } }, 1);
    assert.equal(rig.root.getObjectByName('oracle-revolutions-detailed-head')!.visible, true, 'the saved seated Oracle keeps her third-film appearance after visitors leave');
    models.animate(rig, 0, { ...input, oracleRevolutions: false }, 1);
    assert.equal(rig.root.getObjectByName('oracle-request-dress')!.visible, false, 'living-room clothing does not replace other scenes');
    assert.equal(rig.root.getObjectByName('oracle-revolutions-detailed-head')!.visible, false);
  } finally { models.dispose(); globalThis.document = previous; }
});
