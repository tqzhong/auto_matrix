import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from 'three';
import { FILM_SCENE_BY_ID, FILM_SETS, OPENING_HOTEL, filmEntry, filmPosition, openingHotelClimbPose, type FilmJourney, type SandboxState } from '@auto_matrix/shared';
import { FilmSetRenderer } from '../packages/client/src/engine/FilmSetRenderer.js';
import { LightCulling } from '../packages/client/src/engine/LightCulling.js';
import { GunfireEffects } from '../packages/client/src/engine/GunfireEffects.js';
import { CombatEffects } from '../packages/client/src/engine/CombatEffects.js';
import type { GameAudio } from '../packages/client/src/engine/GameAudio.js';
import { AgentManager } from '../packages/server/src/agents/AgentManager.js';
import { WorldState } from '../packages/server/src/world/WorldState.js';

function setup(t: test.TestContext, loadTexture: typeof THREE.TextureLoader.prototype.load =
  () => new THREE.Texture({ width: 1, height: 1, complete: true })) {
  const previous = globalThis.document;
  const ctx = { fillRect() {}, strokeRect() {}, fillText() {}, createRadialGradient: () => ({ addColorStop() {} }) };
  globalThis.document = { createElement: () => ({ getContext: () => ctx }) } as unknown as Document;
  t.mock.method(THREE.TextureLoader.prototype, 'load', loadTexture);
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
  return { scene, sets, culling, camera, gunfire, journey, pose, sample, shot };
}

test('303 keeps its lighting layout across the room, corridor, camera and saved phases', t => {
  const h=setup(t);
  for(const phase of ['trace','breach','combat','phone','corridor','dive','ladder_ready','climbing','done'] as const)
    for(const first of [false,true]) for(const yaw of [0,Math.PI/2,Math.PI,-Math.PI/2]) {
      h.pose(phase,.5,first,yaw);assert.equal(h.sample(),13,`${phase}/${first}/${yaw}: room and objective changes must keep the prepared shader layout`);
    }
});

test('303 corridor doors face across the hall and sit against the side walls', t => {
  const h = setup(t), root = h.sets.root;
  h.pose('corridor');
  const entrance = root.getObjectByName('hotel-303-door')?.children[0];
  assert.ok(entrance instanceof THREE.Mesh);
  const halfWidth = FILM_SETS.film_heart_hotel.width / 2;
  for (const z of [-20, -12, -4]) for (const side of [-1, 1]) {
    const origin = root.localToWorld(new THREE.Vector3(0, 4, z));
    const ray = new THREE.Raycaster(origin, new THREE.Vector3(side, 0, 0));
    const hit = ray.intersectObject(root)[0];
    assert.ok(hit?.object instanceof THREE.Mesh);
    assert.equal(hit.object.material, entrance.material, 'the first surface at each opening is the door leaf');
    assert.ok(hit.distance > halfWidth - .85 && hit.distance < halfWidth - .35, `door at ${side}/${z} must sit against the side wall, hit ${hit.distance}`);
    assert.ok(Math.abs(hit.normal?.x ?? 0) > .99, 'the door must face the center of the hall');
  }
});

