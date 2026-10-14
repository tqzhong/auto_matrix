import assert from 'node:assert/strict';
import test, { type TestContext } from 'node:test';
import { readFile } from 'node:fs/promises';
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { clone } from 'three/addons/utils/SkeletonUtils.js';
import { FILM_SETS, SPOON_LESSON, spoonLessonBend, type SpoonLesson } from '@auto_matrix/shared';
import { CharacterModels } from '../packages/client/src/agents/CharacterModel.js';
import { WorldState } from '../packages/server/src/world/WorldState.js';
import { AgentManager } from '../packages/server/src/agents/AgentManager.js';

async function fixture(t: TestContext) {
  const assets = new Map();
  for (const name of ['oracle-park-hands', 'spoon_boy-head', 'spoon_boy-body']) {
    const raw = await readFile(new URL(`../packages/client/public/assets/characters/${name}.glb`, import.meta.url));
    const size = raw.readUInt32LE(12), doc = JSON.parse(raw.subarray(20, 20 + size).toString());
    for (const m of doc.materials) delete m.pbrMetallicRoughness.baseColorTexture;
    doc.images = []; doc.textures = [];
    const text = Buffer.from(JSON.stringify(doc)), padded = Buffer.alloc(Math.ceil(text.length / 4) * 4, 32); text.copy(padded);
    const bin = raw.subarray(20 + size), data = Buffer.alloc(20 + padded.length + bin.length);
    data.writeUInt32LE(0x46546c67); data.writeUInt32LE(2, 4); data.writeUInt32LE(data.length, 8);
    data.writeUInt32LE(padded.length, 12); data.writeUInt32LE(0x4e4f534a, 16); padded.copy(data, 20); bin.copy(data, 20 + padded.length);
    const asset = await new GLTFLoader().parseAsync(data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength), '');
    if (name.endsWith('-head')) asset.scene.traverse(object => { if (object instanceof THREE.Mesh) (object.material as THREE.MeshStandardMaterial).map = new THREE.Texture(); });
    assets.set(name, asset);
  }
  t.mock.method(GLTFLoader.prototype, 'loadAsync', async url => {
    const asset = assets.get(String(url).split('/').pop()!.replace('.glb', '')); assert.ok(asset, String(url));
    return { ...asset, scene: clone(asset.scene) };
  });
  t.mock.method(THREE.TextureLoader.prototype, 'load', () => new THREE.Texture());
  const previous = globalThis.document;
  globalThis.document = { createElement: () => ({ getContext: () => ({ createImageData: (w: number, h: number) => ({ data: new Uint8ClampedArray(w * h * 4) }), putImageData() {} }) }) } as unknown as Document;
  const world = new WorldState(); new AgentManager(world).initializeAllAgents(); const models = new CharacterModels();
  const create = async () => {
    const rig = models.create(world.agents.get('spoon_boy')!);
    models.animate(rig, 0, { speed: 0, grounded: true, verticalVelocity: 0, turn: 0 }, 4);
    await new Promise(resolve => setImmediate(resolve));
    const c = FILM_SETS.film_oracle_home.center, at = SPOON_LESSON.boy;
    rig.root.position.set(c.x + at.x, c.y - 1, c.z + at.z); rig.root.rotation.y = at.yaw; return rig;
  };
  const draw = (rig: Awaited<ReturnType<typeof create>>, phase: SpoonLesson['phase'], elapsed: number) => {
    const lesson = { phase, elapsed };
    models.animate(rig, 0, { speed: 0, grounded: true, verticalVelocity: 0, turn: 0, seated: true, floorSeated: true,
      spoon: spoonLessonBend(lesson, 'boy', 0), spoonLesson: { ...lesson, role: 'boy' } }, 4);
    rig.root.updateMatrixWorld(true);
  };
  t.after(() => { models.dispose(); globalThis.document = previous; });
  return { models, create, draw, assets };
}

