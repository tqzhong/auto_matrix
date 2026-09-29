import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { HeroModels, type HeroRig } from '../packages/client/src/agents/HeroModel.js';
import { advanceMotion, newMotion, type MotionInput } from '../packages/client/src/agents/CharacterMotion.js';
import { PhoneModel } from '../packages/client/src/agents/PhoneModel.js';
import { OfficeSetRenderer } from '../packages/client/src/engine/OfficeSetRenderer.js';
import { NebDeckRenderer } from '../packages/client/src/engine/NebDeckRenderer.js';
import { APARTMENT, FILM_SETS, PILL_ROOM, PILL_TIMING, RECOVERY_BED, awakeningPose, farewellPose, filmPosition, pillRoot, recoveryCrewPose, type PillGesture, OFFICE_WINDOW, OFFICE_LEDGE_OFFSET, officeWindowPose, officeCrossingPose, type FilmJourney } from '@auto_matrix/shared';
import { INTERROGATION_ROOM, interrogationRoot } from '@auto_matrix/shared';
import { MEETING_CAR, meetingRoot, meetingCarPose } from '@auto_matrix/shared';
import { OFFICE_WORKDAY, officeRecipientRoot, officeCourierRoot, officeClipboardPoint, officePenPoint } from '@auto_matrix/shared';
import { OfficeWorkdayRenderer } from '../packages/client/src/engine/OfficeWorkdayRenderer.js';
import { LAFAYETTE, hotelFloor } from '@auto_matrix/shared';
import { MORNING, morningRoot, morningWakePose } from '@auto_matrix/shared';

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

test('hidden coat panels skip deformation work and retain correct normals when worn again', async t => {
  const asset = await loadGeometry(); const models = new HeroModels(new THREE.Texture(), new THREE.Texture());
  (models as unknown as { load: () => Promise<typeof asset> }).load = async () => asset;
  try {
    const rig = (await models.create('neo'))!; const motion = newMotion();
    let updates = 0;
    for (const panel of rig.panels) {
      const normals = panel.mesh.geometry.computeVertexNormals.bind(panel.mesh.geometry);
      t.mock.method(panel.mesh.geometry, 'computeVertexNormals', () => { updates++; normals(); });
    }
    const hidden = { speed: 6, grounded: true, verticalVelocity: 0, turn: .3, realWorld: true };
    const original = rig.panels.map(panel => Array.from(panel.mesh.geometry.attributes.position.array));
    for (let frame = 0; frame < 30; frame++) models.animate(rig, advanceMotion(motion, hidden, 1 / 60), motion, hidden, 1 / 60);
    assert.ok(rig.panels.every(panel => !panel.mesh.visible));
    assert.equal(updates, 0, 'invisible ship-clothing tails cannot consume the frame budget');
    rig.panels.forEach((panel, i) => assert.deepEqual(Array.from(panel.mesh.geometry.attributes.position.array), original[i]));
    const running = { ...hidden, realWorld: false };
    for (let frame = 0; frame < 45; frame++) models.animate(rig, advanceMotion(motion, running, 1 / 60), motion, running, 1 / 60);
    assert.ok(updates > 0 && rig.panels.every(panel => panel.mesh.visible), 'switching clothes back restores the animated coat');
    for (const panel of rig.panels) {
      const geometry = panel.mesh.geometry; const reference = geometry.clone(); reference.computeVertexNormals();
      const actual = geometry.attributes.normal.array, expected = reference.attributes.normal.array;
      assert.ok(actual.every((value, i) => Number.isFinite(value) && Math.abs(value - expected[i]) < 1e-6), 'moving cloth keeps exactly the geometry-derived lighting');
      reference.dispose();
    }
  } finally { models.dispose(); }
});

test('a settled coat does not upload identical positions and normals every frame', async () => {
  const asset = await loadGeometry('morpheus'); const models = new HeroModels(new THREE.Texture(), new THREE.Texture());
  (models as unknown as { load: () => Promise<typeof asset> }).load = async () => asset;
  try {
    const rig = (await models.create('morpheus'))!; const motion = newMotion();
    const input = { speed: 0, grounded: true, verticalVelocity: 0, turn: 0 };
    const pose = advanceMotion(motion, input, 0);
    for (let frame = 0; frame < 360; frame++) models.animate(rig, pose, motion, input, 1 / 60);
    const before = rig.panels.map(panel => ({ positions: Array.from(panel.mesh.geometry.attributes.position.array),
      positionVersion: panel.mesh.geometry.attributes.position.version, normalVersion: panel.mesh.geometry.attributes.normal.version }));
    for (let frame = 0; frame < 30; frame++) models.animate(rig, pose, motion, input, 1 / 60);
    rig.panels.forEach((panel, i) => {
      assert.deepEqual(Array.from(panel.mesh.geometry.attributes.position.array), before[i].positions, 'the pose has fully settled');
      assert.equal(panel.mesh.geometry.attributes.position.version, before[i].positionVersion, 'identical vertex positions should not upload again');
      assert.equal(panel.mesh.geometry.attributes.normal.version, before[i].normalVersion, 'identical cloth should reuse its existing surface normals');
    });
  } finally { models.dispose(); }
});

test('animated heroes leave the draw list behind the camera while every posed vertex remains inside their bounds', async () => {
  const ids = ['neo', 'morpheus', 'trinity', 'smith'] as const;
  const assets = new Map(await Promise.all([...ids, 'neo-office', 'trinity-club'].map(async id => [id, await loadGeometry(id)] as const)));
  const models = new HeroModels(new THREE.Texture(), new THREE.Texture());
  (models as unknown as { load: (id: string) => Promise<unknown> }).load = async id => assets.get(id)!;
  const input = { speed: 0, grounded: true, verticalVelocity: 0, turn: 0 };
  const poses: MotionInput[] = [input, { ...input, speed: 7, turn: .8 }, { ...input, grounded: false, verticalVelocity: 4 },
    { ...input, seated: true }, { ...input, performance: 'touch', performanceTime: 4.15, mirror: .3 },
    { ...input, realWorld: true, performance: 'recover', recovery: 6 },
    { ...input, clubClothes: true, club: { role: 'trinity', phase: 'whisper', elapsed: 3 } }];
  const camera = new THREE.PerspectiveCamera(48, 16 / 9, .1, 1000); const frustum = new THREE.Frustum();
  const point = new THREE.Vector3(); const matrix = new THREE.Matrix4();
  try {
    for (const id of ids) {
      const rig = (await models.create(id))!; const motion = newMotion();
      rig.root.position.set(80, 3, -120); rig.root.rotation.y = .67; rig.root.scale.set(.91, 1.08, 1.01);
      for (const input of poses) {
        models.animate(rig, advanceMotion(motion, input, 1 / 30), motion, input, 1 / 30);
        // Weapon gestures can change bones after HeroModels.animate returns.
        rig.bones.get('shoulder_R')!.rotation.x -= 1.2;
        rig.root.updateMatrixWorld(true);
        const meshes = rig.wardrobe.map(part => part.mesh).filter((mesh): mesh is THREE.SkinnedMesh => mesh.visible && mesh instanceof THREE.SkinnedMesh);
        camera.position.set(80, 6, -150); camera.lookAt(80, 6, -180); camera.updateMatrixWorld();
        frustum.setFromProjectionMatrix(matrix.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse));
        assert.equal(meshes.filter(mesh => !mesh.frustumCulled || frustum.intersectsObject(mesh)).length, 0, `${id} behind this view must not submit skinned geometry`);
        for (const mesh of meshes) {
          assert.ok(mesh.boundingSphere, `${id} ${mesh.name} needs a current bound`);
          for (let i = 0; i < mesh.geometry.attributes.position.count; i++) {
            mesh.getVertexPosition(i, point);
            assert.ok(mesh.boundingSphere.distanceToPoint(point) < 1e-5, `${id} ${mesh.name} vertex ${i} escapes during ${input.performance ?? input.speed}`);
          }
        }
        // The same frame must still render through an opposite mirror/shadow view.
        camera.lookAt(80, 5, -120); camera.updateMatrixWorld();
        frustum.setFromProjectionMatrix(matrix.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse));
        assert.ok(meshes.every(mesh => frustum.intersectsObject(mesh)), 'culling must be per view, not a visibility toggle');
      }
    }
  } finally { models.dispose(); }
});

