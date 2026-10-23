import type { Engine } from '../engine/Engine.js';
import type { GraphicsQuality } from '../engine/GraphicsQuality.js';
import './graphics.css';

export class GraphicsPanel {
  private root = document.createElement('dialog');
  private timer?: number;

  constructor(private engine: Engine, private menu: (open: boolean) => void) {
    this.root.className = 'graphics-panel'; this.root.setAttribute('aria-labelledby', 'graphics-title');
    this.root.innerHTML = `<header><div><span class="eyebrow">YOUR VIEW OF THE WORLD</span><h2 id="graphics-title">画质与性能</h2></div><button data-close aria-label="关闭画质设置">×</button></header>
      <p>选择更清晰的画面，或更流畅的动作。</p>
      <label for="graphics-quality">渲染画质</label><select id="graphics-quality"><option value="high">精致 · 保留原画质</option><option value="balanced">均衡 · 兼顾清晰与流畅</option><option value="smooth">流畅 · 优先响应速度</option></select>
      <p class="graphics-hint">均衡与流畅会降低 3D 画面的清晰度，文字和操作界面保持清晰。不同场景的帧率会变化。</p>
      <dl><div><dt>当前帧率</dt><dd id="graphics-fps"></dd></div><div><dt>3D 画面分辨率</dt><dd id="graphics-resolution"></dd></div></dl>
      <footer><span id="graphics-save" role="status">切换立即生效 · 设置自动保存</span><span>Esc 返回游戏</span></footer>`;
    document.body.appendChild(this.root);
    this.root.querySelector('[data-close]')!.addEventListener('click', () => this.close());
    this.root.querySelector<HTMLSelectElement>('#graphics-quality')!.addEventListener('change', event => {
      const saved = engine.setGraphicsQuality((event.target as HTMLSelectElement).value as GraphicsQuality);
      this.root.querySelector('#graphics-save')!.textContent = saved ? '已应用并保存' : '已应用；浏览器无法保存，刷新后需重新选择';
      this.render();
    });
    this.root.addEventListener('cancel', event => { event.preventDefault(); this.close(); });
    this.root.addEventListener('keydown', event => event.stopPropagation());
    this.root.addEventListener('keyup', event => event.stopPropagation());
    this.root.addEventListener('click', event => {
      if (event.target !== this.root) return;
      const rect = this.root.getBoundingClientRect();
      if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) this.close();
    });
  }
  open(): void {
    if (this.root.open) return;
    this.menu(true);
    if (document.pointerLockElement) document.exitPointerLock();
    this.root.querySelector<HTMLSelectElement>('#graphics-quality')!.value = this.engine.graphicsQuality;
    this.root.showModal(); this.render();
    this.timer = window.setInterval(() => this.render(), 500);
  }
  close(): boolean {
    if (!this.root.open) return false;
    window.clearInterval(this.timer); this.root.close(); this.menu(false); return true;
  }
  private render(): void {
    const canvas = this.engine.renderer.domElement;
    this.root.querySelector('#graphics-fps')!.textContent = `${this.engine.fps.toFixed(0)} FPS`;
    this.root.querySelector('#graphics-resolution')!.textContent = `${canvas.width} × ${canvas.height}`;
  }
  dispose(): void { this.close(); this.root.remove(); }
}
