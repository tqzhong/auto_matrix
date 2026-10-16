import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { FILM_SETS, WETWALL, WETWALL_SHAFT, SIXTH_FIXTURES, wetwallPose, wetwallPath, bathroomFightRoot, newBathroomFight, type WetwallGesture, type BathroomGesture } from '@auto_matrix/shared';
import { AgentRenderer } from '../packages/client/src/agents/AgentRenderer.js';
import { CharacterModels } from '../packages/client/src/agents/CharacterModel.js';
import { poseAmbushCallPair } from '../packages/client/src/agents/AmbushCallPerformance.js';
import { WorldState } from '../packages/server/src/world/WorldState.js';
import { AgentManager } from '../packages/server/src/agents/AgentManager.js';
import { HeroModels } from '../packages/client/src/agents/HeroModel.js';
import { advanceMotion, newMotion, type MotionInput } from '../packages/client/src/agents/CharacterMotion.js';

async function asset(id = 'morpheus') {
  const raw = await readFile(new URL(`../packages/client/public/assets/characters/${id}.glb`, import.meta.url)), length = raw.readUInt32LE(12);
  const document = JSON.parse(raw.subarray(20, 20 + length).toString());
  for (const material of document.materials) { delete material.pbrMetallicRoughness.baseColorTexture; delete material.normalTexture; }
  document.images = []; document.textures = [];
  const json = Buffer.from(JSON.stringify(document)), padded = Buffer.alloc(Math.ceil(json.length / 4) * 4, 32); json.copy(padded);
  const bin = raw.subarray(20 + length), result = Buffer.alloc(20 + padded.length + bin.length);
  result.writeUInt32LE(0x46546c67); result.writeUInt32LE(2, 4); result.writeUInt32LE(result.length, 8);
  result.writeUInt32LE(padded.length, 12); result.writeUInt32LE(0x4e4f534a, 16); padded.copy(result, 20); bin.copy(result, 20 + padded.length);
  return new GLTFLoader().parseAsync(result.buffer.slice(result.byteOffset, result.byteOffset + result.byteLength), '');
}
async function model() {
  const source = await asset(), models = new HeroModels(new THREE.Texture(), new THREE.Texture());
  (models as unknown as { load: () => Promise<typeof source> }).load = async () => source;
  const rig = (await models.create('morpheus'))!, motion = newMotion();
  const pose = (wardrobe: 'coat' | 'shirt' | undefined, extra: Partial<MotionInput> = {}) => {
    const input: MotionInput & { ambushWardrobe?: 'coat' | 'shirt' } = { speed: 0, grounded: true, verticalVelocity: 0, turn: 0, ambushWardrobe: wardrobe, ...extra };
    models.animate(rig, advanceMotion(motion, input, 0), motion, input, 0); rig.root.updateMatrixWorld(true);
    rig.root.traverse(object => { if (object instanceof THREE.SkinnedMesh) { object.skeleton.update(); object.computeBoundingSphere(); } });
  };
  return { rig, models, pose };
}
function visibleMeshes(root: THREE.Object3D) {
  const meshes: THREE.Mesh[] = []; root.traverseVisible(object => { if (object instanceof THREE.Mesh) meshes.push(object); }); return meshes;
}

test('shirt-only old-building Morpheus has actual full cloth over waist and sleeves, rather than the crew-neck chest insert', async () => {
  const h = await model();
  try {
    h.pose('shirt');
    for (const [x, y] of [[.26, 2.55], [-.26, 2.55], [.3, 3.3], [-.3, 3.3]]) {
      const ray = new THREE.Raycaster(new THREE.Vector3(x, y, 2), new THREE.Vector3(0, 0, -1), 0, 4);
      const hit = ray.intersectObjects(visibleMeshes(h.rig.root), false)[0];
      assert.equal(hit?.object.name, 'morpheus-ambush-shirt', `shirt-only waist/chest must have shirt fabric at ${x},${y}; first surface ${hit?.object.name}`);
    }
    const source = h.rig.root.getObjectByName('morpheus-hammer-sweater') as THREE.SkinnedMesh;
    for (const side of ['L', 'R']) {
      const wrist = h.rig.bones.get(`wrist_${side}`)!, elbow = h.rig.bones.get(`elbow_${side}`)!;
      const origin = wrist.getWorldPosition(new THREE.Vector3()).lerp(elbow.getWorldPosition(new THREE.Vector3()), .2);
      const hits = new THREE.Raycaster(origin.clone().add(new THREE.Vector3(0, 0, 1)), new THREE.Vector3(0, 0, -1), 0, 2).intersectObjects(visibleMeshes(h.rig.root), false);
      assert.equal(hits[0]?.object.name, 'morpheus-ambush-shirt', `${side} forearm must have a full sleeve at the actual delivered bone`);
      assert.ok(source.skeleton.bones.includes(wrist));
    }
  } finally { h.models.dispose(); }
});

test('the old-building coat has an open front showing a real skinned green tie and folded collar', async () => {
  const h = await model();
  try {
    h.pose('coat');
    for (const y of [3.2, 3.55, 3.76]) {
      const hit = new THREE.Raycaster(new THREE.Vector3(0, y, 2), new THREE.Vector3(0, 0, -1), 0, 4).intersectObjects(visibleMeshes(h.rig.root), false)[0];
      assert.equal(hit?.object.name, 'morpheus-ambush-tie', `the movie's tie must actually be exposed through the coat at ${y}, not covered by ${hit?.object.name}`);
      const material = (hit!.object as THREE.Mesh).material as THREE.MeshStandardMaterial;
      assert.ok(material.color.g > material.color.r && material.color.r > material.color.b);
      assert.ok(hit!.object instanceof THREE.SkinnedMesh, 'the tie follows torso bend rather than being a rigid chest badge');
    }
  } finally { h.models.dispose(); }
});

async function characters(t: test.TestContext) {
  const assets = new Map(await Promise.all(['morpheus', 'trinity', 'trinity-club'].map(async id => [id, await asset(id)] as const)));
  t.mock.method(GLTFLoader.prototype, 'loadAsync', async (url: string) => assets.get(url.split('/').at(-1)!.replace('.glb', ''))!);
  t.mock.method(THREE.TextureLoader.prototype, 'load', () => new THREE.Texture());
  const original = globalThis.document;
  globalThis.document = { createElement: () => ({ getContext: () => ({ createRadialGradient: () => ({ addColorStop() {} }), fillRect() {}, strokeRect() {}, fillText() {},
    createImageData: (w: number, h: number) => ({ data: new Uint8ClampedArray(w * h * 4) }), putImageData() {} }) }) } as unknown as Document;
  const world = new WorldState(); new AgentManager(world).initializeAllAgents(); const models = new CharacterModels();
  const morpheus = models.create(world.agents.get('morpheus')!), trinity = models.create(world.agents.get('trinity')!);
  await new Promise(resolve => setImmediate(resolve)); assert.ok(morpheus.hero && trinity.hero);
  t.after(() => { models.dispose(); globalThis.document = original; });
  const update = () => { for (const rig of [morpheus, trinity]) { rig.root.updateMatrixWorld(true); rig.root.traverse(object => {
    if (object instanceof THREE.SkinnedMesh) { object.skeleton.update(); object.computeBoundingSphere(); }
  }); } };
  const call = (elapsed: number) => {
    morpheus.root.position.set(-5.4, 0, -16); morpheus.root.rotation.y = Math.PI / 2;
    trinity.root.position.set(-2.85, 0, -16); trinity.root.rotation.y = -Math.PI / 2;
    for (const [role, rig] of [['morpheus', morpheus], ['trinity', trinity]] as const) models.animate(rig, 0,
      { speed: 0, grounded: true, verticalVelocity: 0, turn: 0, ambushWardrobe: role === 'morpheus' ? 'shirt' : undefined, ambushCall: { role, elapsed } }, 4);
    poseAmbushCallPair(morpheus, trinity, { role: 'morpheus', elapsed }); update();
  };
  return { models, morpheus, trinity, world, update, call };
}
function clothVertices(root: THREE.Object3D) {
  return visibleMeshes(root).filter(mesh => mesh.name.startsWith('morpheus-ambush-')).flatMap(mesh =>
    Array.from({ length: mesh.geometry.attributes.position.count }, (_, i) => ({ mesh, index: i, point: mesh.getVertexPosition(i, new THREE.Vector3()).applyMatrix4(mesh.matrixWorld) })));
}

