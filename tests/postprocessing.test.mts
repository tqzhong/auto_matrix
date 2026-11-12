import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from 'three';
import { GTAOPass } from 'three/addons/postprocessing/GTAOPass.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { FXAAShader } from 'three/addons/shaders/FXAAShader.js';
import { Reflector } from 'three/addons/objects/Reflector.js';
import { WebGLRenderStates } from 'three/src/renderers/webgl/WebGLRenderStates.js';
import { Engine } from '../packages/client/src/engine/Engine.js';
import { PostProcessing, WorldOcclusionPass } from '../packages/client/src/engine/PostProcessing.js';
import { MachineCityRenderer } from '../packages/client/src/engine/MachineCityRenderer.js';
import { PodSetRenderer } from '../packages/client/src/engine/PodSetRenderer.js';

test('changing render quality resizes both compositor buffers, occlusion and antialias sampling', () => {
  const renderer = { getPixelRatio: () => 1.5, getSize: (size: THREE.Vector2) => size.set(1280, 720) } as THREE.WebGLRenderer;
  const composer = new EffectComposer(renderer);
  const occlusion = new WorldOcclusionPass(new THREE.Scene(), new THREE.PerspectiveCamera(), 1280, 720);
  const antialias = new ShaderPass(FXAAShader); composer.addPass(occlusion); composer.addPass(antialias);
  const post = Object.assign(Object.create(PostProcessing.prototype), { composer, antialias, pixelRatio: 1.5 }) as PostProcessing;
  const check = (width: number, height: number) => {
    for (const target of [composer.readBuffer, composer.writeBuffer, occlusion.normalRenderTarget, occlusion.gtaoRenderTarget]) {
      assert.equal(target.width, width); assert.equal(target.height, height);
    }
    assert.deepEqual(antialias.uniforms.resolution.value.toArray(), [1 / width, 1 / height]);
  };
  try {
    post.resize(1280, 720, .75); check(960, 540);
    post.resize(800, 600); check(600, 450);
    post.resize(1280, 720, 1.5); check(1920, 1080);
  } finally { occlusion.dispose(); antialias.dispose(); composer.dispose(); }
});

test('fullscreen color passes keep depth only on the scene and normal targets', () => {
  const previousWindow = globalThis.window;
  globalThis.window = { innerWidth: 1920, innerHeight: 1080 } as Window & typeof globalThis;
  const renderer = { getPixelRatio: () => 1, getSize: (size: THREE.Vector2) => size.set(1920, 1080) } as THREE.WebGLRenderer;
  let post: PostProcessing | undefined;
  try {
    post = new PostProcessing(renderer, new THREE.Scene(), new THREE.PerspectiveCamera());
    const composer = post['composer'], fxaa = post['antialias'], bloom = post['bloom'];
    assert.equal(composer.passes.at(-1), fxaa);
    assert.deepEqual([fxaa.material.depthTest, fxaa.material.depthWrite], [false, false]);
    const bloomTargets = [bloom.renderTargetBright, ...bloom.renderTargetsHorizontal, ...bloom.renderTargetsVertical];
    const colorMaterials = [bloom.materialHighPassFilter, ...bloom.separableBlurMaterials, bloom.compositeMaterial, bloom.blendMaterial, post['output'].material];
    for (const material of colorMaterials) assert.deepEqual([material.depthTest, material.depthWrite], [false, false]);
    for (const size of [[1920, 1080], [1280, 720]] as const) {
      post.resize(...size);
      assert.deepEqual([bloomTargets[0].width, bloomTargets[0].height], [size[0] / 2, size[1] / 2]);
      assert.ok(bloomTargets.every(target => !target.depthBuffer));
      assert.deepEqual([composer.readBuffer.depthBuffer, composer.writeBuffer.depthBuffer], [true, false]);
    }
    assert.equal(post['occlusion'].normalRenderTarget.depthBuffer, true);
  } finally { post?.dispose(); globalThis.window = previousWindow; }
});

