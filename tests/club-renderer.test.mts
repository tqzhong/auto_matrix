import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { CLUB, CLUB_DANCERS, CLUB_ROUTE, FILM_SETS, clubRoot, filmPosition, playerBlocked, type ClubGesture } from '@auto_matrix/shared';
import { AgentRenderer } from '../packages/client/src/agents/AgentRenderer.js';
import { newMotion } from '../packages/client/src/agents/CharacterMotion.js';
import { ClubSetRenderer } from '../packages/client/src/engine/ClubSetRenderer.js';
import { WorldState } from '../packages/server/src/world/WorldState.js';
import { AgentManager } from '../packages/server/src/agents/AgentManager.js';

async function geometry(id: string) {
  const glb = await readFile(new URL(`../packages/client/public/assets/characters/${id}.glb`, import.meta.url));
  const length = glb.readUInt32LE(12), source = JSON.parse(glb.subarray(20, 20 + length).toString());
  for (const material of source.materials) { delete material.pbrMetallicRoughness.baseColorTexture; delete material.normalTexture; }
  source.images = []; source.textures = [];
  const json = Buffer.from(JSON.stringify(source)), padded = Buffer.alloc(Math.ceil(json.length / 4) * 4, 32); json.copy(padded);
  const bin = glb.subarray(20 + length), buffer = Buffer.alloc(20 + padded.length + bin.length);
  buffer.writeUInt32LE(0x46546c67, 0); buffer.writeUInt32LE(2, 4); buffer.writeUInt32LE(buffer.length, 8);
  buffer.writeUInt32LE(padded.length, 12); buffer.writeUInt32LE(0x4e4f534a, 16); padded.copy(buffer, 20); bin.copy(buffer, 20 + padded.length);
  return new GLTFLoader().parseAsync(buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength), '');
}

test('Trinity’s swept temple has opaque hair over the exposed scalp samples', async () => {
  const { scene, parser } = await geometry('trinity');
  const surface = new THREE.MeshBasicMaterial({ side: THREE.DoubleSide });
  const mesh = (name: string) => new THREE.Mesh((scene.getObjectByName(name) as THREE.SkinnedMesh).geometry, surface);
  const skull = mesh('Anatomical_head_and_hands'), hair = mesh('short04');
  const center = new THREE.Vector3(0, parser.json.extras.eye[1] + .045, .124);
  // These rest-space points are the distinct exposed patches in the saved 596-tick whisper.
  try {
    for (const point of [[.1303, 4.1647, .2449], [.129, 4.1464, .260], [.1379, 4.1345, .2393]]) {
      const ray = new THREE.Raycaster(center, new THREE.Vector3().fromArray(point).sub(center).normalize(), 0, 1);
      const scalp = ray.intersectObject(skull).at(-1);
      assert.ok(scalp);
      assert.ok(ray.intersectObject(hair).some(hit => {
        const gap = hit.distance - scalp.distance;
        const uv = hit.uv!;
        return gap > .001 && gap < .012 && uv.x * 2048 >= 880 && uv.x * 2048 <= 1110
          && uv.y * 2048 >= 550 && uv.y * 2048 <= 650;
      }), `the opaque part of the existing hair atlas must cover the scalp at ${point}`);
    }
  } finally { surface.dispose(); }
});

test('Dujour and the club dancers have continuous exposed skin', async t => {
  for (const id of ['dujour', 'club-female']) await t.test(id, async t => {
    const { scene } = await geometry(id);
    scene.updateMatrixWorld(true);
    const torso: THREE.SkinnedMesh[] = [];
    scene.traverse(mesh => {
      if (mesh instanceof THREE.SkinnedMesh && ['Anatomical_head_and_hands', 'Black_crew_neck', 'Tailored_trousers'].includes(mesh.name)) torso.push(mesh);
    });
    assert.equal(torso.length, 3);
    await t.test('waist', () => {
      for (const side of [-1, 1]) for (const x of [-.15, -.05, .05, .15]) for (const y of [2.38, 2.45, 2.52, 2.59, 2.66, 2.73]) {
        const ray = new THREE.Raycaster(new THREE.Vector3(x, y, side), new THREE.Vector3(0, 0, -side), 0, 1);
        assert.ok(ray.intersectObjects(torso, false).length, `the waist is open at ${x}, ${y} from side ${side}`);
      }
    });
    await t.test('forearms', () => {
      const skin = torso.find(mesh => mesh.name === 'Anatomical_head_and_hands')!;
      for (const side of ['L', 'R']) {
        const elbow = scene.getObjectByName('elbow_' + side)!.getWorldPosition(new THREE.Vector3());
        const wrist = scene.getObjectByName('wrist_' + side)!.getWorldPosition(new THREE.Vector3());
        for (const progress of [.35, .5, .65, .8]) for (const view of [-1, 1]) {
          const origin = elbow.clone().lerp(wrist, progress).add(new THREE.Vector3(0, 0, view * .35));
          const ray = new THREE.Raycaster(origin, new THREE.Vector3(0, 0, -view), 0, .45);
          assert.ok(ray.intersectObject(skin, false).length, `forearm ${side} is open at ${progress} from side ${view}`);
        }
      }
    });
    await t.test('the skin continues inside the back of the trousers', () => {
      const skin = torso.find(mesh => mesh.name === 'Anatomical_head_and_hands')!;
      const pants = torso.find(mesh => mesh.name === 'Tailored_trousers')!;
      for (const x of [-.306, -.294, .294, .306]) {
        const ray = new THREE.Raycaster(new THREE.Vector3(x, 2.352, -1), new THREE.Vector3(0, 0, 1), 0, 1);
        const [skinHit] = ray.intersectObject(skin, false), [pantsHit] = ray.intersectObject(pants, false);
        assert.ok(skinHit && pantsHit);
        assert.ok(skinHit.distance >= pantsHit.distance - .008, `skin breaks through the waistband at ${x}`);
      }
    });
    await t.test('the cropped top follows a continuous seam across the chest and back', () => {
      const shirt = torso.find(mesh => mesh.name === 'Black_crew_neck')!;
      const skin = torso.find(mesh => mesh.name === 'Anatomical_head_and_hands')!;
      for (const side of [-1, 1]) {
        const heights: number[] = [];
        const ray = new THREE.Raycaster(new THREE.Vector3(), new THREE.Vector3(0, 0, -side), 0, 1.5);
        for (let column = -8; column <= 8; column++) {
          const x = column * .03;
          for (let index = 0; index < 100; index++) {
            const y = 3.48 - index * .004;
            ray.ray.origin.set(x, y, side);
            if (!ray.intersectObject(shirt, false).length) continue;
            heights.push(y);
            ray.ray.origin.y -= .028;
            const [cloth] = ray.intersectObject(shirt, false), [body] = ray.intersectObject(skin, false);
            assert.ok(cloth && body && cloth.distance + .002 < body.distance, `skin breaks through the seam at ${x}, ${side}`);
            break;
          }
        }
        assert.equal(heights.length, 17, 'the seam spans the torso');
        const discontinuity = Math.max(...heights.slice(1).map((height, i) => Math.abs(height - heights[i])));
        assert.ok(discontinuity < .023, `the top edge jumps ${discontinuity} units between adjacent chest samples`);
      }
    });
  });
});

