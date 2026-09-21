import type { Engine } from '../engine/Engine.js';

// Development-only recorder. It captures rendered frames and the visible UI;
// it never advances the story or sends player input.
export class GameplayRecorder {
  private toolbar = document.createElement('div');
  private canvas = document.createElement('canvas');
  private context = this.canvas.getContext('2d')!;
  private recorder?: MediaRecorder;
  private ui?: HTMLImageElement;
  private updatingUI = false;
  private startedAt = 0;
  private id = '';
  private saved = Promise.resolve();
  private failed = false;
  private markers: { seconds: number; title: string }[] = [];
  private frameAt = 0;
  private frames = 0;
  private bytes = 0;
  private audio = false;
  private uiTimer = 0;

  constructor(private engine: Engine) {
    this.toolbar.id = 'gameplay-recorder';
    this.toolbar.style.cssText = 'position:fixed;z-index:9999;left:50%;bottom:8px;transform:translateX(-50%);padding:8px;background:#14221fed;border:1px solid #c7d7be;color:#e8eadb;font:12px sans-serif;display:flex;gap:8px;align-items:center;white-space:nowrap';
    this.toolbar.innerHTML = '<button data-record>开始录制</button><input aria-label="录制章节" placeholder="章节标题" style="width:150px"><button data-marker>标记章节</button><span role="status">游戏内录制 · 30 fps</span>';
    document.body.appendChild(this.toolbar);
    this.toolbar.querySelector<HTMLButtonElement>('[data-record]')!.onclick = () => {
      if (this.recorder?.state === 'recording') this.recorder.stop();
      else void this.start().catch(error => this.error(error));
    };
    this.toolbar.querySelector<HTMLButtonElement>('[data-marker]')!.onclick = () => {
      const input = this.toolbar.querySelector('input')!;
      if (input.value.trim() && this.recorder?.state === 'recording') {
        this.markers.push({ seconds: (performance.now() - this.startedAt) / 1000, title: input.value.trim() });
        input.value = ''; this.status(`已标记 ${this.markers.length} 个章节`);
      }
    };
    window.addEventListener('beforeunload', () => { if (this.recorder?.state === 'recording') this.recorder.stop(); });
  }

  private status(message: string): void { this.toolbar.querySelector('[role="status"]')!.textContent = message; }
  private error(error: unknown): void {
    this.failed = true; this.status(`录制错误：${error instanceof Error ? error.message : String(error)}`);
    if (this.recorder?.state === 'recording') this.recorder.stop();
  }
  private async write(extension: string, body: BodyInit): Promise<void> {
    const response = await fetch(`/__recording/${this.id}.${extension}`, { method: 'POST', body });
    if (!response.ok) throw new Error(await response.text());
  }

  private async start(): Promise<void> {
    this.canvas.width = window.innerWidth; this.canvas.height = window.innerHeight;
    this.id = `neo-${new Date().toISOString().replace(/[:.]/g, '-')}`;
    this.saved = Promise.resolve(); this.failed = false; this.markers = []; this.frames = 0; this.bytes = 0;
    const stream = this.canvas.captureStream(30);
    const audio = await this.engine.audio.recordingAudio(); this.audio = Boolean(audio);
    if (audio) for (const track of audio.getAudioTracks()) stream.addTrack(track.clone());
    const mimeType = ['video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus'].find(type => MediaRecorder.isTypeSupported(type));
    if (!mimeType) throw new Error('浏览器不支持 WebM 录制');
    this.recorder = new MediaRecorder(stream, { mimeType, videoBitsPerSecond: 6_000_000 });
    this.recorder.ondataavailable = event => {
      this.bytes += event.data.size;
      if (event.data.size) this.saved = this.saved.then(() => this.write('webm', event.data)).catch(error => this.error(error));
    };
    this.recorder.onstop = () => { void this.finish(stream); };
    this.recorder.onerror = () => this.error('浏览器编码器中断');
    await this.captureUI();
    this.startedAt = performance.now(); this.frameAt = 0;
    this.engine.onRendered = () => {
      const now = performance.now();
      if (now - this.frameAt < 1000 / 30) return;
      this.frameAt = now;
      this.context.drawImage(this.engine.renderer.domElement, 0, 0, this.canvas.width, this.canvas.height);
      if (this.ui) this.context.drawImage(this.ui, 0, 0, this.canvas.width, this.canvas.height);
      if (++this.frames % 30 === 0) this.status(`● ${Math.round((now - this.startedAt) / 1000)} 秒 · ${this.frames} 帧 · ${(this.bytes / 1048576).toFixed(1)} MB${this.audio ? '' : ' · 无音轨'}`);
    };
    this.uiTimer = window.setInterval(() => { void this.captureUI().catch(error => this.error(error)); }, 500);
    this.recorder.start(5000);
    this.toolbar.querySelector('[data-record]')!.textContent = '结束并保存录像';
    this.status('● 正在录制');
  }

