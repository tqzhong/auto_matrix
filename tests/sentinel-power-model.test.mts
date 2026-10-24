import assert from 'node:assert/strict';
import test, { type TestContext } from 'node:test';
import { readFile } from 'node:fs/promises';
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { clone } from 'three/addons/utils/SkeletonUtils.js';
import { FILM_SETS, SENTINEL_STATION, SENTINEL_TIMING, type SentinelGesture } from '@auto_matrix/shared';
import { CharacterModels } from '../packages/client/src/agents/CharacterModel.js';
import { SentinelSetRenderer } from '../packages/client/src/engine/SentinelSetRenderer.js';
import { WorldState } from '../packages/server/src/world/WorldState.js';
import { AgentManager } from '../packages/server/src/agents/AgentManager.js';

async function fixture(t: TestContext) {
  const assets = new Map<string, Promise<any>>(), pending: Promise<unknown>[] = [];
  t.mock.method(GLTFLoader.prototype, 'loadAsync', async url => {
    const name = String(url).split('/').pop()!;
    if (!assets.has(name)) assets.set(name, (async () => {
      const raw = await readFile(new URL(`../packages/client/public/assets/characters/${name}`, import.meta.url));
      const length = raw.readUInt32LE(12), doc = JSON.parse(raw.subarray(20, 20 + length).toString());
      for (const material of doc.materials) { delete material.pbrMetallicRoughness.baseColorTexture; delete material.normalTexture; }
      doc.images = []; doc.textures = [];
      const json = Buffer.from(JSON.stringify(doc)), padded = Buffer.alloc(Math.ceil(json.length / 4) * 4, 32); json.copy(padded);
      const bin = raw.subarray(20 + length), data = Buffer.alloc(20 + padded.length + bin.length);
      data.writeUInt32LE(0x46546c67); data.writeUInt32LE(2, 4); data.writeUInt32LE(data.length, 8);
      data.writeUInt32LE(padded.length, 12); data.writeUInt32LE(0x4e4f534a, 16); padded.copy(data, 20); bin.copy(data, 20 + padded.length);
      return new GLTFLoader().parseAsync(data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength), '');
    })());
    const promise = assets.get(name)!; pending.push(promise); const asset = await promise;
    return { ...asset, scene: clone(asset.scene) };
  });
  t.mock.method(THREE.TextureLoader.prototype, 'load', () => new THREE.Texture());
  const previous = globalThis.document;
  globalThis.document = { createElement: () => ({ getContext: () => ({ createImageData: (w: number, h: number) => ({ data: new Uint8ClampedArray(w * h * 4) }), putImageData() {} }) }) } as unknown as Document;
  const world = new WorldState(); new AgentManager(world).initializeAllAgents(); const models = new CharacterModels();
  const rigs = new Map();
  for (const role of ['neo', 'morpheus', 'tank', 'dozer', 'trinity'] as const) {
    const state = world.agents.get(role)!; state.isInMatrix = false; rigs.set(role, models.create(state));
  }
  await Promise.all(pending); await new Promise(resolve => setImmediate(resolve));
  const center = FILM_SETS.film_service_tunnels.center;
  for (const [role, rig] of rigs) {
    assert.ok(rig.hero, `${role}: load the actual supported anatomical rig`);
    const at = role === 'neo' ? SENTINEL_STATION.approach : SENTINEL_STATION[role as Exclude<SentinelGesture['role'], 'neo'>];
    rig.root.position.set(center.x + at.x, center.y - 1, center.z + at.z); rig.root.rotation.y = at.yaw;
  }
  const scene = new THREE.Group(); scene.position.set(center.x, center.y - 1, center.z); const renderer = new SentinelSetRenderer(scene);
  const draw = (phase: SentinelGesture['phase'], elapsed: number) => {
    const encounter = { phase, elapsed, noise: 0, attempt: 0 };
    for (const [role, rig] of rigs) {
      models.animate(rig, 0, { speed: 0, grounded: true, verticalVelocity: 0, turn: 0, realWorld: true, glasses: false,
        nebCrewEarly: true, nebCrew: ['neo', 'morpheus', 'trinity'].includes(role) ? role : undefined,
        sentinel: role === 'neo' && ['ready', 'briefing', 'sweep', 'verify', 'done'].includes(phase) ? undefined : { ...encounter, role } }, 4);
      rig.root.updateMatrixWorld(true);
    }
    renderer.update({ version: 1, scene: 'm1_sentinels', actor: 'neo', step: 0, completed: [], enteredAt: 0, reflections: {}, lastText: '', checkpoint: world.agents.get('neo')!.position, sentinel: encounter }, elapsed);
    scene.updateMatrixWorld(true);
  };
  t.after(() => { models.dispose(); renderer.dispose(); globalThis.document = previous; });
  return { rigs, draw, scene, models };
}

