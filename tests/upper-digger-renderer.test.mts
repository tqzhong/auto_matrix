import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from 'three';
import { FILM_SCENE_BY_ID, UPPER_DIGGER, filmEntry, newDiggers, newDockGunnery, newUpperDigger, upperDiggerRoot, type FilmJourney, type SandboxState } from '@auto_matrix/shared';
import { DiggersRenderer } from '../packages/client/src/engine/DiggersRenderer.js';
import { FilmSetRenderer } from '../packages/client/src/engine/FilmSetRenderer.js';
import { ZionHomecomingRenderer } from '../packages/client/src/engine/ZionHomecomingRenderer.js';
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

test('the continuous dock handoffs retain their scenery and update the active props', t => {
  const world = new WorldState(); new AgentManager(world).initializeAllAgents();
  const sets = new FilmSetRenderer(new THREE.Scene());
  t.after(() => sets.dispose());
  const journey: FilmJourney = { version: 1, scene: 'm3_diggers', actor: 'charra', step: 1, completed: ['m3_diggers'],
    enteredAt: 0, checkpoint: filmEntry(FILM_SCENE_BY_ID.m3_diggers), reflections: {}, lastText: '',
    diggers: { ...newDiggers(1), phase: 'done', damage: 3 } };
  const sandbox = { neoLife: { journey } } as SandboxState;
  const enter = (id: string) => {
    const chapter = FILM_SCENE_BY_ID[id], actor = world.agents.get(chapter.actor)!;
    Object.assign(journey, { scene: id, actor: actor.id, step: id === 'm3_diggers' ? 1 : 0 });
    Object.assign(actor, { isInMatrix: false, position: filmEntry(chapter), currentLocation: chapter.set });
    sets.update(actor, sandbox, 0);
  };
  const prop = (name: string) => sets.root.getObjectByName(name)!;
  enter('m3_diggers');
  const dock = prop('zion-homecoming-set'), wreck = prop('digger-wreck'), upper = prop('zion-upper-digger'), apu = prop('zion-kid-apu');
  assert.equal(upper.visible, false);
  assert.equal(apu.visible, false);
  journey.upperDigger = newUpperDigger();
  enter('m3_upper_digger');
  assert.ok(prop(dock.name) === dock && prop(wreck.name) === wreck, 'both shots use the same dock and wreck');
  assert.equal(upper.visible, true);
  assert.equal(prop('digger-defense-duct').visible, false);
  Object.assign(journey.upperDigger, { phase: 'done', charraDead: true });
  journey.completed.push('m3_upper_digger');
  journey.dockGunnery = newDockGunnery(0);
  enter('m3_dock_battle');
  assert.ok(prop(upper.name) === upper && prop(apu.name) === apu, 'the climb and gunnery share the same physical assets');
  assert.equal(apu.visible, true);
  assert.equal(prop('zion-ammo-cart').visible, true);
  journey.completed.push('m3_dock_battle');
  enter('m3_gate');
  assert.ok(prop(dock.name) === dock && prop(apu.name) === apu, 'Kid drives the APU already in the scene');
  assert.equal(apu.visible, true);
  assert.equal(prop('zion-ammo-cart').visible, false);
  assert.equal(prop('zion-apu-gunnery').visible, false);
  sets.update(undefined, undefined, 0);
  assert.equal(dock.parent, null, 'leaving the dock releases its renderer');
});

test('the maintenance shaft backs the whole climb and attaches both rails without closing the hatch', t => {
  const root = new THREE.Group(), renderer = new DiggersRenderer(root);
  t.after(() => renderer.dispose());
  renderer.update({ scene: 'm3_upper_digger', completed: ['m3_diggers'], diggers: { ...newDiggers(1), phase: 'done', damage: 3 },
    upperDigger: newUpperDigger() } as unknown as FilmJourney);
  root.updateMatrixWorld(true);
  const shaft = root.getObjectByName('upper-digger-ladder-shaft');
  assert.ok(shaft?.visible, 'the rails need a visible shaft rather than hanging in the cavern');
  for (const y of [1.1, 11.5, 22.5, 33.5, 44.9]) {
    const origin = new THREE.Vector3(UPPER_DIGGER.rungs.x, y, UPPER_DIGGER.ladder.z);
    const backing = new THREE.Raycaster(origin, new THREE.Vector3(-1, 0, 0), 0, 5).intersectObject(shaft, true)[0];
    assert.ok(backing && backing.distance > 1.8, `the shaft must back the ladder with space for hands at ${y}`);
  }
  for (const z of [26.65, 29.35]) {
    for (const y of [6.5, 23, 39.5]) {
      const origin = new THREE.Vector3(UPPER_DIGGER.rungs.x + .2, y, z);
      const support = new THREE.Raycaster(origin, new THREE.Vector3(-1, 0, 0), 0, .3).intersectObject(shaft, true)[0];
      assert.ok(support, `the rail at ${z} must meet a mounting bracket at ${y}`);
    }
  }
  const aperture = new THREE.Vector3(UPPER_DIGGER.ladder.x, UPPER_DIGGER.height + 2, UPPER_DIGGER.ladder.z);
  assert.equal(new THREE.Raycaster(aperture, new THREE.Vector3(0, -1, 0), 0, 3).intersectObject(shaft, true).length, 0);
});

