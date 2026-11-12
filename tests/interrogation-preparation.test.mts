import assert from 'node:assert/strict';
import test, { type TestContext } from 'node:test';
import * as THREE from 'three';
import { FILM_SETS, filmPosition, type FilmJourney, type SandboxState } from '@auto_matrix/shared';
import { FilmSetRenderer } from '../packages/client/src/engine/FilmSetRenderer.js';
import { AgentManager } from '../packages/server/src/agents/AgentManager.js';
import { WorldState } from '../packages/server/src/world/WorldState.js';

function fixture(t: TestContext) {
  const previous = globalThis.document;
  globalThis.document = { createElement: () => ({ getContext: () => ({ fillRect() {}, fillText() {} }) }) } as unknown as Document;
  const scene = new THREE.Scene(), film = new FilmSetRenderer(scene), camera = new THREE.PerspectiveCamera();
  scene.environment = new THREE.Texture(); scene.fog = new THREE.FogExp2();
  const sun = new THREE.DirectionalLight(); sun.castShadow = true;
  scene.add(sun, new THREE.DirectionalLight(), new THREE.HemisphereLight());
  const city = new THREE.Group(); city.add(new THREE.PointLight(0xffffff, 10)); scene.add(city);
  const cast = new THREE.Group(), hero = new THREE.Group(), geometry = new THREE.BoxGeometry(), material = new THREE.MeshStandardMaterial();
  const skin = new THREE.SkinnedMesh(geometry, material); hero.add(skin); cast.add(hero); cast.visible = false; scene.add(cast);
  const journey = { scene: 'm1_office_escape', actor: 'neo', step: 3, completed: [],
    office: { outcome: 'captured', custody: { phase: 'street', street: { phase: 'done', elapsed: 0 } } } } as FilmJourney;
  const batches: THREE.Object3D[][] = [], rooms = new Set<THREE.Group>(), work: string[] = [];
  const programs: { program: object; isReady(): boolean; getUniforms(): void }[] = [];
  let target: THREE.WebGLRenderTarget | null = null;
  const gpu = { properties: { get: () => ({}) }, info: { programs }, debug: { checkShaderErrors: true }, extensions: { has: () => true },
    getContext: () => ({ LINK_STATUS: 0x8b82, getProgramParameter: () => true }),
    getRenderTarget: () => target, setRenderTarget: (value: typeof target) => { target = value; },
    compile(subject: THREE.Object3D, eye: THREE.Camera, lights: THREE.Scene) {
      assert.notEqual(lights, scene); assert.equal(lights.environment, scene.environment); assert.equal(lights.fog, scene.fog);
      assert.equal(eye, camera); assert.equal(target?.width, 1);
      const points: THREE.PointLight[] = [], spots: THREE.SpotLight[] = [];
      let directionalShadows = 0;
      lights.traverseVisible(object => {
        if (object instanceof THREE.PointLight) points.push(object);
        if (object instanceof THREE.SpotLight) {
          spots.push(object);
          assert.ok(object.parent instanceof THREE.Group);
          assert.notEqual(object.parent.parent, film.root);
          rooms.add(object.parent);
        }
        if (object instanceof THREE.DirectionalLight && object.castShadow) directionalShadows++;
      });
      assert.equal(points.length, 2); assert.equal(spots.length, 2); assert.equal(directionalShadows, 1);
      assert.ok(spots.every(spot => spot.castShadow));
      const batch: THREE.Object3D[] = []; subject.traverse(mesh => batch.push(mesh));
      assert.ok(batch.length > 0 && batch.length <= 4);
      batches.push(batch); work.push('compile');
      programs.push({ program: {}, isReady: () => true, getUniforms: () => {
        assert.equal(gpu.debug.checkShaderErrors, false); work.push('uniforms');
      } });
    },
    initTexture() { work.push('texture'); },
  } as unknown as THREE.WebGLRenderer;
  function prepare() {
    const count = work.length;
    film.prepareInterrogation(gpu, camera, journey, id => id === 'neo' ? hero : undefined, sun);
    assert.ok(work.length - count <= 1);
    assert.equal(target, null); assert.equal(hero.parent, cast); assert.equal(cast.visible, false); assert.equal(skin.parent, hero);
  }
  function drain() { for (let i = 0; i < 100; i++) prepare(); }
  t.after(() => { film.dispose(); geometry.dispose(); material.dispose(); scene.environment!.dispose(); globalThis.document = previous; });
  return { film, journey, rooms, work, batches, skin, prepare, drain };
}

test('sedan departure prepares the real interview room and cast in batches, then reuses the room at the cut', t => {
  const h = fixture(t);
  h.drain(); assert.equal(h.rooms.size, 0); assert.equal(h.work.length, 0);
  h.journey.office!.custody!.street!.phase = 'departing';
  h.drain(); assert.equal(h.rooms.size, 1); assert.ok(h.batches.flat().includes(h.skin));
  assert.equal(h.work.filter(entry => entry === 'uniforms').length, h.batches.length);
  const room = [...h.rooms][0];
  assert.notEqual(room.parent, h.film.root);
  const mesh = room.children.find(child => child instanceof THREE.Mesh) as THREE.Mesh;
  assert.ok(mesh);
  let disposed = 0; mesh.geometry.addEventListener('dispose', () => disposed++);
  const world = new WorldState(); new AgentManager(world).initializeAllAgents();
  const neo = world.agents.get('neo')!, center = FILM_SETS.film_agent_interrogation.center;
  neo.isInMatrix = true; neo.position = filmPosition('film_agent_interrogation', 0, 7);
  const journey = { ...h.journey, scene: 'm1_interrogation', step: 0 } as FilmJourney;
  h.film.update(neo, { neoLife: { journey } } as SandboxState, 0);
  assert.equal(room.parent, h.film.root); assert.equal(disposed, 0);
  assert.deepEqual(room.getWorldPosition(new THREE.Vector3()).toArray(), [center.x, center.y - 1, center.z]);
  h.film.update(undefined, undefined, 0); assert.equal(disposed, 1);
});

test('leaving the sedan route releases the detached interview room exactly once', t => {
  const h = fixture(t);
  h.journey.office!.custody!.street!.phase = 'departing';
  h.drain();
  const room = [...h.rooms][0];
  const mesh = room.children.find(child => child instanceof THREE.Mesh) as THREE.Mesh;
  let disposed = 0; mesh.geometry.addEventListener('dispose', () => disposed++);
  h.journey.visiting = 'm1_boss'; h.prepare();
  assert.equal(room.parent, null); assert.equal(disposed, 1);
  h.prepare(); h.film.dispose(); assert.equal(disposed, 1);
});
