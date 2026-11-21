import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { APARTMENT, APARTMENT_BOOK, APARTMENT_ROOM, apartmentPaymentPose, type ApartmentGesture, type FilmJourney } from '@auto_matrix/shared';
import { HeroModels } from '../packages/client/src/agents/HeroModel.js';
import { advanceMotion, newMotion } from '../packages/client/src/agents/CharacterMotion.js';
import { ApartmentSetRenderer } from '../packages/client/src/engine/ApartmentSetRenderer.js';
import { PlayerControls } from '../packages/client/src/player/PlayerControls.js';
import { AgentRenderer } from '../packages/client/src/agents/AgentRenderer.js';
import { WorldState } from '../packages/server/src/world/WorldState.js';
import { AgentManager } from '../packages/server/src/agents/AgentManager.js';

async function geometry(id: string) {
  const glb = await readFile(new URL(`../packages/client/public/assets/characters/${id}.glb`, import.meta.url));
  const length = glb.readUInt32LE(12), document = JSON.parse(glb.subarray(20, 20 + length).toString());
  for (const material of document.materials) { delete material.pbrMetallicRoughness.baseColorTexture; delete material.normalTexture; }
  document.images = []; document.textures = [];
  const json = Buffer.from(JSON.stringify(document)), padded = Buffer.alloc(Math.ceil(json.length / 4) * 4, 32); json.copy(padded);
  const bin = glb.subarray(20 + length), result = Buffer.alloc(20 + padded.length + bin.length);
  result.writeUInt32LE(0x46546c67, 0); result.writeUInt32LE(2, 4); result.writeUInt32LE(result.length, 8);
  result.writeUInt32LE(padded.length, 12); result.writeUInt32LE(0x4e4f534a, 16); padded.copy(result, 20); bin.copy(result, 20 + padded.length);
  return new GLTFLoader().parseAsync(result.buffer.slice(result.byteOffset, result.byteOffset + result.byteLength), '');
}