test('disposing the compositor releases the occlusion and bloom filter materials', t => {
  const previousWindow = globalThis.window;
  globalThis.window = { innerWidth: 64, innerHeight: 64 } as Window & typeof globalThis;
  const renderer = { getPixelRatio: () => 1, getSize: (size: THREE.Vector2) => size.set(64, 64) } as THREE.WebGLRenderer;
  try {
    const post = new PostProcessing(renderer, new THREE.Scene(), new THREE.PerspectiveCamera());
    const occlusion = post['occlusion'], bloom = post['bloom'];
    const materials = [occlusion.gtaoMaterial, occlusion.blendMaterial, bloom.materialHighPassFilter];
    const disposals = materials.map(material => t.mock.method(material, 'dispose'));
    post.dispose();
    assert.deepEqual(disposals.map(dispose => dispose.mock.callCount()), [1, 1, 1]);
  } finally { globalThis.window = previousWindow; }
});

test('engine teardown releases the environment before retiring the renderer and its WebGL context', t => {
  const previousWindow = globalThis.window, previousCancel = globalThis.cancelAnimationFrame;
  const calls: string[] = [];
  globalThis.window = new EventTarget() as Window & typeof globalThis;
  globalThis.cancelAnimationFrame = () => { calls.push('cancel frame'); };
  t.after(() => { globalThis.window = previousWindow; globalThis.cancelAnimationFrame = previousCancel; });
  const resource = { dispose() {} };
  const mesh = { geometry: resource, material: resource };
  const engine = Object.assign(Object.create(Engine.prototype), {
    animationId: 1, resize() {}, rain: mesh, eventRing: mesh,
    environment: { dispose: () => calls.push('environment') },
    renderer: { dispose: () => calls.push('renderer'), forceContextLoss: () => calls.push('context') },
  });
  for (const name of ['pillReflection', 'openingTrace', 'filmSets', 'voxelRenderer', 'sandboxRenderer', 'agentRenderer', 'cameraController',
    'combatEffects', 'audio', 'lightCulling', 'lightingSystem', 'particleSystem', 'postProcessing']) engine[name] = resource;
  engine.dispose();
  assert.deepEqual(calls, ['cancel frame', 'environment', 'renderer', 'context']);
});

test('the scene starts on the same depth target after the occlusion comparison path swaps buffers', t => {
  const previousWindow = globalThis.window;
  globalThis.window = { innerWidth: 1920, innerHeight: 1080 } as Window & typeof globalThis;
  const renderer = { getPixelRatio: () => 1, getSize: (size: THREE.Vector2) => size.set(1920, 1080),
    shadowMap: { autoUpdate: true, needsUpdate: false },
    getRenderTarget: () => null, setRenderTarget: () => {} } as unknown as THREE.WebGLRenderer;
  const post = new PostProcessing(renderer, new THREE.Scene(), new THREE.PerspectiveCamera());
  try {
    const composer = post['composer'], [scene, , bloom, output, fxaa] = composer.passes;
    const sceneTargets: THREE.WebGLRenderTarget[] = [];
    t.mock.method(scene, 'render', (_renderer, _write, read) => { sceneTargets.push(read); });
    t.mock.method(GTAOPass.prototype, 'renderOverride', () => {});
    t.mock.method(GTAOPass.prototype, 'renderPass', () => {});
    for (const pass of [bloom, output, fxaa]) t.mock.method(pass, 'render', () => {});
    post.occlusionInPlace = false;
    post.render();
    post.render();
    post.occlusionInPlace = true;
    post.render(false);
    assert.equal(sceneTargets.length, 3);
    assert.ok(sceneTargets.every(target => target === composer.renderTarget2));
  } finally { post.dispose(); globalThis.window = previousWindow; }
});

test('default occlusion multiplies the existing color without copying or swapping it', t => {
  const pass = new WorldOcclusionPass(new THREE.Scene(), new THREE.PerspectiveCamera(), 64, 64);
  const renderer = { shadowMap: { autoUpdate: true, needsUpdate: false } } as THREE.WebGLRenderer;
  const read = new THREE.WebGLRenderTarget(64, 64), write = read.clone();
  const draws: { material: THREE.ShaderMaterial; target: THREE.WebGLRenderTarget | null }[] = [];
  t.mock.method(GTAOPass.prototype, 'renderOverride', () => {});
  t.mock.method(GTAOPass.prototype, 'renderPass', (_renderer, material, target) => { draws.push({ material, target }); });
  try {
    pass.render(renderer, write, read, 0, false);
    assert.deepEqual(draws.map(draw => draw.material), [pass.gtaoMaterial, pass.pdMaterial, pass.blendMaterial]);
    assert.equal(draws[2].target, read, 'the original scene color is already in the read buffer');
    assert.equal(pass.blendMaterial.uniforms.tDiffuse.value, pass.pdRenderTarget.texture, 'the blend samples a separate AO texture, never the destination color');
    assert.equal(pass.needsSwap, false, 'downstream passes must still read the buffer containing the scene');
  } finally { pass.dispose(); read.dispose(); write.dispose(); }
});

