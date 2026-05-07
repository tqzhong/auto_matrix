import type { ConversationStartData, ConversationMessageData, ConversationSummaryData, AgentId } from '@auto_matrix/shared';
import type { AgentRenderer } from '../agents/AgentRenderer.js';

interface ConversationBubble {
  element: HTMLElement;
  agentId: AgentId;
  text: string;
  elapsed: number;
}

/** Visual theme for a conversation zone */
interface ZoneTheme {
  accent: string;   // primary highlight color
  bubbleBg: string; // speech bubble background
  nameColor: string; // speaker name color
}

const ZONE_THEMES: Record<string, ZoneTheme> = {
  matrix: {
    accent: '#00ff41',
    bubbleBg: 'rgba(0,20,5,0.88)',
    nameColor: '#00ccff',
  },
  zion: {
    accent: '#ffaa00',
    bubbleBg: 'rgba(20,15,0,0.88)',
    nameColor: '#ffcc44',
  },
  default: {
    accent: '#00ff41',
    bubbleBg: 'rgba(0,10,0,0.88)',
    nameColor: '#00ccff',
  },
};

function isZionLocation(location: string): boolean {
  const lower = location.toLowerCase();
  return lower.includes('zion') || lower.includes('real') || lower.includes('dock')
    || lower.includes('command') || lower.includes('temple');
}

function pickTheme(location: string): ZoneTheme {
  if (isZionLocation(location)) return ZONE_THEMES.zion;
  return ZONE_THEMES.matrix;
}

export class ConversationView {
  private overlay: HTMLElement;
  private panel: HTMLElement;
  private panelHeader: HTMLElement;
  private panelMessages: HTMLElement;
  private bubbles: ConversationBubble[] = [];
  private activeConversations: Map<string, ConversationStartData> = new Map();
  private messageHistory: Map<string, ConversationMessageData[]> = new Map();
  private conversationThemes: Map<string, ZoneTheme> = new Map();
  private agentNames: Map<AgentId, string> = new Map();
  private maxBubbles = 10;
  private maxPanelMessages = 50;

  private agentRenderer: AgentRenderer | null = null;

  constructor(overlay: HTMLElement) {
    this.overlay = overlay;

    this.panel = document.createElement('div');
    this.panel.style.cssText = `
      position: absolute; bottom: 60px; left: 12px; width: 360px; max-height: 340px;
      background: rgba(0,10,0,0.92); border: 1px solid #00ff4144;
      border-radius: 2px; pointer-events: auto; font-family: 'Courier New', monospace;
      font-size: 12px; overflow-y: auto; display: none;
    `;
    overlay.appendChild(this.panel);

    this.panelHeader = document.createElement('div');
    this.panelHeader.style.cssText = `
      position: sticky; top: 0; background: rgba(0,10,0,0.95);
      padding: 6px 10px; border-bottom: 1px solid #00ff4133;
      color: #00aa2e; font-size: 10px; letter-spacing: 2px;
    `;
    this.panelHeader.textContent = '[ TRANSCRIPTS ]';
    this.panel.appendChild(this.panelHeader);

    this.panelMessages = document.createElement('div');
    this.panelMessages.style.cssText = 'padding: 6px 10px;';
    this.panel.appendChild(this.panelMessages);
  }

  /**
   * Wire the 3D AgentRenderer so dialogue messages also create speech bubbles.
   */
  setAgentRenderer(renderer: AgentRenderer): void {
    this.agentRenderer = renderer;
  }

  registerAgentName(id: AgentId, name: string): void {
    this.agentNames.set(id, name);
  }

  showConversation(data: ConversationStartData): void {
    this.activeConversations.set(data.id, data);
    this.messageHistory.set(data.id, []);
    const theme = pickTheme(data.location);
    this.conversationThemes.set(data.id, theme);
    this.panel.style.display = 'block';
    this.panelHeader.textContent = isZionLocation(data.location)
      ? '[ ZION TRANSCRIPTS ]'
      : '[ MATRIX TRANSCRIPTS ]';
    this.panelHeader.style.color = theme.accent;
    this.panel.style.borderColor = `${theme.accent}44`;
  }

  addMessage(msg: ConversationMessageData): void {
    const history = this.messageHistory.get(msg.conversationId);
    if (history) {
      history.push(msg);
      this.addPanelMessage(msg);
    }

    // Always trigger 3D speech bubble regardless of conversation tracking
    if (this.agentRenderer) {
      const speakerName = this.agentNames.get(msg.speaker) ?? msg.speaker;
      this.agentRenderer.showSpeechBubble(msg.speaker, speakerName, msg.content);
    }
  }

