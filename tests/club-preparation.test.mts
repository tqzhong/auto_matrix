import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { FILM_SCENE_BY_ID, filmEntry, type FilmJourney, type SandboxState } from '@auto_matrix/shared';
import { FilmSetRenderer } from '../packages/client/src/engine/FilmSetRenderer.js';
import { WorldState } from '../packages/server/src/world/WorldState.js';
import { AgentManager } from '../packages/server/src/agents/AgentManager.js';

test('the invitation prepares the actual club and crowd offstage and transfers ownership on entry', async t => {
  const document = globalThis.document;
  globalThis.document = { createElement: () => ({ getContext: () => ({ fillRect() {}, strokeRect() {}, fillText() {} }) }) } as unknown as Document;
  t.mock.method(THREE.TextureLoader.prototype, 'load', () => new THREE.Texture());
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
  const actor = new THREE.Group(), skin = new THREE.SkinnedMesh(new THREE.BoxGeometry(), new THREE.MeshStandardMaterial());
  skin.userData.club = true; skin.visible = false; actor.add(skin);
  t.after(() => { film.dispose(); skin.geometry.dispose(); skin.material.dispose(); scene.environment!.dispose(); globalThis.document = document; });

  const world = new WorldState(); new AgentManager(world).initializeAllAgents();
  const neo = world.agents.get('neo')!, apartment = FILM_SCENE_BY_ID.m1_wake_up, club = FILM_SCENE_BY_ID.m1_club;
  Object.assign(neo, { position: filmEntry(apartment), currentLocation: apartment.set, isInMatrix: true });
  const journey = { scene: apartment.id, actor: neo.id, step: 3, contact: { phase: 'handover', elapsed: 1 }, completed: [] } as unknown as FilmJourney;
  const sandbox = { structures: [], neoLife: { journey } } as unknown as SandboxState;
  film.update(neo, sandbox, 0);
  let target: THREE.WebGLRenderTarget | null = null, work = 0;
  const rooms = new Set<THREE.Object3D>(), compiled = new Set<THREE.Object3D>();
  const uploaded = new WeakMap<THREE.Texture, number>();
  const programs: { program: object; isReady(): boolean; getUniforms(): void }[] = [];
  const gpu = { properties: { get: (texture: THREE.Texture) => ({ __version: uploaded.get(texture) }) }, info: { programs },
    shadowMap: { enabled: false }, debug: { checkShaderErrors: true }, extensions: { has: () => true },
    getContext: () => ({ LINK_STATUS: 0x8b82, getProgramParameter: () => true }), getRenderTarget: () => target,
    setRenderTarget: (value: typeof target) => { target = value; },
    compile(subject: THREE.Object3D, _eye: THREE.Camera, view: THREE.Scene) {
      assert.equal(target?.width, 1);
      view.traverseVisible(object => { if (object.name === 'white-rabbit-club') rooms.add(object); });
      assert.notEqual(view, scene); assert.equal(scene.getObjectByName('white-rabbit-club'), undefined);
      subject.traverse(object => compiled.add(object));
      programs.push({ program: {}, isReady: () => true, getUniforms() { work++; } });
      work++;
    },
    initTexture(texture: THREE.Texture) { uploaded.set(texture, texture.version); work++; },
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
  await drain();
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
