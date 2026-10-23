import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import { inflateSync } from 'node:zlib';
import * as THREE from 'three';
import { MELEE_COMBO } from '@auto_matrix/shared';
import { actor } from './helpers/fighting-hand-fixture.mjs';
import { patientNormal, skinJoins } from './helpers/patient-skin.mjs';
import { advanceMotion, newMotion } from '../packages/client/src/agents/CharacterMotion.js';

function boundary(mesh: THREE.SkinnedMesh) {
  const p = mesh.geometry.attributes.position, index = mesh.geometry.index!;
  const key = (i: number) => [p.getX(i), p.getY(i), p.getZ(i)].map(v => v.toFixed(5)).join(',');
  const edges = new Map<string, { count: number; a: number; b: number }>();
  for (let face = 0; face < index.count; face += 3) for (let corner = 0; corner < 3; corner++) {
    const a = index.getX(face + corner), b = index.getX(face + (corner + 1) % 3), id = [key(a), key(b)].sort().join('/');
    const edge = edges.get(id); if (edge) edge.count++; else edges.set(id, { count: 1, a, b });
  }
  return new Map([...edges].filter(([, e]) => e.count === 1 && [e.a, e.b].every(i => p.getY(i) > 3.1 && p.getY(i) < 4.05)));
}

async function skinColor(name: string) {
  const png = await readFile(new URL(`../packages/client/public/assets/characters/${name}`, import.meta.url));
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
  const pixel = (x: number, y: number, channel: number) => {
    const value = pixels[(Math.max(0, Math.min(height - 1, y)) * width + Math.max(0, Math.min(width - 1, x))) * channels + channel] / 255;
    return value <= .04045 ? value / 12.92 : ((value + .055) / 1.055) ** 2.4;
  };
  return (u: number, v: number) => {
    const x = u * width - .5, y = v * height - .5, X = Math.floor(x), Y = Math.floor(y), tx = x - X, ty = y - Y;
    return [0, 1, 2].map(c => pixel(X, Y, c) * (1 - tx) * (1 - ty) + pixel(X + 1, Y, c) * tx * (1 - ty)
      + pixel(X, Y + 1, c) * (1 - tx) * ty + pixel(X + 1, Y + 1, c) * tx * ty);
  };
}

