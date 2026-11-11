import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from 'three';
import { FILM_SCENE_BY_ID, FILM_SETS, OPENING_HOTEL, filmEntry, filmPosition, openingHotelClimbPose, type FilmJourney, type SandboxState } from '@auto_matrix/shared';
import { FilmSetRenderer } from '../packages/client/src/engine/FilmSetRenderer.js';
import { LightCulling } from '../packages/client/src/engine/LightCulling.js';
import { GunfireEffects } from '../packages/client/src/engine/GunfireEffects.js';
import type { GameAudio } from '../packages/client/src/engine/GameAudio.js';
import { AgentManager } from '../packages/server/src/agents/AgentManager.js';
import { WorldState } from '../packages/server/src/world/WorldState.js';

function setup(t: test.TestContext) {
  const previous = globalThis.document;
  const ctx = { fillRect() {}, strokeRect() {}, fillText() {}, createRadialGradient: () => ({ addColorStop() {} }) };
  globalThis.document = { createElement: () => ({ getContext: () => ctx }) } as unknown as Document;
  t.mock.method(THREE.TextureLoader.prototype, 'load', () => new THREE.Texture({ width: 1, height: 1, complete: true }));
  const scene = new THREE.Scene(), camera = new THREE.PerspectiveCamera(57, 16 / 9, .5, 5000);
  const sets = new FilmSetRenderer(scene), culling = new LightCulling(scene);
  const gunfire = new GunfireEffects(scene, { effects: () => undefined } as unknown as GameAudio);
  t.after(() => { gunfire.dispose(); culling.dispose(); sets.dispose(); globalThis.document = previous; });
  const world = new WorldState(); new AgentManager(world).initializeAllAgents(); const actor = world.agents.get('trinity')!;
  actor.currentLocation = 'film_heart_hotel'; actor.isInMatrix = true;
  const journey: FilmJourney = { version: 1, scene: 'm1_room303', actor: 'trinity', step: 0, completed: [], enteredAt: 0,
    reflections: {}, lastText: '', checkpoint: filmEntry(FILM_SCENE_BY_ID.m1_room303), openingHotel: { phase: 'trace', elapsed: 0, lastTick: 0, attempts: 0, disarmed: false, ammo: 0, shots: 0 } };
  const sandbox = { neoLife: { journey } } as SandboxState;
  const graphics = {} as THREE.WebGLRenderer;
  const pose = (phase: NonNullable<FilmJourney['openingHotel']>['phase'], elapsed = 0, first = false, yaw = 0) => {
    Object.assign(journey.openingHotel!, { phase, elapsed });
    journey.step = phase === 'trace' || phase === 'breach' ? 0 : phase === 'combat' ? 1 : phase === 'phone' ? 2 : ['ladder_ready','climbing','done'].includes(phase) ? 5 : 4;
    actor.position = ['corridor','dive','ladder_ready','climbing','done'].includes(phase)
      ? filmPosition('film_heart_hotel',0,-20) : filmEntry(FILM_SCENE_BY_ID.m1_room303);
    camera.position.set(actor.position.x,actor.position.y+3,actor.position.z);
    camera.lookAt(actor.position.x+Math.sin(yaw)*20,actor.position.y+2,actor.position.z+Math.cos(yaw)*20);
    camera.updateMatrixWorld(true);
    sets.update(actor,sandbox,0,actor.position,camera.position,undefined,first,12000,camera);
    culling.stablePointSlots=sets.stablePointSlots;culling.minimumPointSlots=sets.minimumPointSlots;
    scene.updateMatrixWorld(true);
  };
  const sample = () => {
    scene.updateMatrixWorld(true); camera.updateMatrixWorld(true);
    const original: { light: THREE.PointLight; intensity: number; visible: boolean; position: THREE.Vector3 }[] = [];
    scene.traverseVisible(object => { if (object instanceof THREE.PointLight) original.push({ light: object, intensity: object.intensity, visible: object.visible, position: object.getWorldPosition(new THREE.Vector3()) }); });
    scene.onBeforeRender(graphics, scene, camera, null);
    let count = 0;
    try {
      scene.traverseVisible(object => { if (object instanceof THREE.PointLight) count++; });
      for (const x of [-.7, 0, .7]) for (const y of [-.7, 0, .7]) for (const z of [.5, .9, .98, .995]) {
        const point = new THREE.Vector3(x, y, z).unproject(camera);
        for (const item of original) if (item.visible && item.intensity > 0 && point.distanceTo(item.position) < item.light.distance) {
          assert.equal(item.light.visible, true, 'a potentially contributing fixture or muzzle flash cannot disappear');
          assert.equal(item.light.intensity, item.intensity, 'fixed slots cannot dim a contributing light');
        }
      }
    } finally { scene.onAfterRender(graphics, scene, camera); }
    for (const item of original) {
      assert.equal(item.light.intensity, item.intensity); assert.equal(item.light.visible, item.visible);
      assert.ok(item.light.getWorldPosition(new THREE.Vector3()).equals(item.position));
    }
    return count;
  };
  const shot = () => {
    const from = { ...actor.position, y: actor.position.y + 2.4 };
    gunfire.shot({ source: 'trinity', target: 'hotel-wall', position: { ...from, y: from.y + 8 },
      direction: { x: 0, y: 1, z: 0 }, damage: 0, combo: 0, matrix: true, downed: false, shot: { from, surface: 'body' } });
  };
  return { sets, culling, camera, gunfire, journey, pose, sample, shot };
}