test('the undershirt stays under Choi’s jacket and the same club wardrobe', async t => {
  for (const id of ['choi', 'club-male']) await t.test(id, async () => {
    const { scene } = await geometry(id);
    scene.updateMatrixWorld(true);
    const shirt = scene.getObjectByName('Black_crew_neck')!;
    const jacket = scene.getObjectByName('Tailored_coat_upper')!;
    for (const x of [-.195, -.18, -.165, .165, .18, .195]) for (const y of [3.178, 3.192, 3.206, 3.22]) {
      const ray = new THREE.Raycaster(new THREE.Vector3(x, y, 1), new THREE.Vector3(0, 0, -1), 0, 1);
      const [inner] = ray.intersectObject(shirt, false), [outer] = ray.intersectObject(jacket, false);
      assert.ok(inner && outer);
      assert.ok(inner.distance >= outer.distance - .002, `shirt crosses the jacket at ${x}, ${y}`);
    }
    const opening = new THREE.Raycaster(new THREE.Vector3(0, 3.21, 1), new THREE.Vector3(0, 0, -1), 0, .75);
    assert.ok(opening.intersectObject(shirt, false).length, 'the shirt remains visible through the jacket opening');
    assert.equal(opening.intersectObject(jacket, false).length, 0);
  });
});

test('the whisper has a cool backlight over both marks and the bar light stays behind the counter', async t => {
  const assets = new Map(await Promise.all(['club-male', 'club-female'].map(async id => [id, await geometry(id)] as const)));
  t.mock.method(THREE.TextureLoader.prototype, 'load', () => new THREE.Texture());
  t.mock.method(GLTFLoader.prototype, 'loadAsync', (url: string) => Promise.resolve(assets.get(url.split('/').at(-1)!.replace('.glb', ''))!));
  const root = new THREE.Group(), club = new ClubSetRenderer(root);
  t.after(() => club.dispose());
  await club.ready;
  const key = root.getObjectByName('club-conversation-light');
  assert.ok(key instanceof THREE.SpotLight && key.castShadow);
  assert.deepEqual(key.shadow.mapSize.toArray(), [1024, 1024]);
  assert.ok(key.color.g > key.color.r && key.color.b > key.color.r);
  const bar = root.getObjectByName('white-rabbit-club')!.children.find(
    (object): object is THREE.PointLight => object instanceof THREE.PointLight && object.position.x > 17,
  );
  assert.ok(bar && bar.distance > bar.position.distanceTo(new THREE.Vector3(20, 4, -13)), 'the shelves remain under their practical light');
  const direction = key.target.position.clone().sub(key.position).normalize();
  for (const role of ['neo', 'trinity'] as const) {
    const mark = clubRoot({ phase: 'whisper', elapsed: 6.4 }, role);
    const head = new THREE.Vector3(mark.x, 3.65, mark.z);
    assert.ok(bar.distance < bar.position.distanceTo(head), `warm bar light reaches ${role}’s conversation mark`);
    const fromLight = head.sub(key.position);
    assert.ok(fromLight.normalize().dot(direction) > Math.cos(key.angle));
    if (role === 'trinity') assert.ok(fromLight.dot(new THREE.Vector3(Math.sin(mark.yaw), 0, Math.cos(mark.yaw))) > .45);
  }
});

