import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { FILM_SCENE_BY_ID, filmEntry, type FilmJourney, type SandboxState } from '@auto_matrix/shared';
import { FilmSetRenderer } from '../packages/client/src/engine/FilmSetRenderer.js';
import { WorldState } from '../packages/server/src/world/WorldState.js';
import { AgentManager } from '../packages/server/src/agents/AgentManager.js';

test('the invitation prepares the actual club and crowd offstage and transfers ownership on entry', async t => {
  const document = globalThis.document, previousBitmap = globalThis.ImageBitmap;
  class Bitmap { width = 2048; height = 2048; }
  globalThis.ImageBitmap = Bitmap as unknown as typeof ImageBitmap;
  globalThis.document = { createElement: () => ({ getContext: () => ({ fillRect() {}, strokeRect() {}, fillText() {} }) }) } as unknown as Document;
  t.mock.method(THREE.TextureLoader.prototype, 'load', () => {
    const map = new THREE.Texture({ width: 1024, height: 1024 }); map.needsUpdate = true; return map;
  });
  t.mock.method(GLTFLoader.prototype, 'loadAsync', async () => {
    const scene = new THREE.Group();
    const names = ['pelvis', 'spine', 'chest', 'head', ...['R', 'L'].flatMap(side => ['shoulder', 'elbow', 'hip', 'knee'].map(joint => `${joint}_${side}`))];
    for (const name of names) { const bone = new THREE.Bone(); bone.name = name; scene.add(bone); }
    const map = new THREE.Texture({ width: 1024, height: 1024 }); map.needsUpdate = true;
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(), new THREE.MeshStandardMaterial({ map }));
    mesh.name = 'crowd-surface'; scene.add(mesh);
    return { scene };
  });
  const scene = new THREE.Scene(), film = new FilmSetRenderer(scene), camera = new THREE.PerspectiveCamera();
  scene.fog = new THREE.FogExp2(); scene.environment = new THREE.Texture();
  const sun = new THREE.DirectionalLight(); sun.castShadow = true;
  scene.add(sun, new THREE.DirectionalLight(), new THREE.HemisphereLight());
  const actor = new THREE.Group(), bitmap = new Bitmap(), faceBitmap = new Bitmap();
  const skinMap = new THREE.Texture(bitmap), faceMap = new THREE.Texture(faceBitmap);
  for (const map of [skinMap, faceMap]) { map.flipY = false; map.needsUpdate = true; }
  const skin = new THREE.SkinnedMesh(new THREE.BoxGeometry(), new THREE.MeshStandardMaterial({ map: skinMap }));
  const face = new THREE.SkinnedMesh(skin.geometry, new THREE.MeshStandardMaterial({ map: faceMap }));
  skin.name = 'Club_upper_body'; skin.userData.club = true; skin.visible = false;
  face.name = 'Anatomical_head_and_hands'; actor.add(skin, face);
  t.after(() => {
    film.dispose(); skin.geometry.dispose(); skin.material.dispose(); face.material.dispose();
    skinMap.dispose(); faceMap.dispose(); scene.environment!.dispose(); globalThis.document = document;
    if (previousBitmap) globalThis.ImageBitmap = previousBitmap;
    else Reflect.deleteProperty(globalThis, 'ImageBitmap');
  });

  const world = new WorldState(); new AgentManager(world).initializeAllAgents();
  const neo = world.agents.get('neo')!, apartment = FILM_SCENE_BY_ID.m1_wake_up, club = FILM_SCENE_BY_ID.m1_club;
  Object.assign(neo, { position: filmEntry(apartment), currentLocation: apartment.set, isInMatrix: true });
  const journey = { scene: apartment.id, actor: neo.id, step: 3, contact: { phase: 'handover', elapsed: 1 }, completed: [] } as unknown as FilmJourney;
  const sandbox = { structures: [], neoLife: { journey } } as unknown as SandboxState;
  film.update(neo, sandbox, 0);
  let target: THREE.WebGLRenderTarget | null = null, work = 0;
  const rooms = new Set<THREE.Object3D>(), compiled = new Set<THREE.Object3D>();
  type Allocation = { image: Bitmap; rows: number; mipmaps: boolean };
  const uploads: THREE.Texture[] = [], allocations = new Map<THREE.Source, Allocation>();
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
    shadowMap: { enabled: false }, debug: { checkShaderErrors: true }, extensions: { has: () => true },
    capabilities: { maxTextureSize: 4096 }, getContext: () => gl, getRenderTarget: () => target,
    state: { bindTexture(_target: number, texture: Allocation) { bound = texture; }, unbindTexture() { bound = undefined; } },
    setRenderTarget: (value: typeof target) => { target = value; },
    compile(subject: THREE.Object3D, _eye: THREE.Camera, view: THREE.Scene) {
      assert.equal(target?.width, 1);
      view.traverseVisible(object => { if (object.name === 'white-rabbit-club') rooms.add(object); });
      assert.notEqual(view, scene); assert.equal(scene.getObjectByName('white-rabbit-club'), undefined);
      subject.traverse(object => compiled.add(object));
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
  const prepare = () => {
    const before = work;
    film.prepareClub?.(gpu, camera, journey, id => id === 'trinity' ? actor : undefined);
    assert.ok(work - before <= 1, 'spread program reflection and uploads across different frames');
    assert.equal(target, null); assert.equal(skin.visible, false);
  };
  const drain = async () => {
    prepare(); await new Promise(resolve => setImmediate(resolve));
    for (let frame = 0; frame < 160; frame++) prepare();
  };
  prepare();
  assert.equal([...allocations.values()][0]?.image, bitmap, 'start the hidden club skin on the first preparation frame');
  assert.equal([...allocations.values()][0]?.rows, 512, 'limit the transfer to two strips');
  await drain();
  assert.ok([skinMap, faceMap].every(map => uploaded.get(map)?.__webglTexture?.mipmaps));
  assert.ok(uploads.indexOf(skinMap) < uploads.findIndex(map => !(map.image instanceof Bitmap)),
    'finish the entrance costume before uploading the waiting room and crowd maps');
  assert.equal(rooms.size, 1, 'prepare the club before the player leaves the apartment');
  assert.ok(compiled.has(skin), 'prepare Trinity’s actual hidden club costume');
  const first = [...rooms][0], crowd = first.getObjectByName('club-dancer-0')!.getObjectByName('crowd-surface') as THREE.Mesh;
  assert.equal(first.children.filter(child => child.name.startsWith('club-dancer-')).length, 16);
  assert.ok(compiled.has(crowd));
  assert.equal([...compiled].filter(mesh => mesh.name === 'crowd-surface').length, 2);
  let cancelled = 0; crowd.geometry.addEventListener('dispose', () => cancelled++);
  journey.visiting = apartment.id; prepare(); assert.equal(cancelled, 1);
  delete journey.visiting;
  await drain();
  const room = [...rooms].at(-1)!;
  assert.notEqual(room, first);
  const floor = room.children.find(object => object instanceof THREE.Mesh) as THREE.Mesh;
  let disposed = 0; floor.geometry.addEventListener('dispose', () => disposed++);
  Object.assign(neo, { position: filmEntry(club), currentLocation: club.set });
  Object.assign(journey, { scene: club.id, step: 0, club: { phase: 'crowd', elapsed: 0 } });
  film.update(neo, sandbox, 0);
  assert.equal(film.root.getObjectByName('white-rabbit-club'), room);
  assert.equal(disposed, 0);
  film.update(undefined, undefined, 0);
  assert.equal(disposed, 1);
});
