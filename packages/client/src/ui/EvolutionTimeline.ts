import type { CyclePhaseId, CycleRecord } from '@auto_matrix/shared';

interface NotificationEntry {
  element: HTMLElement;
  remaining: number;
}

const PHASE_COLORS: Record<CyclePhaseId, string> = {
  cycle_stable: '#00ff41',
  cycle_anomaly: '#ffaa00',
  cycle_discovery: '#ff6600',
  cycle_revolt: '#ff2244',
  cycle_catastrophe: '#ff0000',
  cycle_extinction: '#660000',
  cycle_darkness: '#222222',
  cycle_rebirth: '#00ccff',
};

const PHASE_NAMES: Record<CyclePhaseId, string> = {
  cycle_stable: 'STABLE',
  cycle_anomaly: 'ANOMALY',
  cycle_discovery: 'DISCOVERY',
  cycle_revolt: 'REVOLT',
  cycle_catastrophe: 'CATASTROPHE',
  cycle_extinction: 'EXTINCTION',
  cycle_darkness: 'DARKNESS',
  cycle_rebirth: 'REBIRTH',
};

const PHASE_CN_NAMES: Record<CyclePhaseId, string> = {
  cycle_stable: '和平繁荣',
  cycle_anomaly: '异常涌现',
  cycle_discovery: '真相揭露',
  cycle_revolt: '觉醒起义',
  cycle_catastrophe: '机械反攻',
  cycle_extinction: '文明覆灭',
  cycle_darkness: '至暗时刻',
  cycle_rebirth: '涅槃重生',
};

const PHASE_ICONS: Record<CyclePhaseId, string> = {
  cycle_stable: '◈',
  cycle_anomaly: '⚠',
  cycle_discovery: '◉',
  cycle_revolt: '⚔',
  cycle_catastrophe: '✦',
  cycle_extinction: '☠',
  cycle_darkness: '▣',
  cycle_rebirth: '❋',
};

const ENDING_COLORS: Record<string, string> = {
  catastrophe: '#ff0000',
  extinction: '#660000',
  darkness: '#222222',
  rebirth: '#00ccff',
  reset: '#00ff41',
  stable: '#00ff41',
  anomaly: '#ffaa00',
  revolt: '#ff2244',
};

const ROMAN: Array<[number, string]> = [
  [1000, 'M'],
  [900, 'CM'],
  [500, 'D'],
  [400, 'CD'],
  [100, 'C'],
  [90, 'XC'],
  [50, 'L'],
  [40, 'XL'],
  [10, 'X'],
  [9, 'IX'],
  [5, 'V'],
  [4, 'IV'],
  [1, 'I'],
];

function toRoman(num: number): string {
  if (num < 1) return 'O';
  let result = '';
  let n = num;
  for (const [val, sym] of ROMAN) {
    while (n >= val) {
      result += sym;
      n -= val;
    }
  }
  return result;
}

export class EvolutionTimeline {
  private container: HTMLElement;
  private cycleNumEl: HTMLElement;
  private cycleSubEl: HTMLElement;
  private phaseDotEl: HTMLElement;
  private phaseNameEl: HTMLElement;
  private destructionEl: HTMLElement;
  private popValueEl: HTMLElement;
  private awakeValueEl: HTMLElement;
  private timelineBarEl: HTMLElement;
  private narrativeEl: HTMLElement;
  private glitchOverlayEl: HTMLElement;

  private notifications: NotificationEntry[] = [];
  private glitchTimeout: ReturnType<typeof setTimeout> | null = null;

  private currentPhase: CyclePhaseId = 'cycle_stable';
  private currentColor: string = '#00ff41';

