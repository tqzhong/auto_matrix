import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MIRROR_SEAT, MIRROR_FACE, MIRROR_TIMING, MIRROR_TRINITY, PILL_ROOM, filmPosition, type SandboxState, type FilmJourney } from '@auto_matrix/shared';
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
    renderer.root.updateMatrixWorld(true);
    const fracture = renderer.root.localToWorld(new THREE.Vector3(PILL_ROOM.mirror.x - .1, MIRROR_FACE.y + .8, -17));
    const hit = new THREE.Raycaster(fracture, new THREE.Vector3(0, 0, -1), 0, 1).intersectObject(renderer.root, true)[0];
    assert.ok(hit?.object === mirror, 'cracks belong to the glass surface instead of thick rods floating in front of the reflection');
  } finally { renderer.dispose(); globalThis.document = document; }
});

test('healing and the silver filament resume from story time with their contact fixed to the glass', t => {
  t.mock.method(THREE.TextureLoader.prototype, 'load', () => new THREE.Texture());
  const document = globalThis.document;
  globalThis.document = { createElement: () => ({ getContext: () => ({ fillRect() {}, strokeRect() {}, fillText() {}, beginPath() {}, moveTo() {}, lineTo() {}, closePath() {}, stroke() {}, fill() {} }) }) } as unknown as Document;
  const world = new WorldState(); new AgentManager(world).initializeAllAgents();
  const neo = world.agents.get('neo')!; neo.position = filmPosition('film_lafayette', MIRROR_SEAT.x, MIRROR_SEAT.z);
  neo.currentLocation = 'film_lafayette'; neo.isInMatrix = true;
  const journey = { scene: 'm1_mirror', step: 0, awakening: { kind: 'mirror', elapsed: 2.75, started: false } } as FilmJourney;
  const sandbox = { neoLife: { journey } } as SandboxState;
  const renderer = new FilmSetRenderer(new THREE.Scene());
  const subject = new THREE.Group(); const finger = new THREE.Object3D(); finger.name = 'finger2-3_R'; subject.add(finger); renderer.setMirrorSubject(subject);
  try {
    renderer.update(neo, sandbox, 0);
    const mirror = renderer.root.children.find(child => child instanceof Reflector) as Reflector;
    const shader = mirror.material as THREE.ShaderMaterial;
    const filament = renderer.root.getObjectByName('mirror-liquid-filament')!;
    const at = (time: number, worldTime = 100) => { journey.awakening!.elapsed = time; renderer.update(neo, sandbox, worldTime); };
    assert.equal(shader.uniforms.healProgress.value, 0); assert.equal(filament.visible, false);
    at(3.04); assert.ok(shader.uniforms.healProgress.value > .1 && shader.uniforms.healProgress.value < .9);
    const repair = shader.uniforms.healProgress.value; at(3.04, 900);
    assert.equal(shader.uniforms.healProgress.value, repair, 'pausing cannot continue healing on the render clock');
    finger.position.copy(mirror.localToWorld(new THREE.Vector3(.573, -.113, .06)));
    at(MIRROR_TIMING.touch);
    assert.equal(shader.uniforms.healProgress.value, 1, 'all seams close before the fingertip touches the liquid');
    assert.equal(filament.visible, true);
    const contact = shader.uniforms.liquidContact.value.clone();
    finger.position.add(new THREE.Vector3(-.1, .18, .65)); at(4.15);
    assert.deepEqual(shader.uniforms.liquidContact.value, contact, 'the ripple stays at the original touch instead of chasing the retreating hand');
    const end = filament.localToWorld(new THREE.Vector3(0, 1, 0));
    assert.ok(end.distanceTo(finger.position) < .001, 'the drawn silver filament reaches the moving fingertip');
    const start = filament.localToWorld(new THREE.Vector3());
    assert.ok(Math.abs(mirror.worldToLocal(start).z - .006) < .001, 'the other end remains attached to the mirror');
    const restored = new FilmSetRenderer(new THREE.Scene()); restored.setMirrorSubject(subject);
    try {
      restored.update(neo, JSON.parse(JSON.stringify(sandbox)), 1200);
      const resumedFilament = restored.root.getObjectByName('mirror-liquid-filament')!;
      assert.equal(resumedFilament.visible, true);
      assert.ok(resumedFilament.localToWorld(new THREE.Vector3(0, 1, 0)).distanceTo(end) < .001, 'a fresh renderer restores the connection without replaying the reach');
      assert.ok(resumedFilament.localToWorld(new THREE.Vector3()).distanceTo(filament.localToWorld(new THREE.Vector3())) < .001, 'reloading retains the original point on the glass');
    } finally { restored.dispose(); }
    at(4.8); assert.equal(filament.visible, false, 'the strand has broken by the hand-inspection beat');
    journey.visiting = 'm1_pills'; renderer.update(neo, sandbox, 1300);
    const visitedMirror = renderer.root.children.find(child => child instanceof Reflector) as Reflector;
    assert.equal((visitedMirror.material as THREE.ShaderMaterial).uniforms.healProgress.value, 0, 'a scene revisit resets its mirror state');
    assert.equal(renderer.root.getObjectByName('mirror-liquid-filament')!.visible, false);
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
    const withdrawn = fingerAt(4.8);
    assert.ok(withdrawn.z - contact.z > .45, 'Neo pulls the silver-coated hand away to inspect it instead of holding the glass until the cut');
    assert.ok(fingerAt(3.81).distanceTo(fingerAt(3.8)) < .02, 'withdrawing begins without snapping away from the contact');
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
