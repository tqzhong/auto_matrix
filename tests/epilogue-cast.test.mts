import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { CharacterModels } from '../packages/client/src/agents/CharacterModel.js';
import { WorldState } from '../packages/server/src/world/WorldState.js';
import { AgentManager } from '../packages/server/src/agents/AgentManager.js';
import { newTrilogyEpilogue } from '@auto_matrix/shared';

test('Sati waits on her side with closed eyes, then gathers her legs and plants her hands before standing', async t => {
  const asset = await shippedHead('sati');
  t.mock.method(GLTFLoader.prototype, 'loadAsync', async () => asset);
  t.mock.method(THREE.TextureLoader.prototype, 'load', () => new THREE.Texture());
  const previous = globalThis.document;
  globalThis.document = { createElement: () => ({ getContext: () => ({ createImageData: (w: number, h: number) => ({ data: new Uint8ClampedArray(w * h * 4) }), putImageData() {} }) }) } as unknown as Document;
  const world = new WorldState(); new AgentManager(world).initializeAllAgents(); const models = new CharacterModels();
  try {
    const rig = models.create(world.agents.get('sati')!);
    const input = { speed: 0, grounded: true, verticalVelocity: 0, turn: 0,
      epilogue: { ...newTrilogyEpilogue('reset'), role: 'sati' as const, phase: 'cat' as const, elapsed: 2, total: 2 } };
    models.animate(rig, 0, input, 1); await new Promise(resolve => setImmediate(resolve)); models.animate(rig, 0, input, 1);
    rig.root.updateWorldMatrix(true, true);
    const head = rig.root.getObjectByName('sati-anatomical-head') as THREE.Mesh;
    assert.equal(head.morphTargetInfluences![0], 1, 'sleeping Sati must not stare with open eyes');
    const shoulders = rig.shoulders.map(joint => joint.getWorldPosition(new THREE.Vector3()));
    assert.ok(Math.abs(shoulders[0].y - shoulders[1].y) > .4, 'the opening pose is side-lying, not a standing body tipped onto its back');
    for (const elapsed of [3.2, 3.6, 4]) {
      models.animate(rig, 0, { ...input, epilogue: { ...input.epilogue, phase: 'waking', elapsed, total: 8.8 + elapsed } }, 1);
      rig.root.updateWorldMatrix(true, true);
      for (const side of [-1, 1]) {
        const hand = rig.root.getObjectByName(`sati-hand-${side}`); assert.ok(hand, 'the supported palm needs an articulated wrist');
        const palm = hand.localToWorld(new THREE.Vector3(0, -.07, .055));
        assert.ok(Math.abs(palm.y) < .02, `waking ${elapsed}: palm contact is ${palm.y} above street`);
      }
      assert.ok(rig.knees.some(knee => Math.abs(knee.rotation.x) > .3), 'the legs must gather before the body rises');
      const before = rig.torso.getWorldPosition(new THREE.Vector3()); models.animate(rig, .1, { ...input, epilogue: { ...input.epilogue, phase: 'waking', elapsed, total: 8.8 + elapsed } }, 1);
      assert.ok(before.distanceTo(rig.torso.getWorldPosition(new THREE.Vector3())) < 1e-6, 'paused support must not drift with render time');
    }
    for (const elapsed of [0, .4, .8, 1.2, 1.6, 2, 2.6, 3.2, 3.6, 4, 4.6, 5.2, 6.4, 7.2]) {
      models.animate(rig, 0, { ...input, epilogue: { ...input.epilogue, phase: 'waking', elapsed, total: 8.8 + elapsed } }, 1);
      rig.root.updateWorldMatrix(true, true); let lowest = Infinity;
      rig.detail.traverseVisible(object => {
        if (!(object instanceof THREE.Mesh)) return;
        object.updateMatrixWorld(true); if (object instanceof THREE.SkinnedMesh) object.skeleton.update();
        for (let vertex = 0; vertex < object.geometry.attributes.position.count; vertex++)
          lowest = Math.min(lowest, object.localToWorld(object.getVertexPosition(vertex, new THREE.Vector3())).y);
      });
      assert.ok(lowest > -.005 && lowest < .015, `waking ${elapsed}: actual head, limbs, dress and hands need street support, gap ${lowest}`);
    }
  } finally { models.dispose(); globalThis.document = previous; }
});

