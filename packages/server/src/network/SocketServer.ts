import { Server as SocketIOServer } from 'socket.io';
import type { Server as HTTPServer } from 'http';
import type { ServerMessage, WorldStateFull, WorldStateDelta, AgentState, StoryPhaseId, WorldEvent, EvolutionUpdate } from '@auto_matrix/shared';

export class SocketServer {
  private io: SocketIOServer;
  private lastFields = new Map<string, string>();
  private lastTick?: number;

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
    this.io.to(socketId).emit('message', {
      type: 'world_state_full',
      data,
      tick,
      timestamp: Date.now(),
    } satisfies ServerMessage);
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
    // Keep each meaningful packet intact: scene actors and their performance
    // clocks must arrive together, including the stationary members of a cast.
    this.io.emit('message', {
      type: 'world_state_delta',
      data,
      tick,
      timestamp: Date.now(),
    } satisfies ServerMessage);
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
