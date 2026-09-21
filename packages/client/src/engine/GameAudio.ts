import { MUSIC, MusicDirector, isActionMusic, type MusicCue, type MusicScene } from './Soundtrack.js';
import { FILM_MUSIC, filmCredit, type FilmTrack } from './OriginalScore.js';

type Channel = 'music' | 'effects';
export interface AudioSettings { music: number; effects: number; musicMuted: boolean; effectsMuted: boolean }
export function readAudioSettings(saved: string | null): AudioSettings {
  const settings = { music: .48, effects: .8, musicMuted: false, effectsMuted: false };
  try {
    const value = JSON.parse(saved ?? '{}');
    for (const key of ['music', 'effects'] as const) if (typeof value?.[key] === 'number' && Number.isFinite(value[key])) settings[key] = Math.max(0, Math.min(1, value[key]));
    for (const key of ['musicMuted', 'effectsMuted'] as const) if (typeof value?.[key] === 'boolean') settings[key] = value[key];
  } catch { /* Old or unavailable browser settings must not stop the game. */ }
  return settings;
}

interface Voice { cue: MusicCue; original: FilmTrack; gain: GainNode; start: () => void; stop: (at: number) => void; dispose: () => void }
export class GameAudio {
  private context?: AudioContext;
  private musicBus?: GainNode;
  private effectsBus?: GainNode;
  private master?: GainNode;
  private recording?: MediaStreamAudioDestinationNode;
  private director = new MusicDirector();
  private sceneCue: MusicCue = 'matrix';
  private preview?: MusicCue;
  private desired: MusicCue = 'matrix';
  private current?: Voice;
  private voices = new Set<Voice>();
  private buffers = new Map<string, AudioBuffer>();
  private loading?: MusicCue;
  private request = 0;
  private abort?: AbortController;
  private failed = false;
  private disposed = false;
  private reading = new Set<string>();
  private running = true;
  private playing = false;
  private mixValues = new Map<GainNode, number>();
  private dialogueTimer = 0;
  readonly settings: AudioSettings;
  onChange?: () => void;