test('the delivered shirt collar and tie stay outside their actual torso through the phone and folded bathroom poses', async t => {
  const h = await characters(t), rig = h.morpheus.hero!;
  const shirt = rig.root.getObjectByName('morpheus-ambush-shirt') as THREE.SkinnedMesh;
  const tie = rig.root.getObjectByName('morpheus-ambush-tie') as THREE.SkinnedMesh;
  const collar = rig.root.getObjectByName('morpheus-ambush-collar') as THREE.SkinnedMesh;
  const bindPosition = shirt.geometry.attributes.position.clone();
  const bindNormal = shirt.geometry.attributes.normal.clone();
  const tieSamples = [3.73, 3.4275, 3.125, 2.8225, 2.52].map(y => {
    const position = tie.geometry.attributes.position; let nearest = Infinity, selected = -1;
    for (let i = 0; i < position.count; i++) {
      const distance = position.getX(i) ** 2 + (position.getY(i) - y) ** 2;
      if (distance < nearest) { nearest = distance; selected = i; }
    }
    assert.ok(nearest < .002, `the actual tie must cover its original centreline at ${y}`); return selected;
  });
  tieSamples.push(tie.geometry.attributes.position.count - 1);
  const check = (label: string) => {
    for (const [mesh, indices] of [[tie, tieSamples], [collar, [22, 49, 103, 130]]] as const) for (const index of indices) {
      const p = mesh.getVertexPosition(index, new THREE.Vector3()).applyMatrix4(mesh.matrixWorld);
      const triangle = new THREE.Triangle(), nearest = new THREE.Vector3(), faces = shirt.geometry.index!;
      let distance = Infinity, signed = -Infinity;
      // Compare the corresponding cloth layer. The lower shirt can face
      // opposite the bent chest, making a chest-forward ray hit foreground cloth.
      for (let face = 0; face < faces.count; face += 3) {
        const ids = [0, 1, 2].map(n => faces.getX(face + n));
        if (!ids.every(i => Math.abs(bindPosition.getX(i)) < .45 && bindPosition.getZ(i) > .05 && Math.abs(bindPosition.getY(i) - mesh.geometry.attributes.position.getY(index)) < .18)) continue;
        const points = ids.map(i => shirt.getVertexPosition(i, new THREE.Vector3()).applyMatrix4(shirt.matrixWorld));
        triangle.set(points[0], points[1], points[2]); triangle.closestPointToPoint(p, nearest);
        const current = p.distanceTo(nearest);
        if (current < distance) {
          distance = current;
          const normal = triangle.getNormal(new THREE.Vector3()), rest = ids.map(i => new THREE.Vector3().fromBufferAttribute(bindPosition, i));
          const outward = ids.reduce((sum, i) => sum.add(new THREE.Vector3().fromBufferAttribute(bindNormal, i)), new THREE.Vector3());
          if (new THREE.Triangle(rest[0], rest[1], rest[2]).getNormal(new THREE.Vector3()).dot(outward) < 0) normal.negate();
          signed = p.clone().sub(nearest).dot(normal);
        }
      }
      assert.ok(signed >= -.002 && distance < .11, `${label}/${mesh.name}/${index}: cloth either enters shirt or floats, distance=${distance}, signed=${signed}`);
    }
  };
  for (const elapsed of [0, .6, 1.1, 1.55, 2.2, 7, 7.8, 8.49]) { h.call(elapsed); check(`call ${elapsed}`); }
  for (const [phase, elapsed] of [['ready', 0], ['breakout', 1.6], ['counter', .325], ['capturing', 2.5]] as const) {
    const gesture = { ...newBathroomFight(), role: 'morpheus' as const, phase, elapsed }, pose = bathroomFightRoot(gesture, 'morpheus'), center = FILM_SETS.film_ambush_house.center;
    h.morpheus.root.position.set(center.x + pose.x, center.y - 1 + WETWALL_SHAFT.sixth, center.z + pose.z); h.morpheus.root.rotation.y = pose.yaw;
    h.models.animate(h.morpheus, 0, { speed: 0, grounded: true, verticalVelocity: 0, turn: 0, ambushWardrobe: 'shirt',
      bathroom: gesture }, 4); h.update(); check(`bathroom ${phase}`);
  }
});

test('full sleeves follow the actual phone wrists without entering the handset casing', async t => {
  const h = await characters(t);
  for (const time of [1.1, 1.3, 1.55, 1.8, 2.2, ...Array.from({ length: 31 }, (_, i) => 7 + i * .05)]) {
    h.call(time); const phone = h.morpheus.phone!.root;
    let deepest = -Infinity, detail = '';
    for (const { point, mesh, index } of clothVertices(h.morpheus.root)) {
      phone.worldToLocal(point); const curve = point.y * point.y * .23;
      const depth = Math.min(.061 - Math.abs(point.x), .18 - Math.abs(point.y), point.z - curve + .034, .026 + curve - point.z);
      if (depth > deepest) { deepest = depth; detail = `${mesh.name} vertex=${index} point=${point.toArray()} bind=${new THREE.Vector3().fromBufferAttribute(mesh.geometry.attributes.position, index).toArray()}`; }
    }
    assert.ok(deepest <= .005, `${time}: new fabric enters the curved physical phone casing by ${deepest}: ${detail}`);
  }
});

test('new full shirt stays clear of the actual pipe shaft and bathroom floor and intact fixtures', async t => {
  const h = await characters(t), center = FILM_SETS.film_ambush_house.center;
  for (const depth of [0, .08, .32, .56, .81, 1.05, 4, 9.4, 14.8]) {
    const start = { x: WETWALL.lanes.morpheus, y: WETWALL_SHAFT.top, z: -26 }, path = wetwallPath(start, 'morpheus');
    const entry = path.slice(1).reduce((sum, p, i) => sum + Math.hypot(p.x - path[i].x, p.y - path[i].y, p.z - path[i].z), 0);
    const gesture: WetwallGesture = { role: 'morpheus', phase: 'climbing', elapsed: 0, progress: entry + depth, entry, hanging: true, freed: true, start };
    const pose = wetwallPose(gesture.start, gesture.role, gesture.progress, gesture.phase, 0);
    h.morpheus.root.position.set(center.x + pose.x, center.y - 1 + pose.y, center.z + pose.z); h.morpheus.root.rotation.y = pose.yaw;
    h.models.animate(h.morpheus, 0, { speed: 0, grounded: true, verticalVelocity: 0, turn: 0, wetwall: gesture, ambushWardrobe: 'shirt' }, 4); h.update();
    for (const { mesh, point } of clothVertices(h.morpheus.root)) {
      const x = point.x - center.x, z = point.z - center.z;
      const wallGap = Math.min(x - WETWALL_SHAFT.left - .2, WETWALL_SHAFT.right - .2 - x, z - WETWALL_SHAFT.back - .25, WETWALL_SHAFT.front - .12 - z);
      const pipeGap = Math.min(...[-20.5, -18, -15.5].map(pipe => Math.hypot(x - pipe, z - WETWALL_SHAFT.pipeZ) - .2));
      assert.ok(wallGap >= -.025 && pipeGap >= -.025, `depth ${depth}/${mesh.name}: shaft=${wallGap}, pipe=${pipeGap}, point=${point.toArray()}`);
    }
  }
  for (const [phase, elapsed] of [['ready', 0], ['pinning', 2], ['breakout', .8], ['breakout', 1.6], ['breakout', 2.2], ['faceoff', 1], ['windup', .65], ['opening', .1], ['counter', .325], ['capturing', 1], ['capturing', 1.7], ['capturing', 2.5], ['done', 0]] as [BathroomGesture['phase'], number][]) {
    const gesture = { ...newBathroomFight(), phase, elapsed, role: 'morpheus' as const, evaded: true }, pose = bathroomFightRoot(gesture, 'morpheus');
    h.morpheus.root.position.set(center.x + pose.x, center.y - 1 + WETWALL_SHAFT.sixth, center.z + pose.z); h.morpheus.root.rotation.y = pose.yaw;
    h.models.animate(h.morpheus, 0, { speed: 0, grounded: true, verticalVelocity: 0, turn: 0, bathroom: gesture, ambushWardrobe: 'shirt' }, 4); h.update();
    for (const { mesh, point } of clothVertices(h.morpheus.root)) {
      const x = point.x - center.x, y = point.y - center.y + 1 - WETWALL_SHAFT.sixth, z = point.z - center.z;
      assert.ok(y >= -.025, `${phase}/${mesh.name}: new cloth below floor ${y}`);
      for (const [name, fixture] of Object.entries(SIXTH_FIXTURES)) assert.ok(!(y > .025 && y < fixture.height - .025 && Math.abs(x - fixture.x) < fixture.width / 2 - .025 && Math.abs(z - fixture.z) < fixture.depth / 2 - .025), `${phase}/${mesh.name}: cloth in ${name}`);
    }
  }
});

