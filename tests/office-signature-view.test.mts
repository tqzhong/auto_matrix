import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { FILM_SETS, officeClipboardPoint, officePenPoint, officeRecipientRoot, type FilmJourney, type OfficeWorkdayGesture } from '@auto_matrix/shared';
import { HeroModels } from '../packages/client/src/agents/HeroModel.js';
import { advanceMotion, newMotion } from '../packages/client/src/agents/CharacterMotion.js';
import { AgentRenderer } from '../packages/client/src/agents/AgentRenderer.js';
import { OfficeWorkdayRenderer } from '../packages/client/src/engine/OfficeWorkdayRenderer.js';
import { PlayerControls } from '../packages/client/src/player/PlayerControls.js';
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
const context = { fillRect() {}, fillText() {}, strokeRect() {}, createRadialGradient: () => ({ addColorStop() {} }),
  createImageData: (w: number, h: number) => ({ data: new Uint8ClampedArray(w * h * 4) }), putImageData() {} };

test('V keeps the actual signing eyes, hand and stylus in view and restores ordinary rendering afterwards', async t => {
  class InputTarget extends EventTarget { matches() { return false; } }
  const window = new InputTarget(), canvas = new InputTarget(), document = Object.assign(new InputTarget(), { pointerLockElement: canvas, hidden: false, exitPointerLock() {} });
  const previous = ['window', 'document'].map(key => Object.getOwnPropertyDescriptor(globalThis, key)); Object.assign(globalThis, { window, document });
  const assets = new Map(await Promise.all(['neo', 'neo-office', 'neo-tracking'].map(async id => [id, await geometry(id)] as const)));
  const models = new HeroModels(new THREE.Texture(), new THREE.Texture());
  (models as unknown as { load: (id: string) => Promise<NonNullable<ReturnType<typeof assets.get>>> }).load = async id => assets.get(id)!;
  const rig = (await models.create('neo'))!, group = new THREE.Group(); rig.root.position.y = -1; group.add(rig.root);
  const world = new WorldState(); new AgentManager(world).initializeAllAgents(); const neo = world.agents.get('neo')!;
  const center = FILM_SETS.film_metacortex_floor.center;
  const camera = new THREE.PerspectiveCamera(57, 16 / 9, .5, 5000), controls = new PlayerControls(canvas as unknown as HTMLCanvasElement, camera, () => {}, () => {});
  t.after(() => { controls.dispose(); models.dispose(); ['window', 'document'].forEach((key, i) => {
    if (previous[i]) Object.defineProperty(globalThis, key, previous[i]!); else Reflect.deleteProperty(globalThis, key);
  }); });
  const set = (workday: OfficeWorkdayGesture) => {
    const root = officeRecipientRoot(workday); neo.position = { x: center.x + root.x, y: center.y, z: center.z + root.z }; neo.rotation = root.yaw;
    neo.currentLocation = 'film_metacortex_floor';
    neo.currentAction = { type: 'idle', parameters: { workday }, startedAt: 0, duration: 1, progress: 0 };
  };
  const frame = (workday: OfficeWorkdayGesture) => {
    set(workday); const motion = newMotion();
    for (let i = 0; i < 3; i++) {
      controls.update(.05, neo, group, false); models.animate(rig, advanceMotion(motion, controls.motion, 0), motion, controls.motion, 0); group.updateMatrixWorld(true);
    }
  };
  set({ role: 'neo', phase: 'signing', elapsed: 1.9 }); controls.possess(neo); frame({ role: 'neo', phase: 'signing', elapsed: 1.9 });
  const toggle = () => { window.dispatchEvent(Object.assign(new Event('keydown'), { code: 'KeyV', repeat: false })); window.dispatchEvent(Object.assign(new Event('keyup'), { code: 'KeyV' })); };
  toggle();
  for (const elapsed of [1.05, 1.4, 1.9, 2.5, 3.4]) {
    const workday = { role: 'neo' as const, phase: 'signing' as const, elapsed }; frame(workday);
    const eye = rig.bones.get('head')!.localToWorld(new THREE.Vector3(0, .1, .23));
    assert.ok(camera.position.distanceTo(eye) < .025, `signing ${elapsed}: camera must follow the delivered eyes`);
    const faceMeshes = rig.wardrobe.filter(part => part.mesh.visible && (part.hair || part.mesh.material.name === 'Eyes' || part.mesh.name === 'Anatomical_head_and_hands')).map(part => part.mesh);
    assert.equal(new THREE.Raycaster(camera.position, camera.getWorldDirection(new THREE.Vector3()), .06, .65).intersectObjects(faceMeshes, false).length, 0, 'the local face cannot block the signing view');
    if (elapsed < 2.55) {
      camera.updateMatrixWorld(); const tip = new THREE.Vector3(center.x + officePenPoint(workday).x, center.y - 1 + officePenPoint(workday).y, center.z + officePenPoint(workday).z).project(camera);
      assert.ok(Math.abs(tip.x) < .7 && Math.abs(tip.y) < .7 && tip.z > -1 && tip.z < 1, `the actual writing point must be visible: ${tip.toArray()}`);
      const pen = rig.root.getObjectByName('delivery-signature-pen')!;
      assert.ok(pen.visible, 'the shipped rig must draw its held stylus');
      const skin = rig.root.getObjectByName('Anatomical_head_and_hands') as THREE.SkinnedMesh; skin.skeleton.update();
      const indices = skin.geometry.attributes.skinIndex, weights = skin.geometry.attributes.skinWeight;
      let visibleHand = false;
      for (const i of new Set(Array.from(skin.geometry.index!.array))) for (let j = 0; j < 4; j++)
        if (weights.getComponent(i, j) > .5 && /^(wrist|finger).*_R$/.test(skin.skeleton.bones[indices.getComponent(i, j)].name)) {
          const p = skin.localToWorld(skin.getVertexPosition(i, new THREE.Vector3())).project(camera);
          if (Math.abs(p.x) < .9 && Math.abs(p.y) < .9 && p.z > -1 && p.z < 1) visibleHand = true;
        }
      assert.ok(visibleHand, 'visible triangles of the actual right hand must remain inside the signing view');
    }
  }
  const direction = camera.getWorldDirection(new THREE.Vector3());
  document.dispatchEvent(Object.assign(new Event('mousemove'), { movementX: 110, movementY: -30 })); frame({ role: 'neo', phase: 'signing', elapsed: 3.4 });
  assert.ok(camera.getWorldDirection(new THREE.Vector3()).distanceTo(direction) > .1, 'signing must preserve voluntary looking');
  toggle(); frame({ role: 'neo', phase: 'signing', elapsed: 1.9 });
  assert.equal(camera.near, .5); assert.ok(rig.wardrobe.filter(p => p.hair || p.mesh.material.name === 'Eyes').every(p => p.mesh.visible), 'third person restores hair and eyes');
  toggle(); frame({ role: 'neo', phase: 'signature', elapsed: 0 }); frame({ role: 'neo', phase: 'signing', elapsed: 1.9 });
  camera.updateMatrixWorld(); const board = officeClipboardPoint({ phase: 'signing', elapsed: 1.9 });
  const p = new THREE.Vector3(center.x + board.x, center.y - 1 + board.y, center.z + board.z).project(camera);
  assert.ok(Math.abs(p.x) < .7 && Math.abs(p.y) < .7, 'starting the performance in first person also frames the pad');
  neo.currentAction = null; controls.update(.05, neo, group, false);
  assert.equal(camera.near, .5, 'leaving signing restores ordinary first-person clipping');
});