  constructor() {
    let saved = null;
    try { saved = localStorage.getItem('matrix:audio'); } catch { /* Storage may be disabled. */ }
    this.settings = readAudioSettings(saved);
    window.addEventListener('pointerdown', this.unlock);
    window.addEventListener('keydown', this.unlock);
    document.addEventListener('visibilitychange', this.visibility);
  }
  get cue(): MusicCue { return this.current?.cue ?? this.desired; }
  get trackName(): string { return FILM_MUSIC[this.cue].title; }
  get trackCredit(): string { return filmCredit(FILM_MUSIC[this.cue]); }
  get previewCue(): MusicCue | undefined { return this.preview; }
  get status(): string {
    if (document.hidden) return '已在后台静音';
    if (this.settings.musicMuted || this.settings.music === 0) return '背景音乐已静音';
    if (this.failed) return '此场景原声暂时无法播放，请重试';
    if (this.context?.state !== 'running') return '点击画面或按键后开启音乐';
    if (this.loading) return '正在载入下一段配乐…';
    return this.current ? '正在播放' : '准备播放';
  }
  private unlock = (): void => { void this.resume(); };
  async resume(): Promise<void> {
    if (this.disposed || document.hidden) return;
    try {
      if (!this.context) {
        const ctx = this.context = new AudioContext();
        this.musicBus = ctx.createGain(); this.effectsBus = ctx.createGain(); this.master = ctx.createGain();
        const limiter = ctx.createDynamicsCompressor();
        limiter.threshold.value = -6; limiter.knee.value = 6; limiter.ratio.value = 8; limiter.attack.value = .003; limiter.release.value = .15;
        this.musicBus.connect(this.master); this.effectsBus.connect(this.master);
        this.master.connect(limiter); limiter.connect(ctx.destination);
        this.recording = ctx.createMediaStreamDestination(); limiter.connect(this.recording);
        ctx.onstatechange = () => this.onChange?.();
        this.mix(true);
      }
      if (this.context.state === 'suspended') await this.context.resume();
      if (this.disposed) return;
      this.ensureMusic(); this.onChange?.();
    } catch { this.failed = true; this.onChange?.(); }
  }
  update(scene: MusicScene): void {
    this.running = scene.running; this.playing = Boolean(scene.player);
    this.sceneCue = this.director.update(scene, performance.now());
    this.select(this.preview ?? this.sceneCue);
    this.mix(); this.ensureMusic();
  }
  private select(next: MusicCue): void {
    if (next !== this.desired) { this.desired = next; this.failed = false; this.onChange?.(); }
  }
  audition(cue?: MusicCue): void {
    this.preview = cue; this.select(cue ?? this.sceneCue);
    this.ensureMusic(); void this.resume(); this.onChange?.();
  }
  impact(): void { this.director.impact(performance.now()); }
  setReading(reason: string, open: boolean): void {
    if (open) this.reading.add(reason); else this.reading.delete(reason);
    this.mix();
  }
  dialogue(): void {
    this.setReading('dialogue', true); window.clearTimeout(this.dialogueTimer);
    this.dialogueTimer = window.setTimeout(() => this.setReading('dialogue', false), 6500);
  }
  setVolume(channel: Channel, value: number): void {
    this.settings[channel] = Math.max(0, Math.min(1, value)); this.save();
  }
  toggle(channel: Channel): void {
    const key = channel === 'music' ? 'musicMuted' : 'effectsMuted';
    this.settings[key] = !this.settings[key]; this.save();
  }
  private save(): void {
    try { localStorage.setItem('matrix:audio', JSON.stringify(this.settings)); } catch { /* Keep session settings when storage is unavailable. */ }
    this.mix(); this.ensureMusic(); this.onChange?.();
  }
  retry(): void { this.failed = false; void this.resume(); }
  effects(): { context: AudioContext; output: GainNode } | undefined {
    if (this.context?.state === 'running' && this.effectsBus && !document.hidden && !this.settings.effectsMuted && this.settings.effects > 0) return { context: this.context, output: this.effectsBus };
  }
  async recordingAudio(): Promise<MediaStream | undefined> {
    await this.resume(); return this.context?.state === 'running' ? this.recording?.stream : undefined;
  }
  private visibility = (): void => {
    this.mix();
    if (!document.hidden && this.context) void this.resume();
    this.onChange?.();
  };
  private mix(immediate = false): void {
    if (!this.context) return;
    const duck = !this.running ? .3 : this.reading.size ? .42 : this.playing ? 1 : .65;
    const values: [GainNode | undefined, number][] = [[this.musicBus, this.settings.musicMuted ? 0 : this.settings.music * duck],
      [this.effectsBus, this.settings.effectsMuted ? 0 : this.settings.effects], [this.master, document.hidden ? 0 : .9]];
    for (const [node, value] of values) {
      if (!node || this.mixValues.get(node) === value) continue;
      this.mixValues.set(node, value);
      if (immediate) node.gain.value = value;
      else node.gain.setTargetAtTime(value, this.context.currentTime, node === this.master ? .025 : .25);
    }
  }
  private ensureMusic(): void {
    const ctx = this.context;
    if (!ctx || ctx.state !== 'running' || this.disposed || document.hidden) return;
    // Invalidate even when returning to the current cue; a late download must not replace it.
    if (this.loading && this.loading !== this.desired) { this.request++; this.abort?.abort(); this.loading = undefined; }
    const original = FILM_MUSIC[this.desired];
    // Shared recordings keep their musical phrase when only the place or intensity changes.
    if (this.current?.original === original) {
      if (this.current.cue !== this.desired) {
        this.current.cue = this.desired;
        this.current.gain.gain.cancelAndHoldAtTime(ctx.currentTime);
        this.current.gain.gain.linearRampToValueAtTime(MUSIC[this.desired].level, ctx.currentTime + 1);
        this.onChange?.();
      }
      return;
    }
    if (this.loading === this.desired || this.failed || this.settings.musicMuted || this.settings.music === 0) return;
    const cue = this.desired; const request = ++this.request;
    this.loading = cue; this.abort = new AbortController(); this.onChange?.();
    let voice: Voice | undefined;
    void this.loadVoice(cue, original, this.abort.signal).then(loaded => {
      voice = loaded;
      if (this.disposed || request !== this.request) { voice.dispose(); return; }
      if (document.hidden) { this.loading = undefined; voice.dispose(); return; }
      this.voices.add(voice);
      voice.start();
      this.loading = undefined;
      if (document.hidden) { voice.dispose(); return; }
      const now = ctx.currentTime; const fade = isActionMusic(cue) ? .9 : 3;
      voice.gain.gain.setValueAtTime(0, now); voice.gain.gain.linearRampToValueAtTime(MUSIC[cue].level, now + fade);
      if (this.current) {
        this.current.gain.gain.cancelAndHoldAtTime(now);
        this.current.gain.gain.linearRampToValueAtTime(0, now + fade);
        this.current.stop(now + fade + .05);
      }
      this.current = voice; this.onChange?.();
    }).catch(() => {
      voice?.dispose();
      if (this.disposed || request !== this.request) return;
      this.loading = undefined;
      this.failed = true;
      // A missing cue must not leave a battle theme playing over a quiet story scene.
      if (this.current) {
        const now = ctx.currentTime;
        this.current.gain.gain.cancelAndHoldAtTime(now);
        this.current.gain.gain.linearRampToValueAtTime(0, now + .5);
        this.current.stop(now + .55); this.current = undefined;
      }
      this.onChange?.();
    });
  }
  private async loadVoice(cue: MusicCue, original: FilmTrack, signal: AbortSignal): Promise<Voice> {
    const ctx = this.context!;
    const buffer = await this.load(original.file, signal);
    if (this.disposed || signal.aborted) throw new Error('Music request cancelled');
    this.buffers.delete(original.file); this.buffers.set(original.file, buffer);
    while (this.buffers.size > 2) this.buffers.delete(this.buffers.keys().next().value!);
    const gain = ctx.createGain(); gain.gain.value = 0; gain.connect(this.musicBus!);
    const source = ctx.createBufferSource();
    source.buffer = buffer; source.loop = true; source.loopEnd = buffer.duration;
    source.connect(gain);
    let started = false; let closed = false;
    const voice: Voice = { cue, original, gain,
      start: () => { source.start(); started = true; },
      stop: at => source.stop(at),
      dispose: () => {
        if (closed) return; closed = true;
        signal.removeEventListener('abort', cancel);
        if (started) source.stop();
        source.disconnect(); gain.disconnect(); this.voices.delete(voice);
      },
    };
    // Only cancel pending playback; an already playing voice must survive the next cue's request.
    const cancel = (): void => { if (this.current !== voice) voice.dispose(); };
    signal.addEventListener('abort', cancel, { once: true });
    source.onended = () => voice.dispose();
    return voice;
  }
  private async load(file: string, signal: AbortSignal): Promise<AudioBuffer> {
    const cached = this.buffers.get(file); if (cached) return cached;
    const response = await fetch(file, { signal });
    if (!response.ok) throw new Error(`Music ${response.status}`);
    return this.context!.decodeAudioData(await response.arrayBuffer());
  }
  dispose(): void {
    if (this.disposed) return;
    this.disposed = true; this.request++; this.abort?.abort(); window.clearTimeout(this.dialogueTimer);
    window.removeEventListener('pointerdown', this.unlock); window.removeEventListener('keydown', this.unlock);
    document.removeEventListener('visibilitychange', this.visibility);
    for (const voice of this.voices) voice.dispose();
    this.voices.clear(); this.buffers.clear(); this.mixValues.clear(); this.current = undefined;
    if (this.context) { this.context.onstatechange = null; void this.context.close(); }
  }
}
