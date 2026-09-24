import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { HeroModels, type HeroRig } from '../packages/client/src/agents/HeroModel.js';
import { advanceMotion, newMotion } from '../packages/client/src/agents/CharacterMotion.js';
import { PhoneModel } from '../packages/client/src/agents/PhoneModel.js';
import { OfficeSetRenderer } from '../packages/client/src/engine/OfficeSetRenderer.js';
import { APARTMENT, FILM_SETS, PILL_ROOM, PILL_TIMING, filmPosition, pillRoot, type PillGesture, OFFICE_WINDOW, OFFICE_LEDGE_OFFSET, officeWindowPose, officeCrossingPose, type FilmJourney } from '@auto_matrix/shared';
import { INTERROGATION_ROOM, interrogationRoot } from '@auto_matrix/shared';
import { MEETING_CAR, meetingRoot, meetingCarPose } from '@auto_matrix/shared';
import { OFFICE_WORKDAY, officeRecipientRoot, officeCourierRoot, officeClipboardPoint, officePenPoint } from '@auto_matrix/shared';
import { OfficeWorkdayRenderer } from '../packages/client/src/engine/OfficeWorkdayRenderer.js';

async function loadGeometry(id = 'neo') {
  const glb = await readFile(new URL(`../packages/client/public/assets/characters/${id}.glb`, import.meta.url));
  const jsonLength = glb.readUInt32LE(12);
  const document = JSON.parse(glb.subarray(20, 20 + jsonLength).toString());
  // Decode the shipped geometry with the real loader, without a DOM/image
  // decoder. Material/texture appearance is checked in the browser.
  for (const material of document.materials) {
    delete material.pbrMetallicRoughness.baseColorTexture;
    delete material.normalTexture;
  }
  document.images = []; document.textures = [];
  const json = Buffer.from(JSON.stringify(document));
  const padded = Buffer.alloc(Math.ceil(json.length / 4) * 4, 32); json.copy(padded);
  const bin = glb.subarray(20 + jsonLength);
  const result = Buffer.alloc(20 + padded.length + bin.length);
  result.writeUInt32LE(0x46546c67, 0); result.writeUInt32LE(2, 4); result.writeUInt32LE(result.length, 8);
  result.writeUInt32LE(padded.length, 12); result.writeUInt32LE(0x4e4f534a, 16);
  padded.copy(result, 20); bin.copy(result, 20 + padded.length);
  return new GLTFLoader().parseAsync(result.buffer.slice(result.byteOffset, result.byteOffset + result.byteLength), '');
}

test('the mirror reaches Neo’s hand before his face and coat hem', async () => {
  const asset = await loadGeometry('neo'); const models = new HeroModels(new THREE.Texture(), new THREE.Texture());
  (models as unknown as { load: () => Promise<typeof asset> }).load = async () => asset;
  try {
    const rig = (await models.create('neo'))!;
    const skin = rig.wardrobe.find(part => (part.mesh.material as THREE.Material).name === 'Skin')!.mesh.geometry;
    const position = skin.getAttribute('position'); const arrival = skin.getAttribute('_mirrorArrival');
    assert.ok(arrival, 'the skinned model needs a per-vertex liquid arrival time');
    const hand: number[] = []; const face: number[] = [];
    for (let i = 0; i < position.count; i++) {
      if (position.getX(i) < -.45 && position.getY(i) < 2.25) hand.push(arrival.getX(i));
      if (position.getY(i) > 3.95) face.push(arrival.getX(i));
    }
    assert.ok(hand.length > 20 && face.length > 20, 'both parts must be represented in the shipped mesh');
    assert.ok(Math.max(...hand) < .55, 'the reaching hand must be covered by the middle of the performance');
    assert.ok(Math.min(...face) > .7, 'the face must still be uncovered while silver climbs the arm');
    const coat = rig.wardrobe.find(part => /Tailored.coat.upper/i.test(part.mesh.name))!.mesh.geometry;
    const coatPosition = coat.getAttribute('position'); const coatArrival = coat.getAttribute('_mirrorArrival');
    const sleeve: number[] = [];
    for (let i = 0; i < coatPosition.count; i++) if (coatPosition.getX(i) < -.45 && coatPosition.getY(i) > 2.5 && coatPosition.getY(i) < 3.7) sleeve.push(coatArrival.getX(i));
    assert.ok(sleeve.some(time => time < .54) && sleeve.some(time => time > .58), 'the sleeve needs a moving frontier between hand and shoulder');
    for (const panel of rig.panels) {
      const tail = panel.mesh.geometry.getAttribute('_mirrorArrival');
      assert.ok(tail, 'the separate coat panels must join the same transition');
      assert.ok(tail.getX(0) < tail.getX(tail.count - 1), 'the coat hem follows the upper body');
    }
    for (const part of rig.wardrobe) {
      const times = part.mesh.geometry.getAttribute('_mirrorArrival');
      for (let i = 0; i < times.count; i++) assert.ok(times.getX(i) < .995, `${part.mesh.name} must finish coating before the pod cut`);
    }
  } finally { models.dispose(); }
});

test('the silver front changes Neo’s skinned silhouette rather than only its color', async () => {
  const asset = await loadGeometry('neo'); const models = new HeroModels(new THREE.Texture(), new THREE.Texture());
  (models as unknown as { load: () => Promise<typeof asset> }).load = async () => asset;
  try {
    const rig = (await models.create('neo'))!;
    const skin = rig.wardrobe.find(part => (part.mesh.material as THREE.Material).name === 'Skin')!.mesh.material as THREE.MeshStandardMaterial;
    const shader = { vertexShader: '#include <common>\n#include <skinning_vertex>\n#include <project_vertex>', fragmentShader: '#include <common>\n#include <metalnessmap_fragment>', uniforms: {} };
    skin.onBeforeCompile(shader as Parameters<typeof skin.onBeforeCompile>[0], {} as THREE.WebGLRenderer);
    const afterSkinning = shader.vertexShader.indexOf('#include <skinning_vertex>');
    const displacement = shader.vertexShader.indexOf('transformed +=');
    const beforeProjection = shader.vertexShader.indexOf('#include <project_vertex>');
    assert.ok(afterSkinning < displacement && displacement < beforeProjection, 'the liquid must lift posed vertices before projection');
    assert.equal((shader.uniforms as { matrixSilver?: unknown }).matrixSilver, rig.silver, 'the saved silver progress drives the same moving ridge');
  } finally { models.dispose(); }
});

test('Neo keeps a continuous patient body through rescue and medical recovery', async () => {
  const asset = await loadGeometry('neo'); const models = new HeroModels(new THREE.Texture(), new THREE.Texture());
  (models as unknown as { load: () => Promise<typeof asset> }).load = async () => asset;
  try {
    const rig = (await models.create('neo'))!; const motion = newMotion();
    const input = { speed: 0, grounded: false, verticalVelocity: 0, turn: 0, realWorld: true, performance: 'pod' as const };
    models.animate(rig, advanceMotion(motion, input, 0), motion, input, 0);
    const patientBody = rig.wardrobe.filter(part => !part.mesh.userData.office && (part.mesh.material as THREE.Material).name === 'Trousers');
    assert.equal(patientBody.length, 2, 'the shipped model has separate torso and leg underlayers');
    for (const part of patientBody) assert.equal(part.mesh.visible, true, `${part.mesh.name} must fill the absent anatomical torso and legs`);
    assert.equal(rig.wardrobe.find(part => (part.mesh.material as THREE.Material).name === 'Coat wool')?.mesh.visible, false);
    const shirt = patientBody[0];
    const podColor = (shirt.mesh.material as THREE.MeshStandardMaterial).color.getHex();
    models.animate(rig, advanceMotion(motion, { ...input, performance: 'recover' }, 0), motion, { ...input, performance: 'recover' }, 0);
    assert.equal((shirt.mesh.material as THREE.MeshStandardMaterial).color.getHex(), podColor, 'medical recovery continues the patient appearance');
    assert.equal(rig.wardrobe.find(part => (part.mesh.material as THREE.Material).name === 'Coat wool')?.mesh.visible, false);
    models.animate(rig, advanceMotion(motion, { ...input, performance: undefined }, 0), motion, { ...input, performance: undefined }, 0);
    assert.notEqual((shirt.mesh.material as THREE.MeshStandardMaterial).color.getHex(), podColor, 'ship clothing returns when recovery ends');
  } finally { models.dispose(); }
});

