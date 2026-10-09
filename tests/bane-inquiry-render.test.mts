import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { BANE_INQUIRY, FILM_SETS, baneInquiryRoot, newBaneInquiry, type BaneInquiryRole, type BaneInquiryGesture } from '@auto_matrix/shared';
import { CharacterModels } from '../packages/client/src/agents/CharacterModel.js';
import { AgentRenderer } from '../packages/client/src/agents/AgentRenderer.js';
import { BaneInquiryRenderer } from '../packages/client/src/engine/BaneInquiryRenderer.js';
import { WorldState } from '../packages/server/src/world/WorldState.js';
import { AgentManager } from '../packages/server/src/agents/AgentManager.js';

function setup(t: test.TestContext, assets?: Map<string, unknown>) {
  t.mock.method(GLTFLoader.prototype, 'loadAsync', (url: string) => assets?.has(url.split('/').at(-1)!) ? Promise.resolve(assets.get(url.split('/').at(-1)!)) : new Promise(() => {}));
  t.mock.method(THREE.TextureLoader.prototype, 'load', () => new THREE.Texture());
  const old = globalThis.document;
  globalThis.document = { createElement: () => ({ getContext: () => ({ createRadialGradient: () => ({ addColorStop() {} }), fillRect() {}, strokeRect() {}, fillText() {}, beginPath() {}, closePath() {}, moveTo() {}, lineTo() {}, stroke() {}, ellipse() {}, fill() {}, createImageData: (w: number,h: number) => ({ data: new Uint8ClampedArray(w*h*4) }), putImageData() {} }) }) } as unknown as Document;
  const world = new WorldState(); new AgentManager(world).initializeAllAgents(); const models = new CharacterModels();
  const rigs = Object.fromEntries(Object.keys(BANE_INQUIRY.roots).map(role => [role, models.create(world.agents.get(role)!)]));
  const pose = (role: BaneInquiryRole, phase: BaneInquiryGesture['phase'] = 'hearing', elapsed = 13, delta = 0) => {
    const state: BaneInquiryGesture = { ...newBaneInquiry(1, 37), phase, elapsed, role, step: 1 };
    const rig = rigs[role], root = baneInquiryRoot(state, role);
    rig.root.position.set(root.x, 0, root.z); rig.root.rotation.y = root.yaw;
    models.animate(rig, delta, { speed: 0, grounded: true, verticalVelocity: 0, turn: 0, realWorld: true, baneInquiry: state }, 0); rig.root.updateMatrixWorld(true);
    return rig;
  };
  t.after(() => { models.dispose(); globalThis.document = old; }); return { rigs, pose, world };
}

test('the mess set has an open entry, matching table/seat tops and two physical examination pages', t => {
  setup(t); const parent = new THREE.Group(), renderer = new BaneInquiryRenderer(parent); parent.updateMatrixWorld(true);
  try {
    const table = new THREE.Box3().setFromObject(renderer.root.getObjectByName('interview-tabletop')!);
    assert.ok(Math.abs(table.max.y - BANE_INQUIRY.table.top) < .001);
    for (const role of Object.keys(BANE_INQUIRY.roots)) {
      const chair = renderer.root.getObjectByName(`interview-chair-${role}`)!;
      assert.ok(Math.abs(new THREE.Box3().setFromObject(chair.getObjectByName('seat-contact')!).max.y - BANE_INQUIRY.seat.top) < .001);
    }
    const doorway = new THREE.Raycaster(new THREE.Vector3(6.1, 2.8, -2), new THREE.Vector3(0, 0, -1), 0, 5).intersectObject(renderer.root, true);
    assert.equal(doorway.length, 0, 'entry must not contain an invisible or visible wall');
    const state = newBaneInquiry(3, 37); state.phase = 'reviewing'; renderer.update(state);
    assert.equal(renderer.root.getObjectByName('report-page-vdt')!.visible, true);
    state.page = 'neural'; renderer.update(state); assert.equal(renderer.root.getObjectByName('report-page-vdt')!.visible, false);
    assert.equal(renderer.root.getObjectByName('report-page-neural')!.visible, true);
    assert.equal(renderer.root.getObjectByName('bane-neural-screen'), undefined, 'the earlier medical wall panel is absent');
  } finally { renderer.dispose(); }
});

