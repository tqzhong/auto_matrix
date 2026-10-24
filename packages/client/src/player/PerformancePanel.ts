import type { Engine, FrameProfile } from '../engine/Engine.js';
import { Frustum, Matrix4, PointLight, Sphere, Vector3, type Object3D } from 'three';
import { GpuTimer } from './GpuTimer.js';
import { CharacterModels } from '../agents/CharacterModel.js';
import { HeroModels } from '../agents/HeroModel.js';
import { FightingHands } from '../agents/FightingHands.js';

// Opt-in development measurement. Sampling does not capture or encode frames;
// a separate button exports one lossless frame when sampling is idle.
export class PerformancePanel {
  private panel = document.createElement('div');
  private frames: FrameProfile[] = [];
  private passes: Record<string, number[]> = {};
  private startAt = 0;
  private fpsBeforeSampling = 0;
  private restoreAutoReset = true;
  private restoreMatrices?: Engine['scene']['updateMatrixWorld'];
  private restoreDraw?: Engine['renderer']['renderBufferDirect'];
  private drawTotals: Record<string, { calls: number; triangles: number }> = {};
  private meshTotals = new Map<Object3D, { calls: number; triangles: number }>();
  private gpuTimer: GpuTimer;
  private restorePost?: Engine['postProcessing']['render'];
  private browserObservers: PerformanceObserver[] = [];
  private browserEntries: PerformanceEntry[] = [];
  private restoreAnimations?: () => void;
  private animationTotals = new Map<string, { actor: string; layer: string; calls: number; ms: number; maxMs: number; distance: number; visible: boolean }>();

