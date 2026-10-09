import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { HAMMER_BRIEFING, FILM_SETS, filmPosition, newHammerBriefing, type HammerBriefingGesture, type HammerBriefingRole } from '@auto_matrix/shared';
import { CharacterModels } from '../packages/client/src/agents/CharacterModel.js';
import { PlayerControls } from '../packages/client/src/player/PlayerControls.js';
import { HammerBriefingRenderer } from '../packages/client/src/engine/HammerBriefingRenderer.js';
import { WorldState } from '../packages/server/src/world/WorldState.js';
import { AgentManager } from '../packages/server/src/agents/AgentManager.js';

async function geometry(id: string) {
  const glb = await readFile(new URL(`../packages/client/public/assets/characters/${id}.glb`, import.meta.url));
  const length = glb.readUInt32LE(12), document = JSON.parse(glb.subarray(20, 20 + length).toString());
  for (const material of document.materials) { delete material.pbrMetallicRoughness?.baseColorTexture; delete material.normalTexture; }
  document.images = []; document.textures = [];
  const json = Buffer.from(JSON.stringify(document)), padded = Buffer.alloc(Math.ceil(json.length / 4) * 4, 32); json.copy(padded);
  const bin = glb.subarray(20 + length), result = Buffer.alloc(20 + padded.length + bin.length);
  result.writeUInt32LE(0x46546c67, 0); result.writeUInt32LE(2, 4); result.writeUInt32LE(result.length, 8);
  result.writeUInt32LE(padded.length, 12); result.writeUInt32LE(0x4e4f534a, 16); padded.copy(result, 20); bin.copy(result, 20 + padded.length);
  return new GLTFLoader().parseAsync(result.buffer.slice(result.byteOffset, result.byteOffset + result.byteLength), '');
}
async function setup(t: test.TestContext) {
  const ids = ['neo', 'neo-office', 'neo-tracking', 'trinity', 'trinity-club', 'morpheus', 'niobe-head', 'niobe-body', 'roland-head', 'roland-body'];
  const assets = new Map(await Promise.all(ids.map(async id => [`${id}.glb`, await geometry(id)] as const)));
  t.mock.method(GLTFLoader.prototype, 'loadAsync', (url: string) => assets.has(url.split('/').at(-1)!) ? Promise.resolve(assets.get(url.split('/').at(-1)!)) : new Promise(() => {}));
  t.mock.method(THREE.TextureLoader.prototype, 'load', () => new THREE.Texture());
  const old = globalThis.document;
  globalThis.document = { createElement: () => ({ getContext: () => ({ createRadialGradient: () => ({ addColorStop() {} }), fillRect() {}, strokeRect() {}, fillText() {}, beginPath() {}, closePath() {}, moveTo() {}, lineTo() {}, stroke() {}, ellipse() {}, fill() {}, createImageData: (w: number,h: number) => ({ data: new Uint8ClampedArray(w*h*4) }), putImageData() {} }) }) } as unknown as Document;
  const world = new WorldState(); new AgentManager(world).initializeAllAgents(); const models = new CharacterModels();
  const roles = ['neo', ...HAMMER_BRIEFING.cast] as const, rigs = Object.fromEntries(roles.map(role => [role, models.create(world.agents.get(role)!)]));
  const pose = (role: HammerBriefingRole, phase: HammerBriefingGesture['phase'] = 'proposal', elapsed = 8.8, delta = 0) => {
    const rig = rigs[role], root = role === 'neo' ? HAMMER_BRIEFING.approach : HAMMER_BRIEFING.roots[role];
    rig.root.position.set(phase === 'planning' && role === 'neo' ? HAMMER_BRIEFING.inspection.x : root.x, 0,
      phase === 'planning' && role === 'neo' ? HAMMER_BRIEFING.inspection.z : root.z);
    rig.root.rotation.y = role === 'neo' ? phase === 'planning' ? -Math.PI / 2 : Math.PI : HAMMER_BRIEFING.roots[role].yaw;
    const gesture: HammerBriefingGesture = { ...newHammerBriefing(1, 43), phase, elapsed, role, step: phase === 'planning' ? 2 : 1 };
    models.animate(rig, delta, { speed: 0, grounded: true, verticalVelocity: 0, turn: 0, realWorld: true,
      nebCrew: role === 'neo' || role === 'morpheus' || role === 'trinity' ? role : undefined, hammerBriefing: gesture }, 0);
    rig.root.updateMatrixWorld(true); rig.root.traverse(object => { if (object instanceof THREE.SkinnedMesh) object.skeleton.update(); }); return rig;
  };
  t.after(() => { models.dispose(); globalThis.document = old; });
  for (const role of roles) pose(role); await new Promise(resolve => setImmediate(resolve));
  for (const role of roles) pose(role); await new Promise(resolve => setImmediate(resolve));
  return { pose, roles, rigs, models, world };
}

