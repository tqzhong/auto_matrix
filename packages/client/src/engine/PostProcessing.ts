import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { GTAOPass } from 'three/addons/postprocessing/GTAOPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { FXAAShader } from 'three/addons/shaders/FXAAShader.js';

export class WorldOcclusionPass extends GTAOPass {
  private suppressed: THREE.Object3D[] = [];
  overrideVisibility(): void {
    // The city remains loaded behind film interiors. Hidden branches cannot
    // contribute normals, so don't traverse or cache their individual objects.
    this.scene.traverseVisible(object => {
      if (object instanceof THREE.Points || object instanceof THREE.Line || object instanceof THREE.Sprite || (object instanceof THREE.Mesh && !Array.isArray(object.material) && !object.material.depthWrite)) {
        object.visible = false; this.suppressed.push(object);
      }
    });
  }
  restoreVisibility(): void {
    for (const object of this.suppressed) object.visible = true;
    this.suppressed.length = 0;
  }
  renderOverride(...args: Parameters<GTAOPass['renderOverride']>): void {
    const shadows = args[0].shadowMap;
    const autoUpdate = shadows.autoUpdate; const needsUpdate = shadows.needsUpdate;
    const matrices = this.scene.matrixWorldAutoUpdate;
    // RenderPass immediately precedes this pass. Reuse its transforms; the
    // normal material does not sample shadows and must not redraw their maps.
    shadows.autoUpdate = false; shadows.needsUpdate = false; this.scene.matrixWorldAutoUpdate = false;
    try { super.renderOverride(...args); }
    finally { shadows.autoUpdate = autoUpdate; shadows.needsUpdate = needsUpdate; this.scene.matrixWorldAutoUpdate = matrices; }
  }
}

export class PostProcessing {
  onMeasure?: (name: string, milliseconds: number) => void;
  private composer: EffectComposer;
  private bloom: UnrealBloomPass;
  private output: OutputPass;
  private occlusion: GTAOPass;
  private antialias: ShaderPass;
  private pixelRatio: number;
  constructor(renderer: THREE.WebGLRenderer, scene: THREE.Scene, camera: THREE.Camera) {
    this.composer = new EffectComposer(renderer);
    this.composer.addPass(new RenderPass(scene, camera));
    this.occlusion = new WorldOcclusionPass(scene, camera, window.innerWidth, window.innerHeight);
    this.occlusion.updateGtaoMaterial({ radius: 1.8, thickness: 1, scale: .8, samples: 8, distanceFallOff: 1 });
    this.occlusion.blendIntensity = .65;
    this.composer.addPass(this.occlusion);
    this.bloom = new UnrealBloomPass(new THREE.Vector2(window.innerWidth, window.innerHeight), 0.22, 0.35, 1.05);
    this.composer.addPass(this.bloom);
    this.output = new OutputPass();
    this.composer.addPass(this.output);
    this.antialias = new ShaderPass(FXAAShader); this.composer.addPass(this.antialias);
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
  render(): void { this.composer.render(); }
  resize(w: number, h: number): void { this.composer.setSize(w, h); this.antialias.uniforms.resolution.value.set(1 / (w * this.pixelRatio), 1 / (h * this.pixelRatio)); }
  dispose(): void { this.bloom.dispose(); this.output.dispose(); this.occlusion.dispose(); this.antialias.dispose(); this.composer.dispose(); }
}
