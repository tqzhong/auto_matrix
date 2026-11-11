import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { GTAOPass } from 'three/addons/postprocessing/GTAOPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { FXAAShader } from 'three/addons/shaders/FXAAShader.js';
import { Reflector } from 'three/addons/objects/Reflector.js';
import { prepareSkinnedMaterial } from '../agents/SkinnedPrecision.js';
import { cacheReadyProgramLocations } from './PrepareShaderProgram.js';

type NormalProgram = NonNullable<THREE.WebGLRenderer['info']['programs']>[number] & { isReady(): boolean };

export class WorldOcclusionPass extends GTAOPass {
  declare normalRenderTarget: THREE.WebGLRenderTarget;
  compositeInPlace = true;
  private inPlace = false;
  private suppressed: THREE.Object3D[] = [];
  private reflections = new Map<THREE.Object3D, THREE.Object3D['onBeforeRender']>();
  private lightLayers = new Map<THREE.Light, number>();
  private skipReflection = (): void => {};
  private scalar = false;
  private normalScene = new THREE.Scene();
  private normalSource?: THREE.Scene;
  private preparedNormals?: {
    actor: THREE.Group; gpu: THREE.WebGLRenderer['properties']; seen: WeakSet<THREE.Mesh>;
    meshes: THREE.Mesh[]; programs: NormalProgram[]; street: boolean; destination?: readonly THREE.Mesh[];
  };
  constructor(...args: ConstructorParameters<typeof GTAOPass>) {
    super(...args);
    this.normalScene.matrixWorldAutoUpdate = false;
    this.normalScene.onBeforeRender = (...args) => {
      const source = this.normalSource!; args[1] = source;
      source.onBeforeRender(...args);
    };
    this.normalScene.onAfterRender = (...args) => {
      const source = this.normalSource!; args[1] = source;
      source.onAfterRender(...args);
    };
    // These fullscreen intermediates write color only. The normal pass owns scene depth.
    this.gtaoRenderTarget.depthBuffer = this.pdRenderTarget.depthBuffer = false;
    // AO is grayscale. Keep every sample and its half-float precision while
    // storing only red; normals and the scene color remain full RGB.
    this.pdMaterial.fragmentShader = this.pdMaterial.fragmentShader.replaceAll('sampleTexel.rgb', 'sampleTexel.rrr').replaceAll('texel.rgb', 'texel.rrr');
    this.blendMaterial.fragmentShader = this.blendMaterial.fragmentShader.replace('texel.rgb', 'texel.rrr');
    this.copyMaterial.uniforms.singleChannel = { value: false };
    this.copyMaterial.fragmentShader = 'uniform bool singleChannel;\n' + this.copyMaterial.fragmentShader.replace('gl_FragColor = opacity * texel;', 'if (singleChannel) texel.rgb = texel.rrr;\n gl_FragColor = opacity * texel;');
    this.singleChannel = true;
  }
  get singleChannel(): boolean { return this.scalar; }
  set singleChannel(value: boolean) {
    if (this.scalar === value) return;
    this.scalar = value;
    for (const target of [this.gtaoRenderTarget, this.pdRenderTarget]) {
      target.texture.format = value ? THREE.RedFormat : THREE.RGBAFormat;
      target.dispose();
    }
  }
  render(...args: Parameters<GTAOPass['render']>): void {
    this.inPlace = this.compositeInPlace && this.output === GTAOPass.OUTPUT.Default && !this.renderToScreen && !args[4];
    this.needsSwap = !this.inPlace;
    // Default AO only multiplies by its separate denoise texture. The scene
    // color can stay in the read buffer, without a full-screen copy or swap.
    try { super.render(args[0], this.inPlace ? args[2] : args[1], args[2], args[3], args[4]); }
    finally { this.restoreVisibility(); this.inPlace = false; }
  }
  renderPass(...args: Parameters<GTAOPass['renderPass']>): void {
    if (this.inPlace && args[1] === this.copyMaterial) return;
    if (args[1] === this.copyMaterial) {
      const source = this.copyMaterial.uniforms.tDiffuse.value;
      this.copyMaterial.uniforms.singleChannel.value = this.scalar && (source === this.gtaoRenderTarget.texture || source === this.pdRenderTarget.texture);
    }
    super.renderPass(...args);
  }
  overrideVisibility(): void {
    // The city remains loaded behind film interiors. Hidden branches cannot
    // contribute normals, so don't traverse or cache their individual objects.
    this.scene.traverseVisible(object => {
      // A mirror may have selected another detail level in the color pass.
      if (object instanceof THREE.LOD && object.autoUpdate) object.update(this.camera);
      // Three includes light counts in the normal shader's cache key. Layers
      // exclude the light without hiding geometry attached beneath it.
      if (object instanceof THREE.Light && object.layers.mask !== 0) {
        this.lightLayers.set(object, object.layers.mask);
        object.layers.disableAll();
      }
      // Keep the reflecting plane in the normal/depth image. Its reflected
      // world was already drawn for color and contributes no normals here.
      if (object instanceof Reflector) {
        this.reflections.set(object, object.onBeforeRender); object.onBeforeRender = this.skipReflection;
      }
      if (object.userData.distantBackdrop || object instanceof THREE.Points || object instanceof THREE.Line || object instanceof THREE.Sprite || (object instanceof THREE.Mesh && !Array.isArray(object.material) && !object.material.depthWrite)) {
        object.visible = false; this.suppressed.push(object);
      }
    });
  }
  restoreVisibility(): void {
    for (const [light, mask] of this.lightLayers) light.layers.mask = mask;
    this.lightLayers.clear();
    for (const [mirror, callback] of this.reflections) mirror.onBeforeRender = callback;
    this.reflections.clear();
    for (const object of this.suppressed) object.visible = true;
    this.suppressed.length = 0;
  }
  renderOverride(...args: Parameters<GTAOPass['renderOverride']>): void {
    const shadows = args[0].shadowMap;
    const autoUpdate = shadows.autoUpdate; const needsUpdate = shadows.needsUpdate;
    const source = this.scene, view = this.normalScene;
    const matrices = source.matrixWorldAutoUpdate, override = source.overrideMaterial;
    // RenderPass immediately precedes this pass. Reuse its transforms; the
    // normal material does not sample shadows and must not redraw their maps.
    shadows.autoUpdate = false; shadows.needsUpdate = false; source.matrixWorldAutoUpdate = false;
    // Three stores its light layout per scene. Keep the zero-light normal view
    // separate so it cannot invalidate the color materials every frame.
    this.normalSource = source; view.children = source.children;
    view.visible = source.visible; view.layers.mask = source.layers.mask; view.matrixWorld.copy(source.matrixWorld);
    view.background = source.background; view.backgroundBlurriness = source.backgroundBlurriness;
    view.backgroundIntensity = source.backgroundIntensity; view.backgroundRotation.copy(source.backgroundRotation);
    view.environment = source.environment; view.environmentIntensity = source.environmentIntensity;
    view.environmentRotation.copy(source.environmentRotation); view.fog = source.fog;
    source.overrideMaterial = args[1]; this.scene = view;
    try { super.renderOverride(...args); }
    finally {
      this.scene = source; source.overrideMaterial = override; source.matrixWorldAutoUpdate = matrices;
      view.children = []; view.overrideMaterial = null; view.background = view.environment = view.fog = null;
      this.normalSource = undefined; shadows.autoUpdate = autoUpdate; shadows.needsUpdate = needsUpdate;
    }
  }
  prepareNormals(renderer: THREE.WebGLRenderer, actor?: THREE.Group, destination?: readonly THREE.Mesh[]): void {
    if (!actor || !destination && !actor.visible || !renderer.extensions.has('KHR_parallel_shader_compile')) { this.preparedNormals = undefined; return; }
    const previous = this.preparedNormals;
    const fresh = previous?.actor !== actor || previous.gpu !== renderer.properties || previous.destination !== destination;
    if (fresh) this.preparedNormals = { actor, gpu: renderer.properties, seen: new WeakSet(), meshes: [], programs: [], street: false, destination };
    const prepared = this.preparedNormals!, programs = renderer.info.programs ?? [];
    prepared.programs = prepared.programs.filter(program => programs.includes(program));
    const ready = prepared.programs.findIndex(program => program.isReady());
    if (ready >= 0) { cacheReadyProgramLocations(renderer, prepared.programs.splice(ready, 1)[0]); return; }
    const include = (object: THREE.Object3D) => {
      if (!(object instanceof THREE.Mesh) || prepared.seen.has(object) || object.userData.distantBackdrop
        || !Array.isArray(object.material) && !object.material.depthWrite) return;
      prepared.seen.add(object); prepared.meshes.push(object);
    };
    if (destination) {
      if (fresh) destination.forEach(include);
    } else {
      actor.traverseVisible(include);
      if (!prepared.street) this.scene.traverseVisible(object => {
        if (prepared.street || !(object instanceof THREE.Mesh) || object instanceof THREE.SkinnedMesh
          || object.geometry.hasAttribute('uv1') || !object.geometry.hasAttribute('normal') || !object.visible) return;
        const before = prepared.meshes.length; include(object);
        if (prepared.meshes.length > before) prepared.street = true;
      });
    }
    const mesh = prepared.meshes[0];
    if (!mesh) return;
    if (!destination && !mesh.visible) { prepared.seen.delete(mesh); prepared.meshes.shift(); return; }
    // Use the same material, output space and zero-light view as the later AO draw.
    // compile() ignores scene.overrideMaterial, so restore the surface material explicitly.
    prepareSkinnedMaterial(this.normalMaterial);
    const batch = prepared.meshes.slice(0, destination ? 4 : 1), materials = batch.map(object => object.material);
    const target = renderer.getRenderTarget(), view = this.normalScene;
    const fog = view.fog, environment = view.environment;
    const subject = new THREE.Group(); subject.traverse = visit => batch.forEach(visit);
    try {
      batch.forEach(object => { object.material = this.normalMaterial; });
      view.fog = this.scene.fog; view.environment = this.scene.environment;
      renderer.setRenderTarget(this.normalRenderTarget);
      const start = programs.length;
      renderer.compile(subject, this.camera, view);
      prepared.programs.push(...programs.slice(start) as NormalProgram[]);
      prepared.meshes.splice(0, batch.length);
    } finally {
      batch.forEach((object, index) => { object.material = materials[index]; });
      view.fog = fog; view.environment = environment;
      renderer.setRenderTarget(target);
    }
  }
  dispose(): void {
    this.preparedNormals = undefined;
    super.dispose();
    this.gtaoMaterial.dispose();
    this.blendMaterial.dispose();
  }
}

