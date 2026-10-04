import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { HeroModels } from '../packages/client/src/agents/HeroModel.js';
import { advanceMotion, newMotion } from '../packages/client/src/agents/CharacterMotion.js';
import * as THREE from 'three';
import { farewellPose, newFarewell, FILM_SCENE_BY_ID, FILM_SETS, filmEntry } from '@auto_matrix/shared';
import { LogosWreckRenderer } from '../packages/client/src/engine/LogosWreckRenderer.js';

function capture(root: THREE.Group) {
  root.updateMatrixWorld(true);
  const state: unknown[] = [];
  for (const name of ['logos-wreck-fire', 'logos-wreck-golden-vision']) root.getObjectByName(name)!.traverse(item => {
    state.push({ matrix: item.matrixWorld.toArray(), visible: item.visible,
      intensity: item instanceof THREE.Light ? item.intensity : undefined });
  });
  return state;
}

test('the cockpit key light keeps its local downward direction at the actual distant film set', () => {
  const root = new THREE.Group(), renderer = new LogosWreckRenderer(root);
  try {
    let key!: THREE.DirectionalLight;
    root.traverse(object => { if (object instanceof THREE.DirectionalLight) key = object; });
    const direction = () => {
      root.updateMatrixWorld(true); key.target.updateWorldMatrix(true, false);
      return key.target.getWorldPosition(new THREE.Vector3()).sub(key.getWorldPosition(new THREE.Vector3())).normalize();
    };
    const local = direction();
    const center = FILM_SETS.film_logos_wreck.center;
    root.position.set(center.x, center.y - 1, center.z);
    const placed = direction();
    assert.ok(placed.distanceTo(local) < .0001, `placing the set changes its key direction by ${placed.distanceTo(local)}`);
    assert.ok(placed.y < -.7, 'the broken windshield light must reach the seated bodies and deck from above');
  } finally { renderer.dispose(); }
});

test('cockpit ribs leave the entry route and both farewell camera sightlines clear', () => {
  const root = new THREE.Group(), renderer = new LogosWreckRenderer(root);
  try {
    root.updateMatrixWorld(true);
    const structure: THREE.Mesh[] = [];
    root.traverse(item => {
      if (item instanceof THREE.Mesh && item.geometry instanceof THREE.TorusGeometry && item.geometry.parameters.radius === 7.65) structure.push(item);
    });
    structure.push(root.getObjectByName('logos-wreck-windshield') as THREE.Mesh);
    const scene = FILM_SCENE_BY_ID.m3_farewell, set = FILM_SETS[scene.set];
    const entryZ = filmEntry(scene).z - set.center.z, reachZ = scene.steps[0].z!;
    // Renderer origin is one metre below the shared scene floor. These are the
    // actual standing and follow-camera offsets used by PlayerControls.
    const pitch = .24, head = new THREE.Vector3(.2, 3.28, -15.96);
    const assertClear = (eye: THREE.Vector3, target: THREE.Vector3, label: string) => {
      const delta = target.clone().sub(eye);
      const hits = new THREE.Raycaster(eye, delta.clone().normalize(), 0, delta.length()).intersectObjects(structure, false);
      assert.equal(hits.length, 0, `${label}: frame blocks view at ${hits.map(hit => hit.point.toArray().map(n => n.toFixed(2)))}`);
    };
    for (let step = 0; step <= 24; step++) {
      const z = THREE.MathUtils.lerp(entryZ, reachZ, step / 24);
      const eyes = new THREE.Vector3(0, 3.99, z);
      assertClear(eyes, head, `first person at ${z.toFixed(2)}`);
      for (const narrow of [false, true]) {
        const follow = narrow ? 13 : 11.5;
        const camera = new THREE.Vector3(narrow ? .3 : .8, 3.05 + (Math.sin(pitch) + .1) * follow, z + Math.cos(pitch) * follow);
        assertClear(camera, eyes, `follow camera at ${z.toFixed(2)}`);
        assertClear(camera, head, `Trinity ahead at ${z.toFixed(2)}`);
      }
    }
    for (const phase of ['ready', 'reaching', 'goodbye', 'kiss', 'still'] as const) {
      const pose = farewellPose({ ...newFarewell(), phase, elapsed: 1.5 });
      for (const side of [4.8, 5.8]) {
        assertClear(new THREE.Vector3(pose.neo.x + side, 5.4, pose.neo.z + 3.2), head, `${phase} Trinity face`);
      }
    }
  } finally { renderer.dispose(); }
});