test('occlusion retains the original output buffers for debug, screen, stencil and comparison paths', t => {
  const pass = new WorldOcclusionPass(new THREE.Scene(), new THREE.PerspectiveCamera(), 64, 64);
  const renderer = { shadowMap: { autoUpdate: true, needsUpdate: false } } as THREE.WebGLRenderer;
  const read = new THREE.WebGLRenderTarget(64, 64), write = read.clone();
  const draws: { material: THREE.ShaderMaterial; target: THREE.WebGLRenderTarget | null }[] = [];
  t.mock.method(GTAOPass.prototype, 'renderOverride', () => {});
  t.mock.method(GTAOPass.prototype, 'renderPass', (_renderer, material, target) => { draws.push({ material, target }); });
  try {
    for (const output of Object.values(GTAOPass.OUTPUT)) {
      if (output === GTAOPass.OUTPUT.Default) continue;
      draws.length = 0; pass.output = output;
      pass.render(renderer, write, read, 0, false);
      assert.equal(pass.needsSwap, true);
      assert.ok(draws.every(draw => draw.target !== read), `debug output ${output} must not overwrite the scene color`);
    }
    pass.output = GTAOPass.OUTPUT.Default;
    for (const fallback of ['screen', 'stencil', 'comparison']) {
      draws.length = 0; pass.renderToScreen = fallback === 'screen'; pass.compositeInPlace = fallback !== 'comparison';
      pass.render(renderer, write, read, 0, fallback === 'stencil');
      assert.deepEqual(draws.map(draw => draw.material), [pass.gtaoMaterial, pass.pdMaterial, pass.copyMaterial, pass.blendMaterial]);
      assert.equal(draws[2].target, fallback === 'screen' ? null : write);
      assert.equal(draws[3].target, draws[2].target); assert.equal(pass.needsSwap, true);
    }
  } finally { pass.dispose(); read.dispose(); write.dispose(); }
});

test('occlusion clears the copy suppression after a render failure and can switch paths next frame', t => {
  const pass = new WorldOcclusionPass(new THREE.Scene(), new THREE.PerspectiveCamera(), 64, 64);
  const renderer = { shadowMap: { autoUpdate: true, needsUpdate: false } } as THREE.WebGLRenderer;
  const read = new THREE.WebGLRenderTarget(64, 64), write = read.clone();
  let fail = true, copies = 0;
  t.mock.method(GTAOPass.prototype, 'renderOverride', () => {});
  t.mock.method(GTAOPass.prototype, 'renderPass', (_renderer, material) => {
    if (fail && material === pass.gtaoMaterial) throw new Error('AO draw failed');
    if (material === pass.copyMaterial) copies++;
  });
  try {
    assert.throws(() => pass.render(renderer, write, read, 0, false), /AO draw failed/);
    fail = false; pass.renderPass(renderer, pass.copyMaterial, write);
    assert.equal(copies, 1, 'direct copy calls outside a render must never be suppressed');
    pass.compositeInPlace = false; pass.render(renderer, write, read, 0, false);
    assert.equal(copies, 2); assert.equal(pass.needsSwap, true);
    pass.compositeInPlace = true; pass.render(renderer, write, read, 0, false);
    assert.equal(copies, 2); assert.equal(pass.needsSwap, false);
  } finally { pass.dispose(); read.dispose(); write.dispose(); }
});