test('the Hammer meeting has curved pressure ribs, a clear entry and a physical terminal instead of a floor hologram', () => {
  const renderer = new HammerBriefingRenderer(new THREE.Group()); renderer.root.updateMatrixWorld(true);
  try {
    assert.ok(renderer.root.getObjectByName('curved-hammer-hull')); assert.ok(renderer.root.getObjectByName('curved-pressure-rib'));
    assert.ok(renderer.root.getObjectByName('physical-two-ship-route-screen')); assert.equal(renderer.root.getObjectByName('hammer-two-routes'), undefined);
    const entry = new THREE.Raycaster(new THREE.Vector3(0, 2.8, 14), new THREE.Vector3(0, 0, -1), 0, 10).intersectObject(renderer.root, true);
    assert.equal(entry.length, 0, 'the ship entry and meeting aisle must stay open');
  } finally { renderer.dispose(); }
});

test('the actual shipped meeting bodies keep their soles on the floor, stay apart and preserve the saved speaking pose', async t => {
  const h = await setup(t), bounds: THREE.Box3[] = [];
  for (const role of h.roles) {
    const rig = h.pose(role); let lowest = Infinity;
    rig.root.traverseVisible(object => { if (object instanceof THREE.Mesh) for (let i = 0; i < object.geometry.attributes.position.count; i++) {
      const point = object.localToWorld(object.getVertexPosition(i, new THREE.Vector3())); assert.ok(point.toArray().every(Number.isFinite)); lowest = Math.min(lowest, point.y);
    } });
    assert.ok(lowest >= -.035 && lowest < .1, `${role}: shipped soles float or cross the floor (${lowest})`);
    bounds.push(new THREE.Box3().setFromObject(rig.root));
    const joints = [rig.torso, rig.head, ...rig.shoulders, ...rig.elbows, ...(rig.hero?.bones.values() ?? [])];
    const before = joints.map(j => j.matrixWorld.elements.slice()); h.pose(role, 'proposal', 8.8, .7);
    assert.deepEqual(joints.map(j => j.matrixWorld.elements.slice()), before, `${role}: paused proposal drifted with render delta`);
  }
  for (let i = 0; i < bounds.length; i++) for (let j = i + 1; j < bounds.length; j++) assert.equal(bounds[i].intersectsBox(bounds[j]), false, `${h.roles[i]} overlaps ${h.roles[j]}`);
  assert.ok(h.rigs.neo.hero, 'validate the delivered Neo, not only his fallback');
  assert.ok(h.rigs.neo.hero!.wardrobe.filter(part => part.hair).every(part => part.mesh.visible));
  assert.equal(h.rigs.neo.root.getObjectByName('neo-farewell-eye-band')?.visible, false, 'healthy Neo cannot wear his later injury band');
  const cloth = h.rigs.morpheus.hero!.wardrobe.find(part => /Tailored.coat.upper/.test(part.mesh.name))!.mesh.material as THREE.MeshStandardMaterial;
  assert.ok(cloth.roughness >= .94 && cloth.color.r > cloth.color.g, 'Morpheus wears the maroon rough knit seen in this meeting');
  const collar = h.rigs.morpheus.hero!.wardrobe.find(part => /Black.crew.neck/.test(part.mesh.name))!.mesh.material as THREE.MeshStandardMaterial;
  assert.ok(collar.color.r > cloth.color.r && collar.color.g > cloth.color.g, 'retain Morpheus’s light undershirt collar instead of recoloring every layer maroon');
});

test('Neo’s actual hand and body stay in front of the physical terminal during route inspection', async t => {
  const h = await setup(t), renderer = new HammerBriefingRenderer(new THREE.Group()); renderer.root.updateMatrixWorld(true); t.after(() => renderer.dispose());
  const console = new THREE.Box3().setFromObject(renderer.root.getObjectByName('hammer-route-console')!).expandByScalar(-.015);
  const crt = new THREE.Box3().setFromObject(renderer.root.getObjectByName('route-crt-housing')!).expandByScalar(-.015);
  for (const elapsed of [0, 1.1, 2.2, 4.4, 8.8, 10.9]) {
    const rig = h.pose('neo', 'planning', elapsed), hits: string[] = [];
    rig.root.traverseVisible(object => { if (object instanceof THREE.Mesh) for (let i = 0; i < object.geometry.attributes.position.count; i++) {
      const point = object.localToWorld(object.getVertexPosition(i, new THREE.Vector3()));
      if ((console.containsPoint(point) || crt.containsPoint(point)) && hits.length < 4) hits.push(`${object.name}: ${point.toArray()}`);
    } });
    assert.deepEqual(hits, [], `actual Neo penetrates the terminal at ${elapsed}`);
  }
});

