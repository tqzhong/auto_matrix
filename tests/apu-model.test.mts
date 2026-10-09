import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from 'three';
import { APU_RIG, dockGunneryView, newApuRun, newDockGunnery, newDockLastStand, stepApuRun, type FilmJourney } from '@auto_matrix/shared';
import { ZionHomecomingRenderer } from '../packages/client/src/engine/ZionHomecomingRenderer.js';
import { CharacterModels } from '../packages/client/src/agents/CharacterModel.js';
import { WorldState } from '../packages/server/src/world/WorldState.js';
import { AgentManager } from '../packages/server/src/agents/AgentManager.js';

test('the APU clears the fallen captain before steering, including a stop and reload during departure', t => {
  t.mock.method(THREE.TextureLoader.prototype, 'load', () => new THREE.Texture());
  const previous = globalThis.document;
  globalThis.document = { createElement: () => ({ getContext: () => ({ createImageData: (w: number, h: number) => ({ data: new Uint8ClampedArray(w * h * 4) }),
    putImageData() {}, fillRect() {}, fillText() {}, strokeRect() {} }) }) } as unknown as Document;
  const world = new WorldState(); new AgentManager(world).initializeAllAgents(); const models = new CharacterModels();
  const root = new THREE.Group(), renderer = new ZionHomecomingRenderer(root, 'film_zion_hangar');
  try {
    const captain = models.create(world.agents.get('mifune')!); captain.root.position.set(0, 0, 9);
    models.animate(captain, 0, { speed: 0, grounded: true, verticalVelocity: 0, turn: 0, realWorld: true,
      dockLastStand: { ...newDockLastStand(), phase: 'done', role: 'mifune' } }, 1);
    captain.root.updateWorldMatrix(true, true);
    const body: THREE.Vector3[] = [];
    captain.detail.traverseVisible(object => {
      if (!(object instanceof THREE.Mesh)) return;
      if (object instanceof THREE.SkinnedMesh) object.skeleton.update();
      for (let i = 0; i < object.geometry.attributes.position.count; i++) body.push(object.localToWorld(object.getVertexPosition(i, new THREE.Vector3())));
    });
    const feet = [-1, 1].map(side => root.getObjectByName(`apu-ankle-${side}`)!);
    for (const steering of [-1, 0, 1]) for (const stop of [false, true]) {
      const journey = { scene: 'm3_gate', actor: 'kid', step: 1, completed: [], apu: { ...newApuRun(), dives: 15 } } as FilmJourney;
      for (let frame = 0; frame < 110; frame++) {
        const braking = stop && frame >= 25 && frame < 43;
        journey.apu = stepApuRun(journey.apu!, { throttle: braking ? 0 : 1, steer: steering, brake: braking }, .05);
        if (frame === 35) journey.apu = structuredClone(journey.apu);
        renderer.update(journey, frame * .05); root.updateWorldMatrix(true, true);
        feet.forEach((foot, side) => {
          const box = new THREE.Box3().setFromObject(foot);
          const contact = body.find(point => box.containsPoint(point));
          assert.ok(!contact, `departure ${steering}/${stop} frame ${frame}, foot ${side} enters Mifune at ${contact?.toArray()}`);
        });
      }
      if (steering) assert.ok(Math.sign(journey.apu!.x) === steering && Math.abs(journey.apu!.x) > 1, 'lateral control must return after both feet pass the captain');
    }
  } finally { renderer.dispose(); models.dispose(); globalThis.document = previous; }
});