test('the spoon boy loads one continuous bald child head and a draped body instead of modern belts and boots', async t => {
  const h = await fixture(t), rig = await h.create(); h.draw(rig, 'offered', 0);
  const face = rig.root.getObjectByName('spoon_boy-anatomical-head') as THREE.Mesh | undefined;
  assert.ok(face && face.geometry.attributes.position.count > 3000, 'the child must have real head/ear/neck anatomy');
  assert.equal(rig.root.getObjectByName('spoon_boy-fallback-head')?.visible, false);
  assert.equal(rig.root.getObjectByName('spoon_boy-neck')?.visible, false);
  assert.equal(rig.root.getObjectByName('spoon_boy-hair'), undefined, 'the movie child has a shaved head');
  const body = rig.root.getObjectByName('spoon_boy-detailed-body'); assert.ok(body?.visible);
  assert.ok(body.getObjectByName('spoon_boy-draped-wrap'), 'the movie costume needs a layered light wrap');
  assert.equal(body.getObjectByName('spoon_boy-work-boots'), undefined);
  assert.ok(rig.spoonHands?.every(hand => hand.skin.visible && hand.root.visible), 'loading the body must preserve the five-finger hands');
});

test('the child profile follows the registered reference instead of an oversized nose and rear skull', async t => {
  const h = await fixture(t), head = h.assets.get('spoon_boy-head').scene.children[0] as THREE.Mesh;
  const p = head.geometry.attributes.position, sagittal: THREE.Vector3[] = [];
  for (let i = 0; i < p.count; i++) if (Math.abs(p.getX(i)) < .025) sagittal.push(new THREE.Vector3().fromBufferAttribute(p, i));
  const nose = Math.max(...sagittal.filter(p => p.y > -.22 && p.y < -.04).map(p => p.z));
  const back = Math.min(...sagittal.filter(p => p.y > -.18).map(p => p.z));
  assert.ok(nose > .245 && nose < .294, `nose projects beyond the registered child profile: ${nose}`);
  assert.ok(back > -.31, `rear skull exceeds the reference silhouette: ${back}`);
});

test('the face projection does not stamp a clipped portrait column across the temples', async t => {
  const h = await fixture(t), head = h.assets.get('spoon_boy-head').scene.children[0] as THREE.Mesh;
  const { position, uv, _face_weight } = head.geometry.attributes; let painted = 0;
  for (let i = 0; i < position.count; i++) {
    if (_face_weight.getX(i) < .20 || Math.abs(position.getX(i)) < .16 || position.getY(i) < -.25) continue;
    painted++;
    const projected = (315.5 + position.getX(i) / (.31 / 331)) / 1254;
    assert.ok(Math.abs(uv.getX(i) - projected) < .0001, 'a repeated portrait border creates visible horizontal facial stripes');
  }
  assert.ok(painted > 50, 'check painted temple and forehead skin');
});

test('the ivory wrap has matching bindings rather than a dark military neckline', async t => {
  const h = await fixture(t), rig = await h.create(); h.draw(rig, 'offered', 0);
  const body = rig.root.getObjectByName('spoon_boy-detailed-body')!;
  const cloth = (body.getObjectByName('spoon_boy-robe-foundation') as THREE.Mesh).material as THREE.MeshStandardMaterial;
  const edge = (body.getObjectByName('spoon_boy-sewn-bindings') as THREE.Mesh).material as THREE.MeshStandardMaterial;
  assert.ok(edge.color.toArray().every((value, i) => Math.abs(value - cloth.color.toArray()[i]) < .04), 'the film wrap must not have the inherited dark uniform binding');
});

test('both bare forearms meet the anatomical wrist connection without a visible gap', async t => {
  const h = await fixture(t), rig = await h.create();
  const skin = rig.root.getObjectByName('spoon_boy-anatomical-body') as THREE.SkinnedMesh;
  const p = skin.geometry.attributes.position, index = skin.geometry.index!, welded = new Map<string, number>(), unique: number[] = [], edges = new Map<string, { a: number; b: number; count: number }>();
  for (let i = 0; i < p.count; i++) {
    const key = [p.getX(i), p.getY(i), p.getZ(i)].map(v => Math.round(v * 1e5)).join(':');
    if (!welded.has(key)) welded.set(key, i); unique.push(welded.get(key)!);
  }
  for (let i = 0; i < index.count; i += 3) for (let j = 0; j < 3; j++) {
    const a = unique[index.getX(i + j)], b = unique[index.getX(i + (j + 1) % 3)], key = [Math.min(a, b), Math.max(a, b)].join(':');
    const edge = edges.get(key); if (edge) edge.count++; else edges.set(key, { a, b, count: 1 });
  }
  let maximum = 0;
  for (const [phase, elapsed] of [['demonstrating', 0], ['demonstrating', 1.8], ['offered', 0], ['receiving', 1.42], ['focus', 0]] as const) {
    h.draw(rig, phase, elapsed); skin.skeleton.update();
    for (const [side, hand] of rig.spoonHands!.entries()) {
      const segments = [...edges.values()].filter(e => e.count === 1 && [e.a, e.b].every(i => p.getY(i) < 2.1 && (side ? p.getX(i) > .3 : p.getX(i) < -.3)))
        .map(e => new THREE.Line3(...[e.a, e.b].map(i => skin.localToWorld(skin.getVertexPosition(i, new THREE.Vector3()))) as [THREE.Vector3, THREE.Vector3]));
      assert.ok(segments.length > 20, 'measure the actual clipped forearm rim');
      const connection = hand.connection.mesh, cp = connection.geometry.attributes.position, columns = hand.connection.edge.length + 1;
      for (let i = cp.count - columns; i < cp.count; i++) {
        const point = connection.localToWorld(new THREE.Vector3().fromBufferAttribute(cp, i)), closest = new THREE.Vector3();
        maximum = Math.max(maximum, Math.min(...segments.map(line => line.closestPointToPoint(point, true, closest).distanceTo(point))));
      }
    }
  }
  t.diagnostic(JSON.stringify({ maximumBareWristGap: maximum }));
  assert.ok(maximum < .002, `bare wrists retain an exposed seam: ${maximum}`);
});