test('the tucked and raised shirt stays inside culling bounds after the car-scan shader deforms it', async () => {
  const [neo, office] = await Promise.all([loadGeometry(), loadGeometry('neo-office')]);
  const models = new HeroModels(new THREE.Texture(), new THREE.Texture());
  (models as unknown as { load: (id: string) => Promise<typeof neo> }).load = async id => id === 'neo-office' ? office : neo;
  try {
    const rig = (await models.create('neo'))!; const motion = newMotion();
    const input = { speed: 0, grounded: true, verticalVelocity: 0, turn: 0,
      meeting: { phase: 'located' as const, elapsed: 0, role: 'neo' as const, bugged: true } };
    models.animate(rig, advanceMotion(motion, input, 0), motion, input, 0); rig.root.updateMatrixWorld(true);
    const shirt = rig.wardrobe.find(part => /Black.crew.neck/i.test(part.mesh.name))!.mesh as THREE.SkinnedMesh;
    const { position, _meetingShirtLift: lift, _meetingShirtTuck: tuck } = shirt.geometry.attributes;
    const point = new THREE.Vector3();
    for (const amount of [0, 1]) for (let i = 0; i < position.count; i++) {
      point.fromBufferAttribute(position, i); point.y += tuck.getX(i) * -.4 + lift.getX(i) * amount * .48;
      shirt.applyBoneTransform(i, point);
      assert.ok(shirt.boundingBox!.distanceToPoint(point) < 1e-5, `the shader hem escapes at vertex ${i}, lift ${amount}`);
      assert.ok(shirt.boundingSphere!.distanceToPoint(point) < 1e-5);
    }
  } finally { models.dispose(); }
});

test('Neo removes his long sleeves for the tracking electrodes and restores them outside the mirror scene', async () => {
  const [asset, office, tracking] = await Promise.all([loadGeometry('neo'), loadGeometry('neo-office'), loadGeometry('neo-tracking')]);
  const models = new HeroModels(new THREE.Texture(), new THREE.Texture());
  (models as unknown as { load: (id: string) => Promise<typeof asset> }).load = async id => id === 'neo-office' ? office : id === 'neo-tracking' ? tracking : asset;
  try {
    const rig = (await models.create('neo'))!; const motion = newMotion();
    const input: MotionInput = { speed: 0, grounded: true, verticalVelocity: 0, turn: 0, performance: 'touch', mirrorBeat: 2.75 };
    models.animate(rig, advanceMotion(motion, input, 0), motion, input, 0);
    const coat = rig.wardrobe.find(part => !part.mesh.userData.office && /Tailored.coat.upper/i.test(part.mesh.name))!.mesh;
    const outfit = rig.wardrobe.filter(part => part.mesh.userData.tracking);
    assert.equal(outfit.length, 2);
    assert.ok(outfit.every(part => part.mesh.visible), 'the shirt and anatomical arms load together at a resumed tracking checkpoint');
    assert.equal(coat.visible, false, 'the electrode must sit on Neo’s exposed arm, not the jacket sleeve');
    assert.ok(rig.panels.every(panel => !panel.mesh.visible), 'the long coat is removed before touching the mirror');
    const restored = { ...input, performance: undefined, mirrorBeat: undefined };
    models.animate(rig, advanceMotion(motion, restored, 0), motion, restored, 0);
    assert.equal(coat.visible, true, 'leaving or rewinding the scene restores the original outfit');
    assert.ok(rig.panels.every(panel => panel.mesh.visible));
    for (const other of [{ ...restored, officeShirt: true }, { ...restored, realWorld: true, performance: 'pod' as const }]) {
      models.animate(rig, advanceMotion(motion, other, 0), motion, other, 0);
      assert.ok(outfit.every(part => !part.mesh.visible), 'the tracking shirt cannot remain over office clothing or the pod body');
    }
  } finally { models.dispose(); }
});

test('Neo’s new forearms remain skinned, joined to the hands and exposed throughout the mirror performance', async () => {
  const [asset, office, tracking] = await Promise.all([loadGeometry('neo'), loadGeometry('neo-office'), loadGeometry('neo-tracking')]);
  const models = new HeroModels(new THREE.Texture(), new THREE.Texture());
  (models as unknown as { load: (id: string) => Promise<typeof asset> }).load = async id => id === 'neo-office' ? office : id === 'neo-tracking' ? tracking : asset;
  try {
    const rig = (await models.create('neo'))!; const motion = newMotion();
    const arms = rig.wardrobe.find(part => (part.mesh.material as THREE.Material).name === 'Tracking skin')!.mesh as THREE.SkinnedMesh;
    const hands = rig.wardrobe.find(part => (part.mesh.material as THREE.Material).name === 'Skin')!.mesh as THREE.SkinnedMesh;
    const point = new THREE.Vector3(); const key = (v: THREE.Vector3) => v.toArray().map(value => value.toFixed(4)).join(',');
    const seam = new Set<string>(); const source = hands.geometry.attributes.position;
    for (let i = 0; i < source.count; i++) if (source.getY(i) < 2.6) seam.add(key(point.fromBufferAttribute(source, i)));
    const positions = arms.geometry.attributes.position; const joined = new Set<string>();
    for (let i = 0; i < positions.count; i++) if (seam.has(key(point.fromBufferAttribute(positions, i)))) joined.add(key(point));
    assert.ok(joined.size > 20, 'both wrist boundary rings must meet the shipped hands without covering them with duplicate skin');
    assert.ok(arms.skeleton.bones.every(bone => rig.bones.get(bone.name) === bone), 'the outfit uses the animated skeleton rather than a second idle rig');
    const silver = arms.geometry.attributes._mirrorArrival;
    assert.ok([...silver.array].some(time => time > .4 && time < .6), 'silver climbs the new anatomical forearm before reaching the face');
    for (const time of [2.75, 3.45, 4.15, 6.3]) {
      const input: MotionInput = { speed: 0, grounded: true, verticalVelocity: 0, turn: 0, performance: 'touch', mirrorBeat: time, mirror: Math.max(0, (time - 3.45) / 4.55) };
      models.animate(rig, advanceMotion(motion, input, 0), motion, input, 0); rig.root.updateMatrixWorld(true);
      const visible = rig.wardrobe.filter(part => part.mesh.visible).map(part => part.mesh);
      for (const side of ['L', 'R']) {
        const elbow = rig.bones.get(`elbow_${side}`)!.getWorldPosition(new THREE.Vector3());
        const shoulder = rig.bones.get(`shoulder_${side}`)!.getWorldPosition(new THREE.Vector3());
        const axis = elbow.clone().sub(shoulder).normalize();
        // A long front-to-back ray also hits the raised forearm in front of
        // this shoulder. Probe the front and outside, perpendicular to the arm;
        // its inward surface joins the torso rather than a separate sleeve.
        for (const view of [new THREE.Vector3(0, 0, 1), new THREE.Vector3(side === 'L' ? 1 : -1, 0, 0)]) {
          const direction = view.clone().addScaledVector(axis, -view.dot(axis)).normalize();
          const sleeve = shoulder.clone().lerp(elbow, .25).addScaledVector(direction, .3);
          const hits = new THREE.Raycaster(sleeve, direction.negate(), 0, .3).intersectObjects(visible);
          assert.equal(((hits[0]?.object as THREE.Mesh)?.material as THREE.Material)?.name, 'Tracking cotton', `the ${side} upper arm must remain inside its sleeve at ${time}s (${view.toArray()}): ${hits.map(hit => `${hit.object.name} ${hit.distance.toFixed(3)}`).join(', ')}`);
        }
        const center = rig.bones.get(`wrist_${side}`)!.getWorldPosition(new THREE.Vector3()).lerp(elbow, .5);
        const hit = new THREE.Raycaster(center.clone().add(new THREE.Vector3(0, 0, .75)), new THREE.Vector3(0, 0, -1), 0, 1.5).intersectObjects(visible)[0];
        assert.equal(hit?.object, arms, `the ${side} forearm at ${time}s must show anatomical skin instead of a hole or long sleeve`);
      }
      for (let i = 0; i < positions.count; i++) {
        point.fromBufferAttribute(positions, i); arms.applyBoneTransform(i, point);
        assert.ok(arms.boundingBox!.distanceToPoint(point) < 1e-5, 'bending the new arms cannot cull them from the camera or mirror');
      }
    }
  } finally { models.dispose(); }
});

test('Neo’s cuff follows the raised biceps without being pulled through them', async () => {
  const assets = new Map(await Promise.all(['neo', 'neo-office', 'neo-tracking'].map(async id => [id, await loadGeometry(id)] as const)));
  const models = new HeroModels(new THREE.Texture(), new THREE.Texture());
  (models as unknown as { load: (id: string) => Promise<unknown> }).load = async id => assets.get(id)!;
  try {
    const rig = (await models.create('neo'))!; const motion = newMotion(); motion.seated = 1;
    const shirt = rig.wardrobe.find(part => (part.mesh.material as THREE.Material).name === 'Tracking cotton')!.mesh as THREE.SkinnedMesh;
    const arms = rig.wardrobe.find(part => /Tracking.arms/.test(part.mesh.name))!.mesh;
    const positions = shirt.geometry.getAttribute('position'), indices = shirt.geometry.index!;
    const cuffs: number[][] = [];
    for (let i = 0; i < indices.count; i += 3) {
      const triangle = [indices.getX(i), indices.getX(i + 1), indices.getX(i + 2)];
      if (triangle.every(v => positions.getY(v) > 3.2 && positions.getY(v) < 3.27
        && Math.abs(positions.getX(v)) > .46 && Math.abs(positions.getX(v)) < .56 && positions.getZ(v) > .19)) cuffs.push(triangle);
    }
    assert.ok(cuffs.length > 5, 'sample the front cuff surfaces where the sleeve used to lag behind the arm');
    for (const time of [2.75, 3.45, 4.15, 6.3]) {
      const input: MotionInput = { speed: 0, grounded: true, verticalVelocity: 0, turn: 0, seated: true, performance: 'touch', mirrorBeat: time };
      models.animate(rig, advanceMotion(motion, input, 0), motion, input, 0); rig.root.updateMatrixWorld(true);
      for (const triangle of cuffs) {
        const [a, b, c] = triangle.map(i => shirt.localToWorld(shirt.getVertexPosition(i, new THREE.Vector3())));
        const normal = b.clone().sub(a).cross(c.clone().sub(a)).normalize();
        const center = a.clone().add(b).add(c).multiplyScalar(1 / 3);
        const hit = new THREE.Raycaster(center.clone().addScaledVector(normal, .08), normal.negate(), 0, .082).intersectObjects([shirt, arms])[0];
        assert.ok(hit?.object === shirt, `the biceps breaks through the cuff at ${time}s: ${hit?.object.name}, triangle ${triangle.join(',')}, gap ${hit?.distance}`);
      }
    }
  } finally { models.dispose(); }
});

