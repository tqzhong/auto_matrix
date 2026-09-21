import * as THREE from 'three';
import type { AgentState, WorldEvent, SimulationState, SandboxState, CombatImpact, SkillCast } from '@auto_matrix/shared';
import { insideLifeRoom } from '@auto_matrix/shared';
import { CombatEffects } from './CombatEffects.js';
import { GameAudio } from './GameAudio.js';
import { SandboxRenderer } from './SandboxRenderer.js';
import { VoxelRenderer } from './VoxelRenderer.js';
import { AgentRenderer } from '../agents/AgentRenderer.js';
import { CameraController } from './CameraController.js';
import { LightingSystem } from './LightingSystem.js';
import { ParticleSystem } from './ParticleSystem.js';
import { PostProcessing } from './PostProcessing.js';
import type { PlayerControls } from '../player/PlayerControls.js';

export class Engine {
  readonly scene = new THREE.Scene();
  readonly camera = new THREE.PerspectiveCamera(48, window.innerWidth / window.innerHeight, 0.5, 5000);
  readonly renderer: THREE.WebGLRenderer;
  readonly voxelRenderer: VoxelRenderer;
  readonly agentRenderer: AgentRenderer;
  readonly cameraController: CameraController;
  readonly lightingSystem: LightingSystem;
  readonly particleSystem: ParticleSystem;
  readonly postProcessing: PostProcessing;
  readonly sandboxRenderer: SandboxRenderer;
  readonly combatEffects: CombatEffects;
  readonly audio: GameAudio;
  private clock = new THREE.Clock();
  private elapsed = 0;
  private animationId = 0;
  private simulationSpeed = 1;
  private rain: THREE.LineSegments;
  private rainPositions = new Float32Array(1000 * 6);
  private matrix = true;
  private eventRing: THREE.Mesh;
  private eventAge = 10;
  fps = 60;
  playerControls?: PlayerControls;
  private running = true;
  private tick = 0;
  private timeOfDay = 7500;
  private weather: SandboxState['weather'] = 'clear';
  private sandbox?: SandboxState;
  private sandboxPlayer?: string | null;
  suspended = false;
  onRendered?: () => void;
  private environment: THREE.WebGLRenderTarget;