test('the occlusion pass skips hidden worlds and restores only the overlays it suppressed', t => {
  const scene = new THREE.Scene(); const hiddenWorld = new THREE.Group(); hiddenWorld.visible = false;
  const hiddenStreet = new THREE.Group(); hiddenStreet.add(new THREE.Sprite()); hiddenWorld.add(hiddenStreet); scene.add(hiddenWorld);
  const traverse = t.mock.method(hiddenStreet, 'traverse');
  const traverseVisible = t.mock.method(hiddenStreet, 'traverseVisible');
  const solid = new THREE.Mesh(new THREE.BoxGeometry(), new THREE.MeshBasicMaterial());
  const overlay = new THREE.Mesh(new THREE.PlaneGeometry(), new THREE.MeshBasicMaterial({ depthWrite: false }));
  const label = new THREE.Sprite(); const invisibleLabel = new THREE.Sprite(); invisibleLabel.visible = false;
  const line = new THREE.Line(); const points = new THREE.Points();
  scene.add(solid, overlay, label, invisibleLabel, line, points);
  const pass = new WorldOcclusionPass(scene, new THREE.PerspectiveCamera(), 64, 64);
  try {
    for (let frame = 0; frame < 2; frame++) {
      pass.overrideVisibility();
      assert.equal(solid.visible, true, 'solid geometry still contributes contact shadows');
      for (const object of [overlay, label, invisibleLabel, line, points]) assert.equal(object.visible, false);
      assert.equal(hiddenWorld.visible, false); assert.equal(hiddenStreet.children[0].visible, true);
      pass.restoreVisibility();
      for (const object of [solid, overlay, label, line, points]) assert.equal(object.visible, true);
      assert.equal(invisibleLabel.visible, false, 'a label hidden before the pass must stay hidden');
      assert.equal(hiddenWorld.visible, false);
    }
    assert.equal(traverse.mock.callCount() + traverseVisible.mock.callCount(), 0, 'a hidden city must not be walked for every occlusion pass');
    hiddenWorld.visible = true;
    pass.overrideVisibility(); assert.equal(hiddenStreet.children[0].visible, false, 'the same city participates after returning to it');
    pass.restoreVisibility(); assert.equal(hiddenStreet.children[0].visible, true);
  } finally {
    pass.dispose(); solid.geometry.dispose(); solid.material.dispose(); overlay.geometry.dispose(); overlay.material.dispose();
  }
});

test('normal rendering preserves the color lighting cache and the original scene callbacks and ownership', () => {
  const scene = new THREE.Scene(), camera = new THREE.PerspectiveCamera();
  scene.background = new THREE.Color(0x14231b); scene.environment = new THREE.Texture();
  scene.fog = new THREE.FogExp2(0x284334, .002);
  scene.environmentIntensity = .7; scene.backgroundRotation.set(.1, .2, .3); scene.environmentRotation.set(.3, .2, .1);
  scene.position.set(3, 4, 5);
  const light = new THREE.PointLight(), solid = new THREE.Mesh(new THREE.BoxGeometry(), new THREE.MeshStandardMaterial());
  scene.add(light, solid); scene.updateMatrixWorld(true);
  const pass = new WorldOcclusionPass(scene, camera, 64, 64);
  const states = new WebGLRenderStates({ has: () => false });
  const drawScenes: THREE.Scene[] = [];
  let fail = false, before = 0, after = 0;
  scene.onBeforeRender = (_renderer, view) => { assert.equal(view, scene); if (scene.overrideMaterial) before++; };
  scene.onAfterRender = (_renderer, view) => { assert.equal(view, scene); if (scene.overrideMaterial) after++; };
  const renderer = {
    shadowMap: { autoUpdate: true, needsUpdate: true }, autoClear: true,
    getClearColor: (color: THREE.Color) => color.set(0), getClearAlpha: () => 1,
    setRenderTarget() {}, setClearColor() {}, setClearAlpha() {}, clear() {},
    render(view: THREE.Scene, viewCamera: THREE.Camera) {
      view.onBeforeRender(this as unknown as THREE.WebGLRenderer, view, viewCamera, null!);
      const state = states.get(view); state.init(viewCamera);
      view.traverseVisible(object => {
        if (object instanceof THREE.Light && object.layers.test(viewCamera.layers)) state.pushLight(object);
      });
      state.setupLights();
      if (view.overrideMaterial) {
        drawScenes.push(view);
        assert.equal(view.overrideMaterial, pass.normalMaterial);
        assert.equal(scene.overrideMaterial, pass.normalMaterial, 'callbacks inspecting the original scene still see the normal pass');
        assert.equal(view.children, scene.children); assert.equal(solid.parent, scene);
        assert.deepEqual(view.matrixWorld.elements, scene.matrixWorld.elements);
        assert.equal(view.background, scene.background); assert.equal(view.environment, scene.environment); assert.equal(view.fog, scene.fog);
        assert.equal(view.environmentIntensity, scene.environmentIntensity);
        assert.deepEqual(view.backgroundRotation, scene.backgroundRotation); assert.deepEqual(view.environmentRotation, scene.environmentRotation);
        assert.equal(state.state.lights.state.point.length, 0, 'the normal program still excludes unused lights');
        if (fail) throw new Error('normal draw failed');
      }
      view.onAfterRender(this as unknown as THREE.WebGLRenderer, view, viewCamera);
    },
  } as unknown as THREE.WebGLRenderer;
  const drawNormals = () => {
    pass.overrideVisibility();
    try { pass.renderOverride(renderer, pass.normalMaterial, null); }
    finally { pass.restoreVisibility(); }
  };
  try {
    renderer.render(scene, camera);
    const colorState = states.get(scene).state.lights.state, version = colorState.version;
    assert.equal(colorState.point.length, 1);
    drawNormals();
    assert.equal(colorState.version, version, 'excluding normal-pass lights must not invalidate every color material on the next frame');
    assert.equal(colorState.point.length, 1, 'color uniforms keep their live light array');
    assert.deepEqual([before, after], [1, 1]);
    assert.equal(drawScenes[0].children.length, 0, 'the auxiliary view does not retain the active world between passes');
    assert.equal(pass.scene, scene); assert.equal(scene.overrideMaterial, null); assert.equal(solid.parent, scene);
    scene.background = new THREE.Color(0x345345); scene.fog = new THREE.FogExp2(0x748276, .001);
    scene.position.set(6, 7, 8); scene.updateMatrixWorld(true);
    drawNormals();
    fail = true;
    assert.throws(drawNormals, /normal draw failed/);
    assert.equal(colorState.version, version); assert.equal(colorState.point.length, 1);
    assert.equal(pass.scene, scene); assert.equal(scene.overrideMaterial, null); assert.equal(scene.matrixWorldAutoUpdate, true);
    assert.equal(drawScenes.at(-1)!.children.length, 0);
    assert.deepEqual([renderer.shadowMap.autoUpdate, renderer.shadowMap.needsUpdate, before, after], [true, true, 3, 2]);
  } finally { pass.dispose(); solid.geometry.dispose(); solid.material.dispose(); scene.environment.dispose(); }
});

