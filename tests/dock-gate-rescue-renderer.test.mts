import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from 'three';
import { APU_RIG, FILM_SETS, dockGatePoint, dockGateEye, dockGateZee, newDockGate, type DockGate, type FilmJourney } from '@auto_matrix/shared';
import { CharacterModels } from '../packages/client/src/agents/CharacterModel.js';
import { ZionHomecomingRenderer } from '../packages/client/src/engine/ZionHomecomingRenderer.js';
import { WorldState } from '../packages/server/src/world/WorldState.js';
import { AgentManager } from '../packages/server/src/agents/AgentManager.js';

function vertices(root: THREE.Object3D) {
  const points: THREE.Vector3[] = []; root.updateWorldMatrix(true, true);
  root.traverseVisible(object => {
    if (!(object instanceof THREE.Mesh)) return;
    object.updateMatrixWorld(true);
    if (object instanceof THREE.SkinnedMesh) object.skeleton.update();
    for (let instance = 0; instance < (object instanceof THREE.InstancedMesh ? object.count : 1); instance++) {
      const matrix = new THREE.Matrix4(); if (object instanceof THREE.InstancedMesh) object.getMatrixAt(instance, matrix);
      for (let i = 0; i < object.geometry.attributes.position.count; i++)
        points.push(object.localToWorld(object.getVertexPosition(i, new THREE.Vector3()).applyMatrix4(matrix)));
    }
  });
  return points;
}

test('the shot sentinel falls inside the dock instead of passing through the side barrier', () => {
  const root = new THREE.Group(), renderer = new ZionHomecomingRenderer(root, 'film_zion_hangar');
  try {
    const gate = { ...newDockGate(7.2, -50), toppled: true, phase: 'rescue' as const, elapsed: 1.55 };
    for (; gate.elapsed <= 2.8; gate.elapsed += .05) {
      renderer.update({ scene: 'm3_gate', actor: 'kid', step: 2, completed: [], dockGate: gate } as FilmJourney, 0);
      const points = vertices(root.getObjectByName('gate-attacking-sentinel')!);
      assert.ok(points.every(p => p.y >= -.035), 'the shell cannot sink into the floor');
      assert.ok(points.every(p => p.y > 2.4 || p.x < 11.7), 'the falling shell crosses the solid dock barrier');
    }
  } finally { renderer.dispose(); }
});

