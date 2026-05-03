import type { AgentState, AgentId, WorldStateDelta, WorldEvent } from '@auto_matrix/shared';

export class StateSync {
  private lastSentPositions = new Map<AgentId, { x: number; y: number; z: number }>();
  private pendingEvents: WorldEvent[] = [];

  addEvent(event: WorldEvent): void {
    this.pendingEvents.push(event);
  }

  calculateDelta(agents: Map<AgentId, AgentState>): WorldStateDelta {
    const agentDeltas: Record<string, Partial<AgentState>> = {};
    let hasChanges = false;

    for (const [id, state] of agents) {
      const lastPos = this.lastSentPositions.get(id);
      const pos = state.position;

      // Only send if position changed significantly (0.5 blocks)
      if (!lastPos ||
        Math.abs(lastPos.x - pos.x) > 0.5 ||
        Math.abs(lastPos.y - pos.y) > 0.5 ||
        Math.abs(lastPos.z - pos.z) > 0.5
      ) {
        agentDeltas[id] = {
          position: { ...pos },
          rotation: state.rotation,
          health: state.health,
          mood: state.mood,
          currentAction: state.currentAction,
          currentGoal: state.currentGoal,
          status: state.status,
          isAwakened: state.isAwakened,
          activeEffects: state.activeEffects,
        };
        this.lastSentPositions.set(id, { ...pos });
        hasChanges = true;
      }
    }

    const events = [...this.pendingEvents];
    this.pendingEvents = [];

    if (!hasChanges && events.length === 0) {
      return { agents: {}, dirtyChunks: {}, events: [] };
    }

    return {
      agents: agentDeltas,
      dirtyChunks: {},
      events,
    };
  }
}