test('the leather layer covers the real shirt sleeves and waist without covering the open front tie', async () => {
  const h = await model();
  try {
    h.pose('coat');
    for (const x of [-.7, -.6, -.4, -.3, .3, .4, .6, .7]) for (const y of [2.5, 2.7, 3, 3.2, 3.4, 3.6]) {
      const hits = new THREE.Raycaster(new THREE.Vector3(x, y, 2), new THREE.Vector3(0, 0, -1), 0, 4).intersectObjects(visibleMeshes(h.rig.root), false);
      if (!hits.some(hit => hit.object.name === 'morpheus-ambush-shirt')) continue;
      assert.ok(['morpheus-ambush-coat', 'morpheus-ambush-lapels'].includes(hits[0].object.name), `${x}/${y}: inner shirt breaks through the actual outer layer, first=${hits[0].object.name}`);
    }
  } finally { h.models.dispose(); }
});

test('both actual forearm cuff sections remain covered while the hands exchange and hold the phone', async t => {
  const h = await characters(t), shirt = h.morpheus.hero!.root.getObjectByName('morpheus-ambush-shirt') as THREE.SkinnedMesh;
  for (const elapsed of [0, .6, 1.1, 1.55, 2.2, 7, 7.8, 8.49]) {
    h.call(elapsed);
    for (const side of ['L', 'R']) {
      const wrist = h.morpheus.hero!.bones.get(`wrist_${side}`)!.getWorldPosition(new THREE.Vector3());
      const axis = h.morpheus.hero!.bones.get(`elbow_${side}`)!.getWorldPosition(new THREE.Vector3()).sub(wrist).normalize();
      const u = new THREE.Vector3(0, 0, 1).cross(axis).normalize(), v = axis.clone().cross(u), center = wrist.addScaledVector(axis, .12);
      for (let sample = 0; sample < 8; sample++) {
        const direction = u.clone().multiplyScalar(Math.cos(sample * Math.PI / 4)).addScaledVector(v, Math.sin(sample * Math.PI / 4));
        const hit = new THREE.Raycaster(center.clone().addScaledVector(direction, .3), direction.negate(), 0, .3).intersectObject(shirt).find(hit => { const inverse = shirt.skeleton.boneInverses[shirt.skeleton.bones.indexOf(h.morpheus.hero!.bones.get(`wrist_${side}`)!)];
          return [hit.face!.a, hit.face!.b, hit.face!.c].every(i => new THREE.Vector3().fromBufferAttribute(shirt.geometry.attributes.position, i).applyMatrix4(shirt.bindMatrix).applyMatrix4(inverse).length() < .4); });
        assert.ok(hit && hit.distance > .08 && hit.distance < .27, `${elapsed}/${side}/${sample}: actual cuff section is open or detached, hit=${hit?.distance}`);
      }
    }
  }
});

test('appearance materials remain stable when paused, restore on exit, and release only their owned GPU resources', async () => {
  const h = await model();
  const own = h.rig.root.children.filter(object => object.name.startsWith('morpheus-ambush-')) as THREE.SkinnedMesh[];
  const geometry = [...new Set(own.map(mesh => mesh.geometry))], materials = [...new Set(own.map(mesh => mesh.material as THREE.MeshStandardMaterial))];
  const shirt = h.rig.root.getObjectByName('morpheus-ambush-shirt') as THREE.Mesh<THREE.BufferGeometry, THREE.MeshStandardMaterial>;
  const fabric = shirt.material.bumpMap!, leather = materials.find(material => material.bumpMap?.name === 'morpheus-ambush-leather-grain')!.bumpMap!;
  const donor = h.rig.root.getObjectByName('morpheus-hammer-sweater') as THREE.Mesh;
  assert.notEqual(shirt.geometry, donor.geometry, 'new shirt tailoring must not mutate the real-world knit');
  const tails = h.rig.wardrobe.filter(part => part.outer), originals = tails.map(part => ({ map: part.map, bump: part.bumpMap, roughness: part.roughness, color: part.color.clone() }));
  h.pose('coat'); const versions = materials.map(material => material.version), tailVersions = tails.map(part => part.mesh.material.version);
  for (let i = 0; i < 20; i++) h.pose('coat');
  assert.deepEqual(materials.map(material => material.version), versions); assert.deepEqual(tails.map(part => part.mesh.material.version), tailVersions);
  h.pose(undefined);
  tails.forEach((part, i) => { const material = part.mesh.material as THREE.MeshStandardMaterial;
    assert.equal(material.map, originals[i].map); assert.equal(material.bumpMap, originals[i].bump); assert.equal(material.roughness, originals[i].roughness); assert.ok(material.color.equals(originals[i].color));
  });
  const disposed = new Map<object, number>();
  for (const resource of [...geometry, ...materials, leather, fabric]) resource.addEventListener('dispose', () => disposed.set(resource, (disposed.get(resource) ?? 0) + 1));
  h.models.dispose(); h.models.dispose();
  for (const resource of [...geometry, ...materials, leather]) assert.equal(disposed.get(resource), 1, 'each owned resource is released once, including the procedural leather texture');
  assert.equal(disposed.get(fabric), undefined, 'the shared fabric texture belongs to the renderer');
});

test('the actual trouser waist stays under the complete shirt around its sides and back', async t => {
  const h = await characters(t), shirt = h.morpheus.hero!.root.getObjectByName('morpheus-ambush-shirt') as THREE.SkinnedMesh;
  const trousers = h.morpheus.hero!.root.getObjectByName('Tailored_trousers') as THREE.SkinnedMesh;
  for (const time of [0, 1.55, 2.2, 4, 7.6]) {
    h.call(time); const rotation = h.morpheus.root.getWorldQuaternion(new THREE.Quaternion());
    let compared = 0; const directions = new Set<number>();
    for (const y of [2.45, 2.5, 2.55, 2.6, 2.65, 2.7]) for (let sample = 0; sample < 32; sample++) {
      const direction = new THREE.Vector3(Math.sin(sample * Math.PI / 16), 0, Math.cos(sample * Math.PI / 16)).applyQuaternion(rotation);
      const center = h.morpheus.root.localToWorld(new THREE.Vector3(0, y, 0)), ray = new THREE.Raycaster(center.addScaledVector(direction, 1.5), direction.negate(), 0, 1.5);
      const cloth = ray.intersectObject(shirt)[0], pants = ray.intersectObject(trousers)[0];
      if (!pants) continue;
      assert.ok(cloth, `${time}/y${y}/angle${sample}: actual pants triangle ${pants.faceIndex} is exposed through a missing shirt surface`);
      compared++; directions.add(sample);
      assert.ok(cloth.distance + .003 <= pants.distance, `${time}/y${y}/angle${sample}: actual pants triangle ${pants.faceIndex} is in front of shirt by ${cloth.distance - pants.distance}`);
    }
    assert.equal(directions.size, 32, `${time}: trouser/shirt comparisons must cover the complete circumference across the six waist heights`);
    t.diagnostic(`waist ${time}s: ${compared}/192 rays compare actual trouser and shirt triangles; ${directions.size}/32 circumferential directions covered`);
  }
});