  hideConversation(conversationId: string): void {
    this.activeConversations.delete(conversationId);
    this.conversationThemes.delete(conversationId);
    if (this.activeConversations.size === 0) {
      this.panel.style.display = 'none';
    }
  }

  showSummary(data: ConversationSummaryData): void {
    const theme = this.conversationThemes.get(data.conversationId) ?? ZONE_THEMES.default;
    this.activeConversations.delete(data.conversationId);

    // Build summary entry
    const wrapper = document.createElement('div');
    wrapper.style.cssText = `
      margin: 8px 0; padding: 8px 10px;
      background: ${theme.bubbleBg};
      border-left: 3px solid ${theme.accent};
      border-radius: 0 3px 3px 0; line-height: 1.5;
    `;

    const label = document.createElement('div');
    label.style.cssText = `
      font-size: 9px; letter-spacing: 2px; color: ${theme.accent}99;
      margin-bottom: 4px;
    `;
    label.textContent = '▸ DIALOGUE SUMMARY';
    wrapper.appendChild(label);

    const summaryText = document.createElement('div');
    summaryText.style.cssText = `color: #ccc; font-size: 12px;`;
    summaryText.textContent = data.summary;
    wrapper.appendChild(summaryText);

    if (data.participants.length > 0) {
      const participantsLine = document.createElement('div');
      participantsLine.style.cssText = 'font-size: 10px; color: #666; margin-top: 4px;';
      const names = data.participants
        .map((id) => this.agentNames.get(id) ?? id)
        .join(', ');
      participantsLine.textContent = `[ ${names} ]`;
      wrapper.appendChild(participantsLine);
    }

    this.panelMessages.appendChild(wrapper);

    while (this.panelMessages.children.length > this.maxPanelMessages) {
      this.panelMessages.removeChild(this.panelMessages.firstChild!);
    }

    this.panel.scrollTop = this.panel.scrollHeight;

    // Remove theme after summary is shown
    this.conversationThemes.delete(data.conversationId);
  }

  private addPanelMessage(msg: ConversationMessageData): void {
    const theme = this.conversationThemes.get(msg.conversationId) ?? ZONE_THEMES.default;

    const entry = document.createElement('div');
    entry.style.cssText = `
      margin-bottom: 6px; line-height: 1.4; padding: 4px 8px;
      background: ${theme.bubbleBg};
      border-left: 2px solid ${theme.accent}44;
      border-radius: 0 3px 3px 0;
    `;

    const speaker = document.createElement('span');
    speaker.style.cssText = `color: ${theme.nameColor}; font-weight: bold;`;
    speaker.textContent = this.agentNames.get(msg.speaker) || msg.speaker;
    entry.appendChild(speaker);

    const tone = document.createElement('span');
    tone.style.cssText = `color: ${theme.accent}66; font-size: 10px; margin-left: 6px; font-style: italic;`;
    tone.textContent = `[${msg.tone}]`;
    entry.appendChild(tone);

    const breakEl = document.createElement('br');
    entry.appendChild(breakEl);

    const content = document.createElement('span');
    content.style.cssText = `color: #ddd; padding-left: 4px;`;
    content.textContent = msg.content;
    entry.appendChild(content);

    this.panelMessages.appendChild(entry);

    while (this.panelMessages.children.length > this.maxPanelMessages) {
      this.panelMessages.removeChild(this.panelMessages.firstChild!);
    }

    this.panel.scrollTop = this.panel.scrollHeight;
  }

  update(delta: number): void {
    const toRemove: number[] = [];
    for (let i = 0; i < this.bubbles.length; i++) {
      this.bubbles[i].elapsed += delta;
      if (this.bubbles[i].elapsed > 5) {
        const opacity = 1 - (this.bubbles[i].elapsed - 5) / 2;
        this.bubbles[i].element.style.opacity = String(Math.max(0, opacity));
        if (this.bubbles[i].elapsed > 7) {
          this.bubbles[i].element.remove();
          toRemove.push(i);
        }
      }
    }
    for (let i = toRemove.length - 1; i >= 0; i--) {
      this.bubbles.splice(toRemove[i], 1);
    }
  }

  get activeCount(): number {
    return this.activeConversations.size;
  }

  dispose(): void {
    this.panel.remove();
    for (const b of this.bubbles) {
      b.element.remove();
    }
    this.bubbles = [];
  }
}