  constructor(container: HTMLElement) {
    this.scene.background = new THREE.Color(0x071410);
    this.scene.fog = new THREE.FogExp2(0x0b2018, 0.00125);
    this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.12;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    const environmentScene = new THREE.Scene();
    const sky = new THREE.SphereGeometry(500, 32, 16); const skyColors: number[] = [];
    const horizon = new THREE.Color(0xc6c8c5); const zenith = new THREE.Color(0xb8d3e6); const ground = new THREE.Color(0x514c42);
    for (let i = 0; i < sky.attributes.position.count; i++) {
      const elevation = sky.attributes.position.getY(i) / 500;
      const color = horizon.clone().lerp(elevation > 0 ? zenith : ground, Math.abs(elevation) ** .5);
      skyColors.push(color.r, color.g, color.b);
    }
    sky.setAttribute('color', new THREE.Float32BufferAttribute(skyColors, 3));
    const skyMaterial = new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide });
    environmentScene.add(new THREE.Mesh(sky, skyMaterial));
    const pmrem = new THREE.PMREMGenerator(this.renderer);
    this.environment = pmrem.fromScene(environmentScene, 0.04);
    this.scene.environment = this.environment.texture;
    this.scene.environmentIntensity = 0.6;
    sky.dispose(); skyMaterial.dispose(); pmrem.dispose();
    this.renderer.domElement.setAttribute('aria-label', 'Matrix 三维开放世界，接入角色后使用 WASD 移动、鼠标转动视角');
    container.appendChild(this.renderer.domElement);
    this.lightingSystem = new LightingSystem(this.scene);
    this.voxelRenderer = new VoxelRenderer(this.scene);
    this.voxelRenderer.init();
    this.agentRenderer = new AgentRenderer(this.scene);
    this.sandboxRenderer = new SandboxRenderer(this.scene);
    this.audio = new GameAudio();
    this.combatEffects = new CombatEffects(this.scene, this.audio);
    this.cameraController = new CameraController(this.camera, this.renderer.domElement);
    this.particleSystem = new ParticleSystem(this.scene);
    this.postProcessing = new PostProcessing(this.renderer, this.scene, this.camera);
    for (let i = 0; i < this.rainPositions.length; i += 6) {
      const x = 1120 + (Math.random() - 0.5) * 1300;
      const z = 920 + (Math.random() - 0.5) * 1300;
      const y = Math.random() * 400;
      this.rainPositions.set([x, y, z, x - 0.8, y - 6, z], i);
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(this.rainPositions, 3));
    this.rain = new THREE.LineSegments(geometry, new THREE.LineBasicMaterial({ color: 0x90b6a0, transparent: true, opacity: 0.18, depthWrite: false }));
    this.rain.frustumCulled = false;
    this.scene.add(this.rain);
    this.eventRing = new THREE.Mesh(new THREE.RingGeometry(10, 10.7, 64), new THREE.MeshBasicMaterial({ color: 0x9ff0b0, transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide }));
    this.eventRing.rotation.x = -Math.PI / 2;
    this.scene.add(this.eventRing);
    window.addEventListener('resize', this.resize);
  }

  private resize = (): void => {
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.postProcessing.resize(window.innerWidth, window.innerHeight);
  };
  private animate = (): void => {
    this.animationId = requestAnimationFrame(this.animate);
    if (this.suspended) return;
    const delta = Math.min(this.clock.getDelta(), 0.1);
    this.fps += ((1 / Math.max(delta, 0.001)) - this.fps) * 0.03;
    this.elapsed += delta * this.simulationSpeed;
    if (!this.playerControls?.id) this.cameraController.update(delta);
    if (this.playerControls?.id) {
      const state = this.agentRenderer.getAgentState(this.playerControls.id);
      const group = this.agentRenderer.getAgent(this.playerControls.id);
      if (state && group) this.playerControls.update(delta, state, group, this.running);
      this.agentRenderer.setPlayer(this.playerControls.id, this.playerControls.firstPerson);
      this.agentRenderer.setPlayerMotion(this.playerControls.motion);
    }
    this.agentRenderer.update(delta, this.camera, this.simulationSpeed, this.tick);
    this.voxelRenderer.update(this.elapsed, this.playerControls?.id ? this.camera : undefined);
    const player = this.playerControls?.id ? this.agentRenderer.getAgentState(this.playerControls.id) : undefined;
    this.voxelRenderer.interiors.update(this.timeOfDay, player?.position, this.sandbox?.neoLife);
    this.rain.visible = this.matrix && this.weather !== 'clear' && !(player && insideLifeRoom(player.position));
    this.sandboxRenderer.update(delta, this.camera, this.matrix, this.tick, this.running);
    this.lightingSystem.update(this.elapsed, this.playerControls?.id ? this.camera : undefined);
    this.particleSystem.update(delta);
    this.combatEffects.update(this.running ? delta : 0);
    for (let i = 0; i < this.rainPositions.length; i += 6) {
      const drop = delta * 95;
      this.rainPositions[i + 1] -= drop;
      this.rainPositions[i + 4] -= drop;
      if (this.rainPositions[i + 1] < 0 || Math.abs(this.rainPositions[i] - this.camera.position.x) > 180 || Math.abs(this.rainPositions[i + 2] - this.camera.position.z) > 180) {
        const x = this.camera.position.x + (Math.random() - .5) * 300;
        const z = this.camera.position.z + (Math.random() - .5) * 300;
        const y = this.camera.position.y + 30 + Math.random() * 100;
        this.rainPositions.set([x, y, z, x - .3, y - 2.7, z], i);
      }
    }
    this.rain.geometry.attributes.position.needsUpdate = true;
    this.eventAge += delta;
    this.eventRing.scale.setScalar(1 + this.eventAge * 3);
    (this.eventRing.material as THREE.MeshBasicMaterial).opacity = Math.max(0, 0.7 - this.eventAge * 0.15);
    this.postProcessing.render();
    this.onRendered?.();
  };
  setSimulation(state: SimulationState, time?: number): void {
    this.running = state.running;
    this.tick = state.tick;
    this.simulationSpeed = state.running ? state.speed * (state.timeScale ?? 1) : 0;
    if (time !== undefined) { this.timeOfDay = time; this.lightingSystem.setTime(time); }
    this.updateAtmosphere();
  }
  setSandbox(state: SandboxState, agents: Record<string, AgentState>): void {
    if (state !== this.sandbox || this.sandboxPlayer !== this.playerControls?.id) {
      this.sandboxPlayer = this.playerControls?.id;
      const neo = this.sandboxPlayer === 'neo' && state.neoLife;
      const view = neo ? { ...state, missions: neo.missions, nodes: agents.neo?.isAwakened ? state.nodes : state.nodes.filter(n => n.kind === 'phone' || n.kind === 'mission' && neo.missions[n.id.slice(8)]?.status !== 'locked'), incidents: [] } : state;
      this.sandboxRenderer.sync(view, agents); this.sandbox = state;
    }
    this.weather = state.weather; this.updateAtmosphere();
  }
  showImpact(impact: CombatImpact): void {
    if (impact.matrix !== this.matrix || this.camera.position.distanceTo(new THREE.Vector3(impact.position.x, impact.position.y, impact.position.z)) > 80) return;
    this.combatEffects.impact(impact, impact.target === this.playerControls?.id);
    if (this.playerControls?.id && [impact.source, impact.target].includes(this.playerControls.id)) this.audio.impact();
    this.playerControls?.impact(impact);
    this.agentRenderer.impact(impact);
    this.sandboxRenderer.impact(impact);
  }
  showSkill(cast: SkillCast): void {
    if (cast.matrix !== this.matrix || this.camera.position.distanceTo(new THREE.Vector3(cast.position.x, cast.position.y, cast.position.z)) > 80) return;
    this.combatEffects.skill(cast); this.playerControls?.skill(cast);
  }
  private updateAtmosphere(): void {
    this.voxelRenderer.setWeather(this.weather !== 'clear');
    this.rain.visible = this.matrix && this.weather !== 'clear';
    if (!this.matrix) return;
    const daylight = Math.max(0, Math.sin((this.timeOfDay / 24000 - .25) * Math.PI * 2));
    this.scene.environmentIntensity = .2 + daylight * .85;
    const cloudy = this.weather !== 'clear';
    const color = new THREE.Color(this.weather === 'code_storm' ? 0x113529 : 0x172435).lerp(new THREE.Color(cloudy ? 0xa7b0b6 : 0xb9d7ee), Math.min(1, daylight * 1.7));
    if (!cloudy && this.timeOfDay > 17000 && this.timeOfDay < 19500) color.lerp(new THREE.Color(0xbb9383), .45);
    (this.scene.background as THREE.Color).copy(color);
    (this.scene.fog as THREE.FogExp2).color.copy(color);
    (this.scene.fog as THREE.FogExp2).density = this.weather === 'code_storm' ? .0026 : this.weather === 'rain' ? .0016 : .00075;
    (this.rain.material as THREE.LineBasicMaterial).color.setHex(this.weather === 'code_storm' ? 0x91ff9d : 0xb5c6d3);
  }
  setWorld(matrix: boolean, moveCamera = true): void {
    this.matrix = matrix;
    this.voxelRenderer.setWorld(matrix);
    this.agentRenderer.setWorld(matrix);
    this.rain.visible = matrix;
    this.scene.background = new THREE.Color(matrix ? 0x071410 : 0x171a15);
    this.scene.fog = new THREE.FogExp2(matrix ? 0x0b2018 : 0x262519, matrix ? 0.00125 : 0.001);
    this.updateAtmosphere();
    if (moveCamera) this.cameraController.overview(matrix);
  }
  showEvent(event: WorldEvent): void {
    if (!event.position) return;
    if ((event.position.y >= 0) !== this.matrix) return;
    this.eventRing.position.set(event.position.x, event.position.y + 0.2, event.position.z);
    this.eventAge = 0;
    (this.eventRing.material as THREE.MeshBasicMaterial).color.setHex(['death', 'gunfight'].includes(event.type) ? 0xec7964 : 0xa5f3b3);
  }
  updateAgents(agents: Record<string, AgentState>): void {
    for (const [id, state] of Object.entries(agents)) this.agentRenderer.updateAgent(id, state);
    for (const id of this.agentRenderer.getAgentIds()) if (!agents[id]) this.agentRenderer.removeAgent(id);
  }
  getAgentRenderer(): AgentRenderer { return this.agentRenderer; }
  getCameraController(): CameraController { return this.cameraController; }
  getParticleSystem(): ParticleSystem { return this.particleSystem; }
  start(): void { this.animate(); }
  dispose(): void {
    cancelAnimationFrame(this.animationId);
    window.removeEventListener('resize', this.resize);
    this.voxelRenderer.dispose(); this.agentRenderer.dispose(); this.cameraController.dispose();
    this.sandboxRenderer.dispose();
    this.combatEffects.dispose();
    this.audio.dispose();
    this.lightingSystem.dispose(); this.particleSystem.dispose(); this.postProcessing.dispose();
    this.rain.geometry.dispose(); (this.rain.material as THREE.Material).dispose();
    this.eventRing.geometry.dispose(); (this.eventRing.material as THREE.Material).dispose();
    this.renderer.dispose();
    this.environment.dispose();
  }
}
