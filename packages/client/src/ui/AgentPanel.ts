import type { AgentState } from '@auto_matrix/shared';

export class AgentPanel {
  private container: HTMLElement;
  private visible = false;

  private nameEl: HTMLElement;
  private factionEl: HTMLElement;
  private statusEl: HTMLElement;
  private healthBar: HTMLElement;
  private healthBarInner: HTMLElement;
  private goalEl: HTMLElement;
  private actionEl: HTMLElement;
  private moodEl: HTMLElement;
  private awakenedEl: HTMLElement;
  private abilitiesEl: HTMLElement;

  private onClose: () => void;

  constructor(overlay: HTMLElement, onClose: () => void) {
    this.onClose = onClose;

    this.container = document.createElement('div');
    this.container.style.cssText = `
      position: absolute; top: 60px; right: 12px; width: 280px;
      background: rgba(0,10,0,0.92); border: 1px solid #00ff4166;
      padding: 14px; border-radius: 2px; pointer-events: auto;
      font-family: 'Courier New', monospace; color: #00ff41; font-size: 12px;
      display: none; max-height: calc(100vh - 120px); overflow-y: auto;
    `;
    overlay.appendChild(this.container);

    const header = document.createElement('div');
    header.style.cssText = `
      display: flex; justify-content: space-between; align-items: center;
      margin-bottom: 10px; border-bottom: 1px solid #00ff4133; padding-bottom: 8px;
    `;

    const title = document.createElement('span');
    title.textContent = '[ AGENT PROFILE ]';
    title.style.cssText = 'color: #00ff41; font-weight: bold; font-size: 11px; letter-spacing: 2px;';
    header.appendChild(title);

    const closeBtn = document.createElement('button');
    closeBtn.textContent = '✕';
    closeBtn.style.cssText = `
      background: none; border: none; color: #00ff41; cursor: pointer;
      font-size: 16px; padding: 0 4px;
    `;
    closeBtn.addEventListener('click', () => this.hide());
    header.appendChild(closeBtn);
    this.container.appendChild(header);

    this.nameEl = this.createLine(true);
    this.factionEl = this.createLine();
    this.statusEl = this.createLine();

    const healthLabel = document.createElement('div');
    healthLabel.textContent = 'HEALTH';
    healthLabel.style.cssText = 'margin-top: 8px; font-size: 10px; color: #00aa2e;';
    this.container.appendChild(healthLabel);

    const healthOuter = document.createElement('div');
    healthOuter.style.cssText = `
      width: 100%; height: 8px; background: #0a1a0a;
      border: 1px solid #00ff4133; margin: 4px 0; border-radius: 1px;
    `;
    this.healthBarInner = document.createElement('div');
    this.healthBarInner.style.cssText = `
      height: 100%; background: #00ff41; transition: width 0.3s; border-radius: 1px;
    `;
    healthOuter.appendChild(this.healthBarInner);
    this.container.appendChild(healthOuter);
    this.healthBar = healthOuter;

    this.goalEl = this.createLine();
    this.actionEl = this.createLine();
    this.moodEl = this.createLine();
    this.awakenedEl = this.createLine();

    const abilitiesLabel = document.createElement('div');
    abilitiesLabel.textContent = 'ABILITIES';
    abilitiesLabel.style.cssText = 'margin-top: 8px; font-size: 10px; color: #00aa2e; margin-bottom: 4px;';
    this.container.appendChild(abilitiesLabel);

    this.abilitiesEl = document.createElement('div');
    this.abilitiesEl.style.cssText = 'padding-left: 8px;';
    this.container.appendChild(this.abilitiesEl);
  }

  private createLine(bold = false): HTMLElement {
    const el = document.createElement('div');
    el.style.cssText = `margin: 3px 0; ${bold ? 'font-weight: bold; font-size: 14px;' : ''}`;
    this.container.appendChild(el);
    return el;
  }

  show(): void {
    this.container.style.display = 'block';
    this.visible = true;
  }

  hide(): void {
    this.container.style.display = 'none';
    this.visible = false;
    this.onClose();
  }

  update(agent: AgentState): void {
    this.nameEl.textContent = `▸ ${agent.name}`;
    this.factionEl.textContent = `FACTION: ${agent.faction.toUpperCase()}`;
    this.statusEl.textContent = `STATUS: ${agent.status.toUpperCase()}`;

    const hp = agent.maxHealth > 0 ? (agent.health / agent.maxHealth) * 100 : 100;
    this.healthBarInner.style.width = `${hp}%`;
    if (hp > 60) this.healthBarInner.style.background = '#00ff41';
    else if (hp > 30) this.healthBarInner.style.background = '#ffaa00';
    else this.healthBarInner.style.background = '#ff2200';

    this.goalEl.textContent = `GOAL: ${agent.currentGoal || 'None'}`;
    const actionText = agent.currentAction
      ? `${agent.currentAction.type}${agent.currentAction.target ? ` → ${agent.currentAction.target}` : ''}`
      : 'Idle';
    this.actionEl.textContent = `ACTION: ${actionText}`;
    this.moodEl.textContent = `MOOD: ${agent.mood || 'Neutral'}`;
    this.awakenedEl.innerHTML = agent.isAwakened
      ? '<span style="color:#00ccff">◉ AWAKENED</span>'
      : '<span style="color:#666">○ Unaware</span>';

    this.abilitiesEl.innerHTML = '';
    for (const ability of agent.abilities) {
      const el = document.createElement('div');
      const cd = ability.currentCooldown > 0
        ? ` <span style="color:#666">[cd: ${ability.currentCooldown}]</span>`
        : ' <span style="color:#00ff41">[READY]</span>';
      el.innerHTML = `${ability.name}${cd}`;
      el.style.marginBottom = '2px';
      this.abilitiesEl.appendChild(el);
    }
  }

  get isVisible(): boolean {
    return this.visible;
  }

  dispose(): void {
    this.container.remove();
  }
}