for (const steering of [.6, 1, -1]) test(`the moving APU alternates planted feet through steering, braking and reload (${steering})`, t => {
  const root = new THREE.Group(), renderer = new ZionHomecomingRenderer(root, 'film_zion_hangar');
  t.after(() => renderer.dispose());
  const journey = { scene: 'm3_gate', actor: 'kid', step: 1, completed: [], apu: { ...newApuRun(), dives: 15 } } as FilmJourney;
  const apu = root.getObjectByName('zion-kid-apu')!;
  const feet = [-1, 1].map(side => apu.getObjectByName(`apu-foot-${side}`)!);
  const positions = () => feet.map(foot => foot.getWorldPosition(new THREE.Vector3()));
  renderer.update(journey, 0); root.updateWorldMatrix(true, true);
  let previous = positions(); const lifts = [0, 0]; let planted = 0;
  for (let frame = 0; frame < 130; frame++) {
    journey.apu = stepApuRun(journey.apu!, { throttle: frame < 95 ? 1 : 0, brake: frame >= 95,
      steer: frame < 35 ? steering : frame < 65 ? -steering : 0 }, .05);
    renderer.update(journey, frame * .05); root.updateWorldMatrix(true, true);
    const current = positions();
    assert.ok(current.some(foot => Math.abs(foot.y - APU_RIG.floor) < 1e-6), 'a heavy APU must keep a supporting foot on the floor');
    current.forEach((foot, index) => {
      const side = index ? 1 : -1, shin = apu.getObjectByName(`apu-knee-${side}`)!;
      const ankle = apu.getObjectByName(`apu-ankle-${side}`)!;
      const shinEnd = shin.localToWorld(new THREE.Vector3(side * (APU_RIG.footX - 1.85), .85 - 2.9, .32 + .22));
      assert.ok(shinEnd.distanceTo(ankle.localToWorld(new THREE.Vector3(0, .85, .32))) < 1e-6, `leg ${index} separates from its ankle at frame ${frame}`);
      assert.ok(foot.y >= APU_RIG.floor - 1e-6, 'the sole cannot sink into the dock');
      if (foot.y > APU_RIG.floor + .2) lifts[index]++;
      if (Math.abs(foot.y - APU_RIG.floor) < 1e-6 && Math.abs(previous[index].y - APU_RIG.floor) < 1e-6) {
        assert.ok(foot.distanceTo(previous[index]) < 1e-6, `supporting foot ${index} slides at frame ${frame}`); planted++;
      }
    });
    if (frame === 52) {
      const saved = structuredClone(journey), pose = current.map(foot => foot.toArray());
      renderer.update(saved, 900); root.updateWorldMatrix(true, true);
      assert.deepEqual(positions().map(foot => foot.toArray()), pose, 'paused animation must not use wall time');
      const coldRoot = new THREE.Group(), cold = new ZionHomecomingRenderer(coldRoot, 'film_zion_hangar');
      cold.update(saved, 0); coldRoot.updateWorldMatrix(true, true);
      assert.deepEqual([-1, 1].map(side => coldRoot.getObjectByName(`apu-foot-${side}`)!.getWorldPosition(new THREE.Vector3()).toArray()), pose,
        'a fresh renderer must restore the same step'); cold.dispose();
    }
    previous = current;
  }
  assert.ok(lifts.every(count => count > 10) && planted > 100, 'both legs must take turns carrying the machine');
  assert.ok(previous.every(foot => Math.abs(foot.y - APU_RIG.floor) < 1e-6), 'braking must finish the step');
});