test('first-person signing draws the player body only for the actual signing performance', t => {
  const previous = globalThis.document;
  globalThis.document = { createElement: () => ({ width: 0, height: 0, getContext: () => context }) } as unknown as Document;
  t.mock.method(THREE.TextureLoader.prototype, 'load', () => new THREE.Texture());
  t.mock.method(GLTFLoader.prototype, 'loadAsync', () => new Promise(() => {}));
  const world = new WorldState(); new AgentManager(world).initializeAllAgents(); const neo = world.agents.get('neo')!;
  const renderer = new AgentRenderer(new THREE.Scene()), workday = { role: 'neo' as const, phase: 'signing' as const, elapsed: 1.9 };
  neo.currentLocation = 'film_metacortex_floor'; neo.currentAction = { type: 'idle', parameters: { workday }, startedAt: 0, duration: 1, progress: 0 };
  try {
    renderer.updateAgent('neo', neo); renderer.setPlayer('neo', true);
    renderer.setPlayerMotion({ speed: 0, grounded: true, verticalVelocity: 0, turn: 0, workday }); renderer.update(0, undefined, 0);
    assert.ok(renderer.getAgentBody('neo')!.visible, 'V cannot hide the body containing the signing hand and stylus');
    for (const gesture of [undefined, { ...workday, phase: 'signature' as const }, { ...workday, role: 'courier' as const }]) {
      renderer.setPlayerMotion({ speed: 0, grounded: true, verticalVelocity: 0, turn: 0, workday: gesture }); renderer.update(0, undefined, 0);
      assert.equal(renderer.getAgentBody('neo')!.visible, false, 'ordinary hiding resumes outside Neo’s signing action');
    }
  } finally { renderer.dispose(); globalThis.document = previous; }
});

test('the saved stylus stroke lies on an electronic screen and is retained while the pad is withdrawn', t => {
  const previous = globalThis.document;
  globalThis.document = { createElement: () => ({ width: 0, height: 0, getContext: () => context }) } as unknown as Document;
  t.mock.method(THREE.TextureLoader.prototype, 'load', () => new THREE.Texture());
  const parent = new THREE.Group(), renderer = new OfficeWorkdayRenderer(parent);
  try {
    for (const elapsed of [0, 1.05, 1.4, 1.9, 2.5, 3.4]) {
      const workday = { phase: 'signing' as const, elapsed }; renderer.update({ scene: 'm1_boss', workday } as FilmJourney); parent.updateMatrixWorld(true);
      const screen = parent.getObjectByName('delivery-signature-screen') as THREE.Mesh;
      assert.ok(screen, 'the courier hands Neo an electronic pad, as described in the shooting script');
      const point = officePenPoint(workday), ray = new THREE.Raycaster(new THREE.Vector3(point.x, point.y + .1, point.z), new THREE.Vector3(0, -1, 0));
      const hit = ray.intersectObject(screen, false)[0]; assert.ok(hit && Math.abs(point.y - hit.point.y) < .012, 'writing stays just above the screen surface');
      const stroke = parent.getObjectByName('delivery-signature-stroke') as THREE.Line;
      assert.equal(stroke.geometry.drawRange.count, Math.floor(Math.max(0, Math.min(1, (elapsed - 1) / 1.55)) * 48), 'the visible signature follows saved elapsed time');
    }
  } finally { renderer.dispose(); globalThis.document = previous; }
});
