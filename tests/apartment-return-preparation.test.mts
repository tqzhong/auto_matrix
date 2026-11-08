import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from 'three';
import { lifeRoomCenter, type FilmJourney } from '@auto_matrix/shared';
import { ApartmentSetRenderer } from '../packages/client/src/engine/ApartmentSetRenderer.js';

function fixture() {
  const scene = new THREE.Scene(), city = new THREE.Group(), home = new THREE.Group(), root = new THREE.Group(), actor = new THREE.Group();
  const center = lifeRoomCenter('neo_apartment')!;
  home.position.set(center.x, 0, center.z); home.add(root); city.add(home); city.visible = false; scene.add(city, actor);
  scene.environment = new THREE.Texture(); scene.fog = new THREE.FogExp2(0x18231e, .01);
  const sun = new THREE.DirectionalLight(); sun.castShadow = true; scene.add(sun, new THREE.DirectionalLight(), new THREE.HemisphereLight());
  const geometry = new THREE.BoxGeometry(), texture = new THREE.Texture({ width: 2048, height: 2048 }); texture.needsUpdate = true;
  const material = new THREE.MeshStandardMaterial({ map: texture }), basic = new THREE.MeshBasicMaterial();
  for (let i = 0; i < 5; i++) root.add(new THREE.Mesh(geometry, material));
  actor.add(new THREE.Mesh(geometry, material));
  const arms = new THREE.Mesh(geometry, material); arms.name = 'Tracking_arms'; arms.visible = false; actor.add(arms);
  const shirt = new THREE.Mesh(geometry, material); shirt.name = 'Tracking_shirt'; shirt.visible = false; actor.add(shirt);
  const hidden = new THREE.Mesh(geometry, material); hidden.visible = false; actor.add(hidden);
  const street = new THREE.InstancedMesh(geometry, basic, 1); street.position.copy(home.position); city.add(street);
  const roomLights = Array.from({ length: 8 }, (_, i) => new THREE.PointLight(0xffffff, i < 5 ? 80 : 0, 30));
  for (const light of roomLights) { light.position.set(0, 5, 0); light.visible = false; root.add(light); }
  const outside = new THREE.PointLight(0xffffff, 80, 24); outside.position.set(1650, 6, 786); city.add(outside);
  const landingLight = new THREE.SpotLight(0xffffff, 0, 30); landingLight.castShadow = true; landingLight.visible = false; landingLight.position.copy(home.position); city.add(landingLight);
  const apartment = Object.assign(Object.create(ApartmentSetRenderer.prototype), { root, cityLights: city, roomLights, landingLight }) as ApartmentSetRenderer;
  const work: string[] = [], batches: THREE.Object3D[][] = [], slots: number[] = [], programs: { program: object; isReady(): boolean; getUniforms(): void }[] = [];
  const camera = new THREE.PerspectiveCamera(58, 16 / 9, .5, 5000); camera.position.set(4737, 88, 4410); camera.updateMatrixWorld();
  const originalCamera = camera.matrixWorld.toArray();
  let ready = false, target: THREE.WebGLRenderTarget | null = null, disposals = 0, uploaded = new WeakMap<THREE.Texture, number>();
  const properties = () => ({ get: (map: THREE.Texture) => ({ __version: uploaded.get(map) }) });
  const renderer = {
    properties: properties(), info: { programs }, debug: { checkShaderErrors: true }, extensions: { has: () => true },
    getContext: () => ({ LINK_STATUS: 0x8b82, getProgramParameter: () => true }),
    getRenderTarget: () => target, setRenderTarget: (value: typeof target) => { target = value; },
    compile(subject: THREE.Object3D, eye: THREE.Camera, lights: THREE.Scene) {
      assert.ok(lights !== scene); assert.equal(lights.environment, scene.environment); assert.equal(lights.fog, scene.fog);
      assert.ok(eye !== camera && eye.position.distanceTo(home.position) < 20); assert.equal(target?.width, 1);
      const batch: THREE.Object3D[] = []; subject.traverse(o => batch.push(o));
      assert.ok(batch.length > 0 && batch.length <= 4); assert.ok(!batch.includes(hidden)); batches.push(batch);
      const selected: THREE.Light[] = []; lights.traverseVisible(o => { if (o instanceof THREE.Light) selected.push(o); });
      slots.push(selected.filter(o => o instanceof THREE.PointLight).length);
      assert.equal(selected.filter(o => o instanceof THREE.SpotLight && o.castShadow).length, 1);
      work.push('compile'); programs.push({ program: {}, isReady: () => ready, getUniforms: () => {
        assert.equal(renderer.debug.checkShaderErrors, false); work.push('bindings');
      } });
      target!.addEventListener('dispose', () => disposals++);
    },
    initTexture(map: THREE.Texture) { assert.equal(map, texture); work.push('texture'); uploaded.set(map, map.version); },
  } as unknown as THREE.WebGLRenderer;
  const journey = { scene: 'm1_pills', pills: { phase: 'taking', elapsed: 6, choice: 'blue' } } as FilmJourney;
  const prepare = () => {
    const before = work.length; apartment.prepareReturn(renderer, camera, scene, journey, actor);
    assert.ok(work.length - before <= 1, 'one compile, binding completion or texture upload per frame');
    assert.equal(renderer.getRenderTarget(), null); assert.equal(renderer.debug.checkShaderErrors, true);
    assert.equal(city.visible, false); assert.ok(roomLights.every(light => !light.visible));
    assert.equal(landingLight.visible, false); assert.equal(landingLight.intensity, 0);
    assert.equal(arms.visible, false); assert.equal(shirt.visible, false); assert.equal(arms.parent, actor);
    assert.deepEqual(camera.matrixWorld.toArray(), originalCamera);
  };
  const drain = () => { for (let i = 0; i < 80; i++) prepare(); };
  const cancel = () => { journey.scene = 'm1_mirror'; prepare(); };
  return { apartment, scene, city, root, actor, roomLights, journey, renderer, texture, work, batches, slots, arms, shirt, street, prepare, drain, cancel,
    ready: () => { ready = true; }, disposals: () => disposals,
    replaceGpu: () => { uploaded = new WeakMap(); renderer.properties = properties() as THREE.WebGLRenderer['properties']; },
    dispose: () => { cancel(); geometry.dispose(); material.dispose(); basic.dispose(); texture.dispose(); scene.environment!.dispose(); },
  };
}

