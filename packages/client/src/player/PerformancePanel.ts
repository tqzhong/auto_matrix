import type { Engine, FrameProfile } from '../engine/Engine.js';

// Opt-in development measurement. It observes actual frames without creating a
// capture canvas, encoding video, changing the camera, or advancing the story.
export class PerformancePanel {
  private panel = document.createElement('div');
  private frames: FrameProfile[] = [];
  private passes: Record<string, number[]> = {};
  private startAt = 0;
  private restoreAutoReset = true;
  private restoreMatrices?: Engine['scene']['updateMatrixWorld'];

  constructor(private engine: Engine) {
    this.panel.id = 'performance-panel';
    this.panel.style.cssText = 'position:fixed;z-index:9999;right:16px;top:80px;width:290px;padding:12px;background:#102019f2;color:#e6efdf;border:1px solid #94a386;font:12px/1.6 monospace';
    this.panel.innerHTML = '<b>性能检查 · 开发模式</b><p>预热 3 秒，采样 15 秒；不录制视频。</p><button>测量当前场景</button><pre role="status" style="white-space:pre-wrap">尚未采样</pre>';
    this.panel.querySelector('button')!.onclick = () => this.start();
    document.body.appendChild(this.panel);
  }

  private status(text: string): void { this.panel.querySelector('[role="status"]')!.textContent = text; }
  private start(): void {
    this.frames = []; this.passes = {}; this.startAt = performance.now();
    this.restoreAutoReset = this.engine.renderer.info.autoReset; this.engine.renderer.info.autoReset = false;
    this.restoreMatrices = this.engine.scene.updateMatrixWorld;
    const matrices = this.restoreMatrices;
    this.engine.scene.updateMatrixWorld = force => {
      const start = performance.now(); matrices.call(this.engine.scene, force);
      if (performance.now() - this.startAt >= 3000) (this.passes.worldMatrices ??= []).push(performance.now() - start);
    };
    this.panel.querySelector('button')!.disabled = true; this.status('预热中，保持当前视角…');
    this.engine.postProcessing.onMeasure = (name, ms) => {
      if (performance.now() - this.startAt >= 3000) (this.passes[name] ??= []).push(ms);
    };
    this.engine.onProfile = frame => {
      const elapsed = frame.at - this.startAt;
      if (elapsed < 3000) return;
      this.frames.push(frame);
      if (this.frames.length % 30 === 0) this.status(`采样 ${Math.min(15, Math.round((elapsed - 3000) / 1000))} / 15 秒 · ${this.frames.length} 帧`);
      if (elapsed >= 18000) void this.finish();
    };
  }

  private async finish(): Promise<void> {
    this.engine.onProfile = undefined; this.engine.postProcessing.onMeasure = undefined;
    this.engine.renderer.info.autoReset = this.restoreAutoReset;
    this.engine.scene.updateMatrixWorld = this.restoreMatrices!;
    const summarize = (values: number[]) => {
      const sorted = [...values].sort((a, b) => a - b);
      return { mean: values.reduce((a, b) => a + b, 0) / values.length, p95: sorted[Math.ceil(sorted.length * .95) - 1] };
    };
    const intervals = this.frames.slice(1).map((frame, i) => frame.at - this.frames[i].at);
    const sections = Object.fromEntries(Object.keys(this.frames[0].sections).map(name => [name, summarize(this.frames.map(frame => frame.sections[name]))]));
    const passes = Object.fromEntries(Object.entries(this.passes).map(([name, values]) => [name, summarize(values)]));
    const frameTime = summarize(intervals);
    const gl = this.engine.renderer.getContext(); const debug = gl.getExtension('WEBGL_debug_renderer_info');
    let objects = 0; let visibleObjects = 0;
    this.engine.scene.traverse(() => objects++); this.engine.scene.traverseVisible(() => visibleObjects++);
    const report = {
      measuredAt: new Date().toISOString(), scenes: [...new Set(this.frames.map(frame => frame.scene))],
      viewport: { width: window.innerWidth, height: window.innerHeight, pixelRatio: this.engine.renderer.getPixelRatio() },
      frames: this.frames.length, fps: 1000 / frameTime.mean, frameTime, cpuMs: sections, passCpuMs: passes,
      calls: summarize(this.frames.map(frame => frame.calls)), triangles: summarize(this.frames.map(frame => frame.triangles)),
      gpu: debug ? gl.getParameter(debug.UNMASKED_RENDERER_WEBGL) as string : 'unavailable',
      recordingActive: Boolean(this.engine.onRendered), engineFpsDisplay: this.engine.fps,
      objects, visibleObjects,
    };
    this.status(`${report.fps.toFixed(1)} fps · p95 ${frameTime.p95.toFixed(1)} ms\n${Object.entries(sections).map(([name, time]) => `${name}: ${time.mean.toFixed(2)} ms`).join('\n')}\n提交绘制 ${report.calls.mean.toFixed(0)} 次 / 帧\n保存报告中…`);
    try {
      const filename = `neo-${report.measuredAt.replace(/[:.]/g, '-')}.json`;
      const response = await fetch(`/__recording/${filename}`, { method: 'POST', body: JSON.stringify(report, null, 2) });
      if (!response.ok) throw new Error(await response.text());
      this.status(this.panel.querySelector('[role="status"]')!.textContent!.replace('保存报告中…', `已保存 ${filename}`));
    } catch (error) { this.status(`报告未保存：${error instanceof Error ? error.message : String(error)}`); }
    this.panel.querySelector('button')!.disabled = false;
  }
}