test('the moving dance lights illuminate the crowd from behind at shoulder height', async t => {
  const assets = new Map(await Promise.all(['club-male', 'club-female'].map(async id => [id, await geometry(id)] as const)));
  t.mock.method(THREE.TextureLoader.prototype, 'load', () => new THREE.Texture());
  t.mock.method(GLTFLoader.prototype, 'loadAsync', (url: string) => Promise.resolve(assets.get(url.split('/').at(-1)!.replace('.glb', ''))!));
  const root = new THREE.Group(), club = new ClubSetRenderer(root);
  t.after(() => club.dispose());
  await club.ready;
  const lights = root.getObjectByName('white-rabbit-club')!.children.filter(
    (object): object is THREE.SpotLight => object instanceof THREE.SpotLight && !object.castShadow,
  );
  assert.equal(lights.length, 2);
  for (const time of [0, 3, 7]) {
    club.update(time);
    for (const light of lights) {
      assert.ok(light.position.z < -17 && light.target.position.z - light.position.z > 12, 'rim light comes from beyond the dancers');
      assert.ok(light.target.position.y >= 2 && light.target.position.y <= 3.6, 'beam crosses the crowd rather than only the floor');
      assert.ok(light.color.g > light.color.r * 1.25 && light.color.g > light.color.b * 1.25, 'the stage light reads as green');
    }
  }
});

test('the whisper has dancers in the third-person background with clear walking and approach lanes', async t => {
  const assets = new Map(await Promise.all(['club-male', 'club-female'].map(async id => [id, await geometry(id)] as const)));
  t.mock.method(THREE.TextureLoader.prototype, 'load', () => new THREE.Texture());
  t.mock.method(GLTFLoader.prototype, 'loadAsync', (url: string) => Promise.resolve(assets.get(url.split('/').at(-1)!.replace('.glb', ''))!));
  const root = new THREE.Group(), club = new ClubSetRenderer(root);
  t.after(() => club.dispose());
  await club.ready; root.updateMatrixWorld(true);
  const eye = new THREE.PerspectiveCamera(57, 16 / 9, .5, 100);
  eye.position.set(4.2, 4.5, -2.2); eye.lookAt(6.65, 3.92, -4.55); eye.updateMatrixWorld(true);
  const entrance = new THREE.PerspectiveCamera(67.37, 16 / 9, .5, 100);
  entrance.position.set(0, 3.99, 17.92); entrance.lookAt(0, 3.75, 16.95); entrance.updateMatrixWorld(true);
  const shoulder = eye.clone();
  shoulder.position.set(6.72, 4.14, -2.5); shoulder.lookAt(6.745, 4.0215, -3.4926); shoulder.updateMatrixWorld(true);
  const walkway = [CLUB.exit, { x: 0, z: 6 }, { x: 7, z: 6 }, CLUB.neo];
  const nearView = (head: THREE.Vector3, camera: THREE.Camera, radius: number) => {
    const projected = head.clone().project(camera);
    return head.distanceTo(camera.position) < radius && Math.abs(projected.x) < .88 && Math.abs(projected.y) < .88 && projected.z > -1 && projected.z < 1;
  };
  let visible = 0, entranceSilhouettes = 0, closeBackground = 0;
  for (const [i, mark] of CLUB_DANCERS.entries()) {
    const head = root.getObjectByName(`club-dancer-${i}`)!.getObjectByName('head')!.getWorldPosition(new THREE.Vector3());
    visible += Number(nearView(head, eye, 95));
    entranceSilhouettes += Number(nearView(head, entrance, 6.5));
    closeBackground += Number(nearView(head, shoulder, 8));
    assert.equal(playerBlocked(filmPosition('film_white_rabbit_club', mark.x, mark.z), true, 1), false, `dancer ${i} enters a set obstacle`);
    for (const path of [walkway, CLUB_ROUTE]) for (let j = 1; j < path.length; j++) {
      const line = new THREE.Line3(new THREE.Vector3(path[j - 1].x, 0, path[j - 1].z), new THREE.Vector3(path[j].x, 0, path[j].z));
      const point = new THREE.Vector3(mark.x, 0, mark.z);
      assert.ok(line.closestPointToPoint(point, true, new THREE.Vector3()).distanceTo(point) >= 2.8, `dancer ${i} blocks a walking lane`);
    }
  }
  assert.ok(entranceSilhouettes >= 2, `only ${entranceSilhouettes} dancers frame the actual entrance aisle`);
  assert.ok(closeBackground >= 2, `only ${closeBackground} dancers are close behind the whisper`);
  assert.ok(visible >= 5, `only ${visible} dancers fill the background behind the conversation`);
});

test('existing dance rigs carry distinct light tops and dark floor-lit trousers', async t => {
  const assets = new Map(await Promise.all(['club-male', 'club-female'].map(async id => [id, await geometry(id)] as const)));
  t.mock.method(THREE.TextureLoader.prototype, 'load', () => new THREE.Texture());
  t.mock.method(GLTFLoader.prototype, 'loadAsync', (url: string) => Promise.resolve(assets.get(url.split('/').at(-1)!.replace('.glb', ''))!));
  const root = new THREE.Group(), club = new ClubSetRenderer(root);
  t.after(() => club.dispose());
  await club.ready;
  const garment = (dancer: THREE.Object3D, name: string) => {
    const mesh = dancer.getObjectByName(name);
    assert.ok(mesh instanceof THREE.Mesh && mesh.material instanceof THREE.MeshStandardMaterial);
    return mesh.material;
  };
  const female = CLUB_DANCERS.flatMap((_, i) => i % 2 ? [root.getObjectByName(`club-dancer-${i}`)!] : []);
  const tops = female.map(dancer => garment(dancer, 'Black_crew_neck'));
  const trousers = female.map(dancer => garment(dancer, 'Tailored_trousers'));
  assert.ok(new Set(tops.map(material => material.color.getHex())).size >= 4);
  assert.ok(tops.some((material, i) => material.color.g > .2 && trousers[i].color.g < .1), 'a light top can separate from the darker trousers under the moving lights');
  assert.ok(trousers.some(material => material.roughness < .5), 'some trousers should catch a defined reflection in the rear light');
  for (const asset of assets.values()) {
    assert.equal(garment(asset.scene, 'Tailored_trousers').roughness, .86, 'the shared source wardrobe keeps its original material');
  }
});