test('Trinity’s fitted outfit has no open waist during the club conversation', async () => {
  const asset = await loadGeometry('trinity'); const models = new HeroModels(new THREE.Texture(), new THREE.Texture());
  (models as unknown as { load: () => Promise<typeof asset> }).load = async () => asset;
  const rig = (await models.create('trinity'))!;
  try {
    for (const phase of ['introduction', 'whisper', 'question'] as const) {
      const motion = newMotion(); const input = { speed: 0, grounded: true, verticalVelocity: 0, turn: 0, glasses: false, clubClothes: true,
        club: { role: 'trinity' as const, phase, elapsed: 3 } };
      models.animate(rig, advanceMotion(motion, input, 0), motion, input, 0); rig.root.updateMatrixWorld(true);
      const clothes = rig.wardrobe.filter(part => part.mesh.visible && part.mesh instanceof THREE.SkinnedMesh && /Coat|Trousers/.test((part.mesh.material as THREE.Material).name)).map(part => part.mesh as THREE.SkinnedMesh);
      clothes.forEach(mesh => { mesh.skeleton.update(); mesh.computeBoundingSphere(); });
      for (const x of [-.16, 0, .16]) for (const y of [2.38, 2.46, 2.54, 2.62]) {
        const ray = new THREE.Raycaster(new THREE.Vector3(x, y, 2), new THREE.Vector3(0, 0, -1), 0, 2);
        assert.ok(ray.intersectObjects(clothes).length > 0, `open waist during ${phase} at ${x}, ${y}`);
      }
    }
  } finally { models.dispose(); }
});

test('the office rigs reach the keyboard, clipboard and the signature on the delivered form', async () => {
  const [neo, smith, office] = await Promise.all([loadGeometry(), loadGeometry('smith'), loadGeometry('neo-office')]);
  const models = new HeroModels(new THREE.Texture(), new THREE.Texture());
  (models as unknown as { load: (id: string) => Promise<typeof neo> }).load = async id => id === 'neo-office' ? office : id === 'smith' ? smith : neo;
  const center = FILM_SETS.film_metacortex_floor.center; const origin = new THREE.Vector3(center.x, center.y - 1, center.z);
  try {
    for (const role of ['neo', 'rhineheart', 'courier'] as const) {
      const rig = (await models.create(role === 'rhineheart' ? 'smith' : 'neo', undefined, role === 'neo' ? undefined : role))!;
      for (const elapsed of [1.05, 1.4, 1.9, 2.5, 3.4]) {
        const gesture = { phase: role === 'rhineheart' ? 'briefing' as const : 'signing' as const, elapsed, role };
        const position = role === 'rhineheart' ? OFFICE_WORKDAY.manager : role === 'courier' ? officeCourierRoot(gesture) : officeRecipientRoot(gesture);
        rig.root.position.copy(origin).add(new THREE.Vector3(position.x, 0, position.z)); rig.root.rotation.y = position.yaw;
        const motion = newMotion(); const input = { speed: 0, grounded: true, verticalVelocity: 0, turn: 0, officeShirt: role === 'neo', workday: gesture };
        models.animate(rig, advanceMotion(motion, input, 0), motion, input, 0); rig.root.updateMatrixWorld(true);
        if (role === 'neo' && elapsed < 2.55) {
          const pen = rig.root.getObjectByName('delivery-signature-pen')!; assert.ok(pen.visible);
          const target = officePenPoint(gesture); const nib = pen.getWorldPosition(new THREE.Vector3());
          assert.ok(nib.distanceTo(origin.clone().add(new THREE.Vector3(target.x, target.y, target.z))) < .06, `Neo's pen misses the form at ${elapsed}: ${nib.toArray()}`);
          const grip = nib.clone().add(new THREE.Vector3(0, .15, 0));
          for (const finger of [1, 2]) {
            const joint = rig.bones.get(`finger${finger}-3_R`)!;
            const tip = joint.localToWorld(joint.position.clone().normalize().multiplyScalar(.04));
            assert.ok(tip.distanceTo(grip) < .065, `finger ${finger} does not grip the pen at ${elapsed}: ${tip.distanceTo(grip)}`);
          }
        } else if (role === 'courier') {
          const board = officeClipboardPoint(gesture); const contact = origin.clone().add(new THREE.Vector3(board.x - .3, board.y - .045, board.z + .05));
          const palm = rig.bones.get('wrist_L')!.localToWorld(new THREE.Vector3(-.065, -.17, .01));
          assert.ok(palm.distanceTo(contact) < .04, `the clipboard floats away from the courier at ${elapsed}: ${palm.distanceTo(contact)}`);
          assert.equal(rig.glasses.visible, false); assert.ok(rig.panels.every(panel => !panel.mesh.visible));
        } else if (role === 'rhineheart') {
          for (const side of ['R', 'L']) {
            const palm = rig.bones.get('wrist_' + side)!.localToWorld(new THREE.Vector3(side === 'R' ? .065 : -.065, -.17, .01)).sub(origin);
            assert.ok(Math.abs(palm.x + 22.3) < .04 && Math.abs(palm.y - 2.7) < .055, 'the manager must type on the keyboard, not above his lap');
          }
        }
      }
    }
  } finally { models.dispose(); }
});

test('Neo’s office shirt covers his waist when he leans over the signature form', async () => {
  const [neo, office] = await Promise.all([loadGeometry(), loadGeometry('neo-office')]);
  const models = new HeroModels(new THREE.Texture(), new THREE.Texture());
  (models as unknown as { load: (id: string) => Promise<typeof neo> }).load = async id => id === 'neo-office' ? office : neo;
  const rig = (await models.create('neo'))!;
  try {
    for (const elapsed of [0, 1.1, 2, 3.4]) {
      const motion = newMotion(); const input = { speed: 0, grounded: true, verticalVelocity: 0, turn: 0, officeShirt: true,
        workday: { role: 'neo' as const, phase: 'signing' as const, elapsed } };
      const position = officeRecipientRoot(input.workday); const center = FILM_SETS.film_metacortex_floor.center;
      rig.root.position.set(center.x + position.x, center.y - 1, center.z + position.z); rig.root.rotation.y = position.yaw;
      models.animate(rig, advanceMotion(motion, input, 0), motion, input, 0); rig.root.updateMatrixWorld(true);
      const clothes = rig.wardrobe.filter(part => part.mesh.visible && part.mesh instanceof THREE.SkinnedMesh).map(part => part.mesh as THREE.SkinnedMesh);
      clothes.forEach(mesh => { mesh.skeleton.update(); mesh.computeBoundingSphere(); });
      for (const x of [-.23, 0, .23]) for (const y of [2.5, 2.6, 2.7, 2.8]) {
        const from = rig.root.localToWorld(new THREE.Vector3(x, y, 2));
        const direction = new THREE.Vector3(0, 0, -1).applyQuaternion(rig.root.getWorldQuaternion(new THREE.Quaternion()));
        const hit = new THREE.Raycaster(from, direction, 0, 2).intersectObjects(clothes)[0];
        assert.ok(hit && (hit.object as THREE.Mesh).material instanceof THREE.Material);
        assert.notEqual(((hit.object as THREE.Mesh).material as THREE.Material).name, 'Office skin', `bare waist at ${elapsed}s, ${x}, ${y}`);
      }
    }
  } finally { models.dispose(); }
});

test('the physical glass doorway stays clear at walking height and the delivered board follows the saved clock', t => {
  const document = globalThis.document;
  globalThis.document = { createElement: () => ({ getContext: () => ({ fillRect() {}, fillText() {} }) }) } as unknown as Document;
  t.mock.method(THREE.TextureLoader.prototype, 'load', () => new THREE.Texture());
  const root = new THREE.Group(); const renderer = new OfficeWorkdayRenderer(root);
  try {
    root.updateMatrixWorld(true);
    for (const x of [-12, -11, -10.3]) for (const y of [1, 3.8]) {
      const ray = new THREE.Raycaster(new THREE.Vector3(x, y, 20.8), new THREE.Vector3(0, 0, 1), 0, 2.9);
      assert.equal(ray.intersectObject(root, true).length, 0, 'the open door, sign and trim cannot cross the walkable entrance');
    }
    const journey: FilmJourney = { version: 1, scene: 'm1_boss', actor: 'neo', step: 1, completed: [], enteredAt: 0, reflections: {}, checkpoint: { x: 0, y: 0, z: 0 }, lastText: '', workday: { phase: 'signing', elapsed: 1.9 } };
    renderer.update(journey); const board = root.getObjectByName('delivery-clipboard')!;
    const expected = officeClipboardPoint(journey.workday!); assert.deepEqual(board.position.toArray(), [expected.x, expected.y, expected.z]);
    journey.workday!.phase = 'released'; renderer.update(journey); assert.equal(board.visible, false);
  } finally { renderer.dispose(); globalThis.document = document; }
});