test('the fallen pilot remains inside his seat with both hands on the controls and the camera at his real eye', t => {
  const root = new THREE.Group(), renderer = new ZionHomecomingRenderer(root, 'film_zion_hangar');
  const center = FILM_SETS.film_zion_hangar.center; root.position.set(center.x, center.y - 1, center.z);
  t.mock.method(THREE.TextureLoader.prototype, 'load', () => new THREE.Texture());
  const previous = globalThis.document;
  globalThis.document = { createElement: () => ({ getContext: () => ({ createImageData: (w: number, h: number) => ({ data: new Uint8ClampedArray(w * h * 4) }), putImageData() {} }) }) } as unknown as Document;
  const world = new WorldState(); new AgentManager(world).initializeAllAgents(); const models = new CharacterModels();
  try {
    const kid = models.create(world.agents.get('kid')!), zee = models.create(world.agents.get('zee')!);
    const gate = { ...newDockGate(5, -50), toppled: true }, journey = { scene: 'm3_gate', actor: 'kid', step: 2, completed: [], dockGate: gate } as FilmJourney;
    const apu = root.getObjectByName('zion-kid-apu')!;
    const draw = (state: DockGate) => {
      const p = dockGatePoint(state, APU_RIG.pilot), z = dockGateZee(state);
      kid.root.position.set(center.x + p.x, center.y - 1 + p.y, center.z + p.z); kid.root.rotation.y = Math.PI;
      zee.root.position.set(center.x + z.x, center.y - 1, center.z + z.z); zee.root.rotation.y = z.yaw;
      const input = { speed: 0, grounded: true, verticalVelocity: 0, turn: 0, realWorld: true };
      models.animate(kid, 0, { ...input, seated: true, riding: true, dockGate: state }, 1);
      models.animate(zee, 0, { ...input, armed: true, dockGateCover: state }, 1);
      renderer.update(journey, 80); root.updateWorldMatrix(true, true);
    };
    for (const [phase, elapsed] of [['falling', 0], ['falling', 1.3], ['falling', 2], ['falling', 2.7], ['rescue', .8], ['braced', 0], ['aiming', 2]] as const) {
      gate.phase = phase; gate.elapsed = elapsed; draw(gate);
      const body = vertices(kid.detail), lowest = Math.min(...body.map(p => p.y - center.y + 1));
      assert.ok(lowest >= -.025, `${phase}/${elapsed}: Kid clips through the floor by ${lowest}`);
      const apuBottom = vertices(apu).reduce((lowest, p) => Math.min(lowest, p.y - center.y + 1), Infinity);
      assert.ok(apuBottom >= -.04, `${phase}/${elapsed}: the machine penetrates the floor by ${apuBottom}`);
      if (phase !== 'falling') assert.ok(apuBottom < .1, `fallen APU floats ${apuBottom}`);
      const eye = kid.head.localToWorld(new THREE.Vector3(0, -.005, .275));
      assert.ok(eye.distanceTo(new THREE.Vector3().copy(dockGateEye(gate)).add(root.position)) < 1e-5);
      for (let i = 0; i < 2; i++) {
        const palm = kid.elbows[i].localToWorld(new THREE.Vector3(0, -.79, .055));
        const handle = apu.getObjectByName(`apu-control-${i ? -1 : 1}`)!.getWorldPosition(new THREE.Vector3());
        assert.ok(palm.distanceTo(handle) < .04, `Kid releases control ${i}: ${palm.distanceTo(handle)}`);
        const sole = kid.ankles[i].localToWorld(new THREE.Vector3(0, -.155, .13));
        const pedal = apu.getObjectByName(`apu-pedal-${i ? -1 : 1}`)!;
        assert.ok(sole.distanceTo(pedal.localToWorld(new THREE.Vector3(0, .06, 0))) < .025, 'the pilot’s shoes stay on the actual pedals while the APU topples');
      }
      for (const name of ['apu-seat-pan', 'apu-seat-back', 'apu-seat-platform']) {
        const seat = apu.getObjectByName(name) as THREE.Mesh; seat.geometry.computeBoundingBox();
        const box = seat.geometry.boundingBox!.clone().expandByScalar(-.025);
        const intersecting = body.filter(p => box.containsPoint(seat.worldToLocal(p.clone())));
        assert.equal(intersecting.length, 0, `${phase}: ${name} cuts through ${intersecting.length} body vertices; lowest in its footprint ${Math.min(...body.map(p => apu.worldToLocal(p.clone())).filter(p => Math.abs(p.x) < .65 && p.z > -.4 && p.z < .49).map(p => p.y))}`);
      }
      const pose = kid.detail.matrixWorld.clone(); draw(gate);
      assert.deepEqual(kid.detail.matrixWorld, pose, 'paused body must not drift against the static APU');
    }
    gate.phase = 'rescue'; gate.elapsed = .8; draw(gate);
    const gun = zee.weapons![0], bolt = zee.gateBolt!;
    assert.equal(bolt.visible, true);
    assert.ok(gun.localToWorld(new THREE.Vector3(0, -1.315, 0)).distanceTo(bolt.localToWorld(new THREE.Vector3(0, -.5, 0))) < 1e-5);
    const muzzle = gun.localToWorld(new THREE.Vector3(0, -1.315, 0)), trajectory = bolt.localToWorld(new THREE.Vector3(0, .5, 0)).sub(muzzle);
    const blocked = new THREE.Raycaster(muzzle, trajectory.clone().normalize(), 0, trajectory.length() - 1.4).intersectObject(apu, true)[0];
    assert.ok(!blocked, `Zee must shoot past the APU instead of through ${blocked?.object.name} at ${blocked?.point.toArray()}`);
    for (let i = 0; i < 2; i++) assert.ok(zee.elbows[i].localToWorld(new THREE.Vector3(0, -.79, .055))
      .distanceTo(gun.localToWorld(i ? new THREE.Vector3(0, -.65, .1) : new THREE.Vector3(0, -.09, .13))) < .07, 'Zee supports the actual rifle with both hands');
    const saved = structuredClone(gate), cold = models.create(world.agents.get('kid')!);
    cold.root.position.copy(kid.root.position); cold.root.rotation.copy(kid.root.rotation);
    models.animate(cold, 0, { speed: 0, grounded: true, verticalVelocity: 0, turn: 0, realWorld: true, seated: true, dockGate: saved }, 1);
    assert.ok(cold.head.getWorldPosition(new THREE.Vector3()).distanceTo(kid.head.getWorldPosition(new THREE.Vector3())) < 1e-5);
    const sentinel = root.getObjectByName('gate-attacking-sentinel')!, snapshot = sentinel.matrixWorld.clone();
    renderer.update(journey, 900); root.updateWorldMatrix(true, true); assert.deepEqual(sentinel.matrixWorld, snapshot);
    gate.phase = 'braced'; draw(gate); assert.equal(zee.gateBolt!.visible, false);
  } finally { models.dispose(); renderer.dispose(); globalThis.document = previous; }
});