test('the standing APU rests on the dock and leaves the pilot’s aiming ray clear throughout the firing arc', t => {
  const root = new THREE.Group(), renderer = new ZionHomecomingRenderer(root, 'film_zion_hangar');
  t.after(() => renderer.dispose());
  const encounter = newDockGunnery(0); encounter.phase = 'firing'; encounter.firstPerson = true;
  const journey = { scene: 'm3_dock_battle', actor: 'mifune', step: 0, completed: [], dockGunnery: encounter } as FilmJourney;
  const apu = root.getObjectByName('zion-kid-apu')!;
  renderer.update(journey, 0); root.updateWorldMatrix(true, true);
  let bottom = Infinity;
  apu.traverseVisible(object => {
    if (!(object instanceof THREE.Mesh)) return;
    const vertices = object.geometry.attributes.position;
    for (let instance = 0; instance < (object instanceof THREE.InstancedMesh ? object.count : 1); instance++) {
      const matrix = new THREE.Matrix4(); if (object instanceof THREE.InstancedMesh) object.getMatrixAt(instance, matrix);
      for (let i = 0; i < vertices.count; i++) bottom = Math.min(bottom, object.localToWorld(new THREE.Vector3().fromBufferAttribute(vertices, i).applyMatrix4(matrix)).y);
    }
  });
  assert.ok(bottom >= -.025 && bottom <= .06, `standing machine floats or penetrates the dock: ${bottom}`);
  for (const turn of [-1.05, -.7, -.35, 0, .35, .7, 1.05]) for (const pitch of [-.85, -.5, -.16, 0, .4]) {
    encounter.yaw = Math.PI + turn; encounter.pitch = pitch;
    renderer.update(journey, 0); root.updateWorldMatrix(true, true);
    const view = dockGunneryView(encounter.yaw, pitch);
    const hit = new THREE.Raycaster(new THREE.Vector3().copy(view.eye), new THREE.Vector3().copy(view.direction), .05, 20)
      .intersectObject(apu, true).find(hit => hit.object.visible && !hit.object.name.startsWith('apu-muzzle-'));
    assert.ok(!hit, `pilot’s sight is blocked at yaw ${turn}, pitch ${pitch} by ${hit?.object.name} at ${hit?.point.toArray()}`);
  }
});

test('Kid driving and Mifune’s last burst retain the same physical hand and pedal contacts as the cannon seat', t => {
  const root = new THREE.Group(), renderer = new ZionHomecomingRenderer(root, 'film_zion_hangar');
  t.mock.method(THREE.TextureLoader.prototype, 'load', () => new THREE.Texture());
  const previous = globalThis.document;
  globalThis.document = { createElement: () => ({ getContext: () => ({ createImageData: (w: number, h: number) => ({ data: new Uint8ClampedArray(w * h * 4) }), putImageData() {} }) }) } as unknown as Document;
  const world = new WorldState(); new AgentManager(world).initializeAllAgents(); const models = new CharacterModels();
  try {
    renderer.update({ scene: 'm3_dock_battle', actor: 'mifune', step: 0, completed: [] } as FilmJourney, 0); root.updateWorldMatrix(true, true);
    const apu = root.getObjectByName('zion-kid-apu')!;
    for (const id of ['kid', 'mifune']) {
      const rig = models.create(world.agents.get(id)!); rig.root.position.set(0, APU_RIG.floor + APU_RIG.pilot.y, 12); rig.root.rotation.y = Math.PI;
      for (const elapsed of [0, 1.1]) {
        models.animate(rig, 0, { speed: 0, grounded: true, verticalVelocity: 0, turn: 0, realWorld: true, seated: true, riding: true,
          apuDriving: id === 'kid', dockLastStand: id === 'mifune' ? { ...newDockLastStand(), phase: 'attack', elapsed, total: elapsed, role: 'mifune' } : undefined }, 1);
        rig.root.updateWorldMatrix(true, true);
        for (let i = 0; i < 2; i++) {
          const hand = rig.elbows[i].localToWorld(new THREE.Vector3(0, -.79, .055)), sole = rig.ankles[i].localToWorld(new THREE.Vector3(0, -.155, .13));
          const handle = apu.getObjectByName(`apu-control-${i ? -1 : 1}`)!, pedal = apu.getObjectByName(`apu-pedal-${i ? -1 : 1}`)!;
          assert.ok(hand.distanceTo(handle.getWorldPosition(new THREE.Vector3())) < .04, `${id} lets go of the handle`);
          assert.ok(sole.distanceTo(pedal.localToWorld(new THREE.Vector3(0, .06, 0))) < .025, `${id} loses pedal contact`);
        }
      }
    }
  } finally { renderer.dispose(); models.dispose(); globalThis.document = previous; }
});