test('the actual car occupants fit below the roof and Trinity holds both scanner grips', async () => {
  const [neo, trinity, office] = await Promise.all([loadGeometry(), loadGeometry('trinity'), loadGeometry('neo-office')]);
  const models = new HeroModels(new THREE.Texture(), new THREE.Texture());
  (models as unknown as { load: (id: string) => Promise<typeof neo> }).load = async id => id === 'neo-office' ? office : id === 'trinity' ? trinity : neo;
  const center = FILM_SETS.film_adams_bridge.center;
  let patient: HeroRig | undefined;
  try {
    for (const role of ['neo', 'trinity', 'switch', 'apoc'] as const) {
      const rig = (await models.create(role === 'switch' || role === 'trinity' ? 'trinity' : 'neo'))!;
      if (role === 'neo') patient = rig;
      for (const [phase, elapsed] of [['choice', 0], ['located', 0], ['removing', 2.25], ['discarding', 2.25], ['discarding', 4], ['done', 0], ['driving', 8], ['driving', 41], ['parked', 0]] as const) {
        const gesture = { phase, elapsed, role, bugged: true };
        const position = meetingRoot({ ...gesture, approach: { ...MEETING_CAR.approach, yaw: -Math.PI / 2 } }, role);
        rig.root.position.set(center.x + position.x, center.y - 1, center.z + position.z); rig.root.rotation.y = position.yaw;
        const motion = newMotion(); const input = { speed: 0, grounded: true, verticalVelocity: 0, turn: 0, meeting: gesture };
        models.animate(rig, advanceMotion(motion, input, 0), motion, input, 0); rig.root.updateMatrixWorld(true);
        const head = rig.bones.get('head')!.getWorldPosition(new THREE.Vector3());
        assert.ok(head.y + .4 < MEETING_CAR.height, `${role} head intersects the roof in ${phase}: ${head.y}`);
        if (role !== 'trinity') continue;
        const scanner = rig.root.getObjectByName('extraction-scanner')!;
        const pump = rig.root.getObjectByName('scanner-pump')!;
        if (phase === 'done' || phase === 'driving' || phase === 'parked') {
          assert.equal(scanner.visible, false);
          for (const side of ['R', 'L']) assert.ok(rig.bones.get('wrist_' + side)!.getWorldPosition(new THREE.Vector3()).y < 2.1, 'after putting the scanner away, hands return to the lap');
          continue;
        }
        if (phase === 'discarding') scanner.traverse(object => {
          if (!(object instanceof THREE.Mesh)) return;
          const gap = new THREE.Box3().setFromObject(object).distanceToPoint(head);
          assert.ok(gap > .33, `the scanner passes through Trinity's head at ${elapsed}s: ${gap}`);
        });
        if (phase === 'located') {
          const patientGesture = { ...gesture, role: 'neo' as const };
          const patientPosition = meetingRoot({ ...patientGesture, approach: { ...MEETING_CAR.approach, yaw: Math.PI } }, 'neo');
          patient!.root.position.set(center.x + patientPosition.x, center.y - 1, center.z + patientPosition.z); patient!.root.rotation.y = patientPosition.yaw;
          const patientMotion = newMotion(); const patientInput = { speed: 0, grounded: true, verticalVelocity: 0, turn: 0, meeting: patientGesture };
          models.animate(patient!, advanceMotion(patientMotion, patientInput, 0), patientMotion, patientInput, 0); patient!.root.updateMatrixWorld(true);
          const probe = scanner.localToWorld(new THREE.Vector3()); let distance = Infinity;
          const point = new THREE.Vector3();
          for (const part of patient!.wardrobe) if (part.mesh instanceof THREE.SkinnedMesh && (part.mesh.material as THREE.Material).name === 'Office skin') {
            part.mesh.skeleton.update(); const positions = part.mesh.geometry.attributes.position;
            for (let i = 0; i < positions.count; i++) if (Math.abs(positions.getX(i)) < .4 && positions.getY(i) > 2.5 && positions.getY(i) < 3.1 && positions.getZ(i) > .15) {
              part.mesh.getVertexPosition(i, point); part.mesh.localToWorld(point); distance = Math.min(distance, point.distanceTo(probe));
            }
          }
          assert.ok(distance < .13, `the suction cup must meet Neo's actual abdomen: gap ${distance}`);
        }
        for (const [side, grip] of [['R', new THREE.Vector3(-.2, 1.15 + pump.position.y, 0)], ['L', new THREE.Vector3(-.31, .9, 0)]] as const) {
          const palm = rig.bones.get('wrist_' + side)!.localToWorld(new THREE.Vector3(side === 'R' ? .06 : -.06, -.17, .015));
          const gap = palm.distanceTo(scanner.localToWorld(grip.clone()));
          assert.ok(gap < .045, `Trinity must actually reach the ${side} scanner grip in ${phase}: ${gap}; shoulder ${rig.bones.get('shoulder_' + side)!.getWorldPosition(new THREE.Vector3()).sub(new THREE.Vector3(center.x, 0, center.z + MEETING_CAR.z)).toArray()}; grip ${scanner.localToWorld(grip.clone()).sub(new THREE.Vector3(center.x, 0, center.z + MEETING_CAR.z)).toArray()}`);
        }
      }
    }
  } finally { models.dispose(); }
});

test('Trinity ducks out of the opposite rear door and stands before becoming the hotel guide', async () => {
  const trinity = await loadGeometry('trinity'); const models = new HeroModels(new THREE.Texture(), new THREE.Texture());
  (models as unknown as { load: (id: string) => Promise<typeof trinity> }).load = async () => trinity;
  const rig = (await models.create('trinity'))!; const center = FILM_SETS.film_adams_bridge.center;
  const idle = { speed: 0, grounded: true, verticalVelocity: 0, turn: 0 }; const standing = newMotion();
  models.animate(rig, advanceMotion(standing, idle, 0), standing, idle, 0); rig.root.updateMatrixWorld(true);
  const standingHead = rig.bones.get('head')!.getWorldPosition(new THREE.Vector3()).y;
  try {
    let previous: THREE.Vector3 | undefined;
    for (let elapsed = 0; elapsed <= 8; elapsed += .2) {
      const gesture = { phase: 'exiting' as const, elapsed, role: 'trinity' as const, bugged: false };
      const pose = meetingRoot({ ...gesture, approach: { ...MEETING_CAR.approach, yaw: Math.PI } }, 'trinity');
      rig.root.position.set(center.x + pose.x, center.y - 1, center.z + pose.z); rig.root.rotation.y = pose.yaw;
      const motion = newMotion(); const input = { speed: 0, grounded: true, verticalVelocity: 0, turn: 0, meeting: gesture };
      models.animate(rig, advanceMotion(motion, input, 0), motion, input, 0); rig.root.updateMatrixWorld(true);
      const head = rig.bones.get('head')!.getWorldPosition(new THREE.Vector3());
      const car = meetingCarPose(gesture); const dx = pose.x - car.x; const dz = pose.z - car.z;
      const localX = dx * Math.cos(car.yaw) - dz * Math.sin(car.yaw);
      if (Math.abs(localX) < 2.6) assert.ok(head.y + .4 < MEETING_CAR.height, `head intersects the roof at ${elapsed}s`);
      if (previous) assert.ok(head.distanceTo(previous) < .5, 'the exit cannot snap the head between seated and standing');
      if (elapsed > 7.5) assert.ok(Math.abs(head.y - standingHead) < .08, `the guide must stand up before walking: ${head.y} vs ${standingHead}`);
      previous = head;
    }
  } finally { models.dispose(); }
});

