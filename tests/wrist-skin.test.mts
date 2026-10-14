import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import { inflateSync } from 'node:zlib';
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { HeroModels } from '../packages/client/src/agents/HeroModel.js';
import { advanceMotion, newMotion } from '../packages/client/src/agents/CharacterMotion.js';
import type { MotionInput } from '../packages/client/src/agents/CharacterMotion.js';

async function loadGeometry(id: string) {
  const bytes = await readFile(new URL(`../packages/client/public/assets/characters/${id}.glb`, import.meta.url));
  const length = bytes.readUInt32LE(12), document = JSON.parse(bytes.subarray(20, 20 + length).toString());
  for (const material of document.materials) { delete material.pbrMetallicRoughness.baseColorTexture; delete material.normalTexture; }
  document.images = []; document.textures = [];
  const json = Buffer.from(JSON.stringify(document)), padded = Buffer.alloc(Math.ceil(json.length / 4) * 4, 32); json.copy(padded);
  const binary = bytes.subarray(20 + length), result = Buffer.alloc(20 + padded.length + binary.length);
  result.writeUInt32LE(0x46546c67, 0); result.writeUInt32LE(2, 4); result.writeUInt32LE(result.length, 8);
  result.writeUInt32LE(padded.length, 12); result.writeUInt32LE(0x4e4f534a, 16); padded.copy(result, 20); binary.copy(result, 20 + padded.length);
  return new GLTFLoader().parseAsync(result.buffer.slice(result.byteOffset, result.byteOffset + result.byteLength), '');
}

function boundary(mesh: THREE.SkinnedMesh) {
  const { position } = mesh.geometry.attributes, index = mesh.geometry.index!, edges = new Map<string, { count: number; a: number; b: number }>();
  const key = (i: number) => [position.getX(i), position.getY(i), position.getZ(i)].map(n => Math.round(n * 1e5)).join(',');
  for (let i = 0; i < index.count; i += 3) {
    const triangle = [index.getX(i), index.getX(i + 1), index.getX(i + 2)];
    for (let j = 0; j < 3; j++) {
      const a = triangle[j], b = triangle[(j + 1) % 3], edge = [key(a), key(b)].sort().join('/');
      const current = edges.get(edge); if (current) current.count++; else edges.set(edge, { count: 1, a, b });
    }
  }
  return [...new Set([...edges.values()].filter(edge => edge.count === 1).flatMap(edge => [edge.a, edge.b]))];
}

async function skinLuminance(name: string) {
  const png = await readFile(new URL(`../packages/client/public/assets/characters/${name}`, import.meta.url));
  assert.equal(png.subarray(1, 4).toString(), 'PNG');
  const width = png.readUInt32BE(16), height = png.readUInt32BE(20), channels = png[25] === 2 ? 3 : 4;
  assert.equal(png[24], 8); assert.ok(png[25] === 2 || png[25] === 6); assert.equal(png[28], 0);
  const chunks: Buffer[] = [];
  for (let offset = 8; offset < png.length;) {
    const length = png.readUInt32BE(offset);
    if (png.subarray(offset + 4, offset + 8).toString() === 'IDAT') chunks.push(png.subarray(offset + 8, offset + 8 + length));
    offset += length + 12;
  }
  const encoded = inflateSync(Buffer.concat(chunks)), stride = width * channels, pixels = Buffer.alloc(stride * height);
  assert.equal(encoded.length, (stride + 1) * height);
  for (let y = 0; y < height; y++) for (let x = 0; x < stride; x++) {
    const filter = encoded[y * (stride + 1)]; assert.ok(filter <= 4);
    const index = y * stride + x, left = x >= channels ? pixels[index - channels] : 0;
    const up = y ? pixels[index - stride] : 0, corner = y && x >= channels ? pixels[index - stride - channels] : 0;
    const p = left + up - corner, a = Math.abs(p - left), b = Math.abs(p - up), c = Math.abs(p - corner);
    const predictor = filter === 1 ? left : filter === 2 ? up : filter === 3 ? Math.floor((left + up) / 2)
      : filter === 4 ? a <= b && a <= c ? left : b <= c ? up : corner : 0;
    pixels[index] = encoded[y * (stride + 1) + 1 + x] + predictor;
  }
  const pixel = (x: number, y: number) => {
    const offset = (Math.max(0, Math.min(height - 1, y)) * width + Math.max(0, Math.min(width - 1, x))) * channels;
    return [.2126, .7152, .0722].reduce((sum, weight, i) => {
      const value = pixels[offset + i] / 255;
      return sum + weight * (value <= .04045 ? value / 12.92 : ((value + .055) / 1.055) ** 2.4);
    }, 0);
  };
  // glTF has a top-left origin; decode sRGB before linear texture filtering.
  return (u: number, v: number) => {
    const x = u * width - .5, y = v * height - .5, X = Math.floor(x), Y = Math.floor(y), tx = x - X, ty = y - Y;
    return pixel(X, Y) * (1 - tx) * (1 - ty) + pixel(X + 1, Y) * tx * (1 - ty)
      + pixel(X, Y + 1) * (1 - tx) * ty + pixel(X + 1, Y + 1) * tx * ty;
  };
}

