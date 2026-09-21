import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { GTAOPass } from 'three/addons/postprocessing/GTAOPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { FXAAShader } from 'three/addons/shaders/FXAAShader.js';

class WorldOcclusionPass extends GTAOPass {
  overrideVisibility(): void {
    super.overrideVisibility();
    this.scene.traverse(object => {
      if (object instanceof THREE.Sprite || (object instanceof THREE.Mesh && !Array.isArray(object.material) && !object.material.depthWrite)) object.visible = false;
    });
  }
}

export class PostProcessing {
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
    this.pixelRatio = renderer.getPixelRatio(); this.resize(window.innerWidth, window.innerHeight);
  }
  render(): void { this.composer.render(); }
  resize(w: number, h: number): void { this.composer.setSize(w, h); this.antialias.uniforms.resolution.value.set(1 / (w * this.pixelRatio), 1 / (h * this.pixelRatio)); }
  dispose(): void { this.bloom.dispose(); this.output.dispose(); this.occlusion.dispose(); this.antialias.dispose(); this.composer.dispose(); }
}