test('the fitted shirt hem follows the actual trouser waist through bent bathroom and pipe poses', async t => {
  const h = await characters(t), hero = h.morpheus.hero!;
  const shirt = hero.root.getObjectByName('morpheus-ambush-shirt') as THREE.SkinnedMesh;
  const trousers = hero.root.getObjectByName('Tailored_trousers') as THREE.SkinnedMesh;
  const bindPosition = shirt.geometry.attributes.position.clone();
  const pelvis = hero.bones.get('pelvis')!, inverse = shirt.skeleton.boneInverses[shirt.skeleton.bones.indexOf(pelvis)];
  const intersections: string[] = [];
  const check = (label: string) => {
    for (const mesh of [shirt, trousers]) for (let i = 0; i < mesh.geometry.attributes.position.count; i++) {
      const point = mesh.getVertexPosition(i, new THREE.Vector3());
      assert.ok(mesh.boundingBox!.containsPoint(point) && mesh.boundingSphere!.containsPoint(point), `${label}/${mesh.name}/${i}: posed cloth escapes the production cached skinned culling box`);
    }
    if (label.startsWith('bathroom breakout')) {
      const triangle = (mesh: THREE.SkinnedMesh, face: number) => [0, 1, 2].map(n => mesh.getVertexPosition(mesh.geometry.index!.getX(face * 3 + n), new THREE.Vector3()).applyMatrix4(mesh.matrixWorld));
      for (const [cloth, pants] of [[10150, 877], [10150, 878], [20808, 877], [21031, 2125], [21031, 2126], [21971, 106], [10147, 752], [10147, 753], [10147, 758], [10147, 759], [20932, 796], [20932, 803], [9903, 1732], [20070, 2215], [21609, 975]]) {
        const first = triangle(shirt, cloth), second = triangle(trousers, pants), ray = new THREE.Ray(), hit = new THREE.Vector3();
        let crossing = false;
        for (const [p, q] of [[first, second], [second, first]]) for (let i = 0; i < 3; i++) {
          const start = p[i], end = p[(i + 1) % 3], length = start.distanceTo(end); ray.set(start, end.clone().sub(start).normalize());
          if (ray.intersectTriangle(q[0], q[1], q[2], false, hit) && start.distanceTo(hit) > 1e-5 && start.distanceTo(hit) < length - 1e-5) crossing = true;
        }
        if (crossing) intersections.push(`${label}: actual shirt triangle ${cloth} crosses trousers ${pants}, despite any centre-point clearance`);
      }
      // A complete small cloth triangle can lie under a folded trouser face
      // without any edge crossing. Check the independently reproduced patch.
      const buried = triangle(shirt, 20932);
      for (const [vertex, face] of [[0, 796], [1, 803], [2, 796]]) {
        const points = triangle(trousers, face), surface = new THREE.Triangle(points[0], points[1], points[2]);
        const nearest = surface.closestPointToPoint(buried[vertex], new THREE.Vector3()), normal = surface.getNormal(new THREE.Vector3());
        const signed = buried[vertex].clone().sub(nearest).dot(normal), distance = buried[vertex].distanceTo(nearest);
        if (Math.abs(Math.abs(signed) - distance) < 1e-6 && signed < -1e-5) intersections.push(`${label}: shirt 20932 vertex ${vertex} is buried under actual trouser face ${face} by ${-signed}`);
      }
    }
    let compared = 0, liftedHem = 0; const directions = new Set<number>(), surfaceDirections = new Set<number>();
    const pantsGeometry = new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute(
      Array.from({ length: trousers.geometry.attributes.position.count }, (_, i) => trousers.getVertexPosition(i, new THREE.Vector3()).applyMatrix4(trousers.matrixWorld).toArray()).flat(), 3));
    pantsGeometry.setIndex(trousers.geometry.index!.clone());
    const posedPants = new THREE.Mesh(pantsGeometry, new THREE.MeshBasicMaterial({ side: THREE.DoubleSide }));
    const insideTrousers = (point: THREE.Vector3): number => {
      let inside = 0;
      for (const vector of [[1, .13, .31], [-.27, .11, 1], [.43, -.17, -1]]) {
        const direction = new THREE.Vector3(...vector).normalize(), hits = new THREE.Raycaster(point, direction, 0, 8).intersectObject(posedPants);
        const distinct = hits.filter((hit, n) => n === 0 || Math.abs(hit.distance - hits[n - 1].distance) > 1e-6);
        if (distinct.length % 2 === 1 && distinct[0].face!.normal.dot(direction) > 0 && distinct[0].distance > .003) inside++;
      }
      if (inside >= 2) {
        // Ray exit length is not penetration depth: a grazing ray can travel
        // far while the cloth is less than a millimetre from the real surface.
        const triangle = new THREE.Triangle(), nearest = new THREE.Vector3(), position = pantsGeometry.attributes.position, index = pantsGeometry.index!;
        let depth = Infinity;
        for (let i = 0; i < index.count; i += 3) {
          triangle.a.fromBufferAttribute(position, index.getX(i)); triangle.b.fromBufferAttribute(position, index.getX(i + 1)); triangle.c.fromBufferAttribute(position, index.getX(i + 2));
          triangle.closestPointToPoint(point, nearest); depth = Math.min(depth, point.distanceTo(nearest));
        }
        if (depth <= .003) return 0;
      }
      return inside;
    };
    for (const y of [2.45, 2.5, 2.55, 2.6, 2.65, 2.7]) for (let angle = 0; angle < 64; angle++) {
      const direction = new THREE.Vector3(Math.sin(angle * Math.PI / 32), 0, Math.cos(angle * Math.PI / 32)).transformDirection(pelvis.matrixWorld);
      const center = new THREE.Vector3(0, y, 0).applyMatrix4(shirt.bindMatrix).applyMatrix4(inverse).applyMatrix4(pelvis.matrixWorld);
      const ray = new THREE.Raycaster(center.addScaledVector(direction, 1.5), direction.negate(), 0, 1.5);
      const pants = ray.intersectObject(posedPants)[0]; if (!pants) continue;
      const cloth = ray.intersectObject(shirt).find(hit => [hit.face!.a, hit.face!.b, hit.face!.c].every(i => bindPosition.getY(i) < 2.9));
      if (!cloth) { liftedHem++; continue; }
      if (cloth.distance + .003 > pants.distance && insideTrousers(cloth.point) >= 2) intersections.push(`${label}/y${y}/angle${angle}: bent pants triangle ${pants.faceIndex} protrudes through shirt triangle ${cloth.faceIndex} by ${cloth.distance - pants.distance}`);
      compared++; directions.add(angle);
    }
    // In a deep bend the shirt hem can rise above a pelvis-fixed ray. Verify
    // the actual deformed cloth too, rather than requiring trousers below it
    // to be covered or accepting an empty sample as clearance.
    const index = shirt.geometry.index!, position = bindPosition;
    let surfaceCompared = 0;
    for (let i = 0; i < index.count; i += 3) {
      const ids = [index.getX(i), index.getX(i + 1), index.getX(i + 2)];
      if (!ids.every(id => position.getY(id) >= 2.38 && position.getY(id) < 2.7 && Math.abs(position.getX(id)) < .7)) continue;
      if (!ids.every(id => [0, 1, 2, 3].reduce((sum, n) => sum + (/^(pelvis|spine|chest|hip_[LR])$/.test(shirt.skeleton.bones[shirt.geometry.attributes.skinIndex.getComponent(id, n)].name) ? shirt.geometry.attributes.skinWeight.getComponent(id, n) : 0), 0) > .8)) continue;
      const point = ids.reduce((sum, id) => sum.add(shirt.getVertexPosition(id, new THREE.Vector3()).applyMatrix4(shirt.matrixWorld)), new THREE.Vector3()).multiplyScalar(1 / 3);
      const axis = ids.reduce((sum, id) => sum.add(shirt.applyBoneTransform(id, new THREE.Vector3(0, position.getY(id), 0)).applyMatrix4(shirt.matrixWorld)), new THREE.Vector3()).multiplyScalar(1 / 3);
      const radial = point.clone().sub(axis).normalize(), local = pelvis.worldToLocal(point.clone()), angle = (Math.round(Math.atan2(local.x, local.z) * 32 / Math.PI) + 64) % 64;
      const ray = new THREE.Raycaster(point.clone().addScaledVector(radial, .5), radial.negate(), 0, .65), pants = ray.intersectObject(posedPants)[0];
      if (!pants) continue;
      if (pants.distance < .503) {
        // A folded leg may legitimately occlude the hem along this ray.
        // Confirm that the cloth point is inside, rather than behind trousers.
        const inside = insideTrousers(point);
        if (inside >= 2) intersections.push(`${label}: actual hem triangle ${i / 3} is inside trousers in ${inside}/3 independent directions`);
      }
      surfaceCompared++; surfaceDirections.add(angle);
    }
    pantsGeometry.dispose(); posedPants.material.dispose();
    assert.ok(surfaceCompared > 100, `${label}: actual deformed cloth surface must provide meaningful trouser comparisons`);
    assert.equal(new Set([...directions, ...surfaceDirections]).size, 64, `${label}: actual waist comparisons cover the whole circumference`);
    t.diagnostic(`${label}: ${compared}/384 plane comparisons across ${directions.size}/64 directions; ${liftedHem} below lifted hem; ${surfaceCompared} actual cloth-triangle comparisons across ${surfaceDirections.size}/64 directions`);
  };
  for (const [phase, elapsed] of [['ready', 0], ['counter', .325], ['capturing', 2.5], ['breakout', 1.6]] as const) {
    const gesture = { ...newBathroomFight(), role: 'morpheus' as const, phase, elapsed, evaded: true }, pose = bathroomFightRoot(gesture, 'morpheus'), center = FILM_SETS.film_ambush_house.center;
    h.morpheus.root.position.set(center.x + pose.x, center.y - 1 + WETWALL_SHAFT.sixth, center.z + pose.z); h.morpheus.root.rotation.y = pose.yaw;
    h.models.animate(h.morpheus, 0, { speed: 0, grounded: true, verticalVelocity: 0, turn: 0, ambushWardrobe: 'shirt',
      bathroom: gesture }, 4); h.morpheus.root.updateMatrixWorld(true); check(`bathroom ${phase}/${elapsed}`);
  }
  for (const depth of [.32, 1.05, 4, 9.4, 14.8]) {
    const start = { x: WETWALL.lanes.morpheus, y: WETWALL_SHAFT.top, z: -26 }, path = wetwallPath(start, 'morpheus');
    const entry = path.slice(1).reduce((sum, p, i) => sum + Math.hypot(p.x - path[i].x, p.y - path[i].y, p.z - path[i].z), 0);
    const pose = wetwallPose(start, 'morpheus', entry + depth, 'climbing', 0), center = FILM_SETS.film_ambush_house.center;
    h.morpheus.root.position.set(center.x + pose.x, center.y - 1 + pose.y, center.z + pose.z); h.morpheus.root.rotation.y = pose.yaw;
    h.models.animate(h.morpheus, 0, { speed: 0, grounded: true, verticalVelocity: 0, turn: 0, ambushWardrobe: 'shirt',
      wetwall: { role: 'morpheus', phase: 'climbing', elapsed: 0, progress: entry + depth, entry, hanging: true, freed: true, start } }, 4); h.morpheus.root.updateMatrixWorld(true); check(`wetwall ${depth}`);
  }
  assert.deepEqual(intersections, [], 'bent shirt hem must retain clearance over the actual trousers');
});


