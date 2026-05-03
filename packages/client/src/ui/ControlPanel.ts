import type { StoryPhaseId, StoryEventData } from '@auto_matrix/shared';

const PHASE_NAMES: Record<string, string> = {
  phase1_normal_life: 'Phase I',
  phase2_awakening: 'Phase II',
  phase3_war: 'Phase III',
  phase4_resolution: 'Phase IV',
};

interface EventEntry {
  text: string;
  elapsed: number;
}

export class ControlPanel {
  private container: HTMLElement;
  private phaseDisplay: HTMLElement;
  private eventLog: HTMLElement;
  private events: EventEntry[] = [];
  private maxEvents = 30;

  private agentSelect: HTMLSelectElement;
  private onFocusAgent: (agentId: string) => void;

  constructor(
    overlay: HTMLElement,
    callbacks: {
      onSpeedChange: (speed: number) => void;
      onPause: () => void;
      onResume: () => void;
      onFocusAgent: (agentId: string) => void;
    },
  ) {
    this.onFocusAgent = callbacks.onFocusAgent;

    this.container = document.createElement('div');
    this.container.style.cssText = `
      position: absolute; bottom: 60px; right: 12px; width: 260px;
      background: rgba(0,10,0,0.92); border: 1px solid #00ff4144;
      border-radius: 2px; pointer-events: auto; font-family: 'Courier New', monospace;
      font-size: 11px; color: #00ff41; max-height: calc(100vh - 180px);
      display: flex; flex-direction: column;
    `;
    overlay.appendChild(this.container);

    const phaseHeader = document.createElement('div');
    phaseHeader.style.cssText = `
      padding: 8px 10px; border-bottom: 1px solid #00ff4133;
      font-size: 10px; color: #00aa2e; letter-spacing: 2px;
    `;
    phaseHeader.textContent = '[ PHASE ]';
    this.container.appendChild(phaseHeader);

    this.phaseDisplay = document.createElement('div');
    this.phaseDisplay.style.cssText = 'padding: 6px 10px; font-size: 13px;';
    this.phaseDisplay.textContent = 'Phase I — Normal Life';
    this.container.appendChild(this.phaseDisplay);

    const focusHeader = document.createElement('div');
    focusHeader.style.cssText = `
      padding: 8px 10px; border-bottom: 1px solid #00ff4133;
      font-size: 10px; color: #00aa2e; letter-spacing: 2px;
    `;
    focusHeader.textContent = '[ FOCUS AGENT ]';
    this.container.appendChild(focusHeader);

    const focusWrap = document.createElement('div');
    focusWrap.style.cssText = 'padding: 6px 10px;';
    this.container.appendChild(focusWrap);

    this.agentSelect = document.createElement('select');
    this.agentSelect.style.cssText = `
      width: 100%; background: #0a1a0a; color: #00ff41;
      border: 1px solid #00ff4144; padding: 4px; font-family: 'Courier New', monospace;
      font-size: 11px;
    `;
    const defaultOpt = document.createElement('option');
    defaultOpt.value = '';
    defaultOpt.textContent = '-- Select Agent --';
    this.agentSelect.appendChild(defaultOpt);
    this.agentSelect.addEventListener('change', () => {
      if (this.agentSelect.value) {
        this.onFocusAgent(this.agentSelect.value);
      }
    });
    focusWrap.appendChild(this.agentSelect);

    const eventHeader = document.createElement('div');
    eventHeader.style.cssText = `
      padding: 8px 10px; border-bottom: 1px solid #00ff4133;
      font-size: 10px; color: #00aa2e; letter-spacing: 2px;
    `;
    eventHeader.textContent = '[ EVENT LOG ]';
    this.container.appendChild(eventHeader);

    this.eventLog = document.createElement('div');
    this.eventLog.style.cssText = `
      flex: 1; overflow-y: auto; padding: 6px 10px; max-height: 200px;
    `;
    this.container.appendChild(this.eventLog);
  }

  setPhase(phase: StoryPhaseId): void {
    const name = PHASE_NAMES[phase] || phase;
    this.phaseDisplay.textContent = name;
  }

  addEvent(event: StoryEventData): void {
    this.events.unshift({
      text: event.name,
      elapsed: 0,
    });
    if (this.events.length > this.maxEvents) {
      this.events.pop();
    }
    this.renderEvents();
  }

  addEventText(text: string): void {
    this.events.unshift({ text, elapsed: 0 });
    if (this.events.length > this.maxEvents) {
      this.events.pop();
    }
    this.renderEvents();
  }

  private renderEvents(): void {
    this.eventLog.innerHTML = '';
    for (const entry of this.events) {
      const el = document.createElement('div');
      el.style.cssText = 'margin-bottom: 4px; color: #aaeeaa;';
      el.textContent = `▸ ${entry.text}`;
      this.eventLog.appendChild(el);
    }
  }

  update(delta: number): void {
    for (const entry of this.events) {
      entry.elapsed += delta;
    }
  }

  setAgentOptions(agentNames: Map<string, string>): void {
    const currentValue = this.agentSelect.value;

    while (this.agentSelect.options.length > 1) {
      this.agentSelect.remove(1);
    }

    for (const [id, name] of agentNames) {
      const opt = document.createElement('option');
      opt.value = id;
      opt.textContent = name;
      this.agentSelect.appendChild(opt);
    }

    if (currentValue) {
      this.agentSelect.value = currentValue;
    }
  }

  dispose(): void {
    this.container.remove();
  }
}