test('303 brings the flashlight onto the plaque and restores the playable hall lighting after the cut', t => {
  const h = setup(t);
  const hotel = h.journey.openingHotel!;
  h.pose('trace');
  const { root } = h.sets;
  const beam = root.getObjectByName('hotel-303-hall-flashlight') as THREE.Mesh<THREE.BufferGeometry, THREE.MeshBasicMaterial>;
  const plaque = root.getObjectByName('hotel-303-hall-number')!;
  const roomLights = root.children.filter((light): light is THREE.PointLight => light instanceof THREE.PointLight);
  const hallLight = roomLights.find(light => light.position.equals(new THREE.Vector3(0, 9, -12)))!;
  const corridorLight = { position: hallLight.position.clone(), intensity: hallLight.intensity, distance: hallLight.distance, color: hallLight.color.getHex() };
  hotel.traceHall = true;
  hotel.traceElapsed = OPENING_HOTEL.trace.room + 1.1;
  h.pose('trace');
  assert.ok(beam.visible && beam.material.opacity > 0);
  const approachOpacity = beam.material.opacity;
  hotel.traceElapsed = OPENING_HOTEL.trace.room + 2.96;
  h.pose('trace');
  const number = root.worldToLocal(plaque.getWorldPosition(new THREE.Vector3()));
  const axis = new THREE.Vector3(0, 1, 0).applyQuaternion(beam.quaternion);
  const farEnd = beam.position.clone().addScaledVector(axis, beam.scale.y / 2);
  assert.ok(Math.hypot(farEnd.x - number.x, farEnd.y - number.y) < .04);
  assert.ok(farEnd.z < number.z && number.z - farEnd.z < .3);
  assert.ok(Math.hypot(hallLight.position.x - number.x, hallLight.position.y - number.y) < .22,
    'the close-up concentrates the lit spot on the number instead of below it');
  assert.ok(beam.material.opacity < approachOpacity / 2, 'the beam fades before the close-up crosses the plaque');
  assert.equal(h.sample(), 13);
  delete hotel.traceElapsed;
  h.pose('corridor');
  assert.equal(beam.visible, false);
  assert.deepEqual({ position: hallLight.position, intensity: hallLight.intensity, distance: hallLight.distance, color: hallLight.color.getHex() }, corridorLight);
  assert.equal(h.sample(), 13);
});

test('303 door trim has one visible surface across the door frame and wall', t => {
  const h = setup(t); h.pose('trace');
  const { root } = h.sets;
  for (const [x, y] of [[.42, 8.18], [3.58, 6.52], [-3.58, 6.52], [3.53, 8.16], [3.53, 9.16]]) {
    const origin = root.localToWorld(new THREE.Vector3(x, y, -2));
    const hits = new THREE.Raycaster(origin, new THREE.Vector3(0, 0, 1), 0, 4).intersectObject(root);
    assert.ok(hits.length > 0);
    assert.equal(hits.filter(hit => hit.distance - hits[0].distance < .001).length, 1, `overlapping faces at ${x}/${y}`);
  }
});