test('both complete cotton cuffs retain their shape throughout the mirror reach', async () => {
  const assets = new Map(await Promise.all(['neo', 'neo-office', 'neo-tracking'].map(async id => [id, await loadGeometry(id)] as const)));
  const models = new HeroModels(new THREE.Texture(), new THREE.Texture());
  (models as unknown as { load: (id: string) => Promise<unknown> }).load = async id => assets.get(id)!;
  try {
    const rig = (await models.create('neo'))!; const motion = newMotion(); motion.seated = 1;
    const shirt = rig.wardrobe.find(part => (part.mesh.material as THREE.Material).name === 'Tracking cotton')!.mesh as THREE.SkinnedMesh;
    const positions = shirt.geometry.attributes.position, indices = shirt.geometry.index!;
    // Weld UV seams before finding the physical openings. The old front-only
    // probe missed the low and rear cuff edges that stretched into long flaps.
    const welded = new Map<string, number>();
    const vertices = Array.from({ length: positions.count }, (_, i) => {
      const key = new THREE.Vector3().fromBufferAttribute(positions, i).toArray().map(value => value.toFixed(5)).join(',');
      if (!welded.has(key)) welded.set(key, i);
      return welded.get(key)!;
    });
    const edges = new Map<string, { a: number; b: number; count: number }>();
    for (let i = 0; i < indices.count; i += 3) for (let corner = 0; corner < 3; corner++) {
      const a = vertices[indices.getX(i + corner)], b = vertices[indices.getX(i + (corner + 1) % 3)];
      const key = [Math.min(a, b), Math.max(a, b)].join(',');
      const edge = edges.get(key) ?? { a, b, count: 0 }; edge.count++; edges.set(key, edge);
    }
    const cuffs = [...edges.values()].filter(edge => edge.count === 1 && [edge.a, edge.b].every(i =>
      Math.abs(positions.getX(i)) > .3 && positions.getY(i) > 2.8 && positions.getY(i) < 3.5));
    for (const side of [-1, 1]) assert.ok(cuffs.filter(edge => positions.getX(edge.a) * side > 0).length > 50, 'cover each complete cuff, including its underside');
    const degree = new Map<number, number>();
    for (const edge of cuffs) for (const vertex of [edge.a, edge.b]) degree.set(vertex, (degree.get(vertex) ?? 0) + 1);
    assert.ok([...degree.values()].every(count => count === 2), 'the sampled openings must be closed rings, not isolated strips');
    for (const time of [0, 2.75, 3.1, 3.45, 4.15, 5, 6.3]) {
      const input: MotionInput = { speed: 0, grounded: true, verticalVelocity: 0, turn: 0, seated: true, performance: 'touch', mirrorBeat: time };
      models.animate(rig, advanceMotion(motion, input, 0), motion, input, 0); rig.root.updateMatrixWorld(true);
      for (const { a, b } of cuffs) {
        const rest = new THREE.Vector3().fromBufferAttribute(positions, a).distanceTo(new THREE.Vector3().fromBufferAttribute(positions, b));
        const posed = shirt.getVertexPosition(a, new THREE.Vector3()).distanceTo(shirt.getVertexPosition(b, new THREE.Vector3()));
        assert.ok(posed / rest > .75 && posed / rest < 1.25, `cotton cuff edge ${a}-${b} stretches to ${(posed / rest).toFixed(2)} times its length at ${time}s`);
      }
    }
  } finally { models.dispose(); }
});

test('Trinity’s leather covers her shoulder caps while she connects and releases the tracking electrode', async () => {
  const asset = await loadGeometry('trinity'); const models = new HeroModels(new THREE.Texture(), new THREE.Texture());
  (models as unknown as { load: () => Promise<typeof asset> }).load = async () => asset;
  try {
    const rig = (await models.create('trinity'))!; const motion = newMotion();
    rig.root.position.set(-11.35, -1, -16.65); rig.root.rotation.y = 1.7;
    const skin = rig.wardrobe.find(part => (part.mesh.material as THREE.Material).name === 'Skin')!.mesh as THREE.SkinnedMesh;
    const jacket = rig.wardrobe.find(part => /Fitted.leather.jacket/.test(part.mesh.name))!.mesh;
    const positions = skin.geometry.getAttribute('position'), indices = skin.geometry.index!;
    const shoulders: number[][] = [];
    for (let i = 0; i < indices.count; i += 3) {
      const triangle = [indices.getX(i), indices.getX(i + 1), indices.getX(i + 2)];
      if (triangle.every(v => positions.getY(v) > 3.45 && positions.getY(v) < 3.68 && Math.abs(positions.getX(v)) > .3)) shoulders.push(triangle);
    }
    assert.ok(shoulders.length > 50, 'sample both shoulder surfaces under the jacket, away from its open neckline');
    for (const time of [0, 1.9, 2.75, 3.1, 4.15]) {
      const input = { speed: 0, grounded: true, verticalVelocity: 0, turn: 0, mirrorCrew: time,
        mirrorContact: new THREE.Vector3(-10.104386, 1.351321, -16.536995) };
      models.animate(rig, advanceMotion(motion, input, 0), motion, input, 0); rig.root.updateMatrixWorld(true);
      for (const triangle of shoulders.filter((_, i) => i % 4 === 0)) {
        const [a, b, c] = triangle.map(i => skin.localToWorld(skin.getVertexPosition(i, new THREE.Vector3())));
        const normal = b.clone().sub(a).cross(c.clone().sub(a)).normalize();
        const center = a.clone().add(b).add(c).multiplyScalar(1 / 3);
        const hit = new THREE.Raycaster(center.clone().addScaledVector(normal, .08), normal.negate(), 0, .1).intersectObjects([skin, jacket])[0];
        assert.ok(hit?.object === jacket, `shoulder skin protrudes through the jacket at ${time}s near ${triangle.map(i => positions.getX(i).toFixed(3) + ',' + positions.getY(i).toFixed(3)).join(' / ')}`);
        assert.ok(hit.distance < .076, `the shoulder layers need clearance instead of nearly coincident surfaces at ${time}s: ${(0.08 - hit.distance).toFixed(5)}`);
      }
    }
  } finally { models.dispose(); }
});

test('the principal characters place their feet on different hotel treads instead of sharing a flat floor', async () => {
  for (const id of ['neo', 'trinity', 'smith', 'morpheus'] as const) {
    const asset = await loadGeometry(id); const models = new HeroModels(new THREE.Texture(), new THREE.Texture());
    (models as unknown as { load: () => Promise<typeof asset> }).load = async () => asset;
    try {
      const rig = (await models.create(id))!; const motion = newMotion();
      const center = FILM_SETS.film_lafayette.center; const base = center.y - LAFAYETTE.upper - 1;
      const y = hotelFloor(LAFAYETTE.left, 18, 1)!;
      rig.root.position.set(center.x + LAFAYETTE.left, base + y, center.z + 18);
      rig.root.rotation.y = Math.PI / 2;
      const input = { speed: 0, grounded: true, verticalVelocity: 0, turn: 0 };
      for (let frame = 0; frame < 4; frame++) {
        models.animate(rig, advanceMotion(motion, input, 0), motion, input, 0); rig.root.updateMatrixWorld(true);
        const floors: number[] = [];
        for (const side of ['R', 'L']) {
          const ankle = rig.bones.get('ankle_' + side)!;
          const foot = ankle.getWorldPosition(new THREE.Vector3());
          const floor = base + hotelFloor(foot.x - center.x, foot.z - center.z, y)!; floors.push(floor);
          assert.ok(Math.abs(foot.y - rig.footHeight - floor) < .025, `${id} ${side} sole floats over or cuts into the tread: ${foot.y - rig.footHeight - floor}`);
          const up = new THREE.Vector3(0, 1, 0).applyQuaternion(ankle.getWorldQuaternion(new THREE.Quaternion()));
          assert.ok(up.y > .999, 'the ankle should keep the sole parallel to a horizontal tread');
        }
        assert.ok(Math.abs(floors[0] - floors[1]) > .2, 'the stance must actually straddle different steps');
      }
    } finally { models.dispose(); }
  }
});