test('the normals pass reuses this frame\'s matrices and shadows, then restores renderer settings', t => {
  const scene = new THREE.Scene(); const pass = new WorldOcclusionPass(scene, new THREE.PerspectiveCamera(), 64, 64);
  const renderer = { shadowMap: { autoUpdate: true, needsUpdate: true } } as THREE.WebGLRenderer;
  let fail = false;
  t.mock.method(GTAOPass.prototype, 'renderOverride', () => {
    assert.equal(scene.matrixWorldAutoUpdate, false, 'the preceding color pass already updated the same scene');
    assert.equal(renderer.shadowMap.autoUpdate, false, 'normals do not need a second shadow render');
    assert.equal(renderer.shadowMap.needsUpdate, false);
    if (fail) throw new Error('render failure');
  });
  try {
    pass.renderOverride(renderer, pass.normalMaterial, null);
    assert.equal(scene.matrixWorldAutoUpdate, true); assert.equal(renderer.shadowMap.autoUpdate, true); assert.equal(renderer.shadowMap.needsUpdate, true);
    fail = true; renderer.shadowMap.autoUpdate = false; renderer.shadowMap.needsUpdate = false;
    assert.throws(() => pass.renderOverride(renderer, pass.normalMaterial, null), /render failure/);
    assert.equal(scene.matrixWorldAutoUpdate, true); assert.equal(renderer.shadowMap.autoUpdate, false); assert.equal(renderer.shadowMap.needsUpdate, false);
  } finally { pass.dispose(); }
});

