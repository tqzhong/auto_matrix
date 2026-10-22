import assert from 'node:assert/strict';
import test from 'node:test';
import { GpuTimer } from '../packages/client/src/player/GpuTimer.js';

function context(supported = true) {
  const extension = { TIME_ELAPSED_EXT: 1, QUERY_COUNTER_BITS_EXT: 2, GPU_DISJOINT_EXT: 3 };
  const results = new Map<WebGLQuery, { available: boolean; nanoseconds: number }>();
  const deleted: WebGLQuery[] = []; let active: WebGLQuery | undefined, reads = 0, disjoint = false;
  const gl = {
    QUERY_RESULT_AVAILABLE: 4, QUERY_RESULT: 5,
    getExtension: () => supported ? extension : null, getQuery: () => 64,
    createQuery: () => { const query = {} as WebGLQuery; results.set(query, { available: false, nanoseconds: 0 }); return query; },
    beginQuery: (_: number, query: WebGLQuery) => { assert.equal(active, undefined, 'GPU time intervals cannot nest'); active = query; },
    endQuery: () => { assert.ok(active); active = undefined; },
    getParameter: () => disjoint,
    getQueryParameter: (query: WebGLQuery, parameter: number) => {
      const result = results.get(query)!;
      if (parameter === 4) return result.available;
      reads++; assert.equal(result.available, true, 'reading an unavailable result would stall instead of observing'); return result.nanoseconds;
    },
    deleteQuery: (query: WebGLQuery) => { assert.ok(!deleted.includes(query), 'release each GPU query exactly once'); deleted.push(query); },
  } as unknown as WebGL2RenderingContext;
  return { gl, results, deleted, reads: () => reads, disjoint: () => { disjoint = true; } };
}

test('GPU intervals are read asynchronously and preserve all64 timer bits before converting nanoseconds', () => {
  const h = context(), timer = new GpuTimer(h.gl);
  assert.equal(timer.begin(), true); assert.equal(timer.begin(), false); timer.end('scene'); timer.poll();
  assert.equal(h.reads(), 0); assert.equal(timer.pendingCount, 1);
  const result = [...h.results.values()][0]; result.available = true; result.nanoseconds = 6_123_456_789;
  timer.poll(); assert.deepEqual(timer.times.scene, [6123.456789]); assert.equal(timer.pendingCount, 0);
  timer.dispose(); assert.equal(h.deleted.length, 1);
});

test('a disjoint GPU clock discards pending and accumulated measurements instead of publishing invalid timings', () => {
  const h = context(), timer = new GpuTimer(h.gl);
  timer.begin(); timer.end('scene'); [...h.results.values()][0].available = true; timer.poll();
  timer.begin(); timer.end('bloom'); h.disjoint(); timer.poll();
  assert.deepEqual(timer.times, {}); assert.equal(timer.discarded, 1); assert.equal(timer.pendingCount, 0);
  timer.dispose(); assert.equal(h.deleted.length, 2);
});

test('unsupported drivers remain usable and unresolved GPU queries have a bounded lifetime and count', () => {
  const unavailable = context(false), unsupported = new GpuTimer(unavailable.gl);
  assert.equal(unsupported.begin(), false); unsupported.end('scene'); unsupported.poll(); unsupported.dispose();
  assert.equal(unavailable.results.size, 0);
  const h = context(), timer = new GpuTimer(h.gl);
  for (let frame = 0; frame < 100; frame++) { timer.begin(); timer.end('scene'); }
  assert.equal(timer.pendingCount, 64); assert.equal(h.results.size, 64);
  timer.dispose(); timer.dispose(); assert.equal(h.deleted.length, 64); assert.equal(timer.pendingCount, 0);
});

test('stopping an active measurement closes and releases its query without waiting for GPU completion', () => {
  const h = context(), timer = new GpuTimer(h.gl);
  timer.begin(); timer.dispose(); assert.equal(h.deleted.length, 1); assert.equal(h.reads(), 0);
  timer.begin(); timer.end('scene'); const result = [...h.results.values()].at(-1)!;
  result.available = true; result.nanoseconds = 2_000_000; timer.poll();
  assert.deepEqual(timer.times.scene, [2]); timer.dispose(); assert.equal(h.deleted.length, 2);
});