test('the upper pipe and APU work lights keep the same slots across the three dock approaches', t => {
  const root = new THREE.Group(), renderer = new ZionHomecomingRenderer(root, 'film_zion_hangar', 'm3_diggers');
  t.after(() => renderer.dispose());
  const journey = { scene: 'm3_diggers', completed: [], diggers: { ...newDiggers(1), phase: 'done', damage: 3 } } as unknown as FilmJourney;
  const lights = () => {
    const active: THREE.PointLight[] = [];
    root.traverseVisible(object => { if (object instanceof THREE.PointLight) active.push(object); });
    return active;
  };
  renderer.update(journey, 0);
  const first = lights();
  const loader = first.find(light => light.name === 'apu-loader-work-light');
  const pipe = first.find(light => light.name === 'upper-digger-work-light');
  assert.ok(loader && pipe, 'both fixtures reserve their slots before the handoff');
  assert.equal(loader.intensity, 0);
  assert.equal(pipe.intensity, 0);
  journey.scene = 'm3_upper_digger'; journey.upperDigger = newUpperDigger();
  renderer.update(journey, 0);
  assert.ok(lights().length === first.length && lights().every(light => first.includes(light)));
  assert.equal(loader.intensity, 0);
  assert.equal(pipe.intensity, 550);
  journey.scene = 'm3_dock_battle'; journey.dockGunnery = newDockGunnery(0);
  renderer.update(journey, 0);
  assert.ok(lights().length === first.length && lights().every(light => first.includes(light)));
  assert.equal(loader.intensity, 24);
  assert.equal(pipe.intensity, 550);
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
      const actor = world.agents.get(role)!, state = { ...newUpperDigger(), phase: 'bracing' as const, climb: 44, crawl: 26, grip: .55, role };
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

test('belt support starts with an explicit reach and releases continuously before turning to retreat', t => {
  t.mock.method(THREE.TextureLoader.prototype, 'load', () => new THREE.Texture());
  const previous = globalThis.document;
  globalThis.document = { createElement: () => ({ getContext: () => ({ createImageData: (w: number, h: number) => ({ data: new Uint8ClampedArray(w * h * 4) }), putImageData() {} }) }) } as unknown as Document;
  const world = new WorldState(); new AgentManager(world).initializeAllAgents(); const models = new CharacterModels();
  const rigs = { charra: models.create(world.agents.get('charra')!), zee: models.create(world.agents.get('zee')!) };
  const state: UpperDigger = { ...newUpperDigger(), phase: 'ready', climb: 44, crawl: 26 };
  const pose = () => {
    for (const role of ['charra', 'zee'] as const) {
      const rig = rigs[role], root = upperDiggerRoot(state, role); rig.root.position.set(root.x, root.y, root.z); rig.root.rotation.y = root.yaw;
      const contacts = rigs.charra.diggerProps ? [-1, 1].map(side => rigs.charra.diggerProps!.belt.localToWorld(new THREE.Vector3(side * .23, 0, -.27))) : undefined;
      models.animate(rig, 0, { speed: 0, grounded: true, verticalVelocity: 0, turn: 0, realWorld: true, upperDigger: { ...state, role, contacts } }, 1);
      rig.root.updateMatrixWorld(true);
    }
    return Object.values(rigs).flatMap(rig => [rig.head.getWorldPosition(new THREE.Vector3()),
      ...rig.elbows.map(elbow => elbow.localToWorld(new THREE.Vector3(0, -.79, .055))),
      ...rig.ankles.map(ankle => ankle.getWorldPosition(new THREE.Vector3()))]);
  };
  try {
    state.phase = 'crawl'; state.crawl = 25.999; const arriving = pose();
    state.phase = 'ready'; state.crawl = 26;
    pose().forEach((point, i) => assert.ok(point.distanceTo(arriving[i]) < .025, 'reaching the edge teleports a limb into the waiting pose'));
    pose();
    for (const elbow of rigs.zee.elbows) assert.ok(elbow.localToWorld(new THREE.Vector3(0, -.79, .055)).y < 44.35,
      'Zee is already holding the belt before the player agrees to support Charra');
    assert.ok(rigs.charra.diggerProps!.gun.position.y < 1, 'Charra aims before her partner has reached the belt');
    let before = pose(); state.phase = 'bracing';
    pose().forEach((point, i) => assert.ok(point.distanceTo(before[i]) < .001, 'pressing G teleports a limb instead of starting the reach'));
    for (let sample = 1; sample <= 100; sample++) {
      state.grip = sample / 100; const points = pose();
      points.forEach((point, i) => assert.ok(point.distanceTo(before[i]) < .15, `support ${state.grip}, limb ${i} jumps by ${point.distanceTo(before[i])}`)); before = points;
      if (state.grip >= .42) rigs.zee.elbows.forEach((elbow, i) => {
        const target = rigs.charra.diggerProps!.belt.localToWorld(new THREE.Vector3((i ? 1 : -1) * .23, 0, -.27));
        assert.ok(elbow.localToWorld(new THREE.Vector3(0, -.79, .055)).distanceTo(target) < .035, 'Charra leans out before both hands provide support');
      });
    }
    state.phase = 'shot'; state.elapsed = 0;
    pose().forEach((point, i) => assert.ok(point.distanceTo(before[i]) < .001, 'firing changes the supported posture'));
    for (let elapsed = .025; elapsed <= UPPER_DIGGER.shot; elapsed += .025) {
      state.elapsed = elapsed; const points = pose();
      points.forEach((point, i) => assert.ok(point.distanceTo(before[i]) < .25, `release ${elapsed}, limb ${i} jumps by ${point.distanceTo(before[i])}`)); before = points;
    }
    state.elapsed = UPPER_DIGGER.shot; before = pose(); state.phase = 'retreat'; state.elapsed = 0;
    pose().forEach((point, i) => assert.ok(point.distanceTo(before[i]) < .001, 'retreat snaps out of the supported pose before Zee releases the belt'));
  } finally { models.dispose(); globalThis.document = previous; }
});
