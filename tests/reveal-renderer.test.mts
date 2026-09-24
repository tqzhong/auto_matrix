import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from 'three';
import { FILM_SETS, filmObstacles, filmPosition, playerBlocked, type FilmJourney } from '@auto_matrix/shared';
import { ConstructRenderer, renderTargetPreviewImage } from '../packages/client/src/engine/ConstructRenderer.js';
import { DesertRenderer } from '../packages/client/src/engine/DesertRenderer.js';

const canvasDocument = () => ({
  createElement: () => ({ width: 0, height: 0, getContext: () => ({
    fillStyle: '', strokeStyle: '', lineWidth: 1, font: '', fillRect() {}, fillText() {}, beginPath() {}, arc() {}, ellipse() {}, fill() {}, stroke() {},
    createLinearGradient: () => ({ addColorStop() {} }),
  }) }),
}) as unknown as Document;

test('the Construct has physical red chairs, an authored CRT reveal and a separate armoury layout', t => {
  const savedDocument = globalThis.document; globalThis.document = canvasDocument();
  const root = new THREE.Group(); const renderer = new ConstructRenderer(root, 'm1_construct');
  try {
    assert.ok(root.getObjectByName('construct-infinite-floor'));
    assert.ok(root.getObjectByName('construct-chair-neo'));
    assert.ok(root.getObjectByName('construct-chair-morpheus'));
    assert.ok(root.getObjectByName('construct-television-screen'));
    assert.ok(root.getObjectByName('construct-remote'), 'the physical remote is visible on the table that starts the lesson');
    const light = root.getObjectByName('construct-screen-light') as THREE.PointLight;
    const journey = { version: 1, scene: 'm1_construct', step: 0, actor: 'neo', completed: [], enteredAt: 0, checkpoint: filmPosition('film_white_construct'), reflections: {}, lastText: '',
      awakening: { kind: 'construct', elapsed: 0, started: false } } satisfies FilmJourney;
    renderer.update(journey); const waiting = light.intensity;
    journey.awakening.started = true; journey.awakening.elapsed = 10; renderer.update(journey);
    assert.ok(light.intensity > waiting * 4, 'the ruined television must visibly light the actors instead of changing only text');
    const screen = root.getObjectByName('construct-television-screen') as THREE.Mesh<THREE.PlaneGeometry, THREE.MeshBasicMaterial>;
    const paintedMap = screen.material.map;
    const previousTarget = new THREE.WebGLRenderTarget(1, 1); let activeTarget: THREE.WebGLRenderTarget | null = previousTarget;
    let previewScene: THREE.Scene | undefined; let previewCamera: THREE.Camera | undefined;
    const webgl = {
      getRenderTarget: () => activeTarget,
      setRenderTarget: (target: THREE.WebGLRenderTarget | null) => { activeTarget = target; },
      render: (scene: THREE.Scene, camera: THREE.Camera) => { previewScene = scene; previewCamera = camera; },
    } as unknown as THREE.WebGLRenderer;
    globalThis.document = savedDocument;
    assert.equal(renderer.renderPreview(webgl), true, 'the television captures the playable desert instead of retaining a painted stand-in');
    assert.ok(previewScene?.getObjectByName('desert-ruined-skyline'));
    assert.ok(previewScene?.getObjectByName('desert-harvest-towers'));
    assert.ok(previewCamera && (previewCamera as THREE.PerspectiveCamera).position.z > 30, 'the preview looks down the same route as Neo on arrival');
    assert.notEqual(screen.material.map, paintedMap);
    assert.equal(screen.material.map?.isRenderTargetTexture, true);
    assert.equal(activeTarget, previousTarget, 'offscreen rendering restores the game render target');
    previousTarget.dispose();
  } finally { renderer.dispose(); globalThis.document = savedDocument; }

  globalThis.document = canvasDocument(); const armouryRoot = new THREE.Group(); const armoury = new ConstructRenderer(armouryRoot, 'm1_guns');
  try {
    assert.ok(armouryRoot.getObjectByName('construct-weapon-racks'));
    assert.equal(armouryRoot.getObjectByName('construct-chair-neo'), undefined, 'the later loadout scene must not retain invisible lesson furniture');
    armoury.update({ scene: 'm1_guns', rescue: { phase: 'racks_arriving', elapsed: 1 } } as FilmJourney);
    assert.ok((armouryRoot.getObjectByName('construct-screen-light') as THREE.PointLight).intensity >= 140,
      'the later armoury keeps its bright loading-space lighting');
  } finally { armoury.dispose(); globalThis.document = savedDocument; }
});