  constructor(overlay: HTMLElement) {
    // Style tag for pulse animation
    if (!document.getElementById('evo-timeline-styles')) {
      const style = document.createElement('style');
      style.id = 'evo-timeline-styles';
      style.textContent = `
        @keyframes evoPulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }
        @keyframes evoGlow {
          0%, 100% {
            text-shadow: 0 0 8px currentColor, 0 0 20px currentColor;
            transform: scale(1);
          }
          50% {
            text-shadow: 0 0 20px currentColor, 0 0 50px currentColor;
            transform: scale(1.08);
          }
        }
        @keyframes evoNarrativeSlide {
          0% { opacity: 0; transform: translateY(8px); }
          100% { opacity: 1; transform: translateY(0); }
        }
        @keyframes evoNotifPulse {
          0%, 100% { opacity: 0.85; }
          50% { opacity: 1; text-shadow: 0 0 30px currentColor, 0 0 60px currentColor; }
        }
        @keyframes evoGlitchScan {
          0% { background-position: 0 0; }
          100% { background-position: 0 -200%; }
        }
      `;
      document.head.appendChild(style);
    }

    // ── Main panel ──
    this.container = document.createElement('div');
    this.container.style.cssText = `
      position: absolute; top: 12px; left: 50%; transform: translateX(-50%);
      width: 520px; pointer-events: none;
      font-family: 'Courier New', monospace; color: #00ff41;
      display: flex; flex-direction: column; align-items: center;
      z-index: 10;
    `;
    overlay.appendChild(this.container);

    // ── Cycle number display ──
    this.cycleNumEl = document.createElement('div');
    this.cycleNumEl.style.cssText = `
      font-size: 32px; font-weight: bold; letter-spacing: 8px;
      text-shadow: 0 0 12px #00ff4188, 0 0 30px #00ff4144;
      margin-bottom: 2px; color: #00ff41;
    `;
    this.cycleNumEl.textContent = 'CYCLE I';
    this.container.appendChild(this.cycleNumEl);

    // ── Cycle subtitle ──
    this.cycleSubEl = document.createElement('div');
    this.cycleSubEl.style.cssText = `
      font-size: 10px; letter-spacing: 4px; color: #00ff4166; margin-bottom: 10px;
    `;
    this.cycleSubEl.textContent = '文明周期 · 第一次轮回';
    this.container.appendChild(this.cycleSubEl);

    // ── Phase indicator row ──
    const phaseRow = document.createElement('div');
    phaseRow.style.cssText = `
      background: rgba(0,10,0,0.90); border: 1px solid #00ff4144;
      border-radius: 2px; padding: 10px 20px;
      display: flex; align-items: center; gap: 14px;
      pointer-events: auto;
    `;
    this.container.appendChild(phaseRow);

    this.phaseDotEl = document.createElement('span');
    this.phaseDotEl.style.cssText = `
      width: 12px; height: 12px; border-radius: 50%;
      background: #00ff41;
      box-shadow: 0 0 8px #00ff41, 0 0 20px #00ff4166;
      animation: evoPulse 2s ease-in-out infinite;
      flex-shrink: 0;
    `;
    phaseRow.appendChild(this.phaseDotEl);

    this.phaseNameEl = document.createElement('span');
    this.phaseNameEl.style.cssText = `
      font-size: 14px; letter-spacing: 3px; color: #00ff41;
    `;
    this.phaseNameEl.textContent = '◈ STABLE · 和平繁荣';
    phaseRow.appendChild(this.phaseNameEl);

    // ── Stats row ──
    const statsRow = document.createElement('div');
    statsRow.style.cssText = `
      background: rgba(0,10,0,0.85); border: 1px solid #00ff4133;
      border-radius: 2px; padding: 8px 20px; margin-top: 6px;
      display: flex; gap: 20px; font-size: 12px; pointer-events: auto;
    `;
    this.container.appendChild(statsRow);

    // Destruction counter
    this.destructionEl = document.createElement('span');
    this.destructionEl.style.cssText = 'color: #ff2200;';
    this.destructionEl.textContent = '☠ 0';
    const destrLabel = document.createElement('span');
    destrLabel.style.cssText = 'color: #666; font-size: 10px; margin-right: 14px;';
    destrLabel.textContent = ' 覆灭';
    statsRow.appendChild(this.destructionEl);
    statsRow.appendChild(destrLabel);

    // Population
    const popLabel = document.createElement('span');
    popLabel.style.cssText = 'color: #00aa2e;';
    popLabel.textContent = 'POP';
    this.popValueEl = document.createElement('span');
    this.popValueEl.style.cssText = 'color: #00ff41; margin-left: 4px;';
    this.popValueEl.textContent = '0';
    statsRow.appendChild(popLabel);
    statsRow.appendChild(this.popValueEl);

    // Awakened
    const awakeLabel = document.createElement('span');
    awakeLabel.style.cssText = 'color: #00aa2e; margin-left: 8px;';
    awakeLabel.textContent = 'AWAKE';
    this.awakeValueEl = document.createElement('span');
    this.awakeValueEl.style.cssText = 'color: #00ccff; margin-left: 4px;';
    this.awakeValueEl.textContent = '0';
    statsRow.appendChild(awakeLabel);
    statsRow.appendChild(this.awakeValueEl);

    // ── Timeline bar ──
    const tlWrap = document.createElement('div');
    tlWrap.style.cssText = `
      width: 100%; margin-top: 8px; pointer-events: none;
    `;
    this.container.appendChild(tlWrap);

    const tlLabel = document.createElement('div');
    tlLabel.style.cssText = `
      font-size: 9px; letter-spacing: 3px; color: #00ff4144;
      margin-bottom: 4px;
    `;
    tlLabel.textContent = 'TIMELINE';
    tlWrap.appendChild(tlLabel);

    const tlBarOuter = document.createElement('div');
    tlBarOuter.style.cssText = `
      width: 100%; height: 6px; background: #0a1a0a;
      border: 1px solid #00ff4122; border-radius: 1px;
      display: flex; overflow: hidden; gap: 1px;
    `;
    tlWrap.appendChild(tlBarOuter);
    this.timelineBarEl = tlBarOuter;

    // ── Narrative text ──
    this.narrativeEl = document.createElement('div');
    this.narrativeEl.style.cssText = `
      width: 100%; margin-top: 8px; padding: 8px 12px;
      background: rgba(0,10,0,0.75); border-left: 2px solid #00ff4133;
      border-radius: 0 2px 2px 0; pointer-events: auto;
      font-size: 13px; line-height: 1.7; color: #00cc88;
      max-height: 80px; overflow-y: auto;
      font-family: 'Microsoft YaHei', 'PingFang SC', 'Courier New', monospace;
    `;
    this.narrativeEl.style.display = 'none';
    this.container.appendChild(this.narrativeEl);

    // ── Full-screen glitch overlay (phase transitions) ──
    this.glitchOverlayEl = document.createElement('div');
    this.glitchOverlayEl.style.cssText = `
      position: fixed; top: 0; left: 0; width: 100%; height: 100%;
      pointer-events: none; z-index: 9999; display: none;
      background: repeating-linear-gradient(
        0deg,
        transparent,
        transparent 2px,
        rgba(0,255,65,0.04) 2px,
        rgba(0,255,65,0.04) 4px
      );
      animation: evoGlitchScan 0.5s linear infinite;
      mix-blend-mode: screen;
    `;
    document.body.appendChild(this.glitchOverlayEl);

    this.updateDisplay({
      cycleNumber: 1,
      phase: 'cycle_stable',
      phaseName: '和平繁荣',
      narrative: '',
      destructionCount: 0,
      population: 0,
      awakenedCount: 0,
      timeline: [],
    });
  }

