import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test, type TestContext } from 'node:test';
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { FILM_SETS, awakeningPose, filmPosition, type FilmJourney } from '@auto_matrix/shared';
import { AgentRenderer } from '../packages/client/src/agents/AgentRenderer.js';
import { PodSetRenderer } from '../packages/client/src/engine/PodSetRenderer.js';
import { PlayerControls } from '../packages/client/src/player/PlayerControls.js';
import { WorldState } from '../packages/server/src/world/WorldState.js';
import { AgentManager } from '../packages/server/src/agents/AgentManager.js';

async function loadGeometry(id: string) {
  const glb = await readFile(new URL(`../packages/client/public/assets/characters/${id}.glb`, import.meta.url));
  const jsonLength = glb.readUInt32LE(12), document = JSON.parse(glb.subarray(20, 20 + jsonLength).toString());
  for (const material of document.materials) {
    delete material.pbrMetallicRoughness.baseColorTexture; delete material.normalTexture;
  }
  document.images = []; document.textures = [];
  const json = Buffer.from(JSON.stringify(document)), padded = Buffer.alloc(Math.ceil(json.length / 4) * 4, 32); json.copy(padded);
  const bin = glb.subarray(20 + jsonLength), result = Buffer.alloc(20 + padded.length + bin.length);
  result.writeUInt32LE(0x46546c67, 0); result.writeUInt32LE(2, 4); result.writeUInt32LE(result.length, 8);
  result.writeUInt32LE(padded.length, 12); result.writeUInt32LE(0x4e4f534a, 16); padded.copy(result, 20); bin.copy(result, 20 + padded.length);
  return new GLTFLoader().parseAsync(result.buffer.slice(result.byteOffset, result.byteOffset + result.byteLength), '');
}

async function setup(t: TestContext) {
  const assets = new Map(await Promise.all(['neo', 'neo-office', 'neo-tracking'].map(async id => [id, await loadGeometry(id)] as const)));
  t.mock.method(THREE.TextureLoader.prototype, 'load', () => new THREE.Texture());
  t.mock.method(GLTFLoader.prototype, 'loadAsync', async (path: string) => assets.get(path.split('/').pop()!.replace(/\.glb.*$/, ''))!);
  const document = globalThis.document;
  const context = { createRadialGradient: () => ({ addColorStop() {} }), fillRect() {}, strokeRect() {}, fillText() {},
    createImageData: (width: number, height: number) => ({ data: new Uint8ClampedArray(width * height * 4) }), putImageData() {} };
  globalThis.document = { createElement: () => ({ width: 0, height: 0, getContext: () => context }) } as unknown as Document;
  const world = new WorldState(); new AgentManager(world).initializeAllAgents();
  const neo = world.agents.get('neo')!; neo.currentLocation = 'film_power_plant_pods'; neo.isInMatrix = false; neo.rotation = Math.PI;
  const scene = new THREE.Scene(), renderer = new AgentRenderer(scene), root = new THREE.Group(); scene.add(root);
  const center = FILM_SETS.film_power_plant_pods.center; root.position.set(center.x, center.y - 1, center.z);
  const set = new PodSetRenderer(root);
  const at = (elapsed: number, wallTime = 100, firstPerson = false) => {
    const awakening = { kind: 'disconnect' as const, elapsed }, pose = awakeningPose(awakening);
    const journey = { scene: 'm1_pod', awakening } as FilmJourney;
    neo.position = filmPosition(neo.currentLocation, pose.x, pose.z); neo.position.y += pose.y;
    neo.currentAction = { type: 'idle', parameters: { filmPose: pose.pose }, startedAt: 0, duration: 1, progress: 0 };
    renderer.updateAgent('neo', neo); renderer.setWorld(false); renderer.setPlayer('neo', firstPerson);
    renderer.getAgent('neo')!.position.set(neo.position.x, neo.position.y, neo.position.z);
    renderer.getAgentBody('neo')!.rotation.y = Math.PI;
    renderer.update(0, undefined, 0, 0, journey);
    const body = renderer.getAgentBody('neo')!;
    set.update(journey, wallTime, firstPerson, body); scene.updateMatrixWorld(true);
    return body;
  };
  at(0); await new Promise(resolve => setImmediate(resolve)); at(0);
  t.after(() => { renderer.dispose(); set.dispose(); globalThis.document = document; });
  return { root, at, neo, renderer };
}