test('hotel foot placement preserves the walking lift on both flights and on upper floors', async () => {
  for (const id of ['neo', 'trinity'] as const) {
    const asset = await loadGeometry(id); const models = new HeroModels(new THREE.Texture(), new THREE.Texture());
    (models as unknown as { load: () => Promise<typeof asset> }).load = async () => asset;
    try {
      const rig = (await models.create(id))!, flat = (await models.create(id))!;
      const shoes = rig.root.getObjectByName('shoes01') as THREE.SkinnedMesh;
      const soleVertices = ['R', 'L'].map(side => Array.from({ length: shoes.geometry.attributes.position.count }, (_, i) => i)
        .filter(i => shoes.geometry.attributes.position.getY(i) < .12 && (side === 'R' ? shoes.geometry.attributes.position.getX(i) < 0 : shoes.geometry.attributes.position.getX(i) > 0)));
      // Match AgentRenderer's translated actor, body offset and nested hero.
      const actor = new THREE.Group(), body = new THREE.Group(); actor.add(body); body.add(rig.root); body.position.y = -1;
      const center = FILM_SETS.film_lafayette.center, base = center.y - LAFAYETTE.upper - 1;
      let raised = 0, planted = 0;
      for (const storey of [0, 6, 11]) for (const x of [LAFAYETTE.left, LAFAYETTE.right]) for (const direction of [-1, 1]) {
        const motion = newMotion(); motion.speed = 6;
        const input = { speed: 6, grounded: true, verticalVelocity: 0, turn: 0 };
        body.rotation.y = flat.root.rotation.y = direction === -1 ? Math.PI : 0;
        for (let frame = 0; frame < 96; frame++) {
          const z = direction === -1 ? 19.9 - frame * .25 : -3.9 + frame * .25;
          const y = hotelFloor(x, z, storey * LAFAYETTE.rise + (x === LAFAYETTE.left ? 3.5 : 7))!;
          actor.position.set(center.x + x, base + y + 1, center.z + z);
          const pose = advanceMotion(motion, input, 1 / 24);
          models.animate(flat, pose, motion, input, 0); models.animate(rig, pose, motion, input, 0);
          rig.root.updateMatrixWorld(true);
          for (const [sideIndex, side] of ['R', 'L'].entries()) {
            const ankle = rig.bones.get('ankle_' + side)!;
            const foot = ankle.getWorldPosition(new THREE.Vector3());
            const reference = flat.bones.get('ankle_' + side)!.getWorldPosition(new THREE.Vector3());
            const lift = Math.max(0, reference.y - flat.footHeight);
            if (lift > .1) raised++; else if (lift < .001) planted++;
            let clearance = Infinity;
            for (const index of soleVertices[sideIndex]) {
              const point = shoes.localToWorld(shoes.getVertexPosition(index, new THREE.Vector3()));
              const floor = base + hotelFloor(point.x - center.x, point.z - center.z, y)!;
              clearance = Math.min(clearance, point.y - floor);
            }
            assert.ok(Math.abs(clearance - lift) < .025, `${id} storey ${storey} flight ${x} direction ${direction} frame ${frame} ${side} loses tread/lift: ${clearance - lift}`);
            assert.ok(Math.hypot(foot.x - actor.position.x - reference.x, foot.z - actor.position.z - reference.z) < .001, 'IK must preserve the stride, not drag the shoe sideways');
            for (const name of ['knee_', 'ankle_']) assert.ok(rig.bones.get(name + side)!.position.distanceTo(rig.rest.get(name + side)!) < 1e-8, 'leg bones must not stretch');
          }
        }
      }
      assert.ok(raised > 100 && planted > 100, 'exercise both the swinging and supporting feet');
    } finally { models.dispose(); }
  }
});

test('hotel foot placement releases for jumping, combat and leaving the stairwell', async () => {
  const asset = await loadGeometry(); const models = new HeroModels(new THREE.Texture(), new THREE.Texture());
  (models as unknown as { load: () => Promise<typeof asset> }).load = async () => asset;
  try {
    const rig = (await models.create('neo'))!, flat = (await models.create('neo'))!;
    const center = FILM_SETS.film_lafayette.center, base = center.y - LAFAYETTE.upper - 1;
    const input: MotionInput = { speed: 0, grounded: true, verticalVelocity: 0, turn: 0 };
    for (const mode of ['jump', 'attack', 'skill', 'seated', 'outside'] as const) {
      const motion = newMotion();
      rig.root.position.set(center.x + LAFAYETTE.left, base + hotelFloor(LAFAYETTE.left, 18, 1)!, center.z + 18);
      rig.root.rotation.y = flat.root.rotation.y = Math.PI / 2;
      models.animate(rig, advanceMotion(motion, input, 0), motion, input, 0);
      const next: MotionInput = { ...input, grounded: mode !== 'jump', verticalVelocity: mode === 'jump' ? 5 : 0,
        attack: mode === 'attack' ? 1 : undefined, cast: mode === 'skill' ? 1 : undefined,
        skill: mode === 'skill' ? 'bullet_time' : undefined, seated: mode === 'seated' };
      if (mode === 'outside') rig.root.position.set(0, 0, 0);
      const pose = advanceMotion(motion, next, 1 / 30);
      models.animate(rig, pose, motion, next, 0); models.animate(flat, pose, motion, next, 0);
      for (const [name, bone] of rig.bones) {
        assert.ok(bone.position.distanceTo(flat.bones.get(name)!.position) < 1e-8, `${mode} retains a stair pelvis offset`);
        assert.ok(bone.quaternion.angleTo(flat.bones.get(name)!.quaternion) < 1e-6, `${mode} retains stair IK on ${name}`);
      }
    }
  } finally { models.dispose(); }
});

test('the four principal characters keep their shoe soles rigid when the knees bend', async () => {
  for (const id of ['neo', 'trinity', 'smith', 'morpheus']) {
    const { scene } = await loadGeometry(id); scene.updateMatrixWorld(true);
    const shoes = scene.getObjectByName('shoes01') as THREE.SkinnedMesh;
    for (const side of ['R', 'L']) {
      const ankle = scene.getObjectByName('ankle_' + side)!;
      const samples: { index: number; local: THREE.Vector3 }[] = [];
      for (let i = 0; i < shoes.geometry.attributes.position.count; i++) {
        const point = new THREE.Vector3().fromBufferAttribute(shoes.geometry.attributes.position, i);
        if (point.y > .12 || (side === 'R' ? point.x > 0 : point.x < 0)) continue;
        samples.push({ index: i, local: ankle.worldToLocal(shoes.localToWorld(shoes.getVertexPosition(i, new THREE.Vector3()))) });
      }
      scene.getObjectByName('hip_' + side)!.rotation.x = -.4;
      scene.getObjectByName('knee_' + side)!.rotation.x = 1.1; ankle.rotation.x = -.7; scene.updateMatrixWorld(true);
      assert.ok(samples.length > 30);
      for (const sample of samples) {
        const local = ankle.worldToLocal(shoes.localToWorld(shoes.getVertexPosition(sample.index, new THREE.Vector3())));
        assert.ok(local.distanceTo(sample.local) < .001, `${id} ${side} sole vertex ${sample.index} deforms with the shin: ${local.distanceTo(sample.local)}`);
      }
    }
  }
});

test('the actual shoe meshes clear the hotel riser when a heel or toe straddles its edge', async () => {
  for (const id of ['neo', 'trinity', 'smith', 'morpheus'] as const) {
    const asset = await loadGeometry(id); const models = new HeroModels(new THREE.Texture(), new THREE.Texture());
    (models as unknown as { load: () => Promise<typeof asset> }).load = async () => asset;
    try {
      const rig = (await models.create(id))!; const shoes = rig.root.getObjectByName('shoes01') as THREE.SkinnedMesh;
      const center = FILM_SETS.film_lafayette.center, base = center.y - LAFAYETTE.upper - 1;
      const input = { speed: 0, grounded: true, verticalVelocity: 0, turn: 0 }; const motion = newMotion();
      for (const yaw of [0, Math.PI / 4, Math.PI / 2, Math.PI]) for (const z of [17.6, 17.9, 18.1, 18.4]) {
        const y = hotelFloor(LAFAYETTE.left, z, 1)!;
        rig.root.position.set(center.x + LAFAYETTE.left, base + y, center.z + z); rig.root.rotation.y = yaw;
        models.animate(rig, advanceMotion(motion, input, 0), motion, input, 0); rig.root.updateMatrixWorld(true);
        let clearance = Infinity;
        for (let i = 0; i < shoes.geometry.attributes.position.count; i++) {
          const point = shoes.localToWorld(shoes.getVertexPosition(i, new THREE.Vector3()));
          const floor = base + hotelFloor(point.x - center.x, point.z - center.z, y)!;
          clearance = Math.min(clearance, point.y - floor);
        }
        assert.ok(clearance > -.015, `${id} yaw ${yaw} z ${z}: shoe penetrates the riser by ${-clearance}`);
        assert.ok(clearance < .04, 'at least part of a sole must support the standing body');
      }
    } finally { models.dispose(); }
  }
});

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
    assert.ok(Math.min(...hand) < .06, 'silver starts at the touching fingertip within a quarter-second, before the hand is withdrawn');
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