test('the physical cockpit deck stays below all five crew members’ actual soles', async t => {
  const h = await fixture(t); h.draw('shutdown', 2);
  const deck = h.scene.getObjectByName('sentinel-cockpit-deck') as THREE.Mesh;
  const top = new THREE.Box3().setFromObject(deck).max.y;
  for (const [role, rig] of h.rigs) {
    let bottom = Infinity;
    rig.root.traverseVisible((object: THREE.Object3D) => {
      if (!(object instanceof THREE.Mesh)) return;
      for (let i = 0; i < object.geometry.attributes.position.count; i += 3)
        bottom = Math.min(bottom, object.localToWorld(object.getVertexPosition(i, new THREE.Vector3())).y);
    });
    assert.ok(bottom >= top - .015, `${role}: actual skin/shoes enter the visible deck by ${top - bottom}`);
  }
});

test('Morpheus keeps his actual hand over the EMP control rather than gesturing across the cockpit', async t => {
  const h = await fixture(t); h.draw('sweep', 3.2);
  const rig = h.rigs.get('morpheus'), emp = h.scene.getObjectByName('sentinel-emp-key')!;
  const wrist = rig.hero.bones.get('wrist_R'), shoulder = rig.hero.bones.get('shoulder_R'), elbow = rig.hero.bones.get('elbow_R');
  t.diagnostic(JSON.stringify({ actualPalm: h.scene.worldToLocal(wrist.localToWorld(wrist.userData['sentinel-palm'].clone())).toArray(),
    shoulder: h.scene.worldToLocal(shoulder.getWorldPosition(new THREE.Vector3())).toArray(),
    armLength: (elbow.position.length() + wrist.position.length()) * shoulder.getWorldScale(new THREE.Vector3()).x,
    elbowBend: elbow.quaternion.toArray() }));
  const guard = emp.children.find(object => object instanceof THREE.Mesh && (object.material as THREE.Material).transparent) as THREE.Mesh;
  const index = guard.geometry.index!, p = guard.geometry.attributes.position, triangles: THREE.Triangle[] = [];
  for (let i = 0; i < index.count; i += 3) triangles.push(new THREE.Triangle(...[0, 1, 2].map(j => guard.localToWorld(new THREE.Vector3().fromBufferAttribute(p, index.getX(i + j)))) as [THREE.Vector3, THREE.Vector3, THREE.Vector3]));
  let gap = Infinity; const closest = new THREE.Vector3();
  for (const part of rig.hero.wardrobe) {
    const skin = part.mesh; if (!(skin instanceof THREE.SkinnedMesh) || !skin.visible || (skin.material as THREE.Material).name !== 'Skin') continue;
    const { skinIndex, skinWeight } = skin.geometry.attributes;
    for (let i = 0; i < skinIndex.count; i += 3) {
      if (![0, 1, 2, 3].some(j => skinWeight.getComponent(i, j) > .2 && /^(wrist|finger.*)_R$/.test(skin.skeleton.bones[skinIndex.getComponent(i, j)].name))) continue;
      const point = skin.localToWorld(skin.getVertexPosition(i, new THREE.Vector3()));
      for (const triangle of triangles) gap = Math.min(gap, triangle.closestPointToPoint(point, closest).distanceTo(point));
    }
  }
  assert.ok(gap < .05, `the captain's real hand floats ${gap} from the physical EMP guard`);
});