test('the pod neck hose seats against the shipped cervical socket before it is unlocked', async t => {
  const h = await setup(t);
  for (const elapsed of [0, .75, 1.5, 2.2]) {
    const body = h.at(elapsed), socket = body.getObjectByName('cervical-interface'); assert.ok(socket);
    let hose: THREE.Mesh<THREE.TubeGeometry> | undefined;
    h.root.traverse(object => {
      if (object instanceof THREE.Mesh && object.geometry instanceof THREE.TubeGeometry && object.geometry.parameters.radius === .12) hose = object as THREE.Mesh<THREE.TubeGeometry>;
    });
    assert.ok(hose);
    const end = hose.localToWorld(hose.geometry.parameters.path.getPoint(1));
    const contact = socket.localToWorld(new THREE.Vector3(0, 0, .025));
    assert.ok(end.distanceTo(contact) < .045, `at ${elapsed}s the hose floats ${end.distanceTo(contact)} units from the real socket`);
  }
});

test('a paused pod disconnection keeps its maintenance mechanism at the saved action clock', async t => {
  const h = await setup(t); h.at(2.4, 100);
  const matrices: number[][] = []; h.root.traverse(object => { if (object instanceof THREE.Mesh) matrices.push(object.matrixWorld.toArray()); });
  h.at(2.4, 300);
  const restored: number[][] = []; h.root.traverse(object => { if (object instanceof THREE.Mesh) restored.push(object.matrixWorld.toArray()); });
  assert.equal(restored.length, matrices.length);
  const drift = Math.max(...restored.flatMap((matrix, i) => matrix.map((value, j) => Math.abs(value - matrices[i][j]))));
  assert.ok(drift < 1e-8, `the paused mechanism changed its saved transform by ${drift}`);
});

test('maintenance clamps hold the neck locking collar without routing their links through Neo', async t => {
  const h = await setup(t);
  for (const elapsed of [1.8, 2.2, 2.7, 3.1, 3.5]) {
    const body = h.at(elapsed), skin: THREE.SkinnedMesh[] = [];
    body.traverse(object => {
      if (object instanceof THREE.SkinnedMesh && object.visible && (object.userData.patientBody || (object.material as THREE.Material).name === 'Skin')) {
        object.skeleton.update(); object.computeBoundingSphere(); skin.push(object);
      }
    });
    const frame = h.root.getObjectByName('pod-neck-connection'); assert.ok(frame);
    let collar: THREE.Mesh | undefined;
    frame.traverse(object => { if (object instanceof THREE.Mesh && object.geometry instanceof THREE.TorusGeometry && object.geometry.parameters.radius === .15) collar = object; });
    assert.ok(collar);
    for (const side of [-1, 1]) {
      const pad = h.root.getObjectByName(`pod-maintenance-pad-${side}`); assert.ok(pad);
      const from = pad.getWorldPosition(new THREE.Vector3()), inward = new THREE.Vector3(-side, 0, 0).applyQuaternion(pad.getWorldQuaternion(new THREE.Quaternion()));
      const contact = new THREE.Raycaster(from, inward, 0, .08).intersectObject(collar)[0];
      assert.ok(contact && contact.distance >= .035 && contact.distance < .07, `the clamp must grip the collar at ${elapsed}s, gap ${contact?.distance}`);
      for (let i = 0; i < 3; i++) {
        const link = h.root.getObjectByName(`pod-maintenance-link-${side}-${i}`); assert.ok(link);
        const start = link.localToWorld(new THREE.Vector3(0, -.5, 0)), delta = link.localToWorld(new THREE.Vector3(0, .5, 0)).sub(start);
        const hit = new THREE.Raycaster(start, delta.clone().normalize(), .01, delta.length()).intersectObjects(skin)[0];
        assert.ok(!hit, `maintenance link ${side}/${i} crosses the body at ${elapsed}s, at ${hit ? h.root.worldToLocal(hit.point.clone()).toArray() : 'none'}`);
      }
    }
  }
});

