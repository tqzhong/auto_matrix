import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import * as THREE from 'three';
import { actor } from './helpers/fighting-hand-fixture.mjs';
import { advanceMotion, newMotion } from '../packages/client/src/agents/CharacterMotion.js';
import { redDressAttention } from '@auto_matrix/shared';

test('all red-dress texture dependencies are present in the shipped public assets', async () => {
  const path = new URL('../packages/client/public/assets/characters/red-dress.glb', import.meta.url);
  const bytes = await readFile(path), document = JSON.parse(bytes.subarray(20, 20 + bytes.readUInt32LE(12)).toString());
  for (const image of document.images) {
    const texture = await readFile(new URL(image.uri, path));
    assert.deepEqual([...texture.subarray(0, 8)], [137, 80, 78, 71, 13, 10, 26, 10], `${image.uri} must be an actual PNG`);
  }
});

test('the red-dress actor loads her own continuous anatomy and costume instead of Trinity', async t => {
  const h = await actor('trinity'); t.after(() => h.models.dispose());
  const load = h.models['load'].bind(h.models), requested: string[] = [];
  h.models['load'] = name => { requested.push(name); return load(name); };
  const rig = (await h.models.create('trinity', undefined, 'citizen_2'))!;
  assert.deepEqual(requested, ['red-dress']);
  const body = rig.root.getObjectByName('Red_dress_anatomy');
  assert.ok(body instanceof THREE.SkinnedMesh, 'head, shoulders, arms and legs use the anatomical skin');
  for (const side of ['R', 'L']) for (let digit = 1; digit <= 5; digit++) for (let joint = 1; joint <= 3; joint++)
    assert.ok(rig.bones.has(`finger${digit}-${joint}_${side}`));
  const costume = rig.root.getObjectByName('Red_dress_satin') as THREE.SkinnedMesh;
  assert.ok(costume instanceof THREE.SkinnedMesh, 'the dress follows the real body skeleton');
  costume.geometry.computeBoundingBox();
  const knee = rig.bones.get('knee_L')!.getWorldPosition(new THREE.Vector3()).y;
  assert.ok(Math.abs(costume.geometry.boundingBox!.min.y - knee) < .35, 'the movie dress ends near the knees');
  assert.equal(rig.root.getObjectByName('Tailored_trousers'), undefined);
  const motion = newMotion(), input = { speed: 0, grounded: true, verticalVelocity: 0, turn: 0 };
  h.models.animate(rig, advanceMotion(motion, input, 0), motion, input, 0);
  assert.equal(rig.glasses.visible, false, 'the woman does not wear Trinity sunglasses');
});

test('red-dress walking and a frozen saved frame restore the actual costume and finger pose', async t => {
  const h = await actor('trinity'); t.after(() => h.models.dispose());
  const rig = (await h.models.create('trinity', undefined, 'citizen_2'))!;
  assert.ok(rig.root.getObjectByName('Red_dress_satin'));
  const draw = (clock: number, elapsed = clock, frozen = false) => {
    const motion = newMotion(), attention = redDressAttention(frozen ? 6.2 : clock); attention.clock = clock;
    const input = { speed: 0, grounded: true, verticalVelocity: 0, turn: 0,
      training: { kind: 'red_dress' as const, role: 'citizen_2' as const, elapsed, attention } };
    h.models.animate(rig, advanceMotion(motion, input, 0), motion, input, 0); rig.root.updateMatrixWorld(true);
    return [...rig.bones].map(([name, bone]) => [name, bone.matrixWorld.toArray()]);
  };
  const walking = draw(2.73); assert.notDeepEqual(draw(3.13), walking); assert.deepEqual(draw(2.73), walking);
  const frozen = draw(5.3, 6.2, true); assert.deepEqual(draw(5.3, 12, true), frozen);
});