test('Neo office clothing replaces his coat and binds its complete sleeves to the existing skeleton', async () => {
  const models = new HeroModels(new THREE.Texture(), new THREE.Texture());
  const [neo, office] = await Promise.all([loadGeometry(), loadGeometry('neo-office')]);
  (models as unknown as { load: (id: string) => Promise<typeof neo> }).load = async id => id === 'neo-office' ? office : neo;
  const rig = (await models.create('neo'))!; const motion = newMotion();
  const input = { speed: 0, grounded: true, verticalVelocity: 0, turn: 0, officeShirt: true };
  models.animate(rig, advanceMotion(motion, input, .05), motion, input, .05);
  try {
    const garments = rig.wardrobe.filter(part => /Tailored.coat.upper|Black.crew.neck/i.test(part.mesh.name));
    assert.equal(garments.length, 2); assert.ok(garments.every(part => !part.mesh.visible), 'the old coat and undershirt cannot intersect the white shirt');
    const shirt = rig.wardrobe.find(part => part.mesh.material instanceof THREE.MeshStandardMaterial && part.mesh.material.name === 'Office cotton')!.mesh as THREE.SkinnedMesh;
    assert.ok(shirt.visible); assert.equal(shirt.skeleton.bones[0], rig.bones.get('pelvis'));
    const wrist = new THREE.Vector3().setFromMatrixPosition(shirt.skeleton.boneInverses[shirt.skeleton.bones.indexOf(rig.bones.get('wrist_R')!)].clone().invert());
    shirt.geometry.computeBoundingBox(); assert.ok(shirt.geometry.boundingBox!.min.y < wrist.y, 'clipping away trousers must preserve the shirt cuffs');
    const trousers = rig.wardrobe.find(part => /Tailored.trousers/i.test(part.mesh.name))!.mesh;
    trousers.geometry.computeBoundingBox();
    const positions = shirt.geometry.attributes.position; const joints = shirt.geometry.attributes.skinIndex; const weights = shirt.geometry.attributes.skinWeight;
    let hem = Infinity;
    for (let i = 0; i < positions.count; i++) {
      let trunk = 0;
      for (let j = 0; j < 4; j++) if (joints.array[i * 4 + j] < 3) trunk += weights.array[i * 4 + j];
      if (trunk > .9) hem = Math.min(hem, positions.getY(i));
    }
    assert.ok(hem < trousers.geometry.boundingBox!.max.y, `the shirt must overlap the actual trouser waist, without a bare midriff: hem ${hem}`);
    models.animate(rig, advanceMotion(motion, { ...input, officeShirt: false }, .05), motion, { ...input, officeShirt: false }, .05);
    assert.equal(shirt.visible, false); assert.ok(garments.every(part => part.mesh.visible));
  } finally { models.dispose(); }
});

test('Smith presents the tracker without putting his forearm through his face', async () => {
  const smith = await loadGeometry('smith'); const models = new HeroModels(new THREE.Texture(), new THREE.Texture());
  (models as unknown as { load: (id: string) => Promise<typeof smith> }).load = async () => smith;
  const rig = (await models.create('smith'))!; const motion = newMotion();
  try {
    for (const elapsed of [14.8, 15.5, 16, 16.5, 17, 17.599]) {
      const pose = interrogationRoot({ phase: 'coercion', elapsed, approach: { x: 0, z: 0, yaw: 0 } }, 'smith');
      const center = FILM_SETS.film_agent_interrogation.center;
      rig.root.position.set(center.x + pose.x, center.y - 1, center.z + pose.z); rig.root.rotation.y = pose.yaw;
      const input = { speed: 0, grounded: true, verticalVelocity: 0, turn: 0, interrogation: { phase: 'coercion' as const, elapsed, role: 'smith' as const } };
      models.animate(rig, advanceMotion(motion, input, 0), motion, input, 0); rig.root.updateMatrixWorld(true);
      const face = rig.bones.get('head')!.localToWorld(new THREE.Vector3(0, -.06, .18));
      const elbow = rig.bones.get('elbow_R')!.getWorldPosition(new THREE.Vector3()); const wrist = rig.bones.get('wrist_R')!.getWorldPosition(new THREE.Vector3());
      const nearest = new THREE.Line3(elbow, wrist).closestPointToPoint(face, true, new THREE.Vector3());
      assert.ok(nearest.distanceTo(face) > .36, `the forearm covers/intersects Smith's face at ${elapsed}s: gap ${nearest.distanceTo(face)}`);
      if (elapsed === 17.599) {
        const tracker = rig.root.getObjectByName('interrogation-tracker')!.getWorldPosition(new THREE.Vector3());
        const release = new THREE.Vector3(center.x - .43, center.y - 1 + 3.1, center.z + .01);
        assert.ok(tracker.distanceTo(release) < .055, `the tracker must reach its release point before leaving the hand: gap ${tracker.distanceTo(release)}, tracker ${tracker.toArray()}, release ${release.toArray()}, shoulder ${rig.bones.get('shoulder_R')!.getWorldPosition(new THREE.Vector3()).toArray()}`);
      }
    }
  } finally { models.dispose(); }
});

test('the interrogation holds Neo above the table with the agents outside its solid footprint', async () => {
  const [neo, smith, office] = await Promise.all([loadGeometry(), loadGeometry('smith'), loadGeometry('neo-office')]);
  const models = new HeroModels(new THREE.Texture(), new THREE.Texture());
  (models as unknown as { load: (id: string) => Promise<typeof neo> }).load = async id => id === 'neo-office' ? office : id === 'neo' ? neo : smith;
  const center = FILM_SETS.film_agent_interrogation.center; const rigs: HeroRig[] = [];
  try {
    for (const role of ['neo', 'smith', 'agent_jones', 'agent_brown'] as const) {
      const rig = (await models.create(role === 'neo' ? 'neo' : 'smith', role.startsWith('agent_') ? role as 'agent_jones' | 'agent_brown' : undefined))!; rigs.push(rig);
      const gesture = { phase: 'coercion' as const, elapsed: 19, role };
      const position = interrogationRoot({ ...gesture, approach: { x: INTERROGATION_ROOM.approach.x, z: 0, yaw: -Math.PI / 2 } }, role);
      rig.root.position.set(center.x + position.x, center.y - 1, center.z + position.z); rig.root.rotation.y = position.yaw;
      const motion = newMotion(); const input = { speed: 0, grounded: true, verticalVelocity: 0, turn: 0, officeShirt: role === 'neo', interrogation: gesture };
      models.animate(rig, advanceMotion(motion, input, 0), motion, input, 0); rig.root.updateMatrixWorld(true);
      const point = new THREE.Vector3(); const table = INTERROGATION_ROOM.table;
      if (role !== 'neo') {
        assert.ok(Math.abs(position.x) > table.width / 2 + .4 || Math.abs(position.z) > table.depth / 2 + .4, `${role} stands outside the tabletop`);
        continue;
      }
      let lowest = Infinity;
      let contact = '';
      for (const part of rig.wardrobe) {
        const mesh = part.mesh;
        if (!(mesh instanceof THREE.SkinnedMesh) || !mesh.visible) continue;
        mesh.skeleton.update();
        for (let i = 0; i < mesh.geometry.attributes.position.count; i++) {
          mesh.getVertexPosition(i, point); mesh.localToWorld(point); point.sub(new THREE.Vector3(center.x, center.y - 1, center.z));
          if (Math.abs(point.x) < table.width / 2 - .1 && Math.abs(point.z) < table.depth / 2 - .1 && point.y < lowest) { lowest = point.y; contact = `${mesh.name} vertex ${i} at ${point.toArray()}`; }
        }
      }
      assert.ok(lowest >= table.height - .025, `the actual body and clothes must not pass through the steel top: ${contact}`);
    }
  } finally { models.dispose(); }
});

test('the handset casing never hides its screen and opening the slider reveals the keypad', () => {
  // Geometry visibility uses the actual prop; image appearance is checked in the browser.
  const document = globalThis.document;
  globalThis.document = { createElement: () => ({ getContext: () => ({ fillRect() {}, strokeRect() {}, fillText() {} }) }) } as unknown as Document;
  const phone = new PhoneModel();
  try {
    const visible = (name: string) => {
      phone.root.updateMatrixWorld(true); const target = phone.root.getObjectByName(name)!;
      const point = target.getWorldPosition(new THREE.Vector3()); const camera = point.clone().add(new THREE.Vector3(.06, .16, .5));
      return new THREE.Raycaster(camera, point.clone().sub(camera).normalize()).intersectObject(phone.root, true)[0].object;
    };
    assert.equal(visible('phone-lcd').name, 'phone-lcd');
    assert.notEqual(visible('phone-keypad').name, 'phone-keypad');
    phone.update(1); assert.equal(visible('phone-keypad').name, 'phone-keypad');
  } finally { phone.dispose(); globalThis.document = document; }
});