test('wide dance gestures leave the elbows and wrists clear of the torso', async t => {
  const assets = new Map(await Promise.all(['club-male', 'club-female'].map(async id => [id, await geometry(id)] as const)));
  t.mock.method(THREE.TextureLoader.prototype, 'load', () => new THREE.Texture());
  t.mock.method(GLTFLoader.prototype, 'loadAsync', (url: string) => Promise.resolve(assets.get(url.split('/').at(-1)!.replace('.glb', ''))!));
  const root = new THREE.Group(), club = new ClubSetRenderer(root);
  t.after(() => club.dispose());
  await club.ready;
  const point = new THREE.Vector3();
  for (let frame = 0; frame < 15; frame++) {
    club.update(frame * .31);
    root.updateMatrixWorld(true);
    for (const index of [0, 1, 3, 4]) {
      const dancer = root.getObjectByName(`club-dancer-${index}`)!;
      const chest = dancer.getObjectByName('chest')!;
      for (const [side, sign] of [['R', -1], ['L', 1]] as const) for (const joint of ['elbow', 'wrist']) {
        const bone = dancer.getObjectByName(joint + '_' + side)!;
        chest.worldToLocal(bone.getWorldPosition(point));
        assert.ok(point.x * sign > .25, `dancer ${index} ${joint}_${side} crosses the torso at frame ${frame}`);
      }
    }
  }
});

test('dancers keep a planted shoe on the floor while shifting weight or lifting the other foot', async t => {
  const assets = new Map(await Promise.all(['club-male', 'club-female'].map(async id => [id, await geometry(id)] as const)));
  t.mock.method(THREE.TextureLoader.prototype, 'load', () => new THREE.Texture());
  t.mock.method(GLTFLoader.prototype, 'loadAsync', (url: string) => Promise.resolve(assets.get(url.split('/').at(-1)!.replace('.glb', ''))!));
  const root = new THREE.Group(), club = new ClubSetRenderer(root);
  t.after(() => club.dispose());
  await club.ready;
  const point = new THREE.Vector3();
  const dancers = CLUB_DANCERS.map((_, i) => root.getObjectByName(`club-dancer-${i}`)!.getObjectByName('shoes01') as THREE.SkinnedMesh);
  const lifted = dancers.map(() => [false, false]);
  for (let frame = 0; frame < 42; frame++) {
    club.update(frame * .075); root.updateMatrixWorld(true);
    for (const [i, shoe] of dancers.entries()) {
      const positions = shoe.geometry.attributes.position, soles = [Infinity, Infinity];
      for (let vertex = 0; vertex < positions.count; vertex++) {
        const side = Number(positions.getX(vertex) > 0);
        shoe.getVertexPosition(vertex, point).applyMatrix4(shoe.matrixWorld);
        soles[side] = Math.min(soles[side], point.y);
      }
      const lowest = Math.min(...soles);
      assert.ok(lowest >= -.02 && lowest <= .015, `dancer ${i} frame ${frame}: support sole is at ${lowest}`);
      soles.forEach((height, side) => { lifted[i][side] ||= height > .04; });
    }
  }
  assert.ok(lifted.every(feet => feet.every(Boolean)), 'each dancer can visibly lift either foot without leaving the floor');
});

test('offscreen dancers can be culled without clipping their animated meshes', async t => {
  const assets = new Map(await Promise.all(['club-male', 'club-female'].map(async id => [id, await geometry(id)] as const)));
  t.mock.method(THREE.TextureLoader.prototype, 'load', () => new THREE.Texture());
  t.mock.method(GLTFLoader.prototype, 'loadAsync', (url: string) => Promise.resolve(assets.get(url.split('/').at(-1)!.replace('.glb', ''))!));
  const root = new THREE.Group(); root.position.set(5376, 0, 4096);
  const club = new ClubSetRenderer(root); t.after(() => club.dispose());
  await club.ready;
  for (let i = 0; i < 16; i++) club.prepareCrowdBounds();
  const meshes: THREE.SkinnedMesh[] = [];
  root.traverse(object => { if (object instanceof THREE.SkinnedMesh) meshes.push(object); });
  assert.equal(meshes.length, 104);
  const crowd = root.getObjectByName('white-rabbit-club')!.children.filter(object => object.name.startsWith('club-dancer-'));
  assert.equal(crowd.length, 16);
  for (const dancer of crowd) {
    const skins = new Set<THREE.Skeleton>();
    dancer.traverse(object => { if (object instanceof THREE.SkinnedMesh) skins.add(object.skeleton); });
    assert.equal(skins.size, 1, `${dancer.name} should upload the same pose once per pass`);
    assert.ok([...skins][0].bones.every(bone => dancer.getObjectById(bone.id) === bone), 'each dancer keeps their own animated bones');
  }
  assert.ok(meshes.every(mesh => mesh.frustumCulled), 'use the prepared bounds for the crowd draw');
  const point = new THREE.Vector3();
  let minimumClearance = Infinity;
  for (let i = 0; i < 48; i++) {
    club.update(i * .63);
    root.updateMatrixWorld(true);
    for (const mesh of meshes) {
      const sphere = mesh.boundingSphere!;
      let farthest = 0;
      const positions = mesh.geometry.attributes.position;
      for (let index = 0; index < positions.count; index++)
        farthest = Math.max(farthest, mesh.getVertexPosition(index, point).distanceToSquared(sphere.center));
      minimumClearance = Math.min(minimumClearance, sphere.radius - Math.sqrt(farthest));
    }
  }
  assert.ok(minimumClearance >= .15, `the shipped rigs need clearance throughout the dance: ${minimumClearance}`);
  const eye = new THREE.PerspectiveCamera(57, 16 / 9, .5, 100);
  eye.position.set(5383, 4.8, 4093); eye.lookAt(5401, 2.5, 4093); eye.updateMatrixWorld();
  const frustum = new THREE.Frustum().setFromProjectionMatrix(new THREE.Matrix4().multiplyMatrices(eye.projectionMatrix, eye.matrixWorldInverse));
  assert.ok(meshes.filter(mesh => !frustum.intersectsObject(mesh)).length >= 52);
});

