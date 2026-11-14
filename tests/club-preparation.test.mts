import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { FILM_SCENE_BY_ID, filmEntry, type FilmJourney, type SandboxState } from '@auto_matrix/shared';
import { FilmSetRenderer } from '../packages/client/src/engine/FilmSetRenderer.js';
import { LightCulling } from '../packages/client/src/engine/LightCulling.js';
import { WorldState } from '../packages/server/src/world/WorldState.js';
import { AgentManager } from '../packages/server/src/agents/AgentManager.js';

test('the invitation prepares the actual club and crowd offstage and transfers ownership on entry', async t => {
  const document = globalThis.document, previousBitmap = globalThis.ImageBitmap;
  class Bitmap { width = 2048; height = 2048; }
  globalThis.ImageBitmap = Bitmap as unknown as typeof ImageBitmap;
  globalThis.document = { createElement: () => ({ getContext: () => ({ fillRect() {}, strokeRect() {}, fillText() {} }) }) } as unknown as Document;
  t.mock.method(THREE.TextureLoader.prototype, 'load', (url: string) => {
    const map = new THREE.Texture({ width: 1024, height: 1024 }); map.name = url; map.needsUpdate = true; return map;
  });
  t.mock.method(GLTFLoader.prototype, 'loadAsync', async () => {
    const scene = new THREE.Group();
    const names = ['pelvis', 'spine', 'chest', 'head', ...['R', 'L'].flatMap(side => ['shoulder', 'elbow', 'hip', 'knee'].map(joint => `${joint}_${side}`))];
    for (const name of names) { const bone = new THREE.Bone(); bone.name = name; scene.add(bone); }
    const map = new THREE.Texture(new Bitmap()); map.flipY = false; map.needsUpdate = true;
    const material = new THREE.MeshStandardMaterial({ map }); material.name = 'Trousers';
    const geometry = new THREE.BoxGeometry(), joints = new Uint16Array(geometry.attributes.position.count * 4);
    const weights = new Float32Array(joints.length);
    for (let i = 0; i < weights.length; i += 4) weights[i] = 1;
    geometry.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(joints, 4));
    geometry.setAttribute('skinWeight', new THREE.Float32BufferAttribute(weights, 4));
    const mesh = new THREE.SkinnedMesh(geometry, material);
    mesh.name = 'crowd-surface'; scene.add(mesh);
    mesh.bind(new THREE.Skeleton([scene.getObjectByName('pelvis') as THREE.Bone]));
    return { scene };
  });
  const scene = new THREE.Scene(), film = new FilmSetRenderer(scene), camera = new THREE.PerspectiveCamera();
  scene.fog = new THREE.FogExp2(); scene.environment = new THREE.Texture();
  const sun = new THREE.DirectionalLight(); sun.castShadow = true;
  const fill = new THREE.DirectionalLight(); fill.visible = false;
  const landing = new THREE.SpotLight(); landing.castShadow = true;
  scene.add(sun, fill, new THREE.HemisphereLight(), landing);
  const lights = new LightCulling(scene); lights.minimumPointSlots = 10;
  const actor = new THREE.Group(), bitmap = new Bitmap(), faceBitmap = new Bitmap();
  const skinMap = new THREE.Texture(bitmap), faceMap = new THREE.Texture(faceBitmap);
  for (const map of [skinMap, faceMap]) { map.flipY = false; map.needsUpdate = true; }
  const skin = new THREE.SkinnedMesh(new THREE.BoxGeometry(), new THREE.MeshStandardMaterial({ map: skinMap }));
  const face = new THREE.SkinnedMesh(skin.geometry, new THREE.MeshStandardMaterial({ map: faceMap }));
  face.castShadow = true; face.material.alphaTest = .5;
  skin.name = 'Club_upper_body'; skin.userData.club = true; skin.visible = false;
  face.name = 'Anatomical_head_and_hands'; actor.add(skin, face);
  t.after(() => {
    film.dispose(); lights.dispose(); skin.geometry.dispose(); skin.material.dispose(); face.material.dispose();
    skinMap.dispose(); faceMap.dispose(); scene.environment!.dispose(); globalThis.document = document;
    if (previousBitmap) globalThis.ImageBitmap = previousBitmap;
    else Reflect.deleteProperty(globalThis, 'ImageBitmap');
  });

  const world = new WorldState(); new AgentManager(world).initializeAllAgents();
  const neo = world.agents.get('neo')!, apartment = FILM_SCENE_BY_ID.m1_wake_up, club = FILM_SCENE_BY_ID.m1_club;
  Object.assign(neo, { position: filmEntry(apartment), currentLocation: apartment.set, isInMatrix: true });
  const journey = { scene: apartment.id, actor: neo.id, step: 5, contact: { phase: 'noticed', elapsed: 1 }, completed: [] } as unknown as FilmJourney;
  const sandbox = { structures: [], neoLife: { deferredContact: journey } } as unknown as SandboxState;
  film.update(undefined, sandbox, 0);
  let target: THREE.WebGLRenderTarget | null = null, work = 0;
  const rooms = new Set<THREE.Object3D>(), compiled = new Set<THREE.Object3D>();
  const bounded = new Set<THREE.SkinnedMesh>();
  const computeBounds = THREE.SkinnedMesh.prototype.computeBoundingSphere;
  t.mock.method(THREE.SkinnedMesh.prototype, 'computeBoundingSphere', function (this: THREE.SkinnedMesh) {
    assert.ok(!bounded.has(this), 'prepare each dancer mesh only once');
    bounded.add(this);
    computeBounds.call(this);
  });
  const materialsAtCompile = new Map<THREE.Mesh, string>();
  const depths: { mesh: THREE.Mesh<THREE.BufferGeometry, THREE.MeshDepthMaterial>; points: number; spots: number }[] = [];
  type Allocation = { image: Bitmap; rows: number; mipmaps: boolean };
  const uploads: THREE.Texture[] = [], allocations = new Map<THREE.Source, Allocation>();
  const firstRows = new Map<Bitmap, number>();
  const uploaded = new WeakMap<THREE.Texture, { __version: number; __webglTexture?: Allocation }>();
  let bound: Allocation | undefined, skippedRows = 0;
  const programs: { program: object; isReady(): boolean; getUniforms(): void }[] = [];
  const gl = { LINK_STATUS: 0x8b82, TEXTURE_2D: 0x0de1, UNPACK_SKIP_ROWS: 0x0cf3, RGBA: 0x1908, UNSIGNED_BYTE: 0x1401,
    getProgramParameter: () => true,
    pixelStorei(_parameter: number, value: number) { skippedRows = value; },
    texSubImage2D(_target: number, _level: number, _x: number, y: number, width: number, height: number,
      _format: number, _type: number, image: Bitmap) {
      assert.ok(bound); assert.equal(bound.image, image);
      assert.deepEqual([y, width, height, skippedRows], [bound.rows, 2048, 256, y]);
      bound.rows += height;
    },
    generateMipmap() { assert.equal(bound?.rows, 2048); bound!.mipmaps = true; },
  };
  const gpu = { properties: { get: (texture: THREE.Texture) => uploaded.get(texture) ?? {} }, info: { programs },
    shadowMap: { enabled: true, type: THREE.PCFSoftShadowMap }, debug: { checkShaderErrors: true }, extensions: { has: () => true },
    capabilities: { maxTextureSize: 4096 }, getContext: () => gl, getRenderTarget: () => target,
    state: { bindTexture(_target: number, texture: Allocation) { bound = texture; }, unbindTexture() { bound = undefined; } },
    setRenderTarget: (value: typeof target) => { target = value; },
    compile(subject: THREE.Object3D, _eye: THREE.Camera, view: THREE.Scene) {
      assert.equal(target?.width, 1);
      let directionalLights = 0, points = 0, spots = 0;
      view.traverseVisible(object => {
        if (object.name === 'white-rabbit-club') rooms.add(object);
        if (object instanceof THREE.DirectionalLight) directionalLights++;
        if (object instanceof THREE.PointLight) points++;
        if (object instanceof THREE.SpotLight) spots++;
      });
      assert.equal(directionalLights, 2, 'use the two directional light slots from the possessed player view');
      assert.notEqual(view, scene); assert.equal(scene.getObjectByName('white-rabbit-club'), undefined);
      subject.traverse(object => {
        compiled.add(object);
        if (object instanceof THREE.Mesh && !Array.isArray(object.material)) materialsAtCompile.set(object, object.material.customProgramCacheKey());
        if (object instanceof THREE.Mesh && object.material instanceof THREE.MeshDepthMaterial) depths.push({ mesh: object, points, spots });
      });
      programs.push({ program: {}, isReady: () => true, getUniforms() { work++; } });
      work++;
    },
    initTexture(texture: THREE.Texture) {
      let allocation = allocations.get(texture.source);
      if (!allocation && texture.image instanceof Bitmap) {
        assert.equal(texture.source.dataReady, false);
        allocation = { image: texture.image, rows: 0, mipmaps: false };
        allocations.set(texture.source, allocation);
      }
      if (texture !== skinMap && texture !== faceMap) work++;
      uploads.push(texture);
      uploaded.set(texture, { __version: texture.version, __webglTexture: allocation });
    },
  } as unknown as THREE.WebGLRenderer;
  const prepare = (resume = false) => {
    const before = work, beforeBounds = bounded.size;
    film.prepareClub(gpu, camera, journey, id => id === 'trinity' ? actor : undefined, [], resume, lights);
    for (const { image, rows } of allocations.values()) if (!firstRows.has(image)) firstRows.set(image, rows);
    assert.ok(work - before <= 1, 'spread program reflection and uploads across different frames');
    assert.ok(bounded.size - beforeBounds <= 1, 'prepare at most one mock dancer per frame');
    assert.equal(target, null); assert.equal(skin.visible, false);
  };
  const drain = async () => {
    prepare(); await new Promise(resolve => setImmediate(resolve));
    for (let frame = 0; frame < 160; frame++) prepare();
  };
  prepare(true);
  assert.equal([...allocations.values()][0]?.image, bitmap, 'start the hidden club skin on the deferred invitation landing screen');
  assert.equal([...allocations.values()][0]?.rows, 512, 'limit the transfer to two strips');
  await new Promise(resolve => setImmediate(resolve));
  for (let frame = 0; frame < 12; frame++) prepare(true);
  assert.equal(rooms.size, 1, 'link the offstage room while still on the landing screen');
  const landingBounds = bounded.size;
  fill.visible = true;
  film.update(neo, sandbox, 0);
  await drain();
  assert.ok([skinMap, faceMap].every(map => uploaded.get(map)?.__webglTexture?.mipmaps));
  assert.ok(uploads.indexOf(skinMap) < uploads.findIndex(map => !(map.image instanceof Bitmap)),
    'finish the entrance costume before uploading the waiting room and crowd maps');
  assert.equal(rooms.size, 1, 'keep preparing the same room after the player takes Neo');
  assert.ok(compiled.has(skin), 'prepare Trinity’s actual hidden club costume');
  const first = [...rooms][0];
  const crowd = first.getObjectByName('club-dancer-0')!.getObjectByName('crowd-surface') as THREE.SkinnedMesh<THREE.BufferGeometry, THREE.MeshStandardMaterial>;
  assert.equal(first.children.filter(child => child.name.startsWith('club-dancer-')).length, 16);
  assert.ok(compiled.has(crowd));
  assert.equal([...compiled].filter(mesh => mesh.name === 'crowd-surface').length, 2);
  await t.test('dancer bounds advance while the room programs and texture uploads are pending', () => {
    assert.equal(landingBounds, 12, 'prepare one dancer on each frame after the crowd loads');
  });
  await t.test('each dancer has posed bounds before the first live draw', () => {
    const dancers = first.children.filter(child => child.name.startsWith('club-dancer-'));
    for (const dancer of dancers) {
      const mesh = dancer.getObjectByName('crowd-surface') as THREE.SkinnedMesh;
      assert.ok(bounded.has(mesh), dancer.name);
      assert.ok(mesh.boundingSphere && mesh.boundingSphere.radius > 0);
      assert.equal(mesh.frustumCulled, false);
    }
    assert.equal(bounded.size, 16);
  });
  const clubDepths = () => new Set(depths.map(({ mesh }) => mesh.material));
  await t.test('prepare real room and actor shadows for the apartment and club light layouts', () => {
    const roomGeometries = first.children.filter(object => object instanceof THREE.Mesh).map(mesh => mesh.geometry);
    for (const [points, spots] of [[10, 1], [5, 3]]) {
      const meshes = depths.filter(depth => depth.points === points && depth.spots === spots).map(depth => depth.mesh);
      assert.ok(meshes.some(mesh => roomGeometries.includes(mesh.geometry)), 'prepare a real room caster');
      assert.ok(meshes.some(mesh => mesh instanceof THREE.SkinnedMesh && mesh.geometry === face.geometry
        && mesh.material.map === faceMap && mesh.material.alphaTest === .5), 'prepare the skinned caster with its alpha mask');
      assert.ok(meshes.every(mesh => mesh.material.depthPacking === THREE.RGBADepthPacking));
    }
  });
  await t.test('the room maps are ready before the crowd maps', () => {
    const roomMaps = uploads.filter(map => map.name.startsWith('/assets/film-materials/'));
    assert.equal(roomMaps.length, 12);
    const crowdStart = uploads.findIndex(map => map.image === crowd.material.map!.image);
    assert.ok(roomMaps.every(map => uploads.indexOf(map) < crowdStart));
  });
  await t.test('the crowd maps upload two strips per preparation frame', () => {
    const allocation = uploaded.get(crowd.material.map!)?.__webglTexture;
    assert.ok(allocation?.mipmaps);
    assert.equal(firstRows.get(allocation.image), 512);
  });
  await t.test('the crowd uses the two prepared shader variants across all sixteen tinted clones', () => {
    const dancers = first.children.filter(child => child.name.startsWith('club-dancer-'));
    const surfaces = dancers.map(dancer => dancer.getObjectByName('crowd-surface') as THREE.SkinnedMesh<THREE.BufferGeometry, THREE.MeshStandardMaterial>);
    assert.ok(surfaces.every((mesh, index) => mesh.material.customProgramCacheKey() === materialsAtCompile.get(surfaces[index % 2])));
    assert.ok(!materialsAtCompile.get(surfaces[0])?.includes('actor-local-skin-v1'));
  });
  let cancelled = 0, cancelledDepths = 0; crowd.geometry.addEventListener('dispose', () => cancelled++);
  const abandoned = clubDepths();
  for (const material of abandoned) material.addEventListener('dispose', () => cancelledDepths++);
  sandbox.neoLife!.journey = journey;
  delete sandbox.neoLife!.deferredContact;
  film.update(neo, sandbox, 0);
  prepare();
  assert.equal(cancelled, 0, 'continuing the invitation keeps the prepared club');
  assert.equal(cancelledDepths, 0);
  sandbox.neoLife!.deferredContact = journey;
  delete sandbox.neoLife!.journey;
  film.update(neo, sandbox, 0);
  prepare();
  assert.equal(cancelled, 0, 'waiting in the apartment keeps the same club');
  sandbox.neoLife!.journey = journey;
  delete sandbox.neoLife!.deferredContact;
  journey.visiting = apartment.id; prepare(); assert.equal(cancelled, 1);
  assert.equal(cancelledDepths, abandoned.size);
  delete journey.visiting;
  await drain();
  const room = [...rooms].at(-1)!;
  assert.notEqual(room, first);
  const floor = room.children.find(object => object instanceof THREE.Mesh) as THREE.Mesh;
  let disposed = 0, disposedDepths = 0; floor.geometry.addEventListener('dispose', () => disposed++);
  const adopted = [...clubDepths()].filter(material => !abandoned.has(material));
  for (const material of adopted) material.addEventListener('dispose', () => disposedDepths++);
  Object.assign(neo, { position: filmEntry(club), currentLocation: club.set });
  Object.assign(journey, { scene: club.id, step: 0, club: { phase: 'crowd', elapsed: 0 } });
  film.update(neo, sandbox, 0);
  assert.equal(film.root.getObjectByName('white-rabbit-club'), room);
  assert.equal(disposed, 0);
  assert.equal(disposedDepths, 0);
  film.update(undefined, undefined, 0);
  assert.equal(disposed, 1);
  assert.equal(disposedDepths, adopted.length);

  Object.assign(neo, { position: filmEntry(apartment), currentLocation: apartment.set });
  Object.assign(journey, { scene: apartment.id, step: 5, contact: { phase: 'noticed', elapsed: 1 } });
  sandbox.neoLife!.deferredContact = journey;
  delete sandbox.neoLife!.journey;
  film.update(neo, sandbox, 0);
  await drain();
  const waitingRoom = [...rooms].at(-1)!;
  let leftHome = 0;
  const surface = waitingRoom.children.find(object => object instanceof THREE.Mesh) as THREE.Mesh;
  surface.geometry.addEventListener('dispose', () => leftHome++);
  neo.position = { ...neo.position, z: neo.position.z + 100 };
  film.update(neo, sandbox, 0);
  assert.equal(leftHome, 1, 'leaving the apartment releases the deferred club');
});