test('Neo reaches the parcel and keeps the phone at his ear while walking and crouching', async () => {
  const { scene } = await loadGeometry(); const bones = new Map<string, THREE.Bone>(); const rest = new Map<string, THREE.Vector3>();
  scene.traverse(object => { if (object instanceof THREE.Bone) { bones.set(object.name, object); rest.set(object.name, object.position.clone()); } });
  scene.updateMatrixWorld(true);
  const models = new HeroModels(new THREE.Texture(), new THREE.Texture());
  const rig: HeroRig = { root: scene, bones, rest, panels: [], footHeight: bones.get('ankle_L')!.getWorldPosition(new THREE.Vector3()).y, glasses: new THREE.Group(), silver: { value: 0 }, wardrobe: [] };
  const state = newMotion(); const wrist = bones.get('wrist_R')!;
  const pickup = { speed: 0, grounded: true, verticalVelocity: 0, turn: 0, phone: { phase: 'pickup' as const, elapsed: .65 } };
  models.animate(rig, advanceMotion(state, pickup, .05), state, pickup, .05); scene.updateMatrixWorld(true);
  assert.ok(wrist.getWorldPosition(new THREE.Vector3()).distanceTo(new THREE.Vector3(-.5, 2.635, 1.2)) < .025, 'the hand must actually reach the phone on the desk');
  const ready = { ...pickup, phone: { phase: 'ready' as const, elapsed: 0 } };
  models.animate(rig, advanceMotion(state, ready, .05), state, ready, .05); scene.updateMatrixWorld(true);
  scene.traverse(object => { if (object instanceof THREE.SkinnedMesh) object.skeleton.update(); });
  const camera = new THREE.Vector3(-.7, 4.25, -.5); const screen = new THREE.Vector3(-.38, 3.255, .66);
  const view = new THREE.Raycaster(camera, screen.clone().sub(camera).normalize(), 0, camera.distanceTo(screen));
  assert.equal(view.intersectObject(scene, true).length, 0, 'the actual coat and hand must not hide the handset screen');
  for (const crouching of [false, true]) for (let frame = 0; frame < 60; frame++) {
    const input = { speed: 5, grounded: true, verticalVelocity: 0, turn: 1, crouching, phone: { phase: 'connected' as const, elapsed: 11 } };
    models.animate(rig, advanceMotion(state, input, .05), state, input, .05); scene.updateMatrixWorld(true);
    const ear = bones.get('head')!.localToWorld(new THREE.Vector3(-.43, -.25, .17));
    assert.ok(wrist.getWorldPosition(new THREE.Vector3()).distanceTo(ear) < .025, 'the phone follows the head through movement');
  }
  const idle = { speed: 0, grounded: true, verticalVelocity: 0, turn: 0 };
  models.animate(rig, advanceMotion(state, idle, .05), state, idle, .05);
  assert.ok(wrist.quaternion.angleTo(new THREE.Quaternion()) < .0001, 'putting the phone away restores the wrist');
  models.dispose();
});

test('Neo takes the apartment handset from its physical cradle and returns it after the call', async () => {
  const { scene } = await loadGeometry(); const bones = new Map<string, THREE.Bone>(); const rest = new Map<string, THREE.Vector3>();
  scene.traverse(object => { if (object instanceof THREE.Bone) { bones.set(object.name, object); rest.set(object.name, object.position.clone()); } });
  const position = filmPosition('film_anderson_flat', APARTMENT.phone.approachX, APARTMENT.phone.approachZ);
  scene.position.set(position.x, position.y, position.z); scene.rotation.y = APARTMENT.phone.yaw; scene.updateMatrixWorld(true);
  const models = new HeroModels(new THREE.Texture(), new THREE.Texture());
  const rig: HeroRig = { root: scene, bones, rest, panels: [], footHeight: bones.get('ankle_L')!.getWorldPosition(new THREE.Vector3()).y - position.y,
    glasses: new THREE.Group(), silver: { value: 0 }, wardrobe: [] };
  const motion = newMotion();
  try {
    const pickup = { speed: 0, grounded: true, verticalVelocity: 0, turn: 0,
      wakeCall: { phase: 'pickup' as const, elapsed: .65, nightmare: true } };
    models.animate(rig, advanceMotion(motion, pickup, .05), motion, pickup, .05); scene.updateMatrixWorld(true);
    const center = FILM_SETS.film_anderson_flat.center;
    const cradle = new THREE.Vector3(center.x + APARTMENT.phone.x, center.y - 1 + APARTMENT.phone.y + .48, center.z + APARTMENT.phone.z + .22);
    const wrist = bones.get('wrist_R')!;
    const held = scene.getObjectByName('neo-landline-handset')!; const heldAtPickup = held.getWorldPosition(new THREE.Vector3()); const pickupGap = heldAtPickup.distanceTo(cradle);
    assert.ok(pickupGap < .06, `the held handset must replace the cradle handset without a jump; gap ${pickupGap}`);
    assert.ok(wrist.getWorldPosition(new THREE.Vector3()).distanceTo(cradle) < .12, 'Neo hand must visibly meet the cradle during the transfer');
    assert.equal(held.visible, true);

    const listening = { ...pickup, wakeCall: { phase: 'listening' as const, elapsed: 2, nightmare: true } };
    models.animate(rig, advanceMotion(motion, listening, .05), motion, listening, .05); scene.updateMatrixWorld(true);
    const ear = bones.get('head')!.localToWorld(new THREE.Vector3(-.43, -.25, .17));
    assert.ok(wrist.getWorldPosition(new THREE.Vector3()).distanceTo(ear) < .025, 'the handset must stay at Neo ear while Morpheus speaks');

    const returned = { ...pickup, wakeCall: { phase: 'reply' as const, elapsed: 3.2, nightmare: true } };
    models.animate(rig, advanceMotion(motion, returned, .05), motion, returned, .05);
    assert.equal(scene.getObjectByName('neo-landline-handset')!.visible, false, 'the hand-held duplicate disappears when the physical handset returns to its base');
  } finally { models.dispose(); }
});

test('the left hand reaches and turns the window handle while the right hand holds the phone', async () => {
  const { scene } = await loadGeometry(); const bones = new Map<string, THREE.Bone>(); const rest = new Map<string, THREE.Vector3>();
  scene.traverse(object => { if (object instanceof THREE.Bone) { bones.set(object.name, object); rest.set(object.name, object.position.clone()); } });
  scene.updateMatrixWorld(true);
  const models = new HeroModels(new THREE.Texture(), new THREE.Texture());
  const rig: HeroRig = { root: scene, bones, rest, panels: [], footHeight: bones.get('ankle_L')!.getWorldPosition(new THREE.Vector3()).y, glasses: new THREE.Group(), silver: { value: 0 }, wardrobe: [] };
  const motion = newMotion();
  for (const elapsed of [.7, 1, 1.2, 1.4]) {
    const input = { speed: 0, grounded: true, verticalVelocity: 0, turn: 0, window: elapsed, phone: { phase: 'connected' as const, elapsed: 11 } };
    models.animate(rig, advanceMotion(motion, input, .05), motion, input, .05); scene.updateMatrixWorld(true);
    const handle = officeWindowPose(elapsed).handle;
    const point = new THREE.Vector3(handle.z - OFFICE_WINDOW.approachZ, handle.y, OFFICE_WINDOW.approachX - handle.x);
    const gap = bones.get('wrist_L')!.localToWorld(new THREE.Vector3(0, -.16, .03)).distanceTo(point);
    assert.ok(gap < .025, `the hand should contact the physical handle at ${elapsed}s; gap ${gap}`);
    const ear = bones.get('head')!.localToWorld(new THREE.Vector3(-.43, -.25, .17));
    assert.ok(bones.get('wrist_R')!.getWorldPosition(new THREE.Vector3()).distanceTo(ear) < .025);
  }
  models.dispose();
});

test('office window cleaners keep the squeegee above their faces during the briefing', async t => {
  const asset = await loadGeometry('club-male');
  t.mock.method(GLTFLoader.prototype, 'loadAsync', async () => asset);
  t.mock.method(THREE.TextureLoader.prototype, 'load', () => new THREE.Texture());
  const document = globalThis.document;
  globalThis.document = { createElement: () => ({ getContext: () => ({ fillRect() {}, strokeRect() {}, fillText() {} }) }) } as unknown as Document;
  const root = new THREE.Group(); const renderer = new OfficeSetRenderer(root, FILM_SETS.film_metacortex_floor);
  const journey: FilmJourney = { version: 1, scene: 'm1_boss', actor: 'neo', step: 0, completed: [], enteredAt: 0, reflections: {}, checkpoint: { x: 0, y: 0, z: 0 }, lastText: '' };
  try {
    await Promise.resolve();
    for (const time of [0, 1.5, 3]) {
      renderer.update(journey, undefined, undefined, undefined, time); root.updateMatrixWorld(true);
      for (let i = 1; i <= 2; i++) {
        const cleaner = root.getObjectByName(`window-cleaner-${i}`)!;
        const head = cleaner.getObjectByName('head')!;
        const blade = root.getObjectByName(`window-squeegee-${i}`)!;
        const gap = blade.getWorldPosition(new THREE.Vector3()).y - head.getWorldPosition(new THREE.Vector3()).y;
        assert.ok(gap > .4, `the squeegee must clear cleaner ${i}'s face at ${time}s: ${gap}`);
      }
    }
  } finally { renderer.dispose(); globalThis.document = document; }
});