test('Oracle and Sati have a front hairline while their detailed assets load', t => {
  t.mock.method(THREE.TextureLoader.prototype, 'load', () => new THREE.Texture());
  t.mock.method(GLTFLoader.prototype, 'loadAsync', () => new Promise(() => {}));
  const previous = globalThis.document;
  const context = { createImageData: (w: number, h: number) => ({ data: new Uint8ClampedArray(w * h * 4) }), putImageData() {} };
  globalThis.document = { createElement: () => ({ getContext: () => context }) } as unknown as Document;
  const world = new WorldState(); new AgentManager(world).initializeAllAgents(); const models = new CharacterModels();
  try {
    for (const role of ['oracle', 'sati']) {
      const rig = models.create(world.agents.get(role)!); rig.root.updateWorldMatrix(true, true);
      const origin = rig.head.localToWorld(new THREE.Vector3(0, .255, 1));
      const ray = new THREE.Raycaster(origin, new THREE.Vector3(0, 0, -1));
      const hit = ray.intersectObject(rig.head, true)[0]; assert.ok(hit, `${role}: crown must have a visible surface`);
      const mesh = hit.object as THREE.Mesh;
      const material = (Array.isArray(mesh.material) ? mesh.material[hit.face!.materialIndex] : mesh.material) as THREE.MeshStandardMaterial;
      assert.ok(material.color.getHSL({ h: 0, s: 0, l: 0 }).l < .045, `${role}: forehead skin is exposed where the front hair should cover the crown`);
    }
  } finally { models.dispose(); globalThis.document = previous; }
});

async function shippedHead(role: string) {
  const bytes = await readFile(new URL(`../packages/client/public/assets/characters/${role}-head.glb`, import.meta.url));
  const length = bytes.readUInt32LE(12), document = JSON.parse(bytes.subarray(20, 20 + length).toString());
  for (const material of document.materials) delete material.pbrMetallicRoughness.baseColorTexture;
  document.images = []; document.textures = [];
  const json = Buffer.from(JSON.stringify(document)), padded = Buffer.alloc(Math.ceil(json.length / 4) * 4, 32); json.copy(padded);
  const binary = bytes.subarray(20 + length), output = Buffer.alloc(20 + padded.length + binary.length);
  output.writeUInt32LE(0x46546c67, 0); output.writeUInt32LE(2, 4); output.writeUInt32LE(output.length, 8);
  output.writeUInt32LE(padded.length, 12); output.writeUInt32LE(0x4e4f534a, 16); padded.copy(output, 20); binary.copy(output, 20 + padded.length);
  const asset = await new GLTFLoader().parseAsync(output.buffer.slice(output.byteOffset, output.byteOffset + output.byteLength), '');
  asset.scene.traverse(object => { if (object instanceof THREE.Mesh) (object.material as THREE.MeshStandardMaterial).map = new THREE.Texture(); });
  return asset;
}

test('the shipped Oracle head closes its eyelids and a late load recomputes support without moving the saved root', async t => {
  const asset = await shippedHead('oracle-revolutions');
  let deliver: (value: typeof asset) => void;
  t.mock.method(GLTFLoader.prototype, 'loadAsync', () => new Promise(resolve => { deliver = resolve; }));
  t.mock.method(THREE.TextureLoader.prototype, 'load', () => new THREE.Texture());
  const previous = globalThis.document;
  globalThis.document = { createElement: () => ({ getContext: () => ({ createImageData: (w: number, h: number) => ({ data: new Uint8ClampedArray(w * h * 4) }), putImageData() {} }) }) } as unknown as Document;
  const world = new WorldState(); new AgentManager(world).initializeAllAgents(); const models = new CharacterModels();
  const input = { speed: 0, grounded: true, verticalVelocity: 0, turn: 0, oracleRestored: true };
  const points = (root: THREE.Object3D) => {
    root.updateWorldMatrix(true, true); const result: THREE.Vector3[] = [];
    root.traverseVisible(object => { if (object instanceof THREE.Mesh) {
      object.updateMatrixWorld(true); if (object instanceof THREE.SkinnedMesh) object.skeleton.update();
      for (let i = 0; i < object.geometry.attributes.position.count; i++) result.push(object.localToWorld(object.getVertexPosition(i, new THREE.Vector3())));
    } }); return result;
  };
  try {
    const rig = models.create(world.agents.get('oracle')!); models.animate(rig, 0, input, 1);
    const saved = rig.root.position.clone(); deliver!(asset); await new Promise(resolve => setImmediate(resolve));
    models.animate(rig, 0, input, 1);
    assert.equal(rig.head.getObjectByName('oracle-fallback-head')!.visible, false);
    assert.ok(rig.root.position.equals(saved), 'loading the likeness cannot teleport the actor');
    const box = new THREE.Box3().setFromPoints(points(rig.root));
    assert.ok(Math.abs(box.min.y) < .006, `new head/hair must rest on the same floor, gap ${box.min.y}`);
    const face = rig.head.getObjectByName('oracle-revolutions-anatomical-head') as THREE.Mesh;
    assert.equal(face.morphTargetInfluences![0], 1);
    assert.equal(rig.head.getObjectByName('oracle-revolutions-eyes')!.visible, false);
    const eye = asset.parser.json.extras.eye[0] as number;
    for (const side of [-1, 1]) for (const y of [-.014, 0, .012]) {
      const origin = face.localToWorld(new THREE.Vector3(side * eye, y, 1));
      const direction = new THREE.Vector3(0, 0, -1).transformDirection(face.matrixWorld);
      const hit = new THREE.Raycaster(origin, direction).intersectObject(face, false)[0];
      assert.ok(hit && face.worldToLocal(hit.point.clone()).z > .14, `closed lid has a hole at ${side}, ${y}`);
    }
    models.animate(rig, 0, { ...input, oracleRestored: false, parkOutfit: true }, 1);
    assert.equal(face.morphTargetInfluences![0], 0); assert.equal(rig.head.getObjectByName('oracle-revolutions-eyes')!.visible, true);
    models.animate(rig, 0, input, 1);
    assert.equal(rig.root.getObjectByName('oracle-park-outfit')!.visible, false, 'revisiting the crater cannot retain the park skirt');
    models.animate(rig, 0, { ...input, oracleRestored: false }, 1);
    assert.equal(rig.head.getObjectByName('oracle-fallback-head')!.visible, true, 'earlier films must not silently borrow the Revolutions appearance');
  } finally { models.dispose(); globalThis.document = previous; }
});

