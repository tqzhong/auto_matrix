import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { CHARACTERS, PLAYER_GRAVITY, PLAYER_JUMP_SPEED, PLAYER_WALK_SPEED, PLAYER_RUN_SPEED, type AgentState } from '@auto_matrix/shared';
import { CharacterModels, type CharacterRig } from '../agents/CharacterModel.js';

const NOTES: Record<string, string> = {
  neo: '后梳短发 · 窄椭圆墨镜 · 黑色长风衣',
  trinity: '后梳短发 · 窄框墨镜 · 合身皮衣与长裤',
  smith: '方框墨镜 · 炭灰西装 · 白衬衫与细领带',
  morpheus: '光头与胡须 · 圆形墨镜 · 深棕长皮衣',
};

export class CharacterViewer {
  private root: HTMLElement;
  private scene = new THREE.Scene();
  private camera = new THREE.PerspectiveCamera(31, 1, 0.02, 100);
  private renderer?: THREE.WebGLRenderer;
  private models?: CharacterModels;
  private environment?: THREE.WebGLRenderTarget;
  private rigs = new Map<string, CharacterRig>();
  private current?: CharacterRig;
  private id = 'neo';
  private angle = 0.28;
  private zoom = false;
  private glasses = true;
  private motion = 'idle';
  private lastFrame = 0;
  private frame = 0;
  private dragging = false;
  private lastX = 0;
  private started = 0;
  private onClose?: () => void;
  private resizeObserver: ResizeObserver;

  constructor(private agents: () => Record<string, AgentState>, private play: (id: string) => void) {
    this.root = document.createElement('section');
    this.root.className = 'character-viewer hidden';
    this.root.setAttribute('role', 'dialog'); this.root.setAttribute('aria-modal', 'true');
    this.root.setAttribute('aria-label', '三维人物检视');
    this.root.innerHTML = `<header><div><span class="eyebrow">RESIDUAL SELF-IMAGE</span><h2>三维人物检视</h2></div><button id="close-viewer" aria-label="关闭人物检视">×</button></header>
      <nav aria-label="选择检视人物">${['neo', 'trinity', 'smith', 'morpheus'].map(id => `<button data-preview="${id}">${CHARACTERS[id].nameCn}</button>`).join('')}</nav>
      <div class="character-stage" aria-label="可拖动旋转的三维人物模型"></div>
      <div class="character-viewer-info"><span class="eyebrow">THE MATRIX / 1999</span><h3 id="preview-name">NEO</h3><p id="preview-notes"></p><p class="model-note">拖动旋转 · 实际游戏内模型<br>电影造型近似还原，非演员扫描资产</p></div>
      <footer><div><button id="preview-zoom">面部特写</button><select id="preview-motion" aria-label="动作预览"><option value="idle">待机 · 呼吸</option><option value="walk">行走</option><option value="run">奔跑</option><option value="jump">跳跃与落地</option><option value="combat">刺拳 · 直拳 · 正蹬</option></select></div><button id="preview-play" class="enter-world">以此角色进入 ↗</button></footer>`;
    document.body.appendChild(this.root);
    this.root.addEventListener('click', event => {
      const button = (event.target as HTMLElement).closest<HTMLButtonElement>('button');
      if (!button) return;
      if (button.dataset.preview) this.select(button.dataset.preview);
      if (button.id === 'close-viewer') this.close();
      if (button.id === 'preview-play') { const id = this.id; this.close(); this.play(id); }
      if (button.id === 'preview-zoom') {
        if (!this.zoom) { this.zoom = true; this.glasses = true; }
        else if (this.glasses) this.glasses = false;
        else { this.zoom = false; this.glasses = true; }
        button.textContent = this.zoom ? this.glasses ? '取下墨镜' : '查看全身' : '面部特写';
      }
    });
    this.root.querySelector('#preview-motion')!.addEventListener('change', event => { this.motion = (event.target as HTMLSelectElement).value; this.started = performance.now(); this.zoom = false; this.glasses = true; this.root.querySelector('#preview-zoom')!.textContent = '面部特写'; });
    const stage = this.root.querySelector<HTMLElement>('.character-stage')!;
    stage.addEventListener('pointerdown', event => { this.dragging = true; this.lastX = event.clientX; stage.setPointerCapture(event.pointerId); });
    stage.addEventListener('pointermove', event => { if (this.dragging) { this.angle += (event.clientX - this.lastX) * 0.009; this.lastX = event.clientX; } });
    stage.addEventListener('pointerup', () => { this.dragging = false; });
    stage.addEventListener('pointercancel', () => { this.dragging = false; });
    this.root.addEventListener('keydown', event => { if (event.code === 'Escape') { event.stopPropagation(); this.close(); } });
    this.resizeObserver = new ResizeObserver(() => this.resize()); this.resizeObserver.observe(stage);
  }

  open(id: string, onClose: () => void): void {
    this.onClose = onClose;
    if (document.pointerLockElement) document.exitPointerLock();
    document.querySelectorAll<HTMLElement>('#app, #ui-overlay, #play-overlay, #sandbox-overlay').forEach(element => { element.inert = true; });
    this.root.classList.remove('hidden');
    if (!this.renderer) this.init();
    this.select(NOTES[id] ? id : 'neo'); this.resize();
    this.root.querySelector<HTMLButtonElement>('#close-viewer')!.focus();
    this.started = this.lastFrame = performance.now(); cancelAnimationFrame(this.frame); this.animate();
  }

