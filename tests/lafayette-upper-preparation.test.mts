import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from 'three';
import { FILM_SETS, type FilmJourney } from '@auto_matrix/shared';
import { FilmSetRenderer } from '../packages/client/src/engine/FilmSetRenderer.js';
import { LightCulling } from '../packages/client/src/engine/LightCulling.js';

function fixture() {
  const scene = new THREE.Scene(), root = new THREE.Group(), actors = [new THREE.Group(), new THREE.Group()] as const;
  scene.add(root, ...actors);
  scene.fog = new THREE.FogExp2(0x18231e, .01);
  const environment = new THREE.Texture(); scene.environment = environment;
  const texture = new THREE.Texture({ width: 2048, height: 2048 }); texture.needsUpdate = true;
  const geometry = new THREE.BoxGeometry(), material = new THREE.MeshStandardMaterial({ map: texture });
  for (const [index, group] of [...actors, root].entries()) for (let i = 0; i < 5; i++) {
    const mesh = new THREE.Mesh(geometry, material); mesh.name = `${index}:${i}`; group.add(mesh);
  }
  const hidden = new THREE.Mesh(geometry, material); hidden.visible = false; root.add(hidden);
  const lights = Array.from({ length: 8 }, () => new THREE.PointLight(0xffffff, 10, 20));
  const off = new THREE.PointLight(0xf6d99c, 0, 5); off.visible = false; scene.add(...lights, off);
  const markerMaterial = new THREE.MeshBasicMaterial();
  const marker = new THREE.Mesh(geometry, markerMaterial); marker.visible = false; scene.add(marker);
  const film = Object.assign(Object.create(FilmSetRenderer.prototype), {
    scene, root, marker, markerLight: off, hotel: { root }, current: FILM_SETS.film_lafayette, textures: new Set([texture]),
  }) as FilmSetRenderer;
  const lighting = new LightCulling(scene), camera = new THREE.PerspectiveCamera();
  const journey = { scene: 'm1_pills' } as FilmJourney;
  const work: string[] = [], batches: { slots: number; meshes: THREE.Object3D[] }[] = [];
  const programs: { program: object; isReady(): boolean; getUniforms(): void }[] = [];
  let ready = false, target: THREE.WebGLRenderTarget | null = null, uploaded = new WeakMap<THREE.Texture, number>();
  const properties = () => ({ get: (map: THREE.Texture) => ({ __version: uploaded.get(map) }) });
  const renderer = {
    info: { programs }, properties: properties(), debug: { checkShaderErrors: true }, extensions: { has: () => true },
    getContext: () => ({ LINK_STATUS: 0x8b82, getProgramParameter: () => true }),
    getRenderTarget: () => target, setRenderTarget: (value: typeof target) => { target = value; },
    compile(subject: THREE.Object3D, eye: THREE.Camera, colorScene: THREE.Scene) {
      assert.ok(colorScene !== scene); assert.equal(eye, camera); assert.equal(colorScene.fog, scene.fog); assert.equal(colorScene.environment, environment);
      assert.equal(target?.width, 1);
      const meshes: THREE.Object3D[] = []; subject.traverse(object => meshes.push(object));
      let slots = 0; colorScene.traverseVisible(object => { if (object instanceof THREE.PointLight) slots++; });
      assert.ok(meshes.length > 0 && meshes.length <= 4); assert.ok(!meshes.includes(hidden));
      assert.equal(marker.visible, false, 'preparing the marker material must not display its ring');
      assert.equal(off.intensity, 0, 'preparation must not turn on the chair light');
      batches.push({ slots, meshes }); work.push('compile');
      programs.push({ program: {}, isReady: () => ready, getUniforms: () => {
        assert.equal(renderer.debug.checkShaderErrors, false); work.push('bindings');
      } });
    },
    initTexture(map: THREE.Texture) { work.push('texture'); uploaded.set(map, map.version); },
  } as unknown as THREE.WebGLRenderer;
  const prepare = (height = 15) => {
    const before = work.length;
    film.prepareLafayetteUpper(renderer, camera, lighting, journey, height, actors);
    assert.ok(work.length - before <= 1, 'one compile, binding or texture upload per frame');
    assert.equal(renderer.getRenderTarget(), null); assert.equal(lighting.enabled, true);
    assert.ok(lights.every(light => light.visible && light.intensity === 10)); assert.equal(off.visible, false);
    assert.equal(marker.visible, false); assert.equal(off.intensity, 0);
    assert.equal(renderer.debug.checkShaderErrors, true);
  };
  return { scene, root, marker, actors, film, renderer, lighting, journey, texture, work, batches, prepare,
    ready: () => { ready = true; },
    replaceGpu: () => { uploaded = new WeakMap(); renderer.properties = properties() as THREE.WebGLRenderer['properties']; },
    dispose: () => { lighting.dispose(); geometry.dispose(); material.dispose(); markerMaterial.dispose(); texture.dispose(); environment.dispose(); },
  };
}

test('upper Lafayette prepares the future chair light and both stair layouts, one operation per frame', t => {
  const h = fixture(); t.after(h.dispose);
  for (let i = 0; i < 4; i++) h.prepare();
  assert.deepEqual(h.batches.map(batch => batch.slots), [9, 9, 9, 9]);
  assert.equal(h.work.includes('bindings'), false, 'unfinished links never query binding locations');
  h.ready(); for (let i = 0; i < 32; i++) h.prepare();
  assert.deepEqual(h.batches.map(batch => batch.slots), [9, 9, 9, 9, 8, 8, 8, 8, 4, 4, 4, 4]);
  const expected = [...h.actors, h.root].flatMap(group => group.children.filter(object => object.visible)).concat(h.marker);
  for (const start of [0, 4, 8]) assert.deepEqual(h.batches.slice(start, start + 4).flatMap(batch => batch.meshes), expected);
  assert.equal(h.work.filter(v => v === 'bindings').length, 12);
  assert.equal(h.work.filter(v => v === 'texture').length, 1);
  const count = h.work.length;
  t.mock.method(h.scene, 'traverseVisible', () => assert.fail('completed preparation must stop traversing the scene'));
  for (let i = 0; i < 8; i++) h.prepare(); assert.equal(h.work.length, count);
});

test('upper preparation waits for the right phase and decoded room maps, then rebuilds for a new GPU', t => {
  const h = fixture(); t.after(h.dispose);
  h.prepare(8); h.journey.visiting = 'm1_pills'; h.prepare(); delete h.journey.visiting;
  h.texture.image = null; h.prepare(); assert.deepEqual(h.work, []);
  h.texture.image = { width: 2048, height: 2048 }; h.ready(); for (let i = 0; i < 40; i++) h.prepare();
  assert.equal(h.work.filter(v => v === 'texture').length, 1);
  h.replaceGpu(); for (let i = 0; i < 40; i++) h.prepare();
  assert.equal(h.work.filter(v => v === 'texture').length, 2);
  assert.equal(h.batches.length, 24);
  const count = h.work.length; h.journey.scene = 'm1_mirror'; h.prepare(); assert.equal(h.work.length, count);
});