  constructor(private engine: Engine) {
    this.panel.id = 'performance-panel';
    this.panel.style.cssText = 'position:fixed;z-index:9999;right:16px;top:80px;width:290px;padding:12px;background:#102019f2;color:#e6efdf;border:1px solid #94a386;font:12px/1.6 monospace';
    this.panel.innerHTML = '<b>性能检查 · 开发模式</b><p>预热 3 秒，采样 15 秒；不录制视频。</p><button>测量当前场景</button><label style="display:block;margin-top:6px"><input type="checkbox"> 对照：收割塔参与接触阴影</label><label style="display:block;margin-top:6px"><input type="checkbox" data-pod-culling> 对照：绘制视野外培养舱</label><label style="display:block;margin-top:6px"><input type="checkbox" data-occlusion-copy> 对照：保留阴影颜色拷贝</label><pre role="status" style="white-space:pre-wrap">尚未采样</pre>';
    this.panel.querySelector('button')!.onclick = () => this.start();
    const comparison = this.panel.querySelector<HTMLInputElement>('input')!;
    comparison.onchange = () => {
      const towers = this.engine.scene.getObjectByName('pod-distant-towers');
      if (!towers) { comparison.checked = false; this.status('请在培养舱场景使用此对照项。'); return; }
      towers.userData.distantBackdrop = !comparison.checked;
      this.status(comparison.checked ? '原始远景法线；可以测量当前场景。' : '优化远景法线；可以测量当前场景。');
    };
    const culling = this.panel.querySelector<HTMLInputElement>('[data-pod-culling]')!;
    culling.onchange = () => {
      const towers = this.engine.scene.getObjectByName('pod-distant-towers');
      if (!towers) { culling.checked = false; this.status('请在培养舱场景使用此对照项。'); return; }
      towers.frustumCulled = !culling.checked;
      this.status(culling.checked ? '绘制全部远景实例；可以测量当前场景。' : '只绘制视野内远景实例；可以测量当前场景。');
    };
    const copy = this.panel.querySelector<HTMLInputElement>('[data-occlusion-copy]')!;
    copy.onchange = () => {
      this.engine.postProcessing.occlusionInPlace = !copy.checked;
      this.status('可以测量当前场景。');
    };
    const live = document.createElement('p'); this.panel.appendChild(live);
    const fpsTimer = window.setInterval(() => { live.textContent = `当前 ${engine.fps.toFixed(1)} fps · ${document.visibilityState}`; }, 500);
    window.addEventListener('beforeunload', () => window.clearInterval(fpsTimer), { once: true });
    document.body.appendChild(this.panel);
    const shipLabel = document.createElement('label'); shipLabel.style.cssText = 'display:block;margin-top:6px';
    shipLabel.innerHTML = '<input type="checkbox" data-ship-static> 对照：飞船固定结构逐件绘制';
    this.panel.insertBefore(shipLabel, this.panel.querySelector('pre'));
    const shipComparison = shipLabel.querySelector('input')!;
    shipComparison.onchange = () => {
      const deck = this.engine.scene.getObjectByName('neb-interior-deck');
      const batches = deck?.children.filter(object => object.userData.unbatchedSiblings);
      if (!deck || !batches?.length) { shipComparison.checked = false; this.status('请在飞船场景使用此对照项。'); return; }
      for (const batch of batches) {
        batch.visible = !shipComparison.checked;
        const pieces = batch.userData.unbatchedSiblings as Object3D[];
        if (shipComparison.checked) deck.add(...pieces); else deck.remove(...pieces);
      }
      this.status('可以测量当前场景。');
    };
    const sentinelLabel = document.createElement('label'); sentinelLabel.style.cssText = 'display:block;margin-top:6px';
    sentinelLabel.innerHTML = '<input type="checkbox"> 对照：哨兵舱室固定部件逐件绘制';
    this.panel.insertBefore(sentinelLabel, this.panel.querySelector('pre'));
    sentinelLabel.querySelector('input')!.onchange = event => {
      const cockpit = this.engine.scene.getObjectByName('sentinel-cockpit'), batches: Object3D[] = [];
      cockpit?.traverse(object => { if (object.userData.unbatchedSiblings) batches.push(object); });
      const checkbox = event.target as HTMLInputElement;
      if (!batches.length) { checkbox.checked = false; this.status('请在哨兵静默潜伏场景使用此对照项。'); return; }
      for (const batch of batches) {
        batch.visible = !checkbox.checked;
        const pieces = batch.userData.unbatchedSiblings as Object3D[];
        if (checkbox.checked) batch.parent!.add(...pieces); else batch.parent!.remove(...pieces);
      }
      this.status('可以测量当前场景。');
    };
    this.gpuTimer = new GpuTimer(engine.renderer.getContext() as WebGL2RenderingContext);
    const support = document.createElement('p'); support.textContent = this.gpuTimer.supported ? `GPU计时：可用，${this.gpuTimer.counterBits}位计数器` : 'GPU计时：此浏览器未提供扩展';
    this.panel.appendChild(support);
    const mode = document.createElement('select'); mode.setAttribute('aria-label', 'GPU计时范围');
    mode.innerHTML = '<option value="cpu">CPU / FPS（不插入GPU查询）</option><option value="cpu-no-occlusion">CPU对照：跳过接触阴影</option><option value="cpu-no-shadows">CPU对照：跳过动态阴影</option><option value="cpu-no-render">CPU对照：冻结3D画面</option><option value="frame">整段渲染</option><option value="passes">分阶段（不可相加）</option><option value="empty">空区间校准</option><option value="no-occlusion">对照：跳过接触阴影</option><option value="no-render">对照：冻结3D画面</option>';
    this.panel.appendChild(mode);
    const lightLabel = document.createElement('label'); lightLabel.style.cssText = 'display:block;margin-top:6px';
    lightLabel.innerHTML = '<input type="checkbox"> 对照：保留视野外有限灯光';
    this.panel.insertBefore(lightLabel, this.panel.querySelector('pre'));
    lightLabel.querySelector('input')!.onchange = event => {
      this.engine.lightCulling.enabled = !(event.target as HTMLInputElement).checked;
      this.status('可以测量当前场景。');
    };
    const channelLabel = document.createElement('label'); channelLabel.style.cssText = 'display:block;margin-top:6px';
    channelLabel.innerHTML = '<input type="checkbox"> 对照：接触阴影使用四通道';
    this.panel.insertBefore(channelLabel, this.panel.querySelector('pre'));
    channelLabel.querySelector('input')!.onchange = event => {
      this.engine.postProcessing.occlusionSingleChannel = !(event.target as HTMLInputElement).checked;
      this.status('可以测量当前场景。');
    };
    const snapshot = document.createElement('button'); snapshot.textContent = '保存无损渲染帧';
    this.panel.appendChild(snapshot);
    snapshot.onclick = () => {
      if (engine.onProfile || engine.onRendered) { this.status('请先结束当前性能采样或录像。'); return; }
      snapshot.disabled = true; this.panel.querySelector('button')!.disabled = true;
      engine.onRendered = () => { engine.onRendered = undefined; void this.saveFrame(snapshot); };
    };
  }