test('cockpit ribs remain solid transverse roof and side supports outside the walkable aisle', () => {
  const root = new THREE.Group(), renderer = new LogosWreckRenderer(root);
  try {
    root.updateMatrixWorld(true);
    const ribs: THREE.Mesh[] = [];
    root.traverse(item => {
      if (item instanceof THREE.Mesh && item.geometry instanceof THREE.TorusGeometry && item.geometry.parameters.radius === 7.65 && item.visible && item.parent!.visible) ribs.push(item);
    });
    // Probe the structural bays even if geometry is removed: the roof and both
    // side supports must still be hittable, not hidden to clear the view.
    for (let bay = 0; bay < 12; bay++) {
      const z = -16 + bay * 2.85, origin = new THREE.Vector3(0, 3.99, z);
      for (const direction of [new THREE.Vector3(0, 1, 0), new THREE.Vector3(1, 0, 0), new THREE.Vector3(-1, 0, 0)]) {
        const hits = new THREE.Raycaster(origin, direction, 0, 9).intersectObjects(ribs, false);
        assert.ok(hits.length, `missing structural support at z=${z}, direction=${direction.toArray()}`);
        assert.ok(hits[0].distance > (direction.y ? 3 : 5.5), `rib intrudes into the aisle at ${hits[0].point.toArray()}`);
      }
    }
  } finally { renderer.dispose(); }
});

test('wreck fire and machine sight retain the saved farewell beat across pauses and reloads', () => {
  const root = new THREE.Group(), restored = new THREE.Group();
  const renderer = new LogosWreckRenderer(root), other = new LogosWreckRenderer(restored);
  const farewell = { ...newFarewell(), phase: 'promise' as const, elapsed: 1.3, total: 7.1 };
  try {
    renderer.update(farewell, 100, true, true); const paused = capture(root);
    renderer.update(farewell, 125, true, true);
    assert.deepEqual(capture(root), paused, 'a render frame must not advance a paused accident');
    other.update(structuredClone(farewell), 0, true, true);
    assert.deepEqual(capture(restored), paused, 'reloading must not regenerate different fire or light positions');
    renderer.update({ ...farewell, elapsed: 1.8, total: 7.6 }, 125, true, true);
    assert.notDeepEqual(capture(root), paused, 'the environment must still move when the saved performance clock advances');
  } finally { renderer.dispose(); other.dispose(); }
});

test('golden machine perception belongs to Neo first person, not the external farewell camera', () => {
  const root = new THREE.Group(), renderer = new LogosWreckRenderer(root);
  const farewell = { ...newFarewell(), phase: 'discovery' as const, elapsed: 1.2, total: 3.6 };
  try {
    renderer.update(farewell, 4, false);
    assert.equal(root.getObjectByName('logos-wreck-golden-vision')!.visible, false,
      'the outside camera must show physical wreckage rather than Neo\'s subjective light');
    renderer.update(farewell, 4, true);
    assert.equal(root.getObjectByName('logos-wreck-golden-vision')!.visible, false, 'another character in first person has no machine perception');
    renderer.update(farewell, 4, true, true);
    assert.equal(root.getObjectByName('logos-wreck-golden-vision')!.visible, true);
    renderer.update(undefined, 4, true, true);
    assert.equal(root.getObjectByName('logos-wreck-golden-vision')!.visible, false,
      'visiting the set without the farewell cannot grant blind Neo\'s perception');
  } finally { renderer.dispose(); }
});

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