test('303 keeps its lighting layout across the room, corridor, camera and saved phases', t => {
  const h=setup(t);
  for(const phase of ['trace','breach','combat','phone','corridor','dive','ladder_ready','climbing','done'] as const)
    for(const first of [false,true]) for(const yaw of [0,Math.PI/2,Math.PI,-Math.PI/2]) {
      h.pose(phase,.5,first,yaw);assert.equal(h.sample(),13,`${phase}/${first}/${yaw}: room and objective changes must keep the prepared shader layout`);
    }
});

test('303 prepares the real flashlight material while the corridor is still hidden', t => {
  const h = setup(t); h.pose('trace');
  const beam = h.sets.root.getObjectByName('hotel-303-hall-flashlight');
  assert.ok(beam instanceof THREE.Mesh);
  const parent = beam.parent, material = beam.material, compiled: THREE.Object3D[] = [];
  let target: THREE.WebGLRenderTarget | null = null;
  const gpu = { properties: {}, info: { programs: [] }, extensions: { has: () => true }, getRenderTarget: () => target,
    setRenderTarget: (next: typeof target) => { target = next; },
    compile: (subject: THREE.Object3D) => subject.traverse(object => compiled.push(object)),
  } as unknown as THREE.WebGLRenderer;

  h.sets.prepareOpeningHotelPolice(gpu, h.camera, h.culling);
  assert.equal(compiled.length, 0);
  for (let frame = 0; frame < 3; frame++) h.sets.prepareOpeningHotelPolice(gpu, h.camera, h.culling, undefined, true);
  assert.equal(compiled.length, 1, 'prepare the flashlight once before the corridor appears');
  assert.ok(compiled[0] === beam && beam.parent === parent && beam.material === material);
  assert.equal(beam.visible, false);
  assert.equal(target, null);
});

test('303 makes offstage officer skins available for normal preparation before the hall appears', t => {
  const h = setup(t); h.pose('trace');
  const officer = new THREE.Group(); officer.visible = false;
  const skin = new THREE.SkinnedMesh(new THREE.BoxGeometry(), new THREE.MeshStandardMaterial());
  officer.add(skin);
  t.after(() => { skin.geometry.dispose(); skin.material.dispose(); });
  const gpu = { properties: {}, info: { programs: [] }, extensions: { has: () => true }, getRenderTarget: () => null,
    setRenderTarget() {}, compile() {},
  } as unknown as THREE.WebGLRenderer;

  h.sets.prepareOpeningHotelPolice(gpu, h.camera, h.culling, [officer], true);
  const normals = h.sets.openingHotelHallNormalMeshes;
  assert.ok(normals?.length === 1 && normals[0] === skin, 'prepare the actual offstage skin for the normal pass');
  h.sets.prepareOpeningHotelPolice(gpu, h.camera, h.culling, [officer], true);
  assert.ok(h.sets.openingHotelHallNormalMeshes === normals);
  assert.equal(officer.visible, false);
  h.sets.update(undefined, undefined, 0);
  assert.equal(h.sets.openingHotelHallNormalMeshes, undefined);
});

test('the 303 exterior fixture clears the performer throughout the ladder route', t => {
  const h = setup(t), set = FILM_SETS.film_heart_hotel;
  h.pose('climbing');
  const fixtures: THREE.PointLight[] = [];
  h.sets.root.traverse(object => {
    if (object instanceof THREE.PointLight && object.getWorldPosition(new THREE.Vector3()).z < set.center.z - set.depth / 2) fixtures.push(object);
  });
  assert.equal(fixtures.length, 2);
  for (const fixture of fixtures) for (const climbed of [0, 3.55, 5.8, 6.3, OPENING_HOTEL.ladderHeight]) {
    const point = fixture.getWorldPosition(new THREE.Vector3());
    const pose = openingHotelClimbPose(climbed), y = set.center.y + pose.y;
    const body = new THREE.Vector3(set.center.x, THREE.MathUtils.clamp(point.y, y - 1, y + 3.9), set.center.z + pose.z);
    assert.ok(point.distanceTo(body) >= 3.3, `${climbed}: the bare light is inside the performer's path`);
  }
});

test('303 reserves the player and four real police muzzle flashes without losing their light', t => {
  const h=setup(t);h.pose('combat');assert.equal(h.sample(),13);
  for(let i=0;i<5;i++){h.shot();assert.equal(h.sample(),13,'a normal overlapping shot must not compile another room layout');}
  for(const delta of [.035,.035,.02,.03]){h.gunfire.update(delta);assert.equal(h.sample(),13);}
  assert.equal(h.journey.openingHotel!.elapsed,0,'lighting cannot advance the encounter');
});

test('an additional real flash keeps its energy, and leaving 303 releases the reservation', t => {
  const h=setup(t);h.pose('combat');for(let i=0;i<6;i++)h.shot();
  assert.equal(h.sample(),14,'unexpected extra light must remain visible');h.gunfire.update(.12);assert.equal(h.sample(),13);
  h.sets.update(undefined,undefined,0);assert.equal(h.sets.minimumPointSlots,0);assert.equal(h.sets.stablePointSlots,false);
});
