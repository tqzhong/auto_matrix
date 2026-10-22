type TimerExtension = { TIME_ELAPSED_EXT: number; QUERY_COUNTER_BITS_EXT: number; GPU_DISJOINT_EXT: number };

/** Development-only GPU intervals. Results are read on later frames, never by waiting. */
export class GpuTimer {
  readonly times: Record<string, number[]> = {};
  readonly counterBits: number;
  readonly supported: boolean;
  discarded = 0;
  private extension: TimerExtension | null;
  private active?: WebGLQuery;
  private pending: { query: WebGLQuery; name: string }[] = [];
  get pendingCount(): number { return this.pending.length; }

  constructor(private gl: WebGL2RenderingContext) {
    this.extension = gl.getExtension('EXT_disjoint_timer_query_webgl2') as TimerExtension | null;
    this.counterBits = this.extension ? gl.getQuery(this.extension.TIME_ELAPSED_EXT, this.extension.QUERY_COUNTER_BITS_EXT) as number : 0;
    this.supported = this.counterBits > 0;
  }
  begin(): boolean {
    if (!this.supported || this.active || this.pending.length >= 64) return false;
    const query = this.gl.createQuery(); if (!query) return false;
    this.gl.beginQuery(this.extension!.TIME_ELAPSED_EXT, query); this.active = query; return true;
  }
  end(name: string): void {
    if (!this.active) return;
    this.gl.endQuery(this.extension!.TIME_ELAPSED_EXT);
    this.pending.push({ query: this.active, name }); this.active = undefined;
  }
  poll(): void {
    if (!this.supported) return;
    if (this.gl.getParameter(this.extension!.GPU_DISJOINT_EXT)) {
      this.discarded += this.pending.length;
      for (const { query } of this.pending) this.gl.deleteQuery(query);
      this.pending = [];
      for (const name of Object.keys(this.times)) delete this.times[name];
      return;
    }
    this.pending = this.pending.filter(({ query, name }) => {
      if (!this.gl.getQueryParameter(query, this.gl.QUERY_RESULT_AVAILABLE)) return true;
      const nanoseconds = this.gl.getQueryParameter(query, this.gl.QUERY_RESULT) as number;
      (this.times[name] ??= []).push(nanoseconds / 1_000_000);
      this.gl.deleteQuery(query); return false;
    });
  }
  dispose(): void {
    this.end('unfinished');
    for (const { query } of this.pending) this.gl.deleteQuery(query);
    this.pending = [];
  }
}
