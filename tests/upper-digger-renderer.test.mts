import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from 'three';
import { UPPER_DIGGER, newDiggers, newUpperDigger, upperDiggerRoot, type FilmJourney } from '@auto_matrix/shared';
import { DiggersRenderer } from '../packages/client/src/engine/DiggersRenderer.js';
import { AgentRenderer } from '../packages/client/src/agents/AgentRenderer.js';
import { CharacterModels } from '../packages/client/src/agents/CharacterModel.js';
import { WorldState } from '../packages/server/src/world/WorldState.js';
import { AgentManager } from '../packages/server/src/agents/AgentManager.js';
import type { UpperDigger } from '@auto_matrix/shared';

test('the rockets strike their interceptors and a separate Sentinel pursues the retreat', () => {
  const root = new THREE.Group(), renderer = new DiggersRenderer(root);
  const upper = { ...newUpperDigger(), phase: 'shot' as UpperDigger['phase'], climb: 44, crawl: 26, elapsed: 1.35 };
  const journey = { scene: 'm3_upper_digger', completed: [], diggers: { ...newDiggers(), phase: 'done', damage: 3 }, upperDigger: upper } as unknown as FilmJourney;
  try {
    for (let i = 0; i < 2; i++) {
      upper.elapsed = 1.35 + i * .12; renderer.update(journey); root.updateMatrixWorld(true);
      const sentinel = root.getObjectByName(`upper-digger-sentinel-${i}`)!, flash = root.getObjectByName(`upper-digger-interception-${i}`)!;
      assert.ok(sentinel.getWorldPosition(new THREE.Vector3()).distanceTo(flash.getWorldPosition(new THREE.Vector3())) < .3, 'the blast must actually touch the interceptor');
    }
    upper.elapsed = 2; renderer.update(journey);
    for (let i = 0; i < 2; i++) assert.equal(root.getObjectByName(`upper-digger-sentinel-${i}`)!.visible, false, 'destroyed interceptors cannot survive to kill Charra');
    upper.phase = 'retreat'; upper.elapsed = .5; renderer.update(journey);
    assert.equal(root.getObjectByName('upper-digger-sentinel-2')?.visible, true);
  } finally { renderer.dispose(); }
});

test('a later dock visit still renders Charra’s platform and the two drill bodies', () => {
  const root = new THREE.Group(), renderer = new DiggersRenderer(root);
  const journey = { scene: 'm3_emp', visiting: 'm3_upper_digger', completed: ['m3_diggers', 'm3_upper_digger'],
    diggers: { ...newDiggers(), phase: 'done', damage: 3 },
    upperDigger: { ...newUpperDigger(), phase: 'done', charraDead: true, crawl: 26, retreat: 26 } } as unknown as FilmJourney;
  try {
    renderer.update(journey);
    assert.equal(renderer.group.visible, true, 'the destroyed first drill must remain in the dock');
    assert.equal(root.getObjectByName('zion-upper-digger')?.visible, true, 'the dead character still needs her actual support surface');
    assert.equal(root.getObjectByName('digger-defense-duct')?.visible, false, 'do not reconstruct the old firing enclosure');
    for (let i = 0; i < 3; i++) assert.equal(root.getObjectByName(`upper-digger-sentinel-${i}`)?.visible, false);
  } finally { renderer.dispose(); }
});