test('paused Sati waking reuses the support calculation for its unchanged saved pose', async t => {
  const asset = await shippedHead('sati');
  t.mock.method(GLTFLoader.prototype, 'loadAsync', async () => asset);
  t.mock.method(THREE.TextureLoader.prototype, 'load', () => new THREE.Texture());
  const previous = globalThis.document;
  globalThis.document = { createElement: () => ({ getContext: () => ({ createImageData: (w: number, h: number) => ({ data: new Uint8ClampedArray(w * h * 4) }), putImageData() {} }) }) } as unknown as Document;
  const world = new WorldState(); new AgentManager(world).initializeAllAgents(); const models = new CharacterModels();
  try {
    const rig = models.create(world.agents.get('sati')!);
    const input = { speed: 0, grounded: true, verticalVelocity: 0, turn: 0,
      epilogue: { kind: 'reset', role: 'sati', phase: 'waking', elapsed: 1.4, total: 1.4 } } as Parameters<CharacterModels['animate']>[2];
    models.animate(rig, 0, input, 1); await new Promise(resolve => setImmediate(resolve)); models.animate(rig, 0, input, 1);
    let samples = 0;
    rig.detail.traverse(object => { if (object instanceof THREE.Mesh) { const original = object.getVertexPosition.bind(object);
      t.mock.method(object, 'getVertexPosition', (index, target) => { samples++; return original(index, target); }); } });
    const height = rig.detail.position.y;
    for (let frame = 0; frame < 4; frame++) models.animate(rig, .016, input, 1);
    assert.equal(rig.detail.position.y, height, 'render time cannot shift the paused body');
    assert.equal(samples, 0, 'an unchanged saved pose must not rescan tens of thousands of head/hair vertices each render');
    for (const elapsed of [0, .4, 1.6, 2.6, 3.2]) {
      models.animate(rig, 0, { ...input, epilogue: { ...input.epilogue!, elapsed, total: elapsed } }, 1);
      rig.root.updateWorldMatrix(true, true); let lowest = Infinity;
      rig.detail.traverseVisible(object => {
        if (!(object instanceof THREE.Mesh)) return;
        object.updateMatrixWorld(true); if (object instanceof THREE.SkinnedMesh) object.skeleton.update();
        for (let vertex = 0; vertex < object.geometry.attributes.position.count; vertex++)
          lowest = Math.min(lowest, object.localToWorld(object.getVertexPosition(vertex, new THREE.Vector3())).y);
      });
      assert.ok(Math.abs(lowest) < .015, `loaded Sati head/hair must meet the street while waking at ${elapsed}, gap ${lowest}`);
    }
  } finally { models.dispose(); globalThis.document = previous; }
});

