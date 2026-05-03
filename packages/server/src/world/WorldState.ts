import { LOCATIONS, distance, generateId, type AgentState, type AgentId, type Vector3, type ChunkData, type LocationData, type WorldEvent, type StoryPhaseId } from '@auto_matrix/shared';

export class WorldState {
  dimensions = { x: 1000, y: 100, z: 1000 };
  chunks: Map<string, ChunkData> = new Map();
  locations: Map<string, LocationData> = new Map();
  agents: Map<AgentId, AgentState> = new Map();
  globalEvents: WorldEvent[] = [];
  currentPhase: StoryPhaseId = 'phase1_normal_life';
  simulationTick = 0;
  timeOfDay = 0;

  private readonly chunkSize = 16;

  constructor() {
    this.initializeLocations();
  }

  private initializeLocations(): void {
    for (const [id, locDef] of Object.entries(LOCATIONS)) {
      const loc: LocationData = {
        id,
        name: locDef.name,
        description: locDef.description,
        bounds: locDef.bounds,
        center: {
          x: (locDef.bounds.min.x + locDef.bounds.max.x) / 2,
          y: (locDef.bounds.min.y + locDef.bounds.max.y) / 2,
          z: (locDef.bounds.min.z + locDef.bounds.max.z) / 2,
        },
        faction: locDef.faction,
        properties: {},
        connectedLocations: [],
        isInterior: locDef.isInterior,
      };
      this.locations.set(id, loc);
    }
  }

  registerAgent(agent: AgentState): void {
    this.agents.set(agent.id, { ...agent });
  }

  removeAgent(agentId: AgentId): void {
    this.agents.delete(agentId);
  }

  getAgent(agentId: AgentId): AgentState | undefined {
    const agent = this.agents.get(agentId);
    return agent ? { ...agent } : undefined;
  }

  getAllAgents(): AgentState[] {
    return Array.from(this.agents.values()).map((a) => ({ ...a }));
  }

  updateAgent(agentId: AgentId, updates: Partial<AgentState>): void {
    const existing = this.agents.get(agentId);
    if (!existing) return;
    this.agents.set(agentId, { ...existing, ...updates });
  }

  getAgentsNear(position: Vector3, radius: number): AgentState[] {
    const result: AgentState[] = [];
    for (const agent of this.agents.values()) {
      if (agent.status === 'dead' || agent.status === 'disconnected') continue;
      if (distance(agent.position, position) <= radius) {
        result.push({ ...agent });
      }
    }
    return result;
  }

  getAgentsAtLocation(locationId: string): AgentState[] {
    const result: AgentState[] = [];
    for (const agent of this.agents.values()) {
      if (agent.currentLocation === locationId) {
        result.push({ ...agent });
      }
    }
    return result;
  }

  getLocation(locationId: string): LocationData | undefined {
    return this.locations.get(locationId);
  }

  getAllLocations(): LocationData[] {
    return Array.from(this.locations.values());
  }

  addWorldEvent(event: Omit<WorldEvent, 'id'>): WorldEvent {
    const fullEvent: WorldEvent = {
      id: generateId('evt'),
      ...event,
    };
    this.globalEvents.push(fullEvent);
    // Keep only the last 100 events
    if (this.globalEvents.length > 100) {
      this.globalEvents = this.globalEvents.slice(-100);
    }
    return fullEvent;
  }

  getChunkKey(x: number, y: number, z: number): string {
    const cx = Math.floor(x / this.chunkSize);
    const cy = Math.floor(y / this.chunkSize);
    const cz = Math.floor(z / this.chunkSize);
    return `${cx},${cy},${cz}`;
  }

  advanceTick(): void {
    this.simulationTick += 1;
    this.timeOfDay = (this.simulationTick % 86400) / 86400;
  }

  getCurrentPhase(): StoryPhaseId {
    return this.currentPhase;
  }

  setPhase(phase: StoryPhaseId): void {
    this.currentPhase = phase;
  }

  getRecentEvents(count: number): WorldEvent[] {
    return this.globalEvents.slice(-count);
  }
}