test('Niobe’s meeting sweater covers both forearms and restores her dock top outside this scene', async t => {
  const h = await setup(t), rig = h.rigs.niobe;
  const sweater = rig.root.getObjectByName('niobe-briefing-sweater') as THREE.SkinnedMesh;
  assert.ok(sweater, 'the meeting still uses Niobe’s sleeveless dock costume');
  const top = rig.root.getObjectByName('niobe-work-top')!;
  const skin = rig.root.getObjectByName('niobe-anatomical-body') as THREE.SkinnedMesh;
  for (const elapsed of [0, 1.1, 2.2, 4.4, 8.8]) {
    h.pose('niobe', 'loan', elapsed); sweater.skeleton.update(); skin.skeleton.update();
    assert.equal(sweater.visible, true); assert.equal(top.visible, false);
    for (let side = 0; side < 2; side++) {
      const elbow = rig.elbows[side], surface = elbow.localToWorld(new THREE.Vector3(0, -.35, 0));
      const direction = new THREE.Vector3(0, 0, 1).transformDirection(elbow.matrixWorld);
      const ray = new THREE.Raycaster(surface.addScaledVector(direction, .4), direction.negate(), 0, .5);
      const fabric = ray.intersectObject(sweater, false)[0], exposed = ray.intersectObject(skin, false)[0];
      assert.ok(fabric && exposed && fabric.distance < exposed.distance, `forearm ${side} remains exposed at ${elapsed}`);
    }
  }
  h.models.animate(rig, 0, { speed: 0, grounded: true, verticalVelocity: 0, turn: 0, realWorld: true }, 0);
  assert.equal(sweater.visible, false); assert.equal(top.visible, true, 'retain Niobe’s existing dock wardrobe');
});

test('cold first-person route inspection frames the entire terminal and retains free mouse look', async t => {
  const h = await setup(t), rig = h.pose('neo', 'planning', 9), state = h.world.agents.get('neo')!;
  const center = FILM_SETS.film_hammer_deck.center, origin = new THREE.Vector3(center.x, center.y - 1, center.z);
  state.position = filmPosition('film_hammer_deck', HAMMER_BRIEFING.inspection.x, HAMMER_BRIEFING.inspection.z);
  state.rotation = -Math.PI / 2; state.currentLocation = 'film_hammer_deck'; state.isInMatrix = false;
  state.currentAction = { type: 'idle', parameters: { hammerBriefing: { ...newHammerBriefing(2,43), role: 'neo', phase: 'planning', elapsed: 9, step: 2 } }, startedAt: 0, duration: 1e9, progress: 0 };
  rig.root.position.add(origin); rig.root.updateMatrixWorld(true);
  const previous = ['window', 'document'].map(key => Object.getOwnPropertyDescriptor(globalThis, key));
  class InputTarget extends EventTarget { matches() { return false; } }
  const window = new InputTarget(), canvas = new InputTarget();
  const document = Object.assign(new InputTarget(), globalThis.document, { pointerLockElement: canvas, hidden: false, exitPointerLock() {} });
  Object.assign(globalThis, { window, document });
  const camera = new THREE.PerspectiveCamera(57, 16 / 9, .5, 5000);
  const controls = new PlayerControls(canvas as HTMLCanvasElement, camera, () => {}, () => {});
  try {
    for (const aspect of [16 / 9, .72]) {
      camera.aspect = aspect; controls.possess(state); controls.update(.1, state, rig.root, false);
      window.dispatchEvent(Object.assign(new Event('keydown'), { code: 'KeyV', repeat: false }));
      window.dispatchEvent(Object.assign(new Event('keyup'), { code: 'KeyV' }));
      controls.update(.1, state, rig.root, false); controls.syncTrainmanChaseCamera(rig.root); camera.updateMatrixWorld(true);
      for (const z of [3.2 - 1.35, 3.2 + 1.35]) for (const y of [3.5 - .825, 3.5 + .825]) {
        const point = new THREE.Vector3(-6.68, y, z).add(origin).project(camera);
        assert.ok(Math.abs(point.x) <= .96 && Math.abs(point.y) <= .96 && point.z > -1 && point.z < 1,
          `route display is cropped at ${aspect}: ${point.toArray()}`);
      }
      const eye = rig.hero!.bones.get('head')!, actualEye = eye.localToWorld((eye.userData.cameraEye as THREE.Vector3).clone());
      assert.ok(camera.position.distanceTo(actualEye) < 1e-6, 'keep the real eye instead of moving the camera outside Neo');
      const before = camera.getWorldDirection(new THREE.Vector3());
      document.dispatchEvent(Object.assign(new Event('mousemove'), { movementX: 90, movementY: -30 }));
      controls.update(.1, state, rig.root, false); controls.syncTrainmanChaseCamera(rig.root);
      assert.ok(camera.getWorldDirection(new THREE.Vector3()).distanceTo(before) > .15, 'initial framing cannot override subsequent mouse look');
    }
  } finally {
    controls.dispose(); ['window', 'document'].forEach((key,i) => previous[i] ? Object.defineProperty(globalThis,key,previous[i]!) : Reflect.deleteProperty(globalThis,key));
  }
});