test('Zee actually reaches Charra’s support belt and both shooters remain above the channel floor', t => {
  t.mock.method(THREE.TextureLoader.prototype, 'load', () => new THREE.Texture());
  const previous = globalThis.document;
  globalThis.document = { createElement: () => ({ getContext: () => ({ createImageData: (w: number, h: number) => ({ data: new Uint8ClampedArray(w * h * 4) }), putImageData() {} }) }) } as unknown as Document;
  const world = new WorldState(); new AgentManager(world).initializeAllAgents(); const models = new CharacterModels();
  const charra = models.create(world.agents.get('charra')!), zee = models.create(world.agents.get('zee')!);
  const state = { ...newUpperDigger(), phase: 'bracing' as const, climb: 44, crawl: 26, grip: .55 };
  try {
    for (const [rig, role] of [[charra, 'charra'], [zee, 'zee']] as const) {
      const root = upperDiggerRoot(state, role); rig.root.position.set(root.x, root.y, root.z); rig.root.rotation.y = root.yaw;
      const contacts = charra.diggerProps ? [-1, 1].map(side => charra.diggerProps!.belt.localToWorld(new THREE.Vector3(side * .23, 0, -.27))) : undefined;
      models.animate(rig, 0, { speed: 0, grounded: true, verticalVelocity: 0, turn: 0, realWorld: true,
        upperDigger: { ...state, role, contacts } }, 1);
      rig.root.updateWorldMatrix(true, true);
    }
    for (const [i, elbow] of zee.elbows.entries()) {
      const palm = elbow.localToWorld(new THREE.Vector3(0, -.79, .055));
      const target = charra.diggerProps!.belt.localToWorld(new THREE.Vector3((i ? 1 : -1) * .23, 0, -.27));
      assert.ok(palm.distanceTo(target) < .035, `Zee cannot support Charra with her hand ${palm.distanceTo(target)} away`);
    }
    for (const rig of [zee, charra]) {
      rig.root.updateMatrixWorld(true);
      const bounds = new THREE.Box3(); rig.detail.traverseVisible(object => {
        if (object instanceof THREE.SkinnedMesh) object.skeleton.update();
        if (object instanceof THREE.Mesh) {
          const part = new THREE.Box3().setFromObject(object, true); bounds.union(part);
          assert.ok(part.min.y >= 43.97, `${rig === zee ? 'zee' : 'charra'} ${object.type}/${object.geometry.type} parent ${object.parent?.name}: ${part.min.y}`);
        }
      });
      assert.ok(bounds.min.y >= 43.97, `body goes through the deck: ${bounds.min.y}`);
    }
    const retreat = { ...state, phase: 'attack' as const, retreat: 7, elapsed: 2.8, charraDead: true };
    for (const [rig, role] of [[charra, 'charra'], [zee, 'zee']] as const) {
      const root = upperDiggerRoot(retreat, role); rig.root.position.set(root.x, root.y, root.z); rig.root.rotation.y = root.yaw;
      models.animate(rig, 0, { speed: 0, grounded: true, verticalVelocity: 0, turn: 0, realWorld: true, upperDigger: { ...retreat, role } }, 1);
      rig.root.updateMatrixWorld(true);
    }
    const head = new THREE.Box3().setFromObject(charra.head, true);
    for (const ankle of zee.ankles) {
      const boot = new THREE.Box3().setFromObject(ankle, true);
      assert.ok(!head.intersectsBox(boot), `Charra head ${head.min.toArray()} / ${head.max.toArray()} intersects Zee boot ${boot.min.toArray()} / ${boot.max.toArray()}`);
    }
  } finally { models.dispose(); globalThis.document = previous; }
});

test('the ladder-to-channel transition is continuous and Charra clears the hatch in a low posture', t => {
  t.mock.method(THREE.TextureLoader.prototype, 'load', () => new THREE.Texture());
  const previous = globalThis.document;
  globalThis.document = { createElement: () => ({ getContext: () => ({ createImageData: (w: number, h: number) => ({ data: new Uint8ClampedArray(w * h * 4) }), putImageData() {} }) }) } as unknown as Document;
  const world = new WorldState(); new AgentManager(world).initializeAllAgents(); const models = new CharacterModels();
  try {
    for (const role of ['zee', 'charra'] as const) {
      const rig = models.create(world.agents.get(role)!);
      const state: UpperDigger = { ...newUpperDigger(), phase: 'climbing', climb: 43.99 };
      const pose = () => {
        const root = upperDiggerRoot(state, role); rig.root.position.set(root.x, root.y, root.z); rig.root.rotation.y = root.yaw;
        models.animate(rig, 0, { speed: 0, grounded: true, verticalVelocity: 0, turn: 0, realWorld: true, upperDigger: { ...state, role } }, 1);
        rig.root.updateMatrixWorld(true); return rig.head.getWorldPosition(new THREE.Vector3());
      };
      let head = pose();
      if (role === 'charra') assert.ok(head.y < 47.5, `Charra cannot stand through the pipe bracing: ${head.y}`);
      state.climb = 44; state.phase = 'mounting'; state.elapsed = 0;
      const next = pose(); assert.ok(head.distanceTo(next) < .12, `${role} snaps at the hatch: ${head.distanceTo(next)}`); head = next;
      for (let i = 1; i <= UPPER_DIGGER.mount / .05; i++) {
        state.elapsed = i * .05; const next = pose(); assert.ok(head.distanceTo(next) < .3, `${role} mounting jumps at ${state.elapsed}: ${head.distanceTo(next)}`); head = next;
      }
      state.phase = 'crawl'; state.elapsed = 0;
      assert.ok(head.distanceTo(pose()) < .12, `${role} snaps after mounting`);
      for (const phase of ['crawl', 'retreat', 'escape'] as const) {
        Object.assign(state, { phase, crawl: 16, retreat: phase === 'crawl' ? 0 : 7, elapsed: 2.5, charraDead: phase === 'escape' }); pose();
        rig.detail.traverseVisible(object => {
          if (object instanceof THREE.SkinnedMesh) object.skeleton.update();
          if (object instanceof THREE.Mesh) assert.ok(new THREE.Box3().setFromObject(object, true).min.y >= 43.97,
            `${role} ${phase} ${object.geometry.type} ${object.parent?.name} intersects floor: ${new THREE.Box3().setFromObject(object, true).min.y}`);
        });
      }
    }
  } finally { models.dispose(); globalThis.document = previous; }
});