function setup(t: test.TestContext, assets?: Map<string, Awaited<ReturnType<typeof geometry>>>) {
  t.mock.method(THREE.TextureLoader.prototype, 'load', () => new THREE.Texture());
  t.mock.method(GLTFLoader.prototype, 'loadAsync', (url: string) => assets ? Promise.resolve(assets.get(url.split('/').at(-1)!.replace('.glb', ''))!) : new Promise(() => {}));
  const document = globalThis.document;
  const context = { createRadialGradient: () => ({ addColorStop() {} }), fillRect() {}, strokeRect() {}, fillText() {},
    createImageData: (width: number, height: number) => ({ data: new Uint8ClampedArray(width * height * 4) }), putImageData() {} };
  globalThis.document = { createElement: () => ({ width: 0, height: 0, getContext: () => context }) } as unknown as Document;
  const world = new WorldState(); new AgentManager(world).initializeAllAgents();
  const actor = world.agents.get('trinity')!, renderer = new AgentRenderer(new THREE.Scene());
  actor.currentLocation = 'film_white_rabbit_club'; actor.isInMatrix = true;
  const snapshot = (elapsed: number, phase: ClubGesture['phase'] = 'approaching') => {
    const club: ClubGesture = { phase, elapsed, role: 'trinity' }, root = clubRoot(club, 'trinity');
    actor.position = filmPosition('film_white_rabbit_club', root.x, root.z); actor.rotation = root.yaw;
    actor.currentAction = { type: 'idle', parameters: { resolved: true, club }, startedAt: 0, duration: 1, progress: 0 };
    renderer.updateAgent(actor.id, actor);
    const neo = world.agents.get('neo')!, neoRoot = clubRoot(club, 'neo');
    neo.currentLocation = actor.currentLocation; neo.isInMatrix = true;
    neo.position = filmPosition('film_white_rabbit_club', neoRoot.x, neoRoot.z); neo.rotation = neoRoot.yaw;
    neo.currentAction = { type: 'idle', parameters: { club: { ...club, role: 'neo' } }, startedAt: 0, duration: 1, progress: 0 };
    renderer.updateAgent(neo.id, neo);
  };
  t.after(() => { renderer.dispose(); globalThis.document = document; });
  return { actor, renderer, snapshot };
}

test('Trinity walks between snapshots on the club route instead of jumping to each new network position', t => {
  const h = setup(t); h.snapshot(1); h.renderer.update(0);
  h.snapshot(1.5);
  for (let frame = 1; frame <= 5; frame++) {
    h.renderer.update(.1);
    const root = clubRoot({ phase: 'approaching', elapsed: 1 + frame * .1 }, 'trinity'), target = filmPosition('film_white_rabbit_club', root.x, root.z);
    assert.ok(h.renderer.getAgent('trinity')!.position.distanceTo(new THREE.Vector3(target.x, target.y, target.z)) < .001,
      `frame ${frame}: saved encounter time must drive the rendered route`);
  }
  const entry = (h.renderer as unknown as { agents: Map<string, { rig: { motion: { speed: number } } }> }).agents.get('trinity')!;
  assert.ok(entry.rig.motion.speed > 1, 'route displacement must also drive the walking animation when network velocity is zero');
  for (let i = 0; i < 20; i++) h.renderer.update(.1);
  assert.ok(entry.rig.motion.speed < .1, 'she stops moving her legs when no later position has arrived');
});

test('the actual club models plant the supporting shoe while Trinity steps toward Neo’s ear', async t => {
  const assets = new Map(await Promise.all(['neo', 'neo-office', 'neo-tracking', 'trinity', 'trinity-club'].map(async id => [id, await geometry(id)] as const)));
  const h = setup(t, assets); h.snapshot(0, 'whisper'); await new Promise(resolve => setImmediate(resolve));
  h.renderer.update(0, undefined, 0);
  const left = h.renderer.getAgentBody('trinity')!.getObjectByName('ankle_L')!.getWorldPosition(new THREE.Vector3());
  for (const elapsed of [.15, .3, .45, .6]) {
    h.snapshot(elapsed, 'whisper'); h.renderer.update(0, undefined, 0);
    const foot = h.renderer.getAgentBody('trinity')!.getObjectByName('ankle_L')!.getWorldPosition(new THREE.Vector3());
    assert.ok(foot.distanceTo(left) < .004, `Trinity’s supporting foot slides at ${elapsed}: ${foot.distanceTo(left)}`);
  }
});