for (const id of ['neo', 'morpheus'] as const) {
  test(`${id}: dojo chest joins the whole delivered neck boundary without a second overlapping neck`, async t => {
    const h = await actor(id); t.after(() => h.models.dispose());
    const head = h.rig.root.getObjectByName('Anatomical_head_and_hands') as THREE.SkinnedMesh;
    const skins = h.rig.wardrobe.filter(p => p.mesh.userData.dojoSkin).map(p => p.mesh as THREE.SkinnedMesh);
    const rim = boundary(head), other = new Map(skins.flatMap(skin => [...boundary(skin)]));
    assert.ok(rim.size >= 120, 'inspect the full anatomical neck ring, including back and shoulder UV seams');
    const missing = [...rim.keys()].filter(edge => !other.has(edge));
    assert.equal(missing.length, 0, `${missing.length}/${rim.size} head boundary edges have no matching chest edge`);
    const height = Math.max(...[...rim.values()].flatMap(e => [e.a, e.b]).map(i => head.geometry.attributes.position.getY(i)));
    for (const skin of skins) {
      const p = skin.geometry.attributes.position, index = skin.geometry.index!;
      assert.ok([...index.array].every(i => p.getY(i) <= height + 1e-5), `${skin.name}: duplicate skin extends above the finished neck boundary`);
    }
  });

  test(`${id}: the neck keeps its join and lighting through head turns, strikes and dodge`, async t => {
    const h = await actor(id); t.after(() => h.models.dispose());
    const head = h.rig.root.getObjectByName('Anatomical_head_and_hands') as THREE.SkinnedMesh;
    const body = h.rig.wardrobe.find(p => p.mesh.userData.dojoSkin && p.mesh.geometry.attributes.position.getY(0) > 3)?.mesh as THREE.SkinnedMesh;
    assert.ok(body, 'a separate chest must complement the head; feet cannot share the duplicate neck surface');
    const joins = skinJoins(head, body); assert.ok(joins.pairs.length >= 120);
    const input = { speed: 0, grounded: true, verticalVelocity: 0, turn: 0, dojoOutfit: id, dojoSparring: true };
    const phases = [{ combo: 0, age: 10, dodge: false }, { combo: 0, age: 10, dodge: true },
      ...MELEE_COMBO.flatMap((strike, combo) => [0, strike.contact, strike.duration].map(age => ({ combo, age, dodge: false })))];
    let maximumGap = 0, maximumAngle = 0;
    for (const phase of phases) for (const turn of [-1, 0, 1]) {
      const motion = newMotion(); motion.combo = phase.combo; motion.attackAge = phase.age; motion.turn = turn;
      if (phase.dodge) { motion.skill = 'dodge'; motion.skillAge = .15; }
      const controls = { ...input, turn };
      h.models.animate(h.rig, advanceMotion(motion, controls, 0), motion, controls, 0); h.rig.root.updateMatrixWorld(true);
      head.skeleton.update(); body.skeleton.update();
      for (const [a, b] of joins.pairs) {
        maximumGap = Math.max(maximumGap, head.localToWorld(head.getVertexPosition(a, new THREE.Vector3())).distanceTo(body.localToWorld(body.getVertexPosition(b, new THREE.Vector3()))));
        maximumAngle = Math.max(maximumAngle, patientNormal(head, a).angleTo(patientNormal(body, b)));
      }
    }
    assert.ok(maximumGap < 2e-5, `neck skin opens by ${maximumGap} during the actual animation`);
    assert.ok(maximumAngle < .002, `neck lighting breaks by ${THREE.MathUtils.radToDeg(maximumAngle)} degrees`);
    const faceMaterial = head.material as THREE.MeshPhysicalMaterial, chestMaterial = body.material as THREE.MeshPhysicalMaterial;
    assert.equal(chestMaterial.type, faceMaterial.type, 'the chest and head must use the same skin response');
    assert.equal(chestMaterial.specularIntensity, faceMaterial.specularIntensity);
    assert.equal(chestMaterial.roughness, faceMaterial.roughness); assert.equal(chestMaterial.metalness, faceMaterial.metalness);
    t.diagnostic(JSON.stringify({ id, poses: phases.length * 3, pairs: joins.pairs.length, maximumGap, maximumAngle }));
  });

  test(`${id}: the actual two texture atlases meet with the same rendered skin tone`, async t => {
    const h = await actor(id); t.after(() => h.models.dispose());
    const head = h.rig.root.getObjectByName('Anatomical_head_and_hands') as THREE.SkinnedMesh;
    const chest = h.rig.root.getObjectByName(id + '-dojo-neck') as THREE.SkinnedMesh;
    const face = await skinColor(id + '-albedo.png'), body = await skinColor(id === 'neo' ? 'neo-office-skin.png' : 'morpheus-dojo-skin.png');
    const hc = (head.material as THREE.MeshStandardMaterial).color.toArray(), bc = (chest.material as THREE.MeshStandardMaterial).color.toArray();
    const hu = head.geometry.attributes.uv, bu = chest.geometry.attributes.uv;
    const errors = skinJoins(head, chest).pairs.flatMap(([a, b]) => {
      const actual = body(bu.getX(b), bu.getY(b)), expected = face(hu.getX(a), hu.getY(a));
      return expected.map((value, c) => Math.abs(actual[c] * bc[c] - value * hc[c]) / Math.max(value * hc[c], .01));
    });
    const mean = errors.reduce((a, b) => a + b, 0) / errors.length, maximum = Math.max(...errors);
    t.diagnostic(JSON.stringify({ id, channels: errors.length, meanRelativeColorError: mean, maximumRelativeColorError: maximum }));
    assert.ok(mean < .04 && maximum < .14, `${id}: the real texture pixels create a color seam (mean ${mean}, max ${maximum})`);
  });

  test(`${id}: cached actors do not accumulate skin gain or rebuild the chest every frame`, async t => {
    const h = await actor(id); t.after(() => h.models.dispose());
    const other = (await h.models.create(id))!;
    const chest = h.rig.root.getObjectByName(id + '-dojo-neck') as THREE.SkinnedMesh;
    const shared = other.root.getObjectByName(id + '-dojo-neck') as THREE.SkinnedMesh;
    const material = chest.material as THREE.MeshStandardMaterial;
    const color = material.color.toArray(), normal = chest.geometry.attributes.normal, before = normal.array.slice(), version = normal.version;
    assert.deepEqual((shared.material as THREE.MeshStandardMaterial).color.toArray(), color, 'cached source material is never recolored in place');
    const input = { speed: 0, grounded: true, verticalVelocity: 0, turn: 0, dojoOutfit: id, dojoSparring: true };
    for (let i = 0; i < 12; i++) {
      const state = newMotion(); state.combo = i % 3; state.attackAge = i / 20;
      h.models.animate(h.rig, advanceMotion(state, input, 0), state, input, 0);
      assert.ok(chest.visible); assert.equal(normal.version, version);
      assert.deepEqual(normal.array, before, 'the exported normal field needs no per-frame regeneration');
      assert.deepEqual(material.color.toArray(), color);
    }
    const ordinary = { speed: 0, grounded: true, verticalVelocity: 0, turn: 0 }, state = newMotion();
    h.models.animate(h.rig, advanceMotion(state, ordinary, 0), state, ordinary, 0);
    assert.equal(chest.visible, false, 'dojo chest skin cannot leak into city or ship costumes');
    h.models.animate(h.rig, advanceMotion(state, input, 0), state, input, 0);
    assert.deepEqual(material.color.toArray(), color); assert.equal(normal.version, version);
    let disposed = 0; chest.geometry.addEventListener('dispose', () => disposed++);
    h.models.dispose(); assert.equal(disposed, 1, 'the shared asset geometry is released once');
  });
}
