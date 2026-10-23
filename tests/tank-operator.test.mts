import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { HeroModels } from '../packages/client/src/agents/HeroModel.js';
import { advanceMotion, newMotion, type MotionInput } from '../packages/client/src/agents/CharacterMotion.js';
import { FILM_SETS, interludeRoot } from '@auto_matrix/shared';

async function operator() {
  const models = new HeroModels(new THREE.Texture(), new THREE.Texture()), requests: string[] = [];
  (models as any).load = async (name: string) => {
    requests.push(name);
    const raw = await readFile(new URL(`../packages/client/public/assets/characters/${name}.glb`, import.meta.url)), size = raw.readUInt32LE(12);
    const doc = JSON.parse(raw.subarray(20, 20 + size).toString());
    for (const material of doc.materials) { delete material.pbrMetallicRoughness.baseColorTexture; delete material.normalTexture; }
    doc.images = []; doc.textures = [];
    const json = Buffer.from(JSON.stringify(doc)), padded = Buffer.alloc(Math.ceil(json.length / 4) * 4, 32); json.copy(padded);
    const bin = raw.subarray(20 + size), data = Buffer.alloc(20 + padded.length + bin.length);
    data.writeUInt32LE(0x46546c67); data.writeUInt32LE(2, 4); data.writeUInt32LE(data.length, 8); data.writeUInt32LE(padded.length, 12);
    data.writeUInt32LE(0x4e4f534a, 16); padded.copy(data, 20); bin.copy(data, 20 + padded.length);
    return new GLTFLoader().parseAsync(data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength), '');
  };
  const rig = (await models.create('neo', undefined, 'tank'))!;
  const draw = (extra: Partial<MotionInput> = {}, time = 0) => {
    const input = { speed: 0, grounded: true, verticalVelocity: 0, turn: 0, realWorld: true, ...extra };
    if (input.interlude) {
      const at = interludeRoot(input.interlude.kind, input.interlude.role, input.interlude), center = FILM_SETS.film_neb_deck.center;
      rig.root.position.set(center.x + at.x, center.y - 1, center.z + at.z); rig.root.rotation.y = at.yaw;
    }
    const motion = newMotion(); motion.phase = time;
    models.animate(rig, advanceMotion(motion, input, 0), motion, input, 0); rig.root.updateMatrixWorld(true);
  };
  return { models, rig, requests, draw };
}

test('Tank loads his own operator anatomy and keeps shirt, straps and headset in the actual ship pose', async () => {
  const h = await operator();
  try {
    h.draw(); assert.deepEqual(h.requests, ['tank'], 'Tank must not load Choi or Neo as his visible body');
    for (const name of ['Tank_ribbed_shirt', 'Tank_harness', 'Tank_headset', 'Tank_curled_hair', 'Tank_fingerless_gloves'])
      assert.ok(h.rig.root.getObjectByName(name)?.visible, `${name} must be present in the rendered character`);
    assert.equal(h.rig.root.getObjectByName('Tailored_coat_upper'), undefined);
    assert.equal(h.rig.panels.length, 0); assert.equal(h.rig.glasses.visible, false);
  } finally { h.models.dispose(); }
});

test('operator clothing retains its authored colours and attached anatomy across real-world and player views', async () => {
  const h = await operator();
  try {
    const shirt = h.rig.root.getObjectByName('Tank_ribbed_shirt') as THREE.SkinnedMesh;
    assert.ok(shirt); const color = (shirt.material as THREE.MeshStandardMaterial).color.clone();
    for (const realWorld of [true, false, true]) for (const firstPerson of [false, true, false]) {
      h.draw({ realWorld, firstPerson });
      assert.ok((shirt.material as THREE.MeshStandardMaterial).color.equals(color), 'ship cloth must not be recoloured to the old generic suit');
      const headset = h.rig.root.getObjectByName('Tank_headset')!;
      assert.equal(headset.visible, !firstPerson, 'headset cannot sit inside the first-person camera');
      assert.ok(shirt.visible && h.rig.root.getObjectByName('Tank_fingerless_gloves')!.visible);
    }
  } finally { h.models.dispose(); }
});

test('the face-to-neck skin keeps atlas seams on separate corners instead of stretching across the atlas', async t => {
  const h = await operator(); let maximumUvSpan = 0;
  try {
    const face = h.rig.root.getObjectByName('Tank_face') as THREE.SkinnedMesh;
    const uv = face.geometry.getAttribute('_body_uv'), index = face.geometry.index!;
    for (let i = 0; i < index.count; i += 3) for (let j = 0; j < 3; j++) {
      const a = index.getX(i + j), b = index.getX(i + (j + 1) % 3);
      const span = Math.hypot(uv.getX(a) - uv.getX(b), uv.getY(a) - uv.getY(b));
      maximumUvSpan = Math.max(maximumUvSpan, span);
    }
    t.diagnostic(JSON.stringify({ maximumUvSpan }));
    assert.ok(maximumUvSpan < .15, `a face triangle crosses unrelated skin islands: ${maximumUvSpan}`);
  } finally { h.models.dispose(); }
});