test('cold paused loading resolves belt contact even when Zee is rendered before Charra', t => {
  t.mock.method(THREE.TextureLoader.prototype, 'load', () => new THREE.Texture());
  const previous = globalThis.document;
  const context = { createRadialGradient: () => ({ addColorStop() {} }), fillRect() {}, fillText() {}, strokeRect() {},
    createImageData: (w: number, h: number) => ({ data: new Uint8ClampedArray(w * h * 4) }), putImageData() {} };
  globalThis.document = { createElement: () => ({ getContext: () => context }) } as unknown as Document;
  const world = new WorldState(); new AgentManager(world).initializeAllAgents(); const renderer = new AgentRenderer(new THREE.Scene());
  try {
    for (const role of ['zee', 'charra'] as const) {
      const actor = world.agents.get(role)!, state = { ...newUpperDigger(), phase: 'bracing' as const, climb: 44, crawl: 26, role };
      const root = upperDiggerRoot(state, role); actor.position = { x: root.x, y: root.y, z: root.z }; actor.rotation = root.yaw;
      actor.isInMatrix = false; actor.currentAction = { type: 'idle', parameters: { upperDigger: state }, startedAt: 0, duration: 1e9, progress: 0 };
      renderer.updateAgent(role, actor);
    }
    renderer.setWorld(false); renderer.update(0, undefined, 0);
    const zee = renderer.getAgentBody('zee')!, belt = renderer.getAgentBody('charra')!.getObjectByName('charra-support-belt')!;
    const targets = [-1, 1].map(side => belt.localToWorld(new THREE.Vector3(side * .23, 0, -.27)));
    const palms: THREE.Vector3[] = [];
    zee.traverse(object => {
      if (!(object instanceof THREE.SkinnedMesh)) return;
      object.geometry.computeBoundingBox();
      if (object.geometry.boundingBox!.min.y > -1.5) palms.push(object.skeleton.bones[1].localToWorld(new THREE.Vector3(0, -.79, .055)));
    });
    assert.equal(palms.length, 2);
    for (let i = 0; i < 2; i++) assert.ok(palms[i].distanceTo(targets[i]) < .035, 'a cold saved frame must already grip the belt');
  } finally { renderer.dispose(); globalThis.document = previous; }
});

test('Zee keeps a climbing body after Charra dies instead of descending in the crawl pose', t => {
  t.mock.method(THREE.TextureLoader.prototype, 'load', () => new THREE.Texture());
  const previous = globalThis.document;
  globalThis.document = { createElement: () => ({ getContext: () => ({ createImageData: (w: number, h: number) => ({ data: new Uint8ClampedArray(w * h * 4) }), putImageData() {} }) }) } as unknown as Document;
  const world = new WorldState(); new AgentManager(world).initializeAllAgents(); const models = new CharacterModels();
  try {
    const rig = models.create(world.agents.get('zee')!);
    const state: UpperDigger = { ...newUpperDigger(), phase: 'descending', climb: 19.8176, charraDead: true };
    const root = upperDiggerRoot(state, 'zee'); rig.root.position.set(root.x, root.y, root.z); rig.root.rotation.y = root.yaw;
    models.animate(rig, 0, { speed: 0, grounded: true, verticalVelocity: 0, turn: 0, realWorld: true, upperDigger: { ...state, role: 'zee' } }, 1);
    assert.ok(rig.head.getWorldPosition(new THREE.Vector3()).y > state.climb + 3.2, 'the living climber must remain upright');
    for (const elbow of rig.elbows) assert.ok(elbow.localToWorld(new THREE.Vector3(0, -.79, .055)).x < -43.8, 'hands must be on the ladder side of the body');
  } finally { models.dispose(); globalThis.document = previous; }
});

