import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { APARTMENT_ROOM, MORNING, morningRoot, morningWakePose, type MorningRoutine, type FilmJourney } from '@auto_matrix/shared';
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
async function actor() {
  const assets = new Map(await Promise.all(['neo', 'neo-office', 'neo-tracking'].map(async id => [id, await geometry(id)] as const)));
  const models = new HeroModels(new THREE.Texture(), new THREE.Texture());
  (models as unknown as { load: (id: string) => Promise<NonNullable<ReturnType<typeof assets.get>>> }).load = async id => assets.get(id)!;
  const rig = (await models.create('neo'))!, origin = new THREE.Vector3(APARTMENT_ROOM.center.x, 0, APARTMENT_ROOM.center.z);
  const frame = (morning: MorningRoutine) => {
    const root = morningRoot(morning), motion = newMotion();
    rig.root.position.copy(origin).add(new THREE.Vector3(root.x, 0, root.z)); rig.root.rotation.y = root.yaw;
    const input = { speed: 0, grounded: true, verticalVelocity: 0, turn: 0, homeClothes: true, morning, wakeCall: morningWakePose(morning) };
    models.animate(rig, advanceMotion(motion, input, 0), motion, input, 0); rig.root.updateMatrixWorld(true);
  };
  return { models, rig, origin, frame };
}

test('the delivered sleeping Neo rests above the mattress and remains supported while sitting and standing', async () => {
  const h = await actor();
  try {
    for (const morning of [{ phase: 'sleeping', elapsed: 0 }, { phase: 'alarm', elapsed: 8 },
      ...Array.from({ length: 29 }, (_, i) => ({ phase: 'rising', elapsed: i * .2 }))] as MorningRoutine[]) {
      h.frame(morning); let sole = Infinity;
      for (const { mesh } of h.rig.wardrobe) {
        if (!(mesh instanceof THREE.SkinnedMesh) || !mesh.visible) continue;
        mesh.skeleton.update();
        const indices = mesh.geometry.attributes.skinIndex, weights = mesh.geometry.attributes.skinWeight;
        const used = mesh.geometry.index ? new Set(Array.from(mesh.geometry.index.array)) : Array.from({ length: mesh.geometry.attributes.position.count }, (_, i) => i);
        for (const i of used) {
          const point = mesh.localToWorld(mesh.getVertexPosition(i, new THREE.Vector3())).sub(h.origin);
          assert.ok(point.toArray().every(Number.isFinite), 'the delivered body must stay finite');
          assert.ok(point.y > -.015, `${morning.phase} ${morning.elapsed}: ${mesh.name} sinks below the floor: ${point.toArray()}`);
          if (mesh.name === 'shoes01') sole = Math.min(sole, point.y);
          if (point.x > 7.23 && point.x < 13.16 && point.z > -13.8 && point.z < -4.2)
            assert.ok(point.y > 1.37 || point.y < .77, `${morning.phase} ${morning.elapsed}: ${mesh.name} is inside the mattress: ${point.toArray()}`);
          if (morning.phase !== 'rising' && mesh.name === 'Anatomical_head_and_hands')
            for (let j = 0; j < 4; j++) if (weights.getComponent(i, j) > .5 && mesh.skeleton.bones[indices.getComponent(i, j)].name === 'head')
              assert.ok(point.y > 1.38, `the sleeping head is buried below the bedding: ${point.toArray()}`);
        }
      }
      if (morning.phase === 'rising' && morning.elapsed >= 2.6) assert.ok(sole < .05, `at least one shoe must support Neo: ${morning.elapsed}, sole ${sole}`);
    }
  } finally { h.models.dispose(); }
});

