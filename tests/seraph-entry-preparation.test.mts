import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from 'three';
import { FILM_SCENE_BY_ID, filmEntry, filmPosition, type FilmJourney, type SandboxState } from '@auto_matrix/shared';
import { FilmSetRenderer } from '../packages/client/src/engine/FilmSetRenderer.js';
import { LightCulling } from '../packages/client/src/engine/LightCulling.js';
import { AgentManager } from '../packages/server/src/agents/AgentManager.js';
import { WorldState } from '../packages/server/src/world/WorldState.js';

test('boarding prepares the tea house depth, actor normals and ground shadow while retaining hidden Matrix clothing', t => {
  const previous = globalThis.document;
  const context = { fillRect() {}, strokeRect() {}, fillText() {}, beginPath() {}, moveTo() {}, lineTo() {}, closePath() {}, stroke() {}, fill() {}, ellipse() {},
    createLinearGradient: () => ({ addColorStop() {} }), createRadialGradient: () => ({ addColorStop() {} }),
    createImageData: (width: number, height: number) => ({ data: new Uint8ClampedArray(width * height * 4) }), putImageData() {} };
  globalThis.document = { createElement: () => ({ width: 0, height: 0, getContext: () => context }) } as unknown as Document;
  t.after(() => { globalThis.document = previous; });
  t.mock.method(THREE.TextureLoader.prototype, 'load', () => new THREE.Texture({ width: 1, complete: true }));
  const scene = new THREE.Scene(), sets = new FilmSetRenderer(scene), camera = new THREE.PerspectiveCamera();
  const source = new THREE.Scene(), lighting = new LightCulling(source); lighting.enabled = false;
  for (let i = 0; i < 7; i++) source.add(new THREE.PointLight());
  const sun = new THREE.DirectionalLight(); sun.castShadow = true; scene.add(sun);
  const world = new WorldState(); new AgentManager(world).initializeAllAgents(); const neo = world.agents.get('neo')!;
  Object.assign(neo, { position: filmPosition('film_zion_hangar', 9, 17), currentLocation: 'film_zion_hangar', isInMatrix: false });
  const journey: FilmJourney = { version: 1, scene: 'm2_departure', actor: 'neo', step: 4, completed: [], enteredAt: 0,
    reflections: {}, lastText: '', checkpoint: { ...neo.position } };
  const sandbox = { neoLife: { journey } } as SandboxState; sets.update(neo, sandbox, 0);
  const geometry = new THREE.BoxGeometry(), material = new THREE.MeshStandardMaterial(), cast = new Map<string, THREE.Group>();
  const head = new THREE.SkinnedMesh(geometry, material); head.name = 'Anatomical_head_and_hands'; head.castShadow = true;
  const coat = new THREE.SkinnedMesh(geometry, material); coat.name = 'Tailored_coat_upper'; coat.visible = false; coat.castShadow = true;
  const knit = new THREE.Mesh(geometry, material); knit.userData.reloadedHidden = true; knit.visible = false;
  const player = new THREE.Group(); player.add(head, coat, knit); cast.set('neo', player);
  const seraph = new THREE.Group(); seraph.visible = false;
  const faceGeometry = geometry.clone(); faceGeometry.morphAttributes.position = [geometry.attributes.position.clone()];
  const faceMaterial = new THREE.MeshStandardMaterial({ map: new THREE.Texture() });
  const detailed = ['head', 'body'].map(part => {
    const group = new THREE.Group(); group.name = 'seraph-detailed-' + part;
    const mesh = part === 'head' ? new THREE.Mesh(faceGeometry, faceMaterial) : new THREE.SkinnedMesh(geometry, material);
    mesh.name = 'seraph-anatomical-' + part; mesh.castShadow = true;
    group.add(mesh); seraph.add(group); return mesh;
  });
  cast.set('seraph', seraph);
  const shadowMaterial = new THREE.MeshBasicMaterial({ transparent: true, toneMapped: false }), shadow = new THREE.Mesh(geometry, shadowMaterial);
  let releasedShadow = 0, colorSun = false; shadowMaterial.addEventListener('dispose', () => releasedShadow++);
  const compiled = new Set<THREE.Object3D>(), depths = new Set<THREE.MeshDepthMaterial>(), slots = new Set<number>();
  const depthPasses: { geometry: THREE.BufferGeometry; points: number }[] = [];
  const graphics = { extensions: { has: () => true }, info: { programs: [] }, properties: { get: () => ({}) },
    shadowMap: { enabled: true, type: THREE.PCFSoftShadowMap }, getRenderTarget: () => null, setRenderTarget() {}, initTexture() {},
    compile(subject: THREE.Object3D, _camera: THREE.Camera, target: THREE.Scene) {
      let points = 0, shadowSun = false; target.traverseVisible(object => { if (object instanceof THREE.PointLight) points++; if (object instanceof THREE.DirectionalLight && object.castShadow) shadowSun = true; });
      subject.traverse(object => {
        compiled.add(object);
        if (object instanceof THREE.Mesh && object.material instanceof THREE.MeshDepthMaterial) {
          depths.add(object.material); slots.add(points); depthPasses.push({ geometry: object.geometry, points });
        }
        else if (object instanceof THREE.Mesh) colorSun ||= shadowSun;
      });
    } } as unknown as THREE.WebGLRenderer;
  t.after(() => { sets.dispose(); lighting.dispose(); geometry.dispose(); faceGeometry.dispose(); faceMaterial.map!.dispose(); faceMaterial.dispose(); material.dispose(); shadowMaterial.dispose(); });
  const before = JSON.stringify(journey);
  for (let frame = 0; frame < 180; frame++) sets.prepareSecondOracle(graphics, camera, journey, id => cast.get(id), false, undefined,
    id => id === 'neo' ? { shadow } : {}, lighting, sun);
  assert.ok(depths.size > 0, 'boarding must prepare the first tea house shadow passes');
  assert.deepEqual([...slots].sort((a, b) => a - b), [7, 11]);
  assert.ok(compiled.has(shadow), 'the contact shadow uses a different Basic program from the objective');
  assert.ok(compiled.has(coat), 'the future Matrix coat must still prepare while hidden in Zion'); assert.ok(!compiled.has(knit));
  assert.ok([head, detailed[1]].every(mesh => sets.secondOracleEntryNormalMeshes?.includes(mesh)));
  assert.deepEqual(depthPasses.filter(pass => pass.geometry === faceGeometry).map(pass => pass.points), [7, 11]);
  assert.ok(colorSun); assert.equal(coat.visible, false); assert.equal(seraph.visible, false); assert.equal(JSON.stringify(journey), before);
  let released = 0; for (const depth of depths) depth.addEventListener('dispose', () => released++);
  Object.assign(journey, { scene: 'm2_seraph', step: 0 });
  Object.assign(neo, { position: filmEntry(FILM_SCENE_BY_ID.m2_seraph), currentLocation: 'film_seraph_teahouse', isInMatrix: true });
  sets.update(neo, sandbox, 1); assert.equal(released, 0);
  sets.update(undefined, undefined, 2); assert.equal(released, depths.size); assert.equal(releasedShadow, 0, 'the live actor still owns its shared shadow material');
});