test('ladder strokes keep three real limb contacts on rungs and preserve them on a cold saved frame', t => {
  t.mock.method(THREE.TextureLoader.prototype, 'load', () => new THREE.Texture());
  const previous = globalThis.document;
  globalThis.document = { createElement: () => ({ getContext: () => ({ createImageData: (w: number, h: number) => ({ data: new Uint8ClampedArray(w * h * 4) }), putImageData() {} }) }) } as unknown as Document;
  const world = new WorldState(); new AgentManager(world).initializeAllAgents(); const models = new CharacterModels();
  try {
    const rig = models.create(world.agents.get('zee')!);
    const pose = (climb: number, phase: 'climbing' | 'descending') => {
      const state: UpperDigger = { ...newUpperDigger(), phase, climb, charraDead: phase === 'descending' };
      const root = upperDiggerRoot(state, 'zee'); rig.root.position.set(root.x, root.y, root.z); rig.root.rotation.y = root.yaw;
      models.animate(rig, 0, { speed: 0, grounded: true, verticalVelocity: 0, turn: 0, realWorld: true, upperDigger: { ...state, role: 'zee' } }, 1);
      rig.root.updateMatrixWorld(true);
      return [...rig.elbows.map(elbow => elbow.localToWorld(new THREE.Vector3(0, -.79, .055))),
        ...rig.ankles.map(ankle => ankle.localToWorld(new THREE.Vector3(0, -.155, .13)))];
    };
    let previousPoints: THREE.Vector3[] | undefined;
    for (let sample = 0; sample <= 110; sample++) {
      const climb = 18 + sample * .02, points = pose(climb, 'climbing');
      const contacts = points.filter((point, i) => {
        const y = point.y - (i < 2 ? 0 : .065), rung = .4 + Math.round((y - .4) / .55) * .55;
        return Math.abs(y - rung) < .025 && Math.abs(point.x + 44 - (i < 2 ? .075 : 0)) < .025;
      });
      assert.ok(contacts.length >= 3, `only ${contacts.length} supported limbs at height ${climb}`);
      if (previousPoints) for (let i = 0; i < 4; i++) assert.ok(points[i].distanceTo(previousPoints[i]) < .16, 'a limb cannot snap to the next rung');
      previousPoints = points;
      const restored = pose(climb, 'descending');
      for (let i = 0; i < 4; i++) assert.ok(points[i].distanceTo(restored[i]) < 1e-6, 'a saved height must restore the same rung contacts in either direction');
    }
    const scene = new THREE.Group(), renderer = new DiggersRenderer(scene);
    scene.position.y = -1; // FilmSetRenderer places scenery one unit below actor origins.
    try {
      renderer.update({ scene: 'm3_upper_digger', completed: [], diggers: { ...newDiggers(), phase: 'done' },
        upperDigger: { ...newUpperDigger(), phase: 'descending', charraDead: true } } as unknown as FilmJourney);
      scene.updateMatrixWorld(true);
      const channel = scene.getObjectByName('upper-digger-service-channel')!;
      for (const height of [.1, 4, 12.3, 27.6, 38.9, 44]) {
        let supported = 0;
        pose(height, 'descending').forEach((point, i) => {
          const y = point.y - (i < 2 ? 0 : .065), rung = .4 + Math.round((y - .4) / .55) * .55;
          if (Math.abs(y - rung) >= .025 || Math.abs(point.x + 44 - (i < 2 ? .075 : 0)) >= .025) return;
          const origin = point.clone(), direction = new THREE.Vector3(i < 2 ? -1 : 0, i < 2 ? 0 : -1, 0);
          if (i >= 2) origin.y += .1;
          const hit = new THREE.Raycaster(origin, direction, 0, .15).intersectObject(channel, true)[0];
          assert.ok(hit, `${i < 2 ? 'palm' : 'sole'} at ${height} has no rendered rung behind it`);
          assert.ok(Math.abs(hit.point.x + 44) <= .066 && Math.abs(hit.point.y - rung) <= .066);
          supported++;
        });
        assert.ok(supported >= 3, `rendered support is missing at height ${height}`);
      }
    } finally { renderer.dispose(); }
  } finally { models.dispose(); globalThis.document = previous; }
});