test('303 shares the decoded plaster maps while preserving each surface’s tiling', t => {
  const requests: string[] = [], pending: (() => void)[] = [];
  const h = setup(t, (url, loaded) => {
    const texture = new THREE.Texture();
    const finish = () => {
      texture.image = { width: 1024, height: 1024, complete: true, currentSrc: url };
      texture.needsUpdate = true;
      loaded?.(texture);
    };
    if (url.includes('/damaged_plaster-')) {
      requests.push(url);
      pending.push(finish);
    } else finish();
    return texture;
  });
  const repeats = new Map([[0xadae9c, 5], [0x3b4540, 4], [0x6a7066, 5], [0x73746e, 6], [0x414942, 9]]);
  h.pose('phone');
  const surfaces = new Map<THREE.MeshStandardMaterial, number>();
  h.sets.root.traverse(object => {
    if (!(object instanceof THREE.Mesh) || !(object.material instanceof THREE.MeshStandardMaterial)) return;
    const repeat = repeats.get(object.material.color.getHex());
    if (repeat !== undefined) surfaces.set(object.material, repeat);
  });
  assert.equal(surfaces.size, repeats.size);
  for (const material of surfaces.keys()) assert.equal(material.map, null);
  pending.splice(0).forEach(finish => finish());

  const views = new Set<THREE.Texture>();
  for (const channel of ['map', 'normalMap', 'roughnessMap'] as const) {
    const sources = new Set<THREE.Source>();
    for (const [material, repeat] of surfaces) {
      const texture = material[channel];
      assert.ok(texture && texture.version > 0);
      assert.deepEqual(texture.repeat.toArray(), [repeat, repeat]);
      assert.equal(texture.colorSpace, channel === 'map' ? THREE.SRGBColorSpace : THREE.NoColorSpace);
      sources.add(texture.source);
      views.add(texture);
    }
    assert.equal(sources.size, 1, `${channel} should have one GPU image source`);
    assert.equal([...sources][0].version, 1);
  }
  assert.equal(views.size, 15, 'each material owns its texture transforms');
  assert.equal(requests.length, 3);
  let disposed = 0;
  for (const texture of views) texture.addEventListener('dispose', () => disposed++);
  h.sets.update(undefined, undefined, 0);
  assert.equal(disposed, views.size);
  h.pose('phone');
  assert.equal(requests.length, 6, 'reentering 303 starts with fresh scene-owned images');
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
  for (let frame = 0; frame < 3; frame++) h.sets.prepareOpeningHotelPolice(gpu, h.camera, h.culling, undefined, 'hall');
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

  h.sets.prepareOpeningHotelPolice(gpu, h.camera, h.culling, [officer], 'hall');
  const normals = h.sets.openingHotelNormalMeshes;
  assert.ok(normals?.length === 1 && normals[0] === skin, 'prepare the actual offstage skin for the normal pass');
  h.sets.prepareOpeningHotelPolice(gpu, h.camera, h.culling, [officer], 'hall');
  assert.ok(h.sets.openingHotelNormalMeshes === normals);
  assert.equal(officer.visible, false);
  h.sets.update(undefined, undefined, 0);
  assert.equal(h.sets.openingHotelNormalMeshes, undefined);
});

test('303 prepares the pursuing officer uniform, normals and shadows before he enters the corridor', t => {
  const h = setup(t); h.pose('phone');
  const officer = new THREE.Group(), skin = new THREE.SkinnedMesh(new THREE.BoxGeometry(), new THREE.MeshStandardMaterial());
  const uniform = new THREE.SkinnedMesh(new THREE.BoxGeometry(), new THREE.MeshStandardMaterial({ side: THREE.DoubleSide }));
  skin.castShadow = uniform.castShadow = true;
  uniform.userData.office = true; uniform.visible = false;
  officer.add(skin, uniform, new THREE.Mesh(skin.geometry, skin.material));
  t.after(() => { for (const mesh of [skin, uniform]) { mesh.geometry.dispose(); mesh.material.dispose(); } });
  const compiled: THREE.Mesh[] = [], uploaded: THREE.BufferGeometry[] = [];
  let target: THREE.WebGLRenderTarget | null = null, releasedTarget = 0;
  const gpu = { properties: {}, info: { programs: [] }, extensions: { has: () => true }, getRenderTarget: () => target,
    shadowMap: { enabled: true, type: THREE.PCFSoftShadowMap },
    autoClear: true, sortObjects: true, getActiveCubeFace: () => 0, getActiveMipmapLevel: () => 0,
    setRenderTarget: (next: typeof target) => { target = next; },
    compile: (subject: THREE.Object3D) => subject.traverse(object => { if (object instanceof THREE.Mesh) compiled.push(object); }),
    render(view: THREE.Scene) {
      assert.equal(target?.width, 1);
      target?.addEventListener('dispose', () => releasedTarget++);
      for (const mesh of view.children) {
        assert.ok(mesh instanceof THREE.Mesh && !mesh.material.visible);
        uploaded.push(mesh.geometry);
      }
    },
  } as unknown as THREE.WebGLRenderer;

  for (let frame = 0; frame < 6; frame++) h.sets.prepareOpeningHotelPolice(gpu, h.camera, h.culling, [officer], 'pursuit');
  assert.ok(compiled.includes(uniform), 'prepare the real police uniform before the first animation reveals it');
  const depths = compiled.filter(mesh => mesh.material instanceof THREE.MeshDepthMaterial);
  assert.equal(depths.length, 2);
  assert.ok(depths.some(mesh => mesh.geometry === uniform.geometry) && depths.some(mesh => mesh.geometry === skin.geometry));
  assert.ok(depths.every(mesh => (mesh.material as THREE.MeshDepthMaterial).depthPacking === THREE.RGBADepthPacking));
  const normals = h.sets.openingHotelNormalMeshes;
  assert.ok(normals?.includes(skin) && normals.includes(uniform));
  assert.deepEqual(uploaded, [skin.geometry, uniform.geometry], 'stage each pursuing officer geometry before its first draw');
  assert.equal(releasedTarget, 1);
  assert.equal(target, null);
  assert.equal(uniform.parent, officer);
  assert.ok(uniform.material.visible);
  assert.equal(uniform.visible, false);
  let released = 0;
  for (const depth of depths) (depth.material as THREE.MeshDepthMaterial).addEventListener('dispose', () => released++);
  h.sets.update(undefined, undefined, 0);
  assert.equal(released, depths.length);
  assert.equal(h.sets.openingHotelNormalMeshes, undefined);
});

