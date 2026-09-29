import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MIRROR_SEAT, MIRROR_FACE, MIRROR_TIMING, MIRROR_TRINITY, PILL_ROOM, FILM_SETS, filmBlocked, filmPosition, type SandboxState, type FilmJourney } from '@auto_matrix/shared';
import { HeroModels } from '../packages/client/src/agents/HeroModel.js';
import { advanceMotion, newMotion } from '../packages/client/src/agents/CharacterMotion.js';
import { FilmSetRenderer, mirrorSurfacePoint } from '../packages/client/src/engine/FilmSetRenderer.js';
import { Reflector } from 'three/addons/objects/Reflector.js';
import { WorldState } from '../packages/server/src/world/WorldState.js';
import { AgentManager } from '../packages/server/src/agents/AgentManager.js';

test('the tracking-room mirror has straight carved sides and glass across all four corners', t => {
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
    assert.ok(mirror.scale.y * 2 < 6, 'the mirror should be comparable with the seated actor, not nearly twice standing height');
    assert.ok(mirror.scale.x * 2 < 4.5, 'the mirror should read as a dressing mirror rather than a wall panel');
    assert.equal(mirror.position.y, MIRROR_FACE.y + 1, 'the glass is centered at the seated face and reaching hand');
    assert.equal(filmBlocked(filmPosition('film_lafayette', -12.85, -17.84), FILM_SETS.film_lafayette, .1), false,
      'the smaller mirror frame must not retain an invisible wall extending past its side');
    assert.equal(filmBlocked(filmPosition('film_lafayette', -12.06, -17.84), FILM_SETS.film_lafayette, .1), true,
      'the visible side of the wooden frame must still block movement');
    renderer.root.updateMatrixWorld(true);
    const fracture = renderer.root.localToWorld(new THREE.Vector3(PILL_ROOM.mirror.x - .1, MIRROR_FACE.y + .8, -17));
    const hit = new THREE.Raycaster(fracture, new THREE.Vector3(0, 0, -1), 0, 1).intersectObject(renderer.root, true)[0];
    assert.ok(hit?.object === mirror, 'cracks belong to the glass surface instead of thick rods floating in front of the reflection');
    for (const x of [-.9, .9]) for (const y of [-.9, .9]) {
      const corner = mirror.localToWorld(new THREE.Vector3(x, y, .5));
      assert.ok(new THREE.Raycaster(corner, new THREE.Vector3(0, 0, -1), 0, 1).intersectObject(renderer.root, true)[0]?.object === mirror,
        'the straight frame must contain reflective glass instead of empty oval corners');
    }
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
    assert.ok(Math.abs(contact.x - PILL_ROOM.mirror.x) < MIRROR_FACE.radiusX * .85
      && Math.abs(contact.y - MIRROR_FACE.y) < MIRROR_FACE.radiusY * .85, 'the finger must meet glass inside the frame');
    const mirror = new THREE.Mesh(new THREE.PlaneGeometry(2, 2));
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

test('Trinity connects the electrode on Neo’s left forearm instead of reaching for a headset', async () => {
  const asset = await heroAsset('trinity'); const models = new HeroModels(new THREE.Texture(), new THREE.Texture());
  const neoAsset = await heroAsset();
  const neoModels = new HeroModels(new THREE.Texture(), new THREE.Texture());
  (neoModels as unknown as { load: () => Promise<typeof neoAsset> }).load = async () => neoAsset;
  (models as unknown as { load: () => Promise<typeof asset> }).load = async () => asset;
  try {
    const rig = (await models.create('trinity'))!;
    const neo = (await neoModels.create('neo'))!;
    neo.root.position.set(MIRROR_SEAT.x, -1, MIRROR_SEAT.z); neo.root.rotation.y = Math.PI;
    const neoMotion = newMotion(); neoMotion.seated = 1;
    const neoInput = { speed: 0, grounded: true, verticalVelocity: 0, turn: 0, seated: true, performance: 'touch' as const, mirrorBeat: 2.1 };
    neoModels.animate(neo, advanceMotion(neoMotion, neoInput, 0), neoMotion, neoInput, 0);
    neo.root.updateMatrixWorld(true);
    const contact = neo.bones.get('elbow_L')!.getWorldPosition(new THREE.Vector3()).lerp(neo.bones.get('wrist_L')!.getWorldPosition(new THREE.Vector3()), .35).add(new THREE.Vector3(0, .13, 0));
    rig.root.position.set(MIRROR_TRINITY.x, -1, MIRROR_TRINITY.z); rig.root.rotation.y = MIRROR_TRINITY.yaw;
    const motion = newMotion(); const mirrorCrew = 2.1;
    const input = { speed: 0, grounded: true, verticalVelocity: 0, turn: 0, mirrorCrew, mirrorContact: contact };
    models.animate(rig, advanceMotion(motion, input, 0), motion, input, 0); rig.root.updateMatrixWorld(true);
    const palm = rig.bones.get('wrist_R')!.localToWorld(new THREE.Vector3(.09, -.18, .02));
    assert.ok(palm.distanceTo(contact) < .025, `Trinity's palm remains ${palm.distanceTo(contact).toFixed(3)}m from the electrode`);
    const normal = new THREE.Vector3(1, 0, 0).applyQuaternion(rig.bones.get('wrist_R')!.getWorldQuaternion(new THREE.Quaternion()));
    assert.ok(normal.y < -.9, 'the palm faces down to attach the electrode instead of turning upward');
  } finally { models.dispose(); neoModels.dispose(); }
});

test('Trinity keeps her face clear of Neo’s seated eye while connecting and releasing the electrode', async () => {
  const [asset, neoAsset] = await Promise.all([heroAsset('trinity'), heroAsset()]);
  const models = new HeroModels(new THREE.Texture(), new THREE.Texture());
  const neoModels = new HeroModels(new THREE.Texture(), new THREE.Texture());
  (models as unknown as { load: () => Promise<typeof asset> }).load = async () => asset;
  (neoModels as unknown as { load: () => Promise<typeof neoAsset> }).load = async () => neoAsset;
  try {
    const rig = (await models.create('trinity'))!, neo = (await neoModels.create('neo'))!;
    rig.root.position.set(MIRROR_TRINITY.x, -1, MIRROR_TRINITY.z); rig.root.rotation.y = MIRROR_TRINITY.yaw;
    neo.root.position.set(MIRROR_SEAT.x, -1, MIRROR_SEAT.z); neo.root.rotation.y = Math.PI;
    const motion = newMotion(), neoMotion = newMotion(); neoMotion.seated = 1;
    const eye = new THREE.Vector3(MIRROR_SEAT.x, 2.09, MIRROR_SEAT.z);
    const camera = new THREE.PerspectiveCamera(78, 16 / 9, .1, 50); camera.position.copy(eye);
    camera.lookAt(PILL_ROOM.mirror.x + .5, 2.1, PILL_ROOM.mirror.z); camera.updateMatrixWorld(true);
    const face = rig.wardrobe.find(part => (part.mesh.material as THREE.Material).name === 'Skin')!.mesh as THREE.SkinnedMesh;
    const headIndex = face.skeleton.bones.findIndex(bone => bone.name === 'head');
    const joints = face.geometry.attributes.skinIndex, weights = face.geometry.attributes.skinWeight;
    const point = new THREE.Vector3(); let lastPalm: THREE.Vector3 | undefined;
    const resting = { speed: 0, grounded: true, verticalVelocity: 0, turn: 0 };
    models.animate(rig, advanceMotion(motion, resting, 0), motion, resting, 0); rig.root.updateMatrixWorld(true);
    const feet = ['L', 'R'].map(side => rig.bones.get('ankle_' + side)!.getWorldPosition(new THREE.Vector3()));
    for (const time of [1.9, 2.1, 2.75, 2.9, 3.1, 3.25, 4.15]) {
      const neoInput = { speed: 0, grounded: true, verticalVelocity: 0, turn: 0, seated: true, performance: 'touch' as const, mirrorBeat: time };
      neoModels.animate(neo, advanceMotion(neoMotion, neoInput, 0), neoMotion, neoInput, 0); neo.root.updateMatrixWorld(true);
      const contact = neo.bones.get('elbow_L')!.getWorldPosition(new THREE.Vector3()).lerp(neo.bones.get('wrist_L')!.getWorldPosition(new THREE.Vector3()), .35).add(new THREE.Vector3(0, .13, 0));
      const input = { speed: 0, grounded: true, verticalVelocity: 0, turn: 0, mirrorCrew: time, mirrorContact: contact };
      models.animate(rig, advanceMotion(motion, input, 0), motion, input, 0); rig.root.updateMatrixWorld(true);
      let clearance = Infinity, foreground = 0;
      for (let i = 0; i < joints.count; i++) {
        if (![0, 1, 2, 3].some(j => joints.getComponent(i, j) === headIndex && weights.getComponent(i, j) > .5)) continue;
        face.localToWorld(face.getVertexPosition(i, point)); clearance = Math.min(clearance, point.distanceTo(eye));
        const screen = point.clone().project(camera);
        if (point.z > PILL_ROOM.mirror.z && point.z < eye.z && Math.abs(screen.x) < .8 && Math.abs(screen.y) < .8) foreground++;
      }
      assert.ok(clearance > .85, `Trinity’s face enters the first-person foreground at ${time}s (${clearance.toFixed(3)}m clearance)`);
      assert.equal(foreground, 0, `Trinity’s face covers the central mirror view at ${time}s (${foreground} vertices)`);
      for (const [i, side] of ['L', 'R'].entries()) {
        const foot = rig.bones.get('ankle_' + side)!.getWorldPosition(new THREE.Vector3());
        assert.ok(Math.abs(foot.y - feet[i].y) < .002, 'bending the knees must not lift or bury the soles');
        assert.ok(Math.hypot(foot.x - feet[i].x, foot.z - feet[i].z) < .08, 'the planted feet cannot slide toward the chair');
      }
      const palm = rig.bones.get('wrist_R')!.localToWorld(new THREE.Vector3(.09, -.18, .02));
      if (time <= MIRROR_TIMING.wired) assert.ok(palm.distanceTo(contact) < .025, 'a clear view cannot come at the cost of a disconnected hand');
      if (time === 3.25) lastPalm = palm.clone();
      if (time === 4.15) assert.ok(palm.distanceTo(lastPalm!) < .02, 'the released hand settles back without holding an invisible electrode');
    }
  } finally { models.dispose(); neoModels.dispose(); }
});

test('the visible electrode and lead stay attached to Neo when paused, restored or hidden from first person', t => {
  t.mock.method(THREE.TextureLoader.prototype, 'load', () => new THREE.Texture());
  const document = globalThis.document;
  globalThis.document = { createElement: () => ({ getContext: () => ({ fillRect() {}, strokeRect() {}, fillText() {}, beginPath() {}, moveTo() {}, lineTo() {}, closePath() {}, stroke() {}, fill() {} }) }) } as unknown as Document;
  const world = new WorldState(); new AgentManager(world).initializeAllAgents();
  const neo = world.agents.get('neo')!; neo.position = filmPosition('film_lafayette', MIRROR_SEAT.x, MIRROR_SEAT.z); neo.isInMatrix = true;
  const journey = { scene: 'm1_mirror', step: 0, awakening: { kind: 'mirror', elapsed: 2.75, started: false } } as FilmJourney;
  const sandbox = { neoLife: { journey } } as SandboxState;
  const subject = new THREE.Group(); const wrist = new THREE.Bone(); wrist.name = 'wrist_L'; subject.add(wrist);
  const elbow = new THREE.Bone(); elbow.name = 'elbow_L'; subject.add(elbow);
  const renderer = new FilmSetRenderer(new THREE.Scene()); renderer.setMirrorSubject(subject);
  try {
    renderer.update(neo, sandbox, 0);
    const electrode = renderer.root.getObjectByName('tracking-electrode');
    assert.ok(electrode && electrode.children.some(child => child instanceof THREE.Mesh), 'static batching must retain the moving electrode geometry');
    const check = () => {
      renderer.update(neo, sandbox, 100); renderer.root.updateMatrixWorld(true);
      const contact = elbow.getWorldPosition(new THREE.Vector3()).lerp(wrist.getWorldPosition(new THREE.Vector3()), .35).add(new THREE.Vector3(0, .13, 0));
      assert.ok(electrode.getWorldPosition(new THREE.Vector3()).distanceTo(contact) < .001, 'the pad follows the actual arm, not a guessed head position');
      const lead = renderer.root.getObjectByName('tracking-electrode-lead') as THREE.Line;
      const positions = lead.geometry.getAttribute('position');
      assert.ok(lead.localToWorld(new THREE.Vector3().fromBufferAttribute(positions, positions.count - 1)).distanceTo(contact) < .001, 'the cable ends on the electrode');
    };
    wrist.position.copy(renderer.root.localToWorld(new THREE.Vector3(-8.8, 2.3, -16)));
    elbow.position.copy(wrist.position).add(new THREE.Vector3(0, .3, .1));
    check(); wrist.position.add(new THREE.Vector3(.1, .2, -.1)); subject.visible = false; check();
    assert.equal(electrode.visible, false, 'the direct first-person view must not show a floating electrode without the hidden arm');
    journey.visiting = 'm1_pills'; renderer.update(neo, sandbox, 200);
    assert.equal(renderer.root.getObjectByName('tracking-electrode')!.visible, false, 'a revisit does not attach an electrode to an unrelated player');
  } finally { renderer.dispose(); globalThis.document = document; }
});