test('crossing the hatch plants a hand on the actual rim, deck or rung while shifting the body', t => {
  t.mock.method(THREE.TextureLoader.prototype, 'load', () => new THREE.Texture());
  const previous = globalThis.document;
  globalThis.document = { createElement: () => ({ getContext: () => ({ createImageData: (w: number, h: number) => ({ data: new Uint8ClampedArray(w * h * 4) }), putImageData() {} }) }) } as unknown as Document;
  const world = new WorldState(); new AgentManager(world).initializeAllAgents(); const models = new CharacterModels();
  const scene = new THREE.Group(), renderer = new DiggersRenderer(scene); scene.position.y = -1;
  try {
    const rig = models.create(world.agents.get('zee')!);
    for (const phase of ['mounting', 'dismounting'] as const) for (const progress of [.45, .6, .75]) {
      const state = { ...newUpperDigger(), phase, climb: 44, elapsed: UPPER_DIGGER.mount * (phase === 'mounting' ? progress : 1 - progress), charraDead: phase === 'dismounting' };
      renderer.update({ scene: 'm3_upper_digger', completed: [], diggers: { ...newDiggers(), phase: 'done' }, upperDigger: state } as unknown as FilmJourney);
      scene.updateMatrixWorld(true);
      const root = upperDiggerRoot(state, 'zee'); rig.root.position.set(root.x, root.y, root.z); rig.root.rotation.y = root.yaw;
      models.animate(rig, 0, { speed: 0, grounded: true, verticalVelocity: 0, turn: 0, realWorld: true, upperDigger: { ...state, role: 'zee' } }, 1);
      rig.root.updateMatrixWorld(true);
      const channel = scene.getObjectByName('upper-digger-service-channel')!;
      const supported = rig.elbows.filter(elbow => {
        const palm = elbow.localToWorld(new THREE.Vector3(0, -.79, .055));
        return new THREE.Raycaster(palm, new THREE.Vector3(0, -1, 0), 0, .22).intersectObject(channel, true).length
          || new THREE.Raycaster(palm, new THREE.Vector3(-1, 0, 0), 0, .10).intersectObject(channel, true).length;
      });
      assert.ok(supported.length, `${phase} at ${progress}: both hands are floating above the hatch`);
    }
  } finally { renderer.dispose(); models.dispose(); globalThis.document = previous; }
});

test('Zee visibly looks back at Charra and returns to the escape heading on the saved attack clock', t => {
  t.mock.method(THREE.TextureLoader.prototype, 'load', () => new THREE.Texture());
  const previous = globalThis.document;
  globalThis.document = { createElement: () => ({ getContext: () => ({ createImageData: (w: number, h: number) => ({ data: new Uint8ClampedArray(w * h * 4) }), putImageData() {} }) }) } as unknown as Document;
  const world = new WorldState(); new AgentManager(world).initializeAllAgents(); const models = new CharacterModels();
  try {
    const rig = models.create(world.agents.get('zee')!);
    const state: UpperDigger = { ...newUpperDigger(), phase: 'attack', climb: 44, crawl: 26, retreat: 7, elapsed: 1.8, charraDead: true };
    const root = upperDiggerRoot(state, 'zee'); rig.root.position.set(root.x, root.y, root.z); rig.root.rotation.y = root.yaw;
    const pose = () => { models.animate(rig, 0, { speed: 0, grounded: true, verticalVelocity: 0, turn: 0, realWorld: true, upperDigger: { ...state, role: 'zee' } }, 1); rig.root.updateMatrixWorld(true); };
    pose();
    const heading = new THREE.Vector3(0, 0, 1).applyQuaternion(rig.head.getWorldQuaternion(new THREE.Quaternion()));
    assert.ok(heading.x > .25, 'Zee is still facing away from Charra during the call');
    const head = rig.head.matrixWorld.clone(); pose(); assert.deepEqual(rig.head.matrixWorld.toArray(), head.toArray(), 'a paused frame cannot accumulate a turn');
    state.elapsed = UPPER_DIGGER.attack; pose();
    const end = rig.head.matrixWorld.clone(); state.phase = 'escape'; state.elapsed = 0; pose();
    assert.deepEqual(rig.head.matrixWorld.toArray(), end.toArray(), 'the escape must start at the end of the look-back');
  } finally { models.dispose(); globalThis.document = previous; }
});