test('the old-building trouser rear seam remains a continuous surface in the actual crouched poses', async t => {
  const h = await characters(t), trousers = h.morpheus.hero!.root.getObjectByName('Tailored_trousers') as THREE.SkinnedMesh;
  for (const [phase, elapsed] of [['counter', .325], ['breakout', 1.6]] as const) {
    const gesture = { ...newBathroomFight(), role: 'morpheus' as const, phase, elapsed, evaded: true }, pose = bathroomFightRoot(gesture, 'morpheus'), center = FILM_SETS.film_ambush_house.center;
    h.morpheus.root.position.set(center.x + pose.x, center.y - 1 + WETWALL_SHAFT.sixth, center.z + pose.z); h.morpheus.root.rotation.y = pose.yaw;
    h.models.animate(h.morpheus, 0, { speed: 0, grounded: true, verticalVelocity: 0, turn: 0, ambushWardrobe: 'shirt', bathroom: gesture }, 4); h.update();
    if (phase === 'breakout') {
      for (const [a, b] of [[2213, 877], [2213, 878], [2219, 877], [2219, 878], [2213, 758]]) {
        const triangle = (face: number) => [0, 1, 2].map(n => trousers.getVertexPosition(trousers.geometry.index!.getX(face * 3 + n), new THREE.Vector3()));
        const first = triangle(a), second = triangle(b), ray = new THREE.Ray(), hit = new THREE.Vector3();
        let crossing = false;
        for (const [p, q] of [[first, second], [second, first]]) for (let i = 0; i < 3; i++) {
          const start = p[i], end = p[(i + 1) % 3], length = start.distanceTo(end); ray.set(start, end.clone().sub(start).normalize());
          if (ray.intersectTriangle(q[0], q[1], q[2], false, hit) && start.distanceTo(hit) > 1e-5 && start.distanceTo(hit) < length - 1e-5) crossing = true;
        }
        assert.equal(crossing, false, `actual trousers faces ${a}/${b} intersect in breakout, so a shirt cannot follow that waist as a smooth outer layer`);
      }
    }
    for (const [a, b] of [[119, 126], [119, 127], [174, 177]]) {
      const bind = new THREE.Vector3().fromBufferAttribute(trousers.geometry.attributes.position, a).distanceTo(new THREE.Vector3().fromBufferAttribute(trousers.geometry.attributes.position, b));
      const posed = trousers.getVertexPosition(a, new THREE.Vector3()).distanceTo(trousers.getVertexPosition(b, new THREE.Vector3()));
      t.diagnostic(`${phase}: rear waist edge ${a}-${b} posed/bind ratio ${posed / bind}`);
      assert.ok(posed < bind * 3, `${phase}: rear waist edge ${a}-${b} stretches from ${bind} to ${posed}, forming a narrow flange`);
    }
  }
});