test('the actual satin covers the torso and both thighs during the saved training walk', async t => {
  const h = await actor('trinity'); t.after(() => h.models.dispose());
  const rig = (await h.models.create('trinity', undefined, 'citizen_2'))!;
  const material = new THREE.MeshBasicMaterial({ side: THREE.DoubleSide }); t.after(() => material.dispose());
  const samples: string[] = [];
  for (const clock of [0, 1.3, 2.73, 4.1]) {
    const motion = newMotion(), attention = redDressAttention(clock); attention.clock = clock;
    const input = { speed: 0, grounded: true, verticalVelocity: 0, turn: 0,
      training: { kind: 'red_dress' as const, role: 'citizen_2' as const, elapsed: clock, attention } };
    h.models.animate(rig, advanceMotion(motion, input, 0), motion, input, 0); rig.root.updateMatrixWorld(true);
    let hemTop = -Infinity;
    const meshes = ['Red_dress_anatomy', 'Red_dress_satin'].map(name => {
      const mesh = rig.root.getObjectByName(name) as THREE.SkinnedMesh, a = mesh.geometry.attributes;
      mesh.skeleton.update(); const positions: number[] = [], indices: number[] = [], covered: boolean[] = [];
      let hem = Infinity;
      if (name === 'Red_dress_satin') for (let i = 0; i < a.position.count; i++) hem = Math.min(hem, a.position.getY(i));
      for (let i = 0; i < a.position.count; i++) {
        const p = rig.root.worldToLocal(mesh.localToWorld(mesh.getVertexPosition(i, new THREE.Vector3()))); positions.push(...p.toArray());
        if (name === 'Red_dress_satin' && a.position.getY(i) < hem + .001) hemTop = Math.max(hemTop, p.y);
        const arm = [0, 1, 2, 3].reduce((sum, k) => sum + (/shoulder|elbow|wrist|finger|forearm/.test(mesh.skeleton.bones[a.skinIndex.getComponent(i, k)].name) ? a.skinWeight.getComponent(i, k) : 0), 0);
        covered.push(arm < .3);
      }
      const source = mesh.geometry.index!;
      for (let i = 0; i < source.count; i += 3) {
        const triangle = [0, 1, 2].map(k => source.getX(i + k)); if (triangle.every(v => covered[v])) indices.push(...triangle);
      }
      const geometry = new THREE.BufferGeometry(); geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3)); geometry.setIndex(indices);
      return new THREE.Mesh(geometry, material);
    });
    try {
      const jointY = (name: string) => rig.bones.get(name)!.getWorldPosition(new THREE.Vector3()).y;
      const knee = Math.max(jointY('knee_R'), jointY('knee_L')), hip = jointY('pelvis'), shoulder = jointY('shoulder_L');
      const heights = [hemTop + .06, knee + .3, (knee + hip) / 2, hip - .2, hip + .1, hip + .4, shoulder - .50, shoulder - .28];
      for (const [level, y] of heights.entries()) for (let i = 0; i < 24; i++) {
        if (y < hemTop + .03) continue; // Exposed lower legs below the moving hem are intentional.
        const angle = i * Math.PI / 12, ray = new THREE.Raycaster(new THREE.Vector3(0, y, 0), new THREE.Vector3(Math.sin(angle), 0, Math.cos(angle)), 0, 1.5);
        if (level === heights.length - 1 && Math.cos(angle) < .5) continue; // The halter leaves the upper back bare.
        const skin = ray.intersectObject(meshes[0]).at(-1), cloth = ray.intersectObject(meshes[1]).at(-1);
        if (skin && (!cloth || cloth.distance < skin.distance - .012)) samples.push(`t=${clock}, y=${y}, angle=${i}: skin=${skin.distance.toFixed(3)}, cloth=${cloth?.distance.toFixed(3) ?? 'missing'}`);
      }
    } finally { meshes.forEach(mesh => mesh.geometry.dispose()); }
  }
  assert.deepEqual(samples, [], `skin crosses the dress: ${samples.slice(0, 12).join('; ')}`);
});

test('red pumps have real heels and their complete surfaces remain supported throughout the walk', async t => {
  const h = await actor('trinity'); t.after(() => h.models.dispose());
  const rig = (await h.models.create('trinity', undefined, 'citizen_2'))!;
  const meshes = ['Red_dress_pumps', 'Red_dress_outsoles', 'Red_dress_heels'].map(name => {
    const mesh = rig.root.getObjectByName(name); assert.ok(mesh instanceof THREE.SkinnedMesh, name); return mesh;
  });
  const point = new THREE.Vector3(), misses: string[] = [];
  for (let frame = 0; frame <= 53; frame++) {
    const clock = frame / 10, attention = redDressAttention(clock); attention.clock = clock;
    const motion = newMotion(), input = { speed: 0, grounded: true, verticalVelocity: 0, turn: 0,
      training: { kind: 'red_dress' as const, role: 'citizen_2' as const, elapsed: clock, attention } };
    h.models.animate(rig, advanceMotion(motion, input, 0), motion, input, 0); rig.root.updateMatrixWorld(true);
    let lowest = Infinity;
    for (const mesh of meshes) {
      mesh.skeleton.update();
      for (let i = 0; i < mesh.geometry.attributes.position.count; i++)
        lowest = Math.min(lowest, rig.root.worldToLocal(mesh.localToWorld(mesh.getVertexPosition(i, point))).y);
    }
    if (lowest < -.025 || lowest > .025) misses.push(`t=${clock}: lowest=${lowest.toFixed(4)}`);
  }
  assert.deepEqual(misses, []);
});

test('the visible fronts of the pumps cover the forefoot instead of revealing bare toes', async t => {
  const h = await actor('trinity'); t.after(() => h.models.dispose());
  const rig = (await h.models.create('trinity', undefined, 'citizen_2'))!;
  const material = new THREE.MeshBasicMaterial(); t.after(() => material.dispose());
  const meshes = ['Red_dress_anatomy', 'Red_dress_pumps'].map(name => {
    const skin = rig.root.getObjectByName(name) as THREE.SkinnedMesh;
    const geometry = skin.geometry.clone(); t.after(() => geometry.dispose());
    return new THREE.Mesh(geometry, material);
  });
  const misses: string[] = [];
  for (const side of ['L', 'R']) {
    const ankle = rig.bones.get(`ankle_${side}`)!.getWorldPosition(new THREE.Vector3());
    for (let x = -7; x <= 7; x++) for (let row = 0; row <= 12; row++) {
      const dx = x * .02, z = .27 + row * .02;
      const ray = new THREE.Raycaster(new THREE.Vector3(ankle.x + dx, 1, z), new THREE.Vector3(0, -1, 0));
      const skin = ray.intersectObject(meshes[0])[0], shoe = ray.intersectObject(meshes[1])[0];
      if (skin && (!shoe || shoe.point.y < skin.point.y - .012)) misses.push(`${side} x=${dx} z=${z}: skin=${skin.point.y}, shoe=${shoe?.point.y ?? 'missing'}`);
    }
  }
  assert.deepEqual(misses, []);
});

