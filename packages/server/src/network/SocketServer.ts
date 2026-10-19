import { Server as SocketIOServer, type Socket } from 'socket.io';
import type { Server as HTTPServer } from 'http';
import type { ServerMessage, WorldStateFull, WorldStateDelta, AgentState, StoryPhaseId, WorldEvent, EvolutionUpdate } from '@auto_matrix/shared';

type StateMessage = { type: 'world_state_full'; data: WorldStateFull; tick: number; timestamp: number }
  | { type: 'world_state_delta'; data: WorldStateDelta; tick: number; timestamp: number };

export class SocketServer {
  private io: SocketIOServer;
  private lastFields = new Map<string, string>();
  private lastTick?: number;
  private stateStreams = new WeakMap<Socket, { waiting: boolean; full?: StateMessage; delta?: Extract<StateMessage, { type: 'world_state_delta' }> }>();

  constructor(httpServer: HTTPServer) {
    this.io = new SocketIOServer(httpServer, {
      cors: { origin: '*', methods: ['GET', 'POST'] },
      // World/traffic snapshots repeat at 20 Hz; uncompressed JSON queues seconds
      // of stale poses ahead of player commands on a limited connection.
      perMessageDeflate: { threshold: 1024, zlibDeflateOptions: { level: 1 } },
    });

    this.io.on('connection', (socket) => {
      console.log(`[Socket] Client connected: ${socket.id}`);
      socket.on('session_ping', (reply: unknown) => { if (typeof reply === 'function') reply(); });
      socket.on('disconnect', () => {
        console.log(`[Socket] Client disconnected: ${socket.id}`);
      });
    });
  }

  sendFullState(socketId: string, data: WorldStateFull, tick: number): void {
    const socket = this.io.sockets.sockets.get(socketId);
    if (socket) this.sendState(socket, {
      type: 'world_state_full',
      data,
      tick,
      timestamp: Date.now(),
    });
  }

  broadcastDelta(data: WorldStateDelta, tick: number): void {
    let changed = tick !== this.lastTick || Boolean(Object.keys(data.dirtyChunks).length || data.events.length);
    this.lastTick = tick;
    for (const [id, state] of Object.entries(data.agents)) changed = this.changed(`agent:${id}`, state) || changed;
    // Fast traffic and full sandbox snapshots replace the same client state.
    if (data.sandbox) changed = (data.sandbox.traffic === undefined
      ? this.lastFields.delete('world:traffic') : this.changed('world:traffic', data.sandbox.traffic)) || changed;
    for (const [key, value] of Object.entries(data)) {
      if (key !== 'agents' && key !== 'dirtyChunks' && key !== 'events') changed = this.changed(`world:${key}`, value) || changed;
    }
    if (!changed) return;
    // Scene actors and their performance clocks travel together, including
    // stationary cast members, even when waiting frames are coalesced below.
    const message: StateMessage = {
      type: 'world_state_delta',
      data,
      tick,
      timestamp: Date.now(),
    };
    for (const socket of this.io.sockets.sockets.values()) this.sendState(socket, message);
  }

  private sendState(socket: Socket, message: StateMessage): void {
    // Older open tabs keep their existing protocol until they reload.
    if (socket.handshake.auth.stateAcknowledgements !== true) { socket.emit('message', message); return; }
    let stream = this.stateStreams.get(socket);
    if (!stream) { stream = { waiting: false }; this.stateStreams.set(socket, stream); }
    if (stream.waiting) {
      // Freeze queued values: the simulation keeps mutating its live objects.
      const next = JSON.parse(JSON.stringify(message)) as StateMessage;
      if (next.type === 'world_state_full') {
        stream.full = next; stream.delta = undefined;
      } else if (!stream.delta) {
        stream.delta = next;
      } else {
        const previous = stream.delta.data, data = next.data;
        const agents = { ...previous.agents };
        for (const [id, state] of Object.entries(data.agents)) agents[id] = { ...agents[id], ...state };
        const merged = { ...previous, ...data, agents, dirtyChunks: { ...previous.dirtyChunks, ...data.dirtyChunks }, events: [...previous.events, ...data.events] };
        // Full sandbox replaces traffic; a newer explicit traffic field wins.
        if (data.sandbox && !data.traffic) delete merged.traffic;
        stream.delta = { ...next, data: merged };
      }
      return;
    }
    stream.waiting = true;
    socket.emit('message', message, () => {
      stream.waiting = false;
      if (!socket.connected) return;
      const next = stream.full ?? stream.delta;
      if (stream.full) stream.full = undefined; else stream.delta = undefined;
      if (next) this.sendState(socket, next);
    });
  }

  private changed(key: string, value: unknown): boolean {
    const serialized = JSON.stringify(value);
    if (serialized === undefined || this.lastFields.get(key) === serialized) return false;
    this.lastFields.set(key, serialized);
    return true;
  }

  broadcastMessage(msg: ServerMessage): void {
    this.io.emit('message', msg);
  }

  broadcastStoryEvent(name: string, description: string, tick: number): void {
    this.io.emit('message', {
      type: 'story_event',
      data: { name, description, importance: 8 },
      tick,
      timestamp: Date.now(),
    } satisfies ServerMessage);
  }

  broadcastPhaseChange(from: StoryPhaseId, to: string, name: string, description: string, tick: number): void {
    this.io.emit('message', {
      type: 'phase_change',
      data: { from, phase: to, name, description },
      tick,
      timestamp: Date.now(),
    } satisfies ServerMessage);
  }

  broadcastNarration(text: string, tick: number): void {
    this.io.emit('message', {
      type: 'notification',
      data: { message: text, level: 'narration' },
      tick,
      timestamp: Date.now(),
    } satisfies ServerMessage);
  }

  broadcastChatBubble(agentId: string, text: string, tick: number): void {
    this.io.emit('message', {
      type: 'chat_bubble',
      data: { agentId, text },
      tick,
      timestamp: Date.now(),
    } satisfies ServerMessage);
  }

  broadcastEvolutionUpdate(update: EvolutionUpdate, tick: number): void {
    this.io.emit('message', {
      type: 'evolution_update',
      data: update,
      tick,
      timestamp: Date.now(),
    } satisfies ServerMessage);
  }

  broadcastEvolutionNarration(text: string, tick: number): void {
    this.io.emit('message', {
      type: 'evolution_narration',
      data: { text },
      tick,
      timestamp: Date.now(),
    } satisfies ServerMessage);
  }

  getConnectedCount(): number {
    return this.io.engine.clientsCount;
  }

  getIO(): SocketIOServer {
    return this.io;
  }
}