test('seated interview shoes stay on the floor, palms reach the tabletop and the saved pose is independent of frame delta', t => {
  const h = setup(t);
  for (const role of ['bane','maggie','morpheus','roland'] as const) {
    const rig = h.pose(role);
    for (const ankle of rig.ankles) {
      const min = new THREE.Box3().setFromObject(ankle).min.y;
      assert.ok(min >= -.025 && min < .08, `${role}: floating or buried sole ${min}`);
    }
    if (role === 'bane' || role === 'roland') for (const wrist of rig.mobilWrists!) {
      const point = wrist.localToWorld(new THREE.Vector3(0, -.75 - wrist.position.y, .005));
      assert.ok(point.y >= BANE_INQUIRY.table.top + .025 && point.y < BANE_INQUIRY.table.top + .23, `${role}: palm misses tabletop ${point.toArray()}`);
      assert.ok(Math.abs(point.x) < BANE_INQUIRY.table.width / 2, `${role}: hand is outside table edge`);
    }
    const joints = [rig.torso,rig.head,...rig.hips,...rig.knees,...rig.ankles,...rig.shoulders,...rig.elbows,...(rig.mobilWrists ?? [])];
    const snapshot = joints.map(j => j.matrixWorld.elements.slice()); h.pose(role, 'hearing', 13, .7);
    assert.deepEqual(joints.map(j => j.matrixWorld.elements.slice()), snapshot, `${role}: paused interview drifted`);
  }
});

test('Roland sits and rises outside the tabletop and Bane carries healed forearm marks without Matrix sunglasses', t => {
  const h = setup(t);
  for (const phase of ['seating','rising'] as const) for (const elapsed of [0,.4,1.2,2.4,2.8]) {
    const rig = h.pose('roland', phase, elapsed);
    assert.ok(rig.root.position.x > BANE_INQUIRY.table.width / 2 + .3 && rig.root.position.x <= BANE_INQUIRY.approach.x);
    assert.ok(rig.root.position.z >= BANE_INQUIRY.roots.roland.z && rig.root.position.z <= BANE_INQUIRY.approach.z);
    for (const ankle of rig.ankles) assert.ok(new THREE.Box3().setFromObject(ankle).min.y > -.025);
    const head = rig.head.getWorldPosition(new THREE.Vector3()); assert.ok(head.x > BANE_INQUIRY.table.width / 2);
  }
  const bane = h.pose('bane'); assert.ok(bane.root.getObjectByName('bane-healed-cut--1-0'));
  assert.equal(bane.root.getObjectByName('character-glasses'), undefined);
});

test('first-person questioning renders Roland arms, hides his own face, and restores both after V or leaving', t => {
  const h = setup(t), renderer = new AgentRenderer(new THREE.Scene()), actor = h.world.agents.get('roland')!;
  const gesture: BaneInquiryGesture = { ...newBaneInquiry(1, 37), phase: 'hearing', elapsed: 13, role: 'roland', step: 1 };
  actor.isInMatrix = false; actor.currentLocation = 'film_hammer_deck';
  actor.currentAction = { type: 'idle', parameters: { baneInquiry: gesture }, startedAt: 0, duration: 1e9, progress: 0 };
  renderer.updateAgent(actor.id, actor); renderer.setWorld(false); renderer.setPlayer(actor.id, true);
  renderer.setPlayerMotion({ speed: 0, grounded: true, verticalVelocity: 0, turn: 0, baneInquiry: gesture });
  try {
    renderer.update(0, undefined, 0);
    const body = renderer.getAgentBody(actor.id)!, head = body.getObjectByName('roland-head')!;
    assert.equal(body.visible, true, 'first person must retain the table hands'); assert.equal(head.visible, false);
    renderer.setPlayer(actor.id, false); renderer.update(0, undefined, 0); assert.equal(head.visible, true);
    actor.currentAction = null; renderer.setPlayer(actor.id, true);
    renderer.setPlayerMotion({ speed: 0, grounded: true, verticalVelocity: 0, turn: 0 }); renderer.update(0, undefined, 0);
    assert.equal(body.visible, false, 'normal first-person hiding resumes outside the interview'); assert.equal(head.visible, true);
  } finally { renderer.dispose(); }
});