test('303 gives pursuing police programs a frame before reading their bindings', t => {
  const h = setup(t); h.pose('phone');
  const officer = new THREE.Group();
  const skin = new THREE.SkinnedMesh(new THREE.BoxGeometry(), new THREE.MeshStandardMaterial());
  officer.add(skin);
  t.after(() => { skin.geometry.dispose(); skin.material.dispose(); });
  const work: string[] = [];
  const program = {
    isReady() { work.push('ready'); return true; },
    getUniforms() { work.push('bindings'); },
  };
  const programs: typeof program[] = [];
  const gpu = { properties: {}, info: { programs }, extensions: { has: () => true }, debug: { checkShaderErrors: false },
    shadowMap: { enabled: false }, getRenderTarget: () => null, setRenderTarget() {},
    compile() { programs.push(program); work.push('compile'); },
  } as unknown as THREE.WebGLRenderer;
  const prepare = () => h.sets.prepareOpeningHotelPolice(gpu, h.camera, h.culling, [officer], 'pursuit');

  prepare();
  assert.deepEqual(work, ['compile']);
  prepare();
  assert.deepEqual(work, ['compile', 'ready']);
  assert.equal(h.sets.openingHotelNormalMeshes, undefined);
  prepare();
  assert.deepEqual(work, ['compile', 'ready', 'bindings']);
  assert.deepEqual(h.sets.openingHotelNormalMeshes, [skin]);
});

test('303 prepares the real phone cord before the caller approaches the desk', t => {
  const h = setup(t); h.pose('combat');
  const cord = h.sets.root.getObjectByName('hotel-303-phone-cord');
  assert.ok(cord instanceof THREE.Line);
  const parent = cord.parent, material = cord.material, work: string[] = [];
  const program = {
    isReady() { work.push('ready'); return true; },
    getUniforms() { work.push('bindings'); },
  };
  const programs: typeof program[] = [];
  const gpu = { properties: {}, info: { programs }, extensions: { has: () => true }, debug: { checkShaderErrors: false },
    getRenderTarget: () => null, setRenderTarget() {},
    compile(subject: THREE.Object3D) {
      const subjects: THREE.Object3D[] = [];
      subject.traverse(object => subjects.push(object));
      assert.deepEqual(subjects, [cord]);
      programs.push(program); work.push('compile');
    },
  } as unknown as THREE.WebGLRenderer;
  const prepare = () => h.sets.prepareOpeningHotelPolice(gpu, h.camera, h.culling, undefined, undefined, true);
  prepare();
  assert.deepEqual(work, ['compile']);
  prepare();
  assert.deepEqual(work, ['compile', 'ready']);
  prepare(); prepare();
  assert.deepEqual(work, ['compile', 'ready', 'bindings']);
  assert.ok(cord.parent === parent && cord.material === material && cord.visible);
});

