import { Server as SocketIOServer } from 'socket.io';
import type { Server as HTTPServer } from 'http';
import type { ServerMessage, WorldStateFull, WorldStateDelta, AgentState, StoryPhaseId, WorldEvent, EvolutionUpdate } from '@auto_matrix/shared';

export class SocketServer {
  private io: SocketIOServer;
  private clientSpeeds = new Map<string, number>();

  constructor(httpServer: HTTPServer) {
    this.io = new SocketIOServer(httpServer, {
      cors: { origin: '*', methods: ['GET', 'POST'] },
    });

    this.io.on('connection', (socket) => {
      console.log(`[Socket] Client connected: ${socket.id}`);
      this.clientSpeeds.set(socket.id, 1);

      socket.on('set_speed', (data: { multiplier: number }) => {
        this.clientSpeeds.set(socket.id, data.multiplier ?? 1);
      });

      socket.on('pause', () => {
        this.clientSpeeds.set(socket.id, 0);
      });

      socket.on('resume', () => {
        this.clientSpeeds.set(socket.id, 1);
      });

      socket.on('disconnect', () => {
        this.clientSpeeds.delete(socket.id);
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
    this.io.emit('message', {
      type: 'world_state_delta',
      data,
      tick,
      timestamp: Date.now(),
    } satisfies ServerMessage);
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
      data: { from, to, name, description },
      tick,
      timestamp: Date.now(),
    } satisfies ServerMessage);
  }

  broadcastNarration(text: string, tick: number): void {
    this.io.emit('message', {
      type: 'notification',
      data: { text, type: 'narration' },
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