test('the walking hands keep continuous joints and relaxed anatomical fingertip directions', async t => {
  const h = await actor('trinity'); t.after(() => h.models.dispose());
  const rig = (await h.models.create('trinity', undefined, 'citizen_2'))!;
  const skin = rig.root.getObjectByName('Red_dress_anatomy') as THREE.SkinnedMesh, a = skin.geometry.attributes;
  const digits = ['L', 'R'].flatMap(side => Array.from({ length: 5 }, (_, i) => {
    const name = `finger${i + 1}-3_${side}`, tips: number[] = [];
    for (let v = 0; v < a.position.count; v++) for (let k = 0; k < 4; k++)
      if (skin.skeleton.bones[a.skinIndex.getComponent(v, k)].name === name && a.skinWeight.getComponent(v, k) > .95) tips.push(v);
    assert.ok(tips.length > 10, `${name} needs actual fingertip skin`);
    return { name, tips, bones: [1, 2, 3].map(j => rig.bones.get(`finger${i + 1}-${j}_${side}`)!) };
  }));
  const joints = ['L', 'R'].flatMap(side => [`elbow_${side}`, `wrist_${side}`]).map(name => rig.bones.get(name)!);
  joints.push(...digits.flatMap(digit => digit.bones));
  let previous: THREE.Quaternion[] | undefined, largestStep = 0, largestBend = 0;
  for (let frame = 0; frame <= 530; frame++) {
    const clock = frame / 100, motion = newMotion(), attention = redDressAttention(clock); attention.clock = clock;
    const input = { speed: 0, grounded: true, verticalVelocity: 0, turn: 0,
      training: { kind: 'red_dress' as const, role: 'citizen_2' as const, elapsed: clock, attention } };
    h.models.animate(rig, advanceMotion(motion, input, 0), motion, input, 0); rig.root.updateMatrixWorld(true);
    const rotations = joints.map(bone => bone.getWorldQuaternion(new THREE.Quaternion()));
    if (previous) for (const [i, rotation] of rotations.entries()) largestStep = Math.max(largestStep, rotation.angleTo(previous[i]));
    previous = rotations;
    if (frame % 10) continue;
    skin.skeleton.update();
    for (const digit of digits) {
      const points = digit.bones.map(bone => bone.getWorldPosition(new THREE.Vector3()));
      points.push(digit.tips.reduce((sum, v) => sum.add(skin.localToWorld(skin.getVertexPosition(v, new THREE.Vector3()))), new THREE.Vector3()).divideScalar(digit.tips.length));
      const directions = [0, 1, 2].map(i => points[i + 1].clone().sub(points[i]).normalize());
      for (const i of [0, 1]) {
        const angle = directions[i].angleTo(directions[i + 1]); largestBend = Math.max(largestBend, angle);
        assert.ok(angle < Math.PI / 2, `${digit.name} folds back at ${clock}s`);
      }
    }
  }
  assert.ok(largestStep < .15, `hand joints jump ${largestStep} radians in 10ms`);
  t.diagnostic(JSON.stringify({ sampledClocks: 531, largestStep, largestBend }));
});

test('the halter straps lie on the collar and neck instead of floating in front of them', async t => {
  const h = await actor('trinity'); t.after(() => h.models.dispose());
  const rig = (await h.models.create('trinity', undefined, 'citizen_2'))!;
  const material = new THREE.MeshBasicMaterial({ side: THREE.DoubleSide }); t.after(() => material.dispose());
  const body = rig.root.getObjectByName('Red_dress_anatomy') as THREE.SkinnedMesh;
  const surface = new THREE.Mesh(body.geometry, material), misses: string[] = [];
  for (const side of ['-1', '1']) {
    const strap = rig.root.getObjectByName(`Red_dress_halter_${side}`) as THREE.SkinnedMesh;
    for (let i = 0; i < strap.geometry.attributes.position.count; i++) {
      const point = new THREE.Vector3().fromBufferAttribute(strap.geometry.attributes.position, i);
      const radius = Math.hypot(point.x, point.z), direction = new THREE.Vector3(point.x, 0, point.z).normalize();
      const skin = new THREE.Raycaster(new THREE.Vector3(0, point.y, 0), direction, 0, 1).intersectObject(surface).at(-1);
      if (skin && (radius - skin.distance > .09 || radius - skin.distance < -.012)) misses.push(`${side}/${i}: gap=${radius - skin.distance}`);
    }
  }
  assert.deepEqual(misses, []);
});
