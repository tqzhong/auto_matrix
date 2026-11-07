import assert from 'node:assert/strict';
import test from 'node:test';
import { GameplayRecorder } from '../packages/client/src/player/GameplayRecorder.js';

function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>(done => { resolve = done; });
  return { promise, resolve };
}

function fixture(t: test.TestContext, options: { audio?: Promise<void>; captureError?: boolean; supported?: boolean; startError?: boolean; write?: Promise<void> } = {}) {
  const previous = { window: globalThis.window, MediaRecorder: globalThis.MediaRecorder };
  const streams: { getTracks(): { stops: number; stop(): void }[]; addTrack(track: { stops: number; stop(): void }): void }[] = [];
  const track = () => ({ stops: 0, stop() { this.stops++; } });
  const sourceAudio = track(), intervals = new Set<number>(), recorders: Recorder[] = [];
  const writes: { extension: string; id: string; body: BodyInit }[] = [];
  class Recorder {
    static isTypeSupported() { return options.supported !== false; }
    state = 'inactive';
    ondataavailable?: (event: { data: Blob }) => void;
    onstop?: () => void;
    onerror?: () => void;
    constructor() { recorders.push(this); }
    start() {
      if (options.startError) throw new Error('encoder start failed');
      assert.equal(this.state, 'inactive'); this.state = 'recording';
    }
    stop() {
      assert.equal(this.state, 'recording'); this.state = 'inactive';
      queueMicrotask(() => { this.ondataavailable?.({ data: new Blob(['frame']) }); this.onstop?.(); });
    }
  }
  globalThis.MediaRecorder = Recorder as unknown as typeof MediaRecorder;
  globalThis.window = {
    innerWidth: 1920, innerHeight: 1080,
    setInterval() { const id = intervals.size + 1; intervals.add(id); return id; },
    clearInterval(id: number) { intervals.delete(id); },
  } as unknown as Window & typeof globalThis;
  const button = { textContent: '', disabled: false }, status = { textContent: '' };
  const engine = { onRendered: undefined as (() => void) | undefined, renderer: { domElement: {} }, audio: {
    async recordingAudio() { await options.audio; return { getAudioTracks: () => [{ ...sourceAudio, clone: track }] }; },
  } };
  const recorder = Object.assign(Object.create(GameplayRecorder.prototype), {
    toolbar: { querySelector: (selector: string) => selector === '[data-record]' ? button : status },
    engine, context: { drawImage() {} }, saved: Promise.resolve(), frameTimes: [],
    canvas: { width: 0, height: 0, captureStream() {
      const tracks = [track()];
      const stream = { getTracks: () => tracks, addTrack: (value: ReturnType<typeof track>) => tracks.push(value) };
      streams.push(stream); return stream;
    } },
    async captureUI() { if (options.captureError) throw new Error('UI image decode failed'); },
    async write(extension: string, body: BodyInit) {
      writes.push({ extension, id: this.id, body }); if (extension === 'webm') await options.write;
    },
  });
  const finishes: Promise<void>[] = [], finish = recorder.finish;
  recorder.finish = (stream: MediaStream) => { const promise = finish.call(recorder, stream); finishes.push(promise); return promise; };
  const cleanup = async () => {
    for (const recorder of recorders) if (recorder.state === 'recording') recorder.stop();
    await new Promise(resolve => setImmediate(resolve)); await Promise.allSettled(finishes);
    for (const stream of streams) for (const track of stream.getTracks()) if (!track.stops) track.stop();
  };
  t.after(async () => { try { await cleanup(); } finally { Object.assign(globalThis, previous); } });
  return { recorder, streams, recorders, engine, writes, intervals, sourceAudio, button, cleanup };
}

test('a second start while audio is preparing cannot allocate another capture stream', async t => {
  const audio = deferred(), f = fixture(t, { audio: audio.promise });
  const first = f.recorder.start(), second = f.recorder.start();
  audio.resolve(); const results = await Promise.allSettled([first, second]);
  assert.equal(f.streams.length, 1, 'one pending start must own exactly one video stream');
  assert.equal(f.recorders.length, 1, 'another click must not orphan an encoder');
  assert.ok(results.every(result => result.status === 'fulfilled'));
});

for (const failure of ['captureError', 'supported', 'startError'] as const) test(`failed recording startup releases video and cloned audio tracks (${failure})`, async t => {
  const f = fixture(t, { [failure]: failure === 'supported' ? false : true });
  await assert.rejects(f.recorder.start());
  assert.equal(f.streams.length, 1);
  assert.ok(f.streams[0].getTracks().every(track => track.stops === 1), 'failed startup cannot retain live capture tracks');
  assert.equal(f.intervals.size, 0, 'failed startup must release the UI capture interval');
  assert.equal(f.engine.onRendered, undefined, 'failed startup cannot keep copying game frames');
  assert.equal(f.sourceAudio.stops, 0, 'only cloned recording tracks may stop');
});

test('saving prevents a new recording from replacing pending chunks and releases completed frame timings', async t => {
  const write = deferred(), f = fixture(t, { write: write.promise });
  try {
    await f.recorder.start();
    f.recorder.frameTimes = [16, 18];
    const id = f.recorder.id, finished = deferred(), finish = f.recorder.finish;
    f.recorder.finish = async (stream: MediaStream) => { try { await finish.call(f.recorder, stream); } finally { finished.resolve(); } };
    f.recorders[0].stop();
    await new Promise(resolve => setImmediate(resolve));
    await f.recorder.start();
    assert.equal(f.streams.length, 1, 'the old encoder and its writes must finish before another stream starts');
    assert.equal(f.recorder.id, id);
    write.resolve(); await finished.promise;
    assert.deepEqual(f.writes.map(w => w.extension), ['webm', 'json']);
    assert.ok(f.writes.every(w => w.id === id), 'all chunks and metadata must use the original recording ID');
    const metadata = JSON.parse(f.writes[1].body as string);
    assert.equal(metadata.rendering.frames, 3); assert.equal(metadata.rendering.p95FrameMs, 18);
    assert.deepEqual(f.recorder.frameTimes, [], 'a saved recording must release its per-frame array');
    assert.equal(f.intervals.size, 0);
    assert.ok(f.streams[0].getTracks().every(track => track.stops === 1));
    assert.equal(f.sourceAudio.stops, 0);
    await f.recorder.start(); assert.equal(f.streams.length, 2, 'recording becomes available again after saving');
  } finally { write.resolve(); await f.cleanup(); }
});