for (const id of ['neo', 'trinity', 'smith', 'morpheus'] as const) {
  test(`${id}: the whole wrist surface keeps skin reflectance beside the hand instead of a black baked border`, async t => {
    const asset = await loadGeometry(id), hands = asset.scene.getObjectByName('Anatomical_head_and_hands') as THREE.SkinnedMesh;
    const wrist = asset.scene.getObjectByName('Anatomical_wrist_skin') as THREE.SkinnedMesh;
    t.after(() => asset.scene.traverse(object => { if (object instanceof THREE.Mesh) object.geometry.dispose(); }));
    const ring = boundary(hands).filter(i => hands.geometry.attributes.position.getY(i) < 2.8);
    const positions = wrist.geometry.attributes.position, uv = wrist.geometry.attributes.uv, handUv = hands.geometry.attributes.uv;
    const points = ring.map(i => new THREE.Vector3().fromBufferAttribute(hands.geometry.attributes.position, i));
    const handColor = await skinLuminance(`${id}-albedo.png`), color = await skinLuminance(`${id}-wrist-skin.png`);
    const tones = ring.map(i => handColor(handUv.getX(i), handUv.getY(i))).sort((a, b) => a - b), reference = tones[Math.floor(tones.length / 2)];
    const near = Array.from({ length: positions.count }, (_, i) => {
      const point = new THREE.Vector3().fromBufferAttribute(positions, i);
      return points.some(other => point.distanceToSquared(other) < .085 ** 2);
    });
    const indices = wrist.geometry.index!; let minimum = Infinity, samples = 0;
    for (let i = 0; i < indices.count; i += 3) {
      const tri = [indices.getX(i), indices.getX(i + 1), indices.getX(i + 2)];
      if (!tri.some(vertex => near[vertex])) continue;
      for (let a = 0; a <= 8; a++) for (let b = 0; b <= 8; b++) {
        const weights = [a / 8, (1 - a / 8) * b / 8, (1 - a / 8) * (1 - b / 8)];
        const u = tri.reduce((sum, vertex, j) => sum + uv.getX(vertex) * weights[j], 0);
        const v = tri.reduce((sum, vertex, j) => sum + uv.getY(vertex) * weights[j], 0);
        minimum = Math.min(minimum, color(u, v) / reference); samples++;
      }
    }
    assert.ok(samples > 90000, 'cover triangle interiors, both wrists and UV seams, not only matching boundary vertices');
    t.diagnostic(JSON.stringify({ id, samples, minimumRelativeReflectance: minimum }));
    assert.ok(minimum > .5, `wrist albedo drops to ${minimum} of the neighboring hand; an unused bake pixel creates an artificial black fold`);
  });

  test(`${id}: anatomical skin joins both cut hand boundaries through palm roll and wrist flexion`, async t => {
    const models = new HeroModels(new THREE.Texture(), new THREE.Texture()); t.after(() => models.dispose());
    (models as unknown as { load: typeof loadGeometry }).load = loadGeometry;
    const rig = (await models.create(id))!, input = { speed: 0, grounded: true, verticalVelocity: 0, turn: 0 }, motion = newMotion();
    const pose = advanceMotion(motion, input, 0); models.animate(rig, pose, motion, input, 0);
    const hands = rig.wardrobe.find(part => part.mesh.name === 'Anatomical_head_and_hands')!.mesh as THREE.SkinnedMesh;
    const rim = boundary(hands).filter(i => hands.geometry.attributes.position.getY(i) < 2.8);
    assert.ok(rim.length >= 96, 'check the actual open hand rings, including both UV seams');
    const skin = rig.wardrobe.filter(part => part.mesh !== hands && part.mesh.visible &&
      /skin/i.test((part.mesh.material as THREE.Material).name)).map(part => part.mesh as THREE.SkinnedMesh);
    const seam = rim.map(vertex => {
      const target = new THREE.Vector3().fromBufferAttribute(hands.geometry.attributes.position, vertex);
      for (const mesh of skin) for (const other of boundary(mesh)) {
        const point = new THREE.Vector3().fromBufferAttribute(mesh.geometry.attributes.position, other);
        if (point.distanceTo(target) < 1e-5) {
          const handNormal = new THREE.Vector3().fromBufferAttribute(hands.geometry.attributes.normal, vertex);
          const armNormal = new THREE.Vector3().fromBufferAttribute(mesh.geometry.attributes.normal, other);
          assert.ok(handNormal.distanceTo(armNormal) < 1e-5, 'the joined skin must not introduce a lighting seam');
          return { vertex, mesh, other };
        }
      }
      assert.fail(`${id}: hand boundary ${vertex} at ${target.toArray()} has no forearm skin attached`);
    });
    for (const roll of [-2.8, -1.4, 0, 1.4, 2.8]) for (const bend of [-.7, 0, .7]) {
      models.animate(rig, pose, motion, input, 0);
      for (const side of ['R', 'L']) {
        const wrist = rig.bones.get(`wrist_${side}`)!;
        wrist.quaternion.setFromAxisAngle(wrist.position.clone().normalize(), side === 'R' ? roll : -roll);
        wrist.quaternion.multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), bend));
      }
      rig.root.updateMatrixWorld(true); hands.skeleton.update(); skin.forEach(mesh => mesh.skeleton.update());
      for (const { vertex, mesh, other } of seam) {
        const hand = hands.getVertexPosition(vertex, new THREE.Vector3()).applyMatrix4(hands.matrixWorld);
        const arm = mesh.getVertexPosition(other, new THREE.Vector3()).applyMatrix4(mesh.matrixWorld);
        assert.ok(hand.distanceTo(arm) < 2e-5, `${id}: seam separates at roll ${roll}, bend ${bend}`);
      }
    }
  });
}