test('opening the actual office sash clears the aperture instead of revealing an opaque backdrop', t => {
  t.mock.method(THREE.TextureLoader.prototype, 'load', () => new THREE.Texture());
  const document = globalThis.document;
  globalThis.document = { createElement: () => ({ getContext: () => ({ fillRect() {}, strokeRect() {}, fillText() {} }) }) } as unknown as Document;
  const root = new THREE.Group(); const renderer = new OfficeSetRenderer(root, FILM_SETS.film_metacortex_floor);
  const journey: FilmJourney = { version: 1, scene: 'm1_office_escape', actor: 'neo', step: 2, completed: [], enteredAt: 0, reflections: {}, checkpoint: { x: 0, y: 0, z: 0 }, lastText: '',
    office: { alert: 0, suspicion: [], waypoints: [], lastTick: 0, guide: '', window: 0 } };
  try {
    const ray = new THREE.Raycaster(new THREE.Vector3(-24, 4.5, OFFICE_WINDOW.z), new THREE.Vector3(-1, 0, 0), 0, 3.5);
    renderer.update(journey); root.updateMatrixWorld(true);
    assert.equal(ray.intersectObject(root, true)[0].object.name, 'office-window-glass');
    journey.office!.window = OFFICE_WINDOW.seconds; renderer.update(journey); root.updateMatrixWorld(true);
    assert.equal(ray.intersectObject(root, true).length, 0, 'neither the glass, blinds nor a sky wall may block the open aperture');
    const view = new THREE.Raycaster(new THREE.Vector3(-26.9, 5, -27), new THREE.Vector3(-1, -.3, .25).normalize(), 0, 180);
    assert.ok(view.intersectObject(root, true).length > 0, 'there must be real exterior geometry beyond the window');
    for (const time of [0, .9, 1.4, 2.8]) {
      journey.office!.window = time; renderer.update(journey); root.updateMatrixWorld(true);
      const handle = officeWindowPose(time).handle;
      assert.ok(root.getObjectByName('office-window-grip')!.getWorldPosition(new THREE.Vector3()).distanceTo(new THREE.Vector3(handle.x, handle.y, handle.z)) < .001, 'hand targets must follow the rendered handle, including its lever rotation');
    }
  } finally { renderer.dispose(); globalThis.document = document; }
});

test('the open sash yields to the ledge follow camera and returns when it no longer obscures Neo', t => {
  t.mock.method(THREE.TextureLoader.prototype, 'load', () => new THREE.Texture());
  const document = globalThis.document;
  globalThis.document = { createElement: () => ({ getContext: () => ({ fillRect() {}, strokeRect() {}, fillText() {} }) }) } as unknown as Document;
  const root = new THREE.Group(); const renderer = new OfficeSetRenderer(root, FILM_SETS.film_metacortex_floor);
  const journey: FilmJourney = { version: 1, scene: 'm1_ledge', actor: 'neo', step: 0, completed: ['m1_office_escape'], enteredAt: 0, reflections: {}, checkpoint: { x: 0, y: 0, z: 0 }, lastText: '',
    office: { alert: 0, suspicion: [], waypoints: [], lastTick: 0, guide: '', window: OFFICE_WINDOW.seconds } };
  try {
    renderer.update(journey); root.updateMatrixWorld(true);
    const pane = root.getObjectByName('office-window-glass')! as THREE.Mesh;
    const material = (root.getObjectByName('office-window-grip')! as THREE.Mesh).material as THREE.MeshStandardMaterial;
    const center = pane.getWorldPosition(new THREE.Vector3());
    const normal = new THREE.Vector3(1, 0, 0).transformDirection(pane.matrixWorld);
    const camera = center.clone().addScaledVector(normal, 4);
    const player = center.clone().addScaledVector(normal, -3).add(new THREE.Vector3(0, -2.3, 0));
    renderer.update(journey, camera, player);
    assert.ok(material.opacity <= .15, 'an open sash between the camera and Neo must not cover his body');
    assert.equal(material.depthWrite, false, 'faded metal must not hide the character in the depth buffer');
    renderer.update(journey, camera.clone().add(new THREE.Vector3(0, 0, 20)), player.clone().add(new THREE.Vector3(0, 0, 20)));
    assert.equal(material.opacity, 1); assert.equal(material.depthWrite, true);
    journey.scene = 'm1_office_escape'; journey.office!.crossing = 2;
    renderer.update(journey, camera, player);
    assert.equal(material.opacity, 1, 'the scripted crossing camera retains the visible prop');
  } finally { renderer.dispose(); globalThis.document = document; }
});

test('office and ledge entrances render the same building in world space', t => {
  t.mock.method(THREE.TextureLoader.prototype, 'load', () => new THREE.Texture());
  const document = globalThis.document;
  globalThis.document = { createElement: () => ({ getContext: () => ({ fillRect() {}, strokeRect() {}, fillText() {} }) }) } as unknown as Document;
  const parents = ['film_metacortex_floor', 'film_office_ledge'].map(id => {
    const parent = new THREE.Group(); const set = FILM_SETS[id]; parent.position.set(set.center.x, set.center.y - 1, set.center.z);
    return { parent, renderer: new OfficeSetRenderer(parent, set) };
  });
  try {
    for (const { parent } of parents) parent.updateMatrixWorld(true);
    const positions = parents.map(({ parent }) => parent.getObjectByName('office-window-grip')!.getWorldPosition(new THREE.Vector3()));
    assert.ok(positions[0].distanceTo(positions[1]) < .001, 'window position cannot jump when reloading on the ledge');
    assert.ok(Math.abs(FILM_SETS.film_office_ledge.center.x - FILM_SETS.film_metacortex_floor.center.x - OFFICE_LEDGE_OFFSET) < .001);
  } finally { for (const { renderer } of parents) renderer.dispose(); globalThis.document = document; }
});

test('the playable office ledge looks into a built city canyon instead of empty sky', t => {
  t.mock.method(THREE.TextureLoader.prototype, 'load', () => new THREE.Texture());
  t.mock.method(GLTFLoader.prototype, 'loadAsync', () => new Promise(() => {}));
  const document = globalThis.document;
  globalThis.document = { createElement: () => ({ getContext: () => ({ fillRect() {}, strokeRect() {}, fillText() {} }) }) } as unknown as Document;
  const parent = new THREE.Group(); const renderer = new OfficeSetRenderer(parent, FILM_SETS.film_office_ledge);
  try {
    const building = parent.children[0]; building.updateWorldMatrix(true, true);
    const eye = building.localToWorld(new THREE.Vector3(OFFICE_LEDGE_OFFSET, 5, 35));
    const facade = building.localToWorld(new THREE.Vector3(OFFICE_LEDGE_OFFSET - 32, 5, 108));
    const direction = facade.sub(eye).normalize();
    const hit = new THREE.Raycaster(eye, direction, 0, 140).intersectObject(building, true)[0];
    assert.ok(hit, 'the route to the scaffold needs visible exterior geometry ahead');
    assert.ok(hit.point.z > 75 && hit.point.y > 0, 'the camera should see a raised facade beyond the ledge');
    const streetEye = building.localToWorld(new THREE.Vector3(OFFICE_LEDGE_OFFSET - 18, 200, 205));
    const street = new THREE.Raycaster(streetEye, new THREE.Vector3(0, -1, 0), 0, 300).intersectObject(building, true)[0];
    assert.ok(street && building.worldToLocal(street.point).y < -60, 'a distant tower cannot stand in the drivable street');
    const outerEye = building.localToWorld(new THREE.Vector3(OFFICE_LEDGE_OFFSET - 110, 200, 205));
    const ground = new THREE.Raycaster(outerEye, new THREE.Vector3(0, -1, 0), 0, 300).intersectObject(building, true)[0];
    assert.ok(ground && building.worldToLocal(ground.point).y < -60, 'the visible city canyon needs continuous ground beneath its blocks');
  } finally { renderer.dispose(); globalThis.document = document; }
});