test('the apartment visitors keep their fitted clothes and hair on their own rigs', async t => {
  const previous = globalThis.document;
  globalThis.document = { createElement: () => ({ width: 0, height: 0, getContext: () => ({
    beginPath() {}, ellipse() {}, fill() {}, stroke() {}, arc() {},
  }) }) } as unknown as Document;
  const assets = new Map(await Promise.all(['choi', 'dujour'].map(async id => [id, await geometry(id)] as const)));
  const models = new HeroModels(new THREE.Texture(), new THREE.Texture());
  (models as unknown as { load: (id: string) => Promise<NonNullable<ReturnType<typeof assets.get>>> }).load = async id => assets.get(id)!;
  t.after(() => { models.dispose(); globalThis.document = previous; });
  await t.test('Choi wears his own short jacket', async () => {
    const rig = (await models.create('neo', undefined, 'choi'))!;
    assert.ok(rig.root.getObjectByName('Tailored_coat_upper'));
    assert.equal(rig.panels.length, 0, 'Neo’s long coat tails cross Choi’s trousers');
  });
  await t.test('Choi’s lighter brown hair retains the shared cutout and leaves the donor unchanged', async () => {
    const rig = (await models.create('neo', undefined, 'choi'))!, generic = (await models.create('choi'))!;
    const hair = (root: THREE.Object3D) => root.getObjectByName('short04') as THREE.SkinnedMesh<THREE.BufferGeometry, THREE.MeshStandardMaterial>;
    const fitted = hair(rig.root), donor = hair(assets.get('choi')!.scene), ordinary = hair(generic.root);
    assert.ok(fitted.material.color.r > fitted.material.color.g && fitted.material.color.g > fitted.material.color.b);
    assert.ok(fitted.material.color.r >= donor.material.color.r * 5, 'lift the dark hair atlas enough for the brown tone to read at the doorway');
    assert.equal(fitted.material.alphaTest, donor.material.alphaTest);
    for (const name of ['position', 'uv']) {
      const fittedData = fitted.geometry.getAttribute(name).array, originalData = donor.geometry.getAttribute(name).array;
      assert.ok(fittedData.length === originalData.length && fittedData.every((value, index) => value === originalData[index]), name);
    }
    assert.ok(ordinary.material.color.equals(donor.material.color));
  });
  await t.test('Choi’s goatee is painted on his own skinned face', async () => {
    const rig = (await models.create('neo', undefined, 'choi'))!;
    const generic = (await models.create('choi'))!;
    const skin = (model: typeof rig) => (model.root.getObjectByName('Anatomical_head_and_hands') as THREE.SkinnedMesh<THREE.BufferGeometry, THREE.MeshStandardMaterial>).material;
    const shader = { ...THREE.ShaderLib.standard, uniforms: {} } as THREE.WebGLProgramParametersWithUniforms;
    skin(rig).onBeforeCompile(shader, {} as THREE.WebGLRenderer);
    assert.match(shader.vertexShader, /choiFace = position/, 'the facial hair follows the existing skin without a second surface');
    assert.match(shader.fragmentShader, /diffuseColor\.rgb = mix\(diffuseColor\.rgb, goateeColor/);
    assert.doesNotMatch(skin(generic).customProgramCacheKey(), /choi-goatee/, 'the same source mesh can be used without Choi’s costume');
  });
  await t.test('Dujour keeps her dark hair', async () => {
    const rig = (await models.create('trinity', undefined, 'dujour'))!;
    const hair = rig.root.getObjectByName('short04') as THREE.SkinnedMesh<THREE.BufferGeometry, THREE.MeshStandardMaterial>;
    const authored = assets.get('dujour')!.scene.getObjectByName('short04') as typeof hair;
    assert.ok(hair.material.color.equals(authored.material.color));
    const shader = { fragmentShader: '#include <map_fragment>' } as THREE.WebGLProgramParametersWithUniforms;
    hair.material.onBeforeCompile(shader, {} as THREE.WebGLRenderer);
    assert.equal(shader.fragmentShader, '#include <map_fragment>', 'the hair samples its authored dark material without lightening the color');
  });
  await t.test('Dujour has a high bun and a fitted fringe on the apartment rig', async () => {
    const rig = (await models.create('trinity', undefined, 'dujour'))!;
    const head = rig.bones.get('head')!;
    const bun = head.getObjectByName('dujour-hair-bun');
    const fringe = head.getObjectByName('dujour-fringe');
    assert.ok(bun instanceof THREE.Mesh && fringe instanceof THREE.Mesh);
    assert.equal(bun.material, fringe.material, 'the finished hair uses one surface');
    const skin = rig.root.getObjectByName('Anatomical_head_and_hands') as THREE.SkinnedMesh;
    const surface = new THREE.Mesh(skin.geometry, new THREE.MeshBasicMaterial({ side: THREE.DoubleSide }));
    const rest = assets.get('dujour')!.parser.json.extras.head as [number, number, number];
    const positions = fringe.geometry.getAttribute('position');
    try {
      for (let i = 0; i < positions.count; i++) {
        const position = new THREE.Vector3().fromBufferAttribute(positions, i).add(new THREE.Vector3(...rest));
        const ray = new THREE.Raycaster(position.clone().setZ(1), new THREE.Vector3(0, 0, -1), 0, 1);
        const [scalp] = ray.intersectObject(surface);
        assert.ok(scalp && position.z - scalp.point.z >= .004, 'fringe roots stay outside the real forehead');
        assert.ok(position.y > 4.01, 'the lower edge stays above the brows');
      }
    } finally { surface.material.dispose(); }
    bun.geometry.computeBoundingBox();
    assert.ok(bun.position.y + bun.geometry.boundingBox!.max.y * bun.scale.y > .48, 'the bun rises above the crown');
  });
  await t.test('Dujour’s silver collar sits just outside the actual neck', async () => {
    const rig = (await models.create('trinity', undefined, 'dujour'))!;
    const collar = rig.bones.get('chest')!.getObjectByName('dujour-silver-collar');
    assert.ok(collar instanceof THREE.Mesh && collar.material instanceof THREE.MeshStandardMaterial && collar.material.metalness > .5);
    const skin = rig.root.getObjectByName('Anatomical_head_and_hands') as THREE.SkinnedMesh;
    const surface = new THREE.Mesh(skin.geometry, new THREE.MeshBasicMaterial({ side: THREE.DoubleSide }));
    rig.root.updateMatrixWorld(true);
    try {
      for (const [point, direction] of [
        [new THREE.Vector3(0, 3.61, 1), new THREE.Vector3(0, 0, -1)],
        [new THREE.Vector3(1, 3.61, .068), new THREE.Vector3(-1, 0, 0)],
      ]) {
        const ray = new THREE.Raycaster(point, direction);
        const [outer] = ray.intersectObject(collar), [neck] = ray.intersectObject(surface);
        assert.ok(outer && neck && neck.distance - outer.distance > .008 && neck.distance - outer.distance < .07,
          'the choker should cover the neck without a visible gap');
      }
    } finally { surface.material.dispose(); }
  });
});

test('Neo pulls open the real 101 door without the moving leaf or his arm crossing his body', async t => {
  const previous = globalThis.document;
  globalThis.document = { createElement: () => ({ width: 0, height: 0, getContext: () => ({ fillRect() {}, fillText() {} }) }) } as unknown as Document;
  t.mock.method(THREE.TextureLoader.prototype, 'load', () => new THREE.Texture());
  const assets = new Map(await Promise.all(['neo', 'neo-office', 'neo-tracking'].map(async id => [id, await geometry(id)] as const)));
  const models = new HeroModels(new THREE.Texture(), new THREE.Texture());
  (models as unknown as { load: (id: string) => Promise<NonNullable<ReturnType<typeof assets.get>>> }).load = async id => assets.get(id)!;
  const origin = new THREE.Vector3(APARTMENT_ROOM.center.x, 0, APARTMENT_ROOM.center.z);
  const rig = (await models.create('neo'))!, root = new THREE.Group(); root.position.copy(origin);
  const room = new ApartmentSetRenderer(root);
  const door = root.getObjectByName('apartment-101-door')!;
  const panel = door.children[0] as THREE.Mesh;
  panel.geometry.computeBoundingBox();
  const solid = panel.geometry.boundingBox!.clone().expandByScalar(-.02);
  const handle = door.children.find(object => object instanceof THREE.Mesh && object.geometry instanceof THREE.SphereGeometry && object.position.z < 0)!;
  const frame = (elapsed: number) => {
    const contact: ApartmentGesture = { role: 'neo', phase: 'opening', elapsed, propMotion: 'minidisc' };
    rig.root.position.copy(origin).add(new THREE.Vector3(APARTMENT.openDoor.x, 0, APARTMENT.openDoor.z));
    const motion = newMotion(), input = { speed: 0, grounded: true, verticalVelocity: 0, turn: 0, homeClothes: true, contact };
    models.animate(rig, advanceMotion(motion, input, 0), motion, input, 0); rig.root.updateMatrixWorld(true);
    room.update({ scene: 'm1_wake_up', contact } as FilmJourney, 22000); root.updateMatrixWorld(true);
  };
  try {
    const inverse = new THREE.Matrix4(), point = new THREE.Vector3();
    for (const elapsed of Array.from({ length: 61 }, (_, i) => i * APARTMENT.opening / 60)) {
      frame(elapsed); inverse.copy(panel.matrixWorld).invert();
      let sole = Infinity;
      for (const { mesh } of rig.wardrobe) if (mesh.visible && mesh instanceof THREE.SkinnedMesh) {
        mesh.skeleton.update();
        for (let i = 0; i < mesh.geometry.attributes.position.count; i++) {
          mesh.getVertexPosition(i, point).applyMatrix4(mesh.matrixWorld);
          if (mesh.name === 'shoes01') sole = Math.min(sole, point.y);
          point.applyMatrix4(inverse);
          if (solid.containsPoint(point)) assert.fail(`the moving door cuts through ${mesh.name} at ${elapsed}s: ${point.toArray()}`);
        }
      }
      assert.ok(sole > -.025 && sole < .065, `one shoe must stay planted while Neo steps aside at ${elapsed}s: ${sole}`);
    }
    for (const elapsed of [.32, .42, .53, .56]) {
      frame(elapsed);
      const grasp = handle.getWorldPosition(point);
      const wrist = rig.bones.get('wrist_R')!, joint = wrist.getWorldPosition(new THREE.Vector3());
      const elbow = rig.bones.get('elbow_R')!.getWorldPosition(new THREE.Vector3());
      const palm = wrist.localToWorld(new THREE.Vector3(.065, -.17, .01));
      assert.ok(palm.distanceTo(grasp) < .18, `the right hand must pull the actual handle at ${elapsed}s: ${palm.distanceTo(grasp)}`);
      assert.ok(palm.sub(joint).normalize().dot(joint.sub(elbow).normalize()) > .2, `the reaching wrist must follow the forearm at ${elapsed}s`);
    }
    frame(1.189);
    const chest = rig.bones.get('chest')!, wrist = rig.bones.get('wrist_R')!;
    const wristSide = chest.worldToLocal(wrist.getWorldPosition(point)).x;
    assert.ok(wristSide < -.32, `the released hand must stay on the right side of Neo's torso: ${wristSide}`);
  } finally { room.dispose(); models.dispose(); globalThis.document = previous; }
});

test('the actual Neo carries the collected cartridge into the handover and the disc remains continuous across ownership transfer', async () => {
  const assets = new Map(await Promise.all(['neo', 'neo-office', 'neo-tracking', 'choi'].map(async id => [id, await geometry(id)] as const)));
  const models = new HeroModels(new THREE.Texture(), new THREE.Texture());
  (models as unknown as { load: (id: string) => Promise<NonNullable<ReturnType<typeof assets.get>>> }).load = async id => assets.get(id)!;
  const rigs = { neo: (await models.create('neo'))!, choi: (await models.create('choi'))! };
  const origin = new THREE.Vector3(APARTMENT_ROOM.center.x, 0, APARTMENT_ROOM.center.z);
  const frame = (phase: 'disk' | 'handover' | 'payment', elapsed: number, paid?: boolean) => {
    for (const role of ['neo', 'choi'] as const) {
      const rig = rigs[role], root = role === 'neo' ? phase === 'payment' ? apartmentPaymentPose(elapsed) : APARTMENT.door : APARTMENT.choi;
      rig.root.position.copy(origin).add(new THREE.Vector3(root.x, 0, root.z)); rig.root.rotation.y = root.yaw;
      const contact = { role, phase, elapsed, propMotion: 'minidisc', paid } as ApartmentGesture, motion = newMotion();
      const input = { speed: 0, grounded: true, verticalVelocity: 0, turn: 0, homeClothes: role === 'neo', contact };
      models.animate(rig, advanceMotion(motion, input, 0), motion, input, 0); rig.root.updateMatrixWorld(true);
    }
    return ['neo', 'choi'].flatMap(role => ['disc', 'cash'].flatMap(kind => {
      const prop = rigs[role as keyof typeof rigs].root.getObjectByName('apartment-held-' + kind);
      return prop?.visible ? [{ role, kind, position: prop.getWorldPosition(new THREE.Vector3()), rotation: prop.getWorldQuaternion(new THREE.Quaternion()) }] : [];
    }));
  };
  try {
    assert.equal(frame('disk', 0).length, 1, 'the collected disc must remain visible while Neo walks back');
    const beforeFrame = frame('handover', 2.299), afterFrame = frame('handover', 2.301);
    const before = beforeFrame.filter(prop => prop.kind === 'disc'), after = afterFrame.filter(prop => prop.kind === 'disc');
    assert.equal(before.length, 1); assert.equal(after.length, 1);
    assert.equal(before[0].role, 'neo'); assert.equal(after[0].role, 'choi');
    assert.ok(before[0].position.distanceTo(after[0].position) < .015, `the receiver must take the same physical cartridge without a position jump: ${before[0].position.toArray()} -> ${after[0].position.toArray()}`);
    assert.ok(before[0].rotation.angleTo(after[0].rotation) < .03, 'handing over the cartridge cannot flip its orientation');
    const fingertipGaps = (role: 'neo' | 'choi', side: 'R' | 'L') => {
      const rig = rigs[role], prop = rig.root.getObjectByName('apartment-held-disc')!;
      const skin = rig.root.getObjectByName('Anatomical_head_and_hands') as THREE.SkinnedMesh;
      rig.root.updateWorldMatrix(true, true); skin.skeleton.update(); prop.updateWorldMatrix(true, true);
      const triangles: THREE.Triangle[] = [], point = new THREE.Vector3(), nearest = new THREE.Vector3();
      prop.traverse(object => {
        if (!(object instanceof THREE.Mesh)) return;
        const position = object.geometry.getAttribute('position'), index = object.geometry.index;
        for (let i = 0; i < (index?.count ?? position.count); i += 3) {
          const vertex = (j: number) => new THREE.Vector3().fromBufferAttribute(position, index?.getX(j) ?? j).applyMatrix4(object.matrixWorld);
          triangles.push(new THREE.Triangle(vertex(i), vertex(i + 1), vertex(i + 2)));
        }
      });
      const { position, skinIndex, skinWeight } = skin.geometry.attributes;
      return [1, 2, 3, 4, 5].map(finger => {
        const distal = rig.bones.get(`finger${finger}-3_${side}`)!, proximal = rig.bones.get(`finger${finger}-2_${side}`)!;
        const joint = skin.skeleton.bones.indexOf(distal), origin = distal.getWorldPosition(new THREE.Vector3());
        const axis = origin.clone().sub(proximal.getWorldPosition(new THREE.Vector3())).normalize(), tip = new THREE.Vector3();
        let furthest = -Infinity;
        for (let i = 0; i < position.count; i++) {
          for (let k = 0; k < 4; k++) {
            if (skinIndex.getComponent(i, k) !== joint || skinWeight.getComponent(i, k) < .8) continue;
            skin.getVertexPosition(i, point).applyMatrix4(skin.matrixWorld);
            const alongFinger = point.clone().sub(origin).dot(axis);
            if (alongFinger > furthest) { furthest = alongFinger; tip.copy(point); }
            break;
          }
        }
        return triangles.reduce((gap, triangle) => Math.min(gap, triangle.closestPointToPoint(tip, nearest).distanceTo(tip)), Infinity);
      });
    };
    for (const [role, side] of [['neo', 'R'], ['choi', 'L']] as const) {
      frame('handover', role === 'neo' ? 2.299 : 2.301);
      const gaps = fingertipGaps(role, side);
      assert.ok(gaps.slice(2).every(gap => gap < .005), `${role}'s actual middle, ring and little fingertips should contact the cartridge within 5 mm during the handoff: ${gaps}`);
    }
    const cashBefore = beforeFrame.filter(prop => prop.kind === 'cash'), cashAfter = afterFrame.filter(prop => prop.kind === 'cash');
    assert.equal(cashBefore.length, 1); assert.equal(cashAfter.length, 1);
    assert.equal(cashBefore[0].role, 'choi'); assert.equal(cashAfter[0].role, 'neo');
    assert.ok(cashBefore[0].position.distanceTo(cashAfter[0].position) < .015, 'the same cash bundle must pass between the hands without a jump');
    assert.ok(cashBefore[0].rotation.angleTo(cashAfter[0].rotation) < .03, 'payment cannot flip orientation when Neo receives it');
    const tendered = frame('payment', 2.299), received = frame('payment', 2.301);
    assert.deepEqual(tendered.map(({ role, kind }) => [role, kind]), [['choi', 'cash']]);
    assert.deepEqual(received.map(({ role, kind }) => [role, kind]), [['neo', 'cash']]);
    assert.ok(tendered[0].position.distanceTo(received[0].position) < .015);
    assert.ok(tendered[0].rotation.angleTo(received[0].rotation) < .03);
    const cashBounds = new THREE.Box3().setFromObject(rigs.neo.root.getObjectByName('apartment-held-cash')!, true);
    for (const [role, side, direction] of [['neo', 'L', -1], ['choi', 'R', 1]] as const) {
      const rig = rigs[role], palm = rig.bones.get(`wrist_${side}`)!.localToWorld(new THREE.Vector3(.065 * direction, -.17, .01));
      assert.ok((palm.z - received[0].position.z) * direction > .18, `${role} should reach the bundle from their own side`);
      const skin = rig.root.getObjectByName('Anatomical_head_and_hands') as THREE.SkinnedMesh;
      const { position, skinIndex, skinWeight } = skin.geometry.attributes;
      const vertex = new THREE.Vector3();
      for (const finger of [2, 3]) {
        const joint = skin.skeleton.bones.indexOf(rig.bones.get(`finger${finger}-3_${side}`)!);
        let nearest = Infinity;
        for (let i = 0; i < position.count; i++) for (let k = 0; k < 4; k++) {
          if (skinIndex.getComponent(i, k) !== joint || skinWeight.getComponent(i, k) < .8) continue;
          nearest = Math.min(nearest, cashBounds.distanceToPoint(skin.getVertexPosition(i, vertex).applyMatrix4(skin.matrixWorld)));
          break;
        }
        assert.ok(nearest < .045, `${role}'s finger ${finger} should meet the bill bundle: ${nearest}`);
      }
    }
    const withdrawing = frame('payment', 2.85)[0];
    const released = rigs.choi.bones.get('wrist_R')!.localToWorld(new THREE.Vector3(.065, -.17, .01));
    assert.ok(released.z - withdrawing.position.z > .35, 'Choi withdraws the empty hand once Neo has the bills');
    assert.deepEqual(frame('handover', 2.299, true).map(({ role, kind }) => [role, kind]), [['neo', 'disc']]);
    assert.deepEqual(frame('handover', 2.301, true).map(({ role, kind }) => [role, kind]), [['choi', 'disc']]);
    const shoes = rigs.neo.root.getObjectByName('shoes01') as THREE.SkinnedMesh;
    const sole = new THREE.Vector3();
    for (let i = 0; i <= 20; i++) {
      const elapsed = i * .05;
      frame('payment', elapsed);
      let height = Infinity;
      for (let vertex = 0; vertex < shoes.geometry.getAttribute('position').count; vertex++)
        height = Math.min(height, shoes.getVertexPosition(vertex, sole).applyMatrix4(shoes.matrixWorld).y);
      assert.ok(height >= -.025 && height < .06, `one shoe should stay on the floor while stepping toward the payment at ${elapsed}: ${height}`);
    }
  } finally { models.dispose(); }
});

test('first-person apartment interactions track the delivered head without overriding voluntary looking', async t => {
  class InputTarget extends EventTarget { matches() { return false; } }
  const window = new InputTarget(), canvas = new InputTarget(), document = Object.assign(new InputTarget(), { pointerLockElement: canvas, hidden: false, exitPointerLock() {} });
  const previous = ['window', 'document'].map(key => Object.getOwnPropertyDescriptor(globalThis, key)); Object.assign(globalThis, { window, document });
  const assets = new Map(await Promise.all(['neo', 'neo-office', 'neo-tracking'].map(async id => [id, await geometry(id)] as const)));
  const models = new HeroModels(new THREE.Texture(), new THREE.Texture());
  (models as unknown as { load: (id: string) => Promise<NonNullable<ReturnType<typeof assets.get>>> }).load = async id => assets.get(id)!;
  const rig = (await models.create('neo'))!, group = new THREE.Group(); rig.root.position.y = -1; group.add(rig.root);
  const world = new WorldState(); new AgentManager(world).initializeAllAgents(); const neo = world.agents.get('neo')!;
  neo.position = { x: APARTMENT_ROOM.center.x + APARTMENT.book.x, y: 1, z: APARTMENT_ROOM.center.z + APARTMENT.book.z };
  neo.rotation = 0; neo.currentLocation = 'neo_apartment';
  neo.currentAction = { type: 'idle', parameters: { contact: { role: 'neo', phase: 'retrieving', elapsed: 0, propMotion: 'minidisc' } }, startedAt: 0, duration: 1, progress: 0 };
  const camera = new THREE.PerspectiveCamera(57, 16 / 9, .5, 5000), motion = newMotion();
  const controls = new PlayerControls(canvas as unknown as HTMLCanvasElement, camera, () => {}, () => {});
  t.after(() => { controls.dispose(); models.dispose(); ['window', 'document'].forEach((key, i) => {
    if (previous[i]) Object.defineProperty(globalThis, key, previous[i]!); else Reflect.deleteProperty(globalThis, key);
  }); });
  controls.possess(neo); controls.firstPerson = true;
  for (const elapsed of [.2, .5, .8, 1.5, 1.95, 2.6]) {
    (neo.currentAction.parameters.contact as ApartmentGesture).elapsed = elapsed;
    for (let i = 0; i < 3; i++) {
      controls.update(.05, neo, group, false); models.animate(rig, advanceMotion(motion, controls.motion, 0), motion, controls.motion, 0); group.updateMatrixWorld(true);
    }
    camera.updateMatrixWorld();
    const book = new THREE.Vector3(APARTMENT_ROOM.center.x + 6, .2, APARTMENT_ROOM.center.z + APARTMENT_BOOK.z), projected = book.clone().project(camera);
    assert.ok(Math.abs(projected.x) < .8 && Math.abs(projected.y) < .8 && projected.z > -1 && projected.z < 1, `${elapsed}: crouching cannot move the book outside first person: ${projected.toArray()}`);
    const visible = rig.wardrobe.filter(({ mesh }) => { for (let node: THREE.Object3D | null = mesh; node; node = node.parent) if (!node.visible) return false; return true; }).map(({ mesh }) => mesh);
    const ray = new THREE.Raycaster(camera.position, book.clone().sub(camera.position).normalize(), .01, Math.max(.01, camera.position.distanceTo(book) - .2));
    const blockers = ray.intersectObjects(visible, false);
    assert.equal(blockers.length, 0, `${elapsed}: Neo’s own head or chest blocks the floor book: ${blockers.map(hit => hit.object.name)}`);
    if (elapsed === 1.95) {
      const palm = rig.bones.get('wrist_R')!.localToWorld(new THREE.Vector3(.065, -.17, .01));
      const depth = palm.sub(camera.position).dot(camera.getWorldDirection(new THREE.Vector3()));
      assert.ok(depth > camera.near + .02, `the real pickup palm is cut by the near plane: depth ${depth}, near ${camera.near}`);
    }
  }
  const direction = camera.getWorldDirection(new THREE.Vector3());
  document.dispatchEvent(Object.assign(new Event('mousemove'), { movementX: 100, movementY: -40 }));
  controls.update(.05, neo, group, false); camera.updateMatrixWorld();
  assert.ok(camera.getWorldDirection(new THREE.Vector3()).distanceTo(direction) > .1, 'the tracked crouch must preserve voluntary looking');

  neo.position = { x: APARTMENT_ROOM.center.x + APARTMENT.openDoor.x, y: 1, z: APARTMENT_ROOM.center.z + APARTMENT.openDoor.z };
  controls.possess(neo); controls.firstPerson = true;
  const opening: ApartmentGesture = { role: 'neo', phase: 'opening', elapsed: 0, propMotion: 'minidisc' };
  neo.currentAction!.parameters.contact = opening;
  for (const elapsed of [.05, .38, .65, 1.189, 2.23]) {
    opening.elapsed = elapsed;
    for (let i = 0; i < 3; i++) {
      controls.update(.05, neo, group, false); models.animate(rig, advanceMotion(motion, controls.motion, 0), motion, controls.motion, 0); group.updateMatrixWorld(true);
    }
    const eye = rig.bones.get('head')!.localToWorld(new THREE.Vector3(0, .1, .44));
    assert.ok(camera.position.distanceTo(eye) < .02, `${elapsed}: the first-person camera must follow Neo's sidestep with the physical door`);
    assert.ok(camera.near < .1, 'the near plane must leave the grasping hand in view');
    assert.ok(rig.wardrobe.filter(part => part.hair || part.mesh.material.name === 'Eyes').every(part => !part.mesh.visible),
      'Neo must be able to look toward the handle without his own face in the foreground');
  }
});

test('the first-person apartment door draws the actual player body until the pull finishes', t => {
  const previous = globalThis.document;
  const context = { fillRect() {}, fillText() {}, strokeRect() {}, createRadialGradient: () => ({ addColorStop() {} }),
    createImageData: (w: number, h: number) => ({ data: new Uint8ClampedArray(w * h * 4) }), putImageData() {} };
  globalThis.document = { createElement: () => ({ width: 0, height: 0, getContext: () => context }) } as unknown as Document;
  t.mock.method(THREE.TextureLoader.prototype, 'load', () => new THREE.Texture());
  t.mock.method(GLTFLoader.prototype, 'loadAsync', () => new Promise(() => {}));
  const world = new WorldState(); new AgentManager(world).initializeAllAgents(); const neo = world.agents.get('neo')!;
  neo.currentLocation = 'neo_apartment';
  const renderer = new AgentRenderer(new THREE.Scene());
  t.after(() => { renderer.dispose(); globalThis.document = previous; });
  renderer.updateAgent('neo', neo); renderer.setPlayer('neo', true);
  for (const phase of ['opening', 'door', 'book'] as const) {
    const contact = { role: 'neo' as const, phase, elapsed: .48 };
    renderer.setPlayerMotion({ speed: 0, grounded: true, verticalVelocity: 0, turn: 0, contact });
    renderer.update(0, undefined, 0);
    assert.equal(renderer.getAgentBody('neo')!.visible, phase === 'opening', 'the first-person player must be able to see the actual hand on the knob');
  }
});

test('the actual home body picks up the floor cartridge without teleporting the prop, sinking its shoes or clipping the bed', async t => {
  const previous = globalThis.document;
  globalThis.document = { createElement: () => ({ width: 0, height: 0, getContext: () => ({ fillRect() {}, fillText() {} }) }) } as unknown as Document;
  t.mock.method(THREE.TextureLoader.prototype, 'load', () => new THREE.Texture());
  const assets = new Map(await Promise.all(['neo', 'neo-office', 'neo-tracking'].map(async id => [id, await geometry(id)] as const)));
  const models = new HeroModels(new THREE.Texture(), new THREE.Texture());
  (models as unknown as { load: (id: string) => Promise<NonNullable<ReturnType<typeof assets.get>>> }).load = async id => assets.get(id)!;
  const rig = (await models.create('neo'))!, origin = new THREE.Vector3(APARTMENT_ROOM.center.x, 0, APARTMENT_ROOM.center.z);
  const root = new THREE.Group(); root.position.copy(origin); const room = new ApartmentSetRenderer(root);
  const frame = (elapsed: number) => {
    const contact = { role: 'neo', phase: 'retrieving', elapsed, propMotion: 'minidisc' } as ApartmentGesture;
    rig.root.position.copy(origin).add(new THREE.Vector3(APARTMENT.book.x, 0, APARTMENT.book.z)); rig.root.rotation.y = APARTMENT.book.yaw;
    const motion = newMotion(), input = { speed: 0, grounded: true, verticalVelocity: 0, turn: 0, homeClothes: true, contact };
    models.animate(rig, advanceMotion(motion, input, 0), motion, input, 0); rig.root.updateMatrixWorld(true);
    room.update({ scene: 'm1_wake_up', contact } as FilmJourney, 22000); root.updateMatrixWorld(true);
    return [root.getObjectByName('apartment-book-disc')!, rig.root.getObjectByName('apartment-held-disc')!].filter(prop => prop.visible);
  };
  try {
    const before = frame(APARTMENT_BOOK.pickup - .001).map(prop => ({ position: prop.getWorldPosition(new THREE.Vector3()), rotation: prop.getWorldQuaternion(new THREE.Quaternion()) }));
    const after = frame(APARTMENT_BOOK.pickup + .001);
    assert.equal(before.length, 1); assert.equal(after.length, 1, 'the single physical cartridge moves from the cavity into Neo’s hand');
    assert.ok(before[0].position.distanceTo(after[0].getWorldPosition(new THREE.Vector3())) < .03, `Neo must reach the floor cartridge before taking it: ${before[0].position.toArray()} -> ${after[0].getWorldPosition(new THREE.Vector3()).toArray()}`);
    assert.ok(before[0].rotation.angleTo(after[0].getWorldQuaternion(new THREE.Quaternion())) < .03, 'the pickup cannot flip the cartridge');
    const point = new THREE.Vector3(), worldPoint = new THREE.Vector3(), local = new THREE.Vector3();
    const bookSolids: THREE.Mesh[] = [];
    root.getObjectByName('apartment-hollow-book')!.traverse(object => { if (object instanceof THREE.Mesh && object.geometry instanceof THREE.BoxGeometry) { object.geometry.computeBoundingBox(); bookSolids.push(object); } });
    const cartridgeBounds = new THREE.Box3(new THREE.Vector3(-.115, -.0075, -.115), new THREE.Vector3(.115, .0075, .115));
    const samples = Array.from({ length: 64 }, (_, i) => i * .05).sort((a, b) => Math.abs(a - APARTMENT_BOOK.pickup) - Math.abs(b - APARTMENT_BOOK.pickup));
    for (const elapsed of samples) {
      const prop = frame(elapsed)[0]; let sole = Infinity, gripGap = Infinity;
      const leftPalm = rig.bones.get('wrist_L')!.localToWorld(new THREE.Vector3(-.065, -.17, .01));
      const rightPalm = rig.bones.get('wrist_R')!.localToWorld(new THREE.Vector3(.065, -.17, .01));
      if (elapsed >= 1.35 && elapsed <= 2.15) {
        const knee = rig.bones.get('knee_L')!.getWorldPosition(new THREE.Vector3());
        assert.ok(leftPalm.x >= knee.x + .18 && leftPalm.y > knee.y + .05 && leftPalm.z >= knee.z - .3 && leftPalm.distanceTo(knee) < .72,
          `retrieving ${elapsed}: the free palm must stay beside the left knee instead of folding behind the torso`);
      }
      if (elapsed >= .95 && elapsed <= 1.55) {
        const knee = rig.bones.get('knee_R')!.getWorldPosition(new THREE.Vector3());
        assert.ok(rightPalm.z >= knee.z - .68, `retrieving ${elapsed}: the right hand must be forward before reaching for the disc`);
        const wrist = rig.bones.get('wrist_R')!.getWorldPosition(new THREE.Vector3());
        const elbow = rig.bones.get('elbow_R')!.getWorldPosition(new THREE.Vector3());
        assert.ok(rightPalm.clone().sub(wrist).normalize().dot(wrist.sub(elbow).normalize()) > 0,
          `retrieving ${elapsed}: the ready wrist must face along the forearm`);
      }
      assert.ok(rightPalm.distanceTo(leftPalm) > .23, `retrieving ${elapsed}: the two palms cross during the transfer`);
      const solidFrames = bookSolids.map(mesh => ({ mesh, inverse: mesh.matrixWorld.clone().invert(), bounds: mesh.geometry.boundingBox!.clone().expandByScalar(-.0125) }));
      const propInverse = prop.matrixWorld.clone().invert();
      for (const { mesh } of rig.wardrobe) {
        if (!(mesh instanceof THREE.SkinnedMesh)) continue;
        let visible = true; for (let node: THREE.Object3D | null = mesh; node; node = node.parent) if (!node.visible) visible = false;
        if (!visible) continue;
        mesh.skeleton.update();
        const used = mesh.geometry.index ? new Set(Array.from(mesh.geometry.index.array)) : Array.from({ length: mesh.geometry.attributes.position.count }, (_, i) => i);
        for (const i of used) {
          mesh.getVertexPosition(i, point); mesh.localToWorld(point); worldPoint.copy(point); point.sub(origin);
          assert.ok(Number.isFinite(point.x) && Number.isFinite(point.y) && Number.isFinite(point.z), 'retrieval vertices must remain finite');
          if (mesh.name === 'shoes01') sole = Math.min(sole, point.y);
          if (point.y < -.015) assert.fail(`retrieving ${elapsed}: ${mesh.name} vertex ${i} sinks into the floor at ${point.toArray()}`);
          const bed = point.x > 7.12 && point.x < 13.28 && point.z > -13.98 && point.z < -4.02 && point.y > .085 && point.y < 1.38;
          if (bed) assert.fail(`retrieving ${elapsed}: ${mesh.name} vertex ${i} clips the bed at ${point.toArray()}`);
          for (const solid of solidFrames) {
            local.copy(worldPoint).applyMatrix4(solid.inverse);
            if (solid.bounds.containsPoint(local)) assert.fail(`retrieving ${elapsed}: ${mesh.name} vertex ${i} clips the actual book at ${point.toArray()}`);
          }
          local.copy(worldPoint).applyMatrix4(propInverse);
          if (cartridgeBounds.containsPoint(local)) assert.fail(`retrieving ${elapsed}: ${mesh.name} vertex ${i} passes inside the cartridge at ${local.toArray()}`);
          if (mesh.name === 'Anatomical_head_and_hands' && elapsed >= APARTMENT_BOOK.pickup) gripGap = Math.min(gripGap, cartridgeBounds.distanceToPoint(local));
        }
      }
      assert.ok(sole < .035, `retrieving ${elapsed}: the planted real shoes float at ${sole}`);
      if (elapsed >= APARTMENT_BOOK.pickup) assert.ok(gripGap < .035, `retrieving ${elapsed}: the real skin floats ${gripGap} from its cartridge`);
    }
  } finally { room.dispose(); models.dispose(); globalThis.document = previous; }
});