test('Tank’s actual index skin contacts each moving switch while turning power off, arming and restoring', async t => {
  const h = await fixture(t), rig = h.rigs.get('tank');
  for (const [phase, elapsed, side, key] of [['shutdown', .9, 'R', 'main'], ['shutdown', 1.4, 'R', 'main'], ['shutdown', 1.8, 'R', 'main'],
    ['shutdown', 2.95, 'L', 'arm'], ['shutdown', 3.35, 'L', 'arm'], ['confirming', 1, 'R', 'main'], ['confirming', 1.4, 'R', 'main']] as const) {
    h.draw(phase, elapsed);
    const contact = h.scene.getObjectByName(`sentinel-${key}-power-contact`) as THREE.Mesh;
    const point = contact.getWorldPosition(new THREE.Vector3()); let gap = Infinity, probes = 0, minimum = Infinity;
    for (const part of rig.hero.wardrobe) {
      const skin = part.mesh; if (!(skin instanceof THREE.SkinnedMesh) || !skin.visible || (skin.material as THREE.Material).name !== 'Skin') continue;
      const { skinIndex, skinWeight } = skin.geometry.attributes;
      for (let i = 0; i < skinIndex.count; i++) {
        if (![0, 1, 2, 3].some(j => skinWeight.getComponent(i, j) > .5 && skin.skeleton.bones[skinIndex.getComponent(i, j)].name === `finger2-3_${side}`)) continue;
        const distance = skin.localToWorld(skin.getVertexPosition(i, new THREE.Vector3())).distanceTo(point);
        gap = Math.min(gap, Math.abs(distance - .055)); minimum = Math.min(minimum, distance); probes++;
      }
    }
    assert.ok(probes > 30, 'measure the real fingertip skin');
    assert.ok(gap < .015, `${phase}/${elapsed}: ${side} index floats ${gap} from the moving metal`);
    assert.ok(minimum > .049, `${phase}/${elapsed}: index enters the switch cap by ${.055 - minimum}`);
  }
});

test('all crew hand skin clears the switch caps and EMP guard during approaches, contact and withdrawal', async t => {
  const h = await fixture(t), points = new Map<string, { skin: THREE.SkinnedMesh; probes: number[] }>();
  for (const role of ['tank', 'morpheus']) {
    const skin = h.rigs.get(role).hero.root.getObjectByName('Anatomical_head_and_hands') as THREE.SkinnedMesh;
    const { skinIndex, skinWeight } = skin.geometry.attributes;
    points.set(role, { skin, probes: Array.from({ length: skinIndex.count }, (_, i) => i).filter(i => i % 3 === 0 && [0, 1, 2, 3].some(j =>
      skinWeight.getComponent(i, j) > .2 && /^(wrist|finger.*)_[RL]$/.test(skin.skeleton.bones[skinIndex.getComponent(i, j)].name))) });
  }
  const guard = h.scene.getObjectByName('sentinel-emp-guard') as THREE.Mesh;
  const caps = ['main', 'arm'].map(key => h.scene.getObjectByName(`sentinel-${key}-power-contact`)!);
  for (const phase of ['shutdown', 'confirming'] as const) for (let frame = 0; frame <= SENTINEL_TIMING[phase] * 20; frame++) {
    h.draw(phase, frame / 20); const centers = caps.map(cap => cap.getWorldPosition(new THREE.Vector3()));
    for (const [role, { skin, probes }] of points) for (const i of probes) {
      const point = skin.localToWorld(skin.getVertexPosition(i, new THREE.Vector3()));
      if (role === 'tank') for (const [key, center] of centers.entries()) assert.ok(point.distanceTo(center) >= .049,
        `${phase}/${frame / 20}: vertex ${i} enters switch ${key}, distance ${point.distanceTo(center)}, bones ${[0, 1, 2, 3].map(j => skin.skeleton.bones[skin.geometry.attributes.skinIndex.getComponent(i, j)].name)}`);
      else {
        const local = guard.worldToLocal(point);
        assert.ok(Math.abs(local.x) >= .36 || Math.abs(local.z) >= .3 || Math.abs(local.y) >= .014,
          `${phase}/${frame / 20}: captain's hand vertex ${i} enters the EMP guard at ${local.toArray()}`);
      }
    }
  }
});

