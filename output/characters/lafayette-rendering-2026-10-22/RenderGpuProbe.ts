// Isolated QA instrumentation. Never imported by the production game.
import type { Engine } from './Engine.js';

export function observeGpuPasses(engine: Engine, ready: () => boolean) {
  const gl = engine.renderer.getContext() as WebGL2RenderingContext;
  const extension = gl.getExtension('EXT_disjoint_timer_query_webgl2');
  const samples: Record<string, number[]> = {}, pending: { name: string; query: WebGLQuery }[] = [];
  let discarded = 0;
  const drain = () => {
    if (!extension) return;
    const invalid = gl.getParameter(extension.GPU_DISJOINT_EXT);
    for (let i = pending.length - 1; i >= 0; i--) {
      const item = pending[i];
      if (!invalid && !gl.getQueryParameter(item.query, gl.QUERY_RESULT_AVAILABLE)) continue;
      if (invalid) discarded++;
      else (samples[item.name] ??= []).push(gl.getQueryParameter(item.query, gl.QUERY_RESULT) / 1e6);
      gl.deleteQuery(item.query); pending.splice(i, 1);
    }
  };
  const passes = (engine.postProcessing as unknown as { composer: { passes: { render: (...args: unknown[]) => void }[] } }).composer.passes;
  const restores: (() => void)[] = [];
  if (extension) {
    gl.getParameter(extension.GPU_DISJOINT_EXT);
    for (const [i, name] of ['scene', 'occlusion', 'bloom', 'output', 'antialias'].entries()) {
      const pass = passes[i], render = pass.render;
      pass.render = function (...args) {
        drain();
        if (!ready()) return render.apply(this, args);
        const query = gl.createQuery();
        if (!query) return render.apply(this, args);
        gl.beginQuery(extension.TIME_ELAPSED_EXT, query);
        try { return render.apply(this, args); }
        finally { gl.endQuery(extension.TIME_ELAPSED_EXT); pending.push({ name, query }); }
      };
      restores.push(() => { pass.render = render; });
    }
  }
  return () => {
    drain(); restores.forEach(restore => restore());
    const unread = pending.length;
    for (const item of pending) gl.deleteQuery(item.query);
    pending.length = 0;
    return { supported: Boolean(extension), discardedDisjoint: discarded, unreadAtFinish: unread,
      gpuMs: Object.fromEntries(Object.entries(samples).map(([name, values]) => {
        const sorted = [...values].sort((a, b) => a - b);
        return [name, { count: values.length, mean: values.reduce((a, b) => a + b, 0) / values.length,
          median: sorted[Math.floor(sorted.length / 2)], p95: sorted[Math.ceil(sorted.length * .95) - 1] }];
      })) };
  };
}
