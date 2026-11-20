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
  const document = globalThis.document, previousBitmap = globalThis.ImageBitmap, previousCreateBitmap = globalThis.createImageBitmap;
  let closedRoomBitmaps = 0, decodedRoomBlobs = 0;
  class Bitmap {
    constructor(readonly width = 2048, readonly height = width) {}
    close() { closedRoomBitmaps++; }
  }
  globalThis.ImageBitmap = Bitmap as unknown as typeof ImageBitmap;
  globalThis.createImageBitmap = (async (image: Blob | HTMLImageElement, options: ImageBitmapOptions) => {
    assert.equal(options.imageOrientation, 'flipY');
    assert.equal(options.premultiplyAlpha, 'none');
    if (image instanceof Blob) { decodedRoomBlobs++; return new Bitmap(1024); }
    return new Bitmap(image.width, image.height);
  }) as typeof createImageBitmap;
  t.mock.method(globalThis, 'fetch', async (url: string) => {
    assert.match(url, /^\/assets\/film-materials\/.+\.jpg$/);
    return new Response(new Blob(['room map']));
  });
  globalThis.document = { createElement: () => ({ getContext: () => ({ fillRect() {}, strokeRect() {}, fillText() {} }) }) } as unknown as Document;
  t.mock.method(THREE.TextureLoader.prototype, 'load', (url: string) => {
    const map = new THREE.Texture(new Bitmap(1024)); map.flipY = false; map.name = url; map.needsUpdate = true; return map;
  });
  t.mock.method(THREE.ImageLoader.prototype, 'load', (_url: string, onLoad: (image: { width: number; height: number }) => void) => {
    onLoad({ width: 1024, height: 1024 });
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
  const shadow = new THREE.Mesh(new THREE.PlaneGeometry(3, 3), new THREE.MeshBasicMaterial());
  scene.add(shadow);
  const apartmentProgram = {}, clubProgram = {};
  const shadowBindings = { currentProgram: apartmentProgram, uniforms: { opacity: { value: .55 } }, lightsStateVersion: 10 };
  const actor = new THREE.Group(), bitmap = new Bitmap(), faceBitmap = new Bitmap();
  const skinMap = new THREE.Texture(bitmap), faceMap = new THREE.Texture(faceBitmap);
  for (const map of [skinMap, faceMap]) { map.flipY = false; map.needsUpdate = true; }
  const skin = new THREE.SkinnedMesh(new THREE.BoxGeometry(), new THREE.MeshStandardMaterial({ map: skinMap }));
  const face = new THREE.SkinnedMesh(skin.geometry, new THREE.MeshStandardMaterial({ map: faceMap }));
  const neoActor = new THREE.Group();
  const wristMap = new THREE.Texture(new Bitmap(723, 210));
  wristMap.flipY = false; wristMap.needsUpdate = true;
  const wrist = new THREE.SkinnedMesh(skin.geometry, new THREE.MeshPhysicalMaterial({ map: wristMap }));
  wrist.name = 'Anatomical_wrist_skin'; wrist.userData.wristSkin = true; wrist.visible = false; neoActor.add(wrist);
  const patientNeck = new THREE.SkinnedMesh(skin.geometry, new THREE.MeshPhysicalMaterial());
  patientNeck.name = 'patient-first-person-neck'; patientNeck.visible = false; neoActor.add(patientNeck);
  face.castShadow = true; face.material.alphaTest = .5;
  skin.name = 'Club_upper_body'; skin.userData.club = true; skin.visible = false;
  face.name = 'Anatomical_head_and_hands'; actor.add(skin, face);
  const apartmentBody = new THREE.SkinnedMesh(new THREE.BoxGeometry(), new THREE.MeshStandardMaterial());
  neoActor.add(apartmentBody);
  t.after(() => {
    film.dispose(); lights.dispose(); skin.geometry.dispose(); skin.material.dispose(); face.material.dispose();
    apartmentBody.geometry.dispose(); apartmentBody.material.dispose();
    skinMap.dispose(); faceMap.dispose(); wristMap.dispose(); wrist.material.dispose(); patientNeck.material.dispose(); shadow.geometry.dispose(); shadow.material.dispose();
    scene.environment!.dispose(); globalThis.document = document;
    if (previousBitmap) globalThis.ImageBitmap = previousBitmap;
    else Reflect.deleteProperty(globalThis, 'ImageBitmap');
    if (previousCreateBitmap) globalThis.createImageBitmap = previousCreateBitmap;
    else Reflect.deleteProperty(globalThis, 'createImageBitmap');
  });

  const world = new WorldState(); new AgentManager(world).initializeAllAgents();
  const neo = world.agents.get('neo')!, apartment = FILM_SCENE_BY_ID.m1_wake_up, club = FILM_SCENE_BY_ID.m1_club;
  Object.assign(neo, { position: filmEntry(apartment), currentLocation: apartment.set, isInMatrix: true });
  const journey = { scene: apartment.id, actor: neo.id, step: 5, contact: { phase: 'noticed', elapsed: 1 }, completed: [] } as unknown as FilmJourney;
  const sandbox = { structures: [], neoLife: { deferredContact: journey } } as unknown as SandboxState;
  film.update(undefined, sandbox, 0);
  let target: THREE.WebGLRenderTarget | null = null, work = 0, preparationFrame = 0;
  const reads: { ready: number | undefined; frame: number }[] = [];
  const rooms = new Set<THREE.Object3D>(), compiled = new Set<THREE.Object3D>();
  const geometryUploads = new Map<THREE.BufferGeometry, number>();
  let roomMapsBeforeFirstGeometry: number | undefined;
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
      assert.deepEqual([y, width, height, skippedRows], [bound.rows, image.width, 256, y]);
      bound.rows += height;
    },
    generateMipmap() { assert.ok(bound); assert.equal(bound.rows, bound.image.height); bound.mipmaps = true; },
  };
  const gpu = { properties: { get: (object: THREE.Texture | THREE.Material) => object === shadow.material ? shadowBindings
    : uploaded.get(object as THREE.Texture) ?? {} }, info: { programs },
    shadowMap: { enabled: true, type: THREE.PCFSoftShadowMap }, debug: { checkShaderErrors: true }, extensions: { has: () => true },
    capabilities: { maxTextureSize: 4096 }, getContext: () => gl, getRenderTarget: () => target,
    autoClear: true, sortObjects: true, getActiveCubeFace: () => 0, getActiveMipmapLevel: () => 0,
    state: { bindTexture(_target: number, texture: Allocation) { bound = texture; }, unbindTexture() { bound = undefined; } },
    setRenderTarget: (value: typeof target) => { target = value; },
    render(view: THREE.Scene) {
      assert.equal(target?.width, 1);
      assert.ok(view.children.length <= 4);
      roomMapsBeforeFirstGeometry ??= [...allocations.values()].filter(allocation => allocation.image.width === 1024 && allocation.mipmaps).length;
      for (const object of view.children) {
        assert.ok(object instanceof THREE.Mesh && !Array.isArray(object.material) && !object.material.visible);
        geometryUploads.set(object.geometry, (geometryUploads.get(object.geometry) ?? 0) + 1);
      }
      work++;
    },
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
      assert.notEqual(view, scene);
      if (journey.scene === club.id) {
        assert.ok(scene.getObjectByName('white-rabbit-club'), 'keep the live club in place while compiling');
        assert.deepEqual([points, spots], [5, 3]);
      } else assert.equal(scene.getObjectByName('white-rabbit-club'), undefined);
      subject.traverse(object => {
        compiled.add(object);
        if (object === shadow) {
          shadowBindings.currentProgram = clubProgram; shadowBindings.uniforms.opacity.value = .2; shadowBindings.lightsStateVersion = 5;
        }
        if (object instanceof THREE.Mesh && !Array.isArray(object.material)) materialsAtCompile.set(object, object.material.customProgramCacheKey());
        if (object instanceof THREE.Mesh && object.material instanceof THREE.MeshDepthMaterial) depths.push({ mesh: object, points, spots });
      });
      for (let variant = 0; variant < 2; variant++) {
        let readyFrame: number | undefined;
        programs.push({ program: {}, isReady() { readyFrame ??= preparationFrame; return true; }, getUniforms() {
          reads.push({ ready: readyFrame, frame: preparationFrame }); work++;
        } });
      }
      work++;
    },
    initTexture(texture: THREE.Texture) {
      let allocation = allocations.get(texture.source);
      if (!allocation && texture.image instanceof Bitmap) {
        if (texture.image.width > 1024) assert.equal(texture.source.dataReady, false);
        allocation = { image: texture.image, rows: texture.source.dataReady ? texture.image.height : 0, mipmaps: texture.source.dataReady };
        allocations.set(texture.source, allocation);
      }
      if (texture !== skinMap && texture !== faceMap) work++;
      uploads.push(texture);
      uploaded.set(texture, { __version: texture.version, __webglTexture: allocation });
    },
  } as unknown as THREE.WebGLRenderer;
  const prepare = (resume = false) => {
    preparationFrame++;
    const before = work, beforeBounds = bounded.size;
    film.prepareClub(gpu, camera, journey, id => id === 'trinity' ? actor : neoActor, [shadow], resume, lights);
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
  if (uploads[0] === wristMap) prepare(true);
  const clubSkin = [...allocations.values()].find(allocation => allocation.image === bitmap);
  assert.ok(clubSkin, 'start the hidden club skin on the deferred invitation landing screen');
  assert.equal(clubSkin.rows, 512, 'limit the transfer to two strips');
  await new Promise(resolve => setImmediate(resolve));
  for (let frame = 0; frame < 12; frame++) prepare(true);
  assert.equal(rooms.size, 1, 'link the offstage room while still on the landing screen');
  const landingBounds = bounded.size;
  fill.visible = true;
  film.update(neo, sandbox, 0);
  await drain();
  assert.equal(decodedRoomBlobs, 12, 'decode the room maps directly from their responses without the image element load path');
  assert.ok([skinMap, faceMap].every(map => uploaded.get(map)?.__webglTexture?.mipmaps));
  assert.ok(uploads.indexOf(skinMap) < uploads.findIndex(map => map.name.startsWith('/assets/film-materials/')),
    'finish the entrance costume before uploading the waiting room and crowd maps');
  await t.test('prepare Neo’s small wrist texture on the original hidden mesh before the first club frame', () => {
    assert.equal(uploads.filter(texture => texture === wristMap).length, 1);
    assert.ok(uploads.indexOf(wristMap) < uploads.findIndex(map => map.name.startsWith('/assets/film-materials/')));
    assert.equal(wrist.visible, false);
    assert.equal(wrist.parent, neoActor);
  });
  assert.equal(rooms.size, 1, 'keep preparing the same room after the player takes Neo');
  assert.ok(compiled.has(skin), 'prepare Trinity’s actual hidden club costume');
  const first = [...rooms][0];
  const crowd = first.getObjectByName('club-dancer-0')!.getObjectByName('crowd-surface') as THREE.SkinnedMesh<THREE.BufferGeometry, THREE.MeshStandardMaterial>;
  await t.test('preparing the nightclub leaves the shared ground shadow bound to the apartment', () => {
    assert.ok(compiled.has(shadow), 'the actual shadow must be ready for the club');
    assert.ok(shadowBindings.currentProgram === apartmentProgram, 'the apartment still draws with its own program');
    assert.equal(shadowBindings.lightsStateVersion, 10);
    assert.equal(shadowBindings.uniforms.opacity.value, .55);
  });
  assert.equal(first.children.filter(child => child.name.startsWith('club-dancer-')).length, 16);
  assert.ok(compiled.has(crowd));
  assert.equal([...compiled].filter(mesh => mesh.name === 'crowd-surface').length, 2);
  await t.test('stage the room, shared dancer buffers and entrance costume before the cut', () => {
    const roomMeshes = first.children.filter(object => object instanceof THREE.Mesh);
    for (const geometry of [...roomMeshes.map(mesh => mesh.geometry), crowd.geometry, skin.geometry])
      assert.equal(geometryUploads.get(geometry), 1, 'upload each original geometry once offstage');
    assert.ok(roomMapsBeforeFirstGeometry! < 12, 'the room texture queue must not postpone all geometry until its last strip');
    assert.ok(!geometryUploads.has(apartmentBody.geometry), 'leave the apartment actor out of the club buffer queue');
    assert.equal(crowd.parent, first.getObjectByName('club-dancer-0'));
    assert.equal(skin.parent, actor);
    assert.equal(skin.visible, false);
  });
  await t.test('dancer bounds advance while the room programs and texture uploads are pending', () => {
    assert.equal(landingBounds, 12, 'prepare one dancer on each frame after the crowd loads');
  });
  await t.test('each dancer has posed bounds before the first live draw', () => {
    const dancers = first.children.filter(child => child.name.startsWith('club-dancer-'));
    for (const dancer of dancers) {
      const mesh = dancer.getObjectByName('crowd-surface') as THREE.SkinnedMesh;
      assert.ok(bounded.has(mesh), dancer.name);
      assert.ok(mesh.boundingSphere && mesh.boundingSphere.radius > 0);
      assert.equal(mesh.frustumCulled, true);
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
  await t.test('stage the 1024-pixel room maps one strip per frame before the crowd maps', () => {
    const roomMaps = [...new Set(uploads.filter(map => map.name.startsWith('/assets/film-materials/') && uploaded.get(map)?.__webglTexture
      && (map.image as Bitmap).height === 1024))];
    const images = new Set(roomMaps.map(map => map.image as Bitmap));
    assert.equal(images.size, 12);
    assert.ok([...images].every(image => firstRows.get(image) === 256), 'room maps must not send all 1024 rows in one upload');
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
  await t.test('the club never links the neckline used only by the exposed patient', () => {
    assert.ok(!compiled.has(patientNeck));
  });
  await t.test('club shader binding reads wait a frame after completion without leaving the queue pending', () => {
    assert.equal(reads.length, programs.length);
    assert.ok(reads.length > 1);
    assert.ok(reads.every(({ ready, frame }) => ready !== undefined && ready < frame));
    assert.ok(reads.some(({ ready, frame }, index) => {
      const previous = reads[index - 1];
      return previous?.ready === ready && frame - previous.frame <= 2;
    }), 'poll every completed variant in a batch while textures alternate with reads');
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
  assert.equal(closedRoomBitmaps, 12);
  delete journey.visiting;
  journey.contact!.phase = 'accepted';
  const firstAcceptedUpload = uploads.length;
  await drain();
  const acceptedRoomBitmaps = new Set(uploads.slice(firstAcceptedUpload)
    .filter(texture => texture.name.startsWith('/assets/film-materials/')).map(texture => texture.image as Bitmap));
  assert.equal(acceptedRoomBitmaps.size, 12);
  assert.ok([...acceptedRoomBitmaps].every(image => firstRows.get(image) === 512), 'an accepted invite can use two strips to finish preparing for entry');
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

  await t.test('a cold whisper save prepares both offscreen boots and the exit marker before departure', () => {
    const boots = [neoActor, actor].map(group => {
      const boot = new THREE.SkinnedMesh(skin.geometry, new THREE.MeshStandardMaterial());
      boot.name = 'shoes01'; boot.visible = false; group.add(boot);
      return boot;
    });
    try {
      landing.visible = false; lights.stablePointSlots = true; lights.minimumPointSlots = 5;
      Object.assign(journey, { step: 1, club: { phase: 'whisper', elapsed: 9 } });
      film.update(neo, sandbox, 0);
      assert.notEqual(film.root.getObjectByName('white-rabbit-club'), room);
      compiled.delete(film.goalMarker);
      const firstRead = reads.length;
      for (let frame = 0; frame < 12; frame++) prepare();
      assert.ok(compiled.has(film.goalMarker), 'the marker appears when the player can leave');
      for (const boot of boots) {
        assert.ok(compiled.has(boot));
        assert.match(materialsAtCompile.get(boot) ?? '', /actor-local-skin-v1/);
        assert.equal(boot.visible, false);
      }
      assert.equal(reads.length - firstRead, 2, 'a single batch is linked and read once');
      assert.equal(film.goalMarker.visible, false);
    } finally {
      film.update(undefined, undefined, 0);
      landing.visible = true; lights.stablePointSlots = false; lights.minimumPointSlots = 10;
      for (const boot of boots) { boot.removeFromParent(); boot.material.dispose(); }
    }
  });

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