test('303 keeps the docked phone cord buffer unchanged between frames', t => {
  const h = setup(t); h.pose('combat');
  const cord = h.sets.root.getObjectByName('hotel-303-phone-cord');
  assert.ok(cord instanceof THREE.Line);
  const points = cord.geometry.getAttribute('position') as THREE.BufferAttribute;
  const version = points.version, coordinates = points.array.slice();
  assert.ok(coordinates.some(value => value !== 0));
  h.pose('combat', .3, true, Math.PI);
  h.pose('phone', .5);
  assert.deepEqual(points.array, coordinates);
  assert.equal(points.version, version, 'static geometry does not trigger a new vertex upload');

  const body = new THREE.Group(), hand = new THREE.Group();
  const { center } = FILM_SETS.film_heart_hotel;
  body.position.set(center.x - 8, center.y + 3.5, center.z + 18);
  hand.name = 'hardline-handset'; body.add(hand);
  h.sets.setCrosscutSubjects(() => undefined, id => id === 'trinity' ? body : undefined);
  h.pose('answering', OPENING_HOTEL.phone.lift);
  assert.notDeepEqual(points.array, coordinates);
  const held = points.array.slice();
  hand.position.y += .3;
  h.pose('answering', OPENING_HOTEL.phone.lift + .1);
  assert.notDeepEqual(points.array, held, 'the curve follows the handset in the actor’s hand');
  h.pose('answering', OPENING_HOTEL.phone.release);
  assert.deepEqual(points.array, coordinates);
  const redocked = points.version;
  h.pose('corridor');
  assert.equal(points.version, redocked, 'the returned receiver stays at the original cradle');
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

test('303 reuses the transient impact flash with independent fades and releases it on exit', t => {
  const h = setup(t);
  const effects = new CombatEffects(h.scene, { effects: () => undefined } as unknown as GameAudio);
  t.after(() => effects.dispose());
  const position = { x: 0, y: 2, z: 1 };
  const hit = () => {
    effects.impact({ source: 'citizen_4', target: 'trinity', position, direction: { x: 0, y: 0, z: 1 },
      damage: 12, combo: 0, matrix: true, downed: false, shot: { from: { ...position, z: -2 }, surface: 'body' } }, true);
    const flash = h.scene.children.at(-1)?.children.find(child => child instanceof THREE.Sprite);
    assert.ok(flash instanceof THREE.Sprite);
    return flash;
  };
  const first = hit();
  let disposals = 0;
  first.material.addEventListener('dispose', () => disposals++);
  effects.update(.12, true);
  assert.equal(first.material.opacity, 0);
  effects.update(.54, true);
  assert.equal(first.parent?.parent, null, 'an expired flash leaves the scene');
  assert.equal(disposals, 0, 'keep one idle material available for the next 303 hit');
  const next = hit();
  assert.equal(next.material, first.material);
  assert.equal(next.material.opacity, 1);
  effects.update(.04, true);
  const overlap = hit();
  overlap.material.addEventListener('dispose', () => disposals++);
  assert.notEqual(overlap.material, next.material);
  assert.equal(overlap.material.opacity, 1);
  assert.ok(next.material.opacity > 0 && next.material.opacity < 1);
  effects.update(.66, true);
  assert.equal(disposals, 1, 'only one unused material stays resident');
  effects.update(0);
  assert.equal(disposals, 2, 'leaving 303 releases the idle material');
});

test('an additional real flash keeps its energy, and leaving 303 releases the reservation', t => {
  const h=setup(t);h.pose('combat');for(let i=0;i<6;i++)h.shot();
  assert.equal(h.sample(),14,'unexpected extra light must remain visible');h.gunfire.update(.12);assert.equal(h.sample(),13);
  h.sets.update(undefined,undefined,0);assert.equal(h.sets.minimumPointSlots,0);assert.equal(h.sets.stablePointSlots,false);
});