test('the crossing body plants its palm and clears the solid sill with both legs', async () => {
  const { scene } = await loadGeometry(); const bones = new Map<string, THREE.Bone>(); const rest = new Map<string, THREE.Vector3>();
  scene.traverse(object => { if (object instanceof THREE.Bone) { bones.set(object.name, object); rest.set(object.name, object.position.clone()); } });
  scene.updateMatrixWorld(true);
  const models = new HeroModels(new THREE.Texture(), new THREE.Texture());
  const rig: HeroRig = { root: scene, bones, rest, panels: [], footHeight: bones.get('ankle_L')!.getWorldPosition(new THREE.Vector3()).y, glasses: new THREE.Group(), silver: { value: 0 }, wardrobe: [] };
  const motion = newMotion();
  for (let frame = 16; frame <= 108; frame++) {
    const elapsed = frame / 20;
    const crossing = officeCrossingPose(elapsed);
    scene.position.set(crossing.x, crossing.y, crossing.z); scene.rotation.y = crossing.yaw;
    const input = { speed: 0, grounded: true, verticalVelocity: 0, turn: 0, crossing: elapsed, phone: { phase: 'connected' as const, elapsed: 11 } };
    models.animate(rig, advanceMotion(motion, input, .05), motion, input, .05); scene.updateMatrixWorld(true);
    if (crossing.grip === 1) {
      const palm = bones.get('wrist_L')!.localToWorld(new THREE.Vector3(0, -.16, .03));
      assert.ok(palm.distanceTo(new THREE.Vector3(crossing.hand.x, crossing.hand.y, crossing.hand.z)) < .035, `palm at ${elapsed}: ${palm.toArray()}, shoulder ${bones.get('shoulder_L')!.getWorldPosition(new THREE.Vector3()).toArray()}`);
    }
    for (const side of ['L', 'R'] as const) {
      const foot = crossing[side === 'L' ? 'left' : 'right']; const ankle = bones.get('ankle_' + side)!.getWorldPosition(new THREE.Vector3());
      assert.ok(ankle.distanceTo(new THREE.Vector3(foot.x, foot.y, foot.z)) < .08, `${side} foot at ${elapsed}: ${ankle.toArray()} instead of ${Object.values(foot)}`);
      const hip = bones.get('hip_' + side)!.getWorldPosition(new THREE.Vector3()); const knee = bones.get('knee_' + side)!.getWorldPosition(new THREE.Vector3());
      for (const [a, b] of [[hip, knee], [knee, ankle]]) for (let n = 0; n <= 30; n++) {
        const point = a.clone().lerp(b, n / 30);
        const wall = point.x > -27.43 && point.x < -26.57 && point.y < 2.73;
        const sill = point.x > -27.08 && point.x < -25.72 && point.y > 2.545 && point.y < 2.955;
        assert.ok(!wall && !sill, `${side} leg crosses the solid sill at ${elapsed}: ${point.toArray()}`);
      }
    }
  }
  models.dispose();
});

for (const id of ['neo', 'trinity', 'smith', 'morpheus']) {
test(`shipped ${id} mesh has valid skinning and usable anatomical bones`, async () => {
  const asset = await loadGeometry(id); const bones = new Map<string, THREE.Bone>();
  let triangles = 0;
  asset.scene.traverse(object => {
    if (object instanceof THREE.Bone) bones.set(object.name, object);
    if (!(object instanceof THREE.SkinnedMesh)) return;
    const skin = object.geometry.getAttribute('skinWeight'); const joints = object.geometry.getAttribute('skinIndex');
    triangles += object.geometry.index!.count / 3;
    for (let i = 0; i < skin.count; i++) {
      let sum = 0;
      for (let c = 0; c < 4; c++) {
        const weight = skin.array[i * 4 + c]; sum += weight;
        assert.ok(weight >= 0 && Number.isFinite(weight));
        assert.ok(joints.array[i * 4 + c] < object.skeleton.bones.length);
      }
      assert.ok(Math.abs(sum - 1) < .00001);
    }
  });
  for (const name of ['pelvis', 'spine', 'chest', 'head', 'shoulder_L', 'elbow_R', 'ankle_L', 'finger5-3_R']) assert.ok(bones.has(name), name);
  assert.ok(triangles > 25000 && triangles < 160000);
  assert.ok(asset.parser.json.extras.height >= 4.2 && asset.parser.json.extras.height <= 4.6);
});

test(`${id} eyes preserve transparent cornea texels instead of masking the iris`, async () => {
  const asset = await loadGeometry(id);
  const eyes = asset.parser.json.materials.find((material: { name: string }) => material.name === 'Eyes');
  assert.ok(['MASK', 'BLEND'].includes(eyes.alphaMode), 'opaque cornea texels cover both pupils');
});

test(`${id} stays grounded and skin deformation stays finite through running, landing and punches`, async () => {
  const { scene } = await loadGeometry(id);
  const bones = new Map<string, THREE.Bone>(); const rest = new Map<string, THREE.Vector3>();
  scene.traverse(object => {
    if (object instanceof THREE.Bone) { bones.set(object.name, object); rest.set(object.name, object.position.clone()); }
  });
  scene.updateMatrixWorld(true);
  const point = new THREE.Vector3(); const models = new HeroModels(new THREE.Texture(), new THREE.Texture());
  const footHeight = point.setFromMatrixPosition(bones.get('ankle_L')!.matrixWorld).y;
  const rig: HeroRig = { root: scene, bones, rest, panels: [], footHeight, glasses: new THREE.Group(), silver: { value: 0 }, wardrobe: [] };
  const motion = newMotion();
  const idleInput = { speed: 0, grounded: true, verticalVelocity: 0, turn: 0 };
  const idle = advanceMotion(motion, idleInput, 1 / 60);
  models.animate(rig, idle, motion, idleInput, 1 / 60); scene.updateMatrixWorld(true);
  const wrist = bones.get('wrist_L')!;
  const openFinger = wrist.worldToLocal(point.setFromMatrixPosition(bones.get('finger3-3_L')!.matrixWorld)).x;
  models.animate(rig, { ...idle, arms: idle.arms.map(arm => ({ ...arm, grip: 1 })) }, motion, idleInput, 1 / 60);
  scene.updateMatrixWorld(true);
  const closedFinger = wrist.worldToLocal(point.setFromMatrixPosition(bones.get('finger3-3_L')!.matrixWorld)).x;
  const fingerLength = bones.get('finger3-2_L')!.position.length() + bones.get('finger3-3_L')!.position.length();
  assert.ok(closedFinger < openFinger - fingerLength * .2, 'fingers curl toward the palm relative to their own length');
  for (let frame = 0; frame < 360; frame++) {
    const input = { speed: frame < 60 ? 0 : 14, grounded: frame < 180 || frame > 220, verticalVelocity: frame < 200 ? 5 : -5,
      turn: Math.sin(frame / 50), attack: frame > 260 ? Math.floor(frame / 50) : undefined };
    const pose = advanceMotion(motion, input, 1 / 60);
    models.animate(rig, pose, motion, input, 1 / 60); scene.updateMatrixWorld(true);
    if (input.grounded) {
      const soles = ['R', 'L'].map(side => point.setFromMatrixPosition(bones.get('ankle_' + side)!.matrixWorld).y - footHeight);
      assert.ok(Math.abs(Math.min(...soles)) < .00001, 'one foot contacts the floor');
    }
    if (frame % 30 === 0) scene.traverse(object => {
      if (!(object instanceof THREE.SkinnedMesh)) return;
      object.skeleton.update();
      for (let v = 0; v < object.geometry.attributes.position.count; v += 19) {
        object.getVertexPosition(v, point);
        assert.ok(point.toArray().every(Number.isFinite));
        assert.ok(point.length() < 8, 'skin cannot explode away from its skeleton');
      }
    });
  }
  models.dispose();
});
}