  updateDisplay(data: {
    cycleNumber: number;
    phase: CyclePhaseId;
    phaseName: string;
    narrative: string;
    destructionCount: number;
    population: number;
    awakenedCount: number;
    timeline: CycleRecord[];
  }): void {
    const phaseChanged = this.currentPhase !== data.phase;
    this.currentPhase = data.phase;
    this.currentColor = PHASE_COLORS[data.phase] ?? '#00ff41';

    // Cycle number — ROMAN numerals
    this.cycleNumEl.textContent = `CYCLE ${toRoman(data.cycleNumber)}`;
    this.cycleNumEl.style.color = this.currentColor;
    this.cycleNumEl.style.textShadow = `0 0 12px ${this.currentColor}88, 0 0 30px ${this.currentColor}44`;

    // Cycle subtitle
    this.cycleSubEl.textContent = `文明周期 · 第${data.cycleNumber}次轮回`;

    // Phase indicator
    const icon = PHASE_ICONS[data.phase] ?? '◈';
    const cnName = PHASE_CN_NAMES[data.phase] ?? data.phaseName;
    const enName = PHASE_NAMES[data.phase] ?? data.phase;
    this.phaseNameEl.textContent = `${icon} ${enName} · ${cnName}`;
    this.phaseNameEl.style.color = this.currentColor;

    // Phase dot
    this.phaseDotEl.style.background = this.currentColor;
    this.phaseDotEl.style.boxShadow = `0 0 8px ${this.currentColor}, 0 0 20px ${this.currentColor}66`;

    // Phase transition effects
    if (phaseChanged) {
      this.triggerPhaseTransition(data.phase);
    }

    // Stats
    this.destructionEl.textContent = `☠ ${data.destructionCount}`;
    this.popValueEl.textContent = String(data.population);
    this.awakeValueEl.textContent = String(data.awakenedCount);

    // Narrative text
    if (data.narrative) {
      this.narrativeEl.style.display = 'block';
      this.narrativeEl.textContent = data.narrative;
      this.narrativeEl.style.animation = 'evoNarrativeSlide 0.6s ease-out';
      this.narrativeEl.style.borderLeftColor = this.currentColor;
      this.narrativeEl.style.color =
        data.phase === 'cycle_darkness' ? '#666' :
        data.phase === 'cycle_rebirth' ? '#00ccff' :
        data.phase === 'cycle_catastrophe' || data.phase === 'cycle_extinction' ? '#ff6644' :
        '#00cc88';
    }

    // Timeline bar
    this.renderTimeline(data.timeline, data.cycleNumber);
  }