test('normal and depth rendering leaves light counts out of the shader while retaining attached geometry', t => {
  const scene = new THREE.Scene(), camera = new THREE.PerspectiveCamera();
  const point = new THREE.PointLight(), spot = new THREE.SpotLight();
  point.layers.enable(7); spot.layers.enable(11);
  const fixture = new THREE.Mesh(new THREE.BoxGeometry(), new THREE.MeshStandardMaterial());
  spot.add(fixture); scene.add(point, spot);
  const masks = [point.layers.mask, spot.layers.mask];
  const pass = new WorldOcclusionPass(scene, camera, 64, 64);
  const renderer = { shadowMap: { autoUpdate: true, needsUpdate: false } } as THREE.WebGLRenderer;
  const read = new THREE.WebGLRenderTarget(64, 64), write = read.clone();
  let fail = false;
  t.mock.method(GTAOPass.prototype, 'renderOverride', () => {
    const lights: THREE.Light[] = [], meshes: THREE.Mesh[] = [];
    scene.traverseVisible(object => {
      if (!object.layers.test(camera.layers)) return;
      if (object instanceof THREE.Light) lights.push(object);
      if (object instanceof THREE.Mesh) meshes.push(object);
    });
    assert.equal(lights.length, 0, 'lights should not create a new shader variant in the normal pass');
    assert.deepEqual(meshes, [fixture], 'excluding a light must keep its visible fixture in the normal image');
    if (fail) throw new Error('normal draw failed');
  });
  t.mock.method(GTAOPass.prototype, 'renderPass', () => {});
  try {
    pass.render(renderer, write, read, 0, false);
    assert.deepEqual([point.layers.mask, spot.layers.mask], masks);
    fail = true;
    assert.throws(() => pass.render(renderer, write, read, 0, false), /normal draw failed/);
    assert.deepEqual([point.layers.mask, spot.layers.mask], masks, 'a failed frame must restore the original color-pass layers');
  } finally { pass.dispose(); read.dispose(); write.dispose(); fixture.geometry.dispose(); fixture.material.dispose(); }
});

test('the Wells handoff prepares the apartment, cast and both instanced normal layouts offstage', t => {
  const scene = new THREE.Scene(), camera = new THREE.PerspectiveCamera(), actor = new THREE.Group(), city = new THREE.Group();
  const pass = new WorldOcclusionPass(scene, camera, 64, 64), geometry = new THREE.BoxGeometry(), surface = new THREE.MeshStandardMaterial();
  const overlay = new THREE.MeshBasicMaterial({ depthWrite: false });
  const room = new THREE.Mesh(geometry, surface), towers = new THREE.InstancedMesh(geometry, surface, 1);
  const signal = new THREE.InstancedMesh(geometry, surface, 1), shirt = new THREE.SkinnedMesh(geometry, surface);
  const ring = new THREE.Mesh(geometry, overlay), backdrop = new THREE.Mesh(geometry, surface);
  signal.setColorAt(0, new THREE.Color(0xff0000)); shirt.visible = false; backdrop.userData.distantBackdrop = true;
  scene.add(city, actor, new THREE.PointLight()); city.add(room, towers, signal, backdrop); actor.add(shirt, ring);
  city.visible = actor.visible = false;
  const surfaces = [room, towers, signal, shirt, ring, backdrop];
  const compiled = new Set<THREE.Object3D>(), programs: { program: object; isReady(): boolean; getUniforms(): void }[] = [];
  let target: THREE.WebGLRenderTarget | null = null, steps = 0;
  const renderer = { properties: {}, info: { programs }, extensions: { has: () => true }, debug: { checkShaderErrors: true },
    getContext: () => ({ LINK_STATUS: 0x8b82, getProgramParameter: () => true }),
    getRenderTarget: () => target, setRenderTarget: (next: typeof target) => { target = next; },
    compile(subject: THREE.Object3D, _eye: THREE.Camera, normalScene: THREE.Scene) {
      assert.equal(target, pass.normalRenderTarget); assert.notEqual(normalScene, scene); assert.deepEqual(normalScene.children, []);
      subject.traverse(mesh => { assert.equal((mesh as THREE.Mesh).material, pass.normalMaterial); compiled.add(mesh); });
      programs.push({ program: {}, isReady: () => true, getUniforms: () => { assert.equal(renderer.debug.checkShaderErrors, false); steps++; } });
      steps++;
    },
  } as unknown as THREE.WebGLRenderer;
  t.after(() => { pass.dispose(); geometry.dispose(); surface.dispose(); overlay.dispose(); });
  const prepare = () => pass.prepareNormals(renderer, actor, surfaces, true);
  prepare();
  assert.equal(steps, 1, 'compile the destination batch first');
  prepare();
  assert.equal(steps, 1, 'wait a frame after the driver reports the normal program ready');
  prepare();
  assert.equal(steps, 2, 'reflect the ready program on the following frame');
  for (let frame = 0; frame < 16; frame++) {
    const before = steps;
    prepare();
    assert.ok(steps - before <= 1);
    assert.equal(target, null); assert.equal(renderer.debug.checkShaderErrors, true);
    assert.equal(city.visible || actor.visible || shirt.visible, false);
    assert.deepEqual(surfaces.map(mesh => mesh.material), [surface, surface, surface, surface, overlay, surface]);
  }
  assert.deepEqual(compiled, new Set([room, towers, signal, shirt]));
  assert.ok(steps > 0 && steps <= 8, 'the destination only needs to be prepared once');
});

