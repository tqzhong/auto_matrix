import type { GameAudio } from '../engine/GameAudio.js';
import { MUSIC, type MusicCue } from '../engine/Soundtrack.js';
import { FILM_MUSIC, FILM_TRACKS, filmCredit } from '../engine/OriginalScore.js';
import './audio.css';

export class AudioPanel {
  private root = document.createElement('dialog');
  private selected: MusicCue = 'ordinary';

  constructor(private audio: GameAudio, private menu: (open: boolean) => void) {
    this.root.className = 'audio-panel'; this.root.setAttribute('aria-labelledby', 'audio-title');
    this.root.innerHTML = `<header><div><span class="eyebrow">THE SOUND OF YOUR WORLD</span><h2 id="audio-title">声音</h2></div><button data-close aria-label="关闭声音设置">×</button></header>
      <div class="audio-now"><span class="audio-symbol" aria-hidden="true">♫</span><div><strong id="audio-track"></strong><p id="audio-mood"></p><small id="audio-status" role="status"></small></div></div>
      ${[['music', '背景音乐'], ['effects', '动作音效']].map(([id, title]) => `<div class="audio-channel"><div><label for="audio-${id}">${title}</label><button data-mute="${id}" aria-label="静音${title}" aria-pressed="false">静音</button></div><div class="audio-slider"><input id="audio-${id}" type="range" min="0" max="100" step="1"><output for="audio-${id}" id="audio-${id}-value"></output></div></div>`).join('')}
      <button class="audio-retry" hidden>重新开启音乐</button>
      <section class="audio-library" aria-labelledby="audio-library-title"><h3 id="audio-library-title">场景曲库 <small>${Object.keys(MUSIC).length} 个场景 · ${FILM_TRACKS.length} 段电影原声</small></h3>
        <label for="audio-scene">选择场景</label><select id="audio-scene">${Object.entries(MUSIC).map(([id, score]) => `<option value="${id}">${score.mood.split(' · ')[0]} · ${FILM_MUSIC[id as MusicCue].title}</option>`).join('')}</select>
        <p id="audio-scene-description"></p><p class="audio-file" id="audio-file"></p>
        <div class="audio-library-actions"><button data-preview>试听</button></div>
        <p class="audio-hint">所有场景仅使用三部曲电影原声。日常轻声伴奏，战斗与关键剧情增强；共用同一首曲目的地点之间连续播放。关闭面板后恢复随游戏切歌。</p>
      </section>
      <details class="audio-originals"><summary>三部曲原声 · 曲目来源 ↗</summary><p>使用 Don Davis 官网公开的 14 段电影原声片段，每段约 48 秒至 2 分半，覆盖全部场景。曲目按游戏情境适配。</p>
        <a href="https://www.dondavis.net/audio/" target="_blank" rel="noopener noreferrer">Don Davis · 官网原声片段 <small>The Matrix / Reloaded / Revolutions</small></a>
      </details><footer>音乐随生活与剧情变化。<br>对话时轻声，回到世界时渐强；切到后台自动静音。<span>设置自动保存 · Esc 返回</span></footer>`;
    document.body.appendChild(this.root);
    this.root.querySelector('[data-close]')!.addEventListener('click', () => this.close());
    this.root.querySelector('.audio-retry')!.addEventListener('click', () => audio.retry());
    this.root.querySelector<HTMLSelectElement>('#audio-scene')!.addEventListener('change', event => {
      this.selected = (event.target as HTMLSelectElement).value as MusicCue;
      if (audio.previewCue) audio.audition(this.selected);
      this.render();
    });
    this.root.querySelector('[data-preview]')!.addEventListener('click', () => audio.audition(audio.previewCue === this.selected ? undefined : this.selected));
    for (const channel of ['music', 'effects'] as const) {
      this.root.querySelector(`[data-mute="${channel}"]`)!.addEventListener('click', () => audio.toggle(channel));
      this.root.querySelector<HTMLInputElement>(`#audio-${channel}`)!.addEventListener('input', event => audio.setVolume(channel, (event.target as HTMLInputElement).valueAsNumber / 100));
    }
    this.root.addEventListener('cancel', event => { event.preventDefault(); this.close(); });
    this.root.addEventListener('keydown', event => event.stopPropagation());
    this.root.addEventListener('keyup', event => event.stopPropagation());
    this.root.addEventListener('click', event => {
      if (event.target !== this.root) return;
      const rect = this.root.getBoundingClientRect();
      if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) this.close();
    });
    audio.onChange = () => { if (this.root.open) this.render(); };
  }
  open(): void {
    if (this.root.open) return;
    this.menu(true);
    if (document.pointerLockElement) document.exitPointerLock();
    this.selected = this.audio.cue;
    this.root.showModal(); this.root.scrollTop = 0; this.render(); void this.audio.resume();
  }
  close(): boolean {
    if (!this.root.open) return false;
    this.audio.audition(); this.root.close(); this.menu(false); return true;
  }
  private render(): void {
    const score = MUSIC[this.audio.cue];
    this.root.querySelector('#audio-track')!.textContent = this.audio.trackName;
    this.root.querySelector('#audio-mood')!.textContent = `${score.mood.split(' · ')[0]} · ${this.audio.trackCredit}`;
    this.root.querySelector('#audio-status')!.textContent = this.audio.status;
    const retry = this.root.querySelector<HTMLButtonElement>('.audio-retry')!;
    retry.hidden = !this.audio.status.includes('重试') && !this.audio.status.includes('按键');
    const selected = MUSIC[this.selected]; const original = FILM_MUSIC[this.selected];
    const select = this.root.querySelector<HTMLSelectElement>('#audio-scene')!;
    select.value = this.selected;
    this.root.querySelector('#audio-scene-description')!.textContent = selected.mood;
    this.root.querySelector('#audio-file')!.textContent = `${original.title} · ${filmCredit(original)}`;
    const preview = this.root.querySelector<HTMLButtonElement>('[data-preview]')!;
    preview.textContent = this.audio.previewCue === this.selected ? '结束试听' : '试听';
    preview.setAttribute('aria-pressed', String(this.audio.previewCue === this.selected));
    for (const channel of ['music', 'effects'] as const) {
      const value = Math.round(this.audio.settings[channel] * 100);
      this.root.querySelector<HTMLInputElement>(`#audio-${channel}`)!.value = String(value);
      this.root.querySelector(`#audio-${channel}-value`)!.textContent = `${value}%`;
      const muted = this.audio.settings[channel === 'music' ? 'musicMuted' : 'effectsMuted'];
      const button = this.root.querySelector<HTMLButtonElement>(`[data-mute="${channel}"]`)!;
      button.textContent = muted ? '已静音' : '静音'; button.setAttribute('aria-pressed', String(muted));
    }
  }
  dispose(): void { this.audio.onChange = undefined; this.close(); this.root.remove(); }
}