test('static shirt skinning restores the same saved surface and releases only its own trouser geometry', async t => {
  const h = await characters(t), hero = h.morpheus.hero!, appearance = (h.models as any).heroes.ambushWardrobes.get(hero);
  const shirt = hero.root.getObjectByName('morpheus-ambush-shirt') as THREE.SkinnedMesh, trousers = hero.root.getObjectByName('Tailored_trousers') as THREE.SkinnedMesh;
  const rest = Array.from(shirt.geometry.attributes.position.array), normals = Array.from(shirt.geometry.attributes.normal.array), original = trousers.geometry;
  const originalWeights = Array.from(original.attributes.skinWeight.array), originalPositions = Array.from(original.attributes.position.array);
  const gesture = { ...newBathroomFight(), role: 'morpheus' as const, phase: 'breakout' as const, elapsed: 1.6, evaded: true }, pose = bathroomFightRoot(gesture, 'morpheus'), center = FILM_SETS.film_ambush_house.center;
  const input: MotionInput = { speed: 0, grounded: true, verticalVelocity: 0, turn: 0, ambushWardrobe: 'shirt', bathroom: gesture };
  h.morpheus.root.position.set(center.x + pose.x, center.y - 1 + WETWALL_SHAFT.sixth, center.z + pose.z); h.morpheus.root.rotation.y = pose.yaw;
  h.models.animate(h.morpheus, 0, input, 4); h.morpheus.root.updateMatrixWorld(true);
  const posed = (mesh: THREE.SkinnedMesh) => Array.from({ length: mesh.geometry.attributes.position.count }, (_, i) => mesh.getVertexPosition(i, new THREE.Vector3()).toArray().map(value => Math.round(value * 1e6)));
  const fitted = trousers.geometry, first = Array.from(shirt.geometry.attributes.position.array), version = shirt.geometry.attributes.position.version, firstPose = posed(shirt);
  assert.notEqual(fitted, original);
  for (let i = 0; i < 10; i++) h.models.animate(h.morpheus, .016, input, 4);
  h.morpheus.root.updateMatrixWorld(true);
  assert.deepEqual(posed(shirt), firstPose, 'nonzero display frames preserve the saved actual cloth surface');
  assert.deepEqual(Array.from(shirt.geometry.attributes.position.array), first, 'skeletal animation must not modify the bind cloth');
  assert.equal(shirt.geometry.attributes.position.version, version, 'skeletal animation does not upload a rewritten cloth position buffer');
  const cold = h.models.create(h.world.agents.get('morpheus')!); await new Promise(resolve => setImmediate(resolve)); assert.ok(cold.hero);
  cold.root.position.copy(h.morpheus.root.position); cold.root.rotation.copy(h.morpheus.root.rotation);
  h.models.animate(cold, 0, input, 4); cold.root.updateMatrixWorld(true);
  const coldShirt = cold.hero.root.getObjectByName('morpheus-ambush-shirt') as THREE.SkinnedMesh;
  assert.deepEqual(posed(coldShirt), firstPose, 'a fresh delivered model recreates the same actual saved cloth surface');
  assert.deepEqual(Array.from(coldShirt.geometry.attributes.position.array), first);
  h.models.animate(h.morpheus, 0, { speed: 0, grounded: true, verticalVelocity: 0, turn: 0, ambushWardrobe: 'coat' }, 4);
  assert.deepEqual(Array.from(shirt.geometry.attributes.position.array), rest);
  assert.deepEqual(Array.from(shirt.geometry.attributes.normal.array), normals);
  h.models.animate(h.morpheus, 0, { speed: 0, grounded: true, verticalVelocity: 0, turn: 0 }, 4);
  assert.equal(trousers.geometry, original);
  assert.deepEqual(Array.from(original.attributes.position.array), originalPositions);
  assert.deepEqual(Array.from(original.attributes.skinWeight.array), originalWeights);
  let released = 0, borrowed = 0; fitted.addEventListener('dispose', () => released++); original.addEventListener('dispose', () => borrowed++);
  (h.models as any).heroes.ambushWardrobes.delete(hero); appearance.dispose();
  assert.equal(released, 1); assert.equal(borrowed, 0); assert.equal(trousers.geometry, original);
});

test('the actual tie panels remain above the shirt triangles in the folded bathroom poses', async t => {
  const h = await characters(t), hero = h.morpheus.hero!;
  const shirt = hero.root.getObjectByName('morpheus-ambush-shirt') as THREE.SkinnedMesh, tie = hero.root.getObjectByName('morpheus-ambush-tie') as THREE.SkinnedMesh;
  const triangles = (mesh: THREE.SkinnedMesh) => {
    const result: { face: number; points: THREE.Vector3[]; box: THREE.Box3 }[] = [], index = mesh.geometry.index!, bind = mesh.geometry.attributes.position;
    for (let i = 0; i < index.count; i += 3) {
      const ids = [0, 1, 2].map(n => index.getX(i + n));
      if (ids.some(id => Math.abs(bind.getX(id)) > .4 || bind.getZ(id) < .05) || ids.every(id => bind.getY(id) < 2.34) || ids.every(id => bind.getY(id) > 3.1)) continue;
      const points = ids.map(id => mesh.getVertexPosition(id, new THREE.Vector3()).applyMatrix4(mesh.matrixWorld));
      result.push({ face: i / 3, points, box: new THREE.Box3().setFromPoints(points) });
    }
    return result;
  };
  for (const [phase, elapsed] of [['ready', 0], ['breakout', 1.6], ['counter', .325], ['capturing', 2.5]] as const) {
    const gesture = { ...newBathroomFight(), role: 'morpheus' as const, phase, elapsed }, pose = bathroomFightRoot(gesture, 'morpheus'), center = FILM_SETS.film_ambush_house.center;
    h.morpheus.root.position.set(center.x + pose.x, center.y - 1 + WETWALL_SHAFT.sixth, center.z + pose.z); h.morpheus.root.rotation.y = pose.yaw;
    h.models.animate(h.morpheus, 0, { speed: 0, grounded: true, verticalVelocity: 0, turn: 0, ambushWardrobe: 'shirt', bathroom: gesture }, 4); h.update();
    const panels = triangles(tie), body = triangles(shirt), crossings: string[] = [], ray = new THREE.Ray(), hit = new THREE.Vector3();
    assert.ok(panels.length > 10 && body.length > 100, 'the delivered lower tie and corresponding shirt surface are sampled');
    for (const a of panels) for (const b of body) {
      if (!a.box.intersectsBox(b.box)) continue;
      let crossed = false;
      for (const [first, second] of [[a.points, b.points], [b.points, a.points]]) for (let i = 0; i < 3; i++) {
        const start = first[i], end = first[(i + 1) % 3], length = start.distanceTo(end); ray.set(start, end.clone().sub(start).normalize());
        if (ray.intersectTriangle(second[0], second[1], second[2], false, hit) && start.distanceTo(hit) > 1e-5 && start.distanceTo(hit) < length - 1e-5) crossed = true;
      }
      if (crossed) crossings.push(`tie ${a.face}/shirt ${b.face}`);
    }
    assert.deepEqual(crossings, [], `${phase}: actual tie panels cross the folded shirt`);
  }
});

test('the torso transition adds no large shirt folds beyond the delivered cloth microseams', async t => {
  const h = await characters(t), hero = h.morpheus.hero!;
  const shirt = hero.root.getObjectByName('morpheus-ambush-shirt') as THREE.SkinnedMesh;
  const donor = hero.root.getObjectByName('morpheus-hammer-sweater') as THREE.SkinnedMesh;
  const gesture = { ...newBathroomFight(), role: 'morpheus' as const, phase: 'ready' as const, elapsed: 0 }, pose = bathroomFightRoot(gesture, 'morpheus'), center = FILM_SETS.film_ambush_house.center;
  h.morpheus.root.position.set(center.x + pose.x, center.y - 1 + WETWALL_SHAFT.sixth, center.z + pose.z); h.morpheus.root.rotation.y = pose.yaw;
  h.models.animate(h.morpheus, 0, { speed: 0, grounded: true, verticalVelocity: 0, turn: 0, ambushWardrobe: 'shirt', bathroom: gesture }, 4); h.update();
  const audit = (mesh: THREE.SkinnedMesh) => {
    const triangles: { face: number; points: THREE.Vector3[]; box: THREE.Box3 }[] = [], index = mesh.geometry.index!, bind = mesh.geometry.attributes.position;
    for (let face = 0; face < index.count / 3; face++) {
      const ids = [0, 1, 2].map(n => index.getX(face * 3 + n));
      if (ids.some(i => Math.abs(bind.getX(i)) > .2 || bind.getZ(i) < .05) || ids.every(i => bind.getY(i) < 2.65) || ids.every(i => bind.getY(i) > 3.1)) continue;
      const points = ids.map(i => mesh.getVertexPosition(i, new THREE.Vector3()));
      triangles.push({ face, points, box: new THREE.Box3().setFromPoints(points) });
    }
    const crossings: { a: number; b: number; length: number }[] = [], ray = new THREE.Ray(), hit = new THREE.Vector3();
    for (let a = 0; a < triangles.length; a++) for (let b = a + 1; b < triangles.length; b++) {
      const first = triangles[a], second = triangles[b];
      if (!first.box.intersectsBox(second.box) || first.points.some(p => second.points.some(q => p.distanceTo(q) < 1e-5))) continue;
      const hits: THREE.Vector3[] = [];
      for (const [p, q] of [[first.points, second.points], [second.points, first.points]]) for (let i = 0; i < 3; i++) {
        const start = p[i], end = p[(i + 1) % 3], length = start.distanceTo(end); ray.set(start, end.clone().sub(start).normalize());
        if (ray.intersectTriangle(q[0], q[1], q[2], false, hit) && start.distanceTo(hit) > 1e-5 && start.distanceTo(hit) < length - 1e-5) hits.push(hit.clone());
      }
      if (hits.length) crossings.push({ a: first.face, b: second.face, length: Math.max(...hits.flatMap(p => hits.map(q => p.distanceTo(q)))) });
    }
    assert.ok(triangles.length > 500);
    return crossings;
  };
  const original = audit(donor), fitted = audit(shirt), baseline = Math.max(...original.map(c => c.length)), maximum = Math.max(...fitted.map(c => c.length));
  assert.ok(baseline > 0 && baseline < .006, 'the unchanged donor has known millimetre-scale microseam overlap');
  t.diagnostic(`ready: donor ${original.length} crossings, maximum ${baseline}; fitted ${fitted.length}, maximum ${maximum}`);
  assert.ok(maximum <= baseline + 1e-5, 'the new torso field must not create a larger fold through the original cloth');
  for (const [a, b] of [[20005, 21416], [20046, 21374], [20046, 21377], [20005, 21414], [19819, 21599]]) {
    assert.ok(!fitted.some(c => c.a === a && c.b === b), `new fold ${a}/${b} must be absent, rather than hidden by the tie`);
  }
});