test('Sati’s visible legs stay inside the dress above its hem during walking', t => {
  t.mock.method(GLTFLoader.prototype, 'loadAsync', () => new Promise(() => {}));
  t.mock.method(THREE.TextureLoader.prototype, 'load', () => new THREE.Texture());
  const previous = globalThis.document;
  globalThis.document = { createElement: () => ({ getContext: () => ({ createImageData: (w: number, h: number) => ({ data: new Uint8ClampedArray(w * h * 4) }), putImageData() {} }) }) } as unknown as Document;
  const world = new WorldState(); new AgentManager(world).initializeAllAgents(); const models = new CharacterModels();
  try {
    const rig = models.create(world.agents.get('sati')!), skirt = rig.root.getObjectByName('sati-skirt') as THREE.Mesh;
    const ray = new THREE.Raycaster(), point = new THREE.Vector3();
    const dress = [skirt, ...rig.torso.children.filter(object => object instanceof THREE.Mesh && object.material === skirt.material)];
    const penetrations: { frame: number; side: number; gap: number; point: number[] }[] = [];
    for (let frame = 0; frame < 20; frame++) {
      models.animate(rig, .07, { speed: 5, grounded: true, verticalVelocity: 0, turn: 0 }, 1);
      rig.root.updateWorldMatrix(true, true); skirt.geometry.computeBoundingSphere();
      const top = (rig.torso.position.y + .12) * .64, hem = top - 1.07 * .64;
      for (const hip of rig.hips) hip.traverse(object => {
        if (!(object instanceof THREE.SkinnedMesh)) return;
        object.updateMatrixWorld(true); object.skeleton.update();
        for (let i = 0; i < object.geometry.attributes.position.count; i += 3) {
          object.getVertexPosition(i, point); object.localToWorld(point);
          if (point.y <= hem + .04 || point.y >= top + .08) continue;
          for (const side of [-1, 1]) {
            ray.set(new THREE.Vector3(point.x, point.y, side * 5), new THREE.Vector3(0, 0, -side));
            const hit = ray.intersectObjects(dress, false)[0];
            const gap = hit ? side * (hit.point.z - point.z) : -Infinity;
            if (gap < -.008) penetrations.push({ frame, side, gap, point: point.toArray() });
          }
        }
      });
    }
    assert.equal(penetrations.length, 0, `legs pierce the dress: ${JSON.stringify(penetrations.sort((a, b) => a.gap - b.gap).slice(0, 8))}`);
  } finally { models.dispose(); globalThis.document = previous; }
});

test('Sati’s skirt stays attached to the bodice while the torso sways', t => {
  t.mock.method(GLTFLoader.prototype, 'loadAsync', () => new Promise(() => {}));
  t.mock.method(THREE.TextureLoader.prototype, 'load', () => new THREE.Texture());
  const previous = globalThis.document;
  globalThis.document = { createElement: () => ({ getContext: () => ({ createImageData: (w: number, h: number) => ({ data: new Uint8ClampedArray(w * h * 4) }), putImageData() {} }) }) } as unknown as Document;
  const world = new WorldState(); new AgentManager(world).initializeAllAgents(); const models = new CharacterModels();
  try {
    const rig = models.create(world.agents.get('sati')!), skirt = rig.root.getObjectByName('sati-skirt') as THREE.Mesh;
    for (let frame = 0; frame < 12; frame++) {
      models.animate(rig, .08, { speed: 5, grounded: true, verticalVelocity: 0, turn: .2 }, 1);
      rig.root.updateWorldMatrix(true, true);
      const columns = (skirt.geometry as THREE.CylinderGeometry).parameters.radialSegments;
      for (const column of [0, columns / 4, columns / 2, columns * .75]) {
        const top = rig.torso.worldToLocal(skirt.localToWorld(new THREE.Vector3().fromBufferAttribute(skirt.geometry.attributes.position, column)));
        const radius = Math.hypot(top.x, top.z / .59);
        assert.ok(Math.abs(top.y - .12) < .006 && Math.abs(radius - (.43 + .01 * .12 / .18)) < .006,
          `skirt seam separates from the actual bodice section: ${top.toArray()}, radius ${radius}`);
      }
    }
  } finally { models.dispose(); globalThis.document = previous; }
});

