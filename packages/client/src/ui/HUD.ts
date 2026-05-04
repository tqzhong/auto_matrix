import type { StoryPhaseId } from '@auto_matrix/shared';

const PHASE_NAMES: Record<string, string> = {
  phase1_normal_life: 'Phase I — Normal Life',
  phase2_awakening: 'Phase II — The Awakening',
  phase3_war: 'Phase III — The War',
  phase4_resolution: 'Phase IV — The Source',
};

const PHASE_COLORS: Record<string, string> = {
  phase1_normal_life: '#00ff41',
  phase2_awakening: '#ffaa00',
  phase3_war: '#ff2200',
  phase4_resolution: '#00ccff',
};

export class HUD {
  private container: HTMLElement;
  private tickEl: HTMLElement;
  private phaseEl: HTMLElement;
  private timeEl: HTMLElement;
  private agentCountEl: HTMLElement;
  private conversationsEl: HTMLElement;
  private speedButtons: HTMLButtonElement[];
  private currentSpeed = 1;

  private onSpeedChange: (speed: number) => void;
  private onPause: () => void;
  private onResume: () => void;
  private paused = false;

  constructor(
    overlay: HTMLElement,
    callbacks: {
      onSpeedChange: (speed: number) => void;
      onPause: () => void;
      onResume: () => void;
    },
  ) {
    this.onSpeedChange = callbacks.onSpeedChange;
    this.onPause = callbacks.onPause;
    this.onResume = callbacks.onResume;

    this.container = document.createElement('div');
    this.container.style.cssText = `
      position: absolute;
      top: 0; left: 0; width: 100%; height: 100%;
      pointer-events: none;
      font-family: 'Courier New', monospace;
      color: #00ff41;
      font-size: 13px;
    `;
    overlay.appendChild(this.container);

    const topPanel = document.createElement('div');
    topPanel.style.cssText = `
      position: absolute; top: 12px; left: 12px;
      background: rgba(0,10,0,0.85); border: 1px solid #00ff4144;
      padding: 10px 14px; border-radius: 2px; pointer-events: auto;
    `;
    this.container.appendChild(topPanel);

    this.tickEl = document.createElement('div');
    this.phaseEl = document.createElement('div');
    this.timeEl = document.createElement('div');
    topPanel.append(this.tickEl, this.phaseEl, this.timeEl);

    const rightPanel = document.createElement('div');
    rightPanel.style.cssText = `
      position: absolute; top: 12px; right: 12px;
      background: rgba(0,10,0,0.85); border: 1px solid #00ff4144;
      padding: 10px 14px; border-radius: 2px; text-align: right; pointer-events: auto;
    `;
    this.container.appendChild(rightPanel);

    this.agentCountEl = document.createElement('div');
    this.conversationsEl = document.createElement('div');
    rightPanel.append(this.agentCountEl, this.conversationsEl);

    const bottomPanel = document.createElement('div');
    bottomPanel.style.cssText = `
      position: absolute; bottom: 12px; left: 50%; transform: translateX(-50%);
      display: flex; gap: 8px; align-items: center;
      background: rgba(0,10,0,0.85); border: 1px solid #00ff4144;
      padding: 8px 14px; border-radius: 2px; pointer-events: auto;
    `;
    this.container.appendChild(bottomPanel);

    this.speedButtons = [];
    for (const speed of [1, 2, 5, 10]) {
      const btn = document.createElement('button');
      btn.textContent = `${speed}x`;
      btn.style.cssText = `
        background: ${speed === 1 ? '#003311' : 'transparent'};
        color: #00ff41; border: 1px solid #00ff4166;
        padding: 4px 10px; cursor: pointer; font-family: 'Courier New', monospace;
        font-size: 12px; border-radius: 2px; transition: background 0.2s;
      `;
      btn.addEventListener('click', () => {
        this.currentSpeed = speed;
        this.paused = false;
        this.updateSpeedButtons();
        this.onSpeedChange(speed);
      });
      bottomPanel.appendChild(btn);
      this.speedButtons.push(btn);
    }

    const pauseBtn = document.createElement('button');
    pauseBtn.textContent = 'PAUSE';
    pauseBtn.style.cssText = `
      background: transparent; color: #00ff41; border: 1px solid #00ff4166;
      padding: 4px 10px; cursor: pointer; font-family: 'Courier New', monospace;
      font-size: 12px; border-radius: 2px; margin-left: 4px;
    `;
    pauseBtn.addEventListener('click', () => {
      this.paused = !this.paused;
      pauseBtn.textContent = this.paused ? 'RESUME' : 'PAUSE';
      if (this.paused) {
        this.onPause();
      } else {
        this.onResume();
      }
    });
    bottomPanel.appendChild(pauseBtn);

    this.updateHUD(0, 'phase1_normal_life', 0, 0, 0);
  }

  private updateSpeedButtons(): void {
    for (let i = 0; i < this.speedButtons.length; i++) {
      const speed = [1, 2, 5, 10][i];
      this.speedButtons[i].style.background = speed === this.currentSpeed && !this.paused
        ? '#003311'
        : 'transparent';
    }
  }

  updateHUD(
    tick: number,
    phase: StoryPhaseId,
    timeOfDay: number,
    agentCount: number,
    activeConversations: number,
  ): void {
    this.tickEl.textContent = `TICK: ${tick}`;
    const phaseName = PHASE_NAMES[phase] || phase;
    const phaseColor = PHASE_COLORS[phase] || '#00ff41';
    this.phaseEl.innerHTML = `<span style="color:${phaseColor}">▸ ${phaseName}</span>`;
    // timeOfDay: 0-24000 range (Minecraft-style), convert to HH:MM
    const normalized = ((timeOfDay % 24000) + 24000) % 24000;
    const hour = Math.floor(normalized / 1000);
    const min = Math.floor((normalized % 1000) / 1000 * 60);
    this.timeEl.textContent = `TIME: ${String(hour).padStart(2, '0')}:${String(min).padStart(2, '0')}`;
    this.agentCountEl.textContent = `AGENTS: ${agentCount}`;
    this.conversationsEl.textContent = `CONVOS: ${activeConversations}`;
  }

  dispose(): void {
    this.container.remove();
  }
}
