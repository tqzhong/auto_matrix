import type { AgentState, AgentId, WorldStateDelta, WorldEvent } from '@auto_matrix/shared';

export class StateSync {
  private lastSent = new Map<AgentId, string>();
  private pendingEvents: WorldEvent[] = [];

  addEvent(event: WorldEvent): void {
    this.pendingEvents.push(event);
  }

  calculateDelta(agents: Map<AgentId, AgentState>): WorldStateDelta {
    const changed: Record<string, AgentState> = {};
    for (const [id, state] of agents) {
      // Small population: compare complete states, including stationary changes.
      const serialized = JSON.stringify(state);
      if (serialized !== this.lastSent.get(id)) {
        // A missing property is dropped by JSON and would leave the old client marker.
        changed[id] = { ...structuredClone(state), controller: state.controller ?? null };
        this.lastSent.set(id, serialized);
      }
    }
    const events = this.pendingEvents.splice(0);
    return { agents: changed, dirtyChunks: {}, events };
  }
}