// Intersect each triangle with the other plane, then overlap the two line
// intervals. Edge rays can miss a real mirror-seam crossing when both intervals
// have exactly coincident endpoints on the opposite triangle's edges.
function seamIntersection(first: THREE.Vector3[], second: THREE.Vector3[]): number {
  const normal = (points: THREE.Vector3[]) => new THREE.Triangle(points[0], points[1], points[2]).getNormal(new THREE.Vector3());
  const cut = (points: THREE.Vector3[], plane: THREE.Vector3[]) => {
    const n = normal(plane), distances = points.map(point => point.clone().sub(plane[0]).dot(n)), hits: THREE.Vector3[] = [];
    if (Math.min(...distances) >= -1e-8 || Math.max(...distances) <= 1e-8) return hits;
    const add = (point: THREE.Vector3) => { if (!hits.some(hit => hit.distanceTo(point) < 1e-9)) hits.push(point); };
    for (let i = 0; i < 3; i++) {
      const next = (i + 1) % 3;
      if (Math.abs(distances[i]) <= 1e-8) add(points[i].clone());
      if (distances[i] * distances[next] < 0) add(points[i].clone().lerp(points[next], distances[i] / (distances[i] - distances[next])));
    }
    return hits;
  };
  const a = cut(first, second), b = cut(second, first);
  if (a.length < 2 || b.length < 2) return 0;
  const axis = normal(first).cross(normal(second)).normalize();
  const interval = (points: THREE.Vector3[]) => points.map(point => point.clone().sub(first[0]).dot(axis)).sort((a, b) => a - b);
  const x = interval(a), y = interval(b);
  return Math.max(0, Math.min(x.at(-1)!, y.at(-1)!) - Math.max(x[0], y[0]));
}

test('the actual saved renderer preserves rear-seam relief without adding visible cloth crossings', async t => {
  const h = await characters(t), scene = new THREE.Scene(), renderer = new AgentRenderer(scene), center = FILM_SETS.film_ambush_house.center;
  t.after(() => renderer.dispose());
  const actor = h.world.agents.get('morpheus')!;
  const gesture = { ...newBathroomFight(), role: 'morpheus' as const, phase: 'capturing' as const, elapsed: 2.5, evaded: true }, pose = bathroomFightRoot(gesture, 'morpheus');
  Object.assign(actor, { currentLocation: 'film_ambush_house', isInMatrix: true, velocity: { x: 0, y: 0, z: 0 }, rotation: pose.yaw,
    position: { x: center.x + pose.x, y: center.y - 1 + WETWALL_SHAFT.sixth, z: center.z + pose.z },
    currentAction: { type: 'idle', parameters: { resolved: true, bathroom: gesture }, startedAt: 0, duration: 1, progress: 0 } });
  const journey = { version: 1 as const, scene: 'm1_bathroom', actor: 'neo', step: 0, completed: [], enteredAt: 0, reflections: {}, lastText: '', checkpoint: { ...center } };
  renderer.updateAgent(actor.id, actor);
  for (let i = 0; i < 3; i++) { await new Promise(resolve => setImmediate(resolve)); renderer.update(0, undefined, 0, 0, journey); }
  // Replay the actual reference's pipe-to-bathroom transition as well as
  // the current saved gesture; the renderer retains its paused world heading.
  const wall = (depth: number) => {
    const start = { x: WETWALL.lanes.morpheus, y: WETWALL_SHAFT.top, z: -26 }, path = wetwallPath(start, 'morpheus');
    const entry = path.slice(1).reduce((sum, p, i) => sum + Math.hypot(p.x - path[i].x, p.y - path[i].y, p.z - path[i].z), 0);
    const wetwall: WetwallGesture = { role: 'morpheus', phase: 'climbing', elapsed: 0, progress: entry + depth, entry, hanging: true, freed: false, start };
    const p = wetwallPose(start, 'morpheus', wetwall.progress, 'climbing', 0);
    Object.assign(actor, { position: { x: center.x + p.x, y: center.y - 1 + p.y, z: center.z + p.z }, rotation: p.yaw,
      currentAction: { type: 'idle', parameters: { resolved: true, wetwall }, startedAt: 0, duration: 1, progress: 0 } });
    renderer.updateAgent(actor.id, actor); renderer.update(0, undefined, 0, 0, { ...journey, scene: 'm1_wetwall' }); scene.updateMatrixWorld(true);
  };
  const bathroom = (phase: BathroomGesture['phase'], elapsed: number) => {
    const bathroom = { ...gesture, phase, elapsed }, p = bathroomFightRoot(bathroom, 'morpheus');
    Object.assign(actor, { position: { x: center.x + p.x, y: center.y - 1 + WETWALL_SHAFT.sixth, z: center.z + p.z }, rotation: p.yaw,
      currentAction: { type: 'idle', parameters: { resolved: true, bathroom }, startedAt: 0, duration: 1, progress: 0 } });
    renderer.updateAgent(actor.id, actor); renderer.update(0, undefined, 0, 0, journey); scene.updateMatrixWorld(true);
  };
  wall(.32); bathroom('capturing', 2.5);
  const rig = (renderer as unknown as { agents: Map<string, { rig: typeof h.morpheus }> }).agents.get('morpheus')!.rig;
  assert.ok(rig.hero);
  const shirt = rig.hero.root.getObjectByName('morpheus-ambush-shirt') as THREE.SkinnedMesh;
  const donor = rig.hero.root.getObjectByName('morpheus-hammer-sweater') as THREE.SkinnedMesh;
  const origin = rig.root.getWorldPosition(new THREE.Vector3());
  assert.ok(Math.abs(rig.root.getWorldQuaternion(new THREE.Quaternion()).y) > .999, 'replay the saved reference body heading');
  const triangle = (mesh: THREE.SkinnedMesh, face: number) => [0, 1, 2].map(n =>
    mesh.getVertexPosition(mesh.geometry.index!.getX(face * 3 + n), new THREE.Vector3()).applyMatrix4(mesh.matrixWorld).sub(origin));
  for (const [a, b] of [[20629, 9838], [9839, 20625]]) {
    const original = seamIntersection(triangle(donor, a), triangle(donor, b)), fitted = seamIntersection(triangle(shirt, a), triangle(shirt, b));
    assert.equal(original, 0, `${a}/${b}: actual same-pose donor control`);
    assert.equal(fitted, 0, `${a}/${b}: the added triangular seam blotches must remain absent`);
  }
  for (const [a, b] of [[9838, 20620], [9842, 20624]]) {
    const first = triangle(donor, a), second = triangle(donor, b), original = seamIntersection(first, second);
    assert.ok(original > .03, `${a}/${b}: coincident interval endpoints must not hide the donor's real crossing`);
    const translated = seamIntersection(first.map(p => p.clone().addScalar(10000)), second.map(p => p.clone().addScalar(10000)));
    assert.ok(Math.abs(translated - original) < 1e-8, 'the plane-interval check is stable after large common translation');
    t.diagnostic(`actual capturing seam ${a}/${b}: donor line ${original}, fitted ${seamIntersection(triangle(shirt, a), triangle(shirt, b))}; line length is not penetration depth`);
  }
  const faces: number[] = [], index = donor.geometry.index!, bind = donor.geometry.attributes.position;
  for (let face = 0; face < index.count / 3; face++) {
    const middle = [0, 1, 2].reduce((p, n) => p.add(new THREE.Vector3().fromBufferAttribute(bind, index.getX(face * 3 + n))), new THREE.Vector3()).divideScalar(3);
    if (Math.abs(middle.x) < .05 && middle.y > 2.35 && middle.y < 2.55 && middle.z < -.1) faces.push(face);
  }
  assert.equal(faces.length, 124, 'inspect the full original seam neighbourhood, including the visible upper fold');
  const failures: { label: string; a: number; b: number; line: number }[] = [];
  for (const [label, apply] of [
    ['capturing', () => bathroom('capturing', 2.5)], ['ready', () => bathroom('ready', 0)],
    ['counter', () => bathroom('counter', .325)], ['breakout', () => bathroom('breakout', 1.6)],
    ...[.32, 1.05, 14.8].map(depth => [`pipe ${depth}`, () => wall(depth)] as const),
  ] as const) {
    apply(); rig.root.getWorldPosition(origin);
    const original = new Map(faces.map(face => [face, triangle(donor, face)])), fitted = new Map(faces.map(face => [face, triangle(shirt, face)]));
    const added: { a: number; b: number; line: number }[] = []; let originalCount = 0, fittedCount = 0;
    for (let i = 0; i < faces.length; i++) for (let j = i + 1; j < faces.length; j++) {
      const a = faces[i], b = faces[j];
      if ([0, 1, 2].some(n => [0, 1, 2].some(m => index.getX(a * 3 + n) === index.getX(b * 3 + m)))) continue;
      const old = seamIntersection(original.get(a)!, original.get(b)!), line = seamIntersection(fitted.get(a)!, fitted.get(b)!);
      if (old > 1e-6) originalCount++; if (line > 1e-6) fittedCount++;
      if (old <= 1e-6 && line > 1e-6) added.push({ a, b, line });
    }
    t.diagnostic(`${label}: rear region donor ${originalCount} crossings; fitted ${fittedCount}`);
    assert.equal(fittedCount, 0, `${label}: the unfolded rear strip and inner hem must remain free of surface crossings`);
    failures.push(...added.map(pair => ({ label, ...pair })));
  }
  assert.deepEqual(failures, [], 'fitting must not introduce crossings elsewhere in the same rear seam');
});