test('crew hand surfaces enter and leave the controls continuously without stretched bones or residue from another pose', async t => {
  const h = await fixture(t); let maximum = 0, worst = '';
  for (const role of ['tank', 'morpheus']) {
    const rig = h.rigs.get(role), skin = rig.hero.root.getObjectByName('Anatomical_head_and_hands') as THREE.SkinnedMesh;
    const { skinIndex, skinWeight } = skin.geometry.attributes;
    const probes = Array.from({ length: skinIndex.count }, (_, i) => i).filter(i => i % 5 === 0 && [0, 1, 2, 3].some(j =>
      skinWeight.getComponent(i, j) > .2 && /^(wrist|finger.*)_[RL]$/.test(skin.skeleton.bones[skinIndex.getComponent(i, j)].name)));
    assert.ok(probes.length > 100);
    for (const phase of ['shutdown', 'confirming'] as const) {
      let previous: THREE.Vector3[] | undefined;
      for (let frame = 0; frame <= SENTINEL_TIMING[phase] * 100; frame++) {
        h.draw(phase, frame / 100);
        const points = probes.map(i => skin.localToWorld(skin.getVertexPosition(i, new THREE.Vector3())));
        if (previous) points.forEach((p, i) => {
          const gap = p.distanceTo(previous![i]); if (gap > maximum) { maximum = gap; worst = `${role}/${phase}/${frame / 100}/vertex ${probes[i]}`; }
        }); previous = points;
        for (const [name, bone] of rig.hero.bones) if (name.startsWith('finger'))
          assert.ok(bone.position.distanceTo(rig.hero.rest.get(name)) < 1e-8, 'contact must preserve the original finger lengths');
      }
    }
    h.draw('shutdown', 3.35); const saved = probes.map(i => skin.localToWorld(skin.getVertexPosition(i, new THREE.Vector3())));
    h.draw('confirming', 2.7); h.draw('shutdown', 3.35);
    saved.forEach((p, i) => assert.ok(p.distanceTo(skin.localToWorld(skin.getVertexPosition(probes[i], new THREE.Vector3()))) < 1e-6,
      'a restored control pose must not depend on the previous action'));
  }
  t.diagnostic(JSON.stringify({ maximumSkinStep: maximum, worst })); assert.ok(maximum < .035, `a control action snaps the hand by ${maximum}: ${worst}`);
});

test('crew skin stays continuous when saved encounter phases change', async t => {
  const h = await fixture(t);
  for (const [from, end, to] of [['ready', 0, 'shutdown'], ['shutdown', SENTINEL_TIMING.shutdown, 'briefing'], ['briefing', 0, 'sweep'],
    ['sweep', 12, 'clear'], ['clear', 3.8, 'verify'], ['verify', 0, 'confirming'], ['confirming', 3.5, 'done']] as const) {
    h.draw(from, end);
    const samples = [...h.rigs].map(([role, rig]) => {
      const skin = rig.hero.root.getObjectByName('Anatomical_head_and_hands') as THREE.SkinnedMesh;
      const points = Array.from({ length: Math.ceil(skin.geometry.attributes.position.count / 9) }, (_, i) =>
        skin.localToWorld(skin.getVertexPosition(i * 9, new THREE.Vector3())));
      return { role, skin, points };
    });
    h.draw(to, 0);
    for (const { role, skin, points } of samples) {
      let maximum = 0;
      points.forEach((point, i) => { maximum = Math.max(maximum, point.distanceTo(skin.localToWorld(skin.getVertexPosition(i * 9, new THREE.Vector3())))); });
      assert.ok(maximum < .035, `${role}: ${from} → ${to} jumps actual skin ${maximum}`);
    }
  }
});

test('cold models reconstruct a saved switch and EMP contact without a preceding animation frame', async t => {
  const running = await fixture(t); running.draw('shutdown', .01);
  for (const [phase, elapsed] of [['shutdown', .53], ['shutdown', 1.4], ['shutdown', 3.35], ['briefing', 0],
    ['sweep', 3.2], ['confirming', 1.4], ['confirming', 3.3], ['done', 0]] as const) {
    running.draw(phase, elapsed); const cold = await fixture(t); cold.draw(phase, elapsed);
    for (const role of ['tank', 'morpheus']) {
      const skin = running.rigs.get(role).hero.root.getObjectByName('Anatomical_head_and_hands') as THREE.SkinnedMesh;
      const restored = cold.rigs.get(role).hero.root.getObjectByName('Anatomical_head_and_hands') as THREE.SkinnedMesh;
      for (let i = 0; i < skin.geometry.attributes.position.count; i += 9)
        assert.ok(skin.localToWorld(skin.getVertexPosition(i, new THREE.Vector3())).distanceTo(restored.localToWorld(restored.getVertexPosition(i, new THREE.Vector3()))) < 1e-6,
          `${role}: ${phase}/${elapsed} must reconstruct the real skin from the saved clock alone`);
    }
  }
});
