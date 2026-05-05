import * as THREE from 'three';
import type { AgentState, WorldStateDelta } from '@auto_matrix/shared';
import { VoxelRenderer } from './VoxelRenderer.js';
import { AgentRenderer } from '../agents/AgentRenderer.js';
import { CameraController } from './CameraController.js';
import { LightingSystem } from './LightingSystem.js';
import { ParticleSystem } from './ParticleSystem.js';
import { PostProcessing } from './PostProcessing.js';

export class Engine {
  readonly scene: THREE.Scene;
  readonly camera: THREE.PerspectiveCamera;
  readonly renderer: THREE.WebGLRenderer;

  readonly voxelRenderer: VoxelRenderer;
  readonly agentRenderer: AgentRenderer;
  readonly cameraController: CameraController;
  readonly lightingSystem: LightingSystem;
  readonly particleSystem: ParticleSystem;
  readonly postProcessing: PostProcessing;

  private clock: THREE.Clock;
  private elapsed = 0;
  private animationId = 0;

  constructor(container: HTMLElement) {
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x87CEEB); // sky blue
    this.scene.fog = new THREE.FogExp2(0xc0d8e8, 0.0015);

    this.camera = new THREE.PerspectiveCamera(
      60,
      window.innerWidth / window.innerHeight,
      0.5,
      1000,
    );

    this.renderer = new THREE.WebGLRenderer({
      antialias: false,
    });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(1);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    container.appendChild(this.renderer.domElement);

    this.clock = new THREE.Clock();

    this.lightingSystem = new LightingSystem(this.scene);
    this.voxelRenderer = new VoxelRenderer(this.scene);
    this.agentRenderer = new AgentRenderer(this.scene);
    this.particleSystem = new ParticleSystem(this.scene);
    this.postProcessing = new PostProcessing(this.renderer.domElement);
    this.cameraController = new CameraController(
      this.camera,
      this.renderer.domElement,
    );

    this.voxelRenderer.init();
    this.postProcessing.apply();

    window.addEventListener('resize', this.onResize);
  }

  private onResize = (): void => {
    const w = window.innerWidth;
    const h = window.innerHeight;
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h);
  };

  animate = (): void => {
    this.animationId = requestAnimationFrame(this.animate);

    const delta = this.clock.getDelta();
    this.elapsed += delta;

    this.cameraController.update(delta);
    this.agentRenderer.update(delta);
    this.lightingSystem.update(this.elapsed);
    this.particleSystem.update(delta);

    this.renderer.render(this.scene, this.camera);
  };

  start(): void {
    this.animate();
  }

  stop(): void {
    if (this.animationId) {
      cancelAnimationFrame(this.animationId);
      this.animationId = 0;
    }
  }

  updateAgents(agents: Record<string, AgentState>): void {
    for (const [id, state] of Object.entries(agents)) {
      this.agentRenderer.updateAgent(id, state);
    }
  }

  updateWorldState(_delta: WorldStateDelta): void {
    // Delta chunk updates could be applied here if needed.
    // For MVP the world is generated client-side and static.
  }

  getAgentRenderer(): AgentRenderer {
    return this.agentRenderer;
  }

  getCameraController(): CameraController {
    return this.cameraController;
  }

  getParticleSystem(): ParticleSystem {
    return this.particleSystem;
  }

  dispose(): void {
    this.stop();
    window.removeEventListener('resize', this.onResize);
    this.voxelRenderer.dispose();
    this.agentRenderer.dispose();
    this.lightingSystem.dispose();
    this.particleSystem.dispose();
    this.postProcessing.remove();
    this.cameraController.dispose();
    this.renderer.dispose();
  }
}
