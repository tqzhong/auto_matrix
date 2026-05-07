import { io, Socket } from 'socket.io-client';
import type {
  ServerMessage,
  WorldStateFull,
  WorldStateDelta,
  ConversationStartData,
  ConversationMessageData,
  ConversationEndData,
  ConversationSummaryData,
  StoryEventData,
  EffectData,
  AgentState,
  EvolutionUpdate,
} from '@auto_matrix/shared';

export type SocketCallbacks = {
  onWorldStateFull: (data: WorldStateFull, tick: number) => void;
  onWorldStateDelta: (data: WorldStateDelta, tick: number) => void;
  onAgentUpdate: (data: { id: string; state: Partial<AgentState> }, tick: number) => void;
  onConversationStart: (data: ConversationStartData, tick: number) => void;
  onConversationMessage: (data: ConversationMessageData, tick: number) => void;
  onConversationEnd: (data: ConversationEndData, tick: number) => void;
  onConversationSummary: (data: ConversationSummaryData, tick: number) => void;
  onStoryEvent: (data: StoryEventData, tick: number) => void;
  onPhaseChange: (data: { phase: string; name: string; description: string }, tick: number) => void;
  onEffect: (data: EffectData, tick: number) => void;
  onChatBubble: (data: { agentId: string; text: string }, tick: number) => void;
  onNotification: (data: { message: string; level: string }, tick: number) => void;
  onEvolutionUpdate: (data: EvolutionUpdate, tick: number) => void;
  onEvolutionNarration: (data: { text: string; phase: string }, tick: number) => void;
};

export class SocketClient {
  private socket: Socket | null = null;
  private callbacks: SocketCallbacks;
  private connected = false;

  constructor(callbacks: SocketCallbacks) {
    this.callbacks = callbacks;
  }

  connect(): void {
    this.socket = io({
      path: '/socket.io',
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: 100,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
    });

    this.socket.on('connect', () => {
      this.connected = true;
      this.socket!.emit('message', { type: 'request_full_state', data: {} });
    });

    this.socket.on('disconnect', () => {
      this.connected = false;
    });

    this.socket.on('message', (msg: ServerMessage) => {
      this.handleMessage(msg);
    });

    this.socket.on('world_state_full', (msg: ServerMessage) => {
      this.handleMessage(msg);
    });

    this.socket.on('world_state_delta', (msg: ServerMessage) => {
      this.handleMessage(msg);
    });
  }

  private handleMessage(msg: ServerMessage): void {
    const { type, data, tick } = msg;

    switch (type) {
      case 'world_state_full':
        this.callbacks.onWorldStateFull(data as WorldStateFull, tick);
        break;
      case 'world_state_delta':
        this.callbacks.onWorldStateDelta(data as WorldStateDelta, tick);
        break;
      case 'agent_update':
        this.callbacks.onAgentUpdate(data as { id: string; state: Partial<AgentState> }, tick);
        break;
      case 'conversation_start':
        this.callbacks.onConversationStart(data as ConversationStartData, tick);
        break;
      case 'conversation_message':
        this.callbacks.onConversationMessage(data as ConversationMessageData, tick);
        break;
      case 'conversation_end':
        this.callbacks.onConversationEnd(data as ConversationEndData, tick);
        break;
      case 'conversation_summary':
        this.callbacks.onConversationSummary(data as ConversationSummaryData, tick);
        break;
      case 'story_event':
        this.callbacks.onStoryEvent(data as StoryEventData, tick);
        break;
      case 'phase_change':
        this.callbacks.onPhaseChange(data as { phase: string; name: string; description: string }, tick);
        break;
      case 'effect':
        this.callbacks.onEffect(data as EffectData, tick);
        break;
      case 'chat_bubble':
        this.callbacks.onChatBubble(data as { agentId: string; text: string }, tick);
        break;
      case 'notification':
        this.callbacks.onNotification(data as { message: string; level: string }, tick);
        break;
      case 'evolution_update':
        this.callbacks.onEvolutionUpdate(data as EvolutionUpdate, tick);
        break;
      case 'evolution_narration':
        this.callbacks.onEvolutionNarration(data as { text: string; phase: string }, tick);
        break;
    }
  }

  send(type: string, data: unknown = {}): void {
    if (this.socket && this.connected) {
      this.socket.emit('message', { type, data });
    }
  }

  focusAgent(agentId: string): void {
    this.send('focus_agent', { agentId });
  }

  inspectAgent(agentId: string): void {
    this.send('inspect_agent', { agentId });
  }

  setSpeed(speed: number): void {
    this.send('set_speed', { speed });
  }

  pause(): void {
    this.send('pause');
  }

  resume(): void {
    this.send('resume');
  }

  requestFullState(): void {
    this.send('request_full_state');
  }

  get isConnected(): boolean {
    return this.connected;
  }

  dispose(): void {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
  }
}
