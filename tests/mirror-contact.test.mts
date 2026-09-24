import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MIRROR_SEAT, MIRROR_FACE, MIRROR_TIMING, MIRROR_TRINITY, PILL_ROOM, filmPosition } from '@auto_matrix/shared';
import { HeroModels } from '../packages/client/src/agents/HeroModel.js';
import { advanceMotion, newMotion } from '../packages/client/src/agents/CharacterMotion.js';
import { FilmSetRenderer, mirrorSurfacePoint } from '../packages/client/src/engine/FilmSetRenderer.js';
import { Reflector } from 'three/addons/objects/Reflector.js';
import { WorldState } from '../packages/server/src/world/WorldState.js';
import { AgentManager } from '../packages/server/src/agents/AgentManager.js';

test('the tracking-room mirror is a person-sized oval beside Neo, not a wall-height surface', t => {
  t.mock.method(THREE.TextureLoader.prototype, 'load', () => new THREE.Texture());
  const document = globalThis.document;
  globalThis.document = { createElement: () => ({ width: 0, height: 0, getContext: () => ({ fillRect() {}, strokeRect() {}, fillText() {}, beginPath() {}, moveTo() {}, lineTo() {}, closePath() {}, stroke() {}, fill() {} }) }) } as unknown as Document;
  const world = new WorldState(); new AgentManager(world).initializeAllAgents();
  const neo = world.agents.get('neo')!;
  const renderer = new FilmSetRenderer(new THREE.Scene());
  try {
    neo.position = filmPosition('film_lafayette', MIRROR_SEAT.x, MIRROR_SEAT.z);
    neo.currentLocation = 'film_lafayette'; neo.isInMatrix = true;
    renderer.update(neo, undefined, 0);
    const mirror = renderer.root.children.find(child => child instanceof Reflector) as Reflector | undefined;
    assert.ok(mirror, 'the room contains an actual reflective mirror');
    assert.ok(mirror.scale.y * 2 < 6, 'the oval should be comparable with the seated actor, not nearly twice standing height');
    assert.ok(mirror.scale.x * 2 < 4.5, 'the mirror should read as a dressing mirror rather than a wall panel');
    assert.equal(mirror.position.y, MIRROR_FACE.y + 1, 'the glass is centered at the seated face and reaching hand');
  } finally { renderer.dispose(); globalThis.document = document; }
});

async function heroAsset(id = 'neo') {
  const glb = await readFile(new URL(`../packages/client/public/assets/characters/${id}.glb`, import.meta.url));
  const jsonLength = glb.readUInt32LE(12);
  const document = JSON.parse(glb.subarray(20, 20 + jsonLength).toString());
  for (const material of document.materials) { delete material.pbrMetallicRoughness.baseColorTexture; delete material.normalTexture; }
  document.images = []; document.textures = [];
  const json = Buffer.from(JSON.stringify(document)); const padded = Buffer.alloc(Math.ceil(json.length / 4) * 4, 32); json.copy(padded);
  const bin = glb.subarray(20 + jsonLength); const result = Buffer.alloc(20 + padded.length + bin.length);
  result.writeUInt32LE(0x46546c67, 0); result.writeUInt32LE(2, 4); result.writeUInt32LE(result.length, 8);
  result.writeUInt32LE(padded.length, 12); result.writeUInt32LE(0x4e4f534a, 16); padded.copy(result, 20); bin.copy(result, 20 + padded.length);
  return new GLTFLoader().parseAsync(result.buffer.slice(result.byteOffset, result.byteOffset + result.byteLength), '');
}