test('body feeds seat in the four real chest ports and retract separately before the drain opens', async t => {
  const h = await setup(t);
  const check = (elapsed: number) => {
    const body = h.at(elapsed), ports = body.getObjectByName('thoracic-interfaces'); assert.ok(ports);
    return Array.from({ length: 4 }, (_, i) => {
      const plug = h.root.getObjectByName(`pod-body-plug-${i}`); assert.ok(plug);
      return plug.localToWorld(new THREE.Vector3(0, -.06, 0)).distanceTo(ports.children[i * 2 + 1].localToWorld(new THREE.Vector3(0, .0225, 0)));
    });
  };
  assert.ok(check(2.8).every(gap => gap < 1e-5), 'the ends must touch actual implanted ports, not guessed body coordinates');
  const gaps = check(3.3);
  assert.ok(gaps[0] > .4 && gaps[3] < 1e-5, 'the first cable is released while the last remains connected');
  h.at(4.05);
  for (let i = 0; i < 4; i++) {
    const feed = h.root.getObjectByName(`pod-body-feed-${i}`); assert.ok(feed);
    assert.equal(feed.parent!.visible, false, 'all feeds must be clear before Neo falls away');
    assert.equal(feed.parent!.scale.y, 1, 'disconnecting cannot shrink the entire group toward the floor');
  }
});

test('the clear neck needle withdraws along the real socket axis without drawing inside the head', async t => {
  const h = await setup(t); h.at(2.7);
  const needle = h.root.getObjectByName('pod-neck-needle'); assert.ok(needle);
  assert.equal(needle.visible, false, 'the inserted part must not draw through the skull');
  let previous = 0;
  for (const elapsed of [2.8, 3.05, 3.3, 3.5]) {
    const body = h.at(elapsed), socket = body.getObjectByName('cervical-interface')!;
    const contact = socket.localToWorld(new THREE.Vector3(0, 0, .025)), normal = new THREE.Vector3(0, 0, 1).applyQuaternion(socket.getWorldQuaternion(new THREE.Quaternion()));
    assert.equal(needle.visible, true);
    const inner = needle.localToWorld(new THREE.Vector3(0, -.5, 0)).sub(contact), outer = needle.localToWorld(new THREE.Vector3(0, .5, 0)).sub(contact);
    assert.ok(inner.dot(normal) >= -1e-5, 'the rendered needle starts at or outside the port');
    assert.ok(inner.clone().cross(normal).length() < 1e-5 && outer.clone().cross(normal).length() < 1e-5, 'withdrawal must follow the cervical opening');
    assert.ok(outer.dot(normal) > previous); previous = outer.dot(normal);
  }
  assert.ok(previous > .85, 'the needle must leave the port before the body is released');
});

test('a restored mid-unplug scene reconstructs the same contacts and keeps its hose buffers', async t => {
  const h = await setup(t); h.at(3.12);
  const snapshot = (root: THREE.Object3D) => {
    const result: number[][] = [];
    root.traverse(object => {
      if (object instanceof THREE.Mesh && object.name.startsWith('pod-') && !object.name.startsWith('pod-rescue-')) {
        result.push(object.matrixWorld.toArray());
        if (object.geometry instanceof THREE.TubeGeometry) result.push(Array.from(object.geometry.getAttribute('position').array));
      }
    });
    return result;
  };
  const initial = snapshot(h.root), hose = h.root.getObjectByName('pod-neck-feed') as THREE.Mesh, geometry = hose.geometry, buffer = geometry.getAttribute('position');
  h.at(9); h.at(3.12, 300);
  assert.deepEqual(snapshot(h.root), initial, 'returning from a later frame must reconstruct the saved clock, independent of frame history');
  assert.equal(hose.geometry, geometry); assert.equal(hose.geometry.getAttribute('position'), buffer, 'bending must reuse the geometry and GPU buffer');
  await t.test('a newly loaded scene has the same saved connector pose', async t => {
    const restored = await setup(t); restored.at(3.12, 500);
    assert.deepEqual(snapshot(restored.root), initial, 'a new renderer loaded in the middle must match the existing scene');
  });
});