test('the shipped Neo and Morpheus rigs pass a capsule hand to hand and lift a glass from its actual table position', async () => {
  const assets = await Promise.all(['neo', 'morpheus'].map(id => loadGeometry(id)));
  const center = FILM_SETS.film_lafayette.center;
  const actors = assets.map(({ scene }, index) => {
    const bones = new Map<string, THREE.Bone>(); const rest = new Map<string, THREE.Vector3>();
    scene.traverse(object => { if (object instanceof THREE.Bone) { bones.set(object.name, object); rest.set(object.name, object.position.clone()); } });
    scene.updateMatrixWorld(true);
    const models = new HeroModels(new THREE.Texture(), new THREE.Texture());
    const rig: HeroRig = { root: scene, bones, rest, panels: [], footHeight: bones.get('ankle_L')!.getWorldPosition(new THREE.Vector3()).y, glasses: new THREE.Group(), silver: { value: 0 }, wardrobe: [] };
    const draw = (gesture: PillGesture) => {
      const position = index ? { x: -PILL_ROOM.seat, z: PILL_ROOM.z, yaw: Math.PI / 2 } : pillRoot({ ...gesture, approach: { x: 0, z: -4, yaw: Math.PI } });
      scene.position.set(center.x + position.x, center.y - 1, center.z + position.z); scene.rotation.y = position.yaw;
      const motion = newMotion(); const input = { speed: 0, grounded: true, verticalVelocity: 0, turn: 0, pills: gesture };
      models.animate(rig, advanceMotion(motion, input, 0), motion, input, 0); scene.updateMatrixWorld(true);
      return (name: string) => scene.getObjectByName(name)!;
    };
    return { models, rig, draw };
  });
  try {
    for (const choice of ['red', 'blue'] as const) {
      const offered = actors[1].draw({ phase: 'taking', elapsed: PILL_TIMING.transfer - .001, choice, role: 'morpheus' })(`held-${choice}-pill`);
      const previous = offered.getWorldPosition(new THREE.Vector3()); assert.ok(offered.visible);
      actors[1].rig.root.traverse(object => { if (object instanceof THREE.SkinnedMesh) { object.skeleton.update(); object.computeBoundingSphere(); } });
      const visible = new THREE.Raycaster(previous.clone().add(new THREE.Vector3(0, .6, 0)), new THREE.Vector3(0, -1, 0), 0, .8).intersectObject(actors[1].rig.root, true)[0];
      assert.equal(visible?.object.name, `held-${choice}-pill`, `the ${choice} capsule must be above the skin, not buried inside the palm`);
      const received = actors[0].draw({ phase: 'taking', elapsed: PILL_TIMING.transfer, choice, role: 'neo' })(`held-${choice}-pill`);
      assert.ok(received.visible); const error = received.getWorldPosition(new THREE.Vector3()).distanceTo(previous);
      assert.ok(error < .055, `${choice} handoff gap ${error}: ${received.getWorldPosition(new THREE.Vector3()).toArray()} versus ${previous.toArray()}`);
      assert.equal(actors[1].draw({ phase: 'taking', elapsed: PILL_TIMING.transfer, choice, role: 'morpheus' })(`held-${choice}-pill`).visible, false);
      actors[0].draw({ phase: 'taking', elapsed: PILL_TIMING.swallow - .01, choice, role: 'neo' });
      const mouth = actors[0].rig.bones.get('head')!.localToWorld(new THREE.Vector3(0, -.2, .36));
      assert.ok(received.getWorldPosition(new THREE.Vector3()).distanceTo(mouth) < .025, 'the pill must reach the mouth before disappearing');
      assert.equal(actors[0].draw({ phase: 'taking', elapsed: PILL_TIMING.swallow, choice, role: 'neo' })(`held-${choice}-pill`).visible, false);
    }
    const draw = (elapsed: number) => actors[0].draw({ phase: 'taking', elapsed, choice: 'red', role: 'neo' });
    const cup = draw(PILL_TIMING.liftCup)('pill-water-glass'); assert.ok(cup.visible);
    const table = new THREE.Vector3(center.x + PILL_ROOM.cup.x, center.y - 1 + PILL_ROOM.cup.y, center.z + PILL_ROOM.cup.z);
    assert.ok(cup.getWorldPosition(new THREE.Vector3()).distanceTo(table) < .03, `glass pickup: ${cup.getWorldPosition(new THREE.Vector3()).toArray()} versus ${table.toArray()}`);
    draw(7.3);
    const mouth = actors[0].rig.bones.get('head')!.localToWorld(new THREE.Vector3(0, -.2, .36));
    assert.ok(cup.localToWorld(new THREE.Vector3(0, .22, -.1)).distanceTo(mouth) < .03, 'the rim must touch the lips while drinking');
    draw(PILL_TIMING.replaceCup - .001);
    assert.ok(cup.getWorldPosition(new THREE.Vector3()).distanceTo(table) < .03, 'replace the same glass, without a visible jump');
    draw(PILL_TIMING.replaceCup); assert.equal(cup.visible, false);
  } finally { actors.forEach(actor => actor.models.dispose()); }
});

test('Neo bends his elbow into view while his knocking fist reaches room 1313', async () => {
  const { scene } = await loadGeometry('neo');
  const bones = new Map<string, THREE.Bone>(); const rest = new Map<string, THREE.Vector3>();
  scene.traverse(object => { if (object instanceof THREE.Bone) { bones.set(object.name, object); rest.set(object.name, object.position.clone()); } });
  scene.updateMatrixWorld(true);
  const models = new HeroModels(new THREE.Texture(), new THREE.Texture());
  const rig: HeroRig = { root: scene, bones, rest, panels: [], footHeight: bones.get('ankle_L')!.getWorldPosition(new THREE.Vector3()).y,
    glasses: new THREE.Group(), silver: { value: 0 }, wardrobe: [] };
  const center = FILM_SETS.film_lafayette.center;
  scene.position.set(center.x + 22.5, center.y - 1, center.z); scene.rotation.y = -Math.PI / 2;
  const input = { speed: 0, grounded: true, verticalVelocity: 0, turn: 0, knock: .9 };
  const motion = newMotion(); models.animate(rig, advanceMotion(motion, input, 0), motion, input, 0); scene.updateMatrixWorld(true);
  try {
    const shoulder = bones.get('shoulder_R')!.getWorldPosition(new THREE.Vector3());
    const elbow = bones.get('elbow_R')!.getWorldPosition(new THREE.Vector3());
    const wrist = bones.get('wrist_R')!.getWorldPosition(new THREE.Vector3());
    const armLine = shoulder.clone().lerp(wrist, shoulder.distanceTo(elbow) / shoulder.distanceTo(wrist));
    const knuckles = [2, 3, 4, 5].map(finger => bones.get(`finger${finger}-2_R`)!.getWorldPosition(new THREE.Vector3()));
    assert.ok(elbow.z > armLine.z + .12, `the elbow must silhouette toward the camera instead of hiding behind the forearm: elbow ${elbow.toArray()}, line ${armLine.toArray()}, shoulder ${shoulder.toArray()}, wrist ${wrist.toArray()}`);
    const contact = Math.min(...knuckles.map(point => point.x));
    assert.ok(contact >= center.x + 20.95 && contact <= center.x + 21.32,
      `the curled knuckles must meet the room 1313 door skin: wrist ${wrist.toArray()}, knuckles ${knuckles.map(point => point.toArray()).join(';')}`);
  } finally { models.dispose(); }
});

test('the shipped Neo rig lies on the medical bed with visible interfaces, then rises to standing', async () => {
  const [neo, office] = await Promise.all([loadGeometry('neo'), loadGeometry('neo-office')]);
  const models = new HeroModels(new THREE.Texture(), new THREE.Texture());
  (models as unknown as { load: (id: string) => Promise<typeof neo> }).load = async id => id === 'neo-office' ? office : neo;
  const rig = (await models.create('neo'))!;
  try {
    const coldMotion = newMotion(); const coldInput = { speed: 0, grounded: true, verticalVelocity: 0, turn: 0, realWorld: true };
    models.animate(rig, advanceMotion(coldMotion, coldInput, 0), coldMotion, coldInput, 0); rig.root.updateMatrixWorld(true);
    assert.equal(rig.root.getObjectByName('neo-recovery-interfaces')?.visible, true, 'loading a later real-world save still restores Neo physical interfaces');
    const draw = (recovery: number) => {
      const motion = newMotion(); const input = { speed: 0, grounded: true, verticalVelocity: 0, turn: 0,
        performance: 'recover' as const, recovery, realWorld: true };
      models.animate(rig, advanceMotion(motion, input, 0), motion, input, 0); rig.root.updateMatrixWorld(true);
    };
    draw(0);
    const lyingHead = rig.bones.get('head')!.getWorldPosition(new THREE.Vector3());
    const lyingPelvis = rig.bones.get('pelvis')!.getWorldPosition(new THREE.Vector3());
    const lyingAnkle = rig.bones.get('ankle_L')!.getWorldPosition(new THREE.Vector3());
    assert.ok(Math.max(lyingHead.y, lyingPelvis.y, lyingAnkle.y) - Math.min(lyingHead.y, lyingPelvis.y, lyingAnkle.y) < .75,
      `the recovery body must be horizontal: head ${lyingHead.y}, pelvis ${lyingPelvis.y}, ankle ${lyingAnkle.y}`);
    const interfaces = rig.root.getObjectByName('neo-recovery-interfaces')!;
    assert.ok(interfaces.visible); assert.ok(interfaces.getObjectByName('cervical-interface'));
    draw(12);
    const standingHead = rig.bones.get('head')!.getWorldPosition(new THREE.Vector3());
    const standingAnkle = rig.bones.get('ankle_L')!.getWorldPosition(new THREE.Vector3());
    assert.ok(standingHead.y > standingAnkle.y + 3.1, 'the saved final pose must finish upright beside the bed');
    assert.equal(interfaces.visible, true, 'real-world ports remain on Neo after the needles retract');
  } finally { models.dispose(); }
});