  private async saveFrame(button: HTMLButtonElement): Promise<void> {
    try {
      const canvas = this.engine.renderer.domElement;
      const frame = { kind: 'render-frame', width: canvas.width, height: canvas.height,
        occlusionSingleChannel: this.engine.postProcessing.occlusionSingleChannel,
        sentinelStaticBatching: this.engine.scene.getObjectByName('sentinel-cockpit')?.children.find(object => object.userData.unbatchedSiblings)?.visible,
        camera: { position: this.engine.camera.position.toArray(), quaternion: this.engine.camera.quaternion.toArray() },
        png: canvas.toDataURL('image/png') };
      const filename = `neo-${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
      const response = await fetch(`/__recording/${filename}`, { method: 'POST', body: JSON.stringify(frame) });
      if (!response.ok) throw new Error(await response.text());
      this.status(`已保存无损渲染帧 ${filename}`);
    } catch (error) { this.status(`画面未保存：${error instanceof Error ? error.message : String(error)}`); }
    finally { button.disabled = false; this.panel.querySelector('button')!.disabled = false; }
  }

  private status(text: string): void { this.panel.querySelector('[role="status"]')!.textContent = text; }
  private start(): void {
    this.frames = []; this.passes = {}; this.drawTotals = {}; this.meshTotals.clear(); this.startAt = performance.now(); this.fpsBeforeSampling = this.engine.fps;
    this.browserEntries = [];
    this.animationTotals.clear();
    const actors = new Map(this.engine.agentRenderer.getAgentIds().map(id => [this.engine.agentRenderer.getAgentBody(id), id]));
    const characterAnimate = CharacterModels.prototype.animate, heroAnimate = HeroModels.prototype.animate, handsUpdate = FightingHands.prototype.update;
    let actor = 'unidentified', distance = 0, visible = false;
    const recordAnimation = (layer: string, start: number) => {
      if (start - this.startAt < 3000) return;
      const ms = performance.now() - start, key = `${actor}/${layer}`;
      const total = this.animationTotals.get(key) ?? { actor, layer, calls: 0, ms: 0, maxMs: 0, distance, visible };
      total.calls++; total.ms += ms; total.maxMs = Math.max(total.maxMs, ms); this.animationTotals.set(key, total);
    };
    CharacterModels.prototype.animate = function (rig, delta, input, actorDistance) {
      const previous = { actor, distance, visible };
      actor = actors.get(rig.root) ?? rig.root.name ?? 'unidentified'; distance = actorDistance; visible = true;
      for (let object: Object3D | null = rig.root; object; object = object.parent) visible &&= object.visible;
      const start = performance.now();
      try { return characterAnimate.call(this, rig, delta, input, actorDistance); }
      finally { recordAnimation('character', start); ({ actor, distance, visible } = previous); }
    };
    HeroModels.prototype.animate = function (...args) {
      const start = performance.now();
      try { return heroAnimate.apply(this, args); } finally { recordAnimation('hero', start); }
    };
    FightingHands.prototype.update = function (...args) {
      const start = performance.now();
      try { return handsUpdate.apply(this, args); } finally { recordAnimation('hands', start); }
    };
    this.restoreAnimations = () => {
      CharacterModels.prototype.animate = characterAnimate; HeroModels.prototype.animate = heroAnimate; FightingHands.prototype.update = handsUpdate;
    };
    for (const type of ['longtask', 'long-animation-frame']) {
      if (!PerformanceObserver.supportedEntryTypes.includes(type)) continue;
      const observer = new PerformanceObserver(list => { this.browserEntries.push(...list.getEntries()); });
      observer.observe({ type }); this.browserObservers.push(observer);
    }
    this.gpuTimer.dispose(); this.gpuTimer = new GpuTimer(this.engine.renderer.getContext() as WebGL2RenderingContext);
    const post = this.engine.postProcessing, render = post.render; this.restorePost = render;
    const gpuMode = this.panel.querySelector('select')!.value;
    const gpuQueries = !gpuMode.startsWith('cpu'), noRender = gpuMode === 'no-render' || gpuMode === 'cpu-no-render';
    const noOcclusion = gpuMode === 'no-occlusion' || gpuMode === 'cpu-no-occlusion';
    let gpuFrame = false;
    post.render = (...args) => {
      if (gpuQueries) { this.gpuTimer.poll(); gpuFrame = performance.now() - this.startAt >= 3000 && this.gpuTimer.begin(); }
      if (gpuMode === 'empty') this.gpuTimer.end('empty');
      const shadows = this.engine.renderer.shadowMap.enabled;
      if (gpuMode === 'cpu-no-shadows') this.engine.renderer.shadowMap.enabled = false;
      try { if (!noRender) render.apply(post, noOcclusion ? [false] : args); }
      finally { this.engine.renderer.shadowMap.enabled = shadows; this.gpuTimer.end(gpuMode === 'passes' ? 'unfinished' : noRender ? 'empty-without-rendering' : 'frame'); gpuFrame = false; }
    };
    this.restoreAutoReset = this.engine.renderer.info.autoReset; this.engine.renderer.info.autoReset = false;
    let frameDraws: typeof this.drawTotals = {};
    let frameMeshes: typeof this.meshTotals = new Map();
    const renderer = this.engine.renderer; const draw = renderer.renderBufferDirect; this.restoreDraw = draw;
    renderer.renderBufferDirect = (...args) => {
      const [camera, , , material, object] = args;
      const pass = material.type === 'MeshDepthMaterial' || material.type === 'MeshDistanceMaterial' ? 'shadows'
        : material.type === 'MeshNormalMaterial' ? 'occlusion' : camera === this.engine.camera ? 'scene'
          : camera.type === 'PerspectiveCamera' ? 'reflectionOrPreview' : 'postprocessing';
      const calls = renderer.info.render.calls; const triangles = renderer.info.render.triangles;
      draw.apply(renderer, args);
      const total = frameDraws[pass] ??= { calls: 0, triangles: 0 };
      total.calls += renderer.info.render.calls - calls; total.triangles += renderer.info.render.triangles - triangles;
      const mesh = frameMeshes.get(object) ?? { calls: 0, triangles: 0 };
      mesh.calls += renderer.info.render.calls - calls; mesh.triangles += renderer.info.render.triangles - triangles;
      frameMeshes.set(object, mesh);
    };
    this.restoreMatrices = this.engine.scene.updateMatrixWorld;
    const matrices = this.restoreMatrices;
    this.engine.scene.updateMatrixWorld = force => {
      const start = performance.now(); matrices.call(this.engine.scene, force);
      if (performance.now() - this.startAt >= 3000) (this.passes.worldMatrices ??= []).push(performance.now() - start);
    };
    this.panel.querySelector('button')!.disabled = true; this.panel.querySelector('select')!.disabled = true; this.panel.querySelectorAll<HTMLInputElement>('input').forEach(input => { input.disabled = true; }); this.status('预热中，保持当前视角…');
    this.engine.postProcessing.onMeasure = (name, ms) => {
      if (performance.now() - this.startAt >= 3000) (this.passes[name] ??= []).push(ms);
      if (gpuFrame && gpuMode === 'passes' && ['scene', 'occlusion', 'bloom', 'output', 'antialias'].includes(name)) {
        this.gpuTimer.end(name); if (name !== 'antialias') this.gpuTimer.begin();
      }
    };
    this.engine.onProfile = frame => {
      const elapsed = frame.at - this.startAt;
      const draws = frameDraws; frameDraws = {};
      const meshes = frameMeshes; frameMeshes = new Map();
      if (elapsed < 3000) return;
      for (const [name, count] of Object.entries(draws)) {
        const total = this.drawTotals[name] ??= { calls: 0, triangles: 0 };
        total.calls += count.calls; total.triangles += count.triangles;
      }
      for (const [mesh, count] of meshes) {
        const total = this.meshTotals.get(mesh) ?? { calls: 0, triangles: 0 };
        total.calls += count.calls; total.triangles += count.triangles; this.meshTotals.set(mesh, total);
      }
      this.frames.push(frame);
      if (this.frames.length % 30 === 0) this.status(`采样 ${Math.min(15, Math.round((elapsed - 3000) / 1000))} / 15 秒 · ${this.frames.length} 帧`);
      if (elapsed >= 18000) void this.finish();
    };
  }

  private async finish(): Promise<void> {
    this.restoreAnimations!(); this.restoreAnimations = undefined;
    for (const observer of this.browserObservers) { this.browserEntries.push(...observer.takeRecords()); observer.disconnect(); }
    this.browserObservers = [];
    this.engine.onProfile = undefined; this.engine.postProcessing.onMeasure = undefined;
    this.engine.postProcessing.render = this.restorePost!; this.gpuTimer.poll();
    this.engine.renderer.info.autoReset = this.restoreAutoReset;
    this.engine.renderer.renderBufferDirect = this.restoreDraw!;
    this.engine.scene.updateMatrixWorld = this.restoreMatrices!;
    const summarize = (values: number[]) => {
      const sorted = [...values].sort((a, b) => a - b);
      return { mean: values.reduce((a, b) => a + b, 0) / values.length, p95: sorted[Math.ceil(sorted.length * .95) - 1] };
    };
    const intervals = this.frames.slice(1).map((frame, i) => frame.at - this.frames[i].at);
    const sections = Object.fromEntries(Object.keys(this.frames[0].sections).map(name => [name, summarize(this.frames.map(frame => frame.sections[name]))]));
    const passes = Object.fromEntries(Object.entries(this.passes).map(([name, values]) => [name, summarize(values)]));
    const frameTime = summarize(intervals);
    const gpuPassMs = Object.fromEntries(Object.entries(this.gpuTimer.times).map(([name, times]) => [name, { ...summarize(times), samples: times.length }]));
    const gpuTiming = { mode: this.panel.querySelector('select')!.value, supported: this.gpuTimer.supported, counterBits: this.gpuTimer.counterBits, discarded: this.gpuTimer.discarded, pendingAtStop: this.gpuTimer.pendingCount,
      intervalsAreNotAdditive: true, glErrorAtStop: (this.engine.renderer.getContext() as WebGL2RenderingContext).getError() };
    this.gpuTimer.dispose();
    const gl = this.engine.renderer.getContext(); const debug = gl.getExtension('WEBGL_debug_renderer_info');
    let objects = 0; let visibleObjects = 0;
    this.engine.scene.traverse(() => objects++); this.engine.scene.traverseVisible(() => visibleObjects++);
    const podTowers = this.engine.scene.getObjectByName('pod-distant-towers');
    const lightFrustum = new Frustum().setFromProjectionMatrix(new Matrix4().multiplyMatrices(this.engine.camera.projectionMatrix, this.engine.camera.matrixWorldInverse));
    const lights: { name: string; type: string; intensity: number; distance: number; intersectsView: boolean; position: number[] }[] = [];
    this.engine.scene.traverseVisible(object => {
      if (object instanceof PointLight) {
        const position = object.getWorldPosition(new Vector3());
        lights.push({ name: object.name, type: object.type, intensity: object.intensity, distance: object.distance, intersectsView: !object.distance || lightFrustum.intersectsSphere(new Sphere(position, object.distance)), position: position.toArray() });
      }
    });
    const report = {
      characterCpu: { layersAreNested: true, actors: [...this.animationTotals.values()].sort((a, b) => b.ms - a.ms).map(total => ({
        ...total, msPerFrame: total.ms / this.frames.length, callsPerFrame: total.calls / this.frames.length,
      })) },
      browserMainThread: { supported: PerformanceObserver.supportedEntryTypes.filter(type => ['longtask', 'long-animation-frame'].includes(type)),
        entries: this.browserEntries.filter(entry => entry.startTime >= this.startAt + 3000).map(entry => entry.toJSON()) },
      lights,
      finiteLightCulling: { enabled: this.engine.lightCulling.enabled, ...this.engine.lightCulling.lastView },
      occlusionInPlace: this.engine.postProcessing.occlusionInPlace,
      occlusionSingleChannel: this.engine.postProcessing.occlusionSingleChannel,
      shipStaticBatching: this.engine.scene.getObjectByName('neb-interior-deck')?.children.find(object => object.userData.unbatchedSiblings)?.visible,
      sentinelStaticBatching: this.engine.scene.getObjectByName('sentinel-cockpit')?.children.find(object => object.userData.unbatchedSiblings)?.visible,
      podDistantNormals: podTowers ? podTowers.userData.distantBackdrop === false : undefined,
      podInstanceCulling: podTowers?.frustumCulled,
      camera: { position: this.engine.camera.position.toArray(), quaternion: this.engine.camera.quaternion.toArray(), projection: this.engine.camera.projectionMatrix.toArray() },
      measuredAt: new Date().toISOString(), scenes: [...new Set(this.frames.map(frame => frame.scene))],
      viewport: { width: window.innerWidth, height: window.innerHeight, pixelRatio: this.engine.renderer.getPixelRatio() },
      frames: this.frames.length, fps: 1000 / frameTime.mean, frameTime, cpuMs: sections, passCpuMs: passes,
      gpuPassMs, gpuTiming,
      calls: summarize(this.frames.map(frame => frame.calls)), triangles: summarize(this.frames.map(frame => frame.triangles)),
      drawsPerFrame: Object.fromEntries(Object.entries(this.drawTotals).map(([name, total]) => [name, {
        calls: total.calls / this.frames.length, triangles: total.triangles / this.frames.length,
      }])),
      heaviestMeshes: [...this.meshTotals].sort((a, b) => b[1].triangles - a[1].triangles).slice(0, 20).map(([mesh, total]) => ({
        name: mesh.name, parent: mesh.parent?.name, type: mesh.type,
        calls: total.calls / this.frames.length, triangles: total.triangles / this.frames.length,
      })),
      gpu: debug ? gl.getParameter(debug.UNMASKED_RENDERER_WEBGL) as string : 'unavailable',
      recordingActive: Boolean(this.engine.onRendered), engineFpsDisplay: this.engine.fps, fpsBeforeSampling: this.fpsBeforeSampling,
      pageVisibility: document.visibilityState, contextAntialias: gl.getContextAttributes()?.antialias, profilingDrawInstrumentation: true,
      objects, visibleObjects,
    };
    this.meshTotals.clear();
    this.status(`${report.fps.toFixed(1)} fps · p95 ${frameTime.p95.toFixed(1)} ms\n${Object.entries(sections).map(([name, time]) => `${name}: ${time.mean.toFixed(2)} ms`).join('\n')}\n人物分层（不可相加）：\n${report.characterCpu.actors.slice(0, 6).map(total => `${total.actor} ${total.layer}: ${total.msPerFrame.toFixed(2)} ms`).join('\n')}\nGPU ms：${Object.entries(gpuPassMs).map(([name, time]) => `${name} ${time.mean.toFixed(2)}`).join(' · ') || (gpuTiming.mode.startsWith('cpu') ? '未采样' : '不可用')}\n提交绘制 ${report.calls.mean.toFixed(0)} 次 / 帧\n保存报告中…`);
    try {
      const filename = `neo-${report.measuredAt.replace(/[:.]/g, '-')}.json`;
      const response = await fetch(`/__recording/${filename}`, { method: 'POST', body: JSON.stringify(report, null, 2) });
      if (!response.ok) throw new Error(await response.text());
      this.status(this.panel.querySelector('[role="status"]')!.textContent!.replace('保存报告中…', `已保存 ${filename}`));
    } catch (error) { this.status(`报告未保存：${error instanceof Error ? error.message : String(error)}`); }
    this.panel.querySelector('button')!.disabled = false; this.panel.querySelector('select')!.disabled = false; this.panel.querySelectorAll<HTMLInputElement>('input').forEach(input => { input.disabled = false; });
  }
}