test('the pod disconnection camera keeps the real head and chest above the subtitle region in both aspect ratios', async t => {
  const h = await setup(t);
  class InputTarget extends EventTarget { matches() { return false; } }
  const window = new InputTarget(), canvas = new InputTarget(), document = new InputTarget(), previous = globalThis.window;
  globalThis.window = window as unknown as Window & typeof globalThis;
  Object.assign(globalThis.document, { pointerLockElement: canvas, exitPointerLock() {}, hidden: false,
    addEventListener: document.addEventListener.bind(document), removeEventListener: document.removeEventListener.bind(document) });
  try {
    for (const aspect of [16 / 9, 449 / 680]) {
      const camera = new THREE.PerspectiveCamera(57, aspect, .5, 5000), controls = new PlayerControls(canvas as unknown as HTMLCanvasElement, camera, () => {}, () => {});
      try {
        for (const elapsed of [0, 2.4, 3.1]) {
          const body = h.at(elapsed); controls.possess(h.neo); controls.performing = true;
          for (let i = 0; i < 120; i++) controls.update(1 / 60, h.neo, h.renderer.getAgent('neo')!, false);
          h.at(elapsed);
          camera.updateMatrixWorld(true);
          for (const name of ['head', 'chest']) {
            const projected = body.getObjectByName(name)!.getWorldPosition(new THREE.Vector3()).project(camera);
            assert.ok(Math.abs(projected.x) < .75 && projected.y > -.42 && projected.y < .6 && projected.z > -1 && projected.z < 1,
              `${name} at ${elapsed}s / aspect ${aspect} must clear the HUD and captions: ${projected.toArray()}`);
          }
        }
      } finally { controls.dispose(); }
    }
  } finally { globalThis.window = previous; }
});

test('Neo sits up inside the pod while his hips and lower body remain supported in the basin', async t => {
  const h = await setup(t), body = h.at(0);
  const startHead = body.getObjectByName('head')!.getWorldPosition(new THREE.Vector3());
  const hips = body.getObjectByName('pelvis')!.getWorldPosition(new THREE.Vector3());
  h.at(1.7);
  const head = body.getObjectByName('head')!.getWorldPosition(new THREE.Vector3());
  assert.ok(head.y - startHead.y > 1, `the head must rise out of the fluid instead of remaining horizontal: ${head.y - startHead.y}`);
  assert.ok(body.getObjectByName('pelvis')!.getWorldPosition(new THREE.Vector3()).distanceTo(hips) < .12, 'sitting up must pivot at supported hips, not raise the entire body');
  for (const side of ['R', 'L']) {
    const ankle = h.root.worldToLocal(body.getObjectByName(`ankle_${side}`)!.getWorldPosition(new THREE.Vector3()));
    assert.ok(Math.abs(ankle.x) < 1.3 && ankle.z > -15.9 && ankle.z < -9.7 && ankle.y < 2.3, `the lower body must remain inside the fluid basin: ${side} ${ankle.toArray()}`);
  }
});

test('Neo braces both palms on the real pod rim during the sit-up', async t => {
  const h = await setup(t);
  for (const elapsed of [.7, 1.2, 1.7, 2.4]) {
    const body = h.at(elapsed);
    for (const side of ['R', 'L']) {
      const wrist = body.getObjectByName(`wrist_${side}`)!;
      const palm = wrist.localToWorld(new THREE.Vector3(side === 'R' ? .09 : -.09, -.18, .15));
      const hit = new THREE.Raycaster(palm.clone().add(new THREE.Vector3(0, .07, 0)), new THREE.Vector3(0, -1, 0), 0, .14).intersectObject(h.root, true)
        .find(hit => hit.object instanceof THREE.Mesh && (hit.object.material as THREE.MeshStandardMaterial).color?.getHex() === 0x46565b);
      assert.ok(hit && Math.abs(hit.point.y - palm.y) < .04, `${side} palm at ${elapsed}s must press the actual rim, instead of floating above the body: ${h.root.worldToLocal(palm).toArray()}`);
    }
  }
});