test('wrist skin is replaced by complete arms during home, patient and club costumes, then restored', async t => {
  const models = new HeroModels(new THREE.Texture(), new THREE.Texture()); t.after(() => models.dispose());
  (models as unknown as { load: typeof loadGeometry }).load = loadGeometry;
  const input: MotionInput = { speed: 0, grounded: true, verticalVelocity: 0, turn: 0 }, motion = newMotion();
  for (const id of ['neo', 'trinity'] as const) {
    const rig = (await models.create(id))!, cold = (await models.create(id))!;
    const poses: Partial<MotionInput>[] = id === 'neo'
      ? [{}, { officeShirt: true }, { homeClothes: true }, { performance: 'touch' }, { performance: 'pod' }, { dojoOutfit: true }, {}]
      : [{}, { clubClothes: true }, { clubClothes: true, realWorld: true }, {}];
    for (const costume of poses) for (const firstPerson of [false, true]) {
      const current = { ...input, ...costume, firstPerson }, pose = advanceMotion(motion, current, 0);
      models.animate(rig, pose, motion, current, 0); models.animate(cold, pose, motion, current, 0);
      const patch = rig.wardrobe.find(part => part.mesh.userData.wristSkin)?.mesh;
      assert.ok(patch, 'the dressed body must include the missing anatomical wrist section');
      const complete = rig.wardrobe.some(part => part.mesh.visible && /^(Tracking_arms|Patient_body|Club_upper_body)$/.test(part.mesh.name));
      assert.equal(patch.visible, !complete, `${id}: only one connected skin layer, costume ${JSON.stringify(current)}`);
      assert.equal(cold.wardrobe.find(part => part.mesh.userData.wristSkin)!.mesh.visible, patch.visible);
    }
  }
});

test('Trinity’s restored forearm stays inside the fitted leather sleeve', async t => {
  const models = new HeroModels(new THREE.Texture(), new THREE.Texture()); t.after(() => models.dispose());
  (models as unknown as { load: typeof loadGeometry }).load = loadGeometry;
  const rig = (await models.create('trinity'))!, skin = rig.wardrobe.find(part => part.mesh.userData.wristSkin)!.mesh as THREE.SkinnedMesh;
  const jacket = rig.wardrobe.find(part => part.mesh.name === 'Fitted_leather_jacket')!.mesh as THREE.SkinnedMesh;
  (jacket.material as THREE.Material).side = THREE.DoubleSide;
  const ray = new THREE.Raycaster(), failures: number[] = []; let checked = 0;
  for (const roll of [0, -1.4, 1.4, 2.8]) {
    for (const side of ['R', 'L']) {
      const wrist = rig.bones.get(`wrist_${side}`)!, elbow = rig.bones.get(`elbow_${side}`)!;
      wrist.quaternion.setFromAxisAngle(wrist.position.clone().normalize(), roll);
      rig.root.updateMatrixWorld(true); skin.skeleton.update(); jacket.skeleton.update();
      const origin = wrist.getWorldPosition(new THREE.Vector3()), axis = origin.clone().sub(elbow.getWorldPosition(new THREE.Vector3())).normalize();
      for (let i = 0; i < skin.geometry.attributes.position.count; i += 3) {
        if ((side === 'R' ? -1 : 1) * skin.geometry.attributes.position.getX(i) < 0) continue;
        const point = skin.getVertexPosition(i, new THREE.Vector3()).applyMatrix4(skin.matrixWorld), along = point.clone().sub(origin).dot(axis);
        if (along > -.09 || along < -.34) continue;
        const center = origin.clone().addScaledVector(axis, along), radial = point.clone().sub(center), radius = radial.length();
        ray.set(center, radial.normalize()); ray.far = .24;
        const hit = ray.intersectObject(jacket, false)[0];
        assert.ok(hit, 'the selected forearm section must have a continuous sleeve'); checked++;
        if (hit.distance < radius + .001) failures.push(radius - hit.distance);
      }
    }
  }
  assert.ok(checked > 400, 'sample both anatomical arms and palm turns');
  assert.equal(failures.length, 0, `skin escapes its sleeve by up to ${Math.max(0, ...failures)} world units`);
  t.diagnostic(JSON.stringify({ checked, palmRotations: 4, arms: 2 }));
});