test('Trinity turns through a route corner over several rendered frames and restores the exact turn on pause', t => {
  const h = setup(t); h.snapshot(1.6); h.renderer.update(0); h.snapshot(2.1);
  let previous = h.renderer.getAgentBody('trinity')!.rotation.y;
  for (let i = 0; i < 5; i++) {
    h.renderer.update(.1); const heading = h.renderer.getAgentBody('trinity')!.rotation.y;
    assert.ok(Math.abs(Math.atan2(Math.sin(heading - previous), Math.cos(heading - previous))) < .25, 'a corner cannot turn her body in a single frame');
    previous = heading;
  }
  h.renderer.update(0, undefined, 0);
  assert.ok(Math.abs(h.renderer.getAgentBody('trinity')!.rotation.y - clubRoot({ phase: 'approaching', elapsed: 2.1 }, 'trinity').yaw) < .001);
});

test('the actual close pose places Trinity’s lips beside Neo’s ear rather than below his face', async t => {
  const assets = new Map(await Promise.all(['neo', 'neo-office', 'neo-tracking', 'trinity', 'trinity-club'].map(async id => [id, await geometry(id)] as const)));
  const h = setup(t, assets); h.snapshot(6, 'whisper'); await new Promise(resolve => setImmediate(resolve)); h.renderer.update(0, undefined, 0);
  const neo = h.renderer.getAgentBody('neo')!, trinity = h.renderer.getAgentBody('trinity')!;
  neo.updateWorldMatrix(true, true); trinity.updateWorldMatrix(true, true);
  const ear = neo.getObjectByName('head')!.localToWorld(new THREE.Vector3(.21, .06, -.025));
  const lips = trinity.getObjectByName('head')!.localToWorld(new THREE.Vector3(0, -.09, .245));
  assert.ok(lips.distanceTo(ear) < .26, `the whisper must reach her listener’s ear: ${lips.distanceTo(ear)}, lips=${lips.toArray()}, ear=${ear.toArray()}`);
});

function surface(mesh: THREE.SkinnedMesh, minimumY = -Infinity) {
  mesh.updateWorldMatrix(true, false); mesh.updateMatrixWorld(true); mesh.skeleton.update();
  const center = FILM_SETS.film_white_rabbit_club.center, origin = new THREE.Vector3(center.x, center.y - 1, center.z);
  const points = Array.from({ length: mesh.geometry.attributes.position.count }, (_, i) => mesh.localToWorld(mesh.getVertexPosition(i, new THREE.Vector3())).sub(origin));
  const source = mesh.geometry.index!, indices: number[] = [];
  for (let i = 0; i < source.count; i += 3) {
    const triangle = [source.getX(i), source.getX(i + 1), source.getX(i + 2)];
    if (triangle.every(index => points[index].y >= minimumY)) indices.push(...triangle);
  }
  const geometry = new THREE.BufferGeometry(); geometry.setAttribute('position', new THREE.Float32BufferAttribute(points.flatMap(p => p.toArray()), 3)); geometry.setIndex(indices);
  const result = new THREE.Mesh(geometry, new THREE.MeshBasicMaterial({ side: THREE.DoubleSide })); result.updateMatrixWorld(true);
  return { mesh: result, points: [...new Set(indices)].map(i => points[i]), dispose: () => { geometry.dispose(); result.material.dispose(); } };
}

function inside(point: THREE.Vector3, target: THREE.Mesh): boolean {
  const intersections = new THREE.Raycaster(point.clone().add(new THREE.Vector3(8, 0, 0)), new THREE.Vector3(-1, 0, 0), 0, 8 - .002).intersectObject(target, false);
  return new Set(intersections.map(hit => Math.round(hit.distance * 10000))).size % 2 === 1;
}

test('the recorded whisper has no crossing edges in the inspected head surfaces', async t => {
  const assets = new Map(await Promise.all(['neo', 'neo-office', 'neo-tracking', 'trinity', 'trinity-club'].map(async id => [id, await geometry(id)] as const)));
  const h = setup(t, assets); h.snapshot(6.4, 'whisper'); await new Promise(resolve => setImmediate(resolve)); h.renderer.update(0, undefined, 0);
  const heads = ['neo', 'trinity'].map(id => {
    const body = h.renderer.getAgentBody(id)!;
    return surface(body.getObjectByName('Anatomical_head_and_hands') as THREE.SkinnedMesh,
      body.getObjectByName('head')!.getWorldPosition(new THREE.Vector3()).y - .25);
  });
  try {
    for (const [i, id] of ['neo', 'trinity'].entries()) {
      const source = heads[i].mesh.geometry, indices = source.index!, positions = source.attributes.position;
      const target = heads[1 - i].mesh, bounds = new THREE.Box3().setFromPoints(heads[1 - i].points), edges = new Set<number>();
      const from = new THREE.Vector3(), to = new THREE.Vector3(), direction = new THREE.Vector3(), edgeBounds = new THREE.Box3();
      for (let face = 0; face < indices.count; face += 3) for (let side = 0; side < 3; side++) {
        const a = indices.getX(face + side), b = indices.getX(face + (side + 1) % 3);
        const key = Math.min(a, b) * positions.count + Math.max(a, b); if (edges.has(key)) continue; edges.add(key);
        from.fromBufferAttribute(positions, a); to.fromBufferAttribute(positions, b);
        if (!edgeBounds.makeEmpty().expandByPoint(from).expandByPoint(to).intersectsBox(bounds)) continue;
        direction.subVectors(to, from); const length = direction.length(); if (length <= .00002) continue;
        const hits = new THREE.Raycaster(from, direction.normalize(), .00001, length - .00001).intersectObject(target, false);
        assert.equal(hits.length, 0, `${id} head edge ${a}/${b} crosses the other face at whisper 6.4`);
      }
    }
  } finally { heads.forEach(head => head.dispose()); }
});