test('Neo has a connected anatomical body after leaving the mirror for the pod and recovery bed', async () => {
  const [asset, office, tracking] = await Promise.all([loadGeometry('neo'), loadGeometry('neo-office'), loadGeometry('neo-tracking')]);
  const models = new HeroModels(new THREE.Texture(), new THREE.Texture());
  (models as unknown as { load: (id: string) => Promise<typeof asset> }).load = async id => id === 'neo-office' ? office : id === 'neo-tracking' ? tracking : asset;
  try {
    const rig = (await models.create('neo'))!; const motion = newMotion();
    for (const performance of ['pod', 'float', 'recover'] as const) {
      const input: MotionInput = { speed: 0, grounded: false, verticalVelocity: 0, turn: 0, realWorld: true, performance, recovery: performance === 'recover' ? 6 : undefined };
      models.animate(rig, advanceMotion(motion, input, 0), motion, input, 0); rig.root.updateMatrixWorld(true);
      const surfaces = rig.wardrobe.filter(part => part.mesh.visible).map(part => part.mesh);
      for (const side of ['L', 'R']) for (const [end, start] of [['wrist', 'elbow'], ['ankle', 'knee']]) {
        const endPoint = rig.bones.get(`${end}_${side}`)!.getWorldPosition(new THREE.Vector3());
        const startPoint = rig.bones.get(`${start}_${side}`)!.getWorldPosition(new THREE.Vector3());
        const center = endPoint.lerp(startPoint, .5); const axis = startPoint.clone().sub(center).normalize();
        const outward = new THREE.Vector3(side === 'L' ? 1 : -1, 0, 0); outward.addScaledVector(axis, -outward.dot(axis)).normalize();
        const hit = new THREE.Raycaster(center.addScaledVector(outward, .4), outward.negate(), 0, .8).intersectObjects(surfaces)[0];
        assert.ok(hit?.object.userData.patientBody, `${performance}: the ${side} ${start}-${end} segment needs continuous anatomical skin`);
      }
      assert.ok(surfaces.every(mesh => !mesh.userData.tracking && (mesh.material as THREE.Material).name !== 'Office skin'), 'the complete patient body replaces the tracking shirt and partial office torso');
      const body = surfaces.find(mesh => mesh.userData.patientBody)!;
      assert.ok((body.material as THREE.MeshStandardMaterial).roughness < .6, 'the anatomical patient body uses the wet recovery finish');
      assert.ok(surfaces.every(mesh => !/Tailored.trousers/i.test(mesh.name)), 'painted trousers cannot substitute for bare legs');
      const positions = body.geometry.attributes.position;
      assert.ok([...Array(positions.count).keys()].filter(i => positions.getY(i) < .15).length > 50, 'the body includes anatomical feet below the ankle joints');
    }
  } finally { models.dispose(); }
});

test('legacy rigs without the full patient asset restore their clothing after recovery', async () => {
  const [asset, office] = await Promise.all([loadGeometry('neo'), loadGeometry('neo-office')]);
  const models = new HeroModels(new THREE.Texture(), new THREE.Texture());
  (models as unknown as { load: (id: string) => Promise<typeof asset> }).load = async id => id === 'neo-office' ? office : asset;
  try {
    const rig = (await models.create('neo'))!; const motion = newMotion();
    const underlayers = rig.wardrobe.filter(part => !part.mesh.userData.office && (part.mesh.material as THREE.Material).name === 'Trousers');
    const original = underlayers.map(part => {
      const material = part.mesh.material as THREE.MeshStandardMaterial;
      return { map: material.map, bumpMap: material.bumpMap, roughness: material.roughness };
    });
    const input = { speed: 0, grounded: false, verticalVelocity: 0, turn: 0, realWorld: true, performance: 'pod' as const };
    models.animate(rig, advanceMotion(motion, input, 0), motion, input, 0);
    const patientBody = rig.wardrobe.filter(part => !part.mesh.userData.office && (part.mesh.material as THREE.Material).name === 'Trousers');
    assert.equal(patientBody.length, 2, 'the shipped model has separate torso and leg underlayers');
    const anatomicalTorso = rig.wardrobe.find(part => (part.mesh.material as THREE.Material).name === 'Office skin')!;
    assert.equal(anatomicalTorso.mesh.visible, true, 'the anatomical torso must replace the crew-neck garment in the pod');
    assert.equal(patientBody.find(part => /Black.crew.neck/i.test(part.mesh.name))?.mesh.visible, false, 'the crew-neck silhouette cannot masquerade as bare skin');
    assert.equal(patientBody.find(part => /Tailored.trousers/i.test(part.mesh.name))?.mesh.visible, true, 'the leg underlayer remains until a full anatomical leg mesh exists');
    assert.equal(rig.wardrobe.find(part => (part.mesh.material as THREE.Material).name === 'Coat wool')?.mesh.visible, false);
    const legs = patientBody.find(part => /Tailored.trousers/i.test(part.mesh.name))!;
    const podMaterial = legs.mesh.material as THREE.MeshStandardMaterial; const podColor = podMaterial.color.getHex();
    assert.equal(podMaterial.map?.name, 'Neo patient skin');
    assert.equal(podMaterial.bumpMap, podMaterial.map, 'pores replace the fabric weave while Neo is connected');
    assert.ok(podMaterial.roughness < .6 && podMaterial.metalness < .05, 'wet skin must not retain dry trouser shading');
    assert.ok(podMaterial.color.r < .7, 'the task light must not blow the temporary body surface out to white');
    const torsoMaterial = anatomicalTorso.mesh.material as THREE.MeshStandardMaterial;
    assert.notEqual(torsoMaterial.map, podMaterial.map, 'the anatomical torso keeps its purpose-built skin texture');
    assert.ok(torsoMaterial.roughness < .6, 'the recovered torso shares the same wet finish');
    models.animate(rig, advanceMotion(motion, { ...input, performance: 'recover' }, 0), motion, { ...input, performance: 'recover' }, 0);
    assert.equal((legs.mesh.material as THREE.MeshStandardMaterial).color.getHex(), podColor, 'medical recovery continues the patient appearance');
    assert.equal(anatomicalTorso.mesh.visible, true);
    assert.equal(rig.wardrobe.find(part => (part.mesh.material as THREE.Material).name === 'Coat wool')?.mesh.visible, false);
    models.animate(rig, advanceMotion(motion, { ...input, performance: undefined }, 0), motion, { ...input, performance: undefined }, 0);
    assert.notEqual((legs.mesh.material as THREE.MeshStandardMaterial).color.getHex(), podColor, 'ship clothing returns when recovery ends');
    assert.equal(anatomicalTorso.mesh.visible, false, 'the anatomical torso returns beneath ship clothing after recovery');
    patientBody.forEach((part, i) => {
      const material = part.mesh.material as THREE.MeshStandardMaterial;
      assert.equal(material.map, original[i].map); assert.equal(material.bumpMap, original[i].bumpMap);
      assert.equal(material.roughness, original[i].roughness); assert.equal(material.color.getHex(), 0x706c62);
    });
  } finally { models.dispose(); }
});

test('Morpheus and Trinity place their supporting hands on Neo during recovery', async () => {
  const [neo, office, morpheus, trinity] = await Promise.all([loadGeometry('neo'), loadGeometry('neo-office'), loadGeometry('morpheus'), loadGeometry('trinity')]);
  const models = new HeroModels(new THREE.Texture(), new THREE.Texture());
  (models as unknown as { load: (id: string) => Promise<typeof morpheus> }).load = async id => id === 'neo' ? neo : id === 'neo-office' ? office : id === 'trinity' ? trinity : morpheus;
  try {
    const gaps: { role: string; gap: number }[] = [];
    const elapsed = 9.75; const neoRig = (await models.create('neo'))!; const neoRoot = awakeningPose({ kind: 'recovery', elapsed, started: true });
    neoRig.root.position.set(neoRoot.x, 0, neoRoot.z); neoRig.root.rotation.y = Math.PI;
    const neoMotion = newMotion(); const neoInput = { speed: 0, grounded: false, verticalVelocity: 0, turn: 0, realWorld: true,
      performance: 'recover' as const, recovery: elapsed };
    models.animate(neoRig, advanceMotion(neoMotion, neoInput, 0), neoMotion, neoInput, 0); neoRig.root.updateMatrixWorld(true);
    for (const role of ['morpheus', 'trinity'] as const) {
      const rig = (await models.create(role))!; const root = recoveryCrewPose({ role, elapsed });
      rig.root.position.set(root.x, 0, root.z); rig.root.rotation.y = root.yaw; rig.root.updateMatrixWorld(true);
      const side = role === 'morpheus' ? 'R' : 'L';
      const neoShoulder = neoRig.bones.get(role === 'morpheus' ? 'shoulder_R' : 'shoulder_L')!;
      const target = neoShoulder.localToWorld(new THREE.Vector3(0, -.16, .06));
      const motion = newMotion(); const input = { speed: 0, grounded: true, verticalVelocity: 0, turn: 0, realWorld: true,
        recoveryCrew: { role, elapsed, target } };
      models.animate(rig, advanceMotion(motion, input, 0), motion, input, 0); rig.root.updateMatrixWorld(true);
      const wrist = rig.bones.get(`wrist_${side}`)!.getWorldPosition(new THREE.Vector3());
      gaps.push({ role, gap: wrist.distanceTo(target) });
    }
    assert.ok(gaps.every(result => result.gap < .08), `supporting hands miss Neo (${gaps.map(result => `${result.role}: ${result.gap}`).join(', ')})`);
  } finally { models.dispose(); }
});