test('the clothed child keeps his feet above the rug and reconstructs the same saved skin after walking and cold loading', async t => {
  const h = await fixture(t), warm = await h.create(), cold = await h.create();
  const surfaces = (rig: typeof warm) => {
    const points: THREE.Vector3[] = [];
    rig.detail.traverseVisible(object => {
      if (!(object instanceof THREE.Mesh)) return;
      if (object instanceof THREE.SkinnedMesh) object.skeleton.update();
      for (let i = 0; i < object.geometry.attributes.position.count; i += 7)
        points.push(object.localToWorld(object.getVertexPosition(i, new THREE.Vector3())));
    }); return points;
  };
  for (const [phase, elapsed] of [['demonstrating', .8], ['offered', 0], ['receiving', 1.42], ['focus', 0]] as const) {
    h.draw(warm, phase, elapsed); const before = surfaces(warm);
    assert.ok(before.every(p => Number.isFinite(p.length())), 'every actual skin/cloth surface must remain finite');
    const c = FILM_SETS.film_oracle_home.center;
    assert.ok(before.every(p => p.y >= c.y - 1 - .015), `${phase}: skin or clothing enters the rug`);
    h.models.animate(warm, .13, { speed: 6, grounded: true, verticalVelocity: 0, turn: .4 }, 4);
    h.draw(warm, phase, elapsed); h.draw(cold, phase, elapsed);
    for (const rig of [warm, cold]) {
      const after = surfaces(rig); assert.equal(after.length, before.length);
      assert.ok(before.every((p, i) => p.distanceTo(after[i]) < 1e-5), `${phase}: clothed anatomy depends on previous action`);
    }
  }
});

test('the movie child closes all five digits around the upper shaft rather than pinching the bottom', async t => {
  const h = await fixture(t), rig = await h.create();
  for (const [phase, elapsed] of [['demonstrating', .8], ['offered', 0], ['receiving', 1.09]] as const) {
    h.draw(rig, phase, elapsed); const skin = rig.spoonHands![0].skin, spoon = rig.spoon!.root; skin.skeleton.update();
    const pads = Array.from({ length: 5 }, () => new THREE.Vector3()), count = [0, 0, 0, 0, 0];
    const { skinIndex, skinWeight } = skin.geometry.attributes;
    for (let i = 0; i < skinIndex.count; i++) for (let part = 0; part < 4; part++) {
      const match = /^finger([1-5])-3_R$/.exec(skin.skeleton.bones[skinIndex.getComponent(i, part)].name);
      if (!match || skinWeight.getComponent(i, part) < .95) continue;
      const digit = Number(match[1]) - 1;
      pads[digit].add(spoon.worldToLocal(skin.localToWorld(skin.getVertexPosition(i, new THREE.Vector3())))); count[digit]++;
    }
    pads.forEach((p, digit) => {
      assert.ok(count[digit] > 10); p.divideScalar(count[digit]);
      assert.ok(p.y > .28 && p.y < .65, `${phase}: digit ${digit + 1} is not wrapping the upper shaft: ${p.toArray()}`);
    });
  }
});

