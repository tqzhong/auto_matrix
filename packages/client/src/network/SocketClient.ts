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

export type ConnectionHealth = 'connecting' | 'ready' | 'slow' | 'offline';

export type SocketCallbacks = {
  onConnection?: (connected: boolean) => void;
  onHealth?: (status: ConnectionHealth, latency?: number) => void;
  onPlayerState?: (data: { agentId?: string | null; error?: string; message?: string }) => void;
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
  private resumeAgent: string | null = null;
  private restoreOnSnapshot = false;
  private healthTimer?: ReturnType<typeof setInterval>;
  private receiveQueue = Promise.resolve();
  private connectionVersion = 0;

  constructor(callbacks: SocketCallbacks) {
    this.callbacks = callbacks;
  }

  connect(): void {
    this.callbacks.onHealth?.('connecting');
    this.socket = io({
      path: '/socket.io',
      transports: ['websocket', 'polling'],
      auth: { stateAcknowledgements: true, stateCompression: typeof DecompressionStream === 'function' ? 'gzip' : undefined },
      reconnection: true,
      reconnectionAttempts: 100,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
    });

    this.socket.on('connect', () => {
      this.connected = true;
      this.restoreOnSnapshot = true;
      this.callbacks.onConnection?.(true);
      this.callbacks.onHealth?.('connecting');
      this.checkHealth();
      this.healthTimer = setInterval(() => this.checkHealth(), 5000);
    });

    this.socket.on('disconnect', () => {
      this.connected = false;
      this.connectionVersion++; this.receiveQueue = Promise.resolve();
      clearInterval(this.healthTimer);
      this.callbacks.onConnection?.(false);
      this.callbacks.onHealth?.('offline');
    });

    this.socket.on('connect_error', () => { this.callbacks.onConnection?.(false); this.callbacks.onHealth?.('offline'); });

    this.socket.on('message', (msg: ServerMessage | ArrayBuffer | ArrayBufferView, receipt?: () => void) => {
      this.receiveMessage(msg, receipt);
    });

    this.socket.on('world_state_full', (msg: ServerMessage) => {
      this.receiveMessage(msg);
    });

    this.socket.on('world_state_delta', (msg: ServerMessage) => {
      this.receiveMessage(msg);
    });
  }

  private receiveMessage(msg: ServerMessage | ArrayBuffer | ArrayBufferView, receipt?: () => void): void {
    const version = this.connectionVersion;
    // Decode asynchronously, but keep role changes, effects and state in wire order.
    this.receiveQueue = this.receiveQueue.then(async () => {
      if (version !== this.connectionVersion || !this.connected) return;
      let message: ServerMessage;
      if (msg instanceof ArrayBuffer || ArrayBuffer.isView(msg)) {
        const bytes = msg instanceof ArrayBuffer ? msg : new Uint8Array(msg.buffer, msg.byteOffset, msg.byteLength).slice().buffer;
        const decoded = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'));
        message = await new Response(decoded).json() as ServerMessage;
      } else message = msg;
      if (version !== this.connectionVersion || !this.connected) return;
      this.handleMessage(message);
      // Release the next state only once decoding and application both finish.
      receipt?.();
    }).catch(error => {
      if (version !== this.connectionVersion || !this.socket) return;
      console.warn('[Socket] Could not read state; reconnecting without compression.', error);
      this.socket.auth = { ...this.socket.auth, stateCompression: undefined };
      this.reconnect();
    });
  }

  private checkHealth(): void {
    const socket = this.socket;
    if (!socket?.connected) return;
    const connection = socket.id, started = performance.now();
    socket.timeout(4000).emit('session_ping', (error: Error | null) => {
      if (!socket.connected || socket.id !== connection) return;
      const latency = Math.round(performance.now() - started);
      this.callbacks.onHealth?.(error || latency > 1500 ? 'slow' : this.restoreOnSnapshot ? 'connecting' : 'ready', error ? undefined : latency);
    });
  }

  reconnect(): void { this.socket?.disconnect().connect(); }

  private handleMessage(msg: ServerMessage): void {
    const { type, data, tick } = msg;

    switch (type) {
      case 'player_state': {
        const state = data as { agentId?: string | null; error?: string; message?: string };
        if (state.agentId !== undefined) this.resumeAgent = state.agentId;
        this.callbacks.onPlayerState?.(state);
        break;
      }
      case 'world_state_full':
        this.callbacks.onWorldStateFull(data as WorldStateFull, tick);
        if (this.restoreOnSnapshot) {
          this.restoreOnSnapshot = false;
          if (this.resumeAgent) this.send('play_as', { agentId: this.resumeAgent });
          this.checkHealth();
        }
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
    if (type === 'leave_character') this.resumeAgent = null;
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
    this.connectionVersion++; this.receiveQueue = Promise.resolve();
    clearInterval(this.healthTimer);
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
  }
}
