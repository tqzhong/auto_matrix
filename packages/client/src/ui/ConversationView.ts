import type { ConversationStartData, ConversationMessageData, AgentId } from '@auto_matrix/shared';
import type { AgentRenderer } from '../agents/AgentRenderer.js';

interface ConversationBubble {
  element: HTMLElement;
  agentId: AgentId;
  text: string;
  elapsed: number;
}

export class ConversationView {
  private overlay: HTMLElement;
  private panel: HTMLElement;
  private panelMessages: HTMLElement;
  private bubbles: ConversationBubble[] = [];
  private activeConversations: Map<string, ConversationStartData> = new Map();
  private messageHistory: Map<string, ConversationMessageData[]> = new Map();
  private agentNames: Map<AgentId, string> = new Map();
  private maxBubbles = 10;
  private maxPanelMessages = 50;

  private agentRenderer: AgentRenderer | null = null;

  constructor(overlay: HTMLElement) {
    this.overlay = overlay;

    this.panel = document.createElement('div');
    this.panel.style.cssText = `
      position: absolute; bottom: 60px; left: 12px; width: 320px; max-height: 300px;
      background: rgba(0,10,0,0.92); border: 1px solid #00ff4144;
      border-radius: 2px; pointer-events: auto; font-family: 'Courier New', monospace;
      font-size: 12px; overflow-y: auto; display: none;
    `;
    overlay.appendChild(this.panel);

    const header = document.createElement('div');
    header.style.cssText = `
      position: sticky; top: 0; background: rgba(0,10,0,0.95);
      padding: 6px 10px; border-bottom: 1px solid #00ff4133;
      color: #00aa2e; font-size: 10px; letter-spacing: 2px;
    `;
    header.textContent = '[ TRANSCRIPTS ]';
    this.panel.appendChild(header);

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
    this.panel.style.display = 'block';
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
    if (this.activeConversations.size === 0) {
      this.panel.style.display = 'none';
    }
  }

  private addPanelMessage(msg: ConversationMessageData): void {
    const entry = document.createElement('div');
    entry.style.cssText = 'margin-bottom: 6px; line-height: 1.4;';

    const speaker = document.createElement('span');
    speaker.style.cssText = 'color: #00ccff;';
    speaker.textContent = this.agentNames.get(msg.speaker) || msg.speaker;
    entry.appendChild(speaker);

    const tone = document.createElement('span');
    tone.style.cssText = 'color: #555; font-size: 10px; margin-left: 6px;';
    tone.textContent = `[${msg.tone}]`;
    entry.appendChild(tone);

    const colon = document.createElement('span');
    colon.style.cssText = 'color: #00ff41;';
    colon.textContent = ': ';
    entry.appendChild(colon);

    const content = document.createElement('span');
    content.style.cssText = 'color: #ccc;';
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