test('the real right hand touches the rendered alarm button when it is depressed', async t => {
  const previous = globalThis.document;
  globalThis.document = { createElement: () => ({ width: 0, height: 0, getContext: () => ({ fillRect() {}, fillText() {} }) }) } as unknown as Document;
  t.mock.method(THREE.TextureLoader.prototype, 'load', () => new THREE.Texture());
  const h = await actor(), root = new THREE.Group(); root.position.copy(h.origin); const room = new ApartmentSetRenderer(root);
  try {
    const morning = { phase: 'stopping' as const, elapsed: .55 }; h.frame(morning);
    room.update({ scene: 'm1_morning', morning } as FilmJourney, 9250); root.updateMatrixWorld(true);
    const button = root.getObjectByName('apartment-alarm-button') as THREE.Mesh; button.geometry.computeBoundingBox();
    const inverse = button.matrixWorld.clone().invert(), skin = h.rig.root.getObjectByName('Anatomical_head_and_hands') as THREE.SkinnedMesh;
    skin.skeleton.update(); let gap = Infinity;
    const indices = skin.geometry.attributes.skinIndex, weights = skin.geometry.attributes.skinWeight;
    for (let i = 0; i < skin.geometry.attributes.position.count; i++) for (let j = 0; j < 4; j++) if (weights.getComponent(i, j) > .5) {
      const name = skin.skeleton.bones[indices.getComponent(i, j)].name;
      if (name.endsWith('_R') && /^(wrist|finger)/.test(name)) {
        const point = skin.localToWorld(skin.getVertexPosition(i, new THREE.Vector3())).applyMatrix4(inverse);
        gap = Math.min(gap, button.geometry.boundingBox!.distanceToPoint(point));
      }
    }
    assert.ok(gap < .035, `the visible skin cannot hover away from the physical button: ${gap}`);
  } finally { room.dispose(); h.models.dispose(); globalThis.document = previous; }
});

test('V follows the actual morning eyes throughout rising and preserves voluntary looking', async t => {
  class InputTarget extends EventTarget { matches() { return false; } }
  const window = new InputTarget(), canvas = new InputTarget(), document = Object.assign(new InputTarget(), { pointerLockElement: canvas, hidden: false, exitPointerLock() {} });
  const previous = ['window', 'document'].map(key => Object.getOwnPropertyDescriptor(globalThis, key)); Object.assign(globalThis, { window, document });
  const h = await actor(), group = new THREE.Group(); h.rig.root.position.y = -1; group.add(h.rig.root);
  const world = new WorldState(); new AgentManager(world).initializeAllAgents(); const neo = world.agents.get('neo')!;
  const camera = new THREE.PerspectiveCamera(57, 16 / 9, .5, 5000), controls = new PlayerControls(canvas as unknown as HTMLCanvasElement, camera, () => {}, () => {});
  t.after(() => { controls.dispose(); h.models.dispose(); ['window', 'document'].forEach((key, i) => {
    if (previous[i]) Object.defineProperty(globalThis, key, previous[i]!); else Reflect.deleteProperty(globalThis, key);
  }); });
  const set = (morning: MorningRoutine) => {
    const root = morningRoot(morning); neo.position = { x: h.origin.x + root.x, y: 1, z: h.origin.z + root.z }; neo.rotation = root.yaw;
    neo.currentLocation = 'film_anderson_flat';
    neo.currentAction = { type: 'idle', parameters: { morning, wakeCall: morningWakePose(morning) }, startedAt: 0, duration: 1, progress: 0 };
  };
  set({ phase: 'alarm', elapsed: 0 }); controls.possess(neo);
  for (let i = 0; i < 3; i++) {
    const motion = newMotion(); controls.update(.05, neo, group, false);
    h.models.animate(h.rig, advanceMotion(motion, controls.motion, 0), motion, controls.motion, 0); group.updateMatrixWorld(true);
  }
  window.dispatchEvent(Object.assign(new Event('keydown'), { code: 'KeyV', repeat: false }));
  window.dispatchEvent(Object.assign(new Event('keyup'), { code: 'KeyV' }));
  for (const morning of [{ phase: 'stopping', elapsed: .55 }, ...[0, .8, 1.6, 2.6, 3.4, 4.2, 5.6].map(elapsed => ({ phase: 'rising', elapsed }))] as MorningRoutine[]) {
    set(morning); const motion = newMotion();
    for (let i = 0; i < 3; i++) {
      controls.update(.05, neo, group, false); h.models.animate(h.rig, advanceMotion(motion, controls.motion, 0), motion, controls.motion, 0); group.updateMatrixWorld(true);
    }
    const eye = h.rig.bones.get('head')!.localToWorld(new THREE.Vector3(0, .1, .23));
    assert.ok(camera.position.distanceTo(eye) < .025, `${morning.phase} ${morning.elapsed}: first person must track the delivered eye: camera ${camera.position.toArray()}, eye ${eye.toArray()}`);
    const faceMeshes = h.rig.wardrobe.filter(part => part.mesh.visible && (part.hair || part.mesh.material.name === 'Eyes' || part.mesh.name === 'Anatomical_head_and_hands')).map(part => part.mesh);
    const face = new THREE.Raycaster(camera.position, camera.getWorldDirection(new THREE.Vector3()), .06, .8).intersectObjects(faceMeshes, false);
    assert.equal(face.length, 0, `${morning.phase} ${morning.elapsed}: Neo’s own face cannot block his first-person view`);
    if (morning.phase === 'stopping') {
      camera.updateMatrixWorld(); const clock = new THREE.Vector3(h.origin.x + MORNING.alarm.x, MORNING.alarm.y + .255, h.origin.z + MORNING.alarm.z).project(camera);
      assert.ok(Math.abs(clock.x) < .7 && Math.abs(clock.y) < .7 && clock.z > -1 && clock.z < 1, 'V initially shows the bedside interaction rather than looking into the reclining shirt');
    }
  }
  const direction = camera.getWorldDirection(new THREE.Vector3());
  document.dispatchEvent(Object.assign(new Event('mousemove'), { movementX: 110, movementY: -30 })); controls.update(.05, neo, group, false);
  assert.ok(camera.getWorldDirection(new THREE.Vector3()).distanceTo(direction) > .1, 'the saved performance must retain player looking');
});