test('actual shoe soles stay above the floor and neither shoes nor head skin overlap throughout the close steps and retreat', async t => {
  const assets = new Map(await Promise.all(['neo', 'neo-office', 'neo-tracking', 'trinity', 'trinity-club'].map(async id => [id, await geometry(id)] as const)));
  const h = setup(t, assets); h.snapshot(0, 'whisper'); await new Promise(resolve => setImmediate(resolve));
  const samples: [ClubGesture['phase'], number][] = [0, .15, .35, .65, .95, 1.25, 1.55, 1.8, 6, 13.9].map(elapsed => ['whisper', elapsed]);
  samples.push(['question', 0], ['reply', 3], ['departing', .4], ['departing', 1], ['departing', 1.48]);
  for (const [phase, elapsed] of samples) {
    h.snapshot(elapsed, phase); h.renderer.update(0, undefined, 0);
    const bodies = ['neo', 'trinity'].map(id => h.renderer.getAgentBody(id)!);
    const heads = bodies.map(body => surface(body.getObjectByName('Anatomical_head_and_hands') as THREE.SkinnedMesh,
      body.getObjectByName('head')!.getWorldPosition(new THREE.Vector3()).y - .25));
    const shoes = bodies.map(body => surface(body.getObjectByName('shoes01') as THREE.SkinnedMesh));
    try {
      for (const [i, id] of ['neo', 'trinity'].entries()) {
        const lowest = Math.min(...shoes[i].points.map(point => point.y));
        assert.ok(lowest >= -.015 && lowest < .12, `${id} needs real sole contact at ${phase} ${elapsed}: ${lowest}`);
        assert.ok(heads[i].points.length > 500, 'head checks must use the delivered skinned geometry');
        for (let vertex = 0; vertex < heads[i].points.length; vertex += 64)
          assert.equal(inside(heads[i].points[vertex], heads[1 - i].mesh), false, `${id} head penetrates the speaker at ${phase} ${elapsed}`);
        for (let vertex = 0; vertex < shoes[i].points.length; vertex += 32)
          assert.equal(inside(shoes[i].points[vertex], shoes[1 - i].mesh), false, `${id} shoes penetrate the other character at ${phase} ${elapsed}`);
      }
    } finally { heads.forEach(head => head.dispose()); shoes.forEach(shoe => shoe.dispose()); }
  }
});

test('a paused reload restores the actual head and foot pose at the middle of a step', async t => {
  const assets = new Map(await Promise.all(['neo', 'neo-office', 'neo-tracking', 'trinity', 'trinity-club'].map(async id => [id, await geometry(id)] as const)));
  const h = setup(t, assets); h.snapshot(.9, 'whisper'); await new Promise(resolve => setImmediate(resolve)); h.renderer.update(0, undefined, 0);
  const pose = () => ['neo', 'trinity'].flatMap(id => {
    const body = h.renderer.getAgentBody(id)!; body.updateWorldMatrix(true, true);
    return ['head', 'ankle_R', 'ankle_L'].map(name => ({ position: body.getObjectByName(name)!.getWorldPosition(new THREE.Vector3()),
      rotation: body.getObjectByName(name)!.getWorldQuaternion(new THREE.Quaternion()) }));
  });
  const before = pose(); h.renderer.update(.2, undefined, 0);
  h.renderer.removeAgent('neo'); h.renderer.removeAgent('trinity'); h.snapshot(.9, 'whisper');
  await new Promise(resolve => setImmediate(resolve)); h.renderer.update(0, undefined, 0);
  pose().forEach((joint, i) => {
    assert.ok(joint.position.distanceTo(before[i].position) < .001, 'loading cannot restart the planted/swinging foot or the head lean');
    assert.ok(Math.abs(joint.rotation.dot(before[i].rotation)) > .99999, 'loading restores the saved shoe and head orientation');
  });
});

test('the close pose releases Neo’s feet when he walks away while Trinity is still departing', async t => {
  const assets = new Map(await Promise.all(['neo', 'neo-office', 'neo-tracking', 'trinity', 'trinity-club'].map(async id => [id, await geometry(id)] as const)));
  const h = setup(t, assets); h.snapshot(.7, 'departing'); await new Promise(resolve => setImmediate(resolve));
  const neo = h.renderer.getAgentState('neo')!; neo.currentAction = null; neo.position = filmPosition('film_white_rabbit_club', 9, -3);
  h.renderer.updateAgent('neo', neo); h.renderer.setPlayer('neo');
  const group = h.renderer.getAgent('neo')!; group.position.set(neo.position.x, neo.position.y, neo.position.z);
  h.renderer.setPlayerMotion({ speed: 3, grounded: true, verticalVelocity: 0, turn: 0 });
  h.renderer.update(.1);
  const feet = () => ['R', 'L'].map(side => h.renderer.getAgentBody('neo')!.getObjectByName(`ankle_${side}`)!.getWorldPosition(new THREE.Vector3()));
  const walking = feet(); h.actor.currentAction = null; h.renderer.updateAgent('trinity', h.actor);
  const entry = (h.renderer as unknown as { agents: Map<string, { rig: { motion: ReturnType<typeof newMotion> } }> }).agents.get('neo')!;
  entry.rig.motion = newMotion(); h.renderer.update(.1);
  feet().forEach((foot, i) => assert.ok(foot.distanceTo(walking[i]) < .001, 'departing Trinity cannot change Neo’s ordinary walking gait or anchor his shoes to the meeting point'));
});