test('all five gripping digits touch the actual curved metal and the hand surface stays outside its shaft', async t => {
  const h = await fixture(t), rig = await h.create(); let probes = 0, worst = { margin: Infinity, phase: '', point: [] as number[], bone: '' };
  for (const [phase, elapsed] of [['demonstrating', 0], ['demonstrating', .8], ['demonstrating', 1.8], ['demonstrating', 2.5], ['offered', 0], ['receiving', 1.09]] as const) {
    h.draw(rig, phase, elapsed); const skin = rig.spoonHands![0].skin, spoon = rig.spoon!.root; skin.skeleton.update();
    const metal = spoon.children[0] as THREE.Mesh, triangles: THREE.Triangle[] = [], closest = new THREE.Vector3();
    const mp = metal.geometry.attributes.position, mi = metal.geometry.index!;
    for (let i = 0; i < mi.count; i += 3) triangles.push(new THREE.Triangle(...[0, 1, 2].map(j => metal.localToWorld(new THREE.Vector3().fromBufferAttribute(mp, mi.getX(i + j)))) as [THREE.Vector3, THREE.Vector3, THREE.Vector3]));
    const { skinIndex, skinWeight } = skin.geometry.attributes, gaps = [Infinity, Infinity, Infinity, Infinity, Infinity];
    const vertices = Array.from({ length: skinIndex.count }, (_, i) => skin.localToWorld(skin.getVertexPosition(i, new THREE.Vector3())));
    for (let i = 0; i < vertices.length; i += 3) for (let part = 0; part < 4; part++) {
      const match = /^finger([1-5])-[23]_R$/.exec(skin.skeleton.bones[skinIndex.getComponent(i, part)].name);
      if (!match || skinWeight.getComponent(i, part) < .7) continue;
      const d = Number(match[1]) - 1;
      for (const triangle of triangles) gaps[d] = Math.min(gaps[d], triangle.closestPointToPoint(vertices[i], closest).distanceTo(vertices[i]));
    }
    gaps.forEach((gap, i) => assert.ok(gap < .01, `${phase}/${elapsed}: digit ${i + 1} floats ${gap} from the actual metal`));
    const samples = vertices.map(p => spoon.worldToLocal(p.clone())), index = skin.geometry.index!;
    for (let i = 0; i < index.count; i += 3) samples.push(samples[index.getX(i)].clone().add(samples[index.getX(i + 1)]).add(samples[index.getX(i + 2)]).divideScalar(3));
    const curvature = -Math.max(.00001, spoonLessonBend({ phase, elapsed }, 'boy', 0)! * 3.2);
    for (const [sample, p] of samples.entries()) {
      const angle = THREE.MathUtils.clamp(Math.atan2((p.y - .17) * curvature, 1 - p.x * curvature), .48 * curvature, 0);
      const center = new THREE.Vector3((1 - Math.cos(angle)) / curvature, .17 + Math.sin(angle) / curvature, 0);
      const straight = new THREE.Vector3(0, THREE.MathUtils.clamp(p.y, 0, .17), 0);
      const curved = p.distanceToSquared(center) < p.distanceToSquared(straight);
      const height = curved ? .17 + angle / curvature : straight.y, theta = curved ? angle : 0, at = curved ? center : straight;
      const dx = p.x - at.x, dy = p.y - at.y, across = dx * Math.cos(theta) - dy * Math.sin(theta), along = dx * Math.sin(theta) + dy * Math.cos(theta);
      if (height <= .001 || height >= .649 || Math.abs(along) > .005 || Math.abs(across) > .08 || Math.abs(p.z) > .03) continue;
      const radius = .045 - .013 * height / .65;
      const margin = Math.max(...Array.from({ length: 8 }, (_, j) => { const a = (j + .5) * Math.PI / 4; return Math.cos(a) * across / radius + Math.sin(a) * p.z / (radius * .24); })) - Math.cos(Math.PI / 8);
      probes++; if (margin < worst.margin) {
        const v = sample < vertices.length ? sample : index.getX((sample - vertices.length) * 3);
        const dominant = [0, 1, 2, 3].sort((a, b) => skinWeight.getComponent(v, b) - skinWeight.getComponent(v, a))[0];
        worst = { margin, phase: `${phase}/${elapsed}`, point: p.toArray(), bone: skin.skeleton.bones[skinIndex.getComponent(v, dominant)].name };
      }
    }
  }
  assert.ok(probes > 100); t.diagnostic(JSON.stringify({ probes, worst }));
  assert.ok(worst.margin > -.007, `actual hand enters the shaft: ${JSON.stringify(worst)}`);
});