test('the connected hose routes remain outside the shipped skin as Neo rises', async t => {
  const h = await setup(t);
  for (const elapsed of [.4, .7, 1, 1.3, 1.7, 2.4, 2.8, 3.2]) {
    const body = h.at(elapsed), skin: THREE.Mesh[] = [];
    body.traverse(object => {
      if (object instanceof THREE.SkinnedMesh && object.visible && (object.userData.patientBody || (object.material as THREE.Material).name === 'Skin')) {
        // Bake this actual pose once; repeated SkinnedMesh rays otherwise reskin every triangle.
        const geometry = new THREE.BufferGeometry(), positions = object.geometry.getAttribute('position'), posed = new THREE.Float32BufferAttribute(new Float32Array(positions.count * 3), 3);
        const point = new THREE.Vector3();
        for (let i = 0; i < positions.count; i++) { object.getVertexPosition(i, point); posed.setXYZ(i, point.x, point.y, point.z); }
        geometry.setAttribute('position', posed); geometry.setIndex(object.geometry.index); geometry.computeBoundingBox(); geometry.computeBoundingSphere();
        const mesh = new THREE.Mesh(geometry, object.material); mesh.matrixWorld.copy(object.matrixWorld); skin.push(mesh);
      }
    });
    for (const name of ['pod-neck-feed', ...Array.from({ length: 4 }, (_, i) => `pod-body-feed-${i}`)]) {
      const hose = h.root.getObjectByName(name) as THREE.Mesh<THREE.TubeGeometry>;
      for (let i = 0; i < 24; i++) {
        const from = hose.localToWorld(hose.geometry.parameters.path.getPoint(i / 24));
        const delta = hose.localToWorld(hose.geometry.parameters.path.getPoint((i + 1) / 24)).sub(from);
        const hit = new THREE.Raycaster(from, delta.clone().normalize(), .002, delta.length()).intersectObjects(skin)[0];
        assert.ok(!hit, `${name} crosses the actual body at ${elapsed}s, segment ${i}: ${hit ? h.root.worldToLocal(hit.point.clone()).toArray() : 'none'}`);
      }
    }
    skin.forEach(mesh => mesh.geometry.dispose());
  }
});

test('the saved pod body pose is independent of wall time, earlier frames and a newly loaded model', async t => {
  const h = await setup(t);
  const bones = () => {
    const result: number[][] = []; h.renderer.getAgentBody('neo')!.traverse(object => { if (object instanceof THREE.Bone) result.push(object.matrixWorld.toArray()); }); return result;
  };
  h.at(1.7); const first = bones();
  h.renderer.update(.35, undefined, 1, 0, { scene: 'm1_pod', awakening: { kind: 'disconnect', elapsed: 1.7 } } as FilmJourney);
  h.at(1.7, 500);
  assert.deepEqual(bones(), first, 'generic idle breathing and accumulated motion cannot shift a paused story pose');
  await t.test('cold loading restores the same supported pose', async t => {
    const restored = await setup(t); restored.at(1.7, 900);
    const result: number[][] = []; restored.renderer.getAgentBody('neo')!.traverse(object => { if (object instanceof THREE.Bone) result.push(object.matrixWorld.toArray()); });
    assert.deepEqual(result, first);
  });
});

test('the shipped support-hand surfaces do not sit inside the solid pod rim', async t => {
  const h = await setup(t), metal = new Set<THREE.Material>(), solids: THREE.Mesh[] = [];
  h.root.traverse(object => {
    if (object instanceof THREE.Mesh && !(object instanceof THREE.InstancedMesh) && (object.material as THREE.MeshStandardMaterial).color?.getHex() === 0x46565b) {
      metal.add(object.material as THREE.Material); solids.push(object); object.geometry.computeBoundingBox();
    }
  });
  for (const material of metal) material.side = THREE.DoubleSide;
  for (const elapsed of [.7, .95, 1.2, 1.45, 1.7, 2, 2.4]) {
    const body = h.at(elapsed), inside: number[][] = [];
    body.traverse(object => {
      if (!(object instanceof THREE.SkinnedMesh) || !object.visible || (object.material as THREE.Material).name !== 'Skin') return;
      const index = object.geometry.getAttribute('skinIndex'), weight = object.geometry.getAttribute('skinWeight');
      for (let i = 0; i < index.count; i++) {
        if (!Array.from({ length: 4 }, (_, j) => weight.getComponent(i, j) > .2 && /^(wrist_|finger)/.test(object.skeleton.bones[index.getComponent(i, j)].name)).some(Boolean)) continue;
        const point = object.localToWorld(object.getVertexPosition(i, new THREE.Vector3()));
        const local = h.root.worldToLocal(point.clone());
        if (Math.abs(local.x) < 1.3 || local.y < 2.02 || local.y > 2.2 || local.z < -14 || local.z > -12.8) continue;
        const hits = new THREE.Raycaster(point.clone().add(new THREE.Vector3(0, .3, 0)), new THREE.Vector3(0, -1, 0), 0, .6).intersectObjects(solids);
        let entry: THREE.Intersection | undefined;
        const normalMatrix = new THREE.Matrix3();
        for (const hit of hits) {
          const normal = hit.face!.normal.clone().applyNormalMatrix(normalMatrix.getNormalMatrix(hit.object.matrixWorld));
          if (normal.y > .01) entry = hit;
          else if (normal.y < -.01 && entry) {
            if (entry.point.y - point.y > .005 && point.y - hit.point.y > .005) {
              const wrist = body.getObjectByName(local.x < 0 ? 'wrist_R' : 'wrist_L')!;
              inside.push([...local.toArray(), ...wrist.worldToLocal(point.clone()).toArray()]); break;
            }
            entry = undefined;
          }
        }
      }
    });
    assert.equal(inside.length, 0, `support skin penetrates the rim at ${elapsed}s: ${JSON.stringify(inside.slice(0, 4))}`);
  }
});