export class PostProcessing {
  onMeasure?: (name: string, milliseconds: number) => void;
  private composer: EffectComposer;
  private bloom: UnrealBloomPass;
  private output: OutputPass;
  private occlusion: WorldOcclusionPass;
  private antialias: ShaderPass;
  private pixelRatio: number;
  constructor(renderer: THREE.WebGLRenderer, scene: THREE.Scene, camera: THREE.Camera) {
    this.composer = new EffectComposer(renderer);
    this.composer.renderTarget1.depthBuffer = false;
    this.composer.addPass(new RenderPass(scene, camera));
    this.occlusion = new WorldOcclusionPass(scene, camera, window.innerWidth, window.innerHeight);
    this.occlusion.updateGtaoMaterial({ radius: 1.8, thickness: 1, scale: .8, samples: 8, distanceFallOff: 1 });
    this.occlusion.blendIntensity = .65;
    this.composer.addPass(this.occlusion);
    this.bloom = new UnrealBloomPass(new THREE.Vector2(window.innerWidth, window.innerHeight), 0.22, 0.35, 1.05);
    // Every bloom filter fills its target with a fullscreen triangle.
    for (const target of [this.bloom.renderTargetBright, ...this.bloom.renderTargetsHorizontal, ...this.bloom.renderTargetsVertical])
      target.depthBuffer = false;
    for (const material of [this.bloom.materialHighPassFilter, ...this.bloom.separableBlurMaterials, this.bloom.compositeMaterial])
      material.depthTest = material.depthWrite = false;
    this.composer.addPass(this.bloom);
    this.output = new OutputPass();
    this.output.material.depthTest = this.output.material.depthWrite = false;
    this.composer.addPass(this.output);
    this.antialias = new ShaderPass(FXAAShader);
    this.antialias.material.depthTest = this.antialias.material.depthWrite = false;
    this.composer.addPass(this.antialias);
    for (const [i, name] of ['scene', 'occlusion', 'bloom', 'output', 'antialias'].entries()) {
      const pass = this.composer.passes[i]; const render = pass.render.bind(pass);
      pass.render = (...args) => {
        if (!this.onMeasure) return render(...args);
        const start = performance.now(); render(...args); this.onMeasure(name, performance.now() - start);
      };
    }
    const normals = this.occlusion.renderOverride.bind(this.occlusion);
    this.occlusion.renderOverride = (...args) => {
      if (!this.onMeasure) return normals(...args);
      const start = performance.now(); normals(...args); this.onMeasure('occlusion.normals', performance.now() - start);
    };
    for (const name of ['overrideVisibility', 'restoreVisibility'] as const) {
      const operation = this.occlusion[name].bind(this.occlusion);
      this.occlusion[name] = () => {
        if (!this.onMeasure) return operation();
        const start = performance.now(); operation(); this.onMeasure(`occlusion.${name}`, performance.now() - start);
      };
    }
    this.pixelRatio = renderer.getPixelRatio(); this.resize(window.innerWidth, window.innerHeight);
  }
  render(occlusion = true): void {
    this.occlusion.enabled = occlusion;
    // The comparison AO path can swap the buffers. Always start the scene
    // on the depth-capable target, regardless of the previous frame's swaps.
    this.composer.readBuffer = this.composer.renderTarget2;
    this.composer.writeBuffer = this.composer.renderTarget1;
    this.composer.render();
  }
  prepareNormals(renderer: THREE.WebGLRenderer, actor?: THREE.Group, destination?: readonly THREE.Mesh[]): void { this.occlusion.prepareNormals(renderer, actor, destination); }
  get occlusionInPlace(): boolean { return this.occlusion.compositeInPlace; }
  set occlusionInPlace(value: boolean) { this.occlusion.compositeInPlace = value; }
  get occlusionSingleChannel(): boolean { return this.occlusion.singleChannel; }
  set occlusionSingleChannel(value: boolean) { this.occlusion.singleChannel = value; }
  resize(w: number, h: number, pixelRatio = this.pixelRatio): void {
    if (this.pixelRatio !== pixelRatio) { this.pixelRatio = pixelRatio; this.composer.setPixelRatio(pixelRatio); }
    this.composer.setSize(w, h); this.antialias.uniforms.resolution.value.set(1 / (w * pixelRatio), 1 / (h * pixelRatio));
  }
  dispose(): void {
    this.bloom.materialHighPassFilter.dispose();
    this.bloom.dispose();
    this.output.dispose();
    this.occlusion.dispose();
    this.antialias.dispose();
    this.composer.dispose();
  }
}