test('the first-person morning actually draws Neo’s pressing hand and releases the body view afterwards', t => {
  const previous = globalThis.document;
  const ctx = { fillRect() {}, fillText() {}, strokeRect() {}, createRadialGradient: () => ({ addColorStop() {} }),
    createImageData: (w: number, h: number) => ({ data: new Uint8ClampedArray(w * h * 4) }), putImageData() {} };
  globalThis.document = { createElement: () => ({ width: 0, height: 0, getContext: () => ctx }) } as unknown as Document;
  t.mock.method(THREE.TextureLoader.prototype, 'load', () => new THREE.Texture());
  t.mock.method(GLTFLoader.prototype, 'loadAsync', () => new Promise(() => {}));
  const world = new WorldState(); new AgentManager(world).initializeAllAgents(); const neo = world.agents.get('neo')!;
  const renderer = new AgentRenderer(new THREE.Scene()), morning = { phase: 'stopping' as const, elapsed: .55 };
  const root = morningRoot(morning); neo.position = { x: APARTMENT_ROOM.center.x + root.x, y: 1, z: APARTMENT_ROOM.center.z + root.z };
  neo.currentLocation = 'film_anderson_flat'; neo.rotation = root.yaw;
  neo.currentAction = { type: 'idle', parameters: { morning, wakeCall: morningWakePose(morning) }, startedAt: 0, duration: 1, progress: 0 };
  try {
    renderer.updateAgent('neo', neo); renderer.setPlayer('neo', true);
    renderer.setPlayerMotion({ speed: 0, grounded: true, verticalVelocity: 0, turn: 0, morning, wakeCall: morningWakePose(morning) });
    renderer.update(0, undefined, 0);
    assert.ok(renderer.getAgentBody('neo')!.visible, 'V cannot turn the actual reaching body off');
    neo.currentAction = null; renderer.updateAgent('neo', neo);
    renderer.setPlayerMotion({ speed: 0, grounded: true, verticalVelocity: 0, turn: 0 }); renderer.update(0, undefined, 0);
    assert.equal(renderer.getAgentBody('neo')!.visible, false, 'ordinary first-person hiding resumes after the performance');
  } finally { renderer.dispose(); globalThis.document = previous; }
});