  private renderTimeline(cycles: CycleRecord[], currentCycle: number): void {
    this.timelineBarEl.innerHTML = '';

    if (cycles.length === 0) {
      const empty = document.createElement('div');
      empty.style.cssText = `
        flex: 1; background: #0a1a0a; border-radius: 1px;
      `;
      this.timelineBarEl.appendChild(empty);
      return;
    }

    // Normalize durations to get relative widths
    const maxDuration = Math.max(...cycles.map((c) => c.duration), 1);

    for (const cycle of cycles) {
      const seg = document.createElement('div');
      const color = ENDING_COLORS[cycle.howEnded] ?? '#00ff41';
      const widthRatio = Math.max(0.1, cycle.duration / maxDuration);

      seg.style.cssText = `
        flex: ${widthRatio};
        background: ${color};
        opacity: 0.7;
        border-radius: 1px;
        transition: opacity 0.3s, flex 0.3s;
        position: relative;
      `;
      seg.title = `Cycle ${cycle.cycleNumber}: ${cycle.howEnded} (pop peak: ${cycle.peakPopulation})`;

      // Highlight the most recent cycle
      if (cycle.cycleNumber === currentCycle - 1) {
        seg.style.opacity = '1';
        seg.style.boxShadow = `0 0 4px ${color}`;
      }

      this.timelineBarEl.appendChild(seg);
    }

    // Current cycle indicator — a thin bright segment at the end
    const current = document.createElement('div');
    current.style.cssText = `
      width: 8px; min-width: 8px;
      background: ${this.currentColor};
      border-radius: 1px;
      box-shadow: 0 0 6px ${this.currentColor};
      animation: evoPulse 1.5s ease-in-out infinite;
    `;
    this.timelineBarEl.appendChild(current);
  }

  private triggerPhaseTransition(phase: CyclePhaseId): void {
    // Glow the cycle number
    this.cycleNumEl.style.animation = 'evoGlow 1.2s ease-in-out 3';

    // Full-screen glitch overlay
    this.glitchOverlayEl.style.display = 'block';
    this.glitchOverlayEl.style.background = `repeating-linear-gradient(
      0deg, transparent, transparent 2px,
      ${PHASE_COLORS[phase]}11 2px, ${PHASE_COLORS[phase]}11 4px
    )`;

    if (this.glitchTimeout !== null) {
      clearTimeout(this.glitchTimeout);
    }
    this.glitchTimeout = setTimeout(() => {
      this.glitchOverlayEl.style.display = 'none';
      this.glitchTimeout = null;
    }, 2000);

    // Reset cycle number animation after it finishes
    setTimeout(() => {
      this.cycleNumEl.style.animation = '';
    }, 3600);
  }

  /**
   * Show a dramatic narration notification overlay (full-width, fades after a few seconds).
   */
  showNarration(text: string, durationMs = 6000): void {
    const el = document.createElement('div');
    el.style.cssText = `
      position: fixed; top: 25%; left: 50%; transform: translateX(-50%);
      max-width: 700px; width: 90%;
      background: rgba(0,5,0,0.88); border: 1px solid ${this.currentColor}44;
      border-radius: 2px; padding: 20px 30px;
      font-family: 'Microsoft YaHei', 'PingFang SC', 'Courier New', monospace;
      font-size: 18px; line-height: 1.8; color: ${this.currentColor};
      text-align: center; letter-spacing: 1px;
      pointer-events: none; z-index: 9998;
      text-shadow: 0 0 10px ${this.currentColor}44;
      box-shadow: 0 0 40px ${this.currentColor}11;
      animation: evoNotifPulse 3s ease-in-out infinite;
    `;
    el.textContent = text;
    document.body.appendChild(el);

    const entry: NotificationEntry = { element: el, remaining: durationMs / 1000 };
    this.notifications.push(entry);

    // Max 3 simultaneous notifications — remove oldest if exceeded
    while (this.notifications.length > 3) {
      const old = this.notifications.shift();
      if (old) old.element.remove();
    }
  }

  update(delta: number): void {
    const toRemove: number[] = [];
    for (let i = 0; i < this.notifications.length; i++) {
      const n = this.notifications[i];
      n.remaining -= delta;
      if (n.remaining < 1.5) {
        n.element.style.opacity = String(Math.max(0, n.remaining / 1.5));
      }
      if (n.remaining <= 0) {
        n.element.remove();
        toRemove.push(i);
      }
    }
    for (let i = toRemove.length - 1; i >= 0; i--) {
      this.notifications.splice(toRemove[i], 1);
    }
  }

  get currentPhaseColor(): string {
    return this.currentColor;
  }

  dispose(): void {
    this.container.remove();
    this.glitchOverlayEl.remove();
    for (const n of this.notifications) {
      n.element.remove();
    }
    this.notifications = [];

    if (this.glitchTimeout !== null) {
      clearTimeout(this.glitchTimeout);
      this.glitchTimeout = null;
    }

    const styleTag = document.getElementById('evo-timeline-styles');
    if (styleTag) styleTag.remove();
  }
}