test('the unfolded back keeps a closed, smoothly shaded centre seam and unchanged cloth outside the narrow strip', async () => {
  const h = await model();
  try {
    h.pose('shirt');
    const shirt = h.rig.root.getObjectByName('morpheus-ambush-shirt') as THREE.SkinnedMesh;
    const donor = h.rig.root.getObjectByName('morpheus-hammer-sweater') as THREE.SkinnedMesh;
    assert.deepEqual(Array.from(shirt.geometry.index!.array).slice(0, donor.geometry.index!.count), Array.from(donor.geometry.index!.array), 'the original connected garment faces are retained');
    const a = shirt.geometry.attributes, b = donor.geometry.attributes, centre = new Map<string, number[]>();
    let unchangedNormals = 0, unchangedSleeves = 0;
    for (let i = 0; i < b.position.count; i++) {
      const point = new THREE.Vector3().fromBufferAttribute(b.position, i);
      // The unfolded strip is at |x| < .1; its original boundary return is
      // .012 thick. Normals outside that complete local band stay untouched.
      if (Math.abs(point.x) >= .112 || point.z >= -.088 || point.y >= 2.712) {
        for (let n = 0; n < 3; n++) assert.equal(a.normal.getComponent(i, n), b.normal.getComponent(i, n), `unchanged normal ${i}/${n}`);
        unchangedNormals++;
      }
      const influence = (pattern: RegExp) => [0, 1, 2, 3].reduce((sum, n) => sum + (pattern.test(donor.skeleton.bones[b.skinIndex.getComponent(i, n)].name) ? b.skinWeight.getComponent(i, n) : 0), 0);
      if (Math.abs(point.x) > .5 && influence(/^(pelvis|spine|chest)$/) === 0 && influence(/^(pelvis|spine|chest|hip_[LR])$/) <= .8) {
        for (let n = 0; n < 3; n++) assert.equal(a.position.getComponent(i, n), b.position.getComponent(i, n), `untouched sleeve ${i}/${n}`);
        unchangedSleeves++;
      }
      assert.equal(a.uv.getX(i), b.uv.getX(i)); assert.equal(a.uv.getY(i), b.uv.getY(i));
      if (Math.abs(b.position.getX(i)) < 1e-6 && b.position.getZ(i) < -.1 && b.position.getY(i) > 2.37 && b.position.getY(i) < 2.7) {
        const key = [b.position.getY(i), b.position.getZ(i)].map(v => v.toFixed(6)).join(',');
        let ids = centre.get(key); if (!ids) centre.set(key, ids = []); ids.push(i);
      }
    }
    assert.ok(unchangedNormals > 10000, 'all normals outside the local hem strip are compared');
    assert.ok(unchangedSleeves > 1000, 'sleeve points unaffected by the existing torso/waist fit remain exact');
    assert.ok(centre.size >= 9, 'the delivered hem-to-back centreline is covered');
    for (const [key, ids] of centre) {
      assert.ok(ids.length >= 2, `${key}: both original UV halves are retained`);
      const first = ids[0];
      for (const id of ids.slice(1)) {
        assert.ok(new THREE.Vector3().fromBufferAttribute(a.position, id).distanceTo(new THREE.Vector3().fromBufferAttribute(a.position, first)) < 1e-6, `${key}: no physical slit`);
        assert.ok(new THREE.Vector3().fromBufferAttribute(a.normal, id).distanceTo(new THREE.Vector3().fromBufferAttribute(a.normal, first)) < 1e-6, `${key}: no split shading normal`);
        const influences = (i: number) => [0, 1, 2, 3].map(n => [a.skinIndex.getComponent(i, n), a.skinWeight.getComponent(i, n)]).filter(pair => pair[1] > 0).sort((a, b) => a[0] - b[0]);
        assert.deepEqual(influences(id), influences(first), `${key}: the seam halves keep identical animation weights`);
      }
    }
  } finally { h.models.dispose(); }
});

test('rear-seam intersection measurement retains an on-plane vertex and coincident cut endpoints', () => {
  const points = (values: number[][]) => values.map(p => new THREE.Vector3(...p as [number, number, number]));
  const a = points([[-1, 0, 0], [1, 0, 0], [0, 1, 0]]), b = points([[0, 0, 0], [0, .5, 1], [0, 1, -1]]);
  assert.ok(Math.abs(seamIntersection(a, b) - .75) < 1e-9, 'an exact on-plane vertex begins the interior intersection');
  const c = points([[0, 0, 0], [-1, 1, 1], [1, 1, -1]]);
  assert.ok(Math.abs(seamIntersection(a, c) - 1) < 1e-9, 'coincident interval endpoints still bound a real interior intersection');
});