test('the folded waking dress covers the actual upper thighs through the waist bend', t => {
  t.mock.method(GLTFLoader.prototype, 'loadAsync', () => new Promise(() => {}));
  t.mock.method(THREE.TextureLoader.prototype, 'load', () => new THREE.Texture());
  const previous = globalThis.document;
  globalThis.document = { createElement: () => ({ getContext: () => ({ createImageData: (w: number, h: number) => ({ data: new Uint8ClampedArray(w * h * 4) }), putImageData() {} }) }) } as unknown as Document;
  const world = new WorldState(); new AgentManager(world).initializeAllAgents(); const models = new CharacterModels();
  try {
    const rig = models.create(world.agents.get('sati')!), skirt = rig.root.getObjectByName('sati-skirt') as THREE.Mesh;
    const dress = [skirt, ...rig.torso.children.filter(object => object instanceof THREE.Mesh && object.material === skirt.material)];
    const ray = new THREE.Raycaster(), point = new THREE.Vector3(), center = new THREE.Vector3();
    const exposed: { elapsed: number; point: number[]; gap: number | null }[] = [];
    for (const elapsed of [0, 1.2, 2.7, 3.2, 3.6, 4, 4.6, 5.2, 7.2]) {
      models.animate(rig, 0, { speed: 0, grounded: true, verticalVelocity: 0, turn: 0,
        epilogue: { ...newTrilogyEpilogue('reset'), role: 'sati', phase: 'waking', elapsed, total: 8.8 + elapsed } }, 1);
      rig.root.updateWorldMatrix(true, true); skirt.geometry.computeBoundingSphere();
      for (const hip of rig.hips) hip.traverse(object => {
        if (!(object instanceof THREE.SkinnedMesh)) return;
        object.updateMatrixWorld(true); object.skeleton.update(); const rest = object.geometry.attributes.position;
        for (let i = 0; i < rest.count; i += 3) {
          const y = rest.getY(i); if (y < -.7 || y > .05) continue;
          object.localToWorld(object.getVertexPosition(i, point));
          // A thigh's radial ray can leave through the open neck after the
          // waist bends. First classify skin inside the actual bodice section.
          const local = rig.torso.worldToLocal(point.clone());
          if (local.y >= 0 && local.y <= 1.5) {
            const outward = new THREE.Vector3(local.x, 0, local.z).normalize().applyQuaternion(rig.torso.getWorldQuaternion(new THREE.Quaternion()));
            ray.set(point.clone().addScaledVector(outward, 3), outward.clone().negate());
            const cover = ray.intersectObjects(dress.slice(1), false)[0];
            if (cover && cover.distance <= 3.008) continue;
          }
          object.localToWorld(object.applyBoneTransform(i, center.set(0, y, 0)));
          const normal = point.clone().sub(center).normalize();
          ray.set(point.clone().addScaledVector(normal, 3), normal.clone().negate());
          const hit = ray.intersectObjects(dress, false)[0];
          if (!hit || hit.distance > 3.008) exposed.push({ elapsed, point: point.toArray(), gap: hit ? hit.distance - 3 : null });
        }
      });
    }
    assert.equal(exposed.length, 0, `upper thigh skin crosses the dress: ${JSON.stringify(exposed.slice(0, 6))}`);
  } finally { models.dispose(); globalThis.document = previous; }
});

test('the epilogue scalp does not grow hair across the visible ear surfaces', async t => {
  const assets = { oracle: await shippedHead('oracle-revolutions'), sati: await shippedHead('sati') };
  t.mock.method(GLTFLoader.prototype, 'loadAsync', async (url: string) => url.includes('sati') ? assets.sati : assets.oracle);
  t.mock.method(THREE.TextureLoader.prototype, 'load', () => new THREE.Texture());
  const previous = globalThis.document;
  globalThis.document = { createElement: () => ({ getContext: () => ({ createImageData: (w: number, h: number) => ({ data: new Uint8ClampedArray(w * h * 4) }), putImageData() {} }) }) } as unknown as Document;
  const world = new WorldState(); new AgentManager(world).initializeAllAgents(); const models = new CharacterModels();
  try {
    for (const role of ['oracle', 'sati'] as const) {
      const rig = models.create(world.agents.get(role)!);
      models.animate(rig, 0, { speed: 0, grounded: true, verticalVelocity: 0, turn: 0, parkOutfit: true }, 1);
      await new Promise(resolve => setImmediate(resolve));
      const scalp = rig.head.getObjectByName(`${role}-hair-scalp`) as THREE.Mesh, points = scalp.geometry.attributes.position;
      const onEar: number[][] = [];
      for (let i = 0; i < points.count; i++) if (Math.abs(points.getX(i)) > .21 && points.getY(i) < .035
        && points.getY(i) > -.19 && points.getZ(i) > -.13) onEar.push([points.getX(i), points.getY(i), points.getZ(i)]);
      assert.equal(onEar.length, 0, `${role}: scalp geometry covers the exposed ear: ${JSON.stringify(onEar.slice(0, 8))}`);
    }
  } finally { models.dispose(); globalThis.document = previous; }
});