test('the desert reveal has a walkable overlook, collidable ruins, ash and operating harvesting towers', () => {
  const root = new THREE.Group(); const renderer = new DesertRenderer(root); root.updateMatrixWorld(true);
  try {
    assert.ok(root.getObjectByName('desert-cracked-ground'));
    assert.ok(root.getObjectByName('desert-ruined-skyline'));
    assert.ok(root.getObjectByName('desert-collapsed-overpass'));
    assert.ok(root.getObjectByName('desert-harvest-towers'));
    const groundUv = (root.getObjectByName('desert-cracked-ground') as THREE.Mesh).geometry.attributes.uv;
    assert.ok(Math.abs(groundUv.getX(groundUv.count - 1) - groundUv.getX(0)) > 30, 'the walkable ground tiles its surface instead of stretching one image across the entire wasteland');
    assert.ok(root.getObjectByName('desert-ruined-skyline')!.children.some(child => {
      const uv = (child as THREE.Mesh).geometry.attributes.uv;
      for (let i = 0; i < uv.count; i++) if (Math.abs(uv.getY(i)) > 5) return true;
      return false;
    }), 'ruin walls preserve metre-scale texture coordinates after facade batching');
    const facade = new THREE.Raycaster(new THREE.Vector3(-18, 7.5, 42), new THREE.Vector3(0, 0, -1), 0, 1.2);
    assert.equal(facade.intersectObjects(root.getObjectByName('desert-ruined-skyline')!.children, true).length, 0,
      'ruined towers need open window bays instead of solid stacked boxes');
    const lowerWall = new THREE.Raycaster(new THREE.Vector3(-18, 1.1, 42), new THREE.Vector3(0, 0, -1), 0, 1.2);
    assert.ok(lowerWall.intersectObjects(root.getObjectByName('desert-ruined-skyline')!.children, true).length > 0,
      'the ground-floor ruin must visibly block the same footprint as server collision');
    const ash = root.getObjectByName('desert-falling-ash') as THREE.Points;
    assert.ok(ash.geometry.attributes.position.count >= 1500);
    for (const z of [35, 0, -28, -45]) assert.equal(playerBlocked(filmPosition('film_real_desert', 0, z), false), false, `the central reveal route stays open at ${z}`);
    const obstacle = filmObstacles(FILM_SETS.film_real_desert)[0];
    assert.equal(playerBlocked(filmPosition('film_real_desert', obstacle.x, obstacle.z), false), true, 'rendered ruins share their footprint with server collision');
    const journey = { version: 1, scene: 'm1_desert', step: 1, actor: 'neo', completed: [], enteredAt: 0, checkpoint: filmPosition('film_real_desert'), reflections: {}, lastText: '',
      awakening: { kind: 'desert', elapsed: 8, started: true } } satisfies FilmJourney;
    const before = ash.geometry.attributes.position.getY(0); renderer.update(journey, 8);
    assert.ok(ash.geometry.attributes.position.getY(0) < before, 'ash moves through the saved reveal instead of remaining a painted backdrop');
    const glow = (root.getObjectByName('desert-harvest-towers')!.getObjectByProperty('material', (renderer as unknown as { towerGlow: THREE.Material }).towerGlow) as THREE.Mesh | undefined);
    assert.ok(glow, 'harvesting towers expose real emissive machinery');
    const pods = root.getObjectByName('desert-harvester-pods') as THREE.InstancedMesh | undefined;
    assert.ok(pods?.isInstancedMesh && pods.count >= 90, 'harvesting towers need many visible pod bodies without one draw call per pod');
    const firstPod = new THREE.Matrix4(); pods.getMatrixAt(0, firstPod);
    const podBounds = new THREE.Box3().setFromBufferAttribute(pods.geometry.attributes.position).applyMatrix4(firstPod);
    assert.ok(podBounds.max.y - podBounds.min.y > 2, 'a pod must read as a suspended capsule at player distance');
    assert.ok(root.getObjectByName('desert-ruined-skyline')!.children.length <= 6, 'the rebuilt city must remain batched at player distance');
  } finally { renderer.dispose(); }
});

test('the television preview can become a correctly oriented transition frame', () => {
  const savedDocument = globalThis.document; let captured: Uint8ClampedArray | undefined;
  globalThis.document = { createElement: () => ({ width: 0, height: 0,
    getContext: () => ({ createImageData: (width: number, height: number) => ({ data: new Uint8ClampedArray(width * height * 4) }),
      putImageData: (image: { data: Uint8ClampedArray }) => { captured = image.data; } }),
    toDataURL: () => 'data:image/webp;base64,preview' }) } as unknown as Document;
  const target = new THREE.WebGLRenderTarget(1, 2);
  const webgl = { readRenderTargetPixels: (_target: THREE.WebGLRenderTarget, _x: number, _y: number, _width: number, _height: number, pixels: Uint8Array) => {
    pixels.set([255, 0, 0, 255, 0, 0, 128, 255]);
  } } as unknown as THREE.WebGLRenderer;
  try {
    assert.equal(renderTargetPreviewImage(webgl, target), 'data:image/webp;base64,preview');
    assert.deepEqual(Array.from(captured!.slice(0, 4)), [0, 0, 188, 255], 'the bottom WebGL row becomes the top browser row with linear colour converted for CSS');
    assert.deepEqual(Array.from(captured!.slice(4, 8)), [255, 0, 0, 255]);
  } finally { target.dispose(); globalThis.document = savedDocument; }
});