  private async captureUI(): Promise<void> {
    if (this.updatingUI) return;
    this.updatingUI = true;
    try {
      const body = document.createElement('div'); body.className = `recording-body ${document.body.className}`;
      body.style.cssText = `position:relative;width:${this.canvas.width}px;height:${this.canvas.height}px;overflow:hidden;background:transparent`;
      for (const source of Array.from(document.body.children)) {
        if (source.id === 'app' || source === this.toolbar || ['SCRIPT', 'STYLE'].includes(source.tagName)) continue;
        const clone = source.cloneNode(true) as HTMLElement;
        const originalsWithScroll = [source, ...source.querySelectorAll('*')];
        const clonesWithScroll = [clone, ...clone.querySelectorAll('*')];
        originalsWithScroll.forEach((element, index) => {
          if (!element.scrollTop) return;
          const copy = clonesWithScroll[index]; const contents = document.createElement('div');
          contents.style.transform = `translateY(-${element.scrollTop}px)`;
          contents.append(...Array.from(copy.childNodes)); copy.appendChild(contents);
        });
        const originals = source.querySelectorAll('canvas');
        clone.querySelectorAll('canvas').forEach((canvas, index) => {
          const image = document.createElement('img'); image.src = originals[index].toDataURL();
          for (const attr of Array.from(canvas.attributes)) image.setAttribute(attr.name, attr.value);
          canvas.replaceWith(image);
        });
        clone.querySelectorAll('.hidden, [hidden]').forEach(element => element.remove());
        body.appendChild(clone);
      }
      const styles = Array.from(document.styleSheets).map(sheet => Array.from(sheet.cssRules).map(rule => rule.cssText).join('\n')).join('\n')
        .replace(/(^|[,\s>+~])body(?=[.#\s,{:>+~]|$)/g, '$1.recording-body').replace(/:root/g, '.recording-body');
      const markup = new XMLSerializer().serializeToString(body);
      const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${this.canvas.width}" height="${this.canvas.height}"><foreignObject width="100%" height="100%"><div xmlns="http://www.w3.org/1999/xhtml"><style>${styles.replace(/&/g, '&amp;').replace(/</g, '&lt;')}</style>${markup}</div></foreignObject></svg>`;
      const image = new Image(); image.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
      await image.decode(); this.ui = image;
    } finally { this.updatingUI = false; }
  }

  private async finish(stream: MediaStream): Promise<void> {
    window.clearInterval(this.uiTimer); this.engine.onRendered = undefined;
    const duration = (performance.now() - this.startedAt) / 1000;
    stream.getTracks().forEach(track => track.stop());
    this.toolbar.querySelector('[data-record]')!.textContent = '开始录制';
    await this.saved;
    if (this.failed) return;
    if (!this.bytes) { this.error(`未产生视频数据（${this.frames} 帧）`); return; }
    try {
      await this.write('json', JSON.stringify({ file: `${this.id}.webm`, duration, width: this.canvas.width, height: this.canvas.height, audio: this.audio, frames: this.frames, markers: this.markers }, null, 2));
      this.status(`已保存 ${Math.round(duration)} 秒 · output/gameplay/neo-longplay-2026-09-20`);
    } catch (error) { this.error(error); }
  }
}