test('the normals pass draws mirror planes without rendering their reflected world and restores color reflections', t => {
  const scene = new THREE.Scene(), camera = new THREE.PerspectiveCamera();
  const mirror = new Reflector(new THREE.PlaneGeometry());
  const solid = new THREE.Mesh(new THREE.BoxGeometry(), new THREE.MeshBasicMaterial());
  scene.add(mirror, solid);
  const pass = new WorldOcclusionPass(scene, camera, 64, 64);
  const renderer = { shadowMap: { autoUpdate: true, needsUpdate: false } } as THREE.WebGLRenderer;
  const read = new THREE.WebGLRenderTarget(64, 64), write = read.clone();
  let reflectedWorlds = 0, solidCallbacks = 0, normalPlanes = 0;
  const reflect = mirror.onBeforeRender = () => { reflectedWorlds++; };
  solid.onBeforeRender = () => { solidCallbacks++; };
  t.mock.method(GTAOPass.prototype, 'renderOverride', () => {
    scene.traverseVisible(object => {
      if (!(object instanceof THREE.Mesh)) return;
      object.onBeforeRender(renderer, scene, camera, object.geometry, pass.normalMaterial, null);
      if (object === mirror) normalPlanes++;
    });
  });
  t.mock.method(GTAOPass.prototype, 'renderPass', () => {});
  try {
    pass.render(renderer, write, read, 0, false);
    assert.equal(normalPlanes, 1, 'the reflecting surface still occludes nearby geometry');
    assert.equal(solidCallbacks, 1, 'ordinary geometry retains its normal-pass callbacks');
    assert.equal(reflectedWorlds, 0, 'normal/depth rendering must not repeat the full reflected scene');
    assert.equal(mirror.onBeforeRender, reflect);
    mirror.onBeforeRender(renderer, scene, camera, mirror.geometry, mirror.material, null);
    assert.equal(reflectedWorlds, 1, 'the next color pass must still refresh the actual reflection');
  } finally { pass.dispose(); read.dispose(); write.dispose(); mirror.dispose(); mirror.geometry.dispose(); solid.geometry.dispose(); solid.material.dispose(); }
});

test('a failed normals render restores mirror callbacks and the visible overlays for the next color frame', t => {
  const scene = new THREE.Scene(), mirror = new Reflector(new THREE.PlaneGeometry()), overlay = new THREE.Sprite();
  scene.add(mirror, overlay);
  const reflect = mirror.onBeforeRender;
  const pass = new WorldOcclusionPass(scene, new THREE.PerspectiveCamera(), 64, 64);
  const renderer = { shadowMap: { autoUpdate: true, needsUpdate: false } } as THREE.WebGLRenderer;
  const read = new THREE.WebGLRenderTarget(64, 64), write = read.clone();
  t.mock.method(GTAOPass.prototype, 'renderOverride', () => { throw new Error('normal draw failed'); });
  try {
    assert.throws(() => pass.render(renderer, write, read, 0, false), /normal draw failed/);
    assert.equal(mirror.onBeforeRender, reflect, 'a failed frame cannot permanently freeze reflections');
    assert.equal(overlay.visible, true, 'the pass must release the overlay suppression even after failure');
  } finally { pass.dispose(); read.dispose(); write.dispose(); mirror.dispose(); mirror.geometry.dispose(); overlay.material.dispose(); }
});