test('the pod first-person eye follows the shipped head and keeps the support hands visible', async t => {
  const h = await setup(t);
  class InputTarget extends EventTarget { matches() { return false; } }
  const window = new InputTarget(), canvas = new InputTarget(), document = new InputTarget(), previous = globalThis.window;
  globalThis.window = window as unknown as Window & typeof globalThis;
  Object.assign(globalThis.document, { pointerLockElement: canvas, exitPointerLock() {}, hidden: false,
    addEventListener: document.addEventListener.bind(document), removeEventListener: document.removeEventListener.bind(document) });
  const camera = new THREE.PerspectiveCamera(57, 16 / 9, .5, 5000), controls = new PlayerControls(canvas as unknown as HTMLCanvasElement, camera, () => {}, () => {});
  try {
    for (const elapsed of [0, .6, 1.3, 2.4]) {
      const body = h.at(elapsed); controls.possess(h.neo); controls.performing = true; controls.firstPerson = true;
      controls.update(1 / 60, h.neo, h.renderer.getAgent('neo')!, false);
      const eye = body.getObjectByName('head')!.localToWorld(new THREE.Vector3(0, .1, .32));
      assert.ok(camera.position.distanceTo(eye) < .05, `at ${elapsed}s the view must follow the actual eyes, gap ${camera.position.distanceTo(eye)}`);
      h.renderer.setPlayerMotion(controls.motion); h.at(elapsed, 100, true);
      assert.equal(body.visible, true, 'first person must retain the real hands and body while hiding the head surface');
      const head = body.getObjectByName('head')!, skin: THREE.SkinnedMesh[] = [];
      body.traverse(object => {
        if (object instanceof THREE.SkinnedMesh && object.visible && (object.userData.patientBody || (object.material as THREE.Material).name === 'Skin')) {
          object.skeleton.update(); object.computeBoundingSphere(); skin.push(object);
        }
      });
      const face = new THREE.Raycaster(head.localToWorld(new THREE.Vector3(0, .1, .8)), new THREE.Vector3(0, 0, -1).applyQuaternion(head.getWorldQuaternion(new THREE.Quaternion())), 0, .7).intersectObjects(skin);
      assert.equal(face.length, 0, 'the retained body cannot render its own face into the first-person eye');
    }
    const direction = camera.getWorldDirection(new THREE.Vector3()), rotation = h.renderer.getAgentBody('neo')!.quaternion.clone();
    document.dispatchEvent(Object.assign(new Event('mousemove'), { movementX: 180, movementY: -80 }));
    controls.update(1 / 60, h.neo, h.renderer.getAgent('neo')!, false);
    assert.ok(camera.getWorldDirection(new THREE.Vector3()).distanceTo(direction) > .25, 'the supported body must still allow free observation while paused');
    assert.ok(h.renderer.getAgentBody('neo')!.quaternion.angleTo(rotation) < 1e-7, 'free observation cannot rotate the reclined body away from its saved support');
  } finally { controls.dispose(); globalThis.window = previous; }
});