test('blue pill return prepares the real home light layout and hidden return clothing without changing the live scene', t => {
  const h = fixture(); t.after(h.dispose);
  for (let i = 0; i < 5; i++) h.prepare(); assert.ok(h.batches.length > 0); assert.ok(!h.work.includes('bindings'));
  h.ready(); h.drain();
  const meshes = h.batches.flat(); for (const mesh of [h.arms, h.shirt, h.street]) assert.ok(meshes.includes(mesh), mesh.name || mesh.type);
  assert.ok(h.slots.every(slots => slots === 6)); assert.equal(h.work.filter(v => v === 'texture').length, 1);
  const count = h.work.length; h.drain(); assert.equal(h.work.length, count, 'completed preparation remains bounded');
});

test('return preparation follows the chosen branch, late maps, GPU replacement and cancellation', t => {
  const h = fixture(); t.after(h.dispose);
  h.journey.pills!.choice = 'red'; h.drain(); assert.deepEqual(h.work, []);
  h.journey.pills!.choice = 'blue'; h.journey.visiting = 'm1_pills'; h.drain(); assert.deepEqual(h.work, []); delete h.journey.visiting;
  h.texture.image = null; h.ready(); h.drain(); assert.equal(h.work.filter(v => v === 'texture').length, 0);
  h.texture.image = { width: 2048, height: 2048 }; h.drain(); assert.equal(h.work.filter(v => v === 'texture').length, 1);
  const first = h.batches.length; h.replaceGpu(); h.drain(); assert.equal(h.batches.length, first * 2); assert.equal(h.work.filter(v => v === 'texture').length, 2);
  const before = h.disposals(); h.cancel(); assert.ok(h.disposals() >= before);
  h.journey.scene = 'm1_pills'; h.prepare(); h.cancel(); assert.ok(h.disposals() > before, 'cancelling a pending preparation releases its scratch target');
});

test('daylight changing during the drink prepares the new home light layout', t => {
  const h = fixture(); t.after(h.dispose); h.ready(); h.drain();
  const night = h.batches.length; h.roomLights.slice(5).forEach(light => { light.intensity = 80; }); h.drain();
  assert.ok(h.batches.length > night); assert.ok(h.slots.slice(night).every(slots => slots === 8));
  const day = h.batches.length; h.roomLights.slice(5).forEach(light => { light.intensity = 0; }); h.drain();
  assert.ok(h.batches.length > day); assert.ok(h.slots.slice(day).every(slots => slots === 6));
});