test('Tank keeps both articulated hands and gloves follow their own fingers without detached surfaces', async () => {
  const h = await operator();
  try {
    h.draw(); const skin = h.rig.root.getObjectByName('Anatomical_head_and_hands') as THREE.SkinnedMesh;
    const glove = h.rig.root.getObjectByName('Tank_fingerless_gloves') as THREE.SkinnedMesh; assert.ok(glove);
    for (const side of ['R', 'L']) for (let digit = 1; digit <= 5; digit++) {
      const joint = skin.skeleton.bones.findIndex(b => b.name === `finger${digit}-3_${side}`);
      assert.ok(joint >= 0); const a = skin.geometry.attributes; let count = 0;
      for (let v = 0; v < a.position.count; v++) if ([0, 1, 2, 3].some(k => a.skinIndex.getComponent(v, k) === joint && a.skinWeight.getComponent(v, k) > .5)) count++;
      assert.ok(count > 15, 'each fingertip must drive actual skin');
    }
    const rest = Array.from({ length: glove.geometry.attributes.position.count }, (_, i) => glove.getVertexPosition(i, new THREE.Vector3()));
    for (const side of ['R', 'L']) {
      h.rig.bones.get(`wrist_${side}`)!.rotation.x = .35;
      for (let digit = 1; digit <= 5; digit++) for (let segment = 1; segment <= 3; segment++)
        h.rig.bones.get(`finger${digit}-${segment}_${side}`)!.rotation.z = (side === 'L' ? -1 : 1) * (digit === 1 ? .18 : .45);
    }
    h.rig.root.updateMatrixWorld(true); glove.skeleton.update();
    const posed = rest.map((_, i) => glove.getVertexPosition(i, new THREE.Vector3())), index = glove.geometry.index!;
    assert.ok(posed.some((p, i) => p.distanceTo(rest[i]) > .02));
    for (let i = 0; i < index.count; i += 3) for (let j = 0; j < 3; j++) {
      const a = index.getX(i + j), b = index.getX(i + (j + 1) % 3), length = rest[a].distanceTo(rest[b]);
      if (length > .001) assert.ok(posed[a].distanceTo(posed[b]) < length * 2.8,
        `glove edge ${a}/${b} stretches ${posed[a].distanceTo(posed[b]) / length}: ${rest[a].toArray()} / ${rest[b].toArray()}`);
    }
  } finally { h.models.dispose(); }
});

test('the earpiece sits beside Tank’s actual ear rather than the unused authoring helpers', async () => {
  const h = await operator();
  try {
    h.draw();
    const face = h.rig.root.getObjectByName('Tank_face') as THREE.SkinnedMesh;
    const headset = h.rig.root.getObjectByName('Tank_headset') as THREE.SkinnedMesh;
    const head = h.rig.bones.get('head')!, eye = head.userData.cameraEye as THREE.Vector3;
    face.skeleton.update(); headset.skeleton.update();
    const local = (mesh: THREE.SkinnedMesh, v: number) => head.worldToLocal(mesh.localToWorld(mesh.getVertexPosition(v, new THREE.Vector3())));
    const ear = Array.from({ length: face.geometry.attributes.position.count }, (_, i) => local(face, i))
      .filter(p => p.x < -Math.abs(eye.z) * .5 && Math.abs(p.y - eye.y) < .13);
    assert.ok(ear.length > 50);
    let nearest = Infinity, count = 0;
    for (let i = 0; i < headset.geometry.attributes.position.count; i++) {
      const p = local(headset, i); if (p.y < eye.y - .09 || p.y > eye.y + .09) continue;
      const gap = Math.min(...ear.map(q => q.distanceTo(p))); nearest = Math.min(nearest, gap); count++;
      assert.ok(gap < .075, `earpiece floats ${gap} away from the actual head`);
    }
    assert.ok(count > 50 && nearest < .025, `earpiece has no close anchor: ${nearest}`);
  } finally { h.models.dispose(); }
});

test('the visible operator glove stays outside the bowl while Tank hands Neo his meal', async t => {
  const h = await operator(); let deepest = 0, samples = 0;
  try {
    for (let frame = 0; frame <= 46; frame++) {
      h.draw({ interlude: { kind: 'meal', role: 'tank', phase: 'performing', elapsed: frame / 20, physicalMeal: true } });
      const bowl = h.rig.root.getObjectByName('meal-serving-bowl');
      if (!bowl?.visible) continue;
      const shell = bowl.getObjectByName('meal-bowl-shell') as THREE.Mesh<THREE.LatheGeometry>;
      const profile = shell.geometry.parameters.points;
      const low = Math.min(...profile.map(p => p.y)), high = Math.max(...profile.map(p => p.y));
      const glove = h.rig.root.getObjectByName('Tank_fingerless_gloves') as THREE.SkinnedMesh;
      const a = glove.geometry.attributes; glove.skeleton.update();
      for (let v = 0; v < a.position.count; v++) {
        if (![0, 1, 2, 3].some(k => a.skinWeight.getComponent(v, k) > .25 && /^(wrist|finger.*)_R$/.test(glove.skeleton.bones[a.skinIndex.getComponent(v, k)].name))) continue;
        const p = bowl.worldToLocal(glove.localToWorld(glove.getVertexPosition(v, new THREE.Vector3())));
        if (p.y <= low + .02 || p.y >= high - .01) continue;
        let radius = 0;
        for (let i = 1; i < profile.length; i++) {
          const a = profile[i - 1], b = profile[i];
          if (p.y > Math.min(a.y, b.y) && p.y < Math.max(a.y, b.y)) radius = Math.max(radius, THREE.MathUtils.lerp(a.x, b.x, (p.y - a.y) / (b.y - a.y)));
        }
        const gap = Math.hypot(p.x, p.z) - radius; deepest = Math.min(deepest, gap); samples++;
        assert.ok(gap > -.012, `the mitten penetrates the actual bowl at ${frame / 20}: ${gap}`);
      }
    }
    assert.ok(samples > 100, 'the test must inspect visible glove surface near the carried bowl');
    t.diagnostic(JSON.stringify({ samples, deepest }));
  } finally { h.models.dispose(); }
});