test('wreck shafts pin Trinity’s jacket while leaving both faces and the contact hands clear', async () => {
  const [neo, office, trinity] = await Promise.all([loadGeometry('neo'), loadGeometry('neo-office'), loadGeometry('trinity')]);
  const models = new HeroModels(new THREE.Texture(), new THREE.Texture());
  (models as unknown as { load: (id: string) => Promise<typeof neo> }).load = async id => id === 'neo-office' ? office : id === 'trinity' ? trinity : neo;
  const root = new THREE.Group(), renderer = new LogosWreckRenderer(root);
  try {
    const neoRig = (await models.create('neo'))!, trinityRig = (await models.create('trinity'))!;
    const bars: THREE.Mesh[] = []; root.getObjectByName('logos-wreck-rebar')!.traverse(item => {
      if (item instanceof THREE.Mesh) bars.push(item);
    });
    root.updateMatrixWorld(true);
    const segments = bars.map(bar => {
      const height = (bar.geometry as THREE.CylinderGeometry).parameters.height;
      return new THREE.Line3(bar.localToWorld(new THREE.Vector3(0, -height / 2, 0)), bar.localToWorld(new THREE.Vector3(0, height / 2, 0)));
    });
    const states = [newFarewell(),
      { phase: 'reaching' as const, elapsed: 1.2, total: 1.2 },
      { phase: 'discovery' as const, elapsed: 1.7, total: 4.1 },
      { phase: 'promise' as const, elapsed: 2.3, total: 8.1 },
      { phase: 'goodbye' as const, elapsed: 2.6, total: 13 },
      { phase: 'kiss' as const, elapsed: 1.5, total: 17.1 },
      { phase: 'still' as const, elapsed: 0, total: 18.4 },
      ...[0, .6, 1.8, 2.35].map(elapsed => ({ phase: 'reaching' as const, elapsed, total: elapsed })),
      ...[.5, 1, 1.5, 4.8].map(elapsed => ({ phase: 'goodbye' as const, elapsed, total: 10.4 + elapsed })),
      ...[.25, .75, 2, 2.5].map(elapsed => ({ phase: 'kiss' as const, elapsed, total: 15.6 + elapsed }))];
    for (const encounter of states) {
      const pose = farewellPose(encounter), neoMotion = newMotion(), trinityMotion = newMotion();
      neoRig.root.position.set(pose.neo.x, 0, pose.neo.z); neoRig.root.rotation.set(0, pose.neo.yaw, 0);
      trinityRig.root.position.set(pose.trinity.x, 0, pose.trinity.z); trinityRig.root.rotation.set(-.48, pose.trinity.yaw, 0);
      const trinityInput = { speed: 0, grounded: true, verticalVelocity: 0, turn: 0, realWorld: true, floorSeated: true,
        farewell: { ...encounter, role: 'trinity' as const } };
      models.animate(trinityRig, advanceMotion(trinityMotion, trinityInput, 0), trinityMotion, trinityInput, 0);
      trinityRig.root.updateMatrixWorld(true);
      const handTarget = trinityRig.bones.get('wrist_R')!.localToWorld(new THREE.Vector3(0, -.08, .04));
      const neoInput = { speed: 0, grounded: true, verticalVelocity: 0, turn: 0, realWorld: true, crouching: true,
        farewell: { ...encounter, role: 'neo' as const, target: handTarget } };
      models.animate(neoRig, advanceMotion(neoMotion, neoInput, 0), neoMotion, neoInput, 0);
      neoRig.root.updateMatrixWorld(true);
      const faceTarget = neoRig.bones.get('head')!.localToWorld(new THREE.Vector3(0, .1, .08));
      const reaching = { ...trinityInput, farewell: { ...trinityInput.farewell, target: faceTarget } };
      models.animate(trinityRig, advanceMotion(trinityMotion, reaching, 0), trinityMotion, reaching, 0);
      trinityRig.root.updateMatrixWorld(true);
      const jacket = trinityRig.root.getObjectByName('Fitted_leather_jacket') as THREE.SkinnedMesh;
      const skin = trinityRig.root.getObjectByName('Anatomical_head_and_hands') as THREE.SkinnedMesh;
      for (const rig of [neoRig, trinityRig]) rig.root.traverse(item => {
        if (item instanceof THREE.SkinnedMesh) { item.skeleton.update(); item.computeBoundingBox(); item.computeBoundingSphere(); }
      });
      let pinned = 0;
      for (const [index, segment] of segments.entries()) {
        const direction = segment.delta(new THREE.Vector3()).normalize();
        const ray = new THREE.Raycaster(segment.start, direction, 0, segment.distance());
        if (ray.intersectObject(jacket, false).length) pinned++;
        const side = new THREE.Vector3().crossVectors(direction, new THREE.Vector3(0, 1, 0)).normalize();
        const up = new THREE.Vector3().crossVectors(direction, side).normalize();
        // Test the actual shaft radius as well as its axis, so a rod grazing a face is not missed.
        const rays = [ray, ...[side, side.clone().negate(), up, up.clone().negate()].map(offset =>
          new THREE.Raycaster(segment.start.clone().addScaledVector(offset, .085), direction, 0, segment.distance()))];
        const exposedHits = rays.flatMap(probe => probe.intersectObject(skin, false)).filter(hit => {
          const weights = skin.geometry.attributes.skinWeight, joints = skin.geometry.attributes.skinIndex;
          return [hit.face!.a, hit.face!.b, hit.face!.c].some(vertex => {
            const values = [weights.getX(vertex), weights.getY(vertex), weights.getZ(vertex), weights.getW(vertex)];
            const indices = [joints.getX(vertex), joints.getY(vertex), joints.getZ(vertex), joints.getW(vertex)];
            return values.some((weight, slot) => weight > .25 && /^(head|neck|wrist_[LR]|finger\d-\d_[LR])$/.test(skin.skeleton.bones[indices[slot]].name));
          });
        });
        assert.equal(exposedHits.length, 0, `${encounter.phase}: shaft ${index} crosses Trinity’s face or contact hands at ${exposedHits.map(hit => hit.point.toArray())}`);
        const neoHits = rays.flatMap(probe => probe.intersectObject(neoRig.root, true)).filter(hit => hit.object.visible && hit.object instanceof THREE.SkinnedMesh);
        assert.equal(neoHits.length, 0, `${encounter.phase}: shaft ${index} must not impale Neo at ${neoHits.map(hit => hit.object.name + hit.point.toArray())}`);
      }
      assert.ok(pinned >= 2, `${encounter.phase}: steel must actually meet the pinned body, not float metres above it (only ${pinned} shafts meet the jacket)`);
    }
  } finally { renderer.dispose(); models.dispose(); }
});