test('occlusion selects the current camera detail before hiding glass after a more distant mirror view', () => {
  const scene = new THREE.Scene(), camera = new THREE.PerspectiveCamera();
  const detail = new THREE.LOD(), near = new THREE.Group(), far = new THREE.Group();
  const clear = new THREE.Mesh(new THREE.PlaneGeometry(), new THREE.MeshPhysicalMaterial({ transmission: .9, depthWrite: false }));
  const distant = new THREE.Mesh(clear.geometry, new THREE.MeshStandardMaterial({ transparent: true, opacity: .15, depthWrite: false }));
  near.add(clear); far.add(distant); detail.addLevel(near, 0); detail.addLevel(far, 12); scene.add(detail); scene.updateMatrixWorld(true);
  const mirrorCamera = new THREE.PerspectiveCamera(); mirrorCamera.position.z = 30; mirrorCamera.updateMatrixWorld(true); detail.update(mirrorCamera);
  camera.position.z = 3; camera.updateMatrixWorld(true);
  const pass = new WorldOcclusionPass(scene, camera, 64, 64);
  try {
    pass.overrideVisibility(); detail.update(camera);
    assert.equal(clear.visible, false, 'switching back from the mirror to the main view must not put refractive glass in the normals pass');
    pass.restoreVisibility();
    assert.equal(clear.visible, true, 'the close-up glass returns for the next color frame');
  } finally { pass.dispose(); clear.geometry.dispose(); clear.material.dispose(); distant.material.dispose(); }
});

test('distant machine-city structures retain color-pass depth while foreground contact shadows still render', () => {
  const scene = new THREE.Scene(), root = new THREE.Group(); scene.add(root);
  const city = new MachineCityRenderer(root), exterior = root.getObjectByName('machine-city-exterior')!;
  const foreground = new THREE.Mesh(new THREE.BoxGeometry(), new THREE.MeshStandardMaterial()); scene.add(foreground);
  const pass = new WorldOcclusionPass(scene, new THREE.PerspectiveCamera(), 64, 64);
  try {
    for (let i = 0; i < 2; i++) {
      pass.overrideVisibility();
      assert.equal(exterior.visible, false, 'remote city details do not need the 1.8 metre contact-shadow pass');
      assert.equal(foreground.visible, true, 'the nearby body, support and chamber keep contact shadows');
      pass.restoreVisibility(); assert.equal(exterior.visible, true, 'the actual city returns for the color pass');
      exterior.traverse(object => {
        if (object instanceof THREE.InstancedMesh) assert.equal((object.material as THREE.Material).depthWrite, true,
          'far buildings must still correctly occlude one another in the color image');
      });
    }
  } finally { pass.dispose(); city.dispose(); foreground.geometry.dispose(); foreground.material.dispose(); }
});


test('remote cultivation pods keep their color depth without repeating their geometry in local occlusion', () => {
  const scene = new THREE.Scene(), root = new THREE.Group(); scene.add(root);
  const set = new PodSetRenderer(root), remote: THREE.InstancedMesh[] = [], nearby: THREE.InstancedMesh[] = [];
  root.traverse(object => {
    if (!(object instanceof THREE.InstancedMesh)) return;
    if (object.count >= 2000) remote.push(object);
    if (object.count === 12 && (object.material as THREE.Material).depthWrite) nearby.push(object);
  });
  assert.equal(remote.length, 4); assert.ok(nearby.length >= 8);
  assert.ok(remote.reduce((sum, mesh) => sum + mesh.geometry.index!.count / 3 * mesh.count, 0) > 1_000_000);
  const before = remote.map(mesh => ({ geometry: mesh.geometry, instances: Array.from(mesh.instanceMatrix.array) }));
  const visible = (object: THREE.Object3D) => { for (let parent: THREE.Object3D | null = object; parent; parent = parent.parent) if (!parent.visible) return false; return true; };
  const presentNearby = nearby.filter(visible); assert.equal(presentNearby.length, 8, 'both visible banks must be checked independently of the hidden maintenance machine');
  const basin = root.getObjectByName('pod-basin-leaf--1')!, hose = root.getObjectByName('pod-neck-feed')!;
  const pass = new WorldOcclusionPass(scene, new THREE.PerspectiveCamera(), 64, 64);
  try {
    for (let frame = 0; frame < 2; frame++) {
      pass.overrideVisibility();
      assert.ok(remote.every(mesh => !visible(mesh)), 'thousands of remote pods cannot contribute to the foreground contact-shadow radius');
      assert.ok(presentNearby.every(visible), 'the closer banks retain their contact shading');
      assert.ok(visible(basin) && visible(hose), 'the actual basin and body connections still contribute normals');
      pass.restoreVisibility();
      remote.forEach((mesh, i) => {
        assert.equal(visible(mesh), true); assert.equal((mesh.material as THREE.Material).depthWrite, true);
        assert.equal(mesh.geometry, before[i].geometry); assert.deepEqual(Array.from(mesh.instanceMatrix.array), before[i].instances);
      });
    }
  } finally { pass.dispose(); set.dispose(); }
});