test('Neo reaches the actual mirror smoothly without passing through it', async () => {
  const asset = await heroAsset(); const models = new HeroModels(new THREE.Texture(), new THREE.Texture());
  (models as unknown as { load: () => Promise<typeof asset> }).load = async () => asset;
  try {
    const rig = (await models.create('neo'))!;
    rig.root.position.set(MIRROR_SEAT.x, -1, MIRROR_SEAT.z); rig.root.rotation.y = Math.PI;
    const motion = newMotion(); motion.seated = 1;
    const base = { speed: 0, grounded: true, verticalVelocity: 0, turn: 0, seated: true, performance: 'touch' as const };
    const fingerAt = (mirrorBeat: number) => {
      const input = { ...base, mirrorBeat };
      models.animate(rig, advanceMotion(motion, input, 0), motion, input, 0); rig.root.updateMatrixWorld(true);
      return rig.bones.get('finger2-3_R')!.getWorldPosition(new THREE.Vector3());
    };
    const before = fingerAt(2.74), start = fingerAt(2.75), near = fingerAt(3.44), contact = fingerAt(3.45);
    assert.ok(before.distanceTo(start) < .02, 'the reach begins continuously after Trinity finishes wiring Neo');
    assert.ok(near.distanceTo(contact) < .02, 'the hand does not snap when the silver starts to spread');
    assert.ok(contact.z > PILL_ROOM.mirror.z + .01 && contact.z < PILL_ROOM.mirror.z + .12,
      `finger ${contact.toArray()} must touch the visible face of the mirror at z=${PILL_ROOM.mirror.z}`);
    const ellipse = ((contact.x - PILL_ROOM.mirror.x) / MIRROR_FACE.radiusX) ** 2 + ((contact.y - MIRROR_FACE.y) / MIRROR_FACE.radiusY) ** 2;
    assert.ok(ellipse < .85 ** 2, 'the finger must meet the reflective glass inside the oval frame');
    const mirror = new THREE.Mesh(new THREE.CircleGeometry(1));
    mirror.position.set(PILL_ROOM.mirror.x, MIRROR_FACE.y, PILL_ROOM.mirror.z); mirror.scale.set(MIRROR_FACE.radiusX, MIRROR_FACE.radiusY, 1);
    const ripple = mirrorSurfacePoint(mirror, rig.root)!;
    assert.ok(Math.abs(ripple.x - .573) < .02 && Math.abs(ripple.y + .113) < .02,
      `the ripple must start under Neo's actual fingertip, not at the center of the glass: ${ripple.toArray()}`);
    assert.equal(mirrorSurfacePoint(mirror, new THREE.Group()), undefined, 'other actors without a reaching hand do not move the ripple');
    for (const time of [2.9, 3.1, 3.3, 3.6, 5]) {
      const finger = fingerAt(time);
      assert.ok(finger.z > PILL_ROOM.mirror.z - .02, `finger passes through the mirror at ${time}s: ${finger.toArray()}`);
    }
  } finally { models.dispose(); }
});

test('Trinity reaches the headset while wiring Neo in the tracking chair', async () => {
  const asset = await heroAsset('trinity'); const models = new HeroModels(new THREE.Texture(), new THREE.Texture());
  (models as unknown as { load: () => Promise<typeof asset> }).load = async () => asset;
  try {
    const rig = (await models.create('trinity'))!;
    rig.root.position.set(MIRROR_TRINITY.x, -1, MIRROR_TRINITY.z); rig.root.rotation.y = MIRROR_TRINITY.yaw;
    const motion = newMotion(); const mirrorCrew = 2.1;
    const input = { speed: 0, grounded: true, verticalVelocity: 0, turn: 0, mirrorCrew };
    models.animate(rig, advanceMotion(motion, input, 0), motion, input, 0); rig.root.updateMatrixWorld(true);
    const lowered = THREE.MathUtils.smoothstep(mirrorCrew, MIRROR_TIMING.sit, MIRROR_TIMING.wired);
    const leftCup = new THREE.Vector3(MIRROR_SEAT.x + 1.9 * (1 - lowered) - .72, 3.4 - 1.1 * lowered - .16, MIRROR_SEAT.z + .65);
    const finger = rig.bones.get('finger2-3_R')!.getWorldPosition(new THREE.Vector3());
    assert.ok(finger.distanceTo(leftCup) < .18, `Trinity's finger remains ${finger.distanceTo(leftCup).toFixed(2)}m from the lowering headset cup`);
  } finally { models.dispose(); }
});