test('Neo and Trinity make physical hand and face contact during the Logos farewell', async () => {
  const [neo, office, trinity] = await Promise.all([loadGeometry('neo'), loadGeometry('neo-office'), loadGeometry('trinity')]);
  const models = new HeroModels(new THREE.Texture(), new THREE.Texture());
  (models as unknown as { load: (id: string) => Promise<typeof neo> }).load = async id => id === 'neo-office' ? office : id === 'trinity' ? trinity : neo;
  try {
    const encounter = { phase: 'goodbye' as const, elapsed: 3.4, total: 13.8 }; const pose = farewellPose(encounter);
    const neoRig = (await models.create('neo'))!; const trinityRig = (await models.create('trinity'))!;
    neoRig.root.position.set(pose.neo.x, 0, pose.neo.z); neoRig.root.rotation.y = pose.neo.yaw;
    trinityRig.root.position.set(pose.trinity.x, 0, pose.trinity.z); trinityRig.root.rotation.set(-.48, pose.trinity.yaw, 0);
    const trinityMotion = newMotion(); const trinityBase = { speed: 0, grounded: true, verticalVelocity: 0, turn: 0,
      realWorld: true, floorSeated: true, farewell: { ...encounter, role: 'trinity' as const } };
    models.animate(trinityRig, advanceMotion(trinityMotion, trinityBase, 0), trinityMotion, trinityBase, 0);
    trinityRig.root.updateMatrixWorld(true);
    const handTarget = trinityRig.bones.get('wrist_R')!.localToWorld(new THREE.Vector3(0, -.08, .04));
    const neoMotion = newMotion(); const neoInput = { speed: 0, grounded: true, verticalVelocity: 0, turn: 0,
      realWorld: true, crouching: true, farewell: { ...encounter, role: 'neo' as const, target: handTarget } };
    models.animate(neoRig, advanceMotion(neoMotion, neoInput, 0), neoMotion, neoInput, 0); neoRig.root.updateMatrixWorld(true);
    const held = neoRig.bones.get('wrist_R')!.getWorldPosition(new THREE.Vector3());
    const faceTarget = neoRig.bones.get('head')!.localToWorld(new THREE.Vector3(0, .1, .08));
    const trinityInput = { ...trinityBase, farewell: { ...trinityBase.farewell, target: faceTarget } };
    models.animate(trinityRig, advanceMotion(trinityMotion, trinityInput, 0), trinityMotion, trinityInput, 0); trinityRig.root.updateMatrixWorld(true);
    const touching = trinityRig.bones.get('wrist_L')!.getWorldPosition(new THREE.Vector3());
    assert.ok(held.distanceTo(handTarget) < .09, `Neo's hand misses Trinity's: ${held.distanceTo(handTarget)}`);
    assert.ok(touching.distanceTo(faceTarget) < .09, `Trinity's hand misses Neo's face: ${touching.distanceTo(faceTarget)}`);
  } finally { models.dispose(); }
});

test('the articulated recovery needles meet the shipped Neo skeleton', async () => {
  const [neo, office] = await Promise.all([loadGeometry('neo'), loadGeometry('neo-office')]);
  const models = new HeroModels(new THREE.Texture(), new THREE.Texture()); const set = new THREE.Group(); const medical = new NebDeckRenderer(set);
  (models as unknown as { load: (id: string) => Promise<typeof neo> }).load = async id => id === 'neo-office' ? office : neo;
  try {
    const elapsed = 4; const rig = (await models.create('neo'))!; const root = awakeningPose({ kind: 'recovery', elapsed, started: true });
    rig.root.position.set(root.x, -1, root.z); rig.root.rotation.y = Math.PI;
    const motion = newMotion(); const input = { speed: 0, grounded: true, verticalVelocity: 0, turn: 0, realWorld: true,
      performance: 'recover' as const, recovery: elapsed };
    models.animate(rig, advanceMotion(motion, input, 0), motion, input, 0); rig.root.updateMatrixWorld(true);
    const journey = { version: 1, scene: 'm1_recovery', step: 0, actor: 'neo', completed: [], enteredAt: 0,
      checkpoint: filmPosition('film_neb_deck', RECOVERY_BED.x, RECOVERY_BED.z), reflections: {}, lastText: '',
      awakening: { kind: 'recovery', elapsed, started: true } } satisfies FilmJourney;
    medical.update(journey, elapsed, rig.root); set.updateMatrixWorld(true);
    for (const [index, boneName, offset] of [[0, 'chest', [-.24, .08, .06]], [6, 'hip_L', [0, .08, .04]], [10, 'ankle_L', [0, .06, .04]]] as const) {
      const target = rig.bones.get(boneName)!.localToWorld(new THREE.Vector3(...offset));
      const tip = set.getObjectByName(`neb-medical-needle-tip-${index}`)!.getWorldPosition(new THREE.Vector3());
      assert.ok(tip.distanceTo(target) < .035, `${boneName} needle misses the posed body: ${tip.distanceTo(target)}`);
    }
  } finally { medical.dispose(); models.dispose(); }
});

test('Trinity resumes in her club costume and restores her jacket after leaving', async () => {
  const models = new HeroModels(new THREE.Texture(), new THREE.Texture());
  (models as unknown as { load: typeof loadGeometry }).load = loadGeometry;
  try {
    const rig = (await models.create('trinity'))!; const motion = newMotion();
    const jacket = rig.root.getObjectByName('Fitted_leather_jacket') as THREE.SkinnedMesh;
    const head = rig.wardrobe.find(part => (part.mesh.material as THREE.Material).name === 'Skin')!.mesh;
    const original = head.geometry;
    for (const clubClothes of [true, false, true]) {
      // Restoring a save must dress her before the conversation is started.
      const input = { speed: 0, grounded: true, verticalVelocity: 0, turn: 0, clubClothes, glasses: !clubClothes };
      models.animate(rig, advanceMotion(motion, input, 0), motion, input, 0);
      assert.equal(jacket.visible, !clubClothes, 'the long-sleeved jacket cannot remain visible in the nightclub');
      const outfit = rig.wardrobe.filter(part => part.mesh.userData.club);
      assert.ok(outfit.length >= 2, 'the club needs its own bodice and anatomical shoulder/arm surfaces');
      assert.ok(outfit.every(part => part.mesh.visible === clubClothes));
      for (const part of outfit) {
        const mesh = part.mesh as THREE.SkinnedMesh;
        assert.ok(mesh.skeleton.bones.every(bone => bone === rig.bones.get(bone.name)), 'the outfit must follow the existing performance skeleton');
      }
      assert.equal(head.geometry, original, 'changing clothes must preserve the finished face and hands');
      assert.ok(head.visible);
      assert.equal(rig.glasses.visible, !clubClothes);
      assert.ok(rig.root.getObjectByName('Tailored_trousers')!.visible, 'the shared leather material cannot hide the trousers');
    }
    const input = { speed: 0, grounded: true, verticalVelocity: 0, turn: 0, clubClothes: true, realWorld: true };
    models.animate(rig, advanceMotion(motion, input, 0), motion, input, 0);
    assert.ok(jacket.visible);
    assert.ok(rig.wardrobe.filter(part => part.mesh.userData.club).every(part => !part.mesh.visible));
    const patient = { ...input, performance: 'recover' as const, recovery: 2 };
    models.animate(rig, advanceMotion(motion, patient, 0), motion, patient, 0);
    assert.equal(jacket.visible, false, 'restoring the jacket must still respect the existing patient visibility rule');
  } finally { models.dispose(); }
});

test('Trinity’s fitted outfit has no open waist during the club conversation', async () => {
  const models = new HeroModels(new THREE.Texture(), new THREE.Texture());
  (models as unknown as { load: typeof loadGeometry }).load = loadGeometry;
  const rig = (await models.create('trinity'))!;
  try {
    for (const phase of ['introduction', 'whisper', 'question'] as const) {
      const motion = newMotion(); const input = { speed: 0, grounded: true, verticalVelocity: 0, turn: 0, glasses: false, clubClothes: true,
        club: { role: 'trinity' as const, phase, elapsed: 3 } };
      models.animate(rig, advanceMotion(motion, input, 0), motion, input, 0); rig.root.updateMatrixWorld(true);
      const clothes = rig.wardrobe.filter(part => part.mesh.visible && part.mesh instanceof THREE.SkinnedMesh && /Coat|Trousers|Club vinyl/.test((part.mesh.material as THREE.Material).name)).map(part => part.mesh as THREE.SkinnedMesh);
      clothes.forEach(mesh => { mesh.skeleton.update(); mesh.computeBoundingSphere(); });
      for (const x of [-.16, 0, .16]) for (const y of [2.38, 2.46, 2.54, 2.62]) {
        const ray = new THREE.Raycaster(new THREE.Vector3(x, y, 2), new THREE.Vector3(0, 0, -1), 0, 2);
        assert.ok(ray.intersectObjects(clothes).length > 0, `open waist during ${phase} at ${x}, ${y}`);
      }
    }
  } finally { models.dispose(); }
});