async function deliveredGeometry(id: string) {
  const glb = await readFile(new URL(`../packages/client/public/assets/characters/${id}.glb`, import.meta.url));
  const length = glb.readUInt32LE(12), document = JSON.parse(glb.subarray(20, 20 + length).toString());
  for (const material of document.materials) { delete material.pbrMetallicRoughness?.baseColorTexture; delete material.normalTexture; }
  document.images = []; document.textures = [];
  const json = Buffer.from(JSON.stringify(document)), padded = Buffer.alloc(Math.ceil(json.length / 4) * 4, 32); json.copy(padded);
  const bin = glb.subarray(20 + length), result = Buffer.alloc(20 + padded.length + bin.length);
  result.writeUInt32LE(0x46546c67, 0); result.writeUInt32LE(2, 4); result.writeUInt32LE(result.length, 8);
  result.writeUInt32LE(padded.length, 12); result.writeUInt32LE(0x4e4f534a, 16); padded.copy(result, 20); bin.copy(result, 20 + padded.length);
  return new GLTFLoader().parseAsync(result.buffer.slice(result.byteOffset, result.byteOffset + result.byteLength), '');
}

test('interview bodies keep planted soles and clear the tabletop, chair backs, cushions and legs', async t => {
  const ids = ['roland-head','roland-body','morpheus'];
  const assets = new Map(await Promise.all(ids.map(async id => [`${id}.glb`, await deliveredGeometry(id)] as const)));
  const h = setup(t, assets); await new Promise(resolve => setImmediate(resolve));
  const renderer = new BaneInquiryRenderer(new THREE.Group()); renderer.root.updateMatrixWorld(true); t.after(() => renderer.dispose());
  for (const role of ['roland','morpheus','bane','maggie'] as const) for (const [phase, elapsed] of (role === 'roland' ? [
    ['hearing', 13], ...[0,.4,.6,1.2,1.4,1.6,2,2.2,2.4,2.8].flatMap(elapsed => [['seating', elapsed], ['rising', elapsed]]),
  ] : [['hearing', 13]]) as [BaneInquiryGesture['phase'], number][]) {
    const chair = renderer.root.getObjectByName(`interview-chair-${role}`)!;
    const back = new THREE.Box3().setFromObject(chair.children.find(child => child.position.z === -.67)!);
    const cushion = new THREE.Box3().setFromObject(chair.getObjectByName('seat-contact')!).expandByScalar(-.02);
    const legs = chair.children.filter(child => child instanceof THREE.Mesh && child.geometry instanceof THREE.CylinderGeometry);
    const rig = h.pose(role, phase, elapsed); let lowest = Infinity, tablePenetrations = 0, backPenetrations = 0, seatPenetrations = 0, legPenetrations = 0; const intersections: unknown[] = [];
    rig.root.traverseVisible(object => {
      if (!(object instanceof THREE.Mesh)) return;
      if (object instanceof THREE.SkinnedMesh) object.skeleton.update();
      for (let i=0;i<object.geometry.attributes.position.count;i++) {
        const point=object.localToWorld(object.getVertexPosition(i,new THREE.Vector3())); lowest=Math.min(lowest,point.y);
        if (back.containsPoint(point)) { backPenetrations++; if (intersections.length < 8) intersections.push({ mesh: object.name, chair: 'back', point: point.toArray() }); }
        if (cushion.containsPoint(point)) { seatPenetrations++; if (intersections.length < 8) intersections.push({ mesh: object.name, chair: 'seat', point: point.toArray() }); }
        for (const leg of legs) { const local = leg.worldToLocal(point.clone()), height = (leg as THREE.Mesh<THREE.CylinderGeometry>).geometry.parameters.height;
          if (Math.hypot(local.x, local.z) < .05 && Math.abs(local.y) < height / 2 - .01) legPenetrations++; }
        if(Math.abs(point.x)<BANE_INQUIRY.table.width/2-.02 && Math.abs(point.z-BANE_INQUIRY.table.z)<BANE_INQUIRY.table.depth/2-.02
          && point.y>BANE_INQUIRY.table.top-BANE_INQUIRY.table.thickness+.015 && point.y<BANE_INQUIRY.table.top-.015) { tablePenetrations++; if (intersections.length < 8) intersections.push({ mesh: object.name, point: point.toArray() }); }
      }
    });
    t.diagnostic(JSON.stringify({role,phase,elapsed,lowest,tablePenetrations,backPenetrations,seatPenetrations,legPenetrations,intersections,hero:Boolean(rig.hero)}));
    assert.ok(lowest>=-.04 && lowest<.1,`${role}: delivered sole floats or penetrates floor`);
    assert.equal(tablePenetrations,0,`${role}: delivered mesh intersects tabletop`);
    assert.equal(backPenetrations,0,`${role}: delivered mesh intersects chair back`);
    assert.equal(seatPenetrations,0,`${role}: delivered mesh enters the cushion beyond contact tolerance`);
    assert.equal(legPenetrations,0,`${role}: delivered mesh intersects chair legs`);
  }
});