test('actual body surfaces clear the hatch deck and both pipes throughout the transfer', t => {
  t.mock.method(THREE.TextureLoader.prototype, 'load', () => new THREE.Texture());
  const previous = globalThis.document;
  globalThis.document = { createElement: () => ({ getContext: () => ({ createImageData: (w: number, h: number) => ({ data: new Uint8ClampedArray(w * h * 4) }), putImageData() {} }) }) } as unknown as Document;
  const world = new WorldState(); new AgentManager(world).initializeAllAgents(); const models = new CharacterModels();
  try {
    for (const role of ['zee', 'charra'] as const) {
      const rig = models.create(world.agents.get(role)!);
      for (const down of [false, true]) {
        if (role === 'charra' && down) continue;
        for (let sample = 0; sample <= 40; sample++) {
          const progress = sample / 40;
          const state: UpperDigger = { ...newUpperDigger(), phase: role === 'charra' ? 'climbing' : down ? 'dismounting' : 'mounting',
            climb: role === 'charra' ? 37 + progress * 7 : 44, elapsed: progress * UPPER_DIGGER.mount, charraDead: down };
          const root = upperDiggerRoot(state, role); rig.root.position.set(root.x, root.y, root.z); rig.root.rotation.y = root.yaw;
          models.animate(rig, 0, { speed: 0, grounded: true, verticalVelocity: 0, turn: 0, realWorld: true, upperDigger: { ...state, role } }, 1);
          rig.root.updateMatrixWorld(true);
          rig.detail.traverseVisible(object => {
            if (!(object instanceof THREE.Mesh) || object.parent === rig.diggerProps?.gun) return;
            if (object instanceof THREE.SkinnedMesh) object.skeleton.update();
            for (let i = 0; i < object.geometry.attributes.position.count; i++) {
              const point = object.getVertexPosition(i, new THREE.Vector3()).applyMatrix4(object.matrixWorld);
              if (point.x >= -42.4 && point.x <= -11.2 && point.z >= 26 && point.z <= 30)
                assert.ok(point.y >= 43.97, `${role} ${state.phase} ${progress} ${object.geometry.type} pierces the deck at ${point.toArray()}`);
              if (point.x > -49 && point.x < -16) for (const z of UPPER_DIGGER.pipes)
                assert.ok(Math.hypot(point.y - 46, point.z - z) >= 2.5, `${role} ${state.phase} ${progress} intersects a main pipe at ${point.toArray()}`);
            }
          });
        }
      }
    }
  } finally { models.dispose(); globalThis.document = previous; }
});

test('the fatal hit releases Charra’s launcher and support over time instead of snapping on the death flag', t => {
  t.mock.method(THREE.TextureLoader.prototype, 'load', () => new THREE.Texture());
  const previous = globalThis.document;
  globalThis.document = { createElement: () => ({ getContext: () => ({ createImageData: (w: number, h: number) => ({ data: new Uint8ClampedArray(w * h * 4) }), putImageData() {} }) }) } as unknown as Document;
  const world = new WorldState(); new AgentManager(world).initializeAllAgents(); const models = new CharacterModels();
  try {
    const rig = models.create(world.agents.get('charra')!);
    const state: UpperDigger = { ...newUpperDigger(), phase: 'attack', climb: 44, crawl: 26, retreat: 7, elapsed: 1.199 };
    const pose = () => {
      const root = upperDiggerRoot(state, 'charra'); rig.root.position.set(root.x, root.y, root.z); rig.root.rotation.y = root.yaw;
      models.animate(rig, 0, { speed: 0, grounded: true, verticalVelocity: 0, turn: 0, realWorld: true, upperDigger: { ...state, role: 'charra' } }, 1);
      rig.root.updateMatrixWorld(true);
      return [rig.head.getWorldPosition(new THREE.Vector3()), ...rig.elbows.map(elbow => elbow.localToWorld(new THREE.Vector3(0, -.79, .055))),
        ...rig.ankles.map(ankle => ankle.getWorldPosition(new THREE.Vector3()))];
    };
    const before = pose(); state.elapsed = 1.201; state.charraDead = true;
    pose().forEach((point, i) => assert.ok(point.distanceTo(before[i]) < .025, `contact ${i} snaps by ${point.distanceTo(before[i])} when Charra dies`));
  } finally { models.dispose(); globalThis.document = previous; }
});
