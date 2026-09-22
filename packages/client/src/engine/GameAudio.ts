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
  private engineSound?: { source: OscillatorNode; noise: AudioBufferSourceNode; filter: BiquadFilterNode; gain: GainNode };
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
    const club = scene.player?.currentAction?.parameters.club;
    if (club) this.reading.add('club-conversation'); else this.reading.delete('club-conversation');
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
  ceramicBreak(): void {
    const bus = this.effects(); if (!bus) return;
    const { context: ctx, output } = bus;
    for (const [i, frequency] of [760, 1310, 2290, 3580, 4910].entries()) {
      const tone = ctx.createOscillator(); const gain = ctx.createGain(); const start = ctx.currentTime + i * .018;
      tone.type = 'triangle'; tone.frequency.setValueAtTime(frequency, start); tone.frequency.exponentialRampToValueAtTime(frequency * .77, start + .16);
      gain.gain.setValueAtTime(.018 / (1 + i * .3), start); gain.gain.exponentialRampToValueAtTime(.0001, start + .16 + i * .035);
      tone.connect(gain); gain.connect(output); tone.start(start); tone.stop(start + .38);
      tone.onended = () => { tone.disconnect(); gain.disconnect(); };
    }
  }
  phoneSound(slider: boolean): void {
    const bus = this.effects(); if (!bus) return;
    const { context: ctx, output } = bus;
    for (let i = 0; i < (slider ? 1 : 6); i++) {
      const tone = ctx.createOscillator(); const gain = ctx.createGain(); const at = ctx.currentTime + i * .105;
      tone.type = slider ? 'triangle' : 'square'; tone.frequency.setValueAtTime(slider ? 2300 : i % 2 ? 880 : 660, at);
      if (slider) tone.frequency.exponentialRampToValueAtTime(120, at + .06);
      gain.gain.setValueAtTime(.0001, at); gain.gain.linearRampToValueAtTime(slider ? .035 : .016, at + .006);
      gain.gain.exponentialRampToValueAtTime(.0001, at + (slider ? .07 : .085));
      tone.connect(gain); gain.connect(output); tone.start(at); tone.stop(at + .1);
      tone.onended = () => { tone.disconnect(); gain.disconnect(); };
    }
  }
  landlineSound(kind: 'ring' | 'pickup' | 'hangup'): void {
    const bus = this.effects(); if (!bus) return;
    const { context: ctx, output } = bus; const at = ctx.currentTime;
    if (kind === 'ring') {
      for (let i = 0; i < 8; i++) {
        const tone = ctx.createOscillator(); const gain = ctx.createGain(); const start = at + i * .075;
        tone.type = 'sine'; tone.frequency.setValueAtTime(i % 2 ? 610 : 470, start);
        gain.gain.setValueAtTime(.0001, start); gain.gain.linearRampToValueAtTime(.032, start + .006); gain.gain.exponentialRampToValueAtTime(.0001, start + .065);
        tone.connect(gain); gain.connect(output); tone.start(start); tone.stop(start + .075); tone.onended = () => { tone.disconnect(); gain.disconnect(); };
      }
      return;
    }
    const tone = ctx.createOscillator(); const gain = ctx.createGain(); tone.type = 'triangle'; tone.frequency.setValueAtTime(kind === 'pickup' ? 180 : 110, at);
    tone.frequency.exponentialRampToValueAtTime(kind === 'pickup' ? 75 : 48, at + .085);
    gain.gain.setValueAtTime(.07, at); gain.gain.exponentialRampToValueAtTime(.0001, at + .1);
    tone.connect(gain); gain.connect(output); tone.start(at); tone.stop(at + .11); tone.onended = () => { tone.disconnect(); gain.disconnect(); };
  }
  windowSound(wind: boolean): void {
    const bus = this.effects(); if (!bus) return;
    const { context: ctx, output } = bus; const duration = wind ? 3 : .16;
    const buffer = ctx.createBuffer(1, Math.ceil(ctx.sampleRate * duration), ctx.sampleRate); const data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    const source = ctx.createBufferSource(); source.buffer = buffer;
    const filter = ctx.createBiquadFilter(); filter.type = wind ? 'lowpass' : 'bandpass'; filter.frequency.value = wind ? 720 : 2100; filter.Q.value = wind ? .6 : 3;
    const gain = ctx.createGain(); const at = ctx.currentTime;
    gain.gain.setValueAtTime(.0001, at); gain.gain.linearRampToValueAtTime(wind ? .13 : .08, at + (wind ? .35 : .008));
    gain.gain.exponentialRampToValueAtTime(.0001, at + duration);
    source.connect(filter); filter.connect(gain); gain.connect(output); source.start(at);
    source.onended = () => { source.disconnect(); filter.disconnect(); gain.disconnect(); };
  }
  interrogationSound(kind: 'file' | 'seal' | 'table' | 'tracker'): void {
    const bus = this.effects(); if (!bus) return;
    const { context: ctx, output } = bus; const duration = kind === 'seal' ? 1.9 : kind === 'tracker' ? 2.4 : .48;
    const buffer = ctx.createBuffer(1, Math.ceil(ctx.sampleRate * duration), ctx.sampleRate); const data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * (kind === 'tracker' ? .5 + Math.sin(i / ctx.sampleRate * 90) * .5 : 1);
    const source = ctx.createBufferSource(); source.buffer = buffer;
    const filter = ctx.createBiquadFilter(); filter.type = 'bandpass'; filter.frequency.value = kind === 'file' ? 2400 : kind === 'table' ? 420 : kind === 'seal' ? 220 : 1300; filter.Q.value = kind === 'table' ? 9 : 1.2;
    const gain = ctx.createGain(); const at = ctx.currentTime;
    gain.gain.setValueAtTime(.0001, at); gain.gain.linearRampToValueAtTime(kind === 'table' ? .2 : .075, at + (kind === 'seal' ? .4 : .015)); gain.gain.exponentialRampToValueAtTime(.0001, at + duration);
    source.connect(filter); filter.connect(gain); gain.connect(output); source.start(at);
    source.onended = () => { source.disconnect(); filter.disconnect(); gain.disconnect(); };
  }
  meetingSound(kind: 'door' | 'pump' | 'release' | 'wiper'): void {
    const bus = this.effects(); if (!bus) return;
    const { context: ctx, output } = bus; const duration = kind === 'pump' ? .42 : .28;
    const buffer = ctx.createBuffer(1, Math.ceil(ctx.sampleRate * duration), ctx.sampleRate); const samples = buffer.getChannelData(0);
    for (let i = 0; i < samples.length; i++) samples[i] = Math.random() * 2 - 1;
    const source = ctx.createBufferSource(); source.buffer = buffer;
    const filter = ctx.createBiquadFilter(); filter.type = 'bandpass'; filter.frequency.value = kind === 'door' ? 230 : kind === 'pump' ? 850 : kind === 'wiper' ? 1600 : 2100; filter.Q.value = kind === 'door' ? 4 : .9;
    const gain = ctx.createGain(); const at = ctx.currentTime;
    gain.gain.setValueAtTime(.0001, at); gain.gain.linearRampToValueAtTime(kind === 'door' ? .18 : kind === 'wiper' ? .025 : .085, at + .015); gain.gain.exponentialRampToValueAtTime(.0001, at + duration);
    source.connect(filter); filter.connect(gain); gain.connect(output); source.start(at);
    source.onended = () => { source.disconnect(); filter.disconnect(); gain.disconnect(); };
  }
  sentinelSound(kind: 'alarm' | 'powerDown' | 'scan' | 'detected' | 'clear' | 'powerUp'): void {
    const bus = this.effects(); if (!bus) return;
    const { context: ctx, output } = bus; const at = ctx.currentTime;
    if (kind === 'alarm' || kind === 'scan') {
      const count = kind === 'alarm' ? 4 : 1;
      for (let i = 0; i < count; i++) {
        const tone = ctx.createOscillator(); const gain = ctx.createGain(); const start = at + i * .19;
        tone.type = kind === 'alarm' ? 'square' : 'sine'; tone.frequency.setValueAtTime(kind === 'alarm' ? (i % 2 ? 690 : 520) : 1260, start);
        if (kind === 'scan') tone.frequency.exponentialRampToValueAtTime(380, start + .18);
        gain.gain.setValueAtTime(.0001, start); gain.gain.linearRampToValueAtTime(kind === 'alarm' ? .035 : .022, start + .008); gain.gain.exponentialRampToValueAtTime(.0001, start + (kind === 'alarm' ? .15 : .2));
        tone.connect(gain); gain.connect(output); tone.start(start); tone.stop(start + .22); tone.onended = () => { tone.disconnect(); gain.disconnect(); };
      }
      return;
    }
    const duration = kind === 'detected' ? 1.1 : kind === 'clear' ? .7 : 1.4;
    const buffer = ctx.createBuffer(1, Math.ceil(ctx.sampleRate * duration), ctx.sampleRate); const samples = buffer.getChannelData(0);
    for (let i = 0; i < samples.length; i++) samples[i] = (Math.random() * 2 - 1) * Math.exp(-i / ctx.sampleRate * (kind === 'detected' ? 1.4 : 2.2));
    const source = ctx.createBufferSource(); source.buffer = buffer;
    const filter = ctx.createBiquadFilter(); filter.type = 'lowpass'; filter.frequency.setValueAtTime(kind === 'detected' ? 310 : kind === 'clear' ? 720 : 190, at);
    const gain = ctx.createGain(); gain.gain.setValueAtTime(.0001, at); gain.gain.linearRampToValueAtTime(kind === 'detected' ? .17 : .08, at + .025); gain.gain.exponentialRampToValueAtTime(.0001, at + duration);
    source.connect(filter); filter.connect(gain); gain.connect(output); source.start(at);
    const tone = ctx.createOscillator(); const toneGain = ctx.createGain(); tone.type = kind === 'detected' ? 'sawtooth' : 'triangle';
    const from = kind === 'powerDown' ? 118 : kind === 'powerUp' ? 42 : kind === 'clear' ? 190 : 74; const to = kind === 'powerDown' ? 27 : kind === 'powerUp' ? 132 : kind === 'clear' ? 430 : 48;
    tone.frequency.setValueAtTime(from, at); tone.frequency.exponentialRampToValueAtTime(to, at + duration);
    toneGain.gain.setValueAtTime(.0001, at); toneGain.gain.linearRampToValueAtTime(kind === 'detected' ? .055 : .026, at + .04); toneGain.gain.exponentialRampToValueAtTime(.0001, at + duration);
    tone.connect(toneGain); toneGain.connect(output); tone.start(at); tone.stop(at + duration);
    source.onended = () => { source.disconnect(); filter.disconnect(); gain.disconnect(); };
    tone.onended = () => { tone.disconnect(); toneGain.disconnect(); };
  }
  interludeSound(kind: 'keys' | 'glass' | 'cutlery' | 'bowl'): void {
    const bus = this.effects(); if (!bus) return;
    const { context: ctx, output } = bus; const at = ctx.currentTime;
    const count = kind === 'keys' ? 9 : kind === 'cutlery' ? 3 : 1;
    for (let i = 0; i < count; i++) {
      const start = at + i * (kind === 'keys' ? .055 : .07);
      const tone = ctx.createOscillator(); const gain = ctx.createGain();
      tone.type = kind === 'glass' ? 'sine' : kind === 'bowl' ? 'triangle' : 'square';
      const frequency = kind === 'keys' ? 1250 + (i % 3) * 260 : kind === 'glass' ? 2350 : kind === 'cutlery' ? 3100 - i * 430 : 240;
      tone.frequency.setValueAtTime(frequency, start); tone.frequency.exponentialRampToValueAtTime(kind === 'bowl' ? 105 : frequency * .72, start + (kind === 'glass' ? .55 : .09));
      gain.gain.setValueAtTime(.0001, start); gain.gain.linearRampToValueAtTime(kind === 'keys' ? .012 : kind === 'glass' ? .024 : kind === 'cutlery' ? .018 : .055, start + .004);
      gain.gain.exponentialRampToValueAtTime(.0001, start + (kind === 'glass' ? .65 : kind === 'bowl' ? .28 : .11));
      tone.connect(gain); gain.connect(output); tone.start(start); tone.stop(start + (kind === 'glass' ? .68 : kind === 'bowl' ? .3 : .13));
      tone.onended = () => { tone.disconnect(); gain.disconnect(); };
    }
  }
  rescueSound(kind: 'hologram' | 'racks' | 'equip'): void {
    const bus = this.effects(); if (!bus) return;
    const { context: ctx, output } = bus; const at = ctx.currentTime;
    if (kind === 'hologram') {
      const tone = ctx.createOscillator(); const gain = ctx.createGain(); tone.type = 'sine';
      tone.frequency.setValueAtTime(145, at); tone.frequency.exponentialRampToValueAtTime(980, at + .62);
      gain.gain.setValueAtTime(.0001, at); gain.gain.linearRampToValueAtTime(.035, at + .08); gain.gain.exponentialRampToValueAtTime(.0001, at + .75);
      tone.connect(gain); gain.connect(output); tone.start(at); tone.stop(at + .78); tone.onended = () => { tone.disconnect(); gain.disconnect(); };
      return;
    }
    const count = kind === 'racks' ? 7 : 3;
    for (let i = 0; i < count; i++) {
      const start = at + i * (kind === 'racks' ? .095 : .16); const duration = kind === 'racks' ? .22 : .13;
      const buffer = ctx.createBuffer(1, Math.ceil(ctx.sampleRate * duration), ctx.sampleRate); const samples = buffer.getChannelData(0);
      for (let sample = 0; sample < samples.length; sample++) samples[sample] = (Math.random() * 2 - 1) * Math.exp(-sample / ctx.sampleRate * (kind === 'racks' ? 15 : 28));
      const source = ctx.createBufferSource(); source.buffer = buffer;
      const filter = ctx.createBiquadFilter(); filter.type = 'bandpass'; filter.frequency.value = kind === 'racks' ? 180 + i * 55 : 720 + i * 430; filter.Q.value = kind === 'racks' ? 3.4 : 5;
      const gain = ctx.createGain(); gain.gain.setValueAtTime(.0001, start); gain.gain.linearRampToValueAtTime(kind === 'racks' ? .075 : .09, start + .008); gain.gain.exponentialRampToValueAtTime(.0001, start + duration);
      source.connect(filter); filter.connect(gain); gain.connect(output); source.start(start); source.onended = () => { source.disconnect(); filter.disconnect(); gain.disconnect(); };
    }
  }
  lobbySound(kind: 'alarm' | 'draw'): void {
    const bus = this.effects(); if (!bus) return;
    const { context: ctx, output } = bus; const at = ctx.currentTime;
    if (kind === 'alarm') {
      for (let i = 0; i < 5; i++) {
        const tone = ctx.createOscillator(); const gain = ctx.createGain(); const start = at + i * .13;
        tone.type = 'square'; tone.frequency.setValueAtTime(i % 2 ? 1180 : 880, start);
        gain.gain.setValueAtTime(.0001, start); gain.gain.linearRampToValueAtTime(.026, start + .006); gain.gain.exponentialRampToValueAtTime(.0001, start + .1);
        tone.connect(gain); gain.connect(output); tone.start(start); tone.stop(start + .12); tone.onended = () => { tone.disconnect(); gain.disconnect(); };
      }
      return;
    }
    for (let i = 0; i < 3; i++) {
      const start = at + i * .075; const buffer = ctx.createBuffer(1, Math.ceil(ctx.sampleRate * .16), ctx.sampleRate); const samples = buffer.getChannelData(0);
      for (let sample = 0; sample < samples.length; sample++) samples[sample] = (Math.random() * 2 - 1) * Math.exp(-sample / ctx.sampleRate * 24);
      const source = ctx.createBufferSource(); source.buffer = buffer;
      const filter = ctx.createBiquadFilter(); filter.type = 'bandpass'; filter.frequency.value = 520 + i * 390; filter.Q.value = 3.8;
      const gain = ctx.createGain(); gain.gain.setValueAtTime(.0001, start); gain.gain.linearRampToValueAtTime(.065, start + .006); gain.gain.exponentialRampToValueAtTime(.0001, start + .16);
      source.connect(filter); filter.connect(gain); gain.connect(output); source.start(start); source.onended = () => { source.disconnect(); filter.disconnect(); gain.disconnect(); };
    }
  }
  lafayetteSound(kind: 'thunder' | 'knock' | 'handshake' | 'door'): void {
    const bus = this.effects(); if (!bus) return;
    const { context: ctx, output } = bus; const duration = kind === 'thunder' ? 2.8 : kind === 'door' ? 1.15 : kind === 'knock' ? .14 : .18;
    const buffer = ctx.createBuffer(1, Math.ceil(ctx.sampleRate * duration), ctx.sampleRate); const samples = buffer.getChannelData(0);
    for (let i = 0; i < samples.length; i++) {
      const t = i / ctx.sampleRate;
      const envelope = kind === 'thunder' ? Math.exp(-t * 1.35) * (.55 + .45 * Math.sin(t * 19) ** 2) : Math.exp(-t * (kind === 'door' ? 2.2 : kind === 'knock' ? 30 : 18));
      samples[i] = (Math.random() * 2 - 1) * envelope;
    }
    const source = ctx.createBufferSource(); source.buffer = buffer;
    const filter = ctx.createBiquadFilter(); filter.type = kind === 'thunder' ? 'lowpass' : 'bandpass';
    filter.frequency.value = kind === 'thunder' ? 190 : kind === 'door' ? 420 : kind === 'knock' ? 260 : 680; filter.Q.value = kind === 'handshake' ? 2.8 : kind === 'knock' ? 3.2 : .75;
    const gain = ctx.createGain(); const at = ctx.currentTime;
    gain.gain.setValueAtTime(.0001, at); gain.gain.linearRampToValueAtTime(kind === 'thunder' ? .24 : kind === 'door' ? .12 : kind === 'knock' ? .2 : .16, at + .012); gain.gain.exponentialRampToValueAtTime(.0001, at + duration);
    source.connect(filter); filter.connect(gain); gain.connect(output); source.start(at);
    if (kind === 'door') {
      const creak = ctx.createOscillator(); const creakGain = ctx.createGain(); creak.type = 'sawtooth'; creak.frequency.setValueAtTime(92, at); creak.frequency.exponentialRampToValueAtTime(48, at + .85);
      creakGain.gain.setValueAtTime(.0001, at); creakGain.gain.linearRampToValueAtTime(.018, at + .12); creakGain.gain.exponentialRampToValueAtTime(.0001, at + 1);
      creak.connect(creakGain); creakGain.connect(output); creak.start(at); creak.stop(at + 1.02); creak.onended = () => { creak.disconnect(); creakGain.disconnect(); };
    }
    source.onended = () => { source.disconnect(); filter.disconnect(); gain.disconnect(); };
  }
  carEngine(speed?: number): void {
    const bus = this.effects();
    if (speed === undefined || !bus) {
      if (this.engineSound) { const sound = this.engineSound; sound.source.stop(); sound.noise.stop(); sound.source.disconnect(); sound.noise.disconnect(); sound.filter.disconnect(); sound.gain.disconnect(); this.engineSound = undefined; }
      return;
    }
    const { context: ctx, output } = bus;
    if (!this.engineSound) {
      const source = ctx.createOscillator(); source.type = 'triangle';
      const filter = ctx.createBiquadFilter(); filter.type = 'lowpass'; filter.frequency.value = 210;
      const gain = ctx.createGain(); gain.gain.value = 0;
      const buffer = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate); const samples = buffer.getChannelData(0);
      for (let i = 0; i < samples.length; i++) samples[i] = (Math.random() * 2 - 1) * .32;
      const noise = ctx.createBufferSource(); noise.buffer = buffer; noise.loop = true;
      source.connect(filter); noise.connect(filter); filter.connect(gain); gain.connect(output); source.start(); noise.start();
      this.engineSound = { source, noise, filter, gain };
    }
    this.engineSound.source.frequency.setTargetAtTime(42 + speed * 1.15, ctx.currentTime, .12);
    this.engineSound.gain.gain.setTargetAtTime(.025 + speed * .0012, ctx.currentTime, .12);
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
    this.disposed = true; this.request++; this.abort?.abort(); window.clearTimeout(this.dialogueTimer); this.carEngine();
    window.removeEventListener('pointerdown', this.unlock); window.removeEventListener('keydown', this.unlock);
    document.removeEventListener('visibilitychange', this.visibility);
    for (const voice of this.voices) voice.dispose();
    this.voices.clear(); this.buffers.clear(); this.mixValues.clear(); this.current = undefined;
    if (this.context) { this.context.onstatechange = null; void this.context.close(); }
  }
}