test('a paused club load restores the exact saved root and heading and does not replay a stale approach', t => {
  const h = setup(t); h.snapshot(2); h.renderer.update(0); h.snapshot(2.5); h.renderer.update(.1);
  h.renderer.update(.1, undefined, 0);
  const root = clubRoot({ phase: 'approaching', elapsed: 2.5 }, 'trinity'), target = filmPosition('film_white_rabbit_club', root.x, root.z);
  assert.ok(h.renderer.getAgent('trinity')!.position.distanceTo(new THREE.Vector3(target.x, target.y, target.z)) < .001);
  assert.ok(Math.abs(h.renderer.getAgentBody('trinity')!.rotation.y - root.yaw) < .001);
  const paused = h.renderer.getAgent('trinity')!.position.clone();
  for (let i = 0; i < 10; i++) h.renderer.update(.1, undefined, 0);
  assert.deepEqual(h.renderer.getAgent('trinity')!.position, paused);
  h.snapshot(.8, 'whisper'); h.renderer.update(0, undefined, 0);
  const loaded = clubRoot({ phase: 'whisper', elapsed: .8 }, 'trinity');
  assert.deepEqual(h.renderer.getAgent('trinity')!.position.toArray(), Object.values(filmPosition('film_white_rabbit_club', loaded.x, loaded.z)));
  assert.ok(Math.abs(h.renderer.getAgentBody('trinity')!.rotation.y - loaded.yaw) < .001, 'loading a different phase cannot retain the walking turn');
});

test('Trinity finishes the final approach and return steps before settling into the waiting snapshot', t => {
  const h = setup(t);
  for (const [moving, waiting] of [['approaching', 'ready'], ['departing', 'done']] as const) {
    h.snapshot(7.5, moving); h.renderer.update(0);
    h.snapshot(0, waiting);
    for (let frame = 1; frame <= 5; frame++) {
      h.renderer.update(.1);
      const root = clubRoot({ phase: moving, elapsed: 7.5 + frame * .1 }, 'trinity'), target = filmPosition('film_white_rabbit_club', root.x, root.z);
      assert.ok(h.renderer.getAgent('trinity')!.position.distanceTo(new THREE.Vector3(target.x, target.y, target.z)) < .001,
        `${moving} frame ${frame}: entering ${waiting} cannot skip the last walking segment`);
    }
    h.renderer.update(.1); const end = clubRoot({ phase: waiting, elapsed: 0 }, 'trinity');
    assert.ok(h.renderer.getAgent('trinity')!.position.distanceTo(new THREE.Vector3(...Object.values(filmPosition('film_white_rabbit_club', end.x, end.z)))) < .001);
  }
});

test('responding immediately or receiving another waiting packet does not skip Trinity’s last approach step', t => {
  const h = setup(t); h.snapshot(7.5); h.renderer.update(0); h.snapshot(0, 'ready'); h.renderer.update(.1);
  h.snapshot(0, 'ready'); h.renderer.update(.1); h.snapshot(.1, 'introduction'); h.renderer.update(.1);
  const root = clubRoot({ phase: 'approaching', elapsed: 7.8 }, 'trinity'), target = filmPosition('film_white_rabbit_club', root.x, root.z);
  assert.ok(h.renderer.getAgent('trinity')!.position.distanceTo(new THREE.Vector3(target.x, target.y, target.z)) < .001,
    'an early response must not restart or truncate the final segment');
  h.renderer.update(.2); const end = clubRoot({ phase: 'introduction', elapsed: .1 }, 'trinity');
  assert.ok(h.renderer.getAgent('trinity')!.position.distanceTo(new THREE.Vector3(...Object.values(filmPosition('film_white_rabbit_club', end.x, end.z)))) < .001);
});

test('pausing during a terminal route segment restores the saved waiting pose without replaying that segment', t => {
  const h = setup(t);
  for (const [moving, waiting] of [['approaching', 'ready'], ['departing', 'done']] as const) {
    h.snapshot(7.5, moving); h.renderer.update(0); h.snapshot(0, waiting); h.renderer.update(.1);
    h.renderer.update(.1, undefined, 0); const root = clubRoot({ phase: waiting, elapsed: 0 }, 'trinity');
    assert.deepEqual(h.renderer.getAgent('trinity')!.position.toArray(), Object.values(filmPosition('film_white_rabbit_club', root.x, root.z)));
    const turn = h.renderer.getAgentBody('trinity')!.rotation.y - root.yaw;
    assert.ok(Math.abs(Math.atan2(Math.sin(turn), Math.cos(turn))) < .001);
    const paused = h.renderer.getAgent('trinity')!.position.clone(); h.renderer.update(.1);
    assert.deepEqual(h.renderer.getAgent('trinity')!.position, paused, 'continuing cannot replay the unfinished rendered segment');
  }
});