  private init(): void {
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping; this.renderer.toneMappingExposure = .95;
    this.renderer.shadowMap.enabled = true; this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.root.querySelector('.character-stage')!.appendChild(this.renderer.domElement);
    this.renderer.domElement.setAttribute('aria-label', '电影造型三维人物');
    this.scene.background = new THREE.Color('#111916');
    const room = new RoomEnvironment(); const pmrem = new THREE.PMREMGenerator(this.renderer);
    this.environment = pmrem.fromScene(room, 0.04); this.scene.environment = this.environment.texture;
    this.scene.environmentIntensity = 0.65; room.dispose(); pmrem.dispose();
    this.scene.add(new THREE.HemisphereLight(0xe9eee5, 0x343e34, .6));
    const key = new THREE.DirectionalLight(0xffe5cf, 1.5); key.position.set(3, 7, 5); key.castShadow = true;
    key.shadow.mapSize.set(1024, 1024); Object.assign(key.shadow.camera, { left: -4, right: 4, top: 7, bottom: -3 });
    key.shadow.bias = -0.0004; this.scene.add(key);
    const rim = new THREE.DirectionalLight(0x9fd0c0, 3); rim.position.set(-3, 5, -3); this.scene.add(rim);
    const fill = new THREE.DirectionalLight(0xe6eeff, 0.5); fill.position.set(-4, 3, 5); this.scene.add(fill);
    const floor = new THREE.Mesh(new THREE.CircleGeometry(7, 80), new THREE.MeshStandardMaterial({ color: '#202b23', roughness: 0.38, metalness: 0.35 }));
    floor.rotation.x = -Math.PI / 2; floor.position.y = 0.005; floor.receiveShadow = true; this.scene.add(floor);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(1.8, 0.008, 5, 100), new THREE.MeshBasicMaterial({ color: '#91a883' }));
    ring.rotation.x = Math.PI / 2; ring.position.y = 0.02; this.scene.add(ring);
    this.models = new CharacterModels();
  }

  private select(id: string): void {
    const state = this.agents()[id]; if (!state || !this.models) return;
    this.id = id; this.angle = 0.22;
    this.glasses = true;
    this.root.querySelector('#preview-zoom')!.textContent = this.zoom ? '取下墨镜' : '面部特写';
    if (this.current) this.current.root.visible = false;
    let rig = this.rigs.get(id);
    if (!rig) { rig = this.models.create(state); this.rigs.set(id, rig); this.scene.add(rig.root); }
    this.current = rig; rig.root.visible = true;
    this.root.querySelector('#preview-name')!.textContent = CHARACTERS[id].name.toUpperCase();
    this.root.querySelector('#preview-notes')!.textContent = NOTES[id];
    this.root.querySelectorAll<HTMLElement>('[data-preview]').forEach(button => button.classList.toggle('active', button.dataset.preview === id));
  }

  private resize(): void {
    if (!this.renderer || this.root.classList.contains('hidden')) return;
    const stage = this.root.querySelector<HTMLElement>('.character-stage')!;
    const width = stage.clientWidth; const height = stage.clientHeight;
    if (!width || !height) return;
    this.camera.aspect = width / height; this.camera.updateProjectionMatrix(); this.renderer.setSize(width, height);
  }

  private animate = (): void => {
    this.frame = requestAnimationFrame(this.animate);
    if (!this.renderer || !this.models || !this.current) return;
    const now = performance.now(); const time = (now - this.started) / 1000; const delta = Math.min(.05, (now - this.lastFrame) / 1000); this.lastFrame = now;
    const jumpTime = time % 1.6; const height = this.motion === 'jump' ? Math.max(0, PLAYER_JUMP_SPEED * jumpTime - .5 * PLAYER_GRAVITY * jumpTime * jumpTime) : 0;
    this.current.root.position.y = height;
    this.models.animate(this.current, delta, { speed: this.motion === 'walk' ? PLAYER_WALK_SPEED : this.motion === 'run' ? PLAYER_RUN_SPEED : 0,
      grounded: height === 0, verticalVelocity: height > 0 ? PLAYER_JUMP_SPEED - PLAYER_GRAVITY * jumpTime : 0, turn: 0,
      attack: this.motion === 'combat' ? Math.floor(time / .72) : undefined }, 1);
    this.current.root.rotation.y = this.angle;
    if (this.current.hero) this.current.hero.glasses.visible = this.glasses;
    const distance = this.zoom ? 1.95 : this.camera.aspect < 0.75 ? 12.8 : 10.8;
    const targetY = this.zoom ? (this.id === 'trinity' ? 3.91 : this.id === 'morpheus' ? 4.18 : 4.08) : 2.2 + height;
    this.camera.position.lerp(new THREE.Vector3(0, targetY + (this.zoom ? 0.03 : 0.4), distance), 0.18);
    this.camera.lookAt(0, targetY, 0); this.renderer.render(this.scene, this.camera);
  };

  close(): void {
    cancelAnimationFrame(this.frame); this.root.classList.add('hidden');
    document.querySelectorAll<HTMLElement>('#app, #ui-overlay, #play-overlay, #sandbox-overlay').forEach(element => { element.inert = false; });
    this.onClose?.(); this.onClose = undefined;
  }
  dispose(): void {
    this.close(); this.resizeObserver.disconnect(); this.models?.dispose(); this.environment?.dispose();
    this.scene.traverse(object => { if (object instanceof THREE.Mesh && object.parent === this.scene) { object.geometry.dispose(); (object.material as THREE.Material).dispose(); } });
    this.renderer?.dispose(); this.root.remove();
  }
}