test('the club shoulders and wrists stay welded to Trinity’s finished skin during her performance', async () => {
  const models = new HeroModels(new THREE.Texture(), new THREE.Texture());
  (models as unknown as { load: typeof loadGeometry }).load = loadGeometry;
  try {
    const rig = (await models.create('trinity'))!;
    const head = rig.wardrobe.find(part => (part.mesh.material as THREE.Material).name === 'Skin')!.mesh as THREE.SkinnedMesh;
    const body = rig.root.getObjectByName('Club_upper_body') as THREE.SkinnedMesh;
    const position = head.geometry.attributes.position; const index = head.geometry.index!;
    const key = (position: THREE.BufferAttribute | THREE.InterleavedBufferAttribute, i: number) => [position.getX(i), position.getY(i), position.getZ(i)].map(v => v.toFixed(5)).join(',');
    const edges = new Map<string, { count: number; a: number; b: number }>();
    for (let i = 0; i < index.count; i += 3) for (const [start, end] of [[0, 1], [1, 2], [2, 0]]) {
      const a = index.getX(i + start), b = index.getX(i + end);
      const edgeKey = [key(position, a), key(position, b)].sort().join('/');
      const previous = edges.get(edgeKey);
      if (previous) previous.count++; else edges.set(edgeKey, { count: 1, a, b });
    }
    const boundary = new Set([...edges.values()].filter(edge => edge.count === 1).flatMap(edge => [edge.a, edge.b]).filter(i => position.getY(i) < 3.68));
    const surface = body.geometry.attributes.position;
    const lookup = new Map(Array.from({ length: surface.count }, (_, i) => [key(surface, i), i]));
    const pairs = [...boundary].map(i => {
      const other = lookup.get(key(position, i));
      assert.notEqual(other, undefined, `missing shoulder/wrist surface at ${key(position, i)}`);
      return [i, other!] as const;
    });
    assert.ok(pairs.length > 150, 'inspect the full wrist/shoulder boundary, not a single shared point');
    for (const [a, b] of pairs) {
      const normal = new THREE.Vector3().fromBufferAttribute(head.geometry.attributes.normal, a);
      const other = new THREE.Vector3().fromBufferAttribute(body.geometry.attributes.normal, b);
      assert.ok(normal.dot(other) > .999, 'the old shoulder cap cannot leave a lighting seam on the new arm');
    }
    for (const phase of ['introduction', 'whisper', 'question'] as const) for (const elapsed of [0, 1.5, 3]) {
      const motion = newMotion(); const input = { speed: 0, grounded: true, verticalVelocity: 0, turn: 0, clubClothes: true,
        club: { role: 'trinity' as const, phase, elapsed } };
      models.animate(rig, advanceMotion(motion, input, 0), motion, input, 0); rig.root.updateMatrixWorld(true);
      for (const mesh of [head, body]) mesh.skeleton.update();
      for (const [a, b] of pairs) {
        const first = head.getVertexPosition(a, new THREE.Vector3());
        const second = body.getVertexPosition(b, new THREE.Vector3());
        assert.ok(first.distanceTo(second) < .00002, `${phase} opens a skin seam at ${elapsed}`);
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
      for (const [phase, elapsed] of [['ready', 0], ['boarding', 2], ['choice', 0], ['hesitating', 2], ['reconsidering', 1], ['located', 0], ['removing', 2.25], ['discarding', 2.25], ['discarding', 4], ['done', 0], ['driving', 8], ['driving', 41], ['parked', 0]] as const) {
        const gesture = { phase, elapsed, role, bugged: true };
        const position = meetingRoot({ ...gesture, approach: { ...MEETING_CAR.approach, yaw: -Math.PI / 2 } }, role);
        rig.root.position.set(center.x + position.x, center.y - 1, center.z + position.z); rig.root.rotation.y = position.yaw;
        const motion = newMotion(); const input = { speed: 0, grounded: true, verticalVelocity: 0, turn: 0, meeting: gesture };
        models.animate(rig, advanceMotion(motion, input, 0), motion, input, 0); rig.root.updateMatrixWorld(true);
        const head = rig.bones.get('head')!.getWorldPosition(new THREE.Vector3());
        assert.ok(head.y + .4 < MEETING_CAR.height, `${role} head intersects the roof in ${phase}: ${head.y}`);
        if (role === 'switch' && (phase === 'choice' || phase === 'hesitating')) assert.equal(rig.root.getObjectByName('switch-warning-pistol')?.visible, true);
        if (role !== 'trinity') continue;
        const scanner = rig.root.getObjectByName('extraction-scanner')!;
        const pump = rig.root.getObjectByName('scanner-pump')!;
        if (phase === 'ready' || phase === 'boarding' || phase === 'done' || phase === 'driving' || phase === 'parked') {
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
          const eye = patient!.bones.get('head')!.localToWorld(new THREE.Vector3(0, .1, .13));
          const scannerTop = new THREE.Box3().setFromObject(scanner).max.y;
          assert.ok(scannerTop < eye.y - .18, `the scanner's upper bar blocks Neo's face: top ${scannerTop}, eye ${eye.y}`);
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
        for (const [side, grip] of [['R', new THREE.Vector3(-.2, .86 + pump.position.y, 0)], ['L', new THREE.Vector3(-.31, .75, 0)]] as const) {
          const palm = rig.bones.get('wrist_' + side)!.localToWorld(new THREE.Vector3(side === 'R' ? .06 : -.06, -.17, .015));
          const gap = palm.distanceTo(scanner.localToWorld(grip.clone()));
          assert.ok(gap < .045, `Trinity must actually reach the ${side} scanner grip in ${phase}: ${gap}; shoulder ${rig.bones.get('shoulder_' + side)!.getWorldPosition(new THREE.Vector3()).sub(new THREE.Vector3(center.x, 0, center.z + MEETING_CAR.z)).toArray()}; grip ${scanner.localToWorld(grip.clone()).sub(new THREE.Vector3(center.x, 0, center.z + MEETING_CAR.z)).toArray()}`);
        }
      }
    }
  } finally { models.dispose(); }
});

test('Neo’s tracker scan keeps his waist covered before lifting and skin inside the shirt', async () => {
  const [neo, office] = await Promise.all([loadGeometry(), loadGeometry('neo-office')]);
  const models = new HeroModels(new THREE.Texture(), new THREE.Texture());
  (models as unknown as { load: (id: string) => Promise<typeof neo> }).load = async id => id === 'neo-office' ? office : neo;
  try {
    const rig = (await models.create('neo'))!;
    const motion = newMotion(); const gesture = { phase: 'located' as const, elapsed: 0, role: 'neo' as const, bugged: true };
    const input = { speed: 0, grounded: true, verticalVelocity: 0, turn: 0, meeting: gesture };
    models.animate(rig, advanceMotion(motion, input, 0), motion, input, 0);
    const shirt = rig.wardrobe.find(part => /Black.crew.neck/i.test(part.mesh.name))!.mesh;
    const shader = { vertexShader: '#include <common>\n#include <begin_vertex>', fragmentShader: '', uniforms: {} };
    (shirt.material as THREE.MeshStandardMaterial).onBeforeCompile(shader as Parameters<THREE.MeshStandardMaterial['onBeforeCompile']>[0], {} as THREE.WebGLRenderer);
    assert.match(shader.vertexShader, /_meetingShirtTuck \* -0\.4 \+ _meetingShirtLift \* meetingShirt \* 0\.48/, 'the shirt must cover the waist before the scan and raise its front hem during it');
    const position = shirt.geometry.getAttribute('position');
    const lift = shirt.geometry.getAttribute('_meetingShirtLift'); const tuck = shirt.geometry.getAttribute('_meetingShirtTuck');
    assert.ok(lift && tuck, 'the actual mesh needs a covered waist and a hem-shaped lift rather than a pinched shader wedge');
    const hem: number[] = []; const tucked: number[] = [];
    for (let i = 0; i < position.count; i++) {
      const x = position.getX(i), y = position.getY(i), z = position.getZ(i);
      if (Math.abs(x) >= .04 && Math.abs(x) <= .36 && y >= 2.89 && y < 2.94 && z > .15) {
        hem.push(y - tuck.getX(i) * .4 + lift.getX(i) * .48);
        tucked.push(y - tuck.getX(i) * .4);
      }
      if (z < -.15) assert.equal(lift.getX(i), 0, 'the back of the shirt must not rise during extraction');
    }
    assert.ok(hem.length > 20, 'sample the shipped front hem across the whole abdomen');
    assert.ok(Math.max(...hem) - Math.min(...hem) < .09, `the lifted hem must not taper to a triangular skin gap at the flanks: ${Math.min(...hem)}–${Math.max(...hem)}`);
    const trousers = rig.wardrobe.find(part => /Tailored.trousers/i.test(part.mesh.name))!.mesh.geometry;
    trousers.computeBoundingBox(); const waist = trousers.boundingBox!.max.y;
    assert.ok(Math.max(...tucked) < waist, `the waiting pose must cover the trouser waist: hem ${Math.min(...tucked)}–${Math.max(...tucked)}, waist ${waist}`);
    assert.ok(Math.min(...hem) - waist > .25 && Math.max(...hem) - waist < .5, `extraction exposes only the lower abdomen: hem ${Math.min(...hem)}–${Math.max(...hem)}, waist ${waist}`);
    const skin = rig.wardrobe.find(part => (part.mesh.material as THREE.Material).name === 'Office skin')!.mesh;
    rig.root.updateMatrixWorld(true);
    for (const x of [-.16, 0, .16]) for (const y of [2.38, 2.44]) {
      const ray = new THREE.Raycaster(new THREE.Vector3(x, y, 1), new THREE.Vector3(0, 0, -1), 0, 2);
      assert.equal(ray.intersectObjects([shirt, skin])[0]?.object, shirt, `skin must not cut through Neo's black shirt at ${x}, ${y}`);
    }
  } finally { models.dispose(); }
});

test('Neo’s black shirt covers his upper chest while seated in Trinity’s car', async () => {
  const [neo, office] = await Promise.all([loadGeometry(), loadGeometry('neo-office')]);
  const models = new HeroModels(new THREE.Texture(), new THREE.Texture());
  (models as unknown as { load: (id: string) => Promise<typeof neo> }).load = async id => id === 'neo-office' ? office : neo;
  try {
    const rig = (await models.create('neo'))!;
    const gesture = { phase: 'choice' as const, elapsed: 0, role: 'neo' as const, bugged: true };
    const input = { speed: 0, grounded: true, verticalVelocity: 0, turn: 0, meeting: gesture };
    const motion = newMotion();
    models.animate(rig, advanceMotion(motion, input, 0), motion, input, 0);
    const shirt = rig.wardrobe.find(part => /Black.crew.neck/i.test(part.mesh.name))!.mesh as THREE.SkinnedMesh;
    const skin = rig.wardrobe.find(part => (part.mesh.material as THREE.Material).name === 'Office skin')!.mesh as THREE.SkinnedMesh;
    const front = (mesh: THREE.SkinnedMesh, x: number, y: number, tuck: boolean): number => {
      const position = mesh.geometry.getAttribute('position'); const index = mesh.geometry.index!;
      const hem = tuck ? mesh.geometry.getAttribute('_meetingShirtTuck') : undefined;
      let depth = -Infinity;
      for (let i = 0; i < index.count; i += 3) {
        const a = index.getX(i), b = index.getX(i + 1), c = index.getX(i + 2);
        const ay = position.getY(a) - (hem?.getX(a) ?? 0) * .4;
        const by = position.getY(b) - (hem?.getX(b) ?? 0) * .4;
        const cy = position.getY(c) - (hem?.getX(c) ?? 0) * .4;
        const area = (by - cy) * (position.getX(a) - position.getX(c)) + (position.getX(c) - position.getX(b)) * (ay - cy);
        if (Math.abs(area) < 1e-9) continue;
        const u = ((by - cy) * (x - position.getX(c)) + (position.getX(c) - position.getX(b)) * (y - cy)) / area;
        const v = ((cy - ay) * (x - position.getX(c)) + (position.getX(a) - position.getX(c)) * (y - cy)) / area;
        if (Math.min(u, v, 1 - u - v) < -1e-7) continue;
        depth = Math.max(depth, u * position.getZ(a) + v * position.getZ(b) + (1 - u - v) * position.getZ(c));
      }
      return depth;
    };
    for (const x of [-.2, -.1, 0, .1, .2]) for (const y of [3.1, 3.2, 3.3, 3.4]) {
      const fabric = front(shirt, x, y, true), body = front(skin, x, y, false);
      assert.ok(Number.isFinite(fabric) && Number.isFinite(body) && fabric > body + .003,
        `skin shows through Neo’s seated shirt at ${x}, ${y}: fabric ${fabric}, skin ${body}`);
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

test('the morning alarm is turned off by Neo’s actual palm without stretching the arm', async () => {
  const { scene } = await loadGeometry(); const bones = new Map<string, THREE.Bone>(); const rest = new Map<string, THREE.Vector3>();
  scene.traverse(object => { if (object instanceof THREE.Bone) { bones.set(object.name, object); rest.set(object.name, object.position.clone()); } });
  const models = new HeroModels(new THREE.Texture(), new THREE.Texture()); const motion = newMotion();
  const rig: HeroRig = { root: scene, bones, rest, panels: [], footHeight: 0, glasses: new THREE.Group(), silver: { value: 0 }, wardrobe: [] };
  const center = FILM_SETS.film_anderson_flat.center;
  const button = new THREE.Vector3(center.x + MORNING.alarm.x, center.y - 1 + MORNING.alarm.y + .255, center.z + MORNING.alarm.z);
  try {
    for (const elapsed of [.55, .65]) {
      const morning = { phase: 'stopping' as const, elapsed }; const root = morningRoot(morning);
      scene.position.set(center.x + root.x, center.y, center.z + root.z); scene.rotation.y = root.yaw;
      const input = { speed: 0, grounded: true, verticalVelocity: 0, turn: 0, wakeCall: morningWakePose(morning), morning };
      models.animate(rig, advanceMotion(motion, input, .05), motion, input, .05); scene.updateMatrixWorld(true);
      const palm = bones.get('wrist_R')!.localToWorld(new THREE.Vector3(.09, -.18, .02));
      assert.ok(palm.distanceTo(button) < .025, `the palm must touch the pressed clock button: ${palm.distanceTo(button)}`);
      for (const name of ['elbow_R', 'wrist_R']) assert.equal(bones.get(name)!.position.length(), rest.get(name)!.length(), 'arm lengths remain anatomical');
      const head = bones.get('head')!.getWorldPosition(new THREE.Vector3());
      assert.ok(head.x > center.x + 7.1 && head.x < center.x + 13.3 && head.y > 1.5, 'Neo remains on the physical mattress');
    }
  } finally { models.dispose(); }
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
    actors[0].draw({ phase: 'choice', elapsed: 5, role: 'neo' });
    for (const side of ['L', 'R']) {
      const hand = actors[0].rig.bones.get('wrist_' + side)!;
      const palm = hand.localToWorld(new THREE.Vector3(side === 'R' ? .082 : -.082, -.18, .015));
      const knee = actors[0].rig.bones.get('knee_' + side)!.getWorldPosition(new THREE.Vector3());
      assert.ok(palm.distanceTo(knee) < .32, 'waiting Neo must rest his hands on his knees instead of holding both arms in midair');
    }
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
    actors[1].draw({ phase: 'taking', elapsed: 9.3, choice: 'red', role: 'morpheus' });
    for (const side of ['R', 'L']) {
      const rig = actors[1].rig;
      const palm = rig.root.worldToLocal(rig.bones.get('wrist_' + side)!.localToWorld(new THREE.Vector3(side === 'R' ? .082 : -.082, -.18, .015)));
      assert.ok(Math.abs(palm.x) > .9 && Math.abs(palm.x) < 1.15 && palm.y > 1.85 && palm.y < 2.02,
        `Morpheus must lower his hands onto the rolled armrests after offering the pills: ${palm.toArray()}`);
      const shoulder = rig.root.worldToLocal(rig.bones.get('shoulder_' + side)!.getWorldPosition(new THREE.Vector3()));
      const elbow = rig.root.worldToLocal(rig.bones.get('elbow_' + side)!.getWorldPosition(new THREE.Vector3()));
      assert.ok(Math.abs(elbow.x) > Math.abs(shoulder.x) + .1 && elbow.z < 0,
        `resting elbows must bend beside the body, not fold the coat sleeves across the abdomen: ${elbow.toArray()}`);
    }
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
    assert.equal(rig.wardrobe.find(part => /Black.crew.neck/i.test(part.mesh.name))?.mesh.visible, true,
      'Neo must change into ship recovery clothes before control returns for the walk to the core');
    assert.equal(rig.wardrobe.find(part => (part.mesh.material as THREE.Material).name === 'Office skin')?.mesh.visible, false,
      'the bare recovery torso must be covered once Neo is standing');
    const standingHead = rig.bones.get('head')!.getWorldPosition(new THREE.Vector3());
    const standingAnkle = rig.bones.get('ankle_L')!.getWorldPosition(new THREE.Vector3());
    assert.ok(standingHead.y > standingAnkle.y + 3.1, 'the saved final pose must finish upright beside the bed');
    assert.equal(interfaces.visible, true, 'real-world ports remain on Neo after the needles retract');
  } finally { models.dispose(); }
});
